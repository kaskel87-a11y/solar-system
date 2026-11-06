// v7.5.74 sandworm: aim pays. Real bullet segments through world.hitWorld with a rifle bolt (dmg 1.1, the Plasma blaster):
// shots-to-kill for accurate fire (gill sacs x3, a shot on the charging plume head stuns, the open maw x4) vs careless fire
// on the armoured body (a small chip). All three phases, the silo charge, Tully's lines and the 1,500 cr + 150 ⭐ + Worm Tooth
// payout stay. Shots: a direct sac hit, the head-shot stun, the kill.
// BASE=http://127.0.0.1:8931/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/tune/ node tests/test-sandworm-aim.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8931/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/tune/', desk = DEV === 'desktop';
const noAudio = (process.env.NOAUDIO || ((process.env.BR || '') === 'webkit' ? '1' : '0')) === '1'; // headless WebKit has no audio device
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  if (noAudio) await page.addInitScript(() => { try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (e) { /* */ } });
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); };
  const shot = async n => { const p = `${out}sandworm-aim-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const St = () => G(() => window.SSX.sandworm.status());
  // one rifle bolt through a point (sac i / maw / the charging head / a body segment), the way game.js calls world.hitWorld
  const bolt = (which, i = 0) => G(([which, i]) => { const A = window.SSX.sandworm.debug, W = A.weak(); const t = which === 'sac' ? W.sacs[i] : which === 'maw' ? W.maw : which === 'head' ? A.chargeHead() : W.segs[i];
    if (!t) return null; const w = window.__app.surface.world, y = t.y;
    return w.hitWorld({ x: t.x - 6, y: y + 0.05, z: t.z - 6 }, { x: t.x + 6, y: y - 0.05, z: t.z + 6 }, { dmg: 1.1 }); }, [which, i]);
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.sandworm && !!window.SSX?.farm, 20000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.()); await sleep(300);
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 30000; g.progress.xp = 500; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.harvest?.debug?.reset?.();
      window.SSX.sandworm.debug.reset(); window.SSX.sandworm.debug.noRandom(true); });
    await G(() => { const p = window.SSX.farm.places().find(q => q.id === 'farm'); window.__app.surface.debugMove(p.x, p.z + 12, 0); });
    for (const a of ['buy', 'buildDome']) { await G(a => window.SSX.farm[a](), a); await sleep(400); }
    for (let i = 0; i < 6; i++) { await G(() => window.SSX.farm.addRack()); await sleep(300); }
    await G(() => { const F = window.SSX.farm; F.refill('water'); F.refill('power'); for (let i = 0; i < 6; i++) F.plant(i, 'algae'); F.skip(7); });
    ok('tune', await G(() => window.SSX.sandworm.TUNE), await G(() => { const T = window.SSX.sandworm.TUNE; return T.crit.sac >= 3 && T.crit.maw >= 4 && T.chip < 0.2 && T.surfacings === 3 && T.sacs === 4; }));
    // ---- careless: plinking the armoured body ----
    await G(() => { window.SSX.sandworm.debug.ag(); window.SSX.sandworm.spawn(); window.SSX.sandworm.debug.hold(); window.SSX.sandworm.debug.phase(2); window.SSX.sandworm.debug.hold(); });
    await sleep(1200); await fr(6);
    let body = 0; const sac0 = (await St()).sacs[0];
    for (let k = 0; k < 120 && (await St()).sacs.filter(h => h > 0).length === 4; k++) { const segs = (await G(() => window.SSX.sandworm.debug.weak().segs.length)); if (await bolt('seg', Math.max(0, segs - 3))) body++; }
    ok('carelessSlow', { bodyShotsForOneSac: body, sac0 }, body >= 30);
    await G(() => window.SSX.sandworm.debug.end('away')); await sleep(1800);
    // ---- accurate: sacs, the charging head, the open maw ----
    await G(() => { window.SSX.sandworm.debug.ag(); window.SSX.sandworm.spawn(); window.SSX.sandworm.debug.hold(); });
    await fr(4); await sleep(300);
    let plume = 0; for (let k = 0; k < 20 && (await St()).phase === 1; k++) { if (await G(() => { const W = window.SSX.sandworm.debug.weak(); const t = W.plume; if (!t || window.SSX.sandworm.status().phase !== 1) return false; return window.__app.surface.world.hitWorld({ x: t.x - 6, y: t.y, z: t.z - 6 }, { x: t.x + 6, y: t.y, z: t.z + 6 }, { dmg: 1.1 }); })) plume++; await sleep(1700); await G(() => window.SSX.sandworm.debug.hold()); }
    ok('phase1', { plume }, (await St()).phase === 2 && plume <= 8);
    await G(() => window.SSX.sandworm.debug.hold()); await sleep(1200); await fr(6);
    let sacShots = 0; const t0 = Date.now(); let shotTaken = false;
    for (let i = 0; i < 4; i++) for (let k = 0; k < 6 && (await St()).sacs[i] > 0; k++) { if (await bolt('sac', i)) sacShots++; if (!shotTaken) { shotTaken = true; await fr(3); await shot('crit'); ok('critLine', (await St()).caption, /Direct hit/.test((await St()).caption)); } }
    ok('sacs', { sacShots }, (await St()).phase === 3 && sacShots === 8);
    ok('phase3', await wait(() => !!window.SSX.sandworm.debug.charge(), 4000));
    await G(() => { const c = window.SSX.sandworm.debug.charge(); window.__app.surface.debugMove(c.x, c.z + 16, 0); }); await fr(3);
    let headShots = 0; for (let k = 0; k < 10 && !((await St()).stun > 0); k++) if (await bolt('head')) headShots++;
    const s1 = await St(); ok('headStun', { headShots, stun: s1.stun, cap: s1.caption }, s1.stun > 0 && headShots === 4 && /head/i.test(s1.caption));
    await fr(4); await sleep(400); await shot('stun');
    const c0 = await G(() => window.__app.game.progress.credits), x0 = await G(() => window.__app.game.progress.xp);
    let mawShots = 0; for (let k = 0; k < 10 && !(await St()).over; k++) if (await bolt('maw')) mawShots++;
    await sleep(350); await shot('kill');
    const s2 = await St();
    ok('mawKill', { mawShots, over: s2.over }, s2.over === 'win' && mawShots === 5);
    ok('payout', { cr: (await G(() => window.__app.game.progress.credits)) - c0, xp: (await G(() => window.__app.game.progress.xp)) - x0, teeth: s2.teeth, cap: s2.caption },
      (await G(() => window.__app.game.progress.credits)) - c0 === 1500 && (await G(() => window.__app.game.progress.xp)) - x0 === 150 && s2.teeth === 1 && /Hell of a fertilizer/.test(s2.caption));
    R.accurate = { plume, sacShots, headShots, mawShots, total: plume + sacShots + headShots + mawShots, wallS: Math.round((Date.now() - t0) / 100) / 10 };
    ok('accurateVsCareless', { accurate: R.accurate.total, carelessOneSac: body }, R.accurate.total <= 25 && body > 3 * (sacShots / 4) * 4);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
