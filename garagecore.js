// Mars rover dealership, garages and car meets: pure logic (no DOM, no three.js) so it can be unit tested in node.
// Prices, upgrade stat maths, rep scoring, the colony night clock, drag-race pacing and the save-data migration.
// Runtime lives in dealership.js (lot, dealer + garage UI, your active ride) and carmeet.js (night meets, drag races).

export const SAVE_VERSION = 1;
// Placement (colony-relative metres, x east, z south, same as world.js). Anchored to Ares Junction on v7.4 Mars;
// move it later (v7.5 Olympus Row) with SSX.configureDealer({ world, dealer: [x, z], ... }) or by editing this table.
export const DEALER_CONFIG = {
  world: 'Mars', anchor: 'colony', name: 'RED LINE MOTORS',
  dealer: [58, 46],          // showroom lot centre (podiums + sign), between the colony and the Rust Belt Loop's east gates
  garage: [80, 30],          // your lock-up garages, next to the dealer
  meet: [-6, -78],           // car-meet lot on the south road out of Ares Junction (towards Olympus Row)
  strip: { from: [-6, -96], to: [-6, -498] }, // drag strip: 402 m quarter mile, start gate -> finish gate
  yaw: 0
};

// ---------- dealer models (registered as vehicle kinds by dealership.js) ----------
// price: credits; tier 1-4 scales upgrade prices and rep; rep: street rep needed before the dealer sells it to you.
export const MODELS = {
  dust_runner: { name: 'Dust Runner', icon: '🚙', tier: 1, price: 850, rep: 0, vmax: 20, boost: 31, acc: 11, bacc: 16, turn: 1.75, r: 2.2, wy: 0.5, wr: 0.5,
    blurb: 'Three-door hatch on fat tyres. Cheap, forgiving, eats potholes. Every kid in the Junction learned to drive in one.' },
  red_comet: { name: 'Red Comet', icon: '🏎', tier: 2, price: 1900, rep: 0, vmax: 25, boost: 38, acc: 13, bacc: 19, turn: 1.85, r: 2.3, wy: 0.46, wr: 0.46,
    blurb: 'Low two-door coupe. Twitchy at the limit, gorgeous everywhere else. Insurance won\u2019t touch it.' },
  ares_brute: { name: 'Ares Brute', icon: '🛻', tier: 2, price: 2600, rep: 0, vmax: 18, boost: 27, acc: 8, bacc: 12, turn: 1.15, r: 3.0, wy: 0.72, wr: 0.72, tough: true,
    blurb: 'Six-wheel crew truck with a cattle-catcher. Slow off the line, never stops. Security buggies bounce off it.' },
  olympus_gt: { name: 'Olympus GT', icon: '🏁', tier: 3, price: 4800, rep: 40, vmax: 31, boost: 46, acc: 16, bacc: 24, turn: 1.7, r: 2.4, wy: 0.45, wr: 0.45,
    blurb: 'Grand tourer for Meridian money. Long nose, longer legs. Dealer only sells to drivers with a name at the meets.' },
  phobos_phantom: { name: 'Phobos Phantom', icon: '🛸', tier: 4, price: 7500, rep: 100, vmax: 34, boost: 50, acc: 17, bacc: 25, turn: 1.9, r: 2.2, hover: 0.9, lean: 0.35,
    blurb: 'Hover coupe on mag cushions. No wheels, no friction, no mercy. Reserved for the meet\u2019s top names.' }
};
export const STOCK = { id: 'stock', kind: 'rover', name: 'Your rover', tier: 1 };

// ---------- customisation ----------
export const PAINTS = { factory: { name: 'Factory', color: null, price: 0 }, candy: { name: 'Candy Red', color: 0xc0101e, price: 120 }, midnight: { name: 'Midnight Blue', color: 0x14205a, price: 120 },
  lime: { name: 'Acid Lime', color: 0x8ae234, price: 120 }, pearl: { name: 'Pearl White', color: 0xf2efe8, price: 150 }, matte: { name: 'Matte Black', color: 0x1a1a1d, price: 150, rough: true },
  gold: { name: 'Trust Gold', color: 0xd4a640, price: 250, metal: true }, chrome: { name: 'Liquid Chrome', color: 0xd8dde4, price: 400, metal: true } };
export const KITS = { stock: { name: 'Stock body', price: 0, rep: 0 }, street: { name: 'Street kit (lip + spoiler)', price: 300, rep: 8, turn: 0.03 },
  widebody: { name: 'Widebody (flares + wing)', price: 650, rep: 16, turn: 0.06 }, rally: { name: 'Rally kit (bull bar + roof lights)', price: 450, rep: 10, tough: true } };
export const WHEELS = { stock: { name: 'Stock rims', price: 0, rep: 0, rim: 0x8c9097 }, chrome: { name: 'Chrome spokes', price: 200, rep: 5, rim: 0xe8ecf2 },
  gold: { name: 'Gold mesh', price: 260, rep: 7, rim: 0xd4a640 }, black: { name: 'Black lips', price: 180, rep: 4, rim: 0x18181c }, offroad: { name: 'Off-road (big tyres)', price: 320, rep: 6, rim: 0x5a5e64, scale: 1.18 } };
export const GLOWS = { none: { name: 'No underglow', price: 0, color: null }, cyan: { name: 'Cyan', price: 220, color: 0x22e0ff }, magenta: { name: 'Magenta', price: 220, color: 0xff2ad0 },
  green: { name: 'Toxic green', price: 220, color: 0x3cff6a }, orange: { name: 'Ares orange', price: 220, color: 0xff7a1a }, purple: { name: 'Ultraviolet', price: 260, color: 0x8a3cff } };
export const COSMETIC_SLOTS = { paint: PAINTS, kit: KITS, wheels: WHEELS, glow: GLOWS };

// performance: 3 levels each. Effects per level (multipliers on the model's stats).
export const UPGRADES = {
  engine: { name: 'Engine', icon: '🔥', base: 300, desc: '+8% top speed, +12% acceleration per level' },
  handling: { name: 'Handling', icon: '🌀', base: 220, desc: '+8% steering and air control per level' },
  brakes: { name: 'Brakes', icon: '🛑', base: 160, desc: '+35% braking per level' },
  boost: { name: 'Boost', icon: '⚡', base: 260, desc: '+10% boost top speed, +15% boost acceleration per level' }
};
export const MAX_LVL = 3;
const TIER_K = [1, 1, 1.35, 1.8, 2.4];
export const tierK = t => TIER_K[Math.max(1, Math.min(4, t | 0))] || 1;
export function upgradePrice(slot, lvl, tier = 1) { const u = UPGRADES[slot]; if (!u || lvl < 1 || lvl > MAX_LVL) return null; return Math.round(u.base * lvl * tierK(tier) / 10) * 10; }
export function cosmeticPrice(slot, id, tier = 1) { const c = COSMETIC_SLOTS[slot]?.[id]; if (!c) return null; return Math.round(c.price * (slot === 'paint' ? 1 : tierK(tier)) / 10) * 10; }
// what the dealer pays for a ride you sell: 55% of the sticker plus 40% of what you spent on parts
export function tradeIn(ride, base) { return Math.round(((base?.price || 0) * 0.55 + (ride?.spent || 0) * 0.4) / 10) * 10; }
export function sellPrice(base, rep = 0) { const disc = rep >= 150 ? 0.1 : rep >= 60 ? 0.05 : 0; return Math.round((base?.price || 0) * (1 - disc) / 10) * 10; }

// driving spec for a ride: the model's VEHICLES numbers with upgrades applied. Returns a fresh object (never mutates base).
export function applyUpgrades(base, up = {}, kit = 'stock') {
  const L = k => Math.max(0, Math.min(MAX_LVL, up[k] | 0));
  const e = L('engine'), h = L('handling'), b = L('brakes'), x = L('boost'), kt = KITS[kit] || KITS.stock;
  const vmax = base.vmax * (1 + 0.08 * e), acc = (base.acc ?? 9) * (1 + 0.12 * e);
  const boost0 = base.boost ?? base.vmax * 1.5, bacc0 = base.bacc ?? 14;
  const out = { ...base, vmax: r2(vmax), acc: r2(acc), boost: r2(Math.max(vmax * 1.2, boost0 * (1 + 0.08 * e) * (1 + 0.1 * x))), bacc: r2(bacc0 * (1 + 0.12 * e) * (1 + 0.15 * x)),
    turn: r2((base.turn ?? 1.4) * (1 + 0.08 * h + (kt.turn || 0))), airTurn: r2((base.airTurn ?? 1.5) * (1 + 0.08 * h)), brake: r2(1 + 0.35 * b) };
  if (kt.tough) out.tough = true;
  return out;
}
const r2 = v => Math.round(v * 100) / 100;
// extra deceleration (m/s²) dealership.js adds on top of the surface's 26 m/s² braking
export const brakeExtra = spec => Math.max(0, ((spec?.brake || 1) - 1) * 26);

// quarter-mile estimate for a spec: accelerate (boost held) to the boost cap, then cruise. Used for rival pacing and the UI.
export function dragTime(spec, dist = 402) {
  const v = spec.boost ?? spec.vmax * 1.5, a = spec.bacc ?? 14, ta = v / a, da = 0.5 * a * ta * ta;
  return da >= dist ? Math.sqrt(2 * dist / a) : ta + (dist - da) / v;
}
// performance index 0-999 shown on the cards (top speed, acceleration and grip blended)
export function perfIndex(spec) { return Math.round(Math.min(999, (spec.boost ?? spec.vmax * 1.5) * 9 + (spec.bacc ?? 14) * 6 + (spec.turn ?? 1.4) * 60 + (spec.brake || 1) * 20)); }

// ---------- rep ----------
export const REP_TITLES = [[0, 'Nobody'], [25, 'Known face'], [60, 'Respected'], [120, 'Feared'], [220, 'Legend of the Junction']];
export function repTitle(rep) { let t = REP_TITLES[0][1]; for (const [n, s] of REP_TITLES) if (rep >= n) t = s; return t; }
// rep for showing a ride off at a meet: the model's class, how much work went into it, and the look
export function repScore(ride, tier = 1) {
  if (!ride) return 0;
  const up = ride.up || {}, lv = ['engine', 'handling', 'brakes', 'boost'].reduce((s, k) => s + Math.max(0, Math.min(MAX_LVL, up[k] | 0)), 0);
  let s = 4 + 3 * Math.max(1, Math.min(4, tier | 0)) + lv * 3;
  if (ride.paint && ride.paint !== 'factory') s += PAINTS[ride.paint]?.metal ? 8 : 5;
  s += KITS[ride.kit]?.rep || 0; s += WHEELS[ride.wheels]?.rep || 0; if (ride.glow && ride.glow !== 'none') s += 10;
  if (lv === 4 * MAX_LVL) s += 10; // fully built
  return s;
}
// showing the same ride again at the same meet earns nothing; a different ride earns full rep
export function showOff(save, ride, tier, meetId) {
  const shown = save.meet?.id === meetId ? save.meet.shown || [] : [];
  if (shown.includes(ride.id)) return { rep: 0, repeat: true };
  const rep = repScore(ride, tier);
  save.meet = { id: meetId, shown: [...shown, ride.id] }; save.rep = (save.rep || 0) + rep;
  return { rep, repeat: false };
}
// drag race: rep and wager settlement on top of race.js's own purse
export function dragRep(won, wager, rivalTier = 1) { return won ? 6 + Math.round(wager / 25) + rivalTier * 2 : 1; }

// ---------- colony clock (one sol = 24 real minutes; a colony hour is a real minute) ----------
export const MEET_START = 21, MEET_END = 3, SOL_MIN = 24;
export function colonyHour(nowMs, offsetMin = 0) { const m = ((nowMs / 60000 + offsetMin) % SOL_MIN + SOL_MIN) % SOL_MIN; return m * 24 / SOL_MIN; }
export const isMeetHour = h => h >= MEET_START || h < MEET_END;
// minutes (real) until the next meet starts; 0 while it's on
export function minsToMeet(nowMs, offsetMin = 0) { const h = colonyHour(nowMs, offsetMin); if (isMeetHour(h)) return 0; return (MEET_START - h) * SOL_MIN / 24; }
// id of the current/next meet night (changes once per sol), so rep from "show off" resets each night
export function meetId(nowMs, offsetMin = 0) { const m = nowMs / 60000 + offsetMin + (SOL_MIN - MEET_START * SOL_MIN / 24); return Math.floor(m / SOL_MIN); }
export const fmtHour = h => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };

// ---------- save data (stored inside the game's own progress save, ssx.progress.v1 → progress.garage) ----------
export function freshGarage() { return { v: SAVE_VERSION, rides: [newRide('stock', 'rover')], active: 'stock', rep: 0, clock: 0, meet: null, wins: 0, races: 0, nextId: 1 }; }
export function newRide(id, kind) { return { id, kind, paint: 'factory', kit: 'stock', wheels: 'stock', glow: 'none', up: { engine: 0, handling: 0, brakes: 0, boost: 0 }, owned: { paint: ['factory'], kit: ['stock'], wheels: ['stock'], glow: ['none'] }, spent: 0 }; }
// accepts anything (undefined from an old save, a partial or corrupt object) and returns a valid garage
export function migrateGarage(g) {
  const d = freshGarage();
  if (!g || typeof g !== 'object') return d;
  const out = { ...d, ...g, v: SAVE_VERSION };
  const rides = Array.isArray(g.rides) ? g.rides.filter(r => r && typeof r === 'object' && typeof r.kind === 'string' && r.id != null) : [];
  out.rides = rides.map(r => { const n = newRide(String(r.id), r.kind); const o = { ...n, ...r, id: String(r.id), up: { ...n.up, ...(r.up || {}) }, owned: { ...n.owned } };
    for (const k of Object.keys(n.owned)) o.owned[k] = [...new Set([...(n.owned[k]), ...(Array.isArray(r.owned?.[k]) ? r.owned[k] : []), o[k]])];
    for (const k of Object.keys(o.up)) o.up[k] = Math.max(0, Math.min(MAX_LVL, o.up[k] | 0)); o.spent = +o.spent || 0; return o; });
  if (!out.rides.some(r => r.id === 'stock')) out.rides.unshift(newRide('stock', 'rover'));
  if (!out.rides.some(r => r.id === out.active)) out.active = 'stock';
  out.rep = Math.max(0, +out.rep || 0); out.clock = +out.clock || 0; out.wins = +out.wins || 0; out.races = +out.races || 0;
  out.nextId = Math.max(+out.nextId || 1, ...out.rides.map(r => (+String(r.id).replace(/\D/g, '') || 0) + 1));
  return out;
}
export const MAX_RIDES = 6; // garage slots (stock rover included)

// ---------- dealer stock ----------
// Every vehicle kind with a numeric `price` (and no `hidden: true`, no `dealer: false`) is for sale, so mods only need
// SSX.registerVehicle(kind, { name, vmax, ..., price }). SSX.registerDealerVehicle(kind, opts) adds or overrides a listing.
// Fields read per listing: price, hidden, dealer (false | { price, tier, rep, blurb, icon, name }), name, icon, tier, rep (or minRep), blurb (or desc).
export const inferTier = price => price < 1500 ? 1 : price < 3500 ? 2 : price < 6000 ? 3 : 4;
export function dealerStock(vehicles = {}, explicit = {}) {
  const out = [];
  const kinds = new Set([...Object.keys(vehicles), ...Object.keys(explicit)]);
  for (const kind of kinds) {
    const sp = vehicles[kind] || {}, ex = explicit[kind];
    if (kind === 'rover' || sp.hidden || (sp.dealer === false && !ex) || ex?.hidden) continue;
    const d = { ...(typeof sp.dealer === 'object' ? sp.dealer : {}), ...(ex || {}) };
    const price = typeof d.price === 'number' ? d.price : typeof sp.price === 'number' ? sp.price : null;
    if (price == null || !(price >= 0) || !vehicles[kind]) continue;
    const tier = Math.max(1, Math.min(4, d.tier ?? sp.tier ?? inferTier(price)));
    out.push({ kind, name: d.name || sp.name || kind, icon: d.icon || sp.icon || '🚗', price, tier, rep: d.rep ?? d.minRep ?? sp.rep ?? sp.minRep ?? 0,
      blurb: d.blurb || sp.blurb || sp.desc || '', modded: !MODELS[kind] });
  }
  return out.sort((a, b) => a.price - b.price);
}
