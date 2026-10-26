// Beltway life, the pure half (no THREE, no DOM): quality tiers and density, lane geometry, the car-following model
// (IDM), lane-change choice, collision outcome, carjack struggle and outcome, convoy ram damage and loot, toll prices.
// beltway.js does the rendering, input and game hooks; tests/test-beltway-unit.mjs covers this file in node.

// ---- quality tiers: how many pooled cars run at once. Phones default to med. ----
export const TIERS = {
  low:  { phone: 8,  desktop: 14, sparks: 48,  debris: 18, convoyS: 150 },
  med:  { phone: 16, desktop: 26, sparks: 96,  debris: 28, convoyS: 120 },
  high: { phone: 22, desktop: 40, sparks: 160, debris: 40, convoyS: 100 }
};
export const normTier = t => (t === 'low' || t === 'med' || t === 'high') ? t : t === 'medium' ? 'med' : null;
export function pickTier({ override, app, stored, mobile } = {}) { return normTier(override) || normTier(app) || normTier(stored) || (mobile ? 'med' : 'high'); }
export function density(tier, mobile, scale = 1) {
  const T = TIERS[normTier(tier) || 'med']; const n = mobile ? T.phone : T.desktop;
  return Math.max(4, Math.min(n, Math.round(n * Math.max(0.25, Math.min(1, scale)))));
}
// adaptive: below 48 fps for a while, run 15% fewer cars (down to 40% of the tier); above 57, creep back up
export function adaptScale(scale, fps, dt) {
  if (!(fps > 0)) return scale;
  if (fps < 48) return Math.max(0.4, scale - 0.15 * dt / 2);
  if (fps > 57) return Math.min(1, scale + 0.05 * dt / 2);
  return scale;
}

// ---- lanes: two each way, offsets to the right of the direction of travel (the centre strip stays clear for ramps / booths) ----
export const LANES = [2.25, 4.0];
export const KINDS = {
  sedan:  { len: 4.4, w: 1.85, vmax: [15, 20], jack: 'bw-sedan', weight: 0.55 },
  van:    { len: 5.2, w: 2.0,  vmax: [13, 17], jack: 'bw-van', weight: 0.3 },
  hauler: { len: 7.4, w: 2.4,  vmax: [9, 12],  jack: 'hauler', weight: 0.15 },
  armored:{ len: 6.6, w: 2.5,  vmax: [11, 11], jack: null, weight: 0 },
  escort: { len: 4.8, w: 2.0,  vmax: [11, 11], jack: 'bw-van', weight: 0 }
};
export function pickKind(r) { let a = 0; for (const [k, v] of Object.entries(KINDS)) { a += v.weight; if (r < a) return k; } return 'sedan'; }
export const PAINTS = [0xe9ebee, 0xbfc4ca, 0x1b1d22, 0x2a3a55, 0x7a1f22, 0xb9a27a, 0x3d4a3a, 0x8d9299, 0x5b2b4a, 0xd8d2c4];

// signed gap along the road from a to b for direction dir (+1 / -1), wrapping on a closed loop of length L
export function gapAlong(sa, sb, dir, L, closed) {
  let d = (sb - sa) * dir;
  if (closed && L > 0) { d = ((d % L) + L) % L; if (d > L / 2) d -= L; }
  return d;
}
export const wrapS = (s, L, closed) => closed ? ((s % L) + L) % L : s;

// ---- Intelligent Driver Model: acceleration for speed v, desired v0, bumper gap g to a leader moving at vl ----
export const IDM = { a: 2.4, b: 3.2, s0: 2.5, T: 1.1, bmax: 9 };
export function idmAccel(v, v0, g, vl, P = IDM) {
  const free = 1 - Math.pow(Math.max(0, v) / Math.max(0.5, v0), 4);
  if (!(g < 1e8)) return Math.max(-P.bmax, P.a * free);
  const dv = v - vl, ss = P.s0 + Math.max(0, v * P.T + v * dv / (2 * Math.sqrt(P.a * P.b)));
  const acc = P.a * (free - Math.pow(ss / Math.max(0.1, g), 2));
  return Math.max(-P.bmax, Math.min(P.a, acc));
}
// stopping distance with a reaction delay (s) and max braking: used to tell a pileup from a near miss
export const stopDist = (v, react = 0.45, b = IDM.bmax) => Math.max(0, v) * react + v * v / (2 * b);

// MOBIL-lite: change lane when the current leader holds you up and the other lane has room ahead and behind
export function laneChange({ v, v0, gapAhead, leadV, otherAhead, otherAheadV, otherBehind, otherBehindV, cooldown }) {
  if (cooldown > 0) return false;
  const held = gapAhead < Math.max(18, v * 2.2) && leadV < v0 - 2;
  const blocked = gapAhead < 14 && leadV < 1; // a wreck / stopped car ahead: get out of the lane if you can
  if (!held && !blocked) return false;
  const roomAhead = otherAhead > Math.max(14, gapAhead + 8) && otherAheadV > leadV - 0.5;
  const roomBehind = otherBehind > Math.max(8, (otherBehindV - v) * 2.5 + 6);
  return roomAhead && roomBehind;
}

// a contact between two cars on the road: closing speed decides whether it's a bump or a wreck
export function contact(closing, { wreckAt = 5, hard = 12 } = {}) {
  if (closing >= hard) return 'wreck-hard';
  if (closing >= wreckAt) return 'wreck';
  return 'bump';
}
// pileup: 3+ wrecks within 60 m inside 5 s
export function isPileup(wrecks, now, x, z, { n = 3, r = 60, t = 5 } = {}) {
  return wrecks.filter(w => now - w.t < t && Math.hypot(w.x - x, w.z - z) < r).length >= n;
}

// ---- carjack: hold the button to win the struggle. Releasing drains it. Too slow and the driver floors it. ----
export const JACK = { maxSpeed: 6, range: 4.6, need: 1.0, drain: 0.6, giveUp: 3.2 };
export function struggleStep(st, dt, holding) {
  const s = { ...st };
  if (holding) { s.p = Math.min(1, s.p + dt / JACK.need); s.idle = 0; }
  else { s.p = Math.max(0, s.p - dt * JACK.drain); s.idle += dt; }
  s.done = s.p >= 1; s.lost = !s.done && s.idle > JACK.giveUp;
  return s;
}
// what the driver does once pulled out: flee, or fight back (more likely if you're already wanted, less if armed / in a hurry)
export function jackOutcome(r, { wanted = 0, kind = 'sedan' } = {}) {
  const fight = kind === 'hauler' ? 0.5 : 0.32 + Math.min(0.2, wanted * 0.04);
  return r < fight ? 'fight' : 'flee';
}

// ---- armored convoy: ram until disabled, crack the rear doors, loot ----
export const CONVOY = { hp: 100, crackTime: 25, loot: [380, 720], ramMin: 4, ramK: 3.2 };
export const ramDamage = closing => closing <= CONVOY.ramMin ? 0 : Math.round((closing - CONVOY.ramMin) * CONVOY.ramK);
export const convoyLoot = r => Math.round(CONVOY.loot[0] + (CONVOY.loot[1] - CONVOY.loot[0]) * r);

// ---- toll booths ----
export const TOLL = { price: 10, range: 7, slowS: 14, slowV: 5.5, runV: 9, shakedown: [80, 160], hold: 1.2, cooldown: 180, heat: 2 };
export const shakedownCash = r => Math.round(TOLL.shakedown[0] + (TOLL.shakedown[1] - TOLL.shakedown[0]) * r);
// pick booth spots along the road: evenly spread, clear of checkpoints, ramps and district cores
export function boothSpots(len, closed, avoid = [], n = 3, at = s => s) {
  const out = [];
  for (let k = 0; k < n * 6 && out.length < n; k++) {
    const s = (len * ((k * 0.618034 + 0.17) % 1));
    const p = at(s); if (!p) continue;
    if (avoid.some(a => Math.hypot(a.x - p.x, a.z - p.z) < (a.r || 60))) continue;
    if (out.some(o => Math.abs(gapAlong(o.s, s, 1, len, closed)) < len / (n * 2))) continue;
    out.push({ s, x: p.x, z: p.z });
  }
  return out;
}

// which context button to show (at most one action set at a time; nothing when none applies)
export function contextFor({ driving, speed = 0, jackable, booth, convoyCrack, busy }) {
  if (busy) return null;
  if (!driving && convoyCrack) return 'crack';
  if (booth && Math.abs(speed) < 3) return 'toll';
  if (!driving && jackable) return 'carjack';
  return null;
}
