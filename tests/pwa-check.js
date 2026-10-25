// installability check (Chromium CDP Page.getInstallabilityErrors + manifest/SW) and standalone-mode screenshots
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8766/solar-system/', out = process.env.OUT || '/workspace/solar-system/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = {};
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await page.goto(base); await page.waitForFunction(() => window.__frames > 3, null, { timeout: 120000 });
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 30000 }).catch(() => {});
  const cdp = await ctx.newCDPSession(page);
  R.installErrors = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors;
  const man = await cdp.send('Page.getAppManifest'); R.manifestErrors = man.errors; R.manifestUrl = man.url;
  R.sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { active: !!r?.active, script: r?.active?.scriptURL, caches: await caches.keys() }; });
  // offline reload works from cache
  await ctx.setOffline(true); await page.reload(); R.offline = await page.waitForFunction(() => window.__frames > 3, null, { timeout: 60000 }).then(() => true).catch(() => false); await ctx.setOffline(false);
  await b.close();
  // standalone-mode screenshots on iPhone 14 (WebKit): emulate navigator.standalone + display-mode and a notch inset
  const w = await webkit.launch(); const { defaultBrowserType, ...d } = devices['iPhone 14'];
  for (const ori of ['portrait', 'landscape']) {
    const dd = ori === 'portrait' ? d : { ...d, viewport: { width: d.viewport.height, height: d.viewport.width } };
    const c2 = await w.newContext(dd); const p = await c2.newPage();
    await p.addInitScript(ori => {
      Object.defineProperty(navigator, 'standalone', { get: () => true });
      const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode: (standalone|fullscreen)/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q);
      // iPhone 14 safe areas in standalone (status bar translucent): top 47 / bottom 34 portrait, left/right 47 + bottom 21 landscape
      const css = ori === 'portrait' ? ':root{--sat:47px!important;--sab:34px!important}' : ':root{--sal:47px!important;--sar:47px!important;--sab:21px!important}';
      document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); });
    }, ori);
    await p.goto(base + '?source=pwa'); await p.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
    R['standaloneClass_' + ori] = await p.evaluate(() => document.body.classList.contains('standalone'));
    await p.evaluate(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await p.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, null, { timeout: 60000 });
    await sleep(1500);
    await p.evaluate(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); s.interact(); window.__app.touchBtns.jump = true; window.__app.joy.x = -0.8; window.__app.joy.y = -0.4; });
    await p.waitForFunction(() => window.__app.surface.info.carAlt > 6, null, { timeout: 30000 }).catch(() => {});
    // HUD inside the safe area: nothing of the top bar above the inset, buttons above the home bar
    R['safe_' + ori] = await p.evaluate(ori => { const ins = ori === 'portrait' ? { t: 47, b: 34, l: 0, r: 0 } : { t: 0, b: 21, l: 47, r: 47 }; const bad = []; for (const id of ['topBar', 'miniMap', 'joy', 'fireBtn', 'surfBtns']) { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') continue; const r = e.getBoundingClientRect(); if (r.top < ins.t - 1 || r.bottom > innerHeight - ins.b + 1 || r.left < ins.l - 1 || r.right > innerWidth - ins.r + 1) bad.push(id); } return bad.length ? bad.join(',') : 'ok'; }, ori);
    await p.screenshot({ path: `${out}v72-pwa-standalone-iphone-14-${ori}.png` });
    await p.evaluate(() => { window.__app.touchBtns.jump = false; window.__app.joy.x = 0; window.__app.joy.y = 0; });
    await c2.close();
  }
  await w.close();
  console.log(JSON.stringify(R, null, 1));
  const pass = R.installErrors.length === 0 && R.manifestErrors.length === 0 && R.sw.active && R.offline && R.safe_portrait === 'ok' && R.safe_landscape === 'ok' && R.standaloneClass_portrait;
  console.log(pass ? 'PASS' : 'FAIL'); process.exit(pass ? 0 : 1);
})();
