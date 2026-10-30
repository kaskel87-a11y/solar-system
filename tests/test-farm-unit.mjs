// node tests/test-farm-unit.mjs: pure farm logic (mars/farmcore.js)
import * as F from '../mars/farmcore.js';
let bad = 0; const ok = (k, c, v) => { if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v)); } };
const s = F.fresh();
ok('buyShort', !F.canBuy(s, 100).ok); ok('buy', F.canBuy(s, 5000).ok);
s.owned = true; ok('domeFirst', !F.canRack(s, 5000).ok); s.dome = true;
for (let i = 0; i < 6; i++) { ok('rack' + i, F.canRack(s, 5000).ok); s.racks.push(F.freshRack()); }
ok('rackCap', !F.canRack(s, 5000).ok);
ok('plant', F.canPlant(s, 0, 'potato', 100).ok); F.plant(s, 0, 'potato'); F.plant(s, 1, 'lichen');
ok('plantTwice', !F.canPlant(s, 0, 'algae', 100).ok); ok('notRipe', !F.harvest(s, 0).ok);
// no water: wilts, no growth
let o = F.advance(s, 2); ok('dry', o.dry && s.racks[0].growth === 0 && s.racks[0].health === 88, s.racks[0]);
s.racks[0].health = 100; s.water = 100; s.power = 100;
o = F.advance(s, 10); ok('grows', s.racks[0].growth === 1 && o.ripe.includes(0), s.racks[0]); ok('upkeep', s.water < 100 && s.power < 100, { w: s.water, p: s.power });
ok('lichenGrowing', s.racks[1].growth > 0.45 && s.racks[1].growth < 0.55, s.racks[1].growth);
const h = F.harvest(s, 0); ok('harvest', h.ok && h.n === 6 && s.silo.potato === 6 && !s.racks[0].crop, h);
// storm
F.plant(s, 2, 'glowberry'); s.water = 100; s.power = 100; const hp0 = s.racks[2].health; o = F.advance(s, 1, 1);
ok('storm', o.stormLoss > 0 && s.racks[2].health < hp0 && s.domeHp < 100, { o, r: s.racks[2], dome: s.domeHp });
// prices shift by day
const p = [0, 1, 2, 3, 4].map(d => F.unitPrice(d, 'potato')); ok('dayShift', new Set(p).size > 1, p);
ok('buyers', F.buyersToday(3).length === 3 && F.buyersToday(3)[0].offers.length === 4);
s.silo.potato = 6; const q = F.quoteSale(s, 'vell', 'potato', 4); ok('quoteCash', q.ok && q.cash === F.unitPrice(F.day(s), 'potato') * 4, q);
F.applySale(s, q); ok('applied', s.silo.potato === 2 && s.stats.earned === q.cash);
ok('wrongBuyer', !F.quoteSale(s, 'oru', 'potato', 1).ok);
s.silo.lichen = 20; const fq = F.quoteSale(s, 'hush', 'lichen', 1); ok('favor', fq.ok && fq.favor === 'cool' && fq.qty >= 2, fq); F.applySale(s, fq); ok('favorStored', s.favors.includes('cool'));
s.silo.glowberry = 20; const iq = F.quoteSale(s, 'oru', 'glowberry', 1); ok('item', iq.ok && F.ITEMS.some(i => i.id === iq.item), iq);
// raids
s.lastRaidH = s.hours; ok('raidCooldown', !F.raidDue(s, 0)); s.lastRaidH = -99; ok('raidDue', F.raidDue(s, 0)); ok('raidRoll', !F.raidDue(s, 0.99));
const before = F.siloCount(s), st = F.steal(s); ok('steal', st.n > 0 && F.siloCount(s) === before - st.n, st);
// migrate
const m = F.migrate(JSON.parse(JSON.stringify(s))); ok('migrate', m.owned && m.racks.length === 6 && m.favors.includes('cool') && m.hours === s.hours, m);
ok('migrateJunk', F.migrate('x').owned === false && F.migrate({ v: 1, racks: [{ crop: 'nope', growth: 9 }], dome: true, owned: true }).racks[0].crop === null);
ok('dirs', F.dirWord(0, 10) === 'south' && F.dirWord(10, 0) === 'east' && /Go to X \(\d+ m south\)/.test(F.directions({ x: 0, z: 0 }, { x: 0, z: 300 }, 'X')));
// first-loop guide
{ const g = F.fresh(); const ids = []; const st = () => { const x = F.guideStep(g); ids.push(x?.id ?? null); return x; };
  st(); g.owned = true; g.water = 40; g.power = 40; st(); g.dome = true; st(); g.racks.push({ crop: null, growth: 0, health: 100, planted: 0 }); st();
  F.plant(g, 0, 'potato'); st(); F.advance(g, 4, 0); const mid = F.guideStep(g); F.advance(g, 7, 0); st(); F.harvest(g, 0); const sell = st();
  const q = F.quoteSale(g, 'vell', 'potato', g.silo.potato); F.applySale(g, q); st();
  ok('guideSteps', ids.join() === 'buy,dome,plant,plant,grow,harvest,sell,' && sell.to === 'post' && /^Wait for your potatoes to grow \(\d+%\)$/.test(mid.text) && g.guide.done, { ids, mid });
  const dry = F.fresh(); Object.assign(dry, { owned: true, dome: true, water: 0, power: 0 }); dry.racks.push({ crop: 'potato', growth: 0.2, health: 100, planted: 0 });
  ok('guideUpkeep', F.guideStep(dry).id === 'upkeep');
  ok('guideMigrate', F.migrate({ v: 1, stats: { sold: 3 } }).guide.done === true && F.migrate({ v: 1, guide: { on: true, off: true } }).guide.off === true && F.migrate(null).guide.on === false); }
// ---- idempotent taps / API calls: two taps in one frame (same clock reading) and two back-to-back API calls give 1 effect, 1 charge ----
{ let t = 1000; const G = F.makeActGuard(() => t);
  const mk = () => { const st = F.fresh(); return { st, cr: 20000, charges: 0, fx: 0 }; };
  // the same rules farm.js runs inside each guarded action: check (incl. the expected state the button was drawn with), then charge once
  const A = {
    buy: m => G.run('buy', () => { const v = F.canBuy(m.st, m.cr); if (!v.ok) return v; m.cr -= v.cost; m.charges++; m.st.owned = true; m.fx++; return { ok: true }; }),
    dome: m => G.run('dome', () => { const v = F.canDome(m.st, m.cr); if (!v.ok) return v; m.cr -= v.cost; m.charges++; m.st.dome = true; m.fx++; return { ok: true }; }),
    rack: (m, exp) => G.run('rack', () => { const v = F.canRack(m.st, m.cr); if (!v.ok) return v; const sl = F.actStale(m.st, 'rack', exp); if (sl) return { ok: false, why: sl }; m.cr -= v.cost; m.charges++; m.st.racks.push(F.freshRack()); m.fx++; return { ok: true }; }),
    sell: (m, exp) => G.run(F.actKey('sell', { b: 'vell', c: 'potato' }), () => { const sl = F.staleSale(m.st, 'potato', exp); if (sl) return { ok: false, why: sl }; const q = F.quoteSale(m.st, 'vell', 'potato', m.st.silo.potato | 0); if (!q.ok) return q; F.applySale(m.st, q); m.cr += q.cash | 0; m.charges++; m.fx++; return { ok: true }; })
  };
  const m = mk(); const once = (k, f) => { const c0 = m.charges, f0 = m.fx; const r1 = f(), r2 = f(); ok(k, r1.ok && !r2.ok && m.charges - c0 === 1 && m.fx - f0 === 1, { r1, r2 }); t += 400; };
  // two taps in the same frame (the clock doesn't move between them); a tap carries the state its button was drawn with
  once('tapBuy', () => A.buy(m)); once('tapDome', () => A.dome(m));
  const n0 = m.st.racks.length; once('tapRack', () => A.rack(m, n0));
  m.st.silo.potato = 6; const q0 = m.st.silo.potato; once('tapSell', () => A.sell(m, q0));
  // two API calls back to back (no expectation passed): the per-key debounce alone keeps it to one
  const m2 = mk(); const once2 = (k, f) => { const c0 = m2.charges, f0 = m2.fx; const r1 = f(), r2 = f(); ok(k, r1.ok && r2.dup && m2.charges - c0 === 1 && m2.fx - f0 === 1, { r1, r2 }); t += 400; };
  once2('apiBuy', () => A.buy(m2)); once2('apiDome', () => A.dome(m2)); once2('apiRack', () => A.rack(m2)); m2.st.silo.potato = 6; once2('apiSell', () => A.sell(m2, undefined));
  // the debounce is per key and short: another key goes through at once, the same key again after ACT_MS
  ok('otherKey', A.rack(m2).ok && A.rack(m2).dup && G.run('plant:0', () => ({ ok: true })).ok); t += F.ACT_MS - 50; ok('withinMs', A.rack(m2).dup); t += 60; ok('afterMs', A.rack(m2).ok && m2.st.racks.length === 3, m2.st.racks.length);
  // a stale button (drawn when there were N racks) never charges after the count moved
  const c0 = m2.charges; t += 400; ok('staleRack', !A.rack(m2, 0).ok && m2.charges === c0);
  // re-entry (an action fired from inside another, e.g. a base onPlace callback) is dropped
  ok('reentry', G.run('a', () => G.run('b', () => ({ ok: true }))).dup === true);
  ok('keys', F.actKey('plantc', { i: 2 }) === 'plant:2' && F.actKey('harvestAll') === 'harvest:all' && F.actKey('sell', { b: 'x', c: 'algae' }) === 'sell:x:algae'); }
// v7.5.6 economy: one full plant -> grow -> harvest -> sell cycle per crop, paying seed, the water and power actually used
// and the rack's amortized share of plot + dome + rack. Selling at Vell must clear >= 2.5x that cost even on the worst day,
// and ~3-4x on an average day.
{ const econ = {};
  for (const id of F.CROP_IDS) {
    const g = F.fresh(); g.owned = g.dome = true; g.water = F.LIMITS.water; g.power = F.LIMITS.power; g.racks.push({ crop: null, growth: 0, health: 100, planted: 0 });
    const c = F.CROPS[id]; let spent = F.canPlant(g, 0, id, 1e9).cost; F.plant(g, 0, id);
    for (let h = 0; h < c.hours + 1 && g.racks[0].growth < 1; h++) { F.advance(g, 1, 0); }
    spent += (F.LIMITS.water - g.water) * F.PRICES.water + (F.LIMITS.power - g.power) * F.PRICES.power;
    spent += ((F.PRICES.plot + F.PRICES.dome) / F.LIMITS.racks + F.PRICES.rack) / F.AMORT_HARVESTS;
    const hv = F.harvest(g, 0); const q = F.quoteSale(g, 'vell', id, hv.n); F.applySale(g, q);
    const days = Array.from({ length: 60 }, (_, d) => F.unitPrice(d, id) * hv.n), worst = Math.min(...days), avg = days.reduce((a, b) => a + b, 0) / days.length;
    econ[id] = { spent: Math.round(spent * 10) / 10, growCost: F.growCost(id), n: hv.n, sale: q.cash, profit: q.cash - Math.round(spent), worstX: +(worst / spent).toFixed(2), avgX: +(avg / spent).toFixed(2) };
    ok('econ:' + id, hv.n === c.yield && Math.abs(spent - F.growCost(id)) < 1 && q.cash > spent * 2.5 && worst > spent * 2.5 && avg > spent * 3 && avg < spent * 4.2, econ[id]);
  }
  if (process.env.ECON) console.log(JSON.stringify(econ, null, 1)); }
// save recovery (v7.5.7 hotfix): a v7.5.5 save loads as is; a lost / broken / unowned save comes back from the mirror or SSX.base's record
{ const v755 = '{"v":1,"owned":true,"dome":true,"domeHp":100,"racks":[{"crop":"potato","growth":0.0032,"health":100,"planted":0.11},{"crop":null,"growth":0,"health":100,"planted":0},{"crop":null,"growth":0,"health":100,"planted":0}],"water":40,"power":40,"silo":{},"favors":[],"hours":0.148,"lastRaidH":-99,"stats":{"planted":1,"harvested":0,"sold":0,"earned":0,"raids":0,"raidsWon":0,"stolen":0,"stormLoss":0,"wilted":0},"guide":{"on":true,"done":false,"off":false}}';
  const base = owned => JSON.stringify({ v: 1, plots: { 'farm-homestead': { owned, pieces: [{ id: 1, type: 'farm-dome', i: 2, j: 0, r: 0, hp: 200 }, { id: 2, type: 'farm-rack', i: 3, j: 7, r: 0 }, { id: 3, type: 'farm-rack', i: 6, j: 7, r: 0 }, { id: 4, type: 'farm-rack', i: 2, j: 7, r: 0 }], stash: { credits: 0, medkits: 0 }, nextId: 5, boughtAt: 1 } } });
  const unowned = JSON.stringify(F.fresh()), resetBase = JSON.stringify({ v: 1, plots: { 'farm-homestead': { owned: false, pieces: [], nextId: 5, boughtAt: 1 } } });
  let r = F.recover(v755, null, null); ok('rec:v755', r.from === 'save' && r.s.owned && r.s.dome && r.s.racks.length === 3 && r.s.racks[0].crop === 'potato' && !r.restored, r);
  r = F.recover(v755.replace('"v":1', '"v":1,"barter":{"x":1},"extra":[1]'), null, null); ok('rec:unknownFields', r.s.owned && r.s.racks.length === 3, r.from);
  r = F.recover(null, v755, base(false)); ok('rec:mirror', r.from === 'backup' && r.restored && r.s.racks[0].crop === 'potato', r.from);
  r = F.recover('{broken', null, base(false)); ok('rec:corruptFromBase', r.from === 'base' && r.s.owned && r.s.dome && r.s.racks.length === 3 && r.s.water >= 40, r);
  r = F.recover(unowned, null, base(false)); ok('rec:unownedFromBase', r.from === 'base' && r.s.owned && r.s.racks.length === 3, r.from);
  r = F.recover(null, null, base(true)); ok('rec:missingFromBase', r.from === 'base' && r.s.owned, r.from);
  r = F.recover(unowned, null, resetBase); ok('rec:resetStaysReset', !r.s.owned && !r.restored, r.from);
  r = F.recover(null, null, null); ok('rec:fresh', !r.s.owned && r.from === 'fresh');
  ok('noDowngrade', !F.mayOverwrite(F.fresh(), v755) && F.mayOverwrite(F.fresh(), unowned) && F.mayOverwrite(F.migrate(JSON.parse(v755)), unowned) && F.mayOverwrite(F.fresh(), null)); }
console.log(bad ? `farm unit: ${bad} FAIL` : 'farm unit OK'); process.exit(bad ? 1 : 0);
