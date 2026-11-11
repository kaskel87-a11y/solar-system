// Snack bar rules and placement. node tests/test-snack-unit.mjs
import { readFileSync } from 'fs';
import * as C from '../snackbarcore.js';
let fails = 0; const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };

ok('four plates', C.MENU.length === 4);
ok('names', ['Wings', 'Sliders', 'Nachos', 'Red Dust burger'].every(n => C.MENU.some(it => it.name === n)));
ok('prices', C.MENU.map(it => it.price).join() === '25,30,20,45');
ok('heals', C.MENU.every(it => it.heal >= 20 && it.heal <= 40));
const burger = C.byId('burger');
ok('burger buff', burger.buff === 60 && C.BUFF_MIT === 0.75);
ok('short on cash', C.quote(C.byId('wings'), 40, 100, 10).ok === false);
ok('full refuses wings', /full/.test(C.quote(C.byId('wings'), 100, 100, 500).why));
ok('burger allowed when full', C.quote(burger, 100, 100, 500).ok === true);
ok('wings when hurt', C.quote(C.byId('wings'), 40, 100, 500).ok === true && C.quote(C.byId('wings'), 40, 100, 500).heal === 25);

// sits on the empty floor: east of the partition (x 11.35), west of the office (x 18), north of Mina (z 7.4)
ok('counter clear of the office', C.AT.x < 16.5 && C.AT.x > 12 && C.AT.z > 2.5 && C.AT.z < 6.5);

const wing = readFileSync(new URL('../velvetwing.js', import.meta.url), 'utf8');
const snack = readFileSync(new URL('../snackbar.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
ok('eat button', /EAT/.test(snack) && /id: 'snack'/.test(snack));
ok('hook only', /upgradeHook/.test(snack) && /ready: false/.test(snack));
ok('heal exists', /heal\(n\)/.test(game));
ok('mina stays south', /z: 8\.4/.test(wing) || /8\.4/.test(wing));
console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
