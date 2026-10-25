// Solar System Explorer service worker (v7.3+).
// The version comes from the registration URL (sw.js?v=7.4), the same number as the ?v cache bust on the modules,
// so every release installs a fresh worker, gets fresh cache names and deletes the old caches.
const V = new URL(self.location).searchParams.get('v') || 'dev';
// BUILD bumps on same-version hotfixes so the worker reinstalls and the old caches are dropped
const BUILD = 1;
const SHELL = `ssx-shell-${V}.${BUILD}`, ASSETS = `ssx-assets-${V}`;
const q = `?v=${V}`;
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest',
  `surface.js${q}`, `models.js${q}`, `game.js${q}`, `world.js${q}`, `audio7.js${q}`, `interiors.js${q}`, `missions-data.js${q}`,
  `race.js${q}`, `racecore.js${q}`, `trackbuilder.js${q}`, `racehooks.js${q}`, `storymars.js${q}`,
  ...['index', 'hooks', 'vehicles', 'referrals', 'venus', 'mercury', 'titan', 'europa', 'io'].map(n => `planets/${n}.js${q}`),
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
  // game code (our own .js modules + manifest): network first, cache as the offline fallback, so fixes land even without a ?v bump
  if ((url.pathname.endsWith('.js') && !url.pathname.includes('/vendor/')) || url.pathname.endsWith('.webmanifest')) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)); } return r; }).catch(() => caches.match(req)));
    return;
  }
  // three.js, textures, icons: cache first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (url.pathname.includes('/textures/') || url.pathname.includes('/vendor/') || url.pathname.includes('/icons/') || url.search.includes('v=') || url.pathname.endsWith('.webmanifest'))) {
      const cp = r.clone(); caches.open(url.pathname.includes('/textures/') ? ASSETS : SHELL).then(c => c.put(req, cp));
    }
    return r;
  })));
});
