// v7.5.19 browser test: sniper scope + contracts (mars/sniper.js). Land on Mars, take contract 1 from the ☰ 🎯 Contracts
// sheet (taps), walk to the tower ring, 🪜 Climb up, scope in (🎯 Scope tap on phones, Z on desktop), hold breath, aim at
// the mark's head and fire (🔥 Fire tap / F key), lose the stars, get paid, contract 2 unlocks. Also: fov restored on exit,
// keys audit (Z on the Scope button), no new shader programs when the mark appears (prewarmed), no console errors.
// BASE=http://localhost:8765/ BR=webkit DEV="iPhone 14" OUT=/workspace/sniper/ node tests/test-sniper.js   (DEV=desktop for 1366x768)
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width < 2) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); };
  const shot = async p => { try { await page.screenshot({ path: p, timeout: 120000 }); R.shots = (R.shots || []).concat(p); } catch (e) { R.shotFail = (R.shotFail || []).concat(p); } };
  const SN = () => G(() => window.SSX.sniper.active());
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); });
    ok('api', await G(() => ['start', 'stop', 'active', 'scope', 'scoped', 'list', 'stats', 'on'].every(k => typeof window.SSX?.sniper?.[k] === 'function')));
    ok('menuItem', await G(() => !!document.getElementById('rmSniper')));
    ok('offMarsRefuses', await G(() => window.SSX.sniper.start('kesh').ok === false));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(1500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.sniper.debug.reset(); window.__app.surface.world.setWanted(0); window.__evs = []; window.SSX.sniper.on(e => window.__evs.push(e.type)); const p = window.__app.game.progress; p.unlocks = p.unlocks.filter(u => u !== 'weapon:railrifle'); p.inv.slugs = 0; });
    await sleep(2500); // let the prewarm finish
    const prog0 = await G(() => window.SSX.sniper.debug.uncompiled());
    ok('scopeRefusedWithoutRifle', await G(() => window.SSX.sniper.scope(true) === false && !window.SSX.sniper.scoped()));
    // take contract 1 from the sheet
    await G(() => window.SSX.sniper.open()); await sleep(300);
    ok('lockedSecond', await G(() => !!document.querySelector('#snPanel button[disabled]')));
    await tapSel('#snPanel button[data-c="kesh"]');
    ok('started', (await SN())?.id === 'kesh');
    ok('loanRifle', await G(() => window.__app.game.progress.unlocks.includes('weapon:railrifle') && window.__app.game.progress.inv.slugs >= 6));
    ok('hud', await G(() => document.getElementById('snHud').classList.contains('show') && /TOBIAH KESH/.test(document.getElementById('snHud').textContent)));
    const wp = await G(() => window.SSX.hudx?.objective?.()); ok('waypoint', wp?.label || null, /tower/i.test(wp?.label || ''));
    // walk to the ring
    const tw = await G(() => window.SSX.sniper.debug.tower());
    await G(t => window.__app.surface.debugPlace(t.ringX, t.ringZ + 0.5, 0), tw); await sleep(900);
    ok('climbBtn', await wait(() => { const b = document.getElementById('snClimbBtn'); return b && b.offsetParent && /Climb up/.test(b.textContent); }, 5000));
    await tapSel('#snClimbBtn');
    ok('perched', await G(() => window.SSX.sniper.debug.perched()));
    await sleep(600);
    ok('stillPerched', await G(() => { const p = window.__app.surface.info; return window.SSX.sniper.debug.perched() && p.y > 10 + 0; }));
    ok('railOut', await G(() => window.__app.game.progress.equip.weapon === 'railrifle'));
    await wait(() => !!window.SSX.sniper.debug.mark(), 5000);
    const prog1 = await G(() => window.SSX.sniper.debug.uncompiled());
    ok('prewarmed', `${prog0}/${prog1} uncompiled`, prog0 === 0 && prog1 === 0);
    // keys audit (desktop): Scope button owns Z
    if (desk) { const a = await G(() => window.SSX.keys.audit()); const s = a.find(x => x.id === 'snipeBtn'); ok('kbAudit', s?.key || null, s?.key === 'Z'); }
    const fov0 = await G(() => window.SSX.sniper.debug.fov());
    if (desk) { await page.keyboard.press('KeyZ'); await sleep(400); } else await tapSel('#snipeBtn');
    ok('scoped', await G(() => window.SSX.sniper.scoped() && document.getElementById('snScope').classList.contains('show')));
    await sleep(600);
    const fov1 = await G(() => window.SSX.sniper.debug.fov()); ok('narrowFov', `${fov0}->${fov1.toFixed(1)}`, fov1 < fov0 / 3);
    ok('hudHidden', await G(() => getComputedStyle(document.getElementById('surfBtns')).visibility === 'hidden'));
    if (!desk) ok('touchButtons', await G(() => ['snFire', 'snSteady', 'snZoom', 'snExit'].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })));
    // zoom 8x and back
    if (desk) await page.keyboard.press('Equal'); else await tapSel('#snZoom');
    await sleep(1500); const fov2 = await G(() => window.SSX.sniper.debug.fov()); ok('zoom8x', fov2.toFixed(1), fov2 < fov1 * 0.6);
    // aim at the head, hold breath, shoot
    await G(() => { window.SSX.sniper.debug.steady(true); window.SSX.sniper.debug.aimAtMark('head'); }); await sleep(250);
    await G(() => window.SSX.sniper.debug.aimAtMark('head')); await sleep(120);
    await shot(out + `scope-${tag}.png`);
    const before = await G(() => ({ cr: window.__app.game.progress.credits, slugs: window.__app.game.progress.inv.slugs }));
    await G(() => window.SSX.sniper.debug.aimAtMark('head'));
    if (desk) { await page.keyboard.down('KeyF'); await sleep(120); await page.keyboard.up('KeyF'); } else await tapSel('#snFire');
    await sleep(500);
    const a1 = await SN(); ok('killed', a1?.down === true);
    ok('ammoUsed', await G(n => window.__app.game.progress.inv.slugs === n - 1, before.slugs));
    ok('boltCycle', await G(() => window.SSX.sniper.debug.cool() > 0.4));
    ok('wanted', await G(() => window.__app.surface.world.wanted >= 2));
    ok('headshot', await G(() => window.SSX.sniper.stats().heads === 1));
    await shot(out + `kill-${tag}.png`);
    // leave scope, fov restored
    if (desk) { await page.keyboard.press('Escape'); await sleep(300); } else await tapSel('#snExit');
    ok('unscoped', await G(() => !window.SSX.sniper.scoped() && !document.body.classList.contains('sniping')));
    ok('fovRestored', await G(f => Math.abs(window.SSX.sniper.debug.fov() - f) < 0.01, fov0));
    // lose the heat -> paid
    await G(() => window.__app.surface.world.setWanted(0)); await sleep(1800);
    ok('paid', await G(() => !window.SSX.sniper.active() && window.__evs.includes('paid')));
    const after = await G(() => window.__app.game.progress.credits); ok('credits', after - before.cr, after - before.cr >= 900);
    ok('secondUnlocked', await G(() => window.SSX.sniper.list().find(c => c.id === 'teague').open));
    ok('saved', await G(() => JSON.parse(localStorage.getItem('ssx.sniper.v1')).done.kesh === 1));
    ok('climbedDown', await G(() => !window.SSX.sniper.debug.perched()));
    // contract 2: a miss spooks the mark; quit cleans up
    ok('start2', await G(() => window.SSX.sniper.start('teague').ok));
    await G(() => { const t = window.SSX.sniper.debug.tower(); window.__app.surface.debugPlace(t.ringX, t.ringZ + 0.5, 0); }); await sleep(800);
    await G(() => window.SSX.sniper.debug.climb()); await wait(() => !!window.SSX.sniper.debug.mark(), 5000);
    await G(() => { window.SSX.sniper.scope(true); window.SSX.sniper.debug.aimAtMark('head'); const p = window.__app.surface.player || null; }); await sleep(200);
    await G(() => { const s = window.SSX.sniper; s.debug.aimAtMark('head'); window.__app.surface.look(400, 0, 0.002); }); await sleep(100);
    await G(() => window.SSX.sniper.trigger()); await sleep(300);
    ok('spooked', (await SN())?.spooked === true);
    await G(() => { window.SSX.sniper.scope(false); window.SSX.sniper.stop(); window.__app.surface.world.setWanted(0); });
    ok('quitClean', await G(() => !window.SSX.sniper.active() && !window.SSX.sniper.debug.perched() && !document.getElementById('snHud').classList.contains('show')));
    ok('noErrors', errors.length ? errors.slice(0, 5) : true, errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); R.exc = e.stack; }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
