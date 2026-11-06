// Crime break at Red Static Gulch (v7.5.76, Collin): summon the hired crew for a sit-down that pays ⭐ and permanently
// buffs crew job payoffs. Same panel also sells a fixed 100 cr → 10 lifetime ⭐ exchange (no cooldown) and, only at the
// gulch, quotes Blue's house products. Pure rules for mars/crimebreak.js and tests/test-crimebreak-unit.mjs. Fiction only.
// Buff stacks into crewcore.payMul (job cash + ⭐), not a parallel RPG. Cooldown is one in-game sol (game day).
// The exchange never touches meetings, the buy-in, the buff, or the cooldown. The market never sells (no street price here).
export const KEY = 'ssx.crimebreak.v1', VERSION = 1;
export const COST_CR = 500;          // buy-in after the free intro
export const STAR_PAY = 80;          // lifetime ⭐ via game.reward (rank never drops)
export const BUFF_STEP = 0.05;       // +5% crew job payoff per completed meeting
export const BUFF_CAP = 0.25;        // hard cap +25% (5 meetings)
export const COOLDOWN_SOLS = 1;      // next paid meeting after lastSol + 1
export const EX_COST = 100;          // credits charged once via game.spend(100)
export const EX_STARS = 10;          // lifetime ⭐ granted only after that charge, via game.reward(10, 0)
export const HOUSE = Object.freeze(['lowg', 'glowdust', 'redstatic', 'voidhoney']); // Blue's four, priced from the live catalog
export const QTYS = Object.freeze([1, 5]);
export const LINES = Object.freeze([
  { who: 'Dex', text: 'We sit. We talk. Nobody walks away clean. That\'s the deal.' },
  { who: 'Vee', text: 'Locks, ledgers, quiet doors. You point, we open. Cut stays with the table.' },
  { who: 'Soren', text: 'I hear the ColSec bands from here. We leave louder than we arrived, we\'re done.' },
  { who: 'Mags', text: 'Fronts look legal. This table doesn\'t. Keep the paper clean and the cash dirty.' }
]);

const n0 = v => (Number.isFinite(+v) ? +v : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const haveCr = n => Math.max(0, Math.floor(Number(n) || 0));

export function fresh() { return { v: VERSION, meets: 0, lastSol: -99, intro: false, buff: 0, bought: 0 }; }
export function load(raw) {
  let o = raw; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  if (!o || typeof o !== 'object' || o.v !== VERSION) return fresh();
  const meets = Math.max(0, Math.min(99, Math.floor(n0(o.meets)) | 0));
  const buff = clamp(n0(o.buff) || meets * BUFF_STEP, 0, BUFF_CAP);
  // bought is optional: saves from v7.5.75 have no exchange count and must keep meetings, cooldown, and buff
  const bought = Math.max(0, Math.min(1000000, Math.floor(n0(o.bought)) | 0));
  return { v: VERSION, meets, lastSol: Number.isFinite(+o.lastSol) ? +o.lastSol : -99, intro: !!o.intro, buff, bought };
}
export const payBonus = s => clamp(n0(s?.buff) || (s?.meets | 0) * BUFF_STEP, 0, BUFF_CAP);
export const buffPct = s => Math.round(payBonus(s) * 100);
export const nextSol = s => (s?.meets | 0) === 0 ? null : (n0(s.lastSol) + COOLDOWN_SOLS);
export function ready(s, sol) {
  if ((s?.meets | 0) === 0) return { ok: true, intro: true };
  const need = nextSol(s); if (!Number.isFinite(sol)) return { ok: false, why: 'No clock.', need };
  if (sol < need) return { ok: false, why: `Next crime break on sol ${need}.`, need, wait: need - sol };
  return { ok: true, intro: false, need };
}
// can we open / start a meeting right now? charges nothing; complete() takes the money.
export function canStart(s, { crew = 0, atGulch = false, credits = 0, sol = 0 } = {}) {
  if (!(crew > 0)) return { ok: false, why: 'Hire someone first: ☰ → 👥 Crew.', needCrew: true };
  if (!atGulch) return { ok: false, why: 'Crime break only works at Red Static Gulch.' };
  const r = ready(s, sol); if (!r.ok) return r;
  if (!r.intro && credits < COST_CR) return { ok: false, why: `Buy-in is ${COST_CR} cr. You have ${Math.max(0, credits | 0)} cr.`, short: true, cost: COST_CR };
  return { ok: true, intro: !!r.intro, cost: r.intro ? 0 : COST_CR, stars: STAR_PAY, buffNext: Math.min(BUFF_CAP, payBonus(s) + BUFF_STEP) };
}
// finish one meeting: charge, bump buff/meets/lastSol, return payout. Idempotent via caller guard; this itself is all-or-nothing on a fresh call.
// Does not touch the exchange count.
export function complete(s, { sol = 0, credits = 0, pay } = {}) {
  const gate = canStart(s, { crew: 1, atGulch: true, credits, sol });
  if (!gate.ok) return { ok: false, why: gate.why, short: gate.short, need: gate.need };
  if (gate.cost > 0) {
    if (typeof pay !== 'function') return { ok: false, why: `Need ${gate.cost} cr.` };
    const p = pay(gate.cost); if (!p?.ok) return { ok: false, why: p?.msg || `Need ${gate.cost} cr.` };
  }
  s.meets = (s.meets | 0) + 1;
  s.intro = true;
  s.lastSol = Number.isFinite(+sol) ? +sol : s.lastSol;
  s.buff = Math.min(BUFF_CAP, payBonus({ meets: s.meets - 1, buff: s.buff }) + BUFF_STEP);
  return {
    ok: true, intro: gate.cost === 0, cost: gate.cost, stars: STAR_PAY, meets: s.meets,
    buff: s.buff, buffPct: Math.round(s.buff * 100), next: nextSol(s),
    msg: gate.cost === 0
      ? `👥 Free intro at the gulch. +${STAR_PAY} ⭐. Crew jobs pay +${Math.round(s.buff * 100)}% now.`
      : `👥 Crime break done. −${gate.cost} cr, +${STAR_PAY} ⭐. Crew jobs pay +${Math.round(s.buff * 100)}%. Next sol ${nextSol(s)}.`
  };
}

// ---------- 100 cr → 10 lifetime ⭐ (no cooldown, no crew, not the meeting) ----------
export function canExchange(credits) {
  const have = haveCr(credits);
  if (have < EX_COST) return { ok: false, why: `Need ${EX_COST} cr for ${EX_STARS} ⭐. You have ${have} cr.`, short: true, cost: EX_COST, stars: EX_STARS, have };
  return { ok: true, cost: EX_COST, stars: EX_STARS, have };
}
// Charge exactly EX_COST via pay(), then grant() the stars. Grant failure refunds through pay()'s refund and does not count.
// Meeting fields are not modified. No star → cr path.
export function exchange(s, { credits = 0, pay, grant } = {}) {
  const gate = canExchange(credits);
  if (!gate.ok) return { ok: false, why: gate.why, short: true, cost: EX_COST, stars: EX_STARS, charged: false };
  if (typeof pay !== 'function' || typeof grant !== 'function') return { ok: false, why: 'Game isn’t ready.', charged: false };
  const p = pay(EX_COST);
  if (!p?.ok) return { ok: false, why: p?.msg || `Need ${EX_COST} cr.`, short: true, charged: false };
  try {
    const g = grant();
    if (g && g.ok === false) throw new Error(g.msg || 'reward failed');
  } catch (e) {
    let refunded = false;
    try { if (typeof p.refund === 'function') { p.refund(); refunded = true; } } catch (e2) { refunded = false; }
    return { ok: false, why: refunded ? `Exchange failed. ${EX_COST} cr returned.` : 'Exchange failed after the charge.', charged: !refunded, refunded, err: String(e?.message || e) };
  }
  if (s) s.bought = Math.min(1000000, (s.bought | 0) + 1);
  return {
    ok: true, cost: EX_COST, stars: EX_STARS, bought: s?.bought | 0, charged: true,
    msg: `−${EX_COST} cr, +${EX_STARS} lifetime ⭐. Star Shop can spend them. Rank is not lowered. Exchanges: ${s.bought}.`
  };
}

// ---------- gulch market quotes (prices come from the caller’s catalog; this file does not sell) ----------
export function marketGate(atGulch) {
  if (!atGulch) return { ok: false, travel: true, why: 'Market is at Red Static Gulch. Walk there to buy.' };
  return { ok: true };
}
function roomFor(item, held, used, carry) {
  const max = Math.max(0, item?.max | 0), have = Math.max(0, held | 0);
  const cap = Math.max(0, carry | 0), usedN = Math.max(0, used | 0);
  return Math.max(0, Math.min(max - have, cap - usedN));
}
export function marketQuote(item, qty, { credits = 0, held = 0, used = 0, carry = 0 } = {}) {
  const q = Math.floor(Number(qty));
  if (!item || typeof item !== 'object') return { ok: false, why: 'Unknown product.' };
  if (item.stock === false) return { ok: false, why: `${item.name || 'That'} isn’t sold here.` };
  if (!(carry > 0)) return { ok: false, why: 'Stash isn’t loaded.', room: 0 };
  if (q !== 1 && q !== 5) return { ok: false, why: 'Buy 1 or 5.' };
  const unit = Math.floor(Number(item.supplier));
  if (!Number.isFinite(unit) || unit <= 0) return { ok: false, why: 'No credit price.' };
  const cost = unit * q, have = haveCr(credits), room = roomFor(item, held, used, carry);
  const name = item.name || item.id || 'that';
  if (room < q) {
    const why = room <= 0
      ? (used >= carry ? `Pockets full (${carry} units).` : `You can only carry ${item.max | 0} ${name}.`)
      : `Only room for ${room} ${name}. ${q} would not fit.`;
    return { ok: false, why, room, cost, short: false, full: true, qty: q, unit };
  }
  if (have < cost) return { ok: false, why: `Need ${cost} cr for ${q} ${name} (${unit} cr each). You have ${have} cr.`, short: true, room, cost, qty: q, unit };
  return { ok: true, qty: q, unit, cost, room };
}
export function starQuote(item, price, { balance = 0, held = 0, used = 0, carry = 0, blocked = null } = {}) {
  if (!item || typeof item !== 'object') return { ok: false, why: 'Unknown product.' };
  if (!(carry > 0)) return { ok: false, why: 'Stash isn’t loaded.', room: 0 };
  if (blocked) return { ok: false, why: String(blocked), blocked: true };
  const unit = Math.floor(Number(price));
  if (!Number.isFinite(unit) || unit <= 0) return { ok: false, why: 'No star price.' };
  const room = roomFor(item, held, used, carry), name = item.name || item.id || 'that';
  if (room < 1) {
    const why = used >= carry ? `Pockets full (${carry} units).` : `You can only carry ${item.max | 0} ${name}.`;
    return { ok: false, why, room, price: unit, full: true };
  }
  const have = haveCr(balance);
  if (have < unit) return { ok: false, why: `Need ${unit} ⭐ for 1 ${name}. You have ${have} ⭐ to spend.`, short: true, price: unit, room };
  return { ok: true, qty: 1, price: unit, room };
}
// Rows for the four house products that the live catalog actually contains. Prices are the catalog’s, never invented here.
export function present(items, starPrices, { atGulch = false, credits = 0, balance = 0, blocked = null, stash = {}, cap = {} } = {}) {
  const gate = marketGate(atGulch);
  const by = new Map((Array.isArray(items) ? items : []).map(it => [it && it.id, it]));
  const used = cap?.used | 0, carry = cap?.max | 0;
  const rows = [];
  for (const id of HOUSE) {
    const it = by.get(id);
    if (!it || it.stock === false) continue;
    const held = stash?.items?.[id]?.qty || 0;
    const buys = QTYS.map(q => ({ q, ...marketQuote(it, q, { credits, held, used, carry }) }));
    const starPrice = starPrices && Number.isFinite(+starPrices[id]) ? +starPrices[id] : null;
    const star = starPrice == null
      ? { ok: false, why: 'No star price.' }
      : starQuote(it, starPrice, { balance, held, used, carry, blocked });
    rows.push({
      id, name: it.name, icon: it.icon || '', blurb: it.blurb || '', supplier: it.supplier, max: it.max | 0, held,
      fresh: stash?.items?.[id]?.fresh ?? null, starPrice, buys, star
    });
  }
  return { ok: gate.ok, why: gate.why || '', travel: !!gate.travel, rows, used, carry };
}

// busy lock + short dedupe so a double tap / reload-race cannot pay twice
export function makeGuard(clock = () => Date.now(), ms = 300) {
  let busy = false; const last = new Map();
  return {
    run(key, fn) {
      const t = clock(); if (busy || (last.has(key) && t - last.get(key) < ms)) return { ok: false, dup: true };
      busy = true; last.set(key, t);
      try { return fn(); } finally { busy = false; }
    },
    get busy() { return busy; }
  };
}
