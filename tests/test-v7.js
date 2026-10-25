// v7 gameplay test: commandeer, radio, wanted gain/lose, bust, shop, a contact mission (race), gritty combat, console errors.
// BASE=http://localhost:8765/ DEV="iPhone 14" BR=webkit node test-v7.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || '';
const out = '/workspace/solar-system/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = (DEV ? DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'desktop') + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const d = DEV ? (({ defaultBrowserType, ...o }) => o)(devices[DEV]) : { viewport: { width: 1280, height: 800 } };
  const page = await (await browser.newContext(d)).newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}v7-${tag}-${s}.png` });
  const unlock = () => G(() => document.exitPointerLock?.());
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('version', await G(() => window.__app.version), (await G(() => window.__app.version)) === 'v7');
    await G(() => { localStorage.removeItem('ssx.game.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000);
    await sleep(1200); await unlock();
    const S = 'window.__app.surface';
    // --- colony + commandeer ---
    const veh = await G(() => window.__app.surface.world.debug.vehicles().find(v => v.kind === 'buggy'));
    await G(v => { window.__app.surface.debugMove(v.x + 3.2, v.z + 1, 1.2); window.__app.game.debug.clear(); }, veh);
    ok('nearVehicle', await wait(() => window.__app.surface.info.nearVehicle?.kind === 'buggy', 15000));
    await wait(() => /Take/.test(document.getElementById('driveBtn').textContent), 5000);
    R.btn = await G(() => document.getElementById('driveBtn').textContent); ok('takeBtn', R.btn, /Take/.test(R.btn));
    await shot('colony-take');
    await G(() => document.getElementById('driveBtn').click());
    ok('stolen', await wait(() => window.__app.surface.info.driving && window.__app.surface.info.stolen, 8000));
    R.vehicle = await G(() => window.__app.surface.info.vehicle);
    ok('radioOn', await G(() => window.__app.sfx().includes('radioOn')), await G(() => window.__app.sfx().includes('radioOn')));
    R.stationToast = await G(() => document.getElementById('toast').textContent);
    // drive forward a bit
    await page.keyboard.down('KeyW'); await sleep(2500); await page.keyboard.up('KeyW');
    R.speedSeen = await G(() => window.__app.surface.info.speed);
    // radio next
    if (DEV) await page.tap('#radioBtn'); else await page.keyboard.press('KeyN');
    await sleep(500);
    R.station = await G(() => window.__app.sfx().filter(s => s.startsWith('station:')).pop());
    ok('radioSwitch', R.station, !!R.station);
    R.radioToast = await G(() => document.getElementById('toast').textContent); ok('radioToastShown', R.radioToast, /📻/.test(R.radioToast));
    await shot('driving-radio');
    // --- wanted ---
    await G(() => window.__app.surface.world.setWanted(3, 'Grand theft buggy.'));
    ok('wanted3', await wait(() => window.__app.surface.info.wanted === 3 && document.getElementById('wantedStars').textContent === '★★★', 5000));
    ok('pursuit', await wait(() => window.__app.surface.world.debug.security().length > 0, 20000));
    R.security = await G(() => window.__app.surface.world.debug.security().map(s => s.kind).join(','));
    await sleep(1500); await shot('wanted-pursuit');
    R.mapIcons = await G(() => { const m = window.__app.mapInfo(); return { colony: m.colony, vehicles: m.vehicles, people: m.people, contacts: m.contacts, security: m.security, shop: m.shop }; });
    // lose them: far out in the desert
    await G(() => { const c = window.__app.surface.world.colony; window.__app.surface.debugMove(c.x + 620, c.z + 380, 0); });
    ok('evading', await wait(() => window.__app.surface.info.evading || window.__app.surface.info.wanted === 0, 40000));
    ok('wantedLost', await wait(() => window.__app.surface.info.wanted === 0, 90000));
    ok('lostEvent', null, await G(() => window.__app.sfx().includes('lost')));
    // --- busted: on foot next to a guard at 2 stars ---
    await G(() => { const s = window.__app.surface; if (s.info.driving) s.interact(); const g = s.world.debug.people().find(p => p.kind === 'guard'); s.debugMove(g.x + 1.5, g.z + 1.5); window.__app.game.debug.credits(400); s.world.setWanted(2, 'test'); });
    ok('busted', await wait(() => window.__app.game.progress.stats.busted > 0, 45000));
    await wait(() => !window.__app.game.isDown?.() && window.__app.surface.info.wanted === 0, 20000);
    R.afterBust = await G(() => ({ wanted: window.__app.surface.info.wanted, credits: window.__app.game.info.credits, colonyDist: window.__app.surface.info.colony?.dist }));
    // --- shop ---
    await G(() => { const s = window.__app.surface, sh = s.world.mapData().shop; window.__app.game.debug.credits(800); s.debugMove(sh.x, sh.z + 2.0, 0); });
    ok('nearShop', await wait(() => window.__app.surface.info.nearShop, 10000));
    await wait(() => /Shop/.test(document.getElementById('driveBtn').textContent), 4000);
    await unlock(); await G(() => document.getElementById('driveBtn').click()); await sleep(400);
    ok('shopOpen', null, await page.isVisible('#shopPanel'));
    await shot('shop');
    await G(() => document.querySelector('[data-buy="shotgun"]').click()); await sleep(200);
    await G(() => document.querySelector('[data-buy="medkit"]').click()); await sleep(200);
    R.shopMsg = await G(() => document.getElementById('shopMsg').textContent);
    ok('boughtShotgun', null, await G(() => window.__app.game.info.hasShotgun));
    await G(() => document.getElementById('shopClose').click());
    // --- gritty combat with the shotgun ---
    R.weapon = await G(() => window.__app.game.info.weapon);
    await G(() => { const s = window.__app.surface, c = s.world.colony; s.debugMove(c.x + 150, c.z + 160, 0); window.__app.game.setAliens(true); });
    await sleep(800);
    await G(() => { window.__app.game.debug.spawn('crawler', 9, 0, true); window.__app.game.debug.spawn('crawler', 11, 0.3, true); });
    await page.keyboard.down('KeyF');
    const killed = await wait(() => window.__app.game.progress.stats.kills >= 1, 30000);
    await page.keyboard.up('KeyF');
    ok('kill', killed); R.kills = await G(() => window.__app.game.progress.stats.kills); R.hpAfterFight = await G(() => Math.round(window.__app.game.info.hp));
    R.debris = await G(() => window.__app.game.debug.debrisCount()); ok('ichorDebris', R.debris, R.debris > 0);
    R.combatSfx = await G(() => [...new Set(window.__app.sfx().filter(s => /shotgun|squelch|screech|slash|zap|tracker|hurt/.test(s)))].join(','));
    await shot('combat-ichor');
    await page.keyboard.press('KeyQ'); await sleep(200); R.swapped = await G(() => window.__app.game.info.weapon);
    await G(() => window.__app.game.debug.clear());
    // --- mission: Vesna's race ---
    await G(() => { const s = window.__app.surface, v = s.world.debug.people().find(p => p.name === 'Vesna'); s.debugMove(v.x + 1.5, v.z + 1.5, 0); });
    ok('nearContact', await wait(() => window.__app.surface.info.nearContact === 'Vesna', 10000));
    await wait(() => /Vesna/.test(document.getElementById('driveBtn').textContent), 4000);
    await G(() => document.getElementById('driveBtn').click());
    ok('offer', await wait(() => document.getElementById('radio').style.display === 'block' && document.getElementById('radioBtns').style.display === 'flex', 5000));
    R.offerFrom = await G(() => document.getElementById('radioFrom').textContent);
    await shot('contact-offer');
    await G(() => document.getElementById('radioAccept').click());
    ok('acceptedOffer', await wait(() => !!window.__app.game.debug.quest(), 4000)); R.offeredJob = await G(() => window.__app.game.debug.quest()?.id);
    ok('accepted', await G(() => window.__app.game.accept('mars-race')));
    const v2 = await G(() => window.__app.surface.world.debug.vehicles().find(v => v.parked && v.kind !== 'shuttle'));
    await G(v => window.__app.surface.debugMove(v.x + 3, v.z + 1, 0), v2);
    await wait(() => window.__app.surface.info.nearVehicle, 8000);
    await G(() => { if (!window.__app.surface.info.driving) document.getElementById('driveBtn').click(); });
    ok('raceStart', await wait(() => window.__app.game.debug.quest()?.step === 1, 8000));
    for (let k = 0; k < 6; k++) { await G(() => window.__app.surface.debugQuestGo(0)); await wait(k2 => (window.__app.game.debug.quest()?.gi || 0) > k2 || !window.__app.game.debug.quest(), 6000, k); if (k === 2) await shot('race-gate'); }
    ok('raceDone', await wait(() => window.__app.game.progress.done?.includes?.('mars-race') || window.__app.game.questList('Mars').find(q => q.id === 'mars-race')?.done, 8000));
    R.log = await G(() => window.__app.gameLog?.slice?.(-12));
    // --- leave it, rover still the "return" target ---
    await G(() => { const s = window.__app.surface; if (s.info.driving) s.interact(); });
    R.roverTarget = await G(() => !!window.__app.mapInfo().rover);
    R.fictionTags = await G(() => document.body.innerHTML.includes('(Fiction!)'));
    ok('noKidTags', R.fictionTags, !R.fictionTags);
  } catch (e) { R.fail = e.message.split('\n')[0]; bad.push('exception'); }
  R.errors = errors; if (errors.length) bad.push('console errors');
  R.verdict = bad.length ? 'FAIL ' + bad.join(',') : 'PASS';
  console.log(JSON.stringify(R)); await browser.close();
})();
