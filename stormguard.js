// Storm frame-rate guard (Steve, storm perf): keeps Mars dust storms smooth on phones. Rules live in stormguardcore.js.
//  * measures the real frame time on the Mars surface; while a storm is on screen and the frame rate stays under ~40 fps it
//    drops storm density (the Director's dust and Ben's grit draw fewer grains), and gives it back above ~55 fps
//  * last resort on phones, only during a storm: render at 1.5x instead of 2x, put back when the storm clears or you leave
//  * shader prewarm: prewarm(obj) compiles an object's materials outside the frame that first shows it, one new shader per
//    frame (or in parallel where KHR_parallel_shader_compile exists), optionally hiding it until ready, so things that
//    stream in when you start walking (grime districts) or storms that start later don't freeze the game for a second;
//    v7.5.17: also the club interior + dancers, prebuilt hidden on approach (world.js warmRooms), linked here too
// Window API: SSX.stormGuard = { density(), maxPx(mobile), fps(), state(), prewarm(obj, { hide }), force(k|null), reset() }
// Debug: ?stormk=0.5 pins the density, ?perfhud=1 shows a small fps / density / worst-frame chip.
import * as THREE from 'three';
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
  const job = { obj, leaves, i: 0, tex: [...tex], ti: 0, di: 0, draw: !!o.draw, phase: 'wait', hide: !!o.hide, hidden: false, t0: performance.now(), done: false };
  if (job.hide && obj.visible) { obj.visible = false; job.hidden = true; }
  S.jobs.push(job); return true;
}
// v7.5.17: renderer.compile() only starts the link; the GPU driver finishes it (and three.js reads the uniforms) the
// first time the program draws, which is where the club's 300 ms phone frame came from. Fetching the uniforms here
// waits for the link inside the prewarm frame instead.
function link(R, leaf) { for (const m of [].concat(leaf.material)) { if (!m) continue; try { R.properties.get(m).currentProgram?.getUniforms?.(); } catch (e) { warnOnce('link', e); } } }
// v7.5.17 warm draw: a linked program still costs a long first draw on some GPUs/drivers (the pipeline for that blend /
// cull / vertex layout / render target is built then; ~300 ms for the club's first frame in phone emulation). For
// objects that are built hidden (the club, prewarmed on approach), prewarm(obj, { draw: true }) borrows its leaves into
// the live scene for ONE frame each, drawn into a single scissored pixel of the real render target with the real lights,
// so pipelines, buffers and bone textures exist before the room is shown. One new state a frame; given back next tick.
S.drawn = new Set(); let lent = [];
function drawKey(R, l) {
  const g = l.geometry; if (!g || !l.material || Array.isArray(l.material)) return null;
  const m = l.material, pr = R.properties.get(m).currentProgram; if (!pr) return null;
  const at = Object.keys(g.attributes).sort().map(n => { const a = g.attributes[n]; return n + a.itemSize + (a.array?.constructor?.name || '')[0] + (a.normalized ? 'n' : ''); }).join('');
  const tx = new Set(); texOf(m, tx); const ts = [...tx].map(t => [t.format, t.type, t.minFilter, t.magFilter, t.generateMipmaps ? 'm' : '', t.colorSpace, t.wrapS, t.wrapT, t.anisotropy, t.isCanvasTexture ? 'c' : t.isDataTexture ? 'd' : t.isCompressedTexture ? 'z' : ''].join(',')).sort().join(';'); // sampler states
  return [pr.id, m.side, ts, m.transparent ? 't' : '', m.blending, m.depthWrite ? 'w' : '', m.depthTest ? 'd' : '', m.alphaToCoverage ? 'c' : '', l.isInstancedMesh ? 'i' : '', l.isSkinnedMesh ? 's' : '', g.index ? g.index.array.constructor.name[4] : '-', at, l.isPoints ? 'p' : l.isLine ? 'l' : ''].join('|');
}
const _sc = { t: false, mw: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), d: new THREE.Vector3(), c: new THREE.Vector3(), o: new THREE.Vector3() };
function borrow(l, scene) {
  const rec = { l, parent: l.parent, idx: l.parent.children.indexOf(l), vis: l.visible, fc: l.frustumCulled, br: l.onBeforeRender, ar: l.onAfterRender, mw: l.matrixWorldAutoUpdate };
  const R = app().renderer;
  rec.kids = l.children.map(c => [c, c.visible]); for (const c of l.children) c.visible = false; // only this leaf draws (in its pixel)
  l.removeFromParent(); scene.add(l); l.visible = true; l.frustumCulled = false; if (l.__pg) l.__pgC = false; // perfgov's far cull judged it at its hidden spot
  l.onBeforeRender = function (...a) {
    rec.br.apply(this, a); S.rendN = (S.rendN || 0) + 1; _sc.t = R.getScissorTest(); R.setScissorTest(true); R.setScissor(0, 0, 1, 1);
    try { // park it in front of the camera, on the ray through that pixel, so its fragments (and texture samplers) run too
      const cam = a[2], g = l.geometry; _sc.mw.copy(l.matrixWorld);
      const bs = l.isInstancedMesh ? (l.boundingSphere || (l.computeBoundingSphere(), l.boundingSphere)) : (g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere));
      l.matrixWorld.decompose(_sc.p, _sc.q, _sc.s); const sc = Math.max(_sc.s.x, _sc.s.y, _sc.s.z) || 1, r = (bs?.radius || 1) * sc;
      const W = R.domElement.width || 1, H = R.domElement.height || 1; _sc.d.set(-1 + 1 / W, -1 + 1 / H, 0.5).unproject(cam);
      cam.getWorldPosition(_sc.c); _sc.d.sub(_sc.c).normalize();
      _sc.o.copy(bs?.center || _sc.o.set(0, 0, 0)).multiply(_sc.s).applyQuaternion(_sc.q); // centre offset in world units
      _sc.p.copy(_sc.c).addScaledVector(_sc.d, (cam.near || 0.1) * 2 + r * 1.2).sub(_sc.o);
      l.matrixWorld.compose(_sc.p, _sc.q, _sc.s);
      R.state.buffers.depth.setMask(true); R.clear(false, true, false); // that pixel's depth only (scissored)
    } catch (e) { warnOnce('warmDraw', e); }
  };
  l.onAfterRender = function (...a) { l.matrixWorld.copy(_sc.mw); const c = R.domElement, pr = R.getPixelRatio() || 1; R.setScissor(0, 0, c.width / pr, c.height / pr); R.setScissorTest(_sc.t); rec.ar.apply(this, a); };
  lent.push(rec); S.lentN = (S.lentN || 0) + 1;
}
function giveBack() {
  if (!lent.length) return;
  for (const r of lent) { const { l } = r; l.removeFromParent(); l.parent = r.parent; r.parent.children.splice(Math.min(r.idx < 0 ? r.parent.children.length : r.idx, r.parent.children.length), 0, l);
    l.visible = r.vis; l.frustumCulled = r.fc; l.onBeforeRender = r.br; l.onAfterRender = r.ar; for (const [c, v] of r.kids) c.visible = v; }
  lent = [];
}
function finish(job) { job.done = true; if (job.hidden && !job.obj.visible) job.obj.visible = true; S.compiled++; }
// Each job runs in phases, never in the frame that queued it (that frame already paid for building the object):
// wait -> compile (one new program per frame, or async in parallel) -> textures (one upload per frame) -> show.
function runJobs(tc) {
  giveBack();
  if (!S.jobs.length) return; const R = app()?.renderer; if (!R?.compile) { S.jobs.forEach(finish); S.jobs = []; return; }
  const scene = tc.scene, cam = tc.camera, t0 = performance.now();
  for (const job of S.jobs) {
    if (job.done) continue;
    if (!job.obj.parent && job.obj !== scene) { finish(job); continue; } // removed before it was ready
    if (performance.now() - job.t0 > (job.draw ? 12000 : 4000)) { S.timeouts = (S.timeouts || 0) + 1; finish(job); continue; }   // never hold anything back for long
    if (job.phase === 'wait') { job.phase = 'compile'; break; }
    if (job.phase === 'compile') {
      if (PAR() && R.compileAsync) { if (!job.async) { job.async = true; try { R.compileAsync(job.obj, cam, scene).then(() => { job.phase = 'link'; }, () => { job.phase = 'tex'; }); } catch (e) { warnOnce('compileAsync', e); job.phase = 'tex'; } } continue; }
      const p0 = R.info.programs?.length ?? 0;
      while (job.i < job.leaves.length) { // one NEW shader per frame (a compile that hits the cache is cheap, keep going)
        const leaf = job.leaves[job.i++];
        try { R.compile(leaf, cam, scene); link(R, leaf); } catch (e) { warnOnce('compile', e); }
        if ((R.info.programs?.length ?? 0) > p0 || performance.now() - t0 > 6) break;
      }
      if (job.i >= job.leaves.length) job.phase = 'tex';
      break; // one job per frame
    }
    if (job.phase === 'link') { for (const leaf of job.leaves) link(R, leaf); job.phase = 'tex'; break; } // parallel compile done: fetch uniforms now (cheap), not in the reveal frame
    if (job.phase === 'tex') { // upload one texture per frame so canvas atlases + mipmaps don't land in the reveal frame
      if (job.ti < job.tex.length && R.initTexture) { try { R.initTexture(job.tex[job.ti]); } catch (e) { warnOnce('initTexture', e); } job.ti++; break; }
      job.phase = job.draw ? 'draw' : 'show'; break;
    }
    if (job.phase === 'draw') { // one never-drawn pipeline state a frame, drawn into one pixel (see warmDraw)
      // every leaf gets drawn once (that also uploads its vertex/index buffers, instance matrices and bone texture), up
      // to 12 a frame, but at most one with a pipeline state nothing has drawn yet
      let n = 0, fresh = 0;
      while (job.di < job.leaves.length && n < 12) { const l = job.leaves[job.di], k = drawKey(R, l); if (!k) { job.di++; continue; }
        const isNew = !S.drawn.has(k); if (isNew && fresh) break; if (isNew) { fresh++; S.drawn.add(k); } job.di++; if (l.parent) { borrow(l, scene); n++; } }
      if (job.di >= job.leaves.length) job.phase = 'show';
      break;
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
  state: () => ({ on: S.on, k: +density().toFixed(3), fps: G.fps(), drops: G.drops, raises: G.raises, dprLow: S.dprLow, worst: Math.round(S.worst), hitches: S.hitches, frames: S.frames, jobs: S.jobs.length, compiled: S.compiled, drawn: S.drawn.size, lent: S.lentN || 0, rend: S.rendN || 0, timeouts: S.timeouts || 0, parallel: PAR() })
};

(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 250); return; }
  if (window.SSX.stormGuard) return; window.SSX.stormGuard = stormGuard;
  window.SSX.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { warnOnce('tick', e); } });
  // leaving the surface (takeoff) puts the resolution back
  setInterval(() => { try { if (S.dprLow && !app()?.state?.onSurface) setDprLow(false); } catch { /* */ } }, 1000);
})();
