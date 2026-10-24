const {test} = require('node:test'),assert = require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const assets=require('../offline-assets.js');
test('generated examples and gallery covers are current',()=>{for(const script of ['build-examples','render-gallery'])execFileSync(process.execPath,['scripts/'+script+'.mjs','--check']);});
test('offline inventory covers page references, vendored libraries, Ace modes and workers',()=>{
 for(const file of ['index.html','gallery.html']){const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)){const name=match[1];if(/^(src\/|vendor\/|ace\/|icons\/|icon\.|manifest\.)/.test(name))assert.ok(assets.assets.includes(name),name);}}
 for(const name of ['ace/ace.js','ace/theme-tomorrow.js',...['html','css','javascript','markdown','json','svg','text','xml'].map(m=>'ace/mode-'+m+'.js'),...['html','css','javascript','json','xml'].map(m=>'ace/worker-'+m+'.js')])assert.ok(assets.assets.includes(name),name);
});
