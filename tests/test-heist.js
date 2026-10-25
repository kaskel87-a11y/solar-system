// v7.5 heist mechanics e2e: plays the ?heisttest=1 sample villa start to finish.
// open ☰ 🕵️ Heists -> Start -> break in at the door -> crack the safe with single-touch pointer drags (mouse drags on
// desktop) -> trip a camera (wanted rises) -> get clear (heist:escape fires with the contract payload) -> lose the heat.
// BASE=http://127.0.0.1:8851/ BR=webkit DEV="iPhone SE (3rd gen)" OUT=/workspace/pw-ben/shots/ node test-heist.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8851/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const VP = process.env.VP; // e.g. 393x852: override the device viewport (same touch/UA settings)
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  let opts = desk ? { viewport: { width: 1440, height: 900 } } : { ...pw.devices[DEV] };
  if (VP) { const [w, h] = VP.split('x').map(Number); opts = { ...opts, viewport: { width: w, height: h }, screen: { width: w, height: h } }; }
  delete opts.defaultBrowserType;
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const vp = page.viewportSize(), tag = `heist-${vp.width}x${vp.height}-${BR}`;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const press = async sel => { if (desk) await page.click(sel); else await page.tap(sel); };
  // iOS bug guard: tap one of OUR buttons with a second finger while a thumb rests on the joystick (synthetic touch
  // pointers: pointerdown on #joy is held, the button gets its own pointerdown -> pointerup, no click is sent)
  const stickTap = sel => G(async sel => {
    const j = document.getElementById('joy'), b = document.querySelector(sel); if (!b) return 'missing ' + sel;
    const jr = j.getBoundingClientRect(), br = b.getBoundingClientRect(), sl = ms => new Promise(r => setTimeout(r, ms));
    const ev = (el, t, id, r) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 50, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    ev(j, 'pointerdown', 50, jr); await sl(60); ev(b, 'pointerdown', 51, br); await sl(60); ev(b, 'pointerup', 51, br); await sl(60); ev(j, 'pointerup', 50, jr); return 'ok';
  }, sel);
  const ourTap = async sel => { if (desk) await page.click(sel); else R['stickTap ' + sel] = await stickTap(sel); };
  const shot = async name => { for (let i = 0; i < 2; i++) { try { await page.screenshot({ path: `${out}${tag}-${name}.png`, timeout: 90000 }); return true; } catch (e) { R['shotRetry-' + name] = i + 1; } } return false; };
  const move = (x, z, yaw = 0) => G(([x, z, yaw]) => window.__app.surface.debugMove(x, z, yaw), [x, z, yaw]);
  try {
    await page.goto(base + '?heisttest=1&heisttime=' + (process.env.SAFE_T || 120) + '&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); window.__hlog = []; for (const e of ['start', 'stage', 'alarm', 'camera:alert', 'safe:result', 'loot', 'escape', 'done', 'fail', 'alarm:response', 'tip']) window.addEventListener('heist:' + e, ev => window.__hlog.push([e, ev.detail])); });
    ok('api', await G(() => !!window.SSX?.heist && typeof window.SSX.heist.safeCrack === 'function' && typeof window.SSX.heist.addCamera === 'function' && typeof window.SSX.heist.alarm === 'function'));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    // ---- ☰ -> 🕵️ Heists overview -> Start
    await press('#menuBtn'); ok('menuOpen', await wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000));
    ok('menuItem', await G(() => !!document.getElementById('heistMenu')));
    await page.locator('#heistMenu').scrollIntoViewIfNeeded(); await press('#heistMenu');
    ok('overview', await wait(() => document.getElementById('heistPanel')?.classList.contains('on'), 4000)); await sleep(300);
    await shot('overview');
    await ourTap('#heistPanel button[data-id="heist-sample"]');
    await G(() => { window.SSX.on?.('heist:escape', d => { window.__ssxEsc = d; }); });
    ok('started', await wait(() => window.SSX.heist.active?.w, 8000));
    const w = await G(() => window.SSX.heist.active.w);
    ok('activeCallable', await G(() => typeof window.SSX.heist.active === 'function' && window.SSX.heist.active('mansion', 'x') === true && window.__app.surface.game.heistAt('mansion', 'x') === true)); // main's game.heistAt calls active?.(kind, name)
    ok('camerasPlaced', await G(() => window.SSX.heist.cameras().length), (await G(() => window.SSX.heist.cameras().length)) === 3);
    R.tip = await G(() => { const h = window.SSX.heist; const c = h.applyTip('heist-sample', { type: 'cameras' }); const s = h.applyTip('heist-sample', { type: 'safe', ease: 0.3 });
      return { cams: c && c.cameras.length, ease: s && s.ease, unknown: h.applyTip('heist-sample', { type: 'zzz' }), noHeist: h.applyTip('nope', { type: 'cameras' }), ev: window.__hlog.some(e => e[0] === 'tip') }; });
    ok('applyTip', R.tip, R.tip.cams === 3 && R.tip.ease === 0.3 && R.tip.unknown === null && R.tip.noHeist === null && R.tip.ev);
    // v7.5 world budget: debug.people() lists every spawned person (hidden ones too); count the live ones via npcBudget/activeNPCs
    const nb = await G(() => { const W = window.__app.surface.world; const b = W.npcBudget?.(); return b ? { used: b.used, cap: b.cap } : { used: W.debug.activeNPCs?.() ?? W.debug.people().filter(p => p.on).length, cap: 12 }; });
    ok('npcCap', `${nb.used}/${nb.cap}`, desk || (nb.used <= nb.cap && nb.cap <= 12));
    // ---- break in
    await move(w.door.x, w.door.z + 0.8); ok('breakBtn', await wait(() => window.SSX.heist.action === '🔓 Break in', 5000));
    ok('btnVisible', await G(() => getComputedStyle(document.getElementById('heistBtn')).display !== 'none'));
    const clear = await G(() => { const W = innerWidth, H = innerHeight, c = { l: W * 0.3, r: W * 0.7, t: H * 0.3, b: H * 0.7 };
      return ['heistBtn', 'heistChip'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width && !(r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b) ? id : null; }).filter(Boolean); });
    ok('centerClear', clear.join() || 'clear', clear.length === 0);
    if (desk) await page.keyboard.press('KeyG'); else await ourTap('#heistBtn');
    ok('inside', await wait(() => window.SSX.heist.active?.stage === 'crack', 6000));
    // ---- crack the safe
    await move(w.safe.x, w.safe.z + 0.6); ok('crackBtn', await wait(() => window.SSX.heist.action === '🔐 Crack safe', 5000));
    if (desk) await page.keyboard.press('KeyG'); else await ourTap('#heistBtn');
    ok('safeOpen', await wait(() => !!document.getElementById('hsSafe'), 4000)); await sleep(500);
    const dial = await G(() => { const r = document.getElementById('hsDial').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.42, w: r.width, top: r.top, bottom: r.bottom }; });
    ok('dialFits', `${Math.round(dial.w)}px ${Math.round(dial.top)}-${Math.round(dial.bottom)}`, dial.w >= 180 && dial.bottom <= vp.height && dial.top >= 0);
    await shot('safecrack');
    const pt = a => ({ x: dial.x + dial.R * Math.sin(a * Math.PI / 180), y: dial.y - dial.R * Math.cos(a * Math.PI / 180) });
    if (desk) { // real mouse drag
      for (let guard = 0; guard < 8; guard++) {
        const s = await G(() => window.SSX.heist.debug.safe()); if (!s || s.done) break;
        let a = s.angle; const tg = s.targets[s.idx]; let p = pt(a); await page.mouse.move(p.x, p.y); await page.mouse.down();
        let diff = ((tg - a) % 360 + 540) % 360 - 180;
        while (Math.abs(diff) > 1.5) { const st = Math.sign(diff) * Math.min(2.5, Math.abs(diff)); a += st; diff -= st; p = pt(a); await page.mouse.move(p.x, p.y); await G(() => new Promise(r => requestAnimationFrame(r))); }
        await G(() => new Promise(r => { const t0 = performance.now(); const f = () => performance.now() - t0 > 950 ? r() : requestAnimationFrame(f); f(); })); await page.mouse.up(); await sleep(100);
      }
    } else { // single-touch pointer drag (one pointerId, pointerType touch) on the overlay
      await G(async (dial) => {
        const root = document.getElementById('hsSafe'), sl = ms => new Promise(r => setTimeout(r, ms));
        const pt = a => ({ clientX: dial.x + dial.R * Math.sin(a * Math.PI / 180), clientY: dial.y - dial.R * Math.cos(a * Math.PI / 180) });
        const P = (type, a) => root.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, ...pt(a) }));
        for (let guard = 0; guard < 8; guard++) {
          const s = window.SSX.heist.debug.safe(); if (!s || s.done) break;
          let a = s.angle; const tg = s.targets[s.idx]; P('pointerdown', a);
          let diff = ((tg - a) % 360 + 540) % 360 - 180;
          while (Math.abs(diff) > 1.5) { const st = Math.sign(diff) * Math.min(2.5, Math.abs(diff)); a += st; diff -= st; P('pointermove', a); await new Promise(r => requestAnimationFrame(r)); }
          await sl(950); P('pointerup', a); await sl(100);
        }
      }, dial);
    }
    ok('cracked', await wait(() => window.__hlog.some(e => e[0] === 'safe:result' && e[1].success), 30000));
    R.safeResult = await G(() => (window.__hlog.find(e => e[0] === 'safe:result') || [])[1]);
    ok('escapeStage', await wait(() => window.SSX.heist.active?.stage === 'escape', 3000));
    // ---- trip a camera: stand in front of tv-cam0 (looks north-west)
    const w0 = await G(() => window.__app.surface.world.wanted); ok('wanted0', w0, w0 === 0);
    const cam = await G(() => window.SSX.heist.cameras().find(c => c.id === 'tv-cam0'));
    await move(cam.x - 3, cam.z - 3, Math.atan2(-3, -3)); // face the camera so the shot shows the mast and the red wedge
    ok('cameraAlert', await wait(() => window.__hlog.some(e => e[0] === 'camera:alert'), 40000)); await sleep(250);
    await shot('camera-alert');
    const w1 = await G(() => window.__app.surface.world.wanted); ok('wantedRose', w1, w1 >= 2);
    ok('alarmEvent', await G(() => window.__hlog.some(e => e[0] === 'alarm' && e[1].wanted >= 2)));
    // ---- get clear: escape event for pursuit.js
    await move(w.site.x + 45, w.site.z + 20);
    ok('escapeEvent', await wait(() => window.__hlog.some(e => e[0] === 'escape'), 20000));
    const esc = await G(() => (window.__hlog.find(e => e[0] === 'escape') || [])[1] || null); R.escape = esc;
    ok('ssxBus', await G(() => window.__ssxEsc && window.__ssxEsc.id === 'heist-sample' && window.__ssxEsc.name === 'TEST VILLA'));
    ok('escapeContract', JSON.stringify(Object.keys(esc)), esc.id === 'heist-sample' && esc.heat >= 2 && esc.loot?.credits === 250 && esc.alarm === true && typeof esc.pos.x === 'number' && esc.world === 'Mars');
    ok('cleanStage', await wait(() => window.SSX.heist.active?.stage === 'clean', 3000));
    await G(() => window.__app.surface.world.setWanted(0, 'test: lost them'));
    ok('done', await wait(() => window.__hlog.some(e => e[0] === 'done' && e[1].success), 5000));
    ok('cleanedUp', await G(() => !window.SSX.heist.active && window.SSX.heist.cameras().length === 0 && getComputedStyle(document.getElementById('heistBtn')).display === 'none'));
    // ---- promise API on its own: abort via ✕ resolves {success:false, reason:'abort'}
    await G(() => { window.__ab = window.SSX.heist.safeCrack({ tier: 'easy', instant: true }); }); await wait(() => !!document.getElementById('hsSafeAbort'), 5000); await ourTap('#hsSafeAbort');
    const ab = await G(() => window.__ab).catch(e => ({ reason: 'err ' + e.message }));
    ok('promiseAbort', ab.reason, ab.success === false && ab.ok === false && ab.reason === 'abort' && 'time' in ab && 'noise' in ab);
    // ---- main's game.crack(id, difficulty) drives this minigame via SSX.heist.safeCrack and reads r.ok
    await G(() => { window.__gc = window.__app.surface.game.crack('ben-crack-int', 0, { loot: 5 }); }); ok('gameCrackOpens', await wait(() => !!document.getElementById('hsSafeAbort'), 5000));
    R.gameCrackTier = await G(() => window.SSX.heist.debug.safe()?.tier || window.SSX.heist.debug.safe()?.targets?.length);
    await ourTap('#hsSafeAbort'); const gc = await G(() => window.__gc).catch(e => ({ why: 'err ' + e.message }));
    ok('gameCrackResult', JSON.stringify(gc), gc && gc.ok === false && !(await G(() => window.SSX.heist.debug.safeOpen())));
  } catch (e) { errors.push('TEST ' + e.message); }
  R.events = await G(() => (window.__hlog || []).map(e => e[0] + (e[1]?.why ? ':' + e[1].why : '')).join(' > ')).catch(() => '');
  R.heistLog = await G(() => window.SSX?.heist?.log.map(e => e.join(':')).join(' > ')).catch(() => '');
  ok('noErrors', errors.join(' | ') || 'none', errors.length === 0);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
