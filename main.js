const path = require('node:path')
const actions = {
  Parse: { path: './actions/BBCF_Script_Parser.js', handles: '.bin' },
  Rebuild: { path: './actions/BBCF_Script_Rebuilder.js', handles: '.js' },
  List: { path: './actions/Get_Function_List.js' }
}
const debugLog = require('./util/debugLog.js')

function printHelpMenu(action) {
  if (action) {
    const { usageString, optString } = require(actions[action].path)
    console.log('Usage: ' + path.basename(__filename) + ' ' + action + ' ' + usageString + '\n')
    console.log('Options:\n')
    console.log(optString)
  } else {
    console.log(`Usage: ${path.basename(__filename)} Action [options]` + '\n')
    console.log('Options:\n')
    console.log(require('./util/genOptString.js')(require('./util/processArgs.js')())) // Readability was never an option
    console.log('Actions:\n')
    console.log(Object.keys(actions).join('\n') + '\n')
  }

  process.exit()
}

debugLog('Processing CLI Arguments', 3)



const args = require('./util/processArgs.js')({}, true)
debugLog(JSON.stringify(args, null, 2), 4)

if (args._.length < 2) {
  if (typeof args.help.value == 'string') printHelpMenu(args.help.value)
  printHelpMenu();
}
//console.log(args.help.value)
if (args.help.value) {
  if (typeof args.help.value == 'string' && actions[args.help.value] !== undefined) {
    printHelpMenu(args.help.value)
  } else {
    printHelpMenu()
  }
}

let action

if (args._[1] == 'help') printHelpMenu(args._[2])

if (actions[args._[1]] !== undefined) {
  action = args._[1]
  args._ = args._.slice(1)
} else {
  for (entry of Object.keys(actions)) {
    if (args._[1].endsWith(actions[entry].handles)) {
      action = entry;
      break;
    }
  }
}


debugLog('CLI Arguments Processed Succesfully')

if (actions[action] === undefined) printHelpMenu();

debugLog('Attempting Action: "' + action + '" Using: ' + actions[action].path)

const actionModule = require(actions[action].path)
const actionFunction = actionModule[action]

const returnValue = actionFunction(args._);

if (returnValue == 'Invalid Args') {
  printHelpMenu(action)
}
