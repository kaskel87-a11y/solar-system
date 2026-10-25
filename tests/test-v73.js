// v7.3 test: walk-in buildings (every colony building has an interior and a job), physical shopping off wall racks and
// glass cases (context button + tap-to-buy), the 🛒 Shop button beating Pet, the ☰ 🛒 Shop radar mark, the supply store,
// Ozzie's gun shop (SMG/rail rifle/launcher/cleaver/ammo), the depot parts + paint walls, the cantina bar, the Velvet
// Airlock (cover, refusal while wanted, VIP rope), the security office bribe, max health/ammo upgrades, story missions.
// BASE=http://localhost:8765/ DEV="iPhone 14" BR=webkit node test-v73.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/workspace/solar-system/shots/', PFX = process.env.PFX || 'v73';
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
  const I = () => G(() => window.__app.surface.info);
  const waitBtn = (re, ms = 3000) => wait(src => new RegExp(src).test(document.getElementById('driveBtn').textContent), ms, re.source);
  const btn = () => G(() => { const b = document.getElementById('driveBtn'); return getComputedStyle(b).display !== 'none' ? b.textContent : ''; });
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800); };
  // stand at a building door (world coords from doorList) and walk in with the context button
  const door = k => G(k => window.__app.surface.world.doorList().find(d => d.kind === k), k);
  const goIn = async k => {
    const dd = await door(k); await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [dd.x, dd.z]); await sleep(250);
    await waitBtn(k === 'supply' || k === 'guns' || k === 'depot' ? /^🛒 Shop/ : /Enter/, 4000); const label = await btn();
    await tapAt('#driveBtn'); const inn = await wait(k => window.__app.surface.info.inside?.kind === k, 5000, k); await sleep(500); return { label, inn };
  };
  const leave = async () => { await G(() => window.__app.surface.leaveBuilding()); await sleep(300); };
  // stand at a room-local point (wares: their spot) and face the item
  const standAtWare = async id => G(id => { const s = window.__app.surface, w = s.world.wareList().find(x => x.id === id), b = s.world.inside; if (!w) return false; s.debugInside(w.x - (b.x0 + b.x1) / 2, w.z - (b.z0 + b.z1) / 2, 0); return true; }, id);
  const faceSpot = (lx, lz, yaw = 0) => G(([x, z, y]) => window.__app.surface.debugInside(x, z, y), [lx, lz, yaw]);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('version', await G(() => window.__app.version), /^v7\.[3-9]/.test(await G(() => window.__app.version)));
    ok('ssxApi', null, await G(() => ['registerColony', 'registerMission', 'registerInterior', 'registerMenuItem'].every(k => typeof window.SSX?.[k] === 'function')));
    await G(() => { localStorage.removeItem('ssx.progress.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); }); await land();
    await G(() => window.__app.game.debug.credits(6000));
    // ---------- every building: a door, an interior, and something to do inside ----------
    const doors = await G(() => window.__app.surface.world.doorList()); R.doors = doors.map(d => d.kind + ':' + d.name).join(', ');
    ok('allKinds', null, ['cantina', 'supply', 'depot', 'guns', 'club', 'security'].every(k => doors.some(d => d.kind === k)));
    ok('noDeadBlocks', null, await G(() => { const s = window.__app.surface; return s.world.mapData().doors.length === 6; }));
    // ---------- 🛒 Shop beats Pet near the supply store (7 m), ☰ 🛒 Shop marks the nearest store ----------
    const sup = await door('supply');
    await G(([x, z]) => { const s = window.__app.surface; s.debugPlace(x + 4.5, z + 4, 0); }, [sup.x, sup.z]); await sleep(400);
    await waitBtn(/^🛒 Shop/);
    ok('shopButton', await btn(), /^🛒 Shop/.test(await btn()));
    ok('petHiddenNearShop', null, !(await vis('#petBtn')));
    await G(([x, z]) => window.__app.surface.debugPlace(x + 40, z + 25, 0), [sup.x, sup.z]); await sleep(300);
    await G(() => document.getElementById('rmShopNav').click()); await sleep(400);
    ok('menuShopMark', null, await G(() => !!window.__app.mapInfo()?.shopMark || !!document.getElementById('toast').textContent.match(/radar/)));
    ok('radarDollar', await G(() => window.__app.mapInfo()?.shop || 0), (await G(() => window.__app.mapInfo()?.shop || 0)) >= 1);
    // ---------- supply store: wall rack (medkit), glass case (implant), tap-to-buy (rig), Frankie gear ----------
    let r = await goIn('supply'); ok('enterSupply', r.label, r.inn);
    ok('indoorsHidesFire', null, await G(() => document.body.classList.contains('indoors') && getComputedStyle(document.getElementById('fireBtn')).display === 'none'));
    const cam = await G(() => { const s = window.__app.surface, b = s.world.inside, c = s.camera.position; return { in: c.x > b.x0 && c.x < b.x1 && c.z > b.z0 && c.z < b.z1 && c.y > b.floor && c.y < b.y1 }; });
    ok('cameraInRoom', null, cam.in);
    const med0 = await G(() => window.__app.game.info.medkits);
    await standAtWare('medkit'); await waitBtn(/medkit/);
    ok('wallBuyLabel', await btn(), /^🛒 Buy Field medkit · \d+ cr/.test(await btn()) || /Buy .*medkit/i.test(await btn()));
    await tapAt('#driveBtn'); await sleep(300);
    ok('boughtOffWall', null, (await G(() => window.__app.game.info.medkits)) === med0 + 1);
    await standAtWare('vital1'); await waitBtn(/implant I /);
    ok('caseBuyLabel', await btn(), /Buy Trauma implant I · 250 cr/.test(await btn()));
    const hp0 = await G(() => window.__app.game.info.hpMax);
    await tapAt('#driveBtn'); await sleep(400);
    ok('boughtOffCase', null, (await G(() => window.__app.game.info.maxhp)) === 1 && (await G(() => window.__app.game.info.hpMax)) === hp0 + 15);
    await waitBtn(/owned/); ok('caseShowsOwned', await btn(), /owned/.test(await btn()));
    await shot('supply');
    // tap the item itself: project the rig1 tag to the screen
    await standAtWare('rig1'); await sleep(500);
    const scr = await G(() => { const s = window.__app.surface, t = s.world.wareTargets().find(m => m.userData.ware === 'rig1' && m.geometry.type === 'PlaneGeometry'); const v = t.getWorldPosition(t.position.clone()).project(s.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z }; });
    R.tapAt = `${Math.round(scr.x)},${Math.round(scr.y)}`;
    await page.touchscreen.tap(scr.x, scr.y); await sleep(500);
    ok('tapToBuy', null, await G(() => window.__app.game.info.maxammo === 1));
    await faceSpot(-6 + 2.1, 2.4, -Math.PI / 2); await waitBtn(/Clerk/); await tapAt('#driveBtn'); await sleep(300);
    ok('counterFallback', null, await G(() => document.getElementById('shopPanel').style.display === 'block' && /Supply counter/.test(document.getElementById('shopTitle').textContent)));
    await G(() => document.getElementById('shopClose').click());
    await leave();
    // ---------- gun shop: SMG off the rack, rounds out of the case, Ozzie's full list ----------
    r = await goIn('guns'); ok('enterGuns', r.label, r.inn);
    await standAtWare('smg'); await waitBtn(/SMG/);
    ok('gunRackLabel', await btn(), /Buy Viper SMG|Buy .*SMG/.test(await btn()));
    await tapAt('#driveBtn'); await sleep(300);
    const gi = await G(() => window.__app.game.info);
    ok('smgEquipped', `${gi.weapon} ${JSON.stringify(gi.ammo)}`, gi.weapon === 'smg' && gi.ammo?.type === 'rounds' && gi.ammo.n > 0);
    await waitBtn(/equipped/); ok('rackShowsEquipped', await btn(), /equipped/.test(await btn()));
    const rn = gi.ammo.n; await standAtWare('rounds'); await sleep(300); await tapAt('#driveBtn'); await sleep(300);
    ok('ammoFromCase', null, (await G(() => window.__app.game.info.inv.rounds)) > rn);
    await standAtWare('cleaver'); await sleep(300); await tapAt('#driveBtn'); await sleep(300);
    ok('cleaverBought', null, await G(() => window.__app.game.info.hasCleaver));
    ok('holstered', null, await G(() => { const g = window.__app.surface.game; const n = window.__app.gameLog.filter(t => t === 'zap').length; g.fire(); return window.__app.gameLog.filter(t => t === 'zap').length === n; }));
    await faceSpot(3.4, -1.0, Math.PI / 2); await waitBtn(/full list/);
    ok('ozzieCounter', await btn(), /full list/.test(await btn()));
    await tapAt('#driveBtn'); await sleep(400);
    ok('gunMenu', null, await G(() => document.getElementById('shopPanel').style.display === 'block' && /Gun counter/.test(document.getElementById('shopTitle').textContent) && /Rail rifle|Railgun|rail/i.test(document.getElementById('shopList').textContent)));
    await G(() => document.getElementById('shopClose').click());
    await faceSpot(0, 1.8, 0); await sleep(600); await shot('gun-shop');
    await leave();
    // ---------- depot: rover parts wall + paint wall ----------
    r = await goIn('depot'); ok('enterDepot', r.label, r.inn);
    await standAtWare('turret2'); await waitBtn(/Buy (?!.*medkit)/); ok('partsLabel', await btn(), /Buy .*· \d+ cr/.test(await btn()));
    await tapAt('#driveBtn'); await sleep(300);
    ok('roverPartBought', null, await G(() => window.__app.surface.game.shopItem('turret2').owned));
    const paint = await G(() => window.__app.surface.world.wareList().find(w => w.id.startsWith('paint:'))?.id);
    if (paint) { await standAtWare(paint); await sleep(300); await tapAt('#driveBtn'); await sleep(300); }
    ok('paintBought', paint, !!paint && await G(p => window.__app.surface.game.shopItem(p).owned, paint));
    await leave();
    // ---------- cantina: Dutch has work, the bar pours ----------
    r = await goIn('cantina'); ok('enterCantina', r.label, r.inn);
    await faceSpot(2.8, -2.3, 0); await waitBtn(/Dutch/); ok('dutchSpot', await btn(), /Dutch/.test(await btn()));
    await tapAt('#driveBtn'); await sleep(500);
    ok('dutchOffer', null, await G(() => /DUTCH/.test(document.getElementById('radioFrom').textContent) && getComputedStyle(document.getElementById('radio')).display !== 'none'));
    await faceSpot(-1.6, -2.3, 0); await sleep(300); await tapAt('#driveBtn'); await sleep(300);
    ok('barMenu', null, await G(() => /Bar/.test(document.getElementById('shopTitle').textContent) && /Whiskey|whisk/i.test(document.getElementById('shopList').textContent)));
    await G(() => document.getElementById('shopClose').click());
    await leave();
    // ---------- club: refused while wanted, cover charge, VIP rope ----------
    await G(() => window.__app.surface.world.setWanted(1, 'test'));
    const cd = await door('club'); await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(250);
    await tapAt('#driveBtn'); await sleep(400);
    ok('clubRefusedWanted', null, !(await I()).inside);
    await G(() => window.__app.surface.world.setWanted(0)); await sleep(200);
    const cr0 = await G(() => window.__app.game.info.credits);
    r = await goIn('club'); ok('enterClub', r.label, r.inn);
    ok('coverCharged', null, (await G(() => window.__app.game.info.credits)) === cr0 - 20);
    await faceSpot(0, 2.6, 0); await sleep(900); await shot('club');
    await leave();
    // ---------- security office: pay off the deputy ----------
    await G(() => window.__app.surface.world.setWanted(2, 'test'));
    r = await goIn('security'); ok('enterSecurity', r.label, r.inn);
    await faceSpot(0.2, -0.7, 0); await waitBtn(/Pay off/); ok('bribeLabel', await btn(), /Pay off Rusk · \d+ cr/.test(await btn()));
    await tapAt('#driveBtn'); await sleep(400);
    ok('bribed', null, (await I()).wanted === 0);
    await leave();
    // ---------- story missions in the quest list ----------
    ok('storyMissions', null, await G(() => { const q = window.__app.surface.game.questList?.() || []; const ids = q.map(x => x.id); return ['dutch-01-sweep', 'ozzie-01-testfire'].every(i => ids.includes(i)); }));
    R.errors = errors.slice(0, 6);
    ok('noErrors', null, errors.filter(e => !/favicon|404/.test(e)).length === 0);
  } catch (e) { R.crash = e.stack?.slice(0, 600); bad.push('crash'); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
