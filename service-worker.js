// Bumping CACHE_NAME (e.g. to -v2) on a future edit forces every installed
// copy to fetch fresh files next time it's opened online — do that whenever
// index.html/manifest/icons change.
const CACHE_NAME = "bagshop-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GET requests — i.e. this app's own shell files.
  // Everything else (the Google Sheets sync calls, Google Fonts, any POST)
  // goes straight to the network untouched, so sales data always syncs live
  // and this worker never serves a stale answer for something that matters.
  let sameOrigin = false;
  try {
    sameOrigin = new URL(req.url).origin === self.location.origin;
  } catch (err) {
    sameOrigin = false;
  }
  if (req.method !== "GET" || !sameOrigin) return;

  if (req.mode === "navigate") {
    // The app page itself: network first, so you get the latest version
    // whenever there's a connection, falling back to the cached shell so
    // the app still opens with no signal at all (e.g. deep in the market).
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Static shell assets (icons, manifest): cache-first, network fallback.
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
