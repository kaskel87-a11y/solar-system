// brightnesscore.js rules + brightness.js / hook static checks. node tests/test-brightness-unit.mjs
import fs from 'node:fs';
import * as B from '../brightnesscore.js';
import * as T from '../mars/timecore.js';
const R = new URL('..', import.meta.url).pathname; let n = 0, fails = 0;
const t = (name, c) => { n++; if (!c) { fails++; console.log('FAIL ' + name); } };
const lum = c => 0.2126 * (c >> 16 & 255) + 0.7152 * (c >> 8 & 255) + 0.0722 * (c & 255);
// levels
t('order', B.ORDER.join() === 'low,normal,high,max' && B.DEFAULT === 'normal');
t('norm', B.norm('MAX') === 'max' && B.norm('bogus') === 'normal' && B.norm(null) === 'normal' && B.next('max') === 'low');
t('monotonic', B.ORDER.every((k, i) => i === 0 || (B.LEVELS[k].exp > B.LEVELS[B.ORDER[i - 1]].exp && B.LEVELS[k].amb > B.LEVELS[B.ORDER[i - 1]].amb && B.LEVELS[k].floor > B.LEVELS[B.ORDER[i - 1]].floor)));
t('normal exposure 1 by day', B.liftExposure(1.1, 'normal') === 1.1 && B.liftExposure(1.1, 'normal', 0) === 1.1 && B.liftExposure(1, 'max') > 1.3);
t('night exposure lift, moderate', B.liftExposure(1, 'normal', 1) > 1.15 && B.liftExposure(1, 'normal', 1) < 1.4 && B.liftExposure(1, 'low', 1) < 1);
// ambient: day untouched at Normal, dark scenes floored, never below the input at Normal+
t('day hemi untouched (normal)', Math.abs(B.liftAmbient(1.1, 'normal') - 1.1) < 1e-9 && Math.abs(B.liftAmbient(0.9, 'normal') - 0.9) < 1e-9);
t('dark hemi floored', B.liftAmbient(0.11, 'normal') > 0.3 && B.liftAmbient(0, 'normal') >= 0.24 - 1e-9);
for (const k of ['normal', 'high', 'max']) t('lift >= input ' + k, [0, 0.05, 0.2, 0.5, 0.9, 1.5, 3].every(i => B.liftAmbient(i, k) >= i - 1e-9));
t('levels ordered at night', B.ORDER.every((k, i) => i === 0 || B.liftAmbient(0.15, k) > B.liftAmbient(0.15, B.ORDER[i - 1])));
// Mars night floor on top of the real time.js look (Mars base from surface.js: light 2.2, hemi 0.55*2)
const base = { top: 0xb07a4a, horizon: 0xe2b483, fog: 0xd9a676, light: 2.2, lightColor: 0xfff0dd, hemi: 1.1 };
const mid = T.look(0, base), dusk = T.look(19.5, base), noon = T.look(12, base);
const nm = B.nightFloor(mid, base, 'normal'), nd = B.nightFloor(noon, base, 'normal');
t('midnight lifted', nm.hemi > mid.hemi * 1.5 && nm.light > mid.light * 1.5);
t('still night, not day (time-test bounds)', nm.light < noon.light * 0.25 && nm.hemi < noon.hemi * 0.5);
t('fog/horizon lifted but dark + violet', lum(nm.fog) > lum(mid.fog) && lum(nm.fog) < 60 && (nm.fog & 255) > (nm.fog >> 8 & 255) && lum(nm.horizon) < 60);
t('noon untouched', nd.light === noon.light && nd.hemi === noon.hemi && nd.fog === noon.fog && nd.horizon === noon.horizon);
t('dusk lifted less than midnight', B.nightFloor(dusk, base, 'normal').hemi - dusk.hemi <= nm.hemi - mid.hemi + 1e-9);
t('max brighter than normal at night', B.nightFloor(mid, base, 'max').hemi > nm.hemi && B.nightFloor(mid, base, 'low').hemi < nm.hemi);
t('stars + neon kept', nm.stars === mid.stars && nm.neon === mid.neon && nm.top === mid.top);
// static: hook, plain imports, no edits to time.js
const idx = fs.readFileSync(R + 'index.html', 'utf8'), v = idx.match(/sw\.js\?v=([0-9.]+)/)[1];
const hooks = idx.match(/<script type="module" src="\.\/brightness\.js[^"]*"><\/script>/g) || [];
t('one hook at main ?v', hooks.length === 1 && hooks[0].includes('?v=' + v));
t('hook after gravity.js', idx.indexOf('src="./brightness.js') > idx.indexOf('src="./mars/gravity.js'));
t('importmap entries', idx.includes(`"./brightnesscore.js": "./brightnesscore.js?v=${v}"`));
const rt = fs.readFileSync(R + 'brightness.js', 'utf8');
t('plain imports', !/(from|import\()\s*['"][^'"]+\?v=/.test(rt) && /from '\.\/brightnesscore\.js'/.test(rt));
t('registerMenuItem onTap', /registerMenuItem\(\{ id: 'brightMenuBtn'[^}]*onTap/.test(rt));
t('pointer events', /pointerup/.test(rt) && /pointerdown/.test(rt));
t('localStorage key', /localStorage\.setItem\(B\.SAVE_KEY/.test(rt) && B.SAVE_KEY === 'ssx.bright.v1');
t('uses addLookFilter', /addLookFilter/.test(rt));
t('restores after render', /finally\s*\{[^}]*toneMappingExposure = e0/.test(rt));
t('sw precache', /`brightness\.js\$\{q\}`, `brightnesscore\.js\$\{q\}`/.test(fs.readFileSync(R + 'sw.js', 'utf8')));
console.log(fails ? `${fails}/${n} FAIL` : `brightness unit: ${n} passed`);
process.exit(fails ? 1 : 0);
