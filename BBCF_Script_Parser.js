const fs = require('node:fs');
const path = require('node:path');
const struct = require('python-struct');
const generate = require('@babel/generator').default;
const { types } = require('@babel/core');
const util = require ('util');

let args = process.argv.slice(1);
let ogargs = JSON.stringify(args)
let streamSize = 2000000; // 2mb
let debugLevel = 0;
let dumpTree = 0;
let logfile;

const babelOptions = {
	comments: false,
	retainLines: false,
	compact: false,
	numericSeparator: false,
};

console.log(args)

for (let i = 0; i < args.length; i++) {
  let arg = args[i]
	console.log(i)
	console.log(args)
	console.log(arg)
	let targs = JSON.parse(JSON.stringify(args))
  if (!arg.startsWith('-')) {
    continue;
  }


  if (arg.toLowerCase() == '--streamsize' || arg == '-s') {
    args.splice(i, 1)
    streamSize = args.splice(i, 1)[0].toLowerCase()

    if (streamSize.endsWith('kb')) {
      streamSize.slice(0, -2);
      streamSize = (parseInt(streamSize, 10) * 1000 )
    } else if (streamSize.endsWith('mb')) {
      streamSize.slice(0, -2);
      streamSize = (parseInt(streamSize, 10) * 1000000)
    } else if (streamSize.endsWith('gb')) {
      streamSize = (parseInt(streamSize, 10) * 1000000000)
    }
  }

	else if (arg.toLowerCase() == '--dumptree' || arg == '-D') {
		args.splice(i, 1)
		dumpTree = 1
	}

  else if (arg.toLowerCase() == '--debug' || arg == '-d') {
    args.splice(i, 1)
    logfile = path.resolve(__dirname + '/BBCF_Script_Parser.log');
		if (fs.existsSync(logfile + '.bak')) {
			fs.unlink(logfile + '.bak', (err) => {console.error(err)});
		}
		if (fs.existsSync(logfile)) {
			fs.rename(logfile, logfile + '.bak', (err) => {console.error(err)})
		}
    if (!isNaN(parseInt(args[i]))) {
      debugLevel = parseInt(args.splice([i]));
    } else {
      debugLevel = 2;
    }
  }
	i--
}

function debuglog (log, level = 3) {
  if (debugLevel >= level) {
    let debugString = ''
    if (level == 0) {
      debugString = 'CRITICAL'
    } if (level == 1) {
      debugString = 'ERROR'
    } if (level == 2) {
      debugString = 'WARNING'
    } if (level >= 3) {
      debugString = 'INFO'
    }

    console.log(`[${debugString}] ${log}`)
    if (logfile !== undefined) {
      fs.appendFileSync(logfile, `${Date.now()} [${debugString}] ${log}` + '\n', (err) => {
        if (err) {
          console.error(err)
        }
      })
    }
  }
}

console.log(args)

debuglog(`args:` + ogargs)
debuglog(`streamSize: ${streamSize}`)
debuglog(`debugLevel: ${debugLevel}/5`)

//break;
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

function find_named_value(command, value) {
  let str_value = value.toString()
  if ([43, 14012].includes(command)) {
    if (move_inputs[str_value] !== undefined) {
      return move_inputs[str_value]
    }
  } else if (command == 14001) {
    if (normal_inputs.grouped_values[value] !== undefined) {
      return normal_inputs.grouped_values[value]
    }
    let s = struct.pack('>H', value);
    let [button_byte, dir_byte] = struct.unpack('>BB', s)

    if ( (normal_inputs[button_byte.toString()] !== undefined ) && (normal_inputs.direction_byte[dir_byte.toString()])) {
      return [ normal_inputs.direction_byte[dir_byte], normal_inputs.button_byte[button_byte] ]
    }
  }

  return value.toString(16);
}

function get_upon_name(cmd_data) {
  let str_cmd_data = cmd_data.toString()
  if (upon_db[str_cmd_data] !== undefined) {
    str_cmd_data = upon_db[str_cmd_data]
  }
  return `upon_${str_cmd_data}`
}

function get_slot_name(cmd_data) {
  let str_cmd_data = cmd_data.toString()
  if (slot_db[str_cmd_data] !== undefined) {
    str_cmd_data = slot_db[str_cmd_data]
  }
  return `SLOT_${str_cmd_data}`
}

// Not Used Yet
function get_object_name(cmd_data) {
  let str_cmd_data = cmd_data.toString()
  if (object_db[str_cmd_data] !== undefined) {
    str_cmd_data = object_db[str_cmd_data]
  }
  return str_cmd_data
}


// Changes numbers to their db value
function sanitizer(command, values) {
  let returnValues = [];
	values.forEach(value => {
		//console.log(command)
    if ([43, 14001, 14012].includes(command) && (typeof value == "number")) { // This doesnt seem to get called
      let tmp = (types.StringLiteral(find_named_value(command, value)))
			//tmp.arguments.extra.raw = value.toString(16);
			returnValues.push(tmp)
		} 

    else if ([17, 29, 30, 21007].includes(command) && i === 0) {
      returnValues.push(types.Identifier(get_upon_name(value).replace("upon_", "")))
    }

    else if (command && (typeof value !== "string") && command_db[command.toString()].hex == true) {
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
		//returnValues.push(types.StringLiteral(value.toString()))
		//else returnValues.push(types.Identifier(value))
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


async function parse_bbscript_routine(filename) {

  return new Promise((resolve, reject) => {
    
    let file = fs.createReadStream(filename, { highWaterMark: streamSize })

    let ast_root = types.program([]);
    let ast_stack = ast_root.body;
    let astor_handler = [];
    let FUNCTION_COUNT = 0;

    file.on('end', () => {
      debuglog('stream ended')
      file.close()
      return 
    });
    let insufficientData = 0;
    file.on('readable', () => {
      if (!FUNCTION_COUNT) {
        FUNCTION_COUNT = struct.unpack(MODE + "I", file.read(4))
        file.read(FUNCTION_COUNT * 0x24)
      }
    
      while (true) {
        if (file.readableLength < 4) {
          break;
        }
        let current_cmd = struct.unpack(MODE + "I", file.read(4))
        db_data = command_db[current_cmd.toString()]
        let cmd_data = [];
        if (file.readableLength < struct.sizeOf(db_data.format) || file.readableLength < db_data.size - 4) {
          //console.log('Dude what the fuck are you parsing?')
          debuglog('Stream Not Big Enough To Parse Command, The Stream Size Limit Can Be Altered With --streamsize, Be Careful.', 0);
          console.log(current_cmd)
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

          debuglog('current_cmd: ' + current_cmd[0], 4);
          debuglog('db_data: ' + util.inspect(db_data), 4);
          debuglog('args: ' + util.inspect(cmd_data), 4)

        // AST STUFF -- someone kill me

        switch(parseInt(current_cmd)) {
          case 0:  //startState
            //if (ast_stack.length > 1) {
            //    ast_stack.pop();
            //}
            //ast_stack[-1].push(types.FunctionDeclaration(function_clean(cmd_data), empty_args, [], [Name(id="State")]));
            //console.log(cmd_data)
            ast_stack.push(types.FunctionDeclaration(types.Identifier(cmd_data[0]), [], types.BlockStatement([]), false, false, babelOptions));
            ast_stack.push(ast_stack.at(-1).body.body)
            break;
          case 8:  //startSubroutine
            ast_stack.push(types.FunctionDeclaration(types.Identifier(cmd_data[0]), [types.Identifier('State')], types.BlockStatement([]), false, false, babelOptions));
            ast_stack.push(ast_stack.at(-1).body.body)
            break;
          case 15: //upon
            console.log(ast_stack)
            ast_stack.at(-1).push(types.FunctionDeclaration(types.Identifier(get_upon_name(cmd_data[0])), [], types.BlockStatement([])))
            ast_stack.push(ast_stack.at(-1).at(-1).body.body)

            break;
          //
          //case 4: //if
          //  if (cmd_data[1] == 0) {
          //    let arcsysdoubleifspaghetti;
          //
          //    try {
          //      if (ast_stack[-1][-1]) { 
          //        arcsysdoubleifspaghetti = ast_stack[-1][-1];
          //      }
          //    } catch(error) {
          //      arcsysdoubleifspaghetti = true;
          //    }
          //
          //    console.log(typeof arcsysdoubleifspaghetti)
          //    if (typeof arcsysdoubleifspaghetti == 'object') {
          //      try {
          //        tmp = arcsysdoubleifspaghetti.test
          //        ast_stack.at(-1).body.body.push(types.IfStatement(tmp, types.BlockStatement([])))
          //        ast_stack.push(ast_stack.at(-1).body.body.at(-1).consequent.body)
          //        ast_stack.at(-2).body.body.pop(-2)
          //      } catch(error) {
          //        debuglog(error, 0)
          //        tmp = get_slot_name(0)
          //        ast_stack.at(-1).push(types.IfStatement(tmp, types.BlockStatement([])))
          //        ast_stack.push(ast_stack[-1][-1].consequent.body)
          //      }
          //    } else {
          //      ast_stack.at(-1).body.body.push(types.IfStatement(types.Identifier(get_slot_name(cmd_data[1])), types.BlockStatement([])));
          //
          //
          //      //console.log(ast_stack)
          //      ast_stack.push(
          //        types.FunctionDeclaration(
          //          types.Identifier('TemporaryIfStatementNode'),
          //          [],
          //          types.BlockStatement(
          //            ast_stack.at(-1).body.body.at(-1).consequent.body
          //          )
          //        )
          //      );
          //    };
          //  } else {
          //    tmp = get_slot_name(cmd_data[1])
          //    ast_stack.at(-1).body.body.push(types.IfStatement(types.Identifier(get_slot_name(cmd_data[1])), types.BlockStatement([])))
          //    //ast_stack.push(ast_stack.at(-1).body.body.at(-1).consequent.body)
          //
          //    ast_stack.push(
          //      types.FunctionDeclaration(
          //        types.Identifier('TemporaryIfStatementNode'),
          //        [],
          //        types.BlockStatement(
          //          ast_stack.at(-1).body.body.at(-1).consequent.body
          //        )
          //      )
          //    )
          //    //console.log(ast_stack)
          //  }
          //  //ast_stack.at(-1).body.body.push(types.IfStatement(types.ExpressionStatement(), [], []))
          //  break;
          //case 5:
          //  ast_stack.pop()
          //  break;




          //case 54: //ifNot
          //  break;
          //case 56: //else
          //  break;
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
          //case 40: //operation
          //  break;
          //case 41: //StoreValue
          //  break;
          //case 49: //ModifyVar_
          //  break;
          //case 1: case 5: case 9: case 16: case 35: case 55: case 57: // Indentation End
          //  break;
          case 1: case 9: case 16:
            ast_stack.pop(); // Pop Temporary Node
            break;
          default: // Everything Else
            //console.log(ast_stack) 
            try {
              ast_stack.at(-1).push(types.CallExpression(types.Identifier(db_data.name), sanitizer(current_cmd, cmd_data), babelOptions))
            } catch(error) {
              debuglog(`Pushing To Last Function Body Failed, at ${current_cmd} with: ${error}`, 1)
            }

            //ast_stack.at(-1).body.body.push(types.CallExpression(types.Identifier(db_data.name), sanitizer(current_cmd, cmd_data), babelOptions));
        }


        //console.log(ast_stack[ast_stack.length-1])
      
    //console.log(ast_stack)

      }
      
    resolve(ast_root)
    }
      );

    //ast_root = { body: ast_stack };


  });
}

function parse_bbscript(filename, output_dir) {

  parse_bbscript_routine(filename).then(ast_root => {
    const output = path.resolve(output_dir, path.basename(filename, path.extname(filename)) + '.js')
		const astOutput = path.resolve(output_dir, path.basename(filename, path.extname(filename)) + '_AST.json')
    console.log(output)
		if (dumpTree == 1) {
			fs.writeFile(astOutput, JSON.stringify(ast_root, null, 2), { flag: 'w' } , err => {console.error(err)})
		}
    fs.writeFile(output, generate(ast_root, {  }).code, { flag: 'w' }, err => {console.error(err)})
  });
}


if (!([2, 3].includes(args.length)) || path.extname(args[1]) != ".bin") {
  console.log("Usage:node BBCF_Script_Parser.js scr_xx.bin outdir [options]")
  console.log("Default output directory if left blank is the input files directory.")
	console.log("options:\n")
	console.log("-D | --dumptree\n-d | --debug [level]\n-s | --streamsize {size[unit]}")
	console.log("streamsize unit can be kb, mb, or gb, if not specified it will assume the number is bytes")
  process.exit(1)
}
if (args.length == 2) {
  parse_bbscript(args[1], path.dirname(args[1]));
} else {
  parse_bbscript(args[1], args[2]);
}

console.log('complete')
