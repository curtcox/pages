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
test('saves through HashBin Publish with the pinned SDK and restores redirect saves',async()=>{
 const payload=D.serialize(P.starter()),snapshot=P.starter(),savedCid=cid(payload);let options,loaded=0;
 class SDK{publish(content,opts){options=opts;assert.equal(content,payload);return Promise.resolve({cid:savedCid})}async handlePublishCallback({hash}){assert.match(hash,/hashbin_publish=s/);return {cid:savedCid,clientState:{snapshot}}}}
 const store=new HashBinStore({clientId:'test',loadSDK:async()=>{loaded++;return {HashBinClient:SDK}}});
 await assert.rejects(store.publish(payload,snapshot),/still loading/);
 await store.init();assert.equal((await store.publish(payload,snapshot)).cid,savedCid);assert.equal(options.contentType,'application/json');assert.deepEqual(options.clientState,{snapshot});
 assert.equal(await store.published('#doc'),null);assert.deepEqual(await store.published('#hashbin_publish=s&cid=x'),{cid:savedCid,snapshot});assert.equal(loaded,1);
 class Denied{publish(){return Promise.reject(new Error('access_denied'))}async handlePublishCallback(){throw new Error('access_denied')}}
 const pending=storage(),denied=new HashBinStore({clientId:'test',transactionStorage:pending,loadSDK:async()=>({HashBinClient:Denied})});await denied.init();
 await assert.rejects(denied.publish(payload,snapshot),/cancelled/);assert.equal(pending.getItem('hashbin:pending-publish:test'),null);
 // A redirect cancelled on HashBin restores the source the SDK no longer returns.
 pending.setItem('hashbin:pending-publish:test',JSON.stringify(snapshot));assert.deepEqual(await denied.published('#hashbin_publish=s&error=access_denied'),{error:'The save was cancelled on HashBin.',snapshot});assert.equal(pending.getItem('hashbin:pending-publish:test'),null);
 await assert.rejects(new HashBinStore().init(),/registered client ID/);
 assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/hashbin.js'),'utf8'),/hashbin\.org\/sdk\/v0\.2\.0\/hashbin\.js/);
});
test('revokes tokens left by the earlier OAuth flow, and only then loads the SDK',async()=>{
 const local=storage();let loaded=0,revoked=0;
 class SDK{async disconnect(){revoked++;local.removeItem('hashbin:tokens:test')}}
 const store=new HashBinStore({clientId:'test',storage:local,loadSDK:async()=>{loaded++;return {HashBinClient:SDK}}});
 assert.equal(await store.retireLegacyTokens(),false);assert.equal(loaded,0);
 local.setItem('hashbin:tokens:test','{"refreshToken":"old"}');assert.equal(await store.retireLegacyTokens(),true);assert.equal(revoked,1);assert.equal(local.getItem('hashbin:tokens:test'),null);
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
 class SDK{async publish(){return {cid:cid(payload+' ')}}}
 const store=new HashBinStore({clientId:'test',loadSDK:async()=>({HashBinClient:SDK})});await store.init();
 await assert.rejects(store.publish(payload,P.single('# Verified remote')),/does not match its CID/);
});
