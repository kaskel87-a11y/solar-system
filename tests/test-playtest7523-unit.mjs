// v7.5.23 playtest fixes, source-level guards (the behaviour is covered by tests/test-multitouch.js in Chromium)
import { readFileSync } from 'fs';
const R = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
let fails = 0; const ok = (k, c) => { if (!c) { fails++; console.log('FAIL', k); } };
const sn = R('mars/sniper.js'), ix = R('index.html'), hx = R('hud/hudx.js'), wd = R('world.js'), cq = R('mars/consequences.js'), sm = R('storymars.js');
ok('M1 contracts: no click-only delegation', !/panel\.addEventListener\('click'/.test(sn));
ok('M1 contracts: Take buttons go through tap()', /querySelectorAll\('button\[data-c\]'\)\) tap\(b,/.test(sn));
ok('M2 Close is tap-safe', /id="rmClose" class="btn" data-tapsafe/.test(ix));
ok('M2 Close pinned in the menu', /#roverMenu #rmClose \{ position: sticky; bottom: 0;/.test(ix));
ok('M2 guard skips scroll-quiet for tap-safe targets', /closest\?\.\('\[data-tapsafe\]'\)/.test(hx) && /quiet: !safe && recent\(sc\)/.test(hx) && /\(!d\.safe && \(recent\(d\.sc\)/.test(hx));
ok('M2 guard still cancels a moved finger', /const bad = d\.quiet \|\| d\.moved \|\|/.test(hx));
ok('m2 no hands-on bust when perched > 4 m', /player\.y - 1\.7 - height\(tx, tz\) > 4\) close = false/.test(wd));
ok('m2 pursuit boxed-in bust skips a perched player', /perch = !P\.driving && fin\(P\.y\) && fin\(P\.gy\) && P\.y - 1\.7 - P\.gy > 4/.test(R('mars/pursuit.js')) && /if \(!safe && !perch && stopped/.test(R('mars/pursuit.js')));
ok('m3 booking choices in a two-column grid on short screens', /@media \(max-height:500px\)\{[^}]*#cqPanel \.wrap/.test(cq) && /'<div class="cqB">'/.test(cq) && /btn\('close', 'Decide later', ''\) \+ '<\/div>'/.test(cq));
ok('m3 booking card uses dvh', /100dvh/.test(cq));
ok('p2 barter waits for barter.json', /C\.barterSource !== 'barter\.json'/.test(sm));
console.log(fails ? `${fails} FAILED` : 'playtest 7.5.23 unit OK'); process.exit(fails ? 1 : 0);
