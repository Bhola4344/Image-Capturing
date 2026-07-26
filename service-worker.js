const CACHE_NAME = 'camera-app-v1';
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
// - Baaki same-origin app shell requests -> cache-first, fallback network
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

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Successful same-origin response ko cache me bhi rakh do
          if (res && res.status === 200 && url.origin === self.location.origin) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached); // offline aur kuch na mile to bas fail hone do
    })
  );
});
