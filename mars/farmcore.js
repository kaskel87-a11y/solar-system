// Mars farming: pure logic (no DOM, no THREE). Crops, racks, upkeep, growth over game hours, storm damage, the alien
// trading post's day-shifting prices and the save format. mars/farm.js renders and drives it; tests/test-farm-unit.mjs
// covers it in node. Fiction only: invented crops, invented aliens.

export const SAVE_KEY = 'ssx.farm.v1';
// AJ-relative metres (Ares Junction centre; x east, z south, same as world.js). South of the Beltway's north loop,
// out past the last district, in open desert.
export const SITES = {
  // moved off the rocky [-60, 250] (11.5 m of relief, boulders on the lot) to open ground 72 m east: 1.5 m of relief over the 20 x 20 m lot
  // and no boulder on it. The trading post moved with it: 82 m west of the farm, 3.1 m over its 16 m pad, clear of boulders.
  farm: { id: 'farm', name: 'Dustbowl Homestead', at: [10, 226], r: 10 },
  post: { id: 'post', name: 'Xen-7 Trading Post', at: [-70, 210], r: 10 }
};
// the homestead is one standard 20 x 20 m base lot (10 x 10 cells of 2 m, centred on SITES.farm.at; same grid as SSX.base #24):
// the dome fills the north 6 x 6 cells, six sealed hydro racks (1 x 2 cells) stand along the south row, a path runs up the middle.
export const LOT = { id: 'farm-homestead', cell: 2, size: 10, half: 10,
  dome: { type: 'farm-dome', i: 2, j: 0, fp: [6, 6], r: 5.8 }, rackFp: [1, 2], rackSlots: [[3, 7], [6, 7], [2, 7], [7, 7], [1, 7], [8, 7]] }; // filled from the path outward
// footprint centre (lot-local metres) of a piece at cell i, j with footprint fp and rotation r (as SSX.base's pieceCentre)
export function lotCentre(i, j, fp, r = 0) { const [w, d] = (r & 1) ? [fp[1], fp[0]] : fp; return { x: (i + w / 2) * LOT.cell - LOT.half, z: (j + d / 2) * LOT.cell - LOT.half, rot: (r & 1) ? Math.PI / 2 : 0 }; }
export const PRICES = { plot: 1200, dome: 900, rack: 300, patch: 120, water: 2, power: 3 };
export const LIMITS = { racks: 6, water: 100, power: 100, silo: 120 };
// hours = game hours to ripen; water / power = units per game hour per rack; yield at full health
// v7.5.6 economy: price (Vell cash per unit at a 1.0 day) is ~3.5x a harvest's full grow cost (growCost: seed + water + power +
// the rack's share of plot + dome + rack over AMORT_HARVESTS), so a full rack clears ~3-4x what it cost on any day.
// barter = the old per-unit value; Oru items and Hush favors still ask the same number of crops as before.
export const CROPS = {
  potato:    { id: 'potato',    name: 'Potatoes',     icon: '🥔', seed: 20,  hours: 10, water: 1.0, power: 0.4, yield: 6, price: 105, barter: 18, storm: 1.0 },
  algae:     { id: 'algae',     name: 'Algae mats',   icon: '🟢', seed: 15,  hours: 6,  water: 2.0, power: 0.8, yield: 8, price: 80,  barter: 11, storm: 0.6 },
  glowberry: { id: 'glowberry', name: 'Glow-berries', icon: '🫐', seed: 60,  hours: 14, water: 1.2, power: 1.0, yield: 5, price: 185, barter: 46, storm: 1.5 },
  // the contraband crop: dries into Glow-dust for SSX.contraband's stash (fiction)
  lichen:    { id: 'lichen',    name: 'Ghost lichen', icon: '🍄', seed: 120, hours: 20, water: 0.8, power: 1.4, yield: 4, price: 320, barter: 90, storm: 1.2, contraband: 'glowdust' }
};
export const CROP_IDS = Object.keys(CROPS);
export const AMORT_HARVESTS = 5;
// full cost of one harvest on one rack: seed + water + power used while growing + (plot + dome) / max racks + rack, over AMORT_HARVESTS
export function growCost(crop) { const c = CROPS[crop]; if (!c) return 0; const inputs = c.seed + c.water * c.hours * PRICES.water + c.power * c.hours * PRICES.power;
  return Math.round((inputs + ((PRICES.plot + PRICES.dome) / LIMITS.racks + PRICES.rack) / AMORT_HARVESTS) * 10) / 10; }

// ---------- farm expansions: two more greenhouse domes on their own lots + bigger tanks ----------
// State lives in the same save as s.exp (no new localStorage key); an old save without it = no expansions = the old farm.
// Each extra dome stands on its own 20 x 20 m lot touching the homestead (lot-local offsets in metres, x east / z south):
// north of it (open ground, 1.0 m of relief) and north-east of that (1.0 m); the west side stays clear for the harvester's
// parking spot, the south side for the gate. Each dome holds LIMITS.racks racks (6 -> 12 -> 18).
export const ANNEXES = [
  { id: 'farm-annex-1', name: 'Homestead north lot', off: [0, -20] },
  { id: 'farm-annex-2', name: 'Homestead north-east lot', off: [20, -20] }
];
// ⭐ price = credit price x STAR_RATE. Set 1:1 at Collin's request so his stars are usable; Star Shop works out to 3.75-10 ⭐/cr.
export const STAR_RATE = 1;
export const EXPANSIONS = {
  dome2: { id: 'dome2', kind: 'dome', n: 1, icon: '🫧', name: 'Second greenhouse dome', cr: 2500, needs: null },
  dome3: { id: 'dome3', kind: 'dome', n: 2, icon: '🫧', name: 'Third greenhouse dome', cr: 6000, needs: 'dome2' },
  water: { id: 'water', kind: 'tank', key: 'water', icon: '💧', name: 'Bigger water tank', cr: 1500, needs: null },
  power: { id: 'power', kind: 'tank', key: 'power', icon: '🔋', name: 'Bigger power cells', cr: 1500, needs: null },
  silo:  { id: 'silo',  kind: 'tank', key: 'silo',  icon: '🏚️', name: 'Bigger silo', cr: 1500, needs: null }
};
export const EXP_ORDER = ['dome2', 'dome3', 'water', 'power', 'silo'];
export const starPrice = id => EXPANSIONS[id] ? EXPANSIONS[id].cr * STAR_RATE : 0;
export const freshExp = () => ({ domes: 0, water: false, power: false, silo: false });
export function migrateExp(e) {
  const x = freshExp(); if (!e || typeof e !== 'object') return x;
  x.domes = Math.max(0, Math.min(ANNEXES.length, Math.floor(+e.domes || 0))); x.water = e.water === true; x.power = e.power === true; x.silo = e.silo === true; return x;
}
// caps for this save: racks 6 per dome, each tank upgrade doubles its cap
export function caps(s) {
  const e = s?.exp || {}, d = Math.max(0, Math.min(ANNEXES.length, Math.floor(+e.domes || 0)));
  return { racks: LIMITS.racks * (1 + d), water: LIMITS.water * (e.water === true ? 2 : 1), power: LIMITS.power * (e.power === true ? 2 : 1), silo: LIMITS.silo * (e.silo === true ? 2 : 1), domes: 1 + d };
}
// which lot (0 = the homestead, 1.. = ANNEXES[n - 1]) rack k stands on
export const rackLot = k => Math.max(0, Math.floor((k | 0) / LIMITS.racks));
export function owns(s, id) { const x = EXPANSIONS[id], e = s?.exp || {}; if (!x) return false; return x.kind === 'dome' ? (e.domes | 0) >= x.n : e[x.key] === true; }
export function canExpand(s, id) {
  const x = EXPANSIONS[id]; if (!x) return { ok: false, why: 'Unknown expansion.' };
  if (!s?.owned) return { ok: false, why: 'Buy the homestead first.' };
  if (!s.dome) return { ok: false, why: 'Build the first greenhouse dome first.' };
  if (owns(s, id)) return { ok: false, why: `You already have the ${x.name.toLowerCase()}.`, owned: true };
  if (x.needs && !owns(s, x.needs)) return { ok: false, why: `Build the ${EXPANSIONS[x.needs].name.toLowerCase()} first.`, locked: true };
  return { ok: true, id, cr: x.cr, stars: starPrice(id) };
}
// can you pay it in this currency? have = credits or spendable stars
export function canPay(v, cur, have) {
  if (!v?.ok) return v; const price = cur === 'stars' ? v.stars : v.cr, unit = cur === 'stars' ? '⭐' : 'cr';
  if (!(have >= price)) return { ok: false, short: price - (have | 0), why: `That costs ${price} ${unit}. You have ${Math.max(0, have | 0)} ${unit}.` };
  return { ...v, price, cur: cur === 'stars' ? 'stars' : 'cr' };
}
// one purchase, all or nothing: check, take the price from ONE wallet (credits or stars), apply, commit (the save). Anything
// failing after the money moved puts the state back and refunds it. wallet: { have() -> number, take(n) -> { ok, n?, msg?, dup? },
// give(n) }. Returns { ok, ..., s }: s is the state to keep (the same object on success, a clean copy of the old one on failure).
export function buyExpansion(s, id, cur, wallet, commit = () => true) {
  cur = cur === 'stars' ? 'stars' : 'cr'; const unit = cur === 'stars' ? 'Stars' : 'Credits';
  let have = 0; try { have = +wallet.have() || 0; } catch (e) { have = 0; }
  const v = canPay(canExpand(s, id), cur, have); if (!v.ok) return { ...v, s };
  const before = JSON.stringify(s); let paid = 0;
  const undo = why => { const back = paid; paid = 0; if (back > 0) { try { wallet.give(back); } catch (e) { /* */ } } return { ok: false, why, refunded: back, s: migrate(JSON.parse(before)) }; };
  try {
    const t = wallet.take(v.price); if (!t?.ok) return { ok: false, why: t?.dup ? '' : (t?.msg || t?.why || 'Payment refused.'), dup: !!t?.dup, s };
    paid = Number.isFinite(t.n) ? t.n : v.price; if (paid !== v.price) return undo(`The payment didn\u2019t add up, so nothing was bought. ${unit} refunded.`);
    applyExpand(s, id);
    if (!commit(s)) return undo(`Couldn\u2019t save the farm, so nothing was bought. ${unit} refunded.`);
  } catch (e) { return undo(`Something went wrong, so nothing was bought. ${unit} refunded.`); }
  return { ok: true, id, cur, price: paid, s, caps: caps(s) };
}
export function applyExpand(s, id) { const x = EXPANSIONS[id]; if (!s.exp) s.exp = freshExp(); if (x.kind === 'dome') s.exp.domes = Math.max(s.exp.domes | 0, x.n); else s.exp[x.key] = true; return s; }
// one harvest on a rack in an extra dome: same inputs, that dome's price shared over its racks (AMORT_HARVESTS)
export function growCostAt(crop, lot = 0) {
  if (!(lot > 0)) return growCost(crop); const c = CROPS[crop]; if (!c) return 0; const d = EXPANSIONS[lot === 1 ? 'dome2' : 'dome3'];
  const inputs = c.seed + c.water * c.hours * PRICES.water + c.power * c.hours * PRICES.power;
  return Math.round((inputs + (d.cr / LIMITS.racks + PRICES.rack) / AMORT_HARVESTS) * 10) / 10;
}
// plain-word payback: full potato harvests on all 6 new racks (fair price, inputs paid) to earn back the dome + its racks
export function paybackHarvests(id) {
  const x = EXPANSIONS[id]; if (x?.kind !== 'dome') return 0; const c = CROPS.potato;
  const profit = c.price * c.yield - (c.seed + c.water * c.hours * PRICES.water + c.power * c.hours * PRICES.power);
  return Math.ceil((x.cr + LIMITS.racks * PRICES.rack) / (LIMITS.racks * profit));
}
export function expandWords(id) {
  const x = EXPANSIONS[id]; if (!x) return '';
  if (x.kind === 'dome') { const n = paybackHarvests(id), tot = LIMITS.racks * (1 + x.n);
    return `+${LIMITS.racks} racks (${tot} in all). Pays for itself in about ${n} potato harvest${n === 1 ? '' : 's'} on its ${LIMITS.racks} racks.`; }
  const cap = LIMITS[x.key] * 2;
  return x.key === 'water' ? `Holds ${cap} water: fill up half as often.` : x.key === 'power' ? `Holds ${cap} power: charge half as often.` : `Holds ${cap} crops: sell less often.`;
}
const barterPrice = (d, crop, buyer) => { const c = CROPS[crop]; return Math.max(1, Math.round((c.barter ?? c.price) * dayMult(d, crop, buyer))); };
// alien buyers at the trading post. pays: 'cash' | 'item' | 'favor'. wants: crop ids they buy.
export const BUYERS = [
  { id: 'vell', name: 'Vell broker', icon: '👽', pays: 'cash', wants: ['potato', 'algae', 'glowberry', 'lichen'], line: 'Vell: Starch and green. We pay in your little numbers.' },
  { id: 'oru', name: 'Oru collector', icon: '🦑', pays: 'item', wants: ['glowberry', 'algae'], line: 'Oru: Shiny berries. We trade shiny things.' },
  { id: 'hush', name: 'The Hush', icon: '🌫️', pays: 'favor', wants: ['lichen', 'glowberry'], line: 'The Hush: Bring the pale moss. We remember who brings.' }
];
// what an Oru item trade gives (rolled per sale; deterministic per day + crop in tests via seed)
export const ITEMS = [
  { id: 'medkit', name: 'Medkit', icon: '✚', worth: 60 },
  { id: 'slugs', name: 'Coil slugs ×4', icon: '🔋', worth: 70 },
  { id: 'voidhoney', name: 'Void Honey vial', icon: '🍯', worth: 160 }
];
// The Hush's favors: stored tokens you spend later
export const FAVORS = {
  cool: { id: 'cool', name: 'Hush favor: ColSec loses your file', icon: '🌫️', blurb: 'Drops your wanted level by 2 stars when you use it.', worth: 240 },
  watch: { id: 'watch', name: 'Hush favor: watchers on the farm', icon: '👁️', blurb: 'The next raid on your farm comes with one wave fewer.', worth: 200 }
};
export const RAID = { minSilo: 8, cooldownH: 18, chancePerH: 0.06, steal: 0.6, bounty: 120 };
export const STORM = { perH: 7 }; // health lost per game hour at intensity 1 (x crop.storm, x0.5 with a sealed, patched dome)

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;

export const freshRack = () => ({ crop: null, growth: 0, health: 100, planted: 0 });
export function fresh() {
  return { v: 1, owned: false, dome: false, domeHp: 100, racks: [], water: 0, power: 0, silo: {}, favors: [], hours: 0, lastRaidH: -99, stats: { planted: 0, harvested: 0, sold: 0, earned: 0, raids: 0, raidsWon: 0, stolen: 0, stormLoss: 0, wilted: 0 }, guide: { on: false, done: false, off: false }, exp: freshExp() };
}
// repairs partial / corrupt / older data; never throws
export function migrate(raw) {
  const s = fresh(); if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
  s.owned = !!raw.owned; s.dome = !!raw.dome && s.owned; s.domeHp = clamp(+raw.domeHp || 0, 0, 100);
  if (!Number.isFinite(+raw.domeHp)) s.domeHp = 100;
  s.exp = migrateExp(raw.exp); const cap = caps(s);
  s.racks = (Array.isArray(raw.racks) ? raw.racks : []).slice(0, cap.racks).map(r => ({ crop: CROPS[r?.crop] ? r.crop : null, growth: clamp(+r?.growth || 0, 0, 1), health: clamp(Number.isFinite(+r?.health) ? +r.health : 100, 0, 100), planted: +r?.planted || 0 }));
  s.water = clamp(+raw.water || 0, 0, cap.water); s.power = clamp(+raw.power || 0, 0, cap.power);
  for (const k of CROP_IDS) { const n = Math.max(0, Math.floor(+raw.silo?.[k] || 0)); if (n) s.silo[k] = n; }
  s.favors = (Array.isArray(raw.favors) ? raw.favors : []).filter(f => FAVORS[f]).slice(0, 10);
  s.hours = Math.max(0, +raw.hours || 0); s.lastRaidH = Number.isFinite(+raw.lastRaidH) ? +raw.lastRaidH : -99;
  for (const k in s.stats) s.stats[k] = Math.max(0, +raw.stats?.[k] || 0);
  const g = raw.guide && typeof raw.guide === 'object' ? raw.guide : {};
  s.guide = { on: !!g.on, done: !!g.done || s.stats.sold > 0, off: !!g.off };
  return s;
}
export const siloCount = s => Object.values(s.silo).reduce((a, b) => a + b, 0);
export const day = s => Math.floor(s.hours / 24);

// ---------- actions (pure: return { ok, why|msg, cost }) ----------
export function canBuy(s, credits) { if (s.owned) return { ok: false, why: 'You already own the homestead.' }; if (credits < PRICES.plot) return { ok: false, why: `The homestead is ${PRICES.plot} cr. You're short ${PRICES.plot - credits}.` }; return { ok: true, cost: PRICES.plot }; }
export function canDome(s, credits) { if (!s.owned) return { ok: false, why: 'Buy the homestead first.' }; if (s.dome) return { ok: false, why: 'The dome is already up.' }; if (credits < PRICES.dome) return { ok: false, why: `The dome kit is ${PRICES.dome} cr.` }; return { ok: true, cost: PRICES.dome }; }
export function canRack(s, credits) { if (!s.dome) return { ok: false, why: 'Build the greenhouse dome first.' }; const cap = caps(s).racks; if (s.racks.length >= cap) return { ok: false, why: cap < LIMITS.racks * (1 + ANNEXES.length) ? `Your dome${cap > LIMITS.racks ? 's fit' : ' fits'} ${cap} racks. 🧱 Expand for another dome.` : `The farm fits ${cap} racks.` }; if (credits < PRICES.rack) return { ok: false, why: `A hydroponic rack is ${PRICES.rack} cr.` }; return { ok: true, cost: PRICES.rack }; }
export function canPlant(s, i, crop, credits) {
  const r = s.racks[i], c = CROPS[crop]; if (!r) return { ok: false, why: 'No rack there.' }; if (!c) return { ok: false, why: 'Unknown crop.' };
  if (r.crop) return { ok: false, why: 'That rack is already planted.' }; if (credits < c.seed) return { ok: false, why: `${c.name} seed is ${c.seed} cr.` };
  return { ok: true, cost: c.seed };
}
export function plant(s, i, crop) { const r = s.racks[i]; r.crop = crop; r.growth = 0; r.health = 100; r.planted = s.hours; s.stats.planted++; return r; }
export function yieldOf(r) { const c = CROPS[r.crop]; return c ? Math.max(0, Math.floor(c.yield * r.health / 100 + 1e-9)) : 0; }
export function harvest(s, i) {
  const r = s.racks[i]; if (!r?.crop) return { ok: false, why: 'Nothing planted there.' }; if (r.growth < 1) return { ok: false, why: `Not ripe yet (${Math.floor(r.growth * 100)}%).` };
  const crop = r.crop, n = yieldOf(r), room = Math.max(0, caps(s).silo - siloCount(s)), got = Math.min(n, room);
  if (got > 0) s.silo[crop] = (s.silo[crop] || 0) + got;
  s.racks[i] = freshRack(); s.stats.harvested += got;
  return { ok: true, crop, n: got, lost: n - got };
}
// water / power top-up to full: returns units + cost
export function refillCost(s, what) { const lim = caps(s)[what], have = s[what], units = Math.ceil(lim - have - 1e-9); return { units: Math.max(0, units), cost: Math.max(0, units) * PRICES[what] }; }

// ---------- time: advance by dh game hours. stormI(h) -> 0..1 intensity for that slice ----------
export function advance(s, dh, stormI = 0) {
  const out = { grown: 0, wilted: 0, stormLoss: 0, ripe: [], dry: false, dark: false };
  if (!(dh > 0) || !s.owned) { if (dh > 0) s.hours += dh; return out; }
  let left = Math.min(dh, 24 * 14);
  while (left > 1e-9) {
    const h = Math.min(1, left); left -= h; s.hours += h;
    const I = clamp(typeof stormI === 'function' ? +stormI(s.hours) || 0 : +stormI || 0, 0, 1);
    for (let i = 0; i < s.racks.length; i++) {
      const r = s.racks[i], c = CROPS[r.crop]; if (!c || r.health <= 0) continue;
      if (r.growth >= 1) { /* ripe crops wait; a storm still knocks them about */ }
      else {
        const w = c.water * h, p = c.power * h;
        if (s.water >= w && s.power >= p) { s.water -= w; s.power -= p; const was = r.growth; r.growth = clamp(r.growth + h / c.hours, 0, 1); if (r.growth > 0.99999) r.growth = 1; out.grown++; if (was < 1 && r.growth >= 1) out.ripe.push(i); }
        else { r.health = clamp(r.health - 6 * h, 0, 100); out.wilted++; s.stats.wilted += 6 * h; if (s.water < w) out.dry = true; if (s.power < p) out.dark = true; }
      }
      if (I > 0) { const shield = s.dome && s.domeHp >= 60 ? 0.5 : 1, loss = STORM.perH * I * c.storm * shield * h; r.health = clamp(r.health - loss, 0, 100); out.stormLoss += loss; s.stats.stormLoss += loss; }
    }
    if (I > 0 && s.dome) s.domeHp = clamp(s.domeHp - 4 * I * h, 0, 100);
  }
  s.water = r1(s.water); s.power = r1(s.power);
  return out;
}

// ---------- trading post: prices shift with the game day ----------
export function hash(n) { let x = (n | 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }
const cropIdx = c => CROP_IDS.indexOf(c) + 1;
export function dayMult(d, crop, buyer = 'vell') { return Math.round((0.85 + 0.3 * hash(d * 131 + cropIdx(crop) * 17 + buyer.length * 7)) * 100) / 100; }
export function unitPrice(d, crop, buyer = 'vell') { const c = CROPS[crop]; return c ? Math.max(1, Math.round(c.price * dayMult(d, crop, buyer))) : 0; }
export function buyersToday(d) {
  return BUYERS.map(b => ({ ...b, offers: b.wants.map(crop => ({ crop, unit: unitPrice(d, crop, b.id), mult: dayMult(d, crop, b.id) })) }));
}
// what a sale of qty units to buyer pays. cash: credits. item: an ITEMS entry per ~worth of goods. favor: a FAVORS token
export function quoteSale(s, buyerId, crop, qty) {
  const b = BUYERS.find(x => x.id === buyerId), have = s.silo[crop] | 0; qty = Math.min(Math.max(1, qty | 0), have);
  if (!b) return { ok: false, why: 'Nobody by that name here today.' }; if (!b.wants.includes(crop)) return { ok: false, why: `${b.name} doesn't want ${CROPS[crop]?.name || crop}.` };
  if (!have) return { ok: false, why: `No ${CROPS[crop]?.name || crop} in your silo.` };
  const d = day(s), value = unitPrice(d, crop, b.id) * qty;
  if (b.pays === 'cash') return { ok: true, buyer: b.id, crop, qty, value, cash: value };
  if (b.pays === 'item') { const it = ITEMS[Math.floor(hash(d * 7 + cropIdx(crop)) * ITEMS.length)]; const need = Math.ceil(it.worth / barterPrice(d, crop, b.id)); if (have < need) return { ok: false, why: `Oru wants ${need} ${CROPS[crop].name} for a ${it.name}.`, need }; return { ok: true, buyer: b.id, crop, qty: need, value: unitPrice(d, crop, b.id) * need, item: it.id }; }
  const f = crop === 'lichen' ? FAVORS.cool : FAVORS.watch, need = Math.ceil(f.worth / barterPrice(d, crop, b.id));
  if (have < need) return { ok: false, why: `The Hush wants ${need} ${CROPS[crop].name} for a favor.`, need };
  return { ok: true, buyer: b.id, crop, qty: need, value: unitPrice(d, crop, b.id) * need, favor: f.id };
}
export function applySale(s, q) { if (s.guide) s.guide.done = true; s.silo[q.crop] -= q.qty; if (s.silo[q.crop] <= 0) delete s.silo[q.crop]; s.stats.sold += q.qty; if (q.cash) s.stats.earned += q.cash; if (q.favor) s.favors.push(q.favor); return s; }

// ---------- raids ----------
export function raidDue(s, roll) { return s.owned && siloCount(s) >= RAID.minSilo && s.hours - s.lastRaidH >= RAID.cooldownH && roll < RAID.chancePerH; }
export function steal(s, frac = RAID.steal) {
  const took = {}; let n = 0;
  for (const k of Object.keys(s.silo)) { const t = Math.ceil(s.silo[k] * frac - 1e-9); if (t > 0) { took[k] = t; n += t; s.silo[k] -= t; if (s.silo[k] <= 0) delete s.silo[k]; } }
  s.stats.stolen += n; return { took, n };
}

// ---------- plain-word directions (x east, z south) ----------
export function dirWord(dx, dz) {
  const a = Math.atan2(dx, -dz) * 180 / Math.PI, i = Math.round(((a % 360) + 360) % 360 / 45) % 8;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][i];
}
export function directions(from, to, name, verb = 'tap Farm') {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz);
  if (d < 12) return `You're at ${name}. ${verb[0].toUpperCase() + verb.slice(1)}.`;
  return `Go to ${name} (${d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km'} ${dirWord(dx, dz)}) and ${verb}.`;
}

// ---------- first-loop guide: one plain-word objective at a time (buy -> dome -> plant -> grow -> harvest -> sell) ----------
// returns null once the first sale is done; to = which site the waypoint points at
export function guideStep(s) {
  if (!s || s.guide?.done) return null;
  if (!s.owned) return { id: 'buy', text: 'Buy the Dustbowl Homestead', to: 'farm', icon: '🏚️' };
  if (!s.dome) return { id: 'dome', text: 'Build a dome', to: 'farm', icon: '🫧' };
  const ripe = s.racks.find(r => r.crop && r.growth >= 1), growing = s.racks.find(r => r.crop && r.growth < 1);
  if (ripe) return { id: 'harvest', text: `Harvest your ${CROPS[ripe.crop].name.toLowerCase()}`, to: 'farm', icon: '🧺' };
  if (siloCount(s) > 0) return { id: 'sell', text: 'Sell to the aliens at Xen-7 Trading Post', to: 'post', icon: '👽' };
  if (growing) {
    const c = CROPS[growing.crop];
    if (s.water < c.water || s.power < c.power) return { id: 'upkeep', text: 'Fill the water tank and charge the power cells', to: 'farm', icon: '💧' };
    return { id: 'grow', text: `Wait for your ${c.name.toLowerCase()} to grow (${Math.floor(growing.growth * 100)}%)`, to: 'farm', icon: '🌱' };
  }
  return { id: 'plant', text: s.racks.length ? 'Plant potatoes in a hydro rack' : 'Add a hydro rack, then plant potatoes', to: 'farm', icon: '🥔' };
}

// ---------- idempotent taps and API calls ----------
// Every buy/build/plant/harvest/sell goes through one guard: a call made while another farm action is running, or within
// ACT_MS of the last successful call with the same key, is dropped ({ ok:false, dup:true }), so it has no effect and no charge.
export const ACT_MS = 300;
export function actKey(a, o = {}) {
  switch (a) {
    case 'plant': case 'plantc': return 'plant:' + (o.i ?? 'next');
    case 'harvest': return 'harvest:' + (o.i ?? 'all');
    case 'harvestAll': return 'harvest:all';
    case 'sell': return 'sell:' + (o.b ?? '') + ':' + (o.c ?? '');
    case 'favor': return 'favor:' + (o.c ?? '');
    case 'water': case 'power': return 'refill:' + a;
    default: return String(a);
  }
}
export function makeActGuard(now = () => Date.now(), ms = ACT_MS) {
  const last = new Map(); let busy = null;
  return {
    run(key, fn) {
      if (busy) return { ok: false, dup: true, why: 'busy', msg: '' };
      const t = now(), l = last.get(key); if (l != null && t - l < ms) return { ok: false, dup: true, why: 'debounced', msg: '' };
      busy = key; try { const r = fn(); if (r && r.ok) last.set(key, now()); return r; } finally { busy = null; }
    },
    get busy() { return busy; }, reset() { last.clear(); busy = null; }
  };
}
// the state a sheet button was drawn against must still hold before anything is charged (null = still fine)
export function actStale(s, a, exp) {
  if (exp == null || exp === '' || !Number.isFinite(+exp)) return null; const n = +exp;
  if (a === 'rack') return s.racks.length !== n ? 'That rack is already in.' : null;
  if (a === 'sell') return null; // per crop: checked in staleSale
  return null;
}
export const staleSale = (s, crop, exp) => (exp == null || exp === '' || !Number.isFinite(+exp)) ? null : ((s.silo[crop] | 0) !== +exp ? 'Already sold.' : null);

// ---------- save recovery (v7.5.7 hotfix) ----------
// A farm you paid for is never shown as for sale again because one read came back empty or broken. On load we take the
// first owned state from: the save, its mirror (BAK_KEY, written on every owned save), then the homestead's record in
// SSX.base's save (ssx.base.v1 keeps farm-dome / farm-rack pieces even when the lot shows unowned). raw* are the stored strings.
export const BAK_KEY = 'ssx.farm.v1.bak', BASE_SAVE_KEY = 'ssx.base.v1';
const parseJ = t => { if (typeof t !== 'string' || !t) return null; try { return JSON.parse(t); } catch (e) { return null; } };
export function baseEvidence(rawBase) {
  const p = parseJ(rawBase)?.plots?.[LOT.id]; if (!p || typeof p !== 'object') return null;
  const pcs = Array.isArray(p.pieces) ? p.pieces : [], dome = pcs.filter(q => q?.type === LOT.dome.type).length, racks = pcs.filter(q => q?.type === 'farm-rack').length;
  // boughtAt alone is not proof: debug.reset scraps the pieces and the lot syncs to unowned but keeps boughtAt
  if (!(p.owned === true || dome + racks > 0)) return null;
  // extra domes: an annex lot with a farm dome on it (lots in order) counts; its racks count up to LIMITS.racks each
  let domes = 0, extra = 0; for (const a of ANNEXES) { const q = parseJ(rawBase)?.plots?.[a.id], ps = Array.isArray(q?.pieces) ? q.pieces : [];
    if (!ps.some(x => x?.type === LOT.dome.type)) break; domes++; extra += Math.min(LIMITS.racks, ps.filter(x => x?.type === 'farm-rack').length); }
  return { owned: true, dome: dome > 0, racks: Math.min(racks, LIMITS.racks) + extra, domes };
}
export function recover(rawSave, rawBak, rawBase) {
  const j = parseJ(rawSave), s = migrate(j);
  if (s.owned) return { s, from: 'save', restored: false };
  const b = migrate(parseJ(rawBak));
  if (b.owned) return { s: b, from: 'backup', restored: true };
  const ev = baseEvidence(rawBase);
  if (ev) { s.owned = true; s.dome = ev.dome; s.domeHp = 100; s.exp.domes = Math.max(s.exp.domes, ev.domes | 0); while (s.racks.length < ev.racks) s.racks.push(freshRack());
    s.water = Math.max(s.water, 40); s.power = Math.max(s.power, 40); return { s, from: 'base', restored: true }; }
  return { s, from: j ? 'save' : 'fresh', restored: false };
}
// may this state overwrite what is stored? an unowned state never replaces an owned one (only an explicit reset does)
export function mayOverwrite(next, rawStored) { if (next?.owned) return true; return !migrate(parseJ(rawStored)).owned; }
