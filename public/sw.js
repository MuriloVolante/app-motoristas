/* Service Worker — cache do app shell (PWA offline-first) */

const CACHE = "assis-vg-v6";

const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/chat.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/assis/placeholder-padrao.svg",
  "./assets/assis/placeholder-fala.svg",
  "./assets/assis/placeholder-duvida.svg",
  "./assets/assis/placeholder-triste.svg",
  "./assets/assis/placeholder-feliz.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // API e fotos sempre vão à rede — nunca servem do cache
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return resp;
        }).catch(() => cached)
    )
  );
});
