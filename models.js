// Low-poly models shared by space flight and the surface: Starship-style ship, astronaut, French bulldog, six-wheel rover, discoveries.
import * as THREE from 'three';

// No environment map in these scenes, so metals stay mostly diffuse (high metalness renders black).
export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15, ...o });
const V2 = THREE.Vector2;

/** Merge geometries (each with an optional matrix) into one non-indexed geometry with position/normal. */
export function mergeGeos(list) {
  const parts = list.map(([g, m]) => { const n = g.index ? g.toNonIndexed() : g.clone(); if (m) n.applyMatrix4(m); return n; });
  const count = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
}

// ---------- Starship-style ship (generic look, no logos or text) ----------
let steelTex = null;
function getSteelTex() {
  if (steelTex) return steelTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 64, 0); grd.addColorStop(0, '#d8dce2'); grd.addColorStop(0.5, '#f4f6f8'); grd.addColorStop(1, '#cfd3da');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
  g.fillStyle = 'rgba(70,75,85,0.35)'; for (let y = 0; y < 256; y += 21) g.fillRect(0, y, 64, 1.5); // weld rings
  g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 64, Math.random() * 256, 1, 18);
  steelTex = new THREE.CanvasTexture(c); steelTex.colorSpace = THREE.SRGBColorSpace; steelTex.wrapS = steelTex.wrapT = THREE.RepeatWrapping;
  return steelTex;
}
/** Ship is 50 units tall and 9 wide, base at y=0 (or legs' pads at y=0), nose up, heat tiles face +X. */
export function buildStarship({ legs = false, seg = 28 } = {}) {
  const group = new THREE.Group();
  const lift = legs ? 4 : 0;
  const steel = mat(0xffffff, { map: getSteelTex(), roughness: 0.32, metalness: 0.2 });
  const tile = mat(0x1a1c21, { roughness: 0.9, metalness: 0 });
  const dark = mat(0x3a3c42, { roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
  const R = 4.5, BODY = 34, NOSE = 16;
  const prof = [new V2(0.01, -0.4), new V2(3.6, -0.3), new V2(R, 0.5)];
  for (let y = 2; y <= BODY; y += 4) prof.push(new V2(R, y));
  for (let i = 1; i <= 12; i++) { const t = i / 12; prof.push(new V2(Math.max(0.01, R * Math.pow(1 - Math.pow(t, 2.3), 0.5)), BODY + NOSE * t)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, seg), steel); body.position.y = lift; group.add(body);
  // black heat-shield tiles on the windward (+X) half, from the aft dome up most of the nose
  const tprof = prof.filter(p => p.y > 0 && p.y < BODY + NOSE * 0.8).map(p => new V2(p.x * 1.012 + 0.02, p.y));
  const shield = new THREE.Mesh(new THREE.LatheGeometry(tprof, Math.max(8, seg >> 1), 0, Math.PI), tile); shield.position.y = lift; group.add(shield);
  // flaps: flat plates sticking out sideways (±Z), black on the windward face
  const flapMats = [tile, steel, steel, steel, steel, steel];
  const mkFlap = (w, h, y) => { for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, w), flapMats); f.position.set(0.6, lift + y, s * (R + w / 2 - 0.3)); f.rotation.x = s * 0.04; group.add(f); } };
  mkFlap(3.2, 7, BODY + 7.5);  // forward flaps
  mkFlap(4.4, 11, 7);          // aft flaps
  // engines: 3 inner sea-level bells and 3 outer vacuum bells
  const engines = [];
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; engines.push({ x: Math.cos(a) * 1.3, z: Math.sin(a) * 1.3, r: 0.75, h: 1.8 }); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 3; engines.push({ x: Math.cos(a) * 3.0, z: Math.sin(a) * 3.0, r: 1.2, h: 2.6 }); }
  const flames = new THREE.Group(); flames.position.y = lift;
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a5a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xc8dcff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const e of engines) {
    const bell = new THREE.Mesh(new THREE.ConeGeometry(e.r, e.h, 14, 1, true), dark); bell.position.set(e.x, lift - e.h / 2 + 0.1, e.z); group.add(bell);
    const L = e.r * 9;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(e.r * 0.95, L, 10, 1, true), flameMat); fl.rotation.x = Math.PI; fl.position.set(e.x, -e.h - L / 2 + 0.2, e.z); flames.add(fl);
    const co = new THREE.Mesh(new THREE.ConeGeometry(e.r * 0.45, L * 0.45, 8, 1, true), coreMat); co.rotation.x = Math.PI; co.position.set(e.x, -e.h - L * 0.22 + 0.2, e.z); flames.add(co);
  }
  flames.visible = false; group.add(flames);
  if (legs) {
    const legMat = mat(0x9aa0a8, { roughness: 0.5 }), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + Math.PI / 6;
      const top = new THREE.Vector3(Math.cos(a) * R * 0.95, lift + 7, Math.sin(a) * R * 0.95), foot = new THREE.Vector3(Math.cos(a) * (R + 2.2), 0.3, Math.sin(a) * (R + 2.2));
      const d = foot.clone().sub(top), len = d.length();
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, len, 6), legMat);
      strut.position.copy(top).addScaledVector(d, 0.5); strut.quaternion.setFromUnitVectors(up, d.normalize()); group.add(strut);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.35, 10), legMat); pad.position.copy(foot).setY(0.17); group.add(pad);
    }
  }
  return { group, flames };
}

// ---------- Astronaut (1.8 m, feet at y=0, faces -Z) ----------
export function buildAstronaut() {
  const g = new THREE.Group(), suit = mat(0xf2f2ee, { roughness: 0.8 }), grey = mat(0x9a9ea6), visor = mat(0xd9a441, { roughness: 0.15, metalness: 0.3, emissive: 0x2a1a00 });
  const limb = (r, h, m) => { const geo = new THREE.CylinderGeometry(r, r * 0.9, h, 8); geo.translate(0, -h / 2, 0); return new THREE.Mesh(geo, m); };
  const legL = limb(0.12, 0.88, suit), legR = limb(0.12, 0.88, suit); legL.position.set(-0.13, 0.92, 0); legR.position.set(0.13, 0.92, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.36), suit); torso.position.y = 1.24;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.6, 0.26), grey); pack.position.set(0, 1.28, 0.3);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.05), mat(0x3d6fd6)); chest.position.set(0, 1.32, -0.19);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10), suit); helmet.position.y = 1.72;
  const vis = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), visor); vis.scale.set(1, 0.78, 0.8); vis.position.set(0, 1.73, -0.1);
  const armL = limb(0.085, 0.7, suit), armR = limb(0.085, 0.7, suit); armL.position.set(-0.37, 1.54, 0); armR.position.set(0.37, 1.54, 0);
  const bootM = mat(0x55585e);
  [legL, legR].forEach(l => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.32), bootM); b.position.set(0, -0.86, -0.04); l.add(b); });
  g.add(legL, legR, torso, pack, chest, helmet, vis, armL, armR);
  return { group: g, parts: { legL, legR, armL, armR } };
}

// ---------- French bulldog (fawn, bat ears; feet at y=0, faces -Z) ----------
export function buildDog({ helmet = false, coat = 0xd2a679 } = {}) {
  const g = new THREE.Group(), fur = mat(coat, { roughness: 0.95 }), mask = mat(0x3b2b22, { roughness: 0.9 }), black = mat(0x111111, { roughness: 0.4 }), pink = mat(0xe6a0a0, { roughness: 0.9 });
  const sph = (r, m, ws = 12, hs = 8) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m);
  const body = new THREE.Group(); g.add(body);
  const barrel = sph(0.2, fur); barrel.scale.set(1.05, 0.88, 1.45); barrel.position.set(0, 0.33, 0.02); body.add(barrel);
  const chest = sph(0.17, fur); chest.position.set(0, 0.34, -0.17); body.add(chest);
  const head = new THREE.Group(); head.position.set(0, 0.5, -0.33); body.add(head);
  const skull = sph(0.15, fur, 14, 10); skull.scale.set(1.12, 0.95, 0.95); head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.09), mask); muzzle.position.set(0, -0.04, -0.13); head.add(muzzle);
  const nose = sph(0.032, black, 8, 6); nose.position.set(0, -0.015, -0.18); head.add(nose);
  for (const s of [-1, 1]) {
    const eye = sph(0.022, black, 8, 6); eye.position.set(s * 0.065, 0.03, -0.125); head.add(eye);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.17, 6), fur); ear.position.set(s * 0.085, 0.15, 0.0); ear.rotation.z = -s * 0.28; head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), pink); inner.position.set(s * 0.083, 0.14, -0.022); inner.rotation.z = -s * 0.28; head.add(inner);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.022, 6, 14), mat(0xd23b3b)); collar.position.set(0, 0.42, -0.25); collar.rotation.x = 1.25; body.add(collar);
  const tag = sph(0.025, mat(0xf0c040, { roughness: 0.3 }), 6, 4); tag.position.set(0, 0.33, -0.31); body.add(tag);
  const tail = new THREE.Group(); tail.position.set(0, 0.4, 0.3); body.add(tail);
  const stub = sph(0.045, fur, 8, 6); stub.position.set(0, 0.02, 0.02); tail.add(stub);
  const legs = [];
  for (const [x, z] of [[-0.1, -0.17], [0.1, -0.17], [-0.1, 0.19], [0.1, 0.19]]) {
    const geo = new THREE.CylinderGeometry(0.045, 0.04, 0.22, 6); geo.translate(0, -0.11, 0);
    const leg = new THREE.Mesh(geo, fur); leg.position.set(x, 0.23, z); body.add(leg); legs.push(leg);
    const paw = sph(0.045, fur, 6, 4); paw.scale.set(1, 0.6, 1.2); paw.position.set(0, -0.21, -0.015); leg.add(paw);
  }
  let bubble = null;
  if (helmet) {
    bubble = sph(0.25, new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false }), 16, 12);
    bubble.position.set(0, 0.02, -0.02); head.add(bubble);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16), mat(0xdddddd)); ring.position.set(0, -0.15, 0.03); ring.rotation.x = 1.3; head.add(ring);
  }
  g.scale.setScalar(1.25);
  return { group: g, parts: { body, head, tail, legs, bubble } };
}

// ---------- Six-wheel pressurized rover (angular wedge body; origin on the ground, faces -Z) ----------
export function buildRover() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const steelM = mat(0xb4b9c1, { roughness: 0.45, metalness: 0.2, flatShading: true });
  const glass = new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff }), red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const W = 2.6;
  const extrude = (pts, depth, m) => {
    const s = new THREE.Shape(pts.map(([z, y]) => new V2(z, y)));
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); geo.translate(0, 0, -depth / 2); geo.rotateY(-Math.PI / 2);
    return new THREE.Mesh(geo, m);
  };
  // side profile (z, y): wedge nose, peaked roof, sloped tail
  body.add(extrude([[-3.1, 0.95], [-3.2, 1.55], [-2.3, 1.8], [3.0, 1.8], [3.05, 0.95]], W, steelM)); // lower hull
  body.add(extrude([[1.0, 1.79], [1.0, 2.36], [3.0, 1.96], [3.0, 1.79]], W, steelM));                 // rear canopy
  const cab = extrude([[-2.3, 1.8], [-0.6, 2.75], [1.0, 2.36], [1.0, 1.8]], W - 0.1, glass); cab.renderOrder = 2; body.add(cab);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(W - 0.05, 0.08, 0.5), steelM); ridge.position.set(0, 2.76, -0.6); body.add(ridge);
  for (const sx of [-1, 1]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.0), steelM); pil.position.set(sx * (W / 2 - 0.08), 2.28, -1.45); pil.rotation.x = -0.51; body.add(pil); }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.35, 6.0), mat(0x2b2d31, { flatShading: true })); skirt.position.y = 1.0; body.add(skirt);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.14), glow); bar.position.set(0, 2.82, -0.7); body.add(bar);
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.07, 0.05), glow); head.position.set(0, 1.5, -3.2); body.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.07, 0.05), red); tail.position.set(0, 1.85, 3.05); body.add(tail);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), mat(0x777777)); mast.position.set(0.8, 2.55, 1.6); body.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 5, 0, Math.PI * 2, 0, 1.0), mat(0xdddddd, { side: THREE.DoubleSide })); dish.position.set(0.8, 3.0, 1.6); dish.rotation.x = -0.6; body.add(dish);
  // headlight pool on the ground (cheap fake light)
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,250,230,0.55)'); rg.addColorStop(1, 'rgba(255,250,230,0)'); x.fillStyle = rg; x.fillRect(0, 0, 64, 64);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 11), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.08, -8.5); g.add(pool);
  // wheels with suspension pivots
  const tireBase = new THREE.CylinderGeometry(0.62, 0.62, 0.55, 14); tireBase.rotateZ(Math.PI / 2);
  const treadBase = new THREE.BoxGeometry(0.57, 0.1, 0.16), tm = [[tireBase]];
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; tm.push([treadBase, new THREE.Matrix4().compose(new THREE.Vector3(0, Math.cos(a) * 0.63, Math.sin(a) * 0.63), new THREE.Quaternion().setFromEuler(new THREE.Euler(a, 0, 0)), new THREE.Vector3(1, 1, 1))]); }
  const tireGeo = mergeGeos(tm);
  const hubGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.58, 8); hubGeo.rotateZ(Math.PI / 2);
  const tireM = mat(0x1c1c1f, { roughness: 0.95, flatShading: true }), hubM = mat(0x8c9097, { flatShading: true });
  const wheels = [];
  for (const wz of [-2.05, 0, 2.05]) for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 1.55, 0.62, wz); g.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(new THREE.Mesh(tireGeo, tireM), new THREE.Mesh(hubGeo, hubM));
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), mat(0x44464b)); arm.position.set(-s * 0.4, 0.25, 0); arm.rotation.z = s * 0.5; pivot.add(arm);
    wheels.push({ pivot, spin, x: s * 1.55, z: wz, front: wz < 0 });
  }
  const seat = new THREE.Object3D(); seat.position.set(0.55, 1.45, -1.0); body.add(seat);
  return { group: g, body, wheels, seat, paint: steelM };
}

// ---------- Discoveries ----------
// Each builder gets h(dx, dz) = local ground height relative to the item's origin.
const stoneM = c => mat(c, { roughness: 0.95, flatShading: true });
export const DISCOVERY_BUILDERS = {
  footprints(h) {
    const g = new THREE.Group(), m = mat(0x3a3a3c, { roughness: 1 }), geo = new THREE.BoxGeometry(0.14, 0.03, 0.32);
    for (let i = 0; i < 16; i++) { const z = -i * 0.75, x = (i % 2 ? 0.18 : -0.18) + Math.sin(i * 0.4) * 0.6; const f = new THREE.Mesh(geo, m); f.position.set(x, h(x, z) + 0.01, z); f.rotation.y = Math.sin(i * 0.4) * 0.3; g.add(f); }
    return g;
  },
  lrv(h) {
    const g = new THREE.Group(), frame = mat(0xb8b8b0), dark = mat(0x333333), gold = mat(0xc8a050, { roughness: 0.4 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 3.0), frame); deck.position.y = 0.75; g.add(deck);
    for (const s of [-1, 1]) { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), mat(0x6a6a6a)); seat.position.set(s * 0.45, 1.05, 0.2); g.add(seat); }
    for (const x of [-1, 1]) for (const z of [-1.2, 1.2]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 6, 12), dark); w.rotation.y = Math.PI / 2; w.position.set(x * 1.0, 0.45, z); g.add(w); const fender = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.9), gold); fender.position.set(x * 1.0, 0.92, z); g.add(fender); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), frame); pole.position.set(-0.6, 1.4, -1.2); g.add(pole);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 5, 0, Math.PI * 2, 0, 0.9), mat(0xeeeeee, { side: THREE.DoubleSide })); dish.position.set(-0.6, 2.0, -1.2); dish.rotation.x = -0.5; g.add(dish);
    g.position.y = h(0, 0) - h(0, 0); return g;
  },
  ice(h) {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.9, 6, 20), stoneM(0x3e3e40)); rim.rotation.x = Math.PI / 2; rim.scale.z = 0.45; rim.position.y = h(0, 0) + 0.15; g.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 20), mat(0x101114, { roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; g.add(floor);
    const ice = new THREE.Mesh(new THREE.CircleGeometry(3.4, 14), mat(0xdff4ff, { roughness: 0.08, emissive: 0x1a3a55 })); ice.rotation.x = -Math.PI / 2; ice.position.y = 0.08; g.add(ice);
    const cm = mat(0xcfeeff, { roughness: 0.05, emissive: 0x204060, flatShading: true });
    for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + (i % 3) * 0.15, 0), cm); const a = i * 0.9; c.position.set(Math.cos(a) * 1.8, 0.3, Math.sin(a) * 1.8); c.scale.y = 1.8; c.rotation.set(i, i * 2, 0); g.add(c); }
    return g;
  },
  retro(h) {
    const g = new THREE.Group(), legM = mat(0xaaaaaa);
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ccc'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#223'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(4 + i * 8, 4 + j * 8, 3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.55), [legM, legM, mat(0xffffff, { map: t, roughness: 0.2 }), legM, legM, legM]); panel.position.y = 0.45; panel.rotation.x = -0.35; g.add(panel);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), legM); l.position.set(sx * 0.3, 0.22, sz * 0.22); g.add(l); }
    return g;
  },
  golf(h) {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(0xffffff, { roughness: 0.5 })); ball.position.set(0, 0.06, 0); g.add(ball);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 5), mat(0xaaaaaa)); shaft.rotation.z = Math.PI / 2 - 0.05; shaft.position.set(0.75, 0.05, 0.3); g.add(shaft);
    const club = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.08), mat(0x888888)); club.position.set(0.22, 0.04, 0.3); g.add(club);
    const divot = new THREE.Mesh(new THREE.CircleGeometry(0.25, 10), mat(0x444446, { roughness: 1 })); divot.rotation.x = -Math.PI / 2; divot.position.set(-1.2, 0.02, -0.4); g.add(divot);
    return g;
  },
  meteorite(h) {
    const g = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), mat(0x2b2522, { roughness: 0.4, metalness: 0.3, flatShading: true, emissive: 0x0a0806 })); rock.position.y = 0.6; rock.rotation.set(0.5, 1, 0.3); g.add(rock);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.45, 5, 16), stoneM(0x505052)); ring.rotation.x = Math.PI / 2; ring.scale.z = 0.4; ring.position.y = 0.1; g.add(ring);
    return g;
  },
  ingenuity(h) {
    const g = new THREE.Group(), gold = mat(0xd4a23a, { roughness: 0.4 }), grey = mat(0x888888), panel = mat(0x1a2a5a, { roughness: 0.3 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2), gold); box.position.y = 0.35; g.add(box);
    const mastM = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), grey); mastM.position.y = 0.6; g.add(mastM);
    for (const y of [0.55, 0.7]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.01, 0.08), grey); b.position.y = y; b.rotation.y = y * 3; g.add(b); }
    const sol = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.12), panel); sol.position.y = 0.82; g.add(sol);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.45, 4), grey); l.position.set(Math.cos(a) * 0.18, 0.17, Math.sin(a) * 0.18); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(l); }
    g.scale.setScalar(1.6); return g;
  },
  riverbed(h) {
    const g = new THREE.Group(), n = 90;
    const peb = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0xd9b48a, { roughness: 0.7, flatShading: true }), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const t = i / n, z = (t - 0.5) * 34, x = Math.sin(t * 7) * 3 + (Math.random() - 0.5) * 2.2;
      const k = 0.6 + Math.random() * 1.6; s.set(k, k * 0.6, k); p.set(x, h(x, z) + 0.05, z); q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6, 0));
      peb.setMatrixAt(i, m4.compose(p, q, s)); peb.setColorAt(i, col.setHSL(0.07, 0.35, 0.45 + Math.random() * 0.25));
    }
    g.add(peb);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(4, 36, 1, 18), mat(0x9a5a35, { roughness: 1 }));
    const pa = bed.geometry.attributes.position; bed.rotation.x = -Math.PI / 2;
    for (let i = 0; i < pa.count; i++) { const lx = pa.getX(i), ly = pa.getY(i); const z = -ly, x = lx + Math.sin((z / 34 + 0.5) * 7) * 3; pa.setX(i, x); pa.setZ(i, h(x, z) + 0.03); }
    bed.geometry.computeVertexNormals(); g.add(bed);
    return g;
  },
  icepatch(h) {
    const g = new THREE.Group(), geo = new THREE.CircleGeometry(3.2, 18), pa = geo.attributes.position;
    for (let i = 1; i < pa.count; i++) { const k = 0.7 + Math.random() * 0.5; pa.setXY(i, pa.getX(i) * k, pa.getY(i) * k); }
    const ice = new THREE.Mesh(geo, mat(0xf4fbff, { roughness: 0.15, emissive: 0x223344 })); ice.rotation.x = -Math.PI / 2; ice.position.y = 0.06; g.add(ice);
    const trench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.5), mat(0x5a2a18)); trench.position.set(0.5, 0.08, 0); g.add(trench);
    return g;
  },
  dustdevil(h) {
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xc98a58, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(6 - i * 1.4, 0.6 + i * 0.2, 44 - i * 8, 14, 1, true), m); c.position.y = (44 - i * 8) / 2; g.add(c); }
    g.userData.anim = (o, t) => { o.children.forEach((c, i) => { c.rotation.y = t * (2 + i); c.position.x = Math.sin(t * 0.7 + i) * 0.6; }); };
    return g;
  },
  face(h) {
    const g = new THREE.Group(), m = stoneM(0x9b5530);
    const mesa = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 8), m); mesa.scale.set(1, 0.38, 1.35); mesa.position.y = 1.5; g.add(mesa);
    const d = mat(0x4a2010, { roughness: 1 });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(2.4, 10), d); e.rotation.x = -Math.PI / 2 + 0.2; e.position.set(s * 5, 7.4, -4); g.add(e); }
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), d); mouth.rotation.x = -Math.PI / 2 + 0.5; mouth.position.set(0, 6.6, 7); g.add(mouth);
    return g;
  },
  volcano(h) {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(7, 42, 24, 18, 1), stoneM(0x4a2e1e)); cone.position.y = 11; g.add(cone);
    const lava = new THREE.Mesh(new THREE.CircleGeometry(6.5, 16), new THREE.MeshBasicMaterial({ color: 0xff5a10 })); lava.rotation.x = -Math.PI / 2; lava.position.y = 23.05; g.add(lava);
    const glowM = new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const gl = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), glowM); gl.position.y = 24; gl.scale.y = 0.5; g.add(gl);
    g.userData.anim = (o, t) => { gl.material.opacity = 0.25 + Math.sin(t * 2) * 0.1; };
    return g;
  },
  lava(h) {
    const g = new THREE.Group(), hot = new THREE.MeshBasicMaterial({ color: 0xff4a0a }), crust = stoneM(0x2a1a12);
    for (let i = 0; i < 26; i++) {
      const z = -i * 1.6, x = Math.sin(i * 0.35) * 4;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4 + Math.random(), 0.35, 1.5), crust); slab.position.set(x, h(x, z) + 0.12, z); slab.rotation.y = Math.random() * 0.4; g.add(slab);
      const crack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.12), hot); crack.position.set(x, h(x, z) + 0.31, z + 0.75); g.add(crack);
    }
    return g;
  },
  pancake(h) {
    const g = new THREE.Group(), m = stoneM(0xa77446);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 3, 22), m); d.position.y = 1.2; g.add(d);
    const top = new THREE.Mesh(new THREE.SphereGeometry(15, 18, 6, 0, Math.PI * 2, 0, 0.5), m); top.scale.y = 0.3; top.position.y = 1.2; g.add(top);
    const pit = new THREE.Mesh(new THREE.CircleGeometry(2, 10), mat(0x3a2412)); pit.rotation.x = -Math.PI / 2; pit.position.y = 3.95; g.add(pit);
    return g;
  },
  balloon(h) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), mat(0xf0ece0, { roughness: 0.4 })); b.position.y = 26; g.add(b);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 12, 4), mat(0x666666)); line.position.y = 18.3; g.add(line);
    const gond = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.0, 8), mat(0xb0b0b0)); gond.position.y = 11.8; g.add(gond);
    g.userData.anim = (o, t) => { o.children.forEach(c => c.position.x = Math.sin(t * 0.4) * 1.5); b.position.y = 26 + Math.sin(t * 0.6) * 0.8; };
    g.userData.beaconY = 30;
    return g;
  },
  scarp(h) {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(6, 6, 80, 3, 1); geo.rotateZ(Math.PI / 2);
    const cliff = new THREE.Mesh(geo, stoneM(0x6d655f)); cliff.scale.set(1, 1.1, 1.6); cliff.rotation.x = 0.5; cliff.position.y = -0.5; g.add(cliff);
    return g;
  },
  hollows(h) {
    const g = new THREE.Group(), m = mat(0xbfe6ff, { roughness: 0.6, emissive: 0x18344a });
    for (let i = 0; i < 9; i++) { const r = 0.8 + Math.random() * 1.8, a = i * 0.7, d = 1 + i * 1.1; const p = new THREE.Mesh(new THREE.CircleGeometry(r, 10), m); p.rotation.x = -Math.PI / 2; const x = Math.cos(a) * d, z = Math.sin(a) * d; p.position.set(x, h(x, z) + 0.05, z); g.add(p); }
    return g;
  },
  caloris(h) {
    const g = new THREE.Group(), m = stoneM(0x5e5650);
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(3 + i, 0), m); b.position.set(i * 4 - 8, 1 + i * 0.6, Math.sin(i) * 3); b.scale.y = 0.8 + i * 0.25; b.rotation.set(i, i * 2, 0); g.add(b); }
    return g;
  },
  polarice(h) { return DISCOVERY_BUILDERS.ice(h); },
  redwood(h) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 46, 10), mat(0x7a3e22, { roughness: 1, flatShading: true })); trunk.position.y = 23; g.add(trunk);
    const leafM = mat(0x24502a, { roughness: 0.9, flatShading: true });
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(9 - i * 1.8, 12, 9), leafM); c.position.y = 30 + i * 6.5; g.add(c); }
    return g;
  },
  fox(h) {
    const g = new THREE.Group(), orange = mat(0xd2652a, { roughness: 0.9 }), white = mat(0xf4efe6, { roughness: 0.9 }), black = mat(0x1a1a1a);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), orange); body.scale.set(0.9, 0.85, 1.7); body.position.y = 0.42; g.add(body);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), orange); head.rotation.x = -Math.PI / 2; head.position.set(0, 0.55, -0.5); g.add(head);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), black); e.position.set(s * 0.07, 0.69, -0.42); g.add(e); }
    const tail = new THREE.Group(); tail.position.set(0, 0.45, 0.35); g.add(tail);
    const tb = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 8), orange); tb.rotation.x = -Math.PI / 2 - 0.4; tb.position.z = 0.25; tail.add(tb);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), white); tip.position.set(0, 0.1, 0.5); tail.add(tip);
    for (const [x, z] of [[-0.09, -0.22], [0.09, -0.22], [-0.09, 0.22], [0.09, 0.22]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 5), black); l.position.set(x, 0.16, z); g.add(l); }
    g.userData.anim = (o, t) => { tail.rotation.y = Math.sin(t * 3) * 0.4; o.rotation.y = Math.sin(t * 0.3) * 0.8; };
    g.scale.setScalar(1.3); return g;
  },
  stones(h) {
    const g = new THREE.Group(), m = stoneM(0x8f8d86);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, x = Math.cos(a) * 9, z = Math.sin(a) * 9; const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.2, 0.9), m); s.position.set(x, h(x, z) + 1.9, z); s.rotation.y = -a; g.add(s);
      if (i % 2 === 0) { const a2 = a + Math.PI / 14, l = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 4.3), m); l.position.set(Math.cos(a2) * 9, h(x, z) + 4.3, Math.sin(a2) * 9); l.rotation.y = -a2; g.add(l); } }
    return g;
  },
  hoba(h) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, 2.7), mat(0x4a3a30, { roughness: 0.5, metalness: 0.3, flatShading: true })); b.position.y = 0.3; b.rotation.y = 0.4; g.add(b);
    return g;
  },
  // ---------- v6 discoveries ----------
  surveyor(h) {
    const g = new THREE.Group(), w = mat(0xd8d8d0), d = mat(0x444444);
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.1, 1.6, 3), w); frame.position.y = 1.4; g.add(frame);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), w); leg.position.set(Math.cos(a) * 1.1, 0.75, Math.sin(a) * 1.1); leg.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(leg); const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8), w); pad.position.set(Math.cos(a) * 1.6, 0.04, Math.sin(a) * 1.6); g.add(pad); }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.9), mat(0x1f3a6a)); panel.position.set(0, 2.7, 0); panel.rotation.x = 0.5; g.add(panel);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 5), d); mast.position.y = 2.2; g.add(mast);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), w); cam.position.set(0.7, 1.4, 0); g.add(cam);
    return g;
  },
  lunokhod(h) {
    const g = new THREE.Group(), tub = mat(0xc0c4c8, { metalness: 0.25 }), d = mat(0x2a2a2a);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 0.9, 16), tub); body.position.y = 1.05; body.scale.z = 1.3; g.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.06, 16), mat(0x1f3a6a)); lid.position.set(0, 1.62, 0.5); lid.rotation.x = -0.9; lid.scale.z = 1.3; g.add(lid);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 10), d); wh.rotation.z = Math.PI / 2; wh.position.set(s * 1.05, 0.4, -1.2 + k * 0.8); g.add(wh); }
    const ant = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.9, 6), tub); ant.position.set(0.5, 1.9, -0.8); g.add(ant);
    return g;
  },
  oppy(h) {
    const g = new THREE.Group(), w = mat(0xcfc6b8), d = mat(0x2a2a2a), p = mat(0x1d3566, { roughness: 0.3 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.4), w); box.position.y = 0.85; g.add(box);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 1.8), p); deck.position.y = 1.15; g.add(deck);
    for (const s of [-1, 1]) for (const z of [-0.6, 0, 0.6]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.18, 10), d); wh.rotation.z = Math.PI / 2; wh.position.set(s * 0.85, 0.25, z); g.add(wh); }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), w); mast.position.set(0.3, 1.6, -0.6); g.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.18), w); head.position.set(0.3, 2.05, -0.6); g.add(head);
    const dust = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.02, 1.82), mat(0xb0673a, { transparent: true, opacity: 0.55 })); dust.position.y = 1.18; g.add(dust);
    return g;
  },
  blueberries(h) {
    const g = new THREE.Group(), geo = new THREE.SphereGeometry(0.09, 6, 4), m = mat(0x3a3f4a, { roughness: 0.4 });
    for (let i = 0; i < 70; i++) { const r = Math.sqrt(Math.random()) * 3, a = Math.random() * 6.28, x = Math.cos(a) * r, z = Math.sin(a) * r; const b = new THREE.Mesh(geo, m); b.position.set(x, h(x, z) + 0.05, z); g.add(b); }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 1.4), stoneM(0xc8a070)); slab.position.set(0.6, 0.12, 0.4); slab.rotation.y = 0.5; g.add(slab);
    return g;
  },
  tessera(h) {
    const g = new THREE.Group(), m = stoneM(0x7a4e28);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) { const r = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2 + ((i * 7 + j * 3) % 5) * 0.6, 14), m); const x = (i - 4) * 2.6, z = (j - 1) * 4; r.position.set(x, h(x, z) + 0.6, z); r.rotation.set(0, 0.3 + j * 0.9, 0.12); g.add(r); }
    return g;
  },
  rays(h) {
    const g = new THREE.Group(), bright = mat(0xe8e2d8, { roughness: 1, emissive: 0x333028 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + (i % 3) * 0.1, L = 14 + (i % 4) * 5; const ray = new THREE.Mesh(new THREE.PlaneGeometry(1.6, L), bright); ray.rotation.set(-Math.PI / 2, 0, -a); const x = Math.sin(a) * (L / 2 + 4), z = Math.cos(a) * (L / 2 + 4); ray.position.set(x, h(x, z) + 0.08, z); g.add(ray); }
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(4, 2.5, 1.2, 16, 1, true), stoneM(0xbab2a6)); pit.position.y = 0.2; g.add(pit);
    return g;
  },
  barringer(h) {
    const g = new THREE.Group(), m = stoneM(0xb08a5a);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 2.4, 6, 28), m); rim.rotation.x = Math.PI / 2; rim.scale.z = 0.6; rim.position.y = 0.6; g.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 24), mat(0xc9a46c, { roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.2; g.add(floor);
    g.userData.beaconY = 3; return g;
  },
  tardigrade(h) {
    const g = new THREE.Group(), moss = mat(0x4f8a2e, { roughness: 1, flatShading: true });
    for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + (i % 3) * 0.2, 0), moss); m.position.set(Math.cos(i) * 1.4, 0.2, Math.sin(i * 1.3) * 1.4); m.scale.y = 0.5; g.add(m); }
    // a big friendly "hologram" of the microscopic animal living in the moss
    const holo = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const t = new THREE.Group(); t.position.y = 1.6; g.add(t);
    for (let k = 0; k < 4; k++) { const seg = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), holo); seg.position.z = -0.45 + k * 0.3; t.add(seg); for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.3, 5), holo); leg.position.set(s * 0.28, -0.28, -0.45 + k * 0.3); t.add(leg); } }
    g.userData.anim = (o, tt) => { t.rotation.y = tt * 0.6; t.position.y = 1.6 + Math.sin(tt * 2) * 0.1; };
    return g;
  },
  lineae(h) {
    const g = new THREE.Group(), m = mat(0x8a4a2a, { roughness: 1 });
    for (let i = 0; i < 3; i++) { const geo = new THREE.PlaneGeometry(1.2 + i * 0.4, 60, 1, 1); const c = new THREE.Mesh(geo, m); c.rotation.set(-Math.PI / 2, 0, 0.3 + i * 0.7); c.position.set(i * 2 - 2, h(i * 2 - 2, 0) + 0.06 + i * 0.01, 0); g.add(c); }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 50), mat(0xd9cfc0, { flatShading: true })); ridge.rotation.y = 0.3; ridge.position.set(-1.2, 0.2, 0); g.add(ridge);
    return g;
  },
  chaos(h) {
    const g = new THREE.Group(), m = mat(0xe9e4da, { roughness: 0.5, flatShading: true });
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(3 + (i % 3), 1.5 + (i % 2), 3 + ((i + 1) % 3)), m); const a = i * 2.4, r = 3 + (i % 4) * 2.5, x = Math.cos(a) * r, z = Math.sin(a) * r; b.position.set(x, h(x, z) + 0.4, z); b.rotation.set((i % 3 - 1) * 0.25, a, (i % 2 - 0.5) * 0.4); g.add(b); }
    const slush = new THREE.Mesh(new THREE.CircleGeometry(13, 20), mat(0x9a6a48, { roughness: 1 })); slush.rotation.x = -Math.PI / 2; slush.position.y = 0.05; g.add(slush);
    return g;
  },
  plume(h) {
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(3 + i * 2.2, 0.4, 36 - i * 6, 12, 1, true), m); c.position.y = (36 - i * 6) / 2; g.add(c); }
    const vent = new THREE.Mesh(new THREE.CircleGeometry(1.2, 12), mat(0x5a3a2a)); vent.rotation.x = -Math.PI / 2; vent.position.y = 0.05; g.add(vent);
    g.userData.anim = (o, t) => { o.children.forEach((c, i) => { if (i < 3) { c.rotation.y = t * (1 + i); c.scale.x = c.scale.z = 1 + Math.sin(t * 3 + i) * 0.08; } }); };
    g.userData.beaconY = 38; return g;
  },
  salt(h) {
    const g = new THREE.Group(), m = mat(0xe8d27a, { roughness: 0.7, emissive: 0x2a2200 });
    const patch = new THREE.Mesh(new THREE.CircleGeometry(4, 16), m); patch.rotation.x = -Math.PI / 2; patch.position.y = 0.05; g.add(patch);
    const cube = new THREE.BoxGeometry(0.35, 0.35, 0.35); for (let i = 0; i < 18; i++) { const c = new THREE.Mesh(cube, m); const a = i * 1.7, r = (i % 5) * 0.7; c.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r); c.rotation.y = a; g.add(c); }
    return g;
  },
  shore(h) {
    const g = new THREE.Group(), m = mat(0x8a6a3a);
    const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8), mat(0xff8a20)); buoy.position.y = 0.6; g.add(buoy);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd080 })); lamp.position.y = 1.3; g.add(lamp);
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.3), m); p.position.set(0, 0.04, -1 - i * 0.6); g.add(p); }
    return g;
  },
  huygens(h) {
    const g = new THREE.Group(), w = mat(0xd8c9a0, { metalness: 0.2 }), d = mat(0x6a5a40);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.3, 18, 8, 0, Math.PI * 2, 0, 1.1), w); shell.scale.y = 0.45; shell.position.y = 0.35; g.add(shell);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.15, 0.35, 18), d); base.position.y = 0.2; g.add(base);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 6, 0, Math.PI * 2, 0, 1.2), mat(0xe86a30, { side: THREE.DoubleSide, roughness: 0.9 })); chute.scale.y = 0.25; chute.position.set(3.2, 0.25, 1); chute.rotation.z = 0.15; g.add(chute);
    return g;
  },
  dunes(h) {
    const g = new THREE.Group(), m = mat(0x4a3220, { roughness: 1 });
    for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 40, 10, 1, false, 0, Math.PI), m); d.rotation.set(0, 0, Math.PI / 2); d.rotation.y = 0.2; d.scale.set(1, 1, 0.45); d.position.set(0, -0.4, (i - 2.5) * 6); d.rotation.x = Math.PI / 2; g.add(d); }
    return g;
  },
  lavalake(h) {
    const g = new THREE.Group(), hot = new THREE.MeshBasicMaterial({ color: 0xff5a14 }), crust = mat(0x1a1410, { roughness: 1, flatShading: true });
    const lake = new THREE.Mesh(new THREE.CircleGeometry(9, 24), hot); lake.rotation.x = -Math.PI / 2; lake.position.y = 0.06; g.add(lake);
    for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(1 + (i % 3) * 0.7, 6), crust); p.rotation.x = -Math.PI / 2; const a = i * 2.2, r = 2 + (i % 4) * 1.6; p.position.set(Math.cos(a) * r, 0.09, Math.sin(a) * r); g.add(p); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.9, 6, 24), crust); rim.rotation.x = Math.PI / 2; rim.position.y = 0.2; g.add(rim);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 6), new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.y = 0.25; g.add(glow);
    g.userData.anim = (o, t) => { glow.material.opacity = 0.16 + Math.sin(t * 1.7) * 0.06; };
    return g;
  },
  pele(h) {
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(2, 0.6, 30, 12, 1, true), m); col.position.y = 15; g.add(col);
    const umb = new THREE.Mesh(new THREE.SphereGeometry(18, 18, 6, 0, Math.PI * 2, 0, 1.2), m); umb.scale.y = 0.35; umb.position.y = 24; g.add(umb);
    const ring = new THREE.Mesh(new THREE.RingGeometry(10, 16, 28), mat(0xc84a20, { roughness: 1, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; g.add(ring);
    g.userData.anim = (o, t) => { col.rotation.y = t; umb.rotation.y = -t * 0.3; umb.scale.x = umb.scale.z = 1 + Math.sin(t * 2) * 0.05; };
    g.userData.beaconY = 32; return g;
  },
  sulfur(h) {
    const g = new THREE.Group(), y = mat(0xf2e04a, { roughness: 0.6, emissive: 0x2a2400, flatShading: true }), w = mat(0xf6f2dc, { flatShading: true });
    for (let i = 0; i < 16; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + (i % 4) * 0.12, 0), i % 3 ? y : w); const a = i * 2.1, r = (i % 5) * 0.6; c.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r); c.scale.y = 1.8; c.rotation.set(i * 0.3, a, 0.2); g.add(c); }
    return g;
  }
};
