// v7.5.72 habitat + landing pad on a Mars base lot.
// Buy Junction Ridge, open build, the toolbar gains 🛏️ Habitat and 🛬 Landing pad (still on-screen, centre clear,
// 44px), place both, Rest heals on a 3 min cooldown and does nothing at full health, Call rover parks the ride on
// the pad. Touch runs the action with a second finger while a thumb holds the joystick.
// BASE=http://127.0.0.1:8872/ BR=webkit DEV="iPhone 14 Pro" node tests/test-v7572-base.js
const pw = require('playwright');
const fs = require('fs');
const base = process.env.BASE || 'http://127.0.0.1:8872/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR ? process.env.SHOTS_DIR.replace(/\/?$/, '/') : '') || '/tmp/v7572/';
const desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  let opts = desk ? { viewport: { width: 1440, height: 900 }, hasTouch: false } : { ...pw.devices[DEV] };
  delete opts.defaultBrowserType;
  // iPhone 14 Pro's device profile is the Safari chrome box (393x660). The shot the release wants is the full phone, 393x852.
  if (!desk && /iPhone 14 Pro/.test(DEV)) { opts.viewport = { width: 393, height: 852 }; opts.screen = { width: 393, height: 852 }; }
  if (!desk && DEV === 'iPhone SE') { opts.viewport = { width: 375, height: 667 }; opts.screen = { width: 375, height: 667 }; } // SE (3rd gen); the device profile is the old 320x568 SE
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text().slice(0, 240)); });
  const vp = page.viewportSize(), tag = `v7572-${vp.width}x${vp.height}-${BR}`;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const stickTap = sel => G(async sel => {
    const j = document.getElementById('joy'), b = document.querySelector(sel); if (!b) return 'missing ' + sel;
    const jr = j.getBoundingClientRect(), br = b.getBoundingClientRect(), sl = ms => new Promise(r => setTimeout(r, ms));
    const ev = (el, t, id, r) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 50, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    ev(j, 'pointerdown', 50, jr); await sl(60); ev(b, 'pointerdown', 51, br); await sl(60); ev(b, 'pointerup', 51, br); await sl(60); ev(j, 'pointerup', 50, jr); return 'ok';
  }, sel);
  const ourTap = async sel => { if (desk) await page.click(sel); else { const r = await stickTap(sel); R['stick ' + sel] = r; if (r !== 'ok') bad.push('stick ' + sel); } };
  const act = async () => { if (desk) await page.keyboard.press('KeyK'); else await ourTap('#baseBtn'); };
  const move = (x, z, yaw = 0) => G(([x, z, yaw]) => window.__app.surface.debugMove(x, z, yaw), [x, z, yaw]);
  const PID = 'aj-north';
  const cellC = (i, j, w, d) => [(i + w / 2) * 2 - 10, (j + d / 2) * 2 - 10];
  const aimAt = async (lx, lz) => {
    const c = await G(id => window.SSX.base.plots().find(p => p.id === id).world, PID);
    let px = c.x + lx, pz = c.z + lz + 5; await move(px, pz, 0); await sleep(400);
    let prev = null;
    for (let k = 0; k < 10; k++) {
      const cur = await G(() => window.SSX.base.debug.cursor()); if (!cur) break;
      const still = prev && Math.hypot(cur.x - prev.x, cur.z - prev.z) < 0.05; prev = cur;
      const dx = lx - cur.x, dz = lz - cur.z;
      if (Math.hypot(dx, dz) < 0.35) { if (still) break; await sleep(400); continue; }
      px += dx; pz += dz; await move(px, pz, 0); prev = null; await sleep(500);
    }
    return G(() => window.SSX.base.debug.cursor());
  };
  try {
    await page.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 });
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); localStorage.removeItem('ssx.base.v1'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(800);
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) {} try { window.SSX.control?.debug?.setTimes({ first: 9999, after: 9999 }); } catch (e) {} const r = document.getElementById('radio'); if (r) r.style.display = 'none'; window.__app.surface.game.debug.credits(20000); });
    ok('api', await wait(() => !!window.SSX?.base?.ready && window.SSX.base.PIECES.hab && window.SSX.base.PIECES.pad, 15000));
    ok('plot', await wait(id => !!window.SSX.base.plots().find(p => p.id === id)?.world, 8000, PID));
    const bought = await G(id => window.SSX.base.buy(id), PID);
    ok('bought', bought, bought && bought.ok);
    const c = await G(id => window.SSX.base.plots().find(p => p.id === id).world, PID);
    await move(c.x, c.z + 4, 0);
    ok('buildBtn', await wait(() => window.SSX.base.action === '🏗️ Build', 8000));
    await act();
    ok('building', await wait(() => !!window.SSX.base.building, 5000));
    const tb = await G(() => {
      const W = innerWidth, H = innerHeight, mm = document.getElementById('miniMap')?.getBoundingClientRect(), bad = [];
      const hit = (a, b) => b && b.width && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      const centre = { left: W * 0.25, right: W * 0.75, top: H * 0.25, bottom: H * 0.75, width: 1 };
      const btns = [...document.querySelectorAll('#baseBar button')];
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) bad.push(b.id + ':size');
        if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(b.id + ':off');
        if (hit(r, mm)) bad.push(b.id + ':minimap');
        if (hit(r, centre)) bad.push(b.id + ':centre');
      }
      return { n: btns.length, ids: btns.map(b => b.dataset.t || b.dataset.a), bad };
    });
    ok('toolbar', JSON.stringify(tb), tb.n === 10 && tb.bad.length === 0 && tb.ids.includes('hab') && tb.ids.includes('pad') && tb.ids.includes('done'));
    // place the habitat through the toolbar + context button, then the pad the same way
    const plan = [['hab', 0, 6, 2, 2], ['pad', 4, 6, 3, 3]]; // off the lot-centre beam, door facing south
    for (const [t, i, j, w, d] of plan) {
      await ourTap('#baseT-' + t);
      ok('tool-' + t, await wait(t => window.SSX.base.building?.type === t && window.SSX.base.building.tool === 'place', 4000, t));
      const [lx, lz] = cellC(i, j, w, d);
      await aimAt(lx, lz);
      ok('ghost-' + t, await wait(t => { const g = window.SSX.base.debug.ghost; return !!(g && g.ok && g.visible && g.tint === 'ok' && g.type === t); }, 8000, t));
      const before = await G(id => window.SSX.base.state(id).pieces.length, PID);
      const cr0 = await G(() => window.__app.surface.game.progress.credits);
      await act();
      ok('placed-' + t, await wait(a => { const s = window.SSX.base.state(a.id); return s.pieces.length === a.b + 1 && s.pieces.some(p => p.type === a.t); }, 6000, { id: PID, b: before, t }));
      const cost = t === 'hab' ? 1400 : 700;
      ok('paid-' + t, (await G(() => window.__app.surface.game.progress.credits)) === cr0 - cost);
    }
    const cap = await G(id => window.SSX.base.place(id, 'hab', 0, 0, 0), PID);
    ok('secondHab', cap && cap.why, !cap.ok && String(cap.why || '').startsWith('Max'));
    await ourTap('#baseDone');
    ok('buildOff', await wait(() => !window.SSX.base.building, 4000));
    // noon, so the bunk reads; stand just outside the door looking at it
    await G(() => { const t = window.SSX?.time; if (t?.set) { t.set(12); t.freeze?.(true); } });
    const door = await G(id => {
      const B = window.SSX.base, w = B.plots().find(p => p.id === id).world, h = B.state(id).pieces.find(p => p.type === 'hab');
      const cx = (h.i + 1) * 2 - 10, cz = (h.j + 1) * 2 - 10; // 2x2 centre
      const face = [[0, 1], [1, 0], [0, -1], [-1, 0]][h.r & 3]; // door faces +z at r = 0
      return { x: w.x + cx + face[0] * 2.5, z: w.z + cz + face[1] * 2.5, yaw: Math.atan2(face[0], face[1]) };
    }, PID);
    await move(door.x, door.z, door.yaw);
    try { await G(() => { window.__app.surface.setView('third'); window.__app.surface.zoom(0.72); }); } catch (e) { /* default chase cam */ }
    await sleep(1400);
    ok('enterBtn', await wait(() => window.SSX.base.action === '🚪 Enter', 8000));
    const btn = await G(() => { const b = document.getElementById('baseBtn'), r = b.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const centre = r.left < W * 0.75 && r.right > W * 0.25 && r.top < H * 0.75 && r.bottom > H * 0.25;
      const bg = getComputedStyle(b).backgroundColor;
      return { w: r.width, h: r.height, text: b.textContent, centre, shown: getComputedStyle(b).display !== 'none', bg }; });
    ok('enterTarget', btn, btn.shown && btn.w >= 44 && btn.h >= 44 && !btn.centre && /Enter/.test(btn.text) && /0,\s*0,\s*0/.test(btn.bg));
    await page.screenshot({ path: `${out}${tag}.png`, timeout: 90000 });
    // v7.5.93: the door enters the room. Rest is the bunk inside, same 3-minute cooldown.
    await act();
    ok('insideHab', await wait(() => window.__app.surface.info?.inside?.kind === 'hab', 8000));
    await G(() => { const s = window.SSX.base.habSpots.bunk; window.__app.surface.debugInside(s.x, s.z, Math.PI); });
    ok('restBtn', await wait(() => /Rest/.test(document.getElementById('driveBtn').textContent || ''), 8000));
    const rest = async () => { if (desk) await page.keyboard.press('KeyE'); else await ourTap('#driveBtn'); };
    await rest(); await sleep(400);
    ok('restFull', await G(id => { const g = window.__app.surface.game.info, s = window.SSX.base.state(id); return { hp: g.hp, habRest: s.habRest || 0 }; }, PID), (await G(id => { const g = window.__app.surface.game.info, s = window.SSX.base.state(id); return g.hp >= g.hpMax && !(s.habRest > 0); }, PID)));
    await G(() => { const i = window.__app.surface.game.info; window.__app.surface.game.debug.hurt(Math.max(1, Math.min(i.hp + i.shield - 8, i.shield + 40))); }); await sleep(200);
    const wounded = await G(() => window.__app.surface.game.info.hp);
    ok('wounded', wounded, wounded > 0 && wounded < 80);
    await rest();
    ok('restored', await wait(() => window.__app.surface.game.info.hp >= window.__app.surface.game.info.hpMax && window.__app.surface.game.info.shield >= window.__app.surface.game.info.shieldMax, 4000));
    ok('cooldownSaved', await G(id => window.SSX.base.state(id).habRest > 0, PID));
    await G(() => { const i = window.__app.surface.game.info; window.__app.surface.game.debug.hurt(Math.max(1, Math.min(i.hp + i.shield - 8, i.shield + 40))); }); await sleep(200);
    const again = await G(() => window.__app.surface.game.info.hp);
    await rest(); await sleep(300);
    ok('cooldownHolds', await G(() => window.__app.surface.game.info.hp), (await G(() => window.__app.surface.game.info.hp)) === again && again < 80);
    await G(() => window.__app.surface.leaveBuilding());
    ok('leftHab', await wait(() => !window.__app.surface.info.inside, 5000));
    ok('reloadKeeps', await G(id => { window.SSX.base.reload(); const s = window.SSX.base.state(id); return s.habRest > 0 && s.pieces.some(p => p.type === 'hab') && s.pieces.some(p => p.type === 'pad'); }, PID));
    // call the rover onto the pad from a long way off
    const far = await G(() => { const s = window.__app.surface, i = s.info; s.debugMove(i.roverX + 2, i.roverZ, 0); if (!s.info.driving) s.interact(); return s.info.driving; });
    ok('inRover', far);
    await G(c => { const s = window.__app.surface; s.debugMove(c.x + 80, c.z + 80, 0); if (s.info.driving) s.interact(); }, c);
    const padAt = await G(id => { const B = window.SSX.base, w = B.plots().find(p => p.id === id).world, p = B.state(id).pieces.find(q => q.type === 'pad');
      return { x: w.x + (p.i + 1.5) * 2 - 10, z: w.z + (p.j + 1.5) * 2 - 10 }; }, PID);
    await move(padAt.x, padAt.z + 2.2, 0);
    // v7.5.94: the pad button calls the ship until the ship is parked. The rover still sets down from Call rover.
    ok('callBtn2', await wait(() => window.SSX.base.action === '🚀 Call ship', 8000));
    const away = await G(p => Math.hypot(window.__app.surface.info.roverX - p.x, window.__app.surface.info.roverZ - p.z), padAt);
    ok('roverAway', away, away > 40);
    await G(id => window.SSX.base.callRover(id), PID); await sleep(500);
    const parked = await G(p => { const i = window.__app.surface.info; return { d: Math.hypot(i.roverX - p.x, i.roverZ - (p.z - 0.6)), fuel: i.thrust.fuel }; }, padAt);
    ok('roverOnPad', parked, parked.d < 3 && parked.fuel === 100);
  } catch (e) { errors.push('TEST ' + e.message); }
  ok('noErrors', errors.join(' | ') || 'none', errors.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag);
  await browser.close();
  process.exit(bad.length || errors.length ? 1 : 0);
})();
