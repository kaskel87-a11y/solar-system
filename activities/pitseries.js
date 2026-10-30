// The Pit as a best-of-3 series (pure; runner.js drives it). First to 2 round wins; a short break between rounds.
export const BREAK_S = 5, WIN_ROUNDS = 2, MAX_ROUNDS = 3;
export const PAY = { sweep: { credits: 320, xp: 90 }, win: { credits: 200, xp: 60 }, lose: { credits: 20, xp: 10 } };

export function newSeries() { return { round: 1, me: 0, them: 0, over: false, result: null }; }
// outcome: 'win' | 'loss' (a lost or yielded bout) | 'forfeit' (walked out). Returns the same object, updated.
export function scoreRound(S, outcome) {
  if (S.over) return S;
  if (outcome === 'forfeit') { S.over = true; S.result = 'forfeit'; return S; }
  if (outcome === 'win') S.me++; else if (outcome === 'loss') S.them++; else return S;
  if (S.me >= WIN_ROUNDS) { S.over = true; S.result = S.them === 0 ? 'sweep' : 'win'; }
  else if (S.them >= WIN_ROUNDS) { S.over = true; S.result = 'lose'; }
  else S.round++;
  return S;
}
export const payout = S => (S.over && PAY[S.result]) || { credits: 0, xp: 0 };
// the objective line (shown in the existing activity chip)
export function seriesLine(S, { inDuel = false, breakS = 0 } = {}) {
  let l = `◆ Round ${S.round} of ${MAX_ROUNDS} · You ${S.me} – ${S.them}`;
  if (inDuel) l += ' ➤ fight';
  else if (breakS > 0) l += ` ➤ next bout in ${Math.ceil(breakS)} s`;
  return l;
}
// world.lastDuel.why -> series outcome
export function roundOutcome(L) {
  if (!L) return null;
  if (L.win || L.why === 'ko-win' || L.why === 'yield-win') return 'win';
  if (L.why === 'forfeit') return 'forfeit';
  if (L.why === 'ko-lose' || L.why === 'yield-lose') return 'loss';
  if (L.why === 'chicken') return 'rearm';
  return null; // abandon (left Mars) is handled by the runner
}
