// Red Line walk-in hangar: dome first, then 100,000 cr. Exterior, cars on the floor, price prompt.
// BASE=http://127.0.0.1:8771/ node tests/test-hangar.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771/';
const out = (process.env.OUT || '/opt/cursor/artifacts/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const phone = pw.devices['iPhone SE'] || pw.devices['iPhone 14'];
  const ctx = await browser.newContext({ ...phone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 180)); });
  page.on('console', m => { if (m.type() === 'error' && !/audio|WebGL|favicon|net::/i.test(m.text())) errors.push('C ' + m.text().slice(0, 180)); });
  const G = (f, a) => page.evaluate(f, a);
  const R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = typeof v === 'string' ? v.slice(0, 160) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 90000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading')));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.140');
    await G(() => { window.__app.game.progress.credits = 250000; window.__app.game.save(); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && !!window.__dealer?.spots));
    await G(() => { const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission'); } });
    ok('needsDome', await G(() => window.__dealer.buyHangar()), (await G(() => window.__dealer.buyHangar())).ok === false);
    await G(() => { window.__app.game.progress.credits = 250000; window.__app.game.progress.xp = 2000; window.__app.game.save(); });
    const dome = await G(() => window.__dealer.buyDome('cr'));
    ok('dome', dome, dome && dome.ok);
    await G(() => { const b = window.__dealer.hangar.buy; window.__app.surface.debugMove(b.x, b.z, 0); });
    await sleep(800);
    ok('buyBtn', await wait(() => /100,000/.test(document.getElementById('dlrCtxBtn')?.textContent || '') && /hangar/i.test(document.getElementById('dlrCtxBtn')?.textContent || ''), 8000));
    const h = await G(() => document.getElementById('dlrCtxBtn').getBoundingClientRect().height);
    ok('buyTall', h, h >= 44);
    await G(() => window.__dealer.press('#dlrCtxBtn'));
    await sleep(400);
    ok('bought', await G(() => window.__dealer.hangar.on && window.__dealer.hangar.visible && window.__dealer.hangar.dome === false));
    ok('paid', await G(() => window.__app.game.progress.credits), (await G(() => window.__app.game.progress.credits)) <= 250000 - 100000 + 9000);
    await G(() => { for (const id of ['radio', 'ssxGuide', 'toast', 'stackR']) { const e = document.getElementById(id); if (e) e.style.setProperty('display', 'none', 'important'); } document.querySelectorAll('button').forEach(b => { if ((b.textContent || '').trim() === 'More') b.style.display = 'none'; }); });
    await G(() => {
      const b = window.__dealer.hangar.buy, p = window.__dealer.spots.dealer;
      window.__wide = (dt, c) => { const y = c.height(b.x, b.z); c.camera.position.set(b.x - 6, y + 4.5, b.z + 34); c.camera.lookAt(p.x - 16, y + 6, p.z - 2); };
      window.SSX_TICKS.push((dt, c) => window.__wide?.(dt, c));
    });
    await sleep(700);
    await page.screenshot({ path: out + 'iphone_hangar_exterior_390.png' });
    await G(() => {
      const b = window.__dealer.hangar.buy, p = window.__dealer.spots.dealer;
      window.__wide = (dt, c) => { const y = c.height(p.x, p.z); c.camera.position.set(b.x - 2, y + 3.6, b.z - 2); c.camera.lookAt(p.x - 24, y + 1.3, p.z - 4); };
    });
    await sleep(500);
    await page.screenshot({ path: out + 'iphone_hangar_inside_390.png' });
    await G(() => { window.__wide = null; });
    const inside = await G(() => window.__dealer.podiumAt(0));
    ok('car', inside, inside && inside.name && inside.price > 0);
    await G(p => window.__app.surface.debugMove(p.x, p.z + 4, 0), inside);
    ok('price', await wait(() => /Rust Rat/.test(document.getElementById('dlrCtxBtn')?.textContent || ''), 6000));
    R.priceText = await G(() => document.getElementById('dlrCtxBtn')?.textContent || '');
    await G(p => {
      window.__wide = (dt, c) => { const y = c.height(p.x, p.z); c.camera.position.set(p.x + 8, y + 3.4, p.z + 10); c.camera.lookAt(p.x, y + 1.1, p.z); };
      window.SSX_TICKS.push((dt, c) => window.__wide?.(dt, c));
    }, inside);
    await sleep(500);
    await page.screenshot({ path: out + 'iphone_hangar_price_390.png' });
    await G(() => { window.__wide = null; });
    await G(() => document.getElementById('dlrCtxBtn').click());
    ok('sheet', await wait(() => document.getElementById('dlrSheet')?.dataset.kind === 'dealer' && /Buy/.test(document.getElementById('dlrSheet').innerText) && /Test drive/.test(document.getElementById('dlrSheet').innerText), 4000));
    ok('clean', errors.slice(0, 3).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
    try { await page.screenshot({ path: out + 'iphone_hangar_crash.png' }); } catch (e2) { /* */ }
  }
  R.bad = bad; R.pass = !bad.length;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
