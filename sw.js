// Service Worker — Network-first for app files, cache-first for images
const CACHE_NAME = 'solitaire-v6';

// On install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        './',
        './index.html',
        './style.css',
        './solitaire.js',
        './manifest.json',
        './icon.png',
      ])
    )
  );
  self.skipWaiting();
});

// On activate: clean up old caches and claim all tabs immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//   - HTML, JS, CSS, JSON, icon: network-first (always get latest, fall back to cache offline)
//   - Images (card PNGs): cache-first (rarely change, saves bandwidth)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || !url.origin.startsWith(self.location.origin)) return;

  const isAppFile = url.pathname.endsWith('.html')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css')
    || url.pathname.endsWith('.json')
    || url.pathname.endsWith('icon.png')
    || url.pathname.endsWith('/');

  if (isAppFile) {
    // Network-first: try server, fall back to cache
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for card images and other assets
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
