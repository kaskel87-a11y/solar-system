// v8 phone perf soak: WebKit iPhone 14 393x852, look=med (v8) + models=1, grime post on (phone default 'lite'), the flamethrower
// sprayed every 12 s, walking circles outside the Velvet Airlock (Ares Junction NPC churn) and twice inside it (the dancers).
// Samples every 10 s: renderer.info.memory geometries/textures, programs, draw calls/triangles, scene objects, FPS, JS heap
// (Chromium only: performance.memory), v8 look/models counters. Asserts GPU resources plateau: after warm-up (1/3 of the run)
// geometries / textures / programs grow by at most a small margin, the v8 pools stay bounded, no errors.
// DUR=180 BR=webkit BASE=http://127.0.0.1:8886/ OUT=/tmp/v8perf.json NODE_PATH=/workspace/pw-steve/node_modules node tests/test-v8-perf.js
const { webkit, chromium, devices } = require('playwright');
const DUR0 = +(process.env.DUR || 120), CYC = DUR0 / 2; // two identical cycles: walk outside, the club, walk outside
const base = process.env.BASE || 'http://127.0.0.1:8886/', BR = process.env.BR || 'webkit', DUR = +(process.env.DUR || 120), QS = process.env.QS || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch(BR === 'webkit' ? {} : { args: ['--enable-precise-memory-info', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const { defaultBrowserType, ...dev } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...dev, viewport: { width: 393, height: 852 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ssx.v8.nogov', '1'); localStorage.setItem('ssx.view.v1', '3.6'); localStorage.removeItem('ssx.grime.v1'); localStorage.removeItem('ssx.models'); } catch (e) {}
    window.__pf = { n: 0 }; const f = () => { window.__pf.n++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('PE ' + e.message)); page.on('console', m => { const t = m.text(); if ((m.type() === 'error' && !/audio device|Failed to load resource/i.test(t)) || (m.type() === 'warning' && /v8 (look|models)/.test(t))) errs.push(t.slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a);
  await page.goto(base + '?look=med&models=1&' + QS + '&t=' + Date.now(), { timeout: 120000 });
  await page.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await page.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && window.SSX?.grime, null, { timeout: 120000 });
  const flame = await page.waitForFunction(() => !!window.SSX?.flame, null, { timeout: 15000 }).then(() => true, () => false); // (Chromium: index.html can rebuild window.SSX after flame.js set it)
  if (!flame && BR === 'webkit') throw new Error('no SSX.flame');
  const door = await G(() => { const s = window.__app.surface, g = s.game; g?.setAliens?.(false); if (window.SSX.time?.set) { window.SSX.time.set('dusk'); window.SSX.time.freeze(true); }
    const ds = s.world.doorList(), d = ds.find(x => x.kind === 'club') || ds[0]; window.__door = d; s.debugPlace(d.x - 6, d.z + 16, -0.4); if (window.SSX.flame) window.SSX.flame.debug.give(); window.__mp = 0; try { window.SSX.on?.('models:player', () => window.__mp++); } catch (e) {} return { kind: d.kind, name: d.name || null }; });
  const sample = () => G(() => {
    const r = window.__app.renderer, i = r.info, sc = window.__app.surface.scene; let objs = 0; sc.traverse(() => objs++);
    const L = window.__v8?.S?.stats || {}, M = window.__v8models?.S; let pooled = 0; if (M) for (const p of M.pools.values()) pooled += p.length;
    const pf = window.__pf, now = performance.now(), fps = pf.t ? (pf.n - pf.n0) * 1000 / (now - pf.t) : 0; pf.t = now; pf.n0 = pf.n;
    return { geo: i.memory.geometries, tex: i.memory.textures, prog: i.programs?.length ?? 0, calls: L.frameCalls ?? i.render.calls, tris: L.frameTris ?? i.render.triangles, objs, fps: +fps.toFixed(1),
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, recompiles: L.recompiles, scans: L.scans, patched: L.patched, inside: window.__app.surface.info.inside?.kind || null, down: !!window.__app.game?.isDown?.(), live: M ? [...M.people.values()].filter(e => e.inst).length : 0,
      people: M?.people.size, attached: M?.stats.attached, lod0: M?.stats.lod0, lod1: M?.stats.lod1, pooled, mats: M?.mats.size, grime: window.SSX.grime.stats().post, mpEmits: window.__mp, made: M?.stats.made, disposed: M?.stats.disposed, pruned: L.pruned, flameShots: window.SSX.flame?.state().stats?.shots ?? null };
  });
  const T = [], t0 = Date.now(); let nextS = 0, k = 0;
  await sample();
  while (true) {
    const t = (Date.now() - t0) / 1000; if (T.length > DUR / 10) break;
    if (t >= nextS) { const s = await sample(); s.t = Math.round(t); T.push(s); nextS += 10; console.log(JSON.stringify(s)); }
    const ph = t % CYC, inside = ph >= CYC * 0.67 && ph < CYC * 0.89; // DUR=180: 60-80 s and 150-170 s inside the club with the dancers
    await G(([kk, inside]) => { const s = window.__app.surface, d = window.__door, w = s.world; w.setWanted?.(0); // spraying colonists raises heat: keep the guards off so the player isn't downed + respawned mid-trace
      if (inside) { if (!w.inside) { const P = window.__app.game.progress; if ((P.credits | 0) < 500) { P.credits = 1000; window.__app.game.save(); } localStorage.setItem('ssx.adult', '1'); s.debugPlace(d.x, d.z + 0.4, Math.PI); window.__enter = s.enterBuilding(); } else s.debugInside?.(Math.sin(kk / 3) * 3, -1 - Math.abs(Math.cos(kk / 3)) * 2, kk / 4); return; }
      if (w.inside) { s.leaveBuilding(); return; }
      const a = kk / 6, R = 10 + 6 * Math.sin(kk / 17); s.debugPlace(d.x + Math.sin(a) * R, d.z + 14 + Math.cos(a) * R, a + Math.PI / 2); }, [k++, inside]);
    if (flame && k % 12 === 0) await G(() => window.SSX.flame.debug.hold(2.5));
    if (flame && k % 30 === 0) await G(() => window.SSX.flame.debug.setFuel(999));
    await sleep(1000);
  }
  // despawn / respawn churn: pull every NPC with a body out of the scene, then put them back. Bodies go to the per-body
  // pools (bounded, overflow disposed), come back re-tinted from the pool, and the bone textures don't pile up.
  const churn = await G(async () => {
    const M = window.__v8models, S = M.S, r = window.__app.renderer, sl = ms => new Promise(f => setTimeout(f, ms));
    const s = window.__app.surface; if (s.info.inside) { s.leaveBuilding(); await sl(1500); }
    const live = [...S.people.values()].filter(e => e.inst && !e.player), back = live.map(e => [e.group, e.group.parent, e.info.tint]);
    const m0 = S.stats.made, d0 = S.stats.disposed, t0 = r.info.memory.textures;
    for (const [g] of back) g.removeFromParent(); await sl(800);
    const pooled = S.stats.pooled, poolMax = M.dev.POOL_MAX, pools = [...S.pools.values()].map(p => p.length);
    const tp = r.info.memory.textures; M.dev.flushPools(); await sl(300); const freed = tp - r.info.memory.textures; // disposal frees the bone textures
    for (const [g, p] of back) p.add(g); await sl(2500);
    const reused = back.filter(([g]) => S.people.get(g)?.inst).length, tintOk = back.every(([g, , tint]) => { const e = S.people.get(g); return !e?.inst || e.inst.tint === tint && e.inst.meshes.lod1.every(o => o.material.userData.U.uTint.value.getHex() === (tint ?? 0xffffff)); });
    return { n: back.length, pooled, freed, poolMax, pools, reused, made: S.stats.made - m0, disposed: S.stats.disposed - d0, tex: r.info.memory.textures - t0, tintOk };
  });
  console.log('churn', JSON.stringify(churn));
  const out = { br: BR, dur: DUR, door, flame, T, churn, errs };
  if (process.env.OUT) require('fs').writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
  await browser.close();
  // plateau: second cycle vs first. Warm = 10 s into cycle 2 (models, kits, flame, club + dancers all built once), end = last.
  const a = T.find(s => s.t >= CYC + 10) || T[Math.floor(T.length / 2)], z = T[T.length - 1], bad = [];
  const grow = (k, m) => { if (z[k] > a[k] * (1 + m) + 4) bad.push(`${k} ${a[k]} -> ${z[k]}`); };
  grow('geo', 0.08); grow('tex', 0.08); grow('prog', 0.05);
  if (z.pooled > 16) bad.push('pooled ' + z.pooled); if (z.mats > 48) bad.push('mats ' + z.mats);
  if (z.recompiles - a.recompiles > 40) bad.push(`shader re-patches ${a.recompiles} -> ${z.recompiles}`); // cycle 2 re-uses cycle 1's materials; v8-models (#48) flip-flopped 3 shared terrain materials every scan (~120 here)
  if (z.live > 13) bad.push('live bodies ' + z.live + ' > phone cap 12 + player');
  if (z.mpEmits > 20) bad.push('models:player emitted ' + z.mpEmits + ' times');
  if (errs.length) bad.push('errors ' + errs.length);
  if (churn.n && (churn.pools.some(n => n > churn.poolMax) || !churn.tintOk || churn.reused < churn.n || churn.made > churn.disposed)) bad.push('pool churn ' + JSON.stringify(churn));
  if (churn.tex > 4) bad.push('churn textures +' + churn.tex); if (churn.n && churn.freed < 1) bad.push('flushPools freed no textures');
  console.log(JSON.stringify({ warm: a, end: z, errs }));
  if (bad.length) { console.log('FAIL v8 perf: ' + bad.join('; ')); process.exit(1); }
  console.log('PASS v8 perf plateau (' + BR + ', ' + DUR + ' s)');
})().catch(e => { console.error(e); process.exit(1); });
