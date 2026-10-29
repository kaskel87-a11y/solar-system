// node tests/test-empire-unit.mjs: pure checks for empirecore.js (clock + income curves, caps, offline, buy/collect, threats from
// rep + turf, extortion vs raid, waves, losses, the context button) plus the wiring rules (one hook line per core file, import map,
// precache, no onclick, README, no real brands).
import * as E from '../empirecore.js';
import { readFileSync } from 'fs';
let pass = 0, fail = 0; const t = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, e = 0.6) => Math.abs(a - b) <= e;
// catalogue
t('7 properties', E.PROPS.length === 7); t('3 safehouses', E.PROPS.filter(p => p.kind === 'safehouse').length === 3);
t('4 fronts, one of each', ['laundromat', 'bar', 'chop', 'dispensary'].every(k => E.PROPS.filter(p => p.kind === k).length === 1));
t('fronts span the districts', new Set(E.PROPS.filter(E.isFront).map(p => p.district)).size === 4);
t('safehouses have garage spots', E.PROPS.filter(p => p.kind === 'safehouse').every(p => Array.isArray(p.garage)));
t('unique ids', new Set(E.PROPS.map(p => p.id)).size === 7); t('propById', E.propById('fr-bar')?.kind === 'bar' && E.propById('nope') === null);
t('every district has a crew', E.PROPS.every(p => E.GANGS[E.DISTRICT_GANG[p.district]]));
t('save key', E.SAVE_KEY === 'ssx.empire.v1');
// clock
t('bands', E.timeBand(3) === 'night' && E.timeBand(6) === 'dawn' && E.timeBand(12) === 'day' && E.timeBand(19) === 'dusk' && E.timeBand(22) === 'night');
t('hoursBetween', near(E.hoursBetween(10, 12.5), 2.5, 1e-9)); t('wraps midnight', near(E.hoursBetween(23, 1), 2, 1e-9));
t('big jump capped', E.hoursBetween(1, 0.5) === E.RULES.maxStepHours); t('junk -> 0', E.hoursBetween(NaN, 3) === 0);
t('bar earns at night', E.rateAt('bar', 23) > E.rateAt('bar', 12) * 3); t('laundromat earns by day', E.rateAt('laundromat', 12) > E.rateAt('laundromat', 2) * 2);
t('dispensary dusk peak', E.rateAt('dispensary', 19) === Math.max(...[2, 6, 12, 19].map(h => E.rateAt('dispensary', h))));
t('safehouse earns nothing', E.rateAt('safehouse', 12) === 0 && E.earn('safehouse', 0, 5) === 0);
t('avgRate bar ~72', near(E.avgRate('bar'), 71.6, 1)); t('cap = 10 h base', E.capOf('bar') === 700);
t('earn splits band edges', near(E.earn('bar', 20, 2), 70 * 1.3 + 70 * 1.8, 0.5)); t('earn 0 h', E.earn('bar', 3, 0) === 0);
t('fmtClock', E.fmtClock(7.5) === '07:30' && E.fmtClock(23.99) === '23:59');
// save + offline
const f = E.fresh(1000); t('fresh', f.v === 1 && Object.keys(f.owned).length === 0 && f.threat === null);
t('migrate junk', E.migrate('{oops').v === 1 && E.migrate({ v: 99 }).v === 1);
const mg = E.migrate(JSON.stringify({ v: 1, owned: { 'fr-bar': { pending: 50 }, ghost: {} }, threat: { prop: 'ghost' }, stats: { paid: 5 } }));
t('migrate drops unknown', !mg.owned.ghost && mg.owned['fr-bar'].pending === 50 && mg.threat === null && mg.stats.paid === 5 && mg.stats.defended === 0);
const off = E.fresh(0); E.buy(off, 'fr-bar'); E.buy(off, 'sh-rim'); off.lastAt = 0; let r = E.offline(off, 60 * 120000);
t('offline capped at 8 h', near(r.hours, 8, 1e-9) && near(r.total, E.avgRate('bar') * 8, 1)); t('offline skips safehouses', off.owned['sh-rim'].pending === 0);
t('offline stamps lastAt', off.lastAt === 60 * 120000); r = E.offline(off, 60 * 120000); t('offline again = 0', r.total === 0);
// buy / accrue / collect
const s = E.fresh(); t('canBuy needs money', !E.canBuy(s, 'fr-bar', 100).ok && E.canBuy(s, 'fr-bar', 3500).ok); E.buy(s, 'fr-bar');
t('canBuy twice', !E.canBuy(s, 'fr-bar', 1e6).ok); t('new property has grace', s.owned['fr-bar'].graceH === E.RULES.graceHours);
let got = E.accrue(s, 21, 2); t('accrue night', near(got, 70 * 1.8 * 2, 0.5) && near(s.owned['fr-bar'].pending, got, 1e-9));
t('grace counts down', near(s.owned['fr-bar'].graceH, 1, 1e-9)); t('clockH counts', near(s.clockH, 2, 1e-9));
E.accrue(s, 23, 8); E.accrue(s, 7, 8); t('till capped', s.owned['fr-bar'].pending === E.capOf('bar'));
t('perHour', E.perHour(s, 22) === 126 && E.perHour(s, 12) === Math.round(70 * 0.45)); const n = E.collect(s, 'fr-bar');
t('collect floors', n === 700 && s.owned['fr-bar'].pending === 0 && s.earned === 700 && s.stats.collected === 700); t('collect unowned 0', E.collect(s, 'fr-disp') === 0);
s.owned['fr-bar'].closedH = 2; got = E.accrue(s, 22, 1); t('closed earns nothing', got === 0 && s.owned['fr-bar'].closedH === 1); t('closed out of perHour', E.perHour(s, 22) === 0);
t('costs', E.securityCost(E.propById('fr-bar')) === 1230 && E.repairCost(E.propById('fr-bar')) === 700);
// threats
const bar = E.propById('fr-bar'), o = E.ownedState(); const base = E.threatChance(bar, o, {});
t('base chance', near(base, E.KINDS.bar.threat, 1e-9)); t('grace = safe', E.threatChance(bar, { ...o, graceH: 1 }, {}) === 0); t('closed = safe', E.threatChance(bar, { ...o, closedH: 1 }, {}) === 0);
t('hostile rep raises it', E.threatChance(bar, o, { rep: -70 }) > base * 2); t('friendly rep lowers it', E.threatChance(bar, o, { rep: 70 }) < base * 0.5);
t('rep tiers monotone', [-80, -40, -15, 0, 20, 40, 80].map(E.repMul).every((v, i, a) => !i || v <= a[i - 1])); t('no rep -> 1', E.repMul(null) === 1);
t('your block is safer', E.threatChance(bar, o, { turf: { owner: 'player' } }) < base); t('grudge angers', E.threatChance(bar, o, { grudge: 2 }) > base);
t('night riskier', E.threatChance(bar, o, { night: true }) > base); t('security halves', near(E.threatChance(bar, { ...o, security: true }, {}), base / 2, 1e-9));
t('protection from that crew', E.threatChance(bar, { ...o, protect: { gang: 'saints', h: 5 } }, {}) === 0); t('protection from another crew', E.threatChance(bar, { ...o, protect: { gang: 'dustjaws', h: 5 } }, {}) > 0);
t('capped', E.threatChance(bar, o, { rep: -100, grudge: 9, night: true }) <= 0.5);
t('gang: turf owner', E.gangFor(bar, { owner: 'dustjaws' }) === 'dustjaws'); t('gang: who lost your block', E.gangFor(bar, { owner: 'player', lostBy: 'saltblood' }) === 'saltblood');
t('gang: district default', E.gangFor(bar, null) === 'saints' && E.gangFor(E.propById('fr-wash'), null) === 'dustjaws');
t('safehouses only raided', E.threatKind(E.propById('sh-rim'), 50, 0) === 'raid'); t('friendly crews ask first', E.threatKind(bar, 20, 0.7) === 'extort' && E.threatKind(bar, -50, 0.7) === 'raid');
t('demand range', [bar, E.propById('fr-wash')].every(p => { const d = E.demand(p, { pending: 0 }); return d >= 100 && d <= 900 && d % 10 === 0; }));
t('waves', E.wavePlan(bar).length === 3 && E.wavePlan(E.propById('fr-wash')).length === 2 && E.wavePlan(bar, { rep: -70 }).length === 4 && E.wavePlan(bar, { security: true }).length === 2);
t('phone waves smaller', E.wavePlan(bar, { mobile: true }).every(w => w.count <= 4) && E.wavePlan(bar).every(w => w.count <= 6));
t('reward', E.defendReward(bar, 3) > E.defendReward(E.propById('fr-wash'), 2));
// rollThreat
const rs = E.fresh(); E.buy(rs, 'fr-wash'); rs.owned['fr-wash'].graceH = 0; rs.clockH = 10;
let th = E.rollThreat(rs, () => ({ rep: 30 }), () => 0); t('roll hits', th && th.prop === 'fr-wash' && th.kind === 'extort' && th.phase === 'demand' && th.demand >= 100 && th.limit === E.RULES.replyS);
th = E.rollThreat(rs, () => ({ rep: -50, mobile: true }), (() => { let k = 0; return () => (k++ ? 0.9 : 0); })()); t('roll raid on phone', th?.kind === 'raid' && th.phase === 'alert' && th.limit === E.RULES.arriveSPhone);
t('roll misses', E.rollThreat(rs, () => ({}), () => 0.99) === null); rs.threat = th; t('one at a time', E.rollThreat(rs, () => ({}), () => 0) === null); rs.threat = null;
rs.lastThreatH = 9; t('gap between threats', E.rollThreat(rs, () => ({}), () => 0) === null);
// losses
const ls = E.fresh(); E.buy(ls, 'fr-bar'); ls.owned['fr-bar'].pending = 333.7; let L = E.applyLoss(ls, 'fr-bar');
t('front loss: till + shut', L.lost === 333 && ls.owned['fr-bar'].pending === 0 && ls.owned['fr-bar'].closedH === E.RULES.closedHours && ls.stats.lost === 1);
E.buy(ls, 'sh-rim'); ls.owned['sh-rim'].stash.credits = 1000; L = E.applyLoss(ls, 'sh-rim'); t('safehouse loss: share of stash', L.stash && L.lost === 300 && ls.owned['sh-rim'].stash.credits === 700);
// context button
const sh = E.propById('sh-rim'), cs = E.propById('fr-chop'), ow = E.ownedState();
t('buy at the door', E.contextFor({ prop: bar, d: 3 })?.key === 'buy'); t('too far', E.contextFor({ prop: bar, d: 20 }) === null); t('busy', E.contextFor({ prop: bar, d: 1, busy: true }) === null);
t('collect', E.contextFor({ prop: bar, d: 2, owned: { ...ow, pending: 50.4 } })?.label === '💵 +50'); t('office when empty', E.contextFor({ prop: bar, d: 2, owned: ow })?.key === 'manage');
t('repair when shut', E.contextFor({ prop: bar, d: 2, owned: { ...ow, closedH: 3 } })?.key === 'repair'); t('rest at safehouse', E.contextFor({ prop: sh, d: 2, owned: ow })?.key === 'rest');
t('garage spot', E.contextFor({ prop: sh, d: 9, garageD: 2, owned: ow })?.key === 'garage' && E.contextFor({ prop: sh, d: 9, garageD: 2, owned: ow, garageOpen: true }).label === '🔧 Garage');
t('garage needs owning', E.contextFor({ prop: sh, d: 9, garageD: 2 }) === null);
t('strip a stolen ride', E.contextFor({ prop: cs, d: 5, owned: ow, driving: true, stolen: true })?.key === 'chopRide'); t('not your rover', E.contextFor({ prop: cs, d: 5, owned: ow, driving: true }) === null);
t('not while moving', E.contextFor({ prop: cs, d: 5, owned: ow, driving: true, stolen: true, speed: 10 }) === null);
t('defend beats all', E.contextFor({ prop: bar, d: 30, owned: ow, threat: { prop: 'fr-bar', phase: 'alert' }, driving: true, speed: 20 })?.key === 'defend');
t('no defend during demand', E.contextFor({ prop: bar, d: 30, owned: ow, threat: { prop: 'fr-bar', phase: 'demand' } }) === null);
// wiring
const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const idx = rd('index.html'), sw = rd('sw.js'), world = rd('world.js'), game = rd('game.js'), surf = rd('surface.js'), src = rd('empire.js'), core = rd('empirecore.js');
t('index.html: one import line', (idx.match(/import '\.\/empire\.js'/g) || []).length === 1);
t('import map entries', /"\.\/empire\.js": "\.\/empire\.js\?v=/.test(idx) && /"\.\/empirecore\.js": "\.\/empirecore\.js\?v=/.test(idx));
t('sw.js: one precache line', sw.split('\n').filter(l => /empire/.test(l)).length === 1 && /'empire', 'empirecore'/.test(sw));
t('no version / cache bump', /const BUILD = 1;/.test(sw));
t('game.js / world.js / surface.js untouched', ![game, world, surf].some(x => /empire/i.test(x)));
t('no onclick', !/\.onclick\s*=|addEventListener\('click'/.test(src)); t('pointerup checks pointerId', /e\.pointerId !== pid/.test(src));
t('desktop key Backslash', /Backslash/.test(src)); t('menu entry', /registerMenuItem\(\{ id: 'rmEmpire'/.test(src));
t('npc budget respected', /npcBudget/.test(src)); t('save key used', /EC\.SAVE_KEY/.test(src));
t('guards: rep, turf, raids, base, garage, time', ['SSX()?.rep', 'SSX()?.turf', 'SSX()?.raids', 'SSX()?.base', 'SSX()?.garage', 'SSX()?.time'].every(k => src.includes(k)));
t('readme documents SSX.empire', /SSX\.empire/.test(rd('README.md')) && /ssx\.empire\.v1/.test(rd('README.md')));
t('no real brands', !/\b(Starbucks|Budweiser|Heineken|Tide|Maytag|Whirlpool|Jiffy|AutoZone|Pep Boys|NAPA|Planet 13|MedMen|Curaleaf|Trulieve|Hilton|Marriott)\b/i.test(src + core));
console.log(`empire unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
