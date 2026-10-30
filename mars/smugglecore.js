// Smuggling runs: pure logic (no DOM, no THREE), unit-tested by tests/test-smuggle-unit.mjs.
// mars/smuggle.js does the meshes, the space tick, the UI and the game wiring.
// Fiction only. M-rated: contraband, crooked customs, swearing. Nothing sexual.
// Vectors are plain [x, y, z] arrays in the "Mars frame": origin = Mars centre, axes = world axes (it moves with Mars
// along its orbit but does not spin), so the route stays put while Mars goes round the Sun.

export const SAVE_KEY = 'ssx.smuggle.v1';
export const RUN_KEY = 'Digit8';    // pick up a run at the pad / take the cash payout (free on main and every open PR: danger 1-4, gravity 2, raccoon 5, base 1-6, street 7)
export const FAVOR_KEY = 'Digit9';  // take the favor payout instead
export const BRIBE_KEY = 'KeyB';    // in space only (contraband's KeyB stash is surface only)
export const DUMP_KEY = 'KeyX';     // in space only (KeyX medkit is surface only)
export const PAD_AJ = [-38, 10];    // Ares Junction landing pad (world.js COLONIES.Mars.pad), AJ-relative
export const PAD_R = 13;
export const FIXER = 'Gutter Pell';
export const COOLDOWN = 25;         // s between runs

// route (space units; Mars r = 3, the ship cruises at 30 u/s and boosts at 90)
export const PHOBOS = { R: 58, y: 5, r: 1.7, w: 0.05, drop: 8, hold: 1.4 };
export const BEACONS = [{ id: 'kestrel', name: 'Kestrel Customs', at: 0.38, side: 1, lift: 3 }, { id: 'warden', name: 'Warden Buoy', at: 0.7, side: -1, lift: -2 }];
export const SCAN = { range: 32, half: 0.4, sweep: 0.85, rate: 0.55, fill: 1, decay: 0.45, boostMul: 2, rollCut: 0.45, rollGhost: 1.1, offset: 14 };
export const LOCK = { range: 19, fill: 2.4, decay: 0.8, rollCut: 0.65, rollGhost: 1.2, hit: 34, speed: 40, lose: 75, loseT: 3, searchT: 5 };
export const PAY = { base: 480, clean: 140, perFlag: 0.18, favorMul: 1.35 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const dist = (a, b) => len(sub(a, b));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Phobos goes round Mars slowly (angle in radians, t in seconds of run time)
export function phobosAt(a0, t) { const a = a0 + PHOBOS.w * t; return [Math.cos(a) * PHOBOS.R, PHOBOS.y, Math.sin(a) * PHOBOS.R]; }
// customs beacons sit off the Mars->Phobos line, on alternating sides; the beam's rest direction points back across the lane
export function beaconsFor(ph) {
  const d = norm(ph), side = norm([-d[2], 0, d[0]]);
  return BEACONS.map(b => { const onLine = mul(ph, b.at), pos = add(add(onLine, mul(side, SCAN.offset * b.side)), [0, b.lift, 0]);
    return { id: b.id, name: b.name, pos, rest: norm(sub(onLine, pos)) }; });
}
// beam direction: the rest direction swept left/right around the vertical axis (sin sweep, +-sweep rad)
export function beamDir(rest, t, phase = 0) {
  const a = Math.sin(t * 0.55 + phase) * SCAN.sweep, c = Math.cos(a), s = Math.sin(a);
  return norm([rest[0] * c - rest[2] * s, rest[1], rest[0] * s + rest[2] * c]);
}
export function inCone(pos, dir, p, range = SCAN.range, half = SCAN.half) {
  const v = sub(p, pos), l = len(v); if (l > range || l < 1e-6) return false;
  return dot(v, dir) / l >= Math.cos(half);
}
// does the segment a->b pass through any sphere {c, r}? (Mars and Phobos block the beam: break line of sight behind them)
export function blocked(a, b, spheres) {
  const d = sub(b, a), L2 = dot(d, d) || 1e-9;
  for (const s of spheres) { const t = clamp(dot(sub(s.c, a), d) / L2, 0, 1), q = add(a, mul(d, t)); if (dist(q, s.c) < s.r && t > 0.02 && t < 0.98) return true; }
  return false;
}
// one scan step. s = { v (0..1), ghost (s) }; seen = in the cone with line of sight. Returns the new state + flags.
export function scanStep(s, dt, { seen, boost = false, heat = 0, rolled = false }) {
  let v = s.v, ghost = Math.max(0, (s.ghost || 0) - dt), dodged = false;
  if (rolled && v > 0) { v = Math.max(0, v - SCAN.rollCut); ghost = SCAN.rollGhost; dodged = true; }
  if (seen && ghost <= 0) v += dt * SCAN.rate * (boost ? SCAN.boostMul : 1) * (1 + 0.12 * clamp(heat, 0, 5));
  else v = Math.max(0, v - dt * SCAN.decay);
  return { v: Math.min(SCAN.fill, v), ghost, flagged: v >= SCAN.fill, dodged };
}
// interceptor lock: builds while it is within range and you are not ghosting after a roll
export function lockStep(s, dt, { d, rolled = false }) {
  let v = s.v, ghost = Math.max(0, (s.ghost || 0) - dt), broke = false;
  if (rolled && v > 0) { v = Math.max(0, v - LOCK.rollCut * LOCK.fill); ghost = LOCK.rollGhost; broke = true; }
  if (d <= LOCK.range && ghost <= 0) v += dt; else v = Math.max(0, v - dt * LOCK.decay);
  const hit = v >= LOCK.fill; return { v: hit ? 0 : v, ghost: hit ? 0.8 : ghost, hit, broke };
}
export const interceptorCount = (heat, mobile) => clamp(1 + Math.floor(clamp(heat, 0, 5) / 2), 1, mobile ? 2 : 3);
// bribe: price from SSX.bribes.price (spot price at stars = heat + 1) when it exists, else this; refusal odds rise with heat
export const bribePrice = heat => Math.round((110 + 70 * clamp(heat, 0, 5)) / 5) * 5;
export const refuseChance = heat => clamp(0.12 + 0.07 * clamp(heat, 0, 5), 0.05, 0.6);
// payout: base x cargo condition, a clean-run bonus, +18% per customs flag you shook off (hot cargo pays)
export function payout(run) {
  const hp = clamp(run.hp ?? 100, 0, 100) / 100, flags = run.flags || 0;
  const cash = Math.round((PAY.base * hp * (1 + PAY.perFlag * Math.min(flags, 3)) + (flags ? 0 : PAY.clean)) / 5) * 5;
  return { cash, favorValue: Math.round(cash * PAY.favorMul) };
}
// favor = product from the contraband catalogue worth about `value` at base price, priciest first, within the room left
// items: [{ id, base, room }] -> [{ id, qty }]
export function favorBundle(value, items) {
  const out = []; let left = value;
  for (const it of [...items].filter(i => i.base > 0 && i.room > 0).sort((a, b) => b.base - a.base)) {
    const q = Math.min(it.room, Math.floor(left / it.base)); if (q > 0) { out.push({ id: it.id, qty: q }); left -= q * it.base; }
  }
  return out;
}
export const bundleValue = (b, items) => b.reduce((s, x) => s + x.qty * (items.find(i => i.id === x.id)?.base || 0), 0);
// local heat (used when SSX.pursuit is absent): 0-5, cools 1 star every 150 s
export const coolHeat = (heat, sec) => Math.max(0, (heat || 0) - Math.floor(Math.max(0, sec) / 150));

export function newRun(t, cargo = 'Red Static') { return { phase: 'outbound', t0: t, cargo, hp: 100, flags: 0, bribes: 0, dodges: 0, rolls: 0, cleared: [], heat: 0, dropped: false }; }
// phases: outbound -> (drop at Phobos) -> return -> (land on Mars) -> payout -> done | failed (dumped / seized)
export const PHASES = ['outbound', 'return', 'payout', 'done', 'failed'];
export function loadState(raw) {
  let o = null; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { o = null; }
  const n = (v, d = 0) => Number.isFinite(+v) ? +v : d;
  o = o && typeof o === 'object' ? o : {};
  return { v: 1, heat: clamp(n(o.heat), 0, 5), heatT: n(o.heatT, Date.now()), runs: n(o.runs), delivered: n(o.delivered), failed: n(o.failed), earned: n(o.earned), favors: n(o.favors) };
}
// customs chatter (M-rated, short for an iPhone toast)
export const LINES = {
  pickup: [`${FIXER}: Sealed crate. Don't open it, don't drop it, don't get scanned.`, `${FIXER}: Phobos, Stickney dock. They pay on your way back.`],
  scan: ['📡 Customs is painting you. Get out of the beam.', '📡 Scan beam on you. Roll, bribe, or run.'],
  dodge: ['📡 Lost the beam. Smooth.', '📡 Scan broke. They saw a smudge.'],
  flagged: ['🚨 Flagged. Interceptors launching.', '🚨 Customs flagged the hull. Here they come.'],
  bribeOk: ['💸 The officer pockets it. Beacon goes dark.', '💸 "Nice doing business." The beam swings away.'],
  bribeNo: ['🚨 "Are you fucking bribing me?" Flagged.', '🚨 Straight arrow. Flagged.'],
  dump: ['📦 Cargo spaced. Run over, no heat.', '📦 Crate out the airlock. Pell will be pissed.'],
  lockBroke: ['🌀 Broke the lock.', '🌀 Lock shaken.'],
  hit: ['💥 Interceptor hit. Cargo damaged.', '💥 Taking fire. The crate is leaking.'],
  seized: ['🚔 Disabled and boarded. Cargo seized.'],
  lost: ['🛰 Interceptors gave up. Keep moving.'],
  drop: ['📦 Dropped at Stickney. Now get home to Mars.', '📦 Phobos crew took the crate. Head home for your cut.'],
  home: ['💰 Home. Cash or a favor?']
};
export const line = (k, i = 0) => { const a = LINES[k] || ['']; return a[Math.abs(i | 0) % a.length]; };

// heat routing (pure): SSX.pursuit exposes addHeat / spike (main), older builds had raise. A call that throws or answers
// { ok: false } (spike refuses off Mars, e.g. a seizure in orbit) is queued as pendingWanted, applied on the next Mars
// landing. 'pit' is the fight-club safe zone: no heat, nothing queued.
export const HEAT_FNS = ['addHeat', 'spike', 'raise'];
export function routeHeat(p, n, why) {
  if (!p || typeof p !== 'object') return { via: 'local' };
  for (const k of HEAT_FNS) {
    if (typeof p[k] !== 'function') continue;
    let r; try { r = p[k](n, why); } catch (e) { continue; }
    if (r && typeof r === 'object' && r.ok === false) return r.why === 'pit' ? { via: 'pit', fn: k } : { via: 'pending', fn: k, why: r.why || 'refused' };
    return { via: 'pursuit', fn: k };
  }
  return { via: 'pending', fn: null };
}
export const queueWanted = (pending, cur, n) => clamp(Math.max(+pending || 0, +cur || 0) + n, 0, 5);
// what to set world.wanted to on landing: never lower it, round the queued stars, 0 = nothing to do
export const landWanted = (pending, cur) => { const p = Math.round(+pending || 0); return p > 0 ? Math.max(+cur || 0, p) : 0; };
