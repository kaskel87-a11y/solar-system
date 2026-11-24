// v7.5.118 Control mission card. On an iPhone the call used to play audio and hide the card.
// The card must show the plain step, stay until Accept, and the objective arrow must sit on screen.
// BASE=http://127.0.0.1:8765/ node tests/test-missioncall.js
const pw = require('playwright');
const fs = require('fs');
const base = process.env.BASE || 'http://127.0.0.1:8765/';
const out = (process.env.OUT || '/opt/cursor/artifacts').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [
  ['390x844', 'portrait', 390, 844],
  ['390x844', 'landscape', 844, 390],
  ['430x932', 'portrait', 430, 932],
  ['430x932', 'landscape', 932, 430]
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const phone = pw.devices['iPhone 14'];
  const page = await (await browser.newContext({
    userAgent: phone.userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    viewport: { width: 390, height: 844 }
  })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  const G = f => page.evaluate(f);
  const wait = async (f, ms = 120000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const bad = [];
  const R = {};
  const ok = (k, v) => { R[k] = v; if (!v) bad.push(k); };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading')));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.139');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0));
    await sleep(400);
    await G(() => { window.SSX.onboard?.skip?.(); window.__app.surface.game.abandon?.(true); document.getElementById('radio').style.display = 'none'; });
    await sleep(200);
    for (const [size, orient, w, h] of SIZES) {
      const tag = `${size}-${orient}`;
      await page.setViewportSize({ width: w, height: h });
      await sleep(250);
      await G(() => {
        window.__app.surface.game.abandon?.(true);
        const id = 'mars-rescue';
        window.SSX.city.radio('Control: got a job if you\'re bored: "Rescue a stranded rover". Pays 100 cr. Want it?', 'Control', id);
      });
      ok(tag + '-shown', await wait(() => {
        const r = document.getElementById('radio');
        return r && r.classList.contains('mission') && !r.classList.contains('mini') && getComputedStyle(r).display !== 'none';
      }, 8000));
      await sleep(350);
      const box = await G(() => {
        const r = document.getElementById('radio'), t = document.getElementById('radioText'), a = document.getElementById('radioAccept');
        const rr = r.getBoundingClientRect(), tr = t.getBoundingClientRect(), ar = a.getBoundingClientRect();
        const cs = getComputedStyle(r);
        return {
          text: t.textContent,
          display: cs.display, vis: cs.visibility, op: cs.opacity,
          mini: r.classList.contains('mini'), mission: r.classList.contains('mission'),
          inView: rr.width > 40 && rr.height > 40 && rr.top >= -1 && rr.left >= -1 && rr.right <= innerWidth + 2 && rr.bottom <= innerHeight + 2,
          textIn: tr.height > 18 && tr.top >= rr.top - 1 && tr.bottom <= rr.bottom + 2 && t.scrollHeight <= t.clientHeight + 2,
          accept: ar.height >= 40 && ar.width >= 40 && ar.bottom <= innerHeight + 2 && ar.top >= 0,
          one: !!document.getElementById('hxOne')?.classList.contains('on')
        };
      });
      R[tag + '-box'] = { inView: box.inView, textIn: box.textIn, accept: box.accept, mini: box.mini, text: (box.text || '').slice(0, 180) };
      ok(tag + '-card', box.mission && !box.mini && !box.one && box.display !== 'none' && box.vis !== 'hidden' && +box.op > 0.5 && box.inView && box.textIn && box.accept && /stranded rover/i.test(box.text) && /Accept or Later/i.test(box.text));
      await sleep(1200);
      ok(tag + '-stays', await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none' && document.getElementById('radio').classList.contains('mission')));
      await page.screenshot({ path: out + `mission-call-${tag}.png` });
      await G(() => document.getElementById('radioAccept').click());
      ok(tag + '-accepted', await wait(() => window.__app.surface.game.info?.quest?.id === 'mars-rescue', 8000));
      await sleep(500);
      await G(() => { const r = document.getElementById('radio'); if (r) { r.style.display = 'none'; r.classList.remove('mission'); } });
      await sleep(400);
      const ob = await G(() => {
        const card = document.getElementById('hxCard'), tx = document.querySelector('#questTrack .hxTx'), how = document.querySelector('#questTrack .hxHow');
        const g = document.getElementById('ssxGuide');
        const cr = card?.getBoundingClientRect(), gr = g?.getBoundingClientRect();
        const cs = tx ? getComputedStyle(tx) : null;
        const hit = cr && gr && cr.width > 2 && gr.width > 2 && cr.left < gr.right - 2 && gr.left < cr.right - 2 && cr.top < gr.bottom - 2 && gr.top < cr.bottom - 2;
        return {
          card: !!card?.classList.contains('on') && cr && cr.width > 40 && cr.height > 28 && cr.top >= -1 && cr.bottom <= innerHeight + 2 && cr.right <= innerWidth + 2,
          step: tx?.textContent || '',
          stepOn: !!tx && getComputedStyle(tx).display !== 'none' && tx.getBoundingClientRect().height > 8 && cs.color !== 'rgba(0, 0, 0, 0)',
          how: how?.textContent || '',
          guide: !!g?.classList.contains('on') && gr && gr.width > 20 && gr.height > 16 && gr.top >= -1 && gr.left >= -1 && gr.right <= innerWidth + 2 && gr.bottom <= innerHeight + 2,
          guideText: (g?.querySelector('span')?.textContent || '').replace(/\s+/g, ' ').trim(),
          clear: !hit
        };
      });
      R[tag + '-ob'] = ob;
      ok(tag + '-tracker', ob.card && ob.stepOn && /rover/i.test(ob.step) && /arrow/i.test(ob.how));
      ok(tag + '-marker', ob.guide && ob.clear && /rover/i.test(ob.guideText) && /\d+\s*m/.test(ob.guideText));
      await G(() => { const t = document.getElementById('toast'); if (t) { t.classList.remove('on'); t.style.display = 'none'; } });
      await sleep(300);
      await page.screenshot({ path: out + `mission-marker-${tag}.png` });
      await G(() => { const t = document.getElementById('toast'); if (t) t.style.display = ''; });
    }
    ok('console', errors.length === 0);
    if (errors.length) R.errors = errors.slice(0, 6);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 600); }
  console.log(JSON.stringify(R, null, 2));
  console.log(bad.length ? 'FAILED ' + bad.join(', ') : 'PASS');
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
