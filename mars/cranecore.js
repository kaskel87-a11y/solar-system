// v7.5.22 Magnet crane truck: pure rules + numbers (no DOM, no THREE). Unit-tested by tests/test-crane-unit.mjs.
// mars/crane.js does the truck model, the magnet, the swing, the HUD button and the game wiring.
// Fiction only. M-rated: swearing and grand theft auto, nothing sexual.
export const KIND = 'magnet_crane';
export const PRICE = 1800;
export const SAVE_KEY = 'ssx.crane.v1';
export const DISTRICT = 'mars-rough';            // Red Tape Flats (district-local metres, x east, z south)
export const PARK = [47, 37, Math.PI];          // Lou's crane, parked nose-out just south of the HOOK & CROOK gate
// NPC-owned rides parked around the Flats so there is something worth lifting near the yard (dealer kinds; skipped if the
// dealership module isn't loaded). Plus every other parked vehicle in the world (buggies, haulers, bikes, skimmers).
export const NPC_RIDES = [['dust_runner', 30, 42, 1.3], ['ares_brute', 64, 36, -0.5]]; // two: phone draw-call budget
export const SPEC = {
  name: 'Magnet crane', icon: '🧲', price: PRICE, dealer: false, hidden: true, tier: 2,
  vmax: 14, boost: 21, acc: 6.5, bacc: 10, turn: 1.1, wy: 0.75, wr: 0.75, r: 3.0, tough: true,
  blurb: 'Lou\u2019s six-wheel wrecker with a lattice boom and an electromagnet that eats parked cars.'
};
// boom tip in truck-local metres (forward is -z): the boom reaches forward over the cab and the magnet hangs ~3.5 m ahead of
// the nose, so the chase camera sees the load out front instead of having it swing into the lens
export const TIP = { x: 0, y: 6.7, z: -6.0 };
export const TURRET_Z = 0.7;
export const MAG_H = 0.45;           // magnet puck height
export const STOW_L = 1.6;           // cable length with nothing on it
export const GRAB_R = 3.4;           // m from the hook's ground point to a ride (minus its radius share) to latch
export const MAX_SPEED = 3.0;        // m/s: grab / drop only at a crawl
export const DROP_V = 7, LIFT_V = 2.6; // cable pay-out / reel-in speeds (m/s)
export const CARRY_GAP = 1.1;        // the carried ride's belly rides this high off the ground under the truck's wheels
export const SELL_R = 9;             // hook within this many metres of Lou's drop point = sell / keep panel
export const G = 3.71;               // Mars gravity: long, lazy swings
export const SWING = { damp: 0.55, maxA: 0.75, maxAcc: 22 };
export const OWNER_CALL_T = 12;      // s after an unseen lift before the owner notices and calls it in
export const OWNER_CALL_P = 0.6;     // chance they do call ColSec (the rest just scream at the sky)
export const LINES = {
  crane_owner: ['HEY! That\u2019s MY ride, you crane-humping son of a bitch!', 'Put it DOWN! I still owe forty grand on that!', 'Are you fucking kidding me? With a CRANE?',
    'I\u2019m calling ColSec, asshole! I got your plate!', 'My kid\u2019s car seat is in there, you ghoul!', 'Somebody stop that magnet!'],
  crane_lou: ['Lou: Magnets. Why didn\u2019t I think of magnets.', 'Lou: Hang it on the hook, I\u2019ll pay ya. No questions, no receipts.', 'Lou: That\u2019s my crane, you little shit! Bring it back!'],
  crane_call: ['\ud83d\udcdf Owner on the band: "Some psycho with a CRANE just took my ride!"', '\ud83d\udcdf Owner to ColSec: "It went UP. Like, into the sky. On a magnet."', '\ud83d\udcdf Owner: "Yeah, a wrecker, yellow, hauling MY car. Go get him."']
};
const fin = n => typeof n === 'number' && Number.isFinite(n);
export const S0 = () => ({ v: 1, owned: false, how: null, lifts: 0, sold: 0, stripped: 0, kept: 0, dropped: 0, cr: 0, seen: 0 });
export function loadState(raw) {
  let s = null; try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { s = null; }
  const o = S0(); if (!s || typeof s !== 'object' || s.v !== 1) return o;
  o.owned = !!s.owned; o.how = s.how === 'bought' || s.how === 'stole' ? s.how : null;
  for (const k of ['lifts', 'sold', 'stripped', 'kept', 'dropped', 'cr', 'seen']) o[k] = fin(s[k]) && s[k] >= 0 ? Math.floor(s[k]) : 0;
  return o;
}
// truck-local point -> world, for a truck at (x, y, z) with yaw (forward is -z local, rotated by yaw about +y)
export function toWorld(car, lx, ly, lz) {
  const c = Math.cos(car.yaw || 0), s = Math.sin(car.yaw || 0);
  return { x: car.x + lx * c + lz * s, y: (car.y || 0) + ly, z: car.z - lx * s + lz * c };
}
// best liftable ride under the hook: world vehicles { x, z, kind, parked, traffic?, carried?, spec: { r } } (or a plain r)
export function pickTarget(hx, hz, list, { skip = null, exclude = [KIND] } = {}) {
  let best = null, bd = GRAB_R;
  for (const v of list || []) {
    if (!v || v === skip || !v.parked || v.traffic || v.carried || exclude.includes(v.kind)) continue;
    const d = Math.hypot(v.x - hx, v.z - hz) - (v.r ?? v.spec?.r ?? 2.4) * 0.6; if (d < bd) { bd = d; best = v; }
  }
  return best;
}
// what the Magnet button does right now
export function mode({ driving, aboard, held, busy, target, inYard, nearForSale, owned }) {
  if (!driving) return nearForSale && !owned ? 'buy' : '';
  if (!aboard) return '';
  if (busy) return 'busy';
  if (held) return inYard ? 'sell' : 'drop';
  return target ? 'grab' : 'empty';
}
export function label(m, { name = '', price = PRICE } = {}) {
  return { buy: `\ud83e\uddf2 Buy crane \u00b7 ${price.toLocaleString('en-US')} cr`, grab: `\ud83e\uddf2 Grab ${name}`.trim(), empty: '\ud83e\uddf2 Magnet', busy: '\ud83e\uddf2 \u2026',
    drop: '\ud83e\uddf2 Drop', sell: '\ud83d\udd27 Drop for Lou' }[m] || '';
}
// v7.5.28 cops calm down: lifting a ride is car theft, so no heat unless a ColSec officer right there saw it (copSaw: within
// copcore THEFT_COP_R with line of sight) -> 1 star if you were clean, never stacks. Bystanders / owners just shout.
export const heatOnGrab = (copSaw, wanted) => copSaw ? Math.max(wanted | 0, 1) : wanted | 0;
// stealing the crane itself: whatever world.take() decided (0 unless a cop saw), no forced stars. Owned: whatever you had before.
export function wantedOnEnter(owned, before, now) { return owned ? Math.min(now | 0, before | 0) : now | 0; }
// unseen lift: does the owner call it in? (rand in [0, 1)); only if you still have it or are still close.
// v7.5.28: the call is just a toast / bark now (ColSec doesn't chase car thefts), no stars
export const ownerCalls = (rand, stillClose) => !!stillClose && rand < OWNER_CALL_P;
// cable length that hangs a ride of height h (ground to roof) with its belly CARRY_GAP above the truck's ground
export const carryLen = (h, tipY = TIP.y) => Math.max(STOW_L, tipY - MAG_H - CARRY_GAP - Math.max(0.6, h));
// cable length that just touches the roof of a ride whose roof is roofY above the truck's ground
export const reachLen = (roofY, tipY = TIP.y) => Math.max(0.3, tipY - MAG_H - roofY);
// carried rides hang crosswise (best clearance from the tailgate): nearest of +-pi/2 to the yaw they had relative to the truck
export function crosswise(rel) { const a = Math.atan2(Math.sin(rel), Math.cos(rel)); return a >= 0 ? Math.PI / 2 : -Math.PI / 2; }
// one pendulum step on one axis: a = truck acceleration along that axis in the truck frame (m/s^2), L = cable length.
// Returns [angle, angular velocity]. Sign: positive angle swings the load toward +axis; the load lags the truck.
export function swingStep(th, w, a, L, dt) {
  const acc = Math.max(-SWING.maxAcc, Math.min(SWING.maxAcc, a || 0)), l = Math.max(0.8, L);
  w += (-(G / l) * Math.sin(th) - SWING.damp * w - (acc / l) * Math.cos(th)) * dt;
  th += w * dt; if (th > SWING.maxA) { th = SWING.maxA; w = Math.min(0, w); } else if (th < -SWING.maxA) { th = -SWING.maxA; w = Math.max(0, w); }
  return [th, w];
}
// Lou's fallback price when the street module (SSX.street.tow) isn't loaded: a third of list for dealer kinds
export function fallbackQuote(kind, price, wanted = 0, strip = false) {
  const base = { buggy: 260, hoverbike: 300, hauler: 340, shuttle: 420 }[kind] ?? (fin(price) ? Math.round(price * 0.3) : 220);
  return Math.round(base * Math.max(0.5, 1 - 0.12 * (wanted | 0)) * (strip ? 0.45 : 1) / 5) * 5;
}
