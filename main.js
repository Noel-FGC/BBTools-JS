const path = require('node:path')
const actions = {
  Parse: './actions/BBCF_Script_Parser.js',
  Rebuild: './actions/BBCF_Script_Rebuilder.js',
  List: './actions/Get_Function_List.js'
}
const debugLog = require('./util/debugLog.js')

function printHelpMenu(action) {
  if (action) {
    const { usageString, optString } = require(actions[action])
    console.log('Usage: ' + path.basename(__filename) + ' ' + action + usageString)
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

let action = args._[1]

debugLog('CLI Arguments Processed Succesfully')

if (actions[action] === undefined) printHelpMenu();

debugLog('Attempting Action: "' + action + '" Using: ' + actions[action])

