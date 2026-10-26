// v7.5 test: Red Tape Flats turf wars (mars/turf.js). Land on Mars, open the ☰ Turf panel (taps), walk to a block flag,
// tap "Take", survive the defender waves (real core hostiles, src 'turf'), own the block, income ticks (real 30 s payout
// + debug fast-forward), a counter-attack you win and one you abandon (block lost), price multiplier, persistence, keys,
// 44px high-contrast targets, no console errors.
// BASE=http://localhost:8874/ BR=webkit DEV="iPhone 14" OUT=/tmp/turf/ node test-turf.js   (DEV=desktop for 1366x768)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8874/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(300); };
  const shot = async p => { try { await page.screenshot({ path: p, timeout: 120000 }); R.shots = (R.shots || []).concat(p); } catch (e) { R.shotFail = (R.shotFail || []).concat(p); } };
  const F = () => G(() => window.SSX.turf.fight());
  const C = () => G(() => window.__app.game.progress.credits);
  const calm = () => G(() => { window.__app.game.debug.calm(true); const H = window.__app.game.debug.H(); if (H) H.hp = Math.max(H.hp, 80); });
  // fight every wave: wait for real spawns, count them, clear them; returns { waves, maxAlive }
  const fightWaves = async (label) => {
    await G(() => { clearInterval(window.__turfHeal); window.__turfHeal = setInterval(() => { try { const g = window.__app.game; g.debug.calm(true); const H = g.debug.H(); if (H) { H.hp = Math.max(H.hp, 80); H.inv = Math.max(H.inv || 0, 1); } window.__app.surface.world.setWanted?.(0); } catch (e) { /* not landed */ } }, 150); }); // the test is about turf rules, not surviving a phone-speed gunfight
    let waves = 0, maxAlive = 0;
    for (let k = 0; k < 6; k++) {
      const f = await F(); if (!f) break;
      await G(() => { window.SSX.turf.debug.goto(); const H = window.__app.game.debug.H(); if (H) H.hp = Math.max(H.hp, 80); }); // stand in the ring (ambient events / knockbacks can move you)
      // v7.5.3: with Steve's SSX.raids installed (PR #13) takeovers run on the raid engine; count its attackers too
      const up = await wait(() => { const f = window.SSX.turf.fight(); return !f || (f.phase === 'fight' && window.__app.game.debug.agents().some(a => a.src === 'turf')) || (f.engine === 'raids' && (window.__raids?.npcs || 0) > 0); }, 60000);
      if (!(await F())) break; await calm();
      const n = await G(() => window.SSX.turf.fight()?.engine === 'raids' ? (window.__raids?.npcs || 0) : window.__app.game.debug.agents().filter(a => a.src === 'turf').length); maxAlive = Math.max(maxAlive, n); if (n) waves++;
      if (k === 0) { await sleep(600); await shot(`${out}turf-${tag}-${label}-wave.png`); R[label + 'Hud'] = await G(() => document.getElementById('turfHud').innerText.replace(/\n/g, ' | ')); }
      if (!up) { R[label + 'Stuck'] = JSON.stringify(await F()); break; }
      const w0 = (await F())?.wave;
      await G(() => window.SSX.turf.fight()?.engine === 'raids' ? (window.__raids.killAll(), window.__raids.flushQueue()) : window.SSX.turf.debug.clearWave());
      await wait(w => { const f = window.SSX.turf.fight(); return !f || (f.engine === 'raids' ? f.wave !== w || (window.__raids?.npcs || 0) === 0 && !window.__raids?.state : f.phase !== 'fight'); }, 30000, w0);
      if ((await F())?.engine === 'raids') await wait(w => { const f = window.SSX.turf.fight(); return !f || f.wave !== w; }, 15000, w0);
    }
    await G(() => clearInterval(window.__turfHeal));
    return { waves, maxAlive };
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); });
    ok('api', await G(() => ['blocks', 'owner', 'attack', 'income', 'on', 'ownerAt', 'priceMultiplier', 'open'].every(k => typeof window.SSX?.turf?.[k] === 'function')));
    ok('menuItem', await G(() => !!document.getElementById('rmTurf')));
    const bl = await G(() => window.SSX.turf.blocks()); R.blocks = bl.map(b => `${b.id}:${b.owner}`).join(',');
    ok('sixBlocks3Gangs', bl.length === 6 && new Set(bl.map(b => b.owner)).size === 3 && bl.some(b => b.owner === 'saltblood'));
    ok('offMarsRefuses', await G(() => window.SSX.turf.attack('hab-stacks').ok === false));
    R.engine = await G(() => window.SSX.turf.debug.engine());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.SSX.turf.debug.reset(); window.__app.surface.world.setWanted(0); window.__evs = []; window.SSX.turf.on(e => { if (e.type !== 'change') window.__evs.push(e.type + ':' + (e.block || '')); if (e.type === 'lost') (window.__lostWhy ||= []).push(e.why); }); });

    // ---- panel via ☰ menu (taps)
    await tapSel('#menuBtn'); await sleep(400); await tapSel('#rmTurf');
    ok('panelOpen', await wait(() => document.getElementById('turfPanel').classList.contains('show'), 4000));
    ok('panelRows', await G(() => document.querySelectorAll('#turfPanel .it').length), (await G(() => document.querySelectorAll('#turfPanel .it').length)) === 6);
    const tg = await G(() => [...document.querySelectorAll('#turfPanel button')].map(b => b.getBoundingClientRect().height)); ok('panelTargets44', Math.min(...tg), Math.min(...tg) >= 44);
    const sty = await G(() => { const s = getComputedStyle(document.querySelector('#turfPanel button')); return s.backgroundColor + '|' + s.color; }); ok('highContrast', sty, sty === 'rgb(0, 0, 0)|rgb(255, 255, 255)');
    await tapSel('#turfPanel button[data-take="hab-stacks"]'); // far away -> tracks it
    ok('trackFar', await G(() => /Get to Hab Stacks/.test(document.getElementById('turfMsg').textContent)));
    await shot(`${out}turf-${tag}-panel.png`);
    await tapSel('#turfClose');
    ok('hqLocked', await G(() => window.SSX.turf.attack('marrow-court', { force: true }).ok === false));

    // ---- takeover: walk to the Hab Stacks flag, tap Take, survive the waves
    await G(() => window.SSX.turf.debug.goto('hab-stacks')); await sleep(800);
    ok('flagAction', await wait(() => { const b = document.getElementById('turfAct'); return getComputedStyle(b).display !== 'none' && /Take Hab Stacks/.test(b.textContent); }, 10000));
    const ab = await center('#turfAct'); ok('actBtn44', ab?.h, ab?.h >= 44);
    const c0 = await C();
    await tapSel('#turfAct');
    ok('takeStarted', (await F())?.kind, (await F())?.kind === 'take' && (await F())?.gang === 'dustjaws');
    ok('hudShown', await wait(() => getComputedStyle(document.getElementById('turfHud')).display !== 'none', 10000));
    const hb = await center('#turfRetreat'); ok('hudBtn44', hb?.h, hb?.h >= 44);
    const tw = await fightWaves('take'); R.takeWaves = tw;
    ok('takeWaves2plus', tw.waves >= 2);
    ok('captured', await wait(() => window.SSX.turf.owner('hab-stacks') === 'player', 10000));
    ok('takePaid', (await C()) - c0, (await C()) > c0);

    // ---- income: fast-forward + a real 30 s payout tick
    ok('incomeRate', await G(() => window.SSX.turf.income().perMin), (await G(() => window.SSX.turf.income().perMin)) === 7);
    const i0 = await C(); const paid = await G(() => window.SSX.turf.debug.tickIncome(120));
    ok('incomeFastForward', paid, paid >= 13 && (await C()) - i0 >= 13);
    await G(() => { window.__inc = 0; window.SSX.turf.on('income', () => window.__inc++); });
    ok('incomeTicks', await wait(() => window.__inc > 0, 45000));
    await G(() => window.SSX.turf.debug.goto('hab-stacks')); await sleep(300); // the 45 s income wait can end in a street knock-down / clinic respawn
    ok('priceOwn', await G(() => window.SSX.turf.priceMultiplier('mars-rough')), (await G(() => window.SSX.turf.priceMultiplier('mars-rough'))) > 1);
    ok('priceRival', await G(() => window.SSX.turf.priceMultiplier('mars-rough', window.SSX.turf.blocks().find(b => b.id === 'chop-row').flag)) === 1);
    ok('ownerAt', await G(() => window.SSX.turf.ownerAt()?.owner === 'player'));

    // ---- counter-attack you win
    await G(() => window.SSX.turf.debug.counter('hab-stacks'));
    ok('counterStarted', (await F())?.kind, (await F())?.kind === 'defend' && (await F())?.gang === 'dustjaws');
    const dw = await fightWaves('defend'); R.defendWaves = dw;
    ok('defended', await wait(() => window.__evs.includes('defended:hab-stacks'), 10000));
    if (bad.includes('defended')) R.defendLostWhy = await G(() => JSON.stringify({ why: window.__lostWhy || [], down: window.__app.game.isDown?.(), f: window.SSX.turf.fight() }));
    ok('stillOwned', await G(() => window.SSX.turf.owner('hab-stacks') === 'player'));

    // ---- counter-attack you walk away from (alert -> "Let it go" button) -> block lost
    await G(() => { const s = window.__app.surface, c = s.info.colony; s.debugMove(c.x - 2, c.z + 40, 0); }); await sleep(800);
    await G(() => window.SSX.turf.debug.counter('hab-stacks'));
    ok('alertPhase', (await F())?.phase, (await F())?.phase === 'alert');
    await sleep(500); R.alertHud = await G(() => document.getElementById('turfHud').innerText.replace(/\n/g, ' | '));
    await tapSel('#turfRetreat');
    ok('lostBack', await G(() => window.SSX.turf.owner('hab-stacks')), (await G(() => window.SSX.turf.owner('hab-stacks'))) === 'dustjaws');

    // ---- persistence, keys, events
    ok('persisted', await G(() => { const s = JSON.parse(localStorage.getItem('ssx.turf.v1')); return s.taken === 1 && s.defended === 1 && s.lost === 1 && s.earned > 0; }));
    ok('flag', await G(() => window.__app.game.flag('turf:first')));
    if (desk) { await page.keyboard.press('KeyK'); ok('keyK', await wait(() => document.getElementById('turfPanel').classList.contains('show'), 3000)); await page.keyboard.press('KeyK'); }
    const evs = await G(() => window.__evs); R.events = [...new Set(evs)].join(',');
    ok('events', ['attack:hab-stacks', 'wave:hab-stacks', 'captured:hab-stacks', 'income:', 'counter:hab-stacks', 'defended:hab-stacks', 'lost:hab-stacks'].every(e => evs.includes(e)));
    // map beacon opens the panel
    await G(() => { const s = window.__app.surface, c = s.info.colony; s.debugMove(c.x - 280 - 8 + 1, c.z - 40 + 16 + 1, 0); }); await sleep(800);
    ok('mapBeacon', await wait(() => /Turf map/.test(document.getElementById('turfAct').textContent), 8000));
    await tapSel('#turfAct'); ok('mapOpens', await wait(() => document.getElementById('turfPanel').classList.contains('show'), 3000));
    await shot(`${out}turf-${tag}-map.png`);
  } catch (e) { R.exception = String(e && e.stack || e); bad.push('exception'); }
  R.errors = errors.slice(0, 10); if (errors.length) bad.push('consoleErrors');
  R.bad = bad; R.pass = !bad.length;
  console.log(JSON.stringify(R, null, 1));
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
