// Ship smuggling runs (mars/smuggle.js): pick up at the Ares Junction pad (📦 RUN dock button / key 8, touch: tapped while
// a 2nd finger holds #joy), take off, customs scan cone (fills in the beam, roll cuts it, bribe clears the beacon, refused
// bribe or a full meter flags you), interceptor chase (lock, roll breaks it, hits damage the crate, boost away to lose
// them), the Phobos drop, land on Mars, cash (8 / 💰) or favor (9 / 🤝) through SSX.contraband, dump (X / DUMP: run over,
// no heat), seized at 0 hp, feature-detected SSX.bribes / SSX.airRoll / SSX.pursuit, M-rated toasts, phone NPC budget.
// BASE=http://localhost:8871/ BR=webkit DEV=393x852 SHOTS_DIR=... node tests/test-smuggle.js (DEV=desktop: 1280x800)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8871/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `smuggle-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/Failed to start the audio device/.test(e.message)) errors.push('PE ' + e.message); }); /* headless box: no audio sink */
  page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return r.width > 0; }, [t, sel, id, dx, dy]);
  const heldTap = async sel => { await P('pointerdown', '#joy', 41); await P('pointermove', '#joy', 41, 0, -4); const v = await P('pointerdown', sel, 42); await P('pointerup', sel, 42); await P('pointerup', '#joy', 41, 0, -4); return v; };
  const shown = sel => G(s => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0; }, sel);
  const bw = sel => G(s => { const c = getComputedStyle(document.querySelector(s)); return c.backgroundColor === 'rgb(0, 0, 0)' && c.color === 'rgb(255, 255, 255)'; }, sel);
  // act: touch taps the button (2nd finger while one holds #joy); desktop presses the key
  const act = async (sel, key) => { if (touch) { await wait(s => { const e = document.querySelector(s); return e && !e.hidden && getComputedStyle(e).display !== 'none'; }, 20000, sel); return heldTap(sel); } await page.keyboard.press(key); return true; };
  const overlap = async k => { const ov = await G(() => { const a = document.getElementById('smgHud').getBoundingClientRect(), hit = [];
        for (const e of document.querySelectorAll('#hudSpeed,#flyBtn,#flyBtns,#landBtn,#landMsg,#joy,#menuBtn,button,#toast,#stackR > *')) {
          if (e.closest('#smgHud') || !e.getClientRects().length) continue; const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) continue;
          const b = e.getBoundingClientRect(); if (b.width && b.height && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hit.push(e.id || e.className || e.tagName); }
        return hit; }); ok(k, ov.join(',') || 'none', ov.length === 0); };
  const st = () => G(() => window.SSX.smuggle.state);
  const D = (fn, a) => G(([fn, a]) => window.__smuggle.debug[fn](...(a || [])), [fn, a]);
  const toasts = () => G(() => window.__smuggle.debug.log());
  const space = () => wait(() => { const s = window.__app.state; return s.flying && !s.onSurface && !s.transitioning; }, 30000);
  const credits = () => G(() => window.__app.surface.game.progress.credits);
  const takeOff = async () => { await G(() => window.__app.takeOff()); return space(); };
  const landMars = async () => { await D('placeNearMars', [7]); await wait(() => window.__app.state.near === 'Mars', 10000); await G(() => window.__app.land()); return wait(() => window.__app.state.onSurface && !window.__app.state.transitioning, 30000); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('api', await wait(() => !!window.SSX?.smuggle && typeof window.SSX.smuggle.start === 'function', 20000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.__app.surface.game.progress.credits = 5000; });
    // ---- pickup at the pad ----
    ok('notAtPadYet', await G(() => window.SSX.smuggle.state.why), ['notPad', null].includes(await G(() => window.SSX.smuggle.state.why)));
    const pad = await G(() => { const i = window.__app.surface.info; return { x: i.colony.x - 38, z: i.colony.z + 10 }; });
    await G(p => window.__app.surface.debugPlace(p.x + 3, p.z + 2, 0.6), pad);
    ok('atPad', await wait(() => window.SSX.smuggle.state.why === null, 10000));
    if (touch) { ok('dockRun', await wait(() => { const b = document.getElementById('dockSmg'); return b && getComputedStyle(b).display !== 'none' && /RUN/.test(b.textContent); }, 20000)); ok('dockBW', await bw('#dockSmg')); }
    const noRadio = () => G(() => { const r = document.getElementById('radio'); if (r) r.style.display = 'none'; }); // portrait hides #toast while the radio pill shows
    await noRadio();
    ok('pickupTap', await act('#dockSmg', 'Digit8'));
    ok('runStarted', await wait(() => window.SSX.smuggle.state.run?.phase === 'outbound', 5000));
    ok('pickupToast', (await toasts()).find(t => /Gutter Pell/.test(t)) || null, (await toasts()).some(t => /Gutter Pell/.test(t)));
    await wait(() => /Phobos/.test(document.querySelector('#smgHud .t').textContent), 5000);
    ok('preHud', await G(() => document.querySelector('#smgHud .t').textContent), /Phobos/.test(await G(() => document.querySelector('#smgHud .t').textContent)) && await shown('#smgHud'));
    await overlap('hudNoOverlapSurface'); await noRadio(); await sleep(700); await noRadio(); await shot('pickup');
    if (!touch) { await page.keyboard.press('KeyX'); await sleep(200); ok('xOnSurfaceKeepsRun', !!(await st()).run); }
    // ---- take off: tiny space strip ----
    ok('takeOff', await takeOff()); await sleep(500);
    ok('hudShown', await shown('#smgHud'));
    ok('hudBW', await bw('#smgHud'));
    ok('hudSmall', await G(() => { const r = document.getElementById('smgHud').getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }), await G(() => { const r = document.getElementById('smgHud').getBoundingClientRect(); return r.height <= 44 && r.width <= Math.min(300, innerWidth * 0.8); }));
    await overlap('hudNoOverlap');
    ok('hudTarget', await G(() => document.querySelector('#smgHud .t').textContent), /Phobos \d+|SCAN/.test(await G(() => document.querySelector('#smgHud .t').textContent)));
    ok('frameVisible', await G(() => window.__app.rocket.parent.getObjectByName('smuggleFrame')?.visible === true));
    // ---- customs scan: in the cone, roll cuts it ----
    await D('freezeBeam', [true]); await D('placeInBeam', ['kestrel', 12]);
    ok('scanStarts', await wait(() => window.SSX.smuggle.state.scanning === 'kestrel' && window.SSX.smuggle.state.scan.kestrel > 0.3, 30000));
    await D('pause', [true]); // slow software-GL browsers: keep the meter still while we look and screenshot
    ok('scanToast', (await toasts()).some(t => /📡/.test(t)));
    ok('bribeShown', await shown('#smgBribe')); ok('rollShown', await shown('#smgRoll'));
    await overlap('hudNoOverlapScan'); await shot('scan');
    const v0 = (await st()).scan.kestrel, d0 = (await st()).run.dodges;
    ok('rollTap', touch ? await heldTap('#smgRoll') : (await G(() => window.SSX.smuggle.roll(1)), true)); R.rollStarted = await G(() => !!window.__app.shipRoll || window.__app.shipRolls); await D('pause', [false]);
    ok('rollDodge', await wait(d => window.SSX.smuggle.state.run.dodges > d, 30000, d0));
    ok('rollCutScan', `${v0} -> ${(await st()).scan.kestrel}`, (await st()).scan.kestrel < v0);
    // ---- bribe clears the beacon (feature-detected SSX.bribes price) ----
    await G(() => { window.SSX.bribes = window.SSX.bribes || { price: o => 200 + 10 * o.stars, __fake: true }; });
    await wait(() => window.SSX.smuggle.state.scan.kestrel > 0.2 && window.SSX.smuggle.state.scanning === 'kestrel', 8000);
    const q = await G(() => document.getElementById('smgBribe').textContent); ok('bribeQuoteFromSSX', q, /💸2\d0/.test(q) || !(await G(() => window.SSX.bribes.__fake)));
    await D('pause', [true]); await D('forceRefuse', [false]); const c0 = await credits();
    ok('bribeTap', await act('#smgBribe', 'KeyB')); await D('pause', [false]);
    ok('bribeCleared', await wait(() => window.SSX.smuggle.state.run.cleared.includes('kestrel') && window.SSX.smuggle.state.run.flags === 0, 3000));
    ok('bribePaid', `${c0 - await credits()} cr`, c0 - await credits() > 0);
    // ---- warden: let the meter fill -> flagged -> interceptors ----
    await G(() => { window.__raised = []; window.SSX.pursuit = window.SSX.pursuit || { heat: 0, raise(n, why) { this.heat += n; window.__raised.push(why); }, __fake: true }; });
    await D('placeInBeam', ['warden', 10]);
    ok('flagged', await wait(() => window.SSX.smuggle.state.run.flags === 1, 30000));
    ok('flagToast', (await toasts()).some(t => /🚨/.test(t)));
    ok('heatViaPursuit', await G(() => window.__raised.join('|') || window.SSX.smuggle.state.heatVia), (await G(() => window.__raised.length)) > 0 || !(await G(() => window.SSX.pursuit.__fake)));
    const nI = (await st()).interceptors; ok('interceptors', nI, nI >= 1 && nI <= (touch ? 2 : 3));
    await D('freezeBeam', [false]); await D('pullIcpBehind', [-13]);
    ok('lockBuilds', await wait(() => window.SSX.smuggle.state.locked, 30000));
    await D('pause', [true]); await overlap('hudNoOverlapChase'); await shot('chase');
    // roll breaks the lock (via SSX.airRoll when it can roll: fake one)
    await G(() => { window.__ar = []; window.SSX.airRoll = window.SSX.airRoll || { canRoll: () => true, roll(d) { window.__ar.push(d); window.__app.requestRoll(d === 'left' ? -1 : 1); return true; }, isRolling: () => !!window.__app.shipRoll, __fake: true }; });
    const r0 = (await st()).run.dodges;
    ok('rollTap2', touch ? await heldTap('#smgRoll') : (await G(() => window.SSX.smuggle.roll(-1)), true)); await D('pause', [false]);
    ok('rollViaAirRoll', await G(() => window.__ar.join(',') || 'native'), (await G(() => window.__ar.length)) > 0 || !(await G(() => window.SSX.airRoll.__fake)));
    ok('rollBreaksLock', await wait(d => window.SSX.smuggle.state.run.dodges > d, 30000, r0));
    await D('pullIcp', [6]);
    ok('hit', await wait(() => window.SSX.smuggle.state.run.hp < 100, 30000));
    ok('hpHud', await G(() => document.querySelector('#smgHud .t').textContent), /🚨/.test(await G(() => document.querySelector('#smgHud .t').textContent)));
    // boost away: put them 80 behind and hold boost + forward
    await G(() => { const a = window.__app; a.touchBtns.boost = true; a.joy.y = -1; });
    await D('pullIcpBehind', [80]);
    ok('lostThem', await wait(() => window.SSX.smuggle.state.interceptors === 0, 30000));
    await G(() => { const a = window.__app; a.touchBtns.boost = false; a.joy.y = 0; });
    ok('lostToast', (await toasts()).some(t => /gave up/.test(t)));
    // ---- the Phobos drop ----
    await D('pauseDrop', [true]); await D('placeAtPhobos', [3]);
    ok('inDropRing', await wait(() => window.__smuggle.debug.hold() > 0.3, 30000));
    await sleep(400); await shot('phobos-drop');
    // re-seat in the ring after the (slow, frame-stalling) screenshot, stop all input, then let the hold count
    await G(() => { const a = window.__app; a.touchBtns.boost = false; a.joy.x = 0; a.joy.y = 0; });
    await D('placeAtPhobos', [3]); await D('pauseDrop', [false]);
    const trace = []; const tr = setInterval(async () => { try { trace.push(await G(() => document.querySelector('#smgHud .t').textContent + ' h' + window.__smuggle.debug.hold().toFixed(2))); } catch {} }, 1000);
    ok('dropped', await wait(() => window.SSX.smuggle.state.run?.phase === 'return', 30000));
    clearInterval(tr); if ((await st()).run?.phase !== 'return') R.dropTrace = trace;
    ok('dropToast', (await toasts()).some(t => /Dropped at Stickney|Phobos crew/.test(t)));
    ok('hudHome', await G(() => document.querySelector('#smgHud .t').textContent), /Mars \d+/.test(await G(() => document.querySelector('#smgHud .t').textContent)));
    // ---- home: land on Mars, take the cash ----
    ok('landed', await landMars());
    ok('payoutPhase', await wait(() => window.SSX.smuggle.state.run?.phase === 'payout', 8000));
    if (touch) ok('dockCashFavor', await wait(() => /CASH/.test(document.getElementById('dockSmg').textContent) && getComputedStyle(document.getElementById('dockSmgF')).display !== 'none', 10000));
    const hp = (await st()).run.hp, cA = await credits();
    ok('cashTap', await act('#dockSmg', 'Digit8'));
    ok('paid', await wait(() => !window.SSX.smuggle.state.run && window.SSX.smuggle.state.last?.got?.kind === 'cash', 5000));
    const got = (await st()).last.got.cash; ok('cashAmount', `${got} cr (hp ${hp}, 1 flag)`, (await credits()) - cA === got && got === Math.round(480 * hp / 100 * 1.18 / 5) * 5);
    ok('hudHiddenOnSurface', !(await shown('#smgHud')));
    // ---- favor: through SSX.contraband ----
    await D('cool'); await G(p => window.__app.surface.debugPlace(p.x + 2, p.z, 0.6), pad); await sleep(300);
    ok('run2', (await G(() => window.SSX.smuggle.start())).ok);
    await D('skipTo', ['payout']); await sleep(200);
    const stash0 = await G(() => window.SSX.contraband?.stash?.().total ?? -1);
    ok('favorTap', await act('#dockSmgF', 'Digit9'));
    ok('favorPaid', await wait(() => !!window.SSX.smuggle.state.last?.got && !window.SSX.smuggle.state.run, 5000));
    const g2 = (await st()).last.got; ok('favorViaContraband', `${g2.kind} ${JSON.stringify(g2.bundle || g2.cash)}; stash ${stash0} -> ${await G(() => window.SSX.contraband?.stash?.().total ?? -1)}`, stash0 < 0 ? g2.kind === 'cash' : (g2.kind === 'favor' && (await G(() => window.SSX.contraband.stash().total)) > stash0));
    // ---- dump: run over, no heat ----
    await D('cool'); ok('run3', (await G(() => window.SSX.smuggle.start())).ok);
    ok('takeOff2', await takeOff()); await sleep(300);
    const h0 = (await st()).heat, rs0 = await G(() => window.__raised.length);
    ok('dumpTap', await act('#smgDump', 'KeyX'));
    ok('dumped', await wait(() => !window.SSX.smuggle.state.run, 3000));
    ok('dumpNoHeat', `${h0} -> ${(await st()).heat}`, (await st()).heat <= h0 && (await G(() => window.__raised.length)) === rs0);
    ok('dumpToast', (await toasts()).some(t => /📦 (Cargo spaced|Crate out)/.test(t)));
    // ---- seized at 0 hp ----
    await D('forceStart'); await D('flag', ['kestrel']); await D('setHp', [20]); await D('pullIcp', [5]);
    ok('seized', await wait(() => !window.SSX.smuggle.state.run, 30000));
    ok('seizedToast', (await toasts()).some(t => /seized/.test(t)));
    ok('failedCount', (await st()).saved.failed, (await st()).saved.failed === 2);
    ok('seizedHeat', await G(() => window.__raised.length), (await G(() => window.__raised.length)) >= 2);
    ok('hudGone', !(await shown('#smgHud')));
    // ---- back on Mars: budget ----
    await G(() => window.__app.takeOff()).catch(() => {});
    ok('landed2', await landMars());
    const b = await G(() => window.SSX.city?.npcBudget?.() || null); ok('npcBudget', b ? `${b.used}/${b.cap}` : 'n/a', !b || (b.used <= b.cap && (!touch || b.cap <= 12)));
    ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  if (bad.length) try { R.log = await toasts(); R.stateAtEnd = await st(); } catch (e) { /* */ }
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
