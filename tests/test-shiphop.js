// v7.5.103 Ashfall hops. BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" OUT=/opt/cursor/artifacts/ node tests/test-shiphop.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const desk = DEV === 'desktop';
const out = (process.env.OUT || '/tmp/shiphop/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = desk ? { viewport: { width: 1280, height: 800 } } : (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone 14']);
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL/i.test(m.text())) errors.push('C ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = f => page.evaluate(f), R = { tag }, bad = [];
  const ok = (k, v) => { R[k] = v; if (!v) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.105');
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.onboard?.skip?.(); window.__app.surface.world.setWanted(0); window.__app.game.debug?.credits?.(20000); window.__app.surface.game.setAliens?.(false); });
    ok('api', await wait(() => !!window.SSX.shiphop?.board, 10000));
    const far = await G(() => window.SSX.shiphop.board());
    ok('notAboard', far === false);
    await G(() => {
      const p = window.__app.surface.shipPose();
      window.__app.surface.debugMove(p.x + 8, p.z + 3, 0);
      const id = 'aj-north';
      if (window.SSX.base?.buy) { window.SSX.base.buy(id); window.SSX.base.place(id, 'pad', 4, 6, 0); }
    });
    await sleep(200);
    const opened = await G(() => window.SSX.shiphop.board() && !!document.getElementById('shipHop')?.classList.contains('on'));
    ok('opened', opened === true);
    const ui = await G(() => {
      const buttons = [...document.querySelectorAll('#shipHop button')].map(b => ({ t: b.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(b.getBoundingClientRect().height) }));
      return { buttons, why: document.getElementById('shipWhy')?.textContent || '' };
    });
    R.ui = ui;
    const text = ui.buttons.map(b => b.t).join(' | ');
    ok('list', /Ares Junction downtown/.test(text) && /Velvet Airlock/.test(text) && /Planum Australe/.test(text) && /The Pit/.test(text) && /Dustbowl Homestead/.test(text) && /Red Line Motors/.test(text) && /Go to space/.test(text));
    ok('pad', /landing pad/.test(text));
    ok('size', ui.buttons.length >= 8 && ui.buttons.every(b => b.h >= 48));
    await G(() => { const st = document.createElement('style'); st.textContent = '#toast,#radio,#obLine,#ssxGuide,.ssxBark{display:none!important}'; document.head.appendChild(st); });
    await sleep(200);
    await page.screenshot({ path: out + `flyto-${tag}.png` });
    const blocked = await G(() => { window.__app.surface.world.setWanted(3); window.SSX.shiphop.close(); const r = window.SSX.shiphop.fly('farm'); window.__app.surface.world.setWanted(0); return r; });
    ok('heat', blocked && blocked.ok === false && /3 stars/.test(blocked.why || ''));
    const flew = await G(() => window.SSX.shiphop.fly('farm'));
    ok('flew', flew && flew.ok === true);
    ok('landedFarm', await wait(() => !window.SSX.shiphop.hopping && window.__app.surface.shipPose()?.alt < 1, 12000));
    await sleep(400);
    const at = await G(() => {
      const farm = window.SSX.shiphop.spots().find(p => p.id === 'farm');
      const i = window.__app.surface.info, s = window.__app.surface.shipPose();
      return { pd: Math.round(Math.hypot(i.x - farm.x, i.z - farm.z)), sd: Math.round(Math.hypot(s.x - farm.x, s.z - farm.z)), alt: +s.alt.toFixed(2), phase: window.SSX.shiphop.phase, hop: window.SSX.shiphop.hopping };
    });
    R.at = at;
    ok('steppedOut', at.pd < 30 && at.sd < 8 && at.alt < 1);
    await G(() => window.SSX.hudx.openMap());
    await sleep(300);
    const card = await G(() => window.__hxMapDebug.openCard());
    await sleep(200);
    const flyBtn = await G(() => { const b = document.getElementById('hxLocFly'); if (!b) return null; const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), h: Math.round(r.height), on: getComputedStyle(b).display !== 'none' }; });
    R.flyBtn = flyBtn; R.card = card;
    ok('mapFly', !!(flyBtn && flyBtn.on && flyBtn.h >= 48 && /Fly ship here/.test(flyBtn.t)));
    ok('console', errors.length === 0);
    if (errors.length) R.errors = errors.slice(0, 8);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 600); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });