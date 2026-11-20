// Walk-in Vat House. The door enters a room. Stations and crew are buttons with plain labels.
// BASE=http://127.0.0.1:8771/ BR=chromium DEV=390x844 OUT=/opt/cursor/artifacts/ node tests/test-labroom.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771/';
const BR = process.env.BR || 'chromium';
const DEV = process.env.DEV || '390x844';
const out = (process.env.OUT || '/tmp/labroom/').replace(/\/?$/, '/');
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
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 220)); });
  page.on('console', msg => { if (msg.type() === 'error' && !/audio device|Failed to load|WebGL|favicon|net::/i.test(msg.text())) errors.push('C ' + msg.text().slice(0, 220)); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a);
  const R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = typeof v === 'string' ? v.slice(0, 160) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 25000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const shot = name => page.screenshot({ path: out + name });
  const quiet = () => G(() => { document.getElementById('radioLater')?.click(); try { window.SSX?.guide?.clear?.(); } catch (e) { /* */ } for (const id of ['radio', 'toast', 'ssxGuide', 'hxOne']) { const e = document.getElementById(id); if (e) e.style.setProperty('display', 'none', 'important'); } });
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.124');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(500);
    await G(() => { const g = window.__app.game; g.progress.credits = 20000; g.save(); window.SSX.lab.debug.reset(); window.SSX.contraband?.reset?.(); window.__app.surface.world.setWanted(0); window.SSX.onboard?.skip?.(); });
    await G(() => window.SSX.lab.buy({ force: true }));
    await G(() => { const L = window.SSX.lab; L.buySupplies(4); L.hire('cook'); L.hire('guard'); L.hire('runner'); L.debug.advance(40); L.debug.sale(); });
    await G(() => window.SSX.lab.debug.goto());
    await sleep(600);
    ok('enter btn', await wait(() => document.getElementById('labAct')?.textContent === '🚪 Enter', 6000));
    const box = await G(() => { const b = document.getElementById('labAct'); const r = b.getBoundingClientRect(); return { h: r.height, w: r.width, fits: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= -1 }; });
    ok('enter size', box, box.h >= 44 && box.w >= 44 && box.fits);
    await G(() => document.getElementById('labAct').click());
    ok('inside', await wait(() => window.__app.surface.info?.inside?.kind === 'vathouse', 8000));
    await quiet();
    await sleep(300);

    const stand = async (x, z, yaw, pitch = -0.18) => { await G(([x, z, yaw, pitch]) => { const s = window.__app.surface; s.setView('first'); s.debugInside(x, z, yaw, pitch); }, [x, z, yaw, pitch]); await sleep(400); };
    const spot = () => G(() => { const s = window.__app.surface.info?.spot; const b = document.getElementById('driveBtn'); const r = b?.getBoundingClientRect(); return s ? { id: s.id, label: s.label, shown: b && getComputedStyle(b).display !== 'none', h: r ? Math.round(r.height) : 0, text: b?.textContent || '' } : null; });

    await stand(-2.6, -1.5, 0, -0.72);
    let s = await spot();
    ok('vat prompt', s && s.label, !!s && /Glow-dust \d+%/.test(s.label || '') && s.h >= 44);
    await quiet();
    await shot(`iphone_vathouse_vats_${tag}.png`);

    await stand(-3.3, 0.2, Math.PI / 2);
    s = await spot();
    ok('crates prompt', s && s.id, s?.id === 'supply' && /Buy crates/.test(s.label || ''));
    await G(() => document.getElementById('driveBtn').click());
    ok('crate sheet', await wait(() => document.getElementById('labRoom')?.classList.contains('on'), 3000));
    const sheet = await G(() => {
      const el = document.getElementById('labRoom');
      const btns = [...el.querySelectorAll('button')].map(b => ({ t: b.textContent, h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) }));
      const box = el.querySelector('.wrap').getBoundingClientRect();
      return { text: el.innerText.slice(0, 180), btns, fits: box.left >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 };
    });
    ok('crate words', sheet.text, /One crate runs one batch/.test(sheet.text) && sheet.fits && sheet.btns.every(b => b.h >= 44));
    const before = await G(() => window.SSX.lab.status().supplies);
    await G(() => [...document.querySelectorAll('#labRoom button')].find(b => b.textContent.startsWith('Buy 1'))?.click());
    await sleep(300);
    ok('bought one', await G(() => window.SSX.lab.status().supplies), (await G(() => window.SSX.lab.status().supplies)) === before + 1);

    await stand(2.6, -2.05, 0);
    s = await spot();
    ok('red vat', s && s.label, !!s && /Red Static locked/.test(s.label || ''));
    await G(() => document.getElementById('driveBtn').click());
    await sleep(250);
    ok('red locked', await G(() => { const r = window.SSX.lab.setProduct('redstatic'); return r.ok === false && /clean room/.test(r.msg); }));

    await stand(2.75, -0.15, -Math.PI / 2, -0.5);
    s = await spot();
    ok('locker or till', s && s.label, !!s && /locker|till|cr/i.test(s.label || ''));
    await quiet();
    await shot(`iphone_vathouse_stations_${tag}.png`);

    await stand(-2.3, 3.05, 0, -0.18);
    await quiet();
    await shot(`iphone_vathouse_crew_${tag}.png`);
    await stand(-2.3, 0.35, Math.PI, -0.22);
    s = await spot();
    ok('tuli', s && s.id, s?.id === 'tuli');
    await G(() => document.getElementById('driveBtn').click());
    ok('talk', await wait(() => /Tuli/.test(document.getElementById('labRoom')?.innerText || ''), 3000));
    const talk = await G(() => {
      const el = document.getElementById('labRoom');
      const box = el.querySelector('.wrap').getBoundingClientRect();
      const btns = [...el.querySelectorAll('button')];
      return { text: el.innerText.slice(0, 200), fits: box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1, h: Math.min(...btns.map(b => b.getBoundingClientRect().height)) };
    });
    ok('talk sheet', talk.text, /door/.test(talk.text) && talk.fits && talk.h >= 44);
    await G(() => document.querySelector('#labRoom [data-a="close"]')?.click());

    await G(() => window.SSX.lab.debug.raid('gang', 'dustjaws'));
    await sleep(400);
    ok('raid inside', await G(() => { const r = window.SSX.lab.status().raid; return r && r.phase !== 'lose' && window.SSX.lab.inside(); }), true);

    await stand(0, 2.4, 0);
    s = await spot();
    ok('leave', s && s.id, s?.id === 'leave' && /Leave/.test(s.label || ''));
    await G(() => document.getElementById('driveBtn').click());
    ok('out', await wait(() => !window.__app.surface.info?.inside, 4000));
    ok('panel still', await G(() => { window.SSX.lab.open(); return document.getElementById('labPanel').classList.contains('show'); }));
    await G(() => window.SSX.lab.close());
    ok('clean', errors.slice(0, 3).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
    try { await shot(`iphone_vathouse_crash_${tag}.png`); } catch (e2) { /* */ }
  }
  console.log(JSON.stringify({ R, bad }, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
