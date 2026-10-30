// Add-on marker coords (pure, no browser): node tests/test-coords-unit.mjs
// Pack coords are Ares Junction (colony)-relative; the runner must convert before comparing with world x/z.
import fs from 'fs';
import { toAJ, toWorld } from '../activities/coords.js';
import { AMBIENCE_CONFIG } from '../ambience.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const root = new URL('..', import.meta.url);
const pack = JSON.parse(fs.readFileSync(new URL('activities/side-activities.json', root)));
const flats = AMBIENCE_CONFIG.zones.find(z => z.id === 'red-tape-flats');
const pit = pack.activities.find(a => a.id === 'act-pit-fight');
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

ok('pit is in the Flats (AJ-relative)', d(pit.location.at_aj, flats.centre) < flats.r, d(pit.location.at_aj, flats.centre));
ok('pit at_aj = Flats centre + at_local', d(pit.location.at_aj, [flats.centre[0] + pit.location.at_local[0], flats.centre[1] + pit.location.at_local[1]]) < 0.01);
// Mars colony sits 200 m from the landing site (world.js COLONIES Ares Junction d:200), so world != AJ-relative
for (const col of [{ x: 0, z: -200 }, { x: 137.5, z: -42 }]) {
  const w = toWorld(pit.location.at_aj, col), flatsW = toWorld(flats.centre, col);
  ok(`pit world pos lands in the Flats (colony ${col.x},${col.z})`, Math.hypot(w.x - flatsW.x, w.z - flatsW.z) < flats.r);
  const back = toAJ(w.x, w.z, col);
  ok('toAJ(toWorld(p)) round-trips', d([back.x, back.z], pit.location.at_aj) < 1e-9);
  ok('raw at_aj used as world is far from the Flats (the old bug)', Math.hypot(pit.location.at_aj[0] - flatsW.x, pit.location.at_aj[1] - flatsW.z) > flats.r);
}
ok('no colony -> null (never fall back to raw coords)', toWorld([1, 2], null) === null && toAJ(1, 2, null) === null);
// every activity with both frames agrees with its district centre
const CENTRE = { 'mars-downtown': [0, -430], 'mars-rough': [-280, -40], 'mars-gated': [320, 80], 'mars-highway': [0, -200] };
for (const a of pack.activities) { const L = a.location, k = L?.district || a.district; if (!L?.at_aj || !L?.at_local || !CENTRE[k]) continue;
  ok(`${a.id} at_aj = centre + at_local`, d(L.at_aj, [CENTRE[k][0] + L.at_local[0], CENTRE[k][1] + L.at_local[1]]) < 0.01, JSON.stringify(L)); }
// runner: start points / warps go through the colony conversion
const src = fs.readFileSync(new URL('activities/runner.js', root), 'utf8');
ok('runner imports coords.js', /from '\.\/coords\.js'/.test(src));
ok('runner never warps to raw at_aj', !/debugMove\?\.\(at\[0\]/.test(src));
ok('runner never measures raw player x against at_aj', !/(ctx|C)\??\.(car|player)\??\.x\b[^\n]*\n[^\n]*Math\.hypot\(at\[0\]/.test(src) && /ajHere\(ctx\)/.test(src));
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
