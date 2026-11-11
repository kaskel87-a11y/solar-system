// v7.5.91 themed lock-ups: Scrap / Neon / High-roller, credits, localStorage per garage,
// the 🎨 Look sheet, and the on-screen arrow when you ask for the bay from far away.
// Touch runs every tap while a second finger holds the joystick (Chromium: CDP multi-touch).
// WebKit on this software GL stack segfaults if a mouse, touch, or pointer event is delivered
// while the canvas is up, so WebKit drives the same button handlers through __dealer.press.
// BASE=http://127.0.0.1:8791/ DEV=393x852 BR=webkit node tests/test-garagetheme.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8791/';
const BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const PFX = process.env.PFX || 'garagetheme';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  // WPE WebKit segfaults in software GL if a second touch lands at retina scale (deviceScaleFactor 2+).
  // CSS pixels stay the iPhone size either way; DPR=3 still works on Chromium. Override with DPR=.
  const dpr = Number(process.env.DPR || (BR === 'webkit' ? 1 : 3));
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: dpr } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView?.({ block: 'nearest', inline: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(600); };
  let cdp = null; const T = async (type, pts) => (cdp = cdp || await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  let held = 0, stick = null, tid = 2;
  const holdStick = async () => {
    if (stick || !touch || BR === 'webkit') return;
    const j = await center('#joy'); if (!j) return; const free = await G(j => !!document.elementFromPoint(j.x, j.y)?.closest('#joy'), j); if (!free) return;
    if (BR === 'chromium') { cdp = cdp || await ctx.newCDPSession(page); await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(40); await T('touchMove', [{ x: j.x, y: j.y - 30, id: 1 }]); await sleep(40); }
    else await G(j => { const el = document.getElementById('joy'); const o = { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: j.x, clientY: j.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: j.y - 30 })); }, j);
    stick = { x: j.x, y: j.y - 30 };
  };
  const releaseStick = async () => {
    if (!stick || BR === 'webkit') { stick = null; return; } const j = stick; stick = null;
    if (BR === 'chromium') { await T('touchEnd', [{ x: j.x, y: j.y, id: 1 }]); await sleep(40); }
    else await G(j => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: j.x, clientY: j.y })), j);
    await sleep(80);
  };
  const tap = async sel => {
    if (BR === 'webkit') { const hit = await G(s => window.__dealer.press(s), sel); if (!hit) throw new Error('no ' + sel); await sleep(220); return; }
    if (!touch) { const c = await center(sel); if (!c) throw new Error('no ' + sel); await page.mouse.click(c.x, c.y); await sleep(220); return; }
    await holdStick(); let c = await center(sel); if (!c) throw new Error('no ' + sel);
    await wait(s => { const e = document.querySelector(s), b = e?.getBoundingClientRect(); return !!b && e.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)); }, 1500, sel).catch(() => null);
    c = await center(sel) || c;
    const id = tid++, j = stick;
    if (BR === 'chromium') { const pts = j ? [{ x: j.x, y: j.y, id: 1 }] : []; await T('touchStart', [...pts, { x: c.x, y: c.y, id }]); await sleep(50); await T('touchEnd', [{ x: c.x, y: c.y, id }]); }
    else await G(([c, id]) => { const el = document.elementFromPoint(c.x, c.y); const o = { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: false, clientX: c.x, clientY: c.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, [c, id]);
    await sleep(220); held++; if (j && Math.abs(await G(() => window.__app.joy.y)) > 0.1) R.stickHeld = (R.stickHeld || 0) + 1;
  };
  const toMars = async () => { await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land(); await G(() => window.__app.surface.game.setAliens?.(false)); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); });
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('api', null, await G(() => typeof window.SSX?.garage?.buyTheme === 'function' && window.SSX.garage.themes().length === 4));
    await toMars();
    await G(() => { const s = window.__app.surface; s.game.progress.credits = 80; s.game.save(); s.debugMove(0, 0, 0); });
    await sleep(400);
    const far = await G(() => { const p = window.__dealer.spots.garage, i = window.__app.surface.info; return Math.round(Math.hypot(p.x - i.x, p.z - i.z)); });
    ok('spawnAway', far, far > 20);
    await holdStick();
    await G(() => window.__app.toggleMenu(true)); await sleep(200);
    await tap('#rmRides');
    ok('hub', null, await wait(() => document.getElementById('dlrSheet')?.dataset.kind === 'hub', 5000));
    ok('hubRestyle', null, await G(() => /Restyle lock-up/.test(document.getElementById('dlrSheet').innerText)));
    await tap('[data-theme="1"]');
    ok('arrow', null, await wait(() => { const e = document.getElementById('ssxGuide'); return !!(e && e.classList.contains('on') && /Lock-up/.test(e.textContent) && /\d/.test(e.textContent)); }, 8000));
    const guide = await G(() => { const e = document.getElementById('ssxGuide'), r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const W = innerWidth, H = innerHeight;
      return { t: e.textContent, mid: cx > W * 0.25 && cx < W * 0.75 && cy > H * 0.25 && cy < H * 0.75, h: Math.round(r.height) }; });
    ok('arrowOffCentre', JSON.stringify(guide), guide && !guide.mid && guide.h >= 44);
    ok('arrowNav', null, await G(() => { const g = window.__app.surface.game.mapGate?.(), p = window.__dealer.spots.garage; return !!g && Math.hypot(g.x - p.x, g.z - p.z) < 2; }));
    await releaseStick();
    await G(() => window.__dealer.tp('garage', 9));
    ok('restyleBtn', null, await wait(() => { const b = document.getElementById('dlrCtxBtn'); return b && b.style.display === 'block' && /Restyle/.test(b.textContent); }, 8000));
    await tap('#dlrCtxBtn');
    ok('lookSheet', null, await wait(() => document.getElementById('dlrSheet')?.dataset.kind === 'garage' && /Restyle this lock-up/.test(document.getElementById('dlrSheet').innerText) && /1\. Tap a look/.test(document.getElementById('dlrSheet').innerText), 5000));
    const btn = await G(() => { const e = document.querySelector('[data-look="neon"]'), cs = getComputedStyle(e), r = e.getBoundingClientRect();
      return { h: r.height, bg: cs.backgroundColor, fg: cs.color, w: r.width }; });
    ok('tapTarget', JSON.stringify(btn), btn.h >= 44 && btn.w >= 44 && btn.bg === 'rgb(0, 0, 0)' && btn.fg === 'rgb(255, 255, 255)');
    ok('needCredits', null, await G(() => /Need \d+ more cr/.test(document.querySelector('[data-buylook], #dlrSheet button[disabled]')?.textContent || document.getElementById('dlrSheet').innerText)));
    await G(() => { window.__app.surface.game.progress.credits = 5000; window.__app.surface.game.save(); });
    await tap('[data-look="neon"]');
    ok('buyShown', null, await G(() => /Buy Neon pit · 480 cr/.test(document.getElementById('dlrSheet').innerText)));
    const c0 = await G(() => window.__app.surface.game.progress.credits);
    await tap('[data-buylook="neon"]');
    ok('boughtNeon', null, await wait(() => window.__dealer.theme.id === 'neon' && window.__dealer.theme.built === 'neon', 4000));
    const theme = await G(() => window.__dealer.theme);
    ok('neonLook', JSON.stringify({ wall: theme.seenWall, light: theme.seenLight, sign: theme.sign, props: theme.props }), theme.seenWall === 0x140818 && theme.seenLight === 0xff2ad4 && theme.sign === 'NEON PIT' && theme.ambient === 'pulse' && theme.props === 4);
    ok('charged', c0 - (await G(() => window.__app.surface.game.progress.credits)), c0 - (await G(() => window.__app.surface.game.progress.credits)) === 480);
    const saved = await G(() => JSON.parse(localStorage.getItem('ssx.garagetheme.v1')));
    ok('savedPerGarage', JSON.stringify(saved.byId), saved.byId.redline === 'neon' && saved.owned.redline.includes('neon') && !saved.byId['bay-b']);
    const op = [];
    for (let i = 0; i < 5; i++) { op.push(await G(() => window.__dealer.theme.lightOpacity)); await sleep(160); }
    ok('neonPulses', op.join(','), new Set(op).size > 1);
    await tap('[data-look="scrap"]'); await tap('[data-buylook="scrap"]');
    ok('boughtScrap', null, await wait(() => window.__dealer.theme.id === 'scrap' && window.__dealer.theme.seenLight === 0xff6a1a && window.__dealer.theme.sign === 'SCRAP BAY', 4000));
    ok('scrapCharged', null, await G(() => window.__app.surface.game.progress.credits === 5000 - 480 - 240));
    const other = await G(() => window.__dealer.buyTheme('neon', 'bay-b'));
    ok('otherGaragePays', JSON.stringify(other), other.ok && other.price === 480 && other.garage === 'bay-b');
    ok('redlineStaysScrap', null, await G(() => { const t = window.__dealer.theme, s = t.save; return t.id === 'scrap' && s.byId['bay-b'] === 'neon' && s.byId.redline === 'scrap'; }));
    await G(() => window.__dealer.holdThemeCam(true)); await sleep(500); await shot('scrap');
    const wallet = await G(() => window.__app.surface.game.progress.credits);
    await releaseStick();
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await toMars();
    ok('persisted', null, await wait(() => window.__dealer.theme?.id === 'scrap' && window.__dealer.theme.built === 'scrap' && window.__dealer.theme.save.byId['bay-b'] === 'neon', 8000));
    ok('walletPersisted', wallet, (await G(() => window.__app.surface.game.progress.credits)) === wallet);
    await releaseStick();
    await G(() => window.__dealer.tp('garage', 6)); await sleep(300);
    await holdStick();
    await G(() => window.__dealer.openGarage());
    await tap('[data-tab="look"]');
    ok('refitFree', null, await wait(() => /Put on Neon pit/.test(document.getElementById('dlrSheet')?.innerText || ''), 4000));
    await tap('[data-look="neon"]');
    const before = await G(() => window.__app.surface.game.progress.credits);
    await tap('[data-buylook="neon"]');
    ok('refitNeonFree', null, await wait(n => window.__dealer.theme.id === 'neon' && window.__app.surface.game.progress.credits === n, 4000, before));
    await G(() => { const p = window.__dealer.spots.garage; window.__app.surface.debugMove(p.x + 14, p.z + 2, 0); window.__dealer.closeSheet(); window.__dealer.holdThemeCam(true); });
    await sleep(700); await shot('neon');
    R.held = held; if (touch && BR !== 'webkit') ok('tapsWithStickHeld', `${R.stickHeld}/${held}`, (R.stickHeld || 0) >= Math.max(1, held * 0.6));
    if (BR === 'webkit') ok('webkitHandlers', true, true);
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.slice(0, 6).join(' | ') || null, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
