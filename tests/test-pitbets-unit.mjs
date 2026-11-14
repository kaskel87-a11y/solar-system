// v7.5.98 Pit bets + plasma blade names. node tests/test-pitbets-unit.mjs
import { readFileSync } from 'fs';
import * as B from '../mars/pitbetscore.js';
import * as P from '../mars/plasmacore.js';
import * as K from '../mars/pitringcore.js';

let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const o = B.pairOdds(1580, 1240);
ok('favourite is shorter odds', o.a < o.b && o.a >= 1.15 && o.pA > 0.5);
const card = B.freshCard('cinder', 'soot', 1000, 20);
ok('card names', card.nameA === 'Cinder Holt' && card.nameB === 'Soot Brin' && card.phase === 'open');
ok('quote needs a fighter and a stake', !B.quote(card, 'nope', 50).ok && !B.quote(card, 'cinder', 5).ok);
const q = B.takeBet(card, 'cinder', 100);
ok('bet sticks', q.ok && card.bet.stake === 100 && q.pay === Math.round(100 * card.oddsA));
ok('one bet a card', !B.quote(card, 'soot', 50).ok);
let c = card, ev = null;
c.at = 1000;
({ card: c, event: ev } = B.step(c, 1000));
ok('bell', ev === 'bell' && c.phase === 'live');
c.force = 'cinder'; c.at = 0;
const done = B.step(c, B.LIVE_S * 1000);
ok('payout is the decimal return', done.event === 'done' && done.winner === 'cinder' && done.pay === Math.round(100 * card.oddsA));
ok('steps name the window and the seat', /betting window/.test(B.WINDOW_STEP) && /marked seat/.test(B.SEAT_STEP) && /paid/.test(B.WATCH_STEP));
ok('window and seat are outside the ropes', Math.hypot(K.BOOK.x, K.BOOK.z) > K.ROPE && Math.hypot(K.SEAT.x, K.SEAT.z) > K.ROPE);

ok('plasma colours', P.COLORS.length === 3 && P.colorOf('amber').hex && P.NAME === 'Plasma Blade');
const blob = src('mars/plasmacore.js') + src('mars/plasma.js') + src('mars/pitbets.js') + src('game.js');
ok('no film sword names', !/lightsaber|light.?saber|jedi|sith|skywalker/i.test(blob));
ok('shop sells the blade', /id: 'plasmablade'/.test(src('game.js')) && /Plasma Blade/.test(src('game.js')));
ok('swing button stays at least 48', /min-height:54px/.test(src('mars/plasma.js')) && /#meleeBtn \{ width: 48px/.test(src('index.html')));

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('pit bets unit ok');
