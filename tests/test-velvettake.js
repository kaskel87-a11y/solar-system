// v7.5.136 Take the Velvet: verbal fight, steps, then Ines in the Flats.
// BASE=http://127.0.0.1:8771/ node tests/test-velvettake.js
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
    page.on('pageerror', e => { if (!/audio/i.test(e.message)) errors.push(e.message.slice(0, 160)); });
    const G = f => page.evaluate(f);
    const wait = async f => page.waitForFunction(f, null, { timeout: 120000, polling: 100 });
    const tag = BR + '-' + DEV;
    try {
      await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
      await wait(() => window.__frames > 3 && !document.getElementById('loading'));
      const ver = await G(() => document.querySelector('meta[name="app-version"]').content);
      if (ver !== 'v7.5.136') bad.push(tag + ' version ' + ver);
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0);
      await wait(() => !!window.SSX?.velvetTake?.act);
      const r = await G(() => {
        const T = window.SSX.velvetTake;
        T.debug.reset();
        T.debug.goto('club');
        const talk = T.act();
        const push = T.choose('push');
        const hard = T.choose('hard');
        const radio = document.getElementById('radio');
        if (radio) radio.style.display = 'none';
        const mid = T.state();
        T.act();
        const floor = T.state();
        return { talk: !!talk.talk, push: push.node, hard: !!hard.took, mid: mid.text, floor: floor.text };
      });
      await page.waitForTimeout(500);
      const guide = await G(() => (document.getElementById('ssxGuide')?.textContent || '').replace(/\s+/g, ' ').trim());
      if (BR === 'chromium' && !desk) await page.screenshot({ path: out + 'iphone_velvet_390.png' });
      const end = await G(() => { const T = window.SSX.velvetTake; T.debug.goto('flats'); const visit = T.act(); return { visit: !!visit.demoted, demoted: T.state().demoted }; });
      const r2 = { ...r, ...end, guide };
      if (!r2.talk || r2.push !== 1 || !r2.hard) bad.push(tag + ' talk ' + JSON.stringify(r2));
      if (!/floor/i.test(r2.mid) || !/Flats/i.test(r2.floor)) bad.push(tag + ' steps ' + r2.mid + ' | ' + r2.floor);
      if (!r2.demoted) bad.push(tag + ' not demoted');
      if (!/Ines|Flats|Velvet/i.test(r2.guide)) bad.push(tag + ' guide ' + r2.guide);
      if (errors.length) bad.push(tag + ' ' + errors[0]);
      console.log(tag, JSON.stringify(r2), errors.length ? errors[0] : 'clean');
    } catch (e) {
      bad.push(tag + ' ' + e.message.split('\n')[0]);
      console.log(tag, 'FAIL', e.message.split('\n')[0]);
    }
    await browser.close();
  }
  console.log(bad.length ? 'FAILED ' + bad.join(' | ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})();
