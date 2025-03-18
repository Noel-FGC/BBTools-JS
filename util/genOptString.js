function genOptString(argObj) {
  let string = '';
  for (opt in argObj) {
    if (opt === '_') continue;
    //console.log(argObj[opt].short)
    if (argObj[opt].short) {
      string += ('-' + argObj[opt].short)
      if (argObj[opt].long) string += ', '; // just incase it doesnt have a long field for whatever reason 
    };
    string += ('--' + argObj[opt].long);
    
    if (argObj[opt].usage) {
      string += (' ' + argObj[opt].usage)
    } else if (argObj[opt].type !== 'boolean') {
      string += (' <' + argObj[opt].type + '>')
    }
    if (argObj[opt].description) {
      string += ('\n    ' + argObj[opt].description + '\n')
    }

    string += '\n';
  }
  return string;
}

module.exports = genOptString;
