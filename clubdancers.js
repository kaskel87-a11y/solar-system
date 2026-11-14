// v7.5.x Velvet Airlock dancers: realistic skinned women replace the blocky club dancers once their GLBs arrive.
// Lazy: nothing is fetched until the club interior is built; the blocky rig keeps running underneath and stays
// visible if anything fails to load. Each GLB rides inside its dancer's existing group, so the pole routines,
// tips and the private dance are unchanged: every frame the model's limbs are aimed along the blocky rig's limbs,
// with the model's own Idle clip and a little hip sway layered on. Costumes never come off; hands off.
// Two tiers (the game has no graphics-quality setting, so it is picked by device; override with
// localStorage 'ssx.dancerq' = 'high' | 'medium'):
//   medium (phones, default on iPhone): 512 maps, merged meshes, Idle clip, cheap rim light in the shader.
//   high (desktop): 2048 (Danny) / 1024 maps + a skin normal/roughness detail map, MeshPhysicalMaterial skin with
//   sheen and wrap-lit diffuse (a subsurface hack), anisotropic strand sheen on the hair (wet look for Danny),
//   CMU motion-capture dance clip layered under the pole routines, soft contact shadows.
// Phone-friendly: each dancer is ONE skinned mesh with two primitives (opaque body + alpha-tested hair/eyes/lace),
// i.e. 2 draw calls; each dancer gets an index buffer holding only her outfit's garments (the vertex data is shared),
// the private dancer's cardigan is a drawRange toggle; small part textures share one
// 512 atlas (dancer_aux.webp) across all three; phones use 512 maps, the high tier swaps in *_hd.webp. Everything
// is disposed when the player leaves the club and reloaded (from cache) on the next visit. v7.5.17: the GLBs and one
// material per shader program stay cached, so later visits compile and upload nothing.
// v7.5.4 (Danny v2): the dancer shader re-lights the club: the room's pink point light and the Mars sun/hemisphere are
// turned down and desaturated on the dancers (they made the skin pink and flat), a neutral key light (a shader-only
// light, no extra THREE.Light, so no recompiles) and a magenta rim from behind are added. Pole routines aim the arms at
// authored, natural targets (grip hand up on the pole with a bent elbow, free hand on the hip / out low / in the hair)
// instead of the blocky rig's T-pose-ish arms. spawn() places a model with no blocky rig (privateshow.js).
// Assets: models/dancers/*, built from CC0 MakeHuman assets (see models/dancers/LICENSE.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const V = new URL(import.meta.url).searchParams.get('v');
const url = (n) => new URL(`./models/dancers/${n}${V ? `?v=${V}` : ''}`, import.meta.url).href;
const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900); // small touch screens; a 1366×768 laptop stays on the high tier
let forced = null; try { forced = localStorage.getItem('ssx.dancerq'); } catch (e) {}
export const HIGH = forced ? forced === 'high' : !phone;
let loader = null, texLoader = null;
const tex = (n) => (texLoader ??= new THREE.TextureLoader()).loadAsync(url(n)).then(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t; });
// shared part atlas, ref-counted by loaded dancer files
let aux = null, auxRefs = 0;
const auxGet = () => { auxRefs++; return (aux ??= tex('dancer_aux.webp').catch(e => { aux = null; throw e; })); };
const auxPut = () => { if (--auxRefs <= 0 && aux) { aux.then(t => t.dispose(), () => {}); aux = null; auxRefs = 0; } };
// one entry per GLB: { p: Promise<{gltf, aux}>, refs }
const files = new Map();
function load(name) {
  let f = files.get(name);
  if (!f) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    f = { refs: 0 }; files.set(name, f);
    f.p = Promise.all([loader.loadAsync(url(name + '.glb')), auxGet()]).then(async ([gltf, a]) => {
      const meshes = []; gltf.scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
      for (const o of meshes) { // custom glTF attributes arrive as _cell/_gm
        const g = o.geometry; if (g.attributes._cell) { g.setAttribute('aCell', g.attributes._cell); g.deleteAttribute('_cell'); g.setAttribute('aGm', g.attributes._gm); g.deleteAttribute('_gm'); }
      }
      enlargeDancerBust(gltf, name === 'dancer_danny' ? DANNY_BUST_SCALE : BUST_SCALE); // clothed bust, once per cached GLB
      if (HIGH) await Promise.all(meshes.flatMap(o => [ // desktop tier only; the 512 maps stay on failure
        tex(`${name}_${o.material.alphaTest ? 'hair' : 'skin'}_hd.webp`).then(t => { o.material.map?.dispose(); o.material.map = t; }, () => {}),
        o.material.alphaTest ? null : tex(`${name}_nrm_hd.webp`).then(t => { t.colorSpace = THREE.NoColorSpace; o.material.normalMap = t; o.material.normalScale.set(0.7, 0.7); }, () => {})
      ]));
      if (f.dead) { drop(gltf); auxPut(); throw new Error('club closed'); }
      f.gltf = gltf; return { gltf, aux: a };
    });
    f.p.catch(() => { if (files.get(name) === f) files.delete(name); }); // a later visit may retry
  }
  f.refs++; return f;
}
function drop(gltf) {
  gltf.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const k of ['map', 'normalMap']) o.material[k]?.dispose(); o.material.dispose(); } });
}
// v7.5.17: the GLBs (geometry + textures, already on the GPU) stay cached for the session once loaded, so a club visit
// doesn't re-parse, re-upload or recompile anything; ~1.5 MB of models. unload() only drops the ref count.
function unload(name, f) { if (f.refs > 0) f.refs--; }
// v7.5.17 program keepers: three.js frees a shader program when the last material using it is disposed, so the first
// dancer material of each program variant is never disposed; the next visit's materials then reuse the linked program.
const keepers = new Map();
const keepKey = (m) => `${m.customProgramCacheKey?.() || ''}|${m.name}|${m.alphaTest > 0 ? 'a' : ''}|${m.type}`;
function keepOrDispose(m) { const k = keepKey(m); if (!keepers.has(k)) { keepers.set(k, m); return; } if (keepers.get(k) !== m) m.dispose(); }
// is obj (and every parent) visible, i.e. would it draw this frame?
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
// compile a model that was built inside a hidden (prebuilt) club before the player walks in (stormguard prewarm queue)
const prewarm = (o) => { try { window.SSX?.stormGuard?.prewarm?.(o, { draw: true }); } catch (e) { /* no stormguard: compiles on first view */ } };
export const programKeepers = () => [...keepers.keys()];

// outfits: garment ids are baked per vertex (tools/dancers.mjs GID); a dancer's index buffer keeps only her outfit
const GID = { 'SSX bikini top': 1, 'SSX bikini bottom': 2, 'SSX string top': 3, 'SSX string bottom': 4, 'SSX coverup': 5, 'SSX crop top': 6, 'SSX shorts': 7, 'SSX cardigan': 8, ring: 9, 'SSX straps': 10 };
// Danny's base layer is the white string bikini, so it stays on under the crop top and shorts (no skin holes).
// Danny only ever wears the string mini bikini (the smallest garment that still covers). Colour is a tint, not another outfit.
// Crop, shorts, cardigan and the open cover-up are not in her rotation.
const MINI = ['SSX string top', 'SSX string bottom', 'SSX straps'];
const OUTFITS = {
  bikini: ['SSX bikini top', 'SSX bikini bottom'], // Rhea / Kiara
  aqua: MINI, // aqua eyelet string bikini
  white: MINI,
  black: MINI
};
export const DANNY_BIKINIS = ['aqua', 'white', 'black'];
export const BIKINI_TINT = { aqua: 0xffffff, white: 0xf4f4f4, black: 0x141414 };
/** Any leftover crop/cover-up/string request for Danny becomes a mini bikini. */
export function dannyBikini(outfit) {
  return DANNY_BIKINIS.includes(outfit) ? outfit : 'white';
}
/** Danny's display name: the ONE place it is set (nameplate/sign, spots, captions, contacts and toasts all read it). */
export const DANNY_NAME = 'Danny Alvarez';
// saves from v7.5.4/v7.5.5 stored her under an old stage name: move that contact (and her texts) to DANNY_NAME once
const OLD_DANNY_NAMES = ['Danny ' + 'Nova'];
try {
  const c = JSON.parse(localStorage.getItem('ssx.contacts') || 'null');
  if (c && typeof c === 'object') { let ch = false; for (const o of OLD_DANNY_NAMES) if (o in c) { if (!(DANNY_NAME in c)) c[DANNY_NAME] = c[o]; delete c[o]; ch = true; } if (ch) localStorage.setItem('ssx.contacts', JSON.stringify(c)); }
  const t = JSON.parse(localStorage.getItem('ssx.texts') || 'null');
  if (t && Array.isArray(t.msgs) && t.msgs.some(m => OLD_DANNY_NAMES.includes(m?.from))) { for (const m of t.msgs) if (OLD_DANNY_NAMES.includes(m?.from)) m.from = DANNY_NAME; localStorage.setItem('ssx.texts', JSON.stringify(t)); }
} catch (e) {}
export const DANCERS = {
  danny: { file: 'dancer_danny', name: DANNY_NAME, sheen: 0.55 }, // long straight wet-look black hair
  rhea: { file: 'dancer_rhea', name: 'Rhea', sheen: 0.18 },
  kiara: { file: 'dancer_kiara', name: 'Kiara', sheen: 0.18 }
};
// Clothed bust enlarge. Rhea/Kiara land near 1.5× cup depth. Danny is a step larger than that (still the string bikini, which is inflated with the skin).
export const BUST_SCALE = 1.7;
export const DANNY_BUST_SCALE = 2.45;
const TOP_GIDS = new Set([1, 3, 6, 10]); // SSX bikini/string/crop tops + straps
function smooth01(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
/** Bust mound depth (skin max-z minus sternum) for left/right cups; used by tests. */
export function measureBustDepth(geometry) {
  const pos = geometry.attributes.position, gm = geometry.attributes.aGm || geometry.attributes._gm;
  if (!pos || !gm) return null;
  let y0 = 1e9, y1 = -1e9, hasTop = false;
  for (let i = 0; i < pos.count; i++) {
    if (!TOP_GIDS.has(Math.round(gm.getX(i)))) continue;
    hasTop = true; const y = pos.getY(i); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (!hasTop) return null;
  // Cup band (skip underbust straps / upper collarbone) so sternum baseline stays stable.
  const yCup0 = y0 + (y1 - y0) * 0.12, yCup1 = y0 + (y1 - y0) * 0.78;
  let sternum = -1e9, L = -1e9, R = -1e9, topL = -1e9, topR = -1e9, topN = 0;
  for (let i = 0; i < pos.count; i++) {
    const id = Math.round(gm.getX(i)), x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < yCup0 || y > yCup1) continue;
    if (id === 0) {
      if (Math.abs(x) < 0.03) sternum = Math.max(sternum, z);
      if (x < -0.05 && x > -0.2) L = Math.max(L, z);
      if (x > 0.05 && x < 0.2) R = Math.max(R, z);
    } else if (TOP_GIDS.has(id)) {
      topN++;
      if (x < -0.05 && x > -0.2) topL = Math.max(topL, z);
      if (x > 0.05 && x < 0.2) topR = Math.max(topR, z);
    }
  }
  if (sternum < -1e8) return null;
  return { depthL: L - sternum, depthR: R - sternum, depth: ((L + R) * 0.5 - sternum), sternumZ: sternum, y0, y1, topN, topL, topR, topCovers: topL >= L - 1e-4 && topR >= R - 1e-4 };
}
function findBreastCenters(pos, gm) {
  let y0 = 1e9, y1 = -1e9, hasTop = false;
  for (let i = 0; i < pos.count; i++) {
    if (!TOP_GIDS.has(Math.round(gm.getX(i)))) continue;
    hasTop = true; const y = pos.getY(i); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (!hasTop) return null;
  const yCup0 = y0 + (y1 - y0) * 0.12, yCup1 = y0 + (y1 - y0) * 0.78;
  let sternum = -1e9;
  const apex = { '-1': null, '1': null };
  for (let i = 0; i < pos.count; i++) {
    const id = Math.round(gm.getX(i)); if (id !== 0 && !TOP_GIDS.has(id)) continue;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < yCup0 || y > yCup1) continue;
    if (Math.abs(x) < 0.03) sternum = Math.max(sternum, z);
    for (const side of [-1, 1]) {
      if (x * side < 0.05 || x * side > 0.2) continue;
      // prefer skin apexes; tops fill in when a prim has no skin (Danny's string-top layer)
      const cur = apex[side];
      const skin = id === 0;
      if (!cur || (skin && !cur.skin) || (skin === cur.skin && z > cur.z)) apex[side] = { x, y, z, skin };
    }
  }
  if (sternum < -1e8 || !apex['-1'] || !apex['1']) return null;
  // Cup anchors on the chest wall under each breast; midline (|x| small) is left alone.
  return {
    y0, y1, sternum,
    C: [
      { x: apex['-1'].x * 0.78, y: apex['-1'].y, z: sternum },
      { x: apex['1'].x * 0.78, y: apex['1'].y, z: sternum }
    ]
  };
}
/** Scale skin + top-garment cup depth/width ~scale. Idempotent via geometry.userData.ssxBustScale. */
export function inflateBustGeometry(geometry, scale = BUST_SCALE, shared = null) {
  if (geometry.userData.ssxBustScale) return geometry.userData.ssxBustScale;
  const pos = geometry.attributes.position, gm = geometry.attributes.aGm || geometry.attributes._gm;
  if (!pos || !gm) return null;
  const info = shared || findBreastCenters(pos, gm);
  if (!info) return null;
  const { C, y0, y1, sternum } = info;
  const R = 0.15, R0 = 0.03;
  for (let i = 0; i < pos.count; i++) {
    const id = Math.round(gm.getX(i));
    if (id !== 0 && !TOP_GIDS.has(id)) continue;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < y0 - 0.05 || y > y1 + 0.08) continue;
    if (id === 1 || id === 3) { pos.setXYZ(i, x, y, Math.min(z, sternum - 0.012)); continue; } // flat cards, not the visible top
    if (Math.abs(x) < 0.035) continue; // keep cleavage / sternum fixed
    let best = null, bestD = R;
    for (const c of C) {
      if ((c.x < 0) !== (x < 0)) continue;
      const d = Math.hypot(x - c.x, y - c.y, z - c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best) continue;
    let w = 1 - smooth01(R0, R, bestD);
    if (z < sternum - 0.005) w *= 0.15; // don't inflate the back of the ribcage
    if (w <= 1e-4) continue;
    // Depth grows off the sternum plane; width grows off the cup anchor — both ~scale at the apex.
    const k = 1 + (scale - 1) * w;
    const nx = best.x + (x - best.x) * k;
    const ny = best.y + (y - best.y) * (1 + (scale - 1) * w * 0.35);
    const nz = z <= sternum ? z : sternum + (z - sternum) * k;
    pos.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  if (geometry.index || geometry.attributes.position.count % 3 === 0) geometry.computeVertexNormals?.();
  geometry.boundingSphere = null; geometry.computeBoundingSphere?.();
  const measured = measureBustDepth(geometry);
  if (measured && measured.depth > 0.02) {
    const depth = measured.depth, radius = Math.max(0.086, depth * 1.15);
    geometry.userData.ssxCups = {
      radius,
      centers: C.map(c => ({ x: c.x, y: c.y, z: sternum + depth * 0.42 }))
    };
  }
  geometry.userData.ssxBustScale = scale;
  return scale;
}
const CUP_GEO = new THREE.SphereGeometry(1, 32, 24);
CUP_GEO.scale(1.08, 0.9, 0.78); // full ball, flattened toward the chest so there is no cut rim
const STRAP_GEO = new THREE.CylinderGeometry(0.006, 0.007, 1, 6);
function fabricMap(hex) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  const css = '#' + (hex >>> 0).toString(16).padStart(6, '0');
  g.fillStyle = css; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1;
  for (let i = 0; i < 64; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  const rad = g.createRadialGradient(32, 20, 2, 32, 34, 34);
  rad.addColorStop(0, 'rgba(255,255,255,0.42)'); rad.addColorStop(0.5, 'rgba(255,255,255,0.05)'); rad.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = rad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function fabricMat(hex) {
  const tint = hex >>> 0;
  const map = fabricMap(tint === 0xffffff ? 0xf3f1ee : tint);
  const m = new THREE.MeshBasicMaterial({ map, color: 0xffffff });
  m.userData.ssxFabric = true;
  return m;
}
/** Smooth mini-bikini cups on the chest bone, so the top moves with the dance and is not a flat card. */
function attachCups(root, tint) {
  let mesh = null;
  root.traverse(o => { if (!mesh && o.isSkinnedMesh && o.geometry?.userData?.ssxCups) mesh = o; });
  const bone = []; root.traverse(o => { if (o.isBone && o.name === 'Spine1') bone.push(o); });
  const spine = bone[0]; if (!mesh || !spine) return null;
  const info = mesh.geometry.userData.ssxCups;
  root.updateMatrixWorld(true);
  const grp = new THREE.Group(); grp.name = 'ssx-cups';
  const mat = fabricMat(tint);
  const r = info.radius;
  const toBone = v => spine.worldToLocal(mesh.localToWorld(v));
  const origin = toBone(new THREE.Vector3());
  const ahead = toBone(new THREE.Vector3(0, 0, 1));
  const fwd = ahead.sub(origin).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
  for (const c of info.centers) {
    const cup = new THREE.Mesh(CUP_GEO, mat);
    cup.scale.setScalar(r);
    cup.position.copy(toBone(new THREE.Vector3(c.x * 0.72, c.y - r * 0.08, c.z)));
    cup.quaternion.copy(q);
    cup.name = 'ssx-cup';
    grp.add(cup);
  }
  if (grp.children.length === 2) {
    const a = grp.children[0].position, b = grp.children[1].position, mid = a.clone().add(b).multiplyScalar(0.5);
    const band = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
    band.scale.set(a.distanceTo(b) * 0.55 + r * 0.35, r * 0.28, r * 0.45);
    band.position.copy(mid);
    band.quaternion.copy(q);
    band.name = 'ssx-band';
    grp.add(band);
    for (const cup of [grp.children[0], grp.children[1]]) {
      const strap = new THREE.Mesh(STRAP_GEO, mat);
      const up = cup.position.clone().add(new THREE.Vector3(Math.sign(cup.position.x - mid.x) * r * 0.15, r * 1.15, -r * 0.15));
      strap.position.copy(cup.position).lerp(up, 0.55);
      strap.scale.set(1, cup.position.distanceTo(up), 1);
      strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up.clone().sub(cup.position).normalize());
      strap.name = 'ssx-strap';
      grp.add(strap);
    }
  }
  spine.add(grp);
  return { group: grp, mat };
}
export function pulseCups(group, t) {
  if (!group) return;
  const s = 1 + Math.sin(t * 5.1) * 0.016;
  group.scale.set(s, 1 + Math.sin(t * 5.1 + 0.7) * 0.012, s);
}
function enlargeDancerBust(gltf, scale = BUST_SCALE) {
  const meshes = []; gltf.scene.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position) meshes.push(o); });
  let shared = null;
  for (const o of meshes) {
    const gm = o.geometry.attributes.aGm || o.geometry.attributes._gm; if (!gm) continue;
    shared = findBreastCenters(o.geometry.attributes.position, gm); if (shared) break;
  }
  if (!shared) return;
  for (const o of meshes) inflateBustGeometry(o.geometry, scale, shared);
}

// per-dancer material: one shader program per tier and primitive kind (custom cache key); per-dancer values are uniforms
const RIM_A = new THREE.Color(0x40e0ff), RIM_B = new THREE.Color(0xff3cc8);
// shader-only lighting per dancer (shared by her two materials): directions are world space, turned into view space per draw
export const LOOK = { key: [0.65, 0.7, 0.85], keyCol: 0xfff5ee, keyInt: 2.3, rim: [-0.2, 0.35, -1.0], rimCol: 0xff3cc8, rimInt: 1.0, fill: 0xd8dce8, fillInt: 0.5, scene: 0.42, neutral: 0.8 };
function lightUniforms(look = LOOK) {
  const L = { ...LOOK, ...look };
  return { look: L, keyW: new THREE.Vector3(...L.key).normalize(), rimW: new THREE.Vector3(...L.rim).normalize(),
    u: { uKeyV: { value: new THREE.Vector3(0, 1, 0) }, uKeyC: { value: new THREE.Color(L.keyCol).multiplyScalar(L.keyInt) }, uRimV: { value: new THREE.Vector3(0, 0, -1) },
      uRimC: { value: new THREE.Color(L.rimCol).multiplyScalar(L.rimInt) }, uFill: { value: new THREE.Color(L.fill).multiplyScalar(L.fillInt) }, uScene: { value: L.scene }, uNeutral: { value: L.neutral } } };
}
function setLook(lu, look) {
  const L = Object.assign(lu.look, look); lu.keyW.set(...L.key).normalize(); lu.rimW.set(...L.rim).normalize();
  lu.u.uKeyC.value.set(L.keyCol).multiplyScalar(L.keyInt); lu.u.uRimC.value.set(L.rimCol).multiplyScalar(L.rimInt); lu.u.uFill.value.set(L.fill).multiplyScalar(L.fillInt);
  lu.u.uScene.value = L.scene; lu.u.uNeutral.value = L.neutral;
}
function dancerMaterial(src, auxTex, { alt = null, sheen = 0.18, lu, crown = { value: new THREE.Vector3() }, tint = 0xffffff } = {}) {
  const phys = HIGH && !src.alphaTest; let m;
  if (phys) { // skin: sheen + wrap-lit diffuse; garments in this primitive get the (mild) sheen too
    m = new THREE.MeshPhysicalMaterial(); THREE.MeshStandardMaterial.prototype.copy.call(m, src); m.defines = { STANDARD: '', PHYSICAL: '' };
    m.sheen = 0.3; m.sheenRoughness = 0.6; m.sheenColor.set(0xffd2c0);
  } else m = src.clone();
  if (HIGH) m.defines = { ...(m.defines || {}), SSX_HIGH: '' };
  if (HIGH && src.alphaTest) m.alphaToCoverage = true; // desktop (MSAA): soft strand / lash / brow edges instead of hard alpha-test stairs
  const u = { uAux: { value: auxTex }, uAlt: { value: new THREE.Vector4(...(alt || [0, 0, -1, 0])) }, uFit: { value: new THREE.Color(tint) }, uRimA: { value: RIM_A }, uRimB: { value: RIM_B },
    uRim: { value: HIGH ? 0.35 : 0.25 }, uHairSheen: { value: sheen }, uPoreH: { value: 0.00005 }, uCrownV: crown, ...lu.u };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aCell; attribute vec4 aGm; varying vec4 vCell; varying vec4 vGm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCell = aCell; vGm = aGm;\n' +
        // cloth (bikini / crop / shorts / straps): a per-vertex polygon offset, pulled 4 mm toward the camera along the view ray
        // (same pixel, nearer depth) so skin never pokes through the garment edges at any distance; brows get 3 mm (they sit in the skin)
        'float ssxV = floor(aGm.x + 0.5); if ((ssxV > 0.5 && ssxV < 7.5) || ssxV == 10.0 || ssxV == 14.0) { vec4 ssxMv = mvPosition; ssxMv.xyz -= normalize(ssxMv.xyz) * (ssxV == 14.0 ? 0.003 : 0.004); gl_Position = projectionMatrix * ssxMv; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uAux; uniform vec4 uAlt; uniform vec3 uRimA; uniform vec3 uRimB; uniform float uRim; uniform float uHairSheen; uniform float uPoreH; uniform vec3 uCrownV;
uniform vec3 uKeyV; uniform vec3 uKeyC; uniform vec3 uRimV; uniform vec3 uRimC; uniform vec3 uFill; uniform float uScene; uniform float uNeutral; uniform vec3 uFit;
vec3 ssxNeutral(vec3 lit, vec3 alb) { // the light that reached the surface, desaturated, back on the albedo
  vec3 irr = lit / max(alb, vec3(0.03)); return mix(irr, vec3(dot(irr, vec3(0.2126, 0.7152, 0.0722))), uNeutral) * alb; }
varying vec4 vCell; varying vec4 vGm; float ssxA = 0.0;
bool ssxSkin() { return vGm.x < 0.5 && vCell.z < 0.0; }
float ssxG() { return floor(vGm.x + 0.5); }
float ssxH(float n) { return fract(sin(n * 127.1 + 1.7) * 43758.5453); }
float ssxH2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ssxN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ssxH2(i), ssxH2(i + vec2(1.0, 0.0)), f.x), mix(ssxH2(i + vec2(0.0, 1.0)), ssxH2(i + vec2(1.0, 1.0)), f.x), f.y); }
float ssxHv = 0.5, ssxHc = 0.5; // hair: per-strand / per-clump random
float ssxPore = 0.5;`)
      .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        `// skin: per-channel wrap lighting (red light wraps furthest past the terminator): a cheap subsurface look, both tiers
#ifdef SSX_HIGH
  const vec3 ssxW = vec3(0.62, 0.34, 0.24);
#else
  const vec3 ssxW = vec3(0.45, 0.28, 0.2);
#endif
  vec3 ssxIrr = ssxSkin() ? saturate( ( vec3( dot( geometryNormal, directLight.direction ) ) + ssxW ) / ( 1.0 + ssxW ) ) * directLight.color : irradiance;
  reflectedLight.directDiffuse += ssxIrr * BRDF_Lambert( material.diffuseColor );`))
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{ // club light turned down and neutral, then the shader-only key light and a soft fill
  reflectedLight.directDiffuse = ssxNeutral(reflectedLight.directDiffuse, material.diffuseColor) * uScene;
  reflectedLight.indirectDiffuse = ssxNeutral(reflectedLight.indirectDiffuse, material.diffuseColor) * uScene;
  reflectedLight.directSpecular *= uScene * 0.6; reflectedLight.indirectSpecular *= uScene;
  IncidentLight ssxL; ssxL.direction = uKeyV; ssxL.color = uKeyC; ssxL.visible = true; vec3 ssxSp = reflectedLight.directSpecular;
  RE_Direct( ssxL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#ifdef SSX_HIGH
  if (ssxG() == 11.0) reflectedLight.directSpecular = mix(ssxSp * 0.45, reflectedLight.directSpecular, 0.12); // hair: the strand lobes below do the shine
#else
  if (ssxG() == 11.0) reflectedLight.directSpecular = mix(ssxSp, reflectedLight.directSpecular, 0.3);
#endif
  reflectedLight.indirectDiffuse += uFill * (0.75 + 0.25 * dot(geometryNormal, normalize(uKeyV + vec3(0.0, 1.0, 0.0)))) * BRDF_Lambert( material.diffuseColor );
}`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 ssxCell = vCell; float ssxg = ssxG();
  if (uAlt.z > 0.0 && (ssxg == 3.0 || ssxg == 4.0 || ssxg == 10.0)) { ssxCell = uAlt; ssxA = 1.0; } // alternate garment texture (aqua eyelet)
  vec4 sampledDiffuseColor;
  if (ssxCell.z < 0.0) sampledDiffuseColor = texture2D(map, vMapUv);
  else sampledDiffuseColor = textureGrad(uAux, ssxCell.xy + fract(vMapUv) * ssxCell.zw, dFdx(vMapUv) * ssxCell.zw, dFdy(vMapUv) * ssxCell.zw);
  diffuseColor *= sampledDiffuseColor;
  if (ssxg == 3.0 || ssxg == 4.0 || ssxg == 10.0) diffuseColor.rgb *= uFit; // mini-bikini colour (geometry unchanged)
  if (ssxg == 11.0) { // hair cards -> strands: per-strand and per-clump tone, ragged per-strand tips (alpha-tested)
    float hf = saturate(1.5 - fwidth(vMapUv.x) * 900.0); // strand detail fades out where a strand gets thinner than ~1 px
    ssxHv = mix(0.5, ssxH(floor(vMapUv.x * 900.0)), hf); ssxHc = mix(0.5, ssxH(floor(vMapUv.x * 140.0 + ssxH(floor(vMapUv.y * 9.0)) * 0.6) + 31.0), saturate(hf + 0.4));
    diffuseColor.rgb *= (0.7 + 0.42 * ssxHv) * (0.82 + 0.3 * ssxHc) * (1.0 - 0.35 * saturate(uHairSheen - 0.25)); // wet hair reads darker
    diffuseColor.a *= 0.8 + 0.4 * ssxHv;
  } else if (ssxg > 12.5) { // lashes / brows: the 120 px atlas cells blur the thin strokes, so re-sharpen the alpha before the alpha test
    diffuseColor.a = ssxg == 13.0 ? smoothstep(0.12, 0.5, diffuseColor.a) : smoothstep(0.05, 0.4, diffuseColor.a); diffuseColor.rgb = ssxg == 13.0 ? diffuseColor.rgb * 0.4 : max(diffuseColor.rgb, vec3(0.05, 0.035, 0.03)) * 1.2;
  }
#endif`)
      .replace('#include <color_fragment>', `#if defined( USE_COLOR )
  if (ssxA < 0.5) diffuseColor.rgb *= vColor;
#endif`)
      .replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP
if (ssxSkin()) {
${THREE.ShaderChunk.normal_fragment_maps}
#if defined( SSX_HIGH ) && defined( USE_MAP )
  { // micro detail (desktop high tier): procedural pores + fine creases as a derivative bump, faded out before it can alias
    vec2 pu = vMapUv * 950.0; float fw = length(fwidth(pu));
    ssxPore = ssxN(pu) * 0.7 + ssxN(pu * 2.7 + 7.3) * 0.3;
    float k = (1.0 - smoothstep(0.35, 1.1, fw)) * uPoreH; // height in metres
    if (k > 0.0) {
      float hp = -smoothstep(0.62, 0.95, ssxN(pu * 1.3 + 3.1)) - 0.25 * ssxN(pu * 3.1 + 7.3);
      vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition), r1 = cross(dpy, normal), r2 = cross(normal, dpx);
      float det = dot(dpx, r1); vec3 gr = sign(det) * (dFdx(hp) * r1 + dFdy(hp) * r2);
      normal = normalize(abs(det) * normal - gr * k);
    }
  }
#endif
}
#endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = vGm.w;
#ifdef USE_NORMALMAP
  if (ssxSkin()) roughnessFactor = clamp(roughnessFactor * texture2D(normalMap, vNormalMapUv).a * 2.0 * (0.9 + 0.2 * ssxPore), 0.3, 1.0);
#endif
if (ssxG() == 12.0) roughnessFactor = 0.08; // wet eyes`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vGm.y;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (ssxA < 0.5) totalEmissiveRadiance += vColor.rgb * vGm.z;
{ // rim light from behind (magenta), mostly on the side facing it; a faint cyan kicker on the other side
  float fr = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6), side = saturate(dot(normal, uRimV) * 0.8 + 0.35);
  totalEmissiveRadiance += (uRimC * side + uRimA * (1.0 - side) * 0.25) * fr * uRim * (ssxG() == 11.0 ? 0.4 : ssxG() > 12.5 ? 0.0 : ssxG() == 12.0 ? 0.3 : 1.0) * mix(vec3(1.0), diffuseColor.rgb * 2.5, 0.35) * diffuseColor.a;
}`)
      .replace('#include <opaque_fragment>', `if (ssxG() == 11.0) { // hair: Kajiya-Kay strand highlight
  // strand direction: away from the crown of her head (radial on the top cap, falling down the lengths), in view space
  vec3 T = normalize(-vViewPosition - uCrownV + vec3(1e-4)), Vv = normalize(vViewPosition), L = uKeyV, H = normalize(L + Vv);
#if defined( SSX_HIGH ) && defined( USE_MAP )
  T = normalize(T - normal * dot(T, normal) + 1e-4);
  float wet = saturate((uHairSheen - 0.2) / 0.35), sh = (ssxHv - 0.5) * 0.22;
  vec3 T1 = normalize(T + normal * (sh - 0.06)), T2 = normalize(T + normal * (sh + 0.12));
  float t1 = dot(T1, H), t2 = dot(T2, H);
  float s1 = pow(sqrt(max(0.0, 1.0 - t1 * t1)), mix(90.0, 320.0, wet)) * mix(0.8, 1.7, wet);
  float s2 = pow(sqrt(max(0.0, 1.0 - t2 * t2)), 34.0) * 0.16;
  float clump = 0.6 + 0.8 * ssxHc * ssxHc;
  vec3 kc = normalize(uKeyC + 1e-4);
  outgoingLight += (kc * s1 + kc * diffuseColor.rgb * 6.0 * s2) * clump * 0.75 * uHairSheen * saturate(dot(normal, L) + 0.3);
  float tr = dot(T1, normalize(uRimV + Vv)); // a thin magenta strand glint from the club rim light
  outgoingLight += uRimC * pow(sqrt(max(0.0, 1.0 - tr * tr)), 160.0) * 0.12 * clump * uHairSheen;
#else
  T = normalize(T + normal * (ssxHv - 0.5) * 0.18); T = normalize(T - normal * dot(T, normal) + 1e-4); // phones: one lobe
  float th = dot(T, H), sp = pow(sqrt(max(0.0, 1.0 - th * th)), 90.0) * 0.8 + pow(sqrt(max(0.0, 1.0 - th * th)), 14.0) * 0.08;
  outgoingLight += normalize(uKeyC + 1e-4) * 0.75 * sp * uHairSheen * (0.6 + 0.8 * ssxHc) * saturate(dot(normal, L) + 0.3);
#endif
} else if (ssxG() == 12.0) { // eyes: a sharp catchlight from the key light (+ a softer one from above) on both tiers
  vec3 R = reflect(-normalize(vViewPosition), normal);
  outgoingLight = outgoingLight * 1.6 + 0.03 * diffuseColor.rgb;
  outgoingLight += vec3(1.0, 0.96, 0.92) * (pow(saturate(dot(R, normalize(vec3(-0.35, 0.45, 1.0)))), 700.0) * 1.6 + pow(saturate(dot(R, uKeyV)), 500.0) * 1.2)
    + uRimC * pow(saturate(dot(R, uRimV)), 300.0) * 0.6;
}
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `ssx-dancer-4${HIGH ? 'h' : 'm'}${phys ? 'p' : ''}`;
  return m;
}
// soft contact shadow (high tier): one shared radial-gradient texture
let blobTex = null, blobGM = null;
function blob() {
  if (!blobTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); blobTex = new THREE.CanvasTexture(c); }
  blobGM ??= [new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })]; // shared, never disposed (v7.5.17)
  const mesh = new THREE.Mesh(blobGM[0], blobGM[1].clone()); // own opacity; the shared original keeps the program
  mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 1; mesh.userData.ssxDancer = true; return mesh;
}
// v7.5.17: leaving the club no longer releases the dancers (rebuilding them on entry uploaded ~40 buffers and bone
// textures in the reveal frame, 117 ms on a phone). They stay built in the hidden room; only a stage dancer whose look
// changes for the next visit (Danny's alternate every third visit) is rebuilt, in idle time while you're outside.
const live = new Set(); let hooked = false, stageVisits = 0;
const stageLook = () => DANNY_BIKINIS[stageVisits % DANNY_BIKINIS.length];
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 300));
function hook() {
  if (hooked || !window.SSX?.on) return; hooked = true;
  window.SSX.on('game:indoor', e => { if (e?.on) return; stageVisits++; resetTouchStrikes();
    for (const st of [...live]) if (st.stage && st.look !== stageLook()) { st.release(); idle(() => { if (st.released && !st.disposed && !window.__app?.surface?.info?.inside) st.start(); }); } });
}

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0), V1 = new THREE.Vector3();
// turn `bone` (world space) so the direction bone->child points along `dir`
function aim(bone, child, dir, w = 1) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _v.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_v, dir); if (w < 1) _q.slerp(_q2.identity(), 1 - w);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q);
  bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q2));
  bone.updateMatrixWorld(true);
}
const limbDir = (grp, out) => out.copy(DOWN).applyQuaternion(grp.getWorldQuaternion(_q2)).normalize();

// natural pole-routine arms (v2): authored directions in the dancer group's frame (+x = her right, the grip side; -z =
// forward; +y up) per phase of interiors.js poleDance(), blended over half a beat. [upperArm, foreArm] per arm.
const N3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const POLE = [ // R = grip hand on the pole, L = free hand
  { R: [N3(0.42, 0.88, -0.12), N3(0.12, 1, 0.05)], L: [N3(-0.5, -0.8, 0.28), N3(0.62, -0.42, -0.25)] }, // hand on hip
  { R: [N3(0.55, 0.8, -0.05), N3(0.3, 0.95, 0)], L: [N3(-0.62, -0.55, -0.35), N3(-0.7, -0.45, -0.45)] }, // lean back, free arm out low
  { R: [N3(0.3, 0.95, -0.05), N3(0.1, 1, 0)], L: [N3(-0.6, 0.45, -0.3), N3(-0.55, 0.78, -0.15)] }, // climb-and-spin, free arm up and out
  { R: [N3(0.72, 0.6, -0.1), N3(0.45, 0.88, 0)], L: [N3(-0.4, 0.55, -0.6), N3(0.45, 0.75, 0.35)] } // slide down, hand in the hair
];
const IDLE_ARMS = { R: [N3(0.18, -0.97, 0.05), N3(0.05, -0.9, -0.42)], L: [N3(-0.5, -0.8, 0.28), N3(0.62, -0.42, -0.25)] }; // one hand on the hip
const _d = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], _gq = new THREE.Quaternion();
function armTargets(t, k) {
  const beat = t * 118 / 60 + k * 5, ph = Math.floor(beat / 8) % 4, f = (beat % 8) / 8, nx = POLE[(ph + 1) % 4], cur = POLE[ph];
  const w = THREE.MathUtils.smoothstep(f, 0.94, 1.0), sw = Math.sin(beat * Math.PI) * 0.12;
  for (let i = 0; i < 4; i++) { const a = i < 2 ? cur.R[i] : cur.L[i - 2], b = i < 2 ? nx.R[i] : nx.L[i - 2]; _d[i].copy(a).lerp(b, w); }
  _d[2].x -= sw * 0.5; _d[3].y += sw; _d[1].z += sw * 0.3; // a little life in the free arm
  return _d;
}
function aimArm(B, side, up, fore, w = 1) {
  const S = side < 0 ? 'Left' : 'Right';
  aim(B[S + 'Arm'], B[S + 'ForeArm'], up, w); aim(B[S + 'ForeArm'], B[S + 'Hand'], fore, w);
}
// build one model from the cached GLB (outfit index buffer, dancer materials, mixer)
function buildModel(gltf, auxTex, D, look, lu) {
  if (D.file === 'dancer_danny') look = dannyBikini(look);
  const show = new Set([0, ...(OUTFITS[look] || OUTFITS.bikini).map(n => GID[n])]);
  const tint = D.file === 'dancer_danny' ? (BIKINI_TINT[look] ?? 0xffffff) : 0xffffff;
  const m = cloneSkinned(gltf.scene); const B = {}, mats = []; m.traverse(o => { if (o.isBone) B[o.name] = o; });
  const need = ['Hips', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
  if (need.some(n => !B[n])) return null;
  let skel = null, card = null, noCard = 0; const geos = [], crown = { value: new THREE.Vector3() };
  const onBR = (r, sc, cam) => { // world -> view for the shader-only lights (dirs are room-frame; rooms are never rotated)
    lu.u.uKeyV.value.copy(lu.keyW).transformDirection(cam.matrixWorldInverse); lu.u.uRimV.value.copy(lu.rimW).transformDirection(cam.matrixWorldInverse);
    B.Head.getWorldPosition(crown.value); crown.value.y += 0.17; crown.value.applyMatrix4(cam.matrixWorldInverse); }; // hair strand origin
  m.traverse(o => {
    if (!o.isMesh) return; o.userData.ssxDancer = true; o.frustumCulled = !HIGH; if (!HIGH) o.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.7); // v7.5.12 phones: skip a dancer that's off screen (generous sphere: limbs, lifts) o.castShadow = false; o.onBeforeRender = onBR;
    o.material = dancerMaterial(o.material, auxTex, { alt: look === 'aqua' ? gltf.scene.userData.ssx?.eyelet : null, tint, sheen: D.sheen, lu, crown }); mats.push(o.material); if (o.isSkinnedMesh) skel = o.skeleton;
    // own index buffer with just this outfit's triangles; vertex attributes stay shared with the cached GLB
    const g0 = o.geometry, gm = g0.attributes.aGm, src = g0.index.array, keep = [], cd = [];
    for (let i = 0; i < src.length; i += 3) { const id = Math.round(gm.getX(src[i])); if (id >= 11 || show.has(id)) (id === GID['SSX cardigan'] ? cd : keep).push(src[i], src[i + 1], src[i + 2]); }
    const g = new THREE.BufferGeometry(); for (const n in g0.attributes) g.setAttribute(n, g0.attributes[n]);
    const all = keep.concat(cd); g.setIndex(new THREE.BufferAttribute(gm.count > 65535 ? new Uint32Array(all) : new Uint16Array(all), 1));
    g.boundingSphere = g0.boundingSphere; if (g0.userData.ssxBustScale) g.userData.ssxBustScale = g0.userData.ssxBustScale; if (g0.userData.ssxCups) g.userData.ssxCups = g0.userData.ssxCups; o.geometry = g; geos.push(g); if (cd.length) { card = g; noCard = keep.length; }
  });
  m.rotation.y = Math.PI; m.scale.setScalar(1.04); // the model faces +Z; rigs and seats face -Z
  const cups = attachCups(m, tint);
  const mixer = new THREE.AnimationMixer(m), acts = {};
  for (const a of gltf.animations) acts[a.name] = mixer.clipAction(a);
  const clip = re => { const a = gltf.animations.find(c => re.test(c.name)); return a ? acts[a.name] : null; };
  const rest = need.map(n => [B[n], B[n].quaternion.clone()]);
  const dispose = () => { mixer.stopAllAction(); mixer.uncacheRoot(m); mats.forEach(keepOrDispose); geos.forEach(x => x.dispose()); skel?.dispose(); if (cups) { cups.group.removeFromParent(); cups.mat.map?.dispose(); cups.mat.dispose(); } };
  return { m, B, mats, skel, geos, mixer, acts, clip, rest, card, noCard, cups: cups?.group || null, dispose };
}

// Swap one blocky dancer for a model. opts: { dancer: 'danny', outfit: 'bikini'|'aqua'|'string'|'crop'|'stage', k, cardigan: () => bool }
export function dress(api, p, { dancer = 'danny', outfit = 'bikini', k = 0, cardigan = null, look: lk = null } = {}) {
  const D = DANCERS[dancer]; const st = { ready: false, p, D, released: true, lu: lightUniforms(lk || undefined) };
  const blocky = (on) => p.group.traverse(o => { if (o.isMesh && !o.userData.ssxDancer) o.visible = on; });
  let look = outfit;
  st.start = () => {
    // Danny's stage outfit: aqua, white, or black string mini bikini (never the pink crop or a cover-up)
    if (outfit === 'stage') look = stageLook(); st.stage = outfit === 'stage';
    st.look = look; st.released = false; hook(); const f = st.file = load(D.file);
    f.p.then(({ gltf, aux: auxTex }) => {
      if (st.released || st.file !== f) return;
      const md = buildModel(gltf, auxTex, D, look, st.lu); if (!md) return;
      const idle = md.clip(/idle/i), dance = HIGH ? md.clip(/modern/i) : null;
      if (idle) { idle.time = (k * 1.7) % idle.getClip().duration; idle.play(); }
      if (dance) { dance.time = (k * 2.3) % dance.getClip().duration; dance.play(); } // CMU mocap under the routine's limb aims
      let shadow = null; if (HIGH && p.group.parent) { shadow = blob(); p.group.parent.add(shadow); st.y0 = p.group.position.y; }
      blocky(false); // hide the blocky meshes, keep their groups (they still drive position and pose)
      p.group.add(md.m); Object.assign(st, md, { aIdle: idle, aDance: dance, shadow, ready: true }); live.add(st);
      if (!shown(p.group)) prewarm(md.m); // built in the hidden club (prewarmed on approach): compile now, not on entry
    }).catch(e => { if (!st.released) console.warn('club dancer model unavailable, keeping the classic look', e?.message || e); });
  };
  st.release = () => {
    if (st.released) return; st.released = true; live.delete(st);
    if (st.ready) { st.p.group.remove(st.m); st.dispose(); blocky(true);
      if (st.shadow) { st.shadow.removeFromParent(); st.shadow.material.dispose(); } }
    Object.assign(st, { m: null, B: null, mixer: null, mats: null, geos: null, skel: null, card: null, shadow: null, aIdle: null, aDance: null, ready: false });
    if (st.file) { unload(D.file, st.file); st.file = null; }
  };
  st.setLook = (l) => setLook(st.lu, l);
  api.disposables.push({ dispose: () => { st.disposed = true; st.release(); } });
  st.start();
  // runs after the dancer's own anim tick (ticks run in order)
  api.ticks.push((t, dt = 0.016) => {
    if (st.released) { st.start(); return; } // back in the club after a release
    if (!st.ready) return;
    if (!HIGH) { // v7.5.12 phone LOD: pose at 30 Hz, freeze when the camera is 16 m+ away or she's off screen (the blocky rig keeps moving the group)
      st.acc = (st.acc || 0) + dt; st.skip = !st.skip; if (st.skip) return;
      if (!lodVisible(p.group)) { st.acc = 0; return; }
      dt = Math.min(st.acc, 0.1); st.acc = 0;
    }
    const { B, mixer } = st, between = !!(cardigan && cardigan());
    for (const [b, q] of st.rest) b.quaternion.copy(q); // bones without clip tracks start from rest each frame
    if (st.aDance) { const w = between ? 0 : 1; st.aDance.weight += (w - st.aDance.weight) * Math.min(1, dt * 3); if (st.aIdle) st.aIdle.weight = 1 - st.aDance.weight; } // private dancer idles between songs
    mixer.update(Math.min(dt, 0.1));
    pulseCups(st.cups, t);
    if (cardigan && st.card) st.card.setDrawRange(0, between ? Infinity : st.noCard);
    if (st.shadow) { const g = p.group.position; st.y0 = Math.min(st.y0, g.y); st.shadow.position.set(g.x, st.y0 + 0.015, g.z); const h = g.y - st.y0; st.shadow.material.opacity = Math.max(0.15, 1 - h * 1.5); st.shadow.scale.setScalar(1 + h * 0.6); }
    p.group.updateMatrixWorld(true);
    // hip sway on the beat (the rig's own crouch is left to the routine's lift/orbit)
    const beat = t * 118 / 60 * Math.PI + k;
    B.Hips.rotateZ(Math.sin(beat) * 0.08); B.Hips.rotateY(Math.sin(beat * 0.5) * 0.1); B.Hips.updateMatrixWorld(true);
    // torso lean and head turn
    aim(B.Spine1, B.Neck, V1.copy(UP).applyQuaternion(p.torso.getWorldQuaternion(_q2)).normalize(), 0.8);
    B.Head.rotateY(p.head.rotation.y); B.Head.rotateX(-p.head.rotation.x); B.Head.updateMatrixWorld(true);
    // arms: authored natural targets (group frame -> world); legs follow the blocky rig
    p.group.getWorldQuaternion(_gq);
    const A = between ? IDLE_ARMS : null, d = A ? [A.R[0], A.R[1], A.L[0], A.L[1]] : armTargets(t, k);
    aimArm(B, 1, V1.copy(d[0]).applyQuaternion(_gq), _b2.copy(d[1]).applyQuaternion(_gq));
    aimArm(B, -1, V1.copy(d[2]).applyQuaternion(_gq), _b2.copy(d[3]).applyQuaternion(_gq));
    aim(B.LeftUpLeg, B.LeftLeg, limbDir(p.legs[0], V1));
    aim(B.RightUpLeg, B.RightLeg, limbDir(p.legs[1], V1));
  });
  return st;
}
const _b2 = new THREE.Vector3();
// v7.5.12 phone LOD helper: near (< 14 m) and inside the camera frustum (padded)
const _lodP = new THREE.Vector3(), _lodC = new THREE.Vector3(), _lodF = new THREE.Frustum(), _lodM = new THREE.Matrix4(), _lodS = new THREE.Sphere(); let _lodT = -1, _lodCam = null;
export const LOD_FAR = 16;
function lodVisible(g) {
  const cam = window.__app?.surface?.camera; if (!cam) return true;
  const now = performance.now(); if (now - _lodT > 30 || _lodCam !== cam) { _lodT = now; _lodCam = cam; cam.getWorldPosition(_lodC); _lodM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _lodF.setFromProjectionMatrix(_lodM); }
  g.getWorldPosition(_lodP); if (_lodP.distanceTo(_lodC) > LOD_FAR) return false;
  _lodS.center.copy(_lodP); _lodS.center.y += 0.9; _lodS.radius = 2; return _lodF.intersectsSphere(_lodS);
}

const sstep = x => x * x * (3 - 2 * x);
const CORE = ['Hips', 'Spine1', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'];
// pose distance between clip `a` at its current time and clip `b` sampled at ~32 phases -> the best start time for b
function bestPhase(md, a, b) {
  const ca = a.getClip(), cb = b.getClip(), qa = {}, tr = c => { const o = {}; for (const t of c.tracks) { const m = /^(.+)\.quaternion$/.exec(t.name); if (m && CORE.includes(m[1])) o[m[1]] = t.createInterpolant(); } return o; };
  const A = md._tr?.get(ca) || (md._tr = md._tr || new Map()).set(ca, tr(ca)).get(ca), Bt = md._tr.get(cb) || md._tr.set(cb, tr(cb)).get(cb);
  for (const n in A) qa[n] = _q.fromArray(A[n].evaluate(a.time % ca.duration)).clone();
  let best = 0, bd = Infinity; const N = 32;
  for (let i = 0; i < N; i++) { const t = cb.duration * i / N; let d = 0;
    for (const n in qa) if (Bt[n]) { const v = Bt[n].evaluate(t); d += 1 - Math.abs(qa[n].x * v[0] + qa[n].y * v[1] + qa[n].z * v[2] + qa[n].w * v[3]); }
    if (d < bd) { bd = d; best = t; } }
  return best;
}
function probe(h, dt) {
  const B = h.md.B; if (!h.ps) h.ps = CORE.map(n => B[n].quaternion.clone());
  let m = 0; CORE.forEach((n, i) => { const q = B[n].quaternion, p = h.ps[i]; const d = 2 * Math.acos(Math.min(1, Math.abs(q.dot(p)))); if (d > m) m = d; p.copy(q); });
  const v = dt > 1e-4 ? m / dt : 0, k = h.w.size > 1 ? 'popX' : 'popN'; h[k] = Math.max(h[k] || 0, v); // in a crossfade vs. steady clip
}
function worldRot(bone, axis, ang) { _q.setFromAxisAngle(axis, ang); bone.getWorldQuaternion(_q2); _q2.premultiply(_q); bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q2)); bone.updateMatrixWorld(true); }
// a hand goal on her own body (group frame offsets from live bones) or a world point
const _hg = new THREE.Vector3(), _ho = new THREE.Vector3();
function handGoal(B, side, on, gq, out) {
  if (on && on.isVector3) return out.copy(on);
  const S = side < 0 ? 'Left' : 'Right';
  if (on === 'hair') { B.Head.getWorldPosition(out); _ho.set(side * 0.07, 0.11, 0.06); }
  else if (on === 'thigh') { B[S + 'UpLeg'].getWorldPosition(out); B[S + 'Leg'].getWorldPosition(_hg); out.lerp(_hg, 0.55); _ho.set(side * 0.03, 0, -0.08); }
  else if (on === 'chest') { B.Spine1.getWorldPosition(out); _ho.set(side * 0.04, 0.12, -0.13); }
  else { B.Hips.getWorldPosition(out); _ho.set(side * 0.19, 0.02, 0.0); } // 'hip'
  return out.add(_ho.applyQuaternion(gq));
}
// two-bone IK: shoulder->elbow->hand reaches `T` (world), elbow bent out and back
const _ik = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function reach(B, side, T, gq, w = 1) {
  const S = side < 0 ? 'Left' : 'Right', up = B[S + 'Arm'], fo = B[S + 'ForeArm'], ha = B[S + 'Hand'];
  const [s, e, hd, dir, pole] = _ik; up.getWorldPosition(s); fo.getWorldPosition(e); ha.getWorldPosition(hd);
  const a = s.distanceTo(e), b = e.distanceTo(hd); dir.subVectors(T, s); const d = Math.min(Math.max(dir.length(), 0.05), (a + b) * 0.995); dir.normalize();
  const ca = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))), sa = Math.sqrt(1 - ca * ca);
  pole.set(side * 0.8, -0.35, 0.55).applyQuaternion(gq); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  e.copy(s).addScaledVector(dir, a * ca).addScaledVector(pole, a * sa);
  aim(up, fo, _hg.subVectors(e, s).normalize(), w);
  fo.getWorldPosition(e); hd.copy(s).addScaledVector(dir, d); aim(fo, ha, _hg.subVectors(hd, e).normalize(), w);
}
// A free-standing dancer with no blocky rig (privateshow.js). Returns a handle; await h.ready.
//   h.group: add it to a scene/room group; faces -Z like the rigs.  h.play(/salsa/i, fade, speed)  h.update(dt)  h.setLook({...})
//   h.pose({ lean, roll, L, R }): booth layer (lap dance); h.popX / h.popN: peak core-bone angular speed (rad/s) inside crossfades / on a steady clip (no-pop test)
//   h.armsIdle(on): rest arms (hand on hip) on top of the clip.  h.release(): frees everything (the GLB stays cached while others use it)
export function spawn({ dancer = 'danny', outfit = 'aqua', look = null } = {}) {
  const D = DANCERS[dancer], lu = lightUniforms(look || undefined), group = new THREE.Group();
  const h = { group, D, lu, md: null, cur: null, released: false, armsW: 0, armsOn: false, w: new Map(), fade: 0.45, popX: 0, popN: 0, ps: null,
    ik: { L: { w: 0, p: new THREE.Vector3(), on: null }, R: { w: 0, p: new THREE.Vector3(), on: null } }, lean: 0, leanT: 0, roll: 0, rollT: 0, tt: 0 };
  hook(); const f = load(D.file);
  h.ready = f.p.then(({ gltf, aux: auxTex }) => {
    if (h.released) return null;
    const md = buildModel(gltf, auxTex, D, outfit, lu); if (!md) throw new Error('bad rig');
    group.add(md.m); h.md = md; return h;
  });
  h.ready.catch(() => {});
  // v3 blending: our own crossfade (0.3-0.6 s, smoothstep weights normalised to 1, so a switch mid-fade never pops) and
  // phase sync: the incoming clip starts at the frame whose hips/legs/spine pose is closest to the outgoing pose.
  h.play = (re, fade = 0.45, speed = 1) => {
    const md = h.md, a = md?.clip(re); if (!a) return false;
    a.setEffectiveTimeScale(speed);
    if (a === h.cur) return true;
    const instant = !h.cur || fade <= 0; h.fade = instant ? 0 : Math.min(0.6, Math.max(0.3, fade));
    if (!h.w.has(a)) { // not still fading out: start it at the best-matching phase
      a.reset(); if (h.cur && !instant) a.time = bestPhase(md, h.cur, a); a.play(); h.w.set(a, 0);
    }
    if (instant) { for (const x of h.w.keys()) if (x !== a) x.stop(); h.w.clear(); h.w.set(a, 1); }
    h.cur = a; return true;
  };
  h.armsIdle = (on) => { h.armsOn = on; };
  // procedural layer for the booth routines: lean (rad, forward), hip roll amplitude, and per-hand targets on her own
  // body ('hip' | 'thigh' | 'hair' | 'chest') or a world-space point (e.g. a chair armrest); null = the clip's arm.
  h.pose = ({ lean = 0, roll = 0, L = null, R = null } = {}) => { h.leanT = lean; h.rollT = roll; h.ik.L.on = L; h.ik.R.on = R; };
  h.update = (dt) => {
    const md = h.md; if (!md) return; dt = Math.min(dt, 0.1); h.tt += dt;
    for (const [b, q] of md.rest) b.quaternion.copy(q);
    // crossfade weights
    let tot = 0; for (const [a, w] of h.w) { const nw = h.fade > 0 ? Math.min(1, Math.max(0, w + (a === h.cur ? dt : -dt) / h.fade)) : (a === h.cur ? 1 : 0); h.w.set(a, nw); if (nw <= 0 && a !== h.cur) { a.stop(); h.w.delete(a); } else tot += sstep(nw); }
    for (const [a, w] of h.w) a.setEffectiveWeight(tot > 0 ? sstep(w) / tot : 1);
    md.mixer.update(dt);
    pulseCups(md.cups, h.tt);
    probe(h, dt); // pop meter (tests): peak angular speed of the clip-driven core bones
    group.updateMatrixWorld(true); group.getWorldQuaternion(_gq);
    // lean + hip roll
    h.lean += (h.leanT - h.lean) * Math.min(1, dt * 2.5); h.roll += (h.rollT - h.roll) * Math.min(1, dt * 2);
    if (Math.abs(h.roll) > 1e-3) { const r = Math.sin(h.tt * 2.2) * h.roll; worldRot(md.B.Hips, _a.set(0, 0, 1).applyQuaternion(_gq), r); worldRot(md.B.Spine1, _a.set(0, 0, 1).applyQuaternion(_gq), -r * 0.8); }
    if (Math.abs(h.lean) > 1e-3) worldRot(md.B.Spine1, _a.set(1, 0, 0).applyQuaternion(_gq), -h.lean);
    h.armsW += ((h.armsOn ? 1 : 0) - h.armsW) * Math.min(1, dt * 3);
    if (h.armsW > 0.01) { const A = IDLE_ARMS;
      aimArm(md.B, 1, V1.copy(A.R[0]).applyQuaternion(_gq), _b2.copy(A.R[1]).applyQuaternion(_gq), h.armsW);
      aimArm(md.B, -1, V1.copy(A.L[0]).applyQuaternion(_gq), _b2.copy(A.L[1]).applyQuaternion(_gq), h.armsW); }
    for (const side of [-1, 1]) { const k = h.ik[side < 0 ? 'L' : 'R'], want = !!k.on;
      if (want) { handGoal(md.B, side, k.on, _gq, _b); if (k.w < 0.01) k.p.copy(_b); else k.p.lerp(_b, Math.min(1, dt * 5)); }
      k.w += ((want ? 1 : 0) - k.w) * Math.min(1, dt * 3.5);
      if (k.w > 0.01) reach(md.B, side, k.p, _gq, sstep(k.w)); }
  };
  h.setLook = (l) => setLook(lu, l);
  h.stats = () => ({ textures: new Set(h.md ? h.md.mats.flatMap(m => [m.map, m.normalMap, m.userData.u.uAux.value].filter(Boolean)) : []).size, draws: h.md ? h.md.mats.length : 0 });
  const entry = { release: () => h.release() };
  h.release = () => { if (h.released) return; h.released = true; live.delete(entry); if (h.md) { group.remove(h.md.m); h.md.dispose(); h.md = null; } unload(D.file, f); };
  live.add(entry); // leaving the club frees it too
  return h;
}

// Hands on a dancer, per visit (resets when you leave the club). 1 slap, 2 a fine, 3 Tiny and a short door ban.
export const TOUCH_FEE = 100;
export const TOUCH_BAN_MS = 20000;
let touchN = 0, banUntil = 0;
export const touchStrikes = () => touchN;
export const resetTouchStrikes = () => { touchN = 0; };
export const liftBan = () => { banUntil = 0; };
export const touchBanLeft = (now = Date.now()) => Math.max(0, banUntil - now);
export function banMsg(now = Date.now()) {
  const left = touchBanLeft(now);
  return left > 0 ? `Brick: Hands off the girls. Door’s shut for ${Math.ceil(left / 1000)}s.` : '';
}
/** @returns {{ n: 1|2|3, fee: number, kick: boolean }} */
export function clubTouch() {
  touchN += 1;
  if (touchN >= 3) { touchN = 0; banUntil = Date.now() + TOUCH_BAN_MS; return { n: 3, fee: 0, kick: true }; }
  if (touchN === 2) return { n: 2, fee: TOUCH_FEE, kick: false };
  return { n: 1, fee: 0, kick: false };
}
export function touchLine(n = touchN) {
  if (n === 1) return `Slapped · next touch is ${TOUCH_FEE} cr`;
  if (n === 2) return `${TOUCH_FEE} cr paid · one more and Tiny throws you out`;
  return 'Hands off · 3 strikes';
}
// Her hand snaps to the seated player's face, his head jolts, a white flash. Non-contact swing: she doesn't stay there.
export function slapDancer(h, booth) {
  if (!h?.pose) return;
  const p = new THREE.Vector3(0.12, 1.4, 1.22);
  try { booth?.g?.localToWorld(p); } catch (e) { /* booth frame */ }
  h.pose({ R: p, lean: 0.2 });
  h.play?.(/idle/i, 0.05);
  const head = booth?.player?.head;
  if (head) head.rotation.z = -0.7;
  let flash = document.getElementById('touchFlash');
  if (!flash && typeof document !== 'undefined') {
    const css = document.createElement('style'); css.textContent = '#touchFlash{position:fixed;inset:0;z-index:70;pointer-events:none;background:#fff;opacity:0}#touchFlash.on{opacity:.5}';
    document.head.appendChild(css); flash = document.createElement('div'); flash.id = 'touchFlash'; document.body.appendChild(flash);
  }
  if (flash) { flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 180); }
  setTimeout(() => { try { h.pose({}); if (head) head.rotation.z = 0; } catch (e) { /* show already over */ } }, 650);
}
try { queueMicrotask(() => { if (typeof window !== 'undefined' && window.SSX) window.SSX.dancers = { banMsg, touchStrikes, resetTouchStrikes, liftBan, clubTouch, touchLine, TOUCH_FEE, TOUCH_BAN_MS }; }); } catch (e) {}
