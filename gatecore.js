// v7.5.3 (Collin: stuck at "Blue Lights · Sprint · Gate 4/8"): race / checkpoint gate guards. Pure, no three import.
//  clearGate(g, w)  -> a gate that overlaps a building footprint moves to the nearest open road point
//                      (Beltway projection when it's close, else pushed out of the solids). Returns { x, z, moved }.
//  segHit(p0, p1, c, r) -> did the move p0 -> p1 pass within r of c (xz only, so airborne / fast frames still count)?
export const GATE_CLEAR_R = 6;     // a gate needs this much open ground round its centre
export const CP_RADIUS = 9;        // mission checkpoint radius (was 6 + reach)
export function clearGate(g, w = {}, r = GATE_CLEAR_R) {
  const hit = (x, z, rr = r) => { try { return w.collide ? w.collide(x, z, rr) : null; } catch (e) { return null; } };
  if (!g || !isFinite(g.x) || !hit(g.x, g.z, 1.5)) return { x: g?.x, z: g?.z, moved: false }; // only a gate whose centre is inside a footprint moves; one beside a lamp stays
  // 1) the Beltway, if the gate sits near it: same arc-length point, on the road
  try {
    const hw = typeof w.highway === 'function' ? w.highway() : w.highway;
    const pr = hw?.project?.(g.x, g.z);
    if (pr && isFinite(pr.s) && pr.d < 80) { const p = hw.at(pr.s); if (p && isFinite(p.x) && !hit(p.x, p.z, r * 0.5)) return { x: p.x, z: p.z, moved: true, via: 'road' }; }
  } catch (e) { /* no highway */ }
  // 2) nearest open ground: rings of 8 directions out to 60 m, first spot that's clear wins
  for (let d = 4; d <= 60; d += 4) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d;
    if (!hit(x, z)) return { x, z, moved: true, via: 'open' };
  }
  // 3) whatever the solver pushes us to
  let x = g.x, z = g.z; for (let k = 0; k < 6; k++) { const c = hit(x, z); if (!c) break; x = c.x; z = c.z; }
  return { x, z, moved: true, via: 'push' };
}
export function segHit(p0, p1, c, r) {
  if (!p1 || !c) return false;
  if (!p0) return Math.hypot(p1.x - c.x, p1.z - c.z) < r;
  const dx = p1.x - p0.x, dz = p1.z - p0.z, L = dx * dx + dz * dz;
  const t = L > 1e-9 ? Math.max(0, Math.min(1, ((c.x - p0.x) * dx + (c.z - p0.z) * dz) / L)) : 0;
  return Math.hypot(p0.x + dx * t - c.x, p0.z + dz * t - c.z) < r;
}
