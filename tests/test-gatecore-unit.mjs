// v7.5.3 gate guards (Blue Lights gate 4/8): clearGate moves a gate out of a building onto open road; segHit counts
// fast / airborne passes on xz. node tests/test-gatecore-unit.mjs
import assert from 'node:assert/strict';
import { clearGate, segHit, CP_RADIUS } from '../gatecore.js';
const box = { x: 100, z: 100, box: [12, 8] };
const collide = (x, z, r) => { const dx = x - box.x, dz = z - box.z; return Math.abs(dx) < box.box[0] + r && Math.abs(dz) < box.box[1] + r ? { x: box.x + Math.sign(dx || 1) * (box.box[0] + r), z } : null; };
// gate in the open: untouched
assert.deepEqual(clearGate({ x: 0, z: 0 }, { collide }), { x: 0, z: 0, moved: false });
// gate beside (not inside) a building: untouched
assert.equal(clearGate({ x: 100 + 14, z: 100 }, { collide }).moved, false);
// gate inside the footprint: moved, and the new centre is clear with room for the car
const q = clearGate({ x: 101, z: 99 }, { collide }); assert.equal(q.moved, true); assert.equal(collide(q.x, q.z, 6), null); assert.ok(Math.hypot(q.x - 101, q.z - 99) <= 30);
// near the Beltway: snaps to the road point
const hw = { project: (x, z) => ({ s: z, d: Math.abs(x - 60) }), at: s => ({ x: 60, z: s }) };
const r = clearGate({ x: 100, z: 104 }, { collide, highway: () => hw }); assert.deepEqual([r.x, r.z, r.via], [60, 104, 'road']);
// segHit: a 40 m ramp jump straight over the gate counts; one that passes 20 m wide doesn't; first frame = radius check
assert.equal(segHit({ x: 0, z: 10 }, { x: 0, z: -40 }, { x: 0, z: 0 }, CP_RADIUS), true);
assert.equal(segHit({ x: 20, z: 10 }, { x: 20, z: -40 }, { x: 0, z: 0 }, CP_RADIUS), false);
assert.equal(segHit(null, { x: 3, z: 3 }, { x: 0, z: 0 }, CP_RADIUS), true);
assert.equal(segHit({ x: 5, z: 5 }, { x: 5, z: 5 }, { x: 0, z: 0 }, CP_RADIUS), true);
assert.ok(CP_RADIUS >= 9);
console.log('gatecore: PASS');
