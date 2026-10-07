/* MOUTHPIECE service worker.
   Shell = cache-first. Data (data/*.json) = network-first with cache fallback. */

const VERSION = "mouthpiece-v2";
const SHELL_CACHE = VERSION + "-shell";
const DATA_CACHE = VERSION + "-data";

const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;

  if (url.pathname.includes("/data/") && url.pathname.endsWith(".json")) {
    // network-first: fresh data when online, last-known data when not
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then(cache => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // shell + everything else same-origin: cache-first
  event.respondWith(
    caches.match(event.request).then(hit =>
      hit || fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(event.request, copy));
        return res;
      })
    )
  );
});
