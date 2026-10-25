// v7.5 Mars story chains (storymars.js): play every shipped Rook / Vesna / Kestrel / Ines / Rusk job start to finish with the
// debug teleport hooks, the same way test-planet-missions.js does: real Take/Enter/choice taps, real race gates, and the custom
// steps (hold, choice, tail, escort, cleanexit, rrace, build, runtrack) driven the way a player would. Combat waves are checked
// for the new human types and then skipped. Also checks the choice sheet stays out of the screen centre.
// BASE=http://localhost:8937/ DEV="iPhone 14" BR=webkit OUT=/tmp/jeff/shots/ node test-storymars.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8937/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14', OUT = process.env.OUT || '/tmp/jeff/shots/';
const SHOTS = process.env.SHOTS === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
const ONLY = process.env.IDS ? process.env.IDS.split(',') : null;
const PICK = { 'rook-04-crew': ['pros', 'ozzie', 'penny', 'self'], 'vesna-04-cook': ['spare'], 'kestrel-03-fix': ['throw'], 'ines-04-lastcall': ['spare'], 'rusk-03-ia': ['betray'] };
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const dev = DEV === 'desktop' ? { viewport: { width: 1366, height: 820 } } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const page = await (await browser.newContext(dev)).newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /storymars/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const land = async w => { await G(() => { const a = window.__app; if (a.state.onSurface) a.takeOff(); }); await wait(() => !window.__app.state.onSurface && !window.__app.state.transitioning, 20000);
    await G(w => window.__app.landOn(window.__app.bodies.find(b => b.name === w).mesh), w);
    await wait(w => { const s = window.__app.state; return s.onSurface && !s.transitioning && s.info?.name === w && window.__app.surface.info?.intro === 0; }, 120000, w); await sleep(1200); };
  const shot = async n => { if (SHOTS) await page.screenshot({ path: `${OUT}storymars-${tag}-${n}.png` }); };
  const PLACE = ([x, z, y]) => new Promise(r => { window.__race.place(x, z, y); let n = 0; const f = () => (++n >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const thru = async g => { const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); await G(PLACE, [g.x - fx * 5, g.z - fz * 5, g.yaw]); await sleep(80); await G(PLACE, [g.x + fx * 5, g.z + fz * 5, g.yaw]); await sleep(80); };
  const takeRide = async () => {
    await G(() => { const a = window.__app, i = a.surface.info, v = a.surface.world.debug.vehicles().filter(v => v.parked).sort((p, q) => Math.hypot(p.x - i.x, p.z - i.z) - Math.hypot(q.x - i.x, q.z - i.z))[0]; a.surface.debugMove(v.x + 3.2, v.z + 1, 0); });
    await wait(() => window.__app.surface.info.nearVehicle, 8000); await G(() => window.__app.surface.interact()); await wait(() => window.__app.surface.info.driving, 4000);
  };
  const onFoot = async () => { if (await G(() => window.__app.surface.info.driving)) { await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 4000); } };
  const outside = async () => { if (await G(() => !!window.__app.surface.info.inside)) { await G(() => window.__app.surface.leaveBuilding()); await wait(() => !window.__app.surface.info.inside, 5000); await sleep(300); } };
  const tapEl = async sel => { const b = await page.$(sel); const bb = b && await b.boundingBox(); if (!bb) return false; if (BR === 'webkit' && DEV !== 'desktop' || dev.hasTouch) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { ['ssx.progress.v1', 'ssx.planets.v1', 'ssx.race.v1'].forEach(k => localStorage.removeItem(k)); localStorage.setItem('ssx.adult', '1'); window.__app.game?.reload?.(); });
    const meta = await G(async () => { const GM = await import('./game.js?v=7.5.1'); return { shipped: window.__storymars.shipped, deferred: GM.STORY_DEFERRED.filter(x => /^(rook|vesna|kestrel|ines|rusk)-/.test(x)), types: window.__storymars.types.filter(t => GM.AGENT_TYPES[t]) }; });
    ok('shipped', meta.shipped.length, meta.shipped.length === 11); ok('deferredLeft', meta.deferred.join(','), meta.deferred.join(',') === 'rook-05-withdrawal'); ok('humanTypes', meta.types.join(','), meta.types.length === 5);
    const plan = await G(async () => { const GM = await import('./game.js?v=7.5.1'); const by = {}; for (const id of window.__storymars.shipped) { const q = GM.QUESTS.find(x => x.id === id); (by[q.world] ||= []).push(id); } return by; });
    for (const w of ['Mars', 'Moon']) {
      const ids = (plan[w] || []).filter(id => !ONLY || ONLY.includes(id)); if (!ids.length) continue;
      await land(w);
      for (const id of ids) {
        await outside(); await onFoot();
        // unlock: mark prerequisites done (the chain order itself is checked via talk() below)
        const offered = await G(async id => { const GM = await import('./game.js?v=7.5.1'); const g = window.__app.game, P = g.progress, q = GM.QUESTS.find(x => x.id === id);
          const need = new Set(q.requires || []); for (const x of GM.QUESTS) if (x.contact === q.contact && x.world === q.world && GM.QUESTS.indexOf(x) < GM.QUESTS.indexOf(q)) need.add(x.id);
          for (const r of need) P.quests[r] = { status: 'done', everDone: true, step: 0, n: 0 };
          P.credits = Math.max(P.credits, 1500); g.save(); g.debug.clear(); window.__app.surface.world.setWanted(0);
          let off = null; const orig = window.__app.surface.game; g.talk(q.contact); off = document.getElementById('radioText')?.textContent || ''; return off.slice(0, 80); }, id);
        R[id + ':offer'] = offered; if (!offered.includes(id === 'ines-01-door' ? 'Saltblood' : '')) bad.push(id + ':offer');
        await G(() => { const c = window.__app.surface.info.colony; if (c) window.__app.surface.debugMove(c.x, c.z + 6, 0); });
        const cr0 = await G(() => window.__app.game.progress.credits);
        const acc = await G(id => window.__app.game.accept(id), id);
        let steps = [], guard = 0, notes = [];
        while (guard++ < 40) {
          const q = await G(() => window.__app.game.debug.quest()); if (!q || q.id !== id) break;
          const s = await G(() => window.__app.game.debug.step()); if (!s) break;
          steps.push(s.type);
          if (s.type === 'take') { await outside(); await takeRide(); }
          else if (s.type === 'clean') { await G(() => window.__app.surface.world.setWanted(0)); }
          else if (s.type === 'enter') {
            await onFoot(); const d = await G(b => window.__app.surface.world.doorList().find(d => d.kind === b || d.name === b || new RegExp(b, 'i').test(d.name)), s.building);
            await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [d.x, d.z]); await sleep(300); await G(() => window.__app.surface.enterBuilding());
            await wait(() => !!window.__app.surface.info.inside, 6000);
          } else if (s.type === 'defeat') {
            await outside(); await G(() => window.__app.surface.debugQuestGo(10));
            const sp = await wait(() => window.__app.game.debug.agents().some(a => a.src === 'quest'), 6000);
            const types = await G(() => [...new Set(window.__app.game.debug.agents().filter(a => a.src === 'quest').map(a => a.type))].join('+'));
            notes.push('wave:' + types); if (!sp || (s.wave.some(t => /goon|enforcer/.test(t)) && !/goon|enforcer/.test(types))) bad.push(id + ':wave');
            if (id === 'vesna-04-cook') await shot('defeat');
            await sleep(500); await G(() => { window.__app.game.debug.advance(); window.__app.game.debug.clear(); });
          } else if (s.type === 'hold') {
            await outside(); await G(() => window.__app.surface.debugQuestGo(1)); await sleep(600);
            const sp = await wait(() => window.__app.game.debug.agents().length > 0, 9000);
            const t1 = await G(() => window.__storymars.state.t); notes.push(`hold:${sp ? 'spawn' : 'nospawn'}:${t1.toFixed(1)}s`);
            if (!sp || t1 <= 0) bad.push(id + ':hold');
            const txt = await G(() => window.__app.game.info.quest.text); notes.push(txt.replace(/.*\(/, '('));
            if (id === 'vesna-04-cook' || id === 'ines-04-lastcall') await shot('hold-' + id);
            await G(() => { window.__storymars.skip(999); });
          } else if (s.type === 'choice') {
            const vis = await wait(() => window.__storymars.state.sheet, 6000);
            const opt = (PICK[id] || [])[steps.filter(t => t === 'choice').length - 1] || s.options[0].id;
            const geo = await G(() => { const r = document.getElementById('smSheet').getBoundingClientRect(); return { top: r.top, h: innerHeight }; });
            if (geo.top < geo.h * 0.45) bad.push(id + ':sheetCoversCentre');
            if (id === 'rook-04-crew' && steps.length === 1) await shot('choice');
            const tapped = await tapEl(`#smSheet button[data-opt="${opt}"]`); notes.push(`choice:${opt}`);
            if (!vis || !tapped) bad.push(id + ':choice');
            await wait(o => window.__app.game.progress.flags.some(f => f.endsWith('=' + o)), 4000, opt);
          } else if (s.type === 'tail') {
            await outside(); await sleep(300);
            for (let k = 0; k < 120; k++) {
              const st = await G(() => window.__storymars.state); if (!st.tail) break;
              await G(([x, z]) => window.__app.surface.debugMove(x + 14, z + 6, 0), [st.tail.x, st.tail.z]);
              if (k === 12) await shot('tail');
              await sleep(250);
            }
          } else if (s.type === 'escort2') {
            await outside(); await sleep(3800);
            const spawned = await G(() => window.__app.game.debug.agents().length); notes.push('escortWave:' + spawned);
            await shot('escort');
            await G(() => window.__app.surface.debugQuestGo(0.5)); await sleep(900);
          } else if (s.type === 'cleanexit') {
            await G(() => window.__app.surface.world.setWanted(2)); await G(() => window.__app.surface.debugQuestGo(0.5)); await sleep(600);
            const stuck = await G(id => window.__app.game.debug.quest()?.id === id, id); notes.push('heatBlocks:' + stuck); if (!stuck) bad.push(id + ':cleanexitHeat');
            await G(() => window.__app.surface.world.setWanted(0)); await sleep(400);
          } else if (s.type === 'rrace') {
            const started = await wait(() => window.__race?.state?.id === window.__app.game.debug.quest()?.id, 6000);
            if (!started) { bad.push(id + ':raceStart'); break; }
            const t = await G(async s => { const RC = await import('./racecore.js?v=7.5.1'); return RC.resolveTrack({ gates: s.pts, loop: false, anchor: 'colony' }, window.__app.surface.info.colony); }, s);
            await G(() => window.__race.skipCountdown()); await wait(() => window.__race.state?.phase === 'run', 8000);
            if (await G(id => window.__app.game.progress.flags.includes(`story:${id}:fix=throw`), id)) await G(() => window.__race.rivalPace(40));
            await sleep(1500);
            for (const g of t.gates) await thru(g);
            await wait(() => !window.__race.state || window.__race.state.phase === 'done', 8000);
            notes.push('race:' + JSON.stringify(await G(() => { const r = window.__race.result; return r && { done: r.done, won: r.won }; })));
            await wait(() => !window.__race.state, 12000);
          } else if (s.type === 'build') {
            await G(async () => { const RA = await import('./race.js?v=7.5.1'), c = window.__app.surface.info.colony; const gs = [[0, 45], [60, 20], [90, -40], [40, -90], [-40, -80], [-70, -10]].map(([x, z]) => ({ x: c.x + x, z: c.z + z }));
              return !!RA.saveTrack({ id: 'my-moon-' + Date.now(), name: 'Kestrel Killer', world: window.__app.surface.info.name, loop: true, laps: 1, gates: gs, props: [{ t: 'ramp', x: c.x + 30, z: c.z + 35, yaw: 1 }] }); });
          } else if (s.type === 'runtrack') {
            await outside(); await wait(() => window.__storymars.state.sheet, 6000); await tapEl('#smSheet button[data-opt="race"]');
            const started = await wait(() => !!window.__race?.state, 8000); if (!started) { bad.push(id + ':runtrack'); break; }
            await G(() => window.__race.skipCountdown()); await wait(() => window.__race.state?.phase === 'run', 8000);
            const t = (await G(() => window.__race.tracks())).find(x => x.custom);
            for (let i = 1; i <= t.gates.length; i++) await thru(t.gates[i % t.gates.length]);
            await wait(() => !window.__race.state || window.__race.state.phase === 'done', 8000); await wait(() => !window.__race.state, 12000);
          } else {
            if (s.vehicle === 'stolen' && !(await G(() => window.__app.surface.info.driving))) { await outside(); await takeRide(); }
            await outside(); await G(() => window.__app.surface.debugQuestGo(0.5)); await sleep(350);
          }
          await wait(sv => { const q = window.__app.game.debug.quest(); return !q || q.step !== sv; }, 6000, q.step);
        }
        const done = await G(id => !!window.__app.game.progress.quests[id]?.everDone, id), cr = await G(() => window.__app.game.progress.credits);
        ok(id, `${steps.join('>')} [${notes.join(' ')}] ${cr - cr0 >= 0 ? '+' : ''}${cr - cr0}cr`, acc && done);
      }
    }
    // one fail path: casing the bank with heat on you blows the job
    if (!ONLY) {
      await land('Mars'); await outside(); await onFoot();
      await G(() => { window.__app.game.accept('rook-03-case'); }); await G(() => window.__app.surface.debugQuestGo(0.5)); await wait(() => window.__app.game.debug.quest()?.step >= 1, 8000);
      await G(() => window.__app.surface.world.setWanted(1)); ok('caseFailsOnHeat', null, await wait(() => !window.__app.game.debug.quest(), 8000));
      ok('npcCapMobile', await G(() => window.__app.game.debug.agents().length), await G(() => window.__app.game.debug.agents().length <= 12));
    }
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || 'none', errors.length === 0);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
