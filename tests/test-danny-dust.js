// v7.5.113 Ion Dust table in Danny's room. BASE=http://127.0.0.1:8765/ node tests/test-danny-dust.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const dev = (({ defaultBrowserType, ...o }) => o)(pw.devices['iPhone 14']);
  const page = await (await browser.newContext(dev)).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL|404/i.test(m.text())) errors.push('C ' + m.text()); });
  const G = f => page.evaluate(f), bad = [];
  const ok = (k, v) => { if (!v) bad.push(k); console.log(v ? 'ok  ' : 'FAIL', k); };
  const wait = async (f, ms = 20000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.113');
    await G(() => { localStorage.setItem('ssx.adult', '1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(300);
    await G(() => { window.__app.game.progress.credits = 5000; window.__app.surface.world.setWanted(0); window.SSX.backroom?.debug?.quiet?.(); });
    ok('door', await wait(() => window.__app.surface.world.doorList().some(d => d.kind === 'club'), 15000));
    await G(() => { const d = window.__app.surface.world.doorList().find(x => x.kind === 'club'); window.__app.surface.debugPlace(d.x, d.z + 0.4, Math.PI); window.__app.surface.enterBuilding(); });
    ok('inside', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));
    await G(() => window.__app.surface.debugInside(-30.8, -4.9, -Math.PI / 2));
    await sleep(500);
    const buyLabel = await G(() => window.__app.surface.info.spot?.label || '');
    ok('buyOffer', /Buy Ion Dust/.test(buyLabel));
    const bought = await G(() => {
      const c0 = window.__app.surface.game.progress.credits;
      const r = window.__app.surface.world.nearSpot()?.run?.();
      const fx = document.getElementById('fxHud')?.textContent || '';
      return { ok: !!r?.ok, spent: c0 - window.__app.surface.game.progress.credits, fx, kind: window.SSX.backroom.buff()?.kind || '' };
    });
    ok('bought', bought.ok && bought.spent === 200 && bought.kind === 'rush' && /Ion Dust/.test(bought.fx));
    await G(() => window.SSX.backroom.debug.setPack('iondust', 1));
    await sleep(450);
    const useLabel = await G(() => window.__app.surface.info.spot?.label || '');
    ok('useOffer', useLabel === '⚡ Use Ion Dust');
    const used = await G(() => {
      const c0 = window.__app.surface.game.progress.credits;
      const r = window.__app.surface.world.nearSpot()?.run?.();
      return { ok: !!r?.ok, spent: c0 - window.__app.surface.game.progress.credits, left: window.SSX.backroom.state().pack.iondust | 0 };
    });
    ok('usedOwn', used.ok && used.spent === 0 && used.left === 0);
    await G(() => window.__app.surface.debugInside(-30.2, -4.9, Math.PI / 2, -0.2));
    await sleep(500);
    await page.screenshot({ path: '/opt/cursor/artifacts/danny-dust-iphone.png' });
    await G(() => { window.SSX.dannyRoom.afterShow(); });
    await sleep(200);
    const leave = await G(() => {
      const b = document.getElementById('dannyLeave');
      const r = b.getBoundingClientRect();
      b.click();
      const i = window.__app.surface.info, room = i.inside;
      return { shown: r.height >= 48, lx: i.x - room.ax, lz: i.z - room.az, on: b.classList.contains('on') };
    });
    ok('leaveStillWorks', leave.shown && !leave.on && Math.hypot(leave.lx + 8.6, leave.lz + 5.5) < 1.2);
    ok('console', errors.length === 0);
    if (errors.length) console.log(errors.slice(0, 4));
  } catch (e) { console.log('CRASH', String(e).slice(0, 400)); bad.push('crash'); }
  console.log(bad.length ? 'FAILED ' + bad.join(', ') : 'all good');
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
