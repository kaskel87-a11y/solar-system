// Junkyard lab pack part 2: with sci-01..05 done and the Raccoon Mobile owned, play sci-06..10 start to finish: talk in
// the lab, accept, Raccoon Mobile legs (rdrive), each new dimension (stalkers, ordered picks, the Gut's collapse timer),
// the rift drive into the portal, getaways, the finale badge and the rift tune. Barks go through SSX.bark categories.
// BASE=http://localhost:8817/ DEV=393x852 BR=webkit OUT=/workspace/pw-ben-sci2/shots/ node tests/test-scientists2.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8817/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'sci2';
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

  const veh = () => G(() => window.__app.surface.world.debug.vehicles().filter(v => v.kind === 'raccoon_mobile'));
  // get into the Raccoon Mobile (walk up to it and use the context button), then optionally put it somewhere
  const intoRaccoon = async () => {
    await leave(); if ((await info()).vehicle === 'raccoon_mobile') return true;
    if ((await info()).driving) { await ctxBtn('Exit'); await frames(3); }
    const vs = await veh(); if (!vs.length) return false; const me = await info();
    const v = vs.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    await G(v => window.__app.surface.debugMove(v.x + 2.2, v.z + 0.8, 0), v); await frames(6);
    if (!(await wait(() => window.__app.surface.info.nearVehicle?.kind === 'raccoon_mobile', 4000))) return false;
    await ctxBtn('.'); return wait(() => window.__app.surface.info.vehicle === 'raccoon_mobile', 4000);
  };
  const driveTo = async (x, z, yaw = 0) => { await G(([x, z, yaw]) => window.__app.surface.debugMove(x, z, yaw), [x, z, yaw]); await frames(4); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(600);
    // fresh save with part 1 already done and the Raccoon Mobile bought
    await G(() => { const s = window.__app.surface, P = s.game.debug.P(); s.game.setAliens?.(false); s.game.debug.credits(2000);
      for (const id of ['sci-01', 'sci-02', 'sci-03', 'sci-04', 'sci-05']) P.quests[id] = { status: 'done', everDone: true, step: 0, n: 0 };
      if (!P.upgrades.includes('raccoon_mobile')) P.upgrades.push('raccoon_mobile'); });
    ok('pack2Loaded', null, await G(() => !!window.__sci && window.__sci.ids2?.().length === 5 && ['orchard', 'hum', 'pawn', 'rehearsal', 'gut'].every(k => window.__sci.DIMENSIONS[k])));
    // spy on SSX.bark (keep the real one underneath) so we can see the categories the pack uses
    await G(() => { window.__barkCats = []; const X = window.SSX; if (X && typeof X.bark === 'function' && !X.__sciSpy) { const real = X.bark; X.bark = function (n, c, o) { window.__barkCats.push(c); return real.apply(this, arguments); }; X.__sciSpy = true; } });
    R.vmax0 = await G(() => window.__sci.raccoonSpec()?.vmax);
    let getaways = 0; await G(() => { window.__getaways = 0; window.addEventListener('ssx:getaway', () => window.__getaways++); });
    let chain = [['sci-06', 'Silas'], ['sci-07', 'Tam'], ['sci-08', 'Silas'], ['sci-09', 'Tam'], ['sci-10', 'Silas']];
    if (process.env.FROM) { const k = chain.findIndex(c => c[0] === process.env.FROM); await G(ids => { const P = window.__app.surface.game.debug.P(); for (const id of ids) P.quests[id] = { status: 'done', everDone: true, step: 0, n: 0 }; }, chain.slice(0, k).map(c => c[0])); chain = chain.slice(k); } // debug: FROM=sci-10
    for (const [id, who] of chain) {
      const acc = await talkTo(who); const q0 = await quest();
      ok(id + '-accepted', null, acc && q0?.id === id);
      if (!q0 || q0.id !== id) continue;
      let guard = 0;
      while (guard++ < 14) {
        const q = await quest(); if (!q || q.id !== id) break;
        await G(() => window.__app.surface.game.restore());
        if (q.type === 'goto' || q.type === 'defeat') { await leave(); if ((await info()).driving) await driveTo(q.target.x, q.target.z); else await G(t => window.__app.surface.debugMove(t.x, t.z, 0), q.target); }
        else if (q.type === 'enter') { if ((await info()).driving) { await ctxBtn('Exit'); await frames(3); } await enterB(q.building); }
        else if (q.type === 'clean') {
          await leave(); R[id + '-wanted'] = (await info()).wanted;
          ok(id + '-heatOn', null, (await info()).wanted >= (id === 'sci-10' ? 3 : 2));
          await G(() => window.__app.surface.world.setWanted(0, 'test'));
        } else if (q.type === 'rdrive') {
          // on foot at the target doesn't count; in the Raccoon Mobile it does
          await leave(); if ((await info()).driving) { await ctxBtn('Exit'); await frames(3); }
          await G(t => window.__app.surface.debugMove(t.x + 1, t.z + 1, 0), q.target); await frames(8);
          const qf = await quest(); ok(id + '-rdriveNeedsRaccoon#' + q.step, null, qf && qf.id === id && qf.step === q.step);
          ok(id + '-intoRaccoon#' + q.step, null, await intoRaccoon());
          await driveTo(q.target.x + 1, q.target.z + 1); await frames(6);
          if (!R.driveShot && id === 'sci-06') { R.driveShot = true; await sleep(600); await shot('raccoon-rdrive'); }
        } else if (q.type === 'portal') {
          await leave();
          const P = await G(() => ({ x: window.__sci.S.px, z: window.__sci.S.pz }));
          const rift = await G(() => window.__app.surface.game.debug.step()?.raccoon === 'only');
          if (rift) {
            // on foot it refuses (Tam warns); the Raccoon Mobile drives straight through
            if ((await info()).driving) { await ctxBtn('Exit'); await frames(3); }
            await G(P => window.__app.surface.debugMove(P.x, P.z + 7, 0), P); await frames(4);
            await G(P => window.__app.surface.debugMove(P.x, P.z + 0.3, 0), P); await frames(8);
            ok(id + '-onFootRefused', null, !(await info()).inside);
            await G(P => window.__app.surface.debugMove(P.x + 6, P.z + 8, 0), P); await frames(4);
            ok(id + '-intoRaccoonForRift', null, await intoRaccoon());
            await driveTo(P.x, P.z + 8, 0); await frames(4);
            if (id === 'sci-09') { await G(() => window.__app.surface.setView('third')); await sleep(500); await shot('rift-drive'); }
            await driveTo(P.x, P.z + 0.4, 0);
          } else {
            if ((await info()).driving) { await ctxBtn('Exit'); await frames(3); }
            await G(P => window.__app.surface.debugMove(P.x, P.z + 7, 0), P); await frames(4);
            ok(id + '-portalShown', null, await G(() => window.__sci.S.portal.visible));
            await G(P => window.__app.surface.debugMove(P.x, P.z + 0.3, 0), P); await frames(4);
          }
          let inDim = await wait(k => window.__app.surface.info.inside?.kind === k, 5000, 'sci-' + q.dim);
          ok(id + '-throughPortal', null, inDim);
          if (!inDim) { R[id + '-portalDiag'] = await info(); break; }
          const def = await G(k => { const d = window.__sci.DIMENSIONS[k]; return { picks: d.picks, d: d.d, limit: d.limit || 0, stalker: d.hazards.findIndex(h => h.kind === 'stalker') }; }, q.dim);
          await frames(10);
          if (def.stalker >= 0) {
            // stalker: it comes for you
            await G(d => window.__app.surface.debugInside(0, d / 2 - 2.3, 0), def.d); await frames(2);
            const s0 = await G(i => ({ ...window.__sci.S.run.sp?.[i] }), def.stalker); await frames(30); const s1 = await G(i => ({ ...window.__sci.S.run.sp?.[i] }), def.stalker);
            R[q.dim + '-stalker'] = [s0, s1]; const pz = def.d / 2 - 2.3, dd = o => Math.hypot(o.x, o.z - pz); ok(q.dim + '-stalkerApproaches', null, s1 && s0 && s0.x !== undefined && dd(s1) < dd(s0) - 0.05);
          }
          if (def.limit) {
            // the Gut: let the clock run out once (thrown out), then drive back in and finish
            await G(() => window.__app.surface.game.restore()); await G(d => window.__app.surface.debugInside(0, d / 2 - 1.2, 0), def.d);
            await G(() => { window.__sci.S.run.t = window.__sci.DIMENSIONS.gut.limit - 0.05; }); await frames(6);
            ok('gut-collapseEjects', null, await wait(() => !window.__app.surface.info.inside, 3000));
            const st = await quest(); ok('gut-stepKept', null, st && st.id === id && st.step === q.step);
            await G(() => window.__app.surface.game.restore()); await frames(6);
            // the Raccoon Mobile was left parked in the mouth of the portal, so climbing in punches straight back through
            const bk = (await intoRaccoon()) || (await info()).inside === 'sci-gut'; ok('gut-backIntoRaccoon', null, bk);
            if (!bk) R.gutDiag = { me: await info(), v: await veh(), near: await G(() => window.__app.surface.info.nearVehicle?.kind || null), btn: await G(() => { const b = document.getElementById('driveBtn'); return b ? getComputedStyle(b).display + ':' + b.textContent : null; }), hp: await G(() => window.__app.surface.info.hp ?? null) };
            if (!(await info()).inside) { await driveTo(P.x, P.z + 8, 0); await frames(4); await driveTo(P.x, P.z + 0.4, 0); }
            inDim = await wait(k => window.__app.surface.info.inside?.kind === k, 5000, 'sci-' + q.dim); ok('gut-reentered', null, inDim); if (!inDim) break;
            await frames(10);
          }
          if (['orchard', 'gut'].includes(q.dim)) { await G(d => { window.__app.surface.setView('first'); window.__app.surface.debugInside(0.4, d / 2 - 1.6, 0.1); }, def.d); await frames(10); await sleep(1200); await shot('dim-' + q.dim); await G(() => window.__app.surface.setView('third')); }
          for (const p of def.picks) { await G(p => window.__app.surface.debugInside(p.x, p.z, 0), p); await frames(4); await G(() => window.__app.surface.game.restore()); }
          const after = await quest();
          ok(id + '-dimDone-' + q.dim, null, after && (after.step > q.step || after.id !== id));
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
    getaways = await G(() => window.__getaways); ok('getawayEvents', getaways, getaways >= (process.env.FROM ? 1 : 2));
    ok('finaleBadge', null, await G(() => window.__app.surface.game.progress.badges.includes('Closed the Door Behind Me')));
    await leave(); await frames(6); R.vmax1 = await G(() => window.__sci.raccoonSpec()?.vmax);
    ok('riftTuned', [R.vmax0, R.vmax1], R.vmax1 > R.vmax0);
    R.barkCats = await G(() => [...new Set(window.__barkCats)]);
    const hasSSX = await G(() => typeof window.SSX?.bark === 'function');
    if (hasSSX) {
      ok('barkCategoriesRegistered', null, await G(() => ['sci_silas_idle', 'sci_tam_idle', 'sci_tam_warn', 'sci_ossery_dim', 'sci_hungry_quiet_dim'].every(c => window.__sci.registered().includes(c))));
      ok('barksUseCategories', R.barkCats, R.barkCats.length > 0 && R.barkCats.every(c => /^sci_[a-z_]+$/.test(c)));
      ok('dimHostBarked', R.barkCats, R.barkCats.some(c => /_dim$/.test(c)));
    }
    if (HELD) ok('heldJoystickTaps', await G(() => window.__heldTaps || 0), true);
    ok('noNewButtons', null, await G(() => !document.querySelector('[id^="sci"]')));
    ok('npcCap', null, await G(() => { const b = window.__app.surface.world.npcBudget?.(); return !b || b.used <= b.cap; }));
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || 'none', errors.length === 0);
  R.fail = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
