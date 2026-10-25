// v7.4 test: legal duels. Challenge a Mars colonist (⚔️ on the context button), pick blades + a 25 cr wager,
// win to KO/yield with no stars, then the cantina pit champion (minimum wager, quick-draw, yield), a refusal,
// and an attack outside a duel still drawing stars. Screenshots: duel-fight (ring + crowd + banner).
// BASE=http://localhost:8765/ BR=webkit DEV="iPhone 14" node test-duel.js
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[id]')?.id }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); };
  const S = 'window.__app.surface';
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const P = window.__app.game.progress; P.credits = 500; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    // go to the colony centre, call a willing colonist over
    const cc = await G(() => { const d = window.__app.surface.world.doorList()[0]; return d; });
    await G(([x, z]) => window.__app.surface.debugPlace(x + 6, z + 10, 0), [cc.x, cc.z]); await sleep(600);
    const nm = await G(() => window.__app.surface.world.debugDuelist(false)); R.opponent = nm;
    ok('challengeLabel', await wait(() => /Challenge|Rematch/.test(document.getElementById('driveBtn').textContent), 4000));
    const b = await center('#driveBtn'); if (desk) await page.keyboard.press('KeyE'); else await page.touchscreen.tap(b.x, b.y);
    ok('panel', await wait(() => getComputedStyle(document.getElementById('duelPanel')).display === 'flex', 3000));
    const tt = await center('[data-t="blades"]'); ok('panelTargets44', tt?.h, tt?.h >= 44);
    await tapSel('[data-t="blades"]'); await tapSel('[data-w="25"]'); await sleep(200);
    const c0 = await G(() => window.__app.game.progress.credits);
    await tapSel('#duelGo');
    ok('duelStarted', await wait(() => !!window.__app.surface.info.duel, 3000));
    ok('wagerTaken', await G(c => window.__app.game.progress.credits === c - 25, c0));
    ok('banner', await wait(() => getComputedStyle(document.getElementById('duelBanner')).display === 'block', 3000));
    ok('ringAndCrowd', await wait(() => document.body.classList.contains('duel'), 2000));
    ok('fightPhase', await wait(() => window.__app.surface.info.duel?.phase === 'fight' || !window.__app.surface.info.duel, 15000));
    // fight: face them and swing until it's over
    let swings = 0, shot = false;
    for (let k = 0; k < 60 && (await G(() => !!window.__app.surface.info.duel)); k++) {
      await G(() => { const s = window.__app.surface, d = s.info.duel, i = s.info; if (!d) return; s.debugPlace(i.x, i.z, Math.atan2(-(d.x - i.x), -(d.z - i.z))); });
      if (desk) await page.keyboard.press('KeyC'); else { const m = await center('#meleeBtn'); await page.touchscreen.tap(m.x, m.y); }
      swings++; await sleep(450);
      if (!shot && swings === 2) { shot = true; await sleep(300); await page.screenshot({ path: `${out}duel-${tag}-fight.png` }); }
    }
    R.swings = swings;
    const L = await G(() => window.__app.surface.world.lastDuel); R.result = L && `${L.why} pot ${L.pot} +${L.credits}`;
    ok('duelOver', !!L);
    ok('noStars', await G(() => (window.__app.surface.info.wanted || 0) === 0));
    if (L?.win) ok('potPaid', await G(c => window.__app.game.progress.credits === c + 25, c0));
    // champion: minimum wager, then a quick-draw we yield
    await G(() => window.__app.surface.world.debugDuelist(true)); await sleep(300);
    const ch = await G(() => window.__app.surface.info.duelist); R.champion = ch;
    ok('championNamed', ch?.champion && /Grinder Vos/.test(ch.name));
    ok('championMinWager', await G(() => !window.__app.surface.world.challenge('pistol', 0, 'Grinder Vos').ok));
    const c1 = await G(() => window.__app.game.progress.credits);
    ok('championDuel', await G(() => window.__app.surface.world.challenge('pistol', 50, 'Grinder Vos').ok));
    ok('championPot', await G(() => window.__app.surface.info.duel?.pot), await G(() => window.__app.surface.info.duel?.pot >= 250));
    await sleep(3300); await page.screenshot({ path: `${out}duel-${tag}-quickdraw.png` });
    await tapSel('#duelYield'); ok('yielded', await wait(() => !window.__app.surface.info.duel && window.__app.surface.world.lastDuel?.why === 'yield-lose', 3000));
    ok('yieldLosesWager', await G(c => window.__app.game.progress.credits === c - 50, c1));
    // a colonist who won't fight
    ok('refusal', await G(() => { const w = window.__app.surface.world; for (const n of ['Dex Morrow', 'Lina Sato', 'Bram Kell', 'Juno Reyes', 'Tobi Achebe', 'Mara Quist', 'Sol Varga', 'Pike Lund', 'Rae Okoro', 'Hux Brennan']) { const r = w.challenge('fists', 0, n); if (r.refused) return r.msg; if (r.ok) w.yieldDuel(); } return false; }));
    // outside a duel, hitting a colonist still draws stars
    await G(() => window.__app.surface.world.setWanted(0)); await sleep(2700);
    await G(() => window.__app.surface.world.debugDuelist(false)); await sleep(200);
    const crime = await G(() => { const s = window.__app.surface, i = s.info, w = s.world; return w.meleeWorld(i.x, i.z, 1, 0, 3, 1, 0.2) || w.meleeWorld(i.x, i.z, -1, 0, 3, 1, 0.2); });
    ok('outsideDuelIsCrime', `${crime} → ${await G(() => window.__app.surface.info.wanted)}`, await wait(() => window.__app.surface.info.wanted > 0, 2000));
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
