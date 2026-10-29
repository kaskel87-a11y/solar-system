// Mars farming (mars/farm.js, SSX.farm): buy the homestead, build the dome + racks, plant, grow over a time skip (own clock
// and SSX.time), water/power upkeep, a dust storm (SSX.storm shape), harvest (lichen -> contraband stash), a sale at the
// Xen-7 Trading Post with day-shifting prices, a raid won and a raid lost (SSX.raids), Rust Pit + floating-car safety,
// one context button (44px+), the ☰ entry, persistence across a reload, 0 console errors.
// BASE=http://127.0.0.1:8896/ BR=webkit DEV="iPhone 14" OUT=./shots/farm/ node tests/test-farm.js  (one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8896/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/farm/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width, t: r.top, b: r.bottom, l: r.left, r: r.right }; }, sel);
  const tapSel = async sel => { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(150); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
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
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.farm, 20000);
    ok('api', await G(() => ['status', 'buy', 'buildDome', 'addRack', 'plant', 'harvest', 'refill', 'patch', 'sell', 'buyers', 'useFavor', 'raid', 'skip', 'clock', 'places', 'open', 'close', 'on'].every(k => typeof window.SSX.farm[k] === 'function')));
    ok('menuItem', await G(() => /Farm/.test(document.getElementById('rmFarm')?.textContent || '')));
    await land();
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 20000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.contraband?.reset?.();
      window.__fev = []; window.SSX.farm.on(e => window.__fev.push({ type: e.type, phase: e.phase, result: e.result, via: e.via, n: e.n, stolen: e.stolen })); });
    await sleep(500);
    ok('built', await G(() => !!window.__app.surface.scene.getObjectByName('farm')));
    // far away: plain-word directions, no context button, actions refused
    await G(() => { const p = window.SSX.farm.places()[0]; window.__app.surface.debugMove(p.x + 200, p.z - 200, 0); }); await fr(4);
    R.far = await G(() => { const F = window.SSX.farm, r = F.buy(); F.open('farm'); return { r, txt: document.getElementById('farmBody').textContent, act: document.getElementById('farmAct').classList.contains('on') }; });
    ok('directions', R.far, !R.far.r.ok && /Go to Dustbowl Homestead \(\d+ m (north|south|east|west|north-east|north-west|south-east|south-west)\) and tap Farm\./.test(R.far.txt) && !R.far.act);
    await tapSel('#farmPanel button[data-a="close"]');

    // ---- buy / build via the context button + sheet ----
    await go('farm', 12);
    ok('contextBtn', await wait(() => document.getElementById('farmAct').classList.contains('on'), 10000));
    const ab = await center('#farmAct'); ok('contextSize', ab, ab && ab.h >= 44 && /Farm/.test(await G(() => document.getElementById('farmAct').textContent)));
    await tapSel('#farmAct'); ok('sheetOpens', await shown());
    const c0 = await cr();
    await tapSel('#farmPanel button[data-a="buy"]'); await tapSel('#farmPanel button[data-a="dome"]'); await tapSel('#farmPanel button[data-a="rack"]'); await tapSel('#farmPanel button[data-a="rack"]');
    await tapSel('#farmPanel button[data-a="plant"][data-i="0"]'); await tapSel('#farmPanel button[data-a="plantc"][data-c="potato"]');
    let s = await St(); const c1 = await cr();
    ok('buyBuildPlant', { s: { owned: s.owned, dome: s.dome, racks: s.racks }, spent: c0 - c1 }, s.owned && s.dome && s.racks.length === 2 && s.racks[0].crop === 'potato' && c0 - c1 === 1200 + 900 + 600 + 20);
    const btnH = await G(() => [...document.querySelectorAll('#farmPanel button')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height)));
    ok('btnSizes', btnH, btnH.length > 3 && btnH.every(h => h >= 44));
    await G(() => { const F = window.SSX.farm; F.plant(1, 'lichen'); F.addRack(); F.plant(2, 'glowberry'); });
    ok('scene', await G(() => window.SSX.farm.debug.scene()), (await G(() => window.SSX.farm.debug.scene()))?.dome);
    // SSX.base (#24): the homestead is a registered lot and the dome + racks are base pieces at the layout spots; without it, we draw them
    const BASE = await G(() => typeof window.SSX.base?.registerPlot === 'function');
    if (BASE) { const bs = await G(() => { const b = window.SSX.base, p = b.plots().find(q => q.id === 'farm-homestead'); return { p, pieces: b.state('farm-homestead')?.pieces?.map(q => [q.type, q.i, q.j]), ids: b.piecesFor ? null : null, st: window.SSX.farm.status().base }; });
      const fpl = await G(() => window.SSX.farm.places().find(q => q.id === 'farm'));
      ok('basePlot', bs.p, bs.p && bs.p.owned && Math.abs(bs.p.world.x - fpl.x) < 0.5 && Math.abs(bs.p.world.z - fpl.z) < 0.5);
      ok('basePieces', bs.pieces, bs.pieces && JSON.stringify(bs.pieces) === JSON.stringify([['farm-dome', 2, 0], ['farm-rack', 3, 7], ['farm-rack', 6, 7], ['farm-rack', 2, 7]]));
      ok('baseNoDupDome', await G(() => !window.__app.surface.scene.getObjectByName('farm-dome')));
      // a rack scrapped in base's own flow leaves the farm too (refund from base), and a rack placed there joins it
      const rm = await G(() => { const b = window.SSX.base, p = b.state('farm-homestead').pieces.filter(q => q.type === 'farm-rack').at(-1); const r = b.remove('farm-homestead', p.id); const n1 = window.SSX.farm.status().racks.length; const r2 = b.place('farm-homestead', 'farm-rack', 2, 7, 0); window.SSX.farm.plant(2, 'glowberry'); return { r: r.ok, n1, r2: r2.ok, n2: window.SSX.farm.status().racks.length }; });
      ok('baseSync', rm, rm.r && rm.n1 === 2 && rm.r2 && rm.n2 === 3);
    } else R.base = 'no SSX.base.registerPlot: farm draws its own dome + racks';
    // upkeep: top up through the sheet
    const c2 = await cr(); await tapSel('#farmPanel button[data-a="water"]'); await tapSel('#farmPanel button[data-a="power"]');
    s = await St(); const c3 = await cr(); ok('refill', { w: s.water, p: s.power, cost: c2 - c3 }, s.water === 100 && s.power === 100 && c2 - c3 === 60 * 2 + 60 * 3);
    if (!desk) { await G(() => document.getElementById('farmPanel').querySelector('.wrap').scrollTop = 0); await page.screenshot({ path: out + `farm-panel-${tag}.png` }); }
    await tapSel('#farmPanel button[data-a="close"]');
    // ---- grow: own clock skip, then SSX.time ----
    let k = await G(() => { const r = window.SSX.farm.skip(3); return { via: r.via, s: window.SSX.farm.status() }; });
    ok('growOwn', { via: k.via, racks: k.s.racks, water: k.s.water }, k.via === 'own' && k.s.racks[0].growth > 0.25 && k.s.racks[0].growth < 0.35 && k.s.water < 100);
    await G(() => { window.__fakeH = 9; window.SSX.time = { hour: () => window.__fakeH, set: h => { window.__fakeH = h; }, isNight: () => false }; }); await fr(4);
    await G(() => { window.__fakeH = 11; }); await fr(6);
    const EMPH = await G(() => typeof window.SSX.empire?.on === 'function' && !!window.SSX.farm.status().empire);
    if (EMPH) await wait(() => window.SSX.farm.status().empire?.live, 6000); // SSX.empire (#52) re-baselines on SSX.time, then fires the 2 hours crossed
    k = await St(); ok('growTimeTick', { clock: k.clock, g: k.racks[0].growth, emp: k.empire }, EMPH ? (k.clock === 'SSX.empire.hour' && k.racks[0].growth > 0.35 && k.racks[0].growth < 0.65) : (k.clock === 'SSX.time' && k.racks[0].growth > 0.45 && k.racks[0].growth < 0.55));
    k = await G(() => { const r = window.SSX.farm.skip(8); return { via: r.via, h: window.__fakeH, s: window.SSX.farm.status() }; });
    ok('growTimeSkip', { via: k.via, h: k.h, racks: k.s.racks }, k.via === 'SSX.time' && k.h === 19 && k.s.racks[0].ripe && !k.s.racks[1].ripe);
    if (EMPH) { // one SSX.time hour -> exactly one empire 'hour' -> exactly one farm hour (no double tick); skip()'s 8 hour events were swallowed
      await sleep(3200); const e0 = await St(); await G(() => { window.__fakeH = 20.05; }); await wait(n => window.SSX.farm.status().empire.hours > n, 6000, e0.empire.hours); await sleep(1500); const e1 = await St();
      ok('empireHour', { h0: e0.hours, h1: e1.hours, n0: e0.empire.hours, n1: e1.empire.hours }, Math.abs(e1.hours - e0.hours - 1) < 0.01 && e1.empire.hours === e0.empire.hours + 1);
    } else R.empireHour = 'no SSX.empire.on: own clock / SSX.time';
    ok('ripeEvent', await G(() => window.__fev.some(e => e.type === 'ripe')));
    // ---- storm (SSX.storm shape) ----
    await G(() => { window.SSX.farm.refill('water'); window.SSX.farm.refill('power'); window.SSX.storm = { active: () => true, intensity: () => 1, on() { return () => {}; } }; });
    const h0 = (await St()).racks[2].health; k = await G(() => { window.SSX.farm.skip(2); return window.SSX.farm.status(); });
    ok('storm', { h0, h1: k.racks[2].health, dome: k.domeHp, ev: await G(() => window.__fev.filter(e => e.type === 'storm').length) }, k.racks[2].health < h0 && k.domeHp < 100 && await G(() => window.__fev.some(e => e.type === 'storm' && e.phase === 'damage')));
    await G(() => { window.SSX.storm.active = () => false; });
    await G(() => window.SSX.farm.patch()); ok('patch', (await St()).domeHp === 100);
    // ---- harvest: everything ripe; lichen goes to the contraband stash ----
    await G(() => { window.SSX.farm.refill('water'); window.SSX.farm.refill('power'); window.SSX.farm.skip(10); window.SSX.farm.refill('water'); window.SSX.farm.refill('power'); window.SSX.farm.skip(6); });
    k = await St(); ok('allRipe', k.racks.map(r => r.ripe), k.racks.every(r => r.ripe));
    const gd0 = await G(() => window.SSX.contraband?.stash?.().items?.glowdust?.qty | 0);
    await tapSel('#farmAct'); await tapSel('#farmPanel button[data-a="harvestAll"]');
    k = await St(); const gd1 = await G(() => window.SSX.contraband?.stash?.().items?.glowdust?.qty | 0);
    ok('harvest', { silo: k.silo, gd0, gd1, racks: k.racks.map(r => r.crop) }, k.racks.every(r => !r.crop) && k.silo.potato > 0 && k.silo.glowberry > 0 && gd1 - gd0 >= 1);
    await tapSel('#farmPanel button[data-a="close"]');
    // ---- trading post: day-shifting prices, a cash sale through the sheet ----
    const day0 = await G(() => window.SSX.farm.buyers().map(b => b.offers.map(o => o.unit)).flat());
    const day1 = await G(() => { window.SSX.farm.refill('water'); window.SSX.farm.skip(24); return window.SSX.farm.buyers().map(b => b.offers.map(o => o.unit)).flat(); });
    ok('dayPrices', { day0, day1 }, day0.join() !== day1.join());
    await go('post', 4);
    ok('tradeBtn', await wait(() => /Trade/.test(document.getElementById('farmAct').textContent) && document.getElementById('farmAct').classList.contains('on'), 10000));
    await tapSel('#farmAct'); const p0 = (await St()).silo.potato, m0 = await cr();
    await tapSel('#farmPanel button[data-a="sell"][data-b="vell"][data-c="potato"]');
    k = await St(); const m1 = await cr();
    ok('sale', { p0, p1: k.silo.potato, got: m1 - m0 }, !k.silo.potato && m1 > m0 && await G(() => window.__fev.some(e => e.type === 'sale')));
    if (!desk) await page.screenshot({ path: out + `farm-post-${tag}.png` });
    await tapSel('#farmPanel button[data-a="close"]');
    // ---- raids (SSX.raids on main): one won, one lost ----
    await go('farm', 6);
    R.raidsBusy = await G(() => { const st = window.__raids?.state; if (st?.id && !/^farm-raid/.test(st.id)) { window.SSX.raids.stop(st.id, 'test'); return st.id; } return null; }); // another add-on's raid (e.g. empire crew raids, #52) holds the one SSX.raids slot
    k = await G(() => window.SSX.farm.raid({ waves: 1 })); R.raid1 = k;
    await G(() => { window.__raids?.flushQueue?.(); }); await fr(4);
    const won = await wait(() => { window.__raids?.flushQueue?.(); window.__raids?.killAll?.(); return window.__fev.some(e => e.type === 'raid:end'); }, 60000);
    ok('raidWin', { k, ev: await G(() => window.__fev.filter(e => e.type.startsWith('raid'))) }, k.ok && k.via === 'SSX.raids' && won && await G(() => window.__fev.some(e => e.type === 'raid:end' && e.result === 'win')));
    await G(() => window.__app.game.restore?.()); await sleep(500);
    const sil0 = (await St()).siloCount;
    k = await G(() => { const r = window.SSX.farm.raid({ waves: 1 }); window.SSX.raids?.stop?.(r.id, 'test'); return { r, s: window.SSX.farm.status() }; });
    ok('raidLose', { r: k.r, sil0, sil1: k.s.siloCount }, k.r.ok && sil0 > 0 && k.s.siloCount < sil0 && await G(() => window.__fev.some(e => e.type === 'raid:end' && e.result === 'lose' && e.stolen > 0)));
    await G(() => window.__app.game.restore?.());
    // ---- floating car: no context button, actions say land first ----
    await G(() => { const p = window.SSX.farm.places()[0]; window.__app.surface.debugMove(p.x, p.z + 13, 0); }); await fr(3);
    // the lost raid's raiders still roam: clear them so the rover can come
    R.summon = await G(() => { window.__app.game.debug?.clear?.(); return window.__app.surface.summonRover(); }); await fr(4); await G(() => { if (!window.__app.surface.info.driving) window.__app.surface.interact(); }); await fr(3);
    R.driving = await G(() => !!window.__app.surface.info.driving);
    await G(() => { const p = window.SSX.farm.places()[0]; window.__app.surface.debugMove(p.x, p.z + 13, 0); }); await fr(3);
    // lift the car through the next tick's tc.car (the farm reads lastTc.car)
    R.float = await G(async () => { const F = window.SSX.farm; let hit = null; const lift = (dt, tc) => { if (tc.car) { tc.car.y = tc.height(tc.car.x, tc.car.z) + 40; tc.car.vy = 0; } };
      window.SSX.registerSurfaceTick(lift); await new Promise(r => setTimeout(r, 900));
      hit = { floating: F.debug.floating(), harvest: F.harvest('all').msg, act: document.getElementById('farmAct').classList.contains('on') }; return hit; });
    ok('floating', R.float, R.float.floating && R.float.harvest === 'Land first.' && !R.float.act);
    await G(() => { window.__app.surface.debugMove(window.__app.surface.info.x, window.__app.surface.info.z, 0); }); await fr(3);
    // ---- Rust Pit: nothing shows, nothing starts ----
    await G(() => { if (window.__app.surface.info.driving) window.__app.surface.interact(); const c = window.__app.surface.info.colony || window.__app.surface.world.colony; window.__app.surface.debugMove(c.x - 292, c.z - 68, 0); }); await fr(4);
    R.pit = await G(() => { const F = window.SSX.farm; return { pit: F.debug.inPit(), raid: F.raid(), act: document.getElementById('farmAct').classList.contains('on') }; });
    ok('pitSafe', R.pit, R.pit.pit && !R.pit.raid.ok && !R.pit.act);
    // phone screenshot at the farm: dome, racks, the one context button
    await go('farm', 12); await G(() => { window.SSX.farm.plant(0, 'algae'); window.SSX.farm.plant(1, 'glowberry'); window.SSX.farm.skip(4); }); await fr(6);
    if (!desk) await page.screenshot({ path: out + `farm-dome-${tag}.png` });
    // ---- persistence: a real reload ----
    const before = await St();
    await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.farm, 120000);
    const after = await St();
    ok('persist', { before: [before.owned, before.dome, before.racks.length, before.siloCount, before.hours, before.favors.length], after: [after.owned, after.dome, after.racks.length, after.siloCount, after.hours, after.favors.length] },
      after.owned && after.dome && after.racks.length === before.racks.length && after.siloCount === before.siloCount && Math.abs(after.hours - before.hours) < 0.2 && after.racks[0].crop === 'algae');
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
