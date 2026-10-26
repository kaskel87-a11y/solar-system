// v7.5.x Mars contraband production (Marsmania): the Vat House, a stash-house lab in Red Tape Flats.
// Pure game abstraction: buy supply crates, hire crew, wait (real time), collect units of the existing fictional
// products from SSX.contraband (Glow-dust, Low-G, Red Static). No real substances, steps or equipment; the vats, the
// reactor hum and "the batch" are all there is. Fiction only, no real brands.
//
// Integrations are all feature-detected and optional:
//  SSX.base (Ben's mars-base PR)   -> the Vat House is fitted out on Ben's Flats Scrap Lot ('flats-scrap'): you buy the
//                                     lot through SSX.base.buy(), the lab adds a fit-out fee, Ben's turrets on that lot
//                                     count toward raid defence and arm during a lab raid. Ben's 💰 stash (credits/medkits)
//                                     is untouched: the lab's product sits in its own locker (see LAB.md).
//                                     Without SSX.base the Vat House is its own building at Flats AJ [-330, 12].
//  SSX.raids (Steve's PR #13)       -> live raid defence when you're at the lab; else turf-style waves via
//                                     SSX.city.hostiles / game.hostiles.
//  SSX.contraband                   -> products, Flats street prices for runner sales, collect() adds to your stash
//                                     (carry limits respected, overflow stays in the locker), purity -> freshness,
//                                     pressed Glow-dust bricks (barter.json glow_dust_brick) at purity 2+.
//  SSX.rep (PR #20)                 -> rival raid odds follow your rep with the Flats crews.
//  SSX.bribes (PR #23)              -> a live Rusk patrol sheet halves heat gain, speeds heat decay and gives raid warnings.
//
// window.SSX.lab
//  status()            -> { owned, site, at:[x,z], product, products, supplies, supplyMax, batch:{ pct, secLeft, running, why },
//                           locker:{ [item]: qty }, lockerUsed, lockerMax, till, heat, upgrades:{ id:{ level, damaged, next } },
//                           crew:{ role:{ hired, owed, mood } }, raid, downtime, perHour, stats }
//  buy()               -> { ok, msg } buy / fit out the Vat House (be at its door, or opts.force)
//  buySupplies(n = 1)  -> { ok, qty, cost, msg }
//  setProduct(id)      -> { ok, msg }   'glowdust' | 'lowg' | 'redstatic' (needs purity 1)
//  upgrade(id)         -> { ok, level, cost, msg }  'capacity' | 'purity' | 'speed' | 'security'
//  repair(id)          -> { ok, cost, msg }        fix an upgrade a lost raid damaged
//  hire(role) / fire(role) -> { ok, msg }          'cook' | 'guard' | 'runner'
//  payCrew()           -> { ok, paid, msg }        settle back wages from your wallet
//  collect()           -> { ok, moved:{ item: qty }, till, left, msg }  product -> SSX.contraband stash, till -> wallet
//  qualityMult(item, have?) -> price factor (1..1.4) for that item in your stash, by the share that came from the Vat House and
//                         its purity at collect. contraband buyerPrice multiplies it in (guarded) once PR #18 lands.
//  layLow() / greaseBeat() -> heat control: pause the vats 3 min (-30 heat), or pay the beat cop (-40 heat)
//  on(event, fn) | on(fn) -> unsubscribe. Events: buy supplies batch collect sale payday skim quit hire fire upgrade
//                           repair product heat warn raid wave raid:win raid:lose laylow grease change.
//  open() / close()    -> the lab panel (☰ "🛢️ Vat House", key [ , dock 🛢️ on #ssxDock when present, the door beacon)
//  debug               -> goto(), advance(sec), heat(n), raid('gang'|'colsec'), arrive(), clearWave(), resolve(win),
//                         grant(credits), reset(), state(), engine()
// Also window event 'ssx:lab' and SSX.emit('lab:<event>'). Persistence: localStorage 'ssx.lab.v1'.
import * as THREE from 'three';

const KEY = 'ssx.lab.v1', HOTKEY = 'BracketLeft';
const OWN_AT = [-330, 12];                 // standalone Vat House door (AJ), inside Red Tape Flats, clear of roads and contacts
const BASE_PLOT = 'flats-scrap', BASE_AJ = [-180, -66], BASE_DOOR = [0, 14]; // Ben's lot centre + door offset (outside the 20 m grid)
const PRICE_OWN = 1400, PRICE_FITOUT = 600, SUPPLY_COST = 110;
const OFFLINE_CAP_SEC = 4 * 3600, PAY_EVERY = 600, RUN_EVERY = 120, CHECK_EVERY = 120, ALERT_T = 60, WARN_T = 90, LEASH_T = 12;
const R_DOOR = 6, R_RAID = 26;
const PRODUCTS = {
  glowdust: { units: 4, sec: 90, heat: 1.2, blurb: 'Steady blue batch. The vats glow all night.' },
  lowg: { units: 6, sec: 70, heat: 0.8, blurb: 'Fast, cheap gel batch. Spoils quick, so sell quick.' },
  redstatic: { units: 2, sec: 150, heat: 2.5, needs: 1, blurb: 'Slow red batch. The reactor hum goes sour. Needs a purity 1 clean room.' }
};
const UPGRADES = {
  capacity: { name: 'Bigger vats', icon: '🛢️', prices: [400, 900, 1800], blurb: 'More supply racks and locker space.' },
  purity: { name: 'Clean room', icon: '✨', prices: [500, 1200, 2400], blurb: 'Better batches: fresher product, better runner prices, bricks at level 2.' },
  speed: { name: 'Reactor overclock', icon: '⚙️', prices: [450, 1000, 2000], blurb: 'Shorter batches. The hum goes up an octave.' },
  security: { name: 'Cameras & shutters', icon: '📹', prices: [350, 800, 1600], blurb: 'Fewer raids, smaller losses. Level 2 cameras spot raids early.' }
};
const SUPPLY_MAX = [6, 10, 16, 24], LOCKER_MAX = [24, 40, 64, 100], SPEED = [1, 0.8, 0.65, 0.5];
const PURITY_FRESH = [0.75, 0.85, 0.95, 1], PURITY_MULT = [1, 1.1, 1.25, 1.4], SEC_DEF = [0, 0.15, 0.3, 0.45];
const CREW = {
  cook: { name: 'Pipes', title: 'Cook', icon: '🧑‍🔧', wage: 30, hire: 60, blurb: 'Tends the vats while you\u2019re gone. Unpaid, Pipes skims the batch.' },
  guard: { name: 'Tuli Brickhand', title: 'Guard', icon: '💪', wage: 25, hire: 50, blurb: 'Fewer, smaller raids. Unpaid, Tuli naps through them.' },
  runner: { name: 'Skitter', title: 'Runner', icon: '🏃', wage: 20, hire: 40, blurb: 'Sells 40% of the locker at Flats prices every 2 min for a 25% cut.' }
};
const GANGS = { saltblood: { name: 'Saltblood', types: ['thug', 'goon', 'enforcer'] }, dustjaws: { name: 'Dustjaw Boys', types: ['thug', 'thug', 'goon'] }, saints: { name: 'Vacuum Saints', types: ['goon', 'enforcer'] } };
const COLSEC = { name: 'ColSec', types: ['guard', 'sdrone', 'guard'] };

// ---------- state ----------
const fresh = () => ({ v: 1, owned: false, site: null, product: 'glowdust', supplies: 0, progress: 0, locker: {}, till: 0, heat: 0, bricks: true,
  up: { capacity: 0, purity: 0, speed: 0, security: 0 }, damaged: {}, crew: { cook: { hired: false, owed: 0 }, guard: { hired: false, owed: 0 }, runner: { hired: false, owed: 0 } },
  inStash: {}, lastAt: Date.now(), payAt: Date.now(), runAt: Date.now(), downUntil: 0, pauseUntil: 0, stats: { made: 0, sold: 0, earned: 0, wages: 0, raids: 0, won: 0, lost: 0 } });
let S = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { const f = fresh(); return { ...f, ...s, up: { ...f.up, ...s.up }, crew: { ...f.crew, ...s.crew }, stats: { ...f.stats, ...s.stats }, damaged: s.damaged || {}, locker: s.locker || {}, inStash: s.inStash || {} }; } } catch (e) { /* fresh */ } return fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };

// ---------- plumbing ----------
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const CB = () => window.SSX?.contraband, BASE = () => (typeof window.SSX?.base?.state === 'function' ? window.SSX.base : null);
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* no HUD */ } };
const radio = (text, contact) => { try { if (window.SSX?.city?.radio) return window.SSX.city.radio(text, contact); } catch (e) { /* fall through */ } toast(`📻 ${contact}: ${text}`, 4200); };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const credits = () => game()?.progress?.credits ?? 0;
const spend = n => { try { return !!game()?.spend?.(n); } catch (e) { return false; } };
const pay = n => { try { game()?.reward?.(0, n); } catch (e) { /* ignore */ } };
const itemDef = id => { try { return CB()?.items?.().find(i => i.id === id) || null; } catch (e) { return null; } };
const itemName = id => itemDef(id)?.name || ({ glowdust: 'Glow-dust', lowg: 'Low-G', redstatic: 'Red Static', glow_dust_brick: 'Glow-dust brick' })[id] || id;
const itemIcon = id => itemDef(id)?.icon || '📦';
const dirTo = (from, to) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180 / Math.PI) + 360) % 360 / 45) % 8];
const subs = new Map();
function emit(type, extra = {}) {
  const ev = { type, ...extra };
  for (const k of [type, '*']) for (const f of subs.get(k) || []) { try { f(ev); } catch (e) { console.warn('lab listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:lab', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('lab:' + type, ev); } catch (e) { /* bus optional */ }
  if (type !== 'change') emit('change', { what: type });
}
function on(a, b) { const [k, f] = typeof a === 'function' ? ['*', a] : [String(a), b]; if (typeof f !== 'function') return () => {}; if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(f); return () => subs.get(k)?.delete(f); }
function here() { const i = surf()?.info; if (!i || i.name !== 'Mars' || !i.colony) return null; return { x: i.x - i.colony.x, z: i.z - i.colony.z, info: i, cx: i.colony.x, cz: i.colony.z }; }

// site: Ben's lot when SSX.base is around (or you bought it there), else the standalone building
const site = () => S.site || (BASE() ? 'base' : 'own');
function baseCentre() { try { const p = BASE()?.plots?.().find(q => q.id === BASE_PLOT); if (p?.aj) return p.aj; } catch (e) { /* fall back */ } return BASE_AJ; }
const doorAt = () => site() === 'base' ? [baseCentre()[0] + BASE_DOOR[0], baseCentre()[1] + BASE_DOOR[1]] : OWN_AT;
const raidAt = () => site() === 'base' ? baseCentre() : OWN_AT; // inside Ben's lot so his turrets arm
const plotOwned = () => { try { return !!BASE()?.state?.(BASE_PLOT)?.owned; } catch (e) { return false; } };
const turrets = () => { try { return site() === 'base' ? (BASE()?.state?.(BASE_PLOT)?.pieces || []).filter(p => p.type === 'turret').length : 0; } catch (e) { return 0; } };

// ---------- economy ----------
const lvl = id => Math.max(0, (S.up[id] | 0) - (S.damaged[id] ? 1 : 0)); // a damaged upgrade works one level down
const supplyMax = () => SUPPLY_MAX[lvl('capacity')], lockerMax = () => LOCKER_MAX[lvl('capacity')];
const lockerUsed = () => Object.values(S.locker).reduce((a, b) => a + (b | 0), 0);
const batchSec = () => PRODUCTS[S.product].sec * SPEED[lvl('speed')];
const crewOn = r => S.crew[r]?.hired;
const crewSulking = r => crewOn(r) && S.crew[r].owed >= 2;
const patrolSheet = () => { try { return (window.SSX?.bribes?.record?.().tipoffSec || 0) > 0; } catch (e) { return false; } };
const wagesPerPeriod = () => Object.keys(CREW).reduce((n, r) => n + (crewOn(r) ? CREW[r].wage : 0), 0);
function whyIdle(present) {
  if (!S.owned) return 'not yours yet';
  if (Date.now() < S.downUntil) return 'wrecked after a raid';
  if (Date.now() < S.pauseUntil) return 'laying low';
  if (S.supplies <= 0) return 'out of supplies';
  if (lockerUsed() >= lockerMax()) return 'locker full';
  if (!crewOn('cook') && !present) return 'no cook: only runs while you\u2019re here';
  return null;
}
function addHeat(n) { const was = S.heat; S.heat = clamp(S.heat + n, 0, 100); if (Math.floor(was / 25) !== Math.floor(S.heat / 25)) emit('heat', { heat: Math.round(S.heat) }); }
function finishBatch() {
  const P = PRODUCTS[S.product]; S.supplies--; let units = P.units;
  if (crewSulking('cook')) { units = Math.max(1, Math.floor(units * 0.75)); if (Math.random() < 0.3) emit('skim', { role: 'cook', units: P.units - units }); }
  const room = Math.max(0, lockerMax() - lockerUsed()), q = Math.min(units, room);
  S.locker[S.product] = (S.locker[S.product] | 0) + q; S.stats.made += q;
  addHeat(q * P.heat * (patrolSheet() ? 0.5 : 1) * (1 - SEC_DEF[lvl('security')] / 2));
  emit('batch', { item: S.product, qty: q, supplies: S.supplies });
}
function produce(sec, present) { // real-time vats
  let guard = 0; while (sec > 0 && guard++ < 5000) {
    if (whyIdle(present)) { S.progress = Math.min(S.progress, batchSec()); return; }
    const rate = crewOn('cook') ? 1 : 0.5, need = (batchSec() - S.progress) / rate;
    if (sec >= need) { sec -= need; S.progress = 0; finishBatch(); } else { S.progress += sec * rate; sec = 0; }
  }
}
function coolHeat(sec) { S.heat = Math.max(0, S.heat - sec / 60 * (patrolSheet() ? 3 : 1.5)); }
function unitPrice(item) {
  let p = 0; try { p = CB()?.buyerPrice?.(item, 'red-tape-flats') || 0; } catch (e) { /* none */ }
  if (!p) p = { glowdust: 70, lowg: 38, redstatic: 128, glow_dust_brick: 400 }[item] || 30;
  return p / qualityMult(item) * PURITY_MULT[lvl('purity')]; // locker product: its own purity, not the stash's
}
// lab-quality price factor for product in your contraband stash (read by contraband buyerPrice's modMult list, PR #18).
// Tracks how many stash units of each item came from the Vat House and at what purity; sells from a mixed stack are
// assumed to come out evenly, so the share is clamped to what the stash still holds.
// have = stash qty; contraband passes it in (its stash() prices through buyerPrice, so we must not call back into it)
let qmBusy = false;
function qualityMult(item, have) {
  const m = S.inStash[item]; if (!m || !(m.qty > 0)) return 1;
  if (!Number.isFinite(have)) { if (qmBusy) return 1; qmBusy = true; try { have = CB()?.stash?.().items?.[item]?.qty | 0; } catch (e) { return 1; } finally { qmBusy = false; } }
  if (have <= 0) { delete S.inStash[item]; return 1; }
  if (m.qty > have) m.qty = have;
  return Math.round((1 + (m.q - 1) * (m.qty / have)) * 1000) / 1000;
}
function runnerSale() {
  if (!crewOn('runner') || !S.owned) return 0;
  const id = Object.keys(S.locker).filter(k => S.locker[k] > 0).sort((a, b) => S.locker[b] - S.locker[a])[0]; if (!id) return 0;
  const n = Math.min(6, Math.ceil(S.locker[id] * 0.4)); const cut = crewSulking('runner') ? 0.5 : 0.75;
  const credits = Math.round(n * unitPrice(id) * cut); S.locker[id] -= n; if (S.locker[id] <= 0) delete S.locker[id];
  S.till += credits; S.stats.sold += n; S.stats.earned += credits; addHeat(n * 0.3);
  emit('sale', { item: id, qty: n, credits, till: S.till }); return credits;
}
function payday(offline) {
  for (const r of Object.keys(CREW)) {
    if (!crewOn(r)) continue; const c = S.crew[r], w = CREW[r].wage;
    if (S.till >= w) { S.till -= w; c.owed = 0; S.stats.wages += w; continue; }
    if (spend(w)) { c.owed = 0; S.stats.wages += w; continue; }
    c.owed++;
    if (c.owed >= 4) { c.hired = false; c.owed = 0; emit('quit', { role: r }); if (!offline) toast(`🚪 ${CREW[r].name} (${CREW[r].title}) quit. Four paydays with nothing.`, 3600); }
    else if (c.owed === 2) { emit('skim', { role: r }); if (!offline) toast(`😒 ${CREW[r].name} hasn\u2019t been paid. Expect skimming.`, 3200); }
  }
  emit('payday', { wages: wagesPerPeriod(), till: S.till });
}
function catchUp() { // wall clock: offline catch-up capped at 4 h, like turf income
  const now = Date.now(), el = clamp((now - (S.lastAt || now)) / 1000, 0, OFFLINE_CAP_SEC); S.lastAt = now; if (!S.owned) { S.payAt = S.runAt = now; return 0; }
  const start = now - el * 1000; if (S.payAt < start) S.payAt = start; if (S.runAt < start) S.runAt = start;
  let t = start, sold = 0; const off = el > 20;
  while (t < now) {
    const nx = Math.min(now, t + 30000, S.runAt + RUN_EVERY * 1000, S.payAt + PAY_EVERY * 1000), dt = Math.max(0, (nx - t) / 1000);
    produce(dt, !off && nearDoor(R_RAID)); coolHeat(dt); t = nx;
    if (t >= S.runAt + RUN_EVERY * 1000) { S.runAt += RUN_EVERY * 1000; sold += runnerSale(); }
    if (t >= S.payAt + PAY_EVERY * 1000) { S.payAt += PAY_EVERY * 1000; payday(off); }
    if (nx === t && dt === 0) t += 1000;
  }
  if (off && el > 120) { emit('catchup', { sec: Math.round(el), sold }); if (sold || lockerUsed()) toast(`🛢️ Vat House while you were out (${fmtT(el)}): locker ${lockerUsed()}/${lockerMax()}${sold ? `, runner made ${sold} cr` : ''}.`, 3600); }
  save(); return el;
}
function nearDoor(r = R_DOOR) { const h = here(); if (!h) return false; const d = doorAt(); return Math.hypot(h.x - d[0], h.z - d[1]) < r; }

// ---------- actions ----------
function buy(opts = {}) {
  if (S.owned) return { ok: false, msg: 'The Vat House is already yours.' };
  if (!opts.force && !nearDoor(R_DOOR + 4)) return { ok: false, msg: 'Get to the Vat House door first. Its beacon is lit.' };
  const s = BASE() ? 'base' : 'own';
  if (s === 'base' && !plotOwned()) {
    let r = null; try { r = BASE().buy(BASE_PLOT); } catch (e) { r = { ok: false, why: e.message }; }
    if (!plotOwned()) return { ok: false, msg: `Buy the Flats Scrap Lot first (Mars base): ${r?.why || r?.msg || 'not enough credits'}.` };
  }
  const cost = s === 'base' ? PRICE_FITOUT : PRICE_OWN;
  if (!spend(cost)) return { ok: false, msg: `Need ${cost} cr to ${s === 'base' ? 'fit out the Vat House' : 'buy the Vat House'}.` };
  S.owned = true; S.site = s; S.lastAt = S.payAt = S.runAt = Date.now(); save();
  emit('buy', { site: s, cost }); syncBeacon(); return { ok: true, msg: `🔑 The Vat House is yours (${cost} cr). Buy supply crates and get the vats humming.` };
}
function buySupplies(n = 1) {
  if (!S.owned) return { ok: false, qty: 0, cost: 0, msg: 'Get the Vat House first.' };
  n = Math.max(0, Math.min(n | 0, supplyMax() - S.supplies)); if (!n) return { ok: false, qty: 0, cost: 0, msg: `Supply racks full (${supplyMax()}).` };
  const can = Math.min(n, Math.floor(credits() / SUPPLY_COST)); if (!can) return { ok: false, qty: 0, cost: 0, msg: `A supply crate is ${SUPPLY_COST} cr.` };
  const cost = can * SUPPLY_COST; if (!spend(cost)) return { ok: false, qty: 0, cost: 0, msg: 'Payment failed.' };
  S.supplies += can; save(); emit('supplies', { qty: can, cost, supplies: S.supplies });
  return { ok: true, qty: can, cost, msg: `📦 ${can} supply crate${can > 1 ? 's' : ''} racked (${cost} cr).` };
}
function setProduct(id) {
  const P = PRODUCTS[id]; if (!P) return { ok: false, msg: 'Unknown product.' };
  if (P.needs && lvl('purity') < P.needs) return { ok: false, msg: `${itemName(id)} needs a purity ${P.needs} clean room.` };
  if (S.product !== id) { S.product = id; S.progress = 0; save(); emit('product', { item: id }); }
  return { ok: true, msg: `The vats switch to ${itemName(id)}. The batch restarts.` };
}
function upgrade(id) {
  const U = UPGRADES[id]; if (!U) return { ok: false, msg: 'Unknown upgrade.' }; if (!S.owned) return { ok: false, msg: 'Get the Vat House first.' };
  if (S.damaged[id]) return { ok: false, msg: `Repair the ${U.name} first.` };
  const l = S.up[id] | 0; if (l >= U.prices.length) return { ok: false, level: l, msg: `${U.name} is maxed.` };
  const cost = U.prices[l]; if (!spend(cost)) return { ok: false, level: l, cost, msg: `${U.name} ${l + 1} costs ${cost} cr.` };
  S.up[id] = l + 1; save(); emit('upgrade', { id, level: l + 1, cost }); return { ok: true, level: l + 1, cost, msg: `${U.icon} ${U.name} → level ${l + 1}.` };
}
const repairCost = id => Math.round((UPGRADES[id]?.prices[Math.max(0, (S.up[id] | 0) - 1)] || 0) * 0.4);
function repair(id) {
  if (!S.damaged[id]) return { ok: false, msg: 'Nothing to repair.' }; const cost = repairCost(id);
  if (!spend(cost)) return { ok: false, cost, msg: `Repair costs ${cost} cr.` };
  delete S.damaged[id]; save(); emit('repair', { id, cost }); return { ok: true, cost, msg: `🔧 ${UPGRADES[id].name} fixed (${cost} cr).` };
}
function hire(role) {
  const C = CREW[role]; if (!C) return { ok: false, msg: 'Unknown role.' }; if (!S.owned) return { ok: false, msg: 'Get the Vat House first.' };
  if (crewOn(role)) return { ok: false, msg: `${C.name} already works here.` };
  if (!spend(C.hire)) return { ok: false, msg: `${C.name} wants ${C.hire} cr up front.` };
  S.crew[role] = { hired: true, owed: 0 }; save(); emit('hire', { role }); return { ok: true, msg: `${C.icon} ${C.name} signs on as ${C.title.toLowerCase()} (${C.wage} cr / 10 min).` };
}
function fire(role) {
  const C = CREW[role]; if (!C || !crewOn(role)) return { ok: false, msg: 'Nobody to fire.' };
  S.crew[role] = { hired: false, owed: 0 }; save(); emit('fire', { role }); return { ok: true, msg: `${C.name} clears out the locker room.` };
}
function payCrew() {
  let paid = 0; for (const r of Object.keys(CREW)) { const c = S.crew[r]; if (!c.hired || !c.owed) continue; const due = c.owed * CREW[r].wage; if (spend(due)) { paid += due; c.owed = 0; S.stats.wages += due; } }
  save(); if (paid) emit('payday', { paid }); return { ok: paid > 0, paid, msg: paid ? `💵 Back wages paid: ${paid} cr.` : 'Nobody is owed, or you can\u2019t cover it.' };
}
function collect(opts = {}) {
  if (!S.owned) return { ok: false, msg: 'Get the Vat House first.' };
  if (!opts.force && !nearDoor(R_DOOR + 4)) return { ok: false, msg: 'Collect in person at the Vat House.' };
  const C = CB(), moved = {}, fr = PURITY_FRESH[lvl('purity')];
  if (C?.add) {
    // purity 2+: press Glow-dust into bricks (10 → 1) when the brick item exists (barter.json glow_dust_brick)
    if (S.bricks && lvl('purity') >= 2 && (S.locker.glowdust | 0) >= 10 && itemDef('glow_dust_brick')) {
      const b = Math.floor(S.locker.glowdust / 10); S.locker.glowdust -= b * 10; S.locker.glow_dust_brick = (S.locker.glow_dust_brick | 0) + b; if (!S.locker.glowdust) delete S.locker.glowdust;
    }
    for (const id of Object.keys(S.locker)) {
      const want = S.locker[id] | 0; if (!want) continue; let r = null; try { r = C.add(id, want, fr); } catch (e) { r = null; }
      const q = r?.qty | 0; if (q > 0) { moved[id] = q; S.locker[id] -= q; if (S.locker[id] <= 0) delete S.locker[id];
        const m = S.inStash[id] || { qty: 0, q: 1 }, qm = PURITY_MULT[lvl('purity')]; m.q = (m.q * m.qty + qm * q) / (m.qty + q); m.qty += q; S.inStash[id] = m; }
    }
  }
  const till = Math.floor(S.till); if (till > 0) { S.till -= till; pay(till); }
  save(); const n = Object.values(moved).reduce((a, b) => a + b, 0), left = lockerUsed();
  emit('collect', { moved, till, left });
  const parts = Object.entries(moved).map(([id, q]) => `${q} ${itemName(id)}`);
  const msg = !n && !till ? (left ? (C ? 'Pockets full. The rest stays in the locker.' : 'No contraband stash to carry it in.') : 'Nothing to collect yet.')
    : `📥 ${parts.join(', ') || 'No product'}${till ? ` + ${till} cr from the till` : ''}.${left ? ` ${left} left in the locker (pockets full).` : ''}`;
  return { ok: n > 0 || till > 0, moved, till, left, msg };
}
function layLow() { if (!S.owned) return { ok: false, msg: 'Nothing to hide.' }; S.pauseUntil = Date.now() + 180000; S.heat = Math.max(0, S.heat - 30); if (raid?.phase === 'alert' && raid.kind === 'colsec' && raid.warned) cancelRaid('laylow'); save(); emit('laylow', { heat: S.heat }); return { ok: true, msg: '🤫 Vats off for 3 min. The street forgets a little.' }; }
const greaseCost = () => Math.max(60, Math.round(S.heat * 6 / 5) * 5);
function greaseBeat() {
  if (!S.owned) return { ok: false, msg: 'Nothing to grease.' }; if (S.heat < 10) return { ok: false, msg: 'Heat\u2019s low. Save your money.' };
  const c = greaseCost(); if (!spend(c)) return { ok: false, msg: `The beat cop wants ${c} cr.` };
  S.heat = Math.max(0, S.heat - 40); try { window.SSX?.rep?.add?.('colsec_dirty', 1, 'greased the Flats beat'); } catch (e) { /* optional */ }
  if (raid?.phase === 'alert' && raid.kind === 'colsec') cancelRaid('grease');
  save(); emit('grease', { cost: c, heat: S.heat }); return { ok: true, msg: `💸 ${c} cr to the beat cop. Heat drops.` };
}

// ---------- raids ----------
let raid = null; // { kind:'gang'|'colsec', gang, name, phase:'alert'|'gap'|'fight'|'raid', t, plan, wave, waves, warned, engine, pending, out, since, raidId }
function engine() {
  if (typeof window.SSX?.raids?.start === 'function') return 'raids';
  if (typeof window.SSX?.city?.hostiles === 'function' || typeof game()?.hostiles === 'function') return 'core';
  return 'debug';
}
function rivalGang() { // the Flats crew that likes you least
  const R = window.SSX?.rep; if (!R?.get) return 'saltblood';
  return Object.keys(GANGS).map(g => [g, R.get(g) || 0]).sort((a, b) => a[1] - b[1])[0][0];
}
function defence() { const g = crewOn('guard') && !crewSulking('guard') ? 0.2 : 0; return clamp(0.2 + SEC_DEF[lvl('security')] + g + turrets() * 0.05, 0.1, 0.85); }
function rollRaids() {
  if (!S.owned || raid || Date.now() < S.downUntil) return;
  const stock = lockerUsed() + S.supplies; if (stock <= 0) return;
  const sec = 1 - SEC_DEF[lvl('security')];
  if (S.heat >= 55 && Math.random() < (S.heat - 45) / 150 * sec) return startRaid('colsec');
  const g = rivalGang(), rep = window.SSX?.rep?.get?.(g) || 0;
  const p = (0.04 + Math.max(0, -rep) / 300 + lockerUsed() / 500) * sec * (crewOn('guard') && !crewSulking('guard') ? 0.7 : 1);
  if (Math.random() < p) startRaid('gang', g);
}
function startRaid(kind, gang) {
  if (raid) return { ok: false, msg: 'Already under attack.' };
  const warned = kind === 'colsec' ? (patrolSheet() || lvl('security') >= 2) : lvl('security') >= 2;
  const name = kind === 'colsec' ? COLSEC.name : GANGS[gang]?.name || 'A crew';
  const waves = kind === 'colsec' || S.up.capacity >= 2 ? 3 : 2, small = crewOn('guard') && !crewSulking('guard') ? 1 : 0;
  const plan = Array.from({ length: waves }, (_, i) => Math.max(1, 2 + i - (i === waves - 1 ? small : 0)));
  raid = { kind, gang: kind === 'gang' ? gang : null, name, phase: 'alert', t: warned ? WARN_T : ALERT_T, warned, plan, wave: 0, waves, engine: engine(), pending: 0, out: 0, since: 0, handles: [] };
  if (nearDoor(R_RAID)) raid.t = 4;
  S.stats.raids++; save();
  if (kind === 'colsec') radio(warned ? 'Patrol sheet says ColSec rolls on your Vat House. You\u2019ve got a minute and a half. Lay low or get there.' : 'ColSec vans on the Flats. They\u2019re hitting the Vat House!', warned ? 'Deputy Rusk' : 'Skitter');
  else radio(`${name} are coming for the Vat House stock. Get there!`, crewOn('guard') ? CREW.guard.name : 'Skitter');
  emit(warned ? 'warn' : 'raid', { kind, gang: raid.gang, timeLeft: raid.t, warned }); if (warned) emit('raid', { kind, gang: raid.gang, timeLeft: raid.t, warned });
  return { ok: true, msg: `🚨 ${name} raid on the Vat House.` };
}
function cancelRaid(why) { if (!raid) return; endRaid(); toast(why === 'laylow' ? '🤫 The vans drive past. Nothing to see.' : '💸 The raid gets called off.', 2800); }
function endRaid() {
  const r = raid; if (!r) return; raid = null;
  try { r.unsub?.(); } catch (e) { /* ignore */ }
  if (r.raidId) try { window.SSX?.raids?.stop?.(r.raidId, 'lab'); } catch (e) { /* already over */ }
  if (r.baseRaid) try { BASE()?.endRaid?.(BASE_PLOT, r.result || 'ended'); } catch (e) { /* lot gone */ }
  try { window.SSX?.city?.npcReserve?.('lab', 0); } catch (e) { /* optional */ }
  if (zoneRing) zoneRing.visible = false; renderHud(); render();
}
function startEngineRaid() {
  const r = raid, at = raidAt(); let res = null;
  try { res = window.SSX.raids.start({ id: 'lab-' + Date.now().toString(36), pos: [at[0], at[1]], radius: R_RAID, attackers: r.kind === 'colsec' ? 'colsec' : 'gang', waves: r.plan.map(count => ({ count })), label: `${r.name} raid the Vat House`,
    onWin: () => { if (raid === r) winRaid(); }, onLose: info => { if (raid === r) loseRaid(info?.why === 'down' ? 'down' : 'overrun'); } }); } catch (e) { console.warn('lab raids', e); }
  if (res?.ok) { r.raidId = res.id; r.phase = 'raid'; try { r.unsub = window.SSX.raids.on?.('raid:wave', i => { if (raid === r && (!i?.id || i.id === res.id)) { r.wave = i.wave || r.wave + 1; emit('wave', { wave: r.wave, waves: r.waves, kind: r.kind }); } }); } catch (e) { /* optional */ } return true; }
  r.engine = typeof window.SSX?.city?.hostiles === 'function' || typeof game()?.hostiles === 'function' ? 'core' : 'debug'; return false; // refused (one at a time): own waves
}
const labAgents = () => { try { return (game()?.debug?.agents?.() || []).filter(a => a.src === 'lab'); } catch (e) { return []; } };
function aliveCount(r) { let n = labAgents().length; if (r.engine === 'debug') n += (game()?.debug?.agents?.() || []).filter(a => a.src === 'debug').length; return n; }
function spawnWave(h, r, n) {
  const T = r.kind === 'colsec' ? COLSEC.types : GANGS[r.gang].types, types = Array.from({ length: n }, (_, k) => T[(r.wave + k) % T.length]);
  if (r.engine === 'debug') { let c = 0; for (const t of types) if (game()?.debug?.spawn?.(t, 14, Math.random() * 6)) c++; return c; }
  const at = raidAt(), a = Math.atan2(at[1] - h.z, at[0] - h.x) + (Math.random() - 0.5) * 1.2; let x = h.cx + at[0] + Math.cos(a) * 12, z = h.cz + at[1] + Math.sin(a) * 12;
  try { const q = window.SSX?.city?.freeSpot?.(x, z, 1.2); if (q && isFinite(q.x)) { x = q.x; z = q.z; } } catch (e) { /* keep */ }
  const o = { faction: r.kind === 'colsec' ? 'colsec' : r.gang, r: 5, src: 'lab', aggro: true };
  try { const c = window.SSX?.city; return (c?.hostiles ? c.hostiles(types, x, z, o) : game().hostiles(types, x, z, o)) || 0; } catch (e) { console.warn('lab hostiles', e); return 0; }
}
function arrive() {
  const r = raid; r.phase = 'gap'; r.t = 2.5;
  try { window.SSX?.city?.npcReserve?.('lab', Math.min(8, r.plan[r.plan.length - 1])); } catch (e) { /* optional */ }
  if (r.kind === 'colsec') { try { const w = world(); if (w?.setWanted && (w.wanted | 0) < 2) w.setWanted(2, 'Vat House raid'); } catch (e) { /* optional */ } }
  if (r.engine === 'raids') startEngineRaid();
  // own waves on Ben's lot: SSX.base.raid arms that lot's turrets (it only routes to SSX.raids when that engine exists,
  // and then we'd have used the engine above)
  if (r.engine !== 'raids' && site() === 'base' && typeof BASE()?.raid === 'function') {
    try { const b = BASE().raid(BASE_PLOT, { s: 900, why: 'Vat House raid', attackers: r.kind === 'colsec' ? 'colsec' : 'gang', waves: r.waves }); if (b?.ok) r.baseRaid = b.id; } catch (e) { console.warn('lab base raid', e); }
  }
  toast(`🛡️ Hold the Vat House: ${r.waves} waves of ${r.name}.`, 2600);
}
function stepRaid(dt, h) {
  const r = raid, at = raidAt(), d = Math.hypot(h.x - at[0], h.z - at[1]);
  if (zoneRing) { zoneRing.visible = r.phase !== 'alert'; const y = groundY(h.cx + at[0], h.cz + at[1], h.info.y - 1.7); zoneRing.position.set(h.cx + at[0], y + 0.2, h.cz + at[1]); zoneRing.material.opacity = 0.25 + 0.2 * Math.sin(performance.now() / 260); }
  if (r.phase === 'alert') { r.t -= dt; if (d < R_RAID) arrive(); else if (r.t <= 0) resolveAway(); return; }
  if (game()?.isDown?.()) { loseRaid('down'); return; }
  if (r.phase === 'raid') return;
  if (d > R_RAID + 8) { r.out += dt; if (r.out > LEASH_T) { loseRaid('fled'); return; } } else r.out = 0;
  if (r.phase === 'gap') { r.t -= dt; if (r.t <= 0) { r.wave++; r.pending = r.plan[r.wave - 1]; r.phase = 'fight'; r.since = 0; r.retry = 0; emit('wave', { wave: r.wave, waves: r.waves, kind: r.kind }); toast(`⚔️ Wave ${r.wave}/${r.waves}: ${r.name}`, 1800); } return; }
  r.since += dt; r.retry -= dt;
  if (r.pending > 0 && r.retry <= 0) { const n = spawnWave(h, r, r.pending); r.pending -= n; r.retry = 1; if (n) r.since = 0; else if (r.since > 25) r.pending = 0; }
  const alive = aliveCount(r); r.alive = alive;
  if (r.pending <= 0 && alive === 0 && r.since > 1.2) { if (r.wave >= r.waves) winRaid(); else { r.phase = 'gap'; r.t = 4; toast(`✅ Wave ${r.wave} down. More coming.`, 1600); } }
}
function resolveAway() { const p = defence(); if (Math.random() < p) winRaid(true); else loseRaid('away'); }
function winRaid(away) {
  const r = raid; r.result = 'win'; S.stats.won++;
  if (r.kind === 'colsec') S.heat = Math.max(0, S.heat - 35); else { try { window.SSX?.rep?.add?.(r.gang, -2, 'beat their raid on the Vat House'); } catch (e) { /* optional */ } }
  const cr = away ? 0 : 50 + 25 * r.waves; if (cr) try { game()?.reward?.(20, cr); } catch (e) { /* ignore */ }
  save(); toast(away ? `🛡️ ${crewOn('guard') ? CREW.guard.name : 'The shutters'} held the Vat House against ${r.name}.` : `🛡️ Vat House held. ${r.name} crawl off. +${cr} cr.`, 3600);
  emit('raid:win', { kind: r.kind, gang: r.gang, away: !!away, credits: cr }); endRaid();
}
function loseRaid(why) {
  const r = raid; r.result = 'lose'; const frac = clamp(0.7 - 0.12 * lvl('security') - (crewOn('guard') && !crewSulking('guard') ? 0.1 : 0), 0.2, 0.7), lost = {};
  for (const id of Object.keys(S.locker)) { const q = Math.ceil(S.locker[id] * frac); if (q) { lost[id] = q; S.locker[id] -= q; if (S.locker[id] <= 0) delete S.locker[id]; } }
  const sup = Math.ceil(S.supplies * frac / 2); S.supplies -= sup;
  const ups = Object.keys(UPGRADES).filter(id => (S.up[id] | 0) > 0 && !S.damaged[id]), dmg = ups.length ? pick(ups) : null; if (dmg) S.damaged[dmg] = true;
  if (r.kind === 'colsec') { S.heat = 10; S.till = Math.floor(S.till / 2); }
  S.downUntil = Date.now() + 120000; S.progress = 0; S.stats.lost++; save();
  const msg = { down: 'You went down.', fled: 'You left the fight.', away: 'Nobody held the door.', overrun: 'They overran the vats.' }[why] || 'It went bad.';
  toast(`💀 ${r.name} hit the Vat House. ${msg} Lost ${Object.entries(lost).map(([id, q]) => `${q} ${itemName(id)}`).join(', ') || 'no product'}${sup ? `, ${sup} crates` : ''}${dmg ? `; ${UPGRADES[dmg].name} damaged` : ''}.`, 4400);
  emit('raid:lose', { kind: r.kind, gang: r.gang, why, lost, supplies: sup, damaged: dmg }); endRaid();
}

// ---------- world: door beacon + raid ring ----------
const ray = new THREE.Raycaster(), V0 = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
let terrain = [], terrT = 0;
function terrainMeshes(scene) {
  const now = performance.now(); if (now - terrT < 1500 && terrain.length) return terrain; terrT = now;
  const count = new Map(); for (const c of scene.children) { const m = c.isGroup && c.children[0]; if (m?.isMesh && m.material) count.set(m.material, (count.get(m.material) || 0) + 1); }
  let mat = null, n = 3; for (const [k, v] of count) if (v > n) { n = v; mat = k; }
  terrain = mat ? scene.children.filter(c => c.isGroup && c.children[0]?.material === mat).map(c => c.children[0]) : []; return terrain;
}
function groundY(wx, wz, fallback) { const s = surf(); if (!s?.scene) return fallback; const list = terrainMeshes(s.scene); if (!list.length) return fallback; V0.set(wx, 4000, wz); ray.set(V0, DOWN); ray.far = 8000; const hit = ray.intersectObjects(list, false)[0]; return hit ? hit.point.y : fallback; }
function labelTex(text) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64; const x = c.getContext('2d');
  let fs = 28; x.font = `bold ${fs}px system-ui, sans-serif`; while (fs > 14 && x.measureText(text).width > 290) { fs -= 2; x.font = `bold ${fs}px system-ui, sans-serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; const w = Math.min(314, x.measureText(text).width + 26);
  x.fillStyle = 'rgba(0,0,0,0.88)'; x.fillRect(160 - w / 2, 8, w, 48); x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(160 - w / 2, 8, w, 48); x.fillStyle = '#fff'; x.fillText(text, 160, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let G = null, beacon = null, zoneRing = null, beaconText = '', beaconSite = '';
const beaconLabel = () => `🛢️ VAT HOUSE · ${S.owned ? (raid ? 'UNDER ATTACK' : 'YOURS') : 'FOR SALE'}`;
function build(h) {
  const s = surf(); G = new THREE.Group(); G.name = 'mars-lab'; s.scene.add(G);
  const g = new THREE.Group(), col = 0x7cffd0;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 15; g.add(beam);
  const vat = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.6, 12), new THREE.MeshLambertMaterial({ color: 0x3a3f44, emissive: 0x0b3328 })); vat.position.set(-1.6, 0.8, 0); g.add(vat);
  const vat2 = vat.clone(); vat2.position.set(1.6, 0.8, 0); g.add(vat2);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 12), new THREE.MeshBasicMaterial({ color: col })); glow.position.set(-1.6, 1.62, 0); g.add(glow); const glow2 = glow.clone(); glow2.position.x = 1.6; g.add(glow2);
  const ring = new THREE.Mesh(new THREE.RingGeometry(R_DOOR - 0.4, R_DOOR, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(beaconText = beaconLabel()), transparent: true, depthWrite: false })); sp.position.y = 4.2; sp.scale.set(4.8, 0.96, 1); g.add(sp);
  g.userData = { ring, sp, beam, glow: [glow, glow2] }; G.add(g); beacon = { g, ground: false }; beaconSite = site();
  const d = doorAt(); g.position.set(h.cx + d[0], h.info.y - 1.7, h.cz + d[1]);
  zoneRing = new THREE.Mesh(new THREE.RingGeometry(R_RAID - 0.6, R_RAID, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); zoneRing.rotation.x = -Math.PI / 2; zoneRing.visible = false; G.add(zoneRing);
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); } G = null; beacon = null; zoneRing = null; }
function syncBeacon() { if (!beacon) return; const t = beaconLabel(); if (t !== beaconText) { const m = beacon.g.userData.sp.material; m.map?.dispose(); m.map = labelTex(t); m.needsUpdate = true; beaconText = t; } }

// ---------- tick ----------
let lastT = performance.now(), lastFrame = 0, checkT = CHECK_EVERY, saveT = 0;
function loop() { requestAnimationFrame(loop); const now = performance.now(); if (now - lastFrame < 100) return; const dt = Math.min(0.5, (now - lastT) / 1000); lastT = now; lastFrame = now; try { labTick(dt); } catch (e) { console.warn('lab tick', e); } }
export function labTick(dt) {
  const wall = Date.now();
  if (S.owned) {
    const el = (wall - S.lastAt) / 1000; if (el > 20) catchUp(); else if (el > 0) { S.lastAt = wall; produce(el, nearDoor(R_RAID)); coolHeat(el); }
    if (wall >= S.runAt + RUN_EVERY * 1000) { S.runAt = wall; runnerSale(); }
    if (wall >= S.payAt + PAY_EVERY * 1000) { S.payAt = wall; payday(false); }
    if ((saveT += dt) > 5) { saveT = 0; save(); }
  } else S.lastAt = wall;
  const st = app()?.state, h = here(), s = surf();
  if (!h || !st?.onSurface || st.transitioning) { if (G && (!s || G.parent !== s.scene || !h)) teardown(); if (raid && raid.phase !== 'alert' && !st?.transitioning) loseRaid('fled'); setNear(false); renderHud(); return; }
  if (!G || G.parent !== s.scene || beaconSite !== site()) { teardown(); build(h); }
  const d = doorAt(), dist = Math.hypot(h.x - d[0], h.z - d[1]), i = h.info, now = performance.now();
  if (!beacon.ground && dist < 180) { const y = groundY(h.cx + d[0], h.cz + d[1], null); if (y != null) { beacon.g.position.y = y; beacon.ground = true; } }
  const u = beacon.g.userData, hot = !!raid, running = S.owned && !whyIdle(dist < R_RAID);
  u.ring.material.opacity = (hot ? 0.6 : 0.3) + 0.25 * Math.sin(now / (hot ? 160 : 320)); u.beam.material.opacity = hot ? 0.6 : S.owned ? 0.22 : 0.3;
  for (const g of u.glow) g.material.color.setHex(running ? (Math.sin(now / 400) > 0 ? 0x7cffd0 : 0x46c9a0) : 0x2a2f33);
  syncBeacon();
  setNear(!i.inside && (!i.driving || Math.abs(i.speed) < 4) && dist < R_DOOR);
  if (raid) stepRaid(dt, h);
  else if ((checkT -= dt) <= 0) { checkT = CHECK_EVERY; rollRaids(); }
  renderHud();
}

// ---------- UI (high contrast: black/white, 44px+ targets, window.__onTap) ----------
const css = `
#labPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)} #labPanel.show{display:flex}
#labPanel .wrap{width:min(480px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px/1.35 system-ui,sans-serif}
#labBody{overflow-y:auto;padding:12px 14px 4px;-webkit-overflow-scrolling:touch} #labPanel h2{margin:0 0 4px;font-size:18px} #labPanel h3{margin:12px 0 6px;font-size:14px;letter-spacing:.04em;text-transform:uppercase}
#labPanel .sub{margin:0 0 6px;font-size:12.5px;opacity:.92} #labPanel .row{display:flex;gap:8px;align-items:center;justify-content:space-between;border-top:1px solid #fff4;padding:7px 0}
#labPanel .row small{display:block;font-size:12px;opacity:.85} #labPanel .row > div{min-width:0;flex:1}
#labPanel button{min-height:46px;min-width:64px;padding:4px 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13.5px system-ui,sans-serif;touch-action:manipulation;flex:none}
#labPanel button.main{background:#fff;color:#000} #labPanel button:disabled{opacity:.4} #labPanel .g{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}
#labPanel .bar{height:12px;border:2px solid #fff;border-radius:6px;overflow:hidden;margin:4px 0} #labPanel .bar i{display:block;height:100%;background:#fff}
#labPanel .warn{color:#ffd400} #labPanel .msg{min-height:20px;padding:4px 14px;font-weight:700} #labPanel .foot{display:flex;padding:8px 14px 12px}
#labPanel .foot button{flex:1} #labPanel .seg{display:flex;gap:6px;flex-wrap:wrap} #labPanel .seg button{flex:1} #labPanel .seg button.on{background:#fff;color:#000}
#labAct{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));top:52%;display:none;min-height:52px;min-width:130px;max-width:70vw;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
body.surface #labAct.show{display:block} body.indoors #labAct{display:none!important}
#labHud{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(112px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:6px 6px 6px 12px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:700 13px/1.25 system-ui,sans-serif}
@media (max-width:640px){#labHud{top:calc(256px + env(safe-area-inset-top));width:calc(100vw - 16px)} #labHud .tx{flex:1}}
body.surface #labHud.show{display:flex} #labHud .tx{min-width:0} #labHud .l1,#labHud .l2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #labHud .warn{color:#ffd400}
#labHud button{min-height:44px;min-width:64px;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13.5px system-ui,sans-serif;touch-action:manipulation;flex:none}
`;
let panel = null, body = null, msgEl = null, actBtn = null, hud = null, hudTx = null, hudBtn = null, lastMsg = '', lastTouch = 0, near = false, hudKey = '';
function tap(el, fn) { const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouch < 700) return; if (e?.type === 'pointerup') lastTouch = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function dockButton(id, label, aria, order, fn) {
  const attach = () => { const d = document.getElementById('ssxDock'); if (!d) return false; if (document.getElementById(id)) return true;
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria); b.style.order = String(order); d.appendChild(b); tap(b, fn); return true; };
  if (attach()) return;
  try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no dock button */ }
}
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'labPanel';
  panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Vat House"><div id="labBody"></div><div class="msg" id="labMsg" aria-live="polite"></div><div class="foot"><button id="labClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); body = panel.querySelector('#labBody'); msgEl = panel.querySelector('#labMsg'); tap(panel.querySelector('#labClose'), close);
  actBtn = document.createElement('button'); actBtn.id = 'labAct'; actBtn.type = 'button'; actBtn.setAttribute('aria-label', 'Vat House'); document.body.appendChild(actBtn); tap(actBtn, () => open());
  hud = document.createElement('div'); hud.id = 'labHud'; hud.innerHTML = '<div class="tx"><div class="l1"></div><div class="l2"></div></div><button id="labHudBtn" type="button">Lab</button>'; document.body.appendChild(hud);
  hudTx = [hud.querySelector('.l1'), hud.querySelector('.l2')]; hudBtn = hud.querySelector('#labHudBtn'); tap(hud.querySelector('.tx'), () => open()); tap(hudBtn, () => open());
  dockButton('dockLab', '🛢️\nLab', 'Vat House ([)', 7, toggle);
  addEventListener('keydown', e => {
    if (e.code !== HOTKEY || e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (!app()?.state?.onSurface && !panel.classList.contains('show')) return; e.preventDefault(); toggle();
  });
}
function toggle() { panel?.classList.contains('show') ? close() : open(); }
function open() { ui(); lastMsg = ''; panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render(); }
function close() { panel?.classList.remove('show'); }
function setNear(v) { if (!actBtn) return; if (v !== near) { near = v; actBtn.textContent = `🛢️ Vat House${isTouch() ? '' : ' ([)'}`; actBtn.classList.toggle('show', !!v); } }
function renderHud() {
  if (!hud) return; if (panel?.classList.contains('show')) renderThrottled();
  if (!raid) { if (hud.classList.contains('show')) { hud.classList.remove('show'); hudKey = ''; } return; }
  const r = raid, h = here(), at = raidAt(), d = h ? Math.round(Math.hypot(h.x - at[0], h.z - at[1])) : null; let l1, l2, warn = false;
  if (r.phase === 'alert') { l1 = `🚨 ${r.name.toUpperCase()} → VAT HOUSE`; l2 = `Get there · ⏱ ${fmtT(r.t)}${d != null ? ` · ${d} m ${dirTo([h.x, h.z], at)}` : ''}`; warn = r.t < 20; }
  else { l1 = `🛡️ VAT HOUSE · Wave ${Math.max(1, r.wave)}/${r.waves}`; l2 = r.phase === 'raid' ? `${r.name} inbound` : r.out > 0 ? `Back in the ring! ${fmtT(LEASH_T - r.out)}` : r.phase === 'gap' ? 'Reload. Next wave.' : `${(r.alive ?? 0) + Math.max(0, r.pending)} ${r.name} left`; warn = r.out > 0; }
  const k = l1 + l2 + warn; if (k !== hudKey) { hudKey = k; hudTx[0].textContent = l1; hudTx[1].textContent = l2; hudTx[0].classList.toggle('warn', warn); hudBtn.textContent = r.phase === 'alert' && r.kind === 'colsec' ? 'Hide it' : 'Lab'; }
  hud.classList.add('show');
}
let panelT = 0; function renderThrottled() { const n = performance.now(); if (n - panelT > 1000) { panelT = n; render(); } }
function act(fn) { const r = fn(); lastMsg = r?.msg || ''; render(); }
function render() {
  if (!panel || !panel.classList.contains('show')) return;
  const st = status(), at = nearDoor(R_DOOR + 4), h = here(), d = doorAt(), dist = h ? Math.round(Math.hypot(h.x - d[0], h.z - d[1])) : null;
  let html = `<h2>🛢️ The Vat House</h2><p class="sub">${site() === 'base' ? 'Back room on the Flats Scrap Lot (your Mars base)' : 'A sealed hab off the Red Tape Flats'}${dist != null && !at ? ` · ${dist} m ${dirTo([h.x, h.z], d)}` : ''}. The vats, the reactor hum, the batch. Fiction only.</p>`;
  if (!st.owned) {
    const needLot = BASE() && !plotOwned(), cost = BASE() ? PRICE_FITOUT : PRICE_OWN;
    html += `<p class="sub">Buy supply crates, hire a crew, let the vats run, collect product for your stash. Raids and heat come with it.</p>`;
    html += `<div class="row"><div><b>${needLot ? 'Buy the Flats Scrap Lot, then fit out' : BASE() ? 'Fit out the Vat House' : 'Buy the Vat House'}</b><small>${needLot ? 'The lot is sold through 🏠 Mars base. ' : ''}${cost} cr${needLot ? ' fit-out after the lot' : ''}. You have ${credits()} cr.</small></div><button type="button" class="main" data-a="buy" ${at ? '' : 'disabled'}>${at ? 'Buy' : 'Go there'}</button></div>`;
    if (!at) html += `<p class="sub">Follow the white beam to the door.</p>`;
  } else {
    const b = st.batch, P = PRODUCTS[st.product];
    html += `<h3>The batch</h3><div class="row"><div><b>${itemIcon(st.product)} ${esc(itemName(st.product))}</b> · ${P.units} units / crate<small>${b.running ? `${b.pct}% · ${fmtT(b.secLeft)} left${crewOn('cook') ? '' : ' (half speed, no cook)'}` : `⏸ ${esc(b.why)}`}</small><div class="bar" aria-hidden="true"><i style="width:${b.pct}%"></i></div></div></div>`;
    html += `<div class="seg" role="group" aria-label="Product">${Object.keys(PRODUCTS).map(id => `<button type="button" data-prod="${id}" class="${st.product === id ? 'on' : ''}" ${PRODUCTS[id].needs && lvl('purity') < PRODUCTS[id].needs ? 'disabled' : ''}>${itemIcon(id)} ${esc(itemName(id))}</button>`).join('')}</div>`;
    html += `<div class="row"><div><b>📦 Supplies ${st.supplies}/${st.supplyMax}</b><small>${SUPPLY_COST} cr a crate · one crate per batch</small></div><button type="button" data-sup="1">+1</button><button type="button" data-sup="5">+5</button></div>`;
    const lk = Object.entries(st.locker).map(([id, q]) => `${itemIcon(id)} ${q} ${esc(itemName(id))}`).join(' · ') || 'empty';
    html += `<div class="row"><div><b>🔒 Locker ${st.lockerUsed}/${st.lockerMax}</b><small>${lk}${st.till ? ` · till ${st.till} cr` : ''}</small></div><button type="button" class="main" data-a="collect" ${at ? '' : 'disabled'}>${at ? 'Collect' : 'At door'}</button></div>`;
    const heatTxt = st.heat >= 70 ? 'ColSec are circling' : st.heat >= 45 ? 'people are talking' : 'quiet';
    html += `<h3>Heat</h3><div class="row"><div><b class="${st.heat >= 55 ? 'warn' : ''}">🔥 ${st.heat}/100 · ${heatTxt}</b><small>${patrolSheet() ? 'Rusk\u2019s patrol sheet is live: half heat, early warnings.' : window.SSX?.bribes ? 'A Rusk patrol sheet halves heat and warns you of raids.' : 'Heat builds with every batch and cools slowly.'}</small><div class="bar" aria-hidden="true"><i style="width:${st.heat}%"></i></div></div></div>`;
    html += `<div class="g"><button type="button" data-a="laylow">🤫 Lay low (3 min)</button><button type="button" data-a="grease" ${st.heat < 10 ? 'disabled' : ''}>💸 Grease the beat (${greaseCost()})</button></div>`;
    html += `<h3>Crew · ${wagesPerPeriod()} cr / 10 min</h3>`;
    for (const [r, C] of Object.entries(CREW)) { const c = st.crew[r];
      html += `<div class="row"><div><b>${C.icon} ${esc(C.title)}: ${esc(C.name)}</b><small>${c.hired ? `${C.wage} cr / 10 min${c.owed ? ` · <span class="warn">owed ${c.owed} payday${c.owed > 1 ? 's' : ''}${c.owed >= 2 ? ', skimming' : ''}</span>` : ''}` : `Hire ${C.hire} cr`} · ${esc(C.blurb)}</small></div><button type="button" data-${c.hired ? 'fire' : 'hire'}="${r}">${c.hired ? 'Fire' : 'Hire'}</button></div>`; }
    if (Object.values(st.crew).some(c => c.owed)) html += `<div class="g"><button type="button" class="main" data-a="paycrew" style="grid-column:1/-1">💵 Pay back wages</button></div>`;
    html += `<h3>Upgrades</h3>`;
    for (const [id, U] of Object.entries(UPGRADES)) { const u = st.upgrades[id];
      const btn = u.damaged ? `<button type="button" data-rep="${id}">Repair ${repairCost(id)}</button>` : u.next ? `<button type="button" data-up="${id}">${u.next}</button>` : '<button type="button" disabled>Max</button>';
      html += `<div class="row"><div><b>${U.icon} ${esc(U.name)} ${u.level}/3${u.damaged ? ' <span class="warn">· damaged</span>' : ''}</b><small>${esc(U.blurb)}</small></div>${btn}</div>`; }
    if (lvl('purity') >= 2) html += `<div class="row"><div><b>🧱 Press bricks</b><small>On collect, every 10 Glow-dust becomes a Glow-dust brick.</small></div><button type="button" data-a="bricks">${S.bricks ? 'On' : 'Off'}</button></div>`;
    if (st.raid) html += `<p class="sub warn">🚨 ${esc(st.raid.name)} raid: ${st.raid.phase === 'alert' ? `${fmtT(st.raid.timeLeft)} to get here.` : `wave ${st.raid.wave}/${st.raid.waves}.`}</p>`;
    html += `<p class="sub">Made ${st.stats.made} · runner sold ${st.stats.sold} for ${st.stats.earned} cr · raids ${st.stats.won}/${st.stats.raids} held. Offline the vats keep going up to 4 h. Key [ opens this.</p>`;
  }
  body.innerHTML = html; msgEl.textContent = lastMsg;
  const q = (sel, fn) => body.querySelectorAll(sel).forEach(bt => tap(bt, () => act(() => fn(bt))));
  q('[data-a="buy"]', () => buy()); q('[data-a="collect"]', () => collect()); q('[data-a="laylow"]', () => layLow()); q('[data-a="grease"]', () => greaseBeat()); q('[data-a="paycrew"]', () => payCrew());
  q('[data-a="bricks"]', () => { S.bricks = !S.bricks; save(); return { msg: `Brick press ${S.bricks ? 'on' : 'off'}.` }; });
  q('[data-prod]', bt => setProduct(bt.dataset.prod)); q('[data-sup]', bt => buySupplies(+bt.dataset.sup)); q('[data-hire]', bt => hire(bt.dataset.hire)); q('[data-fire]', bt => fire(bt.dataset.fire));
  q('[data-up]', bt => upgrade(bt.dataset.up)); q('[data-rep]', bt => repair(bt.dataset.rep));
}

// ---------- API ----------
function status() {
  const why = whyIdle(nearDoor(R_RAID)), bs = batchSec(), rate = crewOn('cook') ? 1 : 0.5;
  const ups = {}; for (const [id, U] of Object.entries(UPGRADES)) ups[id] = { level: S.up[id] | 0, damaged: !!S.damaged[id], next: (S.up[id] | 0) < U.prices.length ? U.prices[S.up[id] | 0] : null };
  const crew = {}; for (const r of Object.keys(CREW)) crew[r] = { hired: !!S.crew[r].hired, owed: S.crew[r].owed | 0, mood: !S.crew[r].hired ? null : S.crew[r].owed >= 2 ? 'skimming' : S.crew[r].owed ? 'grumbling' : 'ok' };
  return { owned: S.owned, site: site(), at: doorAt(), product: S.product, products: Object.keys(PRODUCTS).map(id => ({ id, name: itemName(id), units: PRODUCTS[id].units, sec: Math.round(PRODUCTS[id].sec * SPEED[lvl('speed')]), locked: !!(PRODUCTS[id].needs && lvl('purity') < PRODUCTS[id].needs) })),
    supplies: S.supplies, supplyMax: supplyMax(), batch: { pct: Math.round(S.progress / bs * 100), secLeft: Math.round((bs - S.progress) / rate), running: !why, why },
    locker: { ...S.locker }, lockerUsed: lockerUsed(), lockerMax: lockerMax(), till: Math.floor(S.till), heat: Math.round(S.heat), upgrades: ups, crew,
    raid: raid ? { kind: raid.kind, gang: raid.gang, name: raid.name, phase: raid.phase, wave: raid.wave, waves: raid.waves, warned: raid.warned, timeLeft: Math.round(raid.t), engine: raid.engine } : null,
    downtime: Math.max(0, Math.round((S.downUntil - Date.now()) / 1000)), perHour: Math.round(3600 / (bs / rate) * PRODUCTS[S.product].units), defence: Math.round(defence() * 100) / 100, turrets: turrets(), stats: { ...S.stats } };
}
const API = {
  status, qualityMult, buy, buySupplies, setProduct, upgrade, repair, hire, fire, payCrew, collect, layLow, greaseBeat, on, open, close,
  products: PRODUCTS, upgrades: UPGRADES, crewRoles: CREW,
  debug: {
    goto() { const h = here(), s = surf(); if (!h) return false; const d = doorAt(); s.debugMove(h.cx + d[0] + 2, h.cz + d[1] + 2, 0); return true; },
    advance(sec = 60) { const n = Math.max(0, +sec || 0); S.lastAt -= n * 1000; return catchUp(); },
    heat(n) { if (n != null) { S.heat = clamp(+n, 0, 100); save(); } return S.heat; },
    raid: (kind = 'gang', gang) => startRaid(kind, kind === 'gang' ? gang || rivalGang() : null),
    arrive() { if (raid?.phase === 'alert') { API.debug.goto(); return true; } return false; },
    clearWave() { let n = 0; const g = game(); for (let k = 0; k < 40; k++) { const list = g?.debug?.agents?.() || []; const i = list.findIndex(a => a.src === 'lab'); if (i < 0) break; g.debug.kill(i, {}); n++; } try { window.__raids?.killAll?.(); } catch (e) { /* optional */ } return n; },
    resolve(win) { if (!raid) return false; win ? winRaid(true) : loseRaid('away'); return true; },
    grant(cr = 5000) { pay(cr); return credits(); },
    sale: () => runnerSale(), payday: () => payday(false),
    reset() { if (raid) endRaid(); S = fresh(); save(); syncBeacon(); emit('change', { what: 'reset' }); },
    state: () => JSON.parse(JSON.stringify({ S, raid: raid && { ...raid, unsub: undefined, handles: undefined }, near, site: site() })),
    engine
  }
};
(function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 200); return; }
  window.SSX.lab = API; ui(); catchUp();
  try { window.SSX.registerMenuItem({ id: 'rmLab', label: '🛢️ Vat House', onTap: () => open() }); } catch (e) { console.warn('lab menu', e); }
  requestAnimationFrame(loop);
})();
