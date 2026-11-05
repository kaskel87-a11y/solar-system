// v7.3 race test: street races on Mars (Ares Junction) - menu + context-button entry, countdown hold, gate crossing,
// laps, best lap + ghost saved to localStorage, rival, credits buy-in and purse, rematch, quit, DNF, ramps / boost pads /
// barriers, HUD keeps the middle clear, multi-touch (stick + Race button, Chromium CDP), take-off cleanup, Moon track.
// BASE=http://localhost:8777/ DEV="iPhone 14" BR=webkit node tests/test-race.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/workspace/race-shots/', PFX = process.env.PFX || 'race';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// place the car, then let the game run a few frames (slow software GL can drop below 10 fps)
const PLACE = ([x, z, y]) => new Promise(r => { window.__race.place(x, z, y); let n = 0; const f = () => (++n >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  // DEV: a Playwright device name, 'desktop', or WxH (an iPhone-like touch phone at that CSS viewport, e.g. 393x852)
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const vis = sel => G(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
  const center = sel => G(s => { const e = document.querySelector(s); e.scrollIntoView?.({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapAt = async sel => { const c = await center(sel); if (touch) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); };
  // ☰: on desktop Chromium a mouse click on #menuBtn doesn't open the menu on main either (pre-existing; noted in the PR) -> fall back to toggleMenu
  const openMenu = async () => { await tapAt('#menuBtn'); await sleep(250); if (!(await G(() => document.getElementById('roverMenu').classList.contains('show')))) { R.menuClickFallback = true; await G(() => window.__app.toggleMenu(true)); await sleep(150); } };
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800); };
  const credits = () => G(() => window.__app.surface.game.progress.credits);
  // drive through a gate: put the car just before it, then just past it (two physics frames apart)
  const thru = async g => {
    const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw);
    await G(PLACE, [g.x - fx * 5, g.z - fz * 5, g.yaw]); await sleep(80);
    await G(PLACE, [g.x + fx * 5, g.z + fz * 5, g.yaw]); await sleep(80);
  };
  const lap = async t => { for (let i = 1; i <= t.gates.length; i++) await thru(t.gates[i % t.gates.length]); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.removeItem('ssx.race.v1'); Object.keys(localStorage).filter(k => k.startsWith('ssx.race.')).forEach(k => localStorage.removeItem(k)); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land();
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.debug.credits(500); window.__race.reload(); });
    const tracks = await G(() => window.__race.tracks());
    R.tracks = tracks.map(t => `${t.id}:${t.gates.length}g:${Math.round(t.length)}m`).join(' ');
    ok('marsTracks', null, tracks.length >= 3 && tracks.some(t => t.id === 'mars-rustbelt') && tracks.some(t => t.id === 'mars-gutter') && tracks.some(t => t.id.startsWith('q-')));
    ok('noRaceButtonsAtShip', null, !(await vis('#raceCtxBtn')));
    // ---------- 1. menu -> race list ----------
    await openMenu();
    ok('menuEntries', null, (await vis('#rmRaces')) && (await vis('#rmBuilder')));
    await tapAt('#rmRaces'); await sleep(300);
    const panel = await G(() => ({ on: document.getElementById('racePanel').classList.contains('on'), items: document.querySelectorAll('#racePanel .item').length, text: document.getElementById('racePanel').innerText }));
    ok('racePanel', null, panel.on && panel.items >= 3 && /Rust Belt Loop/.test(panel.text) && /Gutter Sprint/.test(panel.text) && /buy-in/.test(panel.text));
    await shot('panel');
    await tapAt('#racePanel .close'); await sleep(200);
    ok('panelClosed', null, !(await G(() => document.getElementById('racePanel').classList.contains('on'))));
    // ---------- 2. context button at the start line, on foot -> auto rover ----------
    const gut = tracks.find(t => t.id === 'mars-gutter');
    await G(g => { const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); window.__app.surface.debugMove(g.x - fx * 9, g.z - fz * 9, g.yaw); }, gut.gates[0]); await sleep(300);
    ok('ctxButton', null, await wait(() => getComputedStyle(document.getElementById('raceCtxBtn')).display !== 'none', 6000));
    await shot('start-line');
    const c0 = await credits(); await G(() => window.__app.surface.game.debug.clear());
    await tapAt('#raceCtxBtn');
    ok('raceStarted', null, await wait(() => window.__race.state?.phase === 'grid' && window.__app.surface.info.driving, 6000)); R.startToast = await G(() => document.getElementById('toast')?.textContent);
    ok('countdownShown', null, await wait(() => /^[123]$/.test(document.getElementById('raceCount').textContent) && document.getElementById('raceCount').classList.contains('on'), 4000));
    await G(() => new Promise(r => { window.__race.setCarSpeed(25); let n = 0; const f = () => (++n >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const held = await G(() => window.__race.car().speed);
    ok('gridHold', held, Math.abs(held) < 0.01);
    await shot('countdown');
    ok('go', null, await wait(() => window.__race.state?.phase === 'run', 40000));
    ok('buyIn', await credits(), (await credits()) === c0 - 20);
    // HUD: race chip sits in the top-right stack; nothing of ours in the middle of the screen (once GO! fades)
    await wait(() => !document.getElementById('raceCount').classList.contains('on'), 30000);
    const hud = await G(() => {
      const W = innerWidth, H = innerHeight, mid = { l: W * 0.22, r: W * 0.78, t: H * 0.3, b: H * 0.68 }, hits = [];
      for (const id of ['raceChip', 'raceResult', 'raceCount', 'raceCtxBtn']) { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') continue; const r = e.getBoundingClientRect(); if (r.width && r.right > mid.l && r.left < mid.r && r.bottom > mid.t && r.top < mid.b) hits.push(id); }
      const c = document.getElementById('raceChip').getBoundingClientRect(); return { hits, chip: { top: Math.round(c.top), bottom: Math.round(c.bottom), left: Math.round(c.left), right: Math.round(c.right) }, W, H, txt: document.getElementById('raceChip').innerText };
    });
    R.hud = JSON.stringify(hud);
    ok('middleClear', null, hud.hits.length === 0 && hud.chip.bottom < hud.H * 0.3 && hud.chip.right <= hud.W + 1 && /Lap 1\/3/.test(hud.txt));
    const rd0 = await G(() => window.__race.state.rival.dist);
    ok('rivalMoves', null, await wait(d => window.__race.state.rival.dist > d + 3, 30000, rd0));
    await shot('racing');
    await G(() => window.__race.rivalPace(0.15));
    // wrong gate order doesn't count
    await thru(gut.gates[3]); ok('skipGateIgnored', null, await G(() => window.__race.state.next === 1 && window.__race.state.passed === 0));
    for (let l = 0; l < 2; l++) await lap(gut);
    for (let i = 1; i < gut.gates.length; i++) await thru(gut.gates[i]);
    const cPre = await credits(); await thru(gut.gates[0]);
    ok('finished', null, await wait(() => !window.__race.state && window.__race.result, 15000));
    const res = await G(() => window.__race.result);
    R.result = JSON.stringify(res);
    ok('won', null, res.done && res.won && res.laps.length === 3 && res.newBest && res.firstWin);
    ok('purse', res.credits, res.credits === Math.round((120 + 40 + 100) * (await G(() => window.SSX.economy?.payoutMult ?? 1)))); // money boost: payoutMult x
    const cPost = await credits(); ok('creditsPaid', cPost - cPre, [0, 25, 50, 75, 100].includes(cPost - cPre - res.credits)); // + streak bonus if any
    const st = await G(() => ({ race: JSON.parse(localStorage.getItem('ssx.race.v1')), ghost: JSON.parse(localStorage.getItem('ssx.race.ghost.mars-gutter') || 'null'), prog: JSON.parse(localStorage.getItem('ssx.progress.v1') || '{}').credits }));
    ok('bestSaved', st.race?.best?.['mars-gutter'], st.race?.best?.['mars-gutter'] === Math.round(Math.min(...res.laps)) && st.race.wins['mars-gutter'] === 1);
    ok('ghostSaved', st.ghost?.length, Array.isArray(st.ghost) && st.ghost.length >= 24);
    ok('progressSaved', st.prog, st.prog === cPost);
    ok('resultCard', null, (await vis('#raceResult')) && /YOU WIN/.test(await G(() => document.getElementById('raceResult').innerText)));
    await shot('result');
    // ---------- 3. rematch: ghost of the best lap rides along; rival beats you -> no purse ----------
    await tapAt('#raceAgain');
    ok('rematch', null, await wait(() => window.__race.state?.phase === 'grid' && window.__race.state.ghost, 15000));
    await G(() => window.__race.skipCountdown()); await wait(() => window.__race.state?.phase === 'run', 15000);
    await G(() => window.__race.rivalPace(40));
    ok('rivalFinishes', null, await wait(() => window.__race.state?.rival?.finish, 90000));
    for (let l = 0; l < 3; l++) await lap(gut);
    await wait(() => !window.__race.state, 5000);
    const res2 = await G(() => window.__race.result);
    ok('lost', null, res2.done && !res2.won && res2.rivalTime > 0 && res2.credits === (res2.newBest ? Math.round(40 * (await G(() => window.SSX.economy?.payoutMult ?? 1))) : 0)); // money boost: payoutMult x
    await tapAt('#raceResClose'); await sleep(200); ok('resultClosed', null, !(await vis('#raceResult')));
    // ---------- 4. props: boost pad, ramp, barrier ----------
    await G(() => window.__race.start('mars-gutter', { noRival: true })); await G(() => window.__race.skipCountdown()); await wait(() => window.__race.state?.phase === 'run', 15000);
    const pr = gut.props; const boost = pr.find(p => p.t === 'boost'), ramp = pr.find(p => p.t === 'ramp'), barrier = pr.find(p => p.t === 'barrier');
    await G(([x, z, y]) => new Promise(r => { window.__race.place(x, z, y); window.__race.setCarSpeed(8); requestAnimationFrame(() => requestAnimationFrame(r)); }), [boost.x, boost.z, boost.yaw]);
    const sB = await G(() => window.__race.car().speed); ok('boostPad', sB, sB > 20);
    await sleep(1200);
    await G(([x, z, y]) => { const fx = -Math.sin(y), fz = -Math.cos(y); window.__race.place(x - fx * 1, z - fz * 1, y); window.__race.setCarSpeed(22); }, [ramp.x, ramp.z, ramp.yaw]);
    ok('rampLaunch', null, await wait(() => { const c = window.__race.car(); return c.air && c.vy > 0; }, 6000));
    await sleep(2500);
    await G(([x, z, y]) => { const fx = -Math.sin(y), fz = -Math.cos(y); window.__race.place(x + fx * 4, z + fz * 4, y + Math.PI); window.__race.setCarSpeed(15); }, [barrier.x, barrier.z, barrier.yaw]);
    await sleep(600);
    const bc = await G(b => { const c = window.__race.car(), fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw); return { along: (c.x - b.x) * fx + (c.z - b.z) * fz, speed: c.speed }; }, barrier);
    ok('barrierBlocks', JSON.stringify(bc), bc.along > 1);
    // ---------- 5. quit from the menu ----------
    await openMenu();
    ok('quitLabel', null, /Quit race/.test(await G(() => document.getElementById('rmRaces').textContent)));
    await tapAt('#rmRaces'); await sleep(300);
    ok('quit', null, await G(() => !window.__race.state && getComputedStyle(document.getElementById('raceChip')).display === 'none'));
    // ---------- 6. DNF: bail out of the car mid-race ----------
    await G(() => window.__race.start('mars-rustbelt', { noRival: true })); await G(() => window.__race.skipCountdown()); await wait(() => window.__race.state?.phase === 'run', 15000);
    await G(() => window.__app.surface.interact()); await sleep(200);
    ok('onFoot', null, !(await G(() => window.__app.surface.info.driving)));
    ok('dnf', null, await wait(() => window.__race.result && !window.__race.result.done, 120000)); // 10 s of game time; slow software GL runs below real time
    // ---------- 7. multi-touch: thumb on the stick, second finger hits Race (Chromium CDP) ----------
    if (BR === 'chromium' && touch) {
      await G(() => { if (!window.__app.surface.info.driving) { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); } });
      await wait(() => window.__app.surface.info.driving, 4000);
      await G(g => { const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); window.__app.surface.debugMove(g.x - fx * 8, g.z - fz * 8, g.yaw); }, gut.gates[0]);
      await wait(() => getComputedStyle(document.getElementById('raceCtxBtn')).display !== 'none', 4000);
      await G(() => window.__app.surface.game.debug.clear());
      await G(() => { window.__pd = []; document.addEventListener('pointerdown', e => window.__pd.push(`${e.pointerId}:${e.target.id || e.target.tagName}@${Math.round(e.clientX)},${Math.round(e.clientY)}`), true); });
      const cdp = await ctx.newCDPSession(page); const j = await center('#joy'), b = await center('#raceCtxBtn'); R.mtPts = JSON.stringify({ j, b });
      const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
      await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(80); await T('touchMove', [{ x: j.x, y: j.y - 50, id: 1 }]); await sleep(80);
      const b2 = await center('#raceCtxBtn'); R.mtPts2 = JSON.stringify(b2); // the game's button column can reflow; aim where the button is now
      await T('touchStart', [{ x: j.x, y: j.y - 50, id: 1 }, { x: b2.x, y: b2.y, id: 2 }]); await wait(() => window.__race.state?.phase === 'grid', 12000);
      const mt = await G(() => ({ race: window.__race.state?.phase, joy: window.__app.joy.y, toast: document.getElementById('toast')?.textContent, pd: window.__pd, near: getComputedStyle(document.getElementById('raceCtxBtn')).display, el: (() => { const r = document.getElementById('raceCtxBtn').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id; })() }));
      await T('touchEnd', [{ x: j.x, y: j.y - 50, id: 1 }]); await sleep(80); await T('touchEnd', []); await sleep(200);
      ok('multiTouchStickRace', JSON.stringify(mt), mt.race === 'grid' && Math.abs(mt.joy) > 0.2);
      ok('multiTouchRelease', null, await G(() => window.__app.joy.x === 0 && window.__app.joy.y === 0));
      await G(() => window.__race.quit());
    }
    // ---------- 8. take off mid-race cleans up; Moon has its own track ----------
    await G(() => window.__race.start('mars-rustbelt')); await sleep(300);
    await G(() => window.__app.takeOff()); await wait(() => !window.__app.state.onSurface, 15000); await sleep(1200);
    ok('takeoffCleanup', null, await G(() => !window.__race.state && (!document.getElementById('raceChip') || getComputedStyle(document.getElementById('raceChip')).display === 'none')));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Moon').mesh)); await land();
    const moon = await G(() => ({ planet: window.__race.planet, tracks: window.__race.tracks().map(t => t.id), counts: window.__race.counts() }));
    ok('moonTrack', JSON.stringify(moon), moon.planet === 'Moon' && moon.tracks.includes('moon-crater') && !moon.tracks.includes('mars-gutter') && moon.counts.idle >= 1);
    ok('moonRace', null, (await G(() => window.__race.start('moon-crater')))?.ok && await wait(() => window.__race.state?.phase === 'grid', 4000));
    await G(() => window.__race.skipCountdown()); await sleep(1500); await shot('moon');
    await G(() => window.__race.quit());
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  R.errors = errors.slice(0, 5); ok('noConsoleErrors', null, errors.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
