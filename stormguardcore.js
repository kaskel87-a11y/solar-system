// Storm frame-rate guard: pure rules (no DOM, no THREE), unit-tested by tests/test-stormguard-unit.mjs.
// Used by stormguard.js; the storms (modes/director.js, mars/storm.js) read the result through window.SSX.stormGuard.
export const LOW_FPS = 40, HIGH_FPS = 55;          // drop storm density below ~40 fps, give it back above ~55
export const MIN_K = 0.3, STEP_DOWN = 0.75, STEP_UP = 0.1;
export const DOWN_HOLD = 0.6, UP_HOLD = 3, COOL = 1.2; // seconds below / above before acting, seconds between drops
export const HITCH_MS = 100;                       // a frame this long is a hitch (reported, never fed to the EMA in full)
export const PHONE_MAX_PX = 10, DESKTOP_MAX_PX = 22; // biggest storm grain on screen, in drawing-buffer pixels
export const PHONE_DPR_FLOOR = 1.5;                // last resort on phones: render the storm at 1.5x instead of 2x

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const maxPx = mobile => (mobile ? PHONE_MAX_PX : DESKTOP_MAX_PX);
// how many grains to draw from a buffer of n at density k (never below 1 while k > 0)
export const drawCount = (n, k) => (n > 0 && k > 0 ? Math.max(1, Math.round(n * clamp(k, 0, 1))) : 0);

// governor: feed it real frame times (ms) while a storm is on screen; it returns the density 0.3..1
export function createGovernor(o = {}) {
  const low = o.low ?? LOW_FPS, high = o.high ?? HIGH_FPS;
  const G = { k: 1, ema: 16.7, below: 0, above: 0, cool: 0, drops: 0, raises: 0, worst: 0, hitches: 0, dprStep: false, frames: 0 };
  G.step = (ms, active = true) => {
    if (!(ms > 0) || !isFinite(ms)) return G.k;
    G.frames++; if (ms > G.worst) G.worst = ms; if (ms >= HITCH_MS) G.hitches++;
    const s = Math.min(ms, 250) / 1000; // one stall must not count as seconds of slow frames
    G.ema += (Math.min(ms, 120) - G.ema) * 0.08;
    const fps = 1000 / G.ema; G.cool = Math.max(0, G.cool - s);
    if (!active) { G.below = 0; G.dprStep = false; G.above += s; if (G.above >= UP_HOLD && G.k < 1) { G.k = Math.min(1, G.k + STEP_UP); G.above = 0; G.raises++; } return G.k; }
    if (fps < low) { G.below += s; G.above = 0; } else if (fps > high) { G.above += s; G.below = 0; } else { G.below = Math.max(0, G.below - s); G.above = 0; }
    if (G.below >= DOWN_HOLD && G.cool <= 0) {
      if (G.k > MIN_K + 1e-6) { G.k = Math.max(MIN_K, +(G.k * STEP_DOWN).toFixed(3)); G.drops++; } else G.dprStep = true; // already at the floor: ask for the resolution step (sticky until the storm ends)
      G.below = 0; G.cool = COOL;
    } else if (G.above >= UP_HOLD) {
      if (G.k < 1) { G.k = Math.min(1, +(G.k + STEP_UP).toFixed(3)); G.raises++; }
      G.above = 0;
    }
    return G.k;
  };
  G.fps = () => +(1000 / G.ema).toFixed(1);
  G.reset = () => { G.k = 1; G.ema = 16.7; G.below = G.above = G.cool = 0; G.dprStep = false; G.worst = 0; G.hitches = 0; G.frames = 0; };
  return G;
}
