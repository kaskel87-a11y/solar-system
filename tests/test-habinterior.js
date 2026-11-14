// v7.5.93 walk-in habitat: arrow to the door, Enter, bunk Rest (3 min), locker stash, Leave.
// Touch runs every tap while a second finger holds the joystick (Chromium: CDP multi-touch).
// WebKit on this software GL stack segfaults if a mouse, touch, or pointer event is delivered
// while the canvas is up, so WebKit drives the same button handlers through SSX.base.press.
// BASE=http://127.0.0.1:8793/ DEV=393x852 BR=webkit node tests/test-habinterior.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8793/';
const BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const PFX = process.env.PFX || 'hab';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dpr = Number(process.env.DPR || (BR === 'webkit' ? 1 : 3));
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: dpr } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
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
    await sleep(220); held++; if (j && Math.abs(await G(() => window.__app.joy.y)) > 0.1) R.stickHeld = (R.stickHeld || 0) + 1;
  };
  const toMars = async () => { await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land(); await G(() => window.__app.surface.game.setAliens?.(false)); };
  const PID = 'aj-north';
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content), (await G(() => document.querySelector('meta[name="app-version"]').content)) === 'v7.5.113');
    await toMars();
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) {} const r = document.getElementById('radio'); if (r) r.style.display = 'none'; window.__app.surface.game.debug.credits(20000); });
    ok('api', await wait(() => window.SSX?.base?.ready && window.SSX.base.habSpots?.bunk && typeof window.SSX.base.goInside === 'function', 15000));
    ok('bought', (await G(id => window.SSX.base.buy(id), PID))?.ok);
    const placed = await G(id => window.SSX.base.place(id, 'hab', 0, 6, 0), PID);
    ok('placed', placed, placed && placed.ok);
    const far = await G(id => { const w = window.SSX.base.plots().find(p => p.id === id).world; window.__app.surface.debugMove(w.x + 80, w.z + 70, 0); const d = window.SSX.base.habDoor(id); const i = window.__app.surface.info; return Math.round(Math.hypot(d.x - i.x, d.z - i.z)); }, PID);
    ok('spawnAway', far, far > 40);
    await holdStick();
    await G(() => window.__app.toggleMenu(true)); await sleep(250);
    await tap('#baseMenu');
    ok('steps', null, await wait(() => { const p = document.getElementById('basePanel'); return p?.classList.contains('on') && /1\. Tap Go inside/.test(p.innerText) && /2\. At the door, tap Enter/.test(p.innerText) && /3\. Inside/.test(p.innerText); }, 5000));
    const go = await G(() => { const e = document.querySelector('#basePanel button[data-act="hab"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { h: r.height, w: r.width, t: e.textContent }; });
    ok('goInsideTarget', JSON.stringify(go), go && go.h >= 44 && go.w >= 44 && /Go inside/.test(go.t));
    await tap('#basePanel button[data-act="hab"]');
    ok('arrow', null, await wait(() => { const e = document.getElementById('ssxGuide'); return !!(e && e.classList.contains('on') && /Habitat/.test(e.textContent) && /\d/.test(e.textContent)); }, 8000));
    const guide = await G(() => { const e = document.getElementById('ssxGuide'), r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const W = innerWidth, H = innerHeight;
      return { t: e.textContent, mid: cx > W * 0.25 && cx < W * 0.75 && cy > H * 0.25 && cy < H * 0.75, h: Math.round(r.height) }; });
    ok('arrowOffCentre', JSON.stringify(guide), guide && !guide.mid && guide.h >= 44);
    ok('arrowNav', null, await G(id => { const g = window.__app.surface.game.mapGate?.(), d = window.SSX.base.habDoor(id); return !!g && Math.hypot(g.x - d.x, g.z - d.z) < 2; }, PID));
    await releaseStick();
    await G(id => { const d = window.SSX.base.habDoor(id); window.__app.surface.debugMove(d.x, d.z, d.yaw); }, PID);
    ok('arrowHides', await wait(() => !document.getElementById('ssxGuide')?.classList.contains('on'), 4000));
    ok('enterBtn', await wait(() => window.SSX.base.action === '🚪 Enter', 8000));
    const enter = await G(() => { const b = document.getElementById('baseBtn'), r = b.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const mid = r.left < W * 0.75 && r.right > W * 0.25 && r.top < H * 0.75 && r.bottom > H * 0.25;
      return { w: r.width, h: r.height, t: b.textContent, mid, shown: getComputedStyle(b).display !== 'none' }; });
    ok('enterTarget', JSON.stringify(enter), enter.shown && enter.w >= 44 && enter.h >= 44 && !enter.mid && /Enter/.test(enter.t));
    await holdStick();
    await tap('#baseBtn');
    ok('inside', await wait(() => window.__app.surface.info?.inside?.kind === 'hab', 8000));
    stickWant = false; await releaseStick();
    await G(() => {
      const t = document.getElementById('toast'); if (t) { t.textContent = ''; t.classList.remove('on'); t.style.display = 'none'; }
      const st = document.createElement('style'); st.textContent = '#radio,#questTrack,#toast,#obLine{display:none!important}'; document.head.appendChild(st);
      window.__app.surface.setView('first');
      window.__app.surface.debugInside(0.6, 1.75, 0.55, -0.22);
    });
    await sleep(700);
    if (DEV === '393x852') await shot('inside');
    const spotAt = async (id) => {
      await G(id => { const s = window.SSX.base.habSpots[id] || window.SSX.base.habSpots.leave; window.__app.surface.debugInside(s.x, s.z, 0); }, id);
      return wait(id => window.__app.surface.info?.spot?.id === id, 4000, id);
    };
    ok('atBunk', await spotAt('bunk'));
    ok('restLabel', await wait(() => /Rest/.test(document.getElementById('driveBtn')?.textContent || ''), 4000));
    const hp0 = await G(() => window.__app.surface.game.info.hp);
    await tap('#driveBtn'); await sleep(300);
    ok('restFullNoCooldown', await G(([id, hp0]) => { const g = window.__app.surface.game.info, s = window.SSX.base.state(id); return g.hp >= g.hpMax && !(s.habRest > 0) && g.hp === hp0; }, [PID, hp0]));
    await G(() => { const i = window.__app.surface.game.info; window.__app.surface.game.debug.hurt(Math.max(1, Math.min(i.hp + i.shield - 12, i.shield + 30))); });
    const wounded = await G(() => window.__app.surface.game.info.hp);
    ok('wounded', wounded, wounded > 0 && wounded < hp0);
    await tap('#driveBtn');
    ok('healed', await wait(() => window.__app.surface.game.info.hp >= window.__app.surface.game.info.hpMax, 4000));
    ok('cooldown', await G(id => window.SSX.base.state(id).habRest > Date.now() - 10000, PID));
    await G(() => { const i = window.__app.surface.game.info; window.__app.surface.game.debug.hurt(Math.max(1, Math.min(i.hp + i.shield - 8, i.shield + 40))); });
    const heldHp = await G(() => window.__app.surface.game.info.hp);
    await tap('#driveBtn'); await sleep(250);
    ok('cooldownHolds', await G(() => window.__app.surface.game.info.hp) === heldHp && heldHp > 0 && heldHp < hp0);
    ok('atLocker', await spotAt('locker'));
    await tap('#driveBtn');
    ok('lockerOpen', await wait(() => document.getElementById('basePanel')?.classList.contains('on') && /Stash/.test(document.getElementById('basePanel').innerText), 4000));
    const before = await G(() => window.__app.surface.game.progress.credits);
    await tap('#basePanel button[data-k="credits"][data-op="in"]');
    ok('stashed', await wait(n => window.SSX.base.state('aj-north').stash.credits === 100 && window.__app.surface.game.progress.credits === n - 100, 4000, before));
    await tap('#baseStashClose');
    ok('lockerShut', await wait(() => !document.getElementById('basePanel')?.classList.contains('on'), 3000));
    ok('atTerminal', await spotAt('terminal'));
    await tap('#driveBtn');
    ok('terminal', await wait(() => /Locker: 100 cr/.test(document.getElementById('toast')?.textContent || ''), 4000));
    ok('atFrankie', await spotAt('frankie'));
    await tap('#driveBtn');
    ok('frankie', await wait(() => /Frankie/.test(document.getElementById('toast')?.textContent || ''), 4000));
    ok('atLeave', await spotAt('leave'));
    await tap('#driveBtn');
    ok('outside', await wait(() => !window.__app.surface.info?.inside, 5000));
    const back = await G(id => { const d = window.SSX.base.habDoor(id), i = window.__app.surface.info; return Math.round(Math.hypot(d.x - i.x, d.z - i.z)); }, PID);
    ok('backAtDoor', back, back < 3);
    R.held = held; if (touch && BR !== 'webkit') ok('tapsWithStickHeld', `${R.stickHeld}/${held}`, (R.stickHeld || 0) >= 3);
    if (BR === 'webkit') ok('webkitHandlers', true, true);
  } catch (e) { bad.push('EXC ' + (e.message || e).split('\n')[0]); }
  ok('noErrors', errors.slice(0, 6).join(' | ') || null, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
