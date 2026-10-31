// ☰ 👕 Wardrobe extras (mars/skins.js): unowned outfits as compact 🔒 rows (name + price) under the owned ones, a
// 'Shop all outfits' button that sets the HUD waypoint (➤ + blue beam) to the Threadbare counter and closes the panel, and
// at the counter a Buy button per locked row that goes through the shop's buy() (credits, ownership, auto-wear; greyed and
// refused when you can't afford it; a swipe never buys). The panel stays black / white and does not grow past 56vh.
// BASE=http://127.0.0.1:8977/ BR=webkit DEV=393x852 QS='look=classic&models=1' SHOTS_DIR=... node tests/test-wardrobe.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8977/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852', QS = process.env.QS ?? 'look=classic&models=1';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `wardrobe-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message); }); page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const toastTx = () => G(() => document.getElementById('toast')?.textContent || '');
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return true; }, [t, sel, id, dx, dy]);
  const tap = async sel => { const a = await P('pointerdown', sel, 61); await sleep(40); await P('pointerup', sel, 61); await sleep(120); return a; };
  const cr = () => G(() => window.__app.surface.game.progress.credits);
  const setCr = n => G(n => { window.__app.surface.game.progress.credits = n; }, n);
  const S = () => G(() => window.SSX.skins.state());
  const open = () => G(() => document.getElementById('skPanel')?.classList.contains('open'));
  const rows = () => G(() => ({ owned: [...document.querySelectorAll('#skPanel .row')].map(r => r.dataset.id), locked: [...document.querySelectorAll('#skPanel .lk')].map(r => r.dataset.id), buys: [...document.querySelectorAll('#skPanel .lk button[data-a="wbuy"]')].map(b => b.dataset.id + (b.classList.contains('no') ? ':no' : '')) }));
  const viaMenu = async () => { await tap('#menuBtn'); await wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000);
    await G(() => document.getElementById('rmWardrobe')?.scrollIntoView({ block: 'center' })); await sleep(500); await tap('#rmWardrobe');
    return wait(() => document.getElementById('skPanel').classList.contains('open') && /Wardrobe/.test(document.querySelector('#skPanel .t').textContent), 4000); };
  const atShop = async (d = 3) => { await G(d => { const p = window.SSX.skins.at(); window.__app.surface.debugPlace(p.x - Math.sin(p.yaw) * d, p.z - Math.cos(p.yaw) * d, p.yaw + Math.PI); }, d); await sleep(900); };
  try {
    await page.goto(base + '?' + QS + (QS ? '&' : '') + 't=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1000);
    if (await G(() => { const r = document.getElementById('radio'); return !!r && getComputedStyle(r).display !== 'none'; })) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } try { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.SSX.time?.set?.(13); window.SSX.time?.freeze?.(true); window.SSX.hudx?.setWaypoint?.(null, true); } catch (e) { /* */ } });
    await wait(() => !!window.SSX?.skins && !!window.__skins?.stall?.(), 20000);
    // ~45 m out from the counter, facing it (Collin's case: Wardrobe opened from ☰ in the street, 409 cr)
    const T = await G(() => { const p = window.SSX.skins.at(); return { x: p.x - Math.sin(p.yaw) * 1.5, z: p.z - Math.cos(p.yaw) * 1.5, yaw: p.yaw }; });
    await G(T => { const d = 45, x = T.x - Math.sin(T.yaw) * d, z = T.z - Math.cos(T.yaw) * d; window.__app.surface.debugPlace(x, z, Math.atan2(-(T.x - x), -(T.z - z))); }, T); await sleep(900);
    await setCr(409);
    ok('farFromStall', await G(() => !window.SSX.skins.near()));
    ok('wardrobeOpens', await viaMenu());
    const r0 = await rows();
    ok('ownedRowsUnchanged', r0.owned, r0.owned.join() === 'stock,rusty');
    ok('lockedRows', r0.locked, r0.locked.join() === 'punk,overalls,biker,hazmat,hustler,cowboy,alien,clown,kingpin,chrome');
    ok('lockedLook', await G(() => { const r = document.querySelector('#skPanel .lk'); return { t: r.textContent, h: Math.round(r.getBoundingClientRect().height) }; }), await G(() => { const r = document.querySelector('#skPanel .lk'); return /🔒/.test(r.textContent) && /Ripped Punk/.test(r.textContent) && /300 cr/.test(r.textContent) && r.getBoundingClientRect().height <= 40; }));
    ok('noBuyFar', r0.buys, r0.buys.length === 0);
    const sty = await G(() => { const p = document.getElementById('skPanel'), c = getComputedStyle(p), r = p.getBoundingClientRect(), l = p.querySelector('.list'); return { bg: c.backgroundColor, fg: c.color, h: Math.round(r.height), vh: innerHeight, scroll: l.scrollHeight > l.clientHeight }; });
    ok('blackWhiteCompact', sty, sty.bg === 'rgb(0, 0, 0)' && sty.fg === 'rgb(255, 255, 255)' && sty.h <= Math.ceil(sty.vh * 0.56) + 4);
    ok('shopBtn', await G(() => document.querySelector('#skPanel button[data-a="goshop"]')?.textContent), /Shop all outfits/.test(await G(() => document.querySelector('#skPanel button[data-a="goshop"]')?.textContent || '')));
    await sleep(300); await shot('1-locked-far');
    // a swipe over 'Shop all outfits' does nothing
    await P('pointerdown', '#skPanel button[data-a="goshop"]', 71); await P('pointermove', '#skPanel button[data-a="goshop"]', 71, 0, -30); await P('pointerup', '#skPanel button[data-a="goshop"]', 71, 0, -30); await sleep(200);
    ok('swipeNoWaypoint', await G(() => window.SSX.hudx?.waypoint?.() || null), (await open()) && !(await G(() => window.SSX.hudx?.waypoint?.())));
    await tap('#skPanel button[data-a="goshop"]'); await sleep(900);
    const wp = await G(() => window.SSX.hudx?.waypoint?.() || null), bm = await G(() => window.SSX.wpbeam?.state?.() || null);
    ok('waypointSet', wp, !!wp && /Threadbare/.test(wp.label) && Math.hypot(wp.x - T.x, wp.z - T.z) < 0.5);
    ok('beamAtStall', bm && { visible: bm.visible, x: bm.x, z: bm.z }, !bm || (bm.visible && Math.hypot(bm.x - T.x, bm.z - T.z) < 0.5));
    ok('panelClosed', !(await open()));
    ok('waypointToast', await toastTx(), /Waypoint/.test(await toastTx()));
    await sleep(600); await shot('2-shop-waypoint');
    // at the counter: Buy buttons on the locked rows (punk affordable at 409, the rest greyed)
    await atShop(3);
    ok('nearStall', await G(() => window.SSX.skins.near()));
    ok('wardrobeOpensNear', await viaMenu());
    const r1 = await rows();
    ok('buyButtonsNear', r1.buys, r1.buys.length === 10 && r1.buys[0] === 'punk' && r1.buys.slice(1).every(b => /:no$/.test(b)));
    ok('openShopBtnNear', await G(() => document.querySelector('#skPanel button[data-a="goshop"]')?.textContent || ''), /Open shop/.test(await G(() => document.querySelector('#skPanel button[data-a="goshop"]')?.textContent || '')));
    await sleep(300); await shot('3-near-buy');
    // greyed: refused, nothing spent; a swipe over Buy never buys
    await tap('#skPanel .lk[data-id="overalls"] button'); await sleep(300);
    ok('brokeRefused', { t: await toastTx(), cr: await cr() }, /Farm Overalls is 450 cr/.test(await toastTx()) && (await cr()) === 409 && !(await S()).owned.includes('overalls'));
    await P('pointerdown', '#skPanel .lk[data-id="punk"] button', 72); await P('pointermove', '#skPanel .lk[data-id="punk"] button', 72, 0, -25); await P('pointerup', '#skPanel .lk[data-id="punk"] button', 72, 0, -25); await sleep(200);
    ok('swipeNoBuy', { cr: await cr(), owned: (await S()).owned }, (await cr()) === 409 && !(await S()).owned.includes('punk'));
    await tap('#skPanel .lk[data-id="punk"] button'); await sleep(400);
    const s1 = await S(), r2 = await rows();
    ok('boughtPunk', { s1, cr: await cr(), toast: await toastTx() }, s1.owned.includes('punk') && s1.eq === 'punk' && s1.applied === 'punk' && (await cr()) === 109);
    ok('rowsAfterBuy', r2, r2.owned.join() === 'stock,rusty,punk' && !r2.locked.includes('punk') && r2.locked.length === 9 && (await open()));
    ok('sameAsShop', await G(() => { const k = JSON.parse(localStorage.getItem('ssx.skins.v1')); return k.owned.includes('punk') && k.eq === 'punk'; }));
    await sleep(300); await shot('4-after-buy');
    // walk away with it open: the Buy buttons go
    await G(() => { const p = window.SSX.skins.at(); window.__app.surface.debugPlace(p.x + 30, p.z + 30, 0); }); await sleep(1300);
    ok('buyGoneFar', (await rows()).buys, (await rows()).buys.length === 0 && (await open()));
    ok('farBuyRefused', await G(() => window.SSX.skins.wardrobeBuy('biker').why), (await G(() => window.SSX.skins.wardrobeBuy('biker').why)) === 'far');
  } catch (e) { bad.push('EXC ' + e.message); console.log(e.stack); }
  ok('noErrors', errors.slice(0, 5), errors.length === 0);
  R.bad = bad; console.log(bad.length ? `FAIL ${tag}: ${bad.join(', ')}` : `ALL PASS ${tag}`);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
