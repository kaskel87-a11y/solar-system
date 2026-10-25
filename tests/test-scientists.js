// Junkyard lab pack: buy + drive the Raccoon Mobile at the Meridian Depot, then play the whole Silas & Tam chain
// (sci-01..05) start to finish: talk in the lab, accept, every step, through each portal, the dimension objective, and back.
// BASE=http://localhost:8817/ DEV=393x852 BR=webkit OUT=/workspace/pw-ben-raccoon/shots/ node tests/test-scientists.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8817/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || '/workspace/pw-ben-raccoon/shots/', PFX = process.env.PFX || 'sci';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /sci/.test(m.text()))) errors.push(m.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 15000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = (n = 4) => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png`, timeout: 90000 });
  // touch: every tap goes in while a second finger rests on the joystick (pointer ids 41 held, 42 tapping), with no
  // synthetic click, the way iOS behaves. Buttons bound with plain onclick fail this; onTap (pointerdown->pointerup) passes.
  const HELD = touch && process.env.HELD !== '0';
  const tapHeld = sel => G(s => {
    const e = document.querySelector(s), j = document.getElementById('joy'); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width) return false;
    const jr = j.getBoundingClientRect(), P = (t, el, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    const jx = jr.left + jr.width / 2, jy = jr.top + jr.height / 2, x = r.x + r.width / 2, y = r.y + r.height / 2;
    P('pointerdown', j, 41, jx, jy); P('pointerdown', e, 42, x, y); P('pointerup', e, 42, x, y); P('pointerup', j, 41, jx, jy);
    window.__heldTaps = (window.__heldTaps || 0) + 1; return true;
  }, sel);
  const tapAt0 = async sel => { const c = await G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, sel); if (!c) return false; if (touch) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); return true; };
  const tapAt = sel => HELD ? tapHeld(sel) : tapAt0(sel);
  const ctxBtn = async (re) => { const okv = await wait(r => { const b = document.getElementById('driveBtn'); return b && getComputedStyle(b).display !== 'none' && new RegExp(r).test(b.textContent); }, 6000, re); if (!okv) return false; await tapAt('#driveBtn'); await frames(3); return true; };
  const info = () => G(() => { const i = window.__app.surface.info; return { inside: i.inside?.kind || null, driving: i.driving, vehicle: i.vehicle, wanted: i.wanted, x: i.x, z: i.z, spot: i.spot?.label || null }; });
  const quest = () => G(() => { const g = window.__app.surface.game, q = g.debug.quest(), s = q && g.debug.step(); return q ? { id: q.id, step: q.step, type: s.type, dim: s.dim || null, text: g.info?.quest?.text || s.text, building: s.building || null, target: q.target && { x: q.target.x, z: q.target.z } } : null; });
  const door = name => G(n => window.__app.surface.world.doorFor(n) && (({ x, z, kind, name }) => ({ x, z, kind, name }))(window.__app.surface.world.doorFor(n)), name);
  const leave = async () => { if ((await info()).inside) { await G(() => window.__app.surface.leaveBuilding()); await frames(3); } };
  // walk up to a door and use the context button (falls back to the API if the button doesn't show)
  const enterB = async (name) => {
    await leave(); const d = await door(name); if (!d) return false;
    await G(d => window.__app.surface.debugMove(d.x, d.z + 1.2, 0), d); await frames(4);
    if (!(await ctxBtn('.'))) R['fallback-' + name] = true;
    if (!(await wait(k => window.__app.surface.info.inside?.kind === k, 3000, d.kind))) { await G(n => window.__app.surface.enterBuilding(window.__app.surface.world.doorFor(n)), name); await frames(3); }
    return (await info()).inside === d.kind;
  };
  const accept = async () => { const v = await wait(() => getComputedStyle(document.getElementById('radio')).display !== 'none' && getComputedStyle(document.getElementById('radioAccept')).display !== 'none', 6000); if (!v) return false; await tapAt('#radioAccept'); await frames(3); return true; };
  const talkOnce = async (who) => {
    const diag = async stage => { R.talkDiag = R.talkDiag || []; R.talkDiag.push({ who, stage, ...(await info()), btn: await G(() => { const b = document.getElementById('driveBtn'); return b ? getComputedStyle(b).display + ':' + b.textContent : null; }), radio: await G(() => { const r = document.getElementById('radio'); return r ? getComputedStyle(r).display + ':' + r.textContent.slice(0, 80) : null; }), q: await quest() }); return false; };
    if (!(await enterB('junkyard lab'))) return diag('enter');
    const spot = who === 'Silas' ? [-1.6, -1.2] : [1.9, -0.4];
    await G(([x, z]) => window.__app.surface.debugInside(x, z, 0), spot); await frames(4);
    if (!(await ctxBtn(who))) return diag('ctx');
    return (await accept()) || diag('accept');
  };
  // retried: on a loaded CI box the room/ctx button can lag a few frames behind
  const talkTo = async (who) => { for (let i = 0; i < 3; i++) { if (await talkOnce(who)) return true; await frames(10); await sleep(500); } return false; };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(600);
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.debug.credits(2000); });
    ok('packLoaded', null, await G(() => !!window.__sci && window.__sci.ids().length === 5));
    // barks: SSX.bark (Pumpkin's PR #5) when present, own caption otherwise
    R.barks = await G(() => { const X = window.SSX = window.SSX || {}; const had = X.bark; const calls = [];
      delete X.bark; const a = window.__sci.bark('Tam', 'idle', 'Two hundred and twelve rivets.');
      X.bark = (n, c, l) => { calls.push([n, c, l]); }; const b = window.__sci.bark('Silas', 'idle', 'Colleague.');
      if (had) X.bark = had; else delete X.bark; return { fallback: a, ssx: b, calls: calls.length }; });
    ok('barkFallbackCaption', R.barks, R.barks.fallback === 'caption');
    ok('barkUsesSSX', R.barks, R.barks.ssx === 'ssx' && R.barks.calls === 1);
    ok('labDoor', null, !!(await door('junkyard lab')));
    // ---------- Raccoon Mobile: geometry budget, for sale, buy at the Depot counter, drive with no heat ----------
    R.raccoon = await G(async () => { const W = await import('./world.js?v=7.5'); const v = W.buildVehicle('raccoon_mobile'); let n = 0; v.group.traverse(o => { if (o.isMesh) n++; }); const stock = W.buildVehicle('buggy'); let s = 0; stock.group.traverse(o => { if (o.isMesh) s++; }); return { meshes: n, stock: s, spec: W.VEHICLES.raccoon_mobile }; });
    ok('raccoonAccents<=10', R.raccoon.meshes - R.raccoon.stock, R.raccoon.meshes - R.raccoon.stock <= 10 && R.raccoon.spec?.price === 900);
    if (!(await enterB('depot'))) bad.push('depotEnter');
    await G(() => window.__app.surface.debugInside(-7.8, 3, 0)); await frames(4);
    ok('counterSpot', null, await ctxBtn('counter'));
    ok('shopListsRaccoon', null, await wait(() => !!document.querySelector('#shopPanel [data-buy="raccoon_mobile"]') && getComputedStyle(document.getElementById('shopPanel')).display !== 'none', 4000));
    await tapAt('#shopPanel [data-buy="raccoon_mobile"]'); await frames(3);
    ok('bought', null, await wait(() => window.__app.surface.game.progress.upgrades.includes('raccoon_mobile'), 3000));
    await tapAt('#shopClose'); await leave();
    const park = await G(() => { const p = window.__app.surface.world.colonyAt([-36, -7]); return { x: p.x, z: p.z }; });
    // stand off its front-left quarter, facing it, for the beauty shot; then step up to it
    await G(p => { const fx = -Math.sin(0.35), fz = -Math.cos(0.35), x = p.x + fx * 7 + 2.5, z = p.z + fz * 7 + 1; window.__app.surface.debugMove(x, z, Math.atan2(-(p.x - x), -(p.z - z))); }, park); await frames(6); await sleep(900);
    await shot('raccoon');
    await G(p => window.__app.surface.debugMove(p.x + 2.2, p.z + 0.8, 0), park); await frames(6);
    ok('nearRaccoon', null, await wait(() => window.__app.surface.info.nearVehicle?.kind === 'raccoon_mobile', 4000));
    await ctxBtn('.');
    ok('drivingRaccoon', null, await wait(() => window.__app.surface.info.vehicle === 'raccoon_mobile', 4000));
    await sleep(300);
    ok('noHeatOwned', (await info()).wanted, (await info()).wanted === 0);
    const p0 = await info(); await page.keyboard.down('KeyW');
    // frame-paced, not wall-clock: under software GL the frame rate (and so the distance per second) varies a lot
    await wait(p => { const i = window.__app.surface.info; return Math.hypot(i.x - p.x, i.z - p.z) > 3.5; }, 8000, p0).catch(() => {}); await page.keyboard.up('KeyW');
    const p1 = await info(); R.drove = Math.round(Math.hypot(p1.x - p0.x, p1.z - p0.z) * 10) / 10;
    ok('raccoonDrives', R.drove, R.drove > 3);
    await ctxBtn('Exit'); await frames(3);
    // ---------- the chain ----------
    let getaway = 0; await G(() => { window.__getaways = 0; window.addEventListener('ssx:getaway', () => window.__getaways++); });
    const chain = [['sci-01', 'Silas'], ['sci-02', 'Silas'], ['sci-03', 'Tam'], ['sci-04', 'Silas'], ['sci-05', 'Silas']];
    let firstLab = true;
    for (const [id, who] of chain) {
      if (firstLab) { await enterB('junkyard lab'); await G(() => { window.__app.surface.setView('first'); window.__app.surface.debugInside(0.1, 4.6, 0); }); await frames(10); await sleep(1200); await shot('lab'); await G(() => window.__app.surface.setView('third')); firstLab = false; }
      const acc = await talkTo(who); const q0 = await quest();
      ok(id + '-accepted', null, acc && q0?.id === id);
      if (!q0 || q0.id !== id) continue;
      let guard = 0;
      while (guard++ < 12) {
        const q = await quest(); if (!q || q.id !== id) break;
        await G(() => window.__app.surface.game.restore());
        if (q.type === 'goto' || q.type === 'defeat') { await leave(); await G(t => window.__app.surface.debugMove(t.x, t.z, 0), q.target); }
        else if (q.type === 'enter') { await enterB(q.building); }
        else if (q.type === 'clean') {
          await leave(); R[id + '-wanted'] = (await info()).wanted;
          ok(id + '-heatOn', null, (await info()).wanted >= 2);
          await G(() => window.__app.surface.world.setWanted(0, 'test'));
        } else if (q.type === 'portal') {
          await leave();
          const P = await G(() => ({ x: window.__sci.S.px, z: window.__sci.S.pz }));
          await G(P => window.__app.surface.debugMove(P.x, P.z + 7, 0), P); await frames(4);
          ok(id + '-portalShown', null, await G(() => window.__sci.S.portal.visible));
          await G(P => window.__app.surface.debugMove(P.x, P.z + 0.3, 0), P); await frames(4);
          const inDim = await wait(k => window.__app.surface.info.inside?.kind === k, 4000, 'sci-' + q.dim);
          ok(id + '-throughPortal', null, inDim);
          if (!inDim) break;
          const def = await G(k => { const d = window.__sci.DIMENSIONS[k]; return { picks: d.picks, d: d.d }; }, q.dim);
          if (q.dim === 'gravbog') { await G(() => { window.__app.surface.setView('first'); window.__app.surface.debugInside(0.5, 8, 0.15); }); await frames(10); await sleep(1200); await shot('portal-dimension'); await G(() => window.__app.surface.setView('third')); }
          for (const p of def.picks) { await G(p => window.__app.surface.debugInside(p.x, p.z, 0), p); await frames(4); await G(() => window.__app.surface.game.restore()); }
          const after = await quest();
          ok(id + '-dimDone-' + q.dim, null, after && (after.step > q.step || after.id !== id));
          // and back: the Leave spot at the door you came in by drops you outside next to the portal
          await G(d => window.__app.surface.debugInside(0, d / 2 - 1.2, 0), def.d); await frames(4);
          await ctxBtn('Leave');
          const back = await wait(() => !window.__app.surface.info.inside, 3000); const bi = await info();
          ok(id + '-backOnMars', null, back && Math.hypot(bi.x - P.x, bi.z - P.z) < 6);
          await G(P => window.__app.surface.debugMove(P.x, P.z + 8, 0), P); await frames(3);
        }
        await frames(6); await sleep(150);
        const qn = await quest(); if (qn && qn.id === q.id && qn.step === q.step) { R[id + '-stuck'] = q.type + '#' + q.step; break; }
      }
      const done = await G(id => window.__app.surface.game.progress.quests[id]?.status === 'done', id);
      ok(id + '-done', null, done);
    }
    getaway = await G(() => window.__getaways); ok('getawayEvent', getaway, getaway >= 1);
    ok('badge', null, await G(() => window.__app.surface.game.progress.badges.includes('Interdimensional Delinquent')));
    // HUD: centre of the screen stays clear (no permanent buttons added by the pack)
    if (HELD) ok('heldJoystickTaps', await G(() => window.__heldTaps || 0), true);
    ok('noNewButtons', null, await G(() => !document.querySelector('[id^="sci"]')));
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || 'none', errors.length === 0);
  R.fail = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
