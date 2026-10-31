// mars/stillcore.js: rules + numbers for the Mars moonshine still at the Dustbowl Homestead (pure, unit-tested).
// Fiction only: made-up spirits, no real brands, no how-to. The still turns silo crops into bottles over in-game hours,
// bottles pack into crates of CRATE that ride in your rover, and the Xen-7 aliens (or Jeff's Velvet Airlock bar, #93) buy them.
import { CROPS } from './farmcore.js';

export const SAVE_KEY = 'ssx.still.v1', BAK_KEY = 'ssx.still.v1.bak';
// Same rate as farmcore's STAR_RATE in the farm expansions PR (#95): 1 cr = 1 ⭐. Mirrored here so this PR stands alone;
// once #95 is on main this can import it instead (same value).
export const STAR_RATE = 1;
export const PRICE = 1800;                 // the still, cr (or PRICE * STAR_RATE ⭐), charged once
export const PRICE_STARS = PRICE * STAR_RATE;
export const CRATE = 6;                    // bottles per crate
export const CARRY_CRATES = 4;             // crates your rover takes on one run
export const BATCH_MAX = 12;               // crops in one batch (1 crop -> 1 bottle)
export const ALIEN_MULT = 1.75;            // a bottle sells for ~1.75x the raw crop it came from (inside the 1.5-2x band)
// one recipe per crop: bottle id (keeps #93's type words: moonshine / gin / hooch), name, brew hours for a batch
export const RECIPES = {
  potato:    { id: 'potato_moonshine', name: 'Potato moonshine',      icon: '🫙', hours: 6 },
  algae:     { id: 'algae_gin',        name: 'Algae gin',             icon: '🍸', hours: 4 },
  glowberry: { id: 'glowberry_hooch',  name: 'Glow-berry hooch',      icon: '🍶', hours: 8 },
  lichen:    { id: 'lichen_absinthe',  name: 'Ghost lichen absinthe', icon: '🧪', hours: 10 }
};
export const CROP_IDS = Object.keys(RECIPES);
export const BOTTLES = Object.fromEntries(CROP_IDS.map(c => [RECIPES[c].id, { ...RECIPES[c], crop: c }]));
export const BOTTLE_IDS = Object.keys(BOTTLES);
const round5 = n => Math.round(n / 5) * 5;
const int = (v, lo = 0, hi = 1e9) => { const n = Math.floor(+v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
export const bottleOf = id => BOTTLES[id] || null;
export const nameOf = id => BOTTLES[id]?.name || String(id);
// cr per bottle from the Xen-7 aliens (and what SSX.liquor.alienPrice reports to the bar)
export function alienPrice(id) { const b = BOTTLES[id]; return b ? round5(CROPS[b.crop].price * ALIEN_MULT) : 0; }
export const rawPrice = id => { const b = BOTTLES[id]; return b ? CROPS[b.crop].price : 0; };
// how many bottles of profit pay the still back (plain-word economy check)
export const payback = id => { const m = alienPrice(id) - rawPrice(id); return m > 0 ? Math.ceil(PRICE / m) : Infinity; };

export const count = m => Object.values(m || {}).reduce((a, n) => a + (n | 0), 0);
export const crates = n => Math.ceil(Math.max(0, n | 0) / CRATE);
export const carryRoom = s => Math.max(0, CARRY_CRATES * CRATE - count(s.carried));

export function fresh() { return { v: 1, owned: false, paidWith: null, batch: null, home: {}, carried: {}, stats: { brewed: 0, sold: 0, earned: 0, seized: 0, busts: 0 } }; }
const cleanStock = m => { const o = {}; if (m && typeof m === 'object') for (const id of BOTTLE_IDS) { const n = int(m[id]); if (n > 0) o[id] = n; } return o; };
export function migrate(j) {
  const s = fresh(); if (!j || typeof j !== 'object') return s;
  s.owned = j.owned === true; s.paidWith = j.paidWith === 'stars' || j.paidWith === 'cr' ? j.paidWith : null;
  const b = j.batch; if (s.owned && b && RECIPES[b.crop] && int(b.n) > 0 && Number.isFinite(+b.start)) s.batch = { crop: b.crop, n: int(b.n, 1, BATCH_MAX), start: +b.start, hours: RECIPES[b.crop].hours };
  s.home = cleanStock(j.home); s.carried = cleanStock(j.carried);
  for (const k of Object.keys(s.stats)) s.stats[k] = int(j.stats?.[k]);
  return s;
}
const parseJ = t => { if (typeof t !== 'string' || !t) return null; try { return JSON.parse(t); } catch (e) { return null; } };
// #83 pattern: a still you paid for is never lost to one empty/broken read: save, then its mirror
export function recover(rawSave, rawBak) {
  const j = parseJ(rawSave), s = migrate(j); if (s.owned) return { s, from: 'save', restored: false };
  const b = migrate(parseJ(rawBak)); if (b.owned) return { s: b, from: 'backup', restored: true };
  return { s, from: j ? 'save' : 'fresh', restored: false };
}
export function mayOverwrite(next, rawStored) { if (next?.owned) return true; return !migrate(parseJ(rawStored)).owned; }

// ---------- buying (all-or-nothing, charged once) ----------
// cur: 'cr' | 'stars'. wallet: { cr, stars } balances. commit(cur, n) -> { ok } really charges (cr or SSX.stars).
export function canBuy(s, cur, wallet = {}) {
  if (s.owned) return { ok: false, why: 'owned', msg: 'You already own the still.' };
  const n = cur === 'stars' ? PRICE_STARS : PRICE, have = cur === 'stars' ? +wallet.stars || 0 : +wallet.cr || 0;
  if (cur !== 'cr' && cur !== 'stars') return { ok: false, why: 'cur', msg: 'Pay in cr or ⭐.' };
  if (have < n) return { ok: false, why: 'short', short: n - have, msg: cur === 'stars' ? `You need ${n - have} more ⭐ (it costs ${n} ⭐).` : `You need ${n - have} more cr (it costs ${n} cr).` };
  return { ok: true, n, cur };
}
export function buy(s, cur, wallet, commit) {
  const c = canBuy(s, cur, wallet); if (!c.ok) return c;
  let r; try { r = commit(cur, c.n); } catch (e) { r = { ok: false, msg: 'Payment failed.' }; }
  if (!r?.ok) return { ok: false, why: 'pay', dup: !!r?.dup, msg: r?.msg || 'Payment failed.' };
  s.owned = true; s.paidWith = cur; return { ok: true, n: c.n, cur, msg: `🥃 The still is yours (${c.n} ${cur === 'stars' ? '⭐' : 'cr'}). It\u2019s by the dome\u2019s west side.` };
}

// ---------- brewing (in-game hours) ----------
export function canStart(s, crop, n, have) {
  if (!s.owned) return { ok: false, why: 'unowned', msg: 'Buy the still first.' };
  if (!RECIPES[crop]) return { ok: false, why: 'crop', msg: 'That crop can\u2019t go in the still.' };
  if (s.batch) return { ok: false, why: 'busy', msg: 'The still is already brewing.' };
  n = Math.min(int(n), BATCH_MAX, int(have)); if (n < 1) return { ok: false, why: 'none', msg: `No ${CROPS[crop].name.toLowerCase()} in the silo.` };
  return { ok: true, n };
}
// take(n) -> crops really taken from the silo. The batch only starts on what was really taken.
export function start(s, crop, n, have, nowH, take) {
  const c = canStart(s, crop, n, have); if (!c.ok) return c;
  let got = 0; try { got = int(take(crop, c.n), 0, c.n); } catch (e) { got = 0; }
  if (got < 1) return { ok: false, why: 'none', msg: 'The silo came up empty.' };
  const R = RECIPES[crop]; s.batch = { crop, n: got, start: +nowH || 0, hours: R.hours };
  return { ok: true, n: got, id: R.id, hours: R.hours, msg: `🔥 Brewing ${got} ${R.name}. Ready in ${R.hours} h.` };
}
export function hoursLeft(s, nowH) { const b = s.batch; return b ? Math.max(0, b.start + b.hours - (+nowH || 0)) : 0; }
export function progress(s, nowH) { const b = s.batch; return b ? Math.min(1, Math.max(0, ((+nowH || 0) - b.start) / b.hours)) : 0; }
// finished batch -> bottles in the still's home stock. Returns { id, n } or null.
export function step(s, nowH) {
  const b = s.batch; if (!b || hoursLeft(s, nowH) > 0) return null;
  const id = RECIPES[b.crop].id; s.home[id] = (s.home[id] | 0) + b.n; s.stats.brewed += b.n; s.batch = null; return { id, n: b.n };
}

// ---------- crates in your rover ----------
// load: pack home bottles into crates (best-paying first) up to the rover's CARRY_CRATES
export function load(s) {
  let room = carryRoom(s), moved = 0; if (!room) return { ok: false, why: 'full', msg: `Your rover is full (${CARRY_CRATES} crates).` };
  if (!count(s.home)) return { ok: false, why: 'none', msg: 'No bottles at the still yet.' };
  for (const id of [...BOTTLE_IDS].sort((a, b) => alienPrice(b) - alienPrice(a))) {
    const n = Math.min(s.home[id] | 0, room); if (n <= 0) continue;
    s.home[id] -= n; if (!s.home[id]) delete s.home[id]; s.carried[id] = (s.carried[id] | 0) + n; room -= n; moved += n;
  }
  const c = count(s.carried); return { ok: true, n: moved, crates: crates(c), msg: `📦 Loaded ${moved} bottles. ${crates(c)} crate${crates(c) === 1 ? '' : 's'} in your rover.` };
}
export function unload(s) {
  const n = count(s.carried); if (!n) return { ok: false, why: 'none', msg: 'No crates in your rover.' };
  for (const [id, k] of Object.entries(s.carried)) s.home[id] = (s.home[id] | 0) + k; s.carried = {};
  return { ok: true, n, msg: `📦 Unloaded ${n} bottles at the still.` };
}
// SSX.liquor works on the bottles you carry (the crates in your rover)
export function inventory(s) { return BOTTLE_IDS.filter(id => (s.carried[id] | 0) > 0).map(id => ({ id, name: BOTTLES[id].name, n: s.carried[id] | 0 })); }
export function take(s, id, n) { const have = s.carried?.[id] | 0, k = Math.min(have, int(n)); if (k <= 0) return 0; s.carried[id] = have - k; if (!s.carried[id]) delete s.carried[id]; return k; }
export function add(s, id, n) { if (!BOTTLES[id]) return 0; const k = Math.min(int(n), carryRoom(s)); if (k <= 0) return 0; s.carried[id] = (s.carried[id] | 0) + k; return k; }
// sell to the Xen-7 aliens: returns { ok, n, each, cr }; the caller pays out cr
export function sell(s, id, n) {
  if (!BOTTLES[id]) return { ok: false, why: 'id', msg: 'Nobody here buys that.' };
  const k = take(s, id, n); if (!k) return { ok: false, why: 'none', msg: `No ${nameOf(id)} in your rover.` };
  const each = alienPrice(id), cr = each * k; s.stats.sold += k; s.stats.earned += cr;
  return { ok: true, n: k, each, cr, msg: `👽 Sold ${k} ${nameOf(id)} for ${cr} cr (${each} cr each).` };
}
// BUSTED: ColSec takes only the crates you carry. No fine here; bottles at the still are safe.
export function confiscate(s) {
  const n = count(s.carried); if (!n) return { n: 0, crates: 0 };
  const c = crates(n); s.carried = {}; s.stats.seized += n; s.stats.busts++; return { n, crates: c };
}
export const seizeText = r => `🚨 ColSec took the ${r.crates} crate${r.crates === 1 ? '' : 's'} of moonshine in your rover (${r.n} bottles). Bottles at the still are safe.`;
