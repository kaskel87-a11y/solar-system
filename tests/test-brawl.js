// v7.5.139 Velvet brawl. BASE=http://127.0.0.1:8771/ node tests/test-brawl.js
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
      if (ver !== 'v7.5.139') bad.push(tag + ' version ' + ver);
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0);
      await wait(() => !!window.SSX?.velvetBrawl?.open);
      await G(() => { window.__app.game.progress.credits = 8000; window.__app.game.restore(); return window.__app.surface.enterBuilding(window.__app.surface.world.doorFor('club')); });
      await wait(() => window.__app.surface.info.inside?.kind === 'club');
      const r = await G(() => {
        const B = window.SSX.velvetBrawl, g = window.__app.game;
        const c0 = g.progress.credits;
        const opened = B.open();
        const picked = B.pick('vex');
        const you0 = g.info.hp + g.info.shield;
        const one = B.strike();
        const you1 = g.info.hp + g.info.shield;
        const mid = B.state();
        let last = one, n = 1;
        while (mid.fight && n < 12 && !last.win && !last.dead) { last = B.strike(); n++; }
        const won = last.win === true;
        g.restore();
        B.pick('sera');
        g.hurtPlayer(9999, { x: 0, z: 0 });
        const dead = B.strike();
        const hit = document.querySelector('#vbrawl button[data-a="hit"]');
        const leave = document.querySelector('#vbrawl button[data-a="leave"]');
        return { opened: opened.ok, picked: picked.ok, you0, you1, them: one.them, n, won, pay: last.pay, credits: g.progress.credits - c0, dead: !!dead.dead, down: g.info.down, hitH: hit ? hit.getBoundingClientRect().height : 0, leaveH: leave ? leave.getBoundingClientRect().height : 0 };
      });
      if (!r.opened || !r.picked) bad.push(tag + ' open ' + JSON.stringify(r));
      if (!(r.you1 < r.you0) || !(r.them < 48)) bad.push(tag + ' health ' + JSON.stringify(r));
      if (!r.won || r.pay !== 200) bad.push(tag + ' win ' + JSON.stringify(r));
      if (!r.dead || !r.down) bad.push(tag + ' death ' + JSON.stringify(r));
      if (errors.length) bad.push(tag + ' ' + errors[0]);
      if (BR === 'chromium' && !desk) {
        await G(() => {
          window.__app.game.restore();
          for (const id of ['cqScreen', 'downMsg', 'fadeBlack']) { const e = document.getElementById(id); if (e) { e.classList.remove('on', 'show'); e.style.display = 'none'; } }
          if (window.__app.surface.info.inside?.kind !== 'club') window.__app.surface.enterBuilding(window.__app.surface.world.doorFor('club'));
          window.__app.game.progress.credits = 8000;
          const picked = window.SSX.velvetBrawl.pick('brick');
          const hit = window.SSX.velvetBrawl.strike();
          const bar = document.getElementById('vbrawl');
          const r = bar ? bar.getBoundingClientRect() : null;
          window.__brawlShot = { inside: window.__app.surface.info.inside?.kind || '', picked, hit, on: !!bar?.classList.contains('on'), h: r ? Math.round(r.height) : 0, text: (bar?.innerText || '').slice(0, 80) };
        });
        await page.screenshot({ path: out + 'iphone_brawl_390.png' });
      }
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
