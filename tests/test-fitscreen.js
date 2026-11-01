// v7.5.47 fit-to-screen (Collin: "I can't use my buttons, the screen cut them off" on iPhone Chrome, even after reload).
// Overview + Mars HUD at 390 and 375 px: no horizontal overflow, every HUD control inside the visible screen; with a
// stuck pinch zoom (CDP page scale 1.3, what iOS restores on reload) the game is redrawn inside the visual viewport;
// Chrome-style text zoom (inline -webkit-text-size-adjust:130%) is overridden; after focusing an input and rotating.
// BASE=http://127.0.0.1:8811/ OUT=/workspace/vpfit/ node tests/test-fitscreen.js
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = {}, bad = []; const ok = (k, v, c) => { if (c === undefined) c = v; R[k] = v ?? !!c; if (!c) bad.push(k); };
  // controls the player needs: visible ones only, ignoring the side-scrolling planet chip row + offscreen sheets
  const audit = () => {
    const vv = visualViewport, L = vv.offsetLeft, T = vv.offsetTop, W = vv.width, H = vv.height, o = [];
    const sel = 'button, #joy, #topBar, #miniMap, #info, input[type=range], .hudbtn, #surfBtns';
    for (const e of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
      if (e.closest('#planetBar, .planets, [aria-hidden=true]')) continue;
      let p = e.parentElement, scroller = false; while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX + s.overflowY) || (s.display === 'none')) { scroller = true; break; } p = p.parentElement; }
      if (scroller) continue;
      const b = e.getBoundingClientRect(); if (b.width < 4 || b.height < 4) continue;
      if (b.right < 0 || b.bottom < 0 || b.left > innerWidth * 1.5 || b.top > innerHeight * 1.5) { if (b.left > innerWidth * 1.5) continue; }
      // rect is in layout px; on screen it is (rect - offset) * scale, the screen is W*scale wide
      if (b.left < L - 2 || b.top < T - 2 || b.right > L + W + 2 || b.bottom > T + H + 2) o.push(`${e.tagName}#${e.id}.${(e.className + '').slice(0, 24)} [${b.left | 0},${b.top | 0},${b.right | 0},${b.bottom | 0}] vv[${L | 0},${T | 0},${(L + W) | 0},${(T + H) | 0}]`);
    }
    return { sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth, sx: scrollX, scale: vv.scale, fit: document.body.classList.contains('ssx-vvfit'), over: o.slice(0, 12) };
  };
  for (const W of [390, 375]) {
    const { defaultBrowserType: _d, ...dev } = pw.devices['iPhone 14'];
    const H = W === 390 ? 664 : 629;
    const ctx = await browser.newContext({ ...dev, viewport: { width: W, height: H } }); const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
    const cdp = await ctx.newCDPSession(page);
    const G = (f, a) => page.evaluate(f, a);
    await page.goto(base + '?t=' + Date.now()); await page.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 }); await sleep(1200);
    let a = await G(audit); ok(`${W}.overview`, JSON.stringify(a), a.sw <= a.iw && a.over.length === 0);
    // Chrome iOS text zoom = inline text-size-adjust on html/body
    a = await G(() => { document.documentElement.style.webkitTextSizeAdjust = '130%'; document.body.style.webkitTextSizeAdjust = '130%'; return [getComputedStyle(document.documentElement).webkitTextSizeAdjust, getComputedStyle(document.body).webkitTextSizeAdjust]; });
    ok(`${W}.textZoomOverridden`, JSON.stringify(a), a.every(v => v === '100%'));
    // larger text (root font +25%) must still fit
    await G(() => { document.documentElement.style.fontSize = '125%'; }); await sleep(400);
    a = await G(audit); ok(`${W}.largerText`, JSON.stringify(a), a.sw <= a.iw && a.over.length === 0);
    await G(() => { document.documentElement.style.fontSize = ''; });
    // stuck pinch zoom (what Collin's reload showed). iOS ignores maximum-scale, Chromium doesn't, so emulate iOS by
    // letting the meta allow zoom first. (a) the viewport-meta kick resets it to 1; (b) if it can't (NOKICK), the game is
    // redrawn inside the visible part of the screen.
    const zoom = async (sc, nokick) => { await G(nk => { window.SSX_FIT_NOKICK = nk; document.querySelector('meta[name=viewport]').setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover'); }, nokick); await sleep(900);
      for (let i = 0; i < 8; i++) { await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); await sleep(150); await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: sc }); await sleep(120);
        if (!nokick || await G(sc => visualViewport.scale > sc - 0.05, sc)) break; await sleep(400); } };
    const unzoom = async () => { await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); await G(() => { window.SSX_FIT_NOKICK = false; document.querySelector('meta[name=viewport]').setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'); }); await sleep(900); };
    await zoom(1.3, false); await sleep(1600);
    a = await G(audit); ok(`${W}.zoomKickResets`, JSON.stringify(a), a.scale < 1.01 && !a.fit && a.over.length === 0);
    await unzoom(); await zoom(1.3, true); await sleep(1600);
    a = await G(audit); ok(`${W}.zoomedOverviewFits`, JSON.stringify(a), a.scale > 1.2 && a.fit && a.over.length === 0);
    if (W === 390) await page.screenshot({ path: out + `fit-zoomed-overview-${W}.png` });
    await unzoom();
    // Mars HUD
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await page.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, null, { timeout: 90000 }); await sleep(1500);
    await G(() => document.getElementById('radioLater')?.click()); await sleep(300);
    a = await G(audit); ok(`${W}.marsHud`, JSON.stringify(a), a.sw <= a.iw && a.over.length === 0);
    // focus a text input (save code / name boxes) then blur
    await G(() => { const i = document.createElement('input'); i.id = '__fitIn'; i.style.cssText = 'position:fixed;left:10px;top:300px;z-index:99;font-size:12px'; document.body.appendChild(i); i.focus(); });
    a = await G(() => getComputedStyle(document.getElementById('__fitIn')).fontSize); ok(`${W}.input16px`, a, parseFloat(a) >= 16);
    await zoom(1.45, true); await sleep(300);   // as if iOS auto-zoomed on focus and the kick can't undo it
    R[`${W}.dbgZoomFocused`] = await G(() => visualViewport.scale);
    await G(() => { const i = document.getElementById('__fitIn'); i.blur(); i.remove(); }); await sleep(1500);
    R[`${W}.dbgAfterBlur`] = await G(() => visualViewport.scale);
    a = await G(audit); ok(`${W}.afterInputZoomFits`, JSON.stringify(a), a.fit && a.over.length === 0);
    if (W === 390) await page.screenshot({ path: out + `fit-zoomed-mars-${W}.png` });
    await G(() => { window.SSX_FIT_NOKICK = false; }); await sleep(1600);
    a = await G(audit); ok(`${W}.afterInputZoomKick`, JSON.stringify(a), a.scale < 1.01 && a.over.length === 0);
    await unzoom();
    a = await G(audit); ok(`${W}.unzoomedBack`, JSON.stringify(a), !a.fit && a.over.length === 0);
    if (W === 390) await page.screenshot({ path: out + `fit-mars-hud-${W}.png` });
    // rotate to landscape and back
    await page.setViewportSize({ width: H + 180, height: W }); await G(() => dispatchEvent(new Event('orientationchange'))); await sleep(1500);
    a = await G(audit); ok(`${W}.landscape`, JSON.stringify(a), a.sw <= a.iw && a.over.length === 0);
    if (W === 390) await page.screenshot({ path: out + `fit-mars-landscape-${W}.png` });
    await page.setViewportSize({ width: W, height: H }); await G(() => dispatchEvent(new Event('orientationchange'))); await sleep(1500);
    a = await G(audit); ok(`${W}.portraitAgain`, JSON.stringify(a), a.sw <= a.iw && a.over.length === 0);
    if (W === 390) await page.screenshot({ path: out + `fit-mars-hud-rotated-back-${W}.png` });
    ok(`${W}.noErrors`, JSON.stringify(errors.slice(0, 3)), errors.length === 0);
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS'); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
