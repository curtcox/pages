/* Complete installs only: a failed download never replaces a working offline cache. */
importScripts('offline-assets.js');
const CACHE = OfflineAssets.version;
const absolute = path => new URL(path,self.registration.scope).href;
const types = {html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'};
const type = path => (types[/\.([a-z]+)$/.exec(path)?.[1]] || 'text/plain') + (path.endsWith('.png') ? '' : ';charset=utf-8');
const hex = buffer => [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');
// Cache Storage is shared by every app on this origin, so bytes are checked against the manifest before they are stored or served.
async function verified(response,path) {
  if (!response?.ok || !Object.prototype.hasOwnProperty.call(OfflineAssets.hashes,path)) return null;
  const body = await response.arrayBuffer();
  if (hex(await crypto.subtle.digest('SHA-256',body)) !== OfflineAssets.hashes[path]) return null;
  return new Response(body,{status:200,headers:{'Content-Type':type(path)}});
}
async function populate() {
  const existed = await caches.has(CACHE), cache = await caches.open(CACHE);
  try {
    await Promise.all(OfflineAssets.assets.map(async path => {
      const response = await fetch(absolute(path),{cache:'reload'});
      if (!response.ok) throw Error('Offline download failed: ' + path);
      const checked = await verified(response,path);
      if (!checked) throw Error('Offline download did not match its manifest: ' + path);
      await cache.put(absolute(path),checked);
    }));
  } catch (error) { if (!existed) await caches.delete(CACHE); throw error; }
}
self.addEventListener('install',event=>event.waitUntil(populate()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  for (const name of await caches.keys()) if (name.startsWith('pagesonline-') && name !== CACHE) await caches.delete(name);
})()));
self.addEventListener('fetch',event=>{
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url), scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  let path = url.pathname.slice(scope.pathname.length);
  if (!Object.prototype.hasOwnProperty.call(OfflineAssets.hashes,path) && event.request.mode === 'navigate' && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) path = 'index.html';
  if (!Object.prototype.hasOwnProperty.call(OfflineAssets.hashes,path)) return;
  event.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    const response = await verified(await cache.match(absolute(path)),path);
    if (response) return response;
    // A missing or altered entry is never served; offline status reports it until repaired.
    await cache.delete(absolute(path));
    return fetch(event.request);
  })());
});
self.addEventListener('message',event=>{
  if (event.data?.type === 'activate-update') { self.skipWaiting(); return; }
  if (!['offline-status','repair-offline'].includes(event.data?.type)) return;
  event.waitUntil((async()=>{
    try {
      if (event.data.type === 'repair-offline') await populate();
      const cache = await caches.open(CACHE), entries = await Promise.all(OfflineAssets.assets.map(async path=>verified(await cache.match(absolute(path)),path)));
      event.ports[0]?.postMessage({ready:entries.every(Boolean),version:CACHE});
    } catch (_) { event.ports[0]?.postMessage({ready:false}); }
  })());
});
