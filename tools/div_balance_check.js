const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node div_balance_check.js <file>'); process.exit(2); }
const txt = fs.readFileSync(path,'utf8').split('\n');
let stack = [];
const openings = [];
for (let i=0;i<txt.length;i++){
  const line = txt[i];
  let idx = 0;
  while (true) {
    const o = line.indexOf('<div', idx);
    const c = line.indexOf('</div>', idx);
    if (o === -1 && c === -1) break;
    if (o !== -1 && (c === -1 || o < c)) {
      openings.push({line: i+1, col: o+1, text: line.trim()});
      stack.push({line: i+1, col: o+1});
      idx = o+4;
    } else if (c !== -1) {
      if (stack.length === 0) {
        console.log('Extra closing </div> at', i+1, c+1, 'line:', line.trim());
      } else {
        stack.pop();
      }
      idx = c+6;
    }
  }
}
if (stack.length === 0) {
  console.log('All <div> tags balanced.');
} else {
  console.log('Unclosed <div> tags count:', stack.length);
  stack.forEach(s => console.log('Unclosed opening at line', s.line, 'col', s.col));
}
