// Beltway life (beltway.js / SSX.beltway): dense lane-AI traffic by quality tier, carjacking a stopped car (hold the context
// button with a joystick finger down), an armored convoy (ram, disable, crack, loot), a pileup with sparks/debris, and a toll
// booth (pay / shake down). Also: npcBudget cap, HUD centre clear, fps on med with the layer on vs off.
// BASE=http://127.0.0.1:8862/ DEV=393x852 BR=webkit OUT=/workspace/pw-ben-beltway/shots/ node tests/test-beltway.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8862/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'beltway';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 };
  const touch = DEV !== 'desktop', HELD = touch && process.env.HELD !== '0';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /beltway (tick|spawn|enter|guards)/.test(m.text())) errors.push(m.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 15000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = (n = 4) => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png`, timeout: 90000 }).then(() => (R.shots = (R.shots || []).concat(`${out}${PFX}-${tag}-${s}.png`))).catch(e => errors.push('shot ' + s));
  // touch: finger 41 rests on the joystick while finger 42 presses the button (pointerdown ... pointerup, same id, no click)
  const P = (sel, type, id) => G(([s, t, id]) => { const e = s === '#joy' ? document.getElementById('joy') : document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width) return false;
    e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true })); return true; }, [sel, type, id]);
  const holdBtn = async (sel, until, ms = 15000) => { // press, keep holding until the condition (or timeout), release
    if (touch) { if (HELD) await P('#joy', 'pointerdown', 41); const d = await P(sel, 'pointerdown', 42); const r = d && await wait(until, ms); await P(sel, 'pointerup', 42); if (HELD) await P('#joy', 'pointerup', 41); if (HELD) R.heldTaps = (R.heldTaps || 0) + 1; return r; }
    await page.keyboard.down('KeyI'); const r = await wait(until, ms); await page.keyboard.up('KeyI'); return r;
  };
  const tapBtn = async sel => { if (touch) { if (HELD) await P('#joy', 'pointerdown', 41); await P(sel, 'pointerdown', 42); await sleep(60); await P(sel, 'pointerup', 42); if (HELD) { await P('#joy', 'pointerup', 41); R.heldTaps = (R.heldTaps || 0) + 1; } } else await page.keyboard.press('KeyI'); };
  const label = (id = 'bwBtn') => G(id => { const b = document.getElementById(id); return b && getComputedStyle(b).display !== 'none' ? b.textContent : ''; }, id);
  const credits = () => G(() => window.__app.surface.game.info.credits);
  const wanted = () => G(() => window.__app.surface.world.wanted | 0);
  const goS = (s, lat = 7, face = 1) => G(([s, lat, face]) => { const sf = window.__app.surface, h = sf.world.highway(), p = h.at(s); if (sf.info.driving) sf.interact(); sf.debugMove(p.x - p.fz * lat, p.z + p.fx * lat, Math.atan2(-p.fx * face, -p.fz * face)); return true; }, [s, lat, face]);
  const centreHits = () => G(() => { const W = innerWidth, H = innerHeight, c = { l: W * 0.3, r: W * 0.7, t: H * 0.3, b: H * 0.7 };
    return ['bwBtn', 'bwBtn2', 'bwChip'].map(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width && !(r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b) ? id : null; }).filter(Boolean); });
  const fpsFor = ms => G(ms => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(+(n * 1000 / (performance.now() - t0)).toFixed(1)); }; requestAnimationFrame(f); }), ms);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(600);
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.restore?.(); });
    if (await G(() => { const r = document.getElementById('radio'); return r && getComputedStyle(r).display !== 'none'; })) await G(() => document.getElementById('radioLater')?.click());
    ok('ready', null, await wait(() => window.SSX.beltway?.ready, 30000));
    ok('api', null, await G(() => { const B = window.SSX.beltway; return window.__app.beltway === B && ['tier', 'setTier', 'setEnabled', 'density', 'cars', 'booths', 'convoy', 'spawnConvoy', 'action', 'stats', 'heat', 'fps', 'frameMs', 'fx', 'on', 'off'].every(k => typeof B[k] === 'function'); }));
    ok('roadVisible', await G(() => { let up = 0, all = 0; window.__app.surface.scene.traverse(o => { if (o.userData?.v8?.part === 'road') { const N = o.geometry.attributes.normal; for (let i = 0; i < N.count; i++) { all++; if (N.getY(i) > 0) up++; } } }); return +(up / all).toFixed(2); }), true);
    R.roadFixedTris = await G(() => window.SSX.beltway.debug.roadFixed());
    await G(() => { window.__bwEv = []; for (const e of ['carjack', 'carjackFail', 'pileup', 'crash', 'convoy', 'ram', 'convoyDisabled', 'convoyLoot', 'tollPaid', 'tollRun', 'shakedown']) window.SSX.beltway.on(e, d => { window.__bwEv.push(e); (window.__bwLast ||= {})[e] = d; }); });
    // ---- tiers -> density
    R.defaultTier = await G(() => window.SSX.beltway.tier()); ok('defaultTier', R.defaultTier, R.defaultTier === (touch ? 'med' : 'high'));
    R.tierTargets = await G(() => { const B = window.SSX.beltway, o = {}; for (const t of ['low', 'med', 'high']) { B.setTier(t); o[t] = B.density().base; } B.setTier('med'); return o; });
    ok('densityByTier', JSON.stringify(R.tierTargets), R.tierTargets.low < R.tierTargets.med && R.tierTargets.med < R.tierTargets.high);
    // ---- traffic on an open stretch (the box GPU is slow, so pin the count instead of letting the fps governor thin it)
    const open = await G(() => window.SSX.beltway.debug.openS(60)); const S0 = open[Math.floor(open.length * 0.3)]; ok('openStretch', open.length, open.length > 10);
    const med = R.tierTargets.med; await G(n => window.SSX.beltway.debug.setDensity(n), med);
    await goS(S0, 7); await sleep(touch ? 4000 : 3000);
    await wait(n => window.SSX.beltway.cars().length >= n, 25000, Math.min(12, med - 2)); R.carsLive = await G(() => window.SSX.beltway.cars().length);
    ok('trafficDense', `${R.carsLive} live (target ${med}), ${await G(() => window.SSX.beltway.debug.near(120))} within 120 m`, R.carsLive >= Math.min(12, med - 2));
    R.lanes = await G(() => window.SSX.beltway.debug.lanes()); ok('bothLanes', JSON.stringify(R.lanes), R.lanes[0] > 0 && R.lanes[1] > 0);
    const v0 = await G(() => window.SSX.beltway.cars().filter(c => c.state === 'drive').map(c => [c.id, c.x, c.z])); await sleep(1500);
    R.moving = await G(v0 => { const now = new Map(window.SSX.beltway.cars().map(c => [c.id, c])); return v0.filter(([id, x, z]) => now.has(id) && Math.hypot(now.get(id).x - x, now.get(id).z - z) > 1).length; }, v0); ok('carsMoving', R.moving, R.moving >= 3);
    R.minHeadway = await G(() => { const cs = window.SSX.beltway.cars().filter(c => c.state === 'drive'); let m = 1e9; for (const a of cs) for (const b of cs) if (a !== b && a.lane === b.lane && a.dir === b.dir) m = Math.min(m, Math.hypot(a.x - b.x, a.z - b.z)); return +m.toFixed(1); });
    ok('followingDistance', R.minHeadway, R.minHeadway > 3.5);
    // look down the road for the traffic shot (cars coming at you on the near lane)
    await goS(S0, 6.5, -1); await sleep(1800); await shot('traffic');
    // ---- fps on med: rAF rate with the layer on vs off (same spot), plus its own per-frame CPU cost
    await G(() => window.SSX.beltway.debug.setDensity(null)); await G(() => window.SSX.beltway.setTier('med')); await sleep(1500);
    R.fpsOnMed = await fpsFor(3000); R.costMsMed = await G(() => window.SSX.beltway.frameMs()); R.carsMed = await G(() => window.SSX.beltway.density());
    await G(() => window.SSX.beltway.setEnabled(false)); await sleep(800); R.fpsOff = await fpsFor(3000); await G(() => window.SSX.beltway.setEnabled(true));
    ok('fpsCost', `${R.fpsOnMed} on / ${R.fpsOff} off, ${R.costMsMed} ms/frame`, R.costMsMed < 4 && R.fpsOnMed >= R.fpsOff * 0.75);
    await G(n => window.SSX.beltway.debug.setDensity(n), med);
    // ---- carjack: a stopped car right beside you; hold the context button (joystick finger down on touch)
    const S1 = open[Math.floor(open.length * 0.6)]; await goS(S1, 6); await sleep(1200);
    await G(() => window.__app.surface.world.setWanted?.(0, 'test'));
    await G(o => window.SSX.beltway.debug.outcome(o), touch ? 'flee' : 'fight');
    R.jackCar = await G(() => window.SSX.beltway.debug.carHere('sedan', 0));
    ok('carjackBtn', await wait(() => window.SSX.beltway.action() === 'carjack', 6000) ? await label() : 'none', /Carjack/.test(await label()));
    ok('carjackCentreClear', (await centreHits()).join() || 'clear', (await centreHits()).length === 0);
    ok('noOnclick', null, await G(() => ['bwBtn', 'bwBtn2'].every(id => { const b = document.getElementById(id); return b && !b.onclick && !b.getAttribute('onclick'); })));
    // a cancelled press does not jack
    if (touch) { await P('#bwBtn', 'pointerdown', 43); await P('#bwBtn', 'pointercancel', 43); await sleep(300); ok('cancelNoJack', null, (await G(() => window.SSX.beltway.stats().carjacks)) === 0); }
    const w0 = await wanted();
    // hold: snapshot mid-struggle (the Pull % button), keep holding until the door gives
    if (touch) { if (HELD) await P('#joy', 'pointerdown', 41); await P('#bwBtn', 'pointerdown', 42); } else await page.keyboard.down('KeyI');
    if (await wait(() => (window.SSX.beltway.debug.state().jack || 0) > 0.35, 12000)) await shot('carjack');
    ok('carjackHold', null, await wait(() => window.SSX.beltway.stats().carjacks > 0, 20000));
    if (touch) { await P('#bwBtn', 'pointerup', 42); if (HELD) { await P('#joy', 'pointerup', 41); R.heldTaps = (R.heldTaps || 0) + 1; } } else await page.keyboard.up('KeyI');
    ok('inStolenCar', await G(() => window.__app.surface.info.vehicle), await wait(() => window.__app.surface.info.driving && /^bw-/.test(window.__app.surface.info.vehicle), 8000));
    R.heatAfterJack = await wanted(); ok('carjackHeat', `${w0}->${R.heatAfterJack}`, R.heatAfterJack > w0);
    ok('driverOut', await G(() => window.SSX.beltway.debug.drivers()), true);
    await sleep(600); await shot('carjack-driving');
    // ---- pileup: a line of cars at speed, the leader stops dead
    await G(() => window.SSX.beltway.debug.pileup(5, 18, 13, 45)); 
    ok('pileup', null, await wait(() => window.SSX.beltway.stats().pileups > 0, 15000));
    R.wrecks = await G(() => window.SSX.beltway.debug.wrecks()); R.fx = await G(() => window.SSX.beltway.fx()); ok('sparks', JSON.stringify(R.fx), R.fx.sparks > 0 || R.fx.debris > 0);
    await shot('pileup');
    // ---- armored convoy: spawn ahead, ram (debug ram = the same hit path as a real collision) until disabled, then crack the back
    await G(() => { window.__app.surface.world.setWanted?.(0, 'test'); window.SSX.beltway.debug.autoCrack(false); });
    const S2 = open[Math.floor(open.length * 0.85)]; await goS(S2, 7); await sleep(800);
    ok('convoySpawn', null, await G(() => !!window.SSX.beltway.spawnConvoy({ ahead: 40, dir: 1, v: 0.5 })));
    await sleep(800);
    ok('convoyChip', await G(() => { const c = document.getElementById('bwChip'); return { on: !!c?.classList.contains('on'), conv: window.SSX.beltway.convoy(), parent: c?.parentNode?.id }; }), await wait(() => document.getElementById('bwChip')?.classList.contains('on'), 8000));
    const cr0 = await credits();
    await G(() => window.SSX.beltway.debug.ram(14)); R.heatAfterRam = await wanted(); ok('ramHeat', R.heatAfterRam, R.heatAfterRam >= 2);
    for (let k = 0; k < 12 && (await G(() => window.SSX.beltway.convoy()?.state)) === 'rolling'; k++) await G(() => window.SSX.beltway.debug.ram(16));
    ok('convoyDisabled', null, (await G(() => window.SSX.beltway.convoy()?.state)) === 'disabled');
    await sleep(1500);
    const spot = await G(() => window.SSX.beltway.convoy()?.crackAt);
    if (spot) await G(p => { const sf = window.__app.surface; if (sf.info.driving) sf.interact(); sf.debugMove(p.x, p.z, sf.info.yaw || 0); }, spot);
    ok('crackBtn', await wait(() => window.SSX.beltway.action() === 'crack', 8000) ? await label() : 'none', /Crack/.test(await label()));
    await shot('convoy');
    await tapBtn('#bwBtn');
    const safe = await wait(() => !!window.SSX.heist?.debug?.safe?.() || !!document.getElementById('hsSafe'), 5000); R.safeUi = safe;
    if (safe && await G(() => !!window.SSX.heist?.debug?.safe)) { // solve the dial the way test-heist does (single pointer drag)
      await sleep(500);
      const dial = await G(() => { const r = document.getElementById('hsDial').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.42 }; });
      await G(async dial => { const touch = dial.touch, root = document.getElementById('hsSafe'), sl = ms => new Promise(r => setTimeout(r, ms));
        const pt = a => ({ clientX: dial.x + dial.R * Math.sin(a * Math.PI / 180), clientY: dial.y - dial.R * Math.cos(a * Math.PI / 180) });
        const E = (type, a) => root.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: touch ? 'touch' : 'mouse', isPrimary: true, bubbles: true, cancelable: true, buttons: 1, ...pt(a) }));
        for (let guard = 0; guard < 8; guard++) { const s = window.SSX.heist.debug.safe(); if (!s || s.done) break; let a = s.angle; const tg = s.targets[s.idx]; E('pointerdown', a);
          let diff = ((tg - a) % 360 + 540) % 360 - 180; while (Math.abs(diff) > 1.5) { const st = Math.sign(diff) * Math.min(2.5, Math.abs(diff)); a += st; diff -= st; E('pointermove', a); await new Promise(r => requestAnimationFrame(r)); }
          await sl(950); E('pointerup', a); await sl(100); } }, { ...dial, touch });
    }
    ok('convoyLooted', null, await wait(() => window.SSX.beltway.convoy()?.state === 'looted', 40000));
    await sleep(250); await shot('convoy-loot');
    const lev = await G(() => window.__bwLast?.convoyLoot || {}); R.lootDelta = (await credits()) - cr0; // guards can still drop you (and a bust costs cash) after the doors open
    ok('lootCredits', `${lev.credits} cr (wallet ${R.lootDelta >= 0 ? '+' : ''}${R.lootDelta})`, lev.credits >= 380 && lev.credits <= 720);
    ok('lootHeat', lev.wanted, lev.wanted >= 3); R.downedAfterLoot = await G(() => window.__app.surface.game.info.down);
    // ---- toll booth: pay, then shake down the attendant
    // the loot heat brings security: let a bust (if any) finish, then clear heat for the toll section
    await G(() => { window.__app.surface.world.setWanted?.(0, 'test'); window.__app.surface.game.restore?.(); }); await wait(() => !window.__app.surface.game.info.down, 30000); await sleep(1500);
    await G(() => { window.__app.surface.world.setWanted?.(0, 'test'); window.__app.surface.game.restore?.(); });
    const booth = await G(() => { const sf = window.__app.surface, me = sf.info; const b = window.SSX.beltway.booths().sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0]; return b; });
    await G(b => { const sf = window.__app.surface; if (sf.info.driving) sf.interact(); sf.debugMove(b.x + 3.2, b.z + 3.2, 0); }, booth); await sleep(1500);
    ok('tollBtn', await wait(() => window.SSX.beltway.action() === 'toll' && /Toll/.test(document.getElementById('bwBtn').textContent), 10000) ? await label() : await label() || 'none', /Toll/.test(await label()));
    const c1 = await credits(); await tapBtn('#bwBtn'); await sleep(500);
    ok('tollPaid', (await credits()) - c1, (await credits()) - c1 === -10);
    ok('shakeBtn', await label('bwBtn2') || 'none', /Shake/.test(await label('bwBtn2')));
    await shot('toll');
    const c2 = await credits(); const w2 = await wanted();
    ok('shakedownHold', null, await holdBtn(touch ? '#bwBtn2' : '#bwBtn2', () => window.SSX.beltway.stats().shakedowns > 0, 12000));
    await sleep(300); R.shakeCash = (await credits()) - c2; ok('shakeCash', R.shakeCash, R.shakeCash >= 80 && R.shakeCash <= 160);
    ok('shakeHeat', `${w2}->${await wanted()}`, (await wanted()) >= 2);
    // ---- budget, centre, events
    R.npc = await G(() => { const b = window.__app.surface.world.npcBudget?.(); return b ? `${b.used}/${b.cap}` : 'n/a'; });
    ok('npcCap', R.npc, await G(t => { const b = window.__app.surface.world.npcBudget?.(); return !b || (b.used <= b.cap && (!t || b.cap <= 12)); }, touch));
    R.events = await G(() => [...new Set(window.__bwEv)].join());
    ok('events', R.events, ['carjack', 'pileup', 'convoy', 'convoyDisabled', 'convoyLoot', 'tollPaid', 'shakedown'].every(e => R.events.split(',').includes(e)));
    R.stats = await G(() => window.SSX.beltway.stats());
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || 'none', errors.length === 0);
  R.fail = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
