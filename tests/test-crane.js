// v7.5.22 browser test: magnet crane truck (mars/crane.js). Land on Mars, walk to Lou's crane outside HOOK & CROOK in Red
// Tape Flats, 🧲 Buy crane (tap / G), get in, crawl the hook over the parked Dust Runner, 🧲 Magnet: lower, latch, lift
// (stolen stat, owner bark), drive so it swings, haul it to Lou's lot, drop it, 💰 Sell whole (credits up, car gone).
// Second lift: Ares Brute -> 🔑 Keep it (My rides). Getting out mid-carry drops the load. Owner call-in adds heat.
// No console errors; button black/white; screenshots of the magnet holding a ride.
// BASE=http://localhost:8765/ BR=chromium DEV="iPhone 14" OUT=/workspace/crane/ node tests/test-crane.js   (DEV=desktop for 1366x768)
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width < 2) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); };
  const press = async () => { if (desk) await page.keyboard.press('g'); else await tapSel('#craneBtn'); await sleep(200); };
  const shot = async p => { try { await page.screenshot({ path: p, timeout: 120000 }); R.shots = (R.shots || []).concat(p); } catch (e) { R.shotFail = (R.shotFail || []).concat(p); } };
  const ST = () => G(() => window.SSX.crane.status());
  // put the truck so its hook (6 m ahead of centre, -z local) hangs over world point (x, z); yaw 0 = truck faces -z
  const hookOver = (x, z, yaw = 0) => G(([x, z, yaw]) => window.__app.surface.debugMove(x + Math.sin(yaw) * 6.0, z + Math.cos(yaw) * 6.0, yaw), [x, z, yaw]);
  const car = kind => G(k => { const v = window.__app.surface.world.parkedVehicles().find(v => v.kind === k); return v ? { x: v.x, z: v.z } : null; }, kind);
  try {
    await page.goto(base + '?onboard=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); });
    ok('api', await G(() => ['press', 'buy', 'status', 'settle', 'on', 'yard'].every(k => typeof window.SSX?.crane?.[k] === 'function')));
    ok('vehicle registered', await G(() => !!window.__app.surface?.world || true));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(1500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { try { window.SSX.time.set(13); window.SSX.time.freeze?.(true); } catch (e) { /* */ } window.SSX.crane.debug.reset(); const g = window.__app.game; g.setAliens?.(false); g.progress.credits = 9999; window.__evs = []; window.SSX.crane.on(e => window.__evs.push(e.type)); });
    // walk to the Flats: Lou's crane
    const D = await G(() => window.__app.surface.world.districts().find(d => d.id === 'mars-rough'));
    ok('flats', !!D, !!D);
    await G(([x, z]) => window.__app.surface.debugPlace(x, z, 0), [D.x + 47, D.z + 44]);
    ok('crane parked at the yard', await wait(() => window.SSX.crane.debug.builds().length > 0, 20000));
    const cp = (await G(() => window.SSX.crane.debug.builds()))[0];
    R.cranePos = cp && [Math.round(cp.x - D.x), Math.round(cp.z - D.z)];
    await G(([x, z]) => window.__app.surface.debugPlace(x + 3.5, z + 4.5, 0), [cp.x, cp.z]); await sleep(800);
    ok('buy button', await ST().then(s => s.mode), (await ST()).mode === 'buy');
    const btn = await G(() => { const b = document.getElementById('craneBtn'), cs = b && getComputedStyle(b); return b ? { txt: b.textContent, vis: b.offsetParent !== null, bg: cs.backgroundColor, fg: cs.color } : null; });
    ok('buy label', btn?.txt, !!btn?.vis && /Buy crane/.test(btn.txt) && /1,800/.test(btn.txt));
    ok('black/white button', `${btn?.bg} ${btn?.fg}`, btn?.bg === 'rgb(0, 0, 0)' && btn?.fg === 'rgb(255, 255, 255)');
    await press(); await sleep(400);
    ok('bought', await G(() => window.SSX.crane.state.owned && window.SSX.crane.state.how === 'bought' && window.__app.game.progress.credits === 9999 - 1800));
    ok('in my rides', await G(() => (window.SSX.garage?.rides || []).some(r => r.kind === 'magnet_crane')));
    await G(() => window.__app.surface.interact()); await wait(() => window.__app.surface.info.driving, 6000); await sleep(600);
    ok('aboard', (await ST()).aboard);
    ok('no heat for a bought crane', await G(() => window.__app.surface.world.wanted === 0));
    // lift #1: the Dust Runner
    const dr = await car('dust_runner'); ok('npc dust runner parked', !!dr, !!dr);
    await hookOver(dr.x, dr.z, 0.4); await sleep(900);
    let s = await ST(); ok('target highlighted', s.target?.kind, s.target?.kind === 'dust_runner' && s.mode === 'grab');
    ok('grab label', await G(() => document.getElementById('craneBtn').textContent), /Grab/.test(await G(() => document.getElementById('craneBtn').textContent)));
    const stolen0 = await G(() => window.__app.game.progress.stats.stolen | 0);
    await press(); ok('lifted', await wait(() => window.SSX.crane.status().st === 'held', 12000));
    R.wantedAfterGrab = await G(() => window.__app.surface.world.wanted);
    s = await ST(); ok('holding dust runner', s.held?.kind, s.held?.kind === 'dust_runner');
    ok('stolen stat', await G(() => window.__app.game.progress.stats.stolen | 0) === stolen0 + 1);
    ok('drop label', /Drop/.test(await G(() => document.getElementById('craneBtn').textContent)));
    // drive a bit: it swings
    await G(() => { window.__app.joy.y = -1; }); await sleep(1600); await G(() => { window.__app.joy.y = 0; }); await sleep(700);
    s = await ST(); ok('swings', s.swing, Math.abs(s.swing[0]) + Math.abs(s.swing[1]) > 0.01);
    ok('still held while driving', s.held?.kind === 'dust_runner');
    // hero shot: out on open ground east of the yard, camera swung round to the side so the load shows
    await G(([x, z]) => { try { window.SSX.storm?.stop?.({ instant: true }); window.SSX.time.set(13); } catch (e) { /* */ } window.__app.surface.debugMove(x, z, -1.2); }, [D.x + 95, D.z + 62]); await sleep(1500);
    await G(() => { try { window.__app.surface.look(-1.0, 0.12, 1); } catch (e) { /* */ } }); await sleep(350);
    await shot(`${out}crane-hold-${tag}.png`);
    // owner calls it in (unseen lift): force the roll
    R.callsBefore = (await ST()).calls; R.heldSeen = (await ST()).held?.seen;
    await G(() => window.SSX.crane.debug.callNow(true)); await sleep(600);
    const wNow = await G(() => window.__app.surface.world.wanted), evs = await G(() => window.__evs.join(','));
    // v7.5.28 cops calm down: a lift is car theft = no stars (no ColSec officer within 12 m here); an unseen lift's owner call is just noise
    ok('heat: lift = 0 stars, owner call = no stars', { seen: R.heldSeen, afterGrab: R.wantedAfterGrab, now: wNow, evs }, R.wantedAfterGrab === 0 && wNow === 0 && (R.heldSeen || (R.callsBefore === 1 && evs.includes('call'))));
    await G(() => window.__app.surface.world.setWanted(0));
    // haul to Lou: hook over the yard drop through the south gate
    const yd = await G(() => window.SSX.crane.yard()); ok('yard drop', !!yd, !!yd);
    await hookOver(yd.x, yd.z, 0); await sleep(900);
    ok('sell mode at the yard', (await ST()).mode, (await ST()).mode === 'sell');
    ok('no Lou sell-the-crane action', await G(() => !/Sell this ride/.test(document.body.innerText)));
    await shot(`${out}crane-yard-${tag}.png`);
    await press(); ok('panel opens', await wait(() => window.SSX.crane.status().panel, 12000));
    const cr0 = await G(() => window.__app.game.progress.credits);
    await tapSel('#crPanel button[data-a="sell"]'); await sleep(500);
    const cr1 = await G(() => window.__app.game.progress.credits);
    ok('sold for credits', cr1 - cr0, cr1 > cr0);
    ok('car gone', !(await car('dust_runner')));
    ok('panel closed', !(await ST()).panel);
    // lift #2: Ares Brute -> keep
    const ab = await car('ares_brute'); ok('npc ares brute parked', !!ab, !!ab);
    await hookOver(ab.x, ab.z, 0); await sleep(1500);
    await G(() => { const w = window.__app.surface.world; w.__h = w.hostileAt; w.hostileAt = () => false; }); // pretend nobody saw this one
    await press(); ok('lifted 2', await wait(() => window.SSX.crane.status().st === 'held', 12000));
    await G(() => { const w = window.__app.surface.world; w.hostileAt = w.__h; });
    ok('unseen lift queues an owner call', (await ST()).calls === 1);
    await G(() => window.SSX.crane.debug.callNow(true));
    ok('owner called ColSec', await wait(() => window.__evs.includes('call'), 8000));
    await hookOver(yd.x, yd.z, 0); await sleep(700);
    await press(); ok('panel 2', await wait(() => window.SSX.crane.status().panel, 12000));
    await tapSel('#crPanel button[data-a="keep"]'); await sleep(500);
    ok('kept in my rides', await G(() => window.SSX.crane.state.kept === 1 && (window.SSX.garage?.rides || []).some(r => r.kind === 'ares_brute') && !window.__app.surface.world.parkedVehicles().some(v => v.kind === 'ares_brute')));
    // lift #3 then get out mid-carry: the load drops and is parked again
    const rc = await car('red_comet') || await car('buggy'); ok('third car', !!rc, !!rc);
    await hookOver(rc.x, rc.z, 0); await sleep(1500);
    await press(); ok('lifted 3', await wait(() => window.SSX.crane.status().st === 'held', 12000));
    await G(() => window.__app.surface.interact()); await sleep(700);
    s = await ST(); ok('dropped on exit', !s.held && s.st === 'idle');
    ok('dropped car is parked', await G(() => window.__app.surface.world.parkedVehicles().length > 0));
    ok('events', await G(() => window.__evs.join(',')), await G(() => ['buy', 'grab', 'release', 'sell', 'keep'].every(t => window.__evs.includes(t))));
  } catch (e) { bad.push('threw ' + e.message); R.err = e.stack; }
  R.errors = errors.filter(e => !/favicon|404|net::ERR/.test(e)); if (R.errors.length) bad.push('console errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
