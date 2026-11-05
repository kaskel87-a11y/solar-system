// Unit tests for mars/jetpackcore.js (Mars jetpack). node tests/test-jetpack-unit.mjs
import * as C from '../mars/jetpackcore.js';
let fails = 0; const ok = (name, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!c) fails++; };
const g = 0.38 * 9.81, dt = 1 / 60;
// a little on-foot sim: surface.js walk (vy -= g dt, land at 0) then our step, holding Jump for `hold` seconds
function fly(mode, hold, T = 20, o = {}) {
  const s = C.fresh(); let y = 0, vy = 0, grounded = true, t = 0, top = 0, burned = 0, landedAt = -1, minFuel = 100;
  while (t < T) {
    const jump = t < hold;
    if (grounded && jump) { vy = 4.2; grounded = false; }
    vy -= g * dt; y += vy * dt; if (y <= 0) { y = 0; vy = 0; if (!grounded && t > 0.1 && landedAt < 0 && !jump) landedAt = t; grounded = true; } else grounded = false;
    const f0 = s.fuel; vy = C.step(s, { jump, dive: !!o.dive, airborne: !grounded, alt: y, vy, g, mode, dt }); if (s.lit) grounded = false; burned += Math.max(0, f0 - s.fuel);
    top = Math.max(top, y); minFuel = Math.min(minFuel, s.fuel); t += dt;
  }
  return { s, top, burned, landedAt, y, minFuel };
}
ok('price is 2,000 cr', C.PRICE === 2000);
const m1 = fly('MARS', 2);
ok('holding Jump climbs well above a plain jump', m1.top > 8, `(top ${m1.top.toFixed(1)} m)`);
const plain = (4.2 * 4.2) / (2 * g);
ok('a tap is still a plain jump height', fly('MARS', 0.01).top < plain + 0.2, `(plain ${plain.toFixed(2)} m)`);
const m3 = fly('MARS', 3, 3);
ok('fuel drains while thrusting', m3.s.fuel < 50 && m3.s.fuel > 0, `(fuel ${m3.s.fuel.toFixed(0)})`);
const empty = fly('MARS', 12, 40);
ok('tank runs dry, you come back down and it refills', empty.minFuel === 0 && empty.y === 0 && empty.s.fuel === C.FUEL_MAX, `(min ${empty.minFuel}, end ${empty.s.fuel.toFixed(0)})`);
const refill = fly('MARS', 2, 20);
ok('fuel refills on the ground', refill.s.fuel === C.FUEL_MAX, `(fuel ${refill.s.fuel})`);
{ const s = C.fresh(); s.fuel = 10; C.step(s, { jump: false, airborne: false, alt: 0, vy: 0, g, mode: 'MARS', dt: 0.1 }); ok('refill waits a moment after landing', s.fuel === 10); }
{ const s = C.fresh(); s.fuel = 3; ok('cannot light up from almost empty', !C.canThrust(s, { jump: true, alt: 1 })); s.lit = true; ok('a lit burn runs to empty', C.canThrust(s, { jump: true, alt: 1 })); }
{ const s = C.fresh(); ok('no thrust above the ceiling', !C.canThrust(s, { jump: true, alt: C.CEIL + 1 })); }
// gravity modes
const l1 = fly('LOW-G', 2);
ok('LOW-G: same burn goes higher than MARS', l1.top > m1.top * 1.3, `(low ${l1.top.toFixed(1)} vs mars ${m1.top.toFixed(1)})`);
const mAir = fly('MARS', 1.5, 60).landedAt, lAir = fly('LOW-G', 1.5, 60).landedAt;
ok('LOW-G: longer flight', lAir > mAir * 1.4, `(${lAir.toFixed(1)} s vs ${mAir.toFixed(1)} s)`);
ok('LOW-G burns slower', C.BURN_SCALE['LOW-G'] < 1 && C.BURN_SCALE['ZERO-G'] < C.BURN_SCALE['LOW-G']);
{ // ZERO-G: after a burn you drift down slowly, a dive is faster
  const s = C.fresh(); s.flying = true; let vy = 5;
  for (let i = 0; i < 240; i++) { vy -= g * dt; vy = C.step(s, { jump: false, airborne: true, alt: 20, vy, g, mode: 'ZERO-G', dt }); }
  ok('ZERO-G: let go and you sink gently', Math.abs(vy - C.ZG_SINK) < 0.3, `(vy ${vy.toFixed(2)})`);
  for (let i = 0; i < 240; i++) { vy -= g * dt; vy = C.step(s, { jump: false, dive: true, airborne: true, alt: 20, vy, g, mode: 'ZERO-G', dt }); }
  ok('ZERO-G: ▼ dives faster', vy < -5, `(vy ${vy.toFixed(2)})`);
}
ok('unknown gravity mode is MARS', C.normMode('??') === 'MARS' && C.gScale('MARS') === 1 && C.handBack('MARS', g, dt, true) === 0);
ok('no hand-back on the ground', C.handBack('ZERO-G', g, dt, false) === 0);
// air steer
{ const [dx, dz] = C.airSteer(0, 1, 0, 1, true); ok('stick forward at yaw 0 moves -z', Math.abs(dx) < 1e-9 && Math.abs(dz + C.AIR_EXTRA) < 1e-9); }
{ const [dx] = C.airSteer(1, 0, 0, 1, true); ok('stick right moves +x', Math.abs(dx - C.AIR_EXTRA) < 1e-9); }
ok('no air steer on the ground', C.airSteer(1, 1, 0, 1, false).every(v => v === 0));
ok('diagonal is not faster', Math.hypot(...C.airSteer(1, 1, 0.3, 1, true)) <= C.AIR_EXTRA + 1e-9);
// cops
function shoot(stars, secs, o = {}) { const s = C.fresh(); const ev = []; for (let t = 0; t < secs; t += dt) { const r = C.shootStep(s, { stars, flying: o.flying ?? true, alt: o.alt ?? 10, seen: o.seen ?? true, dt }); if (r) ev.push(r); } return { s, ev }; }
ok('2 stars: nobody shoots', shoot(2, 10).ev.length === 0);
const s3 = shoot(3, 4);
ok('3 stars: hits then shot down', s3.ev.join(',') === 'hit,hit,down' && s3.s.down > 0 && s3.s.fuel === 0, s3.ev.join(','));
ok('5 stars: shot down after 2 hits, faster', shoot(5, 1.6).ev.join(',') === 'hit,down');
ok('out of sight: no shots', shoot(4, 10, { seen: false }).ev.length === 0);
ok('on the ground / low: no shots', shoot(4, 10, { flying: false }).ev.length === 0 && shoot(4, 10, { alt: 1 }).ev.length === 0);
{ const s = C.fresh(); s.down = 2; let vy = 0; for (let i = 0; i < 30; i++) vy = C.step(s, { jump: true, airborne: true, alt: 10, vy: vy - g * dt, g, mode: 'ZERO-G', dt }); ok('shot out: no thrust and no ZERO-G float, you drop', !s.lit && vy < -1.5, `(vy ${vy.toFixed(2)})`); }
ok('hit damage grows with stars', C.hitDamage(5) > C.hitDamage(3));
console.log(fails ? `${fails} FAILED` : 'all jetpack unit tests passed'); process.exit(fails ? 1 : 0);
