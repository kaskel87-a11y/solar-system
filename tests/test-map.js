// v7.5.101 interactive map.
// BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" OUT=/tmp/map/ node tests/test-map.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const desk = DEV === 'desktop';
const out = (process.env.OUT || '/tmp/map/').replace(/\/?$/, '/');
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
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.111');
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.());
    ok('opened', await G(() => window.SSX.hudx.openMap()) && await wait(() => document.getElementById('hxMap')?.classList.contains('on'), 5000));
    await sleep(400);
    const chips = await G(() => [...document.querySelectorAll('#hxMap .chips button')].map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), h: Math.round(r.height), on: b.getAttribute('aria-pressed') }; }));
    ok('filters', chips.map(c => c.t).join(',') === 'All,Activities,Crime,Owned,Shops' && chips.every(c => c.h >= 48) && chips[0].on === 'true', chips);
    const me = await G(() => { const b = document.getElementById('hxMapMe'); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) }; });
    ok('meBtn', me.h >= 48 && me.w >= 48, me);
    const before = await G(() => window.__hxMapDebug.center());
    const afterDrag = await G(() => window.__hxMapDebug.pan(90, 40));
    const after = await G(() => window.__hxMapDebug.center());
    ok('panned', !!after && (before == null || Math.hypot(after.x - (before?.x ?? after.x), after.z - (before?.z ?? after.z)) > 1));
    R.pan = { before, after };
    if (BR === 'webkit') await G(() => window.__hxMapDebug.recenter());
    else await G(() => document.getElementById('hxMapMe').click());
    await sleep(100);
    ok('recentered', await G(() => window.__hxMapDebug.center()) === null);
    const opened = BR === 'webkit'
      ? await G(() => window.__hxMapDebug.openCard())
      : await G(() => {
        const b = [...document.querySelectorAll('#hxMap .lst .it')].find(x => /Shop|Pit|Velvet|Taxi|Turf|race/i.test(x.textContent) && !/Fast travel/.test(x.textContent));
        if (!b) return '';
        b.click();
        return b.textContent.slice(0, 80);
      });
    await sleep(200);
    const card = await G(() => {
      const p = document.getElementById('hxLoc'); const r = p?.querySelector('#hxLocWp')?.getBoundingClientRect();
      return { on: p?.classList.contains('on'), name: p?.querySelector('.nm')?.textContent || '', how: p?.querySelector('.do')?.textContent || '', pay: p?.querySelector('.pay')?.textContent || '', h: Math.round(r?.height || 0) };
    });
    ok('card', card.on && card.name && card.how && card.pay && card.h >= 48, card);
    await G(() => { const st = document.createElement('style'); st.textContent = '#toast,#radio,#obLine,#ssxGuide,.ssxBark{display:none!important}'; document.head.appendChild(st); });
    await sleep(150);
    await page.screenshot({ path: out + `map-${tag}.png` });
    if (BR === 'webkit') await G(() => window.__hxMapDebug.waypoint());
    else await G(() => document.getElementById('hxLocWp').click());
    ok('waypoint', await G(() => !!window.SSX.hudx.state?.().wp || !!window.SSX.hudx.waypoint?.()));
    ok('console', errors.length === 0);
    if (errors.length) R.errors = errors.slice(0, 6);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 500); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
