// Umbra Hold on an iPhone-sized screen. Bribe in, a favor on the mission card, shuttle to Mars.
// BASE=http://127.0.0.1:8771/ BR=chromium DEV=390x844 OUT=/opt/cursor/artifacts/ node tests/test-umbra.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771/';
const BR = process.env.BR || 'chromium';
const DEV = process.env.DEV || '390x844';
const out = (process.env.OUT || '/tmp/umbra/').replace(/\/?$/, '/');
const EARTH = process.env.EARTH !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const m = /^(\d+)x(\d+)$/.exec(DEV);
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const dev = m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone 14']);
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('ssx.adult', '1');
    localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message.slice(0, 240)); });
  page.on('console', msg => { if (msg.type() === 'error' && !/audio device|Failed to load|WebGL|favicon|net::/i.test(msg.text())) errors.push('C ' + msg.text().slice(0, 240)); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a);
  const R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = typeof v === 'string' ? v.slice(0, 180) : v; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = name => page.screenshot({ path: out + name });
  const hideChrome = () => G(() => {
    document.getElementById('radioLater')?.click();
    for (const id of ['radio', 'toast', 'obLine', 'downMsg']) {
      const e = document.getElementById(id);
      if (e) e.style.setProperty('display', 'none', 'important');
    }
  });
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content), (await G(() => document.querySelector('meta[name="app-version"]').content)) === 'v7.5.139');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Moon').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && window.__app.surface.info?.name === 'Moon', 120000));
    await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.());
    ok('api', await wait(() => !!window.SSX?.prison?.debug && !!window.SSX.prison.spot('gate'), 20000));
    await G(() => { const g = window.__app.game; g.progress.credits = 8000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.prison.debug.reset(); g.progress.credits = 8000; g.save(); });
    await sleep(400);
    const gate = await G(() => window.SSX.prison.spot('gate'));
    ok('gate', gate && Number.isFinite(gate.x), !!gate);
    await G(p => window.__app.surface.debugMove(p.x, p.z + 6, 0, 0.2), gate);
    ok('hold mesh', await wait(() => !!window.__app.surface.scene.getObjectByName('umbra-hold'), 8000));
    ok('gate btn', await wait(() => { const b = document.getElementById('umbraAct'); return !!(b && b.classList.contains('on')); }, 5000));
    const btnBox = await G(() => { const b = document.getElementById('umbraAct'); const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return { h: r.height, w: r.width, bg: s.backgroundColor, fg: s.color, t: b.textContent }; });
    ok('gate btn size', btnBox, btnBox.h >= 44 && btnBox.w >= 44 && /0, 0, 0/.test(btnBox.bg) && /255, 255, 255/.test(btnBox.fg));
    await hideChrome();
    await shot(`iphone_umbra_prison_${tag}.png`);

    await G(() => document.getElementById('umbraAct').click());
    ok('gate sheet', await wait(() => document.getElementById('umbraSheet')?.classList.contains('on'), 3000));
    const choices = await G(() => [...document.querySelectorAll('#umbraSheet button')].map(b => b.textContent));
    ok('both ways in', choices.join(' | '), /Bribe the sentry/.test(choices.join(' ')) && /Turn yourself in/.test(choices.join(' ')));
    const sheetBtn = await G(() => { const b = document.querySelector('#umbraSheet button[data-a="bribe"]'); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) }; });
    ok('sheet btn', sheetBtn, sheetBtn.h >= 48 && sheetBtn.w >= 120);
    const before = await G(() => window.__app.game.progress.credits);
    await G(() => document.querySelector('#umbraSheet button[data-a="bribe"]').click());
    await sleep(400);
    const after = await G(() => ({ cr: window.__app.game.progress.credits, entry: window.SSX.prison.state.entry, rank: window.SSX.prison.state.rankName }));
    ok('bribed', after, after.entry === 'bribe' && after.rank === 'Visitor' && after.cr === before - 350);

    const neeve = await G(() => window.SSX.prison.spot('trustee'));
    await G(p => window.__app.surface.debugMove(p.x, p.z + 3, 0), neeve);
    ok('neeve btn', await wait(() => document.getElementById('umbraAct')?.textContent === 'Neeve', 4000));
    await G(() => document.getElementById('umbraAct').click());
    await sleep(200);
    await G(() => document.querySelector('#umbraSheet button[data-a="meet"]').click());
    ok('newcomer', await G(() => window.SSX.prison.state.rankName), (await G(() => window.SSX.prison.state.rankName)) === 'Newcomer');

    const juno = await G(() => window.SSX.prison.spot('juno'));
    await G(p => window.__app.surface.debugMove(p.x, p.z + 4, 0, 0.15), juno);
    ok('juno btn', await wait(() => document.getElementById('umbraAct')?.textContent === 'Juno', 4000));
    await G(() => document.getElementById('umbraAct').click());
    await sleep(200);
    await G(() => document.querySelector('#umbraSheet button[data-a="favor"]').click());
    ok('favor live', await wait(() => window.__app.game.info.quest?.id === 'umbra-favor-juno', 5000));
    await hideChrome();
    await sleep(400);
    await hideChrome();
    const card = await G(() => {
      const q = document.getElementById('questTrack');
      const g = document.getElementById('ssxGuide');
      const cs = q ? getComputedStyle(q) : null;
      return { on: q && q.style.display !== 'none' && q.textContent.length > 10, text: q?.textContent || '', how: !!q?.querySelector('.hxHow'), arrow: !!(g && g.classList.contains('on')), fs: cs ? parseFloat(cs.fontSize) : 0 };
    });
    ok('mission card', card.text, card.on && /motor pool|spare key/i.test(card.text) && card.how);
    ok('arrow', card.arrow, card.arrow === true);
    await shot(`iphone_umbra_recruit_${tag}.png`);

    const stepTo = async () => {
      const wp = await G(() => window.__app.game.waypoint());
      if (!wp) return false;
      await G(p => window.__app.surface.debugMove(p.x, p.z, 0), wp);
      await sleep(500);
      return true;
    };
    await stepTo();
    ok('step 2', await wait(() => window.__app.game.info.quest?.step === 1, 4000));
    await stepTo();
    ok('favor done', await wait(() => window.SSX.prison.state.favors.juno === 1, 4000));

    await G(p => window.__app.surface.debugMove(p.x, p.z + 3, 0), juno);
    await sleep(300);
    await G(() => document.getElementById('umbraAct').click());
    await sleep(200);
    await G(() => document.querySelector('#umbraSheet button[data-how="parole"]').click());
    ok('parole quest', await wait(() => window.__app.game.info.quest?.id === 'umbra-out-juno-parole', 5000));
    await G(() => { const r = document.getElementById('radio'); if (r) r.style.display = 'none'; });
    await stepTo();
    ok('lift', await wait(() => document.getElementById('umbraLift')?.classList.contains('on'), 8000));
    const lift = await G(() => document.getElementById('umbraLift')?.innerText || '');
    ok('lift text', lift, /Mars/i.test(lift) && /Juno|shuttle/i.test(lift));
    await sleep(250);
    await shot(`iphone_umbra_shuttle_${tag}.png`);
    ok('mars', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.name === 'Mars' && window.__app.surface.info?.intro === 0, 60000));
    ok('crew', await wait(() => window.SSX.prison.state.crew.includes('juno') && window.SSX.prison.driveMul() === 1.12, 8000));
    ok('crew mesh', await wait(() => !!window.__app.surface.scene.getObjectByName('umbra-crew'), 8000));
    await sleep(400);
    await shot(`iphone_umbra_mars_crew_${tag}.png`);

    await G(() => { window.SSX.prison.debug.favor('sato'); window.SSX.prison.debug.favor('moss'); });
    await G(() => window.__app.takeOff());
    ok('back to moon', await wait(() => !window.__app.state.onSurface && !window.__app.state.transitioning, 20000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Moon').mesh));
    ok('moon again', await wait(() => window.__app.state.onSurface && window.__app.surface.info?.name === 'Moon' && window.__app.surface.info?.intro === 0, 60000));
    await G(() => { const g = window.__app.game; g.progress.credits = 8000; g.save(); });
    const gspot = await G(() => window.SSX.prison.spot('guard'));
    await G(p => window.__app.surface.debugMove(p.x, p.z + 3, 0), gspot);
    ok('guard btn', await wait(() => document.getElementById('umbraAct')?.textContent === 'Guard', 5000));
    await G(() => document.getElementById('umbraAct').click());
    await sleep(200);
    await G(() => document.querySelector('#umbraSheet button[data-a="guardpay"]').click());
    ok('hand', await wait(() => window.SSX.prison.state.rank >= 4, 3000), (await G(() => window.SSX.prison.state.rank)) >= 4);

    await G(() => window.__app.game.abandon?.(true));
    await G(() => window.SSX.prison.open());
    await sleep(200);
    ok('menu step', await G(() => document.querySelector('#umbraSheet .step')?.textContent || ''), /Bram|ring|chair|glint/i.test(await G(() => document.querySelector('#umbraSheet .step')?.textContent || '')));
    await G(() => window.SSX.prison.close());

    if (EARTH) {
      await G(() => window.__app.takeOff());
      await wait(() => !window.__app.state.onSurface && !window.__app.state.transitioning, 20000);
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Earth').mesh));
      ok('earth', await wait(() => window.__app.state.onSurface && window.__app.surface.info?.name === 'Earth' && window.__app.surface.info?.intro === 0, 60000));
      ok('transfer', await wait(() => !!window.__app.surface.scene.getObjectByName('quell-transfer'), 8000));
      const desk = await G(() => window.SSX.prison.spot('earth'));
      ok('desk', !!desk && Number.isFinite(desk?.x), !!desk);
      if (desk) await G(p => window.__app.surface.debugMove(p.x, p.z + 3, Math.PI), desk);
      ok('desk btn', await wait(() => document.getElementById('umbraAct')?.textContent === 'Transfer', 5000));
      await G(() => document.getElementById('umbraAct').click());
      await sleep(300);
      const earthTxt = await G(() => document.getElementById('umbraBody')?.innerText || '');
      ok('earth sheet', earthTxt, /Quell Transfer/.test(earthTxt) && /Moon/.test(earthTxt));
      await shot(`iphone_umbra_earth_${tag}.png`);
      await G(() => window.SSX.prison.close());
    }

    const landW = DEV.startsWith('390') ? 844 : 932;
    const landH = DEV.startsWith('390') ? 390 : 430;
    await page.setViewportSize({ width: landW, height: landH });
    await sleep(400);
    await G(() => window.SSX.prison.open());
    await sleep(300);
    const landBtn = await G(() => { const b = document.querySelector('#umbraSheet button'); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), in: r.top >= -2 && r.bottom <= innerHeight + 2 }; });
    ok('landscape btn', landBtn, landBtn.h >= 44);
    await G(() => window.SSX.prison.close());

    ok('clean console', errors.slice(0, 4).join(' | ') || 'none', errors.length === 0);
  } catch (e) {
    console.log('CRASH', e.stack || e.message);
    bad.push('crash');
    try { await shot(`iphone_umbra_crash_${tag}.png`); } catch (e2) { /* */ }
  }
  console.log(JSON.stringify({ R, bad }, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
