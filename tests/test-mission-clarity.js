// v7.5.118 mission clarity. Every active step names what to do and where, the edge
// arrow keeps that name plus the distance, and the world marker is on the objective.
// iPhone portrait + landscape, WebKit and Chromium, touch (multi-touch on Chromium), and desktop.
// BASE=http://127.0.0.1:8765/ node tests/test-mission-clarity.js
const pw = require('playwright');
const fs = require('fs');
const path = require('path');
const base = process.env.BASE || 'http://127.0.0.1:8765/';
const out = (process.env.OUT || '/tmp/mission-clarity').replace(/\/?$/, '/');
const store = process.env.STORE || '/cursor/stores/self';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const phone = pw.devices['iPhone 14'];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(store, { recursive: true });
  const bad = [];
  const R = {};
  const ok = (k, v) => { R[k] = v; if (!v) bad.push(k); };
  const shots = [];

  async function boot(browserName, opts) {
    const browser = await pw[browserName].launch(browserName === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 180)); });
    page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL|favicon/i.test(m.text())) errors.push('C ' + m.text().slice(0, 180)); });
    const G = f => page.evaluate(f);
    const wait = async (f, ms = 120000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    const booted = await wait(() => window.__frames > 3 && !document.getElementById('loading'));
    return { browser, page, errors, G, wait, booted };
  }

  async function land(S) {
    await S.G(() => {
      localStorage.setItem('ssx.adult', '1');
      localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}');
      window.SSX?.onboard?.skip?.();
    });
    if (!(await S.G(() => window.__app.state.onSurface && window.__app.surface.info?.name === 'Mars' && window.__app.surface.info?.intro === 0))) {
      await S.G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      if (!(await S.wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && window.__app.surface.info?.name === 'Mars', 180000))) return false;
    }
    await sleep(400);
    await S.G(() => {
      window.SSX?.onboard?.skip?.();
      window.__app.surface.game.abandon?.(true);
      const r = document.getElementById('radio');
      if (r) { r.style.display = 'none'; r.classList.remove('mission', 'hxOffer'); }
    });
    return true;
  }

  async function objective(S, tag, shot) {
    await S.G(() => window.__app.surface.game.accept('mars-rescue'));
    const up = await S.wait(() => window.__app.surface.game.info?.quest?.id === 'mars-rescue', 8000);
    await sleep(500);
    await S.G(() => { const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission'); } const t = document.getElementById('toast'); if (t) t.classList.remove('on'); });
    await sleep(400);
    const ob = await S.G(() => {
      const q = window.__app.surface.game.info?.quest;
      const tx = document.querySelector('#questTrack .hxTx')?.textContent || '';
      const g = document.getElementById('ssxGuide');
      const gr = g?.getBoundingClientRect();
      const card = document.getElementById('hxCard')?.getBoundingClientRect();
      const wp = window.__app.surface.mapData()?.wp;
      const beam = window.SSX?.wpbeam?.state?.();
      const W = innerWidth, H = innerHeight;
      const mid = gr && gr.width > 2 && (gr.left + gr.width / 2) > W * 0.25 && (gr.left + gr.width / 2) < W * 0.75 && (gr.top + gr.height / 2) > H * 0.25 && (gr.top + gr.height / 2) < H * 0.75;
      const hit = card && gr && card.width > 2 && gr.width > 2 && card.left < gr.right - 2 && gr.left < card.right - 2 && card.top < gr.bottom - 2 && gr.top < card.bottom - 2;
      return {
        id: q?.id || '', text: q?.text || '', step: tx, type: q?.type || '',
        guide: g?.querySelector('span')?.textContent || '',
        guideOn: !!(g && g.classList.contains('on') && gr && gr.width > 20 && gr.height > 16 && gr.top >= -2 && gr.left >= -2 && gr.right <= W + 2 && gr.bottom <= H + 2),
        mid: !!mid, hit: !!hit,
        wp: !!(wp && Number.isFinite(wp.x) && Number.isFinite(wp.z)),
        beam: !!(beam && beam.visible && Number.isFinite(beam.x))
      };
    });
    R[tag] = { step: ob.step, guide: ob.guide, wp: ob.wp, beam: ob.beam, guideOn: ob.guideOn };
    ok(tag + '-step', up && /rover/i.test(ob.step) && /rover|dune|badland|◆/i.test(ob.step));
    ok(tag + '-guide', ob.guideOn && !ob.mid && !ob.hit && /rover/i.test(ob.guide) && /\d+\s*m/.test(ob.guide) && !/^◆\s*\d/.test(ob.guide));
    ok(tag + '-marker', ob.wp && ob.beam);
    if (shot) {
      const file = out + 'iphone-mission-step.png';
      await S.page.screenshot({ path: file });
      shots.push(file);
    }
    await S.G(() => window.__app.surface.game.abandon?.(true));
    await S.G(() => window.__app.surface.game.accept('mars-signal'));
    await S.wait(() => window.__app.surface.game.info?.quest?.id === 'mars-signal', 8000);
    await S.G(() => { const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission'); } });
    await sleep(450);
    const sig = await S.G(() => {
      const tx = document.querySelector('#questTrack .hxTx')?.textContent || '';
      const g = document.getElementById('ssxGuide')?.querySelector('span')?.textContent || '';
      const wp = window.__app.surface.mapData()?.wp;
      return { tx, g, wp: !!(wp && Number.isFinite(wp.x)) };
    });
    R[tag + '-signal'] = sig;
    ok(tag + '-where', /badlands/i.test(sig.tx) && /badlands|signal/i.test(sig.g) && /\d/.test(sig.g) && !/^◆\s*\d/.test(sig.g) && sig.wp);
    await S.G(() => window.__app.surface.game.abandon?.(true));
  }

  try {
    const chromium = await boot('chromium', {
      ...phone, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
    });
    ok('boot-chromium', chromium.booted);
    ok('version', await chromium.G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.122');
    ok('land-chromium', await land(chromium));
    await objective(chromium, 'iphone-portrait-chromium', true);
    await chromium.page.setViewportSize({ width: 844, height: 390 });
    await sleep(300);
    await objective(chromium, 'iphone-landscape-chromium', false);

    const pts = await chromium.G(() => {
      const box = id => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && r.width > 4 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; };
      return { joy: box('joy') || { x: 80, y: innerHeight - 120 }, fire: box('fireBtn') || { x: innerWidth - 70, y: innerHeight - 160 } };
    });
    const cdp = await chromium.page.context().newCDPSession(chromium.page);
    const T = (type, list) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: list });
    await T('touchStart', [{ x: pts.joy.x, y: pts.joy.y, id: 1 }]);
    await sleep(80);
    await T('touchStart', [{ x: pts.joy.x, y: pts.joy.y, id: 1 }, { x: pts.fire.x, y: pts.fire.y, id: 2 }]);
    await sleep(100);
    await T('touchEnd', []);
    ok('multi-touch', !chromium.errors.length);
    const long = await chromium.G(() => window.SSX.guide.chipLabel('Clock in with Nyx at The Static’s door, Olympus Row. 400 m'));
    R.chip = long;
    ok('chip-keeps-name', /Static/.test(long) && /400 m/.test(long) && !/^◆\s*\d/.test(long));
    ok('console-chromium', chromium.errors.length === 0);
    if (chromium.errors.length) R.errChromium = chromium.errors.slice(0, 6);
    await chromium.browser.close();

    const webkit = await boot('webkit', {
      ...phone, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
    });
    ok('boot-webkit', webkit.booted);
    ok('land-webkit', await land(webkit));
    await objective(webkit, 'iphone-portrait-webkit', false);
    await webkit.page.setViewportSize({ width: 844, height: 390 });
    await sleep(300);
    await objective(webkit, 'iphone-landscape-webkit', false);
    const joy = await webkit.G(() => { const r = document.getElementById('joy')?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
    if (joy) await webkit.page.touchscreen.tap(joy.x, joy.y);
    ok('webkit-touch', !webkit.errors.some(e => /touch|pointer/i.test(e)));
    ok('console-webkit', webkit.errors.length === 0);
    if (webkit.errors.length) R.errWebkit = webkit.errors.slice(0, 6);
    await webkit.browser.close();

    const desk = await boot('chromium', { viewport: { width: 1280, height: 800 }, hasTouch: false });
    ok('boot-desktop', desk.booted);
    ok('land-desktop', await land(desk));
    await objective(desk, 'desktop-chromium', false);
    ok('console-desktop', desk.errors.length === 0);
    if (desk.errors.length) R.errDesk = desk.errors.slice(0, 6);
    await desk.browser.close();
  } catch (e) {
    bad.push('throw');
    R.throw = String(e.stack || e).slice(0, 800);
  }
  if (shots[0]) {
    const dest = path.join(store, 'iphone-mission-step-v75118.png');
    fs.copyFileSync(shots[0], dest);
    R.shot = dest;
  }
  console.log(JSON.stringify(R, null, 2));
  console.log(bad.length ? 'FAILED ' + bad.join(', ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
