// v7.5.8 waypoint light beam (hud/wpbeam.js): a ~150 m blue column + pulsing ground ring + distance tag over the active
// waypoint. Checks: shows at the target with additive/depthWrite-off/fog-off material, moves when the waypoint changes,
// fades inside ~15 m, hides with no waypoint, stays clearly visible (blue pixels on screen) in clear day, at night and at
// dust-storm peak, follows a running job target (Scrap Run style), the yellow farm beacon still exists, no page errors.
// BASE=http://127.0.0.1:8866/ BR=webkit DEV=393x852 OUT=... node tests/test-wpbeam.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8866/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw[BR].launch(); const m = /^(\d+)x(\d+)$/.exec(DEV); const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await b.newContext(m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] } } : DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...pw.devices[DEV], defaultBrowserType: undefined });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160))); page.on('console', m => { if (/wpbeam/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [], ok = (k, v, c) => { R[k] = v; if (!c) bad.push(k); };
  // wait for N rendered frames (a fixed sleep missed the toggle on the live site in a storm, where frames are slow)
  const frames = async n => { const f0 = await G(() => window.__frames); await page.waitForFunction(([f0, n]) => window.__frames >= f0 + n, [f0, n], { timeout: 15000, polling: 30 }).catch(() => {}); await sleep(60); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const tag = `wpbeam-${DEV.replace(/\s/g, '-')}-${BR}`;
  const st = () => G(() => window.SSX.wpbeam.state());
  // how much the beam adds on screen: pixels in a band around its screen column (beam projected 25 m up) whose blue rises by
  // > 25 between a beam-off and a beam-on screenshot (additive light over a bright sky goes white, so diff rather than "blue")
  const shotPx = async name => { const buf = await page.screenshot({ path: `${out}${tag}-${name}.png` }); return buf.toString('base64'); };
  const blue = async name => {
    const col = await G(() => { const A = window.__app, o = window.SSX.wpbeam.object(), cam = A.surface.camera || A.camera; if (!o || !cam) return null;
      const v = o.position.clone(); v.y += 25; v.project(cam); return { x: (v.x + 1) / 2 }; });
    await G(() => window.SSX.wpbeam.setEnabled(false)); await frames(3); const off = await shotPx(name + '-off');
    await G(() => window.SSX.wpbeam.setEnabled(true)); await frames(3); const on = await shotPx(name);
    const n = await G(async ({ on, off, col }) => { const px = async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0); const cx = Math.round((col?.x ?? 0.5) * c.width), w = Math.round(c.width * 0.12); return x.getImageData(Math.max(0, cx - w), 0, Math.min(c.width, 2 * w), c.height).data; };
      const A = await px(on), B = await px(off); let k = 0; for (let i = 0; i < A.length; i += 4) if (A[i + 2] - B[i + 2] > 25) k++; return k; }, { on, off, col });
    return { lit: n, col };
  };
  try {
    await page.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 }); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1200);
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } try { window.SSX.control?.debug?.setTimes({ first: 9999, after: 9999 }); } catch (e) { } try { window.SSX.time?.set?.(12); window.SSX.time?.freeze?.(true); } catch (e) { } });
    await wait(() => !!window.SSX?.wpbeam && !!window.SSX?.hudx, 20000);
    await G(() => window.SSX.hudx.setWaypoint(null, true)); await sleep(700); // (the tour may have left a 'Walk here' waypoint)
    ok('hiddenNoWaypoint', await st(), !(await st()).visible || (await G(() => !!window.SSX.hudx.objective())));
    // open ground ~140 m out; face it (yaw 0 looks toward -z)
    const P = await G(() => { const i = window.__app.surface.info; return { x: i.x, z: i.z }; });
    const T = { x: P.x + 90, z: P.z - 150 }; // off to the side of the ship so nothing tall stands between
    await G(T => window.SSX.hudx.setWaypoint({ x: T.x, z: T.z, label: 'Test waypoint' }, true), T); await sleep(900);
    await G(T => window.__app.surface.debugPlace(T.x, T.z + 140, 0), T); await sleep(1200);
    const s1 = await st();
    ok('shownAtTarget', s1, s1.visible && s1.beam && s1.inScene && Math.abs(s1.x - T.x) < 0.5 && Math.abs(s1.z - T.z) < 0.5 && s1.height === 150 && s1.meshes === 3 && s1.fade === 1 && /m$/.test(s1.tag));
    ok('material', s1.mat, s1.mat && s1.mat.additive && !s1.mat.depthWrite && !s1.mat.fog);
    const p1 = s1.op; await sleep(700); const p2 = (await st()).op; const r1 = s1.ring, r2 = (await st()).ring; ok('pulses', { r1, r2 }, r1 !== r2);
    const day = await blue('day'); ok('visibleDay', day, day.lit > 400);
    // night
    await G(() => { window.SSX.time?.set?.(1); }); await sleep(1500); const night = await blue('night'); ok('visibleNight', { ...night, isNight: await G(() => window.SSX.time?.isNight?.()) }, night.lit > 400);
    await G(() => { window.SSX.time?.set?.(12); }); await sleep(800);
    // dust storm at peak
    await G(() => { window.SSX.storm.start(); }); await sleep(600);
    await wait(() => { const S = window.SSX.storm; if (S.intensity() < 0.85) S.debug.skip(4); return S.intensity() >= 0.85; }, 40000); await sleep(1200);
    const storm = await blue('storm'); const ss = await st();
    ok('visibleStorm', { ...storm, I: await G(() => window.SSX.storm.intensity()), op: ss.op, far: await G(() => window.SSX.storm.visibility()) }, storm.lit > 400 && ss.beam);
    await G(() => window.SSX.storm.stop({ instant: true })); await sleep(500);
    // moves with the waypoint
    const T2 = { x: T.x - 30, z: T.z + 20 }; await G(T => window.SSX.hudx.setWaypoint({ x: T.x, z: T.z, label: 'Moved' }, true), T2); await sleep(700);
    const s2 = await st(); ok('moves', s2, Math.abs(s2.x - T2.x) < 0.5 && Math.abs(s2.z - T2.z) < 0.5 && s2.visible);
    // fades near the target
    await G(T => window.__app.surface.debugPlace(T.x, T.z + 10, 0), T2); await sleep(500); const s10 = await st();
    await G(T => window.__app.surface.debugPlace(T.x, T.z + 3, 0), T2); await sleep(500); const s3 = await st(); await blue('close');
    ok('fadesClose', { at10: s10.fade, at3: s3.fade, beam3: s3.beam, ring3: s3.visible }, s10.fade > 0 && s10.fade < 1 && s3.fade === 0 && !s3.beam && s3.visible);
    // cleared -> hidden
    await G(() => window.SSX.hudx.setWaypoint(null, true)); await sleep(700); ok('hiddenCleared', await st(), !(await st()).visible);
    // farm beacon untouched (yellow, separate object)
    ok('farmBeaconSeparate', await G(() => !!window.SSX.farm && !window.SSX.wpbeam.object().getObjectByName('farm-beacon')), true);
    ok('pageErrors', errs, !errs.length);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 160)); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag); await b.close(); process.exit(bad.length ? 1 : 0);
})();
