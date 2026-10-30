// Rags to Riches + SSX.raids: start from ☰, buy first property, collect income, survive raids, no HUD overlap, NPC cap.
// BASE=http://127.0.0.1:8788/ BR=webkit DEV="iPhone 14" node tests/test-r2r.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8788/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = (process.env.SHOTS_DIR || process.env.OUT || require('path').join(__dirname, '..', 'shots', 'r2r')) + '/', PFX = 'r2r';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;

function measureHud() {
  const hud = document.getElementById('surfHud'); const W = innerWidth, H = innerHeight;
  const SKIP = new Set(['crosshair', 'hurt', 'downMsg', 'roverMenu', 'actPanel', 'racePanel', 'pokerPanel', 'r2rPanel']);
  const EXPAND = new Set(['stackR', 'surfBtns', 'ctxBar']);
  const vis = e => { if (!e) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05 || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const items = [];
  const add = e => { if (!e || SKIP.has(e.id) || !vis(e)) return; if (items.some(i => i.el === e)) return; const r = e.getBoundingClientRect(); items.push({ el: e, id: e.id || e.className, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }); };
  if (hud) for (const e of hud.children) { if (EXPAND.has(e.id)) { if (!vis(e)) continue; for (const c of e.children) add(c); } else add(e); }
  for (const id of ['joy', 'r2rCtxBtn', 'r2rAlert']) add(document.getElementById(id));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(`${a.id}×${b.id}`);
  }
  const off = items.filter(i => i.l < -1 || i.t < -1 || i.r > W + 1 || i.b > H + 1).map(i => i.id);
  const ctx = document.getElementById('r2rCtxBtn'), cr = ctx && vis(ctx) ? ctx.getBoundingClientRect() : null;
  return { W, H, overlaps, off, n: items.length, ctx: cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null };
}

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({
    args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
  });
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : (({ defaultBrowserType, ...d }) => d)(devices[DEV] || devices['iPhone 14']);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const realErr = [];
  page.on('pageerror', e => realErr.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /\[(r2r|raids|modes)\]/.test(m.text()))) realErr.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { try { await page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png`, timeout: 8000 }); } catch (e) { /* chromium font hang: non-fatal */ } };
  const center = sel => G(s => { const e = document.querySelector(s); e.scrollIntoView?.({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapAt = async sel => { const c = await center(sel); if (touch) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); await sleep(250); };
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000);
    await sleep(800);
  };
  // fight a raid by firing real shots through world.hitWorld (the same path the blaster uses); keeps the player topped up
  const fight = async (maxMs) => {
    const t0 = Date.now(); let maxNpc = 0, maxAtt = 0, sawAtt = false;
    while (Date.now() - t0 < maxMs) {
      const s = await G(() => {
        const g = window.__app.surface.game, H = g.debug.H(); H.hp = Math.max(H.hp, 80); H.inv = 2; if (H.down > 0) return { down: true };
        const w = window.__app.surface.world, i = window.__app.surface.info, list = window.SSX.raids.attackers();
        const p0 = { x: i.x, y: (window.__app.surface.debugHeight?.(i.x, i.z) ?? 0) + 1.5, z: i.z };
        for (const a of list.slice(0, 2)) { const n = window.__raids; const pos = { x: a.x, y: 0, z: a.z };
          // aim at the body: use the raider's own y from targets()
          const t = w.targets().find(t => t.kind === 'raider' && Math.abs(t.x - a.x) < 0.01 && Math.abs(t.z - a.z) < 0.01); if (t) { p0.y = t.y + 0.5; pos.y = t.y; }
          w.hitWorld(p0, pos, { dmg: 2 }); }
        return { att: list.length, npc: window.__raids.npcs + window.__raids.security, active: !!window.SSX.raids.active() };
      });
      if (s.down) return { down: true };
      maxNpc = Math.max(maxNpc, s.npc); maxAtt = Math.max(maxAtt, s.att); if (s.att) sawAtt = true;
      if (!s.active) return { maxNpc, maxAtt, sawAtt, ms: Date.now() - t0 };
      await sleep(300);
    }
    const snap = await G(() => { const r = window.__raids, i = window.__app.surface.info; return { st: r.state && { wave: r.state.wave, waves: r.state.waves?.length ?? r.state.waves, q: r.state.queue ?? r.state.queued, integ: Math.round(r.state.integrity ?? -1), stall: r.state.stall }, allowed: r.allowed, res: r.reserved, budget: window.__app.surface.world.npcBudget(), att: window.SSX.raids.attackers().map(a => ({ hp: a.hp, d: Math.round(Math.hypot(a.x - i.x, a.z - i.z)) })), down: window.__app.surface.game.debug.H().down }; });
    return { timeout: true, maxNpc, maxAtt, sawAtt, snap };
  };

  try {
    await page.goto(base + '?t=' + Date.now());
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { try { localStorage.removeItem('ssx.r2r.v1'); } catch (e) {} });
    await land();
    await G(() => window.__app.surface.game.debug.credits(1000 - window.__app.surface.game.debug.P().credits));
    ok('menuItem', null, await wait(() => !!document.getElementById('r2rMenuBtn') && !!window.__r2r?.data, 15000));
    ok('raidsInstalled', null, await G(() => window.SSX?.raids?.engine === 'modes/raids.js' && window.__raids.installed));

    // ☰ → New Game: Rags to Riches
    await G(() => window.__app.toggleMenu(true)); await sleep(300);
    await G(() => document.getElementById('r2rMenuBtn')?.scrollIntoView({ block: 'center' })); await sleep(300); /* the v7.5.4 menu is taller than a phone screen */
    await tapAt('#r2rMenuBtn');
    ok('introPanel', null, await wait(() => document.getElementById('r2rPanel')?.classList.contains('on'), 4000));
    await shot('intro');
    await tapAt('#r2rPanel [data-a=new]');
    await sleep(1200);
    const s0 = await G(() => { const S = window.__r2r.state, i = window.__app.surface.info, sp = window.__r2r.toW(window.__r2r.data.spawns.crashpad.aj);
      return { active: S.active, credits: window.__app.surface.game.debug.P().credits, stash: S.stash?.credits, dSpawn: Math.round(Math.hypot(i.x - sp.x, i.z - sp.z)), tier: S.tier, rover: S.hasRover }; });
    R.start = s0;
    ok('startedBroke', null, s0.active && s0.credits === 25 && s0.stash === 1000 && !s0.rover);
    if (s0.dSpawn >= 6) { await wait(sp => { const i = window.__app.surface.info; return Math.hypot(i.x - sp.x, i.z - sp.z) < 6; }, 6000, await G(() => window.__r2r.toW(window.__r2r.data.spawns.crashpad.aj))); s0.dSpawn = await G(() => { const i = window.__app.surface.info, sp = window.__r2r.toW(window.__r2r.data.spawns.crashpad.aj); return Math.round(Math.hypot(i.x - sp.x, i.z - sp.z)); }); }
    ok('atCrashPad', null, s0.dSpawn < 6);
    await G(() => window.__r2r.state.raidClock = -1e9); // no random raids mid-test
    const hud0 = await G(measureHud); R.hud0 = hud0;
    if (hud0.overlaps.length || hud0.off.length) bad.push('hudStart:' + hud0.overlaps.concat(hud0.off).join(','));
    await shot('crashpad');

    // first property: the noodle cart (120 cr)
    await G(() => window.__app.surface.game.debug.credits(200));
    await G(() => window.__r2r.warp('noodle'));
    ok('ctxBtn', null, await wait(() => { const b = document.getElementById('r2rCtxBtn'); return window.__r2r.near === 'noodle' && b && b.style.display !== 'none' && b.offsetWidth > 0; }, 6000));
    const hud1 = await G(measureHud); R.hud1 = hud1;
    if (hud1.overlaps.length || hud1.off.length) bad.push('hudDoor:' + hud1.overlaps.concat(hud1.off).join(','));
    ok('ctxBtnSize', hud1.ctx, hud1.ctx && hud1.ctx.w >= 44 && hud1.ctx.h >= 44);
    await shot('door');
    await tapAt('#r2rCtxBtn');
    ok('propSheet', null, await wait(() => !!document.querySelector('#r2rPanel.on [data-a=buy]'), 3000));
    await shot('sheet');
    await tapAt('#r2rPanel [data-a=buy]');
    const b = await G(() => ({ owned: window.__r2r.state.props.noodle.owned, credits: window.__app.surface.game.debug.P().credits }));
    R.buy = b; ok('bought', null, b.owned && b.credits <= 225 - 100);

    // income: 2 minutes at 12/min, collected in person
    await G(() => window.__r2r.advance(120));
    const stored = await G(() => window.__r2r.state.props.noodle.stored); R.stored = Math.round(stored);
    ok('incomeAccrued', null, stored >= 23 && stored <= 25);
    await G(() => { document.getElementById('r2rPanel').classList.remove('on'); }); await sleep(300);
    ok('ctxShowsCash', null, await wait(() => /💰/.test(document.getElementById('r2rCtxBtn').textContent), 3000));
    await tapAt('#r2rCtxBtn'); await sleep(200);
    const before = await G(() => window.__app.surface.game.debug.P().credits);
    await tapAt('#r2rPanel [data-a=collect]');
    const after = await G(() => ({ c: window.__app.surface.game.debug.P().credits, st: window.__r2r.state.props.noodle.stored }));
    R.collect = { before, after: after.c }; ok('collected', null, after.c - before >= 23 && after.st < 1);
    await G(() => document.getElementById('r2rPanel').classList.remove('on'));

    // raid 1: gang hits the noodle cart, live
    await G(() => { window.__t = { ev: [] }; for (const e of ['raid:start', 'raid:wave', 'raid:end']) window.SSX.raids.on(e, d => window.__t.ev.push([e, d.result || d.wave || ''])); });
    ok('raidStart', null, await G(() => window.__r2r.raid('noodle', { live: true, attackers: 'gang' })));
    await sleep(500);
    const hudR = await G(measureHud); R.hudRaid = hudR;
    if (hudR.overlaps.length || hudR.off.length) bad.push('hudRaid:' + hudR.overlaps.concat(hudR.off).join(','));
    await shot('raid');
    const f1 = await fight(60000); R.raid1 = f1;
    const ev1 = await G(() => window.__t.ev); R.events1 = ev1;
    ok('raid1Won', null, ev1.some(e => e[0] === 'raid:end' && e[1] === 'win') && ev1[0][0] === 'raid:start' && ev1.some(e => e[0] === 'raid:wave'));
    ok('raid1Rewarded', null, await G(() => window.__r2r.state.stats.raidsWon === 1));

    // raid 2: ColSec shakedown at the chop shop. Real ColSec engages via setWanted; total NPCs stay within the phone cap.
    await G(() => window.__app.surface.game.debug.credits(700));
    await G(() => window.__r2r.warp('chop')); await sleep(600);
    ok('boughtChop', null, await G(() => window.__r2r.buy('chop')));
    await G(() => document.getElementById('r2rPanel').classList.remove('on'));
    await G(() => window.__t.ev = []);
    ok('raid2Start', null, await G(() => window.__r2r.raid('chop', { live: true, attackers: 'colsec' })));
    await sleep(800);
    R.wantedAtRaid = await G(() => window.__app.surface.world.wanted);
    ok('colsecWanted', R.wantedAtRaid, R.wantedAtRaid >= 2);
    // ColSec officers bust you at 2★ (in play: bribe, evade or lose the shakedown). Here we drop the heat and fight the squad.
    await G(() => window.__app.surface.world.setWanted(0));
    const f2 = await fight(150000); R.raid2 = f2;
    const ev2 = await G(() => window.__t.ev); R.events2 = ev2;
    ok('raid2Won', null, ev2.some(e => e[0] === 'raid:end' && e[1] === 'win'));
    const cap = await G(() => window.__raids.cap); R.cap = cap;
    ok('npcCap', null, Math.max(f1.maxNpc || 0, f2.maxNpc || 0) <= cap && (DEV === 'desktop' || cap === 12));
    await G(() => window.__app.surface.world.setWanted(0));
    await wait(() => window.__app.surface.game.debug.H().down <= 0, 10000);
    R.capStart = await G(() => { const H = window.__app.surface.game.debug.H(); H.inv = 5; return { down: H.down, raid: !!window.SSX.raids.active() }; });
    // cap stress: a 20-strong wave plus 4-star ColSec never puts more than the phone cap of people on screen
    await G(() => { window.__app.surface.world.setWanted(4, 'test'); window.__capRes = window.SSX.raids.start({ id: 'cap-test', pos: [-294, -74], radius: 20, attackers: 'gang', waves: [{ count: 20 }], wanted: false }); });
    const cs = { total: 0, used: 0, att: 0, allowed: 0, queued: 0, n: 0 };
    const sample = () => G(() => { const H = window.__app.surface.game.debug.H(); H.hp = Math.max(H.hp, 80); H.inv = 2;
      const W = window.__app.surface.world, b = W.npcBudget ? W.npcBudget() : { used: 0 };
      return { total: window.__raids.npcs + window.__raids.security, used: b.used, att: window.__raids.npcs, allowed: window.__raids.allowed, queued: window.__raids.state?.queued ?? 0 }; });
    for (let i = 0; i < 90; i++) { await sleep(400); const x = await sample(); cs.n++;
      cs.total = Math.max(cs.total, x.total); cs.used = Math.max(cs.used, x.used); cs.att = Math.max(cs.att, x.att); cs.allowed = x.allowed; cs.queued = x.queued;
      if (i > 10 && x.att >= x.allowed && x.queued > 0) break; }
    await sleep(2500); { const x = await sample(); cs.total = Math.max(cs.total, x.total); cs.used = Math.max(cs.used, x.used); cs.queued = x.queued; }
    R.capStress = cs; R.capRes = await G(() => window.__capRes); R.capBudget = await G(() => { const W = window.__app.surface.world; return { b: W.npcBudget?.(), hum: window.__app.surface.game?.humanCount?.(), sec: (W.securityList?.() || []).map(s => s.kind).join(), wanted: W.wanted }; });
    const stopped = await G(() => window.SSX.raids.stop('cap-test', 'test'));
    ok('capStress', cs, cs.total <= cap && cs.used <= cap && cs.att >= 3 && cs.queued > 0 && stopped);
    ok('reservationReleased', null, await G(() => !(window.__app.surface.world.npcBudget?.().reserved?.raids)));
    await G(() => window.__app.surface.world.setWanted(0)); await sleep(300);
    // the no-op guard: a second engine install keeps the first one
    ok('noopGuard', null, await G(() => { const a = window.SSX.raids; const fake = { start() {}, on() {} }; const keep = window.SSX.raids; window.SSX.raids = fake;
      return new Promise(r => setTimeout(() => { const kept = window.SSX.raids === fake && !window.__raids.installed; window.SSX.raids = keep; r(kept && a === keep); }, 400)); }));

    // progress panel from ☰
    await G(() => window.__app.toggleMenu(true)); await sleep(300);
    await G(() => document.getElementById('r2rMenuBtn')?.scrollIntoView({ block: 'center' })); await sleep(300); /* the v7.5.4 menu is taller than a phone screen */
    await tapAt('#r2rMenuBtn');
    ok('progressPanel', null, await wait(() => /Net worth/.test(document.getElementById('r2rPanel').textContent), 3000));
    await shot('progress');
    R.netWorth = await G(() => window.__r2r.netWorth);
    // the Helios gate turns you away before tier 3
    await G(() => document.getElementById('r2rPanel').classList.remove('on'));
    await G(() => { const w = window.__r2r.toW([320, 80]); window.__app.surface.debugMove(w.x, w.z, 0); }); await sleep(900);
    const dHel = await G(() => { const w = window.__r2r.toW([320, 80]), i = window.__app.surface.info; return Math.round(Math.hypot(i.x - w.x, i.z - w.z)); });
    ok('heliosGate', dHel, dHel > 60);
    // return to normal game restores credits
    await G(() => window.__r2r.quit()); await sleep(300);
    const q = await G(() => ({ c: window.__app.surface.game.debug.P().credits, active: window.__r2r.state.active, saved: !!JSON.parse(localStorage.getItem('ssx.r2r.v1')).props.chop.owned }));
    R.quit = q; ok('quitRestores', null, q.c === 1000 && !q.active && q.saved);
    // v7.5.1 contraband feeds the chop take; and no second copy of a core module (mismatched ?v=) got loaded
    const cb = await G(() => ({ has: typeof window.SSX?.contraband?.buyerPrice === 'function', m: window.__r2r.contrabandMult }));
    R.contraband = cb; ok('contrabandMult', cb, !cb.has || (Number.isFinite(cb.m) && cb.m >= 0.6 && cb.m <= 1.6));
    const dup = await G(() => { const seen = {}; for (const e of performance.getEntriesByType('resource')) { const u = new URL(e.name); if (!/\.js$/.test(u.pathname) || u.origin !== location.origin) continue; (seen[u.pathname] = seen[u.pathname] || new Set()).add(u.search); } return Object.entries(seen).filter(([, v]) => v.size > 1).map(([k, v]) => k + ' ' + [...v].join('|')); });
    R.dupModules = dup; ok('noDuplicateModules', dup, dup.length === 0);
    const hud3 = await G(measureHud);
    if (hud3.overlaps.length) bad.push('hudAfter:' + hud3.overlaps.join(','));
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 280)); R.fail = e.message.split('\n')[0]; }

  const serious = realErr.filter(e => /r2r|raid|modes|SyntaxError|TypeError|ReferenceError|PE /i.test(e));
  R.errors = serious.slice(0, 6);
  if (serious.length) bad.push('errors');
  R.bad = bad;
  R.verdict = bad.length ? 'FAIL ' + bad.join(' | ') : 'PASS';
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
