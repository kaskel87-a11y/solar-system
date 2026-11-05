// v7.5.19 sniper contracts: pure rules (no DOM, no three.js) shared by mars/sniper.js and tests/test-sniper-unit.mjs.
// Contract data (fixer Deacon Graves, three marks, perch + walking route in AJ-relative metres), scope zoom/fov math,
// sway + held-breath model, bolt cycle, ray-vs-target hit test, route walking and payout. Everything that runs per
// frame writes into caller-owned objects (no allocations).
export const FIXER = 'Deacon Graves';
export const KEY = 'ssx.sniper.v1';
export const BOLT = 1.6;            // s between shots (bolt cycle), the rail rifle's own cooldown is 1.0
export const ZOOMS = [4, 8];        // magnification per scope level
export const PERCH_H = 12;          // platform height above the ground at the tower
export const PERCH_R = 3.2;         // ring at the tower foot that offers the climb
export const BREATH_MAX = 4;        // s of held breath, then the shakes
export const BREATH_RECOVER = 3.5;  // s to refill from empty
export const ESCAPE_T = 22;         // s a spooked mark needs to get away
export const CLOSE_R = 25;          // a kill closer than this is sloppy: half pay, extra heat
export const FAR_BONUS_R = 100;     // a kill from beyond this pays a long-shot bonus

// route: the mark paces A -> B -> C -> B -> A (pausing at the ends); perch: scaffold tower with a clear view of the route
export const CONTRACTS = [
  { id: 'kesh', n: 1, mark: 'Tobiah Kesh', d: 'red-tape-flats', place: 'Red Tape Flats', pay: 900, xp: 60,
    crime: 'skims the O2 ration for the Flats and sells it back by the lungful',
    brief: 'Kesh walks his collection route on the north side of the Flats. I put a scaffold up for you to the south. One shot, then lose the heat.',
    perch: [-241, -71], route: [[-280, 30], [-235, 19], [-207, -7]], walk: 1.25, outfit: { top: 0x6b4a2a, bottom: 0x2a2620, hair: 0x1a120c, hairStyle: 'short', shades: true, bulk: 1.15 } },
  { id: 'teague', n: 2, mark: 'Rourke Teague', d: 'olympus-row', place: 'Olympus Row', pay: 1600, xp: 90,
    crime: 'breaks dock workers\u2019 hands for the Olympus shipping cartel',
    brief: 'Teague checks on his crews along the east edge of Olympus Row. Tower is south-east of him. He spooks fast if you miss.',
    perch: [118, -458], route: [[47, -431], [65, -376], [60, -349]], walk: 1.45, outfit: { top: 0x2b3a4a, bottom: 0x1a1d22, hair: 0x3a2a1a, hairStyle: 'mohawk', shades: false, bulk: 1.3 } },
  { id: 'crane', n: 3, mark: 'Ottoline Crane', d: 'helios-heights', place: 'Helios Heights', pay: 2600, xp: 140,
    crime: 'owns the water board and turns the taps off on anyone who can\u2019t pay',
    brief: 'Crane takes her evening walk south of Helios Heights. Tower is out east, a long shot. Wait for the wind... there is no wind. Just shoot.',
    perch: [418, 0], route: [[256, 50], [305, 19], [324, -3]], walk: 1.1, outfit: { top: 0xd9d4c8, bottom: 0x2a2a30, hair: 0xb8b0a0, hairStyle: 'bun', shades: true, bulk: 0.95 } },
];
export const byId = id => CONTRACTS.find(c => c.id === id) || null;

// ---------- persistence ----------
export function fresh() { return { v: 1, done: {}, earned: 0, shots: 0, hits: 0, heads: 0, best: 0 }; }
export function migrate(raw) {
  const s = fresh(); if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
  for (const c of CONTRACTS) if (raw.done && Number.isFinite(raw.done[c.id]) && raw.done[c.id] > 0) s.done[c.id] = raw.done[c.id] | 0;
  for (const k of ['earned', 'shots', 'hits', 'heads', 'best']) if (Number.isFinite(raw[k]) && raw[k] >= 0) s[k] = raw[k];
  return s;
}
// contract n unlocks when n-1 is done; the first is open from the start
export function unlocked(S, id) { const c = byId(id); if (!c) return false; if (c.n === 1) return true; const prev = CONTRACTS.find(x => x.n === c.n - 1); return !!(prev && S.done[prev.id] > 0); }
export function list(S) { return CONTRACTS.map(c => ({ id: c.id, n: c.n, mark: c.mark, place: c.place, pay: c.pay, done: S.done[c.id] | 0, open: unlocked(S, c.id) })); }
// repeats pay 60%
export function payFor(c, { head = false, dist = 0, done = 0 } = {}) {
  let p = c.pay * (done > 0 ? 0.6 : 1);
  if (dist < CLOSE_R) p *= 0.5; else { if (head) p *= 1.25; if (dist >= FAR_BONUS_R) p *= 1.15; }
  return Math.round(p / 10) * 10;
}

// ---------- scope optics ----------
// vertical fov (degrees) for a base fov and a magnification
export function scopeFov(baseDeg, mag) { const r = Math.PI / 180; return 2 * Math.atan(Math.tan(baseDeg * r / 2) / Math.max(1, mag)) / r; }
export const lookScale = (scopeDeg, baseDeg) => Math.max(0.05, Math.min(1, scopeDeg / Math.max(1, baseDeg)));

// ---------- sway + breath ----------
// b = { t, breath, holding, shaky }: advance and write the yaw/pitch offsets (radians) into out
export function breathStep(b, dt, wantHold) {
  if (wantHold && b.breath > 0 && !b.shaky) { b.holding = true; b.breath = Math.max(0, b.breath - dt); if (b.breath <= 0) b.shaky = true; }
  else { b.holding = false; b.breath = Math.min(BREATH_MAX, b.breath + dt * BREATH_MAX / BREATH_RECOVER); if (b.shaky && b.breath >= BREATH_MAX * 0.5) b.shaky = false; }
  return b;
}
export function newBreath() { return { t: 0, breath: BREATH_MAX, holding: false, shaky: false }; }
export function sway(b, dt, mag, out) {
  b.t += dt; const t = b.t;
  const amp = 0.0045 * (b.holding ? 0.12 : b.shaky ? 2.2 : 1) * (mag > 4 ? 1.15 : 1);
  out.yaw = amp * (Math.sin(t * 0.83) * 0.7 + Math.sin(t * 1.97 + 1.3) * 0.3);
  out.pitch = amp * (Math.sin(t * 1.21 + 0.4) * 0.6 + Math.sin(t * 2.63) * 0.25 + Math.sin(t * 0.47) * 0.15);
  return out;
}

// ---------- bolt cycle ----------
export const canShoot = (cool, ammo) => cool <= 0 && ammo > 0;

// ---------- hit test ----------
// ray (o + t*d, d normalised) vs a standing person at (x, gy, z): head sphere and a body capsule. -> { part, t } | null into out
const HEAD_Y = 1.72, HEAD_R = 0.19, BODY_Y0 = 0.15, BODY_Y1 = 1.52, BODY_R = 0.34;
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz, tca = lx * dx + ly * dy + lz * dz; if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca; if (d2 > r * r) return -1; return tca - Math.sqrt(r * r - d2);
}
export function hitPerson(o, d, x, gy, z, out) {
  out.part = null; out.t = 0;
  const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, x, gy + HEAD_Y, z, HEAD_R);
  if (th > 0) { out.part = 'head'; out.t = th; return out; }
  // capsule: closest approach between the ray and the vertical segment
  const ax = x - o.x, az = z - o.z, hd = Math.hypot(d.x, d.z); if (hd < 1e-6) return out;
  const t = (ax * d.x + az * d.z) / (hd * hd); if (t <= 0) return out;
  const px = o.x + d.x * t, pz = o.z + d.z * t, py = o.y + d.y * t, dist = Math.hypot(px - x, pz - z);
  if (dist <= BODY_R && py >= gy + BODY_Y0 && py <= gy + BODY_Y1) { out.part = 'body'; out.t = t * Math.hypot(d.x, d.y, d.z); }
  return out;
}

// ---------- route walking ----------
// w = { seg, dir, s, pause }: pace along pts (ping-pong), pausing pauseT at each end; writes x, z, yaw, moving into out
export function newWalker() { return { seg: 0, dir: 1, s: 0, pause: 0 }; }
export function walkStep(w, pts, speed, dt, pauseT, out) {
  if (w.pause > 0) { w.pause -= dt; }
  else {
    let left = speed * dt;
    for (let guard = 0; guard < 8 && left > 0; guard++) {
      const a = pts[w.seg], b = pts[w.seg + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if (w.dir > 0) { const room = L - w.s; if (left < room) { w.s += left; left = 0; } else { left -= room; w.s = L; if (w.seg + 1 >= pts.length - 1) { w.dir = -1; w.pause = pauseT; left = 0; } else { w.seg++; w.s = 0; } } }
      else { if (left < w.s) { w.s -= left; left = 0; } else { left -= w.s; w.s = 0; if (w.seg === 0) { w.dir = 1; w.pause = pauseT; left = 0; } else { w.seg--; const a2 = pts[w.seg], b2 = pts[w.seg + 1]; w.s = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]); } } }
    }
  }
  const a = pts[w.seg], b = pts[w.seg + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = w.s / L;
  out.x = a[0] + (b[0] - a[0]) * k; out.z = a[1] + (b[1] - a[1]) * k;
  const dx = (b[0] - a[0]) * w.dir, dz = (b[1] - a[1]) * w.dir; out.yaw = Math.atan2(-dx, -dz); out.moving = w.pause > 0 ? 0 : 1;
  return out;
}
// flee: straight away from the shooter at run speed
export function fleeStep(p, fromX, fromZ, speed, dt) { const dx = p.x - fromX, dz = p.z - fromZ, L = Math.hypot(dx, dz) || 1; p.x += dx / L * speed * dt; p.z += dz / L * speed * dt; p.yaw = Math.atan2(-dx, -dz); return p; }

// ---------- contract stages ----------
// go (head for the perch) -> hunt (mark is walking, take the shot) -> heat (mark down: lose the stars) -> paid. fail: escaped / quit / wasted
export const STAGES = ['go', 'hunt', 'heat'];
export function stageText(c, stage, d) {
  if (stage === 'go') return `Get to the sniper tower in ${c.place}` + (d != null ? ` · ${d} m` : '');
  if (stage === 'hunt') return `Climb up, scope in and take out ${c.mark} (red marker)`;
  if (stage === 'heat') return 'Target down. Lose the wanted stars to get paid';
  return '';
}
