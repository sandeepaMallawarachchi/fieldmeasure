/*
 * FieldMeasure service worker.
 *
 * - Only same-origin GETs are handled. Map tiles are never cached here, because
 *   most providers' terms restrict it, and offline use relies on the plain map.
 * - Measurements live in sessionStorage and never pass through this cache.
 * - Bump CACHE_VERSION when this file's caching behaviour changes. Hashed Next.js
 *   assets need no versioning, since their URLs change with their content.
 */
const CACHE_VERSION = "v2";
const CACHE_NAME = `fieldmeasure-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const NAVIGATION_TIMEOUT_MS = 4000;

const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/logo-header.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/maplibre/maplibre-gl-worker.mjs",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("fieldmeasure-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data?.type === "CACHE_URLS" && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheUrls(event.data.urls));
  }
});

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    urls
      .filter((url) => new URL(url).origin === self.location.origin)
      .map(async (url) => {
        if (await cache.match(url)) return;
        try {
          await cache.add(url);
        } catch {
          // A missing asset must not stop the others being cached.
        }
      }),
  );
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), NAVIGATION_TIMEOUT_MS),
      ),
    ]);
    if (response.ok && new URL(request.url).pathname === "/") {
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    return (await cache.match("/")) ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/maplibre/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request));
  }
});
