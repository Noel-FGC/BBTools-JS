const fs = require('node:fs');
const path = require('node:path');

const debugLevelObj = require('./processArgs.js')({}, true).debugLevel
const debugLevel = debugLevelObj.value;
if (debugLevelObj.called = true) {
	if (process.pkg == undefined) { // run as a script
		logFile = path.resolve(__dirname, '../BBToolsJS.log')
	} else { // packaged by nexe
		logFile = path.resolve(__dirname, 'BBToolsJS.log')	
	}

  if (fs.existsSync(logFile)) {
    if (fs.existsSync(logFile + '.bak')) {
      fs.unlink(logFile + '.bak', (e) => { if (e) console.error(e) })
    }
    fs.rename(logFile, logFile + '.bak', (e) => { if (e) console.error(e) })
  }
}

function debugLog(log, level = 3, forceDisplay = false) {
  if (debugLevel >= level || forceDisplay) {
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
    if (logFile !== undefined) {
      fs.appendFileSync(logFile, `${Date.now()} [${debugString}] ${log}` + '\n', (err) => {
        if (err) {
          console.error(err)
        }
      })
    }
    if (level === 0) process.exit();
  }
}


module.exports = debugLog;
