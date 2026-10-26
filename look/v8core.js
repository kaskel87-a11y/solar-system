// v8 realistic look: pure data + decisions (no DOM, no three.js) so tests/test-v8-unit.mjs can run it in node.
// Values follow the look-dev (kaskel87-a11y/solar-system-lookdev src/quality.js, post.js) and the ART.md brief (§2, §8).

// 'classic' is the pre-v8 look (no v8 code touches the frame); the four real tiers go low -> ultra.
export const ORDER = ['low', 'med', 'high', 'ultra'];
export const TIERS = {
  classic: { name: 'classic', label: 'Classic (v7)' },
  low: { name: 'low', label: 'Low', pixelRatio: 1.25, shadow: 1024, shadowSoft: false, shadowRange: 30, shadowEvery: 2, post: false, msaa: 0,
    bloomScale: 0, ao: false, grain: false, vignette: false, envEvery: 4, detail: 1, triplanar: false, weather: true, aniso: 2 },
  med: { name: 'med', label: 'Medium', pixelRatio: 1.5, shadow: 1024, shadowSoft: false, shadowRange: 34, shadowEvery: 1, post: true, msaa: 0,
    bloomScale: 0.5, ao: false, grain: true, vignette: true, envEvery: 2, detail: 2, triplanar: false, weather: true, aniso: 4 },
  high: { name: 'high', label: 'High', pixelRatio: 2, shadow: 2048, shadowSoft: true, shadowRange: 42, shadowEvery: 1, post: true, msaa: 4,
    bloomScale: 0.75, ao: false, grain: true, vignette: true, envEvery: 1, detail: 2, triplanar: true, weather: true, aniso: 8 },
  ultra: { name: 'ultra', label: 'Ultra', pixelRatio: 2, shadow: 4096, shadowSoft: true, shadowRange: 48, shadowEvery: 1, post: true, msaa: 4,
    bloomScale: 1, ao: true, grain: true, vignette: true, envEvery: 0.5, detail: 2, triplanar: true, weather: true, aniso: 16 },
};
for (const k in TIERS) Object.freeze(TIERS[k]);

// Light rig (ART.md §2/§3 Mars): the env map now carries most of the ambient, so the hemisphere is cut back and the
// sun pushed a little so the long shadows read. Applied at render time only, so SSX.time / Director keep their own values.
export const RIG = { sun: 1.25, hemi: 0.5, env: 0.6, envIndoor: 0.28, emissiveNight: 1.4 };

// device class from cheap signals; phones default to med (brief), desktops to high, weak laptops/tablets to med
export function deviceClass({ ua = '', touch = false, mem = 8, cores = 8, gpu = '', w = 1920, h = 1080 } = {}) {
  const phone = /iPhone|iPod|Android.*Mobile|Mobile Safari/i.test(ua) || (touch && Math.min(w, h) < 520);
  if (phone) return 'phone';
  const tablet = /iPad|Android/i.test(ua) || (touch && Math.min(w, h) < 1100);
  const weakGpu = /swiftshader|llvmpipe|software|mali-4|adreno \(tm\) [3-5]|intel\(r\) (hd|uhd) graphics [2-6]/i.test(gpu);
  if (tablet || weakGpu || mem <= 4 || cores <= 4) return 'mid';
  return 'desktop';
}
export const DEFAULT_TIER = { phone: 'med', mid: 'med', desktop: 'high' };

// choose the tier: ?look=/?tier= param > saved pick > device default. Returns { tier, auto }.
export function pickTier({ param = null, saved = null, cls = 'desktop' } = {}) {
  const ok = t => t === 'classic' || ORDER.includes(t);
  if (param && param !== 'auto' && ok(param)) return { tier: param, auto: false, why: 'param' };
  if (param !== 'auto' && saved && saved.tier && ok(saved.tier) && !saved.auto) return { tier: saved.tier, auto: false, why: 'saved' };
  return { tier: DEFAULT_TIER[cls] || 'med', auto: true, why: 'auto' };
}
export const stepDown = t => { const i = ORDER.indexOf(t); return i > 0 ? ORDER[i - 1] : t; };

// FPS governor (auto tier only): step down one tier after `need` consecutive windows under `floor` fps.
export function governor({ floor = 24, need = 2 } = {}) {
  let bad = 0;
  return {
    sample(fps, tier) { if (tier === 'low' || tier === 'classic') { bad = 0; return null; } bad = fps < floor ? bad + 1 : 0; if (bad >= need) { bad = 0; return stepDown(tier); } return null; },
    reset() { bad = 0; }, get bad() { return bad; }
  };
}

// grade per world (ART.md §8): sat, contrast, lift rgb, gain rgb
export const GRADES = {
  Mars: [1.10, 1.08, [0.012, 0.016, 0.022], [1.04, 1.0, 0.94]],
  Moon: [0.85, 1.15, [0.008, 0.008, 0.012], [0.98, 1.0, 1.03]],
  Ceres: [0.95, 1.12, [0.006, 0.008, 0.016], [1.03, 1.0, 0.94]],
  Europa: [0.9, 1.05, [0.010, 0.016, 0.030], [0.96, 1.0, 1.06]],
  Titan: [1.05, 0.95, [0.020, 0.012, 0.004], [1.05, 0.98, 0.86]],
  Mercury: [0.9, 1.2, [0.004, 0.004, 0.006], [1.02, 1.0, 0.97]],
  Venus: [1.15, 0.98, [0.024, 0.010, 0.002], [1.06, 0.97, 0.84]],
  club: [1.2, 1.1, [0.016, 0.006, 0.024], [1.04, 0.96, 1.02]],
  default: [1.04, 1.05, [0.008, 0.010, 0.014], [1.02, 1.0, 0.98]],
};
export function gradeFor(world, insideKind) {
  if (insideKind === 'club') return GRADES.club;
  return GRADES[world] || GRADES.default;
}
// bloom + grain/vignette by nightness n (0 day .. 1 night) and indoors (ART.md §8: day 0.45/0.5/1.2, night+interiors 0.8/0.6/1.0)
export function postParams(n = 0, indoor = false) {
  const k = indoor ? 1 : Math.max(0, Math.min(1, n));
  const lerp = (a, b) => a + (b - a) * k;
  return { strength: lerp(0.45, 0.8), radius: lerp(0.5, 0.6), threshold: lerp(1.2, 1.0), grain: lerp(0.035, 0.05), vignette: indoor ? 0.4 : lerp(0.3, 0.34) };
}
// nightness when SSX.time is absent: from the sun's elevation (dir.y, unit vector)
export const nightFromSun = y => Math.max(0, Math.min(1, (0.12 - y) / 0.22));

// does the env map need rebuilding? sig = [r,g,b,...] numbers; rebuild when the max abs diff passes eps
export function sigChanged(a, b, eps = 0.02) {
  if (!a || !b || a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) return true;
  return false;
}
// shadow camera centre snapped to the shadow texel grid along the light's right/up axes (kills shimmering)
export function snapTexel(u, v, range, size) { const t = (2 * range) / size; return [Math.round(u / t) * t, Math.round(v / t) * t]; }

// material classification for the upgrade pass: which detail set (if any) a plain MeshStandard material gets
export function detailSetFor({ metalness = 0, roughness = 1, transparent = false, hasMap = false, maxRadius = 0, skinned = false, emissive = 0 } = {}) {
  if (transparent || hasMap || skinned || emissive > 0.25) return null;
  if (maxRadius < 1.4) return null; // small parts (vehicles, people, props) keep their paint; they still get env + weather
  return metalness >= 0.35 ? 'metal_panels' : 'concrete';
}

// weathering dust per world (ART.md §3 palettes); amount scales with how lived-in the place is
export const DUST = { Mars: 0xa8583a, Moon: 0x8d8a86, Mercury: 0x7a7068, Ceres: 0x6e6a66, Europa: 0xc8d2dc, Titan: 0x7a5a30, Venus: 0x9a6a3a, Io: 0xc8b060, default: 0x8a7a6a };
export const dustFor = w => DUST[w] ?? DUST.default;
export const weatherAmount = (w, big) => (w === 'Europa' ? 0.2 : w === 'Mars' ? 0.5 : 0.35) * (big ? 1 : 0.55);
