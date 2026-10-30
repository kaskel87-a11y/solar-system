// Hands-on harvest rules for the Dustbowl Homestead (mars/harvest.js draws and wires them). Pure: no THREE, no DOM.
// tests/test-harvest-unit.mjs covers every rule here.
//
// - Sickle (free): each swing at a ripe rack cuts one patch (PATCHES per rack). The patch's share of the rack's yield goes
//   on your back as a rope-tied bale (CARRY_CAP crops). Quick cuts in a row (each within COMBO_S of the last) build a
//   combo: every COMBO_EVERY-th quick cut adds 1 extra crop.
// - Silo: drop the bale there to bank it into the farm's silo (SSX.farm.bank). What the silo can't take stays on your back.
// - Harvester (ROVER_PRICE cr, charged once): drive it over ripe racks to cut them into its hopper (HOPPER_CAP); it
//   empties when you stop at the silo.
// - Hire a hand: the old one-tap harvest, now HIRE.fee cr a rack and HIRE.secs seconds' wait.
// State lives in its own key (SAVE_KEY), so the farm save (ssx.farm.v1 + its .bak mirror) is never rewritten by us.
export const SAVE_KEY = 'ssx.harvest.v1';
export const PATCHES = 3;          // swings to clear a rack
export const CARRY_CAP = 12;       // crops you can carry in one bale
export const COMBO_S = 2.5;        // s between cuts to keep a combo going
export const COMBO_EVERY = 3;      // every 3rd quick cut in a row: +1 crop
export const SWING_CD = 0.45;      // s between sickle swings
export const HOPPER_CAP = 40;      // harvester hopper
export const ROVER_PRICE = 4000;   // cr
export const ROVER_KIND = 'harvester';
export const ROVER_CUT_S = 0.4;    // s between harvester cuts while over a rack
export const HIRE = { fee: 6, secs: 15 };
export const REACH = 3.0;          // m from a rack's centre to swing at it
export const ROVER_REACH = 3.4;    // m from a rack's centre for the harvester's header to cut it
export const SILO_R = 4.0;         // m from the silo to drop a bale or empty the hopper
export const SILO_AT = [8.4, -5.2];      // lot-local metres (east of the dome)
export const ROVER_PARK = [-14, 6, -Math.PI / 2]; // lot-local x, z, yaw: west of the fence, nose east along the rack row
const fin = Number.isFinite;
const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.floor(+v || 0)));

export function fresh() {
  return { v: 1, carry: {}, hopper: {}, cuts: {}, jobs: [], rover: { owned: false, ride: null, paid: 0 }, combo: { n: 0, t: -1e9, best: 0 },
    stats: { swings: 0, cuts: 0, banked: 0, bonus: 0, roverCuts: 0, emptied: 0, hires: 0 } };
}
export function migrate(raw) {
  const s = fresh(); let j = raw; if (typeof raw === 'string') { try { j = JSON.parse(raw); } catch (e) { j = null; } }
  if (!j || typeof j !== 'object') return s;
  const bag = o => { const b = {}; for (const [k, v] of Object.entries(o && typeof o === 'object' ? o : {})) { const n = clampI(v, 0, 999); if (n && /^[a-z]+$/.test(k)) b[k] = n; } return b; };
  s.carry = bag(j.carry); s.hopper = bag(j.hopper);
  for (const [k, c] of Object.entries(j.cuts && typeof j.cuts === 'object' ? j.cuts : {})) if (/^\d+:/.test(k) && c && fin(+c.d) && fin(+c.n)) s.cuts[k] = { d: clampI(c.d, 0, PATCHES), n: clampI(c.n, 0, 999), crop: String(c.crop || '') };
  s.jobs = (Array.isArray(j.jobs) ? j.jobs : []).filter(x => x && fin(+x.i) && fin(+x.due)).slice(0, 12).map(x => ({ i: x.i | 0, planted: +x.planted || 0, due: +x.due, fee: clampI(x.fee, 0, 999) }));
  const r = j.rover || {}; s.rover = { owned: !!r.owned, ride: r.ride ? String(r.ride) : null, paid: clampI(r.paid, 0, 1e6) };
  for (const k in s.stats) s.stats[k] = clampI(j.stats?.[k], 0, 1e9);
  s.combo.best = clampI(j.combo?.best, 0, 999);
  return s;
}
export const count = bag => Object.values(bag || {}).reduce((a, b) => a + (b | 0), 0);
export const rackKey = r => `${r.i | 0}:${+r.planted || 0}`;
// crops one patch k (0-based) of a rack yielding n gives: the shares add up to n exactly
export const share = (n, k, P = PATCHES) => Math.floor(n * (k + 1) / P) - Math.floor(n * k / P);
export function cropLeft(s, r) { const c = s.cuts[rackKey(r)]; return c ? Math.max(0, 1 - c.d / PATCHES) : 1; }
// crops still on a rack (what a hired hand or the last swing will bank)
export function remaining(s, r) { const c = s.cuts[rackKey(r)], n = c ? c.n : (r.n | 0); let left = 0; for (let k = c ? c.d : 0; k < PATCHES; k++) left += share(n, k); return left; }
function addTo(bag, crop, n) { if (n > 0) bag[crop] = (bag[crop] | 0) + n; }

// what the next cut at rack r would do, without changing anything (the caller clears the rack in the farm before the
// final patch, so a refused clear never loses or duplicates crops)
export function peek(s, r, dest = 'carry') {
  if (!r || !r.crop) return { ok: false, why: 'Nothing planted here.' };
  if (!r.ripe) return { ok: false, why: 'Not ripe yet.' };
  const c = s.cuts[rackKey(r)] || { d: 0, n: r.n | 0 }, got = share(c.n, c.d), cap = dest === 'hopper' ? HOPPER_CAP : CARRY_CAP;
  if (count(dest === 'hopper' ? s.hopper : s.carry) + got > cap) return { ok: false, full: true, why: dest === 'hopper' ? 'The hopper is full. Drive to the silo to empty it.' : 'Your bale is full. Drop it at the silo.' };
  return { ok: true, got, last: c.d + 1 >= PATCHES };
}
// one cut at rack r = { i, planted, crop, ripe, n }. dest 'carry' (sickle) or 'hopper' (harvester). now in seconds.
// returns { ok, crop, got, bonus, combo, last } — last: this was the rack's final patch, so the caller clears the rack.
export function cutPatch(s, r, dest = 'carry', now = 0) {
  if (!r || !r.crop) return { ok: false, why: 'Nothing planted here.' };
  if (!r.ripe) return { ok: false, why: 'Not ripe yet.' };
  const key = rackKey(r), c = s.cuts[key] || { d: 0, n: r.n | 0, crop: r.crop };
  if (c.d >= PATCHES) return { ok: false, why: 'Already cut.', last: true };
  const bag = dest === 'hopper' ? s.hopper : s.carry, cap = dest === 'hopper' ? HOPPER_CAP : CARRY_CAP, have = count(bag);
  const got = share(c.n, c.d);
  if (have + got > cap) return { ok: false, full: true, why: dest === 'hopper' ? 'The hopper is full. Drive to the silo to empty it.' : 'Your bale is full. Drop it at the silo.' };
  let combo = 0, bonus = 0;
  if (dest === 'carry') {
    combo = now - s.combo.t <= COMBO_S ? s.combo.n + 1 : 1; s.combo.n = combo; s.combo.t = now; s.combo.best = Math.max(s.combo.best, combo);
    if (combo % COMBO_EVERY === 0 && have + got + 1 <= cap) bonus = 1;
    s.stats.swings++; s.stats.bonus += bonus;
  } else s.stats.roverCuts++;
  c.d++; s.cuts[key] = c; addTo(bag, r.crop, got + bonus); s.stats.cuts++;
  const last = c.d >= PATCHES; if (last) delete s.cuts[key];
  return { ok: true, crop: r.crop, got, bonus, combo, last, left: PATCHES - c.d };
}
// a missed swing (nothing in reach) costs the combo
export function breakCombo(s) { s.combo.n = 0; s.combo.t = -1e9; }
export function comboText(n) {
  if (n < 2) return `Quick cuts: cut again within ${COMBO_S} s. Every ${COMBO_EVERY}rd quick cut in a row adds 1 extra crop.`;
  const to = COMBO_EVERY - (n % COMBO_EVERY);
  return n % COMBO_EVERY === 0 ? `Quick cuts x${n}: +1 extra crop! Keep cutting within ${COMBO_S} s.` : `Quick cuts x${n}: ${to} more quick cut${to === 1 ? '' : 's'} for +1 extra crop.`;
}
// bank a bag into the silo. room = free silo space. Takes what fits, leaves the rest in the bag. Returns the crops taken.
export function takeFrom(s, which, room) {
  const bag = which === 'hopper' ? s.hopper : s.carry, out = {}; let left = Math.max(0, room | 0), n = 0;
  for (const c of Object.keys(bag)) { const q = Math.min(bag[c] | 0, left); if (q > 0) { out[c] = q; left -= q; n += q; } }
  return { items: out, n };
}
// the farm accepted `got` (crop -> n): remove it from the bag
export function settle(s, which, got) {
  const bag = which === 'hopper' ? s.hopper : s.carry; let n = 0;
  for (const [c, q] of Object.entries(got || {})) { const t = Math.min(bag[c] | 0, q | 0); bag[c] = (bag[c] | 0) - t; if (bag[c] <= 0) delete bag[c]; n += t; }
  if (which === 'hopper') s.stats.emptied += n; else s.stats.banked += n;
  return n;
}
// hire a hand for rack r. nowMs = Date.now(). Charges once: a rack already being worked is refused.
export function canHire(s, r, credits, nowMs = Date.now()) {
  if (!r || !r.crop) return { ok: false, why: 'Nothing planted there.' };
  if (!r.ripe) return { ok: false, why: 'Not ripe yet.' };
  if (s.jobs.some(j => j.i === (r.i | 0) && j.planted === (+r.planted || 0))) return { ok: false, dup: true, why: `A hand is already on rack ${(r.i | 0) + 1}.` };
  if (credits < HIRE.fee) return { ok: false, why: `A hand costs ${HIRE.fee} cr.` };
  return { ok: true, cost: HIRE.fee, job: { i: r.i | 0, planted: +r.planted || 0, due: nowMs + HIRE.secs * 1000, fee: HIRE.fee } };
}
export function addJob(s, job) { s.jobs.push(job); s.stats.hires++; return job; }
export function dueJobs(s, nowMs = Date.now()) { const due = s.jobs.filter(j => j.due <= nowMs); if (due.length) s.jobs = s.jobs.filter(j => j.due > nowMs); return due; }
export const jobFor = (s, i) => s.jobs.find(j => j.i === (i | 0)) || null;
// harvester purchase: refused when owned or short; the caller charges ROVER_PRICE exactly once, then calls ownRover
export function canBuyRover(s, credits, hasRide = s.rover.owned) {
  if (hasRide) return { ok: false, owned: true, why: 'You already own the harvester.' };
  if (credits < ROVER_PRICE) return { ok: false, why: `The harvester is ${ROVER_PRICE} cr. You have ${credits | 0}.` };
  return { ok: true, cost: ROVER_PRICE };
}
export function ownRover(s, ride) { s.rover = { owned: true, ride: ride || null, paid: ROVER_PRICE }; return s.rover; }
// stale partial cuts (rack replanted / gone) and the matching pruning
export function prune(s, racks) {
  const live = new Set((racks || []).filter(r => r.crop).map(rackKey)); let n = 0;
  for (const k of Object.keys(s.cuts)) if (!live.has(k)) { delete s.cuts[k]; n++; }
  return n;
}
// local lot metres -> world, given the lot centre {x, z}
export const toWorld = (c, l) => ({ x: c.x + l[0], z: c.z + l[1] });
// nearest ripe rack within reach of p = {x, z}, from rackSpots()
export function nearestRipe(spots, p, reach = REACH) {
  let best = null, bd = reach;
  for (const r of spots || []) { if (!r.ripe) continue; const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < bd) { bd = d; best = r; } }
  return best;
}
