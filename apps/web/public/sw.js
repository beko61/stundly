// Stundly Service Worker
// Minimum SW: makes the app installable on Chrome / Android.
// Strategy: network-first (always fresh), fallback to cache only when offline.

const VERSION = 'stundly-v1';

self.addEventListener('install', (event) => {
  // Activate immediately on first install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop old caches from previous versions
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET; ignore everything else (API calls etc.)
  if (req.method !== 'GET') return;

  // Skip cross-origin (Supabase, Stripe, fonts CDN)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Skip Next.js internals and APIs — always live
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return;
  }

  // Network-first for navigations and static pages
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Cache successful HTML/asset responses
        if (fresh.ok && (req.destination === 'document' || req.destination === 'image' || req.destination === '')) {
          const cache = await caches.open(VERSION);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        // Offline → try cache
        const cached = await caches.match(req);
        if (cached) return cached;
        // Last resort: cached landing
        const fallback = await caches.match('/');
        if (fallback) return fallback;
        throw err;
      }
    })()
  );
});
