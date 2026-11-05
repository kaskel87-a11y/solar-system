// node tests/test-danger-unit.mjs : pure street-danger rules (dangercore.js)
import * as DC from '../dangercore.js';
import { MARS_CITY, chaseRoute } from '../streetdata.js';
import * as AC from '../ambientcore.js';
import { readFileSync, existsSync } from 'node:fs';
let pass = 0, fail = 0;
const ok = (name, c) => { if (c) pass++; else { fail++; console.log('FAIL', name); } };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const col = { x: 0, z: 0 };

// districts
ok('downtown', DC.districtAt(10, 10, col) === 'downtown');
ok('rough', DC.districtAt(120, 0, col) === 'rough');
ok('wastes', DC.districtAt(400, 0, col) === 'wastes');
ok('highway when fast', DC.districtAt(400, 0, col, { driving: true, speed: 20 }) === 'highway');
ok('no colony', DC.districtAt(0, 0, null) === 'wastes');
ok('custom districts', DC.districtAt(500, 500, { x: 0, z: 0, districts: [{ id: 'gated', x: 500, z: 500, r: 60 }] }) === 'gated');
// clock
DC.setClock(23); ok('night', DC.timeBand(DC.marsHour()) === 'night'); DC.setClock(null);
ok('bands', DC.timeBand(12) === 'day' && DC.timeBand(18) === 'dusk' && DC.timeBand(6) === 'dawn' && DC.timeBand(2) === 'night');
// rates
const base = { district: 'rough', hour: 12, onFoot: true, driving: false, wanted: 0, inside: false, busy: false };
ok('night > day muggings', DC.ratePerMin('mugging', { ...base, hour: 2 }) > DC.ratePerMin('mugging', base));
ok('rough > downtown', DC.ratePerMin('mugging', base) > DC.ratePerMin('mugging', { ...base, district: 'downtown' }));
ok('gated nearly safe', DC.ratePerMin('mugging', { ...base, district: 'gated' }) < 0.05);
ok('highway no muggings', DC.ratePerMin('mugging', { ...base, district: 'highway' }) === 0);
ok('quest halves', Math.abs(DC.ratePerMin('fight', { ...base, questActive: true }) * 2 - DC.ratePerMin('fight', base)) < 1e-9);
// eligibility
ok('no mugging while wanted', !DC.eligible('mugging', { ...base, wanted: 1 }));
ok('no mugging driving', !DC.eligible('mugging', { ...base, onFoot: false, driving: true }));
ok('no mugging inside', !DC.eligible('mugging', { ...base, inside: true }));
ok('nearCount radius', DC.nearCount([{ x: 0, z: 0 }, { x: 50, z: 0 }, { x: 200, z: 0 }], 0, 0) === 2);
ok('nearCount empty', DC.nearCount(undefined, 0, 0) === 0);
ok('getaway tier', DC.chaseTier('getaway', true)?.cars === 2 && DC.chaseTier('getaway', true).shoot && DC.chaseTier('getaway', true, 9).cars === 3);
ok('getaway barks', DC.BARKS.getaway.length >= 2);
ok('no mugging mid-duel', !DC.eligible('mugging', { ...base, inDuel: true }));
ok('no fight mid-duel', !DC.eligible('fight', { ...base, inDuel: true }));
ok('no gang chase mid-duel', !DC.eligible('gangChase', { ...base, onFoot: false, driving: true, speed: 12, inDuel: true }));
ok('fight at 1 star', DC.eligible('fight', { ...base, wanted: 1 }) && !DC.eligible('fight', { ...base, wanted: 2 }));
ok('carjack only slow car', DC.eligible('carjack', { ...base, onFoot: false, driving: true, speed: 2 }) && !DC.eligible('carjack', { ...base, driving: true, speed: 20 }));
// director
{ const d = DC.createDirector({ rng: () => 0, grace: 5 });
  ok('grace', d.tick(1, base) === null);
  for (let i = 0; i < 4; i++) d.tick(1, base);
  const t = d.tick(1, base); ok('fires after grace', t === 'mugging');
  ok('global cooldown', d.tick(1, base) === null);
  for (let i = 0; i < 41; i++) d.tick(1, { ...base, inside: true });
  ok('type cooldown → fight next', d.tick(1, base) === 'fight');
  d.active = 1; for (let i = 0; i < 200; i++) d.tick(1, base); ok('active blocks', d.tick(1, base) === null);
}
{ const d = DC.createDirector({ rng: () => 0.999999, grace: 0 }); let n = 0; for (let i = 0; i < 100; i++) if (d.tick(1, base)) n++; ok('rng high = nothing', n === 0); }
{ // statistical: expected rate ~0.7/min muggings in rough daytime*0.5 => with cooldowns, over 60 min should see some but not hundreds
  let s = 1; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const d = DC.createDirector({ rng, grace: 0 }); let m = 0; for (let i = 0; i < 3600; i++) if (d.tick(1, base) === 'mugging') m++;
  ok('muggings per hour sane (' + m + ')', m >= 3 && m <= 32);
}
// barks
ok('barks short', Object.values(DC.BARKS).flat().every(l => l.length <= 65));
ok('fill', DC.fill('{n} credits', { n: 60 }) === '60 credits');
ok('pick', DC.pick(['a', 'b'], () => 0.6) === 'b');
// mugging
ok('demand broke', DC.demandFor(0) === 20);
ok('demand clamp', DC.demandFor(100000, () => 0.5) === 150 && DC.demandFor(30, () => 0) === 20);
ok('demand rounded', DC.demandFor(400, () => 0) % 5 === 0);
const m = { demand: 60, talks: 0 };
{ const o = DC.resolveChoice('pay', m, { credits: 500 }, () => 0.5); ok('pay', o.result === 'paid' && o.paid === 60 && !o.comeback); }
{ const o = DC.resolveChoice('pay', m, { credits: 25 }, () => 0.1); ok('pay partial + comeback', o.paid === 25 && o.comeback); }
{ const o = DC.resolveChoice('pay', m, { credits: 0 }); ok('pay broke = shoved, still a way out', o.result === 'shoved' && o.why === 'broke' && o.dmg > 0 && o.dmg < 10); }
for (const c of ['pay', 'fight', 'run']) ok('way out: ' + c, ['paid', 'fight', 'chase', 'shoved'].includes(DC.resolveChoice(c, m, { credits: 50 }).result) && ['paid', 'fight', 'chase', 'shoved'].includes(DC.resolveChoice(c, m, { credits: 0 }).result));
ok('fight', DC.resolveChoice('fight', m).result === 'fight');
ok('run', DC.resolveChoice('run', m).result === 'chase');
{ const o = DC.resolveChoice('talk', m, { xp: 0 }, () => 0.01); ok('talk tip', o.result === 'tip'); }
{ const o = DC.resolveChoice('talk', m, { xp: 0 }, () => 0.3); ok('talk ok', o.result === 'talked'); }
{ const o = DC.resolveChoice('talk', m, { xp: 0 }, () => 0.99); ok('talk fail lunge', o.result === 'fight' && o.lunge); }
{ const o = DC.resolveChoice('timeout', m, { credits: 100 }); ok('timeout stabs + half', o.result === 'stabbed' && o.paid === 30 && o.dmg > 0); }
let threw = false; try { DC.resolveChoice('dance', m); } catch (e) { threw = true; } ok('unknown choice throws', threw);
ok('talk odds: armed + dog better', DC.talkChance({ armed: true, dog: true }) > DC.talkChance({}));
ok('talk odds: retries worse', DC.talkChance({ tries: 1 }) < DC.talkChance({}));
ok('talk odds clamp', DC.talkChance({ xp: 1e9, armed: true, dog: true, saltbloodRep: 10 }) <= 0.9 && DC.talkChance({ tries: 9 }) >= 0.05);
// SSX.rep -> talkChance mapping (Marsmania's rep: -100..+100, 0 neutral)
ok('rep 0 = neutral', DC.repToTalkUnits(0) === 0 && DC.talkChance({ saltbloodRep: DC.repToTalkUnits(0) }) === DC.talkChance({}));
ok('rep +100 = 3 flags (max bonus)', Math.abs(DC.repToTalkUnits(100) - 3) < 1e-9);
ok('rep -100 = -3', Math.abs(DC.repToTalkUnits(-100) + 3) < 1e-9);
ok('rep clamps out of range', DC.repToTalkUnits(500) === DC.repToTalkUnits(100) && DC.repToTalkUnits(-999) === DC.repToTalkUnits(-100));
ok('rep junk is neutral', [NaN, undefined, null, 'x', {}].every(v => DC.repToTalkUnits(v) === 0));
ok('rep monotonic', DC.talkChance({ saltbloodRep: DC.repToTalkUnits(-60) }) < DC.talkChance({ saltbloodRep: DC.repToTalkUnits(0) }) && DC.talkChance({ saltbloodRep: DC.repToTalkUnits(0) }) < DC.talkChance({ saltbloodRep: DC.repToTalkUnits(60) }));
ok('hostile rep costs at most 0.15', Math.abs(DC.talkChance({ saltbloodRep: DC.repToTalkUnits(-100) }) - (DC.talkChance({}) - 0.15)) < 1e-9);
ok('talkChance survives junk rep', Number.isFinite(DC.talkChance({ saltbloodRep: NaN })) && Number.isFinite(DC.talkChance({ saltbloodRep: 'x' })));
const FL = ['vesna-01', 'saltblood-friend', 'rook-02', 'vesna-02'];
ok('flag count', DC.saltbloodFlagCount(FL) === 3 && DC.saltbloodFlagCount(null) === 0);
ok('fallback to flags when rep missing', DC.saltbloodStanding(null, FL) === 3 && DC.saltbloodStanding(undefined, FL) === 3 && DC.saltbloodStanding(NaN, FL) === 3);
ok('rep wins when present', DC.saltbloodStanding(0, FL) === 0 && DC.saltbloodStanding(-50, FL) < 0);
for (let k = 0; k <= 4; k++) ok('no jump when rep loads seeded from ' + k + ' flags', Math.abs(DC.talkChance({ saltbloodRep: DC.saltbloodStanding(DC.flagsToRep(k), []) }) - DC.talkChance({ saltbloodRep: k })) < 0.002);
ok('readRep absent', DC.readRep('saltblood', {}) === null && DC.readRep('saltblood', null) === null);
ok('readRep reads', DC.readRep('saltblood', { SSX: { rep: { get: id => id === 'saltblood' ? 40 : 0 } } }) === 40);
ok('readRep throws -> null', DC.readRep('saltblood', { SSX: { rep: { get() { throw new Error('boom'); } } } }) === null);
ok('readRep non-number -> null', DC.readRep('saltblood', { SSX: { rep: { get: () => 'lots' } } }) === null);
// ssx:npc-down faction slugs
ok('faction: junkie/mugger', DC.npcDownDetail({ kind: 'junkie', role: 'mugger', x: 1, z: 2 }).faction === 'junkies');
ok('faction: thug', DC.npcDownDetail({ kind: 'thug' }).faction === 'saltblood');
ok('faction: escort default', DC.npcDownDetail({ kind: 'thug', escort: true }).faction === 'saltblood');
ok('faction: turf escorts', DC.npcDownDetail({ kind: 'thug', escort: true, faction: 'dustjaws' }).faction === 'dustjaws' && DC.npcDownDetail({ kind: 'thug', escort: true, faction: 'saints' }).name === 'Vacuum Saint escort');
ok('faction: chase car', DC.npcDownDetail({ x: 0, z: 0, name: 'Saltblood driver', faction: 'saltblood' }).faction === 'saltblood' && DC.npcDownDetail({ name: 'Junkie driver', faction: 'junkies' }).faction === 'junkies');
ok('faction: colonist/victim/getaway omitted', !('faction' in DC.npcDownDetail({ kind: 'colonist' })) && !('faction' in DC.npcDownDetail({ kind: 'victim' })) && !('faction' in DC.npcDownDetail({ name: 'Fence crew driver', faction: null })));
ok('faction keeps x/z/name', (d => d.x === 3 && d.z === 4 && d.name === 'Saltblood')(DC.npcDownDetail({ kind: 'thug', x: 3, z: 4 })));
ok('faction lowercased', DC.npcDownDetail({ kind: 'thug', faction: 'Saints' }).faction === 'saints');
// public mugging API guard (SSX.danger.startMugging)
const G0 = { ready: true, mugging: false, enabled: true, car: false, inside: false, duel: false, heist: false };
ok('mugGuard: clear street ok', DC.mugGuard(G0).ok && DC.mugGuard(G0).why === null);
for (const [k, why] of [['car', 'vehicle'], ['inside', 'inside'], ['duel', 'duel'], ['heist', 'heist']]) {
  ok('mugGuard: refuses ' + k, DC.mugGuard({ ...G0, [k]: true }).why === why && !DC.mugGuard({ ...G0, [k]: true }).ok);
  ok('mugGuard: force overrides ' + k, DC.mugGuard({ ...G0, [k]: true }, true).ok);
}
ok('mugGuard: danger off refuses, force overrides', DC.mugGuard({ ...G0, enabled: false }).why === 'off' && DC.mugGuard({ ...G0, enabled: false }, true).ok);
ok('mugGuard: busy even with force', DC.mugGuard({ ...G0, mugging: true }).why === 'busy' && DC.mugGuard({ ...G0, mugging: true }, true).why === 'busy');
ok('mugGuard: not ready even with force', DC.mugGuard({ ...G0, ready: false }, true).why === 'not-ready' && DC.mugGuard(null).why === 'not-ready');
ok('mugGuard: priority busy > vehicle', DC.mugGuard({ ...G0, mugging: true, car: true }).why === 'busy');
ok('mugOpts: defaults', JSON.stringify(DC.mugOpts()) === JSON.stringify({ force: false, near: null, dist: null, armed: 'knife', night: null }));
ok('mugOpts: force must be true', DC.mugOpts({ force: 'yes' }).force === false && DC.mugOpts({ force: true }).force === true);
ok('mugOpts: near', (o => o.near.x === 3 && o.near.z === -4)(DC.mugOpts({ near: { x: '3', z: -4 } })) && DC.mugOpts({ near: { x: NaN, z: 1 } }).near === null && DC.mugOpts({ near: true }).near === null);
ok('mugOpts: dist clamped', DC.mugOpts({ dist: 1 }).dist === 4 && DC.mugOpts({ dist: 99 }).dist === 40 && DC.mugOpts({ dist: 9 }).dist === 9 && DC.mugOpts({ dist: undefined }).dist === null);
ok('mugOpts: armed whitelist', DC.mugOpts({ armed: 'pipe' }).armed === 'pipe' && DC.mugOpts({ armed: 'fists' }).armed === 'fists' && DC.mugOpts({ armed: 'rpg' }).armed === 'knife');
ok('mugOpts: night boolean only', DC.mugOpts({ night: true }).night === true && DC.mugOpts({ night: false }).night === false && DC.mugOpts({ night: 1 }).night === null);
ok('mugOpts: grime opts tolerated', (o => o.dist === 6 && !o.force)(DC.mugOpts({ dist: 6, district: 'flats', src: 'grime' })));
ok('mugHit ranges', DC.mugHit('knife', () => 0) === 9 && DC.mugHit('fists', () => 1) === 7 && DC.mugHit('nope', () => 0) === 9);
ok('heistActive', DC.heistActive({ SSX: { heist: { active: null } } }) === false && DC.heistActive({ SSX: { heist: { get active() { return Object.assign(() => true, { id: 'bank' }); } } } }) === true && DC.heistActive({ SSX: { heist: { get active() { throw new Error('x'); } } } }) === false && DC.heistActive(null) === false);
// night: SSX.time.isNight() overrides the clock's night flag
const T = v => ({ SSX: { time: { isNight: () => v } } });
ok('readNight absent/junk', DC.readNight({}) === null && DC.readNight(null) === null && DC.readNight(T('dark')) === null && DC.readNight({ SSX: { time: { isNight() { throw new Error('x'); } } } }) === null);
ok('readNight reads', DC.readNight(T(true)) === true && DC.readNight(T(false)) === false);
ok('readNight keeps this', DC.readNight({ SSX: { time: { dark: true, isNight() { return this.dark; } } } }) === true);
ok('nightHour: no override keeps hour', DC.nightHour(13.5, null) === 13.5 && DC.nightHour(2, undefined) === 2);
ok('nightHour: agrees keeps hour', DC.nightHour(23.5, true) === 23.5 && DC.nightHour(10, false) === 10);
ok('nightHour: forces night', DC.timeBand(DC.nightHour(12, true)) === 'night');
ok('nightHour: forces day', DC.timeBand(DC.nightHour(2, false)) === 'day');
const DAYMS = 12 * 120000, NIGHTMS = 23 * 120000; // marsHour = (ms / 120000) % 24
ok('isNight: clock fallback', DC.isNight({}, NIGHTMS) === true && DC.isNight({}, DAYMS) === false);
ok('isNight: SSX.time wins over clock', DC.isNight(T(true), DAYMS) === true && DC.isNight(T(false), NIGHTMS) === false);
ok('isNight: broken SSX.time falls back', DC.isNight({ SSX: { time: { isNight() { throw new Error('x'); } } } }, NIGHTMS) === true);
ok('gameHour feeds rates', DC.ratePerMin('mugging', { ...base, hour: DC.gameHour(T(true), DAYMS) }) > DC.ratePerMin('mugging', { ...base, hour: DC.gameHour({}, DAYMS) }));
ok('nightSource', DC.nightSource({}) === 'clock' && DC.nightSource(T(false)) === 'SSX.time.isNight' && DC.nightSource({ SSX: { time: { hour: () => 3 } } }) === 'SSX.time.hour');
// Steve's SSX.time.hour() is the hour source when present
const TH = (h, n) => ({ SSX: { time: { hour: () => h, isNight: () => n } } });
ok('readHour absent/junk', DC.readHour({}) === null && DC.readHour(null) === null && DC.readHour({ SSX: { time: { hour: () => 'x' } } }) === null && DC.readHour({ SSX: { time: { hour() { throw new Error('x'); } } } }) === null && DC.readHour({ SSX: { time: { hour: 5 } } }) === null);
ok('readHour reads + wraps', DC.readHour(TH(18.25)) === 18.25 && DC.readHour(TH(24)) === 0 && DC.readHour(TH(-1)) === 23);
ok('gameHour uses hour()', DC.gameHour(TH(18.5, false), NIGHTMS) === 18.5 && DC.timeBand(DC.gameHour(TH(18.5, false), NIGHTMS)) === 'dusk');
ok('hour() beats isNight()', DC.gameHour(TH(10, true), DAYMS) === 10 && DC.isNight(TH(10, true), DAYMS) === false);
ok('hour() night', DC.isNight(TH(22, true), DAYMS) === true);
ok('broken hour() falls back to isNight', DC.isNight({ SSX: { time: { hour() { throw new Error('x'); }, isNight: () => true } } }, DAYMS) === true);
ok('broken hour() + no isNight falls back to clock', DC.gameHour({ SSX: { time: { hour: () => NaN } } }, DAYMS) === DC.marsHour(DAYMS));
ok('marsHour stays raw clock (SSX.time seeds from it)', DC.marsHour(DAYMS) === 12);
DC.setClock(12); ok('setClock beats SSX.time', DC.isNight(T(true)) === false && DC.isNight(TH(23, true)) === false && DC.nightSource(TH(23, true)) === 'setClock'); DC.setClock(null);
// backup factions = mars/turf.js slugs
ok('backup: dustjaws + saints', DC.backupPlan({ faction: 'dustjaws' }, 6, true).ok && DC.backupPlan({ faction: 'saints', count: 9 }, 6, true).n === 4 && DC.backupPlan({ faction: 'saints' }, 6, false).hp > DC.backupPlan({ faction: 'dustjaws' }, 6, false).hp);
ok('backup: unknown faction refused', DC.backupPlan({ faction: 'colsec' }, 6, true).why === 'faction');
// heat
ok('self defense', DC.heatForMugger({ phase: 'fight', killed: true, gun: false, witnessed: true, inColony: true }) === null);
ok('self defense gun outskirts', DC.heatForMugger({ phase: 'fight', killed: true, gun: true, witnessed: false, inColony: false }) === null);
ok('gun in colony', DC.heatForMugger({ phase: 'fight', killed: true, gun: true, witnessed: true, inColony: true })?.min === 1);
ok('back shot', DC.heatForMugger({ phase: 'fleeing', killed: true, witnessed: true })?.min === 2);
ok('unprovoked', DC.heatForMugger({ phase: 'approach', killed: true, witnessed: true })?.why === 'murder');
ok('unwitnessed', DC.heatForMugger({ phase: 'approach', killed: true, witnessed: false }) === null);
ok('loot', DC.muggerLoot(() => 0, 40).credits === 48);
ok('fighter aggressor ok', DC.heatForFighter({ role: 'aggressor', killed: false, witnessed: true }) === null);
ok('fighter victim assault', DC.heatForFighter({ role: 'victim', killed: false, witnessed: true })?.min === 1);
ok('pickFight downtown no beatdown', [0, 0.5, 0.99].every(r => DC.pickFight(() => r, 'downtown').id !== 'beatdown'));
ok('swing range', DC.swing('knife', () => 0) === 0.9 && DC.swing('nope', () => 1) === 0.9);
// pursuit
ok('no police tier', DC.chaseTier('police') === null && typeof DC.pursuitTier === 'undefined');
ok('gang rams+shoots', DC.chaseTier('gang').ram && DC.chaseTier('gang').shoot && DC.chaseTier('gang').cars === 2);
ok('junkie only rams', DC.chaseTier('junkie').ram && !DC.chaseTier('junkie').shoot && DC.chaseTier('junkie').cars === 1);
ok('setpiece 3 pursuers', DC.chaseTier('setpiece').cars === 3);
ok('phone pursuer cap 3', DC.chaseTier('setpiece', true, 6).cars === 3 && DC.chaseTier('setpiece', false, 6).cars === 5);
ok('npc budget phone', DC.npcBudget(8, 2, true) === 2 && DC.npcBudget(12, 0, true) === 0 && DC.npcBudget(15, 0, true) === 0);
ok('npc budget desktop', DC.npcBudget(8, 2, false) === 10);
ok('gangChase implemented', DC.IMPLEMENTED.includes('gangChase') && !DC.IMPLEMENTED.includes('robbery'));
ok('gangChase needs driving', !DC.eligible('gangChase', { driving: false, wanted: 0 }) && DC.eligible('gangChase', { driving: true, speed: 10, wanted: 1 }));
ok('saltblood heat raises gang rate', DC.ratePerMin('gangChase', { district: 'rough', hour: 12, saltbloodHeat: 2 }) > DC.ratePerMin('gangChase', { district: 'rough', hour: 12 }));
// Mars city data (highway.json)
{ const aj = { x: 100, z: -200 };
  ok('city rough = Red Tape Flats', DC.districtAt(100 - 280, -200 - 40, aj, { city: MARS_CITY }) === 'rough');
  ok('city downtown = Olympus Row', DC.districtAt(100, -200 - 430, aj, { city: MARS_CITY }) === 'downtown');
  ok('city gated = Helios', DC.districtAt(100 + 320, -200 + 80, aj, { city: MARS_CITY }) === 'gated');
  ok('beltway = highway when driving', DC.districtAt(100, -200 - 300, aj, { city: MARS_CITY, driving: true }) === 'highway');
  ok('beltway on foot not highway', DC.districtAt(100, -200 - 300, aj, { city: MARS_CITY }) !== 'highway');
  ok('AJ core still downtown', DC.districtAt(110, -205, aj, { city: MARS_CITY }) === 'downtown'); }
{ const r = chaseRoute('beltway-chase-saltblood'); ok('red tape route', r.pts.length === 8 && r.pts[0][0] === -280 && r.pts[7][0] === 320 && r.def.limit_s === 120);
  ok('blue lights is police -> not ours', chaseRoute('beltway-chase-colsec').def.wanted === 3);
  ok('phone caps from json', MARS_CITY.caps.phone_npc_max === 12 && MARS_CITY.caps.active_chase_pursuers_phone === 3);
  const sp = DC.setPieceNew(r.def, r.pts, 16);
  DC.setPieceStep(sp, 1, { x: -240, z: -20, speed: 20 }); ok('sp checkpoint', sp.i === 2 && sp.hit && sp.status === 'running');
  for (const p of r.pts.slice(2)) DC.setPieceStep(sp, 1, { x: p[0], z: p[1], speed: 20 }); ok('sp won', sp.status === 'won');
  const s2 = DC.setPieceNew(r.def, r.pts); for (let i = 0; i < 10; i++) DC.setPieceStep(s2, 0.5, { x: 999, z: 999, speed: 1, close: 1 }); ok('sp caught when boxed in', s2.status === 'caught');
  const s3 = DC.setPieceNew(r.def, r.pts); DC.setPieceStep(s3, 0.1, { x: 999, z: 999, speed: 20, crateDmg: 120 }); ok('sp crate destroyed', s3.status === 'crate_destroyed');
  const s4 = DC.setPieceNew(r.def, r.pts); for (let i = 0; i < 13; i++) DC.setPieceStep(s4, 10, { x: 999, z: 999, speed: 20 }); ok('sp timer', s4.status === 'timer');
  const s5 = DC.setPieceNew(r.def, r.pts); for (let i = 0; i < 20; i++) DC.setPieceStep(s5, 0.5, { x: 999, z: 999, speed: 20, close: 2 }); ok('sp fast with pursuers close is not caught', s5.status === 'running'); }
ok('polyline dist', Math.abs(DC.distToPolyline(5, 0, [[0, -10], [0, 10]]) - 5) < 1e-9);
ok('lose time: setpiece > junkie', DC.chaseTier('setpiece').loseTime > DC.chaseTier('junkie').loseTime);
{ const p = DC.interceptPoint({ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 50 }, 25); ok('intercept leads', p.x > 0 && p.t <= 2.2); }
{ const a = { x: 0, z: 0, yaw: 0, speed: 0 }; for (let i = 0; i < 200; i++) DC.steerTo(a, 0, -1000, 0.05, { vmax: 20 }); ok('steer straight ahead (-z)', a.z < -50 && Math.abs(a.x) < 1); }
{ const a = { x: 0, z: 0, yaw: 0, speed: 10 }; for (let i = 0; i < 300; i++) DC.steerTo(a, 50, 0, 0.05, { vmax: 20 }); ok('steer turns to +x', Math.hypot(a.x - 50, a.z) < 12); }
const flat = () => 0, hill = (x) => (x > 40 && x < 60 ? 10 : 0);
ok('los flat', DC.lineOfSight({ x: 0, y: 1.5, z: 0 }, { x: 100, y: 1, z: 0 }, flat));
ok('los hill blocks', !DC.lineOfSight({ x: 0, y: 1.5, z: 0 }, { x: 100, y: 1, z: 0 }, hill));
ok('los solid blocks', !DC.lineOfSight({ x: 0, y: 1.5, z: 0 }, { x: 100, y: 1, z: 0 }, flat, (x) => x > 28 && x < 37));
{ const T = DC.chaseTier('gang'), h = { mode: 'chase' }; DC.heatStep(h, false, T.loseTime - 0.1, T); ok('still chase', h.mode === 'chase');
  DC.heatStep(h, false, 0.2, T); ok('search', h.mode === 'search');
  DC.heatStep(h, true, 0.1, T); ok('respotted', h.mode === 'chase');
  DC.heatStep(h, false, T.loseTime + 0.1, T); DC.heatStep(h, false, T.search + 0.1, T); ok('lost', h.mode === 'lost'); }
{ const a = DC.aheadPoint(0, 0, 0, 50); ok('ahead -z', Math.abs(a.x) < 1e-9 && a.z === -50); }
{ const r = DC.ramImpulse({ x: 0, z: 2, yaw: 0, speed: 20 }, { x: 0, z: 0 }, { x: 0, z: -5 }); ok('ram closing', r.closing > 6 && r.hard && r.shove > 0); }
{ const r = DC.ramImpulse({ x: 0, z: 2, yaw: 0, speed: 5 }, { x: 0, z: 0 }, { x: 0, z: -20 }); ok('pulling away no ram', r.closing < 0 && !r.hard); }

// ambient events (data/random-events.json, Steve's file copied read-only)
{
  const J = JSON.parse(readFileSync(new URL('../data/random-events.json', import.meta.url)));
  const A = AC.normalize(J), byId = id => A.events.find(e => e.id === id);
  ok('ambient: 23 events loaded', A.events.length === 23);
  ok('ambient: global cooldown from file', A.rules.global_cooldown_s === 90 && A.rules.max_active_phone === 1);
  { const src = '/workspace/solar-system-story/mars-city/random-events.json'; if (existsSync(src)) ok('ambient: copy matches Steve file', JSON.stringify(J) === JSON.stringify(JSON.parse(readFileSync(src)))); }
  const full = A.events.filter(e => e._c.support !== 'stub').map(e => e.id).sort();
  ok('ambient: runnable set', JSON.stringify(full) === JSON.stringify(['ev-exec-jacked', 'ev-initiation-watch', 'ev-o2-thief', 'ev-quiet-courier', 'ev-stranded-tourist', 'ev-street-preacher']));
  ok('ambient: colsec events are stubs (police not ours)', ['ev-cop-shakedown', 'ev-colsec-checkpoint-surprise', 'ev-protest'].every(id => byId(id)._c.support === 'stub' && byId(id)._c.why.some(w => /ColSec/.test(w))));
  ok('ambient: weather stub', byId('ev-duststorm-pileup')._c.why.some(w => /weather/.test(w)));
  ok('ambient: duel invite needs start API', byId('ev-street-duel-invite')._c.support === 'stub');
  ok('ambient: every stub has a reason', AC.stubList(A).every(x => x.why.length > 0));
  const foot = { district: 'rough', onFoot: true, driving: false, wanted: 0, hour: 22, hp: 100 };
  ok('ambient: weight by district', AC.weight(byId('ev-initiation-watch'), 'rough') === 0.7 && AC.weight(byId('ev-initiation-watch'), 'wastes') === 0);
  ok('ambient: initiation needs night/dusk', AC.triggerOk(byId('ev-initiation-watch'), foot) && !AC.triggerOk(byId('ev-initiation-watch'), { ...foot, hour: 12 }));
  ok('ambient: tourist needs a vehicle', !AC.triggerOk(byId('ev-stranded-tourist'), foot) && AC.triggerOk(byId('ev-stranded-tourist'), { ...foot, onFoot: false, driving: true }));
  ok('ambient: wanted_max', !AC.triggerOk(byId('ev-quiet-courier'), { ...foot, wanted: 2 }));
  ok('ambient: suppressed at 4 stars', AC.eligibleEvents(A, { ...foot, wanted: 4 }, 1e6).length === 0);
  ok('ambient: never in wastes', AC.eligibleEvents(A, { ...foot, district: 'wastes' }, 1e6).length === 0);
  const el = AC.eligibleEvents(A, foot, 1e6); ok('ambient: some eligible on foot at night in rough', el.length >= 3 && el.every(e => e._c.support !== 'stub'));
  const p1 = AC.pick(A, foot, 1e6, {}, () => 0.01); ok('ambient: pick returns eligible', !!p1 && el.includes(p1));
  const cd = {}; for (const e of el) cd[e.id] = 1e6 - 10; ok('ambient: per-event cooldown blocks', AC.pick(A, foot, 1e6, cd) === null);
  ok('ambient: npc plan respects shared budget', AC.npcPlan(byId('ev-exec-jacked'), 1).length === 1 && AC.npcPlan(byId('ev-exec-jacked'), 12).length === 3);
  ok('ambient: npc plan respects event cap', AC.npcPlan({ spawn: { npcs: ['civ', 'civ', 'civ', 'civ'], phone_npc_max: 2 }, caps: { phone_npc_max: 6 } }, 12).length === 2);
  ok('ambient: npc plan zero budget', AC.npcPlan(byId('ev-initiation-watch'), 0).length === 0);
  ok('ambient: interrupt = fight with extra crawlers', (() => { const p = AC.planChoice(byId('ev-initiation-watch'), 'interrupt'); return p.kind === 'fight' && p.extra.length === 2 && p.fx.wanted === 1; })());
  ok('ambient: thief chase = catch 20s', (() => { const p = AC.planChoice(byId('ev-o2-thief'), 'chase'); return p.kind === 'catch' && p.time === 20; })());
  ok('ambient: shoot', AC.planChoice(byId('ev-o2-thief'), 'shoot').kind === 'shoot');
  ok('ambient: heckle fight chance', AC.planChoice(byId('ev-street-preacher'), 'heckle', {}, () => 0.1).kind === 'fight' && AC.planChoice(byId('ev-street-preacher'), 'heckle', {}, () => 0.9).kind === 'instant');
  ok('ambient: broke for donation', AC.planChoice(byId('ev-street-preacher'), 'donate', { credits: 5 }).kind === 'broke');
  ok('ambient: every runnable event has a no-cost way out', A.events.filter(e => e._c.support !== 'stub').every(e => e._c.choices.some(id => { const o = e.choices.find(c => c.id === id).outcome; return !o.wanted && !(o.credits < 0) && !o.fight; })));
}

{ // heist:escape payload (PR #8) and gang backup
  const full = { id: 'quinn-villa', title: 'Quinn Villa', world: 'Mars', pos: { x: 1, z: 2 }, site: { x: 0, z: 0, r: 40 }, heat: 3, evading: false, security: 2, alarm: true, loot: { credits: 2000, item: 'jewels' }, t: 120, vehicle: 'rover' };
  const r = DC.escapeRequest(full, 'Mars');
  ok('escape: PR #8 payload maps', r && r.n === 3 && r.title === 'Quinn Villa' && r.loot === 2000 && r.item === 'jewels' && r.pos.x === 1 && r.vehicle === 'rover');
  ok('escape: quiet job is 1 car', DC.escapeRequest({ ...full, alarm: false, heat: 0, loot: null }).n === 1);
  ok('escape: alarm adds a car', DC.escapeRequest({ ...full, alarm: true, heat: 1, loot: { credits: 10 } }).n === 2);
  ok('escape: other world ignored', DC.escapeRequest(full, 'Luna') === null);
  ok('escape: garbage safe', DC.escapeRequest(null) === null && DC.escapeRequest('x') === null && DC.escapeRequest({ heat: 'lots', loot: 5, pos: 'here' }).n === 1);
  const g = { type: 'gang_backup', faction: 'saltblood', count: 3, durationSec: 180, armed: 'pistols' };
  const p = DC.backupPlan(g, 10, true);
  ok('backup: marrow 3 for 180 s', p.ok && p.n === 3 && p.dur === 180 && p.kind === 'thug' && p.weapon === 'pipe');
  ok('backup: phone cap 4', DC.backupPlan({ ...g, count: 5 }, 10, true).n === 4 && DC.backupPlan({ ...g, count: 5 }, 10, false).n === 5);
  ok('backup: trimmed to budget room', DC.backupPlan(g, 2, true).n === 2 && DC.backupPlan(g, 2, true).trimmed);
  ok('backup: no room refuses', DC.backupPlan(g, 0, true).why === 'budget');
  ok('backup: unknown faction refuses', DC.backupPlan({ ...g, faction: 'colsec' }, 9, true).why === 'faction');
  ok('backup: duration clamped', DC.backupPlan({ ...g, durationSec: 99999 }, 9, true).dur === 600 && DC.backupPlan({ ...g, durationSec: 1 }, 9, true).dur === 20);
  ok('backup: stays inside the 12 cap', [0, 4, 8, 11, 12].every(w => { const room = DC.npcBudget(w, 0, true); const q = DC.backupPlan({ ...g, count: 5 }, room, true); return w + (q.ok ? q.n : 0) <= 12; }));
  const sl = [0, 1, 2, 3].map(i => DC.escortSlot(i, 4, 0, 0, 0));
  ok('backup: slots flank the player on both sides', Math.sign(sl[0].x) !== Math.sign(sl[1].x) && sl.every(q => Math.abs(q.x) > 1.2 && q.z < 0) && sl[2].z < sl[0].z);
  ok('backup: target nearest hostile in range', DC.escortTarget({ x: 0, z: 0 }, { x: 0, z: 0 }, [{ x: 30, z: 0 }, { x: 5, z: 0 }, { x: 2, z: 0, alive: false }]).x === 5 && DC.escortTarget({ x: 0, z: 0 }, { x: 0, z: 0 }, [{ x: 40, z: 0 }]) === null);
  const B = JSON.parse(readFileSync(new URL('../data/barter.json', import.meta.url)));
  const gb = B.offers.filter(o => o.gives?.type === 'gang_backup');
  ok('backup: every barter gang_backup offer plans on desktop', gb.length >= 2 && gb.every(o => DC.backupPlan(o.gives, 12, false).ok));
}

{ // ssx:npc-down (PR #12 paramedic job)
  const T = new EventTarget(), got = []; T.addEventListener('ssx:npc-down', e => got.push(e.detail));
  ok('npc-down: fires with x, z, name', DC.emitNpcDown({ x: 3, z: -4, kind: 'junkie' }, T) && got.length === 1 && got[0].x === 3 && got[0].z === -4 && got[0].name === 'Junkie');
  DC.emitNpcDown({ x: 1, z: 1, kind: 'thug', escort: true }, T); DC.emitNpcDown({ x: 0, z: 0, name: 'Saltblood driver' }, T); DC.emitNpcDown({ x: 'a', role: 'victim' }, T);
  ok('npc-down: escort, driver and fallback names', got[1].name === 'Saltblood escort' && got[2].name === 'Saltblood driver' && got[3].name === 'Colonist' && got[3].x === 0);
  ok('npc-down: no target is a safe no-op', DC.emitNpcDown({ x: 0, z: 0 }, null) === false && DC.emitNpcDown({ x: 0, z: 0 }, { dispatchEvent() { throw new Error('x'); } }) === false);
  const src = readFileSync(new URL('../danger.js', import.meta.url), 'utf8'), ps = readFileSync(new URL('../pursuit.js', import.meta.url), 'utf8');
  ok('npc-down: wired in killNpc and chase wrecks', /function killNpc[\s\S]{0,400}emitNpcDown\(n\)/.test(src) && /u\.alive = false;[^\n]*emitNpcDown/.test(ps));
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
