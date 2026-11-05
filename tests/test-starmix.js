// v7.5.46 stars mix (Collin): a Ghost Sled doubles stars earned while driving (+100%), flex trickle, back on foot = no bonus,
// Empire front collect pays 1 ⭐ per 10 cr. BASE=http://localhost:8765/ BR=chromium DEV="iPhone 14" node tests/test-starmix.js
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'iPhone 14';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...dev } = DEV === 'desktop' ? { viewport: { width: 1366, height: 768 } } : pw.devices[DEV];
  const ctx = await browser.newContext(dev); const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), R = { tag: `${DEV}-${BR}` }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const SAVE = { v: 1, xp: 5000, credits: 50000, badges: ['first'], quests: {}, equip: { paint: 'steel' }, unlocks: [], inv: { medkits: 1 }, flags: [] };
  await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
  await G(s => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"done":true,"skipped":true}'); localStorage.setItem('ssx.progress.v1', JSON.stringify(s)); }, SAVE);
  await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
  ok('api', await wait(() => !!window.SSX?.rideStars && !!window.SSX?.garage, 20000));
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(800);
  await G(() => { window.__app.surface.game.setAliens?.(false); (window.SSX_TICKS ||= []).push((dt, tc) => { window.__tc = tc; }); document.getElementById('radioLater')?.click(); }); await frames(3);
  ok('granted', await G(() => window.SSX.garage.grantVehicle('ghost_sled').ok));
  await G(() => window.__app.surface.summonRover()); await sleep(1500); await G(() => window.__app.surface.interact()); await sleep(500);
  if (!(await G(() => window.__app.surface.info.driving))) { await G(() => { const i = window.__app.surface.info, p = window.__tc.player; p.x = i.roverX + 2; p.z = i.roverZ + 1.5; }); await frames(3); await G(() => window.__app.surface.interact()); await sleep(500); }
  ok('driving', await wait(() => window.__app.surface.info.driving, 5000)); await frames(10);
  R.ride = await G(() => window.SSX.rideStars.ride); ok('ridePct', R.ride, R.ride?.kind === 'ghost_sled' && R.ride.pct === 100);
  const xp = () => G(() => window.__app.surface.game.progress.xp);
  let x0 = await xp(); await G(() => window.__app.surface.game.reward(30, 0)); await frames(5);
  ok('driveBonus', (await xp()) - x0, (await xp()) - x0 === 60);
  await sleep(2600); R.toast = await G(() => document.getElementById('toast')?.textContent || ''); 
  // flex: a fake tick at cruising speed in the same ride
  x0 = await xp(); await G(() => { const tc = window.__tc, f = { ...tc, car: Object.assign(Object.create(tc.car), { speed: 20 }), rover: null }; f.rover = f.car; f.car.__dlrKind = 'ghost_sled'; for (let i = 0; i < 16; i++) window.SSX.rideStars.tick(1, f); });
  R.flex = await G(() => window.SSX.rideStars.flex); ok('flex', R.flex, R.flex.n === 1 && (await xp()) - x0 === 1);
  // on foot, past the grace window: no bonus
  await G(() => window.__app.surface.interact()); await sleep(500); ok('onFoot', !(await G(() => window.__app.surface.info.driving)));
  await sleep(3500); x0 = await xp(); await G(() => window.__app.surface.game.reward(30, 0)); await frames(5);
  ok('footNoBonus', (await xp()) - x0, (await xp()) - x0 === 30);
  // Empire front: collect pays stars
  await G(() => { window.SSX.empire.debug.grant('fr-wash'); window.SSX.empire.debug.tick(6, 12); }); await frames(3);
  x0 = await xp(); const col = await G(() => window.SSX.empire.collect('fr-wash', { force: true })); await frames(5);
  R.collect = { ...col, dxp: (await xp()) - x0 }; ok('frontStars', R.collect, col.ok && col.stars === Math.floor(col.amount / 10) && R.collect.dxp === col.stars && col.stars > 0);
  ok('noErrors', errors.length ? errors : true, !errors.length);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS'); await browser.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
