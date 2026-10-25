// v7.5.x Velvet Airlock dancers: realistic skinned women replace the blocky club dancers once their GLBs arrive.
// Lazy: nothing is fetched until the club interior is built; the blocky rig keeps running underneath and stays
// visible if anything fails to load. Each GLB rides inside its dancer's existing group, so the pole routines,
// tips and the private dance are unchanged: every frame the model's limbs are aimed along the blocky rig's limbs,
// with the model's own Idle clip and a little hip sway layered on. Costumes never come off; hands off.
// Assets: models/dancers/*.glb, built from CC0 MakeHuman assets (see models/dancers/LICENSE.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const V = new URL(import.meta.url).searchParams.get('v');
const url = (n) => new URL(`./models/dancers/${n}.glb${V ? `?v=${V}` : ''}`, import.meta.url).href;
const cache = new Map();
let loader = null;
function load(name) {
  if (!cache.has(name)) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const p = loader.loadAsync(url(name)).then(g => { g.scene.traverse(o => { if (o.isMesh) { o.geometry.userData.shared = true; o.material.userData.shared = true; } }); return g; });
    p.catch(() => cache.delete(name)); // a later visit may retry
    cache.set(name, p);
  }
  return cache.get(name);
}

// outfits: mesh visibility by material name. Garment textures are white rib-knit, tinted here.
// Danny's base layer is the white string bikini, so it stays on under the crop top and shorts (no skin holes).
const OUTFITS = {
  bikini: ['SSX bikini top', 'SSX bikini bottom'],
  string: ['SSX string top', 'SSX string bottom', 'SSX coverup'], // Danny's main stage look: white string bikini + ring, open crochet cover-up
  crop: ['SSX string top', 'SSX string bottom', 'SSX crop top', 'SSX shorts', 'SSX cardigan'] // private dance: pink ribbed two-piece (+ cardigan)
};
const GARMENTS = ['SSX bikini top', 'SSX bikini bottom', 'SSX string top', 'SSX string bottom', 'SSX coverup', 'SSX crop top', 'SSX shorts', 'SSX cardigan'];
const UNTINTED = ['SSX string top', 'SSX string bottom', 'SSX coverup']; // white and beige as built
export const DANCERS = {
  danny: { file: 'dancer_danny', name: 'Danny Alvarez', tint: 0xff7eb8 },
  rhea: { file: 'dancer_rhea', name: 'Rhea', tint: 0xb47cff },
  kiara: { file: 'dancer_kiara', name: 'Kiara', tint: 0xff4fd0 }
};

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

// the string top's centre ring: a small metal torus between the cups, riding on the chest bone
const ringGeo = new THREE.TorusGeometry(0.022, 0.0045, 6, 16); ringGeo.userData.shared = true;
const ringMat = new THREE.MeshStandardMaterial({ color: 0xe8d8a0, metalness: 0.9, roughness: 0.25 }); ringMat.userData.shared = true;
function ring(api, model, top, bone) {
  model.updateMatrixWorld(true); // bind pose, model at the origin
  const pos = top.geometry.attributes.position, v = new THREE.Vector3(); let n = 0, y = 0, z = -9, minY = 9, maxY = -9;
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(top.matrixWorld); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(top.matrixWorld); if (Math.abs(v.x) < 0.07 && v.y < minY + (maxY - minY) * 0.4) { n++; y += v.y; z = Math.max(z, v.z); } }
  if (!n) return;
  const r = new THREE.Mesh(ringGeo, ringMat); r.position.copy(bone.worldToLocal(new THREE.Vector3(0, y / n, z - 0.004)));
  r.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert()); bone.add(r);
}

// Swap one blocky dancer for a model. opts: { dancer: 'danny', outfit: 'bikini'|'crop', k, cardigan: () => bool }
export function dress(api, p, { dancer = 'danny', outfit = 'bikini', k = 0, cardigan = null } = {}) {
  const D = DANCERS[dancer]; const st = { ready: false, p, D };
  load(D.file).then(gltf => {
    const m = cloneSkinned(gltf.scene); const B = {}; m.traverse(o => { if (o.isBone) B[o.name] = o; });
    const need = ['Hips', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
    if (need.some(n => !B[n])) return;
    const show = OUTFITS[outfit] || OUTFITS.bikini, tint = new THREE.Color(D.tint), mats = new Map();
    m.traverse(o => {
      if (!o.isMesh) return; o.frustumCulled = false; o.castShadow = false;
      const n = o.material.name;
      if (GARMENTS.includes(n)) {
        o.visible = show.includes(n);
        if (UNTINTED.includes(n)) { if (n === 'SSX string top') st.top = o; return; }
        if (!mats.has(n)) { const mm = o.material.clone(); mm.color.copy(tint); mm.emissive = tint.clone().multiplyScalar(0.12); mm.userData.shared = false; api.disposables.push(mm); mats.set(n, mm); }
        o.material = mats.get(n); if (n === 'SSX cardigan') st.cardigan = o;
      }
    });
    // the blocky rig is ~1.9 m with feet at 0; the model is ~1.7 m and faces +Z (the rig faces -Z)
    m.rotation.y = Math.PI; m.scale.setScalar(1.04);
    const mixer = new THREE.AnimationMixer(m), idle = gltf.animations.find(a => /idle/i.test(a.name));
    if (idle) { const a = mixer.clipAction(idle); a.time = (k * 1.7) % idle.duration; a.play(); }
    // hide the blocky meshes, keep their groups (they still drive position and pose)
    p.group.traverse(o => { if (o.isMesh) o.visible = false; });
    if (st.top && outfit === 'string') ring(api, m, st.top, B.Spine2 || B.Spine1);
    const rest = need.map(n => [B[n], B[n].quaternion.clone()]);
    p.group.add(m); Object.assign(st, { m, B, mixer, rest, ready: true });
  }).catch(e => { console.warn('club dancer model unavailable, keeping the classic look', e?.message || e); });
  // runs after the dancer's own anim tick (ticks run in order)
  api.ticks.push((t, dt = 0.016) => {
    if (!st.ready) return;
    const { B, mixer } = st;
    for (const [b, q] of st.rest) b.quaternion.copy(q); // bones without Idle tracks start from rest each frame
    mixer.update(Math.min(dt, 0.1));
    if (st.cardigan && cardigan) st.cardigan.visible = !!cardigan();
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
