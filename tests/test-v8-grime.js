// v8 look x Mars grime post (mars/grime.js wraps renderer.render too). Phones default to grime 'lite' (a multiply overlay quad scene
// drawn right after the surface frame); v8 used to treat that quad scene as "back in space" and reset the pixel ratio there, which
// resizes (= clears) the canvas between the frame and the overlay -> a black screen. 'full' + a v8 post tier (high) drew v8's
// composer to the screen while grime sampled its own empty target -> black too. Every combo here must show the scene.
// BASE=http://127.0.0.1:8883/ NODE_PATH=/workspace/pw-steve/node_modules node tests/test-v8-grime.js   (WebKit iPhone 14, one browser)
const { webkit, chromium, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8883/', BR = process.env.BR || 'webkit';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch();
  const { defaultBrowserType, ...dev } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...dev, viewport: { width: 393, height: 852 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ssx.v8.nogov', '1'); localStorage.setItem('ssx.view.v1', '3.6'); localStorage.removeItem('ssx.grime.v1'); } catch (e) {} });
  const page = await ctx.newPage(), probe = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/audio device/i.test(m.text())) errs.push(m.text().slice(0, 200)); if (m.type() === 'warning' && /v8 look/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  // mean brightness of the middle of the screen (HUD-free band), decoded in a second page
  const lum = async () => { const b64 = (await page.screenshot({ type: 'png', clip: { x: 0, y: 250, width: 393, height: 330 } })).toString('base64');
    return probe.evaluate(async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i] + d[i + 1] + d[i + 2]; return t / (d.length / 4) / 3; }, b64); };
  // best of 3 shots: a single frame right after a tier switch can be blank in headless WebKit (pre-existing, not this bug); the bug is every frame
  const shot = async () => { let best = 0; for (let i = 0; i < 3; i++) { best = Math.max(best, await lum()); if (best > 40) break; await sleep(700); } return +best.toFixed(1); };
  await page.goto(base + '?look=med&t=' + Date.now(), { timeout: 120000 });
  await page.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
  await page.evaluate(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await page.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && window.SSX?.grime && window.SSX?.look, null, { timeout: 90000 });
  await page.evaluate(() => { window.__app.surface.game?.setAliens?.(false); if (window.SSX.time?.set) { window.SSX.time.set('noon'); window.SSX.time.freeze(true); } });
  await sleep(1500);
  const R = {}, bad = [];
  for (const [look, post] of [['classic', 'lite'], ['med', 'lite'], ['med', 'full'], ['med', 'off'], ['high', 'full'], ['high', 'lite'], ['low', 'lite'], ['med', 'lite']]) {
    await page.evaluate(([l, p]) => { window.SSX.look.set(l); window.SSX.grime.setPost(p); }, [look, post]); await sleep(2000);
    const k = look + '+' + post, v = await shot(); R[k] = v; if (v < 40) bad.push(k);
  }
  R.ref = R['classic+lite']; R.errs = errs;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  if (bad.length || errs.length) { console.log('FAIL', bad, errs.length); process.exit(1); }
  console.log('PASS v8 x grime: no black frame (' + BR + ')');
})().catch(e => { console.error(e); process.exit(1); });
