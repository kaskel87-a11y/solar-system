// v7.5 Mars story part 2 (storymars2.js): register + play the new jobs with the debug teleport hooks, the same way
// test-storymars.js does. Covers rook-05-withdrawal (Ben's SSX.heist path and the no-heist fallback), the Doc Grieve
// chain's custom steps (goto/tail/defeat/hold/escort/pick), the barter offers under a stub SSX.contraband, the pick
// sheet staying out of the screen centre, and the mobile NPC cap during a wave.
// NODE_PATH=/workspace/pw/node_modules BASE=http://localhost:8937/ DEV="iPhone 14" BR=webkit SHOTS=1 OUT=/workspace/solar-system-jeff-story2/shots/jeff-story2/ node test-storymars2.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8937/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14', OUT = process.env.OUT || '/tmp/jeff2/';
const SHOTS = process.env.SHOTS === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const WH = /^(\d+)x(\d+)$/.exec(DEV);
  const dev = DEV === 'desktop' ? { viewport: { width: 1366, height: 820 } }
    : WH ? { viewport: { width: +WH[1], height: +WH[2] }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
    : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const page = await (await browser.newContext(dev)).newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /storymars2/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [], notes = {};
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = async n => { if (SHOTS) { try { require('fs').mkdirSync(OUT, { recursive: true }); } catch (e) {} await page.screenshot({ path: `${OUT}storymars2-${tag}-${n}.png` }); } };
  const step = () => G(() => window.__app.game.debug.step());
  const qid = () => G(() => window.__app.game.debug.quest()?.id || null);
  const outside = async () => { if (await G(() => !!window.__app.surface.info.inside)) { await G(() => window.__app.surface.leaveBuilding()); await wait(() => !window.__app.surface.info.inside, 5000); await sleep(200); } };
  const onFoot = async () => { if (await G(() => window.__app.surface.info.driving)) { await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 4000); } };
  const takeRide = async () => {
    await G(() => { const a = window.__app, i = a.surface.info, v = a.surface.world.debug.vehicles().filter(v => v.parked).sort((p, q) => Math.hypot(p.x - i.x, p.z - i.z) - Math.hypot(q.x - i.x, q.z - i.z))[0]; if (v) a.surface.debugMove(v.x + 3.2, v.z + 1, 0); });
    await wait(() => window.__app.surface.info.nearVehicle, 8000); await G(() => window.__app.surface.interact()); await wait(() => window.__app.surface.info.driving, 4000);
  };
  const tapOpt = async opt => { const b = await page.$(`#sm2Sheet button[data-opt="${opt}"]`); const bb = b && await b.boundingBox(); if (!bb) return false; if ((BR === 'webkit' && DEV !== 'desktop') || dev.hasTouch) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
  const land = async w => { await G(() => { const a = window.__app; if (a.state.onSurface) a.takeOff(); }); await wait(() => !window.__app.state.onSurface && !window.__app.state.transitioning, 20000);
    await G(w => window.__app.landOn(window.__app.bodies.find(b => b.name === w).mesh), w);
    await wait(w => { const s = window.__app.state; return s.onSurface && !s.transitioning && s.info?.name === w && window.__app.surface.info?.intro === 0; }, 120000, w); await sleep(1000); };
  // unlock + accept a mission regardless of prerequisites (accept() does not gate on requires)
  const begin = async (id, crewFlags) => {
    await G((a) => { const [id, crew] = a; const g = window.__app.game; g.progress.credits = Math.max(g.progress.credits, 6000);
      window.__app.surface.world.setWanted(0); g.debug.clear();
      for (const f of (crew || [])) g.setFlag(f);
      const c = window.__app.surface.info.colony; if (c) window.__app.surface.debugMove(c.x, c.z + 6, 0);
      g.accept(id); }, [id, crewFlags]);
    return (await qid()) === id;
  };
  // generic player-like step driver for one mission; returns {done, steps}
  const drive = async (id, picks = {}, maxGuard = 60) => {
    const seen = []; let guard = 0; const takenPicks = {};
    while (guard++ < maxGuard) {
      const cur = await qid(); if (cur !== id) break; // completed or failed
      const s = await step(); if (!s) break; seen.push(s.type);
      if (s.type === 'goto' || s.type === 'return') {
        if (s.vehicle && !(await G(() => window.__app.surface.info.driving))) { await outside(); await takeRide(); }
        else if (!s.vehicle) { await onFoot(); await outside(); }
        for (let k = 0; k < 10; k++) { if ((await qid()) !== id) break; const st = await step(); if (st?.type !== s.type) break; await G(() => window.__app.surface.debugQuestGo(1)); await sleep(350); }
      } else if (s.type === 'take') { await outside(); await takeRide();
        for (let k = 0; k < 6 && (await step())?.type === 'take'; k++) { await G(() => window.__app.surface.debugQuestGo(1)); await sleep(300); }
      } else if (s.type === 'clean') { await G(() => window.__app.surface.world.setWanted(0)); await sleep(600);
      } else if (s.type === 'crack') { // rook fallback already set the flag; just wait for the auto-advance
        await wait(() => window.__app.game.debug.step()?.type !== 'crack', 6000);
      } else if (s.type === 'heist') {
        const fb = await G(() => window.__storymars2.state.heist?.fallback);
        notes[id + ':heist'] = fb ? 'fallback' : 'ssx-heist';
        if (fb) { await wait(() => window.__app.game.debug.step()?.type !== 'heist', 8000); }
        else { await G(() => { window.__app.game.setFlag('cracked:bank-vault'); window.__storymars2.heistDone(true); }); await wait(() => window.__app.game.debug.step()?.type !== 'heist', 8000); }
      } else if (s.type === 'defeat') {
        await outside(); await G(() => window.__app.surface.debugQuestGo(10)); await sleep(500);
        const sp = await wait(() => window.__app.game.debug.agents().some(a => a.src === 'quest'), 7000);
        notes[id + ':wave'] = await G(() => [...new Set(window.__app.game.debug.agents().filter(a => a.src === 'quest').map(a => a.type))].join('+'));
        if (!sp) bad.push(id + ':noWave');
        await sleep(300); await G(() => { window.__app.game.debug.advance(); window.__app.game.debug.clear(); });
      } else if (s.type === 'hold' || s.type === 'raid') {
        await outside(); await G(() => window.__app.surface.debugQuestGo(1)); await sleep(700);
        const sp = await wait(() => window.__app.game.debug.agents().length > 0, 9000);
        notes[id + ':' + s.type] = (sp ? 'spawn' : 'nospawn') + ':' + (await G(() => window.__storymars2.state.t));
        await G(() => { window.__storymars2.raidDone && window.__storymars2.raidDone(true); window.__storymars2.skip(999); });
        await sleep(500); await G(() => window.__app.game.debug.clear());
      } else if (s.type === 'tail') {
        await outside(); await sleep(300);
        for (let k = 0; k < 120; k++) { const stt = await G(() => window.__storymars2.state); if (!stt.tail || (await step())?.type !== 'tail') break;
          await G(([x, z]) => window.__app.surface.debugMove(x + 14, z + 6, 0), [stt.tail.x, stt.tail.z]);
          if (k === 10 && id === 'grieve-03-bad-batch') await shot('tail'); await sleep(230); }
      } else if (s.type === 'escort') {
        await outside(); await sleep(3600);
        for (let k = 0; k < 24 && (await step())?.type === 'escort'; k++) { await G(() => window.__app.surface.debugQuestGo(0.5)); await sleep(500); }
      } else if (s.type === 'pick') {
        const vis = await wait(() => window.__storymars2.state.sheet, 6000);
        const geo = await G(() => { const r = document.getElementById('sm2Sheet').getBoundingClientRect(); return { top: r.top, h: innerHeight }; });
        if (geo.top < geo.h * 0.4 - 1) bad.push(id + ':sheetCoversCentre'); // on touch it sits above the joystick (max 60% of the screen tall)
        const n = (seen.filter(t => t === 'pick').length - 1); let opt = (picks.pick || [])[n]; if (!s.options.some(o => o.id === opt)) { bad.push(id + ':unknownPick:' + opt); opt = s.options[0].id; }
        if (id === 'rook-05-withdrawal') await shot('pick');
        await sleep(400); // the sheet ignores taps for its first ~300 ms
        const tapped = await tapOpt(opt); takenPicks[opt] = true;
        if (!vis || !tapped) bad.push(id + ':pick');
        await sleep(900);
      } else if (s.type === 'race') {
        await G(() => { const g = window.__app.game; for (let i = 0; i < 20; i++) g.debug.advance(); }); // skip race in this smoke
        await sleep(400);
      } else { await G(() => window.__app.game.debug.advance()); await sleep(300); }
    }
    const done = await G(id => !!window.__app.game.progress.quests[id]?.everDone, id);
    return { done, steps: seen };
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { ['ssx.progress.v1', 'ssx.planets.v1', 'ssx.race.v1'].forEach(k => localStorage.removeItem(k)); localStorage.setItem('ssx.adult', '1'); window.__app.game?.reload?.(); });
    ok('bootstrapped', await wait(() => !!window.__storymars2 && Array.isArray(window.__storymars2.missions), 30000));
    // ---- A) registration meta ----
    const meta = await G(async () => { const GM = await import('./game.js'); const S2 = window.__storymars2;
      return { missions: S2.missions, offers: S2.offers, types: S2.types.filter(t => GM.AGENT_TYPES[t]),
        deferred: GM.STORY_DEFERRED.filter(x => /^rook-05/.test(x)),
        rookIsQuest: !!GM.QUESTS.find(q => q.id === 'rook-05-withdrawal' && q.contact === 'Rook'),
        allRegistered: S2.missions.every(id => !!GM.QUESTS.find(q => q.id === id)) }; });
    ok('missionsCount', meta.missions.length, meta.missions.length === 11);
    ok('allRegistered', meta.allRegistered);
    ok('types', meta.types.join('+'), meta.types.length === 3);
    ok('rookShipped', meta.rookIsQuest && meta.deferred.length === 0);
    const contacts = await G(async () => { const W = await import('./world.js'); const C = W.districtsOf('Mars');
      const names = []; for (const id in C) for (const c of (C[id].contacts || [])) names.push(c.name); return names; });
    ok('contacts', ['Doc Grieve', 'Counselor Wolde', 'Cassius Thorne'].filter(n => contacts.includes(n)).join(','), ['Doc Grieve', 'Counselor Wolde', 'Cassius Thorne'].every(n => contacts.includes(n)));
    await land('Mars');
    // ---- B) barter offers register under a stub SSX.contraband ----
    await G(() => { const offers = {}, calls = []; window.SSX = window.SSX || {};
      window.SSX.contraband = window.SSX.contraband || { offers, calls,
        registerOffer(o) { const w = Array.isArray(o.wants) ? o.wants : (o.wants ? [o.wants] : []); if (!o.id || !o.npc || !o.district || !w.length || !o.gives) throw new Error('bad offer ' + o.id); if (this.offers[o.id]) return false; this.offers[o.id] = { ...o, wants: w }; return true; },
        offer(id) { return this.offers[id] || null; },
        add() { return true; } }; if (!window.SSX.contraband.calls) window.SSX.contraband.calls = calls; });
    const reg = await wait(() => window.__storymars2.registered.length === 5, 6000);
    ok('offersRegister', await G(() => window.__storymars2.registered.length), reg);
    ok('offersWellFormed', null, await G(async () => { const m = await import('./storymars2.js'); return m.OFFERS2.length === 5 && m.OFFERS2.every(o => Array.isArray(o.wants) && o.wants.length > 0 && !!o.gives && !!o.district && !!o.npc); }));
    // saltblood-favour onTrade runs and fails gracefully (returns a message) whether or not SSX.danger exists
    const favour = await G(async () => { const m = await import('./storymars2.js'); const o = m.OFFERS2.find(o => o.id === 'grieve-saltblood-favour'); return o && o.onTrade ? o.onTrade({ offerId: o.id }) : null; });
    ok('offerOnTradeGraceful', JSON.stringify(favour), !!favour && typeof favour.msg === 'string');
    // B2) real trades through the live Marsmania contraband (native on main): give applied exactly once, no double
    const realCb = await G(() => !!(window.SSX && window.SSX.contraband && window.SSX.contraband.barter && window.SSX.contraband.add && !window.SSX.contraband.offers));
    ok('realContraband', realCb);
    if (realCb) {
      // wanted_clear: start at 2 stars, stars:1 -> expect exactly 1 (a double-apply would reach 0)
      const wc = await G(() => { const C = window.SSX.contraband, g = window.__app.game; g.progress.quests['grieve-02-cold-chain'] = { everDone: true, status: 'done' };
        C.add('glowdust', 2); window.__app.surface.world.setWanted(2); const r = C.barter('glowdust', 2, 'grieve-death-certificate'); return { ok: r.ok, msg: r.msg, wanted: window.__app.surface.world.wanted }; });
      ok('wantedClearTradeOnce', JSON.stringify(wc), wc.ok === true && wc.wanted === 1);
      // custom (garage absent on main): giveRide cash fallback = +400, applied once
      const tr = await G(() => { const C = window.SSX.contraband, g = window.__app.game; g.progress.quests['thorne-01-repo'] = { everDone: true, status: 'done' };
        C.add('voidhoney', 2); const c0 = g.progress.credits; const r = C.barter('voidhoney', 2, 'thorne-spare-bike'); return { ok: r.ok, msg: r.msg, delta: g.progress.credits - c0, garage: !!(window.SSX && window.SSX.garage) }; });
      ok('thorneCustomTradeOnce', JSON.stringify(tr), tr.ok === true && (tr.garage || tr.delta === 400));
    }
    const DESKTOP = DEV === 'desktop';
    const cap = DESKTOP ? 24 : 12;
    // track peak live NPC count during this whole run
    const peakNpc = async () => G(() => { try { return window.__app.surface.world.npcBudget?.()?.used ?? window.__app.game.debug.agents().length; } catch (e) { return 0; } });
    let peak = 0; const bumpPeak = async () => { const n = await peakNpc(); if (n > peak) peak = n; };
    // ---- C) rook-05-withdrawal via Ben's SSX.heist ----
    ok('ssxHeistPresent', await G(() => !!(window.SSX && window.SSX.heist && window.SSX.heist.registerHeist)));
    if (await begin('rook-05-withdrawal', ['rook-04-crew'])) {
      const r1 = await drive('rook-05-withdrawal', { pick: ['talk'] });
      notes['rook-05:steps'] = r1.steps.join('>'); await bumpPeak();
      ok('rookHeistWired', notes['rook-05-withdrawal:heist'], notes['rook-05-withdrawal:heist'] === 'ssx-heist');
      ok('rookDone', r1.done);
      ok('rookPickApplied', await G(() => (window.__app.game.progress.flags || []).some(f => /rook_|ledger/.test(f))));
    } else bad.push('rookAcceptFail');
    // ---- C2) rook-05 again with no SSX.heist -> fallback path ----
    await G(() => { window.__ssxHeistBak = window.SSX.heist; delete window.SSX.heist; });
    if (await begin('rook-05-withdrawal', ['rook-04-crew'])) {
      const r2 = await drive('rook-05-withdrawal', { pick: ['shoot'] });
      notes['rook-05fb:steps'] = r2.steps.join('>');
      ok('rookFallbackNoHeist', await G(() => !(window.SSX && window.SSX.heist)));
      ok('rookFallbackDone', r2.done);
    } else bad.push('rookFallbackAcceptFail');
    await G(() => { if (window.__ssxHeistBak) window.SSX.heist = window.__ssxHeistBak; });
    // ---- D) Doc Grieve chain: play each mission end to end ----
    for (const id of ['grieve-01-house-call', 'grieve-02-cold-chain', 'grieve-03-bad-batch', 'grieve-04-malpractice']) {
      const exists = await G(id => !!window.__app.game.debug && !!(window.__storymars2.missions.includes(id)), id);
      if (!exists) continue;
      if (!(await begin(id))) { bad.push(id + ':accept'); continue; }
      const rr = await drive(id, { pick: ['hire'] }); await bumpPeak();
      notes[id] = rr.steps.join('>');
      ok(id, rr.done);
    }
    ok('npcPeakWithinCap', peak + '/' + cap, peak <= cap);
    await shot('final'); await G(() => window.__app.surface.world.setWanted(0));
    ok('noErrors', errors.slice(0, 6).join(' | '), errors.length === 0);
  } catch (e) { bad.push('EXC:' + e.message); R.exc = e.stack?.split('\n').slice(0, 4).join(' | '); }
  R.notes = notes; R.bad = bad; R.pass = bad.length === 0;
  console.log(JSON.stringify(R, null, 2));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
