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
console.log(bad ? `farm unit: ${bad} FAIL` : 'farm unit OK'); process.exit(bad ? 1 : 0);
