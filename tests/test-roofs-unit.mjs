// Live fix unit tests: height-aware world.collide + roof ground (fly over buildings, land on roofs).
// node tests/test-roofs-unit.mjs
// world.js pulls in three, so this runs the shipped collide()/roofGround() source from world.js on fake solids.
import { readFileSync } from 'node:fs';
import * as ROOF from '../roofs.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const src = readFileSync(new URL('../world.js', import.meta.url), 'utf8');
const a = src.indexOf('  function collide('), b = src.indexOf('  function solidAt(');
ok('collide + roofGround source found', a > 0 && b > a);
const terrain = (x, z) => 10 + x * 0.01; // gently sloped ground at ~10 m
const solids = [], vehicles = [];
const mk = new Function('ROOF', 'solids', 'vehicles', 'height', 'C', src.slice(a, b) + '\nreturn { collide, roofGround };');
const W = mk(ROOF, solids, vehicles, terrain, { name: 'test colony' });
// a 10 m block (box 6x4 half-extents) at (0,0); top = terrain(0,0) + 10 + 0.3 cap = 20.3
const block = { x: 0, z: 0, r: 7, h: 10, box: [6, 4] }; solids.push(block);
const dome = { x: 60, z: 0, r: 12.3, h: 9.6 };  // R=12 dome, as world.js pushes them
const barrier = { x: -40, z: 0, r: 1, h: 0.9 }; solids.push(dome, barrier);
const car = (x, z, y, extra = {}) => ({ x, z, y, spec: { r: 2.4 }, ...extra });
const R = 2.4 * 0.75;

ok('block top derived from terrain + h + cap', Math.abs(ROOF.topOf(block, terrain) - 20.3) < 1e-9);
ok('explicit s.top wins', ROOF.topOf({ x: 0, z: 0, h: 3, top: 42 }, terrain) === 42);
// ground cars still hit walls
let c = car(-7.5, 0, 10); ok('ground car hits block wall', !!W.collide(-7.5, 0, R, c));
ok('person (no vehicle) still 2-D', !!W.collide(-6.2, 0, 0.45) && !!W.collide(-6.2, 0, 0.45, null, undefined));
ok('exit probe 0.45 stays 2-D even with a car as skip', !!W.collide(-6.2, 0, 0.45, car(0, 0, 50)));
ok('car below the roof (mid-wall) hits', !!W.collide(-7, 0, R, car(-7, 0, 18)));
// flying over
ok('car above the roof passes', W.collide(-7, 0, R, car(-7, 0, 21)) === null);
ok('car just at roof level (within CLEAR) passes', W.collide(0, 0, R, car(0, 0, 20.3 - 0.5)) === null);
ok('explicit yb arg works', W.collide(0, 0, R, null, 25) === null && !!W.collide(0, 0, R, null, 12));
// roof ground
let f = car(0, 0, 21), gnd = W.roofGround(f);
ok('ground over the roof = roof top', Math.abs(gnd(0, 0) - 20.3) < 1e-9, gnd(0, 0));
ok('ground under a car below the roof = terrain', Math.abs(W.roofGround(car(-20, 0, 10))(-20, 0) - 10 + 0.2) < 1e-9);
ok('roof support covers the collision pad (edge overhang)', Math.abs(gnd(6 + R - 0.05, 0) - 20.3) < 1e-9 && Math.abs(gnd(6 + R + 0.05, 0) - terrain(6 + R + 0.05, 0)) < 1e-9);
// invariant: anywhere the car overlaps the block, it either collides or is supported at/above its bottom - CLEAR
let bad = 0;
for (let y = 9; y <= 24; y += 0.25) for (let x = -10; x <= 10; x += 0.5) {
  const v = car(x, 1, y), hit = W.collide(x, 1, R, v), g = W.roofGround(v)(x, 1);
  if (!hit && ROOF.overlaps(block, x, 1, R) && g < ROOF.topOf(block) - 1e-9) bad++;
}
ok('no overlap without support (cannot drop into a building)', bad === 0, bad);
// dome: ground cars bump the rim, flying cars clear it, a car can rest on the glass
ok('ground car hits dome rim', !!W.collide(60 - 12.3 - R + 0.2, 0, R, car(60 - 14, 0, terrain(46, 0))));
ok('car above dome apex passes', W.collide(60, 0, R, car(60, 0, 10 + 0.6 + 9.6 + 2)) === null);
const dg = W.roofGround(car(60, 0, 25))(60, 0);
ok('dome apex ground ~ base + h + r/2', dg > 10.6 + 9.6 && dg < 10.6 + 9.6 + R, dg);
const dg2 = W.roofGround(car(66, 0, 25))(66, 0);
ok('dome surface falls off toward the rim', dg2 < dg && dg2 > 10.6 + 0.9, dg2);
bad = 0;
for (let y = 9; y <= 24; y += 0.25) for (let x = 44; x <= 76; x += 0.5) {
  const v = car(x, 0, y), hit = W.collide(x, 0, R, v), g = W.roofGround(v)(x, 0);
  if (!hit && ROOF.overlaps(dome, x, 0, R) && g + ROOF.CLEAR < y - 50) bad++; // collision implies no support needed
  if (!hit && ROOF.overlaps(dome, x, 0, R) && g <= terrain(x, 0) + 1e-9) bad++;
}
ok('dome: overlap without support never happens', bad === 0, bad);
// small barrier: hop over it
ok('ground car hits barrier', !!W.collide(-40 + 1 + R - 0.1, 0, R, car(-37, 0, terrain(-37, 0))));
ok('car 1.5 m up clears barrier', W.collide(-40, 0, R, car(-40, 0, terrain(-40, 0) + 1.5)) === null);
// parked vehicles
const parked = { x: 20, z: 20, y: terrain(20, 20), parked: true, spec: { r: 2.4 } }; vehicles.push(parked);
ok('ground car hits a parked car', !!W.collide(21, 20, R, car(21, 20, terrain(21, 20))));
ok('flying car clears a parked car', W.collide(20, 20, R, car(20, 20, terrain(20, 20) + 3)) === null);
ok('can land on a parked car roof', Math.abs(W.roofGround(car(20, 20, terrain(20, 20) + 3))(20, 20) - ROOF.carTop(parked)) < 1e-9);
ok('the car itself is never its own roof', W.roofGround(parked)(20, 20) === terrain(20, 20));
// ground-velocity reset when the support changes (no launch when stepping onto a roof)
const s = car(0, 0, 20.5, { prevG: 10 }); const gs = W.roofGround(s); const g0 = gs(s.x, s.z);
ok('prevG reset on stepping onto a roof', s.prevG === g0 && s.roofSrc === block);
const s2 = car(0, 0, 20.5, { prevG: 10, roofSrc: block }); W.roofGround(s2)(s2.x, s2.z); ok('prevG untouched while on the same roof', s2.prevG === 10);
// off-colony: roofGround falls back to terrain
const W0 = mk(ROOF, solids, vehicles, terrain, null); ok('no colony: terrain function', W0.roofGround(car(0, 0, 30)) === terrain);
// ---- PR #44 add-on colliders (SSX.colliders), feature-detected ----
ok('no #44: attachColliders is a no-op', ROOF.attachColliders({}) === null && ROOF.colliderSolids(0, 0, 1).length === 0);
// use #44's real mars/colliders.js when this tree has it (a merge), else a minimal fake with the same API
let API; try { API = (await import('../mars/colliders.js')).default; console.log('     (using mars/colliders.js from #44)'); } catch (e) {
  const by = new Map(); let seq = 0; const pub = s => s.type === 'cyl' ? { id: s.id, type: 'cyl', x: s.x, z: s.z, r: s.r, group: s.group } : { id: s.id, type: 'box', x: s.x, z: s.z, hx: s.hx, hz: s.hz, yaw: s.yaw || 0, group: s.group };
  const ext = s => s.type === 'cyl' ? s.r : Math.hypot(s.hx, s.hz);
  API = { add: sh => { const s = { ...sh, id: sh.id != null ? String(sh.id) : 'col' + (++seq) }; by.set(s.id, s); return s.id; }, remove: id => by.delete(String(id)),
    removeGroup: g => { let k = 0; for (const s of [...by.values()]) if (s.group === g) { by.delete(s.id); k++; } return k; }, clear: () => { by.clear(); return true; },
    list: g => [...by.values()].filter(s => g == null || s.group === g).map(pub), query: (x, z, r = 1) => [...by.values()].filter(s => Math.hypot(x - s.x, z - s.z) < r + ext(s)).map(pub),
    resolve: (x, z, r = 0.45) => { let hit = false; for (const s of by.values()) { if (s.type !== 'box') continue; const dx = x - s.x, dz = z - s.z; if (Math.abs(dx) < s.hx + r && Math.abs(dz) < s.hz + r) { hit = true; if (s.hx + r - Math.abs(dx) < s.hz + r - Math.abs(dz)) x = s.x + Math.sign(dx || 1) * (s.hx + r); else z = s.z + Math.sign(dz || 1) * (s.hz + r); } } return hit ? { x, z } : null; } };
}
const G = { SSX: { colliders: API } };
// one collider registered BEFORE attach (falls back to the default height), the rest after
API.clear?.(); const early = API.add({ type: 'box', x: 200, z: 0, hx: 3, hz: 3, group: 'street' });
ok('attachColliders wraps #44', ROOF.attachColliders(G) === API && API.__roofs === true && ROOF.attachColliders(G) === API);
const tene = API.add({ type: 'box', x: 100, z: 0, hx: 6, hz: 4, h: 9, group: 'street', tag: 'tenement' }); // declared h
const cont = API.add({ type: 'box', x: 130, z: 0, hx: 3, hz: 1.2, yaw: 0.3, group: 'street', tag: 'tag:container' }); // tag height 2.6
const meshObj = { traverse(f) { f({ geometry: { boundingBox: { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } } }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 160, terrain(160, 0) + 3, 0, 1] } }); } };
const meshC = API.add({ type: 'cyl', x: 160, z: 0, r: 1.2, group: 'street', mesh: meshObj }); // mesh bounds: top = ground + 5
const at = (id, x, z) => ROOF.colliderSolids(x, z, 0.1, terrain).find(q => q.col === id);
ok('declared h -> top', Math.abs(ROOF.topOf(at(tene, 100, 0)) - (terrain(100, 0) + 9)) < 1e-9);
ok('tag height -> top', Math.abs(ROOF.topOf(at(cont, 130, 0)) - (terrain(130, 0) + 2.6)) < 1e-9);
ok('mesh bounds -> top', Math.abs(ROOF.topOf(at(meshC, 160, 0)) - (terrain(160, 0) + 5)) < 1e-9);
ok('pre-attach collider gets the default height', Math.abs(ROOF.topOf(at(early, 200, 0)) - (terrain(200, 0) + ROOF.COL_DEF_H)) < 1e-9);
// what world.collide does on the #44 line: setMover(yb) then SSX.colliders.resolve(x, z, r)
const res = (x, z, yb) => { ROOF.setMover(yb, terrain); return API.resolve(x, z, R); };
ok('ground car hits a #44 wall', !!res(93.5, 0, terrain(93.5, 0)));
ok('car below the #44 top hits', !!res(93.5, 0, terrain(93.5, 0) + 7));
ok('car above the #44 top passes', res(93.5, 0, terrain(93.5, 0) + 9.5) === null);
ok('people (no yb) unchanged', !!res(94.2, 0, undefined));
ok('mover is one-shot', !!API.resolve(93.5, 0, R));
ok('rotated #44 box still blocks on the ground', !!res(130, 0, terrain(130, 0)));
ok('rotated #44 box cleared from above', res(130, 0, terrain(130, 0) + 3) === null);
const Wc = mk(ROOF, [], [], terrain, { name: 'flats' });
ok('land on a #44 roof', Math.abs(Wc.roofGround(car(100, 0, terrain(100, 0) + 10))(100, 0) - (terrain(100, 0) + 9)) < 1e-9);
ok('no roof from a #44 collider you are below', Wc.roofGround(car(100, 0, terrain(100, 0) + 2))(100, 0) === terrain(100, 0));
if (src.slice(a, b).includes('SSX?.colliders?.resolve')) { // merged with #44: the real collide() line
  ok('merged collide: ground car hits #44 wall', !!Wc.collide(93.5, 0, R, car(93.5, 0, terrain(93.5, 0))));
  ok('merged collide: flying car passes #44 wall', Wc.collide(93.5, 0, R, car(93.5, 0, terrain(93.5, 0) + 9.5)) === null);
}
API.removeGroup('street'); ok('removeGroup clears tops', ROOF.colliderSolids(100, 0, 1, terrain).length === 0);
globalThis.SSX = undefined;
console.log(`\nroofs: ${n - fails}/${n} passed`); if (fails) process.exit(1);
