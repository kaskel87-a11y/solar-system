// Flamethrower rules (mars/flame.js). Pure: no DOM, no three, so tests/test-flame-unit.mjs runs it in Node.
// Steve. Fiction only: a short-range cone of fire with its own fuel tank, sold at the gun counters.

export const SAVE_KEY = 'ssx.flame.v1';           // the flamer's own save (owned / fuel / equipped). Never the farm or game save.
export const PRICE = 3500;                        // the flamer, at Ozzie's Iron and every weapons counter
export const FUEL_PRICE = 180;                    // one canister
export const FUEL_CAN = 50;                       // units per canister
export const TANK = 100;                          // tank size (a new flamer comes full)
export const BURN_RATE = 9;                       // fuel units per second of fire (a full tank is ~11 s)
export const RANGE = 8;                           // metres
export const HALF_ANGLE = 0.38;                   // radians (~22 degrees) each side of the aim line
export const BASE_R = 0.6;                        // the nozzle's own width, so point-blank still hits
export const HIT_EVERY = 0.2;                     // cone damage tick while fire is held (s)
export const HIT_DMG = 0.7;                       // per cone tick on colony folk (they have 3 hp, guards 6)
export const BURN_T = 5;                          // seconds a person keeps burning after the cone leaves them
export const BURN_EVERY = 0.5, BURN_DMG = 0.6;    // burning damage over time
export const CAR_FUSE = 6;                        // seconds a burning vehicle takes to blow
export const CAR_HEAT = 0.25;                     // fuse seconds added per cone tick on it (keep spraying = faster boom)
export const BOOM_R = 6, BOOM_DMG = 8;            // the vehicle explosion's splash (world.blast)
export const CROP_REGROW = 120;                   // session-only world crops grow back after this (s); never saved
export const MAX_PARTS = 240, MAX_PARTS_PHONE = 140; // hard particle caps (one pooled THREE.Points)
export const MAX_BURN = 8;                        // burning people + vehicles tracked at once

export const ITEMS = {
  'fl:flamer': { id: 'fl:flamer', name: 'Flamethrower', price: PRICE, kind: 'weapon', group: 'Weapons',
    desc: `8 m cone of fire while FIRE is held. Sets folk, cars and crops alight. Own ${TANK}-unit tank. Loud, and very illegal in town.` },
  'fl:fuel': { id: 'fl:fuel', name: `Flamer fuel (+${FUEL_CAN})`, price: FUEL_PRICE, kind: 'ammo', group: 'Ammo',
    desc: `A canister of gelled fuel for the flamethrower. Tank holds ${TANK}.` }
};

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const num = (v, d) => Number.isFinite(v) ? v : d;

export function fresh() { return { v: 1, owned: false, fuel: 0, eq: false, bought: 0 }; }
export function migrate(o) {
  const s = fresh(); if (!o || typeof o !== 'object') return s;
  s.owned = !!o.owned; s.fuel = clamp(num(o.fuel, 0), 0, TANK); s.eq = !!o.eq && s.owned; s.bought = Math.max(0, num(o.bought, 0) | 0);
  return s;
}

// one shop row in the game's shopList shape (index.html renderShop: owned items with ':' in the id show Equip/Equipped)
export function shopRow(id, st, credits) {
  const it = ITEMS[id]; if (!it) return null;
  let owned = false, ok = true, why = '', desc = it.desc;
  if (id === 'fl:flamer') { owned = !!st.owned; if (owned) desc = st.eq ? 'Equipped' : 'Owned. Tap to equip'; }
  if (id === 'fl:fuel') { if (!st.owned) { ok = false; why = 'Needs the Flamethrower'; } else if (st.fuel >= TANK - 0.5) { ok = false; why = 'Full'; } }
  return { id, name: it.name, desc, price: it.price, owned, equipped: owned && !!st.eq, ok: ok && !owned, why, afford: credits >= it.price, kind: it.kind, venues: ['guns'], group: it.group };
}
// which shop venues get the flamer: Ozzie's Iron ('guns') and any other venue that already sells weapons
export function sellsHere(venue, items) {
  if (venue === 'guns') return true;
  if (!venue || venue === 'bar' || venue === 'depot') return false;
  return Array.isArray(items) && items.some(i => i && i.group === 'Weapons' && i.kind === 'weapon' && !String(i.id).startsWith('fl:'));
}
// buy(): returns { ok, msg, st, cost }. Pure: the caller takes the credits and saves.
export function buy(id, st, credits) {
  const s = { ...st };
  if (id === 'fl:flamer') {
    if (s.owned) { s.eq = !s.eq; return { ok: true, msg: s.eq ? '🔥 Flamethrower in hand. Hold FIRE.' : 'Flamethrower stowed.', st: s, cost: 0 }; }
    if (credits < PRICE) return { ok: false, msg: `Short ${PRICE - credits} credits.`, st, cost: 0 };
    s.owned = true; s.eq = true; s.fuel = TANK; s.bought++;
    return { ok: true, msg: '🔥 Flamethrower: yours, tank full. Hold FIRE to burn (about 8 m).', st: s, cost: PRICE };
  }
  if (id === 'fl:fuel') {
    if (!s.owned) return { ok: false, msg: 'Needs the Flamethrower.', st, cost: 0 };
    if (s.fuel >= TANK - 0.5) return { ok: false, msg: 'Tank is full.', st, cost: 0 };
    if (credits < FUEL_PRICE) return { ok: false, msg: `Short ${FUEL_PRICE - credits} credits.`, st, cost: 0 };
    s.fuel = Math.min(TANK, s.fuel + FUEL_CAN);
    return { ok: true, msg: `⛽ Flamer fuel: tank at ${Math.round(s.fuel)}%.`, st: s, cost: FUEL_PRICE };
  }
  return { ok: false, msg: 'Not for sale.', st, cost: 0 };
}

// fuel burn for one frame; returns the new fuel (0 = dry). firing=false never burns.
export function burnFuel(fuel, dt, firing) { return firing ? Math.max(0, fuel - BURN_RATE * Math.max(0, dt)) : fuel; }
export const fuelPct = f => Math.round(clamp(f / TANK, 0, 1) * 100);

// Cone test, allocation-free: origin o (ox,oy,oz), unit aim d (dx,dy,dz), target t. Returns the distance along the aim, or -1.
export function coneHit(ox, oy, oz, dx, dy, dz, tx, ty, tz, range = RANGE, half = HALF_ANGLE, base = BASE_R, pad = 0) {
  const vx = tx - ox, vy = ty - oy, vz = tz - oz, along = vx * dx + vy * dy + vz * dz;
  if (along < -pad || along > range + pad) return -1;
  const perp2 = vx * vx + vy * vy + vz * vz - along * along, r = base + pad + Math.max(0, along) * Math.tan(half);
  return perp2 <= r * r ? Math.max(0, along) : -1;
}

// aim: on foot the flame goes level along the camera heading (slight droop); airborne (jetpack, a jump) it follows the
// camera's full pitch so you can torch the ground below. Writes into out (no allocation). Returns out.
export function aim(fx, fy, fz, airborne, out) {
  let x = fx, y = airborne ? fy : clamp(fy, -0.18, 0.12), z = fz; const h = Math.hypot(x, z) || 1;
  if (!airborne) { x /= h; z /= h; const c = Math.sqrt(Math.max(0, 1 - y * y)); x *= c; z *= c; }
  const l = Math.hypot(x, y, z) || 1; out.x = x / l; out.y = y / l; out.z = z / l; return out;
}

// vehicle fuse: a lit vehicle burns down; more flame on it shortens the fuse. Returns { fuse, boom }.
export function carTick(fuse, dt, sprayed) { const f = fuse - dt - (sprayed ? CAR_HEAT : 0); return { fuse: f, boom: f <= 0 }; }

// wanted heat: firing in or near a colony is a crime (world.shotFired -> crime 1); burning a person or security is
// handled by world.blast's own crime(). This just says how often to re-report sustained fire.
export const REPORT_EVERY = 3;

// session-only burnable crop patches near the colony (the farm has no crop-destroy API; see FLAME.md).
// Candidate offsets around the colony centre (x east, z south); flame.js keeps the ones that are clear ground.
export const CROP_SPOTS = [[34, 30], [-36, 34], [44, -6], [-44, -10], [20, 44], [-18, 46], [52, 18], [-52, 20]];
export const CROP_N = 24;           // stalks per patch (one InstancedMesh for all)
export const CROP_PATCHES = 3;
// the player's own farm plot is never burned (no safe API): true when (x,z) is inside a farm place
export function onFarm(x, z, places) {
  if (!Array.isArray(places)) return false;
  for (const p of places) if (p && p.id === 'farm' && Number.isFinite(p.x) && Math.hypot(x - p.x, z - p.z) < (p.r || 10) + 3) return true;
  return false;
}
// which vehicles never burn: the player's rover, the car being driven, and other teams' special rides (Raccoon)
export function fireproof(v, rover, driving) {
  if (!v) return true; if (v === rover || v === driving) return true;
  if (v.mine || v.owned || v.garage || v.player) return true;
  return /raccoon/i.test(String(v.kind || ''));
}
