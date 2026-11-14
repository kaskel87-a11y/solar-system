// mars/shiphopcore.js: where the Ashfall can hop on Mars, and when the sky is closed. Pure. No DOM.
// The same sky rules as Call ship: 3 stars, a job, indoors, or down. Under 3 stars is fine.
export const BOARD_M = 18;   // metres from the landed ship: you are boarding it
export const HERE_M = 40;    // already at this spot: no hop
export const LIFT_S = 1.15;
export const CROSS_S = 0.7;
export const DROP_S = 1.25;
export const LIFT_M = 70;
export const ORDER = ['downtown', 'velvet', 'pad', 'icecap', 'pit', 'farm', 'dealer', 'post'];
export const NAMES = {
  downtown: 'Ares Junction downtown',
  velvet: 'Velvet Airlock',
  pad: 'Your landing pad',
  icecap: 'Planum Australe',
  pit: 'The Pit',
  farm: 'Dustbowl Homestead',
  dealer: 'Red Line Motors',
  post: 'Xen-7 Trading Post'
};
export const ICONS = {
  downtown: '🏙️', velvet: '🍸', pad: '🏠', icecap: '❄️', pit: '🥊', farm: '🌱', dealer: '🚗', post: '👽'
};
const fin = v => typeof v === 'number' && Number.isFinite(v);

export function nearShip(player, ship, m = BOARD_M) {
  if (!player || !ship || !fin(player.x) || !fin(ship.x) || !fin(ship.z)) return false;
  if (fin(ship.alt) && ship.alt > 4) return false;
  return Math.hypot(player.x - ship.x, player.z - ship.z) <= m;
}

// why the Ashfall stays put. null means the sky is open. ctx.job is any heist, mission, race-job, or run.
export function skyBlock(c) {
  if (!c?.onMars) return 'Land on Mars first. The Ashfall flies from the ground.';
  if (c.indoors) return 'Step outside first. The ship needs open sky.';
  if (c.down) return 'You are down. The ship will not fly.';
  if ((c.wanted | 0) >= 3) return 'ColSec has the sky at 3 stars. Lose the heat, then fly.';
  if (c.job) return 'Finish the job first. The ship stays where it is.';
  if (c.driving) return 'Get out of the ride first.';
  if (c.busy || c.hopping) return 'The ship is already in the air.';
  return null;
}

export function hopBlock(c) {
  const w = skyBlock(c);
  if (w) return w;
  if (!c.nearShip) return 'Walk up to the Ashfall first.';
  return null;
}

export function listOf(raw, here) {
  const byId = new Map();
  for (const r of raw || []) {
    if (!r || !NAMES[r.id] || !fin(r.x) || !fin(r.z)) continue;
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const out = [];
  for (const id of ORDER) {
    const r = byId.get(id); if (!r) continue;
    const d = here && fin(here.x) ? Math.hypot(r.x - here.x, r.z - here.z) : Infinity;
    out.push({ id, name: r.name || NAMES[id], icon: r.icon || ICONS[id], x: r.x, z: r.z, d, here: d < HERE_M });
  }
  return out;
}

// stand clear of the hull, looking back at the ship
export function standAt(x, z) {
  const px = x + 10, pz = z + 4;
  return { x: px, z: pz, yaw: Math.atan2(-(x - px), -(z - pz)) };
}
