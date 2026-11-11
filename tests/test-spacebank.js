// Cinder Vault orbital bank (spacebank.js): menu + Nix at the spaceport, scout, crew, drill, safe-crack hook,
// cutter getaway, payout. Touch runs include a second finger while one holds the joystick.
// BASE=http://127.0.0.1:8877/ BR=webkit DEV=393x852 SHOTS_DIR=/tmp/sb-shots node tests/test-spacebank.js
// DEV=desktop uses 1280x800. BR=chromium|webkit.
const { chromium, webkit, firefox, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8877/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `spacebank-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : BR === 'firefox' ? firefox : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 }, hasTouch: false } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2, hasTouch: true };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; }); const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message); });
  page.on('console', msg => { if (msg.type() === 'error' && !/audio device|Failed to load resource|favicon/i.test(msg.text())) errors.push('CE ' + msg.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => {
    const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect();
    e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 }));
    return r.width > 0 && r.height > 0;
  }, [t, sel, id, dx, dy]);
  const tap = async sel => {
    if (touch) { const a = await P('pointerdown', sel, 61); await P('pointerup', sel, 61); return a; }
    const r = await page.$(sel); if (!r) return false; await r.click(); return true;
  };
  const st = () => G(() => window.SSX.spacebank.state);
  const D = (fn, a) => G(([fn, a]) => window.SSX.spacebank.debug[fn](...(a || [])), [fn, a]);
  try {
    await page.goto(base + '?onboard=0&storm=0&look=classic&t=' + Date.now());
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload();
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('api', await wait(() => !!window.SSX?.spacebank && typeof window.SSX.spacebank.start === 'function' && !!document.getElementById('sbMenu'), 20000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000);
    await sleep(600);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.__app.surface.game.progress.credits = 8000; try { window.SSX.onboard?.skip?.(); } catch (e) {} });
    ok('version', await G(() => window.SSX.spacebank.version), (await G(() => window.SSX.spacebank.version)) === 'v7.5.85');
    // menu: the job is one tap from ☰
    await tap('#menuBtn');
    await wait(() => document.getElementById('roverMenu')?.classList.contains('show'), 8000);
    await G(() => document.getElementById('sbMenu')?.scrollIntoView({ block: 'center' }));
    await sleep(200);
    ok('menuTap', await tap('#sbMenu'));
    ok('panel', await wait(() => document.getElementById('sbPanel')?.classList.contains('on'), 5000));
    ok('panelCopy', await G(() => document.querySelector('#sbPanel h2')?.textContent || ''), /Cinder Vault/.test(await G(() => document.querySelector('#sbPanel h2')?.textContent || '')));
    await tap('#sbPanel button[data-a="wp"]');
    ok('waypoint', await G(() => { const w = window.SSX.hudx?.waypoint?.(); const n = window.SSX.spacebank.state.nix; return !!(w && n && Math.hypot(w.x - n.x, w.z - n.z) < 2 && /Nix/.test(w.label || '')); }));
    // stand on Nix. Phones start with a second finger while the stick is down.
    const nix = await G(() => { const i = window.__app.surface.info, n = window.SSX.spacebank.state.nix; return { x: n.x, z: n.z, cx: i.colony.x, cz: i.colony.z }; });
    await G(n => window.__app.surface.debugPlace(n.x, n.z, 0), nix);
    ok('atNix', await wait(() => window.SSX.spacebank.state.atNix, 8000));
    ok('mark', await wait(() => (window.SSX.minimap?.list?.() || []).includes('spacebank'), 8000));
    if (touch) {
      ok('dockShown', await wait(() => { const b = document.getElementById('dockSb'); if (!b) return false; const c = getComputedStyle(b); return c.display !== 'none' && b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44; }, 8000));
      await P('pointerdown', '#joy', 41); await P('pointermove', '#joy', 41, 0, -6);
      ok('dockWhileStick', await P('pointerdown', '#dockSb', 42));
      await P('pointerup', '#dockSb', 42); await P('pointerup', '#joy', 41, 0, -6);
    } else {
      await tap('#menuBtn'); await G(() => document.getElementById('sbMenu')?.scrollIntoView({ block: 'center' })); await tap('#sbMenu');
      await wait(() => document.getElementById('sbPanel')?.classList.contains('on'), 5000);
      ok('takeJob', await tap('#sbPanel button[data-a="go"]'));
    }
    ok('started', await wait(() => window.SSX.spacebank.state.run?.phase === 'scout', 8000));
    await G(() => window.SSX.spacebank.open());
    ok('marsCard', await G(() => /Take off and fly close to the 3 glowing buoys near Cinder Vault \(0\/3\)/.test(document.querySelector('#sbPanel p')?.textContent || '')));
    await G(() => window.SSX.spacebank.close());
    ok('marsPointer', await wait(() => {
      const e = document.getElementById('ssxGuide'); if (!e?.classList.contains('on')) return false;
      const r = e.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const mid = r.left < W * 0.75 && W * 0.25 < r.right && r.top < H * 0.75 && H * 0.25 < r.bottom;
      return !mid && /Take off/.test(e.textContent || '') && r.height >= 40;
    }, 4000));
    ok('tookOff', await (async () => { await G(() => window.__app.takeOff()); return wait(() => { const s = window.__app.state; return s.flying && !s.onSurface && !s.transitioning; }, 30000); })());
    await sleep(500);
    const glow = await G(() => {
      const m = window.__app.rocket?.parent?.getObjectByName('sbBuoy:cams');
      const beam = m?.getObjectByName('sbBeam'), halo = m?.getObjectByName('sbHalo');
      return { e: m?.material?.emissiveIntensity || 0, beam: !!beam?.visible, halo: !!halo?.visible, hex: m?.material?.emissive?.getHex?.() || 0 };
    });
    ok('buoyGlows', glow, glow.beam && glow.halo && glow.e > 1 && glow.hex === 0xff8a00);
    ok('spacePointer', await wait(() => {
      const e = document.getElementById('ssxGuide'), r = e?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      if (!r) return false;
      const mid = r.left < W * 0.75 && W * 0.25 < r.right && r.top < H * 0.75 && H * 0.25 < r.bottom;
      const g = window.SSX.spacebank.state.guide;
      return !!e?.classList.contains('on') && g?.kind === 'buoy' && !mid && /\d/.test(e.textContent || '') && g.dist > 0;
    }, 8000));
    await D('place', [[0, 12, 90], [14, 6, 108]]);
    await sleep(700);
    ok('pointerOnScreen', await wait(() => {
      const e = document.getElementById('ssxGuide'); if (!e) return false;
      const r = e.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const mid = r.left < W * 0.75 && W * 0.25 < r.right && r.top < H * 0.75 && H * 0.25 < r.bottom;
      const onScreen = r.left >= 0 && r.right <= W && r.top >= 0 && r.bottom <= H - 100;
      const beam = window.__app.rocket?.parent?.getObjectByName('sbBuoy:cams')?.getObjectByName('sbBeam');
      return onScreen && !mid && !!beam?.visible && /\d/.test(e.textContent || '') && window.SSX.spacebank.state.guide?.kind === 'buoy';
    }, 8000));
    await shot('buoy-pointer');
    await G(() => { window.__app.joy.x = 1; window.__app.joy.y = 0; }); await sleep(250);
    await G(() => { window.__app.joy.x = 0; window.__app.joy.y = 0; window.__app.touchBtns.boost = false; });
    await D('placeAtBuoy', ['cams']);
    ok('buoy', await wait(() => (window.SSX.spacebank.state.run?.intel || []).includes('cams'), 8000));
    ok('loggedDims', await G(() => {
      const root = window.__app.rocket?.parent;
      const cams = root?.getObjectByName('sbBuoy:cams'), shift = root?.getObjectByName('sbBuoy:shift');
      return !!cams && !cams.getObjectByName('sbBeam')?.visible && !!shift?.getObjectByName('sbBeam')?.visible && shift.material.emissive.getHex() === 0xff8a00;
    }));
    await D('scoutAll');
    ok('crewPhase', await wait(() => window.SSX.spacebank.state.run?.phase === 'crew', 4000));
    const free = await G(() => { const c = window.SSX.crew, orig = c.state.bind(c); c.state = () => ({ crew: [{ id: 'vee' }] }); const p = window.SSX.spacebank.price('drill'); c.state = orig; return p; });
    ok('crewCoversDrill', free, free && free.free === true && free.cost === 0);
    await G(() => window.SSX.spacebank.open());
    await wait(() => document.getElementById('sbPanel')?.classList.contains('on'), 4000);
    const cr0 = await G(() => window.__app.surface.game.progress.credits);
    ok('hireHack', await tap('#sbPanel button[data-id="hack"]'));
    await sleep(200);
    const cr1 = await G(() => window.__app.surface.game.progress.credits);
    ok('paidHack', cr0 - cr1, cr0 - cr1 === 500);
    ok('lockCrew', await tap('#sbPanel button[data-a="lock"]'));
    ok('vaultPhase', await wait(() => window.SSX.spacebank.state.run?.phase === 'vault' && window.SSX.spacebank.state.run.crew.includes('hack'), 4000));
    ok('dockPointer', await wait(() => window.SSX.spacebank.state.guide?.kind === 'dock' && /\d/.test(document.getElementById('ssxGuide')?.textContent || ''), 4000));
    await D('placeAtDock');
    ok('docked', await wait(() => window.SSX.spacebank.state.run?.phase === 'drill', 8000));
    await sleep(300);
    const center = await G(() => { const e = document.getElementById('sbChip'), r = e.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const hit = r.left < W * 0.75 && W * 0.25 < r.right && r.top < H * 0.75 && H * 0.25 < r.bottom;
      return { hit, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }; });
    ok('chipClearOfCenter', center, center && !center.hit && center.h >= 44);
    const drillBtn = await G(() => { const b = document.getElementById('sbAct'), r = b.getBoundingClientRect(); return { on: b.classList.contains('on'), text: b.textContent, h: r.height, w: r.width }; });
    ok('drillButton', drillBtn, drillBtn.on && drillBtn.text === 'DRILL' && drillBtn.h >= 44 && drillBtn.w >= 44);
    if (touch) {
      await P('pointerdown', '#joy', 41);
      await P('pointerdown', '#sbAct', 43);
      await sleep(450);
      await P('pointerup', '#sbAct', 43);
      await P('pointerup', '#joy', 41);
    } else {
      await page.hover('#sbAct');
      const box = await page.locator('#sbAct').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await sleep(450); await page.mouse.up();
    }
    const drilled = await st();
    ok('drillMoved', drilled.drill, drilled.drill && drilled.drill.fill > 0.15 && drilled.drill.heat > 0.1);
    await G(() => { window.__sbCrack = null; const H = window.SSX.heist; window.__sbCrackOrig = H.safeCrack; H.safeCrack = o => { window.__sbCrack = o; return Promise.resolve({ success: true, ok: true, reason: 'cracked', time: 1, noise: 0, tier: o.tier, tumblers: 2 }); }; });
    await D('pulse');
    ok('cracked', await wait(() => window.SSX.spacebank.state.run?.phase === 'getaway' && window.SSX.spacebank.state.run.loot === true, 8000));
    ok('marsPointerHome', await wait(() => window.SSX.spacebank.state.guide?.kind === 'mars' && /\d/.test(document.getElementById('ssxGuide')?.textContent || ''), 4000));
    const crack = await G(() => window.__sbCrack);
    ok('usedSafeCrack', crack, crack && crack.tier === 'easy' && crack.time > 42 && crack.title === 'Cinder Vault');
    ok('cutters', await wait(() => window.SSX.spacebank.state.cutters >= 1, 4000), (await st()).cutters === (touch ? 1 : 2));
    await D('pause', [true]); await sleep(250); await shot('vault-getaway'); await D('pause', [false]);
    await D('pullCut', [6]);
    ok('lock', await wait(() => window.SSX.spacebank.state.locked, 10000));
    const d0 = (await st()).run.dodges;
    if (touch) { await P('pointerdown', '#joy', 41); ok('rollWhileStick', await P('pointerdown', '#sbAct', 44)); await P('pointerup', '#sbAct', 44); await P('pointerup', '#joy', 41); }
    else ok('rollClick', await tap('#sbAct'));
    ok('rolled', await wait(d => window.SSX.spacebank.state.run && window.SSX.spacebank.state.run.dodges > d, 8000, d0));
    const xp0 = await G(() => window.__app.surface.game.progress.xp | 0);
    const cBefore = await G(() => window.__app.surface.game.progress.credits);
    await D('placeNearMars', [8]);
    ok('paid', await wait(() => !window.SSX.spacebank.state.run && window.SSX.spacebank.state.last?.got?.cash > 0, 8000));
    const got = (await st()).last.got;
    const cred = await G(() => window.__app.surface.game.progress.credits);
    const xp = await G(() => window.__app.surface.game.progress.xp | 0);
    ok('payout', { cash: got.cash, stars: got.stars, delta: cred - cBefore, xp: xp - xp0 }, got.cash >= 3400 && cred - cBefore >= got.cash && xp - xp0 >= got.stars && got.how !== 'land');
    ok('chipHidden', await G(() => !document.getElementById('sbChip').classList.contains('on')));
    // alarm caught up on the dirt: a second, already-hot run
    await G(() => window.SSX.spacebank.start());
    await D('skip', ['getaway']);
    await D('trip');
    ok('queued', (await st()).pending, (await st()).pending >= 2);
    await D('placeNearMars', [6]);
    await sleep(400);
    await D('unpin');
    await wait(() => window.__app.state.near === 'Mars', 8000);
    await G(() => window.__app.land());
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning, 40000));
    ok('starsFromAlarm', await wait(() => window.__app.surface.world.wanted >= 2 && window.SSX.spacebank.state.pending === 0, 8000));
    await G(() => { if (window.__sbCrackOrig) window.SSX.heist.safeCrack = window.__sbCrackOrig; window.__app.surface.world.setWanted(0); });
  } catch (e) { bad.push('EXC ' + e.message); console.log(e.stack || e.message); }
  ok('noErrors', errors.slice(0, 8), errors.length === 0);
  console.log(JSON.stringify({ tag, bad, shots: R.shots, errors: errors.slice(0, 8) }));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
