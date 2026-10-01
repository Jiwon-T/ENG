const CACHE_NAME = 'edu-manager-v14';
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
  const url = new URL(event.request.url);
  // 인증 API는 서비스 워커나 오프라인 캐시를 거치지 않습니다.
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Use Network First strategy for all requests to ensure updates are reflected
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
