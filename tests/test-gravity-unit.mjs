// Unit tests for mars/gravitycore.js (gravity modes for Mars surface vehicles). node tests/test-gravity-unit.mjs
import * as G from '../mars/gravitycore.js';
let fails = 0; const ok = (name, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!c) fails++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const g = 0.38 * 9.81, flat = () => 0;
// modes
ok('cycle MARS -> LOW-G -> ZERO-G -> MARS', G.nextMode('MARS') === 'LOW-G' && G.nextMode('LOW-G') === 'ZERO-G' && G.nextMode('ZERO-G') === 'MARS');
ok('unknown mode cycles to MARS', G.nextMode('??') === 'MARS');
ok('MARS g scale is exactly 1', G.gScale('MARS') === 1 && G.gScale('ZERO-G') === 0 && near(G.gScale('LOW-G'), G.LOW_K));
// LOW-G: simulate the surface step (vy -= g dt) + our hand-back, compare airtime with plain Mars
function flight(mode, vy0, dt = 1 / 60) { let y = 0.3, vy = vy0, t = 0; while (t < 60) { vy -= g * dt; y += vy * dt; if (mode === 'LOW-G') vy += G.lowGLift(g, dt, y > 0); t += dt; if (y <= 0) break; } return { t, vy }; }
const m = flight('MARS', 6), l = flight('LOW-G', 6);
ok('LOW-G airtime >= 2x Mars', l.t >= 2 * m.t, `(mars ${m.t.toFixed(2)} s, low ${l.t.toFixed(2)} s)`);
ok('analytic airtime ratio 1/k', near(G.airtime(6, g, G.LOW_K) / G.airtime(6, g), 1 / G.LOW_K, 1e-9));
ok('LOW-G no hand-back on the ground', G.lowGLift(g, 0.016, false) === 0);
ok('LOW-G gentle landings', G.lowGLand(-20) === G.LOW_LAND_VY && G.lowGLand(-3) === -3);
// quaternion basics
const q90 = G.qYaw(Math.PI / 2), f = G.fwdOf(q90);
ok('yaw convention matches surface.js (fwd = -sin yaw, -cos yaw)', near(f[0], -1) && near(f[2], 0, 1e-9));
ok('heading of a yawed quat', near(G.headingOf(G.qYaw(0.7)), 0.7));
// ZERO-G: hover in place with no input (no gravity)
const car = { x: 0, y: 2, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0, vy: 0 };
let s = G.zgFrom(car); for (let i = 0; i < 120; i++) G.zgStep(s, {}, 1 / 60, flat);
ok('ZERO-G: the car leaves the ground and does not fall', s.p[1] > 2.5, `(y ${s.p[1].toFixed(2)})`);
// forward thrust moves along -Z at yaw 0, soft cap holds
s = G.zgFrom(car); for (let i = 0; i < 600; i++) G.zgStep(s, { fwd: 1 }, 1 / 60, flat);
const sp = Math.hypot(...s.v);
ok('ZERO-G thrust forward goes -Z', s.p[2] < -50 && Math.abs(s.p[0]) < 1e-6);
ok('ZERO-G soft speed cap', sp > G.ZG.cap * 0.9 && sp < G.ZG.cap * 1.15, `(${sp.toFixed(1)} m/s, cap ${G.ZG.cap})`);
s = G.zgFrom(car); for (let i = 0; i < 600; i++) G.zgStep(s, { fwd: 1, boost: true }, 1 / 60, flat);
ok('ZERO-G boost cap higher', Math.hypot(...s.v) > G.ZG.cap * 1.2 && Math.hypot(...s.v) < G.ZG.capBoost * 1.15);
// strafe and up/down
s = G.zgFrom(car); for (let i = 0; i < 60; i++) G.zgStep(s, { strafe: 1, up: 1 }, 1 / 60, flat);
ok('ZERO-G strafe right (+X at yaw 0) and up', s.p[0] > 2 && s.p[1] > 5);
s = { ...G.zgFrom({ ...car, y: 30 }) }; for (let i = 0; i < 600; i++) G.zgStep(s, { up: -1 }, 1 / 60, flat);
ok('ZERO-G down stops at ride height', near(s.p[1], G.ZG.clear, 0.05));
// full roll on the roll axis (plain axis, no flourish)
s = G.zgFrom({ ...car, y: 10 }); let maxTilt = 0, t = 0;
while (s.rolled < Math.PI * 2 && t < 6) { G.zgStep(s, { roll: 1 }, 1 / 60, flat); maxTilt = Math.max(maxTilt, G.tiltOf(s.q)); t += 1 / 60; }
ok('ZERO-G roll axis does a full 360', s.rolled >= Math.PI * 2 && maxTilt > 3.0, `(${t.toFixed(2)} s, max tilt ${(maxTilt * 180 / Math.PI).toFixed(0)} deg)`);
// pitch and yaw
s = G.zgFrom({ ...car, y: 10 }); for (let i = 0; i < 30; i++) G.zgStep(s, { pitch: 1 }, 1 / 60, flat);
ok('ZERO-G pitch +1 = nose up', G.pitchOf(s.q) > 0.3);
s = G.zgFrom({ ...car, y: 10 }); for (let i = 0; i < 60; i++) G.zgStep(s, { yaw: 1 }, 1 / 60, flat);
ok('ZERO-G yaw +1 = turn right (yaw decreases, like steering)', G.headingOf(s.q) < -0.5);
// auto-level after a half roll + pitch, keeping the heading
s = G.zgFrom({ ...car, y: 10, yaw: 0.8 }); for (let i = 0; i < 40; i++) G.zgStep(s, { roll: 1, pitch: 0.6 }, 1 / 60, flat);
const tilt0 = G.tiltOf(s.q), h0 = G.headingOf(s.q); for (let i = 0; i < 150; i++) G.zgStep(s, {}, 1 / 60, flat);
ok('ZERO-G auto-level when released (2.5 s)', tilt0 > 0.6 && G.tiltOf(s.q) < 0.12, `(${(tilt0 * 57.3).toFixed(0)} -> ${(G.tiltOf(s.q) * 57.3).toFixed(1)} deg)`);
ok('auto-level keeps the heading', Math.abs(Math.atan2(Math.sin(G.headingOf(s.q) - h0), Math.cos(G.headingOf(s.q) - h0))) < 0.35);
// hold skips auto-level (airRoll playing)
s = G.zgFrom({ ...car, y: 10 }); for (let i = 0; i < 40; i++) G.zgStep(s, { roll: 1 }, 1 / 60, flat);
const tH = G.tiltOf(s.q); s.w = [0, 0, 0]; for (let i = 0; i < 60; i++) G.zgStep(s, { hold: true }, 1 / 60, flat);
ok('hold (isRolling) skips auto-level', Math.abs(G.tiltOf(s.q) - tH) < 0.02);
// roll routing with a stub SSX.airRoll (PR #41 API: roll() returns a bool)
const calls = []; const stub = { roll: d => { calls.push(d); return true; }, canRoll: () => true, isRolling: () => true };
ok('airRoll.roll accepted -> airRoll', G.routeRoll(stub, -1) === 'airRoll' && G.routeRoll(stub, 1) === 'airRoll' && calls.join() === 'left,right');
ok('airRoll.roll returns false -> plain axis', G.routeRoll({ roll: d => { calls.push(d); return false; } }, 1) === 'axis' && calls.length === 3);
ok('airRoll.roll throws -> plain axis', G.routeRoll({ roll: () => { throw new Error('x'); } }, 1) === 'axis');
ok('roll already running (Q/E air-roll) -> airRoll, no second call', G.routeRoll(stub, 1, true) === 'airRoll' && calls.length === 3);
ok('airRoll missing -> plain roll axis', G.routeRoll(undefined, 1) === 'axis' && G.routeRoll({}, -1) === 'axis');
ok('no roll input -> none', G.routeRoll(stub, 0) === 'none' && calls.length === 3);
ok('barrel angle: 0 -> -2pi*dir, ends at 0', G.barrelAngle(null) === 0 && Math.abs(G.barrelAngle({ dir: 1, t: 0.375 }) + Math.PI) < 1e-9 && G.barrelAngle({ dir: 1, t: 0.75 }) === 0);
ok('floating flag', !G.floatingOf('MARS', { air: true }, 5) && !G.floatingOf('LOW-G', { air: false }, 0) && G.floatingOf('LOW-G', { air: true }, 3)
  && G.floatingOf('ZERO-G', { air: false }, 0.6) && !G.floatingOf('ZERO-G', { air: false }, 0.1) && !G.floatingOf('ZERO-G', null, 5) && G.floatingOf('LOW-G', { spec: { hover: 1 }, lift: 2 }, 0));
ok('isRolling feature-detect', G.airRolling(stub) === true && G.airRolling({}) === false && G.airRolling(undefined) === false);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
