// v7.4 street danger smoke test: knife mugging end to end (approach -> standoff chip + Pay/Fight/Run/Talk context
// buttons -> pay / fight-and-kill / run / talk / timeout outcomes, loot, heat), an ambient street fight, and an MCPD
// pursuit (crime at the wheel -> interceptors chase and ram, spike strip, lose them by breaking sight). HUD: centre stays clear.
// BASE=http://localhost:8793/ DEV=393x852 BR=webkit NODE_PATH=/workspace/pw/node_modules node tests/test-danger.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8793/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || '/workspace/danger-shots/', PFX = process.env.PFX || 'danger';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ').replace(/https?:\/\/[^/]+\//g, ''))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const vis = sel => G(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
  const center = sel => G(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapAt = async sel => { const c = await center(sel); if (touch) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); };
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800); };
  const D = () => G(() => window.__danger.state);
  // nothing of ours may cover the middle 40% x 30% of the screen
  const centreClear = () => G(() => { const W = innerWidth, Hh = innerHeight, c = { l: W * 0.3, r: W * 0.7, t: Hh * 0.35, b: Hh * 0.65 };
    return ['#dangerChip', '#dangerChoices button'].every(sel => [...document.querySelectorAll(sel)].every(e => { const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).display === 'none') return true; return r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b; })); });
  // stand in the rough ring around Ares Junction, facing out
  const rough = async (k = 0) => G(k => { const s = window.__app.surface, c = s.world.colony, a = 0.6 + k * 0.4; s.debugPlace(c.x + Math.cos(a) * 115, c.z + Math.sin(a) * 115, 0); }, k);
  const standoff = async () => { const okk = await wait(() => window.__danger.state.mug?.phase === 'standoff', 30000); return okk; };
  const newMug = async (k) => { await G(() => { window.__danger.clear(); window.__danger.skipGrace(); }); await rough(k); await sleep(300); await G(() => window.__danger.force('mugging', { dist: 9 })); return standoff(); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.removeItem('ssx.progress.v1'); localStorage.removeItem('ssx.danger.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); }); await land();
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.debug.credits(500); });
    ok('dangerLoaded', null, await wait(() => !!window.__danger?.state?.ui, 8000));
    ok('menuItem', await G(() => document.getElementById('rmDanger')?.textContent), await G(() => /Street danger: on/.test(document.getElementById('rmDanger')?.textContent || '')));
    ok('noPermanentButtons', null, !(await vis('#dangerChip')) && !(await vis('#dzPay')));
    await rough(); await sleep(400);
    await wait(() => window.__danger.state.district === 'rough', 8000);
    ok('districtRough', (await D()).district, (await D()).district === 'rough');
    // ---------- 1. pay ----------
    ok('standoff', null, await newMug(0));
    let st = await D(); R.demand = st.mug.demand; R.line = st.mug.line;
    ok('demandLine', st.mug.line, /\d+/.test(st.mug.line || ''));
    ok('chip', null, await wait(() => window.__danger.state.ui?.chip, 3000) && await vis('#dangerChip')); ok('choices', null, await vis('#dzPay') && await vis('#dzFight') && await vis('#dzRun') && await vis('#dzTalk'));
    ok('ctxButtonsSwapped', null, !(await vis('#driveBtn')) && !(await vis('#petBtn')));
    ok('centreClear', null, await centreClear());
    await G(() => window.__danger.muggerFront(2.4, 0.35)); await sleep(500); await shot('mugging');
    ok('sprintHiddenInStandoff', null, !(await vis('#runBtn')));
    const c0 = await G(() => window.__app.surface.game.progress.credits);
    if (touch) await tapAt('#dzPay'); else { await page.keyboard.press('Digit1'); }
    await sleep(300); st = await D();
    const c1 = await G(() => window.__app.surface.game.progress.credits);
    ok('paid', `${c0}->${c1} demand ${R.demand} ${st.stats.lastOutcome?.result}`, c0 - c1 === R.demand && st.stats.lastOutcome?.result === 'paid');
    ok('choicesGone', null, !(await vis('#dzPay')) && !(await vis('#dangerChip')));
    ok('noHeatPaying', null, (await G(() => window.__app.surface.world.wanted)) === 0);
    // ---------- 2. fight: shoot him through the patched world.hitWorld ----------
    ok('standoff2', null, await newMug(1));
    await tapAt('#dzFight'); await sleep(200);
    ok('fightPhase', (await D()).mug?.phase, (await D()).mug?.phase === 'fight');
    ok('autoAimSeesHim', null, await G(() => window.__app.surface.world.targets().some(t => t.kind === 'npc')));
    const c2 = await G(() => window.__app.surface.game.progress.credits);
    R.fightTrace = [];
    for (let i = 0; i < 30; i++) { const info = await G(() => { const s = window.__app.surface, n = window.__danger.npcs().find(n => n.role === 'mugger'); const p = s.info; if (n && n.alive) s.world.hitWorld({ x: p.x, y: n.y + 1.3, z: p.z }, { x: n.x, y: n.y + 1.2, z: n.z }, { dmg: 1.1 }); return { hp: n ? +n.hp.toFixed(1) : null, alive: !!n?.alive, d: n ? +Math.hypot(n.x - p.x, n.z - p.z).toFixed(1) : null, ph: window.__danger.state.mug?.phase }; }); R.fightTrace.push(info); if (!info.alive) break; await sleep(150); }
    await sleep(300);
    st = await D();
    ok('muggerKilled', JSON.stringify(st.stats.lastEnd), st.stats.lastEnd === 'killed' || st.stats.lastEnd === 'killed-heat');
    ok('loot', null, (await G(() => window.__app.surface.game.progress.credits)) > c2);
    ok('selfDefenseNoStars', await G(() => window.__app.surface.world.wanted), (await G(() => window.__app.surface.world.wanted)) === 0);
    ok('blood', st.splats, st.splats > 0);
    // ---------- 3. run ----------
    ok('standoff3', null, await newMug(2));
    await tapAt('#dzRun'); await sleep(150);
    ok('chasePhase', (await D()).mug?.phase, (await D()).mug?.phase === 'chase');
    await G(() => { const s = window.__app.surface, i = s.info; s.debugPlace(i.x + 40, i.z + 40, 0); }); await sleep(1200);
    st = await D(); ok('escaped', st.mug?.phase + ' ' + JSON.stringify(st.stats.outcomes), !st.mug || st.mug.phase === 'fleeing');
    // ---------- 4. talk ----------
    ok('standoff4', null, await newMug(3));
    await tapAt('#dzTalk'); await sleep(200); st = await D();
    ok('talkOutcome', st.stats.lastOutcome?.result, ['talked', 'tip', 'fight'].includes(st.stats.lastOutcome?.result));
    // ---------- 5. timeout: do nothing, he cuts you ----------
    ok('standoff5', null, await newMug(4));
    const h0 = await G(() => { const H = window.__app.surface.game.debug.H(); return { hp: H.hp + H.shield, hit: H.lastHit, inv: H.inv }; });
    await sleep(300); await G(() => window.__danger.mugFastForward(1));
    const gotStabbed = await wait(() => window.__danger.state.stats.lastOutcome?.result === 'stabbed', 60000); R.timeoutOutcome = (await D()).stats.lastOutcome?.result;
    const h1 = await G(() => { const H = window.__app.surface.game.debug.H(); return { hp: H.hp + H.shield, hit: H.lastHit, inv: H.inv }; });
    ok('stabbedOnTimeout', `${JSON.stringify(h0)}->${JSON.stringify(h1)}`, gotStabbed && (h1.hit !== h0.hit || h1.hp < h0.hp));
    // ---------- 6. ambient street fight ----------
    await G(() => { window.__danger.clear(); window.__danger.skipGrace(); }); await rough(5); await sleep(200);
    await G(() => window.__danger.force('fight', { dist: 14 }));
    ok('fightSpawned', null, (await D()).fights.length === 1);
    ok('fightResolves', null, await wait(() => window.__danger.state.fights[0]?.over, 40000));
    await sleep(500); await shot('streetfight');
    ok('fightBlood', (await D()).splats, (await D()).splats > 0);
    // ---------- 7. street chase (Saltblood car, NOT police) ----------
    await G(() => { window.__danger.clear(); window.__danger.setEnabled(true); window.__app.surface.game.debug.H && (window.__app.surface.game.debug.H().hp = 100); }); await rough(6); await sleep(200);
    await G(() => window.__app.surface.warpToRover()); await sleep(300);
    await G(() => window.__app.surface.interact()); await wait(() => window.__app.surface.info.driving, 5000);
    ok('driving', null, await G(() => window.__app.surface.info.driving));
    const w0 = await G(() => window.__app.surface.world.wanted);
    ok('gangChaseStarts', JSON.stringify(await G(() => window.__danger.budget())), await G(() => window.__danger.force('gangChase', { kind: 'gang' })));
    ok('gangUnits', null, await wait(() => window.__danger.pursuit.state?.active && window.__danger.pursuit.state.units >= 1 && window.__danger.pursuit.state.kind === 'gang', 4000));
    ok('noStarsFromGang', await G(() => window.__app.surface.world.wanted), (await G(() => window.__app.surface.world.wanted)) === w0);
    ok('noPoliceUnitsOfOurs', null, await G(() => window.__danger.pursuit.units().every(u => u.kind !== 'police')));
    await G(() => window.__danger.pursuit.placeUnit(4, 8));
    ok('rammed', null, await wait(() => window.__danger.pursuit.state.rams > 0, 12000));
    await G(() => { const s = window.__app.surface, i = s.info; window.__danger.pursuit.placeUnit(Math.sin(i.carYaw) * 9, Math.cos(i.carYaw) * 9); }); await sleep(250); await shot('chase');
    ok('centreClearChase', null, await centreClear());
    ok('budgetRespected', JSON.stringify(await G(() => window.__danger.budget())), await G(() => { const b = window.__danger.budget(); return b.world + b.ours + b.chase <= Math.max(b.cap, b.world); }));
    await G(() => { window.__danger.pursuit.blind(true); window.__danger.pursuit.fastLose(); });
    ok('lostGang', JSON.stringify(await G(() => window.__danger.pursuit.state)), await wait(() => !window.__danger.pursuit.state.active && /stop:lost/.test(window.__danger.pursuit.state.log.join(',')), 45000));
    // ---------- 8. Red Tape Run set-piece (highway.json) ----------
    await G(() => { const s = window.__app.surface, c = s.world.colony; s.debugMove ? s.debugMove(c.x - 280, c.z - 40 + 10, 0) : null; }); await sleep(600);
    ok('redTapeButton', null, await wait(() => { const b = document.getElementById('dzRedTape'); return b && b.style.display !== 'none' && b.getBoundingClientRect().width > 0; }, 6000));
    if (await vis('#dzRedTape')) await tapAt('#dzRedTape'); else await G(() => window.__danger.force('setpiece'));
    ok('setPieceRunning', JSON.stringify((await G(() => window.__danger.pursuit.state))?.sp), await wait(() => window.__danger.pursuit.state?.sp?.status === 'running', 4000));
    ok('setPieceStarsViaWorld', await G(() => window.__app.surface.world.wanted), (await G(() => window.__app.surface.world.wanted)) >= 2);
    await G(() => window.__app.surface.world.setWanted(0, 'test')); // keep ColSec out of this smoke test
    ok('chaseChip', null, await wait(() => { const c = document.getElementById('chaseChip'); return !!c && c.classList.contains('on') && c.getBoundingClientRect().width > 0; }, 8000));
    ok('pursuers3', (await G(() => window.__danger.pursuit.state)).units, (await G(() => window.__danger.pursuit.state)).units >= 1 && (await G(() => window.__danger.pursuit.state)).units <= 3);
    await sleep(300); await shot('redtape');
    // drive the checkpoints (teleport along the route, a few frames each)
    for (let k = 0; k < 20; k++) { const sp = (await G(() => window.__danger.pursuit.state.sp)); if (!sp || sp.status !== 'running') break;
      await G(n => window.__app.surface.debugMove(n[0], n[1], 0), sp.next); await wait(i => window.__danger.pursuit.state.sp?.i !== i, 3000, sp.i); }
    ok('setPieceWon', JSON.stringify(await G(() => window.__danger.pursuit.state)), await wait(() => window.__danger.pursuit.state?.lastSetPiece === 'won', 5000));
    ok('chipGone', null, !(await vis('#chaseChip')));
    // ---------- ambient events (random-events.json via the same director/budget) ----------
    await G(() => { window.__danger.clear(); window.__app.surface.world.setWanted(0, 'test'); const H = window.__app.surface.game.debug.H?.(); if (H) H.hp = 100; }); await rough(7); await sleep(300);
    ok('ambientLoaded', null, await wait(() => window.__danger.ambient.loaded, 10000));
    ok('ambientStubsListed', null, await G(() => window.__danger.ambient.stubs().length === 17));
    ok('ambientInitiation', JSON.stringify(await G(() => window.__danger.ambient.state.active)), await G(() => window.__danger.force('ambient', { id: 'ev-initiation-watch' })));
    ok('ambientCard', null, await wait(() => document.querySelectorAll('#dzEvChoices.on button').length === 3, 5000));
    ok('ambientCentreClear', null, await centreClear());
    await sleep(400); await shot('ambient');
    ok('ambientBudget', JSON.stringify(await G(() => window.__danger.budget())), await G(() => { const b = window.__danger.budget(); return b.world + b.ours + b.chase <= Math.max(b.cap, b.world); }));
    await G(() => { const w = window.__app.surface.world; window.__crimes = []; if (!w.__dzWrapped) { const f = w.crime; w.crime = (n, why) => { window.__crimes.push([n, why]); return f.call(w, n, why); }; w.__dzWrapped = 1; } });
    const evBtn = await G(() => { const b = document.querySelector('#dzEvChoices [data-choice="interrupt"]'); return !!b; });
    if (evBtn) await tapAt('#dzEvChoices [data-choice="interrupt"]'); else await G(() => window.__danger.ambientChoose('interrupt'));
    ok('ambientFight', JSON.stringify(await G(() => window.__danger.ambient.state.active)), await wait(() => window.__danger.ambient.state.active?.phase === 'fight', 5000));
    ok('ambientCrimeViaWorld', JSON.stringify(await G(() => window.__crimes)), await wait(() => window.__crimes.some(c => c[0] >= 1), 4000)); // world.crime has its own 2.5 s cooldown, so assert the call, not the star
    await G(() => window.__app.surface.world.setWanted(0, 'test'));
    for (let i = 0; i < 60; i++) { const left = await G(() => { const s = window.__app.surface, p = s.info, hs = window.__danger.npcs().filter(n => n.alive && n.hostile); for (const n of hs.slice(0, 1)) s.world.hitWorld({ x: p.x, y: n.y + 1.3, z: p.z }, { x: n.x, y: n.y + 1.2, z: n.z }, { dmg: 1.5 }); const H = s.game.debug.H?.(); if (H) H.hp = 100; return hs.length; }); if (!left) break; await sleep(150); }
    ok('ambientWon', JSON.stringify(await G(() => window.__danger.ambient.state)), await wait(() => (window.__danger.ambient.state.ended.won || 0) >= 1, 8000));
    ok('ambientCleansUp', null, await wait(() => !window.__danger.ambient.state.active, 45000)); // 6 game-s walk-off; slow under load
    // thief: chase choice = catch within 20 s
    await G(() => { window.__danger.clear(); window.__danger.skipGrace(); }); await rough(8); await sleep(300);
    const cr0 = await G(() => window.__app.surface.game.progress.credits);
    ok('ambientThief', null, await G(() => window.__danger.force('ambient', { id: 'ev-o2-thief' })));
    await wait(() => document.querySelectorAll('#dzEvChoices.on button').length >= 2, 5000);
    await G(() => window.__danger.ambientChoose('chase'));
    ok('ambientCatchPhase', null, await wait(() => window.__danger.ambient.state.active?.phase === 'catch', 4000));
    for (let i = 0; i < 20; i++) { if (await G(() => window.__danger.ambient.state.active?.phase !== 'catch')) break; await G(() => { const s = window.__app.surface, n = window.__danger.npcs().find(n => n.role === 'thief' && n.alive); if (n) s.debugPlace(n.x + 1, n.z + 1); }); await sleep(250); }
    ok('ambientCaught', JSON.stringify(await G(() => window.__danger.ambient.state.ended)), await wait(() => (window.__danger.ambient.state.ended.caught || 0) >= 1, 5000));
    ok('ambientReward', null, (await G(() => window.__app.surface.game.progress.credits)) > cr0);
    await G(() => window.__danger.clear()); await sleep(300);
    // ---------- heist:escape (Ben's heist module, not merged): getaway chase, never police ----------
    await G(() => { window.__danger.clear(); window.__app.surface.world.setWanted(0, 'test'); }); await rough(3); await sleep(300);
    const w1 = await G(() => window.__app.surface.world.wanted);
    await G(() => { window.dispatchEvent(new CustomEvent('heist:escape', { detail: 'garbage' })); }); // bad detail must not throw
    await G(() => { document.dispatchEvent(new CustomEvent('heist:escape', { bubbles: true, detail: { title: 'Helios vault', pursuers: 2 } })); });
    ok('getawayStarts', JSON.stringify(await G(() => window.__danger.pursuit.state)), await wait(() => window.__danger.pursuit.state?.active && window.__danger.pursuit.state.kind === 'getaway' && window.__danger.pursuit.state.units >= 1, 15000));
    ok('getawayNoStars', await G(() => window.__app.surface.world.wanted), (await G(() => window.__app.surface.world.wanted)) === w1);
    ok('getawayNotPolice', null, await G(() => window.__danger.pursuit.units().every(u => u.kind !== 'police')));
    ok('getawayBudget', JSON.stringify(await G(() => window.__danger.budget())), await G(() => { const b = window.__danger.budget(); return b.world + b.ours + b.chase <= Math.max(b.cap, b.world); }));
    await G(() => window.__danger.clear()); await sleep(300);
    // ---------- duel: world.inDuel clears the street (stubbed getter; the real duel is game-side) ----------
    await G(() => { window.__app.surface.world.setWanted(0, 'test'); const H = window.__app.surface.game.debug.H?.(); if (H) H.hp = 100; });
    ok('standoffDuel', null, await newMug(5));
    await G(() => { const w = window.__app.surface.world; window.__duelDesc = Object.getOwnPropertyDescriptor(w, 'inDuel'); Object.defineProperty(w, 'inDuel', { get: () => true, configurable: true }); });
    ok('duelClearsMugger', null, await wait(() => !window.__danger.state.mug && window.__danger.state.stats.lastEnd === 'duel', 15000));
    ok('duelChoicesGone', null, !(await vis('#dzPay')));
    await G(() => { window.__danger.skipGrace(); window.__danger.setClock?.(2); });
    await sleep(4000);
    ok('noEncounterInDuel', (await D()).stats.lastEnd, !(await D()).mug);
    await G(() => { const w = window.__app.surface.world; if (window.__duelDesc) Object.defineProperty(w, 'inDuel', window.__duelDesc); else delete w.inDuel; });
    ok('duelRestored', null, await G(() => window.__app.surface.world.inDuel === false));
    ok('noErrors', errors.join(' | ').slice(0, 400), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); R.exc = e.stack?.slice(0, 600); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
