// The Pages artifact must drop screenshots/tests/docs/tools and still contain
// every file the live game fetches: sw.js precache, planet textures, dancer
// models, the city kit, icons, and share-card.jpg.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };

const cfg = readFileSync(path.join(root, '_config.yml'), 'utf8');
const exclude = [...cfg.matchAll(/^ {2}- (.+)$/gm)].map(m => m[1].trim().replace(/\/$/, ''));
ok('excludes the heavy non-runtime folders', ['shots', 'tests', 'docs', 'tools'].every(d => exclude.includes(d)));
ok('does not exclude vendor/three', !exclude.some(e => e === 'vendor' || e === 'vendor/three'));

const excluded = rel => {
  const n = rel.replace(/^\.\//, '');
  return exclude.some(e => n === e || n.startsWith(e + '/'));
};

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const rel = base ? base + '/' + name : name;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, rel));
    else out.push({ rel, size: st.size });
  }
  return out;
}
const files = walk(root);
const before = files.reduce((s, f) => s + f.size, 0);
const dropped = files.filter(f => excluded(f.rel));
const kept = files.filter(f => !excluded(f.rel));
const after = kept.reduce((s, f) => s + f.size, 0);
const dropBytes = dropped.reduce((s, f) => s + f.size, 0);
console.log(`before ${before} bytes (${(before / 1048576).toFixed(1)} MiB), ${files.length} files`);
console.log(`after  ${after} bytes (${(after / 1048576).toFixed(1)} MiB), ${kept.length} files`);
console.log(`dropped ${dropBytes} bytes (${(dropBytes / 1048576).toFixed(1)} MiB), ${dropped.length} files`);
ok('drops more than 400 MiB', dropBytes > 400 * 1048576);
ok('published tree is under 80 MiB', after < 80 * 1048576);

const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
const start = sw.indexOf('const PRECACHE = [');
const end = sw.indexOf('];', start);
let body = sw.slice(start + 'const PRECACHE = '.length, end + 1).replace(/\$\{q\}/g, '').replace(/\/\/.*$/gm, '');
const precache = Function(`return ${body}`)();
ok('precache parsed', Array.isArray(precache) && precache.length > 40);
const missing = precache.map(u => String(u).replace(/^\.\//, '').split('?')[0]).filter(rel => rel && (!files.some(f => f.rel === rel) || excluded(rel)));
ok('precache files all published', missing.length === 0);
if (missing.length) console.log(missing.join('\n'));

const planet = ['sun.jpg', 'mercury.jpg', 'venus_atmosphere.jpg', 'earth_daymap.jpg', 'earth_clouds.jpg', 'moon.jpg', 'mars.jpg', 'jupiter.jpg', 'saturn.jpg', 'saturn_ring_alpha.png', 'uranus.jpg', 'neptune.jpg'];
const texPaths = planet.flatMap(n => [`textures/2k_${n}`, `textures/1k/1k_${n}`]).concat(['textures/2k_stars_milky_way.jpg']);
const texMissing = texPaths.filter(rel => !files.some(f => f.rel === rel) || excluded(rel));
ok('planet textures published', texMissing.length === 0);
if (texMissing.length) console.log(texMissing.join('\n'));

const dancers = ['dancer_danny', 'dancer_rhea', 'dancer_kiara'].flatMap(n => [
  `models/dancers/${n}.glb`, `models/dancers/${n}_skin_hd.webp`, `models/dancers/${n}_hair_hd.webp`, `models/dancers/${n}_nrm_hd.webp`
]).concat(['models/dancers/dancer_aux.webp']);
const dancerMissing = dancers.filter(rel => !files.some(f => f.rel === rel) || excluded(rel));
ok('dancer models published', dancerMissing.length === 0);
if (dancerMissing.length) console.log(dancerMissing.join('\n'));

for (const rel of ['index.html', 'sw.js', 'manifest.webmanifest', 'share-card.jpg', 'assets/mars-city/manifest.json', 'data/barter.json', 'data/random-events.json', 'modes/rags-data.json', 'vendor/three/build/three.module.min.js', 'vendor/three/addons/libs/meshopt_decoder.module.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) {
  ok('kept ' + rel, files.some(f => f.rel === rel) && !excluded(rel));
}

ok('no published path is under shots, tests, docs or tools', kept.every(f => !/^(shots|tests|docs|tools)(\/|$)/.test(f.rel)));
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('pages exclude OK');
