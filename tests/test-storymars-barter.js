// v7.5 storymars barter hooks against a stub SSX.contraband (Marsmania's API isn't on main yet).
// A) no API: nothing registers, nothing breaks.  B) API appears late with no offers: our 14 barter.json rows register
// lazily and every one works (engine gives + story unlocks, deferred withdrawal inert).  C) Marsmania already loaded
// barter.json: we register nothing, attach only the 3 story hooks, and never double-apply a give.
// BASE=http://localhost:8937/ DEV="iPhone 14" BR=webkit [BARTER_JSON=/workspace/solar-system-story/mars-city/barter.json] node test-storymars-barter.js
const fs = require('fs');
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8937/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STUB = preload => { const offers = {}, calls = []; window.SSX = window.SSX || {};
  window.SSX.contraband = { offers, calls,
    registerOffer(o) { if (!o.id || !o.npc || !o.district || !Array.isArray(o.wants) || !o.gives || typeof o.onTrade !== 'function') throw new Error('bad offer ' + o.id); if (offers[o.id]) return false; offers[o.id] = o; return true; },
    barter(item, qty, offerId) { const o = offers[offerId]; if (!o) return { ok: false, msg: 'no offer' }; const w = o.wants[0]; if (item !== w.item || qty < w.qty) return { ok: false, msg: 'short' }; calls.push(offerId); return o.onTrade({ item, qty, offerId }); } };
  if (preload) for (const o of preload) offers[o.id] = { ...o, onTrade: () => { calls.push('mm:' + o.id); return { ok: true, msg: 'mm' }; } }; };
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const dev = DEV === 'desktop' ? { viewport: { width: 1366, height: 820 } } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const ctx = await browser.newContext(dev); let page;
  const errors = [], R = { tag: DEV + ' ' + BR }, bad = [];
  const G = (f, a) => page.evaluate(f, a);
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const open = async () => { page = await ctx.newPage(); page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /storymars/.test(m.text())) errors.push(m.text().slice(0, 200)); });
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.removeItem('ssx.progress.v1'); window.__app.game?.reload?.(); });
    await G(w => window.__app.landOn(window.__app.bodies.find(b => b.name === w).mesh), 'Mars');
    await wait(() => { const s = window.__app.state; return s.onSurface && !s.transitioning && window.__app.surface.info?.intro === 0; }, 120000); await sleep(1200); };
  const trade = id => G(id => { const o = window.SSX.contraband.offers[id]; const r = window.SSX.contraband.barter(o.wants[0].item, o.wants[0].qty, id); return r && { ok: r.ok, msg: r.msg, unlocked: r.unlocked, inert: r.inert }; }, id);
  const req = id => G(async id => { const GM = await import('./game.js?v=7.5.1'); return GM.QUESTS.find(q => q.id === id).requires.length; }, id);
  try {
    await open();
    const rows = await G(() => window.__storymars.barter.offers);
    ok('rows', rows.length, rows.length === 14);
    if (process.env.BARTER_JSON && fs.existsSync(process.env.BARTER_JSON)) { // our copy must match Steve's file row for row
      const file = JSON.parse(fs.readFileSync(process.env.BARTER_JSON, 'utf8')).offers.filter(o => /Ozzie|Rusk|Ines|Vesna|Rook/.test(o.npc));
      const mine = await G(async () => (await import('./storymars.js?v=7.5.1')).BARTER);
      ok('matchesBarterJson', null, JSON.stringify(file) === JSON.stringify(mine));
    }
    ok('A:noApiNoRegister', (await G(() => window.__storymars.barter.registered.length)) === 0);
    // B) API appears late, empty
    await G(STUB, null);
    ok('B:lazyRegister', await wait(() => window.__storymars.barter.registered.length === 14, 5000));
    ok('B:fictional', null, await G(() => Object.values(window.SSX.contraband.offers).every(o => o.wants.every(w => !/[A-Z]/.test(w.item)))));
    ok('B:shortRefused', (await G(() => window.SSX.contraband.barter('glow_dust', 1, 'ozzie-iron-t2-viper'))).ok === false);
    await trade('ozzie-iron-t1-breacher'); ok('B:ozzieBreacher', await G(() => window.__app.game.progress.unlocks.includes('weapon:shotgun') && window.__app.game.progress.inv.shells >= 12));
    const r0 = await G(() => window.__app.game.progress.inv.rounds || 0); await trade('ozzie-iron-ammo-bulk');
    ok('B:ozzieBulkOnlyOwned', `rounds ${r0}→${await G(() => window.__app.game.progress.inv.rounds || 0)}`, (await G(() => window.__app.game.progress.inv.rounds || 0)) === r0);
    await G(() => window.__app.surface.world.setWanted(0)); ok('B:ruskCleanRefused', (await trade('rusk-wipe-1')).ok === false);
    await G(() => window.__app.surface.world.setWanted(2)); await trade('rusk-wipe-1'); ok('B:ruskWipe1', await G(() => window.__app.surface.world.wanted) === 1);
    await G(() => window.__app.surface.world.setWanted(0));
    ok('B:inesVip', (await trade('ines-velvet-vip-dust')).ok && await G(() => window.__app.game.flag('vip')));
    const v = await trade('vesna-product-unlock-cook'); ok('B:vesnaUnlock', v.unlocked, v.unlocked === 'vesna-04-cook' && (await req('vesna-04-cook')) === 0);
    ok('B:vesnaOnce', (await trade('vesna-product-unlock-cook')).ok === false);
    ok('B:vesnaRestock', (await trade('vesna-product-restock')).ok === true);
    const k = await trade('rook-product-unlock-crew'); ok('B:rookUnlock', k.unlocked, k.unlocked === 'rook-04-crew' && (await req('rook-04-crew')) === 0);
    const wd = await trade('rook-product-unlock-withdrawal'); ok('B:withdrawalInert', wd.inert === true && wd.ok === false);
    ok('B:rookAcceptsEarly', await G(() => { const g = window.__app.game; g.accept('rook-04-crew'); const id = g.debug.quest()?.id; g.abandon(); return id === 'rook-04-crew'; }));
    await page.close();
    // C) Marsmania already registered barter.json: attach only
    await open();
    const all = await G(async () => (await import('./storymars.js?v=7.5.1')).BARTER);
    await G(STUB, all);
    ok('C:attachedStory', await wait(() => window.__storymars.barter.attached.length === 3, 5000) && await G(() => window.__storymars.barter.attached.sort().join(',')));
    ok('C:registeredNone', (await G(() => window.__storymars.barter.registered.length)) === 0);
    const sh0 = await G(() => window.__app.game.progress.inv.shells || 0); await trade('ozzie-iron-t1-breacher');
    ok('C:noDoubleGive', await G(() => window.__app.game.progress.inv.shells || 0) === sh0 && await G(() => window.SSX.contraband.calls.includes('mm:ozzie-iron-t1-breacher')));
    const vc = await trade('vesna-product-unlock-cook');
    ok('C:vesnaBothHandlers', vc.unlocked, vc.unlocked === 'vesna-04-cook' && await G(() => window.SSX.contraband.calls.includes('mm:vesna-product-unlock-cook')));
    const wc = await trade('rook-product-unlock-withdrawal');
    ok('C:withdrawalInertNoCharge', wc.ok === false && !(await G(() => window.SSX.contraband.calls.includes('mm:rook-product-unlock-withdrawal'))));
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || 'none', errors.length === 0);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
