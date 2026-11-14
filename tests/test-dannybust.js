// v7.5.104 Danny's bikini top. BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" OUT=/opt/cursor/artifacts/ node tests/test-dannybust.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const desk = DEV === 'desktop';
const out = (process.env.OUT || '/tmp/dannybust/').replace(/\/?$/, '/');
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
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v) => { R[k] = v; if (!v) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.110');
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(400);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.onboard?.skip?.(); window.__app.game.progress.credits = 5000; window.__app.surface.world.setWanted(0); });
    ok('doors', await wait(() => window.__app.surface.world.doorList().some(x => x.kind === 'club'), 8000));
    const door = await G(() => { const d = window.__app.surface.world.doorList().find(x => x.kind === 'club'); return d && { x: d.x, z: d.z, name: d.name }; });
    R.door = door;
    if (!door) throw new Error('no club door');
    await G(d => window.__app.surface.debugPlace(d.x, d.z + 0.4, Math.PI), door);
    await sleep(200);
    await G(() => window.__app.surface.enterBuilding());
    ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));
    await sleep(400);
    const fit = await G(() => {
      window.SSX.guide.aim({ id: 'ines', label: 'Ines · staff room 18 m', nx: 0.92, ny: 0.1 });
      const e = document.getElementById('ssxGuide'), r = e.getBoundingClientRect(), t = e.querySelector('span').textContent;
      return { t, w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), W: innerWidth };
    });
    R.fit = fit;
    ok('labelFits', fit.t === 'Ines · staff room 18 m' && fit.left >= -1 && fit.right <= fit.W + 1 && fit.w >= 150);
    await G(() => { localStorage.setItem('ssx.dannyShows', '1'); window.__pshow.start('lap'); });
    ok('dancing', await wait(() => window.__pshow?.state?.ready, 20000));
    await G(() => { window.__pshow.lapBeat('lean'); window.__pshow.debugView('chest'); });
    await sleep(1600);
    const suit = await G(() => {
      let cup = 0, strap = 0, bot = 0, ball = 0;
      window.__app.surface.scene.traverse(o => {
        if (o.name === 'ssx-micro-cup') cup++;
        if (o.name === 'ssx-micro-strap') strap++;
        if (o.name === 'ssx-micro-bottom') bot++;
        if (o.name === 'ssx-cup') ball++;
      });
      return { cup, strap, bot, ball };
    });
    R.suit = suit;
    ok('micro', suit.cup >= 2 && suit.strap >= 2 && suit.bot >= 1 && suit.ball === 0);
    await page.screenshot({ path: out + `danny-bust-${tag}.png` });
    ok('console', errors.length === 0);
    if (errors.length) R.errors = errors.slice(0, 8);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 600); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });