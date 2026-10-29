// v7 "GTA in space" layer: frontier colonies (domes, pads, neon, crates, lights), colonists, guards, shady
// contacts, a supply shop, parked vehicles you can commandeer, and a 1-5 star wanted level enforced by
// security drones and patrol buggies. Everything here is game fiction. Cheap by design: shared geometry,
// no real-time lights except one per colony, small unit caps on phones.
import * as THREE from 'three';
import { buildRoom, INTERIORS, textTex } from './interiors.js';
import * as ROOF from './roofs.js';

// colony layouts are in colony-local metres (x east, z south); a/d place the colony from the landing site
export const COLONIES = {
  Mars: {
    name: 'Ares Junction', a: 0, d: 200, tint: 0xff6a3a,
    domes: [[0, 0, 14, 'ARES JUNCTION', 0xff7a2a], [-22, -16, 8], [24, 6, 9, 'HAB 3', 0x6ad0ff]],
    // [x, z, w, d, h, sign, colour, interior kind?, inside title?]; the door is the middle of the +z face
    blocks: [[31, -17, 9, 5, 6, 'CANTINA', 0xff2a5a, 'cantina', 'CANTINA'], [-6, 23, 7, 4, 4, 'SUPPLY', 0x3cff8a, 'supply', 'ARES SUPPLY'], [-44, -14, 6, 4, 5, 'DEPOT', 0xffd040, 'depot', 'MERIDIAN DEPOT'],
      [16, -38, 6, 4, 4, 'OZZIE\u2019S IRON', 0xffd040, 'guns', 'OZZIE\u2019S IRON'], [-30, -36, 12, 7, 7, 'THE VELVET AIRLOCK', 0xff3cc8, 'club'], [6, -28, 7, 4, 4, 'SECURITY', 0x4a8aff, 'security', 'COLONY SECURITY']],
    pad: [-38, 10, 9], crates: [[-31, 16], [-33, 21], [-29, 21], [-46, -4], [36, -9], [12, 30], [-8, -24]],
    shop: [-6, 26.2], contacts: [{ name: 'Rook', at: [36, -26], blurb: 'Fixer. Doesn\u2019t like questions.' }, { name: 'Vesna', at: [8, 24], blurb: 'Salvage broker. Pays on time.' }],
    // contacts who live indoors (talk to them at a hotspot inside): Dutch behind the cantina bar, Ozzie at the gun counter, Ines in the VIP room
    inside: { cantina: { barkeep: 'Dutch', talk: 'Dutch' }, guns: { dealer: 'Ozzie', talk: 'Ozzie' }, club: { owner: 'Ines' } },
    vehicles: [['buggy', -14, 30, 0.4], ['hauler', -50, -24, 1.6], ['hoverbike', 20, 30, -0.3], ['shuttle', -38, 10, 0.9], ['buggy', 42, 12, 2.4]],
    guards: [[0, -22], [-26, 4], [22, -20]], colonists: 5, lamps: 12
  },
  Moon: {
    name: 'Freeport Tranquility', a: 35, d: 210, tint: 0x8ad8ff,
    domes: [[0, 0, 12, 'FREEPORT', 0x6ad0ff], [20, -10, 7]],
    blocks: [[-20, 12, 6, 4, 4, 'SUPPLY', 0x3cff8a, 'supply', 'FREEPORT SUPPLY'], [16, 18, 7, 4, 5, 'THE DRY SEA', 0xff2a5a, 'cantina', 'THE DRY SEA'], [30, 14, 6, 4, 4, 'GUNS', 0xffd040, 'guns', 'FREEPORT ARMS']],
    pad: [-28, -12, 9], crates: [[-24, -4], [-30, -2], [10, 24], [26, 4]],
    shop: [-20, 15.2], contacts: [{ name: 'Kestrel', at: [12, 20], blurb: 'Runs the crater races. Takes a cut.' }],
    vehicles: [['hoverbike', 6, 26, 0.2], ['buggy', -12, 24, 1.1], ['hauler', 28, -20, 2.2], ['shuttle', -28, -12, 0.3]],
    guards: [[0, -18], [-18, 0]], colonists: 3, lamps: 8
  }
};
// v7.3 modding: add or replace a colony. def = { name, a, d, tint, domes, blocks:[[x,z,w,d,h,sign,colour,interiorKind?,title?]], pad, crates, shop, contacts, inside, vehicles, guards, colonists, lamps }
// v7.5 additive districts: extra hubs on a world next to its colony (registerColony still replaces the colony itself).
// def = { name, origin: [x, z] colony-relative metres (or centre), r1/r2 flatten radii, tint, domes:[[x,z,r,sign,colour,interiorKind?,title?]],
//   blocks (same as colonies), pad, crates, shop, contacts, vehicles, guards, colonists, lamps, inside, walk:[[x,z]], fastTravel:[x,z],
//   lots:[{ id, at:[x,z], r, use }] (open ground kept free for add-ons: dealerships, garages, car meets), cameras:[[x,z]], mansions }
// Everything district-local is in metres from the district centre, x east, z south. Built on enter() at colony centre + origin.
export const DISTRICTS = {};
export function registerDistrict(world, id, def) {
  if (!world || !id || !def || !(def.origin || def.centre)) throw new Error('registerDistrict(worldName, id, { name, origin: [x, z], domes, blocks, ... })');
  (DISTRICTS[world] = DISTRICTS[world] || {})[id] = { id, r1: 56, r2: 84, tint: 0xffa060, domes: [], blocks: [], crates: [], contacts: [], inside: {}, vehicles: [], guards: [], colonists: 3, lamps: 8, lots: [], ...def, origin: def.origin || def.centre };
  { const D = DISTRICTS[world][id]; D.centre = D.centre || D.origin; D.r = D.r || D.r2; } // v7.5.1: centre/r for add-ons (contraband districtAt)
  return id;
}
export const districtsOf = world => Object.values(DISTRICTS[world] || {});
// v7.5 highways: one per world. def = { name, polyline: [[x, z], ...] colony-relative (closed if first == last), width, ramps:[{at,len,h}],
//   checkpoints:[{ id, at, faction, wanted_scan, blurb }], traffic:{ phone_max, desktop_max, kinds, civilian_speed, cop_chance }, props }
export const HIGHWAYS = {};
export function registerHighway(world, def) {
  if (!world || !Array.isArray(def?.polyline) || def.polyline.length < 2) throw new Error('registerHighway(worldName, { name, polyline: [[x, z], ...] })');
  HIGHWAYS[world] = { name: 'Highway', width: 9, ramps: [], checkpoints: [], props: [], traffic: {}, ...def }; return world;
}
export function registerColony(world, def) {
  if (!world || !def?.name) throw new Error('registerColony(worldName, { name, a, d, ... })');
  COLONIES[world] = { a: 0, d: 200, tint: 0xffa060, domes: [], blocks: [], pad: [-30, 10, 9], crates: [], shop: [0, 20], contacts: [], inside: {}, vehicles: [], guards: [], colonists: 3, lamps: 8, ...def };
  return world;
}

export const VEHICLES = {
  rover: { name: 'Rover', vmax: 17, boost: 30, acc: 9, bacc: 15, turn: 1.5, wy: 0.62, wr: 0.62, r: 2.4 },
  buggy: { name: 'Dune buggy', vmax: 22, boost: 34, acc: 12, bacc: 18, turn: 1.75, wy: 0.48, wr: 0.48, r: 2.1 },
  hauler: { name: 'Ore hauler', vmax: 13, boost: 20, acc: 6, bacc: 9, turn: 1.05, wy: 0.75, wr: 0.75, r: 3.0, tough: true },
  hoverbike: { name: 'Hover bike', vmax: 28, boost: 42, acc: 16, bacc: 24, turn: 2.0, hover: 1.1, r: 1.4, lean: 0.45 },
  shuttle: { name: 'Shuttle skimmer', vmax: 20, boost: 32, acc: 9, bacc: 14, turn: 1.0, hover: 5, r: 3.4 }
};

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
const B = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
function neonTex(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  const col = '#' + color.toString(16).padStart(6, '0');
  x.fillStyle = 'rgba(8,8,12,0.85)'; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(6, 6, 500, 116);
  let fs = 74; x.font = `bold ${fs}px system-ui, sans-serif`; while (x.measureText(text).width > 470 && fs > 20) { fs -= 2; x.font = `bold ${fs}px system-ui, sans-serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = col; x.shadowBlur = 24; x.fillStyle = col; x.fillText(text, 256, 68); x.shadowBlur = 8; x.fillStyle = '#fff'; x.globalAlpha = 0.55; x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelTex(text, color = '#e6c2ff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(0,0,0,0.55)'; const w = x.measureText(text).width + 28; x.fillRect(128 - w / 2, 10, w, 44);
  x.fillStyle = color; x.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- shared assets ----------
const R = {};
function res() {
  if (R.ok) return R; R.ok = true;
  R.glass = new THREE.MeshStandardMaterial({ color: 0x9fc8e0, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false });
  R.frame = M(0x3a3f47, { metalness: 0.6, roughness: 0.4 }); R.hull = M(0x8a8e94, { metalness: 0.4, roughness: 0.55 }); R.dark = M(0x1d2026, { roughness: 0.7 });
  R.inner = B(0xffc890); R.crate = M(0x6a5a3a, { roughness: 0.85 }); R.crate2 = M(0x3c4a3a, { roughness: 0.8 }); R.pad = M(0x2a2c30, { roughness: 0.9 });
  R.lampOn = B(0xffd9a0); R.lampOff = B(0x2a2620); R.padLight = B(0xff5030); R.green = B(0x3cff8a); R.red = B(0xff2a2a); R.blue = B(0x2a7aff);
  R.suit = [M(0xb8862a), M(0x5a6a7a), M(0x8a3a2a), M(0x4a6a3a), M(0xc0c0b8)]; R.guard = M(0x1c1e24, { metalness: 0.4, roughness: 0.5 }); R.visor = B(0xffb030); R.gvisor = B(0xff2a2a);
  R.contact = M(0x3a2a4a); R.cvisor = B(0xc070ff); R.wheel = M(0x1a1a1a, { roughness: 0.9 });
  R.paints = { buggy: M(0xd8a020, { metalness: 0.3, roughness: 0.4 }), hauler: M(0x8a4a2a, { metalness: 0.3 }), hoverbike: M(0x1a1a20, { metalness: 0.6, roughness: 0.3 }), shuttle: M(0xd8dce0, { metalness: 0.5, roughness: 0.35 }), sec: M(0x20242c, { metalness: 0.5, roughness: 0.4 }) };
  R.glowC = B(0x4fd8ff); R.glowO = B(0xff8a2a);
  // v7.5: city materials. Helios private security (white armour, teal visor), ColSec heavies, the Beltway
  R.pguard = M(0xe8ecef, { metalness: 0.3, roughness: 0.35 }); R.tvisor = B(0x30e0d0); R.heavy = M(0x23324a, { metalness: 0.6, roughness: 0.35 }); R.hvisor = B(0xff7a20);
  R.asphalt = M(0x2a2e35, { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); R.stripe = B(0xe0b020, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  R.barrier = M(0xb8b2a8, { roughness: 0.8 }); R.boom = B(0xff3030); R.boomW = B(0xf0f0f0); R.ramp = M(0x3a3e46, { metalness: 0.4, roughness: 0.6 });
  R.box = new THREE.BoxGeometry(1, 1, 1); R.cyl = new THREE.CylinderGeometry(1, 1, 1, 10); R.sph = new THREE.SphereGeometry(1, 12, 8);
  R.dome = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); R.ring = new THREE.TorusGeometry(1, 0.05, 6, 28);
  R.wheelG = new THREE.CylinderGeometry(1, 1, 0.6, 12); R.wheelG.rotateZ(Math.PI / 2);
  R.torso = new THREE.CapsuleGeometry(0.32, 0.55, 3, 8); R.leg = new THREE.BoxGeometry(0.2, 0.75, 0.24); R.leg.translate(0, -0.37, 0);
  R.head = new THREE.SphereGeometry(0.27, 10, 8); R.visorG = new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4); R.visorG.rotateX(Math.PI / 2);
  R.gun = new THREE.BoxGeometry(0.1, 0.12, 0.8); R.bolt = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 5); R.bolt.rotateX(Math.PI / 2);
  R.boltM = B(0xff3a3a, { transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const k in R) { const v = R[k]; if (v?.isMaterial || v?.isBufferGeometry) v.userData.shared = true; }
  R.suit.forEach(m => m.userData.shared = true); for (const k in R.paints) R.paints[k].userData.shared = true;
  return R;
}
// v7.5 (v8 prep): material role slots. world.setMaterialSlot(role, material) swaps every mesh using that role, now and on later builds.
// Meshes built here also carry userData.v8 = { site, part } so a realistic-asset pass can replace whole parts by key.
export const MATERIAL_ROLES = { concrete: 'hull', metal: 'frame', glass: 'glass', dark: 'dark', interior: 'inner', pad: 'pad', crate: 'crate', lamp: 'lampOn', asphalt: 'asphalt', stripe: 'stripe', barrier: 'barrier', ramp: 'ramp' };
const mesh = (g, m, x, y, z, sx = 1, sy = sx, sz = sx) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };

// ---------- vehicles (wheels match surface.js updateRover: {x,z,pivot,spin,front}) ----------
function wheelSet(g, body, list, r) {
  const wheels = [];
  for (const [x, z, front] of list) {
    const pivot = new THREE.Group(); pivot.position.set(x, r, z); g.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin); spin.add(mesh(R.wheelG, R.wheel, 0, 0, 0, r, r, r * 0.9));
    wheels.push({ x, z, pivot, spin, front: !!front });
  }
  return wheels;
}
// ext hook (planets/): extra vehicle kinds build here, usually as a stock body + livery. fn({ R, mesh, build, sec }) -> { group, body, wheels, seat, paint }
export const VEHICLE_BUILDERS = {};
// v7.4 modding: add a drivable kind. spec = VEHICLES-style numbers (+ name, icon, hover, amphibious, tough); builder = fn({ R, mesh, build, sec }) -> { group, body, wheels, seat, paint }
export function registerVehicle(kind, spec, builder) {
  if (!kind || !spec || typeof spec.vmax !== 'number') throw new Error('registerVehicle(kind, { name, vmax, boost, acc, bacc, turn, r, ... }, builder?)');
  VEHICLES[kind] = { boost: spec.vmax * 1.5, acc: 9, bacc: 14, turn: 1.4, r: 2.4, ...spec };
  if (builder) VEHICLE_BUILDERS[kind] = builder;
  return kind;
}
export function buildVehicle(kind, sec = false) {
  res(); if (VEHICLE_BUILDERS[kind]) return VEHICLE_BUILDERS[kind]({ R, mesh, build: buildVehicle, sec });
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.rotation.order = 'YXZ';
  const paint = sec ? R.paints.sec : R.paints[kind], seat = new THREE.Object3D(); body.add(seat);
  let wheels = [];
  if (kind === 'buggy') {
    body.add(mesh(R.box, paint, 0, 0.9, 0, 1.7, 0.4, 3.0), mesh(R.box, R.dark, 0, 1.25, 0.3, 1.5, 0.3, 1.2));
    for (const s of [-1, 1]) { body.add(mesh(R.cyl, R.frame, s * 0.7, 1.75, 0.2, 0.05, 1.2, 0.05)); }
    body.add(mesh(R.box, R.frame, 0, 2.3, 0.2, 1.5, 0.06, 1.1), mesh(R.box, R.glowO, 0, 2.36, -0.3, 1.2, 0.08, 0.1));
    seat.position.set(0.45, 1.25, 0.9);
    wheels = wheelSet(g, body, [[-0.95, -1.1, 1], [0.95, -1.1, 1], [-0.95, 1.1], [0.95, 1.1]], 0.48);
  } else if (kind === 'hauler') {
    body.add(mesh(R.box, paint, 0, 1.5, -1.6, 2.4, 1.6, 1.8), mesh(R.box, R.hull, 0, 1.3, 1.1, 2.6, 1.3, 3.8), mesh(R.box, R.glowC, 0, 2.0, -2.52, 1.8, 0.4, 0.05));
    body.add(mesh(R.box, R.glowO, 0, 2.5, -1.6, 1.8, 0.1, 0.2)); seat.position.set(0.6, 2.0, 1.0);
    wheels = wheelSet(g, body, [[-1.35, -1.6, 1], [1.35, -1.6, 1], [-1.35, 0.6], [1.35, 0.6], [-1.35, 2.2], [1.35, 2.2]], 0.75);
  } else if (kind === 'hoverbike') {
    body.add(mesh(R.box, paint, 0, 0.75, 0, 0.6, 0.4, 2.2), mesh(R.box, paint, 0, 0.95, -0.9, 0.5, 0.3, 0.7), mesh(R.cyl, R.glowC, 0, 0.45, -0.8, 0.35, 0.08, 0.35), mesh(R.cyl, R.glowC, 0, 0.45, 0.8, 0.35, 0.08, 0.35));
    body.add(mesh(R.box, R.glowO, 0, 0.8, 1.12, 0.45, 0.15, 0.05)); seat.position.set(0, 1.05, 0.75);
  } else if (kind === 'shuttle') {
    body.add(mesh(R.sph, paint, 0, 1.6, 0, 1.6, 1.0, 3.4), mesh(R.box, paint, 0, 1.4, 0.4, 6.0, 0.15, 1.6), mesh(R.sph, R.glass, 0, 2.2, -1.6, 0.9, 0.6, 1.1));
    for (const s of [-1, 1]) body.add(mesh(R.cyl, R.glowC, s * 2.6, 1.1, 0.6, 0.45, 0.2, 0.45), mesh(R.box, R.padLight, s * 3.0, 1.45, 0.4, 0.1, 0.1, 0.3));
    body.add(mesh(R.cyl, R.glowO, 0, 1.6, 3.3, 0.6, 0.3, 0.6)); seat.position.set(0.5, 2.2, 0.5);
  }
  if (sec) { const bar = new THREE.Group(); bar.position.set(0, kind === 'buggy' ? 2.45 : 1.3, 0.2); const l = mesh(R.box, R.red, -0.35, 0, 0, 0.5, 0.15, 0.2), r2 = mesh(R.box, R.blue, 0.35, 0, 0, 0.5, 0.15, 0.2); bar.add(l, r2); body.add(bar); g.userData.bar = [l, r2]; }
  return { group: g, body, wheels, seat, paint };
}

// ---------- people ----------
function buildPerson(kind, i = 0, style = null) {
  res();
  const g = new THREE.Group(), suit = style === 'saltblood' ? R.suit[(i + 3) % R.suit.length] : style === 'private' ? R.pguard : style === 'heavy' ? R.heavy : kind === 'guard' ? R.guard : kind === 'contact' ? R.contact : R.suit[i % R.suit.length];
  const torso = mesh(R.torso, suit, 0, 1.25, 0); g.add(torso);
  const head = mesh(R.head, suit, 0, 1.92, 0);
  g.add(head, mesh(R.visorG, style === 'private' ? R.tvisor : style === 'heavy' ? R.hvisor : kind === 'guard' ? R.gvisor : kind === 'contact' ? R.cvisor : R.visor, 0, 1.94, -0.12));
  if (style === 'heavy') { g.add(mesh(R.box, R.heavy, 0, 1.45, -0.2, 0.8, 0.6, 0.2), mesh(R.box, R.frame, 0, 1.2, -0.5, 0.12, 0.16, 1.1)); for (const sx of [-1, 1]) g.add(mesh(R.box, R.heavy, sx * 0.42, 1.62, 0, 0.26, 0.2, 0.4)); }
  if (style === 'saltblood') for (const sx of [-1, 1]) g.add(mesh(R.box, R.red, sx * 0.36, 1.45, 0, 0.14, 0.12, 0.3)); // v7.5 Saltblood: red tape on both arms
  g.add(mesh(R.box, R.frame, 0, 1.35, 0.33, 0.45, 0.55, 0.22)); // backpack
  const legs = [];
  for (const s of [-1, 1]) { const l = new THREE.Mesh(R.leg, suit); l.position.set(s * 0.15, 0.78, 0); g.add(l); legs.push(l); }
  if (kind === 'guard' && style !== 'heavy') g.add(mesh(R.gun, R.dark, 0.32, 1.2, -0.35));
  return { group: g, legs, head, torso };
}

// ctx: { scene, height(x,z), player, onEvent, isMobile, game(), st() -> { driving, car, ownRover } }
export function createWorld(ctx) {
  const { scene, player, onEvent, isMobile } = ctx;
  const height = (x, z) => ctx.height(x, z);
  let C = null, col = null, cx = 0, cz = 0, time = 0;
  let wname = '', duel = null, ringM = null, camBoxes = [], solids = [], vehicles = [], people = [], flick = [], lights = [], security = [], shots = [], signs = [];
  let wanted = 0, evade = 0, bustT = 0, respawnCd = 0, seen = 0, lastFireCheck = 0;
  let doors = [], rooms = new Map(), inside = null, coverPaid = false, interiorsRoot = null, roomIdx = 0;
  const caps = { drones: isMobile ? 2 : 3, buggies: isMobile ? 1 : 2, officers: isMobile ? 2 : 4, heavies: isMobile ? 1 : 2 };
  const toW = (p) => ({ x: cx + p[0], z: cz + p[1] });

  // called before terrain chunks are built: where the colony sits and how much ground to flatten.
  // v7.5: plus one flat disc per district and a flattened corridor (segments) and jump ramps along the highway
  let sites = [], HW = null, road = null, tgt = null, curZone = 'aj', actZone = 'aj', zoneT = 0;
  function layout(name, safePoint) {
    C = COLONIES[name] || null; wname = name; if (!C) return [];
    const p = safePoint(C.a, C.d); cx = p.x; cz = p.z;
    const discs = [{ x: cx, z: cz, r1: 62, r2: 92, y: height(cx, cz) }];
    for (const D of districtsOf(name)) { const X = cx + D.origin[0], Z = cz + D.origin[1]; discs.push({ x: X, z: Z, r1: D.r1, r2: D.r2, y: height(X, Z), district: D.id }); }
    const segs = [];
    HW = HIGHWAYS[name] ? planRoad(HIGHWAYS[name], discs) : null;
    if (HW) for (const sg of HW.segs) segs.push(sg);
    return [...segs, ...discs, ...(HW ? HW.ramps : [])];
  }
  const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // highway: subdivide the polyline into <= 40 m legs, give each node a height (terrain, pulled onto any flat disc it crosses),
  // and hand surface.js one flatten segment per leg so the ground under the asphalt is a smooth ribbon
  function planRoad(def, discs) {
    const P = def.polyline.map(([x, z]) => ({ x: cx + x, z: cz + z }));
    const hd = (x, z) => { let h = height(x, z); for (const f of discs) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r2) h = h + (f.y - h) * (1 - smooth01(f.r1, f.r2, d)); } return h; };
    const nodes = [];
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 40)); for (let k = 0; k < n; k++) { const t = k / n; nodes.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); } }
    nodes.push({ ...P[P.length - 1] });
    for (const n of nodes) n.y = hd(n.x, n.z);
    const W = (def.width || 9) / 2, segs = [];
    for (let i = 0; i < nodes.length - 1; i++) { const a = nodes[i], b = nodes[i + 1], r2 = W + 12;
      segs.push({ seg: true, ax: a.x, az: a.z, bx: b.x, bz: b.z, ya: a.y, yb: b.y, r1: W + 2.5, r2, minx: Math.min(a.x, b.x) - r2, maxx: Math.max(a.x, b.x) + r2, minz: Math.min(a.z, b.z) - r2, maxz: Math.max(a.z, b.z) + r2 }); }
    // ramps sit on the centre line ~25 m before a ramp waypoint, rising toward the district it leads to (lanes run either side)
    const ramps = [];
    for (const rp of def.ramps || []) { const at = { x: cx + rp.at[0], z: cz + rp.at[1] }, to = { x: cx + rp.to[0], z: cz + rp.to[1] }, dx = to.x - at.x, dz = to.z - at.z, dl = Math.hypot(dx, dz) || 1;
      const len = rp.len || 11, x = at.x - dx / dl * (25 + len / 2), z = at.z - dz / dl * (25 + len / 2);
      ramps.push({ ramp: true, x, z, ux: dx / dl, uz: dz / dl, len, w: rp.w || 3.2, h: rp.h || 2.2 }); }
    // dense samples for the ribbon, traffic and projection (every 3 m)
    const pts = []; let s = 0;
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(L / 3));
      for (let k = 0; k < n; k++) { const t = k / n; pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, s, fx: (b.x - a.x) / L, fz: (b.z - a.z) / L }); s += L / n; } }
    const closed = Math.hypot(P[0].x - P[P.length - 1].x, P[0].z - P[P.length - 1].z) < 1;
    if (!closed) { const l = P[P.length - 1], q = pts[pts.length - 1]; pts.push({ x: l.x, z: l.z, s, fx: q.fx, fz: q.fz }); }
    return { def, nodes, segs, ramps, pts, len: s, closed, W };
  }
  function add(o) { (tgt || col).add(o); return o; }
  function enter() {
    if (!C) return; res(); time = 0; wanted = 0; evade = 0; bustT = 0;
    col = new THREE.Group(); col.userData.v8 = { site: 'aj' }; scene.add(col);
    sites = [{ id: 'aj', name: C.name, kind: 'colony', x: cx, z: cz, r: 62, core: 56, group: col, tint: C.tint, def: C, cams: 70, fast: toW([0, 26]) }];
    tgt = col; curZone = 'aj';
    buildSite(C, cx, cz, sites[0], true);
    for (const D of districtsOf(wname)) {
      const X = cx + D.origin[0], Z = cz + D.origin[1], g = new THREE.Group(); g.userData.v8 = { site: D.id }; scene.add(g);
      const site = { id: D.id, name: D.name, kind: D.kind || 'district', x: X, z: Z, r: D.r1, core: D.core || 50, group: g, tint: D.tint, def: D, cams: D.cams ?? (D.kind === 'rough' ? 0 : 55),
        fast: { x: X + (D.fastTravel || [0, 20])[0], z: Z + (D.fastTravel || [0, 20])[1] }, lots: (D.lots || []).map(l => ({ ...l, x: X + l.at[0], z: Z + l.at[1], district: D.id })) };
      sites.push(site); tgt = g; curZone = D.id;
      buildSite(D, X, Z, site, false);
    }
    tgt = col; curZone = 'aj';
    if (HW) buildRoad();
    actZone = null; zoneT = 0; updateZones(true);
  }
  // one hub (the colony or a district). D uses colony-style arrays in hub-local metres.
  function buildSite(D, ox, oz, site, isColony) {
    const y0 = height(ox, oz), W = p => ({ x: ox + p[0], z: oz + p[1] }), free = isColony ? (x, z) => ({ x, z }) : freeSpot;
    const part = (o, k) => { o.userData.v8 = { site: site.id, part: k }; return o; };
    // domes: glass shell, ribs, warm interior, base ring and an optional neon sign over the door.
    // v7.5: a dome with an interior kind ([x,z,r,sign,colour,kind,title]) gets a walk-in door in its airlock (mansions)
    for (const [x, z, r, sign, color, kind, title] of D.domes || []) {
      const X = ox + x, Z = oz + z;
      part(add(mesh(R.dome, R.glass, X, y0, Z, r, r * 0.8, r)), 'dome');
      for (let k = 0; k < 4; k++) { const rib = mesh(R.ring, R.frame, X, y0, Z, r, r * 0.8, r); rib.rotation.y = k * Math.PI / 4; add(rib); }
      add(mesh(R.cyl, R.frame, X, y0 + 0.4, Z, r + 0.3, 0.8, r + 0.3));
      add(mesh(R.cyl, R.inner, X, y0 + 0.85, Z, r * 0.55, 0.1, r * 0.55));
      for (let k = 0; k < 3; k++) add(mesh(R.box, R.hull, X + Math.cos(k * 2.1) * r * 0.45, y0 + 1.6, Z + Math.sin(k * 2.1) * r * 0.45, 2.4, 2.4, 2.4));
      add(mesh(R.box, R.dark, X, y0 + 1.4, Z + r + 0.6, 3, 2.8, 2.2));
      if (sign) addSign(sign, color || site.tint, X, y0 + 3.6, Z + r + 1.75, 0, 7);
      solids.push({ x: X, z: Z, r: r + 0.3, h: r * 0.8, zone: site.id });
      if (kind && INTERIORS[kind]) {
        const tm = B(color || 0xffd040); for (const [dx, dy, sx, sy] of [[-0.88, 1.3, 0.1, 2.7], [0.88, 1.3, 0.1, 2.7], [0, 2.66, 1.86, 0.1]]) add(mesh(R.box, tm, X + dx, y0 + dy, Z + r + 1.76, sx, sy, 0.08));
        doors.push({ i: doors.length, kind, name: titleCase(sign || INTERIORS[kind].name), title: title || sign, color: color || 0xffd040, x: X, z: Z + r + 2.4, block: [x, z], site: site.id, ins: { ...(D.inside?.[kind] || {}), ...(D.inside?.[sign] || {}) } });
      }
    }
    for (const [x, z, w, d, h, sign, color, kind, title] of D.blocks || []) {
      const X = ox + x, Z = oz + z;
      part(add(mesh(R.box, R.hull, X, y0 + h / 2, Z, w, h, d)), 'block'); add(mesh(R.box, R.frame, X, y0 + h + 0.15, Z, w + 0.4, 0.3, d + 0.4));
      if (sign) addSign(sign, color, X, y0 + h + 1.3, Z + d / 2 + 0.05, 0, Math.min(kind === 'club' ? 9 : 6, w));
      if (kind && INTERIORS[kind]) { // v7.3: a walk-in door on the front face
        const gy = height(X, Z + d / 2 + 1);
        add(mesh(R.box, R.dark, X, gy + 1.3, Z + d / 2 + 0.04, 1.7, 2.6, 0.12));
        const tm = B(color); for (const [dx, dy, sx, sy] of [[-0.88, 1.3, 0.1, 2.7], [0.88, 1.3, 0.1, 2.7], [0, 2.66, 1.86, 0.1]]) add(mesh(R.box, tm, X + dx, gy + dy, Z + d / 2 + 0.1, sx, sy, 0.08));
        if (kind === 'club') { const b = buildPerson('guard', 9); b.group.position.set(X + 1.8, gy, Z + d / 2 + 0.9); b.group.rotation.y = -0.3; b.group.scale.setScalar(1.25); add(b.group); } // Brick on the door
        doors.push({ i: doors.length, kind, name: sign ? titleCase(sign) : INTERIORS[kind].name, title: title || sign, color, x: X, z: Z + d / 2 + 0.9, block: [x, z], site: site.id, ins: isColony ? null : { ...(D.inside?.[kind] || {}), ...(D.inside?.[sign] || {}) } });
      }
      solids.push({ x: X, z: Z, r: Math.max(w, d) / 2 + 0.4, h, box: [w / 2 + 0.4, d / 2 + 0.4], zone: site.id });
    }
    // landing pad with blinking edge lights
    if (D.pad) { const [x, z, r] = D.pad, X = ox + x, Z = oz + z; part(add(mesh(R.cyl, R.pad, X, y0 + 0.08, Z, r, 0.16, r)), 'pad'); add(mesh(R.ring, R.glowO, X, y0 + 0.2, Z, r * 0.7, r * 0.7, 1)).rotation.x = Math.PI / 2;
      for (let k = 0; k < 8; k++) { const l = add(mesh(R.sph, R.padLight, X + Math.cos(k * 0.785) * r, y0 + 0.25, Z + Math.sin(k * 0.785) * r, 0.18)); flick.push({ m: l, blink: k * 0.12 }); } }
    for (const [x, z] of D.crates || []) for (let k = 0; k < 3; k++) { const X = ox + x + (k % 2) * 1.3, Z = oz + z + (k > 1 ? 1.3 : 0); const c = add(mesh(R.box, k % 2 ? R.crate2 : R.crate, X, y0 + 0.6, Z, 1.2)); c.rotation.y = k * 0.3; camBoxes.push({ x: X, z: Z, y: y0 + 1.6, h: 0.95 }); } // v7.4 (m3): crates stop the camera too
    // perimeter lamps; a few flicker like they're wired by the lowest bidder
    const lr = isColony ? 50 : (D.lampR || 44);
    for (let k = 0; k < (D.lamps || 0); k++) {
      const a = k / D.lamps * Math.PI * 2, X = ox + Math.cos(a) * lr, Z = oz + Math.sin(a) * lr;
      add(mesh(R.cyl, R.frame, X, y0 + 2.5, Z, 0.09, 5, 0.09)); const bulb = add(mesh(R.sph, R.lampOn, X, y0 + 5.1, Z, 0.28));
      if (k % 4 === 1) flick.push({ m: bulb, flicker: true });
    }
    if (isColony) { const pl = new THREE.PointLight(C.tint, 60, 70, 1.6); pl.position.set(cx, y0 + 9, cz); scene.add(pl); lights.push(pl); } // one real light, moved to whichever hub you're at
    // shop kiosk marker
    if (D.shop) { const p = W(D.shop); const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('🛒 SHOP', '#7dffb0'), transparent: true, depthWrite: false }))); sp.position.set(p.x, y0 + 2.9, p.z); sp.scale.set(3.2, 0.8, 1); }
    // lots kept clear for add-ons (dealerships, garages, car meets): painted bay lines only
    for (const l of site.lots || []) { const m = add(mesh(R.cyl, R.pad, l.x, height(l.x, l.z) + 0.05, l.z, l.r || 10, 0.06, l.r || 10)); m.userData.v8 = { site: site.id, part: 'lot', lot: l.id }; }
    // people
    const walkPts = (isColony ? [[-10, -22], [14, -22], [34, -4], [12, 20], [-16, 18], [-34, 0], [-30, -24]] : (D.walk || [[-14, -20], [16, -20], [30, 0], [14, 22], [-16, 20], [-30, 0]])).map(W).map(p => free(p.x, p.z, 0.8));
    const nCol = isMobile ? Math.min(D.colonists || 0, D.phoneColonists ?? D.colonists ?? 0) : (D.colonists || 0);
    for (let i = 0; i < nCol; i++) spawnPerson('colonist', walkPts[(i * 2) % walkPts.length], i + sites.length * 3, walkPts);
    (D.guards || []).forEach((g, i) => { const p = spawnPerson('guard', free(ox + g[0], oz + g[1], 0.8), i, D.patrol ? D.patrol.map(W) : walkPts, D.guardStyle || null); if (D.patrol) p.ti = i * 2; });
    if (isColony) { // v7.4 duels: the cantina pit champion hangs around outside the cantina, looking for a fight
      const cd = doors.find(d => d.kind === 'cantina');
      if (cd) { const dx = cx - cd.x, dz = cz - cd.z, dl = Math.hypot(dx, dz) || 1, ch = spawnPerson('colonist', { x: cd.x + dx / dl * 3.2, z: cd.z + dz / dl * 3.2 }, 7, null);
        ch.name = wname === 'Mars' ? 'Grinder Vos' : 'Pit boss Hale'; ch.temper = 1; ch.fighter = { purse: 150, minWager: 50, tough: 1.6 }; ch.hp = 8;
        ch.group.scale.setScalar(1.12); const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('⚔️ CHAMPION'), transparent: true, depthWrite: false })); lab.position.y = 2.6; lab.scale.set(2.8, 0.7, 1); ch.group.add(lab); }
    }
    for (const c of D.contacts || []) { const p = spawnPerson('contact', free(ox + c.at[0], oz + c.at[1], 0.9), 0, null); p.name = c.name; p.blurb = c.blurb;
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('💬 ' + c.name.toUpperCase()), transparent: true, depthWrite: false })); lab.position.y = 2.7; lab.scale.set(2.6, 0.65, 1); p.group.add(lab); }
    // parked vehicles
    for (const [kind, x, z, yaw] of D.vehicles || []) {
      if (!VEHICLES[kind]) continue;
      const v = buildVehicle(kind), q = free(ox + x, oz + z, VEHICLES[kind].r), X = q.x, Z = q.z, spec = VEHICLES[kind];
      const o = { ...v, kind, spec, x: X, z: Z, yaw, y: height(X, Z) + (spec.hover || 0), vy: 0, speed: 0, steer: 0, pitch: 0, roll: 0, air: false, prevG: null, susp: 0, stolen: true, parked: true, home: { x: X, z: Z, yaw }, zone: site.id };
      v.group.position.set(X, o.y, Z); v.group.rotation.y = yaw; scene.add(v.group); vehicles.push(o);
    }
    for (const [x, z] of D.cameras || []) { const X = ox + x, Z = oz + z, cam = { id: `${site.id}:${cams.length}`, x: X, z: Z, site: site.id, cased: 0, mansion: null };
      const m = add(mesh(R.box, R.dark, X, y0 + 3.2, Z, 0.35, 0.25, 0.55)); add(mesh(R.cyl, R.frame, X, y0 + 1.6, Z, 0.06, 3.2, 0.06)); cam.led = add(mesh(R.sph, R.red, X, y0 + 3.25, Z - 0.3, 0.07)); cam.m = m; cams.push(cam); }
  }
  // nudge a point out of buildings/domes (data from packs can put a contact inside a wall)
  function freeSpot(x, z, r) { for (let k = 0; k < 3; k++) { const c = collide(x, z, r); if (!c) break; x = c.x; z = c.z; } return { x, z }; }
  const titleCase = s => s.replace(/\b([A-Z])([A-Z\u2019']+)/g, (m, a, b) => a + b.toLowerCase());
  function addSign(text, color, x, y, z, yaw, w) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: neonTex(text, color), transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = yaw; add(m); signs.push(m);
    if (Math.random() < 0.5) flick.push({ m, sign: true });
  }
  const DUEL_NAMES = ['Dex Morrow', 'Lina Sato', 'Bram Kell', 'Juno Reyes', 'Tobi Achebe', 'Mara Quist', 'Sol Varga', 'Pike Lund', 'Rae Okoro', 'Hux Brennan'];
  function spawnPerson(kind, p, i, pts, style = null) {
    const b = buildPerson(kind, i, style); b.group.position.set(p.x, height(p.x, p.z), p.z); scene.add(b.group);
    const o = { ...b, kind, zone: curZone, on: true, style, x: p.x, z: p.z, home: { x: p.x, z: p.z }, yaw: Math.random() * 6, pts, ti: i, phase: Math.random() * 6, hp: kind === 'guard' ? 6 : 3, stun: 0, cd: 1, flee: 0, wait: Math.random() * 3 };
    if (kind === 'colonist') { o.name = DUEL_NAMES[(i + wname.length) % DUEL_NAMES.length]; o.temper = ((i * 37 + wname.length * 11) % 100) / 100; }
    people.push(o); return o;
  }
  function exit() {
    if (duel) endDuel('abandon', true); if (ringM) { scene.remove(ringM); ringM.geometry.dispose(); ringM = null; }
    for (const o of [...vehicles, ...people, ...security]) scene.remove(o.group);
    for (const s of shots) scene.remove(s.m);
    for (const s of signs) { s.material.map.dispose(); s.material.dispose(); s.geometry.dispose(); }
    for (const s of sites) { s.group.traverse(o => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); scene.remove(s.group); }
    if (road) { road.traverse(o => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } if (o.geometry && o.geometry !== R.box && o.geometry !== R.cyl && o.geometry !== R.sph) o.geometry.dispose(); }); scene.remove(road); road = null; }
    for (const l of lights) scene.remove(l);
    for (const c of corpses) scene.remove(c.group);
    sites = []; cams = []; traffic = []; cps = []; corpses = []; backupT = 0; actZone = 'aj';
    for (const p of people) p.group.traverse(o => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
    if (inside) inside = null;
    for (const r of rooms.values()) { r.dispose(); }
    if (interiorsRoot) { scene.remove(interiorsRoot); interiorsRoot = null; }
    rooms = new Map(); doors = []; coverPaid = false; roomIdx = 0;
    col = null; camBoxes = []; solids = []; vehicles = []; people = []; flick = []; lights = []; security = []; shots = []; signs = []; C = null; wanted = 0;
  }

  // ----- collisions: circles for domes/vehicles, boxes for blocks -----
  function collide(x, z, r, skip, yb) {
    // live fix (roofs.js): height-aware for vehicles. A driven vehicle passes itself as `skip`, so its bottom (skip.y) is
    // known; solids and parked cars it is above (minus ROOF.CLEAR) don't block it, so flying over a building no longer
    // crashes. Callers without a vehicle (people, NPC buggies, the 0.45 m exit probe) keep the old 2-D behaviour.
    if (yb === undefined && skip && skip.spec && Number.isFinite(skip.y) && r > 0.6) yb = skip.y;
    ROOF.setMover(yb, height); // #44 add-on colliders (SSX.colliders.resolve, wrapped in roofs.js when present) use the same bottom
    const vehicles = yb === undefined ? allVehicles() : allVehicles().filter(v => !(v.parked && ROOF.clearsCar(v, yb, height))); // cars it's above don't block
    let hit = false;
    for (const s of solids) {
      if (yb !== undefined && ROOF.overlaps(s, x, z, r) && ROOF.clears(s, x, z, r, yb, height)) continue;
      if (s.box) { const dx = x - s.x, dz = z - s.z, ex = s.box[0] + r, ez = s.box[1] + r;
        if (Math.abs(dx) < ex && Math.abs(dz) < ez) { hit = true; if (ex - Math.abs(dx) < ez - Math.abs(dz)) x = s.x + Math.sign(dx || 1) * ex; else z = s.z + Math.sign(dz || 1) * ez; } continue; }
      const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), m = s.r + r;
      if (d < m) { hit = true; const k = m / (d || 1); x = s.x + dx * k; z = s.z + dz * k; }
    }
    for (const v of vehicles) { if (v === skip || !v.parked) continue; const dx = x - v.x, dz = z - v.z, d = Math.hypot(dx, dz), m = v.spec.r * 0.8 + r; if (d < m) { hit = true; const k = m / (d || 1); x = v.x + dx * k; z = v.z + dz * k; } }
    const xc = globalThis.SSX?.colliders?.resolve?.(x, z, r); if (xc) { hit = true; x = xc.x; z = xc.z; } // add-on outdoor colliders (mars/colliders.js); height-aware via roofs.js's wrap + ROOF.setMover
    return hit ? { x, z } : null;
  }
  function allVehicles() { return vehicles; } // collide() shadows `vehicles` with the cars a flying vehicle can't clear
  function roofGround(car) {
    if (!C || !car) return height;
    const r = (car.spec?.r || 2) * 0.75;
    return (x, z) => {
      const { g, src } = ROOF.groundUnder(solids.concat(ROOF.colliderSolids(x, z, r, height)), x, z, r, car.y, height, vehicles, car);
      // stepping on/off a roof: reset updateRover's ground-velocity history so the height jump doesn't launch the car
      if (x === car.x && z === car.z && src !== car.roofSrc) { car.roofSrc = src; if (car.prevG != null) car.prevG = g; }
      return g;
    };
  }
  function solidAt(x, y, z) {
    if (!C) return false;
    for (const s of solids) { if (y > height(s.x, s.z) + (s.h || 4)) continue; if (s.box ? Math.abs(x - s.x) < s.box[0] && Math.abs(z - s.z) < s.box[1] : Math.hypot(x - s.x, z - s.z) < s.r - 0.6 && Math.hypot(x - s.x, z - s.z) > s.r - 2.2) return true; }
    return false;
  }

  // v7.3: camera occlusion test (solid building boxes + full dome volumes), used to pull the chase camera in
  function camBlocked(x, y, z) {
    if (!C) return false;
    for (const b of camBoxes) { const hw = b.h || 0.75; if (y < b.y && Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hw) return true; } // v7.5.1 (m2): rotated crate corners count
    for (const s of solids) {
      if (s.nocam) continue; // v7.5.4: street dressing never pulls the camera in
      const gy = height(s.x, s.z);
      if (s.box) { if (y < gy + (s.h || 4) + 0.4 && Math.abs(x - s.x) < s.box[0] - 0.1 && Math.abs(z - s.z) < s.box[1] - 0.1) return true; continue; }
      const r = s.r - 0.1; if (Math.hypot(x - s.x, (y - gy) * (r / Math.max(0.5, s.h || r)), z - s.z) < r) return true;
    }
    return false;
  }

  // ===== v7.5 city systems: hubs, NPC streaming, the highway, traffic, checkpoints, camera nodes, cover =====
  let cams = [], traffic = [], cps = [], corpses = [], backupT = 0, civHits = 0, trafT = 0, projT = 0, projS = 0, activeN = 0;
  const npcReserved = {}; // v7.5: add-on spawners (Steve's events/activities) reserve slots so the phone stays <= 12 NPCs
  const NPC_CAP = isMobile ? 12 : 40;
  const siteOf = id => sites.find(s => s.id === id || s.def?.alias === id || s.def?.key === id);
  // spawnPoints(district?, kind?): world-space points from each district's pack spawns + patrol routes, plus derived kinds
  function spawnPoints(id, kind) {
    const out = [];
    for (const s of id ? [siteOf(id)].filter(Boolean) : sites) {
      const sp = s.def?.spawns || {}, push = (k, p, extra) => { if (!kind || kind === k) out.push({ district: s.id, kind: k, x: s.x + p[0], z: s.z + p[1], ...extra }); };
      for (const [k, v] of Object.entries(sp)) {
        if (Array.isArray(v) && typeof v[0] === 'number') push(k, v);
        else if (Array.isArray(v)) v.forEach(p => Array.isArray(p) && push(k, p));
        else if (v && typeof v === 'object') for (const [n, w] of Object.entries(v)) { if (Array.isArray(w) && typeof w[0] === 'number') push(k, w, { name: n }); else if (w?.door) { push(k, w.door, { name: n, part: 'door' }); if (w.safe) push(k + '_safe', w.safe, { name: n }); } }
      }
      for (const [k, v] of Object.entries(s.def?.patrols || {})) (v.route || []).forEach((p, i) => push('patrol_' + k, p, { i }));
      if (!kind || kind === 'plaza') out.push({ district: s.id, kind: 'plaza', x: s.fast.x, z: s.fast.z });
      for (const l of s.lots || []) if (!kind || kind === 'lot') out.push({ district: s.id, kind: 'lot', x: l.x, z: l.z, id: l.id });
    }
    if (HW && (!id || id === 'mars-highway' || id === 'highway')) {
      for (const n of HW.def.waypoints || HW.def.nodes || []) if (!kind || kind === 'beltway_node') { const p = toW(n.at || n); out.push({ district: 'mars-highway', kind: 'beltway_node', x: p.x, z: p.z, id: n.id }); }
      for (const c of cps) if (!kind || kind === 'checkpoint') out.push({ district: 'mars-highway', kind: 'checkpoint', x: c.x, z: c.z, id: c.id });
    }
    return out;
  }
  // a point on the beltway `ahead` metres in front of the player (or null off-road)
  function roadAhead(ahead = 35, maxOff = 60) { if (!HW) return null; const pr = projectRoad(player.x, player.z); if (pr.d > maxOff) return null; const st = ctx.st(), yaw = st.driving ? st.car.yaw : player.yaw; const p0 = roadAt(pr.s), dir = (-Math.sin(yaw) * p0.fx - Math.cos(yaw) * p0.fz) >= 0 ? 1 : -1; const p = roadAt(pr.s + dir * ahead); return { x: p.x, z: p.z, fx: p.fx * dir, fz: p.fz * dir }; }
  function npcBudget() { const used = activeN + Object.values(npcReserved).reduce((a, b) => a + b, 0); return { cap: NPC_CAP, used, free: Math.max(0, NPC_CAP - used), reserved: { ...npcReserved } }; }
  const hubAt = (x, z) => { let best = sites[0] || null, bd = 1e9; for (const s of sites) { const d = Math.hypot(x - s.x, z - s.z); if (d < bd) { bd = d; best = s; } } return best ? { site: best, d: bd } : null; };
  function districtAt(x = player.x, z = player.z) { const h = hubAt(x, z); if (h && h.d < h.site.r + 25) return { id: h.site.id, name: h.site.name, kind: h.site.kind, d: h.d, x: h.site.x, z: h.site.z };
    if (HW) { const pr = projectRoad(x, z); if (pr.d < (HW.def.width || 10) / 2 + 6) return { id: 'mars-highway', name: HW.def.name || 'Beltway', kind: 'highway', d: pr.d, s: pr.s }; } return null; }
  // which hub is "live": its people walk and can be hit, the colony light hangs over it. Phones cap the live NPC count at 12.
  function updateZones(force) {
    if (!sites.length) return;
    const h = hubAt(player.x, player.z), z = h && h.d < 240 ? h.site.id : null;
    for (const s of sites) if (s.id !== 'aj') s.group.visible = Math.hypot(player.x - s.x, player.z - s.z) < 340;
    if (z !== actZone || force) {
      actZone = z;
      if (lights[0] && !inside && h) { const s = h.site; lights[0].position.set(s.x, height(s.x, s.z) + 9, s.z); lights[0].color.setHex(s.tint || C.tint); }
      onEvent('zone', { id: z, name: z ? h.site.name : null });
    }
    const foot = security.filter(s => s.foot).length, hum = ctx.game()?.humanCount?.() || 0;
    const resv = Object.values(npcReserved).reduce((a, b) => a + b, 0);
    const cap = isMobile ? Math.max(4, 12 - foot - hum - resv) : 40 - resv;
    const live = people.filter(p => p.zone === actZone).sort((a, b) => (a.kind === 'contact' ? -1e4 : 0) + Math.hypot(a.x - player.x, a.z - player.z) - (b.kind === 'contact' ? -1e4 : 0) - Math.hypot(b.x - player.x, b.z - player.z));
    const on = new Set(live.slice(0, cap)); if (duel) on.add(duel.p);
    for (const p of people) { const v = on.has(p); if (p.on !== v) { p.on = v; p.group.visible = v; } }
    activeN = on.size + foot + hum;
  }
  // ---- the highway ribbon, its stripe, ramps, barriers, checkpoints and billboards ----
  function buildRoad() {
    const H = HW, def = H.def, W = H.W, g = new THREE.Group(); g.userData.v8 = { site: 'highway' }; scene.add(g); road = g;
    const inCore = (x, z) => sites.some(s => Math.hypot(x - s.x, z - s.z) < s.core);
    const pos = [], idx = [], spos = [], sidx = []; let prevOk = false, n = 0;
    for (let i = 0; i < H.pts.length; i++) {
      const p = H.pts[i], ok = !inCore(p.x, p.z), rx = -p.fz, rz = p.fx;
      const lx = p.x - rx * W, lz = p.z - rz * W, qx = p.x + rx * W, qz = p.z + rz * W;
      pos.push(lx, height(lx, lz) + 0.07, lz, qx, height(qx, qz) + 0.07, qz);
      if (ok && prevOk) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } // v7.5.5 buildRoad fix: counter-clockwise from above, so FrontSide shows the road (was culled from above)
      n++; prevOk = ok;
      if (ok && i % 2 === 0 && i + 1 < H.pts.length) { const q2 = H.pts[i + 1], k = spos.length / 3, sw = 0.11;
        for (const [px, pz] of [[p.x - rx * sw, p.z - rz * sw], [p.x + rx * sw, p.z + rz * sw], [q2.x - rx * sw, q2.z - rz * sw], [q2.x + rx * sw, q2.z + rz * sw]]) spos.push(px, height(px, pz) + 0.1, pz);
        sidx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const mk = (P, I, m, part) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I); geo.computeVertexNormals(); const me = new THREE.Mesh(geo, m); me.userData.v8 = { site: 'highway', part }; me.userData.slot = part === 'road' ? 'asphalt' : 'stripe'; g.add(me); return me; };
    mk(pos, idx, R.asphalt, 'road'); if (sidx.length) mk(spos, sidx, R.stripe, 'stripe');
    for (const r of H.ramps) { const yaw = Math.atan2(-r.ux, -r.uz), y = height(r.x, r.z), m = new THREE.Mesh(R.box, R.ramp);
      // a wedge: scaled box tilted to the ramp slope, its top face matching the height bump surface.js adds
      const ang = Math.atan2(r.h, r.len); m.scale.set(r.w, 0.3, Math.hypot(r.len, r.h)); m.position.set(r.x, y + r.h / 2 - 0.1, r.z); m.rotation.set(0, yaw, 0); m.rotateX(ang); m.userData.v8 = { site: 'highway', part: 'ramp' }; g.add(m);
      for (const sx of [-1, 1]) { const st = new THREE.Mesh(R.box, R.stripe); st.scale.set(0.12, 0.05, Math.hypot(r.len, r.h)); st.position.set(r.x + Math.cos(yaw) * sx * r.w / 2, y + r.h / 2 + 0.06, r.z - Math.sin(yaw) * sx * r.w / 2); st.rotation.set(0, yaw, 0); st.rotateX(ang); g.add(st); } }
    const P = ([x, z]) => ({ x: cx + x, z: cz + z });
    for (const pr of def.props || []) { const p = P(pr.at), y = height(p.x, p.z), yaw = pr.yaw || 0;
      if (pr.type === 'barrier') for (let k = -1; k <= 1; k++) { const m = mesh(R.box, R.barrier, p.x + Math.cos(yaw) * k * 2.2, y + 0.45, p.z - Math.sin(yaw) * k * 2.2, 2, 0.9, 0.5); m.rotation.y = yaw; g.add(m); solids.push({ x: m.position.x, z: m.position.z, r: 1, h: 0.9, zone: 'highway' }); }
      else if (pr.type === 'billboard') { for (const sx of [-1, 1]) g.add(mesh(R.cyl, R.frame, p.x + Math.cos(yaw) * sx * 3, y + 3, p.z - Math.sin(yaw) * sx * 3, 0.15, 6, 0.15));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.4), new THREE.MeshBasicMaterial({ map: neonTex(String(pr.text || pr.name || 'MARS').toUpperCase().slice(0, 22), 0xffb040), side: THREE.DoubleSide })); m.position.set(p.x, y + 6.6, p.z); m.rotation.y = yaw; g.add(m); signs.push(m); }
    }
    cps = (def.checkpoints || []).map(c => { const p = P(c.at), y = height(p.x, p.z);
      const near = H.pts.reduce((b, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); return d < b.d ? { d, q } : b; }, { d: 1e9, q: null }).q, yaw = near ? Math.atan2(-near.fx, -near.fz) : 0, rx = near ? -near.fz : 1, rz = near ? near.fx : 0;
      const bx = p.x + rx * (W + 2.5), bz = p.z + rz * (W + 2.5); g.add(mesh(R.box, R.hull, bx, y + 1.4, bz, 2.4, 2.8, 2.4)); g.add(mesh(R.box, R.glass, bx, y + 1.9, bz, 2.5, 0.9, 2.5));
      solids.push({ x: bx, z: bz, r: 1.8, h: 2.8, zone: 'highway' });
      for (const sd of [-1, 1]) for (const k of [-1, 1]) { const ex = p.x + rx * sd * (W + 0.8) + (near ? near.fx : 0) * k * 6, ez = p.z + rz * sd * (W + 0.8) + (near ? near.fz : 0) * k * 6, m = mesh(R.box, R.barrier, ex, height(ex, ez) + 0.45, ez, 0.5, 0.9, 3); m.rotation.y = yaw; g.add(m); }
      const lamp = mesh(R.sph, /saltblood/i.test(c.faction) ? R.glowO : /helios/i.test(c.faction) ? R.tvisor : R.blue, bx, y + 3.2, bz, 0.3); g.add(lamp); flick.push({ m: lamp, blink: 0.3 });
      const arm = mesh(R.box, R.boom, p.x + rx * W * 0.5, y + 1.1, p.z + rz * W * 0.5, W, 0.12, 0.12); arm.rotation.y = yaw + Math.PI / 2; g.add(arm);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('⛔ ' + (c.name || c.id).toUpperCase().slice(0, 16), /saltblood/i.test(c.faction) ? '#ffb070' : '#9ad8ff'), transparent: true, depthWrite: false })); sp.position.set(bx, y + 4.4, bz); sp.scale.set(3.6, 0.9, 1); g.add(sp);
      return { ...c, x: p.x, z: p.z, cool: 0, arm }; });
  }
  // highway sample at arc length s (loops if the road is closed)
  function roadAt(s) { const H = HW, n = H.pts.length; if (H.closed) s = ((s % H.len) + H.len) % H.len; else s = Math.max(0, Math.min(H.len - 0.01, s));
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (H.pts[m].s <= s) lo = m; else hi = m; }
    const a = H.pts[lo], b = H.pts[hi], t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, fx: a.fx, fz: a.fz, s }; }
  function projectRoad(x, z) { let bd = 1e9, bs = 0; for (const p of HW.pts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bs = p.s; } } return { s: bs, d: Math.sqrt(bd) }; }
  // ---- traffic: civilian buggies/haulers/hoverbikes in lanes, a few ColSec cruisers. They spawn ahead/behind you near the road ----
  function updateTraffic(dt) {
    if (!HW || inside) return;
    const T = HW.def.traffic || {}, max = isMobile ? (T.phone_max ?? 4) : (T.desktop_max ?? 8), st = ctx.st(), car = st.driving ? st.car : null, pv = car ? Math.abs(car.speed) : 0;
    projT -= dt; if (projT <= 0) { projT = 0.5; const pr = projectRoad(player.x, player.z); projS = pr.s; trafT = pr.d; }
    const nearRoad = trafT < 160;
    const inCore = (x, z) => sites.some(s => Math.hypot(x - s.x, z - s.z) < s.core + 4);
    if (nearRoad && traffic.length < max && Math.random() < dt * 1.5) {
      const ahead = (Math.random() < 0.5 ? 1 : -1) * (70 + Math.random() * 60), dir = Math.random() < 0.5 ? 1 : -1, p = roadAt(projS + ahead);
      if (!inCore(p.x, p.z) && Math.hypot(p.x - player.x, p.z - player.z) > 55) {
        const kinds = (T.kinds || ['buggy', 'hauler', 'hoverbike']).filter(k => VEHICLES[k]), cop = Math.random() < (T.cop_chance ?? 0.15), kind = cop ? 'buggy' : kinds[Math.floor(Math.random() * kinds.length)] || 'buggy';
        const v = buildVehicle(kind, cop), spec = VEHICLES[kind], o = { ...v, kind, spec, x: p.x, z: p.z, yaw: 0, y: height(p.x, p.z) + (spec.hover || 0), vy: 0, speed: 0, steer: 0, pitch: 0, roll: 0, air: false, prevG: null, susp: 0, stolen: true, parked: false, zone: 'highway',
          traffic: { s: p.s, dir, lane: 2.4, vmax: kind === 'hauler' ? (T.hauler_speed || 9) : (T.civilian_speed || 14) * (0.85 + Math.random() * 0.4), cop, wreck: 0 } };
        scene.add(v.group); vehicles.push(o); traffic.push(o);
      }
    }
    for (const v of [...traffic]) {
      const t = v.traffic;
      if (v === st.car && st.driving) { traffic.splice(traffic.indexOf(v), 1); delete v.traffic; continue; } // carjacked
      const dP = Math.hypot(v.x - player.x, v.z - player.z);
      if (dP > 210 || inCore(v.x, v.z) || (!HW.closed && (t.s <= 1 || t.s >= HW.len - 1))) { despawnCar(v); continue; }
      if (t.cop && wanted > 0 && dP < 50) { despawnCar(v); const s = spawnSecurity('buggy', { x: v.x, z: v.z }); s.yaw = v.yaw; s.speed = Math.abs(t.v || 0); onEvent('siren', { traffic: true }); continue; }
      if (t.wreck > 0) { t.wreck -= dt; t.v = 0; v.speed = 0; v.group.position.set(v.x, v.y, v.z); continue; }
      const p = roadAt(t.s), fx = p.fx * t.dir, fz = p.fz * t.dir;
      // brake for anything in the lane ahead: you, your car, other traffic
      let want = t.vmax;
      const ahead = (ox, oz, gap) => { const dx = ox - v.x, dz = oz - v.z, f = dx * fx + dz * fz, l = Math.abs(dx * -fz + dz * fx); return f > 0 && f < gap && l < 2.4 ? f : 0; };
      const fp = ahead(player.x, player.z, 16); if (fp) { want = Math.min(want, Math.max(0, (fp - 5) * 1.2)); if (fp < 9 && (t.honk = (t.honk || 0) - dt) <= 0) { t.honk = 3; onEvent('honk', {}); } }
      for (const o of traffic) if (o !== v && o.traffic.dir === t.dir) { const f = ahead(o.x, o.z, 12); if (f) want = Math.min(want, Math.max(0, (f - 6) * 1.5)); }
      t.v = (t.v || 0) + (want - (t.v || 0)) * Math.min(1, dt * (want < (t.v || 0) ? 4 : 1.2));
      t.s += t.v * t.dir * dt;
      const q = roadAt(t.s), rx = -q.fz * t.dir, rz = q.fx * t.dir; v.x = q.x + rx * t.lane; v.z = q.z + rz * t.lane;
      v.yaw = Math.atan2(-fx, -fz); v.speed = t.v; v.y = height(v.x, v.z) + (v.spec.hover ? v.spec.hover : 0);
      v.group.position.set(v.x, v.y, v.z); v.group.rotation.set(0, v.yaw, 0); v.wheels?.forEach(w => { w.spin.rotation.x -= t.v * dt / 0.48; });
      // you hit it (or it hits you on foot)
      if (car && dP < (car.spec.r + v.spec.r) * 0.75) {
        const rel = Math.abs(pv - t.v * Math.sign(car.speed || 1)); if (rel > 6 || pv > 10) { t.wreck = 4; car.speed *= 0.45; const k = 1.2 / (dP || 1); v.x += (v.x - car.x) * k; v.z += (v.z - car.z) * k; onEvent('crash', { traffic: true, cop: t.cop });
          if (t.cop) crime(2, 'rammed a ColSec cruiser'); else if (witnessed(v.x, v.z)) crime(1, 'hit-and-run'); }
      } else if (!car && dP < 1.6 && t.v > 6) { ctx.game().hurtPlayer(Math.round(t.v), { x: v.x, z: v.z }); t.v = 0; t.wreck = 1.5; onEvent('thud', {}); }
    }
  }
  function despawnCar(v) { scene.remove(v.group); const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); const j = traffic.indexOf(v); if (j >= 0) traffic.splice(j, 1); }
  // ---- checkpoints: ColSec scans (wanted / speed / contraband), Helios private gate, the Saltblood toll ----
  function updateCheckpoints(dt) {
    if (!cps.length || inside) return; const st = ctx.st(), g = ctx.game(), pv = st.driving ? Math.abs(st.car.speed) : 0;
    for (const c of cps) {
      c.cool -= dt; c.arm.rotation.z = c.cool > 22 ? 1.2 : 0;
      if (c.cool > 0 || Math.hypot(player.x - c.x, player.z - c.z) > 9) continue;
      c.cool = 25; let msg = '', ok = true;
      if (/saltblood/i.test(c.faction)) {
        if (g.flag('saltblood_ok') || g.flag('marrow_paid')) msg = 'Saltblood toll: they know your face. Waved through.';
        else if (g.spend(20)) msg = 'Saltblood toll: 20 cr. "Pleasure doing business."';
        else { ok = false; msg = 'Saltblood toll: can\u2019t pay? They take it out of your hide.'; g.hostiles?.(['thug', 'thug'], c.x + 6, c.z + 6, { faction: 'Saltblood' }); }
      } else if (/helios/i.test(c.faction)) {
        if (wanted > 0) { ok = false; msg = 'Helios gate: private security locks the lane. Guns out.'; g.hostiles?.(['guard', 'guard'], c.x + 5, c.z - 5, { faction: 'Helios Private' }); }
        else msg = g.flag('helios_guest') ? 'Helios gate: "Welcome back." The boom lifts.' : 'Helios gate: they log your plate and let you through. Cameras follow you in.';
      } else {
        if (wanted > 0) { ok = false; msg = `${c.name || 'ColSec checkpoint'}: your face lights up the scanner.`; setWanted(Math.min(5, wanted + 1), 'ran a ColSec checkpoint'); }
        else if ((c.wanted_scan || 1) >= 2 && pv > 24) { if (g.spend(25)) msg = `${c.name}: speed trap. 25 cr fine, auto-debited.`; else { ok = false; msg = `${c.name}: speeding and broke. They flag you.`; crime(1, 'speeding through a checkpoint'); } }
        else if (/inspection|east/i.test(c.id + c.name) && g.flag('contraband')) { ok = false; msg = `${c.name}: the sniffer pings your cargo. Contraband!`; crime(2, 'contraband at inspection'); }
        else msg = `${c.name || 'Checkpoint'}: scanned and waved through.`;
      }
      onEvent('checkpoint', { id: c.id, faction: c.faction, ok, msg });
    }
  }
  // ---- camera nodes (Helios mansions): they witness crimes within 18 m unless cased (looped) ----
  function camSees(x, z) { for (const c of cams) if (!(c.cased > time) && Math.hypot(c.x - x, c.z - z) < 18) return c; return null; }
  function caseCamera(id, secs = 120) { const c = typeof id === 'string' ? cams.find(k => k.id === id) : nearCamera(); if (!c) return null; c.cased = time + secs; c.led.material = R.green; onEvent('camera', { id: c.id, cased: true }); return { id: c.id, until: secs }; }
  function nearCamera(r = 9) { let best = null, bd = r; for (const c of cams) { const d = Math.hypot(c.x - player.x, c.z - player.z); if (d < bd) { bd = d; best = c; } } return best; }
  // alarm: a heist module (or a tripped camera) raises the heat and private security rolls out
  function alarm(level = 2, at = null, why = 'tripped an alarm') { setWanted(Math.max(wanted, level), why); const p = at || player; if (actZone && actZone !== 'aj') ctx.game().hostiles?.(['guard', 'guard'].slice(0, isMobile ? 1 : 2), p.x + 8, p.z + 8, { faction: 'private' }); onEvent('alarm', { level }); }
  // ---- cover: the best spot near (x,z) that puts a solid between it and the threat at (px,pz) ----
  function coverNear(x, z, px, pz, maxD = 24) {
    let best = null, bs = 1e9;
    const consider = (sx, sz, ex, ez, src) => {
      const dx = sx - px, dz = sz - pz, dl = Math.hypot(dx, dz) || 1; let cxp, czp;
      if (ex) { if (Math.abs(dx) / ex > Math.abs(dz) / ez) { cxp = sx + Math.sign(dx) * (ex + 0.7); czp = sz + Math.max(-ez * 0.7, Math.min(ez * 0.7, (z - sz))); } else { czp = sz + Math.sign(dz) * (ez + 0.7); cxp = sx + Math.max(-ex * 0.7, Math.min(ex * 0.7, (x - sx))); } }
      else { cxp = sx + dx / dl * (src.r + 0.8); czp = sz + dz / dl * (src.r + 0.8); }
      const du = Math.hypot(cxp - x, czp - z), dp = Math.hypot(cxp - px, czp - pz); if (du > maxD || dp < 6 || dp > 42) return;
      const sc = du + Math.abs(dp - 16) * 0.4; if (sc < bs) { bs = sc; best = { x: cxp, z: czp, sx, sz }; }
    };
    for (const s of solids) if (Math.hypot(s.x - x, s.z - z) < maxD + 12) { if (s.box) consider(s.x, s.z, s.box[0], s.box[1], s); else if (s.r < 6) consider(s.x, s.z, 0, 0, s); }
    for (const b of camBoxes) if (Math.hypot(b.x - x, b.z - z) < maxD) consider(b.x, b.z, 0, 0, { r: 0.9 });
    for (const v of vehicles) if (v.parked && Math.hypot(v.x - x, v.z - z) < maxD) consider(v.x, v.z, 0, 0, { r: v.spec.r * 0.8 });
    return best;
  }
  // ---- gore & bodies (M tone): blood, corpses that stay ~20 s, gibs on rail/explosive kills ----
  function corpse(group, x, z) { group.rotation.x = -Math.PI / 2; group.position.y = height(x, z) + 0.25; corpses.push({ group, t: 20 }); const max = isMobile ? 4 : 8; while (corpses.length > max) scene.remove(corpses.shift().group); }
  function secKill(s, b = {}) {
    const i = security.indexOf(s); if (i < 0) return; security.splice(i, 1);
    const g = ctx.game(), gib = !!(b.explosive || b.gib || (b.dmg || 0) >= 30);
    if (s.foot) { g.gore?.(s.x, s.y + 1.3, s.z, { n: gib ? 3 : 1, gib, head: b.head });
      if (gib) scene.remove(s.group); else { s.group.scale.y = s.group.scale.x; corpse(s.group, s.x, s.z); }
      backupT = 25; onEvent('backup', { officerDown: true, kind: s.kind }); }
    else { scene.remove(s.group); g.gore?.(s.x, s.y + 0.5, s.z, { mech: true, n: 2 }); }
    onEvent('secDown', { kind: s.kind }); crime(Math.min(5, wanted + 1), s.foot ? 'killed a ColSec officer' : 'destroyed security');
  }
  const behindCover = (s, from) => s.crouch && s.cover && Math.hypot(from.x - s.x, from.z - s.z) > 4 && ((s.cover.sx - s.x) * (from.x - s.x) + (s.cover.sz - s.z) * (from.z - s.z)) > 0;

  // ----- wanted level -----
  const distC = () => { if (!C) return 1e9; const h = sites.length ? hubAt(player.x, player.z) : null; return h ? h.d : Math.hypot(player.x - cx, player.z - cz); }; // v7.5: distance to the nearest hub (colony or district)
  function setWanted(n, why) {
    n = Math.max(0, Math.min(5, Math.round(n)));
    if (n === wanted) return;
    const up = n > wanted; wanted = n; evade = 0;
    if (up) onEvent('wanted', { stars: n, why: why || '' });
    else if (n === 0) { onEvent('wantedLost', {}); for (const s of [...security]) recall(s); }
  }
  let crimeCd = 0;
  function crime(min, why) { if (!C || crimeCd > 0) return; if (duel && /colonist|discharging|hit-and-run/.test(why || '')) return; /* v7.4: sanctioned duel, so stray hits on bystanders aren't crimes */ crimeCd = 2.5; setWanted(wanted > 0 ? Math.min(5, Math.max(wanted + 1, min)) : min, why); }
  function witnessed(x, z) {
    if (!C) return false;
    if (Math.hypot(x - cx, z - cz) < 70) return true; // colony cameras
    for (const s of sites) if (s.cams && Math.hypot(x - s.x, z - s.z) < s.cams) return true; // district cameras (none in the Flats)
    if (camSees(x, z)) return true; // mansion camera nodes, unless cased
    return people.some(p => p.on !== false && !p.stun && Math.hypot(p.x - x, p.z - z) < (p.kind === 'guard' ? 55 : 25)) || security.some(s => Math.hypot(s.x - x, s.z - z) < 60);
  }
  function spawnSecurity(kind, at = null) {
    const st = ctx.st(), h = sites.length ? hubAt(player.x, player.z) : { site: { x: cx, z: cz }, d: distC() }, far = h.d > 120, a = Math.random() * 6.28, foot = kind === 'officer' || kind === 'heavy';
    let sx = far ? player.x + Math.cos(a) * (foot ? 55 : 90) : h.site.x + Math.cos(a) * 20, sz = far ? player.z + Math.sin(a) * (foot ? 55 : 90) : h.site.z + Math.sin(a) * 20;
    if (at) { sx = at.x; sz = at.z; }
    if (foot) { const q = freeSpot(sx, sz, 0.6); sx = q.x; sz = q.z; }
    let o;
    if (kind === 'drone' || kind === 'gunship') {
      const big = kind === 'gunship', g = new THREE.Group(); g.add(mesh(R.box, big ? R.heavy : R.paints.sec, 0, 0, 0, 0.9, 0.35, 0.9), mesh(R.ring, R.frame, 0, 0, 0, 0.9, 0.9, 1)); g.children[1].rotation.x = Math.PI / 2;
      const l = mesh(R.sph, R.red, -0.3, -0.25, 0, 0.12), r = mesh(R.sph, R.blue, 0.3, -0.25, 0, 0.12); g.add(l, r); g.userData.bar = [l, r];
      if (big) { for (const sx2 of [-1, 1]) g.add(mesh(R.box, R.dark, sx2 * 0.7, -0.15, -0.2, 0.18, 0.18, 0.9)); g.scale.setScalar(1.9); }
      o = { group: g, kind, x: sx, z: sz, y: height(sx, sz) + (big ? 11 : 8), hp: big ? 16 : 3, cd: 2, phase: Math.random() * 6 };
    } else if (foot) { // v7.5 ColSec on foot: officers use cover; heavies (4-5★) are armoured and walk you down
      const b = buildPerson('guard', security.length, kind === 'heavy' ? 'heavy' : null), sc = kind === 'heavy' ? 1.22 : 1; b.group.scale.setScalar(sc);
      o = { ...b, kind, foot: true, sc, x: sx, z: sz, y: height(sx, sz), yaw: 0, hp: kind === 'heavy' ? 24 : 8, cd: 1.5, ct: 0, pk: 1, peek: false, crouch: false, phase: Math.random() * 6, cover: null };
    } else {
      const v = buildVehicle('buggy', true);
      o = { ...v, kind, x: sx, z: sz, y: height(sx, sz), yaw: Math.atan2(-(player.x - sx), -(player.z - sz)), speed: 0, hp: 10, cd: 2.5, phase: 0, stuck: 0 };
    }
    o.group.position.set(o.x, o.y, o.z); scene.add(o.group); security.push(o); void st;
    return o;
  }
  function recall(s) { scene.remove(s.group); security.splice(security.indexOf(s), 1); }
  // v7.5.4: ColSec never fires inside the Rust Pit (#34): drones, buggies, officers, heavies, the gunship and guards all hold
  // fire while SSX.fight.inPit() (cage + 12 m apron, or a live bout); rounds already in the air do no damage there
  let pitHold = false;
  function secShoot(s, dmg) {
    if (pitHold) return;
    const from = new THREE.Vector3(s.x, s.y + (s.kind === 'drone' || s.kind === 'gunship' ? 0 : 1.6), s.z), st = ctx.st(), ty = st.driving ? st.car.y + 1.2 : player.y - 0.4;
    const to = new THREE.Vector3(player.x + (Math.random() - 0.5) * 2.5, ty, player.z + (Math.random() - 0.5) * 2.5);
    const m = new THREE.Mesh(R.bolt, R.boltM); m.position.copy(from); m.lookAt(to); scene.add(m);
    shots.push({ m, v: to.sub(from).normalize().multiplyScalar(38), life: 2.2, dmg });
    onEvent('secShot', {});
  }
  // officers: pick cover between them and you, crouch behind it, pop up to shoot. Heavies: no cover, 3-round bursts while advancing
  function footStep(s, dt, d, dx, dz, tx, tz) {
    s.cd -= dt; s.ct -= dt; s.phase += dt; let gx = s.x, gz = s.z, move = false; const sp = s.kind === 'heavy' ? 2.6 : 5.4;
    if (inside) { s.crouch = false; }
    else if (s.kind === 'officer') {
      if (s.ct <= 0) { s.cover = d < 50 ? coverNear(s.x, s.z, tx, tz, 24) : null; s.ct = 4.5 + Math.random() * 3; }
      if (s.cover) { const cd2 = Math.hypot(s.cover.x - s.x, s.cover.z - s.z);
        if (cd2 > 0.7) { gx = s.cover.x; gz = s.cover.z; move = true; s.crouch = false; }
        else { s.pk -= dt; if (s.pk <= 0) { s.peek = !s.peek; s.pk = s.peek ? 0.9 + Math.random() * 0.5 : 1.1 + Math.random() * 0.9; } s.crouch = !s.peek;
          if (s.peek && s.cd <= 0 && d < 42) { s.cd = 0.75; secShoot(s, 4 + wanted); } } }
      else { s.crouch = false; if (d > 13) { gx = tx; gz = tz; move = true; } if (d < 34 && s.cd <= 0) { s.cd = 1.2; secShoot(s, 4 + wanted); } }
    } else { if (d > 7) { gx = tx; gz = tz; move = true; } if (d < 38 && s.cd <= 0) { s.burst = (s.burst || 0) + 1; s.cd = s.burst % 3 ? 0.16 : 1.5; secShoot(s, 7 + wanted); } }
    if (move) { const mx = gx - s.x, mz = gz - s.z, ml = Math.hypot(mx, mz) || 1; let nx = s.x + mx / ml * sp * dt, nz = s.z + mz / ml * sp * dt; const c = collide(nx, nz, 0.45); if (c) { nx = c.x; nz = c.z; } s.x = nx; s.z = nz; s.yaw = Math.atan2(-mx, -mz); }
    else s.yaw = Math.atan2(-dx, -dz);
    const w = move ? Math.sin(s.phase * (s.kind === 'heavy' ? 7 : 12)) * 0.6 : 0; s.legs[0].rotation.x = w; s.legs[1].rotation.x = -w;
    s.y = height(s.x, s.z); s.group.scale.set(s.sc, s.sc * (s.crouch ? 0.6 : 1), s.sc); s.group.rotation.y = s.yaw;
  }
  function updateSecurity(dt) {
    const st = ctx.st(), game = ctx.game(), down = game.isDown();
    try { pitHold = !!globalThis.SSX?.fight?.inPit?.(); } catch (e) { pitHold = false; }
    // how many units the current heat calls for
    if (wanted > 0 && !down) {
      respawnCd -= dt;
      const wantD = Math.min(caps.drones, wanted >= 1 ? Math.ceil(wanted / 2) + (wanted >= 4 ? 1 : 0) : 0), wantB = wanted >= 2 ? Math.min(caps.buggies, wanted - 1) : 0;
      // v7.5: officers on foot from 2★ (+1 backup for 25 s after an officer goes down), armoured heavies at 4-5★, a gunship at 5★
      const wantO = wanted >= 2 ? Math.min(caps.officers, wanted - 1 + (backupT > 0 ? 1 : 0)) : 0, wantH = wanted >= 4 ? Math.min(caps.heavies, wanted - 3) : 0, wantG = wanted >= 5 ? 1 : 0;
      const cnt = k => security.filter(s => s.kind === k).length;
      if (respawnCd <= 0) {
        if (cnt('drone') < wantD) { spawnSecurity('drone'); respawnCd = 3; }
        else if (cnt('buggy') < wantB) { spawnSecurity('buggy'); respawnCd = 4; onEvent('siren', {}); }
        else if (cnt('officer') < wantO) { spawnSecurity('officer'); respawnCd = 3.5; }
        else if (cnt('heavy') < wantH) { spawnSecurity('heavy'); respawnCd = 5; onEvent('heavy', {}); }
        else if (cnt('gunship') < wantG) { spawnSecurity('gunship'); respawnCd = 6; onEvent('gunship', {}); }
      }
    }
    const tx = player.x, tz = player.z, pv = st.driving ? Math.abs(st.car.speed) : 0;
    let nearest = 1e9, close = false;
    for (const s of [...security]) {
      s.phase += dt; const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz) || 0.01;
      if (s.group.userData.bar) { const f = Math.sin(s.phase * 14) > 0; s.group.userData.bar[0].visible = f; s.group.userData.bar[1].visible = !f; }
      if (wanted === 0 || down) { // head home and vanish
        s.y += dt * 4; s.x -= dx / d * dt * 10; s.z -= dz / d * dt * 10; if (d > 140) { recall(s); continue; }
      } else if (s.foot) { footStep(s, dt, d, dx, dz, tx, tz);
        if (d > 230) { recall(s); continue; }
      } else if (s.kind === 'gunship') {
        const keep = 16, sp = 20; s.x += dx / d * Math.min(sp, (d - keep) * 1.5) * dt; s.z += dz / d * Math.min(sp, (d - keep) * 1.5) * dt;
        s.y += (Math.max(height(s.x, s.z), (st.driving ? st.car.y : player.y - 1.7)) + 9 + Math.sin(s.phase) - s.y) * Math.min(1, dt * 2);
        s.cd -= dt; if (!inside && d < 60 && s.cd <= 0) { s.burst = (s.burst || 0) + 1; s.cd = s.burst % 4 ? 0.14 : 1.8; secShoot(s, 6 + wanted); }
      } else if (s.kind === 'drone') {
        const keep = 9, sp = 26; s.x += dx / d * Math.min(sp, (d - keep) * 2) * dt; s.z += dz / d * Math.min(sp, (d - keep) * 2) * dt;
        s.y += (Math.max(height(s.x, s.z), (st.driving ? st.car.y : player.y - 1.7)) + 5 + Math.sin(s.phase * 2) - s.y) * Math.min(1, dt * 3);
        s.cd -= dt; if (!inside && d < 45 && s.cd <= 0 && wanted >= 2) { s.cd = 1.6 - wanted * 0.12; secShoot(s, 5 + wanted); }
      } else {
        // patrol buggy: chase, cut you off, ram; shoots from the window at 3+ stars
        const lead = st.driving ? 0.6 : 0, gx = tx - Math.sin(st.car?.yaw || 0) * pv * lead, gz = tz - Math.cos(st.car?.yaw || 0) * pv * lead;
        const want = Math.atan2(-(gx - s.x), -(gz - s.z)); s.yaw += Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)) * Math.min(1, dt * 2.6);
        const vmax = d < 8 ? Math.max(4, pv * 0.9) : 25 + wanted; s.speed += (vmax - s.speed) * Math.min(1, dt * 1.5);
        let nx = s.x - Math.sin(s.yaw) * s.speed * dt, nz = s.z - Math.cos(s.yaw) * s.speed * dt;
        const c = collide(nx, nz, 1.8); if (c) { nx = c.x; nz = c.z; s.speed *= 0.6; }
        s.x = nx; s.z = nz; s.y = height(s.x, s.z);
        s.group.rotation.set(0, s.yaw, 0); s.wheels.forEach(w => { w.spin.rotation.x -= s.speed * dt / 0.48; w.pivot.position.y = 0.48; });
        if (!inside && d < 4.2 && s.speed > 6) { s.speed *= 0.3; game.hurtPlayer(6 + wanted * 2, { x: s.x, z: s.z, security: true }); onEvent('crash', {}); }
        s.cd -= dt; if (!inside && d < 35 && s.cd <= 0 && wanted >= 3) { s.cd = 1.3; secShoot(s, 6 + wanted); }
        // v7.5: at 3★+ a buggy that gets close and slow drops officers (backup)
        if (!inside && wanted >= 3 && !s.deployed && d < 26 && s.speed < 10 && security.filter(q => q.foot).length < caps.officers + caps.heavies) { s.deployed = true; for (let k = 0; k < (isMobile ? 1 : 2); k++) spawnSecurity('officer', { x: s.x + Math.cos(s.yaw) * (k ? -2.2 : 2.2), z: s.z - Math.sin(s.yaw) * (k ? -2.2 : 2.2) }); onEvent('backup', { deploy: true }); }
        if (d > 260) { recall(s); continue; } // left behind
      }
      s.group.position.set(s.x, s.y, s.z); if (s.kind === 'drone' || s.kind === 'gunship') s.group.rotation.y += dt;
      nearest = Math.min(nearest, d);
      if (d < (s.kind === 'drone' ? 7 : 7.5) && (!st.driving || pv < 2.5)) close = true;
    }
    // guards join in on foot
    for (const p of people) if (p.kind === 'guard' && p.on !== false && !p.stun && wanted > 0 && !down) { const d = Math.hypot(tx - p.x, tz - p.z); nearest = Math.min(nearest, d); if (d < 4 && (!st.driving || pv < 2.5)) close = true; }
    // busted: they get hands on you (on foot or boxed in while stopped)
    if (wanted > 0 && !down) {
      if (inside) close = false; // they can't see you in here
      bustT = close ? bustT + dt : Math.max(0, bustT - dt * 0.5);
      if (bustT > (st.driving ? 3 : 2)) { bustT = 0; game.bust(); }
      // evading: out of their reach, longer the hotter you are; lying low on foot halves it
      const lyingLow = !st.driving && (player.moving || 0) < 0.05;
      if (inside) evade += dt * 1.5; // hiding indoors: the heat cools off (faster at low stars)
      else if (nearest > 95 && distC() > 90) evade += dt * (lyingLow ? 2 : 1); else if (nearest > 60 && lyingLow && distC() > 70) evade += dt; else evade = Math.max(0, evade - dt * 0.5);
      if (evade > 5 + wanted * 2.5) setWanted(0);
    }
    for (const s of [...shots]) {
      s.life -= dt; s.m.position.addScaledVector(s.v, dt);
      const p = s.m.position, ty = st.driving ? st.car.y + 1.2 : player.y - 0.6;
      if (!inside && !pitHold && Math.hypot(p.x - tx, p.z - tz) < (st.driving ? 2.4 : 1.0) && Math.abs(p.y - ty) < 1.6) { game.hurtPlayer(s.dmg, { x: p.x - s.v.x, z: p.z - s.v.z, security: true }); s.life = 0; }
      if (p.y < height(p.x, p.z) || s.life <= 0) { scene.remove(s.m); shots.splice(shots.indexOf(s), 1); }
    }
  }

  // ----- colonists wander, guards patrol, contacts loiter; everyone scatters from fast traffic -----
  function updatePeople(dt) {
    const st = ctx.st(), car = st.driving ? st.car : null, pv = car ? Math.abs(car.speed) : 0;
    for (const p of people) {
      if (p.on === false) continue; // v7.5: only the hub you're at is live
      p.phase += dt;
      if (p.stun > 0) { p.stun -= dt; p.group.rotation.x = -Math.PI / 2 * Math.min(1, p.stun * 2); p.group.position.y = height(p.x, p.z) + 0.3; if (p.stun <= 0) { p.group.rotation.x = 0; p.hp = p.kind === 'guard' ? 6 : 3; } continue; }
      if (duel && p === duel.p) { duelStep(p, dt); continue; }
      let gx = p.x, gz = p.z, sp = 0;
      const dx = player.x - p.x, dz = player.z - p.z, d = Math.hypot(dx, dz) || 0.01;
      if (duel && p.watch !== undefined) { // the crowd rings the fight and cheers
        const R0 = p.kind === 'guard' ? 9.5 : 7.4, tx = duel.cx + Math.cos(p.watch) * R0, tz = duel.cz + Math.sin(p.watch) * R0, ml = Math.hypot(tx - p.x, tz - p.z);
        if (ml > 0.4) { const st2 = Math.min(ml, 4.5 * dt); p.x += (tx - p.x) / ml * st2; p.z += (tz - p.z) / ml * st2; }
        p.yaw = Math.atan2(-(duel.cx - p.x), -(duel.cz - p.z)); const w2 = ml > 0.4 ? Math.sin(p.phase * 9) * 0.6 : 0; p.legs[0].rotation.x = w2; p.legs[1].rotation.x = -w2;
        p.group.position.set(p.x, height(p.x, p.z) + (ml <= 0.4 ? Math.abs(Math.sin(p.phase * (p.kind === 'guard' ? 2 : 7) + p.watch * 3)) * (p.kind === 'guard' ? 0.02 : 0.16) : 0), p.z); p.group.rotation.y = p.yaw; continue;
      }
      if (car && d < 9 && pv > 5) { p.flee = 1.2; p.fx = -dx / d; p.fz = -dz / d; if (d < 2.8 && pv > 9) { p.stun = 8; onEvent('thud', {}); if (p.kind === 'colonist') civHits++; ctx.game().gore?.(p.x, height(p.x, p.z) + 1, p.z, { n: 1 }); if (witnessed(p.x, p.z)) crime(1, 'hit-and-run'); continue; } }
      if (p.flee > 0) { p.flee -= dt; gx = p.x + p.fx * 5; gz = p.z + p.fz * 5; sp = 6; }
      else if (p.kind === 'guard' && wanted > 0 && !ctx.game().isDown() && d < 60) { gx = player.x; gz = player.z; sp = d > 3 ? 5.5 : 0;
        p.cd -= dt; if (wanted >= 2 && d < 30 && d > 3 && p.cd <= 0) { p.cd = 1.4; secShoot({ x: p.x, y: height(p.x, p.z) - 0.2, z: p.z, kind: 'guard' }, 5 + wanted); } }
      else if (p.kind === 'contact') { gx = p.home.x + Math.sin(p.phase * 0.3) * 1.2; gz = p.home.z; sp = 0.6; if (d < 6) { p.yaw = Math.atan2(-dx, -dz); } }
      else if (p.pts) {
        if (p.wait > 0) { p.wait -= dt; }
        else { const t = p.pts[p.ti % p.pts.length]; gx = t.x; gz = t.z; sp = p.kind === 'guard' ? 2.2 : 1.6; if (Math.hypot(t.x - p.x, t.z - p.z) < 1.5) { p.ti += 1 + (p.ti % 2); p.wait = 2 + Math.random() * 4; } }
      }
      const mx = gx - p.x, mz = gz - p.z, ml = Math.hypot(mx, mz);
      if (sp && ml > 0.3) { let nx = p.x + mx / ml * sp * dt, nz = p.z + mz / ml * sp * dt; const c = collide(nx, nz, 0.4); if (c) { nx = c.x; nz = c.z; } p.x = nx; p.z = nz; const fy = Math.atan2(-mx, -mz); p.yaw += Math.atan2(Math.sin(fy - p.yaw), Math.cos(fy - p.yaw)) * Math.min(1, dt * 6); }
      const w = sp && ml > 0.3 ? Math.sin(p.phase * (sp > 3 ? 12 : 7)) * 0.6 : 0;
      p.legs[0].rotation.x = w; p.legs[1].rotation.x = -w;
      p.group.position.set(p.x, height(p.x, p.z), p.z); p.group.rotation.y = p.yaw;
    }
  }
  function updateFx(dt) {
    for (const f of flick) {
      if (f.blink !== undefined) f.m.visible = ((time + f.blink) % 1.2) < 0.25;
      else if (f.flicker) f.m.material = Math.random() < (Math.sin(time * 0.7 + f.m.position.x) > 0.6 ? 0.25 : 0.02) ? R.lampOff : R.lampOn;
      else if (f.sign) f.m.visible = !(Math.sin(time * 1.3 + f.m.position.z) > 0.93 && Math.random() < 0.5);
    }
    if (inside && lights[0]) { const L = inside.room.def.light; lights[0].intensity = L.int * (L.pulse ? 0.75 + 0.25 * Math.abs(Math.sin(time * 118 / 60 * Math.PI)) : 1); }
    else if (lights[0]) lights[0].intensity = 60 * (0.85 + Math.random() * 0.15 * (Math.sin(time * 9) > 0.8 ? 1 : 0.2));
  }
  function update(dt) {
    if (!C) return;
    time += dt; crimeCd -= dt;
    zoneT -= dt; if (zoneT <= 0) { zoneT = 0.5; updateZones(); }
    backupT -= dt;
    updatePeople(dt); updateSecurity(dt); updateFx(dt); updateTraffic(dt); updateCheckpoints(dt);
    for (const c of [...corpses]) { c.t -= dt; if (c.t <= 0) { scene.remove(c.group); corpses.splice(corpses.indexOf(c), 1); } }
    if (inside) inside.room.tick(dt);
    // parked vehicles hug the ground (hover ones bob)
    const st = ctx.st();
    for (const v of vehicles) if (v !== st.car || !st.driving) { if (v.parked) { v.y = height(v.x, v.z) + (v.spec.hover ? v.spec.hover * 0.35 + Math.sin(time * 2 + v.x) * 0.06 : 0); v.group.position.set(v.x, v.y, v.z); v.group.rotation.set(0, v.yaw, 0); } }
  }

  // ----- vehicles: take one (stealing is a crime if anyone sees), leave it wherever -----
  function nearVehicle(px, pz, range = 4.5) {
    let best = null, bd = range;
    for (const v of vehicles) { const d = Math.hypot(v.x - px, v.z - pz) - v.spec.r * 0.6; if (d < bd) { bd = d; best = v; } }
    return best;
  }
  function nearestVehicle() { let best = null, bd = 1e9; for (const v of vehicles) { const d = Math.hypot(v.x - player.x, v.z - player.z); if (d < bd) { bd = d; best = v; } } return best; }
  function take(v) {
    if (v.traffic) { const j = traffic.indexOf(v); if (j >= 0) traffic.splice(j, 1); delete v.traffic; v.speed = 0; onEvent('take', { kind: v.kind, name: v.spec.name, seen: true, carjack: true }); crime(1, `carjacked a ${v.spec.name.toLowerCase()}`); v.parked = false; v.taken = true; return; }
    v.parked = false;
    if (!v.taken) { v.taken = true; const g = ctx.game(); g.progress.stats.stolen = (g.progress.stats.stolen || 0) + 1; }
    const seenBy = witnessed(v.x, v.z);
    onEvent('take', { kind: v.kind, name: v.spec.name, seen: seenBy });
    if (seenBy) crime(1, `stole a ${v.spec.name.toLowerCase()}`);
  }
  function leave(v) { v.parked = true; v.speed = 0; }
  // player bolts can hit people and security (that\u2019s a crime, obviously)
  const seg = new THREE.Vector3(), q = new THREE.Vector3(), tv = new THREE.Vector3();
  function segHit(p0, p1, c, r) { seg.copy(p1).sub(p0); const L2 = seg.lengthSq(); const t = L2 ? Math.max(0, Math.min(1, tv.copy(c).sub(p0).dot(seg) / L2)) : 0; q.copy(p0).addScaledVector(seg, t); return q.distanceTo(c) < r; }
  function hitWorld(p0, p1, b) {
    if (!C) return false;
    for (const s of [...security]) { const air = s.kind === 'drone' || s.kind === 'gunship'; tv.set(s.x, s.y + (air ? 0 : s.foot ? (s.crouch ? 0.75 : 1.2) * s.sc : 1), s.z); const c = tv.clone();
      if (segHit(p0, p1, c, s.kind === 'gunship' ? 1.8 : air ? 1 : s.foot ? 0.75 * s.sc : 2)) { if (s.foot && behindCover(s, p0)) { onEvent('cover', {}); return true; }
        const head = s.foot && q.y > s.y + 1.7 * s.sc && s.kind !== 'heavy', dmg = b.dmg * (head ? 2.5 : 1) * (s.kind === 'heavy' ? 0.6 : 1); s.hp -= dmg;
        if (s.foot) ctx.game().gore?.(q.x, q.y, q.z, { n: head ? 1.5 : 0.6, spray: true });
        if (s.hp <= 0) secKill(s, { dmg: b.dmg, head, gib: b.gib || b.rail }); else crime(2, 'shot at security'); return true; } }
    for (const p of people) { if (p.stun > 0 || p.on === false) continue; const c = new THREE.Vector3(p.x, height(p.x, p.z) + 1.2, p.z); if (segHit(p0, p1, c, 0.6)) { if (duel && p === duel.p) { if (duel.phase === 'fight' && duel.type === 'pistol') duelHit(); return true; } p.hp -= b.dmg; p.flee = 2; p.fx = Math.sign(p.x - p0.x) || 1; p.fz = Math.sign(p.z - p0.z) || 1; ctx.game().gore?.(p.x, height(p.x, p.z) + 1.2, p.z, { n: 0.6, spray: true }); if (p.kind === 'colonist') civHits++; if (p.hp <= 0) { p.stun = 15; onEvent('thud', {}); } crime(p.kind === 'guard' ? 2 : 1, p.kind === 'guard' ? 'shot a guard' : 'shot a colonist'); return true; } }
    return false;
  }
  // auto-aim candidates: security always (they only show up once you're wanted), guards while wanted
  function targets() {
    if (!C) return [];
    const out = security.map(s => ({ x: s.x, y: s.y + (s.kind === 'drone' || s.kind === 'gunship' ? 0 : s.foot ? (s.crouch ? 0.75 : 1.2) : 1), z: s.z, kind: s.kind }));
    if (duel && duel.type === 'pistol' && duel.phase === 'fight') out.push({ x: duel.p.x, y: height(duel.p.x, duel.p.z) + 1.2, z: duel.p.z, kind: 'duelist' });
    if (wanted > 0) for (const p of people) if (p.kind === 'guard' && !p.stun && p.on !== false) out.push({ x: p.x, y: height(p.x, p.z) + 1.2, z: p.z, kind: 'guard' });
    return out;
  }
  // nearest hittable thing within reach (yaw = facing to require it in front, or null for any direction)
  function meleeTarget(x, z, yaw, range) {
    if (!C) return null;
    let best = null, bd = range;
    const consider = (o, kind) => { const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); if (d > bd) return; if (yaw !== null) { const a = Math.atan2(-dx, -dz) - yaw; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 1.4 && d > 1.5) return; } bd = d; best = { x: o.x, z: o.z, kind }; };
    for (const p of people) if (!p.stun && p.kind !== 'contact' && p.on !== false) consider(p, p.kind);
    for (const s of security) if ((s.kind !== 'drone' && s.kind !== 'gunship') || Math.abs(s.y - player.y) < 3) consider(s, s.kind);
    return best;
  }
  // a punch/kick/blade hit on colony folk or security. Returns true if something was hit.
  function meleeWorld(x, z, fx, fz, range, dmg, knock) {
    if (!C) return false;
    const inFront = o => { const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); return d < range + 0.4 && (dx * fx + dz * fz) > -0.3 ? d || 1 : 0; };
    for (const p of people) {
      if (p.stun > 0 || p.kind === 'contact' || p.on === false) continue; const d = inFront(p); if (!d) continue;
      if (duel && p === duel.p) { if (duel.phase === 'fight' && duel.type !== 'pistol') duelHit(); onEvent('meleeHit', { kind: 'duelist' }); return true; }
      p.hp -= dmg; p.flee = 3; p.x += (p.x - x) / d * knock; p.z += (p.z - z) / d * knock; p.fx = Math.sign(p.x - x) || 1; p.fz = Math.sign(p.z - z) || 1;
      if (p.hp <= 0) { p.stun = 15; onEvent('thud', {}); }
      crime(p.kind === 'guard' ? 2 : 1, p.kind === 'guard' ? 'assaulted a guard' : p.kind === 'contact' ? 'assaulted a fixer' : 'assaulted a colonist');
      onEvent('meleeHit', { kind: p.kind }); return true;
    }
    for (const s of [...security]) {
      if ((s.kind === 'drone' || s.kind === 'gunship') && Math.abs(s.y - player.y) > 3) continue; const d = inFront(s); if (!d) continue;
      s.hp -= dmg; if (s.kind !== 'buggy') { s.x += (s.x - x) / d * knock; s.z += (s.z - z) / d * knock; } if (s.foot) ctx.game().gore?.(s.x, s.y + 1.3, s.z, { n: 0.5 });
      if (s.hp <= 0) secKill(s, { dmg }); else crime(2, 'attacked security');
      onEvent('meleeHit', { kind: s.kind }); return true;
    }
    return false;
  }
  // v7.2 rover rockets / EMP: area damage on colony folk and security. emp = stun people and stall drones too.
  function blast(c, R, dmg, emp) {
    if (!C) return 0; let n = 0;
    for (const s of [...security]) { const d = Math.hypot(s.x - c.x, s.z - c.z); if (d > R) continue; n++; s.hp -= emp ? (s.foot ? 0 : dmg * 2) : dmg * (1 - d / R); if (emp && s.foot) { s.cd = 4; }
      if (s.hp <= 0) secKill(s, { dmg, explosive: !emp && d < R * 0.6 }); else crime(2, 'attacked security'); }
    for (const p of people) { if (p.stun > 0 || p.kind === 'contact' || p.on === false) continue; const d = Math.hypot(p.x - c.x, p.z - c.z); if (d > R) continue; n++;
      if (emp) { p.stun = 5; } else { p.hp -= dmg * (1 - d / R); p.flee = 3; p.fx = Math.sign(p.x - c.x) || 1; p.fz = Math.sign(p.z - c.z) || 1; if (p.hp <= 0) { p.stun = 15; onEvent('thud', {}); } }
      crime(p.kind === 'guard' ? 2 : 1, p.kind === 'guard' ? 'attacked a guard' : 'attacked a colonist'); }
    return n;
  }
  // ----- v7.4 legal duels: challenge a colonist to fists, blades or a quick-draw at 10 paces. Sanctioned, to KO or yield -----
  const DUEL_TYPES = {
    fists: { name: 'Fists', icon: '👊', hit: 20, dmg: 9, reach: 1.7, cd: 1.1 },
    blades: { name: 'Blades', icon: '🔪', hit: 30, dmg: 14, reach: 1.9, cd: 1.3 },
    pistol: { name: 'Quick-draw', icon: '🔫', hit: 50, dmg: 35, reach: 0, cd: 1.2 },
  };
  function nearDuelist(r = 3.4) {
    if (!C || inside || duel) return null; let best = null, bd = r;
    for (const p of people) if (p.kind === 'colonist' && !p.stun && !(p.flee > 0)) { const d = Math.hypot(p.x - player.x, p.z - player.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  const duelPub = p => p && { name: p.name, champion: !!p.fighter, minWager: p.fighter?.minWager || 0, record: p.duels || 0, rematch: !!p.duels };
  // opts.as (v7.5 fight club, mars/fightclub.js): a named ring fighter { name, tough, dmg, purse, label } borrows the nearest
  // free colonist's body for the bout (renamed, restored after). opts.tag rides along on the result.
  const borrowBody = () => { let best = null, bd = Infinity; for (const p of people) { if (p.kind !== 'colonist' || p.stun || p.fighter || p.flee > 0) continue; const d = Math.hypot(p.x - player.x, p.z - player.z) + (p.on === false ? 1e4 : 0); if (d < bd) { bd = d; best = p; } }
    if (best && best.on === false) { best.on = true; best.group.visible = true; } return best; };
  function challenge(type = 'fists', wager = 0, who = null, opts = null) {
    const as = opts?.as || null;
    const p = as ? (duel ? null : borrowBody()) : who ? people.find(q => q.name === who && q.kind === 'colonist') : nearDuelist(4.5), T = DUEL_TYPES[type], g = ctx.game();
    if (!C || !p || !T) return { ok: false, msg: duel ? 'One fight at a time.' : 'Nobody close enough to call out.' };
    if (duel) return { ok: false, msg: 'One fight at a time.' };
    if (wanted > 0) return { ok: false, msg: `${as ? as.name : p.name}: With the law on you? No chance.` };
    let restore = null;
    if (as) { restore = { name: p.name, fighter: p.fighter, label: null }; p.name = as.name; p.fighter = { purse: as.purse | 0, minWager: 0, tough: as.tough || 1 };
      if (as.label) { restore.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(as.label), transparent: true, depthWrite: false })); restore.label.position.y = 2.6; restore.label.scale.set(2.8, 0.7, 1); p.group.add(restore.label); } }
    wager = Math.max(0, Math.round(wager)); const F = p.fighter;
    if (F && wager < F.minWager) return { ok: false, msg: `${p.name}: I don’t get out of bed for less than ${F.minWager}.` };
    if (!F && p.temper < 0.2) return { ok: false, refused: true, msg: `${p.name}: ` + ['Not today, spacer. I just got this suit cleaned.', 'Fight you? I’ve seen you drive. Pass.', 'Nope. Go bother somebody tougher.'][(p.duels || 0) % 3] };
    if (wager && !g.spend(wager)) return { ok: false, msg: `You don’t have ${wager} cr to put up.` };
    const dx = p.x - player.x, dz = p.z - player.z, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
    const gap = type === 'pistol' ? 7.5 : 3.2; // pistols: 10 paces
    p.x = player.x + ux * gap; p.z = player.z + uz * gap; p.yaw = Math.atan2(ux, uz); p.flee = 0;
    duel = { p, type, T, wager, pot: wager * 2 + (F ? F.purse : 0), me: 100, them: 100, tough: F ? F.tough : 1, t: 0, phase: 'count', ocd: 1.2, cx: (player.x + p.x) / 2, cz: (player.z + p.z) / 2,
      chicken: type === 'pistol' && !F && p.temper < 0.42, yieldAt: !F && p.temper < 0.65 ? 22 : 0, hits: 0, taken: 0, restore, dmgK: as?.dmg || null, tag: opts?.tag ?? null };
    // the ring, and a crowd (guards too, but they only watch)
    if (!ringM) { ringM = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.0, 48), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })); ringM.rotation.x = -Math.PI / 2; }
    ringM.position.set(duel.cx, height(duel.cx, duel.cz) + 0.06, duel.cz); scene.add(ringM);
    let k = 0; for (const q of people) { if (q === p || q.stun || q.kind === 'contact') continue; if (Math.hypot(q.x - duel.cx, q.z - duel.cz) > 70) continue; if (k >= 7) break; q.watch = (k++ / 7) * Math.PI * 2 + 0.3; }
    onEvent('duel', { start: true, name: p.name, type, wager, pot: duel.pot, champion: !!F });
    return { ok: true, msg: `${T.icon} ${T.name} with ${p.name}. Pot ${duel.pot} cr.` };
  }
  function duelHit() {
    const D = duel; D.them = Math.max(0, D.them - D.T.hit / D.tough); D.hits++; onEvent('duelHit', { who: 'them', them: D.them });
    D.p.flee = 0; D.p.x += (D.p.x - player.x) * 0.08; D.p.z += (D.p.z - player.z) * 0.08;
    if (D.them <= 0) endDuel('ko-win'); else if (D.yieldAt && D.them <= D.yieldAt) endDuel('yield-win');
  }
  function duelStep(p, dt) {
    const D = duel; D.t += dt;
    const dx = player.x - p.x, dz = player.z - p.z, d = Math.hypot(dx, dz) || 0.01; p.yaw = Math.atan2(-dx, -dz);
    let moving = false;
    if (D.phase === 'count') {
      if (D.chicken && D.t > 1.7) return endDuel('chicken');
      if (D.t >= 3) { D.phase = 'fight'; D.ocd = D.type === 'pistol' ? (p.fighter ? 0.55 : 0.85) + (p.temper % 0.3) : 0.8; onEvent('duel', { go: true }); }
    } else if (D.phase === 'fight') {
      if (Math.hypot(player.x - D.cx, player.z - D.cz) > 11) return endDuel('forfeit');
      D.ocd -= dt;
      if (D.type === 'pistol') { if (D.ocd <= 0) { D.ocd = D.T.cd * (p.fighter ? 0.8 : 1); const hitP = ((D.t * 7.3 + p.temper) % 1) < (p.fighter ? 0.75 : 0.6); onEvent('duelShot', { x: p.x, z: p.z, hit: hitP }); if (hitP) duelHurt(D.T.dmg * (D.dmgK || (p.fighter ? 1.2 : 1))); } }
      else if (d > D.T.reach) { const sp = 3.3 * dt; p.x += dx / d * sp; p.z += dz / d * sp; moving = true; }
      else if (D.ocd <= 0) { D.ocd = D.T.cd * (p.fighter ? 0.75 : 1); const hitP = ((D.t * 5.7 + p.temper) % 1) < 0.72; onEvent('duelSwing', { hit: hitP }); if (hitP) duelHurt(D.T.dmg * (D.dmgK || (p.fighter ? 1.4 : 1))); }
    }
    if (!duel) return;
    const w = moving ? Math.sin(p.phase * 12) * 0.6 : 0; p.legs[0].rotation.x = w; p.legs[1].rotation.x = -w;
    p.group.position.set(p.x, height(p.x, p.z), p.z); p.group.rotation.y = p.yaw;
  }
  function duelHurt(n) { const D = duel; D.me = Math.max(0, D.me - n); D.taken++; onEvent('duelHit', { who: 'me', me: D.me }); if (D.me <= 0) endDuel('ko-lose'); }
  function endDuel(why, quiet) {
    const D = duel; if (!D) return null; duel = null; const p = D.p, g = ctx.game();
    if (ringM) scene.remove(ringM);
    for (const q of people) delete q.watch;
    const win = why === 'ko-win' || why === 'yield-win', F = p.fighter;
    let cr = 0, xp = 0;
    if (win) { cr = D.pot; xp = F ? 80 : 30; g.reward?.(xp, cr); p.duels = (p.duels || 0) + 1; if (F) F.purse += 50; }
    else if (why === 'chicken' || why === 'abandon') { cr = D.wager; if (cr) g.reward?.(0, cr); }
    if (why === 'ko-win') { p.stun = 5; p.hp = 0; } else if (why === 'chicken') { p.flee = 4; p.fx = (p.x - player.x) || 1; p.fz = (p.z - player.z) || 1; const l = Math.hypot(p.fx, p.fz); p.fx /= l; p.fz /= l; }
    if (why !== 'ko-win') p.hp = 3;
    const res = { end: true, why, win, name: p.name, type: D.type, pot: D.pot, wager: D.wager, credits: win ? cr : 0, xp, refund: !win && cr ? cr : 0, champion: !!F, tag: D.tag, hits: D.hits, taken: D.taken };
    if (D.restore) { const o = D.restore; p.name = o.name; if (o.fighter) p.fighter = o.fighter; else delete p.fighter; if (o.label) { p.group.remove(o.label); o.label.material.map?.dispose(); o.label.material.dispose(); } }
    if (!quiet) onEvent('duel', res);
    lastDuel = res; return res;
  }
  let lastDuel = null;
  const duelState = () => duel ? { name: duel.p.name, type: duel.type, icon: duel.T.icon, label: duel.T.name, tag: duel.tag, phase: duel.phase, count: Math.max(0, Math.ceil(3 - duel.t)), me: Math.round(duel.me), them: Math.round(duel.them), pot: duel.pot, champion: !!duel.p.fighter, x: duel.p.x, z: duel.p.z, cx: duel.cx, cz: duel.cz } : null;
  function shotFired() { if (C && distC() < 80 && !ctx.game().combat && !duel) crime(1, 'discharging a weapon in the colony'); }
  function nearContact() { if (!C) return null; for (const p of people) if (p.kind === 'contact' && Math.hypot(p.x - player.x, p.z - player.z) < 4.5) return p; return null; }
  // v7.3: stores are walk-in. Near any store door (7 m around the supply store, 4.5 m elsewhere) you get the 🛒 Shop button
  const isStore = d => !!INTERIORS[d.kind]?.store;
  function stores() { return doors.filter(isStore); }
  function nearShop() {
    if (!C || inside) return null; let best = null, bd = 1e9;
    for (const d of stores()) { const dd = Math.hypot(d.x - player.x, d.z - player.z), r = d.kind === 'supply' ? 7 : 4.5; if (dd < r && dd < bd) { bd = dd; best = d; } }
    return best ? { kind: d2k(best), name: best.name, door: best.i, x: best.x, z: best.z } : null;
  }
  const d2k = d => d.kind;
  function nearestStore(x = player.x, z = player.z) { let best = null, bd = 1e9; for (const d of stores()) { const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } } return best ? { kind: best.kind, name: best.name, door: best.i, x: best.x, z: best.z, dist: bd } : null; }
  function gate() { if (!C) return null; return { x: cx, z: cz - 24 }; }

  // ----- v7.3 enterable buildings -----
  function nearDoor(range = 2.6) {
    if (!C || inside) return null; let best = null, bd = range;
    for (const d of doors) { const dd = Math.hypot(d.x - player.x, d.z - player.z); if (dd < bd) { bd = dd; best = d; } }
    return best;
  }
  const doorMatch = (d, q) => { q = String(q || '').toLowerCase().replace(/^the\s+/, ''); const n = (d.name + ' ' + d.title + ' ' + INTERIORS[d.kind].name + ' ' + d.kind).toLowerCase(); return n.includes(q) || (q.includes('gun') && d.kind === 'guns') || (q.includes('bar') && d.kind === 'cantina'); };
  function doorFor(q) { return doors.find(d => doorMatch(d, q)) || null; }
  function enterBuilding(door) {
    door = typeof door === 'number' ? doors[door] : (door || nearDoor()); if (!door || inside) return { ok: false, msg: '' };
    const game = ctx.game(), def = INTERIORS[door.kind];
    if (door.kind === 'club' && wanted > 0) return { ok: false, msg: 'Brick: Not tonight. You’ve got security crawling up your ass. Lose them first.' };
    if (door.kind === 'mansion') { const live = cams.filter(c => !(c.cased > time) && Math.hypot(c.x - door.x, c.z - door.z) < 30); if (live.length && !ctx.game().flag('guest:' + door.name)) alarm(2, door, `broke into ${door.name}`); } // case the cameras first or it's loud
    if (wanted >= 3 && door.kind !== 'security') return { ok: false, msg: `${door.name}: shutters down. Nobody opens a door for a ${wanted}★ fugitive.` };
    let paid = 0;
    if (def.cover && !coverPaid) {
      if (!game.spend(def.cover)) return { ok: false, msg: `Brick: Cover’s ${def.cover}. You’ve got lint. Beat it.` };
      coverPaid = true; paid = def.cover;
    }
    let room = rooms.get(door.i);
    if (!room) {
      if (!interiorsRoot) { interiorsRoot = new THREE.Group(); interiorsRoot.userData.keep = true; scene.add(interiorsRoot); }
      const ins = door.ins || C.inside?.[door.kind] || {};
      room = buildRoom(door.kind, { title: door.title, ...ins, safeId: door.kind === 'mansion' ? 'safe:' + door.name : undefined, taken: id => game.flag('stash:' + id), vip: game.flag('vip'), vipNow: () => game.flag('vip'), cracked: id => game.flag('cracked:' + id), heist: () => !!game.heistAt?.(door.kind, door.name), shop: { item: id => game.shopItem(id), list: v => game.shopList(v).items } });
      const ay = height(cx, cz) + 60 + (roomIdx++) * 12;
      room.group.position.set(cx, ay, cz); room.ay = ay; room.group.visible = false; interiorsRoot.add(room.group); rooms.set(door.i, room);
    }
    room.group.visible = true;
    inside = { door, room, ax: cx, ay: room.ay, az: cz };
    if (lights[0]) { const L = room.def.light; lights[0].position.set(cx, room.ay + room.h - 0.5, cz); lights[0].color.setHex(L.color); lights[0].distance = 60; lights[0].decay = 1.2; lights[0].intensity = L.int; }
    onEvent('door', {});
    return { ok: true, paid, kind: door.kind, name: door.name, spawn: { x: cx, y: room.ay, z: cz + room.d / 2 - 1.3, yaw: 0 } };
  }
  function exitBuilding() {
    if (!inside) return null; const { door, room } = inside; room.group.visible = false; inside = null;
    if (lights[0]) { const h = hubAt(door.x, door.z)?.site || { x: cx, z: cz, tint: C.tint }; lights[0].position.set(h.x, height(h.x, h.z) + 9, h.z); lights[0].color.setHex(h.tint || C.tint); lights[0].distance = 70; lights[0].decay = 1.6; }
    onEvent('door', {});
    return { x: door.x, z: door.z + 0.6, yaw: Math.PI };
  }
  function collidePlayer(x, z, r) {
    if (!inside) return collide(x, z, r);
    const c = inside.room.collide(x - inside.ax, z - inside.az, r); return c ? { x: c.x + inside.ax, z: c.z + inside.az } : null;
  }
  function camBlockedIn(x, y, z) { return !!inside && inside.room.camBlocked(x - inside.ax, y - inside.ay, z - inside.az); } // v7.4 indoor camera vs partitions/shelving
  function nearSpot() { if (!inside) return null; return inside.room.nearSpot(player.x - inside.ax, player.z - inside.az); }
  function openVip() { for (const r of rooms.values()) r.openRope(); }
  function clubFx(kind, n) { const r = inside?.room; return r ? (kind === 'rain' ? r.rain(n) : r.privateDance(n)) : 0; } // v7.4
  function wareTargets() { return inside ? inside.room.targets : []; }
  function refreshWares() { inside?.room.refresh(); }
  function wareList() { return inside ? inside.room.wares.map(w => ({ id: w.id, x: w.spot.x + inside.ax, z: w.spot.z + inside.az })) : []; }

  return {
    // live fix hook (roofs.js): vehicleGround(car) is the ground function updateRover uses (terrain or a roof the car is on);
    // addSolid/removeSolid let modules (myrides.js parked rides) add footprints that collide and can be landed on
    vehicleGround: car => roofGround(car), addSolid: s => { if (C && s && !solids.includes(s)) solids.push(s); return s; }, removeSolid: s => { const i = solids.indexOf(s); if (i >= 0) solids.splice(i, 1); },
    layout, enter, exit, update, collide, collidePlayer, nearDoor, doorFor, enterBuilding, exitBuilding, nearSpot, camBlockedIn, openVip, clubFx, nearDuelist: () => duelPub(nearDuelist()), challenge, yieldDuel: () => endDuel('yield-lose'), get duel() { return duelState(); }, get lastDuel() { return lastDuel; }, debugDuelist: (champ) => { const p = people.find(q => q.kind === 'colonist' && !!q.fighter === !!champ && (champ || q.temper >= 0.65)); if (!p) return null; p.x = player.x + 2; p.z = player.z; p.flee = 0; p.stun = 0; p.pts = champ ? null : p.pts; p.wait = 99; return p.name; }, wareTargets, refreshWares, wareList, stores: () => stores().map(d => ({ kind: d.kind, name: d.name, door: d.i, x: d.x, z: d.z })), nearestStore,
    get inside() { return inside ? { kind: inside.door.kind, name: inside.door.name, store: INTERIORS[inside.door.kind].store || null, ax: inside.ax, az: inside.az, floor: inside.ay, x0: inside.ax - inside.room.w / 2, x1: inside.ax + inside.room.w / 2, z0: inside.az - inside.room.d / 2, z1: inside.az + inside.room.d / 2, y1: inside.ay + inside.room.h } : null; },
    doorList: () => doors.map(d => ({ kind: d.kind, name: d.name, x: d.x, z: d.z })), solidAt, camBlocked, nearVehicle, nearestVehicle, take, leave, hitWorld, blast, shotFired, targets, meleeTarget, meleeWorld, nearContact, nearShop, gate, setWanted, crime,
    colonyAt: p => C ? toW(p) : null,
    get wanted() { return wanted; }, get evading() { return wanted > 0 && evade > 0.5; }, get inDuel() { return !!duel; },
    securityList: () => security.map(s => ({ kind: s.kind, x: s.x, y: s.y, z: s.z, hp: s.hp })), // v7.4: stable read-only view for add-on modules (street danger)
    get colony() { return C ? { name: C.name, x: cx, z: cz, dist: distC(), districts: sites.filter(s => s.id !== 'aj').map(s => ({ id: s.id, name: s.name, kind: s.kind, x: s.x, z: s.z, r: s.r })) } : null; },
    // v7.5 city API (see API.md): districts, fast travel, add-on lots, mansion cameras, alarms, cover, material slots, highway
    districts: () => sites.map(s => ({ id: s.id, name: s.name, kind: s.kind, x: s.x, z: s.z, r: s.r, fast: s.fast })), districtAt, get zone() { return actZone; },
    lots: (id) => sites.flatMap(s => s.lots || []).filter(l => !id || l.district === id || l.id === id).map(l => ({ ...l })),
    cameras: () => cams.map(c => ({ id: c.id, x: c.x, z: c.z, site: c.site, cased: c.cased > time })), caseCamera, nearCamera: () => { const c = nearCamera(); return c ? { id: c.id, x: c.x, z: c.z, cased: c.cased > time } : null; }, alarm,
    npcRefresh: () => updateZones(true), groundAt: (x, z) => height(x, z), despawnVehicle: v => { if (v && vehicles.includes(v)) { despawnCar(v); return true; } return false; },
    lineOfSight(x1, z1, x2, z2, y = 1.6) { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.ceil(L / 0.8)); for (let i = 1; i < n; i++) { const t = i / n; if (camBlocked(x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t)) return false; } return true; }, // v7.5.1: walls/domes block camera cones
    coverNear, hostileAt: (x, z) => witnessed(x, z), freeSpot,
    // v7.5.4 API: add-on solids (street dressing). nocam defaults to true. Cleared on world exit; returns a remover.
    addSolid(o) { if (!C || !o || !isFinite(o.x) || !isFinite(o.z)) return null; const sd = { x: o.x, z: o.z, r: o.r || 0.5, h: o.h || 1.2, box: o.box, zone: o.zone || 'dress', nocam: o.nocam !== false }; const list = solids; list.push(sd); return () => { const i = list.indexOf(sd); if (i >= 0) list.splice(i, 1); }; },
    spawnPoints, roadAhead, npcBudget, npcReserve(key, n) { if (!n) delete npcReserved[key]; else npcReserved[key] = Math.max(0, n | 0); updateZones(true); return npcBudget(); },
    setMaterialSlot(role, m) { res(); const key = MATERIAL_ROLES[role]; if (!key || !m) return false; const old = R[key]; R[key] = m; for (const g of [...sites.map(s => s.group), road]) g?.traverse(o => { if (o.material === old) o.material = m; }); return true; },
    highway: () => HW ? { name: HW.def.name, len: HW.len, closed: HW.closed, checkpoints: cps.map(c => ({ id: c.id, name: c.name, faction: c.faction, x: c.x, z: c.z })), ramps: HW.ramps.map(r => ({ x: r.x, z: r.z, len: r.len, h: r.h })), at: s2 => roadAt(s2), project: (x, z) => projectRoad(x, z) } : null,
    get civHits() { return civHits; }, get backup() { return backupT > 0; },
    allowFire: () => !!C && (distC() < 300 || wanted > 0),
    onRespawn() { setWanted(0); bustT = 0; for (const s of [...security]) recall(s); for (const s of shots) scene.remove(s.m); shots = []; },
    mapData() {
      if (!C) return null;
      return { colony: { x: cx, z: cz, r: 55, name: C.name }, shop: toW(C.shop),
        vehicles: vehicles.filter(v => v.parked).map(v => ({ x: v.x, z: v.z, kind: v.kind })),
        districts: sites.filter(s => s.id !== 'aj').map(s => ({ id: s.id, name: s.name, x: s.x, z: s.z, r: s.r })), road: HW ? HW.nodes.map(n => ({ x: n.x, z: n.z })) : null,
        people: people.filter(p => p.on !== false).map(p => ({ x: p.x, z: p.z, kind: p.kind, name: p.name || null })),
        security: security.map(s => ({ x: s.x, z: s.z, kind: s.kind })), wanted, doors: doors.map(d => ({ x: d.x, z: d.z, kind: d.kind, name: d.name, store: isStore(d) })), shops: stores().map(d => ({ x: d.x, z: d.z, kind: d.kind, name: d.name })) };
    },
    debug: { activeNPCs: () => activeN, livePeople: () => people.filter(p => p.on).length, traffic: () => traffic.map(v => ({ kind: v.kind, x: v.x, z: v.z, cop: v.traffic.cop, v: v.traffic.v })), corpses: () => corpses.length, spawnSecurity: (k, at) => !!spawnSecurity(k, at), killSec: (k) => { const s = security.find(q => q.kind === k); if (s) secKill(s, { dmg: 50 }); return !!s; }, zones: () => updateZones(true), cps: () => cps.map(c => ({ id: c.id, x: c.x, z: c.z, cool: c.cool })),
      vehicles: () => vehicles.map(v => ({ kind: v.kind, x: v.x, z: v.z, parked: v.parked })), security: () => security.map(s => ({ kind: s.kind, x: s.x, z: s.z, hp: s.hp, crouch: !!s.crouch, cover: !!s.cover })), people: () => people.map(p => ({ kind: p.kind, x: p.x, z: p.z, name: p.name, zone: p.zone, on: p.on !== false })), evade: () => evade, bustT: () => bustT }
  };
}
