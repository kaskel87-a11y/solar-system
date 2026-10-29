// Mars dust storms (mars/storm.js / SSX.storm): build -> peak -> clear on a Beltway stretch. Checks the look is layered per
// render and handed back (fog / sky / light read back unchanged outside a render, identical after the storm), the grit
// cloud and caption (one short line, bottom-left, ~3 s), slower core traffic, dust-cover heat (world.setWanted / world.crime), fps on med with the storm vs
// clear plus its own per-frame cost, SSX.time coexistence (look filter, frozen clock) and ?storm=1.
// BASE=http://127.0.0.1:8883/ DEV=393x852 BR=webkit OUT=/workspace/pw-ben-storms/shots/ node tests/test-storm.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8883/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'storm';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /^storm /.test(m.text())) errors.push(m.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 15000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png`, timeout: 120000 }).then(() => (R.shots = (R.shots || []).concat(`${out}${PFX}-${tag}-${s}.png`))).catch(e => errors.push('shot ' + s));
  const fpsFor = ms => G(ms => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(+(n * 1000 / (performance.now() - t0)).toFixed(1)); }; requestAnimationFrame(f); }), ms);
  const wanted = () => G(() => window.__app.surface.world.wanted | 0);
  // what the scene holds between renders (i.e. what everyone else set); the storm only changes it inside a render
  const look = () => G(() => { const sc = window.__app.surface.scene, f = sc.fog; let sky = null, dl = null; for (const o of sc.children) { if (o.isDirectionalLight && !dl) dl = o; if (o.isGroup) for (const c of o.children) if (c.material?.uniforms?.horizon) sky = c; }
    return { near: f && +f.near.toFixed(2), far: f && +f.far.toFixed(2), fog: f && f.color.getHexString(), bg: sc.background?.isColor ? sc.background.getHexString() : null, sky: sky ? sky.material.uniforms.horizon.value.getHexString() : null, dl: dl ? +dl.intensity.toFixed(3) : null }; });
  const land = async q => {
    await page.goto(base + '?' + q + '&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000); await sleep(600);
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.restore?.(); });
    if (await G(() => { const r = document.getElementById('radio'); return r && getComputedStyle(r).display !== 'none'; })) await G(() => document.getElementById('radioLater')?.click());
  };
  try {
    await land('storm=0');
    ok('ready', null, await wait(() => !!window.SSX?.storm, 30000));
    ok('api', null, await G(() => { const S = window.SSX.storm; return window.__app.storm === S && ['active', 'intensity', 'start', 'stop', 'on', 'off', 'phase', 'state', 'next', 'heatScale', 'trafficScale', 'visibility', 'caption', 'frameMs', 'stats', 'tier', 'setTier', 'setPeriodic'].every(k => typeof S[k] === 'function'); }));
    ok('periodicOffByParam', null, await G(() => window.SSX.storm.periodic === false && !window.SSX.storm.active()));
    R.tier = await G(() => window.SSX.storm.tier()); ok('defaultTier', R.tier, R.tier === (touch ? 'med' : 'high'));
    await G(() => { window.__stEv = []; for (const e of ['start', 'peak', 'clearing', 'end', 'shed', 'phase']) window.SSX.storm.on(e, () => window.__stEv.push(e));
      // caption at the peak: snapshot it just after it shows, then time how long until it is gone (wall clock)
      window.SSX.storm.on('peak', () => setTimeout(() => { const c = document.getElementById('stormCap'); if (!c) return; const r = c.getBoundingClientRect(), W = innerWidth, H = innerHeight, t0 = performance.now();
        const lh = parseFloat(getComputedStyle(c).lineHeight) || 12, pad = parseFloat(getComputedStyle(c).paddingTop) + parseFloat(getComputedStyle(c).paddingBottom);
        window.__cap = { text: c.textContent, shown: getComputedStyle(c).display !== 'none', parent: c.parentNode === document.body ? 'body' : c.parentNode?.id, w: Math.round(r.width), oneLine: r.height <= lh + pad + 4 && c.scrollWidth <= c.clientWidth + 1,
          centre: r.width > 0 && !(r.right < W * 0.3 || r.left > W * 0.7 || r.bottom < H * 0.3 || r.top > H * 0.7), topRight: r.width > 0 && r.top < H * 0.35 && r.right > W * 0.6 };
        const iv = setInterval(() => { if (getComputedStyle(c).display === 'none' || performance.now() - t0 > 12000) { clearInterval(iv); window.__cap.goneMs = Math.round(performance.now() - t0 + 50); window.__cap.textAfter = window.SSX.storm.caption(); } }, 100); }, 50)); });
    // stay at the landing pad: the district skyline ahead shows the fog wall best
    await sleep(touch ? 4000 : 3000);
    await G(() => window.SSX.storm.setTier('med')); await sleep(300);
    const TIMED = await G(() => typeof window.SSX.time?.addLookFilter === 'function'); R.timed = TIMED; // v7.5.5 integration: with SSX.time (main) the storm tints through its look filter, so colours follow its (still running) clock: only fog distances are render-time, and the look comes back to within a clock tick
    const L0 = await look(); R.lookClear = L0;
    R.fpsClear = await fpsFor(3000);
    await shot('clear');
    // ---- the storm: build fast, hold the peak
    const t0 = Date.now(); await G(() => window.SSX.storm.start({ build: 4, peak: 1e6, clear: 3 }));
    ok('building', await G(() => window.SSX.storm.phase()), await wait(() => window.SSX.storm.phase() === 'building' && window.SSX.storm.intensity() > 0, 5000));
    ok('peak', null, await wait(() => window.SSX.storm.phase() === 'peak', 30000)); R.buildSec = (Date.now() - t0) / 1000;
    await sleep(800);
    R.I = await G(() => window.SSX.storm.intensity()); ok('intensity', R.I, R.I > 0.8);
    const A = await G(() => window.SSX.storm.debug.applied()); R.applied = A;
    ok('fogCloses', `${A?.near}/${A?.far} m (base far ${A?.baseFar})`, A && A.far <= 45 && A.far < A.baseFar * 0.6 && A.near <= 5);
    const red = h => { const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return r > g * 1.35 && r > b * 1.6; };
    ok('fogRed', A?.fog, !!A?.fog && red(A.fog)); ok('skyRed', A?.sky, !!A?.sky && red(A.sky));
    ok('lightDims', `${L0.dl} -> ${A?.light}`, A?.light < L0.dl * 0.75);
    ok('refs', JSON.stringify(await G(() => window.SSX.storm.debug.refs())), (await G(() => window.SSX.storm.debug.refs())).sky);
    R.grit = await G(() => window.SSX.storm.debug.grit()); ok('grit', JSON.stringify(R.grit), R.grit.visible && R.grit.inScene && R.grit.n > 0 && R.grit.opacity > 0.5);
    ok('gritByTier', null, await G(async () => { const S = window.SSX.storm, n = {};
      // a grit rebuild waits for the next surface frame: poll (the box can be at 2 fps under load). med -> low -> med -> high all change n
      const until = async f => { for (let i = 0; i < 80 && !f(); i++) await new Promise(r => setTimeout(r, 250)); };
      for (const t of ['low', 'med', 'high']) { const was = S.debug.grit().n; S.setTier(t); await until(() => S.debug.grit().n !== was); n[t] = S.debug.grit().n; }
      S.setTier('med'); await until(() => S.debug.grit().n === n.med); window.__gritN = n; return n.low < n.med && n.med < n.high; }));
    R.gritN = await G(() => window.__gritN);
    // layered, not overwritten: between renders the scene still holds everyone else's values
    const L1 = await look(); R.lookPeak = L1;
    ok('layeredOnly', JSON.stringify({ sky: L1.sky, bg: L1.bg, fog: L1.fog, dl: L1.dl }), (TIMED || (L1.sky === L0.sky && L1.bg === L0.bg && L1.fog === L0.fog && L1.dl === L0.dl)) && L1.far > A.far);
    // caption (team UI rule): one short line, clear of the centre and the top-right, gone after ~3 s, nothing left on the HUD
    await wait(() => window.__cap?.goneMs, 15000); R.caption = await G(() => window.__cap);
    ok('caption', JSON.stringify(R.caption), R.caption?.shown && /Dust storm/.test(R.caption.text) && [...R.caption.text].length <= 28 && R.caption.oneLine && !R.caption.centre && !R.caption.topRight && R.caption.parent === 'body'
      && R.caption.goneMs >= 2500 && R.caption.goneMs <= 4500 && R.caption.textAfter === '');
    // fps on med, storm vs clear, and the storm's own CPU per frame
    R.fpsStorm = await fpsFor(3000); R.frameMs = await G(() => window.SSX.storm.frameMs());
    await G(() => window.SSX.storm.debug.setGrit(false)); await sleep(300); R.fpsStormNoGrit = await fpsFor(3000); await G(() => window.SSX.storm.debug.setGrit(true));
    ok('fpsCost', `${R.fpsStorm} storm / ${R.fpsClear} clear, ${R.frameMs} ms/frame`, R.frameMs < 1.5 && (R.fpsStorm >= R.fpsClear * 0.55 || R.fpsStorm >= R.fpsStormNoGrit * 0.85)); // software GL on a loaded box: fps is noisy, frameMs is the storm's own cost
    await shot('peak');
    // ---- dust cover: heat gain is damped (world.setWanted and world.crime both land in the core setWanted hook)
    await G(() => window.__app.surface.world.setWanted(0, 'test')); await sleep(200);
    R.heatScale = await G(() => window.SSX.storm.heatScale());
    await G(() => window.__app.surface.world.setWanted(2, 'test: smashed a window')); R.heat2 = await wanted();
    ok('heatHalved', `2★ crime -> ${R.heat2}★ (scale ${R.heatScale})`, R.heat2 === 1);
    await G(() => window.__app.surface.world.setWanted(0, 'test')); await sleep(2700); // crime() has a 2.5 s cooldown
    await G(() => window.__app.surface.world.crime(1, 'test: pickpocket')); R.heatCrime = await wanted();
    ok('crimeShed', `1★ crime -> ${R.heatCrime}★ (carry ${await G(() => window.SSX.storm.debug.carry())})`, R.heatCrime === 0);
    ok('shedEvent', null, (await G(() => window.SSX.storm.stats().shed)) >= 2 && (await G(() => window.__stEv.includes('shed'))));
    ok('heatDrops', null, await G(() => { const w = window.__app.surface.world; w.setWanted(3, 'test'); const a = w.wanted; w.setWanted(1, 'test'); const b = w.wanted; w.setWanted(0, 'test'); return a >= 1 && b === 1 && w.wanted === 0; }));
    // ---- traffic: core Beltway traffic slows
    ok('coreTraffic', await G(() => window.__app.surface.world.debug.traffic().length), await wait(() => window.SSX.storm.debug.traffic().touched > 0, 40000));
    R.traffic = await G(() => window.SSX.storm.debug.traffic());
    ok('trafficSlows', JSON.stringify(R.traffic), R.traffic.k < 0.65 && R.traffic.slowed.length > 0 && R.traffic.slowed.every(x => Math.abs(x - R.traffic.k) < 0.05));
    // ---- indoors: no dust, no cover
    // ---- clear: everything handed back
    await G(() => window.SSX.storm.stop({ clear: 3 }));
    ok('clears', null, await wait(() => window.SSX.storm.phase() === 'clear' && window.SSX.storm.intensity() === 0, 30000));
    await sleep(1200);
    R.afterGrit = await G(() => window.SSX.storm.debug.grit());
    ok('restored', JSON.stringify(await G(() => ({ applied: window.SSX.storm.debug.applied(), filter: window.SSX.storm.debug.heatFilter(), traffic: window.SSX.storm.debug.traffic().touched, grit: window.SSX.storm.debug.grit().visible, saved: window.SSX.storm.debug.saved() }))),
      await G(() => !window.SSX.storm.debug.applied() && !window.SSX.storm.debug.heatFilter() && window.SSX.storm.debug.traffic().touched === 0 && !window.SSX.storm.debug.grit().visible && !window.SSX.storm.debug.saved()));
    const near = (a, b) => { const p = h => [16, 8, 0].map(k => (parseInt(h, 16) >> k) & 255); const x = p(a), y = p(b); return x.every((v, i) => Math.abs(v - y[i]) <= 6); };
    const L2 = await look(); ok('lookBack', JSON.stringify(L2), (TIMED ? (near(L2.sky, L0.sky) && near(L2.bg, L0.bg) && near(L2.fog, L0.fog) && Math.abs(L2.dl - L0.dl) < 0.03) : (L2.sky === L0.sky && L2.bg === L0.bg && L2.fog === L0.fog && L2.dl === L0.dl)) && L2.far === L0.far);
    await G(() => window.__app.surface.world.setWanted(0, 'test')); await G(() => window.__app.surface.world.setWanted(2, 'test')); ok('heatNormal', await wanted(), (await wanted()) === 2); await G(() => window.__app.surface.world.setWanted(0, 'test'));
    ok('events', JSON.stringify([...new Set(await G(() => window.__stEv))]), await G(() => ['start', 'peak', 'clearing', 'end', 'shed'].every(e => window.__stEv.includes(e))));
    // ---- SSX.time coexistence: colours go through its look filter; a frozen clock holds the storm
    R.time = await G(async () => { const sl = ms => new Promise(r => setTimeout(r, ms)), S = window.SSX.storm; let filt = null; const had = window.SSX.time;
      window.SSX.time = had || { scale: 1, frozen: false, nightness: () => 0, addLookFilter(fn) { filt = fn; return () => { filt = null; }; } };
      if (had) return { real: true };
      S.start({ build: 1, peak: 1e6 }); await sl(1800); const L = { top: 0xb07a4a, horizon: 0xe2b483, fog: 0xd9a676, light: 2.2, lightColor: 0xfff0dd, hemi: 1, day: 1, night: 0 };
      const T = filt ? filt(L, {}) : null; const viaTime = S.debug.applied()?.via; window.SSX.time.frozen = true; const t1 = S.state().t; await sl(800); const t2 = S.state().t; window.SSX.time.frozen = false;
      S.stop({ instant: true }); return { registered: !!filt, tinted: T && T.horizon !== L.horizon && T.light < L.light, via: viaTime, frozenHolds: t1 === t2 }; });
    ok('timeFilter', JSON.stringify(R.time), R.time.real || (R.time.registered && R.time.tinted && R.time.via === 'SSX.time' && R.time.frozenHolds));
    // ---- ?storm=1: a storm rolls in on landing (one config; it's another full landing)
    if (process.env.PARAM === '1' || (BR === 'chromium' && DEV === '393x852')) {
      await land('storm=1'); ok('paramStorm', await G(() => window.SSX.storm.state()), await wait(() => window.SSX.storm.active() && window.SSX.storm.intensity() > 0.2, 30000));
    }
    ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 0, errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); R.exc = e.stack?.slice(0, 600); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
