// Mission NPC slots + bar contact (pure, no browser): node tests/test-npcs-unit.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import * as N from '../mars/npcslotscore.js';
import * as J from '../mars/barcontactcore.js';
import { decide, loadState, VILLA_AT } from '../mars/heisttipcore.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const src = f => fs.readFileSync(path.join(root, f), 'utf8');

// ---------- reserved slots ----------
const S = N.createSlots();
ok('no slots: usual ambient floor 4', N.floor(S) === 4);
N.setRes(S, 'turf', 3);
ok('normal slot keeps the floor', N.floor(S) === 4 && N.total(S) === 3 && N.criticalSum(S) === 0);
N.setRes(S, 'villaGuards', 2, { critical: true });
ok('critical slot drops the floor to 0', N.floor(S) === 0 && N.criticalSum(S) === 2 && N.total(S) === 5);
ok('list shows critical', N.list(S).villaGuards.critical && !N.list(S).turf.critical);
N.setRes(S, 'turf', 0); ok('n=0 releases', !N.list(S).turf);
// the phone total stays <= 12 whenever foot + humans + reserved fit, for every mix
let worst = 0, okAll = true;
for (let foot = 0; foot <= 6; foot++) for (let hum = 0; hum <= 2; hum++) for (let other = 0; other <= 6; other++) for (let crit = 0; crit <= 4; crit++) {
  const resv = other + crit; if (foot + hum + resv > 12) continue;
  const f = crit ? 0 : N.AMBIENT_FLOOR, amb = N.ambientCap({ mobile: true, foot, hum, resv, floor: f }), tot = amb + foot + hum + resv;
  if (crit && tot > 12) okAll = false; worst = Math.max(worst, crit ? tot : 0);
}
ok('with mission NPCs the phone never goes over 12', okAll && worst <= 12, worst);
ok('without the hook the old floor could go over (why the hook exists)', N.ambientCap({ foot: 2, hum: 0, resv: 9, floor: 4 }) + 2 + 9 > 12);
ok('desktop cap 40', N.ambientCap({ mobile: false, resv: 3 }) === 37);
// grant
ok('critical always gets all', N.grant({ cap: 12, used: 12, free: 0, reserved: {} }, 'g', 2, true) === 2);
ok('normal gets what is free', N.grant({ cap: 12, used: 11, free: 1, reserved: {} }, 'g', 2, false) === 1);
ok('normal keeps what it holds', N.grant({ cap: 12, used: 12, free: 0, reserved: { g: 2 } }, 'g', 2, false) === 2);
ok('over the cap counts against a normal holder', N.grant({ cap: 12, used: 13, free: 0, reserved: { g: 2 } }, 'g', 2, false) === 1);
ok('no budget api: all', N.grant(null, 'g', 2, false) === 2);
// watchdog: released on mission end / fail / quit
const W = N.createSlots(); let live = true, live2 = true;
N.setRes(W, 'valeMark', 1, { critical: true, active: () => live });
N.setRes(W, 'villaGuards', 2, { critical: true, keep: true, active: () => live2 });
N.setRes(W, 'events', 2);
ok('watchdog idle while missions run', N.sweep(W).length === 0 && N.criticalSum(W) === 3);
live = false; let ch = N.sweep(W, 10);
ok('mission over: critical drops at once', N.list(W).valeMark?.critical === false && ch.length === 0);
ch = N.sweep(W, 12); ok('slot held through the grace (no zone toast over the purse)', !!N.list(W).valeMark && ch.length === 0);
ch = N.sweep(W, 10 + N.GRACE_S); ok('then released', ch.some(c => c.key === 'valeMark' && c.n === 0) && !N.list(W).valeMark);
live2 = false; ch = N.sweep(W, 20);
ok('keep: body stays, slot back on the normal budget', N.list(W).villaGuards?.n === 2 && N.list(W).villaGuards.critical === false && N.floor(W) === 4);
ok('keep: never released by the watchdog', N.sweep(W, 99).length === 0 && !!N.list(W).villaGuards);
N.setRes(W, 'pitFighter', 1, { critical: true, active: () => { throw new Error('gone'); } });
N.sweep(W, 100); ok('a throwing check counts as over', N.sweep(W, 100 + N.GRACE_S).some(c => c.key === 'pitFighter' && c.n === 0));
ok('plain slots untouched by the watchdog', N.list(W).events.n === 2);

// ---------- bar contact ----------
const C = J.CONTACT;
ok('named contact at a bar in a Mars district', C.name === 'Juno Pike' && C.bar === 'Cantina' && C.district === 'Ares Junction');
ok('colony-relative spot near the Cantina door [31,-13.6]', Array.isArray(C.at) && Math.hypot(C.at[0] - 31, C.at[1] + 13.6) < 6 && Math.hypot(C.at[0] - 31, C.at[1] + 17) > 6);
ok('far from the villa', Math.hypot(C.at[0] - VILLA_AT[0], C.at[1] - VILLA_AT[1]) > 200);
const st0 = loadState(null), stU = { ...st0, unlocked: true }, stT = { ...stU, tipped: true };
ok('no button before the unlock', !J.offer(st0, 1));
ok('button when unlocked and close', J.offer(stU, 2) && J.offer(stT, 2));
ok('no button when far', !J.offer(stU, C.talkR + 0.1));
ok('no button while driving / inside / mid-heist', !J.offer(stU, 1, { driving: true }) && !J.offer(stU, 1, { indoors: true }) && !J.offer(stU, 1, { heist: true }));
ok('first time: the full tip', J.lineFor(stU) === J.LINES.tip && /Halvorsen Villa/.test(J.LINES.tip) && /Sable/.test(J.LINES.tip));
ok('after Sable texted: a reminder', J.lineFor(stT) === J.LINES.again && /already texted/.test(J.LINES.again));
ok('plain words with ◆ and ➤', Object.values(J.LINES).every(l => l.startsWith('◆') && l.includes('➤')) && /^💬 /.test(J.LABEL));
ok('same unlock rule (3 city missions), never twice', decide(st0, 2).unlock === false && decide(st0, 3).unlock === true && decide(stU, 9).unlock === false && decide(stT, 9).tip === false);
ok('text holds only close to Juno', C.holdR > C.talkR && C.holdR <= 15);

// ---------- hooks ----------
const ws = src('world.js'), hookLines = ws.split('\n').filter(l => /npcSlots/.test(l));
ok('world.js: one guarded hook line', hookLines.length === 1 && /globalThis\.SSX\?\.npcSlots\?\.floor\?\.\(\) \?\? 4/.test(hookLines[0]));
const vs = src('mars/villa.js');
ok('villa guards use critical slots during the job', /reserve\('villaGuards', n, critical \? \{ critical: true, keep: true/.test(vs) && /release\('villaGuards'\)/.test(vs));
const ms = src('activities/mark.js');
ok('Kessa Vane holds a critical slot, released on drop', /reserve\('valeMark', 1, \{ critical: true/.test(ms) && /release\('valeMark'\)/.test(ms));
const ns = src('mars/npcslots.js');
ok('Pit fighter slot while a bout / series is on', /'pitFighter', 1, \{ critical: true/.test(ns) && /inDuel/.test(ns) && /__activities\?\.pit/.test(ns));
ok('new landing clears old slots', /S\.res\.clear\(\)/.test(ns));
const ht = src('mars/heisttip.js');
ok('Sable text waits at Juno\'s door; bar contact ticked', /!barContactNear\(\)/.test(ht) && /barContactTick\(dt, ctx, TIP_API\)/.test(ht) && /npcSlotsTick\(dt, ctx\)/.test(ht));
const bc = src('mars/barcontact.js');
ok('context button only, same-pointer tap', /tap\(btn/.test(bc) && /display:none/.test(bc) && /racehooks/.test(bc));
const sw = src('sw.js');
ok('sw.js precaches the new modules', ['npcslots', 'npcslotscore', 'barcontact', 'barcontactcore'].every(m => sw.includes(`'mars/${m}'`)));

console.log(fails ? `\n${fails}/${n} FAILED` : `\nall ${n} passed`);
process.exit(fails ? 1 : 0);
