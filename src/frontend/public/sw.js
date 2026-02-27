/* Service Worker for versioned caching */
const SW_VERSION = '__SW_VERSION__';
const CACHE_PREFIX = 'dataflows-core-rompharm-v2';
const APP_CACHE = `${CACHE_PREFIX}:app:${SW_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}:static:${SW_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}:images:${SW_VERSION}`;

const MAX_STATIC_ENTRIES = 200;
const MAX_IMAGE_ENTRIES = 60;

function getScopePath() {
  try {
    const scopeUrl = new URL(self.registration.scope);
    return scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
  } catch (e) {
    return '/';
  }
}

const SCOPE_PATH = getScopePath();
const APP_SHELL_URLS = [
  SCOPE_PATH,
  `${SCOPE_PATH}index.html`
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }

    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && !key.includes(SW_VERSION))
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/modules')) {
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(event, APP_CACHE));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC_ENTRIES));
    return;
  }

  if (isImage(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }
});

function isStaticAsset(pathname) {
  return pathname.startsWith(`${SCOPE_PATH}assets/`) ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.ttf');
}

function isImage(pathname) {
  return pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg');
}

async function networkFirst(event, cacheName) {
  const preloadResponse = await event.preloadResponse;
  if (preloadResponse) {
    return preloadResponse;
  }

  try {
    const response = await fetch(event.request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(event.request, response.clone());
    }
    return response;
  } catch (e) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(event.request);
    if (cached) {
      return cached;
    }

    const fallback = await cache.match(`${SCOPE_PATH}index.html`);
    return fallback || Response.error();
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
    trimCache(cache, maxEntries);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
        trimCache(cache, maxEntries);
      }
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || Response.error();
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) {
    return;
  }

  const deleteCount = keys.length - maxEntries;
  for (let i = 0; i < deleteCount; i += 1) {
    await cache.delete(keys[i]);
  }
}
