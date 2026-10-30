// v7.6 Velvet Airlock slots (slots.js): the paytable math. Exact RTP over every reel combination and a seeded
// 2,000,000-spin simulation must both land in 102-105 % (slightly in the player's favour), the jackpot must be rare
// and pay ~5,000 cr at the top bet, wins must scale with the bet, and the jackpot must be the top line.
// node tests/test-slots-unit.mjs
import { SLOTS, BETS, JACKPOT_AT, exactOdds, spin, multOf, payout, mulberry32, paytable } from '../slots.js';
const bad = [], ok = (k, c, v) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${k}${v !== undefined ? ': ' + v : ''}`); if (!c) bad.push(k); };
const ex = exactOdds();
ok('exact RTP 102-105%', ex.rtp >= 1.02 && ex.rtp <= 1.05, (ex.rtp * 100).toFixed(2) + '%');
ok('hit rate 35-60%', ex.hit > 0.35 && ex.hit < 0.6, (ex.hit * 100).toFixed(1) + '%');
ok('jackpot rare (1 in 1,500-20,000)', ex.jackpotOneIn > 1500 && ex.jackpotOneIn < 20000, '1 in ' + Math.round(ex.jackpotOneIn));
ok('jackpot ~5,000 at max bet', JACKPOT_AT[200] >= 4500 && JACKPOT_AT[200] <= 5500, JACKPOT_AT[200]);
ok('bets 10/50/200', BETS.join() === '10,50,200');
const top = Math.max(...Object.values(SLOTS.three), SLOTS.twoOlympus, SLOTS.twoRed);
ok('jackpot is the top line', SLOTS.three[SLOTS.jackpot] === top);
ok('table has 10 rows', paytable().length === 10);
// rules
ok('3 olympus = jackpot 25x', multOf(['olympus', 'olympus', 'olympus']).kind === 'jackpot' && payout(['olympus', 'olympus', 'olympus'], 200).win === 5000);
ok('2 olympus = 8x', payout(['olympus', 'dust', 'olympus'], 50).win === 400);
ok('2 red = 4x', payout(['red', 'rover', 'red'], 10).win === 40);
ok('1 red = bet back', payout(['dust', 'red', 'meteor'], 50).win === 50);
ok('nothing = 0', payout(['dust', 'meteor', 'rover'], 200).win === 0);
ok('3 dust = 6x', payout(['dust', 'dust', 'dust'], 10).win === 60);
// seeded simulation, per bet
for (const b of BETS) {
  const rng = mulberry32(0xC0FFEE + b), N = 2000000; let paid = 0, jp = 0, cash = 0, low = 0;
  for (let i = 0; i < N; i++) { const r = spin(b, rng); paid += r.win; if (r.kind === 'jackpot') jp++; cash += r.win - b; if (cash < low) low = cash; }
  const rtp = paid / (N * b);
  ok(`sim RTP @${b} (2M spins)`, rtp >= 1.02 && rtp <= 1.05, (rtp * 100).toFixed(2) + `% · jackpots ${jp} (1 in ${Math.round(N / Math.max(1, jp))})`);
}
// the same seed gives the same spins
const a = mulberry32(42), c = mulberry32(42); ok('seeded RNG is repeatable', [...Array(50)].every(() => spin(10, a).reels.join() === spin(10, c).reels.join()));
if (bad.length) { console.log('FAIL: ' + bad.join(', ')); process.exit(1); } console.log('slots unit OK');
