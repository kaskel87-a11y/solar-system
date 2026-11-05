// Control's Mars job offers (mars/control.js, v7.6): offer ~first s after landing when idle, one at a time, Later snoozes,
// no cap, Accept starts the job (taxi shift, Door Shift), stops while busy (job, wanted, Rust Pit duel, race) and comes back
// ~after s once you're idle again. Timers shortened with SSX.control.debug.setTimes. 0 console errors.
// BASE=http://127.0.0.1:8931/ BR=webkit|chromium DEV="iPhone 14"|desktop SHOTS_DIR=... node tests/test-control.js
const { webkit, chromium, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8931/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const OUT = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/control/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await (BR === 'chromium' ? chromium : webkit).launch();
  const ctxOpts = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...devices[DEV], viewport: { width: 393, height: 852 } };
  const ctx = await b.newContext(ctxOpts); const page = await ctx.newPage(); const mobile = DEV !== 'desktop';
  const R = {}, bad = [], errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (f, ms = 8000, a) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(f, a).catch(() => false)) return true; await sleep(150); } return false; };
  const ok = (k, v, want = true) => { R[k] = v; if (v !== want) bad.push(k); };
  const tag = `${BR}-${DEV.replace(/\W+/g, '').toLowerCase()}`;
  const st = () => G(() => window.SSX.control.state());
  const offerUp = () => G(() => { const r = document.getElementById('radio'); return getComputedStyle(r).display !== 'none' && r.classList.contains('mctl'); });
  const MINE = `(() => { const r = document.getElementById('radio'); return r.classList.contains('mctl') && getComputedStyle(r).display !== 'none' && /got a job if you\u2019re bored/.test(document.getElementById('radioText').textContent); })()`;
  const SLOW = DEV === 'desktop' ? 3 : 1; // software-GL desktop chromium runs the page slowly on the shared box
  const waitMine = ms => wait(MINE, ms * SLOW);
  const KEYS = { '#radioLater': 'Backspace', '#radioAccept': 'Enter' };
  // Desktop answers the radio with its keyboard shortcuts (Enter / Backspace), which click the real buttons; touch taps them.
  const tap = async sel => { if (mobile) await page.tap(sel); else if (KEYS[sel]) await page.keyboard.press(KEYS[sel]); else await page.click(sel); };
  const openCard = async () => { if (await G(() => document.getElementById('radio').classList.contains('mini'))) { await tap('#radio .from'); await sleep(250); } };
  // a toast or discovery pop can fold the card back to the mini pill right after it opens (index.html shrinkRadio): reopen and retry
  const acceptCard = async () => { for (let i = 0; i < 4; i++) { await openCard(); if (!mobile) return tap('#radioAccept'); try { await page.tap('#radioAccept', { timeout: 2500 }); return; } catch (e) { if (i === 3) throw e; } await sleep(250); } };
  const quiet = async ms => { const o0 = (await st()).offers; await sleep(ms); return (await st()).offers === o0 && !(await offerUp()); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    R.version = await G(() => window.__app.version);
    ok('api', await wait(() => !!window.SSX?.control, 20000));
    await G(() => window.SSX.control.on(e => { if (e.type === 'later') window.__mlater = e.next; }));
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } window.SSX.control.debug.reset(); window.SSX.control.debug.setTimes({ first: 3, after: 3, every: [4, 5], later: 4, wayp: 6 }); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000));
    // the core's own one-shot landing offer (game.js offerNext, 4.5 s) is a different radio: let it pass, then restart our clock
    await sleep(5500);
    // a fresh player: drop any resumed quest, close the landing radio, no stars
    await G(() => { const g = window.__app.surface.game; try { g.abandon?.(true); } catch (e) { } try { window.SSX.jobs?.stop?.(); } catch (e) { } try { window.__app.surface.world.setWanted?.(0, 'test'); } catch (e) { } try { window.SSX.onboard?.skip?.(); } catch (e) { } });
    const REAL = process.env.REAL === '1';
    await sleep(300); await G(real => { document.getElementById('radio').style.display = 'none'; window.SSX.control.debug.reset(); if (!real) window.SSX.control.debug.setTimes({ first: 3, after: 3, every: [4, 5], later: 4, wayp: 6 }); }, REAL);
    const t0 = Date.now();
    if (REAL) { // real game timing: first offer ~20 s after landing, Later snoozes ~45 s
      ok('realFirst', await waitMine(40000)); R.realFirstS = Math.round((Date.now() - t0) / 100) / 10; ok('realFirstAbout20', R.realFirstS >= 18 && R.realFirstS <= 24);
      await openCard(); await tap('#radioLater'); await sleep(300); R.realLaterNext = await G(() => window.__mlater); ok('realLater45', R.realLaterNext === 45);
      ok('consoleErrors', errs.length ? errs.join(' | ') : 'none', 'none'); throw 'done';
    }
    R.busyAtLanding = await G(() => window.SSX.control.busy());
    R.candidates = (await G(() => window.SSX.control.candidates())).map(c => c.key);
    ok('hasJobs', R.candidates.length >= 3);
    ok('hasTaxi', R.candidates.includes('taxi'));
    // 1) first offer ~3 s after landing (debug timing; 20 s in the game)
    ok('firstOffer', await waitMine(15000));
    R.firstAfterS = Math.round((Date.now() - t0) / 100) / 10;
    ok('firstOnTime', R.firstAfterS >= 2 && R.firstAfterS <= 9 * SLOW);
    R.text1 = await G(() => document.getElementById('radioText').textContent);
    await openCard();
    const btn = await G(() => ['radioAccept', 'radioLater'].map(id => { const e = document.getElementById(id), c = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: c.backgroundColor, fg: c.color, h: Math.round(r.height), w: Math.round(r.width), img: c.backgroundImage }; }));
    R.buttons = btn;
    ok('blackWhiteButtons', btn.every(x => x.bg === 'rgb(0, 0, 0)' && x.fg === 'rgb(255, 255, 255)' && x.img === 'none'));
    ok('targets44', btn.every(x => x.h >= 44 && x.w >= 44));
    await page.screenshot({ path: `${OUT}control-offer-${tag}.png` });
    // 2) one at a time: nothing new while it's up
    // never stacked: while it's up no second offer is sent (a slow software-GL desktop can let the radio's own 40 s
    // timeout close it inside this window; then exactly one new offer may follow, never two at once)
    { const a = await st(); await sleep(6500); const z = await st();
      ok('oneAtATime', z.offers - a.offers <= z.expired - a.expired && (await G(() => document.querySelectorAll('#radio').length)) === 1); R.oneAtATimeDetail = { offers: z.offers - a.offers, expired: z.expired - a.expired }; }
    if (!(await G(MINE))) await waitMine(60000);
    await openCard();
    await tap('#radioLater');
    ok('laterHides', await wait(() => getComputedStyle(document.getElementById('radio')).display === 'none', 3000));
    R.laterNext = await G(() => window.__mlater); ok('laterSnooze', R.laterNext === 4); // the snooze set at the tap (45 s in the game)
    let back = 0; for (let k = 0; k < 5; k++) { if (await waitMine(12000)) { back++; await openCard(); await tap('#radioLater'); await sleep(200); } }
    ok('noCapFiveLaters', back === 5); R.offersSoFar = (await st()).offers;
    // 4) Accept a taxi offer -> the shift starts -> busy -> no offers
    await waitMine(12000);
    await G(() => window.SSX.control.later()); await sleep(200);
    ok('offerTaxi', (await G(() => window.SSX.control.offerNow('taxi'))).ok);
    await acceptCard();
    ok('taxiStarted', await wait(() => window.SSX.jobs?.active?.()?.type === 'taxi', 4000));
    ok('busyJob', await G(() => window.SSX.control.busy()) === 'job');
    await sleep(800); await page.screenshot({ path: `${OUT}control-taxi-${tag}.png` });
    ok('quietWhileJob', await quiet(7000));
    // 5) job ends -> next offer ~3 s later
    await G(() => window.SSX.jobs.stop('test')); const tEnd = Date.now();
    ok('afterJobOffer', await waitMine(12000));
    R.afterJobS = Math.round((Date.now() - tEnd) / 100) / 10; ok('afterJobOnTime', R.afterJobS >= 2 && R.afterJobS <= 9 * SLOW);
    // 6) Door Shift (side activity) through Accept
    await G(() => window.SSX.control.later()); await sleep(200);
    const ds = await G(() => window.SSX.control.offerNow('act-static-bounce')); R.doorShiftOffer = ds.ok;
    if (ds.ok) { await acceptCard(); ok('doorShiftStarted', await wait(() => window.__activities?.active?.id === 'act-static-bounce', 4000)); ok('busyActivity', /activity|quest/.test(await G(() => window.SSX.control.busy()) || '')); await G(() => window.__activities.abandon()); await sleep(300); }
    // 7) wanted, Rust Pit duel, race: no offers while busy
    // keep the player standing through the wanted window: cops near the spawn can down you in 6 s and then busy() is down/custody, not pit
    await G(() => { window.__ctlHeal = setInterval(() => { try { window.__app.game.restore(); } catch (e) { } }, 150); window.SSX.control.later(); window.__app.surface.world.setWanted(2, 'test'); }); await sleep(300);
    ok('busyWanted', await G(() => window.SSX.control.busy()) === 'wanted'); ok('quietWhileWanted', await quiet(6000));
    await G(() => { window.__app.surface.world.setWanted(0, 'test'); clearInterval(window.__ctlHeal); });
    R.custodyAfterWanted = await G(() => { const c = window.SSX.consequences?.status?.(); const was = !!(c && (c.custody || c.jail || c.pending)); if (was) window.SSX.consequences.debug.reset(); return was; }); // a bust in that window is the cops, not Control
    const home = await G(() => { const i = window.__app.surface.info; return { x: i.x, z: i.z }; });
    await G(() => window.SSX.fight.debug.goto()); await sleep(400);
    ok('busyPit', await G(() => window.SSX.control.busy()) === 'pit'); ok('quietInPit', await quiet(6000));
    await G(h => window.__app.surface.debugMove(h.x, h.z, 0), home); await sleep(400);
    const rs = await G(() => { try { const t = window.__race.tracks()[0]; if (!t) return 'no track'; const r = window.__race.start(t.id); return r?.ok === false ? r.why : (window.__race.state ? 'ok' : 'no state'); } catch (e) { return String(e); } });
    R.raceStart = rs;
    await G(() => window.SSX.control.later());
    if (rs === 'ok') { ok('busyRace', await G(() => window.SSX.control.busy()) === 'race'); ok('quietInRace', await quiet(6000)); await G(() => window.__race.quit()); }
    // 8) idle again: offers resume
    ok('resumes', await waitMine(15000));
    R.final = await st(); delete R.final.bag;
    ok('consoleErrors', errs.length ? errs.join(' | ') : 'none', 'none');
  } catch (e) { if (e !== 'done') bad.push('exception: ' + String(e).slice(0, 1500)); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL' : 'PASS'); await b.close(); process.exit(bad.length ? 1 : 0);
})();
