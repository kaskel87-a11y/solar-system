// v8 realistic models (window.SSX.models): rigged CC0 humans for the player and the NPCs, and modular building kits for
// Olympus Row (downtown facades), Red Tape Flats (tenements) and Helios Heights (gated villas). One hook, no core edits.
// Same pattern as Jeff's club dancers (clubdancers.js, PR #28): lazy GLBs, each model rides INSIDE the existing blocky
// group, and the blocky meshes stay (hidden) as the fallback and the far LOD, so a failed load or a phone over budget
// just shows the v7 rig. Nothing here touches the Velvet Airlock dancers (skinned, ssxDancer) or any interior.
//   People: one skinned vertex buffer per body, 2-3 draws at LOD0 (opaque, alpha-tested, helmet glass), 1 draw at LOD1;
//   geometry, atlas and materials are shared by every copy, one clip set (models/v8/chars/anims.glb) drives all four
//   bodies (same 26-joint skeleton). Nearest NPCs first, capped (phone/med 12); LOD1 + every-3rd-frame mixer past 30 m;
//   blocky rig past 80 m. Clips follow what the game already does: speed -> Idle/Walk/Run, a shot bolt leaving a
//   person -> Pistol fire, crouch -> Pistol aim, melee -> Punch, airborne -> Jump.
//   Buildings: per district, streamed when you get within 260 m; repeats are InstancedMesh, the facade kit is merged.
// Tiers follow SSX.look: classic = off (the v7 path), low = people only (cap 6), med = cap 12, high/ultra = cap 24 + shadows.
// Override: ?models=0|1 or localStorage 'ssx.models' = 'off' | 'on'. Assets + licences: models/v8/ASSETS.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const VERSION = 'v8-models-1';
const V = new URL(import.meta.url).searchParams.get('v');
const url = (n) => new URL(`../models/v8/${n}${V ? `?v=${V}` : ''}`, import.meta.url).href;
const qs = new URLSearchParams(location.search);
const LS = (() => { try { return localStorage.getItem('ssx.models'); } catch { return null; } })();
const FORCE = qs.get('models') === '0' || LS === 'off' ? 'off' : qs.get('models') === '1' || LS === 'on' ? 'on' : null;
const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const CAPS = { low: 6, med: 12, high: 24, ultra: 24 };
const D_LOD1 = 30, D_FAR = 80, D_KIT = 260;

const S = { on: false, tier: 'classic', ctx: null, scene: null, people: new Map(), player: null, pools: new Map(), files: new Map(), clips: null, mats: new Map(), stats: { attached: 0, lod0: 0, lod1: 0, blocky: 0, loads: 0, fails: 0, fired: 0, kits: 0, kitMeshes: 0 }, seenBolts: new WeakSet(), t: 0, frame: 0, kits: new Map(), warned: new Set() };
const warnOnce = (k, e) => { if (S.warned.has(k)) return; S.warned.add(k); console.warn('v8 models: ' + k, e); };
let loader = null;
const gltf = (n) => (loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)).loadAsync(url(n));

// ---------------------------------------------------------------- people ----------------------------------------------------------------
// atlas shader: garments keep their tiled UVs; the cell rect (_cell) maps fract(uv) into the shared atlas; roughness /
// metalness / tint flag ride in _rm; COLOR_0 carries each part's base colour (and the helmet glass alpha).
function charMaterial(src, kind, tint) {
  const m = new THREE.MeshStandardMaterial({ map: src.map, vertexColors: true, roughness: 1, metalness: 1, side: kind === 'opaque' ? THREE.FrontSide : THREE.DoubleSide });
  if (kind === 'mask' || kind === 'far') m.alphaTest = 0.5;
  if (kind === 'glass') { m.transparent = true; m.depthWrite = false; m.envMapIntensity = 1.4; }
  const U = { uTint: { value: new THREE.Color(tint ?? 0xffffff) }, uTintK: { value: tint == null ? 0 : 0.55 } };
  m.userData.noV8 = true; m.userData.weathered = true; m.userData.ssxChar = true; m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 _cell;\nattribute vec4 _rm;\nvarying vec4 vCell;\nvarying vec3 vRM;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCell = _cell; vRM = _rm.xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vCell;\nvarying vec3 vRM;\nuniform vec3 uTint;\nuniform float uTintK;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec2 tuv = vCell.xy + fract(vMapUv) * vCell.zw;
  vec4 sampledDiffuseColor = textureGrad(map, tuv, dFdx(vMapUv) * vCell.zw, dFdy(vMapUv) * vCell.zw);
  diffuseColor *= sampledDiffuseColor;
  if (vRM.z > 0.5) { float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, uTint * min(l * 1.5, 0.9), uTintK); }
#endif`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = max(0.04, roughness * vRM.x);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vRM.y;');
  };
  m.customProgramCacheKey = () => 'ssxchar-' + kind;
  return m;
}
const LOOKS = { player: 'player', soldier: 'soldier', hacker: 'hacker', worker: 'worker' };
function loadChar(id) {
  let f = S.files.get(id); if (f) return f;
  S.stats.loads++;
  f = Promise.all([gltf(`chars/${id}.glb`), S.clips || (S.clips = gltf('chars/anims.glb').then(g => { const c = {}; for (const a of g.animations) c[a.name.split(' (')[0]] = a; return c; }))]).then(([g, clips]) => {
    const parts = {}; g.scene.traverse(o => { if (o.isSkinnedMesh) { const k = o.material.name || 'opaque'; parts[k] = o; o.frustumCulled = true; } });
    if (!parts.opaque || !parts.far) throw new Error('bad char file ' + id);
    for (const o of Object.values(parts)) { o.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.25); }
    return { g, clips, parts, map: parts.opaque.material.map };
  });
  f.then(x => { f.ready = x; }, e => { S.stats.fails++; warnOnce('load ' + id, e); });
  S.files.set(id, f); return f;
}
function matFor(file, id, kind, tint) {
  const k = id + kind + (tint ?? ''); let m = S.mats.get(k);
  if (!m) { m = charMaterial({ map: file.map }, kind, tint); S.mats.set(k, m); }
  return m;
}
// one model instance (pooled per body+tint): cloned skeleton, shared geometry/materials, own mixer
function makeInstance(file, id, tint) {
  const root = cloneSkinned(file.g.scene); const meshes = { lod0: [], lod1: [] }; let bones = {};
  root.traverse(o => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isSkinnedMesh) return;
    const kind = o.material.name || 'opaque'; o.material = matFor(file, id, kind, tint); o.userData.noV8 = true; o.userData.ssxModel = true;
    o.castShadow = false; o.receiveShadow = false; o.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.3);
    (kind === 'far' ? meshes.lod1 : meshes.lod0).push(o);
  });
  root.rotation.y = Math.PI; // the bodies face +Z, the game's rigs face -Z
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const [n, c] of Object.entries(file.clips)) { const a = mixer.clipAction(c); acts[n] = a; if (/fire|punch|hit|death|jump/i.test(n)) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } }
  acts.Idle?.play();
  return { root, meshes, bones, mixer, acts, cur: 'Idle', id, tint, lod: 0, acc: 0 };
}
function poolGet(id, tint) { const k = id + (tint ?? ''); const p = S.pools.get(k); return p && p.length ? p.pop() : null; }
function poolPut(inst) { const k = inst.id + (inst.tint ?? ''); let p = S.pools.get(k); if (!p) S.pools.set(k, p = []); inst.root.removeFromParent(); if (p.length < 16) p.push(inst); }
function play(inst, name, fade = 0.2) {
  if (inst.cur === name || !inst.acts[name]) return;
  const a = inst.acts[name], b = inst.acts[inst.cur]; a.reset(); a.setEffectiveWeight(1); a.play(); if (b) a.crossFadeFrom(b, fade, false); inst.cur = name;
}
function setLod(inst, lod) { if (inst.lod === lod) return; inst.lod = lod; for (const o of inst.meshes.lod0) o.visible = lod === 0; for (const o of inst.meshes.lod1) o.visible = lod === 1; }

// who is this blocky group? (world.js buildPerson, interiors.js buildHuman as used by game.js agents, models.js astronaut)
const COL = { 0xff2a2a: 'guard', 0x30e0d0: 'private', 0xff7a20: 'heavy', 0xc070ff: 'contact', 0xffb030: 'colonist' };
function classify(g) {
  const ch = g.children; if (!ch.length || g.userData.ssxSkip) return null;
  const t = ch[0];
  if (t.isMesh && t.geometry?.type === 'CapsuleGeometry' && Math.abs((t.geometry.parameters?.radius ?? 0) - 0.32) < 1e-3) { // world.js buildPerson
    const vis = ch[2]?.material?.color?.getHex?.(), kind = COL[vis] || 'colonist', red = ch.some(o => o.isMesh && o.material?.color?.getHex?.() === 0xd42a2a) || ch.length > 7 && kind === 'colonist';
    const tint = t.material?.color?.getHex?.() ?? 0x888888, gun = ch.some(o => o.geometry?.parameters?.depth === 0.8);
    const body = kind === 'guard' || kind === 'private' || kind === 'heavy' ? 'soldier' : kind === 'contact' ? 'hacker' : (red || hash(g) % 3 === 0) ? 'hacker' : 'worker';
    return { src: 'world', kind, body, tint, gun, scale: kind === 'heavy' ? 1.12 : 1.06 };
  }
  if (t.isGroup && Math.abs(t.position.y - 0.92) < 1e-3 && t.children.length >= 3 && t.children.filter(c => c.isGroup).length >= 3) { // interiors.js buildHuman (game.js gang agents, shop staff)
    let top = null; t.traverse(o => { if (!top && o.isMesh && o.geometry?.parameters?.height === 0.52) top = o; });
    const tint = top?.material?.color?.getHex?.() ?? 0x3a4250, glow = !!top?.material?.emissiveIntensity;
    return { src: 'human', kind: 'agent', body: glow || tint === 0x1e2a3a ? 'soldier' : hash(g) % 2 ? 'hacker' : 'worker', tint, gun: true, scale: 0.98 };
  }
  return null;
}
const hash = (o) => { let h = 0; for (const c of o.uuid) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const isAstro = (g) => g.children.length >= 9 && g.children.some(o => o.isMesh && o.geometry?.type === 'BoxGeometry' && o.geometry.parameters.width === 0.56 && o.geometry.parameters.height === 0.66);
const outdoors = (o) => { for (let p = o.parent; p; p = p.parent) if (p.userData?.keep) return false; return true; };

function blocky(e, on) { e.group.traverse(o => { if (o.isMesh && !o.userData.ssxModel && !o.userData.ssxDancer) { if (on) { if (o.userData.__ssxVis !== undefined) { o.visible = o.userData.__ssxVis; delete o.userData.__ssxVis; } } else if (o.userData.__ssxVis === undefined) { o.userData.__ssxVis = o.visible; o.visible = false; } } }); }
function attach(e, inst) {
  e.inst = inst; e.group.add(inst.root); 
  inst.root.scale.setScalar(e.info.scale); inst.root.position.set(0, 0, 0); inst.lod = -1; setLod(inst, 0); blocky(e, false);
  for (const o of inst.meshes.lod0) o.castShadow = e.player || S.tier === 'high' || S.tier === 'ultra';
  if (e.info.gun && !inst.gun) { const gm = gunMesh(); const hand = inst.bones.WeaponR || inst.bones.RightHand; if (hand) { hand.add(gm); inst.gun = gm; } }
  if (inst.gun) inst.gun.visible = !!e.info.gun;
  S.stats.attached++;
}
function detach(e) { if (!e.inst) return; blocky(e, true); poolPut(e.inst); e.inst = null; }
let gunGeo = null, gunMat = null;
function gunMesh() { // compact sidearm, held by WeaponR (the bodies' weapon joint)
  if (!gunGeo) { const a = new THREE.BoxGeometry(0.04, 0.11, 0.2); a.translate(0, 0.02, 0.06); const b = new THREE.BoxGeometry(0.035, 0.09, 0.04); b.translate(0, -0.04, 0.0); gunGeo = mergeGeometries([a, b]); gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.7, roughness: 0.4 }); gunMat.userData.noV8 = true; }
  const m = new THREE.Mesh(gunGeo, gunMat); m.userData.ssxModel = true; m.userData.noV8 = true; return m;
}

function track(g, info, player = false) {
  const e = { group: g, info, player, inst: null, want: false, last: new THREE.Vector3(), spd: 0, fireT: 0, d: 1e9, wp: new THREE.Vector3() };
  g.getWorldPosition(e.last); S.people.set(g, e); return e;
}
function scanPeople(ctx) {
  const scene = ctx.scene, roots = [scene];
  for (const o of scene.children) if (o.isGroup && o.userData?.v8?.site) roots.push(o);
  for (const r of roots) for (const g of r.children) {
    if (!g.isGroup || S.people.has(g) || g.userData.ssxSkip) continue;
    if (!S.player && isAstro(g)) { S.player = track(g, { src: 'astro', kind: 'player', body: 'player', tint: null, gun: false, scale: 1.08 }, true); continue; }
    const info = classify(g); if (!info) { g.userData.ssxSkip = true; continue; }
    if (!outdoors(g)) continue;
    track(g, info);
  }
}
const _v = new THREE.Vector3();
function visibleInScene(g) { for (let o = g; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; }
function updatePeople(dt, ctx) {
  const cam = ctx.camera, cap = (CAPS[S.tier] ?? 12) + 1;
  const list = [];
  for (const [g, e] of S.people) {
    if (!g.parent) { detach(e); S.people.delete(g); continue; }
    g.getWorldPosition(e.wp);
    const mv = Math.hypot(e.wp.x - e.last.x, e.wp.z - e.last.z); e.last.copy(e.wp);
    e.spd += ((dt > 0 ? Math.min(mv / dt, 20) : 0) - e.spd) * Math.min(1, dt * 8);
    e.d = e.wp.distanceTo(cam.position);
    if (!visibleInScene(g) || e.d > D_FAR) { if (e.inst && e.d > D_FAR + 6) detach(e); continue; }
    list.push(e);
  }
  list.sort((a, b) => (b.player - a.player) || a.d - b.d);
  let n = 0; S.stats.lod0 = 0; S.stats.lod1 = 0; S.stats.blocky = 0;
  for (const e of list) {
    if (n >= cap) { if (e.inst) detach(e); S.stats.blocky++; continue; }
    n++;
    if (!e.inst) {
      const file = S.files.get(e.info.body);
      if (!file) { loadChar(e.info.body); S.stats.blocky++; continue; }
      if (!file.ready) { S.stats.blocky++; continue; }
      attach(e, poolGet(e.info.body, e.info.tint) || makeInstance(file.ready, e.info.body, e.info.tint));
    }
    animate(e, dt);
  }
}
function animate(e, dt) {
  const inst = e.inst, g = e.group, lod = e.d > D_LOD1 && !e.player ? 1 : 0; setLod(inst, lod);
  if (lod) S.stats.lod1++; else S.stats.lod0++;
  // crouch: world.js squashes the group (scale.y 0.6); keep the body's proportions and kneel into Pistol aim instead
  const sx = g.scale.x || 1, sy = g.scale.y || 1, k = e.info.scale; inst.root.scale.set(k, k * sx / sy, k); const crouch = sy < sx * 0.8;
  let want = 'Idle';
  if (e.player) {
    const P = S.ctx?.player; const m = P?.melee;
    if (m && m.t > 0) want = 'Punch'; else if (P && !P.grounded) want = 'Jump'; else want = e.spd > 4.2 ? 'Run' : e.spd > 0.35 ? 'Walk' : e.fireT > 0 ? 'Pistol aim' : 'Idle';
  } else want = crouch ? 'Pistol aim' : e.spd > 4.2 ? 'Run' : e.spd > 0.35 ? 'Walk' : e.fireT > 0 ? 'Pistol aim' : 'Idle';
  if (e.fireT > 0) { e.fireT -= dt; if (e.fireNow && (want === 'Idle' || want === 'Pistol aim')) { want = 'Pistol fire'; } }
  if (e.fireNow) { e.fireNow = false; if (want === 'Pistol fire') { const a = inst.acts['Pistol fire']; if (a) { a.reset(); } } }
  if (inst.cur === 'Pistol fire' && inst.acts['Pistol fire']?.isRunning() && want !== 'Run' && want !== 'Walk') want = 'Pistol fire';
  if (inst.cur === 'Punch' && inst.acts.Punch?.isRunning()) want = 'Punch';
  play(inst, want);
  const ts = want === 'Walk' ? THREE.MathUtils.clamp(e.spd / 1.5, 0.6, 1.6) : want === 'Run' ? THREE.MathUtils.clamp(e.spd / 5.5, 0.7, 1.5) : 1; if (inst.acts[want]) inst.acts[want].timeScale = ts;
  inst.acc += dt; const every = lod ? 3 : 1;
  if ((S.frame + (hash(g) % 3)) % every === 0) { inst.mixer.update(inst.acc); inst.acc = 0; }
}
// shot bolts: world.js R.bolt (0.06 x 1.4 cylinder), game.js tracer boxes; whoever is within 2.6 m of a new bolt fired it
function watchBolts(ctx) {
  const ch = ctx.scene.children, n = ch.length;
  for (let i = Math.max(0, n - 10); i < n; i++) {
    const o = ch[i]; if (!o.isMesh || S.seenBolts.has(o)) continue; S.seenBolts.add(o);
    const p = o.geometry?.parameters; if (!p) continue;
    const bolt = (o.geometry.type === 'CylinderGeometry' && p.radiusTop < 0.15 && p.height >= 0.6) || (o.geometry.type === 'BoxGeometry' && Math.max(p.width, p.height, p.depth) >= 0.6 && Math.min(p.width, p.height, p.depth) < 0.2 && o.material?.isMeshBasicMaterial);
    if (!bolt) continue;
    let best = null, bd = 2.6; for (const e of S.people.values()) { if (!e.inst) continue; const d = Math.hypot(e.wp.x - o.position.x, e.wp.z - o.position.z); if (d < bd) { bd = d; best = e; } }
    if (best) { best.fireT = 2.5; best.fireNow = true; S.stats.fired++; }
  }
}

// ---------------------------------------------------------------- building kits ----------------------------------------------------------------
import('./models-kits.js').then(m => { S.kitMod = m; }, e => warnOnce('kits module', e));

// ---------------------------------------------------------------- runtime ----------------------------------------------------------------
function wanted() { if (FORCE === 'off') return false; const t = window.SSX?.look?.tier?.(); S.tier = typeof t === 'string' ? t : 'classic'; return FORCE === 'on' ? true : S.tier !== 'classic'; }
function clearAll() {
  for (const e of S.people.values()) detach(e); S.people.clear(); if (S.player) { detach(S.player); S.player = null; }
  for (const k of S.kits.values()) S.kitMod?.removeKit?.(k); S.kits.clear();
}
function tick(dt, ctx) {
  S.frame++;
  const on = wanted();
  if (!on || ctx.name !== 'Mars' && S.tier === 'low') { if (S.on) { clearAll(); S.on = false; } return; }
  if (S.scene !== ctx.scene) { clearAll(); S.scene = ctx.scene; S.t = 0; }
  S.on = true; S.ctx = ctx;
  if ((S.t -= dt) <= 0) { S.t = 0.5; try { scanPeople(ctx); } catch (e) { warnOnce('scan', e); } if (S.player && !S.people.has(S.player.group)) S.people.set(S.player.group, S.player); }
  try { watchBolts(ctx); updatePeople(dt, ctx); } catch (e) { warnOnce('people', e); }
  if (S.kitMod && ctx.name === 'Mars' && S.tier !== 'low') { try { S.kitMod.updateKits(S, ctx, D_KIT); } catch (e) { warnOnce('kits', e); } }
}
const API = {
  version: VERSION,
  enabled: () => S.on,
  state: () => ({ version: VERSION, on: S.on, tier: S.tier, force: FORCE, people: S.people.size, player: !!S.player?.inst, cap: CAPS[S.tier] ?? 12, ...S.stats, files: [...S.files.keys()], kits: [...S.kits.keys()], kitState: S.kitMod?.kitState?.(S) }),
  preload: (ids = ['player', 'soldier', 'worker', 'hacker']) => Promise.all(ids.map(loadChar)),
};
S.gltf = gltf;
window.__v8models = { S, API, dev: { loadChar, makeInstance, play } };
(function boot() {
  const X = window.SSX; if (!X || typeof X.registerSurfaceTick !== 'function') { setTimeout(boot, 250); return; }
  X.registerSurfaceTick(tick); X.models = API;
})();
export default API;
