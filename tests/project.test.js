const {test} = require('node:test'), assert = require('node:assert/strict');
const P = require('../src/project.js');
test('project names are safe, case sensitive, unique, and text-only',()=>{
  for (const name of ['index.html','src/main.js','a_b-c.svg','README.md']) assert.ok(P.validName(name),name);
  for (const name of ['../a.js','/a.js','a//b.js','a/./b.js','a\\b.js','x.png','x y.md','https://x.js','']) assert.ok(!P.validName(name),name);
  const p = P.add(P.starter(),'INDEX.html'); assert.equal(p.files.length,4);
  assert.throws(()=>P.add(p,'index.html'),/unique/); assert.throws(()=>P.validate({files:[{name:'a.md',text:1}]}),/text/);
});
test('entry fallbacks, first-class Markdown, starters and last-page protection',()=>{
  assert.equal(P.starter('markdown').entry,'index.md'); assert.equal(P.starter('site').files.length,3);
  for (const kind of ['blank','markdown','site','default']) assert.ok(P.validate(P.starter(kind)));
  const p = P.validate({files:[{name:'z.md',text:''},{name:'README.md',text:''},{name:'second.html',text:''}]}); assert.equal(p.entry,'README.md');
  const renamed = P.rename(p,'README.md','readme.md'); assert.equal(renamed.entry,'readme.md');
  assert.equal(P.remove(renamed,'readme.md').entry,'second.html');
  assert.throws(()=>P.remove(P.starter(),'index.html'),/at least one/);
  assert.throws(()=>P.rename(p,'z.md','../bad.md'),/relative/);
});
test('size and file count limits apply to UTF-8 bytes',()=>{
  assert.throws(()=>P.validate({files:Array.from({length:51},(_,i)=>({name:i+'.md',text:''}))}),/1–50/);
  assert.throws(()=>P.single('é'.repeat(3*1024*1024)),/5 MiB/);
});
test('references resolve from nested pages without crossing the project root',()=>{
  assert.equal(P.resolve('docs/index.md','../images/a.svg#one'),'images/a.svg');
  assert.equal(P.resolve('docs/index.md','./about.md?x=1'),'docs/about.md');
  for (const ref of ['../../x.md','https://example.com','//cdn/a.js','#section','data:text/plain,hi','%xx.md']) assert.equal(P.resolve('index.md',ref),null);
});
