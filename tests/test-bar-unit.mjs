// v7.6 Velvet Airlock space-liquor bar (bar.js): the pure rules. The bar pays 1.3x the alien price (from SSX.liquor
// when it exposes one, a per-type base otherwise), the daily demand cap stops selling at BAR.dailyCap a day and resets
// on a new day, drinks are priced 15-60 cr, drunk stacks / wears off in ~60-90 s / blacks out, and with no SSX.liquor the
// adapter is off (the sell section hides). node tests/test-bar-unit.mjs
import { DRINKS, DRUNK, BAR, decay, soberTime, addDrink, stage, effects, slur, basePrice, barPrice, normInventory, capLeft, recordSale, quote, soldLine, liquorAdapter, dayKey, drinkUnits, COUNTER } from '../bar.js';
const bad = [], ok = (k, c, v) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${k}${v !== undefined ? ': ' + v : ''}`); if (!c) bad.push(k); };

// house drinks
ok('3-4 house drinks', DRINKS.length >= 3 && DRINKS.length <= 4, DRINKS.map(d => `${d.name} ${d.price}`).join(', '));
ok('prices 15-60 cr', DRINKS.every(d => d.price >= 15 && d.price <= 60));
ok('pricier drinks hit harder', DRINKS.every((d, i) => !i || (d.price > DRINKS[i - 1].price && d.units > DRINKS[i - 1].units)));

// 1.3x price
ok('multiplier is 1.3', BAR.mult === 1.3);
const Lp = { price: id => ({ moonshine: 50, hooch: 30 })[id] };
ok('1.3x SSX.liquor price (50 -> 65)', barPrice({ id: 'moonshine' }, Lp) === 65, barPrice({ id: 'moonshine' }, Lp));
ok('1.3x SSX.liquor price (30 -> 39)', barPrice({ id: 'hooch' }, Lp) === 39);
ok('alienPrice() wins over price()', barPrice({ id: 'x' }, { alienPrice: () => 100, price: () => 1 }) === 130);
ok('object price {alien} read', barPrice({ id: 'x' }, { price: () => ({ alien: 20 }) }) === 26);
ok('prices map read', barPrice({ id: 'gin' }, { prices: { gin: 70 } }) === 91);
ok('item own price used', barPrice({ id: 'odd', price: 40 }, {}) === 52);
ok('fallback moonshine 60 -> 78', barPrice({ id: 'red_moonshine' }, null) === 78 && basePrice({ id: 'red_moonshine' }, null) === 60);
ok('fallback hooch 40 -> 52', barPrice({ id: 'dust-hooch' }, null) === 52);
ok('fallback by name', basePrice({ id: 'b1', name: 'Glowberry Wine' }, null) === 70);
ok('fallback default 45 -> 59', barPrice({ id: 'mystery' }, null) === Math.round(45 * 1.3));
ok('throwing price() falls back', barPrice({ id: 'moonshine' }, { price: () => { throw new Error('x'); } }) === 78);
ok('always 1.3x of base (sweep)', [7, 13, 45, 99, 250].every(b => barPrice({ id: 'z' }, { price: () => b }) === Math.round(b * 1.3)));

// inventory shapes
ok('array inventory', JSON.stringify(normInventory([{ id: 'moonshine', qty: 3 }, { type: 'hooch', count: 2 }]).map(x => [x.id, x.qty])) === '[["moonshine",3],["hooch",2]]');
ok('map inventory', JSON.stringify(normInventory({ moonshine: 4, hooch: 0, wine: { qty: 1, name: 'Glow Wine' } }).map(x => [x.id, x.qty, x.name])) === '[["moonshine",4,"Moonshine"],["wine",1,"Glow Wine"]]');
ok('{bottles:[]} inventory', normInventory({ bottles: [{ id: 'a', n: 2 }] })[0]?.qty === 2);
ok('junk inventory -> []', normInventory(null).length === 0 && normInventory(5).length === 0);

// daily cap
const day = '2026-10-29';
ok('cap 8-20 a day', BAR.dailyCap >= 8 && BAR.dailyCap <= 20, BAR.dailyCap);
ok('fresh save: full cap', capLeft({}, day) === BAR.dailyCap);
let s = recordSale({}, day, 5); ok('5 sold -> cap-5 left', capLeft(s, day) === BAR.dailyCap - 5);
s = recordSale(s, day, BAR.dailyCap); ok('cap never negative', capLeft(s, day) === 0);
ok('new day resets', capLeft(s, '2026-10-30') === BAR.dailyCap && recordSale(s, '2026-10-30', 2).sold === 2);
const q = quote({ id: 'moonshine', qty: 20 }, 20, null, 4); ok('quote clamps to cap', q.n === 4 && q.total === 4 * 78, JSON.stringify(q));
ok('quote clamps to qty', quote({ id: 'moonshine', qty: 2 }, 10, null, 12).n === 2);
ok('quote 0 at cap', quote({ id: 'moonshine', qty: 2 }, 2, null, 0).total === 0);
ok('dayKey local yyyy-mm-dd', dayKey(new Date(2026, 9, 29, 23, 30)) === '2026-10-29');
ok('toast text', soldLine(3, 234) === 'Sold 3 bottles · +234 cr' && soldLine(1, 78) === 'Sold 1 bottle · +78 cr');

// adapter: absent / present
const none = liquorAdapter(() => undefined);
ok('no SSX.liquor: adapter off', none.ok === false && none.list().length === 0 && none.take('moonshine', 1) === 0);
ok('getter that throws: off', liquorAdapter(() => { throw new Error('boom'); }).ok === false);
ok('liquor without take: off', liquorAdapter(() => ({ inventory: () => ({ a: 1 }) })).ok === false);
const inv = { moonshine: 3, hooch: 2 };
const stub = { inventory: () => ({ ...inv }), take: (id, n) => { if ((inv[id] || 0) < n) return false; inv[id] -= n; return true; }, price: id => ({ moonshine: 50 })[id] };
const A = liquorAdapter(() => stub);
ok('stub adapter on', A.ok === true && A.list().length === 2);
ok('take 2 moonshine', A.take('moonshine', 2) === 2 && inv.moonshine === 1);
ok('take too many refused', A.take('hooch', 5) === 0 && inv.hooch === 2);
ok('adapter price 1.3x', A.price({ id: 'moonshine' }) === 65 && A.base({ id: 'hooch' }) === 40);
ok('take that throws -> 0', liquorAdapter(() => ({ inventory: () => ({ a: 1 }), take: () => { throw new Error('x'); } })).take('a', 1) === 0);

// drunk
let D = 0; for (const d of DRINKS.slice(0, 2)) D = addDrink(D, d.units);
ok('stacks per drink', D === DRINKS[0].units + DRINKS[1].units && stage(D) === 'tipsy', D);
ok('stages climb', ['sober', 'tipsy', 'drunk', 'heavy', 'blackout'].join() === [0, 1.5, 4, 7, 9.5].map(stage).join());
ok('capped at max', addDrink(9, 50) === DRUNK.max);
ok('effects grow with level', effects(2).roll < effects(6).roll && effects(6).vignette > effects(2).vignette && effects(0).vignette === 0);
ok('blur only when heavy', !effects(4).blur && effects(7).blur === 1);
ok('typical buzz (~5) wears off in 60-90 s', soberTime(5) >= 60 && soberTime(5) <= 90, soberTime(5).toFixed(1) + ' s');
let x = 5, tt = 0; while (x > 0 && tt < 300) { x = decay(x, 0.1); tt += 0.1; } ok('decay() matches closed form', Math.abs(tt - soberTime(5)) < 1.5, tt.toFixed(1));
ok('decay never negative', decay(0.01, 10) === 0 && decay(0, 1) === 0);
let n = 0; D = 0; while (stage(D) !== 'blackout' && n < 20) { D = addDrink(D, DRINKS[3].units); n++; }
ok('3 Airlock Breakers = blackout', n === 3, n);
ok('farm moonshine hits ~3 units', drinkUnits({ id: 'moonshine' }) === 3.2 && drinkUnits({ id: 'x', abv: 45 }) === 3);
let seed = 1; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
ok('sober speech untouched', slur('Same again, please.', 0) === 'Same again, please.');
ok('drunk speech slurs', slur('Same again, please.', 0.9, rng) !== 'Same again, please.', slur('Same again, please.', 0.9, rng));

// counter placement: clear of the other club spots (room-local coords)
const others = { bar: [-8.1, 1.5, 2.0], slots: [-7.7, 6.45, 1.35], rhea: [-2.8, -4.0, 0.95], kiara: [2.8, -4.0, 0.95], tip: [0, -3.9, 1.5], danny: [7.6, -5.1, 0.9], show: [6.55, -5.3, 0.6], upstairs: [8.8, -6.1, 0.9], leave: [0, 7.1, 1.6] };
const clear = Object.entries(others).filter(([, [x, z, r]]) => Math.hypot(x - COUNTER.x, z - COUNTER.z) <= r + COUNTER.r).map(([k]) => k);
ok('counter spot overlaps no other spot', !clear.length, clear.join() || 'clear');

console.log(bad.length ? `\n${bad.length} FAILED: ${bad.join(', ')}` : '\nall bar unit checks passed');
process.exit(bad.length ? 1 : 0);
