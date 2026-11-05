// v7.5.38 Pit bout keyboard/mouse: F, C and left-click must each throw a punch during a Pit bout (desktop),
// and the 👊/FIRE buttons on a phone. Real input events only (page.keyboard / page.mouse / touch tap) once the bout is armed.
// BASE=http://localhost:8765/ DEV=desktop|phone node tests/test-pit-keys.js
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', DEV = process.env.DEV || 'desktop', phone = DEV === 'phone';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext(phone ? iph : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errs = [], R = { dev: DEV }, bad = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a);
  const wait = async (f, ms = 8000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const ok = (k, v, info) => { R[k] = info ?? v; if (!v) bad.push(k); };
  try {
    await page.goto(base + '?onboard=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    R.ver = await G(() => document.querySelector('meta[name="app-version"]')?.content);
    await G(() => { localStorage.setItem('ssx.onboard.v1', '{"done":true,"skipped":true}'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(1500);
    await G(() => document.getElementById('radioLater')?.click());
    await wait(() => window.__activities?.pack, 60000);
    await G(() => { window.__app.game.debug?.calm?.(true); window.__app.surface.world.setWanted?.(0); });
    // equip a gun if one is owned: F must still punch in the Pit
    await G(() => { try { const ws = window.SSX?.arsenal?.weapons?.() || []; const g = ws.find(w => w.kind === 'gun' && w.owned); if (g) window.SSX.arsenal.equip?.(g.id); } catch (e) {} });
    await G(() => window.__activities.warp('act-pit-fight')); await sleep(2500);
    const c = await G(() => window.SSX.pitRing.centre());
    await G(o => window.__app.surface.debugPlace(o.x, o.z - 3, 0), c); await sleep(1500);
    R.start = await G(() => window.__activities.start('act-pit-fight'));
    ok('fight', await wait(() => window.__app.surface.world.duel?.phase === 'fight', 60000));
    // swing counter (reads the player's melee animation), installed once
    await G(() => { window.__sw = 0; let prev = 0; window.SSX.registerSurfaceTick(() => { const s = window.__app.surface.meleeRig?.()?.swing; const t = s ? s.t : 0; if (t > prev + 1e-4) window.__sw++; prev = t; }); });
    const stick = () => G(() => { const sf = window.__app.surface, d = sf.world.duel, i = sf.info; if (!d || d.phase !== 'fight') return false; const dx = d.x - i.x, dz = d.z - i.z, L = Math.hypot(dx, dz) || 1;
      sf.debugPlace(d.x - dx / L * 1.4, d.z - dz / L * 1.4, Math.atan2(-dx, -dz)); return true; });
    R.hint = await G(() => { const e = document.getElementById('pitKeyHint'); return e && getComputedStyle(e).display !== 'none' ? e.textContent.trim() : null; });
    if (!phone) ok('hint', /F \/ C \/ click = punch/.test(R.hint || ''), R.hint);
    await page.mouse.move(640, 360); // pointer over the canvas, no panel focused
    const tryInput = async (name, act) => {
      let sw = 0, dmg = 0;
      for (let k = 0; k < 6; k++) {
        if (!(await stick())) break; await sleep(250);
        const b = await G(() => ({ s: window.__sw, them: window.__app.surface.world.duel?.them ?? 0 }));
        await act(); await sleep(phone ? 500 : 900);
        const a = await G(() => ({ s: window.__sw, them: window.__app.surface.world.duel?.them ?? 0 }));
        sw += a.s - b.s; dmg += Math.max(0, b.them - a.them);
      }
      ok('punch' + name, sw >= 3, { swings: sw, dmg: +dmg.toFixed(1) });
    };
    if (!phone) {
      await tryInput('F', async () => { await page.keyboard.down('f'); await sleep(200); await page.keyboard.up('f'); });
      await tryInput('C', async () => { await page.keyboard.press('c'); });
      await tryInput('Click', async () => { await page.mouse.down(); await sleep(150); await page.mouse.up(); });
      // focus a HUD button, then F must still punch
      await G(() => { const b = document.querySelector('#surfHud button, button'); b?.focus(); });
      await tryInput('FFocused', async () => { await page.keyboard.down('f'); await sleep(200); await page.keyboard.up('f'); });
    } else {
      const tapId = async id => { const b = await page.$('#' + id); const bb = b && await b.boundingBox(); if (bb && bb.width) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
      R.btns = await G(() => ['meleeBtn', 'fireBtn'].map(id => { const e = document.getElementById(id); return id + ':' + (e ? getComputedStyle(e).display : 'none'); }));
      await tryInput('Fist', () => tapId('meleeBtn'));
      await tryInput('Fire', async () => { const b = await page.$('#fireBtn'); const bb = await b.boundingBox(); const cdp = await ctx.newCDPSession(page); const p = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await sleep(220); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); });
    }
    R.arsenal = await G(() => window.SSX?.arsenal?.debug?.stats?.());
  } catch (e) { R.err = e.message.slice(0, 300); bad.push('err'); }
  R.errors = errs.slice(0, 5); if (errs.length) bad.push('pageerror'); R.bad = bad; R.verdict = bad.length ? 'FAIL' : 'PASS';
  console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
