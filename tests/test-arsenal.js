// Mars arsenal (mars/arsenal.js + mars/gunsmith.js, SSX.arsenal): weapon wheel (hold Q / long-press the HUD chip / dock
// button), every weapon fires + reloads through game.fire, rail charge, headshots (security + people), blood decals,
// Bore's contraband trade + mods (suppressor, scope), cash at a markup, persistence, the Rust Pit fists-only rule.
// BASE=http://127.0.0.1:8889/ BR=webkit DEV="iPhone 14" OUT=./shots/arsenal/ node tests/test-arsenal.js   (one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8889/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(150); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(400); return b; };
  const landed = () => wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0 && !!window.SSX?.arsenal, 120000);
  const fireUntil = (id, n = 1, ms = 20000) => G(async ([id, n, ms]) => { // fire through game.fire until n shots land (the game's own cooldown gates it)
    const A = window.SSX.arsenal, s0 = A.debug.stats(), g0 = window.__app.game.progress.stats?.shots || 0, t0 = performance.now();
    while (A.debug.stats().shots + A.debug.stats().swings - s0.shots - s0.swings < n && performance.now() - t0 < ms) { window.__app.game.fire({ x: 0, y: 0.05 }); await new Promise(r => setTimeout(r, 60)); }
    const s = A.debug.stats(); return { shots: s.shots - s0.shots, swings: s.swings - s0.swings, core: (window.__app.game.progress.stats?.shots || 0) - g0, cur: A.current() };
  }, [id, n, ms]);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.arsenal, 20000);
    ok('api', await G(() => ['weapons', 'equip', 'current', 'ammo', 'give', 'mods', 'on'].every(k => typeof window.SSX.arsenal[k] === 'function') && !!window.SSX.arsenal.gunsmith));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await landed(); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const A = window.SSX.arsenal; A.debug.reset(); window.__app.game.debug?.calm?.(true); window.__app.game.progress.credits = 5000; window.__app.game.save(); window.__app.surface.world.setWanted(0);
      window.__aev = []; A.on(e => window.__aev.push({ type: e.type, id: e.id, head: e.head, kind: e.kind, dmg: e.dmg, open: e.open, pick: e.pick })); window.__wev = 0; addEventListener('ssx:arsenal', () => window.__wev++); });
    // gear up (pistol + knife are the starter kit)
    R.give = await G(() => { const A = window.SSX.arsenal; return ['smg:60', 'shotgun:24', 'rifle:96', 'rail:6'].map(s => { const [id, n] = s.split(':'); return A.give(id, +n).ok; }); });
    ok('give', R.give, R.give.every(Boolean));
    const C = await G(() => { const c = window.__app.surface.world.colony; return { x: c.x, z: c.z }; });
    const spot = (dx, dz) => G(([x, z]) => window.__app.surface.debugMove(x, z, 0), [C.x + dx, C.z + dz]);
    await spot(-200, 40); await sleep(500);
    // ---- wheel ----
    if (desk) {
      await page.keyboard.down('KeyQ'); const opened = await wait(() => document.getElementById('arWheel').classList.contains('open'), 3000);
      const slot = await center('#arWheel .slot[data-id="rifle"]'); if (slot) await page.mouse.move(slot.x, slot.y); await sleep(250);
      await page.keyboard.up('KeyQ'); await sleep(400);
      R.wheelQ = await G(() => ({ open: document.getElementById('arWheel').classList.contains('open'), cur: window.SSX.arsenal.current().id, n: document.querySelectorAll('#arWheel .slot').length }));
      ok('wheelHoldQ', { opened, slot, ...R.wheelQ }, opened && slot && slot.w >= 44 && !R.wheelQ.open && R.wheelQ.cur === 'rifle');
      await page.keyboard.press('KeyQ'); await sleep(400); R.tapQ = await G(() => window.SSX.arsenal.current().id); ok('tapQCycles', R.tapQ, R.tapQ !== 'rifle');
    } else {
      // long-press the HUD weapon chip
      const chip = await center('#gearChip');
      await G(() => { const e = document.getElementById('gearChip'), r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', clientX: r.x + 5, clientY: r.y + 5, isPrimary: true })); });
      const opened = await wait(() => document.getElementById('arWheel').classList.contains('open'), 3000);
      await G(() => { const e = document.getElementById('gearChip'), r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'touch', clientX: r.x + 5, clientY: r.y + 5, isPrimary: true })); });
      await sleep(500);
      const slot = await center('#arWheel .slot[data-id="rifle"]');
      await page.screenshot({ path: out + `arsenal-wheel-${tag}.png` });
      if (slot) await page.touchscreen.tap(slot.x, slot.y); await sleep(500);
      R.wheelLP = await G(() => ({ open: document.getElementById('arWheel').classList.contains('open'), cur: window.SSX.arsenal.current().id }));
      ok('wheelLongPress', { chip, opened, slot, ...R.wheelLP }, chip && opened && slot && slot.w >= 44 && !R.wheelLP.open && R.wheelLP.cur === 'rifle');
      const dock = await center('#arDockBtn');
      if (dock) { await tapSel('#arDockBtn'); }
      const dOpen = await G(() => document.getElementById('arWheel').classList.contains('open'));
      if (dOpen) { await sleep(400); await tapSel('#arWheel .slot[data-id="pistol"]'); }
      R.dock = { dock, dOpen, cur: await G(() => window.SSX.arsenal.current().id) }; ok('wheelDock', R.dock, !dock || dOpen && R.dock.cur === 'pistol');
    }
    // ---- every weapon fires and reloads ----
    const fires = {};
    for (const id of ['pistol', 'smg', 'shotgun', 'rifle']) {
      await G(id => window.SSX.arsenal.equip(id), id);
      const f = await fireUntil(id, 2);
      await G(() => window.SSX.arsenal.reload()); const started = await G(() => !!window.SSX.arsenal.current().reloading);
      if (id !== 'pistol') await G(() => window.SSX.arsenal.debug.reloadNow());
      const done = await wait(() => { const c = window.SSX.arsenal.current(); return !c.reloading && c.mag === c.magSize; }, desk ? 40000 : 15000);
      fires[id] = { ...f, started, done, mag: await G(() => window.SSX.arsenal.current().mag), magSize: await G(() => window.SSX.arsenal.current().magSize) };
    }
    ok('fireReload', fires, Object.values(fires).every(f => f.shots >= 2 && f.core >= 2 && f.started && f.done));
    // empty mag -> auto reload
    await G(() => { const A = window.SSX.arsenal; A.equip('pistol'); A.debug.setMag(1); }); await fireUntil('pistol', 1);
    R.autoReload = await G(() => window.SSX.arsenal.current()); ok('autoReload', R.autoReload, R.autoReload.mag === 0 && R.autoReload.reloading > 0);
    await G(() => window.SSX.arsenal.debug.reloadNow()); await wait(() => !window.SSX.arsenal.current().reloading, 15000);
    // rail: needs a charge
    await G(() => window.SSX.arsenal.equip('rail'));
    R.railNoCharge = await G(() => { const r = window.__app.game.fire({ x: 0, y: 0 }); return { r, mag: window.SSX.arsenal.current().mag }; });
    await G(() => window.SSX.arsenal.debug.charge()); const rf = await fireUntil('rail', 1, 10000);
    ok('railCharge', { no: R.railNoCharge, rf }, R.railNoCharge.r === false && R.railNoCharge.mag === 3 && rf.shots === 1 && rf.cur.mag === 2);
    // melee: knife + bat swing through game.melee
    await G(() => window.SSX.arsenal.give('bat'));
    const mk = await G(() => window.SSX.arsenal.equip('knife')); const kn = await fireUntil('knife', 1, 10000);
    await G(() => window.SSX.arsenal.equip('bat')); const bt = await fireUntil('bat', 1, 10000);
    ok('melee', { mk, kn: kn.swings, bt: bt.swings }, kn.swings >= 1 && bt.swings >= 1);
    // ---- headshots + decals ----
    await G(() => { window.SSX.arsenal.equip('pistol'); window.__app.surface.world.setWanted(0); });
    const d0 = await G(() => window.SSX.arsenal.debug.decals());
    R.head = await G(() => {
      const w = window.__app.surface.world, s = window.__app.surface, i = s.info, A = window.SSX.arsenal;
      w.debug.spawnSecurity('officer', { x: i.x + 6, z: i.z }); const o = w.securityList().filter(q => q.kind === 'officer').sort((a, b) => Math.hypot(a.x - i.x, a.z - i.z) - Math.hypot(b.x - i.x, b.z - i.z))[0];
      if (!o) return { err: 'no officer' }; const n0 = window.__aev.length, hp0 = o.hp;
      const hit = A.debug.seg({ x: o.x - 3, y: o.y + 1.8, z: o.z }, { x: o.x + 1, y: o.y + 1.8, z: o.z }, 0.5);
      const o2 = w.securityList().find(q => q.kind === 'officer' && Math.hypot(q.x - o.x, q.z - o.z) < 2);
      const ev = window.__aev.slice(n0); return { hit, hp0, hp1: o2?.hp ?? 'dead', head: ev.some(e => e.type === 'head'), wanted: w.wanted };
    });
    ok('headshotSecurity', R.head, R.head.hit && R.head.head && (R.head.hp1 === 'dead' || R.head.hp0 - R.head.hp1 >= 1.2) && R.head.wanted > 0);
    R.headPpl = await G(() => {
      const w = window.__app.surface.world, i = window.__app.surface.info, A = window.SSX.arsenal;
      const p = (w.debug.people() || []).filter(q => q.on && q.kind !== 'contact').sort((a, b) => Math.hypot(a.x - i.x, a.z - i.z) - Math.hypot(b.x - i.x, b.z - i.z))[0];
      if (!p) return { skip: 'no people' }; const g = w.groundAt(p.x, p.z), n0 = window.__aev.length;
      const hit = A.debug.seg({ x: p.x - 3, y: g + 1.7, z: p.z }, { x: p.x + 1, y: g + 1.7, z: p.z }, 0.2); const ev = window.__aev.slice(n0).find(e => e.type === 'head');
      return { hit, kind: p.kind, ev };
    });
    ok('headshotPeople', R.headPpl, !!R.headPpl.skip || R.headPpl.hit && R.headPpl.ev && Math.abs(R.headPpl.ev.dmg - 0.5) < 0.01);
    R.decals = { d0, d1: await G(() => window.SSX.arsenal.debug.decals()) }; ok('decal', R.decals, R.decals.d1 > R.decals.d0);
    await G(() => { window.__app.surface.world.setWanted(0); });
    // ---- Bore: contraband trade + mods ----
    await G(() => { const A = window.SSX.arsenal, at = A.gunsmith.at(); window.__app.surface.debugMove(at.x + 2, at.z + 1.5, 0); window.__app.surface.world.setWanted(0); A.equip('pistol');
      const C = window.SSX.contraband; C.add('redstatic', 3, 1); C.add('glowdust', 2, 1); C.add('voidhoney', 1, 1); C.add('lowg', 1, 1); });
    const sb = await wait(() => getComputedStyle(document.getElementById('arSmithBtn')).display !== 'none', 20000); const sbb = await center('#arSmithBtn');
    if (sb) await tapSel('#arSmithBtn'); const shopOpen = await wait(() => document.getElementById('arShop').classList.contains('open'), 5000);
    ok('smithOpens', { sb, sbb, shopOpen }, sb && sbb && sbb.h >= 44 && shopOpen);
    await page.screenshot({ path: out + `arsenal-gunsmith-${tag}.png` });
    const st0 = await G(() => JSON.parse(JSON.stringify(window.SSX.contraband.stash().items)));
    let tb = null; if (await center('#arShop button[data-a="stash"][data-id="mod:suppressor"]')) tb = await tapSel('#arShop button[data-a="stash"][data-id="mod:suppressor"]');
    const st1 = await G(() => JSON.parse(JSON.stringify(window.SSX.contraband.stash().items)));
    R.supp = { tb, red: [st0.redstatic?.qty, st1.redstatic?.qty], glow: [st0.glowdust?.qty, st1.glowdust?.qty], mods: await G(() => window.SSX.arsenal.mods('pistol')) };
    ok('tradeMod', R.supp, tb && tb.h >= 44 && st0.redstatic.qty - (st1.redstatic?.qty || 0) === 1 && st0.glowdust.qty - (st1.glowdust?.qty || 0) === 1 && R.supp.mods.owned.includes('suppressor'));
    R.tradeGun = await G(() => { const A = window.SSX.arsenal; A.state().owned.bat = false; A.saveState(); const lg = window.SSX.contraband.stash().items.lowg?.qty || 0; const r = A.gunsmith.trade('bat', 'stash'); return { r, own: A.owned('bat'), lg0: lg, lg1: window.SSX.contraband.stash().items.lowg?.qty || 0, offer: !!window.SSX.contraband.barterOffers?.('red-tape-flats')?.some?.(o => o.id === 'bore:bat') }; });
    ok('tradeGunContraband', R.tradeGun, R.tradeGun.r.ok && R.tradeGun.own && R.tradeGun.lg0 - R.tradeGun.lg1 === 1);
    R.cash = await G(() => { const g = window.__app.game, c0 = g.progress.credits, r = window.SSX.arsenal.gunsmith.trade('ammo:heavy:std', 'cash'); return { r, paid: c0 - g.progress.credits, heavy: window.SSX.arsenal.ammo('rifle').types.std }; });
    ok('cashMarkup', R.cash, R.cash.r.ok && R.cash.paid === 144);
    R.scope = await G(() => { const A = window.SSX.arsenal; A.equip('rifle'); const t = A.gunsmith.trade('mod:scope', 'stash'); return { t: t.ok, has: A.mods('rifle').owned.includes('scope') }; });
    await G(() => window.SSX.arsenal.gunsmith.close()); await sleep(300);
    if (desk) { // right mouse: hold zooms, release un-zooms; Backslash toggles
      await page.mouse.move(683, 300); await page.mouse.down({ button: 'right' });
      R.scope.rmbZoom = await wait(() => window.__app.surface.camera.zoom > 2, 10000); await sleep(500); await page.mouse.up({ button: 'right' });
      R.scope.rmbRelease = await wait(() => window.__app.surface.camera.zoom === 1, 10000);
      await page.keyboard.press('Backslash'); R.scope.comma = await wait(() => window.__app.surface.camera.zoom > 2, 10000); await page.keyboard.press('Backslash');
      R.scope.commaOff = await wait(() => window.__app.surface.camera.zoom === 1, 10000);
    } else { await tapSel('#arScope'); R.scope.btn = await wait(() => window.__app.surface.camera.zoom > 2, 10000); await G(() => window.SSX.arsenal.scope(false)); }
    R.scope.zoom = await G(() => window.__app.surface.camera.zoom); await G(() => window.SSX.arsenal.scope(false));
    ok('scopeZoom', R.scope, R.scope.t && R.scope.has && (desk ? R.scope.rmbZoom && R.scope.rmbRelease && R.scope.comma && R.scope.commaOff : R.scope.btn));
    if (desk) { // I reloads, . cycles ammo type; B / Z stay with their owners (stash, gravity/roll)
      await G(() => { const A = window.SSX.arsenal; A.equip('pistol'); A.debug.setMag(4); }); await page.keyboard.press('KeyI');
      const rl = await G(() => !!window.SSX.arsenal.current().reloading); await G(() => window.SSX.arsenal.debug.reloadNow()); await wait(() => !window.SSX.arsenal.current().reloading, 15000);
      const t0 = await G(() => window.SSX.arsenal.current().sel); await page.keyboard.press('Quote'); await sleep(300); const t1 = await G(() => window.SSX.arsenal.current().sel);
      await G(() => { window.SSX.arsenal.setAmmo('std'); window.SSX.arsenal.debug.reloadNow(); }); await wait(() => !window.SSX.arsenal.current().reloading, 15000);
      await G(() => window.SSX.arsenal.debug.setMag(4)); await page.keyboard.press('KeyZ'); await sleep(200); await page.keyboard.press('KeyB'); await sleep(300);
      const other = await G(() => ({ scoped: window.SSX.arsenal.current().scoped, reloading: window.SSX.arsenal.current().reloading, keys: window.SSX.arsenal.keys(), stashOpen: getComputedStyle(document.getElementById('cbPanel') || document.body).display }));
      await G(() => { window.SSX.arsenal.debug.reloadNow(); document.getElementById('cbPanel') && (document.getElementById('cbPanel').style.display = 'none'); });
      ok('keys', { rl, t0, t1, other }, rl && t0 !== t1 && !other.scoped && !other.reloading && other.keys.reload === 'KeyI' && other.keys.ammo === 'Quote' && other.keys.scope === 'Backslash');
    }
    // suppressor: the discharge crime check is skipped
    await G(() => { window.SSX.arsenal.equip('pistol'); window.__q0 = window.__aev.filter(e => e.type === 'quiet').length; });
    await fireUntil('pistol', 1); R.quiet = await G(() => window.__aev.filter(e => e.type === 'quiet').length - window.__q0); ok('suppressorQuiet', R.quiet, R.quiet >= 1);
    // ---- the Rust Pit: fists only ----
    await G(() => { const p = window.SSX.arsenal.debug.pit(); window.__app.surface.debugMove(p.x + 1, p.z + 1, 0); window.__app.surface.world.setWanted(0); });
    const inPit = await wait(() => window.SSX.arsenal.inPit(), 8000);
    R.pit = await G(async () => { const A = window.SSX.arsenal, s0 = A.debug.stats(), m0 = A.current().mag; for (let i = 0; i < 8; i++) { window.__app.game.fire({ x: 0, y: 0 }); await new Promise(r => setTimeout(r, 80)); } const s = A.debug.stats(); return { blocks: s.pitBlocks - s0.pitBlocks, shots: s.shots - s0.shots, mag: [m0, A.current().mag] }; });
    ok('pitFistsOnly', { inPit, ...R.pit }, inPit && R.pit.blocks >= 1 && R.pit.shots === 0);
    await spot(-200, 40); await sleep(600); const outF = await fireUntil('pistol', 1, 15000); ok('pitLeft', outF.shots, outF.shots >= 1);
    // ---- HUD ----
    R.hud = await G(() => { const h = document.getElementById('arHud'), cs = getComputedStyle(h), b = document.getElementById('arAmmo').getBoundingClientRect(); return { show: cs.display !== 'none', t: h.textContent, bg: cs.backgroundColor, h: b.height }; });
    ok('hud', R.hud, R.hud.show && R.hud.bg === 'rgb(0, 0, 0)' && R.hud.h >= 44 && !/\d+\/\d+/.test(R.hud.t)); // the pill no longer repeats the count
    await G(() => { window.SSX.arsenal.equip('pistol'); window.SSX.arsenal.debug.reloadNow(); }); await sleep(desk ? 2500 : 800);
    R.chip = await G(() => { const c = window.SSX.arsenal.current(), gc = document.getElementById('gearChip'); return { t: gc.textContent, want: `${c.mag}/${c.reserve}`, h: gc.getBoundingClientRect().height }; });
    const chipOk = R.chip.t.includes(R.chip.want) && !R.chip.t.includes('∞');
    if (!desk) await page.screenshot({ path: out + `arsenal-chip-${tag}.png` });
    await G(() => window.SSX.arsenal.equip('blaster')); await sleep(desk ? 2500 : 800); R.chip.core = await G(() => document.getElementById('gearChip').textContent);
    ok('chipAmmo', R.chip, chipOk && R.chip.h >= 44 && /∞/.test(R.chip.core));
    await G(() => window.SSX.arsenal.equip('pistol')); await sleep(desk ? 2500 : 800);
    R.btns = await G(() => ['#arAmmo', '#arType'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().height))); ok('pillButtons', R.btns, R.btns.every(h => h >= 44));
    if (!desk) await page.screenshot({ path: out + `arsenal-hud-${tag}.png` });
    R.events = await G(() => [...new Set(window.__aev.map(e => e.type))].join(',')); ok('busEvents', await G(() => window.__wev), await G(() => window.__wev > 10));
    // ---- persistence ----
    const before = await G(() => { const A = window.SSX.arsenal; return { owned: Object.keys(A.state().owned).filter(k => A.state().owned[k]).sort().join(','), mods: JSON.stringify(A.state().mods), mag: A.ammo('pistol').mag.n, eq: window.__app.game.progress.equip.weapon }; });
    await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000); await wait(() => !!window.SSX?.arsenal, 20000);
    const after = await G(() => { const A = window.SSX.arsenal; return { owned: Object.keys(A.state().owned).filter(k => A.state().owned[k]).sort().join(','), mods: JSON.stringify(A.state().mods), mag: A.ammo('pistol').mag.n, eq: window.__app.game.progress.equip.weapon, cur: A.current()?.id }; });
    ok('persist', { before, after }, before.owned === after.owned && before.mods === after.mods && before.mag === after.mag && after.eq === before.eq && after.cur === 'pistol');
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  R.errors = errors.slice(0, 8); if (errors.length) bad.push('console errors: ' + errors.length);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(' | ') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
