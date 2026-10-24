(() => {
'use strict';
const EXTENSIONS = new Set(['html','htm','css','js','mjs','md','json','svg','txt','csv','xml']);
const PAGE = /\.(html?|md)$/i;
const bytes = text => new TextEncoder().encode(text).length;
function validName(name) {
  return typeof name === 'string' && name.length <= 240 && name.split('/').every(part => /^[A-Za-z0-9._-]+$/.test(part) && part !== '.' && part !== '..') && EXTENSIONS.has(name.split('.').pop().toLowerCase());
}
function entry(files) {
  for (const name of ['index.html','index.md','README.md']) if (files.some(f => f.name === name)) return name;
  return files.find(f => /\.html?$/i.test(f.name))?.name || files.find(f => /\.md$/i.test(f.name))?.name;
}
function validate(project) {
  if (!project || !Array.isArray(project.files) || !project.files.length || project.files.length > 50) throw Error('A project needs 1–50 text files.');
  const names = new Set(); let total = 0;
  const files = project.files.map(file => {
    if (!file || !validName(file.name)) throw Error('Use relative file paths with letters, numbers, dots, underscores or hyphens and a supported text extension.');
    if (names.has(file.name)) throw Error('File names must be unique (case-sensitive).');
    if (typeof file.text !== 'string') throw Error('Files must contain text.');
    names.add(file.name); total += bytes(file.text);
    return { name: file.name, text: file.text };
  });
  if (total > 5 * 1024 * 1024) throw Error('Project exceeds the 5 MiB limit.');
  const fallback = entry(files);
  if (!fallback) throw Error('Keep at least one HTML or Markdown page in the project.');
  return { files, entry: names.has(project.entry) && PAGE.test(project.entry) ? project.entry : fallback, active: names.has(project.active) ? project.active : fallback };
}
function single(text) { const name = /^\s*(?:<!doctype\s+html|<html\b|<(?:head|body|h[1-6]|div|p|style|script)\b)/i.test(text) ? 'index.html' : 'index.md'; return validate({ files: [{ name, text }] }); }
function add(project, name, text = '') { return validate({ ...project, active: name, files: [...project.files, { name, text }] }); }
function rename(project, oldName, name) {
  if (!project.files.some(f => f.name === oldName)) throw Error('File not found.');
  return validate({ ...project, entry: project.entry === oldName ? name : project.entry, active: project.active === oldName ? name : project.active, files: project.files.map(f => f.name === oldName ? { ...f, name } : f) });
}
function remove(project, name) { const files = project.files.filter(f => f.name !== name); if (!files.some(f => PAGE.test(f.name))) throw Error('Keep at least one HTML or Markdown page in the project.'); return validate({ ...project, files }); }
function resolve(from, reference) {
  if (typeof reference !== 'string' || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(reference)) return null;
  let path; try { path = decodeURIComponent(reference.split(/[?#]/)[0]); } catch (_) { return null; }
  const parts = path.startsWith('/') ? [] : from.split('/').slice(0,-1);
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(part);
  }
  return parts.join('/');
}
const html = '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My page</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main>\n    <p class="eyebrow">A little space on the web</p>\n    <h1>Hello, world.</h1>\n    <p>Make something that is yours.</p>\n    <button id="hello">Say hello</button>\n    <p id="message" aria-live="polite"></p>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n';
const css = ':root { color-scheme: light dark; font-family: system-ui, sans-serif; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f1eb; color: #233b3c; }\nmain { padding: 3rem; max-width: 42rem; }\nh1 { font-size: clamp(3rem, 9vw, 6rem); letter-spacing: -.06em; margin: .3em 0; }\np { line-height: 1.7; }\n.eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: .75rem; }\nbutton { background: #236c60; color: white; border: 0; border-radius: 8px; padding: .85rem 1.3rem; font: inherit; cursor: pointer; }\n';
function starter(kind = 'default') {
  if (kind === 'markdown') return single('# A fresh page\n\nYour ideas start here.\n\n- [ ] Make something\n- [x] Start writing\n');
  if (kind === 'site') return validate({ files: [{ name:'index.md',text:'# Welcome\n\nA small site with room to grow.\n\n[About this site](about.md)\n' },{name:'about.md',text:'# About\n\nMade with curiosity.\n\n[Back home](index.md)\n'},{name:'style.css',text:'body { max-width: 48rem; margin: 4rem auto; padding: 0 1.5rem; font: 18px/1.7 system-ui; color: #233b3c; }\na { color: #236c60; }\n'}] });
  if (kind === 'blank') return validate({ files: [{ name:'index.html',text:'<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Untitled</title>\n<h1>A fresh page</h1>\n</html>\n' }] });
  return validate({files:[{name:'index.html',text:html},{name:'style.css',text:css},{name:'script.js',text:"document.querySelector('#hello').addEventListener('click', () => {\n  document.querySelector('#message').textContent = 'Hello from your page!';\n  console.log('Hello, world!');\n});\n"}]});
}
const Project = { validName, validate, entry, single, add, rename, remove, resolve, starter, PAGE, bytes, template: name => /\.html?$/i.test(name) ? starter('blank').files[0].text : /\.md$/i.test(name) ? '# A fresh page\n' : '' };
if (typeof module !== 'undefined') module.exports = Project; else globalThis.Project = Project;
})();
