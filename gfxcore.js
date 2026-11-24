// ☰ → 🎨 Graphics. Pure tier rules (no DOM, no THREE).
// Medium is the default on every device. Nothing here looks at the phone to pick High.
// Pixel-ratio numbers are ceilings. The phone perf governor may still step down inside the cap.
export const SAVE_KEY = 'ssx.gfx.v1';
export const ORDER = ['low', 'medium', 'high'];
export const DEFAULT = 'medium';
export const LABELS = Object.freeze({ low: 'Low', medium: 'Medium', high: 'High' });

export const norm = k => (ORDER.includes(String(k || '').toLowerCase()) ? String(k).toLowerCase() : DEFAULT);
export const label = k => LABELS[norm(k)];

// dpr is the device pixel ratio. phone is true only for a small touch screen.
// Returned caps are what this tier is allowed to render at. start is what we set immediately.
export function caps(k, dpr = 1, phone = false) {
  const dev = Math.max(1, +dpr || 1);
  const key = norm(k);
  if (key === 'low') {
    const cap = Math.min(dev, 1);
    return spec(key, { cap, start: cap, shadow: false, fog: 0.62, aniso: 1, ibl: false, hemi: false, fogMatch: 0, shadowSize: 0, shadowRange: 0 });
  }
  if (key === 'high') {
    // Higher than Medium (2). A phone stays under 2.25 so opting in cannot jump to a desktop supersample.
    const cap = Math.min(dev, phone ? 2.25 : 2.5);
    return spec(key, { cap, start: cap, shadow: true, fog: 1, aniso: 8, ibl: true, hemi: true, fogMatch: 0.35, shadowSize: phone ? 512 : 1024, shadowRange: 28 });
  }
  const cap = Math.min(dev, 2);
  const start = phone ? Math.min(cap, 1.5) : cap;
  return spec(key, { cap, start, shadow: false, fog: 1, aniso: null, ibl: false, hemi: true, fogMatch: 0.35, shadowSize: 0, shadowRange: 0 });
}

function spec(tier, o) {
  return Object.freeze({ tier, tone: 'aces', output: 'srgb', ...o });
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mixHex = (a, b, t) => {
  t = clamp(t, 0, 1);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
};

// Pull fog toward the sky color. 0 leaves fog alone. Mars day/night still owns the base colors.
export const matchFog = (fog, horizon, k, dpr, phone) => {
  const m = caps(k, dpr, phone).fogMatch;
  if (!(m > 0) || fog == null || horizon == null) return fog;
  return mixHex(fog, horizon, m);
};

// v7.5.140 look slice. Tiers, shadows and the cheap environment light stay as they were.
// This is the piece the old look-dev left open, cut down so a phone on Medium does no extra pass:
// dust detail and a slightly hotter sun on Medium and High, and a screen vignette plus grain on High only.
// Low stays flat. No second render target, no bloom, no ambient occlusion.
export function lookOf(k) {
  const key = norm(k);
  if (key === 'low') return Object.freeze({ tier: key, detail: false, sun: 1, hemi: 1, post: false, grain: 0, vignette: 0, patches: 0 });
  if (key === 'high') return Object.freeze({ tier: key, detail: true, sun: 1.16, hemi: 1.06, post: true, grain: 0.22, vignette: 0.55, patches: 4 });
  return Object.freeze({ tier: 'medium', detail: true, sun: 1.1, hemi: 1.04, post: false, grain: 0, vignette: 0, patches: 3 });
}

// Drop the dust function into a MeshStandard shader. Returns null when the shader shape is not the one we know.
const DUST_FN = 'float gfxDust(vec3 p){float a=sin(p.x*0.37)*sin(p.z*0.29);float b=sin(p.x*2.15+p.z*1.63)*sin(p.x*0.91-p.z*1.77);return clamp(0.5+a*0.34+b*0.16,0.0,1.0);}';
function splice(src, needle, extra) {
  const i = src.indexOf(needle);
  if (i < 0) return null;
  return src.slice(0, i + needle.length) + extra + src.slice(i + needle.length);
}
export function dustShader(vertex, fragment) {
  const v1 = splice(vertex, 'varying vec3 vViewPosition;', '\nvarying vec3 vGfxW;');
  const v = v1 && splice(v1, '#include <skinning_vertex>', '\nvGfxW=(modelMatrix*vec4(transformed,1.0)).xyz;');
  let f = splice(fragment, 'varying vec3 vViewPosition;', '\nvarying vec3 vGfxW;');
  f = f && splice(f, '#include <common>', '\n' + DUST_FN);
  f = f && splice(f, '#include <color_fragment>', '\n{float d=gfxDust(vGfxW);diffuseColor.rgb*=mix(vec3(0.70,0.60,0.52),vec3(1.16,1.05,0.90),d);}');
  f = f && splice(f, '#include <roughnessmap_fragment>', '\nroughnessFactor=clamp(roughnessFactor+(gfxDust(vGfxW)-0.5)*0.22,0.08,1.0);');
  if (!v || !f) return null;
  return { vertex: v, fragment: f };
}

// A big plain surface earns the dust. The shared ground material counts even though it already has a grain map.
// Glass, skin, glow, and anything with its own picture stay as they are.
export function wantsDetail(o) {
  if (!o || o.basic || o.transparent || o.skinned) return false;
  if ((+o.emissive || 0) > 0.25) return false;
  if (o.skip) return false;
  if (o.terrain) return true;
  if (o.hasMap) return false;
  return (+o.radius || 0) >= 4;
}
