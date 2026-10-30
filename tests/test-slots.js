// v7.6 test: Velvet Airlock slot machines (slots.js). Enter the club, walk to the cabinets in the south-west corner:
// the action button reads '🎰 Play' (black, white text). Open the slot overlay, spin at 10 / 50 / 200 (balance goes
// down by the bet at the pull and up by the win when the reels land), a forced jackpot pays 5,000 at 200 with the
// flashing/shaking win, a short-of-cash spin charges nothing, Leave returns to the club, and Danny's show still opens.
// BASE=http://localhost:8765/ BR=webkit DEV="iPhone 14" VP=393x852 SHOTS_DIR=shots/slots node tests/test-slots.js   (DEV=desktop BR=chromium for keys)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const vp = process.env.VP && process.env.VP.split('x').map(Number);
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV], ...(vp ? { viewport: { width: vp[0], height: vp[1] } } : {}) }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = `${DEV}${vp ? '-' + process.env.VP : ''}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, top: t && (t.id || t.closest('[id]')?.id), cls: t && t.className }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn'); };
  const credits = () => G(() => window.__app.game.progress.credits);
  const isOpen = () => G(() => window.__slots.isOpen && getComputedStyle(document.getElementById('slPanel')).display === 'flex');
  const shot = async n => { const p = `${out}slots-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const spinAt = async (b, force) => {
    if (desk) await page.keyboard.press('Digit' + (window_bets.indexOf(b) + 1)); else await tapSel(`.slBet[data-b="${b}"]`);
    ok('bet' + b + 'Selected', await G(b => window.__slots.bet === b && document.querySelector(`.slBet[data-b="${b}"]`).classList.contains('sel') && new RegExp('SPIN · ' + b).test(document.getElementById('slSpin').textContent), b));
    if (force) await G(f => window.__slots.debugNext(f), force);
    const c0 = await credits();
    if (desk) await page.keyboard.press('Space'); else await tapSel('#slSpin');
    ok('charged' + b, await wait(([c, b]) => window.__app.game.progress.credits === c - b && window.__slots.spinning, 3000, [c0, b]));
    return c0;
  };
  const window_bets = [10, 50, 200];
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(800);
    ok('moduleUp', await G(() => !!window.__slots && window.__slots.bets.join()));
    ok('rtp', await G(() => +(window.__slots.odds().rtp * 100).toFixed(2)));
    const nb = await G(() => { const b = window.__app.surface.world.npcBudget?.(); return b ? { used: b.used, cap: b.cap } : null; });
    ok('npcBudget', nb && `${nb.used}/${nb.cap}`, !nb || (nb.used <= nb.cap && (desk || nb.cap <= 12)));
    // other hotspots are not in range at the machines, and the machines are not in range at the bar / door
    await G(() => window.__app.surface.debugInside(-8.1, 1.5, 0)); await sleep(400); R.atBar = await G(() => window.__app.surface.info.spot?.id); ok('barSpot', R.atBar === 'bar');
    await G(() => window.__app.surface.debugInside(0, 7.0, 0)); await sleep(400); R.atDoor = await G(() => window.__app.surface.info.spot?.id); ok('doorSpot', R.atDoor === 'leave');
    // 1) the prompt at the machines
    await G(() => window.__app.surface.debugInside(-7.7, 6.45, Math.PI));
    ok('prompt', await wait(() => /🎰 Play/.test(document.getElementById('driveBtn').textContent) && window.__app.surface.info.spot?.id === 'slots' && document.body.classList.contains('slNear'), 15000));
    const bw = await G(() => { const c = getComputedStyle(document.getElementById('driveBtn')); return c.backgroundColor + ' / ' + c.color; });
    ok('promptBW', bw, /rgba?\(0, 0, 0(, 1)?\)/.test(bw) && /255, 255, 255/.test(bw.split('/')[1]));
    await sleep(1500); await shot('prompt');
    // 2) open
    await act(); ok('open', await wait(() => window.__slots.isOpen && getComputedStyle(document.getElementById('slPanel')).display === 'flex', 3000));
    ok('notSpunOnOpen', await G(() => !window.__slots.spinning && window.__slots.stats.spins === 0));
    const fit = await G(() => { const r = document.getElementById('slCard').getBoundingClientRect(), c = document.getElementById('slCard'); return { l: r.left, t: r.top, r: innerWidth - r.right, b: innerHeight - r.bottom, scroll: c.scrollHeight > c.clientHeight + 1 }; });
    ok('fits', JSON.stringify(fit), fit.l >= 0 && fit.t >= 0 && fit.r >= 0 && fit.b >= 0 && !fit.scroll);
    ok('paytable', await G(() => document.querySelectorAll('#slPay .m').length === 10 && /25× JACKPOT/.test(document.getElementById('slPay').textContent)));
    for (const s of ['#slSpin', '#slLeave', '.slBet[data-b="200"]', '#slClose']) { const b = await center(s); ok('btn44 ' + s, `${Math.round(b.w)}x${Math.round(b.h)} top=${b.top || b.cls}`, b.h >= 44 && b.w >= 44); }
    await sleep(500);
    // 3) spin at 10 (mid-spin shot), 50, then a forced jackpot at 200
    let c0 = await spinAt(10); await sleep(250); await shot('spinning');
    ok('settled10', await wait(() => !window.__slots.spinning, 4000));
    let L = await G(() => window.__slots.last); ok('balance10', `${c0} -10 +${L.win} = ${await credits()}`, (await credits()) === c0 - 10 + L.win);
    await sleep(500); await shot('idle-paytable');
    c0 = await spinAt(50); ok('settled50', await wait(() => !window.__slots.spinning, 4000));
    L = await G(() => window.__slots.last); ok('balance50', `${c0} -50 +${L.win} = ${await credits()}`, (await credits()) === c0 - 50 + L.win);
    await sleep(400);
    c0 = await spinAt(200, ['olympus', 'olympus', 'olympus']); ok('settled200', await wait(() => !window.__slots.spinning, 4000));
    L = await G(() => window.__slots.last); ok('jackpot200', `${c0} -200 +${L.win} = ${await credits()}`, L.kind === 'jackpot' && L.win === 5000 && (await credits()) === c0 - 200 + 5000);
    ok('bigFlash', await G(() => document.getElementById('slMsg').classList.contains('big') && /JACKPOT/.test(document.getElementById('slMsg').textContent) && document.getElementById('slCard').classList.contains('shake')));
    await sleep(250); await shot('win');
    await sleep(1200);
    // a natural win at 50 (forced alien line) is a big win too
    c0 = await spinAt(50, ['alien', 'alien', 'alien']); await wait(() => !window.__slots.spinning, 4000);
    ok('alien50', await G(c => window.__slots.last.win === 1000 && window.__app.game.progress.credits === c - 50 + 1000, c0));
    // 4) short of cash: message, no charge, no spin
    await G(() => { window.__app.game.progress.credits = 30; window.__app.game.save(); });
    if (desk) await page.keyboard.press('Digit2'); else await tapSel('.slBet[data-b="50"]');
    if (desk) await page.keyboard.press('Space'); else await tapSel('#slSpin'); await sleep(400);
    ok('brokeMsg', await G(() => document.getElementById('slMsg').textContent), await G(() => /Short on cr/.test(document.getElementById('slMsg').textContent) && document.getElementById('slMsg').classList.contains('broke')));
    ok('brokeNoCharge', await G(() => window.__app.game.progress.credits === 30 && !window.__slots.spinning));
    await shot('broke');
    // 5) Leave returns to the club
    if (desk) await page.keyboard.press('Escape'); else await tapSel('#slLeave');
    ok('closed', await wait(() => !window.__slots.isOpen && getComputedStyle(document.getElementById('slPanel')).display === 'none', 3000));
    ok('backInClub', await G(() => window.__app.surface.info.inside?.kind === 'club'));
    ok('promptBack', await wait(() => /🎰 Play/.test(document.getElementById('driveBtn').textContent) && document.body.classList.contains('slNear'), 4000));
    // reopen + walk off via leaveBuilding closes it
    await G(() => { window.__app.game.progress.credits = 1000; window.__app.game.save(); });
    await sleep(800); await act(); ok('reopen', await wait(() => window.__slots.isOpen, 3000));
    if (!desk) { await tapSel('#slClose'); ok('closeX', await wait(() => !window.__slots.isOpen, 3000)); }
    else { await page.keyboard.press('Escape'); ok('closeEsc', await wait(() => !window.__slots.isOpen, 3000)); }
    // 6) Danny's own flow untouched (her 150 show from the VIP room)
    await G(() => { localStorage.setItem('ssx.adult', '1'); window.__app.game.setFlag?.('vip'); window.__app.surface.world.openVip(); window.__app.surface.debugInside(6.55, -5.3, 0); });
    ok('dannyLabel', await wait(() => /Private show 150/.test(document.getElementById('driveBtn').textContent) && !document.body.classList.contains('slNear'), 4000));
    await act(); ok('dannyOffer', await wait(() => getComputedStyle(document.getElementById('pshowOffer')).display === 'flex', 3000));
    const c3 = await credits(); await tapSel('#pshowYes');
    ok('dannyPaid150', await wait(c => window.__app.game.progress.credits === c - 150, 4000, c3));
    ok('dannyShow', await wait(() => window.__pshow.active && window.__pshow.state.ready && !window.__slots.isOpen, 20000));
    await sleep(1000); if (desk) await page.keyboard.press('Escape'); else await tapSel('#pshowLeave');
    ok('dannyLeave', await wait(() => !window.__pshow.active && !document.getElementById('fadeBlack').classList.contains('on'), 6000));
    ok('stats', JSON.stringify(await G(() => window.__slots.stats)));
    await G(() => window.__app.surface.leaveBuilding());
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
