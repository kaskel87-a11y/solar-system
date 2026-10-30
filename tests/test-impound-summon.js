// v7.5.8: summoning an impounded rover never fakes success. ☰ "Summon rover here (impounded)" opens a card:
// "Your rover's impounded at ColSec (Olympus Row)." with black "Pay fee (X cr) & summon" (disabled + reason when short) and
// "Waypoint to impound" (a disabled Pay greys its text like every disabled button in the game). Paying releases the rover and lands it ~3.5 m beside you with 🚙 Drive showing. Also the summon distance fix.
// BASE=http://127.0.0.1:8866/ BR=webkit DEV=393x852 OUT=... node tests/test-impound-summon.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8866/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw[BR].launch(); const m = /^(\d+)x(\d+)$/.exec(DEV); const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const mobile = !!m; const ctx = await b.newContext(m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] } } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); const errs = [], toasts = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [], ok = (k, v, c) => { R[k] = v; if (!c) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const tap = async sel => { if (mobile) await page.tap(sel); else await page.click(sel); await sleep(350); };
  const tag = `impound-${DEV}-${BR}`, shot = n => page.screenshot({ path: `${out}${tag}-${n}.png` });
  const card = () => G(() => { const c = document.getElementById('impCard'); if (!c || getComputedStyle(c).display === 'none') return null; const p = c.querySelector('#impPay'), w = c.querySelector('#impWay'), cs = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { text: e.textContent, bg: s.backgroundColor, fg: s.color, h: Math.round(r.height), disabled: e.disabled }; };
    return { text: c.querySelector('p').textContent, why: c.querySelector('#impWhy').textContent, pay: cs(p), way: cs(w) }; });
  const rover = () => G(() => { const i = window.__app.surface.info, C = window.SSX.consequences; return { dist: Math.round(Math.hypot(i.roverX - i.x, i.roverZ - i.z) * 10) / 10, inLot: C.debug.inLot(i.roverX, i.roverZ, 2), near: i.nearRover, impounded: !!C.status().impound, drive: (() => { const d = document.getElementById('driveBtn'); return getComputedStyle(d).display !== 'none' ? d.textContent : ''; })(), cr: window.__app.game.progress.credits }; });
  const summonViaMenu = async () => { await G(() => window.__app.toggleMenu(true)); await sleep(500); await tap('#rmSummon'); };
  try {
    await page.goto(base + '?t=' + Date.now(), { timeout: 180000 }); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1200);
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } try { window.SSX.control?.debug?.setTimes({ first: 9999, after: 9999 }); } catch (e) { } });
    await wait(() => !!window.SSX?.consequences?.roverImpounded, 20000);
    await G(() => { const t = document.getElementById('toast'); new MutationObserver(() => (window.__toasts ||= []).push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
    // 1) the distance fix: out in the rocks, summon lands it ~3.5 m away with Drive up
    await G(() => window.__app.surface.debugPlace(-240, -300, 0)); await sleep(900);
    const spot = await G(() => { const S = window.__app.surface, W = S.world, H = (x, z, r) => !!W.collide?.(x, z, r) || S.rocksNear(x, z, r) > 0; let best = null; const p = S.info;
      for (let dx = -30; dx <= 30; dx += 3) for (let dz = -30; dz <= 30; dz += 3) { const x = p.x + dx, z = p.z + dz; if (H(x, z, 0.8)) continue; let n = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; for (const r of [2.5, 3.5, 5, 6]) if (H(x - Math.sin(a) * r, z - Math.cos(a) * r, 1.2)) { n++; break; } } if (!best || n > best.n) best = { x, z, n }; } return best; });
    await G(s => window.__app.surface.debugPlace(s.x, s.z, 1.1), spot); await sleep(500);
    await summonViaMenu(); await wait(() => /Drive/.test(document.getElementById('driveBtn').textContent) && getComputedStyle(document.getElementById('driveBtn')).display !== 'none', 1500);
    const d1 = await rover(); ok('rockySummon', { blockedDirs: spot.n, ...d1 }, spot.n >= 4 && d1.near && d1.dist <= 5.6 && /Drive/.test(d1.drive)); await shot('rocky-summon');
    // 2) impounded: Summon opens the card, no fake success, rover stays in the lot
    await G(() => { window.__app.game.progress.credits = 40; window.SSX.consequences.debug.impound(); window.__toasts = []; }); await sleep(800);
    await G(() => window.__app.toggleMenu(true)); await sleep(600);
    ok('menuLabel', await G(() => document.getElementById('rmSummon').textContent), /\(impounded\)/.test(await G(() => document.getElementById('rmSummon').textContent))); await shot('menu-label');
    await tap('#rmSummon'); await sleep(600);
    const c1 = await card(), r1 = await rover(), t1 = await G(() => window.__toasts.slice());
    ok('cardShown', c1, !!c1 && /impounded at ColSec \(Olympus Row\)/.test(c1.text) && c1.pay.bg === 'rgb(0, 0, 0)' && c1.way.bg === 'rgb(0, 0, 0)' && c1.way.fg === 'rgb(255, 255, 255)' && c1.pay.h >= 44 && c1.way.h >= 44);
    ok('noFakeSummon', { toasts: t1, ...r1 }, !t1.some(x => /beamed in|summoned/i.test(x)) && r1.inLot && r1.impounded && !/Drive/.test(r1.drive));
    ok('payDisabledWhenShort', c1?.pay, !!c1 && c1.pay.disabled && /Pay fee \(\d+ cr\) & summon/.test(c1.pay.text) && /Not enough cash/.test(c1.why)); await shot('card-short');
    const r1b = await rover(); await sleep(1500); const r1c = await rover(); ok('stillImpounded', r1c, r1c.inLot && r1c.impounded);
    // 3) waypoint to impound
    await tap('#impWay'); const wp = await G(() => window.SSX.hudx.waypoint?.()); ok('waypoint', wp, !!wp && /Impound/.test(wp.label) && !(await card())); await shot('waypoint');
    // 4) cash in hand: pay & summon
    await G(() => { window.__app.game.progress.credits = 5000; }); await summonViaMenu(); await sleep(500);
    const c2 = await card(); const fee = +(/\((\d+) cr\)/.exec(c2?.pay?.text || '') || [])[1];
    ok('payEnabled', c2?.pay, !!c2 && !c2.pay.disabled && c2.pay.bg === 'rgb(0, 0, 0)' && c2.pay.fg === 'rgb(255, 255, 255)' && fee > 0 && !c2.why); await shot('card-pay');
    await tap('#impPay'); await wait(() => /Drive/.test(document.getElementById('driveBtn').textContent) && getComputedStyle(document.getElementById('driveBtn')).display !== 'none', 1500);
    const r2 = await rover(); ok('paidAndSummoned', { fee, ...r2 }, !r2.impounded && r2.cr === 5000 - fee && r2.near && r2.dist <= 5.6 && !r2.inLot && /Drive/.test(r2.drive) && !(await card()));
    ok('menuLabelCleared', await G(() => document.getElementById('rmSummon').textContent), !/impounded/.test(await G(() => document.getElementById('rmSummon').textContent)));
    await sleep(2500); const r3 = await rover(); ok('staysOut', r3, r3.near && !r3.inLot); await shot('paid-summoned');
    await G(() => document.getElementById('driveBtn').click()); ok('drives', await wait(() => window.__app.surface.info.driving, 3000), true);
    ok('pageErrors', errs, !errs.length);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 160)); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag); await b.close(); process.exit(bad.length ? 1 : 0);
})();
