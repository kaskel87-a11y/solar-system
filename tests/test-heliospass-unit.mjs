// v7.5.33 unit test: Helios Heights guest pass (mars/heliospasscore.js) + its wiring. node tests/test-heliospass-unit.mjs
import * as H from '../mars/heliospasscore.js';
import { readFileSync } from 'fs';
let fails = 0; const ok = (name, c) => { if (!c) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const IN = [370, 85], GATE = [324, 150], T0 = 1e12;

ok('Helios circle matches rags-data.json', (() => { const d = JSON.parse(src('modes/rags-data.json')).districts.helios; return d.center[0] === H.HELIOS.centre[0] && d.center[1] === H.HELIOS.centre[1] && d.radius === H.HELIOS.r; })());
ok('villa is inside Helios, the gate outside spot is not', H.inHelios(IN) && !H.inHelios(GATE) && !H.inHelios(null));
// paying
ok('broke + empty stash: nothing to offer', H.options({}, 100).length === 0);
ok('350 cr pays', H.options({}, 350).some(o => o.kind === 'cash' && o.cr === 350));
ok('1 void honey pays', H.options({ voidhoney: 1 }, 0).some(o => o.item === 'voidhoney' && o.qty === 1));
ok('3 glow-dust pays, 2 does not', H.options({ glowdust: 3 }, 0).some(o => o.item === 'glowdust') && !H.options({ glowdust: 2 }, 0).length);
ok('no bribes while wanted', H.options({ voidhoney: 5 }, 9999, 2).length === 0);
ok('junk values are safe', H.options({ glowdust: 'x', voidhoney: -3 }, NaN).length === 0);
// the pass: no pass = restricted as before
let s = H.fresh();
ok('no pass: not allowed', !H.allow(s, T0));
let r = H.buy(s, T0); s = r.s;
ok('buy gives one pass', r.ok && s.pass && s.bought === 1 && H.allow(s, T0));
ok('can\u2019t stack passes', !H.buy(s, T0).ok);
r = H.tick(s, GATE, T0 + 1000); ok('waiting at the gate keeps it', r.ev === null && r.s.pass); s = r.s;
r = H.tick(s, IN, T0 + 2000); ok('drive in: entry', r.ev === 'enter' && r.s.pass.entered); s = r.s;
// entry only: walk back out -> used
let e = H.tick(s, GATE, T0 + 3000); ok('leave without a job: pass used up', e.ev === 'used' && !e.s.pass && e.s.used === 1 && !H.allow(e.s, T0 + 3000));
// heist inside
r = H.jobStart(s, 'halvorsen-villa', IN); ok('heist inside Helios = the one job', r.ok && r.s.pass.job === 'halvorsen-villa' && r.s.jobs === 1); s = r.s;
ok('second job refused', !H.jobStart(s, 'other', IN).ok);
e = H.tick(s, GATE, T0 + 4000, true); ok('escaping out of Helios mid-heist keeps the pass', e.ev === null && e.s.pass);
e = H.tick(s, GATE, T0 + 4000, false); ok('job not finished yet: still held', e.ev === null && e.s.pass);
r = H.jobEnd(s, 'halvorsen-villa', T0 + 5000); ok('heist ends: grace to walk out', r.ok && r.s.pass.out === T0 + 5000 + H.GRACE_S * 1000 && H.allow(r.s, T0 + 6000)); s = r.s;
e = H.tick(s, IN, T0 + 5000 + H.GRACE_S * 1000 + 1); ok('grace over: used up, restricted again', e.ev === 'used' && !e.s.pass && !H.allow(e.s, T0 + 5000 + H.GRACE_S * 1000 + 1));
e = H.tick(s, GATE, T0 + 7000); ok('walk out after the job: used up', e.ev === 'used' && !e.s.pass);
ok('a heist outside Helios is not the pass job', !H.jobStart(H.buy(H.fresh(), T0).s, 'x', GATE).ok);
ok('load: round-trip + junk', JSON.stringify(H.load(JSON.stringify(s))) === JSON.stringify(s) && H.load('nope').pass === null && H.load({ v: 2 }).bought === 0);
ok('status line', /one entry/.test(H.status(H.buy(H.fresh(), T0).s, T0)) && /walk out/.test(H.status(s, T0 + 5000)));
// wiring
const rt = src('mars/heliospass.js'), rags = src('modes/rags.js'), html = src('index.html'), sw = src('sw.js'), tip = src('mars/heisttip.js'), hs = src('heist.js');
ok('rags gate asks the pass before kicking + offers it', /&& !window\.SSX\?\.heliosPass\?\.allow\?\.\(\)\)/.test(rags) && /heliosPass\?\.offer\?\.\('Porter'\)/.test(rags));
ok('normal game: Helios checkpoint forwards to the pass', /heliosPass\?\.onCheckpoint\?\.\(ev\)/.test(html) && /ev\.id !== 'cp-helios'/.test(rt));
ok('bribe opens Ben\u2019s Halvorsen Villa heist for one run', /bribeUnlock\(\)/.test(rt) && /bribeRelock\(\)/.test(rt) && /export function bribeUnlock/.test(tip) && /heist\.registerHeist\(VILLA\)/.test(tip) && /unregisterHeist\(id\)/.test(hs));
ok('heist events drive the pass', /heist:start/.test(rt) && /heist:done/.test(rt) && /heist:fail/.test(rt));
ok('buttons black/white via tap()', /#hpassPanel button \{[^}]*background: #000; color: #fff;/.test(rt) && /tap\(b, fn\)/.test(rt));
ok('script tag + importmap + sw', /<script type="module" src="\.\/mars\/heliospass\.js\?v=/.test(html) && /"\.\/mars\/heliospasscore\.js": /.test(html) && /`mars\/heliospass\.js\$\{q\}`, `mars\/heliospasscore\.js\$\{q\}`/.test(sw));
ok('savecode knows the key', /'ssx\.heliospass\.v1'/.test(src('savecode.js')));
console.log(fails ? `${fails} FAIL` : 'all ok'); process.exit(fails ? 1 : 0);
