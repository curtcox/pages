import {LocalDrafts,RenderScheduler,HashBinPanel,compactShell,createShell,mountMobileTabs,createShareDialog,createQrDialog} from '../vendor/fragment-kit-v0.3.5/src/index.js';
import {config,type,urlState,HashBinDocuments,HashBinStore,ShareLinks,LZString,fromDocument} from './fragment-config.mjs';
Object.assign(globalThis,{HashBinDocuments,LZString});
(async () => {
'use strict';
const $ = id => document.getElementById(id);
const safeStore = name => { try { const value = window[name]; value.getItem('pagesonline:probe'); return value; } catch (_) { return null; } };
const local = safeStore('localStorage'), session = safeStore('sessionStorage');
const oldHeader=document.querySelector('#editor-shell>.toolbar'),brand=oldHeader.querySelector('.brand'),actions=oldHeader.querySelector('.toolbar-actions'),menu=oldHeader.querySelector('.more-menu');
const shell=createShell({config,container:$('editor-shell')});shell.header.querySelector('.fk-brand').replaceChildren(...brand.childNodes);shell.header.querySelector('.fk-brand').href=new URL('./',location.href).href;shell.status.remove();shell.toolbar.append(actions);shell.header.querySelector('.fk-more').id='more-toggle';
compactShell({header:shell.header,status:document.querySelector('#app-footer')});
$('more').remove();menu.id='more';shell.drawer.body.prepend(menu);oldHeader.remove();
for(const id of ['hashbin-load','hashbin-cid','hashbin-status','share-dialog','qr-dialog','share-mobile','qr-mobile'])$(id).remove();
menu.querySelector('.inline-controls').remove();menu.querySelector('label[for=hashbin-cid]').remove();
for(const a of menu.querySelectorAll('.docs-links a'))if(/gallery|guide|fork/i.test(a.textContent))a.remove();
$('share').classList.remove('desktop-action');$('qr').classList.remove('desktop-action');
const closeMore=()=>shell.drawer.dialog.close();let navigationRevision=0,qrSave=false,tabs,lastNavigation=location.href;

const key = 'pagesonline:project', renderingKey = 'pagesonline:rendering';
const drafts = new LocalDrafts({ storage: local, key, parse: text => Project.validate(JSON.parse(text)) });
const notice = message => { $('notice').textContent = message; $('notice').hidden = !message; if (view && message) $('view-strip').title = message; };
let project = Project.starter(), editor, fallback, changing = false, savedCID = null, savedFingerprint = null, annotations = new Map();
let initial; try { initial = ShareLinks.parse(location.href,LZString.decompressFromEncodedURIComponent); } catch (error) { initial = {kind:'invalid',run:false}; }
const view = new URLSearchParams(location.search).has('view');
let auto = initial.run !== false, crashed = false, pendingRender = false;
try { crashed = local?.getItem(renderingKey) === '1'; } catch (_) {}
if (crashed) { auto = false; notice('The last preview may have frozen the page. Fix the code, then press Run.'); }
const fingerprint = () => JSON.stringify({files:project.files,entry:project.entry,active:project.active});
const snapshot = () => Project.validate(project);
function persist(edit = false) { if (!view) drafts.attempt(snapshot(), edit === true); }
function shareLink(options = {}) {
  return ShareLinks.build({url:location.href,project:snapshot(),compress:LZString.compressToEncodedURIComponent,view:options.view ?? view,run:options.run ?? true,page:preview.page || project.entry,cid:savedFingerprint === fingerprint() ? savedCID : null});
}
function updateURL(){try{urlState.cancel();history.replaceState(null,'',urlState.build(snapshot(),{run:auto,view,page:preview.page||project.entry}).href);lastNavigation=location.href;}catch(error){notice(error.message);}}
function setAuto(value) { auto = value; $('auto-refresh').checked = value; $('auto-mobile').checked = value; if (!value) scheduler.cancel(); }
function setPanel(panel){if(tabs?.getView()!=='split')tabs?.select(['code','preview','console'].indexOf(panel));requestAnimationFrame(()=>editor?.resize());}
function changed() {
  if (changing) return;
  const text = editor ? editor.getValue() : fallback.value;
  const next = { ...project, files:project.files.map(f=>f.name === project.active ? {...f,text} : f) };
  try { project = Project.validate(next); } catch (error) { scheduler.cancel(); notice(error.message); return; }
  navigationRevision++;urlState.cancel();panel?.cancelLoad(); annotations.delete(project.active); applyAnnotations(); persist(true);
  try{lastNavigation=urlState.write(snapshot(),{run:auto,view,page:preview.page||project.entry});notice('');}catch(error){notice(error.message);}
  if (auto) scheduler.schedule({detect:false});
}
function applyAnnotations() { editor?.session.setAnnotations(annotations.get(project.active) || []); }
function selectFile(name,line) {
  if (!project.files.some(f=>f.name === name)) return;
  const previousActive=project.active;project.active = name; changing = true;
  const text = project.files.find(f=>f.name === name).text;
  if (editor) {
    const mode = ({html:'html',htm:'html',css:'css',js:'javascript',mjs:'javascript',md:'markdown',json:'json',svg:'svg',xml:'xml'})[name.split('.').pop().toLowerCase()] || 'text';
    // Keep independent undo/selection state for each file.
    let saved = sessions.get(name);
    if (!saved || saved.getValue() !== text) { saved = ace.createEditSession(text,'ace/mode/'+mode); saved.setTabSize(2); saved.setUseSoftTabs(true); saved.setUseWrapMode(true); sessions.set(name,saved); saved.on('change',changed); }
    editor.setSession(saved); applyAnnotations(); if (line) editor.gotoLine(line,0,true);
  } else if (fallback) fallback.value = text;
  changing = false;
  $('file-mode').textContent = name.split('.').pop(); renderTabs();
  if(previousActive!==name){navigationRevision++;panel?.cancelLoad();persist();try{lastNavigation=urlState.write(snapshot(),{run:auto,view,page:preview.page||project.entry});}catch(error){notice(error.message);}}
  if (line) { setPanel('code'); editor?.focus(); }
}
const sessions = new Map();
function renderTabs() {
  const buttons = [...$('file-tabs').children];
  if (buttons.length === project.files.length && buttons.every((button,index)=>button.textContent === project.files[index].name)) {
    buttons.forEach(button=>button.setAttribute('aria-selected',String(button.textContent === project.active))); return;
  }
  $('file-tabs').replaceChildren();
  for (const file of project.files) {
    const button = document.createElement('button'); button.textContent = file.name; button.setAttribute('role','tab'); button.setAttribute('aria-selected',String(file.name === project.active)); button.title = 'Double-click or long-press to rename';
    button.onclick = () => selectFile(file.name); button.ondblclick = () => { selectFile(file.name); fileDialog(); };
    let timer; button.addEventListener('pointerdown',event=>{ if (event.pointerType === 'touch') timer = setTimeout(()=>{ selectFile(file.name); fileDialog(); },600); });
    for (const event of ['pointerup','pointerleave','pointercancel','pointermove']) button.addEventListener(event,()=>clearTimeout(timer));
    $('file-tabs').append(button);
  }
}
function fileDialog() { $('file-name').value = project.active; $('entry-file').disabled = !Project.PAGE.test(project.active); $('file-dialog').showModal(); }
const consoleView = new ConsoleView({list:$('console-list'),badge:$('console-count'),onLocation:selectFile,onEval:expression=>preview.eval(expression)});
const preview = new Preview({iframe:$('preview'),getProject:()=>project,onConsole:entry=>{
  consoleView.add(entry); $('mobile-console-count').textContent = $('console-count').textContent;
  if (entry.level === 'error' && entry.file) { const list = annotations.get(entry.file) || []; list.push({row:entry.line-1,column:0,text:entry.args.map(String).join(' '),type:'error'}); annotations.set(entry.file,list.slice(-100)); applyAnnotations(); }
},onClear:()=>consoleView.clear(),onTitle:title=>{ if (view) document.title = title + ' · Pages Online'; $('preview-path').title = title; },onReady:()=>{ pendingRender = false; try { local?.removeItem(renderingKey); } catch (_) {} },onNavigate:(page,canBack)=>{ $('preview-path').textContent = page; $('back').disabled = !canBack; }});
function run() {
  if(crashed){crashed=false;notice('');}scheduler.cancel();
  if ($('console-clear-refresh').checked) { consoleView.clear(); $('mobile-console-count').textContent = '0'; }
  annotations.clear(); applyAnnotations();
  pendingRender = true;
  try { local?.setItem(renderingKey,'1'); } catch (_) {}
  try { preview.render(); $('view-run').hidden = true; }
  catch (error) { consoleView.add({level:'error',args:[error.message]}); notice(error.message); try { local?.removeItem(renderingKey); } catch (_) {} }
}
const scheduler = new RenderScheduler({detect:()=>{},render:run,renderDelay:500});
function setProject(value,{cid=null,render=auto,reset=true,update=true,localEdit=true,cancelLoad=true}={}) {
  if(localEdit)navigationRevision++;urlState.cancel();value=fromDocument(value);
  if (!localEdit) drafts.opened();
  project = Project.validate(value);if(cancelLoad)panel?.cancelLoad();scheduler.cancel();
  sessions.clear(); annotations.clear(); if (reset) preview.reset();
  if (cid) { savedCID = cid; savedFingerprint = fingerprint(); } else { savedCID = null; savedFingerprint = null; }
  if (editor || fallback) selectFile(project.active); else renderTabs();
  persist(localEdit); if (update) updateURL(); if (render) run();
}
function shareOptions(){return {view:shareMode.value==='view',run:$('share-run').checked,page:preview.page||project.entry};}
const store=new HashBinStore({legacyStorage:local,shareOptions});
const panelURLs={...urlState,link:(input,cid)=>ShareLinks.build({url:input,project:snapshot(),cid,...shareOptions()}).href};
const panel=new HashBinPanel({store,urlState:panelURLs,container:menu,getSnapshot:snapshot,getFingerprint:fingerprint,
 onLoad(value,cid){setProject(value,{cid,render:false,localEdit:false,cancelLoad:false});const page=new URL(location.href).searchParams.get('page');if(project.files.some(file=>file.name===page&&Project.PAGE.test(page)))preview.page=page;updateURL();if(cid)history.replaceState(null,'',urlState.link(location.href,cid));closeMore();if(auto)run();else $('view-run').hidden=!view;},
 onSaved(cid,fp,link){urlState.cancel();savedCID=cid;savedFingerprint=fp;history.replaceState(null,'',urlState.link(location.href,cid));if(qrSave){qrSave=false;panel.dialog.close();qr.open(link);}}
});
panel.dialog.addEventListener('close',()=>{qrSave=false;});
drafts.mount(menu,value=>{navigationRevision++;panel.cancelLoad();setProject(value,{render:false,localEdit:false});setPanel('code');notice('Saved work restored — press Run.');},value=>(value.files.find(file=>file.name===value.active)?.text||value.files[0].text)+'\n\n'+value.files.map(file=>file.name+'\n'+file.text).join('\n\n'));
window.pagesApp={getProject:snapshot,snapshot:()=>type.normalize(snapshot()),setProject,preview,store,get editor(){return editor;},run,selectPanel:setPanel};
$('run').onclick = run; $('reload').onclick = run; $('view-run').onclick = run;
$('auto-refresh').onchange = event=>setAuto(event.target.checked); $('auto-mobile').onchange = event=>setAuto(event.target.checked); setAuto(auto);
$('back').onclick = ()=>preview.back();
$('open-page').onclick = ()=>window.open(shareLink({view:true}).long,'_blank','noopener');
for (const button of document.querySelectorAll('[data-width]')) button.onclick = () => {
  $('preview').style.width = button.dataset.width === 'full' ? '100%' : button.dataset.width + 'px';
  for (const item of document.querySelectorAll('[data-width]')) item.setAttribute('aria-pressed',String(item === button));
};
document.querySelector('.mobile-tabs').remove();
const mobile=matchMedia('(max-width:767px)');let activePanel=-1;const moveConsole=()=>{(mobile.matches||activePanel!==-1?$('workspace'):$('preview-pane')).append($('console-pane'));editor?.resize();};moveConsole();mobile.addEventListener('change',moveConsole);
const tabBar=shell.toolbar;
tabs=mountMobileTabs({desktop:true,container:tabBar,panels:[{label:'Code',panel:$('code-pane')},{label:'Preview',panel:$('preview-pane')},{label:'Console',panel:$('console-pane')}],onChange:index=>{activePanel=index;moveConsole();document.body.classList.remove('editor-hidden');$('hide-editor').textContent=index===-1||index===0?'Hide editor':'Show editor';document.body.dataset.panel=index===-1?'split':['code','preview','console'][index];requestAnimationFrame(()=>editor?.resize());}});
const consoleBadge=document.createElement('span');consoleBadge.id='mobile-console-count';consoleBadge.textContent='0';consoleBadge.setAttribute('aria-hidden','true');document.querySelectorAll('.fk-tabs button')[2].append(consoleBadge);consoleView.mobileBadge=consoleBadge;if(mobile.matches)tabs.select(1);


$('toggle-console').onclick = ()=>{ document.body.classList.toggle('console-collapsed'); $('toggle-console').setAttribute('aria-expanded',String(!document.body.classList.contains('console-collapsed'))); };
$('hide-editor').onclick = ()=>{tabs.select(tabs.getView()==='split'||tabs.getView()===0?1:'split');closeMore();};
$('new-project').onchange = event=>{
  const kind = event.target.value; event.target.value = ''; if (!kind) return;
  if (confirm('Start a new project? Download your current work first if you want to keep it.')) { setProject(Project.starter(kind)); closeMore(); }
};
$('add-file').onclick = ()=>{ const name = prompt('New file name (for example about.md or scripts/util.js)'); if (!name) return; try { setProject(Project.add(project,name,Project.template(name)),{reset:false}); setPanel('code'); } catch (error) { notice(error.message); } };
$('file-menu').onclick = fileDialog;
$('rename-file').onclick = ()=>{ try { setProject(Project.rename(project,project.active,$('file-name').value.trim()),{reset:false}); $('file-dialog').close(); } catch (error) { notice(error.message); } };
$('entry-file').onclick = ()=>{ project.entry = project.active; persist(true); preview.reset(); updateURL(); if (auto) run(); $('file-dialog').close(); };
$('delete-file').onclick = ()=>{ if (!confirm('Delete ' + project.active + '?')) return; try { setProject(Project.remove(project,project.active)); $('file-dialog').close(); } catch (error) { notice(error.message); } };
$('open-files').onclick = ()=>$('file-input').click();
$('file-input').onchange = async event=>{ try { const result = await Export.importFiles(event.target.files,snapshot(),$('replace-import').checked); setProject(result); closeMore(); } catch (error) { notice(error.message); } event.target.value = ''; };
$('download').onchange = event=>{ const kind = event.target.value; event.target.value = ''; try { if (kind === 'file') Export.file(snapshot()); if (kind === 'html') Export.html(snapshot(),preview.page || project.entry); if (kind === 'zip') Export.project(snapshot()); } catch (error) { notice(error.message); } };
let shareSnapshot;
const shareMode=document.createElement('select');shareMode.id='share-mode';for(const[value,title]of [['editor','Editor'],['view','Page only']])shareMode.append(Object.assign(document.createElement('option'),{value,textContent:title}));
const modeLabel=document.createElement('label');modeLabel.textContent='Open link in';modeLabel.append(shareMode);
const shareURLs={...urlState,build:(doc,opts)=>ShareLinks.build({url:location.href,project:fromDocument(doc),...opts,view:shareMode.value==='view',page:preview.page||project.entry,cid:savedFingerprint===JSON.stringify({files:fromDocument(doc).files,entry:fromDocument(doc).entry,active:fromDocument(doc).active})?savedCID:null})};
const share=createShareDialog({urlState:shareURLs,getSnapshot:()=>shareSnapshot,onSave:()=>panel.openSave()});share.body.prepend(modeLabel);
function openShare(){shareSnapshot=snapshot();closeMore();share.open();}shareMode.onchange=()=>share.open();$('share').onclick=openShare;
const qr=createQrDialog({config,urlState,onLoad:async outcome=>{if(outcome.kind==='cid'){await panel.load(outcome.cid);return;}const url=new URL(outcome.href);if(url.searchParams.has('view')!==view){location.assign(url.href);return;}history.pushState(null,'',location.pathname+url.search+url.hash);await openURL();},onSave:()=>{qrSave=true;$('share-run').checked=true;shareMode.value=qrMode.value;qr.dialog.close();return panel.openSave();}});
const qrMode=document.createElement('select');qrMode.id='qr-mode';for(const[value,title]of [['editor','Opens the editor'],['view','Opens the page only']])qrMode.append(Object.assign(document.createElement('option'),{value,textContent:title}));const qrLabel=document.createElement('label');qrLabel.textContent='QR destination';qrLabel.append(qrMode);qr.body.prepend(qrLabel);
function openQR(){closeMore();qr.open(shareLink({view:qrMode.value==='view'}).href);}qrMode.onchange=openQR;$('qr').onclick=openQR;
// The splitter supports pointer, touch, and keyboard input.
const splitter = $('splitter');
function resize(percent) { percent = Math.max(20,Math.min(75,percent)); document.documentElement.style.setProperty('--code-width',percent+'%'); splitter.setAttribute('aria-valuenow',Math.round(percent)); editor?.resize(); }
splitter.onpointerdown = event=>{ splitter.setPointerCapture(event.pointerId); splitter.onpointermove = move=>{const rect = $('workspace').getBoundingClientRect();resize((move.clientX-rect.left)/rect.width*100);}; };
splitter.onpointerup = splitter.onpointercancel = ()=>{splitter.onpointermove = null;};
splitter.onkeydown = event=>{ if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); resize(Number(splitter.getAttribute('aria-valuenow'))+(event.key === 'ArrowLeft' ? -2 : 2)); } };
window.addEventListener('resize',()=>editor?.resize());
window.addEventListener('keydown',event=>{ if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); run(); } });
window.addEventListener('offline-before-reload',()=>{persist();updateURL();});
window.addEventListener('beforeunload',()=>{persist();urlState.cancel();updateURL();if(pendingRender){try{local?.removeItem(renderingKey);}catch(_){}}});

function loadScript(src) { return new Promise((resolve,reject)=>{const script = document.createElement('script');script.src = src;script.onload = resolve;script.onerror = reject;document.head.append(script);}); }
if (!view) {
  try {
    await loadScript('ace/ace.js?v=1'); ace.config.set('basePath','ace'); ace.config.set('modePath','ace'); ace.config.set('workerPath','ace');
    editor = ace.edit('ace-editor'); editor.setOptions({fontSize:14,showPrintMargin:false,scrollPastEnd:.4,highlightActiveLine:true,displayIndentGuides:true}); editor.setTheme('ace/theme/tomorrow');
    editor.commands.addCommand({name:'run-page',bindKey:{win:'Ctrl-Enter',mac:'Command-Enter'},exec:run});
  } catch (_) { fallback = document.createElement('textarea'); fallback.className = 'fallback-editor'; fallback.setAttribute('aria-label','Source editor'); fallback.spellcheck = false; fallback.oninput = changed; $('ace-editor').append(fallback); notice('The code editor could not load. You can keep editing in the text field.'); }
}
async function openURL(){
 const own=++navigationRevision;urlState.cancel();panel.cancelLoad();scheduler.cancel();
 try{
  const parsed=urlState.parse(location.href);setAuto(!crashed&&parsed.run!==false);notice(crashed?'The last preview may have frozen the page. Fix the code, then press Run.':'');let next,cid=null,returnedShare;
  if(parsed.kind==='publish'){const result=await store.published(location.hash);if(own!==navigationRevision)return;if(result?.snapshot)next=fromDocument(result.snapshot);cid=result?.cid??null;returnedShare=result?.share;if(result?.error)notice(result.error);else if(result)$('hashbin-status').textContent='Saved to HashBin.';}
  else if(parsed.kind==='source')next=fromDocument(parsed.doc);
  else if(parsed.kind==='example'){const sample=Examples.catalog.find(sample=>sample.id===parsed.id);if(!sample)throw Error('Sample not found. Choose one from the gallery.');next=sample.project;}
  else if(parsed.kind==='none')next=Project.starter();
  if(next){setProject(next,{cid,render:false,update:false,localEdit:false,cancelLoad:false});const page=returnedShare?.page??parsed.page;if(project.files.some(file=>file.name===page&&Project.PAGE.test(page)))preview.page=page;}
  if(returnedShare){setAuto(!crashed&&returnedShare.run!==false);shareMode.value=returnedShare.view?'view':'editor';$('share-run').checked=returnedShare.run!==false;}
  if(parsed.kind==='cid'){await panel.load(parsed.cid);if(own!==navigationRevision)return;if(panel.status.textContent!=='Loaded from HashBin.')notice(panel.status.textContent);}
  else{if(parsed.kind==='example'||parsed.kind==='publish'){updateURL();if(cid)history.replaceState(null,'',urlState.link(location.href,cid));}if(auto)run();else $('view-run').hidden=!view;}
  $('edit-link').href=(()=>{const url=new URL(location.href);url.searchParams.delete('view');return url.href;})();
 }catch(error){if(own===navigationRevision){setAuto(false);notice(error.message);}}
 finally{document.body.dataset.ready='true';}
}
store.retireLegacyTokens().catch(()=>{});
const navigate=event=>{if(event.type==='hashchange'&&event.newURL!==location.href)return;if(location.href===lastNavigation)return;lastNavigation=location.href;if(new URL(location.href).searchParams.has('view')!==view){location.reload();return;}void openURL();};window.addEventListener('hashchange',navigate);window.addEventListener('popstate',navigate);
await openURL();
})();
