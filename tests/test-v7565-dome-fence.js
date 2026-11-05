// v7.5.66: with the showroom dome, the fence lot is the glass floor. A stolen hover bike that stops
// under the glass but outside the old 50×22 apron (strict onLot / ctxWhy.apron) must still fence on E,
// even if the latch has never been armed. Clearly outside the glass, E exits and pays nothing.
// DOME=0 keeps the roadside latch: visit the apron, slide just outside it, E still fences.
// Fresh desktop load. CHROME= optional system browser.
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
  const holdAt = (x, z) => G(([x, z]) => {
    const stop = (dt, tc) => { const c = tc.car; if (!c || stop.n > 12) return; stop.n++; c.x = x; c.z = z; c.speed = 0; c.vy = 0; c.lift = 0; c.air = false; };
    stop.n = 0; window.SSX_TICKS.push(stop);
  }, [x, z]);
  const flags = () => G(() => {
    const d = window.__dealer, b = document.getElementById('dlrCtxBtn'), w = d.ctxWhy;
    return { on: w.onLot, apron: w.apron, armed: w.armed, fence: d.fenceOn, driving: !!window.__app.surface.info.driving, label: b && b.style.display !== 'none' ? b.textContent.trim() : '', drive: document.getElementById('driveBtn')?.textContent || '' };
  });
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
  R.keyOnFoot = await G(() => window.__dealer.keyE());
  if (DOME) R.buy = await G(() => window.__dealer.buyDome('cr'));
  const lot = await G(() => { const d = window.__dealer.lotCenter; return { x: d.x, z: d.z }; });
  await G(([x, z]) => window.__app.surface.debugPlace(x, z - 35, 0), [lot.x, lot.z]);
  await sleep(400);
  R.kind = await G(([x, z]) => {
    const vs = (window.__app.surface.world.parkedVehicles() || []).filter(v => v.kind === 'hoverbike' && !v.owned);
    vs.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const v = vs[0]; if (!v) return null; v.x = x; v.z = z; v.group?.position.set(v.x, v.group.position.y, v.z); return v.kind;
  }, [lot.x, lot.z - 35]);
  await sleep(300);
  await G(() => window.__app.surface.interact());
  await sleep(300);
  let ok = R.keyOnFoot === false && (!DOME || R.buy?.ok) && R.kind === 'hoverbike';
  if (DOME) {
    // 32 m north of centre: outside the glass (rz 20) and outside the latch. E must exit, not fence.
    await holdAt(lot.x, lot.z - 32); await sleep(500);
    R.off = await flags();
    const crOff = await G(() => window.__app.game.progress.credits);
    const fenOff = await G(() => window.__dealer.garage.fenced | 0);
    await p.keyboard.press('KeyE'); await sleep(500);
    R.offAfter = { cr: await G(() => window.__app.game.progress.credits) - crOff, fen: (await G(() => window.__dealer.garage.fenced | 0)) - fenOff, driving: await G(() => window.__app.surface.info.driving) };
    ok = ok && R.off.on === false && R.off.apron === false && R.off.fence === false && R.off.armed === false && R.offAfter.cr === 0 && R.offAfter.fen === 0 && R.offAfter.driving === false;
    // back on the bike, stop 18 m north: under the glass, outside the old apron, latch was never armed.
    R.reenter = await G(() => window.__app.surface.interact()); await sleep(400);
    await holdAt(lot.x, lot.z - 18);
    R.glassWait = await p.waitForFunction(() => {
      const b = document.getElementById('dlrCtxBtn'), d = document.getElementById('driveBtn');
      return b && b.style.display === 'block' && /Fence ride/.test(b.textContent) && d && /Exit/.test(d.textContent) && !/\(E\)/.test(d.textContent);
    }, { timeout: 4000 }).then(() => true).catch(() => false);
    R.glass = await flags();
    const cr0 = await G(() => window.__app.game.progress.credits);
    const fen0 = await G(() => window.__dealer.garage.fenced | 0);
    await p.keyboard.press('KeyE'); await sleep(800);
    R.cr = [cr0, await G(() => window.__app.game.progress.credits)];
    R.fenced = [fen0, await G(() => window.__dealer.garage.fenced | 0)];
    R.driving = await G(() => window.__app.surface.info.driving);
    ok = ok && R.glassWait && R.glass.apron === false && R.glass.on === true && R.glass.fence === true && R.glass.driving === true && /Fence ride/.test(R.glass.label)
      && !/\(E\)/.test(R.glass.drive) && R.cr[1] > R.cr[0] && R.fenced[1] === R.fenced[0] + 1 && !R.driving;
  } else {
    await holdAt(lot.x, lot.z); await sleep(600);
    R.center = await flags();
    await holdAt(lot.x, lot.z - 15); await sleep(700);
    R.edge = await flags();
    const cr0 = await G(() => window.__app.game.progress.credits);
    const fen0 = await G(() => window.__dealer.garage.fenced | 0);
    await p.keyboard.press('KeyE'); await sleep(800);
    R.cr = [cr0, await G(() => window.__app.game.progress.credits)];
    R.fenced = [fen0, await G(() => window.__dealer.garage.fenced | 0)];
    R.driving = await G(() => window.__app.surface.info.driving);
    ok = ok && R.center.fence && /Fence ride/.test(R.center.label) && R.edge.on === false && R.edge.armed === true && R.edge.fence === true
      && /Fence ride/.test(R.edge.label) && !/\(E\)/.test(R.edge.drive) && R.cr[1] > R.cr[0] && R.fenced[1] === fen0 + 1 && !R.driving;
  }
  R.errs = errs; ok = ok && !errs.length;
  console.log(JSON.stringify(R, null, 1));
  console.log(ok ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
