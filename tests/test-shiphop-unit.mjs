// node tests/test-shiphop-unit.mjs
import * as H from '../mars/shiphopcore.js';
let bad = 0;
const ok = (n, c) => { if (!c) { bad++; console.log('FAIL ' + n); } };
const open = { onMars: true, wanted: 0, nearShip: true };
ok('clear', H.skyBlock(open) === null && H.hopBlock(open) === null);
ok('two stars', H.skyBlock({ ...open, wanted: 2 }) === null);
ok('three stars', /3 stars/.test(H.skyBlock({ ...open, wanted: 3 }) || ''));
ok('job', /job/.test(H.skyBlock({ ...open, job: true }) || ''));
ok('away', /Ashfall/.test(H.hopBlock({ ...open, nearShip: false }) || ''));
const list = H.listOf([
  { id: 'farm', x: 10, z: 20 }, { id: 'pit', x: 1, z: 2 }, { id: 'downtown', x: 0, z: 0 }, { id: 'nope', x: 1, z: 1 }, { id: 'dealer', x: 5, z: 5 }
], { x: 10, z: 20 });
ok('order', list.map(p => p.id).join() === 'downtown,pit,farm,dealer' && list.find(p => p.id === 'farm').here && list[0].name === 'Ares Junction downtown');
ok('stand', Number.isFinite(H.standAt(3, 4).yaw));
if (bad) { console.log('FAILED ' + bad); process.exit(1); }
console.log('shiphop unit ok');
