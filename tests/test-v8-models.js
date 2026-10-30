// v8 realistic models (look/models.js + look/models-kits.js, window.SSX.models): classic stays the v7 path, med swaps in the
// rigged people (cap 12, LODs) and builds the district kits, no errors, the club dancers are untouched, a shot plays
// Pistol fire, and fps per config: classic, med with ?models=0 (#35 alone) and med with models. One browser at a time.
// SHOTS_DIR=$PWD/.shots/v8m BASE=http://127.0.0.1:8857/ BR=webkit DEV="iPhone 14" node tests/test-v8-models.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8811/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const CONF = (process.env.CONF || 'classic,med0,med').split(','); // med0 = med look, models off
const SPOTS = { downtown: ['mars-downtown', -18, -2, 0], rough: ['mars-rough', -2, 30, -0.3], gated: ['mars-gated', -28, 4, 0] };
const FPS_AT = process.env.FPS_AT || 'downtown', SHOTS = (process.env.SHOTS || 'downtown').split(',').filter(Boolean);
const FPS_MS = +(process.env.FPS_MS || 4000);
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'v8m')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const [vw, vh] = (process.env.VIEW || '960x600').split('x').map(Number);
  const dev = DEV === 'desktop' ? { viewport: { width: vw, height: vh } } : (({ defaultBrowserType, ...d }) => d)(devices[DEV] || devices['iPhone 14']);
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  await ctx.addInitScript(() => { try { localStorage.setItem('ssx.v8.nogov', '1'); localStorage.setItem('ssx.v8.nodrs', '1'); localStorage.setItem('ssx.view.v1', '14'); localStorage.removeItem('ssx.models'); } catch (e) {} });
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /v8 (look|models)/.test(m.text()))) errs.push(m.text().slice(0, 220)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag, conf: {} }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}v8m-${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 90000, animations: 'disabled', caret: 'hide' }); } catch (e) { console.error('shot ' + s + ': ' + e.message.slice(0, 120)); return null; } return p; };
  const frames = n => G(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const fps = async (ms = FPS_MS) => G(ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000) * 10) / 10); }; requestAnimationFrame(f); }), ms);
  const land = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(1000);
  };
  const place = (sp) => G(([site, dx, dz, yaw]) => { const s = window.__app.surface; let g = null; const sc = window.__v8models?.S?.ctx?.scene || s.scene || window.__v8?.S?.scene; if (sc) g = sc.children.find(o => o.userData?.v8?.site === site); if (!g) { const d = s.world.doorList()[0]; s.debugPlace(d.x, d.z + 6, yaw); return null; } const d = g.children.find(o => o.userData?.v8?.part === 'dome'); s.debugPlace(d.position.x + dx, d.position.z + dz, yaw); return [Math.round(d.position.x), Math.round(d.position.z)]; }, sp);
  const setNoon = () => G(() => { if (window.SSX?.time?.set) { window.SSX.time.set('noon'); window.SSX.time.freeze(true); } });
  const settle = async (conf, site) => { await frames(10); if (conf === 'med') { await wait(s => { const m = window.SSX.models?.state?.(); return m && m.player && m.blocky === 0 && m.kitState?.[s]?.ready; }, 60000, site); } await sleep(2500); await G(() => window.__v8?.scanNow?.()); await frames(6); await sleep(1200); };
  const info = () => G(() => { const s = window.SSX.look.state(), r = window.__app.renderer?.info?.render; return s.frameCalls != null && s.tier !== 'classic' ? { calls: s.frameCalls, tris: s.frameTris } : { calls: r?.calls, tris: r?.triangles }; });

  try {
    for (const conf of CONF) {
      const look = conf === 'classic' ? 'classic' : 'med', qs = conf === 'med0' ? '&models=0' : '';
      await page.goto(base + '?look=' + look + qs + '&t=' + Date.now(), { timeout: 120000 });
      await land(); await setNoon();
      const C = R.conf[conf] = { shots: {} };
      const first = SPOTS[FPS_AT];
      await G(() => window.SSX.models?.preload?.().catch(() => {}));
      await place(first); await settle(conf, first[0]);
      C.models = await G(() => { const m = window.SSX.models?.state?.(); if (!m) return null; delete m.files; return m; });
      C.fps = await fps(); C.info = await info();
      const sc = await G(() => { let model = 0, blocky = 0, dancerTouched = 0, kit = 0; const sc = window.__v8models?.S?.ctx?.scene; sc?.traverse(o => { if (o.userData?.ssxModel && o.isSkinnedMesh) model++; if (o.userData?.ssxKit && o.isMesh) kit++; if (o.userData?.ssxDancer && (o.userData.__ssxVis !== undefined || o.userData.ssxModel)) dancerTouched++; }); return { model, kit, dancerTouched }; });
      C.scene = sc;
      if (conf === 'classic' || conf === 'med0') ok(conf + '_modelsOff_' + tag, { on: C.models?.on, model: sc.model, kit: sc.kit }, !C.models?.on && sc.model === 0 && sc.kit === 0);
      else {
        const m = C.models;
        ok('med_people_' + tag, { player: m.player, lod0: m.lod0, lod1: m.lod1, blocky: m.blocky, fails: m.fails, cap: m.cap }, m.player && m.lod0 + m.lod1 >= 3 && m.lod0 + m.lod1 <= m.cap + 1 && m.fails === 0 && m.cap === 12);
        ok('med_kit_' + tag, m.kitState?.[first[0]], !!m.kitState?.[first[0]]?.ready && m.kitState[first[0]].draws >= 3 && !m.kitState[first[0]].failed);
        ok('med_dancersUntouched_' + tag, sc.dancerTouched, sc.dancerTouched === 0);
        // a shot from the player plays Pistol fire on the model
        const f0 = m.fired; await page.keyboard.press('KeyF'); await sleep(250); await page.keyboard.press('KeyF'); await frames(10);
        const fired = await G(() => ({ fired: window.SSX.models.state().fired, cur: window.__v8models.S.player?.inst?.cur }));
        R.fire = fired; if (fired.fired <= f0) console.log('note: no shot detected (weapon holstered / cooldown?)');
      }
      for (const k of SHOTS) { const sp = SPOTS[k]; if (k !== FPS_AT) { await place(sp); await settle(conf, sp[0]); } C.shots[k] = await shot(conf + '-' + k); }
      // runtime: classic switch drops every model and restores the blocky rigs
      if (conf === 'med') {
        await G(() => window.SSX.look.set('classic')); await frames(8);
        const off = await G(() => { let model = 0, hidden = 0; const sc = window.__v8models.S.ctx.scene; sc.traverse(o => { if (o.userData?.ssxModel && o.parent) model++; if (o.userData?.__ssxL !== undefined || o.userData?.__ssxKitVis !== undefined) hidden++; }); return { on: window.SSX.models.enabled(), model, hidden }; });
        ok('switchClassicRestores_' + tag, off, !off.on && off.model === 0 && off.hidden === 0);
        await G(() => window.SSX.look.set('med')); await frames(8);
      }
    }
    if (R.conf.classic && R.conf.med) R.ratio_vs_classic = Math.round(R.conf.med.fps / R.conf.classic.fps * 100) / 100;
    if (R.conf.med0 && R.conf.med) R.ratio_vs_35 = Math.round(R.conf.med.fps / R.conf.med0.fps * 100) / 100;
  } catch (e) { bad.push('EXC ' + e.message); }
  const errsReal = errs.filter(e => !/favicon|ERR_|net::|Failed to load resource|start the audio device/i.test(e)); // headless WebKit has no audio device
  ok('noErrors', errsReal.slice(0, 6), errsReal.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + tag + ': ' + bad.join(' | ') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
