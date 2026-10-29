// ridepark.js: pure helpers for "My rides" (live fix: buying a ride used to make the old one vanish from the world).
// A ride that isn't the active one has a park record { planet, x, z, y, yaw, at } in surface coordinates (the same
// frame the rover uses on that planet), saved in progress.garage.rides[i].park. No THREE, no DOM: tests/test-myrides-unit.mjs.

export const DELIVER_FEE = 75;        // cr, same planet
export const DELIVER_FEE_HOP = 250;   // cr, shipped from another planet on the next cargo hop
export const HOME_R = 60;             // free delivery within this many metres of your lock-ups
export const SHIP_R = 45;             // ... or of your ship
// lock-up bays, metres from the garage spot (garage frame: +z is out of the roller door). The work bay (0, 9)
// is where a newly selected ride rolls out, so it isn't in this list.
export const BAYS = [[-9, 3], [9, 3], [-9, 10], [9, 10], [-15, 6], [15, 6], [-21, 6], [21, 6]];

const fin = n => typeof n === 'number' && Number.isFinite(n);
// a park record from anything (old/corrupt saves): valid copy or null
export function cleanPark(p) {
  if (!p || typeof p !== 'object' || typeof p.planet !== 'string' || !p.planet || !fin(p.x) || !fin(p.z)) return null;
  return { planet: p.planet, x: p.x, z: p.z, y: fin(p.y) ? p.y : null, yaw: fin(p.yaw) ? p.yaw : 0, at: fin(p.at) ? p.at : 0, ...(p.bay != null ? { bay: p.bay | 0 } : {}) };
}
// park record for a vehicle-like object ({ x, y, z, yaw }) on a planet
export const parkOf = (v, planet, now = Date.now()) => ({ planet, x: +v.x || 0, z: +v.z || 0, y: fin(v.y) ? v.y : null, yaw: fin(v.yaw) ? v.yaw : 0, at: now });
// world position of lock-up bay i around the garage spot g ({x,z}), garage yawed by yaw
export function bayPos(i, g, yaw = 0) {
  const [bx, bz] = BAYS[((i % BAYS.length) + BAYS.length) % BAYS.length], c = Math.cos(yaw), s = Math.sin(yaw), ring = Math.floor(i / BAYS.length) * 7;
  return { x: g.x + bx * c + (bz + ring) * s, z: g.z - bx * s + (bz + ring) * c, yaw: Math.PI + yaw };
}
// which bays are taken by parked rides near the garage
export function freeBay(rides, g, yaw = 0, skipId = null) {
  for (let i = 0; i < 64; i++) {
    const p = bayPos(i, g, yaw);
    if (!rides.some(r => r.id !== skipId && r.park && Math.hypot(r.park.x - p.x, r.park.z - p.z) < 5)) return { ...p, bay: i };
  }
  return { ...bayPos(0, g, yaw), bay: 0 };
}
// rides that need a park: everything but the active ride. Returns ids of rides without a valid one (old saves).
export const unparked = G => (G?.rides || []).filter(r => r.id !== G.active && !cleanPark(r.park)).map(r => r.id);
// delivery fee: free at home (near your lock-ups or your ship), else a flat fee; more to ship it in from another planet
export function deliverFee({ samePlanet = true, nearGarage = false, nearShip = false } = {}) {
  if (!samePlanet) return DELIVER_FEE_HOP;
  return nearGarage || nearShip ? 0 : DELIVER_FEE;
}
// status line for the list
export function rideStatus(ride, { active = false, driving = false, planet = '', me = null } = {}) {
  if (active) return driving ? { k: 'driving', text: '🔑 You’re driving it' } : { k: 'active', text: '🔑 Your current ride' };
  const p = cleanPark(ride.park);
  if (!p) return { k: 'lockup', text: '🔧 In the lock-ups' };
  if (p.planet !== planet) return { k: 'away', text: `🅿️ Parked on ${p.planet}` };
  const d = me ? Math.round(Math.hypot(p.x - me.x, p.z - me.z)) : null;
  return { k: 'parked', text: `🅿️ Parked${d != null ? ` · ${d} m away` : ''}`, d };
}
