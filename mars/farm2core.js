// Red Static Gulch: pure rules for the outlaw grow op (mars/farm2.js draws and drives it; tests/test-farm2-unit.mjs covers
// it in node). Fiction only: invented crops, no real drugs, no how-to.
// No DOM, no THREE.

export const SAVE_KEY = 'ssx.farm2.v1', BAK_KEY = 'ssx.farm2.v1.bak';
// AJ-relative metres (x east, z south). Out in the south-east dunes, 174 m from the Dustbowl Homestead [10, 226] and well
// clear of every district, the Beltway and the Rust Pit. 3.6 m of relief over its 24 m square, no boulders, no colliders.
export const SITE = { id: 'farm2', name: 'Red Static Gulch', at: [150, 330], r: 12 };
export const PLOT_ID = 'farm2-gulch';
// lot-local rack spots (metres from the lot centre): two rows of three under the camo net
export const RACK_SPOTS = [[-5, -1.5], [0, -1.5], [5, -1.5], [-5, 4], [0, 4], [5, 4]];
export const SKIV_AT = [-7, -7.5];   // Skiv the fence, by the rust container
// ⭐ price = cr price x STAR_RATE (1:1, like mars/farmcore.js)
export const STAR_RATE = 1;
export const PRICES = { op: 2500, rack: 400 };
export const LIMITS = { racks: 6, stash: 40 };
// hours = game hours to ripen, yield per rack, price = cr a unit from Skiv on a 1.0 day, heat = chance a harvest gets you noticed
export const CROPS = {
  redstatic:  { id: 'redstatic',  name: 'Red Static moss',   icon: '🟥', seed: 40,  hours: 8,  yield: 5, price: 150, heat: 0.25, color: 0xc81e1e },
  glowcactus: { id: 'glowcactus', name: 'Glow-dust cactus',  icon: '🌵', seed: 80,  hours: 12, yield: 4, price: 260, heat: 0.3,  color: 0x9cff3a },
  voidpoppy:  { id: 'voidpoppy',  name: 'Void Honey poppies', icon: '🌺', seed: 150, hours: 18, yield: 4, price: 420, heat: 0.4,  color: 0x8a2be2 },
  ghostspore: { id: 'ghostspore', name: 'Ghost spore',       icon: '🍄', seed: 260, hours: 24, yield: 3, price: 760, heat: 0.5,  color: 0xe8f4ff }
};
export const CROP_IDS = Object.keys(CROPS);
// buyers: Skiv at the gulch (cash, can draw heat) or the Xen-7 aliens (pay more, no questions, but you haul it there)
export const BUYERS = { skiv: { id: 'skiv', name: 'Skiv the fence', mult: 1.0, heat: 0.4 }, xen7: { id: 'xen7', name: 'Xen-7 aliens', mult: 1.2, heat: 0 } };
export const HEAT = { plant: 0.15, maxStars: 3 };
export const RAID = { chance: 0.35, cooldownH: 12, len: 45, seize: 0.25, seizeMax: 10, tip: 150 };

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const freshRack = () => ({ crop: null, growth: 0, health: 100, planted: 0, id: 0 });
export function fresh() { return { v: 1, owned: false, paidWith: null, racks: [], stash: {}, hours: 0, clockAt: null, lastRaidH: -99, nextId: 1, stats: { planted: 0, harvested: 0, sold: 0, earned: 0, raids: 0, raidsDodged: 0, seized: 0, eaten: 0, heat: 0 } }; }
export function migrate(raw) {
  const s = fresh(); if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
  s.owned = !!raw.owned; s.paidWith = raw.paidWith === 'stars' ? 'stars' : raw.paidWith === 'cr' ? 'cr' : null;
  s.nextId = Math.max(1, Math.floor(+raw.nextId || 1));
  s.racks = (Array.isArray(raw.racks) ? raw.racks : []).slice(0, LIMITS.racks).map(r => {
    const id = Math.max(1, Math.floor(+r?.id || 0)) || s.nextId++;
    return { crop: CROPS[r?.crop] ? r.crop : null, growth: clamp(+r?.growth || 0, 0, 1), health: clamp(Number.isFinite(+r?.health) ? +r.health : 100, 0, 100), planted: +r?.planted || 0, id };
  });
  for (const r of s.racks) s.nextId = Math.max(s.nextId, r.id + 1);
  if (!s.owned) s.racks = [];
  for (const k of CROP_IDS) { const n = Math.max(0, Math.floor(+raw.stash?.[k] || 0)); if (n) s.stash[k] = n; }
  s.hours = Math.max(0, +raw.hours || 0); s.clockAt = Number.isFinite(+raw.clockAt) && raw.clockAt !== null ? +raw.clockAt : null; s.lastRaidH = Number.isFinite(+raw.lastRaidH) ? +raw.lastRaidH : -99;
  for (const k in s.stats) s.stats[k] = Math.max(0, +raw.stats?.[k] || 0);
  return s;
}
const parseJ = t => { if (typeof t !== 'string' || !t) return null; try { return JSON.parse(t); } catch (e) { return null; } };
// an owned op is never lost to one bad read (the #83 pattern): the save, else its mirror
export function recover(rawSave, rawBak) {
  const s = migrate(parseJ(rawSave)); if (s.owned) return { s, from: 'save', restored: false };
  const b = migrate(parseJ(rawBak)); if (b.owned) return { s: b, from: 'backup', restored: true };
  return { s, from: rawSave ? 'save' : 'fresh', restored: false };
}
export function mayOverwrite(next, rawStored) { if (next?.owned) return true; return !migrate(parseJ(rawStored)).owned; }
export const stashCount = s => Object.values(s.stash).reduce((a, b) => a + b, 0);
export const day = s => Math.floor(s.hours / 24);
export const starPrice = cr => Math.round(cr * STAR_RATE);

// ---------- buying: one currency, charged once, all or nothing ----------
// pay(cur, n) -> { ok, msg? } takes the money. Returns { ok, msg, cost, cur }.
export function buyOp(s, cur, have, pay) {
  cur = cur === 'stars' ? 'stars' : 'cr'; const price = cur === 'stars' ? starPrice(PRICES.op) : PRICES.op, unit = cur === 'stars' ? '⭐' : 'cr';
  if (s.owned) return { ok: false, msg: 'The gulch is already yours.', owned: true };
  if (!((have?.[cur] ?? 0) >= price)) return { ok: false, msg: `The gulch costs ${price.toLocaleString('en-US')} ${unit}. You have ${Math.max(0, Math.floor(have?.[cur] || 0)).toLocaleString('en-US')} ${unit}.`, short: true };
  const r = pay(cur, price); if (!r?.ok) return { ok: false, msg: r?.msg || 'Payment refused.' };
  s.owned = true; s.paidWith = cur; s.racks = [];
  return { ok: true, cost: price, cur, msg: `🏴 ${SITE.name} is yours. No questions, no paperwork. Put in a grow rack.` };
}
export function addRack(s, cur, have, pay) {
  cur = cur === 'stars' ? 'stars' : 'cr'; const price = cur === 'stars' ? starPrice(PRICES.rack) : PRICES.rack, unit = cur === 'stars' ? '⭐' : 'cr';
  if (!s.owned) return { ok: false, msg: 'Buy the gulch first.' };
  if (s.racks.length >= LIMITS.racks) return { ok: false, msg: `The net only covers ${LIMITS.racks} racks.` };
  if (!((have?.[cur] ?? 0) >= price)) return { ok: false, msg: `A grow rack is ${price} ${unit}.`, short: true };
  const r = pay(cur, price); if (!r?.ok) return { ok: false, msg: r?.msg || 'Payment refused.' };
  const rk = freshRack(); rk.id = s.nextId++; s.racks.push(rk);
  return { ok: true, cost: price, cur, rack: s.racks.length - 1, msg: `🪴 Grow rack ${s.racks.length} is in under the net. Plant something.` };
}
export function canPlant(s, i, crop, credits) {
  const r = s.racks[i], c = CROPS[crop]; if (!s.owned) return { ok: false, why: 'Buy the gulch first.' };
  if (!r) return { ok: false, why: 'No rack there.' }; if (!c) return { ok: false, why: 'Unknown crop.' };
  if (r.crop) return { ok: false, why: 'That rack is already planted.' }; if (credits < c.seed) return { ok: false, why: `${c.name} spores are ${c.seed} cr.` };
  return { ok: true, cost: c.seed };
}
export function plant(s, i, crop) { const r = s.racks[i]; r.crop = crop; r.growth = 0; r.health = 100; r.planted = s.hours; s.stats.planted++; return r; }
export const yieldOf = r => { const c = CROPS[r?.crop]; return c ? Math.max(0, Math.floor(c.yield * r.health / 100 + 1e-9)) : 0; };
export function harvest(s, i) {
  const r = s.racks[i]; if (!r?.crop) return { ok: false, why: 'Nothing planted there.' }; if (r.growth < 1) return { ok: false, why: `Not ripe yet (${Math.floor(r.growth * 100)}%).` };
  const crop = r.crop, n = yieldOf(r), room = Math.max(0, LIMITS.stash - stashCount(s)), got = Math.min(n, room);
  if (got > 0) s.stash[crop] = (s.stash[crop] || 0) + got;
  const id = r.id; s.racks[i] = { ...freshRack(), id }; s.stats.harvested += got;
  return { ok: true, crop, n: got, lost: n - got };
}
// growth: stolen grid power and a recycled-water drip, so no tanks to fill. Ripe crops wait.
export function advance(s, dh) {
  const out = { ripe: [] }; if (!(dh > 0)) return out; dh = Math.min(dh, 24 * 14); s.hours += dh; if (!s.owned) return out;
  s.racks.forEach((r, i) => { const c = CROPS[r.crop]; if (!c || r.growth >= 1 || r.health <= 0) return; const was = r.growth; r.growth = clamp(r.growth + dh / c.hours, 0, 1); if (r.growth > 0.99999) r.growth = 1; if (was < 1 && r.growth >= 1) out.ripe.push(i); });
  return out;
}

// ---------- selling ----------
export function hash(n) { let x = (n | 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }
export const dayMult = (d, crop) => Math.round((0.85 + 0.3 * hash(d * 173 + (CROP_IDS.indexOf(crop) + 1) * 29)) * 100) / 100;
export const unitPrice = (d, crop, buyer = 'skiv') => { const c = CROPS[crop], b = BUYERS[buyer]; return c && b ? Math.max(1, Math.round(c.price * dayMult(d, crop) * b.mult)) : 0; };
export function quoteSale(s, buyer, crop, qty) {
  const b = BUYERS[buyer], have = s.stash[crop] | 0; if (!b) return { ok: false, why: 'Nobody here buys that.' };
  if (!CROPS[crop]) return { ok: false, why: 'Unknown crop.' }; if (!have) return { ok: false, why: `No ${CROPS[crop].name} in your stash.` };
  qty = qty == null ? have : Math.min(Math.max(1, qty | 0), have); const unit = unitPrice(day(s), crop, buyer);
  return { ok: true, buyer, crop, qty, unit, cash: unit * qty };
}
export function applySale(s, q) { s.stash[q.crop] -= q.qty; if (s.stash[q.crop] <= 0) delete s.stash[q.crop]; s.stats.sold += q.qty; s.stats.earned += q.cash; return s; }

// ---------- heat + the ColSec raid (fun, not punishing) ----------
// roll(r) -> true when a heat-raising action gets you noticed. A raid only follows heat, with a cooldown.
export const heatRoll = (chance, r) => r < chance;
export const raidDue = (s, r) => s.owned && s.hours - s.lastRaidH >= RAID.cooldownH && r < RAID.chance;
// an ignored raid seizes a quarter of the stash (at most RAID.seizeMax units), never racks or crops in the ground
export function seize(s) {
  let left = Math.min(RAID.seizeMax, Math.ceil(stashCount(s) * RAID.seize - 1e-9)); const took = {}; let n = 0;
  for (const k of [...CROP_IDS].reverse()) { if (left <= 0) break; const t = Math.min(left, s.stash[k] | 0); if (t > 0) { took[k] = t; n += t; left -= t; s.stash[k] -= t; if (!s.stash[k]) delete s.stash[k]; } }
  s.stats.seized += n; return { took, n };
}

// ---------- the sandworm hook: damage(plotId) wipes one rack's crop; restore(plotId, snap) regrows it ----------
export function damage(s, id) {
  const i = s.racks.findIndex(r => r.id === id); if (i < 0) return { ok: false, why: 'No such rack.' }; const r = s.racks[i];
  if (!r.crop) return { ok: false, why: 'Nothing growing there.', empty: true };
  const snap = { crop: r.crop, growth: r.growth, health: r.health, planted: r.planted };
  s.racks[i] = { ...freshRack(), id }; s.stats.eaten++;
  return { ok: true, id, i, snap };
}
export function restore(s, id, snap) {
  const i = s.racks.findIndex(r => r.id === id); if (i < 0 || !snap || !CROPS[snap.crop]) return { ok: false };
  if (s.racks[i].crop) return { ok: false, why: 'Replanted already.' };
  s.racks[i] = { crop: snap.crop, growth: clamp(+snap.growth || 0, 0, 1), health: clamp(+snap.health || 100, 1, 100), planted: +snap.planted || 0, id };
  return { ok: true, i };
}

// ---------- idempotent actions (same contract as farmcore.makeActGuard: busy lock + 300 ms dedupe) ----------
export const ACT_MS = 300;
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
export function dirWord(dx, dz) { const a = Math.atan2(dx, -dz) * 180 / Math.PI, i = Math.round(((a % 360) + 360) % 360 / 45) % 8; return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][i]; }
export function directions(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz);
  if (d < 14) return `You're at ${SITE.name}. Tap 🏴 Gulch.`;
  return `Go to ${SITE.name} (${d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km'} ${dirWord(dx, dz)}) and tap 🏴 Gulch.`;
}
