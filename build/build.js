// Build script to find all require statements and replace them with import statements
// Also replaces module.exports with export default

const fs = require("fs");
const path = require("path");

let commonJSPath = path.join(__dirname, "..", "index.js");
let modulePath = path.join(__dirname, "..", "index.mjs");

// let commonJS = fs.readFileSync(commonJSPath).toString();
let mJS = fs.readFileSync(modulePath).toString();

let regex = /import [\{\sa-zA-Z\}]+ from (\"|\')[\_\-a-zA-Z0-9]+(\"|\');/g;

let matches = mJS.match(regex);

matches.forEach((match) => {
    let req = match.substring(match.indexOf("from") + 6, match.length - 2);
    let constant = match.substring(match.indexOf("import ") + 7, match.indexOf(" from"));
    let replacement = `const ${constant} = require(\"${req}\");`;
    mJS = mJS.replace(match, replacement);
});

mJS = mJS.replace("export default", "module.exports =");

fs.writeFileSync(commonJSPath, mJS);