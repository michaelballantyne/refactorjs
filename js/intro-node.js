fs = require('fs');
parser = require('vendor/esprima/esprima.js')
fs.readFile(process.argv[2], 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    var origTree = parser.parse(data)
    var stringTree = JSON.stringify(origTree, null, 4);
    console.log(stringTree);
    var jsTree = JSON.parse(stringTree);
});
