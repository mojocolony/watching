const CACHE = 'watching-shell-v14';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles.css',
  './src/app.js',
  './src/config.js',
  './src/demo-data.js',
  './src/domain/ordering.js',
  './src/domain/cloud-sync.js',
  './src/domain/shows.js',
  './src/storage/cache.js',
  './src/storage/preferences.js',
  './src/services/tvmaze.js',
  './src/services/provider-names.js',
  './src/services/auth.js',
  './src/services/supabase.js',
  './src/services/metadata-refresh.js',
  './src/data/repository.js',
  './src/ui/add-show.js',
  './src/ui/auth-view.js',
  './src/ui/write-guard.js',
  './src/ui/app-shell.js',
  './src/ui/completion.js',
  './src/ui/drag-controller.js',
  './src/ui/icons.js',
  './src/ui/markup.js',
  './src/ui/state.js',
  './icons/icon-192.png?v=2',
  './icons/icon-512.png?v=2',
  './icons/maskable-512.png?v=2'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isAppMetadataRequest(url) {
  return url.pathname.endsWith('/manifest.webmanifest') || url.pathname.includes('/icons/');
}

function networkFirstWithCache(request) {
  return fetch(request)
    .then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => caches.match(request));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // App code must not remain frozen on an installed PWA after a release.
  // Fall back to the cached shell only when the network is unavailable.
  if (isAppMetadataRequest(url) || url.pathname.includes('/src/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
    )
  );
});
