// Halvorsen Villa: pure layout + collision maths (no THREE, no DOM) so tests/test-villa-unit.mjs runs it in node.
// Local metres, origin = villa centre, +x east, +z south (the street side). World = colony centre + VILLA_AT + local.
// One floor, FLOOR_H tall. Walls are axis-aligned boxes; doors are boxes that come and go as they open and close.
//
//   z=-6  +------------------------------+------------------+
//         |  office                      |  vault (safe)    |   power box outside the back wall
//   z= 0  +-----+ office door +----------+ vault door +-----+
//         | bed |                hall                       |
//         | room  (doorway gap)                             |
//   z=+6  +-----+------------+ front door +-----------------+
//        x=-9  x=-4                x=0                    x=+9
export const FLOOR_H = 3.5, WALL_T = 0.3, CAP = 0.3; // one floor; roof slab CAP on top
export const HALF = { x: 9, z: 6 };                    // footprint half-extents
export const DOOR_W = 1.6;

// wall runs [x0, z0, x1, z1] (one coordinate equal), gaps already cut out
export const WALLS = [
  // outside
  [-9, 6, -0.8, 6], [0.8, 6, 9, 6], [-9, -6, 9, -6], [-9, -6, -9, 6], [9, -6, 9, 6],
  // hall / back rooms (office door at x=-2.5, vault door at x=5.5)
  [-9, 0, -3.3, 0], [-1.7, 0, 4.7, 0], [6.3, 0, 9, 0],
  // office | vault
  [2, -6, 2, 0],
  // bedroom | hall, doorway gap at z=3 (no door)
  [-4, 0, -4, 2.2], [-4, 3.8, -4, 6],
];
// doors sit in the gaps. kind: front (locked until you break in), inner (opens as you walk up), vault (opens once you're in)
export const DOORS = [
  { id: 'front', x: 0, z: 6, axis: 'x', kind: 'front' },
  { id: 'office', x: -2.5, z: 0, axis: 'x', kind: 'inner' },
  { id: 'vault', x: 5.5, z: 0, axis: 'x', kind: 'vault' },
];
export const ROOMS = [
  { id: 'hall', name: 'hall', x0: -4, z0: 0, x1: 9, z1: 6 },
  { id: 'bedroom', name: 'bedroom', x0: -9, z0: 0, x1: -4, z1: 6 },
  { id: 'office', name: 'office', x0: -9, z0: -6, x1: 2, z1: 0 },
  { id: 'vault', name: 'vault', x0: 2, z0: -6, x1: 9, z1: 0 },
];
export const SPOTS = { door: [0, 7.2], safe: [6.5, -4.2], power: [-6, -7.6] }; // heist rings (door ring is outside the front door)
// guards walk [x, z, dwell s] loops; `inside` ones stay in the hall
export const GUARDS = [
  { id: 'hv-guard-hall', name: 'hall guard', inside: true, path: [[-2.5, 3, 3], [7.5, 3, 3], [7.5, 1.3, 2], [-2.5, 1.3, 2]] },
  { id: 'hv-guard-yard', name: 'yard guard', inside: false, path: [[-11.5, 9.5, 4], [11.5, 9.5, 4], [11.5, -8.5, 3], [-11.5, -8.5, 3]] },
];
export const GUARD = { range: 7, fov: 100, spotS: 0.9, walk: 1.3 }; // fov: full cone, degrees
// facing (x, z) -> camera yaw (heistcore.facing(yaw) = (-sin yaw, -cos yaw))
export const yawTo = (fx, fz) => Math.atan2(-fx, -fz);
export const CAMERAS = [
  { id: 'hv-cam0', x: 8.7, z: 6.5, yaw: yawTo(-8.7, 3.5), range: 10, sweep: 30, label: 'the porch camera' },
  { id: 'hv-cam1', x: 8.5, z: 0.5, yaw: yawTo(-10.5, 4), range: 9, sweep: 25, phase: 1.3, label: 'the hall camera' },
  { id: 'hv-cam2', x: 2.5, z: -5.5, yaw: yawTo(4, 4), range: 7, sweep: 20, phase: 2.1, label: 'the vault camera' },
];

// ---------- boxes ----------
// box = { id, type:'box', x, z, hx, hz, box:[hx,hz], h, y0, top } (SSX.colliders shape + the world.js / roofs.js solid fields)
export function wallBox(id, [x0, z0, x1, z1], o = [0, 0], y0 = 0, h = FLOOR_H + CAP) {
  const hx = Math.abs(x1 - x0) / 2 + (x0 === x1 ? WALL_T / 2 : WALL_T / 2), hz = Math.abs(z1 - z0) / 2 + (z0 === z1 ? WALL_T / 2 : WALL_T / 2);
  return { id, type: 'box', x: o[0] + (x0 + x1) / 2, z: o[1] + (z0 + z1) / 2, hx, hz, box: [hx, hz], h, y0, top: y0 + h, tag: 'villa' };
}
export function doorBox(d, o = [0, 0], y0 = 0) {
  const hw = DOOR_W / 2 + 0.05, ht = WALL_T / 2;
  const hx = d.axis === 'x' ? hw : ht, hz = d.axis === 'x' ? ht : hw;
  return { id: 'hv-door-' + d.id, type: 'box', x: o[0] + d.x, z: o[1] + d.z, hx, hz, box: [hx, hz], h: FLOOR_H - 0.4, y0, top: y0 + FLOOR_H - 0.4, tag: 'villa-door', door: d.id };
}
export const wallBoxes = (o, y0) => WALLS.map((w, i) => wallBox('hv-wall' + i, w, o, y0));
// one box for the whole roof: a vehicle above it lands on it (roofs.js); nothing on foot can reach it
export const roofTop = y0 => y0 + FLOOR_H + CAP;

// push a circle out of an axis-aligned box (same contract as mars/colliders.js push / world.collide): [x, z] or null
export function pushBox(s, x, z, r) {
  const lx = x - s.x, lz = z - s.z, qx = Math.max(-s.hx, Math.min(s.hx, lx)), qz = Math.max(-s.hz, Math.min(s.hz, lz)), dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-10) { const d = Math.sqrt(d2); return [s.x + qx + dx / d * r, s.z + qz + dz / d * r]; }
  const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz);
  return px < pz ? [s.x + Math.sign(lx || 1) * (s.hx + r), z] : [x, s.z + Math.sign(lz || 1) * (s.hz + r)];
}
// resolve a mover against a list of boxes; { x, z } when pushed, else null. yb: vehicle bottom (height-aware like roofs.js)
export function resolve(boxes, x, z, r = 0.45, yb) {
  let hit = false;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (const s of boxes) { if (Number.isFinite(yb) && yb > s.top - 0.6) continue; const p = pushBox(s, x, z, r); if (p) { x = p[0]; z = p[1]; hit = moved = true; } }
    if (!moved) break;
  }
  return hit ? { x, z } : null;
}
// does the segment a->b cross a box? (slab test; used for guard and camera line of sight)
export function segHits(s, ax, az, bx, bz) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, s.x - s.hx, s.x + s.hx], [az, dz, s.z - s.hz, s.z + s.hz]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let u = (lo - p) / d, v = (hi - p) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}
export const lineClear = (boxes, ax, az, bx, bz) => !boxes.some(s => segHits(s, ax, az, bx, bz));

// ---------- rooms / doors ----------
export const insideHouse = (lx, lz, pad = 0) => Math.abs(lx) < HALF.x - pad && Math.abs(lz) < HALF.z - pad;
export function roomAt(lx, lz) { if (!insideHouse(lx, lz)) return null; const r = ROOMS.find(q => lx >= q.x0 && lx <= q.x1 && lz >= q.z0 && lz <= q.z1); return r ? r.id : null; }
// should this door be open? stage = heist stage or null; d = player distance to the door (m)
export function doorOpen(door, stage, d) {
  const inside = stage && ['crack', 'escape', 'clean'].includes(stage);
  if (door.kind === 'front') return !!inside; // locked until the break-in finishes, then left ajar for the getaway
  if (door.kind === 'vault') return !!inside && (d < 3 || stage !== 'crack');
  return d < 2.6; // inner doors swing open as you walk up
}

// ---------- guards ----------
export function guardPos(g, t) {
  const P = g.path, L = []; let total = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]) / GUARD.walk; L.push([a[2] || 0, len]); total += (a[2] || 0) + len; }
  let u = ((t % total) + total) % total;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], [dw, len] = L[i];
    const fx = b[0] - a[0], fz = b[1] - a[1], f = Math.hypot(fx, fz) || 1;
    if (u < dw) return { x: a[0], z: a[1], fx: fx / f, fz: fz / f, moving: false };
    u -= dw; if (u < len) { const k = u / len; return { x: a[0] + fx * k, z: a[1] + fz * k, fx: fx / f, fz: fz / f, moving: true }; }
    u -= len;
  }
  return { x: P[0][0], z: P[0][1], fx: 1, fz: 0, moving: false };
}
// does a guard at g (local, facing fx,fz) see the player at (px,pz)? walls block sight
export function guardSees(g, px, pz, boxes, o = [0, 0]) {
  const dx = px - g.x, dz = pz - g.z, d = Math.hypot(dx, dz);
  if (d > GUARD.range) return false;
  if (d > 1.2 && (dx * g.fx + dz * g.fz) / d < Math.cos(GUARD.fov / 2 * Math.PI / 180)) return false;
  return lineClear(boxes, o[0] + g.x, o[1] + g.z, o[0] + px, o[1] + pz);
}

// ---------- heist def ----------
export function villaDef([x, z]) {
  const P = ([a, b]) => ({ x: x + a, z: z + b });
  return {
    id: 'heist-halvorsen-villa', title: 'Halvorsen Villa', world: 'Mars', rel: 'colony', sample: false, payout: true, layout: 'halvorsen',
    site: { x, z, r: 12 }, door: P(SPOTS.door), safe: { ...P(SPOTS.safe), tier: 'medium', time: 45 }, power: { ...P(SPOTS.power), s: 45 },
    cameras: CAMERAS.map(c => ({ ...c, x: x + c.x, z: z + c.z })),
    guards: GUARDS.map(g => ({ id: g.id, ...P(g.path[0]) })), ownGuards: true, // villa.js walks these two; guards.js must not add armed copies
    alarm: { wanted: 2, responseS: 18 }, loot: { credits: 400, item: 'contraband' },
  };
}
