// Hostage (mars/hostage.js): a rival lieutenant hangs about a citydata gang spot in Red Tape Flats; walk up and he runs;
// the 👊 context button (real tap) and the game's own melee (world.meleeWorld) knock him down with birdies; a drag on the
// button never fires; 🪢 Grab (real tap) zip-ties him; he hops after you on foot, lies across the trunk when you drive,
// dangles under the jetpack; fast travel to the ice cap takes him along; 🎳 Hand him over -> SSX.icecap.bringRival()
// makes him Benny's head pin and pays the finder's fee. Second lieutenant: cornered (hands up), grabbed, let go from the
// chip sheet -> cool-down. Screenshots go to SHOTS_DIR.
// BASE=http://localhost:8886/ BR=webkit DEV=393x852 SHOTS_DIR=... NODE_PATH=/workspace/pw/node_modules node tests/test-hostage.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8886/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || '393x852';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `hostage-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message); }); page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return r.width > 0; }, [t, sel, id, dx, dy]);
  const tap = async sel => { if (touch) { const a = await P('pointerdown', sel, 71); await P('pointerup', sel, 71); return a; } await page.click(sel); return true; };
  const st = () => G(() => window.SSX.hostage.state());
  const frames = async n => { const f0 = await G(() => window.__frames); await wait(f => window.__frames >= f, 20000, f0 + n); };
  const sheetTap = re => G(re => { const b = [...document.querySelectorAll('#sheetBtns button')].find(x => new RegExp(re).test(x.textContent)); if (!b) return false; const r = b.getBoundingClientRect();
    for (const t of ['pointerdown', 'pointerup']) b.dispatchEvent(new PointerEvent(t, { pointerId: 72, pointerType: 'touch', isPrimary: true, clientX: r.left + 5, clientY: r.top + 5, bubbles: true, cancelable: true })); b.click(); return true; }, re);
  const overlap = sel => G(sel => { const a = document.querySelector(sel)?.getBoundingClientRect(); if (!a || !a.width) return 'hidden'; const hits = [];
    for (const e of document.querySelectorAll('button, .btn, #joy, #touchFire, [id^="touch"]')) { if (e.matches(sel) || e.closest(sel) || !e.offsetParent && getComputedStyle(e).position !== 'fixed') continue; const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).visibility === 'hidden' || getComputedStyle(e).display === 'none') continue;
      if (r.left < a.right - 1 && r.right > a.left + 1 && r.top < a.bottom - 1 && r.bottom > a.top + 1) hits.push(e.id || e.className || e.tagName); }
    return { box: [Math.round(a.left), Math.round(a.top), Math.round(a.right), Math.round(a.bottom)], hits, inView: a.left >= 0 && a.right <= innerWidth && a.top >= 0 && a.bottom <= innerHeight }; }, sel);
  try {
    await page.goto(base + '?look=classic&models=1&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('api', await G(() => !!window.SSX?.hostage && typeof window.SSX.hostage.grab === 'function' && window.SSX.hostage.roster().length >= 3));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1000);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.__app.surface.game.progress.credits = 5000; });
    ok('reattached', await G(() => window.SSX.hostage === window.SSX.hostage && !!window.SSX.icecap?.bringRival));
    // ---- Red Tape Flats: the lieutenant is on his citydata gang spot ----
    const ft = await G(() => (window.SSX.fastTravel?.places?.() || []).some(p => p.kind === 'rough'));
    if (ft) { await G(() => window.SSX.fastTravel.travel('rough')); await wait(() => !window.SSX.fastTravel.busy && window.SSX.fastTravel.last?.id, 30000); }
    await wait(() => !!window.SSX.hostage.state().npc, 15000);
    const spot = await G(() => { const s = window.SSX.hostage.state(), L = s.lieutenant, C = window.__hostage.core, col = window.__app.surface.world.colony, d = col.districts.find(x => x.id === C.FLATS_ID), h = C.flatsWorld(L.spot, d, col);
      return { name: L.name, state: s.npc.state, off: +Math.hypot(s.npc.x - h.x, s.npc.z - h.z).toFixed(2), spot: L.spot }; });
    ok('lieutenantOnGangSpot', spot, spot.state === 'idle' && spot.off < 0.01);
    // stand 9 m off, look at him
    await G(() => { window.__hostage.go(0, 9); }); await sleep(900);
    const near = await st(); ok('noticesYou', near.npc.state, near.npc.state === 'flee');
    ok('chip', near.chip, /🎯/.test(near.chip) && /lt\./.test(near.chip));
    ok('mapMark', await G(() => (window.SSX.minimap?.list?.() || []).includes('hostage')));
    await G(() => window.__hostage.go(0, 2.2)); await frames(2);
    await G(() => { const n = window.SSX.hostage.state().npc; window.__hostage.view({ p: [n.x + 4.5, 3.4 + window.__app.surface.info.y, n.z + 6], l: [n.x, window.__app.surface.info.y - 0.8, n.z] }); }); await sleep(250);
    await shot('flats-lieutenant'); await G(() => window.__hostage.view(null));
    // ---- the game's own fist (world.meleeWorld wrapper) lands on him ----
    await G(() => window.__hostage.go(0, 1.4)); await frames(1);
    const mw = await G(() => { const p = window.__app.surface.info, n = window.SSX.hostage.state().npc, dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz); const hit = window.__app.surface.world.meleeWorld(p.x, p.z, dx / d, dz / d, 2.6, 1, 1); return { hit, hp: window.SSX.hostage.state().npc.hp }; });
    ok('gameMeleeHits', mw, mw.hit === true && mw.hp === 3);
    // ---- 👊 context button: a drag doesn't fire, real taps punch him down ----
    await G(() => window.__hostage.go(0, 1.4)); await frames(2);
    ok('punchButton', (await st()).ctx?.mode, (await st()).ctx?.mode === 'punch');
    if (touch) { await P('pointerdown', '#hostageAct', 73); await P('pointermove', '#hostageAct', 73, 0, -30); await P('pointerup', '#hostageAct', 73, 0, -30); ok('dragDoesNotFire', (await st()).npc.hp, (await st()).npc.hp === 3); }
    for (let i = 0; i < 6 && (await st()).npc.state !== 'down'; i++) { await G(() => window.__hostage.go(0, 1.4)); await frames(2); await tap('#hostageAct'); await sleep(120); }
    const dn = await st(); ok('knockedDown', dn.npc, dn.npc.state === 'down');
    ok('birdies', await G(() => window.__hostage.man()?.stars.visible === true));
    // move the scene into the open for the screenshot (he tends to end up against a wall)
    await G(() => { const s = window.__app.surface, w = s.world, H = (x, z) => s.height ? s.height(x, z) : 0, n = window.__hostage.S.n; let best = null;
      for (let r = 0; r < 40 && !best; r += 2) for (let a = 0; a < 16 && !best; a++) { const x = n.x + Math.cos(a / 16 * 6.283) * r, z = n.z + Math.sin(a / 16 * 6.283) * r; let clear = true;
        for (let dx = -7; dx <= 7 && clear; dx += 1.5) for (let dz = -7; dz <= 9 && clear; dz += 1.5) if (w.solidAt?.(x + dx, H(x + dx, z + dz) + 1, z + dz)) clear = false; if (clear) best = { x, z }; }
      if (best) { n.x = best.x; n.z = best.z; } });
    await G(() => window.__hostage.go(1.8, 0.4)); await frames(3);
    await G(() => { const n = window.SSX.hostage.state().npc, y = window.__app.surface.info.y; window.__hostage.view({ p: [n.x + 3.4, y + 2.6, n.z + 3.4], l: [n.x, y - 1.3, n.z] }); }); await sleep(300);
    ok('grabButton', (await st()).ctx?.mode, (await st()).ctx?.mode === 'grab');
    ok('actLayout', await overlap('#hostageAct'), (r => r.inView && !r.hits.length)(await overlap('#hostageAct')));
    await shot('knocked-down'); await G(() => window.__hostage.view(null));
    await tap('#hostageAct'); await sleep(200);
    const held = await st(); ok('grabbed', held.npc.state, held.npc.state === 'held' && held.save.held === held.lieutenant.id);
    ok('current', await G(() => window.SSX.hostage.current()?.name), !!(await G(() => window.SSX.hostage.current()?.name)));
    await G(() => window.__app.surface.world.setWanted(0));
    // ---- on foot: he hops after you on a 1.7 m leash ----
    await G(() => { const i = window.__app.surface.info; window.__app.surface.debugMove(i.x + 6, i.z, -Math.PI / 2); }); await sleep(1500);
    const foot = await G(() => { const i = window.__app.surface.info, n = window.SSX.hostage.state().npc; return { d: +Math.hypot(n.x - i.x, n.z - i.z).toFixed(2), pose: n.pose }; });
    ok('followsOnFoot', foot, foot.d < 2.2 && ['hop', 'stand'].includes(foot.pose));
    ok('chipInTow', (await st()).chip, /in tow/.test((await st()).chip) && /Benny/.test((await st()).chip));
    ok('chipLayout', await overlap('#hostageChip'), (r => r.inView)(await overlap('#hostageChip')));
    // ---- vehicle: across the trunk ----
    const drove = await G(async () => { const s = window.__app.surface, i = s.info; s.debugMove(i.roverX + 2.2, i.roverZ, 0); await new Promise(r => setTimeout(r, 400)); if (!s.info.driving) s.interact(); await new Promise(r => setTimeout(r, 300)); return !!s.info.driving; });
    if (drove) { await G(() => { const i = window.__app.surface.info; window.__app.surface.debugMove(i.x + 4, i.z, i.carYaw ?? 0); }); await sleep(900); }
    const trunk = await st(); ok('rideInTrunk', { drove, pose: trunk.npc.pose, mode: trunk.mode }, drove && trunk.npc.pose === 'trunk');
    await G(() => { const i = window.__app.surface.info; const n = window.SSX.hostage.state().npc; window.__hostage.view({ p: [n.x + 5.5, i.y + 4.5, n.z + 5.5], l: [n.x, i.y - 0.6, n.z] }); }); await sleep(300);
    await shot('in-the-trunk'); await G(() => window.__hostage.view(null));
    // ---- fast travel to the ice cap: he comes along ----
    const ok2 = await G(() => (window.SSX.fastTravel?.places?.() || []).some(p => p.kind === 'icecap'));
    let arrived = false;
    if (ok2) { await G(() => window.SSX.fastTravel.travel('icecap')); arrived = await wait(() => { const i = window.__app.surface.info, b = window.SSX.icecap.place(); return !window.SSX.fastTravel.busy && Math.hypot(i.x - b.x, i.z - b.z) < 30; }, 40000); }
    if (!arrived) await G(() => window.__icecap.go('arrive'));
    await sleep(1200);
    const along = await G(() => { const i = window.__app.surface.info, n = window.SSX.hostage.state().npc; return { d: +Math.hypot(n.x - i.x, n.z - i.z).toFixed(1), state: n.state, driving: i.driving }; });
    ok('fastTravelTakesHim', { arrived, ...along }, arrived && along.state === 'held' && along.d < 4);
    if (along.driving) { await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 6000); }
    // ---- on the snow: he hops along behind you; then the jetpack, where he dangles on a rope ----
    await G(() => { const i = window.__app.surface.info; window.__app.surface.debugMove(i.x - 10, i.z - 30, 0); }); await sleep(600);
    await G(() => { const i = window.__app.surface.info; window.__app.surface.debugMove(i.x, i.z - 5, 0); }); await sleep(1200);
    await G(() => { const i = window.__app.surface.info, n = window.SSX.hostage.state().npc; window.__hostage.view({ p: [(i.x + n.x) / 2 + 4.5, i.y + 2.6, (i.z + n.z) / 2 + 5.5], l: [(i.x + n.x) / 2, i.y - 1.1, (i.z + n.z) / 2] }); }); await sleep(400);
    await shot('in-tow'); await G(() => window.__hostage.view(null));
    const jp = await G(() => !!window.__jetpack?.give && (window.__jetpack.give(), true));
    if (jp && touch) {
      await P('pointerdown', '#jumpBtn', 51); const up = await wait(() => window.__jetpack.alt > 6 && window.SSX.hostage.state().npc?.pose === 'dangle', 15000);
      const dg = await G(() => { const i = window.__app.surface.info, n = window.SSX.hostage.state().npc; return { alt: +window.__jetpack.alt.toFixed(1), pose: n.pose, d: +Math.hypot(n.x - i.x, n.z - i.z).toFixed(2), rope: window.__hostage.S && true }; });
      ok('jetpackDangle', dg, up && dg.pose === 'dangle' && dg.d < 0.5);
      await G(() => { const i = window.__app.surface.info; window.__hostage.view({ p: [i.x + 7, i.y - 2.5, i.z + 9], l: [i.x, i.y - 3.6, i.z] }); }); await sleep(300);
      await shot('jetpack-dangle'); await G(() => window.__hostage.view(null));
      await P('pointerup', '#jumpBtn', 51); await wait(() => window.__app.surface.info.grounded && !window.__jetpack.s.flying, 60000);
      ok('landsWithHim', (await st()).npc.state, (await st()).npc.state === 'held');
    }
    await G(() => window.__icecap.go('arrive')); await sleep(1000);
    // ---- hand him over ----
    const dv = await st(); ok('deliverButton', dv.ctx, dv.ctx?.mode === 'deliver');
    ok('actLayoutIcecap', await overlap('#hostageAct'), (r => r.inView && !r.hits.length)(await overlap('#hostageAct')));
    await G(() => { const i = window.__app.surface.info, n = window.SSX.hostage.state().npc; window.__hostage.view({ p: [i.x + 4, i.y + 3.5, i.z - 6], l: [(i.x + n.x) / 2, i.y - 1, (i.z + n.z) / 2] }); }); await sleep(400);
    await shot('at-benny'); await G(() => window.__hostage.view(null));
    const cr0 = await G(() => window.__app.surface.game.progress.credits);
    await tap('#hostageAct'); await sleep(400);
    const ic = await G(() => window.SSX.icecap.state()), after = await st();
    ok('bringRival', { rival: ic.rival?.name, rs: ic.rivalState }, ic.rival?.name === dv.lieutenant.name && ic.rivalState === 'tied');
    ok('finderFee', await G(c => window.__app.surface.game.progress.credits - c, cr0), (await G(c => window.__app.surface.game.progress.credits - c, cr0)) === 150);
    ok('coolDown', after.save, after.save.held === null && after.save.hauls === 1 && after.save.back[dv.lieutenant.id] > Date.now() / 1000);
    await G(() => { const K = window.__icecap.core; window.__app.surface.debugMove(K.CX + 3, K.FOUL - 4, Math.PI); window.__icecap.view({ p: [K.CX + 2.6, 2.3, K.FOUL + K.PIN0 - 5.5], l: [K.CX, 0.9, K.FOUL + K.PIN0 + 0.6] }); }); await sleep(1500);
    await shot('head-pin'); await G(() => window.__icecap.view(null));
    // ---- the next lieutenant: corner him (hands up), grab, let him go from the chip sheet ----
    await wait(() => !!window.SSX.hostage.state().npc && window.SSX.hostage.state().npc.state === 'idle', 8000);
    const l2 = await st(); ok('nextLieutenant', l2.lieutenant?.name, !!l2.lieutenant && l2.lieutenant.id !== dv.lieutenant.id);
    await G(() => window.__hostage.go(0, 8)); await sleep(500);
    let hands = false; for (let i = 0; i < 60 && !hands; i++) { await G(() => window.__hostage.go(0.9, 0.9)); await sleep(80); hands = (await st()).npc.state === 'hands'; }
    ok('cornered', (await st()).npc.state, hands);
    await G(() => window.__hostage.go(1.2, 0)); await frames(2);
    await G(() => { const n = window.SSX.hostage.state().npc, y = window.__app.surface.info.y; window.__hostage.view({ p: [n.x + 3.6, y + 2.2, n.z + 4.2], l: [n.x, y - 0.6, n.z] }); }); await sleep(300);
    ok('actLayoutCornered', await overlap('#hostageAct'), (r => r.inView && !r.hits.length)(await overlap('#hostageAct')));
    await shot('cornered'); await G(() => window.__hostage.view(null));
    await tap('#hostageAct'); await sleep(200); ok('grab2', (await st()).npc.state, (await st()).npc.state === 'held');
    await G(() => window.__app.surface.world.setWanted(0));
    await tap('#hostageChip'); await sleep(300);
    ok('chipSheet', await G(() => document.getElementById('sheet')?.classList.contains('show') && /Let him go/.test(document.getElementById('sheetBtns').textContent)));
    await shot('chip-sheet');
    await sheetTap('Let him go'); await sleep(400);
    const fr = await st(); ok('released', fr.save, fr.save.held === null && fr.save.freed === 1 && fr.save.back[l2.lieutenant.id] > Date.now() / 1000);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { ok('crash', String(e.stack || e).slice(0, 400), false); }
  await browser.close();
  console.log(JSON.stringify({ tag, bad, shots: R.shots, shotFail: R.shotFail }));
  process.exit(bad.length ? 1 : 0);
})();
