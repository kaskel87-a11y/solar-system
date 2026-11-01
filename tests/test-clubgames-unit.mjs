// v7.5.34 unit test: Velvet Blackjack + Roulette rules (clubgamescore.js), suited card faces (poker-eval cardFace) + wiring.
import * as C from '../clubgamescore.js';
import { card, cardFace, cardText } from '../activities/poker-eval.js';
import { readFileSync } from 'fs';
let fails = 0; const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };
const R = r => (r + 0.5) / 13, S = s => (s + 0.5) / 4; // rank idx (0=2..12=A), suit c d h s
const cards = list => list.flatMap(([r, s]) => [R(r), S(s)]);
// suited faces
ok('K of diamonds = K\u2666 red', JSON.stringify(cardFace(card(11, 1))) === JSON.stringify({ r: 'K', s: '\u2666', red: true }));
ok('ten shows 10, spades black', cardText(card(8, 3)) === '10\u2660' && !cardFace(card(8, 3)).red && cardFace(card(0, 2)).red && !cardFace(card(12, 0)).red);
ok('poker uses suit symbols (no more Kd)', /cardFace\(c\)/.test(src('activities/poker.js')) && !/\$\{lab\[0\]\}<small>\$\{lab\[1\]\}/.test(src('activities/poker.js')) && /card \.st \{[^}]*font-size: 1\.55rem/.test(src('activities/poker.js')));
// blackjack
ok('hand values: soft ace, bust, blackjack', C.handValue([card(12, 0), card(4, 0)]).total === 17 && C.handValue([card(12, 0), card(4, 0)]).soft && C.handValue([card(12, 0), card(12, 1), card(8, 0)]).total === 12 && C.handValue([card(12, 0), card(11, 0)]).bj && C.handValue([card(11, 0), card(10, 0), card(0, 0)]).bust);
ok('bad bet refused', C.bjDeal(7) === null && C.bjDeal(1000) === null);
let s = C.bjDeal(25, seq(cards([[11, 2], [7, 1], [7, 0], [6, 3]]))); // you K 9 = 19, dealer 9 8
ok('deal: 19 vs 9 up', !s.done && C.handValue(s.player).total === 19 && s.dealer.length === 2);
C.bjStand(s, seq([0])); ok('stand: dealer 17 stands, you win 2x', s.done && s.result === 'win' && s.payout === 50);
s = C.bjDeal(10, seq(cards([[12, 2], [3, 1], [11, 0], [6, 3]]))); ok('blackjack pays 3:2 (10 -> 25)', s.done && s.result === 'blackjack' && s.payout === 25);
s = C.bjDeal(10, seq(cards([[12, 2], [12, 1], [11, 0], [11, 3]]))); ok('both blackjack: push', s.result === 'push' && s.payout === 10);
s = C.bjDeal(10, seq(cards([[3, 2], [12, 1], [4, 0], [11, 3]]))); ok('dealer blackjack (peek): lose at once', s.done && s.result === 'dealerbj' && s.payout === 0);
s = C.bjDeal(50, seq(cards([[3, 2], [4, 1], [5, 0], [8, 3], [7, 2], [0, 0], [2, 0]]))); // you 5+7=12... dealer 6+10=16
ok('double allowed on two cards', C.bjCanDouble(s));
C.bjDouble(s, seq(cards([[7, 2], [8, 0]]))); ok('double: one card, stake 2x, settles', s.doubled && s.player.length === 3 && s.staked === 100 && s.done && (s.payout === 0 || s.payout === 100 || s.payout === 200));
s = C.bjDeal(10, seq(cards([[11, 2], [7, 1], [10, 0], [6, 3]]))); C.bjHit(s, seq(cards([[11, 0]]))); ok('hit over 21: bust, lose', s.done && s.result === 'bust' && s.payout === 0);
ok('dealer stands on soft 17', (() => { const t = C.bjDeal(10, seq(cards([[8, 2], [12, 1], [6, 0], [4, 3]]))); C.bjStand(t, seq([0.99])); return t.dealer.length === 2 && t.result === 'win'; })());
// house edge by simulation, basic-ish strategy (hit < 17): must be negative for the player
{ let rr = 12345; const rng = () => (rr = (rr * 1103515245 + 12345) % 2147483648) / 2147483648; let net = 0, N = 40000;
  for (let i = 0; i < N; i++) { const t = C.bjDeal(10, rng); while (!t.done && C.handValue(t.player).total < 17) C.bjHit(t, rng); if (!t.done) C.bjStand(t, rng); net += t.payout - t.staked; }
  ok(`blackjack has a house edge (${(net / N / 10 * 100).toFixed(1)}% per hand)`, net < 0); }
// roulette
ok('wheel colours', C.colorOf(0) === 'green' && C.colorOf(1) === 'red' && C.colorOf(2) === 'black' && C.RED.size === 18);
ok('zero loses outside bets, a 0 straight pays', !Object.keys(C.RL_BETS).some(k => C.wins(k, 0)) && C.rlPayout('num', 10, 0, 0) === 360);
ok('payouts 1:1 / 2:1 / 35:1', C.rlPayout('red', 10, 1) === 20 && C.rlPayout('black', 10, 1) === 0 && C.rlPayout('d2', 10, 13) === 30 && C.rlPayout('num', 10, 17, 17) === 360 && C.rlPayout('high', 10, 18) === 0);
ok('house edge 2.7% on every bet', [...Object.keys(C.RL_BETS), 'num'].every(k => Math.abs(C.rlExpected(k) - 36 / 37) < 1e-12));
ok('spin range 0..36', C.spin(() => 0) === 0 && C.spin(() => 0.99999) === 36);
// wiring
const ui = src('clubgames.js'), html = src('index.html'), sw = src('sw.js'), inter = src('interiors.js');
ok('tables built in the club with dealers, signs, spots', /addClubGames\(api/.test(inter) && /act: 'blackjack'/.test(ui) && /act: 'roulette'/.test(ui) && /api\.sign\('BLACKJACK'/.test(ui) && /api\.sign\('ROULETTE'/.test(ui) && (ui.match(/dealer\(\{/g) || []).length === 2);
ok('index routes both acts', /s\.act === 'blackjack' \|\| s\.act === 'roulette'\) \{ try \{ const r = openClubGame\(s\.act\)/.test(html) && /import \{ openClubGame \} from '\.\/clubgames\.js'/.test(html));
ok('black/white buttons + panelTap', /#clubGame button \{ background: #000; color: #fff;/.test(ui) && /panelTap\(el,/.test(ui));
ok('sw + importmap', /`clubgames\.js\$\{q\}`, `clubgamescore\.js\$\{q\}`/.test(sw) && /"\.\/clubgames\.js": "\.\/clubgames\.js\?v=/.test(html) && /"\.\/clubgamescore\.js": /.test(html));
ok('tables clear the door runner and sofas', (() => { const t = [[-24, 16, 1.75, 1.05], [2, 16, 1.75, 0.8]]; const blk = [[-11, 16, 1.6, 7.75], [-32, 21, 0.55, 1.65], [9.5, 21, 0.55, 1.65], [9.5, 13, 0.55, 1.65]]; return t.every(([x, z, hx, hz]) => blk.every(([bx, bz, bw, bd]) => Math.abs(x - bx) > hx + bw + 1 || Math.abs(z - bz) > hz + bd + 1) && x - hx > -33 && x + hx < 11 && z + hz + 2 < 24); })());
console.log(fails ? `${fails} FAIL` : 'all ok'); process.exit(fails ? 1 : 0);
