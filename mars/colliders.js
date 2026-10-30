// v7.5 outdoor collider API (Snuffles): window.SSX.colliders. Props that aren't core buildings (street props, grime
// shanties, burn barrels, fences) register simple shapes here, and the player, vehicles and walking NPCs respect them
// through ONE guarded line in world.collide() (core): `globalThis.SSX?.colliders?.resolve?.(x, z, r)`.
// Shapes (world metres, ground plane):
//   { type: 'box', x, z, hx, hz, yaw? }   AABB half-extents; optional yaw (radians, same sense as three.js rotation.y) for a rotated box
//   { type: 'cyl', x, z, r }              vertical cylinder
// Extra fields: id (auto when missing), group (bulk remove), tag (anything). Resolution pushes the mover out along the
// contact normal / shortest axis, so movement slides along walls. A uniform grid (8 m cells) keeps it cheap on phones:
// resolve() only tests shapes in the 1-4 cells the mover overlaps.
const CELL = 8;
const grid = new Map(), byId = new Map();
let seq = 0, stamp = 0;
const stats = { resolves: 0, hits: 0, tests: 0 };
const key = (i, j) => i * 100003 + j;
function bounds(s) {
  if (s.type === 'cyl') return [s.x - s.r, s.z - s.r, s.x + s.r, s.z + s.r];
  if (s.yaw) { const c = Math.abs(Math.cos(s.yaw)), n = Math.abs(Math.sin(s.yaw)), ex = s.hx * c + s.hz * n, ez = s.hx * n + s.hz * c; return [s.x - ex, s.z - ez, s.x + ex, s.z + ez]; }
  return [s.x - s.hx, s.z - s.hz, s.x + s.hx, s.z + s.hz];
}
function cells(b, fn) { const i0 = Math.floor(b[0] / CELL), i1 = Math.floor(b[2] / CELL), j0 = Math.floor(b[1] / CELL), j1 = Math.floor(b[3] / CELL); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) fn(key(i, j)); }
function norm(shape) {
  const s = { ...shape }; s.type = s.type === 'cylinder' || s.type === 'circle' ? 'cyl' : s.type === 'aabb' ? 'box' : s.type;
  if (!(s.type === 'box' || s.type === 'cyl')) throw new Error('colliders.add: type must be "box" or "cyl"');
  for (const k of s.type === 'cyl' ? ['x', 'z', 'r'] : ['x', 'z', 'hx', 'hz']) if (!Number.isFinite(s[k])) throw new Error('colliders.add: bad ' + k);
  if (s.yaw) { s.c = Math.cos(s.yaw); s.n = Math.sin(s.yaw); }
  s.id = s.id != null ? String(s.id) : 'col' + (++seq); s._s = 0; return s;
}
export function add(shape) {
  const s = norm(shape); if (byId.has(s.id)) remove(s.id);
  byId.set(s.id, s); s._b = bounds(s); cells(s._b, k => { let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(s); }); return s.id;
}
export function remove(id) {
  const s = byId.get(String(id)); if (!s) return false; byId.delete(s.id);
  cells(s._b, k => { const a = grid.get(k); if (!a) return; const i = a.indexOf(s); if (i >= 0) a.splice(i, 1); if (!a.length) grid.delete(k); }); return true;
}
export function removeGroup(group) { let n = 0; for (const s of [...byId.values()]) if (s.group === group) { remove(s.id); n++; } return n; }
// push a circle (x, z, r) out of one shape; returns [x, z] or null
function push(s, x, z, r) {
  if (s.type === 'cyl') { const dx = x - s.x, dz = z - s.z, m = s.r + r, d2 = dx * dx + dz * dz; if (d2 >= m * m) return null; if (d2 < 1e-10) return [s.x, s.z + m]; const d = Math.sqrt(d2); return [s.x + dx / d * m, s.z + dz / d * m]; }
  let lx = x - s.x, lz = z - s.z; if (s.yaw) { const a = lx * s.c - lz * s.n, b = lx * s.n + lz * s.c; lx = a; lz = b; }
  const qx = Math.max(-s.hx, Math.min(s.hx, lx)), qz = Math.max(-s.hz, Math.min(s.hz, lz)), dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  let ox, oz;
  if (d2 > 1e-10) { const d = Math.sqrt(d2); ox = qx + dx / d * r; oz = qz + dz / d * r; } // outside the box but inside the radius: along the contact normal
  else { const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz); if (px < pz) { ox = Math.sign(lx || 1) * (s.hx + r); oz = lz; } else { ox = lx; oz = Math.sign(lz || 1) * (s.hz + r); } } // centre inside: shortest axis
  if (s.yaw) { const a = ox * s.c + oz * s.n, b = -ox * s.n + oz * s.c; ox = a; oz = b; }
  return [s.x + ox, s.z + oz];
}
// resolve a mover; returns { x, z } when it was pushed, else null (same contract as world.collide)
export function resolve(x, z, r = 0.45) {
  if (!byId.size || !Number.isFinite(x) || !Number.isFinite(z)) return null; stats.resolves++;
  let hit = false;
  for (let it = 0; it < 2; it++) {
    stamp++; let moved = false;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = grid.get(key(i, j)); if (!a) continue;
      for (const s of a) { if (s._s === stamp) continue; s._s = stamp; stats.tests++; const p = push(s, x, z, r); if (p) { x = p[0]; z = p[1]; hit = moved = true; } } }
    if (!moved) break;
  }
  if (hit) { stats.hits++; return { x, z }; } return null;
}
const pub = s => s.type === 'cyl' ? { id: s.id, type: 'cyl', x: s.x, z: s.z, r: s.r, group: s.group } : { id: s.id, type: 'box', x: s.x, z: s.z, hx: s.hx, hz: s.hz, yaw: s.yaw || 0, group: s.group };
export function query(x, z, r = 1) { const out = []; stamp++; cells([x - r, z - r, x + r, z + r], k => { for (const s of grid.get(k) || []) if (s._s !== stamp) { s._s = stamp; const b = s._b; if (x + r > b[0] && x - r < b[2] && z + r > b[1] && z - r < b[3]) out.push(pub(s)); } }); return out; }
export const API = {
  add, remove, removeGroup, resolve, query,
  blocked: (x, z, r = 0.45) => !!resolve(x, z, r),
  list: group => [...byId.values()].filter(s => group == null || s.group === group).map(pub),
  get count() { return byId.size; }, get cells() { return grid.size; },
  stats: () => ({ ...stats, count: byId.size, cells: grid.size }), clear() { grid.clear(); byId.clear(); return true; }
};
// window.SSX is rebuilt by index.html after module evaluation; keep re-attaching (cheap) so SSX.colliders is always there
if (typeof window !== 'undefined') {
  const attach = () => { if (window.SSX && window.SSX.colliders !== API) window.SSX.colliders = API; };
  window.SSX = window.SSX || {}; attach(); setInterval(attach, 1000);
}
export default API;
