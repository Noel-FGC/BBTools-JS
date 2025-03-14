// this is spaghetti fml i already need to rewrite everything for v2

const fs = require('node:fs');
const path = require('node:path');
const struct = require('python-struct');
const { types, parseSync } = require('@babel/core');
const traverse = require('@babel/traverse').default;
const util = require ('util');
const readLine = require('readline');

const encoder = new TextEncoder();

let args = process.argv.slice(1);
let ogargs = JSON.stringify(args)
let debugLevel = 1;
let dumpTree = 0;
let logfile;
let errorLevel = 0;
let raw = false;
let unkString = 'Unknown'
let uponString = 'upon_'
let slotString = 'SLOT_'

const babelOptions = {
	comments: false,
	retainLines: false,
	compact: false,
	numericSeparator: false,
};

for (let i = 0; i < args.length; i++) {
  let arg = args[i]
	let targs = JSON.parse(JSON.stringify(args))
  if (!arg.startsWith('-')) {
    continue;
  }

  if (arg.toLowerCase() == '--raw' || arg == '-r') {
    raw = true
    args.splice(i, 1)
  }


	else if (arg.toLowerCase() == '--dumptree' || arg == '-D') {
		args.splice(i, 1)
		dumpTree = 1
	}

  else if (arg.toLowerCase() == '--debug' || arg == '-d') {
    args.splice(i, 1)
    logfile = path.resolve(__dirname + '/BBCF_Script_Rebuilder.log');
		if (fs.existsSync(logfile + '.bak')) {
			fs.unlink(logfile + '.bak', (err) => {if (err) {console.error(err)}});
		}
		if (fs.existsSync(logfile)) {
			fs.rename(logfile, logfile + '.bak', (err) => { if (err){console.error(err)}})
		}
    if (!isNaN(parseInt(args[i]))) {
      debugLevel = parseInt(args.splice([i]));
      i--
    } else {
      debugLevel = 2;
    }
  }
	i--
}

function debuglog (log, level = 3) {
  if (debugLevel >= level) {
    let debugString = ''
    let cmd = 'log'
    if (level == 0) {
      debugString = 'CRITICAL'
      cmd = 'error'
    } if (level == 1) {
      debugString = 'ERROR'
      cmd = 'error'
    } if (level == 2) {
      debugString = 'WARNING'
      cmd = 'warn'
    } if (level >= 3) {
      debugString = 'INFO'
    }

		console[cmd](`[${debugString}] ${log}`)
    if (logfile !== undefined) {
      fs.appendFileSync(logfile, `${Date.now()} [${debugString}] ${log}` + '\n', (err) => {
        if (err) {
          console.error(err)
        }
      })
    }
		if (level === 0) { process.exit() }
  }
}



debuglog(`args:` + ogargs)
debuglog(`debugLevel: ${debugLevel}/5`)

const game = 'BBCF'

debuglog('loading dbs from ' + path.resolve(`${__dirname}/static_db/${game}/`))

const command_db = require(path.resolve(`${__dirname}/static_db/${game}/command_db.json`))
debuglog(`command_db: ${JSON.stringify(command_db)}`, 5)
const move_inputs = require(path.resolve(`${__dirname}/static_db/${game}/named_values/move_inputs.json`))
debuglog(`move_inputs: ${JSON.stringify(move_inputs)}`, 5)
const normal_inputs = require(path.resolve(`${__dirname}/static_db/${game}/named_values/normal_inputs.json`))
debuglog(`normal_inputs: ${JSON.stringify(normal_inputs)}`, 5)

let upon_db = require(path.resolve(`${__dirname}/static_db/${game}/upon_db/global.json`))
debuglog(`upon_db: ${JSON.stringify(upon_db)}`, 5)
let slot_db = require(path.resolve(`${__dirname}/static_db/${game}/slot_db/global.json`))
debuglog(`slot_db: ${JSON.stringify(slot_db)}`, 5)
let object_db = require(path.resolve(`${__dirname}/static_db/${game}/object_db/global.json`))
debuglog(`object_db: ${JSON.stringify(object_db)}`, 5)

let character_id = args[1].replace("scr_", "").split(".")[0]

if (character_id.slice(2) === "ea" && character_id.length > 2) {
  character_id = character_id.slice(0, -2)
}

debuglog(`character_id: ${JSON.stringify(character_id)}`)

try {
  let charupon = require(path.resolve(`${__dirname}/static_db/${game}/upon_db/${character_id}.json`))
	debuglog(`charupon: ${charupon}`, 5)
  upon_db = Object.assign({}, upon_db, charupon);
} catch (error) {
  debuglog(`Opening Character upon_db Failed with: ${error}`, 2)
}

try {
  let charslot = require(path.resolve(`${__dirname}/static_db/${game}/slot_db/${character_id}.json`))
  debuglog(`charslot: ${JSON.stringify(charslot)}`, 5)
	slot_db = Object.assign({}, slot_db, charslot)
} catch (error) {
  debuglog(`Opening Character slot_db Failed with: ${error}`, 2)
}

let MODE = "<"

let command_db_lookup = {}
let slot_db_lookup = {}
let named_value_lookup = {}
let named_button_lookup = {}
let named_direction_lookup = {}

for (command in command_db) {
  //console.log(command)
  db_data = command_db[command]
  //readLine.createInterface({ input: process.stdin, output: process.stdout })
  if (db_data.name) {
    command_db_lookup[db_data.name.toLowerCase()] = db_data
    command_db_lookup[db_data.name.toLowerCase()].id = command;
  }
  command_db_lookup[unkString.toLowerCase() + command] = db_data
  command_db_lookup[unkString.toLowerCase() + command].id = command;
}

for (value in move_inputs) {
  named_value_lookup[move_inputs[value].toLowerCase()] = parseInt(value)
}
for (value in normal_inputs.grouped_values) {
  named_value_lookup[normal_inputs.grouped_values[value].toLowerCase()] = parseInt(value)
}
for (value in normal_inputs.button_byte) {
  named_button_lookup[normal_inputs.button_byte[value].toLowerCase()] = parseInt(value)
}
for (value in normal_inputs.direction_byte) {
  named_direction_lookup[normal_inputs.direction_byte[value].toLowerCase()] = parseInt(value)
}

//console.log(named_value_lookup)
//console.log(named_direction_lookup)
//console.log(named_button_lookup)

function write(buf) {
	output_buffer = Buffer.concat([output_buffer, buf])
}

function decode_upon(argString) {
  string = argString.toLowerCase()
  if (!string.includes(uponString.toLowerCase())) {
    debuglog('Passed Upon String Did Not Contain ' + uponString, 0);
  }
  string = string.replace(uponString.toLowerCase(), '')

  if(parseInt(string)) {
    return parseInt(string);
  }
  for (entry in upon_db) {
    if (upon_db[entry].toLowerCase() === string) {
      //console.log(entry)
      //console.log(upon_db[entry])
      return parseInt(entry);
    }
  }
  debuglog('Unknown Upon: ' + argString, 0)
}

function decode_slot(argString) {
  string = argString.toLowerCase()
  if (!string.startsWith(slotString.toLowerCase())) {
    debuglog('Passed SLOT String Did Not Contain' + slotString, 0)
  } 
  string = string.replace(slotString.toLowerCase(), '')
  for (entry in slot_db) {
    if (slot_db[entry].toLowerCase() === string) {
      return parseInt(entry);
    }
  }
  if (parseInt(string) !== undefined) { // SLOT_0 my behated
    return parseInt(string);
  }

  debuglog('Unknown SLOT ' + argString, 0)
}

function write_command_by_name(name, params) {
  cmd_data = command_db_lookup[name.toLowerCase()];
  write_command_by_id(cmd_data.id, params)
}

function write_command_by_id(id, params = []) {
  cmd_data = command_db[id]
  my_params = [];
  //console.log(params)

  for ([index, param] of params.entries()) {
    if (param.type == "StringLiteral") {
      my_params[index] = param.value;
      //console.log(param.value);
    }
    else if (param.type == "NumericLiteral") {
      my_params[index] = param.value
    } 
    else if(param.type == "Identifier") {
      temp = named_value_lookup[param.name.toLowerCase()]
      if (temp) {
        my_params[index] = parseInt(temp)
      } else {
        if ([17, 29, 30, 21007].includes(parseInt(id))) {
          upon = decode_upon(param.id)
          my_params[index] = upon
        }
        if ([43, 14001, 14012].includes(parseInt(id))) {
          buttonstr = param.id.slice(-1).toLowerCase()
          directionstr = param.id.slice(0, -1).toLowerCase()
          my_params[index] = (parseInt(named_button_lookup[buttonstr]) << 8) + parseInt(named_direction_lookup(directionstr))
        }
      }
    } else if (param.type == "UnaryExpression") {
      if (param.argument.type == "NumericLiteral") {
        my_params[index] = -param.argument.value
      } else if (param.argument.type == "Identifier") {
        my_params[index] = -(decode_slot(param.argument.name))
      }
    }
  }

  //console.log(my_params)
  //console.log(cmd_data.format)
  write(struct.pack(MODE + "I", parseInt(id)))
  if (cmd_data.format !== null) {
    if (my_params.length > 1) {
      write(struct.pack(MODE + cmd_data.format, my_params))
    } else {
      write(struct.pack(MODE + cmd_data.format, my_params.join())) // idk why i cant just do [0] 
    }
  } else {
    write(encoder.encode(my_params[0]))
  }
}

function getFunctionType(params, name = 'MatchInit') {
  //console.log(params)
  if (params.length == 0) {
    if (name.toLowerCase().startsWith(uponString.toLowerCase())) {
      return 'upon'
    }
  }
  //console.log(name)
  if (params[0].type == 'AssignmentPattern') {
    let assignmentNode = params[0]
    if (assignmentNode.left.name.toLowerCase() == 'type') {
      if (assignmentNode.right.name !== undefined) {
        return assignmentNode.right.name.toLowerCase()
      }
    }
  } else if (params[0].type == 'Identifier') {
    let identifierNode = params[0]
    if (identifierNode.name !== undefined) {
      return identifierNode.name.toLowerCase()
    }
  } else if (name.toLowerCase().startsWith(uponString.toLowerCase())) {
    return 'upon'
  }

}

// @babel/traverse isnt real, it cant hurt you
class Rebuilder {
  visit(node) { // handled by node.ExplicitNodeVisitor in python
    //console.log(node)
    if (node.type == "ExpressionStatement" && node.expression.type == "CallExpression") {
      node = node.expression
    }
    //console.log(node)
    if (typeof this[`visit_${node.type}`] == 'function') {
      this[`visit_${node.type}`](node);
    } else {
      debuglog(`No handler for node type: ${node.type}`, 2);
      this.generic_visit(node);
    }
  }
  visit_Program(node) { // visit_Module
    root = node
    let state_count = 0
    let temp = [];
    for (let [index, funcNode] of node.body.entries()) {
      if (funcNode.type != 'FunctionDeclaration') {
        debuglog(funcNode.type + ' Found Outside Of Function At Line: ' + funcNode.loc.start.line, 0)
      }

      //console.log(getFunctionType(funcNode.params))
      if (getFunctionType(funcNode.params) != 'state') continue;
      
      funcNode._index = state_count
      state_count++

      if (funcNode.id.name.startsWith('__') && parseInt(funcNode.name.trim(2, 2) !== NaN)) {
        funcNode.id.name = funcNode.name.trim(2, 2)
      }
      funcNode.id.name = funcNode.id.name.replace('__sp__', ' ')
                                         .replace('__qu__', '?')
                                         .replace('__at__', '@')
                                         .replace('__ds__', '-')
      temp.push(struct.pack(MODE + "32sI", funcNode.id.name, 0xFADEF00D))
    }
    //this.visit_body(node.body)
    //console.log(struct.pack(MODE + "I", state_count))
    write(struct.pack(MODE + "I", state_count)) // Im an idiot
    temp.forEach((buff) => {
      write(buff)
    })

		root._dataStart = output_buffer.length
    node.body.forEach(child_node => {
      this.visit_RootFunctionDeclaration(child_node)
    }) 
  }
  visit_StringLiteral(node) { // visit_Str

  }
  visit_RootFunctionDeclaration(node) { // visit_RootFunctionDef
    let begin_id = 0
    let end_id = 0
    if (getFunctionType(node.params) == 'state') {
      begin_id = 0
      end_id = 1
			let start_offset = (output_buffer.length - root._dataStart)
			let tempBuf = struct.pack(MODE + "I", start_offset)
      //console.log(node._index)
			tempBuf.copy(output_buffer, (4 + 36 * node._index + 32))
		} else if (getFunctionType(node.params) == 'subroutine') {
      begin_id = 8
      end_id = 9
    } else {
      debuglog('Unsupported Function Type "' + getFunctionType(node.params) + '" Found At Line: ' + node.loc.start.line, 0)
    }
    write_command_by_id(begin_id, [ types.StringLiteral(node.id.name) ])
    this.visit_body(node.body.body)
    write_command_by_id(end_id)
  }
  visit_CallExpression(node) { // visit_Call
    let name = node.callee.name.toLowerCase()
    let cmd_id = 0;
    if (node.callee.name.startsWith(unkString.toLowerCase())) {
			cmd_id = name.replace(unkString.toLowerCase(), "");
		} else if (command_db_lookup[name] !== undefined) {
			cmd_id = command_db_lookup[name].id
		} else {
			debuglog("Unknown Command " + node.callee.name + " At Line: " + node.loc.start.line, 0)
		}
    try {
      write_command_by_id(cmd_id, node.arguments)
    } catch (error) {
      //console.error(error)
      console.log(cmd_id, error.toString().split('\n')[0])
    }
  }
  visit_FunctionDeclaration(node) { // visit_FunctionDef
    let begin_id = 0
    let end_id = 0
    if (getFunctionType(node.params, node.id.name) == 'upon') {
      begin_id = 15
      end_id = 16
      let upon = decode_upon(node.id.name)
      //console.log(node.id.name + ' ' + upon)
      write_command_by_id(begin_id, [ types.NumericLiteral(upon) ] )
      this.visit_body(node.body.body)
      write_command_by_id(end_id)
    }
    
  } 
  visit_IfStatement(node) { // visit_if
    let begin_id = 0
    let end_id = 0
    let slot = 5395013 // will appear as ERR in a hex editor
    if (node.test.type == "Identifier") {
      begin_id = 4
      end_id = 5
      //console.log(node.test.name)
      slot = decode_slot(node.test.name)
      if (slot == 0) {
        console.log(node.test.name)
      }
    } else if (node.test.type == "UnaryExpression") {
      begin_id = 54
      end_id = 55
      slot = decode_slot(node.test.argument.name)
    } else {
      debuglog('If Statement With Unsupported Test Field At Line: ' + node.loc.start.line, 0)
    }

    //console.log(slot)

    write_command_by_id(begin_id, [ types.NumericLiteral(2), types.NumericLiteral(slot) ])
    this.visit_body(node.consequent.body)
    write_command_by_id(end_id)

    if (node.alternate !== null) {
      write_command_by_id(56)
      if (node.alternate.type == 'BlockStatement') {
        this.visit_body(node.alternate.body)
      } else if (node.alternate.type == 'IfStatement') {
        this.visit_IfStatement(node.alternate)
      } else if (node.alternate.type == 'CallExpression') {
        this.visit_CallExpression(node.alternate)
      } else {
        console.log('Unsupported If Statement Alternate At Line: ' + node.alternate.loc.start.line)
      }
      write_command_by_id(57)
    }

  }
  visit_BoolOp(node) {

  }
  visit_UnaryExpression(node) { // visit_UnaryOp

  }
  visit_BinOp(node) {

  }
  visit_Assign(node) {

  }
  visit_Compare(node) {

  }
  visit_body(nodebody) {
    try {
      nodebody.forEach(childNode => {
        this.visit(childNode)
      })
    } catch (error) {
      errorLevel += 1
      debuglog(error, 1) // This Sucks compared to the python version but idc
    }
  }
  visit_Expr(node) {

  }
  generic_visit(node) {
    //console.log(node.type)
  }
}

var output_buffer
var root

function rebuild_bbscript(filename, output_dir) {
  output_buffer = new Buffer.alloc(0);
	const rebuilder = new Rebuilder();
  const output = path.resolve(output_dir, path.basename(filename, path.extname(filename)) + '.bin');
	const astOutput = path.resolve(output_dir, path.basename(filename, path.extname(filename)) + '_AST.json')
  const code = fs.readFileSync(filename, 'utf-8')
  const ast = parseSync(code)
  //console.log(ast)
  try {
    rebuilder.visit_Program(ast.program)
  } catch (err) {
    console.error(err)
  } finally {
    if (dumpTree == 1 || errorLevel >= 1) {
      fs.writeFile(astOutput, JSON.stringify(ast, null, 2), (err) => { if (err) {console.error(err)}})
    }

		//console.log(output_buffer)
		fs.writeFile(output, output_buffer, (err) => {if (err) { console.error(err)}})

    //output_buffer.end();
    console.log('complete')
  }
}

if (!([2, 3].includes(args.length)) || path.extname(args[1]) != ".js") {
  console.log("Usage:node BBCF_Script_Rebuilder.js scr_xx.js outdir [options]")
  console.log("Default output directory if left blank is the input files directory.")
	console.log("options:\n")
	console.log("-D | --dumptree\n-d | --debug [level]\n-s | --streamsize {size[unit]}")
	console.log("streamsize unit can be kb, mb, or gb, if not specified it will assume the number is bytes")
  process.exit(1)
}
if (args.length == 2) {
  rebuild_bbscript(args[1], path.dirname(args[1]));
} else {
  rebuild_bbscript(args[1], args[2]);
}
