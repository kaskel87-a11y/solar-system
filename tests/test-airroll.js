// Phone barrel-roll button (airroll.js) + the existing v7.4 rolls: Starship in flight, the rover and a stolen car off a
// launch, button only while airborne, taps with a held joystick finger, clean landings (no roof landing, no damage).
// Desktop: button never shows; Q/E in the air and double-tap D still roll.
// BASE=http://localhost:8819/ DEV=393x852 BR=webkit OUT=/workspace/pw-ben-rolls/shots/ node tests/test-airroll.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8817/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'airroll';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /sci/.test(m.text()))) errors.push(m.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 15000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = (n = 4) => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png`, timeout: 90000 });
  // touch: every tap goes in while a second finger rests on the joystick (pointer ids 41 held, 42 tapping), with no
  // synthetic click, the way iOS behaves. Buttons bound with plain onclick fail this; onTap (pointerdown->pointerup) passes.
  const HELD = touch && process.env.HELD !== '0';
  const tapHeld = sel => G(s => {
    const e = document.querySelector(s), j = document.getElementById('joy'); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width) return false;
    const jr = j.getBoundingClientRect(), P = (t, el, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    const jx = jr.left + jr.width / 2, jy = jr.top + jr.height / 2, x = r.x + r.width / 2, y = r.y + r.height / 2;
    P('pointerdown', j, 41, jx, jy); P('pointerdown', e, 42, x, y); P('pointerup', e, 42, x, y); P('pointerup', j, 41, jx, jy);
    window.__heldTaps = (window.__heldTaps || 0) + 1; return true;
  }, sel);

  const vis = () => G(() => { const b = document.getElementById('airRollBtn'); return !!b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0; });
  const tapRoll = async () => { if (HELD) return tapHeld('#airRollBtn'); const c = await G(() => { const r = document.getElementById('airRollBtn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await page.touchscreen.tap(c.x, c.y); return true; };
  const deskRoll = () => page.keyboard.press('KeyZ'); // the new desktop key (v7.4 Q/E still works)
  const S = () => G(() => { const i = window.__app.surface.info; return { driving: i.driving, vehicle: i.vehicle, air: i.air, rolling: !!i.rolling, stunts: i.stunts, hp: i.hp ?? window.__app.surface.game.info?.hp ?? null }; });
  const airRoll = async (label) => {
    const s0 = await S();
    ok(label + '-hiddenOnGround', null, touch ? !(await vis()) : true);
    await G(() => window.__app.surface.debugLaunch(9)); await frames(3); await sleep(250);
    ok(label + '-air', null, (await S()).air);
    if (touch) { ok(label + '-btnInAir', null, await wait(() => { const b = document.getElementById('airRollBtn'); return b && getComputedStyle(b).display !== 'none'; }, 1500)); await tapRoll(); }
    else { ok(label + '-btnNeverOnDesktop', null, !(await vis())); await deskRoll(); }
    ok(label + '-rolling', null, await wait(() => window.__app.surface.info.rolling, 5000));
    if (label === 'rover') { await sleep(220); await shot('rover-roll'); }
    ok(label + '-landedClean', null, await wait(n => { const i = window.__app.surface.info; return !i.air && !i.rolling && i.stunts.clean > n; }, 45000, s0.stunts.clean));
    const s1 = await S();
    if (!R[label + '-landedClean']) R[label + '-diag'] = await G(() => { const i = window.__app.surface.info; return { air: i.air, rolling: i.rolling, x: i.x, z: i.z, y: i.y, speed: i.speed, inside: !!i.inside, f: window.__frames, down: window.__app.surface.game.isDown?.(), veh: i.vehicle, race: JSON.stringify(i.race || null).slice(0, 80), intro: i.intro, outro: i.outro }; });
    if (!R[label + '-landedClean']) { await frames(60); R[label + '-diag2'] = await G(() => { const i = window.__app.surface.info; return { y: i.y, air: i.air, f: window.__frames }; }); }
    R[label + '-stunts'] = s1.stunts; ok(label + '-noRoofLanding', null, s1.stunts.crash === s0.stunts.crash);
    ok(label + '-stillDriving', null, s1.driving && s1.vehicle === s0.vehicle);
    await sleep(400); ok(label + '-hiddenAfterLanding', null, !(await vis()));
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('loaded', null, await G(() => !!document.getElementById('airRollBtn')));
    ok('hiddenAtStart', null, !(await vis()));
    ok('api', null, await G(() => { const A = window.SSX?.airRoll; return !!A && ['roll', 'isRolling', 'canRoll', 'on'].every(k => typeof A[k] === 'function') && window.__app.airRoll === A; }));
    await G(() => { window.__arEv = []; window.SSX.airRoll.on('*', (e, d) => window.__arEv.push(e + ':' + (d.target || '') + (d.dir ? ':' + d.dir : ''))); });
    ok('api-cantRollInOrbit', null, await G(() => !window.SSX.airRoll.canRoll() && window.SSX.airRoll.roll('left') === false));
    // ---- Starship in flight
    await G(() => window.__app.setFlying?.(true)); await wait(() => window.__app.state.flying && !window.__app.state.onSurface, 15000); await sleep(600);
    const sr0 = await G(() => window.__app.shipRolls || 0);
    if (touch) {
      ok('ship-btnInFlight', null, await wait(() => getComputedStyle(document.getElementById('airRollBtn')).display !== 'none', 2000));
      // pointerdown then pointercancel must NOT roll
      await G(() => { const b = document.getElementById('airRollBtn'), r = b.getBoundingClientRect(), P = t => b.dispatchEvent(new PointerEvent(t, { pointerId: 51, pointerType: 'touch', clientX: r.x + 20, clientY: r.y + 20, bubbles: true, cancelable: true })); P('pointerdown'); P('pointercancel'); });
      await sleep(300); ok('ship-cancelNoRoll', null, !(await G(() => window.__app.shipRoll)) && (await G(() => window.__app.shipRolls || 0)) === sr0);
      await tapRoll();
    } else {
      ok('ship-btnNeverOnDesktop', null, !(await vis()));
      await G(() => { for (const t of ['keydown', 'keyup', 'keydown', 'keyup']) document.dispatchEvent(new KeyboardEvent(t, { code: 'KeyD', key: 'd', bubbles: true })); });
    }
    R.shipEvents = await G(() => window.__arEv.slice());
    ok('ship-roll', null, await wait(n => (window.__app.shipRolls || 0) > n || !!window.__app.shipRoll, 3000, sr0));
    await sleep(380); await shot('ship-roll');
    ok('ship-rollDone', null, await wait(n => (window.__app.shipRolls || 0) > n && !window.__app.shipRoll, 6000, sr0));
    ok('ship-level', null, await G(() => Math.abs(window.__app.rocket.rotation.z) < 0.01));
    ok('api-shipRollLeft', null, await G(() => window.SSX.airRoll.canRoll() && window.SSX.airRoll.roll('left') === true && window.SSX.airRoll.isRolling() && window.__app.shipRoll.dir === -1));
    ok('api-shipNoDoubleRoll', null, await G(() => window.SSX.airRoll.roll('right') === false));
    await wait(() => !window.SSX.airRoll.isRolling(), 4000); await sleep(150);
    R.shipEvents = await G(() => window.__arEv.slice()); ok('api-shipEvents', R.shipEvents, R.shipEvents.includes('start:ship:left') && R.shipEvents.includes('end:ship'));
    // ---- land on Mars
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.restore?.(); });
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    ok('hiddenOnFoot', null, !(await vis()));
    // ---- the rover
    await G(() => { const s = window.__app.surface; if (!s.info.driving) { const r = s.info; s.debugMove(-9 + 2.2, 0.8, 0); } });
    await frames(6); await G(() => { if (!window.__app.surface.info.driving) window.__app.surface.interact(); }); await frames(6);
    ok('inRover', null, await G(() => window.__app.surface.info.driving));
    await G(() => window.__app.surface.debugMove(-30, -6, 0)); await frames(10); await sleep(300);
    await airRoll('rover');
    // ---- a parked car (stolen)
    await G(() => window.__app.surface.interact()); await frames(6);
    const pv = await G(() => { const s = window.__app.surface, me = s.info; const vs = s.world.debug.vehicles().filter(v => v.parked && v.kind !== 'rover' && !/hover/.test(v.kind)); vs.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z)); return vs[0] || null; });
    R.car = pv?.kind;
    if (pv) {
      await G(v => window.__app.surface.debugMove(v.x + 2.2, v.z + 0.8, 0), pv); await frames(8);
      await G(() => window.__app.surface.interact()); await frames(6);
      ok('inCar', R.car, await G(() => window.__app.surface.info.driving && window.__app.surface.info.vehicle !== 'rover'));
      await G(() => window.__app.surface.world.setWanted(0, 'test')); await frames(4);
      await airRoll('car');
      // API roll on the car: grounded -> false; airborne -> true, events start/end/land
      ok('api-carGroundedFalse', null, await G(() => window.SSX.airRoll.roll('right') === false));
      await G(() => { window.__arEv = []; window.__app.surface.debugLaunch(9); }); await frames(3);
      ok('api-carRollLeft', null, await G(() => window.SSX.airRoll.canRoll() && window.SSX.airRoll.roll('left')));
      ok('api-carLanded', null, await wait(() => window.__arEv.includes('land:'), 90000));
      R.carEvents = await G(() => window.__arEv); R.carApiState = await G(() => { const i = window.__app.surface.info; return { f: window.__frames, air: i.air, rolling: i.rolling, st: i.stunts }; }); ok('api-carEvents', R.carEvents, R.carEvents.includes('start:vehicle:left') && R.carEvents.includes('end:vehicle') && !R.carEvents.includes('crash:'));
    } else ok('carFound', null, false);
    if (HELD) ok('heldJoystickTaps', await G(() => window.__heldTaps || 0), true);
    ok('npcCap', null, await G(() => { const b = window.__app.surface.world.npcBudget?.(); return !b || b.used <= b.cap; }));
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || 'none', errors.length === 0);
  R.fail = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
