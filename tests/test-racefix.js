// Race fixes (BUGS-v7.4 M1/M2) on Mars / Gutter Sprint:
//  M1 camera: the BUGS-v7.4 repro (stopped against the second chicane barrier, chase camera inside the gate-4 truss)
//     plus samples along the whole chicane drive: the lens must stay clear of race geometry and no barrier/ramp may
//     sit between the lens and the car, and race geometry may cover at most 2% of the frame within 3 m of the lens.
//  M2 chicane: drive gate 3 -> 4 -> 5 (both chicane barriers) with a steer-toward-the-gate autopilot; the car must clear
//     the chicane within the time limit and never get pinned (speed stays up).
// BASE=http://localhost:8777/ BR=webkit DEV=393x852 node tests/test-racefix.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || process.env.SHOTS_DIR || '/tmp/race-shots/', PFX = process.env.PFX || 'racefix';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { try { await page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png`, timeout: 90000 }); return `${out}${PFX}-${tag}-${s}.png`; } catch (e) { return 'shot failed: ' + e.message.split('\n')[0]; } };
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800); };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { Object.keys(localStorage).filter(k => k.startsWith('ssx.race.')).forEach(k => localStorage.removeItem(k)); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land();
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.debug.credits(500); window.__race.reload(); });
    const gut = await G(() => window.__race.tracks().find(t => t.id === 'mars-gutter'));
    const bars = gut.props.filter(p => p.t === 'barrier');
    ok('chicaneBarriers', bars.length, bars.length === 2);
    ok('hookExported', null, await G(() => typeof window.__race.camBlocked === 'function'));
    await G(() => window.__race.start('mars-gutter', { noRival: true })); await G(() => window.__race.skipCountdown());
    ok('raceRunning', null, await wait(() => window.__race.state?.phase === 'run', 15000));
    R.blockers = await G(() => { const b = window.__race.camBlockers?.(); return b ? b.props.map(p => p.t).join(',') + ' + ' + b.gates + ' gate boxes' : 'n/a'; });

    // ---------- M1: camera vs race geometry ----------
    // clearance = distance from the camera lens to the nearest race mesh (gate gantries, barriers, ramps; raceRoot in the
    // scene graph, so this works on builds without the fix too); los = race meshes between the lens and the car
    await G(async () => { window.__T = await import('three'); });
    const camProbe = () => G(() => {
      const T = window.__T, s = window.__app.surface, cam = s.camera, c = window.__race.car(), P = cam.position, root = s.scene.getObjectByName('raceRoot');
      let clear = 1e9, who = null; const ms = [], v = new T.Vector3(), inv = new T.Matrix4();
      root?.traverseVisible(o => { if (!o.isMesh || o.material.transparent || o.geometry.type === 'PlaneGeometry') return; ms.push(o);
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); inv.copy(o.matrixWorld).invert(); v.copy(P).applyMatrix4(inv).clamp(o.geometry.boundingBox.min, o.geometry.boundingBox.max).applyMatrix4(o.matrixWorld);
        const d = v.distanceTo(P); if (d < clear) { clear = d; who = o.geometry.type; } });
      const tgt = new T.Vector3(c.x, c.y + 0.8, c.z), dir = tgt.clone().sub(P), L = dir.length(); dir.normalize();
      const hits = new T.Raycaster(P.clone(), dir, 0.05, Math.max(0.1, L - 2.5)).intersectObjects(ms, false);
      // near-lens cover: share of a 12x24 screen grid whose first race-geometry hit is within 3 m of the lens
      const rc = new T.Raycaster(); let near = 0, n = 0; for (let i = 0; i < 12; i++) for (let j = 0; j < 24; j++) { n++; rc.setFromCamera(new T.Vector2(-1 + (i + 0.5) / 6, -1 + (j + 0.5) / 12), cam); rc.far = 3; if (rc.intersectObjects(ms, false).length) near++; }
      return { cover: +(near / n).toFixed(3), clear: +clear.toFixed(2), who, los: hits.length, losWho: hits[0]?.object.geometry.type || null, cd: +s.info.camDist.toFixed(1), pulled: s.info.camPulled };
    });
    // the BUGS-v7.4 M1 repro: run from gate 4 straight at the second chicane barrier and get stopped against it, which
    // leaves the 16 m chase camera right inside the gate-4 truss
    const g4 = gut.gates[3], g5 = gut.gates[4], b2 = bars[1], ux = (g5.x - g4.x) / Math.hypot(g5.x - g4.x, g5.z - g4.z), uz = (g5.z - g4.z) / Math.hypot(g5.x - g4.x, g5.z - g4.z);
    await G(([x, z, y]) => { window.__race.place(x, z, y); window.__race.setCarSpeed(14); window.__app.joy.x = 0; window.__app.joy.y = -1; }, [b2.x - ux * 12, b2.z - uz * 12, Math.atan2(-ux, -uz)]);
    const camS = []; let camShot = null;
    for (let k = 0; k < 14; k++) { await sleep(400); camS.push(await camProbe()); if (k === 11) camShot = await shot('cam-gate4-barrier'); }
    await G(() => { window.__app.joy.y = 0; });
    const minClear = Math.min(...camS.map(r => r.clear)), losBar = camS.filter(r => r.los && /Extrude|Buffer/.test(r.losWho || '')).length;
    R.camSamples = camS.map(r => `${r.cover}c ${r.clear}${r.who ? r.who[0] : ''}/${r.los}/${r.cd}${r.pulled ? 'p' : ''}`).join(' ');
    const maxCover = Math.max(...camS.map(r => r.cover)); ok('camLensClearOfRaceGeometry', minClear, minClear > 0.15); ok('camNoNearLensCover', maxCover, maxCover <= 0.02); ok('camNoBarrierBetween', losBar, losBar === 0); R.camShot = camShot;

    // ---------- M2: Gutter Sprint chicane (gate 3 -> 4 -> 5, both barriers) ----------
    // pass gates 1 and 2 by teleport so the race expects gate index 2, then drive from just before gate index 2
    const thru = async g => { const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw);
      await G(([x, z, y]) => window.__race.place(x, z, y), [g.x - fx * 5, g.z - fz * 5, g.yaw]); await frames(3);
      await G(([x, z, y]) => window.__race.place(x, z, y), [g.x + fx * 5, g.z + fz * 5, g.yaw]); await frames(3); };
    for (const i of [1, 2]) { if ((await G(() => window.__race.state.next)) === i) await thru(gut.gates[i]); }
    R.nextBeforeChicane = await G(() => window.__race.state.next);
    // autopilot: throttle, yaw turned toward the next gate at <= 2.5 rad/s (barrier contacts are left to the game)
    await G(() => window.__race.setCarSpeed(16));
    await G(() => { const T = window.__race; window.__apLog = { minSp: 1e9, hits: 0, t0: performance.now(), stuck: 0 }; let last = performance.now(), lastPos = null, still = 0;
      const step = () => { const st = T.state, c = T.car(); if (!st || !c || window.__apStop) return; const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
        const tr = T.tracks().find(t => t.id === st.id), g = tr.gates[st.next % tr.gates.length]; const want = Math.atan2(-(g.x - c.x), -(g.z - c.z));
        let d = want - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); const yaw = c.yaw + Math.max(-2.5 * dt, Math.min(2.5 * dt, d));
        if (!c.air) T.place(c.x, c.z, yaw); window.__app.joy.x = 0; window.__app.joy.y = Math.abs(d) > 0.8 ? -0.35 : -1; // ease off when the gate is off to the side so we don't orbit it
        if (performance.now() - window.__apLog.t0 > 1500) window.__apLog.minSp = Math.min(window.__apLog.minSp, Math.abs(c.speed));
        if (lastPos && Math.hypot(c.x - lastPos[0], c.z - lastPos[1]) < 0.02 * Math.max(1, dt * 60)) still += dt; else still = 0; window.__apLog.stuck = Math.max(window.__apLog.stuck, still); lastPos = [c.x, c.z];
        requestAnimationFrame(step); }; requestAnimationFrame(step); });
    const LIMIT = +(process.env.CHICANE_S || 60);
    const driveCam = []; const t0 = Date.now(); let midShot = null, passed4 = false, cleared = false, trace = [];
    while (Date.now() - t0 < LIMIT * 1000) {
      await sleep(500); const st = await G(() => ({ next: window.__race.state?.next, c: window.__race.car() })); driveCam.push(await camProbe());
      trace.push(`${((Date.now() - t0) / 1000).toFixed(1)}s n${st.next} (${st.c.x.toFixed(0)},${st.c.z.toFixed(0)}) v${st.c.speed.toFixed(0)}`);
      if (st.next >= 4) passed4 = true;
      if (!midShot && (passed4 || Date.now() - t0 > 6000)) midShot = await shot('chicane-mid');
      if (st.next >= 5 || st.next === 0) { cleared = true; break; }
    }
    const ap = await G(() => { window.__apStop = true; window.__app.joy.y = 0; return window.__apLog; });
    R.chicaneTrace = trace.filter((_, i) => i % 3 === 0 || i > trace.length - 5).join(' | '); R.chicaneSecs = ((Date.now() - t0) / 1000).toFixed(1); R.chicaneShot = midShot || await shot('chicane-mid');
    ok('chicanePassesGate4', null, passed4); ok('chicaneClearsGate5', null, cleared);
    ok('chicaneNeverPinned', JSON.stringify(ap), ap.stuck < 1.5);
    const dMin = Math.min(...driveCam.map(r => r.clear)), dCov = Math.max(...driveCam.map(r => r.cover)); R.driveCamMinClear = dMin; R.driveCamCovered = driveCam.filter(r => r.cover > 0.02).length + '/' + driveCam.length;
    ok('driveCamClear', dMin, dMin > 0.15); ok('driveCamNoNearLensCover', dCov, dCov <= 0.02);
    R.endShot = await shot('chicane-end');
    await G(() => window.__race.quit());
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  R.errors = errors.slice(0, 5); ok('noConsoleErrors', null, errors.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
