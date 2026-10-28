const {test} = require('node:test'), assert = require('node:assert/strict');
const {HashBinStore,HashBinDocuments:D} = require('../src/hashbin.js'),P = require('../src/project.js');
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}
function cid(text){const size=Buffer.alloc(6);size.writeUIntBE(Buffer.byteLength(text),0,6);return size.toString('base64url')+(Buffer.byteLength(text)<=64?Buffer.from(text):require('node:crypto').createHash('sha512').update(text).digest()).toString('base64url')}
test('HashBin envelope preserves project and entry src; plain text CIDs load',async()=>{
  const p=P.starter();const payload=D.serialize(p);assert.equal(JSON.parse(payload).src,p.files[0].text);assert.deepEqual(D.parse(payload),p);
  assert.deepEqual(await new HashBinStore().load(cid('# Hello')),P.single('# Hello')); assert.ok(!D.isCID('ordinarysource'));
  assert.throws(()=>D.parse(JSON.stringify({format:'hashbin-diagram',version:2,type:'pages'})),/version/);
  assert.throws(()=>D.serialize(P.single('x'.repeat(3*1024*1024))),/5 MiB/);
});
test('OAuth preserves the complete project, restores once and rejects expired transactions',async()=>{
 const transactionStorage=storage(),snapshot=P.starter();
 class SDK{async authorize(){return {state:'state',url:'https://hashbin.org/authorize'}}async handleCallback(){this.done=true}}
 const store=new HashBinStore({clientId:'test',transactionStorage,loadSDK:async()=>({HashBinClient:SDK})});
 assert.equal(await store.connect(snapshot),'https://hashbin.org/authorize');assert.deepEqual((await store.callback('?code=test&state=state')).snapshot,snapshot);
 assert.match((await store.callback('?code=test&state=state')).error,/could not be restored/);
 transactionStorage.setItem('pagesonline:hashbin:return:old',JSON.stringify({snapshot,createdAt:0}));assert.match((await store.callback('?code=test&state=old')).error,/could not be restored/);
 await assert.rejects(new HashBinStore().connected(),/registered client ID/);
});
test('quotes account retention, refreshes credentials and saves the quoted document',async()=>{
 const payload=D.serialize(P.starter()),savedCid=cid(payload);let refreshed=0;const requests=[];
 class SDK{getTokens(){return {refreshToken:'mock',expiresAt:0}}async refreshAccessToken(){refreshed++}async authorizedFetch(path,options){requests.push([path,options]);return {ok:true,status:200,json:async()=>path.endsWith('/settings')?{default_retention_months:3}:path.endsWith('/balance')?{balance_cents:200}:{cid:savedCid}}}}
 const store=new HashBinStore({clientId:'test',loadSDK:async()=>({HashBinClient:SDK}),fetchSource:async(_url,options)=>{assert.equal(JSON.parse(options.body).retention_months,3);return {ok:true,json:async()=>({cost_cents:2})}}});
 assert.deepEqual(await store.quote(payload),{months:3,cost:2,balance:200,size:Buffer.byteLength(payload)});assert.equal((await store.save(payload)).cid,savedCid);assert.ok(refreshed>=3);assert.ok(requests.at(-1)[1].body instanceof FormData);
});
test('network loads reject oversized CIDs, invalid UTF-8, missing content, and timeouts',async()=>{
 const remote=cid('x'.repeat(200));await assert.rejects(new HashBinStore({fetchSource:async()=>({ok:false,status:404})}).load(remote),/not found/);
 await assert.rejects(new HashBinStore({timeout:5,fetchSource:()=>new Promise(()=>{})}).load(remote),/timed out/);
 const size=Buffer.alloc(6);size.writeUIntBE(2,0,6);await assert.rejects(new HashBinStore().load(size.toString('base64url')+Buffer.from([0xc3,0x28]).toString('base64url')),/encoded data/);
 size.writeUIntBE(6*1024*1024,0,6);await assert.rejects(new HashBinStore().load(size.toString('base64url')+Buffer.alloc(64).toString('base64url')),/5 MiB/);
});
test('network loads and saves verify bytes against the CID',async()=>{
 const payload=D.serialize(P.single('# Verified remote')),remote=cid(payload),served=body=>new HashBinStore({fetchSource:async()=>({ok:true,status:200,arrayBuffer:async()=>new TextEncoder().encode(body).buffer})});
 assert.deepEqual(await served(payload).load(remote),P.single('# Verified remote'));
 await assert.rejects(served(payload.replace('Verified','Replaced')).load(remote),/does not match its CID/);
 await assert.rejects(served(payload+' ').load(remote),/does not match its CID/);
 class SDK{getTokens(){return {refreshToken:'mock',expiresAt:Date.now()+60000}}async authorizedFetch(){return {ok:true,status:200,json:async()=>({cid:cid(payload+' ')})}}}
 await assert.rejects(new HashBinStore({clientId:'test',loadSDK:async()=>({HashBinClient:SDK})}).save(payload),/does not match its CID/);
});
