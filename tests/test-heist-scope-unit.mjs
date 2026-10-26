// v7.5.3 regression (CoS review #3): a running heist unlocks only its own target, not every vault and safe.
// node tests/test-heist-scope-unit.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heistCovers, heistFromMansion } from '../heistcore.js';
const voss = heistFromMansion({ title: 'VOSS HOUSE', sign: 'VOSS HOUSE', at: [10, 20], r: 9 }, [300, 80]);
const site = { x: voss.site.x, z: voss.site.z, r: voss.site.r }; // colony == world origin in this test
const doors = { voss: { kind: 'mansion', name: 'Voss House', x: site.x, z: site.z + 11.4 }, sable: { kind: 'mansion', name: 'Sable Annex', x: site.x + 60, z: site.z }, bank: { kind: 'bank', name: 'First Junction Trust', x: -18, z: -400 } };
assert.equal(heistCovers(voss, site, doors.voss, 'mansion', 'Voss House'), true, 'own mansion safe');
assert.equal(heistCovers(voss, site, doors.sable, 'mansion', 'Sable Annex'), false, 'another mansion stays shut');
assert.equal(heistCovers(voss, site, doors.bank, 'bank', 'First Junction Trust'), false, 'the bank vault stays shut');
assert.equal(heistCovers(voss, site, undefined, 'bank', 'Nowhere'), false, 'no door -> false');
assert.equal(heistCovers(voss, null, doors.voss, 'mansion', 'Voss House'), false, 'unresolved site -> false');
assert.equal(heistCovers(voss, site, null), true, 'unscoped query = a heist is running');
const named = { id: 'bank-job', kind: 'bank', name: 'First Junction Trust', site: { x: 0, z: 0, r: 10 } };
assert.equal(heistCovers(named, null, null, 'bank', 'First Junction Trust'), true);
assert.equal(heistCovers(named, null, null, 'mansion', 'Voss House'), false);
assert.equal(heistCovers(null, site, doors.voss, 'mansion', 'Voss House'), false, 'no heist');
const src = readFileSync(new URL('../heist.js', import.meta.url), 'utf8');
assert.ok(/get active\(\)[\s\S]{0,600}heistCovers\(/.test(src), 'SSX.heist.active(kind, name) goes through heistCovers');
console.log('heist scope: PASS (11 checks)');
