(() => {
'use strict';
const parser = typeof module !== 'undefined' ? require('../vendor/acorn.min.js') : globalThis.acorn;
function instrument(source, file = 'script.js') {
  let tree;
  try { tree = parser.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowReturnOutsideFunction: true }); }
  catch (_) { return source; } // Let the browser report the original syntax error.
  const edits = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (/^(ForStatement|ForInStatement|ForOfStatement|WhileStatement|DoWhileStatement)$/.test(node.type)) {
      const call = `globalThis.__pagesGuard(${JSON.stringify(file)},${node.loc.start.line});`;
      if (node.body.type === 'BlockStatement') edits.push([node.body.start + 1, call]);
      else { edits.push([node.body.start, '{' + call]); edits.push([node.body.end, '}']); }
    }
    for (const [key, value] of Object.entries(node)) if (key !== 'loc') {
      if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(tree);
  // Stable ordering preserves nested single-statement loops at identical offsets.
  return edits.sort((a,b) => b[0]-a[0]).reduce((text, [at, code]) => text.slice(0,at) + code + text.slice(at), source);
}
const LoopGuard = { instrument };
if (typeof module !== 'undefined') module.exports = LoopGuard; else globalThis.LoopGuard = LoopGuard;
})();
