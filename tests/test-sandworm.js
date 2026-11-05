// 🪱 The sandworm (mars/sandworm.js + sandwormcore.js), built to the mission script /workspace/story/worm-mission.md:
// Tully's radio line; phase 1 dust plume (real bullet segments through world.hitWorld, auto-aim via world.targets) -> 3
// surfacings; phase 2 the toothy worm: 4 gill sacs, a lunge and acid spit hurt you, it eats a plot (ripe rack cut, growing rack
// chewed); phase 3 it charges the silo, a stun opens the maw, maw hits kill it: 1,500 cr + 150 ⭐ + a Worm Tooth, gory death;
// next game day the eaten racks regrow; a lose run eats at most half the farm and says the lose line; one caption at a time;
// a double spawn starts one fight; random trigger (once per 3 game days) + the story start after the 2nd harvest; a guarded
// SSX.farm2 stub gets damage(plotId); Rust Pit refused + a fight there ends; Worm Tooth sells for 800 cr; no console errors.
// BASE=http://127.0.0.1:8922/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/sandworm/ node tests/test-sandworm.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8897/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/sandworm/', desk = DEV === 'desktop';
// headless WebKit with no audio device crashes on the game's first AudioContext (main too), so WebKit runs muted
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
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); };
  const shot = async n => { const p = `${out}sandworm-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const St = () => G(() => window.SSX.sandworm.status());
  const cr = () => G(() => window.__app.game.progress.credits);
  const farmAt = dz => G(dz => { const p = window.SSX.farm.places().find(q => q.id === 'farm'); window.__app.surface.debugMove(p.x, p.z + dz, 0); return p; }, dz);
  // a real bullet segment through a weak point, the way game.js calls world.hitWorld(p0, p1, b)
  const shoot = (which, dmg = 10, i = 0) => G(([which, dmg, i]) => { const W = window.SSX.sandworm.debug.weak(); const t = which === 'sacs' ? W.sacs[i] : W[which]; if (!t) return 'no ' + which;
    const w = window.__app.surface.world; return w.hitWorld({ x: t.x - 6, y: t.y + 0.2, z: t.z - 6 }, { x: t.x + 6, y: t.y - 0.2, z: t.z + 6 }, { dmg }); }, [which, dmg, i]);
  const oneCaption = () => G(() => ['#wormCap', '#hvCap', '#stillCap', '#f2Cap', '#farmGuide'].filter(s => { const e = document.querySelector(s); return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }));
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.sandworm && !!window.SSX?.farm, 20000);
    ok('api', await G(() => { const A = window.SSX.sandworm; return ['spawn', 'status', 'sellTooth', 'on'].every(k => typeof A[k] === 'function') && A.PAY.cr === 1500 && A.PAY.stars === 150 && A.PAY.tooth === 800; }));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.()); await sleep(300);
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 30000; g.progress.xp = 500; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset(); window.SSX.harvest?.debug?.reset?.();
      window.SSX.sandworm.debug.reset(); window.SSX.sandworm.debug.noRandom(true); window.__wev = []; window.SSX.sandworm.on(e => window.__wev.push(e.type)); });
    ok('noFarm', await G(() => window.SSX.sandworm.spawn().why), await G(() => window.SSX.sandworm.spawn().why === 'farm'));
    // the homestead: 6 racks, 3 ripe (algae), 3 growing (potatoes)
    await farmAt(12);
    for (const a of ['buy', 'buildDome']) { await G(a => window.SSX.farm[a](), a); await sleep(400); }
    for (let i = 0; i < 6; i++) { await G(() => window.SSX.farm.addRack()); await sleep(400); }
    await G(() => { const F = window.SSX.farm; F.refill('water'); F.refill('power'); for (let i = 0; i < 3; i++) F.plant(i, 'algae'); F.skip(7); F.refill('water'); F.refill('power'); for (let i = 3; i < 6; i++) F.plant(i, 'potato'); });
    await sleep(500);
    let racks = await G(() => window.SSX.farm.rackSpots().map(r => ({ crop: r.crop, ripe: r.ripe })));
    ok('farmReady', racks, racks.length === 6 && racks.filter(r => r.ripe).length === 3 && racks.filter(r => r.crop && !r.ripe).length === 3);
    // 1) spawn: Tully's line, one caption, a double spawn starts one fight
    await G(() => window.SSX.sandworm.debug.ag());
    const sp = await G(() => [window.SSX.sandworm.spawn(), window.SSX.sandworm.spawn()]);
    ok('spawnOnce', sp, sp[0].ok && !sp[1].ok && sp[0].cap === 3);
    await G(() => window.SSX.sandworm.debug.hold()); await fr(6); await sleep(300);
    let s = await St(); ok('phase1', { phase: s.phase, cap: s.caption }, s.active && s.phase === 1 && /Ground's shakin', boss!/.test(s.caption) && /Tully/.test(s.caption));
    ok('oneCaption', await oneCaption(), (await oneCaption()).join() === '#wormCap');
    ok('aim', await G(() => window.__app.surface.world.targets().filter(t => t.kind === 'sandworm').length), await G(() => window.__app.surface.world.targets().some(t => t.kind === 'sandworm')));
    // 2) phase 1: two real bullet hits on the plume = one surfacing
    ok('plumeHit', [await shoot('plume'), await shoot('plume')], (await St()).surf === 1);
    await sleep(1900); await G(() => { window.SSX.sandworm.debug.hitPlume(2); }); await sleep(1900); await G(() => { window.SSX.sandworm.debug.hitPlume(2); window.SSX.sandworm.debug.hold(); });
    ok('phase2', await wait(() => window.SSX.sandworm.status().phase === 2, 5000)); await sleep(1200); await fr(6);
    ok('sacsUp', await G(() => window.SSX.sandworm.debug.weak().sacs.filter(Boolean).length), await G(() => window.SSX.sandworm.debug.weak().sacs.filter(Boolean).length === 4));
    // 3) a sac: three real hits pop it
    ok('sacPop', [await shoot('sacs', 10, 0), await shoot('sacs', 10, 0), await shoot('sacs', 10, 0)], (await St()).sacs[0] === 0);
    ok('bodySoaks', await G(() => { const W = window.SSX.sandworm.debug.weak(), s = W.segs[W.segs.length - 3]; return window.__app.surface.world.hitWorld({ x: s.x - 5, y: s.y, z: s.z }, { x: s.x + 5, y: s.y, z: s.z }, { dmg: 10 }); }));
    // 4) it eats: a ripe rack is cut (crop gone), a growing one chewed down
    const e1 = await G(() => window.SSX.sandworm.debug.eat()); await sleep(300);
    racks = await G(() => window.SSX.farm.rackSpots().map(r => ({ crop: r.crop, ripe: r.ripe })));
    ok('eatRipe', { e1, racks }, e1 && racks.filter(r => r.ripe).length === 2 && (await St()).eaten === 1);
    // mid-attack shot: stand back, watch it rear up and spit acid
    await farmAt(24); await G(() => window.SSX.sandworm.debug.hold()); await fr(4); await sleep(1000);
    await G(() => { window.SSX.sandworm.debug.spit(); }); await sleep(700); await shot('attack');
    // 5) a lunge and the acid hurt you when you stand still
    await G(() => window.SSX.sandworm.debug.lunge()); await sleep(2600);
    ok('hurt', await G(() => window.__wev.filter(t => t === 'hurt').length), await G(() => window.__wev.includes('hurt')));
    // 6) pop the rest -> phase 3: it charges the silo; a stun (ram/flame) opens the maw
    await G(() => { for (const i of [1, 2, 3]) window.SSX.sandworm.debug.hitSac(i, 3); }); 
    ok('phase3', await wait(() => window.SSX.sandworm.status().phase === 3 && !!window.SSX.sandworm.debug.charge(), 4000));
    const ch0 = await G(() => window.SSX.sandworm.debug.charge()); await sleep(1000); const ch1 = await G(() => window.SSX.sandworm.debug.charge());
    ok('charging', { ch0, ch1 }, await G(([a, b]) => { const f = window.SSX.sandworm.debug.farms()[0]; return Math.hypot(b.x - f.silo.x, b.z - f.silo.z) < Math.hypot(a.x - f.silo.x, a.z - f.silo.z); }, [ch0, ch1]));
    ok('mawShut', await shoot('maw', 50), (await St()).maw === 8);
    await G(() => { const f = window.SSX.sandworm.debug.farms()[0], c = window.SSX.sandworm.debug.charge(); window.__app.surface.debugMove(c.x + 9, c.z + 9, 0); window.SSX.sandworm.debug.stun('ram'); });
    await fr(6); await sleep(600); await shot('stunned');
    s = await St(); ok('stunned', { stun: s.stun, cap: s.caption }, s.stun > 0 && /mouth/.test(s.caption));
    // 7) kill: maw hits; payout once
    const c0 = await cr(), x0 = await G(() => window.__app.game.progress.xp);
    for (let i = 0; i < 4; i++) await shoot('maw', 50);
    await sleep(350); await shot('death');
    s = await St(); ok('win', { over: s.over, teeth: s.teeth, cr: (await cr()) - c0, xp: (await G(() => window.__app.game.progress.xp)) - x0, cap: s.caption },
      s.over === 'win' && s.teeth === 1 && (await cr()) - c0 === 1500 && (await G(() => window.__app.game.progress.xp)) - x0 === 150 && /Hell of a fertilizer/.test(s.caption));
    ok('gone', await wait(() => !window.SSX.sandworm.status().active && !window.SSX.sandworm.status().done, 6000));
    // 8) next game day the eaten racks regrow (the cut rack replanted free)
    const c1 = await cr(); await farmAt(12); await G(() => { window.SSX.farm.refill('water'); window.SSX.farm.refill('power'); window.SSX.farm.skip(24); });
    ok('regrow', await wait(() => window.SSX.sandworm.status().pending.length === 0, 8000));
    racks = await G(() => window.SSX.farm.rackSpots().map(r => r.crop)); ok('regrown', { racks, spent: c1 - (await cr()) }, racks.every(Boolean) && c1 - (await cr()) <= 0);
    // 9) a lose run: it eats half the farm, never more
    await G(() => { window.SSX.sandworm.debug.ag(); window.SSX.sandworm.spawn(); window.SSX.sandworm.debug.hold(); }); await sleep(400);
    for (let i = 0; i < 5; i++) { await G(() => window.SSX.sandworm.debug.eat()); await sleep(200); }
    s = await St(); ok('lose', { eaten: s.eaten, over: s.over, cap: s.caption }, s.over === 'lose' && s.eaten === 3 && /half the farm/.test(s.caption));
    racks = await G(() => window.SSX.farm.rackSpots().map(r => r.crop)); await wait(() => !window.SSX.sandworm.status().active, 4000);
    // 10) SSX.farm2 (guarded): a stub grow op gets damage(plotId)
    const f2 = await G(() => { const me = window.__app.surface.info, calls = []; window.SSX.farm2 = { SITE: { name: 'Test gulch' }, status: () => ({ owned: true, site: { x: me.x + 5, z: me.z } }),
      plots: () => [1, 2].map(id => ({ id, x: me.x + 5 + id, z: me.z, crop: 'redstatic', ripe: true })), damage: id => { calls.push(id); return { ok: true, id, snap: { crop: 'redstatic' } }; }, restore: () => ({ ok: true }) };
      window.SSX.sandworm.debug.ag(); const r = window.SSX.sandworm.spawn({ farm: 'farm2' }); window.SSX.sandworm.debug.hold(); window.SSX.sandworm.debug.eat(); const out = { r, calls: calls.slice() }; window.SSX.sandworm.debug.end('away'); delete window.SSX.farm2; return out; });
    ok('farm2', f2, f2.r.ok && f2.r.farm === 'farm2' && f2.calls.length === 1);
    await sleep(1800);
    // 11) triggers: the story start after the 2nd harvest, random once per 3 game days
    await G(() => { window.SSX.sandworm.debug.harvests(2); }); await farmAt(12);
    ok('story', await wait(() => window.SSX.sandworm.status().active, 9000), await G(() => window.SSX.sandworm.status().story));
    await G(() => window.SSX.sandworm.debug.end('away')); await sleep(1800);
    ok('notTooSoon', await G(() => { window.SSX.sandworm.debug.noRandom(false); window.SSX.sandworm.debug.rng(0); return true; }) && !(await wait(() => window.SSX.sandworm.status().active, 6500)));
    await G(() => window.SSX.farm.skip(72)); ok('random', await wait(() => window.SSX.sandworm.status().active, 9000));
    await G(() => { window.SSX.sandworm.debug.end('away'); window.SSX.sandworm.debug.noRandom(true); window.SSX.sandworm.debug.rng(null); }); await sleep(1800);
    // 12) Rust Pit: refused, and a fight that follows you there ends
    await G(() => { window.SSX.sandworm.debug.ag(); window.SSX.sandworm.spawn(); }); await G(() => { const c = window.SSX.farm.debug.colony(); window.__app.surface.debugMove(c.x - 292, c.z - 68, 0); }); await fr(6); await sleep(500);
    const pit = await G(() => window.SSX.farm.debug.inPit());
    ok('pitEnds', { pit, s: await St() }, !pit || !(await St()).active);
    ok('pitRefused', await G(() => { window.SSX.sandworm.debug.ag(); return window.SSX.sandworm.spawn({ anywhere: true }); }), !pit || await G(() => window.SSX.sandworm.status().blocked === 'pit'));
    // 13) the Worm Tooth sells to Sister Nettle (Hydro Den only) for 800 cr
    ok('toothOutside', await G(() => window.SSX.sandworm.sellTooth().ok === false));
    const c2 = await cr(); await G(() => { window.SSX.sandworm.debug.ag(); window.SSX.sandworm.sellTooth({ anywhere: true }); window.SSX.sandworm.sellTooth({ anywhere: true }); });
    ok('toothSold', { got: (await cr()) - c2, teeth: (await St()).teeth }, (await cr()) - c2 === 800 && (await St()).teeth === 0);
    // 14) save survives a reload
    await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.sandworm, 120000);
    s = await St(); ok('reload', { kills: s.stats.kills, losses: s.stats.losses, story: s.story }, s.stats.kills === 1 && s.stats.losses >= 1 && s.story);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
