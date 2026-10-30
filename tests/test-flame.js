// 🔥 Flamethrower (mars/flame.js) on an iPhone 14 (393x852): it's for sale at Ozzie's Iron counter, buying takes 3500 cr,
// hold FIRE sprays a cone (pooled particles under the cap), colony folk catch fire (DoT, flee, charred), a parked vehicle
// burns and blows, a crop patch burns away, wanted heat goes up, fuel drains and the fuel bar shows it, firing works while
// airborne (jetpack stub), the 🔥 control doesn't overlap other HUD and hides in hide-HUD, the farm save is untouched.
// SHOTS_DIR=$PWD/shots BASE=http://127.0.0.1:8881/ BR=webkit node tests/test-flame.js   (one browser at a time)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8881/', BR = process.env.BR || 'webkit';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'flame')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...dev } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...dev, viewport: { width: 393, height: 852 } }); const page = await ctx.newPage();
  const R = { br: BR }, bad = [], errs = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  page.on('pageerror', e => errs.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /\[flame\]/.test(m.text()))) errs.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a);
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { const f = `${out}flame-393x852-${BR}-${s}.png`; await page.screenshot({ path: f, timeout: 15000 }); return f; };
  const FS = () => G(() => window.SSX.flame.state());
  // hold the real FIRE button (pointer events, like a thumb)
  const fireDown = () => G(() => { const b = document.getElementById('fireBtn'), r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); });
  const fireUp = () => G(() => { const b = document.getElementById('fireBtn'), r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); });
  // stand dist m from (x,z), facing it, camera settled behind
  const faceAt = async (x, z, dist, ang = 0) => { await G(([x, z, dist, ang]) => { const s = window.__app.surface, px = x + Math.cos(ang) * dist, pz = z + Math.sin(ang) * dist; s.debugPlace(px, pz, Math.atan2(px - x, pz - z)); }, [x, z, dist, ang]); await sleep(900); };
  const overlaps = () => G(() => {
    const me = document.getElementById('flameHud'); if (!me || getComputedStyle(me).display === 'none') return { shown: false, hits: [] };
    const a = me.getBoundingClientRect(), hits = [];
    for (const e of document.querySelectorAll('button, #joy, #miniMap, #topBar, #stackR, #ssxDock, #hxMore, #hxMoreP, #farmAct, #ssxMouthHorn, #gravPad, #ssxTicker')) {
      if (me.contains(e)) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      let p = e, hid = false; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') { hid = true; break; } p = p.parentElement; } if (hid) continue;
      if (cs.position !== 'fixed' && !e.closest('[style*="fixed"], #surfHud, #surfBtns, #ssxDock, #hud')) continue;
      const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue;
      if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) hits.push((e.id || e.className || e.tagName) + ' ' + JSON.stringify([Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]));
    }
    return { shown: true, rect: [Math.round(a.left), Math.round(a.top), Math.round(a.width), Math.round(a.height)], hits };
  });
  try {
    await page.goto(base, { timeout: 180000 });
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    ok('api', await wait(() => !!window.SSX?.flame, 30000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await G(() => { window.__app.game?.setAliens?.(false); window.__app.game?.debug?.clear?.(); });
    await sleep(1500); const farmKeys = () => G(() => { try { const o = JSON.parse(localStorage.getItem('ssx.farm.v1')); return o ? Object.keys(o).sort().join() : null; } catch (e) { return 'bad'; } }); const farm0 = await farmKeys();
    ok('hooked', await wait(() => window.__app.surface.game.__flameShop === true && window.__app.surface.game.update.__flame === true, 15000));
    ok('hudHiddenUnowned', await G(() => getComputedStyle(document.getElementById('flameHud') || document.body).display === 'none' || !document.getElementById('flameHud')));
    // ---- the shop: Ozzie's Iron counter ----
    const cr0 = await G(() => { const g = window.__app.surface.game; g.progress.credits = 9000; return g.progress.credits; });
    const list = await G(() => window.__app.surface.game.shopList('guns').items.filter(i => i.id.startsWith('fl:')).map(i => ({ id: i.id, price: i.price, group: i.group, ok: i.ok })));
    ok('inGunsList', list, list.length === 2 && list[0].id === 'fl:flamer' && list[0].price === 3500 && list[0].group === 'Weapons');
    const notBar = await G(() => window.__app.surface.game.shopList('bar').items.some(i => i.id.startsWith('fl:')));
    ok('notAtBar', !notBar, !notBar);
    // walk into Ozzie's Iron if the door is there, then tap the counter's shop
    const inside = await G(() => { const w = window.__app.surface.world, d = (w.doorList?.() || []).find(d => d.kind === 'guns'); if (!d) return false; window.__app.surface.debugPlace(d.x, d.z + 1.2, 0); return true; });
    if (inside) { await sleep(600); await G(() => { try { window.__app.surface.interact?.(); } catch (e) { } }); await sleep(1500); }
    R.indoorsShop = await G(() => document.body.classList.contains('indoors'));
    await G(() => window.__app.openShop('guns', 'Ozzie'));
    await sleep(500);
    const row = await G(() => { const b = document.querySelector('[data-buy="fl:flamer"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { t: b.closest('div,li,.item')?.textContent?.slice(0, 160), y: r.top, h: r.height, x: r.left, w: r.width }; });
    ok('shopRow', row && row.t, !!row && /Flamethrower/.test(row.t) && /3500/.test(row.t));
    await sleep(500); R.shotShop = await shot('shop');
    await page.tap('[data-buy="fl:flamer"]'); await sleep(500);
    const bought = await G(() => ({ cr: window.__app.surface.game.progress.credits, st: window.SSX.flame.state(), msg: document.getElementById('shopMsg')?.textContent || '' }));
    ok('bought', { cr: bought.cr, fuel: bought.st.fuel, eq: bought.st.eq, msg: bought.msg }, bought.cr === cr0 - 3500 && bought.st.owned && bought.st.eq && bought.st.fuel === 100);
    const fuelRow = await G(() => window.__app.surface.game.shopList('guns').items.find(i => i.id === 'fl:fuel'));
    ok('fuelFullNotBuyable', fuelRow.why, fuelRow.why === 'Full' && !fuelRow.ok);
    await G(() => { const c = document.querySelector('#shopPanel .close, #shopClose, [data-close]'); if (c) c.click(); document.getElementById('shopPanel')?.classList.remove('show'); const s = document.getElementById('shopPanel'); if (s) s.style.display = 'none'; });
    if (R.indoorsShop) { await G(() => { try { window.__app.surface.world.exitBuilding?.(); } catch (e) { } }); await sleep(1500); }
    // indoors: FIRE is holstered, the flamer doesn't fire
    // ---- out in the colony: a live colonist ----
    await G(() => { const s = window.__app.surface, c = s.world.colony; s.debugPlace(c.x + 6, c.z + 22, 0); }); await sleep(2500);
    ok('outside', await wait(() => !document.body.classList.contains('indoors'), 8000));
    const npc = await G(() => { const s = window.__app.surface, ps = s.world.debug.people(), p = s.info; let best = null, bd = 1e9; ps.forEach((q, i) => { if (q.on === false || q.kind !== 'colonist') return; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = { i, ...q, d }; } }); return best; });
    ok('npcFound', npc && npc.name, !!npc);
    const cap = await G(() => window.__app.surface.world.debug.people().filter(p => p.on !== false).length); ok('npcCap', cap, cap <= 12);
    const wanted0 = await G(() => window.__app.surface.world.wanted | 0);
    await faceAt(npc.x, npc.z, 4.2, 0.3);
    ok('hudShown', await G(() => getComputedStyle(document.getElementById('flameHud')).display !== 'none'));
    await fireDown(); await sleep(700);
    // follow the target if they bolt (retarget on the same NPC)
    let st1 = await FS();
    R.shotFire = await shot('fire');
    await sleep(500); st1 = await FS(); await fireUp(); await sleep(600);
    ok('firing', { firing: st1.firing, live: st1.live, cap: st1.cap }, st1.firing && st1.live > 20 && st1.live <= st1.cap);
    ok('fuelUsed', st1.fuel, st1.fuel < 100 && st1.fuel > 80);
    ok('npcBurning', st1.burning, st1.burning.some(b => b.type === 'p'));
    const st2 = await FS(); ok('dotCharring', st2.burning.map(b => b.char), st2.burning.some(b => b.type === 'p' && b.char > 0.3));
    const fled = await G(i => window.__app.surface.world.debug.people()[i], npc.i); ok('fled', { from: [Math.round(npc.x), Math.round(npc.z)], to: [Math.round(fled.x), Math.round(fled.z)] }, Math.hypot(fled.x - npc.x, fled.z - npc.z) > 1.0);
    const wanted1 = await G(() => window.__app.surface.world.wanted | 0); ok('wantedHeat', { before: wanted0, after: wanted1 }, wanted1 > wanted0);
    ok('stoppedOnRelease', !(await FS()).firing);
    // clear the heat so cops don't swamp the vehicle test (and the bribe card the screenshot)
    await G(() => { try { window.__app.surface.world.setWanted?.(0); } catch (e) { } });
    await sleep(300); R.shotBurn = await shot('burn');
    // ---- a parked vehicle: burns, then blows with the game's explosion ----
    const veh = await G(() => { const s = window.__app.surface, p = s.info; const vs = s.world.debug.vehicles().filter(v => v.parked && v.kind !== 'shuttle' && !/raccoon/i.test(v.kind)); vs.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); return vs[0] || null; });
    ok('vehicleFound', veh && veh.kind, !!veh);
    await faceAt(veh.x, veh.z, 5.5, 1.2);
    await fireDown(); await sleep(1000); await fireUp(); await sleep(300);
    const st3 = await FS(); ok('vehicleBurning', st3.burning.filter(b => b.type === 'v'), st3.burning.some(b => b.type === 'v'));
    await G(([x, z]) => { const s = window.__app.surface; s.debugPlace(x + 11, z + 11, Math.atan2(11, 11)); }, [veh.x, veh.z]); // back off to a safe distance, facing it
    await sleep(900); R.shotBurnCar = await shot('burn-vehicle');
    ok('vehicleBoom', await wait(() => window.SSX.flame.state().stats.carBooms >= 1, 12000));
    await sleep(250); R.shotBoom = await shot('boom');
    await G(() => { try { window.__app.surface.world.setWanted?.(0); } catch (e) { } });
    // ---- crops (session-only patches, never on the farm plot) ----
    const crop = (await FS()).crops[0]; ok('cropsPlaced', (await FS()).crops.length, !!crop);
    const farmPl = await G(() => window.SSX.farm?.places?.() || []);
    ok('cropsOffFarm', (await FS()).crops.every(c => !farmPl.some(p => p.id === 'farm' && Math.hypot(c.x - p.x, c.z - p.z) < p.r + 3)));
    if (crop) { await faceAt(crop.x, crop.z, 4.5, 2.2); await fireDown(); await sleep(700); await fireUp(); await sleep(400);
      ok('cropBurns', await wait(x => window.SSX.flame.state().crops.some(c => Math.round(c.x) === x && (c.gone || c.burn > 0)), 3000, crop.x));
      ok('cropGone', await wait(() => window.SSX.flame.state().stats.crops >= 1, 6000)); }
    // ---- airborne / jetpack: firing isn't blocked (guarded stub of the unmerged SSX.jetpack) ----
    // v7.5.9: with Pumpkin's real jetpack merged (#85) it re-attaches SSX.jetpack every frame, so fly for real (hold Jump); stub only without it
    const realJet = await G(() => !!window.__jetpack);
    const jump = t => G(([t]) => { const e = document.getElementById('jumpBtn'), r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: 51, pointerType: 'touch', isPrimary: false, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerdown' ? 1 : 0 })); }, [t]);
    if (realJet) { await G(() => { window.__jetpack.give(); window.__app.surface.world.setWanted?.(0); }); await jump('pointerdown'); await wait(() => window.__jetpack.alt > 3, 15000); }
    else await G(() => { window.SSX.jetpack = { active: () => true }; window.__app.surface.world.setWanted?.(0); });
    const fa = (await FS()).stats.shots; await fireDown(); await sleep(500); const sj = await FS(); await fireUp(); await sleep(realJet ? 100 : 700);
    ok('airborneFires', { realJet, airborne: sj.airborne, firing: sj.firing }, sj.airborne && sj.firing && sj.stats.shots > fa);
    if (realJet) { await jump('pointerup'); await wait(() => !window.__jetpack.s.flying && window.__app.surface.info.grounded, 30000); await sleep(600); }
    else await G(() => { delete window.SSX.jetpack; });
    // ---- fuel bar ----
    await G(() => window.SSX.flame.debug.setFuel(37)); await sleep(500);
    const fb = await G(() => { const e = document.getElementById('flameFuel'), r = e.getBoundingClientRect(); return { t: document.getElementById('flameFuelT').textContent, vis: getComputedStyle(e).display !== 'none', w: r.width, top: r.top }; });
    ok('fuelBar', fb, fb.vis && fb.t === 'FUEL 37%');
    const ov = await overlaps(); ok('noOverlapPortrait', ov, ov.shown && ov.hits.length === 0);
    R.shotFuel = await shot('fuel');
    // empty tank: FIRE does nothing (and the regular gun doesn't fire instead)
    await G(() => window.SSX.flame.debug.setFuel(0)); await fireDown(); await sleep(400); const se = await FS(); await fireUp(); await sleep(500);
    ok('dryNoFire', !se.firing);
    await G(() => window.SSX.flame.debug.setFuel(60));
    // buy fuel back at the counter
    const fbuy = await G(() => { const g = window.__app.surface.game, c = g.progress.credits, r = g.buy('fl:fuel'); return { r, d: c - g.progress.credits, f: window.SSX.flame.state().fuel }; });
    ok('buyFuel', fbuy, fbuy.r.ok && fbuy.d === 180 && fbuy.f === 100);
    // ---- hide-HUD / cinematic hides the 🔥 control ----
    const hid = await G(async () => { document.body.classList.add('cinematic'); await new Promise(r => setTimeout(r, 80)); const v = getComputedStyle(document.getElementById('flameHud')).display; document.body.classList.remove('cinematic'); return v; });
    ok('hiddenInCinematic', hid, hid === 'none');
    // the 🔥 toggle (pointer events): stow and re-equip
    await page.tap('#flameBtn'); await sleep(200); const t1 = (await FS()).eq; await page.tap('#flameBtn'); await sleep(200); const t2 = (await FS()).eq;
    ok('toggle', { t1, t2 }, t1 === false && t2 === true);
    // picking another gun puts the flamer away
    await G(() => window.__app.surface.game.switchWeapon('rifle')); await sleep(400);
    ok('switchUnequips', !(await FS()).eq);
    // landscape: still clear of other controls
    await G(() => window.SSX.flame.equip(true));
    await page.setViewportSize({ width: 852, height: 393 }); await sleep(1200);
    const ovL = await overlaps(); ok('noOverlapLandscape', ovL, ovL.shown && ovL.hits.length === 0);
    await page.setViewportSize({ width: 393, height: 852 }); await sleep(600);
    // farm save untouched
    const farm1 = await farmKeys(); ok('farmSaveFormatUntouched', { farm0, farm1 }, farm0 === farm1);
    ok('ownSave', await G(() => !!JSON.parse(localStorage.getItem('ssx.flame.v1')).owned));
    ok('partsCap', (await FS()).stats.peak, (await FS()).stats.peak <= (await FS()).cap);
    R.stats = (await FS()).stats;
  } catch (e) { bad.push('threw: ' + e.message); }
  const errs2 = errs.filter(e => !/favicon|404|Failed to load resource/.test(e));
  ok('noErrors', errs2.length ? errs2.slice(0, 6) : 0, errs2.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FLAME FAIL: ' + bad.join(', ') : 'FLAME OK');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
