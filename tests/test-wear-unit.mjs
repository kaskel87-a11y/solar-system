// v7.5.96 wear effects + mounted guns. node tests/test-wear-unit.mjs
import { readFileSync } from 'fs';
import * as C from '../mars/skinscore.js';
import * as W from '../mars/wearfxcore.js';
import * as R from '../mars/ridegunscore.js';
import * as J from '../mars/jetpackcore.js';

let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

for (const id of W.IDS) {
  const skin = C.BY_ID[id];
  ok('skin ' + id, !!skin && skin.fx === id && skin.parts.length >= 5 && /Wardrobe/.test(skin.blurb) && skin.blurb.length <= 110);
  ok('does something ' + id, W.moveOf(id).speed > 1 || W.moveOf(id).jump > 1 || W.moveOf(id).hover > 0 || W.meleeOf(id) > 1 || !!W.jetOf(id));
}
ok('super jet beats the shop pack', W.jetBeatsShop(W.jetOf('superjet')));
ok('raccoon is a run', W.moveOf('raccoon').speed > 1.2 && W.meleeOf('raccoon') === 1);
ok('merc punches harder', W.meleeOf('merc') > 1.5);
ok('skates coast', W.moveOf('skates').coast > 0.4 && W.moveOf('skates').speed > 1.5);
ok('springs launch', W.moveOf('springs').jump > 2);
ok('hover floats', W.moveOf('hover').hover > 0.3);

const shop = J.step(J.fresh(), { jump: true, airborne: true, alt: 1, vy: 0, g: 3.7, mode: 'MARS', dt: 1 });
const suit = J.step(J.fresh(), { jump: true, airborne: true, alt: 1, vy: 0, g: 3.7, mode: 'MARS', dt: 1, thrust: 14, maxUp: 12, burn: 11, ceil: 120, fuelMax: 180 });
ok('super climb is higher in one second', suit > shop);

ok('guns then rockets', R.mode([]) === null && R.mode([R.GUNS]) === 'gun' && R.mode([R.GUNS, R.ROCKETS]) === 'rocket' && R.mode([R.ROCKETS]) === null);
ok('kit fits every car name', ['rover', 'hauler', 'buggy', 'stolen'].every(R.covers) && !R.covers(''));
ok('rocket is a rocket', R.weapon([R.GUNS, R.ROCKETS]).rocket === true && R.weapon([R.GUNS]).twin === true);

const game = src('game.js');
ok('wear drops grant the suit', game.includes("skin: 'raccoon'") && game.includes('skins?.grant'));
ok('ride kit is a depot item', game.includes("kind: 'ridekit'") && game.includes('ridekit: [\'depot\']'));
ok('every driven car can use the kit', /if \(st\.driving\) \{ const kit = rideKit\(\)/.test(game));
ok('no trademark in the suit name', !/deadpool/i.test(src('mars/skinscore.js')) && C.BY_ID.merc.name === 'Crimson Mercenary');

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('wear unit ok');
