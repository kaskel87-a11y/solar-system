// Gravity modes for Mars surface vehicles: pure math, no DOM and no THREE (unit-tested in tests/test-gravity-unit.mjs).
// MARS   = today's 0.38 g, untouched.
// LOW-G  = the surface step still applies full g; we hand back (1 - k) of it while airborne, so the net pull is k * g.
// ZERO-G = we own the vehicle: free 6-axis rigid body (thrust fwd/back, strafe, up/down + pitch, yaw, roll), soft speed cap,
//          auto-level toward the current heading when the rotation controls are released.
export const MODES = ['MARS', 'LOW-G', 'ZERO-G'];
export const LOW_K = 0.4;               // LOW-G pull as a fraction of Mars gravity (0.38 g -> 0.152 g): 2.5x the airtime
export const LOW_HOP = 5.2;             // LOW-G hop (m/s) on Jump for vehicles without thrusters
export const LOW_LAND_VY = -9;          // LOW-G: never land harder than this (gentle landings, no crash damage)
export const LOW_HOVER_LIFT = 3;        // LOW-G hover bikes: lift decays 5/s on Mars, 2/s here
export const SOFT_FALL_VY = -10;        // leaving ZERO-G high up: fall no faster than this until the wheels touch
export const ZG = {
  acc: 14, accBoost: 24, strafe: 9, vert: 9,  // m/s^2
  cap: 24, capBoost: 36,                      // soft speed cap (m/s): above it a strong drag pulls you back
  drag: 0.25, overDrag: 3.0,                  // 1/s: gentle drift drag, plus drag on the excess over the cap
  rate: { pitch: 1.6, yaw: 1.5, roll: 3.2 },  // rad/s at full input (full roll in ~2 s)
  spin: 6,                                    // 1/s: how fast the body rate follows the controls
  level: 2.4,                                 // 1/s: auto-level when pitch and roll are released
  clear: 0.7, ceil: 140                       // ride height over the ground, max altitude (m)
};
export const nextMode = m => MODES[(MODES.indexOf(m) + 1) % MODES.length];
export const gScale = m => m === 'LOW-G' ? LOW_K : m === 'ZERO-G' ? 0 : 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// LOW-G: the vertical-velocity hand-back for one frame (positive m/s). g is in m/s^2 (cfg.g * 9.81).
export function lowGLift(g, dt, airborne) { return airborne ? g * (1 - LOW_K) * dt : 0; }
// simple ballistic airtime for a launch speed vy0 under gravity scale k
export const airtime = (vy0, g, k = 1) => 2 * vy0 / (g * k);
// LOW-G landing: soften the impact speed
export const lowGLand = vy => Math.max(vy, LOW_LAND_VY);

// --- quaternions [x, y, z, w] ---
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qNorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
export const qAxis = (x, y, z, a) => { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; };
export const qYaw = yaw => qAxis(0, 1, 0, yaw);
export function qRot(q, v) { // rotate vector v by q
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
export function qSlerp(a, b, t) {
  let c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (c < 0) { b = b.map(v => -v); c = -c; }
  if (c > 0.9995) return qNorm(a.map((v, i) => v + (b[i] - v) * t));
  const th = Math.acos(c), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((v, i) => v * wa + b[i] * wb);
}
// vehicles face local -Z (forward = (-sin yaw, 0, -cos yaw)), +X right, +Y up
export const fwdOf = q => qRot(q, [0, 0, -1]);
export const upOf = q => qRot(q, [0, 1, 0]);
export const rightOf = q => qRot(q, [1, 0, 0]);
export const headingOf = q => { const f = fwdOf(q), u = upOf(q); const h = Math.hypot(f[0], f[2]) > 0.2 ? f : u[1] < 0 ? u : u.map(v => -v); return Math.atan2(-h[0], -h[2]); };
// bank (roll) angle: 0 when level, +-PI upside down; sign follows the right vector's height
export const bankOf = q => { const r = rightOf(q), u = upOf(q); return Math.atan2(-r[1], u[1]); };
export const pitchOf = q => Math.asin(clamp(fwdOf(q)[1], -1, 1));
export const tiltOf = q => Math.acos(clamp(upOf(q)[1], -1, 1)); // 0 = level, PI = upside down

// new ZERO-G body from a surface vehicle's current pose and velocity
export function zgFrom(car) {
  const q = qNorm(qMul(qYaw(car.yaw || 0), qMul(qAxis(1, 0, 0, car.pitch || 0), qAxis(0, 0, 1, car.roll || 0))));
  const sp = car.speed || 0, f = [-Math.sin(car.yaw || 0), 0, -Math.cos(car.yaw || 0)];
  return { p: [car.x, car.y, car.z], v: [f[0] * sp, Math.max(0, car.vy || 0) + 1.2, f[2] * sp], q, w: [0, 0, 0], rolled: 0 };
}

// One ZERO-G step. inp: { fwd, strafe, up, pitch, yaw, roll } in [-1, 1], boost (bool), hold (bool: skip auto-level, e.g. an airRoll is playing).
// ground(x, z) -> terrain height. Returns s (mutated).
export function zgStep(s, inp, dt, ground) {
  const P = ZG, b = !!inp.boost;
  // linear thrust in the body frame
  const aB = [(inp.strafe || 0) * P.strafe, (inp.up || 0) * P.vert, -(inp.fwd || 0) * (b ? P.accBoost : P.acc)];
  const aW = qRot(s.q, [aB[0], 0, aB[2]]);
  aW[1] += aB[1]; // up/down is always world-vertical, so "up" stays up even upside down
  for (let i = 0; i < 3; i++) s.v[i] += aW[i] * dt;
  const sp = Math.hypot(s.v[0], s.v[1], s.v[2]), cap = b ? P.capBoost : P.cap;
  let k = Math.exp(-P.drag * dt); if (sp > cap) k *= Math.exp(-P.overDrag * (sp - cap) / cap * dt * 4);
  for (let i = 0; i < 3; i++) s.v[i] *= k;
  // rotation: body rates chase the inputs
  const tw = [(inp.pitch || 0) * P.rate.pitch, (inp.yaw || 0) * P.rate.yaw, (inp.roll || 0) * P.rate.roll], f = Math.min(1, dt * P.spin);
  for (let i = 0; i < 3; i++) s.w[i] += (tw[i] - s.w[i]) * f;
  // body-frame rotation: pitch about local X, yaw about local Y, roll about local -Z (positive roll = right wing down)
  const dq = qMul(qMul(qAxis(1, 0, 0, s.w[0] * dt), qAxis(0, 1, 0, -s.w[1] * dt)), qAxis(0, 0, 1, -s.w[2] * dt));
  s.q = qNorm(qMul(s.q, dq)); s.rolled += Math.abs(s.w[2] * dt);
  // auto-level: no pitch/roll input -> ease back to upright on the current heading
  const idle = Math.abs(inp.pitch || 0) < 0.08 && Math.abs(inp.roll || 0) < 0.08 && !inp.hold;
  if (idle) { s.q = qSlerp(s.q, qYaw(headingOf(s.q)), 1 - Math.exp(-P.level * dt)); s.w[0] *= Math.exp(-4 * dt); s.w[2] *= Math.exp(-4 * dt); }
  // move, keep off the ground and under the ceiling
  for (let i = 0; i < 3; i++) s.p[i] += s.v[i] * dt;
  const gh = ground ? ground(s.p[0], s.p[2]) : 0, lo = gh + P.clear;
  if (s.p[1] < lo) { s.p[1] = lo; if (s.v[1] < 0) s.v[1] *= -0.25; }
  if (s.p[1] > gh + P.ceil) { s.p[1] = gh + P.ceil; if (s.v[1] > 0) s.v[1] = 0; }
  s.alt = s.p[1] - gh;
  return s;
}
// roll input routing: Ben's SSX.airRoll when it is there and allows a roll, else the plain roll axis.
// Returns 'airRoll' (called it), 'blocked' (airRoll present but canRoll() false) or 'axis' (caller applies the roll rate).
export function routeRoll(airRoll, dir) {
  if (!dir) return 'none';
  if (airRoll && typeof airRoll.roll === 'function') {
    const can = typeof airRoll.canRoll === 'function' ? !!airRoll.canRoll() : true;
    if (!can) return 'blocked';
    airRoll.roll(dir < 0 ? 'left' : 'right'); return 'airRoll';
  }
  return 'axis';
}
export const airRolling = airRoll => !!(airRoll && typeof airRoll.isRolling === 'function' && airRoll.isRolling());
