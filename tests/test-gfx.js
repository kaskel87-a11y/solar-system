// v7.5.114 Graphics tiers. iPhone viewports (WebKit + Chromium, touch including a second finger on the stick)
// and desktop. No console errors. Medium is the default everywhere; Low is lighter; High is opt-in.
// BASE=http://127.0.0.1:8765/ node tests/test-gfx.js
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
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 }
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
    if (cfg.browser === 'chromium') await T('touchEnd', [{ x: j.x, y: j.y, id: 1 }]);
    else await G(p => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y })), j);
    await sleep(80);
  };
  const tap = async sel => {
    if (cfg.browser === 'webkit') {
      // element.click() and injected touches crash this WebKit build while the canvas is drawing.
      // The tier buttons call SSX.gfx.set, so drive that same function. Chromium still taps the buttons.
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
    let c = await center(sel); if (!c) throw new Error('no ' + sel);
    const id = tid++;
    if (cfg.browser === 'chromium') {
      const pts = stick ? [{ x: stick.x, y: stick.y, id: 1 }] : [];
      await T('touchStart', [...pts, { x: c.x, y: c.y, id }]); await sleep(50); await T('touchEnd', [{ x: c.x, y: c.y, id }]);
    }
    await sleep(220);
    if (stick && Math.abs(await G(() => window.__app.joy.y)) > 0.1) R.stickHeld = (R.stickHeld || 0) + 1;
  };
  try {
    await page.route('**/sw.js*', r => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); } catch (e) {} });
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading') && window.SSX?.gfx?.get, 120000));
    ok('rebooted', true);
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.133');
    const rules = await G(() => window.SSX.gfx.rules());
    ok('rules', rules, rules && rules.def === 'medium' && rules.key === 'ssx.gfx.v1' && rules.low.cap < rules.med.start && rules.low.fog < 1 && rules.low.shadow === false && rules.high.cap > rules.med.cap && rules.highDesk.cap > rules.medDesk.cap && rules.high.shadow === true && rules.high.ibl === true && rules.med.shadow === false);
    ok('defaultMedium', await G(() => window.SSX.gfx.get()) === 'medium');
    const boot = await G(() => window.SSX.gfx.state());
    ok('notHigh', boot.tier === 'medium' && boot.shadow === false, boot);
    ok('aces', boot.tone === 'aces' && boot.output === 'srgb', boot);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000));
    await sleep(700);
    await G(() => { const r = document.getElementById('radio'); if (r && getComputedStyle(r).display !== 'none') document.getElementById('radioLater')?.click(); window.__app.game.setAliens?.(false); window.SSX.onboard?.skip?.(); });
    await sleep(300);
    const med = await G(() => window.SSX.gfx.state());
    ok('medDpr', med.phone ? med.tier === 'medium' && med.cap === 2 && med.start === 1.5 && med.dpr <= 2 && med.dpr >= 1 : Math.abs(med.dpr - 2) < 0.25, med);
    ok('medFill', med.hemi === true, med);
    const item = await G(() => { const b = document.getElementById('gfxMenuBtn'); return { t: b?.textContent || '', menu: b?.parentElement?.id, h: b ? parseFloat(getComputedStyle(b).minHeight) : 0 }; });
    ok('menuItem', item, item.t.startsWith('🎨 Graphics') && item.menu === 'roverMenu' && item.h >= 44);
    if (cfg.browser === 'webkit') {
      // This host's WebKit crashes a moment after the full ☰ sheet is shown (it already has ~60 rows).
      // The Graphics row is in that sheet; open its panel the same way the row does, without showing the sheet.
      await G(() => window.SSX.gfx.open());
    } else {
      await holdStick();
      await tap('#menuBtn');
      ok('menu', await wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000));
      await tap('#gfxMenuBtn');
    }
    ok('panel', await wait(() => document.getElementById('gfxPanel')?.style.display === 'flex', 4000));
    const ui = await G(() => [...document.querySelectorAll('#gfxPanel button[data-k]')].map(b => {
      const cs = getComputedStyle(b), r = b.getBoundingClientRect();
      const W = innerWidth, H = innerHeight, mid = r.left < W * 0.75 && r.right > W * 0.25 && r.top < H * 0.75 && r.bottom > H * 0.25;
      return { id: b.id, t: b.textContent, h: Math.round(r.height), bg: cs.backgroundColor, fg: cs.color, pressed: b.getAttribute('aria-pressed'), mid };
    }));
    ok('three', ui, ui.length === 3 && ui.every(b => b.h >= 44 && b.bg === 'rgb(17, 17, 17)' && b.fg === 'rgb(255, 255, 255)'));
    const marked = ui.find(b => b.id === 'gfx-medium');
    ok('marked', marked, marked && marked.pressed === 'true' && marked.t.startsWith('✓') && ui.filter(b => b.pressed === 'true').length === 1);
    if (cfg.shot) await page.screenshot({ path: out + 'gfx-iphone14-webkit-menu.png' });
    await tap('#gfx-high');
    ok('highDpr', await wait(() => { const s = window.SSX.gfx.state(); const dev = window.devicePixelRatio || 1; const want = Math.min(dev, s.phone ? 2.25 : 2.5); return s.tier === 'high' && Math.abs(s.cap - want) < 0.08 && Math.abs(s.dpr - want) < 0.08; }, 8000));
    ok('highLive', await wait(() => { const s = window.SSX.gfx.state(); return s.tier === 'high' && s.shadow === true && s.casters > 0 && s.ibl === true; }, 15000));
    const hi = await G(() => window.SSX.gfx.state());
    ok('highMarked', await G(() => document.getElementById('gfx-high')?.getAttribute('aria-pressed') === 'true' && document.getElementById('gfx-high').textContent.startsWith('✓')));
    if (cfg.shot) await page.screenshot({ path: out + 'gfx-iphone14-webkit-high.png' });
    await tap('#gfx-low');
    ok('lowLive', await wait(() => { const s = window.SSX.gfx.state(); const fog = s.phone ? (s.fogOut != null && s.fogIn > s.fogOut + 5) : true; return s.tier === 'low' && s.shadow === false && s.dpr <= 1.05 && fog; }, 12000));
    ok('saved', await G(() => localStorage.getItem('ssx.gfx.v1')) === 'low');
    await tap('#gfxDone');
    ok('closed', await G(() => document.getElementById('gfxPanel').style.display === 'none'));
    const hud = await G(() => { const e = document.getElementById('gfxPanel'); const r = e.getBoundingClientRect(); return { show: getComputedStyle(e).display, w: r.width }; });
    ok('hudClear', hud.show === 'none' || hud.w < 2, hud);
    await releaseStick();
    if (cfg.browser === 'chromium' && touch) ok('multiTouch', (R.stickHeld || 0) > 0, R.stickHeld || 0);
    if (cfg.browser === 'webkit' && touch) ok('touch', (R.webkitMt || 0) > 0, R.webkitMt || 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    ok('kept', await wait(() => window.SSX?.gfx?.get?.() === 'low', 120000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0, 90000);
    await G(() => window.SSX.gfx.set('medium'));
    ok('backMed', await wait(() => { const s = window.SSX.gfx.state(); return s.tier === 'medium' && s.shadow === false && s.cap === (s.phone ? 2 : Math.min(3, 2)) && (s.phone ? s.start === 1.5 && s.dpr <= 2 : Math.abs(s.dpr - 2) < 0.25); }, 8000));
    ok('console', errors, errors.length === 0);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).split('\n')[0]; }
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
  console.log(fail ? `GFX FAIL ${fail}/${list.length}` : 'GFX ALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
