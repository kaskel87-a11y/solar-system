// node tests/test-savecode-unit.mjs: 💾 Save Code (savecode.js): export -> import round trip, garbage and unknown keys rejected,
// and a source scan so every localStorage key the game uses is covered (KNOWN / PREFIXES / DEVICE).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
await import('../savecode.js'); const C = globalThis.SSXSaveCore;
let bad = 0; const ok = (k, c, v) => { if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v).slice(0, 400)); } };
const mkStore = init => { const m = new Map(Object.entries(init || {})); return { get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), dump: () => Object.fromEntries(m) }; };
const farm = JSON.stringify({ v: 1, owned: true, dome: true, racks: [{ crop: 'potato', growth: 0.5 }, { crop: null }], silo: { potato: 6 } });
const prog = JSON.stringify({ v: 1, xp: 3800, credits: 12345, badges: ['Shutterbug'] });
const A = mkStore({ 'ssx.progress.v1': prog, 'ssx.farm.v1': farm, 'ssx.stars.v1': '{"v":1,"spent":250,"log":[]}', 'ssx.race.ghost.q-vale-03': '[[1,2,3]]', 'ssx.contacts': '{"Danny":"555"}',
  'ssx.future.v2': '{"x":1}', 'ssx-gfx-tier': 'low', 'ssx.view.v1': '30', 'other-site-key': 'nope', 'ssx.savecode.bak': '{}' });
const keys = C.collect(A);
ok('collect', Object.keys(keys).sort().join() === ['ssx.contacts', 'ssx.farm.v1', 'ssx.future.v2', 'ssx.progress.v1', 'ssx.race.ghost.q-vale-03', 'ssx.stars.v1'].join(), Object.keys(keys));
for (const plain of [false, true]) {
  const code = await C.encode(keys, { t: 1793330000000, app: 'v7.5.8', plain });
  ok('prefix' + plain, code.startsWith(plain ? 'SSX1-j.' : 'SSX1-g.') && /^[A-Za-z0-9_.\-]+$/.test(code), code.slice(0, 20));
  const v = await C.decode(code); ok('decode' + plain, v.ok && v.count === 6 && v.t === 1793330000000 && v.keys['ssx.farm.v1'] === farm, v);
  // fresh device B with its own little save + device prefs
  const B = mkStore({ 'ssx.progress.v1': '{"v":1,"xp":0,"credits":0}', 'ssx.turf.v1': '{"v":1}', 'ssx-gfx-tier': 'high', 'ssx.bright.v1': 'max' });
  C.applyTo(B, v.keys); const d = B.dump();
  ok('roundTrip' + plain, d['ssx.progress.v1'] === prog && d['ssx.farm.v1'] === farm && JSON.parse(d['ssx.farm.v1']).racks.length === 2 && d['ssx.race.ghost.q-vale-03'] === '[[1,2,3]]', d);
  ok('replaced' + plain, !('ssx.turf.v1' in d) && d['ssx-gfx-tier'] === 'high' && d['ssx.bright.v1'] === 'max', d);
  // with whitespace / line breaks pasted in
  ok('whitespace' + plain, (await C.decode('  ' + code.replace(/(.{40})/g, '$1\n') + '\n')).ok);
}
const gz = await C.encode(keys); ok('gzipSmaller', gz.length < (await C.encode(keys, { plain: true })).length);
// garbage
for (const [k, g] of Object.entries({ empty: '', words: 'hello there', noPrefix: 'abcDEF123', badPrefix: 'SSX2-g.AAAA', badB64: 'SSX1-g.!!!!', truncated: gz.slice(0, gz.length - 30), notJson: 'SSX1-j.' + C.b64u(new TextEncoder().encode('not json')), num: 42, nul: null }))
  { const r = await C.decode(g); ok('garbage:' + k, !r.ok && typeof r.msg === 'string' && /Nothing was changed/.test(r.msg), r); }
const wrap = o => 'SSX1-j.' + C.b64u(new TextEncoder().encode(JSON.stringify(o)));
ok('wrongShape', !(await C.decode(wrap({ f: 'ssx-save', v: 1, keys: [] }))).ok && !(await C.decode(wrap({ f: 'other', v: 1, keys: {} }))).ok && !(await C.decode(wrap({ v: 1, keys: { 'ssx.progress.v1': '{}' } }))).ok);
ok('newerVersion', /newer version/.test((await C.decode(wrap({ f: 'ssx-save', v: 2, keys: { 'ssx.progress.v1': '{}' } }))).msg));
// unknown keys are dropped, never written
const u = await C.decode(wrap({ f: 'ssx-save', v: 1, t: 1, keys: { 'ssx.progress.v1': prog, evil: 'x', 'ssx.savecode.pending': '{}', 'ssx-gfx-tier': 'low', '__proto__x': 'y', 'ssx.farm.v1': 7, 'ssx.random': 'z' } }));
ok('unknownDropped', u.ok && Object.keys(u.keys).join() === 'ssx.progress.v1' && u.skipped === 6, u);
const B2 = mkStore({}); C.applyTo(B2, { ...u.keys, evil: 'x' }); ok('applyFilters', Object.keys(B2.dump()).join() === 'ssx.progress.v1', B2.dump());
ok('onlyUnknown', !(await C.decode(wrap({ f: 'ssx-save', v: 1, keys: { evil: 'x' } }))).ok);
// source scan: every storage key literal in the game is known, a prefix, or device-only
const skip = new Set(['tests', 'tools', 'vendor', 'shots', '.git', 'node_modules']); const lits = new Set();
const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!skip.has(f.name)) walk(p); } else if (/\.(js|html)$/.test(f.name) && f.name !== 'savecode.js' && f.name !== 'sw.js') for (const m of fs.readFileSync(p, 'utf8').matchAll(/['"`](ssx\.[A-Za-z0-9_.\-]+|ssx-(?:quality|gfx-tier))['"`]/g)) lits.add(m[1]); } };
walk(root);
const miss = [...lits].filter(k => !C.KNOWN.includes(k) && !C.DEVICE.includes(k) && !C.PREFIXES.includes(k) && !C.OWN.includes(k));
ok('allKeysCovered', !miss.length && lits.size > 30, { miss, n: lits.size });
console.log(bad ? `FAIL ${bad}` : `savecode unit OK (${lits.size} storage keys in source, all covered)`); process.exit(bad ? 1 : 0);
