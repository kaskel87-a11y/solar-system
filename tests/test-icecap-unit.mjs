// Unit tests for mars/icecapcore.js (Planum Australe ice cap: pure logic). Run: node tests/test-icecap-unit.mjs
import * as C from '../mars/icecapcore.js';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } };

// terrain: plain Mars outside, a continuous downhill run inside, flat lane, kickers with a lip
ok('outsideUntouched', C.groundY(0, 0, 3.3) === 3.3 && C.groundY(C.CX + 400, 800, -2) === -2);
ok('summitHigh', C.groundY(C.CX, C.Z_TOP, 0) > C.H - 1, C.groundY(C.CX, C.Z_TOP, 0));
ok('laneFlat', Math.abs(C.groundY(C.CX, C.FOUL, 5) - 0) < 1e-6 && Math.abs(C.groundY(C.CX + 2, C.FOUL + C.PIN0, 5)) < 1e-6);
let mono = true, cont = true, prev = C.groundY(C.CX, C.Z_TOP, 0);
for (let z = C.Z_TOP + 1; z <= C.Z_BOT; z += 1) { const y = C.groundY(C.CX + 12, z, 0); if (y > prev + 0.6) mono = false; if (Math.abs(y - prev) > 1.2) cont = false; prev = y; }
ok('runFallsOffPiste', mono && cont);
const k = C.KICKS[1]; ok('kickerLip', C.groundY(C.CX, k - 0.2, 0) - C.groundY(C.CX, k + 0.2, 0) > 1.8, C.groundY(C.CX, k - 0.2, 0) - C.groundY(C.CX, k + 0.2, 0));
let edge = 0; for (let z = C.BOUNDS.z0; z < C.BOUNDS.z1; z += 7) for (const x of [C.BOUNDS.x0 + 0.1, C.BOUNDS.x1 - 0.1]) edge = Math.max(edge, Math.abs(C.groundY(x, z, 1.5) - 1.5));
ok('edgesBlend', edge < 1e-6, edge);
ok('zoneFlags', C.onSnow(C.CX, 800) && !C.onSnow(0, 0) && C.rockFree(C.CX, 800) && !C.rockFree(0, -200) && C.atLane(C.CX, C.FOUL - 1) && C.onPiste(C.CX, 700));

// snowboard: rolls downhill, carves, launches off a kicker, lands tricks, wipes out on a sideways landing
const g = (x, z) => C.groundY(x, z, 0);
let b = C.freshBoard(C.CX, C.Z_TOP + 4); b.y = g(b.x, b.z); let air = 0, maxV = 0, lands = [];
for (let i = 0; i < 60 * 40 && b.z < C.Z_BOT; i++) { const ev = C.boardStep(b, { steer: (C.CX - b.x) * 0.08 - Math.sin(b.head) * 0.0, tuck: 1 }, 1 / 60, g); if (b.air) air++; maxV = Math.max(maxV, b.v); if (ev) lands.push(ev); }
ok('boardReachesFinish', b.z >= C.Z_BOT, b.z);
ok('boardSpeed', maxV > 28 && maxV <= C.BOARD.VMAX, maxV);
ok('raceLineStaysCentral', Math.abs(b.x - C.CX) < 8, b.x);
ok('boardKickerAir', air > 60 && lands.some(e => e.ok && e.airT > 0.8), `${air} ${JSON.stringify(lands.map(e => e.airT?.toFixed?.(2)))}`);
ok('airPays', lands.filter(e => e.ok && e.airT >= 0.5).every(e => e.cr === Math.round(e.airT * C.AIR_CR_PER_S)));
// a 360 off the next kicker: spin hard in the air until the board comes round once
b = C.freshBoard(C.CX, C.KICKS[3] - 40, Math.PI); b.v = 20; b.y = g(b.x, b.z); b.vy = (g(b.x, b.z + 20 / 60) - b.y) * 60; let ev = null, steps = 0;
while (!ev && steps++ < 600) { const st = b.air ? (Math.abs(b.spinAcc) < 2 * Math.PI ? 1 : 0) : (C.CX - b.x) * 0.1; ev = C.boardStep(b, { steer: st, hold: b.air }, 1 / 60, g); if (ev && !ev.ok && !ev.wipe) ev = null; if (ev && !b.air && !ev.wipe && ev.airT < 0.3) ev = null; }
ok('spin360', ev && ev.ok && ev.tricks.some(t => /360/.test(t)) && ev.stars === ev.tricks.length * C.TRICK_STARS, JSON.stringify(ev));
b = C.freshBoard(C.CX, 500); b.air = true; b.y = 2; b.vy = 0; b.spin = Math.PI / 2; b.airT = 1; ev = null;
for (let i = 0; i < 300 && !ev; i++) ev = C.boardStep(b, {}, 1 / 60, () => 0);
ok('sidewaysWipes', ev && ev.wipe && b.wip > 0);
ok('trickNames', C.trickNames(Math.PI * 2.1, 0.5).join() === 'Backside 360,Indy grab' && C.trickNames(-Math.PI, 0).join() === 'Frontside 180' && C.trickNames(0.3, 0.1).length === 0);
ok('grabStyles', C.trickNames(0, 0.5, 'mute').join() === 'Mute grab' && C.trickNames(0, 0.4, 'stale').join() === 'Stalefish' && C.trickNames(0, 1.1, 'indy').join() === 'Method grab');
ok('cork540', C.trickNames(Math.PI * 3, 0.5, 'method').join() === 'Backside 540,Method grab,Cork');
ok('trickPoints', C.trickPoints(['Backside 360', 'Mute grab'], 1.2) > C.trickPoints(['Indy grab'], 0.2) && C.trickPoints(['50-50'], 0.5) >= 320);
ok('combo', C.nextCombo({ mult: 1, left: 0 }, 0, true).mult === 1 && C.nextCombo({ mult: 1, left: 2 }, 0, true).mult === 2 && C.nextCombo({ mult: 4, left: 0.2 }, 0.5, false).mult === 1 && C.nextCombo({ mult: 6, left: 1 }, 0, true).mult === 6);
b = C.freshBoard(C.CX, C.FOUL - 10, Math.PI); b.v = 10; for (let i = 0; i < 120; i++) C.boardStep(b, { brake: 1 }, 1 / 60, g);
ok('brakeStops', b.v === 0, b.v);

// bowling sim: deterministic, gutter balls score 0, a pocket hook strikes, the rival head pin counts
const s1 = C.simulate({ aim: 0.01, power: 0.8, spin: -0.5 }), s2 = C.simulate({ aim: 0.01, power: 0.8, spin: -0.5 });
ok('simDeterministic', s1.count === s2.count && s1.knocked.join() === s2.knocked.join());
const gut = C.simulate({ aim: 0.1, power: 0.6, spin: 1 });
ok('gutter', gut.gutter && gut.count === 0);
let strikes = 0, tot = 0, headOnly = 0;
for (let a = -0.1; a <= 0.1; a += 0.01) for (let s = -1; s <= 1; s += 0.25) { const r = C.simulate({ aim: a, power: 0.8, spin: s }); tot++; if (r.count === 10) strikes++; if (r.headHit) headOnly++; }
ok('strikesPossibleNotFree', strikes > 3 && strikes < tot * 0.35, `${strikes}/${tot}`);
const st = C.simulate({ aim: 0, power: 0.8, spin: 0 });
ok('headHitStraight', st.headHit && st.knocked.includes(0) && st.headV && st.frames.length > 10);
const second = C.simulate({ aim: 0.04, power: 0.8, spin: 0 }, st.knocked.length === 10 ? null : C.rack().map((_, i) => !st.knocked.includes(i)));
ok('standingOnly', second.knocked.every(i => !st.knocked.includes(i) || st.count === 10));

// scoring: strikes, spares, opens, frame 3 bonus balls
const sc = r => C.score(r);
ok('perfect', sc([10, 10, 10, 10, 10]).total === 90 && sc([10, 10, 10, 10, 10]).done);
ok('allOpen', sc([3, 4, 5, 2, 1, 1]).total === 16 && sc([3, 4, 5, 2, 1, 1]).done);
ok('spare', sc([7, 3, 5, 0, 0, 0]).frames[0].score === 15 && sc([7, 3, 5, 0, 0, 0]).frames[0].marks.join('') === '7/');
ok('strikeMarks', sc([10, 3, 4, 10, 10, 10]).frames.map(f => f.marks.join('')).join('|') === 'X|34|XXX');
ok('frame3spare', sc([0, 0, 0, 0, 9, 1, 5]).total === 15 && sc([0, 0, 0, 0, 9, 1]).done === false);
ok('pending', sc([10]).frames[0].score === null && !sc([10]).done);
const pos = C.position;
ok('position', pos([]).fresh && pos([7]).ball === 1 && !pos([7]).fresh && pos([10]).frame === 1 && pos([10, 10, 10]).fresh && pos([10, 10, 10, 4]).fresh === false && pos([10, 10, 3, 4]).done && pos([10, 10, 10, 10]).fresh);
ok('position3spare', pos([1, 1, 1, 1, 6, 4]).fresh === true && pos([1, 1, 1, 1, 6, 4]).ball === 2);

// payouts (story/snow-bowling.md): pins 10 cr, head-pin +300, strike +500, Perfect Cold 2,000 cr + 200 stars
const pp = C.payout([10, 10, 10, 10, 10], 5);
ok('perfectCold', pp.perfect && pp.strikes === 5 && pp.cr === 50 * 10 + 5 * 300 + 5 * 500 + 2000 && pp.stars === 200, JSON.stringify(pp));
const p3 = C.payout([10, 10, 10, 3, 4], 3);
ok('perfectIsFirstBalls', p3.perfect && p3.strikes === 3);
const p0 = C.payout([7, 2, 10, 5, 1], 1);
ok('plainPay', !p0.perfect && p0.cr === 25 * 10 + 300 + 500 && p0.stars === 0, JSON.stringify(p0));
ok('noRivalNoHead', C.payout([5, 4, 3, 3, 2, 2], 2, false).cr === 190);
ok('ballPay', C.ballPay(10, true, true) === 900 && C.ballPay(3, false, false) === 30);

// swipe -> throw, keyboard nudges
ok('swipeShort', !C.swipeThrow([{ x: 0, y: 100, t: 0 }, { x: 0, y: 80, t: 50 }]).ok);
const sw = C.swipeThrow([{ x: 100, y: 300, t: 0 }, { x: 100, y: 200, t: 60 }, { x: 100, y: 100, t: 120 }, { x: 100, y: 20, t: 180 }]);
ok('swipeStraight', sw.ok && sw.aim === 0 && sw.spin === 0 && sw.power > 0.9);
const sr = C.swipeThrow([{ x: 100, y: 300 }, { x: 100, y: 230 }, { x: 102, y: 170 }, { x: 115, y: 120 }, { x: 140, y: 90 }, { x: 170, y: 80 }]);
ok('swipeCurveSpins', sr.ok && sr.spin > 0.5 && sr.aim > 0, JSON.stringify(sr));
ok('nudge', C.nudge({ aim: 0.1, power: 1, spin: 0 }, 'aim', 1).aim === 0.1 && C.nudge({}, 'power', -1).power === 0.65 && C.nudge({}, 'spin', 1).spin === 0.25);

// taps, rivals
ok('realTap', C.isRealTap({ id: 1, x: 0, y: 0 }, { id: 1, x: 6, y: 6 }) && !C.isRealTap({ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }) && !C.isRealTap({ id: 1, x: 0, y: 0 }, { id: 1, x: 0, y: 0 }, 12) && !C.isRealTap({ id: 1, x: 0, y: 0 }, { id: 1, x: 9, y: 9 }));
ok('rivalRoster', C.nextRival({}, 0)?.id === 'rusty' && C.nextRival({ rusty: { back: 100 } }, 50)?.id === 'jawbone' && C.nextRival({ rusty: { back: 9 }, jawbone: { back: 9 }, deacon: { back: 9 } }, 5) === null);
ok('lines', C.LINES.benny.startsWith('Ten pins, one lane') && C.LINES.rival.length === 2 && C.RENT === 50 && C.RUN_SECS === 90);

// v7.5.67 Planum X: faster board, superpipe, slopestyle booters, rails/boxes. Race line + bowling stay put.
ok('raceLineClearOfPark', C.parkOpen(C.CX, 760) === 0 && C.parkOpen(C.CX + 12, 760) === 0 && C.FEATURES.every(f => Math.abs(f.x - C.CX) > 14) && C.PARK_KICKS.every(k => Math.abs(k.x - C.CX) - k.half > 14));
{
  const z = 760, floor = C.groundY(C.PIPE.x, z, 0), fall = C.groundY(C.CX, z, 0);
  const lip = C.groundY(C.PIPE.x + C.PIPE.flat + C.PIPE.R * 0.99, z, 0);
  ok('pipeFloorFollowsFall', Math.abs(floor - fall) < 1.2, { floor, fall });
  ok('pipeCoping', lip - floor > 5, lip - floor);
  ok('pipeEntranceLow', C.pipeWall(C.PIPE.x + C.PIPE.flat + C.PIPE.R * 0.9, C.PIPE.z0 - 20) === 0);
}
const pk = C.PARK_KICKS[2];
ok('parkKickerLip', C.groundY(pk.x, pk.z - 0.2, 0) - C.groundY(pk.x, pk.z + 0.2, 0) > 3, C.groundY(pk.x, pk.z - 0.2, 0) - C.groundY(pk.x, pk.z + 0.2, 0));
{
  const k0 = C.PARK_KICKS[0];
  let pb = C.freshBoard(k0.x, k0.z - 55, Math.PI); pb.y = g(pb.x, pb.z); pb.v = 8; let pair = 0, pmax = 0, pdrift = 0;
  for (let i = 0; i < 60 * 12 && pb.z < k0.z + 40; i++) { const ev = C.boardStep(pb, { tuck: 1, steer: (k0.x - pb.x) * 0.15 }, 1 / 60, g); if (pb.air) pair++; pmax = Math.max(pmax, pb.v); pdrift = Math.max(pdrift, Math.abs(pb.x - k0.x)); if (ev && ev.wipe) break; }
  ok('parkBoosterAir', pair > 20 && pb.z > k0.z && pdrift < 8, { pair, z: pb.z, pmax, pdrift });
}
{
  const rail = C.FEATURES.find(f => f.id === 'rail-down');
  let rb = C.freshBoard(rail.x, rail.z0 + 1.2, Math.PI); rb.v = 18; rb.air = true; rb.airT = 0.4; rb.vy = -2; rb.y = g(rb.x, rb.z) + rail.h + 0.15;
  let gev = null, saw = false;
  for (let i = 0; i < 400 && !gev; i++) { if (rb.grind) saw = true; gev = C.boardStep(rb, { steer: 0.05 }, 1 / 60, g); if (gev && !gev.ok) break; }
  ok('railGrind', saw && gev && gev.ok && gev.grind && gev.tricks[0] === '50-50' && gev.stars === C.TRICK_STARS, JSON.stringify(gev));
}
{
  const box = C.FEATURES.find(f => f.kind === 'box');
  let bb = C.freshBoard(box.x, box.z0 - 3, Math.PI); bb.v = 16; bb.y = g(bb.x, bb.z);
  let bev = null, saw = false;
  for (let i = 0; i < 300 && !bev; i++) { if (bb.grind) saw = true; bev = C.boardStep(bb, { tuck: 1 }, 1 / 60, g); }
  ok('boxGrind', saw && bev && bev.ok && /press|slide/i.test(bev.tricks[0] || ''), JSON.stringify(bev));
}
{
  let pb = C.freshBoard(C.PIPE.x, C.PIPE.z0 + 24, Math.PI); pb.v = 22; pb.y = g(pb.x, pb.z); let airF = 0, wall = 0;
  for (let i = 0; i < 60 * 8 && pb.z < C.PIPE.z1 - 8; i++) {
    const pi = C.pipeZone(pb.x, pb.z); if (pi) wall = Math.max(wall, pi.wall);
    const ev = C.boardStep(pb, { steer: pb.air ? 0 : -1, tuck: pb.air ? 0 : 1 }, 1 / 60, g);
    if (pb.air) airF++;
    if (ev && ev.wipe) break;
  }
  ok('pipeAir', airF > 25 && wall > 0.75 && pb.z > C.PIPE.z0 + 80, { airF, wall, x: +pb.x.toFixed(1), z: +pb.z.toFixed(1) });
}

// v7.5.59 balance: ice drift + Perfect Cold cool-down
ok('wobbleBounds', Math.abs(C.wobble(1, 0)) <= C.WOBBLE + 1e-9 && Math.abs(C.wobble(1, 1)) <= C.WOBBLE + 1e-9 && C.wobble(0.85, 0.5) === 0);
{ let k = 0, h = 0; const N = 400; for (let i = 0; i < N; i++) { const r = C.simulate({ aim: C.wobble(0.85, i / (N - 1)), power: 0.85 }); if (r.count === 10) k++; if (r.headHit) h++; }
  const rate = k / N, perfect = rate ** 3; ok('straightNotAlwaysStrike', rate > 0.45 && rate < 0.95, rate); ok('perfectRare', perfect < 0.75, perfect); ok('headPinStillHit', h === N, h); }
ok('perfectCool', C.perfectPay(0, 1e12).full && !C.perfectPay(1e12, 1e12 + 60000).full && C.perfectPay(1e12, 1e12 + C.PERFECT_COOL_S * 1000).full && C.perfectPay(1e12, 1e12 + 1).cr === 0);

console.log(fails ? `icecap unit: ${fails}/${n} FAILED` : `icecap unit: all ${n} passed`);
process.exit(fails ? 1 : 0);
