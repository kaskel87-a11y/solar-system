// v7.5.94: call the Ashfall down onto a Mars landing pad.
// Arrow when you are not on the pad, 🚀 Call ship on the pad, descent (engines lit), then the rover
// button comes back. 3 stars, a job, and space refuse. A clean death offers Wake at base.
// Touch runs the call while a second finger holds the joystick (Chromium CDP). WebKit uses SSX.base.press.
// BASE=http://127.0.0.1:8794/ DEV=393x852 BR=webkit node tests/test-callship.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8794/';
const BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const PFX = process.env.PFX || 'callship';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dpr = Number(process.env.DPR || (BR === 'webkit' ? 1 : 2));
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView?.({ block: 'nearest', inline: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }, sel);
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(600); };
  let cdp = null; const T = async (type, pts) => (cdp = cdp || await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  let held = 0, stick = null, tid = 2, stickWant = true;
  const holdStick = async () => {
    if (stick || !stickWant || !touch || BR === 'webkit') return;
    const j = await center('#joy'); if (!j) return; const free = await G(j => !!document.elementFromPoint(j.x, j.y)?.closest('#joy'), j); if (!free) return;
    cdp = cdp || await ctx.newCDPSession(page); await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(40); await T('touchMove', [{ x: j.x, y: j.y - 30, id: 1 }]); await sleep(40);
    stick = { x: j.x, y: j.y - 30 };
  };
  const releaseStick = async () => {
    if (!stick || BR === 'webkit') { stick = null; return; } const j = stick; stick = null;
    await T('touchEnd', [{ x: j.x, y: j.y, id: 1 }]); await sleep(40);
  };
  const tap = async sel => {
    if (BR === 'webkit') { const hit = await G(s => window.SSX.base.press(s), sel); if (!hit) throw new Error('no ' + sel); await sleep(220); return; }
    if (!touch) { const c = await center(sel); if (!c) throw new Error('no ' + sel); await page.mouse.click(c.x, c.y); await sleep(220); return; }
    await holdStick(); let c = await center(sel); if (!c) throw new Error('no ' + sel);
    const id = tid++, j = stick;
    const pts = j ? [{ x: j.x, y: j.y, id: 1 }] : []; await T('touchStart', [...pts, { x: c.x, y: c.y, id }]); await sleep(50); await T('touchEnd', [{ x: c.x, y: c.y, id }]);
    await sleep(220); held++; if (j && Math.abs(await G(() => window.__app.joy?.y || 0)) > 0.1) R.stickHeld = (R.stickHeld || 0) + 1;
  };
  const PID = 'aj-north';
  const pose = () => G(() => { const p = window.__app.surface.shipPose(); const home = Math.hypot(p.x - p.homeX, p.z - p.homeZ); return { x: p.x, z: p.z, alt: +p.alt.toFixed(1), lit: p.lit, home: +home.toFixed(1) }; });
  try {
    await page.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 });
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await page.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 });
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content), (await G(() => document.querySelector('meta[name="app-version"]').content)) === 'v7.5.109');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await land();
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) {} try { window.SSX.control?.debug?.setTimes({ first: 9999, after: 9999 }); } catch (e) {} const r = document.getElementById('radio'); if (r) r.style.display = 'none'; window.__app.surface.game.setAliens?.(false); window.__app.surface.game.debug.credits(20000); const t = window.SSX?.time; if (t?.set) { t.set(12); t.freeze?.(true); } });
    ok('api', await wait(() => window.SSX?.base?.ready && typeof window.SSX.base.callShip === 'function' && !!window.__app.surface.shipPose, 15000));
    ok('bought', (await G(id => window.SSX.base.buy(id), PID))?.ok);
    ok('hab', (await G(id => window.SSX.base.place(id, 'hab', 0, 6, 0), PID))?.ok);
    ok('pad', (await G(id => window.SSX.base.place(id, 'pad', 4, 6, 0), PID))?.ok);
    const home = await pose();
    ok('shipAtHome', home, home && home.home < 1 && !home.lit);
    const far = await G(id => { const w = window.SSX.base.plots().find(p => p.id === id).world; window.__app.surface.debugMove(w.x + 80, w.z + 70, 0); const i = window.__app.surface.info; return Math.round(Math.hypot(w.x - i.x, w.z - i.z)); }, PID);
    ok('spawnAway', far, far > 40);
    await holdStick();
    await G(() => window.__app.toggleMenu(true)); await sleep(200);
    await tap('#baseMenu');
    ok('steps', null, await wait(() => { const p = document.getElementById('basePanel'); return p?.classList.contains('on') && /1\. Tap Call ship/.test(p.innerText) && /2\. Stand on the pad/.test(p.innerText) && /3\. Board it/.test(p.innerText); }, 5000));
    const go = await G(() => { const e = document.querySelector('#basePanel button[data-act="ship"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { h: r.height, w: r.width, t: e.textContent }; });
    ok('menuTarget', JSON.stringify(go), go && go.h >= 44 && go.w >= 44 && /Call ship/.test(go.t));
    await tap('#basePanel button[data-act="ship"]');
    ok('arrow', null, await wait(() => { const e = document.getElementById('ssxGuide'); return !!(e && e.classList.contains('on') && /Landing pad/.test(e.textContent) && /\d/.test(e.textContent)); }, 8000));
    const guide = await G(() => { const e = document.getElementById('ssxGuide'), r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const W = innerWidth, H = innerHeight;
      return { t: e.textContent, mid: cx > W * 0.25 && cx < W * 0.75 && cy > H * 0.25 && cy < H * 0.75, h: Math.round(r.height) }; });
    ok('arrowOffCentre', JSON.stringify(guide), guide && !guide.mid && guide.h >= 44);
    ok('arrowNav', null, await G(id => { const g = window.__app.surface.game.mapGate?.(); const p = window.SSX.base.state(id).pieces.find(q => q.type === 'pad'); const w = window.SSX.base.plots().find(q => q.id === id).world; const x = w.x + (p.i + 1.5) * 2 - 10, z = w.z + (p.j + 1.5) * 2 - 10; return !!g && Math.hypot(g.x - x, g.z - z) < 2; }, PID));
    const blocked = await G(id => {
      const s = window.__app.surface, home = s.shipPose();
      s.world.setWanted(3, 'test');
      const heat = window.SSX.base.callShip(id);
      s.world.setWanted(0, 'test');
      const q0 = window.__app.game.accept('mars-signal');
      const job = window.SSX.base.callShip(id);
      window.__app.game.abandon();
      let heist = null;
      const h = window.SSX.heist;
      if (h) { Object.defineProperty(h, 'active', { configurable: true, get() { return { id: 'test-job' }; } }); heist = window.SSX.base.callShip(id); delete h.active; }
      const pose = s.shipPose();
      return { heat: heat && heat.why, job: job && job.why, jobOk: !!q0, heist: heist && heist.why, moved: Math.hypot(pose.x - home.x, pose.z - home.z) };
    }, PID);
    ok('refuses', JSON.stringify(blocked), blocked && blocked.heat === 'heat' && blocked.job === 'job' && blocked.jobOk && blocked.moved < 1 && (!blocked.heist || blocked.heist === 'job'));
    await G(id => { const p = window.SSX.base.state(id).pieces.find(q => q.type === 'pad'); const w = window.SSX.base.plots().find(q => q.id === id).world; window.__app.surface.debugMove(w.x + (p.i + 1.5) * 2 - 10, w.z + (p.j + 1.5) * 2 - 10, 0); window.__app.surface.world.setWanted(2, 'test'); }, PID);
    ok('callBtn', await wait(() => window.SSX.base.action === '🚀 Call ship', 8000));
    const btn = await G(() => { const b = document.getElementById('baseBtn'), r = b.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const mid = r.left < W * 0.75 && r.right > W * 0.25 && r.top < H * 0.75 && r.bottom > H * 0.25;
      return { w: r.width, h: r.height, t: b.textContent, mid, shown: getComputedStyle(b).display !== 'none' }; });
    ok('callTarget', JSON.stringify(btn), btn.shown && btn.w >= 44 && btn.h >= 44 && !btn.mid && /Call ship/.test(btn.t));
    await G(() => { const t = document.getElementById('toast'); if (t) { t.classList.remove('on'); t.style.display = 'none'; } });
    await tap('#baseBtn');
    if (!(await G(() => !!window.SSX.base.ship.landing))) await G(() => window.SSX.base.press('#baseBtn'));
    await G(() => { const s = window.__app.surface; s.setView('third'); s.zoom(1.7); s.zoom(1.7); s.zoom(1.5); s.look(0, -0.45, 1); s.look(0, -0.45, 1); });
    ok('descending', await wait(() => { const p = window.__app.surface.shipPose(); return !!(p && p.lit && p.alt > 6 && p.alt < 70); }, 12000));
    if (DEV === '393x852' && BR === 'chromium') {
      await wait(() => { const p = window.__app.surface.shipPose(); return !!(p && p.lit && p.alt > 14 && p.alt < 36); }, 8000);
      await G(() => {
        const st = document.createElement('style'); st.textContent = '#radio,#toast,#questTrack,#obLine,#downMsg{display:none!important}'; document.head.appendChild(st);
        const s = window.__app.surface, p = s.shipPose();
        s.world.setWanted(0, 'clear');
        const dx = 28, dz = 6;
        s.debugMove(p.x + dx, p.z + dz, Math.atan2(dx, dz));
        s.setView('third');
        s.zoom(2.2); s.zoom(1.8);
        for (let i = 0; i < 4; i++) s.look(0, -0.4, 1);
      });
      await sleep(280);
      await shot('landing');
    }
    ok('parked', await wait(id => { const p = window.__app.surface.shipPose(); const pad = window.SSX.base.state(id).pieces.find(q => q.type === 'pad'); const w = window.SSX.base.plots().find(q => q.id === id).world; const x = w.x + (pad.i + 1.5) * 2 - 10, z = w.z + (pad.j + 1.5) * 2 - 10; return p && !p.lit && p.alt < 2.5 && Math.hypot(p.x - x, p.z - z) < 2 && window.SSX.base.ship.plotId === id; }, 30000, PID));
    const moved = await pose();
    ok('relocated', moved, moved && moved.home > 30);
    await G(() => window.__app.surface.world.setWanted(0, 'clear'));
    ok('saved', await G(id => { window.SSX.base.reload(); return window.SSX.base.ship.plotId === id; }, PID));
    await G(id => { const p = window.SSX.base.state(id).pieces.find(q => q.type === 'pad'); const w = window.SSX.base.plots().find(q => q.id === id).world; window.__app.surface.debugMove(w.x + (p.i + 1.5) * 2 - 10 + 2, w.z + (p.j + 1.5) * 2 - 10, 0); }, PID);
    ok('roverBtn', await wait(() => window.SSX.base.action === '🛬 Call rover', 8000));
    const rv = await G(id => window.SSX.base.callRover(id), PID);
    const parkedRv = await G(id => { const i = window.__app.surface.info; const p = window.SSX.base.state(id).pieces.find(q => q.type === 'pad'); const w = window.SSX.base.plots().find(q => q.id === id).world; const x = w.x + (p.i + 1.5) * 2 - 10, z = w.z + (p.j + 1.5) * 2 - 10; return { d: Math.hypot(i.roverX - x, i.roverZ - z), fuel: i.thrust.fuel, ok: true }; }, PID);
    ok('roverBeside', JSON.stringify({ rv, parkedRv }), rv && rv.ok && parkedRv.d > 6 && parkedRv.d < 16 && parkedRv.fuel === 100);
    const board = await G(() => { const s = window.__app.surface, i = s.info, p = s.shipPose(); s.takeOff(); return { near: Math.hypot(i.x - p.x, i.z - p.z) < 20, threw: false }; });
    ok('canBoard', board, board && board.near && board.threw === false);
    await G(() => window.__app.surface.game.debug.hurt(9999));
    ok('down', await wait(() => window.__app.surface.game.isDown?.() || window.__app.game?.isDown?.(), 10000));
    ok('respawned', await wait(() => !window.__app.surface.game.isDown?.() && !window.__app.game?.isDown?.(), 20000));
    ok('wakeOffer', await wait(id => document.getElementById('baseWake')?.classList.contains('on') && window.SSX.base.wakeOffer === id, 4000, PID));
    const wakeBox = await G(() => { const b = document.getElementById('baseWake'); if (!b) return null; const r = b.getBoundingClientRect(), W = innerWidth, H = innerHeight; const mid = r.left < W * 0.75 && r.right > W * 0.25 && r.top < H * 0.75 && r.bottom > H * 0.25; return { w: r.width, h: r.height, mid, t: b.textContent }; });
    ok('wakeTarget', JSON.stringify(wakeBox), wakeBox && wakeBox.w >= 44 && wakeBox.h >= 44 && !wakeBox.mid && /Wake at base/.test(wakeBox.t));
    await G(() => window.SSX.base.press('#baseWake'));
    ok('wokeAtHab', await wait(id => { const d = window.SSX.base.habDoor(id), i = window.__app.surface.info; return !!d && Math.hypot(d.x - i.x, d.z - i.z) < 4; }, 4000, PID));
    await G(() => window.__app.surface.game.bust?.());
    ok('busted', await wait(() => window.__app.surface.game.isDown?.(), 10000));
    ok('bustRespawn', await wait(() => !window.__app.surface.game.isDown?.(), 20000));
    await sleep(200);
    ok('noWakeWhenBusted', await G(() => !document.getElementById('baseWake')?.classList.contains('on') && !window.SSX.base.wakeOffer));
    await G(() => window.__app.takeOff());
    ok('leftSurface', await wait(() => window.__app.state.onSurface === false && !window.__app.state.transitioning, 10000));
    const space = await G(id => window.SSX.base.callShip(id), PID);
    ok('spaceRefuses', space && space.why, space && space.ok === false && space.why === 'space');
    R.held = held; if (touch && BR !== 'webkit') ok('tapsWithStickHeld', `${R.stickHeld || 0}/${held}`, (R.stickHeld || 0) >= 1);
    if (BR === 'webkit') ok('webkitHandlers', true, true);
  } catch (e) { bad.push('EXC ' + (e.message || e).split('\n')[0]); }
  ok('noErrors', errors.slice(0, 8).join(' | ') || null, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag);
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
