// Red Tape Flats interiors: room layouts (colliders + hotspots, registered once) and set dressing (meshes, textures,
// people), which is built when you walk in and thrown away when you walk out so phones only pay for the room you are in.
// Uses the v7.3 interiors.js room kit (api.col / api.spot / api.G / api.mat / buildHuman). All geometry is primitive
// boxes/cylinders/spheres and canvas textures drawn at runtime: written for this repo, CC0. Nobody is undressed; the
// gore is blood, gauze and a cooler of organs.
import * as THREE from 'three';
import { buildHuman, textTex } from '../interiors.js';
import * as T from './flats-interiors-tex.js';

const PI = Math.PI;
// ---------- dressing kit: everything lands in one child group, owned textures/materials are tracked for dispose ----------
export function makeKit(api) {
  const g = new THREE.Group(); g.name = 'flatsDress'; api.g.add(g);
  const own = [], ticks = [], G = api.G, mat = api.mat;
  const put = (geo, m, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  const k = {
    g, own, ticks, G, mat,
    box: (x, y, z, sx, sy, sz, m, ry, rx, rz) => put(G.box, m, x, y, z, sx, sy, sz, ry, rx, rz),
    cyl: (x, y, z, r, h, m, rx = 0, rz = 0) => put(G.cyl, m, x, y, z, r, h, r, 0, rx, rz),
    sph: (x, y, z, sx, sy, sz, m) => put(G.sph, m, x, y, z, sx, sy ?? sx, sz ?? sx),
    // material that owns a texture (both disposed on undress)
    tm(t, o = {}) { own.push(t); const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, ...o }); own.push(m); return m; },
    // a private (non-cached) material, for things that flicker or change colour
    om(color, o = {}) { const { basic, ...r } = o; const m = basic ? new THREE.MeshBasicMaterial({ color, ...r }) : new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...r }); own.push(m); return m; },
    decal(t, x, y, z, w, h, { ry = 0, rx = 0, rz = 0, basic = false, opacity = 1 } = {}) {
      own.push(t); const m = new (basic ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial)({ map: t, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...(basic ? {} : { roughness: 0.95 }) }); own.push(m);
      return put(G.plane, m, x, y, z, w, h, 1, ry, rx, rz);
    },
    floorDecal(t, x, z, w, h, ry = 0, y = 0.012) { return k.decal(t, x, y, z, w, h, { rx: -PI / 2, rz: ry }); },
    neon(text, color, x, y, z, ry = 0, w = 3, o) { const t = textTex(text, color, o); own.push(t); const m = new THREE.MeshBasicMaterial({ map: t, transparent: true }); own.push(m); return put(G.plane, m, x, y, z, w, w / 4, 1, ry); },
    person(opts, x, z, yaw, anim, n = 0, y = 0) { const p = buildHuman(opts); p.group.position.set(x, y, z); p.group.rotation.y = yaw; g.add(p.group); p.yaw = yaw; p.x = x; p.z = z; p.y = y; if (anim) ticks.push((t, dt) => anim(p, t, n, dt)); return p; },
    // inner-face overlays for the four outer walls + floor (the core shell keeps its shared materials untouched)
    shell(def, wallT, floorT, { ceilStain = true } = {}) {
      const { w, d, h } = def, wm = k.tm(wallT), fm = k.tm(floorT);
      put(G.plane, wm, 0, h / 2, -d / 2 + 0.01, w, h, 1);
      put(G.plane, wm, -w / 2 + 0.01, h / 2, 0, d, h, 1, PI / 2); put(G.plane, wm, w / 2 - 0.01, h / 2, 0, d, h, 1, -PI / 2);
      const side = (w - 1.7) / 2; for (const s of [-1, 1]) put(G.plane, wm, s * (0.85 + side / 2), h / 2, d / 2 - 0.01, side, h, 1, PI);
      put(G.plane, fm, 0, 0.006, 0, w, d, 1, 0, -PI / 2);
      if (ceilStain) k.decal(T.pool(3, 'rgba(60,44,20,A)'), w * 0.2, h - 0.01, -d * 0.15, 3, 3, { rx: PI / 2 });
    },
    dispose() { g.removeFromParent(); for (const o of own) o.dispose?.(); own.length = 0; ticks.length = 0; }
  };
  return k;
}
// ---------- poses (people face -z at yaw 0; everyone stays clothed) ----------
function reset(h) { h.hips.position.y = h.base; h.hips.rotation.set(0, 0, 0); h.torso.rotation.set(0, 0, 0); h.head.rotation.set(0, 0, 0); for (const a of h.arms) a.rotation.set(0, 0, 0); for (const l of h.legs) l.rotation.set(0, 0, 0); }
function sit(h, floor = false) { reset(h); h.hips.position.y = floor ? 0.12 : 0.5; for (const l of h.legs) l.rotation.x = floor ? 1.5 : 1.45; }
// the junkie nod: the head sinks over ~6 s, the body slumps, then a jerk awake
export function nod(h, t, n = 0, floor = true) { sit(h, floor); const c = ((t + n * 3.7) % 7) / 7, s = c < 0.85 ? c / 0.85 : 1 - (c - 0.85) / 0.15 * 1.2; h.head.rotation.x = 0.15 + s * 0.85; h.torso.rotation.x = 0.1 + s * 0.35; h.torso.rotation.z = Math.sin(n) * 0.12 * s; h.arms[0].rotation.x = 0.3 + s * 0.2; h.arms[1].rotation.x = 0.5; h.arms[1].rotation.z = 0.2; }
export function lie(h, t, n = 0) { reset(h); h.group.rotation.x = PI / 2; h.arms[0].rotation.z = -0.15; h.arms[1].rotation.z = 0.3; h.torso.rotation.y = Math.sin(t * 0.25 + n) * 0.06; h.head.rotation.y = 0.5 * Math.sin(n * 3); h.legs[0].rotation.x = 0.2; const b = 1 + Math.sin(t * 1.1 + n) * 0.015; h.torso.scale.set(1, 1, b); }
export function scratch(h, t, n = 0) { reset(h); const s = Math.sin(t * 9 + n); h.arms[1].rotation.x = 1.0; h.arms[1].rotation.z = 0.9 + s * 0.15; h.arms[0].rotation.x = 0.7; h.head.rotation.x = 0.3; h.head.rotation.y = Math.sin(t * 0.7 + n) * 0.5; h.hips.position.y = h.base - Math.abs(Math.sin(t * 0.9)) * 0.03; h.torso.rotation.z = Math.sin(t * 1.3 + n) * 0.08; }
export function idle(h, t, n = 0) { reset(h); const s = Math.sin(t * 1.4 + n); h.torso.rotation.z = s * 0.03; h.head.rotation.y = Math.sin(t * 0.35 + n * 2) * 0.45; h.arms[0].rotation.x = 0.1; h.arms[1].rotation.x = 0.1; }
export function crossed(h, t, n = 0) { reset(h); h.arms[0].rotation.x = 1.2; h.arms[1].rotation.x = 1.2; h.arms[0].rotation.z = 0.9; h.arms[1].rotation.z = -0.9; h.head.rotation.y = Math.sin(t * 0.3 + n) * 0.5; }
export function count(h, t) { sit(h); const s = Math.sin(t * 7); h.arms[0].rotation.x = 1.1; h.arms[1].rotation.x = 1.1 + s * 0.2; h.arms[1].rotation.z = 0.25 + s * 0.1; h.head.rotation.x = 0.45; }
export function work(h, t) { reset(h); h.torso.rotation.x = 0.35; h.arms[0].rotation.x = 1.0 + Math.sin(t * 3) * 0.15; h.arms[1].rotation.x = 1.15 + Math.sin(t * 4.2) * 0.2; h.arms[1].rotation.z = 0.25; h.head.rotation.x = 0.35; }
export function holdHead(h, t, n = 0) { sit(h); h.arms[1].rotation.x = 2.6; h.arms[1].rotation.z = 0.5; h.head.rotation.x = 0.25; h.head.rotation.z = -0.2; h.torso.rotation.x = 0.15 + Math.sin(t * 0.8 + n) * 0.04; }
export function shotgun(h, t, mode = 0) { reset(h); const aim = mode === 2 ? 1.5 : mode === 1 ? 1.35 : 0.85; h.arms[0].rotation.x = aim; h.arms[1].rotation.x = aim + 0.1; h.arms[0].rotation.z = -0.35; h.arms[1].rotation.z = 0.25; h.head.rotation.y = mode ? 0 : Math.sin(t * 0.3) * 0.35; if (h.gun) { h.gun.rotation.x = mode === 2 ? 0 : mode === 1 ? 0.15 : 0.7; h.gun.position.y = mode ? 0.52 : 0.42; } }
export function deadPose(h) { reset(h); h.group.rotation.x = -PI / 2; h.arms[0].rotation.z = -1.2; h.arms[1].rotation.z = 1.4; h.head.rotation.y = 0.7; h.legs[1].rotation.z = -0.3; }

const LOOK = { // made-up people. Grimy palettes; no uniforms or logos of anything real
  rooney: { top: 0x4a4436, bottom: 0x2a2620, skin: 0xc8946a, hair: 0x6a6a64, hairStyle: 'bald', bulk: 1.25 },
  junk1: { top: 0x3a3a30, bottom: 0x22201c, skin: 0xb0866a, hair: 0x2a1a10, hairStyle: 'long' },
  junk2: { top: 0x5a2a20, bottom: 0x2a2a2e, skin: 0x7a5038, hair: 0x111111, hairStyle: 'cap' },
  junk3: { top: 0x2a3a40, bottom: 0x3a3428, skin: 0xd8b090, hair: 0x9a7a4a, hairStyle: 'short' },
  junk4: { top: 0x6a6450, bottom: 0x1e1e20, skin: 0x5a3a28, hair: 0x111111, hairStyle: 'mohawk' },
  doc: { top: 0xd0ccbc, bottom: 0x2a2c30, skin: 0xd8b8a0, hair: 0xb8b8b0, hairStyle: 'short', shades: true },
  towel: { top: 0x3a4a5a, bottom: 0x22252b, skin: 0xa07050, hair: 0x2a1a10, hairStyle: 'short' },
  benny: { top: 0x2e3a2a, bottom: 0x2a2420, skin: 0xc8946a, hair: 0x1a1410, hairStyle: 'short', bulk: 1.3 },
  knuckles: { top: 0x1a1a1c, bottom: 0x1a1a1c, skin: 0x5a3a28, hair: 0x0a0a0a, hairStyle: 'bald', bulk: 1.45, shades: true },
  ro: { top: 0x8a3a5a, bottom: 0x2a2228, skin: 0xd0a07a, hair: 0x9a9a9a, hairStyle: 'bun' },
  regular: { top: 0x5a5040, bottom: 0x3a3a3a, skin: 0xe0b090, hair: 0x3a2a1a, hairStyle: 'long' }
};
// a sawed-off: two barrels, a stubby grip; parented to the torso so it moves with the arms
function giveShotgun(p, k) {
  const gun = new THREE.Group(), dark = k.mat(0x1a1a1c, { metalness: 0.7, roughness: 0.35 }), wood = k.mat(0x4a2e1a);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(k.G.cyl, dark); b.scale.set(0.03, 0.62, 0.03); b.rotation.x = PI / 2; b.position.set(s * 0.032, 0, -0.32); gun.add(b); }
  const st = new THREE.Mesh(k.G.box, wood); st.scale.set(0.09, 0.12, 0.3); st.position.set(0, -0.04, 0.05); gun.add(st);
  gun.position.set(0.05, 0.42, -0.32); p.torso.add(gun); p.gun = gun;
  const flash = new THREE.Mesh(k.G.sph, k.om(0xffd27a, { basic: true, transparent: true, opacity: 0.9 })); flash.scale.setScalar(0.16); flash.position.set(0, 0, -0.72); flash.visible = false; gun.add(flash); p.flash = flash;
}
// grubby trash scatter: bottles, cans, takeaway boxes, cig butts (instanced: one draw call each)
function trash(k, area, n, s = 1) {
  let sd = s * 977 + 3; const r = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const [x0, x1, z0, z1] = area, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const kinds = [[k.G.cyl, k.mat(0x3a5a2a, { roughness: 0.3 }), [0.04, 0.24, 0.04]], [k.G.cyl, k.mat(0x8a8a90, { metalness: 0.6 }), [0.035, 0.12, 0.035]], [k.G.box, k.mat(0x8a6a40), [0.3, 0.05, 0.3]], [k.G.box, k.mat(0xd8d0c0), [0.02, 0.02, 0.07]]];
  for (const [geo, m, [a, b, c]] of kinds) {
    const im = new THREE.InstancedMesh(geo, m, n); k.own.push({ dispose: () => im.dispose() });
    for (let i = 0; i < n; i++) { const lie = r() < 0.7; e.set(lie ? PI / 2 : 0, r() * 6.28, 0); q.setFromEuler(e); v.set(x0 + r() * (x1 - x0), lie ? a : b / 2, z0 + r() * (z1 - z0)); sc.set(a, b, c); m4.compose(v, q, sc); im.setMatrixAt(i, m4); }
    k.g.add(im);
  }
}
// needles + a bent spoon + a stub candle (the back room of a flophouse)
function works(k, x, z) { const steel = k.mat(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }); for (let i = 0; i < 4; i++) k.cyl(x + i * 0.13 - 0.2, 0.012, z + (i % 2) * 0.12, 0.006, 0.16, steel, PI / 2, i * 0.7); k.box(x + 0.25, 0.01, z - 0.15, 0.05, 0.01, 0.16, steel); const fl = k.sph(x - 0.3, 0.1, z - 0.2, 0.025, 0.05, 0.025, k.om(0xffb040, { basic: true })); k.cyl(x - 0.3, 0.04, z - 0.2, 0.03, 0.08, k.mat(0xe8e0d0)); k.ticks.push(t => { fl.scale.y = 0.04 + Math.abs(Math.sin(t * 13)) * 0.02; }); }
function bunk(k, x, z, ry, s, two = true) {
  const steel = k.mat(0x4a4e50, { metalness: 0.6, roughness: 0.5 }), mm = k.tm(T.mattress(s));
  for (const dx of [-0.45, 0.45]) for (const dz of [-0.95, 0.95]) k.box(x + dx, two ? 0.95 : 0.25, z + dz, 0.05, two ? 1.9 : 0.5, 0.05, steel);
  for (const y of two ? [0.4, 1.4] : [0.4]) { k.box(x, y - 0.06, z, 0.95, 0.04, 1.95, steel); k.box(x, y + 0.04, z, 0.88, 0.16, 1.85, mm); }
}
function tube(k, x, y, z, len, ry = 0) { const m = k.om(0xe8fff4, { basic: true }); k.box(x, y, z, len, 0.05, 0.08, k.mat(0x6a6e70), ry); k.box(x, y - 0.04, z, len * 0.95, 0.04, 0.05, m, ry); return m; }
// flicker helper: on/off stutter with long steady gaps; returns 0..1 brightness
export function flick(t, n = 0) { const c = (t * 0.6 + n * 1.7) % 6; if (c < 4.6) return 1; return Math.sin(t * 61 + n) > 0.2 ? 1 : (Math.sin(t * 23) > 0 ? 0.25 : 0.05); }

// =====================================================================================================================
export const ROOMS = {
  // ---------------- flophouse: front hall + Rooney's booth, a dorm with bunks, a back room nobody cleans ----------------
  flats_flop: {
    def: { name: 'Flophouse', w: 14, d: 12, h: 3.2, wall: 0x4a4236, floor: 0x2e2a22, ceil: 0x1e1a14, trim: 0x8a6a2a, light: { color: 0xd8c08a, int: 30 } },
    layout(api, S) {
      const W = (x, z, hw, hd) => api.col(x, z, hw, hd, 'wall');
      W(-5.75, 1.5, 1.25, 0.1); W(-0.9, 1.5, 2.1, 0.1); W(4.8, 1.5, 2.2, 0.1); W(0, -2.25, 0.1, 3.75); // partitions: hall | dorm | back room
      api.col(5.5, 3.1, 1.5, 1.5, 'tall'); api.col(-5.2, 4.3, 1.1, 0.45); // Rooney's booth, the couch
      for (const x of [-5.8, -3.6, -1.4]) api.col(x, -5, 0.5, 1.0, 'tall'); api.col(6.2, -5.3, 0.6, 0.7); W(5.3, -5.1, 0.06, 0.9);
      api.spot({ id: 'fx:flop:desk', x: 3.2, z: 3.1, r: 1.4, label: '🛏 Rooney · rent a bunk' });
      api.spot({ id: 'fx:flop:bunk', x: -3.6, z: -3.5, r: 1.2, label: '🛏 Sleep in your bunk', cond: () => !!S.rented });
      api.spot({ id: 'fx:flop:junkie', x: 2.9, z: -2.6, r: 1.5, label: '💬 Twitchy guy' });
      api.spot({ id: 'fx:flop:nod', x: -5.2, z: 3.3, r: 1.2, label: '💬 Couch guy' });
    },
    dress(k, def, S) {
      k.shell(def, T.wall(0x6a5c44, { s: 11, dirt: 1.4, repeat: [3, 1] }), T.floor(0x4a4234, { s: 12, spills: 10, blood: 1, repeat: [3, 3] }));
      const ply = k.tm(T.wall(0x7a6a4a, { s: 13, dirt: 1.1, repeat: [2, 1] }), { roughness: 0.95 });
      k.box(-5.75, 1.6, 1.5, 2.5, 3.2, 0.12, ply); k.box(-0.9, 1.6, 1.5, 4.2, 3.2, 0.12, ply); k.box(4.8, 1.6, 1.5, 4.4, 3.2, 0.12, ply); k.box(0, 1.6, -2.25, 0.12, 3.2, 7.5, ply);
      for (const x of [-3.75, 1.9]) k.box(x, 2.9, 1.5, 1.5, 0.6, 0.12, ply); // lintels
      // Rooney's booth: plywood box, scratched plexi window, a TV of static, a cash slot
      k.box(5.5, 0.55, 1.65, 3.0, 1.1, 0.1, ply); k.box(4.05, 0.55, 3.1, 0.1, 1.1, 2.9, ply); k.box(5.5, 2.6, 3.1, 3.0, 0.1, 3.0, ply); k.box(4.05, 2.15, 3.1, 0.1, 0.9, 2.9, ply);
      k.box(4.05, 1.62, 3.1, 0.04, 1.0, 2.9, k.om(0xc8d8c0, { transparent: true, opacity: 0.22, roughness: 0.1 }));
      k.box(4.25, 1.1, 3.1, 0.5, 0.05, 1.2, k.mat(0x5a4a32));
      const tv = k.box(6.6, 1.35, 2.3, 0.5, 0.38, 0.05, k.tm(T.staticScreen(), { emissive: 0xffffff, emissiveIntensity: 0.6 }), PI / 2.4); k.box(6.68, 1.35, 2.3, 0.55, 0.45, 0.3, k.mat(0x1a1a1a), PI / 2.4);
      k.ticks.push((t) => { if ((t * 12 | 0) % 2) tv.material.map.offset.set(Math.random(), Math.random()); });
      tv.material.map.wrapS = tv.material.map.wrapT = THREE.RepeatWrapping;
      k.person(LOOK.rooney, 5.7, 3.3, PI / 2, (p, t) => { sit(p); p.head.rotation.y = 0.4 + Math.sin(t * 0.2) * 0.3; p.arms[1].rotation.x = 0.9; p.arms[0].rotation.x = 0.6; });
      k.decal(T.note('BUNK 15\nSHEETS 5 (OUT)\nNO REFUNDS', { s: 1 }), 4.0, 2.1, 2.2, 0.6, 0.3, { ry: PI / 2 });
      k.decal(T.note('NO COOKING\nNO FIGHTING\nNO DYING', { s: 2 }), -2.4, 1.9, 1.58, 0.9, 0.45);
      k.neon('RESTWELL', 0xffb040, 0, 2.7, 1.58, 0, 2.4);
      // the couch and the guy who lives on it
      const vinyl = k.mat(0x4a2a1a, { roughness: 0.5 }); k.box(-5.2, 0.25, 4.3, 2.2, 0.5, 0.9, vinyl); k.box(-5.2, 0.7, 4.65, 2.2, 0.6, 0.2, vinyl); k.box(-6.2, 0.45, 4.3, 0.2, 0.4, 0.9, vinyl);
      k.floorDecal(T.pool(5, 'rgba(40,30,8,A)'), -4.6, 3.6, 1.2, 1.0);
      S.nodder = k.person(LOOK.junk1, -5.0, 4.2, PI, (p, t, n) => { nod(p, t, n, false); p.hips.position.y = 0.55; }, 1);
      k.box(-3.2, 0.9, 5.6, 0.8, 1.8, 0.7, k.mat(0x3a4048, { metalness: 0.4 })); k.decal(T.note('OUT OF\nORDER', { s: 3, paper: '#e8e0c8' }), -3.2, 1.2, 5.24, 0.5, 0.3, { ry: PI }); // dead vending machine
      trash(k, [-6.6, 3.5, 2, 5.6], 9, 1);
      // dorm: three bunks against the back wall, two sleepers, a floor mattress and a nodder by the wall
      bunk(k, -5.8, -5, 0, 1); bunk(k, -3.6, -5, 0, 2); bunk(k, -1.4, -5, 0, 3);
      k.person(LOOK.junk3, -5.8, -5.9, 0, (p, t, n) => { lie(p, t, n); p.group.position.y = 0.52; }, 2);
      k.person(LOOK.junk2, -1.4, -5.9, 0, (p, t, n) => { lie(p, t, n); p.group.position.y = 1.52; }, 3);
      k.box(-6.2, 0.08, -1.0, 0.9, 0.16, 1.9, k.tm(T.mattress(4)));
      k.person(LOOK.junk4, -6.6, 0.6, PI * 0.75, (p, t, n) => nod(p, t, n, true), 4);
      k.floorDecal(T.pool(6, 'rgba(70,50,10,A)'), -2.5, -2.0, 1.4, 1.1); trash(k, [-6.8, -0.3, -3.8, 1.2], 7, 2);
      k.decal(T.tag('GORDO WUZ HERE', 0x40e0ff, { s: 1 }), -4.5, 2.1, -5.98, 2, 0.75);
      // back room: the gallery. Mattresses on the floor, works on a crate, the stall with no door
      for (const [x, z, ry, s] of [[1.6, -4.9, 0.1, 5], [4.2, -0.6, PI / 2, 6]]) k.box(x, 0.07, z, 0.9, 0.14, 1.9, k.tm(T.mattress(s)), ry);
      k.person(LOOK.junk1, 1.6, -5.6, 0, (p, t, n) => { lie(p, t, n); p.group.position.y = 0.16; }, 5);
      k.person(LOOK.junk3, 6.6, -1.6, PI / 2, (p, t, n) => nod(p, t, n, true), 6);
      S.twitch = k.person(LOOK.junk2, 3.0, -3.4, PI * 0.9, (p, t, n) => scratch(p, t, n), 7);
      k.box(3.2, 0.25, -5.4, 0.6, 0.5, 0.5, k.mat(0x6a5030)); works(k, 3.2, -4.6);
      k.box(6.3, 0.22, -5.5, 0.45, 0.44, 0.6, k.mat(0x8a8068, { roughness: 0.4 })); k.box(6.3, 0.55, -5.82, 0.45, 0.5, 0.14, k.mat(0x8a8068)); k.floorDecal(T.pool(7, 'rgba(70,56,10,A)'), 6.2, -4.9, 1.2, 1);
      k.box(5.3, 1.2, -5.1, 0.06, 2.4, 1.8, ply);
      k.decal(T.tag('SALTBLOOD', 0xff3040, { s: 2 }), 3.5, 1.9, -5.98, 2.2, 0.8); k.decal(T.tag('RUSK EATS IT', 0xf0f0e0, { s: 3 }), 6.98, 1.6, -3.2, 2, 0.75, { ry: -PI / 2 });
      k.floorDecal(T.gauze(9, 1.1), 2.1, -2.2, 0.4, 0.4); trash(k, [0.4, 6.6, -5.8, 1.0], 10, 3);
      // bare bulbs, one of them dying
      const bulbs = [[-3.5, -2.5], [3.5, -2.5], [-2, 4]].map(([x, z], i) => { k.cyl(x, 2.95, z, 0.01, 0.5, k.mat(0x111111)); return k.sph(x, 2.68, z, 0.07, 0.09, 0.07, k.om(0xfff0c0, { basic: true })); });
      k.ticks.push(t => { const f = flick(t, 2); bulbs[1].material.color.setScalar(f); });
    }
  },
  // ---------------- back-alley chop clinic: a "dental" front, a dentist chair, a cooler of organs ----------------
  flats_clinic: {
    def: { name: 'Chop clinic', w: 9, d: 8, h: 3, wall: 0x5a6a5c, floor: 0x3a3e38, ceil: 0x2a2e2a, trim: 0x6aff9a, light: { color: 0xc8f0d8, int: 38 } },
    layout(api) {
      api.col(1.5, -1.8, 0.45, 0.95); api.col(2.75, -1.1, 0.32, 0.3); api.col(-3.3, -3.0, 0.55, 0.38); api.col(0.2, -3.72, 1.6, 0.28, 'tall'); api.col(-3.75, 2.5, 0.35, 0.9); api.col(3.9, 1.2, 0.35, 0.4);
      api.spot({ id: 'fx:clinic:chair', x: 1.5, z: -0.45, r: 1.5, label: '🩸 Doc Varga · patch-up' });
      api.spot({ id: 'fx:clinic:cooler', x: -2.6, z: -2.2, r: 1.1, label: '🧊 The cooler' });
      api.spot({ id: 'fx:clinic:towel', x: -2.7, z: 2.6, r: 1.1, label: '💬 Guy with a towel' });
    },
    dress(k, def, S) {
      k.shell(def, T.wall(0x8a9a88, { s: 21, dirt: 1.2, repeat: [4, 1] }), T.floor(0x6a6e60, { s: 22, tiles: 10, spills: 5, blood: 7, repeat: [2, 2] }));
      // dentist chair: base, seat, reclined back, headrest, armrests, a swing-arm lamp
      const vinyl = k.mat(0x2a5a5a, { roughness: 0.45 }), chrome = k.mat(0xb0b8c0, { metalness: 0.8, roughness: 0.25 });
      k.cyl(1.5, 0.25, -1.6, 0.18, 0.5, chrome); k.box(1.5, 0.55, -1.4, 0.7, 0.15, 0.8, vinyl); k.box(1.5, 0.85, -2.1, 0.66, 0.12, 0.8, vinyl, 0, -0.75); k.box(1.5, 1.2, -2.5, 0.3, 0.2, 0.2, vinyl, 0, -0.75);
      k.box(1.5, 0.35, -0.75, 0.55, 0.1, 0.5, vinyl, 0, 0.5); for (const s of [-1, 1]) k.box(1.5 + s * 0.4, 0.72, -1.5, 0.08, 0.06, 0.6, chrome);
      k.cyl(2.3, 1.2, -2.6, 0.03, 2.4, chrome); k.box(1.95, 2.35, -2.2, 0.8, 0.04, 0.04, chrome, -0.6); const lamp = k.sph(1.6, 2.3, -1.9, 0.14, 0.08, 0.1, k.om(0xfff8e0, { basic: true }));
      for (const s of [-1, 1]) k.box(1.5 + s * 0.2, 0.6, -1.3, 0.04, 0.05, 0.4, k.mat(0x6a4a2a)); // wrist straps
      k.floorDecal(T.pool(11), 1.6, -1.1, 1.8, 1.6); k.floorDecal(T.pool(12), 0.6, -0.3, 0.7, 0.6);
      // instrument tray + tools, an IV stand with a dark bag, a bucket of pink water
      k.cyl(2.75, 0.45, -1.1, 0.03, 0.9, chrome); k.box(2.75, 0.92, -1.1, 0.6, 0.03, 0.45, chrome);
      for (let i = 0; i < 6; i++) k.box(2.55 + (i % 3) * 0.13, 0.945, -1.22 + (i > 2 ? 0.22 : 0), 0.02, 0.012, 0.2, chrome, (i - 3) * 0.2);
      k.box(2.9, 0.95, -0.95, 0.12, 0.04, 0.12, k.tm(T.gauze(31, 1.2), { transparent: true }));
      k.cyl(0.5, 0.9, -2.3, 0.02, 1.8, chrome); k.box(0.5, 1.75, -2.3, 0.18, 0.28, 0.06, k.mat(0x6a0a0a, { roughness: 0.3 })); k.cyl(0.6, 1.1, -2.0, 0.006, 1.2, k.mat(0x8a1010), 0.4);
      k.cyl(-0.5, 0.18, -0.9, 0.2, 0.36, k.mat(0x8a8a8a, { metalness: 0.5 })); k.cyl(-0.5, 0.35, -0.9, 0.18, 0.01, k.mat(0xa04050, { roughness: 0.1 }));
      for (const [x, z, s, q] of [[0.8, -0.2, 1, 1], [2.2, 0.1, 2, 0.8], [-0.3, -1.4, 3, 1.2], [0.2, 0.7, 4, 0.6], [2.8, -0.2, 5, 1], [-0.9, 0.2, 6, 0.9]]) k.floorDecal(T.gauze(s, q), x, z, 0.35 + q * 0.15, 0.35 + q * 0.15, s, 0.015);
      // back cabinet: brown bottles, a jar of teeth, a sharps bin that is mostly not sharps
      const cab = k.mat(0xc8c8b8, { roughness: 0.5 }); k.box(0.2, 0.9, -3.72, 3.2, 1.8, 0.5, cab); k.box(0.2, 1.82, -3.72, 3.3, 0.04, 0.55, chrome);
      for (let i = 0; i < 9; i++) k.cyl(-1.1 + i * 0.3, 1.95, -3.7, 0.05, 0.2, k.mat([0x5a3010, 0x3a5a2a, 0x8a8a90][i % 3], { roughness: 0.2 }));
      k.cyl(1.4, 1.95, -3.6, 0.09, 0.2, k.om(0xd8e8f0, { transparent: true, opacity: 0.5 })); for (let i = 0; i < 8; i++) k.sph(1.37 + (i % 3) * 0.03, 1.88 + (i / 3 | 0) * 0.04, -3.6, 0.018, 0.026, 0.018, k.mat(0xf0ecd8));
      k.box(-1.0, 0.25, -3.2, 0.35, 0.5, 0.35, k.mat(0xc02020)); k.decal(T.note('SHARPS\n(+ OTHER)', { s: 41, paper: '#f0e8d0' }), -1.0, 0.35, -3.02, 0.3, 0.16);
      // THE COOLER: lid up, ice, and a few things that used to be in somebody
      const cool = k.mat(0xe8e8e0, { roughness: 0.4 }); k.box(-3.3, 0.3, -3.0, 1.0, 0.6, 0.65, cool); k.box(-3.3, 0.85, -3.37, 1.0, 0.55, 0.06, cool, 0, -0.35);
      k.box(-3.3, 0.58, -3.0, 0.9, 0.04, 0.55, k.mat(0xbfe0f0, { roughness: 0.05, metalness: 0.1 }));
      const meat = k.mat(0x6a0a10, { roughness: 0.25 }), meat2 = k.mat(0x8a2a30, { roughness: 0.25 });
      k.sph(-3.55, 0.64, -3.0, 0.11, 0.06, 0.07, meat); k.sph(-3.3, 0.65, -2.88, 0.09, 0.08, 0.08, meat2); k.sph(-3.05, 0.64, -3.08, 0.12, 0.05, 0.08, meat); k.sph(-3.2, 0.66, -3.15, 0.05, 0.05, 0.05, k.mat(0xd8d0c0));
      k.decal(T.note('FRESH\nNOT 4 SALE (ASK)', { s: 42, paper: '#ffffff', ink: '#8a0a0a' }), -3.3, 0.35, -2.66, 0.6, 0.3);
      k.floorDecal(T.pool(13, 'rgba(110,10,10,A)'), -3.0, -2.3, 0.8, 0.5);
      // curtain on a rail (half drawn, stained), waiting chairs, a guy holding his head together with a towel
      k.box(-0.5, 2.6, 0.6, 4.2, 0.03, 0.03, chrome); k.box(-1.6, 1.45, 0.6, 1.8, 2.3, 0.02, k.tm(T.wall(0xb8d0c0, { s: 43, dirt: 0.8, repeat: [1, 1] }), { transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      for (const z of [2.0, 3.0]) { k.box(-3.75, 0.45, z, 0.5, 0.06, 0.5, k.mat(0xd06a20)); k.box(-4.0, 0.75, z, 0.06, 0.5, 0.5, k.mat(0xd06a20)); for (const dx of [-0.2, 0.2]) k.box(-3.75 + dx, 0.22, z, 0.03, 0.45, 0.45, chrome); }
      S.towel = k.person(LOOK.towel, -3.7, 2.0, -PI / 2, (p, t, n) => holdHead(p, t, n), 1);
      { const tw = new THREE.Mesh(k.G.box, k.tm(T.gauze(44, 1.5))); tw.scale.set(0.2, 0.08, 0.22); tw.position.set(0.12, 0.12, 0); S.towel.head.add(tw); }
      k.floorDecal(T.pool(14), -3.0, 2.1, 0.6, 0.5);
      // Doc Varga: stained coat, headlamp, working on air
      S.doc = k.person(LOOK.doc, 2.65, -2.55, PI * 0.85, (p, t) => work(p, t));
      { const hl = new THREE.Mesh(k.G.sph, k.om(0xfff8d0, { basic: true })); hl.scale.set(0.035, 0.035, 0.02); hl.position.set(0, 0.1, -0.14); S.doc.head.add(hl); }
      { const st = new THREE.Mesh(k.G.box, k.mat(0x7a0a0a)); st.scale.set(0.3, 0.25, 0.01); st.position.set(0.05, 0.3, -0.13); S.doc.torso.add(st); } // blood on the coat
      // signs: the neon front, the house rules, a poster
      k.neon('BAY SIX DENTAL', 0x6aff9a, 0.2, 2.45, -3.99, 0, 2.6);
      k.decal(T.note('CASH ONLY\nNO NAMES\nNO POLICE\nNO REFUNDS ON PARTS', { s: 45 }), -4.49, 1.7, -0.8, 0.8, 0.6, { ry: PI / 2 });
      k.decal(T.note('SMILE!\nYOU STILL\nHAVE TEETH', { s: 46, paper: '#f8f0c8', ink: '#203080' }), 4.49, 1.6, -1.6, 0.6, 0.6, { ry: -PI / 2 });
      k.box(3.9, 0.45, 1.2, 0.6, 0.9, 0.7, k.mat(0x3a3e40, { metalness: 0.4 })); k.decal(T.note('MEDICAL WASTE', { s: 47, paper: '#f0d040' }), 3.59, 0.6, 1.2, 0.5, 0.2, { ry: -PI / 2 });
      const tm = tube(k, 0.3, 2.94, -0.5, 2.2), tm2 = tube(k, -2.2, 2.94, 2.2, 1.6);
      k.ticks.push(t => { tm.color.setScalar(flick(t, 5)); tm2.color.setScalar(0.85 + 0.15 * flick(t, 9)); lamp.material.color.setScalar(0.8 + 0.2 * Math.sin(t * 50)); });
    }
  },
  // ---------------- pawn shop: caged counter, junk shelves, Benny and his sawed-off ----------------
  flats_pawn: {
    def: { name: 'Pawn shop', w: 10, d: 9, h: 3.4, wall: 0x4a3e30, floor: 0x2a2620, ceil: 0x1e1a16, trim: 0xffd040, light: { color: 0xffd8a0, int: 34 } },
    layout(api) {
      api.col(0, -1.2, 5, 0.1, 'tall'); api.col(0, -0.85, 1.6, 0.3); api.col(-3.4, 1.2, 0.9, 0.42); api.col(4.6, 1.0, 0.3, 1.6, 'tall'); api.col(-4.55, 2.6, 0.35, 0.6);
      api.spot({ id: 'fx:pawn:cage', x: 0, z: 0.05, r: 1.5, label: '💍 Benny · fence goods' });
      api.spot({ id: 'fx:pawn:case', x: -3.4, z: 2.1, r: 1.0, label: '💎 Jewelry case' });
    },
    dress(k, def, S) {
      k.shell(def, T.wall(0x6a5a44, { s: 31, dirt: 1.0, repeat: [3, 1] }), T.floor(0x50463a, { s: 32, spills: 6, repeat: [3, 3] }));
      // the cage: a welded grid floor to ceiling, one instanced draw
      const steel = k.mat(0x5a5e60, { metalness: 0.7, roughness: 0.45 }), n = 40, im = new THREE.InstancedMesh(k.G.box, steel, n + 4); k.own.push({ dispose: () => im.dispose() });
      const m4 = new THREE.Matrix4(); for (let i = 0; i < n; i++) { m4.makeScale(0.03, 3.4, 0.03).setPosition(-5 + (i + 0.5) * 0.25, 1.7, -1.2); im.setMatrixAt(i, m4); }
      [0.2, 1.3, 2.4, 3.3].forEach((y, j) => { m4.makeScale(10, 0.04, 0.04).setPosition(0, y, -1.2); im.setMatrixAt(n + j, m4); }); k.g.add(im);
      // counter under the cage with a pass-through slot, a bell, a sign
      const wood = k.mat(0x4a3220, { roughness: 0.7 }); k.box(0, 0.55, -0.9, 3.2, 1.1, 0.55, wood); k.box(0, 1.12, -0.95, 3.3, 0.05, 0.75, k.mat(0x2a2a2a, { roughness: 0.3 }));
      k.box(0, 1.25, -1.2, 0.6, 0.2, 0.06, k.mat(0x111111)); k.cyl(0.9, 1.17, -0.8, 0.05, 0.05, k.mat(0xd8c070, { metalness: 0.8 }));
      k.neon('GOLD STAR PAWN', 0xffd040, 0, 2.95, -4.48, 0, 3.2);
      k.decal(T.note('WE BUY GOLD · TECH\nTOOLS · "FOUND" ITEMS\nNO QUESTIONS', { s: 33, w: 320, h: 140 }), -2.6, 2.75, -4.48, 1.4, 0.6);
      k.decal(T.note('NO REFUNDS\nNO CREDIT\nNO CRYING', { s: 34 }), 0.9, 1.75, -1.15, 0.5, 0.25);
      k.decal(T.note('SMILE, YOU\u2019RE\nON CAMERA', { s: 35, paper: '#f0e080' }), -4.98, 2.0, -0.2, 0.7, 0.35, { ry: PI / 2 });
      k.decal(T.note('LOANS 40%\nWEEKLY', { s: 36, paper: '#e0f0e0' }), 4.3, 2.8, -4.48, 0.6, 0.3);
      k.sph(-4.4, 3.3, -0.6, 0.12, 0.09, 0.12, k.mat(0x111111, { roughness: 0.2 })); const cam = k.sph(-4.4, 3.25, -0.48, 0.02, 0.02, 0.02, k.om(0xff2020, { basic: true }));
      // behind the cage: shelves of other people's lives
      for (const y of [0.6, 1.4, 2.2]) k.box(0, y, -4.2, 9.6, 0.05, 0.55, wood);
      for (let i = 0; i < 4; i++) { k.box(-4 + i * 1.1, 1.65, -4.2, 0.7, 0.45, 0.4, k.mat(0x1a1a1a)); k.box(-4 + i * 1.1, 1.65, -3.99, 0.56, 0.34, 0.01, k.tm(T.staticScreen(), { emissive: 0xffffff, emissiveIntensity: i === 2 ? 0.5 : 0.05 })); }
      for (let i = 0; i < 6; i++) k.box(0.6 + i * 0.7, 0.8, -4.2, 0.4, 0.35, 0.3, k.mat([0x3a3a3a, 0x7a5a2a, 0x2a4a6a, 0x6a2a2a][i % 4], { metalness: 0.3 }));
      for (let i = 0; i < 5; i++) k.box(1.2 + i * 0.75, 2.45, -4.25, 0.35, 0.4, 0.35, k.mat([0xc0c0c0, 0x2a2a2a, 0xd8a020][i % 3], { metalness: 0.5, roughness: 0.3 })); // helmets / drills
      k.box(-3.6, 0.45, -2.6, 0.9, 0.9, 0.8, k.mat(0x2a3a2a, { metalness: 0.6 })); k.cyl(-3.6, 0.5, -2.18, 0.1, 0.03, k.mat(0xc0c0c0, { metalness: 0.9 }), PI / 2); // floor safe
      k.cyl(3.5, 0.3, -2.5, 0.3, 0.6, k.mat(0x7a7a6a, { metalness: 0.4 })); // drum of "bits"
      // Benny: big, bored, sawed-off across his gut
      S.benny = k.person(LOOK.benny, 0.3, -2.0, PI, (p, t) => shotgun(p, t, S.mode || 0)); giveShotgun(S.benny, k);
      S.flash = S.benny.flash;
      // customer side: jewelry case, a guitar wall, a mannequin in a stained wedding suit
      k.box(-3.4, 0.45, 1.2, 1.8, 0.9, 0.8, k.mat(0x2a2c30, { metalness: 0.5 })); k.box(-3.4, 0.92, 1.2, 1.7, 0.03, 0.7, k.mat(0xfff0d0, { basic: true })); k.box(-3.4, 1.12, 1.2, 1.8, 0.4, 0.8, k.om(0xbfe8ff, { transparent: true, opacity: 0.18, depthWrite: false }));
      for (let i = 0; i < 7; i++) k.sph(-4.1 + i * 0.23, 0.97, 1.1 + (i % 2) * 0.2, 0.04, 0.02, 0.04, k.mat(i % 2 ? 0xffd040 : 0xd8d8e0, { metalness: 0.9, roughness: 0.2 }));
      for (let i = 0; i < 4; i++) { const z = -0.2 + i * 0.75; k.box(4.85, 1.4, z, 0.08, 0.9, 0.36, k.mat([0x8a4a1a, 0x1a1a1a, 0xc02020, 0xe0d0b0][i])); k.box(4.85, 2.2, z, 0.05, 0.7, 0.06, k.mat(0x2a1a10)); }
      k.box(4.6, 0.2, 1.0, 0.5, 0.4, 3.2, wood);
      const mq = k.person({ top: 0xe8e0d0, bottom: 0xe8e0d0, skin: 0xd8d0c8, hair: 0xd8d0c8, hairStyle: 'bald' }, -4.55, 2.6, -PI / 2, null); mq.arms[0].rotation.z = -0.3; k.box(-4.5, 1.6, 2.6, 0.3, 0.2, 0.35, k.mat(0x7a1010));
      k.floorDecal(T.pool(37, 'rgba(40,30,10,A)'), 0.3, 1.6, 1.4, 1.0); trash(k, [-4.5, 4.2, 0.0, 4.2], 4, 4);
      const tm = tube(k, -1.5, 3.34, 1.2, 2.4), tm2 = tube(k, 1.5, 3.34, -2.8, 2.4);
      k.ticks.push(t => { tm.color.setScalar(0.85 + 0.15 * flick(t, 3)); cam.visible = (t % 1.2) < 0.6; if (S.flashT > 0) { S.flash.visible = true; } else if (S.flash) S.flash.visible = false; });
    }
  },
  // ---------------- laundromat front: dead machines, flicker, Knuckles on the back door, Auntie Ro's counting room ----------------
  flats_laund: {
    def: { name: 'Laundromat', w: 12, d: 10, h: 3.2, wall: 0x5a6a70, floor: 0x3a3e40, ceil: 0x2a2e30, trim: 0x40e0ff, light: { color: 0xd8f0ff, int: 40 } },
    layout(api, S) {
      const W = (x, z, hw, hd) => api.col(x, z, hw, hd, 'wall');
      W(-2.25, -1.8, 3.75, 0.1); W(4.3, -1.8, 1.7, 0.1); S.doorCol = api.col(2.05, -1.8, 0.56, 0.12, 'wall');
      api.col(-5.4, 1.6, 0.45, 2.6, 'tall'); api.col(5.4, 1.4, 0.45, 2.4, 'tall'); api.col(0, 1.4, 1.2, 0.45); api.col(3.3, -1.25, 0.3, 0.3); api.col(0, -3.6, 1.25, 0.5); api.col(-5.5, -3.4, 0.4, 1.4, 'tall');
      api.spot({ id: 'fx:laund:knuckles', x: 2.05, z: -0.75, r: 1.2, label: '🚪 Back room · Knuckles', cond: () => !S.open });
      api.spot({ id: 'fx:laund:wash', x: 0.6, z: -2.65, r: 1.3, label: '💵 Auntie Ro · wash dirty cash' });
      api.spot({ id: 'fx:laund:dryer', x: 4.45, z: 2.6, r: 1.0, label: '🦶 Kick dryer six' });
      api.spot({ id: 'fx:laund:regular', x: -2.9, z: 3.1, r: 1.1, label: '💬 Lady watching the drum' });
    },
    dress(k, def, S) {
      k.shell(def, T.wall(0x7a8a8a, { s: 51, dirt: 1.1, repeat: [4, 1] }), T.floor(0x6a6a62, { s: 52, tiles: 12, spills: 8, repeat: [3, 3] }));
      const enamel = k.mat(0xd8d8cc, { roughness: 0.35 }), chrome = k.mat(0xa0a8b0, { metalness: 0.8, roughness: 0.3 }), glass = k.mat(0x223038, { roughness: 0.05, metalness: 0.4 });
      // washers along the west wall (two taped dead), dryers stacked on the east
      S.drums = [];
      for (let i = 0; i < 5; i++) { const z = -0.6 + i * 1.0; k.box(-5.4, 0.5, z, 0.85, 1.0, 0.9, enamel); const dr = k.cyl(-4.97, 0.55, z, 0.28, 0.02, glass, 0, PI / 2); k.cyl(-4.96, 0.55, z, 0.31, 0.02, chrome, 0, PI / 2); S.drums.push(dr); if (i === 1 || i === 3) k.decal(T.note('BROKE\nDONT', { s: 53 + i, paper: '#f0e070' }), -4.95, 0.9, z, 0.4, 0.22, { ry: PI / 2 }); }
      for (let i = 0; i < 5; i++) for (const y of [0.5, 1.5]) { const z = -0.6 + i * 1.0; k.box(5.4, y, z, 0.85, 0.95, 0.9, enamel); k.cyl(4.97, y + 0.05, z, 0.3, 0.02, glass, 0, PI / 2); }
      k.decal(T.note('6', { s: 60, paper: '#ffffff' }), 4.96, 1.05, 2.4, 0.2, 0.2, { ry: -PI / 2 }); S.dryer6 = k.box(5.4, 1.0, 3.4, 0.86, 0.04, 0.9, k.mat(0x8a8a80));
      // folding table, a lost sock pile, plastic chairs, the regular who just watches
      k.box(0, 0.85, 1.4, 2.4, 0.06, 0.9, k.mat(0xc8c0a0)); for (const dx of [-1.1, 1.1]) for (const dz of [-0.35, 0.35]) k.box(dx, 0.42, 1.4 + dz, 0.05, 0.84, 0.05, chrome);
      for (let i = 0; i < 5; i++) k.sph(-0.5 + i * 0.2, 0.92, 1.3 + (i % 2) * 0.15, 0.12, 0.05, 0.1, k.mat([0xe0e0e0, 0x2a2a6a, 0x8a2a2a, 0x3a3a3a, 0xc8b080][i]));
      for (const x of [-3.6, -2.9, -2.2]) { k.box(x, 0.42, 3.9, 0.5, 0.05, 0.5, k.mat(0x2a6a8a)); k.box(x, 0.7, 4.12, 0.5, 0.5, 0.05, k.mat(0x2a6a8a)); }
      k.person(LOOK.regular, -3.6, 3.9, PI * 0.6, (p, t) => { sit(p); p.head.rotation.y = -0.4; p.arms[0].rotation.x = 0.6; p.arms[1].rotation.x = 0.6; }, 1);
      k.box(-1.0, 0.95, 4.6, 0.9, 1.9, 0.7, k.mat(0x8a2a2a, { metalness: 0.3 })); k.decal(T.note('CHANGE\n(LIES)', { s: 61 }), -1.0, 1.3, 4.24, 0.4, 0.25, { ry: PI });
      k.decal(T.note('NOT RESPONSIBLE FOR\nLOST ITEMS · LOST FINGERS\nLOST FRIENDS', { s: 62, w: 320, h: 140 }), 0, 2.0, -1.72, 1.4, 0.6);
      k.decal(T.tag('WASH IT', 0x40e0ff, { s: 4 }), 4.4, 2.5, -1.72, 1.6, 0.6);
      k.neon('RINSE & REPEAT', 0x40e0ff, 0, 2.75, 4.98, PI, 2.8);
      k.floorDecal(T.pool(63, 'rgba(60,70,80,A)'), -4.2, 0.4, 1.6, 1.2); trash(k, [-4.6, 4.6, 0.4, 4.6], 5, 5);
      // the STAFF ONLY door and Knuckles
      S.door = k.box(2.05, 1.15, -1.8, 1.1, 2.3, 0.08, k.mat(0x3a3e40, { metalness: 0.5 })); k.decal(T.note('STAFF ONLY', { s: 64, paper: '#ffffff', ink: '#a01010' }), 2.05, 1.7, -1.75, 0.6, 0.18);
      k.box(-2.25, 1.6, -1.8, 7.5, 3.2, 0.12, k.tm(T.wall(0x6a7a7a, { s: 65, repeat: [3, 1] }))); k.box(4.3, 1.6, -1.8, 3.4, 3.2, 0.12, k.tm(T.wall(0x6a7a7a, { s: 66, repeat: [2, 1] }))); k.box(2.05, 2.75, -1.8, 1.1, 0.9, 0.12, k.mat(0x5a6a6a));
      S.knuckles = k.person(LOOK.knuckles, 3.3, -1.25, PI * 1.1, (p, t) => crossed(p, t));
      // back room: counting table, a bill counter, bricks of cash, detergent boxes that are not detergent
      k.box(0, 0.75, -3.6, 2.5, 0.06, 1.0, k.mat(0x3a2a1a)); for (const dx of [-1.15, 1.15]) for (const dz of [-0.4, 0.4]) k.box(dx, 0.37, -3.6 + dz, 0.06, 0.74, 0.06, k.mat(0x1a1a1a));
      const cm = k.tm(T.cash()); for (let i = 0; i < 8; i++) k.box(-0.9 + (i % 4) * 0.22, 0.81 + (i / 4 | 0) * 0.05, -3.4, 0.2, 0.05, 0.1, cm);
      k.box(0.6, 0.88, -3.6, 0.4, 0.22, 0.3, k.mat(0x2a2a2a)); S.counter = k.box(0.6, 0.97, -3.48, 0.2, 0.03, 0.08, k.mat(0x6aff6a, { basic: true }));
      for (let i = 0; i < 6; i++) k.box(-5.5, 0.3 + (i % 3) * 0.6, -3.9 + (i / 3 | 0) * 1.0, 0.6, 0.55, 0.8, k.mat(0xd06a20)); k.decal(T.note('SPINWELL\nSOAP (NOT)', { s: 67, paper: '#ffd080' }), -5.19, 0.9, -3.4, 0.6, 0.3, { ry: PI / 2 });
      k.box(2.6, 0.2, -4.4, 0.9, 0.4, 0.45, k.mat(0x1a1a1a)); // duffel
      S.ro = k.person(LOOK.ro, 0, -4.4, PI, (p, t) => count(p, t)); k.box(0, 0.45, -4.4, 0.5, 0.05, 0.5, k.mat(0x5a3a2a));
      // flickering tubes (the front ones stutter, the back room is steady and warm)
      const tubes = [tube(k, -2.5, 3.14, 0.8, 2.4), tube(k, 2.5, 3.14, 0.8, 2.4), tube(k, 0, 3.14, 3.6, 2.4), tube(k, 0, 3.14, -3.4, 1.6)];
      k.ticks.push((t, dt) => {
        tubes[0].color.setScalar(flick(t, 1)); tubes[1].color.setScalar(flick(t + 2.3, 4)); tubes[2].color.setScalar(0.7 + 0.3 * flick(t, 7));
        for (let i = 0; i < S.drums.length; i++) if (i === 2) S.drums[i].rotation.x += dt * 9;
        S.counter.visible = (t * 6 | 0) % 2 === 0;
        if (S.open && S.door.position.x < 3.0) S.door.position.x += dt * 2; if (!S.open && S.door.position.x > 2.05) S.door.position.x = 2.05;
      });
      k.flicker = t => 0.55 + 0.45 * Math.min(flick(t, 1), flick(t + 2.3, 4)); // drives the room light in flats-interiors.js
    }
  }
};
export const KINDS = Object.keys(ROOMS);
