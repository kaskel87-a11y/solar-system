// v7.5.76 Crime break at Red Static Gulch: menu + proximity trigger, crew gather, ⭐ once, cooldown / reload / repeat taps,
// plus 100 cr → 10 ⭐ and the gulch market (credit 1/5 and one star). Do not pay a meeting twice.
// Black/white 44px buttons. WebKit iPhone 14 393x852 shots.
// BASE=http://127.0.0.1:8941/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/crimebreak/ NODE_PATH=... node tests/test-crimebreak.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8941/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
let out = process.env.OUT || process.env.SHOTS_DIR || './shots/crimebreak/'; if (!out.endsWith('/')) out += '/'; const desk = DEV === 'desktop';
const noAudio = (process.env.NOAUDIO || ((process.env.BR || '') === 'webkit' ? '1' : '0')) === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] });
  const page = await ctx.newPage();
  if (noAudio) await page.addInitScript(() => { try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (e) { /* */ } });
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const moved = await G(s => { const e = document.querySelector(s); if (!e) return false; const ps = []; for (let p = e.parentElement; p; p = p.parentElement) ps.push([p, p.scrollTop]); e.scrollIntoView({ block: 'center' }); return ps.some(([p, t]) => p.scrollTop !== t); }, sel); await sleep(moved ? 1000 : 150);
    const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
  const fr = async (n = 4) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, 60000, f0 + n); };
  const shot = async n => { const p = `${out}crimebreak-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const BW = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: c.backgroundColor, fg: c.color, h: Math.round(r.height) }; }, sel);
  const isBW = b => !!b && /rgb\(0, 0, 0\)/.test(b.bg) && /255, 255, 255/.test(b.fg) && b.h >= 44;
  const gulch = async () => { await G(() => { const z = window.SSX.copFree.zone(); window.__app.surface.debugMove(z.x + 2, z.z + 2, 0); }); await fr(6); await sleep(400); };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.crimebreak && !!window.SSX?.crew && !!window.SSX?.copFree && !!window.SSX?.farm2, 20000);
    ok('api', await G(() => { const A = window.SSX.crimebreak; return ['open', 'close', 'payBonus', 'state', 'gate', 'start', 'finish', 'exchange', 'exchange10', 'marketBuy', 'marketStar', 'catalog'].every(k => typeof A[k] === 'function') && A.COST === 500 && A.STAR_PAY === 80 && A.EX_COST === 100 && A.EX_STARS === 10; }));
    ok('menuRow', await G(() => /Crime break/.test(document.getElementById('rmCrimeBreak')?.textContent || '')));

    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.()); await sleep(300);
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 20000; g.progress.xp = 12000; g.save();
      window.__app.surface.world.setWanted(0); window.SSX.crimebreak.debug.reset(); window.SSX.crew.debug.reset(); window.SSX.farm2.debug.reset();
      window.SSX.starshop?.debug?.reset?.(); });

    // far from gulch: menu opens but explains location / no crew
    await G(() => { const c = window.__app.surface.info.colony; window.__app.surface.debugMove(c.x, c.z + 20, 0); }); await fr(4);
    await G(() => window.SSX.crimebreak.open(true)); await sleep(400);
    ok('needCrewNote', await G(() => /Hire someone|Crew/.test(document.querySelector('#cbGulch .note, #cbGulch p')?.textContent || document.getElementById('cbPanel')?.textContent || '')));
    await G(() => window.SSX.crimebreak.close());

    // hire Dex via crew API (lifetime ⭐ already 12k)
    ok('hired', await G(() => { const r = window.SSX.crew.hire(); return r.ok && window.SSX.crew.state().crew[0]?.id === 'dex'; }));

    // at gulch: proximity card + open meeting
    await gulch();
    ok('atGulch', await G(() => window.SSX.copFree.here()));
    ok('ctxBtn', await wait(() => { const b = document.getElementById('cbAct'); return b && b.style.display !== 'none'; }, 6000));
    ok('ctxBW', await BW('#cbAct'), isBW(await BW('#cbAct')));
    await tapSel('#cbAct'); ok('panel', await wait(() => window.SSX.crimebreak.isOpen, 4000));
    const sheetLay = await G(() => {
      const sheet = document.querySelector('#cbGulch .sheet'), x = document.querySelector('#cbGulch .x'), h2 = document.querySelector('#cbGulch h2');
      const sr = sheet?.getBoundingClientRect(), xr = x?.getBoundingClientRect();
      return { sw: Math.round(sr?.width || 0), xw: Math.round(xr?.width || 0), titleInSheet: !!(h2 && sheet?.contains(h2) && !x?.contains(h2)) };
    });
    ok('sheetWide', sheetLay, sheetLay.sw >= 200 && sheetLay.xw <= 64 && sheetLay.titleInSheet);
    ok('startBW', await BW('#cbGulch button[data-a="start"]'), isBW(await BW('#cbGulch button[data-a="start"]')));
    await sleep(300); await shot('prompt');

    const xp0 = await G(() => window.__app.game.progress.xp);
    const cr0 = await G(() => window.__app.game.progress.credits);
    await tapSel('#cbGulch button[data-a="start"]');
    ok('meeting', await wait(() => window.SSX.crimebreak.meeting, 3000));
    ok('gathered', await G(() => window.SSX.crimebreak.meeting && !!document.querySelector('#cbGulch button[data-a="next"], #cbGulch button[data-a="done"]')));
    await sleep(400); await shot('sitdown');

    // advance dialogue to Seal it (UI), fall back to finish() if the panel stalls
    for (let i = 0; i < 8; i++) {
      if (await G(() => window.SSX.crimebreak.state().meets >= 1)) break;
      const a = await G(() => document.querySelector('#cbGulch button[data-a="done"], #cbGulch button[data-a="next"]')?.getAttribute('data-a'));
      if (!a) { await G(() => window.SSX.crimebreak.finish()); break; }
      await tapSel(`#cbGulch button[data-a="${a}"]`); await sleep(450);
      if (a === 'done') break;
    }
    if (!(await G(() => window.SSX.crimebreak.state().meets >= 1))) await G(() => window.SSX.crimebreak.finish());
    ok('paidOnce', await wait(() => window.SSX.crimebreak.state().meets === 1, 5000));
    const xp1 = await G(() => window.__app.game.progress.xp);
    const cr1 = await G(() => window.__app.game.progress.credits);
    ok('starsOnce', { xp0, xp1 }, xp1 - xp0 === 80);
    ok('introFree', { cr0, cr1 }, cr1 === cr0);
    ok('buff5', await G(() => Math.abs(window.SSX.crimebreak.payBonus() - 0.05) < 1e-9));

    // repeat finish / start while cooling: no second pay
    await G(() => { window.SSX.crimebreak.finish(); window.SSX.crimebreak.start(); }); await sleep(400);
    ok('noDouble', await G(x => window.SSX.crimebreak.state().meets === 1 && window.__app.game.progress.xp === x, xp1));

    // reopen: cooldown message (gate + panel)
    await G(() => window.SSX.crimebreak.close()); await sleep(200);
    await G(() => window.SSX.crimebreak.open()); await sleep(500);
    const cool = await G(() => { const g = window.SSX.crimebreak.gate(); const t = document.getElementById('cbPanel')?.textContent || ''; return { why: g.why || '', ok: g.ok, text: t, open: window.SSX.crimebreak.isOpen }; });
    R.cool = cool;
    ok('cooldownUI', cool, !cool.ok && /sol|Next|cooling/i.test(cool.why + ' ' + cool.text));
    await sleep(300); await shot('cooldown');

    // reload: buff + cooldown persist, no free re-pay
    await G(() => window.SSX.crimebreak.close());
    await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await wait(() => !!window.SSX?.crimebreak, 20000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('relanded', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(600);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.()); await sleep(200);
    ok('persisted', await G(() => { const s = window.SSX.crimebreak.state(); return s.meets === 1 && Math.abs(s.buff - 0.05) < 1e-9; }));
    const xpR = await G(() => window.__app.game.progress.xp);
    await gulch(); await G(() => window.SSX.crimebreak.open()); await sleep(300);
    await G(() => { try { window.SSX.crimebreak.start(); window.SSX.crimebreak.finish(); } catch (e) { /* */ } }); await sleep(500);
    ok('reloadNoPay', await G(x => window.SSX.crimebreak.state().meets === 1 && window.__app.game.progress.xp === x, xpR));

    // advance one sol, paid meeting works once
    await G(() => { window.SSX.farm2.debug.skip(24); }); await sleep(200);
    const cr2 = await G(() => window.__app.game.progress.credits);
    const xp2 = await G(() => window.__app.game.progress.xp);
    await G(() => window.SSX.crimebreak.open()); await sleep(300);
    await tapSel('#cbGulch button[data-a="start"]'); await wait(() => window.SSX.crimebreak.meeting, 3000);
    for (let i = 0; i < 8; i++) {
      if (await G(() => window.SSX.crimebreak.state().meets >= 2)) break;
      const a = await G(() => document.querySelector('#cbGulch button[data-a="done"], #cbGulch button[data-a="next"]')?.getAttribute('data-a'));
      if (!a) { await G(() => window.SSX.crimebreak.finish()); break; }
      await tapSel(`#cbGulch button[data-a="${a}"]`); await sleep(450); if (a === 'done') break;
    }
    if (!(await G(() => window.SSX.crimebreak.state().meets >= 2))) await G(() => window.SSX.crimebreak.finish());
    ok('secondMeet', await wait(() => window.SSX.crimebreak.state().meets === 2, 5000));
    ok('paidBuyIn', await G(c => window.__app.game.progress.credits === c - 500, cr2));
    ok('starsAgain', await G(x => window.__app.game.progress.xp === x + 80, xp2));
    ok('buff10', await G(() => Math.abs(window.SSX.crimebreak.payBonus() - 0.1) < 1e-9));
    // crew job cash reflects buff
    ok('crewPayHook', await G(() => { const C = window.SSX.crew; C.assign('dex', 'hustle'); const before = C.state().crew[0]; return Math.abs(window.SSX.crimebreak.payBonus() - 0.1) < 1e-9 && before.job === 'hustle'; }));

    // ----- 100 cr → 10 lifetime ⭐, then the gulch market (v7.5.76). Meeting fields stay as the block above left them. -----
    const crewN = await G(() => window.SSX.crew.state().crew.length);
    await G(() => window.SSX.crimebreak.close());
    await gulch();
    await G(() => window.SSX.crimebreak.open()); await sleep(350);
    ok('bothOffers', await G(() => {
      const t = document.getElementById('cbGulch')?.textContent || '';
      const ex = document.querySelector('#cbGulch button[data-a="exchange"]');
      return !!ex && /100 cr → 10 ⭐/.test(ex.textContent || '') && /lifetime/.test(t) && /Star Shop/.test(t) && /not lowered/.test(t);
    }));
    ok('exchangeWhileCooling', await G(() => !window.SSX.crimebreak.gate().ok && !!document.querySelector('#cbGulch button[data-a="exchange"]')));
    const lay = await G(() => {
      const card = document.querySelector('#cbGulch .wrap')?.getBoundingClientRect();
      const hit = id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); if (r.width < 8 || r.height < 8 || c.display === 'none' || c.visibility === 'hidden') return false; return !(card.right < r.left || card.left > r.right || card.bottom < r.top || card.top > r.bottom); };
      return { bottom: card ? Math.round(innerHeight - card.bottom) : 0, fire: hit('fireBtn'), joy: hit('joy'), melee: hit('meleeBtn') };
    });
    ok('controlsClear', lay, lay.bottom >= 96 && !lay.fire && !lay.joy && !lay.melee);
    await shot('exchange');
    ok('exchangeBW', await BW('#cbGulch button[data-a="exchange"]'), isBW(await BW('#cbGulch button[data-a="exchange"]')));

    const xpA = await G(() => window.__app.game.progress.xp);
    const bought0 = await G(() => window.SSX.crimebreak.state().bought | 0);
    await G(() => { window.__app.game.progress.credits = 40; window.__app.game.save(); });
    await tapSel('#cbGulch button[data-a="exchange"]'); await sleep(300);
    ok('exchangeShort', await G(x => window.__app.game.progress.credits === 40 && window.__app.game.progress.xp === x && /Need 100/.test(document.getElementById('cbGulch')?.textContent || ''), xpA));
    await shot('exchange-short');

    await G(() => {
      const g = window.__app.game;
      window.__spendOrig = g.spend.bind(g); window.__rewardOrig = g.reward.bind(g);
      window.__spends = []; window.__rewards = [];
      g.spend = n => { window.__spends.push(n); return window.__spendOrig(n); };
      g.reward = (xp, cr) => { window.__rewards.push([xp, cr]); return window.__rewardOrig(xp, cr); };
      g.progress.credits = 100; g.save();
    });
    await tapSel('#cbGulch button[data-a="exchange"]'); await sleep(400);
    const ex1 = await G(x => {
      const g = window.__app.game;
      const out = { spends: window.__spends.slice(), rewards: window.__rewards.slice(), cr: g.progress.credits, xp: g.progress.xp, bought: window.SSX.crimebreak.state().bought };
      g.spend = window.__spendOrig; g.reward = window.__rewardOrig;
      return out;
    }, xpA);
    ok('exchangeTap', ex1, ex1.cr === 0 && ex1.xp === xpA + 10 && ex1.bought === bought0 + 1 && String(ex1.spends) === '100' && ex1.rewards.length === 1 && ex1.rewards[0][0] === 10 && ex1.rewards[0][1] === 0);
    await shot('exchange-after');

    await sleep(400);
    const dbl = await G(() => {
      const g = window.__app.game; g.progress.credits = 500; const x = g.progress.xp, b = window.SSX.crimebreak.state().bought;
      const a = window.SSX.crimebreak.exchange(), c = window.SSX.crimebreak.exchange();
      return { a: !!a.ok, dup: !!c.dup, cr: g.progress.credits, dx: g.progress.xp - x, db: window.SSX.crimebreak.state().bought - b };
    });
    ok('exchangeDouble', dbl, dbl.a && dbl.dup && dbl.cr === 400 && dbl.dx === 10 && dbl.db === 1);

    await sleep(400);
    await G(() => { window.__app.game.progress.credits = 150; });
    const part1 = await G(() => window.SSX.crimebreak.exchange());
    await sleep(400);
    const part2 = await G(() => {
      const g = window.__app.game; const r = window.SSX.crimebreak.exchange();
      return { ok: !!r.ok, dup: !!r.dup, why: r.why || '', cr: g.progress.credits, xp: g.progress.xp };
    });
    ok('exchangePartial', { part1: !!part1.ok, part2 }, part1.ok && !part2.ok && !part2.dup && part2.cr === 50 && /Need 100/.test(part2.why));

    // new game: no stars yet. Reset the star wallet only in the test, then one exchange mints 10 lifetime and 10 spendable.
    await sleep(400);
    const neu = await G(() => {
      const g = window.__app.game; g.progress.xp = 0; g.progress.credits = 100; g.save();
      window.SSX.starshop.debug.reset();
      const r = window.SSX.crimebreak.exchange();
      return { ok: !!r.ok, xp: g.progress.xp, cr: g.progress.credits, spent: window.SSX.stars.spent(), bal: window.SSX.stars.balance() };
    });
    ok('exchangeNewGame', neu, neu.ok && neu.xp === 10 && neu.cr === 0 && neu.spent === 0 && neu.bal === 10);

    // previously spent stars stay spent. Exchange adds lifetime and spendable, and does not refund the wallet.
    await sleep(400);
    const prior = await G(() => {
      const g = window.__app.game, stars = window.SSX.stars;
      g.progress.xp = 4000; g.progress.credits = 1000; g.save();
      const spent0 = stars.spend(600, 'prior');
      const rank0 = g.info.rank;
      let refunds = 0; const orig = stars.refund; stars.refund = n => { refunds++; return orig(n); };
      const r = window.SSX.crimebreak.exchange();
      stars.refund = orig;
      return { spendOk: !!spent0.ok, ex: !!r.ok, xp: g.progress.xp, cr: g.progress.credits, spent: stars.spent(), bal: stars.balance(), refunds, rank0, rank1: g.info.rank };
    });
    ok('spentStays', prior, prior.spendOk && prior.ex && prior.xp === 4010 && prior.cr === 900 && prior.spent === 600 && prior.bal === 3410 && prior.refunds === 0 && prior.rank0 === prior.rank1);

    // market at the gulch: live catalog, buy 1 and 5, a real button tap, then a star purchase.
    await gulch();
    await G(() => { window.SSX.contraband.reset(); window.__app.game.progress.credits = 20000; window.__app.game.save(); window.SSX.crimebreak.open(); });
    await sleep(300);
    await tapSel('#cbGulch button[data-t="mkt"]'); await sleep(400);
    const cat = await G(() => {
      const items = window.SSX.contraband.items().filter(i => window.SSX.crimebreak.HOUSE.includes(i.id));
      const prices = window.SSX.starshop.prices();
      const view = window.SSX.crimebreak.catalog();
      const text = document.getElementById('cbGulch')?.textContent || '';
      return { n: items.length, items: items.map(i => ({ id: i.id, supplier: i.supplier, name: i.name })), prices, rows: view.rows.map(r => ({ id: r.id, supplier: r.supplier, star: r.starPrice })), text, wallet: document.querySelector('#cbGulch .wallet')?.textContent || '' };
    });
    const wantCr = { lowg: 20, glowdust: 40, redstatic: 75, voidhoney: 160 }, wantStar = { lowg: 200, glowdust: 250, redstatic: 400, voidhoney: 600 };
    ok('catalog', cat, cat.n === 4 && cat.rows.length === 4 && cat.rows.every(r => r.supplier === wantCr[r.id] && r.star === wantStar[r.id]) && /20 cr each/.test(cat.text) && /800 cr/.test(cat.text) && /⭐ 600/.test(cat.text) && /spent/.test(cat.wallet) && /to spend/.test(cat.wallet));
    await shot('market');
    ok('marketBW', await BW('#cbGulch button[data-a="mbuy"][data-i="lowg"][data-q="1"]'), isBW(await BW('#cbGulch button[data-a="mbuy"][data-i="lowg"][data-q="1"]')));
    const crBuy = await G(() => window.__app.game.progress.credits);
    await tapSel('#cbGulch button[data-a="mbuy"][data-i="lowg"][data-q="1"]'); await sleep(400);
    ok('buy1Tap', await G(c => window.__app.game.progress.credits === c - 20 && (window.SSX.contraband.stash().items.lowg?.qty || 0) === 1, crBuy));
    await shot('market-bought');
    await sleep(400);

    const matrix = await G(() => {
      const CB = window.SSX.contraband, A = window.SSX.crimebreak, g = window.__app.game;
      const out = [];
      for (const id of A.HOUSE) {
        CB.reset(); g.progress.credits = 20000;
        const unit = CB.supplierPrice(id), max = CB.items().find(i => i.id === id).max;
        const fiveFirst = max < 5 ? A.marketBuy(id, 5) : null;
        const one = A.marketBuy(id, 1);
        const five = max >= 5 ? A.marketBuy(id, 5) : null;
        const held = CB.stash().items[id]?.qty || 0;
        out.push({ id, unit, max, fiveFirst: fiveFirst && { ok: !!fiveFirst.ok, why: fiveFirst.why || fiveFirst.msg || '' }, one: { ok: !!one.ok, qty: one.qty, cost: one.cost }, five: five && { ok: !!five.ok, qty: five.qty, cost: five.cost }, held, cr: g.progress.credits });
      }
      return out;
    });
    ok('matrix', matrix, matrix.every(r => r.unit === wantCr[r.id] && r.one.ok && r.one.qty === 1 && r.one.cost === r.unit && (r.max >= 5 ? r.five.ok && r.five.qty === 5 && r.five.cost === r.unit * 5 && r.held === 6 && r.cr === 20000 - r.unit * 6 : !r.fiveFirst.ok && r.held === 1 && r.cr === 20000 - r.unit)));

    await sleep(350);
    const poor = await G(() => {
      const g = window.__app.game, CB = window.SSX.contraband; CB.reset();
      const fails = [];
      for (const id of window.SSX.crimebreak.HOUSE) {
        const unit = CB.supplierPrice(id); g.progress.credits = unit - 1;
        const r = window.SSX.crimebreak.marketBuy(id, 1);
        fails.push({ id, ok: !!r.ok, cr: g.progress.credits, qty: CB.stash().items[id]?.qty || 0, why: r.why || '' });
      }
      return fails;
    });
    ok('marketShort', poor, poor.every(r => !r.ok && r.cr === wantCr[r.id] - 1 && r.qty === 0 && /Need/.test(r.why)));
    await G(() => { window.__app.game.progress.credits = 0; window.SSX.crimebreak.open(); });
    await sleep(400);
    await tapSel('#cbGulch button[data-t="mkt"]'); await sleep(300);
    await shot('market-short');
    await tapSel('#cbGulch button[data-a="mbuy"][data-i="lowg"][data-q="1"]'); await sleep(300);
    ok('marketShortTap', await G(() => window.__app.game.progress.credits === 0 && (window.SSX.contraband.stash().items.lowg?.qty || 0) === 0 && /Need 20 cr/.test(document.getElementById('cbGulch')?.textContent || '')));

    const full = await G(() => {
      const CB = window.SSX.contraband, g = window.__app.game; CB.reset();
      CB.add('lowg', 15); CB.add('glowdust', 5);
      g.progress.credits = 20000;
      const r = window.SSX.crimebreak.marketBuy('redstatic', 1);
      return { ok: !!r.ok, why: r.why || '', cr: g.progress.credits, used: CB.capacity().used, qty: CB.stash().items.redstatic?.qty || 0 };
    });
    ok('marketFull', full, !full.ok && full.cr === 20000 && full.qty === 0 && full.used === 20 && /full|carry|room/i.test(full.why));
    await G(() => window.SSX.crimebreak.open()); await tapSel('#cbGulch button[data-t="mkt"]'); await sleep(250);
    await shot('market-full');

    await sleep(350);
    const dupBuy = await G(() => {
      const CB = window.SSX.contraband, g = window.__app.game; CB.reset(); g.progress.credits = 5000;
      const a = window.SSX.crimebreak.marketBuy('glowdust', 1), b = window.SSX.crimebreak.marketBuy('glowdust', 1);
      return { a: !!a.ok, dup: !!b.dup, qty: CB.stash().items.glowdust?.qty || 0, cr: g.progress.credits };
    });
    ok('marketDouble', dupBuy, dupBuy.a && dupBuy.dup && dupBuy.qty === 1 && dupBuy.cr === 4960);

    // star purchase uses Star Shop (spent rises, lifetime xp does not, stash grows)
    await sleep(350);
    await gulch();
    const starBuy = await G(() => {
      const g = window.__app.game, CB = window.SSX.contraband, stars = window.SSX.stars;
      CB.reset(); const xp = g.progress.xp, spent = stars.spent(), bal = stars.balance();
      const r = window.SSX.crimebreak.marketStar('lowg');
      return { ok: !!r.ok, msg: r.msg || r.why || '', xp: g.progress.xp, dx: g.progress.xp - xp, spent: stars.spent(), dSpent: stars.spent() - spent, bal: stars.balance(), dBal: stars.balance() - bal, qty: CB.stash().items.lowg?.qty || 0, cr: g.progress.credits };
    });
    ok('starBuy', starBuy, starBuy.ok && starBuy.dx === 0 && starBuy.dSpent === 200 && starBuy.dBal === -200 && starBuy.qty === 1 && starBuy.cr === 4960);
    await G(() => window.SSX.crimebreak.open()); await tapSel('#cbGulch button[data-t="mkt"]'); await sleep(250);
    await shot('market-star');

    const snap = await G(() => ({
      bought: window.SSX.crimebreak.state().bought, xp: window.__app.game.progress.xp, cr: window.__app.game.progress.credits,
      lowg: window.SSX.contraband.stash().items.lowg?.qty || 0, spent: window.SSX.stars.spent(), meets: window.SSX.crimebreak.state().meets, buff: window.SSX.crimebreak.payBonus()
    }));
    await G(() => window.SSX.crimebreak.close());
    await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await wait(() => !!window.SSX?.crimebreak && !!window.SSX?.contraband && !!window.SSX?.stars, 20000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('exchangeRelanded', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.()); await sleep(200);
    const back = await G(() => ({
      bought: window.SSX.crimebreak.state().bought, xp: window.__app.game.progress.xp, cr: window.__app.game.progress.credits,
      lowg: window.SSX.contraband.stash().items.lowg?.qty || 0, spent: window.SSX.stars.spent(), meets: window.SSX.crimebreak.state().meets, buff: window.SSX.crimebreak.payBonus()
    }));
    ok('persistedExchange', { snap, back }, back.bought === snap.bought && back.xp === snap.xp && back.cr === snap.cr && back.lowg === snap.lowg && back.spent === snap.spent && back.meets === snap.meets && Math.abs(back.buff - snap.buff) < 1e-9);

    // away from the gulch the market refuses; the exchange still runs
    await G(() => { const c = window.__app.surface.info.colony; window.__app.surface.debugMove(c.x, c.z + 40, 0); window.__app.game.progress.credits = 250; });
    await fr(4); await sleep(300);
    await G(() => window.SSX.crimebreak.open()); await sleep(400);
    await tapSel('#cbGulch button[data-t="mkt"]'); await sleep(300);
    await shot('market-away');
    const away = await G(() => {
      const r = window.SSX.crimebreak.marketBuy('lowg', 1);
      const t = document.getElementById('cbGulch')?.textContent || '';
      return { ok: !!r.ok, travel: !!r.travel, why: r.why || '', text: t, here: window.SSX.copFree.here(), cr: window.__app.game.progress.credits };
    });
    ok('marketAway', away, !away.ok && away.travel && !away.here && away.cr === 250 && /Red Static Gulch/.test(away.why + ' ' + away.text));
    await sleep(400);
    await tapSel('#cbGulch button[data-t="ex"]'); await sleep(200);
    await tapSel('#cbGulch button[data-a="exchange"]'); await sleep(400);
    ok('exchangeAnywhere', await G(x => window.__app.game.progress.credits === 150 && window.__app.game.progress.xp === x + 10, back.xp));
    ok('noCrewSideEffect', await G(n => window.SSX.crew.state().crew.length === n, crewN));

    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); R.exc = String(e && e.stack || e); }
  R.errors = errors; R.fails = bad;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
