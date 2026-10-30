// Stuck? help + mission foe markers (pure, no browser): node tests/test-stuck-unit.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import * as S from '../help/stuckcore.js';
import { prepTemplate } from '../activities/deadends.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const src = f => fs.readFileSync(path.join(root, f), 'utf8');

// ---------- Door Shift: troublemakers are people you can see (not burrowed crawlers) ----------
const pack = JSON.parse(src('activities/side-activities.json')), byId = id => pack.activities.find(a => a.id === id);
for (const id of ['act-static-bounce', 'act-vale-scanner']) {
  const def = byId(id), tpl = def.loop?.steps_template || def.steps || [];
  const d = prepTemplate(def, tpl, [0, -430]).filter(s => s.type === 'defeat');
  ok(`${id}: stand-in wave is goons`, d.length === 1 && d[0].wave.every(t => t === 'goon') && d[0].wave.length === tpl.find(s => s.type === 'defeat').wave.length, JSON.stringify(d));
  ok(`${id}: no ambush (nobody hides under the sand)`, d.length === 1 && !d[0].ambush);
  ok(`${id}: card text unchanged (hud/hints.js keys on it)`, d[0]?.text === tpl.find(s => s.type === 'defeat').text);
}
ok('drones on the range stay drones', prepTemplate(byId('act-trust-range'), byId('act-trust-range').loop?.steps_template || byId('act-trust-range').steps || [], [0, 0]).filter(s => s.type === 'defeat').every(s => s.wave.includes('drone')));
ok('Door Shift fits the phone cap', byId('act-static-bounce').caps.phone_npc_max >= 3);

// ---------- hint copy ----------
const me = { x: 0, z: 0, yaw: 0 };
ok('dir ahead (-z)', S.dirWord(0, -50, 0) === 'straight ahead');
ok('dir right (+x)', S.dirWord(50, 0, 0) === 'to your right');
ok('dir left', S.dirWord(-50, 0, 0) === 'to your left');
ok('dir behind', S.dirWord(0, 50, 0) === 'behind you');
ok('dir follows facing', S.dirWord(50, 0, Math.PI / 2) === 'straight ahead' || S.dirWord(50, 0, -Math.PI / 2) === 'straight ahead');
ok('distance words', S.howFar(5) === 'right here' && S.howFar(43) === 'about 40 m' && S.howFar(2400) === 'about 2.4 km');
const h1 = S.hint({ what: 'Throw out the troublemakers at The Static’s door (red dots). (1/2)', kind: 'foes', me, foes: [{ x: 30, z: -25 }, { x: 60, z: 0 }], left: 1 });
ok('foe hint: what + how many + which way + how far + the marks', /Throw out the troublemakers at The Static’s door\./.test(h1) && /One left, the nearest about 40 m ahead on your right/.test(h1) && /red ◆/.test(h1), h1);
ok('foe hint drops (red dots) and (1/2)', !/red dots|1\/2/.test(h1), h1);
const h2 = S.hint({ what: 'Stand at THE STATIC club door (◆) and keep it clear.', kind: 'place', me, target: { x: 0, z: -120 }, name: 'The Static' });
ok('place hint names the target, way + distance', /Head straight ahead, about 120 m, to The Static\./.test(h2), h2);
ok('there: says so', /You're there/.test(S.hint({ what: 'Go to the bar', kind: 'place', me, target: { x: 3, z: 2 } })));
ok('missing target: offers the way out', /can't find the target/.test(S.hint({ what: 'Find the mark', kind: 'place', me, missing: true })));
ok('wave not up yet: go to the ◆', /They show up when you get close/.test(S.hint({ what: 'Kill them', kind: 'foes', me, foes: [], target: { x: 0, z: -80 } })));
ok('farm: yellow beacon', /yellow beacon/.test(S.hint({ what: 'Buy the Dustbowl Homestead', kind: 'farm', me, target: { x: 0, z: 300 }, name: 'Dustbowl Homestead' })));
for (const t of [h1, h2]) ok('one short hint (<= 3 sentences, <= 240 chars)', t.length <= 240 && (t.match(/[.!?](\s|$)/g) || []).length <= 3, t);

// ---------- stall / options ----------
const st = S.createStall();
ok('stall starts at 0', S.stallTick(st, 'a', 10) === 0);
ok('stall counts while the step sits still', S.stallTick(st, 'a', 100) === 90);
ok('progress resets it', S.stallTick(st, 'b', 120) === 0);
ok('no way out before 3 min', !S.offerOut({ stillS: 179 }) && S.offerOut({ stillS: 180 }));
ok('way out at once when the target is missing / unreachable', S.offerOut({ missing: true }) && S.offerOut({ unreachable: true }));
ok('missions + side jobs: skip + quit', S.actionsFor('quest').skip && S.actionsFor('side').quit && S.actionsFor('side').quitLabel === 'Quit job');
ok('farm guide: quit hides it', S.actionsFor('farm').quit && !S.actionsFor('farm').skip);
ok('marker kinds', S.markerKind('defeat') === 'foes' && S.markerKind('goto') === 'place' && S.markerKind('race') === 'gate' && S.markerKind('collect') === 'items' && S.markerKind('clean') === 'none');

// ---------- key: H is taken, ours is free ----------
const files = []; const walk = d => { for (const f of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { if (['tests', 'vendor', 'node_modules', '.git', 'tools', 'shots', 'textures', 'icons', 'help'].includes(f.name)) continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(js|html)$/.test(f.name)) files.push(p); } };
walk('.');
ok('H is ship travel (so not ours)', /code === 'KeyH'[^\n]*travel\('ship'\)/.test(src('index.html')) && S.KEY !== 'KeyH');
ok(`${S.KEY} not bound anywhere else`, !files.some(f => src(f).includes(`'${S.KEY}'`)), files.filter(f => src(f).includes(`'${S.KEY}'`)).join());

// ---------- wiring ----------
const run = src('activities/runner.js'), stuck = src('help/stuck.js'), foes = src('help/foes.js');
ok('runner ticks mission help every frame (all worlds)', /missionHelpTick\(dt, ctx\)/.test(run) && run.indexOf('missionHelpTick(dt, ctx)') < run.indexOf("ctx.name !== 'Mars'"));
ok('no core file touched for the hook', !/help\/stuck/.test(src('game.js') + src('surface.js') + src('world.js')) && !/import\(['"]\.\/help/.test(src('index.html')));
ok('sw precaches help/*', /'help\/stuck', 'help\/stuckcore', 'help\/foes'/.test(src('sw.js')));
ok('import map has help/*', /"\.\/help\/stuck\.js"/.test(src('index.html')) && /"\.\/help\/foes\.js"/.test(src('index.html')));
ok('foes: npc slots, critical (#67)', /npcSlots/.test(foes) && /critical: true/.test(foes));
ok('foes: red world ◆ + minimap dots', /quest-foe-marker/.test(foes) && /addMarks\?\.\(KEY/.test(foes) && /#ff2020/.test(foes));
ok('taps: pointerdown -> pointerup, same pointerId', /__onTap/.test(stuck) && /e\.pointerId !== id/.test(stuck));
ok('one pop-up at a time', /otherPopup\(\)/.test(stuck));
ok('black button, white text', /#hxStuck\{[^}]*background:#000;color:#fff/.test(stuck));
console.log(`${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
