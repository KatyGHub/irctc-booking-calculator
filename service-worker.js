const CACHE = "irctc-booking-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest"
];

// Install: precache core assets
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for functions, cache-first for everything else
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isFn = url.pathname.startsWith("/.netlify/functions/");
  if (isFn) {
    // Network-first for live data
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for app shell
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
