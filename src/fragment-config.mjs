import * as kit from '../vendor/fragment-kit-v0.3.3/src/index.js';
import * as ProjectModule from './project.js';
import appConfig from '../fragment-kit.config.json' with {type:'json'};
const Project=ProjectModule.default??globalThis.Project;
export const config=kit.createConfig(appConfig);
export const type={type:'pages',settingsKeys:[],fileName:'project.json',contentType:'application/json',normalize(value){
 const pages=Project.validate(value.pages??(Array.isArray(value.files)?value:Project.single(value.src)));
 return {src:pages.files.find(file=>file.name===pages.entry).text,pages};
},isDefault:doc=>{let value;try{value=JSON.parse(doc.src);}catch{}return value?.format!=='hashbin-diagram'&&JSON.stringify(doc.pages)===JSON.stringify(Project.single(doc.src));},
 // Non-envelope JSON has always been literal page source in this consumer.
 parseLegacy:text=>type.normalize({pages:Project.single(text)})};
export const fromDocument=value=>type.normalize(value).pages;
export const serializeLegacy=value=>{const doc=type.normalize(value);return kit.bounded(JSON.stringify({format:'hashbin-diagram',version:1,type:'pages',src:doc.src,pages:doc.pages}),config.maxBytes);};
const legacyWriter=(doc,{url,run,view,compress})=>{
 const key=type.isDefault(doc)?'compressed':'doc';url.searchParams.set(key,compress(type.isDefault(doc)?doc.src:serializeLegacy(doc)));
 // Existing Pages readers already accept the plain envelope fragment. Use it
 // for large projects so source does not exceed HTTP request-line limits.
 if(url.href.length>7000){url.searchParams.delete(key);url.hash=encodeURIComponent(serializeLegacy(doc));}
 if(run===false)url.searchParams.set('run','0');if(view)url.searchParams.set('view','');return url.href;
};
const core=kit.createUrlState({config,type,legacyWriter,legacyReaders:[(url,{documents,decompress})=>!url.hash&&!url.searchParams.has('doc')&&url.searchParams.has('compressed')?documents.parse(decompress(url.searchParams.get('compressed'))):null]});
// Page selection is app-owned presentation state, outside the saved project.
function options(value,opts={}){const pages=fromDocument(value),url=new URL(opts.url??globalThis.location?.href??config.canonicalOrigin),page=opts.page??url.searchParams.get('page');if(page&&page!==pages.entry&&pages.files.some(file=>file.name===page&&Project.PAGE.test(page)))url.searchParams.set('page',page);else url.searchParams.delete('page');return {...opts,url:url.href,view:opts.view===true?'page':opts.view||undefined};}
export const urlState={...core,parse(href){const intent=core.parse(href),url=new URL(href);return {...intent,view:url.searchParams.has('view'),page:url.searchParams.get('page')};},build:(value,opts)=>core.build(value,options(value,opts)),write:(value,opts)=>core.write(value,options(value,opts))};
export const HashBinDocuments={...core.documents,MAX_BYTES:config.maxBytes,serialize:serializeLegacy,parse:payload=>fromDocument(core.documents.parse(payload)),link:urlState.link,...Object.fromEntries(['bytes','encode64','decode64','isCID','cidLength','verify'].map(key=>[key,kit[key]])),cid:value=>kit.cid(value,config.allowedHosts)};
export const SDK_URL=new URL('../vendor/fragment-kit-v0.3.3/vendor/hashbin-sdk-v0.4.0.mjs',import.meta.url).href;
export const SDK_INTEGRITY='sha384-zzmaXw5svWRp0YF//G5ytyeqEowixccM/hHVDth46FnGrIlPS7fPki5vbhv+bWCr';
// Pages' existing SRI-script contract stays in force, including rejection tests.
export function loadPublishSDK(){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.type='module';script.src=SDK_URL;script.integrity=SDK_INTEGRITY;script.crossOrigin='anonymous';script.onload=()=>{script.remove();resolve(globalThis.hashbin);};script.onerror=()=>{script.remove();reject(Error('The verified HashBin SDK could not load. Check your connection and try again.'));};document.head.append(script);});}
export function publishTransactions(storage,clientId=config.hashbinClientId){if(!storage)return undefined;const current=kit.createStorage({prefix:config.storagePrefix,storage}),owned=key=>key.startsWith('hashbin:publish:'+clientId+':');return {getItem(key){const value=current.getItem(key);if(value!=null||!owned(key))return value;try{return storage.getItem(key);}catch{return null;}},setItem:(key,value)=>current.setItem(key,value),removeItem(key){current.removeItem(key);if(owned(key))try{storage.removeItem(key);}catch{}}};}
function sharing(value){if(!value||typeof value!=='object')return undefined;return {view:value.view===true,run:value.run!==false,...(Project.validName(value.page)&&Project.PAGE.test(value.page)?{page:value.page}:{})};}
export class HashBinStore extends kit.HashBinStore{
 constructor(options={}){
  let storage;try{storage=globalThis.sessionStorage;}catch{}
  const state={pending:undefined,returned:new Map()},load=options.loadSDK??loadPublishSDK;
  super({config,type,transactionStorage:publishTransactions(storage,options.clientId??config.hashbinClientId),...options,loadSDK:async()=>{const sdk=await load();return {...sdk,HashBinClient:class extends sdk.HashBinClient{
   publish(payload,opts){const share=state.pending;return super.publish(payload,{...opts,clientState:{...opts.clientState,...(share?{share}:{})}});}
   async handlePublishCallback(opts){try{const result=await super.handlePublishCallback(opts);state.returned.set(opts.hash,sharing(result.clientState?.share));return result;}catch(error){state.returned.set(opts.hash,sharing(error.clientState?.share));throw error;}}
  }};}});
  this.shareState=state;this.shareOptions=options.shareOptions;this.documents={...this.documents,serialize:serializeLegacy};
 }
 load=async value=>fromDocument(await super.load(value));
 publish(payload,snapshot,share=this.shareOptions?.()){this.shareState.pending=sharing(share);return super.publish(payload,snapshot);}
 async published(hash){try{
  const result=await super.published(hash),share=this.shareState.returned.get(hash);
  // Pages keeps the current project after any failed CID verification, even if
  // an SDK return contains a recoverable-looking snapshot.
  if(result?.error&&/CID|does not match saved content/.test(result.error))return {...result,snapshot:null};
  return result?.snapshot&&share?{...result,share}:result;
 }finally{this.shareState.returned.delete(hash);}}
}
export const ShareLinks={build:({url,project,run=true,view=false,page,cid})=>{
 if(!cid)return urlState.build(project,{url,run,view,page});
 const link=core.scrub(options(project,{url,page}).url);if(run===false)link.searchParams.set('run','0');if(view)link.searchParams.set('view','');const href=core.link(link.href,cid);return {href,long:href,fallback:href,plain:href,qrCandidate:href};
},parse:href=>{const intent=urlState.parse(href);return {...intent,kind:intent.kind==='none'?'empty':intent.kind,...(intent.doc?{project:fromDocument(intent.doc)}:{})};}};
export const LZString={compressToEncodedURIComponent:kit.compress,decompressFromEncodedURIComponent:kit.decompress};
export {ShareClient} from '../vendor/fragment-kit-v0.3.3/src/index.js';
