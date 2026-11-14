// v7.5.98 Pit bets + plasma blade.
// BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" OUT=/tmp/pitbets/ node tests/test-pitbets.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const desk = DEV === 'desktop';
const out = (process.env.OUT || '/tmp/pitbets/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = desk ? { viewport: { width: 1280, height: 800 } } : (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone 14']);
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL/i.test(m.text())) errors.push('C ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = f => page.evaluate(f), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.99');
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(400);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.());
    ok('api', await wait(() => !!window.SSX?.pitbets?.debug && !!window.SSX?.plasma?.setColor && !!window.SSX?.pitRing?.centre?.(), 20000));
    await G(() => window.SSX.pitbets.debug.force('cinder', 'pebble', 90));
    const away = await G(() => {
      const c = window.SSX.pitRing.centre(), book = { x: 9.4, z: 6.4 };
      window.__app.surface.debugMove(c.x + book.x + 18, c.z + book.z, 0, 0.1);
      return true;
    });
    ok('moved', away);
    await sleep(600);
    const arrow = await G(() => document.getElementById('ssxGuide')?.textContent || '');
    ok('arrow', /betting window/.test(arrow), arrow.slice(0, 120));
    await G(() => {
      const c = window.SSX.pitRing.centre();
      const x = c.x + 9.4, z = c.z + 6.4;
      const face = Math.atan2(-(c.x - x), -(c.z - z));
      window.__app.surface.debugMove(x + 1.2, z + 0.4, face, 0.15);
      window.__app.game.progress.credits = 800; window.__app.game.save();
      window.SSX.pitbets.open();
    });
    await sleep(500);
    const sheet = await G(() => {
      const p = document.getElementById('pbSheet');
      const b = p?.querySelector('button');
      const r = b?.getBoundingClientRect();
      const t = p?.textContent || '';
      return { on: p?.classList.contains('on'), cinder: /Cinder Holt/.test(t), pebble: /Pebble Quinn/.test(t), h: Math.round(r?.height || 0), w: Math.round(r?.width || 0) };
    });
    ok('sheet', sheet.on && sheet.cinder && sheet.pebble && sheet.h >= 48 && sheet.w >= 48, sheet);
    await G(() => { const st = document.createElement('style'); st.textContent = '#toast,#radio,#obLine,.ssxBark{display:none!important}'; document.head.appendChild(st); });
    await sleep(200);
    await page.screenshot({ path: out + `bets-${tag}.png` });
    const bet = await G(() => window.SSX.pitbets.place('cinder', 100));
    ok('bet', bet?.ok === true && bet.stake === 100, bet);
    const seat = await G(() => {
      const c = window.SSX.pitRing.centre();
      window.__app.surface.debugMove(c.x - 1.2 + 16, c.z - 12.2, 0);
      return true;
    });
    ok('towardSeat', seat);
    await sleep(500);
    const seatArrow = await G(() => document.getElementById('ssxGuide')?.textContent || '');
    ok('seatArrow', /marked seat/.test(seatArrow), seatArrow.slice(0, 140));
    await G(() => { window.SSX.plasma.setColor('amber'); window.__app.game.buy('plasmablade'); });
    ok('blade', await G(() => window.SSX.plasma.equipped() && window.SSX.plasma.color() === 'amber' && window.__app.game.progress.equip.weapon === 'plasmablade'));
    ok('swing', await G(() => window.__app.game.fire() === true));
    ok('console', errors.length === 0, errors);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 500); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
