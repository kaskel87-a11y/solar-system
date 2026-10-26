// v8 realistic look (look/v8.js, window.SSX.look): API, auto tier (phones med, desktop high), each look renders without
// errors, shadows/env/post state per tier, classic = untouched v7 path, runtime tier switching, HUD overlap, fps per look,
// and (when SSX.time from #30 is present) the night look: emissive/bloom up, env rebuilt from the night sky. One browser at a time.
// SHOTS_DIR=$PWD/.shots/v8 BASE=http://127.0.0.1:8811/ BR=webkit DEV="iPhone 14" LOOKS=classic,med node tests/test-v8.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8811/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const LOOKS = (process.env.LOOKS || (DEV === 'desktop' ? 'classic,high' : 'classic,med')).split(',');
const FPS_MS = +(process.env.FPS_MS || 4000);
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'v8')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;

function measureHud() {
  const hud = document.getElementById('surfHud'); const W = innerWidth, H = innerHeight;
  const SKIP = new Set(['crosshair', 'hurt', 'downMsg', 'roverMenu', 'actPanel', 'racePanel', 'pokerPanel', 'r2rPanel', 'dirPanel']);
  const EXPAND = new Set(['stackR', 'surfBtns', 'ctxBar']);
  const vis = e => { if (!e) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05 || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const items = [];
  const add = e => { if (!e || SKIP.has(e.id) || !vis(e)) return; if (items.some(i => i.el === e)) return; const r = e.getBoundingClientRect(); items.push({ el: e, id: e.id || e.className, l: r.left, t: r.top, r: r.right, b: r.bottom }); };
  if (hud) for (const e of hud.children) { if (EXPAND.has(e.id)) { if (!vis(e)) continue; for (const c of e.children) add(c); } else add(e); }
  for (const id of ['joy']) add(document.getElementById(id));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(`${a.id}×${b.id}`);
  }
  const KNOWN = new Set(['meleeBtn×joy', 'joy×meleeBtn']); // core layout on the 375-wide SE, exists without v8
  return { known: overlaps.filter(o => KNOWN.has(o)), overlaps: overlaps.filter(o => !KNOWN.has(o)), off: items.filter(i => i.l < -1 || i.t < -1 || i.r > W + 1 || i.b > H + 1).map(i => i.id) };
}

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : (({ defaultBrowserType, ...d }) => d)(devices[DEV] || devices['iPhone 14']);
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  await ctx.addInitScript(() => { try { localStorage.setItem('ssx.v8.nogov', '1'); localStorage.setItem('ssx.v8.nodrs', '1'); } catch (e) {} }); // software GL is ~10x slower than a phone GPU
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /v8 look/.test(m.text()))) errs.push(m.text().slice(0, 220)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag, looks: {} }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}v8-${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 90000, animations: 'disabled', caret: 'hide' }); } catch (e) { console.error('shot ' + s + ': ' + e.message.slice(0, 120)); return null; } return p; };
  const frames = n => G(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const fps = async (ms = FPS_MS) => G(ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000) * 10) / 10); }; requestAnimationFrame(f); }), ms);
  const land = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(1000);
  };
  const place = async () => { R.spot = await G(() => { const s = window.__app.surface, ds = s.world.doorList(), d = ds.find(x => x.kind === 'club') || ds.find(x => x.kind === 'cantina') || ds[0]; if (!d) return null; s.debugPlace(d.x + 4, d.z + 13, 0.35); return { kind: d.kind, x: Math.round(d.x), z: Math.round(d.z) }; }); };
  const hasTime = () => G(() => !!window.SSX?.time?.set);
  const setHour = async h => { if (await hasTime()) { await G(h => { window.SSX.time.set(h); window.SSX.time.freeze(true); }, h); return true; } return false; };

  try {
    // 1) auto tier on a fresh profile
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3, 120000);
    await G(() => { try { localStorage.removeItem('ssx.v8.v1'); localStorage.removeItem('ssx.time.v1'); localStorage.removeItem('ssx.director.v1'); } catch (e) {} });
    await page.goto(base + '?t=' + Date.now());
    ok('installed', null, await wait(() => !!window.SSX?.look?.state, 30000));
    const st0 = await G(() => window.SSX.look.state()); R.auto = { tier: st0.tier, auto: st0.auto, device: st0.device, gpu: st0.gpu };
    ok('autoTier', null, st0.auto && st0.tier === (DEV === 'desktop' ? (st0.device === 'desktop' ? 'high' : 'med') : 'med'));
    ok('menuItem', await G(() => document.getElementById('v8-graphics')?.textContent || null), await G(() => /Graphics: /.test(document.getElementById('v8-graphics')?.textContent || '')));
    const api = await G(() => ['tier', 'set', 'onChange', 'skip', 'env', 'state', 'nightness'].filter(k => typeof window.SSX.look[k] !== 'function')); ok('api', api, api.length === 0);

    // 2) each look: reload with ?look=, land, same spot, day (and night with SSX.time)
    for (const look of LOOKS) {
      await page.goto(base + '?look=' + look + '&t=' + Date.now());
      await land(); await place(); await setHour('noon'); await frames(10); await sleep(2500); await G(() => window.__v8.scanNow()); await frames(6); await sleep(1500);
      const L = R.looks[look] = {};
      L.state = await G(() => { const s = window.SSX.look.state(); return { tier: s.tier, pr: s.pixelRatio, shadows: s.shadows, cast: s.castShadow, env: s.env, post: s.post, gtao: s.gtao, tex: s.textures, patched: s.patched, terrain: s.terrain, casters: s.casters, envBuilds: s.envBuilds, night: s.night }; });
      const S = L.state;
      if (look === 'classic') ok('classic_' + tag, S, !S.shadows && !S.cast && !S.env && !S.post && S.patched === 0);
      else ok('tier_' + look, S, S.tier === look && S.shadows === (look !== 'low') && S.cast === (look !== 'low') && S.env && S.post === (look === 'high' || look === 'ultra') && S.terrain >= 1 && S.patched > 3);
      L.dayShot = await shot(look + '-day');
      L.fpsDay = await fps();
      L.info = await G(() => { const s = window.SSX.look.state(), r = window.__app.renderer.info.render; return s.frameCalls != null && s.tier !== 'classic' ? { calls: s.frameCalls, tris: s.frameTris } : { calls: r.calls, tris: r.triangles }; });
      if (await setHour(23)) {
        await frames(10); await sleep(2500);
        L.night = await G(() => { const s = window.SSX.look.state(); return { night: s.night, envBuilds: s.envBuilds }; });
        if (look !== 'classic') ok('night_' + look, L.night, L.night.night > 0.8 && L.night.envBuilds > S.envBuilds);
        L.nightShot = await shot(look + '-night'); L.fpsNight = await fps();
        await setHour('noon');
      }
      // HUD: v8 adds no HUD; anything that overlaps on classic (the v7 path) is core layout, so only new overlaps fail
      const hud = await G(measureHud), H = hud.overlaps.concat(hud.off); if (look === 'classic') R.coreHud = H.concat(hud.known);
      const nu = H.filter(o => !(R.coreHud || []).includes(o)); if (look !== 'classic' && nu.length) bad.push(`hud_${look}:` + nu.join(','));
    }

    // 3) runtime switching from the last look: classic and back, no errors, state follows
    const last = LOOKS[LOOKS.length - 1];
    if (last !== 'classic') {
      await G(() => window.SSX.look.set('classic')); await frames(8);
      const c = await G(() => window.SSX.look.state()); ok('switchClassic', { shadows: c.shadows, post: c.post, patched: c.patched, env: c.env }, !c.shadows && !c.post && c.patched === 0 && !c.env);
      await G(t => window.SSX.look.set(t), last); await frames(8); await sleep(2500); await frames(4);
      const b = await G(() => window.SSX.look.state()); ok('switchBack', { tier: b.tier, shadows: b.shadows, post: b.post, patched: b.patched }, b.tier === last && b.shadows === (last !== 'low') && b.patched > 3);
      // dynamic resolution: software GL is far over 16.7 ms, so with DRS on the ratio must step down from the cap
      const d0 = await G(() => { const S = window.__v8.S; S.drsOff = false; return S.drsCap; });
      await page.waitForTimeout(9000);
      const d1 = await G(() => window.SSX.look.state().dynres);
      ok('dynres', { cap: d0, ...d1 }, d1.pr < d0 && d1.drops >= 1 && d1.pr >= d1.floor);
      await G(() => { window.__v8.S.drsOff = true; });
      // indoors: no sun shadows, env dimmed, room still renders
      const inn = await G(() => { const s = window.__app.surface, ds = s.world.doorList(), d = ds.find(x => x.kind === 'cantina') || ds[0]; s.debugPlace(d.x, d.z + 1.2, Math.PI); return s.world.enterBuilding ? !!s.enterBuilding?.() : null; });
      await frames(10); await sleep(1200);
      const ins = await G(() => ({ inside: !!window.__app.surface.world.inside, cast: window.SSX.look.state().castShadow }));
      R.indoor = ins; if (ins.inside) ok('indoorNoSunShadow', null, !ins.cast);
      if (ins.inside) await shot(last + '-indoor');
      await G(() => window.__app.surface.leaveBuilding?.());
    }
    await frames(5);
  } catch (e) { bad.push('EXC ' + e.message); }
  const errsReal = errs.filter(e => !/favicon|ERR_|net::|Failed to load resource/i.test(e));
  ok('noErrors', errsReal.slice(0, 6), errsReal.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + tag + ': ' + bad.join(' | ') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
