// v7 "GTA in space" layer: frontier colonies (domes, pads, neon, crates, lights), colonists, guards, shady
// contacts, a supply shop, parked vehicles you can commandeer, and a 1-5 star wanted level enforced by
// security drones and patrol buggies. Everything here is game fiction. Cheap by design: shared geometry,
// no real-time lights except one per colony, small unit caps on phones.
import * as THREE from 'three';
import { buildRoom, INTERIORS, textTex } from './interiors.js?v=7.3';

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
export function buildVehicle(kind, sec = false) {
  res();
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
function buildPerson(kind, i = 0) {
  res();
  const g = new THREE.Group(), suit = kind === 'guard' ? R.guard : kind === 'contact' ? R.contact : R.suit[i % R.suit.length];
  const torso = mesh(R.torso, suit, 0, 1.25, 0); g.add(torso);
  g.add(mesh(R.head, suit, 0, 1.92, 0), mesh(R.visorG, kind === 'guard' ? R.gvisor : kind === 'contact' ? R.cvisor : R.visor, 0, 1.94, -0.12));
  g.add(mesh(R.box, R.frame, 0, 1.35, 0.33, 0.45, 0.55, 0.22)); // backpack
  const legs = [];
  for (const s of [-1, 1]) { const l = new THREE.Mesh(R.leg, suit); l.position.set(s * 0.15, 0.78, 0); g.add(l); legs.push(l); }
  if (kind === 'guard') g.add(mesh(R.gun, R.dark, 0.32, 1.2, -0.35));
  return { group: g, legs };
}

// ctx: { scene, height(x,z), player, onEvent, isMobile, game(), st() -> { driving, car, ownRover } }
export function createWorld(ctx) {
  const { scene, player, onEvent, isMobile } = ctx;
  const height = (x, z) => ctx.height(x, z);
  let C = null, col = null, cx = 0, cz = 0, time = 0;
  let solids = [], vehicles = [], people = [], flick = [], lights = [], security = [], shots = [], signs = [];
  let wanted = 0, evade = 0, bustT = 0, respawnCd = 0, seen = 0, lastFireCheck = 0;
  let doors = [], rooms = new Map(), inside = null, coverPaid = false, interiorsRoot = null, roomIdx = 0;
  const caps = { drones: isMobile ? 2 : 3, buggies: isMobile ? 1 : 2 };
  const toW = (p) => ({ x: cx + p[0], z: cz + p[1] });

  // called before terrain chunks are built: where the colony sits and how much ground to flatten
  function layout(name, safePoint) {
    C = COLONIES[name] || null; if (!C) return [];
    const p = safePoint(C.a, C.d); cx = p.x; cz = p.z;
    return [{ x: cx, z: cz, r1: 62, r2: 92, y: height(cx, cz) }];
  }
  function add(o) { col.add(o); return o; }
  function enter() {
    if (!C) return; res(); time = 0; wanted = 0; evade = 0; bustT = 0;
    col = new THREE.Group(); scene.add(col);
    const y0 = height(cx, cz);
    // domes: glass shell, ribs, warm interior, base ring and an optional neon sign over the door
    for (const [x, z, r, sign, color] of C.domes) {
      const X = cx + x, Z = cz + z;
      add(mesh(R.dome, R.glass, X, y0, Z, r, r * 0.8, r));
      for (let k = 0; k < 4; k++) { const rib = mesh(R.ring, R.frame, X, y0, Z, r, r * 0.8, r); rib.rotation.y = k * Math.PI / 4; add(rib); }
      add(mesh(R.cyl, R.frame, X, y0 + 0.4, Z, r + 0.3, 0.8, r + 0.3));
      add(mesh(R.cyl, R.inner, X, y0 + 0.85, Z, r * 0.55, 0.1, r * 0.55));
      for (let k = 0; k < 3; k++) add(mesh(R.box, R.hull, X + Math.cos(k * 2.1) * r * 0.45, y0 + 1.6, Z + Math.sin(k * 2.1) * r * 0.45, 2.4, 2.4, 2.4));
      add(mesh(R.box, R.dark, X, y0 + 1.4, Z + r + 0.6, 3, 2.8, 2.2));
      if (sign) addSign(sign, color, X, y0 + 3.6, Z + r + 1.75, 0, 7);
      solids.push({ x: X, z: Z, r: r + 0.3, h: r * 0.8 });
    }
    for (const [x, z, w, d, h, sign, color, kind, title] of C.blocks) {
      const X = cx + x, Z = cz + z;
      add(mesh(R.box, R.hull, X, y0 + h / 2, Z, w, h, d)); add(mesh(R.box, R.frame, X, y0 + h + 0.15, Z, w + 0.4, 0.3, d + 0.4));
      if (sign) addSign(sign, color, X, y0 + h + 1.3, Z + d / 2 + 0.05, 0, Math.min(kind === 'club' ? 9 : 6, w));
      if (kind && INTERIORS[kind]) { // v7.3: a walk-in door on the front face
        const gy = height(X, Z + d / 2 + 1);
        add(mesh(R.box, R.dark, X, gy + 1.3, Z + d / 2 + 0.04, 1.7, 2.6, 0.12));
        const tm = B(color); for (const [dx, dy, sx, sy] of [[-0.88, 1.3, 0.1, 2.7], [0.88, 1.3, 0.1, 2.7], [0, 2.66, 1.86, 0.1]]) add(mesh(R.box, tm, X + dx, gy + dy, Z + d / 2 + 0.1, sx, sy, 0.08));
        if (kind === 'club') { const b = buildPerson('guard', 9); b.group.position.set(X + 1.8, gy, Z + d / 2 + 0.9); b.group.rotation.y = -0.3; b.group.scale.setScalar(1.25); add(b.group); } // Brick on the door
        doors.push({ i: doors.length, kind, name: sign ? sign.replace(/\b([A-Z])([A-Z\u2019']+)/g, (m, a, b) => a + b.toLowerCase()) : INTERIORS[kind].name, title: title || sign, color, x: X, z: Z + d / 2 + 0.9, block: [x, z] });
      }
      solids.push({ x: X, z: Z, r: Math.max(w, d) / 2 + 0.4, h, box: [w / 2 + 0.4, d / 2 + 0.4] });
    }
    // landing pad with blinking edge lights
    { const [x, z, r] = C.pad, X = cx + x, Z = cz + z; add(mesh(R.cyl, R.pad, X, y0 + 0.08, Z, r, 0.16, r)); add(mesh(R.ring, R.glowO, X, y0 + 0.2, Z, r * 0.7, r * 0.7, 1)).rotation.x = Math.PI / 2;
      for (let k = 0; k < 8; k++) { const l = add(mesh(R.sph, R.padLight, X + Math.cos(k * 0.785) * r, y0 + 0.25, Z + Math.sin(k * 0.785) * r, 0.18)); flick.push({ m: l, blink: k * 0.12 }); } }
    for (const [x, z] of C.crates) for (let k = 0; k < 3; k++) { const X = cx + x + (k % 2) * 1.3, Z = cz + z + (k > 1 ? 1.3 : 0); const c = add(mesh(R.box, k % 2 ? R.crate2 : R.crate, X, y0 + 0.6, Z, 1.2)); c.rotation.y = k * 0.3; }
    // perimeter lamps; a few flicker like they\u2019re wired by the lowest bidder
    for (let k = 0; k < C.lamps; k++) {
      const a = k / C.lamps * Math.PI * 2, X = cx + Math.cos(a) * 50, Z = cz + Math.sin(a) * 50;
      add(mesh(R.cyl, R.frame, X, y0 + 2.5, Z, 0.09, 5, 0.09)); const bulb = add(mesh(R.sph, R.lampOn, X, y0 + 5.1, Z, 0.28));
      if (k % 4 === 1) flick.push({ m: bulb, flicker: true });
    }
    const pl = new THREE.PointLight(C.tint, 60, 70, 1.6); pl.position.set(cx, y0 + 9, cz); add(pl); lights.push(pl);
    // shop kiosk marker
    { const p = toW(C.shop); const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('🛒 SHOP', '#7dffb0'), transparent: true, depthWrite: false }))); sp.position.set(p.x, y0 + 2.9, p.z); sp.scale.set(3.2, 0.8, 1); }
    // people
    const walkPts = [[-10, -22], [14, -22], [34, -4], [12, 20], [-16, 18], [-34, 0], [-30, -24]].map(toW);
    for (let i = 0; i < C.colonists; i++) spawnPerson('colonist', walkPts[(i * 2) % walkPts.length], i, walkPts);
    C.guards.forEach((g, i) => spawnPerson('guard', toW(g), i, walkPts));
    for (const c of C.contacts) { const p = spawnPerson('contact', toW(c.at), 0, null); p.name = c.name; p.blurb = c.blurb;
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('💬 ' + c.name.toUpperCase()), transparent: true, depthWrite: false })); lab.position.y = 2.7; lab.scale.set(2.6, 0.65, 1); p.group.add(lab); }
    // parked vehicles
    for (const [kind, x, z, yaw] of C.vehicles) {
      const v = buildVehicle(kind), X = cx + x, Z = cz + z, spec = VEHICLES[kind];
      const o = { ...v, kind, spec, x: X, z: Z, yaw, y: height(X, Z) + (spec.hover || 0), vy: 0, speed: 0, steer: 0, pitch: 0, roll: 0, air: false, prevG: null, susp: 0, stolen: true, parked: true, home: { x: X, z: Z, yaw } };
      v.group.position.set(X, o.y, Z); v.group.rotation.y = yaw; scene.add(v.group); vehicles.push(o);
    }
  }
  function addSign(text, color, x, y, z, yaw, w) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: neonTex(text, color), transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = yaw; add(m); signs.push(m);
    if (Math.random() < 0.5) flick.push({ m, sign: true });
  }
  function spawnPerson(kind, p, i, pts) {
    const b = buildPerson(kind, i); b.group.position.set(p.x, height(p.x, p.z), p.z); scene.add(b.group);
    const o = { ...b, kind, x: p.x, z: p.z, home: { x: p.x, z: p.z }, yaw: Math.random() * 6, pts, ti: i, phase: Math.random() * 6, hp: kind === 'guard' ? 6 : 3, stun: 0, cd: 1, flee: 0, wait: Math.random() * 3 };
    people.push(o); return o;
  }
  function exit() {
    for (const o of [...vehicles, ...people, ...security]) scene.remove(o.group);
    for (const s of shots) scene.remove(s.m);
    for (const s of signs) { s.material.map.dispose(); s.material.dispose(); s.geometry.dispose(); }
    if (col) { col.traverse(o => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); scene.remove(col); }
    for (const p of people) p.group.traverse(o => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
    if (inside) inside = null;
    for (const r of rooms.values()) { r.dispose(); }
    if (interiorsRoot) { scene.remove(interiorsRoot); interiorsRoot = null; }
    rooms = new Map(); doors = []; coverPaid = false; roomIdx = 0;
    col = null; solids = []; vehicles = []; people = []; flick = []; lights = []; security = []; shots = []; signs = []; C = null; wanted = 0;
  }

  // ----- collisions: circles for domes/vehicles, boxes for blocks -----
  function collide(x, z, r, skip) {
    let hit = false;
    for (const s of solids) {
      if (s.box) { const dx = x - s.x, dz = z - s.z, ex = s.box[0] + r, ez = s.box[1] + r;
        if (Math.abs(dx) < ex && Math.abs(dz) < ez) { hit = true; if (ex - Math.abs(dx) < ez - Math.abs(dz)) x = s.x + Math.sign(dx || 1) * ex; else z = s.z + Math.sign(dz || 1) * ez; } continue; }
      const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), m = s.r + r;
      if (d < m) { hit = true; const k = m / (d || 1); x = s.x + dx * k; z = s.z + dz * k; }
    }
    for (const v of vehicles) { if (v === skip || !v.parked) continue; const dx = x - v.x, dz = z - v.z, d = Math.hypot(dx, dz), m = v.spec.r * 0.8 + r; if (d < m) { hit = true; const k = m / (d || 1); x = v.x + dx * k; z = v.z + dz * k; } }
    return hit ? { x, z } : null;
  }
  function solidAt(x, y, z) {
    if (!C) return false;
    for (const s of solids) { if (y > height(s.x, s.z) + (s.h || 4)) continue; if (s.box ? Math.abs(x - s.x) < s.box[0] && Math.abs(z - s.z) < s.box[1] : Math.hypot(x - s.x, z - s.z) < s.r - 0.6 && Math.hypot(x - s.x, z - s.z) > s.r - 2.2) return true; }
    return false;
  }

  // v7.3: camera occlusion test (solid building boxes + full dome volumes), used to pull the chase camera in
  function camBlocked(x, y, z) {
    if (!C) return false;
    for (const s of solids) {
      const gy = height(s.x, s.z);
      if (s.box) { if (y < gy + (s.h || 4) + 0.4 && Math.abs(x - s.x) < s.box[0] - 0.1 && Math.abs(z - s.z) < s.box[1] - 0.1) return true; continue; }
      const r = s.r - 0.1; if (Math.hypot(x - s.x, (y - gy) * (r / Math.max(0.5, s.h || r)), z - s.z) < r) return true;
    }
    return false;
  }

  // ----- wanted level -----
  const distC = () => C ? Math.hypot(player.x - cx, player.z - cz) : 1e9;
  function setWanted(n, why) {
    n = Math.max(0, Math.min(5, Math.round(n)));
    if (n === wanted) return;
    const up = n > wanted; wanted = n; evade = 0;
    if (up) onEvent('wanted', { stars: n, why: why || '' });
    else if (n === 0) { onEvent('wantedLost', {}); for (const s of [...security]) recall(s); }
  }
  let crimeCd = 0;
  function crime(min, why) { if (!C || crimeCd > 0) return; crimeCd = 2.5; setWanted(wanted > 0 ? Math.min(5, Math.max(wanted + 1, min)) : min, why); }
  function witnessed(x, z) {
    if (!C) return false;
    if (Math.hypot(x - cx, z - cz) < 70) return true; // colony cameras
    return people.some(p => !p.stun && Math.hypot(p.x - x, p.z - z) < (p.kind === 'guard' ? 55 : 25)) || security.some(s => Math.hypot(s.x - x, s.z - z) < 60);
  }
  function spawnSecurity(kind) {
    const st = ctx.st(), far = distC() > 120, a = Math.random() * 6.28;
    const sx = far ? player.x + Math.cos(a) * 90 : cx + Math.cos(a) * 20, sz = far ? player.z + Math.sin(a) * 90 : cz + Math.sin(a) * 20;
    let o;
    if (kind === 'drone') {
      const g = new THREE.Group(); g.add(mesh(R.box, R.paints.sec, 0, 0, 0, 0.9, 0.35, 0.9), mesh(R.ring, R.frame, 0, 0, 0, 0.9, 0.9, 1)); g.children[1].rotation.x = Math.PI / 2;
      const l = mesh(R.sph, R.red, -0.3, -0.25, 0, 0.12), r = mesh(R.sph, R.blue, 0.3, -0.25, 0, 0.12); g.add(l, r); g.userData.bar = [l, r];
      o = { group: g, kind, x: sx, z: sz, y: height(sx, sz) + 8, hp: 3, cd: 2, phase: Math.random() * 6 };
    } else {
      const v = buildVehicle('buggy', true);
      o = { ...v, kind, x: sx, z: sz, y: height(sx, sz), yaw: 0, speed: 0, hp: 10, cd: 2.5, phase: 0, stuck: 0 };
    }
    o.group.position.set(o.x, o.y, o.z); scene.add(o.group); security.push(o); void st;
    return o;
  }
  function recall(s) { scene.remove(s.group); security.splice(security.indexOf(s), 1); }
  function secShoot(s, dmg) {
    const from = new THREE.Vector3(s.x, s.y + (s.kind === 'drone' ? 0 : 1.6), s.z), st = ctx.st(), ty = st.driving ? st.car.y + 1.2 : player.y - 0.4;
    const to = new THREE.Vector3(player.x + (Math.random() - 0.5) * 2.5, ty, player.z + (Math.random() - 0.5) * 2.5);
    const m = new THREE.Mesh(R.bolt, R.boltM); m.position.copy(from); m.lookAt(to); scene.add(m);
    shots.push({ m, v: to.sub(from).normalize().multiplyScalar(38), life: 2.2, dmg });
    onEvent('secShot', {});
  }
  function updateSecurity(dt) {
    const st = ctx.st(), game = ctx.game(), down = game.isDown();
    // how many units the current heat calls for
    if (wanted > 0 && !down) {
      respawnCd -= dt;
      const wantD = Math.min(caps.drones, wanted >= 1 ? Math.ceil(wanted / 2) + (wanted >= 4 ? 1 : 0) : 0), wantB = wanted >= 2 ? Math.min(caps.buggies, wanted - 1) : 0;
      if (respawnCd <= 0) {
        if (security.filter(s => s.kind === 'drone').length < wantD) { spawnSecurity('drone'); respawnCd = 3; }
        else if (security.filter(s => s.kind === 'buggy').length < wantB) { spawnSecurity('buggy'); respawnCd = 4; onEvent('siren', {}); }
      }
    }
    const tx = player.x, tz = player.z, pv = st.driving ? Math.abs(st.car.speed) : 0;
    let nearest = 1e9, close = false;
    for (const s of [...security]) {
      s.phase += dt; const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz) || 0.01;
      if (s.group.userData.bar) { const f = Math.sin(s.phase * 14) > 0; s.group.userData.bar[0].visible = f; s.group.userData.bar[1].visible = !f; }
      if (wanted === 0 || down) { // head home and vanish
        s.y += dt * 4; s.x -= dx / d * dt * 10; s.z -= dz / d * dt * 10; if (d > 140) { recall(s); continue; }
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
        if (d > 260) { recall(s); continue; } // left behind
      }
      s.group.position.set(s.x, s.y, s.z); if (s.kind === 'drone') s.group.rotation.y += dt;
      nearest = Math.min(nearest, d);
      if (d < (s.kind === 'drone' ? 7 : 7.5) && (!st.driving || pv < 2.5)) close = true;
    }
    // guards join in on foot
    for (const p of people) if (p.kind === 'guard' && !p.stun && wanted > 0 && !down) { const d = Math.hypot(tx - p.x, tz - p.z); nearest = Math.min(nearest, d); if (d < 4 && (!st.driving || pv < 2.5)) close = true; }
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
      if (!inside && Math.hypot(p.x - tx, p.z - tz) < (st.driving ? 2.4 : 1.0) && Math.abs(p.y - ty) < 1.6) { game.hurtPlayer(s.dmg, { x: p.x - s.v.x, z: p.z - s.v.z, security: true }); s.life = 0; }
      if (p.y < height(p.x, p.z) || s.life <= 0) { scene.remove(s.m); shots.splice(shots.indexOf(s), 1); }
    }
  }

  // ----- colonists wander, guards patrol, contacts loiter; everyone scatters from fast traffic -----
  function updatePeople(dt) {
    const st = ctx.st(), car = st.driving ? st.car : null, pv = car ? Math.abs(car.speed) : 0;
    for (const p of people) {
      p.phase += dt;
      if (p.stun > 0) { p.stun -= dt; p.group.rotation.x = -Math.PI / 2 * Math.min(1, p.stun * 2); p.group.position.y = height(p.x, p.z) + 0.3; if (p.stun <= 0) { p.group.rotation.x = 0; p.hp = p.kind === 'guard' ? 6 : 3; } continue; }
      let gx = p.x, gz = p.z, sp = 0;
      const dx = player.x - p.x, dz = player.z - p.z, d = Math.hypot(dx, dz) || 0.01;
      if (car && d < 9 && pv > 5) { p.flee = 1.2; p.fx = -dx / d; p.fz = -dz / d; if (d < 2.8 && pv > 9) { p.stun = 8; onEvent('thud', {}); if (witnessed(p.x, p.z)) crime(1, 'hit-and-run'); continue; } }
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
    updatePeople(dt); updateSecurity(dt); updateFx(dt);
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
    for (const s of [...security]) { tv.set(s.x, s.y + (s.kind === 'drone' ? 0 : 1), s.z); const c = tv.clone(); if (segHit(p0, p1, c, s.kind === 'drone' ? 1 : 2)) { s.hp -= b.dmg; if (s.hp <= 0) { recall(s); onEvent('secDown', { kind: s.kind }); crime(Math.min(5, wanted + 1), 'destroyed security'); } else crime(2, 'shot at security'); return true; } }
    for (const p of people) { if (p.stun > 0) continue; const c = new THREE.Vector3(p.x, height(p.x, p.z) + 1.2, p.z); if (segHit(p0, p1, c, 0.6)) { p.hp -= b.dmg; p.flee = 2; p.fx = Math.sign(p.x - p0.x) || 1; p.fz = Math.sign(p.z - p0.z) || 1; if (p.hp <= 0) { p.stun = 15; onEvent('thud', {}); } crime(p.kind === 'guard' ? 2 : 1, p.kind === 'guard' ? 'shot a guard' : 'shot a colonist'); return true; } }
    return false;
  }
  // auto-aim candidates: security always (they only show up once you're wanted), guards while wanted
  function targets() {
    if (!C) return [];
    const out = security.map(s => ({ x: s.x, y: s.y + (s.kind === 'drone' ? 0 : 1), z: s.z, kind: s.kind }));
    if (wanted > 0) for (const p of people) if (p.kind === 'guard' && !p.stun) out.push({ x: p.x, y: height(p.x, p.z) + 1.2, z: p.z, kind: 'guard' });
    return out;
  }
  // nearest hittable thing within reach (yaw = facing to require it in front, or null for any direction)
  function meleeTarget(x, z, yaw, range) {
    if (!C) return null;
    let best = null, bd = range;
    const consider = (o, kind) => { const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); if (d > bd) return; if (yaw !== null) { const a = Math.atan2(-dx, -dz) - yaw; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 1.4 && d > 1.5) return; } bd = d; best = { x: o.x, z: o.z, kind }; };
    for (const p of people) if (!p.stun && p.kind !== 'contact') consider(p, p.kind);
    for (const s of security) if (s.kind !== 'drone' || Math.abs(s.y - player.y) < 3) consider(s, s.kind);
    return best;
  }
  // a punch/kick/blade hit on colony folk or security. Returns true if something was hit.
  function meleeWorld(x, z, fx, fz, range, dmg, knock) {
    if (!C) return false;
    const inFront = o => { const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); return d < range + 0.4 && (dx * fx + dz * fz) > -0.3 ? d || 1 : 0; };
    for (const p of people) {
      if (p.stun > 0 || p.kind === 'contact') continue; const d = inFront(p); if (!d) continue;
      p.hp -= dmg; p.flee = 3; p.x += (p.x - x) / d * knock; p.z += (p.z - z) / d * knock; p.fx = Math.sign(p.x - x) || 1; p.fz = Math.sign(p.z - z) || 1;
      if (p.hp <= 0) { p.stun = 15; onEvent('thud', {}); }
      crime(p.kind === 'guard' ? 2 : 1, p.kind === 'guard' ? 'assaulted a guard' : p.kind === 'contact' ? 'assaulted a fixer' : 'assaulted a colonist');
      onEvent('meleeHit', { kind: p.kind }); return true;
    }
    for (const s of [...security]) {
      if (s.kind === 'drone' && Math.abs(s.y - player.y) > 3) continue; const d = inFront(s); if (!d) continue;
      s.hp -= dmg; if (s.kind !== 'buggy') { s.x += (s.x - x) / d * knock; s.z += (s.z - z) / d * knock; }
      if (s.hp <= 0) { recall(s); onEvent('secDown', { kind: s.kind }); crime(Math.min(5, wanted + 1), 'destroyed security'); } else crime(2, 'attacked security');
      onEvent('meleeHit', { kind: s.kind }); return true;
    }
    return false;
  }
  // v7.2 rover rockets / EMP: area damage on colony folk and security. emp = stun people and stall drones too.
  function blast(c, R, dmg, emp) {
    if (!C) return 0; let n = 0;
    for (const s of [...security]) { const d = Math.hypot(s.x - c.x, s.z - c.z); if (d > R) continue; n++; s.hp -= emp ? dmg * 2 : dmg * (1 - d / R);
      if (s.hp <= 0) { recall(s); onEvent('secDown', { kind: s.kind }); crime(Math.min(5, wanted + 1), 'destroyed security'); } else crime(2, 'attacked security'); }
    for (const p of people) { if (p.stun > 0 || p.kind === 'contact') continue; const d = Math.hypot(p.x - c.x, p.z - c.z); if (d > R) continue; n++;
      if (emp) { p.stun = 5; } else { p.hp -= dmg * (1 - d / R); p.flee = 3; p.fx = Math.sign(p.x - c.x) || 1; p.fz = Math.sign(p.z - c.z) || 1; if (p.hp <= 0) { p.stun = 15; onEvent('thud', {}); } }
      crime(p.kind === 'guard' ? 2 : 1, p.kind === 'guard' ? 'attacked a guard' : 'attacked a colonist'); }
    return n;
  }
  function shotFired() { if (C && distC() < 80 && !ctx.game().combat) crime(1, 'discharging a weapon in the colony'); }
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
    if (wanted >= 3 && door.kind !== 'security') return { ok: false, msg: `${door.name}: shutters down. Nobody opens a door for a ${wanted}★ fugitive.` };
    let paid = 0;
    if (def.cover && !coverPaid) {
      if (!game.spend(def.cover)) return { ok: false, msg: `Brick: Cover’s ${def.cover}. You’ve got lint. Beat it.` };
      coverPaid = true; paid = def.cover;
    }
    let room = rooms.get(door.i);
    if (!room) {
      if (!interiorsRoot) { interiorsRoot = new THREE.Group(); interiorsRoot.userData.keep = true; scene.add(interiorsRoot); }
      const ins = C.inside?.[door.kind] || {};
      room = buildRoom(door.kind, { title: door.title, ...ins, taken: id => game.flag('stash:' + id), vip: game.flag('vip'), shop: { item: id => game.shopItem(id), list: v => game.shopList(v).items } });
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
    if (lights[0]) { const y0 = height(cx, cz); lights[0].position.set(cx, y0 + 9, cz); lights[0].color.setHex(C.tint); lights[0].distance = 70; lights[0].decay = 1.6; }
    onEvent('door', {});
    return { x: door.x, z: door.z + 0.6, yaw: Math.PI };
  }
  function collidePlayer(x, z, r) {
    if (!inside) return collide(x, z, r);
    const c = inside.room.collide(x - inside.ax, z - inside.az, r); return c ? { x: c.x + inside.ax, z: c.z + inside.az } : null;
  }
  function nearSpot() { if (!inside) return null; return inside.room.nearSpot(player.x - inside.ax, player.z - inside.az); }
  function openVip() { for (const r of rooms.values()) r.openRope(); }
  function wareTargets() { return inside ? inside.room.targets : []; }
  function refreshWares() { inside?.room.refresh(); }
  function wareList() { return inside ? inside.room.wares.map(w => ({ id: w.id, x: w.spot.x + inside.ax, z: w.spot.z + inside.az })) : []; }

  return {
    layout, enter, exit, update, collide, collidePlayer, nearDoor, doorFor, enterBuilding, exitBuilding, nearSpot, openVip, wareTargets, refreshWares, wareList, stores: () => stores().map(d => ({ kind: d.kind, name: d.name, door: d.i, x: d.x, z: d.z })), nearestStore,
    get inside() { return inside ? { kind: inside.door.kind, name: inside.door.name, store: INTERIORS[inside.door.kind].store || null, ax: inside.ax, az: inside.az, floor: inside.ay, x0: inside.ax - inside.room.w / 2, x1: inside.ax + inside.room.w / 2, z0: inside.az - inside.room.d / 2, z1: inside.az + inside.room.d / 2, y1: inside.ay + inside.room.h } : null; },
    doorList: () => doors.map(d => ({ kind: d.kind, name: d.name, x: d.x, z: d.z })), solidAt, camBlocked, nearVehicle, nearestVehicle, take, leave, hitWorld, blast, shotFired, targets, meleeTarget, meleeWorld, nearContact, nearShop, gate, setWanted, crime,
    colonyAt: p => C ? toW(p) : null,
    get wanted() { return wanted; }, get evading() { return wanted > 0 && evade > 0.5; },
    get colony() { return C ? { name: C.name, x: cx, z: cz, dist: distC() } : null; },
    allowFire: () => !!C && (distC() < 300 || wanted > 0),
    onRespawn() { setWanted(0); bustT = 0; for (const s of [...security]) recall(s); for (const s of shots) scene.remove(s.m); shots = []; },
    mapData() {
      if (!C) return null;
      return { colony: { x: cx, z: cz, r: 55, name: C.name }, shop: toW(C.shop),
        vehicles: vehicles.filter(v => v.parked).map(v => ({ x: v.x, z: v.z, kind: v.kind })),
        people: people.map(p => ({ x: p.x, z: p.z, kind: p.kind, name: p.name || null })),
        security: security.map(s => ({ x: s.x, z: s.z, kind: s.kind })), wanted, doors: doors.map(d => ({ x: d.x, z: d.z, kind: d.kind, name: d.name, store: isStore(d) })), shops: stores().map(d => ({ x: d.x, z: d.z, kind: d.kind, name: d.name })) };
    },
    debug: { vehicles: () => vehicles.map(v => ({ kind: v.kind, x: v.x, z: v.z, parked: v.parked })), security: () => security.map(s => ({ kind: s.kind, x: s.x, z: s.z, hp: s.hp })), people: () => people.map(p => ({ kind: p.kind, x: p.x, z: p.z, name: p.name })), evade: () => evade, bustT: () => bustT }
  };
}
