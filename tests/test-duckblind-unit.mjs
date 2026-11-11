// Duck Blind rules. Run: node tests/test-duckblind-unit.mjs
import * as C from '../duckblindcore.js';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } else console.log('PASS', name); };

ok('tenAndThree', C.DUCKS === 10 && C.SHOTS === 3);
ok('faster', C.flightMs(2) < C.flightMs(1) && C.flightMs(5) < C.flightMs(2) && C.flightMs(20) >= 900);
const d = C.spawnDuck(1, () => 0.1);
ok('spawn', d.shots === 3 && d.t === 0 && (d.from === 'left' || d.from === 'right'));
const a = C.duckPoint({ from: 'left', lane: 0.3, amp: 0, phase: 0 }, 0);
const b = C.duckPoint({ from: 'left', lane: 0.3, amp: 0, phase: 0 }, 1);
ok('fliesAcross', a.x < 0.05 && b.x > 0.95 && a.y > 0.1 && a.y < 0.7);
ok('score', C.scoreOf(8) === 800 && C.scoreOf(0) === 0);
const part = C.payOf(8, true), perfect = C.payOf(10, true), quit = C.payOf(10, false);
ok('pay', part.cr === 160 && part.stars === 0 && perfect.cr === 200 && perfect.stars === 5 && perfect.perfect && quit.stars === 0);
ok('save', C.loadState('{"best":400,"rounds":2}').best === 400 && C.loadState('nope').best === 0);
ok('onEarth', C.AT.d > 40 && C.AT.d < 160);

console.log(fails ? `FAILED ${fails}/${n}` : `OK ${n}`);
process.exit(fails ? 1 : 0);
