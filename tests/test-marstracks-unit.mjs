// Mars street circuits unit tests (pure, no browser): node tests/test-marstracks-unit.mjs
// Checks the five presets against race.js's rules and the city layout (blocks, domes, parked vehicles, crates, lots, the
// Beltway checkpoint booths), the road network + snapping, and the car-meet circuit maths.
import * as RC from '../racecore.js';
import * as MT from '../marstrackcore.js';
import { DISTRICT_DATA, BELTWAY_DATA } from '../citydata.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name, extra); };

// ---------- city obstacles (colony-relative) ----------
// Ares Junction itself (world.js COLONIES.Mars, copied: world.js needs THREE)
const AJ = { domes: [[0, 0, 14], [-22, -16, 8], [24, 6, 9]], blocks: [[31, -17, 9, 5], [-6, 23, 7, 4], [-44, -14, 6, 4], [16, -38, 6, 4], [-30, -36, 12, 7], [6, -28, 7, 4]], pad: [-38, 10, 9],
  vehicles: [['buggy', -14, 30], ['hauler', -50, -24], ['hoverbike', 20, 30], ['shuttle', -38, 10], ['buggy', 42, 12]], crates: [[-31, 16], [-33, 21], [-29, 21], [-46, -4], [36, -9], [12, 30], [-8, -24]] };
const LOTS = { downtown: [[40, 30, 9]], rough: [[36, -34, 10]], gated: [[34, 46, 8]] }; // add-on lots (Pumpkin's dealership/garage/meet pads)
// Jeff's v7.5.3 marsshops.js storefronts, pushed into the district defs as blocks (the bars that re-skin one of Steve's blocks are left out)
const SHOPS = { rough: [[-20, -10, 7, 4], [42, -8, 7, 4], [-6, -24, 6, 4]], downtown: [[-38, -36, 8, 5], [44, -14, 8, 5], [-2, -24, 7, 4]],
  gated: [[24, 4, 8, 5], [14, -34, 8, 5], [-24, 2, 8, 5], [-14, -36, 8, 5]] };
const obs = [];
for (const [key, P, o] of [['aj', AJ, [0, 0]], ...Object.keys(MT.DISTRICTS).filter(k => k !== 'aj').map(k => [k, DISTRICT_DATA[k], MT.DISTRICTS[k].at])]) {
  for (const d of P.domes) obs.push({ c: 1, x: o[0] + d[0], z: o[1] + d[1], r: d[2] + 0.3, what: key + ' dome' });
  for (const b of P.blocks) obs.push({ c: 0, x: o[0] + b[0], z: o[1] + b[1], hx: b[2] / 2 + 0.4, hz: b[3] / 2 + 0.4, what: key + ' block' });
  for (const v of P.vehicles || []) obs.push({ c: 1, x: o[0] + v[1], z: o[1] + v[2], r: 2.5, what: key + ' ' + v[0] });
  for (const c of P.crates || []) obs.push({ c: 1, x: o[0] + c[0] + 0.6, z: o[1] + c[1] + 0.6, r: 1.5, what: key + ' crate' });
  for (const b of SHOPS[key] || []) obs.push({ c: 0, x: o[0] + b[0], z: o[1] + b[1], hx: b[2] / 2 + 0.4, hz: b[3] / 2 + 0.4, what: key + ' shop' });
  for (const l of LOTS[key] || []) obs.push({ c: 1, x: o[0] + l[0], z: o[1] + l[1], r: l[2], what: key + ' lot' });
}
// checkpoint booths (solid) and barriers (visual) beside the Beltway, as world.js places them
const BP = BELTWAY_DATA.polyline, W = (BELTWAY_DATA.width || 10) / 2, CPS = [];
for (const c of BELTWAY_DATA.checkpoints) {
  const [x, z] = c.at; let best = null, bd = 1e9;
  for (let i = 1; i < BP.length; i++) { const a = BP[i - 1], b = BP[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (L * L))), d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z); if (d <= bd) { bd = d; best = [dx / L, dz / L]; } }
  const [fx, fz] = best, rx = -fz, rz = fx; CPS.push({ id: c.id, x, z });
  obs.push({ c: 1, x: x + rx * (W + 2.5), z: z + rz * (W + 2.5), r: 2.0, what: 'booth ' + c.id });
  for (const sd of [-1, 1]) for (const k of [-1, 1]) obs.push({ c: 1, x: x + rx * sd * (W + 0.8) + fx * k * 6, z: z + rz * sd * (W + 0.8) + fz * k * 6, r: 1.8, what: 'barrier ' + c.id });
}
const clear = (x, z) => { let best = { d: 1e9 }; for (const o of obs) { let d; if (o.c) d = Math.hypot(x - o.x, z - o.z) - o.r; else { const ax = Math.abs(x - o.x) - o.hx, az = Math.abs(z - o.z) - o.hz; d = ax < 0 && az < 0 ? -1 : Math.hypot(Math.max(ax, 0), Math.max(az, 0)); } if (d < best.d) best = { d, what: o.what, x: Math.round(x), z: Math.round(z) }; } return best; };

// ---------- presets ----------
ok('five presets', MT.MARS_PRESETS.length === 5);
ok('one per district + beltway', ['aj', 'downtown', 'rough', 'gated', 'highway'].every(d => MT.MARS_PRESETS.some(p => p.district === d)));
ok('unique ids, not clashing with race.js presets', new Set([...MT.MARS_PRESETS, ...RC.PRESETS].map(p => p.id)).size === MT.MARS_PRESETS.length + RC.PRESETS.length);
for (const p of MT.MARS_PRESETS) {
  const t = RC.resolveTrack(p, { x: 0, z: 0 }), path = RC.buildPath(t), why = p.id;
  ok(`${why} race.js shape`, p.world === 'Mars' && p.anchor === 'colony' && p.rival?.name && p.rival?.kind && p.purse > 0 && p.par > 8 && p.blurb && t.gates.length >= RC.MIN_GATES && t.gates.length <= RC.MAX_GATES && (p.props || []).length <= RC.MAX_PROPS);
  ok(`${why} validTrack once saved`, RC.validTrack(RC.cleanTrack({ ...t, id: 'x', name: p.name, world: 'Mars' })));
  const gaps = t.gates.map((g, i) => i ? Math.hypot(g.x - t.gates[i - 1].x, g.z - t.gates[i - 1].z) : Infinity);
  ok(`${why} gates ≥ 14 m apart`, Math.min(...gaps) >= 14, Math.min(...gaps).toFixed(1));
  // whole racing line clears every solid by ≥ 3.5 m (gated: 4 m on the lane between Aurum Armory and the dome; elsewhere 5 m) and every visual barrier by ≥ 0.5 m (checkpoints on the Beltway Run are driven through on purpose)
  let worst = { d: 1e9 }, worstSolid = { d: 1e9 };
  for (const q of path.pts) { const c = clear(q.x, q.z); if (c.d < worst.d && !(p.district === 'highway' && /barrier/.test(c.what))) worst = c; }
  for (const g of t.gates) { const c = clear(g.x, g.z); if (c.d < worstSolid.d) worstSolid = c; }
  ok(`${why} racing line clear`, worst.d >= (p.district === "downtown" || p.district === "highway" ? 3.5 : p.district === "gated" ? 4 : 5), `${worst.d.toFixed(1)} m (${worst.what} @ ${worst.x},${worst.z})`);
  ok(`${why} gates clear`, worstSolid.d >= 5, `${worstSolid.d.toFixed(1)} m (${worstSolid.what})`);
  // circuits stay away from the checkpoints (no tolls mid-race); the Beltway Run goes through the two ColSec ones only
  const cpNear = CPS.filter(c => path.pts.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 10)).map(c => c.id).sort().join(',');
  ok(`${why} checkpoints on route`, p.district === 'highway' ? cpNear === 'cp-east,cp-ridge' : cpNear === '', cpNear || 'none');
  // start line is not on top of race.js's own start arches
  const g0 = t.gates[0]; ok(`${why} own start line`, RC.PRESETS.every(q => { const s = RC.resolveTrack(q, { x: 0, z: 0 }).gates[0]; return q.world !== 'Mars' || Math.hypot(s.x - g0.x, s.z - g0.z) > 30; }));
  // follows the roads: every gate sits on a street centreline or the Beltway
  const net = MT.roadNetwork({ x: 0, z: 0 }, null), bel = []; for (let i = 1; i < BP.length; i++) bel.push({ ax: BP[i - 1][0], az: BP[i - 1][1], bx: BP[i][0], bz: BP[i][1], road: 'beltway' });
  const off = t.gates.map(g => MT.snapPoint([...net, ...bel], g.x, g.z, 999).d); ok(`${why} gates on roads`, Math.max(...off) < 8.5, Math.max(...off).toFixed(1) + ' m max off a centreline');
  ok(`${why} length`, path.total > 200 && path.total < 2000, Math.round(path.total) + ' m/lap, par ' + p.par + ' s, ' + (t.loop ? t.laps + ' laps' : 'sprint'));
}
// ---------- checkpoint sanity: no gate inside a building / interior footprint or off the drivable surface, every gate reachable ----------
{
  const roads = (() => { const n = MT.roadNetwork({ x: 0, z: 0 }, null); for (let i = 1; i < BP.length; i++) n.push({ ax: BP[i - 1][0], az: BP[i - 1][1], bx: BP[i][0], bz: BP[i][1], road: 'beltway' }); return n; })();
  // a footprint (block, dome, parked rover, crate, lot, booth) within 1 m, or more than 8.5 m off every road centreline
  const gateCheck = (x, z) => { const c = clear(x, z); if (c.d < 1) return c.what; const r = MT.snapPoint(roads, x, z, 999); return r.d > 8.5 ? 'offroad' : null; };
  // driving a leg: the car's half-width (1.2 m) off every solid (the Beltway Run drives through its checkpoints' visual barriers on purpose)
  const legCheck = hw => (x, z) => { let best = { d: 1e9 }; for (const o of obs) { if (hw && /barrier/.test(o.what)) continue; let d; if (o.c) d = Math.hypot(x - o.x, z - o.z) - o.r; else { const ax = Math.abs(x - o.x) - o.hx, az = Math.abs(z - o.z) - o.hz; d = ax < 0 && az < 0 ? -1 : Math.hypot(Math.max(ax, 0), Math.max(az, 0)); } if (d < best.d) best = { d, what: o.what }; } return best.d < 1.2 ? best.what : null; };
  for (const p of MT.MARS_PRESETS) {
    const t = RC.resolveTrack(p, { x: 0, z: 0 }), lc = legCheck(p.district === 'highway');
    const badG = t.gates.map((g, i) => [i, MT.gateIssue(g.x, g.z, gateCheck)]).filter(([, w]) => w);
    ok(`${p.id} no gate in a building or off the road`, !badG.length, badG.map(([i, w]) => `#${i} ${w}`).join(', ') || `${t.gates.length} gates`);
    const unreach = []; for (let i = t.loop ? 0 : 1; i < t.gates.length; i++) { const b = MT.legBlock(t.gates, i, lc, t.loop); if (b) unreach.push(`#${(i - 1 + t.gates.length) % t.gates.length}→#${i} ${b.why} @${Math.round(b.x)},${Math.round(b.z)}`); }
    ok(`${p.id} every gate reachable from the one before`, !unreach.length, unreach.join('; ') || `${t.loop ? t.gates.length : t.gates.length - 1} legs`);
    const sz = MT.sanitizeGates(t.gates, gateCheck, roads, { loop: t.loop, legCheck: lc });
    ok(`${p.id} sanitize leaves it alone`, sz.ok && !sz.moved.length && !sz.dropped.length);
  }
  // the Blue Lights bug, replayed on our Precinct Loop: gate 4 dropped inside The Static (Olympus Row block nearest Nyx's door)
  const at = MT.DISTRICTS.downtown.at, st = DISTRICT_DATA.downtown.blocks.map(b => ({ x: at[0] + b[0], z: at[1] + b[1], b })).sort((a, c) => Math.hypot(a.b[0] - 14, a.b[1] - 32) - Math.hypot(c.b[0] - 14, c.b[1] - 32))[0];
  const pre = RC.resolveTrack(MT.MARS_PRESETS.find(p => p.district === 'downtown'), { x: 0, z: 0 }), buried = pre.gates.map((g, i) => i === 4 ? { ...g, x: st.x, z: st.z } : g);
  ok('buried gate detected', MT.gateIssue(st.x, st.z, gateCheck) === 'downtown block', MT.gateIssue(st.x, st.z, gateCheck));
  const fx = MT.sanitizeGates(buried, gateCheck, roads, { loop: true, legCheck: legCheck(false) }), g4 = fx.gates[4];
  ok('buried gate moved onto clear road', fx.moved.length === 1 && fx.moved[0].i === 4 && !MT.gateIssue(g4.x, g4.z, gateCheck) && MT.snapPoint(roads, g4.x, g4.z, 999).d < 0.5, JSON.stringify(fx.moved[0]?.to?.map(Math.round)));
  ok('moved gate reachable both ways', fx.ok && !MT.legBlock(fx.gates, 4, legCheck(false)) && !MT.legBlock(fx.gates, 5, legCheck(false)), JSON.stringify([MT.legBlock(fx.gates, 4, legCheck(false)), MT.legBlock(fx.gates, 5, legCheck(false)), st.b, pre.gates[3], pre.gates[4], pre.gates[5]]));
  // nothing clear within reach: dropped, and too few gates left keeps the original (the caller refuses the track)
  const wall = (x, z) => Math.hypot(x - 500, z - 500) < 40 ? 'building' : null;
  const dz = MT.sanitizeGates([{ x: 0, z: 0 }, { x: 500, z: 500 }, { x: 0, z: 90 }, { x: 90, z: 0 }], wall, [], { loop: true });
  ok('unfixable gate dropped', dz.dropped.length === 1 && dz.gates.length === 3);
  ok('too few gates refused', !MT.sanitizeGates([{ x: 500, z: 500 }, { x: 505, z: 500 }, { x: 0, z: 0 }], wall, []).ok);
  // builder taps: inside a building -> onto the nearest clear road; snap off -> nearby clear ground; nowhere -> rejected
  const tap = MT.snapTap(roads, st.x, st.z, gateCheck, true);
  ok('tap in a building snaps to clear road', tap && !tap.reject && !MT.gateIssue(tap.x, tap.z, gateCheck) && tap.moved, JSON.stringify(tap && { x: Math.round(tap.x), z: Math.round(tap.z), road: tap.road }));
  const free = (x, z) => clear(x, z).d < 1 ? clear(x, z).what : null, off = MT.snapTap(roads, st.x, st.z, free, false);
  ok('snap off: building tap moved to clear ground', off && !off.reject && !free(off.x, off.z) && Math.hypot(off.x - st.x, off.z - st.z) < 13);
  ok('snap off: clear tap kept', MT.snapTap(roads, 0, -300, free, false) === null);
  ok('tap with nowhere clear rejected', MT.snapTap([], 500, 500, wall, false)?.reject === 'building');
}
// district circuits stay in their district
for (const p of MT.MARS_PRESETS.filter(p => MT.DISTRICTS[p.district])) { const o = MT.DISTRICTS[p.district].at; ok(`${p.id} inside ${MT.DISTRICTS[p.district].name}`, p.gates.every(g => Math.hypot(g[0] - o[0], g[1] - o[1]) < 80)); }
// Beltway Run covers the whole loop: passes near every Beltway waypoint district
const belt = MT.MARS_PRESETS.find(p => p.district === 'highway');
ok('beltway visits all four districts', Object.values(MT.DISTRICTS).every(d => belt.gates.some(g => Math.hypot(g[0] - d.at[0], g[1] - d.at[1]) < 80)));

// ---------- snapping ----------
const hw = { len: 0 }; for (let i = 1; i < BP.length; i++) hw.len += Math.hypot(BP[i][0] - BP[i - 1][0], BP[i][1] - BP[i - 1][1]);
hw.at = s => { for (let i = 1; i < BP.length; i++) { const L = Math.hypot(BP[i][0] - BP[i - 1][0], BP[i][1] - BP[i - 1][1]); if (s <= L) return { x: BP[i - 1][0] + (BP[i][0] - BP[i - 1][0]) * s / L, z: BP[i - 1][1] + (BP[i][1] - BP[i - 1][1]) * s / L }; s -= L; } return { x: BP[0][0], z: BP[0][1] }; };
const net = MT.roadNetwork({ x: 10, z: -200 }, { len: hw.len, at: s => { const p = hw.at(s); return { x: p.x + 10, z: p.z - 200 }; } }, [{ x: 10, z: -200, core: 56 }, ...Object.values(MT.DISTRICTS).slice(1).map(d => ({ x: d.at[0] + 10, z: d.at[1] - 200, core: 50 }))]);
ok('network has streets + beltway', net.some(s => s.road === 'beltway') && MT.STREETS.every(st => net.some(s => s.road === st.id)), net.length + ' segments');
ok('no beltway inside cores', net.filter(s => s.road === 'beltway').every(s => Math.hypot(s.ax - 10, s.az + 200) >= 56 - 1e-6));
const sp = MT.snapPoint(net, 10 + 12, -200 - 300); ok('snap onto beltway', sp && sp.road === 'beltway' && Math.abs(sp.x - 10) < 0.5 && Math.abs(sp.d - 12) < 0.5, JSON.stringify(sp));
const sr = MT.snapPoint(net, 10 + 70, -200 + 0); ok('snap onto junction ring', sr && sr.road === 'junction-ring' && sr.d < 10, JSON.stringify(sr));
ok('nothing to snap far out', MT.snapPoint(net, 10 + 600, -200 + 600) === null);
ok('snap radius', MT.snapPoint(net, 10 + 12, -200 - 300, 5) === null);
ok('barriers never snap', !MT.SNAP_TOOLS.barrier && MT.SNAP_TOOLS.gate && MT.SNAP_TOOLS.boost && MT.SNAP_TOOLS.ramp);

// ---------- meet circuits ----------
const car = { name: 'Nix Calder', kind: 'buggy', skill: 1, spec: { vmax: 22, boost: 34, bacc: 18, turn: 1.75 } };
const aj = RC.resolveTrack(MT.MARS_PRESETS[0], { x: 0, z: -200 });
const d0 = MT.meetCircuitDef({ ...aj, id: 'mars-st-junction', name: 'Junction Ring' }, car, 0), d1 = MT.meetCircuitDef({ ...aj, id: 'mars-st-junction', name: 'Junction Ring' }, car, 250);
ok('meet def shape', d0.id === 'meet-c-mars-st-junction' && d0.world === 'Mars' && d0.anchor === 'abs' && d0.loop && d0.laps === 3 && d0.rival.name === 'Nix Calder' && d0.rival.kind === 'buggy' && d0.gates.length === 15);
ok('meet def resolves in place', RC.resolveTrack(d0, { x: 999, z: 999 }).gates[0].x === aj.gates[0].x);
ok('purse = both stakes + 30 + distance', d1.purse - d0.purse === 500 && d0.purse >= 30 && d0.purse <= 180, `${d0.purse} / ${d1.purse}`);
const pace = RC.buildPath(aj).total / d0.par; ok('rival pace in street range', pace > 14 && pace < 20, pace.toFixed(1) + ' m/s');
const fast = MT.meetCircuitDef({ ...aj, id: 'a', name: 'a' }, { ...car, spec: { vmax: 30, boost: 48 } }, 0), slow = MT.meetCircuitDef({ ...aj, id: 'a', name: 'a' }, { ...car, skill: 0.9 }, 0);
ok('faster car, lower par', fast.par < d0.par && slow.par > d0.par);
const bt = RC.resolveTrack(belt, { x: 0, z: -200 }); ok('straighter track, bigger speed share', MT.meetPace(car.spec, bt) > MT.meetPace(car.spec, aj));
const sprint = MT.meetCircuitDef(RC.resolveTrack({ id: 's', name: 'S', world: 'Mars', loop: false, gates: [[0, 0], [0, -200], [100, -300]] }), car, 50); ok('sprint def', !sprint.loop && sprint.laps === 1 && sprint.purse > 130);
ok('circuit rep', MT.circuitRep(true, 100, 2, 3) === 8 + 4 + 4 + 3 && MT.circuitRep(false, 500, 4, 3) === 2);
ok('wagers match the drag', JSON.stringify(MT.MEET_WAGERS) === '[0,50,100,250,500]');

console.log(fails ? `\n${fails}/${n} FAILED` : `\nall ${n} passed`); process.exit(fails ? 1 : 0);
