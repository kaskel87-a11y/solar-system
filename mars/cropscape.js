// mars/cropscape.js: low-poly crop beds for the homestead racks, the gulch racks, and anywhere else that used a crop box.
// One shared geometry and one shared material per shape. Each rack is a soil bed plus one instanced mesh of plants
// (and fruit once they are mature). The parent group sways; we do not rebuild matrices every frame.
import * as THREE from 'three';
import { KINDS, stageOf, stageName, plantCount, bedSpan, STAGE_NAMES } from './cropscapecore.js';

const GEO = {};
function geo(kind) {
  if (GEO[kind]) return GEO[kind];
  let g;
  if (kind === 'bed') g = new THREE.BoxGeometry(1, 0.08, 1);
  else if (kind === 'leaf') g = new THREE.ConeGeometry(0.2, 1, 5);
  else if (kind === 'post') g = new THREE.CylinderGeometry(0.09, 0.12, 1, 5);
  else if (kind === 'pad') g = new THREE.SphereGeometry(0.22, 6, 4);
  else if (kind === 'stem') g = new THREE.CylinderGeometry(0.045, 0.06, 1, 5);
  else if (kind === 'cap') g = new THREE.SphereGeometry(0.18, 6, 4);
  else if (kind === 'ball') g = new THREE.SphereGeometry(0.11, 6, 4);
  else g = new THREE.TorusGeometry(0.72, 0.045, 5, 12);
  g.userData.shared = true;
  GEO[kind] = g;
  return g;
}
const MAT = {};
function mat(hex, glow, ei = 0.7) {
  const k = hex + ':' + (glow || 0) + ':' + ei;
  if (!MAT[k]) {
    const m = new THREE.MeshLambertMaterial({ color: hex, emissive: glow || 0x000000, emissiveIntensity: glow ? ei : 0 });
    m.userData.shared = true;
    MAT[k] = m;
  }
  return MAT[k];
}
const LOOK = {
  potato: { leaf: 0x6aa84f, fruit: 0xc4a574, glow: 0 },
  algae: { leaf: 0x2fbf71, fruit: 0x7dff9a, glow: 0x1a6b3a },
  glowberry: { leaf: 0x3d6b3a, fruit: 0x7a5bff, glow: 0x6e5bff },
  lichen: { leaf: 0xd5e4f2, fruit: 0xf7fbff, glow: 0xcfe8ff },
  redstatic: { leaf: 0xc81e1e, fruit: 0xff4040, glow: 0xff2020 },
  glowcactus: { leaf: 0x3d8c3a, fruit: 0x9cff3a, glow: 0x9cff3a },
  voidpoppy: { leaf: 0x2f6b32, fruit: 0xb44bff, glow: 0x8a2be2 },
  ghostspore: { leaf: 0xe8f4ff, fruit: 0xffffff, glow: 0xd0e8ff }
};
const _y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const H = [0.22, 0.5, 0.82, 1.05];

function leafKind(kind) {
  if (kind === 'cactus') return 'post';
  if (kind === 'mat') return 'pad';
  if (kind === 'shroom' || kind === 'flower' || kind === 'vine') return 'stem';
  return 'leaf';
}

// parent is the rack group. y is the tray top. left is the uncut fraction (0..1).
export function addCrop(parent, opt) {
  const id = LOOK[opt.crop] ? opt.crop : 'potato';
  const look = LOOK[id];
  const kind = KINDS[id] || 'bush';
  const growth = Math.max(0, Math.min(1, +opt.growth || 0));
  const left = Math.max(0, Math.min(1, opt.left == null ? 1 : +opt.left));
  const dead = !!opt.dead;
  const y0 = opt.y == null ? 1.1 : +opt.y;
  const stage = dead ? Math.min(stageOf(growth), 1) : stageOf(growth);
  const root = new THREE.Group();
  root.name = opt.name || 'farm-crop';
  root.userData.stage = STAGE_NAMES[stage];
  root.userData.crop = id;
  if (left <= 0) { parent.add(root); return root; }
  const span = bedSpan(left);
  const soil = new THREE.Mesh(geo('bed'), mat(dead ? 0x4a3828 : 0x5c4030, 0));
  soil.scale.set(1.55, 1, Math.max(0.35, span.depth));
  soil.position.set(0, y0 + 0.04, span.z);
  root.add(soil);
  const sway = new THREE.Group();
  sway.name = 'farm-sway';
  sway.userData.sway = opt.sway | 0;
  sway.position.y = y0 + 0.08;
  root.add(sway);
  const n = plantCount(left, kind);
  const h = H[stage];
  const leafM = mat(dead ? 0x6a5340 : look.leaf, dead ? 0 : look.leaf, 0.28);
  const im = new THREE.InstancedMesh(geo(leafKind(kind)), leafM, n);
  im.name = 'farm-leaves';
  im.frustumCulled = false;
  for (let i = 0; i < n; i++) {
    const x = (i % 2 ? 0.34 : -0.34) * (0.75 + (i % 3) * 0.12);
    const z = span.z - span.depth / 2 + (i + 0.5) * (span.depth / n);
    _q.setFromAxisAngle(_y, i * 0.9);
    if (kind === 'mat') _m.compose(_p.set(x, 0.03, z), _q, _s.set(0.7, 0.28 + h * 0.15, 0.85));
    else if (kind === 'moss') _m.compose(_p.set(x, h * 0.22, z), _q, _s.set(1.15, h * 0.45, 1.15));
    else if (kind === 'cactus') _m.compose(_p.set(x * 0.7, h * 0.5, z), _q, _s.set(0.85, h, 0.85));
    else _m.compose(_p.set(x, h * 0.5, z), _q, _s.set(h, h, h));
    im.setMatrixAt(i, _m);
  }
  im.instanceMatrix.needsUpdate = true;
  sway.add(im);
  if (!dead && stage >= 2) {
    const fruitN = stage === 3 ? n : Math.max(1, Math.ceil(n / 2));
    const fruitGeo = kind === 'shroom' ? 'cap' : kind === 'mat' ? 'pad' : 'ball';
    const fi = new THREE.InstancedMesh(geo(fruitGeo), mat(look.fruit, stage === 3 ? (look.glow || 0xffe14a) : 0), fruitN);
    fi.name = 'farm-fruit';
    fi.frustumCulled = false;
    for (let i = 0; i < fruitN; i++) {
      const x = (i % 2 ? 0.34 : -0.34) * (0.75 + (i % 3) * 0.12);
      const z = span.z - span.depth / 2 + (i + 0.5) * (span.depth / n);
      const fs = (stage === 3 ? 1.25 : 0.65) * (kind === 'shroom' ? 1.7 : 1);
      let fy = h * 0.85;
      if (kind === 'bush' || kind === 'moss' || kind === 'mat') fy = 0.1;
      else if (kind === 'shroom') fy = h * 0.92;
      else if (kind === 'cactus') fy = h * 0.55;
      _q.identity();
      _m.compose(_p.set(x, fy, z), _q, _s.set(fs, kind === 'shroom' || kind === 'mat' ? fs * 0.55 : fs, fs));
      fi.setMatrixAt(i, _m);
    }
    fi.instanceMatrix.needsUpdate = true;
    sway.add(fi);
  }
  if (!dead && stage === 3) {
    const cue = new THREE.Mesh(geo('ring'), mat(0xffe14a, 0xffc107));
    cue.name = 'farm-ready';
    cue.rotation.x = Math.PI / 2;
    cue.position.set(0, h + 0.72, span.z);
    cue.scale.set(0.62, 0.62, 0.62);
    sway.add(cue);
  }
  parent.add(root);
  return root;
}

export function sway(root, t) {
  if (!root) return;
  root.traverse(o => {
    if (o.name !== 'farm-sway') return;
    const s = o.userData.sway || 0;
    o.rotation.z = Math.sin(t * 1.35 + s) * 0.045;
    o.rotation.x = Math.sin(t * 0.9 + s * 0.4) * 0.02;
  });
}

export { stageName };
