// Unit test: clothed ~50% bust scale helpers in clubdancers.js (synthetic mounds + source wiring).
import { readFileSync, writeFileSync, mkdirSync, symlinkSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import * as THREE from '../vendor/three/build/three.module.min.js';

const src = readFileSync(new URL('../clubdancers.js', import.meta.url), 'utf8');
let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };

ok('BUST_SCALE is 1.7', /export const BUST_SCALE = 1\.7/.test(src));
ok('enlarge runs once on GLB load', /enlargeDancerBust\(gltf\)/.test(src));
ok('skin + tops only (coverage)', /TOP_GIDS = new Set\(\[1, 3, 6, 10\]\)/.test(src));
ok('idempotent via userData.ssxBustScale', /userData\.ssxBustScale/.test(src));
ok('exports measure + inflate for tests', /export function measureBustDepth/.test(src) && /export function inflateBustGeometry/.test(src));

mkdirSync('/tmp/bust-unit/node_modules/three', { recursive: true });
writeFileSync('/tmp/bust-unit/node_modules/three/package.json', JSON.stringify({
  name: 'three', type: 'module',
  exports: { '.': './build/three.module.min.js', './addons/*': './addons/*' }
}));
for (const p of ['build', 'addons']) {
  const t = `/tmp/bust-unit/node_modules/three/${p}`;
  if (!existsSync(t)) symlinkSync(`/workspace/solar-system-steve-dancers/vendor/three/${p}`, t);
}

const start = src.indexOf('export const BUST_SCALE');
const end = src.indexOf('function enlargeDancerBust');
writeFileSync('/tmp/bust-unit/bust.mjs', `import * as THREE from 'three';\n` + src.slice(start, end));
const mod = await import(pathToFileURL('/tmp/bust-unit/bust.mjs').href);

function makeGeo() {
  const pos = [], gm = [];
  const put = (x, y, z, id) => { pos.push(x, y, z); gm.push(id, 0, 0, 0); };
  for (let k = 0; k < 20; k++) put((k - 10) * 0.002, 0.45, 0.05, 0);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI, r = 0.05;
      put(side * (0.10 + Math.sin(a) * r * 0.3), 0.45 + Math.cos(a) * r * 0.2, 0.05 + Math.sin(a) * r, 0);
    }
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI, r = 0.055;
      put(side * (0.10 + Math.sin(a) * r * 0.3), 0.45 + Math.cos(a) * r * 0.2, 0.05 + Math.sin(a) * r, 1);
    }
  }
  for (let k = 0; k < 20; k++) put((k - 10) * 0.01, 0.05, 0.08, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aGm', new THREE.BufferAttribute(new Float32Array(gm), 4));
  return g;
}

const g = makeGeo();
const before = mod.measureBustDepth(g);
ok('synthetic before has tops', !!before && before.topN > 0);
ok('synthetic before depth > 0', !!before && before.depth > 0.02);
const d0 = before.depth;
mod.inflateBustGeometry(g, mod.BUST_SCALE);
const after = mod.measureBustDepth(g);
ok('scaled once', g.userData.ssxBustScale === 1.7);
const ratio = after.depth / d0;
ok(`depth ~1.5x (was ${d0.toFixed(4)} now ${after.depth.toFixed(4)}, ratio ${ratio.toFixed(2)})`, ratio > 1.2 && ratio < 1.85);
ok('top still covers skin', after.topCovers);
mod.inflateBustGeometry(g, mod.BUST_SCALE);
ok('second inflate is no-op', Math.abs(mod.measureBustDepth(g).depth - after.depth) < 1e-6);

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all good');
