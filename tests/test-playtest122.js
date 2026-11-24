// v7.5.122 playtest: the arrow yields to a live job, the mission card stays off the buttons, death and arrest use new words.
// BASE=http://127.0.0.1:8771/ node tests/test-playtest122.js
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
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 180)); });
  const G = (f, a) => page.evaluate(f, a);
  const R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = typeof v === 'string' ? v.slice(0, 160) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 90000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const hit = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading')));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.140');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0));
    await sleep(400);
    await G(() => {
      const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission'); }
      window.SSX.guide.aim({ id: 'backroom', label: 'Pack a street good. 40 m', nx: 0.8, ny: 0.2 });
      window.SSX.guide.aim({ id: 'lounge', label: 'Punch Cole. Throw him out.', nx: -0.3, ny: 0.4 });
    });
    await sleep(300);
    const arrow = await G(() => document.getElementById('ssxGuide')?.innerText || '');
    ok('arrow', arrow, /Punch Cole/.test(arrow) && !/street good/.test(arrow));
    await page.screenshot({ path: out + 'iphone_arrow_job_390.png' });

    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(200);
    await G(() => {
      document.body.classList.add('touch', 'surface', 'combat', 'canfire');
      const d = document.getElementById('driveBtn'); d.style.display = 'block'; d.textContent = 'Drive';
      const p = document.getElementById('petBtn'); p.style.display = 'block'; p.textContent = 'Pet';
      const j = document.getElementById('jobAct'); if (j) { j.classList.add('show'); j.textContent = '🚕 Taxi duty'; j.style.display = 'block'; }
      window.SSX.city.radio('Control: got a job if you\'re bored: "Rescue a stranded rover". Pays 100 cr. Want it?', 'Control', 'mars-rescue');
    });
    await sleep(400);
    const lay = await G(() => {
      const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return null; return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      return { radio: box(document.getElementById('radio')), fire: box(document.getElementById('fireBtn')), drive: box(document.getElementById('driveBtn')), pet: box(document.getElementById('petBtn')), taxi: box(document.getElementById('jobAct')), later: box(document.getElementById('radioLater')) };
    });
    const overs = [];
    for (const k of ['fire', 'drive', 'pet', 'taxi']) if (lay.radio && lay[k] && hit(lay.radio, lay[k])) overs.push(k);
    const W = 844, H = 390, C = { l: W * 0.25, r: W * 0.75, t: H * 0.25, b: H * 0.75 };
    const inMid = lay.radio && lay.radio.l < C.r && C.l < lay.radio.r && lay.radio.t < C.b && C.t < lay.radio.b;
    ok('landscape', { overs, inMid, later: !!lay.later }, overs.length === 0 && !inMid && lay.later && lay.later.b <= H + 1);
    await page.screenshot({ path: out + 'iphone_mission_card_landscape.png' });

    await page.setViewportSize({ width: 375, height: 667 });
    await sleep(200);
    const se = await G(() => {
      const box = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, d: getComputedStyle(e).display }; };
      return { later: box(document.getElementById('radioLater')), taxi: box(document.getElementById('jobAct')) };
    });
    ok('seLater', se, se.taxi.d !== 'none' && !(se.later.l < se.taxi.r - 1 && se.taxi.l < se.later.r - 1 && se.later.t < se.taxi.b - 1 && se.taxi.t < se.later.b - 1));

    await page.setViewportSize({ width: 390, height: 844 });
    await G(() => { document.getElementById('radio').style.display = 'none'; window.SSX.emit('game:down', { why: 'killed' }); });
    await sleep(400);
    const dead = await G(() => document.querySelector('#cqScreen b')?.textContent || '');
    ok('flatlined', dead, dead === 'FLATLINED');
    const covered = await G(() => { const d = document.getElementById('downMsg'); const cs = getComputedStyle(d); return cs.visibility === 'hidden' || cs.display === 'none'; });
    ok('downHidden', covered);
    await page.screenshot({ path: out + 'iphone_flatlined_390.png' });
    await G(() => { document.getElementById('cqScreen').classList.remove('on'); window.SSX.emit('game:down', { why: 'busted' }); });
    await sleep(300);
    const pinched = await G(() => document.querySelector('#cqScreen b')?.textContent || '');
    ok('pinched', pinched, pinched === 'PINCHED');
    await page.screenshot({ path: out + 'iphone_pinched_390.png' });
    ok('clean', errors.slice(0, 3).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
  }
  console.log(JSON.stringify({ R, bad }, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
