// might add lookup creation to this at some point

const fs = require('node:fs');
const path = require('node:path');
const debugLog = require('./debugLog.js')

const game = "BBCF"

let dbObject = {};

const dbs = [
  { name: 'commandDB', path: 'command_db.json'},
  { name: 'moveInputs', path: 'named_values/move_inputs.json'},
  { name: 'normalInputs', path: 'named_values/normal_inputs.json'},
  { name: 'uponDB', path: 'upon_db/global.json'},
  { name: 'slotDB', path: 'slot_db/global.json'},
  { name: 'objectDB', path: 'object_db/global.json'}
]


function fetchDBs(char) {
  if (char) debugLog('Fetching DB\'s for character ' + char);
  else debugLog('Fetching global DB\'s', 3);



  for (dbIndex in dbs) {
    try {
      db = dbs[dbIndex]
      if (fs.exists(path.join(__dirname, game, db.path), (e) => { if (e) debugLog(e, 1)})) { 
        debugLog('Loading ' + db.name + ' From ' + path.join(__dirname, game, db.path), 4)
        dbObject[db.name] = require(path.join(__dirname, game, db.path))
      }
      else { 
        debugLog('Loading Internal ' + db.name + ' From ' + path.join('../assets/static_db', game, db.path), 4)
        dbObject[db.name] = require(path.join('../assets/static_db', game, db.path))
      }
    } catch (e) {
      debugLog('Loading ' + db.name + ' failed with error: ' + e, 1)
    }
    debugLog(db.name + ': ' + JSON.stringify(dbObject[db]), 5)
 
    try {
      if (char) {
        let dbPath = db.path.replace('global', char)
        if (fs.exists(path.join(__dirname, game, dbPath), (e) => { if (e) debugLog(e, 1)})) {
          debugLog('Loading Character ' + db.name + ' From ' + path.join(__dirname, game, dbPath), 4)
          let charDB = require(path.join(__dirname, game, dbPath))

          debugLog('Applying Character ' + db.name + ' to Main Object', 4)
          dbObject[db.name] = Object.assign({}, dbObject[db.name], charDB)
        } else {
          debugLog('Loading Internal Character ' + db.name + ' From ' + path.join('../assets/static_db', game, dbPath), 4)
          let charDB = require(path.join('../assets/static_db', game, dbPath))

          debugLog('Applying Character ' + db.name + ' to Main Object', 4)
          dbObject[db.name] = Object.assign({}, dbObject[db.name], charDB)
        }
      }
    } catch (e) {
      debugLog('Loading Character ' + db.name + ' Failed With: ' + e, 2)
    }

  }

  debugLog('DB\'s Finished Loading')
  return dbObject;
}

module.exports = fetchDBs
