// v7.5.12 phone perf governor (Collin: "the game lags after 1-2 minutes on my iPhone"). Loaded by one guarded import in index.html.
// Profiling (tests/perf/soak.js, WebKit 393x852) found no unbounded leak: listeners/intervals/geometries level off. The lag is a
// sustained GPU load that makes the phone heat up and throttle: pixel ratio 2, ~1000 draw calls per frame (most of them buildings,
// props and NPC groups far past the ~120 m fog, where they are drawn fully fogged = invisible), and the club's skinned dancers.
//  1. far-fog cull: a leaf mesh whose bounding sphere sits fully beyond fog.far (+3%) is skipped for the surface render only.
//     Its `visible` reads its real value everywhere else (game logic, raycasts, copies); only renderer.render sees it hidden.
//     Indoors (fog off / far) anything 80 m+ from the camera is skipped: the outdoor city that stays in the scene behind the walls.
//     Opt out per object: userData.noCull = true. Skipped automatically: SkinnedMesh, frustumCulled = false, fog = false materials.
//  2. adaptive pixel ratio on phones: start at 1.5; under 40 fps for 3 s -> one step down (1.25, 1.0); over 57 fps for 12 s -> one
//     step up (max min(devicePixelRatio, 2)). Waits while SSX.stormGuard has its own storm DPR floor on.
//  3. while landed the space view (planets, sky, orbits) is NOT rendered or updated (index.html animate() returns early), but its
//     textures stay on the GPU. We free them on landing (three re-uploads a texture on its next use) and pre-upload on takeoff.
//  4. v7.5.15 sustained-load governor (Collin, again: "still lagging after 1-2 minutes"). A 4-minute soak found no leak (heap saw-tooths
//     40-80 MB, scene ~4000 objects, geometries/textures/programs level off once each place has been visited), so the lag is the phone
//     heating up and throttling. On phones, once landed play has run 75 s or the frame rate sits under 50 fps for 3 s, every
//     requestAnimationFrame loop is paced to 30 fps (half the GPU/CPU work per second, steady instead of 60 -> 20 stutter). Sticky
//     for the session. Still under 26 fps at 30 for 4 s: the film-look overlay goes off (not saved) and the pixel ratio may go to 0.85.
//     Override: localStorage 'ssx.fps' = '60' (never cap) or '30' (cap from the start); ?fps=60 / ?fps=30. SSX.perfGov.setCap(on).
// Off switch: ?perfgov=0 or localStorage 'ssx.perfgov' = '0'. Window API: SSX.perfGov = { state(), cullPass(), setDpr(v), freed() }
import * as THREE from 'three';

const off = (() => { try { return /[?&]perfgov=0/.test(location.search) || localStorage.getItem('ssx.perfgov') === '0'; } catch (e) { return false; } })();
const app = () => window.__app;
const phone = () => (matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window) && Math.min(screen.width || innerWidth, screen.height || innerHeight) <= 500;
const S = { cull: false, cands: [], candT: 0, passT: 0, culled: 0, total: 0, dpr: null, dprMax: 2, lowT: 0, highT: 0, fps: 60, frames: 0, fpsT: 0, drops: 0, raises: 0,
  landed: false, freed: [], freedMB: 0, freedN: 0, wrapped: false, phone: false, dropAt: -1e9, raiseAt: -1e9, lock: false };
const STEPS = [2, 1.75, 1.5, 1.25, 1], CAP_STEPS = [2, 1.75, 1.5, 1.25, 1, 0.85];
// ---------- 4. 30 fps pacing (phones, sustained load) ----------
const fpsPref = (() => { try { const m = /[?&]fps=(30|60)/.exec(location.search); return m ? m[1] : (localStorage.getItem('ssx.fps') || 'auto'); } catch (e) { return 'auto'; } })();
const FRAME = 1000 / 30;
const C = { on: false, why: null, at: 0, q: new Map(), seq: 0, pending: 0, last: 0, acc: 0, landedT: 0, slowT: 0, lightT: 0, lite: false, flushes: 0 };
const nRaf = window.requestAnimationFrame.bind(window), nCaf = window.cancelAnimationFrame.bind(window);
function pump(ts) {
  C.pending = 0; if (!C.on) { const cbs = [...C.q.values()]; C.q.clear(); for (const cb of cbs) run(cb, ts); return; }
  // v7.5.16: rAF-timestamp accumulator on a fixed 33.3 ms grid (was "28 ms since the last flush", which re-phased after every late
  // frame: flushes at 0, 50, 83 ms = 50/33 judder). A late vsync keeps the grid; a stall (tab switch, long task) resets it.
  if (C.last) { C.acc += ts - C.last; C.last = ts; if (C.acc > 100) C.acc = FRAME; if (C.acc < FRAME - 4) { C.pending = nRaf(pump); return; } C.acc = Math.min(4, Math.max(0, C.acc - FRAME)); } // carry vsync jitter only: no 16 ms catch-up flush after a late one
  else { C.last = ts; C.acc = 0; }
  C.flushes++; const cbs = [...C.q.values()]; C.q.clear(); for (const cb of cbs) run(cb, ts);
}
function run(cb, ts) { try { cb(ts); } catch (e) { setTimeout(() => { throw e; }); } }
if (!off) {
  window.requestAnimationFrame = function (cb) { if (!C.on) return nRaf(cb); const id = ++C.seq; C.q.set(id, cb); if (!C.pending) C.pending = nRaf(pump); return -id; };
  window.cancelAnimationFrame = function (id) { if (id < 0) C.q.delete(-id); else nCaf(id); };
}
export function setCap(on, why = 'manual') { on = !!on; if (on === C.on) return C.on; C.on = on; C.why = on ? why : null; C.at = performance.now(); C.last = 0; C.acc = 0; S.lowT = S.highT = 0; if (!on && C.lite) liteOff(false); return C.on; }
function liteOff(v) { C.lite = v; try { window.SSX?.grime?.setPost?.(v ? 'off' : 'cfg', true); } catch (e) { /* */ } }
function capTick(now, landed) {
  if (!S.phone || document.hidden || fpsPref === '60') return;
  if (fpsPref === '30') { if (!C.on) setCap(true, 'pref'); return; }
  if (!landed) { C.slowT = 0; return; }
  if (!C.on) {
    C.landedT++; if (S.fps < 50) C.slowT++; else C.slowT = 0;
    if (C.slowT >= 3) setCap(true, 'slow'); else if (C.landedT >= 75) setCap(true, 'heat');
    return;
  }
  if (S.fps < 26) C.lightT++; else C.lightT = 0;
  if (C.lightT >= 4 && !C.lite) { C.lightT = 0; liteOff(true); }
}
const tmp = new THREE.Vector3(), camP = new THREE.Vector3();

// ---------- 1. far-fog cull ----------
const VIS = { get() { return this.__pgV && !(S.cull && this.__pgC); }, set(v) { this.__pgV = !!v; }, configurable: true, enumerable: true };
function own(o) { if (o.__pg) return; o.__pgV = o.visible; o.__pgC = false; o.__pg = 1; Object.defineProperty(o, 'visible', VIS); }
const fogOk = m => !m || (Array.isArray(m) ? m.every(x => x && x.fog !== false) : m.fog !== false);
function candidate(o) {
  if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || o.isSkinnedMesh || o.frustumCulled === false || o.userData?.noCull || o.userData?.ssxDancer) return false;
  return fogOk(o.material);
}
function collect(scene) {
  const out = []; scene.traverse(o => { if (candidate(o)) { own(o); out.push(o); } });
  S.cands = out; S.total = out.length;
}
function sphere(o) {
  if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere?.(); return o.boundingSphere; }
  const g = o.geometry; if (!g) return null; if (!g.boundingSphere) { try { g.computeBoundingSphere(); } catch (e) { return null; } } return g.boundingSphere;
}
export function cullPass() {
  const s = app()?.surface, scene = s?.scene, cam = s?.camera; if (!scene || !cam) return 0;
  const now = performance.now();
  if (now - S.candT > 1500) { S.candT = now; collect(scene); }
  const indoors = document.body.classList.contains('indoors');
  const fog = scene.fog; let lim = Infinity;
  if (indoors) lim = 80; else if (fog?.isFog && fog.far > 0) lim = fog.far * 1.03 + 2;
  cam.getWorldPosition(camP); let n = 0;
  for (const o of S.cands) {
    let c = false;
    if (lim < Infinity) { const bs = sphere(o); if (bs && bs.radius < 1e6 && isFinite(bs.radius)) { tmp.copy(bs.center).applyMatrix4(o.matrixWorld); c = tmp.distanceTo(camP) - bs.radius * o.matrixWorld.getMaxScaleOnAxis() > lim; } }
    o.__pgC = c; if (c) n++;
  }
  S.culled = n; return n;
}
function wrapRender() {
  const R = app()?.renderer; if (!R || S.wrapped) return !!R; S.wrapped = true;
  const orig = R.render.bind(R);
  R.render = function (scene, camera) {
    const isSurf = scene && scene === app()?.surface?.scene;
    if (isSurf) S.cull = true;
    try { return orig(scene, camera); } finally { S.cull = false; }
  };
  return true;
}

// ---------- 2. adaptive pixel ratio (phones) ----------
export function setDpr(v) { const R = app()?.renderer; if (!R?.setPixelRatio) return; v = Math.max(C.on && C.lite ? 0.85 : 1, Math.min(S.dprMax, v)); S.dpr = v; if (Math.abs(R.getPixelRatio() - v) > 0.01) { R.setPixelRatio(v); try { R.setSize(innerWidth, innerHeight); } catch (e) { /* */ } } }
function dprTick(dt, now) {
  S.frames++; if (now - S.fpsT >= 1000) { S.fps = S.frames * 1000 / (now - S.fpsT); S.frames = 0; S.fpsT = now; } else return;
  try { capTick(now, !!app()?.state?.onSurface); } catch (e) { /* */ }
  if (!S.phone || document.hidden) return;
  if (window.SSX?.stormGuard?.state?.().dprLow) { S.lowT = S.highT = 0; return; }
  const R = app()?.renderer; if (!R) return; const cur = R.getPixelRatio();
  if (S.dpr != null && Math.abs(cur - S.dpr) > 0.01) S.dpr = cur; // someone else moved it: follow
  const lo = C.on ? 24 : 40, hi = C.on ? 29 : 57, ST = C.on && C.lite ? CAP_STEPS : STEPS; // capped: judged against 30, not 60
  if (S.fps < lo) { S.lowT++; S.highT = 0; } else if (S.fps > hi) { S.highT++; S.lowT = 0; } else { S.lowT = 0; S.highT = 0; }
  // v7.5.16 hysteresis: every resize reallocates the render targets (a hitch). After a drop, no raise for 60 s; a raise that has
  // to come back down within 30 s locks the ratio for the session (no 20 s up/down see-saw at the 30 fps cap).
  if (S.lowT >= 3) { S.lowT = 0; const nx = ST.find(v => v < cur - 0.01); if (nx) { if (now - S.raiseAt < 30000) S.lock = true; setDpr(nx); S.drops++; S.dropAt = now; } }
  else if (!S.lock && now - S.dropAt > 60000 && S.highT >= (C.on ? 20 : 12)) { S.highT = 0; const up = [...ST].reverse().find(v => v > cur + 0.01 && v <= Math.min(S.dprMax, C.on ? 1.5 : 2)); if (up) { setDpr(up); S.raises++; S.raiseAt = now; } }
}

// ---------- 3. space-view textures while landed ----------
const TEX_KEYS = ['map', 'emissiveMap', 'normalMap', 'bumpMap', 'specularMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'lightMap', 'displacementMap', 'envMap'];
function spaceScene() { const b = app()?.bodies; const m = b && (b[0]?.mesh || b[0]?.group); let o = m; while (o?.parent) o = o.parent; return o?.isScene ? o : null; }
function spaceTextures() {
  const sc = spaceScene(); if (!sc) return [];
  const set = new Set(), surfTex = new Set();
  const add = (t, into) => { if (t?.isTexture && !t.isRenderTargetTexture && t.image) into.add(t); };
  const scan = (root, into) => root.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { for (const k of TEX_KEYS) add(m[k], into); if (m.uniforms) for (const u of Object.values(m.uniforms)) add(u?.value, into); } });
  scan(sc, set); if (sc.background?.isTexture) add(sc.background, set);
  const ss = app()?.surface?.scene; if (ss) scan(ss, surfTex); // never free one the surface uses too
  return [...set].filter(t => !surfTex.has(t));
}
const texMB = t => { const im = t.image; const w = im?.width || im?.videoWidth || 0, h = im?.height || im?.videoHeight || 0; return w * h * 4 * (t.generateMipmaps !== false ? 1.33 : 1) / 1048576; };
function onLand() {
  const R = app()?.renderer; const before = R?.info.memory.textures;
  const list = spaceTextures(); let mb = 0;
  for (const t of list) { mb += texMB(t); try { t.dispose(); } catch (e) { /* */ } }
  S.freed = list; S.freedN = list.length; S.freedMB = Math.round(mb * 10) / 10; S.texBefore = before; S.texAfter = R?.info.memory.textures;
}
function onTakeoff() {
  const R = app()?.renderer; for (const t of S.freed) { try { R?.initTexture?.(t); } catch (e) { /* re-uploads on first draw */ } } S.freed = [];
}

// ---------- loop ----------
let last = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const a = app(); if (!a?.renderer) return; wrapRender();
  if (S.dpr == null) { S.phone = phone(); S.dprMax = Math.min(window.devicePixelRatio || 1, 2); if (S.phone) setDpr(Math.min(1.5, S.dprMax)); else S.dpr = a.renderer.getPixelRatio(); S.fpsT = now; }
  const dt = last ? now - last : 16; last = now; dprTick(dt, now);
  const landed = !!a.state?.onSurface || document.body.classList.contains('surface');
  if (landed !== S.landed) { S.landed = landed; try { landed ? onLand() : onTakeoff(); } catch (e) { console.warn('perfgov land', e); } }
  if (landed && now - S.passT > (S.phone ? 200 : 300)) { S.passT = now; try { cullPass(); } catch (e) { console.warn('perfgov cull', e); } }
}
if (!off) requestAnimationFrame(tick);
window.SSX = window.SSX || {};
window.SSX.perfGov = { off, state: () => ({ off, phone: S.phone, dpr: app()?.renderer?.getPixelRatio?.(), fps: Math.round(S.fps), drops: S.drops, raises: S.raises, culled: S.culled, total: S.total, landed: S.landed, freedN: S.freedN, freedMB: S.freedMB, texBefore: S.texBefore, texAfter: S.texAfter, cap: C.on ? 30 : null, capWhy: C.why, capPref: fpsPref, lite: C.lite, landedS: C.landedT, flushes: C.flushes }),
  setCap,
  cullPass, setDpr, freed: () => ({ n: S.freedN, mb: S.freedMB }) };
