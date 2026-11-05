// v7.5.50 screen-fit sweep (Collin: screen display is the top issue): tutorial card text never cut off; no button/HUD/menu
// off-screen or clipped on SE / 15 / Pro Max portrait + landscape; ☰ rows open their panel with the joystick held (SE m2);
// a Vesna offer card you opened stays open (with Accept) while toasts come and go (m1).
// BASE=http://127.0.0.1:8990/ DEV="iPhone SE" OUT=/workspace/vpfit/v50/ node tests/test-v7550.js
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', DEV = process.env.DEV || 'iPhone SE', out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const { defaultBrowserType: _d, ...dev } = pw.devices[DEV]; const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  const tag = DEV.replace(/\W+/g, '-').toLowerCase(), G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, c) => { if (c === undefined) c = v; R[k] = v ?? !!c; if (!c) bad.push(k); };
  const ctr = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; }, sel);
  const ctrText = (sel, re) => G(([s, re]) => { const b = [...document.querySelectorAll(s)].find(b => new RegExp(re).test(b.textContent) && b.getBoundingClientRect().width); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, [sel, re]);
  let held = null, fid = 10;
  const holdJoy = async () => { const j = await ctr('#joy'); held = [j[0], j[1] - 22]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: j[0], y: j[1], id: 0 }] }); await sleep(80); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: held[0], y: held[1], id: 0 }] }); await sleep(200); };
  const tapHeld = async pt => { if (!pt) return false; const id = ++fid; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: held[0], y: held[1], id: 0 }, { x: pt[0], y: pt[1], id }] }); await sleep(90); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: pt[0], y: pt[1], id }] }); await sleep(650); return true; };
  const releaseJoy = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // everything visible + interactive or texty that sits off-screen or has its text cut
  const sweep = () => G(() => {
    const W = innerWidth, H = innerHeight, offs = [], cut = [];
    const visible = e => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
    for (const e of document.querySelectorAll('button, #obLine, #obLine .ob-t, #radio, #radioText, #stackR > *, #topBar, #miniMap, #joy, .panel, [id$="Panel"].on, [id$="Panel"].show')) {
      if (e.closest('#roverMenu:not(.show), #loading')) continue; const r = visible(e); if (!r) continue;
      let p = e.parentElement, hidden = false; while (p && p !== document.body) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') { hidden = true; break; } p = p.parentElement; } if (hidden) continue;
      const nm = e.id || (e.className && String(e.className).slice(0, 20)) || e.tagName;
      // clipped by a scroll container is fine (you can scroll to it); off the screen is not
      const sc = e.closest('#roverMenu, .ob-b, [style*="overflow-y"]'); if (!sc && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) offs.push(nm + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
      const cs = getComputedStyle(e); if (/hidden|clip/.test(cs.overflow + cs.overflowY) && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll' && e.scrollHeight > e.clientHeight + 2 && e.textContent.trim().length > 3 && e.id !== 'stackR') cut.push(nm + ' ' + e.scrollHeight + '>' + e.clientHeight);
      // stack clipping: a child pushed below the bottom of #stackR (overflow hidden) is cut off
      if (e.parentElement?.id === 'stackR') { const sr = e.parentElement.getBoundingClientRect(); if (r.bottom > sr.bottom + 1) cut.push(nm + ' below stackR ' + Math.round(r.bottom - sr.bottom)); }
    }
    return { offs, cut };
  });
  try {
    await page.goto(base + '?t=' + Date.now()); await page.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await page.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, null, { timeout: 90000 }); await sleep(1500);
    await G(() => { document.getElementById('radioLater')?.click(); window.__app.surface.game.setAliens?.(false); });
    await sleep(600);
    // ---- 1: tutorial card at every step: full text visible, never clipped by the stack ----
    const steps = await G(async () => { const o = window.SSX.onboard, res = []; if (!o?.debug) return 'no onboard';
      for (let m = 0; m < 9; m++) for (let s = 0; s < 4; s++) { o.debug.set(m, s); await new Promise(r => setTimeout(r, 380)); const l = document.getElementById('obLine'), t = l?.querySelector('.ob-t'); if (!l || l.hidden || !t) continue;
        const key = t.textContent.slice(0, 40); if (res.some(x => x.key === key)) continue; const lr = l.getBoundingClientRect(), st = l.parentElement.getBoundingClientRect();
        res.push({ m, s, key, cut: t.scrollHeight > t.clientHeight + 1, stackCut: l.parentElement.id === 'stackR' && lr.bottom > st.bottom + 1, off: lr.bottom > innerHeight || lr.right > innerWidth + 1 || lr.left < -1 }); }
      o.debug.set(0, 0); return res; });
    const stepBad = Array.isArray(steps) ? steps.filter(x => x.cut || x.stackCut || x.off) : steps;
    ok('tutorial.fits', JSON.stringify({ n: steps.length, bad: stepBad }), Array.isArray(steps) && steps.length > 5 && stepBad.length === 0);
    await G(() => window.SSX.onboard.debug.set(4, 0)); await sleep(700); await page.screenshot({ path: out + `tutorial-${tag}.png` });
    // ---- 2: layout sweep (HUD on foot, then ☰ menu) ----
    const s1 = await sweep(); ok('hud.sweep', JSON.stringify(s1), !s1.offs.length && !s1.cut.length);
    await page.touchscreen.tap(...(await ctr('#menuBtn'))); await sleep(600);
    const s2 = await sweep(); ok('menu.sweep', JSON.stringify(s2), !s2.offs.length && !s2.cut.length);
    await page.screenshot({ path: out + `menu-${tag}.png` });
    await page.touchscreen.tap(...(await ctr('#rmClose'))); await sleep(400);
    // ---- 3: m2 ☰ → Street races / Contracts with the joystick held ----
    for (const [name, re, panel] of [['races', 'Street races', () => document.getElementById('racePanel')?.classList.contains('on')], ['contracts', 'Contracts', () => document.getElementById('snPanel')?.classList.contains('show')]]) {
      await holdJoy(); await tapHeld(await ctr('#menuBtn')); const mo = await G(() => document.getElementById('roverMenu').classList.contains('show')); const pt = await ctrText('#roverMenu button', re); await sleep(400); const hitEl = pt && await G(([x, y]) => document.elementFromPoint(x, y)?.textContent?.trim().slice(0, 20), pt); await tapHeld(pt);
      const r = await G(p => ({ menuOpen: document.getElementById('roverMenu').classList.contains('show'), panel: !!(new Function('return (' + p + ')()'))() }), panel.toString()); r.hit = hitEl; r.mo = mo;
      await releaseJoy(); await sleep(300);
      ok('m2.' + name, JSON.stringify(r), !r.menuOpen && r.panel);
      await G(() => { document.getElementById('racePanel')?.classList.remove('on'); document.getElementById('snPanel')?.classList.remove('show'); document.getElementById('roverMenu').classList.remove('show'); window.SSX.sniper?.close?.(); }); await sleep(300);
    }
    // ---- 4: m1 Vesna offer opened by the player stays open through toasts ----
    const c = await G(() => window.__app.surface.info.colony);
    await G(([x, z]) => { window.__app.game.abandon?.(); document.getElementById('radio').style.display = 'none'; window.__app.surface.debugPlace(x + 8, z + 26.5, 0); }, [c.x, c.z]); await sleep(1200);
    const vb = await G(() => document.getElementById('driveBtn')?.textContent || null); let m1 = { vb };
    if (/Vesna/.test(vb || '')) { const pt = await ctr('#driveBtn'); await page.touchscreen.tap(pt[0], pt[1]); await sleep(500);
      m1.start = await G(() => ({ mini: document.getElementById('radio').classList.contains('mini'), shown: document.getElementById('radio').style.display, offer: !!document.getElementById('radioBtns')?.offsetWidth }));
      await G(() => { const t = window.SSX.city?.toast; t('test toast one'); setTimeout(() => t('test toast two'), 900); window.SSX.city?.radio?.('Ash: radio chatter test.', 'Ash'); });
      await sleep(3000);
      m1.after = await G(() => { const r = document.getElementById('radio'), a = document.getElementById('radioAccept'); const ar = a.getBoundingClientRect(); const t = document.getElementById('radioText'); return { mini: r.classList.contains('mini'), shown: r.style.display, accept: ar.width > 0 && ar.bottom <= innerHeight, textCut: t.scrollHeight > t.clientHeight + 1, cardBottom: Math.round(r.getBoundingClientRect().bottom), stackBottom: Math.round(r.parentElement.getBoundingClientRect().bottom) }; });
      await page.screenshot({ path: out + `vesna-${tag}.png` });
      const a = await ctr('#radioAccept'); if (a) await page.touchscreen.tap(a[0], a[1]); await sleep(500);
      m1.accepted = await G(() => document.getElementById('radio').style.display === 'none');
    }
    ok('m1.vesnaStaysOpen', JSON.stringify(m1), !!vb && m1.after?.accept && !m1.after.mini && !m1.after.textCut && m1.after.cardBottom <= m1.after.stackBottom + 1 && m1.accepted);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  ok('noPageErrors', JSON.stringify(errors.slice(0, 3)), errors.length === 0);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
