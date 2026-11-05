// pure parts of mars/ownedbeams.js (no three.js): which places glow dark green, and the lookup the waypoint beam uses.
export const GREEN = 0x0b6b2a, NEAR = 14, H = 120, R = 1.5;
// pure: the green places from the empire prop rows, the farm status and the farm places (world metres)
export function greenSites(props, farmOwned, places, extras) {
  const out = [], fin = Number.isFinite;
  for (const p of props || []) if (p?.owned && p.pos && fin(p.pos.x) && fin(p.pos.z)) out.push({ id: 'empire:' + p.id, name: p.name, x: p.pos.x, z: p.pos.z });
  for (const p of places || []) if (p && fin(p.x) && fin(p.z) && (p.id === 'post' || (p.id === 'farm' && farmOwned))) out.push({ id: p.id, name: p.name, x: p.x, z: p.z });
  for (const e of extras || []) if (e?.owned && fin(e.x) && fin(e.z)) out.push({ id: e.id, name: e.name, x: e.x, z: e.z });
  return out;
}
export function siteAt(sites, x, z, near = NEAR) { if (!Number.isFinite(x) || !Number.isFinite(z)) return null; for (const s of sites) if (Math.hypot(s.x - x, s.z - z) <= near) return s; return null; }

