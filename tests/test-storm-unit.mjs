// Mars dust storms (mars/stormcore.js): tiers, the build -> peak -> clear cycle, fog that only closes in, heat damping with
// carry, traffic scale, SSX.time look tint, captions; plus the wiring rules (one guarded hook line per core file vs
// origin/main, import map, one precache line, no version bump, README). node tests/test-storm-unit.mjs
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import * as K from '../mars/stormcore.js';
let pass = 0, fail = 0; const t = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
// tiers
t('pickTier override wins', K.pickTier({ override: 'low', app: 'high', mobile: true }) === 'low');
t('pickTier app > stored', K.pickTier({ app: 'ultra', stored: 'low' }) === 'ultra');
t('pickTier defaults', K.pickTier({ mobile: true }) === 'med' && K.pickTier({}) === 'high');
t('classic / auto fall back to the device default', K.pickTier({ app: 'classic', mobile: true }) === 'med' && K.pickTier({ app: 'auto' }) === 'high'); t('junk tier ignored', K.normTier('potato') === null);
t('particles scale by tier', K.particles('low', true) < K.particles('med', true) && K.particles('med', true) < K.particles('high', true));
t('phones get fewer grains', K.particles('med', true) < K.particles('med', false)); t('phone med <= 500', K.particles('med', true) <= 500);
// cycle
let i = 0; const rnd = () => 0.5; const C = K.createCycle({ rnd });
t('starts clear', C.phase === 'clear' && C.I === 0); t('first storm 6-10 min', C.len >= 360 && C.len <= 600);
let r; for (i = 0; i < 479; i++) r = C.step(1); t('clear until due', r.phase === 'clear');
r = C.step(2); t('periodic start', r.phase === 'building');
const seen = new Set(); let prev = 0, mono = true;
for (i = 0; i < 400 && C.phase === 'building'; i++) { r = C.step(0.25); seen.add(r.phase); if (r.phase === 'building' && r.I < prev - 1e-9) mono = false; prev = r.I; }
t('build rises monotonically', mono); t('reaches peak', C.phase === 'peak' && C.I > 0.83);
for (i = 0; i < 40; i++) { r = C.step(0.5); if (r.I < 0.83 || r.I > 1) mono = false; } t('peak gusts stay 0.84..1', mono);
for (i = 0; i < 400 && C.phase !== 'clear'; i++) r = C.step(0.5); t('clears to 0', C.phase === 'clear' && C.I === 0);
t('gap 9-16 min', C.len >= 540 && C.len <= 960);
const M = K.createCycle({ rnd, periodic: false }); for (i = 0; i < 2000; i++) M.step(1); t('non-periodic stays clear', M.phase === 'clear');
M.start({ build: 4, peak: 10, clear: 4, manual: true }); t('manual start', M.phase === 'building' && M.manual);
M.step(2); const mid = M.I; t('mid build', mid > 0.2 && mid < 0.8);
M.stop(); t('stop -> clearing', M.phase === 'clearing'); M.step(1); const c1 = M.I; t('clearing falls from current', c1 < mid && c1 > 0);
M.start({ build: 4, peak: 10, clear: 4 }); t('restart during clearing builds', M.phase === 'building');
r = M.step(0.05); t('restart never snaps the look', Math.abs(r.I - c1) < 0.05);
t('stop twice is a no-op', M.stop() === true && M.stop() === false);
M.start({ instant: true, intensity: 0.5 }); t('instant peak + intensity', M.phase === 'peak' && near(M.I, 0.5));
M.stop({ instant: true }); t('instant stop', M.phase === 'clear' && M.I === 0);
// fog: only ever closes in
const f0 = K.fogFor(45, 120, 0), f1 = K.fogFor(45, 120, 1, 'med'), fh = K.fogFor(45, 120, 1, 'high');
t('no storm = untouched fog', f0.near === 45 && f0.far === 120); t('peak med far 38', f1.far === 38 && f1.near === 3);
t('high tier sees a bit further', fh.far > f1.far); t('never pushes fog out', K.fogFor(5, 20, 1).far === 20 && K.fogFor(1, 20, 1).near === 1);
t('fog monotonic in I', K.fogFor(45, 120, 0.3).far > K.fogFor(45, 120, 0.6).far);
t('visibility', K.visibility(120, 1, 'med') === 38 && K.visibility(120, 0, 'med') === 120);
// gameplay
t('heat halves at peak', K.heatScale(1) === 0.5 && K.heatScale(0) === 1); t('traffic 55% at peak', K.trafficScale(1) === 0.55 && K.trafficScale(0) === 1);
let d = K.dampRise(0, 2, 0.5); t('2★ -> 1★ at peak', d.to === 1 && d.shed === 1 && near(d.carry, 0));
d = K.dampRise(0, 1, 0.5); t('1★ shed, carried', d.to === 0 && near(d.carry, 0.5)); d = K.dampRise(0, 1, 0.5, d.carry); t('carry pays the 2nd crime', d.to === 1);
t('drops pass through', K.dampRise(3, 1, 0.5).to === 1); t('k=1 passes and clears carry', K.dampRise(0, 2, 1, 0.7).to === 2 && K.dampRise(0, 2, 1, 0.7).carry === 0);
// look
t('mixHex', K.mixHex(0x000000, 0xffffff, 0.5) === 0x808080 && K.mixHex(0x123456, 0xabcdef, 0) === 0x123456);
const L = { top: 0x1f4f8f, horizon: 0xd8b38a, fog: 0xc79a6a, light: 1.2, hemi: 0.6, lightColor: 0xffffff, sunVisible: true, stars: 0.4 };
t('tint off when clear', K.tintLook(L, 0) === L); const T = K.tintLook(L, 1);
const red = h => ((h >> 16) & 255) > ((h & 255) + 40); t('tint reddens sky + fog', red(T.top) && red(T.horizon) && red(T.fog));
t('tint dims light, hides sun + stars', T.light < L.light && T.hemi < L.hemi && T.sunVisible === false && T.stars === 0 && T.storm === 1);
t('tint keeps other fields', K.tintLook({ ...L, foo: 7 }, 0.5).foo === 7);
// captions: short
t('captions', K.caption('building', 0.3, 1).includes('Dust storm') && K.caption('peak', 1, 0.5).includes('−50%') && K.caption('clear', 0, 1) === '');
t('captions short', ['building', 'peak', 'clearing'].every(p => [...K.caption(p, 1, 0.5)].length <= 28 && !/\n/.test(K.caption(p, 1, 0.5))));
// wiring
const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const idx = rd('index.html'), sw = rd('sw.js'), world = rd('world.js'), src = rd('mars/storm.js');
let base = null; try { base = execSync('git merge-base HEAD origin/main', { cwd: new URL('..', import.meta.url).pathname }).toString().trim(); } catch (e) {}
try { if (base && (execSync(`git rev-list --merges ${base}..HEAD`, { cwd: new URL('..', import.meta.url).pathname }).toString().trim() || execSync(`git rev-parse HEAD`, { cwd: new URL('..', import.meta.url).pathname }).toString().trim() === base)) { base = null; console.log('(PR-scope wiring checks skipped: integration branch or merged)'); } } catch (e) { /* */ }
const added = f => { if (!base) return null; try { return execSync(`git diff ${base} -- ${f}`, { cwd: new URL('..', import.meta.url).pathname }).toString().split('\n').filter(l => /^[+-][^+-]/.test(l)); } catch (e) { return null; } };
const dw = added('world.js'), di = added('index.html'), ds = added('sw.js');
t('world.js: one added hook line', !dw || (dw.length === 1 && dw[0].startsWith('+') && /SSX\?\.heatFilter/.test(dw[0])));
t('world.js hook guarded', /typeof globalThis\.SSX\?\.heatFilter === 'function'/.test(world) && /heatFilter[^\n]*try \{[^\n]*catch/.test(world) && /Number\.isFinite\(f\)/.test(world));
t('index.html: one import + import-map lines only', !di || di.filter(l => !/^[+-]\s*"(\.\/|ssx\/)/.test(l)).length === 1);
t('index.html: one storm import', (idx.match(/import '\.\/mars\/storm\.js'/g) || []).length === 1);
t('import map entries', /"\.\/mars\/storm\.js": "\.\/mars\/storm\.js\?v=/.test(idx) && /"\.\/mars\/stormcore\.js": "\.\/mars\/stormcore\.js\?v=/.test(idx));
t('sw.js: one precache line', !ds || (ds.length === 1 && /'storm', 'stormcore'/.test(ds[0])));
t('no version / cache bump', !ds || !ds.some(l => /CACHE|VERSION|const V\b/.test(l)));
t('core files otherwise untouched', !base || execSync(`git diff --name-only ${base}`, { cwd: new URL('..', import.meta.url).pathname }).toString().split('\n').filter(Boolean)
  .every(f => ['world.js', 'index.html', 'sw.js', 'README.md'].includes(f) || /^mars\/storm(core)?\.js$/.test(f) || /^tests\/(test-storm|run-storm)/.test(f)));
t('no onclick', !/\.onclick\s*=|addEventListener\('click'/.test(src)); t('caption never takes taps', /pointer-events:none/.test(src));
t('every SSX hook guarded', /typeof \S*addLookFilter !== 'function'/.test(src) && /registerSurfaceTick/.test(src));
t('restores what it changes', /restoreTraffic/.test(src) && /__stormV0/.test(src));
t('readme documents SSX.storm', /SSX\.storm/.test(rd('README.md')) && /SSX\.heatFilter/.test(rd('README.md')) && /\?storm=1/.test(rd('README.md')));
console.log(`storm unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
