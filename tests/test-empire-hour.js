// Smoke: SSX.empire.on('hour') in the real game with no fronts owned. A listener queued before boot (window.SSX_pending.empire),
// ticks in space (timer) and on Mars (surface tick), SSX.time when present, income untouched.
// BASE=http://127.0.0.1:8872/ BR=webkit DEV="iPhone 14 Pro" VP=393x852 SHOTS_DIR=/workspace/pw-ben-empire/shots node test-empire-hour.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8872/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14 Pro', VP = process.env.VP;
const out = (process.env.SHOTS_DIR || '/workspace/pw-ben-empire/shots').replace(/\/?$/, '/'), desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  let opts = desk ? { viewport: { width: 1440, height: 900 } } : { ...pw.devices[DEV] };
  if (VP) { const [w, h] = VP.split('x').map(Number); opts = { ...opts, viewport: { width: w, height: h }, screen: { width: w, height: h } }; }
  delete opts.defaultBrowserType;
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { localStorage.removeItem('ssx.empire.v1'); window.__hours = []; (window.SSX_pending ||= {}).empire = [['hour', d => window.__hours.push(d)]]; });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const vp = page.viewportSize(), tag = `emphour-${vp.width}x${vp.height}-${BR}`, R = { tag }, bad = [];
  const G = (f, a) => page.evaluate(f, a), ok = (k, v, c) => { if (c === undefined) c = v; R[k] = v ?? !!c; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const setH = h => G(h => window.__danger?.setClock?.(h), h);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    ok('api', await wait(() => !!window.SSX?.empire?.ready || !!window.SSX?.empire, 20000));
    ok('noFronts', (await G(() => window.SSX.empire.owned().length)) === 0);
    const hasClock = await G(() => typeof window.__danger?.setClock === 'function'); R.dangerClock = hasClock;
    // in space: the timer pumps
    await setH(9.5); await sleep(1500); const n0 = await G(() => window.__hours.length);
    await setH(10.2); ok('spaceTick', await wait(n0 => window.__hours.length > n0, 5000, n0));
    R.spaceHour = await G(() => window.__hours.at(-1)); ok('hour10', R.spaceHour?.hour === 10 && R.spaceHour?.fronts === 0 && R.spaceHour?.catchUp === false);
    const inc0 = await G(() => window.SSX.empire.pending());
    // land, then tick on Mars through the surface tick; then SSX.time takes over (rebaseline, no burst)
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 150000));
    const n1 = await G(() => window.__hours.length); await setH(12.1); ok('marsTick', await wait(n1 => window.__hours.length >= n1 + 2, 8000, n1)); // 11 and 12
    R.marsHours = await G(n1 => window.__hours.slice(n1).map(d => d.hour + (d.catchUp ? '*' : '')).join(), n1);
    const n2 = await G(() => window.__hours.length);
    await G(() => { window.__fakeH = 3; window.SSX.time = { hour: () => window.__fakeH, set: h => { window.__fakeH = h; }, isNight: () => true }; }); await sleep(1500);
    ok('noBurstOnSwitch', (await G(() => window.__hours.length)) === n2);
    await G(() => { window.__fakeH = 4.05; }); ok('timeTick', await wait(n2 => window.__hours.length === n2 + 1 && window.__hours.at(-1).source === 'SSX.time' && window.__hours.at(-1).hour === 4, 5000, n2));
    ok('incomeUnchanged', (await G(() => window.SSX.empire.pending())) === inc0 && inc0 === 0);
    ok('lateOn', await G(() => { let got = 0; const off = window.SSX.empire.on('hour', () => got++); window.__fakeH = 5.2; window.SSX.empire.debug.hourPump(); off(); return got === 1; }));
    // raid slot: our rival raid yields to another add-on's raid:request, then the hourly roll / defend stay off the busy slot
    R.slot = await G(() => { const e = window.SSX.empire, out = {};
      localStorage.setItem('ssx.empire.v1', JSON.stringify({ v: 1, owned: { 'fr-disp': { pending: 0 } }, lastAt: Date.now(), lastHour: null, clockH: 0, lastThreatH: -99, threat: null, earned: 0, log: [], stats: {}, home: null }));
      e.reload(); e.debug.threat('fr-disp', 'raid'); out.def = e.defend(); out.eng0 = e.debug.defense()?.engine; out.slot0 = e.raidSlot();
      let y = 0; const off = e.on('yield', () => y++);
      dispatchEvent(new CustomEvent('raid:request', { detail: { id: 'farm-raid-t' } })); off();
      const d = e.debug.defense(); out.eng1 = d?.engine; out.yielded = !!d?.yielded; out.y = y; out.threatKept = !!e.threat();
      out.other = window.SSX.raids.start({ id: 'farm-raid-t', pos: { x: window.__app.surface.player?.position?.x ?? 0, z: window.__app.surface.player?.position?.z ?? 0 }, radius: 24, attackers: 'gang', waves: 1 }).ok;
      out.slot1 = e.raidSlot(); out.again = e.yieldRaid() === false;
      window.SSX.raids.stop('farm-raid-t'); e.debug.win(); out.slot2 = e.raidSlot(); return out; });
    ok('raidYield', R.slot.def?.ok && R.slot.eng0 === 'raids' && R.slot.slot0 === 'ours' && R.slot.eng1 === 'hold' && R.slot.yielded && R.slot.y === 1 && R.slot.threatKept && R.slot.other && R.slot.slot1 === 'other' && R.slot.again && R.slot.slot2 === 'free');
    await page.screenshot({ path: `${out}${tag}.png`, timeout: 90000 }).catch(() => {});
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  R.errors = errors.slice(0, 5); if (errors.some(e => !/audio device/i.test(e))) bad.push('pageerrors'); // headless WebKit has no audio device
  console.log(JSON.stringify(R)); await browser.close();
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag); process.exit(bad.length ? 1 : 0);
})();
