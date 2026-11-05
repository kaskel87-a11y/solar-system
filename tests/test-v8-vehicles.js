// v8 realistic vehicles (look/vehicles.js + vehicles-gen.js + vehicles-fx.js, window.SSX.vehicles): classic and ?vehicles=0 stay
// blocky and never fetch the generator, med swaps in the procedural cars (cap 8, no fails), night gives your car a real
// headlight (small SpotLight pool, the rest fake cones), damage dents + smokes, burn() makes a burning wreck, and switching to
// classic at runtime restores every blocky mesh. Shots: day / night / damaged / burning (before = vehicles=0). fps per config.
// SHOTS_DIR=$PWD/.shots/v8v BASE=http://127.0.0.1:8858/ node tests/test-v8-vehicles.js     (one browser, --workers=1 style)
const { chromium } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8811/', CONF = (process.env.CONF || 'classic,med0,med').split(','), FPS_MS = +(process.env.FPS_MS || 4000);
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'v8v')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOT = { x: 58, z: -146, yaw: 0 }; // Red Line Motors lot: five dealer rides + the hauler, camera looking -Z at them

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } }); const page = await ctx.newPage();
  await ctx.addInitScript(() => { try { localStorage.setItem('ssx.v8.nogov', '1'); localStorage.setItem('ssx.v8.nodrs', '1'); localStorage.setItem('ssx.view.v1', '14'); localStorage.removeItem('ssx.vehicles'); } catch (e) {} });
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /v8 (look|models|vehicles)/.test(m.text()))) errs.push(m.text().slice(0, 220)); });
  const G = (f, a) => page.evaluate(f, a), R = { conf: {} }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}v8v-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000, animations: 'disabled', caret: 'hide' }); } catch (e) { console.error('shot ' + s + ': ' + e.message.slice(0, 120)); return null; } return p; };
  const frames = n => G(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const fps = async (ms = FPS_MS) => G(ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000) * 10) / 10); }; requestAnimationFrame(f); }), ms);
  const land = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(1000);
  };
  const genFetched = () => G(() => performance.getEntriesByType('resource').some(e => /vehicles-(gen|fx)\.js/.test(e.name)));
  const setNoon = () => G(() => { if (window.SSX?.time?.set) { window.SSX.time.set('noon'); window.SSX.time.freeze(true); } });
  // night: real SSX.time (#30) when present; otherwise stub isNight/nightness and dim the sun / sky lights for the shot
  const setNight = on => G(on => {
    const X = window.SSX; if (X.time?.set && !X.time.__stub) { X.time.set(on ? 'midnight' : 'noon'); X.time.freeze(true); return 'SSX.time'; }
    X.time = { __stub: true, isNight: () => on, nightness: () => on ? 1 : 0, set() {}, freeze() {} };
    if (!window.__nightDim) { window.__nightDim = { on: false, keep: new Map() }; X.registerSurfaceTick((dt, c) => { const D = window.__nightDim; c.scene.traverse(o => { if (!(o.isDirectionalLight || o.isHemisphereLight || o.isAmbientLight)) return; if (!D.keep.has(o)) D.keep.set(o, o.intensity); o.intensity = D.keep.get(o) * (D.on ? 0.05 : 1); }); if (!D.sky) { D.sky = []; c.scene.traverse(o => { if (o.isMesh && o.material?.side === 1 && (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).radius * o.scale.x > 200) D.sky.push(o); }); }
        for (const o of D.sky) o.visible = !D.on; if (c.scene.fog) { D.fog ??= c.scene.fog.color.getHex(); c.scene.fog.color.setHex(D.on ? 0x06070c : D.fog); }
        if (D.on) { if (c.scene.background?.isColor) c.scene.background.setHex(0x05060c); c.scene.environmentIntensity = 0.06; } else c.scene.environmentIntensity = 1; }); }
    window.__nightDim.on = on; return 'stub';
  }, on);
  const atLot = async () => { await G(p => window.__app.surface.debugPlace(p.x, p.z, p.yaw), LOT); await frames(10); await sleep(3500); };
  const vstate = () => G(() => window.SSX.vehicles?.state?.() || null);

  try {
    for (const conf of CONF) {
      const look = conf === 'classic' ? 'classic' : 'med', qs = conf === 'med0' ? '&vehicles=0' : '';
      await page.goto(base + '?look=' + look + qs + '&t=' + Date.now(), { timeout: 120000 });
      await land(); await setNoon();
      const C = R.conf[conf] = { shots: {} };
      await atLot();
      if (conf === 'med') await wait(() => (window.SSX.vehicles?.state?.().attached || 0) >= 5, 60000);
      C.state = await vstate(); C.fps = await fps(); C.genFetched = await genFetched();
      const tag = conf === 'med' ? 'after' : conf === 'med0' ? 'before' : 'classic';
      if (conf !== 'med') {
        ok(conf + '_blocky', { on: C.state?.on, attached: C.state?.attached, gen: C.genFetched }, !C.state?.on && !C.state?.attached && !C.genFetched);
        if (conf === 'med0') { C.shots.day = await shot('day-' + tag); }
        continue;
      }
      const s = C.state;
      ok('med_on', { on: s.on, tier: s.tier, attached: s.attached, cap: s.cap, fails: s.fails, tracked: s.tracked, geos: s.geos }, s.on && s.attached >= 5 && s.attached <= s.cap && s.cap === 8 && s.fails === 0);
      const hidden = await G(() => { let skins = 0, blockyShown = 0; for (const e of window.__v8veh.S.tracked.values()) if (e.inst) { skins++; if (e.tag.orig.some(o => o.visible && o.layers.test(window.__app.surface.camera.layers))) blockyShown++; } return { skins, blockyShown }; });
      ok('med_blockyHidden', hidden, hidden.skins >= 5 && hidden.blockyShown === 0);
      ok('med_noRealLightsByDay', s.lights + ':' + s.lightPool, s.lightPool === 0);
      C.shots.day = await shot('day-' + tag);
      // damaged + burning (nearest two dealer cars)
      const L = await G(() => window.SSX.vehicles.list().filter(v => v.on).slice(0, 2));
      await G(() => { const A = window.SSX.vehicles, es = [...window.__v8veh.S.tracked.values()].filter(e => e.inst).sort((a, b) => a.d - b.d); A.damage(es[0].g, 0.8); A.burn(es[1].g, 999); });
      await frames(10); await sleep(4000);
      const dm = await G(() => window.SSX.vehicles.list().filter(v => v.dmg > 0).map(v => ({ kind: v.kind, dmg: v.dmg, burn: v.burn })));
      const fx = (await vstate()).fx;
      ok('damage_burn', { list: dm, fx, near: L }, dm.some(v => v.dmg >= 0.8 && !v.burn) && dm.some(v => v.burn === 'burning') && fx > 20);
      C.shots.damaged = await shot('damaged-burning-' + tag);
      await G(() => { for (const e of window.__v8veh.S.tracked.values()) window.SSX.vehicles.repair(e.g); });
      // night: drive the rover to the lot, real headlight on it, fake cones on the rest
      const how = await setNight(true); R.nightVia = how;
      await G(() => { const s = window.__app.surface; s.warpToRover?.(); }); await sleep(800); await G(() => window.__app.surface.interact()); await sleep(800);
      await G(p => window.__app.surface.debugMove(p.x, p.z + 4, p.yaw), LOT); await frames(10); await sleep(3500);
      const n = await vstate(), pl = await G(() => window.SSX.vehicles.list().find(v => v.player) || null);
      ok('night_lights', { isNight: n.isNight, lights: n.lights, pool: n.lightPool, player: pl }, n.isNight && n.lights >= 1 && n.lights <= 3 && n.lightPool === 4 && pl?.on);
      C.shots.night = await shot('night-' + tag);
      C.nightFps = await fps();
      // ---- Pumpkin compatibility: SSX.vehicleLook hook, existing-mesh fallback, .visible left to the game / dealership
      const pk = await G(async () => {
        const L = window.SSX.vehicleLook, sf = { scene: window.__v8veh.S.ctx.scene, camera: window.__v8veh.S.ctx.camera }, rv = window.__v8veh.S.ctx.rover, out = {};
        const fr = (n) => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
        out.api = !!L && ['has', 'info', 'attachGroup', 'paint', 'skip', 'useBase', 'refresh', 'onChange'].every(k => typeof L[k] === 'function');
        out.has = { rover: L.has('rover'), buggy: L.has('buggy'), raccoon_rover: L.has('raccoon_rover'), raccoon_mobile: L.has('raccoon_mobile') };
        const i0 = L.info('player'); out.player = i0 && { kind: i0.kind, on: i0.on, paint: i0.paintMesh?.name, root: i0.root?.name, attach: i0.attach?.name };
        out.stockVisibleUntouched = (rv.stockParts || []).every(o => o.visible === !rv.kit);
        // recolour through the hook (same material decorate() writes) -> realistic paint follows
        rv.__pkc = L.info('player').paintSource.color.getHex(); L.paint('player', { color: 0xd01818 }); await fr(4); const c = L.info('player').paintMesh?.material?.color; out.paintFollows = !!c && c.r > 0.3 && c.g < 0.2;
        // attach group: survives a rebuild and a look switch
        const ag = L.attachGroup('player'), probe = new ag.constructor(); probe.name = 'pkProbe'; ag.add(probe);
        L.refresh('player'); await fr(4); out.attachKept = !!rv.body.getObjectByName('pkProbe') && L.info('player').on;
        // hideStock(rv, true) as the dealership does for a bought ride -> rover model steps aside; hideStock(false) -> back
        const ev = []; const un = L.onChange(e => ev.push(e.type + ':' + e.kind));
        for (const o of rv.stockParts || []) o.visible = false; await fr(4); out.yieldsToDealer = !L.info('player').on;
        for (const o of rv.stockParts || []) o.visible = !rv.kit; await fr(4); out.backAfter = L.info('player').on; un(); out.events = ev;
        // a kind built on a modelled base (like PR #53 raccoon_rover = build('buggy') + panels) keeps its existing mesh
        const W = await import('./world.js');
        W.registerVehicle('pk_test_rover', { name: 'Test', vmax: 20 }, ({ build }) => { const v = build('buggy'); v.body.add(new (v.body.children.find(o => o.isMesh).constructor)(v.body.children.find(o => o.isMesh).geometry, v.paint)); return v; });
        await fr(3); const v = W.buildVehicle('pk_test_rover'); v.group.position.copy(rv.group.position).add({ x: 5, y: 0, z: 0 }); sf.scene.add(v.group); await fr(30);
        const ti = L.info(v.group); out.baseKind = ti && { kind: ti.kind, base: ti.base, on: ti.on, fallback: ti.fallback, blockyShown: v.group.children[0].children.filter(o => o.isMesh).every(o => o.visible && o.layers.test(sf.camera.layers)) };
        sf.scene.remove(v.group); probe.parent.remove(probe);
        return out; });
      ok('pumpkin_hook', pk, pk.api && pk.has.rover && pk.has.buggy && !pk.has.raccoon_rover && !pk.has.raccoon_mobile && pk.player?.on && pk.player.paint === 'ssxVehPaint' && pk.player.attach === 'ssxVehAttach' && pk.stockVisibleUntouched && pk.paintFollows && pk.attachKept);
      ok('pumpkin_fallback', pk, pk.yieldsToDealer && pk.backAfter && pk.baseKind && !pk.baseKind.on && pk.baseKind.fallback === 'no model' && pk.baseKind.blockyShown);
      await G(() => window.SSX.vehicleLook.paint('player', { color: window.__v8veh.S.ctx.rover.__pkc ?? 0x9aa0a8 }));
      // before shots for damaged / night on the same spot with vehicles off
      await setNight(false);
      // runtime: classic restores every blocky mesh
      await G(() => window.SSX.look.set('classic')); await frames(8);
      const off = await G(() => { let skins = 0, hidden = 0; window.__app.surface.scene.traverse(o => { if (/^ssxVeh(Skin|Lights|FX)$/.test(o.name)) skins++; }); for (const e of window.__v8veh.S.tracked.values()) if (e.inst) hidden++; return { on: window.SSX.vehicles.enabled(), skins, hidden }; });
      ok('switchClassicRestores', off, !off.on && off.skins === 0 && off.hidden === 0);
    }
    if (R.conf.classic && R.conf.med) R.ratio_vs_classic = Math.round(R.conf.med.fps / R.conf.classic.fps * 100) / 100;
    if (R.conf.med0 && R.conf.med) R.ratio_vs_off = Math.round(R.conf.med.fps / R.conf.med0.fps * 100) / 100;
  } catch (e) { bad.push('EXC ' + e.message); }
  // night "before": vehicles=0 on the same rover spot
  if (process.env.BEFORE_NIGHT !== '0') try {
    await page.goto(base + '?look=med&vehicles=0&t=' + Date.now(), { timeout: 120000 }); await land(); await setNoon(); await setNight(true);
    await G(() => window.__app.surface.warpToRover?.()); await sleep(800); await G(() => window.__app.surface.interact()); await sleep(800);
    await G(p => window.__app.surface.debugMove(p.x, p.z + 4, p.yaw), LOT); await frames(10); await sleep(3500);
    R.beforeNight = await shot('night-before');
  } catch (e) { bad.push('EXC2 ' + e.message); }
  const errsReal = errs.filter(e => !/favicon|ERR_|net::|Failed to load resource/i.test(e));
  ok('noErrors', errsReal.slice(0, 6), errsReal.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL: ' + bad.join(' | ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
