const CACHE_NAME = 'edu-manager-v17-branding-20261010b';
const ASSET_CACHE = CACHE_NAME + '-assets';
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
        cacheNames.filter(name => name !== CACHE_NAME && name !== ASSET_CACHE)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // 인증 API는 서비스 워커나 오프라인 캐시를 거치지 않습니다.
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Content-hashed assets are immutable; authentication and HTML stay outside this cache.
  if (url.origin === self.location.origin && /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(url.pathname)) {
    event.respondWith(caches.open(ASSET_CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') await cache.put(event.request, response.clone()).catch(() => {});
      return response;
    }).catch(() => fetch(event.request)));
    return;
  }
  // Use Network First strategy for all requests to ensure updates are reflected
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

