// Duck Blind on Earth: menu waypoint, walk-up button, start card, tap a duck.
// BASE=http://127.0.0.1:8765/ BR=chromium DEV=375x667 node tests/test-duckblind.js
const { chromium, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `duck-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone SE'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 }, hasTouch: false } : { ...iph, viewport: { width: +m[1], height: +m[2] }, hasTouch: true, isMobile: true };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push(e.message); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 20000, a) => { try { await page.waitForFunction(f, a, { timeout: ms }); return true; } catch (e) { return false; } };
  const tap = async (sel) => {
    const h = await page.$(sel); if (!h) return false;
    if (touch) await h.tap(); else await h.click();
    return true;
  };
  try {
    await page.goto(base + '?onboard=0&storm=0&look=classic&t=' + Date.now());
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('api', await wait(() => !!window.SSX?.duckblind && !!document.getElementById('dbMenu'), 20000));
    ok('version', await G(() => window.SSX.duckblind.version), (await G(() => window.SSX.duckblind.version)) === 'v7.5.86');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Earth').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && window.__app.state.info?.name === 'Earth' && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(400);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await tap('#menuBtn');
    await wait(() => document.getElementById('roverMenu')?.classList.contains('show'), 8000);
    await G(() => document.getElementById('dbMenu')?.scrollIntoView({ block: 'center' }));
    ok('menu', await tap('#dbMenu'));
    ok('waypoint', await G(() => {
      const w = window.SSX.hudx?.waypoint?.(), s = window.SSX.duckblind.state.spot;
      return !!(w && s && Math.hypot(w.x - s.x, w.z - s.z) < 3 && /Duck Blind/.test(w.label || ''));
    }));
    const spot = await G(() => window.SSX.duckblind.debug.at());
    await G(s => window.__app.surface.debugMove(s.x, s.z, 0), spot);
    ok('near', await wait(() => { const b = document.getElementById('dbAct'); if (!b) return false; const r = b.getBoundingClientRect(); return b.classList.contains('on') && r.height >= 44 && r.width >= 44; }, 8000));
    ok('open', await tap('#dbAct'));
    ok('card', await G(() => /Tap the ducks before they fly away/.test(document.querySelector('#dbCard p')?.textContent || '') && document.getElementById('dbCard').classList.contains('on')));
    const cr0 = await G(() => window.__app.game.progress.credits | 0);
    await tap('#dbCard button[data-a="start"]');
    ok('playing', await wait(() => window.SSX.duckblind.state.playing && document.getElementById('dbPlay').classList.contains('on'), 4000));
    await sleep(200);
    await G(() => window.SSX.duckblind.debug.freeze(true));
    const duck = await G(() => { const e = document.getElementById('dbDuck'); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    ok('duckBig', duck, duck.w >= 72 && duck.h >= 72 && duck.y > 40);
    const hud = await G(() => {
      const e = document.getElementById('dbHud').getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const mid = e.left < W * 0.75 && W * 0.28 < e.right && e.top < H * 0.7 && H * 0.28 < e.bottom;
      return { mid, top: Math.round(e.top) };
    });
    ok('hudEdge', hud, hud && !hud.mid && hud.top < 80);
    if (touch) await page.touchscreen.tap(duck.x, duck.y); else await page.mouse.click(duck.x, duck.y);
    ok('hit', await wait(() => window.SSX.duckblind.state.hits >= 1, 3000));
    await page.screenshot({ path: `${out}${tag}-mid.png`, timeout: 30000 });
    await G(() => window.SSX.duckblind.debug.finish(10));
    ok('perfect', await wait(() => !window.SSX.duckblind.state.playing && /Perfect/.test(document.querySelector('#dbCard p')?.textContent || ''), 4000));
    const cr1 = await G(() => window.__app.game.progress.credits | 0);
    ok('paid', cr1 - cr0, cr1 - cr0 === 200);
    ok('best', await G(() => window.SSX.duckblind.state.best >= 1000));
    ok('noErrors', errors, errors.length === 0);
  } catch (e) { bad.push('EXC ' + String(e.message || e).slice(0, 240)); console.log('EXC', e); }
  R.bad = bad;
  console.log(JSON.stringify(R));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
