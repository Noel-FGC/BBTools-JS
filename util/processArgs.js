const defaultOpts = {
  debugLevel: {
    long: 'debug',
    short: 'd',
    type: 'number',
    default: 1,
    boolDefault: 3,
    usage: '[Level]',
    description: 'Sets the debug level, and creates a log file, level can range from 1-5'
  },
  help: {
    long: 'help',
    default: false,
    usage: '[Action]',
    description: 'Displays A Help Menu'
  }
}

function processArgs(opts, noError = false) {
  opts = Object.assign(opts, defaultOpts);
  const argObj = require('minimist')(process.argv.slice(1))
  for (entry in argObj) {
    if (entry == '_') continue;
    if (entry.length > 1 && entry.toLowerCase() != entry) {
      argObj[entry.toLowerCase()] = argObj[entry]
      delete argObj[entry]
    }
    for (opt in opts) {
      if (opts[opt].long == entry.toLowerCase() || opts[opt].short == entry) {
        if (typeof argObj[entry] == 'boolean') {
          if (opts[opt].boolDefault !== undefined) {
            if (argObj[entry] == true) {
              argObj[entry] = opts[opt].boolDefault
            }
          }
          else if (opts[opt].type == 'number') {
            if (argObj[entry]) {
              argObj[entry] = 1;
            } else {
              argObj[entry] = 0;
            }
          }
        }
        if ((opts[opt].type !== undefined && typeof argObj[entry] != opts[opt].type) && !noError) throw new Error('Value for argument --' + opts[opt].long + ' (-' + opts[opt].short + ') was expected to be of type ' + opts[opt].type + ', instead received value of type ' + typeof argObj[entry])

        opts[opt].value = argObj[entry]
        break;
      } else if ( opt == Object.keys(opts).at(-1) ) {
        if (!noError){
          throw new Error('Unrecognized CLI Argument: ' + entry)
        }
      }
    }
  }
  for (opt in opts) {
    if (opts[opt].value === undefined) opts[opt].value = opts[opt].default;
    else opts[opt].called = true;
  }
  opts._ = argObj._
  return opts
}

module.exports = processArgs
