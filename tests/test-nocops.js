// v7.5.74 no ordinary ColSec at Red Static Gulch (mars/nocops.js -> window.SSX.copFree, read by world.js, mars/pursuit.js,
// mars/bribes.js, modes/raids.js). Proves: (1) a cop response still works elsewhere; (2) a chase led into the gulch: pursuit
// rovers drop, core units turn back and never enter, no shots land, no bust, and the stars stay; (3) heat raised AT the gulch
// (grow-op heat via SSX.pursuit.addHeat + a crime) brings no dispatch; (4) a forced spawn at the gulch lands outside it;
// (5) a ColSec raid there is refused unless it's a scripted gulch raid; the farm2 drone sweep still starts; (6) old heat after a
// reload brings nobody to the gulch; (7) leave the gulch with the heat and ColSec comes again. No console errors.
// BASE=http://127.0.0.1:8931/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/tune/ node tests/test-nocops.js
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
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const shot = async n => { const p = `${out}nocops-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const land = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await wait(() => !!window.SSX?.copFree && !!window.SSX?.pursuit && !!window.SSX?.farm2, 20000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    const l = await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.onboard?.skip?.(); const g = window.__app.game; g.debug?.calm?.(true); g.save(); }); await sleep(300); return l;
  };
  const Z = () => G(() => window.SSX.copFree.zone());
  const moveTo = (dx, dz) => G(([dx, dz]) => { const z = window.SSX.copFree.zone(); window.__app.surface.debugMove(z.x + dx, z.z + dz, 0); }, [dx, dz]);
  const heal = () => G(() => { try { const H = window.__app.game.debug?.H?.(); if (H) { H.hp = H.max; H.shield = H.smax; } } catch (e) { /* */ } });
  // sample for `sec` seconds: core units + pursuit units inside the zone, totals, stars, hp, downs
  const watch = async (sec, keep) => { const r = { inside: 0, core: 0, rovers: 0, coreMax: 0, roversMax: 0, stars: [], hpLost: 0, gulch: 0, n: 0 };
    for (let i = 0; i < sec * 2; i++) { const s = await G(keep => { const w = window.__app.surface.world, z = window.SSX.copFree.zone(), H = window.__app.game.debug?.H?.(); if (keep && w.wanted !== keep) w.setWanted(keep, 'debug');
      const core = w.securityList(), pu = window.SSX.pursuit.units().filter(u => u.own), all = [...core, ...pu];
      return { inside: all.filter(u => Math.hypot(u.x - z.x, u.z - z.z) < z.r).length, core: core.length, rovers: pu.length, stars: w.wanted, hp: H ? H.hp + H.shield : 0, gulch: window.SSX.pursuit.gulch(), here: window.SSX.copFree.here(), down: window.__app.game.isDown() }; }, keep || 0);
      if (i === 0) r.hp0 = s.hp; r.hpLost = Math.max(r.hpLost, r.hp0 - s.hp); r.inside += s.inside; r.core = s.core; r.rovers = s.rovers; r.coreMax = Math.max(r.coreMax, s.core); r.roversMax = Math.max(r.roversMax, s.rovers);
      r.stars.push(s.stars); r.gulch += s.gulch && s.here ? 1 : 0; r.down = r.down || s.down; r.n++; await sleep(500); }
    r.starsEnd = r.stars[r.stars.length - 1]; r.stars = [...new Set(r.stars)]; return r; };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3, 120000); await G(() => localStorage.clear());
    ok('landed', await land());
    const z = await Z(); ok('zone', z, !!z && z.r >= 40 && /Red Static Gulch/.test(z.name));
    ok('colonyOutside', await G(() => { const c = window.__app.surface.info.colony; return !window.SSX.copFree(c.x, c.z); }));
    // (1) control: wanted well away from the gulch -> ColSec comes
    await moveTo(0, -105); await G(() => { window.SSX.copFree.reset(); window.SSX.pursuit.debug.los(true); window.__app.surface.world.setWanted(3, 'debug'); });
    ok('copsElsewhere', await wait(() => window.__app.surface.world.securityList().length > 0 && window.SSX.pursuit.units().length > 0, 25000), await G(() => ({ core: window.__app.surface.world.securityList().length, rovers: window.SSX.pursuit.units().length })));
    await heal();
    // (2) lead the chase into the gulch
    await sleep(3000); R.chaseFrom = await G(() => { const w = window.__app.surface.world, P = window.__app.surface.info; return w.securityList().map(u => Math.round(Math.hypot(u.x - P.x, u.z - P.z))); });
    await moveTo(0, -55);
    const chase = await watch(8, 3); ok('chaseHeldOut', chase, chase.coreMax > 0 && chase.inside === 0 && chase.rovers === 0 && chase.starsEnd === 3 && chase.hpLost === 0 && !chase.down && chase.gulch >= chase.n - 1);
    ok('bustHeld', await G(() => window.__app.surface.world.debug.bustT()), (await G(() => window.__app.surface.world.debug.bustT())) === 0);
    await G(() => { const p = window.SSX.pursuit; p.debug.los(null); }); await sleep(500);
    const hud = await G(() => { const e = document.getElementById(document.body.classList.contains('hxSlim') ? 'hxStat' : 'puHud'); return e ? e.textContent : ''; });
    ok('hudChip', hud, /GULCH/i.test(hud));
    await shot('chase');
    // (3) heat raised at the gulch: grow-op heat + a crime -> no dispatch at all
    await G(() => { window.__app.surface.world.setWanted(0, 'debug'); }); await sleep(2500);
    await G(() => { window.SSX.copFree.reset(); window.SSX.pursuit.addHeat(1, 'grow op'); window.__app.surface.world.crime(2, 'test crime at the gulch'); });
    const heat = await watch(8); ok('heatAtGulch', heat, heat.starsEnd >= 1 && heat.inside === 0 && heat.rovers === 0 && heat.roversMax === 0 && heat.hpLost === 0);
    R.held = await G(() => window.SSX.copFree.stats()); ok('heldCounted', R.held, R.held.dispatch > 0 && R.held.pursuit > 0);
    // (4) a forced spawn aimed at the gulch lands outside it
    const forced = await G(() => { const w = window.__app.surface.world, z = window.SSX.copFree.zone(); w.debug.spawnSecurity('officer', { x: z.x + 5, z: z.z + 5 }); const l = w.securityList(); const u = l[l.length - 1]; return u ? Math.hypot(u.x - z.x, u.z - z.z) - z.r : null; });
    ok('forcedOutside', forced, forced != null && forced >= 0);
    // (5) raids: ColSec refused, scripted gulch raid allowed; the farm2 drone sweep still runs
    const rd = await G(() => { const z = window.SSX.copFree.zone(), Rd = window.SSX.raids; if (!Rd?.start) return { none: true };
      const a = Rd.start({ id: 'nc1', pos: { x: z.x, z: z.z }, attackers: 'colsec', waves: 1, wanted: false }); const b = Rd.start({ id: 'nc2', pos: { x: z.x, z: z.z }, attackers: 'colsec', waves: 1, wanted: false, scripted: 'gulch' }); try { Rd.stop?.('nc2'); } catch (e) { /* */ } return { a, b }; });
    ok('raidHeld', rd, rd.none || (rd.a.ok === false && rd.b.ok === true));
    const sweep = await G(() => { const r = window.SSX.farm2.debug.raid(); const s = window.SSX.farm2.status().raid; window.SSX.farm2.debug.setRaidT(0.01); return { r, s }; });
    ok('droneSweepStays', sweep, !!sweep.s && sweep.s.t > 0); await sleep(600);
    // (6) reload with old heat, back at the gulch
    await page.reload(); await wait(() => window.__frames > 3, 120000); ok('relanded', await land());
    await moveTo(3, 2); await G(() => window.__app.surface.world.setWanted(4, 'debug'));
    const old = await watch(8); ok('oldHeatHeldOut', old, old.starsEnd === 4 && old.inside === 0 && old.coreMax === 0 && old.roversMax === 0 && old.hpLost === 0);
    // (7) leave the gulch with the heat: ColSec comes again (wanted wasn't cleared or broken)
    await G(() => window.SSX.pursuit.debug.los(true)); await moveTo(0, -260);
    ok('copsAgainOutside', await wait(() => window.__app.surface.world.securityList().length > 0 && window.SSX.pursuit.units().length > 0 && window.__app.surface.world.wanted >= 3, 25000));
    await G(() => { window.SSX.pursuit.debug.los(null); window.__app.surface.world.setWanted(0, 'debug'); });
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
