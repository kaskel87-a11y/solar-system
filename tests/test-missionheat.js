// v7.5.11: police ease off ~50% while a mission runs (mars/missionheat.js -> SSX.policeEase, read by world.js + mars/pursuit.js).
// Off a mission: ease 1, full heat gain, full dispatch, full search. On a vigilante shift (on foot): ease 0.5, half the heat
// gain, fewer units, a half-length search, the "Mission: police easing off" chip (black/white) while wanted, and the shift
// can be finished ON FOOT with stars up. After the shift: back to normal. No console errors.
// BASE=http://127.0.0.1:8911/ BR=webkit DEV="iPhone 14" OUT=/tmp/mh/ node tests/test-missionheat.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8911/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || './shots/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  // hold 3 stars for ~12 s (re-asserted, so evade/bust can't drop it) and keep the peak unit count
  const units = async () => { let best = { n: -1 }; for (let i = 0; i < 24; i++) { const r = await G(() => { const w = window.__app.surface.world; if (w.wanted !== 3) w.setWanted(3, 'debug'); try { window.__app.game.debug?.heal?.(); } catch (e) {} const u = window.SSX.pursuit.units(); return { n: u.length, core: u.filter(q => !q.own).length, own: u.filter(q => q.own).length, kinds: u.map(q => q.kind).sort().join(',') }; }); if (r.n > best.n) best = r; await sleep(500); } return best; };
  const heal = () => G(() => { try { window.__app.game.debug?.heal?.(); } catch (e) {} });
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('api', await wait(() => !!window.SSX?.missionHeat && typeof window.SSX.policeEase === 'function' && !!window.SSX.pursuit && !!window.SSX.jobs, 20000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.game.debug?.calm?.(true); window.__app.game.progress.credits = 5000; window.__app.game.save(); window.__app.surface.world.setWanted(0); window.__downs = []; window.SSX.on?.('game:down', d => window.__downs.push(d?.why || d?.reason || 'down')); });
    await sleep(600);
    // ---- off mission: normal ----
    R.off = await G(() => { const w = window.__app.surface.world; w.setWanted(0); w.setWanted(2, 'test crime'); const a = w.wanted; w.setWanted(0, 'debug'); return { ease: window.SSX.policeEase(), active: window.SSX.missionHeat.active(), gain0to2: a }; });
    ok('offNormal', R.off, R.off.ease === 1 && R.off.active === null && R.off.gain0to2 === 2);
    await G(() => { const P = window.SSX.pursuit; P.debug.setHeat(3); P.debug.los(true); });
    R.offUnits = await units(); R.offTier = await G(() => window.SSX.pursuit.tier());
    await G(() => { window.__app.surface.world.setWanted(3, 'debug'); window.SSX.pursuit.debug.los(false); }); await wait(() => !!window.SSX.pursuit.searching(), 6000);
    R.offSearch = await G(() => window.SSX.pursuit.searching()?.total);
    await G(() => { window.SSX.pursuit.debug.los(null); window.SSX.pursuit.debug.setHeat(0); }); await wait(() => window.SSX.pursuit.units().length === 0, 20000); await heal();
    R.offDowns = await G(() => window.__downs.length);
    await G(() => { try { window.SSX.consequences?.debug?.reset?.(); } catch (e) {} }); await wait(() => !window.__app.game.isDown(), 20000); await sleep(1500);
    await G(() => { try { window.SSX.consequences?.debug?.reset?.(); } catch (e) {} window.__downs = []; });
    // ---- on a vigilante shift, on foot ----
    await G(() => { window.SSX.jobs.debug.setDone('vigilante', 4); });
    ok('vigStarted', (await G(() => window.SSX.jobs.start('vigilante')))?.ok);
    ok('missionOn', await wait(() => window.SSX.missionHeat.active() === 'job' && window.SSX.policeEase() === 0.5, 5000));
    ok('onFoot', await G(() => !window.__app.surface.info.driving));
    R.on = await G(() => { const w = window.__app.surface.world; const r = {}; w.setWanted(2, 'test crime'); r.gain0to2 = w.wanted; w.setWanted(3, 'test crime'); r.gain1to3 = w.wanted; w.setWanted(w.wanted + 1, 'test crime'); r.plus1a = w.wanted; w.setWanted(w.wanted + 1, 'test crime'); r.plus1b = w.wanted; w.setWanted(0, 'debug'); return r; });
    ok('halfGain', R.on, R.on.gain0to2 === 1 && R.on.gain1to3 === 2 && R.on.plus1a === 2 && R.on.plus1b === 3);
    await G(() => { const P = window.SSX.pursuit; P.debug.setHeat(3); P.debug.los(true); });
    R.onUnits = await units(); R.onTier = await G(() => window.SSX.pursuit.tier()); R.onDowns = await G(() => window.__downs.length);
    ok('fewerUnits', { off: R.offUnits, on: R.onUnits, offTier: R.offTier, onTier: R.onTier }, R.onUnits.n <= R.offUnits.n && R.onTier.rovers < R.offTier.rovers);
    R.chip = await G(() => { const c = document.getElementById('mhChip'), cs = getComputedStyle(c), r = c.getBoundingClientRect(); return { show: cs.display !== 'none', t: c.textContent, bg: cs.backgroundColor, color: cs.color, r: [r.x, r.y, r.width, r.height].map(Math.round) }; });
    ok('chip', R.chip, R.chip.show && /police easing off/.test(R.chip.t) && R.chip.bg === 'rgb(0, 0, 0)' && R.chip.color === 'rgb(255, 255, 255)' && R.chip.r[0] >= 0 && R.chip.r[0] + R.chip.r[2] <= (await G(() => innerWidth)));
    await page.screenshot({ path: out + `missionheat-${tag}.png` });
    await G(() => { window.__app.surface.world.setWanted(3, 'debug'); window.SSX.pursuit.debug.los(false); }); await wait(() => !!window.SSX.pursuit.searching(), 6000);
    R.onSearch = await G(() => window.SSX.pursuit.searching()?.total);
    ok('fasterDecay', { off: R.offSearch, on: R.onSearch }, R.offSearch > 0 && Math.abs(R.onSearch - R.offSearch / 2) < 0.01);
    await G(() => window.SSX.pursuit.debug.los(true));
    // ---- finish the shift on foot with stars up ----
    await G(() => window.SSX.pursuit.debug.setHeat(1)); await sleep(300);
    await G(() => window.SSX.jobs.debug.goto()); ok('vigTakedown', await wait(() => window.SSX.jobs.active()?.stage === 'takedown', 10000));
    R.starsDuring = await G(() => window.__app.surface.world.wanted);
    const shots = await G(() => { const s = window.__app.surface, w = s.world, i = s.info; let n = 0; for (let k = 0; k < 30 && window.SSX.jobs.active()?.stage === 'takedown'; k++) { const tg = w.targets().find(t => t.kind === 'bounty'); if (!tg) break; if (w.hitWorld({ x: i.x, y: tg.y, z: i.z }, { x: tg.x, y: tg.y, z: tg.z }, { dmg: 1.5 })) n++; } return n; });
    R.vigShots = shots;
    ok('vigDoneOnFoot', await wait(() => window.SSX.jobs.stats().vigilante.done === 5, 8000));
    ok('starsWereUp', R.starsDuring, R.starsDuring >= 1);
    ok('notDown', await G(() => !window.__app.game.isDown()));
    await G(() => window.SSX.jobs.stop?.());
    ok('missionOff', await wait(() => window.SSX.missionHeat.active() === null && window.SSX.policeEase() === 1, 6000));
    ok('chipOff', await wait(() => getComputedStyle(document.getElementById('mhChip')).display === 'none', 4000));
    R.after = await G(() => { const w = window.__app.surface.world; w.setWanted(0, 'debug'); w.setWanted(2, 'test crime'); const a = w.wanted; w.setWanted(0, 'debug'); return a; });
    ok('afterNormal', R.after, R.after === 2);
  } catch (e) { bad.push('threw: ' + e.message); }
  const errs = errors.filter(e => !/favicon|404|net::ERR|THREE\.WebGLRenderer|GPU stall/.test(e)); ok('noErrors', errs, errs.length === 0);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS'); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
