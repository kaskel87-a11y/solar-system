// v7.5.3 bark keys (pure, no browser): node tests/test-bark-keys-unit.mjs
// SSX.bark(npc, key) must never show a snake_case key ('activity_complete', 'idle', 'warn', ...) as the caption.
// Also scans the source for every key callers pass to SSX.bark (directly or via tryBark / sayNpc / scihooks bark /
// contraband 'barter_' + key) and checks each one resolves to real lines.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import * as B from '../barks.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const warns = []; const W = (...a) => warns.push(a.join(' '));
const R = (what, opts) => B.resolveBark(what, opts, B.BARKS, W);
const lineOf = r => r && (r.line || B.pickLine(r.cat, [], () => 0));

// ---------- new categories ----------
for (const c of ['activity_complete', 'idle', 'warn']) ok(`${c} has >= 4 lines`, B.BARKS[c]?.length >= 4);
ok('new lines <= 65 chars', ['activity_complete', 'activity_fail', 'idle', 'warn', 'offer', 'poker', 'crowd'].every(c => B.BARKS[c].every(l => l.length <= 65)));
ok('every category has a rate rule', Object.keys(B.BARKS).every(k => B.CATS[B.catKey(k)]));
ok('no sexual content in new lines', !/\b(sex|fuck|tits|dick|pussy|cock|horny|naked|strip)/i.test(['activity_complete', 'activity_fail', 'idle', 'warn', 'offer', 'poker', 'crowd'].flatMap(c => B.BARKS[c]).join(' ')));
ok('aliases point at real categories', Object.values(B.BARK_ALIASES).every(c => B.BARKS[c]?.length));

// ---------- resolution ----------
ok('registered category', R('flats').cat === 'flats' && R('flats').line === null);
ok('activity_complete -> its own lines', R('activity_complete').cat === 'activity_complete' && B.BARKS.activity_complete.includes(lineOf(R('activity_complete'))));
ok('idle -> its own lines', R('idle').cat === 'idle');
ok('warn -> its own lines', R('warn').cat === 'warn');
ok('caller line wins (string 3rd arg)', R('warn', "It doesn't take cars!").line === "It doesn't take cars!" && R('warn', 'x').cat === 'warn');
ok('caller line wins ({ line })', R('barter_accept', { line: 'Pleasure.' }).line === 'Pleasure.' && R('barter_accept', { line: 'Pleasure.' }).cat === 'activity_complete');
ok('alias table', R('poker_offer').cat === 'offer' && R('poker_cashout_lose').cat === 'activity_fail' && R('pit_cheer').cat === 'crowd' && R('barter_caught').cat === 'wanted');
ok('suffix rules', R('race_win').cat === 'activity_complete' && R('job_failed').cat === 'activity_fail' && R('heist_start').cat === 'offer' && R('turf_warning').cat === 'warn' && R('guard_idle').cat === 'idle');
warns.length = 0; B._resetBarkWarnings();
ok('unknown key skipped', R('zz_mystery_key') === null && R('blorp') === null);
ok('unknown key warns once', (R('zz_mystery_key'), R('zz_mystery_key'), warns.filter(w => /zz_mystery_key/.test(w)).length === 1), warns.join(' | '));
ok('unknown key + caller line -> line, not the key', R('zz_other', { line: 'Get out.' }).line === 'Get out.' && R('zz_other', 'Get out.').cat === 'custom');
ok('free text still works', R("Hey! That's my dog's spot.").cat === 'custom' && R("Hey! That's my dog's spot.").line === "Hey! That's my dog's spot.");
ok('free text with spaces is text', R('watch it buddy').line === 'watch it buddy');
ok('free text clipped to 90', R('A'.repeat(200)).line.length === 90);
ok('empty / null skipped', R('') === null && R(null) === null && R(null, 'Only a line.').line === 'Only a line.');
ok('blank caller line ignored', R('idle', '   ').line === null);
ok('runtime registerBarks category resolves', (B.BARKS.zz_runtime = ['Runtime line.'], R('zz_runtime').cat === 'zz_runtime'));
delete B.BARKS.zz_runtime;
const keyish = ['activity_complete', 'idle', 'warn', 'poker_win', 'pit_crowd', 'barter_offer', 'q', 'abc_123'];
ok('a snake_case key is never the caption', keyish.every(k => { const r = R(k); return r === null || (lineOf(r) && lineOf(r) !== k); }));

// ---------- every caller key in the source resolves ----------
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const files = []; const skip = new Set(['tests', 'tools', 'vendor', 'shots', '.git', 'node_modules']);
const walk = d => { for (const f of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!skip.has(f.name)) walk(p); } else if (f.name.endsWith('.js') && f.name !== 'barks.js' && f.name !== 'mars-audio.js') files.push(p); } };
walk('.');
// nth top-level argument of a call's argument text (depth-aware: skips commas inside {} () [] and quotes)
const argN = (t, want) => { let d = 0, i = 0, q = null, start = 0, idx = 0;
  for (; i < t.length; i++) { const c = t[i]; if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') q = c; else if ('{(['.includes(c)) d++; else if ('})]'.includes(c)) { if (d === 0) break; d--; }
    else if (c === ',' && d === 0) { if (idx === want) return t.slice(start, i); idx++; start = i + 1; } }
  return idx === want ? t.slice(start, i) : ''; };
const keys = new Map(); const add = (k, where) => { if (!keys.has(k)) keys.set(k, where); };
for (const f of files) {
  const s = read(f);
  if (f.endsWith('contraband.js') || !/SSX\??\.bark\b|tryBark|sayNpc/.test(s)) continue; // modules that reach SSX.bark (contraband below)
  for (const ln of s.split('\n')) {
    if (/^\s*(export\s+)?function\s/.test(ln) || /^\s*(\/\/|\*)/.test(ln)) continue;
    for (const m of ln.matchAll(/\b(?:tryBark|sayNpc|bark|SSX\??\.bark)\(([^;]*)/g)) {
      const second = argN(m[1], 1);
      for (const q of second.matchAll(/'([a-z0-9_]+)'/g)) add(q[1], f);
    }
  }
}
// contraband: bark(o, key) -> SSX.bark(npc, 'barter_' + key, { line }); keys are the literals + every offers[].lines key
const cb = read('mars/contraband.js'); for (const m of cb.matchAll(/\bbark\(o,\s*'([a-z0-9_]+)'\)/g)) add('barter_' + m[1], 'mars/contraband.js');
for (const f of ['mars/barter.json', 'data/barter.json']) if (fs.existsSync(path.join(root, f))) for (const o of JSON.parse(read(f)).offers || []) for (const k of Object.keys(o.lines || {})) add('barter_' + k, f);
console.log('caller keys:', [...keys.keys()].sort().join(', '));
for (const k of ['activity_complete', 'idle', 'warn', 'poker_offer', 'pit_crowd', 'barter_accept']) ok(`scan found ${k}`, keys.has(k));
// scihooks bark(who, key) registers per-speaker categories (sci_silas_drive, sci_ossery_dim...) at runtime (scientists*.js)
const sciSrc = files.filter(f => /(^|\/)scientists\d*\.js$/.test(f)).map(read).join('\n');
const sciCat = (k, f) => /scihooks\.js$/.test(f) && new RegExp(`\\bsci_[a-z]+_${k}\\s*:`).test(sciSrc);
const bad = [...keys].filter(([k, f]) => { if (sciCat(k, f)) return false; const r = B.resolveBark(k, undefined, B.BARKS, () => {}); return !r || !lineOf(r) || lineOf(r) === k; });
ok('every caller key resolves to a real line', !bad.length, bad.map(([k, f]) => `${k} (${f})`).join(', '));
for (const [k] of [...keys].sort()) { const r = B.resolveBark(k, undefined, B.BARKS, () => {}); console.log(`   ${k} -> ${r ? r.cat : 'SKIP'}`); }

console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
