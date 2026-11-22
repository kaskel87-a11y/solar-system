// v7.5.132 Silt's debt, plus a two-finger pinch on the map.
// BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" node tests/test-silt.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/';
const BR = process.env.BR || 'chromium';
const DEV = process.env.DEV || 'iPhone 14';
const desk = DEV === 'desktop';
const out = (process.env.OUT || '/opt/cursor/artifacts/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = desk ? { viewport: { width: 1280, height: 800 }, hasTouch: false }
    : (({ defaultBrowserType, ...o }) => ({ ...o, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }))(pw.devices[DEV] || pw.devices['iPhone 14']);
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => {
    localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}');
    window.__errs = [];
    addEventListener('error', e => { const m = String(e.message || ''); if (!/audio/i.test(m)) window.__errs.push(('PE ' + m).slice(0, 180)); });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('crash', () => errors.push('CRASH'));
  page.on('pageerror', e => { if (!/audio/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 180)); });
  const G = (f, a) => page.evaluate(f, a);
  const R = { tag: `${DEV}-${BR}` }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = typeof v === 'string' ? v.slice(0, 160) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 20000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const press = async sel => {
    const hit = await G(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 20); const top = document.elementFromPoint(x, y); return { id: top && (top.id || top.className || top.tagName), same: top === e || e.contains(top) }; }, sel);
    if (hit && !hit.same) { R.cover = R.cover || hit; await G(sel => document.querySelector(sel).click(), sel); return; }
    if (desk) await page.click(sel, { timeout: 8000 }); else await page.tap(sel, { timeout: 8000 });
  };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.133');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0, 120000));
    await sleep(600);
    await G(() => { const r = document.getElementById('radio'); if (r && getComputedStyle(r).display !== 'none') document.getElementById('radioLater')?.click(); });
    ok('api', await wait(() => !!window.SSX?.silt?.mark, 8000));
    const marked = await G(() => window.SSX.silt.mark());
    ok('marked', marked, marked.ok);
    ok('went', await G(() => window.SSX.silt.debug.goto('silt')));
    await sleep(500);
    ok('talkBtn', await wait(() => document.getElementById('siltAct')?.classList.contains('show') && /Talk to Silt/.test(document.getElementById('siltAct').textContent), 4000));
    const before = await G(() => ({ cr: window.__app.game.progress.credits, w: window.__app.surface.info.wanted | 0 }));
    await press('#siltAct');
    await sleep(400);
    const afterTalk = await G(() => ({ w: window.__app.surface.info.wanted | 0, q: window.__app.game.debug.quest(), step: window.__app.game.debug.step()?.text || '', guide: document.getElementById('ssxGuide')?.dataset.full || document.getElementById('hxOne')?.textContent || '' }));
    ok('started', afterTalk, afterTalk.q?.id === 'flats-silt' && afterTalk.w === before.w && /Jory/.test(afterTalk.step));
    await G(() => { const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission', 'hxOffer'); } });
    ok('arrow', await wait(() => { const g = document.getElementById('ssxGuide'); const ob = window.SSX.hudx.objective(); return !!(ob && /Jory/.test(ob.label || '') && g && g.classList.contains('on') && /Jory/.test(g.dataset.full || g.textContent || '')); }, 4000));
    ok('toJory', await G(() => window.SSX.silt.debug.goto('jory')));
    await sleep(500);
    ok('leanBtn', await wait(() => /Lean on Jory/.test(document.getElementById('siltAct')?.textContent || ''), 4000));
    const box = await G(() => {
      const e = document.getElementById('siltAct'), r = e.getBoundingClientRect();
      const W = innerWidth, H = innerHeight, C = { l: W * 0.25, r: W * 0.75, t: H * 0.25, b: H * 0.75 };
      const mid = r.left < C.r && C.l < r.right && r.top < C.b && C.t < r.bottom;
      return { h: Math.round(r.height), w: Math.round(r.width), mid, x: Math.round(r.left), y: Math.round(r.top) };
    });
    ok('btnFit', box, box.h >= 44 && !box.mid);
    if (!desk && BR === 'webkit') await page.screenshot({ path: out + 'iphone_silt_jory_portrait.png' });
    await press('#siltAct');
    await sleep(400);
    const leaned = await G(() => ({ w: window.__app.surface.info.wanted | 0, step: window.__app.game.debug.step()?.text || '', q: window.__app.game.debug.quest() }));
    ok('leaned', leaned, leaned.w === 0 && leaned.q?.step === 1 && /Silt/.test(leaned.step));
    ok('back', await G(() => window.SSX.silt.debug.goto('silt')));
    await sleep(400);
    ok('handBtn', await wait(() => /Hand it over/.test(document.getElementById('siltAct')?.textContent || ''), 4000));
    await press('#siltAct');
    await sleep(500);
    const done = await G(() => ({ w: window.__app.surface.info.wanted | 0, cr: window.__app.game.progress.credits, q: window.__app.game.debug.quest() }));
    ok('paid', { cr: done.cr - before.cr, w: done.w, q: done.q?.id || null }, done.w === 0 && done.cr - before.cr >= 280 && (!done.q || done.q.id !== 'flats-silt'));
    if (!desk) {
      ok('map', await G(() => window.SSX.hudx.openMap()) && await wait(() => document.getElementById('hxMap')?.classList.contains('on'), 4000));
      await sleep(300);
      const zoom0 = await G(() => window.__hxMapDebug.zoom());
      await G(() => {
        const cv = document.querySelector('#hxMap canvas');
        const r = cv.getBoundingClientRect();
        const fire = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, isPrimary: id === 1 }));
        fire('pointerdown', 1, r.width * 0.35, r.height * 0.5);
        fire('pointerdown', 2, r.width * 0.65, r.height * 0.5);
        fire('pointermove', 1, r.width * 0.15, r.height * 0.5);
        fire('pointermove', 2, r.width * 0.85, r.height * 0.5);
        fire('pointerup', 1, r.width * 0.15, r.height * 0.5);
        fire('pointerup', 2, r.width * 0.85, r.height * 0.5);
      });
      await sleep(200);
      const zoom1 = await G(() => window.__hxMapDebug.zoom());
      ok('pinch', { zoom0, zoom1 }, zoom1 > zoom0 + 0.05);
    }
    const pageErrs = await G(() => window.__errs || []).catch(() => []);
    const allErr = [...errors, ...pageErrs].filter(e => !/WebGL|favicon|net::/i.test(e));
    ok('console', allErr.slice(0, 4).join(' | ') || 'none', allErr.length === 0);
  } catch (e) {
    R.throw = String(e.stack || e).slice(0, 400);
    bad.push('throw');
  }
  R.bad = bad; R.pass = !bad.length;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
