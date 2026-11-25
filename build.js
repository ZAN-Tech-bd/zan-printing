// Concatenates src/* into a single self-contained index.html (no dependencies).
// Usage: node build.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'src');
const files = fs.readdirSync(dir).filter(f => /^(0[1-9]|1[0-9])-.*\.js$/.test(f)).sort();
const js = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8') + '\n').join('');
try { new Function(js); } catch (e) { console.error('SYNTAX ERROR:', e.message); process.exit(1); }
const out = fs.readFileSync(path.join(dir, '00-head.html'), 'utf8') + js + fs.readFileSync(path.join(dir, '99-tail.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'index.html'), out);
console.log('Built index.html (' + Math.round(out.length / 1024) + ' KB) from ' + files.length + ' modules');
