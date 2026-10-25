// Ares Beltway highway crime (mars/beltway.js): shakedown at a real checkpoint, convoy hijack on a real traffic hauler,
// armored transport with crew split, night race via race.js; panel/dock/action taps, 44px contrast, no console errors.
// BASE=http://localhost:8876/ BR=webkit DEV="iPhone 14" OUT=/tmp/ node tests/test-beltway.js   (DEV=desktop for 1366x768; one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8876/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || '/tmp/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); };
  const shot = async p => { try { await page.screenshot({ path: p, timeout: 120000 }); R.shots = (R.shots || []).concat(p); } catch (e) { R.shotFail = (R.shotFail || []).concat(p); } };
  const A = () => G(() => window.SSX.beltway.active());
  const C = () => G(() => window.__app.game.progress.credits);
  const calm = () => G(() => { try { window.__app.game.debug.calm(true); const H = window.__app.game.debug.H(); if (H) H.hp = H.max; } catch (e) {} });
  const openPanel = async () => { if (desk) await page.keyboard.press('KeyO'); else if (await G(() => !!document.getElementById('dockBelt'))) await tapSel('#dockBelt'); else { await tapSel('#menuBtn'); await sleep(400); await tapSel('#rmBeltway'); } return wait(() => document.getElementById('beltPanel').classList.contains('show'), 4000); };
  const act = async () => { if (desk) { await page.keyboard.press('KeyI'); await sleep(300); } else await tapSel('#beltAct'); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('api', await G(() => ['start', 'stop', 'active', 'on', 'open', 'crew', 'isNight'].every(k => typeof window.SSX?.beltway?.[k] === 'function') && !!window.SSX.beltway.debug));
    ok('menuItem', await G(() => !!document.getElementById('rmBeltway')));
    ok('offMarsRefuses', await G(() => window.SSX.beltway.start('hijack').ok === false));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.beltway.debug.reset(); window.__app.surface.world.setWanted(0); window.__app.game.debug.credits?.(500); window.__evs = []; window.SSX.beltway.on(e => { if (e.type !== 'change') window.__evs.push(e.activity + ':' + e.type); }); });
    ok('highwayOnMain', await G(() => { const h = window.__app.surface.world.highway(); return h && h.checkpoints.length; }), (await G(() => window.__app.surface.world.highway()?.checkpoints.length)) === 4);
    R.docks = await G(() => document.querySelectorAll('#ssxDock').length); ok('noSecondDock', R.docks <= 1); // the dock belongs to turf.js (v7.5.3); we only attach to it
    if (!desk && R.docks) { const d = await center('#dockBelt'); ok('dockBtn', d && `${Math.round(d.w)}x${Math.round(d.h)}`, d && d.w >= 44 && d.h >= 44); }
    if (!R.docks) ok('noDockNoButton', await G(() => !document.getElementById('dockBelt')));
    // ---- panel
    ok('panelOpen', await openPanel());
    const tg = await G(() => [...document.querySelectorAll('#beltPanel button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)); ok('panelTargets44', Math.min(...tg), Math.min(...tg) >= 44);
    const sty = await G(() => { const s = getComputedStyle(document.querySelector('#beltPanel button[data-start]')); return s.backgroundColor + '|' + s.color; }); ok('highContrast', sty, sty === 'rgb(0, 0, 0)|rgb(255, 255, 255)');
    await shot(`${out}beltway-${tag}-panel.png`);
    // ---- shakedown (nearest real checkpoint), started from the panel
    await tapSel('#beltPanel button[data-start="shakedown"]');
    let a = await A(); ok('shakeStart', a?.checkpoint?.id, a?.type === 'shakedown' && !!a.checkpoint);
    await G(() => window.SSX.beltway.debug.toCheckpoint());
    ok('shakeLean', await wait(() => window.SSX.beltway.active()?.phase === 'lean' && document.getElementById('beltAct').classList.contains('show'), 15000));
    const ab = await center('#beltAct'); ok('actBtn44', ab && Math.round(ab.h), ab && ab.h >= 44);
    await shot(`${out}beltway-${tag}-shakedown.png`);
    let c0 = await C(); for (let k = 0; k < 3; k++) await act();
    ok('shakePaid', (await C()) - c0, (await C()) > c0 && (await A()) === null);
    R.shakeWanted = await G(() => window.__app.surface.world.wanted);
    await G(() => { window.SSX.beltway.debug.clearHeat(); }); await calm();
    // ---- convoy hijack on a live traffic hauler
    ok('hijackStart', await G(() => window.SSX.beltway.start('hijack').ok));
    await G(() => window.SSX.beltway.debug.toRoad(150));
    ok('haulerLocked', await wait(() => window.SSX.beltway.active()?.phase === 'chase', 60000));
    R.target = await G(() => window.SSX.beltway.debug.target()); ok('realTraffic', R.target?.traffic === true && R.target.kind === 'hauler');
    await sleep(700); await shot(`${out}beltway-${tag}-hijack-chase.png`); R.hudChase = await G(() => document.getElementById('beltHud').innerText.replace(/\n/g, ' | '));
    ok('hitDamages', await G(() => window.SSX.beltway.debug.hit(20)), (await G(() => window.SSX.beltway.active().hp)) < 100);
    await G(() => window.SSX.beltway.debug.disable()); ok('disabled', (await A())?.phase === 'grab');
    await G(() => window.SSX.beltway.debug.toTarget()); ok('grabBtn', await wait(() => /Grab/.test(document.getElementById('beltAct').textContent) && document.getElementById('beltAct').classList.contains('show'), 10000));
    await act(); ok('cargoLoaded', (await A())?.phase, (await A())?.phase === 'deliver');
    await G(() => window.SSX.beltway.debug.toFence());
    ok('fencePanel', await wait(() => window.SSX.beltway.active()?.phase === 'fence' && document.querySelector('#beltPanel.show button[data-fence]'), 20000));
    R.fenceOpts = await G(() => [...document.querySelectorAll('#beltPanel button[data-fence]')].map(b => b.dataset.fence).join(','));
    await shot(`${out}beltway-${tag}-fence.png`);
    const stash0 = await G(() => window.SSX.contraband?.stash?.().total ?? null); c0 = await C();
    await tapSel(R.fenceOpts.includes('stash') ? '#beltPanel button[data-fence="stash"]' : '#beltPanel button[data-fence="cash"]');
    const stash1 = await G(() => window.SSX.contraband?.stash?.().total ?? null);
    ok('fenced', `stash ${stash0}->${stash1} cr +${(await C()) - c0}`, (await A()) === null && (await C()) > c0 && (!R.fenceOpts.includes('stash') || stash1 > stash0));
    await G(() => window.SSX.beltway.debug.clearHeat());
    // ---- armored transport + crew split
    await G(() => window.SSX.beltway.setCrew('ivo', false));
    ok('armoredStart', await G(() => window.SSX.beltway.start('armored').ok));
    await G(() => window.SSX.beltway.debug.toRoad(260));
    ok('armoredLocked', await wait(() => window.SSX.beltway.active()?.phase === 'chase', 60000));
    await G(() => window.SSX.beltway.debug.disable());
    R.armoredWanted = await G(() => window.__app.surface.world.wanted); ok('highWanted', R.armoredWanted >= 3);
    await calm(); await G(() => window.SSX.beltway.debug.toTarget());
    ok('crackBtn', await wait(() => /Crack/.test(document.getElementById('beltAct').textContent), 10000));
    await act(); ok('looted', await wait(() => window.SSX.beltway.active()?.phase === 'escape', 15000));
    const sp = await G(() => window.SSX.beltway.split()); R.split = `${sp.gross} -> ${sp.crew.map(c => c.id + ':' + c.cut + '%').join(',')} mine ${sp.mine}`;
    ok('splitOk', sp.crew.length === 2 && sp.mine === 1200 - 180 - 120);
    c0 = await C(); await G(() => window.SSX.beltway.debug.clearHeat());
    ok('armoredPaid', await wait(() => window.SSX.beltway.active() === null, 5000) && (await C()) - c0 === sp.mine);
    await calm();
    // ---- night race
    await G(() => window.SSX.beltway.debug.setNight(false));
    ok('dayRefused', await G(() => window.SSX.beltway.start('race').ok === false));
    ok('panelOpen2', await openPanel()); await tapSel('#beltPanel button[data-dark]'); ok('nowNight', await G(() => window.SSX.beltway.isNight()));
    await tapSel('#beltPanel button[data-start="race"]');
    a = await A(); R.raceEngine = a?.engine; ok('raceStarted', a?.type === 'race');
    if (a?.engine === 'race.js') { ok('raceJs', await G(() => window.__race.state?.id === 'beltway-night-run')); await G(() => window.__race.skipCountdown()); await sleep(1500); }
    await shot(`${out}beltway-${tag}-race.png`);
    await G(() => window.SSX.beltway.debug.finishRace(true));
    ok('raceDone', (await A()) === null && (await G(() => window.SSX.beltway.stats().races)) === 1 && !(await G(() => window.__race?.state)));
    R.events = (await G(() => window.__evs)).join(' ');
    R.stats = JSON.stringify(await G(() => window.SSX.beltway.stats()));
  } catch (e) { R.exception = String(e.stack || e).slice(0, 600); bad.push('exception'); }
  R.errors = errors.slice(0, 8); if (errors.length) bad.push('consoleErrors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
