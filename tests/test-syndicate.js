// The player-facing name is Solar Syndicate. The address and save keys stay.
// BASE=http://127.0.0.1:8771/ BR=chromium DEV=390x844 OUT=/opt/cursor/artifacts/ node tests/test-syndicate.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771/';
const BR = process.env.BR || 'chromium';
const DEV = process.env.DEV || '390x844';
const out = (process.env.OUT || '/tmp/syndicate/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const m = /^(\d+)x(\d+)$/.exec(DEV);
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const dev = m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone 14']);
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 180)); });
  page.on('console', msg => { if (msg.type() === 'error' && !/audio device|Failed to load|WebGL|favicon|net::/i.test(msg.text())) errors.push('C ' + msg.text().slice(0, 180)); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a);
  const R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = typeof v === 'string' ? v.slice(0, 140) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 40000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.135');
    ok('title', await G(() => document.title) === 'Solar Syndicate');
    const box = await G(() => {
      const h = document.querySelector('#info h1');
      const r = h.getBoundingClientRect();
      return { t: h.textContent, w: Math.round(r.width), right: Math.round(r.right), fits: r.right <= innerWidth - 8 && h.scrollWidth <= h.clientWidth + 2 };
    });
    ok('splash', box.t, /Solar Syndicate/.test(box.t) && /v7\.5\.121/.test(box.t) && box.fits);
    const man = await G(async () => {
      const m = document.querySelector('link[rel=manifest]');
      const man = await (await fetch(m.href)).json();
      return { name: man.name, short: man.short_name, id: man.id, scope: man.scope, start: man.start_url, apple: document.querySelector('meta[name=apple-mobile-web-app-title]').content };
    });
    ok('manifest', man, man.name === 'Solar Syndicate' && man.short === 'Solar Syndicate' && man.apple === 'Solar Syndicate' && man.id === '/solar-system/' && man.scope === '/solar-system/' && man.start.startsWith('/solar-system/'));
    await G(() => { for (const id of ['radio', 'toast', 'ssxGuide', 'hxOne']) { const e = document.getElementById(id); if (e) e.style.setProperty('display', 'none', 'important'); } });
    await sleep(400);
    await page.screenshot({ path: out + `iphone_syndicate_title_${tag}.png` });
    await G(() => document.getElementById('spaceMenuBtn').click());
    ok('menu', await wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000));
    const menu = await G(() => {
      const b = document.querySelector('#roverMenu .brand');
      const r = b.getBoundingClientRect();
      const menu = document.getElementById('roverMenu').getBoundingClientRect();
      return { t: b.textContent, fits: r.right <= innerWidth + 1 && r.left >= -1 && menu.bottom <= innerHeight + 1 && b.scrollWidth <= b.clientWidth + 2 };
    });
    ok('menuName', menu.t, menu.t === 'Solar Syndicate' && menu.fits);
    ok('clean', errors.slice(0, 3).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
  }
  console.log(JSON.stringify({ R, bad }, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
