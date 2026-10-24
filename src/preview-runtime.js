(() => {
'use strict';
// This function is serialized into srcdoc. Keep it independent of the editor globals.
function boot(config) {
  const { files, page, token } = config;
  const send = (type, detail = {}) => parent.postMessage({ channel: 'pages-online', token, type, ...detail }, '*');
  const resolve = reference => {
    if (typeof reference !== 'string' || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(reference)) return null;
    let path; try { path = decodeURIComponent(reference.split(/[?#]/)[0]); } catch (_) { return null; }
    const parts = path.startsWith('/') ? [] : page.split('/').slice(0,-1);
    for (const part of path.split('/')) { if (!part || part === '.') continue; if (part === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(part); }
    const name = parts.join('/'); return Object.prototype.hasOwnProperty.call(files,name) ? name : null;
  };
  const mime = name => ({ json:'application/json',svg:'image/svg+xml',html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',mjs:'text/javascript',xml:'application/xml' }[name.split('.').pop()] || 'text/plain') + ';charset=utf-8';
  function storage() {
    const values = new Map();
    return { get length() { return values.size; }, key: n => [...values.keys()][n] ?? null, getItem: key => values.get(String(key)) ?? null, setItem: (key,value) => { values.set(String(key),String(value)); }, removeItem: key => { values.delete(String(key)); }, clear: () => values.clear() };
  }
  for (const name of ['localStorage','sessionStorage']) { try { Object.defineProperty(window,name,{ configurable: true, value: storage() }); } catch (_) { /* Older engines may keep throwing; the editor remains isolated. */ } }
  try { Object.defineProperty(document,'cookie',{ configurable:true,get:()=>'',set:()=>{} }); } catch (_) { /* No cookies in an opaque origin. */ }
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const name = resolve(typeof input === 'string' ? input : input?.url);
    if (!name) return nativeFetch(input,options);
    const signal = options.signal || input?.signal; signal?.throwIfAborted();
    const method = (options.method || input?.method || 'GET').toUpperCase();
    if (!['GET','HEAD'].includes(method)) return new Response('Virtual files are read-only.',{status:405});
    return new Response(method === 'HEAD' ? null : files[name], { status:200,headers:{'Content-Type':mime(name)} });
  };
  const NativeXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = class extends NativeXHR {
    open(method,url,async = true,...rest) {
      this._name = resolve(url); this._method = String(method).toUpperCase(); this._async = async;
      if (!this._name) return super.open(method,url,async,...rest);
      this._state = 1; this._aborted = false; this.dispatchEvent(new Event('readystatechange'));
    }
    get readyState() { return this._name ? this._state : super.readyState; }
    get status() { return this._name ? this._state === 4 ? (['GET','HEAD'].includes(this._method) ? 200 : 405) : 0 : super.status; }
    get statusText() { return this._name ? this.status === 200 ? 'OK' : 'Method Not Allowed' : super.statusText; }
    get responseURL() { return this._name ? this._name : super.responseURL; }
    get responseText() { return this._name ? this._state === 4 && this._method !== 'HEAD' ? files[this._name] : '' : super.responseText; }
    get response() {
      if (!this._name) return super.response;
      if (this._state !== 4) return null;
      const text = this.responseText;
      if (this.responseType === 'json') { try { return JSON.parse(text); } catch (_) { return null; } }
      if (this.responseType === 'blob') return new Blob([text],{type:mime(this._name)});
      if (this.responseType === 'arraybuffer') return new TextEncoder().encode(text).buffer;
      if (this.responseType === 'document') return new DOMParser().parseFromString(text,'text/html');
      return text;
    }
    getAllResponseHeaders() { return this._name ? `content-type: ${mime(this._name)}\r\n` : super.getAllResponseHeaders(); }
    getResponseHeader(name) { return this._name ? name.toLowerCase() === 'content-type' ? mime(this._name) : null : super.getResponseHeader(name); }
    setRequestHeader(...args) { if (!this._name) super.setRequestHeader(...args); }
    overrideMimeType(...args) { if (!this._name) super.overrideMimeType(...args); }
    send(body) {
      if (!this._name) return super.send(body);
      if (this._state !== 1) throw new DOMException('Call open first.','InvalidStateError');
      const complete = () => {
        if (this._aborted) return;
        this.dispatchEvent(new Event('loadstart'));
        for (const state of [2,3,4]) { this._state = state; this.dispatchEvent(new Event('readystatechange')); }
        this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend'));
      };
      if (this._async) queueMicrotask(complete); else complete();
    }
    abort() { if (!this._name) return super.abort(); this._aborted = true; this._state = 0; this.dispatchEvent(new Event('abort')); this.dispatchEvent(new Event('loadend')); }
  };
  function summarize(value, depth = 0, seen = new Set()) {
    try {
      if (typeof value === 'string') return value.slice(0,12000);
      if (value === null || ['number','boolean'].includes(typeof value)) return value;
      if (typeof value === 'undefined') return 'undefined';
      if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
      if (value instanceof Error) return `${value.name}: ${value.message}`;
      if (value instanceof Node) return `<${value.nodeName.toLowerCase()}${value.id ? '#' + value.id : ''}>`;
      if (typeof value !== 'object') return String(value);
      if (seen.has(value)) return '[Circular]';
      if (depth >= 3) return Array.isArray(value) ? '[Array]' : '[Object]';
      seen.add(value);
      const out = Array.isArray(value) ? [] : Object.create(null);
      for (const key of Object.keys(value).slice(0,30)) { try { out[key] = summarize(value[key],depth+1,seen); } catch (_) { out[key] = '[Unreadable]'; } }
      return out;
    } catch (_) { return '[Unreadable]'; }
  }
  let imports;
  function fileFrom(url) {
    const simple = String(url || '').replace(/^https:\/\/pages-project.invalid\//,'');
    if (Object.prototype.hasOwnProperty.call(files,simple)) return simple;
    for (const script of document.querySelectorAll('script[data-pages-file]')) if (script.src === url || script.getAttribute('src') === url) return script.dataset.pagesFile;
    if (!imports) { try { imports = JSON.parse(document.querySelector('script[type=importmap]')?.textContent || '{}').imports || {}; } catch (_) { imports = {}; } }
    for (const [key,value] of Object.entries(imports)) if (value === url) return key.replace('https://pages-project.invalid/','');
    return null;
  }
  function locationFrom(stack = '') {
    for (const line of String(stack).split('\n')) {
      const match = line.match(/:(\d+):(\d+)\)?$/);
      if (!match) continue;
      let url = line.slice(0,match.index).trim().replace(/^at\s+/,'');
      if (url.includes('@')) url = url.slice(url.lastIndexOf('@')+1);
      if (url.includes(' (')) url = url.slice(url.indexOf(' (')+2);
      const file = fileFrom(url); if (file) return {file,line:Number(match[1])};
    }
    return {};
  }
  let quota = 0; setInterval(() => { quota = 0; },1000);
  function log(level,args,where = {}) { if (++quota > 200) return; send('console',{level,args:args.map(v => summarize(v)),...where}); }
  for (const level of ['log','info','warn','error','debug','table','dir']) {
    const original = console[level]?.bind(console);
    console[level] = (...args) => { log(level,args,locationFrom(new Error().stack)); original?.(...args); };
  }
  console.clear = () => send('clear');
  addEventListener('error',event => {
    const file = fileFrom(event.filename);
    log('error',[event.message],event.error?.pagesFile ? { file:event.error.pagesFile,line:event.error.pagesLine } : Object.prototype.hasOwnProperty.call(files,file) ? {file,line:event.lineno} : locationFrom(event.error?.stack));
  });
  addEventListener('unhandledrejection',event => log('error',[event.reason],locationFrom(event.reason?.stack)));
  let deadline = performance.now() + 1000;
  setInterval(() => { deadline = performance.now() + 1000; },50);
  window.__pagesGuard = (file,line) => {
    if (performance.now() <= deadline) return;
    const error = new Error(`Loop stopped after 1 s on ${file} line ${line}`); error.pagesFile = file; error.pagesLine = line; throw error;
  };
  addEventListener('message',event => {
    if (event.source !== parent || event.data?.channel !== 'pages-online' || event.data.token !== token || event.data.type !== 'eval' || typeof event.data.expression !== 'string' || event.data.expression.length > 10000) return;
    deadline = performance.now() + 1000;
    try { log('log',[(0,eval)(event.data.expression)]); } catch (error) { log('error',[error],locationFrom(error.stack)); }
  });
  document.addEventListener('click',event => {
    const anchor = event.target.closest?.('a[href]'); if (!anchor || event.defaultPrevented || anchor.hasAttribute('download')) return;
    const href = anchor.getAttribute('href');
    if (href.startsWith('#')) return;
    const name = resolve(href);
    if (name && /\.(html?|md)$/i.test(name)) { event.preventDefault(); send('navigate',{page:name,hash:href.includes('#') ? href.slice(href.indexOf('#')) : ''}); }
    else if (/^(https?:|\/\/|mailto:|tel:)/i.test(href)) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
  });
  function title() { send('title',{title:document.title.slice(0,200)}); }
  addEventListener('DOMContentLoaded',() => {
    title(); new MutationObserver(title).observe(document.head,{childList:true,subtree:true,characterData:true});
    if (config.hash) { try { document.getElementById(decodeURIComponent(config.hash.slice(1)))?.scrollIntoView(); } catch (_) {} }
  });
  addEventListener('load',() => setTimeout(() => send('ready'),80));
}
const PreviewRuntime = { boot, source: config => `(${boot.toString()})(${JSON.stringify(config).replace(/</g,'\\u003c')});` };
if (typeof module !== 'undefined') module.exports = PreviewRuntime; else globalThis.PreviewRuntime = PreviewRuntime;
})();
