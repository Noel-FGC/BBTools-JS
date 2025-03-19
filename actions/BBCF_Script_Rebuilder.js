// this is spaghetti fml i already need to rewrite everything for v2

const fs = require('node:fs');
const path = require('node:path');
const struct = require('python-struct');
const { types, parseSync } = require('@babel/core');
const util = require('util');
const debugLog = require('../util/debugLog.js');

const encoder = new TextEncoder();

let argObj = require('../util/processArgs.js')({
  dumpTree: {
    short: 'D',
    long: 'dumptree',
    type: 'boolean',
    default: 'false',
    description: 'Dump AST tree to scr_xx_AST.json'
  },
  raw: {
    short: 'r',
    long: 'raw',
    type: 'boolean',
    default: false,
    description: 'Dump raw interpreted BBScript function calls after parsing js',
    disabled: true
  },
  unknownFunctionString: {
    short: 'f',
    long: 'unknown-function-string',
    type: 'string',
    description: 'Sets the string used to determine Unknown BBScript function calls',
    default: 'Unknown',
    disabled: true
  },
  uponString: {
    short: 'u',
    long: 'uponstring',
    type: 'string',
    description: 'Sets the string used to determine Unknown upons',
    default: 'upon_',
    disabled: true
  },
  slotString: {
    short: 's',
    long: 'slotstring',
    type: 'string',
    description: 'Sets the string used to determine Unknown slots',
    default: 'SLOT_',
    disabled: true
  }
})

let logfile;
let errorLevel = 0;

const babelOptions = {};

const MODE = argObj.endian.value


//console.log(dbObj.named_value_lookup)
//console.log(dbObj.named_direction_lookup)
//console.log(dbObj.named_button_lookup)

function write(buf) {
	output_buffer = Buffer.concat([output_buffer, buf])
}

function decode_upon(argString) {
  string = argString.toLowerCase()
  if (!string.includes(argObj.uponString.value.toLowerCase())) {
    debugLog('Passed Upon String Did Not Contain ' + argObj.uponString.value, 0);
  }
  string = string.replace(argObj.uponString.value.toLowerCase(), '')

  if(parseInt(string)) {
    return parseInt(string);
  }
  for (entry in dbObj.uponDB) {
    if (dbObj.uponDB[entry].toLowerCase() === string) {
      //console.log(entry)
      //console.log(dbObj.uponDB[entry])
      return parseInt(entry);
    }
  }
  debugLog('Unknown Upon: ' + argString, 0)
}

function decode_slot(argString) {
  string = argString.toLowerCase()
  if (!string.startsWith(argObj.slotString.value.toLowerCase())) {
    debugLog('Passed SLOT String Did Not Contain' + argObj.slotString.value, 0)
  } 
  string = string.replace(argObj.slotString.value.toLowerCase(), '')
  for (entry in dbObj.slotDB) {
    if (dbObj.slotDB[entry].toLowerCase() === string) {
      return parseInt(entry);
    }
  }
  if (parseInt(string) !== undefined) { // SLOT_0 my behated
    return parseInt(string);
  }

  debugLog('Unknown SLOT ' + argString, 0)
}

function write_command_by_name(name, params) {
  cmd_data = dbObj.commandDB_lookup[name.toLowerCase()];
  write_command_by_id(cmd_data.id, params)
}

function write_command_by_id(id, params = []) {
  cmd_data = dbObj.commandDB[id]
  my_params = [];
  //console.log(params)

  for ([index, param] of params.entries()) {
    if (!(param instanceof Object)) {
      my_params[index] = param
      continue;
    };
    if (param.type == "StringLiteral") {
      my_params[index] = param.value;
      //console.log(param.value);
    }
    else if (param.type == "NumericLiteral") {
      my_params[index] = param.value
    } 
    else if(param.type == "Identifier") {
      temp = dbObj.named_value_lookup[param.name.toLowerCase()]
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
          my_params[index] = (parseInt(dbObj.named_button_lookup[buttonstr]) << 8) + parseInt(dbObj.named_direction_lookup(directionstr))
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
    if (name.toLowerCase().startsWith(argObj.uponString.value.toLowerCase())) {
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
  } else if (name.toLowerCase().startsWith(argObj.uponString.value.toLowerCase())) {
    return 'upon'
  }

}

// @babel/traverse isnt real, it cant hurt you
class Rebuilder {
  visit(node) { // handled by node.ExplicitNodeVisitor in python
    //console.log(node)
    if (node.type == "ExpressionStatement") {
      node = node.expression
    }
    //console.log(node)
    if (typeof this[`visit_${node.type}`] == 'function') {
      this[`visit_${node.type}`](node);
    } else {
      debugLog(`No handler for node type: ${node.type}`, 1);
      this.generic_visit(node);
    }
  }
  visit_Program(node) { // visit_Module
    root = node
    let state_count = 0
    let temp = [];
    for (let [index, funcNode] of node.body.entries()) {
      if (funcNode.type != 'FunctionDeclaration') {
        debugLog(funcNode.type + ' Found Outside Of Function At Line: ' + funcNode.loc.start.line, 0)
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
			tempBuf.copy(output_buffer, (4 + 36 * node._index + 32))
		} else if (getFunctionType(node.params) == 'subroutine') {
      begin_id = 8
      end_id = 9
    } else {
      debugLog('Unsupported Function Type "' + getFunctionType(node.params) + '" Found At Line: ' + node.loc.start.line, 0)
    }
    node.id.name = node.id.name.replace('__sp__', ' ')
                               .replace('__qu__', '?')
                               .replace('__ds__', '-')
                               .replace('__at__', '@')
    write_command_by_id(begin_id, [ node.id.name ])
    this.visit(node.body)
    write_command_by_id(end_id)
  }
  visit_CallExpression(node) { // visit_Call
    let name = node.callee.name.toLowerCase()
    if ([ '_if', '_else'].includes(name)) name = name.slice(1)
    let cmd_id = 0;
    if (node.callee.name.startsWith(argObj.unknownFunctionString.value.toLowerCase())) {
			cmd_id = name.replace(argObj.unknownFunctionString.value.toLowerCase(), "");
		} else if (dbObj.commandDB_lookup[name] !== undefined) {
			cmd_id = dbObj.commandDB_lookup[name].id
		} else {
			debugLog("Unknown Command " + node.callee.name + " At Line: " + node.loc.start.line, 0)
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
      write_command_by_id(begin_id, [ upon ] )
      this.visit(node.body)
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
    } else if (node.test.type == "UnaryExpression") {
      begin_id = 54
      end_id = 55
      slot = decode_slot(node.test.argument.name)
    } else {
      debugLog('If Statement With Unsupported Test Field At Line: ' + node.loc.start.line, 0)
    }

    //console.log(slot)

    write_command_by_id(begin_id, [ 2, slot ])
    this.visit(node.consequent)
    write_command_by_id(end_id)

    if (node.alternate !== null) {
      write_command_by_id(56)
      this.visit(node.alternate)
      write_command_by_id(57)
    }

  }
  visit_BoolOp(node) {

  }
  visit_UnaryExpression(node) { // visit_UnaryOp

  }
  visit_BinOp(node) {

  }
  visit_AssignmentExpression(node) { // visit_Assign
    if (node.left.type !== 'Identifier') debugLog('Assignment to non-variable at ' + node.loc.start.line, 1);
    let command = 0;
    let args = [];
    
    if (node.right.type == 'BinaryExpression') {
      command = 49;
      let rightValue = 0;
      let opID = 0;
      let rightTypeIdentifier = 0;
      let leftValue = decode_slot(node.left.name);
      
      if (node.right.right.type == 'Identifier') {
        rightValue = decode_slot(node.right.right.name)
        rightTypeIdentifier = 2;
      } else {
        rightValue = node.right.right.value
      }

      switch (node.right.operator) {
        case '+':
          opID = 0;
          break;
        case '-':
          opID = 1;
          break;
        case '*':
          opID = 2;
          break;
        case '/':
          opID = 3;
          break;
        default:
          debugLog('Unsupported Operator at line: ' + node.loc.start.line)
      }

      args = [
        opID,
        2,
        leftValue,
        rightTypeIdentifier,
        rightValue
      ];
      
    } else {
      command = 43
      let rightTypeIdentifier = 0;
      //console.log(node.right)
      if (node.right.type == 'Identifier') {
        rightTypeIdentifier = 2
        node.right.value = decode_slot(node.right.name)
      }
      args = [
        2,
        decode_slot(node.left.name),
        rightTypeIdentifier,
        node.right.value
      ];
    }

    console.log(command + '(' + args.join(', ') + ')')
    write_command_by_id(command, args)
  }
  visit_Compare(node) {

  }
  visit_BlockStatement(node) { // visit_body
    try {
      node.body.forEach(childNode => {
        this.visit(childNode)
      })
    } catch (error) {
      errorLevel += 1
      debugLog(error, 1) // This Sucks compared to the python version but idc
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
    if (argObj.dumpTree == 1 || errorLevel >= 1) {
      fs.writeFile(astOutput, JSON.stringify(ast, null, 2), (err) => { if (err) {console.error(err)}})
    }

		//console.log(output_buffer)
		fs.writeFile(output, output_buffer, (err) => {if (err) { console.error(err)}})

    //output_buffer.end();
    debugLog('complete', 3, true)
  }
}

let usageString = 'scr_xx.js outdir [opts]'
let optString = require('../util/genOptString.js')(argObj)

let dbObj

function Rebuild(args) {
  dbObj = require('../util/fetchDBs.js');
  if (!([2, 3].includes(args.length)) || path.extname(args[1]) != ".js") return "Invalid Args";

  let character_id = args[1].replace("scr_", "").split(".")[0]
  if (character_id.slice(2) === "ea" && character_id.length > 2) {
    character_id = character_id.slice(0, -2)
  }
  dbObj = require('../util/fetchDBs')(character_id);

dbObj.commandDB_lookup = {}
dbObj.slotDB_lookup = {}
dbObj.named_value_lookup = {}
dbObj.named_button_lookup = {}
dbObj.named_direction_lookup = {}

for (command in dbObj.commandDB) {
  //console.log(command)
  db_data = dbObj.commandDB[command]
  if (db_data.name) {
    dbObj.commandDB_lookup[db_data.name.toLowerCase()] = db_data
    dbObj.commandDB_lookup[db_data.name.toLowerCase()].id = command;
  }
  dbObj.commandDB_lookup[argObj.unknownFunctionString.value.toLowerCase() + command] = db_data
  dbObj.commandDB_lookup[argObj.unknownFunctionString.value.toLowerCase() + command].id = command;
}

for (value in dbObj.moveInputs) {
  dbObj.named_value_lookup[dbObj.moveInputs[value].toLowerCase()] = parseInt(value)
}
for (value in dbObj.normalInputs.grouped_values) {
  dbObj.named_value_lookup[dbObj.normalInputs.grouped_values[value].toLowerCase()] = parseInt(value)
}
for (value in dbObj.normalInputs.button_byte) {
  dbObj.named_button_lookup[dbObj.normalInputs.button_byte[value].toLowerCase()] = parseInt(value)
}
for (value in dbObj.normalInputs.direction_byte) {
  dbObj.named_direction_lookup[dbObj.normalInputs.direction_byte[value].toLowerCase()] = parseInt(value)
}
  if (args.length == 2) {
    rebuild_bbscript(args[1], path.dirname(args[1]));
  } else {
    rebuild_bbscript(args[1], args[2]);
  }
}

module.exports = { Rebuild, optString, usageString }
