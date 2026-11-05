// ⭐ Star Shop e2e (mars/starshop.js): on Mars with 3,800 ⭐, buy contraband with stars from ☰ → ⭐ Star Shop and from Blue's sheet.
// Checks: balance shown, spend lowers the spendable balance but not progress.xp or the rank, a double tap charges once,
// can't overspend (button disabled + API refuses), stash gets the unit, persistence across reload, refused in the Rust Pit,
// 44px+ targets, black buttons with white text, 0 console errors. Phone runs save screenshots (starshop-<n>-<step>-<tag>.png).
// BASE=http://127.0.0.1:8913/ BR=webkit DEV="iPhone 14" OUT=./shots/starshop/ node tests/test-starshop.js  (one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8913/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/starshop/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV], ...(DEV === 'iPhone 14' ? { viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 } } : {}) };
  if (BR !== 'chromium') delete dev.defaultBrowserType;
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); };
  const box = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; const cs = getComputedStyle(e);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, bg: cs.backgroundColor, fg: cs.color, dis: e.disabled }; }, sel);
  const ready = sel => wait(s => { const b = document.querySelector(s); return b && !b.dataset.hold; }, 3000, sel);
  const press = async (b, n = 1) => { for (let k = 0; k < n; k++) { if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); if (k + 1 < n) await sleep(40); } };
  const tapSel = async (sel, n = 1) => { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(450); await ready(sel); const b = await box(sel); if (!b) throw new Error('no ' + sel); await press(b, n); await sleep(250); return b; };
  let shotN = 0; const shot = async name => { if (desk) return; await fr(3); const f = `starshop-${++shotN}-${name}-${tag}.png`; await page.screenshot({ path: out + f }); (R.shots ||= []).push(out + f); };
  const st = () => G(() => window.SSX.starshop.status());
  const xp = () => G(() => ({ xp: window.__app.game.progress.xp, rank: window.__app.game.info.rank }));
  const qty = id => G(i => window.SSX.contraband.stash().items[i]?.qty || 0, id);
  const moveAJ = (dx, dz) => G(([dx, dz]) => { const c = window.__app.surface.info.colony; window.__app.surface.debugMove(c.x + dx, c.z + dz, 0); }, [dx, dz]);
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
  };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.stars && !!window.SSX?.starshop && !!window.SSX?.contraband, 20000);
    R.offMarsBlocked = await G(() => window.SSX.starshop.buy('lowg')); ok('offMars', R.offMarsBlocked, !R.offMarsBlocked.ok && /Mars/.test(R.offMarsBlocked.msg));
    await land();
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.xp = 3800; g.progress.credits = 500; g.save(); window.__app.surface.world.setWanted(0); window.SSX.contraband.reset(); window.SSX.starshop.debug.reset(); });
    await moveAJ(-40, 60); await fr(4);
    const x0 = await xp(); ok('start', { ...x0, bal: (await st()).balance }, x0.xp === 3800 && (await st()).balance === 3800);
    ok('menuItem', await G(() => !!document.getElementById('rmStarShop') && /Star Shop/.test(document.getElementById('rmStarShop').textContent)));
    // ☰ → ⭐ Star Shop (tap the real menu button)
    await G(() => document.getElementById('rmStarShop').scrollIntoView({ block: 'center' }));
    await G(() => { const m = document.getElementById('rmStarShop'); m.click(); });
    await wait(() => document.getElementById('ssPanel')?.classList.contains('show'), 3000);
    ok('balanceShown', await G(() => document.getElementById('ssBal')?.textContent), /3,800 stars to spend/.test(await G(() => document.getElementById('ssBal')?.textContent || '')));
    await ready('#ssPanel button[data-ss="glowdust"]'); const bb = await box('#ssPanel button[data-ss="glowdust"]');
    ok('size44', bb, bb && bb.h >= 44 && bb.w >= 44);
    ok('blackWhite', bb, bb && bb.bg === 'rgb(0, 0, 0)' && bb.fg === 'rgb(255, 255, 255)');
    await shot('open');
    // double tap the Glow-dust button: charged once
    await tapSel('#ssPanel button[data-ss="glowdust"]', 2); await sleep(400);
    let s = await st(), x1 = await xp();
    ok('doubleTapOnce', { s: { bal: s.balance, spent: s.spent }, q: await qty('glowdust') }, s.spent === 250 && s.balance === 3550 && (await qty('glowdust')) === 1);
    ok('xpUnchanged', x1, x1.xp === 3800 && x1.rank === x0.rank);
    ok('msg', await G(() => document.getElementById('ssMsg').textContent), /Bought 1 Glow-dust for 250 ⭐/.test(await G(() => document.getElementById('ssMsg').textContent)));
    ok('balanceUpdated', /3,550 stars/.test(await G(() => document.getElementById('ssBal').textContent)));
    ok('creditsUntouched', await G(() => window.__app.game.progress.credits === 500));
    await shot('bought');
    // API double call: second is a dup
    const a2 = await G(() => [window.SSX.starshop.buy('lowg'), window.SSX.starshop.buy('lowg')]);
    ok('apiDup', a2, a2[0].ok && a2[1].dup && (await st()).spent === 450);
    // can't overspend: 3,800 lifetime - 450 = 3,350; spend down to 100 then Void Honey (600) is refused
    await G(() => window.SSX.stars.spend(3250, 'test'));
    await G(() => window.SSX.starshop.render());
    s = await st(); ok('low', s.balance, s.balance === 100);
    const vb = await box('#ssPanel button[data-ss="voidhoney"]'); ok('disabledWhenShort', vb, vb && vb.dis);
    ok('needMoreText', await G(() => document.querySelector('#ssPanel button[data-ss="voidhoney"]').textContent), /Need 500 more ⭐/.test(await G(() => document.querySelector('#ssPanel button[data-ss="voidhoney"]').textContent)));
    const ov = await G(() => window.SSX.starshop.buy('voidhoney')); ok('overspendRefused', ov, !ov.ok && (await st()).balance === 100 && (await qty('voidhoney')) === 0);
    ok('rankAfter', await xp(), (await xp()).xp === 3800 && (await xp()).rank === x0.rank);
    await shot('short');
    await tapSel('#ssClose');
    // Blue's sheet: a ⭐ price next to Buy 1 / Buy 5
    await G(() => { window.SSX.stars.refund(3250); });
    const sup = await G(() => window.SSX.contraband.supplier.at); await moveAJ(sup[0], sup[1] + 2);
    await wait(() => window.SSX.contraband.near?.kind === 'sup', 20000);
    await G(() => window.SSX.contraband.open('sup')); await sleep(300);
    const star = await box('#cbPanel button.ssStar[data-ss="redstatic"]');
    ok('blueStarBtn', star, star && star.h >= 44 && star.bg === 'rgb(0, 0, 0)' && star.fg === 'rgb(255, 255, 255)');
    ok('blueBalance', await G(() => document.querySelector('#cbPanel .ssBal')?.textContent), /3,350 stars to spend/.test(await G(() => document.querySelector('#cbPanel .ssBal')?.textContent || '')));
    await shot('blue');
    await tapSel('#cbPanel button.ssStar[data-ss="redstatic"]', 2); await sleep(400);
    s = await st(); ok('blueBuyOnce', { spent: s.spent, q: await qty('redstatic') }, s.spent === 850 && (await qty('redstatic')) === 1);
    ok('blueMsg', await G(() => document.getElementById('cbMsg').textContent), /Red Static for 400 ⭐/.test(await G(() => document.getElementById('cbMsg').textContent)));
    ok('blueRedrawn', await G(() => document.querySelectorAll('#cbPanel button.ssStar').length >= 4 && /2,950 stars/.test(document.querySelector('#cbPanel .ssBal')?.textContent || '')));
    await shot('blue-bought');
    await G(() => window.SSX.contraband.close());
    // Rust Pit: refused
    await moveAJ(-292, -68); await fr(4);
    const pit = await G(() => ({ inPit: window.SSX.starshop.debug.inPit(), r: window.SSX.starshop.buy('lowg') }));
    ok('pitRefused', pit, pit.inPit && !pit.r.ok && /Rust Pit/.test(pit.r.msg) && (await st()).spent === 850);
    // persistence
    await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.starshop && !!window.__app?.game?.progress, 120000); await sleep(500);
    s = await st(); ok('persist', s, s.spent === 850 && s.balance === 2950 && s.lifetime === 3800);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
