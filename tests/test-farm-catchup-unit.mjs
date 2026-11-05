// node tests/test-farm-catchup-unit.mjs: v7.5.15 offline farm catch-up (mars/farmcore.js catchUp / offlineHours / awayText)
import * as F from '../mars/farmcore.js';
let bad = 0; const ok = (k, c, v) => { if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v)); } };
const farm = () => { const s = F.fresh(); s.owned = true; s.dome = true; for (let i = 0; i < 3; i++) s.racks.push(F.freshRack()); s.water = 100; s.power = 100; return s; };
// minutes -> game hours, capped at 48, nothing under a minute
ok('none', F.offlineHours(0, Date.now()) === 0); ok('short', F.offlineHours(1000, 1000 + 30000) === 0);
ok('min', Math.abs(F.offlineHours(1000, 1000 + 10 * 60000) - 10) < 1e-9); ok('cap', F.offlineHours(1, 1 + 1000 * 3600000) === 48);
ok('clockBack', F.offlineHours(5000, 1000) === 0);
// grows like advance(), uses water/power, ripens
let s = farm(); F.plant(s, 0, 'algae'); F.plant(s, 1, 'potato'); const h0 = s.hours;
let o = F.catchUp(s, 6); ok('ripe', s.racks[0].growth === 1 && o.ripe.includes(0) && o.ripe.length === 1, o);
ok('potatoHalf', Math.abs(s.racks[1].growth - 0.6) < 1e-6, s.racks[1].growth); ok('used', s.water < 100 && s.power < 100, [s.water, s.power]);
ok('clock', Math.abs(s.hours - h0 - 6) < 1e-9); ok('text', F.awayText(o) === '\ud83c\udf31 While you were away: 1 rack ripened.', F.awayText(o));
// same result as the live advance() when supplied and calm
const a = farm(), b = farm(); F.plant(a, 0, 'glowberry'); F.plant(b, 0, 'glowberry'); F.advance(a, 5, 0); F.catchUp(b, 5);
ok('matchLive', a.racks[0].growth === b.racks[0].growth && a.water === b.water && a.power === b.power, [a.racks[0], b.racks[0]]);
// out of supply: stops growing, never wilts, no storm, dome untouched
s = farm(); F.plant(s, 0, 'lichen'); s.water = 1.6; s.power = 100; o = F.catchUp(s, 10);
ok('stops', s.racks[0].growth > 0 && s.racks[0].growth < 0.15 && s.racks[0].health === 100 && o.starved === 1, { r: s.racks[0], o });
ok('noWilt', s.stats.wilted === 0 && s.domeHp === 100 && s.stats.stormLoss === 0);
// cap 48 even if asked for more; ripe crops wait; unowned farm only moves its clock
s = farm(); F.plant(s, 0, 'lichen'); s.water = 999; s.power = 999; o = F.catchUp(s, 500); ok('cap48', o.hours === 48 && s.racks[0].growth === 1, o);
const u = F.fresh(); o = F.catchUp(u, 5); ok('unowned', u.hours === 5 && !o.grown);
ok('quiet', F.awayText(F.catchUp(farm(), 3)) === '', 'nothing planted -> no toast');
// wallAt survives the save round trip (Save Code copies the raw ssx.farm.v1 string)
s = farm(); s.wallAt = 1730000000000; const back = F.migrate(JSON.parse(JSON.stringify(s))); ok('wallAt', back.wallAt === 1730000000000, back.wallAt);
ok('wallAtBad', F.migrate({ v: 1, wallAt: 'x' }).wallAt === 0);
const r = F.recover(JSON.stringify(s), null, null); ok('recover', r.s.wallAt === s.wallAt);
console.log(bad ? `${bad} FAILED` : 'farm catch-up unit: all ok'); process.exit(bad ? 1 : 0);
