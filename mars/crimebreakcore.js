// Crime break at Red Static Gulch (v7.5.75, Collin): summon the hired crew for a sit-down that pays ⭐ and permanently
// buffs crew job payoffs. Pure rules for mars/crimebreak.js and tests/test-crimebreak-unit.mjs. Fiction only.
// Buff stacks into crewcore.payMul (job cash + ⭐), not a parallel RPG. Cooldown is one in-game sol (game day).
export const KEY = 'ssx.crimebreak.v1', VERSION = 1;
export const COST_CR = 500;          // buy-in after the free intro
export const STAR_PAY = 80;          // lifetime ⭐ via game.reward (rank never drops)
export const BUFF_STEP = 0.05;       // +5% crew job payoff per completed meeting
export const BUFF_CAP = 0.25;        // hard cap +25% (5 meetings)
export const COOLDOWN_SOLS = 1;      // next paid meeting after lastSol + 1
export const LINES = Object.freeze([
  { who: 'Dex', text: 'We sit. We talk. Nobody walks away clean. That\'s the deal.' },
  { who: 'Vee', text: 'Locks, ledgers, quiet doors. You point, we open. Cut stays with the table.' },
  { who: 'Soren', text: 'I hear the ColSec bands from here. We leave louder than we arrived, we\'re done.' },
  { who: 'Mags', text: 'Fronts look legal. This table doesn\'t. Keep the paper clean and the cash dirty.' }
]);

const n0 = v => (Number.isFinite(+v) ? +v : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function fresh() { return { v: VERSION, meets: 0, lastSol: -99, intro: false, buff: 0 }; }
export function load(raw) {
  let o = raw; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  if (!o || typeof o !== 'object' || o.v !== VERSION) return fresh();
  const meets = Math.max(0, Math.min(99, Math.floor(n0(o.meets)) | 0));
  const buff = clamp(n0(o.buff) || meets * BUFF_STEP, 0, BUFF_CAP);
  return { v: VERSION, meets, lastSol: Number.isFinite(+o.lastSol) ? +o.lastSol : -99, intro: !!o.intro, buff };
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
