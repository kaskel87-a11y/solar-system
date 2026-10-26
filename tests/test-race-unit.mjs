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
// race fix: barrier slide (BUGS-v7.4 M2): project onto the barrier tangent, push out, keep speed
{
  const B = { t: 'barrier', x: 0, z: 0, yaw: 0 }; // long axis = x, normal = -z (along = -dz)
  const hd = y => [-Math.sin(y), -Math.cos(y)];
  ok('slide: no contact far away', RC.barrierSlide({ x: 0, z: 10, yaw: 0, speed: 20 }, B, 1.8) === null);
  ok('slide: no contact past the end', RC.barrierSlide({ x: 5.2, z: 0.5, yaw: 0, speed: 20 }, B, 1.8) === null);
  // car on the +z side (along < 0) heading -z (into it) at 30 deg off the normal, going +x-ish
  const c = { x: 0, z: 2.0, yaw: -Math.PI / 6, speed: 20 }; // heading = (sin30, -cos30) = (+0.5, -0.87)
  const s1 = RC.barrierSlide(c, B, 1.8);
  ok('slide: hit flagged', s1 && s1.hit, JSON.stringify(s1));
  ok('slide: pushed out past contact + eps', s1.z >= 0.42 + 1.8 + 0.049, s1.z);
  ok('slide: speed kept (not zeroed or reversed)', s1.speed > 20 * 0.5 * 0.89 && s1.speed <= 20, s1.speed);
  const [hx, hz] = hd(s1.yaw);
  ok('slide: heading turned onto the tangent', Math.abs(hz) < 1e-9 && hx > 0.99, `${hx},${hz}`);
  ok('slide: tangent speed = |v|sin(30) x keep', Math.abs(s1.speed - 20 * 0.5 * 0.9) < 1e-9, s1.speed);
  // reversing into it keeps reversing (speed sign kept)
  const r1 = RC.barrierSlide({ x: 0, z: 2.0, yaw: Math.PI - Math.PI / 6, speed: -12 }, B, 1.8);
  ok('slide: reverse stays reverse', r1.hit && r1.speed < 0 && Math.abs(hd(r1.yaw)[1]) < 1e-9, JSON.stringify(r1));
  // moving away: push-out only, untouched velocity
  const a1 = RC.barrierSlide({ x: 0, z: 2.0, yaw: Math.PI, speed: 15 }, B, 1.8);
  ok('slide: moving away untouched', !a1.hit && a1.speed === 15 && a1.yaw === Math.PI && a1.z > 2.2);
  // head-on: slides toward the nearer end at >= 35% x keep, never zero
  const h1 = RC.barrierSlide({ x: 1.2, z: 2.0, yaw: 0, speed: 25 }, B, 1.8);
  ok('slide: head-on slides toward nearer end', h1.hit && h1.speed > 25 * 0.3 && hd(h1.yaw)[0] > 0.99, JSON.stringify(h1));
  const h2 = RC.barrierSlide({ x: -1.2, z: 2.0, yaw: 0, speed: 25 }, B, 1.8);
  ok('slide: head-on (other end)', h2.hit && hd(h2.yaw)[0] < -0.99);
  // end cap: approaching the short end pushes out along the long axis, not through the barrier
  const e1 = RC.barrierSlide({ x: 4.5, z: 0.1, yaw: Math.PI / 2, speed: 10 }, B, 1.8); // heading -x into the end
  ok('slide: end cap push along long axis', e1 && e1.x >= 3 + 1.8 && Math.abs(e1.z - 0.1) < 1e-9, JSON.stringify(e1));
  // on foot (no speed): push-out only
  const p1 = RC.barrierSlide({ x: 0.5, z: 0.3 }, B, 0.45);
  ok('slide: person pushed out', p1 && p1.z >= 0.87 && !p1.hit);
  // rotated barrier: same result in its own frame
  const yawB = 0.9, Bq = { t: 'barrier', x: 50, z: 139, yaw: yawB }, fx = -Math.sin(yawB), fz = -Math.cos(yawB);
  const q = RC.barrierSlide({ x: 50 + fx * 2, z: 139 + fz * 2, yaw: yawB + Math.PI - Math.PI / 6, speed: 20 }, Bq, 1.8);
  ok('slide: rotated barrier', q.hit && Math.abs(q.speed - 9) < 1e-9 && ((q.x - 50) * fx + (q.z - 139) * fz) >= 2.27, JSON.stringify(q));
  // simulation: a car held into the barrier at 30 deg scrapes along and clears the end instead of pinning
  const sim = (car, props, secs, steer) => { let minSp = Infinity, stuck = 0, dt = 1 / 60; for (let i = 0; i < secs * 60; i++) {
    if (steer) steer(car, dt); const [x, z] = hd(car.yaw); car.x += x * car.speed * dt; car.z += z * car.speed * dt;
    for (const p of props) { const r = RC.barrierSlide(car, p, 1.8); if (r) Object.assign(car, { x: r.x, z: r.z, yaw: r.yaw, speed: r.speed }); }
    car.speed += (22 - car.speed) * 0.9 * dt; minSp = Math.min(minSp, Math.abs(car.speed)); } return { minSp }; };
  const cs = { x: -2, z: 4, yaw: -Math.PI / 6, speed: 22 }; const rs = sim(cs, [B], 2);
  ok('slide sim: clears the barrier end', cs.x > 3 + 1.8 && rs.minSp > 5, JSON.stringify({ cs, rs }));
  // Gutter Sprint chicane: chase gates 3 -> 4 -> 5 with a rate-limited steer; must reach gate 5 within 8 s
  const gut = RC.resolveTrack(RC.PRESETS.find(p => p.id === 'mars-gutter'), { x: 0, z: 0 }), bars = gut.props.filter(p => p.t === 'barrier');
  for (const [lane, off] of [['center', 0], ['left', -4], ['right', 4]]) {
    const g3 = gut.gates[2], g4 = gut.gates[3], g5 = gut.gates[4], car = { x: g3.x + off, z: g3.z, yaw: RC.yawOf(g4.x - g3.x, g4.z - g3.z), speed: 22 };
    let tgt = 3, t = 0, done = false; const dt = 1 / 60;
    while (t < 8 && !done) { t += dt; const g = gut.gates[tgt]; const [x, z] = hd(car.yaw);
      const want = RC.yawOf(g.x - car.x, g.z - car.z); let d = want - car.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); car.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, d));
      car.x += x * car.speed * dt; car.z += z * car.speed * dt;
      for (const p of bars) { const r = RC.barrierSlide(car, p, 1.8); if (r) Object.assign(car, { x: r.x, z: r.z, yaw: r.yaw, speed: r.speed }); }
      car.speed += (22 - car.speed) * 0.9 * dt;
      if (Math.hypot(car.x - g.x, car.z - g.z) < 7) { if (tgt === 4) done = true; else tgt = 4; } }
    ok(`chicane sim (${lane}): reaches gate 5`, done, JSON.stringify({ t: t.toFixed(2), car }));
  }
}
// race fix: race props as camera blockers (BUGS-v7.4 M1)
{
  const B = { t: 'barrier', x: 0, z: 0, yaw: 0 }, Rp = { t: 'ramp', x: 0, z: 0, yaw: 0 };
  ok('cam: inside barrier', RC.propCamHit(B, 1, 0.8, 0.1, 0));
  ok('cam: above barrier clear', !RC.propCamHit(B, 1, 2.0, 0.1, 0));
  ok('cam: beside barrier clear', !RC.propCamHit(B, 1, 0.8, 1.2, 0));
  ok('cam: past barrier end clear', !RC.propCamHit(B, 3.6, 0.8, 0, 0));
  ok('cam: padded thickness >= boom step', RC.propCamHit(B, 0, 0.5, 0.8, 0)); // 14-step boom marches ~1.2 m
  ok('cam: ramp low end clear above lip', !RC.propCamHit(Rp, 0, 0.8, 3.9, -0.15)); // low end is local +z
  ok('cam: ramp high end blocks', RC.propCamHit(Rp, 0, 1.6, -3.5, -0.15));
  ok('cam: boost pads never block', !RC.propCamHit({ t: 'boost', x: 0, z: 0, yaw: 0 }, 0, 0.1, 0, 0));
  const yawB = 1.5, Bq = { t: 'barrier', x: 20, z: 155, yaw: yawB }; // long axis (cos, -sin)
  ok('cam: rotated barrier along its length', RC.propCamHit(Bq, 20 + Math.cos(yawB) * 2.5, 0.5, 155 - Math.sin(yawB) * 2.5, 0));
  ok('cam: rotated barrier off its side', !RC.propCamHit(Bq, 20 - Math.sin(yawB) * 1.5, 0.5, 155 - Math.cos(yawB) * 1.5, 0));
}
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
    ok(`${q.id} moved gates stay close`, t.gates.every(g => !g.moved || Math.hypot(g.x - g.moved.x, g.z - g.moved.z) < 40)); }
  const fixed = RC.resolveTrack(bl, col, blocked); ok('blue lights gate 4 nudged to the inside of the turn', fixed.gates[3].moved && fixed.gates[3].x > 0 && fixed.gates[3].z > raw.gates[3].z, JSON.stringify(fixed.gates[3]));
  ok('clear gates untouched', fixed.gates[1].x === raw.gates[1].x && fixed.gates[1].z === raw.gates[1].z);
  // gate passing is 2D: the same move counts whatever the car's height (airborne off a ramp)
  ok('crossing is 2D', RC.crossedGate({ x: 0, z: 0, yaw: 0 }, { x: 1, z: 6, y: 9 }, { x: 1, z: -6, y: 9 }));
}

console.log(fails ? `\n${fails}/${n} FAILED` : `\nall ${n} passed`); process.exit(fails ? 1 : 0);
