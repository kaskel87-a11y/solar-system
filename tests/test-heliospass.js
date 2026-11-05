// v7.5.33 browser test: Helios Heights guest pass. Porter's bribe panel (black/white, tap), pay 350 cr -> Halvorsen Villa
// on ☰ Heists for one run, drive in (entry), start + end the heist (the one job), walk out -> pass used, villa gone again.
// Also pays with void honey. Screenshot of the panel: OUT (default /workspace/velvet/).
// BASE=http://127.0.0.1:8817/ BR=webkit DEV="iPhone 14" node tests/test-heliospass.js
const pw = require('playwright'), fs = require('fs');
const base = process.env.BASE || 'http://127.0.0.1:8817/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.OUT || '/workspace/velvet') + '/', desk = DEV === 'desktop'; try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : iph); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = DEV.replace(/\W+/g, '-').toLowerCase() + '-' + BR;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, hit: !!(t && (t === e || e.contains(t))) }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const villa = () => G(() => (window.SSX.heist?.heists?.() || []).some(h => /villa|halvorsen/i.test(h.id + h.title)));
  const place = (aj) => G(a => { const s = window.__app.surface, c = s.world.colony; s.debugPlace(c.x + a[0], c.z + a[1], 0); }, aj);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    ok('api', await wait(() => !!window.SSX?.heliosPass && !!window.SSX?.heist, 10000));
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); window.SSX.heliosPass.debug.reset(); });
    ok('villaLockedBefore', !(await villa()));
    await place([324, 150]); await sleep(500);
    await G(() => window.SSX.heliosPass.offer('Porter', true));
    ok('panel', await wait(() => document.getElementById('hpassPanel')?.classList.contains('on'), 3000));
    ok('btnBW', await G(() => [...document.querySelectorAll('#hpassPanel button')].every(e => { const c = getComputedStyle(e); return c.backgroundColor === 'rgb(0, 0, 0)' && c.color === 'rgb(255, 255, 255)'; })));
    await G(() => { const st = document.createElement('style'); st.textContent = '#obLine, #radio.mini { display: none !important; }'; document.head.appendChild(st); });
    await sleep(300); await page.screenshot({ path: out + `helios-bribe-${tag}.png` });
    const c0 = await G(() => window.__app.game.progress.credits);
    const b = await tapSel('#hpassPanel button[data-i="0"]'); ok('btn44', `${Math.round(b.w)}x${Math.round(b.h)} hit=${b.hit}`, b.h >= 44 && b.hit);
    ok('paid350', await wait(c => window.__app.game.progress.credits === c - 350, 3000, c0));
    ok('passHeld', await G(() => !!window.SSX.heliosPass.state().pass && window.SSX.heliosPass.allow()));
    ok('villaUnlocked', await villa());
    ok('noSecondPass', await G(() => window.SSX.heliosPass.offer('Porter', true).ok === false));
    await place([370, 100]); ok('entered', await wait(() => window.SSX.heliosPass.state().pass?.entered, 4000));
    const vid = await G(() => window.SSX.heist.heists().find(h => /villa|halvorsen/i.test(h.id + h.title)).id);
    await G(id => { window.SSX.heist.startHeist(id); }, vid); ok('jobStarted', await wait(id => window.SSX.heliosPass.state().pass?.job === id, 4000, vid));
    await G(() => window.SSX.heist.abortHeist('test'));
    ok('grace', await wait(() => window.SSX.heliosPass.state().pass?.out > 0, 3000));
    await place([324, 160]); ok('usedUp', await wait(() => !window.SSX.heliosPass.state().pass, 4000));
    ok('villaRelocked', await wait(() => !(window.SSX.heist.heists().some(h => /villa|halvorsen/i.test(h.id + h.title))), 3000));
    ok('restrictedAgain', await G(() => !window.SSX.heliosPass.allow()));
    // product: 1 void honey
    const hasC = await G(() => !!window.SSX.contraband?.add);
    if (hasC) {
      await G(() => window.SSX.contraband.add('voidhoney', 1));
      await G(() => window.SSX.heliosPass.offer('Porter', true));
      const lbl = await G(() => [...document.querySelectorAll('#hpassPanel button')].map(b => b.textContent).join(' | ')); R.labels = lbl;
      const i = await G(() => [...document.querySelectorAll('#hpassPanel button')].findIndex(b => /void honey/.test(b.textContent)));
      ok('honeyOption', i >= 0);
      if (i >= 0) { await tapSel(`#hpassPanel button[data-i="${i}"]`); ok('paidHoney', await wait(() => !!window.SSX.heliosPass.state().pass && (window.SSX.contraband.stash().items.voidhoney?.qty || 0) === 0, 3000)); }
    }
    ok('noErrors', errors.length ? errors.slice(0, 3).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.fails = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
