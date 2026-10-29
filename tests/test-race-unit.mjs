// Race core unit tests (pure logic, no browser): node tests/test-race-unit.mjs
import * as RC from '../racecore.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, m }; };

// presets
ok('presets', RC.PRESETS.length >= 3 && RC.PRESETS.every(p => p.gates.length >= RC.MIN_GATES && p.name && p.world && p.rival));
ok('mars presets', RC.PRESETS.filter(p => p.world === 'Mars').length >= 2);
for (const p of RC.PRESETS) { const t = RC.resolveTrack(p, { x: 0, z: -200 }); ok(`${p.id} length ${Math.round(t.length)}`, t.length > 200 && t.length < 1200); ok(`${p.id} gates spaced`, t.gates.every((g, i) => i === 0 || Math.hypot(g.x - t.gates[i - 1].x, g.z - t.gates[i - 1].z) > 25)); }
// colony anchor offset
const rb = RC.resolveTrack(RC.PRESETS[0], { x: 10, z: -200 }); ok('anchor offset', rb.gates[0].x === RC.PRESETS[0].gates[0][0] + 10 && rb.gates[0].z === RC.PRESETS[0].gates[0][1] - 200);
// v7 quest race steps become sprints
const QUESTS = [{ id: 'mars-race', world: 'Mars', title: 'Dust Run', contact: 'Mags', steps: [{ type: 'talk' }, { type: 'race', limit: 60, pts: [[0, 0], [40, 0], [40, 40], [0, 40]] }] }, { id: 'x', world: 'Mars', steps: [{ type: 'race', pts: [[0, 0]] }] }];
const qs = RC.questSprints(QUESTS); ok('quest sprints', qs.length === 1 && qs[0].id === 'q-mars-race' && qs[0].par === 49 && qs.every(q => q.loop === false && q.id.startsWith('q-') && q.gates.length >= 3), JSON.stringify(qs.map(q => q.id)));
// orientation: gates face the next gate
const sq = RC.orientGates([{ x: 0, z: 0 }, { x: 0, z: -50 }, { x: 50, z: -50 }, { x: 50, z: 0 }], true);
ok('yaw of north', Math.abs(RC.yawOf(0, -1)) < 1e-9); ok('yaw of east', Math.abs(RC.yawOf(1, 0) + Math.PI / 2) < 1e-9);
// gate crossing
const g = { x: 0, z: 0, yaw: 0 }; // faces -z
ok('cross through', RC.crossedGate(g, { x: 2, z: 5 }, { x: 2, z: -5 }));
ok('cross backwards counts too', RC.crossedGate(g, { x: 2, z: -5 }, { x: 2, z: 5 }));
ok('miss outside pylons', !RC.crossedGate(g, { x: 12, z: 5 }, { x: 12, z: -5 }));
ok('no cross same side', !RC.crossedGate(g, { x: 0, z: 9 }, { x: 0, z: 4 }));
ok('near centre counts', RC.crossedGate(g, { x: 0, z: 8 }, { x: 1, z: 2.5 }));
// start grid sits behind gate 0
const t = RC.resolveTrack({ gates: [[0, 0], [0, -60], [60, -60], [60, 0]], loop: true, laps: 2 });
const sg = RC.startGrid(t, 7); ok('grid behind', Math.hypot(sg.x - t.gates[0].x, sg.z - t.gates[0].z) > 6.9 && Math.abs(sg.yaw - t.gates[0].yaw) < 1e-9);
ok('length', Math.abs(t.length - 240) < 1e-6);
// path passes through every gate, gateS increasing
const path = RC.buildPath(t); ok('path total', path.total > 230 && path.total < 300, path.total);
ok('gateS monotonic', path.gateS.every((s, i) => i === 0 || s > path.gateS[i - 1]));
ok('path hits gates', path.gateS.every((s, i) => { const p = RC.pathAt(path, s); return Math.hypot(p.x - t.gates[i].x, p.z - t.gates[i].z) < 0.5; }));
ok('path wraps', Math.hypot(RC.pathAt(path, path.total + 1).x - RC.pathAt(path, 1).x, 0) < 0.01);
// progress comparable between player and rival
const rp = RC.rivalProgress(t, path, path.gateS[2] + 1), pp = RC.playerProgress(t, 0, 3, 2, { x: t.gates[2].x, z: t.gates[2].z - 1 });
ok('progress match', Math.abs(rp - pp) < 0.2, `${rp} ${pp}`);
ok('rival lap progress', Math.abs(RC.rivalProgress(t, path, path.total + 0.01) - 4) < 0.05);
const sp = RC.resolveTrack({ gates: [[0, 0], [0, -60], [60, -60]], loop: false }); const sPath = RC.buildPath(sp);
ok('sprint rival finish', Math.abs(RC.rivalProgress(sp, sPath, sPath.total) - 3) < 0.05 || RC.rivalProgress(sp, sPath, sPath.total) >= 2.99);
// payout
ok('win pays purse', RC.payout({ purse: 150, length: 700, gates: [1, 2, 3] }, { won: true }).credits === 150);
ok('lose pays nothing', RC.payout({ purse: 150, length: 700, gates: [1, 2, 3] }, { won: false }).credits === 0);
ok('first win bonus', RC.payout({ purse: 150, length: 700, gates: [1, 2, 3] }, { won: true, firstWin: true }).credits === 250);
ok('short custom = practice', RC.payout({ length: 100, gates: [1, 2, 3], loop: true, laps: 2 }, { won: true, custom: true }).credits === 0);
ok('custom capped', RC.payout({ length: 5000, gates: [1, 2, 3], loop: true, laps: 3 }, { won: true, custom: true }).credits === 100);
// storage + custom tracks
const ls = mem(); const d = RC.loadRace(ls); ok('empty load', d.tracks.length === 0 && typeof d.best === 'object');
const c = RC.cleanTrack({ id: 'c1', name: 'x'.repeat(40), world: 'Mars', gates: [{ x: 1.234, z: 2.345 }, { x: 50, z: 0 }, { x: 50, z: 50 }], props: [{ t: 'ramp', x: 3, z: 4, yaw: 1.23456 }], laps: 99 });
ok('clean', c.name.length === 28 && c.laps === 9 && c.gates[0].x === 1.2 && c.props[0].yaw === 1.23 && RC.validTrack(c));
ok('invalid prop rejected', !RC.validTrack({ ...c, props: [{ t: 'nuke', x: 0, z: 0 }] }));
ok('invalid gate rejected', !RC.validTrack({ ...c, gates: [{ x: NaN, z: 0 }, { x: 1, z: 1 }] }));
d.tracks.push(c); d.best.c1 = 12345; RC.saveRace(ls, d); const d2 = RC.loadRace(ls); ok('roundtrip', d2.tracks[0].id === 'c1' && d2.best.c1 === 12345);
ls.setItem(RC.RACE_KEY, '{broken'); ok('corrupt storage tolerated', RC.loadRace(ls).tracks.length === 0);
ok('full storage tolerated', RC.saveRace({ setItem() { throw new Error('quota'); } }, d) === false);
// ghost
const gh = RC.packGhost([[0, 0, 0, 0], [100, 10, 0, 0.5], [200, 20, 0, 1]]); const ga = RC.ghostAt(gh, 150);
ok('ghost interp', Math.abs(ga.x - 15) < 1e-6 && Math.abs(ga.yaw - 0.75) < 1e-6 && !ga.done); ok('ghost end', RC.ghostAt(gh, 999).done);
// format
ok('fmt', RC.fmtTime(83456) === '1:23.45' && RC.fmtTime(NaN) === '--:--.--');
// v7.5.3: gates inside a footprint move to the nearest clear spot (Blue Lights gate 4 was the Olympus Row dome centre)
{
  const { CITY_MISSIONS, DISTRICT_DATA } = await import('../citydata.js');
  const ORIGIN = { downtown: [0, -430], rough: [-280, -40], gated: [320, 80] }, col = { x: 0, z: -200 }, solids = [];
  for (const [k, D] of Object.entries(DISTRICT_DATA)) { const X = col.x + ORIGIN[k][0], Z = col.z + ORIGIN[k][1];
    for (const d of D.domes) solids.push({ x: X + d[0], z: Z + d[1], r: d[2] + 0.3 });
    for (const b of D.blocks) solids.push({ x: X + b[0], z: Z + b[1], box: [b[2] / 2 + 0.4, b[3] / 2 + 0.4] }); }
  const blocked = RC.footprintBlocked(solids), qs = RC.questSprints(CITY_MISSIONS.map(m => ({ id: m.id, world: m.world, title: m.title, contact: m.giver, steps: m.steps })));
  const bl = qs.find(q => q.id === 'q-vale-03-beltway'); ok('blue lights sprint', !!bl && bl.gates.length === 8);
  const raw = RC.resolveTrack(bl, col); ok('before: gate 4 inside Olympus Row dome', blocked(raw.gates[3].x, raw.gates[3].z));
  for (const q of qs) { const t = RC.resolveTrack(q, col, blocked);
    ok(`${q.id} every gate clear of footprints`, t.gates.every(g => !blocked(g.x, g.z, RC.GATE_CLEAR - 0.01)), JSON.stringify(t.gates.map(g => [g.x, g.z])));
    ok(`${q.id} moved gates stay close`, t.gates.every(g => !g.moved || Math.hypot(g.x - g.moved.x, g.z - g.moved.z) < 60)); }
  // v7.5.4 (Blue Lights P2 stuck at Gate 4/8 on v7.5.3.1): gate 4 was nudged only 4 m clear, into a pocket between two domes
  // with an arch leg inside the Olympus Row dome and no straight run in or out. Moved gates now keep the whole 14 m opening
  // clear and a car-wide straight lane from the gate before and to the gate after.
  for (const q of qs) { const t = RC.resolveTrack(q, col, blocked), g = t.gates, bad = [];
    g.forEach((p, i) => { if (!p.moved) return; const lx = Math.cos(p.yaw), lz = -Math.sin(p.yaw);
      if (blocked(p.x, p.z, RC.GATE_ROOM - 0.01)) bad.push(`${i + 1}:room`);
      if (blocked(p.x + lx * 7, p.z + lz * 7) || blocked(p.x - lx * 7, p.z - lz * 7)) bad.push(`${i + 1}:arch`);
      if (i > 0 && !RC.laneClear(g[i - 1], p, blocked)) bad.push(`${i}->${i + 1}:lane`);
      if (i < g.length - 1 && !RC.laneClear(p, g[i + 1], blocked)) bad.push(`${i + 1}->${i + 2}:lane`); });
    ok(`${q.id} moved gates roomy, arch clear, straight lanes`, !bad.length, bad.join(' ')); }
  { const t = RC.resolveTrack(bl, col, blocked), g = t.gates;
    ok('blue lights gate 3 -> 4 -> 5 drivable straight', RC.laneClear(g[2], g[3], blocked) && RC.laneClear(g[3], g[4], blocked), JSON.stringify(g[3])); }
  ok('laneClear sees a dome', !RC.laneClear({ x: -40, z: -630 }, { x: 40, z: -630 }, blocked) && RC.laneClear({ x: -40, z: -560 }, { x: 40, z: -560 }, blocked));
  const fixed = RC.resolveTrack(bl, col, blocked); ok('blue lights gate 4 nudged to the inside of the turn', fixed.gates[3].moved && fixed.gates[3].x > 0 && fixed.gates[3].z > raw.gates[3].z, JSON.stringify(fixed.gates[3]));
  ok('clear gates untouched', fixed.gates[1].x === raw.gates[1].x && fixed.gates[1].z === raw.gates[1].z);
  // gate passing is 2D: the same move counts whatever the car's height (airborne off a ramp)
  ok('crossing is 2D', RC.crossedGate({ x: 0, z: 0, yaw: 0 }, { x: 1, z: 6, y: 9 }, { x: 1, z: -6, y: 9 }));
}

console.log(fails ? `\n${fails}/${n} FAILED` : `\nall ${n} passed`); process.exit(fails ? 1 : 0);
