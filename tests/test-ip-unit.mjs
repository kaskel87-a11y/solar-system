// v7.5.97: borrowed names stay out of the files the game ships, and old save ids still load.
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrateSave } from '../ipcore.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['vendor', 'shots', 'node_modules', '.git', 'tests', 'docs']);
const banned = [
  /Merc with a Mouth/i, /deadpool/i, /\bStarship\b/, /\bRoadster\b/, /Black Ops/,
  /\bHalo\b/, /\bGTA\b/, /Hasselblad/, /Widowmaker gauss/, /Gold-Chain Kingpin/,
  /Viper SMG/, /Pit Viper/
];
const hits = [];
function walk(d) {
  for (const n of readdirSync(d)) {
    if (skip.has(n)) continue;
    const p = path.join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|html|md|json)$/.test(n) && n !== 'ipcore.js') {
      const s = readFileSync(p, 'utf8').split('\n').filter(line => !/=== 'Pit Viper'|=== "Pit Viper"/.test(line)).join('\n');
      for (const re of banned) if (re.test(s)) hits.push(path.relative(root, p) + ' ' + re);
    }
  }
}
walk(root);
const old = { equip: { kit: 'roadster', paint: 'steel' }, unlocks: ['kit:stock', 'kit:roadster'] };
const next = migrateSave(old);
const okKit = next.equip.kit === 'lowline' && next.unlocks.includes('kit:lowline') && !next.unlocks.includes('kit:roadster') && old.equip.kit === 'roadster';
const fresh = migrateSave({ equip: { kit: 'lowline' }, unlocks: ['kit:lowline'] });
const okFresh = fresh.equip.kit === 'lowline';
if (hits.length || !okKit || !okFresh) {
  console.log('FAIL', hits.join('\n'), okKit, okFresh);
  process.exit(1);
}
console.log('ip unit ok');
