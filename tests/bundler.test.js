const {test} = require('node:test'), assert = require('node:assert/strict');
const {DOMParser} = require('linkedom'), P = require('../src/project.js'), B = require('../src/bundler.js'), M = require('../src/markdown.js');
function bundle(files,page='index.html',options={}) { return B.build(P.validate({files:Object.entries(files).map(([name,text])=>({name,text}))}),page,{DOMParser,...options}); }
function parse(result) { return new DOMParser().parseFromString(result.html,'text/html'); }
test('styles, imports, SVG assets, cyclic CSS and external URLs',()=>{
  const result = bundle({'index.html':'<link rel="stylesheet" href="css/main.css"><img src="art.svg"><script src="app.js"></script><img src="https://example.com/x.png">','css/main.css':'@import "more.css";body{background:url(../art.svg)}','css/more.css':'@import "main.css";p{color:red}','art.svg':'<svg xmlns="http://www.w3.org/2000/svg"/>','app.js':'console.log(1);'});
  const doc = parse(result); assert.equal(doc.querySelectorAll('link').length,0); assert.match(doc.querySelector('style').textContent,/Cyclic/); assert.match(doc.querySelector('style').textContent,/data:image\/svg\+xml/);
  assert.match(doc.querySelector('img').getAttribute('src'),/^data:/); assert.equal(doc.querySelectorAll('img')[1].getAttribute('src'),'https://example.com/x.png');
  assert.match(decodeURIComponent(doc.querySelector('body script').getAttribute('src')),/# sourceURL=app.js/); assert.match(doc.head.firstElementChild.textContent,/function boot/);
});
test('classic inline script offsets and source names survive bundling',()=>{
  const result = bundle({'index.html':'<html>\n<head>\n<script>\nconsole.log("hi");\n</script>\n</head></html>'});
  assert.deepEqual(result.offsets,[{file:'index.html',lineOffset:2}]); assert.match(decodeURIComponent(parse(result).querySelector('script[src]').getAttribute('src')),/sourceURL=index.html/);
});
test('module maps rewrite nested imports, re-exports and dynamic literal imports',()=>{
  const doc = parse(bundle({'index.html':'<script type="module" src="main.js"></script>','main.js':"import {value} from './lib/value.js'; import('./lib/value.js'); console.log(value);",'lib/value.js':"export {value} from './second.js';",'lib/second.js':'export const value=42;'}));
  const imports = JSON.parse(doc.querySelector('[type=importmap]').textContent).imports;
  assert.equal(Object.keys(imports).length,3); const source = decodeURIComponent(imports['https://pages-project.invalid/main.js'].split(',').slice(1).join(','));
  assert.match(source,/https:\/\/pages-project.invalid\/lib\/value.js/); assert.match(source,/sourceURL=main.js/);
});
test('Markdown supports GFM, duplicate heading ids, raw HTML and front matter styles',()=>{
  const doc = parse(bundle({'index.md':'---\ntitle: My title\ncss:\n - styles/one.css\n---\n# Hello\n\n# Hello\n\n- [x] done\n\n~~old~~\n\n|a|b|\n|-|-|\n|1|2|\n\n<b>raw</b>','styles/one.css':'body{color:blue}'},'index.md'));
  assert.equal(doc.title,'My title'); assert.equal(doc.querySelector('h1').id,'hello'); assert.equal(doc.querySelectorAll('h1')[1].id,'hello-1'); assert.ok(doc.querySelector('table')); assert.ok(doc.querySelector('input[checked]')); assert.ok(doc.querySelector('del')); assert.ok(doc.querySelector('b')); assert.match(doc.querySelector('style').textContent,/blue/);
  assert.equal(M.frontMatter('ordinary').source,'ordinary');
});
test('downloads omit runtime and guards while preserving user scripts and project links',()=>{
  const result = bundle({'index.html':'<a href="about.md">About</a><script src="script.js"></script>','script.js':'for(let n=0;n<3;n++) console.log(n);','about.md':'# About'},'index.html',{runtime:false,guard:false});
  assert.doesNotMatch(result.html,/__pagesGuard|function boot/); assert.match(result.html,/href="about.md"/); assert.match(decodeURIComponent(parse(result).querySelector('script[src]').getAttribute('src')),/console.log\(n\)/);
});
