// node tests/test-base-collider-unit.mjs : ride push-out next to farm racks (basecore pushOut with `from`) + unregistering a lot
import * as B from '../basecore.js';
let fails = 0; const ok = (name, c, info) => { if (!c) { fails++; console.log('FAIL', name, info !== undefined ? JSON.stringify(info) : ''); } else console.log('ok  ', name); };
// the farm's rack (mars/farm.js) and its home-lot slots (mars/farmcore.js LOT.rackSlots), filled from the path outward
B.addPieceType({ id: 'farm-rack', name: 'Hydro rack', icon: '🪴', cost: 1, fp: [1, 2], max: 6, colliders: [[0, 0, 0.8, 1.7]] });
const SLOTS = [[3, 7], [6, 7], [2, 7], [7, 7], [1, 7], [8, 7]], RAD = 2, STEP = 0.3; // harvester: min(2, spec.r 3.0); ~18 m/s at 60 fps
const lot = n => { const s = { owned: true, pieces: [], nextId: 1 }; for (const [i, j] of SLOTS.slice(0, n)) B.addPiece(s, 'farm-rack', i, j, 0); return s; };
const first = lot(1).pieces[0], c = B.pieceCentre(first), box = B.collidersOf(first)[0]; // x -3.8..-2.2, z 4.3..7.7
// spawn 3.3 m off the rack (as PR #95's harvester test does, 4.3 m in z), then drive straight at it for 40 frames
const SIDES = { west: [-3.3, 0, 1, 0], east: [3.3, 0, -1, 0], north: [0, -4.3, 0, 1], south: [0, 4.3, 0, -1] };
function drive(s, side) {
  const [ox, oz, dx, dz] = SIDES[side]; let x = c.x + ox, z = c.z + oz, maxPush = 0, crossed = false;
  const o0 = B.pushOut(s, x, z, RAD, { x, z }); if (o0) { maxPush = Math.hypot(o0.x - x, o0.z - z); x = o0.x; z = o0.z; } // spawned there: last frame = now
  const spawn = { x, z };
  for (let t = 0; t < 40; t++) { const from = { x, z }; x += dx * STEP; z += dz * STEP; const o = B.pushOut(s, x, z, RAD, from);
    if (o) { maxPush = Math.max(maxPush, Math.hypot(o.x - x, o.z - z)); x = o.x; z = o.z; }
    if ((side === 'west' && x > c.x) || (side === 'east' && x < c.x) || (side === 'north' && z > c.z) || (side === 'south' && z < c.z)) crossed = true; }
  return { x, z, maxPush, crossed, spawn };
}
for (const n of [1, 6]) for (const side of Object.keys(SIDES)) {
  const r = drive(lot(n), side), tag = `${n} rack${n > 1 ? 's' : ''} ${side}`;
  ok(`${tag}: stays on the ${side} side`, !r.crossed && (side === 'west' ? r.x < box.x0 : side === 'east' ? r.x > box.x1 : side === 'north' ? r.z < box.z0 : r.z > box.z1), r);
  ok(`${tag}: small push (never more than one frame of driving)`, r.maxPush <= STEP + 1e-6, r);
  ok(`${tag}: not shoved off its spawn spot`, Math.hypot(r.spawn.x - (c.x + SIDES[side][0]), r.spawn.z - (c.z + SIDES[side][1])) < 1e-6, r);
}
// a lone rack: driving in stops at the face (circle touching), from every side
for (const side of Object.keys(SIDES)) { const r = drive(lot(1), side), gap = side === 'west' ? box.x0 - r.x : side === 'east' ? r.x - box.x1 : side === 'north' ? box.z0 - r.z : r.z - box.z1;
  ok(`lone rack ${side}: stops touching the face`, Math.abs(gap - RAD) < 1e-6, { gap }); }
// the bug: the old push (no `from`) moved a harvester parked 3.3 m west of the first rack of a full lot 3.5 m further west
{ const s = lot(6), x = c.x - 3.3, z = c.z, old = B.pushOut(s, x, z, RAD), now = B.pushOut(s, x, z, RAD, { x, z });
  ok('old push still there for callers without from (3.5 m west)', old && Math.abs(old.x - x + 3.5) < 1e-6, old);
  ok('with from: parked harvester left where it is', now === null, now); }
// from far away (teleport, > TELEPORT m) counts as a spawn; from just outside a corner picks the side it was further out on
{ const s = lot(1), x = box.x0 - 1.5, z = c.z; ok('teleport onto a rack edge: no shove', B.pushOut(s, x, z, RAD, { x: x - 50, z }) === null);
  const o = B.pushOut(s, box.x0 - 1.8, box.z0 - 0.5, RAD, { x: box.x0 - 2.3, z: box.z0 - 0.6 }); ok('corner: pushed back west', o && o.x < box.x0 - 1.8 && Math.abs(o.z - (box.z0 - 0.5)) < 1e-9, o); }
// player (no from): unchanged full push-out
{ const s = lot(1), o = B.pushOut(s, c.x - 0.5, c.z, 0.45); ok('player inside a rack: out by the nearest face', o && Math.abs(o.x - (box.x0 - 0.45)) < 1e-6, o); }

// every farm lot (ben/base-collider-fix): the homestead + its two touching extra lots (mars/farmcore.js ANNEXES: [0,-20], [20,-20]),
// six racks each, driven through pushOutLots in world metres like base.js does. The regression: driving east into the westernmost
// rack of the north-east lot (x 23, z 12 in the game) started on the north lot's ground, so only that lot's pieces were checked
// and the ride went straight through. Every rack, every side, at 0.3 / 1 / 2.5 / 4 m a frame (15 m/s boost: 0.25 m at 60 fps, 3.75 m at the 0.25 s frame cap).
{ const LOTS = [[0, 0], [0, -20], [20, -20]].map(([x, z]) => ({ state: lot(6), x, z }));
  const racks = []; LOTS.forEach((L, n) => L.state.pieces.forEach(p => { const b = B.collidersOf(p)[0]; racks.push({ lot: n, b: { x0: b.x0 + L.x, x1: b.x1 + L.x, z0: b.z0 + L.z, z1: b.z1 + L.z }, c: { x: B.pieceCentre(p).x + L.x, z: B.pieceCentre(p).z + L.z } }); }));
  const touch = (b, x, z) => { const qx = Math.max(b.x0, Math.min(x, b.x1)), qz = Math.max(b.z0, Math.min(z, b.z1)); return Math.hypot(x - qx, z - qz); };
  const D = { west: [-3.4, 0, 1, 0], east: [3.4, 0, -1, 0], north: [0, -4.3, 0, 1], south: [0, 4.3, 0, -1] };
  let worst = null, n = 0, failsHere = 0;
  for (const r of racks) for (const [side, [ox, oz, dx, dz]] of Object.entries(D)) for (const step of [0.3, 1, 2.5, 4]) {
    const sx = r.c.x + ox, sz = r.c.z + oz; let x = sx, z = sz; const o0 = B.pushOutLots(LOTS, x, z, RAD, { x, z }); const spawnShift = o0 ? Math.hypot(o0.x - x, o0.z - z) : 0; if (o0) { x = o0.x; z = o0.z; }
    const gap0 = touch(r.b, x, z); let maxPush = 0, crossed = false, minGap = gap0;
    for (let t = 0; t < Math.ceil(12 / step); t++) { const from = { x, z, jump: Math.max(B.TELEPORT, step * 2 + 1) }; x += dx * step; z += dz * step;
      const o = B.pushOutLots(LOTS, x, z, RAD, from); if (o) { maxPush = Math.max(maxPush, Math.hypot(o.x - x, o.z - z)); x = o.x; z = o.z; }
      if (dx ? (x - r.c.x) * Math.sign(ox) < 0 : (z - r.c.z) * Math.sign(oz) < 0) crossed = true; minGap = Math.min(minGap, touch(r.b, x, z)); }
    n++; const okk = !crossed && spawnShift < 1e-6 && maxPush <= step + 1e-6 && minGap >= Math.min(gap0, RAD) - 1e-6;
    if (!okk) { failsHere++; worst ||= { lot: r.lot, rack: [+r.c.x.toFixed(1), +r.c.z.toFixed(1)], side, step, crossed, spawnShift, maxPush, gap0, minGap, end: [x, z] }; } }
  ok(`all lots, every rack, 4 sides, 4 speeds (${n} drives): never through, never shoved`, failsHere === 0, worst);
  // the exact report: lot 2's westernmost rack (local slot 1,7 = 13, -14 here; x 23, z 12 in the game), driven east from 3.4 m west
  const r = racks.filter(q => q.lot === 2).sort((u, v) => u.c.x - v.c.x)[0]; ok('north-east lot westernmost rack is at local (13, -14)', r.c.x === 13 && r.c.z === -14, r.c);
  for (const step of [0.3, 1, 2.5, 4]) { let x = r.c.x - 3.4, z = r.c.z; for (let t = 0; t < 20; t++) { const from = { x, z, jump: 6 }; x += step; const o = B.pushOutLots(LOTS, x, z, RAD, from); if (o) { x = o.x; z = o.z; } }
    ok(`exact case @${step} m/frame: stopped west of the rack`, x <= r.b.x0 - RAD + 1e-6 || (touch(r.b, x, z) >= RAD - 1e-6 && x < r.c.x), { x, z }); }
  // only the lot under you (the #98 bug): that north lot alone lets it through
  { let x = r.c.x - 3.4, z = r.c.z; for (let t = 0; t < 20; t++) { const from = { x, z }; x += 0.3; const o = B.pushOutLots([LOTS[1]], x, z, RAD, from); if (o) { x = o.x; z = o.z; } }
    ok('north lot alone does not stop it (why every lot must count)', x > r.c.x, x); }
  // one long frame straight through a lone rack: stopped on the near side, where it first touched
  { const s = lot(1), L = [{ state: s, x: 0, z: 0 }], x0 = box.x0 - RAD - 0.5, o = B.pushOutLots(L, box.x1 + RAD + 0.5, c.z, RAD, { x: x0, z: c.z, jump: 10 });
    ok('tunnel through in one frame: stopped at first touch', o && Math.abs(o.x - (box.x0 - RAD)) < 1e-3 && Math.abs(o.z - c.z) < 1e-9, o); }
  // on foot (no from): unchanged
  ok('on foot: same as pushOut', JSON.stringify(B.pushOutLots([{ state: lot(1), x: 0, z: 0 }], c.x - 0.5, c.z, 0.45)) === JSON.stringify(B.pushOut(lot(1), c.x - 0.5, c.z, 0.45)));
  ok('unowned lot ignored', B.pushOutLots([{ state: { ...lot(1), owned: false }, x: 0, z: 0 }], c.x, c.z, RAD, { x: c.x - 0.3, z: c.z }) === null);
}

// unregistering a lot (SSX.base.unregisterPlot -> basecore removePlot)
{ const n0 = B.PLOTS.length; ok('add annex lot', B.addPlot({ id: 'farm-annex-1', name: 'Annex', at: [10, 20], price: 0 }).ok && B.PLOTS.length === n0 + 1);
  const r = B.removePlot('farm-annex-1'); ok('removePlot drops it', r.ok && r.id === 'farm-annex-1' && !B.plotById('farm-annex-1') && B.PLOTS.length === n0, r);
  ok('removePlot twice: refused, no throw', !B.removePlot('farm-annex-1').ok);
  ok('built-in lot refused', !B.removePlot('aj-north').ok && !!B.plotById('aj-north'));
  ok('bad ids refused', !B.removePlot().ok && !B.removePlot('').ok && !B.removePlot(5).ok);
  ok('re-register after remove', B.addPlot({ id: 'farm-annex-1', at: [10, 20] }).ok && !!B.plotById('farm-annex-1') && B.removePlot('farm-annex-1').ok);
  // its save entry: kept by migrate while it has pieces (comes back on re-register), dropped once empty and unowned
  const s = B.migrate({ v: 1, plots: { 'farm-annex-1': { owned: true, pieces: [{ id: 1, type: 'farm-rack', i: 3, j: 7, r: 0 }], nextId: 2 } } });
  ok('save kept while unregistered', s.plots['farm-annex-1']?.pieces?.length === 1);
  const e = B.migrate({ v: 1, plots: { 'farm-annex-1': { owned: false, pieces: [], nextId: 1 } } }); ok('empty unowned entry dropped', !e.plots['farm-annex-1']); }
console.log(fails ? `FAIL ${fails}` : 'PASS collider unit'); process.exit(fails ? 1 : 0);
