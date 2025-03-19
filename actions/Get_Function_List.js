const struct = require('python-struct');
const fs = require('node:fs');
const path = require('node:path');

const MODE = '<';
const GAME = 'BBCF';

let data = {};

const command_db = require('../util/fetchDBs.js')().commandDB


function readbin(bin) {
  return new Promise(async (resolve, reject) => {
    let file = fs.createReadStream(bin, { highWaterMark: 8000000 })
    let filename = path.basename(bin)
    let chardata = data[filename]
    chardata = {};
    let FUNCTION_COUNT;
    let state_array = [];
    let subroutine_array = [];
    
    file.on('readable', () => {

      if (!FUNCTION_COUNT) {
        FUNCTION_COUNT = struct.unpack(MODE + "I", file.read(4));
        file.read(0x24 * FUNCTION_COUNT);
      };

      while (true) {
        if (file.readableLength < 4) {break;};

        let current_cmd = struct.unpack(MODE + "I", file.read(4));
        let db_data = command_db[current_cmd.toString()];
        let cmd_data = [];


        if (db_data.format === undefined) {
          cmd_data = [file.read(db_data.size - 4)];
        } else {
          cmd_data = struct.unpack(MODE + db_data.format, file.read(struct.sizeOf(db_data.format)));
        };

        if (current_cmd == 0) {
          if (file.readableLength < struct.sizeOf(db_data.format) || file.readableLength < db_data.size - 4) { break; };
          state_array.push(cmd_data[0]);
        } else if (current_cmd == 8) {
          if (file.readableLength < struct.sizeOf(db_data.format) || file.readableLength < db_data.size - 4) { break; };
          subroutine_array.push(cmd_data[0]);
        }
      }
			file.close()
			chardata.statecount = state_array.length
			chardata.subroutinecount = subroutine_array.length
			chardata.subroutines = subroutine_array
			chardata.states = state_array
			resolve(chardata)
    });

  });
};

async function List(args) {
  
  if (!args[2] || !(fs.existsSync(args[1]))) {
    args[2] = path.dirname(args[1])
  }

  let realpath = path.resolve(args[1])

  let output = __dirname
	let data = {};
  if (fs.statSync(realpath).isDirectory()) {
    const files = fs.readdirSync(args[1]).filter(file => file.endsWith('.bin'));
    for (const file of files) {
      let bindata = await readbin(`${realpath}/${file}`);
			data[file] = Object.assign({}, data[file], bindata);
    };

		output = realpath;

  } else {
    let bindata = await readbin(args[1]);
    //console.log(bindata);
    data = Object.assign({}, data, bindata);
 
		output = path.dirname(realpath);
		
		//console.log(output)
	};

	//console.log(data);
  fs.writeFileSync(path.resolve(`${output}/FunctionList.json`), JSON.stringify(data, null, 2), { flag: 'w'}, err => {console.error(err)} );

  //console.log(args);
}

usageString = '<scr_xx.bin/Folder>'
optString = ''

module.exports = { List, usageString, optString }
