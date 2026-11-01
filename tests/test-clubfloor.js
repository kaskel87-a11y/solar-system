// v7.5.35 browser test: Velvet cocktail waitresses + gamblers. Waitresses move along their loops, the spot follows them,
// tapping '🍸 Cocktail waitress' opens a black/white drink panel, a 15 cr lager is charged + makes you tipsier (bar.js).
// Draw calls from the lobby door. Screenshot (iPhone): OUT/waitresses-<tag>.png (default /workspace/velvet/).
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
  const perf = () => G(() => new Promise(res => { const inf = window.__app.renderer.info; inf.autoReset = false; inf.reset(); let m = 0, t0 = performance.now(); const f = () => { m = Math.max(m, inf.render.calls); inf.reset(); if (performance.now() - t0 < 1500) requestAnimationFrame(f); else { inf.autoReset = true; res(m); } }; requestAnimationFrame(f); }));
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    await G(() => { const st = document.createElement('style'); st.textContent = '#obLine, #radio.mini { display: none !important; }'; document.head.appendChild(st); });
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club' && !!window.__clubFloor, 8000)); await sleep(800);
    ok('crowd', await G(() => `${window.__clubFloor.spectators} spectators in ${window.__clubFloor.baked} meshes`), await G(() => window.__clubFloor.baked > 0 && window.__clubFloor.baked <= 30));
    const w0 = await G(() => window.__clubFloor.waitresses()); await sleep(1500); const w1 = await G(() => window.__clubFloor.waitresses());
    ok('threeWaitresses', w0.length === 3);
    ok('waitressesMove', w1.map((w, i) => Math.hypot(w.x - w0[i].x, w.z - w0[i].z).toFixed(2)).join(' '), w1.some((w, i) => Math.hypot(w.x - w0[i].x, w.z - w0[i].z) > 0.5));
    // facing: the eye strip of a moving waitress points the way she walks
    await G(() => window.__app.surface.debugInside(-11, 22.6, 0)); await sleep(700);
    R.drawCalls = await perf(); ok('drawCallsOk', R.drawCalls, R.drawCalls < 600);
    // drink: stand next to a waitress (re-place while she walks) and tap the spot
    let got = false;
    for (let i = 0; i < 30 && !got; i++) {
      await G(() => { const w = window.__clubFloor.waitresses()[2]; window.__app.surface.debugInside(w.x, w.z + 0.8, 0); });
      got = await wait(() => /Cocktail waitress/.test(document.getElementById('driveBtn').textContent), 400);
    }
    ok('waitressSpot', got);
    if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn');
    ok('panel', await wait(() => document.getElementById('waitressPanel')?.classList.contains('on'), 3000));
    ok('panelBW', await G(() => [...document.querySelectorAll('#waitressPanel button')].every(e => { const c = getComputedStyle(e); return c.backgroundColor === 'rgb(0, 0, 0)' && c.color === 'rgb(255, 255, 255)'; })));
    await page.screenshot({ path: out + `waitress-panel-${tag}.png` });
    const c0 = await G(() => window.__app.game.progress.credits), l0 = await G(() => window.__bar?.level || 0);
    const b = await tapSel('#waitressPanel button[data-d="lager"]'); ok('btn44', `${Math.round(b.w)}x${Math.round(b.h)} hit=${b.hit}`, b.h >= 44 && b.hit);
    ok('charged15', await wait(c => window.__app.game.progress.credits === c - 15, 3000, c0));
    ok('tipsier', await G(l => (window.__bar?.level || 0) > l, l0));
    ok('panelClosed', await wait(() => !document.getElementById('waitressPanel').classList.contains('on'), 2000));
    // screenshot: busy floor with a waitress in view (camera from the south-east of the blackjack table, looking at it)
    await G(() => window.__app.surface.debugInside(-17.5, 21.5, Math.atan2(6.5, 5.5))); await sleep(400);
    for (let i = 0; i < 40; i++) { const v = await G(() => { const s = window.__app.surface, cam = s.camera, inside = s.world.inside; return window.__clubFloor.waitresses().some(w => { const x = inside.ax + w.x, z = inside.az + w.z; const d = Math.hypot(x - cam.position.x, z - cam.position.z); const v = { x, y: (inside.floor || 0) + 1.2, z }; const p = cam.position.clone().set(v.x, v.y, v.z).project(cam); return d < 16 && Math.abs(p.x) < 0.7 && Math.abs(p.y) < 0.8 && p.z < 1; }); }); if (v) break; await sleep(500); }
    await page.screenshot({ path: out + `waitresses-${tag}.png` });
    ok('noErrors', errors.length ? errors.slice(0, 3).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.fails = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
