// Mars contraband production (mars/lab.js, SSX.lab, the Vat House): buy at the door, supplies, cook, real-time batches,
// purity unlock, collect into the SSX.contraband stash with carry-limit overflow, runner sales, wages -> skim -> quit,
// offline cap, a live gang raid fought through the core spawner, a lost ColSec raid (stock loss, damaged upgrade),
// heat control, panel contrast / 44px taps, hotkey, no console errors.
// BASE=http://127.0.0.1:8882/ BR=webkit DEV="iPhone 14" OUT=./shots/lab/ node tests/test-lab.js   (DEV=desktop; one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8882/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
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
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.lab && window.SSX?.contraband?.barterSource === 'barter.json', 15000);
    ok('api', await G(() => ['status', 'buySupplies', 'upgrade', 'hire', 'fire', 'collect', 'on', 'buy', 'setProduct', 'repair', 'payCrew', 'layLow', 'greaseBeat'].every(k => typeof window.SSX.lab[k] === 'function') && !!window.SSX.lab.debug));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.game.debug.calm?.(true); window.__app.game.progress.credits = 20000; window.SSX.lab.debug.reset(); window.SSX.contraband.reset(); window.__app.surface.world.setWanted(0);
      window.__lev = []; window.addEventListener('ssx:lab', e => { if (e.detail.type !== 'change') window.__lev.push(e.detail.type); }); });
    R.site = await G(() => ({ ...window.SSX.lab.status(), upgrades: undefined, products: undefined }));
    R.district = await G(() => { const a = window.SSX.lab.status().at; return window.SSX.contraband.districtAt(a[0], a[1]); });
    ok('inFlats', R.district, R.district === 'red-tape-flats');
    ok('buyAway', await G(() => window.SSX.lab.buy().ok === false));
    await G(() => window.SSX.lab.debug.goto()); await sleep(1200);
    R.act = await wait(() => document.getElementById('labAct')?.classList.contains('show'), 8000);
    ok('doorButton', R.act);
    await tapSel('#labAct');
    R.panel = await G(() => { const p = document.querySelector('#labPanel .wrap'), cs = getComputedStyle(p), btns = [...document.querySelectorAll('#labPanel button')].filter(b => b.offsetParent); return { show: document.getElementById('labPanel').classList.contains('show'), bg: cs.backgroundColor, color: cs.color, minH: Math.min(...btns.map(b => b.getBoundingClientRect().height)), fits: p.getBoundingClientRect().right <= innerWidth + 1 }; });
    ok('panel', R.panel, R.panel.show && R.panel.bg === 'rgb(0, 0, 0)' && R.panel.color === 'rgb(255, 255, 255)' && R.panel.minH >= 44 && R.panel.fits);
    const c0 = await G(() => window.__app.game.progress.credits);
    await tapSel('#labPanel [data-a="buy"]');
    R.bought = await G(c0 => ({ owned: window.SSX.lab.status().owned, spent: c0 - window.__app.game.progress.credits }), c0);
    ok('buyTap', R.bought, R.bought.owned && R.bought.spent === 1400);
    await tapSel('#labPanel [data-sup="5"]');
    R.sup = await G(() => window.SSX.lab.status().supplies); ok('suppliesTap', R.sup, R.sup === 5);
    R.prod = await G(() => { const L = window.SSX.lab; const h = L.hire('cook'); const s0 = L.status(); L.debug.advance(600); const s1 = L.status(); return { hire: h.ok, running0: s0.batch.running, locker: s1.locker, supplies: s1.supplies, heat: s1.heat, made: s1.stats.made }; });
    ok('production', R.prod, R.prod.hire && R.prod.locker.glowdust === 20 && R.prod.supplies === 0 && R.prod.heat > 0);
    R.purity = await G(() => { const L = window.SSX.lab; const a = L.setProduct('redstatic').ok; const u = L.upgrade('purity'); const b = L.setProduct('redstatic').ok; L.setProduct('glowdust'); return { before: a, up: u.ok, after: b }; });
    ok('purityUnlock', R.purity, !R.purity.before && R.purity.up && R.purity.after);
    R.collect = await G(() => { const L = window.SSX.lab, C = window.SSX.contraband; const r = L.collect(); return { ok: r.ok, moved: r.moved, left: r.left, stash: C.stash().items.glowdust, cap: C.capacity() }; });
    ok('collectOverflow', R.collect, R.collect.ok && R.collect.moved.glowdust > 0 && R.collect.stash.qty === R.collect.moved.glowdust && R.collect.left === 20 - R.collect.moved.glowdust && R.collect.left > 0 && R.collect.stash.fresh <= 0.86);
    R.runner = await G(() => { const L = window.SSX.lab; L.hire('runner'); const t0 = L.status().till; const n = L.debug.sale(); return { n, till: L.status().till - t0, left: L.status().lockerUsed }; });
    ok('runnerSale', R.runner, R.runner.n > 0 && R.runner.till === R.runner.n);
    R.wages = await G(() => { const L = window.SSX.lab, P = window.__app.game.progress; P.credits = 0; L.collect({ force: true }); P.credits = 0; const st = []; for (let i = 0; i < 4; i++) { L.debug.payday(); st.push(L.status().crew.cook.owed); } return { st, cook: L.status().crew.cook, ev: window.__lev.filter(e => e === 'skim' || e === 'quit') }; });
    ok('wagesQuit', R.wages, !R.wages.cook.hired && R.wages.ev.includes('skim') && R.wages.ev.includes('quit'));
    R.offline = await G(() => { const L = window.SSX.lab; window.__app.game.progress.credits = 20000; L.hire('cook'); L.buySupplies(3); return L.debug.advance(36000); });
    ok('offlineCap', R.offline, R.offline === 14400);
    // live gang raid at the door, core spawner (SSX.raids is not on main)
    await G(() => { window.SSX.lab.buySupplies(2); window.SSX.lab.close(); });
    R.raid = await G(() => window.SSX.lab.debug.raid('gang', 'dustjaws').ok);
    const waves = []; let won = false;
    for (let k = 0; k < 40 && !won; k++) { await sleep(1200); const s = await G(() => ({ r: window.SSX.lab.status().raid, n: window.SSX.lab.debug.clearWave(), ev: window.__lev.includes('raid:win') })); if (s.r) waves.push(s.r.phase + s.r.wave); won = s.ev; if (k === 3 && !desk) { await page.screenshot({ path: `${out}lab-raid-${tag}.png` }); R.raidShot = `${out}lab-raid-${tag}.png`; } }
    ok('raidWin', { won, waves: [...new Set(waves)].slice(0, 8), engine: await G(() => window.SSX.lab.debug.engine()) }, won);
    // lost ColSec raid while away: stock loss + a damaged upgrade + downtime
    R.lost = await G(() => { const L = window.SSX.lab, s = window.__app.surface, c = s.info.colony; s.debugMove(c.x + 10, c.z + 10, 0);
      L.debug.advance(0); const before = L.status().lockerUsed; L.debug.heat(90); L.debug.raid('colsec'); L.debug.resolve(false); const st = L.status();
      return { before, after: st.lockerUsed, damaged: st.upgrades.purity.damaged, down: st.downtime, heat: st.heat, why: st.batch.why, rep: L.repair('purity').ok }; });
    ok('raidLose', R.lost, R.lost.after < R.lost.before && R.lost.damaged && R.lost.down > 0 && R.lost.rep);
    R.heatCtl = await G(() => { const L = window.SSX.lab; L.debug.heat(80); const g = L.greaseBeat(); const h1 = L.status().heat; const l = L.layLow(); return { g: g.ok, h1, l: l.ok, h2: L.status().heat }; });
    ok('heatControl', R.heatCtl, R.heatCtl.g && R.heatCtl.h1 === 40 && R.heatCtl.l && R.heatCtl.h2 === 10);
    // panel screenshot at the door with stock
    await G(() => { const L = window.SSX.lab; L.debug.reset(); window.__app.game.progress.credits = 20000; L.buy({ force: true }); L.buySupplies(6); L.hire('cook'); L.hire('runner'); L.hire('guard'); L.upgrade('speed'); L.debug.advance(300); L.debug.heat(48); L.debug.goto(); }); await sleep(800);
    if (desk) { await page.keyboard.press('BracketLeft'); await sleep(400); ok('hotkey', await G(() => document.getElementById('labPanel').classList.contains('show'))); }
    else await tapSel('#labAct');
    await sleep(1200); await page.screenshot({ path: `${out}lab-${tag}.png` }); R.shot = `${out}lab-${tag}.png`;
    ok('noSecondDock', await G(() => document.querySelectorAll('#ssxDock').length <= 1));
    ok('persist', await G(() => !!localStorage.getItem('ssx.lab.v1')));
    R.events = await G(() => [...new Set(window.__lev)]);
  } catch (e) { R.fatal = e.message; bad.push('fatal'); }
  R.errors = errors.slice(0, 8); if (errors.length) bad.push('errors'); R.bad = bad;
  console.log(JSON.stringify(R)); await browser.close();
})();
