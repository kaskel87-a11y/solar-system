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
/** Danny's display name: the ONE place it is set (nameplate/sign, spots, captions, contacts and toasts all read it). */
export const DANNY_NAME = 'Danny Alvarez';
export const DANCERS = {
  danny: { file: 'dancer_danny', name: DANNY_NAME, sheen: 0.55 }, // long straight wet-look black hair
  rhea: { file: 'dancer_rhea', name: 'Rhea', sheen: 0.18 },
  kiara: { file: 'dancer_kiara', name: 'Kiara', sheen: 0.18 }
};
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
function dancerMaterial(src, auxTex, { alt = null, sheen = 0.18, lu } = {}) {
  const phys = HIGH && !src.alphaTest; let m;
  if (phys) { // skin: sheen + wrap-lit diffuse; garments in this primitive get the (mild) sheen too
    m = new THREE.MeshPhysicalMaterial(); THREE.MeshStandardMaterial.prototype.copy.call(m, src); m.defines = { STANDARD: '', PHYSICAL: '' };
    m.sheen = 0.3; m.sheenRoughness = 0.6; m.sheenColor.set(0xffd2c0);
  } else m = src.clone();
  if (HIGH) m.defines = { ...(m.defines || {}), SSX_HIGH: '' };
  const u = { uAux: { value: auxTex }, uAlt: { value: new THREE.Vector4(...(alt || [0, 0, -1, 0])) }, uRimA: { value: RIM_A }, uRimB: { value: RIM_B },
    uRim: { value: HIGH ? 0.35 : 0.25 }, uHairSheen: { value: sheen }, ...lu.u };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aCell; attribute vec4 aGm; varying vec4 vCell; varying vec4 vGm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCell = aCell; vGm = aGm;\n' +
        // cloth (bikini / crop / shorts / straps): a per-vertex polygon offset, pulled 4 mm toward the camera along the view ray
        // (same pixel, nearer depth) so skin never pokes through the garment edges at any distance
        'float ssxV = floor(aGm.x + 0.5); if ((ssxV > 0.5 && ssxV < 7.5) || ssxV == 10.0) { vec4 ssxMv = mvPosition; ssxMv.xyz -= normalize(ssxMv.xyz) * 0.004; gl_Position = projectionMatrix * ssxMv; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uAux; uniform vec4 uAlt; uniform vec3 uRimA; uniform vec3 uRimB; uniform float uRim; uniform float uHairSheen;
uniform vec3 uKeyV; uniform vec3 uKeyC; uniform vec3 uRimV; uniform vec3 uRimC; uniform vec3 uFill; uniform float uScene; uniform float uNeutral;
vec3 ssxNeutral(vec3 lit, vec3 alb) { // the light that reached the surface, desaturated, back on the albedo
  vec3 irr = lit / max(alb, vec3(0.03)); return mix(irr, vec3(dot(irr, vec3(0.2126, 0.7152, 0.0722))), uNeutral) * alb; }
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
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{ // club light turned down and neutral, then the shader-only key light and a soft fill
  reflectedLight.directDiffuse = ssxNeutral(reflectedLight.directDiffuse, material.diffuseColor) * uScene;
  reflectedLight.indirectDiffuse = ssxNeutral(reflectedLight.indirectDiffuse, material.diffuseColor) * uScene;
  reflectedLight.directSpecular *= uScene * 0.6; reflectedLight.indirectSpecular *= uScene;
  IncidentLight ssxL; ssxL.direction = uKeyV; ssxL.color = uKeyC; ssxL.visible = true; vec3 ssxSp = reflectedLight.directSpecular;
  RE_Direct( ssxL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  if (ssxG() == 11.0) reflectedLight.directSpecular = mix(ssxSp, reflectedLight.directSpecular, 0.3); // hair: the strand highlight below does the shine
  reflectedLight.indirectDiffuse += uFill * (0.75 + 0.25 * dot(geometryNormal, normalize(uKeyV + vec3(0.0, 1.0, 0.0)))) * BRDF_Lambert( material.diffuseColor );
}`)
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
{ // rim light from behind (magenta), mostly on the side facing it; a faint cyan kicker on the other side
  float fr = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6), side = saturate(dot(normal, uRimV) * 0.8 + 0.35);
  totalEmissiveRadiance += (uRimC * side + uRimA * (1.0 - side) * 0.25) * fr * uRim * (ssxG() == 11.0 ? 0.4 : 1.0) * mix(vec3(1.0), diffuseColor.rgb * 2.5, 0.35) * diffuseColor.a;
}`)
      .replace('#include <opaque_fragment>', `if (ssxG() == 11.0) { // hair: Kajiya-Kay style strand highlight along the (mostly vertical) strands
  vec3 T = (viewMatrix * vec4(0.0, -1.0, 0.0, 0.0)).xyz; T = normalize(T - normal * dot(T, normal) + 1e-4);
  vec3 Vv = normalize(vViewPosition), L = uKeyV, H = normalize(L + Vv);
  float th = dot(T, H), sp = pow(sqrt(max(0.0, 1.0 - th * th)), 90.0) * 0.8 + pow(sqrt(max(0.0, 1.0 - th * th)), 14.0) * 0.08;
  outgoingLight += normalize(uKeyC + 1e-4) * 0.75 * sp * uHairSheen * saturate(dot(normal, L) + 0.3);
}
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `ssx-dancer-3${HIGH ? 'h' : 'm'}${phys ? 'p' : ''}`;
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
  const show = new Set([0, ...(OUTFITS[look] || OUTFITS.bikini).map(n => GID[n])]);
  const m = cloneSkinned(gltf.scene); const B = {}, mats = []; m.traverse(o => { if (o.isBone) B[o.name] = o; });
  const need = ['Hips', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
  if (need.some(n => !B[n])) return null;
  let skel = null, card = null, noCard = 0; const geos = [];
  const onBR = (r, sc, cam) => { // world -> view for the shader-only lights (dirs are room-frame; rooms are never rotated)
    lu.u.uKeyV.value.copy(lu.keyW).transformDirection(cam.matrixWorldInverse); lu.u.uRimV.value.copy(lu.rimW).transformDirection(cam.matrixWorldInverse); };
  m.traverse(o => {
    if (!o.isMesh) return; o.userData.ssxDancer = true; o.frustumCulled = false; o.castShadow = false; o.onBeforeRender = onBR;
    o.material = dancerMaterial(o.material, auxTex, { alt: look === 'aqua' ? gltf.scene.userData.ssx?.eyelet : null, sheen: D.sheen, lu }); mats.push(o.material); if (o.isSkinnedMesh) skel = o.skeleton;
    // own index buffer with just this outfit's triangles; vertex attributes stay shared with the cached GLB
    const g0 = o.geometry, gm = g0.attributes.aGm, src = g0.index.array, keep = [], cd = [];
    for (let i = 0; i < src.length; i += 3) { const id = Math.round(gm.getX(src[i])); if (id >= 11 || show.has(id)) (id === GID['SSX cardigan'] ? cd : keep).push(src[i], src[i + 1], src[i + 2]); }
    const g = new THREE.BufferGeometry(); for (const n in g0.attributes) g.setAttribute(n, g0.attributes[n]);
    const all = keep.concat(cd); g.setIndex(new THREE.BufferAttribute(gm.count > 65535 ? new Uint32Array(all) : new Uint16Array(all), 1));
    g.boundingSphere = g0.boundingSphere; o.geometry = g; geos.push(g); if (cd.length) { card = g; noCard = keep.length; }
  });
  m.rotation.y = Math.PI; m.scale.setScalar(1.04); // the model faces +Z; rigs and seats face -Z
  const mixer = new THREE.AnimationMixer(m), acts = {};
  for (const a of gltf.animations) acts[a.name] = mixer.clipAction(a);
  const clip = re => { const a = gltf.animations.find(c => re.test(c.name)); return a ? acts[a.name] : null; };
  const rest = need.map(n => [B[n], B[n].quaternion.clone()]);
  const dispose = () => { mixer.stopAllAction(); mixer.uncacheRoot(m); mats.forEach(x => x.dispose()); geos.forEach(x => x.dispose()); skel?.dispose(); };
  return { m, B, mats, skel, geos, mixer, acts, clip, rest, card, noCard, dispose };
}

// Swap one blocky dancer for a model. opts: { dancer: 'danny', outfit: 'bikini'|'aqua'|'string'|'crop'|'stage', k, cardigan: () => bool }
export function dress(api, p, { dancer = 'danny', outfit = 'bikini', k = 0, cardigan = null, look: lk = null } = {}) {
  const D = DANCERS[dancer]; const st = { ready: false, p, D, released: true, lu: lightUniforms(lk || undefined) };
  const blocky = (on) => p.group.traverse(o => { if (o.isMesh && !o.userData.ssxDancer) o.visible = on; });
  let look = outfit;
  st.start = () => {
    // Danny's stage outfit: the aqua crochet bikini, with the white string bikini + cover-up as the alternate every third visit
    if (outfit === 'stage') look = (stageVisits++ % 3 === 2) ? 'string' : 'aqua';
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
    }).catch(e => { if (!st.released) console.warn('club dancer model unavailable, keeping the classic look', e?.message || e); });
  };
  st.release = () => {
    if (st.released) return; st.released = true; live.delete(st);
    if (st.ready) { st.p.group.remove(st.m); st.dispose(); blocky(true);
      if (st.shadow) { st.shadow.removeFromParent(); st.shadow.geometry.dispose(); st.shadow.material.dispose(); } }
    Object.assign(st, { m: null, B: null, mixer: null, mats: null, geos: null, skel: null, card: null, shadow: null, aIdle: null, aDance: null, ready: false });
    if (!live.size && blobTex) { blobTex.dispose(); blobTex = null; }
    if (st.file) { unload(D.file, st.file); st.file = null; }
  };
  st.setLook = (l) => setLook(st.lu, l);
  api.disposables.push({ dispose: st.release });
  st.start();
  // runs after the dancer's own anim tick (ticks run in order)
  api.ticks.push((t, dt = 0.016) => {
    if (st.released) { st.start(); return; } // back in the club after a release
    if (!st.ready) return;
    const { B, mixer } = st, between = !!(cardigan && cardigan());
    for (const [b, q] of st.rest) b.quaternion.copy(q); // bones without clip tracks start from rest each frame
    if (st.aDance) { const w = between ? 0 : 1; st.aDance.weight += (w - st.aDance.weight) * Math.min(1, dt * 3); if (st.aIdle) st.aIdle.weight = 1 - st.aDance.weight; } // private dancer idles between songs
    mixer.update(Math.min(dt, 0.1));
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

// A free-standing dancer with no blocky rig (privateshow.js). Returns a handle; await h.ready.
//   h.group: add it to a scene/room group; faces -Z like the rigs.  h.play(/salsa/i, fade)  h.update(dt)  h.setLook({...})
//   h.armsIdle(on): rest arms (hand on hip) on top of the clip.  h.release(): frees everything (the GLB stays cached while others use it)
export function spawn({ dancer = 'danny', outfit = 'aqua', look = null } = {}) {
  const D = DANCERS[dancer], lu = lightUniforms(look || undefined), group = new THREE.Group();
  const h = { group, D, lu, md: null, cur: null, released: false, armsW: 0, armsOn: false };
  hook(); const f = load(D.file);
  h.ready = f.p.then(({ gltf, aux: auxTex }) => {
    if (h.released) return null;
    const md = buildModel(gltf, auxTex, D, outfit, lu); if (!md) throw new Error('bad rig');
    group.add(md.m); h.md = md; return h;
  });
  h.ready.catch(() => {});
  h.play = (re, fade = 0.6) => {
    const a = h.md?.clip(re); if (!a || a === h.cur) return !!a;
    a.reset().setEffectiveWeight(1).play(); if (h.cur) h.cur.crossFadeTo(a, fade, false); h.cur = a; return true;
  };
  h.armsIdle = (on) => { h.armsOn = on; };
  h.update = (dt) => {
    const md = h.md; if (!md) return;
    for (const [b, q] of md.rest) b.quaternion.copy(q);
    md.mixer.update(Math.min(dt, 0.1));
    h.armsW += ((h.armsOn ? 1 : 0) - h.armsW) * Math.min(1, dt * 3);
    if (h.armsW > 0.01) { group.updateMatrixWorld(true); group.getWorldQuaternion(_gq); const A = IDLE_ARMS;
      aimArm(md.B, 1, V1.copy(A.R[0]).applyQuaternion(_gq), _b2.copy(A.R[1]).applyQuaternion(_gq), h.armsW);
      aimArm(md.B, -1, V1.copy(A.L[0]).applyQuaternion(_gq), _b2.copy(A.L[1]).applyQuaternion(_gq), h.armsW); }
  };
  h.setLook = (l) => setLook(lu, l);
  h.stats = () => ({ textures: new Set(h.md ? h.md.mats.flatMap(m => [m.map, m.normalMap, m.userData.u.uAux.value].filter(Boolean)) : []).size, draws: h.md ? h.md.mats.length : 0 });
  const entry = { release: () => h.release() };
  h.release = () => { if (h.released) return; h.released = true; live.delete(entry); if (h.md) { group.remove(h.md.m); h.md.dispose(); h.md = null; } unload(D.file, f); };
  live.add(entry); // leaving the club frees it too
  return h;
}
