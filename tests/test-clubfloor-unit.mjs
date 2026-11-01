// v7.5.35 unit test: Velvet cocktail waitresses (clubfloor.js patrol maths, routes clear of the tables) + wiring.
import { readFileSync } from 'fs';
let fails = 0; const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const s = src('clubfloor.js');
// pull the pure bits out without loading three in node
const body = s.slice(s.indexOf('export const faceYaw'), s.indexOf('const LOOKS'));
const M = new Function(body.replace(/export /g, '') + '; return { faceYaw, ROUTES, SPEED, SPECTATORS, patrol };')();
const { faceYaw, ROUTES, SPEED, patrol, SPECTATORS } = M;
ok('3 waitresses, 6 spectators', ROUTES.length === 3 && SPECTATORS.length === 6);
ok('faceYaw: -z at 0, +x at -PI/2', Math.abs(faceYaw(0, 0, 0, -1)) < 1e-9 && Math.abs(faceYaw(0, 0, 1, 0) + Math.PI / 2) < 1e-9);
const r = ROUTES[2].pts;
let p = patrol(r, 0); ok('starts at first point', p.x === r[0][0] && p.z === r[0][1] && p.moving);
const len0 = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]);
p = patrol(r, len0 / SPEED + 1); ok('pauses at a table point', !p.moving && p.x === r[1][0] && p.z === r[1][1]);
p = patrol(r, len0 / SPEED / 2); ok('halfway along the first leg', Math.abs(p.x - (r[0][0] + r[1][0]) / 2) < 1e-9 && p.moving);
const total = r.reduce((a, q, i) => { const n = r[(i + 1) % r.length]; return a + (q[2] || 0) + Math.hypot(n[0] - q[0], n[1] - q[1]) / SPEED; }, 0);
ok('loops', Math.abs(patrol(r, total + 0.3).x - patrol(r, 0.3).x) < 1e-9);
ok('every route pauses at least twice', ROUTES.every(R => R.pts.filter(q => q[2] > 0).length >= 2));
// routes stay inside the club and off every table / sofa / wall (sampled every 0.25 m)
const box = [[-24, 16, 1.95, 1.25], [2, 16, 1.95, 1.0], [-22, 0, 3.3, 2.6], [-32, 21, 0.75, 1.85], [9.5, 21, 0.75, 1.85], [9.5, 13, 0.75, 1.85], [-11.15, -1.5, 0.4, 6.7], [-7, 8.15, 4.2, 0.4], [7, 8.15, 4.2, 0.4], [-24, 14.55, 0.5, 0.5], [1.4, 14.8, 0.5, 0.5]];
let hit = null;
for (const R of ROUTES) R.pts.forEach((q, i) => { const n = R.pts[(i + 1) % R.pts.length], L = Math.hypot(n[0] - q[0], n[1] - q[1]); for (let d = 0; d <= L; d += 0.25) { const x = q[0] + (n[0] - q[0]) * d / L, z = q[1] + (n[1] - q[1]) * d / L; if (x < -32.5 || x > 10.5 || z < -7.5 || z > 23.5) hit = hit || `${R.name} outside at ${x.toFixed(1)},${z.toFixed(1)}`; for (const [bx, bz, hx, hz] of box) if (Math.abs(x - bx) < hx && Math.abs(z - bz) < hz) hit = hit || `${R.name} hits ${bx},${bz} at ${x.toFixed(1)},${z.toFixed(1)}`; } });
ok('routes clear of tables, sofas and walls' + (hit ? ' (' + hit + ')' : ''), !hit);
// wiring
const html = src('index.html'), inter = src('interiors.js'), sw = src('sw.js');
ok('built in the club with buildHuman (stock people)', /addClubFloor\(api, \{ sit: sitPose, idle, human: buildHuman \}\)/.test(inter));
ok('spectators baked, no lights', /mergeGeometries/.test(s) && !/Light\(/.test(s));
ok('spot follows the waitress', /w\.sp\.x = s\.x; w\.sp\.z = s\.z/.test(s));
ok('drinks via the bar (same prices + effects)', /bar\.buy\(id, true\)/.test(s) && /import \{ DRINKS \} from '\.\/bar\.js'/.test(s));
ok('black/white buttons + panelTap', /#waitressPanel button \{[^}]*background: #000; color: #fff;/.test(s) && /panelTap\(el,/.test(s));
ok('index routes waitress act', /s\.act === 'waitress'\) \{ try \{ openWaitress\(s\.who\)/.test(html));
ok('sw + importmap', /`clubfloor\.js\$\{q\}`/.test(sw) && /"\.\/clubfloor\.js": "\.\/clubfloor\.js\?v=/.test(html));
ok('fully clothed (no skin-coloured tops/bottoms)', !/top: 0x(c68a64|f0c8a0|7a4a2a)/.test(s.slice(s.indexOf('const LOOKS'), s.indexOf('const CROWD'))));
console.log(fails ? `${fails} FAIL` : 'all ok'); process.exit(fails ? 1 : 0);
