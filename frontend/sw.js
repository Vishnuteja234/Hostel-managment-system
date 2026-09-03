// HostelEats Service Worker — v3
const CACHE    = 'hosteleats-v3';
const OFFLINE  = '/offline.html';

// Files to cache on install (app shell)
const PRECACHE = [
  '/',
  '/index.html',
  '/pages/student.html',
  '/pages/admin.html',
  '/pages/scanner.html',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/admin.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/student.js',
  '/js/admin.js',
  '/offline.html',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap',
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE).catch(e => console.warn('SW precache partial:', e)))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ───────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls — network only, never cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ success: false, message: 'You are offline. Please reconnect.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // QR images (data: URLs are never fetched via SW, this is a fallback)
  // HTML pages — network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => { const clone = res.clone(); caches.open(CACHE).then(c => c.put(request, clone)); return res; })
        .catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE)))
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
