const {test} = require('node:test'), assert = require('node:assert/strict');
const {ShareLinks:S,ShareClient} = require('../src/share-links.js'), P = require('../src/project.js'), LZ = require('../vendor/lz-string.min.js');
const base = 'https://curtcox.github.io/pages/?example=hello#old';
for(const project of [P.starter(),P.starter('markdown'),P.starter('blank'),P.validate({files:[{name:'custom.md',text:'# Title'}]})]) test('share roundtrip: '+project.files.map(f=>f.name).join(','),()=>{
  for(const compress of [undefined,LZ.compressToEncodedURIComponent]) {
    const links = S.build({url:base,project,compress,view:true,run:false,page:'about.md'}), parsed = S.parse(links.long,LZ.decompressFromEncodedURIComponent);
    assert.deepEqual(parsed.project,project); assert.equal(parsed.view,true); assert.equal(parsed.run,false); assert.equal(parsed.page,'about.md'); assert.ok(!links.long.includes('example='));
  }
});
test('example, plain hash, invalid compression and page-only flags',()=>{
  assert.equal(S.parse(base).kind,'source'); assert.equal(S.parse('https://a/?example=hello&view&run=0').id,'hello');
  assert.equal(S.parse('https://a/#'+encodeURIComponent('# Hello')).project.entry,'index.md');
  assert.throws(()=>S.parse('https://a/?doc=invalid',()=>null),/decompressed/);
  assert.equal(S.parse('https://a/?view').view,true);
});
test('shortening accepts only is.gd HTTPS and returns the complete source link on failure',async()=>{
  const links = {long:'https://a/?doc=abc',fallback:'https://a/?doc=abc'};
  let client = new ShareClient({fetchLink:async()=>({ok:true,json:async()=>({contents:'https://is.gd/abc'})})}); assert.equal((await client.shorten(links)).url,'https://is.gd/abc');
  client = new ShareClient({fetchLink:async()=>({ok:true,json:async()=>({contents:'javascript:alert(1)'})})}); const result = await client.shorten(links); assert.equal(result.shortened,false); assert.equal(result.url,links.long);
  client = new ShareClient({timeout:5,fetchLink:()=>new Promise(()=>{})}); assert.equal((await client.shorten(links)).error.code,'timeout');
});
