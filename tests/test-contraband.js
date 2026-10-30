// v7.5 test: Mars contraband economy (mars/contraband.js). Land on Mars, walk to Blue in Red Tape Flats, buy through the
// stash panel (taps), check district pricing, sell to an Olympus Row buyer (panel taps), saturation, the
// SSX.contraband API, carry limits, an undercover bust (stars + seized product) and no console errors.
// BASE=http://localhost:8852/ BR=webkit DEV="iPhone 14" OUT=/tmp/cb/ node test-contraband.js   (DEV=desktop for 1366x768)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8852/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || '/tmp/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(250); };
  const goAJ = (x, z) => G(([x, z]) => { const s = window.__app.surface, c = s.info.colony; s.debugMove(c.x + x, c.z + z, 0); }, [x, z]);
  const C = () => G(() => window.__app.game.progress.credits);
  const shot = async p => { try { await page.screenshot({ path: p, timeout: 120000 }); R.shots = (R.shots || []).concat(p); } catch (e) { R.shotFail = (R.shotFail || []).concat(p); } };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); });
    ok('api', await G(() => !!window.SSX?.contraband && typeof window.SSX.contraband.sell === 'function'));
    ok('menuItem', await G(() => !!document.getElementById('rmContraband')));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.contraband.reset(); const P = window.__app.game.progress; P.credits = 3000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    ok('barterJson', await wait(() => window.SSX.contraband.barterSource === 'barter.json', 15000));
    R.items = await G(() => window.SSX.contraband.items().map(i => i.id).join(','));
    // pricing by district
    const pr = await G(() => { const c = window.SSX.contraband; return ['red-tape-flats', 'ares-junction', 'ares-beltway', 'olympus-row', 'helios-heights'].map(d => c.buyerPrice('glowdust', d)); });
    R.glowdustPrices = pr.join('/'); ok('flatsCheapest', pr[0] < pr[1] && pr[1] < pr[3] && pr[3] < pr[4]);
    ok('supplierPrice', await G(() => window.SSX.contraband.supplierPrice('glowdust')), await G(() => window.SSX.contraband.supplierPrice('glowdust') === 40));
    // walk to Blue
    const sup = await G(() => window.SSX.contraband.supplier.at); await goAJ(sup[0], sup[1] + 2); await sleep(700);
    ok('district', await G(() => window.SSX.contraband.district()), await G(() => window.SSX.contraband.district() === 'red-tape-flats'));
    ok('blueButton', await wait(() => { const b = document.getElementById('cbBtn'); return b && getComputedStyle(b).display !== 'none' && /Blue/.test(b.textContent); }, 5000));
    const bb = await center('#cbBtn'); ok('blueBtn44', bb?.h, bb?.h >= 44);
    await tapSel('#cbBtn');
    ok('panelOpen', await wait(() => document.getElementById('cbPanel').classList.contains('show'), 3000));
    const c0 = await C();
    await tapSel('button[data-a="buy"][data-i="glowdust"][data-q="5"]');
    await tapSel('button[data-a="buy"][data-i="voidhoney"][data-q="5"]');
    await tapSel('button[data-a="buy"][data-i="lowg"][data-q="5"]');
    const st = await G(() => window.SSX.contraband.stash()); R.stashAfterBuy = JSON.stringify(st.items);
    ok('boughtGlow', st.items.glowdust?.qty === 5); ok('voidHoneyCap4', st.items.voidhoney?.qty === 4);
    ok('paid', await C(), (await C()) === c0 - 5 * 40 - 4 * 160 - 5 * 20);
    const tgt = await G(() => [...document.querySelectorAll('#cbPanel button')].map(b => b.getBoundingClientRect().height)); ok('panelTargets44', Math.min(...tgt), Math.min(...tgt) >= 44);
    const sty = await G(() => { const b = document.querySelector('#cbPanel button'); const s = getComputedStyle(b); return s.backgroundColor + '|' + s.color; }); ok('highContrast', sty, sty === 'rgb(0, 0, 0)|rgb(255, 255, 255)');
    await shot(`${out}contraband-${tag}-blue.png`);
    await tapSel('#cbClose'); ok('panelClosed', await G(() => !document.getElementById('cbPanel').classList.contains('show')));
    // carry limit via API
    const cap = await G(() => { const c = window.SSX.contraband; const r = c.buy('redstatic', 50); return { r, cap: c.capacity() }; });
    ok('carryLimit', `${cap.r.qty} ${cap.cap.used}/${cap.cap.max}`, cap.cap.used <= cap.cap.max && cap.r.qty === 6);
    // barter (Steve's barter.json): Ozzie's back counter swaps glow-dust for a shotgun + shells, through panel taps
    R.offers = await G(() => window.SSX.contraband.barterOffers(null).length);
    const oz = await G(() => window.SSX.contraband.npcs().find(n => n.id === 'ozzie').spot); await goAJ(oz[0], oz[1] + 1); await sleep(700);
    ok('ozzieButton', await wait(() => /Ozzie/.test(document.getElementById('cbBtn').textContent) && getComputedStyle(document.getElementById('cbBtn')).display !== 'none', 5000));
    await tapSel('#cbBtn'); await wait(() => document.getElementById('cbPanel').classList.contains('show'), 3000);
    const cK = await C(), gK = await G(() => window.SSX.contraband.stash().items.glowdust.qty), sh0 = await G(() => window.__app.game.progress.inv.shells || 0);
    await G(() => { window.__rnd = Math.random; Math.random = () => 0.99; }); // no bust roll
    await tapSel('button[data-a="trade"][data-i="ozzie-iron-t1-breacher"]');
    await G(() => { Math.random = window.__rnd; });
    ok('barterShotgun', await G(() => window.__app.game.shopItem('shotgun').owned));
    ok('barterNoCash', `${cK}->${await C()}`, (await C()) === cK);
    ok('barterTookProduct', await G(() => window.SSX.contraband.stash().items.glowdust.qty), (await G(() => window.SSX.contraband.stash().items.glowdust.qty)) === gK - 2);
    ok('barterAmmo', `${sh0}->${await G(() => window.__app.game.progress.inv.shells)}`, (await G(() => window.__app.game.progress.inv.shells)) >= sh0 + 12);
    ok('offerNowBlocked', await G(() => window.SSX.contraband.offer('ozzie-iron-t1-breacher').available === false));
    ok('storyLocked', await G(() => window.SSX.contraband.offer('ozzie-iron-t3-railrifle').why), await G(() => /Story/.test(window.SSX.contraband.offer('ozzie-iron-t3-railrifle').why)));
    const tg2 = await G(() => [...document.querySelectorAll('#cbPanel button')].map(b => b.getBoundingClientRect().height)); ok('barterTargets44', Math.min(...tg2), Math.min(...tg2) >= 44);
    await shot(`${out}contraband-${tag}-barter.png`);
    await tapSel('#cbClose'); ok('barterClosed', await G(() => !document.getElementById('cbPanel').classList.contains('show')));
    // Olympus Row buyer: force an honest buyer and no witnesses
    await G(() => { window.__rnd = Math.random; Math.random = () => 0.99; });
    const spots = await G(() => window.SSX.contraband.spots); const oi = spots.findIndex(s => s.d === 'olympus-row');
    await goAJ(spots[oi].at[0], spots[oi].at[1] + 1); await sleep(700);
    ok('dealButton', await wait(() => /Deal/.test(document.getElementById('cbBtn').textContent) && getComputedStyle(document.getElementById('cbBtn')).display !== 'none', 5000));
    await tapSel('#cbBtn'); await wait(() => document.getElementById('cbPanel').classList.contains('show'), 3000);
    const p1 = await G(() => window.SSX.contraband.buyerPrice('glowdust', 'olympus-row')), c1 = await C();
    await tapSel('button[data-a="sell"][data-i="glowdust"][data-q="1"]');
    ok('sold1', `${p1} -> +${(await C()) - c1}`, (await C()) - c1 === p1);
    const p2 = await G(() => window.SSX.contraband.buyerPrice('glowdust', 'olympus-row')); ok('saturationDrops', `${p1}->${p2}`, p2 < p1);
    await shot(`${out}contraband-${tag}-deal.png`);
    // the buyer walks after one deal; sell-all through the API at the same corner to flood it
    const sa = await G(() => { const c = window.SSX.contraband; const before = c.buyerPrice('lowg', 'olympus-row'); const r = c.sell('lowg', 5, 'olympus-row'); return { before, r, after: c.buyerPrice('lowg', 'olympus-row'), sat: c.saturation('lowg', 'olympus-row') }; });
    ok('apiSell', `${sa.r.qty}@${sa.r.unit} (${sa.before}->${sa.after}, sat ${sa.sat})`, sa.r.ok && sa.r.qty === 5 && sa.after < sa.before && sa.sat > 0 && sa.r.credits < sa.before * 5);
    ok('noStarsHonest', await G(() => window.__app.surface.world.wanted === 0));
    await G(() => { Math.random = window.__rnd; }); await tapSel('#cbClose');
    // API add/remove/on
    const api = await G(() => { const c = window.SSX.contraband, ev = []; const off = c.on(e => ev.push(e.type)); c.add('glowdust', 2, 0.5); const rm = c.remove('glowdust', 1); off(); return { rm, ev: ev.join(','), q: c.stash().items.glowdust.qty }; });
    ok('apiAddRemove', JSON.stringify(api), api.rm === 1 && /buy/.test(api.ev));
    // undercover bust at a Helios buyer
    await G(() => { window.__rnd = Math.random; Math.random = () => 0.0; });
    const hi = spots.findIndex(s => s.d === 'helios-heights'); await goAJ(spots[hi].at[0], spots[hi].at[1] + 1); await sleep(700);
    await wait(() => /Deal/.test(document.getElementById('cbBtn').textContent), 5000); await tapSel('#cbBtn'); await sleep(300);
    const rq = await G(() => window.SSX.contraband.stash().items.redstatic?.qty || 0);
    await tapSel('button[data-a="sell"][data-i="redstatic"][data-q="all"]');
    await G(() => { Math.random = window.__rnd; });
    const w = await G(() => window.__app.surface.world.wanted); ok('bustStars', w, w >= 2);
    ok('bustSeized', `${rq}->${await G(() => window.SSX.contraband.stash().items.redstatic?.qty || 0)}`, rq > 0 && (await G(() => !window.SSX.contraband.stash().items.redstatic)));
    await G(() => window.__app.surface.world.setWanted(0));
    // favors through the API, with stubs for the partner modules (heist / garage / gang live on other branches)
    const fav = await G(() => { const c = window.SSX.contraband, w = window.__app.surface.world, out = {}, calls = []; const r0 = Math.random; Math.random = () => 0.99;
      try {
        w.setWanted(2); c.add('glowdust', 2); out.rusk = c.barter(null, null, 'rusk-wipe-1').ok && w.wanted === 1; w.setWanted(0);
        out.heistMissing = (window.SSX.heist || window.heist) ? true : /heist/i.test(c.offer('porter-tip-voss-cameras').why); /* v7.5.1: Ben's heist.js ships alongside */ out.garageMissing = window.SSX.garage ? true : /garage/i.test(c.offer('torque-upgrade-armor').why); /* the dealer/garage module ships on main */
        window.SSX.heist = { applyTip: (id, t) => { calls.push(['tip', id, t.type]); return { id, type: t.type }; } };
        let tip = null; addEventListener('ssx:tip', e => { tip = e.detail; }, { once: true });
        try { for (const f of ['helios_staff', 'torque', 'dustjaws', 'saltblood']) window.SSX.rep?.add?.(f, 30, 'test'); } catch (e) {} // v7.5.4: some favors need faction rep (SSX.rep)
        c.add('glowdust', 2); c.add('lungful', 6); out.heist = c.barter('glowdust', 2, 'porter-tip-voss-cameras').ok && calls.some(k => k[1] === 'lita-04-voss' && k[2] === 'cameras') && tip?.heistId === 'lita-04-voss';
        window.SSX.garage = { grantUpgrade: (v, u) => { calls.push(['up', v, u]); return { ok: true, msg: 'fitted' }; }, grantVehicle: (id, o) => { calls.push(['veh', id, !!o?.noPlates]); return { ok: true, msg: 'keys' }; } };
        c.add('salvage', 8); out.garageUp = c.barter('salvage', 8, 'torque-upgrade-armor').ok && calls.some(k => k[0] === 'up' && k[1] === 'current' && k[2] === 'roverarmor');
        out.dutchLocked = /Story/.test(c.offer('dutch-clean-rover').why);
        c.registerOffer({ id: 'test-noplates', npc: 'test-dutch', district: 'red-tape-flats', wants: [{ item: 'glowdust', qty: 1 }, { item: 'credits', qty: 50 }], gives: { type: 'garage_vehicle', vehicleId: 'rover', opts: { noPlates: true } } });
        const cr = window.__app.game.progress.credits; c.add('glowdust', 1); out.garageVeh = c.barter(null, null, 'test-noplates').ok && calls.some(k => k[0] === 'veh' && k[2]) && window.__app.game.progress.credits === cr - 50;
        window.SSX.gang = { spawnBackup: b => { calls.push(['gang', b.faction, b.count]); return true; } };
        c.registerOffer({ id: 'test-gang', npc: 'test-marrow', district: 'red-tape-flats', wants: { item: 'glowdust', qty: 1 }, gives: { type: 'gang_backup', faction: 'saltblood', count: 3, durationSec: 60 }, risk: { wanted_on_trade: 1 } });
        c.add('glowdust', 1); out.gang = c.barter('glowdust', 1, 'test-gang').ok && calls.some(k => k[0] === 'gang' && k[2] === 3) && c.backup > 0 && w.wanted === 1; w.setWanted(0);
        c.add('red_dust_whiskey', 1); out.venue = c.barter(null, null, 'nyx-static-door').ok && c.hasAccess('the_static_door');
        out.pricesFromJson = c.buyerPrice('hive_resin', 'red_tape_flats') === 40 && c.buyerPrice('hive_resin', 'helios-heights') === 70;
        out.offersFlats = c.barterOffers('red-tape-flats').length;
      } finally { Math.random = r0; delete window.SSX.heist; delete window.SSX.garage; delete window.SSX.gang; }
      return out; });
    R.fav = fav; for (const k of ['rusk', 'heistMissing', 'garageMissing', 'heist', 'garageUp', 'dutchLocked', 'garageVeh', 'gang', 'venue', 'pricesFromJson']) ok('favor_' + k, fav[k]);
    // registerOffer: custom reward with onTrade(ctx), and a cancel that refunds the product
    const reg = await G(() => { const c = window.SSX.contraband; let got = null;
      c.registerOffer({ id: 'test-vesna', npc: 'vesna', district: 'ares-junction', wants: { item: 'glowdust', qty: 1 }, gives: { type: 'unlock', flag: 'test:vesna-job', text: 'Vesna: job\'s yours.' }, onTrade: ctx => { got = { item: ctx.item, qty: ctx.qty, npc: ctx.offer.npc, hasGame: !!ctx.game }; } });
      c.registerOffer({ id: 'test-cancel', npc: 'rook', district: 'ares-junction', wants: { item: 'glowdust', qty: 1 }, gives: { type: 'custom' }, onTrade: () => ({ ok: false, msg: 'Rook: changed my mind.' }) });
      c.add('glowdust', 2); const q0 = c.stash().items.glowdust.qty; const a = c.barter('glowdust', 1, 'test-vesna'); const b = c.barter('glowdust', 1, 'test-cancel');
      return { a: a.ok, flag: window.__app.game.flag('test:vesna-job'), got, cancel: !b.ok && c.stash().items.glowdust.qty === q0 - 1, listed: c.barterOffers('ares-junction').some(o => o.id === 'test-vesna') }; });
    ok('registerOffer', JSON.stringify(reg), reg.a && reg.flag && reg.got?.qty === 1 && reg.got.hasGame && reg.cancel && reg.listed);
    // stash panel from the menu for the screenshot
    await G(() => window.SSX.contraband.open()); await sleep(300); await shot(`${out}contraband-${tag}-stash.png`);
    ok('stashPanel', await G(() => /Stash/.test(document.getElementById('cbPanel').textContent)));
    await G(() => window.SSX.contraband.close());
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors; if (errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
