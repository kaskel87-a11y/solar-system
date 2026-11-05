// v7.5.49 playtest fixes (BUGS-v7.5.47): m1 every ☰ menu row tappable above the pinned ✖ Close; m2 crane buy label inside
// its button + street cred chip clear of the tutorial card; m3 rail-rifle centre shot hits (crosshair = canvas centre,
// also inside the zoom fit) with a slow rig delay between aim and fire; p2 a quick 2nd tap still clicks a click-only button.
// BASE=http://127.0.0.1:8811/ DEV="iPhone SE" OUT=/workspace/vpfit/v49/ node tests/test-v7549.js
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', DEV = process.env.DEV || 'iPhone 14', out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const { defaultBrowserType: _d, ...dev } = pw.devices[DEV]; const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = DEV.replace(/\W+/g, '-').toLowerCase(), G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, c) => { if (c === undefined) c = v; R[k] = v ?? !!c; if (!c) bad.push(k); };
  const ctr = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; }, sel);
  const tap = async sel => { const c = await ctr(sel); if (c) await page.touchscreen.tap(c[0], c[1]); return !!c; };
  try {
    await page.goto(base + '?t=' + Date.now()); await page.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await page.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, null, { timeout: 90000 }); await sleep(1200);
    await G(() => { document.getElementById('radioLater')?.click(); window.__app.surface.game.setAliens?.(false); });
    // ---- p2: two quick taps on a click-only button both fire ----
    await G(() => { const b = document.createElement('button'); b.id = '__qt'; b.textContent = 'qt'; b.style.cssText = 'position:fixed;left:150px;top:330px;z-index:99;width:80px;height:50px'; window.__qtN = 0; b.addEventListener('click', () => window.__qtN++); document.body.appendChild(b); });
    await tap('#__qt'); await sleep(120); await tap('#__qt'); await sleep(300);
    const zoomAfter = await G(() => visualViewport.scale);
    ok('p2.quickTaps', await G(() => window.__qtN), (await G(() => window.__qtN)) === 2 && zoomAfter < 1.01);
    await G(() => document.getElementById('__qt').remove());
    // ---- m1: every menu row tappable when scrolled to be the lowest visible row ----
    await tap('#menuBtn'); await sleep(700);
    const rows = await G(() => [...document.querySelectorAll('#roverMenu > button')].filter(b => b.id !== 'rmClose' && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width).map((b, i) => { b.dataset.t49 = i; return i; }));
    const covered = [];
    for (const i of rows) {
      const hit = await G(i => { const m = document.getElementById('roverMenu'), b = m.querySelector(`[data-t49="${i}"]`); b.scrollIntoView({ block: 'nearest' }); m.scrollTop += 0; const r = b.getBoundingClientRect(), mr = m.getBoundingClientRect();
        const y = Math.min(r.top + r.height / 2, mr.bottom - 2), e = document.elementFromPoint(r.left + r.width / 2, y); return e && (e === b || b.contains(e)) ? 1 : (e?.id || e?.tagName); }, i);
      await sleep(30); if (hit !== 1) covered.push([i, hit]);
    }
    ok('m1.rowsTappable', JSON.stringify({ rows: rows.length, covered }), rows.length > 5 && covered.length === 0);
    await G(() => { const m = document.getElementById('roverMenu'); m.scrollTop = m.scrollHeight; }); await sleep(300); await page.screenshot({ path: out + `menu-bottom-${tag}.png` });
    await tap('#rmClose'); await sleep(400);
    // ---- m2: crane label + cred chip ----
    const b = await G(async () => { let bs = window.SSX.crane?.debug?.builds?.() || []; if (!bs.length) { const ds = window.__app.surface.world.districts(); const r = ds.find(d => /rough|flats/i.test(d.id + d.name)); if (r) window.__app.surface.debugPlace(r.x, r.z, 0); } return bs[0] || null; });
    if (!b) await sleep(4000);
    const b2 = b || await G(() => window.SSX.crane.debug.builds()[0]);
    if (b2) { await G(([x, z]) => window.__app.surface.debugPlace(x + 3.5, z, -Math.PI / 2), [b2.x, b2.z]); await sleep(2500); }
    const m2 = await G(() => { const bt = document.getElementById('craneBtn'), ch = document.getElementById('stChip'); const r = bt?.getBoundingClientRect();
      const fits = bt && r.width ? (bt.scrollHeight <= bt.clientHeight + 1 && bt.scrollWidth <= bt.clientWidth + 1) : null;
      const cr = ch && ch.classList.contains('show') ? ch.getBoundingClientRect() : null, hits = [];
      if (cr) for (const [x, y] of [[cr.left + 3, cr.top + 3], [cr.right - 3, cr.top + 3], [cr.left + 3, cr.bottom - 3], [cr.right - 3, cr.bottom - 3]]) for (const e of document.elementsFromPoint(x, y)) { if (e === ch || ch.contains(e) || /^(CANVAS|BODY|HTML)$/.test(e.tagName) || getComputedStyle(e).pointerEvents === 'none' && !e.textContent.trim()) continue; hits.push(e.id || e.className || e.tagName); }
      return { label: bt?.textContent, fits, chip: ch?.textContent, chipShown: !!cr, chipHits: hits }; });
    ok('m2.craneLabelFits', JSON.stringify(m2), m2.fits === true);
    ok('m2.chipClear', JSON.stringify(m2.chipHits), m2.chipShown ? m2.chipHits.length === 0 : true);
    await page.screenshot({ path: out + `crane-${tag}.png` });
    // ---- m3: sniper centre shot, playtest-style (aim, slow 2.5 s, then tap Fire) ----
    await G(() => { window.__app.game.progress.unlocks.push('weapon:railrifle'); window.__app.game.progress.inv.slugs = 12; window.SSX.sniper.start('kesh'); });
    const tw = await G(() => window.SSX.sniper.debug.tower()); await G(([x, z]) => window.__app.surface.debugPlace(x, z, 0), [tw.ringX, tw.ringZ]); await sleep(1500);
    await G(() => window.SSX.sniper.debug.climb()); await sleep(800); await G(() => window.SSX.sniper.scope(true)); await sleep(1200);
    const cen = await G(() => { const c = document.querySelector('canvas.ssx-main').getBoundingClientRect(), s = document.querySelector('#snScope svg').getBoundingClientRect(); return [c.left + c.width / 2 - (s.left + s.width / 2), c.top + c.height / 2 - (s.top + s.height / 2)].map(v => +v.toFixed(1)); });
    ok('m3.crosshairAtCentre', JSON.stringify(cen), Math.abs(cen[0]) < 1.5 && Math.abs(cen[1]) < 1.5);
    await G(() => window.SSX.sniper.debug.aimAtMark('head')); await sleep(2500); await page.screenshot({ path: out + `scope-aimed-${tag}.png` });
    await tap('#snFire'); await sleep(800);
    const st = await G(() => ({ ...window.SSX.sniper.stats(), last: window.SSX.sniper.debug.lastShot() }));
    ok('m3.centreShotHits', JSON.stringify({ shots: st.shots, kills: st.kills, heads: st.heads, last: st.last }), st.last?.part && st.last?.clear);
    ok('noErrors', JSON.stringify(errors.slice(0, 3)), errors.length === 0);
  } catch (e) { ok('crash', String(e).slice(0, 300), false); }
  await browser.close(); console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS'); process.exit(bad.length ? 1 : 0);
})();
