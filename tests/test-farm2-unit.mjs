// node tests/test-farm2-unit.mjs: Red Static Gulch rules (mars/farm2core.js): site away from the farm, fictional crops,
// buy/rack charged once in cr or ⭐ (1:1), growth over game hours, stash cap, Skiv vs Xen-7 prices, heat + raid rolls,
// the light seizure, the sandworm damage()/restore() hook, the #83 save guard and a Save Code round trip of ssx.farm2.v1.
import * as K from '../mars/farm2core.js';
import * as F from '../mars/farmcore.js';
await import('../savecode.js'); const C = globalThis.SSXSaveCore;
let bad = 0, n = 0; const ok = (k, c, v) => { n++; if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v).slice(0, 400)); } };
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
ok('keys', K.SAVE_KEY === 'ssx.farm2.v1' && K.BAK_KEY === 'ssx.farm2.v1.bak');
ok('far from farm', d(K.SITE.at, F.SITES.farm.at) > 150 && d(K.SITE.at, F.SITES.post.at) > 150, d(K.SITE.at, F.SITES.farm.at));
ok('far from pit', d(K.SITE.at, [-292, -68]) > 300);
ok('crops', K.CROP_IDS.join() === 'redstatic,glowcactus,voidpoppy,ghostspore' && K.CROPS.voidpoppy.name === 'Void Honey poppies');
ok('rate', K.STAR_RATE === 1 && K.starPrice(K.PRICES.op) === K.PRICES.op);
// buying: once, all or nothing, either currency
let s = K.fresh(), paid = [];
const pay = (c, x) => { paid.push([c, x]); return { ok: true }; };
ok('buy short', !K.buyOp(s, 'cr', { cr: 100 }, pay).ok && !paid.length && !s.owned);
let r = K.buyOp(s, 'stars', { stars: 3000 }, pay); ok('buy stars', r.ok && s.owned && s.paidWith === 'stars' && paid.length === 1 && paid[0][1] === 2500, r);
ok('buy twice', !K.buyOp(s, 'cr', { cr: 9999 }, pay).ok && paid.length === 1);
ok('pay refused', (() => { const t = K.fresh(); const q = K.buyOp(t, 'cr', { cr: 9999 }, () => ({ ok: false })); return !q.ok && !t.owned; })());
for (let i = 0; i < 7; i++) K.addRack(s, 'cr', { cr: 9999 }, pay);
ok('rack cap', s.racks.length === K.LIMITS.racks && paid.length === 1 + K.LIMITS.racks && new Set(s.racks.map(x => x.id)).size === 6);
// grow
ok('canPlant cash', !K.canPlant(s, 0, 'ghostspore', 10).ok && K.canPlant(s, 0, 'ghostspore', 9999).ok);
K.plant(s, 0, 'redstatic'); K.plant(s, 1, 'ghostspore');
ok('not ripe', !K.harvest(s, 0).ok);
let a = K.advance(s, 8); ok('ripe 8h', s.racks[0].growth === 1 && a.ripe.join() === '0' && s.racks[1].growth < 1, a);
r = K.harvest(s, 0); ok('harvest', r.ok && r.n === 5 && s.stash.redstatic === 5 && !s.racks[0].crop, r);
K.advance(s, 30); r = K.harvest(s, 1); ok('harvest spore', r.ok && r.n === 3 && s.stash.ghostspore === 3);
// stash cap
s.stash.redstatic = 36; K.plant(s, 2, 'redstatic'); K.advance(s, 9); r = K.harvest(s, 2); ok('stash cap', r.n === 1 && r.lost === 4 && K.stashCount(s) === 40, r);
// selling: Xen-7 pays more than Skiv, both within a sane band
for (const c of K.CROP_IDS) { const sk = K.unitPrice(3, c, 'skiv'), xe = K.unitPrice(3, c, 'xen7'); ok('price ' + c, xe > sk && sk >= K.CROPS[c].price * 0.85 - 1 && sk <= K.CROPS[c].price * 1.15 + 1, { sk, xe }); }
for (const c of K.CROP_IDS) { const cr = K.CROPS[c]; ok('profit ' + c, cr.yield * cr.price * 0.85 > cr.seed * 3); }
const q = K.quoteSale(s, 'skiv', 'ghostspore'); ok('quote', q.ok && q.qty === 3 && q.cash === q.unit * 3, q);
K.applySale(s, q); ok('sold', !s.stash.ghostspore && s.stats.sold === 3 && s.stats.earned === q.cash);
ok('quote none', !K.quoteSale(s, 'skiv', 'ghostspore').ok && !K.quoteSale(s, 'nobody', 'redstatic').ok);
// heat + raid rolls
ok('heatRoll', K.heatRoll(0.4, 0.39) && !K.heatRoll(0.4, 0.41));
s.hours = 100; s.lastRaidH = 95; ok('raid cooldown', !K.raidDue(s, 0));
s.lastRaidH = 80; ok('raid due', K.raidDue(s, 0.1) && !K.raidDue(s, 0.9));
// seizure: a quarter, capped, never racks
const racksBefore = JSON.stringify(s.racks); const before = K.stashCount(s); const sz = K.seize(s);
ok('seize quarter', sz.n === Math.min(K.RAID.seizeMax, Math.ceil(before / 4)) && K.stashCount(s) === before - sz.n && JSON.stringify(s.racks) === racksBefore, { before, sz });
ok('seize empty', K.seize(K.fresh()).n === 0);
// sandworm hook
K.plant(s, 3, 'voidpoppy'); K.advance(s, 5); const id = s.racks[3].id;
const dm = K.damage(s, id); ok('damage', dm.ok && dm.snap.crop === 'voidpoppy' && !s.racks[3].crop && s.stats.eaten === 1, dm);
ok('damage empty', !K.damage(s, id).ok && !K.damage(s, 999).ok);
const rs = K.restore(s, id, dm.snap); ok('restore', rs.ok && s.racks[3].crop === 'voidpoppy' && Math.abs(s.racks[3].growth - dm.snap.growth) < 1e-9);
ok('restore twice', !K.restore(s, id, dm.snap).ok);
// idempotent actions
let t = 0; const AG = K.makeActGuard(() => t); let calls = 0; const f = () => { calls++; return { ok: true }; };
AG.run('x', f); t = 100; ok('dedupe', AG.run('x', f).dup && calls === 1); t = 400; AG.run('x', f); ok('after window', calls === 2);
let inner = null; AG.run('y', () => { inner = AG.run('z', f); return { ok: true }; }); ok('busy lock', inner.dup && inner.why === 'busy');
// save guard (#83)
const own = JSON.stringify(s), blank = JSON.stringify(K.fresh());
ok('mayOverwrite', !K.mayOverwrite(K.fresh(), own) && K.mayOverwrite(s, blank) && K.mayOverwrite(K.fresh(), blank));
let rc = K.recover('{bad', own); ok('recover bak', rc.s.owned && rc.restored && rc.from === 'backup');
rc = K.recover(own, null); ok('recover save', rc.s.owned && !rc.restored && rc.s.racks.length === 6);
ok('migrate junk', !K.migrate({ v: 1, owned: false, racks: [{ crop: 'x' }] }).racks.length && !K.migrate({ v: 1, owned: true, racks: [{ crop: 'heroin' }] }).racks[0].crop);
// Save Code covers ssx.farm2.v1
ok('known', C.KNOWN.includes(K.SAVE_KEY) && C.KNOWN.includes(K.BAK_KEY));
ok('directions', /south-east/.test(K.directions({ x: 0, z: 0 }, { x: 100, z: 100 })) && /You're at/.test(K.directions({ x: 0, z: 0 }, { x: 3, z: 3 })));
// no real drug names in the crop list
ok('fiction', !K.CROP_IDS.some(c => /weed|cannabis|opium|heroin|cocaine|meth|marijuana|mdma|lsd|psilocybin/i.test(K.CROPS[c].name)));
console.log(bad ? `farm2 unit: ${bad} of ${n} FAILED` : `farm2 unit OK (${n} checks)`); process.exit(bad ? 1 : 0);
