// v7.4 test: barrel rolls (desktop Q/E in the air, touch double-flick on the stick), clean-landing stunt bonus,
// Starship roll, ☰ mouse click on desktop right after landing, the modding API (registerMenuItem / registerVehicle /
// registerBody), the Titan methane skiff (amphibious) and the planets + race merges loading cleanly.
// BASE=http://localhost:8765/ BR=chromium DEV=desktop node test-v74.js   (DEV="iPhone 14" BR=webkit for touch)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); const warns = []; page.on('console', m => { if (/basic/.test(m.text())) warns.push(m.text().slice(0, 160)); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button')?.id }; }, sel);
  const flick = () => G(async () => { // two fast sideways flicks of the virtual stick (synthetic pointer events)
    const j = document.getElementById('joy'), r = j.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2, P = (t, x) => j.dispatchEvent(new PointerEvent(t, { pointerId: 77, pointerType: 'touch', clientX: x, clientY: cy, bubbles: true, cancelable: true }));
    const s = ms => new Promise(q => setTimeout(q, ms));
    P('pointerdown', cx); await s(30); P('pointermove', cx + r.width * 0.5); await s(60); P('pointermove', cx); await s(60); P('pointermove', cx + r.width * 0.5); await s(30); P('pointerup', cx + r.width * 0.5);
  });
  const roll = async () => { if (desk) await page.keyboard.press('KeyE'.replace('E', 'Q')); else await flick(); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('version', await G(() => window.__app.version), (v => /^v7\.\d/.test(v) && (!process.env.VER || v === process.env.VER))(await G(() => window.__app.version))); // any v7.x release; VER=v7.5.3.1 pins it
    ok('modules', await G(() => !!window.__app.planets && window.__app.planets.list.join()), await G(() => window.__app.planets?.list.length === 5));
    // ---- Starship barrel roll in flight
    await G(() => { localStorage.clear(); });
    await G(() => window.__app.setFlying?.(true)); await wait(() => window.__app.state.flying && !window.__app.state.onSurface, 15000); await sleep(600);
    const sr0 = await G(() => window.__app.shipRolls || 0);
    if (desk) await G(() => { for (const t of ['keydown', 'keyup', 'keydown', 'keyup']) document.dispatchEvent(new KeyboardEvent(t, { code: 'KeyD', key: 'd', bubbles: true })); }); else await flick(); // a real double-tap, without CDP round-trip lag under load
    ok('shipRoll', await wait(n => (window.__app.shipRolls || 0) > n || !!window.__app.shipRoll, 4000, sr0));
    await sleep(500); await page.screenshot({ path: `${out}v74-${tag}-ship-roll.png` });
    ok('shipRollDone', await wait(n => (window.__app.shipRolls || 0) > n, 8000, sr0));
    // ---- land on Mars; on desktop the mouse is free so a click opens ☰
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    if (desk) {
      ok('freeMouseOnLanding', await G(() => !document.pointerLockElement));
      const m = await center('#menuBtn'); ok('menuBtnHit', m?.top, m?.top === 'menuBtn');
      await page.mouse.click(m.x, m.y); ok('menuMouseClick', await wait(() => document.getElementById('roverMenu').classList.contains('show'), 2000));
      await page.mouse.click(m.x, m.y); await wait(() => !document.getElementById('roverMenu').classList.contains('show'), 2000);
      await page.keyboard.press('KeyM'); ok('menuKeyM', await wait(() => document.getElementById('roverMenu').classList.contains('show'), 2000)); await page.keyboard.press('KeyM');
    }
    // ---- BUGS-v7.3: 44 px tap targets in the top bar, the lock chip only shows while the mouse is captured
    const sz = await G(() => ['#menuBtn', '#gearChip'].map(q => { const e = document.querySelector(q); return e && getComputedStyle(e).display !== 'none' ? Math.round(e.getBoundingClientRect().height) : 44; }));
    ok('tapTargets44', sz.join('/'), sz.every(h => h >= 44));
    ok('meterLabels', await G(() => [...document.querySelectorAll('#tbBars .tbL')].map(e => e.getAttribute('aria-label')).join()), await G(() => document.querySelectorAll('#tbBars .tbL').length === 3));
    ok('thrustHiddenOnFoot', await G(() => !window.__thrustHud().top));
    if (desk) ok('meterWords', await G(() => document.getElementById('tbBars').innerText.replace(/\s+/g, ' ')), await G(() => /SHIELD/.test(document.getElementById('tbBars').innerText) && /\d/.test(document.getElementById('hpVal').textContent)));
    ok('lockChipHidden', await G(() => !!document.getElementById('lockChip') && getComputedStyle(document.getElementById('lockChip')).display === 'none'));
    // ---- modding API
    const api = await G(() => {
      const S = window.SSX, r = {};
      const el = S.registerMenuItem({ id: 'v74test', label: '🧪 Test', onTap: () => { window.__v74tap = (window.__v74tap || 0) + 1; } });
      r.menuEl = el instanceof HTMLElement && el.id === 'v74test' && !!el.closest('#roverMenu');
      r.vehKind = S.registerVehicle('v74cart', { name: 'Test cart', icon: '🛺', vmax: 12 }) === 'v74cart';
      r.body = typeof S.registerBody === 'function' && (S.registerBody({ name: 'Testworld' }), (S.bodies || []).some(b => b.name === 'Testworld'));
      r.district = S.registerDistrict('Mars', 'v74test', { name: 'Test Row', centre: [0, -430] }) === 'v74test' && S.districtsOf('Mars').some(d => d.name === 'Test Row') && typeof window.__app.surface.world.securityList === 'function' && typeof window.__app.surface.world.crime === 'function';
      r.skiff = !!window.__app.surface.world && true; return r;
    });
    ok('apiMenuItem', api.menuEl); ok('apiVehicle', api.vehKind); ok('apiBody', api.body); ok('apiDistrict', api.district);
    await G(() => window.__app.toggleMenu(true)); await sleep(250);
    await G(() => document.getElementById('v74test').scrollIntoView({ block: 'center' })); await sleep(200); // short landscape screens: the menu scrolls, like a player would
    const t = await center('#v74test'); R.menuTapTop = t.top;
    if (desk) await page.mouse.click(t.x, t.y); else await page.touchscreen.tap(t.x, t.y);
    ok('apiMenuTap', await wait(() => window.__v74tap === 1, 3000)); await G(() => window.__app.toggleMenu(false));
    // ---- rover barrel roll: pop it into the air, roll, land clean → bonus
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await wait(() => /Drive/.test(document.getElementById('driveBtn').textContent), 8000);
    await G(() => window.__app.surface.interact());
    ok('roverIn', await wait(() => window.__app.surface.info.driving, 6000));
    ok('thrustBarInRover', await wait(() => window.__thrustHud().top && /%/.test(window.__thrustHud().topBar), 3000)); await page.screenshot({ path: `${out}v74-${tag}-meters.png`, clip: { x: 0, y: 0, width: desk ? 1366 : 393, height: 70 } });
    const cr0 = await G(() => window.__app.game.progress.credits);
    await G(() => window.__app.surface.debugLaunch(10)); ok('air', await wait(() => window.__app.surface.info.air, 3000));
    await roll(); ok('rolling', await wait(() => window.__app.surface.info.rolling || window.__app.surface.info.stunts.rolls > 0, 3000));
    await sleep(250); await page.screenshot({ path: `${out}v74-${tag}-barrel-roll.png` });
    ok('cleanLanding', await wait(() => window.__app.surface.info.stunts.clean > 0 || window.__app.surface.info.stunts.crash > 0, 20000)); R.stunts = await G(() => JSON.stringify(window.__app.surface.info.stunts));
    if (await G(() => window.__app.surface.info.stunts.crash > 0)) bad.push('landedOnRoof');
    const cr1 = await G(() => window.__app.game.progress.credits); ok('stuntBonus', `${cr0} → ${cr1}`, cr1 - cr0 >= 25);
    ok('stuntToast', await G(() => /Barrel roll/.test(document.body.innerText)));
    ok('rollsSkipWeaponSwitch', await G(() => window.__app.surface.info.driving));
    // ---- Velvet Airlock: 18+ prompt, make it rain, private dance (letterboxed), upstairs fades to black and restores health
    await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 6000);
    await G(() => { localStorage.removeItem('ssx.adult'); const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); window.__app.game.debug?.clear?.(); });
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await wait(() => /Enter/.test(document.getElementById('driveBtn').textContent), 5000);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 6000)); await sleep(500);
    ok('entryStepInside', await G(() => { const i = window.__app.surface.world.inside, p = window.__app.surface.info; return +(i.z1 - p.z).toFixed(2); }), await G(() => { const i = window.__app.surface.world.inside, p = window.__app.surface.info; return i.z1 - p.z > 2.0; }));
    ok('leaveAtEntry', await wait(() => /Leave/.test(document.getElementById('driveBtn').textContent), 3000));
    const act = async () => { const b = await center('#driveBtn'); if (desk) await page.keyboard.press('KeyE'); else await page.touchscreen.tap(b.x, b.y); };
    const tapSel = async sel => { const b = await center(sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); };
    await G(() => window.__app.surface.debugInside(0, -3.4, 0)); ok('tipLabel', await wait(() => /Tip · 20 cr/.test(document.getElementById('driveBtn').textContent), 4000));
    const c0 = await G(() => window.__app.game.progress.credits);
    await act(); ok('adultGate', await wait(() => getComputedStyle(document.getElementById('adultGate')).display === 'flex', 3000));
    await tapSel('#adultYes'); ok('tipped', await wait(c => window.__app.game.progress.credits === c - 20, 4000, c0));
    await G(() => window.__app.surface.debugInside(0, 1.5, 0)); await sleep(1200); await page.screenshot({ path: `${out}v74-${tag}-club-stage.png` });
    ok('gateRemembered', await G(() => localStorage.getItem('ssx.adult') === '1'));
    await G(() => { window.__app.game.setFlag?.('vip'); window.__app.surface.world.openVip(); });
    await G(() => window.__app.surface.debugInside(7.6, -4.4, 0)); ok('privateLabel', await wait(() => /Dance · 50 cr/.test(document.getElementById('driveBtn').textContent), 4000));
    const c1 = await G(() => window.__app.game.progress.credits);
    await act(); ok('privateDance', await wait(c => window.__app.game.progress.credits === c - 50 && document.body.classList.contains('cinebars'), 4000, c1));
    await sleep(1500); await page.screenshot({ path: `${out}v74-${tag}-club-vip.png` });
    // BUGS-v7.3 #2: facing Ines across the VIP room with the partition behind you, the camera stays in the room
    await G(() => window.__app.surface.debugInside(6.7, -3.4, -Math.PI / 2)); await sleep(1200);
    ok('vipCamClear', await G(() => { const c = window.__app.camera.position; return !window.__app.surface.world.camBlockedIn(c.x, c.y, c.z); }));
    await page.screenshot({ path: `${out}v74-${tag}-vip-ines.png` });
    const hp0 = await G(() => window.__app.game.info.hp); // (you can't be hurt indoors; restore() is unit-checked below)
    await G(() => window.__app.surface.debugInside(8.8, -5.7, 0)); ok('upstairsLabel', await wait(() => /Upstairs · 150/.test(document.getElementById('driveBtn').textContent), 4000));
    const c2 = await G(() => window.__app.game.progress.credits);
    await act(); ok('fadeToBlack', await wait(() => document.getElementById('fadeBlack').classList.contains('on'), 3000));
    ok('fadeOut', await wait(() => !document.getElementById('fadeBlack').classList.contains('on'), 8000));
    const after = await G(() => [window.__app.game.info.hp, window.__app.game.info.hpMax, window.__app.game.progress.credits]);
    ok('companionRestores', `${hp0} → ${after[0]}/${after[1]}, cr ${c2} → ${after[2]}`, after[0] === after[1] && after[2] === c2 - 150);
    await G(() => window.__app.surface.leaveBuilding()); await sleep(300);
    // ---- Titan methane skiff is amphibious, and its icon falls back from the vehicle spec
    const sk = await G(() => { const V = window.__app.surface.world?.VEHICLES || null; return null; });
    const spec = await page.evaluate(async () => { const m = await import('./world.js'); const v = m.VEHICLES.methane_skiff; return v && { amph: !!v.amphibious, icon: v.icon, cart: !!m.VEHICLES.v74cart, builder: typeof m.VEHICLE_BUILDERS.methane_skiff }; });
    ok('skiffAmphibious', JSON.stringify(spec), spec?.amph && !!spec.icon && spec.cart && spec.builder === 'function');
    ok('restoreUnit', await G(() => { const g = window.__app.game; g.hurtPlayer(90); const a = g.info.hp; g.restore(); return `${a} → ${g.info.hp}`; }), await G(() => window.__app.game.info.hp === window.__app.game.info.hpMax));
    ok('controlsListRolls', await G(() => /Barrel roll/i.test(document.getElementById('ctlPanel').textContent)));
    ok('swRace', await G(async () => { const t = await (await fetch('sw.js?x=' + Date.now())).text(); return /race\.js/.test(t) && /'titan'/.test(t) && /planets\//.test(t) && /BUILD = 1/.test(t); }));
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('errors'); R.basicWarn = warns.slice(0, 2); if (warns.length) bad.push('basicWarning');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
