// v7.5.45 shop restock tiers (mars/shoptierscore.js): tier data, prices, unlock rules, dealer waves, save round-trip
import * as TC from '../mars/shoptierscore.js';
let fail = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fail++; };
for (const k of Object.keys(TC.TIER_SHOPS)) ok(k + ' has tiers', TC.maxTier(k) >= 3);
ok('gun tiers 5', TC.maxTier('guns') === 5);
ok('tier 1 = nothing new', TC.unlockedItems('guns', 1).length === 0);
ok('tier 2 items', TC.tierItems('guns', 2).length >= 3 && TC.unlockedItems('guns', 2).length === TC.tierItems('guns', 2).length);
ok('prices rise', TC.tierItems('guns', 5).reduce((a, b) => Math.max(a, b.price), 0) > TC.tierItems('guns', 2).reduce((a, b) => Math.max(a, b.price), 0));
ok('helios marks up', TC.priceOf('ms_guns_hel', { price: 1000 }) > TC.priceOf('ms_guns_rtf', { price: 1000 }));
const ids = new Set(); let dup = false; for (const k of ['guns', 'ms_clothes_oly', 'depot']) for (let t = 2; t <= TC.maxTier(k); t++) for (const it of TC.tierItems(k, t)) { if (ids.has(k + it.id)) dup = true; ids.add(k + it.id); }
ok('unique ids', !dup);
ok('needs base bought out', TC.nextTier('guns', 1, false, () => true) === 1);
ok('base bought out -> tier 2', TC.nextTier('guns', 1, true, () => true) === 2);
ok('tier 2 not owned -> stays', TC.nextTier('guns', 2, true, () => false) === 2);
ok('tier 2 owned -> 3', TC.nextTier('guns', 2, true, () => true) === 3);
ok('caps at max', TC.nextTier('guns', 5, true, () => true) === 5);
ok('dealer hides war rigs at wave 1', TC.dealerHidden(1).includes('ghost_sled') && TC.dealerHidden(2).length === 0);
ok('dealer wave advances', TC.dealerNext(1, ['a', 'b'], ['a']) === 1 && TC.dealerNext(1, ['a', 'b'], ['b', 'a']) === 2 && TC.dealerNext(2, ['a'], ['a']) === 2);
const s = TC.parse(JSON.stringify({ v: 1, shops: { guns: 3, bogus: 9 }, dealer: { wave: 2, bought: ['x'] } }));
ok('parse keeps valid', s.shops.guns === 3 && s.dealer.wave === 2 && s.dealer.bought[0] === 'x');
ok('parse junk -> fresh', TC.parse('{nope').shops && TC.parse(null).dealer.wave === 1);
console.log(fail ? `${fail} FAILED` : 'ALL OK'); process.exit(fail ? 1 : 0);
