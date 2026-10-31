// Mars player skins (Pumpkin). Threadbare, a grimy second-hand clothes stall in downtown Ares Junction: walk up and a black
// "👕 Threadbare" button opens the shop. Eleven outfits from 0 to 5,000 cr (the Rusty Spacesuit is free), bought with in-game
// cr; ☰ → 👕 Wardrobe swaps between the ones you own (and back to the stock white suit) anywhere.
// A skin recolours the actual player rig (models.js buildAstronaut: torso, arms, legs, helmet, pack, chest, visor, boots)
// and adds low-poly parts (hats, masks, chains, duster, mohawk, duffel...) to the rig's own limbs, so they swing with it.
// Phone rule: every part of a skin is merged per slot + material once (cached, shared, never disposed), so a skin is ~8-14
// extra draws; nothing is allocated per frame (the tick only compares a few references).
// Steve's v8 realistic people (PR #48, look/models.js, window.SSX.models / window.__v8models): when the realistic body is
// riding inside the player rig, the blocky parts are hidden and the head / torso parts are re-attached to its Head / Spine2
// bones (feature-detected; when that body is swapped or dropped, the skin re-attaches by itself). A recolour goes through the
// body's tint uniforms when present. Nothing here depends on #48 being merged.
// Taps are real taps only (same pointerId, < 10 px), so swiping the shop list never buys anything.
// Hooks: one <script type="module"> line in index.html (+ import map), one sw.js precache line. Everything else via
// window.__app (surface, toast, state) and window.SSX (registerSurfaceTick, registerMenuItem, minimap), all guarded.
// Pure logic: ./skinscore.js.  window.SSX.skins = { list, owned, equipped, buy, equip, open, close, state, on }  window.__skins = test helpers
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildAstronaut } from '../models.js';
import * as C from './skinscore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game, X = () => window.SSX || {};
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const log = [], subs = new Set();
const toast = (t, ms = 2600) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } log.push(t); if (log.length > 40) log.shift(); };
const emit = (type, d = {}) => { for (const f of subs) { try { f({ type, ...d }); } catch (e) { /* */ } } try { window.SSX?.emit?.('skins:' + type, d); } catch (e) { /* */ } };
const credits = () => +(tryv(() => game()?.progress?.credits, 0) || 0);

// ---------- save ----------
let st = C.fresh();
try { st = C.parse(localStorage.getItem(C.SAVE_KEY)); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(st)); } catch (e) { /* */ } };

// ---------- shared geometry + materials (made once, flagged shared so surface.exit never disposes them) ----------
const geos = new Map(), mats = new Map(), merged = new Map();
const shared = o => { o.userData.shared = true; o.userData.noV8 = true; return o; };
function geo(shape, d) {
  const k = C.geoKey(shape, d); let g = geos.get(k); if (g) return g;
  if (shape === 'box') g = new THREE.BoxGeometry(d[0], d[1], d[2]);
  else if (shape === 'cyl') g = new THREE.CylinderGeometry(d[0], d[1], d[2], d[3] || 8);
  else if (shape === 'sph') g = new THREE.SphereGeometry(d[0], d[1] || 10, d[2] || 6, d[3] ?? 0, d[4] ?? Math.PI * 2, d[5] ?? 0, d[6] ?? Math.PI);
  else if (shape === 'tor') g = new THREE.TorusGeometry(d[0], d[1], d[2] || 5, d[3] || 12);
  else if (shape === 'cone') g = new THREE.ConeGeometry(d[0], d[1], d[2] || 6);
  else g = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  geos.set(k, shared(g)); return g;
}
const HIDDEN = shared(new THREE.MeshBasicMaterial({ visible: false }));
function mat(spec) {
  if (!spec) return null; if (spec.hidden) return HIDDEN;
  const k = C.matKey(spec); let m = mats.get(k); if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: spec.c, roughness: spec.r, metalness: spec.m, emissive: spec.e || 0x000000, flatShading: true });
  mats.set(k, shared(m)); return m;
}
// one skin -> { slot: [{ geo, mat }] }, every part of a slot that shares a material merged into one geometry
const FACE = [['head', 'sph', [0.17, 12, 9], [0, 0, 0], 0, 'skin'], ['head', 'cyl', [0.075, 0.085, 0.16, 8], [0, -0.2, 0], 0, 'skin'],
  ['head', 'sph', [0.022, 6, 4], [-0.06, 0.03, -0.155], 0, 'eye'], ['head', 'sph', [0.022, 6, 4], [0.06, 0.03, -0.155], 0, 'eye']];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function built(id) {
  let b = merged.get(id); if (b) return b; const k = C.BY_ID[id]; if (!k) return null;
  const by = new Map();
  for (const p of [...(k.face ? FACE : []), ...k.parts]) {
    const [slot, shape, dims, pos, rot, mk, sc] = p, spec = C.matSpec(k, mk); if (!spec || spec.hidden) continue;
    const g = geo(shape, dims).clone(); // the clone is baked into the merged slot geometry below, then dropped
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0); _q.setFromEuler(_e); _p.set(pos[0], pos[1], pos[2]); _s.set(sc ? sc[0] : 1, sc ? sc[1] : 1, sc ? sc[2] : 1);
    g.applyMatrix4(_m.compose(_p, _q, _s)); const key = slot + '|' + C.matKey(spec);
    if (!by.has(key)) by.set(key, { slot, mat: mat(spec), gs: [] }); by.get(key).gs.push(g.index ? g : g);
  }
  b = {}; for (const { slot, mat: m, gs } of by.values()) {
    const all = gs.map(g => g.index ? g.toNonIndexed() : g); const mg = all.length > 1 ? mergeGeometries(all, false) : all[0];
    for (const g of gs) g.dispose(); for (const g of all) if (g !== mg) g.dispose();
    mg.computeBoundingSphere(); shared(mg); (b[slot] ||= []).push({ geo: mg, mat: m });
  }
  merged.set(id, b); return b;
}

// ---------- the player rig (models.js buildAstronaut) ----------
const P = (o, t) => o?.isMesh && o.geometry?.type === t ? o.geometry.parameters : null;
export function isRig(g) { return !!g?.isGroup && g.children.length >= 9 && g.children.some(o => { const p = P(o, 'BoxGeometry'); return p && p.width === 0.56 && p.height === 0.66; }); }
function readRig(g) {
  if (g.userData.ssxRig) return g.userData.ssxRig;
  const r = { group: g, reg: {}, limbs: {} }, add = (k, o) => { (r.reg[k] ||= []).push(o); };
  for (const o of g.children) {
    let p;
    if ((p = P(o, 'BoxGeometry'))) { if (p.width === 0.56) { add('torso', o); r.torso = o; } else if (p.width === 0.48) add('pack', o); else if (p.width === 0.26) add('chest', o); }
    else if ((p = P(o, 'SphereGeometry'))) { if (Math.abs(p.radius - 0.23) < 1e-3) { add('helmet', o); r.helmet = o; } else if (Math.abs(p.radius - 0.18) < 1e-3) add('visor', o); }
    else if ((p = P(o, 'CylinderGeometry'))) {
      const side = o.position.x < 0 ? 'L' : 'R';
      if (Math.abs(p.radiusTop - 0.12) < 1e-3) { add('legs', o); r.limbs['leg' + side] = o; for (const c of o.children) if (P(c, 'BoxGeometry')?.width === 0.2) add('boots', c); }
      else if (Math.abs(p.radiusTop - 0.085) < 1e-3) { add('arms', o); r.limbs['arm' + side] = o; }
    }
  }
  r.ok = !!(r.torso && r.limbs.legL && r.limbs.legR && r.limbs.armL && r.limbs.armR);
  g.userData.ssxRig = r; return r;
}
const HEAD_Y = 1.72, TORSO_Y = 1.24;
function clearSkin(rig) {
  const a = rig.applied; if (!a) return;
  for (const o of a.anchors) o.removeFromParent();
  for (const [o, m] of a.orig) o.material = m;
  rig.applied = null; v8Clear(rig);
}
// put a skin on a rig (the player, or a shop mannequin): recolour the regions, hang the merged parts on the limbs
function applySkin(rig, id) {
  clearSkin(rig); if (!rig?.ok) return false;
  const k = C.BY_ID[id]; if (!k) return true; // stock: nothing on, original materials back
  const a = { id, anchors: [], orig: new Map() }; rig.applied = a;
  for (const reg of C.REGIONS) {
    const spec = (k.face && (reg === 'helmet' || reg === 'visor')) ? { hidden: true } : C.matSpec(k, reg); if (!spec) continue;
    for (const o of rig.reg[reg] || []) { if (!a.orig.has(o)) a.orig.set(o, o.material); o.material = mat(spec); }
  }
  const b = built(id) || {};
  for (const slot of C.SLOTS) {
    const list = b[slot]; if (!list) continue;
    const an = new THREE.Group(); an.name = 'ssxSkin:' + slot; an.userData.ssxSkin = true; an.userData.slot = slot;
    for (const { geo: g, mat: m } of list) { const me = new THREE.Mesh(g, m); me.userData.ssxModel = true; me.userData.noV8 = true; me.castShadow = !!rig.player; an.add(me); }
    if (slot === 'head') { an.position.set(0, HEAD_Y, 0); rig.group.add(an); }
    else if (slot === 'torso') { an.position.set(0, TORSO_Y, 0); rig.group.add(an); }
    else (rig.limbs[slot] || rig.group).add(an);
    a.anchors.push(an);
  }
  return true;
}

// ---------- Steve's v8 realistic body (PR #48), feature-detected ----------
// window.__v8models.S.player = { group (our rig group), inst: { root, bones: { Head, Neck, Spine2, ... }, meshes: { lod0, lod1 } } }
const V8 = { headScale: 0.78, headUp: 0.09, torsoUp: 0.05, torsoScale: [0.68, 0.92, 0.62] }; // the v8 body is slimmer than the blocky rig
function v8Inst(rig) {
  const S = tryv(() => window.__v8models?.S); const e = S?.player;
  if (!S?.on || !e || e.group !== rig.group || !e.inst?.bones) return null; return e.inst;
}
const _gi = new THREE.Matrix4(), _bw = new THREE.Vector3();
function v8Attach(rig, inst) {
  const a = rig.applied; if (!a) return; const k = C.BY_ID[a.id]; const b = built(a.id) || {};
  rig.group.updateMatrixWorld(true); _gi.copy(rig.group.matrixWorld).invert();
  const bones = inst.bones, find = re => Object.values(bones).find(o => re.test(o.name));
  const map = { head: bones.Head || find(/head/i), torso: bones.Spine2 || bones.Spine1 || find(/spine|chest/i) };
  const out = [];
  for (const slot of ['head', 'torso']) {
    const bone = map[slot], list = b[slot]; if (!bone || !list) continue;
    // anchor on the bone, oriented like the rig group (faces -Z, upright) at the pose we attach in, so it follows the bone
    bone.getWorldPosition(_bw); const p = _bw.applyMatrix4(_gi); p.y += slot === 'head' ? V8.headUp : V8.torsoUp;
    const an = new THREE.Group(); an.name = 'ssxSkinV8:' + slot; an.userData.ssxSkin = true; an.matrixAutoUpdate = false;
    for (const { geo: g, mat: m } of list) { const me = new THREE.Mesh(g, m); me.userData.ssxModel = true; me.userData.noV8 = true; an.add(me); }
    const h = V8.headScale, sc = slot === 'head' ? [h, h, h] : V8.torsoScale;
    _m.compose(p, _q.identity(), _s.set(sc[0], sc[1], sc[2])); an.matrix.copy(bone.matrixWorld).invert().multiply(rig.group.matrixWorld).multiply(_m);
    bone.add(an); out.push(an);
  }
  // recolour: the body's tint uniforms (garments flagged tintable), torso colour of the skin
  const tint = C.matSpec(k, 'torso'), saved = [];
  if (tint && !tint.hidden) for (const o of [...(inst.meshes?.lod0 || []), ...(inst.meshes?.lod1 || [])]) { const U = o.material?.userData?.U; if (U?.uTint && U?.uTintK) { saved.push([U, U.uTint.value.getHex(), U.uTintK.value]); U.uTint.value.setHex(tint.c); U.uTintK.value = 0.7; } }
  rig.v8 = { inst, anchors: out, saved };
  for (const an of a.anchors) an.visible = false; // the blocky parts sit where the hidden blocky rig is
}
function v8Clear(rig) {
  const v = rig.v8; if (!v) return; rig.v8 = null;
  for (const an of v.anchors) an.removeFromParent();
  for (const [U, hex, kk] of v.saved) { U.uTint.value.setHex(hex); U.uTintK.value = kk; }
  if (rig.applied) for (const an of rig.applied.anchors) an.visible = true;
}
// every frame: is the v8 body (still) riding in the rig? re-attach when it was swapped
function v8Sync(rig) {
  if (!rig.applied) { if (rig.v8) v8Clear(rig); return; }
  const inst = v8Inst(rig);
  if (inst === (rig.v8?.inst || null)) return;
  if (rig.v8) v8Clear(rig); if (inst) v8Attach(rig, inst);
}

// ---------- player tracking ----------
let player = null, scanT = 0, sceneRef = null;
const stats = { applies: 0, scans: 0, reattach: 0 };
function findPlayer(scene) {
  stats.scans++; for (const g of scene.children) if (isRig(g) && !g.userData.ssxMannequin) return g; return null;
}
function syncPlayer(tc) {
  const sc = tc.scene; if (!sc) return;
  if (player && (player.group.parent !== sc || sceneRef !== sc)) { player = null; }
  if (!player) { if ((scanT -= 1) > 0) return; scanT = 30; const g = findPlayer(sc); if (!g) return; sceneRef = sc; player = readRig(g); player.player = true; if (!player.ok) { player = null; return; } stats.reattach++; }
  const want = st.eq === C.STOCK ? null : st.eq;
  if ((player.applied?.id || null) !== want) { applySkin(player, want || C.STOCK); stats.applies++; }
  else if (player.applied && player.applied.anchors.some(an => !an.parent)) { applySkin(player, want); stats.applies++; } // someone pulled our parts off
  v8Sync(player);
}

// ---------- the shop stall + mannequins (downtown Ares Junction, AJ-relative) ----------
const at = () => { const c = tryv(() => surf()?.world?.colony) || tryv(() => surf()?.info?.colony); return c && C.fin(c.x) ? { x: c.x + C.SHOP.aj[0], z: c.z + C.SHOP.aj[1], yaw: Math.atan2(C.SHOP.aj[0], C.SHOP.aj[1]) } : null; };
// a point in front of the counter (stall-local 0,0,-1.6; the stall's front faces the colony centre)
const front = (p, d = 1.6) => ({ x: p.x - Math.sin(p.yaw) * d, z: p.z - Math.cos(p.yaw) * d });
let stall = null, stallScene = null, sMats = null;
function signTex() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#f2f2f2'; x.lineWidth = 6; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = '#ffffff'; x.font = '900 64px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('THREADBARE', 256, 54);
  x.font = '700 24px system-ui, sans-serif'; x.fillStyle = '#d0d0d0'; x.fillText('CLOTHES · NO QUESTIONS', 256, 100);
  for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(${90 + Math.random() * 60 | 0},${50 + Math.random() * 30 | 0},30,${Math.random() * 0.35})`; x.fillRect(Math.random() * 512, Math.random() * 128, 2 + Math.random() * 10, 1 + Math.random() * 4); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; return t;
}
function stallMats() {
  if (sMats) return sMats; const M = (c, o = {}) => shared(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true, ...o }));
  sMats = { wall: M(0x3a2f28), rust: M(0x6a3a20), metal: M(0x5a5e64, { metalness: 0.5, roughness: 0.6 }), awn: M(0x1a1a1a), stripe: M(0xe8e8e8),
    sign: shared(new THREE.MeshBasicMaterial({ map: signTex(), toneMapped: false })), bulb: shared(new THREE.MeshBasicMaterial({ color: 0xfff2c0 })),
    shirts: [0x8a1a1a, 0x2a5a8a, 0xd8c040, 0x2e4a24, 0x5a1a8a, 0xe8e2d0].map(c => M(c)) };
  return sMats;
}
const mannequins = [];
function buildStall(scene, h) {
  const p = at(); if (!p) return; const m = stallMats(); const g = new THREE.Group(); g.name = 'ssxSkinShop'; g.userData.ssxSkip = true;
  const box = (w, hh, d, mm, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo('box', [w, hh, d]), mm); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  // back wall, side posts, a striped awning, the sign, a rail of hanging shirts, a crate counter
  box(5.2, 3, 0.25, m.wall, 0, 1.5, 1.2); box(0.18, 3.1, 0.18, m.rust, -2.5, 1.55, -0.9); box(0.18, 3.1, 0.18, m.rust, 2.5, 1.55, -0.9);
  for (let i = 0; i < 6; i++) { const s = box(0.88, 0.08, 2.4, i % 2 ? m.stripe : m.awn, -2.2 + i * 0.88, 3.1, 0.1); s.rotation.x = -0.18; }
  const sign = new THREE.Mesh(geo('box', [3.6, 0.9, 0.06]), [m.wall, m.wall, m.wall, m.wall, m.sign, m.wall]); sign.position.set(0, 3.75, -1.05); sign.rotation.y = Math.PI; g.add(sign);
  for (const x of [-1.6, 1.6]) box(0.12, 0.12, 0.12, m.bulb, x, 3.25, -1.0);
  box(4.2, 0.05, 0.05, m.metal, 0, 2.2, 0.8); for (let i = 0; i < 9; i++) box(0.34, 0.6, 0.06, m.shirts[i % m.shirts.length], -1.9 + i * 0.47, 1.85, 0.8, 0.2 * Math.sin(i * 3));
  box(1.4, 0.9, 0.7, m.rust, 0, 0.45, -0.2); box(1.5, 0.06, 0.8, m.metal, 0, 0.93, -0.2);
  // two mannequins in skins on the shop floor (real rigs, the same parts the player gets)
  mannequins.length = 0;
  for (const [x, id] of [[-1.7, 'cowboy'], [1.7, 'kingpin']]) {
    const a = buildAstronaut(); a.group.userData.ssxMannequin = true; a.group.userData.ssxSkip = true; a.group.position.set(x, 0, -0.1); a.group.rotation.y = Math.PI + (x < 0 ? 0.35 : -0.35);
    const rig = readRig(a.group); applySkin(rig, id); a.parts.armL.rotation.x = 0.15; a.parts.armR.rotation.x = -0.1; g.add(a.group); mannequins.push(rig);
  }
  const gy = tryv(() => h?.(p.x, p.z)); g.position.set(p.x, C.fin(gy) ? gy : 0, p.z); g.rotation.y = p.yaw; // the open front (local -Z) faces the colony centre
  scene.add(g); stall = g; stallScene = scene;
}
let marked = false;
function ensureStall(tc) {
  if (tc.name !== 'Mars') return;
  if (!stall || stallScene !== tc.scene || !stall.parent) { stall = null; buildStall(tc.scene, tc.height); marked = false; }
  if (!marked) { const p = at(); if (p) { marked = true; tryv(() => X().minimap?.addMarks?.('skins', [{ ...front(p, 1.5), color: '#ffffff', r: 2.6, label: 'Threadbare' }])); } }
}
const nearShop = () => { const s = app()?.state, i = surf()?.info, p = at(); if (!s?.onSurface || s.transitioning || !i || i.name !== 'Mars' || !p) return false; if (i.driving || tryv(() => surf()?.world?.inside)) return false; const f = front(p); return Math.hypot(i.x - f.x, i.z - f.z) < C.SHOP.near; };

// ---------- UI (black and white) ----------
const css = `#skBtn{position:fixed;z-index:9;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));min-height:48px;padding:0 18px;border-radius:24px;border:2px solid #fff;background:#000;color:#fff;font:800 16px system-ui,sans-serif;display:none;touch-action:manipulation}
body.surface:not(.indoors) #skBtn.show{display:block}
#skPanel{position:fixed;z-index:61;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));max-width:560px;margin:0 auto;max-height:56vh;display:none;flex-direction:column;background:#000;color:#fff;border:2px solid #fff;border-radius:14px;font:14px system-ui,sans-serif;box-shadow:0 -4px 24px rgba(0,0,0,.6)}
#skPanel.open{display:flex} #skPanel .hd{display:flex;align-items:center;gap:8px;padding:10px 10px 6px;border-bottom:1px solid #444}
#skPanel .hd .t{flex:1;font:900 17px system-ui,sans-serif} #skPanel .hd .t small{display:block;font:500 12px system-ui,sans-serif;color:#bbb}
#skPanel .hd .cr{font-weight:800;white-space:nowrap}
#skPanel .list{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:2px 10px 10px;touch-action:pan-y}
#skPanel .row{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #2a2a2a} #skPanel .row:first-child{border-top:0}
#skPanel .row .ic{font-size:24px;width:30px;text-align:center} #skPanel .row .nm{flex:1;font-weight:800} #skPanel .row .nm small{display:block;font-weight:400;color:#bbb;font-size:12px;line-height:1.25}
#skPanel button{min-height:44px;min-width:44px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation;padding:0 12px;white-space:nowrap}
#skPanel button.on{background:#fff;color:#000} #skPanel button.no{border-style:dashed;border-color:#777;color:#aaa}
#skPanel .lh{display:flex;align-items:center;gap:8px;padding:8px 0 4px;border-top:1px solid #444;margin-top:2px;font:800 12px system-ui,sans-serif;color:#bbb;text-transform:uppercase;letter-spacing:.04em} #skPanel .lh span{flex:1}
#skPanel .lh button{min-height:34px;font-size:13px;padding:0 10px;text-transform:none;letter-spacing:0}
#skPanel .lk{display:flex;align-items:center;gap:6px;min-height:30px;padding:2px 0;color:#fff;font-size:13px} #skPanel .lk .nm{flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#skPanel .lk .pr{color:#bbb;white-space:nowrap;font-weight:600} #skPanel .lk button{min-height:32px;font-size:13px;padding:0 12px} #skPanel .lk button.no{border:2px solid #555;color:#777}`;
let btn = null, panel = null, mode = 'shop', menuBtn = null;
const taps = { fired: 0, swipes: 0, buys: 0, refused: 0 };
// real tap only: same pointerId, < TAP_PX moved over the gesture; mouse / keyboard click still work
function realTap(el, fn) {
  let down = null, maxMove = 0, lastTouch = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.target }; maxMove = 0; });
  el.addEventListener('pointermove', e => { if (down && e.pointerId === down.id) maxMove = Math.max(maxMove, Math.hypot(e.clientX - down.x, e.clientY - down.y)); });
  el.addEventListener('pointercancel', e => { if (down && e.pointerId === down.id) { down = null; taps.swipes++; } });
  el.addEventListener('scroll', () => { if (down) maxMove = 99; }, true);
  el.addEventListener('pointerup', e => { if (!down || e.pointerType === 'mouse') return; const d = down; down = null; lastTouch = performance.now();
    if (!C.isRealTap(d, { id: e.pointerId, x: e.clientX, y: e.clientY }, maxMove)) { taps.swipes++; return; } e.preventDefault(); taps.fired++; fn(d.t); });
  el.addEventListener('click', e => { if (performance.now() - lastTouch < 700) return; fn(e.target); });
}
function ensureUi() {
  if (btn) return;
  const s = document.createElement('style'); s.id = 'skCss'; s.textContent = css; document.head.appendChild(s);
  btn = document.createElement('button'); btn.id = 'skBtn'; btn.type = 'button'; btn.textContent = '👕 Threadbare · clothes'; document.body.appendChild(btn); realTap(btn, () => open('shop'));
  panel = document.createElement('div'); panel.id = 'skPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Clothes');
  panel.innerHTML = '<div class="hd"><div class="t"></div><div class="cr"></div><button type="button" data-a="x" aria-label="Close">✕</button></div><div class="list"></div>';
  document.body.appendChild(panel);
  realTap(panel, t => { const b = t?.closest?.('button[data-a]'); if (!b || !panel.contains(b)) return; const a = b.dataset.a, id = b.dataset.id;
    if (a === 'x') close(); else if (a === 'buy') buy(id); else if (a === 'wear') equip(id); else if (a === 'goshop') goShop(); else if (a === 'wbuy') wardrobeBuy(id); });
}
function render() {
  if (!panel) return; const cr = credits(), shop = mode === 'shop';
  panel.querySelector('.t').innerHTML = shop ? `👕 ${C.SHOP.name}<small>${C.SHOP.sub}</small>` : '👕 Wardrobe<small>Outfits you own. Tap Wear to swap.</small>';
  panel.querySelector('.cr').textContent = `💰 ${C.fmt(cr)} cr`;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  panel.querySelector('.list').innerHTML = C.rows(st, cr, mode).map(r => {
    const b = r.worn ? `<button type="button" class="on" data-a="none" data-id="${r.id}" aria-pressed="true">Wearing</button>`
      : r.owned ? `<button type="button" data-a="wear" data-id="${r.id}">Wear</button>`
      : `<button type="button" class="${r.afford ? '' : 'no'}" data-a="buy" data-id="${r.id}">Buy · ${C.fmt(r.price)} cr</button>`;
    return `<div class="row" data-id="${r.id}"><div class="ic">${r.icon}</div><div class="nm">${esc(r.name)}<small>${r.owned || !r.price ? '' : C.fmt(r.price) + ' cr · '}${esc(r.blurb)}</small></div>${b}</div>`;
  }).join('') + (shop ? '' : lockedHtml(cr, esc));
}
function open(m = 'shop') {
  ensureUi(); if (m === 'shop' && !nearShop() && !api.__anywhere) { toast('👕 Threadbare is in downtown Ares Junction.'); return false; }
  mode = m; const keep = panel.classList.contains('open') ? panel.querySelector('.list').scrollTop : 0; render(); panel.classList.add('open'); panel.querySelector('.list').scrollTop = keep; emit('open', { mode }); return true;
}
function close() { panel?.classList.remove('open'); emit('close'); }
function buy(id) {
  const k = C.BY_ID[id]; if (!k) return { ok: false, why: 'unknown' };
  if (mode === 'shop' && !nearShop() && !api.__anywhere) { toast('👕 Buy it at Threadbare, downtown Ares Junction.'); return { ok: false, why: 'far' }; }
  const c = C.canBuy(st, id, credits());
  if (!c.ok) { if (c.why === 'broke') { taps.refused++; toast(`👕 ${k.name} is ${C.fmt(k.price)} cr. You have ${C.fmt(credits())} cr.`, 2800); } else if (c.why === 'owned') equip(id); render(); return c; }
  const g = game(); const paid = c.price === 0 || !!tryv(() => g.spend(c.price), false);
  if (!paid) { taps.refused++; toast(`👕 You need ${C.fmt(k.price)} cr.`); render(); return { ok: false, why: 'broke' }; }
  st = C.addOwned(st, id); taps.buys++; save(); emit('buy', { id, price: c.price });
  equip(id, true); toast(`👕 ${k.name} bought${c.price ? ` · −${C.fmt(c.price)} cr` : ''}. You're wearing it.`, 2800);
  return { ok: true, id, price: c.price };
}
function equip(id, quiet) {
  const r = C.equip(st, id); if (!r.ok) { toast('👕 Buy it at Threadbare first.'); return r; }
  st = r.state; save(); if (player) { applySkin(player, id); stats.applies++; v8Sync(player); }
  if (!quiet) toast(id === C.STOCK ? '👕 Back in the stock suit.' : `👕 Wearing ${C.BY_ID[id].name}.`, 2000);
  emit('equip', { id }); render(); return { ok: true, id };
}
function hookMenu() {
  if (menuBtn?.isConnected) return true; const reg = X().registerMenuItem; if (typeof reg !== 'function') return false;
  try { menuBtn = reg({ id: 'rmWardrobe', label: '👕 Wardrobe', onTap: () => open('wardrobe') }); } catch (e) { console.warn('skins menu', e); return false; }
  return true;
}

// ---------- Wardrobe extras: locked outfits, 'Shop all outfits' waypoint, buy at the counter ----------
// Away from the stall the unowned outfits are compact 🔒 rows (name + price); 'Shop all outfits' sets the HUD waypoint
// (SSX.hudx.setWaypoint -> ➤ arrow + blue beam; else SSX.waypoint/nav/gps, guarded) to the Threadbare counter and closes.
// At the counter each row gets a Buy button that goes through buy() (same spend / ownership / auto-wear as the shop).
let wNear = false;
function lockedHtml(cr, esc) {
  const near = wNear = !!(nearShop() || api.__anywhere), L = C.locked(st, cr, near); if (!L.length) return '';
  return `<div class="lh"><span>🔒 More at Threadbare · ${L.length}</span><button type="button" data-a="goshop">${near ? '👕 Open shop' : '📍 Shop all outfits'}</button></div>` + L.map(r =>
    `<div class="lk" data-id="${r.id}"><span>🔒</span><span class="nm">${r.icon} ${esc(r.name)}</span><span class="pr">${C.fmt(r.price)} cr</span>${r.canBuy ? `<button type="button" class="${r.afford ? '' : 'no'}" data-a="wbuy" data-id="${r.id}"${r.afford ? '' : ' aria-disabled="true"'}>Buy</button>` : ''}</div>`).join('');
}
function setNav(t) {
  try { const h = X().hudx; if (typeof h?.setWaypoint === 'function') { h.setWaypoint(t); return 'hudx'; } } catch (e) { /* */ }
  for (const k of ['waypoint', 'nav', 'gps']) { const n = X()[k]; for (const f of ['set', 'to', 'add']) if (typeof n?.[f] === 'function') { try { n[f](t); return k; } catch (e) { /* */ } } }
  return null;
}
function goShop() {
  if (nearShop()) return open('shop');
  const p = at(), onMars = tryv(() => surf()?.info?.name) === 'Mars' && !!app()?.state?.onSurface;
  if (!p || !onMars) { toast('👕 Threadbare is in downtown Ares Junction on Mars.'); return null; }
  const f = front(p, 1.5), via = setNav({ x: f.x, z: f.z, label: 'Threadbare (clothes)' });
  if (!via) toast('👕 Threadbare is in downtown Ares Junction (white dot on the map).');
  close(); emit('waypoint', { via }); return via;
}
function wardrobeBuy(id) {
  if (!nearShop() && !api.__anywhere) { toast('👕 Buy it at Threadbare, downtown Ares Junction.'); render(); return { ok: false, why: 'far' }; }
  return buy(id);
}
// ---------- hand props (Velvet Mack's cane): hidden while a weapon is out, back after (all feature-detected) ----------
// A skin's prop: [palette keys] are the materials of its hand-held prop; those meshes hide while you fire (2.5 s after the
// last shot, game.progress.stats.shots), hold the flamer (SSX.flame.state().eq) or have the machete / cleaver equipped.
const PROP = { out: null, shots: -1, shotT: -9, n: 0 };
function weaponOut() {
  const P = tryv(() => game()?.progress), now = performance.now() / 1000, sh = +tryv(() => P.stats.shots, NaN);
  if (Number.isFinite(sh)) { if (PROP.shots >= 0 && sh > PROP.shots) PROP.shotT = now; PROP.shots = sh; }
  if (now - PROP.shotT < 2.5) return 'firing';
  if (tryv(() => X().flame?.state?.().eq)) return 'flamer';
  const w = tryv(() => P.equip.weapon); if (w === 'blade' || w === 'cleaver') return 'melee';
  return null;
}
function syncProp() {
  const a = player?.applied, k = a && C.BY_ID[a.id]; if (!k?.prop) { PROP.out = null; PROP.n = 0; return; }
  const out = weaponOut(), ms = new Set(k.prop.map(key => mat(C.matSpec(k, key)))); let n = 0;
  for (const an of a.anchors) for (const o of an.children) if (ms.has(o.material)) { o.visible = !out; n++; }
  PROP.out = out; PROP.n = n;
}
setInterval(() => { try { syncProp(); } catch (e) { /* */ } }, 120);
// walking up to / away from the counter with the Wardrobe open shows / hides the Buy buttons
setInterval(() => { try { if (panel?.classList.contains('open') && mode === 'wardrobe' && !!(nearShop() || api.__anywhere) !== wNear) render(); } catch (e) { /* */ } }, 500);

// ---------- per frame (SSX.registerSurfaceTick) ----------
let near = false, ticking = false, frameN = 0;
function tick(dt, tc) {
  try {
    frameN++; syncPlayer(tc); if (tc.name === 'Mars') ensureStall(tc);
    for (const r of mannequins) v8Sync(r);
    const n = tc.name === 'Mars' && nearShop(); if (n !== near) { near = n; ensureUi(); btn.classList.toggle('show', n); if (!n && mode === 'shop') close(); }
    if (!(frameN % 30) && panel?.classList.contains('open')) { const t = panel.querySelector('.cr'), v = `💰 ${C.fmt(credits())} cr`; if (t.textContent !== v) render(); }
  } catch (e) { console.warn('skins tick', e); }
}
function hookTick() { if (ticking) return true; const r = X().registerSurfaceTick; if (typeof r !== 'function') return false; r(tick); ticking = true; return true; }

// ---------- API ----------
const api = {
  list: () => C.SKINS.map(k => ({ id: k.id, name: k.name, price: k.price, icon: k.icon, owned: C.owns(st, k.id), worn: st.eq === k.id })),
  get owned() { return st.owned.slice(); }, get equipped() { return st.eq; }, buy, equip, open, close, at, near: nearShop,
  state: () => ({ ...st, owned: st.owned.slice(), applied: player?.applied?.id || null, v8: !!player?.v8, parts: player?.applied ? player.applied.anchors.reduce((n, a) => n + a.children.length, 0) : 0 }),
  on(fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); }, __anywhere: false
};
window.__skins = { api, C, taps, stats, log, V8, player: () => player, mannequins, stall: () => stall, render, readRig, applySkin, built, geos, mats, merged };
const attach = () => { const w = window; if (!w.SSX) w.SSX = {}; if (w.SSX.skins !== api) w.SSX.skins = api; hookTick(); hookMenu(); };
attach(); (function boot(n = 0) { attach(); if (n < 150 && !(ticking && menuBtn?.isConnected && window.__app)) setTimeout(() => boot(n + 1), 100); })();
setInterval(attach, 1500);
export default api;
Object.assign(api, { goShop, wardrobeBuy, locked: () => C.locked(st, credits(), nearShop()), prop: () => (syncProp(), { out: PROP.out, meshes: PROP.n, shown: !PROP.out && PROP.n > 0 }) });
