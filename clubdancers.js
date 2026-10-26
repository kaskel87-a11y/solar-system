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
// is disposed when the player leaves the club and reloaded (from cache) on the next visit.
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
function unload(name, f) {
  if (--f.refs > 0) return;
  if (files.get(name) === f) files.delete(name);
  if (f.gltf) { drop(f.gltf); f.gltf = null; auxPut(); } else f.dead = true;
}

// outfits: garment ids are baked per vertex (tools/dancers.mjs GID); a dancer's index buffer keeps only her outfit
const GID = { 'SSX bikini top': 1, 'SSX bikini bottom': 2, 'SSX string top': 3, 'SSX string bottom': 4, 'SSX coverup': 5, 'SSX crop top': 6, 'SSX shorts': 7, 'SSX cardigan': 8, ring: 9, 'SSX straps': 10 };
// Danny's base layer is the white string bikini, so it stays on under the crop top and shorts (no skin holes).
const OUTFITS = {
  bikini: ['SSX bikini top', 'SSX bikini bottom'],
  aqua: ['SSX string top', 'SSX string bottom', 'SSX straps'], // Danny's main stage look: aqua crochet/eyelet triangle string bikini, strappy sides (white string geometry, eyelet texture)
  string: ['SSX string top', 'SSX string bottom', 'ring', 'SSX coverup'], // alternate stage look: white string bikini + ring, open crochet cover-up
  crop: ['SSX string top', 'SSX string bottom', 'SSX crop top', 'SSX shorts', 'SSX cardigan'] // private dance: pink ribbed two-piece (+ cardigan)
};
export const DANCERS = {
  danny: { file: 'dancer_danny', name: 'Danny Alvarez', sheen: 0.55 }, // long straight wet-look black hair
  rhea: { file: 'dancer_rhea', name: 'Rhea', sheen: 0.18 },
  kiara: { file: 'dancer_kiara', name: 'Kiara', sheen: 0.18 }
};
// per-dancer material: one shader program per tier and primitive kind (custom cache key); per-dancer values are uniforms
const RIM_A = new THREE.Color(0x40e0ff), RIM_B = new THREE.Color(0xff3cc8);
function dancerMaterial(src, auxTex, { alt = null, sheen = 0.18 } = {}) {
  const phys = HIGH && !src.alphaTest; let m;
  if (phys) { // skin: sheen + wrap-lit diffuse; garments in this primitive get the (mild) sheen too
    m = new THREE.MeshPhysicalMaterial(); THREE.MeshStandardMaterial.prototype.copy.call(m, src); m.defines = { STANDARD: '', PHYSICAL: '' };
    m.sheen = 0.3; m.sheenRoughness = 0.6; m.sheenColor.set(0xffd2c0);
  } else m = src.clone();
  if (HIGH) m.defines = { ...(m.defines || {}), SSX_HIGH: '' };
  const u = { uAux: { value: auxTex }, uAlt: { value: new THREE.Vector4(...(alt || [0, 0, -1, 0])) }, uRimA: { value: RIM_A }, uRimB: { value: RIM_B },
    uRim: { value: HIGH ? 0.35 : 0.25 }, uHairSheen: { value: sheen } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aCell; attribute vec4 aGm; varying vec4 vCell; varying vec4 vGm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCell = aCell; vGm = aGm;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uAux; uniform vec4 uAlt; uniform vec3 uRimA; uniform vec3 uRimB; uniform float uRim; uniform float uHairSheen;
varying vec4 vCell; varying vec4 vGm; float ssxA = 0.0;
bool ssxSkin() { return vGm.x < 0.5 && vCell.z < 0.0; }
float ssxG() { return floor(vGm.x + 0.5); }`)
      .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        `#ifdef SSX_HIGH
  // wrap-lit diffuse on skin with a warm terminator: a cheap subsurface look
  vec3 ssxIrr = ssxSkin() ? saturate( ( dot( geometryNormal, directLight.direction ) + 0.4 ) / 1.4 ) * directLight.color * vec3( 1.0, 0.9, 0.85 ) : irradiance;
  reflectedLight.directDiffuse += ssxIrr * BRDF_Lambert( material.diffuseColor );
#else
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
#endif`))
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 ssxCell = vCell; float ssxg = ssxG();
  if (uAlt.z > 0.0 && (ssxg == 3.0 || ssxg == 4.0 || ssxg == 10.0)) { ssxCell = uAlt; ssxA = 1.0; } // alternate garment texture (aqua eyelet)
  vec4 sampledDiffuseColor;
  if (ssxCell.z < 0.0) sampledDiffuseColor = texture2D(map, vMapUv);
  else sampledDiffuseColor = textureGrad(uAux, ssxCell.xy + fract(vMapUv) * ssxCell.zw, dFdx(vMapUv) * ssxCell.zw, dFdy(vMapUv) * ssxCell.zw);
  diffuseColor *= sampledDiffuseColor;
#endif`)
      .replace('#include <color_fragment>', `#if defined( USE_COLOR )
  if (ssxA < 0.5) diffuseColor.rgb *= vColor;
#endif`)
      .replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP
if (ssxSkin()) {
${THREE.ShaderChunk.normal_fragment_maps}
}
#endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = vGm.w;
#ifdef USE_NORMALMAP
  if (ssxSkin()) roughnessFactor = clamp(roughnessFactor * texture2D(normalMap, vNormalMapUv).a * 2.0, 0.3, 1.0);
#endif`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vGm.y;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (ssxA < 0.5) totalEmissiveRadiance += vColor.rgb * vGm.z;
{ // stage rim light (cyan from one side, magenta from the other), no extra lights
  float fr = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
  totalEmissiveRadiance += mix(uRimB, uRimA, normal.x * 0.5 + 0.5) * fr * uRim * diffuseColor.a;
}`)
      .replace('#include <opaque_fragment>', `if (ssxG() == 11.0) { // hair: Kajiya-Kay style strand highlight along the (mostly vertical) strands
  vec3 T = (viewMatrix * vec4(0.0, -1.0, 0.0, 0.0)).xyz; T = normalize(T - normal * dot(T, normal) + 1e-4);
  vec3 Vv = normalize(vViewPosition), L = normalize((viewMatrix * vec4(0.25, 1.0, 0.45, 0.0)).xyz), H = normalize(L + Vv);
  float th = dot(T, H), sp = pow(sqrt(max(0.0, 1.0 - th * th)), 90.0) * 0.8 + pow(sqrt(max(0.0, 1.0 - th * th)), 14.0) * 0.08;
  outgoingLight += vec3(0.82, 0.88, 1.0) * sp * uHairSheen;
}
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `ssx-dancer-2${HIGH ? 'h' : 'm'}${phys ? 'p' : ''}`;
  return m;
}
// soft contact shadow (high tier): one shared radial-gradient texture
let blobTex = null;
function blob() {
  if (!blobTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); blobTex = new THREE.CanvasTexture(c); }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 1; mesh.userData.ssxDancer = true; return mesh;
}
// leaving the club releases every live dancer (textures, geometry, skeletons); the next visit reloads from cache
const live = new Set(); let hooked = false, stageVisits = 0;
function hook() { if (hooked || !window.SSX?.on) return; hooked = true; window.SSX.on('game:indoor', e => { if (!e?.on) for (const st of [...live]) st.release(); }); }

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

// Swap one blocky dancer for a model. opts: { dancer: 'danny', outfit: 'bikini'|'aqua'|'string'|'crop'|'stage', k, cardigan: () => bool }
export function dress(api, p, { dancer = 'danny', outfit = 'bikini', k = 0, cardigan = null } = {}) {
  const D = DANCERS[dancer]; const st = { ready: false, p, D, released: true };
  const blocky = (on) => p.group.traverse(o => { if (o.isMesh && !o.userData.ssxDancer) o.visible = on; });
  let look = outfit, show;
  st.start = () => {
    // Danny's stage outfit: the aqua eyelet bikini, with the white string bikini + cover-up as the alternate every third visit
    if (outfit === 'stage') look = (stageVisits++ % 3 === 2) ? 'string' : 'aqua';
    show = new Set([0, ...(OUTFITS[look] || OUTFITS.bikini).map(n => GID[n])]);
    st.released = false; hook(); const f = st.file = load(D.file);
    f.p.then(({ gltf, aux: auxTex }) => {
      if (st.released || st.file !== f) return;
      const m = cloneSkinned(gltf.scene); const B = {}, mats = []; m.traverse(o => { if (o.isBone) B[o.name] = o; });
      const need = ['Hips', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
      if (need.some(n => !B[n])) return;
      let skel = null; const geos = [];
      m.traverse(o => {
        if (!o.isMesh) return; o.userData.ssxDancer = true; o.frustumCulled = false; o.castShadow = false;
        o.material = dancerMaterial(o.material, auxTex, { alt: look === 'aqua' ? gltf.scene.userData.ssx?.eyelet : null, sheen: D.sheen }); mats.push(o.material); if (o.isSkinnedMesh) skel = o.skeleton;
        // own index buffer with just this outfit's triangles; vertex attributes stay shared with the cached GLB
        const g0 = o.geometry, gm = g0.attributes.aGm, src = g0.index.array, keep = [], card = [];
        for (let i = 0; i < src.length; i += 3) { const id = Math.round(gm.getX(src[i])); if (id >= 11 || show.has(id)) (id === GID['SSX cardigan'] ? card : keep).push(src[i], src[i + 1], src[i + 2]); }
        const g = new THREE.BufferGeometry(); for (const n in g0.attributes) g.setAttribute(n, g0.attributes[n]);
        const all = keep.concat(card); g.setIndex(new THREE.BufferAttribute(src.length > 0 && gm.count > 65535 ? new Uint32Array(all) : new Uint16Array(all), 1));
        g.boundingSphere = g0.boundingSphere; o.geometry = g; geos.push(g); if (card.length) { st.card = g; st.noCard = keep.length; }
      });
      // the blocky rig is ~1.9 m with feet at 0; the model is ~1.7 m and faces +Z (the rig faces -Z)
      m.rotation.y = Math.PI; m.scale.setScalar(1.04);
      const mixer = new THREE.AnimationMixer(m), idle = gltf.animations.find(a => /idle/i.test(a.name)), dance = HIGH && gltf.animations.find(a => /dance/i.test(a.name));
      let aIdle = null, aDance = null;
      if (idle) { aIdle = mixer.clipAction(idle); aIdle.time = (k * 1.7) % idle.duration; aIdle.play(); }
      if (dance) { aDance = mixer.clipAction(dance); aDance.time = (k * 2.3) % dance.duration; aDance.play(); } // CMU mocap under the routine's limb aims
      let shadow = null; if (HIGH && p.group.parent) { shadow = blob(); p.group.parent.add(shadow); st.y0 = p.group.position.y; }
      blocky(false); // hide the blocky meshes, keep their groups (they still drive position and pose)
      const rest = need.map(n => [B[n], B[n].quaternion.clone()]);
      p.group.add(m); Object.assign(st, { m, B, mixer, rest, mats, skel, geos, aIdle, aDance, shadow, ready: true }); live.add(st);
    }).catch(e => { if (!st.released) console.warn('club dancer model unavailable, keeping the classic look', e?.message || e); });
  };
  st.release = () => {
    if (st.released) return; st.released = true; live.delete(st);
    if (st.ready) { st.p.group.remove(st.m); st.mixer.stopAllAction(); st.mixer.uncacheRoot(st.m); st.mats.forEach(m => m.dispose()); st.geos.forEach(g => g.dispose()); st.skel?.dispose(); blocky(true);
      if (st.shadow) { st.shadow.removeFromParent(); st.shadow.geometry.dispose(); st.shadow.material.dispose(); } }
    Object.assign(st, { m: null, B: null, mixer: null, mats: null, geos: null, skel: null, card: null, shadow: null, aIdle: null, aDance: null, ready: false });
    if (!live.size && blobTex) { blobTex.dispose(); blobTex = null; }
    if (st.file) { unload(D.file, st.file); st.file = null; }
  };
  api.disposables.push({ dispose: st.release });
  st.start();
  // runs after the dancer's own anim tick (ticks run in order)
  api.ticks.push((t, dt = 0.016) => {
    if (st.released) { st.start(); return; } // back in the club after a release
    if (!st.ready) return;
    const { B, mixer } = st;
    for (const [b, q] of st.rest) b.quaternion.copy(q); // bones without Idle tracks start from rest each frame
    if (st.aDance) { const w = cardigan && cardigan() ? 0 : 1; st.aDance.weight += (w - st.aDance.weight) * Math.min(1, dt * 3); if (st.aIdle) st.aIdle.weight = 1 - st.aDance.weight; } // private dancer idles between songs
    mixer.update(Math.min(dt, 0.1));
    if (cardigan && st.card) st.card.setDrawRange(0, cardigan() ? Infinity : st.noCard);
    if (st.shadow) { const g = p.group.position; st.y0 = Math.min(st.y0, g.y); st.shadow.position.set(g.x, st.y0 + 0.015, g.z); const h = g.y - st.y0; st.shadow.material.opacity = Math.max(0.15, 1 - h * 1.5); st.shadow.scale.setScalar(1 + h * 0.6); }
    p.group.updateMatrixWorld(true);
    // hip sway on the beat (the rig's own crouch is left to the routine's lift/orbit)
    const beat = t * 118 / 60 * Math.PI + k;
    B.Hips.rotateZ(Math.sin(beat) * 0.07); B.Hips.rotateY(Math.sin(beat * 0.5) * 0.08); B.Hips.updateMatrixWorld(true);
    // torso lean and head turn
    aim(B.Spine1, B.Neck, V1.copy(UP).applyQuaternion(p.torso.getWorldQuaternion(_q2)).normalize(), 0.8);
    B.Head.rotateY(p.head.rotation.y); B.Head.rotateX(-p.head.rotation.x); B.Head.updateMatrixWorld(true);
    // limbs: blocky arms[0]/legs[0] are on the rig's left
    aim(B.LeftArm, B.LeftForeArm, limbDir(p.arms[0], V1));
    aim(B.RightArm, B.RightForeArm, limbDir(p.arms[1], V1));
    aim(B.LeftUpLeg, B.LeftLeg, limbDir(p.legs[0], V1));
    aim(B.RightUpLeg, B.RightLeg, limbDir(p.legs[1], V1));
  });
  return st;
}
