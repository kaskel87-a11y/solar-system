// v7.5.4 Blue Lights P2 test (Collin: "Blue Lights P2 · Sprint · Gate 4/8", stuck again on v7.5.3.1). Drives the sprint WITH the
// rival (so you're running P2 behind Detective Vale) using real car physics, like a player following the arrow: hold throttle,
// point the nose at the next gate, back up and swing when the car hits something. v7.5.3.1's gate 4 sat in a pocket between two
// domes behind a building, so this driver piled into the wall at Gate 4/8; now every gate has a straight drivable run.
// Also: every moved gate has its whole 14 m opening clear and a clear lane from the gate before and to the gate after.
// BASE=http://localhost:8777/ DEV=393x852 BR=webkit node tests/test-race-p2.js   (DEV=375x667 | desktop, BR=chromium)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.SHOTS_DIR || process.env.OUT || '/tmp/race-p2/'; require('fs').mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR, ID = 'q-vale-03-beltway';
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 };
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => Object.keys(localStorage).filter(k => k.startsWith('ssx.race.')).forEach(k => localStorage.removeItem(k)));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800);
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.debug.credits(500); window.__race.reload(); });
    // 1. placement: moved gates have the full opening clear and straight lanes to their neighbours (car radius 2.5 m)
    const pl = await G(id => { const t = window.__race.tracks().find(q => q.id === id), g = t.gates, B = (x, z, r) => window.__race.blocked(x, z, r);
      const lane = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 2)); for (let i = 1; i < n; i++) { const k = i / n; if (B(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, 2.5)) return false; } return true; };
      const moved = [], room = [], lanes = [];
      g.forEach((p, i) => { if (!p.moved) return; moved.push(i + 1); if (B(p.x, p.z, 7)) room.push(i + 1); if (i > 0 && !lane(g[i - 1], p)) lanes.push(`${i}->${i + 1}`); if (i < g.length - 1 && !lane(p, g[i + 1])) lanes.push(`${i + 1}->${i + 2}`); });
      return { gates: g.map(p => [+p.x.toFixed(1), +p.z.toFixed(1)]), moved, room, lanes, g4: g[3] }; }, ID);
    R.gates = JSON.stringify(pl.gates); R.moved = pl.moved.join(',');
    ok('movedGatesRoomy', pl.room.join(',') || 'ok', !pl.room.length); ok('movedGatesLanesClear', pl.lanes.join(' ') || 'ok', !pl.lanes.length);
    ok('gate4Moved', pl.moved.includes(4));
    // 2. the P2 drive: rival on, real physics, follow the arrow
    const st = await G(id => window.__race.start(id, {}), ID); ok('start', st.ok, st.ok);
    await G(() => window.__race.skipCountdown()); ok('running', await wait(() => window.__race.state?.phase === 'run', 8000));
    await G(() => { window.__p2turn = 0; });
    await page.keyboard.down('KeyW');
    const t0 = Date.now(); let last = -1, lastT = Date.now(), slow = 0, reverses = 0, sawP2 = false, npcMax = 0, npcCap = 12; const log = [];
    while (Date.now() - t0 < 420000) {
      const s = await G(() => { const W = window.__app.surface.world, b = W.npcBudget ? W.npcBudget() : null; return { st: window.__race.state, car: window.__race.car(), chip: document.getElementById('raceChip')?.textContent || '', npc: b ? b.used : 0, cap: b ? b.cap : 12 }; });
      if (!s.st) break;
      if (/P2/.test(s.chip)) sawP2 = true; npcMax = Math.max(npcMax, +s.npc || 0); npcCap = s.cap;
      if (s.st.next !== last) { last = s.st.next; lastT = Date.now(); log.push(`gate ${s.st.next + 1} t=${s.st.time.toFixed(1)}`); }
      if (Date.now() - lastT > 75000) { R.stuckAt = `Gate ${s.st.next + 1}/8 car (${s.car?.x.toFixed(1)},${s.car?.z.toFixed(1)})`; await page.screenshot({ path: `${out}race-p2-STUCK-${tag}.png` }); break; }
      slow = s.car && Math.abs(s.car.speed) < 1.2 ? slow + 1 : 0;
      if (slow > 25) { slow = 0; reverses++; await page.keyboard.up('KeyW'); await G(() => { window.__p2turn = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random()); }); await page.keyboard.down('KeyS'); await sleep(900); await page.keyboard.up('KeyS'); await page.keyboard.down('KeyW'); await sleep(1200); await G(() => { window.__p2turn = 0; }); }
      await G(([id, n]) => { const g = window.__race.tracks().find(q => q.id === id).gates[n], c = window.__race.car(); if (!c || !g) return;
        window.__race.place(c.x, c.z, Math.atan2(-(g.x - c.x), -(g.z - c.z)) + (window.__p2turn || 0)); if (c.speed > 11) window.__race.setCarSpeed(11); }, [ID, last]);
      await sleep(40);
    }
    await page.keyboard.up('KeyW');
    const res = await G(() => window.__race.result);
    R.log = log.join(' | '); R.reverses = reverses; ok('sawP2Chip', sawP2);
    ok('blueLightsFinished', res ? JSON.stringify({ done: res.done, won: res.won, time: res.time, line: res.line }) : 'no result', !!res && (res.done || /Wrecked/.test(res.line || '')));
    ok('passedGate4', log.some(l => l.startsWith('gate 5')));
    ok('fewBumps', reverses, reverses <= 4);
    ok('npcsWithinCap', `${npcMax}/${DEV === 'desktop' ? npcCap : 12}`, npcMax <= (DEV === 'desktop' ? npcCap : 12));
    await sleep(300); await page.screenshot({ path: `${out}race-p2-${tag}.png` });
  } catch (e) { bad.push('exception'); R.err = String(e.stack || e).slice(0, 400); }
  ok('noPageErrors', errors.join(' | ') || 'none', !errors.length);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
