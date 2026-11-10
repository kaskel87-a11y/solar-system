// Danny's room is off the club's back door, and her paid show stays out of Ines's VIP room.
import { readFileSync } from 'node:fs';
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const room = src('dannyroom.js'), ints = src('interiors.js'), html = src('index.html'), sw = src('sw.js');
let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };

const block = /export const DANNY_ROOM = (\{[\s\S]*?\n\});/.exec(room);
const R = Function('return ' + block[1])();
const price = +(/export const SPECIAL_PRICE = (\d+)/.exec(room)[1]);
const video = /export const SPECIAL_SRC = '([^']+)'/.exec(room)[1];
ok('price is 5000', price === 5000);
ok('video path', video === 'assets/danny/special.mp4');
ok('inline playback and a close button', /playsinline/.test(room) && /webkit-playsinline/.test(room) && /id="dannyVidClose"/.test(room) && /min-height:44px/.test(room));
ok('missing reel refunds the price', /reward\?\.\(0, SPECIAL_PRICE\)/.test(room));

const shell = { x0: -33, x1: 25, z0: -8, z1: 24 };
const inside = (p) => p.x > R.x0 && p.x < R.x1 && p.z > R.z0 && p.z < R.z1;
ok('room sits inside the club shell', R.x0 > shell.x0 && R.x1 < shell.x1 && R.z0 > shell.z0 && R.z1 < shell.z1);
ok('room is west of Ines', R.x1 < 6);
for (const k of ['land', 'pole', 'dance', 'show', 'special', 'exit']) ok(k + ' is in her room', inside(R[k]));
ok('back door is on the main-room north wall, west of the stage', R.door.x < -5 && R.door.x > -11 && R.door.z < -6 && R.door.z > -8);
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
ok('no 50 cr option on her menu', !/Dance · 50 cr/.test(room) && !/id: 'private'/.test(room));
ok('special covers standing in front of her and misses the exit', d(R.pole, R.land) < 2.1 && d(R.pole, R.exit) > 2.1 + 0.6);
ok('price card leads with Special', /id="pshowSpecial"/.test(src('privateshow.js')) && src('privateshow.js').indexOf('id="pshowSpecial"') < src('privateshow.js').indexOf('id="pshowYes"'));
ok('other dancers keep their private dance', /label: 'Private dance'/.test(src('clubprivate.js')));

ok('club builds her room and keeps her on stage', /addDannyRoom\(api/.test(ints) && /outfit: n === 'danny' \? 'stage' : 'bikini'/.test(ints));
ok('VIP room no longer hosts her show', !/id: 'show'/.test(ints) && !/id: 'private'/.test(ints));
ok('door and special share the danny action', /id: 'danny-door'/.test(room) && /id: 'danny-special'/.test(room) && /adult: true/.test(room));
ok('index routes the door and gates the special', /s\.act === 'danny'/.test(html) && /raw\?\.adult/.test(html) && /adultGate\(go\)/.test(html));
ok('worker precaches the room', /dannyroom\.js\$\{q\}/.test(sw));
const sib = f => readFileSync(new URL('./' + f, import.meta.url), 'utf8');
ok('tests stand where the dance and the show moved', /debugInside\(-29\.4, -5\.2/.test(sib('test-danny.js')) && /debugInside\(-28\.4, -6\.35/.test(sib('test-danny.js')) && /debugInside\(-29\.4, -5\.2/.test(sib('test-v74.js')));

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('danny room OK');
