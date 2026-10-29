// v7.5.4 test: Danny Alvarez's private show (privateshow.js). Talk to her in the VIP room, 18+ gate, offer panel,
// pay 150, upstairs booth (cinematic camera, HUD hidden), three tips unlock her number, touching gets you thrown out.
// Also renders FRONT / SIDE / PRIVATE SHOW screenshots and reports draw calls, textures, frame time and browser PSS.
// v3: FACE close-up, LAP DANCE booth shots (250 cr chair dance: distance to the player, tip, leave), crossfade pops
// (peak core-bone angular speed inside crossfades vs. steady clips) and Danny's phone texts (toast, list, storage).
// BASE=http://localhost:8765/ BR=chromium DEV=desktop node tests/test-danny.js   (DEV="iPhone 14" BR=webkit for touch)
// W=375 H=667 BR=webkit DEV=touch: a custom touch viewport
const pw = require('playwright'), fs = require('fs');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function pss(rootPid) { // sum PSS (kB) over the browser's process tree (Linux)
  const kids = {}; for (const d of fs.readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); const pp = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; (kids[pp] = kids[pp] || []).push(+d); } catch (e) {} }
  let sum = 0, max = 0; const q = [rootPid];
  while (q.length) { const p = q.pop(); try { const m = /Pss:\s+(\d+)/.exec(fs.readFileSync(`/proc/${p}/smaps_rollup`, 'utf8')); if (m) { sum += +m[1]; max = Math.max(max, +m[1]); } } catch (e) {} q.push(...(kids[p] || [])); }
  return { totalMB: Math.round(sum / 1024), maxProcMB: Math.round(max / 1024) };
}
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctxOpts = desk ? { viewport: { width: 1366, height: 768 } } : DEV === 'touch' ? { viewport: { width: +process.env.W, height: +process.env.H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: pw.devices['iPhone 14'].userAgent } : { ...pw.devices[DEV] };
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = `${DEV === 'touch' ? process.env.W + 'x' + process.env.H : DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, top: t && (t.id || t.closest('[id]')?.id) }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn'); };
  const perf = () => G(() => new Promise(res => { // frame time + per-frame draw calls over ~2 s
    const r = window.__app.renderer, inf = r.info; inf.autoReset = false; inf.reset(); let n = 0, calls = 0, tris = 0, t0 = performance.now();
    const f = () => { n++; calls = Math.max(calls, inf.render.calls); tris = Math.max(tris, inf.render.triangles); inf.reset(); if (performance.now() - t0 < 2000) requestAnimationFrame(f); else { inf.autoReset = true; res({ fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), drawCalls: calls, tris, textures: inf.memory.textures, geometries: inf.memory.geometries }); } };
    requestAnimationFrame(f); }));
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(500);
    await G(() => { window.__app.game.setFlag?.('vip'); window.__app.surface.world.openVip(); });
    // the stage dancers still load and dance (regression for the 50 cr dance next to her)
    await G(() => window.__app.surface.debugInside(7.6, -4.4, 0)); ok('privateLabel', await wait(() => /Dance · 50 cr/.test(document.getElementById('driveBtn').textContent), 4000));
    await G(() => window.__app.surface.debugInside(6.55, -5.3, 0));
    ok('showLabel', await wait(() => /Private show 150/.test(document.getElementById('driveBtn').textContent), 4000), undefined);
    R.showLabel = await G(() => document.getElementById('driveBtn').textContent);
    await act(); ok('adultGate', await wait(() => getComputedStyle(document.getElementById('adultGate')).display === 'flex', 3000));
    await tapSel('#adultYes'); ok('offerPanel', await wait(() => getComputedStyle(document.getElementById('pshowOffer')).display === 'flex', 3000));
    const ob = await center('#pshowYes'); ok('offerBtn44', `${Math.round(ob.w)}x${Math.round(ob.h)} top=${ob.top}`, ob.h >= 44 && ob.top === 'pshowYes');
    ok('offerBW', await G(() => { const c = getComputedStyle(document.getElementById('pshowNo')); return c.backgroundColor + ' / ' + c.color; }), await G(() => { const c = getComputedStyle(document.getElementById('pshowNo')); const el = document.getElementById('pshowNo'); return (c.backgroundColor === 'rgb(0, 0, 0)' && c.color === 'rgb(255, 255, 255)') || (el.matches(':active') && c.backgroundColor === 'rgb(255, 255, 255)'); })); // the press state inverts (a tap on the 18+ gate can leave :active on the button under the finger)
    const c0 = await G(() => window.__app.game.progress.credits);
    await tapSel('#pshowYes'); ok('paid150', await wait(c => window.__app.game.progress.credits === c - 150, 4000, c0));
    ok('showActive', await wait(() => window.__pshow.active && window.__pshow.state.ready && document.body.classList.contains('pshow'), 20000));
    await sleep(1500);
    ok('camInBooth', await G(() => window.__pshow.state.camInBooth));
    ok('hudHidden', await G(() => getComputedStyle(document.getElementById('surfHud')).visibility === 'hidden'));
    const tb = await center('#pshowTip'); ok('tipBtn', `${Math.round(tb.w)}x${Math.round(tb.h)} top=${tb.top}`, tb.h >= 44 && tb.top === 'pshowTip');
    const pz = await G(() => window.__app.surface.info && [window.__app.surface.info.x, window.__app.surface.info.z].map(v => +v.toFixed(2)).join());
    if (!desk) { await page.touchscreen.tap(60, (await G(() => innerHeight)) - 90); } else { await page.keyboard.down('KeyW'); await sleep(600); await page.keyboard.up('KeyW'); }
    ok('seated', await G(p => [window.__app.surface.info.x, window.__app.surface.info.z].map(v => +v.toFixed(2)).join() === p, pz));
    await sleep(1200); await page.screenshot({ path: `${out}danny-${tag}-private-show.png` }); R.shotShow = `${out}danny-${tag}-private-show.png`;
    R.perfShow = await perf(); R.dancer = await G(() => window.__pshow.state.stats);
    R.pss = pss(process.pid); // this test's process tree: node + playwright driver + browser
    // three tips: bonus time + her number
    const left0 = await G(() => window.__pshow.state.left), c1 = await G(() => window.__app.game.progress.credits);
    for (let i = 0; i < 3; i++) { if (desk) await page.keyboard.press('KeyT'); else await tapSel('#pshowTip'); await sleep(350); }
    ok('tips', await G(() => window.__pshow.state.tips), await G(c => window.__pshow.state.tips === 3 && window.__app.game.progress.credits === c - 60, c1));
    ok('tipBonus', await G(l => +(window.__pshow.state.left - l).toFixed(1), left0), await G(l => window.__pshow.state.left > l + 10, left0));
    ok('number', await G(() => localStorage.getItem('ssx.contacts')), await G(() => /Danny Alvarez/.test(localStorage.getItem('ssx.contacts') || '') && /contacts/.test(document.getElementById('pshowCap').textContent)));
    await page.screenshot({ path: `${out}danny-${tag}-number.png` });
    // FRONT / SIDE views of her in the booth light
    await G(() => window.__pshow.debugView('front')); await sleep(1500); await page.screenshot({ path: `${out}danny-${tag}-front.png` });
    await G(() => window.__pshow.debugView('side')); await sleep(1200); await page.screenshot({ path: `${out}danny-${tag}-side.png` });
    await G(() => window.__pshow.debugView('face')); await sleep(1500); await page.screenshot({ path: `${out}danny-${tag}-face.png` });
    await G(() => window.__pshow.debugView(null)); await sleep(300);
    const pop = await G(() => ({ x: +window.__pshow.state.popX.toFixed(2), n: +window.__pshow.state.popN.toFixed(2) }));
    ok('noPops', `crossfade ${pop.x} rad/s vs steady ${pop.n}`, pop.x > 0 && pop.x <= Math.max(pop.n * 1.25, 9));
    // hands off: touching gets you thrown out
    if (desk) await page.keyboard.press('KeyE'); else await tapSel('#pshowTouch');
    ok('bouncer', await wait(() => /TINY/.test(document.getElementById('pshowCap').textContent), 3000));
    ok('fadeToBlack', await wait(() => document.getElementById('fadeBlack').classList.contains('on'), 4000));
    ok('thrownOut', await wait(() => !window.__app.surface.info.inside && !window.__pshow.active, 8000));
    ok('fadeOut', await wait(() => !document.getElementById('fadeBlack').classList.contains('on'), 6000));
    ok('hudBack', await G(() => !document.body.classList.contains('pshow') && !document.body.classList.contains('cinebars')));
    // texts from her, later in play (the play clock is fast-forwarded): toast, list, stored on the device
    await G(() => window.__texts.skip(80)); ok('text1', await G(() => window.__texts.state.msgs.length === 1 && /Danny/.test(document.getElementById('toast')?.textContent || '')));
    await G(() => { window.__texts.skip(300); window.__texts.skip(400); });
    R.texts = await G(() => window.__texts.state.msgs.map(m => m.id).join());
    ok('textsStored', await G(() => (JSON.parse(localStorage.getItem('ssx.texts') || '{}').msgs || []).length >= 3 && /Airlock/.test(localStorage.getItem('ssx.texts')) && /driver/.test(localStorage.getItem('ssx.texts'))));
    if (!desk) for (let i = 0, p = null; i < 12; i++) { const c = await center('#dockTexts'); if (p && c && c.x === p.x && c.y === p.y && c.top === 'dockTexts') break; p = c; await sleep(400); } // the dock re-flows when the door/interact button pops in; tap once it has settled
    if (desk) await page.keyboard.press('KeyI'); else await tapSel('#dockTexts');
    ok('textsOpen', await wait(() => document.getElementById('ssxTexts').classList.contains('show') && document.querySelectorAll('#ssxTexts .b').length >= 3, 3000));
    const xb = await center('#ssxTextsClose'); ok('textsClose44', `${Math.round(xb.w)}x${Math.round(xb.h)} top=${xb.top}`, xb.h >= 44 && xb.top === 'ssxTextsClose');
    await page.screenshot({ path: `${out}danny-${tag}-texts.png` });
    ok('textsRead', await G(() => window.__texts.state.unread === 0));
    await tapSel('#ssxTextsClose'); ok('textsClosed', await wait(() => !document.getElementById('ssxTexts').classList.contains('show'), 2000));
    // and back in: the club still works, a leave ends cleanly
    await G(() => window.__app.surface.enterBuilding()); ok('reEnter', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));
    await G(() => { window.__app.surface.world.openVip(); window.__app.surface.debugInside(6.55, -5.3, 0); }); await wait(() => /Private show/.test(document.getElementById('driveBtn').textContent), 4000);
    await act(); await wait(() => getComputedStyle(document.getElementById('pshowOffer')).display === 'flex', 3000);
    const lb = await center('#pshowLap'); ok('lapBtn44', `${Math.round(lb.w)}x${Math.round(lb.h)} top=${lb.top}`, lb.h >= 44 && lb.top === 'pshowLap');
    const c2 = await G(() => window.__app.game.progress.credits); await tapSel('#pshowLap');
    ok('paid250', await wait(c => window.__app.game.progress.credits === c - 250, 4000, c2));
    ok('lapActive', await wait(() => window.__pshow.active && window.__pshow.state.ready && window.__pshow.state.mode === 'lap', 20000));
    // distance check while the routine runs: her feet stay clear of the chair front (z 0.95) and of the player's knees
    let minGap = 9, beats = new Set(); const t0 = Date.now();
    const sample = async ms => { const e = Date.now() + ms; while (Date.now() < e) { const s = await G(() => window.__pshow.state); if (!s) break; beats.add(s.beat); const gap = Math.max(0.95 - s.herZ, Math.abs(s.herX) - 0.56); /* clearance outside the chair box (front edge z 0.95, armrests |x| 0.56) */ minGap = Math.min(minGap, gap); await sleep(150); } };
    await sample(3500); await page.screenshot({ path: `${out}danny-${tag}-lap-approach.png` });
    await G(() => window.__pshow.lapBeat('tease')); await sample(2500); await page.screenshot({ path: `${out}danny-${tag}-lap-tease.png` });
    await G(() => window.__pshow.lapBeat('lean')); await sample(3200); await page.screenshot({ path: `${out}danny-${tag}-lap-lean.png` });
    ok('lapCamInBooth', await G(() => window.__pshow.state.camInBooth));
    await G(() => window.__pshow.lapBeat('circle')); await sample(3600); await page.screenshot({ path: `${out}danny-${tag}-lap-circle.png` });
    await G(() => window.__pshow.lapBeat('return')); await sample(1800);
    ok('lapGap', +minGap.toFixed(2), minGap >= 0.12); R.lapBeats = [...beats].join();
    R.perfLap = await perf();
    const lt = await G(() => window.__pshow.state.left); if (desk) await page.keyboard.press('KeyT'); else await tapSel('#pshowTip');
    ok('lapTip', await G(l => window.__pshow.state.left > l + 4, lt));
    const lpop = await G(() => ({ x: +window.__pshow.state.popX.toFixed(2), n: +window.__pshow.state.popN.toFixed(2) }));
    ok('lapNoPops', `crossfade ${lpop.x} rad/s vs steady ${lpop.n}`, lpop.x <= Math.max(lpop.n * 1.25, 9));
    if (desk) await page.keyboard.press('Escape'); else await tapSel('#pshowLeave');
    ok('leaveEnds', await wait(() => !window.__pshow.active && !document.getElementById('fadeBlack').classList.contains('on'), 6000));
    ok('stillInClub', await G(() => window.__app.surface.info.inside?.kind === 'club'));
    R.perfClub = await perf();
    await G(() => window.__app.surface.leaveBuilding());
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
