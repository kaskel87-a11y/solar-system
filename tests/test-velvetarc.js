// Velvet expansion test: the bigger Velvet Airlock (small dome gone, east wing: cashier cage, Ines's office, the Dome Room
// with Grisby's high-roller Hold'em table and Mina) + Ines's arc "House Always Wins" (mars/velvetarc.js) + owning the club.
// BASE=http://localhost:8765/ BR=chromium DEV=desktop OUT=/workspace/velvet-shots/ node tests/test-velvetarc.js  (DEV="iPhone 14" BR=webkit for touch)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop', desk = DEV === 'desktop';
const out = process.env.OUT || '/tmp/', tag = `${DEV.replace(/\s+/g, '')}-${BR}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const dev = desk ? { viewport: { width: 1366, height: 768 } }
    : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 }
    : (({ defaultBrowserType, ...o }) => ({ ...o, ...(DEV === 'iPhone 14' ? { viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 2 } : {}) }))(pw.devices[DEV]);
  const ctx = await browser.newContext(dev); await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if ((m.type() === 'error' && !/audio device|Failed to load resource/i.test(m.text())) || /velvetarc|velvetwing/.test(m.text())) errors.push('C ' + m.text()); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, hit: !!t && (t === e || e.contains(t)) }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn'); };
  const at = async (x, z, yaw = 0) => { await G(([x, z, y]) => window.__app.surface.debugInside(x, z, y), [x, z, yaw]); await sleep(350); return G(() => { const s = window.__app.surface.world.nearSpot(); return s ? { id: s.id, label: s.label } : null; }); };
  const label = () => G(() => document.getElementById('driveBtn').textContent);
  const quest = () => G(() => window.__app.game.debug.quest());
  const cr = () => G(() => window.__app.game.progress.credits);
  const hideTour = () => G(() => { const st = document.createElement('style'); st.textContent = '#obLine, #radio.mini { display: none !important; }'; document.head.appendChild(st); });
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await hideTour();
    ok('arcLoaded', await wait(() => !!window.SSX?.velvetArc?.state, 20000));
    await G(() => { const g = window.__app.game, P = g.progress; P.credits = 20000; P.xp = 0; g.save(); window.__app.surface.world.setWanted(0); window.SSX.velvetArc.debug.reset(); });
    // ---- outside: the club grew, same door ----
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    ok('noBeamUnowned', await G(() => !window.SSX?.ownedbeams?.state?.()?.beams?.some(b => b.name === 'owned-beam:velvet')));
    ok('doorKept', `${cd.x},${cd.z.toFixed(1)}`, !!cd);
    await G(([x, z]) => { window.__app.surface.debugPlace(x + 10, z + 26, Math.atan2(-10, 36)); }, [cd.x, cd.z]); await sleep(2500);
    await page.screenshot({ path: out + `velvet-outside-${tag}.png` });
    // ---- inside ----
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(600);
    const loc = await G(() => { const w = window.__app.surface.world.inside, i = window.__app.surface.info; return { lx: +(i.x - w.ax).toFixed(1), lz: +(i.z - w.az).toFixed(1), w: w.x1 - w.x0, d: w.z1 - w.z0 }; });
    ok('roomBigger', `${loc.w}x${loc.d} spawn ${loc.lx},${loc.lz}`, loc.w === 58 && loc.d === 32 && loc.lx === -11 && loc.lz > 20);
    ok('wingSpots', JSON.stringify(await at(18, 15.65, Math.PI)), (await at(18, 15.65, Math.PI))?.id === 'poker-hr');
    await sleep(500); ok('hrLabel', await label(), /High-roller Hold/.test(await label()));
    // Mina (the Dome Room waitress) has her own drinks spot that follows her
    const mina = await G(() => window.__velvetWing?.mina?.());
    ok('minaWalks', JSON.stringify(mina), !!mina && mina.x > 11 && mina.x < 25 && mina.z > 1 && mina.z < 24);
    const ms = await at(mina.x + 0.3, mina.z + 0.3); ok('minaSpot', ms?.id, ms?.id === 'waitress-dome');
    ok('officeLocked', JSON.stringify(await at(21.5, -3.6)), (await at(21.5, -3.6))?.id !== 'velvet-desk');
    // old room spots untouched
    ok('showSpotKept', (await at(6.55, -5.3))?.id, (await at(6.55, -5.3))?.id === 'show');
    ok('leaveSpot', (await at(-11, 22))?.id, (await at(-11, 22))?.id === 'leave');
    // screenshots of the wing
    await G(() => window.__app.surface.debugInside(5.5, 21, -Math.PI * 0.62)); await sleep(1800);
    await page.screenshot({ path: out + `velvet-domeroom-${tag}.png` });
    await G(() => window.__app.surface.debugInside(14.5, -1.5, Math.PI * 0.75)); await sleep(1500);
    await page.screenshot({ path: out + `velvet-office-${tag}.png` });
    // high-roller table opens the Velvet Hold'em modal
    await at(18, 15.65, Math.PI); await sleep(300); await act();
    ok('hrPokerOpens', await wait(() => /Velvet Hold/.test(document.getElementById('pokerPanel')?.textContent || ''), 4000));
    await G(() => { const p = document.getElementById('pokerPanel'); const b = p && [...p.querySelectorAll('button')].find(b => /leave|close|✕|walk/i.test(b.textContent + (b.getAttribute('aria-label') || ''))); b?.click(); });
    await page.keyboard.press('Escape').catch(() => {}); await sleep(600);
    // ---- the arc: locked until 10 bottles or 3000 stars ----
    ok('lockedAtStart', await G(() => window.SSX.velvetArc.state().unlocked === false));
    await G(() => { const g = window.__app.game; g.progress.xp = 3000; g.save(); });
    ok('unlocks3000', await wait(() => window.SSX.velvetArc.state().unlocked === true, 4000));
    ok('accept1', await G(() => { const g = window.__app.game; g.accept('ines-arc-1-shortpour'); return g.debug.quest()?.id; }), (await quest())?.id === 'ines-arc-1-shortpour');
    R.m1step0 = await G(() => window.__app.game.debug.step()?.text);
    await G(() => window.__app.game.abandon?.()); await sleep(300);
    // mission 2: Grisby's ledger (the swipe), with Mina's screen
    await G(() => { const P = window.__app.game.progress; P.quests = P.quests || {}; P.quests['ines-arc-1-shortpour'] = { ...(P.quests['ines-arc-1-shortpour'] || {}), everDone: true, done: 1 }; window.__app.game.save(); });
    await G(() => window.__app.game.accept('ines-arc-2-comped')); await sleep(600);
    ok('accept2', (await quest())?.id, (await quest())?.id === 'ines-arc-2-comped');
    for (let i = 0; i < 6 && (await G(() => window.__app.game.debug.step()?.type)) !== 'swipe'; i++) { await G(() => window.__app.game.debug.advance()); await sleep(400); }
    ok('swipeStep', await G(() => window.__app.game.debug.step()?.type), (await G(() => window.__app.game.debug.step()?.type)) === 'swipe');
    const ls = await at(22.3, 8.2, 0); ok('ledgerSpot', ls?.id, ls?.id === 'velvet-ledger');
    await sleep(3500); R.swipeAfter3s = await G(() => window.SSX.velvetArc.runner.swipe);
    await G(() => window.SSX.velvetArc.debug.swipeDone()); 
    ok('swipeDone', await wait(() => window.__app.game.debug.step()?.type === 'escape', 12000));
    ok('ledgerGone', await G(() => window.SSX.velvetArc.ledgerGone()));
    await G(() => window.__app.game.abandon?.()); await G(() => window.__app.game.debug.clear()); await sleep(400);
    // mission 5: the handover in the Dome Room (Thorne appears), then his armored suit outside
    await G(() => { const P = window.__app.game.progress; for (const id of ['ines-arc-2-comped', 'ines-arc-3-closingtime', 'ines-arc-4-upstairs']) P.quests[id] = { ...(P.quests[id] || {}), everDone: true, done: 1 }; window.__app.game.save(); });
    await G(() => window.__app.game.accept('ines-arc-5-house')); await sleep(800);
    ok('accept5', (await quest())?.id, (await quest())?.id === 'ines-arc-5-house');
    if ((await G(() => window.__app.game.debug.step()?.type)) === 'enter') { await G(() => window.__app.game.debug.advance()); await sleep(400); }
    const hs = await at(15, 19.5, Math.PI); ok('handoverSpot', hs?.id, hs?.id === 'velvet-handover');
    ok('thorneHere', await G(() => window.SSX.velvetArc.thorneHere()));
    await G(() => window.__app.surface.debugInside(9, 17, -Math.PI * 0.6)); await sleep(1200);
    await page.screenshot({ path: out + `velvet-handover-${tag}.png` });
    await at(15, 19.5, Math.PI); await act();
    ok('handoverDone', await wait(() => window.__app.game.debug.step()?.type === 'defeat', 9000));
    await G(() => window.__app.game.abandon?.()); await G(() => window.__app.game.debug.clear());
    // ---- owning it ----
    await G(() => window.SSX.velvetArc.debug.own('signed')); await sleep(500);
    ok('owned', await G(() => window.SSX.velvetArc.owned() && window.SSX.velvetArc.showMult() === 0.75 && window.SSX.velvetArc.upstairsFree()));
    const dk = await at(21.5, -3.6, 0); ok('deskSpot', dk?.id, dk?.id === 'velvet-desk');
    await G(() => window.SSX.velvetArc.debug.day()); await sleep(400);
    ok('deskLabel', await wait(() => /collect 400 cr/.test(document.getElementById('driveBtn').textContent), 4000)); R.deskLabel = await label();
    const c0 = await cr(), x0 = await G(() => window.__app.game.progress.xp); await act(); await sleep(600);
    ok('collected', `+${(await cr()) - c0} cr, +${(await G(() => window.__app.game.progress.xp)) - x0} xp`, (await cr()) - c0 === 400 && (await G(() => window.__app.game.progress.xp)) - x0 >= 40);
    // the office safe: no limit
    await G(() => { window.SSX.contraband.reset?.(); window.SSX.contraband.add('glowdust', 3); });
    const sf = await at(24.0, -5.6, Math.PI); ok('safeSpot', sf?.id, sf?.id === 'velvet-safe');
    await act(); ok('safeSheet', await wait(() => getComputedStyle(document.getElementById('varcSheet') || document.body).display !== 'none' && !!document.getElementById('varcSheet'), 3000));
    await sleep(450);
    const sb = await center('#varcSheet button'); ok('safeBtn', sb && `${Math.round(sb.w)}x${Math.round(sb.h)} hit=${sb.hit}`, !!sb && sb.h >= 44 && sb.hit);
    ok('safeBW', await G(() => { const c = getComputedStyle(document.querySelector('#varcSheet button')); return c.backgroundColor + ' / ' + c.color; }), /rgb\(0, 0, 0\) \/ rgb\(255, 255, 255\)/.test(await G(() => { const c = getComputedStyle(document.querySelector('#varcSheet button')); return c.backgroundColor + ' / ' + c.color; })));
    await page.screenshot({ path: out + `velvet-safe-${tag}.png` });
    await tapSel('#varcSheet button'); await sleep(500);
    ok('safeStored', JSON.stringify(await G(() => window.SSX.velvetArc.state().safe)), (await G(() => window.SSX.velvetArc.state().safe.glowdust)) === 3 && !(await G(() => window.SSX.contraband.stash().items.glowdust)));
    await G(() => { const s = document.getElementById('varcSheet'); if (s) s.style.display = 'none'; });
    // 8% of the table action while you own it
    await at(18, 15.65, Math.PI); await act(); await wait(() => /Velvet Hold/.test(document.getElementById('pokerPanel')?.textContent || ''), 4000);
    const till0 = await G(() => window.SSX.velvetArc.state().till);

    if (await G(() => !!document.querySelector('#pokerPanel button[data-buy="100"]'))) await tapSel('#pokerPanel button[data-buy="100"]');
    ok('take8pct', await wait(t => window.SSX.velvetArc.state().till >= t + 8, 4000, till0), undefined); R.take8pct = (await G(() => window.SSX.velvetArc.state().till)) - till0;
    if (await G(() => !!document.querySelector('#pokerPanel [data-cash]'))) await tapSel('#pokerPanel [data-cash]');
    await sleep(600);
    // no ColSec raids on the Velvet while it's yours
    ok('raidRefused', JSON.stringify(await G(() => window.SSX.raids?.start ? window.SSX.raids.start({ id: 'tv', pos: [-30, -40], radius: 20, attackers: 'colsec', waves: [{ count: 1 }], label: 'test' }) : 'no raids')), await G(() => !window.SSX.raids?.start || window.SSX.raids.start({ id: 'tv2', pos: [-30, -40], radius: 20, attackers: 'colsec', waves: [{ count: 1 }] })?.why === 'velvet-owned'));
    // walk out: Leave works, then the green beam over the club
    await at(-11, 22, Math.PI); await act();
    ok('leftClub', await wait(() => !window.__app.surface.info.inside, 6000));
    await G(([x, z]) => { window.__app.surface.debugPlace(x + 8, z + 52, Math.atan2(-8, 62)); }, [cd.x, cd.z]); await sleep(2500);
    ok('beam', await wait(() => !!window.SSX?.ownedbeams?.state?.()?.beams?.some(b => b.name === 'owned-beam:velvet'), 5000));
    await G(([x, z]) => window.SSX.hudx?.setWaypoint?.({ x, z, label: 'The Velvet Airlock' }, true), [cd.x, cd.z]);
    ok('wpGreen', await wait(() => { const o = window.SSX?.wpbeam?.object?.(); return o && o.children.find(c => c.name === 'wp-beam-col')?.material.uniforms.uCol.value.getHex() === 0x0b6b2a; }, 5000));
    await page.screenshot({ path: out + `velvet-beam-${tag}.png` });
    ok('noErrors', errors.length ? errors.slice(0, 3).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.fails = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
