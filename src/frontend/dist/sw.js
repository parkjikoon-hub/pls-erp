/**
 * PLS ERP — Service Worker (PWA 오프라인 기본 지원)
 */
const CACHE_NAME = 'pls-erp-v1';

/* 설치 시 기본 리소스 캐시 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/'])
    )
  );
  self.skipWaiting();
});

/* 활성화 시 이전 캐시 정리 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

/* 네트워크 우선, 실패 시 캐시 */
self.addEventListener('fetch', (event) => {
  /* API 요청은 캐시하지 않음 */
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
