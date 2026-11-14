// v7.5.110 back-room deal. BASE=http://127.0.0.1:8765/ node tests/test-backroom.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const dev = (({ defaultBrowserType, ...o }) => o)(pw.devices['iPhone 14']);
  const page = await (await browser.newContext(dev)).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL/i.test(m.text())) errors.push('C ' + m.text()); });
  const G = f => page.evaluate(f), bad = [];
  const ok = (k, v) => { if (!v) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.111');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(800);
    ok('api', await wait(() => window.SSX.backroom && window.SSX.contraband, 20000));
    ok('door', await wait(() => window.__app.surface.world.doorList().some(d => d.kind === 'club'), 15000));
    const entered = await G(() => {
      window.__app.game.progress.credits = 1000;
      window.__app.surface.world.setWanted(0);
      const d = window.__app.surface.world.doorList().find(x => x.kind === 'club');
      window.__app.surface.debugPlace(d.x, d.z + 0.4, Math.PI);
      const r = window.__app.surface.enterBuilding();
      return { door: { x: d.x, z: d.z }, r: r === undefined ? 'undefined' : JSON.stringify(r)?.slice(0, 80), near: window.__app.surface.info?.door?.name || '' };
    });
    await sleep(500);
    ok('inside', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));
    await G(() => window.__app.surface.debugInside(2.4, 11.2, 0));
    await sleep(400);
    ok('booth', await G(() => window.__app.surface.info.spot?.id === 'backbooth'));
    const deal = await G(() => {
      window.SSX.contraband.add('glowdust', 1);
      window.SSX.backroom.debug.setPack('glowcap', 1);
      window.SSX.backroom.open();
      const card = document.getElementById('dealCard');
      const text = card?.innerText || '';
      const btns = [...card.querySelectorAll('button')].map(b => b.getBoundingClientRect().height);
      return { text, tall: btns.every(h => h >= 48), on: card.classList.contains('on') };
    });
    ok('steps', deal.on && /Pick a price/.test(deal.text) && /Low/.test(deal.text) && /Greedy/.test(deal.text) && deal.tall);
    const fx = await G(() => {
      window.SSX.backroom.debug.setPack('iondust', 1);
      window.SSX.backroom.debug.use('iondust');
      const h = document.getElementById('fxHud');
      const r = h.getBoundingClientRect();
      return { on: h.classList.contains('on'), text: h.textContent, band: r.bottom < innerHeight * 0.28 && r.top > 0 };
    });
    ok('timer', fx.on && /Ion Dust/.test(fx.text) && fx.band);
    ok('console', errors.length === 0);
    if (errors.length) console.log(errors.slice(0, 6));
    console.log(JSON.stringify({ bad, deal: deal.text.slice(0, 180), fx }, null, 2));
  } catch (e) { console.log('CRASH', String(e).slice(0, 300)); bad.push('crash'); }
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
