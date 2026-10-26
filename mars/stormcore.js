// Mars dust storms: pure logic (no THREE, no DOM), so node can test it. Runtime: mars/storm.js (window.SSX.storm).
// A storm runs clear -> building -> peak -> clearing -> clear. Intensity I (0..1) is smooth through each ramp, and every
// effect is a function of I: fog distance, sky / light tint, grit particle opacity, traffic speed, heat gain.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---- quality tiers: grit particle count (phone / desktop), peak fog distances, point size ----
export const TIERS = {
  low: { phone: 160, desktop: 320, near: 2, far: 30, size: 0.9 },
  med: { phone: 420, desktop: 800, near: 3, far: 38, size: 0.75 },
  high: { phone: 700, desktop: 1500, near: 3, far: 44, size: 0.6 },
  ultra: { phone: 800, desktop: 2000, near: 3, far: 48, size: 0.55 }
};
const ALIAS = { medium: 'med', m: 'med', l: 'low', h: 'high', u: 'ultra', classic: null, auto: null };
export function normTier(t) { if (typeof t !== 'string') return null; const k = t.trim().toLowerCase(); const a = k in ALIAS ? ALIAS[k] : k; return a && TIERS[a] ? a : null; }
// override (?stormq=) > the app tier (SSX.look / SSX.quality) > stored setting > device default (phones med, desktop high)
export function pickTier({ override, app, stored, mobile } = {}) { return normTier(override) || normTier(app) || normTier(stored) || (mobile ? 'med' : 'high'); }
export const particles = (tier, mobile) => (TIERS[normTier(tier) || 'med'])[mobile ? 'phone' : 'desktop'];

// ---- schedule (seconds of storm clock: real seconds x SSX.time scale while on the Mars surface) ----
export const SCHED = { first: [360, 600], gap: [540, 960], build: [28, 40], peak: [50, 80], clear: [28, 40] };
export const PHASES = ['clear', 'building', 'peak', 'clearing'];
const span = (r, rnd) => r[0] + (r[1] - r[0]) * rnd();
// a storm cycle: step(dt) -> { phase, I, changed }. start()/stop() are the manual triggers (?storm=1, SSX.storm.start()).
export function createCycle({ rnd = Math.random, sched = SCHED, periodic = true } = {}) {
  const C = { phase: 'clear', t: 0, len: span(sched.first, rnd), I: 0, peakI: 1, periodic, durs: null, manual: false, count: 0 };
  const next = (phase, len) => { C.phase = phase; C.t = 0; C.len = len; return true; };
  C.start = (o = {}) => {
    const d = { build: o.build ?? span(sched.build, rnd), peak: o.peak ?? span(sched.peak, rnd), clear: o.clear ?? span(sched.clear, rnd) };
    C.durs = d; C.peakI = clamp(o.intensity ?? 1, 0.05, 1); C.manual = !!o.manual; C.count++;
    if (o.instant) { C.I = C.peakI; return next('peak', d.peak); }
    // already in a storm: extend it (building keeps building, clearing turns round), never snap the look
    if (C.phase === 'clearing') { C.from = C.I; return next('building', d.build * (1 - C.I / C.peakI) + 0.5); }
    if (C.phase === 'peak') { C.len = Math.max(C.len, C.t + d.peak); return true; }
    if (C.phase === 'building') return true;
    C.from = C.I; return next('building', d.build);
  };
  C.stop = (o = {}) => {
    if (o.instant) { C.I = 0; next('clear', span(sched.gap, rnd)); return true; }
    if (C.phase === 'clear' || C.phase === 'clearing') return false;
    const len = o.clear ?? (C.durs?.clear ?? span(sched.clear, rnd)); next('clearing', len); C.from = C.I; return true;
  };
  C.step = dt => {
    const was = C.phase; C.t += Math.max(0, dt);
    if (C.phase === 'clear') { C.I = 0; if (C.periodic && C.t >= C.len) C.start(); }
    else if (C.phase === 'building') { C.I = lerp(C.from || 0, C.peakI, smooth(C.t / C.len)); if (C.t >= C.len) { C.I = C.peakI; next('peak', C.durs.peak); } }
    else if (C.phase === 'peak') { C.I = C.peakI * (0.92 + 0.08 * Math.cos(C.t * 0.9)); if (C.t >= C.len) { C.from = C.I; next('clearing', C.durs.clear); } } // gusts
    else if (C.phase === 'clearing') { C.I = (C.from ?? C.peakI) * (1 - smooth(C.t / C.len)); if (C.t >= C.len) { C.I = 0; C.manual = false; next('clear', span(sched.gap, rnd)); } }
    return { phase: C.phase, I: C.I, changed: was !== C.phase ? [was, C.phase] : null };
  };
  return C;
}

// ---- look ----
export const DUST = { fog: 0xa4532e, top: 0x5c2410, horizon: 0xb4602f, light: 0xff9a66, night: 0x2a140c };
export function mixHex(a, b, t) {
  t = clamp(t, 0, 1); const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}
// fog only ever closes in: whatever the base (core zoom, v8, SSX.time, Director) set this frame, we pull toward the
// storm distances and never push it further out
export function fogFor(near, far, I, tier = 'med') {
  const T = TIERS[normTier(tier) || 'med'], k = smooth(I);
  return { near: Math.min(near, lerp(near, T.near, k)), far: Math.min(far, Math.max(T.far, lerp(far, T.far, k))) };
}
export function dustColors(I, night = 0) {
  const n = clamp(night, 0, 1);
  return { fog: mixHex(DUST.fog, DUST.night, n * 0.8), top: mixHex(DUST.top, DUST.night, n * 0.8), horizon: mixHex(DUST.horizon, DUST.night, n * 0.75), light: DUST.light, mix: clamp(I * 1.1, 0, 1) };
}
// a SSX.time look filter (or the fallback overlay): tint the sky / fog / light toward the dust colour
export function tintLook(L, I) {
  if (!L || I <= 0) return L;
  const D = dustColors(I, L.night ?? (L.day != null ? 1 - L.day : 0)), m = D.mix;
  return { ...L, top: mixHex(L.top, D.top, m), horizon: mixHex(L.horizon, D.horizon, m), fog: mixHex(L.fog ?? L.horizon, D.fog, m),
    lightColor: mixHex(L.lightColor ?? 0xffffff, D.light, m * 0.7), light: L.light * (1 - 0.45 * I), hemi: L.hemi * (1 - 0.2 * I),
    sunVisible: L.sunVisible !== false && I < 0.55, stars: (L.stars || 0) * (1 - I), storm: I };
}

// ---- gameplay ----
export const trafficScale = I => +(1 - 0.45 * smooth(I)).toFixed(3); // peak: traffic at 55% speed
export const heatScale = I => +(1 - 0.5 * clamp(I, 0, 1)).toFixed(3); // peak: crimes gain half the heat
// damp a wanted rise from -> to by k; the fractional remainder carries to the next crime, so two 1-star crimes at peak
// still cost 1 star. Drops (to < from) pass straight through.
export function dampRise(from, to, k, carry = 0) {
  if (!(to > from) || k >= 1) return { to, carry: k >= 1 ? 0 : carry, shed: 0 };
  const eff = (to - from) * clamp(k, 0, 1) + carry, n = Math.floor(eff + 1e-9);
  return { to: from + n, carry: eff - n, shed: (to - from) - n };
}
export const visibility = (far, I, tier) => Math.round(fogFor(far * 0.3, far, I, tier).far); // metres the fog lets you see

// ---- HUD caption (short, edge of screen) ----
export function caption(phase, I, heatK) {
  if (phase === 'building') return '🌪️ Dust storm rolling in';
  if (phase === 'peak') return `🌪️ Dust storm · low visibility · heat −${Math.round((1 - heatK) * 100)}%`;
  if (phase === 'clearing') return '🌤️ Storm clearing';
  return '';
}
