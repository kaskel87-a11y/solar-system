// v7.5.25 (+7.5.30 racks) browser test: the Hydro Den (mars/hydroden.js). Land on Mars, stand south of the ARES JUNCTION dome, walk up to the
// airlock (no getting stuck), 🚪 Enter Hydro Den, walk to Sister Nettle, tap her, trade silo potatoes and rover moonshine for
// contraband, check stash/silo/crates/credits, leave. No console errors; panel black/white; screenshots.
// BASE=http://localhost:8766/ BR=chromium DEV="iPhone 14" OUT=/workspace/dome/ node tests/test-hydroden.js   (DEV=desktop for 1366x768)
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
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const P = document.getElementById('hdPanel'); if (P && P.contains(e)) { const pr = P.getBoundingClientRect(), r0 = e.getBoundingClientRect(); if (r0.top < pr.top + 4 || r0.bottom > pr.bottom - 4) P.scrollTop += r0.top - pr.top - P.clientHeight / 2 + r0.height / 2; } const r = e.getBoundingClientRect(); if (r.width < 2) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); await sleep(250); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(400); };
  const shot = async p => { try { await page.screenshot({ path: p, timeout: 120000 }); R.shots = (R.shots || []).concat(p); } catch (e) { R.shotFail = (R.shotFail || []).concat(p); } };
  const info = () => G(() => { const i = window.__app.surface.info; return { x: i.x, z: i.z, inside: i.inside?.kind || null, spot: i.spot?.id || null, btn: document.getElementById('driveBtn')?.textContent || '' }; });
  // walk toward world (x, z) with the keyboard / camera-facing yaw, up to ms
  const walkTo = async (x, z, ms = 12000, near = 0.9) => {
    const t0 = Date.now(); let last = null, stuck = 0;
    while (Date.now() - t0 < ms) {
      const p = await info(); const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < near) return { ok: true, d };
      await G(([x, z]) => { const s = window.__app.surface, i = s.info; s.debugPlace(i.x, i.z, Math.atan2(-(x - i.x), -(z - i.z))); }, [x, z]);
      await page.keyboard.down('KeyW'); await sleep(250); await page.keyboard.up('KeyW');
      const q = await info(); if (last && Math.hypot(q.x - last.x, q.z - last.z) < 0.05) stuck++; else stuck = 0; last = q; if (stuck > 6) return { ok: false, stuck: true, d };
    }
    const p = await info(); return { ok: Math.hypot(x - p.x, z - p.z) < near, d: Math.hypot(x - p.x, z - p.z) };
  };
  try {
    await page.goto(base + '?onboard=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); });
    ok('api', await G(() => ['goods', 'quote', 'trade', 'open', 'close', 'door'].every(k => typeof window.SSX?.hydroden?.[k] === 'function') && window.SSX.hydroden.tagged));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(1500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { try { window.SSX.time.set(13); window.SSX.time.freeze?.(true); } catch (e) { /* */ } const g = window.__app.game; g.setAliens?.(false); g.progress.credits = 5000; });
    const door = await G(() => window.SSX.hydroden.door()); ok('door', door, !!door && door.name === 'Hydro Den');
    // stock: own the homestead with 6 potatoes in the silo, 6 bottles of potato moonshine in the rover
    await G(() => { const F = window.SSX.farm, s = F.debug.state(); s.owned = true; localStorage.setItem('ssx.farm.v1', JSON.stringify(s)); F.debug.reload(); F.bank({ potato: 6 }, { hand: true }); window.SSX.liquor.add('potato_moonshine', 6); window.SSX.contraband.reset?.(); });
    ok('stocked', await G(() => window.SSX.hydroden.goods()), (await G(() => window.SSX.hydroden.goods().length)) === 2);
    // walk up from 9 m south of the door
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 9, 0), [door.x, door.z]); await sleep(800);
    await shot(out + `dome-outside-${tag}.png`);
    const w = await walkTo(door.x, door.z, 15000, 1.6); ok('walked to the airlock', w, w.ok);
    await sleep(500); ok('enter button', (await info()).btn, /Enter Hydro Den/.test((await info()).btn));
    await tapSel('#driveBtn'); ok('inside', await wait(() => window.__app.surface.info?.inside?.kind === 'hydroden', 8000));
    await sleep(800);
    const I = await G(() => window.__app.surface.info.inside);
    // indoors: stand 4 m in front of Nettle's table facing her (debugPlace is outdoor-only), then walk up with W
    await G(() => window.__app.surface.debugInside(0, 3.0, 0)); await sleep(300);
    let wn = null; for (let k = 0; k < 30 && !wn; k++) { await page.keyboard.down('KeyW'); await sleep(150); await page.keyboard.up('KeyW'); const q = await info(); if (q.spot === 'hd:nettle') wn = { ok: true, steps: k }; }
    wn = wn || { ok: false, at: await info() }; ok('walked to Nettle', wn, wn.ok);
    await sleep(400); ok('nettle button', (await info()).btn, /Talk to Sister Nettle/.test((await info()).btn));
    await tapSel('#driveBtn'); ok('panel open', await wait(() => !!document.getElementById('hdPanel'), 4000));
    const style = await G(() => { const b = document.querySelector('#hdPanel button[data-good]'); const s = getComputedStyle(b); return { bg: s.backgroundColor, c: s.color }; });
    ok('black/white buttons', style, style.bg === 'rgb(0, 0, 0)' && style.c === 'rgb(255, 255, 255)');
    await G(() => window.SSX.hydroden.debug.rng(() => 0.99)); // no heat for the scripted trades
    await shot(out + `dome-trade-${tag}.png`);
    const cr0 = await G(() => window.__app.game.progress.credits);
    await tapSel('#hdPanel button[data-good="potato"]');
    const s1 = await G(() => ({ m: document.querySelector('#hdPanel .m')?.textContent || document.getElementById('hdPanel')?.innerHTML.slice(0, 120) || 'no panel', gd: window.SSX.contraband.stash().items.glowdust?.qty || 0, silo: window.SSX.farm.status().silo.potato || 0, cr: window.__app.game.progress.credits }));
    ok('potatoes -> glow-dust', s1, s1.gd === 12 && s1.silo === 1 && s1.cr - cr0 === 5 * 105 - 12 * 40);
    await tapSel('#hdPanel button[data-drug="redstatic"]');
    await tapSel('#hdPanel button[data-good="potato_moonshine"]');
    const s2 = await G(() => ({ on: document.querySelector('#hdPanel button.on')?.dataset.drug, m: document.querySelector('#hdPanel .m')?.textContent, st: document.getElementById('hdPanel')?.scrollTop, rs: window.SSX.contraband.stash().items.redstatic?.qty || 0, shine: (window.SSX.liquor.inventory().find(b => b.id === 'potato_moonshine') || {}).n || 0, cr: window.__app.game.progress.credits }));
    ok('moonshine -> red static (pocket cap 20)', s2, s2.rs === 8 && s2.shine === 2);
    await shot(out + `dome-traded-${tag}.png`);
    // v7.5.32 sell side: pockets are full (12 glow-dust + 8 red static = 20/20) -> banner; Nettle buys product and crops for cash
    await G(() => { if (window.__toasts) return; const t = window.__app.toast; window.__toasts = []; window.__app.toast = (m, ms) => { window.__toasts.push(m); return t(m, ms); }; });
    const lastToast = () => G(() => window.__toasts.slice(-1)[0] || '');
    const ban = await G(() => document.querySelector('#hdPanel [data-full]')?.textContent || '');
    ok('full-pockets banner', ban, ban === 'Pockets full (20/20) — sell some product below to make room');
    const banStyle = await G(() => { const s = getComputedStyle(document.querySelector('#hdPanel [data-full]')); return s.backgroundColor + ' ' + s.color; });
    ok('banner black/white', banStyle, /rgb\(255, 255, 255\) rgb\(0, 0, 0\)/.test(banStyle));
    await G(() => { document.getElementById('hdPanel').scrollTop = 0; });
    await shot('/workspace/dome/nettle-sell-iphone-14-chromium.png');
    await tapSel('#hdPanel button[data-good="potato_moonshine"]'); const tn = await lastToast(); ok('greyed swap tap -> feedback', tn, /pockets are full/i.test(tn) && /Sell some product/.test(tn));
    const fr = await G(() => window.SSX.hydroden.fence('redstatic')); const c0 = await G(() => window.__app.game.progress.credits);
    await sleep(1100); await tapSel('#hdPanel button[data-sell="redstatic"][data-q="1"]');
    const sr = { rs: await G(() => window.SSX.contraband.stash().items.redstatic?.qty || 0), cr: (await G(() => window.__app.game.progress.credits)) - c0, fr, toast: await lastToast(), banner: await G(() => !!document.querySelector('#hdPanel [data-full]')) };
    ok('sell 1 red static -> fence price, room made', sr, sr.rs === 7 && sr.cr === fr && fr > 0 && fr <= 68 && /Nettle buys 1/.test(sr.toast) && !sr.banner);
    const fg = await G(() => window.SSX.hydroden.fence('glowdust')); const c1 = await G(() => window.__app.game.progress.credits);
    await sleep(1100); await tapSel('#hdPanel button[data-sell="glowdust"][data-q="all"]');
    const sa = { gd: await G(() => window.SSX.contraband.stash().items.glowdust?.qty || 0), cr: (await G(() => window.__app.game.progress.credits)) - c1, fg };
    ok('sell all glow-dust', sa, sa.gd === 0 && sa.cr === 12 * fg);
    const c2 = await G(() => window.__app.game.progress.credits);
    await sleep(1100); await tapSel('#hdPanel button[data-cash="potato"][data-q="1"]');
    const sp = { silo: await G(() => window.SSX.farm.status().silo.potato || 0), cr: (await G(() => window.__app.game.progress.credits)) - c2, toast: await lastToast() };
    ok('sell 1 potato for cash (95)', sp, sp.silo === 0 && sp.cr === 95 && /Nettle pays 95/.test(sp.toast));
    // heat: a forced wire gives a star
    await G(() => { window.SSX.hydroden.debug.rng(() => 0); window.SSX.contraband.reset?.(); window.SSX.liquor.add('potato_moonshine', 1); });
    const h = await G(() => window.SSX.hydroden.trade('potato_moonshine', 'lowg')); await sleep(300);
    ok('heat on a wire', { heat: h.heat, wanted: await G(() => window.__app.surface.world.wanted) }, h.heat && (await G(() => window.__app.surface.world.wanted)) >= 1);
    await G(() => { window.__app.surface.world.setWanted?.(0); window.SSX.hydroden.close(); });
    // v7.5.30 grow racks: tap -> panel; plant (rent + seeds), timer, harvest to silo or straight to Nettle; raid risk; toast on every tap
    await G(() => { window.SSX.contraband.reset?.(); window.SSX.hydroden.debug.rackClear(); window.__app.game.progress.credits = 1000; window.__app.surface.world.setWanted?.(0); window.SSX.hydroden.close(); });
    await G(() => window.__app.surface.debugInside(-4.7, 0.6, Math.PI / 2)); await sleep(500);
    await G(() => { if (window.__toasts) return; const t = window.__app.toast; window.__toasts = []; window.__app.toast = (m, ms) => { window.__toasts.push(m); return t(m, ms); }; }); // record every toast (the on-screen one queues behind game toasts)
    const toastT = () => G(() => window.__toasts.slice(-2).join(' | '));
    ok('rack prompt', (await info()).btn, (await info()).spot === 'hd:racks' && /Grow racks · rent one/.test((await info()).btn));
    await tapSel('#driveBtn'); await sleep(200);
    ok('tap rack -> panel + toast', await toastT(), !!(await G(() => document.querySelector('#hdPanel button[data-plant="potato"]'))) && /Rent a rack/.test(await toastT()));
    await sleep(1100); await tapSel('#hdPanel button[data-plant="potato"]'); await sleep(200);
    const pl = { cr: await G(() => window.__app.game.progress.credits), toast: await toastT(), timer: await G(() => document.querySelector('#hdPanel [data-timer]')?.textContent || ''), btn: (await info()).btn };
    ok('plant potatoes -> 175 cr, timer in panel + prompt', pl, pl.cr === 825 && /Planted/.test(pl.toast) && /left/.test(pl.timer) && /left/.test(pl.btn));
    await sleep(1100); await tapSel('#hdPanel button[data-check]'); await sleep(200); const tw = await toastT(); ok('check growing -> feedback', tw, /Still growing/.test(tw));
    await shot(out + `dome-rack-${tag}.png`);
    await G(() => { window.SSX.hydroden.debug.rackReady(); window.SSX.hydroden.debug.rng(() => 0.99); }); await sleep(900);
    ok('ripe -> harvest buttons', await G(() => !!document.querySelector('#hdPanel button[data-take="silo"]') && !!document.querySelector('#hdPanel button[data-take="glowdust"]')));
    const silo0 = await G(() => window.SSX.farm.status().silo.potato || 0);
    await sleep(1100); await tapSel('#hdPanel button[data-take="silo"]'); await sleep(200);
    const hs = { silo: await G(() => window.SSX.farm.status().silo.potato || 0), toast: await toastT(), phase: await G(() => window.SSX.hydroden.rack().phase) };
    ok('harvest into silo -> +5 potatoes, rack free', { silo0, ...hs }, hs.silo - silo0 === 5 && /into your silo/.test(hs.toast) && hs.phase === 'empty');
    await sleep(1100); await tapSel('#hdPanel button[data-plant="potato"]'); await G(() => { window.SSX.hydroden.debug.rackReady(); window.SSX.hydroden.debug.rng(() => 0); }); await sleep(900);
    const cr1 = await G(() => window.__app.game.progress.credits);
    await sleep(1100); await tapSel('#hdPanel button[data-take="glowdust"]'); await sleep(300);
    const rd = { gd: await G(() => window.SSX.contraband.stash().items.glowdust?.qty || 0), cr: (await G(() => window.__app.game.progress.credits)) - cr1, wanted: await G(() => window.__app.surface.world.wanted), toast: await toastT() };
    ok('raided sale to Nettle -> half seized, star, 2 potatoes -> 5 glow-dust + 10 cr', rd, rd.gd === 5 && rd.cr === 10 && rd.wanted >= 1 && /raid/i.test(rd.toast));
    await sleep(1100); await tapSel('#hdPanel button[data-leave]'); ok('Done closes the rack panel', !(await G(() => !!document.getElementById('hdPanel'))));
    await G(() => { window.__app.surface.world.setWanted?.(0); window.SSX.hydroden.debug.rng(() => 0.99); });
    // Nettle's prompt still wins at her table
    await G(() => window.__app.surface.debugInside(0, -0.6, 0)); await sleep(400); ok('Nettle prompt at her table', (await info()).btn, /Talk to Sister Nettle/.test((await info()).btn));
    // leave
    await G(() => window.__app.surface.leaveBuilding()); await sleep(600); ok('left', (await info()).inside === null);
    const fps = await G(() => window.__app.surface.renderer?.info?.render?.calls ?? null); R.calls = fps;
  } catch (e) { bad.push('threw: ' + e.message); }
  ok('no errors', errors.slice(0, 5), errors.filter(e => !/favicon|404|GPU stall|WebGL/i.test(e)).length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
