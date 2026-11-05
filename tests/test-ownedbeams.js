// Owned-place beams (mars/ownedbeams.js): dark green beams over every business you own + the Xen-7 Trading Post.
// Checks: post beam on a fresh save, no beam over unowned businesses or an unbought farm, buying a business (real buy) and the
// farm lights a beam live, the blue waypoint beam turns dark green on an owned place / the post and stays blue elsewhere,
// the empire threat beacon stays red, beams come back after a reload (from the save), no page errors.
// BASE=http://127.0.0.1:8897/ BR=webkit DEV=393x852 node tests/test-ownedbeams.js   (DEV=desktop -> 1280x800)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8897/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GREEN = 0x0b6b2a, BLUE = 0x3aa0ff;
(async () => {
  const b = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const m = /^(\d+)x(\d+)$/.exec(DEV); const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await b.newContext(m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] } } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160))); page.on('console', c => { if (/ownedbeams|wpbeam/i.test(c.text())) errs.push('console: ' + c.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [], ok = (k, v, c) => { R[k] = v; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const tag = `ownedbeams-${DEV}-${BR}`;
  const land = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1200);
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } try { window.SSX.control?.debug?.setTimes({ first: 9999, after: 9999 }); } catch (e) { } });
    await wait(() => !!window.SSX?.ownedbeams && !!window.SSX?.empire && !!window.SSX?.farm && !!window.SSX?.wpbeam, 30000); await sleep(800);
  };
  const st = () => G(() => window.SSX.ownedbeams.state());
  const wpCol = () => G(() => { const o = window.SSX.wpbeam.object(); return o ? o.children.find(c => c.name === 'wp-beam-col').material.uniforms.uCol.value.getHex() : null; });
  const until = async (f, want, ms = 8000) => { let v; for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(150)) { v = await f(); if (want(v)) break; } return v; }; // swiftshader desktop is slow: poll, don't guess
  const has = (s, id) => s.beams.some(x => x.name === 'owned-beam:' + id);
  try {
    await page.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 }); await land();
    await G(() => { window.SSX.empire.debug.reset(); window.SSX.farm.debug.reset(); const g = window.__app.game; g.progress.credits = 200000; g.save?.(); window.SSX.ownedbeams.refresh(); }); await sleep(800);
    const s0 = await st(); const props = await G(() => window.SSX.empire.props().filter(p => p.pos).map(p => ({ id: p.id, price: p.price, pos: p.pos, kind: p.kind })));
    ok('postOnly', s0, s0.onMars && s0.visible && s0.inScene && s0.color === GREEN && has(s0, 'post') && !has(s0, 'farm') && !s0.beams.some(x => /empire:/.test(x.name)) && props.length > 0);
    const pick = props.sort((a, b) => a.price - b.price)[0];
    const buy = await G(async id => { window.SSX.empire.debug.goto(id); await new Promise(r => setTimeout(r, 600)); const r = window.SSX.empire.buy(id); return { ok: r?.ok !== false, why: r?.why || null }; }, pick.id); await sleep(700);
    const s1 = await until(st, x => has(x, 'empire:' + pick.id)); const bm = s1.beams.find(x => x.name === 'owned-beam:empire:' + pick.id);
    ok('buyLightsLive', { buy, pick: pick.id, s1: s1.beams.length }, buy.ok && !!bm && Math.abs(bm.x - pick.pos.x) < 0.5 && Math.abs(bm.z - pick.pos.z) < 0.5);
    const other = props.find(p => p.id !== pick.id); ok('unownedNoBeam', other?.id, !!other && !has(s1, 'empire:' + other.id));
    const fb = await G(async () => { const F = window.SSX.farm, p = F.places().find(q => q.id === 'farm'); window.__app.surface.debugMove(p.x, p.z + 12, 0); await new Promise(r => setTimeout(r, 600)); const r = F.buy(); return r?.ok !== false ? true : r.why; }); await sleep(700);
    const sF = await until(st, x => has(x, 'farm')); ok('farmLightsLive', { fb, beams: sF.beams.map(x => x.name) }, fb === true && has(sF, 'farm'));
    // waypoint beam: green on the post and an owned business, blue on open ground
    const post = await G(() => window.SSX.farm.places().find(p => p.id === 'post'));
    const P = await G(() => { const i = window.__app.surface.info; return { x: i.x, z: i.z }; });
    await G(T => window.SSX.hudx.setWaypoint({ x: T.x + 90, z: T.z - 150, label: 'open' }, true), P); const cBlue = await until(wpCol, c => c === BLUE);
    await G(T => window.SSX.hudx.setWaypoint({ x: T.x, z: T.z, label: 'post' }, true), post); const cPost = await until(wpCol, c => c === GREEN);
    await G(T => window.SSX.hudx.setWaypoint({ x: T.x, z: T.z, label: 'mine' }, true), pick.pos); const cMine = await until(wpCol, c => c === GREEN);
    const oth = props.find(p => p.id !== pick.id && Math.hypot(p.pos.x - pick.pos.x, p.pos.z - pick.pos.z) > 30 && Math.hypot(p.pos.x - post.x, p.pos.z - post.z) > 30);
    await G(T => window.SSX.hudx.setWaypoint({ x: T.x, z: T.z, label: 'other' }, true), oth.pos); const cOther = await until(wpCol, c => c === BLUE);
    ok('waypointColours', { cBlue, cPost, cMine, cOther }, cBlue === BLUE && cPost === GREEN && cMine === GREEN && cOther === BLUE);
    await G(() => window.SSX.hudx.setWaypoint(null, true));
    // threat beacon stays red
    const red = await G(() => { let c = null; window.__app.surface.scene?.traverse?.(o => { if (c == null && o.isMesh && o.material?.opacity === 0.35 && o.geometry?.parameters?.height === 60 && o.material.color) c = o.material.color.getHex(); }); return c; });
    ok('threatStaysRed', red, red === null || red === 0xff2a2a);
    // screenshot from near the post looking at it
    await G(T => window.__app.surface.debugMove ? window.__app.surface.debugMove(T.x, T.z + 60, 0) : window.__app.surface.debugPlace(T.x, T.z + 60, 0), post); await sleep(1500);
    await page.screenshot({ path: `/workspace/pw-ben-green/${tag}.png` });
    // reload: from the save
    await G(() => window.__app.game.save?.()); await sleep(500);
    await page.goto(base + '?storm=0&t=' + Date.now(), { timeout: 180000 }); await land(); await sleep(1000);
    const s2 = await until(st, x => has(x, 'post') && has(x, 'farm') && has(x, 'empire:' + pick.id), 15000); ok('afterReload', s2.beams.map(x => x.name), has(s2, 'post') && has(s2, 'farm') && has(s2, 'empire:' + pick.id));
  } catch (e) { ok('crash', String(e).slice(0, 300), false); }
  ok('noErrors', errs, !errs.length);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag);
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
