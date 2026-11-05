// Mars day/night rules (mars/timecore.js) + the one-hook / plain-import rules for mars/time.js. node tests/test-time-unit.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../mars/timecore.js';
import { timeBand } from '../dangercore.js';
const root = new URL('..', import.meta.url).pathname;
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };

t('phases', () => {
  const want = { 0: 'night', 4.9: 'night', 5: 'dawn', 7.9: 'dawn', 8: 'day', 12: 'day', 16.9: 'day', 17: 'dusk', 20.9: 'dusk', 21: 'night', 23.9: 'night' };
  for (const [h, p] of Object.entries(want)) assert.equal(T.phaseOf(+h), p, h);
  assert.equal(T.isNightAt(21), true); assert.equal(T.isNightAt(20.9), false); assert.equal(T.isNightAt(4), true); assert.equal(T.isNightAt(5), false); assert.equal(T.isNightAt(12), false);
  assert.equal(T.phaseOf(-1), 'night'); assert.equal(T.phaseOf(25), 'night'); assert.equal(T.phaseOf(36), 'day');
});
t('phases match dangercore.timeBand (street danger) on every quarter hour', () => {
  for (let h = 0; h < 24; h += 0.25) { assert.equal(T.phaseOf(h), timeBand(h), 'h=' + h); assert.equal(T.isNightAt(h), timeBand(h) === 'night', 'h=' + h); }
  assert.equal(T.NIGHT_START, 21); assert.equal(T.NIGHT_END, 5);
});
t('clock speed: 24 real minutes per day at 1x', () => {
  assert.equal(T.DAY_MIN, 24);
  assert.ok(Math.abs(T.advance(10, 60, 1, false) - 11) < 1e-9);
  assert.ok(Math.abs(T.advance(23.5, 60, 1, false) - 0.5) < 1e-9);
  assert.equal(T.advance(10, 60, 1, true), 10);
  assert.ok(Math.abs(T.advance(10, 60, 16, false) - 2) < 1e-9);
  assert.ok(Math.abs(T.secondsToNight(20, 1) - 60) < 1e-6);
  assert.equal(T.secondsToNight(22, 1), 0);
});
t('sanitize', () => {
  assert.deepEqual(T.sanitize(null), { ...T.DEFAULTS });
  const s = T.sanitize({ h: 30, scale: 9999, frozen: 1, junk: 1 });
  assert.equal(s.h, 6); assert.ok(s.scale <= T.MAX_SCALE); assert.equal(s.frozen, true); assert.equal(s.junk, undefined);
  assert.equal(T.sanitize({ h: 'x', scale: -3 }).h, T.DEFAULTS.h); assert.ok(T.sanitize({ scale: -3 }).scale >= 0);
});
t('nightness and gameplay multipliers', () => {
  assert.equal(T.nightness(12), 0); assert.equal(T.nightness(23), 1); assert.equal(T.nightness(2), 1);
  assert.equal(T.nightness(21), 1); assert.equal(T.nightness(18), 0); const d = T.nightness(20); assert.ok(d > 0 && d < 1);
  assert.equal(T.crimeMultiplier(12), 1); assert.ok(T.crimeMultiplier(23) >= 1.8); assert.ok(T.crimeMultiplier(1) > T.crimeMultiplier(23)); assert.ok(T.crimeMultiplier(1) <= 2.2);
  assert.equal(T.copsMultiplier(12), 1); assert.ok(T.copsMultiplier(23) <= 0.55 && T.copsMultiplier(23) > 0);
  for (let h = 0; h < 24; h += 0.25) { const n = T.nightness(h); assert.ok(n >= 0 && n <= 1); }
});
t('look: night is dark with stars, day is the base', () => {
  const base = { top: 0xd08850, horizon: 0xe8b080, fog: 0xc89070, light: 2.4, lightColor: 0xffeedd, hemi: 0.9 };
  const day = T.look(12, base), night = T.look(23, base), dusk = T.look(19, base);
  assert.equal(day.top, base.top); assert.equal(day.horizon, base.horizon); assert.ok(Math.abs(day.light - base.light) < 1e-6); assert.equal(day.stars, 0); assert.equal(day.sunVisible, true);
  assert.ok(night.light < base.light * 0.2 && night.light > 0); assert.ok(night.hemi < base.hemi * 0.4); assert.equal(night.stars, 1); assert.equal(night.sunVisible, false); assert.equal(night.neon, 1);
  const lum = c => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
  assert.ok(lum(night.top) < lum(base.top) * 0.2);
  assert.ok(dusk.light < base.light && dusk.light > night.light);
  assert.equal(T.hhmm(21.666), '21:40'); assert.equal(T.hhmm(0), '00:00');
});
t('one hook in index.html, version matches main, plain imports', () => {
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const hooks = html.match(/<script type="module" src="\.\/mars\/time\.js\?v=([\d.]+)"><\/script>/g) || [];
  assert.equal(hooks.length, 1);
  const v = (/sw\.js\?v=([0-9.]+)/.exec(html) || [])[1]; assert.ok(v, 'main version (sw.js?v=)');
  assert.ok(hooks[0].includes('?v=' + v), 'hook ?v= matches main');
  for (const f of ['mars/time.js', 'mars/timecore.js']) {
    const src = fs.readFileSync(root + f, 'utf8');
    const imps = [...src.matchAll(/\bimport\s[^'"]*['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const i of imps) assert.ok(!/\?v=/.test(i), f + ' import ' + i);
    assert.ok(!/fetch\(|XMLHttpRequest/.test(src), f + ' no network');
  }
  assert.ok(!/from\s+['"]/.test(fs.readFileSync(root + 'mars/timecore.js', 'utf8')), 'timecore is dependency-free');
});
console.log(`${n} passed`);
