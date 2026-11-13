import {test} from '@playwright/test';import{createRequire}from'node:module';import{createHash}from'node:crypto';
const manifest=createRequire(import.meta.url)('./offline-assets.js');test.setTimeout(120000);
export default {
 ready:'body[data-ready="true"]',editor:'#ace-editor',status:'#notice',draftKey:'pagesonline:project',more:'#more-toggle',share:'#share',qr:'#qr',tabs:['Code','Preview'],example:'hello',cachePrefix:manifest.version,offlineAsset:'src/app.css',kitURL:'./vendor/fragment-kit-v0.4.3/src/index.js',
 isWrittenURL:href=>{const url=new URL(href);return url.searchParams.has('doc')||url.searchParams.has('compressed')||url.hash.startsWith('#%7B');},getSource:page=>page.evaluate(()=>pagesApp.editor.getValue()),getDocument:page=>page.evaluate(()=>pagesApp.snapshot()),edit:(page,src)=>page.evaluate(src=>pagesApp.editor.setValue(src,-1),src),
 openMore:async page=>{if(!await page.locator('#fk-more-drawer').isVisible())await page.locator('#more-toggle').click();},
 configureHashBin:async(context,clientId)=>context.route('**/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/name="hashbin-client-id" content="[^"]*"/,`name="hashbin-client-id" content="${clientId}"`)});}),
 installHashBinMock:async(context,source)=>{const body=source+'\nglobalThis.hashbin={HashBinClient};',integrity='sha384-'+createHash('sha384').update(body).digest('base64');await context.route('**/src/fragment-config.mjs',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/sha384-[A-Za-z0-9+/=]+/,integrity)});});await context.route('**/vendor/hashbin-sdk-v0.4.0.mjs',route=>route.fulfill({body,contentType:'text/javascript'}));},
 build:(page,doc,canonical=false)=>page.evaluate(async({doc,canonical})=>{const{urlState,config}=await import('./src/fragment-config.mjs');return urlState.build(doc,canonical?{url:config.canonicalOrigin}:{}).href;},{doc,canonical})
};
