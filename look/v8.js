// v8 realistic look (from the look-dev, kaskel87-a11y/solar-system-lookdev) for every planet surface. window.SSX.look
// One hook, no core edits: it wraps renderer.render for the surface scene only, so space, menus and other passes are untouched.
//  - lighting: one shadow-casting sun that follows the player (texel-snapped), hemisphere cut back, IBL from a PMREM of
//    the LIVE sky (so the env follows SSX.time and Director's storm), emissives pushed at night
//  - materials: world-space PBR detail on the terrain (regolith + rock, triplanar on high+), weathering (dust on
//    up-facing surfaces, grime) and concrete / metal-panel detail on buildings, env reflections on everything
//  - post (med+): HalfFloat render -> [GTAO, ultra] -> bloom -> Output (ACES, sRGB) -> grade (per-planet split tone)
//  - tiers classic/low/med/high/ultra: ☰ Graphics, ?look= (or ?tier=), auto-detect (phones med, desktop high),
//    FPS governor steps an auto tier down. 'classic' = the v7 look, nothing of v8 runs.
// Light / sky values set by other modules (SSX.time, Director) are only scaled while the frame draws, then put back.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as K from './v8core.js';
import { patchTerrain, patchSurface, unpatch, GradeShader, makeEnvScene } from './v8shaders.js';

const VERSION = 'v8.0';
const LS = 'ssx.v8.v1';
const qs = new URLSearchParams(location.search);
const DBG = { nopost: qs.has('v8nopost'), noshadow: qs.has('v8noshadow'), nodetail: qs.has('v8nodetail'), noenv: qs.has('v8noenv') }; // bench toggles
const warned = new Set(); const warnOnce = (k, e) => { if (!warned.has(k)) { warned.add(k); console.warn('v8 look:', k, e?.message || e); } };
const loadLS = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
const saveLS = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch { /* private mode */ } };

let renderer = null, origRender = null, inRender = false;
let gpuName = '';
const cls = () => K.deviceClass({ ua: navigator.userAgent, touch: matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1,
  mem: navigator.deviceMemory || 8, cores: navigator.hardwareConcurrency || 8, gpu: gpuName, w: screen.width, h: screen.height });
let pick = K.pickTier({ param: qs.get('look') || qs.get('tier'), saved: loadLS(), cls: 'desktop' });
let tier = K.TIERS[pick.tier];
const S = { ctx: null, scene: null, world: '', sky: null, dl: null, hemi: null, frames: 0, stats: { scans: 0, patched: 0, terrain: 0, casters: 0, envBuilds: 0, recompiles: 0, governed: [] },
  origPR: null, prSet: null, shadowsWas: null, composer: null, passes: null, env: null, envRT: null, envSig: null, envT: -1e9, pmrem: null,
  T: null, Tloading: null, mats: new Set(), envMats: new Set(), emissive: new Set(), terrainMats: new Set(), objs: new Set(), scanT: 0, lastNow: 0, fpsWin: { t: 0, n: 0 }, fps: 0,
  drs: K.dynres(), prCur: null, drsCap: 0, vig: null,
  drsOff: qs.get('v8drs') === '0' || (() => { try { return localStorage.getItem('ssx.v8.nodrs') === '1'; } catch { return false; } })(),
  gov: K.governor(), govOff: qs.get('v8gov') === '0' || (() => { try { return localStorage.getItem('ssx.v8.nogov') === '1'; } catch { return false; } })(), listeners: new Set() };

// ---------- textures (lazy, first surface frame with v8 on) ----------
function loadTextures() {
  if (S.Tloading) return S.Tloading;
  const L = new THREE.TextureLoader(), sets = ['mars_regolith', 'mars_rock', 'concrete'].concat(cls() === 'phone' ? [] : ['metal_panels']);
  const avgOf = img => { try { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4, col = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace); return new THREE.Vector3(col.r, col.g, col.b); } catch { return new THREE.Vector3(0.3, 0.2, 0.15); } };
  const one = (name, m) => new Promise((res, rej) => L.load(`textures/v8/${name}_${m}_1k.jpg`, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = m === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = Math.min(tier.aniso || 4, renderer?.capabilities.getMaxAnisotropy?.() || 1); res(t); }, undefined, rej));
  S.Tloading = Promise.all(sets.map(async n => { const [diff, nor, arm] = await Promise.all(['diff', 'nor', 'arm'].map(m => one(n, m))); return [n, { name: n, diff, nor, arm, avg: avgOf(diff.image) }]; }))
    .then(e => { S.T = Object.fromEntries(e); S.scanT = 0; return S.T; })
    .catch(e => { warnOnce('textures', e); S.T = null; return null; });
  return S.Tloading;
}

// ---------- scene scan: shadows flags + material upgrade (every 2 s, and at once on a new planet) ----------
const LIT = m => m && (m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial);
const tmpS = new THREE.Vector3();
function scan(ctx) {
  S.stats.scans++;
  const scene = ctx.scene, world = ctx.name, info = new Map();
  scene.traverse(o => {
    if (!o.isMesh || o.isSprite || o.isPoints) return;
    if (o.userData.noV8) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material]; if (!mats.some(LIT)) return;
    const geo = o.geometry; if (!geo) return;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    o.getWorldScale(tmpS); const rad = (geo.boundingSphere?.radius || 0) * Math.max(tmpS.x, tmpS.y, tmpS.z);
    const terrain = !o.isInstancedMesh && !!geo.attributes.color && mats[0]?.vertexColors && rad > 18;
    const dress = (o.name || '').startsWith('dress:') || o.parent?.userData?.v8?.part === 'dress';
    const transparent = mats.every(m => m.transparent || m.opacity < 1 || m.blending === THREE.AdditiveBlending);
    if (!S.objs.has(o)) { o.userData.__v8s = [o.castShadow, o.receiveShadow]; S.objs.add(o); }
    if (!transparent) { o.receiveShadow = true; o.castShadow = !terrain && !dress && rad < 70; }
    for (const m of mats) {
      if (!m?.isMeshStandardMaterial || m.userData.noV8) continue;
      if (tier.envMode === 'metal' && m.metalness >= 0.35 && (!m.envMap || m.userData.__v8env)) S.envMats.add(m);
      if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05 && m.emissiveIntensity > 0) S.emissive.add(m);
      if (terrain) { if (S.T && m.vertexColors) { patchTerrain(m, S.T, tier); S.terrainMats.add(m); S.mats.add(m); } continue; }
      let r = info.get(m); if (!r) info.set(m, r = { maxRadius: 0, skinned: false, dress: false });
      r.maxRadius = Math.max(r.maxRadius, rad); r.skinned ||= !!o.isSkinnedMesh; r.dress ||= dress;
    }
  });
  if (!tier.weather) return;
  const dust = new THREE.Color(K.dustFor(world));
  for (const [m, r] of info) {
    if (r.skinned || r.dress || m.userData.weathered || m.isMeshPhysicalMaterial && m.transmission > 0) continue; // GLB kits keep their own look
    const em = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1) : 0;
    const setName = S.T ? K.detailSetFor({ metalness: m.metalness, roughness: m.roughness, transparent: m.transparent, hasMap: !!(m.map || m.normalMap), maxRadius: r.maxRadius, skinned: r.skinned, emissive: em }) : null;
    const set = setName && S.T?.[setName] ? S.T[setName] : null;
    if (m.transparent && !set) continue;
    const before = m.userData.__v8?.key;
    patchSurface(m, { dust, amount: K.weatherAmount(world, r.maxRadius >= 1.4), set, scale: setName === 'metal_panels' ? 1.6 : 2.6 }, tier);
    if (m.userData.__v8?.key !== before) S.stats.recompiles++;
    S.mats.add(m);
  }
  S.stats.patched = S.mats.size; S.stats.terrain = S.terrainMats.size;
  S.stats.casters = 0; for (const o of S.objs) if (o.castShadow) S.stats.casters++;
}
function unscan() {
  clearEnvMats();
  for (const m of S.mats) unpatch(m); S.mats.clear(); S.terrainMats.clear(); S.emissive.clear();
  for (const o of S.objs) { const f = o.userData.__v8s; if (f) { o.castShadow = f[0]; o.receiveShadow = f[1]; delete o.userData.__v8s; } } S.objs.clear();
  S.stats.patched = 0; S.stats.terrain = 0; S.stats.casters = 0;
}

// envMode 'metal' (low/med): the IBL goes on metallic materials only; everything else skips the cube-UV lookups
function setEnvMats(tex, k) {
  for (const m of S.envMats) {
    if (!m.userData.__v8env) { m.userData.__v8env = { i: m.envMapIntensity }; m.needsUpdate = true; }
    if (m.envMap !== tex) m.envMap = tex; m.envMapIntensity = k;
  }
}
function clearEnvMats() {
  for (const m of S.envMats) { const o = m.userData.__v8env; if (o) { m.envMap = null; m.envMapIntensity = o.i; m.needsUpdate = true; delete m.userData.__v8env; } }
  S.envMats.clear();
}

// ---------- rig: lights, shadows, env ----------
function findRig(scene) {
  S.dl = scene.children.find(o => o.isDirectionalLight) || null;
  S.hemi = scene.children.find(o => o.isHemisphereLight) || null;
  S.sky = null; scene.traverse(o => { if (!S.sky && o.isMesh && o.material?.uniforms?.top && o.material.uniforms.horizon) S.sky = o; });
}
function setupShadows(on) {
  const r = renderer; if (S.shadowsWas == null) S.shadowsWas = { enabled: r.shadowMap.enabled, type: r.shadowMap.type, auto: r.shadowMap.autoUpdate };
  const type = tier.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (r.shadowMap.enabled !== on || (on && r.shadowMap.type !== type)) { r.shadowMap.enabled = on; r.shadowMap.type = type; for (const m of S.mats) m.needsUpdate = true; }
  r.shadowMap.autoUpdate = !on || tier.shadowEvery <= 1;
  const dl = S.dl; if (!dl) return;
  if (on) {
    const sh = dl.shadow, R = tier.shadowRange;
    if (sh.mapSize.x !== tier.shadow) { sh.mapSize.set(tier.shadow, tier.shadow); sh.map?.dispose(); sh.map = null; }
    const c = sh.camera; if (c.right !== R) { c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 220; c.updateProjectionMatrix(); }
    sh.bias = -0.0005; sh.normalBias = 0.06; sh.radius = tier.shadowSoft ? 2.5 : 1;
  }
}
const vDir = new THREE.Vector3(), vC = new THREE.Vector3(), vR = new THREE.Vector3(), vU = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const saved = { dlI: 0, hemiI: 0, pos: new THREE.Vector3(), tpos: new THREE.Vector3(), em: [] };
function sunDir(out) { const dl = S.dl; out.copy(dl.position).sub(dl.target.position); if (out.lengthSq() < 1e-6) out.set(0.3, 1, 0.2); return out.normalize(); }
function nightness() {
  try { if (S.world === 'Mars' && window.SSX?.time?.nightness) return window.SSX.time.nightness(); } catch { /* old SSX.time */ }
  return S.dl ? K.nightFromSun(sunDir(vDir).y) : 0;
}
function updateEnv(now, indoor) {
  const sky = S.sky?.material?.uniforms, scene = S.scene; if (!S.env) S.env = makeEnvScene();
  const U = S.env.U, top = sky ? sky.top.value : (scene.background?.isColor ? scene.background : scene.fog?.color || new THREE.Color(0x333333)), hor = sky ? sky.horizon.value : (scene.fog?.color || top);
  U.top.value.copy(top); U.horizon.value.copy(hor);
  U.ground.value.copy(S.hemi ? S.hemi.groundColor : hor).multiplyScalar(0.5).lerp(hor, 0.15);
  if (S.dl) { sunDir(U.sunDir.value); U.sunCol.value.copy(S.dl.color).multiplyScalar(S.dl.intensity * 0.12 * (U.sunDir.value.y > -0.05 ? 1 : 0)); }
  const d = U.sunDir.value, sig = [top.r, top.g, top.b, hor.r, hor.g, hor.b, U.sunCol.value.r, U.sunCol.value.g, d.x * 0.2, d.y * 0.2, d.z * 0.2];
  if (S.envRT && (now - S.envT < tier.envEvery * 1000 || !K.sigChanged(sig, S.envSig, 0.015))) return;
  S.pmrem ||= new THREE.PMREMGenerator(renderer);
  const rt = S.pmrem.fromScene(S.env.scene, 0.02, 0.1, 100);
  S.envRT?.dispose(); S.envRT = rt; S.envSig = sig; S.envT = now; S.stats.envBuilds++;
}

// ---------- post ----------
function buildComposer(w, h) {
  disposeComposer();
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: tier.msaa || 0 });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(w, h);
  const rp = new RenderPass(S.scene, S.ctx.camera); composer.addPass(rp);
  const P = { rp, composer, w, h, gtao: null };
  if (tier.ao) import('three/addons/postprocessing/GTAOPass.js').then(({ GTAOPass }) => {
    if (S.passes !== P) return; const g = new GTAOPass(S.scene, S.ctx.camera, w, h);
    g.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 }); g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    g.blendIntensity = 0.85; composer.insertPass(g, 1); P.gtao = g;
  }).catch(e => warnOnce('gtao', e));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.5, 1.2);
  const bs = bloom.setSize.bind(bloom); bloom.setSize = (a, b) => bs(Math.max(2, Math.round(a * tier.bloomScale)), Math.max(2, Math.round(b * tier.bloomScale)));
  bloom.setSize(w, h); composer.addPass(bloom); P.bloom = bloom;
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); composer.addPass(grade); P.grade = grade;
  S.composer = composer; S.passes = P;
}
function disposeComposer() {
  const P = S.passes; if (!P) return;
  try { P.composer.renderTarget1.dispose(); P.composer.renderTarget2.dispose(); P.bloom?.dispose?.(); P.gtao?.dispose?.(); P.grade?.material?.dispose(); } catch (e) { warnOnce('dispose', e); }
  S.composer = null; S.passes = null;
}

// ---------- CSS vignette (tiers without a composer: costs nothing on the GPU's frame budget) ----------
function vignette(on) {
  on = on && !!tier.vignette && !(tier.post && !DBG.nopost);
  if (!on) { if (S.vig) S.vig.style.display = 'none'; return; }
  if (!S.vig) { const c = renderer.domElement, d = document.createElement('div'); d.id = 'v8-vignette';
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,0.38) 100%)';
    c.parentNode?.insertBefore(d, c.nextSibling); S.vig = d; }
  if (S.vig.style.display === 'none') S.vig.style.display = '';
}

// ---------- the frame ----------
const dbs = new THREE.Vector2();
function surfaceFrame(scene, camera) {
  const ctx = S.ctx, now = performance.now(), rawMs = S.lastNow ? now - S.lastNow : 16.7, dt = S.lastNow ? Math.min(0.1, (now - S.lastNow) / 1000) : 0.016; S.lastNow = now;
  // fps + governor (auto tiers only)
  S.fpsWin.n++; if (!S.fpsWin.t) S.fpsWin.t = now;
  if (now - S.fpsWin.t >= 4000) { S.fps = S.fpsWin.n * 1000 / (now - S.fpsWin.t); S.fpsWin = { t: now, n: 0 };
    if (pick.auto && !S.govOff && !document.hidden && (S.drsOff || S.drs.atFloor(S.prCur ?? 0))) { const nt = S.gov.sample(S.fps, tier.name); if (nt) { S.stats.governed.push([tier.name, nt, Math.round(S.fps)]); setTier(nt, { auto: true, why: 'governor' }); toast(`✨ Graphics: ${K.TIERS[nt].label} (auto, to keep it smooth)`); } } }
  if (!tier.pixelRatio) return origRender(scene, camera);
  // pixel ratio (never above what the core picked)
  if (S.origPR == null) S.origPR = renderer.getPixelRatio();
  // cap: the tier's ratio, never above the core's; phones on med top out at 1.5. Dynamic resolution works under the cap.
  const cap = Math.min(S.origPR, tier.pixelRatio, cls() === 'phone' && tier.name === 'med' ? 1.5 : 9);
  if (S.drsCap !== cap) { S.drsCap = cap; S.drs.setCap(cap, Math.max(0.75, Math.min(1, cap * 0.6))); S.prCur = cap; }
  if (!S.drsOff && rawMs < 250 && !document.hidden) { const r = S.drs.step(rawMs, now, S.prCur); if (r != null) S.prCur = r; }
  const pr = S.drsOff ? cap : S.prCur; if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); S.prSet = pr; }
  vignette(true);
  if (!S.T && !S.Tloading && !DBG.nodetail) loadTextures();
  if (S.scanT <= now) { S.scanT = now + 2000; try { scan(ctx); } catch (e) { warnOnce('scan', e); } }
  const indoor = !!ctx.world?.inside, insideKind = indoor ? ctx.world.inside?.kind : null, n = nightness(), dl = S.dl, hemi = S.hemi;
  const shadowOn = !indoor && !!dl && !DBG.noshadow && tier.shadow > 0;
  setupShadows(shadowOn);
  if (!DBG.noenv) try { updateEnv(now, indoor); } catch (e) { warnOnce('env', e); }
  const envK = indoor ? K.RIG.envIndoor : K.RIG.env;
  if (tier.envMode === 'metal') { if (S.prevEnv !== undefined && S.envRT && scene.environment === S.envRT.texture) scene.environment = S.prevEnv; if (S.envRT) setEnvMats(S.envRT.texture, envK); }
  else { if (S.envRT && scene.environment !== S.envRT.texture) { S.prevEnv ??= scene.environment; scene.environment = S.envRT.texture; } scene.environmentIntensity = envK; }
  // scale the rig for this draw only
  saved.dlI = dl?.intensity ?? 0; saved.hemiI = hemi?.intensity ?? 0; saved.em.length = 0;
  if (dl) {
    saved.pos.copy(dl.position); saved.tpos.copy(dl.target.position);
    if (shadowOn) {
      dl.castShadow = true; dl.intensity *= K.RIG.sun;
      const P = ctx.car?.position || ctx.car || ctx.player; vC.set(P?.x ?? 0, P?.y ?? 0, P?.z ?? 0);
      sunDir(vDir); vR.crossVectors(vDir, UP); if (vR.lengthSq() < 1e-6) vR.set(1, 0, 0); vR.normalize(); vU.crossVectors(vR, vDir).normalize();
      const u = vC.dot(vR), v = vC.dot(vU), [su, sv] = K.snapTexel(u, v, tier.shadowRange, tier.shadow); vC.addScaledVector(vR, su - u).addScaledVector(vU, sv - v);
      dl.target.position.copy(vC); dl.position.copy(vC).addScaledVector(vDir, 110); dl.target.updateMatrixWorld();
      if (!renderer.shadowMap.autoUpdate) renderer.shadowMap.needsUpdate = !dl.shadow.map || (S.frames % tier.shadowEvery) === 0; // med: every 3rd frame
    } else { dl.castShadow = false; if (!indoor && !DBG.noshadow) dl.intensity *= K.RIG.sun; }
  }
  if (hemi && !indoor) hemi.intensity *= tier.envMode === 'metal' ? 0.85 : K.RIG.hemi + (1 - K.RIG.hemi) * 0.7 * n; // by day the env carries the fill; at night keep the clock's ambient so it stays readable
  if (n > 0.01) for (const m of S.emissive) { saved.em.push(m, m.emissiveIntensity); m.emissiveIntensity *= 1 + K.RIG.emissiveNight * n; }
  S.frames++;
  try {
    const info = renderer.info; info.autoReset = false; info.reset();
    if (tier.post && !DBG.nopost) {
      renderer.getDrawingBufferSize(dbs);
      if (!S.passes || S.passes.tier !== tier.name) { buildComposer(dbs.x, dbs.y); S.passes.tier = tier.name; }
      else if (S.passes.w !== dbs.x || S.passes.h !== dbs.y) { S.passes.composer.setSize(dbs.x, dbs.y); S.passes.w = dbs.x; S.passes.h = dbs.y; } // dynamic resolution: resize, don't rebuild
      const P = S.passes; P.rp.scene = scene; P.rp.camera = camera; if (P.gtao) { P.gtao.scene = scene; P.gtao.camera = camera; }
      const pp = K.postParams(n, indoor); P.bloom.strength = pp.strength; P.bloom.radius = pp.radius; P.bloom.threshold = pp.threshold;
      const g = K.gradeFor(S.world, insideKind), u = P.grade.uniforms;
      u.sat.value = g[0]; u.contrast.value = g[1]; u.lift.value.set(...g[2]); u.gain.value.set(...g[3]);
      u.grain.value = tier.grain ? pp.grain : 0; u.vignette.value = tier.vignette ? pp.vignette : 0; u.time.value = now / 1000; u.res.value.set(dbs.x, dbs.y);
      S.composer.render(dt);
    } else origRender(scene, camera);
    S.stats.frameCalls = info.render.calls; S.stats.frameTris = info.render.triangles;
  } finally {
    renderer.info.autoReset = true;
    if (dl) { dl.intensity = saved.dlI; dl.position.copy(saved.pos); dl.target.position.copy(saved.tpos); }
    if (hemi) hemi.intensity = saved.hemiI;
    for (let i = 0; i < saved.em.length; i += 2) saved.em[i].emissiveIntensity = saved.em[i + 1];
  }
}
function wrappedRender(scene, camera) {
  if (inRender) return origRender(scene, camera);
  const surf = window.__app?.surface;
  if (!surf || scene !== surf.scene || camera !== surf.camera || !S.ctx || S.ctx.scene !== scene || tier.name === 'classic') {
    if (S.prSet != null && S.origPR != null && scene !== surf?.scene) { renderer.setPixelRatio(S.origPR); S.prSet = null; } // back in space: core pixel ratio
    if (scene !== surf?.scene || tier.name === 'classic') vignette(false);
    return origRender(scene, camera);
  }
  inRender = true;
  try { surfaceFrame(scene, camera); } catch (e) { warnOnce('frame', e); try { origRender(scene, camera); } catch { /* nothing */ } }
  finally { inRender = false; }
}

// ---------- tick (runs inside surface.update, before the frame) ----------
function tick(dt, ctx) {
  if (S.scene !== ctx.scene || S.world !== ctx.name) { // new planet (or first landing)
    if (S.scene) { clearEnvMats(); S.mats.clear(); S.terrainMats.clear(); S.emissive.clear(); S.objs.clear(); }
    S.scene = ctx.scene; S.world = ctx.name; S.envRT?.dispose(); S.envRT = null; S.envSig = null; S.scanT = 0; S.gov.reset(); S.prevEnv = undefined;
  }
  S.ctx = ctx;
  if (!S.dl || S.dl.parent !== ctx.scene || (S.sky && !S.sky.parent)) findRig(ctx.scene);
}

// ---------- tiers ----------
function applyClassic() {
  unscan(); disposeComposer();
  if (S.scene && S.envRT && S.scene.environment === S.envRT.texture) S.scene.environment = S.prevEnv ?? null;
  S.envRT?.dispose(); S.envRT = null; S.envSig = null;
  if (S.dl) S.dl.castShadow = false;
  if (S.shadowsWas) { renderer.shadowMap.enabled = S.shadowsWas.enabled; renderer.shadowMap.type = S.shadowsWas.type; renderer.shadowMap.autoUpdate = S.shadowsWas.auto; }
  if (S.origPR != null) renderer.setPixelRatio(S.origPR); S.prSet = null; S.drsCap = 0; vignette(false);
  S.scene?.traverse(o => { if (o.material) for (const m of [].concat(o.material)) if (m) m.needsUpdate = true; });
}
function setTier(name, o = {}) {
  if (name === 'auto') { pick = K.pickTier({ param: 'auto', cls: cls() }); name = pick.tier; saveLS({ tier: name, auto: true }); }
  else if (!K.TIERS[name]) return false;
  else { pick = { tier: name, auto: !!o.auto, why: o.why || 'set' }; if (!o.auto) saveLS({ tier: name, auto: false }); }
  const prev = tier; tier = K.TIERS[name];
  if (prev === tier) return true;
  if (tier.name === 'classic') applyClassic();
  else { if (prev.name === 'classic') S.origPR = null; S.drsCap = 0; S.drs = K.dynres(); disposeComposer(); clearEnvMats(); if (S.scene && S.envRT && S.scene.environment === S.envRT.texture) S.scene.environment = S.prevEnv ?? null; for (const m of S.mats) unpatch(m); S.mats.clear(); S.terrainMats.clear(); S.scanT = 0; S.envT = -1e9; S.gov.reset();
    if (S.T) for (const s of Object.values(S.T)) for (const t of [s.diff, s.nor, s.arm]) t.anisotropy = Math.min(tier.aniso || 4, renderer.capabilities.getMaxAnisotropy?.() || 1); }
  updateMenu(); for (const f of S.listeners) { try { f(tier.name, prev.name); } catch (e) { warnOnce('listener', e); } }
  return true;
}
function toast(t) { try { window.__app?.toast?.(t, 2400); } catch { /* no toast */ } }
let menuBtn = null;
const menuLabel = () => `✨ Graphics: ${tier.label}${pick.auto ? ' (auto)' : ''}`;
function updateMenu() { if (menuBtn) menuBtn.textContent = menuLabel(); }
async function openMenu() {
  const opts = [{ id: 'auto', label: `🤖 Auto (${K.TIERS[K.DEFAULT_TIER[cls()]].label} on this device)` }, ...K.ORDER.map(t => ({ id: t, label: (t === tier.name ? '✔ ' : '') + K.TIERS[t].label })), { id: 'classic', label: (tier.name === 'classic' ? '✔ ' : '') + 'Classic (v7 look)' }];
  let id = null;
  try { id = window.SSX?.city?.choice ? await window.SSX.city.choice('✨ Graphics. Phones are smoothest on Medium. Ultra adds ambient occlusion and 4K shadows.', opts) : null; }
  catch (e) { warnOnce('choice', e); }
  if (!id && !window.SSX?.city?.choice) { const all = ['classic', ...K.ORDER]; id = all[(all.indexOf(tier.name) + 1) % all.length]; }
  if (!id) return; setTier(id); toast(menuLabel());
}

const API = {
  version: VERSION,
  tier: () => tier.name, get auto() { return pick.auto; }, tiers: ['classic', ...K.ORDER], TIERS: K.TIERS,
  set: t => setTier(t), onChange(fn) { S.listeners.add(fn); return () => S.listeners.delete(fn); },
  skip(obj) { if (obj) obj.userData.noV8 = true; return obj; }, // opt an object/material out of the v8 pass (e.g. hand-made kit art)
  env: () => S.envRT?.texture || null, nightness,
  state: () => ({ version: VERSION, tier: tier.name, auto: pick.auto, why: pick.why, device: cls(), gpu: gpuName, fps: Math.round(S.fps * 10) / 10, pixelRatio: renderer?.getPixelRatio(),
    shadows: !!renderer?.shadowMap.enabled, castShadow: !!S.dl?.castShadow, env: !!S.envRT, envMode: tier.envMode, envMats: S.envMats.size, post: !!S.passes, gtao: !!S.passes?.gtao, textures: S.T ? Object.keys(S.T) : null,
    dynres: { on: !S.drsOff, pr: S.prCur, cap: S.drsCap, floor: S.drs.floor, drops: S.drs.st.drops, raises: S.drs.st.raises, emaMs: Math.round(S.drs.st.ema * 10) / 10 },
    world: S.world, debug: Object.keys(DBG).filter(k => DBG[k]), ...S.stats, governed: S.stats.governed.slice(), night: Math.round(nightness() * 100) / 100 }),
};
window.__v8 = { API, S, K, get tier() { return tier; }, scanNow: () => { S.scanT = 0; } };

(function boot() {
  const X = window.SSX, app = window.__app;
  if (!X || !app?.renderer || typeof X.registerSurfaceTick !== 'function') { setTimeout(boot, 200); return; }
  renderer = app.renderer;
  try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpuName = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || ''); } catch { gpuName = ''; }
  if (pick.auto) { pick = K.pickTier({ param: qs.get('look') || qs.get('tier'), saved: loadLS(), cls: cls() }); tier = K.TIERS[pick.tier]; }
  origRender = renderer.render.bind(renderer);
  renderer.render = wrappedRender;
  X.registerSurfaceTick(tick);
  try { menuBtn = null; X.registerMenuItem?.({ id: 'v8-graphics', label: menuLabel(), onTap: openMenu }); menuBtn = document.getElementById('v8-graphics'); } catch (e) { warnOnce('menu', e); }
  X.look = API;
})();
export default API;
