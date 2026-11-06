// v7.5.76 📜 Contacts crew mission chains (mars/crewfic.js). WebKit 393x852: Dex is locked until hired (lock reason shown),
// hire him, open his card (objectives + reward lines up front), "Not now" changes nothing, Accept -> the objective strip below
// the minimap with distance + compass; drive the whole Dex chain (go / hold / act / heat / pay / drive) through the real beam
// + context button; every beat pays exactly its shown reward once (double taps, extra settles, a reload mid-chain and
// re-opening the card can't re-pay); the strip hides while a 💼 job runs; the chain can't be replayed; Dex's perk boosts a
// real crew collect by 10%; the save survives a reload. Black buttons, white text, 44px+. No page errors.
// BASE=http://127.0.0.1:8947/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/crewfic/ node tests/test-crewfic.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8947/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/crewfic/', desk = DEV === 'desktop';
const noAudio = (process.env.NOAUDIO || (BR === 'webkit' ? '1' : '0')) === '1'; // headless WebKit has no audio device
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  if (noAudio) await page.addInitScript(() => { try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (e) { /* */ } });
  const errors = []; page.on('pageerror', e => errors.push('PE ' + (R.stage || '') + ' ' + e.message.slice(0, 300)));
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = async n => { const p = `${out}crewfic-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots ||= []).push(p); };
  const tap = (sel, twice) => G(async ([sel, twice]) => { const b = typeof sel === 'string' ? document.querySelector(sel) : null; if (!b) return false;
    const r = b.getBoundingClientRect(), o = { pointerId: 61, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    for (let k = 0; k < (twice ? 2 : 1); k++) { b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 40)); b.dispatchEvent(new PointerEvent('pointerup', o)); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 30)); } return true; }, [sel, !!twice]);
  const tapBtn = (a, extra = '') => tap(`#cfPanel button[data-a="${a}"]${extra}`);
  const money = () => G(() => ({ cr: window.__app.surface.game.progress.credits, xp: window.__app.surface.game.progress.xp }));
  const cur = () => G(() => window.SSX.crewfic.current());
  const SAVE = { v: 1, xp: 12000, credits: 20000, badges: ['first'], quests: {}, equip: { paint: 'steel' }, unlocks: [], inv: { medkits: 1 }, flags: [] };
  const land = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await wait(() => !!window.SSX?.crewfic && !!window.SSX?.crew, 30000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    const l = await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(800);
    await G(() => { document.getElementById('radioLater')?.click(); window.SSX.onboard?.skip?.(); const g = window.__app.surface.game; g.setAliens?.(false); g.debug?.calm?.(true); }); await sleep(300); return l;
  };
  const calm = () => G(() => { const w = window.__app.surface.world; w.setWanted?.(0, 'debug'); const H = window.__app.game.debug?.H?.(); if (H) { H.hp = H.max; H.shield = H.smax; } });
  const enterRover = async () => {
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await wait(() => /Drive/.test(document.getElementById('driveBtn')?.textContent || ''), 8000);
    await G(() => window.__app.surface.interact()); return wait(() => window.__app.surface.info.driving, 6000);
  };
  // play the current objective through the real world: beam, ring, strip, context button
  const play = async (label) => {
    const c = await cur(); if (!c?.obj) return false; const o = c.obj, key = `${c.id}:${c.beat}:${c.i}`;
    if (o.drive && !(await G(() => window.__app.surface.info.driving))) await enterRover();
    if (o.at) { await G(() => window.SSX.crewfic.debug.goto()); await sleep(400); }
    if (o.t === 'hold') { await sleep(600); await G(s => window.SSX.crewfic.debug.hold(s), o.sec - 1.2); }
    if (o.t === 'clean') { await wait(() => window.__app.surface.world.wanted > 0, 6000); R.heatSeen = (R.heatSeen || 0) + 1; await sleep(500); await calm(); }
    if (o.t === 'act' || o.t === 'pay') { await wait(() => document.getElementById('cfAct')?.classList.contains('show'), 8000); await tap('#cfAct', true); }
    const moved = await wait(k => { const c = window.SSX.crewfic.current(); return !c || `${c.id}:${c.beat}:${c.i}` !== k; }, 15000, key);
    (R.played ||= []).push(`${label || ''}${o.t}${moved ? '' : '!'}`); return moved;
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3, 240000);
    await G(s => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"done":true,"skipped":true}'); localStorage.setItem('ssx.progress.v1', JSON.stringify(s)); }, SAVE);
    await page.goto(base + '?t=' + Date.now()); ok('landed', await land());
    ok('menuRow', await wait(() => !!document.getElementById('rmContacts') && /Contacts/.test(document.getElementById('rmContacts').textContent), 10000));
    await G(() => window.__app.toggleMenu?.()); await sleep(400); await tap('#rmContacts');
    ok('panel', await wait(() => window.SSX.crewfic.isOpen, 5000));
    R.locked = await G(() => document.getElementById('cfBody').textContent);
    ok('lockedAll', /Locked/.test(R.locked) && /Hire Dex first/.test(R.locked) && /10,000 lifetime ⭐/.test(R.locked) && !/Slick|Skiv|Benny/.test(R.locked), R.locked.slice(0, 120));
    ok('rewardsListed', /\+600 cr · \+60⭐/.test(R.locked) && /Dex crew payoff \+10% \(permanent\)/.test(R.locked) && /Cut him loose: \+3,000 cr/.test(R.locked) && !/\?\?\?/.test(R.locked));
    await tapBtn('view', '[data-id="dex"]'); await sleep(300);
    ok('lockedNoAccept', await G(() => !document.querySelector('#cfPanel button[data-a="accept"]') && !window.SSX.crewfic.accept('dex').ok));
    await tap('#cfClose'); await sleep(200);
    // hire Dex (12k lifetime ⭐ >= the 10k gate)
    ok('hired', await G(() => window.SSX.crew.hire().ok && window.SSX.crewfic.hired().includes('dex')));
    await G(() => { window.SSX.crewfic.close(); window.SSX.crewfic.open(); }); await sleep(400);
    R.list = await G(() => [...document.querySelectorAll('#cfPanel .ch')].map(e => e.querySelector('.st').textContent));
    ok('statuses', R.list, R.list[0] === 'Ready' && R.list.slice(1).every(s => /Locked/.test(s)));
    R.btn = await G(() => [...document.querySelectorAll('#cfPanel button')].map(b => { const s = getComputedStyle(b), r = b.getBoundingClientRect(); return { bg: s.backgroundColor, fg: s.color, h: Math.round(r.height) }; }));
    ok('blackButtons', R.btn.length >= 4 && R.btn.every(b => b.bg === 'rgb(0, 0, 0)' && b.fg === 'rgb(255, 255, 255)' && b.h >= 44), R.btn.slice(0, 2));
    await shot('contacts');
    await tapBtn('view', '[data-id="dex"]'); await sleep(300);
    R.card = await G(() => ({ items: document.querySelectorAll('#cfPanel li').length, txt: document.getElementById('cfBody').textContent }));
    ok('cardChecklist', R.card.items === 11 && /Meet Dex by the Red Dust Wash/.test(R.card.txt) && /\+2,500 cr · \+250⭐ · Dex crew payoff/.test(R.card.txt), R.card.items);
    await tapBtn('decline'); await sleep(300);
    ok('declineKeeps', await G(() => { const s = window.SSX.crewfic.state(); return s.active === null && s.c.dex.beat === 0 && /Nothing was lost/.test(document.getElementById('cfNote').textContent); }));
    await tapBtn('view', '[data-id="dex"]'); await sleep(300); await tapBtn('accept'); await sleep(400);
    ok('accepted', await G(() => window.SSX.crewfic.state().active === 'dex' && !window.SSX.crewfic.isOpen));
    ok('strip', await wait(() => { const h = document.getElementById('cfHud'); return h?.classList.contains('show') && /DEX/.test(h.textContent) && / m (N|NE|E|SE|S|SW|W|NW)$/.test(h.querySelector('.l2').textContent); }, 8000));
    R.strip = await G(() => { const h = document.getElementById('cfHud'), r = h.getBoundingClientRect(), mm = document.getElementById('minimap')?.getBoundingClientRect(); return { txt: h.textContent, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), mmBottom: mm ? Math.round(mm.bottom) : null }; });
    ok('stripPlace', R.strip, R.strip.w <= 393 && R.strip.h >= 44 && (R.strip.mmBottom == null || R.strip.top >= R.strip.mmBottom - 2));
    // a 💼 job owns the HUD slot: the strip hides, then comes back
    await G(() => window.SSX.jobs?.start?.('taxi')); await sleep(600);
    ok('hidesForJob', await G(() => !window.SSX.jobs?.active?.() || !document.getElementById('cfHud').classList.contains('show')));
    await G(() => window.SSX.jobs?.stop?.()); await sleep(600);
    ok('backAfterJob', await wait(() => document.getElementById('cfHud').classList.contains('show'), 5000));
    // beat 1
    let m0 = await money();
    await play('1'); await play('1');
    await G(() => window.SSX.crewfic.debug.goto()); await sleep(1500);
    ok('holdShows', await wait(() => /Hold the corner/.test(document.getElementById('cfHud').textContent), 5000));
    await shot('hud');
    await play('1');
    const pre = await money(); await play('1'); await sleep(500);
    for (let k = 0; k < 3; k++) await G(() => { window.SSX.crewfic.debug.settle(); window.SSX.crewfic.act(); }); await sleep(400);
    let m1 = await money(); R.beat1 = { cr: m1.cr - pre.cr, xp: m1.xp - pre.xp };
    ok('beat1Paid', R.beat1, R.beat1.cr === 600 && R.beat1.xp === 60);
    ok('beat2Armed', await G(() => { const s = window.SSX.crewfic.state(); return s.c.dex.beat === 1 && s.claimed.join() === 'dex:1' && s.paid.cr === 600; }));
    await play('2');
    // reload mid-beat: checklist kept, nothing re-paid
    const beforeReload = await money();
    R.stage = 'reload1'; await page.goto(base + '?t=' + Date.now()); R.stage = 'after1'; ok('relanded', await land());
    R.reload = await G(() => { const s = window.SSX.crewfic.state(), g = window.__app.surface.game.progress; return { active: s.active, beat: s.c.dex.beat, flags: s.c.dex.flags, cr: g.credits, xp: g.xp }; });
    ok('reloadKept', R.reload, R.reload.active === 'dex' && R.reload.beat === 1 && R.reload.flags.join() === 'true,false,false' && R.reload.cr === beforeReload.cr && R.reload.xp === beforeReload.xp);
    await play('2'); const pre2 = await money(); await play('2'); await sleep(500); const m2 = await money();
    R.beat2 = { cr: m2.cr - pre2.cr, xp: m2.xp - pre2.xp, heat: R.heatSeen };
    ok('beat2Paid', R.beat2, R.beat2.cr === 1200 && R.beat2.xp === 120 && R.heatSeen >= 1);
    // beat 3: fixer fee, the setback drive, the lease
    await play('3'); const preFee = await money(); await play('3'); const postFee = await money();
    ok('feePaid', { fee: preFee.cr - postFee.cr }, preFee.cr - postFee.cr === 1000);
    await play('3'); ok('drove', await G(() => window.__app.surface.info.driving));
    await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 6000);
    const pre3 = await money(); await play('3'); await sleep(600); const m3 = await money();
    R.beat3 = { cr: m3.cr - pre3.cr, xp: m3.xp - pre3.xp };
    ok('beat3Paid', R.beat3, R.beat3.cr === 2500 && R.beat3.xp === 250);
    ok('done', await G(() => { const s = window.SSX.crewfic.state(); return s.c.dex.beat === 3 && s.active === null && s.paid.cr === 4300 && s.paid.stars === 430 && window.SSX.crewfic.perks().payoff === 0.1; }));
    ok('noReplay', await G(() => !window.SSX.crewfic.accept('dex').ok && !document.getElementById('cfHud').classList.contains('show')));
    ok('rankUp', await G(x => window.__app.surface.game.progress.xp >= x + 430 && window.SSX.stars.lifetime() >= x + 430, SAVE.xp));
    await G(() => window.SSX.crewfic.open('dex')); await sleep(500);
    R.doneCard = await G(() => ({ txt: document.getElementById('cfBody').textContent, struck: document.querySelectorAll('#cfPanel li.dn').length, accept: !!document.querySelector('#cfPanel button[data-a="accept"]') }));
    ok('doneCard', R.doneCard.struck === 11 && /Done/.test(R.doneCard.txt) && /Unlocked: Dex crew payoff \+10% \(permanent\)/.test(R.doneCard.txt) && !R.doneCard.accept, R.doneCard.struck);
    await shot('done');
    const mClose = await money(); await G(() => window.SSX.crewfic.close()); await sleep(200);
    // Dex's perk on a real crew job: no front, hustle 150 cr x1.1 = 165
    await G(() => { const C = window.SSX.crew; C.assign('dex', 'hustle'); C.debug.rng(() => 0.9); C.debug.clock(() => Date.now() + 11 * 60000); C.pump(); });
    const preJob = await money(); R.collect = await G(() => window.SSX.crew.collect('dex')); const postJob = await money();
    ok('dexPerkCollect', { got: postJob.cr - preJob.cr, r: R.collect }, postJob.cr - preJob.cr === 165 && mClose.cr === preJob.cr);
    // reload: done + claimed survive, no extra pay
    const m4 = await money(); R.stage = 'reload2'; await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !!window.SSX?.crewfic, 240000); await sleep(1500);
    R.final = await G(() => ({ s: window.SSX.crewfic.state(), cr: window.__app.surface.game?.progress?.credits ?? JSON.parse(localStorage.getItem('ssx.progress.v1')).credits, raw: !!localStorage.getItem('ssx.crewfic.v1') }));
    ok('savedDone', R.final.raw && R.final.s.c.dex.beat === 3 && R.final.s.claimed.length === 3 && R.final.cr === m4.cr, { cr: R.final.cr, m4: m4.cr });
    R.played = R.played.join(' ');
    ok('allPlayed', !/!/.test(R.played), R.played);
  } catch (e) { bad.push('threw: ' + e.message.slice(0, 200)); }
  ok('noErrors', errors.length ? errors : true, !errors.length);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS'); await browser.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
