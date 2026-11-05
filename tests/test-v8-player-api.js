// v8 models: the player body API (look/models-player.js, SSX.models.player()). On the v8 body (?models=1) and the blocky rig
// (?models=0): a cube on every slot renders (own-layer render, so a hidden parent would show 0 px), follows its bone/limb,
// survives the blocky fallback (detach -> blocky sockets -> back on the bones), tints, hides the helmet / hair, and
// SSX.on('models:player') fires on each swap. One screenshot (v8 body, cubes + tint + no helmet). One browser.
// BASE=http://127.0.0.1:8883/ SHOTS_DIR=$PWD/.shots/v8p NODE_PATH=/workspace/pw-steve/node_modules node tests/test-v8-player-api.js
const { webkit, chromium, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8883/', BR = process.env.BR || 'webkit';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'v8p')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch();
  const { defaultBrowserType, ...dev } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...dev, viewport: { width: 393, height: 852 } }); const page = await ctx.newPage();
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ssx.v8.nogov', '1'); localStorage.setItem('ssx.v8.nodrs', '1'); localStorage.setItem('ssx.view.v1', '3.6'); localStorage.removeItem('ssx.models'); } catch (e) {}
    window.__pev = []; const iv = setInterval(() => { const X = window.SSX; if (X?.on && X.registerSurfaceTick) { clearInterval(iv); X.on('models:player', h => window.__pev.push(h?.body || null)); } }, 50);
  });
  const errs = []; page.on('pageerror', e => errs.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /v8 (look|models)/.test(m.text()))) errs.push(m.text().slice(0, 220)); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, cond) => { R[k] = v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const land = async (qs) => {
    await page.goto(base + '?look=med&' + qs + '&t=' + Date.now(), { timeout: 120000 });
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000);
    await G(() => { const g = window.__app.surface.game; g?.setAliens?.(false); g?.debug?.clear?.(); if (window.SSX?.time?.set) { window.SSX.time.set('noon'); window.SSX.time.freeze(true); } });
    await sleep(800);
  };
  // put a coloured cube on every slot (MeshBasic, no fog / tone mapping, noV8 so the look leaves it alone)
  const dress = () => G(async () => {
    const THREE = await import('three'); window.__T3 = THREE; const P = window.SSX.models.player();
    window.__cubes = {}; window.__offs = [];
    P.slots.forEach((s, i) => {
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12), m = new THREE.MeshBasicMaterial(); m.color.setHSL(i / P.slots.length, 1, 0.5); m.fog = false; m.toneMapped = false; m.userData.noV8 = true;
      const c = new THREE.Mesh(geo, m); c.name = 'cube:' + s; c.userData.noV8 = true; window.__offs.push(P.attach(s, c)); window.__cubes[s] = c;
    });
    return P.slots.length;
  });
  // per slot: own layer, own render target, count lit pixels (0 = not rendered: hidden parent, wrong layer, off screen)
  const check = () => G(() => {
    const P = window.SSX.models.player(), S = window.__v8models.S, ren = window.__app.renderer, cam = window.__app.surface?.camera || S.ctx?.camera, sc = P.root.parent;
    const THREE = window.__T3, RT = window.__ssxRT || (window.__ssxRT = new THREE.WebGLRenderTarget(393, 852));
    const res = {}, px = new Uint8Array(393 * 852 * 4), bg = sc.background, mask = cam.layers.mask, cc = ren.getClearColor(new THREE.Color()), ca = ren.getClearAlpha(), prevRT = ren.getRenderTarget();
    sc.updateMatrixWorld(true);
    const v = new THREE.Vector3(), gp = P.root.getWorldPosition(new THREE.Vector3());
    for (const [s, c] of Object.entries(window.__cubes)) {
      let chain = true; for (let o = c; o; o = o.parent) if (!o.visible) chain = false;
      c.getWorldPosition(v); const inScene = (() => { for (let o = c; o; o = o.parent) if (o === sc) return true; return false; })();
      c.layers.enable(28); cam.layers.set(28); sc.background = null; ren.setClearColor(0x000000, 1); ren.setRenderTarget(RT); ren.clear(); ren.render(sc, cam);
      ren.readRenderTargetPixels(RT, 0, 0, 393, 852, px); let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 60) n++;
      c.layers.disable(28); cam.layers.mask = mask;
      const sock = c.parent?.userData?.ssxSocket, bone = c.parent?.parent;
      res[s] = { px: n, chain, inScene, layer0: c.layers.test(cam.layers), sock, on: bone?.isBone ? bone.name : bone?.geometry?.type || (bone === P.root ? 'group' : '?'), keep: !!c.userData.ssxKeep, y: +(v.y - gp.y).toFixed(2) };
    }
    ren.setRenderTarget(prevRT); sc.background = bg; ren.setClearColor(cc, ca);
    return res;
  });
  const allOk = (r) => Object.values(r).every(x => x.px > 0 && x.chain && x.inScene && x.layer0 && x.keep);
  const uni = () => G(() => { const P = window.SSX.models.player(), m = P.inst?.meshes?.lod0?.[0]?.material; const R = m?.userData?.U?.uReg?.value; const glass = P.inst?.meshes?.lod0?.find(o => o.material?.transparent);
    return { reg: R?.map(v => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2), +v.w.toFixed(2)]), glassHidden: glass ? glass.layers.mask === (1 << 30) : null }; });
  try {
    // ---------------- v8 body ----------------
    await land('models=1');
    await G(() => window.SSX.models?.preload?.(['player']).catch(() => {}));
    const v8 = await wait(() => window.SSX.models?.player?.().body === 'v8', 60000); await frames(10);
    R.state0 = await G(() => ({ ...window.SSX.models.player().state(), models: window.SSX.models.state().version }));
    ok('v8_body', R.state0, v8);
    R.sizes = await G(() => window.SSX.models.player().sizes);
    ok('v8_sizes', R.sizes.headRadius, R.sizes.body === 'v8' && R.sizes.headRadius > 0.07 && R.sizes.headRadius < 0.2 && R.sizes.shoulderWidth > 0.3 && R.sizes.shoulderWidth < 0.7 && R.sizes.legLength > 0.6 && R.sizes.height > 1.4 && R.sizes.height < 2.1);
    ok('v8_dress', await dress(), true); await frames(6);
    // tint + hide helmet + hide hair
    await G(() => window.SSX.models.player().setTint({ torso: 0xd02020, arms: 0x20a040, legs: 0x2040d0, boots: 0xe0c020, gloves: { color: 0xff40ff, k: 0.9 } }).hideHelmet(true).hideHair(true)); await frames(4);
    const u = await uni(); R.uniforms = u;
    ok('v8_tint', u.reg?.slice(1, 6).map(r => r[3]), u.reg && [1, 2, 3, 4, 5].every(k => u.reg[k][3] > 0.5) && u.reg[1][0] > u.reg[1][2]);
    ok('v8_hideHelmet', { helmet: u.reg?.[6], glassHidden: u.glassHidden }, u.reg?.[6][3] < 0 && u.glassHidden === true);
    ok('v8_hideHair', u.reg?.[7], u.reg?.[7][3] < 0);
    const c1 = await check(); R.v8 = c1; ok('v8_allSlotsRender', Object.fromEntries(Object.entries(c1).map(([k, x]) => [k, x.px + '/' + x.on])), allOk(c1));
    ok('v8_onBones', null, Object.values(c1).every(x => /^(Head|Neck|Spine2|Left|Right)/.test(x.on)));
    ok('v8_order', { head: c1.head.y, torso: c1.torso.y, legL: c1.legL.y, footL: c1.footL.y }, c1.head.y > c1.torso.y && c1.torso.y > c1.legL.y && c1.legL.y > c1.footL.y && c1.footL.y < 0.35);
    // the low-detail fallback re-runs on the rig: nothing attached may be hidden
    await G(() => { const S = window.__v8models.S; window.__v8models.dev.blocky(S.player, false); }); await frames(2);
    const c2 = await check(); ok('v8_fallbackKeepsAttached', Object.values(c2).map(x => x.px).join(','), allOk(c2));
    // follows the walk: arm cube moves with the animation over time
    const p0 = await G(() => { const v = window.__cubes.handR.getWorldPosition(window.__cubes.handR.position.clone()); return [v.x, v.y, v.z]; });
    await G(() => { const i = window.SSX.models.player().inst; window.__v8models.dev.play(i, 'Punch', 0.05); }); await sleep(450);
    const p1 = await G(() => { const v = window.__cubes.handR.getWorldPosition(window.__cubes.handR.position.clone()); return [v.x, v.y, v.z]; });
    const mv = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); ok('v8_handFollowsBone', +mv.toFixed(3), mv > 0.02);
    await sleep(700);
    // screenshot: v8 body, tinted, no helmet, a cube on every slot
    const shotPath = out + 'v8p-iphone-14-webkit-player-api.jpg';
    await page.screenshot({ path: shotPath, type: 'jpeg', quality: 82, timeout: 90000 }); R.shot = shotPath;
    // swap: force the blocky fallback for one tick (detach + sync), then the model comes back on the next ticks
    const sw = await G(() => { const S = window.__v8models.S, P = window.__v8models.PLAYER; window.__v8models.dev.detach(S.player); P.sync(S.ctx); return { body: P.body, ev: window.__pev.slice() }; });
    const c3 = await check(); R.swapBlocky = sw;
    ok('swap_toBlocky', { body: sw.body, px: Object.values(c3).map(x => x.px).join(',') }, sw.body === 'blocky' && allOk(c3));
    ok('swap_blockyOnLimbs', { armL: c3.armL.on, legR: c3.legR.on, head: c3.head.on }, c3.armL.on === 'CylinderGeometry' && c3.legR.on === 'CylinderGeometry' && c3.head.on === 'group');
    const back = await wait(() => window.SSX.models.player().body === 'v8', 20000); await frames(4);
    const c4 = await check(); const ev = await G(() => window.__pev.slice());
    ok('swap_backToV8', { back, px: Object.values(c4).map(x => x.px).join(',') }, back && allOk(c4) && Object.values(c4).every(x => /^(Head|Neck|Spine2|Left|Right)/.test(x.on)));
    ok('event_models_player', ev, ev.includes('v8') && ev.includes('blocky') && ev[ev.length - 1] === 'v8');
    const u2 = await uni(); ok('swap_keepsLook', u2.reg?.[1], u2.reg?.[1][3] > 0.5 && u2.reg?.[6][3] < 0);
    // reset + detach
    await G(() => { const P = window.SSX.models.player(); P.resetTint().hideHelmet(false).hideHair(false); for (const f of window.__offs) f(); }); await frames(2);
    const u3 = await uni(); const left = await G(() => Object.values(window.__cubes).filter(c => c.parent).length);
    ok('reset', { reg: u3.reg?.map(r => r[3]).join(','), glassHidden: u3.glassHidden, left }, u3.reg.every(r => r[3] === 0) && u3.glassHidden === false && left === 0);
    // ---------------- blocky rig (models off) ----------------
    await land('models=0');
    const bl = await wait(() => window.SSX.models?.player?.().body === 'blocky', 30000); ok('blocky_body', await G(() => window.SSX.models.player().state()), bl);
    await dress(); await G(() => window.SSX.models.player().setTint({ torso: 0xd02020, legs: 0x2040d0 }).hideHelmet(true)); await frames(4);
    const b1 = await check(); ok('blocky_allSlotsRender', Object.fromEntries(Object.entries(b1).map(([k, x]) => [k, x.px + '/' + x.on + '/' + x.y])), allOk(b1));
    const bh = await G(() => { const r = window.SSX.models.player().root.userData.ssxRigParts; return { helmet: r.helmet.visible, visor: r.visor.visible, torso: r.torso.material.color.getHexString(), legs: r.legs.L.material.color.getHexString(), arm: r.arms.L.material.color.getHexString() }; });
    ok('blocky_tint_hide', bh, !bh.helmet && !bh.visor && bh.torso !== bh.arm && bh.legs !== bh.arm);
    await G(() => window.SSX.models.player().resetTint().hideHelmet(false)); const br = await G(() => { const r = window.SSX.models.player().root.userData.ssxRigParts; return { helmet: r.helmet.visible, same: r.torso.material === r.arms.L.material }; });
    ok('blocky_reset', br, br.helmet && br.same);
    ok('blocky_event', await G(() => window.__pev.slice()), (await G(() => window.__pev.includes('blocky'))));
  } catch (e) { bad.push('EXC ' + e.message); }
  const errsReal = errs.filter(e => !/favicon|ERR_|net::|Failed to load resource|start the audio device/i.test(e)); // headless WebKit has no audio device
  ok('noErrors', errsReal.slice(0, 6), errsReal.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL webkit: ' + bad.join(' | ') : 'PASS iphone-14-' + BR);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
