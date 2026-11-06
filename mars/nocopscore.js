// No ordinary ColSec at Red Static Gulch (v7.5.73, Collin): the pure zone rules for mars/nocops.js (tests/test-nocops-unit.mjs).
// One shared bounds check: a circle around the gulch (farm2core SITE.at, Ares Junction metres). world.js (dispatch, patrol
// units, traffic cruisers, checkpoints, colony guards, shots, bust + evade timers), mars/pursuit.js (rovers, SWAT,
// roadblocks, spotlights, search), mars/bribes.js (pull-over stops, spot bribes) and modes/raids.js (ColSec raid squads) all
// ask the same question through window.SSX.copFree(x, z). Wanted stars are never cleared here: you can be hot, they just
// don't come in. The worm, the farm2 drone sweep and other scripted gulch threats are not ordinary police and keep working;
// a future scripted gulch raid can pass { scripted: 'gulch' } to SSX.raids.start (that is the only way through).
import { SITE } from './farm2core.js';
export const ZONE = Object.freeze({ id: 'gulch', name: SITE.name, at: Object.freeze([SITE.at[0], SITE.at[1]]), r: 70 });
export const PAD = 3;          // metres outside the edge where a pushed-out unit ends up
export const SCRIPTED = 'gulch';
const fin = Number.isFinite;
// the zone in world metres for a colony origin {x, z}; null when there's no colony (off Mars)
export function zoneW(colony, z = ZONE) { return colony && fin(colony.x) && fin(colony.z) ? { x: colony.x + z.at[0], z: colony.z + z.at[1], r: z.r } : null; }
export function inside(zw, x, zz, extra = 0) { return !!zw && fin(x) && fin(zz) && Math.hypot(x - zw.x, zz - zw.z) < zw.r + extra; }
// nearest point just outside the zone (radially); null when (x, z) is already outside
export function pushOut(zw, x, zz, pad = PAD) {
  if (!inside(zw, x, zz, pad)) return null;
  let dx = x - zw.x, dz = zz - zw.z, L = Math.hypot(dx, dz);
  if (L < 1e-3) { dx = 1; dz = 0; L = 1; }
  const R = zw.r + pad; return { x: zw.x + dx / L * R, z: zw.z + dz / L * R };
}
// the one narrow escape: a scripted gulch raid that asks for it by name
export const scriptedOk = o => !!o && o.scripted === SCRIPTED;
