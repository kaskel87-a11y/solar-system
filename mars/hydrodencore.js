// mars/hydrodencore.js: rules + numbers for the Hydro Den, the black market inside the ARES JUNCTION dome (pure, unit-tested).
// Fiction only: made-up crops, made-up spirits, made-up space drugs. Sister Nettle swaps your farm crops (straight from the
// Dustbowl Homestead silo; her runner fetches them) and the moonshine crates in your rover for contraband from the
// existing Mars stash (SSX.contraband). She values goods at what the Xen-7 aliens would pay and hands product over at Blue's
// wholesale price, so the den saves you two trips; the catch is heat.
import { CROPS } from './farmcore.js';
import { BOTTLES, alienPrice } from './stillcore.js';

export const KIND = 'hydroden';
export const NAME = 'Hydro Den';
export const TITLE = 'THE HYDRO DEN';
export const DEALER = 'Sister Nettle';
export const DOME_SIGN = 'ARES JUNCTION'; // the big dome in the middle of Ares Junction (world.js COLONIES.Mars.domes[0])
export const CROP_MULT = 1.0;  // raw crop: the Xen-7 base price (no daily swing)
export const SHINE_MULT = 1.0; // moonshine: the Xen-7 alien bottle price (~1.75x the crop it was brewed from)
// Blue's wholesale prices (mars/contraband.js ITEMS[id].supplier). Mirrored so this stays pure; the runtime prefers
// SSX.contraband.supplierPrice(id) and test-hydroden-unit checks this table still matches contraband.js.
export const DRUGS = {
  glowdust: { name: 'Glow-dust', icon: '🔵', cost: 40 },
  lowg: { name: 'Low-G', icon: '🎈', cost: 20 },
  redstatic: { name: 'Red Static', icon: '⚡', cost: 75 },
  voidhoney: { name: 'Void Honey', icon: '🍯', cost: 160 }
};
export const DRUG_IDS = Object.keys(DRUGS);
export const CROP_IDS = Object.keys(CROPS);
export const SHINE_IDS = Object.keys(BOTTLES);
const round5 = n => Math.round(n / 5) * 5;
const int = v => { const n = Math.floor(+v); return Number.isFinite(n) && n > 0 ? n : 0; };

export const isCrop = id => !!CROPS[id];
export const isShine = id => !!BOTTLES[id];
export function goodName(id) { return CROPS[id]?.name || BOTTLES[id]?.name || String(id); }
export function goodIcon(id) { return CROPS[id]?.icon || BOTTLES[id]?.icon || '🌾'; }
// credits of product Nettle gives for one unit of a good
export function goodValue(id) {
  if (CROPS[id]) return round5(CROPS[id].price * CROP_MULT);
  if (BOTTLES[id]) return round5(alienPrice(id) * SHINE_MULT);
  return 0;
}
// quote a trade: `have` units of good -> as much of `drug` as fits in `room` stash slots.
// Returns { ok, take, units, change, value } where take = goods used, change = leftover value paid back in cr.
export function quote(good, have, drug, room, cost = DRUGS[drug]?.cost) {
  const v = goodValue(good); have = int(have); room = int(room); cost = +cost;
  if (!v) return { ok: false, why: 'good', msg: 'Nettle: I don\u2019t take that.' };
  if (!DRUGS[drug] || !(cost > 0)) return { ok: false, why: 'drug', msg: 'Nettle: Don\u2019t carry it.' };
  if (!have) return { ok: false, why: 'none', msg: `You have no ${goodName(good)}.` };
  if (!room) return { ok: false, why: 'full', msg: `Your pockets are full of ${DRUGS[drug].name}.` };
  const most = Math.floor(have * v / cost); if (most < 1) return { ok: false, why: 'short', msg: `Nettle: ${have} ${goodName(good)} won\u2019t buy one ${DRUGS[drug].name}.` };
  const units = Math.min(most, room), take = Math.min(have, Math.ceil(units * cost / v)), change = take * v - units * cost;
  return { ok: true, good, drug, take, units, change, value: take * v, each: v, cost };
}
// ColSec heat: every deal has a chance someone on the rail is wearing a wire. Bigger deals, existing stars and the
// cops' time-of-day multiplier (SSX.time.state().cops) all push it up; it never goes above HEAT_MAX.
export const HEAT_BASE = 0.05, HEAT_PER_UNIT = 0.006, HEAT_PER_STAR = 0.05, HEAT_MAX = 0.3;
export function heatChance(units, wanted = 0, cops = 1) {
  const c = (HEAT_BASE + HEAT_PER_UNIT * int(units) + HEAT_PER_STAR * Math.max(0, +wanted || 0)) * (Number.isFinite(+cops) && +cops > 0 ? +cops : 1);
  return Math.min(HEAT_MAX, Math.max(0, c));
}
export function tradeText(q) { return `🌿 ${q.take} ${goodName(q.good)} \u2192 ${q.units} ${DRUGS[q.drug].icon} ${DRUGS[q.drug].name}${q.change ? ` + ${q.change} cr` : ''}`; }
// table for the README / report: units of each drug per one good
export function rateTable() { return [...CROP_IDS, ...SHINE_IDS].map(id => ({ id, name: goodName(id), value: goodValue(id), per: Object.fromEntries(DRUG_IDS.map(d => [d, Math.round(goodValue(id) / DRUGS[d].cost * 100) / 100])) })); }
