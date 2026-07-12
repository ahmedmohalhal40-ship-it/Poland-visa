const CACHE_NAME = 'poland-visa-checklist-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './data.js',
  './translations.js',
  './state.js',
  './storage.js',
  './planner.js',
  './statistics.js',
  './share.js',
  './pwa.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
