// v7.5.40 jetpack vs Halvorsen Villa. Since v7.5.39 the jetpack clears walls (rooftops), and the villa roof was only a
// picture: you dropped through it into the locked house. Checks, with a real jetpack flight (Space / W):
//  locked (no Sable tip, no Helios bribe): no villa, no heist to start, nothing to loot wherever you jet;
//  unlocked (tip) and bribed (Helios pass): jet over the back wall -> you land ON the roof (not in the vault), the job is
//  still at 'case' with the front door shut, no Crack from the roof over the safe, the front door break-in, guards and the
//  safe on the floor still work, a jetpack lit indoors stops at the ceiling.
// BASE=http://localhost:8765/ BR=chromium DEV="iPhone 14" node tests/test-villa-jetpack.js   (DEV=desktop for 1366x768)
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VID = 'heist-halvorsen-villa';
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...dev } = desk ? { viewport: { width: 1366, height: 768 } } : pw.devices[DEV];
  const ctx = await browser.newContext(dev); const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const keys = (on, ...ks) => G(([on, ks]) => { for (const k of ks) window.__app.keys[k] = on; }, [on, ks]);
  const tap = sel => G(async sel => { const b = document.querySelector(sel); if (!b) return false; const r = b.getBoundingClientRect(), o = { pointerId: 61, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 60)); b.dispatchEvent(new PointerEvent('pointerup', o)); return true; }, sel);
  const SAVE = { v: 1, xp: 300, credits: 9000, badges: ['first'], quests: {}, equip: { paint: 'steel' }, unlocks: [], inv: { medkits: 1 }, flags: ['jetpack'] };
  // villa-local position of the player (+ feet height, villa floor, roof top)
  const L = () => G(() => { const p = window.__tc.player, w = window.__app.surface.world, s = window.__villa?.state, l = s ? window.__villa.local(p.x, p.z) : null;
    return { x: l ? +l.x.toFixed(2) : null, z: l ? +l.z.toFixed(2) : null, room: l?.room ?? null, feet: +(p.y - 1.7).toFixed(2), terr: +w.groundAt(p.x, p.z).toFixed(2), top: s?.top ?? null, y0: s?.y0 ?? null, g: !!p.grounded }; });
  const put = (x, z, yaw, up = 0) => G(([x, z, yaw, up]) => { const s = window.__villa.state, p = window.__tc.player, w = window.__app.surface.world; window.__app.surface.debugPlace(s.x + x, s.z + z, yaw);
    p.x = s.x + x; p.z = s.z + z; p.y = (up ? s.top + up : w.groundAt(p.x, p.z)) + 1.7; p.vy = 0; }, [x, z, yaw, up]);
  const boot = async (unlock) => {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(([s, u]) => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"done":true,"skipped":true}'); localStorage.setItem('ssx.progress.v1', JSON.stringify(s));
      localStorage.setItem('ssx.jetpack.v1', JSON.stringify({ owned: true, on: true })); if (u) localStorage.setItem('ssx.heist.unlock', '{"v":1,"unlocked":true,"tipped":true,"at":0}'); }, [SAVE, unlock]);
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(800);
    await G(() => { window.__app.surface.game.setAliens?.(false); (window.SSX_TICKS ||= []).push((dt, tc) => { window.__tc = tc; }); document.getElementById('radioLater')?.click(); }); await frames(3);
  };
  const toVilla = () => G(() => { const W = window.__app.surface.world, c = W.colonyAt([370, 85]); window.__app.surface.debugMove(c.x + 13, c.z + 19, 0); });
  // real flight: from (sx, sz) on the ground, Space up past the roof, W toward (tx, tz), let go and land
  const jetOver = async (sx, sz, tx, tz) => {
    const yaw = Math.atan2(-(tx - sx), -(tz - sz)); await put(sx, sz, yaw); await frames(4);
    const top = (await L()).top; await keys(true, 'Space'); { const t0 = Date.now(); while (Date.now() - t0 < 15000) { await sleep(60); if ((await L()).feet > top + 1.5) break; } }
    await keys(true, 'KeyW'); { const t0 = Date.now(); while (Date.now() - t0 < 9000) { await sleep(60); const q = await L(); if (Math.hypot(q.x - tx, q.z - tz) < 1.2 || (tz - sz) * (q.z - tz) + (tx - sx) * (q.x - tx) > 0) break; if (q.feet > top + 4) await keys(false, 'Space'); else if (q.feet < top + 1.2) await keys(true, 'Space'); } }
    await keys(false, 'Space', 'KeyW'); await wait(() => window.__tc.player.grounded, 25000); await sleep(800); return L();
  };
  try {
    // ---- 1. locked: no tip, no bribe -> no villa, no job, no loot
    await boot(false); await toVilla(); await sleep(2500);
    ok('lockedNoVilla', await G(() => ({ built: !!window.__villa?.state, listed: window.SSX.heist.heists().some(h => h.id === 'heist-halvorsen-villa') })).then(JSON.stringify), await G(() => !window.__villa?.state && !window.SSX.heist.heists().some(h => h.id === 'heist-halvorsen-villa')));
    const st = await G(id => window.SSX.heist.startHeist(id).then(() => 'started', e => 'refused: ' + e.message), VID);
    ok('lockedCantStart', st, /refused/.test(st) && await G(() => !window.SSX.heist.active));
    // ---- 2 + 3. unlocked by Sable's tip, then by a Helios bribe
    for (const via of ['tip', 'bribe']) {
      await boot(via === 'tip');
      if (via === 'bribe') { // a real Helios pass: Porter's panel, pay 350 cr (mars/heliospass.js)
        await wait(() => !!window.SSX?.heliosPass && !!window.SSX?.heist, 10000);
        await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); window.SSX.heliosPass.debug.reset(); window.SSX.heliosPass.offer('Porter', true); });
        await wait(() => document.getElementById('hpassPanel')?.classList.contains('on'), 3000); await tap('#hpassPanel button[data-i="0"]');
        ok('bribePass', await wait(() => !!window.SSX.heliosPass.state().pass && window.SSX.heist.heists().some(h => h.id === 'heist-halvorsen-villa'), 4000)); }
      await toVilla(); ok(via + ':villaBuilt', await wait(() => !!window.__villa?.state, 15000));
      await G(() => window.__villa.blind(true)); await G(id => { window.SSX.heist.startHeist(id); }, VID);
      ok(via + ':jobStarts', await wait(() => window.SSX.heist.active?.id === 'heist-halvorsen-villa' && !!window.SSX.heist.active.w, 8000));
      ok(via + ':guardsOut', await wait(() => window.__villa.state.guards.length >= 1, 8000));
      // jet from behind the back wall to right over the vault (local 6, -3) and let go
      let q = await jetOver(6, -10.5, 6, -3);
      ok(via + ':landsOnRoof', JSON.stringify(q), q.g && Math.abs(q.feet - q.top) < 0.15 && Math.abs(q.x) < 9 && Math.abs(q.z) < 6);
      ok(via + ':notInVault', JSON.stringify({ feet: q.feet, top: q.top }), q.feet > q.y0 + 3);
      ok(via + ':stillCase', await G(() => ({ stage: window.SSX.heist.active?.stage, front: window.__villa.state.doors.front.shut, vault: window.__villa.state.doors.vault.shut })).then(JSON.stringify), await G(() => window.SSX.heist.active?.stage === 'case' && window.__villa.state.doors.front.shut));
      if (via === 'tip') await page.screenshot({ path: `${out}villa-roof-${tag}.png` });
      // walk about on the roof: never fall in
      let minFeet = 1e9; for (const [k, ms] of [['KeyA', 700], ['KeyD', 1200]]) { await keys(true, k); const t0 = Date.now(); while (Date.now() - t0 < ms) { await sleep(80); minFeet = Math.min(minFeet, (await L()).feet); } await keys(false, k); }
      ok(via + ':walksOnRoof', +(q.top - minFeet).toFixed(2), q.top - minFeet < 0.2);
      // the front door break-in still works (jet down into the front yard, land, walk to the ring)
      q = await jetOver(0, 14, 0, 8.6);
      ok(via + ':landsInYard', JSON.stringify(q), q.g && Math.abs(q.feet - q.terr) < 0.3 && q.z > 6.4);
      await put(0, 7.6, 0); await frames(6);
      ok(via + ':breakInRing', await wait(() => /Break in/.test(window.SSX.heist.action || ''), 5000), await G(() => window.SSX.heist.action));
      await tap('#heistBtn');
      ok(via + ':crackStage', await wait(() => window.SSX.heist.active?.stage === 'crack', 8000), await G(() => window.SSX.heist.active?.stage));
      // standing on the roof right over the safe: no Crack
      await put(6.5, -4.2, 0, 0.02); await sleep(1200); q = await L();
      ok(via + ':noCrackFromRoof', JSON.stringify({ action: await G(() => window.SSX.heist.action || null), dTop: +(q.feet - q.top).toFixed(2) }), Math.abs(q.feet - q.top) < 0.2 && !/Crack/.test(await G(() => window.SSX.heist.action || '')));
      // on the vault floor: Crack is offered
      await put(6.5, -3.6, 0); await sleep(800);
      ok(via + ':crackOnFloor', await wait(() => /Crack/.test(window.SSX.heist.action || ''), 5000), await G(() => window.SSX.heist.action));
      // a jetpack lit in the hall stops at the ceiling (no popping out on top)
      await put(0, 3, 0); await frames(4); await keys(true, 'Space'); let maxFeet = -1e9; { const t0 = Date.now(); while (Date.now() - t0 < 2500) { await sleep(80); maxFeet = Math.max(maxFeet, (await L()).feet); } } await keys(false, 'Space');
      await wait(() => window.__tc.player.grounded, 6000); q = await L();
      ok(via + ':ceilingIndoors', JSON.stringify({ maxUp: +(maxFeet - q.y0).toFixed(2), room: q.room, back: +(q.feet - q.terr).toFixed(2) }), maxFeet < q.y0 + 2.2 && q.room === 'hall' && Math.abs(q.feet - q.terr) < 0.3);
      await G(() => { window.SSX.heist.abortHeist('test'); window.__app.surface.world.setWanted(0); });
    }
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors.slice(0, 6); if (R.errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
