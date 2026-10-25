// Multi-planet expansion: play every new mission start-to-finish with the debug teleport hooks (same as a player would,
// minus the driving): goto/collect/race by debugQuestGo, Take a real parked ride, lose the heat, and only skip combat waves.
// Also checks every on-foot objective and race gate on Titan is on dry ground (methane seas) and that rewards + paints land.
// BASE=http://localhost:8781/ DEV="iPhone 14" BR=webkit node test-planet-missions.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8781/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
const ONLY = process.env.WORLDS ? process.env.WORLDS.split(',') : null;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...d } = devices[DEV];
  const page = await (await browser.newContext(d)).newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const land = async w => { await G(() => { const a = window.__app; if (a.state.onSurface) a.takeOff(); }); await wait(() => !window.__app.state.onSurface && !window.__app.state.transitioning, 20000);
    await G(w => window.__app.landOn(window.__app.bodies.find(b => b.name === w).mesh), w);
    await wait(w => { const s = window.__app.state; return s.onSurface && !s.transitioning && s.info?.name === w && window.__app.surface.info?.intro === 0; }, 120000, w); await sleep(1200); };
  const unpicked = () => G(() => window.__app.game.debug.items().filter(i => !i.collect && !i.pick).length);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { ['ssx.game.v1', 'ssx.planets.v1'].forEach(k => localStorage.removeItem(k)); });
    // every mission the expansion registers (referrals on Mars/Moon + each colony's jobs), plus the stock ones on the new worlds
    const plan = await G(() => { const a = window.__app, byW = {};
      for (const [w, ids] of Object.entries(a.planets.quests)) byW[w] = [...ids];
      for (const w of a.planets.list) for (const q of a.game.questList(w)) if (!byW[w].includes(q.id)) byW[w].push(q.id);
      return byW; });
    R.plan = Object.entries(plan).map(([w, q]) => `${w}:${q.length}`).join(' ');
    for (const [w, ids] of Object.entries(plan)) {
      if (ONLY && !ONLY.includes(w)) continue;
      await land(w);
      for (const id of ids) {
        await G(() => { const a = window.__app; a.game.debug.clear(); a.surface.world.setWanted(0); if (a.surface.info.driving) a.surface.interact(); });
        await G(() => { const c = window.__app.surface.info.colony; if (c) window.__app.surface.debugMove(c.x, c.z + 6, 0); });
        const cr0 = await G(() => window.__app.game.progress.credits);
        const acc = await G(id => window.__app.game.accept(id), id);
        let steps = [], dry = true, guard = 0;
        while (guard++ < 40) {
          const q = await G(() => window.__app.game.debug.quest()); if (!q || q.id !== id) break;
          const s = await G(() => window.__app.game.debug.step()); if (!s) break;
          steps.push(s.type);
          const n0 = await unpicked();
          if (s.type === 'take') {
            await G(() => { const a = window.__app, i = a.surface.info, v = a.surface.world.debug.vehicles().filter(v => v.parked).sort((p, q) => Math.hypot(p.x - i.x, p.z - i.z) - Math.hypot(q.x - i.x, q.z - i.z))[0]; a.surface.debugMove(v.x + 3.2, v.z + 1, 0); });
            await wait(() => window.__app.surface.info.nearVehicle, 8000); await G(() => window.__app.surface.interact());
          } else if (s.type === 'clean') {
            await G(() => window.__app.surface.world.setWanted(0));
          } else if (s.type === 'defeat') {
            await G(() => window.__app.surface.debugQuestGo(10)); await sleep(800); await G(() => { window.__app.game.debug.advance(); window.__app.game.debug.clear(); });
          } else {
            await G(() => window.__app.surface.debugQuestGo(0.5)); await sleep(350);
            const y = await G(() => { const i = window.__app.surface.info; return i.driving ? null : i.y - 1.7; });
            if (y !== null && w === 'Titan' && y < -0.7) dry = false;
          }
          await wait(sv => { const q = window.__app.game.debug.quest(); return !q || q.step !== sv.step || q.gi !== sv.gi || window.__app.game.debug.items().filter(i => !i.collect && !i.pick).length !== sv.n; }, 5000, { step: q.step, gi: q.gi, n: n0 });
        }
        const done = await G(id => !!window.__app.game.progress.quests[id]?.everDone, id), cr = await G(() => window.__app.game.progress.credits);
        ok(id, `${steps.join('>')}${dry ? '' : ' WET'} +${cr - cr0}cr`, acc && done && dry && cr > cr0);
      }
    }
    const un = await G(() => window.__app.game.progress.unlocks.join());
    ok('paints', un, !!ONLY || ['paint:acid', 'paint:mirror', 'paint:kraken', 'paint:glacier', 'paint:sulfur', 'bandana:convict'].every(u => un.includes(u)));
    const per = await G(() => window.__app.planets.list.filter(w => window.__app.planets.unlocked(w)).join());
    ok('permits', per, !!ONLY || per.split(',').length === 5);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.filter(e => !/favicon|404/.test(e)).slice(0, 8); if (R.errors.length) bad.push('errors');
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
