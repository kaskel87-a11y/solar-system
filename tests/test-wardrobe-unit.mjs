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
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n} wardrobe unit checks`);
process.exit(fails ? 1 : 0);
