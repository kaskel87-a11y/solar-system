// Notices dismiss on the frame clock, and each one has a 44px ✕.
import { readFileSync } from 'node:fs';
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = src('index.html'), cb = src('mars/crimebreak.js'), ps = src('privateshow.js'), cp = src('clubprivate.js'), ob = src('onboard.js'), hx = src('hud/hudx.js'), st = src('help/stuck.js'), cq = src('mars/consequences.js');
let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };

ok('frame clock dismisses toast, card and radio', /function noticesTick\(/.test(html) && /noticesTick\(\)/.test(html) && /toastUntil/.test(html) && /popUntil/.test(html) && /radioUntil/.test(html));
ok('toast no longer waits on setTimeout', !/toastTimer/.test(html) && !/radioTimer/.test(html));
ok('close clears a stuck toast queue', /function dismissToast\(\)/.test(html) && /toastQ\.length = 0/.test(html));
ok('leaving a building clears the toast', /if \(!ev\.on\) \{ dismissToast\(\)/.test(html));
ok('toast, discovery, radio, quest and sheet get a 44px ✕', /className = 'ssx-x'/.test(html) && /min-width: 44px; min-height: 44px/.test(html) && /mountX\(toastEl/.test(html) && /mountX\(discPop/.test(html) && /mountX\(radioEl/.test(html) && /mountX\(questTrack/.test(html) && /mountX\(sheetEl/.test(html));
ok('quest card stays hidden until the step changes', /questHide = qk/.test(html));
ok('waypoint chip can be closed', /waySnooze/.test(hx) && /aria-label="Close"/.test(hx));
ok('tour ✕ is 44px', /#obLine \.ob-x\{min-width:44px;min-height:44px/.test(ob));
ok('crime break corner ✕ closes', /class="x" data-a="close"/.test(cb) && /a === 'close'/.test(cb));
ok('danny and dancer price cards have ✕', /id="pshowX"/.test(ps) && /id="cpX"/.test(cp));
ok('stuck hint and busted screen have ✕', /class="x" aria-label="Close"/.test(st) && /cqScreen[\s\S]{0,400}class="ssx-x"/.test(cq) && /dataset\.until/.test(cq));

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('notices OK');
