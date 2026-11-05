// v8 models x Mars skins (mars/skins.js, Pumpkin's #76/#91): three bought skins on the v8 body (?models=1), each one attached on the v8
// bones (SSX.skins.state().v8), player API still on the v8 body, no errors; one 393x852 shot per skin + a side-by-side trio. Works with
// whichever skins.js is on the branch: main's (bones directly) or #91's (SSX.models.player(): P.attach / sizes / setTint). One browser.
// BASE=http://127.0.0.1:8883/ SHOTS_DIR=$PWD/.shots/v8s NODE_PATH=/workspace/pw-steve/node_modules node tests/test-v8-skins.js
const { webkit, chromium, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8883/', BR = process.env.BR || 'webkit';
const SKINS = (process.env.SKINS || 'cowboy,kingpin,chrome').split(',');
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'v8s')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch();
  const { defaultBrowserType, ...dev } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...dev, viewport: { width: 393, height: 852 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ssx.v8.nogov', '1'); localStorage.setItem('ssx.v8.nodrs', '1'); localStorage.setItem('ssx.view.v1', '2.4'); localStorage.removeItem('ssx.models'); localStorage.removeItem('ssx.skins.v1'); } catch (e) {} });
  const page = await ctx.newPage(), probe = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('PE ' + e.message)); page.on('console', m => { const t = m.text(); if ((m.type() === 'error' && !/audio device/i.test(t)) || (m.type() === 'warning' && /v8 (look|models)|skins/i.test(t))) errs.push(t.slice(0, 220)); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, cond) => { R[k] = v; if (!cond) bad.push(k); };
  const frames = n => G(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  await page.goto(base + '?look=med&models=1&t=' + Date.now(), { timeout: 120000 });
  await page.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await page.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && window.SSX?.skins && window.SSX?.models?.player?.()?.body === 'v8', null, { timeout: 120000, polling: 200 });
  await G(() => { const g = window.__app.surface.game; g?.setAliens?.(false); g?.debug?.clear?.(); if (window.SSX.time?.set) { window.SSX.time.set('noon'); window.SSX.time.freeze(true); } document.querySelectorAll('#onbCard,.onbCard').forEach(e => e.remove()); });
  await sleep(800);
  const shots = [];
  for (const id of SKINS) {
    const r = await G(id => { const sk = window.__skins?.api || window.SSX.skins; sk.__anywhere = true; window.__app.surface.game.progress.credits = 99999; return window.SSX.skins.buy(id); }, id);
    await frames(20);
    await frames(30);
    // orbit the camera round to a front 3/4 view (a drag: surface.look; the camera eases back behind you 1.5 s after the last drag)
    await G(() => window.__app.surface.look(-2.5, 0, 1)); await frames(4); await G(() => window.__app.surface.look(-0.01, 0, 1)); await frames(4);
    const s = await G(() => { const st = window.SSX.skins.state(), P = window.SSX.models.player(); let onBones = 0, parts = 0; P.root.traverse(o => { if (o.userData?.ssxSkin) { let b = o.parent; while (b && !b.isBone && b !== P.root) b = b.parent; if (b?.isBone) onBones++; } if (o.isMesh && o.userData?.ssxModel && o.visible) parts++; });
      return { eq: st.eq, applied: st.applied, v8: st.v8, body: P.body, onBones, visParts: parts }; });
    ok('skin_' + id, { buy: r, ...s }, r?.ok !== false && s.eq === id && s.applied === id && s.body === 'v8' && (s.v8 || s.onBones > 0));
    const p = out + 'v8-skin-' + id + '-iphone-14-' + BR + '.jpg';
    await page.screenshot({ path: p, type: 'jpeg', quality: 84 }); shots.push(p);
  }
  // side by side: the middle (body) of each shot, labelled
  const trio = await probe.evaluate(async ({ imgs, names }) => {
    const ims = await Promise.all(imgs.map(async s => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + s; await im.decode(); return im; }));
    const w = ims[0].width, h = ims[0].height, cw = Math.round(w * 0.52), cx = Math.round((w - cw) / 2), ch = Math.round(h * 0.62), cy = Math.round(h * 0.2);
    const c = document.createElement('canvas'); c.width = cw * ims.length; c.height = ch; const g = c.getContext('2d');
    ims.forEach((im, i) => { g.drawImage(im, cx, cy, cw, ch, i * cw, 0, cw, ch); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(i * cw, ch - 44, cw, 44); g.fillStyle = '#fff'; g.font = '600 26px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(names[i], i * cw + cw / 2, ch - 14); });
    return c.toDataURL('image/jpeg', 0.86).split(',')[1];
  }, { imgs: shots.map(p => fs.readFileSync(p).toString('base64')), names: await G(ids => ids.map(id => window.SSX.skins.list().find(k => k.id === id)?.name || id), SKINS) });
  const tp = out + 'v8-skins-trio-iphone-14-' + BR + '.jpg'; fs.writeFileSync(tp, Buffer.from(trio, 'base64')); R.shots = [...shots, tp];
  await G(() => window.SSX.skins.equip('stock', true)); await frames(10);
  const st = await G(() => ({ eq: window.SSX.skins.state().eq, body: window.SSX.models.player().body }));
  ok('stockBack', st, st.eq === 'stock' && st.body === 'v8');
  ok('noErrors', errs, !errs.length);
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  if (bad.length) { console.log('FAIL', bad.join(', ')); process.exit(1); }
  console.log('PASS v8 skins (' + BR + ')');
})().catch(e => { console.error(e); process.exit(1); });
