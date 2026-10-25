// v7.3 track builder test: open from the ☰ menu, tap to drop gates, drag to move, tap+delete, undo, props (ramp +
// turn), one-finger pan, two-finger pinch zoom (synthetic pointers everywhere, real CDP touches on Chromium), laps
// toggle, save with a name, race your own track, edit/remix/delete from the race list, presets, persistence across a
// reload, desktop keys. BASE=http://localhost:8777/ DEV="iPhone 14" BR=webkit node tests/test-builder.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/workspace/race-shots/', PFX = process.env.PFX || 'builder';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// place the car, then let the game run a few frames (slow software GL can drop below 10 fps)
const PLACE = ([x, z, y]) => new Promise(r => { window.__race.place(x, z, y); let n = 0; const f = () => (++n >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  // DEV: a Playwright device name, 'desktop', or WxH (an iPhone-like touch phone at that CSS viewport, e.g. 393x852)
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const vis = sel => G(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
  const center = sel => G(s => { const e = document.querySelector(s); e.scrollIntoView?.({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapXY = async (x, y) => { if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await sleep(120); };
  const tapAt = async sel => { const c = await center(sel); await tapXY(c.x, c.y); };
  // ☰: on desktop Chromium a mouse click on #menuBtn doesn't open the menu on main either (pre-existing; noted in the PR) -> fall back to toggleMenu
  const openMenu = async () => { await tapAt('#menuBtn'); await sleep(250); if (!(await G(() => document.getElementById('roverMenu').classList.contains('show')))) { R.menuClickFallback = true; await G(() => window.__app.toggleMenu(true)); await sleep(150); } };
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800); };
  const B = () => G(() => { const b = window.__race.builder; return b && { open: b.open, gates: b.draft.gates.map(g => ({ ...g })), props: b.draft.props.map(p => ({ ...p })), sel: b.sel, focus: b.focus, name: b.draft.name, loop: b.draft.loop, laps: b.draft.laps, id: b.draft.id, saved: b.saved }; });
  const scr = (x, z, yo = 0) => G(([x, z, yo]) => window.__race.builder.screenOf(x, z, yo), [x, z, yo]);
  // synthetic pointer gesture on the overlay: paths = [[{x,y},...], ...] one per finger, played in lockstep
  const gesture = (paths, type = 'touch') => G(async ([paths, type]) => {
    const el = document.getElementById('tbOverlay'), f = (k, i, p) => el.dispatchEvent(new PointerEvent(k, { pointerId: 70 + i, pointerType: type, isPrimary: i === 0, bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, buttons: k === 'pointerup' ? 0 : 1 }));
    paths.forEach((p, i) => f('pointerdown', i, p[0]));
    for (let s = 1; s < paths[0].length; s++) { paths.forEach((p, i) => f('pointermove', i, p[s])); await new Promise(r => requestAnimationFrame(r)); }
    paths.forEach((p, i) => f('pointerup', i, p[p.length - 1]));
  }, [paths, type]);
  const line = (a, b, n = 8) => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }));
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => Object.keys(localStorage).filter(k => k.startsWith('ssx.race.')).forEach(k => localStorage.removeItem(k)));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land();
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.debug.credits(300); window.__race.reload(); s.debugMove(-150, 60, 0); }); await sleep(1200);
    // ---------- open from the menu ----------
    await openMenu(); await tapAt('#rmBuilder');
    ok('opened', null, await wait(() => window.__race.builder?.open && document.getElementById('tbOverlay').classList.contains('on'), 4000));
    ok('hudHidden', null, !(await vis('#surfHud')) && !(await vis('#joy')));
    const W = await G(() => innerWidth), H = await G(() => innerHeight);
    const bar = await G(() => document.getElementById('tbBar').getBoundingClientRect().top), top = await G(() => document.getElementById('tbTop').getBoundingClientRect().bottom);
    ok('toolbarCompact', `${Math.round(top)}..${Math.round(bar)} of ${H}`, bar > H * 0.68 && top < H * 0.16);
    await sleep(600);
    // ---------- tap to drop 4 gates (a diamond) ----------
    const pts = [{ x: W * 0.5, y: H * 0.58 }, { x: W * 0.82, y: H * 0.42 }, { x: W * 0.5, y: H * 0.24 }, { x: W * 0.18, y: H * 0.42 }];
    for (const p of pts) await tapXY(p.x, p.y);
    let b = await B(); ok('gatesPlaced', b.gates.length, b.gates.length === 4);
    const spread = Math.min(...b.gates.map((g, i) => Math.hypot(g.x - b.gates[(i + 1) % 4].x, g.z - b.gates[(i + 1) % 4].z)));
    ok('gateSpacing', Math.round(spread), spread > 15);
    ok('raceEnabled', null, !(await G(() => document.querySelector('#tbBar [data-act=race]').disabled)));
    await sleep(300); await shot('placed');
    // ---------- drag gate 2 outwards ----------
    const g1 = b.gates[1], s1 = await scr(g1.x, g1.z, 0);
    await gesture([line(s1, { x: s1.x + 0, y: s1.y + 60 })]); await sleep(150);
    b = await B(); const moved = Math.hypot(b.gates[1].x - g1.x, b.gates[1].z - g1.z);
    ok('dragMoves', Math.round(moved), moved > 6 && b.gates.length === 4);
    // ---------- tap a gate, delete, undo ----------
    const g3 = b.gates[3], s3 = await scr(g3.x, g3.z, 0); await tapXY(s3.x, s3.y);
    b = await B(); ok('selectGate', JSON.stringify(b.sel), b.sel?.kind === 'gate' && b.sel.i === 3 && b.gates.length === 4);
    await tapAt('#tbBar [data-act=del]'); b = await B(); ok('deleteGate', b.gates.length, b.gates.length === 3 && !b.sel);
    await tapAt('#tbBar [data-act=undo]'); b = await B(); ok('undo', b.gates.length, b.gates.length === 4);
    // ---------- props: ramp + turn, barrier ----------
    await tapAt('#tbBar [data-tool=ramp]'); await tapXY(W * 0.5, H * 0.42);
    b = await B(); ok('rampPlaced', JSON.stringify(b.props), b.props.length === 1 && b.props[0].t === 'ramp' && b.sel?.kind === 'prop');
    const y0 = b.props[0].yaw; await tapAt('#tbBar [data-act=rot]'); b = await B();
    ok('rampTurned', null, Math.abs(Math.atan2(Math.sin(b.props[0].yaw - y0 - Math.PI / 4), Math.cos(b.props[0].yaw - y0 - Math.PI / 4))) < 0.01);
    await tapAt('#tbBar [data-tool=barrier]'); await tapXY(W * 0.62, H * 0.5); b = await B(); ok('barrierPlaced', null, b.props.length === 2 && b.props[1].t === 'barrier');
    await tapAt('#tbBar [data-tool=gate]');
    // ---------- one-finger pan + pinch ----------
    const f0 = b.focus; await gesture([line({ x: W * 0.3, y: H * 0.64 }, { x: W * 0.3 + 80, y: H * 0.64 - 10 })]); await sleep(100);
    b = await B(); ok('pan', null, Math.hypot(b.focus.x - f0.x, b.focus.z - f0.z) > 5 && b.gates.length === 4 && b.props.length === 2);
    const a0 = b.focus.alt;
    await gesture([line({ x: W * 0.45, y: H * 0.5 }, { x: W * 0.3, y: H * 0.5 }), line({ x: W * 0.55, y: H * 0.5 }, { x: W * 0.7, y: H * 0.5 })]); await sleep(100);
    b = await B(); ok('pinchZoomIn', `${Math.round(a0)}->${Math.round(b.focus.alt)}`, b.focus.alt < a0 * 0.7 && b.gates.length === 4);
    if (BR === 'chromium' && touch) { // real multi-touch pinch out
      const cdp = await ctx.newCDPSession(page); const T = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p });
      const a1 = b.focus.alt, cx = W / 2, cy = H * 0.48;
      await T('touchStart', [{ x: cx - 90, y: cy, id: 1 }]); await sleep(40); await T('touchStart', [{ x: cx - 90, y: cy, id: 1 }, { x: cx + 90, y: cy, id: 2 }]); await sleep(40);
      for (let k = 1; k <= 6; k++) { await T('touchMove', [{ x: cx - 90 + k * 12, y: cy, id: 1 }, { x: cx + 90 - k * 12, y: cy, id: 2 }]); await sleep(30); }
      await T('touchEnd', [{ x: cx - 18, y: cy, id: 1 }]); await sleep(30); await T('touchEnd', []); await sleep(100);
      b = await B(); ok('cdpPinchOut', `${Math.round(a1)}->${Math.round(b.focus.alt)}`, b.focus.alt > a1 * 1.3 && b.gates.length === 4 && b.props.length === 2);
    }
    // ---------- laps + save with a name ----------
    await tapAt('#tbBar [data-act=laps]'); b = await B(); ok('lapsCycle', b.laps, b.loop && b.laps === 3);
    await tapAt('#tbBar [data-act=save]'); ok('saveSheet', null, await vis('#tbName'));
    await page.fill('#tbName', 'Thumb Test'); await tapAt('#tbSheet [data-s=save]'); await sleep(200);
    const stored = await G(() => JSON.parse(localStorage.getItem('ssx.race.v1')).tracks);
    ok('saved', JSON.stringify(stored.map(t => [t.name, t.gates.length, t.props.length, t.laps])), stored.length === 1 && stored[0].name === 'Thumb Test' && stored[0].gates.length === 4 && stored[0].props.length === 2 && stored[0].laps === 3 && stored[0].world === 'Mars');
    await shot('saved');
    // ---------- race it ----------
    const myId = stored[0].id; await tapAt('#tbBar [data-act=race]');
    ok('raceFromBuilder', null, await wait(i => window.__race.state?.id === i && !window.__race.builder.open && window.__app.surface.info.driving, 6000, myId));
    ok('hudBack', null, (await vis('#surfHud')) && !(await G(() => document.body.classList.contains('tb-on'))));
    await G(() => window.__race.skipCountdown()); await wait(() => window.__race.state?.phase === 'run', 3000);
    const t = (await G(() => window.__race.tracks())).find(x => x.id === myId);
    const thru = async g => { const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); for (const k of [-5, 5]) { await G(PLACE, [g.x + fx * k, g.z + fz * k, g.yaw]); await sleep(40); } };
    for (let l = 0; l < 3; l++) for (let i = 1; i <= t.gates.length; i++) await thru(t.gates[i % t.gates.length]);
    ok('customFinished', null, await wait(() => window.__race.result?.done, 6000));
    R.customResult = JSON.stringify(await G(() => window.__race.result || window.__race.state)); R.customTrack = JSON.stringify(t);
    await shot('custom-race');
    // ---------- race list: edit + remix preset ----------
    await G(() => window.__race.openPanel()); await sleep(200);
    ok('listedCustom', null, await G(i => !!document.querySelector(`#racePanel [data-edit="${i}"]`) && !!document.querySelector(`#racePanel [data-del="${i}"]`), myId));
    await tapAt(`#racePanel [data-edit="${myId}"]`); await sleep(300);
    b = await B(); R.editB = JSON.stringify({ open: b.open, id: b.id, n: b.gates.length, name: b.name, panel: await G(() => document.getElementById('racePanel').className) }); ok('editOpens', null, b.open && b.id === myId && b.gates.length === 4 && b.name === 'Thumb Test');
    await tapAt('#tbBar [data-act=load]'); await sleep(200);
    ok('loadSheetPresets', null, await G(() => /Rust Belt Loop/.test(document.getElementById('tbSheet').innerText) && /Thumb Test/.test(document.getElementById('tbSheet').innerText)));
    await tapAt('#tbSheet [data-id="mars-rustbelt"]'); await sleep(400);
    b = await B(); ok('remixPreset', `${b.name} ${b.gates.length}`, b.gates.length === 9 && /Rust Belt Loop remix/.test(b.name) && b.id !== myId && b.id !== 'mars-rustbelt');
    await shot('remix');
    await tapAt('#tbBar [data-act=save]'); await tapAt('#tbSheet [data-s=save]'); await sleep(150);
    ok('twoSaved', null, await G(() => JSON.parse(localStorage.getItem('ssx.race.v1')).tracks.length === 2));
    // empty-track race is blocked
    await tapAt('#tbBar [data-act=load]'); await tapAt('#tbSheet [data-s=new]'); b = await B();
    ok('newTrack', null, b.gates.length === 0 && (await G(() => document.querySelector('#tbBar [data-act=race]').disabled)));
    // desktop keys: pan, and the game doesn't get them
    if (!touch) {
      const f1 = (await B()).focus, p0 = await G(() => ({ x: window.__app.surface.info.carX ?? 0 }));
      await page.keyboard.down('KeyD'); await sleep(400); await page.keyboard.up('KeyD');
      ok('keysPan', null, (await B()).focus.x > f1.x + 3);
      await page.keyboard.press('Escape'); ok('escCloses', null, await wait(() => !window.__race.builder.open, 2000));
    } else { await tapAt('#tbBar [data-act=exit]'); ok('exitCloses', null, await wait(() => !window.__race.builder.open && getComputedStyle(document.getElementById('surfHud')).display !== 'none', 2000)); }
    // perf: frames while the builder shows a 9-gate track
    await G(() => window.__race.openBuilder('mars-rustbelt', true)); await sleep(500);
    const fr0 = await G(() => window.__frames); await sleep(2000); const fr1 = await G(() => window.__frames);
    R.builderFps = Math.round((fr1 - fr0) / 2); await G(() => window.__race.builder.close(true));
    // ---------- delete from the race list (two taps) ----------
    await G(() => window.__race.openPanel()); await sleep(200);
    await tapAt(`#racePanel [data-del="${myId}"]`); await sleep(100); await tapAt(`#racePanel [data-del="${myId}"]`); await sleep(200);
    ok('deleted', null, await G(i => !JSON.parse(localStorage.getItem('ssx.race.v1')).tracks.some(t => t.id === i) && !localStorage.getItem('ssx.race.ghost.' + i), myId));
    await G(() => window.__race.closePanel());
    // ---------- persists across reload ----------
    await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land();
    ok('persisted', null, await G(() => window.__race.tracks().filter(t => t.custom).length === 1 && window.__race.counts().idle >= 4));
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  R.errors = errors.slice(0, 5); ok('noConsoleErrors', null, errors.length === 0);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
