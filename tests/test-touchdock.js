// Phone hotkey parity check (390x844 iPhone 14 WebKit): every Marsmania hotkey has a visible 44px+ black/white touch
// button bound with __onTap. MODE=contraband|jobs|turf BASE=… OUT=… node marsmania-test-touchdock.js
const pw = require('playwright');
const base = process.env.BASE, MODE = process.env.MODE, out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', DEV = process.env.DEV || 'iPhone 14', BR = process.env.BR || 'webkit';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(); const desk = DEV === 'desktop';
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const G = (f, a) => page.evaluate(f, a), R = { MODE, DEV }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 20000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const box = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width, top: r.top, vis: c.display !== 'none' && c.visibility !== 'hidden' && r.height > 0, bg: c.backgroundColor, fg: c.color, text: e.textContent }; }, sel);
  const tapSel = async sel => { const b = await box(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(400); };
  const checkBtn = async (k, sel) => { const b = await box(sel); ok(k, b && `${Math.round(b.w)}x${Math.round(b.h)} ${b.bg}/${b.fg} '${b.text.replace(/\n/g, ' ')}'`, !!b && b.vis && b.h >= 44 && b.w >= 44 && b.bg === 'rgb(0, 0, 0)' && b.fg === 'rgb(255, 255, 255)'); return b; };
  const shot = async n => { try { await page.screenshot({ path: `${out}touch-${MODE}-${DEV.replace(/\W+/g, '-').toLowerCase()}-${n}.png`, timeout: 120000 }); R.shots = (R.shots || []).concat(n); } catch (e) { R.shotFail = n; } };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    const dock = { contraband: ['#dockStash', '#cbPanel', '#cbClose'], jobs: ['#dockJobs', '#jobPanel', '#jobClose'], turf: ['#dockTurf', '#turfPanel', '#turfClose'] }[MODE];
    if (desk) { const b = await box(dock[0]); ok('dockHiddenOnDesktop', !b?.vis); }
    else if (await G(() => document.body.classList.contains('hxFold'))) {
      // v7.5.5 HUD pass: on phones the dock folds into the ☰ menu; the same panel opens from there
      ok('dockFolded', !(await box(dock[0]))?.vis);
      const word = { contraband: 'Stash', jobs: 'Jobs', turf: 'Turf' }[MODE];
      await tapSel('#menuBtn'); await sleep(300);
      ok('menuItem', await G(w => { const b = [...document.querySelectorAll('#roverMenu button')].find(e => e.textContent.includes(w) && getComputedStyle(e).display !== 'none'); if (b) b.dataset.td = '1'; return b ? b.textContent.trim() : false; }, word));
      await tapSel('#roverMenu button[data-td="1"]'); ok('menuOpensPanel', await wait(sel => document.querySelector(sel).classList.contains('show'), 4000, dock[1]));
      await shot('panel'); await tapSel(dock[2]); ok('panelClosed', !(await G(sel => document.querySelector(sel).classList.contains('show'), dock[1])));
    }
    else {
      const b = await checkBtn('dockBtn', dock[0]); R.dockTop = Math.round(b?.top);
      // no overlap with core touch controls (Jump/Run/Pet column, FIRE, minimap)
      R.overlaps = await G(sel => { const r = document.querySelector(sel).getBoundingClientRect(); const hit = []; for (const e of document.querySelectorAll('button, #minimap, canvas#mini, #touchStick, .stick')) { if (e.closest('#ssxDock') || e.closest('#cbPanel,#jobPanel,#turfPanel')) continue; const q = e.getBoundingClientRect(), c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || !q.width) continue; if (q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hit.push(e.id || e.className || e.tagName); } return hit; }, dock[0]);
      ok('noOverlap', R.overlaps.join(','), !R.overlaps.length);
      await tapSel(dock[0]); ok('dockOpensPanel', await wait(sel => document.querySelector(sel).classList.contains('show'), 4000, dock[1]));
      await shot('panel'); await tapSel(dock[2]); ok('panelClosed', !(await G(sel => document.querySelector(sel).classList.contains('show'), dock[1])));
    }
    if (MODE === 'contraband') { // turf price hook, guarded
      const r = await G(() => { const C = window.SSX.contraband, id = C.items()[0].id, d = 'red-tape-flats'; const p0 = C.buyerPrice(id, d);
        window.SSX.turf = { priceMultiplier: () => 2 }; const p2 = C.buyerPrice(id, d);
        let seen = null; window.SSX.turf = { priceMultiplier: (dd, pos) => { seen = [dd, pos]; return 1.5; } }; const s = window.__app.surface, c = s.info.colony; s.debugMove(c.x - 280, c.z - 20, 0); C.buyerPrice(id); const seenCur = seen;
        window.SSX.turf = { priceMultiplier: () => { throw new Error('x'); } }; const pt = C.buyerPrice(id, d);
        window.SSX.turf = { priceMultiplier: () => NaN }; const pn = C.buyerPrice(id, d);
        delete window.SSX.turf; const pa = C.buyerPrice(id, d); return { p0, p2, pt, pn, pa, seenCur: JSON.stringify(seenCur) }; });
      R.price = r; ok('turfMult', Math.abs(r.p2 - 2 * r.p0) <= 1 && r.pt === r.p0 && r.pn === r.p0 && r.pa === r.p0);
      ok('playerPosDefault', /"x":-?\d/.test(r.seenCur));
    }
    if (MODE === 'jobs') { // G = #jobAct: shows on touch for stabilise and at a beacon
      await G(() => { window.SSX.jobs.debug.setDone('paramedic', 0); window.SSX.jobs.start('paramedic'); window.SSX.jobs.debug.goto(); }); await sleep(800);
      await wait(() => window.SSX.jobs.active()?.stage === 'stabilise', 8000);
      if (await G(() => window.__app.surface.info.driving)) await G(() => window.__app.surface.interact());
      await G(() => { const s = window.__app.surface, t = window.SSX.jobs.active().target, c = s.info.colony; s.debugPlace(c.x + t.x + 1.2, c.z + t.z + 0.8, 0); }); await sleep(800);
      ok('stabShows', await wait(() => /Stabilise/.test(document.getElementById('jobAct').textContent) && getComputedStyle(document.getElementById('jobAct')).display !== 'none', 6000));
      await checkBtn('gBtn', '#jobAct'); await shot('g');
      const t0 = await G(() => window.SSX.jobs.debug.target()?.patient ? 0 : -1); await tapSel('#jobAct');
      ok('gTapWorks', await G(() => window.SSX.jobs.active()?.stage !== 'stabilise' || /Stabilise [1-9]/.test(document.getElementById('jobAct').textContent)));
      await G(() => window.SSX.jobs.stop());
      await G(() => { const s = window.__app.surface, c = s.info.colony, p = window.SSX.jobs.places().taxiStands[0]; s.debugPlace(c.x + p[0] + 1, c.z + p[1] + 1, 0); }); await sleep(800);
      ok('beaconShows', await wait(() => /Start Taxi/.test(document.getElementById('jobAct').textContent) && getComputedStyle(document.getElementById('jobAct')).display !== 'none', 6000));
    }
    if (MODE === 'turf') { // Y = #turfAct at a block flag
      await G(() => { window.SSX.turf.debug.reset(); window.SSX.turf.debug.goto('hab-stacks'); }); await sleep(800);
      ok('yShows', await wait(() => /Take Hab Stacks/.test(document.getElementById('turfAct').textContent) && getComputedStyle(document.getElementById('turfAct')).display !== 'none', 8000));
      await checkBtn('yBtn', '#turfAct'); await shot('y');
      await tapSel('#turfAct'); ok('yTapWorks', await G(() => window.SSX.turf.fight()?.kind === 'take'));
      const RT = await G(() => document.body.classList.contains('hudx') ? '#hxQuit' : '#turfRetreat'); await checkBtn('retreatBtn', RT); await tapSel(RT); // v7.5.5: Retreat lives in the mission card ok('retreated', await G(() => !window.SSX.turf.fight()));
    }
  } catch (e) { R.exception = String(e && e.stack || e); bad.push('exception'); }
  R.errors = errors.slice(0, 8); if (errors.length) bad.push('consoleErrors'); R.bad = bad; R.pass = !bad.length;
  console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
