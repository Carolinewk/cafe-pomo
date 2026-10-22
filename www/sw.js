// Offline support: the app shell is cached on install. Requests go to the network
// first (so updates show up right away) and fall back to the cache when offline.

const VERSION = 'cafe-pomo-v1';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'fonts/Fredoka-300_700.woff2',
  'fonts/PatrickHand-400.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/main.js',
  'js/timer.js',
  'js/store.js',
  'js/catalog.js',
  'js/audio.js',
  'js/art/rng.js',
  'js/art/pencil.js',
  'js/art/coffees.js',
  'js/ui/ring.js',
  'js/ui/shop.js',
  'js/ui/settings.js',
  'js/ui/dialog.js',
  'js/world/pixel.js',
  'js/world/iso.js',
  'js/world/room.js',
  'js/world/chars.js',
  'js/world/pixfont.js',
  'js/world/scene.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(request, { ignoreSearch: true })
          .then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error())),
      ),
  );
});
