// Unit tests for the Grin Reaper outfit (mars/skinscore.js 'grinreaper') + its brass bulb horn (mars/honkcore.js, arsenal 'horn').
// Run: node tests/test-honk-unit.mjs
import fs from 'node:fs';
import * as C from '../mars/skinscore.js';
import * as H from '../mars/honkcore.js';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } };
const K = C.BY_ID[H.SKIN];
// the outfit: free, owned by every save (old saves too), original name (no film names), black/white split, horn prop
ok('exists', !!K && K.name === 'Grin Reaper' && K.price === 0 && K.gift === true && K.face === true);
ok('noFilmNames', !/art the clown|terrifier/i.test(JSON.stringify(K)));
ok('giftOwnedFresh', C.fresh().owned.includes(H.SKIN) && C.GIFTS.includes(H.SKIN));
ok('giftOwnedOldSave', C.parse(JSON.stringify({ v: 1, owned: ['rusty', 'punk'], eq: 'punk' })).owned.includes(H.SKIN) && C.parse('junk').owned.includes(H.SKIN));
ok('equipFree', C.equip(C.fresh(), H.SKIN).ok);
ok('inWardrobe', C.rows(C.fresh(), 0, 'wardrobe').some(r => r.id === H.SKIN) && !C.locked(C.fresh(), 0).some(r => r.id === H.SKIN));
ok('clothed', K.pal.torso && K.pal.legs && K.pal.arms && ['pack', 'chest', 'helmet', 'visor'].every(r => C.summary(H.SKIN).hidden.includes(r)), C.summary(H.SKIN).hidden); // no O2 pack / blue chest panel on the jumpsuit
const lum = c => { const s = C.matSpec(K, c); return ((s.c >> 16 & 255) + (s.c >> 8 & 255) + (s.c & 255)) / 3; };
ok('splitHalves', lum('torso') > 200 && lum('suitB') < 40 && K.parts.some(p => p[0] === 'torso' && p[5] === 'suitB' && p[3][0] < 0 && Math.abs(p[2][0] - 0.286) < 0.01));
ok('crossedSleeve', K.parts.some(p => p[0] === 'armR' && p[5] === 'suitB') && !K.parts.some(p => p[0] === 'armL' && p[5] === 'suitB') && K.parts.some(p => p[0] === 'legL' && p[5] === 'suitB') && !K.parts.some(p => p[0] === 'legR' && p[5] === 'suitB'));
ok('ruff', K.parts.filter(p => p[5] === 'ruff' && p[0] === 'torso').length >= 2 && lum('ruff') > 240);
ok('twoPomPoms', K.parts.filter(p => p[0] === 'torso' && p[1] === 'sph' && p[5] === 'suitB' && p[3][2] < -0.19).length === 2);
ok('topHat', K.parts.filter(p => p[0] === 'head' && p[1] === 'cyl' && p[5] === 'black' && p[3][1] > 0.17).length === 2);
ok('grin', ['gum', 'tooth'].every(m => K.parts.some(p => p[0] === 'head' && p[5] === m)));
ok('gloves', ['armL', 'armR'].every(s => K.parts.some(p => p[0] === s && p[5] === 'glove')));
ok('shoes', ['legL', 'legR'].every(s => K.parts.filter(p => p[0] === s && p[5] === 'black').length >= 2));
// phone rule: few distinct slot+material draws
const draws = new Set(K.parts.map(p => p[0] + '|' + C.matKey(C.matSpec(K, p[5])))).size + 1; // + the face paint
ok('drawBudget', draws <= 18, draws);
ok('noTextures', K.parts.every(p => ['box', 'cyl', 'sph', 'tor', 'cone'].includes(p[1])));
// the horn prop: only on the right hand, only the horn's materials, shown while the arsenal's horn is in hand
ok('hornProp', Array.isArray(K.prop) && K.propOn === H.CORE && K.prop.every(m => K.parts.some(p => p[5] === m)) && K.parts.filter(p => K.prop.includes(p[5])).every(p => p[0] === 'armR' && p[3][1] < -0.7));
ok('hornPropOnlyHorn', K.parts.filter(p => K.prop.includes(p[5])).length === 3);
// arsenal: the horn is a weak melee weapon (source check; arsenal.js imports three)
const ars = fs.readFileSync(new URL('../mars/arsenal.js', import.meta.url), 'utf8'), m = ars.match(/horn: \{ core: '([a-z_]+)'.*?kind: '(\w+)', mult: ([0-9.]+), knockMult: ([0-9.]+)/);
ok('arsHorn', m && m[1] === H.CORE && m[2] === 'melee' && +m[3] < 1 && +m[4] < 1, m && m.slice(1).join());
ok('arsNoBlood', /a\.id !== 'horn'\) decal/.test(ars));
// honk spec: a buzzy ~400 Hz squeeze, two honks for the taunt
const sw = H.honkSpec('swing', 0.5), ta = H.honkSpec('taunt', 0.5);
ok('honkOne', sw.length === 1 && sw[0].f > 330 && sw[0].f < 460 && sw[0].f0 < sw[0].f && sw[0].f1 < sw[0].f && sw[0].dur > 0.15 && sw[0].dur < 0.4 && sw[0].vol > 0 && sw[0].vol <= 0.5);
ok('honkTwo', ta.length === 2 && ta[1].t > ta[0].t + ta[0].dur * 0.9 && ta[1].f > ta[0].f);
ok('honkRand', [0, 1].every(r => H.honkSpec('swing', r).every(s => Number.isFinite(s.f) && s.f > 300)));
// save + button + first-wear
ok('parse', H.parse('x').given === false && H.parse('{"v":1,"given":true,"honks":4}').given === true && H.parse('{"v":1,"honks":-3}').honks === 0);
ok('button', H.buttonMode({ worn: true, onFoot: true, mars: true }) === 'taunt' && H.buttonMode({ worn: false, onFoot: true, mars: true }) === 'none' && H.buttonMode({ worn: true, onFoot: false, mars: true }) === 'none' && H.buttonMode({ worn: true, onFoot: true, mars: true, inside: true }) === 'none' && H.buttonMode({ worn: true, onFoot: true, mars: true, down: true }) === 'none');
ok('onWear', JSON.stringify(H.onWear(H.fresh(), { worn: true, owned: false })) === '{"give":true,"equip":true}' && H.onWear(H.fresh(), { worn: true, owned: true }).give === false && H.onWear({ given: true }, { worn: true }).equip === false && H.onWear(H.fresh(), { worn: false }).equip === false);
ok('tauntCd', H.canTaunt(1, -9) && !H.canTaunt(1.2, 1) && H.canTaunt(1.7, 1));
ok('scareRadii', H.SCARE.taunt > H.SCARE.swing && H.SCARE.swing >= 6 && H.SCARE.t > 1);
// wiring: precached, loaded once, no ?v= imports
const swjs = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), idx = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), hj = fs.readFileSync(new URL('../mars/honk.js', import.meta.url), 'utf8');
ok('precache', swjs.includes('`mars/honk.js${q}`') && swjs.includes('`mars/honkcore.js${q}`'));
ok('script', (idx.match(/src="\.\/mars\/honk\.js\?v=/g) || []).length === 1);
ok('noVImports', !/from '[^']+\?v=/.test(hj));
ok('blackButton', /#honkBtn\{[^}]*background:#000[^}]*color:#fff/.test(hj));
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n} honk unit checks`);
process.exit(fails ? 1 : 0);
