// Garage core unit tests (pure logic, no browser): node tests/test-garage-unit.mjs
// pricing, upgrade stat math, rep scoring, colony clock, save migration (old saves), dealer stock (registerVehicle price hook)
import * as GC from '../garagecore.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// ---------- models + pricing ----------
const M = GC.MODELS, kinds = Object.keys(M);
ok('5+ models', kinds.length >= 5);
ok('price tiers ascend', kinds.map(k => M[k].price).every((p, i, a) => i === 0 || p >= a[i - 1]));
ok('distinct handling', new Set(kinds.map(k => M[k].turn)).size === kinds.length && new Set(kinds.map(k => M[k].vmax)).size >= 4);
ok('all tiers 1-4 present', [1, 2, 3, 4].every(t => kinds.some(k => M[k].tier === t)));
ok('upgrade price lvl1 tier1', GC.upgradePrice('engine', 1, 1) === GC.UPGRADES.engine.base);
ok('upgrade price scales with level', GC.upgradePrice('engine', 3, 1) === 3 * GC.UPGRADES.engine.base);
ok('upgrade price scales with tier', GC.upgradePrice('boost', 1, 4) > GC.upgradePrice('boost', 1, 1));
ok('upgrade price beyond max = null', GC.upgradePrice('engine', 4, 1) === null && GC.upgradePrice('engine', 0, 1) === null && GC.upgradePrice('nope', 1, 1) === null);
ok('cosmetic: paint flat across tiers', GC.cosmeticPrice('paint', 'candy', 1) === GC.cosmeticPrice('paint', 'candy', 4));
ok('cosmetic: kit scales with tier', GC.cosmeticPrice('kit', 'widebody', 3) > GC.cosmeticPrice('kit', 'widebody', 1));
ok('cosmetic stock free', GC.cosmeticPrice('wheels', 'stock', 2) === 0 && GC.cosmeticPrice('glow', 'none', 4) === 0);
ok('cosmetic unknown null', GC.cosmeticPrice('paint', 'plaid', 1) === null);
ok('rep discount', GC.sellPrice({ price: 1000 }, 0) === 1000 && GC.sellPrice({ price: 1000 }, 60) === 950 && GC.sellPrice({ price: 1000 }, 150) === 900);
ok('trade-in 55% + 40% spent', GC.tradeIn({ spent: 1000 }, { price: 2000 }) === 1500);
ok('trade-in < price paid', kinds.every(k => GC.tradeIn({ spent: 0 }, M[k]) < M[k].price));
// ---------- upgrade stat math ----------
const base = M.red_comet, s0 = GC.applyUpgrades(base, {}), sE = GC.applyUpgrades(base, { engine: 2 });
ok('stock spec = base numbers', s0.vmax === base.vmax && s0.boost === base.boost && s0.turn === base.turn && s0.brake === 1);
ok('applyUpgrades does not mutate', base.vmax === 25 && !('brake' in base));
ok('engine +8% vmax/lvl', near(sE.vmax, base.vmax * 1.16, 0.01) && near(sE.acc, base.acc * 1.24, 0.01));
ok('boost +10% boost +15% bacc', near(GC.applyUpgrades(base, { boost: 1 }).boost, base.boost * 1.1, 0.01) && near(GC.applyUpgrades(base, { boost: 1 }).bacc, base.bacc * 1.15, 0.01));
ok('handling +8% turn', near(GC.applyUpgrades(base, { handling: 3 }).turn, base.turn * 1.24, 0.01));
ok('kit adds turn', GC.applyUpgrades(base, {}, 'widebody').turn > s0.turn && GC.applyUpgrades(base, {}, 'rally').tough === true);
ok('brakes', GC.applyUpgrades(base, { brakes: 2 }).brake === 1.7 && near(GC.brakeExtra({ brake: 1.7 }), 18.2, 0.01) && GC.brakeExtra({}) === 0);
ok('levels clamp', GC.applyUpgrades(base, { engine: 9 }).vmax === GC.applyUpgrades(base, { engine: 3 }).vmax && GC.applyUpgrades(base, { engine: -2 }).vmax === base.vmax);
ok('boost never below 1.2 vmax', kinds.every(k => { const s = GC.applyUpgrades(M[k], { engine: 3 }); return s.boost >= s.vmax * 1.2 - 0.01; }));
const full = { engine: 3, handling: 3, brakes: 3, boost: 3 };
ok('drag: faster tier = quicker', GC.dragTime(M.phobos_phantom) < GC.dragTime(M.olympus_gt) && GC.dragTime(M.olympus_gt) < GC.dragTime(M.red_comet) && GC.dragTime(M.red_comet) < GC.dragTime(M.dust_runner));
ok('drag: upgrades help', GC.dragTime(GC.applyUpgrades(M.dust_runner, full)) < GC.dragTime(M.dust_runner) * 0.8);
ok('drag sane range', kinds.every(k => GC.dragTime(M[k]) > 6 && GC.dragTime(M[k]) < 20));
ok('drag pure accel case', near(GC.dragTime({ boost: 1000, bacc: 10 }, 20), 2));
ok('perf index monotonic', GC.perfIndex(GC.applyUpgrades(base, full)) > GC.perfIndex(s0));
// ---------- rep ----------
const r = GC.newRide('r1', 'red_comet');
ok('rep stock tier2', GC.repScore(r, 2) === 4 + 6);
const r2 = { ...r, id: 'r2', paint: 'chrome', kit: 'widebody', wheels: 'gold', glow: 'cyan', up: { ...full } };
ok('rep fully built', GC.repScore(r2, 2) === 4 + 6 + 36 + 8 + GC.KITS.widebody.rep + GC.WHEELS.gold.rep + 10 + 10, GC.repScore(r2, 2));
ok('rep tier matters', GC.repScore(r, 4) > GC.repScore(r, 1));
ok('rep null', GC.repScore(null) === 0);
const save = GC.freshGarage(); const a = GC.showOff(save, r2, 2, 7), b = GC.showOff(save, r2, 2, 7), c = GC.showOff(save, r, 2, 7), d = GC.showOff(save, r2, 2, 8);
ok('show off once per ride per meet', a.rep > 0 && b.repeat && b.rep === 0 && c.rep > 0 && d.rep === a.rep && save.rep === a.rep * 2 + c.rep);
ok('titles', GC.repTitle(0) === 'Nobody' && GC.repTitle(60) === 'Respected' && GC.repTitle(999) === 'Legend of the Junction');
ok('drag rep', GC.dragRep(true, 100, 2) === 6 + 4 + 4 && GC.dragRep(false, 500, 4) === 1);
// ---------- colony clock ----------
const H = h => h * 60000; // colony hour h = real minute h
ok('clock hour', near(GC.colonyHour(H(21.5)), 21.5) && near(GC.colonyHour(H(24 + 2)), 2));
ok('offset', near(GC.colonyHour(0, 22), 22));
ok('meet hours', GC.isMeetHour(21) && GC.isMeetHour(2.9) && !GC.isMeetHour(3) && !GC.isMeetHour(12));
ok('mins to meet', near(GC.minsToMeet(H(20)), 1) && GC.minsToMeet(H(22)) === 0);
ok('meet id stable across midnight', GC.meetId(H(21.2)) === GC.meetId(H(26.5)) && GC.meetId(H(21.2)) !== GC.meetId(H(21.2 + 24)));
ok('fmtHour', GC.fmtHour(21.5) === '21:30' && GC.fmtHour(3) === '03:00');
// ---------- save migration ----------
for (const old of [undefined, null, 5, 'x', [], {}]) { const g = GC.migrateGarage(old); ok('migrate ' + JSON.stringify(old), g.v === 1 && g.rides.length === 1 && g.rides[0].id === 'stock' && g.active === 'stock' && g.rep === 0); }
const partial = GC.migrateGarage({ rides: [{ id: 'r4', kind: 'olympus_gt', paint: 'gold', up: { engine: 7, boost: '2' } }, { kind: 'nope' }, null], active: 'r4', rep: '33', nextId: 2 });
ok('migrate partial: stock restored', partial.rides[0].id === 'stock' && partial.rides.length === 2);
ok('migrate partial: ride fields', (() => { const x = partial.rides[1]; return x.up.engine === 3 && x.up.boost === 2 && x.up.brakes === 0 && x.owned.paint.includes('gold') && x.kit === 'stock' && x.spent === 0; })());
ok('migrate partial: scalars', partial.active === 'r4' && partial.rep === 33 && partial.nextId === 5);
ok('migrate bad active', GC.migrateGarage({ rides: [], active: 'ghost' }).active === 'stock');
const rt = GC.migrateGarage(JSON.parse(JSON.stringify(partial))); ok('migrate idempotent', JSON.stringify(rt) === JSON.stringify(partial));
// a whole old v7.4 progress save (no garage key) round-trips without touching other keys
const oldP = { credits: 120, xp: 40, quests: { done: ['a'] }, cos: { paint: 'red' } }; const P = { ...oldP, garage: GC.migrateGarage(oldP.garage) };
ok('old progress keeps keys', P.credits === 120 && P.quests.done[0] === 'a' && P.cos.paint === 'red' && P.garage.rides.length === 1);
// ---------- dealer stock (SSX.registerVehicle price hook + explicit hook) ----------
const V = { rover: { name: 'Rover', vmax: 17, price: 600 }, buggy: { name: 'Buggy', vmax: 21 }, ...M,
  raccoon: { name: 'Raccoon Mobile', vmax: 22, price: 3100, icon: '🦝' }, secret: { name: 'Secret', vmax: 40, price: 99, hidden: true }, nodeal: { name: 'Nope', vmax: 9, price: 10, dealer: false },
  fancy: { name: 'Fancy', vmax: 30, price: 9000, dealer: { price: 8000, rep: 50, blurb: 'shiny' } }, cheap: { name: 'Cheap', vmax: 12, price: 200, desc: 'A box.', minRep: 5 } };
const st = GC.dealerStock(V), ks = st.map(s => s.kind);
ok('stock lists models', kinds.every(k => ks.includes(k)));
ok('price field auto-lists (Raccoon Mobile)', (() => { const x = st.find(s => s.kind === 'raccoon'); return x && x.price === 3100 && x.name === 'Raccoon Mobile' && x.icon === '🦝' && x.tier === 2 && x.modded && x.rep === 0; })());
ok('no price = not for sale', !ks.includes('buggy'));
ok('rover never listed', !ks.includes('rover'));
ok('hidden skipped', !ks.includes('secret'));
ok('dealer:false skipped', !ks.includes('nodeal'));
ok('dealer object overrides', (() => { const x = st.find(s => s.kind === 'fancy'); return x.price === 8000 && x.rep === 50 && x.blurb === 'shiny' && x.tier === 4; })());
ok('desc/minRep aliases', (() => { const x = st.find(s => s.kind === 'cheap'); return x.blurb === 'A box.' && x.rep === 5 && x.tier === 1; })());
ok('sorted by price', st.every((s, i) => i === 0 || s.price >= st[i - 1].price));
const st2 = GC.dealerStock(V, { buggy: { price: 700, blurb: 'used' }, nodeal: { price: 50 }, raccoon: { hidden: true }, ghost: { price: 5 } });
ok('explicit hook lists a price-less kind', st2.some(s => s.kind === 'buggy' && s.price === 700 && s.blurb === 'used'));
ok('explicit hook beats dealer:false', st2.some(s => s.kind === 'nodeal' && s.price === 50));
ok('explicit hidden delists', !st2.some(s => s.kind === 'raccoon'));
ok('explicit for unknown kind ignored', !st2.some(s => s.kind === 'ghost'));
ok('inferTier', GC.inferTier(800) === 1 && GC.inferTier(2000) === 2 && GC.inferTier(4000) === 3 && GC.inferTier(7000) === 4);
{ const m = GC.migrateGarage({ rides: [{ id: 'r9', kind: 'ares_brute', noPlates: true, gift: true, up: { boost: 2 } }], active: 'r9' });
  ok('migration keeps granted no-plates ride', m.rides.some(r => r.id === 'r9' && r.noPlates === true && r.gift === true && r.up.boost === 2 && r.up.engine === 0)); }
{ // Ben's PR #11 Raccoon Mobile, exact registerVehicle shape: auto-listed from price (no dealer.price), name/icon/blurb carried over
  const st = GC.dealerStock({ raccoon_mobile: { name: 'Raccoon Mobile', icon: '🦝', price: 900, vmax: 21, boost: 33, acc: 13.5, bacc: 19, turn: 2.2, wy: 0.48, wr: 0.48, r: 2.1, airTurn: 1.3, offroad: 0.9, blurb: 'Scrappy, quick on its feet, smells faintly of bins.', dealer: { venue: 'depot', world: 'Mars', colony: 'Ares Junction' } } }); const r = st.find(x => x.kind === 'raccoon_mobile');
  ok('raccoon_mobile auto-listed from PR #11 shape', r && r.price === 900 && r.name === 'Raccoon Mobile' && r.icon === '🦝' && r.tier === 1 && r.rep === 0 && r.modded && /bins/.test(r.blurb));
  const sp = GC.applyUpgrades({ name: 'Raccoon Mobile', icon: '🦝', price: 900, vmax: 21, boost: 33, acc: 13.5, bacc: 19, turn: 2.2, wy: 0.48, wr: 0.48, r: 2.1, airTurn: 1.3, offroad: 0.9, blurb: 'Scrappy, quick on its feet, smells faintly of bins.', dealer: { venue: 'depot', world: 'Mars', colony: 'Ares Junction' } }, { engine: 1, handling: 0, brakes: 0, boost: 0 }, 'stock'); ok('raccoon spec upgrades keep offroad/airTurn', sp.vmax > 21 && sp.offroad === 0.9 && sp.airTurn === 1.3); }
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
