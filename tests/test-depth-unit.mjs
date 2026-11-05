// Mission depth (pure, no browser): node tests/test-depth-unit.mjs
// 1) Vale's mark walks a real loop and only shows once you're close or tipped; 2) the first heist unlocks after 3 city
// missions and old saves migrate; 3) the Pit is best of 3 with the purse at the end.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { MARK, markPos, revealed, REVEAL_M, TIP_S } from '../activities/markdata.js';
import { prepTemplate } from '../activities/deadends.js';
import { newSeries, scoreRound, payout, seriesLine, roundOutcome, PAY, BREAK_S } from '../activities/pitseries.js';
import * as T from '../mars/heisttipcore.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const src = f => fs.readFileSync(path.join(root, f), 'utf8');
const pack = JSON.parse(src('activities/side-activities.json'));

// ---------- 1. Vale's mark ----------
const vale = pack.activities.find(a => a.id === 'act-vale-scanner');
const steps = prepTemplate(vale, vale.loop.steps_template, [0, -430]);
const ms = steps.find(s => s.mark);
ok('vale: "Find the mark" becomes a mark goto', ms && ms.type === 'goto' && ms.mark === MARK.id);
ok('vale: step names who and roughly where', ms && ms.text.includes(MARK.name) && /Olympus Row/.test(ms.text) && /^◆ /.test(ms.text) && ms.text.includes('➤'));
ok('vale: no at_aj_random_in left', !steps.some(s => s.at_aj_random_in));
ok('vale: other steps untouched', steps.filter(s => !s.mark).length === vale.loop.steps_template.length - 1);
ok('mark has 3 named stops (dwell) on a closed loop', MARK.spots.filter(p => p[2] > 0).length === 3 && MARK.spots.length >= 3);
let maxJump = 0, prev = markPos(0), moved = false; const seen = new Set();
for (let t = 0.5; t < 400; t += 0.5) { const p = markPos(t); maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.z - prev.z)); if (p.moving) moved = true; if (!p.moving) seen.add(`${p.x},${p.z}`); prev = p; }
ok('mark moves smoothly (no teleport)', maxJump <= 1.5 * 0.5 + 1e-6, String(maxJump));
ok('mark walks and waits at every stop', moved && MARK.spots.filter(p => p[2] > 0).every(p => seen.has(`${p[0]},${p[1]}`)));
ok('mark stays in Olympus Row (< 90 m from hub)', MARK.spots.every(p => Math.hypot(p[0], p[1] + 430) < 90));
ok('marker hidden far away before the tip', !revealed(REVEAL_M + 1, TIP_S - 1, false));
ok('marker shows within 60 m', revealed(REVEAL_M, 0, false) && REVEAL_M >= 50 && REVEAL_M <= 70);
ok('marker shows after the tip', revealed(500, 0, true) && revealed(500, TIP_S, false));
const mk = src('activities/mark.js');
ok('mark respects the NPC budget', /npcBudget\?\.\(\)/.test(mk) && /npcReserve\?\.\('valeMark', 1\)/.test(mk) && /npcReserve\?\.\('valeMark', 0\)/.test(mk));
ok('hidden mark cannot be completed on a ghost marker', /t\.r = S\.show \? REACH_M : -1e9/.test(mk));

// ---------- 2. first heist ----------
const V = T.VILLA;
ok('villa: proper name, not the test sample', V.title === 'Halvorsen Villa' && !/test/i.test(V.title) && V.id !== 'heist-sample');
ok('villa: colony-relative, in Helios Heights', V.rel === 'colony' && Math.hypot(V.site.x - 320, V.site.z - 80) < 90);
ok('villa: door, safe, power and cameras around the site', [V.door, V.safe, V.power, ...V.cameras].every(p => Math.hypot(p.x - V.site.x, p.z - V.site.z) < 12) && V.cameras.length === 3);
ok('tip text plain words with ◆ and ➤, names the place', /^Sable: ◆ /.test(T.TIP_TEXT) && T.TIP_TEXT.includes('➤') && T.TIP_TEXT.includes('Halvorsen Villa') && T.TIP_TEXT.includes('Helios Heights'));
const f = T.fresh();
ok('fresh state locked', !f.unlocked && !f.tipped && f.v === T.VERSION);
ok('no save -> fresh', JSON.stringify(T.loadState(null)) === JSON.stringify(f) && JSON.stringify(T.loadState('')) === JSON.stringify(f));
ok('garbage save -> fresh', !T.loadState('{oops').unlocked && !T.loadState('[1,2]').unlocked && !T.loadState('null').unlocked);
ok('legacy "true" save -> unlocked, no repeat text', T.loadState('true').unlocked && T.loadState('true').tipped && T.loadState('1').unlocked);
ok('pre-version object migrates', (s => s.v === 1 && s.unlocked && !s.tipped)(T.loadState('{"unlocked":true}')));
ok('v1 round-trips', (s => s.unlocked && s.tipped && s.at === 5)(T.loadState(JSON.stringify({ v: 1, unlocked: true, tipped: true, at: 5 }))));
const ids = ['a', 'b', 'c', 'd'];
ok('cityDone counts everDone', T.cityDone({ a: { everDone: true }, b: { status: 'done' }, c: { status: 'active' } }, ids) === 2);
ok('2 missions: nothing yet', (d => !d.unlock && !d.tip)(T.decide(T.fresh(), 2)));
ok('3 missions: unlock + text', (d => d.unlock && d.tip)(T.decide(T.fresh(), 3)));
ok('returning player with 10 done unlocks on load', T.decide(T.fresh(), 10).unlock);
ok('already tipped: no second text', (d => !d.unlock && !d.tip)(T.decide({ ...T.fresh(), unlocked: true, tipped: true }, 9)));
ok('unlocked but text never shown: show it once', (d => !d.unlock && d.tip)(T.decide({ ...T.fresh(), unlocked: true }, 9)));
const ht = src('mars/heisttip.js'), hj = src('heist.js');
ok('heist menu entry comes from registering (none before unlock)', /registerHeist\(VILLA\)/.test(ht) && /registerHeist\(def\) \{[^}]*ensureMenu\(\)/.test(hj) && /heisttest=1/.test(hj));

// ---------- 3. Pit best of 3 ----------
const play = (...o) => o.reduce((S, x) => scoreRound(S, x), newSeries());
ok('2-0 is a sweep', (S => S.over && S.result === 'sweep' && S.me === 2 && S.them === 0)(play('win', 'win')));
ok('2-1 is a win', (S => S.over && S.result === 'win')(play('win', 'loss', 'win')));
ok('1-2 loses', (S => S.over && S.result === 'lose')(play('loss', 'win', 'loss')));
ok('0-2 loses', play('loss', 'loss').result === 'lose');
ok('1-1 goes to round 3', (S => !S.over && S.round === 3)(play('win', 'loss')));
ok('walk out forfeits mid-series', (S => S.over && S.result === 'forfeit')(play('win', 'forfeit')));
ok('no more scoring after the end', play('win', 'win', 'loss').them === 0);
ok('sweep pays more than 2-1', payout(play('win', 'win')).credits > payout(play('win', 'loss', 'win')).credits);
ok('losing pays a small consolation at most', payout(play('loss', 'loss')).credits <= 25 && payout(play('loss', 'loss')).credits < PAY.win.credits / 5);
ok('forfeit pays nothing', payout(play('forfeit')).credits === 0);
ok('nothing paid mid-series', payout(play('win')).credits === 0);
ok('round line', seriesLine(play('win')) === '◆ Round 2 of 3 · You 1 – 0');
ok('round line in a bout / on the break', /➤ fight$/.test(seriesLine(newSeries(), { inDuel: true })) && /next bout in 5 s/.test(seriesLine(newSeries(), { breakS: 4.2 })));
ok('break is about 5 s', BREAK_S >= 4 && BREAK_S <= 6);
for (const [why, want] of [['ko-win', 'win'], ['yield-win', 'win'], ['ko-lose', 'loss'], ['yield-lose', 'loss'], ['forfeit', 'forfeit'], ['chicken', 'rearm'], ['abandon', null]]) ok(`bout ${why} -> ${want}`, roundOutcome({ why, win: /win/.test(why) }) === want);
const rn = src('activities/runner.js');
ok('runner: series drives the Pit, line in the existing chip', /scoreRound\(S, o\)/.test(rn) && /seriesLine\(active\.series/.test(rn) && !/Rounds left/.test(rn));
ok('runner: rounds carry no wager; purse paid once at the end', /series: newSeries\(\), wager: 0/.test(rn) && /function finishSeries/.test(rn));
ok('runner: Pit abandon leaves other quests alone', /active\.mode !== 'duel_ladder'\) \{ try \{ C\.game\.abandon/.test(rn));
console.log(`\n${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
