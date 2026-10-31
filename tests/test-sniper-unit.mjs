// v7.5.19 unit test for mars/snipercore.js (sniper scope + contracts rules). node tests/test-sniper-unit.mjs
import * as K from '../mars/snipercore.js';
import { readFileSync } from 'fs';
let fails = 0; const ok = (name, c) => { if (!c) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// contracts
ok('three contracts', K.CONTRACTS.length >= 3 && new Set(K.CONTRACTS.map(c => c.id)).size === K.CONTRACTS.length);
ok('contract data complete', K.CONTRACTS.every(c => c.mark && c.pay > 0 && c.perch.length === 2 && c.route.length === 3 && c.walk > 0 && c.outfit));
ok('perch 60-180 m from the route', K.CONTRACTS.every(c => c.route.every(p => { const d = Math.hypot(p[0] - c.perch[0], p[1] - c.perch[1]); return d > 50 && d < 200; })));
const S = K.fresh();
ok('first open, rest locked', K.unlocked(S, 'kesh') && !K.unlocked(S, 'teague') && !K.unlocked(S, 'crane'));
S.done.kesh = 1; ok('second unlocks after the first', K.unlocked(S, 'teague') && !K.unlocked(S, 'crane'));
S.done.teague = 1; ok('third unlocks after the second', K.unlocked(S, 'crane'));
ok('list', K.list(S).length === 3 && K.list(S)[2].open === true);
ok('unknown id locked', !K.unlocked(S, 'nope') && K.byId('nope') === null);
// migrate
ok('migrate garbage', JSON.stringify(K.migrate(null)) === JSON.stringify(K.fresh()) && K.migrate({ v: 2 }).earned === 0);
const m = K.migrate({ v: 1, done: { kesh: 2, bogus: 5, teague: -1 }, earned: 900, hits: 'x' });
ok('migrate keeps valid', m.done.kesh === 2 && !('bogus' in m.done) && !('teague' in m.done) && m.earned === 900 && m.hits === 0);
// pay
const c1 = K.byId('kesh');
ok('base pay', K.payFor(c1, { dist: 60 }) === c1.pay);
ok('headshot bonus', K.payFor(c1, { dist: 60, head: true }) > c1.pay);
ok('long shot bonus', K.payFor(c1, { dist: 120 }) > c1.pay);
ok('close kill half pay', K.payFor(c1, { dist: 10, head: true }) === Math.round(c1.pay * 0.5 / 10) * 10);
ok('repeat pays less', K.payFor(c1, { dist: 60, done: 1 }) < c1.pay);
// optics
ok('4x fov narrower', K.scopeFov(55, 4) < 55 / 3.5 && K.scopeFov(55, 4) > 55 / 4.5);
ok('8x narrower than 4x', K.scopeFov(55, 8) < K.scopeFov(55, 4));
ok('look scale', near(K.lookScale(55, 55), 1) && K.lookScale(K.scopeFov(55, 8), 55) < 0.2);
// breath + sway
const b = K.newBreath(), sw = { yaw: 0, pitch: 0 };
let maxFree = 0; for (let i = 0; i < 300; i++) { K.sway(b, 1 / 60, 4, sw); maxFree = Math.max(maxFree, Math.abs(sw.yaw), Math.abs(sw.pitch)); }
const b2 = K.newBreath(); let maxHeld = 0; for (let i = 0; i < 200; i++) { K.breathStep(b2, 1 / 60, true); K.sway(b2, 1 / 60, 4, sw); maxHeld = Math.max(maxHeld, Math.abs(sw.yaw), Math.abs(sw.pitch)); }
ok('sway exists', maxFree > 0.001 && maxFree < 0.02);
ok('holding breath steadies', maxHeld < maxFree * 0.3);
const b3 = K.newBreath(); for (let i = 0; i < 60 * 5; i++) K.breathStep(b3, 1 / 60, true);
ok('breath runs out -> shaky', b3.shaky && !b3.holding && b3.breath < K.BREATH_MAX * 0.5);
for (let i = 0; i < 60 * 3; i++) K.breathStep(b3, 1 / 60, false);
ok('recovers', !b3.shaky && b3.breath > K.BREATH_MAX * 0.5);
// bolt
ok('bolt slower than rail rifle cd', K.BOLT > 1.0 && K.canShoot(0, 1) && !K.canShoot(0.2, 5) && !K.canShoot(0, 0));
// hit test
const out = { part: null, t: 0 };
const o = { x: 0, y: 1.72, z: 100 }, d = { x: 0, y: 0, z: -1 };
ok('head hit', K.hitPerson(o, d, 0, 0, 0, out).part === 'head' && near(out.t, 100 - 0.19, 1e-3));
ok('body hit', K.hitPerson({ x: 0, y: 1.1, z: 100 }, d, 0, 0, 0, out).part === 'body' && out.t > 99 && out.t < 101);
ok('miss beside', K.hitPerson({ x: 0.6, y: 1.1, z: 100 }, d, 0, 0, 0, out).part === null);
ok('miss above', K.hitPerson({ x: 0, y: 2.1, z: 100 }, d, 0, 0, 0, out).part === null);
ok('behind shooter', K.hitPerson({ x: 0, y: 1.7, z: -5 }, d, 0, 0, 0, out).part === null);
const dd = { x: 0, y: -12 / Math.hypot(12, 80), z: -80 / Math.hypot(12, 80) };
ok('downward shot from a tower', K.hitPerson({ x: 0, y: 13.72, z: 80 }, dd, 0, 0, 0, out).part === 'head');
// walking
const w = K.newWalker(), p = { x: 0, z: 0, yaw: 0, moving: 0 }, pts = [[0, 0], [10, 0], [10, 10]];
K.walkStep(w, pts, 1, 0.5, 2, p); ok('walks forward', near(p.x, 0.5) && near(p.z, 0) && p.moving === 1);
for (let i = 0; i < 20; i++) K.walkStep(w, pts, 1, 1, 2, p);
ok('ping-pongs at the end with a pause', w.dir === -1 && near(p.x, 10) && near(p.z, 10) && p.moving === 0);
for (let i = 0; i < 21; i++) K.walkStep(w, pts, 1, 1, 2, p);
ok('back along the route', w.seg === 0 && w.dir === -1 && near(p.x, 1) && near(p.z, 0));
ok('stays on the route', p.x >= 0 && p.x <= 10);
const f = { x: 10, z: 0, yaw: 0 }; K.fleeStep(f, 0, 0, 5, 1); ok('flee away', near(f.x, 15));
ok('stage texts', K.STAGES.every(s => K.stageText(c1, s).length > 10));
// wiring
const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), swSrc = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
ok('index loads sniper.js', /<script type="module" src="\.\/mars\/sniper\.js\?v=[0-9.]+"><\/script>/.test(idx));
ok('import map has both', idx.includes('"./mars/sniper.js"') && idx.includes('"./mars/snipercore.js"'));
ok('sw precaches both', swSrc.includes('`mars/sniper.js${q}`') && swSrc.includes('`mars/snipercore.js${q}`'));
const src = readFileSync(new URL('../mars/sniper.js', import.meta.url), 'utf8');
ok('no ?v= in imports', !/from\s+'[^']+\?v=/.test(src));
const tickSrc = src.slice(src.indexOf('function tickScope'), src.indexOf('// ---------- UI'));
ok('no allocations in the scope tick', !/new THREE\.|\{\s*\.\.\.|\[\s*\.\.\.|\.clone\(\)/.test(tickSrc));
ok('keys: Z owned by snipeBtn', readFileSync(new URL('../hud/keys.js', import.meta.url), 'utf8').includes("snipeBtn: 'Z'"));
console.log(fails ? `\n${fails} FAILED` : '\nsniper unit OK'); process.exit(fails ? 1 : 0);
