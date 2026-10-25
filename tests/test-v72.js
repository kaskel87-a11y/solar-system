// v7.2 test: air steering (yaw + bank) with the stick while airborne, Roadster-style cold-gas Thrust (lift, fuel drain,
// ground recharge), rover blaster with hostiles off and while flying, rover weapon upgrades (tiers, rail, rockets, torch,
// EMP) bought at the shop, switched with the weapon chip and persisted, the Roadster kit, multi-touch stick + Thrust
// (Chromium CDP), and the PWA bits (manifest, icons, service worker).
// BASE=http://localhost:8765/ DEV="iPhone 14" BR=webkit node test-v72.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'v72';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...d } = devices[DEV];
  const ctx = await browser.newContext(d); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const vis = sel => G(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
  const center = sel => G(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapAt = async sel => { const c = await center(sel); await page.touchscreen.tap(c.x, c.y); };
  // hold a HUD button with a real pointer sequence on the element (WebKit has no multi-touch injection)
  const press = (sel, down) => G(([s, dn]) => { const el = document.querySelector(s), r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent(dn ? 'pointerdown' : 'pointerup', { pointerId: 41, pointerType: 'touch', isPrimary: false, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); }, [sel, down]);
  const I = () => G(() => window.__app.surface.info);
  const yawDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800); };
  const enterRover = async () => {
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await wait(() => /Drive/.test(document.getElementById('driveBtn').textContent), 8000); await tapAt('#driveBtn');
    return wait(() => window.__app.surface.info.driving && !window.__app.surface.info.stolen, 8000);
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('version', await G(() => window.__app.version), /^v7\.[2-9]/.test(await G(() => window.__app.version)));
    // ---------- PWA bits ----------
    const pwa = await G(async () => {
      const m = document.querySelector('link[rel=manifest]'), at = document.querySelector('link[rel=apple-touch-icon]');
      const man = m ? await (await fetch(m.href)).json() : null;
      const icons = man ? await Promise.all(man.icons.map(async i => (await fetch(new URL(i.src, m.href))).ok)) : [];
      return { man: !!man, name: man?.name, display: man?.display, scope: man?.scope, start: man?.start_url, icons: icons.every(Boolean) && icons.length >= 4, maskable: !!man?.icons.some(i => i.purpose === 'maskable'),
        apple: !!at && (await fetch(at.href)).ok, cap: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content, bar: document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]')?.content,
        title: document.querySelector('meta[name=apple-mobile-web-app-title]')?.content, sw: 'serviceWorker' in navigator };
    });
    R.pwa = JSON.stringify(pwa);
    ok('manifest', pwa.man && pwa.name === 'Solar System Explorer' && /fullscreen|standalone/.test(pwa.display) && pwa.scope === '/solar-system/' && pwa.icons && pwa.maskable);
    ok('iosMeta', pwa.apple && pwa.cap === 'yes' && pwa.bar === 'black-translucent' && !!pwa.title);
    if (BR === 'chromium') ok('serviceWorker', null, await G(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 15000))]); return !!r?.active; }));
    // ---------- share with friends: OG/Twitter meta + share sheet / copy-link fallback ----------
    const og = await G(async () => { const q = n => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content; const img = q('og:image');
      let imgOk = false; try { imgOk = (await fetch(img.replace('https://kaskel87-a11y.github.io/solar-system/', new URL('.', location.href).href))).ok; } catch (_) {}
      return { title: q('og:title'), desc: q('og:description'), img, w: q('og:image:width'), h: q('og:image:height'), tw: q('twitter:card'), twImg: q('twitter:image'), url: q('og:url'), imgOk }; });
    R.og = JSON.stringify(og);
    ok('ogMeta', null, og.title && og.desc && /^https:\/\/kaskel87-a11y\.github\.io\/solar-system\/share-card\.jpg$/.test(og.img) && og.w === '1200' && og.h === '630' && og.tw === 'summary_large_image' && og.twImg === og.img && og.url === 'https://kaskel87-a11y.github.io/solar-system/' && og.imgOk);
    const shareRes = await G(async () => {
      const btn = document.getElementById('shareBtn'); if (!btn || !document.getElementById('roverMenu').contains(btn)) return { inMenu: false };
      let got = null; Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { got = d; } });
      btn.click(); await new Promise(r => setTimeout(r, 200)); const sheet = { got, last: window.__lastShare };
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      let copied = null; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { copied = t; } } }); } catch (_) {}
      btn.click(); await new Promise(r => setTimeout(r, 200));
      return { inMenu: true, sheet, copied, last: window.__lastShare, toast: document.getElementById('toast')?.textContent || '' };
    });
    R.share = JSON.stringify(shareRes);
    ok('shareSheet', null, shareRes.inMenu && shareRes.sheet.got?.url === 'https://kaskel87-a11y.github.io/solar-system/' && /Solar System/.test(shareRes.sheet.got?.title) && shareRes.sheet.got?.text?.length > 10 && shareRes.sheet.last === 'shared');
    ok('shareCopyFallback', null, shareRes.copied === 'https://kaskel87-a11y.github.io/solar-system/' && shareRes.last === 'copied');
    await G(() => { localStorage.removeItem('ssx.progress.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await land();
    await tapAt('#menuBtn'); await sleep(400);
    ok('shareInMenu', null, (await vis('#shareBtn')) && (await vis('#a2hsBtn') || await G(() => document.body.classList.contains('standalone'))));
    await shot('menu-share'); await tapAt('#rmClose'); await sleep(300);
    await G(() => { window.__app.game.setAliens(false); window.__app.game.debug.clear(); const s = window.__app.surface, c = s.world.colony; s.debugMove(c.x + 160, c.z + 170, 0); });
    await sleep(600);
    ok('enterRover', null, await enterRover());
    await sleep(500);
    // ---------- 1. Thrust button + fuel bar (reuses the Jump slot) ----------
    ok('thrustBtn', await vis('#jumpBtn'));
    R.hud = JSON.stringify(await G(() => window.__thrustHud()));
    ok('thrustLabel', null, await G(() => /Thrust/.test(window.__thrustHud().label) && window.__thrustHud().bar === '100%'));
    const thrBox = await G(() => { const r = document.getElementById('jumpBtn').getBoundingClientRect(); return { l: r.left / innerWidth, r: r.right / innerWidth, t: r.top / innerHeight, b: r.bottom / innerHeight }; });
    ok('thrustOutsideMiddle', JSON.stringify(thrBox), thrBox.l > 0.75 || thrBox.r < 0.25 || thrBox.t > 0.75 || thrBox.b < 0.25);
    // ---------- 2. thrust lifts the rover; fuel drains ----------
    const f0 = (await I()).thrust.fuel, y0 = (await I()).roverY;
    await press('#jumpBtn', true);
    const lifted = await wait(() => window.__app.surface.info.carAlt > 6, 30000);
    const i1 = await I();
    ok('thrustLifts', `alt ${i1.carAlt.toFixed(1)} m, fuel ${f0}→${i1.thrust.fuel}`, lifted && i1.roverY > y0 + 4 && i1.thrust.on);
    ok('fuelDrains', null, i1.thrust.fuel < f0);
    ok('fuelBarMoves', await G(() => window.__thrustHud().bar), (await G(() => parseInt(window.__thrustHud().bar))) < 100);
    ok('jetsVisible', i1.thrust.jet, i1.thrust.jet > 0.5);
    // ---------- 3. air steering: stick left/right turns and banks while airborne ----------
    let yA = (await I()).carYaw;
    await G(() => { window.__app.joy.x = -1; window.__app.joy.y = -0.3; });
    const turnedL = await wait(y => { const i = window.__app.surface.info, d = Math.atan2(Math.sin(i.carYaw - y), Math.cos(i.carYaw - y)); return i.carAir && d > 0.6 && i.roverRoll > 0.15; }, 20000, yA);
    const iL = await I(); R.bankL = +iL.roverRoll.toFixed(2);
    await shot('banking-left');
    ok('airTurnLeft', `${yawDiff(iL.carYaw, yA).toFixed(2)} rad`, turnedL && iL.carAir);
    ok('bankLeft', R.bankL, iL.roverRoll > 0.15);
    yA = iL.carYaw;
    await G(() => { window.__app.joy.x = 1; });
    const turnedR = await wait(y => { const i = window.__app.surface.info, d = Math.atan2(Math.sin(i.carYaw - y), Math.cos(i.carYaw - y)); return i.carAir && d < -0.6 && i.roverRoll < -0.15; }, 20000, yA);
    const iR = await I(); R.bankR = +iR.roverRoll.toFixed(2);
    ok('airTurnRight', `${yawDiff(iR.carYaw, yA).toFixed(2)} rad`, turnedR);
    ok('bankRight', R.bankR, iR.roverRoll < -0.15);
    await shot('thrust-banking-right');
    // chase cam follows the heading in the air
    const camLag = await G(() => { const i = window.__app.surface.info; return Math.abs(Math.atan2(Math.sin(i.viewYaw - i.carYaw), Math.cos(i.viewYaw - i.carYaw))); });
    ok('chaseCamFollows', +camLag.toFixed(2), camLag < 0.8);
    // ---------- 4. rover blaster with hostiles OFF, while flying ----------
    const s0 = await G(() => window.__app.game.progress.stats.shots);
    ok('fireBtnFlying', await vis('#fireBtn'));
    for (let n = 0; n < 6; n++) { await G(() => window.__app.game.fire(null)); await sleep(150); }
    const s1 = await G(() => window.__app.game.progress.stats.shots);
    ok('turretFiresPeacefulFlying', s1 - s0, s1 > s0 && (await I()).carAir);
    // steering in the air without thrust (just a jump/fall)
    await press('#jumpBtn', false);
    yA = (await I()).carYaw; await G(() => { window.__app.joy.x = -1; window.__app.joy.y = 0; });
    const coast = await wait(y => { const i = window.__app.surface.info, d = Math.atan2(Math.sin(i.carYaw - y), Math.cos(i.carYaw - y)); return i.carAir && !i.thrust.on && d > 0.3; }, 15000, yA);
    ok('airTurnNoThrust', null, coast);
    await G(() => { window.__app.joy.x = 0; window.__app.joy.y = 0; });
    // ---------- 5. fuel runs out, then recharges on the ground ----------
    await wait(() => !window.__app.surface.info.carAir, 30000);
    await press('#jumpBtn', true);
    const empty = await wait(() => window.__app.surface.info.thrust.fuel <= 1, 90000);
    const iE = await I();
    ok('fuelDepletes', iE.thrust.fuel, empty);
    await sleep(400);
    ok('noThrustWhenEmpty', null, !(await I()).thrust.on);
    await press('#jumpBtn', false);
    const landed = await wait(() => !window.__app.surface.info.carAir, 40000);
    const recharged = await wait(() => window.__app.surface.info.thrust.fuel >= 60, 60000);
    ok('fuelRecharges', `${landed} → ${(await I()).thrust.fuel}`, landed && recharged);
    // ---------- 6. rover weapons from the shop ----------
    await G(() => window.__app.game.debug.credits(5000));
    const buys = await G(() => ['turret2', 'turret3', 'rail', 'rockets', 'torch', 'emp'].map(id => window.__app.game.buy(id).ok));
    ok('buyRoverWeapons', buys.join(','), buys.every(Boolean));
    const shopGroups = await G(() => [...new Set(window.__app.game.shopList().items.map(i => i.group))]);
    ok('shopGroup', shopGroups.join('|'), shopGroups.includes('Rover weapons') && shopGroups.includes('Rover body'));
    R.owned = (await G(() => window.__app.game.info.rover.owned)).join(',');
    ok('ownedMounts', R.owned, R.owned === 'cannon,rail,rockets,torch,emp');
    // chip cycles mounts by touch
    const seen = [];
    for (let n = 0; n < 5; n++) { await tapAt('#gearChip'); await sleep(350); seen.push(await G(() => window.__app.game.info.rover.id)); }
    R.cycle = seen.join('>');
    ok('chipCyclesMounts', R.cycle, new Set(seen).size === 5);
    R.chip = await G(() => document.getElementById('gearChip').textContent);
    // each mount actually hurts things (hostiles on, calm crawler ahead)
    await G(() => window.__app.game.setAliens(true));
    const kills = {};
    for (const id of ['cannon', 'rail', 'rockets', 'torch', 'emp']) {
      await G(id => { const g = window.__app.game; g.debug.clear(); g.debug.cool(); g.switchWeapon(id); }, id); await wait(() => window.__app.game.debug.bolts() === 0, 5000); await sleep(300);
      await G(id => { const g = window.__app.game; g.debug.clear(); g.debug.cool(); g.debug.spawn('crawler', id === 'torch' ? 9 : id === 'emp' ? 10 : 22, 0, true); g.debug.calm(true); }, id);
      await sleep(500);
      const k0 = await G(() => window.__app.game.progress.stats.kills);
      let hit = false;
      for (let n = 0; n < 90 && !hit; n++) {
        await G(() => window.__app.game.fire(null)); await sleep(id === 'emp' ? 400 : 90);
        if (n === 2 && (id === 'rail' || id === 'rockets')) await shot(`rover-${id}-firing`);
        hit = await G(k => window.__app.game.progress.stats.kills > k || window.__app.game.debug.agents().some(a => a.hp < 4), k0);
      }
      if (id === 'emp') R.emp = JSON.stringify(await G(() => window.__app.game.info.rover.lastEmp));
      kills[id] = hit; ok('mount_' + id, hit);
    }
    R.mountHits = JSON.stringify(kills);
    await G(() => { window.__app.game.debug.clear(); window.__app.game.switchWeapon('rockets'); });
    // ---------- 7. Roadster kit ----------
    ok('buyKit', null, await G(() => window.__app.game.buy('kit:roadster').ok));
    await sleep(300);
    const ik = await I();
    ok('kitFitted', `kit=${ik.kit} max=${ik.thrust.max}`, ik.kit && ik.thrust.max === 130);
    await press('#jumpBtn', true); await G(() => { window.__app.joy.x = 0.7; window.__app.joy.y = -0.5; });
    await wait(() => window.__app.surface.info.carAlt > 5, 30000); await sleep(600);
    await G(() => window.__app.game.fire(null)); await sleep(60);
    await shot('roadster-thrust-rockets');
    await press('#jumpBtn', false); await G(() => { window.__app.joy.x = 0; window.__app.joy.y = 0; });
    // ---------- 8. persistence across a reload ----------
    await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    const P = await G(() => window.__app.game.progress);
    ok('persisted', `${P.equip.rover} ${P.equip.kit}`, P.equip.rover === 'rockets' && P.equip.kit === 'roadster' && P.unlocks.includes('rover:emp') && P.upgrades.includes('turret3'));
    // ---------- 9. multi-touch: thumb on the stick + Thrust (Chromium CDP) ----------
    if (BR === 'chromium') {
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land();
      await G(() => { window.__app.game.setAliens(false); const s = window.__app.surface, c = s.world.colony; s.debugMove(c.x + 160, c.z + 170, 0); }); await sleep(500);
      ok('enterRover2', null, await enterRover()); await sleep(500);
      const cdp = await ctx.newCDPSession(page);
      const j = await center('#joy'), t = await center('#jumpBtn');
      const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
      const y0m = (await I()).carYaw;
      await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(80);
      await T('touchMove', [{ x: j.x - 55, y: j.y - 10, id: 1 }]); await sleep(80);
      await T('touchStart', [{ x: j.x - 55, y: j.y - 10, id: 1 }, { x: t.x, y: t.y, id: 2 }]);
      const mtUp = await wait(() => window.__app.surface.info.carAlt > 4 && window.__app.surface.info.thrust.on, 30000);
      const mtTurn = await wait(y => { const i = window.__app.surface.info; return Math.atan2(Math.sin(i.carYaw - y), Math.cos(i.carYaw - y)) > 0.6; }, 20000, y0m);
      ok('multiTouchStickThrust', null, mtUp && mtTurn);
      await T('touchEnd', []); await sleep(300);
      ok('multiTouchRelease', null, await G(() => !window.__app.touchBtns.jump && window.__app.joy.x === 0));
    }
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  R.errors = errors.slice(0, 5);
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
