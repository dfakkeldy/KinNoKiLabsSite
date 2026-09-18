
const CACHE = 'ns-poker-901a7cb0154cd214';
const URLS = ["poker.html","poker.webmanifest","poker/data.json.gz","poker/source.json","app-icon-180.png","app-icon-512.png","assets/poker-DJnMOnwc.js","assets/rolldown-runtime-aKtaBQYM.js","assets/browser-_rMFpHeB.js","assets/react-lCSYwAWP.js","assets/mailingAddresses-D2v3OaSd.js","assets/hooks-nxDzfu7f.js","assets/Tooltip-BtSDdO2w.js","assets/mailingAddresses-vh-t_kPv.css","assets/palette-KdQ2P1Up.js","assets/poker-BqRxC-2R.css"].map(path => new URL(path, self.location.href).href);
const SHELL = new URL('poker.html', self.location.href).href;
async function validCache(cache) {
  try {
    if (!(await Promise.all(URLS.map(url => cache.match(url)))).every(Boolean)) return false;
    const receipt = await (await cache.match(new URL('poker/source.json', self.location.href).href)).json();
    const bytes = new Uint8Array(await (await cache.match(new URL('poker/data.json.gz', self.location.href).href)).arrayBuffer());
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    return hash === (bytes[0] === 0x1f && bytes[1] === 0x8b ? receipt.sha256 : receipt.decodedSha256);
  } catch { return false; }
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try { await cache.addAll(URLS.map(url => new Request(url, { cache: 'reload' }))); if (!await validCache(cache)) throw Error('Incomplete offline pack'); }
  catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('ns-poker-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE') event.waitUntil(self.skipWaiting());
  if (event.data === 'SAVE_OFFLINE') event.waitUntil((async () => {
    try { const cache = await caches.open(CACHE); await cache.addAll(URLS.map(url => new Request(url, { cache: 'reload' }))); event.ports[0]?.postMessage(await validCache(cache)); }
    catch { event.ports[0]?.postMessage(false); }
  })());
  if (event.data === 'CHECK_OFFLINE') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const ready = await validCache(cache);
    event.ports[0]?.postMessage(ready);
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = event.request.mode === 'navigate' && /^\/poker\/?$/.test(url.pathname);
  if (!navigation && !URLS.includes(url.href)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(navigation ? SHELL : url.href);
    if (cached && navigation) {
      const html = (await cached.text()).replace('<base href="./" />', '<base href="' + new URL('./', self.location.href).href + '" />');
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return cached || fetch(event.request);
  })());
});
