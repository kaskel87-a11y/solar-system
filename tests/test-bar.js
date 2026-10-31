// v7.6 test: Velvet Airlock space-liquor bar (bar.js). Enter the club, stand at the north end of the west bar: the
// action button reads '🥃 Nova' (black, white text) and opens the bar menu through the adult gate. With no SSX.liquor
// only the house drinks show. With a stubbed SSX.liquor the MAIN (top) section is 'Sell your bottles': 1.3x the alien
// price (65 cr for a 50 cr moonshine, 39 for hooch, 91 for a wine with no alien price = 70 base), bottles leave the
// inventory, cr are paid, the toast reads 'Sold N bottles · +X cr', and the daily cap (12) stops selling and is saved.
// Then house drinks for cr (tipsy -> heavy vignette), your own bottle tips you into a blackout and you wake up outside
// the club door. Short-of-cash buys nothing. Danny and the slots still work.
// BASE=http://127.0.0.1:8913/ BR=webkit DEV="iPhone 14" VP=393x852 SHOTS_DIR=shots/bar node tests/test-bar.js   (DEV=desktop BR=chromium for keys)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const vp = process.env.VP && process.env.VP.split('x').map(Number);
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV], ...(vp ? { viewport: { width: vp[0], height: vp[1] } } : {}) }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = `${DEV}${vp ? '-' + process.env.VP : ''}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, top: t && (t.id || t.closest('[id]')?.id), cls: t && t.className }; }, sel);
  const tapSel = async sel => { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(120); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn'); };
  const credits = () => G(() => window.__app.game.progress.credits);
  const isOpen = () => G(() => window.__bar.isOpen && getComputedStyle(document.getElementById('barPanel')).display === 'flex');
  const shot = async n => { const p = `${out}bar-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const toasts = () => G(() => window.__toasts.slice());
  const atCounter = async () => { await G(() => window.__app.surface.debugInside(-8.2, -1.9, Math.PI / 2)); return wait(() => window.__app.surface.info.spot?.id === 'liquor' && /🥃 Nova/.test(document.getElementById('driveBtn').textContent), 6000); };
  const openMenu = async () => { await sleep(500); await act(); const r = await wait(() => window.__bar.isOpen && getComputedStyle(document.getElementById('barPanel')).display === 'flex', 3000); await sleep(400); return r; }; // past the 300 ms ghost-tap guard
  const closeMenu = async () => { if (desk) await page.keyboard.press('Escape'); else await tapSel('#barLeave'); return wait(() => !window.__bar.isOpen, 3000); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => { window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('toast'); if (t.classList.contains('on')) window.__toasts.push(t.textContent); }).observe(document.getElementById('toast'), { childList: true, characterData: true, subtree: true, attributes: true }); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club')); R.clubDoor = cd && { x: +cd.x.toFixed(1), z: +cd.z.toFixed(1) };
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(800);
    await G(() => window.__app.surface.registerTick((dt, c) => { window.__pp = { x: c.player.x, z: c.player.z }; window.__camZ = c.camera.rotation.z; }));
    ok('moduleUp', await G(() => !!window.__bar && window.__bar.drinks.map(d => `${d.name} ${d.price}`).join(', ')));
    ok('noLiquorOnMain', await G(() => !window.SSX?.liquor && window.__bar.liquor.ok === false));
    // neighbours keep their own spots
    for (const [k, x, z, id] of [['atBar', -8.1, 1.5, 'bar'], ['atSlots', -6.85, 6.4, 'slots'], ['atDoor', 0, 7.0, 'leave']]) { await G(([x, z]) => window.__app.surface.debugInside(x, z, 0), [x, z]); await sleep(350); R[k] = await G(() => window.__app.surface.info.spot?.id); ok(k + 'Ok', R[k] === id); }
    // 1) prompt
    ok('prompt', await atCounter());
    const bw = await G(() => { const c = getComputedStyle(document.getElementById('driveBtn')); return c.backgroundColor + ' / ' + c.color; });
    ok('promptBW', bw, /rgba?\(0, 0, 0(, 1)?\)/.test(bw) && /255, 255, 255/.test(bw.split('/')[1]) && await G(() => document.body.classList.contains('barNear')));
    await sleep(1200); await shot('prompt');
    // 2) adult gate, then the menu without SSX.liquor: no sell section
    await act(); ok('adultGate', await wait(() => getComputedStyle(document.getElementById('adultGate')).display === 'flex', 3000));
    await tapSel('#adultYes'); ok('openNoLiquor', await wait(() => window.__bar.isOpen, 3000));
    ok('sellHiddenNoLiquor', await G(() => getComputedStyle(document.getElementById('barSell')).display === 'none' && getComputedStyle(document.getElementById('barOwn')).display === 'none' && document.querySelectorAll('[data-drink]').length === 4));
    await sleep(400); await shot('menu-noliquor');
    ok('closed1', await closeMenu());
    // 3) stub SSX.liquor (the farm still): moonshine 50 / hooch 30 at the aliens, a wine with no alien price
    await G(() => { const inv = { moonshine: { qty: 10, name: 'Red Rock Moonshine', icon: '🫙' }, hooch: { qty: 6, name: 'Dust Hooch', icon: '🍶' }, glow_wine: { qty: 2, name: 'Glowberry Wine', icon: '🍷' } };
      window.__inv = inv; (window.SSX = window.SSX || {}).liquor = { inventory: () => Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, { ...v }])), take: (id, n) => { if (!inv[id] || inv[id].qty < n) return false; inv[id].qty -= n; return true; }, alienPrice: id => ({ moonshine: 50, hooch: 30 })[id] }; });
    ok('liquorOn', await G(() => window.__bar.liquor.ok));
    ok('openWithLiquor', await openMenu());
    const order = await G(() => { const c = document.getElementById('barCard'), ids = ['barSell', 'barDrinks', 'barOwn'].map(i => document.getElementById(i).getBoundingClientRect().top); return { ids, first: c.querySelector('h4')?.textContent }; });
    ok('sellIsMain', JSON.stringify(order), /Sell your bottles/.test(order.first) && order.ids[0] < order.ids[1] && order.ids[1] < order.ids[2]);
    const prices = await G(() => [...document.querySelectorAll('#barSell .barRow small')].map(e => e.textContent));
    ok('prices1.3x', JSON.stringify(prices), /^65 cr each · aliens pay 50/.test(prices[0]) && /^39 cr each · aliens pay 30/.test(prices[1]) && /^91 cr each · aliens pay 70/.test(prices[2]));
    ok('capText', await G(() => /buys 12 more today/.test(document.getElementById('barSell').textContent)));
    const fit = await G(() => { const r = document.getElementById('barCard').getBoundingClientRect(); return { l: r.left, t: r.top, r: innerWidth - r.right, b: innerHeight - r.bottom }; });
    ok('fits', JSON.stringify(fit), fit.l >= 0 && fit.t >= 0 && fit.r >= 0 && fit.b >= 0);
    for (const s of ['#barSell [data-n="1"]', '#barSell .all', '[data-drink="lager"]', '#barLeave', '#barClose']) { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), s); const b = await center(s); ok('btn44 ' + s, `${Math.round(b.w)}x${Math.round(b.h)}`, b.h >= 44 && b.w >= 44); }
    const btnBW = await G(() => { const c = getComputedStyle(document.querySelector('[data-drink="lager"]')); return c.backgroundColor + ' / ' + c.color; }); ok('btnBW', btnBW, /rgb\(0, 0, 0\)/.test(btnBW) && /255, 255, 255/.test(btnBW));
    await G(() => document.getElementById('barCard').scrollTop = 0); await sleep(500); await shot('sell');
    // 4) sell 1 moonshine, then all of it (9), then hooch until the cap (2 of 6)
    let c0 = await credits(); await tapSel('#barSell [data-sell="moonshine"][data-n="1"]');
    ok('sold1', await wait(c => window.__app.game.progress.credits === c + 65 && window.__inv.moonshine.qty === 9, 3000, c0));
    ok('toast1', await wait(() => window.__toasts.some(t => /Sold 1 bottle · \+65 cr/.test(t)), 3000));
    c0 = await credits(); await tapSel('#barSell .all[data-sell="moonshine"]');
    ok('soldAll', await wait(c => window.__app.game.progress.credits === c + 585 && window.__inv.moonshine.qty === 0, 3000, c0));
    ok('toast9', await wait(() => window.__toasts.some(t => /Sold 9 bottles · \+585 cr/.test(t)), 4000));
    await sleep(250); await shot('sold');
    ok('capLeft2', await G(() => window.__bar.capLeft === 2 && /buys 2 more today/.test(document.getElementById('barSell').textContent)));
    c0 = await credits(); await tapSel('#barSell .all[data-sell="hooch"]');
    ok('soldToCap', await wait(c => window.__app.game.progress.credits === c + 78 && window.__inv.hooch.qty === 4, 3000, c0));
    ok('toastCap', await wait(() => window.__toasts.some(t => /Sold 2 bottles · \+78 cr/.test(t)), 4000));
    ok('capSaved', await G(() => JSON.stringify(JSON.parse(localStorage.getItem('ssx.bar.v1')))), await G(() => { const s = JSON.parse(localStorage.getItem('ssx.bar.v1')); return s.sold === 12 && s.day === window.__bar.day; }));
    ok('capButtonsOff', await G(() => window.__bar.capLeft === 0 && [...document.querySelectorAll('#barSell [data-sell]')].every(b => b.disabled) && /stocked up for today/.test(document.getElementById('barSell').textContent)));
    c0 = await credits(); const capRes = await G(() => window.__bar.sell('hooch', 1, true));
    ok('capBlocks', JSON.stringify(capRes), capRes.why === 'cap' && (await credits()) === c0 && (await G(() => window.__inv.hooch.qty)) === 4);
    await sleep(300); await G(() => document.getElementById('barCard').scrollTop = 0); await shot('sold-cap');
    await G(() => window.__bar.debug.setDay('2099-01-01')); ok('newDayResets', await G(() => window.__bar.capLeft === 12)); await G(() => window.__bar.debug.setDay(null));
    // 5) drinks for cr: lager + negroni -> tipsy
    c0 = await credits(); await tapSel('[data-drink="lager"]'); await sleep(350); await tapSel('[data-drink="nebula"]');
    ok('paidDrinks', await wait(c => window.__app.game.progress.credits === c - 45, 3000, c0));
    ok('tipsy', await G(() => window.__bar.stage + ' ' + window.__bar.level.toFixed(2)), await G(() => window.__bar.stage === 'tipsy'));
    await G(() => document.getElementById('barCard').scrollTop = 0); await sleep(300); await shot('menu-tipsy');
    ok('closed2', await closeMenu()); await sleep(1500);
    ok('veilTipsy', await G(() => +getComputedStyle(document.getElementById('barDrunk')).opacity), await G(() => +getComputedStyle(document.getElementById('barDrunk')).opacity > 0.2 && !document.getElementById('barDrunk').classList.contains('heavy')));
    const zs = []; for (let i = 0; i < 6; i++) { zs.push(await G(() => window.__camZ)); await sleep(250); } ok('camSway', zs.map(z => z.toFixed(4)).join(' '), new Set(zs.map(z => z.toFixed(4))).size > 2);
    await shot('tipsy');
    // 6) comet + breaker -> heavy
    ok('reopen', await openMenu()); c0 = await credits();
    await tapSel('[data-drink="comet"]'); await sleep(350); await tapSel('[data-drink="breaker"]');
    ok('paidHeavy', await wait(c => window.__app.game.progress.credits === c - 105, 3000, c0)); R.heavyCr = `${c0} -> ${await credits()}`;
    ok('heavy', await G(() => window.__bar.stage + ' ' + window.__bar.level.toFixed(2)), await G(() => window.__bar.stage === 'heavy'));
    ok('closed3', await closeMenu()); await sleep(1500);
    ok('veilHeavy', await G(() => document.getElementById('barDrunk').classList.contains('heavy') && +getComputedStyle(document.getElementById('barDrunk')).opacity > 0.8));
    await shot('heavy');
    // 7) your own glowberry wine on top: blackout, wake up outside the club door
    ok('reopen2', await openMenu());
    ok('ownListed', await G(() => getComputedStyle(document.getElementById('barOwn')).display !== 'none' && document.querySelectorAll('[data-own]').length === 2));
    await tapSel('[data-own="glow_wine"]');
    ok('ownTaken', await wait(() => window.__inv.glow_wine.qty === 1, 3000));
    ok('blackoutFade', await wait(() => document.getElementById('fadeBlack').classList.contains('on') && window.__bar.out, 4000));
    await sleep(300); await shot('blackout');
    ok('wokeOutside', await wait(() => !window.__app.surface.info.inside && !document.getElementById('fadeBlack').classList.contains('on') && !window.__bar.out, 9000));
    const pos = await G(() => window.__pp || null);
    R.wakePos = pos && { x: +pos.x.toFixed(1), z: +pos.z.toFixed(1) };
    ok('nearClubDoor', pos ? Math.hypot(pos.x - cd.x, pos.z - cd.z).toFixed(1) : 'n/a', !pos || Math.hypot(pos.x - cd.x, pos.z - cd.z) < 6);
    ok('wakeToast', await wait(() => window.__toasts.some(t => /wake up on the curb outside the Velvet Airlock/.test(t)), 5000));
    await sleep(800); await shot('wakeup-outside'); ok('stillWobbly', await G(() => window.__bar.stage));
    // 8) back in: short of cash buys nothing
    await G(() => window.__app.surface.enterBuilding()); ok('inClub2', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(500);
    await G(() => { window.__app.game.progress.credits = 10; window.__app.game.save(); window.__bar.debug.setLevel(0); });
    ok('prompt2', await atCounter()); ok('reopen3', await openMenu());
    await tapSel('[data-drink="lager"]'); await sleep(400);
    ok('broke', await G(() => document.getElementById('barMsg').textContent + ' | lvl ' + window.__bar.level + ' cr ' + window.__app.game.progress.credits), await G(() => /Short on cr/.test(document.getElementById('barMsg').textContent) && window.__app.game.progress.credits === 10 && window.__bar.level === 0));
    ok('closed4', await closeMenu());
    // 9) SSX.liquor goes away again: sell section hides
    await G(() => { delete window.SSX.liquor; }); ok('reopen4', await openMenu());
    ok('sellHiddenAgain', await G(() => getComputedStyle(document.getElementById('barSell')).display === 'none'));
    ok('closed5', await closeMenu());
    // 10) slots + Danny untouched
    await G(() => { window.__app.game.progress.credits = 1000; window.__app.game.save(); window.__app.surface.debugInside(-6.85, 6.4, Math.PI); });
    ok('slotsPrompt', await wait(() => /🎰 Play/.test(document.getElementById('driveBtn').textContent) && !document.body.classList.contains('barNear'), 4000));
    await G(() => { window.__app.game.setFlag?.('vip'); window.__app.surface.world.openVip(); window.__app.surface.debugInside(6.55, -5.3, 0); });
    ok('dannyLabel', await wait(() => /Private show 150/.test(document.getElementById('driveBtn').textContent), 4000));
    await sleep(500); await act(); ok('dannyOffer', await wait(() => getComputedStyle(document.getElementById('pshowOffer')).display === 'flex', 3000));
    await tapSel('#pshowNo').catch(() => G(() => document.getElementById('pshowNo')?.click()));
    ok('stats', JSON.stringify(await G(() => window.__bar.stats)));
    await G(() => window.__app.surface.leaveBuilding());
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
