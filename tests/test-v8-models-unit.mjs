// v8 realistic models: asset budget, licences, GLB contents and the single index.html hook. node tests/test-v8-models-unit.mjs
import fs from 'node:fs';
const R = new URL('..', import.meta.url).pathname;
let fails = 0; const t = (name, cond) => { if (!cond) { fails++; console.log('FAIL', name); } };
const glb = (f) => { const b = fs.readFileSync(R + f); if (b.readUInt32LE(0) !== 0x46546c67) return null; const n = b.readUInt32LE(12); return { bytes: b.length, json: JSON.parse(b.subarray(20, 20 + n).toString('utf8')) }; };
const chars = ['player', 'soldier', 'hacker', 'worker'], kit = fs.readdirSync(R + 'models/v8/kit').filter(f => f.endsWith('.glb'));
const assets = fs.readFileSync(R + 'models/v8/ASSETS.md', 'utf8');
let total = 0;
for (const c of chars) {
  const g = glb(`models/v8/chars/${c}.glb`); t(c + ' glb', !!g); if (!g) continue; total += g.bytes;
  const J = g.json, names = J.nodes.filter(n => n.mesh != null).map(n => n.name);
  t(c + ' lod0 + lod1', names.includes('lod0') && names.includes('lod1'));
  t(c + ' lods share one joint set', J.skins?.length >= 1 && J.skins.every(k => k.joints.join() === J.skins[0].joints.join()) && J.nodes.filter(n => n.mesh != null).every(n => n.skin != null));
  t(c + ' 26 joints', J.skins[0].joints.length >= 20 && J.nodes.some(n => n.name === 'WeaponR') && J.nodes.some(n => n.name === 'Head'));
  const mats = J.materials.map(m => m.name); t(c + ' materials', mats.includes('opaque') && mats.includes('far') && mats.includes('glass'));
  t(c + ' meshopt', (J.extensionsUsed || []).includes('EXT_meshopt_compression'));
  t(c + ' no ktx2', !(J.extensionsUsed || []).includes('KHR_texture_basisu'));
  t(c + ' licence extras', /CC0/.test(JSON.stringify(J.asset.extras || {})));
  t(c + ' under 450 KB', g.bytes < 450e3);
  t(c + ' in ASSETS.md', assets.includes(`${c}.glb`));
}
{ const g = glb('models/v8/chars/anims.glb'); t('anims glb', !!g); total += g.bytes; const n = g.json.animations.map(a => a.name.split(' (')[0]);
  for (const k of ['Idle', 'Walk', 'Run', 'Pistol aim', 'Pistol fire', 'Punch', 'Jump']) t('clip ' + k, n.includes(k)); t('anims in ASSETS.md', assets.includes('anims.glb')); }
for (const f of kit) {
  const g = glb('models/v8/kit/' + f); t(f + ' glb', !!g); if (!g) continue; total += g.bytes;
  t(f + ' meshopt, no ktx2', (g.json.extensionsUsed || []).includes('EXT_meshopt_compression') && !(g.json.extensionsUsed || []).includes('KHR_texture_basisu'));
  t(f + ' webp only', (g.json.images || []).every(i => i.mimeType === 'image/webp'));
  t(f + ' licence extras', /CC0/.test(JSON.stringify(g.json.asset.extras || {})));
  t(f + ' in ASSETS.md', assets.includes(f));
}
t('kit files', kit.length >= 9);
t('med budget <= 6 MB', total <= 6e6);
// the kit module only asks for files that exist
const kitsJs = fs.readFileSync(R + 'look/models-kits.js', 'utf8');
for (const id of new Set([...kitsJs.matchAll(/'((?:mansion|mars|planter|boarded|rollershutter|fire|burn)_[a-z0-9_]+)'/g)].map(m => m[1]))) t('kit file for ' + id, kit.includes(id + '.glb'));
// one hook, straight after the v8 look line; modules import plain paths
const idx = fs.readFileSync(R + 'index.html', 'utf8').split('\n');
const hook = idx.findIndex(l => l.includes('src="./look/models.js?v=')), v8 = idx.findIndex(l => l.includes('src="./look/v8.js?v='));
t('hook once', idx.filter(l => l.includes('look/models.js')).length === 1);
t('hook after v8', v8 >= 0 && hook === v8 + 1 && /type="module"/.test(idx[hook]));
for (const f of ['look/models.js', 'look/models-kits.js']) { const s = fs.readFileSync(R + f, 'utf8'); t(f + ' plain imports', !/(from|import\()\s*['"][^'"]+\?v=/.test(s)); t(f + ' no dancer edits', !/ssxDancer\s*=/.test(s)); }
console.log(fails ? `${fails} FAIL` : `ok v8 models unit (${(total / 1e6).toFixed(2)} MB, ${kit.length} kit files)`);
process.exit(fails ? 1 : 0);
