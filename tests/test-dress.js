// v7.5.4 Mars district dressing (art kit): per-district streaming on phones (shared + current only), instanced props,
// whole-scene triangle budget (phone <= 350k), canvas sign text + graffiti, solids that block walking but not the camera.
// BASE=http://localhost:8847/ BR=webkit DEV="iPhone 14" node tests/test-dress.js
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8847/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop', PFX = process.env.PFX || 'dress';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/zero.size|framebuffer|GL_INVALID|WebGL/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); if (/^dress/.test(m.text())) errors.push('W ' + m.text().slice(0, 200)); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 250 }); return true; } catch (e) { return false; } };
  const shot = n => page.screenshot({ path: `${out}${PFX}-${tag}-${n}.png`, timeout: 120000 }).catch(e => console.log('shot', n, e.message.split('\n')[0]));
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    ok('api', await G(() => !!window.SSX?.dress));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000)); await sleep(500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    const want = { 'mars-downtown': ['street_lamp_02', 'park_bench_g3', 'planter_box_01', 'mars_food_stall', 'mars_billboard_curved'], 'mars-rough': ['burn_barrel', 'mars_tire_wall', 'mars_water_tower', 'mars_stripped_buggy'], 'mars-gated': ['planter_box_03', 'potted_plant_04', 'lounge_chair'] };
    for (const d of Object.keys(want)) {
      await G(id => window.__app.surface.fastTravel(id), d);
      const ready = await wait(id => window.SSX.dress.state().districts[id]?.ready, 90000, d); await sleep(1500);
      const s = await G(() => window.SSX.dress.state());
      const D = s.districts[d] || {};
      ok('ready:' + d, ready);
      ok('assets:' + d, JSON.stringify(D.counts), want[d].every(id => (D.counts || {})[id] > 0));
      if (!desk) ok('streamed:' + d, Object.keys(s.districts).join(), Object.keys(s.districts).length === 1);
      ok('dressTris:' + d, s.tris, s.tris <= (s.budget ?? Infinity) && s.tris <= (desk ? 600000 : 110000));
      const tri = await G(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => { const i = window.__app.renderer.info; r({ tris: i.render.triangles, calls: i.render.calls }); }))));
      ok('sceneTris:' + d, `${tri.tris} tris / ${tri.calls} calls`, desk || tri.tris <= 350000);
      if (d === 'mars-downtown') ok('signs', (D.signs || []).join('|'), (D.signs || []).length >= 1);
      if (d === 'mars-rough') ok('graffiti', (D.tags || []).join('|'), (D.tags || []).length >= 4);
      // props are walk-blocking solids but never pull the chase camera in
      const sol = await G(() => { const w = window.__app.surface.world, sc = window.__app.surface.scene; let im = null; sc.traverse(o => { if (!im && o.isInstancedMesh && /^dress:/.test(o.name)) im = o; });
        if (!im) return null; const m = new (im.matrixWorld.constructor)(); im.getMatrixAt(0, m); const x = m.elements[12], z = m.elements[14];
        return { hit: !!w.collide(x, z, 0.3), cam: w.camBlocked(x, w.groundAt(x, z) + 0.5, z) }; });
      ok('solid:' + d, JSON.stringify(sol), sol && sol.hit && !sol.cam);
      await shot(d);
      // a close look at one dressed spot (camera behind the player facing it)
      await G(id => { const w = window.__app.surface.world, sc = window.__app.surface.scene; let best = null; const i = window.__app.surface.info;
        sc.traverse(o => { if (o.isInstancedMesh && /^dress:(street_lamp|burn_barrel|potted|planter_box_03|mars_food)/.test(o.name)) { const m = new (o.matrixWorld.constructor)(); o.getMatrixAt(0, m); best ||= { x: m.elements[12], z: m.elements[14] }; } });
        if (best) window.__app.surface.debugMove(best.x, best.z + 7); }, d); await sleep(2500); await shot(d + '-close');
    }
    ok('noErrors', errors.join(' || ') || 'none', !errors.some(e => /^PE|^W/.test(e)));
  } catch (e) { ok('exception', String(e.message || e).slice(0, 300), false); }
  R.errors = errors.slice(0, 8); R.bad = bad; R.pass = !bad.length; console.log(JSON.stringify(R, null, 1));
  await browser.close(); process.exit(R.pass ? 0 : 1);
})();
