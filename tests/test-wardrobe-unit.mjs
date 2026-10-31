// Unit tests for the Wardrobe locked rows (mars/skinscore.js locked). Run: node tests/test-wardrobe-unit.mjs
import * as C from '../mars/skinscore.js';
let fails = 0, n = 0;
const ok = (name, cond, info = '') => { n++; if (!cond) { fails++; console.log('FAIL', name, info); } };
const f = C.fresh(), L = C.locked(f, 409);
ok('allUnownedLocked', L.length === C.SKINS.length - 1 && !L.some(r => r.id === C.FREE || r.id === C.STOCK), L.map(r => r.id).join());
ok('cheapestFirst', L.every((r, i) => !i || r.price >= L[i - 1].price) && L[0].price === 300);
ok('fields', L.every(r => r.name && r.icon && Number.isFinite(r.price)));
ok('afford', L.find(r => r.id === 'punk').afford && !L.find(r => r.id === 'overalls').afford && !C.locked(f, NaN).some(r => r.afford));
ok('farNoBuy', L.every(r => r.canBuy === false) && C.locked(f, 0, true).every(r => r.canBuy === true));
const s2 = C.addOwned(C.addOwned(f, 'punk'), 'chrome');
ok('ownedDropOut', C.locked(s2, 0).map(r => r.id).join() === C.SKINS.filter(k => !['rusty', 'punk', 'chrome'].includes(k.id)).map(k => k.id).join());
ok('allOwnedEmpty', C.locked(C.norm({ owned: C.SKINS.map(k => k.id) }), 1e9).length === 0);
ok('wardrobeRowsUnchanged', C.rows(f, 409, 'wardrobe').map(r => r.id).join() === [C.STOCK, C.FREE].join());
// Velvet Mack: 1,000 cr, between Hazmat Cook (800) and Neon Street Hustler (1,200), with a hand prop (the cane)
const ids = C.SKINS.map(k => k.id), M = C.BY_ID.mack;
ok('mack', M && M.name === 'Velvet Mack' && M.price === 1000 && ids.indexOf('mack') === ids.indexOf('hazmat') + 1 && ids.indexOf('hustler') === ids.indexOf('mack') + 1, ids.join());
ok('mackProp', Array.isArray(M?.prop) && M.prop.length >= 2 && M.prop.every(key => !!C.matSpec(M, key) && M.parts.some(p => p[0] === 'armR' && p[5] === key)), JSON.stringify(M?.prop));
ok('mackPropOnlyCane', M.parts.filter(p => M.prop.includes(p[5])).every(p => p[0] === 'armR' && p[3][1] <= -0.62));
ok('mackLockedRow', C.locked(C.fresh(), 409).find(r => r.id === 'mack')?.price === 1000 && !C.locked(C.fresh(), 409).find(r => r.id === 'mack').afford && C.locked(C.fresh(), 1000).find(r => r.id === 'mack').afford);
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n} wardrobe unit checks`);
process.exit(fails ? 1 : 0);
