// node tests/test-starmix-unit.mjs — v7.5.46 ride bonus / heist / front star rules (starmixcore.js)
import * as SM from '../starmixcore.js';
import * as GC from '../garagecore.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const pct = k => SM.bonusPct(SM.ridePrice(k, GC.MODELS[k]));
const table = Object.keys(GC.MODELS).map(k => [k, GC.MODELS[k].price, pct(k)]); console.log(table.map(r => r.join(' ')).join('\n'));
ok(SM.bonusPct(SM.ridePrice('rover', {})) === 0, 'stock rover +0%');
ok(pct('rust_rat') === 0 && pct('dust_runner') > 0 && pct('dust_runner') <= 20, 'tier-1 rides small');
ok(pct('ghost_sled') === 100 && pct('phobos_phantom') >= 70, 'top rides +70..100%');
ok(table.every((r, i, a) => i === 0 || a[i - 1][1] > r[1] || a[i - 1][2] <= r[2]), 'pricier never lower');
ok(SM.bonusPct(50000) === 100, 'capped at +100%');
ok(SM.ridePrice('newrig', { price: 4800 }) === 4800 && SM.ridePrice('x', { dealer: { price: 3000 } }) === 3000 && SM.ridePrice('hoverbike', { vmax: 28 }) > 600, 'price from spec / dealer / vmax');
const acc = { r: 0 }; let s = 0; for (let i = 0; i < 10; i++) s += SM.rideExtra(3, 40, acc); ok(s === 12, 'fraction carried: 10x3 at 40% = 12');
ok(SM.flexEvery(50) === 0 && SM.flexEvery(55) === 30 && SM.flexEvery(100) === 15, 'flex interval');
ok(SM.heistStars(400) === 220 && SM.heistStars(5000) === 625 && SM.heistStars(0) === 60, 'heist stars scale with the score');
ok(SM.frontStars(900) === 90 && SM.frontStars(9) === 0, 'front stars 1 per 10 cr');
const g = { progress: { xp: 100 }, rewarded: 0, reward(x) { this.progress.xp += x; this.rewarded += x; } };
globalThis.__ssxStarSkip = 0; ok(SM.grantStars(g, 25) === 25 && g.progress.xp === 125 && globalThis.__ssxStarSkip === 25, 'grant uses reward + marks skip');
process.exit(fail ? 1 : 0);
