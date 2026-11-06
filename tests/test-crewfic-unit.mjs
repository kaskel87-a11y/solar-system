// node tests/test-crewfic-unit.mjs: v7.5.76 crew mission chains (mars/crewficcore.js). Only the four crewcore ROSTER members
// get chains; each is 3 beats of 2-4 visible objectives with a shown reward; lock until hired; one active chain; pause keeps
// progress; objectives tick in order only; each beat pays exactly once (double claim, reload, replay); perks; load sanitising.
import * as K from '../mars/crewficcore.js';
import { ROSTER, SLOTS } from '../crewcore.js';
import { SAFE_TIERS } from '../heistcore.js';
let bad = 0, n = 0; const ok = (k, c, v) => { n++; if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v)); } };
const RE = (s) => K.load(JSON.stringify(s));
ok('key', K.KEY === 'ssx.crewfic.v1' && /^ssx\.[a-z]+\.v1$/.test(K.KEY));
ok('roster only', JSON.stringify(K.IDS) === JSON.stringify(ROSTER.map(r => r.id)) && Object.keys(K.CHAINS).length === 4, Object.keys(K.CHAINS));
ok('no second set', !['slick', 'skiv', 'ines', 'benny'].some(x => K.CHAINS[x]));
ok('hiring gates untouched', JSON.stringify(SLOTS) === JSON.stringify([10000, 25000, 50000, 100000]));
// data shape: 3 beats, 2-4 objectives, rewards shown, no hidden rewards, places away from Red Static Gulch (AJ 150, 330)
for (const id of K.IDS) {
  const C = K.CHAINS[id]; ok(id + ' 3 beats', C.beats.length === 3); ok(id + ' perk', !!C.perk?.line);
  C.beats.forEach((B, b) => {
    ok(`${id}.${b} objectives 2-4`, B.obj.length >= 2 && B.obj.length <= 4, B.obj.length);
    ok(`${id}.${b} objective text`, B.obj.every(o => o.txt && o.txt.length > 6 && ['go', 'hold', 'act', 'pay', 'crack', 'clean', 'choice'].includes(o.t)));
    ok(`${id}.${b} act/pay/crack have a button`, B.obj.every(o => !['act', 'pay', 'crack'].includes(o.t) || (o.label && o.at)));
    ok(`${id}.${b} reward shown`, K.beatRewardLines(id, b).length >= 1 && K.beatRewardLines(id, b).every(l => /\+[\d,]+ cr · \+[\d,]+⭐|permanent/.test(l) && !/\?\?/.test(l)), K.beatRewardLines(id, b));
    ok(`${id}.${b} far from the gulch`, B.obj.every(o => !o.at || Math.hypot(o.at[0] - 150, o.at[1] - 330) > 80));
    ok(`${id}.${b} dialogue`, B.say && B.say.length > 30);
  });
  ok(id + ' beat 3 shows the perk', K.beatRewardLines(id, 2).some(l => l.includes(C.perk.line)));
  ok(id + ' choice or setback', !!C.beats[2].choice || C.beats[2].obj.some(o => /Setback/.test(o.txt)));
}
ok('reward line format', K.rewardLine({ cr: 900, stars: 120 }, K.CHAINS.dex.perk) === '+900 cr · +120⭐ · Dex crew payoff +10% (permanent)', K.rewardLine({ cr: 900, stars: 120 }, K.CHAINS.dex.perk));
ok('spread across Mars', new Set(K.IDS.flatMap(id => K.CHAINS[id].beats.map(B => B.where))).size >= 8);
// locks + one active chain
let s = K.fresh();
ok('locked until hired', K.status(s, 'dex', []) === 'locked' && !K.accept(s, 'dex', []).ok && s.active === null);
ok('ready once hired', K.status(s, 'dex', ['dex']) === 'ready');
ok('accept', K.accept(s, 'dex', ['dex', 'vee']).ok && s.active === 'dex' && K.status(s, 'dex', ['dex']) === 'active' && s.c.dex.flags.length === 4);
ok('one at a time', !K.accept(s, 'vee', ['dex', 'vee']).ok && s.active === 'dex');
ok('accept again is a no-op', K.accept(s, 'dex', ['dex']).already === true);
// objectives tick in order only
let c = K.current(s); ok('current = first', c.id === 'dex' && c.beat === 0 && c.i === 0 && c.obj.t === 'go');
ok('no skipping', !K.tick(s, 'dex', 0, 2) && !s.c.dex.flags[2]);
ok('tick', K.tick(s, 'dex', 0, 0) && K.current(s).i === 1);
ok('no double tick', !K.tick(s, 'dex', 0, 0));
ok('not claimable yet', K.claim(s, 'dex') === null && s.c.dex.beat === 0);
// pause keeps progress, other chain can start, resume picks up where it was
ok('pause', K.pause(s) && s.active === null && s.c.dex.flags[0] === true && K.status(s, 'dex', ['dex']) === 'progress');
ok('tick while paused refused', !K.tick(s, 'dex', 0, 1));
ok('other chain while paused', K.accept(s, 'vee', ['dex', 'vee']).ok && K.pause(s));
ok('resume', K.accept(s, 'dex', ['dex']).ok && K.current(s).i === 1);
// reload mid-beat keeps the checklist
s = RE(s); ok('reload keeps flags', s.active === 'dex' && s.c.dex.flags.join() === 'true,false,false,false' && K.status(s, 'vee', ['vee']) === 'ready');
K.tick(s, 'dex', 0, 1); K.tick(s, 'dex', 0, 2); K.tick(s, 'dex', 0, 3);
const r1 = K.claim(s, 'dex'); ok('beat 1 pays', r1 && r1.cr === 600 && r1.stars === 60 && r1.beat === 1 && !r1.perk, r1);
ok('beat 1 pays once', K.claim(s, 'dex') === null && s.paid.cr === 600 && s.claimed.join() === 'dex:1');
ok('next beat armed', s.c.dex.beat === 1 && s.active === 'dex' && s.c.dex.flags.length === 3 && K.current(s).i === 0);
// a stale save that says beat 0 but has dex:1 claimed can't re-pay
const stale = JSON.parse(JSON.stringify(s)); stale.c.dex.beat = 0; stale.c.dex.flags = [true, true, true, true];
const s2 = RE(stale); ok('stale beat cannot replay', s2.c.dex.beat === 1 && K.claim(s2, 'dex') === null && s2.paid.cr === 600);
// finish the chain: beat 2 + beat 3 with the perk; done chains can't be replayed
for (let b = 1; b < 3; b++) { const B = K.CHAINS.dex.beats[b]; B.obj.forEach((_, i) => K.tick(s, 'dex', b, i)); const r = K.claim(s, 'dex'); ok(`beat ${b + 1} pays`, r && r.cr === B.reward.cr && r.stars === B.reward.stars, r); if (b === 2) ok('perk on beat 3', r.perk?.payoff === 0.1 && r.line.includes('Dex crew payoff +10% (permanent)')); }
ok('chain done', K.status(s, 'dex', ['dex']) === 'done' && s.active === null && s.paid.cr === 600 + 1200 + 2500 && s.paid.stars === 60 + 120 + 250);
ok('no replay', !K.accept(s, 'dex', ['dex']).ok && K.claim(s, 'dex') === null && K.current(s) === null);
s = RE(s); ok('done survives reload', K.status(s, 'dex', ['dex']) === 'done' && K.claim(s, 'dex') === null && s.claimed.length === 3);
ok('dex perk', K.perks(s).payoff === 0.1 && K.perks(s).bustMul === 1 && K.perks(s).wash === 0 && K.perks(s).tolMul === 1);
// Soren's choice beat: both options shown, choice only when it's the current objective, pays the chosen option once
let t = K.fresh(); K.accept(t, 'soren', ['soren']); t.c.soren.beat = 2; t.claimed = ['soren:1', 'soren:2']; t.c.soren.flags = [false, false, false];
ok('choice lines', K.beatRewardLines('soren', 2).length === 3 && K.beatRewardLines('soren', 2)[2].startsWith('Either way'), K.beatRewardLines('soren', 2));
ok('choice not yet', !K.choose(t, 'soren', 'shield'));
K.tick(t, 'soren', 2, 0); ok('bad option refused', !K.choose(t, 'soren', 'nope'));
ok('choose', K.choose(t, 'soren', 'cut') && t.c.soren.choice === 'cut' && !K.choose(t, 'soren', 'shield'));
K.tick(t, 'soren', 2, 2); const rc = K.claim(t, 'soren'); ok('chosen reward', rc && rc.cr === 3000 && rc.stars === 150 && rc.perk?.bustMul === 0.7, rc);
ok('soren perk', K.perks(t).bustMul === 0.7 && K.claim(t, 'soren') === null);
// perks maths
ok('bust roll scales odds', K.scaleRoll(0.05, 0.7) > 0.07 && K.scaleRoll(0.5, 1) === 0.5 && K.scaleRoll(0.9, 0.7) < 1);
{ let busts = 0, N = 20000, b = 0.2; for (let i = 0; i < N; i++) if (K.scaleRoll((i + 0.5) / N, 0.7) < b) busts++; ok('bust x0.7', Math.abs(busts / N - 0.14) < 0.002, busts / N); }
const vee = { ...K.fresh(), claimed: ['vee:3'] };
ok('vee safe window', JSON.stringify(K.safeOverrides(SAFE_TIERS.hard, K.perks(vee))) === JSON.stringify({ tol: 9.8, time: 48 }) && K.safeOverrides(SAFE_TIERS.hard, K.perks(K.fresh())) === null);
ok('mags wash', K.perks({ ...K.fresh(), claimed: ['mags:3'] }).wash === 0.1);
// load sanitising
ok('junk', K.load('nope').active === null && K.load(null).claimed.length === 0 && K.load({ v: 9 }).c.dex.beat === 0);
const j = K.load({ v: 1, active: 'slick', c: { dex: { beat: 99, flags: [1, 1] }, slick: { beat: 2 } }, claimed: ['slick:1', 'dex:1', 'dex:1', 'x'], paid: { cr: -5 } });
ok('junk fields', j.active === null && j.c.dex.beat === 3 && j.c.dex.flags.length === 0 && !j.c.slick && j.claimed.join() === 'dex:1' && j.paid.cr === 0, j);
ok('active done dropped', K.load({ v: 1, active: 'dex', c: { dex: { beat: 3 } } }).active === null);
ok('dir', K.dirTo(0, -10) === 'N' && K.dirTo(10, 0) === 'E' && K.dirTo(0, 10) === 'S');
console.log(bad ? `crewfic unit: ${bad} of ${n} FAILED` : `crewfic unit OK (${n} checks)`); process.exit(bad ? 1 : 0);
