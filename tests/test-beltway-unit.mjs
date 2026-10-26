// node tests/test-beltway-unit.mjs: pure checks for beltwaycore.js (tiers, IDM following, lane changes, pileups, carjack struggle,
// convoy ram/loot, tolls, context button) plus the wiring rules (one hook line per core file, import map, precache, no onclick).
import * as B from '../beltwaycore.js';
import { readFileSync } from 'fs';
let pass = 0, fail = 0; const t = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
// tiers -> density
t('tiers', ['low', 'med', 'high'].every(k => B.TIERS[k]));
t('phones default to med', B.pickTier({ mobile: true }) === 'med'); t('desktop defaults high', B.pickTier({ mobile: false }) === 'high');
t('override wins', B.pickTier({ override: 'low', app: 'high', mobile: false }) === 'low'); t('app tier next', B.pickTier({ app: 'medium', stored: 'low' }) === 'med');
t('stored tier', B.pickTier({ stored: 'low', mobile: true }) === 'low'); t('junk ignored', B.pickTier({ override: 'ultra', mobile: true }) === 'med');
t('density rises with tier (phone)', B.density('low', true) < B.density('med', true) && B.density('med', true) < B.density('high', true));
t('density rises with tier (desktop)', B.density('low', false) < B.density('med', false) && B.density('med', false) < B.density('high', false));
t('phone med <= 16', B.density('med', true) <= 16); t('scale thins', B.density('med', true, 0.5) === 8); t('floor 4', B.density('low', true, 0) >= 4);
t('slow fps thins', B.adaptScale(1, 30, 1) < 1); t('floor 0.4', B.adaptScale(0.41, 10, 10) === 0.4); t('fast fps recovers', B.adaptScale(0.6, 60, 1) > 0.6);
t('steady holds', B.adaptScale(0.7, 52, 1) === 0.7); t('bad fps ignored', B.adaptScale(0.7, NaN, 1) === 0.7);
t('sparks/debris pools per tier', B.TIERS.low.sparks < B.TIERS.high.sparks && B.TIERS.low.debris < B.TIERS.high.debris);
// lanes: centre (ramps, booths) stays clear, both lanes on the 10 m road
t('lanes off centre', B.LANES.every(l => l > 1.6 && l < 5)); t('two lanes', B.LANES.length === 2);
t('kinds', ['sedan', 'van', 'hauler', 'armored', 'escort'].every(k => B.KINDS[k]?.len > 0)); t('pickKind', ['sedan', 'van', 'hauler'].includes(B.pickKind(0.5)));
// road maths
t('gap ahead', B.gapAlong(10, 30, 1, 1000, true) === 20); t('gap reversed dir', B.gapAlong(30, 10, -1, 1000, true) === 20);
t('gap wraps', B.gapAlong(990, 10, 1, 1000, true) === 20); t('wrapS', B.wrapS(-10, 1000, true) === 990 && B.wrapS(1010, 1000, true) === 10);
// IDM following
t('free road accelerates', B.idmAccel(10, 18, 1e9, 0) > 0); t('at v0 ~0', Math.abs(B.idmAccel(18, 18, 1e9, 0)) < 0.01);
t('close leader brakes', B.idmAccel(18, 18, 8, 0) < -3); t('brake capped', B.idmAccel(30, 18, 1, 0) >= -B.IDM.bmax);
t('equilibrium gap ~ s0 + vT', Math.abs(B.idmAccel(15, 30, B.IDM.s0 + 15 * B.IDM.T, 15)) < 1);
t('stopDist grows', B.stopDist(20) > B.stopDist(10) && B.stopDist(0) === 0);
// lane changes
const lc = { v: 14, v0: 18, gapAhead: 12, leadV: 6, otherAhead: 80, otherAheadV: 16, otherBehind: 40, otherBehindV: 14, cooldown: 0 };
t('overtake slow leader', B.laneChange(lc)); t('cooldown blocks', !B.laneChange({ ...lc, cooldown: 1 }));
t('no reason, no change', !B.laneChange({ ...lc, gapAhead: 200, leadV: 18 })); t('no room behind', !B.laneChange({ ...lc, otherBehind: 4 }));
t('no room ahead', !B.laneChange({ ...lc, otherAhead: 10 })); t('escape a wreck', B.laneChange({ ...lc, gapAhead: 6, leadV: 0, v: 2 }));
// crashes / pileups
t('bump', B.contact(3) === 'bump'); t('wreck', B.contact(6) === 'wreck'); t('hard', B.contact(14) === 'wreck-hard');
const W = [{ t: 1, x: 0, z: 0 }, { t: 2, x: 10, z: 0 }, { t: 3, x: 20, z: 5 }];
t('pileup', B.isPileup(W, 4, 5, 0)); t('too old', !B.isPileup(W, 9, 5, 0)); t('too spread', !B.isPileup(W.map((w, i) => ({ ...w, x: i * 80 })), 4, 0, 0)); t('two is a crash', !B.isPileup(W.slice(0, 2), 3, 0, 0));
// carjack struggle
let s = { p: 0, idle: 0 }; for (let i = 0; i < 10; i++) s = B.struggleStep(s, 0.11, true); t('holding wins in ~1 s', s.done && !s.lost);
s = { p: 0.5, idle: 0 }; s = B.struggleStep(s, 0.5, false); t('release drains', s.p < 0.5 && !s.done);
s = { p: 0.2, idle: 0 }; for (let i = 0; i < 40; i++) s = B.struggleStep(s, 0.1, false); t('give up -> lost', s.lost);
t('outcomes', B.jackOutcome(0.1) === 'fight' && B.jackOutcome(0.9) === 'flee'); t('haulers fight more', B.jackOutcome(0.45, { kind: 'hauler' }) === 'fight' && B.jackOutcome(0.45) === 'flee');
t('wanted makes drivers braver', B.jackOutcome(0.4, { wanted: 3 }) === 'fight'); t('only slow cars', B.JACK.maxSpeed <= 8);
// convoy
t('soft taps do nothing', B.ramDamage(3) === 0); t('ram hurts', B.ramDamage(20) > 40); t('a few rams disable', Math.ceil(B.CONVOY.hp / B.ramDamage(16)) <= 4);
t('loot range', B.convoyLoot(0) === 380 && B.convoyLoot(1) === 720); t('crack window', B.CONVOY.crackTime >= 15 && B.CONVOY.crackTime <= 40);
// tolls
t('toll price', B.TOLL.price === 10); t('shakedown range', B.shakedownCash(0) === 80 && B.shakedownCash(1) === 160); t('shakedown costs heat', B.TOLL.heat >= 2);
const spots = B.boothSpots(1000, true, [{ x: 100, z: 0, r: 60 }], 3, s => ({ x: s, z: 0 }));
t('3 booths', spots.length === 3); t('booths avoid districts', spots.every(p => Math.abs(p.x - 100) >= 60)); t('booths spread', spots.every((a, i) => spots.every((b, j) => i === j || Math.abs(B.gapAlong(a.s, b.s, 1, 1000, true)) >= 1000 / 6)));
// context button
t('nothing', B.contextFor({}) === null); t('carjack on foot', B.contextFor({ jackable: true }) === 'carjack'); t('no carjack while driving', B.contextFor({ driving: true, jackable: true }) === null);
t('crack beats carjack', B.contextFor({ jackable: true, convoyCrack: true }) === 'crack'); t('toll when slow', B.contextFor({ driving: true, speed: 1, booth: {} }) === 'toll');
t('no toll at speed', B.contextFor({ driving: true, speed: 20, booth: {} }) === null); t('busy hides all', B.contextFor({ busy: true, jackable: true, booth: {} }) === null);
// wiring
const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const idx = rd('index.html'), sw = rd('sw.js'), world = rd('world.js'), game = rd('game.js'), surf = rd('surface.js'), src = rd('beltway.js');
t('index.html: one import line', (idx.match(/import '\.\/beltway\.js'/g) || []).length === 1);
t('import map entries', /"\.\/beltway\.js": "\.\/beltway\.js\?v=/.test(idx) && /"\.\/beltwaycore\.js": "\.\/beltwaycore\.js\?v=/.test(idx));
t('sw.js: one precache line', sw.split('\n').filter(l => /beltway/.test(l)).length === 1 && /'beltway', 'beltwaycore'/.test(sw));
t('world.js: one hook line', world.split('\n').filter(l => /beltway\.js/.test(l)).length === 1 && /spawnVehicle\(kind, x, z, yaw/.test(world));
t('game.js / surface.js untouched', !/beltway\.js/.test(game) && !/beltway\.js/.test(surf));
t('no onclick', !/\.onclick\s*=|addEventListener\('click'/.test(src)); t('pointerup checks pointerId', /e\.pointerId !== pid/.test(src));
t('desktop key I', /KeyI/.test(src)); t('budget respected', /npcBudget/.test(src) && /npcReserve/.test(src));
t('pursuit with crime fallback', /pursuit/.test(src) && /crime\?\.\(/.test(src) && /setWanted\?\.\(/.test(src));
t('readme documents SSX.beltway', /SSX\.beltway/.test(rd('README.md')));
t('no real brands', !/\b(Brink'?s|Loomis|Garda|Toyota|Ford|Honda|Chevy|Chevrolet|E-?ZPass)\b/i.test(src + rd('beltwaycore.js')));
console.log(`beltway unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
