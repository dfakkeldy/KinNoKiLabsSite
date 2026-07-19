const CACHE = 'kinnoki-tools-v1';
const CACHE_PREFIX = 'kinnoki-tools-';
const PRECACHE = [
  '/tools/',
  '/tools/contrast/',
  '/tools/dilution/',
  '/tools/epub-reader/',
  '/tools/passphrase/',
  '/tools/qr-code/',
  '/tools/unit-converter/',
  '/tools/word-count/',
  '/tools/contrast-ui.js',
  '/tools/contrast.js',
  '/tools/core.js',
  '/tools/dilution-ui.js',
  '/tools/dilution.js',
  '/tools/epub-package.js',
  '/tools/epub-reader-ui.js',
  '/tools/epub-sanitize.js',
  '/tools/epub-store.js',
  '/tools/epub-xml.js',
  '/tools/epub-zip.js',
  '/tools/hub-ui.js',
  '/tools/passphrase-ui.js',
  '/tools/passphrase.js',
  '/tools/qr-matrix.js',
  '/tools/qr-ui.js',
  '/tools/qr.js',
  '/tools/ui.js',
  '/tools/unit-convert-ui.js',
  '/tools/unit-convert.js',
  '/tools/word-count-ui.js',
  '/tools/word-count.js',
  '/tools/wordlist.js',
  '/tools/manifest.webmanifest',
  '/tools/icons/icon-192.png',
  '/tools/icons/icon-512.png',
  '/styles.css',
  '/site.js',
  '/OpenDyslexic-Regular.otf',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

const isToolsNavigation = (request) => {
  if (request.mode !== 'navigate') return false;
  const { pathname } = new URL(request.url);
  return pathname === '/tools' || pathname.startsWith('/tools/');
};

const cacheKey = (request) => {
  const { pathname } = new URL(request.url);
  if (isToolsNavigation(request) && !pathname.endsWith('/')) return `${pathname}/`;
  return pathname;
};

const offlineResponse = async (request) => {
  try {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(cacheKey(request));
    if (cached) return cached;
    if (isToolsNavigation(request)) return await cache.match('/tools/') ?? Response.error();
  } catch { /* cache unavailable */ }
  return Response.error();
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    let fresh;
    try {
      fresh = await fetch(request);
    } catch {
      return offlineResponse(request);
    }

    if (fresh.ok && fresh.type !== 'opaque' && fresh.type !== 'error') {
      try {
        const cache = await caches.open(CACHE);
        await cache.put(cacheKey(request), fresh.clone());
      } catch { /* best-effort cache refresh */ }
    }
    return fresh;
  })());
});
