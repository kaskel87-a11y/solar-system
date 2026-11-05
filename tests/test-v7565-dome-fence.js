// v7.5.65: under the showroom dome, E must fence a stolen ride even when the stop sits just outside the
// strict apron (the glass is wider than the fence rectangle, and a hover bike's brake slides across that edge).
// Fresh desktop load. DOME=0 runs the same latch with the roadside lot. CHROME= optional system browser.
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8897/', DOME = process.env.DOME !== '0', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const opt = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
  if (process.env.CHROME) opt.executablePath = process.env.CHROME;
  const b = await pw.chromium.launch(opt);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const G = (f, a) => p.evaluate(f, a), W = (f, ms = 180000) => p.waitForFunction(f, null, { timeout: ms, polling: 200 });
  await p.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 });
  await W(() => window.__frames > 3 && !document.getElementById('loading'));
  await G(() => {
    localStorage.clear();
    localStorage.setItem('ssx.adult', '1');
    localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}');
    localStorage.setItem('ssx.progress.v1', JSON.stringify({ v: 1, xp: 8000, credits: 90000, badges: [], quests: {}, equip: {} }));
  });
  await p.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 });
  await W(() => window.__frames > 3 && !document.getElementById('loading'));
  await G(() => window.__app.landOn(window.__app.bodies.find(x => x.name === 'Mars').mesh));
  await W(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0);
  await sleep(800);
  await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) {} });
  await W(() => !!window.__dealer, 30000);
  const R = { dome: DOME };
  R.keyOnFoot = await G(() => window.__dealer.keyE()); // not in a stolen ride: E must fall through to enter/exit
  if (DOME) R.buy = await G(() => window.__dealer.buyDome('cr'));
  const lot = await G(() => { const d = window.__dealer.lotCenter; return { x: d.x, z: d.z }; });
  // steal a hover bike and park it in the middle of the apron
  await G(([x, z]) => window.__app.surface.debugPlace(x, z - 35, 0), [lot.x, lot.z]);
  await sleep(400);
  R.kind = await G(([x, z]) => {
    const vs = (window.__app.surface.world.parkedVehicles() || []).filter(v => v.kind === 'hoverbike' && !v.owned);
    vs.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const v = vs[0]; if (!v) return null; v.x = x; v.z = z; v.group?.position.set(v.x, v.group.position.y, v.z); return v.kind;
  }, [lot.x, lot.z - 35]);
  await sleep(300);
  await G(() => window.__app.surface.interact());
  await sleep(400);
  await G(([x, z]) => { const s = window.__app.surface; s.debugMove(x, z, 0); const c = s.world.parkedVehicles?.() && null; }, [lot.x, lot.z]);
  // debugMove while driving sets the driven car. Zero the speed on the next ticks.
  await G(([x, z]) => {
    const stop = (dt, tc) => { const c = tc.car; if (!c || stop.n > 8) return; stop.n++; c.x = x; c.z = z; c.speed = 0; c.vy = 0; c.lift = 0; c.air = false; };
    stop.n = 0; window.SSX_TICKS.push(stop);
  }, [lot.x, lot.z]);
  await sleep(600);
  R.center = await G(() => { const d = window.__dealer, b = document.getElementById('dlrCtxBtn'); return { on: d.ctxWhy.onLot, armed: d.ctxWhy.armed, fence: d.fenceOn, label: b && b.style.display !== 'none' ? b.textContent.trim() : '' }; });
  // 15 m north of the lot centre: outside the strict apron (half-depth 13) and inside the latch (half-depth 19)
  await G(([x, z]) => {
    const stop = (dt, tc) => { const c = tc.car; if (!c || stop.n > 10) return; stop.n++; c.x = x; c.z = z; c.speed = 0; c.vy = 0; c.lift = 0; c.air = false; };
    stop.n = 0; window.SSX_TICKS.push(stop);
  }, [lot.x, lot.z - 15]);
  await sleep(700);
  R.edge = await G(() => { const d = window.__dealer, b = document.getElementById('dlrCtxBtn'); return { on: d.ctxWhy.onLot, armed: d.ctxWhy.armed, fence: d.fenceOn, label: b && b.style.display !== 'none' ? b.textContent.trim() : '', drive: document.getElementById('driveBtn')?.textContent }; });
  const cr0 = await G(() => window.__app.game.progress.credits);
  const fenced0 = await G(() => window.__dealer.garage.fenced | 0);
  await G(() => { window.__dealer.lastKey = null; });
  await p.keyboard.press('KeyE');
  await sleep(800);
  R.cr = [cr0, await G(() => window.__app.game.progress.credits)];
  R.fenced = [fenced0, await G(() => window.__dealer.garage.fenced | 0)];
  R.driving = await G(() => window.__app.surface.info.driving);
  R.toast = await G(() => document.getElementById('toast')?.textContent?.slice(0, 140) || '');
  R.lastKey = await G(() => window.__dealer.lastKey);
  R.errs = errs;
  // off the strict apron, latch still holding: E fences (payout, ride scrapped). It does not merely exit and leave the bike.
  const ok = R.keyOnFoot === false && (!DOME || R.buy?.ok) && R.kind === 'hoverbike' && R.center.fence && /Fence ride/.test(R.center.label || '')
    && R.edge.on === false && R.edge.armed === true && R.edge.fence === true && /Fence ride/.test(R.edge.label || '')
    && !/\(E\)/.test(R.edge.drive || '') && R.cr[1] > R.cr[0] && R.fenced[1] === R.fenced[0] + 1 && !R.driving && !errs.length;
  console.log(JSON.stringify(R, null, 1));
  console.log(ok ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
