// node tests/test-base-register-unit.mjs : add-on registry in basecore.js (SSX.base.registerPlot / registerPiece rules)
import * as B from '../basecore.js';
let fails = 0; const ok = (name, c) => { if (!c) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); };
// a save written while the farm add-on was loaded: its lot + a dome piece on it, and a dome on a built-in lot
const saved = { v: 1, plots: { 'aj-north': { owned: true, pieces: [{ id: 1, type: 'wall', i: 0, j: 0, r: 0 }, { id: 7, type: 'farm-dome', i: 4, j: 4, r: 0 }], nextId: 8 },
  'farm-home': { owned: true, pieces: [{ id: 2, type: 'wall', i: 1, j: 1, r: 0 }, { id: 3, type: 'farm-racks', i: 5, j: 5, r: 0 }], nextId: 4 } } };
// 1. before the add-on registers, unknown lots / piece types survive a load + save round trip
let s = B.migrate(JSON.parse(JSON.stringify(saved)));
ok('unknown lot kept verbatim', s.plots['farm-home']?.pieces?.length === 2);
ok('unknown piece type parked in later', s.plots['aj-north'].pieces.length === 1 && s.plots['aj-north'].later?.[0]?.type === 'farm-dome');
ok('nextId clears parked ids', s.plots['aj-north'].nextId === 8);
s = B.migrate(JSON.parse(JSON.stringify(s)));
ok('survives a second round trip', s.plots['farm-home']?.pieces?.length === 2 && s.plots['aj-north'].later?.length === 1);
// 2. registerPlot validation
ok('plot: no def', !B.addPlot(null).ok && !B.addPlot({}).ok);
ok('plot: no coords', !B.addPlot({ id: 'x' }).ok && !B.addPlot({ id: 'x', at: ['a', 1] }).ok);
ok('plot: built-in refused', !B.addPlot({ id: 'aj-north', at: [0, 0] }).ok && B.PLOTS.find(p => p.id === 'aj-north').aj[0] === 65);
let r = B.addPlot({ id: 'farm-home', name: 'Dustbowl Homestead', at: [-60, 250], owned: () => true, district: 'Dustbowl' });
ok('plot: farm lot added (at alias, colony-relative)', r.ok && !r.replaced && B.plotById('farm-home').aj.join() === '-60,250' && B.plotById('farm-home').owner && B.PLOTS.length === 4);
r = B.addPlot({ id: 'farm-home', name: 'Dustbowl Homestead II', aj: [-61, 251], price: 50 });
ok('plot: duplicate id replaces, no throw', r.ok && r.replaced && B.PLOTS.length === 4 && B.plotById('farm-home').name.endsWith('II') && B.plotById('farm-home').aj[0] === -61 && !B.plotById('farm-home').owner);
ok('plot: {x,z} at accepted', B.addPlot({ id: 'obj-lot', at: { x: 3, z: 4 } }).ok && B.plotById('obj-lot').aj.join() === '3,4');
B.addPlot({ id: 'farm-home', name: 'Dustbowl Homestead', at: [-60, 250], owned: () => true });
// 3. registerPiece validation
ok('piece: bad id', !B.addPieceType({ id: 'a b' }).ok && !B.addPieceType({}).ok);
ok('piece: built-in refused', !B.addPieceType({ id: 'wall', cost: 1 }).ok && B.PIECES.wall.cost === 60);
r = B.addPieceType({ id: 'farm-dome', name: 'Greenhouse dome', icon: '🫧', cost: 900, fp: [4, 4], max: 1, plots: ['farm-home', 'aj-north'] });
ok('piece: dome added', r.ok && !r.replaced && B.PIECES['farm-dome'].fp.join() === '4,4' && B.PIECE_IDS.includes('farm-dome') && B.PIECES['farm-dome'].colliders.length === 1);
r = B.addPieceType({ id: 'farm-racks', name: 'Hydro racks', icon: '🌱', cost: 250, fp: [2, 1], max: 6, solid: false, plots: ['farm-home'] });
ok('piece: racks added (non-solid)', r.ok && B.PIECES['farm-racks'].colliders.length === 0);
r = B.addPieceType({ id: 'farm-dome', name: 'Greenhouse dome', icon: '🫧', cost: 950, fp: [4, 4], max: 1, plots: ['farm-home', 'aj-north'] });
ok('piece: duplicate replaces, no throw, no double id', r.ok && r.replaced && B.PIECES['farm-dome'].cost === 950 && B.PIECE_IDS.filter(t => t === 'farm-dome').length === 1);
ok('piece: fp clamped to the grid', B.addPieceType({ id: 'huge', fp: [99, -3] }).ok && B.PIECES.huge.fp.join() === '10,1');
// 4. per-lot piece lists + placement
ok('piecesFor: farm lot gets built-ins + both farm pieces', ['wall', 'gate', 'turret', 'farm-dome', 'farm-racks'].every(t => B.piecesFor('farm-home').includes(t)));
ok('piecesFor: racks not on a city lot', !B.piecesFor('aj-north').includes('farm-racks') && B.piecesFor('aj-north').includes('farm-dome'));
ok('piecesFor: no lot = unrestricted pieces only', B.piecesFor(null).includes('wall') && !B.piecesFor(null).includes('farm-racks'));
const st = B.emptyPlot(); st.owned = true;
ok('canPlace: racks refused off the farm', !B.canPlace(st, 'farm-racks', 0, 0, 0, { plotId: 'aj-north' }).ok && B.canPlace(st, 'farm-racks', 0, 0, 0, { plotId: 'farm-home' }).ok);
ok('canPlace: dome max 1', (B.addPiece(st, 'farm-dome', 0, 0, 0), B.canPlace(st, 'farm-dome', 5, 5, 0, { plotId: 'farm-home' }).why.startsWith('Max')));
// 5. after registering, the parked data comes back
s = B.migrate(JSON.parse(JSON.stringify(s)));
ok('farm lot revived as a real lot', s.plots['farm-home'].owned && s.plots['farm-home'].pieces.map(q => q.type).sort().join() === 'farm-racks,wall');
ok('parked dome revived on the city lot', s.plots['aj-north'].pieces.some(q => q.type === 'farm-dome' && q.id === 7) && !s.plots['aj-north'].later);
ok('fresh save includes add-on lots', !!B.freshSave().plots['farm-home']);
// add-on lot whose add-on says "not owned" keeps its pieces through a migrate
const s2 = JSON.parse(JSON.stringify(s)); s2.plots['farm-home'].owned = false;
ok('owner-managed lot keeps pieces while unowned', B.migrate(s2).plots['farm-home'].pieces.length === 2);
console.log(fails ? `FAIL ${fails}` : 'PASS register unit'); process.exit(fails ? 1 : 0);
