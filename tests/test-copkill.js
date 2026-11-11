// Kill one ColSec officer: stars, wanted meter, toast. Phone and desktop.
// BASE=http://127.0.0.1:8765/ DEV=375x667 node tests/test-copkill.js
const { chromium, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `cop-${DEV}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone SE'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, hasTouch: true, isMobile: true };
  const page = await (await browser.newContext(dev)).newPage();
  const errors = [];
  page.on('pageerror', e => { if (!/audio/i.test(e.message)) errors.push(e.message); });
  const G = (f, a) => page.evaluate(f, a), bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 20000) => { try { await page.waitForFunction(f, null, { timeout: ms }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?onboard=0&storm=0&look=classic&t=' + Date.now());
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && window.__app.state.info?.name === 'Mars' && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(300);
    await G(() => { const r = document.getElementById('radio'); if (r) r.style.display = 'none'; window.__app.surface.world.setWanted(0); try { window.SSX.onboard?.skip?.(); } catch (e) {} });
    const xp0 = await G(() => window.__app.game.progress.xp | 0);
    ok('spawned', await G(() => !!window.__app.surface.world.debug.spawnSecurity('officer')));
    const toast = await G(() => { window.__app.surface.world.debug.killSec('officer'); return document.getElementById('toast')?.innerText || ''; });
    ok('killed', true);
    ok('toast', toast, /\+3/.test(toast) && /Wanted/.test(toast) && /★/.test(toast));
    ok('wanted', await wait(() => window.__app.surface.info.wanted >= 1 && document.getElementById('wantedStars').textContent.includes('★'), 4000));
    const xp1 = await G(() => window.__app.game.progress.xp | 0);
    ok('stars', xp1 - xp0, xp1 - xp0 === 3);
    const meter = await G(() => {
      const e = document.getElementById('wantedStars'), r = e.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const mid = r.width > 0 && r.left < W * 0.75 && W * 0.25 < r.right && r.top < H * 0.55 && H * 0.2 < r.bottom;
      return { text: e.textContent, top: Math.round(r.top), mid };
    });
    ok('meter', meter, meter.text.length >= 1 && !meter.mid && meter.top < 80);
    await page.screenshot({ path: `${out}${tag}.png`, timeout: 30000 });
    ok('noErrors', errors, errors.length === 0);
  } catch (e) { bad.push('EXC ' + String(e.message || e).slice(0, 240)); console.log('EXC', e); }
  console.log(JSON.stringify({ bad }));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
