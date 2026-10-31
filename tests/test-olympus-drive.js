// v7.5.16 (Collin: "At Olympus Row my vehicles get stuck all the time"). Desktop Chromium, real key presses in the rover:
//  glance  - hit the plaza dome ~30 deg off its surface: the car slides along it and keeps going (it used to dead-stop + bounce)
//  wall    - drive head-on into the dome and keep the throttle down: auto-unstick frees it within ~2 s
//  prop    - a small street prop (bench / bin / barrel) in the way does not stop a vehicle
//  sweep   - 8 runs at the district from all sides with the throttle down and the stick wiggling: no stall longer than 2.5 s
// BASE=http://127.0.0.1:8977/ node tests/test-olympus-drive.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8889/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const pos = () => G(() => { const i = window.__app.surface.info; return { x: i.x, z: i.z, un: i.stunts?.unstuck || 0 }; });
  const place = (x, z, yaw) => G(([x, z, yaw]) => window.__app.surface.debugMove(x, z, yaw), [x, z, yaw]);
  // hold throttle for ms, sample every 100 ms; longest stretch the car moved < 0.5 m from where it stalled
  const drive = async (ms, wiggle) => {
    const t0 = Date.now(); let a = await pos(), at = Date.now(), stall = 0, path = 0, last = a; const s0 = a.un;
    await page.keyboard.down('ArrowUp');
    while (Date.now() - t0 < ms) {
      if (wiggle) { const ph = Math.floor((Date.now() - t0) / 700) % 4; if (ph === 1) await page.keyboard.down('ArrowLeft'); else await page.keyboard.up('ArrowLeft'); if (ph === 3) await page.keyboard.down('ArrowRight'); else await page.keyboard.up('ArrowRight'); }
      await sleep(100); const p = await pos(); path += Math.hypot(p.x - last.x, p.z - last.z); last = p;
      if (Math.hypot(p.x - a.x, p.z - a.z) > 0.5) { a = p; at = Date.now(); } else stall = Math.max(stall, Date.now() - at);
    }
    await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight'); await sleep(250);
    return { stall, path: +path.toFixed(1), unstuck: last.un - s0 };
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); }); await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    await G(() => { document.getElementById('radioLater')?.click(); window.__app.game.debug?.calm?.(true); window.__app.game.setAliens?.(false); });
    const O = await G(() => { const c = window.__app.surface.info.colony; return { x: c.x, z: c.z - 430 }; }); // Olympus Row centre (AJ [0,-430])
    await G(O => window.__app.surface.debugMove(O.x + 90, O.z + 90), O); await sleep(500);
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); });
    ok('driving', await wait(() => window.__app.surface.info.driving, 15000));
    await page.mouse.move(10, 10);
    // the plaza dome: radius by probing the collider out from the centre
    const dome = await G(O => { const W = window.__app.surface.world; if (!W.collide(O.x, O.z, 0.1)) return null; let r = 0; while (r < 60 && W.collide(O.x, O.z + r, 0.1)) r += 0.25; return r; }, O);
    R.domeR = dome;
    if (dome) {
      // glance: south of the dome, heading 30 deg into it (forward = (-sin yaw, -cos yaw)), start 7 m out
      const g0 = { x: O.x - 14, z: O.z + dome + 3.2 }; await place(g0.x, g0.z, -Math.PI / 2 + 0.52); await sleep(300);
      const g = await drive(3000); ok('glance', g, g.path > 18 && g.stall < 1200);
      // wall: head-on into the dome from the south, throttle held 4 s
      await place(O.x, O.z + dome + 4, 0); await sleep(300);
      const w = await drive(4500); ok('wallUnstick', w, w.unstuck >= 1 && w.stall < 2400);
    } else ok('dome', false);
    // prop: the smallest street / add-on collider within 400 m of the colony that has open ground around it
    const prop = await G(() => { const A = window.SSX?.colliders, W = window.__app.surface.world, c = window.__app.surface.info.colony; if (!A) return null;
      const L = A.list().filter(s => (s.type === 'cyl' ? s.r <= 0.8 : Math.max(s.hx, s.hz) <= 1.2 && Math.min(s.hx, s.hz) <= 0.8) && Math.hypot(s.x - c.x, s.z - c.z) < 700);
      for (const s of L) { let free = true; for (let d = 3; d <= 12 && free; d += 1.5) if (W.collide(s.x, s.z + d, 2.2) || W.collide(s.x, s.z - d, 2.2)) free = false; if (free) return { ...s, n: L.length }; }
      return { none: true, n: L.length }; });
    R.prop = prop;
    if (prop && !prop.none) {
      await place(prop.x, prop.z + 10, 0); await sleep(300); // heading -z, straight through the prop
      const p = await drive(2200); const end = await pos(); ok('propPass', { ...p, endZ: +(end.z - prop.z).toFixed(1) }, end.z < prop.z - 2);
    } else R.propSkip = 'no small prop loaded near the colony';
    // sweep
    const runs = []; for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4, x = O.x + Math.sin(an) * 75, z = O.z + Math.cos(an) * 75;
      await place(x, z, an); await sleep(300); // yaw an faces the centre
      runs.push(await drive(5000, true)); }
    R.sweep = runs; const ms = Math.max(...runs.map(r => r.stall)); ok('sweepMaxStall', ms, ms <= 2500);
  } catch (e) { errors.push('TEST ' + e.message); }
  R.errors = errors; R.bad = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length || errors.length ? 1 : 0);
})();
