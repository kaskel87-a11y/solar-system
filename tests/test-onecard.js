// v7.5.111 one objective line. BASE=http://127.0.0.1:8765/ BR=chromium DEV="iPhone 14" node tests/test-onecard.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'iPhone 14';
const out = (process.env.OUT || '/tmp/onecard/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone 14']);
  const page = await (await browser.newContext(dev)).newPage();
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
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.111');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(600);
    await G(() => {
      window.SSX.onboard?.skip?.();
      window.__app.surface.world.setWanted(2, 'debug');
      window.__app.toast('💵 Picked 31 cr off the Rae Okoro.', 4000);
      window.SSX.guide.aim({ id: 'lounge', label: 'Cole is loud at the bar. Throw him out. Punch him. 31 m', nx: -0.2, ny: 0.4 });
      let c = document.getElementById('stillCap');
      if (!c) { c = document.createElement('div'); c.id = 'stillCap'; document.body.appendChild(c); }
      c.classList.add('on');
      c.innerHTML = '📦 2 crates of moonshine in your rover (12 bottles).<small>Sell at the Xen-7 Trading Post or the Velvet Airlock bar.</small>';
    });
    ok('line', await wait(() => { const e = document.getElementById('hxOne'); return e && e.classList.contains('on') && /Cole is loud/.test(e.textContent) && /31 m/.test(e.textContent); }, 4000));
    const box = await G(() => {
      const one = document.getElementById('hxOne');
      const or = one.getBoundingClientRect();
      const toast = document.getElementById('toast').getBoundingClientRect();
      const stat = document.getElementById('hxStat')?.getBoundingClientRect();
      const H = innerHeight, W = innerWidth;
      const hit = (a, b) => a && b && a.height > 2 && b.height > 2 && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const center = r => r.height > 2 && r.top < H * 0.75 && r.bottom > H * 0.25 && r.left < W * 0.75 && r.right > W * 0.25;
      const cs = getComputedStyle(one);
      const more = (document.getElementById('hxMoreP')?.innerText || '');
      return {
        one: or.height > 2 && or.height < 44 && /Cole/.test(one.textContent),
        light: cs.color === 'rgb(17, 17, 17)' && /255,\s*255,\s*255/.test(cs.backgroundColor),
        big: parseFloat(cs.fontSize) >= 16,
        stillHidden: getComputedStyle(document.getElementById('stillCap')).display === 'none',
        toastOff: !hit(or, toast),
        statOff: !stat || stat.height < 2 || !hit(or, stat),
        oneClear: !center(or),
        more: /moonshine/i.test(more),
        guideShort: (document.querySelector('#ssxGuide span')?.textContent || '').length < 24
      };
    });
    R.box = box;
    ok('oneLine', box.one && box.stillHidden && box.guideShort && box.light && box.big);
    ok('noOverlap', box.toastOff && box.statOff && box.oneClear);
    ok('moreList', box.more);
    await G(() => {
      window.SSX.backroom?.debug?.quiet?.();
      window.SSX.guide.aim({ id: 'lounge', label: 'Cole is loud at the bar. Throw him out. Punch him. 31 m', nx: -0.2, ny: 0.4 });
      document.getElementById('stillCap')?.classList.add('on');
    });
    await sleep(180);
    await page.screenshot({ path: out + `hud-after-${tag}.png` });
    ok('console', errors.length === 0);
    if (errors.length) R.errors = errors.slice(0, 6);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 500); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
