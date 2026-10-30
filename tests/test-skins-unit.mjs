// Unit tests for mars/skinscore.js (pure logic + catalogue data). Run: node tests/test-skins-unit.mjs
import * as C from '../mars/skinscore.js';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } };
const fin = Number.isFinite;

// catalogue: 10-12 skins, first is free, the rest 300-5,000 cr, unique ids, cheapest first
ok('count', C.SKINS.length >= 10 && C.SKINS.length <= 12, C.SKINS.length);
ok('freeFirst', C.SKINS[0].price === 0 && C.FREE === C.SKINS[0].id);
ok('prices', C.SKINS.slice(1).every(k => k.price >= 300 && k.price <= 5000), C.SKINS.map(k => k.price).join());
ok('topIs5000', Math.max(...C.SKINS.map(k => k.price)) === 5000 && C.SKINS.slice(1).some(k => k.price === 300));
ok('sorted', C.SKINS.every((k, i) => !i || k.price >= C.SKINS[i - 1].price));
ok('uniqueIds', new Set(C.SKINS.map(k => k.id)).size === C.SKINS.length && !C.BY_ID[C.STOCK]);
ok('names', C.SKINS.every(k => k.name && k.icon && k.blurb && k.blurb.length <= 110));
const SHAPES = { box: 3, cyl: 3, sph: 1, tor: 2, cone: 2 };
for (const k of C.SKINS) {
  ok('parts:' + k.id, Array.isArray(k.parts) && k.parts.length >= 5 && k.parts.length <= 30, k.parts?.length);
  for (const [i, p] of k.parts.entries()) {
    const [slot, shape, dims, pos, rot, mk, sc] = p, tag = `${k.id}#${i}`;
    ok('slot:' + tag, C.SLOTS.includes(slot), slot);
    ok('shape:' + tag, shape in SHAPES && Array.isArray(dims) && dims.length >= SHAPES[shape] && dims.every(fin), shape + JSON.stringify(dims));
    ok('pos:' + tag, Array.isArray(pos) && pos.length === 3 && pos.every(v => fin(v) && Math.abs(v) < 1.2), JSON.stringify(pos));
    ok('rot:' + tag, !rot || (rot.length === 3 && rot.every(fin)));
    ok('scale:' + tag, sc == null || (sc.length === 3 && sc.every(v => fin(v) && v > 0)));
    const s = C.matSpec(k, mk); ok('mat:' + tag, !!s && !s.hidden && fin(s.c) && s.r >= 0 && s.r <= 1 && s.m >= 0 && s.m <= 1, mk);
  }
  for (const r of C.REGIONS) { const v = k.pal[r]; ok(`region:${k.id}.${r}`, v === undefined || v === null || !!C.matSpec(k, r)); }
  const sm = C.summary(k.id); ok('summary:' + k.id, sm.parts === k.parts.length && Object.keys(sm.per).every(s => C.SLOTS.includes(s)));
  ok('faceSkinHasSkin:' + k.id, !k.face || C.matSpec(k, 'skin')?.c >= 0);
}
// no nudity: every face skin keeps a torso and legs (a shirt / trousers colour, never hidden)
ok('clothed', C.SKINS.every(k => k.pal.torso !== null && k.pal.legs !== null && k.pal.torso !== undefined && k.pal.legs !== undefined));
ok('summaryUnknown', C.summary('nope') === null);
// materials
ok('matHidden', C.matSpec({ pal: { pack: null } }, 'pack').hidden === true && C.matKey({ hidden: true }) === 'hidden');
ok('matNumber', JSON.stringify(C.matSpec({ pal: { a: 0xff0000 } }, 'a')) === JSON.stringify({ c: 0xff0000, r: 0.8, m: 0, e: 0 }));
ok('matShared', C.matSpec({ pal: {} }, 'gold')?.m > 0.5 && C.matSpec({ pal: {} }, 'nope') === null);
ok('matKeyStable', C.matKey(C.matSpec({ pal: { a: 0x10 } }, 'a')) === C.matKey(C.matSpec({ pal: { b: { c: 0x10 } } }, 'b')));
ok('geoKey', C.geoKey('box', [0.1, 0.20000001, 3]) === 'box:0.1,0.2,3');
// save state
const f = C.fresh(); ok('fresh', f.owned.join() === C.FREE && f.eq === C.STOCK);
ok('normJunk', JSON.stringify(C.norm(null)) === JSON.stringify(f) && JSON.stringify(C.parse('{bad')) === JSON.stringify(f) && JSON.stringify(C.parse('"x"')) === JSON.stringify(f));
const n1 = C.norm({ owned: ['chrome', 'punk', 'punk', 'ghost', 7], eq: 'chrome' });
ok('normOwned', n1.owned.join() === [C.FREE, 'punk', 'chrome'].join(), n1.owned.join());
ok('normEq', n1.eq === 'chrome' && C.norm({ owned: [], eq: 'chrome' }).eq === C.STOCK && C.norm({ eq: C.STOCK }).eq === C.STOCK);
ok('roundTrip', JSON.stringify(C.parse(JSON.stringify(n1))) === JSON.stringify(n1));
ok('owns', C.owns(f, C.FREE) && C.owns(f, C.STOCK) && !C.owns(f, 'punk') && !C.owns(null, 'punk'));
// buying
ok('canBuy', JSON.stringify(C.canBuy(f, 'punk', 300)) === JSON.stringify({ ok: true, price: 300 }));
ok('broke', C.canBuy(f, 'punk', 299).why === 'broke' && C.canBuy(f, 'punk', 299).need === 1 && C.canBuy(f, 'punk', NaN).why === 'broke');
ok('owned', C.canBuy(f, C.FREE, 1e9).why === 'owned' && C.canBuy(n1, 'chrome', 1e9).why === 'owned');
ok('unknown', C.canBuy(f, 'nope', 1e9).why === 'unknown');
const a = C.addOwned(f, 'cowboy'); ok('addOwned', a.owned.includes('cowboy') && a.eq === C.STOCK && f.owned.length === 1);
// equip
ok('equipOwned', C.equip(a, 'cowboy').ok && C.equip(a, 'cowboy').state.eq === 'cowboy' && a.eq === C.STOCK);
ok('equipStock', C.equip(a, C.STOCK).ok);
ok('equipNotOwned', !C.equip(a, 'chrome').ok && C.equip(a, 'chrome').state === a);
// rows
const rs = C.rows(a, 1000), rw = C.rows(C.equip(a, 'cowboy').state, 1000, 'wardrobe');
ok('rowsShop', rs.length === C.SKINS.length && rs.find(r => r.id === 'punk').afford && !rs.find(r => r.id === 'chrome').afford && rs.find(r => r.id === 'cowboy').owned);
ok('rowsWardrobe', rw.map(r => r.id).join() === [C.STOCK, C.FREE, 'cowboy'].join() && rw.find(r => r.id === 'cowboy').worn && !rw[0].worn);
// real taps
const d = { id: 3, x: 100, y: 100 };
ok('tap', C.isRealTap(d, { id: 3, x: 104, y: 103 }));
ok('tapMoved', !C.isRealTap(d, { id: 3, x: 100, y: 112 }));
ok('tapWandered', !C.isRealTap(d, { id: 3, x: 100, y: 100 }, 40));
ok('tapScrolled', !C.isRealTap(d, { id: 3, x: 100, y: 100 }, 99));
ok('tapOtherPointer', !C.isRealTap(d, { id: 4, x: 100, y: 100 }) && !C.isRealTap(null, d));
// shop placement data
ok('shop', C.SHOP.name && C.SHOP.aj.length === 2 && C.SHOP.aj.every(fin) && C.SHOP.near > 2 && C.SHOP.near < 8 && C.SAVE_KEY === 'ssx.skins.v1');
ok('fmt', C.fmt(5000) === '5,000' && C.fmt(null) === '0');

// #48 body API fit: every part lands on a real socket; on the blocky body nothing moves (scale 1, offset = -socket position);
// on a slimmer body (the v8 sizes from look/MODELS.md) parts shrink with it, never collapse or blow up
const V8S = { headRadius: 0.117, helmetRadius: 0.2, torso: { w: 0.34, h: 0.55, d: 0.24 }, armRadius: 0.05, upperArm: 0.28, forearmRadius: 0.04, forearm: 0.26, handRadius: 0.036, handLength: 0.18,
  legRadius: 0.075, thigh: 0.42, shinRadius: 0.05, shin: 0.41, footWidth: 0.1, footLength: 0.25, shoulderWidth: 0.558 };
ok('sockOf', C.sockOf('armL', -0.1) === 'armL' && C.sockOf('armL', -0.5) === 'forearmL' && C.sockOf('armR', -0.66) === 'handR' && C.sockOf('legR', -0.3) === 'legR' && C.sockOf('legL', -0.6) === 'shinL' && C.sockOf('legL', -0.84) === 'footL' && C.sockOf('head', -5) === 'head' && C.sockOf('torso', 9) === 'torso' && C.sockOf('armL', NaN) === 'armL');
for (const k of C.SKINS) for (const p of k.parts) { const so = C.sockOf(p[0], p[3][1]); ok('socket:' + k.id, C.SOCKETS.includes(so), so); }
for (const so of C.SOCKETS) for (const face of [false, true]) {
  const b = C.sockFit(so, C.BLOCKY_SIZES, face), bp = C.BLOCKY_SOCK[so.replace(/[LR]$/, '')] || [0, 0, 0];
  ok('blockyIdentity:' + so + face, b.s.every(v => v === 1) && b.o.every((v, i) => Math.abs(v + bp[i]) < 1e-9), JSON.stringify(b));
  const v = C.sockFit(so, V8S, face);
  ok('v8Shrinks:' + so + face, v.s.every(x => fin(x) && x >= 0.3 && x <= 2) && v.s.some(x => x < 1) && v.o.every(fin), JSON.stringify(v));
}
ok('v8Head', Math.abs(C.sockFit('head', V8S, true).s[0] - 0.117 / C.FACE_R) < 1e-9 && Math.abs(C.sockFit('head', V8S, false).s[0] - 0.2 / 0.23) < 1e-9);
ok('v8Torso', Math.abs(C.sockFit('torso', V8S, false).s[0] - 0.34 / 0.56) < 1e-9);
ok('fitJunk', C.sockFit('armL', { armRadius: 'x', upperArm: -1 }, false).s.every(x => x === 1) && C.sockFit('nope', V8S, false).s.join() === '1,1,1' && C.sockFit('head', null, false).s[0] === 1);
ok('hidesHair', C.hidesHair(C.BY_ID.cowboy) && C.hidesHair(C.BY_ID.clown) && C.hidesHair(C.BY_ID.kingpin) && !C.hidesHair(null) && !C.hidesHair(C.BY_ID.chrome) && C.SKINS.every(k => C.hidesHair(k) === (!!k.face && k.parts.some(p => p[0] === 'head'))));

console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n} skins unit checks`);
process.exit(fails ? 1 : 0);
