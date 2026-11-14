// Boss lounge rules. node tests/test-bosslounge-unit.mjs
import { readFileSync } from 'fs';
import * as B from '../mars/bossloungecore.js';
import { ROSTER } from '../crewcore.js';

let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };

ok('roster is the crew, not a second list', ROSTER.length === 4 && B.crewName('dex') === 'Dex' && B.crewName('vee') === 'Vee');
ok('no pitch with an empty crew', B.pitch([]).needCrew === true && B.pitch(['nobody']).needCrew === true);

const bank = B.pitch(['dex'], () => 0);
ok('dex pitches the bank first', bank.ok && bank.job === 'bank' && bank.who === 'dex' && bank.pay === 2200 && bank.wanted === 2);
ok('bank line is plain', bank.line.length > 20 && !/[“”]/.test(bank.line) && /Trust|vault|First Junction/.test(bank.line));
ok('bank brief is numbered', /1\./.test(bank.brief) && /2\./.test(bank.brief) && /stars/.test(bank.brief));

const floor = B.pitch(['vee'], () => 0.34);
ok('vee pitches a floor problem', floor.ok && floor.job === 'floor' && floor.who === 'vee' && floor.wanted === 0 && B.FLOOR[floor.floor]);
ok('floor step names fists', /Punch|Fists/.test(B.FLOOR[floor.floor].step));

const marker = B.pitch(['mags', 'soren'], () => 0.7);
ok('a hired name pitches the marker', marker.ok && marker.job === 'marker' && marker.pay === 700 && marker.wanted === 0 && (marker.who === 'mags' || marker.who === 'soren'));

const busy = B.pitch(['dex'], () => 0, { heistBusy: true });
ok('bank is skipped while a heist is running', busy.ok && busy.job !== 'bank');

const job = B.accept(bank);
ok('accept starts at the door', job && job.id === 'bank' && job.step === 'leave' && job.name === 'Dex');
ok('bank steps stay plain', ['leave', 'door', 'crack', 'out', 'clean'].every(s => B.bankStep(s).length > 12 && !/[“”]/.test(B.bankStep(s))));

ok('first two punches stay up', B.strike(0).down === false && B.strike(1).down === false && B.strike(1).hits === 2);
ok('third punch drops them', B.strike(2).down === true && B.strike(2).hits === 3);
ok('a swing in front connects', B.inFront(0, 0, 1, 0, 1.2, 0.2));
ok('a swing behind does not', !B.inFront(0, 0, 1, 0, -1, 0));
ok('too far does not', !B.inFront(0, 0, 0, 1, 0, 9));

const s = B.fresh();
ok('toss pays 80', B.noteToss(s).cr === 80 && s.tossed === 1);
ok('bank pays 2200', B.noteJob(s, job).cr === 2200 && s.jobs === 1 && s.cr === 2280);
ok('log mentions the chair only once you own it', B.logLine(false) === '' && /boss chair/.test(B.logLine(true)) && /crew/.test(B.logLine(true)));

const loaded = B.load(JSON.stringify({ v: 1, jobs: 3, cr: 100, tossed: 2, lastJob: 'bank', extra: 1 }));
ok('load keeps the counts', loaded.jobs === 3 && loaded.cr === 100 && loaded.tossed === 2 && loaded.lastJob === 'bank');
ok('load rejects a bad save', B.load('nope').jobs === 0 && B.load({ v: 9 }).v === 1);

const office = { x0: 18, x1: 25, z0: -8, z1: 1 };
const inside = p => p.x > office.x0 + 0.4 && p.x < office.x1 - 0.3 && p.z > office.z0 + 0.4 && p.z < office.z1 - 0.3;
ok('chair, seat and crew stand are in the office', inside(B.BOOTH) && inside(B.SEAT) && inside(B.CREW_AT) && inside(B.OFFICE_DOOR));
const desk = { x0: 20.2, x1: 22.8, z0: -5.6, z1: -4.4 };
const clear = p => p.x < desk.x0 || p.x > desk.x1 || p.z < desk.z0 || p.z > desk.z1;
ok('chair is not inside the desk', clear(B.BOOTH) && clear(B.SEAT) && clear(B.CREW_AT));

for (const f of Object.values(B.FLOOR)) ok('floor spot ' + f.id + ' is on the club floor', f.x > -28 && f.x < 25 && f.z > -7 && f.z < 22 && f.step.length > 12);
for (const t of B.TROUBLE) ok('troublemaker ' + t.id + ' is on the floor', t.x > -28 && t.x < 20 && t.z > -6 && t.z < 16 && /Punch/.test(t.step));

const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const wing = src('velvetwing.js'), lounge = src('mars/bosslounge.js'), crime = src('mars/crimebreak.js'), game = src('game.js');
ok('wing has the boss spot at the seat', wing.includes("id: 'velvet-boss'") && wing.includes('x: 20.2, z: -3.55'));
ok('wing hides the chair until you own it', /bossParts/.test(wing) && /bossCol\.on = own/.test(wing));
ok('lounge reuses SSX.crew and SSX.heist', lounge.includes('crew?.state') && lounge.includes('HEIST_ID') && lounge.includes('startHeist'));
ok('sit-down quote is not wrapped in extra quotes', !crime.includes('<q>“') && !crime.includes('<q>\"'));
ok('indoor fists are the bare-hand exception', game.includes('loungeFists') && game.includes('bosslounge.punch'));
ok('velvet log mentions the chair', /boss chair/.test(src('mars/velvetarc.js')));

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('bosslounge unit ok');
