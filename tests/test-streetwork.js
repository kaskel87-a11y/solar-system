// v7.5.139 street offers. BASE=http://127.0.0.1:8771/ node tests/test-streetwork.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771/';
const only = process.env.ONLY || 'chromium:iPhone 14,webkit:iPhone 14,chromium:desktop';
const out = (process.env.OUT || '/opt/cursor/artifacts/').replace(/\/?$/, '/');
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const bad = [];
  for (const pair of only.split(',')) {
    const [BR, DEV] = pair.split(':');
    const desk = DEV === 'desktop';
    const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
    const dev = desk ? { viewport: { width: 1280, height: 800 } }
      : (({ defaultBrowserType, ...o }) => ({ ...o, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }))(pw.devices[DEV] || pw.devices['iPhone 14']);
    const ctx = await browser.newContext(dev);
    await ctx.addInitScript(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => { if (!/audio/i.test(e.message)) errors.push(e.message.slice(0, 180)); });
    const G = f => page.evaluate(f);
    const wait = async f => page.waitForFunction(f, null, { timeout: 120000, polling: 100 });
    const tag = BR + '-' + DEV;
    try {
      await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
      await wait(() => window.__frames > 3 && !document.getElementById('loading'));
      const ver = await G(() => document.querySelector('meta[name="app-version"]').content);
      if (ver !== 'v7.5.139') bad.push(tag + ' version ' + ver);
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0);
      await wait(() => !!window.SSX?.streetWork?.buy);
      const r = await G(() => {
        const S = window.SSX.streetWork, g = window.__app.game;
        g.progress.credits = 200;
        g.restore();
        const far = S.offer();
        S.debug.goto('flats');
        const sheet = S.offer();
        const ages = S.tiers.map(t => t.age);
        const c0 = g.progress.credits;
        const hp0 = g.info.hp;
        g.hurtPlayer(40, { x: 1, z: 0 });
        const bought = S.buy(100);
        const poor = S.buy(5000);
        const fade = document.getElementById('sworkFade');
        const btn = [...document.querySelectorAll('#sworkSheet button')].find(b => b.dataset.cr === '500');
        S.debug.goto('gulch');
        const gulch = S.offer();
        return {
          far: far.ok === false, sheet: !!sheet.ok, ages,
          spent: c0 - g.progress.credits, bought: bought.ok, line: bought.line || '',
          healed: g.info.hp >= hp0 - 40, poor: !!poor.poor,
          fade: !!fade?.classList.contains('on'), fadeText: (fade?.textContent || '').slice(0, 80),
          btnH: btn ? Math.round(btn.getBoundingClientRect().height) : 0,
          gulch: gulch.spot
        };
      });
      if (r.far !== true || !r.sheet) bad.push(tag + ' where ' + JSON.stringify(r));
      if (r.ages.some(a => a < 21)) bad.push(tag + ' age');
      if (!r.bought || r.spent < 100 || !/black/i.test(r.line) || !r.fade) bad.push(tag + ' buy ' + JSON.stringify(r));
      if (!r.poor || r.gulch !== 'gulch') bad.push(tag + ' gulch ' + JSON.stringify(r));
      if (r.btnH && r.btnH < 44) bad.push(tag + ' btn ' + r.btnH);
      if (errors.length) bad.push(tag + ' ' + errors[0]);
      if (BR === 'chromium' && !desk) await page.screenshot({ path: out + 'iphone_corner_390.png' });
      console.log(tag, JSON.stringify(r), errors.length ? errors[0] : 'clean');
    } catch (e) {
      bad.push(tag + ' ' + e.message.split('\n')[0]);
      console.log(tag, 'FAIL', e.message.split('\n')[0]);
    }
    await browser.close();
  }
  console.log(bad.length ? 'FAILED ' + bad.join(' | ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})();
