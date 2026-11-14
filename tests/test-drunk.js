// v7.5.109 drunk walk. BASE=http://127.0.0.1:8765/ node tests/test-drunk.js
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
  const G = (f, a) => page.evaluate(f, a), bad = [];
  const ok = (k, v) => { if (!v) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.110');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(400);
    ok('api', await wait(() => window.SSX?.bar?.sip, 20000));
    const meter = await G(() => {
      window.SSX.onboard?.skip?.();
      const ob = document.getElementById('obLine'); if (ob) ob.style.display = 'none';
      const radio = document.getElementById('radio'); if (radio) radio.style.display = 'none';
      const before = window.SSX.bar.level;
      window.SSX.bar.sip(2.2);
      const stacked = window.SSX.bar.sip(1.6);
      const h = document.getElementById('drunkHud');
      const r = h.getBoundingClientRect();
      const fx = window.SSX.bar.fx();
      const shot = { before, stacked, on: h.classList.contains('on'), label: h.innerText, top: r.top, h: r.height, band: r.bottom < innerHeight * 0.28, blur: fx.blurPx, aim: fx.aim, stage: window.SSX.bar.stage };
      return shot;
    });
    ok('stacks', meter.stacked > meter.before && meter.stage === 'drunk');
    ok('meter', meter.on && /drunk|tipsy|heavy/.test(meter.label) && meter.h > 8 && meter.band);
    ok('scales', meter.blur > 0 && meter.aim > 0);
    await page.screenshot({ path: '/opt/cursor/artifacts/drunk-iphone.png' });
    const cleared = await G(() => window.SSX.bar.sober(3));
    ok('clears', cleared < meter.stacked);
    ok('console', errors.length === 0);
    if (errors.length) console.log(errors.slice(0, 6));
    console.log(JSON.stringify({ bad, meter }, null, 2));
  } catch (e) { console.log('CRASH', e); bad.push('crash'); }
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
