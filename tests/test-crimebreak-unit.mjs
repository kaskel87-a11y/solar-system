// node tests/test-crimebreak-unit.mjs — crimebreakcore + crewcore pay bonus hook (v7.5.75)
import * as C from '../mars/crimebreakcore.js';
import * as Crew from '../crewcore.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

ok(C.KEY === 'ssx.crimebreak.v1' && C.COST_CR === 500 && C.STAR_PAY === 80 && C.BUFF_STEP === 0.05 && C.BUFF_CAP === 0.25, 'constants');
ok(C.load('junk').meets === 0 && C.payBonus(C.fresh()) === 0, 'bad save -> fresh, no buff');

const s = C.fresh();
ok(!C.canStart(s, { crew: 0, atGulch: true, credits: 9999, sol: 0 }).ok && C.canStart(s, { crew: 0, atGulch: true }).needCrew, 'no crew blocks, explains hire');
ok(!C.canStart(s, { crew: 1, atGulch: false, credits: 9999, sol: 0 }).ok, 'not at gulch');
const intro = C.canStart(s, { crew: 1, atGulch: true, credits: 0, sol: 0 });
ok(intro.ok && intro.intro && intro.cost === 0, 'first meeting is free intro');

let paid = 0;
const r1 = C.complete(s, { sol: 3, credits: 0, pay: n => { paid += n; return { ok: true }; } });
ok(r1.ok && r1.intro && r1.cost === 0 && paid === 0 && r1.stars === 80 && s.meets === 1 && s.buff === 0.05 && s.lastSol === 3, 'intro completes: +80⭐, +5% buff, no cr');

ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 3 }).ok, 'same sol blocked');
ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 3.9 }).ok, 'partial sol blocked');
ok(/sol 4/.test(C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 3 }).why || ''), 'cooldown message names next sol');

ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 100, sol: 4 }).ok && C.canStart(s, { crew: 1, atGulch: true, credits: 100, sol: 4 }).short, 'short on buy-in');
const ready = C.canStart(s, { crew: 1, atGulch: true, credits: 500, sol: 4 });
ok(ready.ok && !ready.intro && ready.cost === 500, 'next sol ready with buy-in');

const r2 = C.complete(s, { sol: 4, credits: 500, pay: n => { paid += n; return { ok: true }; } });
ok(r2.ok && r2.cost === 500 && paid === 500 && s.meets === 2 && Math.abs(s.buff - 0.1) < 1e-9 && s.lastSol === 4, 'paid meeting stacks buff to 10%');

// rewind / clock manipulation cannot unlock early
ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 2 }).ok, 'rewound sol still blocked');
ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 4 }).ok, 'same lastSol blocked');

// stack to cap
for (let i = 0; i < 10; i++) {
  const sol = 5 + i;
  const r = C.complete(s, { sol, credits: 9999, pay: () => ({ ok: true }) });
  if (!r.ok) break;
}
ok(s.buff === C.BUFF_CAP && s.meets >= 5 && C.buffPct(s) === 25, 'buff hard-caps at +25%');

// idempotent guard
const g = C.makeGuard(() => 1000, 300);
let n = 0; const once = () => g.run('x', () => { n++; return { ok: true, n }; });
ok(once().ok && once().dup && n === 1, 'guard dedupes same-key within window');

// save round trip
const t = C.load(JSON.stringify(s));
ok(t.meets === s.meets && t.buff === s.buff && t.lastSol === s.lastSol, 'save round trip');

// crewcore payMul / jobCash honor the bonus (crime break hook)
ok(Crew.payMul(1) === 1 && Crew.payMul(2) === 1.1 && Crew.payMul(1, 0.05) === 1.05 && Crew.payMul(1, 0.5) === 1.25, 'payMul + bonus capped');
ok(Crew.jobCash('hustle', 1, 0, 0) === 150 && Crew.jobCash('hustle', 1, 0, 0.05) === Math.round(150 * 1.05), 'jobCash uses bonus');
const m = Crew.member({ id: 'dex', lv: 1 }); Crew.assign(m, 'hustle', 0);
Crew.step(m, 8 * 60000, () => 0.9, () => 0, 0.25);
ok(m.bank[0].cr === Math.round(150 * 1.25) && m.bank[0].xp === Math.round(8 * 1.25), 'step banks buffed pay');

console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
