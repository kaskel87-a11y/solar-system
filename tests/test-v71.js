// v7.1 test: Take by touch (every vehicle type, plus thumb-on-joystick multi-touch on Chromium), on-foot FIRE with
// auto-aim, firing from a stolen ride, ammo chip + crates + rover locker, melee combo + knockback, vibro-machete.
// BASE=http://localhost:8765/ DEV="iPhone 14" BR=webkit node test-v71.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/workspace/solar-system/shots/', PFX = process.env.PFX || 'v71';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...d } = devices[DEV];
  const ctx = await browser.newContext(d); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const vis = sel => G(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
  const center = sel => G(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapAt = async sel => { const c = await center(sel); await page.touchscreen.tap(c.x, c.y); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('version', await G(() => window.__app.version), /^v7\.[1-9]/.test(await G(() => window.__app.version)));
    await G(() => { localStorage.removeItem('ssx.game.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000);
    await sleep(1200);
    // ---------- 1. Take by touch, every vehicle type ----------
    const kinds = await G(() => [...new Set(window.__app.surface.world.debug.vehicles().filter(v => v.parked).map(v => v.kind))]);
    R.kinds = kinds.join(',');
    for (const k of kinds) {
      const v = await G(k => window.__app.surface.world.debug.vehicles().find(v => v.kind === k && v.parked), k);
      await G(v => { window.__app.game.debug.clear(); window.__app.surface.world.setWanted(0); window.__app.surface.debugMove(v.x + 3.4, v.z + 1.2, 1.2); }, v);
      const shown = await wait(() => /Take/.test(document.getElementById('driveBtn').textContent) && getComputedStyle(document.getElementById('driveBtn')).display !== 'none', 10000);
      if (k === 'shuttle') await shot('take-shuttle');
      await tapAt('#driveBtn');
      const got = await wait(k => window.__app.surface.info.driving && window.__app.surface.info.stolen && window.__app.surface.info.vehicle === k, 6000, k);
      ok('take_' + k, shown && got);
      await sleep(400); await tapAt('#driveBtn'); // Exit, also by touch
      ok('exit_' + k, await wait(() => !window.__app.surface.info.driving, 6000));
    }
    // ---------- 1b. thumb on the joystick while tapping Take (the real-phone bug); CDP touch is Chromium-only ----------
    if (BR === 'chromium') {
      const cdp = await ctx.newCDPSession(page);
      const v = await G(() => window.__app.surface.world.debug.vehicles().find(v => v.kind === 'shuttle' && v.parked));
      await G(v => window.__app.surface.debugMove(v.x + 3.4, v.z + 1.2, 1.2), v);
      await wait(() => /Take/.test(document.getElementById('driveBtn').textContent), 8000);
      const j = await center('#joy'), t = await center('#driveBtn');
      const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
      await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(120);
      await T('touchStart', [{ x: j.x, y: j.y, id: 1 }, { x: t.x, y: t.y, id: 2 }]); await sleep(80);
      await T('touchEnd', []); // both thumbs lift; Chromium, like iOS WebKit, sends no click for a multi-touch tap
      ok('takeWhileHoldingStick', await wait(() => window.__app.surface.info.driving && window.__app.surface.info.stolen, 4000));
      await sleep(300);
      await G(() => window.__app.surface.interact());
    }
    // too far: clear feedback
    {
      const v = await G(() => window.__app.surface.world.debug.vehicles().find(v => v.kind === 'buggy' && v.parked));
      await G(v => window.__app.surface.debugMove(v.x + 10, v.z, 1.2), v); await sleep(500);
      R.farResult = await G(() => window.__app.surface.interact());
      R.farToast = await G(() => document.getElementById('toast').textContent);
      ok('tooFarFeedback', R.farResult === 'far' && /Too far/.test(R.farToast));
    }
    // ---------- 2. chip: weapon + ammo + medkits ----------
    R.chip = await G(() => document.getElementById('gearChip').textContent);
    ok('chipClear', R.chip, /🔫∞/.test(R.chip) && /✚\d/.test(R.chip));
    // ---------- 3. on-foot FIRE with auto-aim ----------
    await G(() => { const s = window.__app.surface, c = s.world.colony; s.debugMove(c.x + 160, c.z + 170, 0); window.__app.game.setAliens(true); window.__app.game.debug.clear(); });
    await sleep(800);
    ok('fireBtnOnFoot', await vis('#fireBtn'));
    await G(() => { window.__app.game.debug.spawn('crawler', 12, 0.25, true); window.__app.game.debug.calm(true); });
    await sleep(600);
    const shots0 = await G(() => window.__app.game.progress.stats.shots), kills0 = await G(() => window.__app.game.progress.stats.kills);
    const fc = await center('#fireBtn');
    for (let n = 0; n < 40; n++) { await page.touchscreen.tap(fc.x, fc.y); await sleep(120); if (await G(k => window.__app.game.progress.stats.kills > k, kills0)) break; if (n === 3) await shot('onfoot-firing'); }
    R.shots = (await G(() => window.__app.game.progress.stats.shots)) - shots0;
    ok('onFootFire', R.shots, R.shots > 0);
    ok('autoAimKill', null, await wait(k => window.__app.game.progress.stats.kills > k, 6000, kills0));
    // ---------- 4. ammo: crates, kills, rover locker ----------
    const crates = await G(() => window.__app.game.debug.crates());
    R.crates = crates.length; ok('cratesPlaced', R.crates, R.crates >= 4);
    const cr = crates.find(c => !c.cache) || crates[0];
    const sh0 = await G(() => window.__app.game.progress.inv.shells);
    await G(c => window.__app.surface.debugMove(c.x + 6, c.z + 6, 0), cr); await sleep(900);
    await G(c => window.__app.surface.debugMove(c.x + 0.6, c.z + 0.4, 0), cr);
    ok('cratePickup', await wait(s => window.__app.game.progress.inv.shells > s, 6000, sh0));
    R.crateToast = await G(() => document.getElementById('toast').textContent);
    await shot('ammo-pickup');
    ok('crateCooling', null, await G(() => window.__app.game.debug.crates().some(c => c.cool > 0)));
    // ---------- 5. melee: punch, punch, kick ----------
    await G(() => { const s = window.__app.surface, c = s.world.colony; s.debugMove(c.x + 190, c.z + 120, 0); window.__app.game.debug.clear(); });
    await sleep(600);
    await G(() => { window.__app.game.debug.spawn('crawler', 2.0, 0, true); window.__app.game.debug.calm(true); });
    ok('meleeBtnShows', await wait(() => getComputedStyle(document.getElementById('meleeBtn')).display !== 'none', 5000));
    const a0 = await G(() => window.__app.game.debug.agents()[0]);
    for (let n = 0; n < 3; n++) { await wait(() => window.__app.game.info.meleeCd === 0, 5000); await tapAt('#meleeBtn'); await sleep(250); } // headless fps is low: wait out the swing cooldown in game time
    const a1 = await G(() => window.__app.game.debug.agents()[0]);
    R.fistDamage = a1 ? +(a0.hp - a1.hp).toFixed(2) : 'killed';
    ok('punchKick', R.fistDamage, R.fistDamage === 'killed' || R.fistDamage >= 2);
    ok('meleeSfx', null, await G(() => window.__app.sfx().includes('punch')));
    ok('comboReached', null, await G(() => window.__app.game.info.combo >= 3));
    // ---------- 6. vibro-machete from the shop, cuts deeper ----------
    await G(() => { const s = window.__app.surface, sh = s.world.mapData().shop; window.__app.game.debug.clear(); window.__app.game.debug.credits(600); s.debugMove(sh.x, sh.z + 2, 0); });
    await wait(() => /Shop/.test(document.getElementById('driveBtn').textContent), 8000);
    await G(() => window.__app.openShop('guns', 'Ozzie')); await sleep(400); // v7.3: 🛒 Shop now walks you into the store; the counter list is the same panel
    ok('shopHasBlade', null, await G(() => !!document.querySelector('[data-buy="blade"]')));
    await G(() => document.querySelector('[data-buy="blade"]').click()); await sleep(200);
    await G(() => document.querySelector('[data-buy="shotgun"]')?.click()); await sleep(200);
    await G(() => document.getElementById('shopClose').click());
    ok('hasBlade', null, await G(() => window.__app.game.info.hasBlade));
    await G(() => { const s = window.__app.surface, c = s.world.colony; s.debugMove(c.x + 200, c.z + 140, 0); });
    await sleep(600);
    await G(() => { window.__app.game.debug.spawn('hunter', 2.2, 0, true); window.__app.game.debug.calm(true); });
    await wait(() => getComputedStyle(document.getElementById('meleeBtn')).display !== 'none', 5000);
    R.meleeIcon = await G(() => document.getElementById('meleeBtn').textContent);
    const b0 = await G(() => window.__app.game.debug.agents()[0]);
    await tapAt('#meleeBtn'); await sleep(90); await shot('melee-blade'); await sleep(500);
    const b1 = await G(() => window.__app.game.debug.agents()[0]);
    R.bladeDamage = b1 ? +(b0.hp - b1.hp).toFixed(2) : 'killed';
    ok('bladeHits', R.bladeDamage, R.bladeDamage === 'killed' || R.bladeDamage >= 2); // hunter armor eats 30%
    ok('bladeSfx', null, await G(() => window.__app.sfx().includes('blade')));
    // weapon chip cycles blaster -> shotgun -> machete
    const cyc = [];
    for (let n = 0; n < 3; n++) { await tapAt('#gearChip'); await sleep(250); cyc.push(await G(() => window.__app.game.info.weapon)); }
    R.cycle = cyc.join('>'); ok('chipCycle', R.cycle, new Set(cyc).size === 3);
    await G(() => window.__app.game.switchWeapon('rifle'));
    // ---------- 7. rover locker refills shells ----------
    await G(() => { window.__app.game.debug.clear(); window.__app.game.progress.inv.shells = 0; window.__app.surface.summonRover(); });
    ok('roverLocker', await wait(() => window.__app.game.progress.inv.shells >= 24, 8000));
    // ---------- 8. fire from a stolen vehicle; shooting in the colony is a crime ----------
    const v = await G(() => window.__app.surface.world.debug.vehicles().find(v => v.kind === 'buggy' && v.parked));
    await G(v => { window.__app.surface.world.setWanted(0); window.__app.surface.debugMove(v.x + 3.4, v.z + 1.2, 1.2); }, v);
    await wait(() => /Take/.test(document.getElementById('driveBtn').textContent), 8000);
    await tapAt('#driveBtn');
    ok('inStolen', await wait(() => window.__app.surface.info.driving && window.__app.surface.info.stolen, 6000));
    await G(() => window.__app.surface.world.setWanted(0)); await sleep(2700); // stealing it may already have drawn a star
    ok('fireInStolen', await wait(() => getComputedStyle(document.getElementById('fireBtn')).display !== 'none', 4000));
    const s1 = await G(() => window.__app.game.progress.stats.shots);
    const fc2 = await center('#fireBtn');
    for (let n = 0; n < 30; n++) { await page.touchscreen.tap(fc2.x, fc2.y); await sleep(150); if (n === 5) await shot('stolen-vehicle-firing'); if (n > 5 && await G(() => window.__app.surface.info.wanted > 0)) break; }
    R.stolenShots = (await G(() => window.__app.game.progress.stats.shots)) - s1; ok('stolenShots', R.stolenShots, R.stolenShots > 0);
    ok('shootingIsCrime', await wait(() => window.__app.surface.info.wanted > 0, 5000));
    // ---------- HUD: nothing overlaps in this state ----------
    R.overlaps = await G(() => {
      const ids = ['topBar', 'miniMap', 'surfBtns', 'fireBtn', 'meleeBtn', 'joy'], rs = ids.map(id => { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return r.width ? { id, r } : null; }).filter(Boolean), o = [];
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i].r, b = rs[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) o.push(rs[i].id + '/' + rs[j].id); }
      return o;
    });
    ok('noOverlap', R.overlaps.join(',') || 'none', !R.overlaps.length);
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('consoleErrors');
  R.bad = bad; console.log(JSON.stringify(R));
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
