/*
 * mars/consequences.js: GTA-style consequences for getting wasted or busted on Mars (v7.5.x, Marsmania). Fiction only, M-rated.
 *
 * ONE OWNER for the outcome penalty. The core game (game.js updateHealth) used to charge a med-evac fee / ColSec fine on
 * respawn, contraband.js bags your stash when progress.stats.busted ticks up, and mars/pursuit.js (#42) only reports the
 * outcome. On Mars (outside the Rust Pit / a duel) this module is the single owner:
 *  - game.js asks SSX.consequences.ownsOutcome(why) at respawn (one guarded line); when it answers true the core fee is 0
 *    and the core radio receipt is skipped. If that hook is missing and the core already charged (respawn ev.fee > 0) we
 *    charge nothing on top: never twice.
 *  - BUSTED: the stash is taken here, synchronously on 'game:down' (via SSX.contraband.remove), so contraband.js finds an
 *    empty stash and its own seizure doesn't run. WASTED: contraband.js keeps its own "med-evac pockets half" rule (that's
 *    product, not money) and we don't touch the stash.
 *  - pursuit's 'busted' / 'wasted' / 'outcome' events are read for the star count only; pursuit charges nothing.
 *  - In the Rust Pit, a duel or an SSX.fight cage, or off Mars, this module stands aside and the core flow runs unchanged.
 *
 * WASTED -> short high-contrast screen, wake up at Helios Mercy (a hospital on the Beltway approach to Helios Heights), pay a
 *   hospital bill plus some cash that "went missing" in the ambulance. Weapons are kept.
 * BUSTED -> short screen, booked into Deimos Lockup (Olympus Row, next to Colsec Downtown). Weapons go to the evidence
 *   locker (core 'weapon:*' unlocks + SSX.arsenal guns, guarded), contraband is gone, your rover goes to the ColSec Impound
 *   when you were in it or near it. Ways out: serve time (skips the clock: SSX.time when present, else our own clock),
 *   bail (money, skips the time), a bribe (guarded SSX.bribes price + SSX.rep odds; success = you walk with everything),
 *   a jailbreak (sneak past two guards to the service gate, or get spotted and fight; you leave with raised wanted).
 *   The lawyer (Odile Marsh, Esq.) cuts this case's bail/time/fees and can clear a strike for a fee.
 *   Evidence locker: reclaim seized weapons at the Lockup front desk for a fee; a new bust with an unclaimed lot loses it.
 *   Impound: pay at the booth (or from the legal panel) or drive it out unpaid (trespass + theft: world.crime()).
 *
 * window.SSX.consequences
 *  ownsOutcome(why)  -> bool (game.js hook)        status()  -> { custody, jail, strikes, evidence, impound, lawyer, clock, ... }
 *  quote()           -> { bail, bribe, bribeOdds, time, lawyer, clear, evidence, impound }
 *  serve() bail() bribe() lawyer() jailbreak() reclaim() payImpound() clearStrike()  -> { ok, msg, ... }
 *  places()          -> [{ id, name, x, z, r }] world coords       ledger() -> last charges [{ kind, n, t }]
 *  clock()           -> Mars hour (SSX.time.hour() or our own offset clock)   open(mode?) / close()
 *  on(type, fn) | on(fn) -> unsubscribe. Events: down, wasted, busted, booked, seized, served, bail, bribe, bribe-refused,
 *                    lawyer, strike, jailbreak, spotted, released, evidence, impound, charge. Also window 'ssx:consequences'
 *                    and SSX.emit('consequences:<type>').
 *  debug             -> test helpers (bottom)
 * Keys: ' (Quote) opens the legal panel (free on main and every open PR). Phone: the ⚖️ Legal button on #ssxDock (only
 *   while there's business: custody, evidence, impound or a strike) and ☰ "⚖️ Legal". SSX.phone.addContact used if it exists.
 * Persistence: localStorage 'ssx.consequences.v1' (strikes, evidence lot, impound, clock offset, ledger, stats).
 */
import * as THREE from 'three';

const KEY = 'ssx.consequences.v1', HOTKEY = 'Quote';
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const CB = () => window.SSX?.contraband, AR = () => window.SSX?.arsenal, BRB = () => window.SSX?.bribes, REP = () => window.SSX?.rep, PUR = () => window.SSX?.pursuit, TIME = () => window.SSX?.time;
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* no HUD */ } };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const fin = v => Number.isFinite(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r5 = v => Math.max(5, Math.round(v / 5) * 5);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let DC = null; import('../dangercore.js').then(m => { DC = m; }).catch(() => { /* standalone */ });

// ---------- places (Ares Junction coords; world = colony + these) ----------
const LAWYER = { id: 'lawyer', name: 'Odile Marsh, Esq.', firm: 'Marsh & Vane, Colony Defense', icon: '⚖️' };
const PIT_AJ = [-292, -68], PIT_R = 12;
const PL = {
  hospital: { id: 'hospital', name: 'Helios Mercy', at: [236, 66], r: 16 },     // Beltway approach to Helios Heights
  lockup: { id: 'lockup', name: 'Deimos Lockup', at: [-84, -410], r: 18 },      // Olympus Row, west of Colsec Downtown
  impound: { id: 'impound', name: 'ColSec Impound', at: [-84, -372], r: 14 }
};
// lockup local layout (metres from PL.lockup): building at the back, fenced yard, cell, front desk, jailbreak service gate
const JAIL_START = [-11.5, -12.5]; // NW yard corner behind both guards' start beams (+ a 1.5 s grace) so a break-out never starts spotted
const YARD = { x0: -13, x1: 13, z0: -14, z1: 8 }, CELL = [0, -4], FRONT = [0, 12], DESK = [0, 9.5], EXIT = [-15.5, 5.5], GAP = { z0: 3, z1: 8 };
const LOT = { x0: -11, x1: 11, z0: -8, z1: 8 }, LOT_SLOT = [0, -2], BOOTH = [9, 10.5];
const GUARDS = [{ path: [[-10, -1], [10, -1]], speed: 2.4 }, { path: [[9, -11], [9, 6]], speed: 1.8 }];
const SIGHT = { r: 9, half: 0.62 };

// ---------- state ----------
const fresh = () => ({ v: 1, strikes: 0, evidence: null, impound: null, clockOff: 0, ledger: [], stats: { wasted: 0, busted: 0, served: 0, bail: 0, bribed: 0, refused: 0, broke: 0, lawyer: 0, cleared: 0, impPaid: 0, impStolen: 0, reclaimed: 0, lost: 0, billed: 0 } });
let S = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.v === 1) return { ...fresh(), ...s, stats: { ...fresh().stats, ...s.stats } }; } catch (e) { /* fresh */ } return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
let pending = null, custody = null, jail = null, lastTc = null, G = null, guardMeshes = [], impT = 0, trespass = false, hudKey = '', lastWarn = 0;
const subs = new Set();
function emit(type, d = {}) {
  const ev = { type, ...d, t: Date.now() };
  for (const s of [...subs]) { try { if (!s.type || s.type === type) s.fn(ev); } catch (e) { console.warn('consequences listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:consequences', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('consequences:' + type, ev); } catch (e) { /* no bus */ }
  return ev;
}
const on = (a, b) => { const s = typeof a === 'function' ? { fn: a } : { type: a, fn: b }; if (typeof s.fn !== 'function') return () => {}; subs.add(s); return () => subs.delete(s); };

// ---------- guarded inputs ----------
function colony() { const c = surf()?.info?.colony || world()?.colony; return c && fin(c.x) && fin(c.z) ? c : null; }
const onMars = () => surf()?.info?.name === 'Mars' && !!colony() && !!app()?.state?.onSurface;
function W(p, d = [0, 0]) { const c = colony(); return c ? { x: c.x + p[0] + d[0], z: c.z + p[1] + d[1] } : null; }
function ground(x, z) { try { const h = world()?.groundAt?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } try { const h = window.SSX?.height?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } return 0; }
const me = () => { const i = surf()?.info; return i && fin(i.x) && fin(i.z) ? i : null; };
const credits = () => game()?.progress?.credits | 0;
const stars = () => world()?.wanted | 0;
const repGet = id => { try { const v = REP()?.get?.(id); return fin(v) ? v : 0; } catch (e) { return 0; } };
function inPit() {
  try { if (world()?.inDuel) return true; } catch (e) { /* */ }
  try { if (window.SSX?.fight?.debug?.inCage) return true; } catch (e) { /* */ }
  try { if (AR()?.inPit?.()) return true; } catch (e) { /* */ }
  const i = me(), p = W(PIT_AJ); let at = p; try { const s = window.SSX?.fight?.status?.()?.at; if (Array.isArray(s)) at = W(s); } catch (e) { /* */ }
  return !!(i && at && Math.hypot(i.x - at.x, i.z - at.z) < PIT_R);
}
function lawyerOn() { return !!custody?.lawyer || (!!S.retainUntil && S.retainUntil > Date.now()); }
function clock() {
  try { const T = TIME(); const h = T?.hour?.() ?? T?.now?.(); if (fin(h)) return h; } catch (e) { /* */ }
  let base = 12; try { if (DC?.marsHour) base = DC.marsHour(); } catch (e) { /* */ }
  return (((base + S.clockOff) % 24) + 24) % 24;
}
function skipClock(h) {
  const before = clock();
  let via = 'own';
  try { const T = TIME(); if (T?.set && (T.hour || T.now)) { T.set((before + h) % 24); via = 'SSX.time'; } } catch (e) { via = 'own'; }
  if (via === 'own') { S.clockOff = ((S.clockOff + h) % 24 + 24) % 24; save(); }
  return { before, after: clock(), hours: h, via };
}

// ---------- money: one place that charges ----------
function charge(kind, n, forced = false) {
  const g = game(), P = g?.progress; n = Math.max(0, Math.round(n)); if (!P) return { ok: false, n: 0 };
  if (!forced && P.credits < n) return { ok: false, n: 0, why: 'broke' };
  const take = Math.min(P.credits, n); if (take > 0) { if (!forced && g.spend) { if (!g.spend(take)) return { ok: false, n: 0, why: 'broke' }; } else { P.credits -= take; try { g.save(); } catch (e) { /* */ } } }
  S.ledger.push({ kind, n: take, t: Date.now() }); if (S.ledger.length > 30) S.ledger.splice(0, S.ledger.length - 30); save();
  emit('charge', { kind, n: take }); return { ok: true, n: take };
}

// ---------- prices ----------
function quote(c = custody) {
  const st = c?.stars ?? stars(), k = S.strikes, L = lawyerOn(), col = repGet('colsec'), dirty = repGet('colsec_dirty');
  let bribe = r5((140 + 110 * st + 45 * k) * clamp(1 - dirty / 300, 0.6, 1.3) * (col < -30 ? 1.25 : 1));
  try { const p = BRB()?.price?.({ kind: 'spot', stars: Math.max(1, st), priors: k }); if (fin(p) && p > 0) bribe = r5(p * 1.4); } catch (e) { /* own price */ }
  const odds = clamp(0.82 - 0.08 * st - 0.06 * k + col / 400 + dirty / 300 + (L ? 0.08 : 0), 0.1, 0.95);
  return {
    bail: r5((100 + 120 * st + 60 * k) * (L ? 0.6 : 1)), bribe, bribeOdds: Math.round(odds * 100) / 100,
    time: Math.round(clamp(3 + 3 * st + 2 * k, 2, 24) * (L ? 0.5 : 1)), lawyer: r5(90 + 30 * k), clear: r5(220 + 60 * k),
    evidence: S.evidence ? r5((50 + 30 * S.evidence.n) * (S.evidence.lawyer ? 0.5 : 1)) : 0,
    impound: S.impound ? r5(150 * (S.impound.lawyer ? 0.7 : 1)) : 0
  };
}

// ---------- seizure (busted) ----------
function seizeContraband() {
  const C = CB(); if (!C?.stash || !C?.remove) return { items: {}, n: 0 };
  let items = {}, n = 0;
  try { const s = C.stash(); for (const id in s.items || {}) { const q = s.items[id].qty | 0; if (q > 0) { items[id] = { qty: q, fresh: s.items[id].fresh ?? 1 }; n += C.remove(id, q) | 0; } } } catch (e) { console.warn('consequences contraband', e); }
  return { items, n };
}
function seizeWeapons() {
  const out = { core: [], equip: null, arsenal: null, n: 0 };
  const g = game(), P = g?.progress;
  if (P?.unlocks) { out.core = P.unlocks.filter(u => /^weapon:/.test(u)); if (out.core.length) P.unlocks = P.unlocks.filter(u => !/^weapon:/.test(u)); out.equip = P.equip?.weapon || null; if (P.equip && P.equip.weapon !== 'rifle') P.equip.weapon = 'rifle'; try { g.save(); } catch (e) { /* */ } }
  const A = AR();
  if (A) {
    try {
      if (typeof A.confiscate === 'function') out.arsenal = { via: 'api', lot: A.confiscate() };
      else if (typeof A.state === 'function') { const st = A.state(); if (st?.owned) { out.arsenal = { via: 'state', owned: { ...st.owned } }; for (const k in st.owned) delete st.owned[k]; A.saveState?.(); } }
    } catch (e) { console.warn('consequences arsenal', e); }
  }
  out.n = out.core.length + (out.arsenal?.owned ? Object.keys(out.arsenal.owned).length : Array.isArray(out.arsenal?.lot) ? out.arsenal.lot.length : out.arsenal ? 1 : 0);
  return out;
}
function restoreWeapons(w) {
  if (!w) return 0; const g = game(), P = g?.progress;
  if (P?.unlocks && w.core?.length) { for (const u of w.core) if (!P.unlocks.includes(u)) P.unlocks.push(u); if (w.equip && P.equip) P.equip.weapon = w.equip; try { g.save(); } catch (e) { /* */ } }
  const A = AR();
  if (A && w.arsenal) { try { if (w.arsenal.via === 'api' && typeof A.restore === 'function') A.restore(w.arsenal.lot); else if (w.arsenal.owned && typeof A.state === 'function') { const st = A.state(); Object.assign(st.owned, w.arsenal.owned); A.saveState?.(); } } catch (e) { console.warn('consequences arsenal restore', e); } }
  return w.n | 0;
}
function restoreContraband(c) { const C = CB(); if (!C?.add || !c) return 0; let n = 0; for (const id in c.items || {}) { try { const r = C.add(id, c.items[id].qty, c.items[id].fresh); if (r?.ok !== false) n += c.items[id].qty; } catch (e) { /* */ } } return n; }

// ---------- outcome hooks ----------
function onDown(d) {
  const why = d?.why === 'busted' ? 'busted' : 'killed';
  if (!onMars() || inPit()) { pending = null; return; }
  const i = me(), tc = lastTc, rv = tc?.rover;
  let pst = 0; try { pst = PUR()?.heat?.() | 0; } catch (e) { /* */ }
  const inRover = !!(tc?.car && rv && tc.car === rv), nearRover = !!(rv && i && fin(rv.x) && Math.hypot(rv.x - i.x, rv.z - i.z) < 80);
  const floating = !!(tc?.car && fin(tc.car.y) && i && tc.car.y - ground(tc.car.x, tc.car.z) > 4);
  pending = { why, stars: Math.max(stars(), pst, why === 'busted' ? 1 : 0), at: i ? { x: i.x, z: i.z } : null, inRover, nearRover, floating, t: Date.now(), jail: !!jail };
  if (jail) endJail(false);
  if (why === 'busted') {
    if (custody) custody = null;
    pending.contraband = seizeContraband(); pending.weapons = seizeWeapons();
    emit('seized', { contraband: pending.contraband.n, weapons: pending.weapons.n });
    screen('BUSTED', pending.stars ? '★'.repeat(pending.stars) + ' · Deimos Lockup' : 'Deimos Lockup', '#1aa3ff', 15000);
  } else screen('WASTED', 'Helios Mercy', '#ff2a2a', 15000); // held until the respawn (then ~1 s more), 15 s cap
  emit('down', { why: why === 'busted' ? 'busted' : 'wasted', stars: pending.stars });
}
function ownsOutcome(why) { return !!pending && (why === 'busted' ? 'busted' : 'killed') === pending.why; }
function onRespawn(ev) {
  const p = pending; pending = null; if (!p) return;
  if (screenEl?.classList.contains('on')) { clearTimeout(screenT); screenT = setTimeout(() => screenEl.classList.remove('on'), 1000); }
  const coreFee = ev?.owned === true ? 0 : (ev?.fee | 0); // hook missing: the core already charged once, so we add nothing
  if (p.why === 'killed') return wasted(p, coreFee);
  return booked(p, coreFee);
}
function place(pt, yaw = 0) { if (!pt || !fin(pt.x) || !fin(pt.z)) return false; try { return !!surf()?.debugMove?.(pt.x, pt.z, yaw); } catch (e) { return false; } }
function wasted(p, coreFee) {
  S.stats.wasted++;
  const c = credits(), bill = r5(80 + 0.06 * c), lost = Math.round(0.04 * c);
  place(W(PL.hospital.at, [0, 11]), Math.PI);
  let paid = { n: 0 }; if (!coreFee) paid = charge('hospital', bill + lost, true);
  S.stats.billed += paid.n; save();
  const msg = coreFee ? `🏥 Helios Mercy patched you up. (Med-evac fee ${coreFee} cr already charged.)` : `🏥 Helios Mercy patched you up. Bill ${bill} cr${lost ? ` + ${lost} cr went missing in the ambulance` : ''}. Charged: ${paid.n} cr.`;
  showPanel('receipt', { title: '🏥 Helios Mercy', lines: [msg, 'Weapons kept. Product on you is the med-evac crew\u2019s now (half of it, per contraband).'] });
  emit('wasted', { bill, lost, charged: paid.n, coreFee, stars: p.stars });
}
function booked(p, coreFee) {
  S.stats.busted++; S.strikes = Math.min(5, S.strikes + 1);
  if (S.evidence) { S.stats.lost++; emit('evidence', { action: 'lost', n: S.evidence.n }); S.evidence = null; } // a new bust loses an unclaimed lot
  custody = { stars: p.stars, coreFee, contraband: p.contraband, weapons: p.weapons, lawyer: false, refused: false, extra: 0, inCell: true, t: Date.now() };
  if (p.weapons?.n) S.evidence = { weapons: p.weapons, n: p.weapons.n, t: Date.now(), lawyer: false };
  // the rover goes to the impound if you were in it (or it was parked close)
  if ((p.inRover || p.nearRover) && impoundRover()) { S.impound = { t: Date.now(), lawyer: false }; emit('impound', { action: 'towed' }); }
  save();
  place(W(PL.lockup.at, CELL), 0);
  try { world()?.setWanted?.(0, 'booked'); } catch (e) { /* */ }
  emit('busted', { stars: p.stars, strikes: S.strikes, seized: { contraband: p.contraband?.n | 0, weapons: p.weapons?.n | 0 }, impound: !!S.impound, coreFee });
  emit('booked', { quote: quote() });
  showPanel('booking');
}
function release(how, extra = {}) {
  if (!custody) return; custody = null; place(W(PL.lockup.at, FRONT), Math.PI);
  try { game()?.restore?.(); } catch (e) { /* */ }
  emit('released', { how, ...extra }); refreshHud(true);
}

// ---------- the ways out ----------
function needCell() { return custody?.inCell ? null : { ok: false, msg: 'You\u2019re not in custody.' }; }
function serve() {
  const n = needCell(); if (n) return n;
  const q = quote(), h = q.time + custody.extra, ck = skipClock(h);
  S.stats.served++; save(); screen(`${h} HOURS LATER`, 'Deimos Lockup', '#ffffff', 1800);
  const msg = `⏳ You did ${h} hours. ${ck.via === 'SSX.time' ? 'Mars clock' : 'Clock'} ${fmtH(ck.before)} → ${fmtH(ck.after)}.${S.evidence ? ' Your weapons are in the evidence locker at the front desk.' : ''}`;
  release('served', { hours: h, clock: ck }); emit('served', { hours: h, clock: ck }); toast(msg, 4200); return { ok: true, msg, hours: h, clock: ck };
}
function bail() {
  const n = needCell(); if (n) return n;
  const q = quote(), c = charge('bail', q.bail); if (!c.ok) return { ok: false, msg: `💳 Bail is ${q.bail} cr. You have ${credits()}.` };
  S.stats.bail++; save();
  const msg = `💳 Bail posted: ${q.bail} cr. You\u2019re out.${S.evidence ? ' Weapons: evidence locker, front desk.' : ''}`;
  release('bail', { cost: q.bail }); emit('bail', { cost: q.bail }); toast(msg, 3600); return { ok: true, msg, cost: q.bail };
}
function bribe(opts = {}) {
  const n = needCell(); if (n) return n;
  if (custody.refused) return { ok: false, msg: 'Sergeant Kade already said no. Loudly.' };
  const q = quote(); if (credits() < q.bribe) return { ok: false, msg: `💵 Kade wants ${q.bribe} cr. You have ${credits()}.` };
  const roll = opts.force === true ? 0 : opts.force === false ? 1 : Math.random();
  if (roll > q.bribeOdds) {
    custody.refused = true; custody.extra += 2; S.stats.refused++; S.strikes = Math.min(5, S.strikes + 1); save();
    try { REP()?.add?.('colsec', -3, 'tried to bribe the Deimos desk'); } catch (e) { /* */ }
    emit('bribe-refused', { cost: q.bribe }); emit('strike', { strikes: S.strikes }); showPanel('booking');
    return { ok: false, refused: true, msg: '🚫 Sergeant Kade: "Attempted bribery. That\u2019s another strike and two more hours."' };
  }
  const c = charge('bribe', q.bribe); if (!c.ok) return { ok: false, msg: 'Broke.' };
  S.strikes = Math.max(0, S.strikes - 1); S.stats.bribed++;
  const w = restoreWeapons(custody.weapons), k = restoreContraband(custody.contraband); S.evidence = null; save();
  try { REP()?.add?.('colsec_dirty', 2, 'Deimos desk bribe'); } catch (e) { /* */ }
  const msg = `💵 ${q.bribe} cr in a coffee cup. Kade loses your file. Weapons back${k ? `, product back (${k})` : ''}.`;
  release('bribe', { cost: q.bribe }); emit('bribe', { cost: q.bribe, weapons: w, contraband: k }); toast(msg, 3800); return { ok: true, msg, cost: q.bribe };
}
function lawyer() {
  if (custody?.lawyer) return { ok: false, msg: `${LAWYER.name} is already on your case.` };
  const q = quote(), c = charge('lawyer', q.lawyer); if (!c.ok) return { ok: false, msg: `⚖️ ${LAWYER.name}\u2019s retainer is ${q.lawyer} cr.` };
  S.stats.lawyer++;
  if (custody) custody.lawyer = true; else S.retainUntil = Date.now() + 10 * 60000;
  if (S.evidence) S.evidence.lawyer = true; if (S.impound) S.impound.lawyer = true; save();
  emit('lawyer', { cost: q.lawyer, custody: !!custody });
  const msg = `⚖️ ${LAWYER.name}: "Don\u2019t say a word. Bail\u2019s down 40%, time\u2019s halved, and I\u2019ll lean on the locker and the impound."`;
  if (custody) showPanel('booking'); return { ok: true, msg, cost: q.lawyer };
}
function clearStrike() {
  if (S.strikes <= 0) return { ok: false, msg: 'Your record is clean. Suspiciously.' };
  const q = quote(), c = charge('clear', q.clear); if (!c.ok) return { ok: false, msg: `⚖️ Clearing a strike costs ${q.clear} cr.` };
  S.strikes--; S.stats.cleared++; save(); emit('strike', { strikes: S.strikes, cleared: true });
  return { ok: true, msg: `⚖️ ${LAWYER.name} found a procedural error. One strike gone (${S.strikes} left).`, cost: q.clear };
}
function reclaim(opts = {}) {
  if (!S.evidence) return { ok: false, msg: 'Nothing of yours in the evidence locker.' };
  if (custody) return { ok: false, msg: 'Get out first.' };
  if (!opts.anywhere && distTo(PL.lockup.at, DESK) > 9) return { ok: false, msg: 'The evidence locker is at the Deimos Lockup front desk.' };
  if (stars() > 0) return { ok: false, msg: 'The desk won\u2019t release evidence to someone with stars on them.' };
  const q = quote(), c = charge('evidence', q.evidence); if (!c.ok) return { ok: false, msg: `🗄 The locker fee is ${q.evidence} cr.` };
  const n = restoreWeapons(S.evidence.weapons); S.evidence = null; S.stats.reclaimed++; save(); emit('evidence', { action: 'reclaim', n, cost: q.evidence });
  return { ok: true, msg: `🗄 Locker fee ${q.evidence} cr. ${n} weapon${n === 1 ? '' : 's'} back.`, cost: q.evidence };
}
function payImpound() {
  if (!S.impound) return { ok: false, msg: 'Nothing of yours in the impound.' };
  const q = quote(), c = charge('impound', q.impound); if (!c.ok) return { ok: false, msg: `🚧 The impound fee is ${q.impound} cr.` };
  S.impound = null; S.stats.impPaid++; save(); emit('impound', { action: 'pay', cost: q.impound });
  return { ok: true, msg: `🚧 Paid ${q.impound} cr. Your rover is released (walk to the lot or summon it).`, cost: q.impound };
}

// ---------- jailbreak ----------
function jailbreak() {
  const n = needCell(); if (n) return n;
  custody.inCell = false; closePanel();
  const L = W(PL.lockup.at); if (!L) return { ok: false, msg: 'No lockup here.' };
  jail = { t: 0, spotted: false, guards: GUARDS.map((g, i) => ({ i, k: i * 0.37, dir: 1, x: 0, z: 0, yaw: 0 })), done: false };
  place(W(PL.lockup.at, JAIL_START), 0);
  emit('jailbreak', { action: 'start' }); toast('🏃 Jailbreak: get to the service gate on the west fence. Stay out of the guards\u2019 torch beams.', 4200);
  refreshHud(true); return { ok: true, msg: 'Jailbreak started.' };
}
function guardStep(g, dt) {
  const d = GUARDS[g.i], [a, b] = d.path, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  g.k += dt * d.speed / len * g.dir; if (g.k > 1) { g.k = 1; g.dir = -1; } if (g.k < 0) { g.k = 0; g.dir = 1; }
  const lx = a[0] + (b[0] - a[0]) * g.k, lz = a[1] + (b[1] - a[1]) * g.k, P = W(PL.lockup.at, [lx, lz]);
  g.x = P.x; g.z = P.z; const dx = (b[0] - a[0]) * g.dir, dz = (b[1] - a[1]) * g.dir; g.yaw = Math.atan2(-dx, -dz);
}
function sees(g, x, z) {
  const dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz); if (d > SIGHT.r) return false; if (d < 1.2) return true;
  const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw), c = (dx * fx + dz * fz) / d; return c > Math.cos(SIGHT.half);
}
function spotted(why = 'torch') {
  if (!jail || jail.spotted) return; jail.spotted = true;
  try { world()?.setWanted?.(Math.max(stars(), 2), 'jailbreak at Deimos Lockup'); } catch (e) { /* */ }
  const L = W(PL.lockup.at, [0, -2]); try { game()?.hostiles?.(['guard', 'guard'], L.x, L.z, { r: 5, src: 'lockup', faction: 'colsec' }); } catch (e) { /* */ }
  emit('spotted', { why }); toast('🚨 SPOTTED! Alarm\u2019s up. Fight your way to the service gate.', 3200); refreshHud(true);
}
function endJail(ok) {
  if (!jail) return; const j = jail; jail = null; guardMeshes.forEach(m => { m.visible = false; });
  if (ok) {
    const st = Math.min(5, Math.max(stars(), j.spotted ? 3 : 2)); try { world()?.setWanted?.(st, 'escaped Deimos Lockup'); } catch (e) { /* */ }
    S.strikes = Math.min(5, S.strikes + 1); S.stats.broke++; save(); custody = null;
    emit('jailbreak', { action: 'escaped', ok: true, how: j.spotted ? 'fight' : 'sneak', stars: st }); emit('released', { how: 'jailbreak' });
    toast(`🏃 You\u2019re out. ${'★'.repeat(st)} Lose them. Your weapons are still in evidence.`, 3600);
  } else emit('jailbreak', { action: 'failed', ok: false });
  refreshHud(true);
}
function jailTick(dt, tc) {
  const L = W(PL.lockup.at), p = tc?.player; if (!jail || !L || !p) return;
  jail.t += dt;
  if (!jail.spotted && !jail.freeze) for (const g of jail.guards) { guardStep(g, dt); if (jail.t > 1.5 && sees(g, p.x, p.z)) { spotted('torch'); break; } }
  // the fence: stay inside the yard except through the service-gate gap on the west side
  const lx = p.x - L.x, lz = p.z - L.z, inGap = lz > GAP.z0 && lz < GAP.z1 && lx < YARD.x0 + 1.5;
  if (!tc.car && !inGap) { const cx = clamp(lx, YARD.x0 + 0.6, YARD.x1 - 0.6), cz = clamp(lz, YARD.z0 + 0.6, YARD.z1 - 0.6); if (cx !== lx || cz !== lz) { p.x = L.x + cx; p.z = L.z + cz; } }
  if (lx < EXIT[0] + 1.5 && lz > GAP.z0 - 1 && lz < GAP.z1 + 1) endJail(true);
  guardMeshes.forEach((m, i) => { const g = jail?.guards[i]; if (!m || !g) return; m.visible = !jail.spotted; m.position.set(g.x, ground(g.x, g.z), g.z); m.rotation.y = g.yaw; });
}

// ---------- rover impound ----------
function impoundRover() {
  const rv = lastTc?.rover, P = W(PL.impound.at, LOT_SLOT); if (!rv || !P) return false;
  const y = ground(P.x, P.z); if (!fin(y)) return false;
  rv.x = P.x; rv.z = P.z; rv.y = y; rv.yaw = 0; rv.vy = 0; rv.speed = 0; rv.steer = 0; rv.prevG = null; rv.air = false; rv.pitch = 0; rv.roll = 0; if (rv.lift) rv.lift = 0;
  try { rv.group?.position.set(rv.x, rv.y, rv.z); rv.group?.rotation.set(0, 0, 0); } catch (e) { /* */ }
  return true;
}
function inLot(x, z, pad = 0) { const I = W(PL.impound.at); if (!I) return false; const lx = x - I.x, lz = z - I.z; return lx > LOT.x0 - pad && lx < LOT.x1 + pad && lz > LOT.z0 - pad && lz < LOT.z1 + pad; }
function impoundTick(dt, tc) {
  if (!S.impound || !tc?.rover) { trespass = false; return; }
  const rv = tc.rover, p = tc.player, driving = !!tc.car && tc.car === rv;
  if (!fin(rv.x) || !fin(rv.z) || !fin(rv.y)) { impoundRover(); return; }
  if (driving) { if (!inLot(rv.x, rv.z, 1.5)) { S.impound = null; S.stats.impStolen++; save(); try { world()?.crime?.(2, 'stole a rover out of the ColSec impound'); } catch (e) { /* */ } if (stars() < 2) try { world()?.setWanted?.(2, 'impound theft'); } catch (e) { /* */ } emit('impound', { action: 'steal' }); toast('🚨 You broke your rover out of the impound. ColSec noticed.', 3200); } return; }
  if (!inLot(rv.x, rv.z, 2)) { impoundRover(); if (performance.now() - lastWarn > 5000) { lastWarn = performance.now(); toast('🚧 Your rover is in the ColSec Impound (Olympus Row). Pay the fee or break it out.', 3000); } }
  const inside = !!p && !tc.car && inLot(p.x, p.z);
  if (inside && !trespass) { trespass = true; try { world()?.crime?.(1, 'trespassing in the ColSec impound'); } catch (e) { /* */ } emit('impound', { action: 'trespass' }); }
  if (!inside) trespass = false;
}
function custodyTick(tc) { // in the cell: you stay in the cell until you pick a way out
  if (!custody?.inCell || !tc?.player || tc.car) return; const C = W(PL.lockup.at, CELL); if (!C) return;
  const p = tc.player, dx = p.x - C.x, dz = p.z - C.z, d = Math.hypot(dx, dz); if (d > 2.5) { p.x = C.x + dx / d * 2.5; p.z = C.z + dz / d * 2.5; }
}
function distTo(at, d = [0, 0]) { const i = me(), P = W(at, d); return i && P ? Math.hypot(i.x - P.x, i.z - P.z) : 1e9; }

// ---------- scene: Helios Mercy, Deimos Lockup, the impound ----------
function sign(text, bg, fg, w = 8) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 96); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(3, 3, 506, 90);
  x.fillStyle = fg; x.font = '800 54px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); return m;
}
function box(w, h, d, col, x, y, z, g) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })); m.position.set(x, y + h / 2, z); g.add(m); return m; }
function fence(g, x0, x1, z0, z1, y, col, gaps = []) {
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.4 }), post = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6);
  const side = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.5);
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; if (gaps.some(q => x > q[0] - 0.01 && x < q[1] + 0.01 && z > q[2] - 0.01 && z < q[3] + 0.01)) continue; const m = new THREE.Mesh(post, mat); m.position.set(x, y + 1.3, z); g.add(m); }
    for (const hy of [0.6, 1.6, 2.5]) { const segs = []; let open = false, sx = ax, sz = az; for (let i = 0; i <= 40; i++) { const x = ax + (bx - ax) * i / 40, z = az + (bz - az) * i / 40, gap = gaps.some(q => x > q[0] && x < q[1] && z > q[2] && z < q[3]); if (gap && !open) { segs.push([sx, sz, x, z]); open = true; } if (!gap && open) { sx = x; sz = z; open = false; } } if (!open) segs.push([sx, sz, bx, bz]);
      for (const [a1, b1, a2, b2] of segs) { const l = Math.hypot(a2 - a1, b2 - b1); if (l < 0.2) continue; const r = new THREE.Mesh(new THREE.BoxGeometry(l, 0.07, 0.07), mat); r.position.set((a1 + a2) / 2, y + hy, (b1 + b2) / 2); r.rotation.y = -Math.atan2(b2 - b1, a2 - a1); g.add(r); } } };
  side(x0, z0, x1, z0); side(x1, z0, x1, z1); side(x1, z1, x0, z1); side(x0, z1, x0, z0);
}
function guardMesh() {
  const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: 0x1b2a44, roughness: 0.8 }), vis = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x2244aa, emissiveIntensity: 0.6 });
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.2, 8), body); t.position.y = 0.95; g.add(t);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), vis); h.position.y = 1.75; g.add(h);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(SIGHT.half) * SIGHT.r, SIGHT.r, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  cone.rotation.x = Math.PI / 2; cone.position.set(0, 0.25, -SIGHT.r / 2); g.add(cone); g.visible = false; return g;
}
function build(scene) {
  teardown(); G = new THREE.Group(); G.name = 'consequences'; const c = colony(); if (!c) return;
  const H = W(PL.hospital.at), L = W(PL.lockup.at), I = W(PL.impound.at);
  { const g = new THREE.Group(), y = ground(H.x, H.z); g.position.set(H.x, y - 0.2, H.z);
    box(20, 8, 12, 0xeef1f4, 0, 0, 0, g); box(8, 3.4, 4, 0xd9dee4, 0, 0, 7.2, g); box(3.4, 3, 0.2, 0x2a6fdb, 0, 0, 9.25, g);
    const s = sign('HELIOS MERCY', '#ffffff', '#c8102e', 12); s.position.set(0, 9.2, 6.05); g.add(s);
    const x1 = box(1, 3.2, 0.3, 0xc8102e, 0, 4.4, 6.1, g), x2 = box(3.2, 1, 0.3, 0xc8102e, 0, 5.5, 6.1, g); x1.position.y = 5.9; x2.position.y = 5.9;
    G.add(g); }
  { const g = new THREE.Group(), y = ground(L.x, L.z); g.position.set(L.x, y - 0.2, L.z);
    box(16, 6, 8, 0x6b6f75, 0, 0, -10, g); box(16.4, 0.5, 8.4, 0x3d4046, 0, 6, -10, g);
    for (let i = -3; i <= 3; i++) box(0.9, 0.9, 0.12, 0x111111, i * 2.1, 3.6, -5.94, g);
    fence(g, YARD.x0, YARD.x1, YARD.z0, YARD.z1, 0, 0x9aa1a8, [[YARD.x0 - 0.5, YARD.x0 + 0.5, GAP.z0, GAP.z1]]);
    box(4.5, 2.6, 2, 0x2b2f36, DESK[0], 0, DESK[1] + 1.3, g); const s = sign('DEIMOS LOCKUP', '#0b0b0b', '#ffffff', 10); s.position.set(0, 7.3, -5.9); g.add(s);
    const s2 = sign('FRONT DESK · EVIDENCE', '#0b0b0b', '#ffd400', 5); s2.position.set(DESK[0], 3.3, DESK[1] + 2.35); g.add(s2);
    const s3 = sign('SERVICE GATE', '#ffd400', '#000000', 3.4); s3.position.set(YARD.x0 - 0.2, 2.9, (GAP.z0 + GAP.z1) / 2); s3.rotation.y = Math.PI / 2; g.add(s3);
    G.add(g); }
  { const g = new THREE.Group(), y = ground(I.x, I.z); g.position.set(I.x, y - 0.2, I.z);
    fence(g, LOT.x0, LOT.x1, LOT.z0, LOT.z1, 0, 0xc0c4c8, [[-3, 3, LOT.z1 - 0.5, LOT.z1 + 0.5]]);
    box(2.6, 2.6, 2.6, 0x30343b, BOOTH[0], 0, BOOTH[1], g); const s = sign('COLSEC IMPOUND', '#ffd400', '#000000', 8); s.position.set(0, 3.6, LOT.z1 + 0.1); g.add(s);
    G.add(g); }
  guardMeshes = GUARDS.map(() => { const m = guardMesh(); G.add(m); return m; });
  scene.add(G); G.userData.colony = c.x + ',' + c.z;
  try { window.SSX?.minimap?.addMarks?.('consequences', [{ ...H, color: '#ff3355', r: 3, ring: true }, { ...L, color: '#3db4ff', r: 3, ring: true }, { ...I, color: '#ffd400', r: 2.6, ring: true }]); } catch (e) { /* */ }
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } }); } G = null; guardMeshes = []; try { window.SSX?.minimap?.clear?.('consequences'); } catch (e) { /* */ } }

// ---------- UI ----------
const css = `
#cqScreen{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,.72);pointer-events:none}
#cqScreen.on{display:flex}#cqScreen b{font:900 clamp(54px,14vw,132px)/1 Impact,'Arial Black',system-ui,sans-serif;letter-spacing:.06em;-webkit-text-stroke:3px #fff;text-shadow:0 0 18px #000,4px 4px 0 #000}
#cqScreen small{margin-top:14px;color:#fff;font:800 20px/1.2 system-ui,sans-serif;text-shadow:0 2px 6px #000}
#cqPanel{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
#cqPanel.show{display:flex}#cqPanel .wrap{width:min(460px,calc(100vw - 20px));max-height:calc(100vh - 40px);overflow:auto;background:#000;color:#fff;border:3px solid #fff;border-radius:16px;padding:14px 14px 10px;font:600 15px/1.35 system-ui,sans-serif}
#cqPanel h2{margin:0 0 4px;font:900 21px/1.2 system-ui,sans-serif}#cqPanel p{margin:6px 0}#cqPanel .sub{color:#ddd;font-size:13px}
#cqPanel button{display:block;width:100%;min-height:48px;margin:8px 0 0;padding:8px 12px;border-radius:12px;border:2px solid #fff;background:#111;color:#fff;font:800 15px/1.2 system-ui,sans-serif;text-align:left;touch-action:manipulation}
#cqPanel button.pri{background:#fff;color:#000}#cqPanel button:disabled{opacity:.45}#cqPanel button small{display:block;font-weight:600;font-size:12px;opacity:.85}
#cqPanel .msg{min-height:18px;margin-top:8px;color:#ffd400;font-weight:800}
#cqHud{position:fixed;z-index:14;left:50%;transform:translateX(-50%);top:calc(116px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;max-width:calc(100vw - 20px);background:#000;color:#fff;border:2px solid #fff;border-radius:14px;padding:4px 4px 4px 12px;font:800 14px/1.2 system-ui,sans-serif}
#cqHud.on{display:flex}#cqHud.alarm{border-color:#ff2a2a;background:#2a0000}#cqHud button{min-height:44px;min-width:64px;border-radius:10px;border:2px solid #fff;background:#fff;color:#000;font:900 14px system-ui,sans-serif;touch-action:manipulation}
`;
let screenEl, panel, pBody, pMsg, hud, hudTx, hudBtn, dockBtn, screenT = 0;
function tap(el, fn) { let last = 0; const g = e => { const n = performance.now(); if (e?.type === 'click' && n - last < 700) return; if (e?.type === 'pointerup') last = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  screenEl = document.createElement('div'); screenEl.id = 'cqScreen'; screenEl.setAttribute('aria-live', 'assertive'); screenEl.innerHTML = '<b></b><small></small>'; document.body.appendChild(screenEl);
  panel = document.createElement('div'); panel.id = 'cqPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Legal"><div id="cqBody"></div><div class="msg" id="cqMsg"></div></div>'; document.body.appendChild(panel);
  pBody = panel.querySelector('#cqBody'); pMsg = panel.querySelector('#cqMsg');
  hud = document.createElement('div'); hud.id = 'cqHud'; hud.innerHTML = '<span class="tx"></span><button id="cqHudBtn" type="button">Options</button>'; document.body.appendChild(hud);
  hudTx = hud.querySelector('.tx'); hudBtn = hud.querySelector('#cqHudBtn'); tap(hudBtn, () => hudAction());
  addEventListener('keydown', e => { if (e.code !== HOTKEY || e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || !app()?.state?.onSurface) return; panel.classList.contains('show') ? closePanel() : showPanel(custody?.inCell ? 'booking' : 'legal'); });
  try { window.SSX.registerMenuItem({ id: 'rmLegal', label: '⚖️ Legal', onTap: () => showPanel(custody?.inCell ? 'booking' : 'legal') }); } catch (e) { console.warn('consequences menu', e); }
  dockAttach();
  try { window.SSX?.phone?.addContact?.({ id: 'lawyer', name: LAWYER.name, icon: LAWYER.icon, onCall: () => showPanel(custody?.inCell ? 'booking' : 'legal') }); } catch (e) { /* no phone */ }
}
function dockAttach() {
  const attach = () => { const d = document.getElementById('ssxDock'); if (!d) return false; if (document.getElementById('dockLegal')) return true;
    dockBtn = document.createElement('button'); dockBtn.id = 'dockLegal'; dockBtn.type = 'button'; dockBtn.textContent = '⚖️\nLegal'; dockBtn.setAttribute('aria-label', 'Legal: lawyer, bail, impound'); dockBtn.style.order = '6'; dockBtn.style.display = 'none'; d.appendChild(dockBtn);
    tap(dockBtn, () => panel.classList.contains('show') ? closePanel() : showPanel(custody?.inCell ? 'booking' : 'legal')); return true; };
  if (attach()) return; try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no dock */ }
}
function screen(big, small, col, ms = 2300) { if (!screenEl) return; screenEl.querySelector('b').textContent = big; screenEl.querySelector('b').style.color = col; screenEl.querySelector('small').textContent = small || ''; screenEl.classList.add('on'); clearTimeout(screenT); screenT = setTimeout(() => screenEl.classList.remove('on'), ms); }
const fmtH = h => { const m = Math.round(((h % 24) + 24) % 24 * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
let pMode = null, pData = null;
function showPanel(mode, data) {
  if (!panel) return; pMode = mode; pData = data || null; pMsg.textContent = '';
  render(); panel.classList.add('show'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
}
function closePanel() { panel?.classList.remove('show'); pMode = null; }
function btn(id, label, sub, pri, dis) { return `<button type="button" data-a="${id}" class="${pri ? 'pri' : ''}" ${dis ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
function render() {
  if (!pBody) return; const q = quote(), cr = credits(); let h = '';
  if (pMode === 'receipt') h = `<h2>${esc(pData?.title || '')}</h2>${(pData?.lines || []).map(l => `<p>${esc(l)}</p>`).join('')}${btn('close', 'OK', '', true)}`;
  else if (pMode === 'booking' && custody) {
    const c = custody;
    h = `<h2>🔒 Deimos Lockup · booking</h2><p class="sub">${c.stars ? '★'.repeat(c.stars) + ' · ' : ''}Strikes ${S.strikes}/5 · 💰 ${cr} cr${c.lawyer ? ' · ⚖️ ' + esc(LAWYER.name) : ''}</p>`
      + `<p>Seized: ${c.weapons?.n | 0} weapon${(c.weapons?.n | 0) === 1 ? '' : 's'} (evidence locker), ${c.contraband?.n | 0} units of product.${S.impound ? ' Your rover was towed to the ColSec Impound.' : ''}</p>`
      + btn('serve', `⏳ Serve ${q.time + c.extra} hours`, 'Free. The clock moves on. Weapons wait in the evidence locker.')
      + btn('bail', `💳 Post bail · ${q.bail} cr`, 'Out now. Weapons wait in the evidence locker.', false, cr < q.bail)
      + btn('bribe', `💵 Bribe Sergeant Kade · ${q.bribe} cr`, c.refused ? 'He said no.' : `About ${Math.round(q.bribeOdds * 100)}% he takes it (ColSec rep, strikes). Everything comes back. A no costs a strike.`, false, c.refused || cr < q.bribe)
      + btn('lawyer', c.lawyer ? `⚖️ ${LAWYER.name} is on it` : `⚖️ Call ${LAWYER.name} · ${q.lawyer} cr`, c.lawyer ? 'Bail −40%, time halved, locker and impound fees cut.' : 'Cuts bail 40%, halves the time, trims the locker and impound fees.', false, c.lawyer || cr < q.lawyer)
      + btn('jailbreak', '🏃 Break out', 'Sneak past two guards to the service gate, or get spotted and fight. You leave wanted.');
  } else {
    h = `<h2>⚖️ Legal</h2><p class="sub">${esc(LAWYER.name)} · ${esc(LAWYER.firm)} · Strikes ${S.strikes}/5 · 💰 ${cr} cr · Mars ${fmtH(clock())}</p>`;
    if (jail) h += `<p>🏃 Jailbreak in progress. ${jail.spotted ? 'Alarm is up.' : 'Stay out of the torch beams.'}</p>`;
    h += btn('clear', `🧾 Clear a strike · ${q.clear} cr`, S.strikes ? 'A procedural error. One fewer strike on file.' : 'No strikes on file.', false, !S.strikes || cr < q.clear);
    h += btn('retain', lawyerOn() ? '⚖️ On retainer' : `⚖️ Retain ${LAWYER.name} · ${q.lawyer} cr`, 'Cuts the locker and impound fees.', false, lawyerOn() || cr < q.lawyer || (!S.evidence && !S.impound));
    h += btn('reclaim', S.evidence ? `🗄 Reclaim weapons · ${q.evidence} cr` : '🗄 Evidence locker: empty', S.evidence ? `${S.evidence.n} weapon${S.evidence.n === 1 ? '' : 's'} · at the Deimos Lockup front desk · no stars` : 'Nothing of yours in there.', false, !S.evidence || cr < q.evidence);
    h += btn('impound', S.impound ? `🚧 Pay the impound · ${q.impound} cr` : '🚧 Impound: nothing of yours', S.impound ? 'Your rover is at the ColSec Impound, Olympus Row. Or break it out (that\u2019s a crime).' : '', false, !S.impound || cr < q.impound);
    h += btn('mark', '📍 Mark Lockup + Impound', 'Blue and yellow rings on the minimap.');
  }
  if (pMode !== 'receipt') h += btn('close', pMode === 'booking' ? 'Decide later' : 'Close', '');
  pBody.innerHTML = h;
  pBody.querySelectorAll('button[data-a]').forEach(b => tap(b, () => { if (!b.disabled) act(b.dataset.a); }));
}
function act(a) {
  let r = null;
  if (a === 'close') { closePanel(); return; }
  if (a === 'serve') r = serve(); else if (a === 'bail') r = bail(); else if (a === 'bribe') r = bribe(); else if (a === 'lawyer' || a === 'retain') r = lawyer();
  else if (a === 'jailbreak') r = jailbreak(); else if (a === 'clear') r = clearStrike(); else if (a === 'reclaim') r = reclaim(); else if (a === 'impound') r = payImpound();
  else if (a === 'mark') { r = { ok: true, msg: '📍 Deimos Lockup (blue) and the ColSec Impound (yellow) are ringed on the minimap.' }; }
  if (!r) return;
  if (r.ok && ['serve', 'bail', 'bribe', 'jailbreak'].includes(a)) { closePanel(); return; }
  if (panel.classList.contains('show')) { render(); pMsg.textContent = r.msg || ''; }
}
function business() { return !!(custody || jail || S.evidence || S.impound || S.strikes > 0); }
function hudAction() { if (jail) { showPanel('legal'); return; } showPanel(custody?.inCell ? 'booking' : 'legal'); }
function refreshHud(force) {
  if (!hud) return; let tx = '', b = '', cls = '';
  const mars = onMars();
  if (mars && custody?.inCell) { tx = '🔒 Deimos Lockup · in custody'; b = 'Options'; }
  else if (mars && jail) { tx = jail.spotted ? '🚨 Jailbreak · fight to the service gate (west)' : '🏃 Jailbreak · reach the service gate (west) unseen'; b = 'Legal'; cls = jail.spotted ? 'alarm' : ''; }
  else if (mars && S.evidence && distTo(PL.lockup.at, DESK) < 9) { tx = '🗄 Evidence locker · front desk'; b = 'Open'; }
  else if (mars && S.impound && distTo(PL.impound.at, BOOTH) < 8) { tx = '🚧 Impound booth'; b = 'Pay'; }
  const k = tx + b + cls; if (force || k !== hudKey) { hudKey = k; hudTx.textContent = tx; hudBtn.textContent = b; hud.classList.toggle('on', !!tx); hud.classList.toggle('alarm', cls === 'alarm'); }
  if (dockBtn) dockBtn.style.display = mars && business() ? '' : 'none';
}

// ---------- tick + boot ----------
let hudT = 0;
function tick(dt, tc) {
  lastTc = tc; if (!fin(dt)) return;
  if (!onMars()) { if (G) teardown(); if (jail) endJail(false); refreshHud(); return; }
  if (!G || G.parent !== tc.scene) build(tc.scene);
  custodyTick(tc); if (jail) jailTick(dt, tc); impoundTick(dt, tc);
  if ((hudT -= dt) <= 0) { hudT = 0.25; refreshHud(); if (panel?.classList.contains('show') && pMode === 'legal') { /* live credits */ } }
}
const API = {
  ownsOutcome, status: () => ({ custody: custody ? { stars: custody.stars, lawyer: custody.lawyer, refused: custody.refused, inCell: custody.inCell, extra: custody.extra, seized: { weapons: custody.weapons?.n | 0, contraband: custody.contraband?.n | 0 } } : null,
    jail: jail ? { spotted: jail.spotted, t: Math.round(jail.t * 10) / 10 } : null, strikes: S.strikes, evidence: S.evidence ? { n: S.evidence.n, lawyer: !!S.evidence.lawyer } : null, impound: S.impound ? { ...S.impound } : null,
    lawyer: lawyerOn(), clock: clock(), pending: pending ? { why: pending.why, stars: pending.stars } : null, stats: { ...S.stats } }),
  quote: () => quote(), serve, bail, bribe, lawyer, jailbreak, reclaim, payImpound, clearStrike, clock,
  places: () => Object.values(PL).map(p => { const w = W(p.at); return { id: p.id, name: p.name, x: w?.x, z: w?.z, r: p.r }; }),
  ledger: () => S.ledger.map(l => ({ ...l })), lawyerInfo: { ...LAWYER }, open: m => showPanel(m || (custody?.inCell ? 'booking' : 'legal')), close: closePanel, on, key: HOTKEY,
  debug: {
    state: () => ({ S: JSON.parse(JSON.stringify(S)), custody: !!custody, jail: jail ? { ...jail, guards: jail.guards.map(g => ({ x: g.x, z: g.z, yaw: g.yaw })) } : null, pending }),
    reset: () => { S = fresh(); save(); custody = null; jail = null; pending = null; closePanel(); refreshHud(true); return true; },
    toLocal: (id, d) => W(PL[id].at, d || [0, 0]), layout: () => ({ YARD, CELL, FRONT, DESK, EXIT, GAP, LOT, LOT_SLOT, BOOTH, GUARDS, SIGHT }),
    freezeGuards: on => { if (jail) jail.freeze = on !== false; return !!jail; }, guards: () => jail ? jail.guards.map(g => ({ x: g.x, z: g.z, yaw: g.yaw })) : [],
    spot: () => { spotted('debug'); return !!jail?.spotted; }, inPit, impoundRover, skipClock, rover: () => { const r = lastTc?.rover; return r ? { x: r.x, y: r.y, z: r.z } : null; }, inLot
  }
};
(function boot() {
  if (!window.SSX?.on || !window.__app || !window.SSX.registerSurfaceTick) { setTimeout(boot, 200); return; }
  window.SSX.consequences = API; ui();
  window.SSX.on('game:down', d => { try { onDown(d); } catch (e) { console.warn('consequences down', e); } });
  window.SSX.on('game:respawn', d => { try { onRespawn(d); } catch (e) { console.warn('consequences respawn', e); } });
  try { PUR()?.on?.('busted', e => { if (pending && fin(e?.stars)) pending.stars = Math.max(pending.stars, e.stars | 0); }); } catch (e) { /* no pursuit */ }
  addEventListener('ssx:pursuit', e => { const d = e.detail; if (pending && (d?.type === 'busted' || d?.type === 'wasted') && fin(d.stars)) pending.stars = Math.max(pending.stars, d.stars | 0); });
  try { window.SSX.registerSurfaceTick(tick); } catch (e) { console.warn('consequences tick', e); }
})();
