// v7.5 Mars district shops (marsshops.js): every district has a gun store, a clothing store, a pharmacy and a bar.
// Walk into each of the 12 shops, buy at least one item off the rack / counter, check credits drop and the item or effect lands.
// BASE=http://localhost:8765/ DEV="iPhone 14" BR=webkit VP=393x852 node test-marsshops.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.SHOTS_DIR || process.env.OUT || '/tmp/', ONLY = process.env.ONLY, PFX = process.env.PFX || 'ms', VP = process.env.VP;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = (DEV + (VP ? '-' + VP : '')).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const t0 = Date.now();
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...d } = devices[DEV]; if (VP) { const [w, h] = VP.split('x').map(Number); d.viewport = { width: w, height: h }; }
  const ctx = await browser.newContext(d); const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const touch = !!d.hasTouch, press = async (x, y) => touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  const tapBtn = async () => { const c = await G(() => { const r = document.getElementById('driveBtn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }); await press(c.x, c.y); return c; };
  const btn = () => G(() => { const b = document.getElementById('driveBtn'); return getComputedStyle(b).display !== 'none' ? b.textContent : ''; });
  const waitBtn = (re, ms = 8000) => wait(src => new RegExp(src).test(document.getElementById('driveBtn').textContent), ms, re.source);
  const cr = () => G(() => window.__app.game.progress.credits);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    ok('module', null, await G(() => !!window.__marsShops && window.__marsShops.interiors().length === 12));
    await G(() => { localStorage.removeItem('ssx.progress.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000); await sleep(1500);
    R.mode = await G(() => window.__marsShops.mode);
    const doors = await G(() => window.__app.surface.world.doorList().filter(d => d.kind.startsWith('ms_')));
    ok('doors12', doors.length, doors.length === 12);
    ok('coreDoorsKept', null, await G(() => ['cantina', 'supply', 'depot', 'guns', 'club', 'security'].every(k => window.__app.surface.world.doorList().some(d => d.kind === k))));
    await G(() => window.__app.game.debug.credits(5000));
    // per shop: which item to buy and how to verify it
    const plan = await G(() => { const S = window.__marsShops.SHOPS, o = []; for (const d in S) for (const s of S[d]) {
      const pick = s.kind === 'guns' ? s.items.find(i => i.kind === 'weapon') : s.kind === 'clothes' ? s.items.find(i => i.kind === 'bandana') : s.kind === 'pharm' ? s.items.find(i => i.kind === 'heal' && i.hp) : s.items.find(i => i.woozy || i.buff);
      const extra = s.kind === 'bar' ? s.items.find(i => i.kind === 'rumor') : s.kind === 'pharm' ? s.items.find(i => i.kind === 'medkit') : s.kind === 'clothes' ? s.items.find(i => i.kind === 'paint') : s.items.find(i => i.kind === 'ammo' && (i.ammo === 'shells' || i.ammo === 'rounds' || i.ammo === 'slugs'));
      o.push({ d, key: s.key, kind: s.kind, sign: s.sign, pick: pick?.fid, pickKind: pick?.kind, w: pick?.w, c: pick?.c, extra: extra?.fid, extraKind: extra?.kind, ammo: extra?.ammo, price: pick?.price }); } return o; });
    let shots = 0;
    for (const p of plan) {
      if (ONLY && !p.key.includes(ONLY)) continue;
      const k = p.key, dd = doors.find(x => x.kind === k); if (!dd) { ok(k + ':door', false); continue; }
      // flat ground at the storefront: player height at the door matches the colony floor within 0.6 m
      await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [dd.x, dd.z]); await sleep(700);
      const okBtn = await waitBtn(p.kind === 'bar' ? /Enter/ : /Shop/, 15000); const label = await btn();
      const c = await tapBtn();
      const inn = await wait(k => window.__app.surface.info.inside?.kind === k, 15000, k); await sleep(700);
      ok(k + ':enter', `${label} (${Math.round(c.w)}x${Math.round(c.h)})`, okBtn && inn && c.h >= 44 && c.w >= 44);
      if (!inn) continue;
      // main purchase via the context button at the ware
      // preconditions so every shop's purchase is a fresh one (the run buys the same gun ids in several districts)
      if (p.pickKind === 'heal') await G(() => { const H = window.__app.game.debug.H(); H.hp = 20; H.shield = 0; });
      if (p.pickKind === 'weapon') await G(w => { const P = window.__app.game.progress; P.unlocks = P.unlocks.filter(u => u !== 'weapon:' + w); if (P.equip.weapon === w) P.equip.weapon = 'rifle'; }, p.w);
      if (p.extraKind === 'medkit') await G(() => { window.__app.game.progress.inv.medkits = 0; });
      if (p.extraKind === 'ammo') await G(a => { const P = window.__app.game.progress, gun = { rounds: 'smg', slugs: 'railrifle', grenades: 'launcher' }[a]; if (gun && !P.unlocks.includes('weapon:' + gun)) P.unlocks.push('weapon:' + gun); P.inv[a] = 0; }, p.ammo);
      const before = await G(() => { const g = window.__app.game, P = g.progress, H = g.debug.H(); return { cr: P.credits, hp: H.hp, shield: H.shield, smax: H.smax, u: P.unlocks.slice(), eq: { ...P.equip } }; });
      const at = await G(id => { const s = window.__app.surface, w = s.world.wareList().find(x => x.id === id), b = s.world.inside; if (!w) return false; s.debugInside(w.x - (b.x0 + b.x1) / 2, w.z - (b.z0 + b.z1) / 2, 0); return true; }, p.pick);
      const lb = await waitBtn(/Buy|🛒/, 15000); const buyLabel = await btn();
      await tapBtn(); await sleep(700);
      const after = await G(() => { const g = window.__app.game, P = g.progress, H = g.debug.H(); return { cr: P.credits, hp: H.hp, shield: H.shield, smax: H.smax, u: P.unlocks.slice(), eq: { ...P.equip }, woozy: window.__marsShops.woozy(), buffs: window.__marsShops.buffs() }; });
      let eff = false;
      if (p.pickKind === 'weapon') eff = after.u.includes('weapon:' + p.w) && after.eq.weapon === p.w;
      else if (p.pickKind === 'bandana') eff = after.u.includes('bandana:' + p.c) && after.eq.bandana === p.c;
      else if (p.pickKind === 'heal') eff = after.hp > before.hp || after.shield > before.shield || after.smax > before.smax || after.woozy;
      ok(k + ':buy', `${buyLabel} | ${before.cr}->${after.cr}${eff && at && lb ? '' : ` at=${at} lb=${lb} eff=${eff} eq=${JSON.stringify(after.eq)}`}`, at && lb && after.cr === before.cr - p.price && eff);
      if (p.kind === 'bar') ok(k + ':barEffect', `woozy=${after.woozy} buffs=${after.buffs} smax ${before.smax}->${after.smax}`, after.woozy || after.smax > before.smax);
      // second purchase: tap the item's price tag on screen (tap-to-buy), fall back to the button
      if (p.extra) {
        const b2 = await G(() => { const g = window.__app.game, P = g.progress; return { cr: P.credits, med: P.inv.medkits || 0, ammo: { ...P.inv }, u: P.unlocks.slice() }; });
        await G(id => { const s = window.__app.surface, w = s.world.wareList().find(x => x.id === id), b = s.world.inside; s.debugInside(w.x - (b.x0 + b.x1) / 2, w.z - (b.z0 + b.z1) / 2, 0); }, p.extra); await sleep(900);
        const scr = await G(id => { const s = window.__app.surface, t = s.world.wareTargets().find(m => m.userData.ware === id && m.geometry.type === 'PlaneGeometry'); if (!t) return null; const v = t.getWorldPosition(t.position.clone()).project(s.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, on: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 }; }, p.extra);
        let how = 'tap';
        if (scr?.on) { await press(scr.x, scr.y); await sleep(700); }
        let a2 = await G(() => { const P = window.__app.game.progress; return { cr: P.credits }; });
        if (a2.cr === b2.cr) { how = 'button'; await waitBtn(/Buy|🛒/, 6000); await tapBtn(); await sleep(700); }
        a2 = await G(() => { const g = window.__app.game, P = g.progress; return { cr: P.credits, med: P.inv.medkits || 0, ammo: { ...P.inv }, u: P.unlocks.slice(), toast: document.getElementById('toast')?.textContent || '' }; });
        let e2 = a2.cr < b2.cr;
        if (p.extraKind === 'medkit') e2 = e2 && a2.med === b2.med + 1;
        if (p.extraKind === 'ammo') e2 = e2 && (a2.ammo[p.ammo] || 0) > (b2.ammo[p.ammo] || 0);
        if (p.extraKind === 'paint') e2 = e2 && a2.u.length === b2.u.length + 1;
        if (p.extraKind === 'rumor') e2 = e2 && /\u201c/.test(a2.toast);
        ok(k + ':buy2', `${p.extraKind} via ${how} ${b2.cr}->${a2.cr}${p.extraKind === 'rumor' ? ' ' + a2.toast.slice(0, 90) : ''}`, e2);
      }
      if (shots < 12) { await G(() => { const s = window.__app.surface, b = s.world.inside; s.debugInside(-0.8, (b.z1 - b.z0) / 2 - 2.8, 0); }); await sleep(1800); await shot(k); shots++; }
      await G(() => window.__app.surface.leaveBuilding()); await wait(() => !window.__app.surface.info.inside, 8000); await sleep(300);
    }
    ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 'none', errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.secs = Math.round((Date.now() - t0) / 1000);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'ALL PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
