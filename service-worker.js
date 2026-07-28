const CACHE_NAME = 'camera-app-v3';
const APP_SHELL = ['./index.html', './manifest.json'];

// Install: app shell cache karo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: purane cache versions hatao
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Google Apps Script / Drive requests (photo save, gallery load, thumbnails)
//   -> hamesha network se lo, kabhi cache mat karo (fresh data chahiye)
// - HTML (index.html / navigation) -> NETWORK-FIRST, taaki naya deploy turant
//   installed app me bhi dikhe. Offline hone par hi cache se fallback hoga.
// - Baaki same-origin assets (JS/CSS/icons/manifest) -> cache-first, fallback network
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isRemoteApi =
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('drive.google.com');

  if (isRemoteApi || req.method !== 'GET') {
    // In requests ko service worker touch nahi karega
    return;
  }

  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && url.origin === self.location.origin) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
