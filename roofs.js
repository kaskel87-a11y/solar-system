// roofs.js: height-aware solids for vehicles (live fix: fly over buildings, land on roofs).
// Pure (no THREE, no DOM) so tests/test-roofs-unit.mjs can run it in node.
//
// world.js `solids` are footprints: blocks { x, z, box:[hx,hz], h } (mesh y0..y0+h plus a 0.3 m frame cap),
// domes { x, z, r: R+0.3, h: 0.8R } (half-ellipsoid), small circles (barriers, booths) { x, z, r, h }.
// Older collide() treated every solid as infinitely tall, so a car boosting over a building hit an invisible wall.
// Here every solid gets a top: s.top if a module set one, else derived from the terrain at its centre + h (+ cap),
// cached on the solid. A vehicle whose bottom is above the surface (minus CLEAR) passes; anything lower still collides.
// The same surface is also the ground under a vehicle (groundUnder), so whatever doesn't collide is supported: a car
// can never drop into a footprint and get stuck inside it.

export const CLEAR = 0.6;  // m: bottom this close below a roof still counts as "on the roof" (a kerb-sized step up)
export const CAP = 0.3;    // block frame cap thickness (world.js puts a 0.3 m slab on top of each block)
export const EDGE = 0.9;   // dome rim step: near a dome's edge its surface is at least y0 + EDGE, so ground cars still hit it
const DEF_H = 4;

const isDome = s => !s.box && !s.flat && s.r > 3 && Number.isFinite(s.h);

// base (ground) height of a solid, cached
export function baseOf(s, terrain) {
  if (!Number.isFinite(s.y0)) s.y0 = Number.isFinite(s.top) ? s.top - (Number.isFinite(s.h) ? s.h : DEF_H) : (terrain ? terrain(s.x, s.z) : 0);
  return s.y0;
}
// flat top of a solid (highest point), cached
export function topOf(s, terrain) {
  if (!Number.isFinite(s.top)) s.top = baseOf(s, terrain) + (Number.isFinite(s.h) ? s.h : DEF_H) + (s.box && s.col == null ? CAP : 0); // #44 colliders have no frame cap
  return s.top;
}
// does a circle of radius r at (x,z) overlap the solid's footprint? (same test as world.collide)
export function overlaps(s, x, z, r) {
  if (s.box && s.yaw) { const lx = x - s.x, lz = z - s.z, c = Math.cos(s.yaw), n = Math.sin(s.yaw); return Math.abs(lx * c - lz * n) < s.box[0] + r && Math.abs(lx * n + lz * c) < s.box[1] + r; } // #44 rotated box (same local frame as mars/colliders.js)
  if (s.box) return Math.abs(x - s.x) < s.box[0] + r && Math.abs(z - s.z) < s.box[1] + r;
  const dx = x - s.x, dz = z - s.z, m = s.r + r; return dx * dx + dz * dz < m * m;
}
// height of the solid's upper surface felt by a vehicle centre at (x,z) with collision radius r.
// Boxes / small circles: flat top. Domes: the dome grown by r (a car body resting on a ball sits r further out),
// never lower than y0 + EDGE inside the overlap ring so a car at ground level always bumps the rim.
export function surfaceAt(s, x, z, r, terrain) {
  const top = topOf(s, terrain);
  if (!isDome(s)) return top;
  const y0 = baseOf(s, terrain), R = s.r - 0.3 + r, H = s.h + r * 0.5, d = Math.hypot(x - s.x, z - s.z);
  const k = d >= R ? 0 : Math.sqrt(1 - (d / R) * (d / R));
  return Math.max(y0 + EDGE + 0.05, y0 + H * k);
}
// height-aware skip: true when a vehicle whose bottom is at yb clears this solid at (x,z)
export function clears(s, x, z, r, yb, terrain) {
  return Number.isFinite(yb) && yb > surfaceAt(s, x, z, r, terrain) - CLEAR;
}
// parked vehicles as short flat cylinders (roof ~ y + 1.9)
export const carTop = (v, terrain) => (Number.isFinite(v.y) ? v.y : terrain ? terrain(v.x, v.z) : 0) + (v.spec?.h || 1.9);
export const clearsCar = (v, yb, terrain) => Number.isFinite(yb) && yb > carTop(v, terrain) - CLEAR;

// ground under a vehicle at (x,z): max(terrain, any roof it's at or above). r is the same radius collide() is given
// (spec.r * 0.75) so the support area is exactly the collision area. cars: parked vehicles (objects with x,z,y,spec,parked).
// Returns { g, src } so callers can tell when the support surface changed.
export function groundUnder(solids, x, z, r, yb, terrain, cars = [], self = null) {
  let g = terrain(x, z), src = null;
  if (!Number.isFinite(yb)) return { g, src };
  for (const s of solids) {
    if (!overlaps(s, x, z, r)) continue;
    const S = surfaceAt(s, x, z, r, terrain);
    if (S > g && yb >= S - CLEAR) { g = S; src = s; }
  }
  for (const v of cars) {
    if (v === self || !v.parked) continue;
    const m = (v.spec?.r || 2) * 0.8 + r, dx = x - v.x, dz = z - v.z;
    if (dx * dx + dz * dz >= m * m) continue;
    const S = carTop(v, terrain); if (S > g && yb >= S - CLEAR) { g = S; src = v; }
  }
  return { g, src };
}

// ---------- add-on colliders (PR #44 mars/colliders.js, window.SSX.colliders), feature-detected ----------
// #44 registers street props as 2-D shapes ({type:'box',x,z,hx,hz,yaw} / {type:'cyl',x,z,r}, plus id/group/tag) and
// world.collide() calls SSX.colliders.resolve(x, z, r) with no height. When that API exists we wrap it (never edit it):
//  - every collider gets a top: declared h / top / y0 on the shape, else the bounds of a mesh/object it carries,
//    else a per-tag height (numbers taken from #44's own build code), else COL_DEF_H;
//  - resolve() skips colliders the current vehicle's bottom is above (world.collide passes it via setMover());
//  - colliderSolids() feeds them into groundUnder(), so a vehicle can land on them too.
// Without #44 nothing here runs (attachColliders() returns null) and #63 behaves the same.
export const COL_DEF_H = 3;
const COL_H = [[/^fence/, 2.55], [/^office/, 2.8], [/^truck/, 2.3], [/^hulk/, 1.6], [/^tyres/, 1.2], [/^barrel/, 1.05], [/^crate/, 0.8],
  [/^tag:container/, 2.6], [/^tag:jersey/, 1.46], [/^tag:dumpster/, 1.47], [/^tag:yardwall/, 3.25], [/^tag:billboard/, 6]];
const colInfo = new Map(), colProxy = new Map();
let mover, moverTerrain = null, colAPI = null;
export function setMover(yb, terrain) { mover = yb; if (terrain) moverTerrain = terrain; }
// highest world y of a three.js object's geometry (duck-typed, no THREE import); null if it has none
export function meshTop(obj) {
  if (!obj || typeof obj.traverse !== 'function') return null; let top = -Infinity;
  obj.updateWorldMatrix?.(true, true);
  obj.traverse(o => { const g = o.geometry; if (!g) return; if (!g.boundingBox) g.computeBoundingBox?.(); const b = g.boundingBox, e = o.matrixWorld?.elements; if (!b || !e) return;
    for (const X of [b.min.x, b.max.x]) for (const Y of [b.min.y, b.max.y]) for (const Z of [b.min.z, b.max.z]) top = Math.max(top, e[1] * X + e[5] * Y + e[9] * Z + e[13]); });
  return Number.isFinite(top) ? top : null;
}
export function colliderTop(shape) { // -> { h } or { top } (absolute), from the shape itself
  if (Number.isFinite(shape.top)) return { top: shape.top, y0: shape.y0 };
  if (Number.isFinite(shape.h)) return { h: shape.h, y0: shape.y0 };
  const mt = meshTop(shape.mesh || shape.object || shape.obj); if (mt != null) return { top: mt, y0: shape.y0 };
  const tag = String(shape.tag ?? shape.id ?? ''); for (const [re, h] of COL_H) if (re.test(tag)) return { h, y0: shape.y0 };
  return { h: COL_DEF_H, y0: shape.y0 };
}
function proxy(p, terrain) { // a solids-style record for a #44 shape (pub form from query/list), cached per id
  let q = colProxy.get(p.id); if (q && q.x === p.x && q.z === p.z) return q;
  const t = colInfo.get(p.id) || { h: COL_DEF_H };
  q = { x: p.x, z: p.z, flat: true, col: p.id, ...(p.type === 'cyl' ? { r: p.r } : { r: Math.hypot(p.hx, p.hz), box: [p.hx, p.hz], yaw: p.yaw || 0 }) };
  if (Number.isFinite(t.top)) { q.top = t.top; q.h = Number.isFinite(t.y0) ? t.top - t.y0 : DEF_H; if (Number.isFinite(t.y0)) q.y0 = t.y0; }
  else { q.h = t.h; if (Number.isFinite(t.y0)) q.y0 = t.y0; }
  topOf(q, terrain || moverTerrain); colProxy.set(p.id, q); return q;
}
function pushOut(p, x, z, r) { // same contract and maths as #44's push()
  if (p.type === 'cyl') { const dx = x - p.x, dz = z - p.z, m = p.r + r, d2 = dx * dx + dz * dz; if (d2 >= m * m) return null; if (d2 < 1e-10) return [p.x, p.z + m]; const d = Math.sqrt(d2); return [p.x + dx / d * m, p.z + dz / d * m]; }
  const c = Math.cos(p.yaw || 0), n = Math.sin(p.yaw || 0); let lx = x - p.x, lz = z - p.z; if (p.yaw) { const a = lx * c - lz * n, b = lx * n + lz * c; lx = a; lz = b; }
  const qx = Math.max(-p.hx, Math.min(p.hx, lx)), qz = Math.max(-p.hz, Math.min(p.hz, lz)), dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null; let ox, oz;
  if (d2 > 1e-10) { const d = Math.sqrt(d2); ox = qx + dx / d * r; oz = qz + dz / d * r; }
  else { const px = p.hx - Math.abs(lx), pz = p.hz - Math.abs(lz); if (px < pz) { ox = Math.sign(lx || 1) * (p.hx + r); oz = lz; } else { ox = lx; oz = Math.sign(lz || 1) * (p.hz + r); } }
  if (p.yaw) { const a = ox * c + oz * n, b = -ox * n + oz * c; ox = a; oz = b; }
  return [p.x + ox, p.z + oz];
}
export function attachColliders(G = globalThis) {
  const A = G?.SSX?.colliders;
  if (!A || typeof A.resolve !== 'function' || typeof A.add !== 'function' || typeof A.query !== 'function') return null;
  if (A.__roofs) return (colAPI = A);
  const add0 = A.add, remove0 = A.remove, rg0 = A.removeGroup, clear0 = A.clear, resolve0 = A.resolve;
  A.add = shape => { const id = add0(shape); try { colInfo.set(String(id), colliderTop(shape)); colProxy.delete(String(id)); } catch (e) { /* keep #44 working */ } return id; };
  if (remove0) A.remove = id => { colInfo.delete(String(id)); colProxy.delete(String(id)); return remove0(id); };
  if (rg0) A.removeGroup = g => { for (const s of A.list?.(g) || []) { colInfo.delete(s.id); colProxy.delete(s.id); } return rg0(g); };
  if (clear0) A.clear = () => { colInfo.clear(); colProxy.clear(); return clear0(); };
  A.resolve = (x, z, r = 0.45) => {
    const yb = mover; mover = undefined; // one-shot: set by world.collide() right before its SSX.colliders line
    if (!Number.isFinite(yb) || !moverTerrain) return resolve0(x, z, r);
    const near = A.query(x, z, r + 0.1); if (!near.length) return null;
    const keep = near.filter(p => { const q = proxy(p, moverTerrain); return !(overlaps(q, x, z, r) && clears(q, x, z, r, yb, moverTerrain)); });
    if (keep.length === near.length) return resolve0(x, z, r);
    let hit = false; for (let it = 0; it < 2; it++) { let moved = false; for (const p of keep) { const o = pushOut(p, x, z, r); if (o) { x = o[0]; z = o[1]; hit = moved = true; } } if (!moved) break; }
    return hit ? { x, z } : null;
  };
  A.topOf = id => { const p = (A.list?.() || []).find(s => s.id === String(id)); return p && moverTerrain ? topOf(proxy(p, moverTerrain)) : null; };
  A.__roofs = true; return (colAPI = A);
}
// #44 colliders near (x, z) as solids-style records for groundUnder (empty without #44)
export function colliderSolids(x, z, r, terrain) {
  const A = colAPI || attachColliders(); if (!A) return [];
  if (terrain) moverTerrain = terrain;
  const near = A.query(x, z, r + 0.1); return near.length ? near.map(p => proxy(p, terrain)) : near;
}
// wrap early so colliders registered at street start already get their tags' heights (same 1 s cadence #44 uses to attach)
if (typeof window !== 'undefined') { attachColliders(); setInterval(() => { if (!colAPI || window.SSX?.colliders !== colAPI) attachColliders(); }, 1000); }
