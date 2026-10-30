// Raccoon Rover (mars/raccoonrover.js): the junker in the Red Tape Flats junkyard, steal (heat + garage, no plates) and buy
// (1200 cr, no heat), the co-pilot's barks (SSX.bark, pinned above the car), loot from dumpsters you crawl past (paused
// while SSX.gravity.floating), pickpocket on key 5 / the 🦝 dock button (touch: tapped while a 2nd finger holds #joy),
// job lock, NPC cap. BASE=http://localhost:8871/ BR=webkit DEV=393x852 SHOTS_DIR=... node tests/test-raccoon.js (DEV=desktop: 1280x800)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8871/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `raccoon-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const toastTx = () => G(() => document.getElementById('toast')?.textContent || '');
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return r.width > 0; }, [t, sel, id, dx, dy]);
  const heldTap = async sel => { await P('pointerdown', '#joy', 41); await P('pointermove', '#joy', 41, 0, -20); const v = await P('pointerdown', sel, 42); await P('pointerup', sel, 42); await P('pointerup', '#joy', 41, 0, -20); return v; };
  const act = async () => { if (touch) { await wait(() => getComputedStyle(document.getElementById('dockRcn')).display !== 'none', 30000); return heldTap('#dockRcn'); } await page.keyboard.press('Digit5'); return true; };
  const st = () => G(() => window.SSX.raccoon.state);
  const junk = () => G(() => window.__raccoon.debug.junkers()[0] || null);
  const faceFrom = (j, dx, dz) => ({ x: j.x + dx, z: j.z + dz, yaw: Math.atan2(dx, dz) }); // fwd = (-sin, -cos): look back at j
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('api', await wait(() => !!window.SSX?.raccoon && typeof window.SSX.raccoon.pickpocket === 'function', 20000));
    ok('vehicleRegistered', await G(() => { const s = window.__raccoon.debug.vehicleSpec(); return !!s && s.price === 1200 && s.dealer === false; }));
    ok('junkyardListed', await G(() => !!window.SSX.districtsOf('Mars').find(d => d.id === 'mars-rough')?.vehicles.some(v => v[0] === 'raccoon_rover')));
    ok('notInDealerStock', await G(() => !(window.SSX.dealerStock?.() || []).some(v => (v.kind || v.id) === 'raccoon_rover')));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); });
    // go to the junkyard (AJ-relative [-310, -2])
    const aj = await G(() => { const c = window.SSX.city.colony(), j = window.__raccoon.debug.junkAJ(); return { x: c.x + j[0], z: c.z + j[1] }; });
    await G(p => window.__app.surface.debugPlace(p.x + 6, p.z + 6, 0.8), aj);
    ok('junkerSpawned', await wait(() => window.__raccoon.debug.junkers().length > 0, 60000));
    let J = await junk(); ok('junkerAtJunkyard', J && `${Math.hypot(J.x - aj.x, J.z - aj.z).toFixed(1)} m`, J && Math.hypot(J.x - aj.x, J.z - aj.z) < 8);
    ok('saleSign', J?.sale === true);
    ok('dumpsters', await G(() => window.__raccoon.debug.dumpsters().length), (await G(() => window.__raccoon.debug.dumpsters().length)) === 8);
    // log every toast text: a teleport into the district can fire the '📍 district' toast right after the hint
    await G(() => { window.__toastLog = []; const t = document.getElementById('toast'); if (t) new MutationObserver(() => window.__toastLog.push(t.textContent || '')).observe(t, { childList: true, characterData: true, subtree: true }); });
    { const f = faceFrom(J, 5.5, -3.5); await G(f => { window.__app.surface.debugPlace(f.x, f.z, f.yaw); window.__app.surface.setView?.('third'); }, f); }
    ok('nearOnFoot', await wait(() => window.SSX.raccoon.state.near, 20000));
    await wait(() => (window.__toastLog || []).some(x => /Raccoon Rover: 1200/.test(x)), 10000);
    { const h = await G(() => (window.__toastLog || []).find(x => /Raccoon Rover: 1200/.test(x)) || document.getElementById('toast')?.textContent || ''); ok('hintToast', h, /Raccoon Rover: 1200/.test(h)); }
    if (touch) ok('dockBuy', await G(() => { const b = document.getElementById('dockRcn'), s = getComputedStyle(b), r = b.getBoundingClientRect(); return s.display !== 'none' && /BUY 1200/.test(b.textContent) && s.backgroundColor === 'rgb(0, 0, 0)' && s.color === 'rgb(255, 255, 255)' && r.width >= 44 && r.height >= 44; }));
    await sleep(1500); await shot('junkyard');
    // broke: buying refuses
    await G(() => { const P = window.__app.surface.game.progress; P.credits = 100; });
    await act(); await sleep(300);
    ok('buyRefusedBroke', await toastTx(), /short/i.test(await toastTx()) && !(await st()).owned);
    // ---- steal: get in without paying ----
    const ridesBefore = await G(() => window.SSX.garage?.rides?.length ?? -1);
    await G(() => window.__app.surface.interact());
    ok('stealDrive', await wait(() => window.__app.surface.info.driving && window.__app.surface.info.vehicle === 'raccoon_rover', 15000));
    ok('stealOwned', await wait(() => window.SSX.raccoon.state.owned && window.SSX.raccoon.state.how === 'stole', 15000));
    ok('stealHeat', await G(() => window.__app.surface.world.wanted), (await G(() => window.__app.surface.world.wanted)) >= 1);
    ok('stealGarage', await G(() => { const r = window.SSX.garage?.rides || []; return `${r.length} rides, last ${r[r.length - 1]?.vehicle || r[r.length - 1]?.kind} noPlates=${r[r.length - 1]?.noPlates}`; }),
      await G(n => { const r = window.SSX.garage?.rides || []; const l = r[r.length - 1]; return r.length === n + 1 && l?.noPlates === true; }, ridesBefore));
    ok('stealBark', await wait(() => window.__raccoon.debug.barks().some(b => b.cat === 'raccoon_steal'), 5000));
    ok('copilotSeated', await G(() => window.__raccoon.debug.pilots().some(Boolean)));
    // ---- buy: reset ownership, pay 1200, get in: no heat ----
    await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 8000);
    await G(() => { window.__raccoon.debug.reset(); window.__app.surface.world.setWanted(0); window.__app.surface.game.progress.credits = 1500; });
    J = await junk(); { const f = faceFrom(J, 3.5, 4.5); await G(f => window.__app.surface.debugPlace(f.x, f.z, f.yaw), f); }
    await wait(() => window.SSX.raccoon.state.near, 20000); await sleep(400);
    ok('buyTap', await act());
    ok('bought', await wait(() => window.SSX.raccoon.state.owned && window.SSX.raccoon.state.how === 'bought', 8000));
    ok('buyPaid', await G(() => window.__app.surface.game.progress.credits), (await G(() => window.__app.surface.game.progress.credits)) === 300);
    ok('saleSignGone', (await junk())?.sale === false);
    await G(() => window.__app.surface.world.setWanted(0));
    await G(() => window.__app.surface.interact());
    ok('ownDrive', await wait(() => window.__app.surface.info.vehicle === 'raccoon_rover', 15000)); await G(() => window.__app.surface.setView?.('third')); await sleep(800);
    ok('ownNoHeat', await G(() => window.__app.surface.world.wanted), (await G(() => window.__app.surface.world.wanted)) === 0);
    if (touch) ok('dockPick', await wait(() => /PICK/.test(document.getElementById('dockRcn').textContent) && getComputedStyle(document.getElementById('dockRcn')).display !== 'none', 20000));
    // ---- co-pilot bark on a crash event ----
    await G(() => window.__raccoon.debug.cool());
    await G(() => window.SSX.emit('game:crash', { speed: 14 }));
    ok('crashBark', await wait(() => window.__raccoon.debug.barks().some(b => b.cat === 'raccoon_crash'), 8000));
    ok('oneCaption', await G(() => document.querySelectorAll('.ssxBark.rcnBark').length), (await G(() => document.querySelectorAll('.ssxBark.rcnBark').length)) === 1);
    ok('barkShown', await G(() => { const e = [...document.querySelectorAll('.ssxBark.rcnBark')].pop(); if (!e) return 'none'; const r = e.getBoundingClientRect(); return `${e.textContent} @${r.left | 0},${r.top | 0}`; }),
      await G(() => { const e = [...document.querySelectorAll('.ssxBark.rcnBark')].pop(); if (!e) return false; const r = e.getBoundingClientRect(); return /^🦝/.test(e.textContent) && r.width > 0 && r.left >= 0 && r.right <= innerWidth && getComputedStyle(e).opacity === '1'; }));
    await sleep(200); await shot('copilot-bark');
    // ---- loot: crawl past a dumpster (paused while floating) ----
    const D = await G(() => { const i = window.__app.surface.info, ds = window.__raccoon.debug.dumpsters(); return ds.sort((a, b) => Math.hypot(a.x - i.x, a.z - i.z) - Math.hypot(b.x - i.x, b.z - i.z))[0]; });
    await G(() => { window.__raccoon.debug.cool(); window.__fakeGrav = !window.SSX.gravity; if (window.__fakeGrav) window.SSX.gravity = { mode: 'ZERO-G', floating: true, on() { return () => {}; } }; else window.__gf = true; });
    const floatingReal = await G(() => !window.__fakeGrav);
    if (!floatingReal) {
      await G(d => window.__app.surface.debugMove(d.x + 3, d.z, 0), D);
      const t0 = await G(() => window.SSX.raccoon.state.t); await wait(t => window.SSX.raccoon.state.t > t + 2, 60000, t0);
      ok('lootPausedFloating', await G(() => window.SSX.raccoon.state.loot), (await G(() => window.SSX.raccoon.state.loot)) === 0);
      await G(() => { delete window.SSX.gravity; });
    }
    const cr0 = await G(() => window.__app.surface.game.progress.credits);
    await G(d => window.__app.surface.debugMove(d.x + 3, d.z, 0), D);
    ok('loot', await wait(() => window.SSX.raccoon.state.loot >= 1, 60000));
    ok('lootPaid', await G(c => { const P = window.__app.surface.game.progress; return `${P.credits - c} cr, stash ${(P.raccoonStash || []).join('|')}`; }, cr0),
      await G(c => { const P = window.__app.surface.game.progress; return P.credits > c || (P.raccoonStash || []).length > 0; }, cr0));
    ok('lootToast', await toastTx(), /Rocket robbed a dumpster/.test(await toastTx()));
    ok('lootBark', await G(() => window.__raccoon.debug.barks().some(b => b.cat === 'raccoon_loot')));
    await sleep(300); await shot('loot');
    // ---- pickpocket: park next to someone, press 5 / tap 🦝 while holding the stick ----
    await G(() => { window.__raccoon.debug.cool(); window.__app.surface.world.setWanted(0); });
    const tgt = await G(() => { const i = window.__app.surface.info, ps = window.__app.surface.world.debug.people().filter(p => p.on && ['colonist', 'contact', 'guard'].includes(p.kind));
      ps.sort((a, b) => (a.kind === 'colonist' ? 0 : 1) - (b.kind === 'colonist' ? 0 : 1) || Math.hypot(a.x - i.x, a.z - i.z) - Math.hypot(b.x - i.x, b.z - i.z)); return ps[0] || null; });
    ok('pickTargetExists', tgt && `${tgt.kind} ${tgt.name || ''}`, !!tgt);
    if (tgt) {
      await G(t => window.__app.surface.debugMove(t.x + 6, t.z + 4, Math.atan2(6, 4)), tgt); await sleep(500);
      const w0 = await G(() => window.__app.surface.world.wanted), c0 = await G(() => window.__app.surface.game.progress.credits);
      ok('pickTap', await act());
      ok('pickOut', await wait(() => !!window.SSX.raccoon.state.pick, 8000));
      ok('runnerOut', await wait(() => window.SSX.raccoon.state.pick?.out > 4 || window.SSX.raccoon.state.pick?.phase === 'back', 60000));
      ok('pilotLeftSeat', await G(() => !window.__raccoon.debug.pilots().some(Boolean) || window.SSX.raccoon.state.pick?.phase === 'back'));
      await shot('pickpocket');
      ok('pickResult', await wait(() => window.SSX.raccoon.state.picks >= 1, 90000));
      const pr = await G(() => window.__raccoon.debug.barks().filter(b => /pick_(ok|fail)/.test(b.cat)).pop()?.cat || 'none');
      const w1 = await G(() => window.__app.surface.world.wanted), c1 = await G(() => window.__app.surface.game.progress.credits);
      ok('pickOutcome', `${pr} credits +${c1 - c0} wanted ${w0}->${w1}`, pr === 'raccoon_pick_ok' ? c1 > c0 : pr === 'raccoon_pick_fail' ? w1 >= w0 + 1 : false);
      await sleep(500); await shot('pickpocket-result');
      ok('pickHome', await wait(() => !window.SSX.raccoon.state.pick, 120000));
      // cooldown refuses an immediate second go
      await act(); await sleep(300); ok('pickCooldown', await toastTx(), /calm his tiny heart/.test(await toastTx()));
    }
    // ---- floating / job lock ----
    await G(() => { window.__raccoon.debug.cool(); window.SSX.gravity = window.SSX.gravity || { mode: 'ZERO-G', floating: true, on() { return () => {}; }, __fake: true }; });
    if (await G(() => !!window.SSX.gravity.__fake)) { const r = await G(() => window.SSX.raccoon.pickpocket()); ok('pickBlockedFloating', r.msg, !r.ok && /floating/.test(r.msg)); await G(() => { delete window.SSX.gravity; }); }
    const js = await G(() => { try { return window.SSX.jobs?.start?.('taxi'); } catch (e) { return { ok: false, msg: e.message }; } });
    if (js?.ok) { const r = await G(() => window.SSX.raccoon.pickpocket()); ok('pickBlockedJob', r.msg, !r.ok && /job/.test(r.msg)); await G(() => window.SSX.jobs.stop?.()); }
    else R.jobSkip = js?.msg || 'no jobs api';
    const b = await G(() => window.SSX.city.npcBudget()); ok('npcBudget', `${b.used}/${b.cap}`, b.used <= b.cap && (!touch || b.cap <= 12));
    ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
