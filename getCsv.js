var debug=true
const path=require('path')
var local_text="";
  var fs = require("fs");

if(debug)
{

}
      
module.exports.getCsv=function doit(pin)
{
  var fn=path.resolve(__dirname,pin.toUpperCase()+'.csv');
  // get the data content separated by the empty line between
  local_text = fs.readFileSync(fn)+ '';

	return local_text;
}
