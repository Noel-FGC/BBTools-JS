const fs = require('node:fs');
const path = require('node:path');
const struct = require('python-struct');
const generate = require('@babel/generator').default;
const { types } = require('@babel/core');
const traverse = require('@babel/traverse').default;
const util = require('util');
const prettier = require('@prettier/sync');
const debugLog = require('../util/debugLog.js')

let argObj = require('../util/processArgs.js')({
  dumpTree: {
    short: 'D',
    long: 'dumptree',
    type: 'boolean',
    default: 'false',
    description: 'Dump AST tree to scr_xx_AST.json'
  },
  elseCleanType: {
    short: 'e',
    long: 'else-clean-type',
    type: 'string',
    default: 'if',
    usage: '<if/all/none>',
    description: 'Sets how else statements should be handled'
  },
  raw: {
    short: 'r',
    long: 'raw',
    type: 'boolean',
    default: false,
    description: 'Print raw BBScript function calls without wrapping as js'
  },
})

const dumpTree = argObj.dumpTree.value;
const raw = argObj.raw.value;
let elseCleanType = argObj.elseCleanType

let tempRaw = false;
let errorLevel = 0;

const babelOptions = {};

let MODE = "<"

function find_named_value(command, value) {
  let str_value = value.toString()
  if ([43, 14012].includes(command)) {
    if (dbObj.moveInputs[str_value] !== undefined) {
      return dbObj.moveInputs[str_value]
    }
  } else if (command == 14001) {
    if (dbObj.normalInputs.grouped_values[value] !== undefined) {
      return dbObj.normalInputs.grouped_values[value]
    }
    let s = struct.pack('>H', value);
    let [button_byte, dir_byte] = struct.unpack('>BB', s)

    if ( (dbObj.normalInputs[button_byte.toString()] !== undefined ) && (dbObj.normalInputs.direction_byte[dir_byte.toString()])) {
      return [ dbObj.normalInputs.direction_byte[dir_byte], dbObj.normalInputs.button_byte[button_byte] ]
    }
  }

  return value.toString(16);
}

function get_upon_name(cmd_data) {
  let str_cmd_data = cmd_data.toString()
  if (dbObj.uponDB[str_cmd_data] !== undefined) {
    str_cmd_data = dbObj.uponDB[str_cmd_data]
  }
  return `upon_${str_cmd_data}`
}

function get_slot_name(cmd_data) {
  let str_cmd_data = cmd_data.toString()
  if (dbObj.slotDB[str_cmd_data] !== undefined) {
    str_cmd_data = dbObj.slotDB[str_cmd_data]
  }
  return `SLOT_${str_cmd_data}`
}

// Not Used Yet
function get_object_name(cmd_data) {
  let str_cmd_data = cmd_data.toString()
  if (dbObj.objectDB[str_cmd_data] !== undefined) {
    str_cmd_data = dbObj.objectDB[str_cmd_data]
  }
  return str_cmd_data
}


// Changes numbers to their db value
function sanitizer(command, values) {
  let returnValues = [];
	values.forEach(value => {
    if ([43, 14001, 14012].includes(command) && (typeof value == "number")) { // This doesnt seem to get called
      let tmp = (types.StringLiteral(find_named_value(command, value)))
			//tmp.arguments.extra.raw = value.toString(16);
			returnValues.push(tmp)
		} 

    else if ([17, 29, 30, 21007].includes(command) && i === 0) {
      returnValues.push(types.Identifier(get_upon_name(value).replace("upon_", "")))
    }

    else if (command && (typeof value !== "string") && dbObj.commandDB[command.toString()].hex == true) {
      let tmp = (types.NumericLiteral(value))
			tmp.extra = {
				rawValue: value,
				raw: ('0x' + value.toString(16))
			};
			//console.log(tmp)
			returnValues.push(tmp)
    }

		else if (typeof value == 'number') {
			returnValues.push(types.NumericLiteral(value))
		} else if (typeof value == 'string') {
			returnValues.push(types.StringLiteral(value))
		}
  });
	return returnValues;
}

function function_clean(command) {
  command =
    command.toString()
           .replace('-', "__ds__")
           .replace('@', "__at__")
           .replace('?', "__qu__")
           .replace(' ', "__sp__"); 
  return command
}


class ductTape { // so i dont have to rewrite half this file to use a buffer instead of a ReadStream
  constructor(file) {
    this.file = file
    this.buffer = fs.readFileSync(file)
    this.pointer = 0;
    this.readableLength = this.buffer.length
  }

  read(bytes) {
    let tempBuffer = this.buffer.slice(this.pointer, this.pointer + bytes)
    this.readableLength -= bytes
    this.pointer += bytes
    return tempBuffer;
  }

  unshift(data) {
    this.readableLength += data.length
    this.pointer -= data.length
  }
}

function parse_bbscript_routine(filename) {

  return new Promise((resolve, reject) => {
    
    const file = new ductTape(filename)

    let ast_root = types.File(types.Program([])); // i have no idea why, but traverse() shits itself if this is just a Program  
    let ast_stack = ast_root.program.body;
    let astor_handler = [];
    let FUNCTION_COUNT = 0;
    let lastRootFunction = 'Root';

    FUNCTION_COUNT = struct.unpack(MODE + "I", file.read(4))
    file.read(FUNCTION_COUNT * 0x24)

    while (true) {
      if (file.readableLength < 4) {
        break;
      }
      let current_cmd = struct.unpack(MODE + "I", file.read(4))
      db_data = dbObj.commandDB[current_cmd.toString()]
      let cmd_data = [];
      if (file.readableLength < struct.sizeOf(db_data.format) || file.readableLength < db_data.size - 4) {
        //console.log('Dude what the fuck are you parsing?')
        debugLog('Buffer Not Big Enough To Parse Command', 0);
        file.unshift(struct.pack(MODE + "I", current_cmd))
        file.close()
        break;
      }
      if (db_data.name === undefined) {
        db_data.name = `Unknown${current_cmd}`
      }
      if (db_data.format === undefined) {
        cmd_data = [file.read(db_data.size - 4)]
      } else {
        cmd_data = struct.unpack(MODE + db_data.format, file.read(struct.sizeOf(db_data.format)))
      }

      // Cleaning Up The Binary String -- i dont understand whats happening, replicated from py3 bbtools to the best of my ability
      cmd_data.forEach((value, index) => {
        if (typeof value == 'buffer') {
          try {
      cmd_data[i] = value.toString().replace("\x00", '')
          } catch (e) {
            // Handles unicode bug if it happens, eg kk400_13
            let debug = ''
            for (let byte = 0; byte < value.length; byte++) {
              debug += String.fromCharCode((value[byte])); 
            }
            cmd_data[i] = debug;
          }
        }
      })

        debugLog('current_cmd: ' + current_cmd[0], 4);
        debugLog('db_data: ' + util.inspect(db_data), 4);
        debugLog('args: ' + util.inspect(cmd_data), 4)

      // AST STUFF -- someone kill me


      if (raw == true || tempRaw == true) {
        if ((tempRaw) && (current_cmd == 1 || current_cmd == 9)) { // Disable tempRaw On startState or startSubroutine
          tempRaw = false;
        }
        ast_stack.push(types.CallExpression(types.Identifier(db_data.name), sanitizer(current_cmd, cmd_data), babelOptions))
        continue; // Continue to Next Loop
      }

      switch(parseInt(current_cmd)) {
        case 0:  //startState
          if (typeof ast_stack.at(-1) == 'array') {
              ast_stack.pop();
          }
          //ast_stack[-1].push(types.FunctionDeclaration(function_clean(cmd_data), empty_args, [], [Name(id="State")]));
          //console.log(cmd_data)
          ast_stack.push(types.FunctionDeclaration(types.Identifier(cmd_data[0]), [types.AssignmentPattern(types.Identifier('type'), types.Identifier('State'))], types.BlockStatement([]), false, false, babelOptions));
          ast_stack.push(ast_stack.at(-1).body.body)
          lastRootFunction = 'State: ' + cmd_data[0]
          break;
        case 8:  //startSubroutine
          if (typeof ast_stack.at(-1) == 'Array') {
            ast_stack.pop();
          }
          ast_stack.push(types.FunctionDeclaration(types.Identifier(cmd_data[0]), [
            types.AssignmentPattern(types.Identifier('type'), types.Identifier('Subroutine'))
          ], types.BlockStatement([]), false, false, babelOptions));
          ast_stack.push(ast_stack.at(-1).body.body)
          lastRootFunction = 'Subroutine: ' + cmd_data[0]
          break;
        case 15: //upon
          //console.log(ast_stack)
          try {
          ast_stack.at(-1).push(types.FunctionDeclaration(types.Identifier(get_upon_name(cmd_data[0])), [], types.BlockStatement([])))
          ast_stack.push(ast_stack.at(-1).at(-1).body.body)
          } catch (error) {
            debugLog(error, 1)
          }
          break;

        case 4: //if
          if (cmd_data[1] == 0) {
            let arcsysdoubleifspaghetti;

            try {
              if (ast_stack[-1][-1]) { 
                arcsysdoubleifspaghetti = ast_stack.at(-1).at(-1);
              }
            } catch {
              arcsysdoubleifspaghetti = true;
            }

            //debugLog(typeof arcsysdoubleifspaghetti);
            //debugLog(typeof ast_stack.at(-1).at(-1));
            if (typeof arcsysdoubleifspaghetti === 'object') {
              try {
                  tmp = arcsysdoubleifspaghetti.test
                  ast_stack.at(-1).push(types.IfStatement(tmp, types.BlockStatement([])));
                  ast_stack.push(ast_stack.at(-1).at(-1).consequent.body)
                  ast_stack.at(-2)(-1).pop(-2)
                } catch(error) {
                  debugLog(`Pushing If node failed at ${lastRootFunction}  with: "${error}"`, 1)
                  debugLog(`Ast Tree Will Be Dumped`)

                  errorLevel += 1;
                  tmp = types.Identifier(get_slot_name(0))
                  ast_stack.at(-1).push(types.IfStatement(tmp, types.BlockStatement([])));
                  ast_stack.push(ast_stack.at(-1).at(-1).consequent.body)
              }
            } else {
              //console.log(ast_stack)
              try {
                ast_stack.at(-1).push(types.IfStatement(types.Identifier(get_slot_name(cmd_data[1])), types.BlockStatement([])));
                ast_stack.push(ast_stack.at(-1).at(-1).consequent.body)
              } catch (error) {
                debugLog(`Pushing If node failed at ${lastRootFunction} with: "${error}"`, 1)
                debugLog(`Ast Tree Will Be Dumped, Attempting To Continue In Raw Mode`)
                errorLevel += 1;
                tempRaw = true;
                if (db_data.format !== undefined) {
                    file.unshift(struct.pack(MODE + db_data.format, cmd_data))
                  } else {
                    file.unshift(cmd_data)
                  }
                  file.unshift(struct.pack(MODE + 'I', current_cmd))
                debugLog(error, 1)
              }
            };
          } else {
            tmp = get_slot_name(cmd_data[1])
            try {
              ast_stack.at(-1).push(types.IfStatement(types.Identifier(get_slot_name(cmd_data[1])), types.BlockStatement([])));
              ast_stack.push(ast_stack.at(-1).at(-1).consequent.body)
            } catch (error) {
                debugLog(`Pushing If node failed at ${lastRootFunction} with: "${error}"`, 1)
                debugLog(`Ast Tree Will Be Dumped, Attempting To Continue In Raw Mode`)
                if (db_data.format !== undefined) {
                    file.unshift(struct.pack(MODE + db_data.format, cmd_data))
                  } else {
                    file.unshift(cmd_data)
                  }
                  file.unshift(struct.pack(MODE + 'I', current_cmd))
                tempRaw = true;
                errorLevel += 1;
            }
          }
          break;
        case 54: //ifNot
          if (cmd_data[1] == 0) {
            let arcsysdoubleifspaghetti;

            try {
              if (ast_stack[-1][-1]) { 
                arcsysdoubleifspaghetti = ast_stack.at(-1).at(-1);
              }
            } catch {
              arcsysdoubleifspaghetti = true;
            }

            if (typeof arcsysdoubleifspaghetti === 'object') {
              try {
                  tmp = arcsysdoubleifspaghetti.test
                  ast_stack.at(-1).push(types.IfStatement(tmp, types.BlockStatement([])));
                  ast_stack.push(ast_stack.at(-1).at(-1).consequent.body)
                  ast_stack.at(-2)(-1).pop(-2)
                } catch(error) {
                  debugLog(`Pushing If node failed at ${lastRootFunction}  with: "${error}"`, 1)
                  debugLog(`Ast Tree Will Be Dumped`)

                  errorLevel += 1;
                  tmp = types.Identifier(get_slot_name(0))
                  ast_stack.at(-1).push(types.IfStatement(tmp, types.BlockStatement([])));
                  ast_stack.push(ast_stack.at(-1).at(-1).consequent.body)
              }
            } else {
              //console.log(ast_stack)
              try {
                ast_stack.at(-1).push(types.IfStatement(types.Identifier(get_slot_name(cmd_data[1])), types.BlockStatement([])));
                ast_stack.push(ast_stack.at(-1).at(-1).consequent.body)
              } catch (error) {
                debugLog(`Pushing If node failed at ${lastRootFunction} with: "${error}"`, 1)
                debugLog(`Ast Tree Will Be Dumped, Attempting To Continue In Raw Mode`)
                errorLevel += 1;
                tempRaw = true;
                if (db_data.format !== undefined) {
                    file.unshift(struct.pack(MODE + db_data.format, cmd_data))
                  } else {
                    file.unshift(cmd_data)
                  }
                  file.unshift(struct.pack(MODE + 'I', current_cmd))
                debugLog(error, 1)
              }
            };
          } else {
            tmp = get_slot_name(cmd_data[1])
            try {
              ast_stack.at(-1).push(types.IfStatement(
                types.UnaryExpression('!', types.Identifier(get_slot_name(cmd_data[1]))), 
                types.BlockStatement([])));
              ast_stack.push(ast_stack.at(-1).at(-1).consequent.body)
            } catch (error) {
                debugLog(`Pushing If node failed at ${lastRootFunction} with: "${error}"`, 1)
                debugLog(`Ast Tree Will Be Dumped, Attempting To Continue In Raw Mode`)
                if (db_data.format !== undefined) {
                    file.unshift(struct.pack(MODE + db_data.format, cmd_data))
                  } else {
                    file.unshift(cmd_data)
                  }
                  file.unshift(struct.pack(MODE + 'I', current_cmd))
                tempRaw = true;
                errorLevel += 1;
            }
          }
          break;

        case 56: //else
          let ifnode = ast_stack.at(-1).at(-1)
          ifnode.alternate = types.BlockStatement([])
            ast_stack.push(ifnode.alternate.body)
          break;
        //case 18: //ifSlotSendToLabel
        //  break;
        //case 19: //ifNotSlotSendToLabel
        //  break; 
        //case 35: //ApplyFunctionsToSelf
        //  break;
        //case 36: //ApplyFunctionsToObject
        //  break;
        //case 39: //random
        //  break;
        case 40: //operation
          break;
        case 41: //StoreValue
          (function() { // put this in a function because letting leftValue and rightValue for some reason conflicts with ModifyVar
            let leftValue = 0;
            let rightValue = 0;

            if (cmd_data[0] > 0) leftValue = types.Identifier(get_slot_name(cmd_data[1]));
            else leftValue = types.NumericLiteral(cmd_data[1])

            if (cmd_data[2] > 0) rightValue = types.Identifier(get_slot_name(cmd_data[3]));
            else rightValue = types.NumericLiteral(cmd_data[3])

            ast_stack.at(-1).push(types.AssignmentExpression('=', leftValue, rightValue))
          })();
          break;

        case 49: //ModifyVar_
          if (![0, 1, 2, 3].includes(cmd_data[0])) {
            ast_stack.at(-1).push(types.CallExpression(types.Identifier(db_data.name), sanitizer(current_cmd, cmd_data), babelOptions))
            break;
          }

          let operation = '';
          let leftValue = 0;
          let rightValue = 0;


          if (cmd_data[1] > 0) leftValue = types.Identifier(get_slot_name(cmd_data[2]));
          else leftValue = types.NumericLiteral(cmd_data[2]);
          
          if (cmd_data[3] > 0) rightValue = get_slot_name(cmd_data[4]);
          else rightValue = types.NumericLiteral(cmd_data[4]);

          switch (cmd_data[0]) {
            case 0: // Add
              operation = '+'
              break;
            case 1: // Subtract
              operation = '-'
              break;
            case 2: // Multiply
              operation = '*'
              break;
            case 3: // Divide
              operation = '/'
              break;
          }

          let expression = types.BinaryExpression(operation, leftValue, rightValue)

          ast_stack.at(-1).push(types.AssignmentExpression('=', leftValue, expression))
          
          break;
        //case 1: case 5: case 9: case 16: case 35: case 55: case 57: // Indentation End
        case 1: case 5: case 9: case 16: case 55: case 57: //endState, endIf, endSubroutine, endUpon, endIfNot, endElse
          ast_stack.pop(); // Pop Temporary Node
          break;
        default: // Everything Else
          try {
            ast_stack.at(-1).push(types.CallExpression(types.Identifier(db_data.name), sanitizer(current_cmd, cmd_data), babelOptions))
          } catch(error) {
            debugLog(`Pushing To Last Function Body Failed at ${lastRootFunction} with: ${error}`, 1)
            debugLog('AST Tree Will Be Dumped')
            dumpTree = 1; 
          }

      }

    }
    // Change instances of else { if } with no extra functions to else if
    try {
      traverse(ast_root, {
        IfStatement(path){
          if (path.node.alternate && path.node.alternate.body.length == 1) {
            if ((argObj.elseCleanType.value == 'if' && types.isIfStatement(path.node.alternate.body[0])) || argObj.elseCleanType.value == 'all') {
              path.node.alternate.body[0];
              path.node.alternate = path.node.alternate.body[0];
            }
          }
        }
      })
    } catch (e) {
      debugLog('Cleaning else statements failed with: ' + e)
    }
      resolve(ast_root)
  });
}

function parse_bbscript(filename, output_dir) {

  parse_bbscript_routine(filename).then(ast_root => {
    const output = path.resolve(output_dir, path.basename(filename, path.extname(filename)) + '.js')
		const astOutput = path.resolve(output_dir, path.basename(filename, path.extname(filename)) + '_AST.json')
		if (dumpTree == 1 || errorLevel >= 1) {
			fs.writeFile(astOutput, JSON.stringify(ast_root, null, 2), { flag: 'w' } , err => { if (err){console.error(err)}})
		}
    try {
      fs.writeFile(output, prettier.format(generate(ast_root, babelOptions).code, { semi: true, parser: 'babel'}), { flag: 'w' }, err => {if (err) {console.error(err)}})
    } catch (error) {
      debugLog(`Parsing AST Failed With: ${error}`, 0)
    }
    debugLog('complete', 3, true)
  });
}

let usageString = 'scr_xx.bin [outdir]';

let optString = require('../util/genOptString.js')(argObj)

let dbObj

function Parse(args) {
  debugLog('BBCF_Script_Parser.js Recieved: ' + JSON.stringify(args), 4)
  if (!([2, 3].includes(args.length)) || path.extname(args[1]) != ".bin") return 'Invalid Args';
  
  debugLog('Fetching Character_ID')
  let character_id = args[1].replace("scr_", "").split(".")[0]
  if (character_id.slice(2) === "ea" && character_id.length > 2) {
    character_id = character_id.slice(0, -2)
  }
  debugLog(`character_id: ${JSON.stringify(character_id)}`)

  dbObj = require('../util/fetchDBs.js')(character_id)

  if (args.length == 2) {
    parse_bbscript(args[1], path.dirname(args[1]));
  } else {
    parse_bbscript(args[1], args[2]);
  }
}

module.exports = { Parse, optString, usageString }
