// Mars consequences (mars/consequences.js, SSX.consequences): WASTED -> Helios Mercy bill, BUSTED -> Deimos Lockup booking
// (weapons to evidence, stash seized once, rover impounded), lawyer, bail, bribe (yes + no), serving time skips the clock,
// jailbreak (sneak + spotted/fight), impound pay + steal (trespass heat), evidence reclaim, single-charge check (no core
// fee, no second contraband seizure), the Rust Pit stays core, UI sizes + the ' key.
// BASE=http://127.0.0.1:8889/ BR=webkit DEV="iPhone 14" OUT=./shots/consequences/ node tests/test-consequences.js  (one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8889/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/consequences/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width, t: r.top, b: r.bottom, l: r.left, r: r.right }; }, sel);
  const tapSel = async sel => { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(150); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); }; // the box can drop to ~2 fps: wait frames, not ms
  const C = () => G(() => window.SSX.consequences.status());
  const cr = () => G(() => window.__app.game.progress.credits);
  const calm = () => G(() => { const w = window.__app.surface.world; w.setWanted(0); window.__app.game.debug?.calm?.(true); window.__app.game.restore(); });
  const bust = async (stars = 2) => { await calm(); await G(s => { window.__app.surface.world.setWanted(s); window.__app.game.bust(); }, stars); return wait(() => window.SSX.consequences.status().custody?.inCell, 90000); };
  const home = () => G(() => { const p = window.SSX.consequences.places().find(p => p.id === 'lockup'); window.__app.surface.debugMove(p.x + 40, p.z + 30, 0); }).then(() => fr(3));
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.consequences, 20000);
    ok('api', await G(() => ['ownsOutcome', 'status', 'quote', 'serve', 'bail', 'bribe', 'lawyer', 'jailbreak', 'reclaim', 'payImpound', 'clearStrike', 'places', 'on', 'clock'].every(k => typeof window.SSX.consequences[k] === 'function')));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 6000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.consequences.debug.reset();
      window.__cev = []; window.SSX.consequences.on(e => window.__cev.push({ type: e.type, action: e.action, n: e.n, kind: e.kind, how: e.how, ok: e.ok }));
      window.__core = []; window.SSX.on('game:respawn', d => window.__core.push({ why: d.why, fee: d.fee, owned: d.owned }));
      window.__cb = []; window.SSX.contraband?.on?.(e => { if (e.type === 'confiscate') window.__cb.push(e); });
      window.__radio = 0; window.SSX.on('game:radio', d => { if (/processed|med-evac dragged/.test(d?.text || '')) window.__radio++; }); });
    await sleep(500);
    ok('built', await G(() => !!window.__app.surface.scene.getObjectByName('consequences')));
    const pl = await G(() => window.SSX.consequences.places()); R.places = pl.map(p => [p.id, Math.round(p.x), Math.round(p.z)]);

    // ---- WASTED ----
    await G(() => { const p = window.SSX.consequences.places()[0]; window.__app.surface.debugMove(p.x - 60, p.z - 60, 0); });
    await sleep(400); let c0 = await cr();
    await G(() => window.__app.game.hurtPlayer(9999, { x: 0, z: 0 }));
    const wScreen = await wait(() => document.getElementById('cqScreen').classList.contains('on') && document.querySelector('#cqScreen b').textContent === 'WASTED', 8000);
    if (!desk) await page.screenshot({ path: out + `consequences-wasted-${tag}.png` });
    await wait(() => window.SSX.consequences.ledger().some(l => l.kind === 'hospital'), 90000); await fr(2);
    R.wasted = await G(() => { const C = window.SSX.consequences, h = C.places().find(p => p.id === 'hospital'), i = window.__app.surface.info; return { d: Math.round(Math.hypot(i.x - h.x, i.z - h.z)), ledger: C.ledger(), core: window.__core.slice(-1)[0], credits: window.__app.game.progress.credits, panel: document.getElementById('cqPanel').classList.contains('show') }; });
    const bill = R.wasted.ledger.filter(l => l.kind === 'hospital').reduce((a, l) => a + l.n, 0);
    ok('wasted', { ...R.wasted, c0, bill, wScreen }, wScreen && R.wasted.d < 20 && bill > 0 && R.wasted.credits === c0 - bill && R.wasted.core?.fee === 0 && R.wasted.core?.owned === true && R.wasted.panel);
    await tapSel('#cqPanel button[data-a="close"]');

    // ---- BUSTED with weapons, product and the rover close by ----
    await calm();
    await G(() => { const g = window.__app.game, P = g.progress; if (!P.unlocks.includes('weapon:shotgun')) P.unlocks.push('weapon:shotgun'); g.save(); window.SSX.contraband?.add?.('lowg', 3);
      const p = window.SSX.consequences.places().find(p => p.id === 'lockup'); window.__app.surface.debugMove(p.x + 60, p.z + 50, 0); });
    await fr(3); await G(() => window.__app.surface.summonRover()); await fr(3); await G(() => window.__app.surface.interact()); await fr(3);
    R.inRover = await G(() => !!window.__app.surface.info.driving);
    c0 = await cr(); const radio0 = await G(() => window.__radio);
    const stash0 = await G(() => window.SSX.contraband?.stash?.().total ?? -1);
    await G(() => { window.__app.surface.world.setWanted(2); window.__app.game.bust(); });
    const bScreen = await wait(() => document.querySelector('#cqScreen b').textContent === 'BUSTED' && document.getElementById('cqScreen').classList.contains('on'), 8000);
    const stashNow = await G(() => window.SSX.contraband?.stash?.().total ?? -1);
    await wait(() => window.SSX.consequences.status().custody?.inCell, 90000); await fr(3);
    R.busted = await G(() => { const C = window.SSX.consequences, s = C.status(), L = C.places().find(p => p.id === 'lockup'), i = window.__app.surface.info, r = C.debug.rover();
      return { s, d: Math.round(Math.hypot(i.x - L.x, i.z - L.z)), credits: window.__app.game.progress.credits, core: window.__core.slice(-1)[0], cb: window.__cb.length, stash: window.SSX.contraband?.stash?.().total, shotgun: window.__app.game.progress.unlocks.includes('weapon:shotgun'), panel: document.getElementById('cqPanel').classList.contains('show'), roverInLot: !!r && C.debug.inLot(r.x, r.z), roverY: r && Number.isFinite(r.y) }; });
    ok('busted', { ...R.busted, c0, stash0, stashNow, bScreen, inRover: R.inRover }, bScreen && R.busted.s.custody && R.busted.d < 8 && R.busted.panel && !R.busted.shotgun && R.busted.s.evidence?.n >= 1 && R.busted.s.strikes === 1);
    ok('singleCharge', { credits: R.busted.credits, c0, coreFee: R.busted.core?.fee, owned: R.busted.core?.owned, contrabandSeizures: R.busted.cb, seizedByUs: R.busted.s.custody?.seized?.contraband, radio: (await G(() => window.__radio)) - radio0 },
      R.busted.credits === c0 && R.busted.core?.fee === 0 && R.busted.cb === 0 && (stash0 <= 0 || (R.busted.s.custody.seized.contraband === stash0 && R.busted.stash === 0)) && (await G(() => window.__radio)) === radio0);
    ok('impounded', { impound: R.busted.s.impound, inLot: R.busted.roverInLot, y: R.busted.roverY }, !!R.busted.s.impound && R.busted.roverInLot && R.busted.roverY);
    await wait(() => !document.getElementById('cqScreen').classList.contains('on'), 8000);
    await page.screenshot({ path: out + `consequences-booking-${tag}.png` });
    R.bookBtns = await G(() => [...document.querySelectorAll('#cqPanel button')].map(b => Math.round(b.getBoundingClientRect().height)));
    ok('bookingButtons44', R.bookBtns, R.bookBtns.length >= 6 && R.bookBtns.every(h => h >= 44));
    // custody: you stay in the cell
    await G(() => { const p = window.SSX.consequences.places().find(p => p.id === 'lockup'); window.__app.surface.debugMove(p.x + 30, p.z + 30, 0); }); await fr(3);
    ok('cellHolds', await G(() => { const C = window.SSX.consequences, c = C.debug.toLocal('lockup', C.debug.layout().CELL), i = window.__app.surface.info; return Math.round(Math.hypot(i.x - c.x, i.z - c.z) * 10) / 10; }), (await G(() => { const C = window.SSX.consequences, c = C.debug.toLocal('lockup', C.debug.layout().CELL), i = window.__app.surface.info; return Math.hypot(i.x - c.x, i.z - c.z); })) < 3);

    // ---- lawyer then bail (tapped) ----
    if (!(await G(() => document.getElementById('cqPanel').classList.contains('show')))) await G(() => window.SSX.consequences.open());
    const q0 = await G(() => window.SSX.consequences.quote()); c0 = await cr();
    await tapSel('#cqPanel button[data-a="lawyer"]');
    const q1 = await G(() => window.SSX.consequences.quote()), c1 = await cr();
    ok('lawyer', { q0: [q0.bail, q0.time, q0.lawyer], q1: [q1.bail, q1.time], spent: c0 - c1 }, c0 - c1 === q0.lawyer && q1.bail < q0.bail && q1.time < q0.time && (await C()).custody.lawyer);
    await tapSel('#cqPanel button[data-a="bail"]'); await sleep(300);
    const c2 = await cr(), sb = await C();
    ok('bail', { spent: c1 - c2, bail: q1.bail, custody: sb.custody }, c1 - c2 === q1.bail && !sb.custody && sb.evidence?.n >= 1);
    // evidence locker at the front desk (HUD pill)
    await G(() => { const C = window.SSX.consequences, d = C.debug.toLocal('lockup', C.debug.layout().DESK); window.__app.surface.debugMove(d.x, d.z + 2, Math.PI); }); await fr(6); await wait(() => document.getElementById('cqHudBtn')?.textContent === 'Open', 30000);
    const pill = await center('#cqHudBtn'); R.pill = pill;
    if (pill) await tapSel('#cqHudBtn'); const qE = await G(() => window.SSX.consequences.quote().evidence), c3 = await cr();
    if (await G(() => !!document.querySelector('#cqPanel.show button[data-a="reclaim"]'))) await tapSel('#cqPanel button[data-a="reclaim"]');
    const c4 = await cr();
    ok('reclaim', { pill: pill && pill.h, fee: qE, spent: c3 - c4, shotgun: await G(() => window.__app.game.progress.unlocks.includes('weapon:shotgun')) }, !!pill && pill.h >= 44 && c3 - c4 === qE && qE > 0 && (await G(() => window.__app.game.progress.unlocks.includes('weapon:shotgun'))));
    if (await G(() => document.getElementById('cqPanel').classList.contains('show'))) await tapSel('#cqPanel button[data-a="close"]');

    // ---- impound: trespass + steal it back ----
    await calm();
    await G(() => { const C = window.SSX.consequences, s = C.debug.toLocal('impound', [0, 3]); window.__app.surface.debugMove(s.x, s.z, 0); }); await wait(() => window.__cev.some(e => e.type === 'impound' && e.action === 'trespass'), 30000); await fr(2);
    R.trespass = await G(() => ({ w: window.__app.surface.world.wanted, ev: window.__cev.filter(e => e.type === 'impound' && e.action === 'trespass').length }));
    ok('trespass', R.trespass, R.trespass.ev >= 1 && R.trespass.w >= 1);
    await G(() => window.__app.surface.interact()); await fr(3); R.inRover2 = await G(() => window.__app.surface.info.driving);
    await G(() => { const C = window.SSX.consequences, s = C.debug.toLocal('impound', [0, 30]); window.__app.surface.debugMove(s.x, s.z, 0); }); await wait(() => window.__cev.some(e => e.type === 'impound' && e.action === 'steal'), 30000); await fr(2);
    R.steal = await G(() => ({ imp: window.SSX.consequences.status().impound, w: window.__app.surface.world.wanted, ev: window.__cev.filter(e => e.type === 'impound' && e.action === 'steal').length, driving: window.__app.surface.info.driving }));
    ok('impoundSteal', { ...R.steal, inRover: R.inRover2 }, R.inRover2 && !R.steal.imp && R.steal.ev === 1 && R.steal.w >= 2);
    await G(() => window.__app.surface.interact()); await fr(3);

    // ---- serve time skips the clock (free) + impound pay ----
    await home(); await G(() => window.__app.surface.summonRover()); await fr(3);
    await bust(1); c0 = await cr(); const h0 = await G(() => window.SSX.consequences.clock()), qs = await G(() => window.SSX.consequences.quote());
    await tapSel('#cqPanel button[data-a="serve"]'); await sleep(300);
    const h1 = await G(() => window.SSX.consequences.clock()), ss = await C();
    const dh = ((h1 - h0) % 24 + 24) % 24;
    ok('serveTime', { h0: Math.round(h0 * 100) / 100, h1: Math.round(h1 * 100) / 100, hours: qs.time, dh: Math.round(dh * 100) / 100, spent: c0 - (await cr()), custody: ss.custody, hasTime: await G(() => !!window.SSX.time) }, !ss.custody && Math.abs(dh - qs.time) < 0.2 && c0 === (await cr()));
    R.impound2 = ss.impound; c0 = await cr(); const qi = await G(() => window.SSX.consequences.quote().impound);
    await G(() => window.SSX.consequences.open('legal')); await sleep(300);
    if (await G(() => !!document.querySelector('#cqPanel.show button[data-a="impound"]:not([disabled])'))) await tapSel('#cqPanel button[data-a="impound"]');
    ok('impoundPay', { had: !!R.impound2, fee: qi, spent: c0 - (await cr()), now: (await C()).impound }, !!R.impound2 && qi > 0 && c0 - (await cr()) === qi && !(await C()).impound);
    // the lawyer clears a strike
    const k0 = (await C()).strikes, qc = await G(() => window.SSX.consequences.quote().clear); c0 = await cr();
    await tapSel('#cqPanel button[data-a="clear"]');
    ok('clearStrike', { k0, k1: (await C()).strikes, spent: c0 - (await cr()), fee: qc }, (await C()).strikes === k0 - 1 && c0 - (await cr()) === qc);
    await tapSel('#cqPanel button[data-a="close"]');

    // ---- bribe: a no (strike + 2 h) then a yes (everything back) ----
    await home(); await G(() => { const g = window.__app.game, P = g.progress; if (!P.unlocks.includes('weapon:shotgun')) P.unlocks.push('weapon:shotgun'); g.save(); window.SSX.contraband?.add?.('lowg', 2); });
    await bust(2); const k1 = (await C()).strikes;
    const no = await G(() => window.SSX.consequences.bribe({ force: false }));
    const sNo = await C();
    ok('bribeRefused', { no, k1, k2: sNo.strikes, extra: sNo.custody?.extra }, no.refused && sNo.strikes === k1 + 1 && sNo.custody?.extra === 2 && sNo.custody?.refused);
    await G(() => window.SSX.consequences.serve()); await sleep(300);
    await home(); await G(() => { const g = window.__app.game, P = g.progress; if (!P.unlocks.includes('weapon:shotgun')) P.unlocks.push('weapon:shotgun'); g.save(); window.SSX.contraband?.add?.('lowg', 2); });
    await bust(2); c0 = await cr(); const qb = await G(() => window.SSX.consequences.quote().bribe), k3 = (await C()).strikes;
    const yes = await G(() => window.SSX.consequences.bribe({ force: true }));
    const sYes = await C();
    ok('bribe', { yes: yes.ok, spent: c0 - (await cr()), price: qb, custody: sYes.custody, evidence: sYes.evidence, strikes: [k3, sYes.strikes], shotgun: await G(() => window.__app.game.progress.unlocks.includes('weapon:shotgun')), stash: await G(() => window.SSX.contraband?.stash?.().total ?? null) },
      yes.ok && c0 - (await cr()) === qb && !sYes.custody && !sYes.evidence && sYes.strikes === k3 - 1 && (await G(() => window.__app.game.progress.unlocks.includes('weapon:shotgun'))) && (await G(() => (window.SSX.contraband?.stash?.().total ?? 2) >= 2)));

    // ---- jailbreak: sneak (guards frozen facing away) ----
    await home(); await bust(1);
    await tapSel('#cqPanel button[data-a="jailbreak"]'); await sleep(400);
    ok('jailStart', await C(), !!(await C()).jail);
    if (!desk) await page.screenshot({ path: out + `consequences-jailbreak-${tag}.png` });
    // the fence holds you inside the yard (east side, away from the gap)
    await G(() => { const C = window.SSX.consequences; C.debug.freezeGuards(true); const p = C.debug.toLocal('lockup', [25, 0]); window.__app.surface.debugMove(p.x, p.z, 0); }); await fr(3);
    ok('fence', await G(() => { const C = window.SSX.consequences, L = C.debug.toLocal('lockup'), i = window.__app.surface.info; return Math.round((i.x - L.x) * 10) / 10; }), (await G(() => { const C = window.SSX.consequences, L = C.debug.toLocal('lockup'), i = window.__app.surface.info; return i.x - L.x; })) < 13.5);
    await G(() => { const C = window.SSX.consequences, e = C.debug.layout().EXIT, p = C.debug.toLocal('lockup', [e[0] + 2.5, e[1]]); window.__app.surface.debugMove(p.x, p.z, 0); }); await fr(2);
    await G(() => { const C = window.SSX.consequences, e = C.debug.layout().EXIT, p = C.debug.toLocal('lockup', [e[0] - 0.5, e[1]]); window.__app.surface.debugMove(p.x, p.z, 0); }); await wait(n => window.__cev.filter(e => e.type === 'jailbreak' && e.action === 'escaped').length >= n, 30000, (await G(() => window.__cev.filter(e => e.type === 'jailbreak' && e.action === 'escaped').length)) + 1); await fr(2);
    R.sneak = await G(() => ({ s: window.SSX.consequences.status(), w: window.__app.surface.world.wanted, ev: window.__cev.filter(e => e.type === 'jailbreak' && e.action === 'escaped').map(e => e.how) }));
    ok('jailbreakSneak', R.sneak, !R.sneak.s.jail && !R.sneak.s.custody && R.sneak.ev.includes('sneak') && R.sneak.w >= 2);
    // ---- jailbreak: walk into a torch beam -> spotted -> fight out -> 3 stars ----
    await home(); await bust(1);
    await G(() => window.SSX.consequences.jailbreak()); await fr(2);
    await G(() => { const C = window.SSX.consequences; C.debug.freezeGuards(true); const g = C.debug.guards()[0], f = { x: -Math.sin(g.yaw), z: -Math.cos(g.yaw) }; window.__app.surface.debugMove(g.x + f.x * 4, g.z + f.z * 4, 0); C.debug.freezeGuards(false); });
    const spotted = await wait(() => window.SSX.consequences.status().jail?.spotted, 30000);
    await G(() => { const C = window.SSX.consequences, e = C.debug.layout().EXIT, p = C.debug.toLocal('lockup', [e[0] + 2.5, e[1]]); window.__app.surface.debugMove(p.x, p.z, 0); }); await fr(2);
    await G(() => { const C = window.SSX.consequences, e = C.debug.layout().EXIT, p = C.debug.toLocal('lockup', [e[0] - 0.5, e[1]]); window.__app.surface.debugMove(p.x, p.z, 0); }); await wait(n => window.__cev.filter(e => e.type === 'jailbreak' && e.action === 'escaped').length >= n, 30000, (await G(() => window.__cev.filter(e => e.type === 'jailbreak' && e.action === 'escaped').length)) + 1); await fr(2);
    R.fight = await G(() => ({ s: window.SSX.consequences.status(), w: window.__app.surface.world.wanted, ev: window.__cev.filter(e => e.type === 'jailbreak' && e.action === 'escaped').map(e => e.how) }));
    ok('jailbreakFight', { spotted, ...R.fight }, spotted && !R.fight.s.jail && R.fight.ev.includes('fight') && R.fight.w >= 3);
    await calm();

    // ---- Rust Pit: core flow, we stand aside ----
    await fr(36, 120000); // core invulnerability after the last respawn is 3 s of game time (dt is capped at 0.1 per frame)
    await G(() => { const c = window.__app.surface.world.colony; window.__app.surface.debugMove(c.x - 292, c.z - 68, 0); }); await fr(3);
    const pit = await G(() => window.SSX.consequences.debug.inPit()); c0 = await cr(); const nl = await G(() => window.SSX.consequences.ledger().length);
    await G(() => window.__app.game.hurtPlayer(9999, { x: 0, z: 0 }));
    const nc = await G(() => window.__core.length); await wait(n => window.__core.length > n, 90000, nc); await fr(2);
    R.pit = await G(n => ({ core: window.__core.slice(-1)[0], ledger: window.SSX.consequences.ledger().length - n, cust: !!window.SSX.consequences.status().custody }), nl);
    ok('pitCore', { pit, ...R.pit, spent: c0 - (await cr()) }, pit && R.pit.core?.owned !== true && R.pit.ledger === 0 && c0 - (await cr()) === (R.pit.core?.fee | 0));

    // ---- UI: key / dock ----
    if (desk) { await page.keyboard.press('Quote'); await sleep(300); ok('quoteKey', await G(() => document.getElementById('cqPanel').classList.contains('show'))); await page.keyboard.press('Quote'); await sleep(200); }
    else {
      await G(() => { window.__app.game.progress.credits = 6000; }); await home(); await bust(1); await sleep(300);
      if (await G(() => document.getElementById('cqPanel').classList.contains('show'))) await tapSel('#cqPanel button[data-a="close"]');
      const dk = await center('#dockLegal'), fire = await center('#fireBtn') || await center('#touchFire') || null, hb = await center('#cqHudBtn');
      const others = await G(() => [...document.querySelectorAll('#ssxDock button')].filter(b => b.offsetParent).map(b => b.id));
      const overlap = dk && fire ? !(dk.b <= fire.t || dk.t >= fire.b || dk.r <= fire.l || dk.l >= fire.r) : false;
      ok('dock', { dk, fire, overlap, others, hb }, !!dk && dk.h >= 44 && !overlap && hb && hb.h >= 44);
      await tapSel('#dockLegal'); ok('dockOpens', await G(() => document.getElementById('cqPanel').classList.contains('show')));
      await page.screenshot({ path: out + `consequences-dock-${tag}.png` });
      await G(() => window.SSX.consequences.serve());
    }
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
