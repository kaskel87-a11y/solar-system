// Ines lives in the Velvet staff-only room. The door is open, a glow marks her, and Talk to Ines shows when close.
// ☰ The Velvet says "Ines is in the staff-only room".
// BASE=http://127.0.0.1:8765/ BR=chromium DEV=375x667 OUT=/tmp/ssx-shots/ines/ node tests/test-ines.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop', desk = DEV === 'desktop';
const out = process.env.OUT || '/tmp/', tag = `${DEV.replace(/\s+/g, '')}-${BR}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = pw.devices['iPhone SE'] || pw.devices['iPhone 14'];
  const dev = desk ? { viewport: { width: 1280, height: 800 } }
    : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : iph;
  const ctx = await browser.newContext(dev); await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(600);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const st = document.createElement('style'); st.textContent = '#obLine, #radio.mini { display: none !important; }'; document.head.appendChild(st); window.__app.game?.abandon?.(); });
    ok('arc', await wait(() => !!window.SSX?.velvetArc?.openGuide, 20000));
    const entered = await G(() => {
      const g = window.__app.game; g.progress.credits = 500; g.save(); window.__app.surface.world.setWanted(0);
      return window.__app.surface.enterBuilding(window.__app.surface.world.doorFor('club'));
    });
    ok('entered', JSON.stringify(entered), !!entered?.ok);
    ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));
    await sleep(1200);
    await G(() => window.__app.surface.debugInside(18, 13, 0)); await sleep(700);
    const guide = await G(() => { const e = document.getElementById('ssxGuide'); if (!e || !e.classList.contains('on')) return null; const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const mid = cx > innerWidth * 0.25 && cx < innerWidth * 0.75 && cy > innerHeight * 0.25 && cy < innerHeight * 0.75; return { t: e.textContent, mid, top: r.top }; });
    ok('guide', JSON.stringify(guide), !!guide && /Ines/.test(guide.t) && /staff room/.test(guide.t) && !guide.mid);
    await G(() => window.SSX.velvetArc.openGuide()); await sleep(300);
    const sheet = await G(() => document.getElementById('varcSheet')?.innerText || '');
    ok('menu', sheet.slice(0, 180), /Ines is in the staff-only room/.test(sheet));
    await G(() => { const s = document.getElementById('varcSheet'); if (s) s.style.display = 'none'; const t = document.getElementById('toast'); if (t) { t.textContent = ''; t.style.display = 'none'; } const st = document.createElement('style'); st.textContent = '#ssxGuide,#toast,#varcSheet{display:none!important}'; document.head.appendChild(st); });
    await G(() => window.__app.surface.debugInside(21.5, -0.65, 0)); await sleep(400);
    const spot = await G(() => { const s = window.__app.surface.world.nearSpot(); return s ? { id: s.id, label: s.label, who: s.who } : null; });
    ok('spot', JSON.stringify(spot), spot?.id === 'ines' && spot?.who === 'Ines' && /Talk to Ines/.test(spot?.label || ''));
    ok('talkBtn', await wait(() => /Talk to Ines/.test(document.getElementById('driveBtn').textContent), 4000));
    await G(() => window.__app.surface.debugInside(21.25, 3.4, 0)); await sleep(1600);
    await page.screenshot({ path: out + `ines-staff-${tag}.png` });
    ok('noErrors', errors.length ? errors.slice(0, 3).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.fails = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
