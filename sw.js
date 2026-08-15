/* ============================================================
   Service worker — offline app shell
   Bump CACHE when shipping a change, or clients keep the old copy.
   ============================================================ */

const CACHE = 'cupping-qc-v4';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './store.js',
  './export.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/**
 * Cache-first. This is a bench tool used offline in a roastery — a stale
 * asset is always better than a spinner. New versions arrive via the
 * CACHE bump above, which the activate handler cleans up.
 */
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;

      return fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() =>
        // Offline and uncached: navigations still get the shell.
        req.mode === 'navigate' ? caches.match('./index.html') : Response.error()
      );
    })
  );
});
