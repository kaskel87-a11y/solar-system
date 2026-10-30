// Solar System Explorer service worker (v7.3+).
// The version comes from the registration URL (sw.js?v=7.5.4), the same number as the ?v cache bust on the modules,
// so every release installs a fresh worker, gets fresh cache names and deletes the old caches.
const V = new URL(self.location).searchParams.get('v') || 'dev';
// BUILD bumps on same-version hotfixes so the worker reinstalls and the old caches are dropped
const BUILD = 1;
const SHELL = `ssx-shell-${V}.${BUILD}`, ASSETS = `ssx-assets-${V}`;
const q = `?v=${V}`;
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest',
  `surface.js${q}`, `models.js${q}`, `game.js${q}`, `world.js${q}`, `audio7.js${q}`, `interiors.js${q}`, `missions-data.js${q}`,
  `race.js${q}`, `racecore.js${q}`, `trackbuilder.js${q}`, `racehooks.js${q}`, `storymars.js${q}`, `storymars2.js${q}`, `marsshops.js${q}`, ...['dealership', 'garagecore', 'carmeet', 'rides', 'myrides', 'ridepark', 'roofs'].map(n => `${n}.js${q}`), `mars/contraband.js${q}`, `mars/jobs.js${q}`, `mars/pursuit.js${q}`, `mars/turf.js${q}`, `mars/arsenal.js${q}`, `mars/gunsmith.js${q}`, `mars/beltway.js${q}`, ...['director', 'directorcore'].map(n => `modes/${n}.js${q}`), `mars/dress.js${q}`, ...['modes/hook', 'modes/raids', 'modes/rags', 'modes/ragscore', 'modes/ragsrover'].map(n => `${n}.js${q}`), `modes/rags-data.json${q}`, ...['danger', 'dangercore', 'dangerhooks', 'pursuit', 'ambient', 'ambientcore', 'streetdata'].map(n => `${n}.js${q}`), 'data/barter.json', 'data/random-events.json', 'mars/barter.json', ...['heist', 'heistcore', 'safecrack', 'cameras', 'heisthooks', 'controlmode', 'gatecore', 'guards', 'guardcore', 'heistlos'].map(n => `${n}.js${q}`),
  ...['mars-audio', 'radio', 'ambience', 'barks', 'synth'].map(n => `${n}.js${q}`), // Mars city ambience
  ...['grime', 'grime-tex', 'grime-lines', 'grime-street'].map(n => `mars/${n}.js${q}`), // Mars grime pass
  ...['flats-interiors', 'flats-interiors-rooms', 'flats-interiors-tex', 'flats-interiors-lines'].map(n => `mars/${n}.js${q}`), // v7.5 Red Tape Flats interiors
  ...['radio-extra', 'songs', 'pit', 'dust', 'night'].map(n => `${n}.js${q}`), // Mars radio: PIT 66.6, DUST 98.3, MY MUSIC, night mix
  ...['street', 'street-tags', 'street-crowds', 'street-tow', 'street-tex', 'street-lines'].map(n => `mars/${n}.js${q}`), // v7.5 Red Tape Flats street life
  ...['colliders', 'street-blood', 'street-combat', 'street-tweakers', 'street-rant', 'street-night'].map(n => `mars/${n}.js${q}`), // Red Tape Flats colliders, street violence, rockheads, night
  `city.js${q}`, `citydata.js${q}`, `activities/runner.js${q}`, `activities/poker.js${q}`, `activities/poker-eval.js${q}`, `activities/coords.js${q}`, `activities/deadends.js${q}`, 'activities/side-activities.json', // v7.5 Mars city + side activities
  ...['hud/hudx', 'hud/hudmap', 'hud/hints'].map(n => `${n}.js${q}`), // v7.5.5 HUD declutter
  `hud/wpbeam.js${q}`, // v7.5.8 waypoint light beam
  ...['help/stuck', 'help/stuckcore', 'help/foes'].map(n => `${n}.js${q}`), // Stuck? on the mission card + red ◆ over mission foes
  ...['activities/deadends', 'activities/mark', 'activities/markdata', 'activities/pitseries', 'mars/heisttip', 'mars/heisttipcore', 'mars/villa', 'mars/villacore', 'mars/npcslots', 'mars/npcslotscore', 'mars/barcontact', 'mars/barcontactcore'].map(n => `${n}.js${q}`), // runner dead ends, Vale mark, Pit series, first heist + villa + npc slots + bar contact
  ...['scihooks', 'scicore', 'raccoon', 'scientists', 'portals', 'dimensions/index', 'dimensions/automat', 'dimensions/gravbog', 'dimensions/waitroom', 'dimensions/pantry', 'dimensions/lounge'].map(n => `${n}.js${q}`),
  ...['sci2core', 'scientists2', 'dimensions/index2', 'dimensions/orchard', 'dimensions/hum', 'dimensions/pawn', 'dimensions/rehearsal', 'dimensions/gut'].map(n => `${n}.js${q}`), // junkyard lab part 2 (sci-06..10)
  ...['index', 'hooks', 'vehicles', 'referrals', 'venus', 'mercury', 'titan', 'europa', 'io'].map(n => `planets/${n}.js${q}`),
  `mars/rep.js${q}`,
  `mars/bribes.js${q}`,
  ...['base', 'basecore', 'basehooks'].map(n => `${n}.js${q}`),
  `mars/lab.js${q}`,
  ...['time', 'timecore'].map(n => `mars/${n}.js${q}`),
  `mars/fightclub.js${q}`,
  ...['marstracks', 'marstrackcore'].map(n => `${n}.js${q}`),
  `airroll.js${q}`, // phone barrel-roll button
  `mars/gravity.js${q}`, `mars/gravitycore.js${q}`, // Pumpkin: gravity modes for Mars vehicles
  `mars/smuggle.js${q}`, `mars/smugglecore.js${q}`, // ship smuggling runs (Pumpkin)
  `mars/fasttravel.js${q}`, `mars/fasttravelcore.js${q}`, // fast travel on Mars (Pumpkin)
  `mars/skins.js${q}`, `mars/skinscore.js${q}`, // Mars player skins (Pumpkin)
  `mars/jetpack.js${q}`, `mars/jetpackcore.js${q}`, // Mars jetpack (Pumpkin)
  `mars/flame.js${q}`, `mars/flamecore.js${q}`, // 🔥 flamethrower (Steve)
  ...['onboard', 'onboardcore'].map(n => `${n}.js${q}`), // First Day on Mars tour + How to play codex (Ben)
  ...['storm', 'stormcore'].map(n => `mars/${n}.js${q}`), // v7.5.5 Mars dust storms (Ben)
  `mars/raccoonrover.js${q}`, `mars/raccooncore.js${q}`, // Raccoon Rover (Pumpkin)
  `brightness.js${q}`, `brightnesscore.js${q}`, // ☰ → ☀️ Brightness + night floor
  `stormguard.js${q}`, `stormguardcore.js${q}`, // storm perf guard + shader prewarm
  `mars/mouth.js${q}`, `mars/mouthcore.js${q}`, // foul-mouthed Mars locals (Steve)
  'vendor/three/build/three.module.min.js',
  `mars/farm.js${q}`, `mars/farmcore.js${q}`, // Mars farming (SSX.farm)
  `mars/control.js${q}`, `mars/controlcore.js${q}`, // Control's Mars job offers (SSX.control)
  `mars/consequences.js${q}`, // Mars wasted/busted consequences (SSX.consequences)
  `mars/starshop.js${q}`, `mars/starshopcore.js${q}`, // ⭐ Star Shop (SSX.stars / SSX.starshop)
  ...['empire', 'empirecore'].map(n => `${n}.js${q}`), // empire layer (safehouses, fronts, crew raids)
  `clubdancers.js${q}`, `privateshow.js${q}`, `clubprivate.js${q}`, `slots.js${q}`, `phonetexts.js${q}`, ...['loaders/GLTFLoader', 'utils/BufferGeometryUtils', 'utils/SkeletonUtils', 'libs/meshopt_decoder.module'].map(n => `vendor/three/addons/${n}.js`), // club dancers (their GLBs cache on first visit to the club)
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
    if (r.ok && (url.pathname.includes('/textures/') || url.pathname.includes('/assets/') || url.pathname.includes('/vendor/') || url.pathname.includes('/icons/') || url.search.includes('v=') || url.pathname.endsWith('.webmanifest'))) {
      const cp = r.clone(); caches.open(/\/(textures|assets)\//.test(url.pathname) ? ASSETS : SHELL).then(c => c.put(req, cp));
    }
    return r;
  })));
});
