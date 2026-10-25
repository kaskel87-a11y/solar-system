// node tests/test-director-unit.mjs : pure Director-mode rules (modes/directorcore.js)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D from '../modes/directorcore.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const base = { top: 0xb0794a, horizon: 0xe2b583, lightColor: 0xfff0dd, light: 2.2, hemi: 0.8 };

t('sanitize: garbage -> defaults', () => {
  assert.deepEqual(D.sanitize(null), { ...D.DEFAULTS });
  const s = D.sanitize({ storm: 'tornado', density: 'packed', tod: 'x', timeScale: 7, noCops: 1, extra: 1 });
  assert.equal(s.storm, 'off'); assert.equal(s.density, 'normal'); assert.equal(s.tod, null); assert.equal(s.timeScale, 1); assert.equal(s.noCops, true);
  assert.equal(D.sanitize({ tod: 25 }).tod, 1); assert.equal(D.sanitize({ tod: -1 }).tod, 23);
});
t('presets', () => { assert.deepEqual(D.PRESETS, { dawn: 6.4, noon: 12, dusk: 18.3, night: 23 }); });
t('advanceClock: scale, wrap, freeze, game lighting', () => {
  const s = D.sanitize({ timeScale: 16 });
  assert.ok(Math.abs(D.advanceClock(9, 60, s) - 25 % 24) < 1e-9);
  assert.equal(D.advanceClock(9, 60, { ...s, freeze: true }), 9);
  assert.equal(D.advanceClock(null, 60, s), null);
  assert.ok(Math.abs(D.advanceClock(23.9, 60, D.sanitize({ timeScale: 1 })) - 0.9) < 1e-9);
});
t('todLook: night darker than noon, stars only at night', () => {
  const noon = D.todLook(12, base), night = D.todLook(23, base), dusk = D.todLook(18.3, base);
  assert.ok(night.light < noon.light * 0.2); assert.ok(night.hemi < noon.hemi);
  assert.ok(night.stars > 0.9 && noon.stars === 0);
  assert.ok(Math.abs(noon.light - base.light) < 1e-9 && noon.top === base.top);
  assert.ok(dusk.twilight > 0.3, 'dusk has twilight tint');
  for (const h of [0, 3, 6.4, 12, 18.3, 23]) { const l = D.todLook(h, base); for (const k of ['top', 'horizon', 'lightColor']) assert.ok(Number.isInteger(l[k]) && l[k] >= 0 && l[k] <= 0xffffff); }
});
t('stormParams: heavy thicker than light, cheap on mobile', () => {
  const h = D.stormParams('heavy', true), l = D.stormParams('light', true), o = D.stormParams('off', true);
  assert.ok(h.far < l.far && l.far < 150); assert.equal(o.count, 0);
  assert.ok(h.count <= 400 && l.count <= 400); assert.ok(D.stormParams('heavy', false).count > h.count);
  assert.equal(D.windAt(5, 'off').speed, 0); assert.ok(D.windAt(5, 'heavy').speed > D.windAt(5, 'light').speed * 0.9);
});
t('densityReserve never exceeds cap and keeps the walker floor', () => {
  for (const lv of D.DENSITIES) { assert.ok(D.densityReserve(lv, 12, true) <= 12 - 4); assert.ok(D.densityReserve(lv, 40, false) <= 40); }
  assert.equal(D.densityReserve('normal', 12, true), 0); assert.ok(D.densityReserve('empty', 12, true) > D.densityReserve('sparse', 12, true));
});
t('activeCheats / rewardsBlocked', () => {
  const s = D.sanitize({ storm: 'heavy', tod: 23, density: 'empty' });
  assert.deepEqual(D.activeCheats(s), []); assert.equal(D.rewardsBlocked(s, {}), false, 'cosmetic settings are not cheats');
  assert.deepEqual(D.activeCheats({ ...s, noCops: true, ammo: true }, { vehicle: 'buggy' }), ['noCops', 'ammo', 'vehicle']);
  assert.equal(D.rewardsBlocked({ ...s, invincible: true }, {}), true);
});
t('imports in modes/director*.js match main ?v=', () => {
  const v = (fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/jobs\.js\?v=([\d.]+)/) || [])[1];
  assert.ok(v, 'index.html jobs.js ?v= (main core version)');
  const src = fs.readFileSync(new URL('../modes/director.js', import.meta.url), 'utf8');
  for (const m of src.matchAll(/from '(\.[^']+)'/g)) assert.ok(m[1].endsWith('?v=' + v), m[1]);
});
console.log(`${n} passed`);
