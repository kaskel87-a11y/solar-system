// Mars base: rides vs solid add-on pieces + SSX.base.unregisterPlot (ben/base-collider).
// An add-on lot with the farm's rack piece in all six home-lot slots (0.4 m apart). Your rover spawns next to the first
// rack on each side (west, east, north, south) and drives at it in 0.3 m steps: it must stay on that side, never get shoved
// more than one step (the old push sent it ~3.5 m west on the west side). Then unregisterPlot removes the lot: no marker,
// no colliders; an unowned FOR SALE lot loses its marker too; built-in lots are refused.
// BASE=http://127.0.0.1:8853/ BR=webkit DEV="iPhone 14 Pro" VP=393x852 node test-base-collider.js   (DEV=desktop BR=chromium)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8853/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop', desk = DEV === 'desktop', VP = process.env.VP;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  let opts = desk ? { viewport: { width: 1280, height: 800 } } : { ...pw.devices[DEV] };
  if (VP) { const [w, h] = VP.split('x').map(Number); opts = { ...opts, viewport: { width: w, height: h }, screen: { width: w, height: h } }; }
  delete opts.defaultBrowserType;
  const ctx = await browser.newContext(opts); const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  await ctx.addInitScript(() => { try { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '1'); localStorage.removeItem('ssx.base.v1'); } catch (e) { /* */ } });
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const vp = page.viewportSize(), tag = `basecol-${vp.width}x${vp.height}-${BR}`;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const fr = async n => { const f0 = await G(() => window.__frames); await wait(([f0, n]) => window.__frames >= f0 + n, 20000, [f0, n]); };
  const pos = () => G(() => { const m = window.__app.surface.mapData(); return { x: m.x, z: m.z, driving: m.driving }; });
  const move = (x, z, yaw = 0) => G(([x, z, yaw]) => window.__app.surface.debugMove(x, z, yaw), [x, z, yaw]);
  const LOT = 'ben-test-lot', SALE = 'ben-sale-lot', SLOTS = [[3, 7], [6, 7], [2, 7], [7, 7], [1, 7], [8, 7]];
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    ok('api', await wait(() => !!window.SSX?.base?.ready && typeof window.SSX.base.unregisterPlot === 'function' && typeof window.SSX.base.removePlot === 'function', 30000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.__app.surface.game.debug?.credits?.(50000));
    // the test lot, 30 m north of Junction Ridge Lot (same colony-relative frame), with the farm's rack collider
    const reg = await G(([LOT, SALE]) => { const B = window.SSX.base, ev = window.__bev = [];
      for (const e of ['plot:register', 'plot:unregister']) window.addEventListener('base:' + e, x => ev.push([e, x.detail?.plotId]));
      const a = B.registerPiece({ id: 'ben-rack', name: 'Test rack', icon: '🪴', cost: 1, fp: [1, 2], max: 6, h: 2.4, plots: [LOT], colliders: [[0, 0, 0.8, 1.7]] });
      const b = B.registerPlot({ id: LOT, name: 'Collider test lot', at: [65, -95], owned: () => true, build: false });
      const c = B.registerPlot({ id: SALE, name: 'Sale test lot', at: [95, -95], price: 1234 });
      return { a: a.ok, b: b.ok, c: c.ok }; }, [LOT, SALE]);
    ok('register', reg, reg.a && reg.b && reg.c);
    const placed = await G(([LOT, SLOTS]) => SLOTS.map(([i, j]) => window.SSX.base.place(LOT, 'ben-rack', i, j, 0).ok).every(Boolean), [LOT, SLOTS]);
    ok('placed6', placed, placed && (await G(id => window.SSX.base.state(id).pieces.length, LOT)) === 6);
    const lc = await G(id => window.SSX.base.plots().find(p => p.id === id).world, LOT);
    const markers = id => G(id => { const g = window.__app.surface.scene.getObjectByName('basePlots'); return g ? g.children.filter(c => c.userData.plot === id).length : -1; }, id);
    ok('markersBefore', { lot: await markers(LOT), sale: await markers(SALE) }, (await markers(LOT)) === 1 && (await markers(SALE)) === 1);
    // get in the rover
    await G(() => { window.__app.surface.summonRover(); }); await fr(4); await G(() => { if (!window.__app.surface.info.driving) window.__app.surface.interact(); }); await fr(3);
    ok('driving', (await pos()).driving);
    const RAD = 2; // spawn far enough out for the biggest ride (min(2, spec.r)); a smaller rover just has more room
    const c = { x: lc.x - 3, z: lc.z + 6 }, box = { x0: c.x - 0.8, x1: c.x + 0.8, z0: c.z - 1.7, z1: c.z + 1.7 }; // first rack (slot 3,7)
    // control: away from the lot, a 0.3 m step moves you 0.3 m (nothing else pushes here)
    await move(lc.x, lc.z - 40, 0); await fr(3); let p0 = await pos(); await move(p0.x + 0.3, p0.z, 0); await fr(2); let p1 = await pos();
    ok('control', +(p1.x - p0.x).toFixed(3), Math.abs(p1.x - p0.x - 0.3) < 0.05);
    const SIDES = { west: [-(0.8 + RAD + 0.5), 0, 1, 0, -Math.PI / 2], east: [0.8 + RAD + 0.5, 0, -1, 0, Math.PI / 2], north: [0, -(1.7 + RAD + 0.6), 0, 1, Math.PI], south: [0, 1.7 + RAD + 0.6, 0, -1, 0] };
    for (const [side, [ox, oz, dx, dz, yaw]] of Object.entries(SIDES)) {
      const sx = c.x + ox, sz = c.z + oz; await move(sx, sz, yaw); await fr(4); const sp = await pos();
      let x = sp.x, z = sp.z, maxPush = 0;
      for (let k = 0; k < 12; k++) { const tx = x + dx * 0.3, tz = z + dz * 0.3; await move(tx, tz, yaw); await fr(2); const q = await pos(); maxPush = Math.max(maxPush, Math.hypot(q.x - tx, q.z - tz)); x = q.x; z = q.z; }
      const spawnShift = Math.hypot(sp.x - sx, sp.z - sz), onSide = side === 'west' ? x < box.x0 : side === 'east' ? x > box.x1 : side === 'north' ? z < box.z0 : z > box.z1;
      ok('side-' + side, { spawnShift: +spawnShift.toFixed(2), maxPush: +maxPush.toFixed(2), end: [+(x - c.x).toFixed(2), +(z - c.z).toFixed(2)] }, onSide && spawnShift < 0.35 && maxPush <= 0.35);
    }
    // unregister: marker + colliders gone; the FOR SALE lot's marker gone; built-ins refused; events fired
    const un = await G(([LOT, SALE]) => { const B = window.SSX.base; return { a: B.unregisterPlot(LOT), b: B.removePlot(SALE, { forget: true }), builtin: B.unregisterPlot('aj-north').ok, again: B.unregisterPlot(LOT).ok,
      plots: B.plots().map(p => p.id), centres: Object.keys(B.debug.centres()) }; }, [LOT, SALE]);
    ok('unregister', un, un.a.ok && un.b.ok && !un.builtin && !un.again && !un.plots.includes(LOT) && !un.plots.includes(SALE) && un.plots.includes('aj-north') && !un.centres.includes(LOT));
    await fr(3); ok('markersAfter', { lot: await markers(LOT), sale: await markers(SALE) }, (await markers(LOT)) === 0 && (await markers(SALE)) === 0);
    await move(c.x, c.z, 0); await fr(4); const pin = await pos(); ok('noCollidersAfter', [+(pin.x - c.x).toFixed(2), +(pin.z - c.z).toFixed(2)], Math.hypot(pin.x - c.x, pin.z - c.z) < 0.35);
    ok('savedKept', await G(id => { const s = JSON.parse(localStorage.getItem('ssx.base.v1')); return s?.plots?.[id]?.pieces?.length || 0; }, LOT), (await G(id => JSON.parse(localStorage.getItem('ssx.base.v1'))?.plots?.[id]?.pieces?.length || 0, LOT)) === 6);
    // re-register: the lot and its racks come back (backward compatible with the old register-only flow)
    const back = await G(LOT => { const r = window.SSX.base.registerPlot({ id: LOT, name: 'Collider test lot', at: [65, -95], owned: () => true, build: false }); return { ok: r.ok, n: window.SSX.base.state(LOT)?.pieces?.length }; }, LOT);
    ok('reRegister', back, back.ok && back.n === 6);
    ok('events', await G(() => window.__bev), (await G(() => window.__bev.filter(e => e[0] === 'plot:unregister').length)) === 2);
    await G(LOT => window.SSX.base.unregisterPlot(LOT, { forget: true }), LOT);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  console.log(JSON.stringify(R));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
