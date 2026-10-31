// The Pit (act-pit-fight) stands on open ground (pure, no browser): node tests/test-pit-unit.mjs
// v7.5.20: the old start (Flats-local [-36,-18]) sat inside a plain dome, half a metre from BAY SIX DENTAL, with the hauler
// parked in the ring. The fight ring is radius 6 round the midpoint of two fighters 3.2 m apart, so the start needs ~8 m of
// clear ground to buildings and ~12 m to parked vehicles.
import fs from 'fs';
import { DISTRICT_DATA } from '../citydata.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const root = new URL('..', import.meta.url), read = f => fs.readFileSync(new URL(f, root), 'utf8');
const pack = JSON.parse(read('activities/side-activities.json')), pit = pack.activities.find(a => a.id === 'act-pit-fight');
const P = pit.location.at_local, RING = 6, HALF = 1.6, CLEAR = RING + HALF + 0.4, VEH = RING + HALF * 2 + 2.5;
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const boxD = (p, [x, z, w, dd]) => Math.hypot(Math.max(0, Math.abs(p[0] - x) - w / 2), Math.max(0, Math.abs(p[1] - z) - dd / 2));
const nums = s => JSON.parse(s.replace(/\s/g, ''));

// city.js patches over the read-only pack: the dome it drops and the vehicle it moves
const city = read('city.js');
const PIT_LOCAL = nums(city.match(/export const PIT_LOCAL = (\[[^\]]+\])/)[1]);
const DROPPED = nums(city.match(/export const DROPPED_DOMES = \{ rough: (\[\[[^;]+\]\]) \}/)[1]);
const MOVED = Object.fromEntries([...city.match(/export const MOVED_VEHICLES = \{ rough: \{([^}]+)\} \}/)[1].matchAll(/'(-?[\d.]+,-?[\d.]+)': (\[[^\]]+\])/g)].map(m => [m[1], nums(m[2])]));
const R = DISTRICT_DATA.rough;
const domes = R.domes.filter(dm => !DROPPED.some(([x, z]) => dm[0] === x && dm[1] === z));
const vehicles = R.vehicles.map(v => [v[0], ...(MOVED[v[1] + ',' + v[2]] || [v[1], v[2]])]);
const slots = (R.spawns.vehicle_slots || []).map(([x, z]) => MOVED[x + ',' + z] || [x, z]);

ok('pack start = city.js PIT_LOCAL', d(P, PIT_LOCAL) < 0.01, JSON.stringify([P, PIT_LOCAL]));
ok('goto step points at the start', d(pit.loop.steps_template[0].at_local, P) < 0.01);
ok('pit is on the flat district disc (r1 58)', Math.hypot(...P) + RING < 58, Math.hypot(...P));
ok('the plain west dome [-36,-18,7] is gone', !domes.some(dm => dm[0] === -36 && dm[1] === -18) && domes.length === R.domes.length - 1);
ok('only an unsigned dome was dropped', R.domes.filter(dm => !domes.includes(dm)).every(dm => !dm[3]));
for (const dm of domes) ok(`clear of dome ${dm[3] || dm.slice(0, 3)}`, d(P, dm) - dm[2] > CLEAR, (d(P, dm) - dm[2]).toFixed(1));
for (const dm of domes) ok(`clear of dome airlock ${dm[3] || dm.slice(0, 3)}`, boxD(P, [dm[0], dm[1] + dm[2] + 0.6, 3, 2.2]) > CLEAR);
// every block that ends up in Red Tape Flats: the pack, marsshops (rtf), the Flats interiors and the grime shanties
const blocks = R.blocks.map(b => [b.slice(0, 4), b[5] || 'block']);
const shops = read('marsshops.js'), S0 = shops.indexOf('const SHOPS = {'), rtf = shops.slice(shops.indexOf('  rtf: [', S0), shops.indexOf('  oly: [', S0));
for (const m of rtf.matchAll(/sign: '([^']+)'[^\n]*?at: (\[[^\]]+\])/g)) blocks.push([nums(m[2]), m[1]]);
for (const m of read('mars/flats-interiors.js').matchAll(/sign: '([^']+)'[^\n]*?at: (\[[^\]]+\])/g)) blocks.push([nums(m[2]), m[1]]);
const grime = read('mars/grime.js');
for (const s of nums(grime.match(/shanties: (\[\[[^\n]+\]\]),/)[1])) blocks.push([s, 'shanty ' + s.slice(0, 2)]);
ok('found the shop, interior and shanty blocks', blocks.length >= R.blocks.length + 4 + 4 + 5, blocks.length);
ok('BAY SIX DENTAL is among them', blocks.some(b => b[1] === 'BAY SIX DENTAL'));
for (const [b, name] of blocks) ok(`clear of block ${name}`, boxD(P, b) > CLEAR, boxD(P, b).toFixed(1));
ok('clear of the Rust Pit cage (AJ [-292,-68], r 6.4)', d(P, [-292 + 280, -68 + 40]) - 6.4 > CLEAR);
for (const v of vehicles) ok(`parked ${v[0]} outside the ring`, d(P, v.slice(1)) > VEH, d(P, v.slice(1)).toFixed(1));
for (const s of slots) ok(`vehicle slot ${s} outside the ring`, d(P, s) > VEH, d(P, s).toFixed(1));
ok('the hauler no longer parks at [-46,-16]', !vehicles.some(v => v[1] === -46 && v[2] === -16) && !slots.some(s => s[0] === -46 && s[1] === -16));
for (const c of R.crates) ok(`crate ${c} outside the ring`, d(P, c) > RING + HALF, d(P, c).toFixed(1));
for (const [k, pts] of Object.entries({ fast: [R.spawns.player_fast_travel], gang: R.spawns.gang_spawn, contact: Object.values(R.spawns.contact_defaults) }))
  for (const p of pts) ok(`${k} ${p} outside the ring`, d(P, p) > RING + HALF, d(P, p).toFixed(1));
for (const l of [[36, -34, 10]]) ok('clear of the dealership lot', d(P, l) - l[2] > CLEAR);
// grime keeps its junk, camps and hulks off the ring
const keep = nums(grime.match(/keepClear: \{ 'mars-rough': (\[\[[^\]]+\]\]) \}/)[1]);
ok('grime keeps the Pit clear', keep.some(k => d(k, P) < 0.01 && k[2] >= RING + HALF + 1));
// the water tower the board, hints and onboarding promise stands next to the ring, not in it
const tower = nums(read('mars/dress.js').match(/export const PIT_TOWER = (\[[^\]]+\])/)[1]);
ok('water tower stands outside the ring', d(P, tower) - 3 > RING + HALF, d(P, tower).toFixed(1));
ok('water tower is close enough to say "under the water tower"', d(P, tower) < 16, d(P, tower).toFixed(1));
for (const [b, name] of blocks) ok(`water tower clear of ${name}`, boxD(tower, b) > 3.5);
ok('onboard fallback = pack at_aj', read('onboard.js').includes(`aj([${pit.location.at_aj[0]}, ${pit.location.at_aj[1]}], '📋 The Pit')`));
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
