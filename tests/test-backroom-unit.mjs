// Back-room deal rules: prices, suspicion, busts, and the four invented goods.
import * as B from '../mars/backroomcore.js';
let bad = 0;
const ok = (n, c) => { if (!c) { bad++; console.log('FAIL', n); } else console.log('ok  ', n); };

ok('four invented goods', B.GOOD_IDS.join() === 'glowcap,redhaze,iondust,slowtime');
ok('names stay invented', ['Glowcap', 'Red Haze', 'Ion Dust', 'Slowtime'].every(n => Object.values(B.GOODS).some(g => g.name === n)));
ok('each effect is different', new Set(B.GOOD_IDS.map(id => B.GOODS[id].effect)).size === 4);
ok('each effect has a crash', B.GOOD_IDS.every(id => B.GOODS[id].secs > 0 && B.GOODS[id].crash > 0));

const packed = B.packOne({}, 'glowcap', 1);
ok('glow-dust packs into Glowcap', packed.ok && packed.take === 1 && packed.pack.glowcap === 1);
ok('short stash does not pack', B.packOne({}, 'redhaze', 0).ok === false);

let deal = B.startDeal('glowcap');
ok('a deal starts by picking a price', deal.step === 'price' && B.stepText(deal).startsWith('Pick a price'));
const low = B.pickPrice(deal, 'low');
const greedy = B.pickPrice(deal, 'greedy');
ok('greedy pays more and adds more heat', greedy.pay > low.pay && greedy.heat > low.heat && greedy.heat < B.HEAT_MAX);
let hot = B.pickPrice(deal, 'fair');
hot = B.tickDeal(hot, 4, false);
ok('a few seconds still lets you hand off', hot.heat < B.HAND_AT && B.handoff(hot).ok && B.handoff(hot).text.startsWith('Paid'));
hot = B.tickDeal(hot, 6, true);
ok('lingering in sight fills the bar', hot.step === 'busted' || hot.heat >= B.HEAT_MAX);
const glanced = B.glance({ ...low, step: 'handoff', heat: 40 });
ok('a glance drops suspicion', glanced.heat === 40 - B.GLANCE);
ok('too hot to hand off', B.handoff({ ...low, step: 'handoff', heat: 80 }).why === 'hot');
ok('bust can take the stash, a fine, or a fight', B.bustKind(0.1) === 'stash' && B.bustKind(0.5) === 'fine' && B.bustKind(0.9) === 'fight' && B.bust(deal, 0.5).fine === B.FINE);

const fx = B.useGood('iondust', 10);
ok('use starts the effect', B.fxAt(fx, 10).phase === 'on' && B.fxAt(fx, 10).kind === 'rush');
ok('then the crash', B.fxAt(fx, 10 + B.GOODS.iondust.secs + 1).phase === 'crash');
ok('then it is gone', B.fxAt(fx, 10 + B.GOODS.iondust.secs + B.GOODS.iondust.crash + 1) === null);
const step = B.lesson({}, { name: 'Velvet Airlock', x: 3, z: 4 });
ok('first step is plain', step.text.startsWith('Pack a street good') && step.x === 3);
ok('then the booth', B.lesson({ glowcap: 1 }, { name: 'Velvet Airlock', x: 1, z: 2 }).text.includes('back booth'));

if (bad) { console.log(bad + ' failed'); process.exit(1); }
console.log('all good');
