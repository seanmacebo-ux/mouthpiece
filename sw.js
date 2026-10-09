/* MOUTHPIECE service worker.
   Everything = network-first with cache fallback. Online you always get the latest
   deploy; offline you get the last copy. (Cache-first shell meant every update showed
   the OLD app on the first open after a deploy — changed 2026-10-08.) */

const VERSION = "mouthpiece-v7";
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

  // network-first for shell AND data: fresh when online, last-known when not
  const bucket = url.pathname.includes("/data/") ? DATA_CACHE : SHELL_CACHE;
  // no-cache: revalidate with GitHub Pages instead of trusting its 10-minute max-age,
  // so a fresh deploy shows on the very next open. (Fresh Request — navigate-mode
  // requests can't be re-init'd with options.)
  event.respondWith(
    fetch(new Request(event.request.url, { cache: "no-cache" }))
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(bucket).then(cache => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
