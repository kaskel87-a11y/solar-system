// Storm perf (stormguard.js + the Director / Ben storm budgets) on WebKit iPhone 14 at 393x852: only one grain overlay
// when the Director storm and Ben's storm run together, phone point-size clamp, the guard thinning grains under 40 fps,
// storm overlays prewarmed on landing, grime district textures warmed before stream-in and the district revealed after
// prewarm, no page errors. Prints fps and the worst frame while walking (absolute numbers are meaningless on software GL).
// BASE=http://127.0.0.1:8862/ SHOTS_DIR=<worktree>/shots NODE_PATH=<dir>/node_modules node tests/test-storm-perf.js
const { webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8862/';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await webkit.launch(); const { defaultBrowserType, ...dev } = devices['iPhone 14'];
  const ctx = await b.newContext({ ...dev, viewport: { width: 393, height: 852 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const bad = [], R = {}; const ok = (k, v, c = v) => { R[k] = v; if (!c) bad.push(k); };
  const G = (f, a) => page.evaluate(f, a);
  await page.goto(base + '?storm=peak&perfhud=1&t=' + Date.now(), { timeout: 180000 });
  await page.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 180000 });
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await page.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, null, { timeout: 180000 });
  await sleep(1500);
  ok('guard api', await G(() => !!window.SSX.stormGuard?.state && typeof window.SSX.stormGuard.prewarm === 'function'));
  ok('ben grit prewarmed on landing', await G(() => { let p = null; window.__app.surface.scene.traverse(o => { if (o.name === 'ssx-storm-grit') p = o; }); return !!p; }));
  // both storms on: the Director's dust is the only grain overlay, Ben's grit yields
  await G(() => window.SSX.director.set('storm', 'heavy')); await sleep(2500);
  const pts = () => G(() => { const a = []; window.__app.surface.scene.traverse(o => { if (o.isPoints && o.visible && /dust|grit/i.test(o.name)) a.push({ n: o.name, d: Math.min(o.geometry.drawRange.count, o.geometry.attributes.position.count), max: o.material.uniforms?.uMaxPx?.value }); }); return a; });
  const P = await pts(); R.points = P;
  ok('one grain overlay', P.length === 1 && P[0].n === 'directorDust', P.length === 1);
  ok('phone grains <= 180', P[0]?.d, P[0]?.d <= 180); ok('phone clamp 10 px', P[0]?.max, P[0]?.max === 10);
  // the guard thins grains when frames are slow (software GL on the box is well under 40 fps)
  const before = await G(() => window.SSX.stormGuard.state()); await G(() => { window.__app.joy.y = -1; }); await sleep(6000);
  const st = await G(() => window.SSX.stormGuard.state()); R.guard = st;
  ok('guard on in storm', st.on); ok('density dropped under 40 fps', st.k, st.fps >= 40 || (st.k < 1 && st.drops > before.drops - 1 && st.drops >= 1));
  const P2 = await pts(); ok('draw range follows density', P2[0]?.d, P2[0]?.d <= Math.ceil(180 * st.k) + 1);
  ok('prewarm jobs ran', st.compiled, st.compiled >= 1);
  // walk into a grime district: textures are warmed ahead, the district is hidden until prewarmed, then shown
  const spot = await G(() => { const ds = window.__app.surface.world.districts(), I = window.__app.surface.info; const d = ds.filter(d => d.id !== 'mars-rough').sort((a, b) => Math.hypot(I.x - a.x, I.z - a.z) - Math.hypot(I.x - b.x, I.z - b.z))[0];
    const x = d.x + 235, z = d.z; window.__app.surface.debugPlace(x, z, Math.atan2(-(d.x - x), -(d.z - z))); return d.id; });
  await sleep(1500);
  const F = await G(spot => new Promise(r => { const F = []; let l = performance.now(); const t0 = l; window.__app.joy.y = -1; window.__bt = -1;
    const f = () => { const t = performance.now(); F.push(t - l); l = t; const B = window.SSX.grime?.debug?.built?.(), rec = B?.get?.(spot); if (rec && window.__bt < 0) window.__bt = Math.round(t - t0); if (rec && !window.__vt && rec.root.visible) window.__vt = Math.round(t - t0); if (t - t0 < 14000) requestAnimationFrame(f); else { window.__app.joy.y = 0; r(F.slice(1)); } }; requestAnimationFrame(f); }), spot);
  const gs = await G(spot => { const S = window.SSX.grime.stats(); const root = window.SSX.grime.debug.built().get(spot)?.root; return { built: S.built.includes(spot) ? 1 : 0, resMs: S.resMs, buildMs: S.buildMs, visible: !!root?.visible }; }, spot);
  R.grime = { spot, ...gs }; const so = [...F].sort((a, b) => a - b), sum = F.reduce((a, b) => a + b, 0);
  R.walk = { fps: +(F.length / (sum / 1000)).toFixed(1), worst: Math.round(so[so.length - 1]), p95: Math.round(so[Math.floor(so.length * 0.95)]), hitches100: F.filter(x => x >= 100).length, frames: F.length, worstAt: (() => { let t = 0, w = 0, at = 0; F.forEach(x => { t += x; if (x > w) { w = x; at = t; } }); return Math.round(at); })(), builtAt: await G(() => window.__bt), shownAt: await G(() => window.__vt), top: so.slice(-5).map(Math.round) };
  ok('district streamed in', gs.built, gs.built >= 1); ok('district shown after prewarm', gs.visible);
  ok('grime textures warmed ahead (no big res() at stream-in)', gs.resMs, gs.resMs < 40);
  await page.screenshot({ path: out + 'storm-perf-393x852-webkit.png' }).catch(() => {});
  ok('no page errors', errs.length ? errs.slice(0, 3) : true, errs.length === 0);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS storm perf'); await b.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
