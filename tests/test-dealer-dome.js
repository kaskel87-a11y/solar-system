// Red Line Showroom Dome (Steve, follows #107): buy the dome with cr + ⭐ on the dealer sheet (two-tap confirm), see the NEW glass
// dome over the Red Line lot (roadside apron hidden), showroom isolate + Pit lights still work inside it, buy a car, fence a stolen
// ride under the dome, and the upgrade survives a reload (progress.garage.dome). Phone-first: WebKit iPhone 14 at 393x852.
// BASE=http://localhost:8796/ BR=webkit DEV=393x852 OUT=/tmp/dome/ node tests/test-dealer-dome.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852', out = process.env.OUT || '/tmp/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const desk = DEV === 'desktop', ctx = await browser.newContext(desk ? { viewport: { width: 1440, height: 900 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: BR === 'webkit' ? 3 : 2 });
  await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', x => { if (x.type() === 'error' && !/favicon|Failed to load resource/.test(x.text())) errors.push(x.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag: DEV + '-' + BR }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}dome-${R.tag}-${s}.png` });
  const boot = async () => { await page.goto(base + '?storm=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000); };
  const toMars = async () => { await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && !!window.__dealer?.spots, 150000); await sleep(1200);
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } window.__app.surface.game.setAliens?.(false); }); };
  // touch tap = pointer events (what the sheet listens to); desktop = mouse click
  const tap = async sel => { const c = await G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
    if (!c) throw new Error('no ' + sel);
    if (desk) await page.mouse.click(c.x, c.y);
    else await G(c => { const el = document.elementFromPoint(c.x, c.y); const o = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: c.x, clientY: c.y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, c);
    await sleep(300); };
  const ctxShown = re => wait(re => { const b = document.getElementById('dlrCtxBtn'); return b && b.style.display === 'block' && new RegExp(re).test(b.textContent); }, 15000, re);
  const wallet = () => G(() => ({ cr: window.__app.surface.game.progress.credits, st: window.SSX.stars.balance() }));
  try {
    await boot();
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}');
      localStorage.setItem('ssx.progress.v1', JSON.stringify({ v: 1, xp: 2000, credits: 30000, badges: [], quests: {}, equip: {} })); });
    await boot(); await toMars();
    // ---------- roadside lot (no upgrade) ----------
    ok('freshNoDome', JSON.stringify(await G(() => window.__dealer.dome)), await G(() => { const d = window.__dealer.dome; return !d.on && !d.visible && d.apron === true; }));
    await G(() => window.__dealer.tp('dealer', 13)); ok('dealerCtx', null, await ctxShown('Dealer'));
    ok('ctxRoadside', null, await G(() => !/Dome/.test(document.getElementById('dlrCtxBtn').textContent)));
    await tap('#dlrCtxBtn'); ok('dealerSheet', null, await wait(() => document.getElementById('dlrSheet')?.dataset.kind === 'dealer', 5000));
    ok('domeOffers', null, await G(() => document.querySelectorAll('[data-dome]').length === 2 && [...document.querySelectorAll('[data-dome]')].every(b => !b.disabled && b.getBoundingClientRect().height >= 44)));
    await G(() => document.querySelector('[data-dome]').scrollIntoView({ block: 'center' })); await sleep(400); await shot('1-offer');
    // ---------- buy: two taps (first arms) ----------
    const w0 = await wallet(); await tap('[data-dome="cr"]');
    ok('armedFirst', null, await G(() => /Sure\? Tap again/.test(document.querySelector('[data-dome="cr"]').textContent) && !window.__dealer.dome.on));
    await tap('[data-dome="cr"]'); ok('domeBought', null, await wait(() => window.__dealer.dome.on, 4000));
    const w1 = await wallet(); ok('charged', JSON.stringify({ cr: w0.cr - w1.cr, st: w0.st - w1.st }), w0.cr - w1.cr === 9000 && w0.st - w1.st === 300);
    ok('domeVisible', JSON.stringify(await G(() => window.__dealer.dome)), await G(() => { const d = window.__dealer.dome; return d.visible && d.apron === false && typeof d.at === 'number'; }));
    ok('sheetOwned', null, await G(() => !document.querySelector('[data-dome]') && /Showroom Dome/.test(document.getElementById('dlrSheet').innerText)));
    ok('buyAgainRefused', null, await G(() => !window.__dealer.buyDome('stars').ok));
    // ---------- showroom isolate + Pit lights inside the dome ----------
    await tap('[data-dsel="red_comet"]'); await sleep(1200);
    ok('showroomIsolate', JSON.stringify(await G(() => window.__dealer.showroom)), await G(() => { const s = window.__dealer.showroom; return s.on && s.kind === 'red_comet' && window.__dealer.dome.visible; }));
    await shot('2-showroom');
    const c0 = (await wallet()).cr; await tap('[data-buy="red_comet"]');
    ok('carBought', null, await wait(() => window.__dealer.garage.rides.some(r => r.kind === 'red_comet'), 4000)); ok('carCharged', c0 - (await wallet()).cr, c0 - (await wallet()).cr === 1900);
    await G(() => window.__dealer.closeSheet()); await sleep(300);
    // ---------- outside + inside views ----------
    await G(() => { const s = window.__app.surface, p = window.__dealer.spots.dealer; s.debugPlace(p.x - 12, p.z + 34, 0); }); await sleep(1800); await shot('3-outside');
    if (process.env.WIDE) { await G(() => { const p = window.__dealer.spots.dealer, h = window.__dealer.heightAt(p.x, p.z); window.__wideCam = (dt, c) => { c.camera.position.set(p.x - 12 + 45, h + 38, p.z + 2 + 70); c.camera.lookAt(p.x - 12, h + 4, p.z + 2); }; window.SSX_TICKS.push((dt, c) => window.__wideCam?.(dt, c)); }); await sleep(1200); await shot('3b-wide'); await G(() => { window.__wideCam = null; }); }
    await G(() => window.__dealer.tp('dealer', 10)); await sleep(1500); ok('ctxDome', null, await ctxShown('Dealer · Dome')); await shot('4-inside');
    // ---------- fence a stolen ride under the dome ----------
    const lot = await G(() => { const d = window.__dealer.lotCenter; return { x: d.x, z: d.z }; });
    await G(([x, z]) => window.__app.surface.debugPlace(x - 30, z, 0), [lot.x, lot.z]); await sleep(1000);
    R.steal = await G(([x, z]) => { const S = window.__app.surface; const vs = (S.world.parkedVehicles() || []).filter(v => v.kind !== 'rover' && v.kind !== 'magnet_crane' && !v.owned); vs.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)); const v = vs[0]; if (!v) return null; v.x = x - 27; v.z = z; v.group?.position.set(v.x, v.group.position.y, v.z); return v.kind; }, [lot.x, lot.z]);
    await sleep(600); await G(() => window.__app.surface.interact()); await sleep(1200);
    await G(() => { window.SSX_TICKS.push((dt, tc) => { window.__tc = tc; }); }); await wait(() => !!window.__tc, 10000);
    ok('stoleCar', R.steal, await G(() => !!window.__tc.car && window.__tc.car !== window.__tc.rover));
    await G(([x, z]) => { const c = window.__tc.car; c.x = x; c.z = z; c.speed = 0; window.__app.surface.world.setWanted?.(0); }, [lot.x, lot.z]);
    ok('fenceCtx', null, await ctxShown('Fence ride'));
    const f0 = (await wallet()).cr; R.fenceBtn = await G(() => { const b = document.getElementById('dlrCtxBtn'), r = b.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return (e === b) + ' ' + (e?.id || e?.className); });
    await tap('#dlrCtxBtn'); await sleep(1500); if ((await wallet()).cr === f0 && await G(() => window.__dealer.fenceOn)) { await tap('#dlrCtxBtn'); await sleep(1500); } R.fenceToast = await G(() => document.getElementById('toast')?.textContent.slice(0, 120));
    ok('fenced', JSON.stringify({ paid: (await wallet()).cr - f0 }), (await wallet()).cr > f0 && await G(() => !window.__tc.car || window.__tc.car === window.__tc.rover));
    // ---------- reload: upgrade persists ----------
    await boot(); await toMars();
    ok('persists', JSON.stringify(await G(() => window.__dealer.dome)), await wait(() => { const d = window.__dealer.dome; return d.on && d.visible && d.apron === false; }, 15000));
    ok('savedKey', null, await G(() => JSON.parse(localStorage.getItem('ssx.progress.v1')).garage.dome.on === true));
  } catch (e) { bad.push('CRASH ' + e.message); }
  R.errors = errors.slice(0, 6); ok('noErrors', null, !errors.length);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
