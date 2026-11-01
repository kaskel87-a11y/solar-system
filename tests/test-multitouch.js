// v7.5.23 multi-touch regressions (Chromium, real CDP touches): a second finger taps while the thumb holds the joystick.
//  M2  ☰ → ✖ Close right after the menu opened / scrolled (was eaten by the swipe guard), and Close is on screen without scrolling
//  M1  🎯 Contracts → "Take the contract" with the joystick held (was click-only)
//  m2  perched on the sniper tower with officers at the base: they can't put hands on you (was BUSTED in ~6 s)
//  m3  Deimos Lockup booking card in landscape: Break out / Decide later inside the screen
// BASE=http://localhost:8765/ OUT=/tmp/ node tests/test-multitouch.js
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', DEV = process.env.DEV || 'iPhone SE';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = DEV.replace(/\W+/g, '-').toLowerCase(), G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const cdp = await ctx.newCDPSession(page);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const ctr = s => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width < 2) return null; return [r.x + r.width / 2, r.y + r.height / 2]; }, s);
  let J = null;
  const hold = async () => { const j = await ctr('#joy'); await T('touchStart', [[j[0], j[1], 0]]); await sleep(80); J = [j[0], j[1] - 25, 0]; await T('touchMove', [J]); await sleep(150); };
  const release = async () => { await T('touchEnd', [J]); J = null; await sleep(200); };
  let fid = 10; const tap2 = async pt => { const id = ++fid; await T('touchStart', [J, [pt[0], pt[1], id]]); await sleep(70); await T('touchEnd', [[pt[0], pt[1], id]]); await sleep(120); };
  const inView = s => G(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5 && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest(s) != null; }, s);
  const menuOpen = () => G(() => document.getElementById('roverMenu').classList.contains('show'));
  try {
    await page.goto(base + '?onboard=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(1500);
    await G(() => { const r = document.getElementById('radio'); if (r && getComputedStyle(r).display !== 'none') document.getElementById('radioLater')?.click(); window.__app.game.setAliens?.(false); window.__app.game.progress.credits = 5000; });
    await sleep(400);
    // ---- M2: ☰ open, Close 50 ms later, with the joystick held; then again right after the menu scrolled ----
    const closes = [];
    for (const mode of ['fresh', 'scrolled', 'fresh2']) {
      await hold(); await tap2(await ctr('#menuBtn')); const opened = await menuOpen();
      if (mode === 'scrolled') { await G(() => { const m = document.getElementById('roverMenu'); m.scrollTop = 120; }); }
      await sleep(50); const vis = await inView('#rmClose'); await tap2(await ctr('#rmClose')); await sleep(150);
      closes.push({ mode, opened, closeVisible: vis, closed: !(await menuOpen()) }); await release();
      await G(() => document.getElementById('roverMenu').classList.remove('show')); await sleep(250);
    }
    ok('menuCloseHeld', closes, closes.every(c => c.opened && c.closeVisible && c.closed));
    // swipe guard still works: a drag that starts on a menu button doesn't fire it
    await hold(); await tap2(await ctr('#menuBtn'));
    const vb = await ctr('#viewBtn'); const view0 = await G(() => window.__app.surface.info?.view ?? document.getElementById('viewBtn').textContent);
    { const id = ++fid; await T('touchStart', [J, [vb[0], vb[1], id]]); for (let k = 1; k <= 4; k++) { await T('touchMove', [J, [vb[0], vb[1] - k * 12, id]]); await sleep(20); } await T('touchEnd', [[vb[0], vb[1] - 48, id]]); await sleep(300); }
    ok('swipeNoFire', await G(v => (window.__app.surface.info?.view ?? document.getElementById('viewBtn').textContent) === v, view0) && await menuOpen());
    await release(); await G(() => document.getElementById('roverMenu').classList.remove('show')); await sleep(250);
    // ---- M1: Contracts → Take the contract with a second finger ----
    // thumb down on the joystick first, then ☰ 🎯 Contracts opens over it (as a player does), then a second finger taps Take
    await hold(); await G(() => { window.SSX.sniper.debug.reset(); window.SSX.sniper.open(); document.querySelector('#snPanel button[data-c]')?.scrollIntoView({ block: 'nearest' }); }); await sleep(400);
    await G(() => { window.__ev = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'click']) window.addEventListener(t, e => window.__ev.push(`${t}#${e.pointerId}@${e.target.id || e.target.tagName}`), true); });
    await tap2(await ctr('#snPanel button[data-c]')); await sleep(300); await release();
    R.ev = await G(() => window.__ev.join(' '));
    const act = await G(() => window.SSX.sniper.active());
    ok('contractTakenHeld', act ? act.id : null, !!act && !(await G(() => document.getElementById('snPanel').classList.contains('show'))));
    // ---- m2: perched on the tower, officers at the base, 2 stars: no bust ----
    ok('perched', await G(() => window.SSX.sniper.debug.climb()));
    const tw = await G(() => window.SSX.sniper.debug.tower());
    await G(tw => { const W = window.__app.surface.world; W.setWanted(2); for (let k = 0; k < 2; k++) W.debug.spawnSecurity('officer', { x: tw.x + 2 + k, z: tw.z + 2 }); }, tw);
    let minD = 1e9; const busts0 = await G(() => window.SSX.consequences?.status().stats?.busted ?? 0);
    for (let k = 0; k < 20; k++) { await sleep(500); const d = await G(() => { const i = window.__app.surface.info; return Math.min(1e9, ...window.__app.surface.world.debug.security?.() .map(s => Math.hypot(s.x - i.x, s.z - i.z)) || [1e9]); }).catch(() => 1e9); minD = Math.min(minD, d); (R.trace ??= []).push(await G(() => { const i = window.__app.surface.info, c = window.SSX.consequences?.status(); return [window.SSX.sniper.debug.perched() ? 'P' : '-', Math.round(i.y ?? -1), c?.pending ? 'pend' : '', c?.custody ? 'cust' : '', window.__app.surface.world.wanted].join(''); }).catch(e => 'x')); }
    const st = await G(() => ({ c: window.SSX.consequences?.status(), wanted: window.__app.surface.world.wanted, perched: window.SSX.sniper.debug.perched() }));
    ok('towerNoBust', { minD: Math.round(minD * 10) / 10, wanted: st.wanted, perched: st.perched, pending: st.c?.pending, custody: !!st.c?.custody }, !st.c?.pending && !st.c?.custody && st.perched);
    await G(() => { window.SSX.sniper.stop(); window.__app.surface.world.setWanted(0, 'debug'); });
    await sleep(500);
    // ---- m3: landscape booking card ----
    await page.setViewportSize({ width: 844, height: 390 }); await sleep(600);
    await G(() => { window.__app.surface.world.setWanted(2); window.__app.game.bust(); });
    ok('booked', await wait(() => window.SSX.consequences.status().custody?.inCell, 90000));
    await wait(() => !document.getElementById('cqScreen').classList.contains('on'), 20000); await sleep(400);
    const bk = await G(() => [...document.querySelectorAll('#cqPanel button[data-a]')].map(b => { const r = b.getBoundingClientRect(); return { a: b.dataset.a, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; }));
    ok('bookingFitsLandscape', bk, bk.length >= 6 && bk.every(b => b.top >= 0 && b.bottom <= 390 && b.h >= 44));
    await page.screenshot({ path: out + `multitouch-booking-landscape-${tag}.png` });
    // Decide later with the joystick held? (joystick is hidden in custody) - plain tap must close it
    const dl = await ctr('#cqPanel button[data-a="close"]'); await page.touchscreen.tap(dl[0], dl[1]); await sleep(300);
    ok('decideLater', await G(() => !document.getElementById('cqPanel').classList.contains('show')));
  } catch (e) { bad.push('threw ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.length ? errors.slice(0, 5) : 'none', errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
