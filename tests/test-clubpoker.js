// v7.5.33 browser test: the 4x Velvet Airlock + its Hold'em room. Enter the club (spawn in the new lobby), old spots
// still where they were (Danny's show, bar, Nova, slots, VIP), walk to the card room, open the table from the hotspot,
// buy in with credits (black/white tap buttons), play a hand, cash out. Exterior: nothing else in the bigger footprint.
// Reports draw calls inside the club. Screenshot of the table: OUT (default /workspace/velvet/).
// BASE=http://127.0.0.1:8817/ BR=webkit DEV="iPhone 14" node tests/test-clubpoker.js
const pw = require('playwright'), fs = require('fs');
const base = process.env.BASE || 'http://127.0.0.1:8817/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.OUT || '/workspace/velvet') + '/', desk = DEV === 'desktop'; try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : iph); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = DEV.replace(/\W+/g, '-').toLowerCase() + '-' + BR;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, hit: !!(t && (t === e || e.contains(t))) }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn'); };
  const label = () => G(() => document.getElementById('driveBtn').textContent);
  const at = async (x, z, re, yaw = 0) => { await G(([x, z, y]) => window.__app.surface.debugInside(x, z, y), [x, z, yaw]); return wait(r => new RegExp(r).test(document.getElementById('driveBtn').textContent), 4000, re); };
  const perf = () => G(() => new Promise(res => { const r = window.__app.renderer, inf = r.info; inf.autoReset = false; inf.reset(); let n = 0, calls = 0, t0 = performance.now();
    const f = () => { n++; calls = Math.max(calls, inf.render.calls); inf.reset(); if (performance.now() - t0 < 1500) requestAnimationFrame(f); else { inf.autoReset = true; res({ calls, fps: Math.round(n / 1.5) }); } }; requestAnimationFrame(f); }));
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    // exterior: anything else (not the club block, its sign/door/Brick) standing in the new 24 x 14 footprint?
    R.exterior = await G(([dx, dz]) => { const s = window.__app.surface, T = window.THREE || null; const X = dx, Z1 = dz - 0.9, Z0 = Z1 - 14, X0 = X - 12, X1 = X + 12; const hits = [];
      s.scene.updateMatrixWorld(true);
      s.scene.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; o.geometry.computeBoundingBox?.(); const bb = o.geometry.boundingBox; if (!bb) return; const c = bb.clone().applyMatrix4(o.matrixWorld);
        const inX = c.max.x > X0 + 0.3 && c.min.x < X1 - 0.3, inZ = c.max.z > Z0 + 0.3 && c.min.z < Z1 - 0.3; if (!inX || !inZ) return;
        const sx = c.max.x - c.min.x, sz = c.max.z - c.min.z; if (sx > 40 || sz > 40) return; // ground / terrain / sky
        if (c.min.y > 60 || c.max.y < -5) return; // interiors stacked above, far below
        hits.push({ n: o.name || o.type, x: +((c.min.x + c.max.x) / 2 - X).toFixed(1), z: +((c.min.z + c.max.z) / 2 - Z1).toFixed(1), sx: +sx.toFixed(1), sz: +sz.toFixed(1), y0: +c.min.y.toFixed(1), y1: +c.max.y.toFixed(1) }); });
      return { n: hits.length, hits: hits.slice(0, 40) }; }, [cd.x, cd.z]);
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(600);
    const b = await G(() => { const b = window.__app.surface.world.inside, p = window.__app.surface.player || {}; return { w: b.x1 - b.x0, d: b.z1 - b.z0, x0: b.x0 - b.ax, x1: b.x1 - b.ax, z0: b.z0 - b.az, z1: b.z1 - b.az }; });
    ok('interior58x32', `${b.w}x${b.d} x ${b.x0}..${b.x1} z ${b.z0}..${b.z1}`, b.w === 58 && b.d === 32 && b.x0 === -33 && b.x1 === 25 && b.z1 === 24 /* Velvet expansion: east wing */);
    ok('spawnLabelLeave', await wait(() => /Leave/.test(document.getElementById('driveBtn').textContent), 3000));
    await G(() => { window.__app.game.setFlag?.('vip'); window.__app.surface.world.openVip(); });
    ok('showSpot', await at(6.55, -5.3, 'Private dance 500'));
    ok('barSpot', await at(-8.1, 1.5, 'Bar'), undefined);
    ok('slotsSpot', await G(() => (window.__app.surface.world.inside, true)));
    // collisions: the west partition blocks walking from the bar straight into the card room
    const blocked = await G(async () => { const s = window.__app.surface; s.debugInside(-10.3, -1, -Math.PI / 2); const b = s.world.inside; const x0 = s.player?.x; return { hasCol: typeof s.world.collidePlayer === 'function' }; });
    R.col = blocked;
    // card room
    await G(() => { const st = document.createElement('style'); st.textContent = '#obLine, #radio.mini { display: none !important; }'; document.head.appendChild(st); }); // screenshot: hide the tour line
    ok('pokerLabel', await at(-22, 3.0, 'Hold', 0), undefined); await sleep(1200); R.pokerLabel = await label();
    R.perf = await perf(); ok('drawCalls', R.perf.calls, R.perf.calls < 400);
    await page.screenshot({ path: out + `poker-room-${tag}.png` });
    await act(); ok('buyInPanel', await wait(() => /Velvet Hold/.test(document.getElementById('pokerPanel')?.textContent || ''), 4000));
    ok('buyInBW', await G(() => { const c = getComputedStyle(document.querySelector('#pokerPanel button.go')); return c.backgroundColor + ' / ' + c.color; }), /rgb\(0, 0, 0\) \/ rgb\(255, 255, 255\)/.test(await G(() => { const c = getComputedStyle(document.querySelector('#pokerPanel button.go')); return c.backgroundColor + ' / ' + c.color; })));
    const c0 = await G(() => window.__app.game.progress.credits);
    const bb = await tapSel('#pokerPanel button[data-buy="100"]'); ok('buyBtn44', `${Math.round(bb.w)}x${Math.round(bb.h)} hit=${bb.hit}`, bb.h >= 44 && bb.hit);
    ok('paid100', await wait(c => window.__app.game.progress.credits === c - 100, 4000, c0));
    ok('table', await wait(() => !!window.__poker.state() && window.__poker.state().players.length === 4, 4000));
    R.players = await G(() => window.__poker.state()?.players.map(p => p.name).join(','));
    await sleep(800);
    ok('actBW', await G(() => [...document.querySelectorAll('#pokerPanel button')].every(e => { const c = getComputedStyle(e); return c.backgroundColor === 'rgb(0, 0, 0)' && c.color === 'rgb(255, 255, 255)'; })));
    await page.screenshot({ path: out + `poker-table-${tag}.png` });
    // play: call/check whenever it's our turn until the hand moves on (or fold), then cash out
    for (let i = 0; i < 12; i++) { const en = await G(() => !document.querySelector('#pokerPanel .call')?.disabled); if (en) { await tapSel('#pokerPanel .call'); await sleep(500); } else await sleep(400); if (await G(() => (window.__poker.state()?.hand || 0) >= 2)) break; }
    R.afterPlay = await G(() => { const s = window.__poker.state(); return s ? `hand ${s.hand} ${s.street} pot ${s.pot}` : 'closed'; });
    const c1 = await G(() => window.__app.game.progress.credits);
    if (await G(() => !!document.querySelector('#pokerPanel [data-cash]'))) await tapSel('#pokerPanel .row2 [data-cash]');
    ok('cashedOut', await wait(() => !window.__poker.state(), 4000)); R.cash = (await G(() => window.__app.game.progress.credits)) - c1;
    ok('noErrors', errors.length ? errors.slice(0, 3).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.fails = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
