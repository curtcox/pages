/* Run BROWSER=chromium|firefox|webkit npm run test:browser. No test services required. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium, firefox, webkit } = require('playwright');
const P = require('../../src/project.js'), D = require('../../src/hashbin.js').HashBinDocuments, {catalog} = require('../../src/examples.js');
const root = path.resolve(__dirname,'../..'), engine = process.env.BROWSER || 'chromium';
function cid(text){const size=Buffer.alloc(6);size.writeUIntBE(Buffer.byteLength(text),0,6);return size.toString('base64url')+(Buffer.byteLength(text)<=64?Buffer.from(text):require('node:crypto').createHash('sha512').update(text).digest()).toString('base64url')}
async function startServer({index=null}={}){const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname);const file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));if(!file.startsWith(root+path.sep))throw Error('path');const raw=await fs.readFile(file),body=index&&file===path.join(root,'index.html')?index(raw.toString()):raw;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain');res.end(body);}catch(_){res.statusCode=404;res.end('Not found');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,url:'http://127.0.0.1:'+server.address().port+'/'};}
async function until(work,label,timeout=8000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{if(await work())return;}catch(e){last=e;}await new Promise(r=>setTimeout(r,60));}throw Error(label+(last?' — '+last.message:''));}
(async()=>{
 await fs.mkdir(path.join(root,'test-results'),{recursive:true});
 const hosted=await startServer(),base=process.env.BASE_URL||hosted.url;let browser,page,current='startup',passed=0;
 async function step(name,work){current=name;await work();passed++;console.log('✓ '+engine+' · '+name);}
 try{
  browser=await ({chromium,firefox,webkit})[engine].launch();const context=await browser.newContext({viewport:{width:1280,height:850},acceptDownloads:true,serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(8000);
  await context.route('https://hashbin.org/sdk/v0.4.0/hashbin.js',route=>route.abort());
  const frame=()=>page.frameLocator('#preview').frameLocator('#preview-content'),logs=()=>page.locator('#console-list').textContent();
  // Links that would replace unsaved work ask first; tests accept unless they say otherwise.
  const open=async(query='',answer=true)=>{const reply=d=>answer?d.accept():d.dismiss();page.on('dialog',reply);try{await page.goto(base+query);await page.waitForFunction(()=>window.pagesApp&&document.querySelector('#file-tabs button'));}finally{page.off('dialog',reply);}};
  const fixture=async(files)=>{await page.evaluate(files=>pagesApp.setProject({files:Object.entries(files).map(([name,text])=>({name,text}))}),files);};
  await step('default project renders; CSS and JS edits auto-refresh',async()=>{
   await open();assert.equal(await frame().locator('h1').textContent(),'Hello, world.');
   await page.getByRole('tab',{name:'style.css',exact:true}).click();await page.evaluate(()=>pagesApp.editor.setValue('body { background: rgb(12, 34, 56); }',-1));
   await until(async()=>await frame().locator('body').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(12, 34, 56)','CSS refresh');
   await page.getByRole('tab',{name:'script.js',exact:true}).click();await page.evaluate(()=>pagesApp.editor.setValue("document.querySelector('h1').textContent='Edited JS';",-1));
   await until(async()=>await frame().locator('h1').textContent()==='Edited JS','JS refresh');
  });
  await step('manual Run, keyboard shortcut, file rename and last-page protection',async()=>{
   await page.locator('#auto-refresh').uncheck();await page.evaluate(()=>pagesApp.editor.setValue("document.querySelector('h1').textContent='Manual run';",-1));
   await page.waitForTimeout(700);assert.equal(await frame().locator('h1').textContent(),'Edited JS');await page.locator('#run').click();await until(async()=>await frame().locator('h1').textContent()==='Manual run','manual render');
   await page.evaluate(()=>pagesApp.editor.setValue("document.querySelector('h1').textContent='Shortcut';",-1));await page.keyboard.press(process.platform==='darwin'?'Meta+Enter':'Control+Enter');await until(async()=>await frame().locator('h1').textContent()==='Shortcut','keyboard render');
   await page.locator('#auto-refresh').check();await page.getByRole('tab',{name:'script.js',exact:true}).dblclick();await page.locator('#file-name').fill('app.js');await page.locator('#rename-file').click();assert.ok((await page.evaluate(()=>pagesApp.getProject())).files.some(f=>f.name==='app.js'));
   await fixture({'index.md':'# Only page'});await page.locator('#file-menu').click();page.once('dialog',d=>d.accept());await page.locator('#delete-file').click();assert.match(await page.locator('#notice').textContent(),/at least one/);await page.locator('#file-dialog button[aria-label=Close]').click();
  });
  await step('editor CSP blocks injected scripts while previews retain scripts, handlers and eval',async()=>{
   await page.evaluate(()=>{
    globalThis.editorViolations=[];
    addEventListener('securitypolicyviolation',e=>editorViolations.push(e.effectiveDirective));
    const script=document.createElement('script');script.textContent='globalThis.injectedEditorScript=true';document.head.append(script);
    const button=document.createElement('button');button.setAttribute('onclick','globalThis.injectedEditorHandler=true');document.body.append(button);button.click();button.remove();
   });
   await until(async()=>await page.evaluate(()=>editorViolations.length>=2),'editor CSP violations');
   assert.deepEqual(await page.evaluate(()=>[globalThis.injectedEditorScript,globalThis.injectedEditorHandler]),[undefined,undefined]);
   await context.route('https://preview-library.example/library.js',route=>route.fulfill({body:'globalThis.libraryValue=40;',contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}}));
   await fixture({'index.html':`<script src="https://preview-library.example/library.js"></script><h1>Scripts</h1><button onclick="this.textContent=eval('libraryValue + 2')">Evaluate</button><script>console.log('preview eval',eval('1+2'));</script>`});
   await frame().getByRole('button',{name:'Evaluate',exact:true}).click();assert.equal(await frame().locator('button').textContent(),'42');assert.match(await logs(),/preview eval 3/);
  });
  await step('Markdown navigation, heading anchors and Back',async()=>{
   await fixture({'index.md':'# Home\n\n[About](about.md#details)','about.md':'# About\n\n## Details\n\nThe other page.'});await frame().getByRole('link',{name:'About'}).click();await until(async()=>await frame().locator('h1').textContent()==='About','Markdown navigate');assert.equal(await page.locator('#preview-path').textContent(),'about.md');await page.locator('#back').click();await until(async()=>await frame().locator('h1').textContent()==='Home','preview Back');
  });
  await step('virtual fetch, XHR, SVG CSS and local module imports',async()=>{
   await fixture({'index.html':'<link rel="stylesheet" href="style.css"><h1>Data</h1><script src="script.js"></script>','style.css':'body{background-image:url(art.svg)}','art.svg':'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>','data.json':'{"answer":42}','script.js':"fetch('data.json').then(r=>r.json()).then(x=>console.log('fetch',x.answer));const xhr=new XMLHttpRequest();xhr.open('GET','data.json');xhr.responseType='json';xhr.onload=()=>console.log('xhr',xhr.response.answer);xhr.send();"});
   await until(async()=>/fetch 42/.test(await logs())&&/xhr 42/.test(await logs()),'virtual data');assert.match(await frame().locator('body').evaluate(e=>getComputedStyle(e).backgroundImage),/data:image/);
   await open('?example=modules');await until(async()=>/Small pieces/.test(await frame().locator('#message').textContent()),'ES module import');assert.doesNotMatch(await logs(),/error/i);
  });
  await step('script order, shared lexical scope, deferred scripts and module cycles',async()=>{
   await fixture({'index.html':'<script>let shared = 40;</script><script src="deferred.js" defer></script><h1>Order</h1><script>shared += 2;</script>','deferred.js':"document.querySelector('h1').textContent = 'Shared '+shared;"});
   await until(async()=>await frame().locator('h1').textContent()==='Shared 42','script ordering');
   await fixture({'index.html':'<h1>Cycles</h1><script type="module" src="main.js"></script>','main.js':"import { ready } from './other.js'; export function greet(){return 'hello';} console.log('cycle '+ready());",'other.js':"import { greet } from './main.js'; export const ready=()=>greet();"});
   await until(async()=>/cycle hello/.test(await logs()),'module cycle');assert.equal((await logs()).match(/cycle hello/g).length,1);
  });
  await step('storage shim and opaque origin isolate the editor and sibling apps',async()=>{
   await page.evaluate(()=>{localStorage.setItem('pagesonline:test-secret','must stay private');sessionStorage.setItem('pagesonline:test-secret','private session');});
   await fixture({'index.html':`<h1>Isolated</h1><script>
    for(const [name,read] of Object.entries({parentDOM:()=>parent.document.body,editorStorage:()=>parent.localStorage.getItem('pagesonline:test-secret'),editorSession:()=>parent.sessionStorage.getItem('pagesonline:test-secret'),parentNavigation:()=>parent.location.href='https://example.invalid/escaped',topNavigation:()=>top.location.href='https://example.invalid/escaped'})){try{read();console.log(name,'FAIL');}catch(e){console.log(name,'blocked');}}
    localStorage.setItem('inside','yes');sessionStorage.setItem('inside','session');document.cookie='secret=oops';console.log('shim',localStorage.getItem('inside'),sessionStorage.getItem('inside'),document.cookie,'origin',self.origin);
    Promise.resolve().then(()=>caches.open('forbidden')).then(()=>console.error('cache FAIL'),()=>console.log('cache blocked'));
   </script>`});
   await until(async()=>/cache blocked/.test(await logs()),'storage isolation');const output=await logs();for(const text of ['parentDOM blocked','editorStorage blocked','editorSession blocked','parentNavigation blocked','topNavigation blocked','shim yes session  origin null'])assert.ok(output.includes(text),text+': '+output);
   assert.ok(page.url().startsWith(base));assert.equal(await page.evaluate(()=>localStorage.getItem('pagesonline:test-secret')),'must stay private');assert.equal(await page.frameLocator('#preview').locator('#preview-content').getAttribute('sandbox'),'allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads');
  });
  await step('console objects, repeat counts, safe text, file/line jump, eval and spoof rejection',async()=>{
   await fixture({'index.html':'<h1>Console</h1><script src="script.js"></script>','script.js':"console.log('<img src=x onerror=alert(1)>');\nconsole.warn({answer:42});\nconsole.log('repeat');console.log('repeat');\nthrow Error('broken');"});
   await until(async()=>/broken/.test(await logs()),'console errors');assert.equal(await page.locator('#console-list img').count(),0);assert.ok(await page.locator('#console-list details').count());assert.match(await logs(),/×2/);
   await page.locator('.console-location').last().click();assert.equal((await page.evaluate(()=>pagesApp.getProject())).active,'script.js');assert.equal(await page.evaluate(()=>pagesApp.editor.getCursorPosition().row),3);
   await page.locator('#console-expression').fill('1 + 2');await page.locator('#console-form button').click();await until(async()=>/3/.test(await logs()),'console eval');
   await page.evaluate(()=>window.postMessage({channel:'pages-online',type:'console',token:pagesApp.preview.token,level:'error',args:['FORGED']},'*'));await page.waitForTimeout(100);assert.doesNotMatch(await logs(),/FORGED/);await page.locator('#console-clear').click();assert.equal(await page.locator('#console-count').textContent(),'0');assert.equal(await page.locator('#mobile-console-count').textContent(),'0');
  });
  await step('infinite loops stop near one second and keep the editor responsive',async()=>{
   const start=Date.now();await fixture({'index.html':'<h1>Loop test</h1><script src="script.js"></script>','script.js':'\nwhile(true) {}'});await until(async()=>/Loop stopped after 1 s on script.js line 2/.test(await logs()),'loop protection',6000);assert.ok(Date.now()-start<5000);assert.ok(await page.locator('#run').isEnabled());
  });
  await step('Share editor/page-only links roundtrip and ?run=0 postpones execution',async()=>{
   await fixture({'index.md':'# A shareable page','about.md':'# About'});await page.locator('#share').click();const editorLink=await page.locator('#share-url').inputValue();await page.locator('#share-mode').selectOption('view');const viewLink=await page.locator('#share-url').inputValue();await page.locator('#share-no-run').check();const paused=await page.locator('#share-url').inputValue();await page.locator('#share-close').click();
   const shared=await context.newPage();await shared.goto(editorLink);await shared.waitForFunction(()=>window.pagesApp);await until(async()=>await shared.frameLocator('#preview').frameLocator('#preview-content').locator('h1').textContent()==='A shareable page','shared page rendered');
   await shared.goto(viewLink);assert.ok(await shared.locator('#view-strip').isVisible());assert.equal(await shared.locator('.ace_editor').count(),0);await until(async()=>await shared.frameLocator('#preview').frameLocator('#preview-content').locator('h1').textContent()==='A shareable page','shared page rendered');assert.ok(!(await shared.locator('#edit-link').getAttribute('href')).includes('view'));
   await shared.goto(paused);await shared.waitForFunction(()=>window.pagesApp);assert.equal(await shared.locator('#preview').getAttribute('src'),null);await shared.locator('#view-run').click();await until(async()=>await shared.frameLocator('#preview').frameLocator('#preview-content').locator('h1').textContent()==='A shareable page','shared page rendered');await shared.close();
  });
  await step('is.gd shortening and QR SVG/PNG downloads',async()=>{
   await context.route('https://api.allorigins.win/**',route=>route.fulfill({json:{contents:'https://is.gd/fixture'}}));await page.locator('#share').click();await page.locator('#share-shorten').click();await until(async()=>await page.locator('#share-url').inputValue()==='https://is.gd/fixture','short link');await page.locator('#share-close').click();
   await page.locator('#qr').click();assert.equal(await page.locator('#qr-code svg').count(),1);assert.match(await page.locator('#qr-warning').textContent(),/this computer/);
   for(const [button,name] of [['#qr-svg','pages-qr.svg'],['#qr-png','pages-qr.png']]){const [download]=await Promise.all([page.waitForEvent('download'),page.locator(button).click()]);assert.equal(download.suggestedFilename(),name);assert.ok((await fs.stat(await download.path())).size>100);}
   await page.locator('#qr-close').click();
  });
  await step('HTML works standalone, ZIP preserves paths, local import adds files',async()=>{
   await fixture({'index.html':'<link rel="stylesheet" href="style.css"><h1>Standalone</h1><script src="script.js"></script>','style.css':'h1{color:rgb(10,20,30)}','script.js':"document.querySelector('h1').textContent += ' works';",'nested/data.json':'{"a":1}'});
   await page.locator('#more summary').click();const [html]=await Promise.all([page.waitForEvent('download'),page.locator('#download').selectOption('html')]);const source=await fs.readFile(await html.path(),'utf8');assert.doesNotMatch(source,/__pagesGuard|function boot/);
   const standaloneFile=path.join(root,'test-results',engine+'-standalone.html');await fs.copyFile(await html.path(),standaloneFile);const standalone=await context.newPage();await standalone.goto('file://'+standaloneFile);assert.equal(await standalone.locator('h1').textContent(),'Standalone works');assert.equal(await standalone.locator('h1').evaluate(e=>getComputedStyle(e).color),'rgb(10, 20, 30)');await standalone.close();
   const [zip]=await Promise.all([page.waitForEvent('download'),page.locator('#download').selectOption('zip')]);const archive=await fs.readFile(await zip.path());assert.ok(archive.includes(Buffer.from('nested/data.json')));
   await page.locator('#file-input').setInputFiles({name:'notes.md',mimeType:'text/markdown',buffer:Buffer.from('# Imported')});await until(async()=>await page.getByRole('tab',{name:'notes.md',exact:true}).count()===1,'local import');
  });
  await step('links never silently replace unsaved work; view links never overwrite it',async()=>{
   await fixture({'index.md':'# Unsaved work'});await page.evaluate(()=>dispatchEvent(new Event('beforeunload')));
   await open('?example=hello',false);assert.equal((await page.evaluate(()=>pagesApp.getProject())).files[0].text,'# Unsaved work');assert.doesNotMatch(page.url(),/example=hello/);
   await page.goto(base+'?example=hello&view');await page.waitForFunction(()=>window.pagesApp&&document.querySelector('#preview').getAttribute('src') && pagesApp.preview.pending === null);assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>pagesApp.getProject())),/Unsaved work/);assert.match(await page.evaluate(()=>localStorage.getItem('pagesonline:project')),/Unsaved work/);
   await open('?example=hello');assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>pagesApp.getProject())),/Unsaved work/);await open('?example=modules');assert.ok((await page.evaluate(()=>pagesApp.getProject())).files.some(f=>f.name.endsWith('.js')));
  });
  await step('HashBin placeholder, Publish popup/redirect saves, legacy token revocation, CID load and stale-load guard',async()=>{
   await page.evaluate(()=>{const configured=document.querySelector('meta[name="hashbin-client-id"]').content;if(!configured.startsWith('app_') || pagesApp.store.clientId!==configured)throw Error('Registered client ID was not configured.');pagesApp.store.clientId='';});
   await page.locator('#share').click();await until(async()=>/registered client ID/.test(await page.locator('#hashbin-message').textContent()),'client ID notice');await page.locator('#share-close').click();
   await context.route(base+'**',async route=>{const url=new URL(route.request().url());if(url.pathname===new URL(base).pathname || url.pathname.endsWith('/index.html'))await route.fulfill({body:(await fs.readFile(path.join(root,'index.html'),'utf8')).replace(/(<meta name="hashbin-client-id" content=")[^"]*(")/,'$1fixture-client$2'),contentType:'text/html'});else await route.continue();});
   const sdkURL='https://hashbin.org/sdk/v0.4.0/hashbin.js';await context.unroute(sdkURL);
   // First prove the production integrity pin rejects substituted SDK bytes.
   await context.route(sdkURL,route=>route.fulfill({body:'globalThis.unverifiedSDK=true;',contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}}));
   await open();await page.locator('#share').click();await until(async()=>/verified HashBin SDK could not load/.test(await page.locator('#hashbin-message').textContent()),'SRI rejection');assert.equal(await page.evaluate(()=>globalThis.unverifiedSDK),undefined);assert.ok(await page.locator('#hashbin-confirm').isDisabled());await page.locator('#share-close').click();
   await context.unroute(sdkURL);
   const sdkFixture=await fs.readFile(path.join(__dirname,'fixtures/hashbin-sdk.mjs'));
   const fixtureIntegrity='sha384-'+require('node:crypto').createHash('sha384').update(sdkFixture).digest('base64');
   // Only the test response uses the fixture's integrity; production keeps the release's published SRI.
   await context.route(base+'src/hashbin.js*',async route=>route.fulfill({body:(await fs.readFile(path.join(root,'src/hashbin.js'),'utf8')).replace(/sha384-[A-Za-z0-9+/=]+/,fixtureIntegrity),contentType:'text/javascript'}));
   await context.route(sdkURL,route=>route.fulfill({body:sdkFixture,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}}));
   const payload=D.serialize(P.single('# Saved from HashBin')),saved=cid(payload);
   // Tokens from the earlier OAuth flow are revoked server-side on the next load.
   await page.evaluate(()=>localStorage.setItem('hashbin:tokens:fixture-client','{"refreshToken":"old"}'));await open();await until(async()=>await page.evaluate(()=>localStorage.getItem('pagesonline:test:revoked')==='yes'&&!localStorage.getItem('hashbin:tokens:fixture-client')),'legacy tokens revoked');
   await page.evaluate(()=>pagesApp.setProject(Project.single('# Popup save')));await page.locator('#share').click();await until(async()=>await page.locator('#hashbin-confirm').isEnabled(),'publish ready');assert.match(await page.locator('#hashbin-message').textContent(),/approve the save on hashbin\.org/);assert.equal(await page.locator('#hashbin-disconnect').count(),0);
   assert.equal(await page.locator('#hashbin-dialog').count(),0);assert.ok(await page.locator('#share-dialog').isVisible());
   await page.locator('#share-mode').selectOption('view');await page.locator('#share-no-run').check();
   const popupCid=cid(D.serialize(await page.evaluate(()=>pagesApp.getProject())));await page.locator('#hashbin-confirm').click();await until(()=>Promise.resolve(page.url().includes('#'+popupCid)),'popup saved CID');assert.match(await page.locator('#hashbin-status').textContent(),/Saved/);
   const savedPageLink=new URL(await page.locator('#share-url').inputValue());assert.equal(savedPageLink.hash,'#'+popupCid);assert.ok(savedPageLink.searchParams.has('view'));assert.equal(savedPageLink.searchParams.get('run'),'0');assert.equal(await page.locator('#hashbin-message a').getAttribute('href'),savedPageLink.href);
   await context.route('https://256t.us/'+popupCid,route=>route.fulfill({body:D.serialize(P.single('# Popup save')),headers:{'Access-Control-Allow-Origin':'*'}}));
   const savedPage=await context.newPage();await savedPage.goto(savedPageLink.href);await savedPage.waitForFunction(()=>window.pagesApp);assert.ok(await savedPage.locator('#view-strip').isVisible());assert.equal(await savedPage.locator('#preview').getAttribute('src'),null);await savedPage.locator('#view-run').click();assert.equal(await savedPage.frameLocator('#preview').frameLocator('#preview-content').locator('h1').textContent(),'Popup save');await savedPage.close();
   await page.locator('#share-mode').selectOption('editor');await page.locator('#share-no-run').uncheck();const savedEditorLink=new URL(await page.locator('#share-url').inputValue());assert.equal(savedEditorLink.hash,'#'+popupCid);assert.ok(!savedEditorLink.searchParams.has('view'));assert.ok(!savedEditorLink.searchParams.has('run'));assert.equal(await page.locator('#hashbin-message a').getAttribute('href'),savedEditorLink.href);await page.locator('#share-close').click();
   await page.evaluate(()=>{pagesApp.setProject(Project.single('# Snapshot awaiting approval'));const publish=pagesApp.store.client.publish.bind(pagesApp.store.client);pagesApp.store.client.publish=(...args)=>new Promise(resolve=>{window.finishPublish=()=>resolve(publish(...args));});});
   await page.locator('#share').click();await until(async()=>await page.locator('#hashbin-confirm').isEnabled(),'publish ready');await page.locator('#hashbin-confirm').click();await page.evaluate(()=>{pagesApp.setProject(Project.single('# Edited during approval'));finishPublish();});await until(async()=>/Saved/.test(await page.locator('#hashbin-message').textContent()),'stale save finishes');assert.equal((await page.evaluate(()=>pagesApp.getProject())).files[0].text,'# Edited during approval');assert.ok(!D.isCID(new URL(page.url()).hash.slice(1)));await page.locator('#share-close').click();await open();
   await page.evaluate(()=>{localStorage.setItem('pagesonline:test:publish','cancel');pagesApp.setProject(Project.single('# Cancelled save'));});await page.locator('#share').click();await until(async()=>await page.locator('#hashbin-confirm').isEnabled(),'publish ready');await page.locator('#hashbin-confirm').click();await until(async()=>/cancelled on HashBin/.test(await page.locator('#hashbin-message').textContent()),'cancelled save');await page.locator('#share-close').click();
   await page.evaluate(()=>{localStorage.setItem('pagesonline:test:publish','redirect');pagesApp.setProject(Project.single('# Redirect save'));});const before=await page.evaluate(()=>pagesApp.getProject()),redirectCid=cid(D.serialize(before));
   await page.locator('#share').click();await until(async()=>await page.locator('#hashbin-confirm').isEnabled(),'publish ready');await page.locator('#share-mode').selectOption('view');await page.locator('#share-no-run').check();await Promise.all([page.waitForURL('**#hashbin_publish=*'),page.locator('#hashbin-confirm').click()]);
   await page.waitForFunction(()=>window.pagesApp);await until(async()=>page.url().endsWith('#'+redirectCid)&&/Saved/.test(await page.locator('#hashbin-status').textContent()),'redirect return');assert.deepEqual(await page.evaluate(()=>pagesApp.getProject()),before);assert.ok(await page.locator('#share-dialog').isVisible());assert.equal(await page.locator('#share-mode').inputValue(),'view');assert.ok(await page.locator('#share-no-run').isChecked());const redirectLink=new URL(await page.locator('#share-url').inputValue());assert.equal(redirectLink.hash,'#'+redirectCid);assert.ok(redirectLink.searchParams.has('view'));assert.equal(redirectLink.searchParams.get('run'),'0');await page.locator('#share-close').click();await page.evaluate(()=>localStorage.removeItem('pagesonline:test:publish'));
   await page.evaluate(()=>{localStorage.setItem('pagesonline:test:publish','redirect-cancel');pagesApp.setProject(Project.single('# Cancelled redirect keeps this project'));});const cancelledProject=await page.evaluate(()=>pagesApp.getProject());
   await page.locator('#share').click();await until(async()=>await page.locator('#hashbin-confirm').isEnabled(),'cancelled redirect ready');await Promise.all([page.waitForURL('**#hashbin_publish=*'),page.locator('#hashbin-confirm').click()]);await page.waitForFunction(()=>window.pagesApp);await until(async()=>/cancelled on HashBin/.test(await page.locator('#notice').textContent()),'cancelled redirect return');assert.deepEqual(await page.evaluate(()=>pagesApp.getProject()),cancelledProject);assert.doesNotMatch(page.url(),/hashbin_publish/);await page.locator('#share-close').click();
   await page.evaluate(()=>{localStorage.setItem('pagesonline:test:publish','redirect');sessionStorage.setItem('pagesonline:test:delay-callback','yes');pagesApp.setProject(Project.single('# Delayed redirect'));});
   await page.locator('#share').click();await until(async()=>await page.locator('#hashbin-confirm').isEnabled(),'delayed redirect ready');await Promise.all([page.waitForURL('**#hashbin_publish=*'),page.locator('#hashbin-confirm').click()]);await page.waitForFunction(()=>window.finishPublishCallback);await page.evaluate(()=>{pagesApp.setProject(Project.single('# Newer edit during callback'));finishPublishCallback();});await until(async()=>/newer edits were kept/.test(await page.locator('#notice').textContent()),'stale redirect return');assert.equal((await page.evaluate(()=>pagesApp.getProject())).files[0].text,'# Newer edit during callback');assert.ok(!D.isCID(new URL(page.url()).hash.slice(1)));await page.evaluate(()=>localStorage.removeItem('pagesonline:test:publish'));
   await context.route('https://256t.us/**',async route=>{await new Promise(r=>setTimeout(r,350));await route.fulfill({body:payload,headers:{'Access-Control-Allow-Origin':'*'}});});
   await page.locator('#more').evaluate(e=>e.open=true);await page.locator('#hashbin-cid').fill(saved);await page.locator('#hashbin-load').click();await page.evaluate(()=>pagesApp.setProject(Project.single('# Newer edit')));await page.waitForTimeout(600);assert.equal((await page.evaluate(()=>pagesApp.getProject())).files[0].text,'# Newer edit');
   await page.locator('#hashbin-load').click();await until(async()=>(await page.evaluate(()=>pagesApp.getProject())).files[0].text==='# Saved from HashBin'&&/Loaded/.test(await page.locator('#hashbin-status').textContent()),'verified CID load');
   await context.unroute('https://256t.us/**');await context.route('https://256t.us/**',route=>route.fulfill({body:payload.replace('Saved from','Forged by'),headers:{'Access-Control-Allow-Origin':'*'}}));
   await page.evaluate(()=>pagesApp.setProject(Project.single('# Kept edit')));await page.locator('#more').evaluate(e=>e.open=true);await page.locator('#hashbin-load').click();await until(async()=>/does not match its CID/.test(await page.locator('#hashbin-status').textContent()),'forged CID rejected');assert.equal((await page.evaluate(()=>pagesApp.getProject())).files[0].text,'# Kept edit');
   await open('#'+cid('# Tiny CID'),false);assert.equal((await page.evaluate(()=>pagesApp.getProject())).files[0].text,'# Kept edit');
   await open('#'+cid('# Tiny CID'));await until(async()=>await frame().locator('h1').textContent()==='Tiny CID','inline CID');
  });
  await step('crash-safe startup disables automatic execution',async()=>{
   await until(async()=>await page.evaluate(()=>localStorage.getItem('pagesonline:rendering')===null),'settled render');await page.evaluate(()=>localStorage.setItem('pagesonline:rendering','1'));await page.reload();await page.waitForFunction(()=>window.pagesApp);assert.ok(!(await page.locator('#auto-refresh').isChecked()));assert.equal(await page.locator('#preview').getAttribute('src'),null);assert.match(await page.locator('#notice').textContent(),/last preview/);await page.locator('#run').click();await until(async()=>await frame().locator('h1').textContent()==='Tiny CID','manual recovery rendered');
  });
  await step('all gallery projects open in editor and page-only with no script errors',async()=>{
   await open();await page.evaluate(()=>localStorage.removeItem('pagesonline:rendering'));const accept=d=>d.accept();page.on('dialog',accept);
   for(const sample of catalog){for(const view of [false,true]){await page.goto(base+'?example='+sample.id+(view?'&view':''));await page.waitForFunction(()=>document.querySelector('#preview').getAttribute('src') && pagesApp.preview.pending === null);await frame().locator('body').waitFor();await page.waitForTimeout(100);const errors=await page.locator('#console-list .error').allTextContents();assert.deepEqual(errors,[],sample.id+' errors');}}
   await page.goto(base+'gallery.html');assert.equal(await page.locator('.gallery-card').count(),19);await page.locator('#search').fill('postcards');assert.equal(await page.locator('.gallery-card').count(),1);await page.locator('#search').fill('');await page.getByRole('button',{name:'Markdown',exact:true}).click();assert.equal(await page.locator('.gallery-card').count(),4);page.off('dialog',accept);
  });
  await step('mobile Preview/Code/Console, More, scrolling file tabs and touch targets',async()=>{
   await page.setViewportSize({width:375,height:812});await open('?example=hello');assert.ok(await page.locator('#preview-stage').isVisible());assert.ok(!(await page.locator('#code-pane').isVisible()));await page.getByRole('button',{name:'Code',exact:true}).click();assert.ok(await page.locator('#code-pane').isVisible());await page.getByRole('button',{name:'Console 0',exact:true}).click();assert.ok(await page.locator('#console-expression').isVisible());await page.getByRole('button',{name:'Preview',exact:true}).click();
   await page.locator('#more summary').click();assert.ok(await page.locator('#share-mobile').isVisible());await page.locator('#share-mobile').click();assert.ok(await page.locator('#hashbin-confirm').isVisible());await page.locator('#share-mode').selectOption('view');assert.ok(new URL(await page.locator('#share-url').inputValue()).searchParams.has('view'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,'test-results',engine+'-share-mobile.png')});await page.locator('#share-close').click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));for(const selector of ['#run','#more summary','.mobile-tabs button']){for(const rect of await page.locator(selector).evaluateAll(items=>items.map(e=>e.getBoundingClientRect().height)))assert.ok(rect>=40,selector+': '+rect);}
   await page.getByRole('button',{name:'Code',exact:true}).click();await page.evaluate(()=>pagesApp.setProject({files:[{name:'index.md',text:'# Many files'},...Array.from({length:10},(_,i)=>({name:'long-file-name-'+i+'.md',text:'# '+i}))]}));assert.ok(await page.locator('#file-tabs').evaluate(e=>e.scrollWidth>e.clientWidth));assert.ok(await page.locator('#file-tabs button').evaluateAll(items=>items.every(e=>e.scrollWidth<=e.clientWidth))); await page.screenshot({path:path.join(root,'test-results',engine+'-mobile.png')});
  });
  await step('a separate preview origin preserves rendering and rejects forged relay messages',async()=>{
   const previewServer=await startServer(),previewOrigin=new URL(previewServer.url).origin;
   // Real responses preserve the browser's network-origin checks for both local origins.
   const editorServer=await startServer({index:html=>html.replace('content="./preview.html"','content="'+previewServer.url+'preview.html"').replace("frame-src 'self'", "frame-src 'self' "+previewOrigin)});
   const isolated=await browser.newContext({serviceWorkers:'block'});
   try {
    const tab=await isolated.newPage();await tab.goto(editorServer.url);await tab.waitForFunction(()=>window.pagesApp);
    await tab.evaluate(()=>{localStorage.setItem('preview-secret','editor only');pagesApp.setProject(Project.single('<h1>Separate origin</h1><script>console.log("separate eval",eval("6*7"));</script>'));});
    const user=tab.frameLocator('#preview').frameLocator('#preview-content');
    assert.equal(await user.locator('h1').textContent(),'Separate origin');
    assert.equal(new URL(await tab.locator('#preview').getAttribute('src')).origin,previewOrigin);
    assert.equal(await user.locator('h1').evaluate(()=>{try{return top.localStorage.getItem('preview-secret');}catch(_){return 'blocked';}}),'blocked');
    assert.equal(await user.locator('h1').evaluate(()=>{try{return parent.document.title;}catch(_){return 'blocked';}}),'blocked');
    const token=await tab.evaluate(()=>pagesApp.preview.token);
    await user.locator('h1').evaluate((_,token)=>{
     parent.postMessage({channel:'pages-online',token,type:'render',html:'<h1>FORGED</h1>'},'*');
     top.postMessage({channel:'pages-online',token,type:'console',level:'error',args:['FORGED']},'*');
     parent.postMessage({channel:'pages-online',token,type:'host-ready'},'*');
    },token);
    await tab.locator('#console-expression').fill('21 * 2');await tab.locator('#console-form button').click();
    await until(async()=>/42/.test(await tab.locator('#console-list').textContent()),'cross-origin console relay');
    assert.doesNotMatch(await tab.locator('#console-list').textContent(),/FORGED/);assert.equal(await user.locator('h1').textContent(),'Separate origin');
    await tab.evaluate(()=>pagesApp.setProject(Project.single('# Fresh render')));assert.equal(await user.locator('h1').textContent(),'Fresh render');
   } finally {await isolated.close();await new Promise(r=>previewServer.server.close(r));await new Promise(r=>editorServer.server.close(r));}
  });
  await context.close();
  await step('offline reload without a server connection preserves editing and rendering',async()=>{
   const offline=await browser.newContext({serviceWorkers:'allow'});const tab=await offline.newPage();await tab.goto(base);await tab.waitForFunction(()=>document.querySelector('#offline-status').textContent==='Available offline',null,{timeout:25000});
   // A sibling app on the same origin can write this app's Cache Storage; altered or extra entries must never be served.
   await tab.evaluate(async()=>{const cache=await caches.open((await caches.keys()).find(n=>n.startsWith('pagesonline-')));const poison=body=>new Response(body,{headers:{'Content-Type':'text/javascript'}});await cache.put(new URL('src/console-view.js',location.href).href,poison('globalThis.poisonedCache=true;'));await cache.put(new URL('injected.html',location.href).href,new Response('<script>top.poisonedCache=true</script>',{headers:{'Content-Type':'text/html'}}));});
   await tab.reload();await tab.waitForFunction(()=>window.pagesApp);assert.equal(await tab.evaluate(()=>globalThis.poisonedCache),undefined);await tab.waitForFunction(()=>document.querySelector('#offline-status').textContent==='Offline setup incomplete');
   await tab.goto(base+'injected.html');assert.equal(await tab.evaluate(()=>globalThis.poisonedCache),undefined);await tab.goto(base);await tab.waitForFunction(()=>window.pagesApp);
   await tab.locator('#offline-action').click();await tab.waitForFunction(()=>document.querySelector('#offline-status').textContent==='Available offline',null,{timeout:25000});await offline.setOffline(true);await tab.reload();await tab.waitForFunction(()=>window.pagesApp);assert.equal(await tab.frameLocator('#preview').frameLocator('#preview-content').locator('h1').textContent(),'Hello, world.');await tab.evaluate(()=>pagesApp.setProject(Project.single('# Offline works')));await until(async()=>await tab.frameLocator('#preview').frameLocator('#preview-content').locator('h1').textContent()==='Offline works','offline edit rendered');await tab.goto(base+'gallery.html');assert.equal(await tab.locator('.gallery-card').count(),19);await offline.close();
  });
  console.log(`${passed} ${engine} browser checks passed.`);
 }catch(error){await fs.mkdir(path.join(root,'test-results'),{recursive:true});await page?.screenshot({path:path.join(root,'test-results',engine+'-failure.png'),fullPage:true}).catch(()=>{});console.error('FAIL '+engine+' · '+current+'\n'+error.stack);console.error('Console:',await page?.locator('#console-list').textContent().catch(()=>''));process.exitCode=1;}
 finally{await browser?.close();await new Promise(r=>hosted.server.close(r));}
})();
