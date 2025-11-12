// bump version to break old cache
const CACHE = "irctc-booking-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest"
];

// Install: precache core shell
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for HTML and functions; cache-first for other same-origin assets
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isHTML = e.request.mode === "navigate" || (e.request.headers.get("accept")||"").includes("text/html");
  const isFn = url.pathname.startsWith("/.netlify/functions/");

  // Never intercept third-party CDNs (like jsDelivr) — let the network handle them
  const thirdParty = url.origin !== self.location.origin;
  if (thirdParty) return;

  if (isHTML || isFn) {
    // Network-first so updates aren’t stuck behind cache
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for local static assets
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }))
    );
  }
});
