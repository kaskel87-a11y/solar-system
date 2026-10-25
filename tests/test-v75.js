// v7.5 test: Mars city. Districts (Olympus Row, Red Tape Flats, Helios Heights) + Ares Beltway, fast travel, districtAt,
// spawn points, NPC budget (<=12 on phones), human security combat + gore, city missions + job board, choice sheet,
// safe-crack fallback, space ☰, Steve's activity runner + Pumpkin's ambience loading cleanly.
// BASE=http://localhost:8843/ BR=webkit DEV="iPhone 14" node test-v75.js
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8843/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || '/tmp/s74/', desk = DEV === 'desktop', PFX = process.env.PFX || 'v75';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = n => page.screenshot({ path: `${out}${PFX}-${tag}-${n}.png`, timeout: 120000 }).catch(e => console.log('shot', n, e.message.split('\n')[0]));
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    ok('version', await G(() => window.__app.version), (await G(() => window.__app.version)) >= 'v7.5');
    // space ☰: visible in flight, opens the menu, hides surface-only items
    await G(() => window.__app.setFlying?.(true)); await wait(() => window.__app.state.flying, 15000);
    ok('spaceMenuBtn', await G(() => { const b = document.getElementById('spaceMenuBtn'); return !!b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height >= 44; }));
    await G(() => document.getElementById('spaceMenuBtn').click());
    ok('spaceMenuOpen', await wait(() => document.getElementById('roverMenu').classList.contains('show'), 5000));
    ok('spaceMenuSurfaceItemsHidden', await G(() => getComputedStyle(document.getElementById('takeoffBtn')).display === 'none'));
    await shot('space-menu'); await G(() => document.getElementById('rmClose').click());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000)); await sleep(500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    const ds = await G(() => window.__app.surface.world.districts().map(d => d.id));
    ok('districts', ds.join(), ['mars-downtown', 'mars-rough', 'mars-gated'].every(d => ds.includes(d)));
    ok('cityApi', await G(() => ['districtAt', 'spawnPoints', 'npcBudget', 'npcReserve', 'roadAhead', 'lots', 'hostiles', 'choice'].every(k => typeof window.SSX.city[k] === 'function')));
    ok('cityMissions', await G(() => window.SSX.city.missions.length), (await G(() => window.SSX.city.missions.length)) >= 16);
    ok('lots', await G(() => window.SSX.city.lots().length), (await G(() => window.SSX.city.lots().length)) >= 3);
    ok('districtsMenu', await G(() => document.body.classList.contains('has-districts')));
    for (const d of ['mars-downtown', 'mars-rough', 'mars-gated']) {
      const r = await G(id => window.__app.surface.fastTravel(id), d); await sleep(2500);
      const s = await G(() => { const i = window.__app.surface.info, b = window.SSX.city.npcBudget(); return { at: window.SSX.city.districtAt(i.x, i.z)?.id, b, sp: window.SSX.city.spawnPoints(window.SSX.city.districtAt(i.x, i.z)?.id).length }; });
      ok('travel:' + d, JSON.stringify(r), r.ok && s.at === d);
      ok('spawn:' + d, s.sp, s.sp > 3);
      ok('npc:' + d, `${s.b.used}/${s.b.cap}`, s.b.used <= s.b.cap && (desk || s.b.cap <= 12));
      await shot(d);
    }
    // highway: districtAt on the road, roadAhead gives a spot
    const hw = await G(() => { const n = window.__app.surface.world.mapData()?.road; if (!n?.length) return null; const D = window.__app.surface.world.districts(), far = p => Math.min(...D.map(d => Math.hypot(d.x - p.x, d.z - p.z) - (d.r || 60))), m = [...n].sort((a, b) => far(b) - far(a))[0]; return { at: window.SSX.city.districtAt(m.x, m.z)?.id, x: m.x, z: m.z }; });
    ok('highway', JSON.stringify(hw), hw?.at === 'mars-highway');
    if (hw) { await G(h => window.__app.surface.debugMove(h.x, h.z), hw); await sleep(3000); await shot('beltway'); }
    // reservation shrinks the ambient budget
    const rs = await G(() => { const a = window.SSX.city.npcBudget(); window.SSX.city.npcReserve('test', 3); const b = window.SSX.city.npcBudget(); window.SSX.city.npcReserve('test', 0); return [a.free, b.free, b.reserved.test]; });
    ok('npcReserve', rs.join('/'), rs[2] === 3);
    // human security combat: spawn, gore, corpse
    await G(() => window.__app.surface.fastTravel('mars-rough')); await sleep(1500);
    const sp = await G(() => { const i = window.__app.surface.info; return window.__app.surface.game.hostiles(['thug', 'enforcer', 'guard', 'sdrone'], i.x, i.z - 12, { aggro: false }); });
    ok('hostiles', sp, sp >= 3);
    await sleep(4000); await shot('firefight');
    const k = await G(() => { const g = window.__app.surface.game, d0 = g.debug.debrisCount(); const types = g.debug.agents().map(a => a.type); g.debug.kill(0, {}); g.debug.kill(0, { gib: true }); return { types, d0, d1: g.debug.debrisCount(), bodies: g.debug.bodies(), h: g.humanCount() }; });
    ok('humanTypes', k.types.join(), k.types.includes('thug') && k.types.includes('enforcer'));
    ok('gore', `${k.d0}->${k.d1}`, k.d1 > k.d0); ok('corpse', k.bodies, k.bodies >= 1);
    await sleep(1500); await shot('gore');
    await G(() => window.__app.surface.game.debug.clear());
    // job board + choice step (Rhee: eviction)
    ok('jobBoard', await G(() => window.__app.surface.game.jobBoard().length), (await G(() => window.__app.surface.game.jobBoard().length)) >= 1);
    const acc = await G(() => { const g = window.__app.surface.game; g.debug.P().quests ||= {}; return !!g.accept('rhee-01-eviction'); });
    ok('acceptRhee', acc);
    if (acc) {
      await G(() => window.__app.surface.game.debug.advance());
      ok('choiceSheet', await wait(() => document.getElementById('sheet').classList.contains('show'), 20000));
      await shot('choice');
      const cr0 = await G(() => window.__app.surface.game.debug.P().credits);
      await G(() => document.querySelector('#sheetBtns button').click());
      ok('choiceMade', await wait(() => !document.getElementById('sheet').classList.contains('show'), 5000));
      ok('choiceFlag', await G(() => Object.keys(window.__app.surface.game.debug.P().flags || {}).filter(f => /rhee|retainer|choice/.test(f)).join() || window.__app.surface.game.debug.quest()?.step));
      await G(() => window.__app.surface.game.abandon?.());
    }
    // safe-crack fallback inside the bank
    await G(() => window.__app.surface.fastTravel('mars-downtown')); await sleep(1500);
    const bank = await G(() => { const L = window.__app.surface.world.doorList(), i = L.findIndex(d => d.kind === 'bank'); return i < 0 ? null : { ...L[i], i }; });
    ok('bankDoor', bank?.name, !!bank);
    if (bank) {
      const ins = await G(b => { const s = window.__app.surface; return s.enterBuilding(b.i); }, bank); await sleep(2500);
      ok('bankInside', await G(() => !!window.__app.surface.info?.inside));
      await shot('bank');
      const t0 = Date.now();
      if (await G(() => !!window.SSX.heist?.safeCrack)) { // v7.5.1: Ben's dial minigame drives game.crack
        await G(() => { window.__crk = window.__app.surface.game.crack('test-vault', 3, { loot: 10 }); });
        ok('heistDialOpen', await wait(() => !!window.__app.surface.game.crackJob?.ext && !!document.getElementById('hsSafe'), 20000));
        await shot('safecrack');
        await page.keyboard.press('Escape');
        const cr = await G(() => Promise.race([window.__crk, new Promise(r => setTimeout(() => r({ ok: 'hung' }), 20000))]));
        ok('heistAbort', JSON.stringify(cr), cr && cr.ok === false && !(await G(() => window.__app.surface.game.crackJob)));
        ok('safeSpots', await G(() => window.SSX.city.safeSpots('mars-gated').length), (await G(() => window.SSX.city.safeSpots('mars-gated').length)) >= 1);
        ok('lineOfSight', await G(() => typeof window.SSX.city.lineOfSight(0, 0, 5, 5) === 'boolean'));
        ok('minimapMarks', await G(() => { window.SSX.minimap.addMarks('t', [{ x: 0, z: 0 }]); const n = window.SSX.minimap.list().includes('t'); window.SSX.minimap.clear('t'); return n; }));
      } else {
        const cr = await G(() => Promise.race([window.__app.surface.game.crack('test-vault', 0, { loot: 10 }), new Promise(r => setTimeout(() => r({ ok: false, why: 'timeout' }), 240000))]));
        ok('crackFallback', JSON.stringify(cr) + ` ${Math.round((Date.now() - t0) / 1000)}s`, cr?.ok && (await G(() => window.__app.surface.game.flag('cracked:test-vault'))));
      }
      await G(() => window.__app.surface.leaveBuilding());
    }
    // add-ons merged into v7.5
    ok('activitiesUi', await G(() => !!document.getElementById('rmActivities') || !!document.getElementById('actCtxBtn')));
    ok('storyMars', await G(() => window.__storymars?.shipped?.length), (await G(() => window.__storymars?.shipped?.length)) >= 10);
    ok('poker', await G(() => typeof window.__poker?.open === 'function'));
    ok('soundMenu', await G(() => !!document.getElementById('rmSound')));
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noPageErrors', errors.slice(0, 5).join(' | ') || 'none', !errors.length);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
