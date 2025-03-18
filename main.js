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
    console.log('\nOptions:\n')
    console.log(optString)
  } else {
    console.log(`
Usage: ${path.basename(__filename)} Action [options]

Options:
--help [Action]   Display this menu, or the help menu for the provided action.
-d, --debug       Change the logging level, and create a logfile.

Actions:`)
  console.log(Object.keys(actions).join('\n') + '\n')
  }

  process.exit()
}

debugLog('Processing CLI Arguments', 3)
const args = require('./util/processArgs.js')({}, true)
debugLog(JSON.stringify(args, null, 2), 4)
if (args.help.value) { 
  if (typeof args.help.value == 'string' && actions[args.help.value] !== undefined) {
    printHelpMenu(args.help.value)
  } else {
    printHelpMenu()
  }
}

let action
let passArgs

if (actions[args._[1]] !== undefined) {
  action = args._[1]
  passArgs = args._.slice(1)
} else {
  for (entry in Object.keys(actions)) {
    if (args._[1].endsWith(actions[entry].handles)) {
      action = entry;
    }
  }
}

debugLog('CLI Arguments Processed Succesfully')

if (actions[action] === undefined) printHelpMenu();

debugLog('Attempting Action: "' + action + '" Using: ' + actions[action])

const actionModule = require(actions[action].path)
const actionFunction = actionModule[action]

const returnValue = actionFunction(args._.slice(1));

if (returnValue == 'Invalid Args') {
  printHelpMenu(action)
}
