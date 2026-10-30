// Halvorsen Villa e2e (WebKit phone 393x852): the villa heist played on foot. Walls and shut doors block you, you
// cut the power, break in at the front door, walk room to room through doorways, crack the vault safe and walk out.
// BASE=http://127.0.0.1:8981/ OUT=/workspace/pw-ben-villa/shots/ node tests/test-villa.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8981/', BR = process.env.BR || 'webkit';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext({ ...iph, viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), bad = [], tag = `villa-393x852-${BR}`;
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; if (!cond) bad.push(k); console.log(cond ? 'ok  ' : 'FAIL', k, typeof v === 'object' ? JSON.stringify(v) : v); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = async name => { for (let i = 0; i < 2; i++) { try { await page.screenshot({ path: `${out}${tag}-${name}.png`, timeout: 120000 }); return true; } catch (e) {} } return false; };
  const tapEl = sel => G(async sel => { const b = document.querySelector(sel); if (!b) return false; const r = b.getBoundingClientRect(), o = { pointerId: 61, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 60)); b.dispatchEvent(new PointerEvent('pointerup', o)); return true; }, sel);
  // villa-local helpers (metres from the villa centre, +z = street side)
  const place = (x, z, yaw = 0) => G(([x, z, yaw]) => { const s = window.__villa.state; window.__app.surface.debugMove(s.x + x, s.z + z, yaw); }, [x, z, yaw]);
  const here = () => G(() => { const i = window.__app.surface.info; return window.__villa.local(i.x, i.z) || { x: NaN, z: NaN, room: null, gone: true, at: [i.x, i.z] }; });
  const face = (x, z) => G(([x, z]) => { const s = window.__villa.state, p = window.__app.surface.info, dx = s.x + x - p.x, dz = s.z + z - p.z; window.__app.surface.debugPlace(p.x, p.z, Math.atan2(-dx, -dz)); }, [x, z]);
  const hold = async ms => { await G(() => { window.__app.keys.KeyW = true; }); await sleep(ms); await G(() => { window.__app.keys.KeyW = false; }); await frames(3); return here(); };
  // walk (W held, steering each 120 ms) to a local point; returns where you ended up
  const walkTo = async (x, z, ms = 6000) => {
    const t0 = Date.now(); await G(() => { window.__app.keys.KeyW = true; });
    while (Date.now() - t0 < ms) { const p = await here(); if (Math.hypot(p.x - x, p.z - z) < 0.6) break; await face(x, z); await sleep(120); }
    await G(() => { window.__app.keys.KeyW = false; }); await frames(3); return here();
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"done":true,"skipped":true}'); localStorage.setItem('ssx.heist.unlock', '{"v":1,"unlocked":true,"tipped":true,"at":0}'); window.__app.game?.reload?.(); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(1500);
    await G(() => document.getElementById('radioLater')?.click());
    // ---- walk up: the villa builds as you get near
    await G(() => { const W = window.__app.surface.world, c = W.colonyAt([370, 85]); window.__app.surface.debugMove(c.x + 13, c.z + 19, 0); });
    ok('villa built', await wait(() => !!window.__villa?.state, 10000), await G(() => window.__villa.state && { mode: window.__villa.state.mode, walls: window.__villa.state.walls, top: window.__villa.state.top }));
    const zone = await G(() => { const s = window.__villa.state; return window.__app.surface.world.districtAt?.(s.x, s.z)?.name; }); ok('in Helios Heights', zone, /Helios/.test(zone || ''));
    ok('guards on patrol', await G(() => window.__villa.state.guards.map(g => g.id + ':' + (g.room || 'yard'))), await G(() => window.__villa.state.guards.length >= 1));
    await G(() => window.__villa.blind(true)); // the walk-through below is about walls; guard sight is checked at the end
    await place(13, 19, Math.atan2(13, 19)); await frames(20); await shot('exterior');
    // ---- start the job from ☰ Heists
    await G(() => document.getElementById('radio') && (document.getElementById('radio').style.display = 'none'));
    await tapEl('#menuBtn'); await sleep(400); await tapEl('#heistMenu'); await wait(() => document.getElementById('heistPanel')?.classList.contains('on'), 5000);
    await tapEl('#heistPanel button[data-id="heist-halvorsen-villa"]'); ok('heist started', await wait(() => window.SSX.heist.active?.id === 'heist-halvorsen-villa' && !!window.SSX.heist.active.w, 8000));
    await sleep(1500); const gc = await G(() => ({ villa: window.__villa.state.guards.length, extra: (window.SSX.heist.guards?.list?.() || []).length, reserved: window.__app.surface.world.npcBudget().reserved }));
    ok('only the villa\'s own guards (no armed copies from guards.js)', gc, gc.extra === 0 && gc.villa >= 1 && gc.villa <= 2 && !gc.reserved['heist-guards']);
    // ---- cut the power out back first (real action button), out of sight of the porch camera
    await place(-6, -9.2, 0); await frames(4); const pw0 = await walkTo(-6, -8.2, 3000);
    ok('power box reachable', pw0, await wait(() => /Cut power/.test(window.SSX.heist.action || ''), 5000));
    await tapEl('#heistBtn'); ok('cameras off', await wait(() => window.SSX.heist.cameras().every(c => c.disabled), 4000));
    // ---- walls are solid; the front door is locked until you break in
    await place(4, 9.5, 0); await frames(4); const w1 = await hold(2200);
    ok('front wall blocks you', w1, w1.z > 6.3 && !w1.room);
    await shot('blocked-by-wall');
    await place(0, 9.5, 0); await frames(4); const d1 = await hold(2200);
    ok('locked front door blocks you', d1, d1.z > 6.3 && !d1.room);
    await place(12, 3, Math.PI / 2); await frames(4); const w2 = await hold(2200);
    ok('side wall blocks you', w2, w2.x > 9.3 && !w2.room);
    ok('no heat yet', await G(() => window.__app.surface.world.wanted), await G(() => window.__app.surface.world.wanted === 0));
    // ---- break in at the front door, then walk in through it
    await place(0, 8.4, 0); await frames(4); await walkTo(0, 7.4, 2500);
    ok('break-in at the door', await wait(() => /Break in/.test(window.SSX.heist.action || ''), 5000), await G(() => window.SSX.heist.action));
    await tapEl('#heistBtn'); ok('inside: crack stage', await wait(() => window.SSX.heist.active?.stage === 'crack', 8000));
    ok('front door opens', await wait(() => window.__villa.state.doors.front.shut === false, 4000));
    const in1 = await walkTo(0, 3.5, 5000); ok('walk in through the front door', in1, in1.room === 'hall');
    // ---- interior walls: hall -> vault only through the vault door
    await walkTo(3.6, 2.2, 4000); await face(3.6, -3); const w3 = await hold(2000);
    ok('hall/vault wall blocks you', w3, w3.room === 'hall' && w3.z > 0.4);
    await G(() => window.__villa.guardAt('hv-guard-hall', 3.5)); await walkTo(-1, 4, 5000); await face(6, 2.4); await frames(20);
    ok('hall guard in the hall', await G(() => window.__villa.state.guards.find(g => g.id === 'hv-guard-hall')?.room === 'hall'));
    await shot('interior-guard');
    await walkTo(5.5, 1.6, 5000); ok('vault door opens as you reach it', await wait(() => window.__villa.state.doors.vault.shut === false, 4000));
    const v1 = await walkTo(5.5, -1.6, 4000); ok('into the vault through its door', v1, v1.room === 'vault');
    const v2 = await walkTo(6.5, -3.6, 4000); ok('at the safe', v2, await wait(() => /Crack/.test(window.SSX.heist.action || ''), 4000));
    await face(6.5, -6); await frames(15); await shot('vault');
    await G(() => { const H = window.SSX.heist, o = H.safeCrack; H.safeCrack = () => { H.safeCrack = o; return Promise.resolve({ success: true, ok: true, time: 20, noise: 0 }); }; });
    await tapEl('#heistBtn'); ok('safe open: escape', await wait(() => window.SSX.heist.active?.stage === 'escape', 8000));
    // ---- walk back out the way you came (vault door, hall, front door)
    await walkTo(5.5, 1.2, 5000); await walkTo(0.2, 3, 6000); const o1 = await walkTo(0, 12, 6000);
    ok('out through the front door', o1, o1.z > 9 && !o1.room);
    await G(() => { const s = window.__villa.state; window.__app.surface.debugMove(s.x + 40, s.z + 40, 0); }); await frames(10);
    await wait(() => window.SSX.heist.active?.stage !== 'escape', 8000); await G(() => window.__app.surface.world.setWanted(0, 'test: lost them'));
    ok('clean getaway', await wait(() => !window.SSX.heist.active, 8000));
    // ---- guards can see you (and walls hide you)
    await G(() => { window.__villa.blind(false); window.SSX.heist.startHeist('heist-halvorsen-villa'); }); await wait(() => !!window.SSX.heist.active?.w, 5000);
    await G(() => window.__villa.guardAt('hv-guard-yard', 2)); await frames(3); // standing at his first corner, about to walk east
    const yg = await G(() => window.__villa.state.guards.find(g => g.id === 'hv-guard-yard'));
    if (yg) { await G(([x, z]) => window.__app.surface.debugMove(x + 3, z, Math.PI / 2), [yg.x, yg.z]);
      ok('yard guard spots you in the open', await wait(() => window.__villa.state.spotted > 0, 5000), await G(() => ({ spotted: window.__villa.state.spotted, wanted: window.__app.surface.world.wanted }))); }
    await G(() => { window.SSX.heist.abortHeist('test'); window.__app.surface.world.setWanted(0); });
  } catch (e) { bad.push('EXC ' + e.message); console.log('EXC', e.message); }
  ok('no page errors', errors.slice(0, 6), errors.length === 0);
  console.log(JSON.stringify({ tag, bad }));
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
