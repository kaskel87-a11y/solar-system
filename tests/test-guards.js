// v7.5.4 heist guards e2e on the ?heisttest=1 villa: guards patrol -> a silent melee takedown -> camera line of sight
// (the villa wall blocks a cone) -> follow camera stays inside the walls -> a camera trips -> guards investigate the
// last known spot -> one radios backup (+1 star, heist:alarm:response by 'guards') -> lockdown (posts, wider escape ring,
// loot timer) -> escape -> cleanup releases the NPC reservation. Then heist interiors (bank / mansion): the follow camera
// never sits inside a wall. Phones: every tap of ours is a second finger while a thumb holds the joystick.
// BASE=http://127.0.0.1:8863/ BR=webkit DEV="iPhone SE (3rd gen)" SHOTS_DIR=/workspace/pw-ben-guards/shots node test-guards.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8863/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.OUT || process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')).replace(/\/?$/, '/'), desk = DEV === 'desktop';
const VP = process.env.VP;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  let opts = desk ? { viewport: { width: 1440, height: 900 } } : { ...pw.devices[DEV] };
  if (VP) { const [w, h] = VP.split('x').map(Number); opts = { ...opts, viewport: { width: w, height: h }, screen: { width: w, height: h } }; }
  delete opts.defaultBrowserType;
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const vp = page.viewportSize(), tag = `guards-${vp.width}x${vp.height}-${BR}`;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const press = async sel => { if (desk) await page.click(sel); else await page.tap(sel); };
  const stickTap = sel => G(async sel => {
    const j = document.getElementById('joy'), b = document.querySelector(sel); if (!b) return 'missing ' + sel;
    const jr = j.getBoundingClientRect(), br = b.getBoundingClientRect(), sl = ms => new Promise(r => setTimeout(r, ms));
    const ev = (el, t, id, r) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 50, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    ev(j, 'pointerdown', 50, jr); await sl(60); ev(b, 'pointerdown', 51, br); await sl(60); ev(b, 'pointerup', 51, br); await sl(60); ev(j, 'pointerup', 50, jr); return 'ok';
  }, sel);
  const ourTap = async sel => { if (desk) await page.click(sel); else R['stickTap ' + sel] = await stickTap(sel); };
  const shot = async name => { for (let i = 0; i < 2; i++) { try { const p = `${out}${tag}-${name}.png`; await page.screenshot({ path: p, timeout: 90000 }); R['shot-' + name] = p; return true; } catch (e) { R['shotRetry-' + name] = i + 1; } } return false; };
  const move = (x, z, yaw = 0) => G(([x, z, yaw]) => window.__app.surface.debugMove(x, z, yaw), [x, z, yaw]);
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => ++k >= n ? r() : requestAnimationFrame(f); f(); }), n);
  const budget = () => G(() => { const W = window.__app.surface.world, b = W.npcBudget?.(); return b ? { used: b.used, cap: b.cap, res: b.reserved } : null; });
  try {
    await page.goto(base + '?heisttest=1&heisttime=' + (process.env.SAFE_T || 150) + '&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); window.__hlog = []; for (const e of ['start', 'stage', 'alarm', 'camera:alert', 'safe:result', 'escape', 'done', 'fail', 'alarm:response', 'guards', 'guards:alert', 'guards:backup', 'guards:lockdown', 'lockdown', 'guard:down', 'guard:hit', 'guard:spotted', 'guard:fire']) window.addEventListener('heist:' + e, ev => window.__hlog.push([e, ev.detail])); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    const has = e => G(e => window.__hlog.some(x => x[0] === e), e), first = e => G(e => (window.__hlog.find(x => x[0] === e) || [])[1] || null, e);
    // ---- start from ☰ -> 🕵️ Heists
    await press('#menuBtn'); await wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000);
    await page.locator('#heistMenu').scrollIntoViewIfNeeded(); await press('#heistMenu'); await wait(() => document.getElementById('heistPanel')?.classList.contains('on'), 4000); await sleep(300);
    await ourTap('#heistPanel button[data-id="heist-sample"]');
    ok('started', await wait(() => window.SSX.heist.active?.w && window.SSX.heist.guards.list().length > 0, 10000));
    const w = await G(() => window.SSX.heist.active.w), S = w.site;
    const gi = await first('guards'); R.guardsSpawned = gi;
    const b0 = await budget(); R.budgetStart = b0;
    ok('guardCount', `${gi?.n}/${gi?.want}`, gi && gi.n >= 1 && (desk ? gi.n === 3 : gi.n <= 4));
    ok('npcCapStart', `${b0?.used}/${b0?.cap}`, !b0 || desk || b0.used <= b0.cap && b0.cap <= 12);
    ok('reserved', await G(() => window.SSX.heist.guards.reserved), (await G(() => window.SSX.heist.guards.reserved)) === gi.n && (!b0 || b0.res['heist-guards'] === gi.n));
    // ---- patrol: guards walk their waypoints
    await G(() => window.SSX.heist.guards.setOptions({ passive: true, fire: false }));
    const p0 = await G(() => window.SSX.heist.guards.list()); // headless SwiftShader can run ~2 fps (dt clamps), so poll rather than sleep
    await wait(p0 => window.SSX.heist.guards.list().some((g, i) => Math.hypot(g.x - p0[i].x, g.z - p0[i].z) > 0.5), 15000, p0); const p1 = await G(() => window.SSX.heist.guards.list());
    ok('patrolMoves', p0.filter((g, i) => Math.hypot(g.x - p1[i].x, g.z - p1[i].z) > 0.5).length, p0.some((g, i) => Math.hypot(g.x - p1[i].x, g.z - p1[i].z) > 0.5) && p1.every(g => g.state === 'patrol'));
    // ---- camera line of sight: a test camera inside the yard looking north at the back wall. You behind the wall: blind.
    await G(() => window.SSX.heist.guards.setOptions({ passive: true }));
    await G(S => window.SSX.heist.addCamera({ id: 'los-test', x: S.x, z: S.z - 2.5, yaw: 0, sweep: 0, range: 12, fov: 60, level: 1 }), S);
    await move(S.x, S.z - 9, 0); await sleep(1800);
    const behind = await G(() => window.SSX.heist.cameras().find(c => c.id === 'los-test'));
    const losFn = await G(S => window.SSX.heist.los({ x: S.x, y: window.__app.surface.world.groundAt(S.x, S.z) + 3, z: S.z - 2.5 }, { x: S.x, y: window.__app.surface.world.groundAt(S.x, S.z - 9) + 1.2, z: S.z - 9 }), S);
    ok('losWallBlocks', `meter ${behind?.meter} los ${losFn}`, behind && behind.meter === 0 && losFn === false);
    await move(S.x + 1, S.z - 5, 0);
    const sawInside = await wait(() => (window.SSX.heist.cameras().find(c => c.id === 'los-test')?.meter || 0) > 0.05, 6000);
    await G(() => window.SSX.heist.removeCamera('los-test'));
    ok('losOpenSees', sawInside);
    // ---- follow camera: stand by the back wall facing the door; the boom (behind you) must stay on the yard side
    await move(S.x, S.z - 4.6, Math.PI); await sleep(1500);
    const cam = await G(S => { const c = window.__app.surface.camera.position; return { x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2), inWall: window.SSX.heist.camBlocked(c.x, c.y, c.z), wallZ: S.z - 6 }; }, S);
    const gy = await G(S => window.__app.surface.world.groundAt(S.x, S.z - 6), S); cam.overWall = cam.y > gy + 2.85;
    ok('followCamInside', cam, !cam.inWall && (cam.z > cam.wallZ + 0.2 || cam.overWall));
    // ---- silent takedown: walk up behind the yard guard and melee before it turns
    const yard = (await G(() => window.SSX.heist.guards.list())).find(g => g.id === 'tv-yard');
    if (yard) {
      const td = await G(id => { const g = window.SSX.heist.guards.list().find(q => q.id === id), fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw), px = g.x - fx * 1.1, pz = g.z - fz * 1.1;
        window.__app.surface.debugMove(px, pz, g.yaw); return window.__app.surface.world.meleeWorld(px, pz, fx, fz, 1.6, 2, 0); }, 'tv-yard');
      ok('takedownHit', td);
      ok('takedownSilent', await wait(() => window.__hlog.some(e => e[0] === 'guard:down' && e[1].id === 'tv-yard' && e[1].silent), 3000));
      ok('takedownNoAlarm', await G(() => window.__app.surface.world.wanted === 0 && window.SSX.heist.guards.phase === 'calm'));
      ok('reserveDrops', await G(() => window.SSX.heist.guards.reserved), (await G(() => window.SSX.heist.guards.reserved)) === gi.n - 1);
    }
    // ---- break in + crack (guards passive so the legacy flow is deterministic; test-heist.js covers it in depth)
    await move(w.door.x, w.door.z + 0.8); await wait(() => window.SSX.heist.action === '🔓 Break in', 5000);
    if (desk) await page.keyboard.press('KeyG'); else await ourTap('#heistBtn');
    ok('inside', await wait(() => window.SSX.heist.active?.stage === 'crack', 8000));
    await move(w.safe.x, w.safe.z + 0.6); await wait(() => window.SSX.heist.action === '🔐 Crack safe', 5000);
    if (desk) await page.keyboard.press('KeyG'); else await ourTap('#heistBtn');
    ok('safeOpen', await wait(() => !!document.getElementById('hsSafe'), 4000)); await sleep(500);
    const dial = await G(() => { const r = document.getElementById('hsDial').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.42 }; });
    const pt = a => ({ x: dial.x + dial.R * Math.sin(a * Math.PI / 180), y: dial.y - dial.R * Math.cos(a * Math.PI / 180) });
    if (desk) {
      for (let k = 0; k < 8; k++) {
        const s = await G(() => window.SSX.heist.debug.safe()); if (!s || s.done) break;
        let a = s.angle; const tg = s.targets[s.idx]; let p = pt(a); await page.mouse.move(p.x, p.y); await page.mouse.down();
        let diff = ((tg - a) % 360 + 540) % 360 - 180;
        while (Math.abs(diff) > 1.5) { const st = Math.sign(diff) * Math.min(2.5, Math.abs(diff)); a += st; diff -= st; p = pt(a); await page.mouse.move(p.x, p.y); await frames(1); }
        await G(() => new Promise(r => { const t0 = performance.now(); const f = () => performance.now() - t0 > 950 ? r() : requestAnimationFrame(f); f(); })); await page.mouse.up(); await sleep(100);
      }
    } else {
      await G(async (dial) => {
        const root = document.getElementById('hsSafe'), sl = ms => new Promise(r => setTimeout(r, ms));
        const pt = a => ({ clientX: dial.x + dial.R * Math.sin(a * Math.PI / 180), clientY: dial.y - dial.R * Math.cos(a * Math.PI / 180) });
        const P = (type, a) => root.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, ...pt(a) }));
        for (let k = 0; k < 8; k++) {
          const s = window.SSX.heist.debug.safe(); if (!s || s.done) break;
          let a = s.angle; const tg = s.targets[s.idx]; P('pointerdown', a);
          let diff = ((tg - a) % 360 + 540) % 360 - 180;
          while (Math.abs(diff) > 1.5) { const st = Math.sign(diff) * Math.min(2.5, Math.abs(diff)); a += st; diff -= st; P('pointermove', a); await new Promise(r => requestAnimationFrame(r)); }
          await sl(950); P('pointerup', a); await sl(100);
        }
      }, dial);
    }
    ok('cracked', await wait(() => window.SSX.heist.active?.stage === 'escape', 30000));
    // ---- trip a camera (guards still passive so it's the camera, not a guard's own eyes): they investigate the last known spot
    const c0 = await G(() => window.SSX.heist.cameras().find(c => c.id === 'tv-cam0'));
    await move(c0.x - 3, c0.z - 3, Math.atan2(-3, -3));
    ok('cameraAlert', await wait(() => window.__hlog.some(e => e[0] === 'camera:alert'), 40000));
    const spot = await G(() => { const P = window.SSX.heist.debug.ctx().player; return { x: P.x, z: P.z }; });
    ok('investigate', await wait(() => window.SSX.heist.guards.phase === 'investigate' && window.SSX.heist.guards.list().some(g => g.state === 'investigate'), 5000));
    const al = await first('guards:alert'); R.lastKnown = al;
    ok('lastKnownIsSpot', al && Math.hypot(al.x - spot.x, al.z - spot.z) < 2.5);
    // step back toward the villa corner, facing the site, so the shot shows guards coming with their '?' icons
    await move(c0.x - 7, c0.z - 7, Math.atan2(-(S.x - (c0.x - 7)), -(S.z - (c0.z - 7)))); await sleep(900);
    ok('stillInvestigating', await G(() => window.SSX.heist.guards.list().some(g => g.state === 'investigate' || g.state === 'search' || g.state === 'engage')));
    await shot('investigating');
    await G(() => window.SSX.heist.guards.setOptions({ passive: false, fire: true })); // now they can see / shoot you
    // test medic: the city's security response (hostile private guards) can down a player who stands still at 2 fps;
    // keep health topped up so this run measures the guards' ladder, not hostile dice (guard:fire still proves they shoot)
    await G(() => { const H = window.__app.surface.game.debug?.H; if (H) window.__medic = setInterval(() => { const h = H(); if (h && h.hp < 100) h.hp = 100; }, 250); });
    R.guardsInvestigating = await G(() => window.SSX.heist.guards.list().map(g => `${g.id}:${g.state}`).join(' '));
    // ---- backup: a guard reaches the spot (or sees you) and radios it in
    const wBefore = await G(() => window.__app.surface.world.wanted);
    ok('backup', await wait(() => window.__hlog.some(e => e[0] === 'guards:backup'), 20000));
    ok('backupResponse', await wait(() => window.__hlog.some(e => e[0] === 'alarm:response' && e[1].by === 'guards'), 3000));
    const wAfter = await G(() => window.__app.surface.world.wanted); ok('backupWanted', `${wBefore}->${wAfter}`, wAfter >= Math.min(5, wBefore + 1) || wAfter >= 3);
    ok('guardFired', await wait(() => window.__hlog.some(e => e[0] === 'guard:fire'), 12000)); // engaged guards shoot back
    await G(() => window.SSX.heist.guards.setOptions({ fire: false }));
    await sleep(1200); const b1 = await budget(); R.budgetBackup = b1;
    ok('npcCapBackup', `${b1?.used}/${b1?.cap}`, !b1 || desk || b1.used <= b1.cap);
    // ---- lockdown
    ok('lockdown', await wait(() => window.SSX.heist.active?.lockdown, 8000));
    const lk = await G(() => ({ a: { lockdown: window.SSX.heist.active.lockdown, lockLeft: window.SSX.heist.active.lockLeft, escapeR: window.SSX.heist.active.escapeR }, chip: document.getElementById('heistChip').textContent, posts: window.SSX.heist.guards.list().filter(g => g.post).length }));
    R.lockdownInfo = lk; ok('lockdownChip', lk.chip.includes('🔒'));
    ok('lockdownEscapeWider', lk.a.escapeR, lk.a.escapeR >= 44);
    ok('lockdownPosts', lk.posts, lk.posts >= 1);
    await move(S.x + 2, S.z + 19, 0); await sleep(1600); // out front, facing the villa door: guards on their posts
    ok('guardsToPosts', await G(() => window.SSX.heist.guards.list().filter(g => g.state === 'post' || g.state === 'engage').length >= 1));
    const clear = await G(() => { const W = innerWidth, H = innerHeight, c = { l: W * 0.3, r: W * 0.7, t: H * 0.3, b: H * 0.7 };
      return ['heistBtn', 'heistChip'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width && !(r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b) ? id : null; }).filter(Boolean); });
    ok('centerClear', clear.join() || 'clear', clear.length === 0);
    const cr = await G(() => { const r = document.getElementById('heistChip').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: innerWidth }; });
    ok('chipOnScreen', cr, cr.l >= 0 && cr.r <= cr.w + 1); // the lockdown timer must not run off a phone
    await shot('lockdown');
    // ---- shots at a guard: hit through the world's hit path (auto-aim targets include them)
    const tg = await G(() => window.__app.surface.world.targets().some(t => t.kind === 'guard')); ok('aimTargets', tg);
    // ---- escape past the wider ring, lose the heat, cleanup
    await move(S.x + 45, S.z + 22); ok('escapeEvent', await wait(() => window.__hlog.some(e => e[0] === 'escape'), 20000));
    await G(() => window.__app.surface.world.setWanted(0, 'test: lost them'));
    await G(() => clearInterval(window.__medic));
    ok('done', await wait(() => window.__hlog.some(e => e[0] === 'done' && e[1].success), 6000));
    const b2 = await budget();
    ok('cleanup', await G(() => !window.SSX.heist.active && window.SSX.heist.guards.list().length === 0 && window.SSX.heist.guards.reserved === 0 && !window.__app.surface.scene?.getObjectByName?.('heistGuards')) && (!b2 || !b2.res['heist-guards']));
    // ---- heist interiors (bank vault / mansion safe): follow camera never inside a partition or outside the room
    const doors = await G(() => window.__app.surface.world.doorList().filter(d => /bank|mansion/.test(d.kind)).slice(0, 2));
    R.interiors = [];
    for (const d of doors) {
      await G(() => window.__app.surface.world.setWanted(0, 'test'));
      await G(d => { window.__app.surface.debugMove(d.x, d.z + 0.4, Math.PI); }, d); await sleep(300); await G(() => window.__app.surface.enterBuilding());
      if (!(await wait(k => window.__app.surface.info.inside?.kind === k, 6000, d.kind))) { R.interiors.push(d.kind + ':no-entry'); continue; }
      await wait(() => { const W = window.__app.surface.world, i = W.inside, c = window.__app.surface.camera.position; return i && c.x > i.x0 && c.x < i.x1 && c.z > i.z0 && c.z < i.z1; }, 8000); await frames(4); let worst = null; // let the lens settle in (slow SwiftShader frames)
      for (const yaw of [0, 1.57, 3.14, -1.57, 0.8, -2.3]) {
        await G(yaw => { const P = window.SSX.heist.debug.ctx().player; P.yaw = yaw; }, yaw); await sleep(450); await frames(3);
        const c = await G(() => { const W = window.__app.surface.world, i = W.inside, c = window.__app.surface.camera.position; return { blocked: W.camBlockedIn(c.x, c.y, c.z), out: c.x < i.x0 - 0.05 || c.x > i.x1 + 0.05 || c.z < i.z0 - 0.05 || c.z > i.z1 + 0.05 || c.y > i.y1 + 0.05 }; });
        if (c.blocked || c.out) worst = { yaw, ...c };
      }
      R.interiors.push(d.kind + ':' + (worst ? JSON.stringify(worst) : 'clear'));
      await G(() => window.__app.surface.leaveBuilding()); await sleep(800);
    }
    ok('interiorCam', R.interiors.join(' '), R.interiors.every(s => /clear|no-entry/.test(s)));
  } catch (e) { errors.push('TEST ' + e.message); }
  R.fail = await G(() => (window.__hlog || []).find(e => e[0] === 'fail')?.[1] || null).catch(() => null);
  R.events = await G(() => (window.__hlog || []).map(e => e[0]).filter((e, i, a) => e !== a[i - 1]).join(' > ')).catch(() => '');
  ok('noErrors', errors.join(' | ') || 'none', errors.length === 0);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
