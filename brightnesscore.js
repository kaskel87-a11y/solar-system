// ☰ → ☀️ Brightness: pure rules (no DOM, no THREE) so tests/test-brightness-unit.mjs can check them in node.
// Two layers:
//  1) render-time lift, applied to EVERY render (space, every planet, interiors, classic and the v8 look): exposure x exp,
//     hemisphere / ambient light x amb, plus a dark-scene floor that only kicks in when a hemi / ambient light has been
//     dimmed below REF (night, street-night, dim rooms). Bright day scenes at Normal are untouched.
//  2) Mars night floor through SSX.time.addLookFilter: the time.js night keeps more sun-fill / hemi and a slightly lifted
//     violet fog + horizon, so ground, roads, buildings and the player read on a phone. Stars and neon stay; it never
//     approaches day (hemi floor < 0.5 x day, sun-fill < 0.25 x day at Normal).
export const SAVE_KEY = 'ssx.bright.v1';
export const ORDER = ['low', 'normal', 'high', 'max'];
export const DEFAULT = 'normal';
export const LEVELS = Object.freeze({
  // exp: exposure x everywhere; nightExp: extra exposure x(1 + nightExp * darkness) on the Mars night; amb: hemi / ambient x;
  // floor: added to dim hemi / ambient lights; night: strength of the Mars night floor (1 = the default look)
  low:    Object.freeze({ label: 'Low',    exp: 0.9,  nightExp: 0,    amb: 0.85, floor: 0.1,  night: 0.5 }),
  normal: Object.freeze({ label: 'Normal', exp: 1.0,  nightExp: 0.36, amb: 1.0,  floor: 0.26, night: 1.0 }),
  high:   Object.freeze({ label: 'High',   exp: 1.15, nightExp: 0.45, amb: 1.3,  floor: 0.4,  night: 1.4 }),
  max:    Object.freeze({ label: 'Max',    exp: 1.32, nightExp: 0.65, amb: 1.6,  floor: 0.56, night: 1.8 })
});
export const REF = 0.9; // hemi / ambient intensities at or above this count as "lit"; the floor fades out toward it
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const level = k => LEVELS[ORDER.includes(k) ? k : DEFAULT];
export const norm = k => (ORDER.includes(String(k).toLowerCase()) ? String(k).toLowerCase() : DEFAULT);
export const next = k => ORDER[(ORDER.indexOf(norm(k)) + 1) % ORDER.length];
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// effective hemi / ambient intensity for a render
export function liftAmbient(i, k) { const L = level(k); return i * L.amb + L.floor * smooth(1 - i / REF); }
export const liftExposure = (e, k, dark = 0) => e * level(k).exp * (1 + level(k).nightExp * clamp(dark, 0, 1));
export const mixHex = (a, b, t) => { t = clamp(t, 0, 1); const r = Math.round(lerp(a >> 16 & 255, b >> 16 & 255, t)), g = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t)); return (r << 16) | (g << 8) | bl; };
// Mars night floor, as fractions of the day values (timecore night is 0.09 light / 0.26 hemi)
export const NIGHT_LIFT = Object.freeze({ light: 0.1, hemi: 0.19, fog: 0x2e1c42, horizon: 0x2e1a3c, fogMix: 0.55, horizonMix: 0.35 });
export function nightFloor(L, base, k) {
  if (!L || !base) return L; const n = clamp(L.night ?? 0, 0, 1), s = level(k).night * n; if (s <= 0) return L;
  const out = { ...L };
  out.light = Math.max(L.light, base.light * (0.09 + NIGHT_LIFT.light * s));
  out.hemi = Math.max(L.hemi, base.hemi * (0.26 + NIGHT_LIFT.hemi * s));
  out.fog = mixHex(L.fog, NIGHT_LIFT.fog, NIGHT_LIFT.fogMix * Math.min(1, s));
  out.horizon = mixHex(L.horizon, NIGHT_LIFT.horizon, NIGHT_LIFT.horizonMix * Math.min(1, s));
  return out;
}
