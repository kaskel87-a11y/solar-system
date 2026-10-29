// Unit tests for mars/smugglecore.js (pure logic). Run: node tests/test-smuggle-unit.mjs
import * as C from '../mars/smugglecore.js';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// keys: free on main and every open PR; B / X only in space
ok('keys', C.RUN_KEY === 'Digit8' && C.FAVOR_KEY === 'Digit9' && C.BRIBE_KEY === 'KeyB' && C.DUMP_KEY === 'KeyX');
// route geometry
const ph = C.phobosAt(0, 0);
ok('phobosR', near(Math.hypot(ph[0], ph[2]), C.PHOBOS.R, 1e-9) && ph[1] === C.PHOBOS.y);
const ph2 = C.phobosAt(0, 10); ok('phobosMoves', near(Math.atan2(ph2[2], ph2[0]), C.PHOBOS.w * 10, 1e-9));
const bs = C.beaconsFor(ph);
ok('twoBeacons', bs.length === 2 && bs[0].id === 'kestrel' && bs[1].id === 'warden');
ok('beaconsOffLane', bs.every(b => Math.abs(Math.hypot(b.pos[0] - ph[0] * C.BEACONS.find(x => x.id === b.id).at, b.pos[2] - ph[2] * C.BEACONS.find(x => x.id === b.id).at) - C.SCAN.offset) < 1e-6));
ok('beaconsOppositeSides', Math.sign(bs[0].pos[2]) !== Math.sign(bs[1].pos[2]), JSON.stringify(bs.map(b => b.pos)));
ok('restPointsAtLane', bs.every(b => near(C.len(b.rest), 1)));
// beam sweeps within +-sweep of the rest direction, stays unit length
let maxA = 0; for (let t = 0; t < 30; t += 0.1) { const d = C.beamDir(bs[0].rest, t); ok('beamUnit', near(C.len(d), 1, 1e-9)); const r = bs[0].rest; const c = (d[0] * r[0] + d[2] * r[2]) / Math.hypot(r[0], r[2]) / Math.hypot(d[0], d[2]); maxA = Math.max(maxA, Math.acos(Math.min(1, c))); }
ok('beamSweep', maxA > C.SCAN.sweep * 0.95 && maxA <= C.SCAN.sweep + 1e-6, maxA);
// cone
const b0 = bs[0], inside = b0.pos.map((v, i) => v + b0.rest[i] * 10);
ok('inCone', C.inCone(b0.pos, b0.rest, inside));
ok('outOfRange', !C.inCone(b0.pos, b0.rest, b0.pos.map((v, i) => v + b0.rest[i] * (C.SCAN.range + 1))));
const side = [-b0.rest[2], 0, b0.rest[0]]; ok('outOfCone', !C.inCone(b0.pos, b0.rest, b0.pos.map((v, i) => v + b0.rest[i] * 5 + side[i] * 10)));
// line of sight: Mars blocks a beam that passes through it
ok('blockedByMars', C.blocked([-20, 0, 0], [20, 0, 0], [{ c: [0, 0, 0], r: 3.3 }]));
ok('clearLos', !C.blocked([-20, 10, 0], [20, 10, 0], [{ c: [0, 0, 0], r: 3.3 }]));
ok('endpointsDontBlock', !C.blocked([0, 0, 0], [20, 0, 0], [{ c: [0, 0, 0], r: 3.3 }]));
// scan: fills while seen, decays when not, boost fills faster, heat faster, roll cuts + ghosts
let s = { v: 0, ghost: 0 }, t = 0; while (!s.flagged && t < 10) { s = C.scanStep(s, 0.05, { seen: true }); t += 0.05; }
ok('scanFlagsInTime', s.flagged && near(t, C.SCAN.fill / C.SCAN.rate, 0.06), t);
let sb = { v: 0 }, tb = 0; while (!sb.flagged && tb < 10) { sb = C.scanStep(sb, 0.05, { seen: true, boost: true }); tb += 0.05; }
ok('boostFillsFaster', tb < t * 0.6, `${tb} vs ${t}`);
let sh = { v: 0 }, th = 0; while (!sh.flagged && th < 10) { sh = C.scanStep(sh, 0.05, { seen: true, heat: 5 }); th += 0.05; }
ok('heatFillsFaster', th < t, `${th} vs ${t}`);
let sd = C.scanStep({ v: 0.5, ghost: 0 }, 0.1, { seen: false }); ok('scanDecays', near(sd.v, 0.5 - 0.1 * C.SCAN.decay) && !sd.flagged);
let sr = C.scanStep({ v: 0.8, ghost: 0 }, 0.05, { seen: true, rolled: true });
ok('rollCutsScan', sr.dodged && sr.v < 0.8 - C.SCAN.rollCut + 0.01 && sr.ghost > 0, JSON.stringify(sr));
let sg = C.scanStep(sr, 0.05, { seen: true }); ok('ghostBlocksFill', sg.v <= sr.v);
ok('rollWithoutScanNoDodge', !C.scanStep({ v: 0, ghost: 0 }, 0.05, { seen: false, rolled: true }).dodged);
// lock
let L = { v: 0, ghost: 0 }, lt = 0, hit = false; while (!hit && lt < 10) { const r = C.lockStep(L, 0.05, { d: 10 }); hit = r.hit; L = r; lt += 0.05; }
ok('lockHitsInTime', hit && near(lt, C.LOCK.fill, 0.06) && L.v === 0 && L.ghost > 0, lt);
ok('lockOutOfRange', C.lockStep({ v: 1, ghost: 0 }, 0.1, { d: C.LOCK.range + 1 }).v < 1);
const lr = C.lockStep({ v: 2, ghost: 0 }, 0.05, { d: 5, rolled: true }); ok('rollBreaksLock', lr.broke && lr.v < 2 - C.LOCK.rollCut * C.LOCK.fill + 0.01 && !lr.hit);
// interceptors: phones capped at 2 (12-NPC budget), desktop at 3
ok('icpMobile', C.interceptorCount(0, true) === 1 && C.interceptorCount(5, true) === 2);
ok('icpDesktop', C.interceptorCount(2, false) === 2 && C.interceptorCount(5, false) === 3 && C.interceptorCount(99, false) === 3);
// bribes
ok('bribeFallback', C.bribePrice(0) === 110 && C.bribePrice(2) === 250 && C.bribePrice(9) === C.bribePrice(5) && C.bribePrice(1) % 5 === 0);
ok('refuseRises', C.refuseChance(0) < C.refuseChance(3) && C.refuseChance(5) <= 0.6 && C.refuseChance(0) >= 0.05);
// payout
const clean = C.payout({ hp: 100, flags: 0 }), hot = C.payout({ hp: 100, flags: 1 }), dmg = C.payout({ hp: 32, flags: 0 });
ok('payClean', clean.cash === C.PAY.base + C.PAY.clean, clean.cash);
ok('payHot', hot.cash === Math.round(C.PAY.base * 1.18 / 5) * 5, hot.cash);
ok('payDamaged', dmg.cash < clean.cash && dmg.cash % 5 === 0);
ok('payFlagsCapped', C.payout({ hp: 100, flags: 9 }).cash === C.payout({ hp: 100, flags: 3 }).cash);
ok('favorWorthMore', clean.favorValue > clean.cash);
// favor bundle: priciest first, within room, close to value
const items = [{ id: 'glowdust', base: 95, room: 12 }, { id: 'lowg', base: 50, room: 15 }, { id: 'redstatic', base: 170, room: 8 }, { id: 'voidhoney', base: 360, room: 4 }];
const fb = C.favorBundle(800, items);
ok('favorBundle', fb[0].id === 'voidhoney' && fb[0].qty === 2 && C.bundleValue(fb, items) <= 800 && C.bundleValue(fb, items) > 700, JSON.stringify(fb));
ok('favorRoom', C.favorBundle(5000, items.map(i => ({ ...i, room: i.id === 'voidhoney' ? 1 : 0 }))).reduce((a, x) => a + x.qty, 0) === 1);
ok('favorNoRoom', C.favorBundle(800, items.map(i => ({ ...i, room: 0 }))).length === 0);
// heat cooling + state
ok('coolHeat', C.coolHeat(3, 0) === 3 && C.coolHeat(3, 151) === 2 && C.coolHeat(1, 9999) === 0);
const run = C.newRun(5); ok('newRun', run.phase === 'outbound' && run.hp === 100 && run.flags === 0 && C.PHASES.includes(run.phase));
const st = C.loadState('{"heat":9,"runs":"3","earned":"x"}'); ok('loadState', st.heat === 5 && st.runs === 3 && st.earned === 0 && st.v === 1);
ok('loadStateBad', C.loadState('{nope').runs === 0 && C.loadState(null).heat === 0);
// chatter
ok('lines', Object.values(C.LINES).every(a => a.length && a.every(l => typeof l === 'string' && l.length < 110)) && C.line('nope') === '' && C.line('scan', 3) === C.LINES.scan[1]);

console.log(fails ? `${fails}/${n} FAILED` : `ALL PASS (${n})`); process.exit(fails ? 1 : 0);
