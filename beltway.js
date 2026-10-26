// v7.5.4 Beltway life (Ben). Makes the Ares Beltway feel like a real highway:
//  - dense pooled traffic (InstancedMesh, ~9 draw calls) with lane AI: lane keeping, IDM following distance, lane changes,
//    braking for wrecks, booths, the player and the core traffic cars. Density follows the quality tier (phones: med).
//  - carjacking: on foot next to a stopped or crawling car, hold ✊ (or I) to win a short struggle; the driver flees or
//    fights back, you take the car, heat rises.
//  - armored convoys: a truck with two escorts. Ram the truck until it's dead in the road, crack the back doors (Ben's
//    safecrack minigame, easy tier, short timer), take the cash. Heat spikes through SSX.pursuit if it has a spike API,
//    else the core world.crime / setWanted path.
//  - pileups with pooled sparks and debris, and toll booths you can pay at, run (1★) or shake down (cash, 2★).
// Sits on public hooks only: SSX.registerSurfaceTick, surface.world.highway() / spawnVehicle (one line in world.js),
// registerVehicle, npcBudget / npcReserve, SSX.city, SSX.heist.safeCrack. Every outside call is guarded.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerVehicle } from './world.js';
import { safeCrack as localSafeCrack } from './safecrack.js';
import * as BC from './beltwaycore.js';

const W = () => window, SSX = () => W().SSX, APP = () => W().__app;
const surf = () => APP()?.surface, wld = () => surf()?.world, game = () => surf()?.game;
const toast = (t, ms = 2600) => { try { APP()?.toast?.(t, ms); } catch (e) { /* hud not up */ } };
const isTouch = () => typeof document !== 'undefined' && document.body.classList.contains('touch');
const listeners = {};
function emit(evt, d = {}) {
  for (const f of [...(listeners[evt] || []), ...(listeners['*'] || [])]) { try { f.length > 1 || evt === '*' ? f(evt, d) : f(d); } catch (e) { console.warn('beltway listener', e); } }
  try { SSX()?.emit?.('beltway:' + evt, d); } catch (e) { /* bus not up */ }
}

// ---------- heat: SSX.pursuit (Marsmania #42) if it exposes a raise; else the core crime / setWanted path ----------
export function heat(n, why) {
  const P = SSX()?.pursuit, w = wld();
  try {
    if (typeof P?.spike === 'function') { P.spike(n, why); return 'pursuit.spike'; }
    if (typeof P?.addHeat === 'function') { P.addHeat(n, why); return 'pursuit.addHeat'; }
    if (typeof P?.raise === 'function') { P.raise(n, why); return 'pursuit.raise'; }
  } catch (e) { console.warn('beltway heat', e); }
  if (!w) return 'none';
  const before = w.wanted | 0;
  w.crime?.(n, why);
  if ((w.wanted | 0) < n) w.setWanted?.(Math.min(5, Math.max(n, before)), why); // crime() has a cooldown and needs the colony
  return 'crime';
}
const heatAtLeast = (n, why) => { const w = wld(); if (w && (w.wanted | 0) < n) heat(n, why); };

// ---------- geometry: one merged body / detail / lights geometry per kind, used both instanced and as drivable cars ----------
const G = {};
function box(w, h, l, x, y, z, color) { const g = new THREE.BoxGeometry(w, h, l); g.translate(x, y, z); return paint(g, color); }
function cyl(r, w, x, y, z, color) { const g = new THREE.CylinderGeometry(r, r, w, 12); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return paint(g, color); }
function paint(g, color) { const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const GLASS = 0x1a2430, TIRE = 0x15161a, RIM = 0x7d828a, TRIM = 0x2a2c31, HEAD = 0xfff4d6, TAIL = 0xff2a2a, AMBER = 0xffa020, STEEL = 0x4b5058;
function shapes(kind) {
  const B = [], D = [], L = [], wheels = []; let seat = [0.4, 1.05, 0.1];
  const lights = (w, y, zf, zb, hw = 0.32) => { for (const s of [-1, 1]) { L.push(box(hw, 0.13, 0.06, s * (w / 2 - 0.3), y, zf, HEAD), box(hw, 0.13, 0.06, s * (w / 2 - 0.3), y, zb, TAIL)); } };
  if (kind === 'sedan') {
    B.push(box(1.85, 0.5, 4.4, 0, 0.6, 0), box(1.6, 0.08, 1.9, 0, 1.38, 0.25));
    D.push(box(1.62, 0.5, 2.2, 0, 1.1, 0.2, GLASS), box(1.9, 0.22, 0.25, 0, 0.42, -2.18, TRIM), box(1.9, 0.22, 0.25, 0, 0.42, 2.18, TRIM), box(1.88, 0.06, 2.6, 0, 0.36, 0, TRIM));
    lights(1.85, 0.68, -2.22, 2.22); for (const [x, z] of [[-0.86, -1.4], [0.86, -1.4], [-0.86, 1.4], [0.86, 1.4]]) wheels.push([x, z, 0.36]);
  } else if (kind === 'van') {
    B.push(box(2.0, 1.55, 5.2, 0, 1.25, 0.1), box(1.95, 0.45, 0.9, 0, 0.75, -2.55));
    D.push(box(1.84, 0.62, 0.08, 0, 1.55, -2.47, GLASS), box(2.04, 0.55, 1.2, 0, 1.6, -1.8, GLASS), box(2.05, 0.24, 0.25, 0, 0.46, -2.98, TRIM), box(2.05, 0.24, 0.2, 0, 0.46, 2.72, TRIM));
    lights(2.0, 0.85, -3.0, 2.72); for (const [x, z] of [[-0.92, -1.75], [0.92, -1.75], [-0.92, 1.7], [0.92, 1.7]]) wheels.push([x, z, 0.4]); seat = [0.45, 1.5, -1.6];
  } else if (kind === 'hauler') {
    B.push(box(2.3, 1.55, 1.9, 0, 1.45, -2.65), box(2.2, 0.35, 0.6, 0, 0.75, -3.5));
    D.push(box(2.0, 0.65, 0.08, 0, 1.85, -3.61, GLASS), box(2.42, 2.3, 5.0, 0, 1.85, 0.95, 0xcfd2d4), box(2.44, 0.1, 5.02, 0, 3.0, 0.95, 0x9a9ea2), box(2.3, 0.3, 7.0, 0, 0.55, 0, TRIM));
    lights(2.3, 0.9, -3.82, 3.46); for (const [x, z] of [[-1.05, -2.6], [1.05, -2.6], [-1.05, 1.4], [1.05, 1.4], [-1.05, 2.6], [1.05, 2.6]]) wheels.push([x, z, 0.5]); seat = [0.5, 2.0, -2.6];
  } else if (kind === 'armored') {
    B.push(box(2.5, 2.4, 6.6, 0, 1.75, 0), box(2.3, 0.5, 1.0, 0, 0.9, -3.6));
    D.push(box(2.1, 0.55, 0.08, 0, 2.3, -3.32, GLASS), box(2.56, 0.12, 6.4, 0, 1.0, 0, STEEL), box(2.56, 0.12, 6.4, 0, 2.6, 0, STEEL), box(2.2, 2.0, 0.08, 0, 1.75, 3.32, 0x3a3f47), box(0.06, 2.0, 0.1, 0, 1.75, 3.37, 0x15171a));
    L.push(box(1.6, 0.14, 0.3, 0, 3.02, -2.6, AMBER)); lights(2.5, 1.0, -4.12, 3.34); for (const [x, z] of [[-1.1, -2.5], [1.1, -2.5], [-1.1, 1.5], [1.1, 1.5], [-1.1, 2.6], [1.1, 2.6]]) wheels.push([x, z, 0.55]);
  } else { // escort SUV
    B.push(box(2.0, 0.95, 4.8, 0, 0.95, 0), box(1.85, 0.08, 2.6, 0, 1.92, 0.4));
    D.push(box(1.86, 0.48, 2.9, 0, 1.65, 0.35, GLASS), box(2.05, 0.26, 0.3, 0, 0.5, -2.4, TRIM), box(2.05, 0.26, 0.3, 0, 0.5, 2.4, TRIM));
    L.push(box(1.2, 0.12, 0.25, 0, 2.02, -0.2, AMBER)); lights(2.0, 0.95, -2.42, 2.42); for (const [x, z] of [[-0.92, -1.55], [0.92, -1.55], [-0.92, 1.55], [0.92, 1.55]]) wheels.push([x, z, 0.42]); seat = [0.45, 1.4, 0.2];
  }
  return { B, D, L, wheels, seat };
}
function geoms(kind) {
  if (G[kind]) return G[kind];
  const S = shapes(kind), W2 = S.wheels.flatMap(([x, z, r]) => [cyl(r, 0.28, x, r, z, TIRE), cyl(r * 0.55, 0.3, x, r, z, RIM)]);
  G[kind] = { body: mergeGeometries(S.B), detail: mergeGeometries(S.D), detailW: mergeGeometries([...S.D, ...W2]), light: mergeGeometries(S.L), wheels: S.wheels, seat: S.seat,
    wheel: mergeGeometries([cyl(1, 0.28 / 1, 0, 0, 0, TIRE), cyl(0.55, 0.3, 0, 0, 0, RIM)]) };
  return G[kind];
}
const MAT = {};
function mats() {
  if (MAT.ok) return MAT; MAT.ok = true; const sh = m => { m.userData.shared = true; return m; };
  MAT.body = sh(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.55 }));
  MAT.detail = sh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 }));
  MAT.light = sh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  MAT.armor = sh(new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.55, metalness: 0.75 }));
  MAT.escort = sh(new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.3, metalness: 0.6 }));
  MAT.paints = {}; MAT.booth = sh(new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.6, metalness: 0.3 }));
  MAT.boothGlass = sh(new THREE.MeshStandardMaterial({ color: 0x9ad8ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.45 }));
  MAT.stripe = sh(new THREE.MeshStandardMaterial({ color: 0xffc42a, roughness: 0.6, emissive: 0x332200 }));
  MAT.lamp = sh(new THREE.MeshBasicMaterial({ color: 0xfff1c8 }));
  MAT.skin = [0xc89a74, 0x8d5a3b, 0xe2b896, 0x5e3a26].map(c => sh(new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })));
  MAT.cloth = [0x2a3346, 0x5a2a2a, 0x3f4a3a, 0x6b6f78, 0x1c1c22].map(c => sh(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })));
  MAT.cash = sh(new THREE.MeshStandardMaterial({ color: 0x3e7b45, roughness: 0.7, emissive: 0x0a2a10 }));
  return MAT;
}
const paintMat = c => MAT.paints[c] ||= Object.assign(new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.55 }), { userData: { shared: true } });
// a drivable copy (what you drive away in after a carjack): same shapes, real wheels for world.js
let nextPaint = 0xbfc4ca;
function buildDrivable(kind) {
  mats(); const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.rotation.order = 'YXZ'; const Q = geoms(kind), pm = paintMat(nextPaint);
  body.add(new THREE.Mesh(Q.body, pm), new THREE.Mesh(Q.detail, MAT.detail), new THREE.Mesh(Q.light, MAT.light));
  const seat = new THREE.Object3D(); seat.position.set(...Q.seat); body.add(seat);
  const wheels = Q.wheels.map(([x, z, r]) => { const pivot = new THREE.Group(); pivot.position.set(x, r, z); g.add(pivot); const spin = new THREE.Group(); pivot.add(spin); const m = new THREE.Mesh(Q.wheel, MAT.detail); m.scale.set(r, r, r); spin.add(m); return { x, z, pivot, spin, front: z < 0 }; });
  return { group: g, body, wheels, seat, paint: pm };
}
let vehiclesRegistered = false;
function registerKinds() {
  if (vehiclesRegistered) return; vehiclesRegistered = true;
  try {
    registerVehicle('bw-sedan', { name: 'Commuter sedan', vmax: 24, boost: 34, acc: 11, bacc: 16, turn: 1.6, wy: 0.36, wr: 0.36, r: 2.2 }, () => buildDrivable('sedan'));
    registerVehicle('bw-van', { name: 'Cargo van', vmax: 19, boost: 27, acc: 8, bacc: 12, turn: 1.3, wy: 0.4, wr: 0.4, r: 2.6, tough: true }, () => buildDrivable('van'));
  } catch (e) { console.warn('beltway vehicles', e); }
}
function person(i) {
  mats(); const g = new THREE.Group(), skin = MAT.skin[i % MAT.skin.length], cl = MAT.cloth[i % MAT.cloth.length];
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), cl); torso.position.y = 1.22;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin); head.position.y = 1.72;
  const legs = [-1, 1].map(s => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.82, 0.18), MAT.cloth[(i + 4) % MAT.cloth.length]); l.geometry.translate(0, -0.41, 0); l.position.set(s * 0.12, 0.9, 0); return l; });
  const arms = [-1, 1].map(s => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.14), cl); a.geometry.translate(0, -0.3, 0); a.position.set(s * 0.31, 1.5, 0); return a; });
  g.add(torso, head, ...legs, ...arms); return { g, legs, arms };
}

// ---------- state ----------
const S = {
  on: true, ready: false, hw: null, len: 0, closed: true, scene: null, root: null, cars: [], nextId: 1, tier: 'med', tierOverride: null, scale: 1, fpsE: 60, frameMs: 0,
  ps: 0, pd: 1e9, projT: 0, inst: {}, sparks: null, debris: null, wrecks: [], booths: [], convoy: null, convoyT: 40, drivers: [], jack: null, avoid: [], coreTraffic: [], coreT: 0,
  stats: { crashes: 0, pileups: 0, carjacks: 0, jackFails: 0, fights: 0, convoys: 0, convoyLoot: 0, rams: 0, tollsPaid: 0, tollRuns: 0, shakedowns: 0 }, time: 0, ui: null, act: null, hold: false, holdT: 0,
  lastPileupT: -99, isMobile: false, force: {}, lastCar: null, reserve: 0
};
const tierNow = () => BC.pickTier({ override: S.tierOverride || urlTier(), app: appTier(), stored: storedTier(), mobile: S.isMobile });
const urlTier = () => { try { return new URLSearchParams(location.search).get('beltway'); } catch (e) { return null; } };
const storedTier = () => { try { return localStorage.getItem('ssx-quality') || localStorage.getItem('ssx-gfx-tier'); } catch (e) { return null; } };
function appTier() { const s = SSX(); try { const q = s?.quality ?? s?.gfx ?? s?.graphics; const v = typeof q?.tier === 'function' ? q.tier() : q?.tier ?? (typeof q?.get === 'function' ? q.get() : q?.level); return typeof v === 'string' ? v : null; } catch (e) { return null; } }

// ---------- road helpers ----------
function roadPose(s, dir, lat) { const p = S.hw.at(s), fx = p.fx * dir, fz = p.fz * dir, rx = -fz, rz = fx; return { x: p.x + rx * lat, z: p.z + rz * lat, fx, fz, rx, rz }; }
const inCore = (x, z) => S.avoid.some(a => a.core && Math.hypot(x - a.x, z - a.z) < a.r);

function buildInstances(scene) {
  mats(); const root = new THREE.Group(); root.name = 'beltway'; scene.add(root); S.root = root;
  const cap = Math.max(BC.TIERS.high.desktop, 8);
  for (const k of ['sedan', 'van', 'hauler']) {
    const Q = geoms(k), mk = (geo, m) => { const im = new THREE.InstancedMesh(geo, m, cap); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(im); return im; };
    const body = mk(Q.body, MAT.body); body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); body.instanceColor.setUsage(THREE.DynamicDrawUsage);
    S.inst[k] = { body, detail: mk(Q.detailW, MAT.detail), light: mk(Q.light, MAT.light) };
  }
  // sparks: one Points cloud; debris: one InstancedMesh of chips. Both fixed pools.
  const T = BC.TIERS[S.tier], n = T.sparks, pos = new Float32Array(n * 3).fill(-9999), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb040, size: 0.22, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; root.add(pts);
  S.sparks = { pts, pos, v: new Float32Array(n * 3), life: new Float32Array(n), n, next: 0, live: 0 };
  const dn = T.debris, dm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.5 }), dn); dm.frustumCulled = false; dm.count = dn; root.add(dm);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < dn; i++) dm.setMatrixAt(i, zero);
  S.debris = { mesh: dm, n: dn, p: new Float32Array(dn * 3), v: new Float32Array(dn * 3), r: new Float32Array(dn * 3), life: new Float32Array(dn), next: 0, live: 0 };
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
function burst(x, y, z, n = 18, power = 1) {
  const P = S.sparks; if (!P) return; for (let i = 0; i < n; i++) { const k = P.next; P.next = (P.next + 1) % P.n;
    P.pos[k * 3] = x; P.pos[k * 3 + 1] = y; P.pos[k * 3 + 2] = z; const a = Math.random() * Math.PI * 2, sp = (3 + Math.random() * 7) * power;
    P.v[k * 3] = Math.cos(a) * sp; P.v[k * 3 + 1] = 2 + Math.random() * 5 * power; P.v[k * 3 + 2] = Math.sin(a) * sp; P.life[k] = 0.35 + Math.random() * 0.5; }
  const D = S.debris, m = Math.max(2, Math.round(n / 5)); for (let i = 0; i < m; i++) { const k = D.next; D.next = (D.next + 1) % D.n;
    D.p[k * 3] = x; D.p[k * 3 + 1] = y; D.p[k * 3 + 2] = z; D.v[k * 3] = (Math.random() - 0.5) * 9 * power; D.v[k * 3 + 1] = 3 + Math.random() * 4; D.v[k * 3 + 2] = (Math.random() - 0.5) * 9 * power;
    D.r[k * 3] = Math.random() * 6; D.r[k * 3 + 1] = Math.random() * 6; D.r[k * 3 + 2] = Math.random() * 6; D.life[k] = 2.5 + Math.random() * 2; }
}
function fx(dt, height) {
  const P = S.sparks; let live = 0;
  if (P) { for (let k = 0; k < P.n; k++) { if (P.life[k] <= 0) continue; P.life[k] -= dt; if (P.life[k] <= 0) { P.pos[k * 3 + 1] = -9999; continue; } live++;
      P.v[k * 3 + 1] -= 14 * dt; P.pos[k * 3] += P.v[k * 3] * dt; P.pos[k * 3 + 1] += P.v[k * 3 + 1] * dt; P.pos[k * 3 + 2] += P.v[k * 3 + 2] * dt; }
    P.live = live; P.pts.geometry.attributes.position.needsUpdate = true; }
  const D = S.debris; let dl = 0;
  if (D) { for (let k = 0; k < D.n; k++) { if (D.life[k] <= 0) continue; D.life[k] -= dt; if (D.life[k] <= 0) { D.mesh.setMatrixAt(k, _m.makeScale(0, 0, 0)); continue; } dl++;
      const gy = height(D.p[k * 3], D.p[k * 3 + 2]) + 0.04; D.v[k * 3 + 1] -= 12 * dt; D.p[k * 3] += D.v[k * 3] * dt; D.p[k * 3 + 1] += D.v[k * 3 + 1] * dt; D.p[k * 3 + 2] += D.v[k * 3 + 2] * dt;
      if (D.p[k * 3 + 1] < gy) { D.p[k * 3 + 1] = gy; D.v[k * 3] *= 0.5; D.v[k * 3 + 2] *= 0.5; D.v[k * 3 + 1] = Math.abs(D.v[k * 3 + 1]) * 0.25; } else { D.r[k * 3] += dt * 8; D.r[k * 3 + 2] += dt * 6; }
      _e.set(D.r[k * 3], D.r[k * 3 + 1], D.r[k * 3 + 2]); _q.setFromEuler(_e); _p.set(D.p[k * 3], D.p[k * 3 + 1], D.p[k * 3 + 2]); _s.set(1, 1, 1); D.mesh.setMatrixAt(k, _m.compose(_p, _q, _s)); }
    D.live = dl; D.mesh.instanceMatrix.needsUpdate = true; }
}

// ---------- traffic ----------
function newCar(kind, s, dir, lane, o = {}) {
  const K = BC.KINDS[kind], c = { id: S.nextId++, kind, K, s, dir, lane, lat: BC.LANES[lane], v: o.v ?? 0, v0: o.v0 ?? (K.vmax[0] + Math.random() * (K.vmax[1] - K.vmax[0])), state: 'drive', cool: 2 + Math.random() * 3,
    wreckT: 0, yaw: 0, yawOff: 0, roll: 0, x: 0, z: 0, y: 0, color: o.color ?? BC.PAINTS[(Math.random() * BC.PAINTS.length) | 0], convoy: o.convoy || null, group: o.group || null, hp: o.hp ?? 0 };
  const p = roadPose(s, dir, c.lat); c.x = p.x; c.z = p.z; c.yaw = Math.atan2(-p.fx, -p.fz); S.cars.push(c); return c;
}
function laneFree(s, dir, lane, gap = 14, skip) { return !S.cars.some(o => o !== skip && o.dir === dir && o.lane === lane && o.state !== 'gone' && Math.abs(BC.gapAlong(s, o.s, dir, S.len, S.closed)) < gap); }
function trafficCount() { let n = 0; for (const c of S.cars) if (!c.convoy && c.state !== 'gone') n++; return n; }
function spawnSome(target, initial) {
  const R = S.isMobile ? 200 : 260; let tries = 0;
  while (trafficCount() < target && tries++ < 6) {
    const dir = Math.random() < 0.5 ? 1 : -1, lane = Math.random() < 0.55 ? 0 : 1;
    const off = initial ? (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * (R - 60)) : (Math.random() < 0.5 ? -1 : 1) * (R - 40 + Math.random() * 40);
    const s = BC.wrapS(S.ps + off, S.len, S.closed); if (!S.closed && (s < 5 || s > S.len - 5)) continue;
    const p = roadPose(s, dir, BC.LANES[lane]); if (inCore(p.x, p.z) || !laneFree(s, dir, lane, 16)) continue;
    const kind = BC.pickKind(Math.random()); newCar(kind, s, dir, lane, { v: 0 }).v = BC.KINDS[kind].vmax[0] * 0.8;
  }
}
// what's ahead of car c in lane `lane`: nearest car, the player, core traffic. Returns { gap, v }
function leaderIn(c, lane, behind = false) {
  let best = 1e9, bv = 0, bc = null; const lat = BC.LANES[lane];
  for (const o of S.cars) {
    if (o === c || o.dir !== c.dir || o.state === 'gone') continue;
    const inLane = o.lane === lane || Math.abs(o.lat - lat) < 1.3; if (!inLane) continue;
    let g = BC.gapAlong(c.s, o.s, c.dir, S.len, S.closed); if (behind) g = -g; g -= (c.K.len + o.K.len) / 2;
    if (g > -((c.K.len + o.K.len) / 2) && g < best) { best = g; bc = o; bv = o.state === 'drive' || o.state === 'jacking' ? o.v : 0; }
  }
  return { gap: best, v: bv, car: bc };
}
function obstacleGap(c, lat, list) { // generic world-space obstacles (player, core traffic): along-road gap ahead in this lane
  let best = 1e9, bv = 0; const p = roadPose(c.s, c.dir, c.lat);
  for (const o of list) { const dx = o.x - c.x, dz = o.z - c.z, f = dx * p.fx + dz * p.fz; if (f <= 0 || f > 60) continue;
    const l = dx * p.rx + dz * p.rz; if (Math.abs(l - (lat - c.lat)) > (o.w || 1.2) + c.K.w / 2) continue;
    const g = f - c.K.len / 2 - (o.len || 1) / 2; if (g < best) { best = g; bv = Math.max(0, o.vf ?? 0); } }
  return { gap: best, v: bv };
}
function boothSlow(c) { for (const b of S.booths) { const g = BC.gapAlong(c.s, b.s, c.dir, S.len, S.closed); if (g > -6 && g < BC.TOLL.slowS + c.v * 1.2) return BC.TOLL.slowV + Math.max(0, -g) * 0.5; } return 1e9; }
function wreck(c, closing, why) {
  if (c.state === 'wreck' || c.state === 'gone') return;
  c.state = 'wreck'; c.wreckT = 0; c.v = 0; c.yawOff = (Math.random() - 0.5) * Math.min(1.4, closing / 12); c.roll = (Math.random() - 0.5) * 0.12;
  S.stats.crashes++; burst(c.x, c.y + 0.7, c.z, Math.min(40, 10 + closing * 1.6), Math.min(1.6, 0.6 + closing / 20));
  S.wrecks.push({ t: S.time, x: c.x, z: c.z }); if (S.wrecks.length > 24) S.wrecks.shift();
  emit('crash', { id: c.id, kind: c.kind, closing: +closing.toFixed(1), why: why || 'traffic' });
  if (S.time - S.lastPileupT > 6 && BC.isPileup(S.wrecks, S.time, c.x, c.z)) { S.lastPileupT = S.time; S.stats.pileups++; const n = S.wrecks.filter(w => S.time - w.t < 5).length; toast(`💥 Pileup on the Beltway: ${n} cars.`, 2400); emit('pileup', { n, x: c.x, z: c.z }); }
}
function stepCar(c, dt, obst) {
  if (c.state === 'wreck') { c.wreckT += dt; if (c.wreckT < 0.6) { c.yaw += c.yawOff * dt * 2; } if (c.convoy === 'truck' && Math.random() < dt * 3) burst(c.x, c.y + 2.4, c.z, 3, 0.4); return; }
  if (c.state === 'jacking' || c.state === 'stopped') { c.v = Math.max(0, c.v - 9 * dt); }
  else {
    let v0 = c.v0; v0 = Math.min(v0, boothSlow(c));
    if (c.convoy && S.convoy?.alert && c.convoy === 'truck') v0 = 16;
    const L = leaderIn(c, c.lane), O = obstacleGap(c, BC.LANES[c.lane], obst);
    const lead = L.gap < O.gap ? L : O;
    let a = BC.idmAccel(c.v, v0, lead.gap, lead.v);
    // human reaction time: a car that suddenly wrecks ahead is not noticed for ~0.6-1.1 s (this is what chains a pileup)
    if (lead === L && L.car?.state === 'wreck' && L.car.wreckT < 1.5 && c.sawWreck !== L.car.id) { c.sawWreck = L.car.id; c.reactT = 0.6 + Math.random() * 0.5; }
    if (c.reactT > 0) { c.reactT -= dt; a = Math.max(a, 0); }
    if (S.convoy?.alert && c.convoy === 'escort') a = -6; // escorts pull over and the guards bail out
    c.v = Math.max(0, c.v + a * dt);
    // rear-end: overlapped the leader with real closing speed -> both wreck (pileups chain from here)
    if (L.gap < -0.05) { const o = nearestAhead(c); if (o) { const closing = c.v - (o.state === 'drive' ? o.v : 0); if (closing > 5) { wreck(c, closing); wreck(o, closing * 0.7); } else { c.v = Math.min(c.v, o.state === 'drive' ? o.v : 0); c.s = BC.wrapS(o.s - c.dir * (c.K.len + o.K.len) / 2 - c.dir * 0.05, S.len, S.closed); } } }
    // lane change (convoys stay in formation unless the truck is running)
    c.cool -= dt;
    if (c.cool <= 0 && c.state === 'drive' && (!c.convoy || (c.convoy === 'truck' && S.convoy?.alert)) && Math.abs(c.lat - BC.LANES[c.lane]) < 0.1) {
      const other = 1 - c.lane, A = leaderIn(c, other), B = leaderIn(c, other, true);
      if (BC.laneChange({ v: c.v, v0, gapAhead: lead.gap, leadV: lead.v, otherAhead: Math.min(A.gap, obstacleGap(c, BC.LANES[other], obst).gap), otherAheadV: A.v, otherBehind: B.gap, otherBehindV: B.v, cooldown: c.cool })) { c.lane = other; c.cool = 5 + Math.random() * 4; emit('lane', { id: c.id }); }
    }
  }
  c.s = BC.wrapS(c.s + c.v * c.dir * dt, S.len, S.closed);
  const tl = BC.LANES[c.lane], dl = tl - c.lat, step = Math.sign(dl) * Math.min(Math.abs(dl), dt * 1.4); c.lat += step;
  const p = roadPose(c.s, c.dir, c.lat), steer = c.v > 1 ? Math.atan2(-step / dt, Math.max(4, c.v)) * 0.6 : 0, ty = Math.atan2(-p.fx, -p.fz) + steer;
  let dy = ty - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 6); c.x = p.x; c.z = p.z;
}
function nearestAhead(c) { let best = null, bg = 1e9; for (const o of S.cars) { if (o === c || o.dir !== c.dir || o.state === 'gone' || Math.abs(o.lat - c.lat) > 1.3) continue; const g = BC.gapAlong(c.s, o.s, c.dir, S.len, S.closed); if (g >= 0 && g < bg) { bg = g; best = o; } } return best; }
// car c (local frame) vs a circle at (x, z) radius r: penetration info or null
function hitBox(c, x, z, r) {
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), dx = x - c.x, dz = z - c.z, f = dx * fx + dz * fz, l = -dx * fz + dz * fx;
  const hl = c.K.len / 2 + r, hw = c.K.w / 2 + r; if (Math.abs(f) > hl || Math.abs(l) > hw) return null;
  const pf = hl - Math.abs(f), pl = hw - Math.abs(l);
  return pf < pl ? { nx: fx * Math.sign(f), nz: fz * Math.sign(f), pen: pf, front: f } : { nx: -fz * Math.sign(l), nz: fx * Math.sign(l), pen: pl, front: f };
}
function playerHits(dt, tc) {
  const car = tc.car, pl = tc.player; if (!pl) return;
  const px = car ? car.x : pl.x, pz = car ? car.z : pl.z, pr = car ? Math.min(1.6, (car.spec?.r || 2.2) * 0.62) : 0.35;
  const pvx = car ? -Math.sin(car.yaw) * car.speed : 0, pvz = car ? -Math.cos(car.yaw) * car.speed : 0;
  for (const c of S.cars) {
    if (c.state === 'gone') continue; if (Math.abs(c.x - px) > 9 || Math.abs(c.z - pz) > 9) continue;
    const h = hitBox(c, px, pz, pr); if (!h) continue;
    const cvx = -Math.sin(c.yaw) * (c.state === 'wreck' ? 0 : c.v), cvz = -Math.cos(c.yaw) * (c.state === 'wreck' ? 0 : c.v);
    const closing = Math.abs((pvx - cvx) * h.nx + (pvz - cvz) * h.nz);
    if (car) {
      car.x += h.nx * h.pen; car.z += h.nz * h.pen; car.group?.position.set(car.x, car.y, car.z);
      if (closing > 3) { car.speed *= closing > 10 ? 0.45 : 0.7; burst((px + c.x) / 2, (c.y || 0) + 0.8, (pz + c.z) / 2, Math.round(6 + closing), Math.min(1.4, closing / 14)); }
      if (c.convoy) { convoyHit(c, closing); continue; }
      if (closing > 6) { wreck(c, closing, 'player'); emit('playerCrash', { id: c.id, closing: +closing.toFixed(1) }); }
      else if (c.state === 'drive') c.v = Math.min(c.v, 2);
    } else {
      pl.x += h.nx * h.pen; pl.z += h.nz * h.pen;
      if (c.state === 'drive' && c.v > 6) { try { tc.game?.hurtPlayer?.(Math.round(c.v), { x: c.x, z: c.z }); } catch (e) { /* */ } c.v = 0; c.state = 'stopped'; c.wreckT = 0; emit('hitPed', { id: c.id }); }
    }
  }
}
function render() {
  const n = { sedan: 0, van: 0, hauler: 0 };
  for (const c of S.cars) {
    if (c.state === 'gone') continue;
    if (c.group) { c.group.position.set(c.x, c.y, c.z); c.group.rotation.set(0, c.yaw, c.roll); continue; }
    const I = S.inst[c.kind]; if (!I) continue; const k = n[c.kind]++; if (k >= I.body.instanceMatrix.count) continue;
    _e.set(0, c.yaw, c.roll); _q.setFromEuler(_e); _p.set(c.x, c.y, c.z); _s.set(1, 1, 1); _m.compose(_p, _q, _s);
    I.body.setMatrixAt(k, _m); I.detail.setMatrixAt(k, _m); I.light.setMatrixAt(k, _m);
    _c.setHex(c.color); if (c.state === 'wreck') _c.multiplyScalar(0.45); I.body.setColorAt(k, _c);
  }
  for (const k of Object.keys(S.inst)) { const I = S.inst[k]; for (const m of [I.body, I.detail, I.light]) { m.count = n[k]; m.instanceMatrix.needsUpdate = true; } if (I.body.instanceColor) I.body.instanceColor.needsUpdate = true; }
}

// ---------- convoy ----------
function buildConvoyGroup(kind) { mats(); const Q = geoms(kind), g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(new THREE.Mesh(Q.body, kind === 'armored' ? MAT.armor : MAT.escort), new THREE.Mesh(Q.detailW, MAT.detail), new THREE.Mesh(Q.light, MAT.light)); S.root.add(g); return g; }
export function spawnConvoy(o = {}) {
  if (!S.ready || S.convoy) return null;
  const dir = o.dir ?? (Math.random() < 0.5 ? 1 : -1), ahead = o.ahead ?? (150 + Math.random() * 40), lane = o.lane ?? 0;
  let s0 = BC.wrapS(S.ps + ahead * (o.sameDir === false ? -dir : dir), S.len, S.closed);
  for (const c of S.cars) if (!c.convoy && c.dir === dir && Math.abs(BC.gapAlong(s0, c.s, dir, S.len, S.closed)) < 30) c.state = 'gone';
  const v = o.v ?? 10, mk = (kind, d, role) => newCar(kind, BC.wrapS(s0 + d * dir, S.len, S.closed), dir, lane, { v, v0: 11, convoy: role, group: buildConvoyGroup(kind), color: 0x5a6068, hp: role === 'truck' ? BC.CONVOY.hp : 0 });
  const lead = mk('escort', 13, 'escort'), truck = mk('armored', 0, 'truck'), tail = mk('escort', -12, 'escort');
  S.convoy = { id: 'convoy-' + S.nextId, truck, escorts: [lead, tail], alert: false, state: 'rolling', t: 0, guards: 0 };
  S.stats.convoys++; toast('📻 Armored convoy on the Beltway. Ram the truck till it dies, then crack the back.', 3200); emit('convoy', { id: S.convoy.id, x: truck.x, z: truck.z });
  return S.convoy.id;
}
function convoyHit(c, closing) {
  const C = S.convoy; if (!C) return; const dmg = BC.ramDamage(closing); if (!dmg) return;
  S.stats.rams++;
  if (!C.alert) { C.alert = true; heat(2, 'rammed an armored convoy'); toast('🚨 Convoy\u2019s alerted. The escorts are bailing out.', 2400);
    const b = wld()?.npcBudget?.(); if (!b || b.free >= 2) { try { for (const e of C.escorts) C.guards += SSX()?.city?.hostiles?.(['guard'], e.x, e.z, { r: 4, src: 'beltway', faction: 'private' }) || 0; } catch (e) { console.warn('beltway guards', e); } } }
  if (c !== C.truck) return;
  c.hp = Math.max(0, c.hp - dmg); emit('ram', { hp: c.hp, dmg, closing: +closing.toFixed(1) });
  if (c.hp <= 0 && C.state === 'rolling') { C.state = 'disabled'; wreck(c, Math.max(closing, 8), 'convoy'); toast('🚚 Truck\u2019s dead in the road. Get out and crack the back doors.', 3000); emit('convoyDisabled', { id: C.id }); }
}
function convoyCrackSpot() { const t = S.convoy?.truck; if (!t) return null; const bx = t.x + Math.sin(t.yaw) * (t.K.len / 2 + 0.9), bz = t.z + Math.cos(t.yaw) * (t.K.len / 2 + 0.9); return { x: bx, z: bz }; }
async function crackConvoy() {
  const C = S.convoy; if (!C || C.state !== 'disabled' || S.busy) return false; S.busy = true;
  try {
    const sc = SSX()?.heist?.safeCrack || localSafeCrack;
    emit('crack', { id: C.id });
    const res = S.force.crack ? { success: true, reason: 'debug' } : await sc({ tier: 'easy', time: BC.CONVOY.crackTime, title: 'Armored truck doors' });
    if (S.convoy !== C) return false;
    if (res?.success) {
      const cr = BC.convoyLoot(Math.random()); try { game()?.bonus?.(cr); } catch (e) { /* */ }
      C.state = 'looted'; C.loot = cr; S.stats.convoyLoot += cr; heat(3, 'looted an armored truck');
      const t = C.truck; burst(t.x + Math.sin(t.yaw) * 3.4, t.y + 1.4, t.z + Math.cos(t.yaw) * 3.4, 10, 0.4); bag(t);
      toast(`💰 ${cr} cr out of the truck. Now lose the heat.`, 3000); emit('convoyLoot', { id: C.id, credits: cr, wanted: wld()?.wanted | 0 }); return true;
    }
    heat(Math.min(5, (wld()?.wanted | 0) + 1), 'armored truck alarm'); toast(res?.reason === 'abort' ? '🔒 You backed off the doors.' : '🚨 The truck\u2019s alarm is screaming. Try again or run.', 2600);
    emit('crackFail', { id: C.id, reason: res?.reason }); return false;
  } finally { S.busy = false; }
}
function bag(t) { mats(); for (const [x, z] of [[0.5, 3.7], [-0.3, 3.9]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), MAT.cash); m.position.set(x, 0.18, z); t.group.add(m); } }
function dropConvoy() { const C = S.convoy; if (!C) return; for (const c of [C.truck, ...C.escorts]) { c.state = 'gone'; c.group?.parent?.remove(c.group); } S.convoy = null; SSX()?.minimap?.clear?.('beltway:convoy'); }

// ---------- booths ----------
function labelTex(text, color = '#ffd36a') { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(10,12,20,0.85)'; g.fillRect(0, 0, 256, 64); g.fillStyle = color; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function buildBooths(height) {
  const H = S.hw, avoid = [...S.avoid.map(a => ({ x: a.x, z: a.z, r: a.r + 30 })), ...(H.checkpoints || []).map(c => ({ x: c.x, z: c.z, r: 70 })), ...(H.ramps || []).map(r => ({ x: r.x, z: r.z, r: 50 }))];
  const spots = BC.boothSpots(S.len, S.closed, avoid, S.isMobile ? 2 : 3, s => H.at(s)), M = mats();
  S.booths = spots.map((sp, i) => {
    const p = H.at(sp.s), yaw = Math.atan2(-p.fx, -p.fz), y = height(p.x, p.z), g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.y = yaw; S.root.add(g);
    const B = (w, h, l, x, yy, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m); o.position.set(x, yy, z); g.add(o); return o; };
    B(1.3, 2.3, 2.4, 0, 1.15, 0, M.booth); B(1.34, 0.9, 1.6, 0, 1.55, 0, M.boothGlass); B(12.4, 0.35, 3.4, 0, 4.4, 0, M.booth); B(12.4, 0.08, 3.0, 0, 4.2, 0, M.lamp);
    for (const sx of [-6, 6]) B(0.35, 4.4, 0.35, sx, 2.2, 0, M.booth);
    B(0.5, 0.25, 0.25, 0, 0.12, -1.35, M.stripe); B(0.5, 0.25, 0.25, 0, 0.12, 1.35, M.stripe);
    const arms = [-1, 1].map(sd => { const pv = new THREE.Group(); pv.position.set(sd * 0.8, 1.05, sd * -1.3); g.add(pv); const a = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.12), M.stripe); a.position.x = sd * 2.1; pv.add(a); return { pv, sd, up: 0 }; });
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(`TOLL ${BC.TOLL.price} cr`), transparent: true, depthWrite: false })); sign.position.set(0, 5.2, 0); sign.scale.set(3.4, 0.85, 1); g.add(sign);
    const att = person(i + 2); att.g.position.set(0, 0, 0.2); att.g.visible = false; g.add(att.g);
    return { id: 'toll-' + (i + 1), s: sp.s, x: p.x, z: p.z, yaw, g, arms, att, cool: 0, paid: 0, staffed: false, lastSide: 0 };
  });
  try { SSX()?.minimap?.addMarks?.('beltway:tolls', S.booths.map(b => ({ x: b.x, z: b.z, color: '#ffc42a', r: 2 }))); } catch (e) { /* */ }
}
function updateBooths(dt, px, pz, speed, driving) {
  for (const b of S.booths) {
    b.cool = Math.max(0, b.cool - dt); b.paid = Math.max(0, b.paid - dt);
    const d = Math.hypot(px - b.x, pz - b.z);
    // arms: up for traffic about to pass and for a paid player
    for (const a of b.arms) {
      const dir = a.sd; let want = b.paid > 0 && d < 16 ? 1 : 0;
      for (const c of S.cars) { if (c.state === 'gone' || c.dir !== dir) continue; const g = BC.gapAlong(c.s, b.s, c.dir, S.len, S.closed); if (g > -4 && g < 9) { want = 1; break; } }
      if (b.cool > 0) want = 1; a.up += (want - a.up) * Math.min(1, dt * 5); a.pv.rotation.z = a.sd * a.up * 1.35;
    }
    // ran the toll: crossed the booth line in the lanes, fast, without paying, while it's staffed
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), along = (px - b.x) * fx + (pz - b.z) * fz, lat = Math.abs((px - b.x) * -fz + (pz - b.z) * fx), side = Math.sign(along);
    if (lat < 6 && b.lastSide && side && side !== b.lastSide && driving && Math.abs(speed) > BC.TOLL.runV && b.paid <= 0 && b.staffed && b.cool <= 0) { S.stats.tollRuns++; heatAtLeast(1, 'ran a Beltway toll'); toast('🚧 You ran the toll. The booth called it in.', 2200); emit('tollRun', { id: b.id }); }
    b.lastSide = lat < 12 && Math.abs(along) < 30 ? side : 0;
  }
}
function nearBooth(px, pz) { let best = null, bd = BC.TOLL.range; for (const b of S.booths) { const d = Math.hypot(px - b.x, pz - b.z); if (d < bd) { bd = d; best = b; } } return best; }
function payToll(b) {
  if (!b || b.paid > 0) return false; const g = game(); if (b.cool > 0 || !b.staffed) { b.paid = 30; toast('🚧 Nobody in the booth. Arm\u2019s up, go.', 1800); return true; }
  const ok = typeof g?.spend === 'function' ? g.spend(BC.TOLL.price) : false;
  if (!ok) { toast(`💳 Card declined. You need ${BC.TOLL.price} cr (or a gun).`, 2200); return false; }
  b.paid = 30; S.stats.tollsPaid++; toast(`💳 Paid ${BC.TOLL.price} cr. Have a nice day.`, 1600); emit('tollPaid', { id: b.id, price: BC.TOLL.price }); return true;
}
function shakedown(b) {
  if (!b || b.cool > 0 || !b.staffed) return false; const cr = BC.shakedownCash(Math.random());
  try { game()?.bonus?.(cr); } catch (e) { /* */ }
  b.cool = BC.TOLL.cooldown; b.paid = 30; S.stats.shakedowns++; heat(BC.TOLL.heat, 'shook down a toll booth');
  fleeFrom(b); toast(`🔫 The attendant emptied the drawer: ${cr} cr. They hit the panic button.`, 2800); emit('shakedown', { id: b.id, credits: cr }); return cr;
}
function fleeFrom(b) { const a = b.att; a.g.visible = false; b.staffed = false; const w = b.g.localToWorld(new THREE.Vector3(0, 0, 0)); addDriver(w.x, w.z, 'flee', b.yaw + Math.PI / 2, 5); }

// ---------- drivers on foot (pedestrian NPCs: counted against world.npcBudget, phones <= 12) ----------
function addDriver(x, z, mode, yaw, life = 7) {
  const b = wld()?.npcBudget?.(); if (b && b.free <= 0) return null;
  const P = person(S.drivers.length + (S.nextId % 4)); P.g.position.set(x, surfH(x, z), z); P.g.rotation.y = yaw; S.root.add(P.g);
  const d = { ...P, x, z, yaw, mode, t: 0, life, swings: 0, sw: 0 }; S.drivers.push(d); syncReserve(); return d;
}
const surfH = (x, z) => { try { return S.height?.(x, z) ?? 0; } catch (e) { return 0; } };
function updateDrivers(dt, tc) {
  const pl = tc.player, px = tc.car ? tc.car.x : pl.x, pz = tc.car ? tc.car.z : pl.z;
  for (const d of [...S.drivers]) {
    d.t += dt; let sp = 0;
    const dx = px - d.x, dz = pz - d.z, dist = Math.hypot(dx, dz) || 1;
    if (d.mode === 'fight' && d.t < 3.2 && !tc.car) {
      d.yaw = Math.atan2(-dx, -dz); if (dist > 1.3) sp = 3.2; else { d.sw -= dt; if (d.sw <= 0 && d.swings < 2) { d.sw = 0.9; d.swings++; try { tc.game?.hurtPlayer?.(6, { x: d.x, z: d.z }); } catch (e) { /* */ } emit('punch', {}); } }
      for (const a of d.arms) a.rotation.x = d.sw > 0.6 ? -1.4 : -0.3;
    } else { if (d.mode === 'fight') { d.mode = 'flee'; } d.yaw = Math.atan2(dx, dz); sp = 5.6; for (const a of d.arms) a.rotation.x = Math.sin(d.t * 12) * 0.8; }
    d.x += -Math.sin(d.yaw) * sp * dt; d.z += -Math.cos(d.yaw) * sp * dt;
    d.legs[0].rotation.x = Math.sin(d.t * (sp > 4 ? 13 : 9)) * (sp ? 0.7 : 0); d.legs[1].rotation.x = -d.legs[0].rotation.x;
    d.g.position.set(d.x, tc.height(d.x, d.z), d.z); d.g.rotation.y = d.yaw;
    if (d.t > d.life || dist > 70) { d.g.parent?.remove(d.g); S.drivers.splice(S.drivers.indexOf(d), 1); syncReserve(); }
  }
}
function syncReserve(extra = S.boothNeed || 0) {
  const n = S.drivers.length + extra; if (n === S.reserve) return; S.reserve = n;
  try { wld()?.npcReserve?.('beltway', n); } catch (e) { /* */ }
}

// ---------- carjack ----------
function jackable(px, pz) {
  let best = null, bd = BC.JACK.range;
  for (const c of S.cars) { if (c.convoy || c.state === 'gone' || c.state === 'wreck' || c.v > BC.JACK.maxSpeed) continue; if (Math.abs(c.x - px) > 8 || Math.abs(c.z - pz) > 8) continue;
    const h = hitBox(c, px, pz, 1.7); if (!h) continue; const d = Math.hypot(c.x - px, c.z - pz) - c.K.len / 3; if (d < bd) { bd = d; best = c; } }
  return best;
}
function jackStep(dt, tc) {
  const J = S.jack; if (!J) return;
  const c = J.car; if (c.state === 'gone' || tc.car) { if (c.state === 'jacking') c.state = 'drive'; S.jack = null; return; }
  c.state = 'jacking';
  Object.assign(J, BC.struggleStep(J, dt, S.hold));
  if (J.done) finishJack(J, tc);
  else if (J.lost || Math.hypot(c.x - tc.player.x, c.z - tc.player.z) > BC.JACK.range + 2.5) { c.state = 'drive'; c.v = 4; c.v0 += 4; S.jack = null; S.stats.jackFails++; toast('🚗💨 They floored it.', 1600); emit('carjackFail', { id: c.id }); }
}
function finishJack(J, tc) {
  const c = J.car; S.jack = null; const kind = BC.KINDS[c.kind].jack || 'bw-sedan', w = wld();
  const out = S.force.outcome || BC.jackOutcome(Math.random(), { wanted: w?.wanted | 0, kind: c.kind });
  nextPaint = c.color; let v = null;
  try { v = w?.spawnVehicle?.(kind, c.x, c.z, c.yaw, { zone: 'highway' }); } catch (e) { console.warn('beltway spawnVehicle', e); }
  if (!v) { toast('✊ The door\u2019s jammed.', 1400); c.state = 'drive'; return; }
  c.state = 'gone';
  // the driver tumbles out of the left door
  const lx = c.x - Math.cos(c.yaw) * 1.6, lz = c.z + Math.sin(c.yaw) * 1.6, d = addDriver(lx, lz, out, c.yaw + Math.PI / 2, out === 'fight' ? 8 : 6);
  S.stats.carjacks++; if (out === 'fight') S.stats.fights++;
  heat(Math.max(1, Math.min(5, (w?.wanted | 0) || 1)), `carjacked a ${(BC.KINDS[c.kind] && kind === 'hauler') ? 'hauler' : 'commuter'}`);
  toast(out === 'fight' ? '👊 The driver came out swinging!' : '🏃 The driver bailed and ran.', 1800);
  emit('carjack', { id: c.id, kind: c.kind, vehicle: kind, outcome: out, driver: !!d });
  J.enterAt = S.time + (out === 'fight' ? 0.9 : 0.35); S.pendingEnter = { v, at: J.enterAt };
}
function enterPending(tc) {
  const P = S.pendingEnter; if (!P || S.time < P.at) return; S.pendingEnter = null;
  if (tc.car) return; const s = surf(); if (!s) return;
  if (Math.hypot(P.v.x - tc.player.x, P.v.z - tc.player.z) > 6) { tc.player.x = P.v.x - Math.cos(P.v.yaw) * 2.2; tc.player.z = P.v.z + Math.sin(P.v.yaw) * 2.2; }
  try { s.interact?.(); } catch (e) { console.warn('beltway enter', e); }
}

// ---------- HUD: up to two context buttons in #surfBtns (only when relevant), one chip while a convoy is near ----------
const CSS = `#bwBtn, #bwBtn2 { display: none; position: relative; overflow: hidden; height: 48px !important; font-size: 0.72rem !important; touch-action: none !important; background: rgba(150,40,30,0.72) !important; border-color: rgba(255,140,90,0.6) !important; }
#bwBtn2 { background: rgba(40,48,70,0.78) !important; border-color: rgba(255,255,255,0.3) !important; }
#bwBtn i, #bwBtn2 i { position: absolute; left: 0; bottom: 0; height: 4px; width: 0; background: #ffd040; pointer-events: none; }
body:not(.touch) #bwBtn, body:not(.touch) #bwBtn2 { font-size: 0.8rem !important; }
#bwChip { display: none; padding: 4px 9px; border-radius: 9px; font-size: 0.7rem; background: rgba(8,10,20,0.66); border: 1px solid rgba(255,160,40,0.55); color: #fff; white-space: nowrap; }
#bwChip.on { display: block; } #bwChip b.hp { display: inline-block; width: 40px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.15); vertical-align: middle; margin-left: 6px; overflow: hidden; } #bwChip b.hp i { display: block; height: 100%; background: #ff8a3a; }`;
function ensureUi() {
  if (S.ui || typeof document === 'undefined') return S.ui; const sb = document.getElementById('surfBtns'); if (!sb) return null;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const mk = id => { const b = document.createElement('button'); b.id = id; b.className = 'glass'; b.innerHTML = '<span></span><i></i>'; sb.insertBefore(b, sb.firstChild); return b; };
  const b2 = mk('bwBtn2'), b1 = mk('bwBtn');
  holdable(b1, 1); holdable(b2, 2);
  const chip = document.createElement('div'); chip.id = 'bwChip'; const stack = document.getElementById('stackR'); (stack || document.body).appendChild(chip);
  addEventListener('keydown', e => { if (e.code !== 'KeyI' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.getElementById('hsSafe')) return; if (!S.act) return; e.preventDefault(); press(S.act.key === 'toll' ? 'key' : 1); });
  addEventListener('keyup', e => { if (e.code !== 'KeyI') return; release(S.act?.key === 'toll' ? 'key' : 1, true); });
  S.ui = { b1, b2, chip }; return S.ui;
}
// pointerdown -> pointerup on the same pointerId (never onclick). Holds report while the pointer stays down.
function holdable(el, slot) {
  let pid = null;
  el.addEventListener('pointerdown', e => { if (pid !== null) return; e.preventDefault(); e.stopPropagation(); pid = e.pointerId; try { el.setPointerCapture?.(pid); } catch (_) { /* synthetic */ } press(slot); });
  el.addEventListener('pointerup', e => { if (e.pointerId !== pid) return; e.preventDefault(); pid = null; release(slot, true); });
  el.addEventListener('pointercancel', e => { if (e.pointerId !== pid) return; pid = null; release(slot, false); });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function press(slot) { S.hold = true; S.holdT = 0; S.holdSlot = slot; const a = S.act; if (!a) return; if (a.key === 'carjack' && !S.jack && a.car) S.jack = { car: a.car, p: 0, idle: 0, done: false, lost: false }; }
function release(slot, fire) {
  const held = S.holdT, wasSlot = S.holdSlot; S.hold = false; S.holdT = 0; if (!fire || wasSlot !== slot) return; const a = S.act; if (!a) return;
  if (a.key === 'crack' && slot === 1) crackConvoy();
  if (a.key === 'toll') { if (slot === 1 || (slot === 'key' && held < 0.35)) payToll(a.booth); }
}
function setAct(a) {
  const U = ensureUi(); S.act = a; if (!U) return; const touch = isTouch();
  const show = (b, label, p) => { b.style.display = label ? 'block' : 'none'; if (label && b.firstChild.textContent !== label) b.firstChild.textContent = label; b.lastChild.style.width = Math.round((p || 0) * 100) + '%'; };
  if (!a) { show(U.b1, null); show(U.b2, null); return; }
  if (a.key === 'carjack') { show(U.b1, S.jack ? `✊ Pull ${Math.round(S.jack.p * 100)}%` : '✊ Carjack' + (touch ? '' : ' (hold I)'), S.jack?.p); show(U.b2, null); }
  else if (a.key === 'crack') { show(U.b1, '🔓 Crack' + (touch ? '' : ' (I)')); show(U.b2, null); }
  else if (a.key === 'toll') { const b = a.booth, staffed = b.staffed && b.cool <= 0; show(U.b1, b.paid > 0 ? '✅ Paid' : staffed ? `💳 Toll ${BC.TOLL.price}` + (touch ? '' : ' (I)') : '🚧 Go'); show(U.b2, staffed ? '🔫 Shake' + (touch ? '' : ' (hold I)') : null, S.shake?.p); }
}
function updateChip(tc) {
  const U = S.ui; if (!U) return; const C = S.convoy; const px = tc.car ? tc.car.x : tc.player.x, pz = tc.car ? tc.car.z : tc.player.z;
  if (!C || C.state === 'looted') { if (U.chip.classList.contains('on')) U.chip.classList.remove('on'); return; }
  const d = Math.round(Math.hypot(C.truck.x - px, C.truck.z - pz)); if (d > 260) { U.chip.classList.remove('on'); return; }
  U.chip.classList.add('on'); const key = `${C.state}|${C.truck.hp}|${Math.round(d / 5)}`; if (U.chip.dataset.k === key) return; U.chip.dataset.k = key;
  U.chip.innerHTML = `🚚 ${C.state === 'disabled' ? 'Truck down · crack the back' : 'Armored convoy'} · ${d} m<b class="hp"><i style="width:${C.truck.hp}%"></i></b>`;
}

// ---------- per frame ----------
// main's Beltway ribbon/stripe are wound clockwise (normals point down), so FrontSide culls them from above and the road is invisible.
// Flip any downward-facing triangle once: a no-op after the core fix lands.
function fixRoadWinding(scene) {
  let n = 0; scene?.traverse?.(o => { const v = o.userData?.v8; if (!o.isMesh || v?.site !== 'highway' || (v.part !== 'road' && v.part !== 'stripe') || o.userData.bwFixed) return;
    const g = o.geometry, P = g.attributes.position, I = g.index; if (!P || !I) return; const A = I.array; let f = 0;
    for (let i = 0; i + 2 < A.length; i += 3) { const a = A[i], b = A[i + 1], c = A[i + 2], ux = P.getX(b) - P.getX(a), uz = P.getZ(b) - P.getZ(a), vx = P.getX(c) - P.getX(a), vz = P.getZ(c) - P.getZ(a);
      if (uz * vx - ux * vz < 0) { A[i + 1] = c; A[i + 2] = b; f++; } } // face normal y = uz*vx - ux*vz: make every triangle face up
    if (f) { I.needsUpdate = true; g.computeVertexNormals(); n += f; } o.userData.bwFixed = true; });
  return n;
}
function init(tc) {
  const w = tc.world, hw = w?.highway?.(); if (!hw || !hw.at || !hw.len) return false;
  S.hw = hw; S.len = hw.len; S.closed = !!hw.closed; S.scene = tc.scene; S.isMobile = !!tc.isMobile; S.tier = tierNow(); S.height = tc.height; S.world = w;
  S.avoid = [...(w.districts?.() || []).map(d => ({ x: d.x, z: d.z, r: Math.max(30, (d.r || 58) - 8), core: true }))];
  S.roadFixed = fixRoadWinding(tc.scene); registerKinds(); buildInstances(tc.scene); buildBooths(tc.height); ensureUi(); S.ready = true; S.convoyT = 45 + Math.random() * 30;
  emit('ready', { tier: S.tier, len: Math.round(S.len), booths: S.booths.length }); return true;
}
function teardown() {
  if (S.root) { S.root.parent?.remove(S.root); }
  for (const c of S.cars) c.group?.parent?.remove(c.group);
  S.cars = []; S.booths = []; S.drivers = []; S.convoy = null; S.jack = null; S.ready = false; S.root = null; S.inst = {}; S.sparks = S.debris = null; S.hw = null; setAct(null); syncReserve(0);
}
export function beltwayTick(dt, tc) {
  if (!tc || !tc.world) return;
  if (tc.name !== 'Mars' || !tc.world.highway?.()) { if (S.ready) teardown(); return; }
  if (S.ready && (S.scene !== tc.scene || S.world !== tc.world)) teardown(); // a fresh landing builds a fresh world
  if (!S.ready && !init(tc)) return;
  const t0 = performance.now(); dt = Math.min(0.1, Math.max(0, dt)); S.time += dt; S.lastCar = tc.car;
  S.fpsE += ((dt > 0 ? 1 / dt : 60) - S.fpsE) * Math.min(1, dt * 1.5);
  const inside = !!tc.world.inside; S.root.visible = S.on && !inside;
  if (!S.on || inside) { setAct(null); return; }
  if ((S.tierT = (S.tierT || 0) - dt) <= 0) { S.tierT = 2; const t = tierNow(); if (t !== S.tier) { S.tier = t; emit('tier', { tier: t }); } }
  S.scale = BC.adaptScale(S.scale, S.fpsE, dt);
  const pl = tc.player, px = tc.car ? tc.car.x : pl.x, pz = tc.car ? tc.car.z : pl.z, speed = tc.car ? tc.car.speed : 0;
  if ((S.projT -= dt) <= 0) { S.projT = 0.25; const pr = S.hw.project(px, pz); S.ps = pr.s; S.pd = pr.d; }
  const near = S.pd < 170, R = S.isMobile ? 200 : 260;
  // core traffic cars (world.js) are obstacles too, refreshed 4x a second
  if ((S.coreT -= dt) <= 0) { S.coreT = 0.25; try { S.coreTraffic = (tc.world.debug?.traffic?.() || []).map(v => ({ x: v.x, z: v.z, w: 1.1, len: 4, vf: 0 })); } catch (e) { S.coreTraffic = []; } }
  const obst = [...S.coreTraffic]; if (S.pd < 12) obst.push(tc.car ? { x: px, z: pz, w: 1.1, len: 4.2, vf: Math.abs(speed) * 0.6 } : { x: px, z: pz, w: 0.6, len: 0.6, vf: 0 });
  if (near) { spawnSome(S.force.density ?? BC.density(S.tier, S.isMobile, S.scale), !S.cars.length); }
  for (const c of S.cars) {
    if (c.state === 'gone') continue;
    const g = BC.gapAlong(S.ps, c.s, 1, S.len, S.closed);
    if (!c.convoy) {
      const far = !near || Math.abs(g) > R + 25, core = c.state !== 'jacking' && inCore(c.x, c.z), towed = c.state === 'wreck' && c.wreckT > 30 && Math.hypot(c.x - px, c.z - pz) > 60;
      if (far || core || towed) { c.state = 'gone'; continue; }
      if (c.state === 'stopped' && (c.wreckT += dt) > 3) c.state = 'drive';
    }
    stepCar(c, dt, obst); c.y = tc.height(c.x, c.z);
  }
  // convoy life
  const C = S.convoy;
  if (C) { C.t += dt; const d = Math.hypot(C.truck.x - px, C.truck.z - pz); if ((d > 320 && C.t > 20) || (C.state === 'looted' && d > 120) || C.t > 420) dropConvoy();
    else if ((C.mt = (C.mt || 0) - dt) <= 0) { C.mt = 0.5; try { SSX()?.minimap?.addMarks?.('beltway:convoy', [{ x: C.truck.x, z: C.truck.z, color: C.state === 'disabled' ? '#3cff8a' : '#ff8a3a', r: 3 }]); } catch (e) { /* */ } } }
  else if (near && (S.convoyT -= dt) <= 0) { S.convoyT = BC.TIERS[S.tier].convoyS * (0.8 + Math.random() * 0.5); if (!(tc.world.wanted > 0)) spawnConvoy(); }
  if (S.cars.length > 160) S.cars = S.cars.filter(c => c.state !== 'gone');
  else if (S.cars.length && (S.gcT = (S.gcT || 0) + dt) > 3) { S.gcT = 0; S.cars = S.cars.filter(c => c.state !== 'gone'); }
  playerHits(dt, tc);
  updateBooths(dt, px, pz, speed, !!tc.car); let staffed = 0;
  for (const b of S.booths) { const show = b.cool <= 0 && Math.hypot(px - b.x, pz - b.z) < 70; if (show !== b.att.g.visible) { const bud = tc.world.npcBudget?.(); b.att.g.visible = show && (!bud || bud.free > 0); } b.staffed = b.att.g.visible; staffed += b.staffed ? 1 : 0; }
  S.boothNeed = staffed; // attendants are people too: they count against world.npcBudget()
  updateDrivers(dt, tc); syncReserve();
  // context
  if (S.hold) S.holdT += dt;
  jackStep(dt, tc); enterPending(tc);
  const booth = nearBooth(px, pz), cs = convoyCrackSpot(), crackOk = !tc.car && S.convoy?.state === 'disabled' && cs && Math.hypot(cs.x - px, cs.z - pz) < 3.2;
  const jc = S.jack?.car || (!tc.car ? jackable(px, pz) : null);
  const key = BC.contextFor({ driving: !!tc.car, speed, jackable: !!jc, booth, convoyCrack: crackOk, busy: S.busy || !!document.getElementById('hsSafe') });
  const a = key === 'carjack' ? { key, car: jc } : key === 'toll' ? { key, booth } : key ? { key } : null;
  // toll shake-down: hold the second button (or hold I on a keyboard) for TOLL.hold seconds
  if (a?.key === 'toll' && S.hold && (S.holdSlot === 2 || S.holdSlot === 'key') && booth.staffed && booth.cool <= 0) { S.shake = { p: Math.min(1, S.holdT / BC.TOLL.hold) }; if (S.shake.p >= 1) { S.hold = false; S.shake = null; shakedown(booth); } } else S.shake = null;
  setAct(a); updateChip(tc);
  fx(dt, tc.height); render();
  S.frameMs += (performance.now() - t0 - S.frameMs) * 0.1;
}

// ---------- public API: window.SSX.beltway ----------
export const beltway = {
  get ready() { return S.ready; }, tier: () => S.tier, setTier(t) { S.tierOverride = t == null ? null : BC.normTier(t); const n = tierNow(); if (n !== S.tier) { S.tier = n; emit('tier', { tier: n }); } S.tierT = 2; return n; },
  setEnabled(on) { S.on = !!on; if (!S.on) { for (const c of S.cars) if (!c.convoy) c.state = 'gone'; setAct(null); } return S.on; }, get enabled() { return S.on; },
  density: () => ({ base: BC.density(S.tier, S.isMobile, 1), target: S.force.density ?? BC.density(S.tier, S.isMobile, S.scale), active: trafficCount(), scale: +S.scale.toFixed(2), tier: S.tier }),
  cars: () => S.cars.filter(c => c.state !== 'gone').map(c => ({ id: c.id, kind: c.kind, x: +c.x.toFixed(1), z: +c.z.toFixed(1), v: +c.v.toFixed(1), lane: c.lane, dir: c.dir, state: c.state, convoy: c.convoy })),
  booths: () => S.booths.map(b => ({ id: b.id, x: b.x, z: b.z, price: BC.TOLL.price, staffed: b.staffed, cooldown: Math.round(b.cool), paid: b.paid > 0 })),
  convoy: () => S.convoy ? { id: S.convoy.id, state: S.convoy.state, hp: S.convoy.truck.hp, alert: S.convoy.alert, x: S.convoy.truck.x, z: S.convoy.truck.z, loot: S.convoy.loot || 0, crackAt: convoyCrackSpot() } : null,
  spawnConvoy, action: () => S.act?.key || null, stats: () => ({ ...S.stats }), heat, fps: () => Math.round(S.fpsE), frameMs: () => +S.frameMs.toFixed(3),
  fx: () => ({ sparks: S.sparks?.live || 0, debris: S.debris?.live || 0, pool: S.sparks?.n || 0 }),
  on(evt, fn) { if (typeof fn !== 'function') throw new Error('SSX.beltway.on(event, fn)'); (listeners[evt] ||= []).push(fn); return () => beltway.off(evt, fn); },
  off(evt, fn) { const L = listeners[evt]; if (L) { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); } },
  debug: {
    // a crawling car right beside the player, in the nearest lane: for carjack tests
    carHere(kind = 'sedan', v = 0) { if (!S.ready) return null; const pl = surf()?.info; if (!pl) return null; const pr = S.hw.project(pl.x, pl.z), p0 = S.hw.at(pr.s), rx = -p0.fz, rz = p0.fx, side = (pl.x - p0.x) * rx + (pl.z - p0.z) * rz, dir = side >= 0 ? 1 : -1;
      for (const c of S.cars) if (!c.convoy && Math.abs(BC.gapAlong(pr.s, c.s, 1, S.len, S.closed)) < 25) c.state = 'gone';
      const c = newCar(kind, pr.s, dir, 1, { v, v0: v || 0.01 }); /* outer lane, nearest the shoulder */ c.state = v ? 'drive' : 'stopped'; c.wreckT = -60; return { id: c.id, x: c.x, z: c.z, yaw: c.yaw, dir, s: pr.s }; },
    // a line of cars at speed ahead of the player, then the leader stops dead: a pileup
    pileup(n = 5, v = 18, gap = 14, ahead = 40) { if (!S.ready) return 0; const dir = 1, lane = 1; const base = BC.wrapS(S.ps + ahead, S.len, S.closed);
      for (const c of S.cars) if (!c.convoy && c.lane === lane && c.dir === dir && Math.abs(BC.gapAlong(base, c.s, 1, S.len, S.closed)) < n * gap + 40) c.state = 'gone';
      const made = []; for (let i = 0; i < n; i++) made.push(newCar('sedan', BC.wrapS(base - i * gap, S.len, S.closed), dir, lane, { v, v0: v }));
      wreck(made[0], 14, 'debug'); return made.map(c => c.id); },
    near: (r = 60) => { const pl = surf()?.info; return pl ? S.cars.filter(c => c.state !== 'gone' && Math.hypot(c.x - pl.x, c.z - pl.z) < r).length : 0; },
    wrecks: () => S.cars.filter(c => c.state === 'wreck').length, lanes: () => { const L = [0, 0]; for (const c of S.cars) if (c.state !== 'gone') L[c.lane]++; return L; },
    setDensity(n) { S.force.density = n == null ? undefined : n | 0; return n; }, outcome(o) { S.force.outcome = o || null; return o; }, autoCrack(on = true) { S.force.crack = !!on; return on; },
    ram(closing = 20) { const C = S.convoy; if (!C) return null; convoyHit(C.truck, closing); return C.truck.hp; }, crack: () => crackConvoy(),
    pay: () => { const pl = surf()?.info; return pl ? payToll(nearBooth(pl.x, pl.z)) : false; }, shake: () => { const pl = surf()?.info; return pl ? shakedown(nearBooth(pl.x, pl.z)) : false; },
    // open stretches of Beltway (well clear of district cores, ramps and booths), for tests and mods
    openS(clear = 60) { if (!S.ready) return []; const out = []; for (let s = 0; s < S.len; s += 10) { const p = S.hw.at(s); if (S.avoid.some(a => Math.hypot(p.x - a.x, p.z - a.z) < a.r + clear) || (S.hw.ramps || []).some(r => Math.hypot(p.x - r.x, p.z - r.z) < 45) || S.booths.some(b => Math.hypot(p.x - b.x, p.z - b.z) < 70) || (S.hw.checkpoints || []).some(c => Math.hypot(p.x - c.x, p.z - c.z) < 60)) continue; out.push(s); } return out; },
    roadFixed: () => S.roadFixed | 0,
    ground: (x, z) => surfH(x, z), meshes: () => Object.fromEntries(Object.entries(S.inst || {}).map(([k, I]) => [k, I.body.count])), rootVisible: () => !!S.root?.visible,
    playerCar: () => S.lastCar, drivers: () => S.drivers.length, reserve: () => S.reserve, state: () => ({ ps: Math.round(S.ps), pd: Math.round(S.pd), cars: S.cars.length, jack: S.jack ? +S.jack.p.toFixed(2) : null, hold: S.hold, act: S.act?.key || null })
  }
};

// boot: wait for the app, then register the surface tick (a no-op off Mars / off the Beltway)
(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 250); return; }
  if (window.SSX.beltway) return; window.SSX.beltway = beltway; window.__app.beltway = beltway;
  window.SSX.registerSurfaceTick((dt, tc) => { try { beltwayTick(dt, tc); } catch (e) { console.warn('beltway tick', e); } });
})();
