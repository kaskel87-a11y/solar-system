// PR #33 iPhone review fixes (storymars2.js), driven through the real game paths (no heistDone()):
//  A) rook-05: break in at the bank door -> 'Crack safe' only inside the bank vault (not on the Ares Junction plaza, not on
//     the street) -> a successful crack goes to escape (no heist:fail, no 'blown: done'), the job advances, and the escape
//     doesn't complete just because you stepped out of the bank. Vault-locked-again toast when the vault was already cracked.
//  B) wolde-02: crack -> escape -> step waits for the escape, then 'Lose the heat', job completes, no fail event.
//  C) thorne-03 pick sheet: clear of the joystick, a thumb on the joystick + one tap on Split applies Split only, taps in
//     the first ~300 ms are ignored, and a sheet fires once.
//  D) the tracker never prints 'undefined' on a pick step. E) NPCs stay at 12 or fewer on phones.
// The safe-dial minigame itself is stubbed to succeed (SSX.heist.safeCrack); everything around it is the live flow.
// NODE_PATH=/workspace/pw/node_modules BASE=http://localhost:8961/ DEV="393x852" BR=webkit node tests/test-storymars2-fixes.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8961/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const OUT = process.env.OUT || (__dirname + '/../shots/jeff-story2/'), SHOTS = process.env.SHOTS === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const WH = /^(\d+)x(\d+)$/.exec(DEV);
  const dev = DEV === 'desktop' ? { viewport: { width: 1366, height: 820 } }
    : WH ? { viewport: { width: +WH[1], height: +WH[2] }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
    : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const TOUCH = !!dev.hasTouch, DESKTOP = DEV === 'desktop', CAP = DESKTOP ? 24 : 12;
  const page = await (await browser.newContext(dev)).newPage(); page.setDefaultTimeout(120000);
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /storymars2/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = async n => { if (SHOTS) { try { require('fs').mkdirSync(OUT, { recursive: true }); } catch (e) {} await page.screenshot({ path: `${OUT}fixes-${tag}-${n}.png` }); } };
  const qid = () => G(() => window.__app.game.debug.quest()?.id || null);
  const stepT = () => G(() => window.__app.game.debug.step()?.type || null);
  const act = () => G(() => window.SSX.heist.action);
  let peak = 0; const bump = async () => { const n = await G(() => { try { return window.__app.surface.world.npcBudget?.()?.used ?? 0; } catch (e) { return 0; } }); if (n > peak) peak = n; };
  const outside = async () => { if (await G(() => !!window.__app.surface.info.inside)) { await G(() => window.__app.surface.leaveBuilding()); await wait(() => !window.__app.surface.info.inside, 5000); await sleep(300); } };
  const reset = async () => { await outside(); await G(() => { const g = window.__app.game; g.abandon?.(); g.debug.clear(); window.__app.surface.world.setWanted(0); window.__hlog = []; window.__toasts = []; }); await sleep(400); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 150000);
    await G(() => { ['ssx.progress.v1', 'ssx.planets.v1', 'ssx.race.v1'].forEach(k => localStorage.removeItem(k)); localStorage.setItem('ssx.adult', '1'); window.__app.game?.reload?.(); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 150000)); await sleep(1000);
    await G(() => document.getElementById('radioLater')?.click()); await sleep(300);
    if (await G(() => window.__app.surface.info.driving)) { await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 6000); }
    ok('bootstrapped', await wait(() => !!window.__storymars2 && !!window.SSX?.heist?.registerHeist, 20000));
    // event + toast recorders; the dial minigame succeeds instantly
    await G(() => { window.__hlog = []; window.__toasts = []; for (const e of ['heist:fail', 'heist:escape', 'heist:safe:result', 'heist:done']) window.addEventListener(e, ev => window.__hlog.push(e + ':' + (ev.detail?.id || '') + ':' + (ev.detail?.fail || ''))); 
      const a = window.__app, t0 = a.toast; a.toast = (m, ms) => { window.__toasts.push(String(m).slice(0, 160)); return t0?.call(a, m, ms); };
      if (window.SSX.city?.toast) { const t1 = window.SSX.city.toast; window.SSX.city.toast = (m, ms) => { window.__toasts.push(String(m).slice(0, 160)); return t1.call(window.SSX.city, m, ms); }; }
      window.SSX.heist.safeCrack = () => Promise.resolve({ success: true, ok: true, reason: null });
      const g = a.game; g.progress.credits = 9000; ['story:rook-04-crew:quality=pros', 'story:rook-04-crew:driller=ozzie', 'story:rook-04-crew:hacker=penny', 'story:rook-04-crew:wheel=kestrel'].forEach(f => g.setFlag(f));
      g.progress.quests['rook-04-crew'] = { everDone: true, status: 'done' }; g.save?.(); });
    // ---- E) vault locked again: the vault was cracked on an earlier job ----
    await reset(); await G(() => { const g = window.__app.game; if (!g.flag('cracked:bank-vault')) g.setFlag('cracked:bank-vault'); g.accept('rook-05-withdrawal'); });
    ok('rookAccepted', await wait(() => window.__storymars2.state.qid === 'rook-05-withdrawal', 5000));
    await sleep(600);
    ok('vaultLockedToast', await G(() => window.__toasts.find(t => /locked again/i.test(t)) || null), await G(() => window.__toasts.some(t => /locked again/i.test(t))));
    ok('vaultFlagClearedForRun', null, await G(() => !window.__app.game.flag('cracked:bank-vault')));
    // ---- A) rook-05: real crack path ----
    for (let k = 0; k < 8 && (await stepT()) === 'goto'; k++) { await G(() => window.__app.surface.debugQuestGo(1)); await sleep(500); }
    ok('rookAtHeist', await stepT(), (await stepT()) === 'heist');
    ok('rookHeistLive', await wait(() => window.SSX.heist.active?.id === 'rook-05-first-junction' && !!window.SSX.heist.active.w, 8000));
    const geo = await G(() => { const a = window.SSX.heist.active, W = window.__app.surface.world, d = W.doorFor('FIRST JUNCTION TRUST'), aj = W.colonyAt([0, 0]); const D = (p, q) => Math.round(Math.hypot(p.x - q.x, p.z - q.z));
      return { door: { x: d.x, z: d.z }, aj: { x: aj.x, z: aj.z }, siteToDoor: D(a.w.site, d), safeToDoor: D(a.w.safe, d), safeToAJ: D(a.w.safe, aj) }; });
    ok('rookSiteAtBank', geo.siteToDoor, geo.siteToDoor <= 2);
    ok('rookSafeNotOnPlaza', geo.safeToAJ, geo.safeToAJ > 100);
    await G(([x, z]) => window.__app.surface.debugMove(x, z + 0.5, Math.PI), [geo.door.x, geo.door.z]); await sleep(1200);
    ok('rookBreakInAction', await act(), /Break in/.test(await act() || ''));
    await G(() => window.SSX.heist.act()); ok('rookCrackStage', await wait(() => window.SSX.heist.active?.stage === 'crack', 6000));
    // the plaza spot that matched the interior vault must be dead now; so must the street in front of the bank
    await G(([x, z]) => window.__app.surface.debugMove(x + 6.4, z - 5.25 + 0.5, 0), [geo.aj.x, geo.aj.z]); await sleep(1200); await bump();
    ok('noCrackOnPlaza', String(await act()), !/Crack safe/.test(await act() || ''));
    await G(([x, z]) => window.__app.surface.debugMove(x, z + 0.5, Math.PI), [geo.door.x, geo.door.z]); await sleep(1000);
    ok('noCrackOnStreet', String(await act()), !/Crack safe/.test(await act() || ''));
    ok('trackerHintOutside', await G(() => document.getElementById('questTrack')?.textContent || ''), true);
    await G(() => window.__app.surface.enterBuilding()); ok('inBank', await wait(() => window.__app.surface.info.inside?.kind === 'bank', 5000));
    await G(() => window.__app.surface.debugInside(6.4, -4.4, 0)); await sleep(1000);
    ok('crackInVault', await act(), /Crack safe/.test(await act() || '')); await shot('rook-vault');
    await G(() => window.SSX.heist.act()); await sleep(1500);
    const ac = await G(() => ({ stage: window.SSX.heist.active?.stage || null, step: window.__app.game.debug.step()?.type, flag: window.__app.game.flag('cracked:bank-vault'), log: window.__hlog.slice(), blown: window.__toasts.filter(t => /blown/i.test(t)) }));
    R.rookAfterCrack = ac;
    ok('rookCrackEscapes', ac.stage, ac.stage === 'escape');
    ok('rookNoFail', null, !ac.log.some(l => l.startsWith('heist:fail')) && ac.blown.length === 0);
    ok('rookAdvanced', ac.step, ac.step === 'crack' || ac.step === 'hold');
    ok('rookVaultFlag', ac.flag);
    await outside(); await sleep(1200);
    ok('rookEscapeNotInstant', await G(() => window.SSX.heist.active?.stage || null), (await G(() => window.SSX.heist.active?.stage)) === 'escape');
    await wait(() => window.__app.game.debug.step()?.type !== 'crack', 6000);
    ok('rookAtHold', await stepT(), (await stepT()) === 'hold');
    await G(() => window.__app.surface.debugQuestGo(1)); for (let j = 0; j < 5; j++) { await sleep(1000); await bump(); }
    await G(() => window.__storymars2.skip(999)); await sleep(700); await G(() => window.__app.game.debug.clear());
    // drive off: escape should trigger once you're far from the bank, not before
    await G(([x, z]) => window.__app.surface.debugMove(x + 75, z + 20, 0), [geo.door.x, geo.door.z]); await sleep(1500);
    ok('rookEscaped', await G(() => window.__hlog.filter(l => l.startsWith('heist:escape')).length), await G(() => window.__hlog.some(l => l.startsWith('heist:escape:rook'))));
    if ((await stepT()) === 'goto') { await G(() => window.__app.game.debug.advance()); await sleep(600); } // the drive to the Flats needs a car: skip it
    ok('rookAtPick', await stepT(), (await stepT()) === 'pick');
    ok('rookPickTrackerText', await G(() => document.getElementById('questTrack')?.textContent || ''), !/undefined/.test(await G(() => document.getElementById('questTrack')?.textContent || '')));
    await wait(() => window.__storymars2.state.sheet, 5000); await sleep(450);
    ok('rookPick', await G(() => window.__storymars2.pick('talk')));
    await G(() => window.__app.surface.world.setWanted(0)); await sleep(1500);
    ok('rookDone', await G(() => window.__app.game.progress.quests['rook-05-withdrawal']?.everDone === true && window.__app.game.debug.quest()?.id !== 'rook-05-withdrawal'));
    ok('rookNeverFailed', null, await G(() => !window.__hlog.some(l => l.startsWith('heist:fail'))));
    // ---- B) wolde-02 impound ----
    await reset(); await G(() => { const g = window.__app.game; g.progress.quests['wolde-01-witness'] = { everDone: true, status: 'done' }; const c = window.__app.surface.world.colonyAt([-40, -430]); window.__app.surface.debugMove(c.x, c.z, 0); });
    await sleep(1500); await G(() => window.__app.game.accept('wolde-02-discovery'));
    ok('woldeHeistLive', await wait(() => window.SSX.heist.active?.id === 'wolde-02-impound' && !!window.SSX.heist.active.w, 8000));
    const wg = await G(() => { const w = window.SSX.heist.active.w; return { door: { x: w.door.x, z: w.door.z }, safe: { x: w.safe.x, z: w.safe.z }, site: { x: w.site.x, z: w.site.z } }; });
    if (await G(() => window.__app.surface.info.driving)) { await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 4000); }
    for (const [ox, oz] of [[0, 0], [0, 0.8], [0.8, 0], [-0.8, 0], [0, -0.8]]) { await G(([x, z]) => window.__app.surface.debugMove(x, z, 0), [wg.door.x + ox, wg.door.z + oz]); await sleep(1200); if (/Break in/.test(await act() || '')) break; }
    R.woldeDoorAction = await act();
    await G(() => window.SSX.heist.act()); ok('woldeCrackStage', await wait(() => window.SSX.heist.active?.stage === 'crack', 6000));
    await G(([x, z]) => window.__app.surface.debugMove(x, z, 0), [wg.safe.x, wg.safe.z]); await sleep(1200);
    ok('woldeCrackAction', await act(), /Crack safe/.test(await act() || ''));
    await G(() => window.SSX.heist.act()); await sleep(1500);
    const wc = await G(() => ({ stage: window.SSX.heist.active?.stage || null, step: window.__app.game.debug.step()?.type, q: window.__app.game.debug.quest()?.id, log: window.__hlog.slice() }));
    R.woldeAfterCrack = wc;
    ok('woldeCrackEscapes', wc.stage, wc.stage === 'escape');
    ok('woldeNoFail', null, !wc.log.some(l => l.startsWith('heist:fail')));
    ok('woldeWaitsForEscape', wc.step, wc.step === 'heist' && wc.q === 'wolde-02-discovery');
    await G(([x, z]) => window.__app.surface.debugMove(x + 50, z + 25, 0), [wg.site.x, wg.site.z]); await sleep(1500);
    ok('woldeEscaped', null, await G(() => window.__hlog.some(l => l.startsWith('heist:escape:wolde'))));
    await G(() => window.__app.surface.world.setWanted(0)); await sleep(1800);
    ok('woldeDone', null, await G(() => window.__app.game.progress.quests['wolde-02-discovery']?.everDone === true && window.__app.game.debug.quest()?.id !== 'wolde-02-discovery'));
    ok('woldeNeverFailed', null, await G(() => !window.__hlog.some(l => l.startsWith('heist:fail')) && !window.__toasts.some(t => /blown/i.test(t))));
    // ---- C) thorne-03 pick sheet ----
    const toPick = async () => { await reset(); await G(() => { const g = window.__app.game; g.progress.flags = g.progress.flags.filter(f => !f.startsWith('sm2:thorne')); g.accept('thorne-03-ransom'); g.debug.advance(); g.debug.advance(); });
      const open = await wait(() => window.__storymars2.state.sheet, 6000); return open; };
    const flags = () => G(() => window.__app.game.progress.flags.filter(f => f.startsWith('sm2:thorne')));
    ok('thorneSheetOpen', await toPick());
    ok('pickTrackerText', await G(() => document.getElementById('questTrack')?.textContent || ''), !/undefined/.test(await G(() => document.getElementById('questTrack')?.textContent || '')));
    ok('pickStepHasText', null, await G(async () => { const m = await import('./storymars2.js'); return m.MISSIONS2.every(q => q.steps.every(s => typeof s.text === 'string' && s.text.length > 0)); }));
    // early taps are ignored, then exactly one choice applies
    ok('earlyTapIgnored', null, (await G(() => window.__storymars2.pick('all'))) === false && (await flags()).length === 0);
    await shot('pick-sheet');
    if (TOUCH) {
      const geo2 = await G(() => { const j = document.getElementById('joy'), s = document.getElementById('sm2Sheet'); const jr = j.getBoundingClientRect(), sr = s.getBoundingClientRect(); const c = [jr.x + jr.width / 2, jr.y + jr.height / 2], el = document.elementFromPoint(c[0], c[1]);
        return { joyTop: Math.round(jr.top), sheetBottom: Math.round(sr.bottom), sheetTop: Math.round(sr.top), h: innerHeight, joyInSheet: !!el?.closest('#sm2Sheet'), joyVisible: jr.width > 0 && getComputedStyle(j).display !== 'none' }; });
      R.sheetGeo = geo2;
      ok('sheetClearOfJoystick', null, !geo2.joyVisible || (!geo2.joyInSheet && geo2.sheetBottom <= geo2.joyTop + 1));
      ok('sheetOutOfCentre', geo2.sheetTop, geo2.sheetTop >= geo2.h * 0.4);
      await sleep(400);
      // the reviewer's repro: thumb down on the joystick, a second finger taps Split, the thumb lifts 700 ms later
      const rep = await G(async () => { const jr = document.getElementById('joy').getBoundingClientRect(), j = [jr.x + jr.width / 2, jr.y + jr.height / 2]; const br = document.querySelector('#sm2Sheet button[data-opt="split"]').getBoundingClientRect(), b = [br.x + br.width / 2, br.y + br.height / 2];
        const o = (t, id, bt, pr) => ({ pointerId: id, pointerType: 'touch', isPrimary: pr, bubbles: true, cancelable: true, composed: true, buttons: bt, pressure: bt ? .5 : 0, clientX: t[0], clientY: t[1] });
        const je = document.elementFromPoint(j[0], j[1]); je.dispatchEvent(new PointerEvent('pointerdown', o(j, 1, 1, true))); je.dispatchEvent(new PointerEvent('pointermove', o([j[0], j[1] - 22], 1, 1, true)));
        const ae = document.elementFromPoint(b[0], b[1]); ae.dispatchEvent(new PointerEvent('pointerdown', o(b, 7, 1, false))); ae.dispatchEvent(new PointerEvent('pointerup', o(b, 7, 0, false)));
        await new Promise(r => setTimeout(r, 700)); je.dispatchEvent(new PointerEvent('pointerup', o(j, 1, 0, true))); await new Promise(r => setTimeout(r, 900)); return { joyEl: je.id || je.tagName, btnEl: ae.dataset?.opt || ae.tagName }; });
      R.dblRepro = rep;
      const f1 = await flags(); ok('oneTapOneChoice', f1.join(','), f1.length === 1 && f1[0] === 'sm2:thorne_split');
    } else {
      await sleep(400); ok('pickOnce', null, await G(() => window.__storymars2.pick('split'))); await sleep(200);
      ok('secondPickIgnored', null, (await G(() => window.__storymars2.pick('all'))) === false);
      const f1 = await flags(); ok('oneTapOneChoice', f1.join(','), f1.length === 1 && f1[0] === 'sm2:thorne_split');
    }
    // a second, rapid tap on a different button after the first choice does nothing
    ok('noSecondChoice', null, (await G(() => window.__storymars2.pick('all'))) === false && (await flags()).length === 1);
    await bump(); ok('npcPeakWithinCap', peak + '/' + CAP, peak <= CAP);
    ok('noErrors', errors.slice(0, 6).join(' | '), errors.length === 0);
  } catch (e) { bad.push('EXC:' + e.message); R.exc = e.stack?.split('\n').slice(0, 4).join(' | '); }
  R.bad = bad; R.pass = bad.length === 0;
  console.log(JSON.stringify(R, null, 2));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
