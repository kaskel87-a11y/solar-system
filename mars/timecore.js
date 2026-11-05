// Mars day/night cycle: pure rules (no DOM, no THREE) so tests/test-time-unit.mjs can check them in node.
// One game day = DAY_MIN real minutes at scale 1 (default 24, so 1 game hour = 1 real minute, the same "1x" Director uses).
export const DAY_MIN = 24;
export const SAVE_KEY = 'ssx.time.v1';
export const DEFAULTS = Object.freeze({ v: 1, h: 9, scale: 1, frozen: false });
export const PHASES = ['dawn', 'day', 'dusk', 'night'];
// phase windows in game hours, the same bands as dangercore.timeBand() so the street-danger director and SSX.time agree:
// dawn 05-08, day 08-17, dusk 17-21, night 21-05 (isNight() === timeBand(h) === 'night')
export const NIGHT_START = 21, NIGHT_END = 5;
export const WINDOWS = Object.freeze({ dawn: [5, 8], day: [8, 17], dusk: [17, 21], night: [21, 5] });
export const PRESETS = Object.freeze({ dawn: 6.5, noon: 12, dusk: 19, night: 23, midnight: 0 });
export const MAX_SCALE = 240;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrap = h => ((+h % 24) + 24) % 24;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function sanitize(s) {
  const o = { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
  o.h = Number.isFinite(+o.h) ? wrap(+o.h) : DEFAULTS.h;
  o.scale = Number.isFinite(+o.scale) ? clamp(+o.scale, 0, MAX_SCALE) : 1;
  o.frozen = !!o.frozen; o.v = 1;
  return { v: o.v, h: o.h, scale: o.scale, frozen: o.frozen };
}
export function phaseOf(h) {
  h = wrap(h);
  if (h >= NIGHT_START || h < NIGHT_END) return 'night';
  if (h < 8) return 'dawn';
  if (h < 17) return 'day';
  return 'dusk';
}
export const isNightAt = h => phaseOf(h) === 'night';
// game hours gained in dtSec real seconds
export const hoursPer = (dtSec, scale = 1, dayMin = DAY_MIN) => dtSec * scale * 24 / (dayMin * 60);
export function advance(h, dtSec, scale = 1, frozen = false, dayMin = DAY_MIN) {
  if (frozen || !(dtSec > 0) || !(scale > 0)) return wrap(h);
  return wrap(h + hoursPer(dtSec, scale, dayMin));
}
// game hours until hour `to` comes round next (0 when it is now)
export const hoursUntil = (h, to) => wrap(to - h);
// real seconds until the next night (0 if night already)
export function secondsToNight(h, scale = 1, dayMin = DAY_MIN) {
  if (isNightAt(h)) return 0; if (!(scale > 0)) return Infinity;
  return hoursUntil(h, NIGHT_START) * dayMin * 60 / 24 / scale;
}
// 0 (full day) .. 1 (full night): ramps up 18:30-21:00 after sunset and back down 05:00-07:00 around sunrise
export function nightness(h) {
  h = wrap(h);
  if (h >= NIGHT_START || h < NIGHT_END) return 1;
  if (h >= 7 && h < 18.5) return 0;
  if (h >= 18.5) return smooth(18.5, NIGHT_START, h);
  return 1 - smooth(NIGHT_END, 7, h);
}
// street crime weight for random-event / street-danger spawners: 1 by day, 1.9 at night (peaks 0-3 am)
export function crimeMultiplier(h) {
  const n = nightness(h), late = (wrap(h) >= 0 && wrap(h) < 3) ? 0.2 : 0;
  return Math.round((1 + 0.9 * n + late * n) * 100) / 100;
}
// ColSec response: full strength by day, the skeleton night shift (0.5) at night
export const copsMultiplier = h => Math.round((1 - 0.5 * nightness(h)) * 100) / 100;
// how much brighter neon and club fronts read (0 by day .. 1 at night)
export const neonBoost = h => nightness(h);

// ---- look: sun elevation, then lighting factors and colours (ints 0xRRGGBB) relative to the planet's base look ----
// sun rises ~06:12 (mid-dawn) and sets ~19:24 (mid-dusk), full dark by ~20:30; night is dark and seedy (deep violet sky, low cold light) but still playable
// the sun is up 06:12-19:24, so it rises mid-dawn and sets mid-dusk
export const SUNRISE = 6.2, SUNSET = 19.4;
export const sunElev = h => { h = wrap(h); const d = SUNSET - SUNRISE;
  if (h >= SUNRISE && h <= SUNSET) return Math.sin(Math.PI * (h - SUNRISE) / d);
  return -Math.sin(Math.PI * wrap(h - SUNSET) / (24 - d)); };
export const mixHex = (a, b, t) => { t = clamp(t, 0, 1); const r = Math.round(lerp(a >> 16 & 255, b >> 16 & 255, t)), g = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t)); return (r << 16) | (g << 8) | bl; };
export const NIGHT = { top: 0x030308, horizon: 0x1a0e22, light: 0x7f8cff, fog: 0x140b1c };
export const TWILIGHT = { top: 0x3b2c48, horizon: 0x7d9ccc, light: 0xb8c8ff }; // Mars sunsets are blue near the sun
export function look(h, base) {
  h = wrap(h);
  const e = sunElev(h), day = smooth(-0.14, 0.28, e), tw = Math.exp(-(((e - 0.02) / 0.2) ** 2)) * (1 - 0.5 * day);
  let top = mixHex(NIGHT.top, base.top, day), horizon = mixHex(NIGHT.horizon, base.horizon, day), fog = mixHex(NIGHT.fog, base.fog ?? base.horizon, day);
  top = mixHex(top, TWILIGHT.top, tw * 0.7); horizon = mixHex(horizon, TWILIGHT.horizon, tw * 0.8); fog = mixHex(fog, TWILIGHT.horizon, tw * 0.6);
  const lightColor = mixHex(mixHex(NIGHT.light, base.lightColor, day), TWILIGHT.light, tw * 0.6);
  // sun from the east (+x) to the west; a dim cold "Phobos" fill from high up at night
  const a = Math.PI * (h - SUNRISE) / (SUNSET - SUNRISE), sun = { x: Math.cos(a), y: Math.max(0.08, Math.sin(a)), z: -0.55 };
  const moon = { x: -0.4, y: 0.8, z: 0.3 };
  return { h, e, day, twilight: tw, night: nightness(h), top, horizon, fog, lightColor,
    light: base.light * lerp(0.09, 1, day), hemi: base.hemi * lerp(0.26, 1, day),
    dir: day > 0.15 ? sun : moon, sunAngle: a, sunVisible: e > -0.08, stars: clamp(1 - day * 1.6, 0, 1), neon: neonBoost(h) };
}
export const hhmm = h => { const m = Math.round(wrap(h) * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
