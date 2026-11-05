// v7.5.10: Farm Overalls (mars/skins.js) on the current player rig + the sickle (mars/harvest.js) at your own farm.
// Wears the overalls, sets up a ripe rack, FIREs: the sickle cuts (bale grows), the skin stays applied with its parts on the rig,
// the harvest rig (sickle + bale) is visible, and a screenshot from the front shows both. Also checks every skin applies to the
// current rig (parts > 0, no errors).  BASE=http://127.0.0.1:8866/ BR=webkit DEV=393x852 OUT=/tmp/ node tests/test-skins-harvest.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8866/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852', desk = DEV === 'desktop';
const out = process.env.OUT || './shots/', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...iph, viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 } });
  const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push('PE ' + e.message.slice(0, 160)));
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase(), R = { tag }, bad = [];
  const G = (f, a) => page.evaluate(f, a), ok = (k, v, c) => { if (c === undefined) c = v; R[k] = v; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const fr = async (n = 4) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, 60000, f0 + n); };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading') && !!window.SSX?.harvest && !!window.SSX?.skins && !!window.SSX?.farm, 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 99999; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.harvest.debug.reset(); window.__skins.api.__anywhere = true; });
    // every skin applies to the current rig
    const all = await G(async () => { const k = window.SSX.skins, o = {}; for (const s of k.list()) { if (!k.owned.includes(s.id)) k.buy(s.id); else k.equip(s.id, true); await new Promise(r => requestAnimationFrame(r)); const st = k.state(); o[s.id] = st.applied === s.id ? st.parts : -1; } k.close(); return o; });
    ok('allSkinsApply', all, Object.keys(all).length >= 10 && Object.entries(all).every(([id, n]) => n > 0 || id === 'rusty' && n >= 0));
    await G(() => { window.SSX.skins.equip('overalls'); window.SSX.skins.close(); });
    await G(() => { const p = window.SSX.farm.places().find(q => q.id === 'farm'); window.__app.surface.debugMove(p.x, p.z + 12, 0); }); await fr(6); await sleep(500);
    for (const f of ['buy', 'buildDome', 'addRack']) { await G(f => window.SSX.farm[f](), f); await sleep(900); }
    await G(() => { const F = window.SSX.farm; F.plant(0, 'potato'); F.refill('water'); F.refill('power'); F.skip(10); F.refill('water'); F.refill('power'); });
    const r0 = (await G(() => window.SSX.farm.rackSpots()))[0];
    await G(([x, z]) => window.__app.surface.debugMove(x, z + 2.2, 0), [r0.x, r0.z]); await fr(8); await sleep(400);
    ok('claims', await G(() => window.SSX.harvest.claimsFire()));
    const c0 = (await G(() => window.SSX.harvest.status())).carryN;
    await G(() => window.__app.surface.game.fire(null)); await fr(4); await sleep(300);
    const h = await G(() => window.SSX.harvest.status()), sk = await G(() => window.SSX.skins.state());
    ok('sickleCuts', { c0, carry: h.carryN, sfx: h.sfx }, h.carryN > c0);
    ok('overallsStay', { eq: sk.eq, applied: sk.applied, parts: sk.parts }, sk.eq === 'overalls' && sk.applied === 'overalls' && sk.parts > 3);
    ok('rigVisible', await G(() => { const r = window.__app.surface.scene.getObjectByName('harvest-rig'), s = window.__app.surface.scene.getObjectByName('harvest-sickle'); return !!r?.visible && !!s?.visible; }));
    await G(() => { const s = window.__app.surface; s.setView?.('third'); s.zoom?.(0.45); s.look?.(0, -10, 1); s.look?.(Math.PI, 1.67, 1); }); await sleep(900);
    const f = `${out}skins-overalls-sickle-${tag}.png`; await page.screenshot({ path: f }); R.shot = f;
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 200)); }
  ok('noErrors', errors.slice(0, 5), errors.length === 0);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS skins-harvest ' + tag); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
