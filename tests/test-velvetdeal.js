// v7.5.26 test: Velvet Airlock side deal. Danny takes product (privateshow.js product buttons, onTap), Ines buys product
// off the floor + runs a 3-job errand chain (mars/velvetdeal.js via SSX.contraband.registerOffer + game.registerMission).
// BASE=http://localhost:8765/ BR=chromium DEV=desktop node tests/test-velvetdeal.js   (DEV="iPhone 14" for touch)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const G = (f, a) => page.evaluate(f, a), R = { tag: `${DEV}-${BR}` }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, hit: !!t && (t === e || e.contains(t)) }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn'); };
  const cr = () => G(() => window.__app.game.progress.credits);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    ok('registered', await wait(() => window.SSX?.velvetDeal?.registered, 20000));
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); window.SSX.contraband.reset(); window.SSX.contraband.add('glowdust', 2); });
    // ---- Danny: pay with product ----
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(500);
    await G(() => { window.__app.game.setFlag?.('vip'); window.__app.surface.world.openVip(); });
    await G(() => window.__app.surface.debugInside(6.55, -5.3, 0));
    ok('showLabel', await wait(() => /Private show 150/.test(document.getElementById('driveBtn').textContent), 4000));
    await act(); if (await wait(() => getComputedStyle(document.getElementById('adultGate')).display === 'flex', 3000)) await tapSel('#adultYes');
    ok('offerPanel', await wait(() => getComputedStyle(document.getElementById('pshowOffer')).display === 'flex', 3000));
    ok('creditBtnsKept', await G(() => !!document.getElementById('pshowYes') && !!document.getElementById('pshowLap')));
    R.prodBtns = await G(() => [...document.querySelectorAll('#pshowProd button')].map(b => b.textContent));
    ok('prodBtn', R.prodBtns.join(' | '), R.prodBtns.some(t => /Private show · 2 .*Glow-dust/i.test(t)));
    const pb = await center('#pshowProd button[data-mode="show"]'); ok('prodBtnTappable', `${Math.round(pb.w)}x${Math.round(pb.h)} hit=${pb.hit}`, pb.h >= 40 && pb.hit);
    ok('prodBtnBW', await G(() => { const c = getComputedStyle(document.querySelector('#pshowProd button')); return c.backgroundColor + ' / ' + c.color; }), await G(() => { const c = getComputedStyle(document.querySelector('#pshowProd button')); return /rgb\(0, 0, 0\)/.test(c.backgroundColor) && /rgb\(255, 255, 255\)/.test(c.color); }));
    const c0 = await cr();
    await tapSel('#pshowProd button[data-mode="show"]');
    ok('showActive', await wait(() => window.__pshow.active && document.body.classList.contains('pshow'), 20000));
    ok('productTaken', await G(() => window.SSX.contraband.stash().items.glowdust?.qty || 0), await G(() => !window.SSX.contraband.stash().items.glowdust));
    ok('noCreditsSpent', (await cr()) - c0, (await cr()) === c0);
    ok('productShows', await G(() => window.SSX.velvetDeal.state().productShows), await G(() => window.SSX.velvetDeal.state().productShows === 1));
    await G(() => window.__pshow.end?.()); await sleep(1500);
    // ---- Ines: offers on her panel ----
    const offs = await G(() => window.SSX.contraband.barterOffers(null, 'ines').map(o => o.id + '=' + o.label));
    R.inesOffers = offs;
    ok('inesOffers', offs.length, ['ines-side-buy-dust', 'ines-side-buy-static', 'ines-side-buy-lowg', 'ines-side-buy-honey', 'ines-side-job'].every(id => offs.some(o => o.startsWith(id + '='))));
    ok('barterJsonKept', await G(() => window.SSX.contraband.barterSource), await G(() => window.SSX.contraband.barterSource === 'barter.json' && window.SSX.contraband.barterOffers(null, 'ines').length > 5));
    await G(() => window.SSX.contraband.add('glowdust', 3));
    const c1 = await cr(), rep0 = await G(() => window.SSX.rep?.get?.('velvet') ?? 0);
    const br = await G(() => window.SSX.contraband.barter('glowdust', 3, 'ines-side-buy-dust'));
    ok('buyout', br.msg, br.ok && (await cr()) - c1 >= 330 && !(await G(() => window.SSX.contraband.stash().items.glowdust)));
    R.buyoutPaid = (await cr()) - c1;
    ok('buyoutRep', await G(() => window.SSX.rep?.get?.('velvet') ?? null), await G(r => (window.SSX.rep?.get?.('velvet') ?? r + 2) >= r + 2, rep0));
    ok('buyoutCooldown', await G(() => window.SSX.contraband.barter('glowdust', 3, 'ines-side-buy-dust').ok === false));
    // ---- Ines: errand chain ----
    await G(() => window.__app.game.abandon?.());
    const jobs = [];
    for (let i = 0; i < 3; i++) {
      const lbl = await G(() => window.SSX.contraband.offer('ines-side-job').label);
      const r = await G(() => window.SSX.contraband.barter(null, null, 'ines-side-job'));
      const q = await G(() => window.__app.game.info.quest?.id || null);
      const c2 = await cr();
      await G(() => { const d = window.__app.game.debug; for (let k = 0; k < 10 && window.__app.game.info.quest; k++) d.advance(); });
      await sleep(2500);
      jobs.push({ lbl, ok: r.ok, msg: r.msg, quest: q, paid: (await cr()) - c2 });
    }
    R.jobs = jobs;
    ok('jobChain', jobs.map(j => j.quest).join(','), jobs.map(j => j.quest).join(',') === 'ines-side-case,ines-side-debt,ines-side-deputy');
    ok('jobPay', jobs.map(j => j.paid).join(','), jobs.every((j, i) => j.paid >= [400, 550, 700][i]));
    ok('chainComp', await G(() => window.SSX.velvetDeal.state()), await G(() => { const s = window.SSX.velvetDeal.state(); return s.comps === 1 && s.next === 0 && s.chains === 1; }));
    // repeat run is topped up to full pay
    const r4 = await G(() => window.SSX.contraband.barter(null, null, 'ines-side-job')); const c3 = await cr();
    await G(() => { const d = window.__app.game.debug; for (let k = 0; k < 10 && window.__app.game.info.quest; k++) d.advance(); }); await sleep(2500);
    ok('repeatTopUp', (await cr()) - c3, r4.ok && (await cr()) - c3 >= 400);
    ok('busyRefused', await G(() => { const g = window.__app.game; g.accept('ines-side-debt'); const r = window.SSX.contraband.barter(null, null, 'ines-side-job'); g.abandon?.(); return r.ok === false; }));
    ok('compBtn', await G(() => { window.__app.surface.debugInside(6.55, -5.3, 0); return true; }));
    await sleep(600); await act(); if (await wait(() => getComputedStyle(document.getElementById('adultGate')).display === 'flex', 1500)) await tapSel('#adultYes');
    await wait(() => getComputedStyle(document.getElementById('pshowOffer')).display === 'flex', 3000);
    R.compBtns = await G(() => [...document.querySelectorAll('#pshowProd button')].map(b => b.dataset.kind + ':' + b.textContent));
    ok('compOffered', R.compBtns.join(' | '), R.compBtns.some(t => t.startsWith('comp:')));
    if (R.compBtns.some(t => t.startsWith('comp:'))) { await tapSel('#pshowProd button[data-kind="comp"]'); ok('compUsed', await wait(() => window.__pshow.active && window.SSX.velvetDeal.state().comps === 0, 20000)); }
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('pageerrors');
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
