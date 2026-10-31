// 🧱 Farm expansions (mars/farm.js + farmcore.js): ONE Expand row -> sub-list (domes + tanks, '… cr' and '… ⭐' buttons),
// dome 2 (2,500 cr) then dome 3 (6,000 cr / 6,000 ⭐), tanks 1,500 cr / 1,500 ⭐; double tap = one charge in one currency; short on
// stars / credits refused; Rust Pit refused; failed save refunded; 18 racks on 3 lots; hire + harvester on the new racks; reload keeps it.
// BASE=http://127.0.0.1:8897/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/expand/ node tests/test-expand.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8897/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/expand/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width, t: r.top, b: r.bottom, l: r.left, r: r.right }; }, sel);
  // tapSel waits (like a person would) until a button held by the sheet's settle window is tappable again
  // WebKit sends pointercancel (no tap) for a touch that lands right after a programmatic scroll, so when scrollIntoView moved the sheet we let it settle first
  const tapSel = async sel => { const moved = await G(s => { const e = document.querySelector(s); if (!e) return false; const ps = []; for (let p = e.parentElement; p; p = p.parentElement) ps.push([p, p.scrollTop]); e.scrollIntoView({ block: 'center' }); return ps.some(([p, t]) => p.scrollTop !== t); }, sel); await sleep(moved ? 1000 : 150); await wait(s => { const b = document.querySelector(s); return !b || !b.dataset.hold; }, 1500, sel); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
  // two taps in one frame: the same button twice, then whatever sits under that point now (a button that slid in after a re-render)
  const dbl = sel => G(([s, desk]) => { const b = document.querySelector(s); if (!b) return 'no ' + s; const r = b.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const fire = el => { if (!el) return; if (desk) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })); return; }
      const o = { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
    fire(b); fire(b); fire(document.elementFromPoint(x, y)?.closest('button')); return true; }, [sel, desk]);
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); };
  const St = () => G(() => window.SSX.farm.status());
  const cr = () => G(() => window.__app.game.progress.credits);
  const shown = () => G(() => document.getElementById('farmPanel').classList.contains('show'));
  const go = async (id, dz) => { await G(([id, dz]) => { const p = window.SSX.farm.places().find(q => q.id === id); window.__app.surface.debugMove(p.x, p.z + dz, 0); }, [id, dz]); await fr(4); };
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
  };
  const HS = () => G(() => window.SSX.harvest.status());
  // then: right after that FIRE, read the rack's crop depth and FIRE twice more ~0.5 s apart, all inside the page (no CDP gaps)
  const QUICK = `new Promise(res => { window.__d1 = window.__cropDepth(0); const f = () => window.__app.surface.game.fire(null), t0 = performance.now(); setTimeout(() => { f(); setTimeout(() => { f(); res([window.__d1, Math.round(performance.now() - t0)]); }, 520); }, 480); })`;
  const fire = async (o = {}) => { // the real FIRE button on phones (pointerdown), the game's fire() (mouse / F key path) on desktop
    const b = desk ? null : await center('#fireBtn');
    const q = o.then ? QUICK : 'null';
    const r = b ? await G(([x, y, q]) => { const el = document.elementFromPoint(x, y); const o = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); return (0, eval)(q); }, [b.x, b.y, q])
      : await G(q => { window.__app.surface.game.fire(null); return (0, eval)(q); }, q);
    if (o.then && r) { R.d1 = r[0]; R.quick = r[1]; }
    return !!b;
  };
  const ST = () => G(() => ({ bal: window.SSX.stars.balance(), life: window.SSX.stars.lifetime(), spent: window.SSX.stars.spent(), xp: window.__app.game.progress.xp, rank: window.__app.game.info?.rank }));
  const openSheet = async () => { await go('farm', 12); if (!(await shown())) await tapSel('#farmAct'); await wait(() => document.getElementById('farmPanel').classList.contains('show'), 8000); };
  const openExpand = async () => { await openSheet(); if (!(await G(() => !!document.querySelector('#farmPanel .xp')))) await tapSel('#farmPanel button[data-a="expand"]'); await wait(() => !!document.querySelector('#farmPanel .xp'), 5000); };
  const xb = (id, b) => `#farmPanel .xp[data-x="${id}"] button[data-b="${b}"]`;
  const look = async (x, z, yaw = 0) => { await G(([x, z, y]) => window.__app.surface.debugMove(x, z, y), [x, z, yaw]); await fr(8); await sleep(600); };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.harvest && !!window.SSX?.farm && !!window.SSX?.stars, 20000);
    ok('api', await G(() => typeof window.SSX.farm.expand === 'function' && window.SSX.farm.expansions().length === 5 && window.SSX.farm.STAR_RATE === 1));
    await land();
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 30000; g.progress.xp = 5000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.harvest.debug.reset(); window.SSX.starshop?.debug?.reset?.(); window.SSX.contraband?.reset?.();
      window.__fev = []; window.SSX.farm.on(e => window.__fev.push(e.type)); });
    await go('farm', 12);
    for (const f of ['buy', 'buildDome']) { await G(f => window.SSX.farm[f](), f); await sleep(900); }
    let fs = await St(); ok('start', fs.caps, fs.owned && fs.dome && fs.caps.racks === 6 && fs.exp.domes === 0);
    // the ONE Expand row, then the compact sub-list
    await openSheet(); const row = await G(() => { const b = [...document.querySelectorAll('#farmPanel button[data-a="expand"]')]; return { n: b.length, t: b[0]?.textContent }; });
    ok('expandRow', row, row.n === 1 && /Expand/.test(row.t) && /Domes 1\/3/.test(row.t));
    await tapSel('#farmPanel button[data-a="expand"]'); await sleep(400);
    const L = await G(() => { const rows = [...document.querySelectorAll('#farmPanel .xp')]; const bs = [...document.querySelectorAll('#farmPanel .xp button')];
      return { rows: rows.map(r => r.dataset.x + ':' + r.querySelector('b').textContent + '|' + r.querySelectorAll('button').length + '|' + [...r.querySelectorAll('button')].map(b => b.textContent).join('/')), tags: rows.map(r => r.querySelector('.tag')?.textContent || ''),
        style: bs.every(b => { const s = getComputedStyle(b), r = b.getBoundingClientRect(); return s.backgroundColor === 'rgb(0, 0, 0)' && (b.disabled || s.color === 'rgb(255, 255, 255)') && r.height >= 44; }), head: document.querySelector('#farmPanel .sub')?.textContent,
        dis: bs.filter(b => b.disabled).map(b => b.closest('.xp').dataset.x + ':' + b.dataset.b) }; });
    ok('expandList', L, L.rows.length === 5 && L.rows[0].includes('2,500 cr/2,500 ⭐') && L.rows[1].includes('6,000 cr/6,000 ⭐') && L.rows.slice(2).every(r => r.includes('1,500 cr/1,500 ⭐')) && L.style && /1 cr = 1 ⭐/.test(L.head)
      && L.tags[0] === '⭐ next' && /later/.test(L.tags[1]) && L.dis.includes('dome3:cr') && L.dis.includes('dome3:stars') && !L.dis.includes('dome2:stars') && !L.dis.includes('dome2:cr'));
    if (!desk) await page.screenshot({ path: out + `expand-list-${tag}.png` });
    // dome 2 with credits: double tap = one 2,500 charge, no stars touched
    let s0 = await ST(), c0 = await cr();
    await dbl(xb('dome2', 'cr')); await sleep(500); await dbl(xb('dome2', 'cr')).catch(() => {}); await sleep(400);
    fs = await St(); let s1 = await ST();
    ok('dome2Once', { fee: c0 - await cr(), caps: fs.caps, stars: s0.bal - s1.bal }, c0 - await cr() === 2500 && fs.exp.domes === 1 && fs.caps.racks === 12 && s1.bal === s0.bal);
    ok('dome2Placed', await G(() => window.SSX.farm.status().base ? window.SSX.farm.status().base.pieces.some(p => p.plot === 'farm-annex-1' && p.type === 'farm-dome') : !!window.__app.surface.scene.getObjectByName('farm-dome-2')));
    // dome 3 in stars: short first (5,000 ⭐ < 6,000), refused, nothing taken
    s0 = await ST(); const short = await G(() => window.SSX.farm.expand('dome3', 'stars')); s1 = await ST();
    ok('starsShort', { short, s0, s1 }, !short.ok && s1.bal === s0.bal && s1.spent === s0.spent && (await St()).exp.domes === 1);
    await G(() => { const g = window.__app.game; g.progress.xp = 45000; g.save(); }); await sleep(900);
    await G(() => window.SSX.farm.open?.()); await openExpand();
    s0 = await ST(); c0 = await cr();
    const dis3 = await G(s => document.querySelector(s)?.disabled, xb('dome3', 'stars')); await dbl(xb('dome3', 'stars')); await sleep(500); s1 = await ST(); fs = await St();
    ok('dome3Stars', { dis3, s0, s1, fee: c0 - await cr(), caps: fs.caps }, dis3 === false && s0.bal - s1.bal === 6000 && s1.spent - s0.spent === 6000 && s1.xp === s0.xp && s1.life === s0.life && s1.rank === s0.rank && c0 === await cr() && fs.exp.domes === 2 && fs.caps.racks === 18);
    ok('starsKey', await G(() => JSON.parse(localStorage.getItem('ssx.stars.v1') || '{}').spent === 6000 && !Object.keys(localStorage).some(k => /expan/i.test(k))));
    // Rust Pit: refused, nothing charged
    await G(() => window.SSX.farm.close?.()); await G(() => { const c = window.__app.surface.info.colony || window.__app.surface.world.colony; window.__app.surface.debugMove(c.x - 292, c.z - 68, 0); }); await fr(6); await sleep(400);
    c0 = await cr(); s0 = await ST(); const pit = await G(() => window.SSX.farm.expand('water', 'cr')); const pitS = await G(() => window.SSX.farm.expand('water', 'stars'));
    ok('pitRefused', { pit, pitS }, !pit.ok && !pitS.ok && c0 === await cr() && (await ST()).bal === s0.bal && !(await St()).exp.water);
    await go('farm', 12);
    // a failed save (storage full) refunds: credits, and stars (a forced failure)
    c0 = await cr(); const fail = await G(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'ssx.farm.v1') throw new Error('QuotaExceededError'); return o.call(this, k, v); }; try { return window.SSX.farm.expand('water', 'cr'); } finally { Storage.prototype.setItem = o; } });
    ok('refundCr', { fail, fee: c0 - await cr() }, !fail.ok && fail.refunded === 1500 && c0 === await cr() && !(await St()).exp.water);
    await sleep(900); s0 = await ST(); const failS = await G(() => { window.SSX.farm.debug.failNextExpand(); return window.SSX.farm.expand('power', 'stars'); }); s1 = await ST();
    ok('refundStars', { failS, s0, s1 }, !failS.ok && failS.refunded === 1500 && s1.bal === s0.bal && s1.spent === s0.spent && !(await St()).exp.power);
    // tanks: water (cr, tap), power (⭐, tap), silo (cr): each doubles its cap
    await sleep(900); await openExpand(); c0 = await cr(); s0 = await ST();
    for (const [id, b] of [['water', 'cr'], ['power', 'stars'], ['silo', 'cr']]) { await tapSel(xb(id, b)); await dbl(xb(id, b)).catch(() => {}); await wait(id => window.SSX.farm.status().exp[id] === true, 8000, id); await sleep(600); }
    fs = await St(); s1 = await ST();
    ok('tanks', { caps: fs.caps, fee: c0 - await cr(), stars: s0.bal - s1.bal }, fs.caps.water === 200 && fs.caps.power === 200 && fs.caps.silo === 240 && c0 - await cr() === 3000 && s0.bal - s1.bal === 1500 && s1.xp === s0.xp && s1.rank === s0.rank);
    const L2 = await G(() => [...document.querySelectorAll('#farmPanel .xp')].map(r => (r.querySelector('.tag')?.textContent || '') + '|' + r.querySelectorAll('button').length));
    ok('allOwned', L2, L2.length === 5 && L2.every(t => t === '✅ owned|0'));
    const again = await G(() => window.SSX.farm.expand('dome2', 'stars')); ok('ownedRefused', again, !again.ok && (await ST()).bal === s1.bal);
    if (!desk) await page.screenshot({ path: out + `expand-owned-${tag}.png` });
    await tapSel('#farmPanel button[data-a="back"]'); await sleep(300);
    // 18 racks: fill the three domes, the 19th is refused
    await G(() => window.SSX.farm.close?.());
    for (let i = 0; i < 18; i++) { const r = await G(() => window.SSX.farm.addRack()); if (!r.ok) { R.rackFail = [i, r]; break; } await sleep(900); }
    const r19 = await G(() => window.SSX.farm.addRack()); fs = await St();
    ok('racks18', { n: fs.racks.length, r19, rackFail: R.rackFail }, fs.racks.length === 18 && !r19.ok);
    const sp = await G(() => window.SSX.farm.rackSpots()); const lots = [0, 1, 2].map(n => sp.filter(s => s.lot === n).length);
    const far = await G(() => { const p = window.SSX.farm.places().find(q => q.id === 'farm'); return Math.max(...window.SSX.farm.rackSpots().map(s => Math.hypot(s.x - p.x, s.z - p.z))); });
    ok('rackLots', { lots, far: +far.toFixed(1) }, lots.join() === '6,6,6' && new Set(sp.map(s => Math.round(s.x) + ',' + Math.round(s.z))).size === 18);
    // collisions: nothing of ours overlaps the silo pad or the harvester parking
    ok('clear', await G(() => { const H = window.SSX.harvest.status(), s = H.silo, sp = window.SSX.farm.rackSpots(); return sp.every(r => Math.hypot(r.x - s.x, r.z - s.z) > 3) && (!H.rover?.spot || sp.every(r => Math.hypot(r.x - H.rover.spot.x, r.z - H.rover.spot.z) > 3)); }));
    await G(() => { const F = window.SSX.farm; for (let i = 0; i < 18; i++) F.plant(i, i % 3 === 1 ? 'algae' : 'potato'); F.refill('water'); F.refill('power'); F.skip(10); F.refill('water'); F.refill('power'); });
    fs = await St(); ok('ripe18', fs.racks.filter(r => r.ripe).length, fs.racks.every(r => r.ripe));
    // the three domes (daylight), each shot from the south of its lot
    await G(() => { try { window.SSX.time?.set?.(13); } catch (e) { /* */ } });
    if (!desk) for (let n = 0; n < 3; n++) { const a = sp.filter(s => s.lot === n); const cx = a.reduce((t, s) => t + s.x, 0) / a.length, dz = a[0].z - 11; if (n === 0) await look(cx, a[0].z + 9, 0); else if (n === 1) await look(cx - 15, dz + 2, -Math.PI / 2 + 0.15); else await look(cx + 15, dz + 2, Math.PI / 2 - 0.15); await page.screenshot({ path: out + `expand-dome${n + 1}-${tag}.png` }); }
    if (!desk) { const p = await G(() => window.SSX.farm.places().find(q => q.id === 'farm')); await look(p.x + 4, p.z + 26, 0.15); await page.screenshot({ path: out + `expand-all-${tag}.png` }); }
    // hire a hand: every ripe rack, the new ones included
    const sb = Object.values((await St()).silo).reduce((a, b) => a + b, 0);
    await G(() => window.SSX.farm.close?.()); await openSheet(); c0 = await cr(); await dbl('#farmPanel button[data-a="harvestAll"]'); await sleep(450);
    let h = await HS(); ok('hire18', { jobs: h.jobs.length, fee: c0 - await cr() }, h.jobs.length === 18);
    await tapSel('#farmPanel button[data-a="close"]'); await G(() => window.SSX.harvest.debug.rush()); fs = await St();
    const sa = Object.values(fs.silo).reduce((a, b) => a + b, 0);
    ok('hireDone', { sb, sa, crops: fs.racks.filter(r => r.crop).length }, fs.racks.every(r => !r.crop) && sa - sb >= 6 * 12 + 8 * 6 - 1 && sa <= 240);
    // sickle on an annex rack (lot 3)
    await G(() => { const F = window.SSX.farm; F.plant(12, 'potato'); F.plant(6, 'potato'); F.plant(7, 'potato'); F.plant(13, 'potato'); F.refill('water'); F.refill('power'); F.skip(10); F.refill('water'); F.refill('power'); });
    const r12 = sp[12]; await look(r12.x, r12.z + 2.2, 0); h = await HS();
    ok('sickleAnnex', { near: h.near, act: h.ui.act }, h.near === 12 && /Cut/.test(h.ui.act || ''));
    for (let t = 0; t < 6 && (await St()).racks[12].crop; t++) { await tapSel('#hvAct'); await sleep(700); } h = await HS(); fs = await St();
    ok('sickleCut', { carry: h.carryN, left: fs.racks[12].crop }, h.carryN >= 6 && !fs.racks[12].crop);
    await G(() => window.SSX.harvest.debug.reset?.()); await sleep(300);
    // the harvester over annex racks 6, 7 (north lot) and 13 (north-east lot)
    await G(() => { window.__app.game.progress.credits += 5000; }); const hb = await G(() => window.SSX.harvest.buyHarvester()); await sleep(600); h = await HS();
    ok('hvBought', hb, hb.ok && h.rover.owned);
    const hs = h.rover.spot; await look(hs.x + 2.6, hs.z, Math.PI / 2); await sleep(700);
    let ctxA = null; for (let t = 0; t < 12 && !ctxA; t++) { ctxA = await G(() => { const a = window.__dealer?.myrides?.ctxAction?.(); if (!a) return null; const l = a.label; a.act(); return l; }); if (!ctxA) await sleep(800); } await fr(10); await sleep(500);
    h = await HS(); ok('drive', ctxA, h.rover.driving);
    // header from the east side (yaw +90°), driving west along each annex row
    for (const i of [6, 7, 13]) { const r = sp[i]; for (const [dx, yaw] of [[3.3, Math.PI / 2], [-3.3, -Math.PI / 2]]) { // east side first, then the west side
      await G(([x, z, y]) => window.__app.surface.debugMove(x, z, y), [r.x + dx, r.z, yaw]); R['cut' + i] = await wait(i => !window.SSX.farm.status().racks[i].crop, desk ? 30000 : 20000, i); if (R['cut' + i]) break; } }
    await fr(4); h = await HS(); fs = await St();
    ok('harvesterAnnex', { hopper: h.hopperN, left: [6, 7, 13].map(i => fs.racks[i].crop) }, h.hopperN >= 15 && [6, 7, 13].every(i => !fs.racks[i].crop));
    await G(() => { if (window.__app.surface.info.driving) window.__app.surface.interact(); }); await fr(4); await sleep(1200);
    // reload: all expansions, 18 racks and the star spend survive
    const before = await G(() => ({ exp: window.SSX.farm.status().exp, n: window.SSX.farm.status().racks.length, stars: window.SSX.stars.spent() }));
    await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading') && !!window.SSX?.farm && !!window.SSX?.stars, 120000); await sleep(1500);
    const after = await G(() => ({ exp: window.SSX.farm.status().exp, n: window.SSX.farm.status().racks.length, caps: window.SSX.farm.status().caps, stars: window.SSX.stars.spent() }));
    ok('reload', { before, after }, JSON.stringify(after.exp) === JSON.stringify(before.exp) && after.n === 18 && after.caps.racks === 18 && after.caps.silo === 240 && after.stars === before.stars && before.stars === 7500);
    await land(); await fr(10); await sleep(1500); fs = await St();
    ok('reloadLots', { n: fs.racks.length, base: fs.base && fs.base.lots }, fs.racks.length === 18 && (!fs.base || fs.base.lots.length === 3) && (await G(() => window.SSX.farm.rackSpots().length)) === 18);
    ok('events', await G(() => window.__fev?.filter(t => /expand/.test(t)) || []), true);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
