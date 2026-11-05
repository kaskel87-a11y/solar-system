// node tests/test-crew-unit.mjs — crewcore rules + empirecore launder (v7.5.42)
import * as C from '../crewcore.js';
import * as EC from '../empirecore.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
ok(C.slotsFor(9999) === 0 && C.slotsFor(10000) === 1 && C.slotsFor(60000) === 3, 'slots by lifetime stars');
const s = C.fresh(); ok(!C.hire(s, 5000), 'no hire under 10k'); const m = C.hire(s, 10000); ok(m?.id === 'dex' && !C.hire(s, 10000), 'Dex hired, one slot only');
ok(!C.canAssign(m, 'boost', []).ok && !C.canAssign({ ...m, lv: 3 }, 'front', []).ok && C.canAssign(m, 'hustle', []).ok, 'tier + front gates');
C.assign(m, 'hustle', 0); C.step(m, 7 * 60000, () => 0.9); ok(m.bank.length === 0, 'not done before 8 min');
C.step(m, 60 * 60000, () => 0.9); ok(m.bank.length === C.BANK && C.busy(m, 60 * 60000) === 'full', 'offline: loops, banks max 3');
const r = C.collect(s, m); ok(r.cr === 450 && r.xp === 24 && m.bank.length === 0, 'collect 3×150 cr, 3×8 ⭐');
C.step(m, 61 * 60000, () => 0.9); ok(m.bank.length === 0 && m.at === 60 * 60000, 'clock restarts at collect time when full');
C.step(m, 68 * 60000, () => 0.0); ok(m.bank.length === 1 && m.bank[0].bust && m.bank[0].cr === 0 && m.held > 68 * 60000, 'bust: no cut, held');
ok(C.busy(m, 70 * 60000) === 'held' && C.bail(m, 70 * 60000) === 60 && m.held === 0, 'bail 40% of cut');
const t = C.load(JSON.stringify(s)); ok(t.crew[0].id === 'dex' && t.stats.jobs === 3, 'save round trip'); ok(C.load('junk').crew.length === 0, 'bad save -> fresh');
ok(C.jobCash('front', 3, 45) === Math.round(540 * 1.2), 'front job = 12 h of takings × level pay');
// empire: launder into best open front, collect includes it, raid takes it
const E = EC.fresh(0); ok(EC.launder(E, 100) === null, 'no front -> no wash'); EC.buy(E, 'fr-wash'); EC.buy(E, 'fr-disp');
ok(EC.launder(E, 200) === 'fr-disp' && EC.launder(E, 50, 'fr-wash') === 'fr-wash', 'best front / preferred front');
E.owned['fr-disp'].pending = 10.5; ok(EC.collect(E, 'fr-disp') === 210 && E.owned['fr-disp'].crew === 0, 'collect = till + crew cash');
ok(EC.applyLoss(E, 'fr-wash').lost === 50, 'raid takes washed cash too'); ok(EC.migrate(JSON.stringify(E)).owned['fr-wash'].crew === 0, 'migrate keeps crew field');
console.log(fail ? `${fail} FAILED` : 'all ok'); process.exit(fail ? 1 : 0);
