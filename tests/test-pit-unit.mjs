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

// v7.5.21 the landmark (mars/pitringcore.js): rope ring, sign gantry, mast, crowd. Nothing inside the fight radius, nothing on
// a building, a parked car, the water tower or a painted street, everything on the flat disc.
const K = await import('../mars/pitringcore.js'), MT = await import('../marstrackcore.js');
ok('landmark centre = PIT_LOCAL', d(K.PIT_LOCAL, PIT_LOCAL) < 0.01);
ok('landmark district origin = citydata rough', d(K.FLATS_AJ, MT.DISTRICTS.rough.at) < 0.01);
ok('centreWorld = pack at_aj + colony', (c => Math.abs(c.x - 1000 - pit.location.at_aj[0]) < 0.01 && Math.abs(c.z - 2000 - pit.location.at_aj[1]) < 0.01)(K.centreWorld({ x: 1000, z: 2000 })));
ok('FIGHT_R matches the duel ring', K.FIGHT_R === RING);
ok('ropes stand outside the fight radius', K.ROPE > RING + 0.5 && K.MAT >= K.ROPE + 0.3, K.ROPE);
const FP = K.footprint(), FPp = K.footprint(true), crowd = K.crowdCandidates(), crowdP = K.crowdCandidates(true);
ok('crowd: enough spectators (desktop >= 30, phone >= 20, phone fewer)', crowd.length >= 30 && crowdP.length >= 20 && crowdP.length < crowd.length, `${crowd.length}/${crowdP.length}`);
ok('crowd stands past the corner posts', crowd.every(c => Math.hypot(c.x, c.z) > K.ROPE * Math.SQRT2 + 0.5), Math.min(...crowd.map(c => Math.hypot(c.x, c.z))).toFixed(2));
ok('crowd stays outside the duel watchers (7.4) and the forfeit line (11 m) is reachable through the east gap', crowd.every(c => Math.hypot(c.x, c.z) > 8.5) && !crowd.some(c => Math.abs(Math.atan2(c.z, c.x)) < K.ENTRY.half));
ok('crowd faces the ring', crowd.every(c => { const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw); return (fx * -c.x + fz * -c.z) / Math.hypot(c.x, c.z) > 0.99; }));
ok('crowd layout is deterministic', JSON.stringify(crowd) === JSON.stringify(K.crowdCandidates()));
for (const s of [...FP, ...FPp]) if (Math.hypot(s.x, s.z) - (s.r || 0) <= RING + 0.5) ok(`${s.kind} [${s.x},${s.z}] outside the fight radius`, false);
ok('every prop footprint is outside the fight radius', [...FP, ...FPp].every(s => Math.hypot(s.x, s.z) - (s.r || 0) > RING + 0.5));
ok('overhead rig hangs high over the ring (>= 7 m)', K.RIG_Y >= 7 && K.RIG.every(([x, z]) => Math.hypot(x, z) < RING));
ok('sign is big and high (>= 9 m wide, bottom >= 5 m)', K.SIGN.w >= 9 && K.SIGN.y >= 5 && K.SIGN.text === 'THE PIT');
ok('sign faces east into the Flats', Math.abs(K.SIGN.yaw - Math.PI / 2) < 1e-6 && K.SIGN.at[0] < -10);
ok('minimap icon is the 🥊', K.MINIMAP.icon === '\u{1F94A}');
ok('landmark knows where the water tower stands', d(K.TOWER.at, [tower[0] - P[0], tower[1] - P[1]]) < 0.01);
ok('no spectator in the water tower footprint (dress places it with clear())', [...crowd, ...crowdP].every(c => d([c.x, c.z], K.TOWER.at) > K.TOWER.r + 1));
const solid = FP.filter(s => s.kind !== 'crowd');
const at = s => [P[0] + s.x, P[1] + s.z];
// the crowd is filtered at runtime by world.collide; the static part (posts, sign legs, mast) must be clear outright
for (const s of solid) {
  const p = at(s), nb = Math.min(...blocks.map(([b]) => boxD(p, b))), nv = Math.min(...vehicles.map(v => d(p, v.slice(1)))), ns = Math.min(...slots.map(q => d(p, q)));
  ok(`${s.kind} at [${p.map(v => v.toFixed(1))}] clear of blocks (>1 m), cars (>4 m), the tower`, nb > 1 && nv > 4 && ns > 4 && d(p, tower) > 3.5, `${nb.toFixed(1)} ${nv.toFixed(1)} ${ns.toFixed(1)} ${d(p, tower).toFixed(1)}`);
  ok(`${s.kind} at [${p.map(v => v.toFixed(1))}] clear of domes`, domes.every(dm => d(p, dm) > dm[2] + 1));
}
const live = crowd.filter(c => { const p = at(c); return blocks.every(([b]) => boxD(p, b) > 0.6) && vehicles.every(v => d(p, v.slice(1)) > 3) && d(p, tower) > 3.4 && domes.every(dm => d(p, dm) > dm[2] + 0.6); });
ok('crowd after static blockers still rings the fight (>= 24)', live.length >= 24, live.length);
const street = MT.STREETS.flatMap(st => MT.sampleStreet(st.pts, st.loop, 1)).map(([x, z]) => [x - K.FLATS_AJ[0], z - K.FLATS_AJ[1]]);
const nearRoad = p => Math.min(...street.map(q => d(p, q)));
ok('no prop on a painted street (> half road + 1.5 m)', FP.every(s => nearRoad(at(s)) > MT.ROAD_W / 2 + 1.5), Math.min(...FP.map(s => nearRoad(at(s)))).toFixed(1));
ok('mat on the flat disc', Math.hypot(...P) + K.MAT * Math.SQRT2 < 58);
ok('sign, mast and crowd on the flat disc', FP.every(s => Math.hypot(...at(s)) < 58));
ok('pitring.js + pitringcore.js are precached', /mars\/pitring\.js/.test(read('sw.js')) && /mars\/pitringcore\.js/.test(read('sw.js')));
ok('index.html loads pitring.js', /<script type="module" src="\.\/mars\/pitring\.js/.test(read('index.html')));
ok('minimap draws icon marks (full + lite)', /if \(m\.icon\)/.test(read('index.html')) && /if \(m\.icon\)/.test(read('hud/hudx.js')));
ok('pit fight lines up through the centre (runner arm + world challenge at)', /pitRing\?\.arm\?\./.test(read('activities/runner.js')) && /opts\?\.at/.test(read('world.js')));
const startS = K.startSpot(0, 0, 5, 0); ok('start spot 1.6 m from centre facing in', Math.abs(Math.hypot(startS.x, startS.z) - 1.6) < 1e-9 && Math.abs(-Math.sin(startS.yaw) + 1) < 1e-9);
// same check as test-mission-markers' reach(): a car-sized (r 2) BFS on a 2 m grid from the ring centre gets out past the
// crowd (desktop and phone layouts) using the landmark's own colliders
for (const [tag, fp] of [['desktop', FP], ['phone', FPp]]) {
  const blk = (x, z) => fp.some(s => Math.hypot(x - s.x, z - s.z) < (s.r || 0.35) + 2);
  const q = [[0, 0]], seen = new Set(['0,0']); let out = false;
  for (let h = 0; h < q.length && !out; h++) { const [i, j] = q[h]; if (Math.hypot(i * 2, j * 2) >= 20) { out = true; break; }
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { const k = a + ',' + b; if (seen.has(k)) continue; seen.add(k); if (!blk(a * 2, b * 2)) q.push([a, b]); } }
  ok(`a car-sized path leads out of the ring past the crowd (${tag})`, out);
}
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
