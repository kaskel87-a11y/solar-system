// Fast travel on Mars (mars/fasttravel.js): full map (tap the minimap) -> tap a known place -> black "Travel here" sheet ->
// short fade, 25 cr (free to your base), your car comes along. Blocked while wanted / smuggling with a plain-word toast.
// Real taps only: the same pointerId with < 10 px of movement. Swipes / scrolls on map rows, the canvas and the Travel
// button fire nothing. Touch taps are a 2nd finger while a 1st holds #joy. Frame times around the arrival are reported.
// BASE=http://localhost:8915/ BR=webkit DEV=393x852 SHOTS_DIR=... node tests/test-fasttravel.js (DEV=desktop: 1280x800)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8915/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || '393x852';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `fasttravel-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 };
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/Failed to start the audio device/.test(e.message)) errors.push('PE ' + e.message); });
  page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  // pointer events at an element's centre (+dx, dy), sent to whatever is on top there; pointerType touch
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); const x = r.left + r.width / 2 + dx, y = r.top + r.height / 2 + dy;
    const tgt = sel === '#joy' ? e : (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) || e);
    tgt.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return r.width > 0; }, [t, sel, id, dx, dy]);
  const joyDown = async () => { await P('pointerdown', '#joy', 41); await P('pointermove', '#joy', 41, 0, -4); };
  const joyUp = () => P('pointerup', '#joy', 41, 0, -4);
  // a real tap with a 2nd finger while the 1st holds the joystick
  const heldTap = async sel => { await joyDown(); const v = await P('pointerdown', sel, 42); await P('pointerup', sel, 42); await joyUp(); return v; };
  // a swipe: down, move dy px in 4 steps, up dy px away (2nd finger, joystick held)
  const swipe = async (sel, dy = 40) => { await joyDown(); await P('pointerdown', sel, 43); for (let i = 1; i <= 4; i++) await P('pointermove', sel, 43, 0, dy * i / 4); await P('pointerup', sel, 43, 0, dy); await joyUp(); };
  // a scroll that comes back to where it started
  const swipeBack = async sel => { await joyDown(); await P('pointerdown', sel, 44); await P('pointermove', sel, 44, 0, 30); await P('pointermove', sel, 44, 0, 2); await P('pointerup', sel, 44, 0, 2); await joyUp(); };
  const bw = sel => G(s => { const c = getComputedStyle(document.querySelector(s)); return c.backgroundColor === 'rgb(0, 0, 0)' && c.color === 'rgb(255, 255, 255)'; }, sel);
  const shown = sel => G(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0; }, sel);
  const FT = (fn, a) => G(([fn, a]) => window.SSX.fastTravel[fn](...(a || [])), [fn, a]);
  const sheet = () => G(() => window.SSX.fastTravel.debug.sheet());
  const credits = () => G(() => window.__app.surface.game.progress.credits);
  const here = () => G(() => { const m = window.__app.surface.mapData(); return { x: m.x, z: m.z, driving: m.driving }; });
  const toasts = () => G(() => window.SSX.fastTravel.debug.log());
  const mapOn = () => G(() => !!document.getElementById('hxMap')?.classList.contains('on'));
  const rowSel = name => G(n => { const b = [...document.querySelectorAll('#hxMap .lst .it')].find(b => b.textContent.includes(n)); if (!b) return null; b.scrollIntoView({ block: 'center' }); b.id = b.id || 'ftTestRow' + Math.random().toString(36).slice(2, 7); return '#' + b.id; }, name);
  const openMap = async () => { await G(() => window.SSX.hudx.openMap()); return wait(() => document.getElementById('hxMap')?.classList.contains('on'), 5000); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('api', await wait(() => !!window.SSX?.fastTravel && !!window.SSX?.hudx?.openMap, 20000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.__app.surface.game.progress.credits = 5000; });
    await wait(() => window.SSX.fastTravel.places().length >= 6, 20000);
    const pl = await FT('places'); R.places = pl.map(p => `${p.kind}:${p.name} @${Math.round(p.x)},${Math.round(p.z)} ${p.fee}cr`);
    for (const k of ['farm', 'post', 'spaceport', 'downtown', 'rough', 'gated', 'pit', 'club']) ok('place-' + k, pl.some(p => p.kind === k));
    // ---- the map lists them ----
    ok('mapOpen', await openMap()); await sleep(400);
    const farmRow = await rowSel('Dustbowl Homestead'); ok('farmRow', farmRow || 'missing', !!farmRow);
    await shot('map');
    // ---- swipes / scrolls never fire ----
    const wp0 = await G(() => JSON.stringify(window.SSX.hudx.objective?.()));
    await swipe(farmRow, 40); await sleep(250);
    ok('rowSwipeIgnored', JSON.stringify(await sheet()), !(await sheet()) && (await G(() => JSON.stringify(window.SSX.hudx.objective?.()))) === wp0 && await mapOn());
    await swipeBack(farmRow); await sleep(250);
    ok('rowSwipeBackIgnored', !(await sheet()) && await mapOn());
    await swipe('#hxMap canvas', 60); await sleep(250);
    ok('canvasSwipeIgnored', !(await sheet()) && await mapOn());
    // ---- a real tap (2nd finger, joystick held) shows the sheet ----
    ok('rowTap', await heldTap(farmRow)); await sleep(250);
    ok('sheetUp', JSON.stringify(await sheet()), /farm/.test((await sheet())?.id || '') && await shown('#ftSheet'));
    ok('goBW', await bw('#ftGo')); ok('sheetBW', await bw('#ftSheet'));
    ok('goLabel', await G(() => document.getElementById('ftGo').textContent), /Travel here · 25 cr/.test(await G(() => document.getElementById('ftGo').textContent)));
    ok('goTarget', await G(() => { const r = document.getElementById('ftGo').getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }), await G(() => { const r = document.getElementById('ftGo').getBoundingClientRect(); return r.height >= 44 && r.right <= innerWidth && r.bottom <= innerHeight; }));
    await shot('sheet');
    // ---- Travel here ignores a swipe ----
    const c0 = await credits(), h0 = await here();
    await swipe('#ftGo', 30); await sleep(500);
    ok('goSwipeIgnored', !(await G(() => window.SSX.fastTravel.busy)) && !(await G(() => window.SSX.fastTravel.last)) && (await credits()) === c0);
    // ---- blocked: wanted, then smuggling, plain-word toast, no travel, no charge ----
    await G(() => window.__app.surface.world.setWanted(1)); await sleep(100);
    ok('wantedTap', await heldTap('#ftGo')); await sleep(300);
    ok('wantedToast', (await toasts()).slice(-1)[0] || 'none', /wanted\. Lose the cops/.test((await toasts()).slice(-1)[0] || ''));
    ok('wantedWhyShown', await G(() => document.querySelector('#ftSheet .why').textContent), /wanted/.test(await G(() => document.querySelector('#ftSheet .why').textContent)));
    await shot('blocked');
    await G(() => window.__app.surface.world.setWanted(0));
    if (await G(() => !!window.__smuggle?.debug?.forceStart)) {
      await G(() => window.__smuggle.debug.forceStart()); await sleep(100);
      ok('smuggleTap', await heldTap('#ftGo')); await sleep(300);
      ok('smuggleToast', (await toasts()).slice(-1)[0] || 'none', /smuggling run/.test((await toasts()).slice(-1)[0] || ''));
      await G(() => window.__smuggle.debug.reset());
    }
    ok('blockedNoTravel', `${c0} -> ${await credits()}`, !(await G(() => window.SSX.fastTravel.last)) && (await credits()) === c0);
    // ---- real tap: go (on foot) ----
    await G(() => window.SSX.fastTravel.debug.hide()); await sleep(100);
    if (!(await mapOn())) await openMap();
    const fr = await rowSel('Dustbowl Homestead'); await heldTap(fr); await sleep(200);
    ok('goTap', await heldTap('#ftGo'));
    ok('arrived', await wait(() => /farm/.test(window.SSX.fastTravel.last?.id || '') && !window.SSX.fastTravel.busy, 15000));
    const farm = pl.find(p => p.kind === 'farm'), h1 = await here();
    ok('atFarm', `${Math.round(h0.x)},${Math.round(h0.z)} -> ${Math.round(h1.x)},${Math.round(h1.z)} (farm ${Math.round(farm.x)},${Math.round(farm.z)})`, Math.hypot(h1.x - farm.x, h1.z - farm.z) < 15);
    ok('paid25', `${c0} -> ${await credits()}`, c0 - (await credits()) === 25);
    ok('mapClosed', !(await mapOn()));
    ok('fadeGone', await G(() => +getComputedStyle(document.getElementById('ftFade')).opacity === 0 && getComputedStyle(document.getElementById('ftFade')).pointerEvents === 'none'));
    await sleep(2200); R.framesFoot = await G(() => window.SSX.fastTravel.debug.frames());
    await shot('arrived-farm');
    // ---- driving: the car comes along (Xen-7 Trading Post, via the API) ----
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); s.interact(); });
    ok('driving', await wait(() => window.__app.surface.mapData().driving, 8000));
    const veh = await G(() => window.__app.surface.info.vehicle);
    await sleep(500);
    const r2 = await G(() => window.SSX.fastTravel.travel('post'));
    const post = pl.find(p => p.kind === 'post'), h2 = await here();
    ok('postDriving', `${JSON.stringify({ ok: r2.ok, why: r2.why })} at ${Math.round(h2.x)},${Math.round(h2.z)} driving ${h2.driving}`, r2.ok && h2.driving && Math.hypot(h2.x - post.x, h2.z - post.z) < 18 && (await G(() => window.__app.surface.info.vehicle)) === veh);
    await sleep(2200); R.framesDriving = await G(() => window.SSX.fastTravel.debug.frames());
    await shot('arrived-post-driving');
    // ---- downtown (a district: the surface's own district hop, car along) ----
    const r3 = await G(() => window.SSX.fastTravel.travel('downtown')); const h3 = await here();
    ok('downtown', `${r3.ok} driving ${h3.driving}`, r3.ok && h3.driving);
    await sleep(2200); R.framesDistrict = await G(() => window.SSX.fastTravel.debug.frames());
    ok('alreadyHere', await G(() => window.SSX.fastTravel.why('downtown')), /already here/.test(await G(() => window.SSX.fastTravel.why('downtown'))));
    R.taps = await G(() => window.SSX.fastTravel.debug.taps());
    ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  if (bad.length) try { R.log = await toasts(); } catch (e) { /* */ }
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
