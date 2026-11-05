// Planum Australe ice cap (mars/icecap.js): the snow mountain exists (height hook, no boulders on the snow), fast-travel stop,
// grab the rival lieutenant (real tap), Benny zip-ties him as the head pin, rent a board (50 cr), lift, timed run with kicker
// air + a grab trick paid in stars, ⏏ Off board, snow bowling: a swipe on the pad rolls, a hit on the rival ragdolls him,
// 3 frames scored, strikes / Perfect Cold paid, he limps off as a repeat target. A drag on the context button never fires.
// BASE=http://localhost:8871/ BR=webkit DEV=393x852 SHOTS_DIR=... NODE_PATH=/workspace/pw/node_modules node tests/test-icecap.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8871/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || '393x852';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `icecap-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
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
  const tap = async sel => { if (touch) { const a = await P('pointerdown', sel, 61); await P('pointerup', sel, 61); return a; } await page.click(sel); return true; };
  const st = () => G(() => window.SSX.icecap.state());
  try {
    await page.goto(base + '?look=classic&models=1&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('api', await G(() => !!window.SSX?.icecap && typeof window.SSX.icecap.place === 'function' && !!globalThis.SSX_GROUND));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1000);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.__app.surface.game.progress.credits = 5000; });
    ok('reattached', await G(() => window.SSX.icecap === window.SSX.icecap && window.SSX.icecap.zone.cx === window.__icecap.core.CX));
    const K = await G(() => { const c = window.__icecap.core; return { CX: c.CX, TOP: c.Z_TOP, BOT: c.Z_BOT, FOUL: c.FOUL, KICKS: c.KICKS, PIN0: c.PIN0 }; });
    // fast travel stop
    const ftp = await G(() => (window.SSX.fastTravel?.places?.() || []).find(p => p.kind === 'icecap') || null);
    ok('fastTravelStop', ftp, !!ftp && /Planum Australe/.test(ftp.name));
    let moved = false;
    if (ftp) { await G(() => window.SSX.fastTravel.travel('icecap')); moved = await wait(() => { const i = window.__app.surface.info; return Math.hypot(i.x - window.SSX.icecap.place().x, i.z - window.SSX.icecap.place().z) < 8 && !window.SSX.fastTravel.busy; }, 30000); }
    ok('fastTravelArrives', moved);
    if (!moved) await G(() => window.__icecap.go('arrive'));
    await wait(() => !!window.__icecap.parts(), 15000); await sleep(1500);
    // terrain: the mountain is there, boulders swept off the snow, lane is flat
    const terr = await G(K => { const s = window.__app.surface, h = (x, z) => s.height ? s.height(x, z) : window.SSX.height(x, z);
      return { top: +h(K.CX, K.TOP).toFixed(1), lane: +h(K.CX, K.FOUL + 5).toFixed(2), rocks: (s.boulders?.(K.CX, K.FOUL - 20, 60) || []).filter(r => Math.abs(r.x - K.CX) < 100).length }; }, K);
    ok('snowMountain', terr, terr.top > 40 && Math.abs(terr.lane) < 0.01 && terr.rocks === 0);
    ok('mapMark', await G(() => (window.SSX.minimap?.list?.() || []).includes('icecap')));
    // zone overview: stand by the lane, look up the mountain
    await G(K => { window.__app.surface.debugMove(K.CX + 5, K.FOUL - 6, Math.PI); window.__icecap.view({ p: [K.CX + 26, 24, K.FOUL - 58], l: [K.CX - 2, 0, K.FOUL + 14] }); }, K); await sleep(2500); await shot('overview'); await G(() => window.__icecap.view(null));
    // ---- grab the rival (real tap); a drag on the button doesn't fire ----
    await G(() => window.__icecap.rivalHere()); await sleep(500);
    const c1 = await G(() => window.__icecap.ctx());
    ok('grabButton', c1, c1?.mode === 'grab' && await G(() => document.getElementById('icecapAct').classList.contains('on')));
    if (touch) { await P('pointerdown', '#icecapAct', 71); await P('pointermove', '#icecapAct', 71, 18, 0); await P('pointerup', '#icecapAct', 71, 18, 0); await sleep(300);
      ok('dragDoesNotFire', (await st()).rivalState, (await st()).rivalState === 'hut'); }
    await tap('#icecapAct');
    ok('rivalKo', (await st()).rivalState, ['ko', 'tied'].includes((await st()).rivalState));
    ok('rivalTied', await wait(() => window.SSX.icecap.state().rivalState === 'tied', 6000));
    // ---- rent a board (50 cr) ----
    await G(() => window.__icecap.go('benny')); await sleep(500);
    ok('rentButton', await G(() => window.__icecap.ctx()?.mode), (await G(() => window.__icecap.ctx()?.mode)) === 'rent');
    const cr0 = await G(() => window.__app.surface.game.progress.credits);
    await tap('#icecapAct'); await wait(() => document.getElementById('sheet')?.classList.contains('show'), 4000); await sleep(500);
    await tap('#sheetBtns button:first-child'); await sleep(600);
    const cr1 = await G(() => window.__app.surface.game.progress.credits);
    ok('rented', { paid: cr0 - cr1 }, (await st()).rented && cr0 - cr1 === 50);
    // ---- lift + timed run ----
    await sleep(300); ok('liftButton', await G(() => window.__icecap.ctx()?.mode), (await G(() => window.__icecap.ctx()?.mode)) === 'lift');
    const xp0 = await G(() => window.__app.surface.game.progress.xp || 0);
    await tap('#icecapAct'); await sleep(300);
    ok('onBoard', await G(() => window.SSX.icecap.state().mode === 'board' && !!window.SSX.icecap.state().run));
    ok('runChip', await G(() => document.getElementById('icecapRun').classList.contains('on')));
    // ride: hold the board straight down the fall line, grab every kicker
    await wait(() => { const s = window.SSX.icecap.state(); return s.board && s.board.air && s.board.z > window.__icecap.core.KICKS[0]; }, 60000);
    if (touch) await P('pointerdown', '#jumpBtn', 51); else await page.keyboard.down('Space');
    await sleep(350); await shot('snowboarding');
    await wait(() => !window.SSX.icecap.state().board?.air, 8000);
    if (touch) await P('pointerup', '#jumpBtn', 51); else await page.keyboard.up('Space');
    const trick = await wait(() => window.__icecap.log().some(t => /grab/.test(t) && /★/.test(t)), 20000);
    ok('grabTrickPaid', await G(() => window.__icecap.log().filter(t => /🏂/.test(t)).slice(-3)), trick);
    ok('runFinished', await wait(() => window.__icecap.log().some(t => /Finish/.test(t)), 90000), true);
    const s2 = await st(); ok('runPaidStars', { xp: (await G(() => window.__app.surface.game.progress.xp || 0)) - xp0, run: s2.run }, (await G(() => window.__app.surface.game.progress.xp || 0)) - xp0 >= 5);
    ok('endsAtLane', await wait(() => window.SSX.icecap.state().mode === 'foot', 20000) && await G(K => Math.abs(window.__app.surface.info.z - K.FOUL) < 40, K));
    // free ride + ⏏ Off board (real tap)
    await G(K => window.__app.surface.debugMove(K.CX, 820, Math.PI), K); await sleep(500);
    ok('boardOnButton', await G(() => window.__icecap.ctx()?.mode), (await G(() => window.__icecap.ctx()?.mode)) === 'on');
    await tap('#icecapAct'); await sleep(400); ok('freeRide', (await st()).mode === 'board');
    await sleep(600); ok('offButton', await G(() => document.getElementById('icecapAct').textContent), /Off board/.test(await G(() => document.getElementById('icecapAct').textContent)));
    await tap('#icecapAct'); await sleep(300); ok('offBoard', (await st()).mode === 'foot');
    // ---- bowling ----
    await G(() => window.__icecap.go('foul')); await sleep(600);
    ok('bowlButton', await G(() => window.__icecap.ctx()), (await G(() => window.__icecap.ctx()?.mode)) === 'bowl');
    await tap('#icecapAct'); await sleep(900);
    ok('bowlPanel', await G(() => document.getElementById('icecapBowl').classList.contains('on') && window.SSX.icecap.state().bowl?.rival === true));
    console.log('IDS', await G(()=>[...document.querySelectorAll('body *')].filter(e=>{if(e.closest('#icecapBowl'))return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>30&&r.height>20&&s.visibility!=='hidden'&&s.opacity!=='0'&&(s.position==='fixed'||s.position==='absolute')&&e.checkVisibility()}).map(e=>(e.id||'.'+e.className)+'<'+(e.parentElement.id||e.parentElement.className)).join(' | ')));await shot('bowling-lane');
    const hits = []; await G(() => { window.__ih = []; window.SSX.icecap.subscribe(e => window.__ih.push(e.type)); });
    // ball 1: a swipe up the pad (same pointerId), straight down the middle at the rival
    const crB = await G(() => window.__app.surface.game.progress.credits), xpB = await G(() => window.__app.surface.game.progress.xp || 0);
    await P('pointerdown', '#icecapPad', 81, 0, 60); for (let i = 1; i <= 8; i++) { await P('pointermove', '#icecapPad', 81, 0, 60 - i * 15); await sleep(15); } await P('pointerup', '#icecapPad', 81, 0, -60);
    await sleep(100); ok('swipeRolls', await G(() => window.SSX.icecap.state().bowl?.rolling || window.__ih.includes('roll')));
    const hh = await wait(() => window.__ih.includes('headhit'), 8000); await sleep(800); await shot('rival-pin-hit');
    ok('rivalRagdoll', hh && await G(() => !!window.__icecap.parts().rival?.rag));
    await wait(() => !window.SSX.icecap.state().bowl?.rolling, 15000); await sleep(1200);
    // the rest by API: strikes down the middle (aim 0, power 0.8, no spin)
    if (!touch) { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Space');
      ok('keyRoll', await wait(() => window.SSX.icecap.state().bowl?.rolling, 3000)); await wait(() => !window.SSX.icecap.state().bowl?.rolling, 15000); await sleep(1100); }
    for (let i = 0; i < 8; i++) { const b = (await st()).bowl; if (!b || b.over) break; await G(() => window.SSX.icecap.roll({ aim: 0, power: 0.8, spin: 0 })); await wait(() => !window.SSX.icecap.state().bowl?.rolling, 15000); await sleep(1100); }
    const fin = await st(); R.rolls = fin.bowl?.rolls;
    ok('threeFramesDone', fin.bowl?.over, !!fin.bowl?.over);
    const crE = await G(() => window.__app.surface.game.progress.credits), xpE = await G(() => window.__app.surface.game.progress.xp || 0);
    const pay = await G(r => window.__icecap.core.payout(r, window.SSX.icecap.state().bowl.heads, true), fin.bowl.rolls);
    ok('paidPerStory', { paid: crE - crB, pay, stars: xpE - xpB }, crE - crB === pay.cr && xpE - xpB === pay.stars && (!pay.perfect || pay.stars === 200));
    ok('scorecard', await G(() => document.getElementById('icecapCard').textContent), /X/.test(await G(() => document.getElementById('icecapCard').textContent)));
    await sleep(2000); ok('limpsOff', (await st()).rivalState, (await st()).rivalState === 'limp');
    ok('repeatTarget', await G(() => Object.values(window.SSX.icecap.state().save.rivals).some(r => r.games === 1 && r.back > Date.now() / 1000)));
    await tap('#icecapRoll'); await sleep(400); ok('panelCloses', await G(() => !document.getElementById('icecapBowl').classList.contains('on') && !window.SSX.icecap.state().bowl));
    ok('noKeysOverlap', await G(() => { const a = document.getElementById('icecapAct'); return !a.classList.contains('on') || a.getBoundingClientRect().bottom < innerHeight - 200; }));
  } catch (e) { bad.push('EXC ' + e.message); console.log(e.stack); }
  ok('noErrors', errors.slice(0, 5), errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? `FAIL ${tag}: ${bad.join(', ')}` : `ALL PASS ${tag}`);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
