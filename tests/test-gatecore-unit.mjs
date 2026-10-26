// v7.5.3 checkpoint hits (Blue Lights gate 4/8): segHit counts fast / airborne passes on xz (gate placement: racecore.clearGates). node tests/test-gatecore-unit.mjs
import assert from 'node:assert/strict';
import { segHit, CP_RADIUS } from '../gatecore.js';
// segHit: a 40 m ramp jump straight over the gate counts; one that passes 20 m wide doesn't; first frame = radius check
assert.equal(segHit({ x: 0, z: 10 }, { x: 0, z: -40 }, { x: 0, z: 0 }, CP_RADIUS), true);
assert.equal(segHit({ x: 20, z: 10 }, { x: 20, z: -40 }, { x: 0, z: 0 }, CP_RADIUS), false);
assert.equal(segHit(null, { x: 3, z: 3 }, { x: 0, z: 0 }, CP_RADIUS), true);
assert.equal(segHit({ x: 5, z: 5 }, { x: 5, z: 5 }, { x: 0, z: 0 }, CP_RADIUS), true);
assert.ok(CP_RADIUS >= 9);
console.log('gatecore: PASS');
