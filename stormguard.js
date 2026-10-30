// Storm frame-rate guard (Steve, storm perf): keeps Mars dust storms smooth on phones. Rules live in stormguardcore.js.
//  * measures the real frame time on the Mars surface; while a storm is on screen and the frame rate stays under ~40 fps it
//    drops storm density (the Director's dust and Ben's grit draw fewer grains), and gives it back above ~55 fps
//  * last resort on phones, only during a storm: render at 1.5x instead of 2x, put back when the storm clears or you leave
//  * shader prewarm: prewarm(obj) compiles an object's materials outside the frame that first shows it, one new shader per
//    frame (or in parallel where KHR_parallel_shader_compile exists), optionally hiding it until ready, so things that
//    stream in when you start walking (grime districts) or storms that start later don't freeze the game for a second
// Window API: SSX.stormGuard = { density(), maxPx(mobile), fps(), state(), prewarm(obj, { hide }), force(k|null), reset() }
// Debug: ?stormk=0.5 pins the density, ?perfhud=1 shows a small fps / density / worst-frame chip.
import * as C from './stormguardcore.js';

const G = C.createGovernor();
const S = { last: 0, on: false, forced: null, dpr0: null, dprLow: false, jobs: [], compiled: 0, hud: null, hudT: 0, worst: 0, hitches: 0, frames: 0 };
const warned = new Set(); const warnOnce = (k, e) => { if (warned.has(k)) return; warned.add(k); console.warn('[stormguard] ' + k, e); };
try { const q = new URLSearchParams(location.search); const k = parseFloat(q.get('stormk')); if (isFinite(k)) S.forced = C.clamp(k, 0, 1); S.hudOn = q.get('perfhud') === '1'; } catch { /* */ }
const app = () => window.__app;

function stormOn(tc) {
  if (tc.name !== 'Mars' || tc.world?.inside) return false;
  try { const st = window.SSX?.storm; if (st?.active?.() && st.intensity() > 0.05) return true; } catch { /* */ }
  try { const d = window.SSX?.director?.state; const s = typeof d === 'function' ? d()?.storm : d?.storm; if (s && s !== 'off') return true; } catch { /* */ }
  return false;
}

// ---------- resolution step (phones, storm only) ----------
function setDprLow(low) {
  const R = app()?.renderer; if (!R?.setPixelRatio || low === S.dprLow) return;
  try {
    if (low) { const cur = R.getPixelRatio(); if (cur <= C.PHONE_DPR_FLOOR) return; S.dpr0 = cur; R.setPixelRatio(C.PHONE_DPR_FLOOR); S.dprLow = true; }
    else { if (S.dpr0) R.setPixelRatio(S.dpr0); S.dpr0 = null; S.dprLow = false; }
  } catch (e) { warnOnce('dpr', e); }
}

// ---------- shader prewarm ----------
const PAR = () => { try { return !!app()?.renderer?.extensions?.has?.('KHR_parallel_shader_compile'); } catch { return false; } };
const texOf = (m, out) => { for (const k in m) { const v = m[k]; if (v?.isTexture) out.add(v); } const u = m.uniforms; if (u) for (const k in u) { const v = u[k]?.value; if (v?.isTexture) out.add(v); } };
export function prewarm(obj, o = {}) {
  if (!obj?.traverse) return false;
  const leaves = [], tex = new Set(); obj.traverse(c => { if ((c.isMesh || c.isPoints || c.isLine || c.isSprite) && c.material) { leaves.push(c); for (const m of [].concat(c.material)) if (m) texOf(m, tex); } });
  if (!leaves.length) return false;
  const job = { obj, leaves, i: 0, tex: [...tex], ti: 0, phase: 'wait', hide: !!o.hide, hidden: false, t0: performance.now(), done: false };
  if (job.hide && obj.visible) { obj.visible = false; job.hidden = true; }
  S.jobs.push(job); return true;
}
function finish(job) { job.done = true; if (job.hidden && !job.obj.visible) job.obj.visible = true; S.compiled++; }
// Each job runs in phases, never in the frame that queued it (that frame already paid for building the object):
// wait -> compile (one new program per frame, or async in parallel) -> textures (one upload per frame) -> show.
function runJobs(tc) {
  if (!S.jobs.length) return; const R = app()?.renderer; if (!R?.compile) { S.jobs.forEach(finish); S.jobs = []; return; }
  const scene = tc.scene, cam = tc.camera, t0 = performance.now();
  for (const job of S.jobs) {
    if (job.done) continue;
    if (!job.obj.parent && job.obj !== scene) { finish(job); continue; } // removed before it was ready
    if (performance.now() - job.t0 > 4000) { finish(job); continue; }   // never hold anything back for long
    if (job.phase === 'wait') { job.phase = 'compile'; break; }
    if (job.phase === 'compile') {
      if (PAR() && R.compileAsync) { if (!job.async) { job.async = true; try { R.compileAsync(job.obj, cam, scene).then(() => { job.phase = 'tex'; }, () => { job.phase = 'tex'; }); } catch (e) { warnOnce('compileAsync', e); job.phase = 'tex'; } } continue; }
      const p0 = R.info.programs?.length ?? 0;
      while (job.i < job.leaves.length) { // one NEW shader per frame (a compile that hits the cache is cheap, keep going)
        try { R.compile(job.leaves[job.i++], cam, scene); } catch (e) { warnOnce('compile', e); }
        if ((R.info.programs?.length ?? 0) > p0 || performance.now() - t0 > 6) break;
      }
      if (job.i >= job.leaves.length) job.phase = 'tex';
      break; // one job per frame
    }
    if (job.phase === 'tex') { // upload one texture per frame so canvas atlases + mipmaps don't land in the reveal frame
      if (job.ti < job.tex.length && R.initTexture) { try { R.initTexture(job.tex[job.ti]); } catch (e) { warnOnce('initTexture', e); } job.ti++; break; }
      job.phase = 'show'; break;
    }
    finish(job); break;
  }
  S.jobs = S.jobs.filter(j => !j.done);
}

// ---------- per-frame ----------
function hud() {
  if (!S.hudOn) return; const now = performance.now(); if (now - S.hudT < 500) return; S.hudT = now;
  if (!S.hud) { const d = document.createElement('div'); d.id = 'stormGuardHud'; d.style.cssText = 'position:fixed;left:calc(8px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));z-index:70;pointer-events:none;font:600 11px ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.6);padding:2px 6px;border-radius:6px'; document.body.appendChild(d); S.hud = d; }
  S.hud.textContent = `${G.fps()} fps · storm ${S.on ? 'on' : 'off'} · k ${density().toFixed(2)}${S.dprLow ? ' · 1.5x' : ''} · worst ${Math.round(S.worst)} ms`;
}
function tick(dt, tc) {
  const now = performance.now(), ms = S.last ? now - S.last : 16.7; S.last = now;
  runJobs(tc);
  const on = stormOn(tc); S.on = on;
  if (ms < 2000) { G.step(ms, on); S.frames++; if (ms > S.worst) S.worst = ms; if (ms >= C.HITCH_MS) S.hitches++; } // > 2 s: the tab was asleep
  if (!on || !tc.isMobile) { if (S.dprLow) setDprLow(false); } else if (G.dprStep && S.forced == null) setDprLow(true); // sticky for the storm: no flapping
  hud();
}
export const density = () => (S.forced != null ? S.forced : G.k);
export const stormGuard = {
  density, maxPx: mobile => C.maxPx(!!mobile), fps: () => G.fps(), prewarm,
  force(k) { S.forced = k == null ? null : C.clamp(+k, 0, 1); return density(); },
  reset() { G.reset(); S.worst = 0; S.hitches = 0; S.frames = 0; setDprLow(false); return true; },
  state: () => ({ on: S.on, k: +density().toFixed(3), fps: G.fps(), drops: G.drops, raises: G.raises, dprLow: S.dprLow, worst: Math.round(S.worst), hitches: S.hitches, frames: S.frames, jobs: S.jobs.length, compiled: S.compiled, parallel: PAR() })
};

(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 250); return; }
  if (window.SSX.stormGuard) return; window.SSX.stormGuard = stormGuard;
  window.SSX.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { warnOnce('tick', e); } });
  // leaving the surface (takeoff) puts the resolution back
  setInterval(() => { try { if (S.dprLow && !app()?.state?.onSurface) setDprLow(false); } catch { /* */ } }, 1000);
})();
