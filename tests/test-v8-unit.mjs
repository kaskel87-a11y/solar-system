// v8 look core (look/v8core.js): tiers, device class, tier pick, governor, grades, post params, helpers. node tests/test-v8-unit.mjs
import * as K from '../look/v8core.js';
let fails = 0; const t = (name, cond) => { if (!cond) { fails++; console.log('FAIL', name); } };
t('order', K.ORDER.join() === 'low,med,high,ultra');
for (const n of K.ORDER) { const T = K.TIERS[n]; t('tier ' + n, T && T.pixelRatio > 0 && T.shadow >= 0 && T.shadowRange >= 0 && typeof T.post === 'boolean'); }
t('tiers rise', K.ORDER.every((n, i) => !i || (K.TIERS[n].shadow >= K.TIERS[K.ORDER[i - 1]].shadow && K.TIERS[n].pixelRatio >= K.TIERS[K.ORDER[i - 1]].pixelRatio)));
t('ao ultra only', K.ORDER.filter(n => K.TIERS[n].ao).join() === 'ultra');
t('low/med no post', !K.TIERS.low.post && !K.TIERS.med.post && K.TIERS.high.post && !K.TIERS.med.bloomScale);
t('med phone budget', K.TIERS.med.pixelRatio <= 1.5 && K.TIERS.med.shadow <= 1024 && K.TIERS.med.shadowEvery >= 2 && !K.TIERS.med.shadowSoft && K.TIERS.med.detail === 1 && !K.TIERS.med.msaa);
{ const d = K.dynres({ cap: 1.5, floor: 0.75 }); let pr = 1.5, t0 = 0; for (let i = 0; i < 300; i++) { t0 += 33; const r = d.step(33, t0, pr); if (r != null) pr = r; }
  t('dynres drops to floor', pr === 0.75 && d.atFloor(pr));
  for (let i = 0; i < 2000; i++) { t0 += 16.7; const r = d.step(16.7, t0, pr); if (r != null) pr = r; }
  t('dynres recovers to cap', pr === 1.5);
  const e = K.dynres({ cap: 1.5 }); let q = 1.5, t1 = 0; for (let i = 0; i < 600; i++) { t1 += 16.7; const r = e.step(16.7, t1, q); if (r != null) q = r; }
  t('dynres holds at 60', q === 1.5 && e.st.drops === 0);
  const f = K.dynres({ cap: 1.5 }); t('dynres clamps to cap', f.step(16, 0, 2) === 1.5); }
t('frozen', Object.isFrozen(K.TIERS.med));
const iph = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
t('phone', K.deviceClass({ ua: iph, touch: true, w: 390, h: 844 }) === 'phone');
t('android phone', K.deviceClass({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari', touch: true, w: 412, h: 915 }) === 'phone');
t('ipad mid', K.deviceClass({ ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', touch: true, w: 820, h: 1180 }) === 'mid');
t('desktop', K.deviceClass({ ua: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130', gpu: 'NVIDIA GeForce RTX 3060', mem: 8, cores: 12 }) === 'desktop');
t('software gpu mid', K.deviceClass({ ua: 'Chrome', gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))' }) === 'mid');
t('phone default med', K.pickTier({ cls: 'phone' }).tier === 'med' && K.pickTier({ cls: 'phone' }).auto);
t('desktop default high', K.pickTier({ cls: 'desktop' }).tier === 'high');
t('param wins', K.pickTier({ param: 'ultra', saved: { tier: 'low' }, cls: 'phone' }).tier === 'ultra');
t('param classic', K.pickTier({ param: 'classic' }).tier === 'classic');
t('bad param ignored', K.pickTier({ param: 'bogus', cls: 'phone' }).tier === 'med');
t('saved pick', K.pickTier({ saved: { tier: 'low', auto: false }, cls: 'desktop' }).tier === 'low');
t('saved auto ignored', K.pickTier({ saved: { tier: 'low', auto: true }, cls: 'desktop' }).tier === 'high');
t('param auto beats saved', K.pickTier({ param: 'auto', saved: { tier: 'low', auto: false }, cls: 'phone' }).tier === 'med');
t('stepDown', K.stepDown('ultra') === 'high' && K.stepDown('med') === 'low' && K.stepDown('low') === 'low');
const g = K.governor({ floor: 24, need: 2 });
t('gov ok', g.sample(50, 'high') === null && g.sample(20, 'high') === null && g.sample(20, 'high') === 'med' && g.bad === 0);
t('gov reset on good', (g.sample(20, 'med'), g.sample(40, 'med'), g.sample(20, 'med')) === null);
t('gov low floor', (g.reset(), g.sample(5, 'low'), g.sample(5, 'low')) === null);
t('gov classic', g.sample(1, 'classic') === null);
t('grade mars', K.gradeFor('Mars')[0] === 1.10 && K.gradeFor('Mars', 'club') === K.GRADES.club && K.gradeFor('Pluto') === K.GRADES.default);
const d = K.postParams(0), n = K.postParams(1), i = K.postParams(0, true);
t('post day/night', d.strength === 0.45 && d.threshold === 1.2 && n.strength === 0.8 && n.threshold === 1.0 && i.vignette === 0.4 && i.strength === 0.8);
t('night from sun', K.nightFromSun(0.8) === 0 && K.nightFromSun(-0.3) === 1 && K.nightFromSun(0.01) > 0.3);
t('sig', K.sigChanged(null, [1]) && !K.sigChanged([1, 2], [1.01, 2]) && K.sigChanged([1, 2], [1.1, 2]));
const [su, sv] = K.snapTexel(10.03, -3.3, 34, 1024), tx = 68 / 1024;
t('snap', Math.abs(su / tx - Math.round(su / tx)) < 1e-9 && Math.abs(su - 10.03) <= tx / 2 + 1e-9 && Math.abs(sv + 3.3) <= tx / 2 + 1e-9);
t('detail concrete', K.detailSetFor({ metalness: 0.1, maxRadius: 6 }) === 'concrete');
t('detail metal', K.detailSetFor({ metalness: 0.6, maxRadius: 6 }) === 'metal_panels');
t('detail small none', K.detailSetFor({ metalness: 0.1, maxRadius: 0.8 }) === null);
t('detail textured none', K.detailSetFor({ hasMap: true, maxRadius: 6 }) === null && K.detailSetFor({ skinned: true, maxRadius: 6 }) === null && K.detailSetFor({ transparent: true, maxRadius: 6 }) === null && K.detailSetFor({ emissive: 1, maxRadius: 6 }) === null);
t('dust', K.dustFor('Mars') === 0xa8583a && K.dustFor('Nowhere') === K.DUST.default && K.weatherAmount('Mars', true) === 0.5 && K.weatherAmount('Mars', false) < 0.5);
t('rig', K.RIG.hemi < 1 && K.RIG.sun >= 1 && K.RIG.envIndoor < K.RIG.env);
console.log(fails ? `v8 unit: ${fails} FAIL` : 'v8 unit: all PASS');
process.exit(fails ? 1 : 0);
