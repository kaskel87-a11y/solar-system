// v7.5.41 boulders are solid (ROADMAP "Later": rocks/boulders as obstacles, playtest p1).
// Big rocks out in the Mars wastes stop you on foot and stop your rover (no driving through), jetting above them clears them,
// and colony districts + the Beltway have no boulders at all (streets never get a surprise wall).
// BASE=http://localhost:8801/ BR=webkit DEV="iPhone 14" OUT=/workspace/boulders/ node tests/test-boulders.js   (DEV=desktop for 1366x768)
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...dev } = desk ? { viewport: { width: 1366, height: 768 } } : pw.devices[DEV];
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text().slice(0, 200)); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const keys = (on, ...ks) => G(([on, ks]) => { for (const k of ks) window.__app.keys[k] = on; }, [on, ks]);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.progress.v1', JSON.stringify({ v: 1, xp: 300, credits: 9000, badges: ['first'], quests: {}, equip: { paint: 'steel' }, unlocks: [], inv: {} })); });
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('version', await G(() => window.__app.version), await G(() => window.__app.version === 'v7.5.41'));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    await G(() => { window.__app.surface.game.setAliens?.(false); window.__app.surface.world.setWanted?.(0); window.SSX?.time?.set?.(13); window.SSX?.time?.freeze?.(true); (window.SSX_TICKS ||= []).push((dt, tc) => { window.__tc = tc; }); }); await frames(3);
    if (await G(() => !!document.getElementById('radio') && getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    // 1. no boulders inside districts / on the Beltway (sample spots around every district and along the road)
    const inTown = await G(async () => { const S = window.__app.surface, W = S.world, fr = () => new Promise(r => requestAnimationFrame(r)); let n = 0, bad = 0;
      const spots = W.districts().map(d => [d.x, d.z]); const hw = W.city?.spawnPoints?.('mars-highway', 'beltway_node') || [];
      for (const p of hw.slice(0, 6)) spots.push([p.x, p.z]);
      for (const [x, z] of spots) { S.debugPlace(x, z); await fr(); for (const b of S.boulders(x, z, 90)) { n++; if (W.districtAt(b.x, b.z)) bad++; } }
      return { spots: spots.length, rocks: n, inTown: bad }; });
    ok('noBouldersInTown', JSON.stringify(inTown), inTown.spots > 2 && inTown.inTown === 0);
    // 2. find a big boulder in open, flat-ish ground away from town
    const B = await G(async () => { const S = window.__app.surface, W = S.world, col = W.colony, fr = () => new Promise(r => requestAnimationFrame(r));
      for (const [ax, az] of [[260, 0], [-260, 40], [0, 280], [180, -220], [-200, -200]]) {
        const x0 = col.x + ax, z0 = col.z + az; if (W.districtAt(x0, z0)) continue; S.debugPlace(x0, z0); await fr(); await fr();
        const all = S.boulders(x0, z0, 70), big = all.filter(b => b.sc > 1.3).sort((a, b) => b.sc - a.sc);
        for (const b of big) { const ax2 = b.x - b.sr - 9, g = W.groundAt(b.x, b.z); let clear = true;
          for (let d = -17; d <= 0 && clear; d += 0.5) { const x = b.x - b.sr - 1 + d; if (W.collide(x, b.z, 2) || Math.abs(W.groundAt(x, b.z) - g) > 1.2) clear = false; for (const o of all) if (o !== b && Math.hypot(o.x - x, o.z - b.z) < o.sr + 2.5) clear = false; }
          if (clear) return { ...b, ax: ax2 }; } }
      return null; });
    ok('foundBoulder', B && JSON.stringify({ sc: +B.sc.toFixed(2), sr: +B.sr.toFixed(2) }), !!B);
    if (!B) throw new Error('no boulder');
    // 3. on foot: run straight at it, you stop at its edge
    await G(B => window.__app.surface.debugPlace(B.x - B.sr - 6, B.z, -Math.PI / 2), B); await frames(4);
    { await keys(true, 'KeyW'); let last = 1e9, still = 0; const t0 = Date.now();
      while (Date.now() - t0 < 25000 && still < 8) { await sleep(250); const d = await G(B => { const p = window.__tc.player; return Math.hypot(p.x - B.x, p.z - B.z); }, B); still = Math.abs(last - d) < 0.02 ? still + 1 : 0; last = d; }
      await keys(false, 'KeyW'); await sleep(200); }
    let p = await G(() => { const p = window.__tc.player; return { x: p.x, z: p.z }; });
    const dFoot = Math.hypot(p.x - B.x, p.z - B.z);
    ok('footBlocked', JSON.stringify({ d: +dFoot.toFixed(2), need: +(B.sr + 0.45).toFixed(2), west: p.x < B.x }), dFoot > B.sr + 0.35 && p.x < B.x);
    await G(() => window.__app.surface.setView?.('third')); await G(B => { const p = window.__tc.player; p.yaw = -Math.PI / 2 + 0.7; }, B); await sleep(1500);
    if (!process.env.NOSHOT) await page.screenshot({ path: `${out}boulder-foot-${tag}.png` }); R.shots = [`${out}boulder-foot-${tag}.png`];
    // 4. jetting above it: the boulder doesn't count
    ok('overTheTop', await G(B => { const S = window.__app.surface; return !S.rockPush(B.x, B.z, 0.45, B.top + 0.5, 0.6) && !!S.rockPush(B.x, B.z, 0.45, B.top - 1, 0.6); }, B));
    // 5. rover: summon, drive straight at it with boost, it never ends up inside / through the boulder
    await G(B => window.__app.surface.debugPlace(B.x - B.sr - 14, B.z, -Math.PI / 2), B); await frames(4);
    const sm = await G(() => window.__app.surface.summonRover()); await sleep(1200);
    await G(() => window.__app.surface.interact()); await sleep(500);
    if (!(await G(() => window.__app.surface.info.driving))) { await G(() => { const i = window.__app.surface.info, p = window.__tc.player; p.x = i.roverX + 2; p.z = i.roverZ + 1.5; }); await frames(3); await G(() => window.__app.surface.interact()); await sleep(500); }
    ok('driving', JSON.stringify({ sum: sm && sm.ok, drv: await G(() => window.__app.surface.info.driving) }), await G(() => window.__app.surface.info.driving));
    await G(B => { const r = window.__tc.car || window.__tc.rover; r.x = B.x - B.sr - 16; r.z = B.z; r.speed = 0; r.yaw = -Math.PI / 2; }, B); await frames(3);
    await G(() => { window.__minD = 1e9; window.__crash = 0; window.SSX?.on?.('crash', () => window.__crash++); });
    await G(B => (window.SSX_TICKS ||= []).push(() => { const i = window.__app.surface.info; window.__minD = Math.min(window.__minD, Math.hypot(i.roverX - B.x, i.roverZ - B.z)); window.__rx = i.roverX; (window.__tr ||= []).push([+(i.roverX - B.x).toFixed(1), +(i.roverZ - B.z).toFixed(1), +(window.__tc.car?.speed || 0).toFixed(1)]); }), B);
    { await keys(true, 'KeyW', 'ShiftLeft'); if (!desk) await G(() => { window.__app.joy.y = -1; }); let last = 1e9, still = 0, vmax = 0; const t0 = Date.now();
      while (Date.now() - t0 < 30000 && still < 8) { await sleep(250); const q = await G(() => ({ x: window.__app.surface.info.roverX, v: Math.abs(window.__tc.car?.speed || 0) })); vmax = Math.max(vmax, q.v); still = Math.abs(last - q.x) < 0.03 && vmax > 3 ? still + 1 : 0; last = q.x; }
      await keys(false, 'KeyW', 'ShiftLeft'); if (!desk) await G(() => { window.__app.joy.y = 0; }); await sleep(600); R.roverTopSpeed = +vmax.toFixed(1); }
    const rv = await G(B => ({ minD: window.__minD, x: window.__rx, sr: B.sr }), B); R.trace = JSON.stringify(await G(() => window.__tr.filter((_, i) => i % 15 === 0)));
    ok('roverBlocked', JSON.stringify({ minD: +rv.minD.toFixed(2), sr: +B.sr.toFixed(2), west: rv.x < B.x }), rv.minD > B.sr + 0.3 && rv.x < B.x && R.roverTopSpeed > 8);
    await sleep(500); if (!process.env.NOSHOT) await page.screenshot({ path: `${out}boulder-rover-${tag}.png` }); R.shots.push(`${out}boulder-rover-${tag}.png`);
    await G(() => window.__app.surface.interact()); await sleep(400);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 200)); }
  ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 'none', errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
