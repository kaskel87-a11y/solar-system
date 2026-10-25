// Director mode: pure rules (no DOM, no THREE) so tests/test-director-unit.mjs can check them in node.
export const DEFAULTS = Object.freeze({
  v: 1,
  storm: 'off',          // 'off' | 'light' | 'heavy'
  tod: null,             // null = the game's own lighting; else hour 0..24
  freeze: false,         // stop the clock (only when tod is set)
  timeScale: 1,          // in-game hours per real minute
  noCops: false, invincible: false, ammo: false,
  density: 'normal'      // 'normal' | 'sparse' | 'empty'
});
export const PRESETS = { dawn: 6.4, noon: 12, dusk: 18.3, night: 23 };
export const TIME_SCALES = [0.5, 1, 4, 16];
export const STORMS = ['off', 'light', 'heavy'];
export const DENSITIES = ['normal', 'sparse', 'empty'];
export const CHEATS = ['noCops', 'invincible', 'ammo', 'vehicle'];
export const SAVE_KEY = 'ssx.director.v1';
export const PHONE_CAP = 12;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function sanitize(s) {
  const o = { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
  if (!STORMS.includes(o.storm)) o.storm = 'off';
  if (!DENSITIES.includes(o.density)) o.density = 'normal';
  o.tod = o.tod == null || !Number.isFinite(+o.tod) ? null : ((+o.tod % 24) + 24) % 24;
  o.timeScale = TIME_SCALES.includes(+o.timeScale) ? +o.timeScale : 1;
  for (const k of ['freeze', 'noCops', 'invincible', 'ammo']) o[k] = !!o[k];
  o.v = 1; return o;
}
// which cheats are on (session flags like a spawned vehicle come in through `session`)
export function activeCheats(s, session = {}) {
  const on = [];
  if (s.noCops) on.push('noCops'); if (s.invincible) on.push('invincible'); if (s.ammo) on.push('ammo');
  if (session.vehicle) on.push('vehicle');
  return on;
}
export const rewardsBlocked = (s, session) => activeCheats(s, session).length > 0;

export function advanceClock(h, dtSec, s) {
  if (h == null || s.freeze) return h;
  return ((h + dtSec / 60 * s.timeScale) % 24 + 24) % 24;
}

// ---- time of day: sun elevation -1..1, then lighting factors and colours (ints 0xRRGGBB) relative to the planet's base look ----
export const sunElev = h => Math.sin(((h - 6) / 24) * Math.PI * 2);
const mixHex = (a, b, t) => { t = clamp(t, 0, 1); const r = Math.round(lerp(a >> 16 & 255, b >> 16 & 255, t)), g = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t)); return (r << 16) | (g << 8) | bl; };
export { mixHex };
export const NIGHT = { top: 0x04050c, horizon: 0x16121c, light: 0x8fa6ff };
export const TWILIGHT = { top: 0x3b2c48, horizon: 0x7d9ccc, light: 0xb8c8ff }; // Mars sunsets are blue near the sun
export function todLook(h, base) {
  const e = sunElev(h), day = smooth(-0.14, 0.28, e), tw = Math.exp(-(((e - 0.02) / 0.2) ** 2)) * (1 - 0.5 * day);
  let top = mixHex(NIGHT.top, base.top, day), horizon = mixHex(NIGHT.horizon, base.horizon, day);
  top = mixHex(top, TWILIGHT.top, tw * 0.7); horizon = mixHex(horizon, TWILIGHT.horizon, tw * 0.8);
  const lightColor = mixHex(mixHex(NIGHT.light, base.lightColor, day), TWILIGHT.light, tw * 0.6);
  // sun direction: rises in the east (+x), sets in the west; a dim "moon" light from above at night
  const a = ((h - 6) / 12) * Math.PI, sun = { x: Math.cos(a), y: Math.max(0.08, Math.sin(a)), z: -0.55 };
  const moon = { x: -0.4, y: 0.8, z: 0.3 };
  const dir = day > 0.15 ? sun : moon;
  return { e, day, twilight: tw, top, horizon, fog: horizon, lightColor, light: base.light * lerp(0.1, 1, day), hemi: base.hemi * lerp(0.28, 1, day), dir, sunVisible: e > -0.08, stars: clamp(1 - day * 1.6, 0, 1) };
}

// ---- dust storms ----
export const STORM_COLOR = 0xb9784a;
export function stormParams(level, mobile) {
  if (level === 'heavy') return { near: 1.5, far: 24, mix: 0.85, count: mobile ? 360 : 1400, size: mobile ? 0.5 : 0.38, wind: 15, opacity: 0.7 };
  if (level === 'light') return { near: 6, far: 62, mix: 0.45, count: mobile ? 160 : 600, size: mobile ? 0.42 : 0.32, wind: 6, opacity: 0.5 };
  return { near: Infinity, far: Infinity, mix: 0, count: 0, size: 0, wind: 0, opacity: 0 };
}
// gusting wind: slowly veering heading, speed pulses (m/s)
export function windAt(t, level) {
  const p = stormParams(level, true); if (!p.wind) return { x: 0, z: 0, speed: 0, heading: 0 };
  const heading = 0.6 + Math.sin(t * 0.031) * 0.9 + Math.sin(t * 0.0071) * 0.6, speed = p.wind * (0.75 + 0.25 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1));
  return { x: Math.cos(heading) * speed, z: Math.sin(heading) * speed, speed, heading };
}

// ---- NPC density: slots reserved under 'director' so ambient walkers shrink (never adds people, so the phone cap of 12 holds) ----
export function densityReserve(level, cap, mobile) {
  if (level === 'sparse') return mobile ? 4 : Math.round(cap * 0.4);
  if (level === 'empty') return mobile ? 8 : Math.round(cap * 0.75);
  return 0;
}
