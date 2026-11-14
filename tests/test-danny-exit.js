// v7.5.112 leaving Danny's room after the dance. BASE=http://127.0.0.1:8765/ node tests/test-danny-exit.js
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
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.112');
    await G(() => { localStorage.setItem('ssx.adult', '1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(400);
    await G(() => { window.__app.game.progress.credits = 5000; window.__app.surface.world.setWanted(0); });
    ok('door', await wait(() => window.__app.surface.world.doorList().some(d => d.kind === 'club'), 15000));
    await G(() => { const d = window.__app.surface.world.doorList().find(x => x.kind === 'club'); window.__app.surface.debugPlace(d.x, d.z + 0.4, Math.PI); window.__app.surface.enterBuilding(); });
    ok('inside', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));
    await G(() => window.__app.surface.debugInside(-29.4, -5.2, 0));
    await sleep(200);
    await G(() => window.__pshow.start('show'));
    ok('locked', await wait(() => document.body.classList.contains('pshow') && window.__pshow.active, 8000));
    const snapped = await G(async () => {
      const i0 = window.__app.surface.info, b = i0.inside;
      const x = i0.x - b.ax, z = i0.z - b.az;
      window.__app.surface.debugInside(x + 1.4, z, 0);
      await new Promise(r => setTimeout(r, 350));
      const i = window.__app.surface.info;
      return Math.hypot(i.x - b.ax - x, i.z - b.az - z) < 0.4;
    });
    ok('pinnedDuring', snapped);
    await G(() => window.__pshow.end('leave'));
    ok('ended', await wait(() => !window.__pshow.active && !document.body.classList.contains('pshow'), 6000));
    await sleep(300);
    const free = await G(() => {
      const joy = document.getElementById('joy');
      const btn = document.getElementById('dannyLeave');
      const i = window.__app.surface.info, b = i.inside;
      const r = btn.getBoundingClientRect();
      return {
        joy: getComputedStyle(joy).visibility !== 'hidden',
        hud: getComputedStyle(document.getElementById('surfHud')).visibility !== 'hidden',
        btn: btn.classList.contains('on') && r.height >= 48 && r.width >= 160,
        text: btn.textContent,
        lx: +(i.x - b.ax).toFixed(2), lz: +(i.z - b.az).toFixed(2), yaw: i.viewYaw
      };
    });
    ok('unlocked', free.joy && free.hud && !free.text.includes('undefined'));
    ok('leaveBtn', free.btn && free.text === 'Leave room');
    ok('facingDoor', Math.abs(free.lx - (-28.2)) < 0.4 && Math.abs(free.lz - (-4.65)) < 0.4);
    const stayed = await G(() => {
      window.__app.surface.debugInside(-27.4, -4.65, -Math.PI / 2);
      return true;
    });
    await sleep(400);
    const held = await G(() => {
      const i = window.__app.surface.info, b = i.inside;
      return Math.hypot(i.x - b.ax - (-27.4), i.z - b.az - (-4.65)) < 0.5;
    });
    ok('staysPut', stayed && held);
    await page.screenshot({ path: '/opt/cursor/artifacts/danny-leave-iphone.png' });
    await G(() => document.getElementById('dannyLeave').click());
    await sleep(250);
    const out = await G(() => {
      const i = window.__app.surface.info, b = i.inside;
      const btn = document.getElementById('dannyLeave');
      return { lx: i.x - b.ax, lz: i.z - b.az, on: btn.classList.contains('on'), joy: getComputedStyle(document.getElementById('joy')).visibility !== 'hidden' };
    });
    ok('onTheFloor', Math.hypot(out.lx - (-8.6), out.lz - (-5.5)) < 1.2 && !out.on && out.joy);
    ok('console', errors.length === 0);
    if (errors.length) console.log(errors.slice(0, 5));
  } catch (e) { console.log('CRASH', String(e).slice(0, 400)); bad.push('crash'); }
  console.log(bad.length ? 'FAILED ' + bad.join(', ') : 'all good');
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
