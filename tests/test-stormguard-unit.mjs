// Storm perf guard (stormguardcore.js) + the phone storm budgets it works with. node tests/test-stormguard-unit.mjs
import { readFileSync } from 'fs';
import * as G from '../stormguardcore.js';
import * as D from '../modes/directorcore.js';
import * as K from '../mars/stormcore.js';
let pass = 0, fail = 0; const t = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const run = (g, ms, secs, active = true) => { for (let s = 0; s < secs * 1000; s += ms) g.step(ms, active); return g.k; };
// governor
let g = G.createGovernor();
t('starts at full density', g.k === 1);
run(g, 16.7, 5); t('60 fps keeps full density', g.k === 1 && g.drops === 0);
run(g, 33, 1.5); t('30 fps drops density', g.k < 1 && g.drops >= 1);
run(g, 33, 20); t('never below the floor', g.k >= G.MIN_K - 1e-9 && Math.abs(g.k - G.MIN_K) < 1e-6);
t('floor asks for the resolution step', g.dprStep === true);
const k0 = g.k; run(g, 22, 10); t('45 fps (between thresholds) holds', g.k === k0);
run(g, 12, 10); t('fast frames give density back', g.k > k0 && g.raises >= 1);
g = G.createGovernor(); run(g, 33, 3); t('drops are rate-limited (cooldown)', g.drops <= 3);
g = G.createGovernor(); g.step(900); t('a single 900 ms stall alone does not drop', g.k === 1); t('stall counted as hitch', g.hitches === 1 && g.worst === 900);
g = G.createGovernor(); run(g, 33, 20); run(g, 16.7, 4, false); t('storm off: resolution step released, density recovers', g.dprStep === false && g.k > G.MIN_K);
g.reset(); t('reset', g.k === 1 && g.worst === 0 && g.hitches === 0);
t('fps readout', Math.abs(G.createGovernor().fps() - 59.9) < 0.2);
g = G.createGovernor(); g.step(NaN); g.step(-5); g.step(Infinity); t('junk frame times ignored', g.frames === 0 && g.k === 1);
// helpers
t('maxPx phone 10 / desktop 22', G.maxPx(true) === 10 && G.maxPx(false) === 22);
t('drawCount', G.drawCount(100, 0.3) === 30 && G.drawCount(100, 1) === 100 && G.drawCount(5, 0.01) === 1 && G.drawCount(0, 1) === 0 && G.drawCount(100, 0) === 0 && G.drawCount(100, 3) === 100);
t('dustDraw', D.dustDraw(180, 0.3) === 54 && D.dustDraw(180) === 180 && D.dustDraw(0, 1) === 0 && D.dustDraw(10, 0) === 1);
t('dustMaxPx', D.dustMaxPx(true) === 10 && D.dustMaxPx(false) === 22);
// phone budgets
const h = D.stormParams('heavy', true), l = D.stormParams('light', true);
t('director phone heavy <= 200 grains, <= 0.3 m', h.count <= 200 && h.size <= 0.3);
t('director phone light <= 100 grains', l.count <= 100);
t('director desktop unchanged', D.stormParams('heavy', false).count === 1400 && D.stormParams('light', false).count === 600);
t('ben phone med <= 250', K.particles('med', true) <= 250); t('ben phone ultra <= 450', K.particles('ultra', true) <= 450);
t('ben desktop unchanged', K.particles('med', false) === 800 && K.particles('ultra', false) === 2000);
// wiring
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
t('import map has stormguard', /"\.\/stormguard\.js"/.test(html) && /"\.\/stormguardcore\.js"/.test(html));
t('one script tag', (html.match(/src="\.\/stormguard\.js\?v=/g) || []).length === 1);
t('precached', /stormguard\.js\$\{q\}/.test(sw) && /stormguardcore\.js\$\{q\}/.test(sw));
const src = readFileSync(new URL('../stormguard.js', import.meta.url), 'utf8');
t('plain imports only', !/from\s+['"][^'"]*\?v=/.test(src));
console.log(`stormguard unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
