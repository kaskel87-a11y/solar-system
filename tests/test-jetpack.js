// Mars jetpack (mars/jetpack.js): buy it in ☰ (2,000 cr, refused when short), hold Jump to fly (flames, fuel bar), steer in the
// air faster than walking, fuel drains and refills, gravity toggle on foot changes the flight (LOW-G higher, ZERO-G sinks
// gently), 3★ ColSec shoots it down, no button overlap with ▤ More collapsed / open and with 👁 hide-HUD (Jump + fuel stay).
// BASE=http://localhost:8931/ BR=webkit DEV=393x852 SHOTS_DIR=... NODE_PATH=/workspace/pw/node_modules node tests/test-jetpack.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8931/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || '393x852';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `jetpack-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/Failed to start the audio device|audio device/i.test(e.message)) errors.push('PE ' + e.message); }); page.on('console', m => { if (m.type() === 'error' && !/audio device/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const toastTx = () => G(() => document.getElementById('toast')?.textContent || '');
  // real-tap pointer helpers (same pointerId down/up, no movement), like tests/test-gravity.js
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return r.width > 0; }, [t, sel, id, dx, dy]);
  const tap = async sel => { if (touch) { const a = await P('pointerdown', sel, 61); await P('pointerup', sel, 61); return a; } await page.click(sel); return true; };
  const jumpDown = async () => { if (touch) await P('pointerdown', '#jumpBtn', 51); else await page.keyboard.down('Space'); };
  const jumpUp = async () => { if (touch) await P('pointerup', '#jumpBtn', 51); else await page.keyboard.up('Space'); };
  const J = () => G(() => { const j = window.__jetpack, p = window.__app.surface.info; return { fuel: j.api.fuel, lit: j.s.lit, flying: j.s.flying, down: j.s.down, alt: +j.alt.toFixed(2), x: p.x, z: p.z, grounded: p.grounded, maxAlt: +j.maxAlt.toFixed(2), why: j.why(), mode: j.mode }; });
  const landed = () => wait(() => window.__app.surface.info.grounded && !window.__jetpack.s.flying, 60000);
  const spot = async (dx = 0, dz = 0) => { await G(([dx, dz]) => { const s = window.__app.surface, c = window.__jp0; s.debugPlace(c.x + dx, c.z + dz, 0); }, [dx, dz]); await sleep(400); await landed(); };
  // one measured burn: refill, burn for `secs` simulated seconds, let go, return the top altitude
  const burn = async secs => {
    await G(() => { window.__jetpack.setFuel(100); window.__jetpack.resetMax(); }); await landed(); await sleep(300);
    await G(() => { window.__b0 = null; }); await jumpDown();
    await wait(s => { const j = window.__jetpack; if (j.s.lit && window.__b0 == null) window.__b0 = j.simT; return window.__b0 != null && j.simT - window.__b0 >= s; }, 20000, secs);
    await jumpUp(); await sleep(200); await landed(); await sleep(200);
    return G(() => window.__jetpack.maxAlt);
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('api', await G(() => !!window.SSX?.jetpack && window.SSX.jetpack.price === 2000 && window.SSX.jetpack.owned === false));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1000);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); const i = window.__app.surface.info; window.__jp0 = { x: i.x + 40, z: i.z + 40 }; });
    ok('reattachedAfterBoot', await G(() => window.SSX.jetpack === window.__jetpack.api));
    // not owned: Jump is a plain jump, gravity toggle refuses on foot
    ok('gravRefusesOnFootUnowned', await G(() => window.SSX.gravity ? window.SSX.gravity.set('LOW-G').ok === false : true));
    // ---- buy in ☰ ----
    await G(() => { window.__app.surface.game.progress.credits = 500; });
    const openMenu = async () => { await tap('#menuBtn'); return wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000); };
    ok('menuOpens', await openMenu());
    await G(() => document.getElementById('rmJetpack')?.scrollIntoView({ block: 'center' })); await sleep(250);
    ok('menuItem', await G(() => document.getElementById('rmJetpack')?.textContent || ''), /Jetpack · 2,000 cr/.test(await G(() => document.getElementById('rmJetpack')?.textContent || '')));
    await tap('#rmJetpack'); ok('sheetOpens', await wait(() => document.getElementById('sheet').classList.contains('show') && /Jetpack/.test(document.getElementById('sheetTitle').textContent), 4000));
    await sleep(600); await tap('#sheetBtns button:first-child'); await sleep(500);
    ok('shortRefused', await toastTx(), /2,000 cr/.test(await toastTx()) && !(await G(() => window.SSX.jetpack.owned)));
    await G(() => { window.__app.surface.game.progress.credits = 5000; });
    await openMenu(); await G(() => document.getElementById('rmJetpack')?.scrollIntoView({ block: 'center' })); await sleep(250);
    await tap('#rmJetpack'); await wait(() => document.getElementById('sheet').classList.contains('show'), 4000); await sleep(700);
    await shot('1-buy-sheet');
    await tap('#sheetBtns button:first-child'); await sleep(500);
    ok('bought', await G(() => ({ owned: window.SSX.jetpack.owned, cr: window.__app.surface.game.progress.credits, flag: window.__app.surface.game.flag('jetpack') })), await G(() => window.SSX.jetpack.owned && window.__app.surface.game.progress.credits === 3000 && window.__app.surface.game.flag('jetpack')));
    ok('boughtToast', await toastTx(), /Jetpack bought/.test(await toastTx()));
    ok('persisted', await G(() => JSON.parse(localStorage.getItem('ssx.jetpack.v1')).owned === true));
    await spot();
    ok('ready', await J(), (await J()).why === null);
    if (touch) {
      const f = await G(() => { const e = document.getElementById('jpFuel'), b = document.getElementById('jumpBtn'), s = getComputedStyle(e), r = e.getBoundingClientRect(), q = b.getBoundingClientRect(); return { vis: s.display !== 'none', bg: s.backgroundColor, inside: r.left >= q.left && r.right <= q.right && r.top >= q.top && r.bottom <= q.bottom, h: r.height, w: r.width, lbl: b.querySelector('.lbl').textContent }; });
      ok('fuelBarInJump', f, f.vis && f.inside && f.h <= 8 && f.bg === 'rgb(0, 0, 0)' && /Jet/.test(f.lbl));
    } else ok('fuelChipDesktop', await G(() => getComputedStyle(document.getElementById('jpChip')).display !== 'none'));
    // ---- fly up ----
    const before = await J(); await jumpDown();
    ok('liftOff', await wait(() => window.__jetpack.alt > 6, 15000));
    await sleep(250); const mid = await J();
    ok('thrustLit', mid, mid.lit && mid.flying && mid.fuel < before.fuel);
    ok('flamesVisible', await G(() => { const s = window.__app.surface.scene, p = s.getObjectByName('jetpack'); let f = 0; p?.traverse(o => { if (o.isMesh && o.material.blending === 2 && o.visible && o.parent.visible) f++; }); return p?.visible && f >= 2; }));
    ok('jumpLitWhiteOnTouch', !touch || await G(() => document.body.classList.contains('jp-lit')));
    await shot('2-flying-flames-fuel');
    // ---- steer in the air (stick forward / W) ----
    const s0 = await J(), t0 = await G(() => window.__jetpack.simT);
    if (touch) { await P('pointerdown', '#joy', 41); await P('pointermove', '#joy', 41, 0, -60); } else await page.keyboard.down('KeyW');
    await wait(t => window.__jetpack.simT - t > 1.0, 10000, t0);
    const s1 = await J(), t1 = await G(() => window.__jetpack.simT);
    if (touch) await P('pointerup', '#joy', 41, 0, -60); else await page.keyboard.up('KeyW');
    const sp = Math.hypot(s1.x - s0.x, s1.z - s0.z) / (t1 - t0);
    ok('airSteerFasterThanWalk', +sp.toFixed(2), sp > 5.5 && s1.flying);
    await jumpUp();
    ok('fuelDrained', s1.fuel, s1.fuel < 80);
    ok('landsAgain', await landed());
    ok('fuelRefills', await wait(() => window.SSX.jetpack.fuel === 100, 15000));
    // ---- gravity modes on foot ----
    if (await G(() => !!window.SSX.gravity)) {
      ok('gravOnFootOwned', await G(() => window.SSX.gravity.set('MARS').ok && window.SSX.gravity.mode === 'MARS'));
      const hM = await burn(1.0);
      if (!touch) { await page.keyboard.press('Digit2'); await sleep(200); } else { const vis = await G(() => { const b = document.getElementById('dockGrav'); return !!b && b.getBoundingClientRect().width > 0 && getComputedStyle(b).display !== 'none'; }); if (vis) await tap('#dockGrav'); else await G(() => window.SSX.gravity.set('LOW-G')); }
      ok('toLowG', await wait(() => window.SSX.gravity.mode === 'LOW-G', 3000));
      const hL = await burn(1.0);
      ok('lowGHigher', `${hL} m vs MARS ${hM} m`, hL > hM * 1.3);
      await G(() => window.SSX.gravity.set('ZERO-G')); await G(() => window.__jetpack.setFuel(100)); await jumpDown(); await wait(() => window.__jetpack.alt > 8, 15000); await jumpUp(); await sleep(2500); // let vy settle to the float sink
      const z0 = await J(), zt0 = await G(() => window.__jetpack.simT); await wait(t => window.__jetpack.simT - t > 1.0, 8000, zt0); const z1 = await J(), zt1 = await G(() => window.__jetpack.simT);
      const sink = (z0.alt - z1.alt) / (zt1 - zt0);
      ok('zeroGSinksGently', +sink.toFixed(2), sink > 0.5 && sink < 3 && z1.mode === 'ZERO-G');
      await G(() => window.SSX.gravity.set('MARS')); await landed();
    } else R.gravity = 'not loaded';
    // ---- 3★ shoot-down ----
    await G(() => { window.__app.surface.game.restore?.(); window.__jetpack.setFuel(100); window.SSX.pursuit?.debug?.los?.(true); });
    await landed(); const hp0 = await G(() => { const i = window.__app.surface.game.info; return (i.hp || 0) + (i.shield || 0); }), d0 = await G(() => window.__jetpack.stats.downs);
    await G(() => window.__app.surface.world.setWanted(3, 'test'));
    await jumpDown();
    const downed = await wait(d => window.__jetpack.stats.downs > d, 20000, d0);
    const sd = await J();
    ok('shotDownAt3Stars', sd, downed && sd.down > 0 && !sd.lit);
    ok('shotDownToast', await toastTx(), /shot your jetpack/.test(await toastTx()) || (await G(() => window.__jetpack.log.some(l => /shot your jetpack/.test(l)))));
    ok('shotDownHurts', await G(h => { const i = window.__app.surface.game.info; return `${h} -> ${(i.hp || 0) + (i.shield || 0)}`; }, hp0), await G(h => { const i = window.__app.surface.game.info; return (i.hp || 0) + (i.shield || 0) < h || window.__app.surface.game.isDown(); }, hp0));
    await sleep(500); const sd2 = await J();
    ok('dropsWhileHoldingJump', `${sd.alt} -> ${sd2.alt}`, sd2.alt < sd.alt || sd2.grounded);
    await jumpUp();
    await G(() => { window.__app.surface.world.setWanted(0); window.SSX.pursuit?.debug?.los?.(null); window.SSX.pursuit?.debug?.reset?.(); });
    await wait(() => !window.__app.surface.game.isDown(), 30000); await sleep(800);
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.surface.game.restore?.(); });
    await spot(); await G(() => { window.__jetpack.s.down = 0; window.__jetpack.setFuel(100); });
    ok('twoStarsNoShots', await (async () => { await G(() => window.__app.surface.world.setWanted(2, 'test')); const h = await G(() => window.__jetpack.stats.hits); await jumpDown(); await sleep(2500); await jumpUp(); const h2 = await G(() => window.__jetpack.stats.hits); await G(() => window.__app.surface.world.setWanted(0)); await landed(); return h2 === h; })());
    // ---- buttons: no overlap (▤ More collapsed, open), 👁 hide-HUD keeps Jump + fuel and still flies ----
    if (touch) {
      await G(() => { window.__app.surface.world.setWanted(0); window.__jetpack.setFuel(100); }); await spot(4, 4); await sleep(600);
      const overlaps = () => G(() => {
        const vis = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && !e.closest('#roverMenu:not(.show)') && !!e.offsetParent; };
        const jb = document.getElementById('jumpBtn'), jr = jb.getBoundingClientRect();
        const hits = []; for (const e of document.querySelectorAll('button, #joy, #flyBtns, #gravPad, #hxMoreP.show')) { if (e === jb || jb.contains(e) || e.contains(jb) || !vis(e)) continue; const r = e.getBoundingClientRect(); if (r.left < jr.right - 1 && r.right > jr.left + 1 && r.top < jr.bottom - 1 && r.bottom > jr.top + 1) hits.push(e.id || e.textContent.slice(0, 12)); }
        const f = document.getElementById('jpFuel').getBoundingClientRect();
        return { jumpVis: vis(jb), fuelVis: getComputedStyle(document.getElementById('jpFuel')).display !== 'none' && f.width > 0, fuelInside: f.left >= jr.left && f.right <= jr.right && f.top >= jr.top && f.bottom <= jr.bottom, hits };
      });
      const oc = await overlaps(); ok('noOverlapCollapsed', oc, oc.jumpVis && oc.fuelVis && oc.fuelInside && !oc.hits.length);
      await shot('3-hud-collapsed');
      if (await G(() => document.getElementById('hxMore')?.classList.contains('avail'))) { await tap('#hxMore'); await sleep(400); const oo = await overlaps(); ok('noOverlapMoreOpen', oo, oo.jumpVis && !oo.hits.length); await tap('#hxMore'); await sleep(300); } else R.moreOpen = 'no ▤ More on this build';
      await openMenu(); await G(() => document.getElementById('hideHudBtn')?.scrollIntoView({ block: 'center' })); await sleep(250); await tap('#hideHudBtn');
      ok('hudHidden', await wait(() => document.body.classList.contains('cinematic'), 3000));
      await sleep(400); const oh = await overlaps(); ok('hiddenHudKeepsJumpAndFuel', oh, oh.jumpVis && oh.fuelVis && oh.fuelInside && !oh.hits.length);
      await jumpDown(); ok('fliesWithHudHidden', await wait(() => window.__jetpack.alt > 4, 15000)); await sleep(300);
      await shot('4-hud-hidden-flying');
      await jumpUp(); await landed();
      await tap('#hudShow'); await wait(() => !document.body.classList.contains('cinematic'), 3000);
    }
    // ---- off in ☰: Jump is a plain jump again ----
    await sleep(800); const mo = await openMenu(); await G(() => document.getElementById('rmJetpack')?.scrollIntoView({ block: 'center' })); await sleep(250);
    await G(() => { window.__rmEl = document.getElementById('rmJetpack'); window.__rmEv = []; for (const t of ['pointerdown', 'pointerup', 'click']) window.__rmEl.addEventListener(t, e => window.__rmEv.push(t + ':' + e.pointerId + ':' + document.getElementById('roverMenu').classList.contains('show'))); });
    await tap('#rmJetpack'); await sleep(300);
    if (await G(() => window.SSX.jetpack.on)) { R.toggleRetried = true; await sleep(600); await openMenu(); await sleep(250); await tap('#rmJetpack'); await sleep(300); } // one retry: the first tap sometimes lands while a toast/sheet is settling
    R.toggleDiag = await G(() => ({ same: window.__rmEl === document.getElementById('rmJetpack'), connected: window.__rmEl.isConnected, ev: window.__rmEv, on: window.SSX.jetpack.on }));
    ok('toggleOff', await G(m => ({ menuOpened: m, on: window.SSX.jetpack.on, label: document.getElementById('rmJetpack')?.textContent, log: window.__jetpack.log.slice(-2) }), mo), await G(() => window.SSX.jetpack.on === false && /OFF/.test(document.getElementById('rmJetpack').textContent)));
    await G(() => document.getElementById('roverMenu').classList.remove('show'));
    await sleep(800); await G(() => { window.__pm = 0; window.__pmI = setInterval(() => { const i = window.__app.surface.info; window.__pm = Math.max(window.__pm, i.y - 1.7 - (window.SSX.height(i.x, i.z) ?? 0)); }, 40); });
    await jumpDown(); await sleep(2000); await jumpUp(); await sleep(1500);
    const pm = await G(() => { clearInterval(window.__pmI); return +window.__pm.toFixed(2); });
    ok('offIsPlainJump', pm, pm < 3.2);
    ok('offGravRefusesOnFoot', await G(() => window.SSX.gravity ? window.SSX.gravity.set('LOW-G').ok === false : true));
  } catch (e) { bad.push('EXC ' + e.message); console.log(e.stack); }
  ok('noErrors', errors.slice(0, 5), errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? `FAIL ${tag}: ${bad.join(', ')}` : `ALL PASS ${tag}`);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
