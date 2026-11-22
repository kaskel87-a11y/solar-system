// HUD pile at the Velvet bingo table. Pills do not cover the mission card. The X closes it.
// BASE=http://127.0.0.1:8771/ node tests/test-hudpile.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771/';
const out = (process.env.OUT || '/opt/cursor/artifacts/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const phone = pw.devices['iPhone 14'];
  const ctx = await browser.newContext({ ...phone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 180)); });
  page.on('console', m => { if (m.type() === 'error' && !/audio|WebGL|favicon|net::/i.test(m.text())) errors.push('C ' + m.text().slice(0, 180)); });
  const G = (f, a) => page.evaluate(f, a);
  const R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = typeof v === 'string' ? v.slice(0, 180) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 20000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const box = id => G(id => { const e = document.getElementById(id); if (!e) return null; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, id);
  const hit = (a, b) => a && b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.133');
    await G(() => { window.__app.game.progress.credits = 200000; window.__app.game.save(); window.SSX.velvetclub?.debug?.reset?.(); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    ok('landed', await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0, 120000));
    const door = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => { if (window.__app.surface.info?.driving) window.__app.surface.interact(); window.__app.surface.debugPlace(x, z + 0.5, Math.PI); }, [door.x, door.z]);
    await sleep(400);
    await G(() => window.__app.surface.enterBuilding());
    ok('inside', await wait(() => window.__app.surface.info?.inside?.kind === 'club', 8000));
    await G(() => { window.SSX.velvetclub.buy('bingo'); window.__app.surface.debugInside(6, 12.15, 0, -0.35); });
    await sleep(400);
    ok('at table', await wait(() => window.__app.surface.info?.spot?.id === 'chickenbingo', 4000));
    R.hold = await G(() => {
      const spot = window.__app.surface.info?.spot?.id || '';
      const r = document.getElementById('radio');
      r.style.display = 'none'; r.classList.remove('mission', 'hxOffer');
      window.SSX.city.radio('Control: Dust Fare across town.', 'Control', 'mars-signal');
      return { spot, display: r.style.display, mission: r.classList.contains('mission') };
    });
    ok('held', R.hold, R.hold.display === 'none' && R.hold.spot === 'chickenbingo');
    await G(() => { window.SSX.chickenbingo.debug.plop('6'); window.SSX.velvetclub.play(500); });
    await sleep(200);
    const banner = await box('csbBanner'), level = await box('vxClub'), radio = await box('radio');
    ok('pills', { banner: !!banner, level: !!level, radio: !!radio }, !!banner && !radio && !(banner && level && hit(banner, level)));
    await page.screenshot({ path: out + 'iphone_bingo_after_390.png' });
    await sleep(3200);
    await G(() => window.__app.surface.debugInside(-2, 4, 0));
    await sleep(600);
    ok('offer', await wait(() => document.getElementById('radio')?.classList.contains('mission') && getComputedStyle(document.getElementById('radio')).display !== 'none', 4000));
    const x = await G(() => { const b = document.querySelector('#radio .ssx-x'); if (!b) return null; const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { h: r.height, w: r.width, hit: top === b || b.contains(top) }; });
    ok('x size', x, x.h >= 44 && x.w >= 44 && x.hit);
    const card = await box('radio'), pill = await box('csbBanner');
    ok('no cover', { card: !!card, pill: !!pill }, !!card && !hit(card, pill));
    await G(() => document.querySelector('#radio .ssx-x').click());
    await sleep(200);
    ok('closed', await G(() => getComputedStyle(document.getElementById('radio')).display === 'none'));
    ok('clean', errors.slice(0, 3).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
  }
  R.bad = bad; R.pass = !bad.length;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
