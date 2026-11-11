// Velvet snack bar: EAT button, menu, health, burger buff. iPhone SE and desktop.
// BASE=http://127.0.0.1:8765/ BR=chromium DEV=375x667 OUT=/tmp/ssx-shots/snack/ node tests/test-snack.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop', desk = DEV === 'desktop';
const out = process.env.OUT || '/tmp/', tag = `${DEV.replace(/\s+/g, '')}-${BR}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const iph = pw.devices['iPhone SE'] || pw.devices['iPhone 14'];
  const { defaultBrowserType: _d, ...o } = iph;
  const dev = desk ? { viewport: { width: 1280, height: 800 } }
    : { ...o, viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
  const ctx = await browser.newContext(dev); await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else { const b = await G(() => { const e = document.getElementById('driveBtn'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await page.touchscreen.tap(b.x, b.y); } };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    const entered = await G(() => {
      const g = window.__app.game; g.progress.credits = 500; g.save(); window.__app.surface.world.setWanted(0);
      return window.__app.surface.enterBuilding(window.__app.surface.world.doorFor('club'));
    });
    ok('inClub', !!entered?.ok && await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));
    await sleep(600);
    await G(() => { window.__app.game.hurtPlayer(100); window.__app.surface.debugInside(14.2, 4.3, Math.PI / 2); });
    await sleep(400);
    const hp0 = await G(() => window.__app.game.info.hp), cr0 = await G(() => window.__app.game.progress.credits);
    ok('hurt', hp0, hp0 === 60);
    ok('eatBtn', await wait(() => /EAT/.test(document.getElementById('driveBtn').textContent), 4000));
    await act();
    ok('menu', await wait(() => /Wings/.test(document.getElementById('snackSheet')?.innerText || '') && /Red Dust burger/.test(document.getElementById('snackSheet')?.innerText || ''), 4000));
    await sleep(500);
    const bought = await G(() => {
      const b = [...document.querySelectorAll('#snackSheet button')].find(x => /Wings/.test(x.textContent));
      b.click();
      return { toast: document.getElementById('toast')?.innerText || '', hp: window.__app.game.info.hp, cr: window.__app.game.progress.credits };
    });
    ok('wings', JSON.stringify(bought), bought.hp === hp0 + 25 && bought.cr === cr0 - 25 && /\+25 health/.test(bought.toast));
    await G(() => window.SSX.snack.open());
    await sleep(500);
    const fed = await G(() => {
      const b = [...document.querySelectorAll('#snackSheet button')].find(x => /Red Dust burger/.test(x.textContent));
      b.click();
      return { mit: window.SSX.snack.mitigate(), fed: window.SSX.snack.fed(), cr: window.__app.game.progress.credits };
    });
    ok('burger', JSON.stringify(fed), fed.fed && fed.mit === 0.75 && fed.cr === cr0 - 25 - 45);
    await G(() => { const st = document.createElement('style'); st.textContent = '#ssxGuide,#toast,#snackSheet,#varcSheet,#obLine,#radio{display:none!important}'; document.head.appendChild(st); window.__app.surface.debugInside(15.6, 7.8, Math.atan2(2.55, 3.5)); });
    await sleep(1400);
    await page.screenshot({ path: out + `snack-${tag}.png` });
    ok('noErrors', errors.length ? errors.slice(0, 3).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.fails = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
