// Solar System Explorer service worker (v7.2+).
// The version comes from the registration URL (sw.js?v=7.2), the same number as the ?v cache bust on the modules,
// so every release installs a fresh worker, gets fresh cache names and deletes the old caches.
const V = new URL(self.location).searchParams.get('v') || 'dev';
const SHELL = `ssx-shell-${V}`, ASSETS = `ssx-assets-${V}`;
const q = `?v=${V}`;
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest',
  `surface.js${q}`, `models.js${q}`, `game.js${q}`, `world.js${q}`, `audio7.js${q}`,
  'vendor/three/build/three.module.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'textures/2k_stars_milky_way.jpg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ssx-') && k !== SHELL && k !== ASSETS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  // the page itself: network first so a new release (new ?v imports) always lands; cache only when offline
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put('index.html', cp)); } return r; })
      .catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  if (url.pathname.endsWith('/sw.js')) return;
  // versioned modules, three.js, textures, icons: cache first (the ?v in the URL changes every release)
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (url.pathname.includes('/textures/') || url.pathname.includes('/vendor/') || url.pathname.includes('/icons/') || url.search.includes('v=') || url.pathname.endsWith('.webmanifest'))) {
      const cp = r.clone(); caches.open(url.pathname.includes('/textures/') ? ASSETS : SHELL).then(c => c.put(req, cp));
    }
    return r;
  })));
});
