// v7.5.3 (Collin: stuck at "Blue Lights · Sprint · Gate 4/8"): no race gate (presets, quest sprints, builder) has its
// centre inside a building; Blue Lights finishes when every gate is taken as a 40 m ramp jump (before -> far past);
// the Blue Lights mission checkpoints also count a fly-over. BASE=http://localhost:8846/ OUT=/tmp/g/ node tests/test-gates.js
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8846/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop', desk = DEV === 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frames = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.world.setWanted?.(0); window.__race.reload(); });
    // every Mars track: no gate centre inside a footprint
    const tr = await G(() => { const W = window.__app.surface.world; return window.__race.tracks().map(t => ({ id: t.id, n: t.gates.length, blocked: t.gates.filter(g => W.collide(g.x, g.z, 1.5)).length })); });
    R.tracks = tr.map(t => `${t.id}:${t.n}${t.blocked ? '!' + t.blocked : ''}`).join(' ');
    ok('noGateInBuilding', tr.filter(t => t.blocked).map(t => t.id).join(',') || 'none', tr.length > 2 && tr.every(t => !t.blocked));
    const bl = await G(() => window.__race.tracks().find(t => /Blue Lights/.test(t.name)) || null);
    ok('blueLightsTrack', bl ? `${bl.id}:${bl.gates.length}g` : null, !!bl && bl.gates.length >= 8);
    // drive it: get in the rover, start, take each gate as a long jump (5 m before -> 40 m past, one frame apart)
    await G(() => { const s = window.__app.surface; if (!s.info.driving) { s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); } });
    ok('driving', await wait(() => window.__app.surface.info.driving, 6000)); ok('raceSeesCar', await wait(() => !!window.__race.car?.(), 10000));
    const st = await G(id => window.__race.start(id, { noRival: true }), bl.id); ok('started', JSON.stringify(st), !!st?.ok);
    await G(() => window.__race.skipCountdown()); ok('run', await wait(() => window.__race.state?.phase === 'run', 15000));
    const got = [];
    for (let i = 0; i < bl.gates.length; i++) {
      const g = bl.gates[i], fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw);
      await G(([x, z, y]) => window.__race.place(x, z, y), [g.x - fx * 5, g.z - fz * 5, g.yaw]); await G(frames, 2);
      await G(([x, z, y]) => window.__race.place(x, z, y), [g.x + fx * 40, g.z + fz * 40, g.yaw]); await G(frames, 3);
      const s = await G(() => window.__race.state || null); got.push(s ? s.passed : 'done');
      if (!s) break;
    }
    R.passed = got.join(',');
    ok('finished', JSON.stringify(await G(() => window.__race.result)), await wait(() => !window.__race.state && window.__race.result?.done !== false && !!window.__race.result, 8000));
    ok('gate4', got[3], got[3] === 4 || got[3] === 'done');
    await sleep(600); try { await page.screenshot({ path: `${out}gates-blue-lights-${desk ? 'desktop' : 'phone'}.png` }); R.shot = `${out}gates-blue-lights-${desk ? 'desktop' : 'phone'}.png`; } catch (e) { /* */ }
  } catch (e) { R.crash = String(e.stack || e); bad.push('crash'); }
  ok('noErrors', errors.join(' | ').slice(0, 600), errors.length === 0);
  R.bad = bad; R.pass = bad.length === 0; console.log(JSON.stringify(R, null, 1));
  await browser.close(); process.exit(R.pass ? 0 : 1);
})();
