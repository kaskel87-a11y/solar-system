// v7.5.3 control mode (Collin): ⚙️ Settings toggle + key O switch Keyboard only <-> Keyboard + Mouse, toast, localStorage,
// Keyboard only: no pointer capture, world mouse clicks ignored, arrows turn the camera (no strafing), F fires at the nearest
// target in front (not one off to the side), menu opens with focus and Tab walks it, the mode survives a reload.
// BASE=http://localhost:8846/ OUT=/tmp/ctl/ node tests/test-controlmode.js   (desktop chromium 1366x768)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8846/', BR = process.env.BR || 'chromium';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const click = async sel => { const b = await G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel); if (!b) throw new Error('no ' + sel); await page.mouse.click(b.x, b.y); await sleep(300); };
  const shot = async p => { try { await page.screenshot({ path: p, timeout: 120000 }); R.shots = (R.shots || []).concat(p); } catch (e) { R.shotFail = (R.shotFail || []).concat(p); } };
  const toastTxt = () => G(() => { const t = document.getElementById('toast'); return t && t.classList.contains('on') ? t.textContent : ''; });
  const land = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => !!window.__app, 60000);
    await G(() => localStorage.clear()); await page.goto(base + '?t=' + Date.now()); await land();
    ok('api', await G(() => window.SSX?.controls?.getMode?.()), (await G(() => window.SSX?.controls?.getMode?.())) === 'kbm');
    // pointer-lock spy (headless can't really lock; we count requests)
    await G(() => { const el = window.__app.renderer.domElement; window.__locks = 0; el.requestPointerLock = () => { window.__locks++; return Promise.resolve(); }; });

    // ---- ⚙️ Settings toggle (mouse click)
    await click('#menuBtn'); await sleep(300); await click('#settingsBtn'); await sleep(500);
    ok('settingsRow', await G(() => document.getElementById('setCtl')?.textContent), (await G(() => document.getElementById('setCtl')?.textContent)) === 'Keyboard + Mouse');
    await click('#setCtl'); await sleep(300);
    ok('settingsFlips', await G(() => document.getElementById('setCtl')?.textContent), (await G(() => document.getElementById('setCtl')?.textContent)) === 'Keyboard only');
    ok('toastKb', await toastTxt(), /Keyboard only/.test(await toastTxt()));
    ok('saved', await G(() => localStorage.getItem('ssx.controlMode')), (await G(() => localStorage.getItem('ssx.controlMode'))) === 'kb');
    ok('bodyClass', await G(() => document.body.classList.contains('kbonly')));
    await G(() => document.getElementById('setCtl').closest('.sw').scrollIntoView({ block: 'center' })); await sleep(300);
    await shot(`${out}controlmode-desktop-settings.png`);
    // ---- hotkey O (twice: back and forth), with the Settings panel closed
    await click('#logClose'); await sleep(300);
    await page.keyboard.press('KeyO'); await sleep(250);
    ok('hotkeyToKbm', await G(() => window.SSX.controls.getMode()), (await G(() => window.SSX.controls.getMode())) === 'kbm');
    ok('toastKbm', await toastTxt(), /Keyboard \+ Mouse/.test(await toastTxt()));
    await page.keyboard.press('KeyO'); await sleep(250);
    ok('hotkeyToKb', await G(() => window.SSX.controls.getMode()), (await G(() => window.SSX.controls.getMode())) === 'kb' && (await G(() => localStorage.getItem('ssx.controlMode'))) === 'kb');
    ok('menuKeyStillM', true); // M stays the menu (checked below)

    // ---- mouse ignored: canvas clicks don't request pointer lock or pop facts; mouse moves don't turn the camera
    const y0 = await G(() => window.__app.surface.info.viewYaw);
    await page.mouse.move(683, 500); await page.mouse.down(); await page.mouse.move(900, 450, { steps: 8 }); await page.mouse.up(); await sleep(200);
    await page.mouse.click(683, 520); await sleep(300); await page.mouse.click(400, 600); await sleep(300);
    ok('noPointerLock', await G(() => window.__locks), (await G(() => window.__locks)) === 0 && !(await G(() => document.pointerLockElement)));
    ok('noFactPopup', await G(() => getComputedStyle(document.getElementById('fact-panel') || document.body).display), (await G(() => { const f = document.getElementById('fact-panel'); return !f || getComputedStyle(f).display === 'none'; })));
    const y1 = await G(() => window.__app.surface.info.viewYaw);
    ok('mouseNoLook', +(y1 - y0).toFixed(3), Math.abs(Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0))) < 0.05);

    // ---- arrows turn the camera, no strafe
    const p0 = await G(() => ({ x: window.__app.surface.info.x, z: window.__app.surface.info.z, y: window.__app.surface.info.viewYaw }));
    await page.keyboard.down('ArrowLeft'); await sleep(1500); await page.keyboard.up('ArrowLeft'); await sleep(100); // swiftshader under load runs a few fps; thresholds are frame-rate tolerant
    const p1 = await G(() => ({ x: window.__app.surface.info.x, z: window.__app.surface.info.z, y: window.__app.surface.info.viewYaw }));
    const dy = Math.atan2(Math.sin(p1.y - p0.y), Math.cos(p1.y - p0.y));
    ok('arrowTurns', +dy.toFixed(2), dy > 0.2); // left = yaw up
    ok('arrowNoStrafe', p0.x == null ? 'n/a' : +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2), p0.x == null || Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.15);
    // WASD still moves
    await page.keyboard.down('KeyW'); await sleep(1500); await page.keyboard.up('KeyW'); await sleep(100);
    const p2 = await G(() => ({ x: window.__app.surface.info.x, z: window.__app.surface.info.z }));
    ok('wMoves', p2.x == null ? 'n/a' : +Math.hypot(p2.x - p1.x, p2.z - p1.z).toFixed(2), p2.x == null || Math.hypot(p2.x - p1.x, p2.z - p1.z) > 0.3);

    // ---- F fires at the nearest target in front, not one off to the side
    await G(() => { const g = window.__app.game; g.setAliens?.(true); g.debug.spawn('hunter', 13, 0); g.debug.calm(true); }); await sleep(900);
    const hp0 = await G(() => window.__app.game.debug.agents().filter(a => a.src === 'debug').map(a => a.hp));
    for (let k = 0; k < 6; k++) { await page.keyboard.down('KeyF'); await sleep(400); await page.keyboard.up('KeyF'); await sleep(300); }
    const hp1 = await G(() => window.__app.game.debug.agents().filter(a => a.src === 'debug').map(a => a.hp));
    ok('fFiresFront', JSON.stringify({ hp0, hp1 }), hp0.length > 0 && (hp1.length < hp0.length || hp1.reduce((s, v) => s + v, 0) < hp0.reduce((s, v) => s + v, 0)));
    await G(() => { const g = window.__app.game; for (let k = 0; k < 20; k++) { const i = g.debug.agents().findIndex(a => a.src === 'debug'); if (i < 0) break; g.debug.kill(i, {}); } g.debug.spawn('hunter', 7, 1.25); g.debug.calm(true); }); await sleep(900);
    const s0 = await G(() => window.__app.game.debug.agents().filter(a => a.src === 'debug').map(a => ({ hp: a.hp, on: a.onScreen })));
    for (let k = 0; k < 4; k++) { await page.keyboard.down('KeyF'); await sleep(400); await page.keyboard.up('KeyF'); await sleep(300); }
    const s1 = await G(() => window.__app.game.debug.agents().filter(a => a.src === 'debug').map(a => a.hp));
    ok('sideNotLocked', JSON.stringify({ s0, s1 }), s0.length > 0 && s1.length === s0.length && s1[0] === s0[0].hp);
    await G(() => { const g = window.__app.game; for (let k = 0; k < 20; k++) { const i = g.debug.agents().findIndex(a => a.src === 'debug'); if (i < 0) break; g.debug.kill(i, {}); } });

    // ---- menus: M opens with focus inside, Tab walks the buttons, Enter works, still clickable
    await page.keyboard.press('KeyM'); await sleep(300);
    ok('menuOpens', await G(() => document.getElementById('roverMenu').classList.contains('show')));
    ok('menuFocus', await G(() => document.getElementById('roverMenu').contains(document.activeElement)));
    const f0 = await G(() => document.activeElement?.id || document.activeElement?.textContent);
    await page.keyboard.press('Tab'); await sleep(150);
    const f1 = await G(() => document.activeElement?.id || document.activeElement?.textContent);
    ok('tabWalks', JSON.stringify([f0, f1]), f0 !== f1 && (await G(() => document.getElementById('roverMenu').classList.contains('show'))));
    await G(() => document.getElementById('settingsBtn').focus()); await page.keyboard.press('Enter'); await sleep(400);
    ok('enterOpensSettings', await G(() => document.getElementById('logPanel').style.display === 'block' && !!document.getElementById('setCtl')));
    await click('#logClose'); await sleep(200);
    ok('menuClickable', await (async () => { await click('#menuBtn'); await sleep(300); const s = await G(() => document.getElementById('roverMenu').classList.contains('show')); await page.keyboard.press('KeyM'); return s; })());

    // ---- persists across a reload
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !!window.SSX?.controls, 120000);
    ok('persists', await G(() => window.SSX.controls.getMode()), (await G(() => window.SSX.controls.getMode())) === 'kb' && (await G(() => document.body.classList.contains('kbonly'))));
    await G(() => window.SSX.controls.setMode('kbm'));
    ok('backToKbm', await G(() => localStorage.getItem('ssx.controlMode')) === 'kbm');
  } catch (e) { R.crash = String(e.stack || e); bad.push('crash'); }
  ok('noErrors', errors.join(' | ').slice(0, 600), errors.length === 0);
  R.bad = bad; R.pass = bad.length === 0; console.log(JSON.stringify(R, null, 1));
  await browser.close(); process.exit(R.pass ? 0 : 1);
})();
