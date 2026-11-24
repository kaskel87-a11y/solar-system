// Walk-in gulch shed. Door, racks, Skiv. The Grow op sheet stays on the menu.
// BASE=http://127.0.0.1:8771/ BR=chromium DEV=390x844 node tests/test-gulchroom.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771/';
const BR = process.env.BR || 'chromium';
const DEV = process.env.DEV || '390x844';
const out = (process.env.OUT || '/tmp/gulch/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const m = /^(\d+)x(\d+)$/.exec(DEV);
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const dev = m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: BR === 'webkit' ? 1 : 2, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false };
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 220)); });
  page.on('console', msg => { if (msg.type() === 'error' && !/audio device|Failed to load|WebGL|favicon|net::/i.test(msg.text())) errors.push('C ' + msg.text().slice(0, 220)); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a);
  const R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = typeof v === 'string' ? v.slice(0, 180) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 25000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.137');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && window.SSX.farm2, 120000));
    await G(() => { window.__app.game.progress.credits = 20000; window.__app.game.progress.xp = 4000; window.__app.game.save(); window.SSX.farm2.debug.reset(); window.SSX.farm2.debug.rng(0.99); window.__app.surface.world.setWanted(0); window.SSX.onboard?.skip?.(); });
    await G(() => { const r = document.getElementById('radio'); if (r) r.style.setProperty('display', 'none', 'important'); window.SSX.farm2.debug.goto({ door: true }); });
    await sleep(700);
    ok('enter btn', await wait(() => document.getElementById('f2Act')?.textContent === 'Enter the shed', 8000));
    const box = await G(() => { const b = document.getElementById('f2Act'); const r = b.getBoundingClientRect(); return { h: r.height, w: r.width }; });
    ok('enter size', box, box.h >= 44 && box.w >= 44);
    ok('step', await G(() => document.getElementById('gulchStep')?.textContent || ''), /shed/i.test(await G(() => document.getElementById('gulchStep')?.textContent || '')));
    if (tag.startsWith('390') && BR === 'chromium') {
      await G(() => {
        for (const id of ['radio', 'toast', 'ssxGuide', 'hxOne']) { const e = document.getElementById(id); if (e) e.style.setProperty('display', 'none', 'important'); }
        const p = window.SSX.farm2.status().site;
        window.__wide = (dt, c) => { const y = c.height(p.x, p.z - 11); c.camera.position.set(p.x + 7, y + 3.2, p.z - 4); c.camera.lookAt(p.x, y + 1.6, p.z - 12); };
        window.SSX_TICKS.push((dt, c) => window.__wide?.(dt, c));
      });
      await sleep(500);
      await page.screenshot({ path: '/opt/cursor/artifacts/iphone_gulch_door_390.png' });
      await G(() => { window.__wide = null; });
    }
    await G(() => { if (window.__app.surface.info?.driving) window.__app.surface.interact(); });
    await sleep(200);
    const enterAt = await G(() => { const r = document.getElementById('f2Act').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (BR === 'webkit') await G(() => window.SSX.farm2.enter());
    else if (dev.hasTouch) await page.touchscreen.tap(enterAt.x, enterAt.y);
    else await page.mouse.click(enterAt.x, enterAt.y);
    if (!(await wait(() => window.__app.surface.info?.inside?.kind === 'gulch', 2500))) await G(() => window.SSX.farm2.enter());
    ok('inside', await wait(() => window.__app.surface.info?.inside?.kind === 'gulch', 8000));
    if (dev.hasTouch && BR === 'chromium') {
      const vp = page.viewportSize();
      await page.touchscreen.tap(vp.width * 0.4, vp.height * 0.55);
      await page.touchscreen.tap(vp.width * 0.62, vp.height * 0.58);
      if (BR === 'chromium') {
        await page.evaluate(vp => {
          const c = document.querySelector('canvas');
          const t = (id, x, y, type) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1 }));
          t(1, vp.width * 0.4, vp.height * 0.45, 'pointerdown');
          t(2, vp.width * 0.6, vp.height * 0.5, 'pointerdown');
          t(1, vp.width * 0.42, vp.height * 0.47, 'pointermove');
          t(2, vp.width * 0.58, vp.height * 0.48, 'pointermove');
          t(1, vp.width * 0.4, vp.height * 0.45, 'pointerup');
          t(2, vp.width * 0.6, vp.height * 0.5, 'pointerup');
        }, vp);
      }
      await sleep(200);
      ok('still inside', await G(() => window.__app.surface.info?.inside?.kind === 'gulch'));
    }
    await G(() => window.__app.surface.debugInside(-4.3, 1.35, 0));
    await sleep(400);
    const pressSpot = () => BR === 'webkit'
      ? G(() => window.__app.surface.world.nearSpot()?.run?.())
      : G(() => document.getElementById('driveBtn').click());
    const pressLabel = re => G(re => { const b = [...document.querySelectorAll('#gulchPick button')].find(x => x.textContent.startsWith(re) || new RegExp(re).test(x.textContent)); if (!b) return false; if (b._go) { b._go(); document.getElementById('gulchPick')?.classList.remove('on'); } else b.click(); return true; }, re);
    ok('skiv', await wait(() => /Buy the gulch/.test(document.getElementById('driveBtn')?.textContent || ''), 4000));
    await pressSpot();
    ok('buy sheet', await wait(() => document.getElementById('gulchPick')?.classList.contains('on'), 3000));
    const sheet = await G(() => {
      const el = document.getElementById('gulchPick');
      const btns = [...el.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height));
      return { text: el.innerText.slice(0, 160), tall: btns.every(h => h >= 44) };
    });
    ok('buy words', sheet.text, /2,500 cr/.test(sheet.text) && sheet.tall);
    await pressLabel('Buy the gulch · 2,500 cr');
    await sleep(300);
    ok('bought', await G(() => window.SSX.farm2.status().owned));
    await G(() => window.__app.surface.debugInside(-3.6, -2.3, 0));
    await sleep(400);
    ok('add rack', await wait(() => /Add a rack/.test(document.getElementById('driveBtn')?.textContent || ''), 4000));
    await pressSpot();
    await sleep(400);
    ok('plant prompt', await wait(() => /Plant this rack/.test(document.getElementById('driveBtn')?.textContent || ''), 4000));
    await pressSpot();
    ok('plant sheet', await wait(() => /Red Static moss/.test(document.getElementById('gulchPick')?.innerText || ''), 3000));
    await pressLabel('Red Static moss');
    await sleep(300);
    await G(() => window.SSX.farm2.debug.skip(20));
    await sleep(400);
    ok('harvest', await wait(() => /Harvest Red Static/.test(document.getElementById('driveBtn')?.textContent || ''), 4000));
    ok('marker step', await G(() => document.getElementById('gulchStep')?.textContent || ''), /Harvest/.test(await G(() => document.getElementById('gulchStep')?.textContent || '')));
    if (tag.startsWith('390') && BR === 'chromium') {
      await G(() => {
        document.getElementById('hxMapClose')?.click();
        for (const id of ['radio', 'toast', 'ssxGuide', 'hxOne']) { const e = document.getElementById(id); if (e) e.style.setProperty('display', 'none', 'important'); }
        const b = window.__app.surface.world.inside;
        window.__wide = (dt, c) => { c.camera.position.set(b.ax + 2.2, b.floor + 2.1, b.az + 0.4); c.camera.lookAt(b.ax - 1.2, b.floor + 1.1, b.az - 2.6); };
        window.SSX_TICKS.push((dt, c) => window.__wide?.(dt, c));
      });
      await sleep(500);
      await page.screenshot({ path: '/opt/cursor/artifacts/iphone_gulch_racks_390.png' });
    }
    await pressSpot();
    await sleep(300);
    ok('cut', await G(() => window.SSX.farm2.status().stashCount) > 0);
    await G(() => window.SSX.farm2.close());
    ok('menu fallback', await G(() => { window.SSX.farm2.open(); return document.getElementById('f2Panel')?.classList.contains('show'); }));
    ok('clean', errors.slice(0, 3).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
  }
  R.bad = bad; R.pass = !bad.length;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
