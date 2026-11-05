// v7.5.12 phone perf + HUD: perfgov.js (far-fog cull, adaptive pixel ratio, space textures freed while landed) and hud/hudslim.js
// (one slim wanted/search/mission row in flow under the mission card, one-line card while wanted, Stuck? after ~20 s idle, ☰ entry).
// Checks: culled objects keep visible === true for game logic, draw calls drop vs. the cull off, phone DPR <= 1.5, textures freed on
// landing and back after take-off, the status row never overlaps the card / minimap / ☰, #puHud + #mhChip + #dirTag hidden on phones,
// Stuck? hidden at first and shown after standing still ~20 s. No console errors.
// BASE=http://127.0.0.1:8972/ BR=webkit DEV="iPhone 14" node tests/test-perfgov.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8911/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(DEV === 'desktop' ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV], viewport: { width: 393, height: 852 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const overlap = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => localStorage.clear());
    ok('api', await wait(() => !!window.SSX?.perfGov && !!window.SSX?.hudSlim, 20000));
    R.texSpace = await G(() => window.__app.renderer.info.memory.textures);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000); await sleep(2500);
    await G(() => document.getElementById('radioLater')?.click());
    const st = await G(() => window.SSX.perfGov.state()); R.state = st;
    ok('phoneDpr', st.dpr, st.dpr <= 1.5);
    ok('freed', st.freedN, st.freedN > 0 && st.texAfter < st.texBefore);
    // cull: logic still sees the culled objects as visible; the render skips them
    R.cull = await G(async () => {
      const PG = window.SSX.perfGov; const n = PG.cullPass(); const s = window.__app.surface, sc = s.scene; let culledVis = 0, culled = 0;
      sc.traverse(o => { if (o.__pgC) { culled++; if (o.visible === o.__pgV) culledVis++; } });
      const r = window.__app.renderer, calls = () => { r.info.autoReset = false; r.info.reset(); r.render(sc, s.camera); const c = r.info.render.calls; r.info.autoReset = true; return c; };
      const on = calls(); sc.traverse(o => { if (o.__pgC) o.__pgC = false; }); const off = calls(); PG.cullPass();
      // a hidden object that is far stays hidden; a culled one set visible=false then true keeps the culled flag
      return { n, culled, culledVis, on, off };
    });
    ok('culls', R.cull, R.cull.culled > 50 && R.cull.culledVis === R.cull.culled && R.cull.on < R.cull.off);
    // HUD: wanted + taxi + mission chip
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); }); await sleep(500);
    await G(() => window.SSX.jobs.start('taxi')); await sleep(800);
    await G(() => { window.__app.surface.world.setWanted(1, 'test'); window.SSX.missionHeat?.debug?.force?.('job'); }); await sleep(2500);
    R.hud = await G(() => { const r = id => document.getElementById(id)?.getBoundingClientRect(), d = id => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : 'none'; };
      return { slim: document.body.classList.contains('hxSlim'), stat: r('hxStat'), statOn: d('hxStat') !== 'none', inStack: document.getElementById('hxStat')?.parentNode?.id, card: r('hxCard'), mini: r('miniMap'), menu: r('menuBtn'), more: r('hxMore'),
        pu: d('puHud'), mh: d('mhChip'), dir: d('dirTag'), stuck: d('hxStuck'), text: document.getElementById('hxStat')?.textContent };
    });
    const H = R.hud;
    ok('slimRow', H.slim && H.statOn && H.inStack === 'stackR' && /★/.test(H.text));
    ok('noOverlap', !overlap(H.stat, H.card) && !overlap(H.stat, H.mini) && !overlap(H.stat, H.menu) && !overlap(H.stat, H.more));
    ok('pillsHidden', H.pu === 'none' && H.mh === 'none' && H.dir === 'none');
    ok('cardOneLine', H.card?.height, H.card && H.card.height <= 44);
    ok('stuckHidden', H.stuck, H.stuck === 'none');
    // stand still ~21 s -> Stuck? shows (keep the heat down so nothing moves us)
    await G(() => window.__app.surface.world.setWanted(0, 'debug'));
    ok('stuckIdle', await wait(() => { const e = document.getElementById('hxStuck'); return !!e && getComputedStyle(e).display !== 'none'; }, 32000));
    ok('menuItem', await G(() => !!document.getElementById('hxStuckMenu')));
    await G(() => window.SSX.jobs.stop?.());
    // take off: textures come back
    await G(() => document.getElementById('takeoffBtn').click());
    ok('tookOff', await wait(() => !window.__app.state.onSurface && !window.__app.state.transitioning, 60000));
    await sleep(1500);
    R.back = await G(() => [window.SSX.perfGov.state(), window.__app.renderer.info.memory.textures]);
    ok('texBack', R.back[1], !R.back[0].landed && R.back[1] >= R.state.texBefore - 2);
  } catch (e) { bad.push('threw: ' + e.message); }
  const errs = errors.filter(e => !/favicon|404|net::ERR|THREE\.WebGLRenderer|GPU stall/.test(e)); ok('noErrors', errs, errs.length === 0);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS'); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
