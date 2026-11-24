// v7.5.140 walk-up prompt. BASE=http://127.0.0.1:8771/ node tests/test-areaprompt.js
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
      if (ver !== 'v7.5.140') bad.push(tag + ' version ' + ver);
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0);
      await G(() => { window.__app.game.progress.credits = 500; return window.__app.surface.enterBuilding(window.__app.surface.world.doorFor('club')); });
      await wait(() => window.__app.surface.info.inside?.kind === 'club');
      await G(() => window.__app.surface.debugInside(6, 11.7, 0));
      await page.waitForTimeout(600);
      const box = await G(() => {
        const b = document.getElementById('areaGo');
        const r = b.getBoundingClientRect();
        const hit = (id) => { const e = document.getElementById(id); if (!e) return false; const a = e.getBoundingClientRect(); return r.left < a.right - 2 && a.left < r.right - 2 && r.top < a.bottom - 2 && a.top < r.bottom - 2 && a.width > 8; };
        const mid = r.left < innerWidth * 0.75 && r.right > innerWidth * 0.25 && r.top < innerHeight * 0.75 && r.bottom > innerHeight * 0.25;
        return { text: b.textContent, on: b.classList.contains('on'), h: Math.round(r.height), fire: hit('fireBtn'), joy: hit('joy'), mid, top: Math.round(r.top) };
      });
      if (!box.on || box.h < 44 || !/bingo|brawl|ines|paddle|talk/i.test(box.text)) bad.push(tag + ' prompt ' + JSON.stringify(box));
      if (box.fire || box.joy || box.mid) bad.push(tag + ' layout ' + JSON.stringify(box));
      if (desk) await page.keyboard.press('KeyE');
      else {
        const c = await G(() => { const r = document.getElementById('areaGo').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        await page.touchscreen.tap(c.x, c.y);
      }
      await page.waitForTimeout(400);
      const opened = await G(() => document.getElementById('csbSheet')?.classList.contains('on') || document.getElementById('vbrawl')?.classList.contains('on') || document.getElementById('ppGame')?.classList.contains('on') || !!document.getElementById('varcSheet'));
      if (!opened && !/ines|talk/i.test(box.text)) bad.push(tag + ' tap ' + box.text);
      await G(() => { const m = document.getElementById('menuBtn'); m?.click(); });
      await page.waitForTimeout(300);
      const menu = await G(() => { const b = document.getElementById('rmBingo'); const p = document.getElementById('rmPaddle'); return { bingo: b?.parentElement?.id || '', paddle: p?.parentElement?.id || '', places: !!document.getElementById('rmPlaces') }; });
      if (menu.bingo !== 'rmPlaces' || (menu.paddle && menu.paddle !== 'rmPlaces')) bad.push(tag + ' menu ' + JSON.stringify(menu));
      if (errors.length) bad.push(tag + ' ' + errors[0]);
      if (BR === 'chromium' && !desk) {
        await G(() => { document.getElementById('roverMenu')?.classList.remove('show'); document.getElementById('csbSheet')?.classList.remove('on'); document.getElementById('ppGame')?.classList.remove('on'); });
        await page.waitForTimeout(300);
        await page.screenshot({ path: out + 'iphone_prompt_390.png' });
      }
      console.log(tag, JSON.stringify({ box, menu }), errors.length ? errors[0] : 'clean');
    } catch (e) {
      bad.push(tag + ' ' + e.message.split('\n')[0]);
      console.log(tag, 'FAIL', e.message.split('\n')[0]);
    }
    await browser.close();
  }
  console.log(bad.length ? 'FAILED ' + bad.join(' | ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})();
