// Live fix test (pumpkin/live-fixes-roofs-rides): fly over buildings / land on roofs, and every owned ride stays in the world.
// BUG 1: boost + thrust over a building with no crash, land on the roof, drive off it, and still hit a wall on the ground.
// BUG 2: buy a new ride: the old one stays parked where you left it (real vehicle: collision, minimap blip), walk up and
//        drive it (context button on touch, E on desktop), My rides list (☰ → 🚗 Rides & meets, and the garage tab) with
//        Deliver to me (fee / free at home) and Show on map, persistence across reload, old-save migration (lost ride).
// On touch every button is tapped while a SECOND finger holds the joystick (Chromium: CDP multi-touch; WebKit: pointer events).
// BASE=http://localhost:8851/ DEV=393x852 BR=webkit SHOTS_DIR=shots node tests/test-livefix.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'livefix';
const ONLY = process.env.ONLY || 'roofs,rides';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView?.({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800); };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  // ---- taps (same pattern as test-dealer.js): touch = a thumb held on the joystick the whole time ----
  let cdp = null; const T = async (type, pts) => (cdp = cdp || await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  let stick = null, tid = 2;
  const holdStick = async () => {
    if (stick || !touch) return;
    const j = await center('#joy'); if (!j) return; const free = await G(j => !!document.elementFromPoint(j.x, j.y)?.closest('#joy'), j); if (!free) return;
    if (BR === 'chromium') { await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(50); await T('touchMove', [{ x: j.x, y: j.y - 2, id: 1 }]); await sleep(50); }
    else await G(j => { const el = document.getElementById('joy'); const o = { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: j.x, clientY: j.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: j.y - 2 })); }, j);
    stick = { x: j.x, y: j.y - 2 };
  };
  const releaseStick = async () => {
    if (!stick) return; const j = stick; stick = null;
    if (BR === 'chromium') { await T('touchEnd', [{ x: j.x, y: j.y, id: 1 }]); await sleep(60); }
    else await G(j => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: j.x, clientY: j.y })), j);
    await sleep(100);
  };
  let held = 0;
  const tap = async sel => {
    if (!touch) { const c = await center(sel); if (!c) throw new Error('no ' + sel); await page.mouse.click(c.x, c.y); await sleep(250); return; }
    await holdStick(); const c = await center(sel); if (!c) throw new Error('no ' + sel);
    const id = tid++, j = stick;
    if (BR === 'chromium') { const pts = j ? [{ x: j.x, y: j.y, id: 1 }] : []; await T('touchStart', [...pts, { x: c.x, y: c.y, id }]); await sleep(60); await T('touchEnd', [{ x: c.x, y: c.y, id }]); }
    else await G(([c, id]) => { const el = document.elementFromPoint(c.x, c.y); const o = { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: false, clientX: c.x, clientY: c.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, [c, id]);
    await sleep(250); if (j) held++;
  };
  const sheetIs = k => wait(k => document.getElementById('dlrSheet')?.dataset.kind === k, 5000, k);
  const ctxShown = re => wait(re => { const b = document.getElementById('dlrCtxBtn'); return b && b.style.display === 'block' && new RegExp(re).test(b.textContent); }, 8000, re);
  const toMars = async () => { await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land(); await G(() => { window.__app.surface.game.setAliens?.(false); (window.SSX_TICKS ||= []).push((dt, tc) => { window.__tc = tc; }); }); await frames(3); };
  const boot = async save => {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(s => { localStorage.clear(); localStorage.setItem('ssx.progress.v1', JSON.stringify(s)); }, save);
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await toMars();
  };
  const drive = async () => { await G(() => { const s = window.__app.surface; if (!s.info.driving) { s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); } }); return wait(() => window.__app.surface.info.driving, 5000); };
  const keys = (on, ...ks) => G(([on, ks]) => { for (const k of ks) window.__app.keys[k] = on; }, [on, ks]);
  const SAVE = { v: 1, xp: 120, credits: 9000, badges: ['first'], quests: {}, equip: { paint: 'steel' } };
  try {
    if (ONLY.includes('roofs')) {
      // ================= BUG 1: roofs =================
      await boot(SAVE); ok('drive', null, await drive());
      ok('hasVehicleGround', null, await G(() => typeof window.__app.surface.world.vehicleGround === 'function'));
      // find a big flat-roofed building with a clear 30 m run-up on its west side (from the real world.solids via collide)
      const B = await G(() => {
        const w = window.__app.surface.world, col = w.colony, probe = { y: 1e6, spec: { r: 0.01 }, x: 0, z: 0 }, low = { y: -1e6, spec: { r: 0.01 } };
        const roof = (x, z) => w.vehicleGround(probe)(x, z), terr = (x, z) => w.vehicleGround(low)(x, z), solidAt = (x, z) => !!w.collide(x, z, 0.05);
        const cands = [], seen = new Set();
        for (let x = col.x - 200; x <= col.x + 200; x += 2) for (let z = col.z - 200; z <= col.z + 200; z += 2) {
          if (!solidAt(x, z)) continue; const t = roof(x, z), g = terr(x, z); if (t - g < 4) continue;
          const same = (a, b) => Math.abs(roof(a, b) - t) < 0.01;
          let ex = x; while (same(ex - 0.25, z) && ex > x - 60) ex -= 0.25; // west roof edge (incl. car pad)
          let fx = x; while (same(fx + 0.25, z) && fx < x + 60) fx += 0.25; // east edge
          const cx = (ex + fx) / 2; let nz = z; while (same(cx, nz - 0.25) && nz > z - 60) nz -= 0.25; let sz = z; while (same(cx, sz + 0.25) && sz < z + 60) sz += 0.25;
          const cz = (nz + sz) / 2, key = [ex, fx, nz, sz].join(); if (seen.has(key) || fx - ex < 6 || sz - nz < 4) continue; seen.add(key);
          if (!same(ex + 0.5, cz) || !same(fx - 0.5, cz)) continue;
          let clear = true; for (let d = 2; d <= 32 && clear; d += 1) if (w.collide(ex - d, cz, 1.8) || w.collide(ex - d, cz + 1.5, 1.8) || w.collide(ex - d, cz - 1.5, 1.8)) clear = false;
          if (clear) cands.push({ x: cx, z: cz, top: t, g, ex, fx, w: fx - ex, d: sz - nz });
        }
        cands.sort((a, b) => b.w * b.d - a.w * a.d); return cands[0] || null;
      });
      ok('foundBuilding', B && JSON.stringify({ x: Math.round(B.x), z: Math.round(B.z), h: +(B.top - B.g).toFixed(1), w: B.w }), !!B);
      if (B) {
        // record speed reversals / crash sfx per frame
        await G(() => { const st = window.__lfRec = { minSpeed: 1e9, crashes: 0, maxX: -1e9, overRoof: 0, maxY: -1e9 }; const s0 = window.__app.sfx().length;
          const f = () => { const c = window.__tc?.car; if (c) { st.minSpeed = Math.min(st.minSpeed, c.speed); st.maxX = Math.max(st.maxX, c.x); st.maxY = Math.max(st.maxY, c.y); } st.crashes = window.__app.sfx().slice(s0).filter(k => k === 'crash').length; if (!st.stop) requestAnimationFrame(f); }; requestAnimationFrame(f); });
        // 1a. take off from the street west of it: thrust + boost (Space + Shift + W), straight east over the roof
        await G(B => { const s = window.__app.surface; s.debugMove(B.ex - 30, B.z, -Math.PI / 2); }, B); await frames(4);
        await G(B => { const c = window.__tc.car; c.y = B.top + 3.5; c.vy = 2; c.air = true; c.speed = 18; window.__lfRec.minSpeed = 1e9; window.__lfRec.maxX = -1e9; }, B);
        await keys(true, 'KeyW', 'ShiftLeft', 'Space');
        let midShot = false;
        const t0f = Date.now(); for (let i = 0; Date.now() - t0f < 60000; i++) { await sleep(60); const c = await G(() => { const c = window.__tc.car; return { x: c.x, z: c.z, y: c.y, speed: c.speed, air: c.air }; }); if (process.env.LFDBG && i % 5 === 0) console.log('fly', i, c.x.toFixed(1), c.z.toFixed(1), c.y.toFixed(1), c.speed?.toFixed?.(1), c.air, B.ex, B.fx, B.top.toFixed(1)); if (!midShot && c.x > B.ex + 2) { await shot('midflight'); midShot = true; } if (c.x > B.fx + 25) break; }
        await keys(false, 'KeyW', 'ShiftLeft', 'Space');
        const rec = await G(() => window.__lfRec);
        ok('flewOver', JSON.stringify({ maxX: Math.round(rec.maxX - B.fx), minV: +rec.minSpeed.toFixed(1), crash: rec.crashes }), rec.maxX > B.fx + 5 && rec.minSpeed > 0 && rec.crashes === 0);
        // 1b. land on the roof: drop onto it from 4 m up
        await G(B => { const s = window.__app.surface; s.debugMove((B.ex + B.fx) / 2, B.z, -Math.PI / 2); }, B); await frames(2);
        await G(B => { const c = window.__tc.car; c.y = B.top + 4; c.vy = 0; c.air = true; c.speed = 0; c.prevG = null; }, B);
        await wait(B => { const c = window.__race.car(); return c && !c.air && Math.abs(c.y - B.top) < 0.15; }, 6000, B); await sleep(1200);
        const onRoof = await G(() => window.__race.car());
        ok('landedOnRoof', JSON.stringify({ dy: +(onRoof.y - B.top).toFixed(2), air: onRoof.air }), !onRoof.air && Math.abs(onRoof.y - B.top) < 0.15);
        await G(() => window.__app.surface.setView?.('third')); await sleep(600); await shot('on-roof');
        // 1c. drive off the east edge, back to the street
        await G(() => { window.__lfRec.minSpeed = 1e9; });
        await keys(true, 'KeyW'); const t0d = Date.now(); while (Date.now() - t0d < 40000) { await sleep(80); const c = await G(() => window.__tc.car); if (c.x > B.fx + 8) break; } await keys(false, 'KeyW');
        await wait(() => { const c = window.__tc.car; return !c.air && Math.abs(c.vy || 0) < 0.5; }, 20000); await sleep(500); const off = await G(B => { const c = window.__tc.car, w = window.__app.surface.world; const rc = window.__tc.car; return { x: c.x, y: c.y, air: c.air, g: w.vehicleGround(rc)(rc.x, rc.z), terr: w.vehicleGround({ y: -1e6, spec: { r: 0.01 } })(c.x, c.z) }; }, B);
        ok('droveOff', JSON.stringify({ x: Math.round(off.x - B.fx), dy: +(off.y - off.g).toFixed(2), belowRoof: +(B.top - off.y).toFixed(1), aboveTerrain: +(off.y - off.terr).toFixed(1) }), off.x > B.fx + 3 && Math.abs(off.y - off.g) < 0.4 && off.y < B.top - 1 && !off.air);
        // 1d. on the ground the building is still solid: drive at the west wall
        await G(B => { const s = window.__app.surface; s.debugMove(B.ex - 14, B.z, -Math.PI / 2); }, B); await frames(4);
        await G(() => { window.__lfRec.minSpeed = 1e9; window.__lfRec.maxX = -1e9; const c = window.__tc.car; c.speed = 14; });
        await keys(true, 'KeyW', 'ShiftLeft'); { const t0w = Date.now(); while (Date.now() - t0w < 20000) { await sleep(200); if ((await G(() => window.__lfRec.minSpeed)) < 0) break; } } await keys(false, 'KeyW', 'ShiftLeft');
        const wall = await G(() => window.__lfRec);
        ok('groundWallHit', JSON.stringify({ maxX: +(wall.maxX - B.ex).toFixed(1), minV: +wall.minSpeed.toFixed(1) }), wall.maxX < B.ex + 0.5 && wall.minSpeed < 0);
        await G(() => { window.__lfRec.stop = true; });
      }
    }
    if (ONLY.includes('rides')) {
      // ================= BUG 2: every owned ride stays in the world =================
      await boot(SAVE);
      const S = await G(() => window.__dealer.spots);
      // drive the stock rover to the dealer, park it on the apron's edge and get out
      ok('drive2', null, await drive());
      const P0 = { x: S.dealer.x + 22, z: S.dealer.z + 18 };
      await G(P0 => window.__app.surface.debugMove(P0.x, P0.z, 0.3), P0); await frames(4);
      await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 3000);
      const old = await G(() => { const c = window.__tc.rover; return { x: c.x, z: c.z, yaw: c.yaw }; });
      // buy a Red Comet at the dealer (context button + sheet, stick held on touch)
      await G(() => window.__dealer.tp('dealer', 13)); ok('dealerCtx', null, await ctxShown('Dealer'));
      await tap('#dlrCtxBtn'); ok('dealerSheet', null, await sheetIs('dealer'));
      await tap('[data-dsel="red_comet"]'); await tap('[data-buy="red_comet"]');
      ok('bought', null, await wait(() => window.__dealer.garage.rides.some(r => r.kind === 'red_comet'), 4000));
      await releaseStick();
      const g1 = await G(() => window.__dealer.garage);
      const stock = g1.rides.find(r => r.id === 'stock');
      ok('bothRidesOwned', g1.rides.map(r => r.id + ':' + r.kind).join(','), g1.rides.length === 2 && g1.active !== 'stock');
      ok('oldParkedWhereLeft', JSON.stringify(stock.park && { dx: +(stock.park.x - old.x).toFixed(2), dz: +(stock.park.z - old.z).toFixed(2), planet: stock.park.planet }), !!stock.park && Math.hypot(stock.park.x - old.x, stock.park.z - old.z) < 0.5 && stock.park.planet === 'Mars');
      await frames(40);
      const rep = await G(() => window.__dealer.myrides.parked);
      ok('oldRoverInWorld', JSON.stringify(rep), rep.length === 1 && rep[0].id === 'stock' && rep[0].hasSolid && Math.hypot(rep[0].x - old.x, rep[0].z - old.z) < 0.5);
      ok('oldRoverSolid', null, await G(p => !!window.__app.surface.world.collide(p.x + 1, p.z, 0.45), rep[0]));
      ok('minimapBlip', null, await G(() => window.SSX.minimap.list().includes('myrides')));
      await sleep(400); ok('minimapDrawn', null, await G(() => (window.__app.mapInfo()?.marks || 0) >= 1));
      // walk up to the old rover: "🔑 Drive" (touch: context button with the stick held; desktop: E)
      await G(p => window.__app.surface.debugPlace(p.x + 4.2, p.z + 1, Math.PI / 2), rep[0]);
      ok('driveOldCtx', null, await ctxShown('Drive'));
      await G(() => window.__app.surface.setView?.('third')); await sleep(900); await shot('parked-old-rover');
      if (touch) await tap('#dlrCtxBtn'); else { await page.keyboard.press('KeyE'); }
      ok('swappedIntoOld', null, await wait(() => window.__dealer.garage.active === 'stock' && window.__app.surface.info.driving, 4000));
      await releaseStick();
      await frames(20);
      const g2 = await G(() => ({ g: window.__dealer.garage, rep: window.__dealer.myrides.parked, rv: { x: window.__tc.rover.x, z: window.__tc.rover.z } }));
      const comet = g2.g.rides.find(r => r.kind === 'red_comet');
      ok('newRideStaysParked', JSON.stringify(g2.rep.map(r => r.id)), !!comet.park && g2.rep.length === 1 && g2.rep[0].id === comet.id);
      ok('drivingOldWhereItWas', null, Math.hypot(g2.rv.x - old.x, g2.rv.z - old.z) < 0.5);
      // ☰ → 🚗 Rides & meets → 🅿️ My rides
      await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 3000);
      await G(() => window.__app.toggleMenu(true)); await sleep(250);
      await tap('#rmRides'); ok('hubOpens', null, await sheetIs('hub'));
      await tap('[data-myrides]'); ok('myRidesSheet', null, await sheetIs('rides'));
      const rows = await G(() => [...document.querySelectorAll('#dlrSheet .mr')].map(e => e.innerText.replace(/\s+/g, ' ')));
      ok('myRidesList', JSON.stringify(rows), rows.length === 2 && rows.some(t => /Red Comet/.test(t) && /Parked/.test(t)) && rows.some(t => /current ride/.test(t)));
      await sleep(500); await shot('my-rides');
      // Show on map
      await tap(`[data-showmap="${comet.id}"]`);
      ok('showOnMap', null, await wait(c => !document.getElementById('dlrSheet') && (() => { const g = window.__app.surface.game.mapGate(); return g && Math.hypot(g.x - c.x, g.z - c.z) < 1; })(), 3000, comet.park));
      await releaseStick();
      // Deliver to me, away from home: 75 cr, parked right beside you
      const far = await G(() => { const s = window.__dealer.spots, c = window.__app.surface.world.colony; return { x: c.x - 60, z: c.z + 70 }; });
      await G(f => window.__app.surface.debugPlace(f.x, f.z, 0), far); await frames(10);
      const cr0 = await G(() => window.__app.surface.game.progress.credits);
      await G(() => window.__app.toggleMenu(true)); await sleep(250); await tap('#rmRides'); await sheetIs('hub'); await tap('[data-myrides]'); await sheetIs('rides');
      ok('feeShown', null, await G(id => /75 cr/.test(document.querySelector(`[data-deliver="${id}"]`).textContent), comet.id));
      await tap(`[data-deliver="${comet.id}"]`); await frames(10);
      const d1 = await G(id => ({ cr: window.__app.surface.game.progress.credits, p: window.__dealer.rideById(id).park, me: { x: window.__app.surface.info.x ?? window.__tc.player.x, z: window.__tc.player.z }, rep: window.__dealer.myrides.parked }), comet.id);
      const dd = Math.hypot(d1.p.x - (await G(() => window.__tc.player.x)), d1.p.z - (await G(() => window.__tc.player.z)));
      ok('delivered', JSON.stringify({ fee: cr0 - d1.cr, d: +dd.toFixed(1) }), cr0 - d1.cr === 75 && dd < 14 && d1.rep.some(r => r.id === comet.id));
      await G(() => window.__dealer.closeSheet()); await releaseStick(); await G(() => window.__app.surface.setView?.('third')); await sleep(900); ok('deliveredInReach', +dd.toFixed(1), dd < 6.2 && await ctxShown('Drive').catch(() => false)); await shot('delivered');
      // free at the lock-ups; and the list lives in the garage sheet too
      await G(() => window.__dealer.tp('garage', 8)); await frames(10);
      ok('garageCtx', null, await ctxShown('Garage|Drive'));
      await G(() => window.__dealer.openGarage()); await sheetIs('garage'); await tap('[data-tab="rides"]');
      ok('garageTabList', null, await G(() => document.querySelectorAll('#dlrSheet .mr').length === 2));
      const cr1 = await G(() => window.__app.surface.game.progress.credits);
      ok('freeAtHome', null, await G(id => /free/.test(document.querySelector(`[data-deliver="${id}"]`).textContent), comet.id));
      await tap(`[data-deliver="${comet.id}"]`); await frames(5);
      ok('freeDelivered', null, cr1 === await G(() => window.__app.surface.game.progress.credits));
      await G(() => window.__dealer.closeSheet()); await releaseStick();
      // reload: parks persist, the parked ride is rebuilt where it was
      const before = await G(() => window.__dealer.garage);
      await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000); await toMars(); await frames(40);
      const after = await G(() => ({ g: window.__dealer.garage, rep: window.__dealer.myrides.parked }));
      const cb = before.rides.find(r => r.kind === 'red_comet'), ca = after.g.rides.find(r => r.kind === 'red_comet');
      ok('persisted', null, after.g.rides.length === 2 && after.g.active === 'stock' && ca.park && Math.hypot(ca.park.x - cb.park.x, ca.park.z - cb.park.z) < 0.01 && after.rep.some(r => r.id === ca.id));
      // Collin's save: bought a ride before this fix (old ride has no park) + a ride saved with `model` instead of `kind`
      await boot({ ...SAVE, garage: { v: 1, rides: [{ id: 'stock', kind: 'rover', up: { engine: 1 } }, { id: 'r1', kind: 'ares_brute', paint: 'candy' }, { id: 'r2', model: 'dust_runner' }, 'junk'], active: 'r1', rep: 20, nextId: 3 } });
      await frames(40);
      const mg = await G(() => ({ g: window.__dealer.garage, rep: window.__dealer.myrides.parked, S: window.__dealer.spots }));
      ok('migratedKeepsAll', mg.g.rides.map(r => r.id + ':' + r.kind).join(','), mg.g.rides.length === 3 && mg.g.rides.some(r => r.id === 'r2' && r.kind === 'dust_runner') && mg.g.lost?.length === 1);
      ok('lostRideAtLockups', JSON.stringify(mg.rep.map(r => [r.id, Math.round(Math.hypot(r.x - mg.S.garage.x, r.z - mg.S.garage.z))])), mg.rep.length === 2 && mg.rep.every(r => Math.hypot(r.x - mg.S.garage.x, r.z - mg.S.garage.z) < 35));
    }
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  await releaseStick().catch(() => { });
  R.held = held;
  const errs = errors.filter(e => !/favicon|404|ERR_|net::|WebGL|GPU|THREE\.WebGLRenderer|Failed to start the audio device/i.test(e));
  ok('noErrors', errs.length ? errs.slice(0, 3).join(' | ') : 0, errs.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
