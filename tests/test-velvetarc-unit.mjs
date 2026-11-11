// Velvet expansion unit test: Ines's arc "House Always Wins" rules (mars/velvetarccore.js), the east wing layout
// (velvetwing.js: Mina's route clear of the Dome Room furniture, everything inside the club) and the wiring.
// node tests/test-velvetarc-unit.mjs
import { readFileSync } from 'fs';
import * as VA from '../mars/velvetarccore.js';
let fails = 0; const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// ---- unlock ----
ok('locked at 9 bottles / 2999 stars', !VA.unlocked(9, 2999));
ok('unlocks at 10 bottles', VA.unlocked(10, 0));
ok('unlocks at 3000 stars', VA.unlocked(0, 3000));
ok('hint shows progress', /4\/10/.test(VA.unlockHint(4, 120)) && /3,000/.test(VA.unlockHint(4, 120)));
// ---- the take ----
let s = VA.fresh();
ok('no take before owning', VA.addTake(s, 1000) === 0 && s.till === 0);
VA.own(s, 'signed', 1);
ok('own sets ending', s.owned && s.ending === 'signed' && s.ownedAt === 1);
ok('8% of a 1000 cr wager', VA.addTake(s, 1000) === 80 && s.till === 80);
VA.addTake(s, 10); VA.addTake(s, 10); VA.addTake(s, 10); VA.addTake(s, 10); VA.addTake(s, 10);
ok('fractions carry over (5 x 10 cr = 4 cr)', s.till === 84 && s.frac < 1);
s.till = 0;
ok('first hour reading never pays', VA.tickHour(s, 23) === 0);
ok('no pay mid-day', VA.tickHour(s, 12) === 0 && s.till === 0);
VA.tickHour(s, 21);
ok('midnight wrap pays 400 cr', VA.tickHour(s, 1) === 1 && s.till === 400 && s.days === 1);
const c = VA.collect(s);
ok('collect: 400 cr, 40 stars (1 per 10 cr)', c.cr === 400 && c.stars === 40 && s.till === 0 && s.collected === 400);
ok('collect empty till', VA.collect(s).cr === 0);
s.till = VA.TAKE.cap - 10; VA.addTake(s, 100000);
ok('till caps at 20k', s.till === VA.TAKE.cap);
// ---- the safe ----
s = VA.fresh();
ok('safe takes any amount', VA.safeIn(s, 'glowdust', 500) === 500 && VA.safeIn(s, 'static', 3) === 3 && VA.safeTotal(s) === 503);
ok('safe out partial', VA.safeOut(s, 'glowdust', 200) === 200 && s.safe.glowdust === 300);
ok('safe out all removes key', VA.safeOut(s, 'static') === 3 && !('static' in s.safe));
ok('safe rejects junk', VA.safeIn(s, '', 4) === 0 && VA.safeIn(s, 'x', -2) === 0 && VA.safeOut(s, 'nope', 4) === 0);
// ---- save load ----
const L = VA.load(JSON.stringify({ v: 1, owned: 1, till: 99999, safe: { a: 3, b: -2, c: 'x' }, pitWins: -4 }));
ok('load clamps till / safe / pit', L.owned === true && L.till === VA.TAKE.cap && L.safe.a === 3 && !('b' in L.safe) && !('c' in L.safe) && L.pitWins === 0);
ok('load bad json -> fresh', VA.load('{nope').owned === false && VA.load(null).v === 1 && VA.load({ v: 9 }).owned === false);
// ---- mission mechanics ----
ok('Grisby looks 3.2 s of every 9 s', VA.grisbyLooking(0.5) && !VA.grisbyLooking(4) && VA.grisbyLooking(9.5) && !VA.grisbyLooking(-1));
let m = { p: 0 };
m = VA.swipeTick(m, 1, { atSlate: true, looking: false, screened: false }); ok('swipe progresses unseen', m.p === 1 && m.state === 'working');
m = VA.swipeTick(m, 1, { atSlate: true, looking: true, screened: true }); ok('waitress screens you', m.p === 2);
m = VA.swipeTick(m, 1, { atSlate: true, looking: true, screened: false }); ok('caught resets', m.p === 0 && m.caught === 1 && m.state === 'caught');
m = VA.swipeTick(m, 1, { atSlate: false, looking: false, screened: false }); ok('away', m.state === 'away' && m.p === 0);
m = VA.swipeTick({ p: 14.5 }, 1, { atSlate: true, looking: false }); ok('done at 15 s', m.state === 'done' && m.p === 15);
s = VA.fresh();
ok('pit: win, lose, win = won', VA.pitResult(s, true) === 'next' && VA.pitResult(s, false) === 'next' && VA.pitResult(s, true) === 'won');
s = VA.fresh();
ok('pit: two losses = lost', VA.pitResult(s, false) === 'next' && VA.pitResult(s, false) === 'lost');
ok('boss phases', VA.bossPhase(1) === 1 && VA.bossPhase(0.5) === 2 && VA.bossPhase(0.2) === 3);
let ch = { t: 0 }; for (let i = 0; i < 31; i++) ch = VA.chaseTick(ch, 0.1, 5);
ok('chase: 3 s close stops the rover', ch.stopped);
ok('chase: falling back decays', VA.chaseTick({ t: 2 }, 1, 30).t === 1.5);
ok('owner show price 25% off', VA.showPrice(150, true) === 113 && VA.showPrice(150, false) === 150);
ok('manager barks, clean', VA.MANAGER_BARKS.length >= 6 && VA.MANAGER_BARKS.every(b => typeof b === 'string' && b.length < 140));

// ---- wing layout ----
const wing = src('velvetwing.js'), cf = src('clubfloor.js');
const P = new Function(cf.slice(cf.indexOf('export const faceYaw'), cf.indexOf('const LOOKS')).replace(/export /g, '') + '; return { patrol };')();
const W = new Function('return ' + wing.slice(wing.indexOf('export const WING = ') + 20, wing.indexOf('\n};', wing.indexOf('export const WING')) + 2))();
ok('wing inside the club (x -33..25, z -8..24)', W.x0 >= -33 && W.x1 <= 25 && W.z0 >= -8 && W.z1 <= 24);
const T = W.table, R = 4.6, pill = [...Array(6)].map((_, i) => [T.x + Math.cos(i / 6 * Math.PI * 2) * R, T.z + Math.sin(i / 6 * Math.PI * 2) * R]);
const seat = a => [T.x + Math.sin(a) * 2.75, T.z + Math.cos(a) * 2.05];
const boxes = [[T.x, T.z, 2.05, 1.5], [W.ledger.x, W.ledger.z, 0.3, 0.3], [12.4, 20.5, 0.55, 1.55], [23.9, 20, 0.55, 1.55], [23.9, 5.4, 0.55, 1.55], [19.5, 23.2, 2.05, 0.45],
  ...[-1.4, 1.4, 2.3].map(a => [...seat(a), 0.32, 0.32]), ...pill.map(p => [...p, 0.08, 0.08])];
const route = W.route; const total = route.reduce((a, q, i) => { const n = route[(i + 1) % route.length]; return a + (q[2] || 0) + Math.hypot(n[0] - q[0], n[1] - q[1]) / 1.1; }, 0);
let hit = null, inRoom = true;
for (let t = 0; t < total * 2; t += 0.05) { const p = P.patrol(route, t);
  if (p.x < W.x0 + 0.5 || p.x > W.x1 - 0.5 || p.z < 1.3 || p.z > W.z1 - 0.5) inRoom = false; // stays south of the office wall (z 1)
  for (const [bx, bz, hx, hz] of boxes) if (Math.abs(p.x - bx) < hx + 0.3 && Math.abs(p.z - bz) < hz + 0.3) hit = hit || `${p.x.toFixed(1)},${p.z.toFixed(1)} vs ${bx},${bz}`; }
ok('Mina stays in the Dome Room', inRoom);
ok('Mina never walks through furniture ' + (hit || ''), !hit);
let screens = 0; for (let t = 0; t < total; t += 0.1) { const p = P.patrol(route, t); if (Math.hypot(p.x - W.ledger.x, p.z - W.ledger.z) < 2.1) screens++; }
ok('Mina passes the slate every loop', screens > 5);
ok('spots inside the wing', [W.desk, W.safe, W.handover, W.ledger].every(q => q.x > W.x0 && q.x < W.x1 && q.z > W.z0 && q.z < W.z1));
ok('desk + safe in the office', [W.desk, W.safe].every(q => q.x > W.office.x0 && q.z < W.office.z1));
ok('Ines stands in the staff office', W.ines && W.ines.x > W.office.x0 && W.ines.x < W.office.x1 && W.ines.z > W.office.z0 && W.ines.z < W.office.z1);
ok('staff door stays open', /doorCol\.on = false/.test(wing) && !/doorCol\.on = !own/.test(wing));
ok('talk button names Ines', /Talk to Ines/.test(wing));

// ---- wiring ----
const arc = src('mars/velvetarc.js'), html = src('index.html'), sw = src('sw.js'), inter = src('interiors.js'), world = src('world.js'), ps = src('privateshow.js');
ok('5 missions', ['ines-arc-1-shortpour', 'ines-arc-2-comped', 'ines-arc-3-closingtime', 'ines-arc-4-upstairs', 'ines-arc-5-house'].every(id => arc.includes(id)));
ok('arc loaded by index.html', /src="\.\/mars\/velvetarc\.js/.test(html));
ok('index doSpot runs act velvet', /s\.act === 'velvet'\) \{ const raw = surface\.world\?\.nearSpot\?\.\(\); if \(raw && raw\.id === s\.id && typeof raw\.run === 'function'/.test(html));
ok('sw precaches new files', ['mars/velvetarc.js', 'mars/velvetarccore.js', 'velvetwing.js'].every(f => sw.includes(f)));
ok('interiors builds the wing (guarded)', /addVelvetWing\?\.\(/.test(inter));
ok('no ?v= in new imports', !/from '[^']+\?v=/.test(arc + wing + src('mars/velvetarccore.js')));
ok('raid guard + take hook are guarded', /raids/.test(arc) && /typeof .*spend === 'function'|spend/.test(arc));
ok('private show owner price', /ownerPrice/.test(ps));
ok('no surname "Varga" in the game', !/Varga/.test(arc + wing + src('mars/velvetarccore.js')));
ok('small dome gone from world.js', !/\[-22,\s*-16/.test(world));
ok('green beam uses Ben\'s ownedbeams (no duplicate beam mesh)', !/velvetBeam/.test(arc) && /velvetArc\?\.owned/.test(src('mars/ownedbeams.js')));
ok('takeover is on the quest log and the menu', /function logHtml/.test(arc) && /Take over the Velvet Airlock/.test(arc) && /rmVelvet/.test(arc) && /velvetArc\?\.logHtml/.test(html));
ok('guide names the staff room', /Ines is in the staff-only room/.test(arc));
ok('pit step is the cage', /type: 'pit', at: \[-292, -68\]/.test(arc));
ok('every arc step names what to do', (arc.match(/type: '/g) || []).length >= 20 && !/type: 'pick', who: 'Pell', prompt:/.test(arc));
ok('step changes say what is next', /Step done\. Next:/.test(arc) && /Step done\. Next:/.test(src('storymars.js')));
ok('brief remembers it was said', VA.fresh().briefed === false && VA.load(JSON.stringify({ v: 1, briefed: true })).briefed === true);
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
