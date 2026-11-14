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
