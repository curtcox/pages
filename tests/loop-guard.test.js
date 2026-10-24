const {test} = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const {instrument} = require('../src/loop-guard.js');
test('guards all loop forms including unbraced nested loops without adding lines',()=>{
  const source = 'for(let i=0;i<2;i++) console.log(i);\nwhile(false){}\ndo x++; while(false);\nfor(const x of [1]){}\nfor(const key in {}){}\nfor(;;) for(;;) break;';
  const result = instrument(source,'demo.js'); assert.equal((result.match(/__pagesGuard/g)||[]).length,7); assert.equal(result.split('\n').length,source.split('\n').length);
  new vm.Script(result); assert.match(result,/demo.js",2/);
});
test('syntax errors pass through and strings/comments are untouched',()=>{
  assert.equal(instrument('while ('),'while ('); assert.equal(instrument('// while(true)\nconst s="for(;;)";'),'// while(true)\nconst s="for(;;)";');
});
test('an infinite loop reaches the runtime guard; finite loops keep their semantics',()=>{
  let calls = 0;
  assert.throws(()=>vm.runInNewContext(instrument('while(true){}'),{__pagesGuard:()=>{if(++calls>1000)throw Error('budget');}},{timeout:2000}),/budget/);
  const context = {__pagesGuard:()=>{},result:0};vm.runInNewContext(instrument('for(let i=0;i<5;i++) result+=i;'),context);assert.equal(context.result,10);
});
