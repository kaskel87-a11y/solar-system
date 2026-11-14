// Prompt scheduler: one note every few game hours, loyalty, skim, crime steps.
import * as E from '../mars/empirepromptcore.js';
let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };

const front = { id: 'fr-wash', name: 'Red Dust Wash & Fold', kind: 'laundromat', pending: 400, cap: 450, x: 10, z: 20 };
const world = { fronts: [front], velvet: { x: 1, z: 2, name: 'Velvet office' }, crew: [{ id: 'dex', name: 'Dex Malone' }], spots: { truck: { x: -40, z: 50 }, drop: { x: 60, z: 0 } } };

let s = E.fresh();
let r = E.tickHour(s, 10, world);
ok('first hour only baselines', r.prompt === null && s.hour === 10);
r = E.tickHour(s, 12, world);
ok('two hours is not enough', r.prompt === null && s.wait === 2);
r = E.tickHour(s, 15, world);
ok('full till prompts after three hours', r.prompt && r.prompt.kind === 'till' && /Come collect/.test(r.prompt.text));
ok('only one note at a time', E.tickHour(s, 19, world).prompt === null);
E.dismiss(s);
r = E.tickHour(s, 19, { ...world, fronts: [{ ...front, pending: 10, cap: 450 }] });
ok('next note waits another three hours', r.prompt === null);
r = E.tickHour(s, 22, { ...world, fronts: [{ ...front, pending: 10, cap: 450 }] });
ok('then a crime note', r.prompt && r.prompt.job && r.prompt.job.steps.length >= 1);

const crew = E.fresh();
crew.hour = 1;
crew.crew.dex = { loyalty: 70, since: 0 };
const skimWorld = { fronts: [{ ...front, pending: 200, cap: 450 }], crew: [{ id: 'dex', name: 'Dex Malone' }] };
E.tickHour(crew, 8, skimWorld);
ok('ignoring Dex drops loyalty', crew.crew.dex.loyalty < 70 && crew.crew.dex.since >= 6);
const low = E.fresh();
low.hour = 1;
low.crew.dex = { loyalty: 30, since: 8 };
const sk = E.tickHour(low, 2, skimWorld);
ok('low loyalty skims a tenth of the till', sk.skims.length === 1 && sk.skims[0].take === 20);
E.visit(low, 'dex');
ok('a visit lifts loyalty and clears the absence', low.crew.dex.loyalty > 30 && low.crew.dex.since === 0);

const job = E.startJob('truck', world.spots, world);
ok('truck has two steps and a payout', job.steps.length === 2 && job.pay === 1600 && /armored truck|Hit it/.test(job.steps[0].text));
let j = E.nearJob(job, 0, 0);
ok('far away does not advance', !j.advanced);
j = E.nearJob(job, job.steps[0].x, job.steps[0].z);
ok('standing on the truck advances', j.advanced && !j.done && j.step === 1);
j = E.nearJob(j, j.steps[1].x, j.steps[1].z);
ok('the drop pays', j.done && j.paid === 1600);
const marks = E.mapMarks({ job, prompt: null });
ok('the active crime is a map mark', marks.length === 1 && marks[0].cat === 'crime' && marks[0].icon === '🚛');
ok('every crime has a payout and a step', ['racket', 'truck', 'chop', 'smuggle', 'defend', 'skim'].every(k => E.PAY[k] > 0 && E.startJob(k, world.spots, world).steps.every(s => s.text && Number.isFinite(s.x))));
const hold = E.startJob('defend', world.spots, world);
let h = E.nearJob(hold, hold.steps[0].x, hold.steps[0].z, 3);
ok('holding the door is not done at 3s', !h.done && !h.advanced);
h = E.nearJob(h, h.steps[0].x, h.steps[0].z, 5);
ok('holding the door pays after 8s', h.done && h.paid === 750);

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all good');
