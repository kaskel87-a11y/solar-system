// Taxi overhaul: Start Taxi, named pickup, gunpoint choices, iPhone fit.
// BASE=http://127.0.0.1:8771/ node tests/test-taxi124.js
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
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 220)); });
  page.on('console', m => { if (m.type() === 'error' && !/audio|WebGL|favicon|net::/i.test(m.text())) errors.push('C ' + m.text().slice(0, 220)); });
  const G = f => page.evaluate(f);
  const R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = typeof v === 'string' ? v.slice(0, 200) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 90000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const box = sel => G(s => {
    const e = document.querySelector(s); if (!e) return null;
    const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return null;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
  }, box.sel = sel) || page.evaluate(s => {
    const e = document.querySelector(s); if (!e) return null;
    const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return null;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
  }, sel);
  const hit = (a, b) => !!(a && b) && !(a.r < b.x + 2 || a.x > b.r - 2 || a.b < b.y + 2 || a.y > b.b - 2);
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading')));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.126');
    await G(() => { window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0));
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.jobs.debug.reset(); window.__app.surface.world.setWanted(0); const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await sleep(500);
    await G(() => window.__app.surface.interact());
    ok('driving', await wait(() => window.__app.surface.info.driving, 8000));
    ok('startBtn', await wait(() => /Start Taxi/.test(document.getElementById('jobAct')?.textContent || '') && getComputedStyle(document.getElementById('jobAct')).display !== 'none', 6000));
    await G(() => window.SSX.jobs.debug.forceEvent('quiet'));
    await G(() => document.getElementById('jobAct').click());
    ok('started', await wait(() => window.SSX.jobs.active()?.stage === 'pickup', 4000));
    ok('pinned', await G(() => window.SSX.jobs.debug.pin('Vex')));
    const step = await G(() => window.SSX.jobs.active()?.text || '');
    ok('step', step, /Pick up Vex at /.test(step));
    await G(() => { const r = document.getElementById('radio'); if (r && getComputedStyle(r).display !== 'none') document.getElementById('radioLater')?.click(); });
    await G(() => {
      const s = window.__app.surface, j = window.SSX.jobs.active(), c = s.info.colony;
      s.debugMove(c.x + j.target.x, c.z + j.target.z + 16, 0); s.setView('third');
    });
    await sleep(700);
    await G(() => { const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission'); } });
    const arrow = await G(() => (document.getElementById('ssxGuide')?.innerText || '') + ' | ' + (document.getElementById('hxJob')?.innerText || ''));
    ok('namesVex', arrow, /Vex/.test(arrow));
    await page.screenshot({ path: out + 'iphone_taxi_pickup_390.png' });
    ok('armed', await G(() => window.SSX.jobs.debug.armGun()));
    await G(() => { const r = document.getElementById('radio'); if (r && getComputedStyle(r).display !== 'none') document.getElementById('radioLater')?.click(); window.__app.surface.setView('first'); });
    ok('gunStage', await wait(() => window.SSX.jobs.active()?.phase === 'choice', 4000));
    await sleep(600);
    await G(() => { const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission'); } });
    const fit = await page.evaluate(() => {
      const rect = sel => { const e = document.querySelector(sel); if (!e) return null; const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
      const hit = (a, b) => !!(a && b) && !(a.r < b.x + 2 || a.x > b.r - 2 || a.b < b.y + 2 || a.y > b.b - 2);
      const card = document.getElementById('taxiChoice');
      const btns = [...card.querySelectorAll('button')].map(b => ({ t: b.textContent, ...(() => { const r = b.getBoundingClientRect(); return { h: r.height, x: r.x, y: r.y, w: r.width, r: r.right, b: r.bottom }; })() }));
      const cardR = rect('#taxiChoice'), vig = document.getElementById('taxiVig')?.classList.contains('on');
      const blocks = ['#joy', '#fireBtn', '#driveBtn', '#jobAct', '#ssxMouthHorn'].map(s => [s, rect(s)]);
      const over = [];
      for (const [s, r] of blocks) if (hit(cardR, r)) over.push(s);
      const fits = cardR && cardR.x >= -1 && cardR.r <= innerWidth + 1 && cardR.y >= -1 && cardR.b <= innerHeight + 1;
      const npc = window.SSX.jobs.debug.target();
      return { text: card.innerText.slice(0, 180), btns: btns.map(b => b.t), h: Math.min(...btns.map(b => b.h)), over, fits, vig, phase: window.SSX.jobs.active()?.phase, line: /gun on you/i.test(card.innerText) };
    });
    ok('gunCopy', fit.text, fit.line && /Comply/.test(fit.text) && /Floor it/.test(fit.text) && /Slam brakes/.test(fit.text));
    ok('gunButtons', fit.h, fit.h >= 44 && fit.fits && fit.over.length === 0 && fit.vig);
    R.gunFit = fit;
    await page.screenshot({ path: out + 'iphone_taxi_gunpoint_390.png' });
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(400);
    const land = await page.evaluate(() => {
      const rect = sel => { const e = document.querySelector(sel); if (!e) return null; const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
      const hit = (a, b) => !!(a && b) && !(a.r < b.x + 2 || a.x > b.r - 2 || a.b < b.y + 2 || a.y > b.b - 2);
      const cardR = rect('#taxiChoice');
      const hs = [...document.querySelectorAll('#taxiChoice button')].map(b => b.getBoundingClientRect().height);
      const over = ['#joy', '#fireBtn', '#driveBtn', '#jobAct', '#ssxMouthHorn'].filter(s => hit(cardR, rect(s)));
      const fits = cardR && cardR.x >= -1 && cardR.r <= innerWidth + 1 && cardR.b <= innerHeight + 1;
      return { h: Math.min(...hs), over, fits, w: innerWidth, hh: innerHeight };
    });
    ok('landFit', land, land.h >= 44 && land.fits && land.over.length === 0);
    R.land = land;
    await page.screenshot({ path: out + 'iphone_taxi_gunpoint_land.png' });
    const w0 = await G(() => window.__app.surface.info.wanted || 0);
    await G(() => window.SSX.jobs.debug.choice('brake'));
    await sleep(300);
    const after = await G(() => ({ stage: window.SSX.jobs.active()?.stage, wanted: window.__app.surface.info.wanted, text: window.SSX.jobs.active()?.text || '', rep: window.SSX.rep?.get?.('dustjaws') }));
    ok('brakePaid', after, after.stage === 'paid' && /Partial fare|Next fare/.test(after.text) && after.wanted > w0);
    ok('clean', errors.slice(0, 4).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
    try { await page.screenshot({ path: out + 'iphone_taxi_crash.png' }); } catch (e2) { /* */ }
  }
  R.bad = bad; R.pass = !bad.length; R.errors = errors.slice(0, 6);
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
