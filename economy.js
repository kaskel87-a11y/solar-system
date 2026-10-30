// economy.js: the v7.5 money boost runtime (Ben). One knob: SSX.economy.payoutMult (default economycore PAYOUT_MULT = 2).
// Job payouts call jobPay(n, src) once, at their own payout point (never inside game.reward / game.bonus, so stash
// withdrawals, refunds, sales and the Rust Pit purse are untouched and nothing is doubled twice). Prices and costs: untouched.
//   jobPay(n, src, { streak = true })  -> n × payoutMult, and counts toward the back-to-back streak bonus
//   boost(n)                           -> n × payoutMult (display / top-ups; no streak)
//   npcDown(p)                         -> 20-80 cr once per knocked-out NPC (world.js people hook + 'ssx:npc-down')
// Loaded by activities/runner.js (every surface world); game.js reads it through globalThis.SSX.economy (guarded).
import { PAYOUT_MULT, STREAK, scalePay, streakStep, dropCredits, streakLine, dropLine } from './economycore.js';

const app = () => globalThis.__app;
const game = () => app()?.game || app()?.surface?.game;
const toast = (m, ms) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };
const nowS = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const credit = n => { const g = game(), P = g?.progress; if (!P || !(n > 0)) return false; P.credits += n; try { g.save?.(); } catch (e) { /* */ } return true; };

const S = { streak: { n: 0, lastAt: -Infinity }, log: [], dropped: 0, dropCr: 0, pend: { cr: 0, k: 0, who: '', t: 0 }, streakT: 0 };
const mult = () => { const m = +E.payoutMult; return Number.isFinite(m) && m > 0 ? m : PAYOUT_MULT; };

export function boost(n) { return scalePay(n, mult()); }
export function jobPay(n, src = 'job', opts = {}) {
  const out = scalePay(n, mult());
  if (S.log.length > 30) S.log.shift(); S.log.push({ src, base: n, paid: out });
  if (out > 0 && opts.streak !== false) {
    const r = streakStep(S.streak, nowS()); S.streak = r.st;
    if (r.bonus > 0 && credit(r.bonus)) { // after the job's own toast, so one pop-up at a time
      clearTimeout(S.streakT); const line = streakLine(r.st.n, r.bonus); S.streakT = setTimeout(() => toast(line, 3600), 3900);
    }
  }
  return out;
}

// knocked-out NPC: once per NPC object (p.ssxDrop is set by the caller or here); toasts are batched so a brawl is one pop-up
export function npcDown(p) {
  if (p && typeof p === 'object') { if (p.ssxDropDone || p.kind === 'contact' || p.fighter) return 0; p.ssxDropDone = 1; }
  const cr = dropCredits(Math.random()); if (!credit(cr)) return 0;
  S.dropped++; S.dropCr += cr; const P = S.pend; P.cr += cr; P.k++; P.who = p?.name || (p?.kind === 'guard' ? 'guard' : p?.kind === 'colonist' ? 'colonist' : p?.kind) || 'body';
  if (!P.t) P.t = setTimeout(() => { toast(dropLine(P.cr, P.who, P.k), 2600); P.cr = 0; P.k = 0; P.t = 0; }, 900);
  return cr;
}
// street-danger NPCs (muggers, Saltblood, escorts, chase cars) report through 'ssx:npc-down' once each; only pay when it went down near you
const near = (d, R = 30) => { const i = app()?.surface?.info; return !!i && Number.isFinite(d?.x) && Math.hypot(d.x - i.x, d.z - i.z) <= R; };
if (typeof addEventListener === 'function') addEventListener('ssx:npc-down', e => { try { const d = e.detail; if (d && near(d)) npcDown(d); } catch (x) { /* */ } });

const E = {
  __ben: 1, payoutMult: PAYOUT_MULT, STREAK,
  job: (n, src, opts) => jobPay(n, src, opts), boost: n => boost(n), npcDown: p => npcDown(p),
  state: () => ({ payoutMult: mult(), streak: S.streak.n, lastAt: S.streak.lastAt, dropped: S.dropped, dropCr: S.dropCr, log: S.log.slice(-10) }),
  debug: { reset() { S.streak = { n: 0, lastAt: -Infinity }; S.log.length = 0; S.dropped = 0; S.dropCr = 0; }, ageStreak(s) { S.streak.lastAt -= s; } },
};
// index.html assigns window.SSX = {...} after the module imports run, so (re)attach until it sticks (same as airroll.js)
function attach() { const X = globalThis.SSX || (globalThis.SSX = {}); if (X.economy !== E) X.economy = E; }
attach(); if (typeof window !== 'undefined') { setTimeout(attach, 0); setTimeout(attach, 300); setInterval(attach, 1000); }
