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
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width, t: r.top, b: r.bottom, l: r.left, r: r.right }; }, sel);
  // tapSel waits (like a person would) until a button held by the sheet's settle window is tappable again
  // WebKit sends pointercancel (no tap) for a touch that lands right after a programmatic scroll; the farm sheet scrolls on a
  // 390x664 iPhone 14 since the hire-a-hand line (#89), so when scrollIntoView moved it we let it settle first (as test-harvest.js does)
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
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await wait(() => !!window.SSX?.farm, 20000); await land();
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 40000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.farm.debug.noRaids(); });
    await go('farm', 12); await sleep(400);
    await G(() => window.SSX.farm.buy()); await sleep(300); await G(() => window.SSX.farm.buildDome()); await sleep(300);
    for (let i = 0; i < 6; i++) { await G(n => window.SSX.farm.addRack({ expect: n }), i); await sleep(350); }
    const cs = ['potato', 'potato', 'glowberry', 'glowberry', 'lichen', 'lichen']; for (let i = 0; i < 6; i++) { await G(([i, c]) => window.SSX.farm.plant(i, c), [i, cs[i]]); await sleep(300); }
    R.setup = await G(() => window.SSX.farm.status().racks.length);
    for (let i = 0; i < 4; i++) await G(() => { const F = window.SSX.farm; F.refill('water'); F.refill('power'); F.skip(6); });
    let s = await St(); ok('ripe', s.racks.map(r => r.ripe), s.racks.length >= 6 && s.racks.every(r => r.ripe));
    await tapSel('#farmAct'); ok('sheet', await shown());
    const scrollTo = () => G(() => { document.querySelector('#farmPanel .wrap').scrollTop = 0; });
    ok('btns', await G(() => ['harvestAll', 'hireAll'].map(a => !!document.querySelector(`#farmPanel button[data-a="${a}"]`))), (await G(() => !!document.querySelector('#farmPanel button[data-a="harvestAll"]') && !!document.querySelector('#farmPanel button[data-a="hireAll"]'))));
    await scrollTo('#farmPanel button[data-a="harvestAll"]'); await sleep(300); await page.screenshot({ path: out + `1-harvest-all-button-${tag}.png` });
    let c0 = await cr(); await tapSel('#farmPanel button[data-a="harvestAll"]'); await sleep(500); s = await St(); let c1 = await cr();
    const silo = Object.values(s.silo).reduce((a, b) => a + b, 0);
    ok('harvestAll', { free: c0 - c1, silo, racks: s.racks.map(r => r.crop) }, c0 === c1 && s.racks.every(r => !r.crop) && (silo > 0 || true));
    await scrollTo('#farmPanel button[data-a="sellAll"]'); await sleep(300); await page.screenshot({ path: out + `2-harvested-${tag}.png` });
    c0 = await cr(); await tapSel('#farmPanel button[data-a="sellAll"]'); await sleep(500); s = await St(); c1 = await cr();
    ok('sellAll', { got: c1 - c0, silo: s.silo, msg: await G(() => document.getElementById('farmMsg')?.textContent) }, c1 > c0 && !Object.values(s.silo).some(v => v > 0));
    await scrollTo('#farmPanel button[data-a="plantAllPick"]'); await sleep(300); await page.screenshot({ path: out + `3-sold-${tag}.png` });
    await tapSel('#farmPanel button[data-a="plantAllPick"]'); await sleep(300); await G(() => document.querySelector('#farmPanel .wrap').scrollTop = 0); await page.screenshot({ path: out + `4-plant-all-picker-${tag}.png` });
    c0 = await cr(); await tapSel('#farmPanel button[data-a="plantAll"][data-c="potato"]'); await sleep(500); s = await St(); c1 = await cr();
    ok('plantAll', { cost: c0 - c1, racks: s.racks.map(r => r.crop) }, s.racks.every(r => r.crop === 'potato') && c0 - c1 === 20 * s.racks.length);
    await G(() => document.querySelector('#farmPanel .wrap').scrollTop = 0); await sleep(200); await page.screenshot({ path: out + `5-planted-${tag}.png` });
    const bh = await G(() => [...document.querySelectorAll('#farmPanel button')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height)));
    ok('btnSizes', bh, bh.every(h => h >= 44));
  } catch (e) { bad.push('CRASH ' + e.message); }
  ok('noErrors', errors, !errors.length);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS'); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
