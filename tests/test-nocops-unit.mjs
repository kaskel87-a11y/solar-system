// node tests/test-nocops-unit.mjs: no ordinary ColSec at Red Static Gulch (mars/nocopscore.js): the one shared bounds check
// sits on the gulch (farm2core SITE.at), pushOut lands just outside the edge, and only a raid that names 'gulch' gets through.
import * as K from '../mars/nocopscore.js';
import { SITE } from '../mars/farm2core.js';
let bad = 0, n = 0; const ok = (k, c, v) => { n++; if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v)); } };
const col = { x: 1000, z: -500 }, Z = K.zoneW(col);
ok('on the gulch', K.ZONE.at[0] === SITE.at[0] && K.ZONE.at[1] === SITE.at[1] && Z.x === 1150 && Z.z === -170 && Z.r === K.ZONE.r && K.ZONE.r >= 40);
ok('no colony', K.zoneW(null) === null && K.zoneW({ x: NaN, z: 0 }) === null && K.inside(null, 0, 0) === false);
ok('centre in', K.inside(Z, Z.x, Z.z) && K.inside(Z, Z.x + K.ZONE.r - 1, Z.z));
ok('edge out', !K.inside(Z, Z.x + K.ZONE.r + 0.5, Z.z) && !K.inside(Z, NaN, 0));
ok('Ares Junction out', !K.inside(Z, col.x, col.z));
const q = K.pushOut(Z, Z.x + 10, Z.z); ok('push out', q && Math.abs(Math.hypot(q.x - Z.x, q.z - Z.z) - (K.ZONE.r + K.PAD)) < 1e-6 && q.x > Z.x && !K.inside(Z, q.x, q.z), q);
const c = K.pushOut(Z, Z.x, Z.z); ok('push from centre', c && !K.inside(Z, c.x, c.z));
ok('outside stays', K.pushOut(Z, col.x, col.z) === null);
ok('scripted only by name', K.scriptedOk({ scripted: 'gulch' }) && !K.scriptedOk({ scripted: true }) && !K.scriptedOk({}) && !K.scriptedOk(null));
console.log(bad ? `nocops unit: ${bad} of ${n} FAILED` : `nocops unit OK (${n} checks)`); process.exit(bad ? 1 : 0);
