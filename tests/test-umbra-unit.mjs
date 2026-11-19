// node tests/test-umbra-unit.mjs — Umbra Hold rules, no browser.
import * as C from '../moon/prisoncore.js';

let bad = 0;
const ok = (k, c, v) => { if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v).slice(0, 300)); } };

const s = C.fresh();
ok('outsider', s.rank === 0 && C.rankName(s) === 'Outsider' && /Nadir|gate/i.test(C.objective(s).text));
ok('enter need', !C.meet(s, 'trustee').ok);
ok('bribe', C.enter(s, 'bribe').cost === C.BRIBE && s.rank === 1 && s.entry === 'bribe');
ok('again', C.enter(s, 'arrest').already && s.entry === 'bribe');
ok('neeve', C.meet(s, 'trustee').ok && s.rank === 2);
ok('favor1', C.finishFavor(s, 'juno').ok && s.rank === 3 && s.favors.juno === 1);
{ const t = C.load(JSON.stringify(s)); ok('guard before second favor stays trusted', C.bribeGuard(t).ok && t.rank === 3); }
ok('trade', C.tradeSalt(s).pay === C.TRADE_PAY && s.rank === 3);
ok('favor2 promotes', C.finishFavor(s, 'sato').ok && s.rank === 4);
ok('bram early', !C.beatBram(C.fresh()).ok);
ok('bram', C.beatBram(s).ok && s.rank === 5 && C.rankName(s) === 'Yard captain');
ok('bram stays', C.beatBram(s).already && s.rank === 5);
const now = 1_700_000_000_000;
ok('office', C.takeOffice(s, now).cost === C.OFFICE && s.rank === 6 && s.office);
ok('no instant till', C.incomeDue(s, now + 1000) === 0);
ok('till', C.incomeDue(s, now + C.INCOME_MS + 5) === C.INCOME);
const paid = C.collectIncome(s, now + C.INCOME_MS + 5);
ok('collect', paid.ok && paid.pay === C.INCOME && C.incomeDue(s, now + C.INCOME_MS + 5) === 0);
ok('perks off', C.perks(C.fresh()).drive === 1 && C.perks(s).drive === 1);
ok('move needs favor', !C.board(s, 'moss', 'parole').ok);
ok('board', C.board(s, 'juno', 'parole').quest === 'umbra-out-juno-parole' && C.board(s, 'sato', 'break').cost === 0);
ok('arrive', C.arrived(s, 'juno').ok && C.perks(s).drive === 1.12);
C.arrived(s, 'sato'); C.arrived(s, 'moss'); C.arrived(s, 'nim');
const p = C.perks(s);
ok('all perks', p.heat === 0.65 && p.melee === 1.3 && p.sell === 1.2 && p.drive === 1.12);
ok('objective crew done', /till|Mars|run Umbra/i.test(C.objective(s).text));

const raw = JSON.stringify(s);
const back = C.load(raw);
ok('roundtrip', back.rank === 6 && back.crew.length === 4 && back.office && back.entry === 'bribe');
ok('bad save', C.load('nope').rank === 0 && C.load({ v: 2 }).rank === 0 && C.load({ v: 1, entry: 'nope', rank: 9 }).rank === 0);

const qs = C.questDefs();
ok('quest count', qs.length === 13, qs.length);
for (const q of qs) {
  ok('quest ' + q.id, q.world === 'Moon' && q.title && q.intro && q.steps.length && q.steps.every(st => st.text && st.text.length > 12 && Array.isArray(st.at) && st.at.length === 2));
}
const talk = ['gate', 'trustee', 'juno', 'sato', 'moss', 'nim', 'guard', 'fence', 'ring', 'office'];
for (let i = 0; i < talk.length; i++) for (let j = i + 1; j < talk.length; j++) {
  const a = C.SPOTS[talk[i]], b = C.SPOTS[talk[j]];
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  ok(`gap ${talk[i]} ${talk[j]}`, d >= 12, d);
}
const arrest = C.fresh();
ok('arrest', C.enter(arrest, 'arrest').cost === 0 && arrest.rank === 1 && arrest.entry === 'arrest');
ok('bad kind', !C.enter(C.fresh(), 'sneak').ok);

console.log(bad ? `FAIL ${bad}` : 'umbra unit OK');
process.exit(bad ? 1 : 0);
