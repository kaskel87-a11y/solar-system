// pure parts of mars/ownedbeams.js: which places glow green, and the waypoint colour lookup. node tests/test-ownedbeams-unit.mjs
import { greenSites, siteAt, NEAR } from '../mars/ownedbeamscore.js';
let bad = 0; const t = (n, c) => { if (!c) { bad++; console.log('FAIL', n); } };
const props = [{ id: 'a', owned: true, pos: { x: 10, z: 20 } }, { id: 'b', owned: false, pos: { x: 50, z: 50 } }, { id: 'c', owned: true, pos: null }];
const places = [{ id: 'farm', x: 100, z: 0 }, { id: 'post', x: -70, z: 210 }];
const s = greenSites(props, false, places).map(x => x.id); t('owned + post, not unowned / unplaced / unbought farm', s.join() === 'empire:a,post');
t('bought farm', greenSites(props, true, places).some(x => x.id === 'farm'));
t('nothing', greenSites(null, false, null).length === 0);
const S = greenSites(props, true, places); t('siteAt near', siteAt(S, 12, 22)?.id === 'empire:a'); t('siteAt far', siteAt(S, 10 + NEAR + 1, 20) === null); t('siteAt NaN', siteAt(S, NaN, 0) === null);
console.log(bad ? 'FAIL' : 'PASS ownedbeams-unit'); process.exit(bad ? 1 : 0);
