// Mars city ambience unit tests (pure logic, no browser): node tests/test-ambience-unit.mjs
import * as A from '../ambience.js';
import * as B from '../barks.js';
import * as R from '../radio.js';
import { createVoicePool } from '../synth.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

// ---------- district crossfade weights ----------
const Z = A.AMBIENCE_CONFIG.zones, BW = A.AMBIENCE_CONFIG.beltway;
const at = (x, z, zones = Z) => A.mixWeights(x, z, zones, BW);
ok('olympus centre is downtown', at(0, -430).w.downtown === 1 && at(0, -430).district.id === 'olympus-row');
ok('flats centre', at(-280, -40).w.flats === 1 && at(-280, -40).top === 'flats');
ok('heights centre', at(320, 80).w.heights === 1);
ok('AJ centre is junction', at(0, 0).w.junction === 1 && at(0, 0).w.highway === 0);
for (const [x, z] of [[0, 0], [0, -430], [-150, -20], [160, -300], [900, 900], [60, -430], [-240, -20]]) {
  const w = at(x, z).w, s = Object.values(w).reduce((a, b) => a + b, 0); ok(`sum<=1 at ${x},${z}`, s <= 1 + 1e-9 && Object.values(w).every(v => v >= 0 && v <= 1), s);
}
ok('desert far away is silent', Object.values(at(1500, 1500).w).every(v => v === 0));
// monotonic fade walking out of Olympus Row (due north towards AJ, off the beltway's x=0 line)
let prev = 2, mono = true; for (let d = 0; d <= 140; d += 5) { const v = at(40, -430 + d).w.downtown; if (v > prev + 1e-9) mono = false; prev = v; }
ok('downtown fades monotonically', mono);
const zr = Z.find(z => z.id === 'olympus-row'); ok('downtown silent past outer radius', at(0, -430 + zr.r * 1.31 + 1).w.downtown === 0 || at(0, -430 + zr.r * 1.31 + 1).w.downtown < 1e-9);
ok('crossfade midpoint between districts', (() => { const w = at(0, -430 + zr.r * 0.9).w; return w.downtown > 0 && w.downtown < 1; })());
// beltway: on the polyline between districts is highway; well off it is not
const mid = [(0 + 180) / 2 + 30, (-430 + -200) / 2]; // between [60,-430] and [180,-200]
const hwOn = at(120, -315).w.highway, hwOff = at(120 + 120, -315).w.highway;
ok('highway on the beltway', hwOn > 0.9, hwOn); ok('highway fades off the road', hwOff === 0, hwOff);
ok('highway ducks inside a district', at(0, -430).w.highway === 0);
ok('distToSegment', near(A.distToSegment(0, 5, -10, 0, 10, 0), 5) && near(A.distToSegment(20, 0, -10, 0, 10, 0), 10));
ok('distToPolyline', near(A.distToPolyline(0, -100, [[0, 0], [0, -200]]), 0));
// registered districts override by id / name; unknown ones get their own zone; bad ones are ignored
const zs = A.zonesFrom([{ id: 'olympus-row', name: 'Olympus Row', centre: [10, -500], radius: 120 }, { id: 'rt', name: 'Red Tape Flats', centre: [-300, -60] },
  { id: 'spaceport', name: 'Spaceport', centre: [500, 0], r: 60 }, { id: 'broken' }, { id: 'nan', centre: [NaN, 0] }]);
ok('registered overrides centre+radius', (() => { const z = zs.find(q => q.id === 'olympus-row'); return z.centre[0] === 10 && z.centre[1] === -500 && z.r === 120 && z.registered; })());
ok('registered matched by name', zs.find(q => q.id === 'red-tape-flats').centre[0] === -300);
ok('unknown registered district added', zs.some(q => q.id === 'spaceport' && q.r === 60 && q.profile === 'junction'));
ok('invalid registrations ignored', zs.length === Z.length + 1);
ok('config untouched by zonesFrom', Z.find(z => z.id === 'olympus-row').centre[1] === -430);
ok('fallback when nothing registered', A.zonesFrom([]).length === Z.length && A.zonesFrom(undefined).length === Z.length);
ok('moved district follows registration', A.mixWeights(10, -500, zs, BW).w.downtown === 1 && at(10, -500).w.downtown < 1);
ok('every profile has events', A.PROFILES.every(p => A.EVENT_TABLE[p]?.length));

// ---------- bark selection ----------
ok('lines <= 65 chars', Object.entries(B.BARKS).every(([k, l]) => l.every(x => x.length <= 65)), Object.values(B.BARKS).flat().filter(x => x.length > 65).join(' | '));
ok('every category has a rule', Object.keys(B.BARKS).every(k => B.CATS[B.catKey(k)]));
const C = (o) => B.chooseCategory({ since: {}, wanted: 0, driving: false, speed: 0, kind: 'colonist', dist: 4, ...o }, () => 0.9);
ok('idle near -> street', C({}) === 'street');
ok('idle near in district -> district line', B.chooseCategory({ since: {}, kind: 'colonist', dist: 4, district: 'flats' }, () => 0.1) === 'flats');
ok('too far -> nothing', C({ dist: 12 }) === null);
ok('gunfire beats all', C({ since: { gun: 0.5, bump: 0.2 }, wanted: 2, dist: 10 }) === 'gun');
ok('hit beats gun up close', C({ since: { gun: 0.5, hit: 0.3 }, dist: 2 }) === 'hit');
ok('stale gunfire ignored', C({ since: { gun: 9 } }) === 'street');
ok('stolen car', C({ since: { stolen: 1 }, dist: 15, driving: true, speed: 5 }) === 'stolen');
ok('wanted', C({ wanted: 1, dist: 10 }) === 'wanted');
ok('bump', C({ since: { bump: 0 }, dist: 1 }) === 'bump');
ok('speeding car', C({ driving: true, speed: 22, dist: 8 }) === 'speeding');
ok('flashy ride', C({ driving: true, speed: 6, flash: 0.8, dist: 10 }) === 'flashy');
ok('plain slow car -> quiet', C({ driving: true, speed: 6, flash: 0, dist: 10 }) === null);
ok('guard scales with stars', [1, 2, 3, 4, 5].every(s => C({ kind: 'guard', wanted: s }) === 'security' + s) && C({ kind: 'guard', wanted: 9 }) === 'security5');
ok('guard searching', C({ kind: 'guard', wanted: 2, evading: true }) === 'search');
ok('guard quiet when calm', C({ kind: 'guard' }) === null);
const recent = []; const picks = Array.from({ length: 6 }, () => B.pickLine('bump', recent, Math.random));
ok('no repeats within the recent window', new Set(picks.slice(0, 5)).size === 5, picks.join(' / '));
ok('pickLine falls back when all recent', B.pickLine('lost', ['Suspect lost. Back to patrol.', 'Forget it. Paperwork\u2019s worse.'], () => 0) !== null);
ok('unknown category -> null', B.pickLine('nope', []) === null);

// ---------- rate limiting ----------
const L = B.createLimiter({ ...B.BARK_CFG, maxVisible: 2 });
ok('first bark allowed', L.can(0, 'a', 'street')); L.mark(0, 'a', 'street', 3);
ok('global gap blocks', !L.can(1, 'b', 'flashy'));
ok('urgent uses the short gap', L.can(1.3, 'b', 'gun'));
ok('category gap blocks a 2nd street line', !L.can(4, 'b', 'street') && L.can(9.1, 'b', 'street'));
ok('per-NPC gap', !L.can(5, 'a', 'bump') && L.can(5, 'c', 'bump'));
L.mark(5, 'c', 'bump', 10); L.mark(9.5, 'd', 'gun', 10);
ok('visible cap', L.visible(10) === 2 && !L.can(14, 'e', 'hit'));
ok('cap frees when captions expire', L.can(20, 'e', 'hit'));
ok('security* share one gap', (() => { const l = B.createLimiter(); l.mark(0, 'g1', 'security1', 1); return !l.can(4, 'g2', 'security3') && l.can(5.1, 'g2', 'security3'); })());
ok('caption life grows with length', B.lifeFor('Hi') < B.lifeFor('x'.repeat(60)));

// ---------- caption placement ----------
const W = 393, H = 852;
ok('behind camera hidden', B.placeCaption(0, 0, 1.2, W, H) === null);
ok('far off screen hidden', B.placeCaption(3, 0, 0.5, W, H) === null);
const c0 = B.placeCaption(0, 0, 0.5, W, H); ok('centre is avoided', c0 && c0.y <= H / 2 - H * 0.09 + 0.5, JSON.stringify(c0));
const cTop = B.placeCaption(0.5, 0.99, 0.5, W, H); ok('kept below the top bar', cTop.y >= Math.round(H * 0.13));
const cBot = B.placeCaption(-0.5, -0.95, 0.5, W, H); ok('kept above the controls', cBot.y <= Math.round(H * 0.6));
const cEdge = B.placeCaption(-0.999, 0.3, 0.5, W, H); ok('clamped off the edge', cEdge.x >= Math.round(W * 0.16));
const s1 = B.placeCaption(0.4, 0.3, 0.5, W, H), s2 = B.placeCaption(0.42, 0.3, 0.5, W, H, [s1]); ok('stacked captions do not overlap', Math.abs(s2.y - s1.y) >= 26);

// ---------- radio: station state + persistence ----------
const stock = [{ id: 'kred', name: 'KRED', dj: ['a'] }, { id: 'void', name: 'VOID', dj: [] }, { id: 'ceres', name: 'CERES', dj: [] }, { id: 'off', name: 'Radio off', dj: [] }];
const list = stock.map(s => ({ ...s })); const added = R.appendStations(list, R.MARS_STATIONS);
ok('stations appended after Radio off', list[3].id === 'off' && added[0] === 4 && list.length === 4 + R.MARS_STATIONS.length);
ok('3-5 new stations', R.MARS_STATIONS.length >= 3 && R.MARS_STATIONS.length <= 5);
ok('append is idempotent', R.appendStations(list, R.MARS_STATIONS)[0] === 4 && list.length === 4 + R.MARS_STATIONS.length);
ok('every station procedural with dj lines', R.MARS_STATIONS.every(s => typeof s.step === 'function' && s.dj.length >= 2 && s.bpm >= 40));
ok('talk station has segments', R.MARS_STATIONS.some(s => s.talk && s.segs.length >= 12));
ok('registerStation validates', (() => { try { R.normStation({}); return false; } catch (e) { return true; } })() && R.normStation({ id: 'x', name: 'X', bpm: 999 }).bpm === 200);
ok('legacy save index kept', R.resolveStation(list, { radio: 3 }) === 3 && R.resolveStation(list, { radio: 1 }) === 1);
ok('saved id wins over index', R.resolveStation(list, { radio: 0, radioId: 'helios' }) === list.findIndex(s => s.id === 'helios'));
ok('stale id falls back to index', R.resolveStation(list, { radio: 2, radioId: 'gone' }) === 2);
ok('bad index falls back to 0', R.resolveStation(list, { radio: 99 }) === 0 && R.resolveStation(list, {}) === 0 && R.resolveStation(list) === 0);
const set = { radio: 0 }; ok('rememberStation writes both', R.rememberStation(set, list, 5) && set.radio === 5 && set.radioId === list[5].id);
ok('rememberStation reports no-op', !R.rememberStation(set, list, 5));
ok('round trip through JSON save', R.resolveStation(list, JSON.parse(JSON.stringify(set))) === 5);
const reordered = [...list.slice(0, 4), list[6], list[4], list[5], list[7]]; ok('id survives reordering', reordered[R.resolveStation(reordered, set)].id === set.radioId);
// stock DJ lines survive planets/index.js resetting s.dj
const k = { id: 'kred', dj: ['base'] }; R.addDjLines(k, ['extra1', 'extra2']); ok('addDjLines appends', k.dj.join() === 'base,extra1,extra2');
k.dj = ['venus', 'base']; ok('dj reset keeps extras', k.dj.join() === 'venus,base,extra1,extra2'); R.addDjLines(k, ['extra3']); ok('addDjLines again', k.dj.length === 5);
ok('dj still enumerable/JSON-safe', JSON.parse(JSON.stringify(k)).dj.length === 5);
ok('stock dj lines <= 65 chars', Object.values(R.STOCK_DJ).flat().every(l => l.length <= 65) && R.MARS_STATIONS.flatMap(s => s.dj).every(l => l.length <= 65));
const deck = {}, segs = ['a', 'b', 'c', 'd']; const run = Array.from({ length: 8 }, () => R.nextSegment(deck, segs));
ok('talk deck covers every segment', new Set(run.slice(0, 4)).size === 4 && new Set(run.slice(4)).size === 4);
ok('talk deck never repeats back-to-back', run.every((x, i) => i === 0 || x !== run[i - 1]), run.join(''));

// ---------- voice pool ----------
let clock = 0; const vp = createVoicePool(2, () => clock);
ok('voice pool caps', vp.try(1) && vp.try(1) && !vp.try(1)); clock = 1.5; ok('voice pool frees', vp.active() === 0 && vp.try(1));

console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
