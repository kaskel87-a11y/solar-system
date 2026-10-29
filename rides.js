// Dealer rides: low-poly builders for the five Red Line Motors models plus the customisation layer (paint, body kits,
// wheels, underglow) that works on any vehicle group, including your stock rover and modded kinds (Raccoon Mobile).
// Builders follow world.js VEHICLE_BUILDERS: fn({ R, mesh, build, sec }) -> { group, body, wheels, seat, paint }.
// Geometry and the glow texture are cached and flagged userData.shared so surface.exit()'s dispose pass leaves them alone.
import * as THREE from 'three';
import { PAINTS, KITS, WHEELS, GLOWS } from './garagecore.js';

const G = {}; // geometry cache
const sh = o => { o.userData.shared = true; return o; };
const geo = (key, fn) => G[key] || (G[key] = sh(fn()));
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.35, ...o });
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.userData.shared = true; return glowTex;
}
// side profile [z, y] extruded across the width (same trick as the v7.2 Roadster kit)
function extrude(key, pts, depth) {
  return geo(key, () => { const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 }); g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2); return g; });
}
// model shapes: hull profile, cabin glass, width, wheel slots [x, z, front], wheel radius, seat, turret height, length
const SHAPES = {
  dust_runner: { w: 2.3, hull: [[-2.5, 0.55], [-2.6, 1.05], [-1.6, 1.25], [1.9, 1.3], [2.35, 1.2], [2.4, 0.55]], cab: [[-1.55, 1.25], [-0.6, 2.05], [1.6, 2.1], [2.2, 1.3]],
    wheels: [[-1.12, -1.6, 1], [1.12, -1.6, 1], [-1.12, 1.6], [1.12, 1.6]], wr: 0.55, seat: 1.25, turret: 2.15, len: 5.0 },
  red_comet: { w: 2.25, hull: [[-2.8, 0.45], [-2.9, 0.75], [-1.2, 1.05], [1.6, 1.12], [2.75, 1.0], [2.8, 0.45]], cab: [[-1.0, 1.05], [-0.1, 1.6], [1.0, 1.6], [1.9, 1.1]],
    wheels: [[-1.1, -1.75, 1], [1.1, -1.75, 1], [-1.1, 1.7], [1.1, 1.7]], wr: 0.5, seat: 0.95, turret: 1.7, len: 5.7, spoiler: true },
  ares_brute: { w: 2.7, hull: [[-3.1, 0.75], [-3.2, 1.5], [-2.2, 1.65], [3.05, 1.65], [3.1, 0.75]], cab: [[-2.1, 1.65], [-1.3, 2.6], [0.4, 2.6], [0.6, 1.65]],
    wheels: [[-1.35, -2.0, 1], [1.35, -2.0, 1], [-1.35, 0.4], [1.35, 0.4], [-1.35, 2.2], [1.35, 2.2]], wr: 0.7, seat: 1.6, turret: 2.75, len: 6.4, bed: true, bar: true },
  olympus_gt: { w: 2.35, hull: [[-3.1, 0.45], [-3.15, 0.8], [-1.0, 1.0], [1.8, 1.1], [3.0, 0.95], [3.05, 0.45]], cab: [[-0.7, 1.0], [0.3, 1.55], [1.4, 1.55], [2.3, 1.05]],
    wheels: [[-1.15, -2.05, 1], [1.15, -2.05, 1], [-1.15, 1.95], [1.15, 1.95]], wr: 0.52, seat: 0.95, turret: 1.75, len: 6.2, spoiler: true },
  phobos_phantom: { w: 2.2, hull: [[-2.7, 0.35], [-2.8, 0.7], [-0.8, 1.0], [1.6, 1.05], [2.6, 0.8], [2.65, 0.35]], cab: [[-0.9, 0.98], [0.1, 1.5], [1.1, 1.5], [1.8, 1.0]],
    wheels: [], wr: 0, seat: 0.85, turret: 1.6, len: 5.4, hover: true }
};
export const shapeOf = kind => SHAPES[kind] || null;
const FACTORY = { dust_runner: 0xd86a2a, red_comet: 0xb0101a, ares_brute: 0x4a5a3a, olympus_gt: 0x1e2c48, phobos_phantom: 0x2a2a34 };
export const factoryColor = kind => FACTORY[kind] ?? 0x9aa0a8;

function wheel(wr, w = 0.5) {
  const tire = geo('tire' + wr, () => { const g = new THREE.CylinderGeometry(wr, wr, w, 14); g.rotateZ(Math.PI / 2); return g; });
  const hub = geo('hub' + wr, () => { const g = new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, w + 0.04, 8); g.rotateZ(Math.PI / 2); return g; });
  return { tire, hub };
}
export function buildRide(kind) {
  const S = SHAPES[kind]; const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.rotation.order = 'YXZ';
  const paint = M(factoryColor(kind), { metalness: 0.55, roughness: 0.3 }), dark = M(0x16171b, { roughness: 0.8, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.8 });
  const hull = new THREE.Mesh(extrude(kind + 'hull', S.hull, S.w), paint); body.add(hull);
  const cab = new THREE.Mesh(extrude(kind + 'cab', S.cab, S.w - 0.5), glass); cab.renderOrder = 2; body.add(cab);
  const skirt = new THREE.Mesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), dark); skirt.scale.set(S.w + 0.1, 0.22, S.len - 0.4); skirt.position.y = S.hull[0][1] + 0.08; body.add(skirt);
  const lightG = geo('lightbar', () => new THREE.BoxGeometry(1, 0.06, 0.05));
  const head = new THREE.Mesh(lightG, new THREE.MeshBasicMaterial({ color: 0xfff6dc })); head.scale.x = S.w * 0.85; head.position.set(0, S.hull[1][1] - 0.12, S.hull[0][0] - 0.12); body.add(head);
  const tail = new THREE.Mesh(lightG, new THREE.MeshBasicMaterial({ color: 0xff1a1a })); tail.scale.x = S.w * 0.9; tail.position.set(0, S.hull[S.hull.length - 2][1] - 0.1, S.hull[S.hull.length - 1][0] + 0.1); body.add(tail);
  if (S.bed) { const bed = new THREE.Mesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), dark); bed.scale.set(S.w - 0.3, 0.12, 2.3); bed.position.set(0, 1.7, 1.8); body.add(bed); }
  if (S.bar) { const bar = new THREE.Mesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), M(0x2a2c30, { metalness: 0.7 })); bar.scale.set(S.w + 0.2, 0.5, 0.18); bar.position.set(0, 1.0, -3.25); body.add(bar); }
  if (S.spoiler) { const sp = new THREE.Mesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), paint); sp.scale.set(S.w - 0.2, 0.05, 0.32); sp.position.set(0, S.hull[3][1] + 0.18, S.hull[4][0] - 0.1); body.add(sp); }
  const wheels = [];
  if (S.hover) { // mag pads instead of wheels
    const padM = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.85 }), pg = geo('pad', () => { const c = new THREE.CylinderGeometry(0.42, 0.5, 0.14, 12); return c; });
    for (const [x, z] of [[-0.85, -1.7], [0.85, -1.7], [-0.85, 1.6], [0.85, 1.6]]) { const p = new THREE.Mesh(pg, padM); p.position.set(x, 0.28, z); body.add(p); }
  } else {
    const { tire, hub } = wheel(S.wr), tireM = M(0x161618, { roughness: 0.95, metalness: 0 }), hubM = M(WHEELS.stock.rim, { metalness: 0.7, roughness: 0.3 });
    for (const [x, z, front] of S.wheels) {
      const pivot = new THREE.Group(); pivot.position.set(x, S.wr, z); g.add(pivot); const spin = new THREE.Group(); pivot.add(spin);
      spin.add(new THREE.Mesh(tire, tireM), new THREE.Mesh(hub, hubM)); wheels.push({ x, z, pivot, spin, front: !!front });
    }
    g.userData.hubM = hubM;
  }
  const seat = new THREE.Object3D(); seat.position.set(0.45, S.seat, -0.3); body.add(seat);
  g.userData.ride = { kind, shape: S, paint };
  return { group: g, body, wheels, seat, paint };
}

// ---------- customisation layer (works on any { group, body, wheels } vehicle) ----------
// ride: { paint, kit, wheels, glow } ids from garagecore; opts.paintMat: the material to recolour; opts.dims: { w, len, y }
export function decorate(v, ride, opts = {}) {
  const g = v.group, ud = g.userData; ud.deco ||= {};
  const S = ud.ride?.shape, dims = opts.dims || (S ? { w: S.w, len: S.len, y: S.hull[1][1], roof: Math.max(...S.cab.map(p => p[1])), tail: S.hull[S.hull.length - 1][0], nose: S.hull[0][0] } : { w: 2.6, len: 6, y: 1.6, roof: 2.8, tail: 3.0, nose: -3.1 });
  // paint
  const pm = opts.paintMat || ud.ride?.paint || v.paint;
  if (pm && opts.paint !== false) { const p = PAINTS[ride.paint] || PAINTS.factory; pm.color.setHex(p.color ?? opts.factory ?? factoryColor(ud.ride?.kind));
    pm.metalness = p.metal ? 0.95 : p.rough ? 0.05 : 0.55; pm.roughness = p.metal ? 0.12 : p.rough ? 0.85 : 0.3; }
  // body kit
  if (ud.deco.kitId !== ride.kit) {
    if (ud.deco.kit) { ud.deco.kit.parent?.remove(ud.deco.kit); ud.deco.kit = null; }
    ud.deco.kitId = ride.kit;
    if (ride.kit && ride.kit !== 'stock' && KITS[ride.kit]) { const k = buildKit(ride.kit, dims, pm); (v.body || g).add(k); ud.deco.kit = k; }
  }
  if (ud.deco.kit && pm) ud.deco.kit.traverse(o => { if (o.isMesh && o.userData.painted) o.material = pm; });
  // wheels: rim colour and size
  const wd = WHEELS[ride.wheels] || WHEELS.stock;
  const hubs = new Set(); if (ud.hubM) hubs.add(ud.hubM);
  for (const w of v.wheels || []) { w.spin.children.forEach((m, i) => { if (i > 0 && m.isMesh && m.material?.isMaterial && !m.material.userData.shared) hubs.add(m.material); }); w.pivot.scale.setScalar(opts.wheelScale === false ? 1 : (wd.scale || 1)); }
  for (const h of hubs) { h.color.setHex(wd.rim); h.metalness = ride.wheels === 'black' ? 0.2 : 0.85; h.roughness = 0.25; }
  // underglow: one additive quad under the car (no real light: cheap on phones)
  const gl = GLOWS[ride.glow] || GLOWS.none;
  if (!ud.deco.glow && gl.color != null) {
    const q = new THREE.Mesh(geo('glowq', () => { const p = new THREE.PlaneGeometry(1, 1); p.rotateX(-Math.PI / 2); return p; }),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: gl.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    q.scale.set(dims.w + 2.4, 1, dims.len + 2.4); q.position.y = 0.06; q.renderOrder = 1; g.add(q); ud.deco.glow = q;
  }
  if (ud.deco.glow) { ud.deco.glow.visible = gl.color != null; if (gl.color != null) ud.deco.glow.material.color.setHex(gl.color); }
  return v;
}
function buildKit(id, d, pm) {
  const k = new THREE.Group(), box = geo('box', () => new THREE.BoxGeometry(1, 1, 1)), dark = M(0x121215, { roughness: 0.7 });
  const add = (m, sx, sy, sz, x, y, z, painted) => { const o = new THREE.Mesh(box, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); if (painted) o.userData.painted = true; k.add(o); return o; };
  if (id === 'street') {
    add(dark, d.w + 0.05, 0.1, 0.4, 0, 0.42, d.nose - 0.05);                     // front lip
    for (const s of [-1, 1]) add(dark, 0.1, 0.16, d.len * 0.62, s * (d.w / 2 + 0.06), 0.5, 0); // side skirts
    add(pm, d.w - 0.3, 0.06, 0.42, 0, d.y + 0.45, d.tail - 0.3, true);           // ducktail spoiler
    for (const s of [-1, 1]) add(dark, 0.06, 0.4, 0.1, s * 0.75, d.y + 0.22, d.tail - 0.3);
  } else if (id === 'widebody') {
    for (const s of [-1, 1]) for (const z of [-d.len * 0.3, d.len * 0.3]) add(pm, 0.3, 0.42, 1.5, s * (d.w / 2 + 0.12), 0.9, z, true); // fender flares
    add(dark, d.w + 0.5, 0.06, 0.6, 0, d.y + 0.75, d.tail - 0.35);                // GT wing
    for (const s of [-1, 1]) add(dark, 0.08, 0.7, 0.14, s * 0.9, d.y + 0.38, d.tail - 0.35);
    add(dark, d.w + 0.35, 0.08, 0.5, 0, 0.36, d.nose - 0.1);                      // splitter
  } else if (id === 'rally') {
    add(M(0x2a2c30, { metalness: 0.7 }), d.w + 0.1, 0.55, 0.14, 0, 0.95, d.nose - 0.25); // bull bar
    add(dark, d.w * 0.7, 0.08, 1.4, 0, (d.roof || d.y + 0.9) + 0.08, 0.3);                // roof rack
    const lm = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    for (let i = -1.5; i <= 1.5; i++) add(lm, 0.28, 0.2, 0.08, i * 0.4, (d.roof || d.y + 0.9) + 0.22, -0.4);
    for (const s of [-1, 1]) add(dark, 0.18, 0.18, 1.6, s * (d.w / 2 + 0.12), 0.75, 0);  // rock sliders
  }
  return k;
}
