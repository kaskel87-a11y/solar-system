// v7.5 Mars dealership test: Red Line Motors (buy), lock-up garage (paint/body/wheels/glow + performance upgrades that
// change the driving spec), save persistence + old-save migration, night car meet (≤ 12 NPCs on phones), show off for
// rep, and a quarter-mile drag race (wager, start, finish, payout). On touch devices every dealership / garage / meet
// button is tapped while a SECOND finger holds the joystick (Chromium: real CDP multi-touch; WebKit: pointer events with
// a held joystick pointer, since Playwright WebKit has no multi-touch API).
// BASE=http://localhost:8794/ DEV=393x852 BR=webkit node tests/test-dealer.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'dealer';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView?.({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800); };
  const credits = () => G(() => window.__app.surface.game.progress.credits);
  // ---- taps: touch = with a thumb held on the joystick the whole time ----
  let cdp = null; const T = async (type, pts) => (cdp = cdp || await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  // the thumb goes down on the stick BEFORE the first tap and stays down (pointer-captured by #joy) while the sheets open over it
  let held = 0, stick = null, tid = 2;
  const holdStick = async () => {
    if (stick || !touch) return;
    const j = await center('#joy'); const free = await G(j => !!document.elementFromPoint(j.x, j.y)?.closest('#joy'), j); if (!free) return;
    if (BR === 'chromium') { cdp = cdp || await ctx.newCDPSession(page); await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(50); await T('touchMove', [{ x: j.x, y: j.y - 30, id: 1 }]); await sleep(50); }
    else await G(j => { const el = document.getElementById('joy'); const o = { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: j.x, clientY: j.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: j.y - 30 })); }, j);
    stick = { x: j.x, y: j.y - 30 };
  };
  const releaseStick = async () => {
    if (!stick) return; const j = stick; stick = null;
    if (BR === 'chromium') { await T('touchEnd', [{ x: j.x, y: j.y, id: 1 }]); await sleep(60); }
    else await G(j => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: j.x, clientY: j.y })), j);
    await sleep(100);
  };
  const tap = async sel => {
    if (!touch) { const c = await center(sel); if (!c) throw new Error('no ' + sel); await page.mouse.click(c.x, c.y); await sleep(250); return; }
    await holdStick(); let c = await center(sel); if (!c) throw new Error('no ' + sel);
    // v7.5.3 #ssxDock (mars/turf.js) steps left of #surfBtns on a 300 ms tick once a ctx button grows the column: wait for it like a thumb would
    await wait(s => { const e = document.querySelector(s), b = e?.getBoundingClientRect(); return !!b && e.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)); }, 1500, sel).catch(() => null); c = await center(sel) || c;
    const id = tid++, j = stick;
    if (BR === 'chromium') { const pts = j ? [{ x: j.x, y: j.y, id: 1 }] : []; await T('touchStart', [...pts, { x: c.x, y: c.y, id }]); await sleep(60); await T('touchEnd', [{ x: c.x, y: c.y, id }]); }
    else await G(([c, id]) => { const el = document.elementFromPoint(c.x, c.y); const o = { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: false, clientX: c.x, clientY: c.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); /* no click: iOS drops it while the stick is held */ }, [c, id]);
    await sleep(250); held++; if (j && Math.abs(await G(() => window.__app.joy.y)) > 0.1) R.stickHeld = (R.stickHeld || 0) + 1;
  };
  const ctxShown = re => wait(re => { const b = document.getElementById('dlrCtxBtn'); return b && b.style.display === 'block' && new RegExp(re).test(b.textContent); }, 15000, re);
  const sheetIs = k => wait(k => document.getElementById('dlrSheet')?.dataset.kind === k, 5000, k);
  const toMars = async () => { await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land(); await G(() => window.__app.surface.game.setAliens?.(false)); };
  const drive = async () => { await G(() => { const s = window.__app.surface; if (!s.info.driving) { s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); } }); return wait(() => window.__app.surface.info.driving, 5000); };
  try {
    // ---------- 0. an old v7.4 save (no garage key) loads and migrates ----------
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.progress.v1', JSON.stringify({ v: 1, xp: 120, credits: 9000, badges: ['first'], quests: {}, equip: { paint: 'steel' } })); });
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('ssxHooks', null, await G(() => ['registerDealerVehicle', 'dealerStock', 'configureDealer'].every(k => typeof window.SSX[k] === 'function') && typeof window.SSX.registerVehicle === 'function'));
    // a mod vehicle with just a price shows up (the Raccoon Mobile path), hidden ones don't
    await G(async () => { window.SSX.registerVehicle('test_mod', { name: 'Test Mod', vmax: 22, boost: 33, acc: 11, bacc: 16, turn: 1.6, r: 2.3, price: 3100, icon: '🦝' }); if (!(await import('./world.js')).VEHICLES.raccoon_mobile) window.SSX.registerVehicle('raccoon_mobile', { name: 'Raccoon Mobile', icon: '🦝', price: 900, vmax: 21, boost: 33, acc: 13.5, bacc: 19, turn: 2.2, wy: 0.48, wr: 0.48, r: 2.1, airTurn: 1.3, offroad: 0.9, blurb: 'Scrappy, quick on its feet, smells faintly of bins.', dealer: { venue: 'depot', world: 'Mars', colony: 'Ares Junction' } }); /* Ben's PR #11 shape (stub when #11 isn't merged) */ window.SSX.registerVehicle('test_hidden', { name: 'Hidden', vmax: 22, price: 10, hidden: true }); });
    const stock = await G(() => window.SSX.dealerStock().map(s => s.kind));
    ok('modVehicleListed', stock.join(','), stock.includes('test_mod') && stock.includes('raccoon_mobile') && !stock.includes('test_hidden') && stock.length >= 6);
    await toMars();
    const mig = await G(() => ({ g: window.__dealer.garage, c: window.__app.surface.game.progress.credits, xp: window.__app.surface.game.progress.xp }));
    ok('oldSaveMigrated', null, mig.g.rides.length === 1 && mig.g.active === 'stock' && mig.c === 9000 && mig.xp === 120);
    ok('noCtxAtShip', null, await G(() => document.getElementById('dlrCtxBtn')?.style.display !== 'block'));
    // ---------- 1. ☰ hub ----------
    await G(() => window.__app.toggleMenu(true)); await sleep(250);
    await tap('#rmRides'); ok('hubOpens', null, await sheetIs('hub'));
    ok('hubText', null, await G(() => /Colony time|Car meet/.test(document.getElementById('dlrSheet').innerText) /* SSX.time shared clock shows the meet line instead */ && /Dealer/.test(document.getElementById('dlrSheet').innerText)));
    await tap('[data-nav="dealer"]'); ok('navMarker', null, await G(() => !document.getElementById('dlrSheet') && !!window.__app.surface.game.mapGate?.()));
    // ---------- 2. dealer ----------
    await releaseStick();
    await G(() => window.__dealer.tp('dealer', 13)); ok('dealerCtx', null, await ctxShown('Dealer'));
    const bb = await G(() => { const r = document.getElementById('dlrCtxBtn').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, W: innerWidth, H: innerHeight }; });
    ok('ctxOffCentre', JSON.stringify(bb), bb.l > bb.W * 0.55 || bb.t > bb.H * 0.7);
    await tap('#dlrCtxBtn'); ok('dealerSheet', null, await sheetIs('dealer'));
    ok('lockedMarked', null, await G(() => { const b = [...document.querySelectorAll('[data-dsel]')].find(b => b.dataset.dsel === 'olympus_gt'); return !!b && /🔒/.test(b.textContent); }));
    await tap('[data-dsel="olympus_gt"]'); ok('lockedBuyDisabled', null, await G(() => document.querySelector('[data-buy]').disabled && /rep/.test(document.getElementById('dlrSheet').innerText)));
    await tap('[data-dsel="red_comet"]'); await sleep(900); await shot('dealer');
    const c0 = await credits(); await tap('[data-buy="red_comet"]');
    ok('bought', null, await wait(() => window.__dealer.garage.rides.some(r => r.kind === 'red_comet'), 4000));
    const c1 = await credits(); ok('charged', c0 - c1, c0 - c1 === 1900);
    ok('rideApplied', null, await wait(() => { const r = window.__dealer.ride; return r.kind === 'red_comet' && r.skin && r.stockHidden && r.spec.vmax === 25 && r.spec.boost === 38; }, 4000));
    ok('drivesNewRide', null, await drive());
    // ---------- 3. garage: customise + upgrade ----------
    await releaseStick();
    await G(() => window.__dealer.tp('garage', 8)); ok('garageCtx', null, await ctxShown('Garage'));
    await tap('#dlrCtxBtn'); ok('garageSheet', null, await sheetIs('garage'));
    const id = await G(() => window.__dealer.garage.active);
    for (const [tab, v] of [['paint', 'candy'], ['kit', 'widebody'], ['wheels', 'chrome'], ['glow', 'cyan']]) { await tap(`[data-tab="${tab}"]`); await tap(`[data-cos="${tab}:${v}"]`); }
    const rd = await G(id => window.__dealer.rideById(id), id);
    ok('customised', JSON.stringify([rd.paint, rd.kit, rd.wheels, rd.glow]), rd.paint === 'candy' && rd.kit === 'widebody' && rd.wheels === 'chrome' && rd.glow === 'cyan');
    await tap('[data-tab="perf"]'); const s0 = await G(() => window.__dealer.ride.spec);
    await tap('[data-up="engine"]'); ok('upgradePreview', null, await G(() => /Tap again/.test(document.querySelector('[data-up="engine"]').textContent) && !!document.querySelector('#dlrSheet .bar b')));
    // second tap buys (a tap can land mid-frame on a loaded box: retry, then require the level)
    const buyUp = async (slot, lvl) => { for (let i = 0; i < 3; i++) { if (await G(([s, l, id]) => window.__dealer.rideById(id).up[s] >= l, [slot, lvl, id])) return true; await tap(`[data-up="${slot}"]`); await sleep(150); } return G(([s, l, id]) => window.__dealer.rideById(id).up[s] >= l, [slot, lvl, id]); };
    await tap('[data-up="engine"]'); ok('engineBought', null, await buyUp('engine', 1)); ok('brakesBought', null, await buyUp('brakes', 1));
    await wait(() => window.__dealer.ride?.spec?.brake === 1.35, 5000); const s1 = await G(() => window.__dealer.ride.spec); // re-applied on the next frame
    ok('upgradeChangesSpec', JSON.stringify({ v0: s0.vmax, v1: s1.vmax, b: s1.brake, t0: s0.turn, t1: s1.turn }), s1.vmax > s0.vmax && s1.acc > s0.acc && s1.brake === 1.35 && s1.turn > 1.85);
    await sleep(800); await shot('garage');
    await tap('[data-close="1"]'); await sleep(200);
    await releaseStick();
    // brakes: a braking car with the brakes upgrade stops harder than the stock 26 m/s²
    await G(() => { const st = window.__app.surface, p = window.__dealer.spots.dealer; st.debugMove(p.x - 4, p.z + 14, Math.PI); window.__race.setCarSpeed(0); }); // flat dealer apron
    await wait(() => { const c = window.__race.car(); return !!c && !c.air; }, 4000); await G(() => window.__race.setCarSpeed(20)); // car() is null on foot / between swaps
    const b0 = await G(() => { window.__app.joy.y = 1; return { v: window.__race.car()?.speed ?? NaN, a: window.__dealer.brakeAssist }; }); // stick pulled back = brake
    await G(() => new Promise(r => { let n = 0; const f = () => (++n >= 8 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const b1 = await G(() => { window.__app.joy.y = 0; return { v: window.__race.car()?.speed ?? NaN, a: window.__dealer.brakeAssist }; });
    R.brake = JSON.stringify({ v0: b0.v, v1: b1.v, assist: +(b1.a - b0.a).toFixed(2) });
    ok('brakesStronger', null, b1.v < b0.v && b1.a - b0.a > 0.2);
    // ---------- 4. save + reload ----------
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000); await toMars();
    const after = await G(() => ({ g: window.__dealer.garage }));
    const ra = after.g.rides.find(r => r.kind === 'red_comet');
    ok('savePersists', null, !!ra && after.g.active === ra.id && ra.paint === 'candy' && ra.up.engine === 1 && ra.up.brakes === 1 && ra.owned.glow.includes('cyan'));
    ok('rideReappliedAfterReload', null, await wait(() => window.__dealer.ride?.kind === 'red_comet' && window.__dealer.ride.spec.brake === 1.35, 5000));
    await G(() => window.__app.surface.game.debug.credits(2000));
    // free grants for other modules (e.g. a mechanic's favour): no credits spent, saved
    const gr = await G(() => { const c = window.__app.surface.game.progress.credits, g = window.SSX.garage;
      const a = g.grantUpgrade('current', 'boost'), b = g.grantPart('current', 'glow', 'magenta'), c2 = g.grant('current', 'wheels:gold'), bad = g.grantUpgrade('current', 'nitro');
      const r = g.rides.find(x => x.id === g.active); return { a: a.ok, b: b.ok, c: c2.ok, bad: bad.ok, cost: c - window.__app.surface.game.progress.credits, boost: r.up.boost, glow: r.glow, wheels: r.wheels, saved: JSON.parse(localStorage.getItem('ssx.progress.v1')).garage.rides.find(x => x.id === g.active).up.boost }; });
    const gv = await G(() => { const g = window.SSX.garage, c = window.__app.surface.game.progress.credits, act = g.active, n = g.rides.length;
      const a = g.grantVehicle('ares_brute', { noPlates: true, active: false }), bad = g.grantVehicle('nope'); const r = g.rides.find(x => x.id === a.ride);
      return { ok: a.ok, bad: bad.ok, n: g.rides.length - n, noPlates: r?.noPlates, act: g.active === act, cost: c - window.__app.surface.game.progress.credits,
        saved: !!JSON.parse(localStorage.getItem('ssx.progress.v1')).garage.rides.find(x => x.id === a.ride && x.noPlates) }; });
    // Torque's barter ids (game.js SHOP rover gear), applied via game.buy at no net cost; turret3 needs turret2; Dutch's buggy
    const gs = await G(() => { const g = window.SSX.garage, gm = window.__app.surface.game, c = gm.progress.credits;
      const t3a = g.grantUpgrade('current', 'turret3'), arm = g.grantUpgrade('current', 'roverarmor'), t2 = g.grantUpgrade('current', 'turret2'), t3 = g.grant('current', 'turret3'), again = g.grantUpgrade('current', 'roverarmor'), suit = g.grantUpgrade('current', 'armor');
      const bug = g.grantVehicle('buggy', { noPlates: true, active: false });
      return { t3a: t3a.ok, arm: arm.ok, t2: t2.ok, t3: t3.ok, again: again.ok, suit: suit.ok, cost: c - gm.progress.credits, ups: ['roverarmor', 'turret2', 'turret3'].every(u => gm.progress.upgrades.includes(u)), ids: g.shopUpgrades.join(','), bug: bug.ok }; });
    R.grantShop = JSON.stringify(gs); ok('grantShopIds', null, !gs.t3a && gs.arm && gs.t2 && gs.t3 && !gs.again && !gs.suit && gs.cost === 0 && gs.ups && gs.bug);
    R.grantVehicle = JSON.stringify(gv); ok('grantVehicle', null, gv.ok && !gv.bad && gv.n === 1 && gv.noPlates && gv.act && gv.cost === 0 && gv.saved);
    R.grant = JSON.stringify(gr); ok('grantFree', null, gr.a && gr.b && gr.c && !gr.bad && gr.cost === 0 && gr.boost === 1 && gr.glow === 'magenta' && gr.wheels === 'gold' && gr.saved === 1);
    // ---------- 5. car meet ----------
    await G(() => window.__dealer.skipToMeet()); ok('meetOn', null, await G(() => window.__dealer.meet.on));
    await drive(); await G(() => window.__dealer.tp('meet', 0));
    ok('meetSpawns', null, await wait(() => window.__dealer.meet.spawned?.cars > 0, 8000));
    await G(() => window.__dealer.meet.arriveAll()); await sleep(600);
    const sp = await G(() => window.__dealer.meet.spawned); R.npcs = JSON.stringify(sp);
    ok('npcCap', sp.cars + sp.people, touch ? sp.cars + sp.people <= 12 : sp.cars + sp.people <= 16);
    // show off: lot edge, away from the parked cars
    await releaseStick();
    await G(() => { const s = window.__dealer.spots.meet; window.__app.surface.debugMove(s.x - 26, s.z, 0); }); ok('showOffCtx', null, await ctxShown('Show off'));
    const rep0 = await G(() => window.__dealer.garage.rep); await tap('#dlrCtxBtn'); await sleep(300);
    const rep1 = await G(() => window.__dealer.garage.rep); ok('showOffRep', rep1 - rep0, rep1 - rep0 >= 20);
    await sleep(1200); await G(() => window.__dealer.closeSheet()); await ctxShown('Show off'); await tap('#dlrCtxBtn'); ok('showOffOncePerMeet', null, await G(r => window.__dealer.garage.rep === r, rep1));
    await sleep(2600); await G(() => window.__dealer.closeSheet()); // nothing left open before the race prompt
    // drag race: roll up to an NPC, challenge, wager, race
    await G(() => { window.__evlog = []; const t0 = performance.now(); for (const ty of ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown']) document.addEventListener(ty, e => window.__evlog.push([ty, e.pointerType || '', e.target?.id || e.target?.tagName, e.key || '', Math.round(performance.now() - t0), window.__dealer.sheet]), true); });
    const npc = await G(() => window.__dealer.meet.cars()[0]);
    await releaseStick();
    await G(n => { window.__app.joy.x = window.__app.joy.y = 0; window.__app.surface.debugMove(n.x, n.z + (n.z > window.__dealer.spots.meet.z ? -5.5 : 5.5), 0); window.__race.setCarSpeed?.(0); }, npc);
    const rc = await ctxShown('Race'); if (!rc) R.raceDiag = JSON.stringify(await G(n => { const i = window.__app.surface.info; return { ctx: window.__dealer.ctx, me: [i.roverX, i.roverZ], npc: [n.x, n.z], joy: { ...window.__app.joy }, drag: window.__dealer.meet.drag, sheet: window.__dealer.sheet, ev: window.__evlog.slice(0, 30) }; }, npc)); ok('raceCtx', null, rc);
    await sleep(900); await shot('meet');
    await tap('#dlrCtxBtn'); ok('challengeSheet', null, await sheetIs('challenge'));
    await tap('[data-wager="100"]'); ok('wagerPicked', null, await G(() => document.querySelector('[data-wager="100"]').classList.contains('on')));
    const cd0 = await credits(); await tap('[data-drag="1"]');
    ok('dragStarts', null, await wait(() => window.__race.state?.id === 'meet-drag' && window.__race.state.phase === 'grid', 6000));
    ok('wagerEscrowed', null, cd0 - (await credits()) === 100);
    await sleep(500); await shot('drag');
    await releaseStick();
    await G(() => window.__race.skipCountdown()); ok('dragGo', null, await wait(() => window.__race.state?.phase === 'run', 6000));
    const S = await G(() => window.__dealer.spots), yaw = Math.atan2(-(S.stripTo.x - S.stripFrom.x), -(S.stripTo.z - S.stripFrom.z));
    const thru = async p => { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); for (const k of [-5, 5]) { await G(a => new Promise(r => { window.__race.place(a[0], a[1], a[2]); let n = 0; const f = () => (++n >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), [p.x + fx * k, p.z + fz * k, yaw]); await sleep(80); } };
    const cpre = await credits(); await thru(S.stripFrom); await thru(S.stripTo);
    ok('dragFinished', null, await wait(() => !window.__race.state && window.__race.result?.id === 'meet-drag', 15000));
    const res = await G(() => window.__race.result); R.dragResult = JSON.stringify({ won: res?.won, cr: res?.credits, buyIn: res?.buyIn, t: res?.time });
    ok('dragWon', null, res.done && res.won);
    ok('dragPayout', res.credits, res.credits === 100 * 2 + 30 + 40 + 100);
    ok('creditsPaid', (await credits()) - cpre, (await credits()) - cpre === res.credits);
    ok('dragSettled', null, await wait(() => window.__dealer.garage.wins === 1 && window.__dealer.garage.races === 1 && window.__dealer.meet.last?.won, 5000));
    ok('rematchHidden', null, await G(() => { const b = document.getElementById('raceAgain'); return !b || getComputedStyle(b).display === 'none'; }));
    await sleep(600); await shot('drag-result');
    await releaseStick();
    // ---------- 6. leaving: no stray UI ----------
    await G(() => window.__app.takeOff?.()); await wait(() => !window.__app.state.onSurface, 15000); await sleep(1200);
    ok('cleanOnTakeoff', null, await G(() => !document.getElementById('dlrSheet') && document.getElementById('dlrCtxBtn')?.style.display !== 'block'));
    R.held = held; if (touch) ok('tapsWithStickHeld', `${R.stickHeld}/${held}`, (R.stickHeld || 0) >= held * 0.8);
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || null, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
