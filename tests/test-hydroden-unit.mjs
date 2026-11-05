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

// v7.5.30: grow racks are a real feature (rent + seeds -> real-minute grow -> silo or Nettle), every den prompt has a handler
{
  const t0 = 1000;
  ok('empty rack label invites a rental', K.rackLabel(null, t0) === '🌱 Grow racks · rent one');
  for (const id of K.CROP_IDS) ok(`${id}: costs rent + seeds, grows in a few real minutes, still pays`, K.plantCost(id) === K.RACK.rent + K.seedPrice(id) && K.growMs(id) >= 60000 && K.growMs(id) <= 6 * 60000 && K.rackYield(id) * K.goodValue(id) > K.plantCost(id));
  const broke = K.rackPlant(null, 'potato', 100, t0); ok('too broke: refused with the price', !broke.ok && /175 cr/.test(broke.msg));
  const pl = K.rackPlant(null, 'potato', 500, t0); ok('plant sets crop, yield and timer', pl.ok && pl.cost === 175 && pl.next.crop === 'potato' && pl.next.n === 5 && pl.next.readyAt === t0 + 180000);
  ok('busy rack refuses a second planting', !K.rackPlant(pl.next, 'algae', 9999, t0 + 1).ok);
  const mid = K.rackPhase(pl.next, t0 + 90000); ok('half way: growing, 50%, 1:30 left', mid.phase === 'growing' && Math.abs(mid.p - 0.5) < 1e-9 && K.mmss(mid.ms) === '1:30');
  ok('label shows the countdown', K.rackLabel(pl.next, t0 + 90000).includes('1:30 left'));
  ok('harvest while growing is refused with time left', /Not ripe yet\. 1:30/.test(K.rackHarvest(pl.next, 1, 0, t0 + 90000).msg));
  const ready = t0 + 180000; ok('ready label', K.rackLabel(pl.next, ready) === '🌱 Your rack · 5 Potatoes ready');
  const clean = K.rackHarvest(pl.next, 0.9, 0.06, ready); ok('no raid: keep it all', clean.ok && !clean.raided && clean.n === 5);
  const raid = K.rackHarvest(pl.next, 0.01, 0.06, ready); ok('raid: half seized (rounded up)', raid.ok && raid.raided && raid.lost === 3 && raid.n === 2);
  ok('raid risk is small and capped', K.raidChance(0) === K.RACK.raidBase && K.raidChance(0) < 0.1 && K.raidChance(9, 3) === K.RACK.raidMax);
  ok('every plant/harvest outcome has a message', [broke, pl].every(r => r.msg.length > 5));
}
{
  const m = read('mars/hydroden.js');
  const ids = [...m.matchAll(/api\.spot\(\{ id: '(hd:[a-z]+)'/g)].map(x => x[1]);
  ok('every den spot id has an act() branch', ids.length >= 3 && ids.every(id => m.includes(`sid === '${id}'`)), ids);
  ok('racks open the rack panel (not flavour text) and toast', /sid === 'hd:racks'\) \{ const ok = open\('rack'\); .*toast\(/.test(m));
  ok('rack save key is in the save-code list', read('savecode.js').includes(`'${K.RACK_KEY}'`));
  ok('Nettle prompt says Talk to Sister Nettle', m.includes('Talk to ${K.DEALER}'));
}

// v7.5.32: Nettle buys (cash)
for (const d of K.DRUG_IDS) ok(`${d}: fence price is a bit under Blue's and never over 80% of street`, K.fencePrice(d) < K.DRUGS[d].cost && K.fencePrice(d) >= K.DRUGS[d].cost * 0.85 && K.fencePrice(d, 20) <= 16);
for (const g of [...K.CROP_IDS, ...K.SHINE_IDS]) {
  ok(`${g}: cash price is slightly under its swap value`, K.goodCash(g) < K.goodValue(g) && K.goodCash(g) >= K.goodValue(g) * 0.85);
  for (const d of K.DRUG_IDS) { const q = K.quote(g, 10, d, 99); if (q.ok) ok(`no loop: ${g} -> ${d} -> cash pays no more than selling ${g}`, q.units * K.fencePrice(d) + q.change <= q.take * K.goodValue(g)); }
}
ok('saleQuote sell 1 / sell all / none', K.saleQuote(5, 1, 36).total === 36 && K.saleQuote(5, 'all', 36).qty === 5 && !K.saleQuote(0, 1, 36, 'X').ok && /not holding any X/.test(K.saleQuote(0, 1, 36, 'X').msg));
ok('full banner text', K.pocketsFull({ used: 20, max: 20 }) && !K.pocketsFull({ used: 19, max: 20 }) && K.fullBanner({ used: 20, max: 20 }) === 'Pockets full (20/20) — sell some product below to make room');
{ const m = read('mars/hydroden.js');
  ok('panel has sell 1 / sell all for product and goods + the banner', /data-sell=/.test(m) && /data-cash=/.test(m) && /data-q="all"/.test(m) && /data-full/.test(m));
  ok('greyed swap buttons still answer a tap (no disabled attr)', !/'disabled'/.test(m.split('function render()')[1].split('function renderRack')[0]) && /b\.dataset\.no/.test(m));
  ok('product sales roll the same wire as swaps', /function sellDrug[\s\S]*K\.heatChance\(got/.test(m)); }
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
