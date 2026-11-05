// v7.5.34 Velvet Airlock table games: pure rules (no DOM, no three). Blackjack (Rook's table) + single-zero Roulette
// (Sal's wheel). Cards are the poker-eval ints (rank 0=2 .. 12=A, suit 0..3) so the UI reuses cardFace.
import { card, rank } from './activities/poker-eval.js';

// ---------- Blackjack: infinite shoe, dealer peeks, stands on all 17s, blackjack pays 3:2, double on any two, no splits ----------
export const BJ_BETS = [10, 25, 50, 100];
export const BJ_RULES = 'Dealer stands on all 17s \u00b7 blackjack pays 3:2 \u00b7 double on any two \u00b7 no splits';
export const cardValue = c => { const r = rank(c); return r <= 8 ? r + 2 : r <= 11 ? 10 : 11; };
export function handValue(cards) {
  let t = 0, aces = 0; for (const c of cards) { const v = cardValue(c); t += v; if (v === 11) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { total: t, soft: aces > 0, bj: cards.length === 2 && t === 21, bust: t > 21 };
}
export const draw = rng => card(Math.floor(rng() * 13) % 13, Math.floor(rng() * 4) % 4);
export function bjDeal(bet, rng = Math.random) {
  if (!BJ_BETS.includes(bet)) return null;
  const s = { bet, staked: bet, player: [], dealer: [], done: false, result: null, payout: 0, doubled: false };
  s.player.push(draw(rng)); s.dealer.push(draw(rng)); s.player.push(draw(rng)); s.dealer.push(draw(rng));
  const p = handValue(s.player), d = handValue(s.dealer);
  if (p.bj || d.bj) return settle(s, p.bj && d.bj ? 'push' : p.bj ? 'blackjack' : 'dealerbj');
  return s;
}
function settle(s, result) {
  s.done = true; s.result = result;
  s.payout = result === 'blackjack' ? s.bet * 2.5 : result === 'win' || result === 'dealerbust' ? s.staked * 2 : result === 'push' ? s.staked : 0;
  return s;
}
function dealerPlays(s, rng) {
  while (handValue(s.dealer).total < 17) s.dealer.push(draw(rng)); // S17
  const p = handValue(s.player).total, d = handValue(s.dealer).total;
  return settle(s, d > 21 ? 'dealerbust' : p > d ? 'win' : p === d ? 'push' : 'lose');
}
export function bjHit(s, rng = Math.random) {
  if (!s || s.done) return s; s.player.push(draw(rng));
  const p = handValue(s.player); if (p.bust) return settle(s, 'bust'); if (p.total === 21) return dealerPlays(s, rng); return s;
}
export const bjStand = (s, rng = Math.random) => (!s || s.done ? s : dealerPlays(s, rng));
export const bjCanDouble = s => !!s && !s.done && s.player.length === 2 && !s.doubled;
export function bjDouble(s, rng = Math.random) { // caller has already taken the extra s.bet
  if (!bjCanDouble(s)) return s; s.doubled = true; s.staked = s.bet * 2; s.player.push(draw(rng));
  return handValue(s.player).bust ? settle(s, 'bust') : dealerPlays(s, rng);
}
export const BJ_SAY = { blackjack: 'Blackjack! Pays 3:2.', win: 'You beat the dealer.', dealerbust: 'Dealer busts. You win.', push: 'Push. Bet back.', lose: 'Dealer wins.', bust: 'Bust.', dealerbj: 'Dealer has blackjack.' };

// ---------- Roulette: European single zero (house edge 1/37 = 2.7%) ----------
export const RL_CHIPS = [10, 25, 50, 100];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = n => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
export const RL_BETS = { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1\u201318', high: '19\u201336', d1: '1st 12', d2: '2nd 12', d3: '3rd 12' };
export const spin = (rng = Math.random) => Math.floor(rng() * 37) % 37;
export function wins(kind, n, pick) { // does bet `kind` win when the ball lands on n
  if (kind === 'num') return Number.isInteger(pick) && pick >= 0 && pick <= 36 && n === pick;
  if (n === 0) return false;
  switch (kind) {
    case 'red': return RED.has(n); case 'black': return !RED.has(n);
    case 'odd': return n % 2 === 1; case 'even': return n % 2 === 0;
    case 'low': return n <= 18; case 'high': return n >= 19;
    case 'd1': return n <= 12; case 'd2': return n >= 13 && n <= 24; case 'd3': return n >= 25;
  }
  return false;
}
export const payMult = kind => (kind === 'num' ? 36 : kind[0] === 'd' ? 3 : 2); // total returned per credit staked on a win
export const rlPayout = (kind, stake, n, pick) => (wins(kind, n, pick) ? stake * payMult(kind) : 0);
// expected return per credit staked (exact, over the 37 pockets): 36/37 for every bet
export function rlExpected(kind, pick = 17) { let s = 0; for (let n = 0; n <= 36; n++) s += rlPayout(kind, 1, n, pick); return s / 37; }
