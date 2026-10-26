// v7.5.3 (Collin: stuck at "Blue Lights · Sprint · Gate 4/8"): checkpoint hit test. Pure, no three import.
// (Gates out of buildings: racecore.clearGates, PR #31 - used by race.js and game.js mission race steps.)
//  segHit(p0, p1, c, r) -> did the move p0 -> p1 pass within r of c (xz only, so airborne / fast frames still count)?
export const CP_RADIUS = 9;        // mission checkpoint radius (was 6 + reach)
export function segHit(p0, p1, c, r) {
  if (!p1 || !c) return false;
  if (!p0) return Math.hypot(p1.x - c.x, p1.z - c.z) < r;
  const dx = p1.x - p0.x, dz = p1.z - p0.z, L = dx * dx + dz * dz;
  const t = L > 1e-9 ? Math.max(0, Math.min(1, ((c.x - p0.x) * dx + (c.z - p0.z) * dz) / L)) : 0;
  return Math.hypot(p0.x + dx * t - c.x, p0.z + dz * t - c.z) < r;
}
