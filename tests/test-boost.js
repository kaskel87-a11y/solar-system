// v7.3 test: boost while driving on a laptop. Shift boosts the rover and a stolen buggy past their cruise speed,
// and mouse-holding the ⚡ Boost button does too. BASE=http://localhost:8765/ node test-boost.js
const { chromium } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', out = process.env.OUT || '/workspace/solar-system/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const G = (f, a) => page.evaluate(f, a), R = { tag: 'desktop-chromium' }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const I = () => G(() => window.__app.surface.info);
  // drive forward for ms, return the top speed seen
  // swiftshader runs at a few fps, so drive until the speed passes `goal` (or settles) instead of for a fixed wall time
  let lane = 0;
  const topSpeed = async (ms, boostHow, goal = 1e9) => {
    lane++;
    await page.keyboard.down('KeyW');
    if (boostHow === 'shift') await page.keyboard.down('ShiftLeft');
    if (boostHow === 'mouse') { await G(() => document.exitPointerLock && document.exitPointerLock()); await sleep(200); const b = await G(() => { const r = document.getElementById('runBtn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }); R.boostBtnW = b.w; await page.mouse.move(b.x, b.y); await page.mouse.down(); }
    let top = 0, glow = false, cap = 0; const t0 = Date.now();
    let last = -1, still = 0; while (Date.now() - t0 < ms && top < goal && still < 25) { const s = await G(() => [window.__app.surface.info.speed, window.__app.surface.info.boosting && window.__app.surface.info.vcap, document.body.classList.contains('boosting'), document.getElementById('runBtn').classList.contains('on'), document.elementFromPoint(innerWidth - 60, innerHeight - 60)?.id]); R.dbg = s.slice(1); top = Math.max(top, s[0]); cap = Math.max(cap, s[1] || 0); glow = glow || s[2]; still = Math.abs(s[0] - last) < 0.02 && s[0] > 3 ? still + 1 : 0; last = s[0]; await sleep(80); }
    if (boostHow === 'shift') await page.keyboard.up('ShiftLeft');
    if (boostHow === 'mouse') await page.mouse.up();
    await page.keyboard.up('KeyW'); await sleep(1500);
    return { top: +top.toFixed(1), glow, cap };
  };
  const reset = async (x, z, yaw) => G(([x, z, yaw]) => { const s = window.__app.surface; s.debugPlace?.(x, z, yaw); }, [x, z, yaw]);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800);
    // ---- own rover
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await wait(() => /Drive/.test(document.getElementById('driveBtn').textContent), 8000);
    await page.keyboard.press('KeyE');
    ok('roverIn', await wait(() => window.__app.surface.info.driving && !window.__app.surface.info.stolen, 6000));
    ok('boostHint', await G(() => !!window.__boostHint || /Hold Shift to boost/.test(document.body.innerText)));
    ok('boostBtnVisible', await G(() => getComputedStyle(document.getElementById('runBtn')).display !== 'none' && document.getElementById('runBtn').textContent), /Boost/.test(await G(() => document.getElementById('runBtn').textContent)));
    const rc = await topSpeed(45000, null, 99); const rb = await topSpeed(60000, 'shift', 21.5);
    ok('roverShiftBoost', `${rc.top} → ${rb.top} cap ${rb.cap}`, rc.cap === 0 && rb.cap === 30 && rb.glow && rb.top > rc.top);
    const rm = await topSpeed(60000, 'mouse', 21.5);
    ok('roverMouseBoost', `${rm.top} cap ${rm.cap}`, rm.cap === 30 && rm.glow);
    await page.keyboard.press('KeyE'); await wait(() => !window.__app.surface.info.driving, 6000);
    // ---- stolen buggy
    const v = await G(() => window.__app.surface.world.debug.vehicles().find(v => v.kind === 'buggy' && v.parked));
    await G(v => { window.__app.game.debug.clear(); window.__app.surface.world.setWanted(0); window.__app.surface.debugMove(v.x + 3.4, v.z + 1.2, 1.2); }, v);
    await wait(() => /Take/.test(document.getElementById('driveBtn').textContent), 10000);
    await page.keyboard.press('KeyE');
    ok('buggyIn', await wait(() => window.__app.surface.info.driving && window.__app.surface.info.stolen && window.__app.surface.info.vehicle === 'buggy', 6000));
    const bb = await topSpeed(60000, 'shift', 25.5);
    ok('buggyShiftBoost', `${bb.top} cap ${bb.cap}`, bb.cap === 34 && bb.top > 22.5);
    const bm = await topSpeed(60000, 'mouse', 25.5);
    ok('buggyMouseBoost', `${bm.top} cap ${bm.cap}`, bm.cap === 34);
    ok('controlsListBoost', await G(() => /Boost when driving/.test(document.getElementById('ctlPanel').textContent)));
    await page.screenshot({ path: out + 'v73-desktop-boost.png' });
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
