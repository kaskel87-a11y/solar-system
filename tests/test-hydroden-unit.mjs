// The Hydro Den (pure, no browser): node tests/test-hydroden-unit.mjs
// Rates, quotes, change, heat and the wiring (dome tag, sw.js PRECACHE, index import, Blue's prices mirrored).
import fs from 'fs';
import * as K from '../mars/hydrodencore.js';
import { CROPS } from '../mars/farmcore.js';
import { alienPrice, BOTTLES } from '../mars/stillcore.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// rates
ok('raw crop = Xen-7 base price', K.CROP_IDS.every(id => K.goodValue(id) === Math.round(CROPS[id].price / 5) * 5));
ok('moonshine = Xen-7 bottle price', K.SHINE_IDS.every(id => K.goodValue(id) === alienPrice(id)));
ok('moonshine beats the raw crop it came from', K.SHINE_IDS.every(id => K.goodValue(id) > K.goodValue(BOTTLES[id].crop) * 1.5));
ok('unknown good is worth nothing', K.goodValue('rocks') === 0 && !K.quote('rocks', 5, 'glowdust', 10).ok);

// Blue's wholesale prices are mirrored from contraband.js
const cb = read('mars/contraband.js');
for (const id of K.DRUG_IDS) { const m = cb.match(new RegExp(`\\b${id}: \\{[^}]*supplier: (\\d+)`)); ok(`${id} cost matches Blue (${m?.[1]})`, m && +m[1] === K.DRUGS[id].cost); }

// quotes
let q = K.quote('potato', 6, 'glowdust', 20);
ok('6 potatoes -> 15 glow-dust + 30 cr', q.ok && q.take === 6 && q.units === 15 && q.change === 30, JSON.stringify(q));
ok('value is conserved', q.units * q.cost + q.change === q.take * q.each);
q = K.quote('potato', 6, 'glowdust', 4);
ok('room-limited: only takes what it needs', q.ok && q.units === 4 && q.take === 2 && q.change === 50, JSON.stringify(q));
q = K.quote('potato_moonshine', 6, 'glowdust', 99);
ok('6 potato moonshine -> 27 glow-dust (vs 15 for raw)', q.ok && q.units === 27 && q.change === 30, JSON.stringify(q));
q = K.quote('lichen_absinthe', 1, 'voidhoney', 4);
ok('1 absinthe -> 3 Void Honey + 80 cr', q.ok && q.units === 3 && q.change === 80, JSON.stringify(q));
ok('one algae mat can\u2019t buy Void Honey', K.quote('algae', 1, 'voidhoney', 4).why === 'short');
ok('no goods', K.quote('potato', 0, 'glowdust', 4).why === 'none');
ok('full pockets', K.quote('potato', 6, 'glowdust', 0).why === 'full');
ok('bad drug', K.quote('potato', 6, 'snow', 5).why === 'drug');
// every quote never overspends goods and never pays negative change
let fine = true;
for (const g of [...K.CROP_IDS, ...K.SHINE_IDS]) for (const d of K.DRUG_IDS) for (let have = 1; have < 30; have += 3) for (let room = 1; room < 21; room += 4) {
  const r = K.quote(g, have, d, room); if (!r.ok) continue;
  if (r.take > have || r.units > room || r.change < 0 || r.change >= r.each || r.units * r.cost + r.change !== r.take * r.each) { fine = false; console.log(g, d, have, room, r); }
}
ok('all quotes: take <= have, units <= room, 0 <= change < one good', fine);

// heat
ok('small deal ~ 5-10%', K.heatChance(4) > 0.05 && K.heatChance(4) < 0.1);
ok('bigger deals and stars are riskier', K.heatChance(15) > K.heatChance(4) && K.heatChance(4, 2) > K.heatChance(4));
ok('night cops multiplier scales it', K.heatChance(4, 0, 0.5) < K.heatChance(4, 0, 1));
ok('heat is capped', K.heatChance(999, 5, 3) === K.HEAT_MAX);

// wiring
const world = read('world.js'), idx = read('index.html'), sw = read('sw.js'), mod = read('mars/hydroden.js');
ok('the ARES JUNCTION dome exists in world.js', world.includes(`[0, 0, 14, '${K.DOME_SIGN}'`));
ok('module tags that dome with the interior kind', /d\[5\] = K\.KIND/.test(mod));
ok('index.html imports mars/hydroden.js (static, no ?v=)', /import '\.\/mars\/hydroden\.js';/.test(idx));
ok('sw.js precaches both files', sw.includes('`mars/hydroden.js${q}`') && sw.includes('`mars/hydrodencore.js${q}`'));
ok('buttons go through window.__onTap', /window\.__onTap\(el, fn\)/.test(mod) && !/addEventListener\('click'(?!, fn\))/.test(mod.replace("el.addEventListener('click', fn)", '')));
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
