/*
 * Minimal service worker: makes the app installable and shows an offline page when there is no
 * connection. It never caches API responses or pages — financial data always comes fresh from
 * the server (and the database).
 */
const CACHE = 'finances-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode !== 'navigate') return; // network as usual for everything else
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
