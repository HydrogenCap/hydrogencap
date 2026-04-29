/**
 * TenureIQ service worker.
 *
 * Strategy (intentionally conservative — never serve stale user data):
 *   - Navigations:        network-first → offline.html fallback.
 *   - Hashed /assets/*:   cache-first (immutable, safe).
 *   - Static icons/PWA:   cache-first.
 *   - Supabase/API/auth:  network-only (never cached, never intercepted).
 */
const CACHE_VERSION = 'tenureiq-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/favicon.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function isApiOrAuthRequest(url) {
  // Never intercept Supabase, auth, or any /api/* — these must always be live.
  return (
    url.hostname.endsWith('.supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/~oauth')
  );
}

function isHashedAsset(url) {
  // Vite emits hashed files under /assets/ — safe to cache-first.
  return url.pathname.startsWith('/assets/');
}

function isStaticIcon(url) {
  return /\/(favicon|pwa-|apple-touch-icon|manifest\.json)/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin requests we don't manage (besides Supabase) — let the browser handle.
  if (url.origin !== self.location.origin && !url.hostname.endsWith('.supabase.co')) {
    return;
  }

  if (isApiOrAuthRequest(url)) {
    return; // network-only
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (isStaticIcon(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
  }
});
