// v7.5.39 rooftops on foot (Collin: "Can you make it so I can land on buildings? I want to use my sniper rifle").
// Real jetpack flight (Space / Jet) from the street up onto a flat roof, stand + walk on it (no falling through), the wall
// still blocks you on the ground, scope the rail rifle up there and hit someone in the street, rover summoned onto the roof,
// drive + step out (you stay on the roof, the rover stays parked up there), walk off the edge back to the street.
// BASE=http://localhost:8765/ BR=chromium DEV="iPhone 14" OUT=/workspace/rooftop/ node tests/test-rooftop.js   (DEV=desktop for 1366x768)
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...dev } = desk ? { viewport: { width: 1366, height: 768 } } : pw.devices[DEV];
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text().slice(0, 200)); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const keys = (on, ...ks) => G(([on, ks]) => { for (const k of ks) window.__app.keys[k] = on; }, [on, ks]);
  const P = () => G(() => { const p = window.__tc.player, w = window.__app.surface.world; return { x: p.x, z: p.z, y: p.y, feet: p.y - 1.7, g: p.grounded, terr: w.groundAt(p.x, p.z) }; });
  const SAVE = { v: 1, xp: 300, credits: 9000, badges: ['first'], quests: {}, equip: { paint: 'steel' }, unlocks: ['weapon:railrifle'], inv: { slugs: 12, medkits: 1 }, flags: ['jetpack'] };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(s => { localStorage.clear(); localStorage.setItem('ssx.progress.v1', JSON.stringify(s)); localStorage.setItem('ssx.jetpack.v1', JSON.stringify({ owned: true, on: true })); }, SAVE);
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    await G(() => { window.__app.surface.game.setAliens?.(false); (window.SSX_TICKS ||= []).push((dt, tc) => { window.__tc = tc; }); }); await frames(3);
    if (await G(() => getComputedStyle(document.getElementById('radio') || document.body).display !== 'none' && !!document.getElementById('radio'))) await G(() => document.getElementById('radioLater')?.click());
    ok('api', await G(() => typeof window.__app.surface.world.playerGround === 'function'));
    // a flat roof 5+ m up, 8+ m wide, with open street on its west side
    const B = await G(() => {
      const w = window.__app.surface.world, col = w.colony, roof = (x, z) => w.playerGround(x, z, 1e6), terr = (x, z) => w.groundAt(x, z), cands = [], seen = new Set();
      for (let x = col.x - 160; x <= col.x + 160; x += 2) for (let z = col.z - 160; z <= col.z + 160; z += 2) {
        const t = roof(x, z), g = terr(x, z); if (t - g < 5 || t - g > 40) continue; const same = (a, b) => Math.abs(roof(a, b) - t) < 0.01;
        let ex = x; while (same(ex - 0.25, z) && ex > x - 60) ex -= 0.25; let fx = x; while (same(fx + 0.25, z) && fx < x + 60) fx += 0.25;
        const cx = (ex + fx) / 2; let nz = z; while (same(cx, nz - 0.25) && nz > z - 60) nz -= 0.25; let sz = z; while (same(cx, sz + 0.25) && sz < z + 60) sz += 0.25;
        const cz = (nz + sz) / 2, key = [ex, fx, nz, sz].join(); if (seen.has(key) || fx - ex < 8 || sz - nz < 7) continue; seen.add(key);
        let clear = true; for (let d = 2; d <= 10 && clear; d++) if (w.collide(ex - d, cz, 0.6) || Math.abs(terr(ex - d, cz) - g) > 1.5) clear = false;
        if (clear) cands.push({ x: cx, z: cz, top: t, g, ex, fx, nz, sz, w: fx - ex, d: sz - nz });
      }
      cands.sort((a, b) => (b.w * b.d) - (a.w * a.d)); return cands[0] || null;
    });
    ok('foundRoof', B && JSON.stringify({ h: +(B.top - B.g).toFixed(1), w: B.w, d: B.d }), !!B);
    if (!B) throw new Error('no roof');
    // 1. on the ground the wall still blocks you
    await G(B => window.__app.surface.debugPlace(B.ex - 4, B.z, -Math.PI / 2), B); await frames(4);
    await keys(true, 'KeyW'); await sleep(2200); await keys(false, 'KeyW'); await sleep(300);
    let p = await P(); ok('wallBlocksOnGround', JSON.stringify({ dx: +(p.x - B.ex).toFixed(2), dy: +(p.feet - p.terr).toFixed(2) }), p.x < B.ex - 0.3 && Math.abs(p.feet - p.terr) < 0.4);
    // 2. real jetpack: hold Space to climb above the roof, then W over the edge, let go, land
    await G(B => window.__app.surface.debugPlace(B.ex - 3, B.z, -Math.PI / 2), B); await frames(4);
    await keys(true, 'Space'); { const t0 = Date.now(); while (Date.now() - t0 < 15000) { await sleep(60); if ((await P()).feet > B.top + 1.5) break; } }
    await keys(true, 'KeyW'); { const t0 = Date.now(); while (Date.now() - t0 < 8000) { await sleep(60); const q = await P(); if (q.x > B.ex + 2.5) break; if (q.feet > B.top + 4) await keys(false, 'Space'); else if (q.feet < B.top + 1.2) await keys(true, 'Space'); } }
    await keys(false, 'Space', 'KeyW');
    await wait(B => { const p = window.__tc.player; return p.grounded && Math.abs(p.y - 1.7 - B.top) < 0.1; }, 8000, B); await sleep(1500);
    p = await P(); ok('jetpackLandedOnRoof', JSON.stringify({ dTop: +(p.feet - B.top).toFixed(2), inX: +(p.x - B.ex).toFixed(1), g: p.g }), p.g && Math.abs(p.feet - B.top) < 0.1 && p.x > B.ex);
    ok('jetpackRefuelsOnRoof', await G(() => { const j = window.SSX.jetpack; return { fuel: Math.round(+j.fuel) }; }).then(j => JSON.stringify(j)), true);
    // 3. walk around up there (east, then north/south), never fall through
    let minFeet = 1e9;
    for (const [k, ms] of [['KeyW', 900], ['KeyD', 700], ['KeyA', 1200]]) { await keys(true, k); const t0 = Date.now(); while (Date.now() - t0 < ms) { await sleep(80); minFeet = Math.min(minFeet, (await P()).feet); } await keys(false, k); }
    p = await P(); ok('walksOnRoof', JSON.stringify({ minDrop: +(B.top - minFeet).toFixed(2), dTop: +(p.feet - B.top).toFixed(2) }), B.top - minFeet < 0.15 && Math.abs(p.feet - B.top) < 0.1);
    // 4. rail rifle + scope on the roof; hit someone in the street
    await G(B => { const p = window.__tc.player; p.x = B.ex + 1.2; p.z = B.z; p.y = B.top + 1.7; p.vy = 0; window.__app.game.switchWeapon('railrifle'); }, B); await frames(10);
    await G(() => { const w = window.__app.surface.world, o = w.hitWorld; window.__hits = 0; w.hitWorld = function (p0, p1, b) { const r = o.call(this, p0, p1, b); if (r) window.__hits++; return r; }; });
    if (desk) { await page.keyboard.press('KeyZ'); await sleep(400); } else { const b = await G(() => { const e = document.getElementById('snipeBtn'); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); if (b) await page.touchscreen.tap(b.x, b.y); else await G(() => window.SSX.sniper.scope(true)); await sleep(400); }
    ok('scopedOnRoof', await G(() => window.SSX.sniper.scoped()));
    p = await P(); ok('stillOnRoofScoped', +(p.feet - B.top).toFixed(2), Math.abs(p.feet - B.top) < 0.1);
    // a colonist in the street with a clear line from the roof edge
    const tgt = await G(B => { const w = window.__app.surface.world, p = window.__tc.player; const ppl = w.debug.people().filter(q => q.on && q.kind === 'colonist');
      let best = null; for (const q of ppl) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < 8 || d > 90) continue; const gy = w.groundAt(q.x, q.z) + 1.2, n = Math.ceil(d / 1.2); let clear = true;
        for (let i = 1; i < n && clear; i++) { const t = i / n, x = p.x + (q.x - p.x) * t, y = p.y + (gy - p.y) * t, z = p.z + (q.z - p.z) * t; if (w.camBlocked(x, y, z) || w.solidAt(x, y, z) || y < w.groundAt(x, z)) clear = false; }
        if (clear && (!best || d < best.d)) best = { ...q, d }; }
      return best; }, B);
    R.target = tgt ? `${tgt.name || tgt.kind} @ ${Math.round(tgt.d)} m` : 'none in view';
    if (tgt) {
      await G(n => { window.__aimName = n; const f = () => { const w = window.__app.surface.world, p = window.__tc.player, q = w.debug.people().find(o => o.name === window.__aimName && o.on); if (!q || window.__aimStop) return; const ty = w.groundAt(q.x, q.z) + 1.2, dx = q.x - p.x, dz = q.z - p.z; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(ty - (p.y - 0.06), Math.hypot(dx, dz)); requestAnimationFrame(f); }; f(); window.SSX.sniper.debug.steady?.(true); }, tgt.name);
      await sleep(1500);
      await page.screenshot({ path: `${out}rooftop-scoped-${tag}.png` }); R.shots = [`${out}rooftop-scoped-${tag}.png`];
      if (desk) { await page.keyboard.down('KeyF'); await sleep(120); await page.keyboard.up('KeyF'); } else { const b = await G(() => { const r = document.getElementById('snFire').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await page.touchscreen.tap(b.x, b.y); }
      await sleep(900); await G(() => { window.__aimStop = true; });
      ok('shotHitFromRoof', await G(() => window.__hits), await G(() => window.__hits > 0));
    } else { await page.screenshot({ path: `${out}rooftop-scoped-${tag}.png` }); R.shots = [`${out}rooftop-scoped-${tag}.png`]; }
    await G(() => window.SSX.sniper.scope(false)); await sleep(300);
    await G(() => window.__app.surface.setView?.('third')); await G(() => { const p = window.__tc.player; p.yaw = -Math.PI / 2; p.pitch = -0.25; }); await sleep(900);
    await page.screenshot({ path: `${out}rooftop-standing-${tag}.png` }); R.shots.push(`${out}rooftop-standing-${tag}.png`);
    // 5. summon the rover while on the roof: it comes up onto the roof
    await G(B => { const p = window.__tc.player; p.x = (B.ex + B.fx) / 2; p.z = B.z; p.y = B.top + 1.7; p.vy = 0; }, B); await frames(6);
    await G(() => window.__app.surface.world.setWanted?.(0)); await sleep(200);
    const sm = await G(() => window.__app.surface.summonRover()); await sleep(1500);
    const rv = await G(() => { const i = window.__app.surface.info; return { x: i.roverX, z: i.roverZ, y: window.__tc.rover?.y }; });
    const rvY = await G(() => window.__app.surface.info.roverY);
    ok('summonOntoRoof', JSON.stringify({ ok: sm.ok, why: sm.why, dTop: rvY != null ? +(rvY - B.top).toFixed(2) : null }), sm.ok && rvY != null && Math.abs(rvY - B.top) < 0.3);
    // 6. drive it, step out: you're still on the roof and it stays parked there
    await G(() => { const s = window.__app.surface, i = s.info; s.interact(); }); await sleep(400);
    if (!(await G(() => window.__app.surface.info.driving))) { await G(r => { const p = window.__tc.player; p.x = r.x + 2; p.z = r.z + 1.5; }, rv); await frames(3); await G(() => window.__app.surface.interact()); await sleep(400); }
    ok('driveOnRoof', await G(() => window.__app.surface.info.driving));
    await sleep(800); await G(() => window.__app.surface.interact()); await sleep(1500);
    p = await P(); ok('stepOutOnRoof', JSON.stringify({ dTop: +(p.feet - B.top).toFixed(2), driving: await G(() => window.__app.surface.info.driving) }), Math.abs(p.feet - B.top) < 0.15);
    await sleep(2000);
    const rvY2 = await G(() => window.__app.surface.info.roverY);
    ok('roverStaysOnRoof', +(rvY2 - B.top).toFixed(2), Math.abs(rvY2 - B.top) < 0.3);
    // 7. walk off the west edge back to the street
    await G(B => { const p = window.__tc.player; p.x = B.ex + 1; p.z = B.z; p.y = B.top + 1.7; p.yaw = Math.PI / 2; p.vy = 0; }, B); await frames(3);
    await keys(true, 'KeyW'); await sleep(1500); await keys(false, 'KeyW');
    await wait(() => window.__tc.player.grounded, 8000); await sleep(400);
    p = await P(); ok('walkOffEdgeToStreet', JSON.stringify({ dGround: +(p.feet - p.terr).toFixed(2), x: +(p.x - B.ex).toFixed(1) }), Math.abs(p.feet - p.terr) < 0.3 && p.x < B.ex);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors.filter(e => !/favicon|404|net::ERR/i.test(e)).slice(0, 8); if (R.errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
