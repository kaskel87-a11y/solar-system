// Line of sight for heist cameras and guards (pure, no three.js). Cameras and guards must not see through walls,
// buildings or interior partitions: march the 3D segment and ask `blocked(x, y, z)` (world.camBlocked: city building
// boxes, domes, crates; plus heist-local boxes such as the ?heisttest=1 villa walls). The first `skipA` metres (the
// camera's own mount / the guard's body) and the last `skipB` (the target's own collider padding) are ignored.
export function boxHit(boxes, x, y, z) {
  for (const b of boxes) if (y < b.top && y > (b.bottom ?? -1e9) && Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz) return true;
  return false;
}
export function losClear(a, b, blocked, { step = 0.5, skipA = 1.0, skipB = 0.5 } = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
  if (!blocked || L <= skipA + skipB) return true;
  const n = Math.max(2, Math.ceil(L / step));
  for (let i = 1; i < n; i++) { const t = i / n, d = t * L; if (d < skipA || L - d < skipB) continue; if (blocked(a.x + dx * t, a.y + dy * t, a.z + dz * t)) return false; }
  return true;
}
// push a circle (x, z, r) out of axis-aligned boxes. Returns { x, z } or null when nothing was hit.
export function pushOut(boxes, x, z, r) {
  let hit = false;
  for (const b of boxes) { const dx = x - b.x, dz = z - b.z, ex = b.hx + r, ez = b.hz + r;
    if (Math.abs(dx) < ex && Math.abs(dz) < ez) { hit = true; if (ex - Math.abs(dx) < ez - Math.abs(dz)) x = b.x + Math.sign(dx || 1) * ex; else z = b.z + Math.sign(dz || 1) * ez; } }
  return hit ? { x, z } : null;
}
// a small time cache so each observer marches at most every `ttl` seconds
export function losCache(ttl = 0.12) {
  const m = new Map();
  return (key, now, fn) => { const e = m.get(key); if (e && now - e.t < ttl) return e.v; const v = fn(); m.set(key, { t: now, v }); return v; };
}
