// Unit tests for onboardcore.js (First Day on Mars + How to play) and the add-on's wiring rules.
// node tests/test-onboard-unit.mjs
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import * as C from '../onboardcore.js';
const ROOT = new URL('..', import.meta.url).pathname;
const src = f => readFileSync(ROOT + f, 'utf8');
let n = 0, fail = 0; const ok = (name, cond, extra = '') => { n++; if (!cond) { fail++; console.log('FAIL', name, extra); } };

// ---- returning players
const ls = o => k => (k in o ? o[k] : null);
ok('fresh', !C.isReturningPlayer(ls({})));
ok('emptyProgress', !C.isReturningPlayer(ls({ 'ssx.progress.v1': JSON.stringify({ xp: 0, credits: 0, quests: {}, flags: {} }) })));
ok('xp', C.isReturningPlayer(ls({ 'ssx.progress.v1': JSON.stringify({ xp: 5 }) })));
ok('credits', C.isReturningPlayer(ls({ 'ssx.progress.v1': JSON.stringify({ credits: 40 }) })));
ok('quests', C.isReturningPlayer(ls({ 'ssx.progress.v1': JSON.stringify({ quests: { q1: 1 } }) })));
ok('turfSave', C.isReturningPlayer(ls({ 'ssx.turf.v1': JSON.stringify({ owners: { a: 'player' } }) })));
ok('discoveries', C.isReturningPlayer(ls({ 'ssx.discoveries.v1': JSON.stringify(['mars']) })));
ok('junk', !C.isReturningPlayer(ls({ 'ssx.progress.v1': '{bad', 'ssx.jobs.v1': '' })));

// ---- initial state
ok('newActive', C.initialState(null, false).status === 'active');
ok('returnSkip', (s => s.status === 'skipped' && s.auto)(C.initialState(null, true)));
ok('storedWins', C.initialState({ v: 1, status: 'done', m: 6, s: 0, paid: [] }, false).status === 'done');
ok('forceOn', C.initialState({ v: 1, status: 'done', m: 6, s: 0, paid: [] }, true, 'on').status === 'active');
ok('forceOff', C.initialState(null, false, 'off').status === 'paused');
ok('badStored', C.initialState({ v: 9 }, false).status === 'active');

// ---- play through: every mission pays once, ends 'done'
let st = C.initialState(null, false), paid = 0, steps = 0;
while (st.status === 'active' && steps < 100) { const r = C.advance(st); paid += r.paid; st = r.state; steps++; }
ok('done', st.status === 'done', st.status);
ok('allSteps', steps === C.MISSIONS.reduce((a, m) => a + m.steps.length, 0), steps);
ok('reward', paid === C.TOTAL_REWARD && C.TOTAL_REWARD === 315, paid);
ok('rewardsSmall', C.MISSIONS.every(m => m.reward > 0 && m.reward <= 100));
ok('missionCount', C.MISSIONS.length >= 5 && C.MISSIONS.length <= 6);
let again = C.restart(st), paid2 = 0; while (again.status === 'active') { const r = C.advance(again); paid2 += r.paid; again = r.state; }
ok('noDoublePay', paid2 === 0, paid2);
ok('skip', C.skip(C.initialState(null, false)).status === 'skipped');
ok('resume', (s => s.status === 'active' && s.m === 2)(C.resume({ ...C.freshState(), status: 'skipped', m: 2, s: 1 })));
ok('noAdvanceWhenSkipped', C.advance(C.skip(C.initialState(null, false))).state.m === 0);

// ---- text: one plain sentence or two, phone vs keyboard, no jargon from the old quest text
const all = [];
for (const m of C.MISSIONS) for (const [i, s] of m.steps.entries()) for (const t of [s.text, s.alt, s.fight].filter(Boolean)) for (const touch of [true, false]) {
  const x = C.textOf(t, touch); all.push(x);
  ok(`len ${m.id}.${i}`, x.length > 8 && x.length <= 110, x);
  ok(`sentences ${m.id}.${i}`, (x.match(/[.!?](\s|$)/g) || []).length <= 3, x);
  if (touch) ok(`noKeysOnPhone ${m.id}.${i}`, !/\bpress\b/i.test(x) && !/\bShift\b|W A S D|\bSpace\b/.test(x), x);
  else ok(`noTapOnDesk ${m.id}.${i}`, !/left stick|tap Jump|tap 💼|tap 💊|tap 🚩|tap 🚙/i.test(x), x);
}
ok('noJargon', !all.some(x => /drop into|objective|waypoint/i.test(x)));
const deskJob = C.textOf(C.MISSIONS[2].steps[0].text, false), touchJob = C.textOf(C.MISSIONS[2].steps[0].text, true);
ok('jobsDiffer', deskJob !== touchJob && /J/.test(deskJob) && /💼 Jobs/.test(touchJob));

// ---- every control the text names really exists (key handlers / button labels in the shipped code)
const corpus = ['index.html', 'mars/jobs.js', 'mars/contraband.js', 'mars/turf.js', 'activities/runner.js', 'world.js', 'interiors.js'].map(src).join('\n');
const CONTROLS = [
  ['press J', /KeyJ/], ['press B', /KeyB/], ['press K', /KeyK/], ['press E', /KeyE/], ['press R', /KeyR/], ['press T', /KeyT/], ['press G', /KeyG/],
  ['Space', /Space/], ['Shift', /Shift/], ['🚙 Drive', /🚙 Drive/], ['⚡ Boost', /⚡ Boost/], ['Jump', /id="jumpBtn"/], ['Run', /id="runBtn"/], ['Thrust', /Thrust/],
  ['🚙 Summon rover here', /🚙 Summon rover here/], ['🚀 Take off', /🚀 Take off/], ['🛬 Land here', /🛬 Land here/], ['💼 Jobs', /💼\\nJobs|💼 Jobs/], ['🚩 Turf', /🚩\\nTurf|🚩 Turf/],
  ['🎒 Stash', /🎒\\nStash|🎒 Stash/], ['💊 Blue', /💊 Blue/], ['📋 The Pit', /`📋 \$\{best\.name\}`/], ['🚪 Enter', /🚪 Enter/], ['🗺️ TURF MAP', /TURF MAP/], ['📻 Next', /📻 Next/],
  ['🏙 Districts', /🏙 Districts/], ['📋 Mars side jobs', /📋 Mars side jobs/], ['Take', / Take`/], ['👊', /👊/], ['FIRE', /FIRE/], ['Accept', /Accept/], ['Later', /radioLater/]
];
for (const [label, re] of CONTROLS) ok('exists ' + label, re.test(corpus));
ok('pitName', /"name":\s*"The Pit"/.test(src('activities/side-activities.json')));
const used = all.join(' ') + ' ' + JSON.stringify(C.CODEX);
for (const k of ['press J', 'press B', 'press K', 'press E', 'press R', 'press T']) ok('mentioned ' + k, !used.includes(k) || CONTROLS.some(c => c[0] === k));

// ---- codex
const has = new Set(['fight', 'heist']);
const cx = C.codexFor(true, k => has.has(k)), cd = C.codexFor(false, () => false);
ok('codexSections', cx.length >= 3 && cd.length >= 2);
ok('codexOptHidden', !cd.flatMap(s => s.items).some(i => i.opt));
ok('codexOptShown', cx.flatMap(s => s.items).filter(i => i.opt).map(i => i.id).sort().join() === 'fightclub,heists');
const ids = C.CODEX.flatMap(s => s.items.map(i => i.id));
for (const need of ['pit', 'heat', 'turf', 'jobs', 'blue', 'drive', 'roll', 'radio', 'club', 'races', 'rep', 'bribes', 'gravity', 'arsenal', 'empire', 'base', 'heists', 'storms']) ok('codex has ' + need, ids.includes(need));
for (const s of C.CODEX) for (const i of s.items) for (const touch of [true, false]) { const d = C.textOf(i.d, touch); ok('codexShort ' + i.id, d.length > 10 && d.length <= 190 && (d.match(/[.!?](\s|$)/g) || []).length <= 3, d); }
ok('uniqueIds', new Set(ids).size === ids.length);

// ---- bearing
ok('ahead', C.bearing(0, 0, 0, -30, 0).arrow === '⬆' && C.bearing(0, 0, 0, -30, 0).d === 30);
ok('left', C.bearing(0, 0, -30, 0, 0).arrow === '⬅');
ok('behind', C.bearing(0, 0, 0, 30, 0).arrow === '⬇');
ok('turned', C.bearing(0, 0, -30, 0, Math.PI / 2).arrow === '⬆');
ok('fmt', C.fmtDist(1234) === '1.2 km' && C.fmtDist(42.4) === '42 m');

// ---- wiring rules
const ob = src('onboard.js') + src('onboardcore.js');
ok('saveKey', C.SAVE_KEY === 'ssx.onboard.v1' && /SAVE_KEY/.test(src('onboard.js')));
ok('noOnclick', !/onclick|\.click\(|addEventListener\('click'/.test(ob));
ok('pointerTaps', /pointerdown/.test(src('onboard.js')) && /pointerup/.test(src('onboard.js')) && /pointerId/.test(src('onboard.js')));
ok('noNpcs', !/hostiles\(|spawnAgent|npcReserve|addAgent/.test(ob));
ok('noHudEdits', !/getElementById\('(hud|topBar|miniMap|questTrack|toast)'\)\.(style|innerHTML|textContent)\s*=/.test(ob));
ok('oneMenuItem', (src('onboard.js').match(/registerMenuItem\(/g) || []).length === 1 && /📖 How to play/.test(src('onboard.js')));
ok('guarded', !/window\.SSX\.(hudx|fight|jobs|turf|contraband|minimap)\./.test(src('onboard.js')));
const idx = src('index.html');
ok('importLine', (idx.match(/import '\.\/onboard\.js';/g) || []).length === 1);
ok('importMap', /"\.\/onboard\.js": "\.\/onboard\.js\?v=/.test(idx) && /"\.\/onboardcore\.js": "\.\/onboardcore\.js\?v=/.test(idx));
const sw = src('sw.js');
ok('precache', (sw.match(/\['onboard', 'onboardcore'\]/g) || []).length === 1);
try {
  const base = execSync('git merge-base HEAD origin/main', { cwd: ROOT }).toString().trim();
  const diff = f => execSync(`git diff ${base} -- ${f}`, { cwd: ROOT }).toString().split('\n').filter(l => /^[+-][^+-]/.test(l));
  const iLines = diff('index.html').filter(l => !/^\+\s*"(\.\/|ssx\/)onboard(core)?(\.js)?": /.test(l));
  ok('indexOneHook', iLines.length === 1 && /import '\.\/onboard\.js'/.test(iLines[0]), iLines.join('\n'));
  ok('swOneLine', diff('sw.js').length === 1);
  const files = execSync(`git diff --name-only ${base}`, { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
  const core = files.filter(f => !/^(onboard\.js|onboardcore\.js|tests\/|README\.md$)/.test(f));
  ok('coreFiles', core.every(f => f === 'index.html' || f === 'sw.js'), core.join());
  ok('noVersionBump', !diff('sw.js').some(l => /SHELL|ASSETS|VERSION|\?v=/.test(l)) && !diff('index.html').some(l => /sw\.js\?v=|class="ver"/.test(l)));
} catch (e) { console.log('(git checks skipped: ' + String(e.message).split('\n')[0] + ')'); }

console.log(fail ? `onboard unit: ${fail}/${n} FAILED` : `onboard unit: ${n} checks OK`); process.exit(fail ? 1 : 0);
