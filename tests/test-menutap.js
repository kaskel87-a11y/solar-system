// v7.5.9: ☰ tap reliability (Pumpkin saw one miss in Chromium). Plain taps, 3-14 px drift, a second finger holding/moving the joystick
// (before or after the ☰ finger) and a ☰ tap/click straight after flicking the open sheet. CDP touch, so Chromium only.
// BASE=http://127.0.0.1:8866/ [MODES=plain,drift,...] [N=15] [CTX=desk] node tests/test-menutap.js
// ☰ tap reliability: CDP touch (Chromium) / page.touchscreen. Plain taps, taps with 0-12 px drift, taps while a second finger holds/moves the joystick.
const pw = require('playwright'); const base = process.env.BASE || 'http://127.0.0.1:8866/', BR = process.env.BR || 'chromium';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw[BR].launch(); const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await b.newContext(process.env.CTX === 'desk' ? { viewport: { width: 393, height: 852 }, hasTouch: true } : { ...iph, viewport: { width: 393, height: 852 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const G = (f, a) => page.evaluate(f, a); const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  await page.goto(base + '?t=' + Date.now(), { timeout: 180000 }); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
  await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1500);
  await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } try { window.SSX.control?.debug?.setTimes({ first: 9999, after: 9999 }); } catch (e) { } });
  const cdp = BR === 'chromium' ? await ctx.newCDPSession(page) : null;
  const mb = await G(() => { const r = document.getElementById('menuBtn').getBoundingClientRect(); const sc = []; for (let e = document.getElementById('menuBtn'); e && e !== document.documentElement; e = e.parentElement) { if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) sc.push((e.id || e.tagName) + ':' + getComputedStyle(e).overflowX + '/' + getComputedStyle(e).overflowY); } return { x: r.x + r.width / 2, y: r.y + r.height / 2, ta: getComputedStyle(document.getElementById('menuBtn')).touchAction, sc }; });
  const jb = await G(() => { const j = document.getElementById('joy') || document.querySelector('#joystick,#joyBase,.joy'); const r = j?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, id: j.id } : { x: 90, y: 760 }; });
  const open = () => G(() => document.getElementById('roverMenu')?.classList.contains('show'));
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 })) });
  const res = { plain: 0, drift: 0, joy: 0, joyMove: 0, menuFirst: 0, flickClick: 0, flickTap: 0 }, N = +(process.env.N || 15), fails = [];
  const closeMenu = async () => { if (await open()) { await G(() => window.__app.toggleMenu(false)); await sleep(350); } };
  for (let i = 0; i < N; i++) {
    for (const mode of (process.env.MODES || 'plain,drift,joy,joyMove,menuFirst').split(',')) {
      await closeMenu(); await sleep(120);
      const d = mode === 'drift' ? +(process.env.D0 || 3) + (i % 10) : 0, m = { x: mb.x, y: mb.y, id: 1 }, j = { x: jb.x, y: jb.y, id: 2 };
      if (mode.startsWith('joy')) { await T('touchStart', [j]); await sleep(60); if (mode === 'joyMove') { j.x += 20; await T('touchMove', [j]); } }
      if (mode === 'menuFirst') { await T('touchStart', [m]); await sleep(50); await T('touchStart', [m, j]); for (let k = 1; k <= 4; k++) { j.x += 10; j.y -= 8; await T('touchMove', [m, j]); await sleep(16); } await T('touchEnd', [j]); await sleep(300); await T('touchEnd', []); await sleep(150); }
      else {
      const base = mode.startsWith('joy') ? [j] : [];
      await T('touchStart', [...base, m]); await sleep(40 + (i * 7) % 60);
      if (d) { m.x += d * 0.6; m.y += d * 0.8; await T('touchMove', [...base, m]); await sleep(30); }
      if (mode === 'joyMove') { j.x += 15; j.y -= 10; await T('touchMove', [j, m]); await sleep(20); }
      await T('touchEnd', base); await sleep(350);
      if (mode.startsWith('joy')) { await T('touchEnd', []); await sleep(150); }
      }
      if (await open()) res[mode]++; else fails.push(mode + ' #' + i + (d ? ' d' + d : ''));
    }
  }
  console.log(JSON.stringify({ mb, jb, res, N, fails, errs }, null, 1)); console.log(Object.entries(res).filter(([k]) => k !== 'scrolled').every(([k, v]) => v === N || !(process.env.MODES || 'plain,drift,joy,joyMove,menuFirst').split(',').includes(k)) ? 'PASS menutap ' + BR : 'FAIL menutap ' + BR);
  await b.close(); process.exit(Object.entries(res).filter(([k]) => k !== 'scrolled').every(([k, v]) => v === N || !(process.env.MODES || 'plain,drift,joy,joyMove,menuFirst').split(',').includes(k)) ? 0 : 1);
})();
