// node tests/test-guards-unit.mjs : heist guards (guardcore.js) + line of sight (heistlos.js), pure logic
import assert from 'node:assert/strict';
import * as G from '../guardcore.js';
import * as L from '../heistlos.js';
import * as H from '../heistcore.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const run = (g, A, secs, env = {}) => { const out = []; for (let i = 0; i < secs * 60; i++) { if (A) { const e = G.stepAlert(A, 1 / 60, [g]); if (e) out.push(e); } const r = G.stepGuard(g, 1 / 60, { px: 0, pz: 0, see: () => 0, A, ...env }); if (r.evt) out.push(r.evt); if (r.goal && r.speed) { const dx = r.goal.x - g.x, dz = r.goal.z - g.z, d = Math.hypot(dx, dz) || 1, s = Math.min(d, r.speed / 60); g.x += dx / d * s; g.z += dz / d * s; g.yaw = Math.atan2(-dx, -dz); } } return out; };

t('normGuard: start is first waypoint, arrays ok', () => { const g = G.normGuard({ x: 1, z: 2, route: [[5, 2], { x: 5, z: 6 }] }, 0); assert.equal(g.route.length, 3); assert.deepEqual(g.route[1], { x: 5, z: 2 }); assert.equal(g.state, 'patrol'); assert.equal(g.id, 'guard0'); });
t('patrol walks the waypoints and loops', () => { const g = G.normGuard({ x: 0, z: 0, route: [{ x: 4, z: 0 }] }); run(g, G.createAlert(), 3.4); assert.ok(Math.hypot(g.x - 4, g.z) < 0.7); run(g, G.createAlert(), 3.2); assert.ok(Math.hypot(g.x, g.z) < 0.7, 'came back'); });
t('guardSees: cone, range, near ring', () => { const g = G.normGuard({ x: 0, z: 0 }); g.yaw = 0; /* looks -z */ assert.ok(G.guardSees(g, 0, -8) > 0); assert.equal(G.guardSees(g, 0, 8), 0); assert.equal(G.guardSees(g, 0, -30), 0); assert.ok(G.guardSees(g, 0, 2) > 0, 'near ring sees behind'); assert.ok(G.guardSees(g, 0, -18, true) > 0, 'alert range is longer'); });
t('spotting: meter fills -> engage + spotted once', () => { const g = G.normGuard({ x: 0, z: 0 }); const ev = run(g, G.createAlert(), 1.5, { px: 0, pz: -6, see: () => 1 }); assert.equal(g.state, 'engage'); assert.equal(ev.filter(e => e === 'spotted').length, 1); assert.deepEqual(g.last, { x: 0, z: -6 }); });
t('no line of sight -> never spots', () => { const g = G.normGuard({ x: 0, z: 0 }); run(g, G.createAlert(), 5, { px: 0, pz: -6, see: () => 0 }); assert.equal(g.state, 'patrol'); assert.equal(g.meter, 0); });
t('ladder: alarm -> investigate last known -> search -> backup -> lockdown -> sealed', () => {
  const A = G.createAlert({ lockdownS: 2, radioS: 1 }), g = G.normGuard({ x: 0, z: 0, route: [{ x: 0, z: 10 }] });
  assert.equal(G.raiseAlert(A, { x: 6, z: 0 }), 'investigate'); assert.equal(G.raiseAlert(A, { x: 7, z: 0 }), null); assert.deepEqual(A.last, { x: 7, z: 0 });
  const ev = run(g, A, 4); assert.ok(Math.hypot(g.x - 7, g.z) < 1.5, 'walked to the last known spot'); assert.ok(ev.includes('backup'), ev.join());
  g.post = { x: 0, z: 0 }; const ev2 = run(g, A, 6); assert.ok(ev2.includes('lockdown') || A.log.includes('lockdown')); assert.equal(A.phase, 'sealed'); assert.equal(g.state, 'post'); assert.ok(Math.hypot(g.x, g.z) < 0.9, 'holds the post');
  assert.deepEqual(A.log, ['investigate', 'backup', 'lockdown', 'sealed']);
});
t('investigate times out into backup even if nobody arrives', () => { const A = G.createAlert({ investigateS: 1 }); G.raiseAlert(A, { x: 500, z: 0 }); const g = G.normGuard({ x: 0, z: 0 }); assert.ok(run(g, A, 1.2).includes('backup')); });
t('lockdown multipliers', () => { const A = G.createAlert(); assert.equal(G.lockedDown(A), false); A.phase = 'lockdown'; assert.equal(G.lockedDown(A), true); assert.ok(A.cfg.breakinMul > 1 && A.cfg.escapeMul > 1); });
t('lockdownPosts: door first, ring around the site', () => { const p = G.lockdownPosts({ x: 0, z: 0, r: 10 }, { x: 0, z: 11 }, 3); assert.deepEqual(p[0], { x: 0, z: 11 }); for (const q of p.slice(1)) assert.ok(Math.abs(Math.hypot(q.x, q.z) - 12) < 1e-6); });
t('silent melee takedown vs loud shots', () => { const g = G.normGuard({ x: 0, z: 0 }); assert.deepEqual(G.hitGuard(g, 1, 'melee', { x: 0, z: 1 }), { down: true, silent: true }); const h = G.normGuard({ x: 0, z: 0 });
  let r = G.hitGuard(h, 4, 'shot', { x: 3, z: 0 }); assert.equal(r.down, false); assert.equal(h.state, 'engage'); assert.ok(h.aware); r = G.hitGuard(h, 6, 'shot'); assert.equal(r.down, true); assert.equal(r.silent, false); assert.equal(G.hitGuard(h, 6, 'shot').down, false, 'already down'); });
t('aware guard is not one-hit by melee', () => { const g = G.normGuard({ x: 0, z: 0 }); g.aware = true; const r = G.hitGuard(g, 2, 'melee'); assert.equal(r.silent, false); assert.equal(r.down, false); });
t('fireDecision: only engaged + seen + range + cooldown', () => { const g = G.normGuard({ x: 0, z: 0 }); g.fireCd = 0; assert.equal(G.fireDecision(g, 5), null); g.state = 'engage'; g.seen = true; const f = G.fireDecision(g, 5, () => 0); assert.ok(f.hit); assert.equal(G.fireDecision(g, 5), null, 'cooldown'); g.fireCd = 0; assert.equal(G.fireDecision(g, 40), null, 'range'); });
t('engaged guard loses you -> search', () => { const g = G.normGuard({ x: 0, z: 0 }); g.state = 'engage'; g.last = { x: 0, z: -3 }; const ev = run(g, G.createAlert(), 5, { see: () => 0 }); assert.ok(ev.includes('lost')); assert.notEqual(g.state, 'engage'); });
t('guardSlots: phone budget (cap 12, >= 4 ambient walkers kept)', () => {
  assert.equal(G.guardSlots(3, { cap: 12, used: 12 }, { ambientOn: 12 }), 3, 'ambient walkers make room');
  assert.equal(G.guardSlots(6, { cap: 12, used: 9 }, { ambientOn: 4 }), 3, '5 non-ambient already -> 3 left');
  assert.equal(G.guardSlots(3, { cap: 12, used: 12 }, { ambientOn: 4 }), 0, 'full');
  assert.equal(G.guardSlots(10, { cap: 12, used: 0 }, { ambientOn: 0 }), 4, 'phone max 4');
  assert.equal(G.guardSlots(10, { cap: 40, used: 30 }, { mobile: false }), 10, 'desktop');
});
// ---- line of sight
const wall = [{ x: 0, z: 0, hx: 0.2, hz: 6, top: 2.8 }], blk = (x, y, z) => L.boxHit(wall, x, y, z);
t('losClear: wall blocks, open ground clear, over the top clear', () => {
  assert.equal(L.losClear({ x: -5, y: 3, z: 0 }, { x: 3, y: 1.2, z: 0 }, blk), false);
  assert.equal(L.losClear({ x: -5, y: 3, z: 10 }, { x: 3, y: 1.2, z: 10 }, blk), true);
  assert.equal(L.losClear({ x: -5, y: 6, z: 0 }, { x: 5, y: 4, z: 0 }, blk), true, 'above the wall');
  assert.equal(L.losClear({ x: -0.5, y: 2, z: 0 }, { x: -6, y: 1.2, z: 0 }, blk, { skipA: 1 }), true, 'own mount ignored');
});
t('pushOut', () => { const c = L.pushOut(wall, 0.1, 0, 0.4); assert.ok(c && Math.abs(c.x) >= 0.6 - 1e-9); assert.equal(L.pushOut(wall, 3, 0, 0.4), null); });
t('losCache', () => { const c = L.losCache(0.1); let k = 0; c('a', 0, () => ++k); c('a', 0.05, () => ++k); assert.equal(k, 1); c('a', 0.2, () => ++k); assert.equal(k, 2); });
t('stepCamera honours see()', () => {
  const cam = H.normCamera({ id: 'c', x: 0, z: 0, yaw: 0, sweep: 0, range: 12 });
  for (let i = 0; i < 120; i++) H.stepCamera(cam, 1 / 60, { x: 0, z: -6, see: () => false }, i / 60); assert.equal(cam.meter, 0);
  let alert = false; for (let i = 0; i < 180; i++) alert = H.stepCamera(cam, 1 / 60, { x: 0, z: -6, see: () => true }, i / 60) === 'alert' || alert; assert.ok(alert);
});
console.log(`PASS ${n} guard/LOS unit tests`);
