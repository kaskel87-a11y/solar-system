// node tests/test-base-unit.mjs : pure rules in basecore.js (grid, placement, caps, colliders, save migration)
import * as B from '../basecore.js';
let fails = 0; const ok = (name, c) => { if (!c) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); };
const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, m }; };
ok('3 plots, unique ids', B.PLOTS.length === 3 && new Set(B.PLOTS.map(p => p.id)).size === 3);
ok('5 piece types', ['wall', 'gate', 'garage', 'stash', 'turret'].every(t => B.PIECES[t]));
const s = B.freshSave(), A = s.plots['aj-east'];
ok('unowned refuses', !B.canPlace(A, 'wall', 0, 0, 0).ok);
A.owned = true;
ok('wall ok', B.canPlace(A, 'wall', 0, 0, 0, { credits: 100 }).ok);
ok('afford', B.canPlace(A, 'turret', 0, 0, 0, { credits: 10 }).why.startsWith('Short'));
ok('off grid', !B.canPlace(A, 'wall', 10, 0, 0).ok && !B.canPlace(A, 'wall', -1, 0, 0).ok);
ok('garage footprint rotates', B.footprint('garage', 0).join() === '2,3' && B.footprint('garage', 1).join() === '3,2');
ok('garage at edge r0 fails r1 ok', !B.canPlace(A, 'garage', 0, 8, 0).ok && B.canPlace(A, 'garage', 0, 8, 1).ok);
const w = B.addPiece(A, 'wall', 4, 4, 0);
ok('overlap blocked', B.canPlace(A, 'stash', 4, 4, 0).why.includes('already'));
ok('garage overlapping blocked', !B.canPlace(A, 'garage', 3, 3, 0).ok);
B.addPiece(A, 'stash', 0, 0, 0); ok('stash cap 1', B.canPlace(A, 'stash', 9, 9, 0).why.startsWith('Max'));
ok('pieceAt', B.pieceAt(A, 4, 4)?.id === w.id && B.pieceAt(A, 5, 5) === null);
ok('refund 50%', B.refundOf(w) === 30);
// colliders rotate: wall r0 is wide along x, r1 along z
const c0 = B.collidersOf({ type: 'wall', i: 4, j: 4, r: 0 })[0], c1 = B.collidersOf({ type: 'wall', i: 4, j: 4, r: 1 })[0];
ok('wall collider rotates', (c0.x1 - c0.x0) > (c0.z1 - c0.z0) && (c1.z1 - c1.z0) > (c1.x1 - c1.x0));
const pc = B.pieceCentre(w); const po = B.pushOut(A, pc.x, pc.z + 0.3, 0.45);
ok('pushOut moves you off a wall', po && Math.abs(po.z - pc.z) >= 0.25 + 0.45 - 1e-6);
ok('gate passable at centre', B.pushOut({ pieces: [{ type: 'gate', i: 2, j: 2, r: 0 }] }, B.pieceCentre({ type: 'gate', i: 2, j: 2, r: 0 }).x, B.pieceCentre({ type: 'gate', i: 2, j: 2, r: 0 }).z, 0.45) === null);
ok('rotXZ matches THREE (r1: +z -> +x)', B.rotXZ(0, 1, 1).join() === '1,0' && B.rotXZ(1, 0, 1).join() === '0,-1');
ok('snap centres the footprint', JSON.stringify(B.snap('wall', 0, 0.1, 0.1)) === '{"i":5,"j":5}' && JSON.stringify(B.snap('garage', 0, 0, 0)) === '{"i":4,"j":4}');
ok('pickTarget nearest in range', B.pickTarget(0, 0, [{ x: 40, z: 0 }, { x: 10, z: 0 }, { x: 5, z: 3 }]).x === 5 && B.pickTarget(0, 0, [{ x: 40, z: 0 }]) === null);
// save / load / migrate
A.stash.credits = 250; const ls = mem(); B.save(ls, s); const L = B.load(ls);
ok('roundtrip', L.plots['aj-east'].owned && L.plots['aj-east'].pieces.length === 2 && L.plots['aj-east'].stash.credits === 250 && L.plots['aj-east'].nextId === A.nextId);
ok('corrupt -> fresh', !B.load({ getItem: () => '{bad' }).plots['aj-east'].owned);
const m = B.migrate({ plots: { 'aj-east': { owned: true, pieces: [{ type: 'wall', i: 1, j: 1, r: 5, id: 3 }, { type: 'wall', i: 1, j: 1, r: 0, id: 4 }, { type: 'nuke', i: 2, j: 2 }, { type: 'turret', i: 99, j: 0 }], stash: { credits: -5 } }, bogus: {} } });
ok('migrate drops overlap/unknown/off-grid, clamps', m.plots['aj-east'].pieces.length === 1 && m.plots['aj-east'].pieces[0].r === 1 && m.plots['aj-east'].stash.credits === 0 && m.plots['aj-east'].nextId === 4 && !m.plots.bogus);
const cap = B.freshSave().plots['aj-east']; cap.owned = true; let n = 0; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (B.canPlace(cap, 'wall', i, j, 0).ok) { B.addPiece(cap, 'wall', i, j, 0); n++; }
ok('wall cap', n === B.PIECES.wall.max);
console.log(fails ? `FAIL ${fails}` : 'PASS unit'); process.exit(fails ? 1 : 0);
