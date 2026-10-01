const CACHE_NAME = 'edu-manager-v13';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force active immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Authenticated API requests must reach the server without cache fallback.
  if (new URL(event.request.url).pathname.startsWith('/api/')) return;
  // Use Network First strategy for all requests to ensure updates are reflected
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
