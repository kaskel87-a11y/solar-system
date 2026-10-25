// renders the raw gameplay frame for the 1200x630 share card (HUD hidden), Roadster flying + rockets, near the Starship
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, hasTouch: true, isMobile: false }); const p = await c.newPage();
  const G = (f, a) => p.evaluate(f, a);
  await p.goto('http://localhost:8765/?t=' + Date.now()); await p.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
  await G(() => { localStorage.removeItem('ssx.progress.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
  await p.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, null, { timeout: 60000 }); await sleep(1500);
  await G(() => { const g = window.__app.game; g.setAliens(false); g.debug.clear(); g.progress.credits = 9999; for (const k of ['turret2', 'turret3', 'rockets', 'kit:roadster']) g.buy(k); const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); s.interact(); });
  await sleep(1200);
  await p.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden!important}' });
  await G(() => { window.__app.game.switchWeapon('rockets'); window.__app.touchBtns.jump = true; window.__app.joy.y = -0.6; window.__app.joy.x = -0.8; });
  await p.waitForFunction(() => window.__app.surface.info.carAlt > 7, null, { timeout: 30000 }).catch(() => {});
  for (const n of [0, 1, 2, 3]) { await G(() => window.__app.game.fire(null)); await sleep(160); await p.screenshot({ path: `/tmp/card-raw-${n}.png` }); }
  console.log(JSON.stringify(await G(() => window.__app.surface.info.thrust)), await G(() => window.__app.surface.info.carAlt));
  await b.close();
})();
