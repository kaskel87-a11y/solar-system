// v7.5.16 F-key auto-aim (Collin, laptop: "when you fire it goes to where the mouse is, hard to drive with the arrows and fire").
// Desktop Chromium: drive with the arrow keys, park the mouse in a corner (no pointer lock), spawn a ColSec unit ~22 m ahead and
// ~12 degrees off the car's heading, hold F: the shots must hit it. Also: the first-time hint toast and the ❔ Controls rows.
// BASE=http://127.0.0.1:8977/ node tests/test-autoaim.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8889/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.game.debug?.calm?.(true); });
    ok('controlsRow', await G(() => /F<\/kbd><\/td><td>Fire with auto-aim/.test(document.getElementById('ctlPanel').innerHTML) && /Click<\/td><td>Fire at the mouse cursor/.test(document.getElementById('ctlPanel').innerHTML)));
    // drive: summon the rover, get in, open ground (colony outskirts)
    await G(() => { const s = window.__app.surface, c = s.info.colony; s.debugMove(c.x + 160, c.z + 160); });
    await sleep(600);
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); });
    ok('driving', await wait(() => window.__app.surface.info.driving, 15000));
    await page.mouse.move(15, 15); // mouse parked top-left, never moved again
    ok('noPointerLock', await G(() => !document.pointerLockElement));
    await page.keyboard.down('ArrowUp'); await sleep(900); await page.keyboard.down('ArrowLeft'); await sleep(250); await page.keyboard.up('ArrowLeft'); await sleep(700); await page.keyboard.up('ArrowUp');
    const p0 = await G(() => ({ x: window.__app.surface.info.x, z: window.__app.surface.info.z }));
    await page.keyboard.down('ArrowUp'); await sleep(500); await page.keyboard.up('ArrowUp'); await sleep(300);
    const p1 = await G(() => ({ x: window.__app.surface.info.x, z: window.__app.surface.info.z }));
    const yaw = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z)); R.moved = Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1);
    ok('hint', await wait(() => /F = fire \(auto-aim\)/.test(document.getElementById('fireHint')?.textContent || ''), 12000));
    // a ColSec buggy ~22 m ahead, 12 degrees right of the heading
    const off = 12 * Math.PI / 180, at = { x: p1.x - Math.sin(yaw - off) * 22, z: p1.z - Math.cos(yaw - off) * 22 };
    R.spawn = await G(at => { const w = window.__app.surface.world; w.setWanted?.(1); return w.debug.spawnSecurity('buggy', at); }, at);
    const before = await G(() => window.__app.surface.world.debug.security().map(s => ({ kind: s.kind, hp: s.hp, x: +s.x.toFixed(1), z: +s.z.toFixed(1) })));
    R.before = before;
    const shots0 = await G(() => window.__app.game.progress?.stats?.shots ?? window.__app.game.info?.shots ?? 0);
    await page.keyboard.down('ArrowUp'); await page.keyboard.down('KeyF'); await sleep(1600); await page.keyboard.up('KeyF'); await page.keyboard.up('ArrowUp');
    await sleep(500);
    const after = await G(() => window.__app.surface.world.debug.security().map(s => ({ kind: s.kind, hp: s.hp })));
    R.after = after;
    const hp0 = before.filter(s => s.kind === 'buggy').reduce((a, s) => a + s.hp, 0), hp1 = after.filter(s => s.kind === 'buggy').reduce((a, s) => a + s.hp, 0);
    ok('copHit', { hp0, hp1, n0: before.length, n1: after.length }, hp1 < hp0 || after.filter(s => s.kind === 'buggy').length < before.filter(s => s.kind === 'buggy').length);
    R.mouseStill = await G(() => !document.pointerLockElement);
    await page.screenshot({ path: '/tmp/autoaim.png' });
  } catch (e) { errors.push('TEST ' + e.message); }
  R.errors = errors; R.bad = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length || errors.length ? 1 : 0);
})();
