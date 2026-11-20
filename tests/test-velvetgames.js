// Chicken Shit Bingo and Plasma Paddle in the Velvet Airlock.
// BASE=http://127.0.0.1:8771/ node tests/test-velvetgames.js
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
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 200)); });
  page.on('console', m => { if (m.type() === 'error' && !/audio|WebGL|favicon|net::/i.test(m.text())) errors.push('C ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a);
  const R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = typeof v === 'string' ? v.slice(0, 180) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 90000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading')));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.123');
    ok('api', await wait(() => !!window.SSX?.chickenbingo?.open && !!window.SSX?.plasmapaddle?.open, 20000));
    const rules = await G(() => {
      const s = window.SSX.chickenbingo.squares();
      return { n: s.length, has: s.includes('A1') && s.includes('D4') };
    });
    ok('grid', rules, rules.n === 16 && rules.has);
    await G(() => { window.__app.game.progress.credits = 5000; window.__app.game.save(); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0));
    const door = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.5, Math.PI), [door.x, door.z]);
    await sleep(400);
    await G(() => window.__app.surface.enterBuilding());
    ok('inside', await wait(() => window.__app.surface.info?.inside?.kind === 'club', 8000));
    await G(() => { const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission'); } });
    await G(() => window.__app.surface.debugInside(6, 12.15, 0, -0.35));
    await sleep(400);
    ok('bingoPrompt', await wait(() => /bingo grid/i.test(document.getElementById('driveBtn')?.textContent || ''), 4000));
    await G(() => document.getElementById('driveBtn').click());
    ok('bingoSheet', await wait(() => document.getElementById('csbSheet')?.classList.contains('on'), 3000));
    const sheet = await G(() => {
      const el = document.getElementById('csbSheet');
      const box = el.getBoundingClientRect();
      const btns = [...el.querySelectorAll('button')];
      return { text: el.innerText.slice(0, 160), n: btns.length, h: Math.min(...btns.map(b => b.getBoundingClientRect().height)), fits: box.left >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 };
    });
    ok('bingoFit', sheet, /10 to 1/.test(sheet.text) && sheet.n >= 16 && sheet.h >= 44 && sheet.fits);
    await G(() => { for (const id of ['radio', 'ssxGuide']) { const e = document.getElementById(id); if (e) e.style.setProperty('display', 'none', 'important'); } });
    await page.screenshot({ path: out + 'iphone_chicken_bingo_390.png' });
    const before = await G(() => window.__app.game.progress.credits);
    await G(() => [...document.querySelectorAll('#csbSheet button')].find(b => b.dataset.a === 'bet')?.click());
    await sleep(300);
    ok('betTaken', await G(() => window.__app.game.progress.credits), (await G(() => window.__app.game.progress.credits)) === before - 500);
    ok('banner', await G(() => document.getElementById('csbBanner')?.classList.contains('on')));
    await G(() => window.__app.surface.debugInside(-8, 12.15, 0, -0.2));
    await sleep(300);
    const padBtn = await G(() => document.getElementById('driveBtn')?.textContent || '');
    ok('paddlePrompt', padBtn, /Plasma Paddle/.test(padBtn));
    await G(() => document.getElementById('driveBtn').click());
    ok('paddleOpen', await wait(() => document.getElementById('ppGame')?.classList.contains('on'), 3000));
    const pad = await G(() => {
      const el = document.getElementById('ppGame');
      const b = el.querySelector('button');
      const r = b.getBoundingClientRect();
      return { text: el.innerText.slice(0, 140), h: r.height, fits: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 };
    });
    ok('paddleFit', pad, /Drag the left side/.test(pad.text) && /Nix/.test(pad.text) && pad.h >= 44 && pad.fits);
    await G(() => [...document.querySelectorAll('#ppStakes button')].find(b => b.dataset.n === '0')?.click());
    await sleep(700);
    await page.screenshot({ path: out + 'iphone_plasma_paddle_390.png' });
    ok('saved', await G(() => !!localStorage.getItem('ssx.chickenbingo.v1')));
    ok('clean', errors.slice(0, 3).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
    try { await page.screenshot({ path: out + 'iphone_velvet_games_crash.png' }); } catch (e2) { /* */ }
  }
  console.log(JSON.stringify({ R, bad }, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
