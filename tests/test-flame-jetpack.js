// v7.5.9 batch check: Steve's 🔥 flamethrower (#84) + Pumpkin's jetpack (#85) together on a phone (393x852).
// Own both, fly with the real jetpack (hold Jump), hold FIRE in the air: the flamer sprays (airborne aim), particles stay under the
// phone cap (140), wanted heat rises, the jetpack keeps flying, FIRE / 🔥 / Jump / fuel bars don't overlap, no page errors.
// Also fps: frames over 4 s standing idle vs 4 s spraying on the ground and 4 s spraying while flying (WebKit, software GL here,
// so the ratio matters, not the absolute number).
// BASE=http://127.0.0.1:8866/ BR=webkit DEV=393x852 OUT=... node tests/test-flame-jetpack.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8866/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw[BR].launch(); const m = /^(\d+)x(\d+)$/.exec(DEV) || [0, 393, 852]; const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await b.newContext({ ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [], ok = (k, v, c) => { R[k] = v; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const tag = `flamejet-${DEV}-${BR}`, shot = n => page.screenshot({ path: `${out}${tag}-${n}.png` });
  const P = (t, sel, id) => G(([t, sel, id]) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: false, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerdown' ? 1 : 0 })); return true; }, [t, sel, id]);
  const fps = async ms => { const f0 = await G(() => window.__frames); await sleep(ms); return Math.round(((await G(() => window.__frames)) - f0) / (ms / 1000) * 10) / 10; };
  const FS = () => G(() => window.SSX.flame.state());
  try {
    await page.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 }); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1500);
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } try { window.SSX.control?.debug?.setTimes({ first: 9999, after: 9999 }); } catch (e) { } });
    ok('apis', await G(() => ({ flame: !!window.SSX?.flame, jet: !!window.SSX?.jetpack })), await G(() => !!window.SSX?.flame && !!window.SSX?.jetpack));
    // out of town a little so cops are slower to arrive; wanted 0
    await G(() => { const s = window.__app.surface, i = s.info; s.world.setWanted?.(0); s.debugPlace(i.x + 40, i.z + 40, 0); }); await sleep(800);
    await G(() => { window.__jetpack.give(); window.SSX.flame.debug.give(); window.SSX.flame.equip(true); }); await sleep(600);
    R.fpsIdle = await fps(4000);
    // spray on the ground
    await P('pointerdown', '#fireBtn', 7); await sleep(400); const g1 = await FS(); R.fpsSprayGround = await fps(4000); const g2 = await FS(); await P('pointerup', '#fireBtn', 7); await sleep(300);
    ok('sprayGround', { firing: g1.firing, live: g2.live, cap: g2.cap, peak: g2.stats.peak }, g1.firing && g2.live > 10 && g2.cap <= 140 && g2.stats.peak <= g2.cap);
    // fly + spray
    const w0 = await G(() => window.__app.surface.world.wanted | 0);
    await P('pointerdown', '#jumpBtn', 51); const up = await wait(() => window.__jetpack.alt > 4, 15000);
    await P('pointerdown', '#fireBtn', 7); await sleep(400); const a1 = await FS(); const jet1 = await G(() => ({ flying: window.__jetpack.s.flying, alt: +window.__jetpack.alt.toFixed(1) }));
    await shot('flying-spraying');
    const ov = await G(() => { const ids = ['fireBtn', 'flameHud', 'flameBtn', 'jumpBtn', 'jpFuel', 'runBtn', 'petBtn', 'driveBtn', 'joy', 'menuBtn', 'hxMore']; const rs = ids.map(id => { const e = document.getElementById(id); if (!e) return null; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { id, r } : null; }).filter(Boolean);
      const hits = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const A = rs[i].r, B = rs[j].r; if ((rs[i].id === 'jpFuel' && rs[j].id === 'jumpBtn') || (rs[i].id === 'jumpBtn' && rs[j].id === 'jpFuel') || [rs[i].id, rs[j].id].sort().join() === 'flameBtn,flameHud') continue;
        if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) hits.push(rs[i].id + '×' + rs[j].id); } return { shown: rs.map(r => r.id), hits }; });
    R.fpsSprayAir = await fps(4000); const a2 = await FS(); const jet2 = await G(() => ({ flying: window.__jetpack.s.flying, alt: +window.__jetpack.alt.toFixed(1), fuel: window.SSX.jetpack.fuel }));
    await P('pointerup', '#fireBtn', 7); await P('pointerup', '#jumpBtn', 51);
    ok('flameWhileJetpack', { up, a1: { firing: a1.firing, airborne: a1.airborne }, live: a2.live, peak: a2.stats.peak, cap: a2.cap, jet1, jet2 }, up && a1.firing && a1.airborne && jet1.flying && a2.live > 10 && a2.stats.peak <= a2.cap);
    ok('noOverlap', ov, ov.hits.length === 0 && ov.shown.includes('fireBtn') && ov.shown.includes('jumpBtn'));
    await sleep(3500); const w1 = await G(() => window.__app.surface.world.wanted | 0); const rep = (await FS()).stats.reports;
    ok('wantedHeat', { before: w0, after: w1, reports: rep }, w1 > w0 || rep > 0);
    ok('fps', { idle: R.fpsIdle, ground: R.fpsSprayGround, air: R.fpsSprayAir }, R.fpsSprayGround >= R.fpsIdle * 0.7 && R.fpsSprayAir >= R.fpsIdle * 0.7);
    await wait(() => window.__app.surface.info.grounded && !window.__jetpack.s.flying, 30000);
    ok('pageErrors', errs, !errs.length);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 160)); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag); await b.close(); process.exit(bad.length ? 1 : 0);
})();
