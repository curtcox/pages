(async () => {
'use strict';
const $ = id => document.getElementById(id);
const safeStore = name => { try { const value = window[name]; value.getItem('pagesonline:probe'); return value; } catch (_) { return null; } };
const local = safeStore('localStorage'), session = safeStore('sessionStorage');
const key = 'pagesonline:project', renderingKey = 'pagesonline:rendering';
const notice = message => { $('notice').textContent = message; $('notice').hidden = !message; if (view && message) $('view-strip').title = message; };
let project = Project.starter(), editor, fallback, changing = false, urlTimer, savedCID = null, savedFingerprint = null, annotations = new Map();
let initial; try { initial = ShareLinks.parse(location.href,LZString.decompressFromEncodedURIComponent); } catch (error) { initial = {kind:'invalid',run:false}; }
const view = new URLSearchParams(location.search).has('view');
let auto = initial.run !== false, crashed = false, pendingRender = false;
try { crashed = local?.getItem(renderingKey) === '1'; } catch (_) {}
if (crashed) { auto = false; notice('The last preview may have frozen the page. Fix the code, then press Run.'); }
const fingerprint = () => JSON.stringify({files:project.files,entry:project.entry});
const snapshot = () => Project.validate(project);
function persist() {
  try { local?.setItem(key,JSON.stringify(snapshot())); $('save-status').textContent = local ? 'Saved in this browser' : 'Browser storage unavailable'; }
  catch (_) { $('save-status').textContent = 'Browser storage full — download a backup'; }
}
function shareLink(options = {}) {
  return ShareLinks.build({url:location.href,project:snapshot(),compress:LZString.compressToEncodedURIComponent,view:options.view ?? view,run:options.run ?? true,page:preview.page || project.entry,cid:savedFingerprint === fingerprint() ? savedCID : null});
}
function updateURL() { try { history.replaceState(null,'',shareLink().long); } catch (_) { /* Large links may exceed browser history limits. */ } }
function setAuto(value) { auto = value; $('auto-refresh').checked = value; $('auto-mobile').checked = value; if (!value) scheduler.cancel(); }
function setPanel(panel) {
  document.body.dataset.panel = panel;
  for (const button of document.querySelectorAll('.mobile-tabs button')) button.setAttribute('aria-pressed',String(button.dataset.panel === panel));
  requestAnimationFrame(()=>editor?.resize());
}
function changed() {
  if (changing) return;
  const text = editor ? editor.getValue() : fallback.value;
  const next = { ...project, files:project.files.map(f=>f.name === project.active ? {...f,text} : f) };
  try { project = Project.validate(next); } catch (error) { scheduler.cancel(); notice(error.message); return; }
  panel?.cancelLoad(); annotations.delete(project.active); applyAnnotations(); persist();
  clearTimeout(urlTimer); urlTimer = setTimeout(updateURL,700);
  if (auto) scheduler.schedule({detect:false});
}
function applyAnnotations() { editor?.session.setAnnotations(annotations.get(project.active) || []); }
function selectFile(name,line) {
  if (!project.files.some(f=>f.name === name)) return;
  project.active = name; changing = true;
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
  scheduler.cancel();
  if ($('console-clear-refresh').checked) { consoleView.clear(); $('mobile-console-count').textContent = '0'; }
  annotations.clear(); applyAnnotations();
  pendingRender = true;
  try { local?.setItem(renderingKey,'1'); } catch (_) {}
  try { preview.render(); $('view-run').hidden = true; }
  catch (error) { consoleView.add({level:'error',args:[error.message]}); notice(error.message); try { local?.removeItem(renderingKey); } catch (_) {} }
}
const scheduler = new RenderScheduler({detect:()=>{},render:run,renderDelay:500});
function setProject(value,{cid = null,render = auto,reset = true,update = true} = {}) {
  project = Project.validate(value); panel?.cancelLoad(); scheduler.cancel();
  sessions.clear(); annotations.clear(); if (reset) preview.reset();
  if (cid) { savedCID = cid; savedFingerprint = fingerprint(); } else { savedCID = null; savedFingerprint = null; }
  if (editor || fallback) selectFile(project.active); else renderTabs();
  persist(); if (update) updateURL(); if (render) run();
}
const store = new HashBinStore({clientId:document.querySelector('meta[name=hashbin-client-id]').content,redirectUri:new URL('./',location.href).href,storage:local,transactionStorage:session});
const panel = new HashBinPanel({store,getSnapshot:snapshot,getFingerprint:fingerprint,onLoad:(value,cid)=>{ setProject(value,{cid}); $('more').open = false; },onSaved:(cid,fp,link)=>{savedCID = cid;savedFingerprint = fp;history.replaceState(null,'',link);}});
window.pagesApp = {getProject:snapshot,setProject,preview,store,get editor(){return editor;},run};
$('run').onclick = run; $('reload').onclick = run; $('view-run').onclick = run;
$('auto-refresh').onchange = event=>setAuto(event.target.checked); $('auto-mobile').onchange = event=>setAuto(event.target.checked); setAuto(auto);
$('back').onclick = ()=>preview.back();
$('open-page').onclick = ()=>window.open(shareLink({view:true}).long,'_blank','noopener');
for (const button of document.querySelectorAll('[data-width]')) button.onclick = () => {
  $('preview').style.width = button.dataset.width === 'full' ? '100%' : button.dataset.width + 'px';
  for (const item of document.querySelectorAll('[data-width]')) item.setAttribute('aria-pressed',String(item === button));
};
for (const button of document.querySelectorAll('.mobile-tabs button')) button.onclick = ()=>setPanel(button.dataset.panel);
$('toggle-console').onclick = ()=>{ document.body.classList.toggle('console-collapsed'); $('toggle-console').setAttribute('aria-expanded',String(!document.body.classList.contains('console-collapsed'))); };
$('hide-editor').onclick = ()=>{ document.body.classList.toggle('editor-hidden'); $('hide-editor').textContent = document.body.classList.contains('editor-hidden') ? 'Show editor' : 'Hide editor'; editor?.resize(); $('more').open = false; };
$('new-project').onchange = event=>{
  const kind = event.target.value; event.target.value = ''; if (!kind) return;
  if (confirm('Start a new project? Download your current work first if you want to keep it.')) { setProject(Project.starter(kind)); $('more').open = false; }
};
$('add-file').onclick = ()=>{ const name = prompt('New file name (for example about.md or scripts/util.js)'); if (!name) return; try { setProject(Project.add(project,name,Project.template(name)),{reset:false}); setPanel('code'); } catch (error) { notice(error.message); } };
$('file-menu').onclick = fileDialog;
$('rename-file').onclick = ()=>{ try { setProject(Project.rename(project,project.active,$('file-name').value.trim()),{reset:false}); $('file-dialog').close(); } catch (error) { notice(error.message); } };
$('entry-file').onclick = ()=>{ project.entry = project.active; persist(); preview.reset(); updateURL(); if (auto) run(); $('file-dialog').close(); };
$('delete-file').onclick = ()=>{ if (!confirm('Delete ' + project.active + '?')) return; try { setProject(Project.remove(project,project.active)); $('file-dialog').close(); } catch (error) { notice(error.message); } };
$('open-files').onclick = ()=>$('file-input').click();
$('file-input').onchange = async event=>{ try { const result = await Export.importFiles(event.target.files,snapshot(),$('replace-import').checked); setProject(result); $('more').open = false; } catch (error) { notice(error.message); } event.target.value = ''; };
$('download').onchange = event=>{ const kind = event.target.value; event.target.value = ''; try { if (kind === 'file') Export.file(snapshot()); if (kind === 'html') Export.html(snapshot(),preview.page || project.entry); if (kind === 'zip') Export.project(snapshot()); } catch (error) { notice(error.message); } };
const shareClient = new ShareClient(); let shareRevision = 0;
function refreshShare() { shareRevision++; shareClient.cancel(); $('share-url').value = shareLink({view:$('share-mode').value === 'view',run:!$('share-no-run').checked}).long; $('share-status').textContent = ''; }
function openShare() { $('more').open = false; refreshShare(); $('share-dialog').showModal(); }
$('share').onclick = openShare; $('share-mobile').onclick = openShare; $('share-close').onclick = ()=>$('share-dialog').close();
$('share-mode').onchange = refreshShare; $('share-no-run').onchange = refreshShare;
$('share-dialog').addEventListener('close',()=>{shareRevision++;shareClient.cancel();});
$('share-copy').onclick = async()=>{ try { await navigator.clipboard.writeText($('share-url').value); $('share-status').textContent = 'Copied.'; } catch (_) { $('share-url').select(); $('share-status').textContent = 'Select the link and copy it with your keyboard.'; } };
$('share-shorten').onclick = async()=>{
  const revision = shareRevision, long = $('share-url').value; $('share-status').textContent = 'Shortening…';
  const result = await shareClient.shorten({long,fallback:long});
  if (revision !== shareRevision || !result) return;
  $('share-url').value = result.url; $('share-status').textContent = result.shortened ? 'Short link ready.' : result.error.message;
};
let qrMarkup = '';
function refreshQR() {
  const url = shareLink({view:$('qr-mode').value === 'view'}).long, qr = encodeQr(url);
  qrMarkup = qr ? qrSvg(qr) : ''; $('qr-code').replaceChildren();
  if (qrMarkup) { const svg = new DOMParser().parseFromString(qrMarkup,'image/svg+xml').documentElement; $('qr-code').append(document.importNode(svg,true)); }
  $('qr-warning').textContent = qrNotes(url,qr); $('qr-svg').disabled = $('qr-png').disabled = !qr;
}
function openQR() { $('more').open = false; refreshQR(); $('qr-dialog').showModal(); }
$('qr').onclick = openQR; $('qr-mobile').onclick = openQR; $('qr-close').onclick = ()=>$('qr-dialog').close(); $('qr-mode').onchange = refreshQR;
$('qr-svg').onclick = ()=>Export.download('pages-qr.svg',qrMarkup,'image/svg+xml');
$('qr-png').onclick = ()=>{ const image = new Image(); image.onload = ()=>{ const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024; const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false; context.drawImage(image,0,0,1024,1024); canvas.toBlob(blob=>Export.download('pages-qr.png',blob,'image/png')); }; image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrMarkup); };
// The splitter supports pointer, touch, and keyboard input.
const splitter = $('splitter');
function resize(percent) { percent = Math.max(20,Math.min(75,percent)); document.documentElement.style.setProperty('--code-width',percent+'%'); splitter.setAttribute('aria-valuenow',Math.round(percent)); editor?.resize(); }
splitter.onpointerdown = event=>{ splitter.setPointerCapture(event.pointerId); splitter.onpointermove = move=>{const rect = $('workspace').getBoundingClientRect();resize((move.clientX-rect.left)/rect.width*100);}; };
splitter.onpointerup = splitter.onpointercancel = ()=>{splitter.onpointermove = null;};
splitter.onkeydown = event=>{ if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); resize(Number(splitter.getAttribute('aria-valuenow'))+(event.key === 'ArrowLeft' ? -2 : 2)); } };
window.addEventListener('resize',()=>editor?.resize());
window.addEventListener('keydown',event=>{ if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); run(); } });
window.addEventListener('offline-before-reload',persist);
window.addEventListener('beforeunload',()=>{persist();if(pendingRender){try{local?.removeItem(renderingKey);}catch(_){}}});
document.addEventListener('click',event=>{ if (!$('more').contains(event.target)) $('more').open = false; });
function loadScript(src) { return new Promise((resolve,reject)=>{const script = document.createElement('script');script.src = src;script.onload = resolve;script.onerror = reject;document.head.append(script);}); }
if (!view) {
  try {
    await loadScript('ace/ace.js?v=1'); ace.config.set('basePath','ace'); ace.config.set('modePath','ace'); ace.config.set('workerPath','ace');
    editor = ace.edit('ace-editor'); editor.setOptions({fontSize:14,showPrintMargin:false,scrollPastEnd:.4,highlightActiveLine:true,displayIndentGuides:true}); editor.setTheme('ace/theme/tomorrow');
    editor.commands.addCommand({name:'run-page',bindKey:{win:'Ctrl-Enter',mac:'Command-Enter'},exec:run});
  } catch (_) { fallback = document.createElement('textarea'); fallback.className = 'fallback-editor'; fallback.setAttribute('aria-label','Source editor'); fallback.spellcheck = false; fallback.oninput = changed; $('ace-editor').append(fallback); notice('The code editor could not load. You can keep editing in the text field.'); }
}
let restored = false;
try {
  const callback = await store.callback(location.search);
  if (callback) {
    const clean = new URL(location.href); for (const name of ['state','code','error','error_description']) clean.searchParams.delete(name); history.replaceState(null,'',clean.href);
    if (callback.snapshot) { setProject(callback.snapshot,{render:false}); restored = true; }
    if (callback.error) notice(callback.error); else $('hashbin-status').textContent = 'Connected to HashBin. Choose Save to HashBin to save.';
  }
} catch (error) { notice(error.message); }
if (!restored) {
  try {
    if (initial.kind === 'source') project = initial.project;
    else if (initial.kind === 'example') { const sample = Examples.catalog.find(s=>s.id === initial.id); if (!sample) throw Error('Sample not found. Choose one from the gallery.'); project = Project.validate(sample.project); }
    else if (initial.kind === 'empty' && !view) { try { const stored = local?.getItem(key); if (stored) project = Project.validate(JSON.parse(stored)); } catch (_) { notice('The saved project could not be restored. Starting with a fresh page.'); } }
    else if (initial.kind === 'invalid') notice('This project link is invalid. Correct the link or open a new project.');
    project = Project.validate(project);
    if (initial.page && project.files.some(f=>f.name === initial.page && Project.PAGE.test(f.name))) preview.page = initial.page;
  } catch (error) { auto = false; setAuto(false); notice(error.message); }
}
if (editor || fallback) selectFile(project.active);
$('edit-link').href = (()=>{const link = new URL(location.href);link.searchParams.delete('view');return link.href;})();
if (initial.kind === 'cid' && !restored) {
  // Keep a source revision so a slow CID request cannot replace edits made during loading.
  await panel.load(initial.cid);
  if (initial.page && project.files.some(f=>f.name === initial.page && Project.PAGE.test(f.name))) preview.page = initial.page;
  if (auto) run();
} else if (auto && initial.run !== false) run();
else $('view-run').hidden = !view;
persist();
window.addEventListener('hashchange',()=>location.reload());
})();
