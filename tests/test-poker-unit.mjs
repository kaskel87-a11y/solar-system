// node tests/test-poker-unit.mjs
import {
  card, eval5, evalBest, cmpScore, freshDeck, strength01, HAND_NAMES, cardLabel,
} from '../activities/poker-eval.js';

let fails = 0;
const ok = (name, cond) => { if (!cond) { fails++; console.error('FAIL', name); } else console.log('ok', name); };

const C = (r, s) => card(r, s); // r 0=2 .. 12=A

ok('royal', evalBest([C(12,0),C(11,0),C(10,0),C(9,0),C(8,0)]).name === 'Royal flush');
ok('straightFlush', evalBest([C(8,1),C(7,1),C(6,1),C(5,1),C(4,1)]).category === 8);
ok('quads', evalBest([C(12,0),C(12,1),C(12,2),C(12,3),C(3,0)]).category === 7);
ok('fullHouse', evalBest([C(10,0),C(10,1),C(10,2),C(3,0),C(3,1)]).category === 6);
ok('flush', evalBest([C(12,2),C(9,2),C(7,2),C(4,2),C(2,2)]).category === 5);
ok('straight', evalBest([C(8,0),C(7,1),C(6,2),C(5,3),C(4,0)]).category === 4);
ok('wheel', evalBest([C(12,0),C(0,1),C(1,2),C(2,3),C(3,0)]).category === 4);
ok('trips', evalBest([C(5,0),C(5,1),C(5,2),C(12,0),C(9,1)]).category === 3);
ok('twoPair', evalBest([C(12,0),C(12,1),C(3,0),C(3,1),C(9,2)]).category === 2);
ok('pair', evalBest([C(12,0),C(12,1),C(2,0),C(5,1),C(9,2)]).category === 1);
ok('high', evalBest([C(12,0),C(10,1),C(8,2),C(5,3),C(2,0)]).category === 0);

const a = eval5([C(12,0),C(12,1),C(11,0),C(10,1),C(2,2)]);
const b = eval5([C(11,0),C(11,1),C(12,0),C(10,1),C(2,2)]);
ok('pairAcesBeatPairKings', cmpScore(a, b) > 0);

// 7-card: board makes flush
const seven = evalBest([C(12,0),C(2,1), C(9,0),C(7,0),C(4,0),C(3,0),C(12,2)]);
ok('sevenCardFlush', seven.category === 5);

ok('deck52', freshDeck(() => 0.1).length === 52);
ok('labels', cardLabel(C(12,0)) === 'Ac' && cardLabel(C(0,3)) === '2s');
ok('strengthOrder', strength01([8, 10]) > strength01([1, 12]));
ok('handNames10', HAND_NAMES.length === 10);

// Full house beats flush
ok('fhBeatFlush', cmpScore(
  evalBest([C(9,0),C(9,1),C(9,2),C(2,0),C(2,1)]).score,
  evalBest([C(12,0),C(10,0),C(8,0),C(4,0),C(3,0)]).score,
) > 0);

console.log(fails ? `FAIL ${fails}` : 'ALL PASS');
process.exit(fails ? 1 : 0);
