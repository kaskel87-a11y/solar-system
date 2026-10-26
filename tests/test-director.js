// Director mode: ☰ → 🎬 Director, toggle every setting with taps, check the effect, no HUD overlap, sane frame rate,
// rewards withheld while cheats are on, settings saved. One browser at a time.
// SHOTS_DIR=$PWD/.shots BASE=http://127.0.0.1:8798/ BR=webkit DEV="iPhone 14" node tests/test-director.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8798/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = (process.env.SHOTS_DIR || process.env.OUT || require('path').join(__dirname, '..', '.shots', 'director')) + '/';
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
  for (const id of ['joy', 'dirTag']) add(document.getElementById(id));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(`${a.id}×${b.id}`);
  }
  const off = items.filter(i => i.l < -1 || i.t < -1 || i.r > W + 1 || i.b > H + 1).map(i => i.id);
  const t = document.getElementById('dirTag'), tr = t && vis(t) ? t.getBoundingClientRect() : null;
  return { W, H, overlaps, off, n: items.length, tag: tr ? { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width), h: Math.round(tr.height) } : null };
}

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : (({ defaultBrowserType, ...d }) => d)(devices[DEV] || devices['iPhone 14']);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const realErr = [];
  page.on('pageerror', e => realErr.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /\[director\]/.test(m.text()))) realErr.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { try { await page.screenshot({ path: `${out}dir-${tag}-${s}.png`, timeout: 8000 }); } catch (e) {} };
  const tapAt = async sel => { const c = await G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView?.({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel); if (!c) throw new Error('no ' + sel); if (touch) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); await sleep(200); };
  const pick = (k, v) => tapAt(`#dirPanel [data-k="${k}"] button[data-v="${v}"]`);
  const fps = async (ms = 3000) => G(ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000) * 10) / 10); }; requestAnimationFrame(f); }), ms);
  const openPanel = async () => { await G(() => window.__app.toggleMenu(true)); await sleep(250); await tapAt('#dirMenuBtn'); return wait(() => document.getElementById('dirPanel')?.classList.contains('on'), 3000); };
  const closePanel = async () => { await tapAt('#dirPanel [data-a=close]'); await wait(() => !document.getElementById('dirPanel').classList.contains('on'), 2000); };
  const settle = async (gs = 0.25) => { const g0 = await G(() => window.__director.clock); await page.waitForFunction(([g0, gs]) => window.__director.clock - g0 >= gs, [g0, gs], { timeout: 20000 }).catch(() => {}); };
  const D = () => G(() => { const d = window.__director, T = window.SSX?.time, tt = window.__time; return { tod: T ? T.now() : d.S.tod, T: T ? T.state() : null, rt: performance.now() / 1000, S: { ...d.S }, fog: d.fog, light: d.light, sky: d.sky, dust: d.dust, stars: tt ? tt.stars : d.stars, fade: d.stormFade, clock: d.clock, base: d.base, tag: document.getElementById('dirTag')?.classList.contains('on') }; });

  try {
    await page.goto(base + '?t=' + Date.now());
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { try { localStorage.removeItem('ssx.director.v1'); } catch (e) {} });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(1500);
    ok('installed', null, await wait(() => !!window.SSX?.director && !!document.getElementById('dirMenuBtn'), 15000));
    // with the day/night cycle loaded (mars/time.js) Director drives SSX.time; pin it to noon so the baselines are daylight
    R.sharedClock = await G(() => !!window.SSX?.time);
    if (R.sharedClock) { await G(() => { window.SSX.time.set('noon'); window.SSX.time.freeze(true); }); await sleep(600); }
    const hud0 = await G(measureHud); R.hud0 = { overlaps: hud0.overlaps, off: hud0.off, n: hud0.n };
    const fps0 = await fps(); R.fpsBase = fps0;
    const d0 = await D(); R.base = { fog: d0.fog, light: d0.light, sky: d0.sky };

    ok('panelOpens', null, await openPanel()); await shot('panel');
    const sizes = await G(() => [...document.querySelectorAll('#dirPanel button, #dirPanel input')].map(b => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), t: b.textContent.trim().slice(0, 14) }; }).filter(s => s.h > 0));
    R.minControl = sizes.reduce((m, s) => Math.min(m, s.h), 99); ok('bigControls', R.minControl, R.minControl >= 44);
    const contrast = await G(() => { const p = getComputedStyle(document.getElementById('dirPanel')), b = getComputedStyle(document.querySelector('#dirPanel .bd button')); return { bg: p.backgroundColor, fg: p.color, btn: b.backgroundColor, btnFg: b.color }; }); R.contrast = contrast;
    const panelBox = await G(() => { const r = document.getElementById('dirPanel').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, W: innerWidth, H: innerHeight }; });
    ok('panelOnScreen', panelBox, panelBox.l >= 0 && panelBox.t >= 0 && panelBox.r <= panelBox.W + 1 && panelBox.b <= panelBox.H + 1);

    // dust storm: light then heavy
    await pick('storm', 'light'); await wait(() => window.__director.stormFade >= 0.99, 20000); await sleep(200);
    const sL = await D(); R.stormLightInfo = { fog: sL.fog, dust: sL.dust, fade: sL.fade };
    ok('stormLight', null, sL.S.storm === 'light' && sL.dust?.n === (touch ? 160 : 600) && sL.fog.far <= 63 && sL.fog.far < d0.fog.far);
    await pick('storm', 'heavy'); await settle(0.3);
    const sH = await D(); R.stormHeavyInfo = { fog: sH.fog, dust: sH.dust };
    ok('stormHeavy', null, sH.S.storm === 'heavy' && sH.dust?.n === (touch ? 360 : 1400) && sH.fog.far <= 25 && sH.dust.visible);
    ok('stormMobileCheap', sH.dust?.n, !touch || sH.dust.n <= 400);
    await closePanel(); await sleep(600);
    const hudS = await G(measureHud); if (hudS.overlaps.length || hudS.off.length) bad.push('hudStorm:' + hudS.overlaps.concat(hudS.off).join(','));
    await shot('storm-heavy'); R.fpsStorm = await fps();
    const wind = await G(() => { const a = window.__director.dust; return a; }); R.windDust = wind;
    await openPanel();

    // time of day presets, slider, freeze, scale
    await pick('tod', 'night'); await settle();
    const tN = await D(); R.nightInfo = { light: tN.light, stars: tN.stars, sky: tN.sky };
    ok('night', null, Math.abs(tN.tod - 23) < 0.2 && tN.light.i < d0.light.i * 0.4 && tN.stars?.visible);
    await pick('storm', 'off'); await wait(() => window.__director.stormFade <= 0, 20000);
    await closePanel(); await sleep(400); await shot('night'); R.fpsNightHeavyOff = await fps(2000); await openPanel();
    for (const p of ['dawn', 'noon', 'dusk']) { await pick('tod', p); await settle(0.1); }
    const tD = await D(); R.duskInfo = { tod: tD.tod, sky: tD.sky, light: tD.light };
    ok('dusk', null, Math.abs(tD.tod - 18.3) < 0.2 && tD.light.i < d0.light.i);
    await G(() => { const r = document.getElementById('dirTime'); r.value = '9'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    await pick('freeze', 'true'); const f0 = (await D()).tod; await sleep(1500); const f1 = (await D()).tod;
    ok('sliderAndFreeze', { f0, f1 }, Math.abs(f0 - 9) < 0.05 && Math.abs(f1 - f0) < 1e-6);
    await pick('freeze', 'false'); await pick('timeScale', '16'); const ts0 = await D(); const c0 = ts0.tod, g0 = R.sharedClock ? ts0.rt : ts0.clock; await sleep(3000); const ts1 = await D(); const c1 = ts1.tod, g1 = R.sharedClock ? ts1.rt : ts1.clock;
    // SSX.time runs on real time; the fallback overlay on the director's own game clock
    // rate in in-game hours per game-minute (the engine clamps dt on slow headless frames, so measure against the director's own game clock)
    R.clock16 = { c0, c1, gameSec: Math.round((g1 - g0) * 100) / 100, rate: Math.round((c1 - c0) / ((g1 - g0) / 60) * 10) / 10 }; ok('timeScale', R.clock16, g1 - g0 > 0.3 && Math.abs(R.clock16.rate - 16) < 1.5);
    await pick('timeScale', '1');
    await pick('tod', 'game'); await settle(0.15);
    const tG = await D(); if (R.sharedClock) ok('liveCycleResumed', tG.T, !tG.T.frozen && tG.T.scale === 1 && tG.S.tod == null); else ok('gameLightingRestored', { sky: tG.sky, light: tG.light }, tG.sky.top === d0.sky.top && tG.sky.horizon === d0.sky.horizon && Math.abs(tG.light.i - d0.light.i) < 1e-6);

    // no cops
    ok('noTagBeforeCheats', null, !(await D()).tag);
    await G(() => window.__app.surface.world.setWanted(3, 'test')); await sleep(1500);
    const pre = await G(() => ({ w: window.__app.surface.world.wanted, sec: window.__app.surface.world.securityList().length })); R.copsBefore = pre;
    await pick('noCops', 'true'); await settle(1.2);
    await G(() => window.__app.surface.world.setWanted(4, 'test')); await settle(1.2);
    const nc = await G(() => ({ w: window.__app.surface.world.wanted, sec: window.__app.surface.world.securityList().length, resp: window.SSX.city.securityResponse(0, 0, 3) }));
    ok('noCops', nc, nc.w === 0 && nc.sec === 0 && nc.resp == null);

    // NPC density
    await pick('density', 'sparse'); await settle(0.3);
    const dn1 = await G(() => window.__app.surface.world.npcBudget()); await pick('density', 'empty'); await settle(0.3);
    const dn2 = await G(() => ({ b: window.__app.surface.world.npcBudget(), people: window.__app.surface.world.debug.livePeople() }));
    R.density = { sparse: dn1, empty: dn2 };
    ok('density', null, dn1.reserved.director === (touch ? 4 : 16) && dn2.b.reserved.director === (touch ? 8 : 30) && dn2.b.used <= dn2.b.cap && (!touch || dn2.b.cap === 12));
    await pick('density', 'normal');

    // invincible + ammo
    await pick('invincible', 'true'); await settle(0.15);
    const inv = await G(() => { const g = window.__app.surface.game, H = g.debug.H(), h0 = H.hp; g.debug.hurt(60); return { h0, h1: H.hp }; }); 
    ok('invincible', inv, inv.h1 >= inv.h0);
    await pick('ammo', 'true'); await sleep(200);
    await G(() => { window.__app.surface.game.progress.inv.shells = 0; }); await settle(0.15);
    const am = await G(() => window.__app.surface.game.progress.inv.shells);  ok('ammo', am, am >= 24);

    // vehicle picker
    const vlist = await G(() => [...document.querySelectorAll('#dirPanel [data-k=vehicle] button')].map(b => ({ v: b.dataset.v, dis: b.disabled })));
    R.vehicles = vlist; ok('vehicleList', null, vlist.length >= 3 && vlist.some(v => v.v === 'rover' && !v.dis));
    await pick('vehicle', 'rover'); await sleep(500);
    ok('vehicleSpawn', null, await G(() => { const i = window.__app.surface.info, r = window.__app.surface.mapData().rover; return window.__director.session.vehicle && !!r && Math.hypot(r.x - i.x, r.z - i.z) < 15; }));

    // DIRECTOR tag + rewards withheld
    await closePanel(); await sleep(400);
    const hudC = await G(measureHud); R.hudCheats = { overlaps: hudC.overlaps, off: hudC.off, tag: hudC.tag };
    ok('directorTag', hudC.tag, !!hudC.tag && hudC.tag.h > 0);
    if (hudC.overlaps.length || hudC.off.length) bad.push('hudCheats:' + hudC.overlaps.concat(hudC.off).join(','));
    await shot('cheats');
    const rw = await G(async () => {
      const g = window.__app.surface.game, P = g.progress; P.credits = 1000; P.xp = Math.max(P.xp, 100); const c0 = P.credits, x0 = P.xp;
      g.reward(0, 500);
      const c1 = P.credits;
      const id = 'dir-test-' + Date.now();
      g.registerMission({ id, world: 'Mars', title: 'Director test', intro: 'test', fiction: true, steps: [{ type: 'goto', at: [0, 0], r: 6, text: 'x' }], reward: { xp: 40, credits: 333 } });
      g.accept(id); g.debug.advance(); await new Promise(r => setTimeout(r, 600));
      return { c0, c1, c2: P.credits, x0, x2: P.xp, done: g.progress.quests?.[id]?.status };
    });
    ok('rewardsBlocked', rw, rw.c1 === rw.c0 && rw.c2 === rw.c0 && rw.x2 === rw.x0);

    // saved to localStorage
    const saved = await G(() => JSON.parse(localStorage.getItem('ssx.director.v1')));
    ok('saved', saved, saved.noCops && saved.invincible && saved.ammo && saved.density === 'normal' && saved.tod == null);

    // reset: everything back, tag stays (spawned vehicle is a session cheat), FPS check
    await openPanel(); await tapAt('#dirPanel [data-k=reset] button'); await sleep(400);
    const rs = await D(); R.reset = { S: rs.S, tag: rs.tag };
    ok('reset', null, !rs.S.noCops && !rs.S.invincible && !rs.S.ammo && rs.S.storm === 'off' && rs.S.tod == null && rs.tag === true && (!rs.T || (!rs.T.frozen && rs.T.scale === 1)));
    await closePanel(); await sleep(300);
    const hud9 = await G(measureHud); if (hud9.overlaps.length || hud9.off.length) bad.push('hudEnd:' + hud9.overlaps.concat(hud9.off).join(','));
    // fresh session: payouts flow again without cheats
    await G(() => { window.__director.session.vehicle = false; window.SSX.director.set('storm', 'off'); });
    const pay = await G(() => { const g = window.__app.surface.game, P = g.progress, c0 = P.credits; g.reward(0, 50); return P.credits - c0; });
    ok('rewardsBackWhenClean', pay, pay === 50);
    ok('tagHiddenWhenClean', null, await wait(() => !document.getElementById('dirTag').classList.contains('on'), 2000));

    ok('fpsSane', { base: fps0, storm: R.fpsStorm }, R.fpsStorm >= Math.min(20, fps0 * 0.6) && R.fpsStorm >= fps0 * 0.5);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 280)); R.fail = e.message.split('\n')[0]; }

  const serious = realErr.filter(e => /director|SyntaxError|TypeError|ReferenceError|PE /i.test(e));
  R.errors = serious.slice(0, 6); if (serious.length) bad.push('errors');
  R.bad = bad; R.verdict = bad.length ? 'FAIL ' + bad.join(' | ') : 'PASS';
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
