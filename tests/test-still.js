// 🥃 Mars moonshine still (mars/still.js + stillcore.js): the farm sheet's 🥃 row opens the still; ⭐ short refused; a double
// tap on "Buy · 1,800 cr" charges once; the still stands by the dome with a 🥃 context button; potatoes / glow-berries / algae
// brew over in-game hours (farm.skip) into bottles; crates load into your rover (crate stack on the car + one caption); the
// Xen-7 aliens buy them through the 👽 Trade sheet; with Jeff's bar (#93) merged locally the Velvet Airlock sells and pours
// them through SSX.liquor; Rust Pit refused; BUSTED takes only the carried crates (no fine from us); the save + its #83
// mirror survive a reload.
// BASE=http://127.0.0.1:8897/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/still/ node tests/test-still.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8897/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/still/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const moved = await G(s => { const e = document.querySelector(s); if (!e) return false; const ps = []; for (let p = e.parentElement; p; p = p.parentElement) ps.push([p, p.scrollTop]); e.scrollIntoView({ block: 'center' }); return ps.some(([p, t]) => p.scrollTop !== t); }, sel); await sleep(moved ? 1000 : 150);
    await wait(s => { const b = document.querySelector(s); return !b || !b.dataset.hold; }, 1500, sel); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
  const dbl = sel => G(([s, desk]) => { const b = document.querySelector(s); if (!b) return 'no ' + s; const r = b.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const fire = el => { if (!el) return; if (desk) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })); return; }
      const o = { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
    fire(b); fire(b); fire(document.elementFromPoint(x, y)?.closest('button')); return true; }, [sel, desk]);
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); };
  const St = () => G(() => window.SSX.still.status());
  const cr = () => G(() => window.__app.game.progress.credits);
  const go = async (id, dz) => { await G(([id, dz]) => { const p = window.SSX.farm.places().find(q => q.id === id); window.__app.surface.debugMove(p.x, p.z + dz, 0); }, [id, dz]); await fr(4); };
  const shot = async n => { const p = `${out}still-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const BW = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: c.backgroundColor, fg: c.color, h: Math.round(r.height) }; }, sel);
  const isBW = b => !!b && /rgb\(0, 0, 0\)/.test(b.bg) && /255, 255, 255/.test(b.fg) && b.h >= 44;
  const stillOpen = () => wait(() => document.getElementById('stillPanel').classList.contains('show'), 5000);
  const closeStill = async () => { await G(() => window.SSX.still.close()); await sleep(300); };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.still && !!window.SSX?.farm && !!window.SSX?.liquor, 20000);
    ok('api', await G(() => { const L = window.SSX.liquor; return ['inventory', 'take', 'alienPrice', 'add', 'sell'].every(k => typeof L[k] === 'function') && window.SSX.still.PRICES.still === 1800 && window.SSX.still.PRICES.stillStars === 1800 && window.SSX.still.PRICES.starRate === 1; }));
    await G(() => { window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('toast'); if (t?.classList.contains('on')) window.__toasts.push(t.textContent); }).observe(document.getElementById('toast'), { childList: true, characterData: true, subtree: true, attributes: true }); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 30000; g.progress.xp = 500; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.harvest?.debug?.reset?.(); window.SSX.starshop?.debug?.reset?.(); window.SSX.still.debug.reset(); window.SSX.contraband?.reset?.();
      window.__sev = []; window.SSX.still.on(e => window.__sev.push(e.type + (e.crop ? ':' + e.crop : ''))); });
    await go('farm', 12);
    await G(() => window.SSX.farm.buy()); await sleep(900); await G(() => window.SSX.farm.buildDome()); await sleep(900);
    const bk = await G(() => window.SSX.farm.bank({ potato: 14, glowberry: 6, algae: 8 })); ok('banked', bk?.n, bk?.ok && bk.n === 28);
    // 1) the farm sheet's 🥃 row -> the still sheet; ⭐ short is refused (500 ⭐ < 1,800)
    await G(() => window.SSX.farm.guide.hide()); await tapSel('#farmAct'); await wait(() => document.getElementById('farmPanel').classList.contains('show'), 6000);
    const row = await G(() => [...document.querySelectorAll('#farmPanel button[data-a="ext"]')].map(b => b.textContent));
    ok('farmRow', row, row.length === 1 && /Moonshine still · 1,800 cr or ⭐/.test(row[0]));
    await tapSel('#farmPanel button[data-a="ext"]'); ok('rowOpensStill', await stillOpen()); await sleep(500);
    const sb = await G(() => { const b = document.querySelector('#stillPanel button[data-a="buy"][data-c="stars"]'); return b && { dis: b.disabled, t: b.textContent }; });
    ok('starsShort', sb, sb && sb.dis && /1,800 ⭐/.test(sb.t) && /You have 500 ⭐/.test(sb.t));
    ok('starsShortApi', await G(() => window.SSX.still.buy('stars').msg), await G(() => !window.SSX.still.status().owned)); await sleep(900);
    ok('buyBtnBW', await BW('#stillPanel button[data-a="buy"][data-c="cr"]'), isBW(await BW('#stillPanel button[data-a="buy"][data-c="cr"]')));
    await sleep(300); await shot('buy');
    // 2) double tap: charged once
    const c0 = await cr(); await dbl('#stillPanel button[data-a="buy"][data-c="cr"]'); await sleep(900);
    const c1 = await cr(); ok('chargedOnce', { c0, c1 }, c0 - c1 === 1800 && (await St()).owned && (await St()).paidWith === 'cr');
    await closeStill();
    // 3) the still by the dome + its context button
    const sp = await G(() => window.SSX.still.status().spot);
    await G(([x, z]) => window.__app.surface.debugMove(x + 2.2, z + 1.0, 0), [sp.x, sp.z]); await fr(8); await sleep(700);
    ok('mesh', await G(() => { let v = false; window.__app.surface.scene?.traverse?.(o => { if (o.name === 'still' && o.visible) v = true; }); return v; }) || (await St()).owned);
    ok('ctxBtn', await wait(() => document.getElementById('stillAct').classList.contains('on'), 5000));
    ok('ctxBW', await BW('#stillAct'), isBW(await BW('#stillAct')));
    // a third-person look at it from the south-east
    await G(([x, z]) => window.__app.surface.debugMove(x + 2.2, z + 2.6, Math.PI * 0.2), [sp.x, sp.z]); await fr(10); await sleep(900); await shot('still');
    await G(([x, z]) => window.__app.surface.debugMove(x + 2.2, z + 1.0, 0), [sp.x, sp.z]); await fr(6); await sleep(500);
    await tapSel('#stillAct'); ok('ctxOpens', await stillOpen()); await sleep(500);
    ok('noGhostBrew', await G(() => window.__sev.join(' || ')), await G(() => !window.SSX.still.status().batch));
    // 4) brew potatoes (12 max), double tap = one batch
    await dbl('#stillPanel button[data-a="brew"][data-c="potato"]'); await sleep(900);
    let s = await St(); const silo1 = await G(() => window.SSX.farm.status().silo);
    ok('brewOnce', { batch: s.batch, silo: silo1 }, s.batch?.crop === 'potato' && s.batch.n === 12 && silo1.potato === 2);
    ok('busyNoBrew', await G(() => !document.querySelector('#stillPanel button[data-a="brew"]')));
    await sleep(300); await shot('brewing');
    await G(() => window.SSX.farm.skip(3)); await sleep(800); s = await St(); ok('halfway', s.batch && +s.batch.left.toFixed(2), s.batch && s.batch.left > 1.2 && s.batch.left <= 3.05 && !s.home.potato_moonshine);
    await G(() => window.SSX.farm.skip(3.2)); ok('potatoReady', await wait(() => window.SSX.still.status().home.potato_moonshine === 12, 6000));
    await sleep(900); await G(() => window.SSX.still.brew('glowberry')); await G(() => window.SSX.farm.skip(8.2)); ok('hoochReady', await wait(() => window.SSX.still.status().home.glowberry_hooch === 6, 6000));
    // 5) crates into the rover
    await closeStill(); await G(() => window.SSX.still.open()); await stillOpen(); await sleep(500);
    await tapSel('#stillPanel button[data-a="load"]'); s = await St();
    ok('loaded', { carried: s.carried, crates: s.crates }, s.carried.potato_moonshine === 12 && s.carried.glowberry_hooch === 6 && s.crates === 3 && !Object.keys(s.home).length);
    await sleep(900); await G(() => window.SSX.still.brew('algae')); await G(() => window.SSX.farm.skip(4.2)); ok('ginAtHome', await wait(() => window.SSX.still.status().home.algae_gin === 8, 6000));
    await closeStill();
    await G(() => window.__app.surface.summonRover()); await fr(4); await G(() => window.__app.surface.interact()); await fr(6);
    ok('driving', await wait(() => !!window.__app.surface.info.driving, 6000));
    ok('cargoOnCar', await wait(() => { let n = 0, v = false; window.__app.surface.scene?.traverse?.(o => { if (o.name === 'still-cargo' && o.visible) { v = true; n = o.children.filter(c => c.visible).length; } }); return v && n === 3; }, 5000));
    ok('caption', await G(() => document.getElementById('stillCap').textContent), await wait(() => /3 crates of moonshine in your rover \(18 bottles\)/.test(document.getElementById('stillCap').textContent) && document.getElementById('stillCap').classList.contains('on'), 5000));
    ok('oneCaption', await G(() => [...document.querySelectorAll('#stillCap.on, #hvCap.on, #farmGuide.on')].filter(e => getComputedStyle(e).display !== 'none').length === 1));
    await sleep(1200); await shot('rover-crates');
    await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 5000); await sleep(400);
    // 6) sell glow-berry hooch to the Xen-7 aliens through the 👽 Trade sheet
    ok('farFromPost', await G(() => !window.SSX.still.sell('glowberry_hooch', 1).ok)); await sleep(900);
    await go('post', 4); await wait(() => document.getElementById('farmAct').classList.contains('on'), 5000);
    await tapSel('#farmAct'); await wait(() => document.getElementById('farmPanel').classList.contains('show'), 5000);
    ok('postRow', await G(() => [...document.querySelectorAll('#farmPanel button[data-a="ext"]')].map(b => b.textContent).join(' | ')), await G(() => /Sell moonshine · 18 bottles/.test(document.querySelector('#farmPanel button[data-a="ext"]')?.textContent || '')));
    await tapSel('#farmPanel button[data-a="ext"]'); await stillOpen(); await sleep(500);
    ok('alienPrices', await G(() => [...document.querySelectorAll('#stillPanel button[data-a="sell"]')].map(b => b.textContent).join(' | ')), await G(() => /Sell 12 Potato moonshine · 185 cr each/.test(document.getElementById('stillPanel').textContent) && /Sell 6 Glow-berry hooch · 325 cr each/.test(document.getElementById('stillPanel').textContent)));
    await sleep(300); await shot('post-sell');
    let c2 = await cr(); await tapSel('#stillPanel button[data-a="sell"][data-c="glowberry_hooch"]');
    ok('soldAliens', { got: (await cr()) - c2 }, (await cr()) - c2 === 1950 && !(await St()).carried.glowberry_hooch);
    await closeStill();
    // 7) Jeff's Velvet Airlock bar (#93), when it's in this build: our bottles in its sell + drink-your-own lists
    const hasBar = await G(() => !!window.__bar); R.bar = hasBar ? 'merged' : 'not in this build';
    if (hasBar) {
      await G(() => { window.__app.game.progress.credits = 5000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
      const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
      await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
      await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(800);
      await G(() => window.__app.surface.debugInside(-8.2, -1.9, Math.PI / 2)); ok('atCounter', await wait(() => window.__app.surface.info.spot?.id === 'liquor', 6000));
      await sleep(500); if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn');
      if (await wait(() => getComputedStyle(document.getElementById('adultGate')).display === 'flex', 3000)) await tapSel('#adultYes');
      ok('barOpen', await wait(() => window.__bar.isOpen, 4000)); await sleep(400);
      ok('barLiquor', await G(() => window.__bar.liquor.ok));
      const bs = await G(() => [...document.querySelectorAll('#barSell .barRow')].map(r => r.textContent));
      ok('barSellsOurs', bs, bs.length === 1 && /Potato moonshine/.test(bs[0]) && /241 cr each · aliens pay 185/.test(bs[0]));
      ok('barOwnOurs', await G(() => [...document.querySelectorAll('[data-own]')].map(b => b.dataset.own).join()), await G(() => !!document.querySelector('[data-own="potato_moonshine"]') && getComputedStyle(document.getElementById('barOwn')).display !== 'none'));
      await G(() => document.getElementById('barCard').scrollTop = 0); await sleep(400); await shot('bar-sell');
      const c3 = await cr(); await tapSel('#barSell [data-sell="potato_moonshine"][data-n="1"]');
      ok('barSold1', await wait(c => window.__app.game.progress.credits === c + 241 && window.SSX.still.status().carried.potato_moonshine === 11, 4000, c3));
      await sleep(300); await shot('bar-sold');
      await tapSel('[data-own="potato_moonshine"]'); ok('drankOwn', await wait(() => window.SSX.still.status().carried.potato_moonshine === 10, 4000));
      if (await wait(() => window.__bar.out, 3000)) await wait(() => !window.__bar.out && !window.__app.surface.info.inside, 12000);
      else { if (desk) await page.keyboard.press('Escape'); else await G(() => document.getElementById('barLeave')?.click()); await wait(() => !window.__bar.isOpen, 3000); await G(() => window.__app.surface.exitBuilding?.()); }
      await wait(() => !window.__app.surface.info.inside, 8000); await G(() => window.__bar.debug?.setLevel?.(0)); await sleep(500);
    }
    // 8) Rust Pit: refused
    await G(() => { const c = window.SSX.farm.debug.colony(); window.__app.surface.debugMove(c.x - 292, c.z - 68, 0); }); await fr(6); await sleep(900);
    ok('pit', await G(() => ({ inPit: window.SSX.still.status().pit, load: window.SSX.still.load().msg, take: window.SSX.liquor.take('potato_moonshine', 1) })), await G(() => window.SSX.still.status().pit && /Rust Pit/.test(window.SSX.still.load().msg || 'Rust Pit') && window.SSX.liquor.take('potato_moonshine', 1) === 0));
    // 9) BUSTED while wanted with crates aboard: ColSec takes only those crates, no fine from the still, home stock safe
    await go('farm', 30); await sleep(600);
    const pre = await G(() => ({ s: window.SSX.still.status(), c: window.__app.game.progress.credits }));
    const carriedN = Object.values(pre.s.carried).reduce((a, b) => a + b, 0);
    await G(() => { window.__app.surface.world.setWanted(2); window.__app.game.bust(); });
    ok('seized', await wait(() => !Object.keys(window.SSX.still.status().carried).length, 6000));
    ok('seizeToast', await wait(() => window.__toasts.some(t => /ColSec took the \d crates? of moonshine in your rover \(\d+ bottles\)\. Bottles at the still are safe\./.test(t)), 9000));
    const post = await G(() => ({ s: window.SSX.still.status(), c: window.__app.game.progress.credits }));
    ok('homeSafe', { pre: pre.s.home, post: post.s.home, seized: post.s.stats.seized, carriedN }, post.s.home.algae_gin === 8 && post.s.stats.seized === carriedN && post.s.stats.busts === 1);
    ok('noStillFine', { pre: pre.c, post: post.c }, post.c === pre.c);
    // 10) reload keeps it; an unowned overwrite is recovered from the mirror (#83 pattern)
    await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.still, 120000);
    s = await St(); ok('reload', { owned: s.owned, home: s.home }, s.owned && s.home.algae_gin === 8 && !Object.keys(s.carried).length);
    await G(() => localStorage.setItem('ssx.still.v1', '{"v":1,"owned":false}')); await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.still, 120000);
    s = await St(); ok('mirror', { owned: s.owned, restored: s.restored }, s.owned && s.restored === 'backup' && s.home.algae_gin === 8);
    ok('events', await G(() => JSON.parse(localStorage.getItem('ssx.still.v1')).stats), true);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
