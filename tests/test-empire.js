// Empire layer (empire.js / SSX.empire): offline income on load, buy a front at its door (context button -> sheet -> Buy), income
// on the Mars clock (dangercore clock pinned with __danger.setClock), collect at the counter, extortion (pay / refuse), a raid
// defended through SSX.raids (waves) and the fallback hold, a lost raid, a safehouse (buy, rest = save, stash, garage spot, wake),
// npcBudget cap, team UI rule (one context button only at a property, no chip / second button, ☰ entry only, one caption at a time,
// plain-word directions), HUD centre clear, sheet width at 375-430, per-frame cost and fps with the layer on vs off.
// Touch taps are pointerdown -> pointerup on the same pointerId with a second finger held on the joystick.
// BASE=http://127.0.0.1:8893/ DEV=393x852 BR=webkit OUT=/workspace/pw-ben-empire/shots/ node tests/test-empire.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8893/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'empire';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 };
  const touch = DEV !== 'desktop', HELD = touch && process.env.HELD !== '0';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  // a save from "30 real minutes ago" owning Greenhouse Nine: the load should credit offline income (capped at 8 game hours)
  await ctx.addInitScript(() => { if (sessionStorage.getItem('empSeeded')) return; sessionStorage.setItem('empSeeded', '1');
    localStorage.setItem('ssx.empire.v1', JSON.stringify({ v: 1, owned: { 'fr-disp': { pending: 0 } }, lastAt: Date.now() - 30 * 60000, lastHour: null, clockH: 0, lastThreatH: -99, threat: null, earned: 0, log: [], stats: {}, home: null })); });
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /empire (tick|listener|menu)/.test(m.text())) errors.push(m.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 15000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png`, timeout: 90000 }).then(() => (R.shots = (R.shots || []).concat(`${out}${PFX}-${tag}-${s}.png`))).catch(e => errors.push('shot ' + s));
  const P = (sel, type, id) => G(([s, t, id]) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width) return false;
    e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true })); return true; }, [sel, type, id]);
  // a tap: touch = second finger (42) while finger 41 holds the joystick; desktop = a real mouse click (pointer events, no onclick)
  const tap = async sel => { if (!(await G(s => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0; }, sel))) return false;
    if (touch) { if (HELD) await P('#joy', 'pointerdown', 41); await P(sel, 'pointerdown', 42); await sleep(60); await P(sel, 'pointerup', 42); if (HELD) { await P('#joy', 'pointerup', 41); R.heldTaps = (R.heldTaps || 0) + 1; } return true; }
    await page.click(sel, { timeout: 10000 }); return true; };
  const ctxBtn = async () => { if (touch) return tap('#empBtn'); await page.keyboard.press('Backslash'); return true; };
  // ☰ -> 🏢 Empire (the only way into the sheet away from a door)
  const viaMenu = async () => { await tap('#menuBtn'); await wait(() => document.getElementById('roverMenu')?.classList.contains('show'), 4000); await tap('#rmEmpire'); return wait(() => window.SSX.empire.isOpen, 6000); };
  const label = (id = 'empBtn') => G(id => { const b = document.getElementById(id); return b && getComputedStyle(b).display !== 'none' ? b.textContent : ''; }, id);
  const credits = () => G(() => window.__app.surface.game.info.credits);
  const E = (f, a) => G(([f, a]) => window.SSX.empire[f](...(a || [])), [f, a]);
  const go = (id, where) => G(([id, w]) => window.SSX.empire.debug.goto(id, w), [id, where || 'door']);
  const centreHits = () => G(() => { const W = innerWidth, H = innerHeight, c = { l: W * 0.3, r: W * 0.7, t: H * 0.3, b: H * 0.7 };
    return ['empBtn'].map(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width && !(r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b) ? id : null; }).filter(Boolean); });
  const fpsFor = ms => G(ms => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(+(n * 1000 / (performance.now() - t0)).toFixed(1)); }; requestAnimationFrame(f); }), ms);
  const heal = () => G(() => { const s = window.__app.surface; s.world.setWanted?.(0, 'test'); s.game.restore?.(); });
  const sheetFits = () => G(() => { const w = document.querySelector('#empPanel .wrap'); if (!w) return null; const r = w.getBoundingClientRect(); const bs = [...w.querySelectorAll('button')].map(b => b.getBoundingClientRect());
    return { w: Math.round(r.width), fits: r.left >= 0 && r.right <= innerWidth + 0.5 && r.width > 0, btnsIn: bs.every(b => b.right <= r.right + 0.5 && b.left >= r.left - 0.5), minBtnH: Math.round(Math.min(...bs.map(b => b.height))) }; });
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000); await sleep(600);
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.restore?.(); });
    if (await G(() => { const r = document.getElementById('radio'); return r && getComputedStyle(r).display !== 'none'; })) await G(() => document.getElementById('radioLater')?.click());
    ok('ready', null, await wait(() => window.SSX.empire?.ready, 60000));
    ok('api', null, await G(() => { const M = window.SSX.empire; return window.__app.empire === M && ['props', 'prop', 'owned', 'buy', 'collect', 'pending', 'perHour', 'clock', 'threat', 'pay', 'refuse', 'defend', 'repair', 'upgrade', 'rest', 'deposit', 'withdraw', 'garage', 'chopRide', 'wake', 'open', 'close', 'frameMs', 'on', 'off'].every(k => typeof M[k] === 'function'); }));
    ok('menuEntry', null, await G(() => !!document.getElementById('rmEmpire')));
    R.offline = await G(() => window.SSX.empire.debug.offline()); R.dispPending = (await E('prop', ['fr-disp'])).pending;
    ok('offlineIncome', `${R.offline?.hours} h -> ${R.offline?.total} cr`, R.offline?.hours === 8 && R.dispPending > 0 && R.dispPending <= 900);
    R.clockSrc = (await E('clock')).source; R.seven = (await E('props')).length; ok('props', R.seven, R.seven === 7);
    await G(() => { window.__empEv = []; window.SSX.empire.on('*', e => window.__empEv.push(e)); window.SSX.empire.debug.force({ noThreats: true }); });
    await G(() => window.__app.surface.game.reward(0, 30000)); await G(() => window.__danger?.setClock?.(9));
    // ---- buy the laundromat at its door: context button -> sheet -> Buy
    await sleep(800); ok('noBtnAway', await label() || 'hidden', !(await label()) && (await E('action')) === null);
    ok('noExtraHud', null, await G(() => !document.getElementById('empBtn2') && !document.getElementById('empChip')));
    ok('menuOpensSheet', null, await viaMenu()); await tap('#empPanel button[data-a="view"][data-id="fr-wash"]'); await sleep(300);
    R.dirText = await G(() => document.querySelector('#empPanel .wrap')?.textContent || ''); ok('plainDirections', (/Go to the [^()]+\([^)]*\) and tap Buy\./.exec(R.dirText) || ['none'])[0], /Go to the Red Dust Wash & Fold \(\d+ m (north|south|east|west)[a-z-]*\) and tap Buy\./.test(R.dirText));
    await tap('#empPanel button[data-a="back"]'); await sleep(200); await tap('#empPanel button[data-a="mark"][data-id="fr-wash"]'); await sleep(300);
    await wait(() => /yellow ring/.test(document.querySelector('#empPanel .note')?.textContent || ''), 3000);
    R.markDbg = await G(() => ({ toast: document.getElementById('toast')?.classList.contains('on') ? document.getElementById('toast').textContent : '', note: document.querySelector('#empPanel .note')?.textContent || '', open: window.SSX.empire.isOpen }));
    ok('markNoteInSheet', JSON.stringify(R.markDbg), !/yellow ring/.test(R.markDbg.toast) && /yellow ring on the radar/.test(R.markDbg.note));
    await tap('#empPanel button[data-a="close"]'); await wait(() => !window.SSX.empire.isOpen, 4000);
    await go('fr-wash'); await sleep(1500);
    ok('buyBtn', await wait(() => window.SSX.empire.action() === 'buy', 15000) ? await label() : 'none', /Buy 2000/.test(await label()));
    ok('buyCentreClear', (await centreHits()).join() || 'clear', (await centreHits()).length === 0);
    ok('noOnclick', null, await G(() => ['empBtn'].every(id => { const b = document.getElementById(id); return b && !b.onclick && !b.getAttribute('onclick'); })));
    if (touch) { await P('#empBtn', 'pointerdown', 43); await P('#empBtn', 'pointercancel', 43); await sleep(250); ok('cancelNoOpen', null, !(await G(() => window.SSX.empire.isOpen))); }
    await ctxBtn(1); ok('buySheet', null, await wait(() => window.SSX.empire.isOpen && !!document.querySelector('#empPanel button[data-a="buy"]:not([disabled])'), 8000));
    R.buySheetFit = await sheetFits(); ok('sheetFits', JSON.stringify(R.buySheetFit), R.buySheetFit?.fits && R.buySheetFit.btnsIn && R.buySheetFit.minBtnH >= 40);
    await sleep(300); await shot('buy-sheet');
    const c0 = await credits(); await tap('#empPanel button[data-a="buy"]');
    ok('bought', null, await wait(() => window.SSX.empire.prop('fr-wash').owned, 6000)); ok('buyCharged', (await credits()) - c0, (await credits()) - c0 === -2000);
    await tap('#empPanel button[data-a="close"]'); ok('sheetClosed', null, await wait(() => !window.SSX.empire.isOpen, 4000));
    // ---- income on the Mars clock: 09:00 -> 12:00 (no SSX.time on main: dangercore clock) and the hourly 'income' event
    R.pend0 = (await E('prop', ['fr-wash'])).pending; await G(() => window.__danger?.setClock?.(10.5)); await sleep(1200); await G(() => window.__danger?.setClock?.(12)); await sleep(1500);
    R.pend1 = (await E('prop', ['fr-wash'])).pending; ok('incomeAccrues', `${R.pend0} -> ${R.pend1} (src ${R.clockSrc})`, R.pend1 - R.pend0 >= 150 && R.pend1 - R.pend0 <= 205);
    ok('incomeEvent', null, await G(() => window.__empEv.includes('income')));
    ok('perHourDay', await E('perHour'), (await E('perHour')) >= 60);
    // ---- collect at the counter
    ok('collectBtn', await wait(() => window.SSX.empire.action() === 'collect', 8000) ? await label() : await label() || 'none', /💵 \+\d+/.test(await label()));
    const c1 = await credits(), want = (await E('prop', ['fr-wash'])).pending; await ctxBtn(1); await sleep(400);
    R.collected = (await credits()) - c1; ok('collected', R.collected, R.collected === want && (await E('prop', ['fr-wash'])).pending === 0); await shot('income-collect');
    // ---- extortion: pay
    await G(() => window.SSX.empire.debug.threat('fr-wash', 'extort'));
    ok('extortTold', null, await wait(() => window.SSX.empire.threat()?.phase === 'demand' && !document.getElementById('empChip'), 6000));
    ok('extortViaMenu', null, await viaMenu() && await wait(() => !!document.querySelector('#empPanel button[data-a="pay"]') && /tap Pay or Tell them no/.test(document.querySelector('#empPanel .warn')?.textContent || ''), 6000));
    const dem = (await E('threat')).demand, c2 = await credits(); await tap('#empPanel button[data-a="pay"]'); await sleep(300);
    ok('paid', `${dem} cr`, (await credits()) - c2 === -dem && (await E('threat')) === null && !!(await E('prop', ['fr-wash'])).protect);
    ok('oneCaption', null, await G(() => !/Paid \d+ cr/.test(document.getElementById('toast')?.classList.contains('on') ? document.getElementById('toast').textContent : '') && /Paid \d+ cr/.test(document.querySelector('#empPanel .note')?.textContent || '')));
    // ---- extortion: refuse -> raid alert, and we're at the door -> the defense starts through SSX.raids
    await tap('#empPanel button[data-a="close"]'); await go('fr-wash', 'yard'); await sleep(500);
    await G(() => window.SSX.empire.debug.threat('fr-wash', 'extort')); await G(() => window.SSX.empire.open()); await wait(() => !!document.querySelector('#empPanel button[data-a="refuse"]'), 5000);
    await tap('#empPanel button[data-a="refuse"]'); ok('refused', null, await wait(() => window.SSX.empire.threat()?.phase !== 'demand', 4000));
    await tap('#empPanel button[data-a="close"]'); await heal();
    ok('defendStarts', null, await wait(() => window.SSX.empire.threat()?.phase === 'defend', 15000)); R.engine = (await E('threat'))?.engine; ok('raidsEngine', R.engine, R.engine === 'raids');
    ok('raidActive', null, await G(() => !!window.SSX.raids?.active?.()));
    await wait(() => (window.__raids?.npcs || 0) > 1, 25000); await sleep(2500); R.attackers = await G(() => window.__raids?.npcs || 0); await heal();
    R.npcDefend = await G(() => { const b = window.__app.surface.world.npcBudget?.(); return b ? `${b.used}/${b.cap}` : 'n/a'; });
    ok('npcCap', R.npcDefend, await G(t => { const b = window.__app.surface.world.npcBudget?.(); return !b || (b.used <= b.cap && (!t || b.cap <= 12)); }, touch));
    ok('defendCentreClear', (await centreHits()).join() || 'clear', (await centreHits()).length === 0);
    R.costMsRaid = await G(() => window.SSX.empire.frameMs()); await sleep(800); await shot('defend-raid');
    const c3 = await credits(); const t0 = Date.now(); let won = false;
    while (Date.now() - t0 < 120000) { await G(() => { window.__raids?.killAll?.(); window.__raids?.flushQueue?.(); const s = window.__app.surface; s.game.restore?.(); s.world.setWanted?.(0, 'test'); });
      if (await G(() => window.__empEv.includes('defend:win') || window.__empEv.includes('defend:lose'))) { won = await G(() => window.__empEv.includes('defend:win')); break; } await sleep(700); }
    ok('defendWin', won ? `+${(await credits()) - c3} cr` : 'lost/timeout', won && (await credits()) > c3);
    // ---- the hold fallback (no SSX.raids): the walk-up gets hit while we're on the block
    await heal(); await G(() => window.SSX.empire.debug.force({ noRaids: true }));
    await G(() => { window.SSX.empire.debug.grant('sh-rim'); }); await go('sh-rim'); await sleep(800);
    await G(() => window.SSX.empire.debug.threat('sh-rim', 'raid')); ok('holdStarts', null, await wait(() => window.SSX.empire.threat()?.engine === 'hold', 10000));
    R.holdSpawned = (await G(() => window.SSX.empire.debug.defense()))?.spawned; ok('holdNpcs', R.holdSpawned, R.holdSpawned >= 0 && R.holdSpawned <= 3);
    await G(() => window.SSX.empire.debug.win()); ok('holdWin', null, await wait(() => window.SSX.empire.threat() === null, 4000)); await G(() => window.SSX.empire.debug.force({ noRaids: false })); await heal();
    // ---- a lost raid (nobody came): the dispensary shuts and its till is gone
    await G(() => window.SSX.empire.debug.threat('fr-disp', 'raid')); await G(() => window.SSX.empire.debug.expire()); await sleep(800);
    R.disp = await E('prop', ['fr-disp']); ok('lostRaid', `shut ${R.disp.closedH} h, till ${R.disp.pending}`, R.disp.closedH > 0 && R.disp.pending === 0 && (await G(() => window.__empEv.includes('lost'))));
    // ---- safehouse: rest = save + heal, stash, garage spot
    await go('sh-rim'); await sleep(1000);
    ok('restBtn', await wait(() => window.SSX.empire.action() === 'rest', 8000) ? await label() : await label() || 'none', /Rest/.test(await label()));
    await G(() => { window.__app.surface.game.progress.hp = 20; }); await ctxBtn(1); await sleep(400);
    ok('rested', null, await G(() => window.__empEv.includes('rest') && window.SSX.empire.home() === 'sh-rim'));
    ok('oneCtxBtn', null, await G(() => document.querySelectorAll('#surfBtns [id^="empBtn"]').length === 1) && (await E('action2')) === null);
    await viaMenu(); await tap('#empPanel button[data-a="view"][data-id="sh-rim"]'); await wait(() => !!document.querySelector('#empPanel button[data-a="dep"]:not([disabled])'), 5000);
    const c4 = await credits(); await tap('#empPanel button[data-a="dep"][data-n="100"]'); await sleep(300);
    ok('stashDeposit', JSON.stringify((await E('prop', ['sh-rim'])).stash), (await E('prop', ['sh-rim'])).stash.credits === 100 && (await credits()) - c4 === -100);
    await tap('#empPanel button[data-a="close"]');
    await go('sh-rim', 'garage'); await sleep(1000);
    ok('garageBtn', await wait(() => window.SSX.empire.action() === 'garage', 8000) ? await label() : await label() || 'none', /Park here|Garage/.test(await label()));
    await ctxBtn(1); await sleep(400); ok('garage', null, await G(() => window.__empEv.includes('garage')));
    // ---- wake at the last safehouse you rested in
    await go('fr-wash', 'near'); await sleep(500); ok('wake', null, (await E('wake'))?.ok && await G(() => { const p = window.SSX.empire.prop('sh-rim').door, me = window.__app.surface.info; return Math.hypot(p.x - me.x, p.z - me.z) < 3; }));
    // ---- cost: per-frame CPU of the layer, and fps with it on vs off at the laundromat
    await go('fr-wash', 'near'); await sleep(1500); R.fpsOn = await fpsFor(3000); R.costMs = await G(() => window.SSX.empire.frameMs());
    await G(() => window.SSX.empire.setEnabled(false)); await sleep(800); R.fpsOff = await fpsFor(3000); await G(() => window.SSX.empire.setEnabled(true));
    ok('frameCost', `${R.costMs} ms/frame (raid ${R.costMsRaid}), fps ${R.fpsOn} on / ${R.fpsOff} off`, R.costMs < 1 && R.fpsOn >= R.fpsOff * 0.75);
    // ---- persisted
    R.saved = await G(() => Object.keys(JSON.parse(localStorage.getItem('ssx.empire.v1')).owned).sort().join()); ok('persisted', R.saved, /fr-disp/.test(R.saved) && /fr-wash/.test(R.saved) && /sh-rim/.test(R.saved));
    R.events = await G(() => [...new Set(window.__empEv)].join()); ok('events', R.events, ['buy', 'income', 'collect', 'extort', 'pay', 'refuse', 'defend:start', 'defend:win', 'lost', 'rest', 'stash', 'garage', 'wake'].every(e => R.events.split(',').includes(e)));
    R.stats = await G(() => window.SSX.empire.stats());
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || 'none', errors.length === 0);
  R.fail = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
