// v7.5.34 browser test: Velvet Blackjack + Roulette tables in the club lobby, and suited cards (rank + ♥♦♣♠) at Velvet Hold'em.
// Enter the club, walk to each table, open it from the hotspot, black/white buttons >= 44 px, a rigged blackjack win
// (K♥ 9♣ vs 9♦ 8♠) pays 2x, a rigged roulette spin on Red pays 1:1, Hold'em shows suit symbols (red hearts/diamonds).
// Screenshots: OUT (default /workspace/velvet/). BASE=http://127.0.0.1:8817/ BR=webkit DEV="iPhone 14" node tests/test-clubgames.js
const pw = require('playwright'), fs = require('fs');
const base = process.env.BASE || 'http://127.0.0.1:8817/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.OUT || '/workspace/velvet') + '/', desk = DEV === 'desktop'; try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : iph); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = DEV.replace(/\W+/g, '-').toLowerCase() + '-' + BR;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, hit: !!(t && (t === e || e.contains(t))) }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn'); };
  const at = async (x, z, re, yaw = 0) => { await G(([x, z, y]) => window.__app.surface.debugInside(x, z, y), [x, z, yaw]); return wait(r => new RegExp(r).test(document.getElementById('driveBtn').textContent), 4000, re); };
  const cr = () => G(() => window.__app.game.progress.credits);
  const bw = sel => G(s => [...document.querySelectorAll(s)].every(e => { const c = getComputedStyle(e); return c.backgroundColor === 'rgb(0, 0, 0)' && c.color === 'rgb(255, 255, 255)'; }), sel);
  const perf = () => G(() => new Promise(res => { const r = window.__app.renderer, inf = r.info; inf.autoReset = false; inf.reset(); let calls = 0, t0 = performance.now();
    const f = () => { calls = Math.max(calls, inf.render.calls); inf.reset(); if (performance.now() - t0 < 1500) requestAnimationFrame(f); else { inf.autoReset = true; res(calls); } }; requestAnimationFrame(f); }));
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    await G(() => { const st = document.createElement('style'); st.textContent = '#obLine, #radio.mini { display: none !important; }'; document.head.appendChild(st); });
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(800);
    // lobby view from the door: both tables + signs
    await G(() => window.__app.surface.debugInside(-11, 22.6, 0)); await sleep(700);
    R.drawCalls = await perf(); ok('drawCallsOk', R.drawCalls, R.drawCalls < 600); // whole-lobby view from the door; v7.5.33 main measured ~520 at the same spot right after entering, so the 2 tables add ~0-15
    // --- blackjack ---
    ok('bjSpot', await at(-24, 17.9, 'Blackjack')); await sleep(500); await page.screenshot({ path: out + `blackjack-table-${tag}.png` });
    await act(); ok('bjPanel', await wait(() => /Velvet Blackjack/.test(document.getElementById('clubGame')?.textContent || '') && document.getElementById('clubGame').classList.contains('on'), 4000));
    ok('bjBW', await bw('#clubGame button'));
    const R13 = r => (r + 0.5) / 13, S4 = s => (s + 0.5) / 4;
    await G(([a]) => { let i = 0; window.__clubGames.setRng(() => a[i++ % a.length]); }, [[R13(11), S4(2), R13(7), S4(1), R13(7), S4(0), R13(6), S4(3)]]);
    let c0 = await cr(); const db = await tapSel('#clubGame button[data-bet="25"]'); ok('dealBtn44', `${Math.round(db.w)}x${Math.round(db.h)} hit=${db.hit}`, db.h >= 44 && db.hit);
    ok('bjCharged', await wait(c => window.__app.game.progress.credits === c - 25, 3000, c0));
    ok('bjSuits', await G(() => [...document.querySelectorAll('#bjP .card')].map(c => c.textContent.replace('\ufe0e', '')).join(' ')), await G(() => /K♥/.test(document.getElementById('bjP').textContent) && /9♣/.test(document.getElementById('bjP').textContent)));
    ok('redHeart', await G(() => getComputedStyle(document.querySelector('#bjP .card.red')).color === 'rgb(208, 16, 30)'));
    ok('holeHidden', await G(() => !!document.querySelector('#bjD .card.back')));
    await page.screenshot({ path: out + `blackjack-panel-${tag}.png` });
    await tapSel('#clubGame button[data-a="stand"]');
    ok('bjWinPaid', await wait(c => window.__app.game.progress.credits === c + 25, 3000, c0)); R.bjLog = await G(() => document.getElementById('cgLog').textContent);
    await G(() => window.__clubGames.setRng(null));
    await tapSel('#clubGame button[data-a="close"]'); ok('bjClosed', await wait(() => !document.getElementById('clubGame').classList.contains('on'), 2000)); await sleep(400);
    // --- roulette ---
    ok('rlSpot', await at(2, 17.6, 'Roulette')); await sleep(500); await page.screenshot({ path: out + `roulette-table-${tag}.png` });
    await act(); ok('rlPanel', await wait(() => /Velvet Roulette/.test(document.getElementById('clubGame')?.textContent || '') && document.getElementById('clubGame').classList.contains('on'), 4000));
    ok('rlBW', await bw('#clubGame button'));
    await tapSel('#clubGame button[data-c="25"]'); ok('chip25', await G(() => window.__clubGames.state().rl.chip === 25));
    await G(() => { window.__clubGames.setRng(() => 7.5 / 37); }); // ball lands on 7 (red)
    c0 = await cr(); await tapSel('#clubGame button[data-k="red"]');
    ok('rlRedWin', await wait(c => window.__app.game.progress.credits === c + 25 && !window.__clubGames.state().rl.spinning, 4000, c0)); R.rlLog = await G(() => document.getElementById('cgLog').textContent);
    ok('rlBall7', await G(() => document.getElementById('rlBall').textContent === '7' && document.getElementById('rlBall').classList.contains('red')));
    c0 = await cr(); await tapSel('#clubGame button[data-k="black"]'); ok('rlBlackLoses', await wait(c => window.__app.game.progress.credits === c - 25 && !window.__clubGames.state().rl.spinning, 4000, c0));
    await G(() => document.getElementById('clubGame').scrollTop = 0); await sleep(200);
    await page.screenshot({ path: out + `roulette-panel-${tag}.png` });
    await G(() => window.__clubGames.setRng(null));
    await tapSel('#clubGame button[data-a="close"]'); ok('rlClosed', await wait(() => !document.getElementById('clubGame').classList.contains('on'), 2000)); await sleep(400);
    // --- Hold'em suited cards ---
    ok('pokerSpot', await at(-22, 2.65, 'Hold'));
    await act(); ok('buyIn', await wait(() => !!document.querySelector('#pokerPanel button[data-buy="100"]'), 4000));
    await tapSel('#pokerPanel button[data-buy="100"]');
    ok('holeCards', await wait(() => document.querySelectorAll('#pokerPanel .seat.me .card:not(.back)').length === 2, 6000));
    for (let i = 0; i < 10 && !(await G(() => document.querySelectorAll('#pokerPanel .board .card').length >= 3)); i++) { const en = await G(() => !document.querySelector('#pokerPanel .call')?.disabled); if (en) await tapSel('#pokerPanel .call'); await sleep(600); }
    const pk = await G(() => [...document.querySelectorAll('#pokerPanel .card:not(.back)')].map(c => ({ t: c.textContent.replace('\ufe0e', ''), col: getComputedStyle(c).color, w: c.getBoundingClientRect().width })));
    R.pokerCards = pk.map(c => c.t).join(' ');
    ok('pokerSuitSymbols', pk.length >= 2 && pk.every(c => /^(10|[2-9JQKA])[♣♦♥♠]$/.test(c.t)));
    ok('pokerSuitColours', pk.every(c => /[♥♦]/.test(c.t) ? c.col === 'rgb(208, 16, 30)' : c.col === 'rgb(17, 17, 17)'));
    ok('pokerCardSize', Math.min(...pk.map(c => c.w)), pk.every(c => c.w >= 48));
    ok('noLetterSuits', await G(() => !/\b(10|[2-9TJQKA])[cdhs]\b/.test(document.getElementById('pokerPanel').innerText)));
    await page.screenshot({ path: out + `poker-suited-cards-${tag}.png` });
    ok('noErrors', errors.length ? errors.slice(0, 3).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.fails = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
