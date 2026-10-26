// Mars wanted pursuit (mars/pursuit.js, SSX.pursuit): tier dispatch 1-5★ (rovers, drone spotlights, Beltway roadblocks,
// SWAT), LOS search + minimap ring + expiry, a hideout, a respray (44px button), the Rust Pit exclusion, a floated car
// (zero-G: no NaN, no rams, units keep moving), busted (boxed in: core fee once, contraband seized once) and wasted
// (SWAT fire: half the stash), HUD contrast, no console errors.
// BASE=http://127.0.0.1:8889/ BR=webkit DEV="iPhone 14" OUT=./shots/pursuit/ node tests/test-pursuit.js   (one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8889/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(400); };
  const F = 'window.SSX.pursuit';
  const drive = async () => { await G(() => { const s = window.__app.surface; if (!s.info.driving) { s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); } }); return wait(() => window.__app.surface.info.driving, 15000); };
  const flats = async (dx = 0, dz = 0) => G(([dx, dz]) => { const c = window.__app.surface.info.colony, d = window.__app.surface.world.districts().find(q => q.id === 'red-tape-flats') || { x: c.x - 280, z: c.z - 40 }; window.__app.surface.debugMove(d.x + dx, d.z + dz, 0); return { x: d.x, z: d.z }; }, [dx, dz]);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.pursuit, 15000);
    ok('api', await G(() => ['heat', 'tier', 'units', 'searching', 'hideouts', 'lose', 'on'].every(k => typeof window.SSX.pursuit[k] === 'function') && !!window.SSX.pursuit.debug));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.game.debug?.calm?.(true); window.__app.game.progress.credits = 5000; window.__app.game.save(); window.__app.surface.world.setWanted(0); window.__pev = []; window.SSX.pursuit.on(e => window.__pev.push({ type: e.type, how: e.how, why: e.why, fee: e.fee, kind: e.kind, to: e.to })); });
    ok('driving', await drive());
    await flats(0, 0); await sleep(800);
    R.sites = await G(() => ({ hide: window.SSX.pursuit.hideouts().map(h => h.id), spray: window.SSX.pursuit.sprays().map(s => s.id) }));
    ok('sites', R.sites, R.sites.hide.length >= 3 && R.sites.spray.length >= 1);
    // ---- tiers ----
    const tiers = {};
    for (const n of [1, 2, 3, 4, 5]) {
      await G(n => { const P = window.SSX.pursuit; P.debug.setHeat(n); P.debug.los(true); P.debug.sync(); }, n);
      const cond = { 1: 'u.filter(q=>q.own&&q.kind==="rover").length>=1', 2: 'u.filter(q=>q.own&&q.kind==="rover").length>=P.tier().rovers', 3: 'P.debug.state().cones>=1', 4: 'P.roadblocks().length>=1', 5: 'u.filter(q=>q.own&&q.kind==="swat").length>=1' }[n];
      const got = await wait(new Function(`const P=window.SSX.pursuit,u=P.units();return P.heat()===${n} && window.__pev.some(e=>e.type==='tier'&&e.to===${n}) && ${cond};`), n === 3 ? 60000 : 15000);
      tiers[n] = { got, tier: await G(() => window.SSX.pursuit.tier()), own: await G(() => window.SSX.pursuit.units().filter(u => u.own).map(u => u.kind).join(',')), core: await G(() => window.SSX.pursuit.units().filter(u => !u.own).map(u => u.kind).join(',')), blocks: await G(() => window.SSX.pursuit.roadblocks().map(b => b.id).join(',')) };
      if (n === 3 && !desk) await page.screenshot({ path: out + `pursuit-spot-${tag}.png` });
    }
    ok('tiers', tiers, Object.values(tiers).every(t => t.got) && tiers[1].tier.rovers === 1 && tiers[5].tier.swat >= 1 && tiers[4].tier.roadblocks >= 1);
    R.allEv = await G(() => window.__pev.map(e => e.type).join(',')); R.tierEv = await G(() => window.__pev.filter(e => e.type === 'tier').map(e => e.to).join(',')); ok('tierEvents', R.tierEv, R.tierEv === '1,2,3,4,5');
    await G(() => window.SSX.pursuit.debug.setHeat(0));
    ok('standDown', await wait(() => window.SSX.pursuit.units().filter(u => u.own).length === 0 && window.SSX.pursuit.roadblocks().length === 0, 15000));
    // ---- LOS search ----
    await G(() => { const P = window.SSX.pursuit; P.debug.setHeat(2); P.debug.los(true); P.debug.sync(); }); await sleep(800);
    const sh = await wait(() => window.SSX.pursuit.seen() && !window.SSX.pursuit.searching(), 8000); ok('seenHolds', await G(() => { const s = window.SSX.pursuit.debug.state(); return { stars: s.stars, seen: s.seen, search: !!s.search, forceLOS: s.forceLOS }; }), sh);
    await G(() => window.SSX.pursuit.debug.los(false));
    ok('searchStarts', await wait(() => !!window.SSX.pursuit.searching(), 8000));
    R.search = await G(() => ({ s: window.SSX.pursuit.searching(), marks: window.SSX.minimap.list().filter(k => k.startsWith('pursuit')), hud: (() => { const h = document.getElementById('puHud'), cs = getComputedStyle(h); return { show: cs.display !== 'none', t: h.textContent, bg: cs.backgroundColor, color: cs.color }; })() }));
    ok('searchRing', R.search, R.search.s && R.search.s.r >= 35 && R.search.marks.includes('pursuit:search') && R.search.hud.show && /SEARCH/.test(R.search.hud.t) && R.search.hud.bg === 'rgb(0, 0, 0)' && R.search.hud.color === 'rgb(255, 255, 255)');
    if (!desk) await page.screenshot({ path: out + `pursuit-search-${tag}.png` });
    await G(() => window.SSX.pursuit.debug.los(true));
    ok('reSpotted', await wait(() => !window.SSX.pursuit.searching(), 8000) && await G(() => window.__pev.some(e => e.type === 'spotted')));
    await G(() => window.SSX.pursuit.debug.los(false)); await wait(() => !!window.SSX.pursuit.searching(), 8000);
    await G(() => window.SSX.pursuit.debug.expire());
    ok('searchExpires', await wait(() => window.SSX.pursuit.heat() === 0, 8000) && await G(() => window.__pev.some(e => e.type === 'lost' && e.how === 'search')));
    // ---- hideout ----
    await G(() => { const P = window.SSX.pursuit; P.debug.setHeat(2); P.debug.los(false); }); await sleep(300);
    R.hide = await G(() => window.SSX.pursuit.debug.goto(window.SSX.pursuit.hideouts()[0].id));
    ok('hideout', await wait(() => window.SSX.pursuit.heat() === 0, desk ? 60000 : 20000) && await G(() => window.__pev.some(e => e.type === 'hideout')));
    // ---- respray ----
    await G(() => { const P = window.SSX.pursuit; P.debug.goto(P.sprays()[0].id); P.debug.setHeat(3); P.debug.los(true); }); await sleep(800);
    R.sprayRefused = await G(() => window.SSX.pursuit.lose('repaint'));
    await G(() => window.SSX.pursuit.debug.los(false)); await wait(() => !!window.SSX.pursuit.searching(), 8000);
    const btn = await center('#puAct'); R.sprayBtn = btn;
    const before = await G(() => ({ cr: window.__app.game.progress.credits, plate: window.SSX.pursuit.plate(), price: window.SSX.pursuit.sprays()[0].price }));
    await tapSel('#puAct'); await wait(() => window.SSX.pursuit.heat() === 0, 5000);
    const after = await G(() => ({ cr: window.__app.game.progress.credits, plate: window.SSX.pursuit.plate(), heat: window.SSX.pursuit.heat() }));
    ok('repaint', { refused: R.sprayRefused, btn, before, after }, !R.sprayRefused.ok && btn && btn.h >= 44 && after.heat === 0 && after.plate !== before.plate && before.cr - after.cr === before.price);
    // ---- the Rust Pit: nothing fires, rams or boxes in there ----
    await G(() => { const P = window.SSX.pursuit; P.debug.goto('pit'); P.debug.setHeat(3); P.debug.los(true); }); await sleep(600);
    R.pitIn = await G(() => window.SSX.pursuit.inPit());
    await G(() => { window.__pev0 = window.__pev.length; window.SSX.pursuit.debug.box(); window.__pdbg = { me: window.SSX.pursuit.debug.state().me, pit: window.SSX.pursuit.inPit(), u: window.SSX.pursuit.units().filter(u => u.own).map(u => u.kind + '@' + Math.round(u.x) + ',' + Math.round(u.z)) }; window.__vol = window.SSX.pursuit.debug.volley(2, 1); });
    await sleep(desk ? 6000 : 3500);
    R.pit = await G(() => ({ dbg: window.__pdbg, ev: window.__pev.slice(window.__pev0).filter(e => /ram|pit|boxed|busted|wasted|shot/.test(e.type)).map(e => e.type), vol: window.__vol, modes: window.SSX.pursuit.units().filter(u => u.own).map(u => u.mode), down: window.__app.game.info.down }));
    ok('pitExclusion', R.pit, R.pitIn && R.pit.ev.length === 0 && R.pit.vol === 0 && !R.pit.down && R.pit.modes.every(m => m === 'hold'));
    await G(() => window.SSX.pursuit.debug.setHeat(0)); await sleep(800);
    // ---- floated car (zero-G): no NaN, no rams, units keep moving ----
    await flats(10, 30); await sleep(500);
    await G(sec => { const P = window.SSX.pursuit; P.debug.setHeat(2); P.debug.los(true); P.debug.sync(); window.__pev1 = window.__pev.length; P.debug.float(30, sec); }, desk ? 30 : 10);
    const fl = []; for (let i = 0; i < 6; i++) { await sleep(desk ? 2500 : 1000); fl.push(await G(() => { const s = window.SSX.pursuit.debug.state(); return { nan: s.nan, fl: s.me.floating, dy: Math.round(s.me.y - s.me.gy), u: window.SSX.pursuit.units().filter(u => u.own).map(u => `${u.mode}@${Math.round(u.x)},${Math.round(u.z)}`).join(' ') }; })); }
    R.float = { fl, ev: await G(() => window.__pev.slice(window.__pev1).filter(e => /ram|pit|boxed|busted/.test(e.type)).map(e => e.type)), down: await G(() => window.__app.game.info.down) };
    ok('floatSafe', R.float, fl.every(s => !s.nan) && fl.some(s => s.fl && s.dy > 10) && R.float.ev.length === 0 && !R.float.down && fl.at(-1).u.length > 0 && fl[1].u !== fl.at(-1).u);
    await G(() => { const P = window.SSX.pursuit; P.debug.float(0, 0); P.debug.setHeat(0); }); await sleep(800);
    // ---- busted: boxed in while stopped -> core fee once, contraband bagged once ----
    await flats(-10, 30); await sleep(500);
    const b0 = await G(() => { const C = window.SSX.contraband; C?.add?.('glowdust', 4, 1); const g = window.__app.game; g.progress.credits = 2000; g.save(); const P = window.SSX.pursuit; P.debug.setHeat(2); P.debug.los(true); window.__pev2 = window.__pev.length; return { cr: 2000, qty: C?.stash?.().items?.glowdust?.qty | 0 }; });
    await G(() => window.SSX.pursuit.debug.box());
    const busted = await wait(() => window.__pev.slice(window.__pev2).some(e => e.type === 'outcome'), desk ? 90000 : 30000);
    await sleep(3500);
    const b1 = await G(() => ({ ev: window.__pev.slice(window.__pev2).map(e => e.type + (e.fee != null ? ':' + e.fee : '')), cr: window.__app.game.progress.credits, qty: window.SSX.contraband?.stash?.().items?.glowdust?.qty | 0, heat: window.SSX.pursuit.heat() }));
    const fee = Math.max(50, Math.round(2000 * 0.15));
    ok('busted', { b0, b1, fee }, busted && (b1.ev.includes('boxed') || b1.ev.includes('ram')) && b1.ev.includes('busted') && b1.ev.includes('outcome:' + fee) && b0.cr - b1.cr === fee && b0.qty === 4 && b1.qty === 0 && b1.heat === 0);
    // ---- wasted: SWAT rounds -> killed, core med-evac fee, half the stash ----
    await wait(() => window.__app.state.onSurface && !window.__app.game.info.down, 20000); await sleep(1000);
    const w0 = await G(() => { const C = window.SSX.contraband; C?.add?.('glowdust', 4, 1); const g = window.__app.game; g.progress.credits = 2000; g.save(); const s = window.__app.surface; if (s.info.driving) s.interact(); const P = window.SSX.pursuit; P.debug.setHeat(5); P.debug.los(true); window.__pev3 = window.__pev.length; return { qty: C?.stash?.().items?.glowdust?.qty | 0, pit: P.inPit() }; });
    let shots = 0; for (let i = 0; i < 12 && !(await G(() => window.__app.game.info.down)); i++) { shots += await G(() => window.SSX.pursuit.debug.volley(4, 60)); await sleep(300); }
    const wasted = await wait(() => window.__pev.slice(window.__pev3).some(e => e.type === 'outcome'), desk ? 90000 : 30000); await sleep(3500);
    const w1 = await G(() => ({ ev: window.__pev.slice(window.__pev3).map(e => e.type + (e.fee != null ? ':' + e.fee : '')), cr: window.__app.game.progress.credits, qty: window.SSX.contraband?.stash?.().items?.glowdust?.qty | 0 }));
    ok('wasted', { w0, w1, shots }, wasted && w1.ev.includes('wasted') && w1.ev.includes('outcome:200') && 2000 - w1.cr === 200 && w1.qty === Math.floor(w0.qty / 2));
    // final shot: 3★ with the pursuit on you
    await wait(() => window.__app.state.onSurface && !window.__app.game.info.down, 20000); await sleep(800);
    await drive(); await flats(0, 10); await G(() => { const P = window.SSX.pursuit; P.debug.los(null); P.debug.setHeat(3); P.debug.sync(); }); await sleep(desk ? 6000 : 3000);
    R.finalHud = await G(() => document.getElementById('puHud').textContent);
    await page.screenshot({ path: out + `pursuit-${tag}.png` }); R.shot = out + `pursuit-${tag}.png`;
    ok('noNaN', await G(() => !window.SSX.pursuit.debug.state().nan));
    await G(() => window.SSX.pursuit.debug.setHeat(0));
  } catch (e) { errors.push('TEST ' + e.message); }
  R.errors = errors; R.bad = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length || errors.length ? 1 : 0);
})();
