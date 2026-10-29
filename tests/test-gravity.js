// Gravity modes (mars/gravity.js): MARS / LOW-G / ZERO-G for Mars surface vehicles.
// Toggle by Z and by the #ssxDock 🌍 button (touch, incl. a tap while a 2nd finger holds #joy); LOW-G airtime vs MARS;
// ZERO-G lift-off, thrust, pitch/yaw on the stick, roll axis (SSX.airRoll absent on main -> plain axis), auto-level;
// safe exits (back to MARS mid-air = soft fall, leaving the car, a race forces MARS, a job start resets); NPC cap on phones.
// BASE=http://localhost:8871/ BR=webkit DEV=393x852 SHOTS_DIR=... node tests/test-gravity.js   (DEV=desktop for 1280x800)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8871/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `grav-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const named = !m && DEV !== 'desktop' && devices[DEV] ? (({ defaultBrowserType: _n, ...d }) => d)(devices[DEV]) : null; // named Playwright devices too ("iPhone SE (3rd gen)")
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : named || { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/Failed to start the audio device/.test(e.message)) errors.push('PE ' + e.message); }); /* headless box: no audio sink */ page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const mode = () => G(() => window.SSX.gravity.mode);
  const toastTx = () => G(() => document.getElementById('toast')?.textContent || '');
  // pointer helpers (same synthetic-touch pattern as tests/test-accept.js): hold/release a button, held tap with a finger on #joy
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return r.width > 0; }, [t, sel, id, dx, dy]);
  const heldTap = async sel => { await P('pointerdown', '#joy', 41); await P('pointermove', '#joy', 41, 0, -20); const v = await P('pointerdown', sel, 42); await P('pointerup', sel, 42); await P('pointerup', '#joy', 41, 0, -20); return v; };
  const enterRover = async () => {
    if (await G(() => window.__app.surface.info.driving)) return true;
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await sleep(600); await G(() => window.__app.surface.interact());
    return wait(() => window.__app.surface.info.driving, 8000);
  };
  // launch from a fixed spot, return simulated airtime (s) until the wheels touch again
  const airtime = async spot => {
    await G(s => window.__app.surface.debugMove(s.x, s.z, s.yaw), spot); await sleep(500);
    await G(() => { window.__t0 = window.__gravity.simT; window.__app.surface.debugLaunch(5); });
    if (!(await wait(() => window.__gravity.car()?.air, 3000))) return -1;
    if (!(await wait(() => !window.__gravity.car()?.air, 240000))) return -2;
    await sleep(300);
    return G(() => window.__gravity.simT - window.__t0);
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('api', await G(() => !!window.SSX?.gravity && typeof window.SSX.gravity.cycle === 'function' && window.SSX.gravity.mode === 'MARS'));
    ok('apiFloatingReadOnly', await G(() => { const g = window.SSX.gravity; try { g.mode = 'ZERO-G'; } catch (e) { /* frozen */ } return g.floating === false && g.mode === 'MARS' && typeof g.set === 'function'; }));
    const hasAR = await G(() => !!window.SSX.airRoll?.roll); R.airRoll = hasAR; // v7.5.4 ships PR #41: ZERO-G rolls go through SSX.airRoll
    // in space: Z does nothing (the ship is never affected)
    await page.keyboard.press('KeyZ'); await sleep(200); ok('spaceZIgnored', await mode(), (await mode()) === 'MARS');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); });
    // on foot: refuses, dock button hidden
    await page.keyboard.press('KeyZ'); await sleep(200);
    ok('onFootRefuses', (await mode()) + ' / ' + (await toastTx()), (await mode()) === 'MARS' && /vehicle/i.test(await toastTx()));
    if (touch) ok('dockHiddenOnFoot', await G(() => getComputedStyle(document.getElementById('dockGrav')).display === 'none'));
    ok('roverIn', await enterRover());
    await sleep(400);
    if (touch) {
      await wait(() => getComputedStyle(document.getElementById('dockGrav')).display !== 'none', 60000);
      const st = await G(() => { const b = document.getElementById('dockGrav'), s = getComputedStyle(b), r = b.getBoundingClientRect(); return { bg: s.backgroundColor, fg: s.color, w: r.width, h: r.height, x: r.left, y: r.top, vis: s.display !== 'none', txt: b.textContent }; });
      ok('dockButton', JSON.stringify(st), st.vis && st.bg === 'rgb(0, 0, 0)' && st.fg === 'rgb(255, 255, 255)' && st.h >= 44 && st.w >= 44 && /MARS/.test(st.txt));
      const vw = await G(() => [innerWidth, innerHeight]); ok('dockOffCentre', `${st.x | 0},${st.y | 0}`, st.x > vw[0] * 0.5);
    }
    const spot = await G(() => { const i = window.__app.surface.info; return { x: i.x + 8, z: i.z + 8, yaw: 0.4 }; });
    // MARS airtime
    const tM = await airtime(spot); ok('airtimeMARS', +tM.toFixed(2), tM > 0);
    // toggle -> LOW-G (key on desktop; held dock tap on phones)
    if (touch) { ok('dockHeldTap', await heldTap('#dockGrav')); } else await page.keyboard.press('KeyZ');
    ok('toLowG', await wait(() => window.SSX.gravity.mode === 'LOW-G', 3000));
    ok('toastLowG', await toastTx(), /LOW-G/.test(await toastTx()));
    if (touch) ok('dockShowsLowG', await G(() => { const b = document.getElementById('dockGrav'), s = getComputedStyle(b); return /LOW-G/.test(b.textContent) && s.backgroundColor === 'rgb(255, 255, 255)' && s.color === 'rgb(0, 0, 0)'; }));
    const hp0 = await G(() => window.__app.surface.game.info.hp);
    ok('floatingFalseGrounded', await G(() => window.SSX.gravity.floating === false));
    await G(() => { window.__flt = false; window.__fltI = setInterval(() => { if (window.SSX.gravity.floating) window.__flt = true; }, 30); });
    const pL = airtime(spot); await sleep(1500); await shot('lowg-jump'); const tL = await pL;
    ok('floatingLowGAir', await G(() => { clearInterval(window.__fltI); return window.__flt; }));
    ok('airtimeLOWG', `${tL.toFixed(2)} s vs MARS ${tM.toFixed(2)} s (x${(tL / tM).toFixed(2)})`, tL > tM * 1.8);
    ok('lowGNoDamage', await G(h => window.__app.surface.game.info.hp >= h, hp0));
    // LOW-G hop on Space for a non-thrust vehicle is unit-tested; rover Space = thrusters (unchanged)
    // -> ZERO-G
    if (touch) { await heldTap('#dockGrav'); } else await page.keyboard.press('KeyZ');
    ok('toZeroG', await wait(() => window.SSX.gravity.mode === 'ZERO-G', 3000));
    ok('toastZeroG', await toastTx(), /ZERO-G/.test(await toastTx()));
    if (touch) ok('zeroPadShown', await G(() => getComputedStyle(document.getElementById('gravPad')).display !== 'none' && [...document.querySelectorAll('#gravPad button')].every(b => b.getBoundingClientRect().height >= 40)));
    else ok('zeroChip', await G(() => getComputedStyle(document.getElementById('gravChip')).display !== 'none'));
    await wait(() => !!window.__gravity.state(), 5000);
    const a0 = await G(() => window.__gravity.state().alt);
    // rise: Space (desktop) / ▲ (touch)
    if (touch) await P('pointerdown', '#gravUp', 43); else await page.keyboard.down('Space');
    const rose = await wait(a => window.__gravity.state()?.alt > a + 4, 60000, a0);
    if (touch) await P('pointerup', '#gravUp', 43); else await page.keyboard.up('Space');
    ok('zeroLeavesGround', `${a0.toFixed(1)} -> ${(await G(() => window.__gravity.state().alt)).toFixed(1)} m`, rose);
    // hovers: no input for 1.5 s, altitude holds (no gravity)
    const h1 = await G(() => window.__gravity.state().alt); await sleep(1500); const h2 = await G(() => window.__gravity.state().alt);
    ok('floatingZeroG', await G(() => window.SSX.gravity.floating === true));
    ok('zeroHovers', `${h1.toFixed(1)} -> ${h2.toFixed(1)}`, h2 > h1 - 1.0 && h2 > 3);
    { // PR #63 world.vehicleGround(car) -> (x, z) => max(terrain, roof): stub a 2 m roof under the car; ZERO-G altitude follows it
      const had = await G(() => typeof window.__app.surface.world.vehicleGround === 'function');
      await G(() => { const w = window.__app.surface.world, c = window.__gravity.car(); window.__vgOrig = w.vehicleGround; window.__vgBase = c.y - window.__gravity.state().alt; w.vehicleGround = () => () => window.__vgBase + 2; });
      await sleep(600);
      const m = await G(() => { const c = window.__gravity.car(), s = window.__gravity.state(); return { alt: s.alt, want: c.y - (window.__vgBase + 2), src: c.ground }; });
      await G(() => { const w = window.__app.surface.world; if (window.__vgOrig) w.vehicleGround = window.__vgOrig; else delete w.vehicleGround; });
      ok('vehicleGroundUsed', `${had ? 'native' : 'stub'} ${m.src}: alt ${m.alt.toFixed(2)} vs y - roof ${m.want.toFixed(2)}`, m.src === 'vehicleGround' && Math.abs(m.alt - m.want) < 0.3);
    }
    // forward thrust: W / ⚡ Boost on phones
    const p0 = await G(() => window.__gravity.state().p);
    if (touch) await P('pointerdown', '#runBtn', 44); else await page.keyboard.down('KeyW');
    const sw0 = await G(() => [window.__gravity.simT, Date.now()]);
    await wait(q => { const s = window.__gravity.state(); return Math.hypot(s.p[0] - q[0], s.p[2] - q[2]) > 3 && s.speed > 6; }, 90000, p0);
    R.simRate = await G(a => ((window.__gravity.simT - a[0]) / ((Date.now() - a[1]) / 1000)).toFixed(2), sw0);
    if (touch) await P('pointerup', '#runBtn', 44); else await page.keyboard.up('KeyW');
    const p1 = await G(() => window.__gravity.state().p); ok('zeroThrust', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1), Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 2);
    // yaw: D / stick right
    const hd0 = await G(() => window.__gravity.state().heading);
    if (touch) { await P('pointerdown', '#joy', 45); await P('pointermove', '#joy', 45, 60, 0); } else await page.keyboard.down('KeyD');
    await wait(h => Math.abs(window.__gravity.state().heading - h) > 0.5, 60000, hd0);
    if (touch) await P('pointerup', '#joy', 45, 60, 0); else await page.keyboard.up('KeyD');
    ok('zeroYaw', (await G(() => window.__gravity.state().heading) - hd0).toFixed(2), Math.abs(await G(() => window.__gravity.state().heading) - hd0) > 0.4);
    // pitch: ↓ / stick pulled back = nose up
    if (touch) { await P('pointerdown', '#joy', 46); await P('pointermove', '#joy', 46, 0, 60); } else await page.keyboard.down('ArrowDown');
    const pitched = await wait(() => window.__gravity.state().pitch > 0.35, 60000);
    if (touch) await P('pointerup', '#joy', 46, 0, 60); else await page.keyboard.up('ArrowDown');
    ok('zeroPitchUp', (await G(() => window.__gravity.state().pitch)).toFixed(2), pitched);
    await wait(() => window.__gravity.state().tilt < 0.15, 60000);
    // roll: E / ⟳ held until a full 360 on the plain roll axis (no airRoll on main)
    await G(() => { window.__r0 = window.__gravity.state().rolled; window.__maxTilt = 0; window.__rolls0 = window.__app.surface.info.stunts?.rolls || 0; window.__rs = setInterval(() => { const s = window.__gravity.state(); if (s) window.__maxTilt = Math.max(window.__maxTilt, s.tilt); }, 30); });
    if (touch) await P('pointerdown', '#gravRollR', 47); else await page.keyboard.down('KeyE');
    if (!hasAR) await wait(() => window.__gravity.state().tilt > 1.5, 60000); else await sleep(350); await shot('zerog-roll');
    if (hasAR) { // airRoll route: the stunt barrel roll (car.barrel) plays on top of the zero-G pose and completes
      const started = await wait(() => window.SSX.airRoll.isRolling() || window.__app.surface.info.stunts?.rolls > window.__rolls0, 30000, null);
      if (touch) await P('pointerup', '#gravRollR', 47); else await page.keyboard.up('KeyE');
      const ended = started && await wait(() => !window.SSX.airRoll.isRolling(), 30000);
      const rr = await G(() => { clearInterval(window.__rs); const s = window.__gravity.state(); return { route: s.route, rolls: window.__app.surface.info.stunts?.rolls - window.__rolls0, driving: window.__app.surface.info.driving, floating: window.SSX.gravity.floating }; });
      ok('zeroRoll360', JSON.stringify(rr), started && ended && rr.route === 'airRoll' && rr.driving && rr.floating);
    } else {
    const full = await wait(() => window.__gravity.state().rolled - window.__r0 >= Math.PI * 2, 90000);
    if (touch) await P('pointerup', '#gravRollR', 47); else await page.keyboard.up('KeyE');
    const rr = await G(() => { clearInterval(window.__rs); const s = window.__gravity.state(); return { deg: Math.round((s.rolled - window.__r0) * 57.3), maxTilt: Math.round(window.__maxTilt * 57.3), route: s.route, driving: window.__app.surface.info.driving }; });
    ok('zeroRoll360', JSON.stringify(rr), full && rr.maxTilt > 160 && rr.route === 'axis' && rr.driving);
    }
    // auto-level once released
    const lv = await wait(() => window.__gravity.state().tilt < 0.12, 60000); ok('zeroAutoLevel', (await G(() => window.__gravity.state().tilt * 57.3)).toFixed(1) + ' deg', lv);
    await shot('zerog-level');
    // back to MARS high up: soft fall, no damage
    const alt = await G(() => window.__gravity.state().alt), hpB = await G(() => window.__app.surface.game.info.hp);
    await G(() => window.SSX.gravity.set('MARS'));
    const landed = await wait(() => !window.__app.surface.info.air, 150000); await sleep(500);
    ok('marsSoftLanding', `from ${alt.toFixed(1)} m, hp ${hpB} -> ${await G(() => window.__app.surface.game.info.hp)}`, landed && (await G(h => window.__app.surface.game.info.hp >= h - 0.5, hpB)));
    ok('floatingFalseMars', await G(() => window.SSX.gravity.floating === false));
    // safety: leaving the vehicle resets
    await G(() => window.SSX.gravity.set('LOW-G')); await page.keyboard.press('KeyE'); await wait(() => !window.__app.surface.info.driving, 6000);
    ok('exitResets', await wait(() => window.SSX.gravity.mode === 'MARS', 3000));
    ok('roverBackIn', await enterRover());
    // a job start resets
    await G(() => window.SSX.gravity.set('ZERO-G')); await sleep(300);
    const js = await G(() => window.SSX.jobs?.start?.('taxi')); await sleep(300);
    ok('jobResets', `${JSON.stringify(js?.ok)} ${await mode()}`, !js?.ok || (await mode()) === 'MARS');
    await G(() => window.SSX.jobs?.stop?.()); await sleep(300);
    // a race forces MARS and refuses the toggle while it runs
    await G(() => window.SSX.gravity.set('LOW-G')); await sleep(200);
    const tr = await G(() => window.__race?.tracks?.()?.[0]?.id);
    if (tr) {
      await G(id => window.__race.start(id, { free: true }), tr);
      const raced = await wait(() => !!window.__race.state, 30000);
      ok('raceForcesMars', await wait(() => window.SSX.gravity.mode === 'MARS', 30000) && raced);
      await page.keyboard.press('KeyZ'); await sleep(200);
      ok('raceRefusesToggle', `${await mode()} / ${await toastTx()}`, (await mode()) === 'MARS' && /race/i.test(await toastTx()));
      await page.keyboard.press('Digit2'); await sleep(200); ok('digit2RaceLocked', `${await mode()}`, (await mode()) === 'MARS');
      await G(() => window.__race.quit()); await sleep(400);
    } else R.raceSkipped = 'no track';
    // phones: NPC budget
    const b = await G(() => window.SSX.city.npcBudget()); ok('npcBudget', `${b.used}/${b.cap}`, b.used <= b.cap && (!touch || b.cap <= 12));
    if (touch) { await G(() => window.SSX.gravity.set('MARS')); await sleep(300); await shot('dock'); }
    { // 2 cycles at any time (keyboard; also on a touch device with a keyboard) (also floating); the race lock above refused it the same way as Z
      await G(() => window.SSX.gravity.set('ZERO-G')); await page.keyboard.down('Space'); await wait(() => window.__gravity.state()?.alt > 3, 60000); await page.keyboard.up('Space');
      await page.keyboard.press('Digit2'); ok('digit2WhileFloating', await wait(() => window.SSX.gravity.mode === 'MARS', 5000));
      await page.keyboard.press('Digit2'); ok('digit2Cycles', await wait(() => window.SSX.gravity.mode === 'LOW-G', 5000)); await G(() => window.SSX.gravity.set('MARS'));
    }
    ok('modeLog', (await G(() => window.__gravity.log.map(l => `${l.from}>${l.to}:${l.reason}`).join(' '))), true);
    ok('noErrors', errors.join(' | ').slice(0, 300) || 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
