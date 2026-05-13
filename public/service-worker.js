const CACHE_VERSION = "fakeseek-static-dev";
const PRECACHE_URLS = ["./", "./index.html", "./manifest.json", "./logo.png"];
const API_PATH_PREFIXES = ["/api", "/logs", "/mcp"];

function isApiRequest(url) {
  return API_PATH_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );
}

function isStaticRequest(request, url) {
  if (request.destination) {
    return [
      "audio",
      "font",
      "image",
      "manifest",
      "script",
      "style",
      "track",
      "video",
      "worker",
    ].includes(request.destination);
  }

  return /\.(?:css|js|mjs|json|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|wasm)$/i.test(
    url.pathname,
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    const appShell = await cache.match("./index.html");
    if (appShell) return appShell;

    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticRequest(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});
