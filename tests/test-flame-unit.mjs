// Flamethrower rules (mars/flamecore.js): shop rows, buying, fuel, the 8 m cone, aim, vehicle fuse, farm skip. node tests/test-flame-unit.mjs
import * as C from '../mars/flamecore.js';
let n = 0, bad = 0; const ok = (name, cond, info) => { n++; if (!cond) { bad++; console.log('FAIL', name, info ?? ''); } };

ok('price ~3500', C.PRICE >= 3000 && C.PRICE <= 4000, C.PRICE);
ok('range ~8 m', C.RANGE === 8);
ok('caps', C.MAX_PARTS <= 256 && C.MAX_PARTS_PHONE <= 160 && C.MAX_BURN <= 12);
ok('own save key, not the farm', C.SAVE_KEY === 'ssx.flame.v1' && !/farm/.test(C.SAVE_KEY));
// migrate
const m0 = C.migrate(null); ok('fresh', !m0.owned && m0.fuel === 0 && !m0.eq);
const m1 = C.migrate({ owned: true, fuel: 999, eq: true }); ok('migrate clamps fuel', m1.fuel === C.TANK && m1.eq);
ok('migrate: eq needs owned', C.migrate({ owned: false, eq: true }).eq === false);
ok('migrate junk', C.migrate({ fuel: 'x' }).fuel === 0);
// shop
ok('sells at Ozzie', C.sellsHere('guns', []));
ok('sells where weapons are sold', C.sellsHere('ms:rough-guns', [{ id: 'ms:x', group: 'Weapons', kind: 'weapon' }]));
ok('not at the bar / depot', !C.sellsHere('bar', [{ group: 'Weapons', kind: 'weapon' }]) && !C.sellsHere('depot', []));
ok('not at a non-weapon venue', !C.sellsHere('ms:bodega', [{ id: 'x', group: 'Gear', kind: 'gear' }]));
const s0 = C.fresh();
const r0 = C.shopRow('fl:flamer', s0, 100); ok('row shape', r0.id === 'fl:flamer' && r0.group === 'Weapons' && r0.price === C.PRICE && !r0.afford && r0.ok && !r0.owned);
const f0 = C.shopRow('fl:fuel', s0, 9999); ok('fuel needs the flamer', !f0.ok && /Flamethrower/.test(f0.why) && f0.group === 'Ammo');
ok('no row for junk', C.shopRow('fl:nope', s0, 0) === null);
const poor = C.buy('fl:flamer', s0, 3000); ok('poor', !poor.ok && /Short 500/.test(poor.msg) && poor.cost === 0);
const b1 = C.buy('fl:flamer', s0, 5000); ok('buy', b1.ok && b1.cost === C.PRICE && b1.st.owned && b1.st.eq && b1.st.fuel === C.TANK, b1);
ok('buy is pure', !s0.owned);
const rowO = C.shopRow('fl:flamer', b1.st, 0); ok('owned row says Equipped', rowO.owned && rowO.desc === 'Equipped' && rowO.equipped && !rowO.ok);
const tog = C.buy('fl:flamer', b1.st, 0); ok('owned = toggle equip, free', tog.ok && tog.cost === 0 && tog.st.eq === false);
ok('stowed row', C.shopRow('fl:flamer', tog.st, 0).desc === 'Owned. Tap to equip');
ok('full tank', !C.buy('fl:fuel', b1.st, 9999).ok && C.shopRow('fl:fuel', b1.st, 9999).why === 'Full');
const low = { ...b1.st, fuel: 70 }; const fu = C.buy('fl:fuel', low, 9999); ok('fuel tops up to the tank', fu.ok && fu.st.fuel === C.TANK && fu.cost === C.FUEL_PRICE);
const low2 = { ...b1.st, fuel: 10 }; ok('fuel +50', C.buy('fl:fuel', low2, 9999).st.fuel === 60);
ok('fuel poor', !C.buy('fl:fuel', low2, 10).ok);
// fuel use
ok('burns only while firing', C.burnFuel(50, 1, false) === 50 && Math.abs(C.burnFuel(50, 1, true) - (50 - C.BURN_RATE)) < 1e-9);
ok('never below 0', C.burnFuel(1, 10, true) === 0);
ok('a tank lasts ~10 s', C.TANK / C.BURN_RATE > 8 && C.TANK / C.BURN_RATE < 15);
ok('pct', C.fuelPct(50) === 50 && C.fuelPct(-1) === 0 && C.fuelPct(1e9) === 100);
// cone: origin 0, aim +z
const H = (x, y, z) => C.coneHit(0, 1, 0, 0, 0, 1, x, y, z);
ok('ahead hits', H(0, 1, 5) > 4.9);
ok('point-blank hits', H(0.3, 1, 0.2) >= 0);
ok('beyond 8 m misses', H(0, 1, 8.6) < 0);
ok('behind misses', H(0, 1, -2) < 0);
ok('wide miss', H(4, 1, 4) < 0);
ok('edge of cone at 6 m hits', H(6 * Math.tan(C.HALF_ANGLE) + C.BASE_R - 0.05, 1, 6) >= 0);
ok('pad widens for vehicles', C.coneHit(0, 1, 0, 0, 0, 1, 4.2, 1, 6, C.RANGE, C.HALF_ANGLE, C.BASE_R, 1.4) >= 0 && H(4.2, 1, 6) < 0);
// aim: level on foot, full pitch airborne (jetpack)
const o = {}; C.aim(0, -0.6, 0.8, false, o); ok('on foot: level-ish', o.y >= -0.19 && Math.abs(Math.hypot(o.x, o.y, o.z) - 1) < 1e-9);
C.aim(0, -0.6, 0.8, true, o); ok('airborne: aims down', o.y < -0.5);
C.aim(0, -1, 0, true, o); ok('airborne straight down ok', o.y === -1);
const down = C.coneHit(0, 6, 0, 0, -1, 0, 0.5, 1, 0.3); ok('jetpack: torch the ground below', down >= 0);
// vehicles
let f = C.CAR_FUSE, boom = false, t = 0; while (!boom && t < 20) { const r = C.carTick(f, 0.1, false); f = r.fuse; boom = r.boom; t += 0.1; }
ok('a lit car blows in ~6 s', boom && Math.abs(t - C.CAR_FUSE) < 0.25, t);
const r2 = C.carTick(C.CAR_FUSE, 0.2, true); ok('spraying shortens the fuse', r2.fuse < C.CAR_FUSE - 0.2);
const rover = { kind: 'rover' }; ok('fireproof: rover / driven / raccoon / owned', C.fireproof(rover, rover, null) && C.fireproof({ kind: 'buggy' }, rover, { kind: 'buggy' }) === false && C.fireproof({ kind: 'raccoon-rover' }) && C.fireproof({ kind: 'buggy', owned: true }) && !C.fireproof({ kind: 'buggy' }, rover, null) && C.fireproof(null));
// farm plot is skipped
const places = [{ id: 'farm', x: 10, z: 26, r: 10 }, { id: 'post', x: -70, z: 10, r: 10 }];
ok('on the farm', C.onFarm(12, 30, places) && !C.onFarm(-70, 10, places) && !C.onFarm(100, 100, places) && !C.onFarm(0, 0, null));
ok('crop spots', C.CROP_SPOTS.length >= C.CROP_PATCHES && C.CROP_N <= 32);
ok('item text is clean', !/[A-Z][a-z]+®|™/.test(JSON.stringify(C.ITEMS)));
console.log(bad ? `flame unit: ${bad}/${n} FAILED` : `flame unit OK (${n} checks)`); process.exit(bad ? 1 : 0);
