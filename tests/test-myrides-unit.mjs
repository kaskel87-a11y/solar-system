// Live fix unit tests: My rides (owned rides stay parked) + save migration that never drops a ride.
// node tests/test-myrides-unit.mjs
import * as GC from '../garagecore.js';
import * as RP from '../ridepark.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };

// ---------- park records ----------
ok('cleanPark rejects junk', [null, 5, 'x', {}, { planet: 'Mars' }, { planet: '', x: 1, z: 1 }, { planet: 'Mars', x: NaN, z: 0 }].every(p => RP.cleanPark(p) === null));
const pk = RP.cleanPark({ planet: 'Mars', x: 10, z: -4, y: 3.5, yaw: 1, at: 7, junk: 1 });
ok('cleanPark keeps fields, drops junk', pk.planet === 'Mars' && pk.x === 10 && pk.z === -4 && pk.y === 3.5 && pk.yaw === 1 && !('junk' in pk));
ok('cleanPark fills yaw / y', (() => { const q = RP.cleanPark({ planet: 'Moon', x: 1, z: 2 }); return q.yaw === 0 && q.y === null; })());
ok('parkOf vehicle', (() => { const q = RP.parkOf({ x: 5, y: 2, z: 6, yaw: 0.5 }, 'Mars', 99); return q.planet === 'Mars' && q.x === 5 && q.y === 2 && q.z === 6 && q.yaw === 0.5 && q.at === 99; })());
// ---------- bays ----------
const g = { x: 100, z: 50 };
const bays = RP.BAYS.map((_, i) => RP.bayPos(i, g));
ok('bays distinct and >= 6 m apart', bays.every((a, i) => bays.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) >= 6)));
ok('no bay on the work bay (0,9)', bays.every(b => Math.hypot(b.x - g.x, b.z - (g.z + 9)) > 5));
ok('bay rotation follows garage yaw', (() => { const b = RP.bayPos(1, g, Math.PI / 2); return Math.abs(b.x - (g.x + 3)) < 1e-9 && Math.abs(b.z - (g.z - 9)) < 1e-9; })());
const rides = [{ id: 'a', park: { planet: 'Mars', ...RP.bayPos(0, g) } }, { id: 'b' }];
ok('freeBay skips taken bays', RP.freeBay(rides, g).bay === 1);
ok('freeBay ignores the ride itself', RP.freeBay(rides, g, 0, 'a').bay === 0);
// ---------- which rides need parking ----------
ok('unparked: everything but active, without a valid park', JSON.stringify(RP.unparked({ active: 'r1', rides: [{ id: 'stock' }, { id: 'r1' }, { id: 'r2', park: { planet: 'Mars', x: 1, z: 1 } }, { id: 'r3', park: { x: 1 } }] })) === '["stock","r3"]');
// ---------- delivery fee ----------
ok('fee: same planet', RP.deliverFee({}) === RP.DELIVER_FEE && RP.DELIVER_FEE > 0);
ok('fee: free at the garage', RP.deliverFee({ nearGarage: true }) === 0);
ok('fee: free at the ship', RP.deliverFee({ nearShip: true }) === 0);
ok('fee: other planet costs more', RP.deliverFee({ samePlanet: false, nearShip: true }) === RP.DELIVER_FEE_HOP && RP.DELIVER_FEE_HOP > RP.DELIVER_FEE);
// ---------- status ----------
ok('status driving / active', RP.rideStatus({}, { active: true, driving: true }).k === 'driving' && RP.rideStatus({}, { active: true }).k === 'active');
ok('status lock-up', RP.rideStatus({ id: 'x' }, {}).k === 'lockup');
ok('status parked with distance', (() => { const s = RP.rideStatus({ park: { planet: 'Mars', x: 30, z: 40 } }, { planet: 'Mars', me: { x: 0, z: 0 } }); return s.k === 'parked' && s.d === 50 && /50 m/.test(s.text); })());
ok('status other planet', RP.rideStatus({ park: { planet: 'Mars', x: 3, z: 4 } }, { planet: 'Moon' }).text.includes('Mars'));

// ---------- migration: buying / old saves never lose a ride ----------
// Collin's case: an old save where he bought a second ride. Both rides are there, nothing parked yet.
const old = { v: 1, rides: [{ id: 'stock', kind: 'rover', up: { engine: 1 } }, { id: 'r1', kind: 'ares_brute', paint: 'candy' }], active: 'r1', rep: 12, nextId: 2 };
const m1 = GC.migrateGarage(JSON.parse(JSON.stringify(old)));
ok('old save: both rides kept', m1.rides.length === 2 && m1.rides.map(r => r.id).join() === 'stock,r1' && m1.active === 'r1');
ok('old save: stock rover keeps its upgrades', m1.rides[0].up.engine === 1);
ok('old save: stock needs a park (goes to a lock-up bay at runtime)', JSON.stringify(RP.unparked(m1)) === '["stock"]');
// lost-ish data: a ride saved with model instead of kind, one with no id, a duplicate id and pure junk
const messy = { rides: [{ id: 'stock', kind: 'rover' }, { id: 'r1', model: 'red_comet', paint: 'gold' }, { kind: 'dust_runner' }, { id: 'r1', kind: 'olympus_gt' }, 'garbage', { hello: 1 }], active: 'r1', nextId: 2 };
const m2 = GC.migrateGarage(JSON.parse(JSON.stringify(messy)));
ok('recover ride saved with `model`', m2.rides.some(r => r.id === 'r1' && r.kind === 'red_comet' && r.paint === 'gold'));
ok('ride with no id gets a fresh one', m2.rides.some(r => r.kind === 'dust_runner' && /^r\d+$/.test(r.id)));
ok('duplicate id kept under a fresh id', m2.rides.some(r => r.kind === 'olympus_gt' && r.id !== 'r1'));
ok('all ids unique', new Set(m2.rides.map(r => r.id)).size === m2.rides.length);
ok('unusable entries kept in lost, not deleted', Array.isArray(m2.lost) && m2.lost.length === 2 && m2.lost.includes('garbage'));
ok('nextId past every id', m2.rides.every(r => (+r.id.replace(/\D/g, '') || 0) < m2.nextId));
ok('migration idempotent', JSON.stringify(GC.migrateGarage(JSON.parse(JSON.stringify(m2)))) === JSON.stringify(m2));
// park records survive a save round-trip; bad ones are dropped (the ride is kept)
const m3 = GC.migrateGarage({ rides: [{ id: 'stock', kind: 'rover', park: { planet: 'Mars', x: 80, z: 40, y: 2, yaw: 3 } }, { id: 'r1', kind: 'red_comet', park: { planet: 'Mars' } }], active: 'r1' });
ok('valid park kept', m3.rides[0].park?.x === 80 && m3.rides[0].park.planet === 'Mars');
ok('invalid park removed, ride kept', m3.rides.length === 2 && !('park' in m3.rides[1]));
ok('no lost key when nothing lost', !('lost' in m3));
ok('fresh garage unchanged', JSON.stringify(GC.migrateGarage(undefined)) === JSON.stringify(GC.freshGarage()));
console.log(`\nmyrides: ${n - fails}/${n} passed`); if (fails) process.exit(1);
