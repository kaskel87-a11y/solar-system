// pure parts of mars/gulchbeam.js (no three.js): the red sky beam over Red Static Gulch, and the rule that keeps it
// from stacking on a dark green owned-place beam (mars/ownedbeamscore.js).
// The gulch is a business you buy, like the homestead, so the beam exists only once it is owned. There is no separate
// discovered flag. The trading post is the one place that stays lit without a purchase; this is not that.
export const RED = 0xff3b30, NEAR = 14, H = 120, R = 1.5;

// status is SSX.farm2.status(); site is that status's world metres {x, z} (not the AJ-relative SITE.at).
export function siteOf(status, site) {
  if (!status?.owned) return null;
  const x = +site?.x, z = +site?.z;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { id: 'farm2', name: site.name || 'Red Static Gulch', x, z };
}

// drop a green column that sits on the gulch, so the red beam replaces it instead of stacking.
// returns the same array when nothing is on the spot (no allocation on the common path).
export function withoutGulch(sites, gulch, near = NEAR) {
  const list = sites || [];
  if (!gulch || !Number.isFinite(+gulch.x) || !Number.isFinite(+gulch.z)) return list;
  let hit = -1;
  for (let i = 0; i < list.length; i++) if (Math.hypot(list[i].x - gulch.x, list[i].z - gulch.z) <= near) { hit = i; break; }
  if (hit < 0) return list;
  const out = [];
  for (let i = 0; i < list.length; i++) if (i !== hit && !(Math.hypot(list[i].x - gulch.x, list[i].z - gulch.z) <= near)) out.push(list[i]);
  return out;
}

export function colorAt(site, x, z, near = NEAR) {
  if (!site || !Number.isFinite(+x) || !Number.isFinite(+z)) return null;
  return Math.hypot(site.x - x, site.z - z) <= near ? RED : null;
}
