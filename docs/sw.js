const CACHE_NAME = 'proxripper-cache-v1';
const urlsToCache = [
  '/',
  '/ProxRipper/index.html',
  '/ProxRipper/app.js',
  '/ProxRipper/manifest.json',
  '/ProxRipper/images/favicon-32x32.png',
  '/ProxRipper/images/favicon-16x16.png',
  '/ProxRipper/images/apple-touch-icon.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/4.1.5/css/flag-icons.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(resp => resp || fetch(event.request))
  );
});
