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
  if (!Number.isFinite(s.top)) s.top = baseOf(s, terrain) + (Number.isFinite(s.h) ? s.h : DEF_H) + (s.box ? CAP : 0);
  return s.top;
}
// does a circle of radius r at (x,z) overlap the solid's footprint? (same test as world.collide)
export function overlaps(s, x, z, r) {
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
