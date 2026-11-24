// v7.5.136 incoming damage is 20% higher. BASE=http://127.0.0.1:8771/ node tests/test-damage.js
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
      const hit = await G(() => {
        const g = window.__app.game;
        g.restore();
        const before = g.info.hp + g.info.shield;
        g.hurtPlayer(50, { x: 1, z: 0 });
        const after = g.info.hp + g.info.shield;
        g.hurtPlayer(80, { x: 1, z: 0 });
        return { drop: Math.round(before - after), hp: g.info.hp, shield: g.info.shield, down: g.info.down };
      });
      if (hit.drop !== 60) bad.push(tag + ' drop ' + hit.drop);
      if (errors.length) bad.push(tag + ' ' + errors[0]);
      if (BR === 'chromium' && !desk) await page.screenshot({ path: out + 'iphone_damage_390.png' });
      console.log(tag, JSON.stringify(hit), errors.length ? errors[0] : 'clean');
    } catch (e) {
      bad.push(tag + ' ' + e.message.split('\n')[0]);
      console.log(tag, 'FAIL', e.message.split('\n')[0]);
    }
    await browser.close();
  }
  console.log(bad.length ? 'FAILED ' + bad.join(' | ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})();
