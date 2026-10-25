// Multi-planet expansion: one signature vehicle per new colony. Registered into world.js through
// VEHICLES (driving spec) and VEHICLE_BUILDERS (mesh). Shared geometries from world.js (R.box/cyl/sph),
// a handful of meshes each, so they cost about the same draw calls as the stock buggy.
import * as THREE from 'three';

const mats = {};
const M = (k, c, o = {}) => mats[k] || (mats[k] = Object.assign(new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o }), { userData: { shared: true } }));
const G = (k, c) => mats[k] || (mats[k] = Object.assign(new THREE.MeshBasicMaterial({ color: c }), { userData: { shared: true } }));

export const EXT_VEHICLES = {
  acid_crawler: { name: 'Acid crawler', icon: '🛡', vmax: 14, boost: 22, acc: 7, bacc: 11, turn: 1.1, wy: 0.7, wr: 0.7, r: 3.1, tough: true },
  sun_skimmer: { name: 'Sun skimmer', icon: '🏎', vmax: 30, boost: 44, acc: 15, bacc: 22, turn: 1.6, wy: 0.42, wr: 0.42, r: 2.2 },
  methane_skiff: { name: 'Methane skiff', icon: '🛥', vmax: 24, boost: 36, acc: 11, bacc: 17, turn: 1.3, hover: 1.3, r: 2.8, lean: 0.3 },
  crevasse_sled: { name: 'Crevasse sled', icon: '🛷', vmax: 19, boost: 28, acc: 10, bacc: 15, turn: 1.4, wy: 0.62, wr: 0.62, r: 2.6, tough: true },
  lava_runner: { name: 'Lava runner', icon: '🏍', vmax: 32, boost: 48, acc: 18, bacc: 26, turn: 2.1, hover: 0.9, r: 1.4, lean: 0.5 }
};

export const EXT_BUILDERS = {
  // Venus: six-wheel armored heat tank, gold-foil hull, amber light bar, cow-catcher ram
  acid_crawler({ R, body, seat, mesh, wheels }) {
    const gold = M('gold', 0xc89a3a, { metalness: 0.8, roughness: 0.3 }), amber = G('amber', 0xffb020);
    body.add(mesh(R.box, gold, 0, 1.55, 0, 2.6, 1.3, 4.6), mesh(R.box, R.dark, 0, 2.35, -0.6, 2.0, 0.5, 1.6), mesh(R.box, amber, 0, 2.65, -0.6, 1.6, 0.1, 0.25));
    body.add(mesh(R.box, R.frame, 0, 0.95, -2.55, 2.4, 0.6, 0.3), mesh(R.box, amber, 0, 1.6, -2.32, 1.9, 0.18, 0.05));
    seat.position.set(0.5, 2.3, -0.4);
    return wheels([[-1.4, -1.6, 1], [1.4, -1.6, 1], [-1.4, 0], [1.4, 0], [-1.4, 1.6], [1.4, 1.6]], 0.7);
  },
  // Mercury: low, wide mirror-panel racer
  sun_skimmer({ R, body, seat, mesh, wheels }) {
    const mir = M('mirror', 0xdfe6f0, { metalness: 1, roughness: 0.08 }), cy = G('cyan', 0x6ae0ff);
    body.add(mesh(R.box, mir, 0, 0.7, 0, 2.0, 0.25, 3.4), mesh(R.box, R.dark, 0, 0.95, 0.4, 1.1, 0.3, 1.2), mesh(R.box, mir, 0, 1.15, 1.6, 2.2, 0.06, 0.5));
    body.add(mesh(R.box, cy, 0, 0.72, -1.72, 1.6, 0.08, 0.05), mesh(R.box, R.padLight, 0, 0.8, 1.72, 1.6, 0.08, 0.05));
    seat.position.set(0, 1.0, 0.4);
    return wheels([[-1.05, -1.2, 1], [1.05, -1.2, 1], [-1.05, 1.2], [1.05, 1.2]], 0.42);
  },
  // Titan: broad flat hover hull, twin glow fans
  methane_skiff({ R, body, seat, mesh }) {
    const rust = M('rust', 0x8a4a22, { metalness: 0.4 }), grn = G('green', 0x7aff5a);
    body.add(mesh(R.box, rust, 0, 0.8, 0, 2.6, 0.5, 4.4), mesh(R.box, R.dark, 0, 1.2, 0.6, 1.6, 0.4, 1.6), mesh(R.box, rust, 0, 1.05, -2.0, 1.4, 0.4, 0.6));
    for (const s of [-1, 1]) body.add(mesh(R.cyl, R.frame, s * 1.0, 1.4, 1.8, 0.55, 0.9, 0.55), mesh(R.cyl, grn, s * 1.0, 1.4, 2.27, 0.45, 0.04, 0.45));
    body.add(mesh(R.box, grn, 0, 0.52, 0, 2.4, 0.06, 4.0));
    seat.position.set(0, 1.4, 0.6);
    return [];
  },
  // Europa: studded-tire ice hauler with a drill nose
  crevasse_sled({ R, body, seat, mesh, wheels }) {
    const wht = M('white', 0xe8eef4, { metalness: 0.3 }), cy = G('cyan', 0x6ae0ff);
    body.add(mesh(R.box, wht, 0, 1.3, 0.2, 2.2, 1.0, 3.6), mesh(R.box, R.glass, 0, 1.95, -0.6, 1.8, 0.6, 1.2), mesh(R.box, cy, 0, 2.3, 0.6, 1.8, 0.08, 0.2));
    const drill = mesh(R.cyl, R.frame, 0, 1.1, -2.2, 0.35, 1.1, 0.35); drill.rotation.x = Math.PI / 2; body.add(drill);
    seat.position.set(0.45, 1.9, -0.3);
    return wheels([[-1.25, -1.2, 1], [1.25, -1.2, 1], [-1.25, 1.3], [1.25, 1.3]], 0.62);
  },
  // Io: heat-shielded hover bike with an orange glow skirt
  lava_runner({ R, body, seat, mesh }) {
    const blk = M('char', 0x1c1a1a, { metalness: 0.7, roughness: 0.3 }), org = G('orange', 0xff6a10);
    body.add(mesh(R.box, blk, 0, 0.75, 0, 0.7, 0.42, 2.4), mesh(R.box, blk, 0, 1.0, -1.0, 0.55, 0.32, 0.8), mesh(R.box, org, 0, 0.5, 0, 0.8, 0.06, 2.2));
    body.add(mesh(R.cyl, org, 0, 0.75, 1.22, 0.3, 0.05, 0.3));
    seat.position.set(0, 1.05, 0.7);
    return [];
  }
};
