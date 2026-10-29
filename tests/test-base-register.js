// Smoke: SSX.base.registerPlot / registerPiece in the real game. A lot queued before the game boots (window.SSX_pending,
// which survives the core replacing window.SSX), a dome + racks registered after, a duplicate id replacing, the farm lot
// laid out colony-relative at [-60, 250], both pieces in the build toolbar (every button on screen), a dome placed and
// rendered, then a reload restores it.
// BASE=http://127.0.0.1:8853/ BR=webkit DEV="iPhone 14 Pro" VP=393x852 SHOTS_DIR=/workspace/pw-ben-base/shots node test-base-register.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8853/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14 Pro', VP = process.env.VP;
const out = (process.env.SHOTS_DIR || '/workspace/pw-ben-base/shots').replace(/\/?$/, '/'), desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  let opts = desk ? { viewport: { width: 1440, height: 900 } } : { ...pw.devices[DEV] };
  if (VP) { const [w, h] = VP.split('x').map(Number); opts = { ...opts, viewport: { width: w, height: h }, screen: { width: w, height: h } }; }
  delete opts.defaultBrowserType;
  const ctx = await browser.newContext(opts);
  // the farm add-on, loaded "first": queues its lot before SSX.base exists
  await ctx.addInitScript(() => { window.__farmOwned = true; (window.SSX_pending ||= {}).plots = [{ id: 'farm-home', name: 'Dustbowl Homestead', district: 'Dustbowl', at: [-60, 250], owned: () => !!window.__farmOwned }]; });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const vp = page.viewportSize(), tag = `basereg-${vp.width}x${vp.height}-${BR}`, R = { tag }, bad = [];
  const G = (f, a) => page.evaluate(f, a), ok = (k, v, c) => { if (c === undefined) c = v; R[k] = v ?? !!c; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const regPieces = () => G(() => [
    window.SSX.base.registerPiece({ id: 'farm-dome', name: 'Dome', icon: '🫧', cost: 900, fp: [4, 4], max: 1, h: 3, color: 0xbfe8ff, plots: ['farm-home'] }),
    window.SSX.base.registerPiece({ id: 'farm-racks', name: 'Racks', icon: '🌱', cost: 250, fp: [2, 1], max: 6, solid: false, color: 0x3c8a3c, plots: ['farm-home'] })]);
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    const l = await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 150000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    return l;
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    await G(() => localStorage.removeItem('ssx.base.v1'));
    ok('api', await wait(() => !!window.SSX?.base?.ready && typeof window.SSX.base.registerPlot === 'function', 20000));
    ok('queuedPlot', await wait(() => window.SSX.base.plots().some(p => p.id === 'farm-home' && p.addon), 10000));
    const rp = await regPieces(); ok('pieces', rp.map(r => r.ok + ':' + r.replaced).join(), rp.every(r => r.ok && !r.replaced));
    const dup = await G(() => window.SSX.base.registerPlot({ id: 'farm-home', name: 'Dustbowl Homestead', district: 'Dustbowl', at: [-60, 250], owned: () => !!window.__farmOwned }));
    ok('dupReplaces', dup.ok && dup.replaced && (await G(() => window.SSX.base.plots().filter(p => p.id === 'farm-home').length)) === 1);
    ok('badDef', await G(() => { try { const r = window.SSX.base.registerPlot({ id: 'x' }), q = window.SSX.base.registerPiece(null); return !r.ok && !q.ok; } catch (e) { return false; } }));
    ok('landed', await land());
    await G(() => window.__app.surface.game.debug.credits(20000));
    const pos = await G(() => { const f = window.SSX.base.plots().find(p => p.id === 'farm-home'), c = window.__app.surface.info.colony; return { w: f.world, c, owned: f.owned }; });
    ok('colonyRelative', pos, !!pos.w && Math.abs(pos.w.x - (pos.c.x - 60)) < 0.01 && Math.abs(pos.w.z - (pos.c.z + 250)) < 0.01);
    ok('ownedViaAddon', pos.owned);
    await G(([x, z]) => window.__app.surface.debugMove(x, z, 0), [pos.w.x, pos.w.z + 6]);
    ok('buildBtn', await wait(() => window.SSX.base.action === '🏗️ Build', 15000));
    await G(() => window.SSX.base.build(true, 'farm-home')); await sleep(600);
    const tb = await G(() => { const bs = [...document.querySelectorAll('#baseBar button')], W = innerWidth, H = innerHeight, tools = document.querySelector('#baseBar .tools').getBoundingClientRect();
      return { ids: bs.map(b => b.dataset.t || b.dataset.a), off: bs.filter(b => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > W || r.top < 0 || r.bottom > tools.bottom + 1 || !r.width; }).map(b => b.id), rows: new Set(bs.map(b => Math.round(b.getBoundingClientRect().top))).size, scroll: document.querySelector('#baseBar .tools').scrollHeight > document.querySelector('#baseBar .tools').clientHeight }; });
    ok('toolbar', tb, ['farm-dome', 'farm-racks', 'wall', 'turret', 'rot', 'done'].every(t => tb.ids.includes(t)));
    // buttons past row 2 may scroll; Done / Rotate must be visible without scrolling
    ok('doneVisible', await G(() => { const t = document.querySelector('#baseBar .tools').getBoundingClientRect(); return ['baseDone', 'baseRot'].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width && r.top >= t.top - 1 && r.bottom <= t.bottom + 1 && r.right <= innerWidth && r.left >= 0; }); }));
    const pl = await G(() => window.SSX.base.place('farm-home', 'farm-dome', 3, 3, 0)); ok('placeDome', pl.ok);
    const pl2 = await G(() => window.SSX.base.place('aj-north', 'farm-racks', 0, 0, 0)); ok('racksNotOnCityLot', !pl2.ok);
    await G(() => window.SSX.base.place('farm-home', 'wall', 0, 0, 0)); await G(() => window.SSX.base.place('farm-home', 'turret', 9, 9, 0));
    ok('rendered', await G(() => window.SSX.base.debug.instances), (await G(() => window.SSX.base.debug.instances)) > 0);
    await G(() => document.querySelector('#baseT-farm-dome') && window.SSX.base.building && document.querySelector('#baseT-farm-dome').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, bubbles: true })) && document.querySelector('#baseT-farm-dome').dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, bubbles: true })));
    await sleep(800); await page.screenshot({ path: `${out}${tag}-build.png`, timeout: 90000 }).catch(() => {});
    await G(() => window.SSX.base.build(false));
    // build:false lot + same-frame ownership: register unowned, flip the add-on's flag, place() in the same frame
    const sf = await G(() => { const b = window.SSX.base; window.__ownB = false;
      const r = b.registerPlot({ id: 'farm-b', name: 'Farm B', at: [10, 226], owned: () => window.__ownB, build: false });
      const before = b.place('farm-b', 'wall', 0, 0, 0); window.__ownB = true; const same = b.place('farm-b', 'wall', 1, 0, 0);
      window.__ownB = false; const ref = b.refresh().includes('farm-b'); const ali = typeof b.syncOwners === 'function';
      window.__ownB = true; const reg = b.registerPlot({ id: 'farm-b', name: 'Farm B', at: [10, 226], owned: () => window.__ownB, build: false }); const owned2 = b.state('farm-b').owned;
      return { r: r.ok, before: before.why, same: same.ok, refreshUnowned: !ref, alias: ali, regSync: reg.ok && owned2 }; });
    ok('sameFrame', sf, !!sf.r && /Buy/.test(sf.before || '') && sf.same && sf.refreshUnowned && sf.alias && sf.regSync);
    const fb = await G(() => window.SSX.base.plots().find(p => p.id === 'farm-b').world);
    await G(([x, z]) => window.__app.surface.debugMove(x, z, 0), [fb.x, fb.z + 6]); await sleep(1500);
    ok('noBuildBtn', await G(() => window.SSX.base.inPlot), (await G(() => window.SSX.base.inPlot === 'farm-b' && window.SSX.base.action === null && document.getElementById('baseBtn').style.display === 'none')));
    ok('noUiBuild', await G(() => window.SSX.base.build(true, 'farm-b') === false && window.SSX.base.build(true, 'farm-b', { force: true }) === true && (window.SSX.base.build(false), true)));
    await page.screenshot({ path: `${out}${tag}-nobuild.png`, timeout: 90000 }).catch(() => {});
    // reload: the save keeps the dome even though the pieces register late
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    ok('api2', await wait(() => !!window.SSX?.base?.ready, 20000));
    ok('parkedBeforeRegister', await G(() => (window.SSX.base.state('farm-home')?.later || []).some(q => q.type === 'farm-dome')));
    await regPieces();
    ok('restored2', await G(() => (window.SSX.base.state('farm-b')?.pieces || []).length === 1));
    ok('restored', await G(() => window.SSX.base.state('farm-home').pieces.map(q => q.type).sort().join()), (await G(() => window.SSX.base.state('farm-home').pieces.map(q => q.type).sort().join())) === 'farm-dome,turret,wall');
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  R.errors = errors.slice(0, 5); if (errors.some(e => !/audio device/i.test(e))) bad.push('pageerrors'); // headless WebKit has no audio device
  console.log(JSON.stringify(R)); await browser.close();
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag); process.exit(bad.length ? 1 : 0);
})();
