'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor() { this.children = []; this.dataset = {}; this.style = {}; this.attrs = {}; this.value = ''; this.classList = { toggle() {} }; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  setAttribute(key, value) { this.attrs[key] = value; }
  focus() {}
  click() { this.onclick?.(); }
  remove() {}
}
const nodes = new Map();
const document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); }, createElement() { return new Element(); }, addEventListener() {}, body: new Element() };
const context = vm.createContext({ document, window: { addEventListener() {} }, localStorage: { getItem() { return null; }, setItem() {} }, console, Blob, URL, setTimeout });
vm.runInContext(fs.readFileSync('main.js', 'utf8'), context);
const evaluate = code => vm.runInContext(code, context);
evaluate('year = 2024; render()');
let cells = nodes.get('graph').children.filter(cell => cell.dataset.date);
assert.equal(cells.length, 366);
assert.equal(cells[0].dataset.date, '2024-01-01');
assert.equal(cells.at(-1).dataset.date, '2024-12-31');
assert.equal(nodes.get('graph').children.indexOf(cells[0]), 1);
const leapDay = cells.find(cell => cell.dataset.date === '2024-02-29');
nodes.get('graph').onpointerdown({ target: leapDay, button: 0, preventDefault() {} });
evaluate('finish()');
assert.equal(evaluate('values()["2024-02-29"]'), 4);
assert.equal(nodes.get('commits-count').textContent, '20');
nodes.get('graph').onpointerdown({ target: leapDay, button: 2, preventDefault() {} });
evaluate('finish()');
assert.equal(evaluate('values()["2024-02-29"]'), undefined);
nodes.get('undo').click();
assert.equal(evaluate('values()["2024-02-29"]'), 4);
evaluate('year = 2023; render()');
assert.equal(nodes.get('graph').children.filter(cell => cell.dataset.date).length, 365);
assert.equal(evaluate('entries().length'), 0);
evaluate('year = 2024; render()');
assert.equal(evaluate('entries().length'), 1);
evaluate('year = new Date().getUTCFullYear(); render()');
for (const cell of nodes.get('graph').children.filter(cell => cell.dataset.date)) {
  assert.equal(cell.disabled, cell.dataset.date > evaluate('today'));
}
const script = evaluate('generateScript("test-art", "test@example.com", [["2024-02-29", 5]])');
assert(script.includes("'committer ' + identity"));
assert(script.includes("'init', '-b', 'main'"));
assert(script.includes('if target.exists() and not args.resume:'));
assert(script.includes('if args.publish:'));
assert(script.includes("'fast-import'"));
// Parse the actual Python JSON literal independently to ensure exports preserve input.
const literal = script.match(/CONFIG = json.loads\((.*)\)/)[1];
assert.deepEqual(JSON.parse(JSON.parse(literal)), { repo: 'test-art', email: 'test@example.com', plan: [['2024-02-29', 5]] });
fs.mkdirSync('.test-output', { recursive: true });
fs.writeFileSync('.test-output/contribution-art.py', script);
console.log('Calendar, paint, erase, undo, year isolation, future dates, and script export passed.');
