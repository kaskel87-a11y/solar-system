// v8 models: the player body API (look/models-player.js) wiring. node tests/test-v8-player-unit.mjs
import fs from 'node:fs';
const R = new URL('..', import.meta.url).pathname;
let fails = 0; const t = (name, cond) => { if (!cond) { fails++; console.log('FAIL', name); } };
const P = fs.readFileSync(R + 'look/models-player.js', 'utf8'), M = fs.readFileSync(R + 'look/models.js', 'utf8'), D = fs.existsSync(R + 'look/MODELS.md') ? fs.readFileSync(R + 'look/MODELS.md', 'utf8') : '';
const slots = JSON.parse(P.match(/export const SLOTS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
for (const s of ['head', 'face', 'neck', 'torso', 'back', 'armL', 'armR', 'forearmL', 'forearmR', 'handL', 'handR', 'legL', 'legR', 'footL', 'footR']) { t('slot ' + s, slots.includes(s)); t('doc slot ' + s, D.includes('`' + s + '`')); }
for (const k of ['torso', 'arms', 'legs', 'boots', 'gloves', 'helmet', 'hair']) t('region ' + k, new RegExp('\\b' + k + ': \\d').test(P));
for (const f of ['attach(slot, obj)', 'setTint(', 'resetTint()', 'hideHelmet(', 'hideHair(', 'sizes', 'root']) { t('api ' + f, P.includes(f)); t('doc ' + f, D.includes(f.replace(/\(.*$/, ''))); }
t('attach sets ssxKeep on the whole subtree', /obj\.traverse\(o => \{ o\.userData\.ssxKeep = true; \}\)/.test(P));
t('attach returns a detach fn', /return \(\) => \{ if \(att\.get\(obj\) !== slot\)/.test(P));
t('sockets keep', (P.match(/userData\.ssxKeep = true; s\.userData\.ssxSocket/g) || []).length === 2);
t('event name', P.includes("'models:player'") && D.includes("models:player"));
t('bus guarded (never replaces SSX.on / SSX.emit)', (P.match(/X\.on =/g) || []).length === 1 && (P.match(/X\.emit =/g) || []).length === 1 && /if \(typeof X\.on !== 'function'\) X\.on =/.test(P) && /if \(typeof X\.emit !== 'function'\) X\.emit =/.test(P));
// models.js: one plain import, blocky fallback hides by layer, skips ssxKeep, never writes .visible on the rig
t('models.js imports models-player plain', /from '\.\/models-player\.js';/.test(M));
for (const f of ['look/models.js', 'look/models-player.js']) t(f + ' plain imports', !/(from|import\()\s*['"][^'"]+\?v=/.test(fs.readFileSync(R + f, 'utf8')));
const bl = M.slice(M.indexOf('function blocky('), M.indexOf('function attach('));
t('blocky skips ssxKeep', /if \(o\.userData\.ssxKeep\) return;/.test(bl));
t('blocky uses layers', /o\.layers\.mask = HIDE_MASK/.test(bl) && !/\.visible\s*=/.test(bl));
t('player() on the API', /player: \(\) => PLAYER/.test(M));
t('sync every tick, models on or off', /finally \{ try \{ PLAYER\.sync\(ctx\)/.test(M));
t('shader: region uniforms + attribute', M.includes('REG_VS[0]') && M.includes('REG_VS[1]') && M.includes('REG_FS[0]') && M.includes('REG_FS[1]') && M.includes('REG_FS[2]') && /\.\.\.regionUniforms\(\)/.test(M));
t('flat varyings match', P.includes("'attribute float _reg;\\nflat varying float vReg;'") && P.includes("'flat varying float vReg;\\nuniform vec4 uReg["));
t('prepBody on load', /prepBody\(file\)/.test(M));
t('mannequins never become the player', /ssxMannequin/.test(M) && /ssxMannequin/.test(P));
t('no Pumpkin files touched', !/from '\.\.\/mars\/skins/.test(P + M));
const idx = fs.readFileSync(R + 'index.html', 'utf8'); t('no new index.html hook', !idx.includes('models-player'));
console.log(fails ? `${fails} FAIL` : `ok v8 player api unit (${slots.length} slots)`);
process.exit(fails ? 1 : 0);
