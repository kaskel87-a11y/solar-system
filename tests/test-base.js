// v7.5 Mars base building e2e: ☰ 🏠 Mars base -> buy Junction East Lot via the context button -> 🏗️ Build -> place a wall,
// gate, garage, stash and turret with the toolbar + context button (taps with a second finger while a thumb holds the
// joystick on phones; mouse + B key on desktop) -> rotate -> remove/refund -> stash deposit -> turret fires at a raider /
// security -> SSX.base.raid emits base:raid -> reload the page -> everything is restored.
// BASE=http://127.0.0.1:8853/ BR=webkit DEV="iPhone 14 Pro" VP=393x852 OUT=/workspace/pw-ben-base/shots/ node test-base.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8853/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR ? process.env.SHOTS_DIR.replace(/\/?$/, '/') : process.env.OUT) || '/workspace/pw-ben-base/shots/', desk = DEV === 'desktop', VP = process.env.VP;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  let opts = desk ? { viewport: { width: 1440, height: 900 } } : { ...pw.devices[DEV] };
  if (VP) { const [w, h] = VP.split('x').map(Number); opts = { ...opts, viewport: { width: w, height: h }, screen: { width: w, height: h } }; }
  delete opts.defaultBrowserType;
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const vp = page.viewportSize(), tag = `base-${vp.width}x${vp.height}-${BR}`;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const press = async sel => { if (desk) await page.click(sel); else await page.tap(sel); };
  // iOS guard: tap our button with a second finger while a thumb rests on the joystick (no click is synthesised)
  const stickTap = sel => G(async sel => {
    const j = document.getElementById('joy'), b = document.querySelector(sel); if (!b) return 'missing ' + sel;
    const jr = j.getBoundingClientRect(), br = b.getBoundingClientRect(), sl = ms => new Promise(r => setTimeout(r, ms));
    const ev = (el, t, id, r) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 50, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    ev(j, 'pointerdown', 50, jr); await sl(60); ev(b, 'pointerdown', 51, br); await sl(60); ev(b, 'pointerup', 51, br); await sl(60); ev(j, 'pointerup', 50, jr); return 'ok';
  }, sel);
  const ourTap = async sel => { if (desk) await page.click(sel); else { const r = await stickTap(sel); if (r !== 'ok') R['stickTap ' + sel] = r; } };
  const act = async () => { if (desk) await page.keyboard.press('KeyB'); else await ourTap('#baseBtn'); };
  const shot = async name => { for (let i = 0; i < 2; i++) { try { await page.screenshot({ path: `${out}${tag}-${name}.png`, timeout: 90000 }); return true; } catch (e) { R['shotRetry-' + name] = i + 1; } } return false; };
  const move = (x, z, yaw = 0) => G(([x, z, yaw]) => window.__app.surface.debugMove(x, z, yaw), [x, z, yaw]);
  const PID = 'aj-east';
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    const l = await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    return l;
  };
  // stand so the build cursor (5 m ahead of the camera) lands on local cell (i, j) of the lot
  const aimAt = async (lx, lz) => {
    const c = await G(id => window.SSX.base.plots().find(p => p.id === id).world, PID);
    let px = c.x + lx, pz = c.z + lz + 5; await move(px, pz, 0); await sleep(400);
    let prev = null;
    for (let k = 0; k < 10; k++) { // the chase camera eases; only trust a cursor that has stopped moving
      const cur = await G(() => window.SSX.base.debug.cursor()); if (!cur) break;
      const still = prev && Math.hypot(cur.x - prev.x, cur.z - prev.z) < 0.05; prev = cur;
      const dx = lx - cur.x, dz = lz - cur.z;
      if (Math.hypot(dx, dz) < 0.35) { if (still) break; await sleep(400); continue; }
      px += dx; pz += dz; await move(px, pz, 0); prev = null; await sleep(500);
    }
    const f0 = await G(() => window.__frames); await wait(f0 => window.__frames >= f0 + 3, 20000, f0); // let a few real frames run at the new spot
    return G(() => window.SSX.base.debug.cursor());
  };
  const cellC = (i, j, w = 1, d = 1) => [(i + w / 2) * 2 - 10, (j + d / 2) * 2 - 10];
  const n = () => G(id => window.SSX.base.state(id).pieces.length, PID);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    await G(() => { localStorage.removeItem('ssx.base.v1'); window.__blog = []; for (const e of ['buy', 'place', 'remove', 'stash', 'turret:fire', 'turret:hit', 'raid', 'raid:end', 'build:on', 'build:off', 'enter']) window.addEventListener('base:' + e, ev => window.__blog.push([e, ev.detail])); });
    ok('api', await wait(() => !!window.SSX?.base?.ready && ['plots', 'owned', 'place', 'remove', 'on', 'raid'].every(k => typeof window.SSX.base[k] === 'function'), 15000));
    ok('landed', await land());
    await G(() => window.__app.surface.game.debug.credits(20000));
    // ---- ☰ -> 🏠 Mars base overview
    await press('#menuBtn'); await wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000);
    ok('menuItem', await G(() => { const b = document.getElementById('baseMenu'); return !!b && getComputedStyle(b).display !== 'none'; }));
    await page.locator('#baseMenu').scrollIntoViewIfNeeded(); await press('#baseMenu');
    ok('overview', await wait(() => document.getElementById('basePanel')?.classList.contains('on'), 5000));
    ok('overviewRows', await G(() => document.querySelectorAll('#basePanel .row').length), (await G(() => document.querySelectorAll('#basePanel .row').length)) === 4);
    await ourTap('#basePanel button[data-act="close"]'); ok('overviewClosed', await wait(() => !document.getElementById('basePanel').classList.contains('on'), 4000));
    // ---- buy the lot with the context button
    const c = await G(id => window.SSX.base.plots().find(p => p.id === id).world, PID);
    await move(c.x, c.z + 12, 0);
    ok('buyBtn', await wait(() => (window.SSX.base.action || '').startsWith('🏷️ Buy'), 8000));
    const cr0 = await G(() => window.__app.surface.game.progress.credits);
    await act(); ok('bought', await wait(id => window.SSX.base.owned().includes(id), 6000, PID));
    ok('charged', await G(() => window.__app.surface.game.progress.credits), (await G(() => window.__app.surface.game.progress.credits)) === cr0 - 1500);
    // ---- build mode
    await move(c.x, c.z + 6, 0); ok('buildBtn', await wait(() => window.SSX.base.action === '🏗️ Build', 8000));
    const clear = await G(() => { const W = innerWidth, H = innerHeight, c = { l: W * 0.3, r: W * 0.7, t: H * 0.3, b: H * 0.7 };
      return ['baseBtn'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width && !(r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b) ? id : null; }).filter(Boolean); });
    await act(); ok('building', await wait(() => !!window.SSX.base.building, 5000));
    ok('toolbar', await G(() => getComputedStyle(document.getElementById('baseBar')).display !== 'none'));
    const clear2 = await G(() => { const W = innerWidth, H = innerHeight, c = { l: W * 0.3, r: W * 0.7, t: H * 0.3, b: H * 0.7 };
      return ['baseBtn', 'baseBar'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width && !(r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b) ? id : null; }).filter(Boolean); });
    ok('centerClear', [...clear, ...clear2].join() || 'clear', clear.length + clear2.length === 0);
    // place one of each piece with the UI: [type, i, j, w, d, rotate?]
    const plan = [['wall', 2, 1, 1, 1, false], ['gate', 4, 1, 1, 1, true], ['garage', 6, 1, 2, 3, false], ['stash', 2, 6, 1, 1, false], ['turret', 7, 7, 1, 1, false]];
    for (const [t, i, j, w, d, rot] of plan) {
      await ourTap('#baseT-' + t); await wait(t => window.SSX.base.building?.type === t && window.SSX.base.building.tool === 'place', 3000, t);
      if (rot) { const r0 = await G(() => window.SSX.base.building.r); if (desk) await page.keyboard.press('KeyO'); else await ourTap('#baseRot'); ok('rotate', await wait(r0 => window.SSX.base.building.r === ((r0 + 1) & 3), 3000, r0)); }
      const [lx, lz] = cellC(i, j, ...(rot ? [d, w] : [w, d])); await aimAt(lx, lz);
      ok('ghost-' + t, await wait(() => window.SSX.base.debug.ghost?.ok && window.SSX.base.debug.ghost.visible && window.SSX.base.debug.ghost.tint === 'ok', 6000));
      if (t === 'garage') await shot('build-ghost');
      const before = await n(); await act();
      ok('placed-' + t, await wait(([id, b]) => window.SSX.base.state(id).pieces.length === b + 1, 6000, [PID, before]));
      R['at-' + t] = await G(([id, t]) => { const p = window.SSX.base.state(id).pieces.find(p => p.type === t); const c = window.SSX.base.debug.cursor(); return p && `${p.i},${p.j} cur ${c && c.x.toFixed(1)},${c && c.z.toFixed(1)}`; }, [PID, t]);
      if (t === 'wall') { ok('invalidTint', await wait(() => window.SSX.base.debug.ghost?.ok === false && window.SSX.base.debug.ghost.tint === 'bad', 15000)); R.ghostAfter = await G(() => JSON.stringify(window.SSX.base.debug.ghost) + ' fps~' + window.__frames); }
    }
    ok('gateRotated', await G(id => window.SSX.base.state(id).pieces.find(p => p.type === 'gate').r, PID), (await G(id => window.SSX.base.state(id).pieces.find(p => p.type === 'gate').r, PID)) === 1);
    // ---- remove tool + refund
    await ourTap('#baseT-remove'); await aimAt(...cellC(2, 1));
    ok('removeAim', await wait(() => (window.SSX.base.action || '').startsWith('🗑️ Remove'), 5000));
    const crR = await G(() => window.__app.surface.game.progress.credits); await act();
    ok('removed', await wait(id => !window.SSX.base.state(id).pieces.some(p => p.type === 'wall'), 5000, PID));
    ok('refund', await G(() => window.__app.surface.game.progress.credits) - crR, (await G(() => window.__app.surface.game.progress.credits)) - crR === 30);
    // a ring of walls through the API for the finished-base shot (API path)
    R.apiPlace = await G(id => { const B = window.SSX.base; let k = 0; for (let i = 0; i < 10; i++) for (const j of [0, 9]) if (B.place(id, 'wall', i, j, 0).ok) k++; for (let j = 1; j < 9; j++) for (const i of [0, 9]) if (B.place(id, 'wall', i, j, 1).ok) k++; return k; }, PID);
    ok('apiPlace', R.apiPlace, R.apiPlace >= 30);
    await ourTap('#baseDone'); ok('buildOff', await wait(() => !window.SSX.base.building && !document.body.classList.contains('basebuild'), 4000));
    // ---- stash
    const sp = await G(id => { const s = window.SSX.base.state(id).pieces.find(p => p.type === 'stash'); return s; }, PID);
    await move(c.x + (sp.i + 0.5) * 2 - 10, c.z + (sp.j + 0.5) * 2 - 10 + 1.6, 0);
    ok('stashBtn', await wait(() => window.SSX.base.action === '💰 Stash', 6000));
    await act(); ok('stashUi', await wait(() => document.getElementById('basePanel').classList.contains('on') && !!document.getElementById('baseStashClose'), 4000));
    await ourTap('#basePanel button[data-op="in"][data-n="100"]');
    ok('deposited', await wait(id => window.SSX.base.state(id).stash.credits === 100, 4000, PID)); await sleep(300);
    await shot('stash');
    await ourTap('#baseStashClose'); await wait(() => !document.getElementById('basePanel').classList.contains('on'), 3000);
    // ---- turret: a raider target (addTargets) inside range, then real security while wanted
    const tp = await G(id => { const B = window.SSX.base, s = B.state(id).pieces.find(p => p.type === 'turret'), w = B.plots().find(p => p.id === id).world; return { x: w.x + (s.i + 0.5) * 2 - 10, z: w.z + (s.j + 0.5) * 2 - 10 }; }, PID);
    await move(c.x - 4, c.z + 16, Math.PI); await sleep(500);
    await G(tp => { window.__hits = 0; window.__off = window.SSX.base.addTargets(() => [{ x: tp.x + 14, z: tp.z + 10, kind: 'raider', hit: () => { window.__hits++; } }]); }, tp);
    const raid = await G(id => window.SSX.base.raid(id, { s: 30, why: 'test' }), PID); R.raidVia = raid.via;
    ok('raidEvent', await wait(() => window.__blog.some(e => e[0] === 'raid' && e[1].plotId && e[1].pos), 3000));
    ok('turretFires', await wait(() => window.__hits >= 1 && window.__blog.some(e => e[0] === 'turret:fire'), 30000)); await sleep(30);
    await shot('turret');
    await G(() => { window.__off(); }); await G(id => window.SSX.base.endRaid(id, 'test'), PID);
    ok('raidEnd', await wait(() => window.__blog.some(e => e[0] === 'raid:end'), 3000));
    await G(() => window.__app.surface.world.setWanted(3, 'test: base turret'));
    R.secHit = await wait(() => window.__blog.some(e => e[0] === 'turret:fire' && e[1].target !== 'raider'), 45000); // informational: depends on where security spawns
    await G(() => window.__app.surface.world.setWanted(0, 'test: done'));
    ok('npcCap', await G(() => window.__app.surface.world.debug.people().length), desk || (await G(() => window.__app.surface.world.debug.people().length)) <= 12);
    await move(c.x + 3, c.z + 26, 0); await sleep(1500); await shot('finished');
    // ---- reload: everything comes back
    const snap = await G(id => JSON.stringify(window.SSX.base.state(id)), PID);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    ok('apiAfterReload', await wait(() => !!window.SSX?.base?.ready, 15000));
    ok('landed2', await land());
    ok('restored', await G(([id, s]) => JSON.stringify(window.SSX.base.state(id)) === s, [PID, snap]));
    ok('ownedAfterReload', await G(id => window.SSX.base.owned().includes(id), PID));
    ok('rendered', await wait(() => window.SSX.base.debug.instances > 30, 8000));
    ok('stashKept', await G(id => window.SSX.base.state(id).stash.credits, PID), (await G(id => window.SSX.base.state(id).stash.credits, PID)) === 100);
  } catch (e) { errors.push('TEST ' + e.message); }
  R.events = await G(() => [...new Set((window.SSX?.base?.log || []))].join(' ')).catch(() => '');
  ok('noErrors', errors.join(' | ') || 'none', errors.length === 0);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
