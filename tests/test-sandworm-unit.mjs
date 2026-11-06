// node tests/test-sandworm-unit.mjs: sandworm rules (mars/sandwormcore.js) per /workspace/story/worm-mission.md: the 3 phases
// (3 plume surfacings, 4 gill sacs, a stun by ram/flame then the maw), eats capped at half the plots, the lines, the payout
// (1,500 cr + 150 ⭐ + a Worm Tooth, 800 cr to Sister Nettle), once per 3 game days, the story start, regrow after a win only.
import * as K from '../mars/sandwormcore.js';
await import('../savecode.js'); const C = globalThis.SSXSaveCore;
let bad = 0, n = 0; const ok = (k, c, v) => { n++; if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v).slice(0, 400)); } };
ok('key', K.SAVE_KEY === 'ssx.sandworm.v1' && C.KNOWN.includes(K.SAVE_KEY));
ok('lines', /Ground's shakin', boss!/.test(K.LINES.intro) && K.LINES.win === "Worm's down! Hell of a fertilizer." && /half the farm/.test(K.LINES.lose) && K.WHO === 'Tully');
ok('pay', K.PAY.cr === 1500 && K.PAY.stars === 150 && K.PAY.tooth === 800 && K.STAR_RATE === 1);
ok('tune', K.TUNE.surfacings === 3 && K.TUNE.sacs === 4 && K.TUNE.eatEveryS === 20 && K.TUNE.length === 40 && K.TUNE.triggerDays === 3);
// caps: half the farm, at least one
ok('cap', K.eatCap(6) === 3 && K.eatCap(5) === 2 && K.eatCap(1) === 1 && K.eatCap(0) === 1);
// phase 1: plume hits -> 3 surfacings
let f = K.newFight(6);
ok('start', f.phase === K.P.PLUMES && f.cap === 3 && K.health(f) === 1);
ok('plume 1 hit', K.hitPlume(f, 1) === false && f.surf === 0);
ok('plume surfaces', K.hitPlume(f, 1) === true && f.surf === 1 && f.plumeHp === K.TUNE.plumeHits);
K.hitPlume(f, 2); K.hitPlume(f, 2);
ok('phase 2', f.phase === K.P.SACS && f.surf === 3 && Math.abs(K.health(f) - 0.8) < 1e-9, f);
ok('no plume hits in 2', K.hitPlume(f, 5) === false && f.surf === 3);
// phase 2: four sacs, TUNE.sacHp each (v7.5.73: damage, crit-scaled by the caller)
ok('sac hit', K.hitSac(f, 0, 2) === 'hit' && f.sacs[0] === K.TUNE.sacHp - 2);
ok('sac pop', K.hitSac(f, 0, K.TUNE.sacHp) === 'pop' && K.sacsLeft(f) === 3);
ok('popped sac ignores', K.hitSac(f, 0, 1) === null);
K.hitSac(f, 1, 99); K.hitSac(f, 2, 99);
ok('maw shut in 2', K.hitMaw(f, 99) === null && K.hitHead(f, 99) === false);
ok('last sac', K.hitSac(f, 3, 99) === 'phase' && f.phase === K.P.CHARGE && Math.abs(K.health(f) - 0.3) < 1e-9);
// phase 3: maw only while stunned; slow ram doesn't count; flame needs time
ok('maw needs stun', K.hitMaw(f, 1) === null);
ok('slow ram', K.ram(f, 3) === false && f.stun === 0);
ok('flame builds', K.flameOn(f, 0.6) === false && K.flameOn(f, 0.7) === true && f.stun === K.TUNE.stunS);
f.stun = 0; ok('ram stuns', K.ram(f, -9) === true && f.stun > 0);
ok('maw hits', K.hitMaw(f, 2) === 'hit' && f.maw === K.TUNE.mawHp - 2);
ok('win', K.hitMaw(f, 99) === 'win' && f.over === 'win' && K.health(f) === 0);
// v7.5.73 crits: a rifle bolt (1.1) pops a sac in 2 hits, the maw goes in 5, 4 head shots stun; the body only chips
const rifle = { dmg: 1.1 }, rail = { dmg: 8 };
ok('crit sac', Math.ceil(K.TUNE.sacHp / K.critDmg(rifle, 'sac') - 1e-9) === 2 && K.critDmg(rail, 'sac') >= K.TUNE.sacHp, K.critDmg(rifle, 'sac'));
ok('crit maw', Math.ceil(K.TUNE.mawHp / K.critDmg(rifle, 'maw') - 1e-9) === 5 && K.critDmg(rail, 'maw') >= K.TUNE.mawHp);
ok('chip small', K.chipDmg(rifle) * 10 < K.critDmg(rifle, 'sac') && K.dmgOf(null) === 1 && K.dmgOf({ dmg: 999 }) === K.TUNE.maxDmg && K.dmgOf({ dmg: 0.01 }) === K.TUNE.minDmg);
let h = K.newFight(6); h.phase = K.P.CHARGE;
ok('head stun', [0, 1, 2].every(() => K.hitHead(h, 1.1) === false) && K.hitHead(h, 1.1) === true && h.stun === K.TUNE.stunS && h.head === 0, h);
ok('head no-op stunned', K.hitHead(h, 9) === false);
ok('chip maw', K.chip(h, 1) === 'hit' && h.maw === K.TUNE.mawHp - 1);
h = K.newFight(6); h.phase = K.P.SACS; ok('chip sac', K.chip(h, 1, 2) === 'hit' && h.sacs[2] === K.TUNE.sacHp - 1 && K.chip(h, 1, 9) === 'hit' && h.sacs[0] === K.TUNE.sacHp - 1);
ok('chip plumes', K.chip(K.newFight(6), 1) === null);

// v7.5.73 shots to kill, accurate vs careless, through the same rules on a fixed timeline: a rifle (1.1 dmg, 0.13 s),
// a plume moves, sacs + the open maw are small, the silo charge is TUNE.chargeFrom / chargeSpeed away; it eats a plot every
// TUNE.eatEveryS in phase 2 and one at the silo. aimer.p = chance a shot hits the weak point you aim at, aimer.body = it hits armour
function sim(aimer, seed = 7, nPlots = 6) {
  let x = seed >>> 0; const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const W = { dmg: 1.1 }, cd = 0.13, f = K.newFight(nPlots); let t = 0, shots = 0, charge = 0, eatT = K.TUNE.eatEveryS, gap = 0;
  const T = K.TUNE, maxT = 400;
  while (!f.over && t < maxT) {
    if (gap > 0) { gap -= cd; t += cd; continue; } // animations (breach, dive)
    if (f.phase === K.P.PLUMES) { f.autoT -= cd; if (f.autoT <= 0) { K.surface(f); K.ate(f); gap = 1.6; } }
    if (f.phase === K.P.SACS) { eatT -= cd; if (eatT <= 0) { eatT = T.eatEveryS; K.ate(f); gap = 1.6; if (f.over) break; continue; } }
    if (f.phase === K.P.CHARGE && !(f.stun > 0)) { charge += cd; if (charge >= T.chargeFrom / T.chargeSpeed) { charge = 0; K.ate(f); gap = 1; if (f.over) break; continue; } }
    if (f.phase === K.P.CHARGE && f.stun > 0) { f.stun -= cd; if (f.stun <= 0) { f.stun = 0; charge = 0; } }
    shots++; t += cd; const r = rnd();
    const weak = r < aimer.p, body = !weak && r < aimer.p + aimer.body;
    const ph = f.phase;
    if (ph === K.P.PLUMES) { if (weak) { if (K.hitPlume(f, 1)) gap = 1.6; } }
    else if (ph === K.P.SACS) { const i = f.sacs.findIndex(h => h > 0); if (weak) { if (K.hitSac(f, i, K.critDmg(W, 'sac')) === 'phase') { gap = 0.8; charge = 0; } } else if (body) { if (K.chip(f, K.chipDmg(W), i) === 'phase') { gap = 0.8; charge = 0; } } }
    else if (f.stun > 0) { if (weak) K.hitMaw(f, K.critDmg(W, 'maw')); else if (body) K.chip(f, K.chipDmg(W)); }
    else if (weak) K.hitHead(f, K.dmgOf(W));
  }
  return { shots, t: Math.round(t * 10) / 10, over: f.over || 'timeout', eaten: f.eaten };
}
const acc = [1, 2, 3, 4, 5].map(sd => sim({ p: 0.8, body: 0.15 }, sd)), rand = [1, 2, 3, 4, 5].map(sd => sim({ p: 0.12, body: 0.5 }, sd));
const avg = a => a.reduce((s, r) => s + r.shots, 0) / a.length, avgT = a => a.reduce((s, r) => s + r.t, 0) / a.length;
console.log('shots-to-kill  accurate:', acc.map(r => `${r.shots} shots/${r.t}s/${r.over}`).join(' · '));
console.log('shots-to-kill  careless:', rand.map(r => `${r.shots} shots/${r.t}s/${r.over}`).join(' · '));
ok('accurate wins fast', acc.every(r => r.over === 'win' && r.t < 45) && avg(acc) <= 40, acc);
ok('careless is slow', avgT(rand) > 2 * avgT(acc) && avg(rand) > 4 * avg(acc), { acc: avg(acc), rand: avg(rand), accT: avgT(acc), randT: avgT(rand) });

// losing: it eats up to the cap then gives up
let g = K.newFight(4);
ok('ate', K.ate(g) === 'ate' && K.ate(g) === 'lose' && g.over === 'lose' && g.eaten === 2);
// plot pick: ripe first, nearest, skips eaten
const plots = [{ key: 'a', crop: 'x', ripe: 0, x: 1, z: 0 }, { key: 'b', crop: 'x', ripe: 1, x: 9, z: 0 }, { key: 'c', crop: 'x', ripe: 1, x: 3, z: 0 }, { key: 'd', crop: null, ripe: 0, x: 0, z: 0 }];
ok('pick ripe near', K.pickPlot(plots, new Set(), { x: 0, z: 0 }).key === 'c');
ok('pick skips', K.pickPlot(plots, new Set(['c', 'b']), { x: 0, z: 0 }).key === 'a' && K.pickPlot(plots, new Set(['a', 'b', 'c'])) === null);
// trigger: once per 3 game days; story after the 2nd harvest
let s = K.fresh(); s.lastDay = 10;
ok('too soon', K.canTrigger(s, 12, 0) === false && K.canTrigger(s, 13, 0) === true && K.canTrigger(s, 13, 0.99) === false);
ok('story', K.storyDue(s) === false && (s.harvests = 2, K.storyDue(s)) && (s.story = true, !K.storyDue(s)));
// geometry
ok('segHit', K.segHit({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 5, y: 0.5, z: 0 }, 1) > 0.4 && K.segHit({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 5, y: 3, z: 0 }, 1) === -1);
ok('bez', K.bez({ x: 0, y: 0, z: 0 }, { x: 5, y: 10, z: 0 }, { x: 10, y: 0, z: 0 }, 0.5).y === 5);
ok('heavy', K.hitsOf({ dmg: 50 }) === 2 && K.hitsOf({ dmg: 10 }) === 1 && K.hitsOf(null) === 1);
// finish: win -> eaten plots regrow next day; lose -> only chewed (visual) racks come back
s = K.fresh(); s.stats.spawns = 1; s.eaten = [{ farm: 'farm', kind: 'cut', day: 5, fight: 1 }, { farm: 'farm2', kind: 'f2', day: 5, fight: 1 }];
K.finish(s, { over: 'win' }, 5); ok('win regrows', s.eaten.length === 2 && K.due(s, 5).length === 0 && K.due(s, 6).length === 2 && s.stats.kills === 1 && s.lastDay === 5);
s = K.fresh(); s.stats.spawns = 1; s.eaten = [{ farm: 'farm', kind: 'cut', day: 5, fight: 1 }, { farm: 'farm', kind: 'chew', day: 5, fight: 1 }];
K.finish(s, { over: 'lose' }, 5); ok('lose keeps losses', s.eaten.length === 1 && s.eaten[0].kind === 'chew' && s.stats.losses === 1);
// payout + tooth
s = K.fresh(); const p = K.payout(s); ok('payout', p.cr === 1500 && p.stars === 150 && s.teeth === 1);
ok('sell', K.sellTooth(s).cr === 800 && s.teeth === 0 && K.sellTooth(s).ok === false);
// migrate: junk-proof, keeps teeth
ok('migrate', K.migrate('nope').teeth === 0 && K.migrate(JSON.stringify({ teeth: 2, story: true, eaten: [{ farm: 'x', day: 1 }, { farm: 'farm', day: 2 }] })).eaten.length === 1 && K.migrate({ teeth: 2 }).teeth === 2);
// dedupe
let t = 0; const ag = K.makeActGuard(() => t); let runs = 0; ag.run('a', () => runs++); ag.run('a', () => runs++); t = 301; ag.run('a', () => runs++);
ok('guard', runs === 2);
ok('fiction', !/\b(weed|cannabis|opium|heroin|cocaine|meth)\b/i.test(JSON.stringify(K.LINES)));
console.log(bad ? `sandworm unit: ${bad} of ${n} FAILED` : `sandworm unit OK (${n} checks)`); process.exit(bad ? 1 : 0);
