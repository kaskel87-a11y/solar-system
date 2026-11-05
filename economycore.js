// economycore.js: pure money rules for the v7.5 money boost (Collin: "make cr a little faster, I'm always broke").
// No DOM, no game refs, so tests/test-economy-unit.mjs can check every number. Runtime glue: economy.js.
// Tune here: PAYOUT_MULT is the one job-pay knob (SSX.economy.payoutMult overrides it live).
export const PAYOUT_MULT = 2;
export const STREAK = { windowS: 240, minGapS: 20, step: 25, cap: 100 }; // back-to-back jobs within 4 min: +25, +50, ... up to +100
export const DROP = { min: 20, max: 80 }; // cr off a knocked-out NPC, once per NPC

// job pay after the multiplier. Only positive whole payouts grow; costs, refunds and zero stay as they are.
export function scalePay(n, mult = PAYOUT_MULT) {
  const v = Number(n), m = Number.isFinite(+mult) && +mult > 0 ? +mult : 1;
  if (!Number.isFinite(v) || v <= 0) return Number.isFinite(v) ? v : 0;
  return Math.round(v * m);
}

// streak state { n, lastAt } (seconds). Returns { st, bonus, counted }.
// A job inside minGapS of the last one is the same job paying twice (heist + its mission): it neither counts nor pays.
export function streakStep(st, nowS, R = STREAK) {
  const s = st && Number.isFinite(st.lastAt) ? st : { n: 0, lastAt: -Infinity };
  const gap = nowS - s.lastAt;
  if (gap >= 0 && gap < R.minGapS) return { st: s, bonus: 0, counted: false };
  const n = gap <= R.windowS ? s.n + 1 : 0;
  return { st: { n, lastAt: nowS }, bonus: Math.min(R.cap, n * R.step), counted: true };
}

// 20-80 cr from a 0..1 roll (pass Math.random() or a seeded value)
export function dropCredits(roll, D = DROP) {
  const r = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999) : 0.5;
  return D.min + Math.floor(r * (D.max - D.min + 1));
}

// plain-word toast lines
export const streakLine = (n, bonus, R = STREAK) => `🔥 ${n + 1} jobs back to back: +${bonus} cr bonus. Finish another within ${Math.round(R.windowS / 60)} minutes to keep it going.`;
export const dropLine = (cr, who, k = 1) => k > 1 ? `💵 Picked ${cr} cr off ${k} people you knocked out.` : `💵 Picked ${cr} cr off the ${who || 'body'}.`;
