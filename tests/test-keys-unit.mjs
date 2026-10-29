// Keyboard binding clash check (no browser). Scans the game's JS/HTML for key codes ('KeyX', 'DigitN', 'Comma', ... quoted,
// or as object-map keys like `Digit1:`) per file and fails when
//  1) an arsenal key (mars/arsenal.js KEYS) is bound by any other file, except the known, intentional context splits below, or
//  2) any key is bound by two or more files and that overlap is not in KNOWN (a new clash somebody should look at).
// node tests/test-keys-unit.mjs                          working tree
// REFS="origin/main pr/41 pr/43 pr/44" node tests/test-keys-unit.mjs   also scan git refs (git fetch origin pull/N/head:refs/remotes/pr/N)
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SKIP = /^(vendor|tests|node_modules|shots|tools|\.git)\//;
const CODE = /(['"`])((?:Key[A-Z])|(?:Digit[0-9])|Comma|Period|Slash|Semicolon|Backquote|Quote|BracketLeft|BracketRight|Backslash)\1|\b(Key[A-Z]|Digit[0-9])\s*:/g;
// known context-dependent overlaps (each side checks its own mode/visible button). file lists are the full allowed set.
const KNOWN = {
  KeyQ: ['index.html', 'mars/arsenal.js', 'mars/gravity.js'], // core weapon switch | arsenal wheel on foot | zero-G vehicle roll
  KeyE: ['index.html', 'mars/gravity.js', 'mars/flats-interiors.js', 'privateshow.js', 'myrides.js'], KeyT: ['index.html', 'privateshow.js'], // booth is modal: capture-phase handler eats the key // myrides.js: E enters your closest parked ride (same meaning as E)
  KeyC: ['index.html', 'mars/gravity.js'], // interact/melee on foot | zero-G roll/descend in a vehicle
  KeyW: ['index.html', 'mars/gravity.js', 'trackbuilder.js'], KeyS: ['index.html', 'mars/gravity.js', 'trackbuilder.js'],
  KeyA: ['index.html', 'mars/gravity.js', 'safecrack.js', 'trackbuilder.js'], KeyD: ['index.html', 'mars/gravity.js', 'safecrack.js', 'trackbuilder.js'],
  KeyR: ['index.html', 'trackbuilder.js'], KeyZ: ['airroll.js', 'mars/gravity.js', 'trackbuilder.js'], // builder has its own keymap; Z airborne roll vs ground gravity toggle
  KeyF: ['index.html', 'controlmode.js'], KeyM: ['index.html', 'controlmode.js'], // keyboard-only fire mode reuses the game's keys
  KeyI: ['mars/arsenal.js', 'phonetexts.js'], // I reload (no Shift) | Shift+I texts
  KeyX: ['index.html', 'mars/smugglecore.js'], KeyB: ['mars/contraband.js', 'mars/smugglecore.js'], // smuggling dump / bribe in space only; medkit / stash on the surface
  Digit8: ['mars/beltway.js', 'mars/smugglecore.js'], // beltway action only while its button shows; smuggle run at the pad
  KeyG: ['heist.js', 'mars/jobs.js', 'mars/barcontact.js'], KeyY: ['mars/turf.js', 'mars/street.js'], // context action buttons; jobs defers to heist
  Digit2: ['base.js', 'danger.js', 'mars/gravity.js'], // standoff "fight" vs gravity cycle (gravity skips during a standoff); base build tool 2 only in build mode
  // v7.5.4: base build tools (build mode only, and they yield to a standoff / street-event choice) vs danger's 1-4 choices; K = base action at your plot, turf panel elsewhere
  Digit1: ['base.js', 'danger.js'], Digit3: ['base.js', 'danger.js'], Digit4: ['base.js', 'danger.js'], KeyK: ['base.js', 'mars/turf.js']
};
function scan(files, read) {
  const by = {};
  for (const f of files) { if (SKIP.test(f) || !/\.(js|mjs|html)$/.test(f)) continue; const src = read(f); if (!src) continue; let m; CODE.lastIndex = 0;
    while ((m = CODE.exec(src))) { const k = m[2] || m[3]; (by[k] ||= new Set()).add(f); } }
  return by;
}
function walk(d, base = '') { const out = []; for (const e of fs.readdirSync(path.join(d, base), { withFileTypes: true })) { const p = base ? base + '/' + e.name : e.name; if (e.isDirectory()) { if (!SKIP.test(p + '/')) out.push(...walk(d, p)); } else out.push(p); } return out; }
const arsPath = path.join(root, 'mars/arsenal.js'), hasArs = fs.existsSync(arsPath); // v7.5.4: arsenal (#46) lands in v7.5.5; the overlap check runs without it
const KEYS = hasArs ? Object.values(Function(`return (${fs.readFileSync(arsPath, 'utf8').match(/export const KEYS = (\{[^}]*\})/)[1]})`)()) : [];
const sets = [['worktree', scan(walk(root), f => fs.readFileSync(path.join(root, f), 'utf8'))]];
for (const ref of (process.env.REFS || '').split(/\s+/).filter(Boolean)) {
  const files = execFileSync('git', ['-C', root, 'ls-tree', '-r', '--name-only', ref], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean);
  sets.push([ref, scan(files, f => { try { return execFileSync('git', ['-C', root, 'show', `${ref}:${f}`], { encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { return ''; } })]);
}
// merged view: what the game looks like with every scanned branch in
const all = {}; for (const [, by] of sets) for (const [k, s] of Object.entries(by)) for (const f of s) (all[k] ||= new Set()).add(f);
const bad = [], overlaps = [];
for (const k of KEYS) { const others = [...(all[k] || [])].filter(f => f !== 'mars/arsenal.js' && !(KNOWN[k] || []).includes(f)); if (others.length) bad.push(`arsenal key ${k} also bound in ${others.join(', ')}`); }
if (hasArs && (!all.KeyQ?.has('mars/arsenal.js') || !all.KeyI?.has('mars/arsenal.js') && !KEYS.includes('KeyI'))) bad.push('arsenal keys not found in mars/arsenal.js');
for (const [k, s] of Object.entries(all)) { if (s.size < 2) continue; const fl = [...s].sort(); overlaps.push(`${k}: ${fl.join(', ')}`); const extra = fl.filter(f => !(KNOWN[k] || []).includes(f)); if (extra.length) bad.push(`new overlap ${k}: ${fl.join(', ')}`); }
console.log(`arsenal keys: ${KEYS.join(' ')} (+ right mouse). scanned: ${sets.map(s => s[0]).join(', ')}`);
console.log('known context overlaps:\n  ' + overlaps.join('\n  '));
if (bad.length) { console.log('FAIL\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('keys OK: no clashes for the arsenal keys, no unknown overlaps');
