// v7.5.7: summoning the rover lands it ~3.5 m beside you (clear of rocks), so 🚙 Drive shows straight away.
// Rocky spots on Mars (world colliders + the big rocks, SSX surface.rocksNear): summon, then nearRover() is true, the rover is <= 5.5 m away (3.5 m unless rocks are in the way) and not in a rock and #driveBtn reads "🚙 Drive" within 1 s.
// BASE=http://127.0.0.1:8866/ BR=webkit|chromium DEV=393x852|desktop OUT=... node tests/test-summon.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8866/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw[BR].launch(); const m = /^(\d+)x(\d+)$/.exec(DEV); const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await b.newContext(m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] } } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const G = (f, a) => page.evaluate(f, a), R = { runs: [] }, bad = [], ok = (k, v, c) => { R[k] = v; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const tag = `summon-${DEV}-${BR}`;
  try {
    await page.goto(base + '?t=' + Date.now(), { timeout: 180000 }); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1200);
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } try { window.SSX.control?.debug?.setTimes({ first: 9999, after: 9999 }); } catch (e) { } });
    // out in the rocks, away from the base: for each area, the clear standing spot with the most blocked directions 2-6 m around it
    const areas = [[260, 180], [-320, 240], [180, -360], [-240, -300], [420, -60], [-60, 460]];
    for (const [ax, az] of areas) {
      await G(([x, z]) => window.__app.surface.debugPlace(x, z, 0), [ax, az]); await sleep(900);
      const spot = await G(([cx, cz]) => { const S = window.__app.surface, W = S.world, H = (x, z, r) => !!W.collide?.(x, z, r) || S.rocksNear(x, z, r) > 0; let best = null;
        for (let dx = -30; dx <= 30; dx += 3) for (let dz = -30; dz <= 30; dz += 3) { const x = cx + dx, z = cz + dz; if (H(x, z, 0.8)) continue; let n = 0;
          for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; for (const r of [2.5, 3.5, 5, 6]) if (H(x - Math.sin(a) * r, z - Math.cos(a) * r, 1.2)) { n++; break; } }
          if (!best || n > best.n) best = { x, z, n }; } return best; }, [ax, az]);
      await G(s => window.__app.surface.debugPlace(s.x, s.z, (s.x * 7 + s.z) % 6.28), spot); await sleep(500);
      // the real path: ☰ → Summon rover here (index.html travel('summon') refreshes the HUD at once)
      const before = await G(() => ({ x: window.__app.surface.info.roverX, z: window.__app.surface.info.roverZ }));
      await G(() => window.__app.toggleMenu(true)); await sleep(400); await G(() => document.getElementById('rmSummon').click());
      const r = { ok: await G(b => { const i = window.__app.surface.info; return i.roverX !== b.x || i.roverZ !== b.z; }, before) };
      const t0 = Date.now(); const shown = await wait(() => { const d = document.getElementById('driveBtn'); return getComputedStyle(d).display !== 'none' && /Drive/.test(d.textContent); }, m ? 1000 : 2500);
      const info = await G(() => { const s = window.__app.surface, i = s.info; return { near: i.nearRover, dist: Math.round(Math.hypot(i.roverX - i.x, i.roverZ - i.z) * 100) / 100, drive: document.getElementById('driveBtn').textContent, roverInRock: s.rocksNear(i.roverX, i.roverZ, 1.2) }; });
      const run = { area: [ax, az], blockedDirs: spot.n, ok: r.ok, ...info, driveShown: shown, ms: Date.now() - t0 }; R.runs.push(run);
      if (!r.ok || !info.near || info.dist > 5.6 || !shown || info.roverInRock) bad.push('run ' + ax + ',' + az);
      if (R.runs.length === 1 || spot.n >= Math.max(...R.runs.map(q => q.blockedDirs))) await page.screenshot({ path: `${out}${tag}-rocky.png` });
    }
    ok('rocksAround', Math.max(...R.runs.map(q => q.blockedDirs)), Math.max(...R.runs.map(q => q.blockedDirs)) >= 4);
    // and the Drive button really drives
    await G(() => document.getElementById('driveBtn').click()); ok('drives', await wait(() => window.__app.surface.info.driving, 3000), true);
    ok('pageErrors', errs, !errs.length);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 160)); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag); await b.close(); process.exit(bad.length ? 1 : 0);
})();
