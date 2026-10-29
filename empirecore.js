// v7.5.5 Empire layer (Ben): pure logic, no DOM and no THREE. Property catalogue, prices, income on the game clock,
// rival-gang threat odds from rep + turf, extortion demands, defend-raid plans, the save format and the context button.
// empire.js renders and drives it; tests/test-empire-unit.mjs covers it in node. Fiction only: invented businesses and gangs.
//
// Positions are AJ-relative metres (Ares Junction centre; x east, z south, the frame every Mars data pack uses). Each spot was
// probed in the browser: flat ground, no building collider within 6 m, 20+ m from the Beltway and from the turf flags, and
// clear of Ben's base lots (PR #24), Pumpkin's dealer lots / car meet and the district shop doors.

export const SAVE_KEY = 'ssx.empire.v1';
export const VERSION = 1;

// rival crews (ids match SSX.turf / SSX.rep): who leans on which district when the turf map doesn't say otherwise
export const GANGS = {
  saltblood: { name: 'Saltblood', types: ['thug', 'goon', 'enforcer'] },
  dustjaws: { name: 'Dustjaw Boys', types: ['thug', 'thug', 'goon'] },
  saints: { name: 'Vacuum Saints', types: ['goon', 'enforcer'] }
};
export const DISTRICT_GANG = { aj: 'dustjaws', 'mars-rough': 'saltblood', 'mars-downtown': 'saints', 'mars-gated': 'saltblood' };

// hourly income shape by business: multiplier per time band (dangercore.timeBand: dawn 5-8, day 8-17, dusk 17-21, night 21-5)
export const KINDS = {
  safehouse: { icon: '🏠', label: 'Safehouse', rate: 0, bands: null, threat: 0.012, extort: false },
  laundromat: { icon: '🧺', label: 'Laundromat', rate: 45, bands: { dawn: 0.9, day: 1.35, dusk: 1.0, night: 0.55 }, threat: 0.035, extort: true },
  bar: { icon: '🍸', label: 'Bar', rate: 70, bands: { dawn: 0.3, day: 0.45, dusk: 1.3, night: 1.8 }, threat: 0.045, extort: true },
  chop: { icon: '🔧', label: 'Chop shop', rate: 55, bands: { dawn: 0.8, day: 1.0, dusk: 1.1, night: 1.2 }, threat: 0.05, extort: true },
  dispensary: { icon: '🌿', label: 'Dispensary', rate: 90, bands: { dawn: 0.5, day: 0.9, dusk: 1.5, night: 1.15 }, threat: 0.04, extort: true }
};

export const PROPS = [
  // safehouses: a save point (rest + save), a stash the cops can't fine, a garage spot (SSX.garage.open when present)
  { id: 'sh-rim', kind: 'safehouse', name: 'Crater Rim Walk-up', district: 'aj', dname: 'Ares Junction', aj: [-80, 70], yaw: 0.6, price: 1200, garage: [7, 1], blurb: 'Third floor, back stairs, a door that locks from the inside. Close to the cantina.' },
  { id: 'sh-flats', kind: 'safehouse', name: 'Tenement 9C', district: 'mars-rough', dname: 'Red Tape Flats', aj: [-290, 0], yaw: 3.1, price: 700, garage: [-7, 1], blurb: 'Cheap, loud, and nobody here talks to ColSec. The neighbours are Saltblood.' },
  { id: 'sh-loft', kind: 'safehouse', name: 'Meridian Loft', district: 'mars-downtown', dname: 'Olympus Row', aj: [45, -460], yaw: -1.4, price: 3000, garage: [7, 2], blurb: 'Glass, steel, a doorman who forgets faces for a tip. Downtown views.' },
  // fronts: passive income on the Mars clock, collected at the counter; rival crews raid or extort them
  { id: 'fr-wash', kind: 'laundromat', name: 'Red Dust Wash & Fold', district: 'aj', dname: 'Ares Junction', aj: [-60, 20], yaw: 1.2, price: 2000, blurb: 'Coin dryers out front, a counting room in back. Busy all day.' },
  { id: 'fr-bar', kind: 'bar', name: 'The Thin Air', district: 'mars-downtown', dname: 'Olympus Row', aj: [-14, -410], yaw: 2.6, price: 3500, blurb: 'Oxygen cocktails and a back booth for quiet deals. Prints money after dark.' },
  { id: 'fr-chop', kind: 'chop', name: 'Rustbucket Parts', district: 'mars-rough', dname: 'Red Tape Flats', aj: [-300, -85], yaw: 0.2, price: 2500, blurb: 'Parts in, VINs out. Drive a stolen ride into the bay to strip it for cash.' },
  { id: 'fr-disp', kind: 'dispensary', name: 'Greenhouse Nine', district: 'mars-gated', dname: 'Helios Heights', aj: [360, 130], yaw: -2.2, price: 5000, blurb: 'Hydroponic "wellness" for the Helios crowd. Licensed, mostly.' }
];
export const propById = id => PROPS.find(p => p.id === id) || null;
export const isFront = p => !!p && p.kind !== 'safehouse';

export const RULES = {
  capHours: 10,            // pending income stops at this many hours of base rate (the till is only so big)
  offlineCapHours: 8,      // income while the game was closed, at the average rate, capped
  maxStepHours: 8,         // one clock jump (sleep, Director time skip) credits at most this many hours
  graceHours: 3,           // a new property isn't hit for this many game hours
  gapHours: 3,             // at least this many game hours between two threats anywhere
  closedHours: 6,          // a front that lost a raid is shut this long (or pay to repair)
  repairFrac: 0.2, secFrac: 0.35, secThreat: 0.5,
  arriveS: 150, arriveSPhone: 180, // real seconds to reach a raided property before it's lost
  replyS: 120,             // real seconds to answer an extortion demand before it counts as a refusal
  protectHours: 12,        // paying a crew buys this many game hours of peace on that property
  defendR: 40, doorR: 6, garageR: 4.5,
  stashLoss: 0.3,          // a lost raid on a safehouse takes this share of the stash credits
  chopBonus: [120, 300]    // stripping a stolen ride at your chop shop
};

// ---------- clock ----------
export function timeBand(h) { return h >= 21 || h < 5 ? 'night' : h >= 17 ? 'dusk' : h < 8 ? 'dawn' : 'day'; }
// game hours between two clock readings (both in [0, 24)): wraps midnight; a big jump (time skip / sleep) is capped
export function hoursBetween(h0, h1, maxStep = RULES.maxStepHours) {
  if (!Number.isFinite(h0) || !Number.isFinite(h1)) return 0;
  const d = ((h1 - h0) % 24 + 24) % 24; return Math.min(d, maxStep);
}
export function rateAt(kind, h) { const K = KINDS[kind]; if (!K || !K.rate) return 0; return K.rate * (K.bands[timeBand(((h % 24) + 24) % 24)] || 1); }
export function avgRate(kind) { const K = KINDS[kind]; if (!K || !K.rate) return 0; let s = 0; for (let h = 0; h < 24; h++) s += rateAt(kind, h + 0.5); return s / 24; }
export const capOf = kind => Math.round((KINDS[kind]?.rate || 0) * RULES.capHours);
// income earned over [h, h + hours) in small slices so a band edge inside the step is counted right
export function earn(kind, h, hours) {
  if (!(hours > 0) || !KINDS[kind]?.rate) return 0; let left = hours, t = h, sum = 0;
  while (left > 1e-9) { const step = Math.min(left, 0.25); sum += rateAt(kind, t + step / 2) * step; t += step; left -= step; }
  return sum;
}

// ---------- save ----------
export function fresh(now = Date.now()) { return { v: VERSION, owned: {}, lastAt: now, lastHour: null, lastThreatH: -99, clockH: 0, threat: null, earned: 0, log: [], stats: { bought: 0, collected: 0, raids: 0, defended: 0, lost: 0, extortions: 0, paid: 0, chopped: 0 }, home: null }; }
export function ownedState(o = {}) { return { at: o.at ?? 0, pending: +o.pending || 0, closedH: +o.closedH || 0, security: !!o.security, protect: o.protect || null, graceH: +o.graceH || 0, stash: { credits: (o.stash?.credits | 0) || 0, medkits: (o.stash?.medkits | 0) || 0 }, hits: o.hits | 0, defended: o.defended | 0 }; }
export function migrate(raw, now = Date.now()) {
  let s = raw; if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
  if (!s || typeof s !== 'object' || s.v !== VERSION) return fresh(now);
  const f = fresh(now), out = { ...f, ...s, stats: { ...f.stats, ...(s.stats || {}) }, owned: {} };
  for (const [id, o] of Object.entries(s.owned || {})) if (propById(id)) out.owned[id] = ownedState(o);
  if (out.threat && !propById(out.threat.prop)) out.threat = null;
  out.log = Array.isArray(s.log) ? s.log.slice(-20) : [];
  return out;
}
// income while the game was closed: real minutes at the fallback clock (1 game hour = 2 real minutes), average rate, capped
export function offline(state, now = Date.now()) {
  const hrs = Math.max(0, Math.min(RULES.offlineCapHours, (now - (state.lastAt ?? now)) / 120000)); let total = 0;
  if (hrs > 0) for (const [id, o] of Object.entries(state.owned)) { const p = propById(id); if (!isFront(p) || o.closedH > 0) continue; const add = Math.min(capOf(p.kind) - o.pending, avgRate(p.kind) * hrs); if (add > 0) { o.pending += add; total += add; } }
  state.lastAt = now; return { hours: +hrs.toFixed(2), total: Math.round(total) };
}
// advance every owned front by `hours` from clock hour h: accrue, count down closures/protection/grace
export function accrue(state, h, hours) {
  if (!(hours > 0)) return 0; let total = 0; state.clockH = (state.clockH || 0) + hours;
  for (const [id, o] of Object.entries(state.owned)) {
    const p = propById(id); if (!p) continue;
    if (o.graceH > 0) o.graceH = Math.max(0, o.graceH - hours);
    if (o.protect && (o.protect.h -= hours) <= 0) o.protect = null;
    if (!isFront(p)) continue;
    if (o.closedH > 0) { o.closedH = Math.max(0, o.closedH - hours); continue; }
    const cap = capOf(p.kind), add = Math.min(Math.max(0, cap - o.pending), earn(p.kind, h, hours));
    if (add > 0) { o.pending += add; total += add; }
  }
  return total;
}

// ---------- buying / collecting ----------
export function canBuy(state, id, credits) {
  const p = propById(id); if (!p) return { ok: false, why: 'No such property.' };
  if (state.owned[id]) return { ok: false, why: 'You already own it.' };
  if ((credits | 0) < p.price) return { ok: false, why: `Need ${p.price} cr (you have ${credits | 0}).` };
  return { ok: true, cost: p.price };
}
export function buy(state, id) { const p = propById(id); state.owned[id] = ownedState({ at: state.clockH || 0, graceH: RULES.graceHours }); state.stats.bought++; return p; }
export function collect(state, id) { const o = state.owned[id]; if (!o) return 0; const n = Math.floor(o.pending); o.pending -= n; state.earned += n; state.stats.collected += n; return n; }
export const securityCost = p => Math.round(p.price * RULES.secFrac / 10) * 10;
export const repairCost = p => Math.round(p.price * RULES.repairFrac / 10) * 10;
export function perHour(state, h) { let s = 0; for (const [id, o] of Object.entries(state.owned)) { const p = propById(id); if (isFront(p) && !(o.closedH > 0)) s += rateAt(p.kind, h); } return Math.round(s); }

// ---------- rival crews: who, how likely, raid or shake-down ----------
// rep (SSX.rep.get: -100..100) -> threat multiplier. Marked crews come hard; Family leaves you be.
export function repMul(rep) { if (rep == null || !Number.isFinite(+rep)) return 1; const r = +rep; return r <= -60 ? 2.5 : r <= -30 ? 2 : r <= -10 ? 1.4 : r < 10 ? 1 : r < 30 ? 0.8 : r < 60 ? 0.5 : 0.2; }
// turf: a property on a block you hold is safer; a crew that lost blocks to you is angrier
export function turfMul({ onYourBlock = false, grudge = 0 } = {}) { return (onYourBlock ? 0.5 : 1) * (1 + Math.min(3, grudge | 0) * 0.25); }
export function gangFor(p, turf) {
  if (turf && turf.owner && turf.owner !== 'player' && GANGS[turf.owner]) return turf.owner;
  if (turf && turf.owner === 'player' && turf.lostBy && GANGS[turf.lostBy]) return turf.lostBy;
  return DISTRICT_GANG[p.district] || 'saltblood';
}
// chance per game hour that this property draws a threat (raid or demand)
export function threatChance(p, o, { rep = null, turf = null, grudge = 0, night = false } = {}) {
  const K = KINDS[p.kind]; if (!K || !o) return 0;
  if (o.graceH > 0 || o.closedH > 0) return 0;
  const g = gangFor(p, turf); if (o.protect && o.protect.gang === g) return 0;
  const onYourBlock = !!turf && turf.owner === 'player';
  return Math.min(0.5, K.threat * repMul(rep) * turfMul({ onYourBlock, grudge }) * (night ? 1.3 : 1) * (o.security ? RULES.secThreat : 1));
}
// raid or shake-down: friendlier crews ask for money first; safehouses only ever get raided
export function threatKind(p, rep, r = Math.random()) { if (!KINDS[p.kind]?.extort) return 'raid'; const share = rep == null ? 0.5 : rep >= 10 ? 0.8 : rep > -20 ? 0.55 : 0.25; return r < share ? 'extort' : 'raid'; }
export function demand(p, o) { const v = (KINDS[p.kind]?.rate || 40) * 4 + (o?.pending || 0) * 0.3; return Math.round(Math.max(100, Math.min(900, v)) / 10) * 10; }
// defend waves: bigger for pricier places and angrier crews, smaller on phones and with security
export function wavePlan(p, { rep = null, mobile = false, security = false } = {}) {
  let waves = p.price >= 3500 ? 3 : 2; if (repMul(rep) >= 2) waves++; if (security) waves--; waves = Math.max(1, Math.min(4, waves));
  const base = mobile ? 2 : 3; return Array.from({ length: waves }, (_, i) => ({ count: Math.min(mobile ? 4 : 6, base + i) }));
}
export function defendReward(p, waves) { return Math.round((60 + p.price * 0.04 + waves * 25) / 10) * 10; }
// pick at most one new threat this hour (global gap, one at a time); rng returns [0,1)
export function rollThreat(state, ctxFor, rng = Math.random) {
  if (state.threat) return null; if ((state.clockH || 0) - (state.lastThreatH ?? -99) < RULES.gapHours) return null;
  for (const [id, o] of Object.entries(state.owned)) {
    const p = propById(id); if (!p) continue; const c = ctxFor(p) || {}; const ch = threatChance(p, o, c);
    if (ch > 0 && rng() < ch) { const kind = threatKind(p, c.rep, rng()); const gang = gangFor(p, c.turf);
      return { prop: id, gang, kind, demand: kind === 'extort' ? demand(p, o) : 0, t: 0, phase: kind === 'extort' ? 'demand' : 'alert', limit: kind === 'extort' ? RULES.replyS : (c.mobile ? RULES.arriveSPhone : RULES.arriveS) }; }
  }
  return null;
}
// a lost raid: a front shuts (pending gone), a safehouse loses part of its stash
export function applyLoss(state, id) {
  const p = propById(id), o = state.owned[id]; if (!p || !o) return { lost: 0 };
  o.hits++; state.stats.lost++;
  if (isFront(p)) { const lost = Math.floor(o.pending); o.pending = 0; o.closedH = RULES.closedHours; return { lost, closedH: o.closedH }; }
  const lost = Math.floor(o.stash.credits * RULES.stashLoss); o.stash.credits -= lost; return { lost, stash: true };
}

// ---------- the context button at a property ----------
// near: { prop, d (door distance), garageD } ; returns { key, label } or null
export function contextFor({ prop, d = 1e9, garageD = 1e9, owned = null, threat = null, driving = false, stolen = false, speed = 0, busy = false, credits = 0, garageOpen = false } = {}) {
  if (!prop || busy) return null; const p = prop;
  if (threat && threat.prop === p.id && threat.phase === 'alert' && d < RULES.defendR) return { key: 'defend', label: '🛡️ Defend' };
  if (driving && speed > 4) return null;
  if (p.kind === 'chop' && owned && driving && stolen && d < 9 && !(owned.closedH > 0)) return { key: 'chopRide', label: '🔧 Strip ride' };
  if (p.garage && owned && garageD < RULES.garageR + (driving ? 2 : 0)) return { key: 'garage', label: garageOpen ? '🔧 Garage' : '🚙 Park here' };
  if (d > RULES.doorR || driving) return null;
  if (!owned) return { key: 'buy', label: `🏷️ Buy ${p.price}` };
  if (isFront(p)) { if (owned.closedH > 0) return { key: 'repair', label: `🔨 Fix ${repairCost(p)}` }; const n = Math.floor(owned.pending); return n > 0 ? { key: 'collect', label: `💵 +${n}` } : { key: 'manage', label: `${KINDS[p.kind].icon} Office` }; }
  return { key: 'rest', label: '🛏️ Rest' };
}
export const fmtClock = h => { const hh = Math.floor(((h % 24) + 24) % 24), mm = Math.floor((h - Math.floor(h)) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };

// ---------- SSX.empire.on('hour', fn): one tick per whole game hour, owned fronts or not ----------
// Whole hours crossed going from float hour `last` to `h` on a 24 h clock (forward only; a jump such as sleeping to morning
// crosses several). Returns the new whole hours in order, at most `max` (a wrap or set() backwards counts as a day ahead).
export function hourCrossings(last, h, max = 24) {
  if (!Number.isFinite(last) || !Number.isFinite(h)) return [];
  const d = ((h - last) % 24 + 24) % 24; if (d < 1e-9) return [];
  const n = Math.min(max, Math.floor(last + d) - Math.floor(last)), out = [];
  for (let k = 1; k <= n; k++) out.push(((Math.floor(last) + k) % 24 + 24) % 24);
  return out;
}
// Pumped from a timer and the surface tick (idempotent: the same clock reading never fires twice). getClock() -> { hour, ... };
// fire(detail) gets { hour, prev, at, catchUp, source, night, band } per whole hour crossed.
export function makeHourTicker(getClock, fire) {
  let last = null, fired = 0, src;
  return {
    pump() {
      let ck; try { ck = getClock(); } catch (e) { return 0; } const h = ck?.hour; if (!Number.isFinite(h)) return 0;
      if (last == null || (ck.source || null) !== src) { last = h; src = ck.source || null; return 0; } // first read, or SSX.time showed up: new baseline, no burst
      const hs = hourCrossings(last, h), prev = last; last = h;
      hs.forEach((hr, k) => { fired++; try { fire({ hour: hr, prev: k ? hs[k - 1] : Math.floor(prev), at: h, catchUp: k < hs.length - 1, source: ck.source || null, night: ck.night ?? null, band: ck.band || null }); } catch (e) { /* listener errors are the caller's */ } });
      return hs.length;
    },
    get last() { return last; }, get fired() { return fired; }, reset() { last = null; }
  };
}

// SSX.raids has one slot. Who holds it: 'free' | 'ours' (an empire-* rival raid) | 'other' (someone else's add-on)
export function raidSlot(active, prefix = 'empire-') { const id = typeof active === 'string' ? active : active?.id; return !id ? 'free' : String(id).startsWith(prefix) ? 'ours' : 'other'; }
