const {test} = require('node:test'),assert = require('node:assert/strict'),fs = require('node:fs'),os = require('node:os'),path = require('node:path'),{execFileSync} = require('node:child_process');
const {crc32,zip} = require('../src/zip.js');
test('CRC-32 known vectors',()=>{assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);assert.equal(crc32(new Uint8Array()),0);});
test('ZIP paths, Unicode names, empty files and checksums pass an independent archive reader',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pages-zip-')),target=path.join(dir,'test.zip');
 try{fs.writeFileSync(target,zip([{name:'index.html',text:'<h1>Hello</h1>'},{name:'nested/café.txt',text:'你好'},{name:'empty.txt',text:''}]));assert.match(execFileSync('python3',['-m','zipfile','-t',target],{encoding:'utf8'}),/Done testing/);const result=execFileSync('python3',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.read("nested/café.txt").decode())',target],{encoding:'utf8'});assert.equal(result.trim(),'你好');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
