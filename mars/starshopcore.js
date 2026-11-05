// mars/starshopcore.js: pure star-shop logic (no DOM, no game). Used by mars/starshop.js and tests/test-starshop-unit.mjs.
// Stars are the game's XP (game.progress.xp, the ⭐ in the HUD). Rank stays on lifetime XP: buying with stars never touches
// progress.xp, it only adds to a separate "spent" counter. Spendable = lifetime XP - spent (never below 0).
export const SAVE_KEY = 'ssx.stars.v1';
// stars per unit (Collin has ~3,800 ⭐, so one item is a real choice). Fictional products only (see mars/contraband.js).
export const PRICES = { lowg: 200, glowdust: 250, redstatic: 400, voidhoney: 600 };
export const ORDER = ['lowg', 'glowdust', 'redstatic', 'voidhoney'];
export function fresh() { return { v: 1, spent: 0, log: [] }; }
export function migrate(s) {
  if (!s || typeof s !== 'object' || s.v !== 1) return fresh();
  const spent = Math.max(0, Math.floor(Number(s.spent) || 0));
  const log = Array.isArray(s.log) ? s.log.filter(e => e && Number.isFinite(e.n)).slice(-20) : [];
  return { v: 1, spent, log };
}
const xpOf = x => Math.max(0, Math.floor(Number(x) || 0));
export function balance(s, xp) { return Math.max(0, xpOf(xp) - (s?.spent | 0)); }
// a progress wipe (XP back to 0) also clears what was spent, so a fresh save starts with a clean star wallet
export function reconcile(s, xp) { if (xpOf(xp) === 0 && s.spent > 0) { s.spent = 0; s.log = []; return true; } return false; }
export function canSpend(s, xp, n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n <= 0) return { ok: false, msg: 'Nothing to pay.' };
  const b = balance(s, xp); if (b < n) return { ok: false, short: n - b, msg: `Not enough stars: you have ${b} ⭐, this costs ${n} ⭐.` };
  return { ok: true, n };
}
export function spend(s, xp, n, reason = '', now = Date.now()) {
  const v = canSpend(s, xp, n); if (!v.ok) return v;
  s.spent += v.n; s.log.push({ n: v.n, why: String(reason).slice(0, 40), t: now }); if (s.log.length > 20) s.log.shift();
  return { ok: true, n: v.n, balance: balance(s, xp) };
}
export function refund(s, n) { n = Math.floor(Number(n) || 0); if (n > 0) s.spent = Math.max(0, s.spent - n); }
// busy lock + short per-key dedupe: a second call while one runs, or the same key again within `ms`, is {ok:false,dup:true}
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
