/* Complete installs only: a failed download never replaces a working offline cache. */
importScripts('offline-assets.js');
const CACHE = OfflineAssets.version;
const absolute = path => new URL(path,self.registration.scope).href;
async function populate() {
  const existed = await caches.has(CACHE), cache = await caches.open(CACHE);
  try {
    await Promise.all(OfflineAssets.assets.map(async path => {
      const response = await fetch(absolute(path),{cache:'reload'});
      if (!response.ok) throw Error('Offline download failed: ' + path);
      await cache.put(absolute(path),response);
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
  event.respondWith((async()=>{
    const cache = await caches.open(CACHE), key = url.origin+url.pathname;
    let response = await cache.match(key);
    if (!response && event.request.mode === 'navigate' && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) response = await cache.match(absolute('index.html'));
    return response || fetch(event.request);
  })());
});
self.addEventListener('message',event=>{
  if (event.data?.type === 'activate-update') { self.skipWaiting(); return; }
  if (!['offline-status','repair-offline'].includes(event.data?.type)) return;
  event.waitUntil((async()=>{
    try {
      if (event.data.type === 'repair-offline') await populate();
      const cache = await caches.open(CACHE), entries = await Promise.all(OfflineAssets.assets.map(path=>cache.match(absolute(path))));
      event.ports[0]?.postMessage({ready:entries.every(Boolean),version:CACHE});
    } catch (_) { event.ports[0]?.postMessage({ready:false}); }
  })());
});
