// Runner side-job dead ends (pure, no browser): node tests/test-deadends-unit.mjs
// Every compiled step must have a reachable target: collect pools resolve to spots, pts_local races keep their gates,
// markers inside geometry get pushed out. (Pit outcomes: tests/test-pit-series-unit.mjs)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { prepTemplate, nudgeSteps } from '../activities/deadends.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const pack = JSON.parse(fs.readFileSync(path.join(root, 'activities/side-activities.json'), 'utf8'));
const runner = fs.readFileSync(path.join(root, 'activities/runner.js'), 'utf8');
const CENTRES = Object.fromEntries([...runner.matchAll(/'(mars-[a-z]+)': \{[^}]*centre: \[(-?\d+), (-?\d+)\]/g)].map(m => [m[1], [+m[2], +m[3]]]));
ok('district centres parsed', Object.keys(CENTRES).length >= 4);
const fin = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

for (const def of pack.activities) {
  const L = def.loop || {};
  for (const key of Object.keys(L).filter(k => k.startsWith('steps') && Array.isArray(L[k]))) {
    const tpl = L[key], out = prepTemplate(def, tpl, CENTRES[def.district]);
    for (const s of out) {
      if (s.type === 'collect') ok(`${def.id} ${key} collect "${s.text}" has a target`, fin(s.at) || s.a != null, JSON.stringify(s));
      if (s.type === 'race') ok(`${def.id} ${key} race "${s.text}" has gates`, Array.isArray(s.pts) && s.pts.length >= 2 && s.pts.every(fin));
      if (s.at) ok(`${def.id} ${key} "${s.text}" target finite`, fin(s.at));
    }
    const collects = tpl.filter(s => s.type === 'collect' && s.spread_from);
    for (const c of collects) {
      const g = out.filter(s => s.type === 'goto' && s.text?.startsWith(c.text + ' ('));
      ok(`${def.id} "${c.text}" -> ${c.n} spots`, g.length === Math.min(c.n, (L[c.spread_from] || []).length) && g.every(s => fin(s.at)), String(g.length));
    }
  }
}
// nudge: a marker inside a 10 m box at the colony origin is pushed out; outside markers stay put
const box = (x, z, r) => (Math.abs(x) < 5 + r && Math.abs(z) < 5 + r) ? { x: x >= 0 ? 5 + r : -5 - r, z } : null;
const ctx = { colonyAt: p => ({ x: p[0] - 100, z: p[1] }), freeSpot: (x, z, r) => box(x, z, r) || { x, z } };
const st = nudgeSteps([{ type: 'goto', at: [101, 0] }, { type: 'goto', at: [130, 4] }, { type: 'race', pts: [[100, 2], [140, 0]] }], ctx);
ok('nudge pushes marker out of geometry', st[0].at[0] >= 106 && st[0].at[1] === 0, JSON.stringify(st[0].at));
ok('nudge leaves free markers', st[1].at[0] === 130 && st[1].at[1] === 4);
ok('nudge pushes race gates', st[2].pts[0][0] >= 106 && st[2].pts[1][0] === 140);
ok('nudge without a colony is a no-op', nudgeSteps([{ type: 'goto', at: [1, 2] }], {})[0].at[0] === 1);
ok('runner uses the guards', /prepTemplate\(def, tpl/.test(runner) && /nudgeSteps\(steps, C\)/.test(runner));
console.log(`\n${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
