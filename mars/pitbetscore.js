// v7.5.98 spectator card at The Pit. Pure rules. No Star Wars names.
export const OPEN_S = 22, LIVE_S = 11, DONE_S = 7, MIN = 10, CAP = 1000;
export const STAKES = [50, 100, 250];
export const FIGHTERS = [
  { id: 'cinder', name: 'Cinder Holt', rating: 1580 },
  { id: 'pebble', name: 'Pebble Quinn', rating: 1410 },
  { id: 'marrow', name: 'Marrow Venn', rating: 1320 },
  { id: 'soot', name: 'Soot Brin', rating: 1240 }
];
export const BY = Object.fromEntries(FIGHTERS.map(f => [f.id, f]));
export const WINDOW_STEP = 'Walk to the betting window. The board shows both odds.';
export const SEAT_STEP = 'Your bet is down. Take the marked seat in the stands.';
export const WATCH_STEP = 'Watch the fight. You get paid when one of them drops.';

export function pairOdds(ra, rb) {
  const p = 1 / (1 + 10 ** ((rb - ra) / 400));
  const dec = p0 => Math.max(1.15, Math.round((1 / Math.max(0.05, p0)) * 0.92 * 100) / 100);
  return { pA: p, a: dec(p), b: dec(1 - p) };
}
export function pickPair(rng) {
  const i = Math.floor(rng() * FIGHTERS.length);
  let j = Math.floor(rng() * (FIGHTERS.length - 1));
  if (j >= i) j++;
  return [FIGHTERS[i].id, FIGHTERS[j].id];
}
export function freshCard(a, b, now, openS = OPEN_S) {
  const A = BY[a], B = BY[b], o = pairOdds(A.rating, B.rating);
  return { a, b, nameA: A.name, nameB: B.name, oddsA: o.a, oddsB: o.b, pA: o.pA, phase: 'open', at: now + openS * 1000, winner: null, bet: null, force: null };
}
export function quote(card, id, stake) {
  if (!card || card.phase !== 'open') return { ok: false, why: 'The bell already went. Wait for the next card.' };
  if (id !== card.a && id !== card.b) return { ok: false, why: 'That fighter is not on this card.' };
  stake = Math.round(+stake || 0);
  if (card.bet) return { ok: false, why: 'You already have money on this card.' };
  if (stake < MIN) return { ok: false, why: 'Minimum bet is 10 cr.' };
  if (stake > CAP) return { ok: false, why: 'The book caps a bet at 1,000 cr.' };
  const odds = id === card.a ? card.oddsA : card.oddsB;
  return { ok: true, id, stake, odds, pay: Math.round(stake * odds) };
}
export function takeBet(card, id, stake) {
  const q = quote(card, id, stake);
  if (!q.ok) return q;
  card.bet = { id, stake: q.stake, odds: q.odds };
  return q;
}
// advance the clock. returns { card, event, pay }
export function step(card, now, rng = Math.random) {
  if (!card) return { card: null, event: null, pay: 0 };
  if (card.phase === 'open' && now >= card.at) { card.phase = 'live'; card.at = now; return { card, event: 'bell', pay: 0 }; }
  if (card.phase === 'live' && now >= card.at + LIVE_S * 1000) {
    const w = card.force || (rng() < card.pA ? card.a : card.b);
    card.winner = w; card.phase = 'done'; card.at = now;
    const pay = card.bet && card.bet.id === w ? Math.round(card.bet.stake * card.bet.odds) : 0;
    return { card, event: 'done', pay, winner: w };
  }
  if (card.phase === 'done' && now >= card.at + DONE_S * 1000) return { card: null, event: 'next', pay: 0 };
  return { card, event: null, pay: 0 };
}
