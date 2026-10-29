// v7.5 test: Mars job loop (mars/jobs.js). Land on Mars, open the ☰ Jobs panel (taps), run TAXI (get in the rover,
// pick a fare up, drop them in another district), PARAMEDIC (reach a downed colonist, stabilise with the on-screen
// button, load, drive to a clinic) and VIGILANTE (find the mark, shoot them through world.hitWorld), each one
// levelling up (setDone(type, 4) + one real completion), persistence, the SSX.jobs API, 44px targets, no console errors.
// BASE=http://localhost:8862/ BR=webkit DEV="iPhone 14" OUT=/tmp/jobs/ node test-jobs.js   (DEV=desktop for 1366x768)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8862/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(300); };
  const shot = async p => { try { await page.screenshot({ path: p, timeout: 120000 }); R.shots = (R.shots || []).concat(p); } catch (e) { R.shotFail = (R.shotFail || []).concat(p); } };
  const J = () => G(() => window.SSX.jobs.active());
  const goal = () => G(() => window.SSX.jobs.debug.goto());
  const C = () => G(() => window.__app.game.progress.credits);
  const enterRover = async () => {
    if (await G(() => window.__app.surface.info.driving)) return true;
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await sleep(600); await G(() => window.__app.surface.interact());
    return wait(() => window.__app.surface.info.driving, 8000);
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); });
    ok('api', await G(() => ['start', 'stop', 'level', 'stats', 'on'].every(k => typeof window.SSX?.jobs?.[k] === 'function')));
    ok('menuItem', await G(() => !!document.getElementById('rmJobs')));
    ok('offMarsRefuses', await G(() => window.SSX.jobs.start('taxi').ok === false));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.jobs.debug.reset(); window.__app.surface.world.setWanted(0); window.__evs = []; window.SSX.jobs.on(e => { if (e.type !== 'change') window.__evs.push(e.type + ':' + e.job); }); });

    // ---- panel via ☰ menu (taps)
    await tapSel('#menuBtn'); await sleep(400);
    await tapSel('#rmJobs');
    ok('panelOpen', await wait(() => document.getElementById('jobPanel').classList.contains('show'), 4000));
    const tg = await G(() => [...document.querySelectorAll('#jobPanel button')].map(b => b.getBoundingClientRect().height)); ok('panelTargets44', Math.min(...tg), Math.min(...tg) >= 44);
    const sty = await G(() => { const s = getComputedStyle(document.querySelector('#jobPanel button')); return s.backgroundColor + '|' + s.color; }); ok('highContrast', sty, sty === 'rgb(0, 0, 0)|rgb(255, 255, 255)');
    await shot(`${out}jobs-${tag}-panel.png`);

    // ---- TAXI: start from the panel, real pickup + drop through the tick
    ok('roverIn', await enterRover());
    if (!(await G(() => document.getElementById('jobPanel').classList.contains('show')))) { await G(() => window.SSX.jobs.open()); await sleep(300); }
    await tapSel('#jobPanel button[data-job="taxi"]');
    ok('taxiStarted', (await J())?.type, (await J())?.stage === 'pickup');
    // v7.5.5 (hud/hudx.js): the job folds into the one mission card (#hxJob) with one 🏳️ quit (#hxQuit); without hudx the old bar shows
    const STOP = await G(() => document.body.classList.contains('hudx') ? '#hxQuit' : '#jobStop');
    ok('hudShown', await wait(() => getComputedStyle(document.getElementById(document.body.classList.contains('hudx') ? 'hxJob' : 'jobHud')).display !== 'none', 10000));
    const hs = await center(STOP); ok('hudStop44', hs?.h, hs?.h >= 44);
    R.hud = await G(() => document.getElementById('jobHud').innerText.replace(/\n/g, ' | '));
    await G(() => window.SSX.jobs.debug.setDone('taxi', 4));
    await goal(); ok('taxiPickedUp', await wait(() => window.SSX.jobs.active()?.stage === 'drop', 8000));
    await shot(`${out}jobs-${tag}-taxi.png`);
    const c0 = await C();
    await goal(); ok('taxiDone', await wait(() => window.SSX.jobs.stats().taxi.done === 5, 8000));
    ok('taxiPaid', (await C()) - c0, (await C()) > c0);
    ok('taxiL2', await G(() => window.SSX.jobs.level('taxi')), (await G(() => window.SSX.jobs.level('taxi'))) === 2);
    ok('taxiNextFare', (await J())?.stage, (await J())?.stage === 'pickup' && (await J())?.level === 2);
    await tapSel(STOP); ok('taxiStopped', (await J()) === null);

    // ---- vehicle toggle (in any vehicle with no job)
    ok('vehicleToggle', await wait(() => { const b = document.getElementById('jobAct'); return getComputedStyle(b).display !== 'none' && /Taxi duty/.test(b.textContent); }, 4000));
    const ab = await center('#jobAct'); ok('actBtn44', ab?.h, ab?.h >= 44);
    await tapSel('#jobAct'); ok('toggleStarts', (await J())?.type, (await J())?.type === 'taxi');
    if (desk) { await page.keyboard.press('KeyJ'); ok('keyJ', await wait(() => document.getElementById('jobPanel').classList.contains('show'), 2000)); await page.keyboard.press('KeyJ'); }
    await G(() => window.SSX.jobs.stop());

    // ---- PARAMEDIC: reach, get out, tap Stabilise, back in, clinic
    await G(() => window.SSX.jobs.debug.setDone('paramedic', 4));
    ok('medStarted', (await G(() => window.SSX.jobs.start('paramedic')))?.ok);
    await goal(); ok('medReached', await wait(() => window.SSX.jobs.active()?.stage === 'stabilise', 8000));
    await G(() => { const s = window.__app.surface; s.interact(); }); await sleep(500);
    await G(() => { const s = window.__app.surface, t = window.SSX.jobs.active().target, c = s.info.colony; s.debugPlace(c.x + t.x + 1.2, c.z + t.z + 0.8, 0); }); await sleep(500);
    ok('stabBtn', await wait(() => /Stabilise/.test(document.getElementById('jobAct').textContent) && getComputedStyle(document.getElementById('jobAct')).display !== 'none', 5000));
    await shot(`${out}jobs-${tag}-paramedic.png`);
    for (let k = 0; k < 8 && (await J())?.stage === 'stabilise'; k++) await tapSel('#jobAct');
    ok('medStable', (await J())?.stage, (await J())?.stage === 'load');
    ok('roverBack', await enterRover());
    ok('medLoaded', await wait(() => window.SSX.jobs.active()?.stage === 'transport', 8000));
    await goal(); ok('medDone', await wait(() => window.SSX.jobs.stats().paramedic.done === 5, 8000));
    ok('medL2', await G(() => window.SSX.jobs.level('paramedic')) === 2);
    await G(() => window.SSX.jobs.stop());

    // ---- PARAMEDIC from the seat (v7.5.3, Collin: stuck in the rover at 'Stabilise Tilly 0/3 · 2 m S'): far = hint,
    // within 6 m in the rover = G (desktop) / the black-white button (touch) stabilises; then straight to the clinic
    if (!(await G(() => window.__app.surface.info.driving))) ok('roverSeat', await enterRover());
    ok('med2Started', (await G(() => window.SSX.jobs.start('paramedic')))?.ok);
    await goal(); ok('med2Reached', await wait(() => window.SSX.jobs.active()?.stage === 'stabilise', 8000));
    await G(() => { const s = window.__app.surface, t = window.SSX.jobs.active().target, c = s.info.colony; s.debugMove(c.x + t.x + 18, c.z + t.z, 0); }); await sleep(500);
    ok('med2FarHint', await G(() => document.getElementById('jobHud').textContent + ' | ' + document.getElementById('jobAct').textContent),
      await wait(() => /Get close to .* and (press G|tap Stabilise)/.test(document.getElementById('jobHud').textContent) && /Get close/.test(document.getElementById('jobAct').textContent), 4000));
    await G(() => { const s = window.__app.surface, t = window.SSX.jobs.active().target, c = s.info.colony; s.debugMove(c.x + t.x + 2, c.z + t.z - 2, 0); }); await sleep(500);
    ok('med2InCar', await G(() => window.__app.surface.info.driving));
    ok('med2Btn', await G(() => document.getElementById('jobAct').textContent), await wait(() => /Stabilise 0\//.test(document.getElementById('jobAct').textContent) && getComputedStyle(document.getElementById('jobAct')).display !== 'none', 4000));
    const sty2 = await G(() => { const c = getComputedStyle(document.getElementById('jobAct')); return c.backgroundColor + '/' + c.color; }); ok('med2BlackWhite', sty2, /rgb\(0, 0, 0\)\/rgb\(255, 255, 255\)/.test(sty2));
    await shot(`${out}jobs-${tag}-paramedic-seat.png`);
    for (let k = 0; k < 8 && (await J())?.stage === 'stabilise'; k++) { if (desk) { await page.keyboard.press('KeyG'); await sleep(250); } else await tapSel('#jobAct'); }
    ok('med2StableFromSeat', (await J())?.stage, await wait(() => ['load', 'transport'].includes(window.SSX.jobs.active()?.stage), 3000));
    ok('med2Loaded', await wait(() => window.SSX.jobs.active()?.stage === 'transport', 8000));
    await goal(); ok('med2Done', await wait(() => window.SSX.jobs.stats().paramedic.done === 6, 8000));
    await G(() => window.SSX.jobs.stop());

    // ---- VIGILANTE: find the mark, shoot through world.hitWorld (patched), get paid without stars
    await G(() => { window.SSX.jobs.debug.setDone('vigilante', 4); window.__app.surface.interact(); });
    ok('vigStarted', (await G(() => window.SSX.jobs.start('vigilante')))?.ok);
    await goal(); ok('vigTakedown', await wait(() => window.SSX.jobs.active()?.stage === 'takedown', 8000));
    ok('autoAim', await G(() => window.__app.surface.world.targets().some(t => t.kind === 'bounty')));
    const v0 = await C();
    const shots = await G(() => { const s = window.__app.surface, w = s.world, i = s.info; let n = 0; for (let k = 0; k < 30 && window.SSX.jobs.active()?.stage === 'takedown'; k++) { const tg = w.targets().find(t => t.kind === 'bounty'); if (!tg) break; w.shotFired(); if (w.hitWorld({ x: i.x, y: tg.y, z: i.z }, { x: tg.x, y: tg.y, z: tg.z }, { dmg: 1.5 })) n++; } return n; });
    R.vigShots = shots;
    ok('vigDone', await wait(() => window.SSX.jobs.stats().vigilante.done === 5, 6000));
    ok('vigPaid', (await C()) - v0, (await C()) > v0);
    ok('vigNoStars', await G(() => window.__app.surface.world.wanted), (await G(() => window.__app.surface.world.wanted)) === 0);
    ok('vigL2', await G(() => window.SSX.jobs.level('vigilante')) === 2);
    await G(() => window.SSX.jobs.stop());
    await G(() => window.__app.surface.world.setWanted(3)); ok('vigRefusesWanted', await G(() => window.SSX.jobs.start('vigilante').ok === false)); await G(() => window.__app.surface.world.setWanted(0));

    // ---- persistence + events
    const st = await G(() => window.SSX.jobs.stats()); R.stats = JSON.stringify({ taxi: st.taxi.level, med: st.paramedic.level, vig: st.vigilante.level, earned: st.earned });
    ok('persisted', await G(() => { const s = JSON.parse(localStorage.getItem('ssx.jobs.v1')); return s.taxi.done === 5 && s.paramedic.done === 6 && s.vigilante.done === 5; }));
    ok('flags', await G(() => ['taxi', 'paramedic', 'vigilante'].every(t => window.__app.game.flag(`jobs:${t}:L2`))));
    const evs = await G(() => window.__evs); R.events = [...new Set(evs)].join(',');
    ok('events', ['start:taxi', 'complete:taxi', 'levelup:taxi', 'levelup:paramedic', 'levelup:vigilante', 'stop:taxi'].every(e => evs.includes(e)));
    // HUD screenshot with a live run
    await G(() => window.SSX.jobs.start('vigilante')); await sleep(1500);
    await shot(`${out}jobs-${tag}-hud.png`);
    await G(() => window.SSX.jobs.stop());
  } catch (e) { R.exception = String(e && e.stack || e); bad.push('exception'); }
  R.errors = errors.slice(0, 10); if (errors.length) bad.push('consoleErrors');
  R.bad = bad; R.pass = !bad.length;
  console.log(JSON.stringify(R, null, 1));
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
