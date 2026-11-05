// pure parts of the Red Static Gulch sky beam: owned-only, #ff3b30, and it replaces a green column on the same spot.
// node tests/test-gulchbeam-unit.mjs
import { siteOf, withoutGulch, colorAt, RED, NEAR } from '../mars/gulchbeamcore.js';
import { greenSites } from '../mars/ownedbeamscore.js';
import { PROPS } from '../empirecore.js';
import * as F from '../mars/farmcore.js';
import * as K from '../mars/farm2core.js';

let bad = 0; const t = (n, c, v) => { if (!c) { bad++; console.log('FAIL', n, v === undefined ? '' : JSON.stringify(v).slice(0, 200)); } };
const g = { x: K.SITE.at[0], z: K.SITE.at[1], name: K.SITE.name };

t('red is the minimap ring', RED === 0xff3b30);
t('unowned', siteOf({ owned: false }, g) === null);
t('owned needs a site', siteOf({ owned: true }, null) === null);
t('owned', siteOf({ owned: true }, g)?.id === 'farm2' && siteOf({ owned: true }, g).x === g.x);
t('bad site', siteOf({ owned: true }, { x: NaN, z: 1 }) === null);
t('color near', colorAt(g, g.x + 3, g.z - 2) === RED);
t('color far', colorAt(g, g.x + NEAR + 1, g.z) === null);
t('color NaN', colorAt(g, NaN, 0) === null);
t('color none', colorAt(null, 0, 0) === null);

const stacked = [{ id: 'farm', x: g.x, z: g.z }, { id: 'post', x: g.x + 200, z: g.z }];
const kept = withoutGulch(stacked, g);
t('drops the column on the gulch', kept.length === 1 && kept[0].id === 'post');
t('no gulch keeps both', withoutGulch(stacked, null).length === 2);
t('empty', withoutGulch(null, g).length === 0);

// the live list: every empire prop owned, homestead owned, the post, the club. None of them sit on the gulch.
const props = PROPS.map(p => ({ id: p.id, owned: true, name: p.name, pos: { x: p.aj[0], z: p.aj[1] } }));
const places = Object.values(F.SITES).map(p => ({ id: p.id, name: p.name, x: p.at[0], z: p.at[1] }));
const greens = greenSites(props, true, places, [{ id: 'velvet', name: 'The Velvet Airlock', owned: true, x: -30, z: -38 }]);
let nearest = null, nd = Infinity;
for (const s of greens) { const d = Math.hypot(s.x - g.x, s.z - g.z); if (d < nd) { nd = d; nearest = s.id; } }
t('no green beam on the gulch today', nd > NEAR, { nearest, nd: Math.round(nd) });
t('guard still drops a fake overlap', withoutGulch(greens.concat([{ id: 'farm2', x: g.x, z: g.z }]), g).every(s => s.id !== 'farm2'));

console.log(bad ? 'FAIL' : 'PASS gulchbeam-unit'); process.exit(bad ? 1 : 0);
