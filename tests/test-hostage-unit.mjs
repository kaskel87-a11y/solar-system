// Unit tests for mars/hostagecore.js (hostage: snatch a rival lieutenant, haul him to Benny). Run: node tests/test-hostage-unit.mjs
import * as C from '../mars/hostagecore.js';
import { DISTRICT_DATA } from '../citydata.js';
import { readFileSync } from 'node:fs';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } };

// roster: citydata lieutenants that give story missions are off limits; every lieutenant stands on a citydata gang spot
const cl = C.citydataLieutenants();
ok('citydataMarrow', cl.some(l => l.name === 'Marrow' && l.story === true), JSON.stringify(cl));
ok('rosterNoStory', !C.ROSTER.some(l => l.name === 'Marrow') && C.ROSTER.length >= 3);
ok('rosterSpots', C.ROSTER.every(l => DISTRICT_DATA.rough.spawns.gang_spawn.some(s => s[0] === l.spot[0] && s[1] === l.spot[1])));
ok('rosterIcecapIds', ['rusty', 'jawbone', 'deacon'].every(id => C.ROSTER.some(l => l.id === id)));
const fake = { rough: { contacts: [{ name: 'Ox Teller', blurb: 'Dustjaw lieutenant. Loud.', faction: 'Dustjaw Boys' }, { name: 'Marrow', blurb: 'Saltblood lieutenant.', faction: 'Saltblood' }], spawns: { gang_spawn: [[1, 2], [3, 4]] } } };
const r2 = C.roster(fake, [{ giver: 'Marrow' }]);
ok('rosterFreeCitydataFirst', r2[0].name === 'Ox Teller' && r2[0].src === 'citydata' && r2[0].gang === 'dustjaws' && !r2.some(l => l.name === 'Marrow') && r2[1].spot[0] === 3 && r2[2].spot[0] === 1, JSON.stringify(r2));

// geometry
ok('flatsWorldLive', (() => { const p = C.flatsWorld([2, -3], { x: 100, z: 50 }); return p.x === 102 && p.z === 47; })());
ok('flatsWorldFallback', (() => { const p = C.flatsWorld([0, 0], null, { x: 10, z: 20 }); return p.x === 10 + C.FLATS_AJ[0] && p.z === 20 + C.FLATS_AJ[1]; })());
ok('dirName', C.dirName(0, 0, 0, -10) === 'N' && C.dirName(0, 0, 10, 0) === 'E' && C.dirName(0, 0, 0, 10) === 'S' && C.dirName(0, 0, -7, -7) === 'NW');
ok('fmtDist', C.fmtDist(44.4) === '44 m' && C.fmtDist(444) === '440 m' && C.fmtDist(1234) === '1.2 km');

// who's out: skip cooling-down and the one at Benny's hut
ok('pickFirst', C.pickActive({}, 0)?.id === C.ROSTER[0].id);
ok('pickSkipHut', C.pickActive({}, 0, C.ROSTER[0].id)?.id === C.ROSTER[1].id);
ok('pickSkipCooling', C.pickActive({ [C.ROSTER[0].id]: 100 }, 50)?.id === C.ROSTER[1].id);
ok('pickNone', C.pickActive(Object.fromEntries(C.ROSTER.map(l => [l.id, 99])), 10) === null);

// AI: notices you, runs slower than your sprint, gets cornered, gets punched down, gets back up
const L = C.ROSTER[0], home = { x: 0, z: 0 };
let m = C.fresh(L, home);
ok('idleFar', C.step(m, { x: 40, z: 0 }, 0.1) === null && m.state === 'idle');
ok('notice', C.step(m, { x: 10, z: 0 }, 0.1) === 'notice' && m.state === 'flee');
let x0 = m.x; C.step(m, { x: 8, z: 0 }, 0.5); ok('fleesAway', m.x < x0 && Math.abs(x0 - m.x - C.FLEE_V * 0.5) < 1e-6, m.x);
ok('slowerThanSprint', C.FLEE_V < 9);
// chase: player at sprint speed right on his heels -> cornered within a few seconds (leash pins him)
m = C.fresh(L, home); m.state = 'flee'; let p = { x: 2, z: 0 }, ev = null, t = 0;
for (; t < 30 && ev !== 'hands'; t += 1 / 30) { ev = C.step(m, p, 1 / 30); const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz); if (d > 1.5) { p.x += dx / d * Math.min(9 / 30, d - 1.5); p.z += dz / d * Math.min(9 / 30, d - 1.5); } }
ok('cornered', ev === 'hands' && m.state === 'hands', `${ev} t=${t.toFixed(1)}`);
ok('leash', Math.hypot(m.x - m.hx, m.z - m.hz) <= C.LEASH + 1e-6);
ok('grabHands', C.grabbable(m, 1.5) && !C.grabbable(m, 5));
// walls: a blocked step slides sideways, a boxed-in corner corners him faster
m = C.fresh(L, home); m.state = 'flee'; C.step(m, { x: -1, z: 0 }, 0.2, (x) => x > 0.5); ok('wallSlide', m.x <= 0.5 && Math.abs(m.z) > 0.5, `${m.x},${m.z}`);
m = C.fresh(L, home); m.state = 'flee'; ev = null; for (let i = 0; i < 60 && ev !== 'hands'; i++) ev = C.step(m, { x: -1, z: 0 }, 1 / 30, () => true); ok('boxedIn', ev === 'hands');
// hands up times out -> bolts again
m.t = 0.01; ok('bolt', C.step(m, { x: 20, z: 0 }, 0.05) === 'bolt' && m.state === 'flee');
// punches: 4 hp, third-combo 2 -> down; birdies wear off -> up with 2 hp
m = C.fresh(L, home);
ok('hit1', C.hit(m, 1) === 'hit' && m.state === 'flee' && m.hp === C.HP - 1);
C.hit(m, 1); ok('hitDown', C.hit(m, 2) === 'down' && m.state === 'down' && m.hp === 0);
ok('noHitWhileDown', C.hit(m, 1) === null);
ok('grabDown', C.grabbable(m, 2));
for (let i = 0; i < C.DOWN_S * 10 + 2; i++) ev = C.step(m, { x: 1, z: 0 }, 0.1) || ev;
ok('getsUp', ev === 'up' && m.state === 'flee' && m.hp === 2);
// car: a bumper at speed knocks him down; a creep doesn't
m = C.fresh(L, home); ok('carSlow', !C.carHit(m, 2, 1)); ok('carFast', C.carHit(m, 12, 1.5) && m.state === 'down');
// grab -> held, no more hits
ok('grab', C.grab(m) && m.state === 'held' && C.hit(m, 5) === null && !C.grab(m));

// hauling: foot leash, trunk, jetpack dangle
let c = { x: 0, z: 0, yaw: 0 };
let f = C.follow(c, { x: 5, z: 0 }, 'foot', 0.1); ok('followLeash', Math.abs(Math.hypot(f.x - 5, f.z) - C.FOLLOW) < 1e-6 && f.pose === 'hop');
f = C.follow({ x: 4, z: 0, yaw: 0 }, { x: 5, z: 0 }, 'foot', 0.1); ok('followStand', f.x === 4 && f.pose === 'stand');
f = C.follow(c, { x: 0, z: 0 }, 'car', 0.1, { x: 10, z: 10, yaw: 0, alt: 0 }); ok('trunk', f.pose === 'trunk' && f.x === 10 && Math.abs(f.z - 11.3) < 1e-9 && f.lift > 0.9);
f = C.follow(c, { x: 0, z: 0 }, 'car', 0.1, { x: 0, z: 0, yaw: 0, alt: 0.5, top: 2.4, back: 2 }); ok('trunkTallRide', Math.abs(f.lift - 2.9) < 1e-9 && Math.abs(f.z - 2) < 1e-9);
f = C.follow(c, { x: 3, z: 4, y: 20, alt: 10 }, 'jet', 0.1); ok('dangle', f.pose === 'dangle' && f.x === 3 && f.z === 4 && Math.abs(f.abs - (20 - 1.7 - 3.4)) < 1e-9);
ok('teleport', C.teleported({ x: 0, z: 0 }, { x: 0, z: 100 }) && !C.teleported({ x: 0, z: 0 }, { x: 0, z: 5 }) && !C.teleported(null, { x: 0, z: 0 }));
ok('deliver', C.canDeliver({ x: 44, z: 948 }, { x: 44, z: 960 }) && !C.canDeliver({ x: 0, z: 0 }, { x: 44, z: 948 }) && !C.canDeliver({ x: 44, z: 948 }, null));
ok('captiveShape', (() => { const r = C.captiveOf(L); return r.id === L.id && r.name === L.name && r.gangName && Number.isFinite(r.col) && Object.keys(r).length === 5; })());
ok('afterHaul', C.afterHaul({}, 'rusty', 100, 'delivered').rusty === 100 + C.BACK_S.delivered && C.afterHaul({ a: 1 }, 'rusty', 100, 'released').a === 1);
ok('taps', C.isRealTap({ id: 1, x: 0, y: 0 }, { id: 1, x: 5, y: 5 }) && !C.isRealTap({ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }) && !C.isRealTap({ id: 1, x: 0, y: 0 }, { id: 1, x: 12, y: 0 }) && !C.isRealTap({ id: 1, x: 0, y: 0 }, { id: 1, x: 1, y: 0 }, 11));

// cartoon, not gore: no blood words in the lines or the runtime's toasts
const src = readFileSync(new URL('../mars/hostage.js', import.meta.url), 'utf8'), lines = JSON.stringify(C.LINES);
ok('noGore', !/blood|gore|bleed|guts|corpse|splat/i.test(lines) && !/\bgore\(|splat\(|bleed/i.test(src));
// hooks: script tag, precache, savecode key, import map
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), sc = readFileSync(new URL('../savecode.js', import.meta.url), 'utf8');
ok('hooks', /<script type="module" src="\.\/mars\/hostage\.js\?v=[\d.]+"><\/script>/.test(html) && /"\.\/mars\/hostagecore\.js": "\.\/mars\/hostagecore\.js\?v=/.test(html) && sw.includes('mars/hostage.js${q}') && sc.includes("'ssx.hostage.v1'"));
// one context button bound with a real tap; black + white
ok('realTapUi', /realTap\(actBtn/.test(src) && /#hostageAct\{[^}]*background:#000;color:#fff/.test(src) && /id = 'hostageAct'/.test(src));
ok('reattach', /function attach\(\)[^\n]*SSX\.hostage !== api/.test(src));

console.log(fails ? `${fails}/${n} FAILED` : `hostage unit: ${n} checks PASS`); process.exit(fails ? 1 : 0);
