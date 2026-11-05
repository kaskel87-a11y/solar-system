// Rags to Riches rover fix: no rides -> kicked out of the starter rover; own a Dealer ride -> you can drive it; old save migrates.
// BASE=http://127.0.0.1:8788/ BR=webkit DEV="iPhone 14 Pro" VP=393x852 node tests/test-ragsrover.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8788/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14 Pro';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots', 'ragsrover')) + '/';
require('fs').mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...(({ defaultBrowserType, ...d }) => d)(devices[DEV] || devices['iPhone 14 Pro']), ...(process.env.VP ? { viewport: { width: +process.env.VP.split('x')[0], height: +process.env.VP.split('x')[1] } } : {}) };
  const ctx = await browser.newContext(dev), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag, vp: dev.viewport }, bad = [];
  const ok = (k, v, c) => { if (c === undefined) c = !!v; R[k] = v ?? !!c; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
  const boot = async () => { await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { window.__toasts = []; const a = window.__app, t = a.toast; a.toast = (m, ms) => { window.__toasts.push(String(m)); return t?.call(a, m, ms); }; }); };
  const land = async () => { await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800); await G(() => window.__app.surface.game.setAliens?.(false)); };
  const drive = () => G(() => { const s = window.__app.surface; if (!s.info.driving) { s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); } return s.info.driving; });
  const stillDriving = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (!(await G(() => window.__app.surface.info.driving))) return false; await sleep(200); } return true; };
  try {
    // 1. fresh Rags run, nothing owned: kicked out with the new wording
    await boot(); await G(() => { localStorage.removeItem('ssx.r2r.v1'); }); await land();
    await wait(() => !!window.__r2r?.data, 15000); await G(() => window.__r2r.startNew()); await sleep(1500);
    ok('startedNoRover', null, await G(() => window.__r2r.state.active && !window.__r2r.state.hasRover));
    await drive(); const kicked = await wait(() => !window.__app.surface.info.driving, 4000);
    const t1 = await G(() => window.__toasts.filter(t => /rover/i.test(t)).pop() || '');
    ok('noRidesKicked', null, kicked); ok('newToast', t1, /isn.t yours yet/.test(t1) && /Dealer/.test(t1) && /steal/.test(t1));
    await page.screenshot({ path: `${out}ragsrover-${tag}-kicked.png` }).catch(() => {});
    // 2. buy a Dealer ride (any garage entry besides the stock rover) -> drive the starter rover, not kicked, hasRover persisted
    await G(() => { const g = window.__app.surface.game.debug.P().garage; window.SSX.garage.grantVehicle('rover', { active: false }); });
    ok('ownsDealerRide', null, await G(() => window.__app.surface.game.debug.P().garage.rides.some(r => r.id !== 'stock')));
    await sleep(500); await drive();
    ok('dealerRideDrives', null, await stillDriving(4000));
    ok('hasRoverSynced', null, await G(() => window.__r2r.state.hasRover && JSON.parse(localStorage.getItem('ssx.r2r.v1')).hasRover === true));
    await page.screenshot({ path: `${out}ragsrover-${tag}-driving.png` }).catch(() => {});
    // 3. old save: r2r save with hasRover:false but the game save owns a ride -> migrates on load
    await G(() => { const s = JSON.parse(localStorage.getItem('ssx.r2r.v1')); s.hasRover = false; localStorage.setItem('ssx.r2r.v1', JSON.stringify(s)); window.__app.surface.game.save?.(); });
    await boot(); await land(); await wait(() => !!window.__r2r?.state, 15000); await sleep(1500);
    ok('oldSaveMigrated', null, await G(() => window.__r2r.state.hasRover === true && JSON.parse(localStorage.getItem('ssx.r2r.v1')).hasRover === true));
    await drive(); ok('oldSaveDrives', null, await stillDriving(3000));
    // panel: no beater pitch once you have a rover
    await G(() => window.__r2r.open()); await sleep(400);
    ok('panelNoBeater', null, await G(() => !document.querySelector('#r2rPanel [data-a=rover]') && /🚙 rover/.test(document.getElementById('r2rPanel').textContent)));
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  if (errs.length) R.errs = errs.slice(0, 5);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS'); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
