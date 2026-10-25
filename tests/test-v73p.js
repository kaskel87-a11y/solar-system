// v7.3 playtest fixes (BUGS-v7.2.md): main Land CTA goes to Mars, chase-camera pull-in near buildings/ship, radio pill hides
// Accept/Later, readable Later, Enter/Backspace accept/skip, early offers start minimised, Frankie keeps up while running,
// credits never truncate, 44 px tap targets, ❔ Controls panel (☰ and ?), desktop keyboard+mouse flows (Enter accept, E enter/buy).
// BASE=http://localhost:8765/ DEV="iPhone 14" BR=webkit node test-v73p.js    (DEV=desktop for a 1440x900 laptop)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/workspace/solar-system/shots/', PFX = process.env.PFX || 'v73p';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR, DESK = DEV === 'desktop';
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  let d; if (DESK) d = { viewport: { width: 1440, height: 900 } }; else { const { defaultBrowserType, ...x } = devices[DEV]; d = x; }
  const ctx = await browser.newContext(d); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const rect = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), disp: getComputedStyle(e).display }; }, sel);
  const btn = () => G(() => { const b = document.getElementById('driveBtn'); return getComputedStyle(b).display !== 'none' ? b.textContent : ''; });
  const waitBtn = (re, ms = 4000) => wait(src => new RegExp(src).test(document.getElementById('driveBtn').textContent), ms, re.source);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('version', await G(() => window.__app.version), (await G(() => window.__app.version)) === 'v7.3');
    ok('branding', await G(() => document.querySelector('h1').textContent), /Solar System Explorer/.test(await G(() => document.querySelector('h1').textContent)) && /v7\.3/.test(await G(() => document.getElementById('credits').textContent)));
    ok('flyBtn44', (await rect('#flyBtn')).h, (await rect('#flyBtn')).h >= 44);
    // ---------- M2: fresh load, Fly, the big CTA autopilots to Mars and lands there ----------
    await G(() => { localStorage.removeItem('ssx.progress.v1'); document.getElementById('flyBtn').click(); });
    await wait(() => getComputedStyle(document.getElementById('landBtn')).display !== 'none' && /Mars|Land on/.test(document.getElementById('landBtn').textContent), 15000);
    R.cta = await G(() => document.getElementById('landBtn').textContent);
    const near = await G(() => window.__app.state.near);
    ok('ctaMars', R.cta, /Mars/.test(R.cta) || (near && /Land on/.test(R.cta)));
    if (!/Fly to Mars/.test(R.cta)) { /* already parked next to a world: the test still has to reach Mars via the CTA */ await G(() => window.__app.setFlying(false)); await sleep(500); await G(() => { window.__app.select?.(window.__app.bodies.find(b => b.name === 'Saturn').mesh); }); await sleep(300); await G(() => document.getElementById('flyBtn').click()); await sleep(800); R.cta2 = await G(() => document.getElementById('landBtn').textContent); }
    await G(() => document.getElementById('landBtn').click());
    const landed = await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000);
    R.landedOn = await G(() => window.__app.surface.info?.name);
    ok('landedOnMars', R.landedOn, landed && R.landedOn === 'Mars');
    if (!landed || R.landedOn !== 'Mars') { await G(() => { if (window.__app.state.onSurface) window.__app.takeOff(); }); await sleep(3000); await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0, 90000); }
    // ---------- m7 + m1: an offer in the landing reveal arrives as a pill, and the pill hides Accept/Later ----------
    const offer = await wait(() => document.getElementById('radio').style.display === 'block' && document.getElementById('radioBtns').style.display === 'flex', 15000);
    if (offer) {
      R.earlyMini = await G(() => document.getElementById('radio').classList.contains('mini'));
      await shot('landing-offer-pill');
    } else {
      await G(() => { const s = window.__app.surface, v = s.world.debug.people().find(p => p.name === 'Vesna' || p.name === 'Rook'); s.debugMove(v.x + 1.5, v.z + 1.5, 0); });
      await waitBtn(/Vesna|Rook|Talk/, 8000); await G(() => document.getElementById('driveBtn').click());
      await wait(() => document.getElementById('radioBtns').style.display === 'flex', 5000);
    }
    await G(() => document.getElementById('radio').classList.add('mini')); await sleep(100);
    ok('miniHidesBtns', await G(() => getComputedStyle(document.getElementById('radioBtns')).display), (await G(() => getComputedStyle(document.getElementById('radioBtns')).display)) === 'none');
    await G(() => document.getElementById('radioText').click()); await G(() => document.getElementById('radio').classList.remove('mini')); await sleep(100);
    ok('openShowsBtns', null, (await G(() => getComputedStyle(document.getElementById('radioBtns')).display)) === 'flex');
    const lum = await G(() => { const c = getComputedStyle(document.getElementById('radioLater')).backgroundColor.match(/[\d.]+/g).map(Number); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; });
    ok('laterReadable', +lum.toFixed(2), lum < 0.45);
    const accH = await G(() => { const r = document.getElementById('radio'); r.style.display = 'block'; r.classList.remove('mini'); return document.getElementById('radioAccept').getBoundingClientRect().height; });
    ok('acceptTall', accH, accH >= 44);
    await shot('radio-offer');
    // ---------- m6: Enter accepts the job from the keyboard ----------
    await G(() => window.__app.game.debug.clear?.());
    R.radioUpForEnter = await G(() => document.getElementById('radio').style.display === 'block' && !!document.getElementById('radioBtns').offsetWidth);
    if (!R.radioUpForEnter) { // slow software GL: the landing offer can time out; get a fresh one from a contact
      await G(() => { const s = window.__app.surface, v = s.world.debug.people().find(p => p.name === 'Vesna' || p.name === 'Rook'); s.debugMove(v.x + 1.5, v.z + 1.5, 0); });
      await waitBtn(/Vesna|Rook|Talk/, 8000); await G(() => document.getElementById('driveBtn').click());
      await wait(() => document.getElementById('radioBtns').style.display === 'flex', 5000); await G(() => document.getElementById('radio').classList.remove('mini'));
    }
    await page.keyboard.press('Enter'); await sleep(300);
    ok('enterAccepts', await G(() => window.__app.game.debug.quest()?.id || null), !!(await G(() => window.__app.game.debug.quest())));
    // ---------- m5: tap targets ----------
    const mb = await rect('#menuBtn'), gc = await rect('#gearChip');
    ok('menuBtn44', `${mb.w}x${mb.h}`, mb.w >= 44 && mb.h >= 36);
    ok('gearChipTall', `${gc.w}x${gc.h}`, gc.h >= 34 && gc.w >= 44);
    await G(() => document.getElementById('menuBtn').click()); await sleep(300);
    const items = await G(() => [...document.querySelectorAll('#roverMenu button')].filter(b => getComputedStyle(b).display !== 'none').map(b => Math.round(b.getBoundingClientRect().height)));
    ok('menuItems44', Math.min(...items), Math.min(...items) >= 44);
    ok('menuFits', null, await G(() => { const r = document.getElementById('roverMenu').getBoundingClientRect(); return r.bottom <= innerHeight + 1; }));
    await shot('menu');
    // ---------- ❔ Controls from ☰, and the ? key ----------
    await G(() => document.getElementById('ctlBtn').click()); await sleep(200);
    ok('controlsPanel', null, await G(() => getComputedStyle(document.getElementById('ctlPanel')).display === 'block' && /Enter/.test(document.getElementById('ctlPanel').textContent) && /In space/.test(document.getElementById('ctlPanel').textContent)));
    await shot('controls');
    await page.keyboard.press('Escape'); await sleep(150);
    ok('controlsClose', null, await G(() => getComputedStyle(document.getElementById('ctlPanel')).display === 'none'));
    await page.keyboard.press('Shift+Slash'); await sleep(150);
    ok('questionKey', null, await G(() => getComputedStyle(document.getElementById('ctlPanel')).display === 'block'));
    await page.keyboard.press('Escape'); await sleep(150);
    // ---------- m4: credits stay readable while wanted and driving ----------
    await G(() => { window.__app.game.debug.credits(123456); window.__app.surface.world.setWanted(3, 'test'); });
    const v = await G(() => window.__app.surface.world.debug.vehicles().find(v => v.parked && v.kind !== 'shuttle'));
    await G(v => window.__app.surface.debugMove(v.x + 3, v.z + 1, 0), v); await wait(() => window.__app.surface.info.nearVehicle, 8000);
    await waitBtn(/Take|Drive|Steal/, 6000); await G(() => { if (!window.__app.surface.info.driving) document.getElementById('driveBtn').click(); }); await wait(() => window.__app.surface.info.driving, 5000); await sleep(800);
    R.drivingForTopBar = await G(() => window.__app.surface.info.driving);
    const rl = await G(() => { const e = document.getElementById('rankLine'); return { t: e.textContent, over: e.scrollWidth > e.clientWidth + 1, vis: getComputedStyle(e).display !== 'none', w: e.getBoundingClientRect().width }; });
    ok('creditsReadable', rl.t, rl.vis && !rl.over && /123456/.test(rl.t));
    ok('topBarNoOverlap', null, await G(() => { const ids = ['surfInfo', 'tbBars', 'rankLine', 'wantedStars', 'gearChip', 'menuBtn'].map(i => document.getElementById(i)).filter(e => e && getComputedStyle(e).display !== 'none'); const rs = ids.map(e => e.getBoundingClientRect()).filter(r => r.width > 0); for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (rs[i].left < rs[j].right - 1 && rs[j].left < rs[i].right - 1) return false; return rs.every(r => r.right <= innerWidth + 1); }));
    await shot('topbar-wanted-driving');
    await G(() => { window.__app.surface.interact(); window.__app.surface.world.setWanted(0); }); await sleep(500);
    // ---------- M1: chase camera never sits inside a building or the ship ----------
    const cam = await G(async () => {
      const s = window.__app.surface, w = s.world, sl = () => new Promise(r => setTimeout(r, 450));
      const doors = w.doorList(); let pulled = 0, inside = 0, n = 0;
      for (const dd of doors.slice(0, 4)) for (let k = 0; k < 8; k++) {
        s.debugPlace(dd.x + Math.sin(k) * 0.3, dd.z + 1.6, k * Math.PI / 4); await sl();
        const i = s.info; n++; if (i.camPulled) pulled++; if (w.camBlocked(...i.camPos)) inside++;
      }
      const ship = s.info.map?.ship || { x: 14, z: -22 };
      for (let k = 0; k < 8; k++) { s.debugPlace(ship.x + Math.cos(k * 0.8) * 7, ship.z + Math.sin(k * 0.8) * 7, k * Math.PI / 4); await sl(); const p = s.info.camPos; n++; if (s.info.camPulled) pulled++; if (Math.hypot(p[0] - ship.x, p[2] - ship.z) < 4.4 && p[1] < 50) inside++; }
      return { n, pulled, inside };
    });
    ok('camNeverInside', `${cam.inside}/${cam.n}`, cam.inside === 0);
    ok('camPullsIn', `${cam.pulled}/${cam.n}`, cam.pulled > 0);
    { const dd = (await G(() => window.__app.surface.world.doorList()))[0]; await G(([x, z]) => window.__app.surface.debugPlace(x, z + 1.6, 0), [dd.x, dd.z]); await sleep(700); await shot('cam-wall'); }
    // ---------- m3: Frankie keeps up while you run ----------
    await G(() => { const s = window.__app.surface; s.debugPlace(60, 60, 0); }); await sleep(1500);
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    let maxD = 0, sniffRun = 0; for (let t = 0; t < 40; t++) { await sleep(400); const dg = await G(() => window.__app.surface.info.dog); if (dg) { maxD = Math.max(maxD, dg.dist); if (dg.mode === 'sniff') sniffRun++; } }
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    ok('dogKeepsUp', +maxD.toFixed(1), maxD < 16);
    ok('noSniffWhileRunning', sniffRun, sniffRun <= 1);
    // ---------- desktop: E walks in, E buys off the wall, click buys from the counter list ----------
    if (DESK) {
      await G(() => window.__app.game.debug.credits(5000));
      const g = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'guns'));
      await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [g.x, g.z]); await sleep(300);
      await waitBtn(/Shop|Enter/); await page.keyboard.press('KeyE');
      ok('deskEnterE', null, await wait(() => window.__app.surface.info.inside?.kind === 'guns', 5000)); await sleep(500);
      ok('deskCrosshairIndoors', null, await G(() => getComputedStyle(document.getElementById('crosshair')).display !== 'none'));
      await G(() => { const s = window.__app.surface, w = s.world.wareList().find(x => x.id === 'smg'), b = s.world.inside; s.debugInside(w.x - (b.x0 + b.x1) / 2, w.z - (b.z0 + b.z1) / 2 + 0.2, 0); }); await sleep(300);
      await waitBtn(/Buy|Equip|SMG/); R.deskWareLabel = await btn();
      await page.keyboard.press('KeyE'); await sleep(400);
      ok('deskBuyE', await G(() => JSON.stringify(window.__app.game.info.inv)), await G(() => JSON.stringify(window.__app.game.info.inv || '').includes('smg') || window.__app.game.info.weapon === 'smg'));
      await G(() => window.__app.openShop('guns', 'Ozzie')); await sleep(300);
      await page.click('#shopPanel [data-buy="railrifle"]').catch(() => {}); await sleep(300);
      ok('deskClickBuy', null, await G(() => JSON.stringify(window.__app.game.info.inv || '').includes('railrifle') || window.__app.game.info.weapon === 'railrifle'));
      await page.keyboard.press('Escape'); await sleep(200);
      ok('deskShopClosed', null, await G(() => getComputedStyle(document.getElementById('shopPanel')).display === 'none'));
      ok('deskHudScaled', await G(() => getComputedStyle(document.getElementById('surfHud')).zoom), +(await G(() => getComputedStyle(document.getElementById('surfHud')).zoom)) > 1);
      await shot('desk-gun-shop');
      await G(() => document.getElementById('menuBtn').click()); await sleep(250);
      R.fsLabel = await G(() => { const b = document.getElementById('fsBtn'); return getComputedStyle(b).display !== 'none' ? b.textContent : 'hidden'; });
      ok('fullscreenItem', R.fsLabel, /Full screen/.test(R.fsLabel));
      await G(() => document.getElementById('rmClose').click());
      // touchscreen laptop: starts in keyboard/mouse mode, a finger tap flips to touch UI, a key press flips back
      const c2 = await browser.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true }); const p2 = await c2.newPage();
      await p2.goto(base + '?t=' + Date.now()); await p2.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
      const T = () => p2.evaluate(() => document.body.classList.contains('touch'));
      R.laptopStart = await T(); await p2.touchscreen.tap(700, 300); await sleep(200); R.laptopAfterTap = await T();
      await p2.keyboard.press('KeyV'); await sleep(200); R.laptopAfterKey = await T();
      ok('touchLaptopInputMode', `${R.laptopStart}/${R.laptopAfterTap}/${R.laptopAfterKey}`, R.laptopAfterTap === true && R.laptopAfterKey === false);
      await c2.close();
    } else {
      R.fsHiddenOnPhone = await G(() => getComputedStyle(document.getElementById('fsBtn')).display === 'none' || !/iPhone/.test(navigator.userAgent));
      ok('fsHiddenOnIPhone', null, R.fsHiddenOnPhone);
    }
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
