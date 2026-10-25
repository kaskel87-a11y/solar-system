// v7.2 GTA-style third-person camera: eases back behind you on foot, in your rover, in a stolen ride and while flying.
// Manual drag-orbit holds until ~1.5 s after the last drag (or until you move); pinch-zoom distance is kept.
// BASE=http://localhost:8765/ DEV="iPhone 14" BR=webkit node test-cam.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/workspace/solar-system/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const strip = d => { const { defaultBrowserType, ...o } = d; return o; };
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const ctx = await browser.newContext(strip(devices[DEV])); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const tag = `${DEV}-${BR}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const R = { tag }, fails = [];
  const ok = (k, v, pass = v) => { R[k] = v; if (!pass) fails.push(k); };
  const G = (f, a) => page.evaluate(f, a);
  const wait = (f, ms, a) => page.waitForFunction(f, a, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  const I = () => G(() => window.__app.surface.info);
  const ad = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const behindFoot = 'const i = window.__app.surface.info; return Math.abs(Math.atan2(Math.sin(i.faceYaw - i.viewYaw), Math.cos(i.faceYaw - i.viewYaw)))';
  const behindCar = 'const i = window.__app.surface.info; return Math.abs(Math.atan2(Math.sin(i.carYaw - i.viewYaw), Math.cos(i.carYaw - i.viewYaw)))';
  const gap = src => G(new Function(src));
  const waitGap = (src, lt, ms) => wait(new Function(src.replace('return ', 'return (') + ') < ' + lt), ms);
  const shot = s => page.screenshot({ path: `${out}v72cam-${tag}-${s}.png` });
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.removeItem('ssx.progress.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800);
    await G(() => { const g = window.__app.game; g.setAliens(false); g.debug.clear(); const s = window.__app.surface, c = s.world.colony; s.debugMove(c.x + 160, c.z + 170, 0); });
    await sleep(600);
    ok('thirdPerson', (await I()).camDist, (await I()).camDist > 0.8);
    // ---------- on foot: walk right -> you turn to face it, the camera swings round behind you ----------
    const y0 = (await I()).viewYaw;
    await G(() => { window.__app.joy.x = 1; window.__app.joy.y = 0; });
    await sleep(600);
    const fTurn = await I();
    ok('footFacesMove', +ad(fTurn.faceYaw, y0).toFixed(2), ad(fTurn.faceYaw, y0) > 1.0);
    ok('footCamFollowsWhileWalking', +ad((await I()).viewYaw, y0).toFixed(2), ad((await I()).viewYaw, y0) > 0.2);
    await G(() => { window.__app.joy.x = 0; });
    const fStop = await I();
    const settled = await waitGap(behindFoot, 0.15, 8000);
    ok('footCamBehindAfterTurn', +(await gap(behindFoot)).toFixed(2), settled);
    ok('footCamTurned', +ad((await I()).viewYaw, y0).toFixed(2), ad((await I()).viewYaw, y0) > 0.8 && ad((await I()).faceYaw, fStop.faceYaw) < 0.05);
    await sleep(200);
    await shot('foot-behind');
    // ---------- manual orbit holds, then eases back behind after ~1.5 s idle; zoom distance kept ----------
    await G(() => window.__app.surface.zoom(1.5)); await sleep(1200);
    const dist0 = (await I()).camDist;
    await G(() => { for (let n = 0; n < 10; n++) window.__app.surface.look(-30, 0, 0.005); });
    await sleep(150);
    const orbit0 = await gap(behindFoot);
    await sleep(700);
    const orbitHeld = await gap(behindFoot);
    ok('orbitWorks', +orbit0.toFixed(2), orbit0 > 1.0);
    ok('orbitHoldsBriefly', +orbitHeld.toFixed(2), orbitHeld > 0.7);
    await shot('foot-orbit');
    const back = await waitGap(behindFoot, 0.15, 8000);
    ok('orbitEasesBack', +(await gap(behindFoot)).toFixed(2), back);
    ok('zoomKept', `${dist0.toFixed(2)} → ${(await I()).camDist.toFixed(2)}`, Math.abs((await I()).camDist - dist0) < 0.05 && dist0 > 10);
    // orbit, then start walking: it eases back right away (well before 1.5 s)
    await G(() => { for (let n = 0; n < 10; n++) window.__app.surface.look(30, 0, 0.005); }); await sleep(150);
    await G(() => { window.__app.joy.y = -1; });
    const t0 = Date.now(); const backMove = await waitGap(behindFoot, 0.3, 8000);
    ok('orbitEasesBackOnMove', `${backMove} in ${((Date.now() - t0) / 1000).toFixed(1)} s wall`, backMove);
    await G(() => { window.__app.joy.y = 0; }); await sleep(300);
    await G(() => window.__app.surface.zoom(1 / 1.5)); await sleep(800);
    // ---------- own rover: steer a curve, the chase cam stays behind; orbit while parked eases back ----------
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); s.interact(); });
    ok('inRover', await wait(() => window.__app.surface.info.driving && !window.__app.surface.info.stolen, 6000));
    await sleep(500);
    await G(() => { window.__app.joy.y = -1; window.__app.joy.x = 0.8; }); await sleep(2500);
    await G(() => { window.__app.joy.x = 0; });
    ok('roverCamBehind', null, await waitGap(behindCar, 0.2, 8000));
    await G(() => { window.__app.joy.y = 0; window.__app.touchBtns.brake = true; }); await sleep(1500); await G(() => { window.__app.touchBtns.brake = false; });
    await G(() => { for (let n = 0; n < 10; n++) window.__app.surface.look(-30, 0, 0.005); }); await sleep(150);
    ok('roverOrbit', +(await gap(behindCar)).toFixed(2), (await gap(behindCar)) > 1.0);
    ok('roverOrbitEasesBack', null, await waitGap(behindCar, 0.15, 8000));
    // ---------- flying: thrust + turn, the cam swings after the heading ----------
    await G(() => { window.__app.touchBtns.jump = true; window.__app.joy.x = -1; window.__app.joy.y = -0.3; });
    await wait(() => window.__app.surface.info.carAir && window.__app.surface.info.carAlt > 4, 15000); await sleep(1500);
    await G(() => { window.__app.joy.x = 0; });
    const flyBehind = await waitGap(behindCar, 0.25, 6000);
    ok('flyingCamBehind', +(await gap(behindCar)).toFixed(2), flyBehind && (await I()).carAir);
    await shot('flying-behind');
    await G(() => { window.__app.touchBtns.jump = false; window.__app.joy.y = 0; });
    await wait(() => !window.__app.surface.info.carAir, 20000); await sleep(800);
    await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 5000);
    // ---------- stolen ride ----------
    const v = await G(() => window.__app.surface.world.debug.vehicles().find(v => v.kind === 'buggy' && v.parked) || window.__app.surface.world.debug.vehicles().find(v => v.parked && v.kind !== 'shuttle'));
    await G(v => { window.__app.surface.world.setWanted(0); window.__app.surface.debugMove(v.x + 3.4, v.z + 1.2, 1.2); }, v);
    await wait(() => /Take/.test(document.getElementById('driveBtn').textContent), 8000);
    await G(() => window.__app.surface.interact());
    ok('inStolen', await wait(() => window.__app.surface.info.driving && window.__app.surface.info.stolen, 6000));
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.joy.y = -1; window.__app.joy.x = -0.8; }); await sleep(2500);
    await G(() => { window.__app.joy.x = 0; });
    ok('stolenCamBehind', +(await gap(behindCar)).toFixed(2), await waitGap(behindCar, 0.2, 8000));
    await G(() => { for (let n = 0; n < 10; n++) window.__app.surface.look(30, 0, 0.005); }); await sleep(150);
    ok('stolenOrbitEasesBackWhileMoving', null, await waitGap(behindCar, 0.2, 6000));
    await shot('stolen-behind');
    await G(() => { window.__app.joy.y = 0; });
  } catch (e) { errors.push('TEST: ' + e.message); }
  R.errors = errors.filter(e => !/ResizeObserver/.test(e));
  if (R.errors.length) fails.push('errors');
  console.log(JSON.stringify(R, null, 1)); console.log(fails.length ? 'FAIL ' + fails.join(', ') : 'PASS');
  await browser.close(); process.exit(fails.length ? 1 : 0);
})();
