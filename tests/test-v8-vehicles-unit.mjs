// v8 realistic vehicles: one index.html hook straight after the models.js line, plain imports, no downloaded assets,
// lazy generator (only vehicles.js is a static script), no real brand names in the geometry / decal code.
// node tests/test-v8-vehicles-unit.mjs
import fs from 'node:fs';
const R = new URL('..', import.meta.url).pathname;
let fails = 0; const t = (name, cond) => { if (!cond) { fails++; console.log('FAIL', name); } };
const idx = fs.readFileSync(R + 'index.html', 'utf8').split('\n');
const hook = idx.findIndex(l => l.includes('src="./look/vehicles.js?v=')), models = idx.findIndex(l => l.includes('src="./look/models.js?v='));
t('hook once', idx.filter(l => l.includes('look/vehicles.js')).length === 1);
t('hook after models.js', models >= 0 && hook === models + 1 && /type="module"/.test(idx[hook]));
t('gen / fx not static scripts', !idx.some(l => /look\/vehicles-(gen|fx)\.js/.test(l)));
const files = ['look/vehicles.js', 'look/vehicles-gen.js', 'look/vehicles-fx.js'];
for (const f of files) {
  const s = fs.readFileSync(R + f, 'utf8');
  t(f + ' plain imports', !/(from|import\()\s*['"][^'"]+\?v=/.test(s));
  t(f + ' no asset fetches', !/\.(glb|gltf|ktx2|png|jpe?g|webp)['"]/.test(s) && !/fetch\(/.test(s));
  t(f + ' no dancer edits', !/ssxDancer/.test(s));
  t(f + ' no brands', !/\b(ford|chevy|chevrolet|toyota|honda|bmw|audi|mercedes|ferrari|porsche|tesla|jeep|nissan|lamborghini|dodge|cybertruck)\b/i.test(s));
}
const rt = fs.readFileSync(R + 'look/vehicles.js', 'utf8');
t('runtime loads gen lazily', /import\('\.\/vehicles-gen\.js'\)/.test(rt) && !/^import .*vehicles-gen/m.test(rt));
t('runtime never edits core files', !/VEHICLES\s*\[[^\]]+\]\s*=/.test(rt));
t('classic gate', /S\.tier !== 'classic'/.test(rt));
t('uses SSX.time.isNight', /SSX\?\.time/.test(rt) && /isNight/.test(rt));
t('SSX.vehicleLook hook exported', /X\.vehicleLook = LOOK/.test(rt) && /'ssxVehPaint'/.test(rt) && /'ssxVehAttach'/.test(rt));
t('no .visible writes on blocky meshes (layers only)', !/o\.visible = (false|v)\b/.test(rt));
t('no collision code in runtime', !/\b(collide|collision|colliders?|resolveHit|aabb)\b/i.test(rt));
// other agents' files / collision code untouched vs the base branch (skipped when git is unavailable)
try {
  const { execSync } = await import('node:child_process');
  const ch = execSync('git diff --name-only origin/steve/v8-models -- .', { cwd: R, encoding: 'utf8' }).split('\n').filter(Boolean);
  const theirs = ch.filter(f => /^(dealership|garagecore|rides|world|surface|game|physics|collide\w*)\.js$|^mars\/raccoon|ss-assets|dancer/i.test(f));
  t('no edits to Pumpkin / core / collision files: ' + theirs.join(','), theirs.length === 0);
} catch (e) { console.log('skip git diff check: ' + e.message.split('\n')[0]); }
const bytes = files.reduce((a, f) => a + fs.statSync(R + f).size, 0);
t('code budget < 150 KB', bytes < 150e3);
console.log(fails ? `${fails} FAIL` : `ok v8 vehicles unit (${(bytes / 1e3).toFixed(1)} KB code, 0 asset bytes)`);
process.exit(fails ? 1 : 0);
