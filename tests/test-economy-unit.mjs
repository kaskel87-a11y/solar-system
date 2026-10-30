// money boost: payout multiplier, back-to-back streak bonus, knocked-out NPC drops (economycore.js + economy.js)
import { PAYOUT_MULT, STREAK, scalePay, streakStep, dropCredits, streakLine, dropLine } from '../economycore.js';
let n = 0, bad = 0; const ok = (k, c, v) => { n++; if (!c) { bad++; console.log('FAIL', k, v ?? ''); } else console.log('ok  ', k, v ?? ''); };
// ---- multiplier
ok('default mult is 2', PAYOUT_MULT === 2);
ok('300 -> 600', scalePay(300) === 600); ok('25% repeat 75 -> 150', scalePay(75) === 150);
ok('zero / costs / junk untouched', scalePay(0) === 0 && scalePay(-40) === -40 && scalePay(undefined) === 0 && scalePay(NaN) === 0);
ok('tunable 1.5 rounds', scalePay(125, 1.5) === 188); ok('bad mult falls back to 1x', scalePay(100, 0) === 100 && scalePay(100, 'x') === 100);
// ---- streak
let st, r; const seq = [];
for (const t of [0, 60, 120, 180, 240, 300, 360]) { r = streakStep(st, t); st = r.st; seq.push(r.bonus); }
ok('back to back: 0, 25, 50, 75, 100, capped 100', seq.join() === '0,25,50,75,100,100,100', seq.join());
r = streakStep(st, 360 + STREAK.windowS + 1); ok('gap over 4 min resets, no bonus', r.bonus === 0 && r.st.n === 0); st = r.st;
r = streakStep(st, st.lastAt + 5); ok('same job paying twice (5 s) neither counts nor pays', !r.counted && r.bonus === 0 && r.st === st);
r = streakStep(st, st.lastAt + 30); ok('next real job inside 4 min: +25', r.bonus === 25);
ok('plain-word streak line', /3 jobs back to back: \+50 cr bonus/.test(streakLine(2, 50)), streakLine(2, 50));
// ---- drops
ok('drop ends 20 and 80', dropCredits(0) === 20 && dropCredits(0.9999999) === 80 && dropCredits(1) === 80 && dropCredits(-1) === 20);
let lo = 99, hi = 0; for (let i = 0; i < 20000; i++) { const c = dropCredits(Math.random()); lo = Math.min(lo, c); hi = Math.max(hi, c); if (!Number.isInteger(c)) { lo = -1; break; } }
ok('20000 rolls stay in 20-80 and hit both ends', lo === 20 && hi === 80, `${lo}-${hi}`);
ok('drop line', dropLine(43, 'colonist') === '💵 Picked 43 cr off the colonist.' && /3 people/.test(dropLine(120, 'x', 3)));
// ---- runtime (economy.js) with a fake game
const P = { credits: 0 }; let toasts = []; globalThis.__app = { game: { progress: P, save() {} }, toast: m => toasts.push(m), surface: { info: { x: 0, z: 0 } } };
const E = await import('../economy.js'); const X = globalThis.SSX.economy;
ok('SSX.economy installed, one knob', X && X.payoutMult === 2 && typeof X.job === 'function');
X.debug.reset(); P.credits = 0;
// a side job: game.js complete() pays the base once, runner tops up once without a second streak tick -> exactly 2x total
const base = X.job(50, 'quest:act-door-shift'); P.credits += base; const top = E.jobPay(14, 'activity:act-door-shift', { streak: false }); P.credits += top;
ok('side job base+top = 2 x 64 (nothing doubled twice)', P.credits === 128, P.credits);
X.debug.ageStreak(60); P.credits = 0; const taxi = X.job(80, 'jobs:taxi'); ok('2nd job within 4 min: 160 pay + 25 streak credited', taxi === 160 && P.credits === 25, `${taxi} ${P.credits}`);
X.payoutMult = 1.5; ok('live retune via SSX.economy.payoutMult', X.job(100, 'x') === 150 && X.boost(100) === 150); X.payoutMult = 2;
// drops
P.credits = 0; const npc = { kind: 'colonist', x: 1, z: 1 }; const c1 = X.npcDown(npc), c2 = X.npcDown(npc);
ok('KO drop 20-80 once per NPC', c1 >= 20 && c1 <= 80 && c2 === 0 && P.credits === c1, `${c1} ${c2}`);
ok('duel fighters / contacts drop nothing', X.npcDown({ kind: 'colonist', fighter: {} }) === 0 && X.npcDown({ kind: 'contact' }) === 0);
console.log(`${n - bad}/${n} passed`); process.exit(bad ? 1 : 0);
