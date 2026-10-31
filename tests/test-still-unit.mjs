// node tests/test-still-unit.mjs: Mars moonshine still rules (mars/stillcore.js): price + 1:1 ⭐ rate, brewing over in-game
// hours, crates of 6, alien prices (1.5-2x the raw crop), the SSX.liquor contract Jeff's bar (#93) reads, a bust taking only
// the carried crates, a double tap charging once, the #83 save guard and a Save Code round trip of ssx.still.v1.
import * as K from '../mars/stillcore.js';
import { CROPS, growCost, makeActGuard } from '../mars/farmcore.js';
import * as SS from '../mars/starshopcore.js';
await import('../savecode.js'); const C = globalThis.SSXSaveCore;
let bad = 0, n = 0; const ok = (k, c, v) => { n++; if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v).slice(0, 400)); } };

// ---- price + rate ----
ok('price', K.PRICE === 1800 && K.STAR_RATE === 1 && K.PRICE_STARS === 1800, { p: K.PRICE, r: K.STAR_RATE, s: K.PRICE_STARS });
ok('save keys', K.SAVE_KEY === 'ssx.still.v1' && K.BAK_KEY === 'ssx.still.v1.bak');
// ---- recipes / names (fiction, #93 type words kept) ----
ok('recipes', K.RECIPES.potato.name === 'Potato moonshine' && K.RECIPES.algae.name === 'Algae gin' && K.RECIPES.glowberry.name === 'Glow-berry hooch' && K.RECIPES.lichen.name === 'Ghost lichen absinthe');
ok('ids', K.BOTTLE_IDS.join() === 'potato_moonshine,algae_gin,glowberry_hooch,lichen_absinthe', K.BOTTLE_IDS);
// ---- economy: 1.5-2x raw, still pays back, bottles beat selling raw ----
for (const id of K.BOTTLE_IDS) {
  const b = K.BOTTLES[id], raw = CROPS[b.crop].price, p = K.alienPrice(id), m = p / raw;
  ok('alienPrice ' + id, m >= 1.5 && m <= 2 && p % 5 === 0, { raw, p, m });
  ok('profit ' + id, p * CROPS[b.crop].yield > growCost(b.crop) && K.payback(id) > 0 && K.payback(id) <= 40, { per: p * CROPS[b.crop].yield, cost: growCost(b.crop), payback: K.payback(id) });
}
ok('prices exact', K.alienPrice('potato_moonshine') === 185 && K.alienPrice('algae_gin') === 140 && K.alienPrice('glowberry_hooch') === 325 && K.alienPrice('lichen_absinthe') === 560 && K.alienPrice('nope') === 0);

// ---- buying: cr and ⭐, short, all-or-nothing, double tap charges once ----
{
  const s = K.fresh(); let charged = 0; const commit = (c, k) => { charged += k; return { ok: true }; };
  ok('short cr', !K.buy(s, 'cr', { cr: 1799 }, commit).ok && charged === 0 && !s.owned);
  ok('short stars', K.buy(s, 'stars', { stars: 10 }, commit).short === 1790 && charged === 0);
  const g = makeActGuard(() => 1000, 600);
  const r1 = g.run('buy', () => K.buy(s, 'cr', { cr: 5000 }, commit)), r2 = g.run('buy', () => K.buy(s, 'cr', { cr: 5000 }, commit));
  ok('double tap once', r1.ok && r2.dup && charged === 1800 && s.owned && s.paidWith === 'cr', { r1, r2, charged });
  ok('owned refuses', !K.buy(s, 'cr', { cr: 9999 }, commit).ok && charged === 1800);
  const f = K.fresh(); ok('failed payment leaves it unowned', !K.buy(f, 'cr', { cr: 5000 }, () => ({ ok: false, msg: 'x' })).ok && !f.owned);
  // ⭐ through the real starshop rules (SSX.stars path): 1,800 ⭐ off the balance, once
  let st = SS.fresh(); const xp = 2500, t = K.fresh();
  const pay = (c, k) => { const r = SS.spend(st, xp, k, 'still'); if (r.ok) st = r.st || st; return r; };
  const b0 = SS.balance(st, xp), rb = K.buy(t, 'stars', { stars: b0 }, pay), b1 = SS.balance(st, xp);
  ok('stars buy', rb.ok && t.paidWith === 'stars' && b0 - b1 === 1800, { b0, b1, rb });
}

// ---- brewing over hours ----
{
  const s = K.fresh(); s.owned = true; let silo = { potato: 20 };
  const take = (c, k) => { const g = Math.min(silo[c] | 0, k); silo[c] -= g; return g; };
  const r = K.start(s, 'potato', 99, silo.potato, 10, take);
  ok('start caps at 12', r.ok && r.n === 12 && silo.potato === 8 && s.batch.hours === 6, { r, silo });
  ok('busy', !K.start(s, 'potato', 4, silo.potato, 10, take).ok && silo.potato === 8);
  ok('not yet', K.step(s, 15.9) === null && Math.abs(K.hoursLeft(s, 13) - 3) < 1e-9 && Math.abs(K.progress(s, 13) - 0.5) < 1e-9);
  const d = K.step(s, 16); ok('ready', d && d.id === 'potato_moonshine' && d.n === 12 && s.home.potato_moonshine === 12 && !s.batch && s.stats.brewed === 12, { d, s });
  ok('empty silo', !K.start(s, 'algae', 5, 0, 20, take).ok);
  ok('unowned', !K.start(K.fresh(), 'potato', 5, 5, 0, take).ok);
  ok('take short starts on what came out', K.start(s, 'potato', 8, 8, 20, () => 3).n === 3 && s.batch.n === 3);
}

// ---- crates in the rover, SSX.liquor contract, alien sales ----
{
  const s = K.fresh(); s.owned = true; s.home = { potato_moonshine: 20, glowberry_hooch: 10 };
  ok('crates math', K.crates(0) === 0 && K.crates(1) === 1 && K.crates(6) === 1 && K.crates(7) === 2 && K.CRATE === 6);
  const l = K.load(s); ok('load best first, 4 crates max', l.ok && K.count(s.carried) === 24 && s.carried.glowberry_hooch === 10 && s.carried.potato_moonshine === 14 && s.home.potato_moonshine === 6 && l.crates === 4, { l, s });
  ok('rover full', !K.load(s).ok);
  const inv = K.inventory(s);
  ok('inventory shape', Array.isArray(inv) && inv.every(o => Object.keys(o).join() === 'id,name,n' && typeof o.id === 'string' && typeof o.name === 'string' && Number.isInteger(o.n)) && inv.length === 2, inv);
  ok('take returns number', K.take(s, 'potato_moonshine', 4) === 4 && K.take(s, 'potato_moonshine', 99) === 10 && K.take(s, 'potato_moonshine', 1) === 0 && K.take(s, 'nope', 1) === 0);
  ok('add returns number', K.add(s, 'potato_moonshine', 3) === 3 && K.add(s, 'bogus', 3) === 0 && K.add(s, 'algae_gin', 99) === K.CARRY_CRATES * K.CRATE - 13, s.carried);
  const s2 = K.fresh(); s2.carried = { glowberry_hooch: 5 };
  const sl = K.sell(s2, 'glowberry_hooch', 5); ok('sell', sl.ok && sl.n === 5 && sl.each === 325 && sl.cr === 1625 && !K.count(s2.carried) && s2.stats.earned === 1625, sl);
  ok('sell none', !K.sell(s2, 'glowberry_hooch', 1).ok);
  // Jeff's bar adapter (#93) reads: ok needs take + inventory; take(id, n) -> number; alienPrice(id) -> cr per bottle
  const L = { inventory: () => K.inventory(s), take: (id, k) => K.take(s, id, k), alienPrice: id => K.alienPrice(id), add: (id, k) => K.add(s, id, k), sell: (id, k) => K.sell(s, id, k) };
  ok('liquor contract', ['inventory', 'take', 'alienPrice', 'add', 'sell'].every(k => typeof L[k] === 'function') && typeof L.take('algae_gin', 1) === 'number' && typeof L.alienPrice('algae_gin') === 'number');
  ok('bar barPrice uses ours', Math.round(L.alienPrice('potato_moonshine') * 1.3) === 241);
}

// ---- BUSTED while wanted with crates aboard: only the crates go, no fine ----
{
  const s = K.fresh(); s.owned = true; s.home = { potato_moonshine: 30 }; K.load(s); const before = { ...s.home };
  const r = K.confiscate(s); ok('confiscate carried only', r.n === 24 && r.crates === 4 && !K.count(s.carried) && s.home.potato_moonshine === before.potato_moonshine && s.stats.seized === 24 && s.stats.busts === 1, { r, s });
  ok('seize words', /ColSec took the 4 crates/.test(K.seizeText(r)) && /safe/.test(K.seizeText(r)));
  ok('no crates no seize', K.confiscate(s).n === 0 && s.stats.busts === 1);
}

// ---- save: migrate, #83 guard, backup, Save Code round trip ----
{
  const s = K.fresh(); s.owned = true; s.home = { algae_gin: 7, junk: 4 }; s.carried = { potato_moonshine: 6 }; s.batch = { crop: 'glowberry', n: 9, start: 3 };
  const m = K.migrate(JSON.parse(JSON.stringify(s)));
  ok('migrate', m.owned && m.home.algae_gin === 7 && !m.home.junk && m.carried.potato_moonshine === 6 && m.batch.n === 9 && m.batch.hours === 8, m);
  ok('migrate junk', !K.migrate('x').owned && !K.migrate({ owned: 'yes' }).owned && K.migrate({ owned: true, batch: { crop: 'x', n: 2, start: 1 } }).batch === null);
  const raw = JSON.stringify(m);
  ok('guard', !K.mayOverwrite(K.fresh(), raw) && K.mayOverwrite(m, raw) && K.mayOverwrite(K.fresh(), null));
  const rc = K.recover('', raw); ok('recover from backup', rc.s.owned && rc.restored && rc.from === 'backup');
  ok('recover fresh', !K.recover(null, null).s.owned && K.recover(raw, null).from === 'save');
  ok('savecode KNOWN', C.isGameKey('ssx.still.v1') && C.isGameKey('ssx.still.v1.bak'));
  const store = new Map([['ssx.still.v1', raw], ['ssx.still.v1.bak', raw], ['ssx.progress.v1', '{"v":1,"credits":5}']]);
  const S = { get length() { return store.size; }, key: i => [...store.keys()][i] ?? null, getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const code = await C.encode(C.collect(S)), d = await C.decode(code);
  ok('savecode round trip', d.ok && d.keys['ssx.still.v1'] === raw && K.migrate(JSON.parse(d.keys['ssx.still.v1'])).home.algae_gin === 7, { ok: d.ok, keys: Object.keys(d.keys || {}) });
}
console.log(bad ? `FAIL ${bad}/${n}` : `still unit OK (${n} checks)`); process.exit(bad ? 1 : 0);
