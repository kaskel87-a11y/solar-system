// v7.5 outdoor collider API (Snuffles): window.SSX.colliders. Props that aren't core buildings (street props, grime
// shanties, burn barrels, fences) register simple shapes here, and the player, vehicles and walking NPCs respect them
// through ONE guarded line in world.collide() (core): `globalThis.SSX?.colliders?.resolve?.(x, z, r, skip)`.
// Shapes (world metres, ground plane):
//   { type: 'box', x, z, hx, hz, yaw? }   AABB half-extents; optional yaw (radians, same sense as three.js rotation.y) for a rotated box
//   { type: 'cyl', x, z, r }              vertical cylinder
// Extra fields: id (auto when missing), group (bulk remove), tag (anything). Resolution pushes the mover out along the
// contact normal / shortest axis, so movement slides along walls. A uniform grid (8 m cells) keeps it cheap on phones:
// resolve() only tests shapes in the 1-4 cells the mover overlaps.
const CELL = 8;
let ticked = false;
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
// resolve a mover; returns { x, z, nx, nz } when it was pushed (nx/nz = unit contact normal, pointing out of the shapes),
// else null (same contract as world.collide). `mover` (optional) is the vehicle world.collide was asked about (its `skip`):
// a driven vehicle scraping a collider slides along it instead of bouncing (see slide()).
export function resolve(x, z, r = 0.45, mover = null) {
  if (!byId.size || !Number.isFinite(x) || !Number.isFinite(z)) return null; stats.resolves++;
  let hit = false; const x0 = x, z0 = z;
  for (let it = 0; it < 2; it++) {
    stamp++; let moved = false;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = grid.get(key(i, j)); if (!a) continue;
      for (const s of a) { if (s._s === stamp) continue; s._s = stamp; stats.tests++; const p = push(s, x, z, r); if (p) { x = p[0]; z = p[1]; hit = moved = true; } } }
    if (!moved) break;
  }
  if (!hit) return null; stats.hits++;
  const dx = x - x0, dz = z - z0, L = Math.hypot(dx, dz) || 1, out = { x, z, nx: dx / L, nz: dz / L };
  if (mover) slide(mover, out, r);
  return out;
}
// ---------- vehicles slide along walls ----------
// Core surface.js answers any collide() hit on a vehicle with `speed *= -0.25` (a bounce) and, above 9 m/s, a crash event
// (above 16 m/s it hurts you). For our colliders we want a scrape: velocity projected onto the wall tangent. We can't touch
// surface.js, so: when a moving vehicle (it has speed / yaw / spec.r, and r is its collide radius) grazes one of our shapes
// (not head-on), remember its tangent velocity and slid position, clamp its speed under the crash threshold for core's
// check, and restore the slide in a registerSurfaceTick that runs right after the vehicle update in the same frame.
// Head-on hits (> ~37 deg into the wall) keep core's bounce + crash, as they should.
const slides = new Map(), slideStats = { slides: 0, headOn: 0, applied: 0, last: null };
const HEAD_ON = 0.6; // |v.n| / |v| above this = head-on
function slide(v, o, r) {
  if (!v || typeof v.speed !== 'number' || typeof v.yaw !== 'number' || !v.spec || !(Math.abs(r - v.spec.r * 0.75) < 1e-6)) return; // only the vehicle's own move step
  const sp = v.speed, s = Math.abs(sp); if (s < 0.6) return;
  const vx = -Math.sin(v.yaw) * sp, vz = -Math.cos(v.yaw) * sp, vn = vx * o.nx + vz * o.nz;
  if (vn >= 0) return; // already moving away from the wall
  if (-vn / s > HEAD_ON) { slideStats.headOn++; return; }
  const tx = vx - vn * o.nx, tz = vz - vn * o.nz, vt = Math.hypot(tx, tz) * 0.93; // a little scrape friction
  const yaw = sp >= 0 ? Math.atan2(-tx, -tz) : Math.atan2(tx, tz);
  slides.set(v, { x: o.x, z: o.z, speed: Math.sign(sp) * vt, yaw, nx: o.nx, nz: o.nz });
  v.speed = Math.sign(sp) * Math.min(s, 8.5); slideStats.slides++; o.slide = true;
}
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function afterVehicles() { // registerSurfaceTick: after updateRover(), before render
  if (!slides.size) return;
  for (const [v, p] of slides) {
    v.x = p.x; v.z = p.z; v.speed = p.speed; v.yaw += wrap(p.yaw - v.yaw) * 0.35;
    try { if (v.group) { v.group.position.x = v.x; v.group.position.z = v.z; } } catch (e) { /* */ }
    slideStats.applied++; slideStats.last = { speed: +p.speed.toFixed(2), nx: +p.nx.toFixed(2), nz: +p.nz.toFixed(2) };
  }
  slides.clear();
}
const pub = s => s.type === 'cyl' ? { id: s.id, type: 'cyl', x: s.x, z: s.z, r: s.r, group: s.group } : { id: s.id, type: 'box', x: s.x, z: s.z, hx: s.hx, hz: s.hz, yaw: s.yaw || 0, group: s.group };
export function query(x, z, r = 1) { const out = []; stamp++; cells([x - r, z - r, x + r, z + r], k => { for (const s of grid.get(k) || []) if (s._s !== stamp) { s._s = stamp; const b = s._b; if (x + r > b[0] && x - r < b[2] && z + r > b[1] && z - r < b[3]) out.push(pub(s)); } }); return out; }
export const API = {
  add, remove, removeGroup, resolve, query,
  blocked: (x, z, r = 0.45) => !!resolve(x, z, r),
  list: group => [...byId.values()].filter(s => group == null || s.group === group).map(pub),
  get count() { return byId.size; }, get cells() { return grid.size; },
  stats: () => ({ ...stats, count: byId.size, cells: grid.size, slide: { ...slideStats, ticked } }), clear() { grid.clear(); byId.clear(); return true; }
};
// window.SSX is rebuilt by index.html after module evaluation; keep re-attaching (cheap) so SSX.colliders is always there
if (typeof window !== 'undefined') {
  const attach = () => {
    if (window.SSX && window.SSX.colliders !== API) window.SSX.colliders = API;
    if (!ticked && typeof window.SSX?.registerSurfaceTick === 'function') { try { window.SSX.registerSurfaceTick(afterVehicles); ticked = true; } catch (e) { /* */ } }
  };
  window.SSX = window.SSX || {}; attach(); setInterval(attach, 1000);
}
export default API;
