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
// Off switch: ?perfgov=0 or localStorage 'ssx.perfgov' = '0'. Window API: SSX.perfGov = { state(), cullPass(), setDpr(v), freed() }
import * as THREE from 'three';

const off = (() => { try { return /[?&]perfgov=0/.test(location.search) || localStorage.getItem('ssx.perfgov') === '0'; } catch (e) { return false; } })();
const app = () => window.__app;
const phone = () => (matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window) && Math.min(screen.width || innerWidth, screen.height || innerHeight) <= 500;
const S = { cull: false, cands: [], candT: 0, passT: 0, culled: 0, total: 0, dpr: null, dprMax: 2, lowT: 0, highT: 0, fps: 60, frames: 0, fpsT: 0, drops: 0, raises: 0,
  landed: false, freed: [], freedMB: 0, freedN: 0, wrapped: false, phone: false };
const STEPS = [2, 1.75, 1.5, 1.25, 1];
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
export function setDpr(v) { const R = app()?.renderer; if (!R?.setPixelRatio) return; v = Math.max(1, Math.min(S.dprMax, v)); S.dpr = v; if (Math.abs(R.getPixelRatio() - v) > 0.01) { R.setPixelRatio(v); try { R.setSize(innerWidth, innerHeight); } catch (e) { /* */ } } }
function dprTick(dt, now) {
  S.frames++; if (now - S.fpsT >= 1000) { S.fps = S.frames * 1000 / (now - S.fpsT); S.frames = 0; S.fpsT = now; } else return;
  if (!S.phone || document.hidden) return;
  if (window.SSX?.stormGuard?.state?.().dprLow) { S.lowT = S.highT = 0; return; }
  const R = app()?.renderer; if (!R) return; const cur = R.getPixelRatio();
  if (S.dpr != null && Math.abs(cur - S.dpr) > 0.01) S.dpr = cur; // someone else moved it: follow
  if (S.fps < 40) { S.lowT++; S.highT = 0; } else if (S.fps > 57) { S.highT++; S.lowT = 0; } else { S.lowT = 0; S.highT = 0; }
  if (S.lowT >= 3) { S.lowT = 0; const nx = STEPS.find(v => v < cur - 0.01); if (nx) { setDpr(nx); S.drops++; } }
  else if (S.highT >= 12) { S.highT = 0; const up = [...STEPS].reverse().find(v => v > cur + 0.01 && v <= S.dprMax); if (up) { setDpr(up); S.raises++; } }
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
window.SSX.perfGov = { off, state: () => ({ off, phone: S.phone, dpr: app()?.renderer?.getPixelRatio?.(), fps: Math.round(S.fps), drops: S.drops, raises: S.raises, culled: S.culled, total: S.total, landed: S.landed, freedN: S.freedN, freedMB: S.freedMB, texBefore: S.texBefore, texAfter: S.texAfter }),
  cullPass, setDpr, freed: () => ({ n: S.freedN, mb: S.freedMB }) };
