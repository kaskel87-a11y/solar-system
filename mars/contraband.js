// v7.5 Mars contraband economy (Marsmania). Fictional space drugs: buy from Blue in Red Tape Flats, sell to street
// buyers across the Mars districts. Prices depend on the district, how fresh the product is and how hard you've
// flooded that corner (saturation recovers over a few minutes). Dealing where security can see it is a crime
// (world.crime), some buyers are undercover ColSec, and getting busted or downed costs you the stash.
// Everything is game fiction: invented products, invented effects, no real substances.
// Self-contained add-on: loaded by one <script type="module"> in index.html, talks to the game only through
// window.__app (surface, game, world, toast) and window.SSX (districtsOf, registerMenuItem).
import * as THREE from 'three';

/**
 * window.SSX.contraband — public API (for Steve's activity runner: Blue Drop, Scrap Run, and any other mod).
 * Data: mars/barter.json (Steve's story pack) adds 13 items (glow_dust maps to glowdust) with per-district values that drive
 * buyerPrice, and its 32 offers replace the built-in barter defaults. Missing/bad file -> built-in defaults (see DEFAULT_BARTER).
 * Hooks out (all feature-detected, see the gives.type table above DEFAULT_BARTER): (window.heist || SSX.heist).applyTip,
 * SSX.garage.grantUpgrade / grantVehicle, SSX.gang.spawnBackup, SSX.bark(npc, 'barter_<key>', { line }), SSX.rep.get(faction),
 * SSX.unlockMission(id); window events 'ssx:tip' 'ssx:backup' 'ssx:venue' 'ssx:raidtip' 'ssx:unlock' 'ssx:chop'.
 * Item ids: 'glowdust' | 'lowg' | 'redstatic' | 'voidhoney' (+ barter.json ids: glow_dust_brick, hive_resin, salvage, hot_plates,
 * cold_cell, colsec_tag, ledger_chip, lungful, red_dust_whiskey, contraband, medkit, ration_paste). District ids:
 * 'red-tape-flats' | 'olympus-row' | 'helios-heights' | 'ares-beltway' | 'ares-junction' (underscored forms accepted).
 * Unknown ids return null / { ok: false }.
 *
 *  items()                         -> [{ id, name, icon, blurb, supplier, base, max, spoilPerMin, contraband?, vals?, stock? }]
 *  districts()                     -> [{ id, name, centre:[x,z] (Ares Junction-relative), r, mult, registered }]
 *  district()                      -> id of the district the player is standing in now, or null (off Mars / open desert)
 *  districtAt(x, z)                -> district id at AJ-relative metres, or null
 *  supplierPrice(item)             -> credits per unit at Blue's (Red Tape Flats)
 *  buyerPrice(item, district?, pos?) -> credits per unit a street buyer pays right now (district default: current);
 *                                     x SSX.turf.priceMultiplier(district, pos) when turf wars are loaded (pos default: player)
 *                                     includes district multiplier, taste, saturation and your stash freshness
 *  stash()                         -> { items: { [id]: { qty, fresh } }, total, capacity, value }  (a copy)
 *  capacity()                      -> { used, max }
 *  buy(item, qty = 1, opts?)       -> { ok, qty, cost, msg }  pays credits. opts.free = true grants without paying
 *                                     (pickups, mission cases); opts.fresh = 0..1. Clamped to carry limits.
 *  add(item, qty = 1, fresh = 1)   -> same as buy(item, qty, { free: true, fresh })
 *  remove(item, qty = all)         -> units removed (confiscated / dropped / delivered without a sale)
 *  sell(item, qty = 1, district?, opts?) -> { ok, qty, unit, credits, msg }
 *                                     Sells from the stash at buyerPrice, pays credits + a little XP and adds
 *                                     saturation. No proximity, undercover or witness checks unless opts.risk = true
 *                                     (then it behaves like a street deal: may call world.crime or be a bust).
 *                                     opts.pay = false moves stock without paying (runner pays its own reward).
 *  barterOffers(district?, npc?)   -> [{ id, npc, npcName, district, wants:{item,qty} (main item), wantsAll:[{item,qty}], gives:{type,...},
 *                                     label, available, why, src, repeatable, cooldownSec }]
 *                                     offers in a district (default: current; null = all), optionally for one NPC
 *  barter(item, qty, offerId, opts?) -> { ok, offer, gives, msg, tip? }  trade product for the offer's reward.
 *                                     item/qty may be null to use the offer's own wants. No proximity check (the panel
 *                                     enforces that); opts.district rejects offers from another district.
 *  registerOffer({ id, npc, district, wants:{ item, qty } | [{ item, qty }], gives:{ type, ... }, label?, available?(ctx),
 *                  onTrade?(ctx), npcDef?, cooldownSec?, repeatable?, requires?, rep?, risk?, lines? })
 *                                     add or replace an offer (barter.json never overrides a registered id). gives.type: any
 *                                     type in the table above DEFAULT_BARTER ('weapon' | 'ammo' | 'cash' | 'wanted' | 'unlock' |
 *                                     'custom' | 'heist_tip' | 'garage_upgrade' | 'garage_vehicle' | 'gang_backup' | ...). onTrade runs after the
 *                                     built-in reward; return false / { ok: false, msg } to cancel (product is refunded) or
 *                                     { msg } to replace the message. ctx = { offer, npc, district, item, qty, result, app,
 *                                     game, world, stash, wants, toast, grantShop(shopId), addAmmo(type, n), bark(key) }. npcDef { name, role, district, at, line }
 *                                     gives the NPC an in-world 🤝 beacon; without it, trade through barter() from your own NPC.
 *  offer(id), npcs(), tips()       -> one offer / barter NPCs / heist+burglary tips bought so far
 *  backup                          -> seconds of Saltblood backup left (0 = none)
 *  barterSource                    -> 'barter.json' once mars/barter.json loaded, else 'default'
 *  hasAccess(venueId)              -> true while a venue_access trade is live (velvet_airlock_vip, the_static_door)
 *  saturation(item, district?)     -> 0..1 how flooded that corner is (0 = fresh market)
 *  open() / close()                -> show / hide the stash panel
 *  on(fn)                          -> subscribe to { type: 'buy'|'sell'|'barter'|'bust'|'heat'|'tip'|'backup'|'confiscate'|'change', ... }; returns unsubscribe
 *  reset()                         -> wipe stash and saturation (tests)
 */

const KEY = 'ssx.contraband.v1';
export const ITEMS = {
  glowdust: { name: 'Glow-dust', icon: '🔵', blurb: 'Blue powder. Your eyes glow for an hour and every hum sounds like a choir.', supplier: 40, base: 95, max: 12, spoilPerMin: 0.4 },
  lowg: { name: 'Low-G', icon: '🎈', blurb: 'Gel caps. You swear gravity switched off. Melts fast in a warm pocket.', supplier: 20, base: 50, max: 15, spoilPerMin: 3 },
  redstatic: { name: 'Red Static', icon: '⚡', blurb: 'Crackling red crystals. You hear radio from colonies that don\u2019t exist.', supplier: 75, base: 170, max: 8, spoilPerMin: 0.8 },
  voidhoney: { name: 'Void Honey', icon: '🍯', blurb: 'Black syrup vials. Time skips like a scratched disc. Rich kids love it.', supplier: 160, base: 360, max: 4, spoilPerMin: 1.2 }
};
const CORE = ['glowdust', 'lowg', 'redstatic', 'voidhoney']; // Blue's house products (always listed)
const CARRY = 20; // total units on you
const SAT_SOFT = 6, SAT_HALF_S = 180, SAT_FLOOR = 0.3; // 6 units sold halves the price; recovers with a 3 min half-life
// AJ-relative design-pack centres (solar-system-story/mars-city). Registered districts override these.
const DEF = {
  'red-tape-flats': { name: 'Red Tape Flats', centre: [-280, -40], r: 95, mult: 0.75, undercover: 0.04, watch: 0.12, heat: 1, taste: { lowg: 1.2 }, alias: /red.?tape|rough|flats/i },
  'olympus-row': { name: 'Olympus Row', centre: [0, -430], r: 110, mult: 1.45, undercover: 0.12, watch: 0.35, heat: 2, taste: { redstatic: 1.15 }, alias: /olympus|downtown/i },
  'helios-heights': { name: 'Helios Heights', centre: [320, 80], r: 95, mult: 1.75, undercover: 0.1, watch: 0.45, heat: 2, taste: { voidhoney: 1.25, lowg: 0.8 }, alias: /helios|gated/i },
  'ares-junction': { name: 'Ares Junction', centre: [0, 0], r: 70, mult: 1.0, undercover: 0.07, watch: 0.3, heat: 1, taste: {}, alias: /ares.?junction/i },
  'ares-beltway': { name: 'Ares Beltway', centre: [0, -220], r: 28, mult: 1.2, undercover: 0.03, watch: 0.1, heat: 1, taste: { glowdust: 1.1 }, alias: /beltway|highway/i,
    line: [[0, -55], [-30, -50], [0, -220], [0, -390], [0, -430], [60, -430], [180, -200], [280, 40], [320, 80], [120, 160], [80, 40], [0, 60], [-140, 20], [-240, -20], [-280, -40], [-200, -120], [-80, -160], [0, -55]] }
};
const SUPPLIER = { name: 'Blue', at: [-258, -50], district: 'red-tape-flats', label: 'THE BLUE ROOM' };
const SPOTS = [ // street buyers (AJ-relative)
  { d: 'red-tape-flats', at: [-262, -20] }, { d: 'red-tape-flats', at: [-296, -32] },
  { d: 'olympus-row', at: [12, -410] }, { d: 'olympus-row', at: [34, -434] },
  { d: 'helios-heights', at: [300, 72] }, { d: 'helios-heights', at: [344, 74] },
  { d: 'ares-junction', at: [-42, -26] }, { d: 'ares-junction', at: [44, -8] },
  { d: 'ares-beltway', at: [-140, 24] }, { d: 'ares-beltway', at: [124, 164] }, { d: 'ares-beltway', at: [-84, -164] }
];
const NAMES = ['Twitch', 'Mags', 'Dusty', 'Kip', 'Lark', 'Old Sol', 'Neve', 'Gritt', 'Pell', 'Carmody', 'Juniper', 'Rocco'];
const LINES = ['You holding? Make it quick.', 'My shift starts in ten. What you got?', 'Don\u2019t look at me. Look at the dust. Talk.', 'Heard Blue\u2019s stuff is clean this week.', 'Cash now, nobody saw nothing.'];
const NARC = ['So\u2026 is this the illegal stuff? For, uh, me. A civilian.', 'Great weather. Very normal weather. Got any product, fellow criminal?', 'I\u2019d like to purchase drugs, please. Recreationally.'];
const R_SPOT = 5, R_SUP = 6; // npc spots use R_SPOT

// ---------- state ----------
let S = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) { /* fresh */ } return { v: 1, stash: {}, sat: {}, stats: { sold: 0, earned: 0, busts: 0 } }; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const subs = new Set(); const emit = ev => { for (const f of subs) { try { f(ev); } catch (e) { console.warn('contraband listener', e); } } };
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game, world = () => surf()?.world;
const toast = (m, ms = 3200) => app()?.toast?.(m, ms);
const credits = () => game()?.progress?.credits ?? 0;
const qtyOf = id => S.stash[id]?.qty || 0;
const used = () => Object.values(S.stash).reduce((a, s) => a + (s.qty || 0), 0);
const clampQ = q => Math.max(0, Math.floor(Number(q) || 0));

// districts: design-pack defaults, merged with whatever world.registerDistrict('Mars', …) has (v7.5 city build)
function districtList() {
  const out = {}; for (const id in DEF) out[id] = { id, ...DEF[id], registered: false };
  let reg = []; try { reg = window.SSX?.districtsOf?.('Mars') || []; } catch (e) { reg = []; }
  for (const r of reg) {
    const k = out[r.id] ? r.id : Object.keys(DEF).find(id => DEF[id].alias.test(`${r.id} ${r.name || ''}`)); if (!k) continue;
    const c = Array.isArray(r.centre) ? r.centre : Array.isArray(r.center) ? r.center : null;
    out[k] = { ...out[k], name: r.name || out[k].name, centre: c && k !== 'ares-beltway' ? c : out[k].centre, r: r.r || r.radius || out[k].r, registered: true, regId: r.id };
  }
  return out;
}
const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)) : 0; return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
function districtAt(x, z) {
  const D = districtList(); let best = null, bd = 1e9;
  for (const id in D) { if (id === 'ares-beltway') continue; const d = D[id], dd = Math.hypot(x - d.centre[0], z - d.centre[1]); if (dd < d.r && dd < bd) { bd = dd; best = id; } }
  if (best) return best;
  const L = D['ares-beltway'].line; for (let i = 1; i < L.length; i++) if (segD(x, z, L[i - 1], L[i]) < D['ares-beltway'].r) return 'ares-beltway';
  return null;
}
// player position relative to Ares Junction (the Mars colony origin); null off Mars / no colony
function here() {
  const s = surf(), i = s?.info; if (!i || i.name !== 'Mars' || !i.colony) return null;
  return { x: i.x - i.colony.x, z: i.z - i.colony.z, info: i };
}
const curDistrict = () => { const h = here(); return h ? districtAt(h.x, h.z) : null; };

// ---------- pricing ----------
function satVal(item, d) { const s = S.sat[d + '|' + item]; if (!s) return 0; return s.v * Math.pow(0.5, (Date.now() - s.t) / 1000 / SAT_HALF_S); }
function addSat(item, d, n) { const k = d + '|' + item; S.sat[k] = { v: satVal(item, d) + n, t: Date.now() }; }
const satMult = (item, d) => Math.max(SAT_FLOOR, 1 / (1 + satVal(item, d) / SAT_SOFT));
const freshMult = id => 0.35 + 0.65 * (S.stash[id]?.qty ? S.stash[id].fresh : 1);
function supplierPrice(item) { const I = ITEMS[itemId(item)]; return I ? I.supplier : null; }
function buyerPrice(item, d = curDistrict(), pos) {
  item = itemId(item); d = distId(d);
  const I = ITEMS[item], D = d && districtList()[d]; if (!I || !D) return null;
  let v = I.base * D.mult; // built-in model: base x district multiplier
  if (I.vals) { const V = I.vals, mid = ((V['red-tape-flats'] ?? I.base) + (V['olympus-row'] ?? I.base)) / 2; // Steve's per-district values (barter.json items[])
    v = V[d] ?? (d === 'ares-junction' ? mid : d === 'ares-beltway' ? mid * 1.05 : I.base * D.mult); }
  return Math.max(1, Math.round(v * (D.taste?.[item] || 1) * satMult(item, d) * freshMult(item) * turfMult(d, pos) * repMult(d, pos) * labMult(item)));
}
// Turf wars (marsmania/turf, PR #15): selling on blocks you hold pays more. Guarded: 1 when SSX.turf is absent or throws.
// pos = AJ-relative { x, z } of the sale; defaults to the player when pricing the district you're standing in.
function turfMult(d, pos) { return modMult(window.SSX?.turf?.priceMultiplier, d, pos); }
// Faction rep (marsmania/rep, PR #20): gang corners pay more when they like you, less when they don't. Same guard.
function repMult(d, pos) { return modMult(window.SSX?.rep?.priceMultiplier, d, pos); }
// Vat House (marsmania/lab, PR #27): lab-made product sells by its purity. Same guard; stash qty passed so lab never re-enters stash().
function labMult(item) { try { const m = Number(window.SSX?.lab?.qualityMult?.(item, S.stash[item]?.qty | 0) ?? 1); return Number.isFinite(m) && m > 0 ? m : 1; } catch (e) { return 1; } }
function modMult(f, d, pos) {
  try {
    if (typeof f !== 'function') return 1;
    if (!pos && d === curDistrict()) { const h = here(); if (h) pos = { x: h.x, z: h.z }; }
    const m = Number(f(d, pos) ?? 1); return Number.isFinite(m) && m > 0 ? m : 1;
  } catch (e) { return 1; }
}

// ---------- stash ops ----------
function changed(ev) { save(); if (ev) emit(ev); emit({ type: 'change' }); render(); }
function room(item) { const I = ITEMS[item]; if (!I) return 0; return Math.max(0, Math.min(I.max - qtyOf(item), CARRY - used())); }
function buy(item, qty = 1, opts = {}) {
  item = itemId(item); const I = ITEMS[item]; if (!I) return { ok: false, qty: 0, cost: 0, msg: 'Unknown product.' };
  if (I.stock === false && !opts.free) return { ok: false, qty: 0, cost: 0, msg: `Blue: I don\u2019t carry ${I.name}.` };
  let q = Math.min(clampQ(qty), room(item));
  if (q <= 0) return { ok: false, qty: 0, cost: 0, msg: used() >= CARRY ? `Pockets full (${CARRY} units).` : `You can only carry ${I.max} ${I.name}.` };
  const unit = I.supplier; let cost = opts.free ? 0 : unit * q;
  if (cost > 0) { const g = game(); if (!g) return { ok: false, qty: 0, cost: 0, msg: 'Not in game.' };
    if (credits() < cost) { q = Math.floor(credits() / unit); if (q <= 0) return { ok: false, qty: 0, cost: 0, msg: `Blue: ${unit} cr a unit. You\u2019re short.` }; cost = unit * q; }
    if (!g.spend(cost)) return { ok: false, qty: 0, cost: 0, msg: 'Blue: Cash first.' }; }
  const s = S.stash[item] || (S.stash[item] = { qty: 0, fresh: 1 }), f = Math.max(0, Math.min(1, opts.fresh ?? 1));
  s.fresh = (s.fresh * s.qty + f * q) / (s.qty + q); s.qty += q;
  changed({ type: 'buy', item, qty: q, cost });
  return { ok: true, qty: q, cost, msg: cost ? `Bought ${q} ${I.name} for ${cost} cr.` : `+${q} ${I.name}.` };
}
function remove(item, qty) { const s = S.stash[item]; if (!s) return 0; const q = qty === undefined ? s.qty : Math.min(s.qty, clampQ(qty)); s.qty -= q; if (s.qty <= 0) delete S.stash[item]; changed(); return q; }
// witnesses: colony cameras / guards / security units close by, plus district watchfulness
function heatRoll(d) {
  const w = world(), h = here(); if (!w || !h) return false; const D = districtList()[d] || DEF['ares-beltway'];
  let p = D.watch; const px = h.info.x, pz = h.info.z;
  if ((w.securityList?.() || []).some(s => Math.hypot(s.x - px, s.z - pz) < 60)) p += 0.5;
  const ppl = w.mapData?.()?.people || []; if (ppl.some(q => q.kind === 'guard' && Math.hypot(q.x - px, q.z - pz) < 30)) p += 0.3;
  if (backupUntil > Date.now()) p *= 0.5;
  return Math.random() < Math.min(0.95, p);
}
function sell(item, qty = 1, d = curDistrict(), opts = {}) {
  item = itemId(item); d = distId(d);
  const I = ITEMS[item]; if (!I) return { ok: false, qty: 0, unit: 0, credits: 0, msg: 'Unknown product.' };
  if (I.contraband === false && opts.risk) return { ok: false, qty: 0, unit: 0, credits: 0, msg: `Buyer: I don\u2019t want ${I.name}. Trade it to someone who does.` };
  if (!d || !districtList()[d]) return { ok: false, qty: 0, unit: 0, credits: 0, msg: 'No buyers out here.' };
  const q = Math.min(clampQ(qty), qtyOf(item)); if (q <= 0) return { ok: false, qty: 0, unit: 0, credits: 0, msg: `You\u2019re not holding any ${I.name}.` };
  const w = world(), D = districtList()[d];
  if (opts.risk) {
    if ((w?.wanted || 0) > 0) return { ok: false, qty: 0, unit: 0, credits: 0, msg: 'Buyer: You\u2019re glowing with heat. Get away from me.' };
    const narc = backupUntil > Date.now() ? false : opts.undercover ?? Math.random() < D.undercover; // Saltblood backup sniffs out narcs
    if (narc) { // bust: product gone, ColSec on you
      remove(item, q); S.stats.busts++; const stars = Math.max(D.heat + 1, w?.wanted || 0);
      w?.setWanted?.(stars, 'sold to an undercover ColSec officer'); changed({ type: 'bust', item, qty: q, district: d, stars });
      return { ok: false, bust: true, qty: q, unit: 0, credits: 0, msg: `🚨 "ColSec! Hands where I can see them!" ${q} ${I.name} seized. ${'★'.repeat(stars)}` };
    }
  }
  // price each unit as saturation builds, so dumping 10 at once pays less than 10× the sticker
  let total = 0; for (let k = 0; k < q; k++) { total += buyerPrice(item, d); addSat(item, d, 1); }
  const s = S.stash[item]; s.qty -= q; if (s.qty <= 0) delete S.stash[item];
  if (opts.pay !== false) game()?.reward?.(Math.round(total / 25), total);
  S.stats.sold += q; S.stats.earned += total;
  let seen = false; if (opts.risk && heatRoll(d)) { seen = true; w?.crime ? w.crime(D.heat, `dealing ${I.name} in ${D.name}`) : w?.setWanted?.(D.heat, 'dealing'); }
  changed({ type: 'sell', item, qty: q, credits: total, district: d, seen }); if (seen) emit({ type: 'heat', district: d, item });
  return { ok: true, qty: q, unit: Math.round(total / q), credits: total, seen, msg: `Sold ${q} ${I.name} for ${total} cr.${seen ? ' Somebody saw that. 🚨' : ''}` };
}
function stash() { const items = {}; let value = 0; const d = curDistrict() || 'ares-junction';
  for (const id in S.stash) { items[id] = { qty: S.stash[id].qty, fresh: Math.round(S.stash[id].fresh * 100) / 100 }; value += (buyerPrice(id, d) || 0) * S.stash[id].qty; }
  return { items, total: used(), capacity: CARRY, value }; }

// ---------- barter: trade product for guns, ammo, rides and favors ----------
// Data: mars/barter.json (Steve's story tables, solar-system-story/mars-city/barter.json, format "solar-system-story/mars-barter v1")
// is fetched at runtime. When it loads, its items join the catalog and its offers REPLACE the built-in DEFAULT_BARTER below;
// if it is missing or malformed the defaults stay. Offers registered from code (registerOffer) are never replaced by the file.
// Offer shape (both sources, and registerOffer):
//   { id, npc, district, location?:[x,z] (AJ-relative trade spot), wants: {item, qty} | [{item, qty}, ...] (item 'credits' = wallet),
//     gives: { type, ... }, label?, cooldownSec?, repeatable? (false = once), requires?: { wanted_min?, driving_stolen? },
//     rep?: { factions: [{faction, min}], missions_done: [missionId] }, risk?: { bust_chance, wanted_on_bust, wanted_on_trade },
//     lines?: { offer, accept, decline, caught }, available?(ctx), onTrade?(ctx) }
// gives.type -> what happens (external hooks are feature-detected; when the module is missing the offer is unavailable with a reason
// and a one-time console note, so no product is taken for nothing):
//   weapon { weaponId|weapon, ammo?:{ammoId, qty} }  game.buy(id) for free via grantShop (unlocks + starting ammo) + extra ammo
//   ammo { ammo, n } / ammo_bundle { ammo:[{ammoId, qty}], onlyOwned }  game.progress.inv, capped by game.ammoCap
//   cash { credits }                                 game.reward(0, credits)
//   wanted { clear } / wanted_clear { stars }        world.setWanted(max(0, world.wanted - n)); needs wanted > 0
//   heist_tip { heistId, tip:{type:'cameras'|'safe'|'patrol', ...} }  (window.heist || SSX.heist).applyTip(heistId, tip)  [Ben]
//   tip { kind, target, text, at? }                  SSX.heist.applyTip if heistId given, else stored + 'ssx:tip' event
//   garage_upgrade { upgradeId, vehicle? }           SSX.garage.grantUpgrade(vehicle || 'current', upgradeId)  [Pumpkin]
//   garage_vehicle { vehicleId, opts:{noPlates} }    SSX.garage.grantVehicle(vehicleId, { noPlates: true, ...opts })  [Pumpkin/Dutch]
//   rover { upgrade? }                               next game.js rover SHOP upgrade via grantShop (built-in default mechanic only)
//   backup / gang_backup { faction, count|n, durationSec|secs }  SSX.gang.spawnBackup({...}) when present [CoS]; the built-in
//                                                    street cover (no narcs, half the witnesses) applies either way
//   venue_access { venueId, durationSec }            game flag 'venue:<id>' + contraband.hasAccess(id) + 'ssx:venue' event
//   raid_tip { warnSec }                             stored warning + 'ssx:raidtip' event (no raid system in the engine yet)
//   unlock / unlock_job { flag | missionId }         game flag ('unlock:<missionId>'), SSX.unlockMission?.(id), 'ssx:unlock' event
//   chop { payoutCredits, bonusItems, clearsVehicleHeat }  needs a stolen ride; pays, adds items, -1 star, 'ssx:chop' event
//   item { item, qty }                               adds to the stash
//   custom                                           onTrade(ctx) does the work
export const DEFAULT_BARTER = {
  format: 'ssx-barter v1',
  npcs: {
    kettle: { name: 'Kettle', role: 'gunrunner', district: 'red-tape-flats', at: [-302, -58], line: 'Kettle: Product for iron. I don\u2019t take credits, credits have serial numbers.' },
    saltblood: { name: 'Saltblood crew', role: 'gang', district: 'red-tape-flats', at: [-266, -66], line: 'Saltblood: Pay the tape, we ride with you. For a bit.' },
    dorsey: { name: 'Sgt. Dorsey', role: 'officer', district: 'olympus-row', at: [-30, -414], line: 'Dorsey: I\u2019m off the clock. My memory is too, for the right gift.' },
    whisper: { name: 'Whisper', role: 'informant', district: 'olympus-row', at: [42, -448], line: 'Whisper: I hear things. Hearing makes me thirsty.' },
    mabel: { name: 'Grease Mabel', role: 'mechanic', district: 'ares-beltway', at: [80, 48], line: 'Mabel: Pay me in the good stuff and I\u2019ll bolt something mean on your rover.' }
  },
  offers: [
    { id: 'kettle-shotgun', npc: 'kettle', district: 'red-tape-flats', wants: { item: 'glowdust', qty: 3 }, gives: { type: 'weapon', weapon: 'shotgun' } },
    { id: 'kettle-smg', npc: 'kettle', district: 'red-tape-flats', wants: { item: 'redstatic', qty: 3 }, gives: { type: 'weapon', weapon: 'smg' } },
    { id: 'kettle-rail', npc: 'kettle', district: 'red-tape-flats', wants: { item: 'voidhoney', qty: 2 }, gives: { type: 'weapon', weapon: 'railrifle' } },
    { id: 'kettle-launcher', npc: 'kettle', district: 'red-tape-flats', wants: { item: 'voidhoney', qty: 3 }, gives: { type: 'weapon', weapon: 'launcher' } },
    { id: 'kettle-shells', npc: 'kettle', district: 'red-tape-flats', wants: { item: 'lowg', qty: 3 }, gives: { type: 'ammo', ammo: 'shells', n: 24 } },
    { id: 'kettle-rounds', npc: 'kettle', district: 'red-tape-flats', wants: { item: 'glowdust', qty: 2 }, gives: { type: 'ammo', ammo: 'rounds', n: 60 } },
    { id: 'kettle-frags', npc: 'kettle', district: 'red-tape-flats', wants: { item: 'redstatic', qty: 2 }, gives: { type: 'ammo', ammo: 'grenades', n: 4 } },
    { id: 'saltblood-backup', npc: 'saltblood', district: 'red-tape-flats', wants: { item: 'glowdust', qty: 4 }, gives: { type: 'backup', faction: 'saltblood', n: 3, secs: 120 } },
    { id: 'dorsey-one', npc: 'dorsey', district: 'olympus-row', wants: { item: 'glowdust', qty: 2 }, gives: { type: 'wanted', clear: 1 } },
    { id: 'dorsey-two', npc: 'dorsey', district: 'olympus-row', wants: { item: 'voidhoney', qty: 1 }, gives: { type: 'wanted', clear: 2 } },
    { id: 'whisper-heist', npc: 'whisper', district: 'olympus-row', wants: { item: 'glowdust', qty: 3 }, gives: { type: 'tip', kind: 'heist', target: 'First Junction Trust HQ', district: 'olympus-row', at: [-4, -470], text: 'First Junction Trust HQ swaps vault crews at shift change. The loading-dock camera loops every forty seconds.' } },
    { id: 'whisper-burglary', npc: 'whisper', district: 'olympus-row', wants: { item: 'lowg', qty: 4 }, gives: { type: 'tip', kind: 'burglary', target: 'Voss House', district: 'helios-heights', at: [292, 62], text: 'The Vosses are off-world till the weekend. The garden-dome door on Voss House has a busted maglock.' } },
    { id: 'mabel-rover', npc: 'mabel', district: 'ares-beltway', wants: { item: 'redstatic', qty: 2 }, gives: { type: 'rover' } },
    { id: 'street-flats-shells', npc: 'street-buyer', district: 'red-tape-flats', wants: { item: 'lowg', qty: 2 }, gives: { type: 'ammo', ammo: 'shells', n: 12 } },
    { id: 'street-beltway-rounds', npc: 'street-buyer', district: 'ares-beltway', wants: { item: 'glowdust', qty: 2 }, gives: { type: 'ammo', ammo: 'rounds', n: 30 } },
    { id: 'street-helios-bulk', npc: 'street-buyer', district: 'helios-heights', wants: { item: 'voidhoney', qty: 1 }, gives: { type: 'cash', credits: 520 }, label: 'Bulk buy: 520 cr' }
  ]
};
const NPCS = {}, OFFERS = new Map(); let npcVer = 0, backupUntil = 0, barterSrc = 'default';
const noted = new Set(); const note = (k, m) => { if (!noted.has(k)) { noted.add(k); console.info('[contraband] ' + m); } };
const ALIAS = { glow_dust: 'glowdust', 'glow-dust': 'glowdust' };
const itemId = x => (x == null ? null : ALIAS[x] || x);
const distId = x => (x ? String(x).replace(/_/g, '-') : null);
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ICONS = { glow_dust_brick: '🧱', contraband: '📦', hive_resin: '🟠', salvage: '🔩', hot_plates: '🪪', cold_cell: '🔋', colsec_tag: '🏷️', ledger_chip: '💾', lungful: '🥫', red_dust_whiskey: '🥃', medkit: '🩹', ration_paste: '🥣' };
const NO_STOCK = new Set(['credits', 'medkit', 'ration_paste', 'contraband']); // loot / mission cargo, not sold by Blue
// Steve's items[]: per-district base_value feeds buyerPrice; Blue stocks them at 60% of the Flats value
function registerItems(list, src) {
  let n = 0; for (const it of Array.isArray(list) ? list : []) {
    if (!it?.id || it.kind === 'currency' || it.id === 'credits') continue; const id = itemId(it.id), bv = it.base_value || {};
    const vals = {}; for (const k in bv) if (Number.isFinite(+bv[k])) vals[distId(k)] = +bv[k]; const flats = vals['red-tape-flats'] ?? Object.values(vals)[0];
    if (!Number.isFinite(flats)) continue;
    const prev = ITEMS[id], mean = Object.values(vals).reduce((a, b) => a + b, 0) / Object.keys(vals).length;
    ITEMS[id] = { name: prev?.name || it.name || id, icon: prev?.icon || ICONS[it.id] || (it.contraband ? '📦' : '🧰'), blurb: prev?.blurb || it.desc || '',
      supplier: prev?.supplier ?? Math.max(1, Math.round(flats * 0.6)), base: Math.round(mean), max: prev?.max ?? Math.max(1, Math.min(16, Math.round(600 / flats))),
      spoilPerMin: prev?.spoilPerMin ?? (it.contraband ? 0.3 : 0), contraband: it.contraband !== false, heat: it.heat ?? 1, vals, stock: prev ? true : !NO_STOCK.has(it.id), src };
    n++;
  }
  return n;
}
function normOffer(o, src) {
  if (!o || !o.id || !o.gives || !o.gives.type) return null;
  const raw = Array.isArray(o.wants) ? o.wants : typeof o.wants === 'string' ? [{ item: o.wants, qty: o.qty || 1 }] : o.wants ? [o.wants] : [];
  const wants = []; for (const w of raw) { const it = itemId(w?.item); if (!it) continue; if (it !== 'credits' && !ITEMS[it]) { note('item:' + o.id, `offer ${o.id} wants unknown item "${w.item}", skipped`); return null; } wants.push({ item: it, qty: Math.max(1, clampQ(w.qty) || 1) }); }
  let npc = o.npc || 'street-buyer'; const d = distId(o.district);
  if (!NPCS[npc] && npc !== 'street-buyer') { const id = slug(npc); if (!NPCS[id] || NPCS[id].src !== src) NPCS[id] = { id, name: o.npc, role: o.venue || 'contact', district: d, at: Array.isArray(o.location) ? o.location : null, line: o.lines?.offer || '', src }; else if (!NPCS[id].at && Array.isArray(o.location)) NPCS[id].at = o.location; npc = id; }
  return { ...o, npc, npcLabel: o.npc, district: d, wants, src };
}
// npc beacon spots: the offer location, nudged off Blue, buyer corners and other contacts so every ring is reachable
let spotCache = { v: -1, m: {} };
function npcSpots() {
  if (spotCache.v === npcVer) return spotCache.m; const taken = [SUPPLIER.at, ...SPOTS.map(s => s.at)], m = {};
  for (const n of Object.values(NPCS)) { if (!Array.isArray(n.at)) continue; let [x, z] = n.at, k = 0;
    while (k < 12 && taken.some(t => Math.hypot(t[0] - x, t[1] - z) < 2 * R_SPOT + 1)) { k++; x = n.at[0] + 12 * Math.cos(k * 1.2) * Math.ceil(k / 5); z = n.at[1] + 12 * Math.sin(k * 1.2) * Math.ceil(k / 5); }
    taken.push([x, z]); m[n.id] = [Math.round(x), Math.round(z)]; }
  spotCache = { v: npcVer, m }; return m;
}
function loadBarter(data, src, replace = false) {
  if (!data || typeof data !== 'object') return 0;
  const its = registerItems(data.items, src);
  const offers = [...(Array.isArray(data.offers) ? data.offers : []), ...(Array.isArray(data.trades) ? data.trades : []), ...(Array.isArray(data.favors) ? data.favors : [])];
  if (replace && offers.length) { for (const [k, o] of OFFERS) if (o.src === 'default') OFFERS.delete(k); for (const k in NPCS) if (NPCS[k].src === 'default') delete NPCS[k]; }
  let n = 0; for (const [id, v] of Object.entries(data.npcs || {})) if (v && v.name) { NPCS[id] = { id, ...v, at: v.at || v.location || null, district: distId(v.district), src }; n++; }
  for (const o of offers) { if (OFFERS.get(o?.id)?.src === 'registered') continue; const x = normOffer(o, src); if (x) { OFFERS.set(x.id, x); n++; } }
  npcVer++; return n + its;
}
loadBarter(DEFAULT_BARTER, 'default');
fetch(new URL('./barter.json', import.meta.url), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)
  .then(d => { if (d && loadBarter(d, 'barter.json', true)) { barterSrc = 'barter.json'; emit({ type: 'barter-loaded', offers: OFFERS.size }); render(); } else note('json', 'mars/barter.json missing or empty; using built-in barter defaults'); })
  .catch(e => note('json', 'mars/barter.json failed to load (' + e.message + '); using built-in barter defaults'));
function registerOffer(def) {
  const o = normOffer(def, 'registered'); if (!o) throw new Error('registerOffer({ id, npc, district, wants:{ item, qty } | [{ item, qty }], gives:{ type, ... }, onTrade(ctx) })');
  if (def.npcDef?.name) NPCS[o.npc] = { id: o.npc, ...def.npcDef, district: distId(def.npcDef.district) || o.district, src: 'registered' }; // optional beacon ({ name, district, at, line })
  OFFERS.set(o.id, o); npcVer++; render(); return o.id;
}
const ROVER_UPS = ['turret2', 'turret3', 'rail', 'rockets', 'torch', 'emp'];
const nextRoverUp = () => { const g = game(); return g && ROVER_UPS.map(id => g.shopItem(id)).find(it => it && !it.owned && it.ok !== false) || null; };
// run the game's own shop purchase for free (credit the price, buy, keep credits level): unlocks + starting ammo + save
function grantShop(id) {
  const g = game(), P = g?.progress, it = g?.shopItem(id); if (!P || !it) return { ok: false, msg: 'Not available.' };
  if (it.owned) return { ok: false, msg: `You already own a ${it.name}.` };
  const before = P.credits, price = it.price || 0; P.credits += price; const r = g.buy(id);
  if (P.credits !== before) { P.credits = before; g.save(); return { ok: false, msg: r?.msg || 'No deal.' }; } // not granted: undo the loan
  return { ok: true, msg: `${it.name}: yours.`, name: it.name };
}
function addAmmo(t, n) { const g = game(), P = g?.progress; if (!P || !t) return 0; const cap = g.ammoCap?.(t) ?? 999, b = P.inv[t] || 0; P.inv[t] = Math.min(cap, b + (n | 0)); return P.inv[t] - b; }
const AMMO_NAME = { shells: 'shells', rounds: 'SMG rounds', slugs: 'rail slugs', grenades: 'frags' };
const AMMO_GUN = { shells: 'shotgun', rounds: 'smg', slugs: 'railrifle', grenades: 'launcher' };
const ownsGun = id => !!game()?.shopItem(id)?.owned;
const heistApi = () => window.heist || window.SSX?.heist || app()?.heist || null;
const garageApi = () => window.SSX?.garage || null;
const missionDone = id => !!game()?.progress?.quests?.[id]?.everDone;
function repOf(f) { const R = window.SSX?.rep; try { if (typeof R?.get === 'function') return R.get(f); if (typeof R === 'function') return R(f); } catch (e) { /* ignore */ } return null; }
const nameOf = id => (id === 'credits' ? 'cr' : ITEMS[id]?.name || id);
const haveAll = o => o.wants.every(w => w.item === 'credits' ? credits() >= w.qty : qtyOf(w.item) >= w.qty);
// why an offer can't be taken right now ('' = available)
function blocker(o) {
  const g = game(), w = world(), v = o.gives, t = v.type, now = Date.now(), last = S.used?.[o.id];
  if (o.available && !o.available(ctxFor(o))) return 'Not right now.';
  if (last && o.repeatable === false) return 'Already done.';
  if (last && o.cooldownSec && now - last < o.cooldownSec * 1000) return `Back in ${Math.ceil((o.cooldownSec * 1000 - (now - last)) / 60000)} min.`;
  if (o.requires?.wanted_min && (w?.wanted || 0) < o.requires.wanted_min) return `Only when you\u2019re wanted (${o.requires.wanted_min}\u2605+).`;
  if (o.requires?.driving_stolen && !surf()?.info?.stolen) return 'Roll up in a hot ride.';
  for (const m of o.rep?.missions_done || []) if (!missionDone(m)) return `Story locked: finish ${m} first.`;
  for (const f of o.rep?.factions || []) { const r = repOf(f.faction); if (r == null) { note('rep', 'no SSX.rep module: barter rep gates are skipped'); continue; } if (r < (f.min || 0)) return `Need ${f.min} rep with ${f.faction}.`; }
  if (t === 'weapon') { const it = g?.shopItem(v.weaponId || v.weapon); if (!it) return 'Unknown weapon.'; if (it.owned) return 'Already own it.'; }
  if (t === 'ammo_bundle' && v.onlyOwned && !(v.ammo || []).some(a => ownsGun(AMMO_GUN[a.ammoId]))) return 'You don\u2019t own a gun for that.';
  if ((t === 'wanted' || t === 'wanted_clear') && !((w?.wanted || 0) > 0)) return 'You\u2019re not wanted.';
  if (t === 'rover' && !v.upgrade && !nextRoverUp()) return 'Rover\u2019s maxed.';
  if (t === 'rover' && v.upgrade && g?.shopItem(v.upgrade)?.owned) return 'Already fitted.';
  if ((t === 'garage_upgrade' || t === 'garage_vehicle') && !garageApi()) { note('garage', 'SSX.garage (dealership/garage module) not loaded: garage_upgrade/garage_vehicle offers are unavailable'); return 'Needs the garage (not in this build).'; }
  if (t === 'heist_tip' && !heistApi()?.applyTip) { note('heist', 'heist module (window.heist / SSX.heist) not loaded: heist_tip offers are unavailable'); return 'No heist crew in this build.'; }
  if ((t === 'backup' || t === 'gang_backup') && backupUntil > now) return 'Crew\u2019s already out.';
  if (t === 'unlock' && v.flag && g?.flag(v.flag)) return 'Already done.';
  if (t === 'unlock_job' && v.missionId && g?.flag('unlock:' + v.missionId)) return 'Already done.';
  if (t === 'chop' && !surf()?.info?.stolen) return 'Roll up in a hot ride.';
  if (t === 'item' && ITEMS[itemId(v.item)] && room(itemId(v.item)) < (v.qty || 1)) return 'No room in your pockets.';
  for (const x of o.wants) { if (x.item === 'credits' ? credits() < x.qty : qtyOf(x.item) < x.qty) return `Need ${x.qty} ${nameOf(x.item)}.`; }
  return '';
}
function giveLabel(o) {
  if (o.label) return o.label; const v = o.gives, g = game();
  switch (v.type) {
    case 'weapon': return g?.shopItem(v.weaponId || v.weapon)?.name || v.weaponId || v.weapon;
    case 'ammo': return `${v.n || 12} ${AMMO_NAME[v.ammo] || v.ammo}`;
    case 'ammo_bundle': return (v.ammo || []).map(a => `${a.qty} ${AMMO_NAME[a.ammoId] || a.ammoId}`).join(' + ');
    case 'cash': return `${v.credits} cr`;
    case 'wanted': case 'wanted_clear': return `Lose ${v.clear || v.stars || 1}\u2605`;
    case 'rover': { const it = v.upgrade ? g?.shopItem(v.upgrade) : nextRoverUp(); return `Rover: ${it?.name || 'upgrade'}`; }
    case 'tip': return v.kind === 'burglary' ? 'Burglary tip' : 'Heist tip';
    case 'heist_tip': return `Heist tip: ${v.tip?.type === 'safe' ? 'easier safe' : v.tip?.type || 'intel'} (${v.heistId})`;
    case 'garage_upgrade': return `Garage: ${g?.shopItem(v.upgradeId)?.name || v.upgradeId}`;
    case 'garage_vehicle': return `${v.opts?.noPlates || v.noPlates ? 'No-plates ' : ''}${v.vehicleId}`;
    case 'backup': case 'gang_backup': return `${v.count || v.n || 3} ${v.faction || 'gang'} backup (${Math.round((v.durationSec || v.secs || 120) / 60)} min)`;
    case 'venue_access': return `Entry: ${String(v.venueId).replace(/_/g, ' ')} (${Math.round((v.durationSec || 900) / 60)} min)`;
    case 'raid_tip': return 'Early warning on the next ColSec raid';
    case 'unlock': return v.text || 'A job';
    case 'unlock_job': return `Job: ${v.missionId}`;
    case 'chop': return 'Free chop of your hot ride';
    case 'item': return `${v.qty || 1} ${nameOf(itemId(v.item))}`;
    default: return v.text || 'A favor';
  }
}
function bark(o, key) { const line = o.lines?.[key]; try { const b = window.SSX?.bark; if (typeof b === 'function') b(o.npcLabel || NPCS[o.npc]?.name || o.npc, 'barter_' + key, { line }); } catch (e) { /* bark is optional */ } return line || ''; }
function ctxFor(o, extra = {}) { return { offer: o, npc: NPCS[o.npc] || null, district: o.district || curDistrict(), wants: o.wants.map(w => ({ ...w })), app: app(), game: game(), world: world(), stash: stash(), toast, grantShop, addAmmo, bark: k => bark(o, k), ...extra }; }
const fire = (n, detail) => { try { window.dispatchEvent(new CustomEvent(n, { detail })); } catch (e) { /* old browsers */ } };
function applyGive(o) {
  const v = o.gives, g = game(), w = world(), from = NPCS[o.npc]?.name || o.npcLabel || o.npc;
  switch (v.type) {
    case 'weapon': { const r = grantShop(v.weaponId || v.weapon); if (r.ok && v.ammo?.ammoId) { const k = addAmmo(v.ammo.ammoId, v.ammo.qty); if (k) r.msg += ` +${k} ${AMMO_NAME[v.ammo.ammoId] || v.ammo.ammoId}.`; } if (r.ok) g?.save?.(); return r; }
    case 'ammo': { if (!g?.progress) return { ok: false, msg: 'Not in game.' }; const k = addAmmo(v.ammo, v.n || 12); g.save(); return { ok: true, msg: `+${k} ${AMMO_NAME[v.ammo] || v.ammo} (${g.progress.inv[v.ammo]}).` }; }
    case 'ammo_bundle': { if (!g?.progress) return { ok: false, msg: 'Not in game.' }; const got = [];
      for (const a of v.ammo || []) { if (v.onlyOwned && !ownsGun(AMMO_GUN[a.ammoId])) continue; const k = addAmmo(a.ammoId, a.qty); if (k) got.push(`+${k} ${AMMO_NAME[a.ammoId] || a.ammoId}`); }
      g.save(); return got.length ? { ok: true, msg: got.join(', ') + '.' } : { ok: false, msg: 'You\u2019re topped up already.' }; }
    case 'cash': g?.reward?.(0, v.credits || 0); return { ok: true, msg: `+${v.credits} cr.` };
    case 'wanted': case 'wanted_clear': { const n = w?.wanted || 0, to = Math.max(0, n - (v.clear || v.stars || 1)); w?.setWanted?.(to); return { ok: true, msg: to ? `Heat down to ${to}\u2605.` : 'Your record\u2019s clean. For now.' }; }
    case 'rover': { const it = v.upgrade ? g?.shopItem(v.upgrade) : nextRoverUp(); if (!it) return { ok: false, msg: 'Rover\u2019s maxed.' }; return grantShop(it.id); }
    case 'garage_upgrade': { const G = garageApi(); if (!G?.grantUpgrade) { note('garage', 'SSX.garage missing'); return { ok: false, msg: 'Needs the garage.' }; }
      let r; try { r = G.grantUpgrade(v.vehicle || 'current', v.upgradeId, v.levels || 1); } catch (e) { r = { ok: false, msg: e.message }; }
      if (r && r.ok === false && g?.shopItem(v.upgradeId) && !g.shopItem(v.upgradeId).owned) { const s = grantShop(v.upgradeId); if (s.ok) return s; } // game.js SHOP rover upgrade ids (turret2, roverarmor)
      return r && r.ok !== false ? { ok: true, msg: r.msg || `${v.upgradeId} fitted.` } : { ok: false, msg: r?.msg || 'Upgrade didn\u2019t take.' }; }
    case 'garage_vehicle': { const G = garageApi(); if (!G?.grantVehicle) { note('garage', 'SSX.garage missing'); return { ok: false, msg: 'Needs the garage.' }; }
      let r; try { r = G.grantVehicle(v.vehicleId, { ...(v.opts || {}), ...(v.opts?.noPlates || v.noPlates ? { noPlates: true } : {}) }); } catch (e) { r = { ok: false, msg: e.message }; }
      return r && r.ok !== false ? { ok: true, msg: r.msg || `${v.vehicleId} is yours.` } : { ok: false, msg: r?.msg || 'No ride today.' }; }
    case 'heist_tip': case 'tip': { const H = heistApi(); let out = null;
      if (v.heistId) { if (!H?.applyTip) { note('heist', 'heist module missing'); return { ok: false, msg: 'No heist crew in this build.' }; }
        try { out = H.applyTip(v.heistId, v.tip || { type: v.kind }); } catch (e) { console.warn('[contraband] applyTip', e); }
        if (!out) return { ok: false, msg: `${from}: that job isn\u2019t on anyone\u2019s board yet. Keep your stuff.` }; }
      const tip = { kind: v.kind || 'heist', heistId: v.heistId || null, tip: v.tip || null, target: v.target || v.heistId || '', district: distId(v.district) || o.district, text: v.text || '', at: v.at || null, from, t: Date.now(), applied: out };
      (S.tips ||= []).push(tip); if (!v.heistId) { try { window.SSX?.heists?.addTip?.(tip); } catch (e) { /* optional */ } }
      fire('ssx:tip', tip); emit({ type: 'tip', tip }); return { ok: true, msg: tip.text ? `📝 ${tip.text}` : `📝 ${giveLabel(o)}.`, tip }; }
    case 'backup': case 'gang_backup': { const secs = v.durationSec || v.secs || 120, b = { faction: v.faction || 'saltblood', count: v.count || v.n || 3, durationSec: secs, armed: v.armed, vehicle: v.vehicle, from };
      let spawned = false; const S2 = window.SSX?.gang?.spawnBackup; if (typeof S2 === 'function') { try { spawned = S2(b) !== false; } catch (e) { console.warn('[contraband] spawnBackup', e); } } else note('gang', 'SSX.gang.spawnBackup not loaded: backup gives street cover only (no escorts spawned)');
      backupUntil = Date.now() + secs * 1000; if (v.type === 'backup' && (w?.wanted || 0) > 0) w.setWanted(w.wanted - 1); // default crew jams ColSec for you
      fire('ssx:backup', { ...b, spawned }); emit({ type: 'backup', ...b, spawned });
      return { ok: true, msg: `🩸 ${b.count} ${b.faction} ride with you for ${Math.round(secs / 60)} min${spawned ? '' : ' (street cover)'}: no narcs, fewer eyes on your deals.` }; }
    case 'venue_access': { const until = Date.now() + (v.durationSec || 900) * 1000; (S.access ||= {})[v.venueId] = until; g?.setFlag?.('venue:' + v.venueId);
      fire('ssx:venue', { venueId: v.venueId, until, ...v }); return { ok: true, msg: `🎟️ You\u2019re on the list at ${String(v.venueId).replace(/_/g, ' ')} for ${Math.round((v.durationSec || 900) / 60)} min.` }; }
    case 'raid_tip': { S.raidTip = { from, warnSec: v.warnSec || 90, t: Date.now() }; try { window.SSX?.raids?.warn?.(S.raidTip); } catch (e) { /* optional */ } fire('ssx:raidtip', S.raidTip); return { ok: true, msg: `📻 ${from} will ring you ${v.warnSec || 90} s before the next ColSec raid.` }; }
    case 'unlock': if (v.flag) g?.setFlag?.(v.flag); fire('ssx:unlock', { flag: v.flag, offer: o.id }); return { ok: true, msg: v.text || 'Deal. You\u2019re in.' };
    case 'unlock_job': { g?.setFlag?.('unlock:' + v.missionId); try { window.SSX?.unlockMission?.(v.missionId); } catch (e) { /* optional */ } fire('ssx:unlock', { missionId: v.missionId, chain: v.chain, offer: o.id }); return { ok: true, msg: `📋 New job: ${v.missionId}.` }; }
    case 'chop': { const pay = v.payoutCredits || 0; if (pay) g?.reward?.(0, pay); const got = []; for (const b of v.bonusItems || []) { const id = itemId(b.item); if (ITEMS[id]) { const r = buy(id, b.qty || 1, { free: true }); if (r.ok) got.push(`${r.qty} ${ITEMS[id].name}`); } }
      if (v.clearsVehicleHeat && (w?.wanted || 0) > 0) w.setWanted(w.wanted - 1); fire('ssx:chop', { offer: o.id, ...v }); return { ok: true, msg: `🔧 Ride\u2019s in pieces.${pay ? ` +${pay} cr.` : ''}${got.length ? ' +' + got.join(', ') + '.' : ''} Walk away.` }; }
    case 'item': { const id = itemId(v.item); if (!ITEMS[id]) return { ok: false, msg: 'Unknown item.' }; const r = buy(id, v.qty || 1, { free: true }); return r.ok ? { ok: true, msg: `+${r.qty} ${ITEMS[id].name}.` } : r; }
    default: return { ok: true, msg: '' };
  }
}
/** Trade product for an offer. item/qty may be null (use the offer's wants). */
function barter(item, qty, offerId, opts = {}) {
  const o = OFFERS.get(offerId); if (!o) return { ok: false, msg: 'No such offer.' };
  const it = itemId(item); const main = o.wants.find(w => w.item !== 'credits') || o.wants[0] || null;
  if (it && !o.wants.some(w => w.item === it)) return { ok: false, msg: `They want ${o.wants.map(w => `${w.qty} ${nameOf(w.item)}`).join(' + ')}.` };
  if (it && qty != null) { const w = o.wants.find(x => x.item === it); if (clampQ(qty) < w.qty) return { ok: false, msg: `They want ${w.qty}.` }; }
  if (opts.district && o.district && distId(opts.district) !== o.district) return { ok: false, msg: 'That offer is in another district.' };
  const why = blocker(o); if (why) { bark(o, 'decline'); return { ok: false, msg: why }; }
  const fresh = {}; for (const w of o.wants) if (w.item !== 'credits') fresh[w.item] = S.stash[w.item]?.fresh ?? 1;
  const take = () => { for (const w of o.wants) { if (w.item === 'credits') { if (!game()?.spend?.(w.qty)) return false; continue; } const s = S.stash[w.item]; s.qty -= w.qty; if (s.qty <= 0) delete S.stash[w.item]; } return true; };
  const refund = () => { for (const w of o.wants) { if (w.item === 'credits') { game()?.reward?.(0, w.qty); continue; } const s = S.stash[w.item] || (S.stash[w.item] = { qty: 0, fresh: fresh[w.item] }); s.qty += w.qty; } };
  if (!haveAll(o) || !take()) return { ok: false, msg: 'You\u2019re short.' };
  const ws = world(), rk = o.risk || {};
  if (rk.bust_chance && Math.random() < rk.bust_chance) { // the deal goes bad: wants are lost, stars go up
    const stars = Math.min(5, (ws?.wanted || 0) + (rk.wanted_on_bust || 1)); ws?.setWanted?.(stars, `barter with ${o.npcLabel || o.npc} went bad`); S.stats.busts++;
    changed({ type: 'bust', offer: o.id, stars }); return { ok: false, bust: true, msg: `🚨 ${bark(o, 'caught') || 'It was a setup.'} ${'★'.repeat(stars)}` };
  }
  let r = o.gives.type === 'custom' ? { ok: true, msg: '' } : applyGive(o);
  if (r.ok && typeof o.onTrade === 'function') {
    try { const x = o.onTrade(ctxFor(o, { item: it || main?.item || null, qty: qty == null ? main?.qty ?? 0 : clampQ(qty), result: r })); if (x === false || x?.ok === false) r = { ok: false, msg: x?.msg || 'Deal fell through.' }; else if (x?.msg) r = { ...r, msg: x.msg }; }
    catch (e) { console.warn('onTrade', o.id, e); r = { ok: false, msg: 'Deal fell through.' }; }
  }
  if (!r.ok) { refund(); changed(); return { ok: false, msg: r.msg }; }
  if (rk.wanted_on_trade) ws?.setWanted?.(Math.min(5, (ws.wanted || 0) + rk.wanted_on_trade), 'armed crew in tow');
  (S.used ||= {})[o.id] = Date.now(); S.stats.bartered = (S.stats.bartered || 0) + 1;
  changed({ type: 'barter', offer: o.id, item: main?.item || null, qty: main?.qty || 0, gives: o.gives.type });
  const line = bark(o, 'accept');
  return { ok: true, offer: o.id, gives: { ...o.gives }, msg: `${line || `${NPCS[o.npc]?.name || o.npcLabel || 'Buyer'}: deal.`} ${r.msg || giveLabel(o)}`.trim(), ...(r.tip ? { tip: r.tip } : {}) };
}
const pubOffer = o => { const b = blocker(o); const m = o.wants.find(w => w.item !== 'credits') || o.wants[0] || { item: null, qty: 0 };
  return { id: o.id, npc: o.npc, npcName: NPCS[o.npc]?.name || o.npcLabel || (o.npc === 'street-buyer' ? 'Street buyer' : o.npc), district: o.district || null, wants: { ...m }, wantsAll: o.wants.map(w => ({ ...w })), gives: { ...o.gives }, label: giveLabel(o), available: !b, why: b, src: o.src, repeatable: o.repeatable !== false, cooldownSec: o.cooldownSec || 0 }; };
function barterOffers(d = curDistrict(), npc) { const dd = distId(d); return [...OFFERS.values()].filter(o => (!dd || !o.district || o.district === dd) && (!npc || o.npc === npc)).map(pubOffer); }
const hasAccess = id => (S.access?.[id] || 0) > Date.now();

// ---------- world presence: beacons for Blue and the buyers, buyer encounters ----------
let G = null, beacons = [], buyers = new Map(), near = null, lastBusted = null, lastDeaths = null, lastT = performance.now();
function labelTex(text, col) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const w = x.measureText(text).width + 26;
  x.fillStyle = 'rgba(0,0,0,0.8)'; x.fillRect(128 - w / 2, 8, w, 48); x.fillStyle = col; x.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function build(scene, h) {
  G = new THREE.Group(); G.name = 'contraband'; scene.add(G); beacons = [];
  const cx = h.info.colony.x, cz = h.info.colony.z, y = h.info.y - 1.7;
  const add = (at, col, text, kind, ref) => {
    const g = new THREE.Group(); g.position.set(cx + at[0], y, cz + at[1]);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 15; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(kind === 'sup' ? R_SUP - 0.4 : R_SPOT - 0.4, kind === 'sup' ? R_SUP : R_SPOT, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, '#' + col.toString(16).padStart(6, '0')), transparent: true, depthWrite: false })); sp.position.y = 3.2; sp.scale.set(3.6, 0.9, 1); g.add(sp);
    G.add(g); beacons.push({ g, ring, kind, ref, at, ground: false });
  };
  add(SUPPLIER.at, 0x3aa8ff, '💊 ' + SUPPLIER.label, 'sup', SUPPLIER);
  SPOTS.forEach((s, i) => add(s.at, 0xffffff, '💲 BUYER', 'buyer', i));
  const sp = npcSpots(); for (const n of Object.values(NPCS)) if (sp[n.id]) add(sp[n.id], 0xffb020, '🤝 ' + String(n.name).toUpperCase(), 'npc', n.id);
  G.userData.ver = npcVer;
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); } G = null; beacons = []; }
function buyerAt(i) { // one buyer per corner; cold for a minute after a deal
  let b = buyers.get(i); const now = Date.now(); if (b && b.cold > now) return null;
  if (!b || b.done) { const D = districtList()[SPOTS[i].d]; const big = used() > 10 ? 0.04 : 0; const undercover = Math.random() < D.undercover + big;
    b = { name: NAMES[(i * 7 + (now / 60000 | 0)) % NAMES.length], undercover, line: undercover && Math.random() < 0.6 ? NARC[i % NARC.length] : LINES[(i + (now / 30000 | 0)) % LINES.length], cold: 0, done: false }; buyers.set(i, b); }
  return b;
}
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now(), dt = Math.min(1, (now - lastT) / 1000); if (now - lastT < 200) return; lastT = now;
  const st = app()?.state, h = here(), s = surf();
  // spoilage while you're out on a surface (real time, not while paused in the menus/flying)
  if (st?.onSurface && used() > 0) { for (const id in S.stash) S.stash[id].fresh = Math.max(0, S.stash[id].fresh - (ITEMS[id]?.spoilPerMin || 0) / 100 * dt / 60); if (Math.random() < 0.05) save(); }
  // busted or downed with product on you
  const P = game()?.progress?.stats;
  if (P) { if (lastBusted !== null && P.busted > lastBusted && used() > 0) { const n = used(); S.stash = {}; changed({ type: 'confiscate', why: 'busted', qty: n }); setTimeout(() => toast(`🚨 ColSec bagged your stash (${n} units).`, 3500), 2600); }
    if (lastDeaths !== null && P.deaths > lastDeaths && used() > 0) { let n = 0; for (const id in S.stash) { const k = Math.ceil(S.stash[id].qty / 2); n += k; S.stash[id].qty -= k; if (S.stash[id].qty <= 0) delete S.stash[id]; } changed({ type: 'confiscate', why: 'killed', qty: n }); setTimeout(() => toast(`🩺 The med-evac crew pocketed ${n} units of your stash.`, 3500), 3000); }
    lastBusted = P.busted; lastDeaths = P.deaths; }
  if (!h || !st?.onSurface || st.transitioning) { if (G && (!s || G.parent !== s.scene || !h)) teardown(); setNear(null); return; }
  if (!G || G.parent !== s.scene || G.userData.ver !== npcVer) { teardown(); build(s.scene, h); }
  const i = h.info, slow = !i.driving || Math.abs(i.speed) < 3; let nb = null;
  for (const b of beacons) {
    const d = Math.hypot(h.x - b.at[0], h.z - b.at[1]);
    if (!b.ground && d < 40 && i.grounded !== false && !i.driving) { b.g.position.y = i.y - 1.7; b.ground = true; } // settle on the real ground once you're close
    b.ring.material.opacity = 0.35 + 0.25 * Math.sin(now / 300);
    if (b.kind === 'buyer') b.g.visible = !(buyers.get(b.ref)?.cold > Date.now());
    if (b.kind === 'buyer' && !b.g.visible) continue;
    if (!i.inside && slow && d < (b.kind === 'sup' ? R_SUP : R_SPOT) && (!nb || d < nb.d)) nb = { d, kind: b.kind, ref: b.ref };

  }
  setNear(nb);
}

// ---------- UI (high contrast: black buttons, white text, 44px+ targets, window.__onTap) ----------
const css = `
#cbBtn{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));top:42%;display:none;min-height:52px;min-width:120px;padding:0 16px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 15px system-ui,sans-serif;touch-action:manipulation}
body.surface #cbBtn.show{display:block} body.indoors #cbBtn{display:none!important}
#cbPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
#cbPanel.show{display:flex}
#cbPanel .wrap{width:min(460px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:14px;border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-sizing:border-box}
#cbBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch} #cbPanel .msg,#cbPanel .foot{flex:none}
#cbPanel h2{margin:0 0 2px;font-size:18px} #cbPanel .sub{margin:0 0 8px;font-size:13px;color:#fff;opacity:.85} #cbPanel .say{margin:6px 0 10px;padding:8px 10px;border-left:3px solid #3aa8ff;font-style:italic}
#cbPanel .it{display:grid;grid-template-columns:1fr auto;gap:6px 8px;align-items:center;padding:9px 0;border-top:1px solid rgba(255,255,255,.3)}
#cbPanel .it b{font-size:15px} #cbPanel .it small{display:block;font-size:12px;opacity:.85} #cbPanel .acts{display:flex;gap:6px;grid-column:1/-1}
#cbPanel button{flex:1;min-height:46px;min-width:64px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
#cbPanel button:disabled{opacity:.35} #cbPanel button.on{background:#fff;color:#000}
#cbPanel .msg{min-height:1.3em;margin:8px 0;font-weight:700;color:#fff} #cbPanel .foot{display:flex;gap:8px;margin-top:6px}
`;
let btn, panel, body, msgEl, mode = 'stash', lastMsg = '', lastTouchAct = 0;
// window.__onTap (iOS-safe pointer binding from index.html). A touch tap re-renders the panel under the finger, so the
// browser's follow-up synthetic click can land on a brand-new button: swallow clicks for 700 ms after any touch tap.
function tap(el, fn) {
  const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouchAct < 700) return; if (e?.type === 'pointerup') lastTouchAct = n; fn(e); };
  (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g);
}
// Phone hotkey button on the shared #ssxDock (v7.5.3: owned by mars/turf.js, right edge above Jump/Run, styles in
// #ssxDockCss). We never create a dock: if #ssxDock isn't on the page yet we wait for it (turf may load after us) and
// attach once it appears; with no dock at all this adds nothing. Bound with window.__onTap.
function dockButton(id, label, aria, order, fn) {
  const attach = () => {
    const d = document.getElementById('ssxDock'); if (!d) return false;
    if (document.getElementById(id)) return true;
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria); b.style.order = String(order); d.appendChild(b); tap(b, fn); return true;
  };
  if (attach()) return;
  try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no observer: no dock button */ }
}
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  btn = document.createElement('button'); btn.id = 'cbBtn'; btn.type = 'button'; document.body.appendChild(btn);
  panel = document.createElement('div'); panel.id = 'cbPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Stash"><div id="cbBody"></div><div class="msg" id="cbMsg"></div><div class="foot"><button id="cbClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); body = panel.querySelector('#cbBody'); msgEl = panel.querySelector('#cbMsg');
  tap(btn, () => open(modeFor()));
  tap(panel.querySelector('#cbClose'), close);
  dockButton('dockStash', '🎒\nStash', 'Stash (B)', 1, () => panel.classList.contains('show') ? close() : open(modeFor()));
  addEventListener('keydown', e => { if (e.code !== 'KeyB' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return; if (!app()?.state?.onSurface) return; panel.classList.contains('show') ? close() : open(modeFor()); });
}
function setNear(nb) {
  const k = nb ? nb.kind + nb.ref : '', ok = near ? near.kind + near.ref : ''; near = nb; if (!btn) return;
  if (k === ok && btn.classList.contains('show') === !!nb) return;
  const b = nb?.kind === 'buyer' ? buyerAt(nb.ref) : null; if (nb?.kind === 'buyer' && !b) { near = null; btn.classList.remove('show'); return; }
  btn.textContent = nb ? (nb.kind === 'sup' ? '💊 Blue' : nb.kind === 'npc' ? '🤝 ' + (NPCS[nb.ref]?.name || 'Trade') : '💲 Deal') : ''; btn.classList.toggle('show', !!nb);
  if (!nb && panel?.classList.contains('show') && mode !== 'stash') { mode = 'stash'; render(); }
}
const modeFor = () => near?.kind === 'sup' ? 'sup' : near?.kind === 'npc' ? 'npc' : near ? 'buyer' : 'stash';
function open(m = 'stash') { ui(); mode = m; lastMsg = m === 'sup' ? 'Blue: Case. Cash. No tasting. Eyes stay brown.' : ''; panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render(); }
function close() { panel?.classList.remove('show'); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function act(a, item, q) {
  let r = null; const n = q === 'all' ? qtyOf(item) : +q;
  if (a === 'buy') { if (!(near?.kind === 'sup')) r = { msg: 'Find Blue in Red Tape Flats first.' }; else r = buy(item, n); }
  else if (a === 'sell') { const b = near?.kind === 'buyer' ? buyerAt(near.ref) : null; if (!b) r = { msg: 'No buyer here.' };
    else { r = sell(item, n, SPOTS[near.ref].d, { risk: true, undercover: b.undercover }); if (r.ok || r.bust) { b.done = true; b.cold = Date.now() + 60000; if (r.bust) { close(); toast(r.msg, 4000); setNear(null); return; } } } }
  else if (a === 'trade') { const o = OFFERS.get(item); const okHere = o && near && ((near.kind === 'npc' && o.npc === near.ref) || (near.kind === 'buyer' && o.npc === 'street-buyer' && o.district === SPOTS[near.ref].d));
    if (!okHere) r = { msg: 'Nobody here takes that trade.' };
    else { r = barter(o.wants.item, o.wants.qty, o.id); if (r.ok && near.kind === 'buyer') { const b = buyerAt(near.ref); if (b) { b.done = true; b.cold = Date.now() + 60000; } } if (r.ok) toast('🤝 ' + r.msg, 4000); } }
  else if (a === 'dump') { const k = remove(item); r = { msg: k ? `Dumped ${k} ${ITEMS[item].name} in the dust.` : '' }; }
  lastMsg = r?.msg || ''; render(); if (r?.ok && a === 'sell') toast('💲 ' + r.msg, 2600);
}
function render() {
  if (!panel || !panel.classList.contains('show')) return;
  const h = here(), d = curDistrict(), D = d && districtList()[d], b = mode === 'buyer' && near?.kind === 'buyer' ? buyerAt(near.ref) : null;
  if (mode === 'buyer' && !b) mode = 'stash'; if (mode === 'sup' && near?.kind !== 'sup') mode = 'stash'; if (mode === 'npc' && near?.kind !== 'npc') mode = 'stash';
  const sd = mode === 'buyer' ? SPOTS[near.ref].d : mode === 'npc' ? NPCS[near.ref]?.district || d : d, N = mode === 'npc' ? NPCS[near.ref] : null;
  let head = '';
  if (mode === 'npc') head = `<h2>🤝 ${esc(N?.name || 'Trader')}</h2><p class="sub">${esc(N?.role || 'Barter')} \u00b7 trades product, not credits</p>${N?.line ? `<p class="say">${esc(N.line)}</p>` : ''}`;
  else if (mode === 'sup') head = `<h2>💊 Blue \u00b7 The Blue Room</h2><p class="sub">Red Tape Flats supplier. Prices are per unit.</p>`;
  else if (mode === 'buyer') head = `<h2>💲 ${esc(b.name)} wants to buy</h2><p class="sub">${esc(districtList()[sd].name)} street prices</p><p class="say">\u201c${esc(b.line)}\u201d</p>`;
  else { let where = 'Off Mars. Contraband only moves on Mars.';
    if (h) { const sup = SUPPLIER.at, dx = sup[0] - h.x, dz = sup[1] - h.z, dist = Math.round(Math.hypot(dx, dz)), dir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360 / 45) % 8];
      where = `${D ? D.name : 'Open desert (no buyers)'} \u00b7 Blue is ${dist} m ${dir}. Buyers stand in white beams.`; }
    head = `<h2>🎒 Stash</h2><p class="sub">${esc(where)}</p>`; }
  const cap = used();
  let rows = '';
  for (const id in ITEMS) {
    const I = ITEMS[id], q = qtyOf(id), f = S.stash[id] ? Math.round(S.stash[id].fresh * 100) : null;
    const price = mode === 'sup' ? `${I.supplier} cr` : sd ? `${buyerPrice(id, sd)} cr` : '\u2014', sat = sd ? Math.round((1 - satMult(id, sd)) * 100) : 0;
    let acts = '';
    if (mode === 'sup') { const rm = room(id); acts = `<button data-a="buy" data-i="${id}" data-q="1" ${rm < 1 || credits() < I.supplier ? 'disabled' : ''}>Buy 1</button><button data-a="buy" data-i="${id}" data-q="5" ${rm < 1 || credits() < I.supplier ? 'disabled' : ''}>Buy 5</button>`; }
    else if (mode === 'buyer') acts = `<button data-a="sell" data-i="${id}" data-q="1" ${q < 1 ? 'disabled' : ''}>Sell 1</button><button data-a="sell" data-i="${id}" data-q="all" ${q < 1 ? 'disabled' : ''}>Sell all</button>`;
    else if (q > 0) acts = `<button data-a="dump" data-i="${id}" data-q="all">Dump</button>`;
    if ((mode === 'stash' || mode === 'npc') && q === 0) continue;
    if (mode === 'sup' && I.stock === false) continue;
    if (mode === 'buyer' && (I.contraband === false || (q === 0 && !CORE.includes(id)))) continue;
    if (mode === 'npc') acts = '';
    rows += `<div class="it"><div><b>${I.icon} ${esc(I.name)}</b> \u00d7${q}${f !== null ? ` \u00b7 ${f}% fresh` : ''}<small>${esc(I.blurb)}</small></div><div style="text-align:right"><b>${price}</b>${mode !== 'sup' && sat > 4 ? `<small>flooded \u2212${sat}%</small>` : ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}</div>`;
  }
  let trades = '';
  if (mode === 'npc' || mode === 'buyer') {
    const list = mode === 'npc' ? barterOffers(null, near.ref) : barterOffers(sd, 'street-buyer');
    for (const o of list) { const give = o.wantsAll.map(w => w.item === 'credits' ? `${w.qty} cr` : `${w.qty} ${ITEMS[w.item]?.icon || ''} ${esc(nameOf(w.item))}`).join(' + ') || 'A favor'; trades += `<div class="it"><div><b>${give} \u2192 ${esc(o.label)}</b>${o.why ? `<small>${esc(o.why)}</small>` : ''}</div><div></div><div class="acts"><button data-a="trade" data-i="${esc(o.id)}" data-q="1" ${o.available ? '' : 'disabled'}>Trade</button></div></div>`; }
    if (trades) trades = '<h2 style="font-size:16px;margin:12px 0 2px">🤝 Barter</h2>' + trades;
  }
  if (!rows && mode !== 'npc') rows = '<p class="sub">Empty pockets. Blue sells in Red Tape Flats, about 280 m west of Ares Junction (look for the blue beam).</p>';
  body.innerHTML = head + `<p class="sub">Carrying ${cap}/${CARRY} units \u00b7 💰 ${credits()} cr${backupUntil > Date.now() ? ' \u00b7 🩸 backup' : ''}</p>` + (mode === 'npc' ? trades + rows : rows + trades);
  msgEl.textContent = lastMsg;
  body.querySelectorAll('button[data-a]').forEach(b => tap(b, () => { if (!b.disabled) act(b.dataset.a, b.dataset.i, b.dataset.q); }));
}

// ---------- boot ----------
const API = {
  items: () => Object.entries(ITEMS).map(([id, I]) => ({ id, ...I })),
  districts: () => Object.values(districtList()).map(d => ({ id: d.id, name: d.name, centre: d.centre, r: d.r, mult: d.mult, registered: d.registered })),
  district: curDistrict, districtAt, supplierPrice, buyerPrice, stash, capacity: () => ({ used: used(), max: CARRY }),
  buy, add: (item, qty = 1, fresh = 1) => buy(item, qty, { free: true, fresh }), remove, sell,
  saturation: (item, d = curDistrict()) => ITEMS[item] && d ? Math.round((1 - satMult(item, d)) / (1 - SAT_FLOOR) * 100) / 100 : null,
  barter, barterOffers, registerOffer, offer: id => OFFERS.has(id) ? pubOffer(OFFERS.get(id)) : null, npcs: () => { const sp = npcSpots(); return Object.values(NPCS).map(n => ({ ...n, spot: sp[n.id] || null })); },
  tips: () => (S.tips || []).map(t => ({ ...t })), get backup() { return Math.max(0, Math.round((backupUntil - Date.now()) / 1000)); }, get barterSource() { return barterSrc; },
  hasAccess, get raidTip() { return S.raidTip ? { ...S.raidTip } : null; }, DEFAULT_BARTER,
  open, close, on: fn => { subs.add(fn); return () => subs.delete(fn); },
  reset() { S = { v: 1, stash: {}, sat: {}, stats: { sold: 0, earned: 0, busts: 0 } }; buyers.clear(); backupUntil = 0; changed(); }, // stash, saturation, trade history,
  get stats() { return { ...S.stats }; }, get near() { return near ? { kind: near.kind, npc: near.kind === 'npc' ? near.ref : null, district: near.kind === 'sup' ? SUPPLIER.district : near.kind === 'npc' ? NPCS[near.ref]?.district || null : SPOTS[near.ref].d } : null; },
  supplier: { ...SUPPLIER }, spots: SPOTS.map(s => ({ ...s }))
};
(function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 200); return; }
  window.SSX.contraband = API; ui();
  try { window.SSX.registerMenuItem({ id: 'rmContraband', label: '🎒 Stash', onTap: () => open('stash') }); } catch (e) { console.warn('contraband menu', e); }
  requestAnimationFrame(tick);
})();
