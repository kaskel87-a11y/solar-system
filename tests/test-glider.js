// v7.5.99 hang glider.
// BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" OUT=/tmp/glider/ node tests/test-glider.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const desk = DEV === 'desktop';
const out = (process.env.OUT || '/tmp/glider/').replace(/\/?$/, '/');
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
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 80 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.108');
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(400);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.());
    ok('api', await wait(() => !!window.SSX?.glider?.buy && !!window.SSX?.glider?.debug, 15000));
    await G(() => { window.__app.game.progress.credits = 8000; window.__app.game.save(); });
    const bought = await G(() => window.SSX.glider.buy());
    ok('bought', bought?.ok === true, bought);
    await G(() => window.SSX.glider.open());
    const sheet = await G(() => {
      const p = document.getElementById('hgSheet'); const b = p?.querySelector('button'); const r = b?.getBoundingClientRect();
      return { on: p?.classList.contains('on'), how: /tap Glide/i.test(p?.textContent || ''), h: Math.round(r?.height || 0) };
    });
    ok('howto', sheet.on && sheet.how && sheet.h >= 48, sheet);
    await G(() => window.SSX.glider.debug.lift(16));
    await G(() => window.SSX.glider.debug.hold({ glide: true }));
    ok('flying', await wait(() => window.SSX.glider.flying(), 4000));
    await sleep(400);
    const spd = await G(() => { const s = window.SSX.glider.debug.state(); return Math.hypot(s.vx, s.vz); });
    ok('fast', spd > 20, spd);
    const jets = await G(() => window.SSX.glider.buyJets());
    ok('jets', jets?.ok === true, jets);
    const before = await G(() => window.SSX.glider.fuel());
    await G(() => window.SSX.glider.debug.hold({ glide: true, boost: true }));
    await sleep(350);
    const after = await G(() => ({ fuel: window.SSX.glider.fuel(), vy: window.__app.surface.info.y }));
    ok('climbs', after.fuel < before, after);
    const btns = await G(() => {
      const touch = document.body.classList.contains('touch');
      const b = document.getElementById('hgLeft'); const r = b?.getBoundingClientRect(); const cs = b ? getComputedStyle(b) : null;
      return { touch, h: Math.round(r?.height || 0), w: Math.round(r?.width || 0), show: cs ? cs.display !== 'none' : false };
    });
    ok('steerBtn', !btns.touch || (btns.show && btns.h >= 48 && btns.w >= 48), btns);
    await G(() => { const st = document.createElement('style'); st.textContent = '#toast,#radio,#obLine,#ssxGuide,.ssxBark,#hgSheet{display:none!important}'; document.head.appendChild(st); window.__app.surface.setView('third'); });
    await sleep(500);
    await page.screenshot({ path: out + `glide-${tag}.png` });
    ok('console', errors.length === 0, errors);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 500); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
