// v7.5.3 race gates test: every Mars race gate (presets + quest/city sprints) sits outside every dome/building footprint
// and can be reached by driving from the gate before it (grid search over world.collide); then a scripted drive along
// that route finishes Blue Lights (it used to stall at Gate 4/8: the gate was the centre of the Olympus Row dome).
// BASE=http://localhost:8777/ DEV=393x852 BR=webkit node tests/test-race-gates.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.SHOTS_DIR || process.env.OUT || '/tmp/race-gates/'; require('fs').mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 };
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
    // 1. every gate clear of footprints + reachable from the previous one (2 m grid, car radius 1.3)
    const rep = await G(() => {
      const B = (x, z, r) => window.__race.blocked(x, z, r), out = [];
      const route = (a, b) => { // BFS on a 2 m grid in a box around a -> b
        const S = 2, pad = 70, x0 = Math.min(a.x, b.x) - pad, z0 = Math.min(a.z, b.z) - pad, W = Math.ceil((Math.max(a.x, b.x) + pad - x0) / S), H = Math.ceil((Math.max(a.z, b.z) + pad - z0) / S);
        const ix = p => Math.round((p.x - x0) / S), iz = p => Math.round((p.z - z0) / S), prev = new Int32Array(W * H).fill(-2), q = [];
        const s0 = iz(a) * W + ix(a), goal = iz(b) * W + ix(b); prev[s0] = -1; q.push(s0);
        for (let h = 0; h < q.length; h++) { const c = q[h]; if (c === goal) break; const cx = c % W, cz = (c / W) | 0;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = cx + dx, nz = cz + dz, k = nz * W + nx;
            if (nx < 0 || nz < 0 || nx >= W || nz >= H || prev[k] !== -2) continue; if (k !== goal && B(x0 + nx * S, z0 + nz * S, 1.3)) continue; prev[k] = c; q.push(k); } }
        if (prev[goal] === -2) return null; const pts = []; for (let c = goal; c !== -1; c = prev[c]) pts.push({ x: x0 + (c % W) * S, z: z0 + ((c / W) | 0) * S }); return pts.reverse();
      };
      for (const t of window.__race.tracks()) {
        const g = t.gates, n = g.length, inside = [], unreach = [], moved = [], routes = [];
        g.forEach((p, i) => { if (B(p.x, p.z, 2)) inside.push(i + 1); if (p.moved) moved.push(`${i + 1}:(${p.moved.x.toFixed(1)},${p.moved.z.toFixed(1)})->(${p.x.toFixed(1)},${p.z.toFixed(1)})`); });
        for (let i = t.loop ? 0 : 1; i < n; i++) { const a = g[(i - 1 + n) % n], r = route(a, g[i]); if (!r) unreach.push(i + 1); routes.push(r); }
        out.push({ id: t.id, n, inside, unreach, moved, routes: t.id === 'q-vale-03-beltway' ? routes : undefined, gates: g.map(p => [+p.x.toFixed(1), +p.z.toFixed(1)]) });
      }
      return out;
    });
    for (const t of rep) { ok(`gates-clear:${t.id}`, t.inside.join(',') || 'ok', !t.inside.length); ok(`gates-reachable:${t.id}`, t.unreach.join(',') || 'ok', !t.unreach.length); if (t.moved.length) R[`moved:${t.id}`] = t.moved.join(' '); }
    const bl = rep.find(t => t.id === 'q-vale-03-beltway'); ok('blueLightsListed', !!bl); R.blueLightsGates = JSON.stringify(bl?.gates);
    // 2. scripted drive: start Blue Lights, then follow the grid route gate to gate in ~2 m steps
    const st = await G(() => window.__race.start('q-vale-03-beltway', { noRival: true })); ok('start', st.ok, st.ok);
    await G(() => window.__race.skipCountdown()); await wait(() => window.__race.state?.phase === 'run', 8000);
    let lit = true;
    // through gate 1 from the grid (sprints start behind it)
    await G(() => { const g = window.__race.tracks().find(t => t.id === 'q-vale-03-beltway').gates[0], fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); window.__race.place(g.x - fx * 4, g.z - fz * 4, g.yaw); });
    await sleep(80); await G(() => { const g = window.__race.tracks().find(t => t.id === 'q-vale-03-beltway').gates[0], fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); window.__race.place(g.x + fx * 4, g.z + fz * 4, g.yaw); }); await sleep(120);
    const g1 = await wait(() => window.__race.state?.next === 1, 5000); ok('gate1', await G(() => window.__race.state?.next), g1);
    for (let i = 0; i < (bl?.routes || []).length; i++) {
      const pts = bl.routes[i]; if (!pts) break;
      for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k];
        await G(([x, z, yaw]) => new Promise(r => { window.__race.place(x, z, yaw); requestAnimationFrame(() => requestAnimationFrame(r)); }), [b.x, b.z, Math.atan2(-(b.x - a.x), -(b.z - a.z))]); }
      await sleep(60); const s = await G(() => window.__race.state || window.__race.result);
      if (s && s.next !== undefined && s.next !== i + 2 && s.phase === 'run') { lit = false; R.driveStuck = `after route ${i + 1}: next=${s.next}`; break; }
    }
    const res = await G(() => window.__race.result), still = await G(() => !!window.__race.state); ok('blueLightsFinished', res ? JSON.stringify({ won: res.won, place: res.place, ms: res.ms }) : 'no result', !!res && !still);
    ok('nextGateAdvanced', lit);
    await page.screenshot({ path: `${out}race-gates-${tag}.png` });
  } catch (e) { bad.push('exception'); R.err = String(e.stack || e).slice(0, 400); }
  ok('noPageErrors', errors.join(' | ') || 'none', !errors.length);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
