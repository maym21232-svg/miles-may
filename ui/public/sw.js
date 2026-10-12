const scope = self.registration.scope;
const CACHE_PREFIX = `stock-research-shell:${new URL(scope).pathname}:`;
const CACHE = `${CACHE_PREFIX}v2`;
const shell = new URL("offline.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(shell)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(async () =>
    (await caches.match(shell)) ?? Response.error()));
});
