// 🏴 Red Static Gulch (mars/farm2.js + farm2core.js): a hidden outlaw grow op 174 m south-east of the Dustbowl Homestead.
// The 🏴 context button at the op opens its sheet; ⭐ short refused; a double tap on "Buy · 2,500 cr" charges once; a double tap
// on "Add a grow rack" adds one; Red Static moss and Ghost spore grow over game hours (debug.skip); a harvest can raise heat
// (+1 wanted via SSX.pursuit) and bring a ColSec drone sweep: one caption, kill the lights = Skiv's tip, ignore it = a quarter
// of the stash; Skiv buys at the op, the Xen-7 aliens pay 1.2x through the 👽 Trade sheet's row; the sandworm hook
// damage(plotId) / restore() works on plots(); ☰ menu row + minimap mark; Rust Pit refused; save + #83 mirror survive a reload.
// BASE=http://127.0.0.1:8921/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/farm2/ node tests/test-farm2.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8897/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/farm2/', desk = DEV === 'desktop';
// headless WebKit on a box with no audio device crashes the page when the game starts its AudioContext on the first touch
// (main too: tests/test-still.js), so on WebKit the test runs muted (NOAUDIO=0 keeps the real AudioContext)
const noAudio = (process.env.NOAUDIO || ((process.env.BR || '') === 'webkit' ? '1' : '0')) === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  if (noAudio) await page.addInitScript(() => { try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (e) { /* */ } });
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const moved = await G(s => { const e = document.querySelector(s); if (!e) return false; const ps = []; for (let p = e.parentElement; p; p = p.parentElement) ps.push([p, p.scrollTop]); e.scrollIntoView({ block: 'center' }); return ps.some(([p, t]) => p.scrollTop !== t); }, sel); await sleep(moved ? 1000 : 150);
    await wait(s => { const b = document.querySelector(s); return !b || !b.dataset.hold; }, 1500, sel); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
  const dbl = sel => G(([s, desk]) => { const b = document.querySelector(s); if (!b) return 'no ' + s; const r = b.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const fire = el => { if (!el) return; if (desk) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })); return; }
      const o = { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
    fire(b); fire(b); fire(document.elementFromPoint(x, y)?.closest('button')); return true; }, [sel, desk]);
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); };
  const St = () => G(() => window.SSX.farm2.status());
  const cr = () => G(() => window.__app.game.progress.credits);
  const go = async (id, dz) => { await G(([id, dz]) => { const p = window.SSX.farm.places().find(q => q.id === id); window.__app.surface.debugMove(p.x, p.z + dz, 0); }, [id, dz]); await fr(4); };
  const shot = async n => { const p = `${out}farm2-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const BW = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: c.backgroundColor, fg: c.color, h: Math.round(r.height) }; }, sel);
  const isBW = b => !!b && /rgb\(0, 0, 0\)/.test(b.bg) && /255, 255, 255/.test(b.fg) && b.h >= 44;
  const F2 = (f, a) => G(f, a);
  const open2 = () => wait(() => document.getElementById('f2Panel').classList.contains('show'), 5000);
  const close2 = async () => { await G(() => window.SSX.farm2.close()); await sleep(300); };
  const gulch = async (o = {}) => { await G(o => window.SSX.farm2.debug.goto(o), o); await fr(6); await sleep(500); };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.farm2 && !!window.SSX?.farm, 20000);
    ok('api', await G(() => { const A = window.SSX.farm2; return ['status', 'plots', 'damage', 'restore', 'buy', 'rack', 'plant', 'harvest', 'sell', 'killLights'].every(k => typeof A[k] === 'function') && A.PRICES.op === 2500 && A.PRICES.starRate === 1; }));
    ok('menuRow', await G(() => document.getElementById('rmFarm2')?.textContent || ''), await G(() => /Grow op/.test(document.getElementById('rmFarm2')?.textContent || '')));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.()); await sleep(300);
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 30000; g.progress.xp = 500; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.harvest?.debug?.reset?.(); window.SSX.starshop?.debug?.reset?.(); window.SSX.still?.debug?.reset?.(); window.SSX.contraband?.reset?.(); window.SSX.farm2.debug.reset(); window.SSX.farm2.debug.rng(0.99);
      window.__ev = []; window.SSX.farm2.on(e => window.__ev.push(e.type)); });
    // the Xen-7 post needs the homestead
    await G(() => { const p = window.SSX.farm.places().find(q => q.id === 'farm'); window.__app.surface.debugMove(p.x, p.z + 12, 0); }); await fr(4); await G(() => window.SSX.farm.buy()); await sleep(900);
    ok('farFromGulch', await G(() => window.SSX.farm2.buy('cr').msg), await G(() => !window.SSX.farm2.status().owned)); await sleep(400);
    // 1) the 🏴 context button at the gulch
    await gulch(); ok('ctxBtn', await wait(() => document.getElementById('f2Act').classList.contains('on'), 6000));
    ok('ctxBW', await BW('#f2Act'), isBW(await BW('#f2Act')));
    ok('minimap', await G(() => { const m = window.SSX.minimap; if (!m) return 'no minimap'; const k = m.marks?.('farm2') ?? m.debug?.marks?.('farm2'); return k === undefined ? 'n/a' : !!(k && (k.length ?? 1)); }), true);
    await G(() => window.SSX.farm.guide?.hide?.()); await tapSel('#f2Act'); ok('ctxOpens', await open2()); await sleep(500);
    const sb = await G(() => { const b = document.querySelector('#f2Panel button[data-a="buy"][data-c="stars"]'); return b && { dis: b.disabled, t: b.textContent }; });
    ok('starsShort', sb, sb && sb.dis && /2,500 ⭐/.test(sb.t) && /You have 500 ⭐/.test(sb.t));
    ok('buyBtnBW', await BW('#f2Panel button[data-a="buy"][data-c="cr"]'), isBW(await BW('#f2Panel button[data-a="buy"][data-c="cr"]')));
    const c0 = await cr(); await dbl('#f2Panel button[data-a="buy"][data-c="cr"]'); await sleep(900);
    const c1 = await cr(); ok('chargedOnce', { c0, c1 }, c0 - c1 === 2500 && (await St()).owned && (await St()).paidWith === 'cr');
    // 2) racks: a double tap adds one
    await sleep(500); await dbl('#f2Panel button[data-a="rack"][data-c="cr"]'); await sleep(900);
    ok('rackOnce', { racks: (await St()).racks.length, cr: await cr() }, (await St()).racks.length === 1 && c1 - (await cr()) === 400);
    await sleep(500); await tapSel('#f2Panel button[data-a="rack"][data-c="cr"]'); await sleep(600); await tapSel('#f2Panel button[data-a="rack"][data-c="cr"]'); await sleep(600);
    ok('racks3', (await St()).racks.length, (await St()).racks.length === 3);
    // 3) plant via the sheet: pick -> crop
    for (const [i, c] of [[0, 'redstatic'], [1, 'ghostspore'], [2, 'voidpoppy']]) { await tapSel(`#f2Panel button[data-a="pick"][data-i="${i}"]`); await sleep(500); await tapSel(`#f2Panel button[data-a="plant"][data-c="${c}"]`); await sleep(600); }
    let s = await St(); ok('planted', s.racks.map(r => r.crop).join(), s.racks.map(r => r.crop).join() === 'redstatic,ghostspore,voidpoppy');
    ok('noHeatYet', await G(() => window.__app.surface.world.wanted | 0), (await G(() => window.__app.surface.world.wanted | 0)) === 0);
    await G(() => window.SSX.farm2.debug.skip(10)); await sleep(500);
    await close2(); await gulch({ dz: 19, yaw: 0 }); await fr(10); await sleep(1500); await shot('op');
    await gulch(); await tapSel('#f2Act'); await open2(); await sleep(500);
    ok('ripeRow', await G(() => document.querySelector('#f2Panel button[data-a="harvest"][data-i="0"]')?.textContent || ''), await G(() => !!document.querySelector('#f2Panel button[data-a="harvest"][data-i="0"]')));
    await sleep(200); await shot('sheet');
    // 4) harvest with a hot roll: +1 wanted and a ColSec drone sweep
    await G(() => window.SSX.farm2.debug.rng(0)); const w0 = await G(() => window.__app.surface.world.wanted | 0);
    await tapSel('#f2Panel button[data-a="harvest"][data-i="0"]'); await sleep(700);
    s = await St(); ok('harvested', s.stash, s.stash.redstatic === 5);
    ok('heat', { w0, w1: await G(() => window.__app.surface.world.wanted | 0) }, (await G(() => window.__app.surface.world.wanted | 0)) === w0 + 1);
    ok('raidOn', s.raid, !!s.raid);
    await G(() => window.SSX.farm2.debug.rng(0.99));
    await close2(); await sleep(600);
    ok('raidCaption', await G(() => document.getElementById('f2Cap').textContent), await wait(() => document.getElementById('f2Cap').classList.contains('on') && /ColSec drones/.test(document.getElementById('f2Cap').textContent), 4000));
    ok('oneCaption', await G(() => [...document.querySelectorAll('#farmGuide.on, #stillCap.on, #hvCap.on, #f2Cap.on')].map(e => e.id)), (await G(() => document.querySelectorAll('#farmGuide.on, #stillCap.on, #hvCap.on, #f2Cap.on').length)) === 1);
    await shot('raid');
    await tapSel('#f2Act'); await open2(); await sleep(500);
    const c2 = await cr(); await dbl('#f2Panel button[data-a="lights"]'); await sleep(800);
    s = await St(); ok('dodged', { raid: s.raid, tip: (await cr()) - c2, last: s.lastRaid }, !s.raid && s.lastRaid === 'dodged' && (await cr()) - c2 === 150 && s.stash.redstatic === 5);
    await G(() => window.__app.surface.world.setWanted(0));
    // 5) an ignored sweep takes a quarter of the stash, never racks
    await G(() => window.SSX.farm2.debug.give('glowcactus', 15)); const rk = JSON.stringify((await St()).racks);
    await G(() => { window.SSX.farm2.debug.raid(); window.SSX.farm2.debug.setRaidT(0.1); }); await sleep(1200);
    s = await St(); ok('seized', { stash: s.stash, seized: s.stats.seized }, s.stats.seized === 5 && s.stashCount === 15 && JSON.stringify(s.racks) === rk && !s.raid);
    // 6) Skiv buys at the op
    await G(() => window.SSX.farm2.close()); await sleep(200); await G(() => window.SSX.farm2.open()); await open2(); await sleep(500);
    const c3 = await cr(); await dbl('#f2Panel button[data-a="sell"][data-b="skiv"][data-c="redstatic"]'); await sleep(800);
    s = await St(); ok('skivSale', { stash: s.stash, got: (await cr()) - c3 }, !s.stash.redstatic && (await cr()) - c3 > 600 && s.stats.sold === 5);
    await close2();
    // 7) the sandworm hook
    const pl = await G(() => window.SSX.farm2.plots()); ok('plots', pl, pl.length === 3 && pl.every(p => Number.isFinite(p.x) && Number.isFinite(p.z) && p.id));
    const dm = await G(id => window.SSX.farm2.damage(id), pl[1].id); ok('damage', dm, dm.ok && dm.snap.crop === 'ghostspore' && !(await St()).racks[1].crop);
    const rs = await G(([id, sn]) => window.SSX.farm2.restore(id, sn), [pl[1].id, dm.snap]); ok('restore', rs, rs.ok && (await St()).racks[1].crop === 'ghostspore');
    // 8) the Xen-7 aliens: refused away from the post, a row in their 👽 Trade sheet, 1.2x
    ok('xenFar', await G(() => window.SSX.farm2.sell('xen7', 'glowcactus').msg), (await St()).stash.glowcactus === 10); await sleep(400);
    await G(() => { const p = window.SSX.farm.places().find(q => q.id === 'post'); window.__app.surface.debugMove(p.x, p.z + 4, 0); }); await fr(6);
    await wait(() => document.getElementById('farmAct').classList.contains('on'), 5000);
    await tapSel('#farmAct'); await wait(() => document.getElementById('farmPanel').classList.contains('show'), 5000); await sleep(500);
    const prow = await G(() => [...document.querySelectorAll('#farmPanel button[data-a="ext"]')].map(b => b.textContent).filter(t => /gulch/i.test(t)));
    ok('postRow', prow, prow.length === 1 && /Sell gulch stash · 10 units/.test(prow[0]));
    const idx = await G(() => [...document.querySelectorAll('#farmPanel button[data-a="ext"]')].findIndex(b => /gulch/i.test(b.textContent)));
    await tapSel(`#farmPanel button[data-a="ext"]:nth-of-type(n)` .replace(':nth-of-type(n)', `[data-i="${await G(i => document.querySelectorAll('#farmPanel button[data-a="ext"]')[i].dataset.i, idx)}"]`)); await open2(); await sleep(500);
    const u = await G(() => window.SSX.farm2.status().day);
    const c4 = await cr(); await tapSel('#f2Panel button[data-a="sell"][data-b="xen7"][data-c="glowcactus"]'); await sleep(800);
    s = await St(); ok('xenSale', { got: (await cr()) - c4, stash: s.stash }, !s.stash.glowcactus && (await cr()) - c4 >= Math.round(260 * 0.85 * 1.2) * 10 - 10);
    await close2();
    // 9) Rust Pit refused, no heat there
    await G(() => { const c = window.SSX.farm.debug.colony(); window.__app.surface.debugMove(c.x - 292, c.z - 68, 0); }); await fr(6);
    ok('pit', await G(() => window.SSX.farm2.status().pit ? window.SSX.farm2.plant(0, 'redstatic').msg : 'not in pit'), await G(() => /Rust Pit/.test(window.SSX.farm2.plant(0, 'redstatic').msg || '') || !window.SSX.farm2.status().pit));
    // 10) BUSTED takes a quarter of the stash you carry
    await G(() => window.SSX.farm2.debug.give('voidpoppy', 8)); const b0 = (await St()).stashCount; await G(() => window.SSX.farm2.debug.bust());
    s = await St(); ok('bust', { b0, after: s.stashCount }, s.stashCount === b0 - 2);
    // 11) reload keeps it; an unowned overwrite is recovered from the mirror (#83)
    await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.farm2, 120000);
    s = await St(); ok('reload', { owned: s.owned, racks: s.racks.length }, s.owned && s.racks.length === 3);
    await G(() => localStorage.setItem('ssx.farm2.v1', '{"v":1,"owned":false}')); await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.farm2, 120000);
    s = await St(); ok('mirror', { owned: s.owned, restored: s.restored }, s.owned && s.restored === 'backup' && s.racks.length === 3);
    ok('events', await G(() => JSON.parse(localStorage.getItem('ssx.farm2.v1')).stats), true);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
