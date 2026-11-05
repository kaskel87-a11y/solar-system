// Mars dirty cops and bribes (mars/bribes.js, SSX.bribes): pricing (stars, colsec rep, night, personality, tip-off),
// refusal odds, on-the-spot bribes (cash / product / snitch / name-drop) through world.setWanted, refusals that escalate,
// pull-over stops (comply / timeout), Rusk's precinct desk on his existing wall (clean record, patrol sheet, lost
// evidence from an undercover bust), tip-off warnings, the bribe bar (taps, 44px, contrast), hotkey, no console errors.
// BASE=http://127.0.0.1:8881/ BR=webkit DEV="iPhone 14" OUT=./shots/bribes/ node tests/test-bribes.js   (DEV=desktop; one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8881/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(400); };
  const moveAJ = (x, z) => G(([x, z]) => { const s = window.__app.surface, c = s.info.colony; s.debugMove(c.x + x, c.z + z, 0); }, [x, z]);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.bribes && window.SSX?.contraband?.barterSource === 'barter.json', 15000);
    ok('api', await G(() => ['price', 'offer', 'on', 'contacts', 'record', 'isNight'].every(k => typeof window.SSX.bribes[k] === 'function') && !!window.SSX.bribes.debug));
    R.price = await G(() => { const p = window.SSX.bribes.price, b = { colsec: 0, dirty: 0, night: false, personality: 'on_take', priors: 0, tipoff: false };
      return { s1: p({ ...b, stars: 1 }), s4: p({ ...b, stars: 4 }), good: p({ ...b, stars: 2, colsec: 50 }), bad: p({ ...b, stars: 2, colsec: -50 }), night: p({ ...b, stars: 2, night: true }), day: p({ ...b, stars: 2 }), greedy: p({ ...b, stars: 2, personality: 'greedy' }), tip: p({ ...b, stars: 2, tipoff: true }), stop: p({ ...b, kind: 'stop', contraband: false, stolen: false }), record: p({ ...b, kind: 'record', stars: 3 }) }; });
    ok('priceScales', R.price, R.price.s4 > R.price.s1 && R.price.good < R.price.bad && R.price.night < R.price.day && R.price.greedy > R.price.day && R.price.tip < R.price.day && R.price.stop > 0 && R.price.record > 0);
    R.refuse = await G(() => { const f = window.SSX.bribes.debug.refuseChance; return { straight: f('cash', { personality: 'straight', stars: 1, colsec: 0, dirty: 0, night: false, tipoff: false, priors: 0 }), take: f('cash', { personality: 'on_take', stars: 1, colsec: 0, dirty: 0, night: false, tipoff: false, priors: 0 }), take5: f('cash', { personality: 'on_take', stars: 5, colsec: 0, dirty: 0, night: false, tipoff: false, priors: 0 }) }; });
    ok('refuseOdds', R.refuse, R.refuse.straight > R.refuse.take && R.refuse.take5 > R.refuse.take);
    R.desk = await G(() => { const C = window.SSX.contraband, ids = C.barterOffers(null).filter(o => /rusk/i.test(o.npc)).map(o => o.id); const c = window.SSX.bribes.contacts(); return { ids, rusk: c[0].services.map(s => s.id), npc: C.offer('rusk-clean-record')?.npcName, wall: C.offer('rusk-wipe-1')?.npcName }; });
    ok('ruskDesk', R.desk, ['rusk-clean-record', 'rusk-patrol-sheet', 'rusk-lost-evidence', 'rusk-wipe-1', 'rusk-raid-tip'].every(i => R.desk.ids.includes(i)) && R.desk.npc === R.desk.wall);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.game.debug.calm?.(true); window.__app.game.progress.credits = 5000; window.SSX.bribes.debug.reset(); window.SSX.bribes.debug.night(false); window.__app.surface.world.setWanted(0);
      window.__toasts = []; const t0 = window.__app.toast; window.__app.toast = (m, ms) => { window.__toasts.push(String(m)); return t0(m, ms); }; window.__bev = []; window.addEventListener('ssx:bribe', e => window.__bev.push(e.detail.type)); });
    await moveAJ(10, 10); await sleep(500);
    // real detection: wanted 2 -> ColSec officers arrive -> the bar shows up on its own
    await G(() => window.__app.surface.world.setWanted(2, 'test'));
    R.realSpot = await wait(() => !!window.SSX.bribes.encounter, 25000);
    await G(() => { window.SSX.bribes.debug.clear(); window.__app.surface.world.setWanted(0); }); await sleep(300);
    // forced spot bribe, on-the-take cop, paid by tapping the big button
    await G(() => { window.__app.surface.world.setWanted(2, 'test'); window.SSX.bribes.debug.spot({ personality: 'on_take', name: 'Ofc. Hale' }); });
    await sleep(300);
    R.bar = await G(() => { const b = document.getElementById('bribeBar'), cs = getComputedStyle(b), btns = [...b.querySelectorAll('button')]; const e = window.SSX.bribes.encounter;
      return { show: b.classList.contains('show'), bg: cs.backgroundColor, color: cs.color, minH: Math.min(...btns.map(x => x.getBoundingClientRect().height)), n: btns.length, labels: btns.map(x => x.textContent), price: e.price, fits: b.getBoundingClientRect().right <= innerWidth && b.getBoundingClientRect().left >= 0, top: Math.round(b.getBoundingClientRect().top) }; });
    ok('barShown', R.bar, R.bar.show && R.bar.bg === 'rgb(0, 0, 0)' && R.bar.color === 'rgb(255, 255, 255)' && R.bar.minH >= 44 && R.bar.fits && /Grease him/.test(R.bar.labels[0]));
    await page.screenshot({ path: `${out}bribes-${tag}.png` }); R.shot = `${out}bribes-${tag}.png`;
    // retry until the on-the-take cop accepts (6% refusal) - force accept via API path if the tap was refused
    const c0 = await G(() => window.__app.game.progress.credits);
    await tapSel('#bribeBar button.main');
    R.tapPaid = await G(c0 => ({ wanted: window.__app.surface.world.wanted, spent: c0 - window.__app.game.progress.credits, ev: window.__bev.slice(-1)[0], enc: !!window.SSX.bribes.encounter }), c0);
    ok('tapBribe', R.tapPaid, !R.tapPaid.enc && ((R.tapPaid.ev === 'paid' && R.tapPaid.wanted === 0 && R.tapPaid.spent > 0) || R.tapPaid.ev === 'refused'));
    // 4 stars: one cop takes 2 off
    R.big = await G(() => { const w = window.__app.surface.world; w.setWanted(4, 't'); window.SSX.bribes.debug.spot({ personality: 'greedy' }); const r = window.SSX.bribes.offer('cash', { force: true }); return [r.ok, w.wanted]; });
    ok('fourStarsMinus2', R.big, R.big[0] && R.big[1] === 2);
    // refusal escalates and bags the product
    R.refused = await G(() => { const w = window.__app.surface.world, C = window.SSX.contraband; w.setWanted(0); w.setWanted(1, 't'); C.reset(); C.add('glowdust', 12); window.SSX.bribes.debug.spot({ personality: 'straight' });
      const r = window.SSX.bribes.offer('product', { force: 'refuse' }); return { ok: r.ok, refused: r.refused, esc: r.escalation, wanted: w.wanted, left: C.stash().items.glowdust?.qty || 0, rec: window.SSX.bribes.record() }; });
    ok('refuseEscalates', R.refused, R.refused.refused && R.refused.wanted >= 2 && R.refused.left < 12 && R.refused.rec.priors === 1 && !!R.refused.rec.seized);
    // product bribe accepted
    R.product = await G(() => { const w = window.__app.surface.world, C = window.SSX.contraband; w.setWanted(2, 't'); C.add('glowdust', 10); const a = C.stash().items.glowdust.qty; window.SSX.bribes.debug.spot({ personality: 'on_take' });
      const r = window.SSX.bribes.offer('product', { force: true }); return { ok: r.ok, pay: r.pay, wanted: w.wanted, before: a, after: C.stash().items.glowdust?.qty || 0 }; });
    ok('productBribe', R.product, R.product.ok && R.product.wanted === 0 && R.product.after < R.product.before);
    // snitch favor through SSX.rep (stubbed here; PR #20 provides the real one)
    R.snitch = await G(() => { const w = window.__app.surface.world, calls = []; const real = window.SSX.rep; window.SSX.rep = { get: () => 0, add: (id, d, why) => calls.push([id, d]), gangAt: () => 'saints' };
      w.setWanted(1, 't'); window.SSX.bribes.debug.spot({ personality: 'on_take' }); const o = window.SSX.bribes.encounter.options.find(x => x.id === 'favor'); const r = window.SSX.bribes.offer('favor', { force: true, gang: o?.gang });
      window.SSX.rep = real; if (!real) delete window.SSX.rep; return { gang: o?.gang, ok: r.ok, wanted: w.wanted, calls }; });
    ok('snitchRep', R.snitch, R.snitch.ok && R.snitch.gang === 'saints' && R.snitch.calls.some(c => c[0] === 'saints' && c[1] === -10) && R.snitch.calls.some(c => c[0] === 'colsec_dirty' && c[1] > 0) && R.snitch.wanted === 0);
    // name-drop Rusk once you're under his protection
    R.namedrop = await G(() => { const w = window.__app.surface.world, g = window.__app.game; w.setWanted(1, 't'); window.SSX.bribes.debug.spot({ personality: 'greedy' }); const before = window.SSX.bribes.encounter.options.some(x => x.id === 'namedrop');
      g.setFlag('rusk_protection'); window.SSX.bribes.debug.spot({ personality: 'greedy' }); const after = window.SSX.bribes.encounter.options.some(x => x.id === 'namedrop'); const r = window.SSX.bribes.offer('namedrop', { force: true }); return { before, after, ok: r.ok, wanted: w.wanted }; });
    ok('nameDrop', R.namedrop, !R.namedrop.before && R.namedrop.after && R.namedrop.ok && R.namedrop.wanted === 0);
    // pull-over stop: card with comply / floor it, then the timer runs out -> comply
    R.stop = await G(() => { const w = window.__app.surface.world, C = window.SSX.contraband; w.setWanted(0); C.reset(); const e = window.SSX.bribes.debug.stop({ personality: 'greedy', sec: 1 }); return { kind: e.kind, opts: e.options.map(o => o.id), price: e.price }; });
    await sleep(1800);
    R.stopEnd = await G(() => ({ enc: !!window.SSX.bribes.encounter, ev: window.__bev.slice(-2), wanted: window.__app.surface.world.wanted }));
    ok('pullOver', { ...R.stop, ...R.stopEnd }, R.stop.kind === 'stop' && R.stop.opts.includes('comply') && R.stop.opts.includes('run') && !R.stopEnd.enc && R.stopEnd.ev.includes('comply') && R.stopEnd.wanted === 0);
    R.stopRun = await G(() => { window.SSX.bribes.debug.stop({}); const r = window.SSX.bribes.offer('run'); const w = window.__app.surface.world.wanted; window.__app.surface.world.setWanted(0); return [r.ok, w]; });
    ok('stopRun', R.stopRun, R.stopRun[0] && R.stopRun[1] === 2);
    // desk: lost evidence from an undercover bust, clean record, patrol sheet
    await sleep(600);
    R.evidence = await G(() => { const C = window.SSX.contraband, B = window.SSX.bribes; window.SSX.bribes.debug.reset(); C.reset(); C.add('glowdust', 3); const s = C.sell('glowdust', 3, 'red-tape-flats', { risk: true, undercover: true }); window.__app.surface.world.setWanted(0);
      const rec = B.record(); const r = B.offer('evidence'); return { bust: !!s.bust, seized: rec.seized?.items, ok: r.ok, msg: r.msg, back: C.stash().items.glowdust?.qty || 0, after: B.record().seized }; });
    ok('lostEvidence', R.evidence, R.evidence.bust && R.evidence.seized?.glowdust === 3 && R.evidence.ok && R.evidence.back === 3 && !R.evidence.after);
    R.record = await G(() => { const B = window.SSX.bribes, w = window.__app.surface.world; B.debug.priors(3); w.setWanted(3, 't'); const p = B.price({ kind: 'record' }); const c0 = window.__app.game.progress.credits; const r = B.offer('record'); return { ok: r.ok, msg: r.msg, wanted: w.wanted, priors: B.record().priors, spent: c0 - window.__app.game.progress.credits, p, again: B.offer('record').ok }; });
    ok('cleanRecord', R.record, R.record.ok && R.record.wanted === 0 && R.record.priors === 0 && R.record.spent === R.record.p && R.record.again === false);
    R.tipoff = await G(() => { const B = window.SSX.bribes; const r = B.offer('tipoff'); window.__toasts = []; window.dispatchEvent(new CustomEvent('ssx:turf', { detail: { type: 'counter', gang: 'dustjaws', block: 'hab-stacks' } })); return { ok: r.ok, sec: B.record().tipoffSec, warn: window.__toasts.find(t => /Rusk/.test(t)) || null, cheaper: B.price({ stars: 2, personality: 'on_take', colsec: 0, dirty: 0, night: false, priors: 0, tipoff: false }) > B.price({ stars: 2, personality: 'on_take', colsec: 0, dirty: 0, night: false, priors: 0, tipoff: true }) }; });
    ok('patrolSheet', R.tipoff, R.tipoff.ok && R.tipoff.sec > 800 && !!R.tipoff.warn && R.tipoff.cheaper);
    if (desk) { // hotkey ; pays the first option
      await G(() => { window.__app.surface.world.setWanted(1, 't'); window.SSX.bribes.debug.spot({ personality: 'on_take' }); }); await sleep(200);
      await page.keyboard.press('Semicolon'); await sleep(300);
      R.hotkey = await G(() => ({ enc: !!window.SSX.bribes.encounter, ev: window.__bev.slice(-1)[0] }));
      ok('hotkey', R.hotkey, !R.hotkey.enc && /paid|refused/.test(R.hotkey.ev));
    }
    await G(() => { window.SSX.bribes.debug.clear(); window.__app.surface.world.setWanted(0); });
    ok('noSecondDock', await G(() => document.querySelectorAll('#ssxDock').length <= 1 && !document.getElementById('dockBribe')));
    ok('persist', await G(() => !!localStorage.getItem('ssx.bribes.v1')));
    R.events = await G(() => [...new Set(window.__bev)]);
  } catch (e) { R.fatal = e.message; bad.push('fatal'); }
  R.errors = errors.slice(0, 8); if (errors.length) bad.push('errors'); R.bad = bad;
  console.log(JSON.stringify(R)); await browser.close();
})();
