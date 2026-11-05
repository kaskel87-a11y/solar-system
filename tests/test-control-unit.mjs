// Control's Mars job offers (mars/controlcore.js): first offer ~20 s after landing, ~20 s after a job ends, 30-45 s apart
// while idle, Later snoozes ~45 s, no cap, one offer at a time, the clock holds while busy; plus wiring (one index.html
// hook, import map, precache line, no version bump). node tests/test-control-unit.mjs
import { readFileSync } from 'fs';
import * as K from '../mars/controlcore.js';
let pass = 0, fail = 0; const t = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const run = (s, secs, o = {}) => { for (let i = 0; i < secs * 4; i++) { const r = K.step(s, { dt: 0.25, onMars: true, ...o }); if (r) return i / 4 + 0.25; } return null; };
let s = K.fresh();
t('nothing off Mars', K.step(s, { dt: 1, onMars: false }) === null && s.next === null);
let at = run(s, 60); t('first offer ~20 s after landing', at !== null && Math.abs(at - 20) < 0.6);
K.shown(s, { key: 'taxi', id: 'mctl:taxi', text: 'x' });
t('one at a time: nothing fires while one is pending', run(s, 120) === null && s.offers === 1);
K.resolve(s, 'later'); at = run(s, 120); t('Later snoozes ~45 s', Math.abs(at - 45) < 0.6);
// no cap: keep pressing Later 20 times, offers keep coming 45 s apart
let ok = true; for (let k = 0; k < 20; k++) { K.shown(s, { key: 'k' + k, id: 'mctl:k', text: 'x' }); K.resolve(s, 'later'); const a = run(s, 120); if (a === null || Math.abs(a - 45) > 0.6) ok = false; }
t('no cap: 20 Laters in a row, still offering', ok && s.laters === 21);
K.shown(s, { key: 'a', id: 'mctl:a', text: 'x' }); K.resolve(s, 'none', { rnd: () => 0 }); t('idle gap min 30', Math.abs(run(s, 120) - 30) < 0.6);
K.shown(s, { key: 'a', id: 'mctl:a', text: 'x' }); K.resolve(s, 'none', { rnd: () => 1 }); t('idle gap max 45', Math.abs(run(s, 120) - 45) < 0.6);
K.shown(s, { key: 'a', id: 'mctl:a', text: 'x' }); K.resolve(s, 'expired', { rnd: () => 0.5, age: 25 }); t('ignored offer counts its screen time toward the gap', Math.abs(run(s, 120) - 12.5) < 0.6);
// busy holds the clock; ~20 s after the job ends
K.shown(s, { key: 'taxi', id: 'mctl:taxi', text: 'x' }); K.resolve(s, 'started');
t('stops while busy (job)', run(s, 300, { busy: 'job' }) === null);
t('stops while wanted / race / heist / pit', ['wanted', 'race', 'heist', 'pit', 'custody'].every(b => run(s, 100, { busy: b }) === null));
at = run(s, 60); t('~20 s after the job ends', Math.abs(at - 20) < 0.6);
// radio busy: wait, never stack
s = K.fresh(); t('another radio up: wait', run(s, 60, { radioUp: true }) === null); t('fires once the radio clears', run(s, 1) !== null);
// leave Mars and come back: 20 s again
s = K.fresh(); run(s, 10); K.step(s, { dt: 1, onMars: false }); t('re-land resets to ~20 s', Math.abs(run(s, 60) - 20) < 0.6);
t('waypoint accept waits 75 s', (K.resolve(s, 'waypoint'), s.next === 75));
// pick: rotates, never twice in a row
s = K.fresh(); let last = null, rep = false; for (let k = 0; k < 40; k++) { const p = K.pick(s, ['a', 'b', 'c']); if (p === last) rep = true; s.lastKey = last = p; }
t('pick never repeats back to back', !rep); t('pick single', K.pick(K.fresh(), ['z']) === 'z'); t('pick none', K.pick(K.fresh(), []) === null);
// wiring
const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const src = readFileSync(new URL('../mars/control.js', import.meta.url), 'utf8');
t('one index.html script hook', (idx.match(/src="\.\/mars\/control\.js\?v=/g) || []).length === 1);
t('import map has both files', /"\.\/mars\/control\.js": "\.\/mars\/control\.js\?v=/.test(idx) && /"\.\/mars\/controlcore\.js"/.test(idx));
t('precache line', /mars\/control\.js\$\{q\}/.test(sw) && /mars\/controlcore\.js\$\{q\}/.test(sw));
t('no ?v= in imports', !/from ['"][^'"]*\?v=/.test(src));
t('no onclick', !/onclick/i.test(src));
t('Accept hook only takes mctl: ids', /startsWith\('mctl:'\)/.test(src) && /orig\.call\(this, id/.test(src));
console.log(`${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`); process.exit(fail ? 1 : 0);
