// Unit tests for mars/fasttravelcore.js (pure logic). Run: node tests/test-fasttravel-unit.mjs
import * as C from '../mars/fasttravelcore.js';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } };

// places: normalised, deduped, bad entries dropped, ordered, fees
const raw = [{ kind: 'pit', x: 1, z: 2 }, { kind: 'farm', id: 'farm', x: 10, z: 20, name: 'Dustbowl Homestead' }, { kind: 'base', id: 'base:a', x: 0, z: 0 },
  { kind: 'farm', id: 'farm', x: 99, z: 99 }, { kind: 'nope', x: 0, z: 0 }, { kind: 'club', x: NaN, z: 1 }, null, { kind: 'turf', id: 'turf:b1', x: 5, z: 5 }];
const P = C.normPlaces(raw);
ok('normDrops', P.length === 4, JSON.stringify(P.map(p => p.id)));
ok('normOrder', P.map(p => p.kind).join() === 'base,farm,pit,turf', P.map(p => p.kind).join());
ok('normDedup', P.find(p => p.id === 'farm').x === 10);
ok('normFill', P.find(p => p.kind === 'pit').icon === '🥊' && P.find(p => p.kind === 'pit').name === 'The Pit');
ok('feeBaseFree', P.find(p => p.kind === 'base').fee === 0 && P.find(p => p.kind === 'farm').fee === C.FEE && C.FEE > 0 && C.FEE <= 50);
ok('allKinds', ['base', 'farm', 'post', 'spaceport', 'downtown', 'rough', 'gated', 'pit', 'club', 'turf'].every(k => C.KINDS[k]));
ok('normEmpty', C.normPlaces(null).length === 0 && C.normPlaces([]).length === 0);
// matching a map tap to a place
ok('matchById', C.matchPlace({ ft: 'turf:b1', x: 500, z: 500 }, P)?.id === 'turf:b1');
ok('matchNear', C.matchPlace({ x: 11, z: 22 }, P)?.id === 'farm');
ok('matchFar', C.matchPlace({ x: 300, z: 300 }, P) === null);
ok('matchNearest', C.matchPlace({ x: 3, z: 3 }, P)?.id === 'pit' || C.matchPlace({ x: 3, z: 3 }, P)?.id === 'base:a');
ok('matchBad', C.matchPlace(null, P) === null && C.matchPlace({ x: 1, z: 1 }, []) === null && C.matchPlace({ x: NaN, z: 0 }, P) === null);
// blocked, in plain words
const farm = P.find(p => p.id === 'farm'), base = P.find(p => p.kind === 'base');
const good = { onMars: true, credits: 100, here: { x: 400, z: 400 }, place: farm };
ok('canGo', C.blockReason(good) === null);
const R = o => C.blockReason({ ...good, ...o });
ok('offMars', /only works on Mars/.test(R({ onMars: false })) && /Mars/.test(C.blockReason(null)));
ok('flying', R({ flying: true }) === 'Land first.');
ok('wanted', /wanted\. Lose the cops/.test(R({ wanted: 1 })));
ok('smuggling', /smuggling run/.test(R({ smuggling: true })));
ok('heist', /heist/.test(R({ heist: true })));
ok('race', /race/.test(R({ race: true })));
ok('mission', /mission/.test(R({ mission: true })));
ok('job', /job/.test(R({ job: true })));
ok('turfWar', /turf war/.test(R({ turf: true })));
ok('wantedFirst', /wanted/.test(R({ wanted: 2, smuggling: true, race: true })));
ok('alreadyHere', /already here/.test(R({ here: { x: 12, z: 22 } })));
ok('broke', R({ credits: 10 }) === `You need ${C.FEE} cr. You have 10 cr.`);
ok('baseFreeWhenBroke', C.blockReason({ ...good, credits: 0, place: base }) === null);
ok('plainWords', [R({ onMars: false }), R({ flying: true }), R({ wanted: 1 }), R({ smuggling: true }), R({ heist: true }), R({ race: true }), R({ mission: true }), R({ job: true }), R({ turf: true }), R({ beltway: true }), R({ credits: 0 })].every(s => typeof s === 'string' && s.length < 70 && /\.$/.test(s)));
// real taps: same pointerId, under 10 px (largest move over the gesture)
const d = { id: 7, x: 100, y: 100 };
ok('tapStill', C.isRealTap(d, { id: 7, x: 100, y: 100 }));
ok('tapSmallMove', C.isRealTap(d, { id: 7, x: 106, y: 105 }));
ok('swipe', !C.isRealTap(d, { id: 7, x: 100, y: 140 }));
ok('swipe10', !C.isRealTap(d, { id: 7, x: 110, y: 100 }));
ok('swipeBack', !C.isRealTap(d, { id: 7, x: 101, y: 100 }, 60));
ok('otherFinger', !C.isRealTap(d, { id: 8, x: 100, y: 100 }));
ok('noDown', !C.isRealTap(null, { id: 7, x: 0, y: 0 }));
ok('tapPx', C.TAP_PX === 10);
// frame stats
const fs = C.frameStats([16, 17, 16, 80, 16, 15, 'x', NaN]);
ok('frameStats', fs.n === 6 && fs.max === 80 && fs.over50 === 1 && fs.avg > 16, JSON.stringify(fs));
ok('frameStatsEmpty', C.frameStats([]).n === 0 && C.frameStats(null).max === 0);
ok('fade', C.FADE_MS >= 150 && C.FADE_MS <= 400 && C.HOLD_FRAMES >= 1);

console.log(fails ? `${fails}/${n} FAILED` : `ALL PASS (${n})`); process.exit(fails ? 1 : 0);
