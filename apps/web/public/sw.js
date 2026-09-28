// Stundly Service Worker — Offline-Modus
//
// - /_next/static/*  → cache-first (Dateinamen enthalten Hash, ändern sich nie)
// - Seiten (HTML)    → network-first; ohne Netz (oder nach 4 s ohne Antwort) aus dem Cache
// - Nachricht "precache" (von OfflineSync): App-Seiten + ihre JS/CSS vorab laden,
//   damit die App auch ohne Netz startet, wenn eine Seite noch nie geöffnet wurde
// - Nachricht "clear" (beim Abmelden): gespeicherte Seiten löschen
// Daten (Supabase) laufen nicht über den SW — die sichert React Query im localStorage.

const PAGES = 'stundly-pages-v4';
const STATIC = 'stundly-static-v1';
const MAX_STATIC = 400;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

async function trimStatic() {
  const cache = await caches.open(STATIC);
  const keys = await cache.keys();
  // Älteste zuerst (Einfügereihenfolge) — alte Deploy-Chunks fallen raus
  for (let i = 0; i < keys.length - MAX_STATIC; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    trimStatic();
  }
  return res;
}

const OFFLINE_HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Stundly</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0f0f13;color:#e8e8f0;font-family:system-ui,sans-serif;text-align:center;padding:24px}
a{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;background:#7c6af7;color:#fff;text-decoration:none;font-weight:700}</style>
</head><body><div><div style="font-size:42px">📴</div><h1 style="font-size:20px">Kein Internet</h1>
<p style="color:#9a9ab0;max-width:320px">Diese Seite ist offline nicht verfügbar. Deine Zeiten und Notdienste kannst du trotzdem erfassen.</p>
<a href="/tracker">Zu meinen Zeiten</a></div></body></html>`;

// Seiten ohne Query-String speichern (/tracker?x → /tracker); Vary ignorieren, weil
// Navigation und Precache-Fetch sich in Headern unterscheiden können.
function pageKey(req) {
  const url = new URL(req.url);
  return req.mode === 'navigate' ? new Request(url.origin + url.pathname) : req;
}

async function networkFirst(req, event) {
  const cache = await caches.open(PAGES);
  const key = pageKey(req);
  const network = fetch(req).then(async (res) => {
    // Nur echte Seiten sichern — keine Weiterleitungen (z. B. auf /login)
    if (res.ok && !res.redirected && res.type === 'basic') await cache.put(key, res.clone());
    return res;
  });
  // Lahmes Netz (Keller, Baustelle): nach Timeout gespeicherte Version zeigen,
  // die Netzantwort aktualisiert den Cache trotzdem im Hintergrund.
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, 'timeout'));
  event.waitUntil(network.catch(() => {}));
  try {
    const winner = await Promise.race([network, timeout]);
    if (winner !== 'timeout') return winner;
    const cached = await cache.match(key, { ignoreVary: true });
    return cached || (await network);
  } catch (err) {
    const cached = await cache.match(key, { ignoreVary: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Fremde Hosts (Supabase, Stripe, Fonts) nicht anfassen
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Immer live: APIs, Auth, Bildoptimierung, sonstige Next-Interna
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return;
  }

  // Nur Seitenaufrufe und Bilder. RSC-/fetch-Anfragen laufen live — schlagen sie offline
  // fehl, lädt Next die Seite komplett neu, und die kommt dann aus dem Cache.
  if (req.mode === 'navigate' || req.destination === 'image') {
    event.respondWith(networkFirst(req, event));
  }
});

// Seite + alle darin referenzierten /_next/static-Dateien laden und cachen
async function precachePage(path) {
  const res = await fetch(path, { credentials: 'same-origin', redirect: 'follow' });
  if (!res.ok || res.redirected) return; // ausgeloggt o. Ä. → nichts cachen
  const pages = await caches.open(PAGES);
  await pages.put(new Request(new URL(path, self.location.origin).href), res.clone());
  const html = await res.text();
  const assets = new Set();
  // Klammern erlaubt — Route-Gruppen wie app/(dashboard)/… stehen roh im Pfad
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\<>]+/g)) assets.add(m[0]);
  // Flight-Daten listen Chunks ohne führendes "/_next/"
  for (const m of html.matchAll(/"(static\/(?:chunks|css)\/[^"\\]+)/g)) assets.add('/_next/' + m[1]);
  const statics = await caches.open(STATIC);
  for (const a of assets) {
    if (await statics.match(a)) continue;
    try {
      const r = await fetch(a);
      if (r.ok) await statics.put(a, r);
    } catch { /* offline zwischendurch → nächstes Mal */ }
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'precache' && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        for (const u of data.urls) {
          try { await precachePage(u); } catch { /* weiter */ }
        }
        await trimStatic();
      })()
    );
  } else if (data.type === 'clear') {
    event.waitUntil(caches.delete(PAGES));
  }
});
