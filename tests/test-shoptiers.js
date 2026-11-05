// v7.5.45 shop restock tiers + bigger Red Line Motors lot. Buy Ozzie's out -> Tier 2 rolls in (toast, shelf, list), a new gun
// buys, equips and fires through game.fire; clothes shop rolls too; dealer lists the new rides, WAR RIGS appear after a full lot.
// BASE=http://localhost:8777/ BR=chromium DEV="iPhone 14" OUT=/workspace/shops/ node test-shoptiers.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/tmp/', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...d } = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : devices[DEV];
  const ctx = await browser.newContext(d), page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const errors = [], toasts = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v, c) => { if (c === undefined) c = v; R[k] = v ?? !!c; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(() => { localStorage.removeItem('ssx.progress.v1'); localStorage.removeItem('ssx.shoptiers.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && !!window.SSX?.arsenal, 180000);
    ok('patched', null, await wait(() => window.__app.surface.game.__shopTiers && window.__app.surface.game.__marsShops && !!window.SSX_SHOPTIER, 20000));
    await G(() => { const t = window.__app.toast; window.__app.toast = (m, ms) => { (window.__toasts ||= []).push(m); return t(m, ms); }; window.__app.game.debug.credits(90000); });
    ok('tier1', await G(() => window.SSX_SHOPTIER.tierOf('guns')), await G(() => window.SSX_SHOPTIER.tierOf('guns') === 1));
    ok('sealedSlot', await G(() => window.__app.game.shopItem('st:guns:#0')?.why), await G(() => window.__app.game.shopItem('st:guns:#0')?.ok === false));
    // buy Ozzie's out (weapons + blades)
    const bought = await G(() => { const g = window.__app.game; return g.shopList('guns').items.filter(i => (i.kind === 'weapon' || i.kind === 'melee') && !i.owned).map(i => [i.id, g.buy(i.id).ok]); });
    ok('boughtBase', bought.map(b => b.join(':')).join(' '), bought.every(b => b[1]));
    ok('tier2', await G(() => window.SSX_SHOPTIER.tierOf('guns')), await G(() => window.SSX_SHOPTIER.tierOf('guns') === 2));
    ok('toast', await G(() => (window.__toasts || []).find(t => /New stock in/.test(t)) || ''), await G(() => (window.__toasts || []).some(t => /New stock in/.test(t))));
    const L = await G(() => { const l = window.__app.game.shopList('guns'); return { tier: l.tier, max: l.tierMax, ids: l.items.filter(i => i.id.startsWith('st:')).map(i => i.id) }; });
    ok('listTier2', JSON.stringify(L), L.tier === 2 && L.max === 5 && L.ids.includes('st:guns:revolver'));
    const rb = await G(() => { const g = window.__app.game, r = g.buy('st:guns:revolver'), A = window.SSX.arsenal; return { r, owned: A.owned('revolver'), cur: A.current()?.id }; });
    ok('buyRevolver', JSON.stringify(rb), rb.r.ok && rb.owned && rb.cur === 'revolver');
    const fired = await G(async () => { const A = window.SSX.arsenal, s0 = A.debug.stats(), t0 = performance.now(); while (A.debug.stats().shots - s0.shots < 2 && performance.now() - t0 < 15000) { window.__app.game.fire({ x: 0, y: 0.05 }); await new Promise(r => setTimeout(r, 80)); } return A.debug.stats().shots - s0.shots; });
    ok('revolverFires', fired, fired >= 2);
    // the rest of tier 2 -> tier 3; thumper launcher fires its frags later
    await G(() => { const g = window.__app.game; for (const i of g.shopList('guns').items) if (i.id.startsWith('st:') && i.kind !== 'ammo' && !i.owned) g.buy(i.id); });
    ok('tier3', await G(() => window.SSX_SHOPTIER.tierOf('guns')), await G(() => window.SSX_SHOPTIER.tierOf('guns') === 3));
    // clothes shop roll (Threadline): own every base bandana + paint
    await G(() => { const g = window.__app.game; for (const i of g.shopList('ms:ms_clothes_oly').items) if (!i.owned) g.buy(i.id); });
    ok('clothesTier2', await G(() => window.SSX_SHOPTIER.tierOf('ms_clothes_oly')), await G(() => window.SSX_SHOPTIER.tierOf('ms_clothes_oly') === 2));
    // walk into Ozzie's and look at the NEW STOCK shelf
    const door = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'guns'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [door.x, door.z]); await sleep(800);
    await G(() => document.getElementById('driveBtn').click()); const inn = await wait(() => window.__app.surface.info.inside?.kind === 'guns', 15000); await sleep(800);
    ok('enterGuns', null, inn);
    const shelf = await G(() => { const s = window.__app.surface, w = s.world.wareList().find(x => x.id === 'st:guns:#0'), b = s.world.inside; if (!w) return null; s.debugInside(w.x - (b.x0 + b.x1) / 2 + Number(window.__SX || 2.6), w.z - (b.z0 + b.z1) / 2 + 1.2, Number(window.__SY ?? Math.PI / 2)); return window.__app.game.shopItem('st:guns:#0'); });
    ok('shelfSlot', shelf?.name, !!shelf && shelf.tier === 3);
    await G(() => { window.__SZ = Number(new URLSearchParams(location.search).get('sz') ?? 2.2); document.querySelector('[data-ob="skip"]')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); document.querySelector('[data-ob="skip"]')?.click(); }); for (const sel of ['[data-ob="x"]', '[data-ob="skip"]']) { await G(sel => document.querySelector(sel)?.click(), sel); await sleep(300); }
    for (const y of (process.env.YAWS || '1.2').split(',')) { await G(([y]) => { window.__SY = y; const s = window.__app.surface, w = s.world.wareList().find(x => x.id === 'st:guns:#0'), b = s.world.inside; s.debugInside(w.x - (b.x0 + b.x1) / 2 + 3.4, w.z - (b.z0 + b.z1) / 2 + Number(window.__SZ ?? 2.2), +y); }, [y]); await sleep(1500); await page.screenshot({ path: out + 'shop-restocked-ozzies-shelf' + (process.env.YAWS ? '-' + y : '') + '.png' }); }
    await G(() => window.__app.openShop?.('guns', 'Ozzie')); await sleep(900);
    R.shopTitle = await G(() => document.getElementById('shopTitle')?.textContent || '');
    await page.screenshot({ path: out + 'shop-restocked-ozzies-list.png' });
    await G(() => window.__app.closeShop?.() || document.querySelector('#shopClose, [data-close]')?.click()); await sleep(300);
    // dealership
    await G(() => { const s = window.__app.surface; if (s.info.inside) s.world.leaveInterior?.(); }); await sleep(500);
    await G(() => document.querySelector('#shop.open .close, #shopX')?.click());
    const st = await G(() => window.__dealer.stock.map(s => s.kind));
    ok('newRides', st.join(','), ['rust_rat', 'dune_hog', 'junk_hauler', 'black_widow'].every(k => st.includes(k)) && !st.includes('ghost_sled'));
    await G(() => window.__dealer.noteBought(window.__dealer.wave.lot)); await G(() => window.__dealer.rebuildPodiums());
    const st2 = await G(() => window.__dealer.stock.map(s => s.kind));
    ok('warRigs', st2.length, st2.includes('ghost_sled') && st2.includes('regolith_reaper'));
    const by = await G(() => window.__dealer.buy('dune_hog'));
    ok('buyDuneHog', by.msg, by.ok);
    await sleep(800); ok('drivesDuneHog', await G(() => window.__dealer.ride?.kind), await wait(() => window.__dealer.ride?.kind === 'dune_hog', 8000));
    await G(() => { window.__dealer.tp('dealer', 26); }); await sleep(1200);
    await G(() => { const s = window.__app.surface, c = s.camera || window.__app.camera; }); 
    for (const y of (process.env.DYAWS || '0').split(',')) { await G(([y, dx]) => { const p = window.__dealer.spots.dealer; window.__app.surface.debugPlace(p.x - 12 + dx, p.z + 17, +y); }, [y, Number(process.env.DX || -10)]); await sleep(2500); await page.screenshot({ path: out + 'dealership-lot-iphone14' + (process.env.DYAWS ? '-' + y : '') + '.png' }); }
    await G(() => window.__dealer.openDealer()); await sleep(2500);
    await page.screenshot({ path: out + 'dealership-sheet-iphone14.png' });
    ok('podiums', await G(() => window.__dealer.stock.length), true);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors.slice(0, 8); R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
