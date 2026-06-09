// Muğla Monitor Service Worker v2
// Strategy: Network-first for API, Cache-first for static assets.

const CACHE_NAME = "mugla-monitor-v2";
const API_CACHE  = "mugla-monitor-api-v2";

const PRECACHE_URLS = ["/", "/index.html", "/offline.html", "/manifest.json", "/favicon.ico"];

const CACHEABLE_APIS = ["api.open-meteo.com", "earthquake.usgs.gov", "api.waqi.info", "api.frankfurter.dev", "opensky-network.org", "news.google.com", "www.reddit.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {})).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET") return;

  // Cache-first: static assets
  if (url.origin === self.location.origin && (url.pathname.match(/\.(js|css|woff2?|ttf|png|svg|ico|webp)$/) || url.pathname.startsWith("/assets/"))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp.ok) { const clone = resp.clone(); caches.open(CACHE_NAME).then((c) => c.put(request, clone)); }
          return resp;
        });
      })
    );
    return;
  }

  // Network-first: known APIs
  const isApiCall = CACHEABLE_APIS.some((origin) => url.hostname.includes(origin));
  if (isApiCall) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) { const clone = resp.clone(); caches.open(API_CACHE).then((c) => c.put(request, clone)); }
          return resp;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response(JSON.stringify({ offline: true }), { headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  // HTML pages: network-first, offline.html fallback
  if (request.headers.get("Accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((resp) => { if (resp.ok) { const clone = resp.clone(); caches.open(CACHE_NAME).then((c) => c.put(request, clone)); } return resp; })
        .catch(() => caches.match(request)
  .then((cached) => cached || caches.match("/offline.html"))
  .then((cached) => cached || caches.match("/index.html"))
)
    );
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  event.waitUntil(self.registration.showNotification(data.title ?? "Muğla Monitör", { body: data.body ?? "", icon: "/favicon.ico", tag: data.tag ?? "default" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(clients.openWindow(url));
});
