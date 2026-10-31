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
// expansions: caps 6 -> 12 -> 18, tanks double, order, one charge per purchase, credits OR stars, refunds, old saves
{ const SC = await import('../mars/starshopcore.js');
  const g = F.fresh(); g.owned = g.dome = true;
  ok('exp:fresh', F.caps(g).racks === 6 && F.caps(g).water === 100 && F.caps(g).power === 100 && F.caps(g).silo === 120 && g.exp.domes === 0, F.caps(g));
  ok('exp:prices', F.EXPANSIONS.dome2.cr === 2500 && F.EXPANSIONS.dome3.cr === 6000 && ['water', 'power', 'silo'].every(k => F.EXPANSIONS[k].cr === 1500) && F.STAR_RATE === 5 && F.starPrice('dome2') === 12500 && F.starPrice('dome3') === 30000 && F.starPrice('silo') === 7500);
  // star rate sits inside the Star Shop's own ⭐-per-cr range (its star prices vs Blue's supplier credits)
  const sup = { lowg: 20, glowdust: 40, redstatic: 75, voidhoney: 160 }, rates = Object.entries(SC.PRICES).map(([k, v]) => v / sup[k]);
  ok('exp:rateFromShop', F.STAR_RATE >= Math.min(...rates) && F.STAR_RATE <= Math.max(...rates), rates);
  // ordering: the third dome needs the second; a farm without its first dome can't expand
  ok('exp:order', !F.canExpand(g, 'dome3').ok && F.canExpand(g, 'dome3').locked && F.canExpand(g, 'dome2').ok);
  const nd = F.fresh(); nd.owned = true; ok('exp:needsFirstDome', !F.canExpand(nd, 'dome2').ok && !F.canExpand(F.fresh(), 'water').ok);
  for (let i = 0; i < 6; i++) g.racks.push(F.freshRack()); ok('exp:cap6', !F.canRack(g, 9e9).ok && /Expand/.test(F.canRack(g, 9e9).why), F.canRack(g, 9e9));
  // credits wallet: double call = one charge
  let cr = 20000, takes = 0; const crW = { have: () => cr, take: n => { if (cr < n) return { ok: false }; cr -= n; takes++; return { ok: true, n }; }, give: n => { cr += n; } };
  let r = F.buyExpansion(g, 'dome2', 'cr', crW); const r2 = F.buyExpansion(r.s, 'dome2', 'cr', crW);
  ok('exp:dome2', r.ok && r.s === g && g.exp.domes === 1 && F.caps(g).racks === 12 && cr === 17500 && takes === 1, r);
  ok('exp:twiceOnce', !r2.ok && r2.owned && cr === 17500 && takes === 1, r2);
  for (let i = 6; i < 12; i++) { ok('exp:rack' + i, F.canRack(g, 9e9).ok); g.racks.push(F.freshRack()); } ok('exp:cap12', !F.canRack(g, 9e9).ok);
  ok('exp:rackLots', F.rackLot(0) === 0 && F.rackLot(5) === 0 && F.rackLot(6) === 1 && F.rackLot(11) === 1 && F.rackLot(12) === 2 && F.rackLot(17) === 2);
  r = F.buyExpansion(g, 'dome3', 'cr', crW); ok('exp:dome3', r.ok && F.caps(g).racks === 18 && cr === 11500, r);
  for (let i = 12; i < 18; i++) g.racks.push(F.freshRack()); ok('exp:cap18', !F.canRack(g, 9e9).ok && F.caps(g).domes === 3);
  // short: refused, nothing taken
  const poor = { have: () => 100, take: () => { throw new Error('must not be called'); }, give: () => {} };
  r = F.buyExpansion(g, 'water', 'cr', poor); ok('exp:shortCr', !r.ok && r.short === 1400 && !g.exp.water, r);
  // tanks double their caps (refill and harvest use the new cap)
  for (const k of ['water', 'power', 'silo']) { r = F.buyExpansion(g, k, 'cr', crW); ok('exp:tank:' + k, r.ok && F.caps(g)[k] === 2 * F.LIMITS[k], F.caps(g)); }
  g.water = 0; ok('exp:refill200', F.refillCost(g, 'water').units === 200 && F.refillCost(g, 'water').cost === 400, F.refillCost(g, 'water'));
  g.silo = { potato: 200 }; g.racks[0] = { crop: 'potato', growth: 1, health: 100, planted: 0 }; const hv = F.harvest(g, 0); ok('exp:silo240', hv.ok && hv.n === 6 && F.siloCount(g) === 206, hv);
  // stars wallet over the real star core: the balance drops, lifetime XP (= rank) never does, double call = one charge, short = refused
  const xp = 40000, st = SC.fresh(); const stW = { have: () => SC.balance(st, xp), take: n => SC.spend(st, xp, n, 'farm'), give: n => SC.refund(st, n) };
  const sg = F.fresh(); sg.owned = sg.dome = true;
  r = F.buyExpansion(sg, 'dome2', 'stars', stW); const again = F.buyExpansion(sg, 'dome2', 'stars', stW);
  ok('exp:stars', r.ok && r.cur === 'stars' && r.price === 12500 && SC.balance(st, xp) === 27500 && st.spent === 12500 && xp === 40000 && sg.exp.domes === 1, { r, bal: SC.balance(st, xp) });
  ok('exp:starsOnce', !again.ok && SC.balance(st, xp) === 27500, again);
  r = F.buyExpansion(sg, 'dome3', 'stars', stW); ok('exp:starsShort', !r.ok && r.short === 2500 && SC.balance(st, xp) === 27500 && sg.exp.domes === 1, r);
  // one currency per purchase: a credit buy never touches stars
  let c2 = 5000; const c2W = { have: () => c2, take: n => { c2 -= n; return { ok: true, n }; }, give: n => { c2 += n; } };
  r = F.buyExpansion(sg, 'water', 'cr', c2W); ok('exp:oneCurrency', r.ok && c2 === 3500 && SC.balance(st, xp) === 27500);
  // refunds: a failed save or a throw puts the state back and gives the money back
  r = F.buyExpansion(sg, 'power', 'stars', stW, () => false); ok('exp:refundSave', !r.ok && r.refunded === 7500 && SC.balance(st, xp) === 27500 && !r.s.exp.power, r);
  r = F.buyExpansion(r.s, 'silo', 'cr', c2W, () => { throw new Error('boom'); }); ok('exp:refundThrow', !r.ok && r.refunded === 1500 && c2 === 3500 && !r.s.exp.silo, r);
  r = F.buyExpansion(r.s, 'silo', 'cr', { have: () => 9e9, take: n => ({ ok: true, n: n - 1 }), give: n => { c2 += n; } }); ok('exp:refundMismatch', !r.ok && r.refunded === 1499, r);
  // profit math: a rack in the dearest dome still clears about 2x its full grow cost; payback in plain words
  ok('exp:profit', Object.keys(F.CROPS).every(c => F.CROPS[c].price * F.CROPS[c].yield >= 1.8 * F.growCostAt(c, 2) && F.growCostAt(c, 0) === F.growCost(c) && F.growCostAt(c, 2) > F.growCostAt(c, 1)), Object.keys(F.CROPS).map(c => [c, F.CROPS[c].price * F.CROPS[c].yield, F.growCostAt(c, 2)]));
  ok('exp:payback', F.paybackHarvests('dome2') === 2 && F.paybackHarvests('dome3') === 3 && /about 2 potato harvests/.test(F.expandWords('dome2')) && /Holds 200 water/.test(F.expandWords('water')));
  // migration: an old v1 save without exp = no expansions, old behaviour (racks capped at 6, tanks at 100)
  const old = { v: 1, owned: true, dome: true, racks: Array.from({ length: 9 }, () => ({ crop: 'potato', growth: 0.5, health: 100 })), water: 180, power: 150, silo: { potato: 7 } };
  let m = F.migrate(old); ok('exp:migrateOld', m.exp.domes === 0 && !m.exp.water && m.racks.length === 6 && m.water === 100 && m.power === 100 && F.caps(m).racks === 6, m);
  m = F.migrate({ ...old, exp: { domes: 1, water: true } }); ok('exp:migrateExp', m.exp.domes === 1 && m.exp.water && !m.exp.power && m.racks.length === 9 && m.water === 180 && m.power === 100, m);
  m = F.migrate({ ...old, exp: { domes: 9, water: 'yes', silo: 1 } }); ok('exp:migrateJunk', m.exp.domes === 2 && !m.exp.water && !m.exp.silo, m.exp);
  const full = JSON.parse(JSON.stringify(g)); ok('exp:roundTrip', JSON.stringify(F.migrate(JSON.parse(JSON.stringify(full))).exp) === JSON.stringify(full.exp) && F.migrate(full).racks.length === 18);
  // the empty-save guard and the backup still hold with expansions
  const gj = JSON.stringify(g); let rr = F.recover('{broken', gj, null); ok('exp:fromBackup', rr.from === 'backup' && rr.s.exp.domes === 2 && rr.s.racks.length === 18, rr.from);
  ok('exp:noDowngrade', !F.mayOverwrite(F.fresh(), gj));
  const baseX = JSON.stringify({ v: 1, plots: { 'farm-homestead': { owned: true, pieces: [{ id: 1, type: 'farm-dome', i: 2, j: 0 }, { id: 2, type: 'farm-rack', i: 3, j: 7 }] },
    'farm-annex-1': { owned: true, pieces: [{ id: 1, type: 'farm-dome', i: 2, j: 0 }, { id: 2, type: 'farm-rack', i: 3, j: 7 }, { id: 3, type: 'farm-rack', i: 6, j: 7 }] } } });
  rr = F.recover(null, null, baseX); ok('exp:fromBase', rr.from === 'base' && rr.s.exp.domes === 1 && rr.s.racks.length === 3, { from: rr.from, exp: rr.s.exp, n: rr.s.racks.length });
  // 💾 Save Code: the expansions ride inside ssx.farm.v1 (no new key), so a code made on one device brings them to another
  await import('../savecode.js'); const SV = globalThis.SSXSaveCore;
  const mk = init => { const mm = new Map(Object.entries(init)); return { get length() { return mm.size; }, key: i => [...mm.keys()][i] ?? null, getItem: k => mm.has(k) ? mm.get(k) : null, setItem: (k, v) => mm.set(k, String(v)), removeItem: k => mm.delete(k), clear: () => mm.clear(), dump: () => Object.fromEntries(mm) }; };
  const A = mk({ 'ssx.farm.v1': gj, 'ssx.farm.v1.bak': gj, 'ssx.stars.v1': JSON.stringify(st) });
  const code = await SV.encode(SV.collect(A), { t: 1, app: 'v7.5.11', plain: true }); const dv = await SV.decode(code); const Bs = mk({}); SV.applyTo(Bs, dv.keys);
  const back = F.recover(Bs.dump()['ssx.farm.v1'], Bs.dump()['ssx.farm.v1.bak'], null).s;
  ok('exp:saveCode', dv.ok && SV.isGameKey('ssx.farm.v1') && back.exp.domes === 2 && back.exp.water && back.exp.power && back.exp.silo && back.racks.length === 18 && F.caps(back).racks === 18 && JSON.parse(Bs.dump()['ssx.stars.v1']).spent === 12500, { exp: back.exp, n: back.racks.length }); }
console.log(bad ? `farm unit: ${bad} FAIL` : 'farm unit OK'); process.exit(bad ? 1 : 0);
