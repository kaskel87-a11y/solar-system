// v7.5.140 dust on the ground (medium and high) and a film grade on high only.
// iPhone viewports (WebKit + Chromium, touch including a second finger on the stick) and desktop.
// No console errors. Medium stays the default and does not add a fullscreen pass.
// BASE=http://127.0.0.1:8765/ node tests/test-gfxlook.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const ONLY = process.env.ONLY || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const noise = /favicon|404|net::|WebGL|GPU|THREE\.WebGLRenderer|audio device|Failed to load resource|wasm|decode/i;

const MATRIX = [
  { tag: 'iphone14-webkit', browser: 'webkit', dev: 'iPhone 14', shot: true },
  { tag: 'iphone14-chromium', browser: 'chromium', dev: 'iPhone 14' },
  { tag: 'iphonese-webkit', browser: 'webkit', dev: 'iPhone SE' },
  { tag: 'desktop-chromium', browser: 'chromium', dev: 'desktop' }
];

async function runOne(cfg) {
  const browser = await (cfg.browser === 'webkit' ? webkit : chromium).launch({
    args: cfg.browser === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : []
  });
  const touch = cfg.dev !== 'desktop';
  const dev = cfg.dev === 'desktop'
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
    : (({ defaultBrowserType, ...d }) => d)(devices[cfg.dev]);
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errors.push(m.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a);
  const R = { tag: cfg.tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView?.({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height }; }, sel);
  let cdp = null, stick = null, tid = 2;
  const T = async (type, pts) => (cdp = cdp || await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const holdStick = async () => {
    if (stick || !touch || cfg.browser !== 'chromium') return;
    const j = await center('#joy'); if (!j) return;
    const free = await G(p => !!document.elementFromPoint(p.x, p.y)?.closest('#joy'), j); if (!free) return;
    await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(40); await T('touchMove', [{ x: j.x, y: j.y - 28, id: 1 }]);
    stick = { x: j.x, y: j.y - 28 };
  };
  const releaseStick = async () => {
    if (!stick) return; const j = stick; stick = null;
    await T('touchEnd', [{ x: j.x, y: j.y, id: 1 }]);
    await sleep(80);
  };
  const tap = async sel => {
    if (cfg.browser === 'webkit') {
      const hit = await G(sel => {
        if (sel === '#gfx-low' || sel === '#gfx-medium' || sel === '#gfx-high') { window.SSX.gfx.set(sel.slice(5)); return sel; }
        if (sel === '#gfxDone') { window.SSX.gfx.close(); return sel; }
        const el = document.querySelector(sel); if (!el) return null; el.click(); return el.id || sel;
      }, sel);
      if (!hit) throw new Error('no ' + sel);
      R.webkitMt = (R.webkitMt || 0) + 1;
      await sleep(220);
      return;
    }
    if (!touch) { const c = await center(sel); if (!c) throw new Error('no ' + sel); await page.mouse.click(c.x, c.y); await sleep(220); return; }
    await holdStick();
    const c = await center(sel); if (!c) throw new Error('no ' + sel);
    const id = tid++;
    const pts = stick ? [{ x: stick.x, y: stick.y, id: 1 }] : [];
    await T('touchStart', [...pts, { x: c.x, y: c.y, id }]); await sleep(50); await T('touchEnd', [{ x: c.x, y: c.y, id }]);
    await sleep(220);
    if (stick && Math.abs(await G(() => window.__app.joy.y)) > 0.1) R.stickHeld = (R.stickHeld || 0) + 1;
  };
  try {
    await page.route('**/sw.js*', r => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); localStorage.removeItem('ssx.gfx.v1'); } catch (e) {} });
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading') && window.SSX?.gfx?.get, 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.140');
    const rules = await G(() => window.SSX.gfx.rules());
    ok('rules', rules, rules && rules.def === 'medium' && rules.look.low.detail === false && rules.look.low.post === false && rules.look.med.detail === true && rules.look.med.post === false && rules.look.high.post === true && rules.look.high.sun > rules.look.med.sun && rules.look.med.sun > 1);
    ok('defaultMedium', await G(() => window.SSX.gfx.get()) === 'medium');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000));
    await sleep(500);
    await G(() => { const r = document.getElementById('radio'); if (r && getComputedStyle(r).display !== 'none') document.getElementById('radioLater')?.click(); window.__app.game.setAliens?.(false); window.SSX.onboard?.skip?.(); });
    ok('dust', await wait(() => { const s = window.SSX.gfx.state(); return s.tier === 'medium' && s.detail >= 1 && s.post === false && Math.abs(s.sun - s.look.sun) < 0.001; }, 12000));
    const med = await G(() => {
      const s = window.SSX.gfx.state();
      const dl = window.__app.surface.scene.children.find(o => o.isDirectionalLight);
      const ratio = dl && dl.userData.gfxRaw ? dl.intensity / dl.userData.gfxRaw : 0;
      let dust = 0;
      window.__app.surface.scene.traverse(o => { const mats = [].concat(o.material || []); if (mats.some(m => m && m.userData && m.userData.gfxDust)) dust++; });
      return { sun: s.sun, ratio, dust, post: s.post };
    });
    ok('sunWarm', med, Math.abs(med.ratio - 1.1) < 0.04 && med.dust > 0 && med.post === false);
    if (cfg.browser === 'webkit') await G(() => window.SSX.gfx.open());
    else { await holdStick(); await tap('#menuBtn'); ok('menu', await wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000)); await tap('#gfxMenuBtn'); }
    ok('panel', await wait(() => document.getElementById('gfxPanel')?.style.display === 'flex', 4000));
    await tap('#gfx-high');
    ok('high', await wait(() => { const s = window.SSX.gfx.state(); return s.tier === 'high' && s.post === true && s.detail >= 1 && Math.abs(s.sun - 1.16) < 0.001; }, 12000));
    const grade = await G(() => {
      const e = document.getElementById('gfxPost');
      const cs = e ? getComputedStyle(e) : null;
      const r = e.getBoundingClientRect();
      const mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return {
        show: cs?.display, pe: cs?.pointerEvents, z: cs?.zIndex,
        inHud: !!e?.closest('#surfHud'),
        covers: r.width > innerWidth * 0.9 && r.height > innerHeight * 0.9,
        mid: mid?.id || mid?.tagName || '',
        grain: !!document.getElementById('gfxGrain'),
        vignette: !!document.getElementById('gfxVignette')
      };
    });
    ok('film', grade, grade.show === 'block' && grade.pe === 'none' && grade.inHud === false && grade.covers && grade.grain && grade.vignette && grade.mid !== 'gfxPost' && +grade.z < 7);
    if (cfg.shot) {
      await G(() => {
        window.SSX.time?.set?.(12);
        window.SSX.gfx.close();
        document.getElementById('radioLater')?.click();
        document.querySelector('#radio .ssx-x')?.click();
      });
      await sleep(700);
      await page.screenshot({ path: out + 'gfxlook-iphone14-portrait.png' });
      await G(() => window.SSX.gfx.open());
    }
    await tap('#gfx-low');
    ok('lowFlat', await wait(() => { const s = window.SSX.gfx.state(); return s.tier === 'low' && s.detail === 0 && s.post === false && s.sun === 1; }, 8000));
    await tap('#gfxDone');
    ok('closed', await G(() => document.getElementById('gfxPanel').style.display === 'none'));
    if (cfg.browser === 'chromium' && touch) ok('multiTouch', (R.stickHeld || 0) > 0, R.stickHeld || 0);
    if (cfg.browser === 'webkit' && touch) ok('touch', (R.webkitMt || 0) > 0, R.webkitMt || 0);
    ok('console', errors, errors.length === 0);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).split('\n').slice(0, 4).join(' | '); }
  try { await releaseStick(); } catch { /* */ }
  R.verdict = bad.length ? 'FAIL ' + bad.join(', ') : 'PASS';
  console.log(JSON.stringify(R));
  await browser.close();
  return bad.length === 0;
}

(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const list = MATRIX.filter(c => !ONLY || c.tag.includes(ONLY));
  let fail = 0;
  for (const c of list) {
    let ok = false;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      if (attempt > 1) console.log('retry ' + c.tag);
      ok = await runOne(c);
    }
    if (!ok) fail++;
  }
  console.log(fail ? `GFXLOOK FAIL ${fail}/${list.length}` : 'GFXLOOK ALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
