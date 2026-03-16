// Service Worker for RYS Gestión PWA
// Mandatory for Android installability

const CACHE_NAME = 'rys-gestion-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch for production to satisfy PWA requirements
  // without interfering with the dynamic app logic.
  event.respondWith(fetch(event.request));
});
