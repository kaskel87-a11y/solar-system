// v7.5.102 crop beds. BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" OUT=/opt/cursor/artifacts/ node tests/test-crops.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const desk = DEV === 'desktop';
const out = (process.env.OUT || '/tmp/crops/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = desk ? { viewport: { width: 1280, height: 800 } } : (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone 14']);
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL/i.test(m.text())) errors.push('C ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = f => page.evaluate(f), R = { tag }, bad = [];
  const ok = (k, v) => { R[k] = v; if (!v) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.112');
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(600);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.());
    const planted = await page.evaluate(async () => {
      const F = window.SSX.farm, g = window.__app.game;
      g.debug?.calm?.(true); g.progress.credits = 20000; g.save();
      window.__app.surface.world.setWanted(0);
      F.debug.reset();
      F.debug.goto('farm');
      const buy = F.buy(), dome = F.buildDome();
      const racks = [];
      const wait = ms => new Promise(res => setTimeout(res, ms));
      for (let i = 0; i < 4; i++) { racks.push(F.addRack()); await wait(350); }
      window.__rackMsgs = racks.map(r => r.msg || r.why || '');
      const crops = ['potato', 'algae', 'glowberry', 'lichen'];
      const plants = crops.map((c, i) => F.plant(i, c));
      const grow = [0.1, 0.4, 0.7, 1].map((n, i) => F.debug.grow(i, n));
      const seen = {};
      let ready = 0, fruit = 0, leaves = 0, boxes = 0;
      const root = window.__app.surface.scene;
      root.traverse(o => {
        if (o.name === 'farm-crop') seen[o.userData.stage] = (seen[o.userData.stage] || 0) + 1;
        if (o.name === 'farm-ready') ready++;
        if (o.name === 'farm-fruit') fruit++;
        if (o.name === 'farm-leaves') leaves++;
      });
      const save = JSON.parse(localStorage.getItem('ssx.farm.v1') || '{}');
      return { buy: buy.ok, dome: dome.ok, racks: racks.map(r => r.ok), rackMsg: window.__rackMsgs, plants: plants.map(r => r.ok), grow, seen, ready, fruit, leaves, boxes, saved: (save.racks || []).map(r => ({ c: r.crop, g: r.growth })), spots: window.SSX.farm.rackSpots().map(p => ({ x: Math.round(p.x), z: Math.round(p.z), c: p.crop })) };
    });
    R.planted = planted;
    ok('bought', planted.buy && planted.dome && planted.racks.every(Boolean) && planted.plants.every(Boolean));
    ok('stages', planted.seen.seedling === 1 && planted.seen.leafy === 1 && planted.seen.mature === 1 && planted.seen.ready === 1);
    ok('cue', planted.ready >= 1 && planted.fruit >= 2 && planted.leaves === 4);
    ok('saved', planted.saved.length === 4 && planted.saved[3].c === 'lichen' && planted.saved[3].g === 1 && planted.saved[0].g === 0.1);
    await G(() => {
      window.__app.surface.setView('first');
      const spots = window.SSX.farm.rackSpots();
      const z0 = spots[0].z, x1 = Math.max(...spots.map(p => p.x));
      const x = x1 + 5.4, z = z0 + 3.6;
      const cx = spots.reduce((a, p) => a + p.x, 0) / spots.length;
      window.__app.surface.debugMove(x, z, Math.atan2(-(cx - x), -(z0 - z)), -0.32);
      const st = document.createElement('style');
      st.textContent = '#toast,#radio,#obLine,#ssxGuide,.ssxBark,#farmGuide,#farmAct,#farmPanel,#surfHelp{display:none!important}';
      document.head.appendChild(st);
    });
    await sleep(700);
    await page.screenshot({ path: out + `farm-${tag}.png` });
    ok('console', errors.length === 0);
    if (errors.length) R.errors = errors.slice(0, 8);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 500); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
