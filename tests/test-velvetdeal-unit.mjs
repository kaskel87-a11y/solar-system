// v7.5.26 unit test for mars/velvetdealcore.js (Danny takes product, Ines's side deal) + its wiring. node tests/test-velvetdeal-unit.mjs
import * as V from '../mars/velvetdealcore.js';
import { readFileSync } from 'fs';
let fails = 0; const ok = (name, c) => { if (!c) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// Danny: product prices
ok('show + lap priced for all 4 house products', V.PRODUCT_ORDER.every(id => V.DANNY_PRODUCT.show[id] > 0 && V.DANNY_PRODUCT.lap[id] >= V.DANNY_PRODUCT.show[id]));
ok('nothing held -> no options', V.payOptions('show', {}, 0, 0).length === 0);
const o1 = V.payOptions('show', { glowdust: 7 }, 0, 0);
ok('7 glow-dust pays the private dance', o1.length === 1 && o1[0].kind === 'product' && o1[0].item === 'glowdust' && o1[0].qty === 7 && /Private dance/.test(o1[0].label));
ok('1 glow-dust is not enough alone', !V.payOptions('show', { glowdust: 1 }, 0, 0).some(o => o.kind === 'product'));
const o2 = V.payOptions('show', { glowdust: 3 }, 285, 0);
ok('3 glow-dust + 285 cr split', o2.length === 1 && o2[0].kind === 'split' && o2[0].cr === 285 && o2[0].qty === 3);
ok('split needs the cash', V.payOptions('show', { glowdust: 3 }, 200, 0).length === 0);
ok('falls back to the next product held', V.payOptions('lap', { redstatic: 4 }, 0, 0)[0]?.item === 'redstatic' && V.payOptions('lap', { voidhoney: 2 }, 0, 0)[0]?.item === 'voidhoney');
ok('lap uses lap prices', V.payOptions('lap', { glowdust: 7 }, 0, 0)[0]?.qty === 7 && /Lap dance/.test(V.payOptions('lap', { glowdust: 7 }, 0, 0)[0].label));
ok('comp listed first', V.payOptions('show', { glowdust: 5 }, 999, 1)[0].kind === 'comp');
ok('junk stash values are safe', V.payOptions('show', { glowdust: 'x', lowg: -4 }, NaN, 0).length === 0);
ok('price hint names both', /show/.test(V.priceHint()) && /lap/.test(V.priceHint()));
// Ines buyout
ok('buyout lots: house products, credits, cooldowns', V.BUYOUT.length === 4 && V.BUYOUT.every(b => V.PRODUCT_ORDER.includes(b.item) && b.credits > 0 && b.cooldownSec >= 300 && b.id.startsWith('ines-side-')));
ok('glow-dust lot beats a Flats corner (~71/u), under Helios (~166/u)', V.BUYOUT[0].credits / V.BUYOUT[0].qty > 95 && V.BUYOUT[0].credits / V.BUYOUT[0].qty < 166);
// jobs
ok('3 jobs, ids feed rep.js /^ines-/', V.JOBS.length === 3 && V.JOBS.every(j => /^ines-side-/.test(j.id) && j.credits > 0 && j.steps.length >= 2));
const CORE_STEPS = new Set(['goto', 'defeat', 'take', 'clean']);
ok('only core-engine step types', V.JOBS.every(j => j.steps.every(s => CORE_STEPS.has(s.type) && s.text)));
ok('defeat waves are human types', V.JOBS.flatMap(j => j.steps).filter(s => s.type === 'defeat').every(s => s.wave.every(w => ['goon', 'enforcer'].includes(w))));
const d = V.missionDef(V.JOBS[0]); ok('missionDef shape for game.registerMission', d.world === 'Mars' && d.contact === 'Ines' && d.title && d.reward.credits === 200 && Array.isArray(d.steps) && d.steps !== V.JOBS[0].steps);
// state
const s0 = V.loadState(null); ok('fresh', s0.v === 1 && s0.next === 0 && s0.comps === 0);
ok('garbage -> fresh', V.loadState('{nope').next === 0 && V.loadState({ v: 2, comps: 9 }).comps === 0);
ok('sanitised', V.loadState({ v: 1, next: 7, comps: -3, runs: 2.9 }).next === 1 && V.loadState({ v: 1, comps: -3 }).comps === 0 && V.loadState({ v: 1, runs: 2.9 }).runs === 2);
let s = s0, r;
r = V.finishJob(s, 'ines-side-case'); ok('job 1 -> next is job 2, no comp', r.s.next === 1 && !r.comp && r.s.runs === 1); s = r.s;
r = V.finishJob(s, 'ines-side-debt'); s = r.s; r = V.finishJob(s, 'ines-side-deputy');
ok('job 3 closes the loop + comp', r.comp && r.s.next === 0 && r.s.comps === 1 && r.s.chains === 1); s = r.s;
ok('unknown id is a no-op', V.finishJob(s, 'nope').s.runs === s.runs);
ok('nextJob', V.nextJob(s).id === 'ines-side-case');
ok('useComp', V.useComp(s).comps === 0 && V.useComp(s).usedComps === 1 && V.useComp(V.fresh()) === null);
ok('topUp', V.topUp(400, 100) === 300 && V.topUp(400, 400) === 0 && V.topUp(400, 900) === 0 && V.topUp(undefined, 5) === 0);
// tone: M-rated, no sexual content in the lines
const all = V.JOBS.map(j => j.intro + j.success + j.steps.map(x => x.text).join(' ')).join(' ').toLowerCase();
ok('no sexual content', !/\b(sex|nude|naked|topless|porn)\b/.test(all));
// wiring
const ps = src('privateshow.js'), vd = src('mars/velvetdeal.js'), idx = src('index.html'), sw = src('sw.js');
ok('privateshow imports the core (no ?v=)', /from '\.\/mars\/velvetdealcore\.js'/.test(ps) && !/velvetdealcore\.js\?v=/.test(ps));
ok('privateshow credit prices are 500', /SHOW_PRICE = 500, LAP_PRICE = 500/.test(ps));
ok('60s show and one encore', /SHOW_SEC = 60, LAP_SEC = 60/.test(ps) && /ENCORE_SEC = 10/.test(ps));
ok('product buttons bound with onTap', /onTap\(b, \(\) => payProd\(mode, o\)\)/.test(ps));
ok('velvetdeal uses registerOffer + registerMission + accept', /registerOffer\(/.test(vd) && /registerMission\(/.test(vd) && /\.accept\(/.test(vd));
ok('index.html loads velvetdeal + map entry', /src="\.\/mars\/velvetdeal\.js\?v=/.test(idx) && /"\.\/mars\/velvetdealcore\.js": /.test(idx));
ok('sw.js precaches both', /mars\/velvetdeal\.js\$\{q\}/.test(sw) && /mars\/velvetdealcore\.js\$\{q\}/.test(sw));
// v7.5.27 Ines buys bottles (no cap)
const inv = [{ id: 'potato-shine', name: 'Potato Moonshine', qty: 9 }, { id: 'x', qty: 0 }, { id: 'y', qty: 2 }];
const bq = V.shineQuote(inv, it => it.id === 'potato-shine' ? 50 : it.id === 'y' ? 0 : 0);
ok('shineQuote: 9 potato shine at 1.2x', bq.n === 9 && bq.rows.length === 1 && bq.rows[0].each === 60 && bq.total === 540);
ok('shineQuote: no cap', V.shineQuote([{ id: 'a', qty: 200 }], () => 40).n === 200);
ok('shineQuote: junk safe', V.shineQuote(null, null).n === 0 && V.shineQuote([{ id: 'a', qty: 'z' }], () => 10).n === 0);
ok('Ines under Nova per bottle, over the aliens', V.SHINE.mult > 1 && V.SHINE.mult < 1.3);
ok('shine rep', V.shineRep(4) === 0 && V.shineRep(9) === 1 && V.shineRep(20) === 4 && V.shineRep(99) === 4);
ok('shine label', /9 you carry/.test(V.shineLabel(bq)) && /540 cr/.test(V.shineLabel(bq)) && /no daily cap/.test(V.shineLabel({ n: 0 })));
ok('state keeps bottle counters', V.loadState({ v: 1, bottles: 9, bottleCr: 540 }).bottles === 9);
ok('velvetdeal registers ines-side-shine via bar.js liquorAdapter', /id: 'ines-side-shine'/.test(vd) && /from '\.\.\/bar\.js'/.test(vd));
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
