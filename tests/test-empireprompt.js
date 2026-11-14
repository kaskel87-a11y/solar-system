// v7.5.108 empire prompts. BASE=http://127.0.0.1:8765/ node tests/test-empireprompt.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'iPhone 14';
const out = (process.env.OUT || '/tmp/empireprompt/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone 14']);
  const page = await (await browser.newContext(dev)).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL/i.test(m.text())) errors.push('C ' + m.text()); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v) => { R[k] = v; if (!v) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.110');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(500);
    ok('api', await wait(() => window.SSX.empirePrompt && window.SSX.empire?.ready, 30000));
    await G(() => {
      window.SSX.onboard?.skip?.();
      window.SSX.empire.debug.force({ noThreats: true });
      window.SSX.empire.debug.grant('fr-wash');
      window.SSX.empire.debug.setPending('fr-wash', 400);
      window.__app.surface.world.setWanted(0);
      const t = document.getElementById('toast'); if (t) t.classList.remove('on');
      const ob = document.getElementById('obLine'); if (ob) ob.style.display = 'none';
    });
    await sleep(400);
    const ping = await G(() => {
      const p = window.SSX.empirePrompt.debug.force('till');
      const t = document.getElementById('toast');
      const card = document.getElementById('empPing');
      const r = card?.getBoundingClientRect();
      return { text: (card?.innerText || t?.innerText || ''), on: !!card?.classList.contains('on'), emp: t?.dataset.emp, msg: p?.text, x: p?.x, visible: !!(r && r.height > 20 && r.width > 80 && r.top < innerHeight * 0.4) };
    });
    R.ping = ping;
    ok('phone', ping.on && /till is full/.test(ping.text) && ping.emp === '1' && ping.visible);
    await sleep(500);
    await page.screenshot({ path: out + 'empire-prompt-iphone.png' });
    const pin = await G(() => {
      const wp = window.SSX.hudx?.objective?.();
      return { label: wp?.label || '', kind: wp?.kind || '' };
    });
    R.pin = pin;
    ok('marker', /till is full|Come collect/.test(pin.label));
    const crime = await G(() => {
      const p = window.SSX.empirePrompt.debug.force('truck');
      const marks = window.SSX.empirePrompt.mapPlaces();
      return { text: p?.text || '', steps: p?.job?.steps?.map(s => s.text) || [], pay: p?.job?.pay, marks };
    });
    R.crime = { text: crime.text, pay: crime.pay, n: crime.marks.length, cat: crime.marks[0]?.cat, icon: crime.marks[0]?.icon };
    ok('truck', /armored truck/.test(crime.text) && crime.pay === 1600 && crime.marks[0]?.cat === 'crime' && !!crime.marks[0]?.icon);
    ok('steps', crime.steps.length === 2 && crime.steps.every(s => /Pays|Haul|wash|drop|truck/i.test(s)));
    const chat = await G(() => {
      const before = window.SSX.empirePrompt.loyalty('dex').loyalty;
      const t = document.getElementById('toast'); if (t) t.classList.remove('on');
      const r = window.SSX.empirePrompt.talk();
      return { before, after: r.loyalty, job: r.job?.kind || '', line: document.getElementById('toast')?.innerText || '' };
    });
    R.chat = chat;
    ok('checkin', chat.after > chat.before && !!chat.job && /Loyalty/.test(chat.line));
    ok('console', errors.length === 0);
    if (errors.length) R.errors = errors.slice(0, 8);
  } catch (e) { bad.push('crash'); R.crash = String(e).slice(0, 400); }
  console.log(JSON.stringify({ bad, R }, null, 2));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
