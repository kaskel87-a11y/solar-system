// Halvorsen Villa layout (pure, no browser): node tests/test-villa-unit.mjs
// Walls are solid, doors are the only way in, guards and cameras can't see through walls, heights fit roofs.js (#63).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import * as C from '../mars/villacore.js';
import { villaAt, VILLA_AT } from '../mars/heisttipcore.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const src = f => fs.readFileSync(path.join(root, f), 'utf8');

// ---------- layout ----------
const walls = C.wallBoxes([0, 0], 0);
const shut = [...walls, ...C.DOORS.map(d => C.doorBox(d))];
ok('11 wall runs', walls.length === 11);
ok('4 rooms incl. a vault', C.ROOMS.length === 4 && C.ROOMS.some(r => r.id === 'vault'));
ok('3 doors: front, inner, vault', ['front', 'inner', 'vault'].every(k => C.DOORS.some(d => d.kind === k)));
ok('room lookup', C.roomAt(0, 3) === 'hall' && C.roomAt(-6, 3) === 'bedroom' && C.roomAt(-5, -3) === 'office' && C.roomAt(6, -3) === 'vault' && C.roomAt(0, 9) === null);
ok('safe sits in the vault', C.roomAt(...C.SPOTS.safe) === 'vault');
ok('door ring and power box are outside', !C.insideHouse(...C.SPOTS.door) && !C.insideHouse(...C.SPOTS.power));
for (const c of C.CAMERAS) ok('camera ' + c.id + ' on the layout', Math.abs(c.x) <= C.HALF.x + 1 && Math.abs(c.z) <= C.HALF.z + 1);

// ---------- solid walls ----------
const walk = (boxes, x, z, dx, dz, steps = 200) => { for (let i = 0; i < steps; i++) { x += dx * 0.05; z += dz * 0.05; const p = C.resolve(boxes, x, z, 0.45); if (p) { x = p.x; z = p.z; } } return { x, z }; };
let p = walk(shut, 4, 9, 0, -1); ok('front wall stops you', p.z > 6, JSON.stringify(p));
p = walk(shut, 0, 9, 0, -1); ok('shut front door stops you', p.z > 6, JSON.stringify(p));
p = walk(walls, 0, 9, 0, -1, 120); ok('open front doorway lets you in', p.z < 5 && C.roomAt(p.x, p.z) === 'hall', JSON.stringify(p));
p = walk(shut, 12, 3, -1, 0); ok('side wall stops you', p.x > 9, JSON.stringify(p));
p = walk(walls, 3.5, 2, 0, -1, 80); ok('hall/vault wall stops you', p.z > 0, JSON.stringify(p));
p = walk(walls, 5.5, 2, 0, -1, 80); ok('vault doorway lets you in', C.roomAt(p.x, p.z) === 'vault', JSON.stringify(p));
p = walk(walls, -2, 3, -1, 0, 120); ok('bedroom doorway gap', C.roomAt(p.x, p.z) === 'bedroom', JSON.stringify(p));
ok('a car above the roof passes (height-aware)', C.resolve(walls, 4, 6.2, 1, C.roofTop(0) + 0.1) === null && C.resolve(walls, 4, 6.2, 1, 0.5) !== null);

// ---------- doors ----------
const D = k => C.DOORS.find(d => d.kind === k);
ok('front door locked while casing', !C.doorOpen(D('front'), 'case', 0.5) && !C.doorOpen(D('front'), 'breakin', 0.5) && !C.doorOpen(D('front'), null, 0.5));
ok('front door open after the break-in', C.doorOpen(D('front'), 'crack', 9) && C.doorOpen(D('front'), 'escape', 9));
ok('vault opens on approach once inside', C.doorOpen(D('vault'), 'crack', 2) && !C.doorOpen(D('vault'), 'crack', 5) && !C.doorOpen(D('vault'), 'case', 1));
ok('vault stays open for the getaway', C.doorOpen(D('vault'), 'escape', 20));
ok('inner door opens near you', C.doorOpen(D('inner'), null, 2) && !C.doorOpen(D('inner'), null, 4));

// ---------- line of sight ----------
ok('wall blocks sight', !C.lineClear(walls, 4, 3, 4, 9));
ok('open doorway gives sight', C.lineClear(walls, 0, 3, 0, 9.5));
ok('shut door blocks sight', !C.lineClear(shut, 0, 3, 0, 9.5));
const G0 = C.GUARDS.find(g => g.id === 'hv-guard-hall');
ok('hall guard path stays in the hall', [0, 3, 7, 11, 20, 33].every(t => { const q = C.guardPos(G0, t); return C.roomAt(q.x, q.z) === 'hall'; }));
const Y = C.GUARDS.find(g => g.id === 'hv-guard-yard');
ok('yard guard path stays outside', [0, 5, 17, 29, 41].every(t => { const q = C.guardPos(Y, t); return !C.insideHouse(q.x, q.z); }));
const g = { x: 0, z: 3, fx: 0, fz: 1 };
ok('guard sees you in the hall', C.guardSees(g, 0, 5, walls));
ok('guard cannot see through the wall', !C.guardSees({ x: 4, z: 3, fx: 0, fz: 1 }, 4, 8, walls));
ok('guard cannot see behind', !C.guardSees(g, 0, 0.6, walls));
ok('guard range', !C.guardSees(g, 0, 5 + C.GUARD.range, []));

// ---------- heist def / placement ----------
const def = villaAt(...VILLA_AT);
ok('own layout, not the sample', def.layout === 'halvorsen' && def.sample === false && def.id === 'heist-halvorsen-villa');
ok('colony-relative', def.rel === 'colony' && def.site.x === VILLA_AT[0] && def.door.z === VILLA_AT[1] + C.SPOTS.door[1]);
ok('in Helios Heights (centre 320,80 r 95)', Math.hypot(VILLA_AT[0] - 320, VILLA_AT[1] - 80) < 95 - 12);
ok('3 cameras, 2 guards', def.cameras.length === 3 && def.guards.length === 2);
// villa.js walks its own 2 guards: guards.js must not spawn an armed second set (live v7.5.5 had 4 bodies, shot through walls)
ok('villa owns its guards (ownGuards)', def.ownGuards === true);
ok('guards.js skips def.guards when ownGuards is set', /def\.ownGuards \? \[\] : def\.guards/.test(src('guards.js')));
ok('wall height one floor (~3.5 m) + cap', Math.abs(walls[0].h - (C.FLOOR_H + C.CAP)) < 1e-9 && C.FLOOR_H === 3.5);
ok('roofs.js solid format', walls.every(w => Array.isArray(w.box) && w.box.length === 2 && Number.isFinite(w.top) && w.top === w.y0 + w.h));
ok('colliders.js box format', walls.every(w => w.type === 'box' && w.id && Number.isFinite(w.hx) && Number.isFinite(w.hz)));

// ---------- hooks are guarded ----------
const vs = src('mars/villa.js');
ok('uses SSX.colliders when present', /globalThis\.SSX\?\.colliders/.test(vs) && /group: 'villa'/.test(vs));
ok('uses world.addSolid when present (#63)', /addSolid/.test(vs) && /top: b\.top/.test(vs));
ok('wrap fallback blocks the player', /collidePlayer/.test(vs) && /'wrap'/.test(vs));
const hc = src('heistcore.js');
ok('one guarded camLos hook in heistcore', (hc.match(/camLos/g) || []).length === 2 && /SSX\?\.camLos\?\./.test(hc));
ok('sw.js precaches the villa', /'mars\/villa'/.test(src('sw.js')) && /'mars\/villacore'/.test(src('sw.js')));

console.log(fails ? `\n${fails}/${n} FAILED` : `\nall ${n} passed`);
process.exit(fails ? 1 : 0);
