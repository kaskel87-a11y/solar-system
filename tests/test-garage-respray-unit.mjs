// SSX.garage.respray core (garagecore.respray / makePlate), pure logic: node tests/test-garage-respray-unit.mjs
import * as GC from '../garagecore.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const fresh = () => { const g = GC.migrateGarage(null); g.rides.push(GC.newRide('r1', 'red_comet')); g.active = 'r1'; return g; };

// plates
const PL = /^[A-HJ-NP-Z]{3}·\d[A-HJ-NP-Z]\d$/;
ok('makePlate format', Array.from({ length: 200 }, () => GC.makePlate()).every(p => PL.test(p)));
ok('makePlate deterministic with rand', GC.makePlate(seq(0)) === 'AAA·0A0' && GC.makePlate(seq(0.999)) === 'ZZZ·9Z9');
ok('makePlate avoids a given plate', GC.makePlate(seq(0, 0, 0, 0, 0, 0, 0, 0.5), ['AAA·0A0']) !== 'AAA·0A0');
ok('makePlate never returns an avoided one even with a stuck rand', !['AAA·0A0'].includes(GC.makePlate(seq(0), ['AAA·0A0'])));

// respray
{ const g = fresh(), r = GC.respray(g, 'current', { price: 250, reason: 'pursuit', credits: 1000, now: 5 });
  const ride = g.rides.find(x => x.id === 'r1');
  ok('ok + plate', r.ok && PL.test(r.plate) && r.price === 250 && r.ride === 'r1' && r.old === null, JSON.stringify(r));
  ok('plate stored on the active ride', ride.plate === r.plate && ride.resprays === 1 && ride.plateReason === 'pursuit');
  ok('other rides untouched', !g.rides.find(x => x.id === 'stock').plate);
  ok('spent (trade-in) untouched', ride.spent === 0);
  const r2 = GC.respray(g, 'current', { price: 0, credits: 0, now: 9 });
  ok('second respray: new plate, old one in history', r2.ok && r2.plate !== r.plate && r2.old === r.plate && ride.plates.length === 1 && ride.plates[0].plate === r.plate && ride.plates[0].until === 9 && ride.resprays === 2);
  for (let i = 0; i < 8; i++) GC.respray(g, 'current', { price: 0 });
  ok('plate history capped at 5, no repeats', ride.plates.length === 5 && new Set([...ride.plates.map(p => p.plate), ride.plate]).size === 6);
  const m = GC.migrateGarage(JSON.parse(JSON.stringify(g)));
  ok('plate survives save migration', m.rides.find(x => x.id === 'r1').plate === ride.plate && m.rides.find(x => x.id === 'r1').plates.length === 5);
}
{ const g = fresh(), r = GC.respray(g, 'current', { price: 400, credits: 399 });
  ok('refused when short', !r.ok && r.reason === 'funds' && r.need === 1 && r.price === 400);
  ok('refusal changes nothing', !g.rides.find(x => x.id === 'r1').plate && !g.rides.find(x => x.id === 'r1').resprays);
}
{ const g = fresh();
  ok('default price', GC.respray(g, 'current', { credits: GC.RESPRAY_PRICE - 1 }).reason === 'funds' && GC.respray(g, 'current', { credits: GC.RESPRAY_PRICE }).price === GC.RESPRAY_PRICE);
  ok('bad price refused', ['x', -5, NaN, Infinity].every(p => GC.respray(g, 'current', { price: p, credits: 1e9 }).reason === 'bad-price'));
  ok('price rounded', GC.respray(g, 'current', { price: 99.6, credits: 1e9 }).price === 100);
  ok('explicit ride id', GC.respray(g, 'stock', { price: 0 }).ride === 'stock' && !!g.rides.find(x => x.id === 'stock').plate);
  ok('unknown ride', GC.respray(g, 'nope', { price: 0 }).reason === 'no-ride' && GC.respray(null, 'current').reason === 'no-ride');
  ok('reason trimmed to 80', (GC.respray(g, 'current', { price: 0, reason: 'x'.repeat(200) }), g.rides.find(x => x.id === 'r1').plateReason.length === 80));
}
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
