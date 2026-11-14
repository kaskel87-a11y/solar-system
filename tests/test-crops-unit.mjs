// node tests/test-crops-unit.mjs: crop stages are visual only. Growth, yield and the save shape stay in farmcore.
import * as C from '../mars/cropscapecore.js';
import * as F from '../mars/farmcore.js';
let bad = 0;
const ok = (n, c) => { if (!c) { bad++; console.log('FAIL ' + n); } };
ok('stages', C.stageName(0) === 'seedling' && C.stageName(0.24) === 'seedling' && C.stageName(0.25) === 'leafy' && C.stageName(0.54) === 'leafy' && C.stageName(0.55) === 'mature' && C.stageName(0.99) === 'mature' && C.stageName(1) === 'ready');
ok('kinds', ['potato', 'algae', 'glowberry', 'lichen', 'redstatic', 'glowcactus', 'voidpoppy', 'ghostspore'].every(id => C.KINDS[id]));
ok('cut', C.plantCount(1, 'bush') === 8 && C.plantCount(0.5, 'bush') === 4 && C.plantCount(0, 'bush') === 0 && C.bedSpan(0.5).depth === 1.55);
const s = F.fresh(); s.owned = true; s.dome = true; s.water = 100; s.power = 100; s.racks = [F.freshRack()];
F.plant(s, 0, 'potato');
const before = JSON.stringify(s.racks[0]);
F.advance(s, 1, 0);
ok('timer', s.racks[0].crop === 'potato' && Math.abs(s.racks[0].growth - 0.1) < 1e-6 && F.yieldOf({ crop: 'potato', health: 100 }) === 6);
ok('save shape', Object.keys(JSON.parse(before)).join() === 'crop,growth,health,planted');
if (bad) { console.log('FAILED ' + bad); process.exit(1); }
console.log('crops unit ok');
