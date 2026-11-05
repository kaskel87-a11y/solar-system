// v7.5.28 "cops calm down" unit test for copcore.js + its wiring. node tests/test-copcalm-unit.mjs
import * as CP from '../copcore.js';
import * as CC from '../mars/cranecore.js';
import * as RC from '../mars/raccooncore.js';
import { readFileSync } from 'fs';
let fails = 0; const ok = (name, c) => { if (!c) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// steal car => 0 stars
ok('steal car => 0 stars (nobody around)', CP.theftStars({}) === 0 && CP.theftStars({ wanted: 0 }) === 0);
ok('steal car => 0 stars (bystanders / owner, no cop)', CP.theftStars({ copDist: Infinity, copLOS: false, wanted: 0 }) === 0);
ok('steal car => 0 stars (cop 20 m away)', CP.theftStars({ copDist: 20, copLOS: true }) === 0);
ok('steal car => 0 stars (cop close but behind a wall)', CP.theftStars({ copDist: 5, copLOS: false }) === 0);
ok('cop within 12 m with line of sight => 1 star', CP.theftStars({ copDist: 8, copLOS: true, wanted: 0 }) === 1 && CP.THEFT_COP_R === 12);
ok('cop sighting never stacks on existing heat', CP.theftStars({ copDist: 8, copLOS: true, wanted: 2 }) === 0);
ok('marked ColSec cruiser still counts (2 stars)', CP.theftStars({ police: true }) === 2);
// crane + raccoon follow the same rule
ok('crane lift with no cop => 0', CC.heatOnGrab(false, 0) === 0 && CC.wantedOnEnter(false, 0, 0) === 0);
ok('raccoon rover steal => 0', RC.wantedOnEnter(false, 0, 0) === 0);
// escalation
ok('clean + crime => its level', CP.escalate(0, 1, 'shot a colonist').to === 1 && CP.escalate(0, 2, 'shot at security').to === 2);
ok('serious crimes still +1 every time', CP.escalate(2, 1, 'shot a colonist').to === 3 && CP.escalate(3, 2, 'attacked security').to === 4 && CP.escalate(4, 5, 'killed a ColSec officer').to === 5);
const m1 = CP.escalate(1, 1, 'hit-and-run'); const m2 = CP.escalate(1, 1, 'hit-and-run', m1.strikes);
ok('minor crimes on top of heat: half speed', m1.to === 1 && m1.strikes === 1 && m2.to === 2 && m2.strikes === 0);
ok('a hotter crime jumps straight to its level', CP.escalate(1, 3, 'armored transport').to === 3);
// decay / nuisance
ok('decay faster than before', [1, 2, 3, 4, 5].every(n => CP.evadeNeed(n) < 5 + n * 2.5));
ok('1-2★ cool off out of sight in town', CP.lowHeatCools(1, 50) && !CP.lowHeatCools(1, 30) && CP.lowHeatCools(2, 70) && !CP.lowHeatCools(3, 200));
ok('1★: no pursuit rovers, slower drone, no traffic cruisers, slower bust', CP.pursuitRovers(1, false) === 0 && CP.pursuitRovers(2, false) === 2 && CP.droneSpeed(1) < CP.droneSpeed(2) && !CP.trafficCopsJoin(1) && CP.trafficCopsJoin(2) && CP.bustNeed(1, false) > CP.bustNeed(2, false));
ok('shorter searches', [1, 3, 5].every(n => CP.searchSecs(n) < 8 + 5 * n));
// wiring
const W = src('world.js');
ok('world.take uses theftHeat, no unconditional theft crime', /function take\(v\)[\s\S]{0,900}theftHeat\(v, 'stole'\)/.test(W) && !/crime\(1, `stole a/.test(W) && !/crime\(1, `carjacked/.test(W));
ok('world crime() goes through CP.escalate', /CP\.escalate\(wanted, min, why, strikes\)/.test(W));
ok('world exposes copSees', /copSees: \(x, z, r\) => copSees\(x, z, r\)/.test(W));
ok('pursuit uses CP tiers', /CP\.pursuitRovers/.test(src('mars/pursuit.js')) && /CP\.searchSecs/.test(src('mars/pursuit.js')));
ok('Lou\u2019s impound skip is not a crime', !/crime\(1, 'skipped the Hook & Crook/.test(src('mars/street-tow.js')));
ok('crane owner call adds no stars', !/heat\(tc\.world, tc\.world\?\.wanted \| 0, `the/.test(src('mars/crane.js')));
ok('precached', /copcore\.js/.test(src('sw.js')));
console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
