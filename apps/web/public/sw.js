/* Learnly service worker: offline app shell + lesson caching. */

const VERSION = "v3";
const SHELL_CACHE = `learnly-shell-${VERSION}`;
const ASSET_CACHE = `learnly-assets-${VERSION}`;
const API_CACHE = `learnly-api-${VERSION}`;
const SHELL_URLS = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

// Read-only learning content that is safe to serve stale while we revalidate.
const CACHEABLE_API = [/\/v1\/lessons\/[^/]+$/, /\/v1\/courses(\/[^/]+)?$/, /\/v1\/skills\/[^/]+\/lessons$/];
const MAX_API_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, API_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("learnly-") && !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Sent on sign-out so the next person on a shared device can't read cached lessons.
  if (event.data && event.data.type === "clear-user-cache") event.waitUntil(caches.delete(API_CACHE));
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    const cached = (await caches.match("/index.html")) || (await caches.match("/"));
    return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(event.request, response.clone());
        if (cacheName === API_CACHE) await trimCache(API_CACHE, MAX_API_ENTRIES);
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const response = await network;
  return (
    response ||
    new Response(JSON.stringify({ error: { code: "network", message: "You're offline and this isn't saved yet." } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.origin === self.location.origin && CACHEABLE_API.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(event, API_CACHE));
    return;
  }

  const isBuiltAsset = url.origin === self.location.origin && url.pathname.startsWith("/assets/");
  const isFont = url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";
  if (isBuiltAsset || isFont) event.respondWith(cacheFirst(request));
});
