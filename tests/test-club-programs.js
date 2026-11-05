// v7.5.17 test: entering an interior compiles no shader programs and has no long frame (iPhone 14 emulation).
// The club (room + Rhea/Danny/Kiara dancers) is built hidden on approach and prewarmed by world.js warmRooms() +
// SSX.stormGuard.prewarm(..., { draw: true }); dancer programs/GLBs stay resident across visits (clubdancers.js).
// Checks per visit: renderer.info.programs gains nothing, the warm job finished, max frame. Headless SwiftShader rasterizes
// on the CPU, so the FIRST club entry is allowed MAXF1 (default 125 ms); every later entry must stay <= MAXF (100 ms).
// BASE=http://localhost:8765/ node tests/test-club-programs.js
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', MAXF = +(process.env.MAXF || 100), MAXF1 = +(process.env.MAXF1 || 125);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const dev = { ...pw.devices['iPhone 14'] }; delete dev.defaultBrowserType;
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => { const H = window.__H = { f: [] }; let gf = 0, last = 0; const loop = t => { const fr = window.__frames || 0; if (fr !== gf) { gf = fr; if (last) H.f.push([t, t - last]); last = t; } requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, cond) => { R[k] = v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { timeout: 180000 });
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', true, await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await G(() => { const s = window.__app.surface; s.world.setWanted?.(0); s.game.progress.credits = 99999; });
    const warmed = await wait(() => { const w = window.__app.surface.world.warmState?.(), g = window.SSX?.stormGuard?.state?.(); return w?.rooms?.includes('club') && !w.busy && g && g.jobs === 0; }, 60000);
    ok('clubPrewarmed', await G(() => ({ w: window.__app.surface.world.warmState?.(), g: window.SSX.stormGuard.state() })), warmed);
    await sleep(4000); // dancer GLBs land and get their own warm job
    await wait(() => window.SSX.stormGuard.state().jobs === 0, 20000);
    const progs = () => G(() => window.__app.renderer.info.programs.map(p => p.name + '#' + p.id));
    const visits = [];
    for (const [i, kind] of ['club', 'depot', 'club', 'cantina', 'club'].entries()) {
      await G(k => { const d = window.__app.surface.world.doorList().find(d => d.kind === k); window.__app.surface.debugPlace(d.x, d.z + 0.4, Math.PI); window.__app.surface.world.setWanted?.(0); }, kind); await sleep(2500);
      const p0 = await progs(), t0 = await G(() => performance.now());
      const entered = await G(() => !!window.__app.surface.enterBuilding()?.ok);
      await wait(k => window.__app.surface.info.inside?.kind === k, 8000, kind); await sleep(6000);
      const p1 = await progs(), fr = await G(t => window.__H.f.filter(x => x[0] >= t).map(x => x[1]), t0);
      const v = { kind, entered, newPrograms: p1.filter(x => !p0.includes(x)), maxFrame: +Math.max(0, ...fr).toFixed(1) }; visits.push(v);
      const first = kind === 'club' && !visits.slice(0, -1).some(x => x.kind === 'club');
      ok(`${i}:${kind}:noNewPrograms`, v, entered && v.newPrograms.length === 0);
      ok(`${i}:${kind}:maxFrame`, v.maxFrame, v.maxFrame <= (first ? MAXF1 : MAXF));
      await G(() => window.__app.surface.leaveBuilding()); await sleep(1500);
      await G(() => { const s = window.__app.surface, c = s.info.colony; s.debugPlace(c.x + 120, c.z + 60, 0); }); await sleep(3000);
    }
    ok('noErrors', errors, errors.length === 0);
  } catch (e) { bad.push('threw: ' + e.message); }
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS test-club-programs');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
