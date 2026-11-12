/* App-Shell-Cache. CACHE bei jeder Veröffentlichung erhöhen, damit Updates ankommen. */
const CACHE = "trainingstagebuch-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./favicon.ico",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/catalog.js",
  "./js/util.js",
  "./js/migrate.js",
  "./js/markdown.js",
  "./js/store.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./fonts/barlow-400.woff2",
  "./fonts/barlow-600.woff2",
  "./fonts/barlow-700.woff2",
  "./fonts/barlow-condensed-600.woff2",
  "./fonts/barlow-condensed-700.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
