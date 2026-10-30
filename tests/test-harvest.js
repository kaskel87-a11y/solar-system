// Hands-on harvest (mars/harvest.js, SSX.harvest) at the Dustbowl Homestead: sickle swing via FIRE / 🌾 Cut (rack crop shrinks,
// pooled particles, sound), bale on your back, drop at the silo (banked into the farm silo), quick-cut combo, hire a hand (slow
// one-tap), buy the 4,000 cr harvester (double tap = one charge), drive it over racks (hopper fills), empty at the silo,
// Rust Pit refused, FPS, 0 console errors. BASE=http://127.0.0.1:8897/ BR=webkit DEV="iPhone 14" SHOTS_DIR=./shots/harvest/ node tests/test-harvest.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8897/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/harvest/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width, t: r.top, b: r.bottom, l: r.left, r: r.right }; }, sel);
  // tapSel waits (like a person would) until a button held by the sheet's settle window is tappable again
  // WebKit sends pointercancel (no tap) for a touch that lands right after a programmatic scroll, so when scrollIntoView moved the sheet we let it settle first
  const tapSel = async sel => { const moved = await G(s => { const e = document.querySelector(s); if (!e) return false; const ps = []; for (let p = e.parentElement; p; p = p.parentElement) ps.push([p, p.scrollTop]); e.scrollIntoView({ block: 'center' }); return ps.some(([p, t]) => p.scrollTop !== t); }, sel); await sleep(moved ? 1000 : 150); await wait(s => { const b = document.querySelector(s); return !b || !b.dataset.hold; }, 1500, sel); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
  // two taps in one frame: the same button twice, then whatever sits under that point now (a button that slid in after a re-render)
  const dbl = sel => G(([s, desk]) => { const b = document.querySelector(s); if (!b) return 'no ' + s; const r = b.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const fire = el => { if (!el) return; if (desk) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })); return; }
      const o = { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
    fire(b); fire(b); fire(document.elementFromPoint(x, y)?.closest('button')); return true; }, [sel, desk]);
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); };
  const St = () => G(() => window.SSX.farm.status());
  const cr = () => G(() => window.__app.game.progress.credits);
  const shown = () => G(() => document.getElementById('farmPanel').classList.contains('show'));
  const go = async (id, dz) => { await G(([id, dz]) => { const p = window.SSX.farm.places().find(q => q.id === id); window.__app.surface.debugMove(p.x, p.z + dz, 0); }, [id, dz]); await fr(4); };
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
  };
  const HS = () => G(() => window.SSX.harvest.status());
  // then: right after that FIRE, read the rack's crop depth and FIRE twice more ~0.5 s apart, all inside the page (no CDP gaps)
  const QUICK = `new Promise(res => { window.__d1 = window.__cropDepth(0); const f = () => window.__app.surface.game.fire(null), t0 = performance.now(); setTimeout(() => { f(); setTimeout(() => { f(); res([window.__d1, Math.round(performance.now() - t0)]); }, 520); }, 480); })`;
  const fire = async (o = {}) => { // the real FIRE button on phones (pointerdown), the game's fire() (mouse / F key path) on desktop
    const b = desk ? null : await center('#fireBtn');
    const q = o.then ? QUICK : 'null';
    const r = b ? await G(([x, y, q]) => { const el = document.elementFromPoint(x, y); const o = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); return (0, eval)(q); }, [b.x, b.y, q])
      : await G(q => { window.__app.surface.game.fire(null); return (0, eval)(q); }, q);
    if (o.then && r) { R.d1 = r[0]; R.quick = r[1]; }
    return !!b;
  };
  const cropDepthSrc = `window.__cropDepth = i => { const F = window.SSX.farm, sp = F.rackSpots()[i]; let best = null; window.__app.surface.scene.traverse(o => { if (o.isMesh && /crop/i.test(o.name || '') && o.geometry?.parameters?.depth) { const p = new o.position.constructor(); o.getWorldPosition(p); const d = Math.hypot(p.x - sp.x, p.z - sp.z); if (d < 1.7 && (!best || d < best.d)) best = { d, depth: o.geometry.parameters.depth * o.scale.z }; } }); return best ? +best.depth.toFixed(2) : 0; };`;
  const cropDepth = i => G(i => window.__cropDepth(i), i);
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await G(cropDepthSrc);
    await wait(() => !!window.SSX?.harvest && !!window.SSX?.farm, 20000);
    ok('api', await G(() => ['status', 'swing', 'drop', 'emptyHopper', 'buyHarvester', 'hire', 'open', 'close', 'on', 'cropLeft', 'fireHook'].every(k => typeof window.SSX.harvest[k] === 'function') && window.SSX.harvest.PRICES.harvester === 4000 && (window.SSX.fireHooks || []).length > 0));
    ok('menuItem', await G(() => /Harvest/.test(document.getElementById('rmHarvest')?.textContent || '')));
    await land();
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 20000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.harvest.debug.reset(); window.SSX.contraband?.reset?.();
      window.__hev = []; window.SSX.harvest.on(e => window.__hev.push(e.type)); });
    // not your farm yet: FIRE at the farm is the gun as usual
    await go('farm', 12);
    ok('notOwned', await G(() => window.SSX.harvest.fireHook() === false));
    { const f0 = await G(() => [window.__frames, performance.now()]); await sleep(4000); const f1 = await G(() => [window.__frames, performance.now()]); R.fpsBase = +((f1[0] - f0[0]) / ((f1[1] - f0[1]) / 1000)).toFixed(1); } // same spot, nothing of ours drawn yet
    // set up: farm, dome, 3 racks of potatoes, ripe (separate calls: back-to-back identical calls are one action by design)
    for (const f of ['buy', 'buildDome', 'addRack', 'addRack', 'addRack']) { await G(f => window.SSX.farm[f](), f); await sleep(900); }
    await G(() => { const F = window.SSX.farm; for (let i = 0; i < 3; i++) F.plant(i, 'potato'); F.refill('water'); F.refill('power'); F.skip(10); F.refill('water'); F.refill('power'); });
    let fs = await St(); ok('ripe', fs.racks.map(r => r.ripe), fs.racks.length === 3 && fs.racks.every(r => r.ripe));
    const sp = await G(() => window.SSX.farm.rackSpots()); const r0 = sp[0];
    // stand south of rack 1, facing it (yaw 0 = north)
    await G(([x, z]) => window.__app.surface.debugMove(x, z + 2.2, 0), [r0.x, r0.z]); await fr(8); await sleep(400);
    let h = await HS(); const ab = await center('#hvAct');
    ok('cutButton', { act: h.ui.act, near: h.near, ab, cap: h.ui.caption }, h.near === 0 && /Cut/.test(h.ui.act) && ab && ab.h >= 44 && ab.w >= 44 && /FIRE/.test(h.ui.caption) && /3rd quick cut/.test(h.ui.caption));
    ok('captionStyle', await G(() => { const b = getComputedStyle(document.getElementById('hvAct')), g = document.getElementById('farmGuide'); return b.backgroundColor === 'rgb(0, 0, 0)' && b.color === 'rgb(255, 255, 255)' && (!g || getComputedStyle(g).display === 'none'); }));
    // rack 1: three quick swings with FIRE: crop shrinks per patch, rack clears, 3rd quick cut adds 1 extra crop
    const d0 = await cropDepth(0), shots0 = await G(() => window.__app.game.progress.stats?.shots | 0);
    // FIRE once for real (touch button on phones), then two more quick FIREs paced inside the page (CDP round trips on a loaded box
    // would otherwise break the 2.5 s combo window)
    const usedFireBtn = await fire({ then: true }); h = await HS(); const d1 = R.d1;
    ok('swingFire', { usedFireBtn, carry: h.carry, d0, d1, sfx: h.sfx, parts: h.particles, quick: R.quick }, h.carryN >= 2 && d1 > 0 && d1 < d0 - 0.5 && h.sfx.some(x => /cut/.test(x)) && h.particles.cap <= 64);
    await fr(2);
    h = await HS(); fs = await St();
    ok('rackCleared', { carry: h.carry, combo: h.combo, bonus: h.stats.bonus, rack: fs.racks[0], d: await cropDepth(0), silo: fs.silo }, h.carryN === 7 && h.stats.bonus === 1 && h.combo.best >= 3 && !fs.racks[0].crop && !(fs.silo.potato > 0) && await cropDepth(0) === 0);
    ok('noGunShots', (await G(() => window.__app.game.progress.stats?.shots | 0)) === shots0);
    // rack 2 with the 🌾 Cut button; the swing screenshot; the bale fills up (12) and refuses the last patch
    await G(([x, z]) => window.__app.surface.debugMove(x, z + 2.2, 0), [sp[1].x, sp[1].z]); await fr(6); await sleep(300);
    await tapSel('#hvAct'); await fr(3);
    if (!desk) await page.screenshot({ path: out + `harvest-swing-${tag}.png` });
    await sleep(500); await tapSel('#hvAct'); await sleep(700); await fr(3); // 11/12 now: the next patch (2) won't fit
    await fire(); await fr(3); // FIRE at the rack with a full bale: refused in words, no cut, no gun
    h = await HS(); fs = await St();
    ok('carryCap', { carry: h.carryN, cap: h.ui.caption, left: fs.racks[1].crop, cuts: h.cuts }, h.carryN <= 12 && h.carryN >= 11 && fs.racks[1].crop === 'potato' && /Bale full \(1[12]\/12\)/.test(h.ui.caption) && /Drop it at the silo: \d+ m/.test(h.ui.caption) && !h.ui.act);
    // swing at nothing: refused in words, no cut
    await sleep(700); const nr = await G(() => window.SSX.harvest.swing()); ok('swingEmpty', nr, !nr.ok && nr.msg);
    // carry the bale toward the silo: back view for the shot
    h = await HS(); const silo = h.silo;
    await G(([x, z]) => window.__app.surface.debugMove(x + 1.5, z + 9, 0.4), [silo.x, silo.z]); await fr(8); await sleep(300);
    h = await HS(); const carried = h.carryN; ok('baleCaption', h.ui.caption, new RegExp(`Bale: ${carried}/12`).test(h.ui.caption) && /Walk to the silo: \d+ m/.test(h.ui.caption));
    ok('baleVisible', await G(() => { const r = window.__app.surface.scene.getObjectByName('harvest-rig'); let b = false; r?.traverse(o => { if (/bale/i.test(o.name) && o.visible) b = true; }); return !!r?.visible && b; }));
    if (!desk) await page.screenshot({ path: out + `harvest-bale-${tag}.png` });
    // drop at the silo (double tap in one frame = one drop)
    await G(([x, z]) => window.__app.surface.debugMove(x, z + 3.2, 0), [silo.x, silo.z]); await fr(8); await sleep(300);
    h = await HS(); ok('dropButton', h.ui.act, h.nearSilo && /Drop bale/.test(h.ui.act));
    // v7.5.10: an equipped flamethrower hands FIRE to the sickle/silo here (no spray), and gets it back once nothing claims it
    if (await G(() => !!window.SSX.flame)) {
      R.flameAtSilo = await G(() => { window.SSX.flame.debug.give(); window.SSX.flame.debug.hold(1.2); return window.SSX.harvest.claimsFire(); }); await fr(6);
      R.flameAtSilo = { claims: R.flameAtSilo, firing: (await G(() => window.SSX.flame.state())).firing }; await G(() => window.SSX.flame.equip(false)); await fr(3);
      ok('flamerYieldsToSilo', R.flameAtSilo, R.flameAtSilo.claims === true && R.flameAtSilo.firing === false);
    }
    await dbl('#hvAct'); await sleep(400); h = await HS(); fs = await St();
    ok('banked', { carried, carry: h.carry, silo: fs.silo, stats: h.stats }, h.carryN === 0 && fs.silo.potato === carried && h.stats.banked === carried);
    if (await G(() => !!window.SSX.flame)) { // bale banked, no ripe rack in reach: FIRE is the flamer's again
      const c = await G(() => { window.SSX.flame.equip(true); window.SSX.flame.debug.hold(1.2); return window.SSX.harvest.claimsFire(); }); await fr(6);
      R.flameAfter = { claims: c, firing: (await G(() => window.SSX.flame.state())).firing }; await G(() => { window.SSX.flame.debug.hold(0); window.SSX.flame.equip(false); }); await fr(3);
      ok('flamerBackAfter', R.flameAfter, R.flameAfter.claims === false && R.flameAfter.firing === true);
    }
    // hire a hand for rack 2 (the old one-tap way): charged once, slow, then in the silo
    const c0 = await cr(); await go('farm', 12); await tapSel('#farmAct'); await dbl('#farmPanel button[data-a="harvestAll"]'); await sleep(450);
    h = await HS(); const c1 = await cr();
    ok('hire', { jobs: h.jobs, fee: c0 - c1 }, h.jobs.length === 2 && c0 - c1 === 12);
    await tapSel('#farmPanel button[data-a="close"]'); await sleep(400); ok('closeOneTap', !(await shown())); // one real tap closes the sheet
    const sb = (await St()).silo.potato | 0; await G(() => window.SSX.harvest.debug.rush()); fs = await St(); h = await HS();
    ok('hireDone', { before: sb, silo: fs.silo, jobs: h.jobs, stats: h.stats }, fs.silo.potato - sb === 2 + 6 && !fs.racks[1].crop && !fs.racks[2].crop && h.jobs.length === 0 && h.stats.hires === 2);
    // buy the harvester from the ☰ Harvest sheet: double tap = one 4,000 cr charge
    await G(() => window.SSX.harvest.open()); const c2 = await cr();
    await dbl('#hvPanel button[data-a="buy"]'); await sleep(500); await dbl('#hvPanel button[data-a="buy"]'); await sleep(400);
    h = await HS(); const c3 = await cr(); const rides = await G(() => (window.__app.game.progress.garage?.rides || []).filter(r => r.kind === 'harvester').length);
    ok('buyOnce', { charged: c2 - c3, rides, rover: h.rover }, c2 - c3 === 4000 && rides === 1 && h.rover.owned && h.rover.spot);
    const again = await G(() => window.SSX.harvest.buyHarvester()); ok('buyRefused', again, !again.ok && (await cr()) === c3);
    await tapSel('#hvPanel button[data-a="close"]');
    // replant + ripen, then walk to it and take the 🔑 Drive
    await G(() => { const F = window.SSX.farm; F.plant(0, 'potato'); F.plant(1, 'algae'); F.plant(2, 'potato'); F.refill('water'); F.refill('power'); F.skip(10); F.refill('water'); F.refill('power'); }); fs = await St();
    const hs = h.rover.spot; await G(([x, z]) => window.__app.surface.debugMove(x + 2.6, z, Math.PI / 2), [hs.x, hs.z]); await sleep(1300); await fr(6);
    const ctx = await G(() => { const a = window.__dealer?.myrides?.ctxAction?.(); if (!a) return null; const l = a.label; a.act(); return l; }); await fr(10); await sleep(500);
    h = await HS(); ok('drive', { ctx, driving: h.rover.driving, kind: await G(() => window.__app.surface.info.driving && window.__dealer?.ride?.kind) }, /Drive/.test(ctx || '') && h.rover.driving);
    // drive the header across both racks (east along the row)
    const sp2 = await G(() => window.SSX.farm.rackSpots());
    for (const r of sp2) { await G(([x, z]) => window.__app.surface.debugMove(x - 3.4 + 0.1, z, -Math.PI / 2), [r.x, r.z]); await wait(i => !window.SSX.farm.status().racks[i].crop, desk ? 45000 : 20000, r.i); }
    await fr(4); h = await HS(); fs = await St();
    ok('hopperFill', { hopper: h.hopper, racks: fs.racks.map(r => r.crop), cap: h.ui.caption }, h.hopperN >= 8 && fs.racks.every(r => !r.crop) && /Hopper \d+\/40/.test(h.ui.caption));
    await G(([x, z]) => window.__app.surface.debugMove(x, z + 9, 0.5), [silo.x, silo.z]); await fr(10); await sleep(300);
    await G(() => { try { window.SSX.time?.set?.(13); } catch (e) { /* daylight for the shot */ } }); await fr(6); await sleep(300);
    if (!desk) await page.screenshot({ path: out + `harvest-harvester-${tag}.png` });
    // stop at the silo: it empties
    const s0 = (await St()).silo, hn = (await HS()).hopperN;
    await G(([x, z]) => window.__app.surface.debugMove(x, z + 4.5, 0), [silo.x, silo.z]); await sleep(2600); await fr(4);
    h = await HS(); fs = await St();
    ok('emptied', { hop: h.hopperN, s0, s1: fs.silo }, h.hopperN === 0 && ((fs.silo.potato | 0) + (fs.silo.algae | 0)) - ((s0.potato | 0) + (s0.algae | 0)) === hn);
    // FPS at the farm (in the harvester, with particles)
    await G(() => window.SSX.harvest.debug.burst(30)); const f0 = await G(() => [window.__frames, performance.now()]); await sleep(4000); const f1 = await G(() => [window.__frames, performance.now()]);
    R.fps = { measured: +((f1[0] - f0[0]) / ((f1[1] - f0[1]) / 1000)).toFixed(1), status: (await HS()).fps, particles: (await HS()).particles };
    await G(() => { if (window.__app.surface.info.driving) window.__app.surface.interact(); }); await fr(4); await sleep(500);
    { const f0 = await G(() => [window.__frames, performance.now()]); await sleep(4000); const f1 = await G(() => [window.__frames, performance.now()]); R.fps.onFootSameSpot = +((f1[0] - f0[0]) / ((f1[1] - f0[1]) / 1000)).toFixed(1); }
    ok('fpsSane', R.fps, R.fps.measured > 0.5 && R.fps.particles.alive <= R.fps.particles.cap);
    // Rust Pit: no sickle, no auto-cut, FIRE is the gun's business (and the gun is off there)
    await G(() => { if (window.__app.surface.info.driving) window.__app.surface.interact(); }); await fr(6);
    await G(() => { const c = window.__app.surface.info.colony || window.__app.surface.world.colony; window.__app.surface.debugMove(c.x - 292, c.z - 68, 0); }); await fr(6); await sleep(400);
    R.pit = await G(() => { const H = window.SSX.harvest, st = H.status(); return { hook: H.fireHook(), sw: H.swing(), act: st.ui.act, pit: st.pit }; });
    ok('pitSafe', R.pit, R.pit.hook === false && !R.pit.sw.ok && !R.pit.act);
    // persistence: own save key
    ok('saveKey', await G(() => { const s = JSON.parse(localStorage.getItem('ssx.harvest.v1') || 'null'); return !!s && s.rover?.owned === true && s.stats?.banked >= 10; }));
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
