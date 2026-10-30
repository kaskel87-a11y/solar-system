// Walks EVERY mission step on every world (story, city, side jobs, add-on missions) and fails if a step's target has no marker:
// place steps need the ◆ waypoint (door found for enter/crack), defeat steps a red ◆ + minimap dot on every foe, collect steps
// their items, race steps the gate. Every step must also get a Stuck? hint. Steps with nothing on the map (clean / choice) are skipped.
// BASE=http://127.0.0.1:8995/ BR=chromium WORLDS=Mars,Moon node tests/test-mission-markers.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8995/', BR = process.env.BR || 'chromium';
const WORLDS = (process.env.WORLDS || 'Mars,Moon,Mercury,Venus,Europa,Io,Titan,Earth').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), bad = [], seen = { steps: 0, checked: 0, none: 0, quests: 0, worlds: [] };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.game?.reload?.());
    for (const W of WORLDS) {
      const body = await G(W => !!window.__app.bodies.find(b => b.name === W), W); if (!body) { console.log('skip world (no body)', W); continue; }
      if (await G(() => window.__app.state.onSurface)) { await G(() => window.__app.surface.debugMove?.(0, 0, 0)); await G(() => window.__app.takeOff()); await wait(() => !window.__app.state.onSurface && !window.__app.state.transitioning, 120000); await sleep(500); }
      await G(W => window.__app.landOn(window.__app.bodies.find(b => b.name === W).mesh), W);
      const landed = await wait(W => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && window.__app.surface.info?.name === W, 240000, W);
      if (!landed) { bad.push(`${W}: could not land`); console.log('FAIL land', W); continue; }
      await sleep(1200); await G(() => { document.getElementById('radioLater')?.click(); window.__app.game.setAliens?.(true); });
      await wait(() => !!window.SSX?.missionHelp, 15000); if (W === 'Mars') await wait(() => (window.__activities?.list?.() || []).length > 0, 20000);
      const ids = await G(W => window.__app.game.questList(W).map(q => q.id), W);
      seen.worlds.push(`${W}:${ids.length}`); console.log(W, ids.length, 'missions');
      for (const id of ids) {
        const acc = await G(id => { const g = window.__app.game; g.debug.clear(); return g.accept(id); }, id);
        if (!acc) { bad.push(`${id}: accept failed`); continue; } seen.quests++;
        for (let guard = 0; guard < 40; guard++) {
          const q = await G(() => window.__app.game.info.quest); if (!q || q.id !== id) break;
          const st = await G(() => { const g = window.__app.game; g.restore(); const s = g.debug.step(); return s && { type: s.type, wave: s.wave, building: s.building, text: s.text, mark: s.mark || null }; });
          if (!st) break;
          const where = `${id} #${q.step} ${st.type} "${String(st.text || '').slice(0, 50)}"`; seen.steps++;
          const kind = st.type === 'defeat' ? 'foes' : st.type === 'race' ? 'gate' : st.type === 'collect' ? 'items' : (st.type === 'clean' || st.type === 'choice') ? 'none' : 'place';
          let res = { ok: true };
          if (kind === 'none') { seen.none++; }
          else if (kind === 'foes') {
            const peaceful = await G(() => !window.__app.game.info.aliensOn);
            await G(() => window.__app.surface.debugQuestGo(12)); await frames(6);
            const up = await wait(() => window.__app.game.debug.agents().some(a => a.src === 'quest'), 5000);
            await G(() => window.__app.game.debug.calm(true)); await frames(8);
            const m = await G(() => window.SSX.missionHelp.markers());
            res = { ok: !peaceful && up && m.foes > 0 && m.world === Math.min(m.foes, 16) && m.minimap === m.foes, m, up, H: await G(() => { const H = window.__app.game.debug.H(); return { hp: H.hp, down: H.down }; }), d: await G(() => { const t = window.__app.game.debug.target(), s = window.__app.surface.mapData(); return t && Math.round(Math.hypot(t.x - s.x, t.z - s.z)); }) };
          } else if (kind === 'gate') {
            await G(() => window.__app.surface.debugQuestGo(10)); await frames(6);
            const md = await G(() => window.__app.surface.mapData()); res = { ok: !!(md.gate || md.wp), gate: !!md.gate, wp: !!md.wp };
          } else if (kind === 'items') {
            await frames(4); const r = await G(() => ({ items: window.__app.game.debug.items().filter(i => i.collect).length, wp: !!window.__app.surface.mapData().wp }));
            res = { ok: r.items > 0 && r.wp, ...r };
          } else {
            const look = () => G(() => { const t = window.__app.game.debug.target(), md = window.__app.surface.mapData(); return { wp: !!md.wp, r: t?.r, x: Math.round(t?.x), z: Math.round(t?.z) }; });
            await frames(4); let r = await look();
            if (st.mark && !(r.r > 0)) { await G(([x, z]) => window.__app.surface.debugMove(x + 4, z + 4, 0), [r.x, r.z]); await frames(12); r = { ...(await look()), searched: true }; } // a bounty hunt: the marker shows once you're close / the tip lands
            res = { ok: r.wp && (r.r > 0 || !/enter|crack/.test(st.type)), ...r };
          }
          if (!(await G(id => window.__app.game.info.quest?.id === id, id))) { seen.ended = (seen.ended || []).concat(where); console.log('note: the mission ended by itself on', where); break; } // e.g. a story heist the add-on closed
          const h = await G(() => window.SSX.missionHelp.hint());
          if (!h || h.length < 8) res = { ...res, ok: false, hint: h };
          if (kind !== 'none') seen.checked++;
          if (!res.ok) { bad.push(where); console.log('FAIL', where, JSON.stringify(res)); }
          await G(() => { const g = window.__app.game; g.debug.calm(false); g.debug.clear(); g.advanceStep(); }); await frames(3);
        }
        await G(() => { const g = window.__app.game; if (g.info.quest) g.abandon(); g.debug.clear(); }); await frames(2);
      }
    }
    if (errors.length) bad.push('page errors: ' + errors.slice(0, 3).join(' | '));
  } catch (e) { console.log('CRASH', e.stack); bad.push('crash'); }
  console.log(JSON.stringify({ seen, bad: bad.length, list: bad.slice(0, 80) })); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
