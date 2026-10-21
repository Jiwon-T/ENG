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

// 과제·보강 알림: a push from FCM (notification and/or data fields). One tag per lesson, so a later change replaces the
// earlier alert instead of piling up; a tap opens (or focuses) the app at the link.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  const n = d.notification || {}, data = d.data || {};
  const title = n.title || data.title || '채움';
  const options = { body: n.body || data.body || '', tag: data.tag || undefined, renotify: Boolean(data.tag), icon: '/android-icon-192x192.png', badge: '/android-icon-96x96.png', data: { link: (d.fcmOptions && d.fcmOptions.link) || data.link || '/' } };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = new URL((event.notification.data && event.notification.data.link) || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.location.origin) && 'focus' in c) { if ('navigate' in c && c.url !== link) c.navigate(link).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(link);
  }));
});
