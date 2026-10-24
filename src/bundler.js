(() => {
'use strict';
const node = typeof module !== 'undefined';
const Project = node ? require('./project.js') : globalThis.Project;
const Markdown = node ? require('./markdown.js') : globalThis.Markdown;
const LoopGuard = node ? require('./loop-guard.js') : globalThis.LoopGuard;
const Runtime = node ? require('./preview-runtime.js') : globalThis.PreviewRuntime;
const acorn = node ? require('../vendor/acorn.min.js') : globalThis.acorn;
const fake = 'https://pages-project.invalid/';
const dataURL = (text,type) => `data:${type};charset=utf-8,${encodeURIComponent(text)}`;
const scriptText = text => text.replace(/<\/script/gi,'<\\/script');
function build(project, page = project.entry, { runtime = true, guard = true, token = '', hash = '', DOMParser: Parser = globalThis.DOMParser } = {}) {
  project = Project.validate(project);
  const files = Object.fromEntries(project.files.map(f => [f.name,f.text]));
  if (!Object.prototype.hasOwnProperty.call(files,page) || !Project.PAGE.test(page)) throw Error('Preview page not found.');
  let html = /\.md$/i.test(page) ? Markdown.render(files[page],{name:page,hasStyle:Object.prototype.hasOwnProperty.call(files,Project.resolve(page,'style.css'))}) : files[page];
  // linkedom's parser needs a document shell for fragment-only pages; browsers add it automatically.
  if (!/<html[\s>]/i.test(html)) html = '<!doctype html><html><head></head><body>' + html + '</body></html>';
  const doc = new Parser().parseFromString(html,'text/html');
  const local = (from,path) => { const name = Project.resolve(from,path); return name && Object.prototype.hasOwnProperty.call(files,name) ? name : null; };
  const asset = (from,path) => {
    const name = local(from,path);
    if (!name || !/\.(svg|txt|json|csv|xml)$/i.test(name)) return path;
    const mime = /\.svg$/i.test(name) ? 'image/svg+xml' : /\.json$/i.test(name) ? 'application/json' : 'text/plain';
    return dataURL(files[name],mime) + (path.includes('#') ? path.slice(path.indexOf('#')) : '');
  };
  function css(source,from,seen = new Set()) {
    if (seen.has(from)) return '/* Cyclic stylesheet import omitted. */';
    const next = new Set(seen).add(from);
    return source.replace(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/gi,(all,path,condition) => {
      const name = local(from,path); if (!name || !/\.css$/i.test(name)) return all;
      const nested = css(files[name],name,next); return condition.trim() ? `@media ${condition}{${nested}}` : nested;
    }).replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*))\s*\)/gi,(all,_quote,quoted,bare) => {
      const path = (quoted ?? bare).trim(), result = asset(from,path);
      return result === path ? all : `url("${result}")`;
    });
  }
  function moduleSource(source,from) {
    let tree; try { tree = acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'}); } catch (_) { return source; }
    const edits = [];
    function visit(item) {
      if (!item || typeof item !== 'object') return;
      if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(item.type) && typeof item.source?.value === 'string') {
        const name = local(from,item.source.value); if (name) edits.push([item.source.start,item.source.end,JSON.stringify(fake + name)]);
      }
      for (const [key,value] of Object.entries(item)) if (key !== 'source') { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value); }
    }
    visit(tree);
    return edits.sort((a,b)=>b[0]-a[0]).reduce((text,[start,end,replacement])=>text.slice(0,start)+replacement+text.slice(end),source);
  }
  function js(source,from,isModule = false) {
    if (isModule) source = moduleSource(source,from);
    if (guard && runtime) source = LoopGuard.instrument(source,from);
    return source + '\n//# sourceURL=' + from;
  }
  for (const link of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
    const name = local(page,link.getAttribute('href')); if (!name) continue;
    const style = doc.createElement('style'); style.textContent = css(files[name],name); style.dataset.bundled = 'true'; if (link.media) style.setAttribute('media',link.media); link.replaceWith(style);
  }
  for (const style of doc.querySelectorAll('style')) { if (!style.dataset.bundled) style.textContent = css(style.textContent,page); }
  for (const element of doc.querySelectorAll('[style]')) element.setAttribute('style',css(element.getAttribute('style'),page));
  for (const element of doc.querySelectorAll('[src], [poster], object[data], image[href], use[href]')) {
    for (const attr of ['src','poster','data','href']) if (element.hasAttribute(attr) && element.tagName.toLowerCase() !== 'script') element.setAttribute(attr,asset(page,element.getAttribute(attr)));
  }
  const offsets = []; let scriptIndex = 0;
  const originalScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  let hasModule = false;
  for (const script of [...doc.querySelectorAll('script')]) {
    const original = originalScripts[scriptIndex++];
    const type = (script.getAttribute('type') || '').toLowerCase();
    if (type && !['module','text/javascript','application/javascript'].includes(type)) continue;
    const isModule = type === 'module'; hasModule ||= isModule;
    const src = script.getAttribute('src'); const name = src && local(page,src);
    if (src && !name) continue;
    const from = name || page;
    let source = name ? files[name] : script.textContent;
    if (!name && !/\.md$/i.test(page) && original) {
      const offset = html.slice(0,original.index + original[0].indexOf('>')+1).split('\n').length-1;
      offsets.push({file:page,lineOffset:offset}); source = '\n'.repeat(offset) + source;
    }
    script.removeAttribute('src'); script.removeAttribute('integrity'); script.removeAttribute('crossorigin');
    // Self-contained data scripts keep parser order and global lexical scope. WebKit
    // redacts errors from inline scripts in opaque srcdoc; data scripts retain CORS diagnostics.
    // Preserve defer/async for referenced scripts, but those attributes are inert on original inline scripts.
    if (!name) { script.removeAttribute('defer'); script.removeAttribute('async'); }
    const compiled = js(source,from,isModule);
    script.setAttribute('src',dataURL(compiled,'text/javascript')); script.dataset.pagesFile = from; script.textContent = '';

  }
  if (hasModule) {
    const imports = {};
    for (const file of project.files.filter(f=>/\.(m?js)$/i.test(f.name))) imports[fake+file.name] = dataURL(js(file.text,file.name,true),'text/javascript');
    const map = doc.createElement('script'); map.type = 'importmap'; map.textContent = JSON.stringify({imports}).replace(/</g,'\\u003c'); doc.head.insertBefore(map,doc.head.firstChild);
  }
  if (runtime) {
    // A page base tag must not change resolution of our own project paths.
    const script = doc.createElement('script'); script.textContent = scriptText(Runtime.source({files,page,token,hash})); doc.head.insertBefore(script,doc.head.firstChild);
  }
  return { html: '<!doctype html>\n' + doc.documentElement.outerHTML, offsets };
}
const Bundler = { build, dataURL };
if (node) module.exports = Bundler; else globalThis.Bundler = Bundler;
})();
