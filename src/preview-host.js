/* Trusted relay only: user HTML is assigned exclusively to the opaque child frame. */
(() => {
'use strict';
const token = new URLSearchParams(location.search).get('render');
if (parent === self || !/^[a-f0-9-]{36}$/.test(token || '')) return;
const frame = document.getElementById('preview-content');
let rendered = false, editorOrigin = null;
addEventListener('message', event => {
  const d = event.data;
  if (!d || typeof d !== 'object' || d.channel !== 'pages-online' || d.token !== token) return;
  if (event.source === parent) {
    if (!/^https?:\/\//.test(event.origin)) return;
    if (d.type === 'render' && !rendered && typeof d.html === 'string' && d.html.length <= 64 * 1024 * 1024) {
      rendered = true; editorOrigin = event.origin;
      frame.srcdoc = d.html;
    } else if (rendered && event.origin === editorOrigin && d.type === 'eval' && typeof d.expression === 'string' && d.expression.length <= 10000) {
      frame.contentWindow.postMessage(d, '*');
    }
  } else if (rendered && event.source === frame.contentWindow && event.origin === 'null' && ['console','navigate','title','ready','clear'].includes(d.type)) {
    // Forward only JSON data in known fields, never arbitrary structured-clone payloads.
    const fields = {console:['level','args','file','line'],navigate:['page','hash'],title:['title'],ready:[],clear:[]};
    const message = {channel:'pages-online',token,type:d.type};
    for (const field of fields[d.type]) if (Object.prototype.hasOwnProperty.call(d,field)) message[field] = d[field];
    let json; try { json = JSON.stringify(message); } catch (_) { return; }
    if (json.length <= 110000) parent.postMessage(JSON.parse(json), editorOrigin);
  }
});
parent.postMessage({ channel: 'pages-online', token, type: 'host-ready' }, '*');
})();
