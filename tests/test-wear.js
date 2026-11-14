// v7.5.96 wear + mounted guns.
// BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" OUT=/tmp/wear/ node tests/test-wear.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const desk = DEV === 'desktop';
const out = (process.env.OUT || '/tmp/wear/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const dev = desk ? { viewport: { width: 1280, height: 800 } } : (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || iph);
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL/i.test(m.text())) errors.push('C ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.97');
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(500);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.());
    ok('api', await wait(() => !!window.SSX?.skins?.grant && !!window.SSX?.wear?.move && !!window.SSX?.rideguns?.weapon, 15000));

    const ids = ['raccoon', 'merc', 'superjet', 'skates', 'dino', 'banana', 'hover', 'springs'];
    ok('catalog', await G(list => list.every(id => window.SSX.skins.list().some(s => s.id === id)), ids));
    await G(() => { window.SSX.skins.grant('raccoon', true); window.SSX.skins.grant('merc', false); });
    ok('wearingRaccoon', await G(() => window.SSX.skins.equipped === 'raccoon' && window.SSX.wear.move().speed > 1.2));
    ok('mercHarder', await G(() => { window.SSX.skins.equip('merc'); return window.SSX.wear.melee() > 1.5 && window.SSX.skins.equipped === 'merc'; }));
    ok('jet', await G(() => { window.SSX.skins.grant('superjet', true); const j = window.SSX.wear.jet(); return !!(j && j.ceil > 60 && j.thrust > 9.5 && j.fuel / j.burn > 100 / 20); }));
    await G(() => window.SSX.skins.equip('raccoon'));
    await G(() => { const s = window.__app.surface; const c = s.info.colony; s.debugMove(c.x + 8, c.z + 12, Math.PI); const st = document.createElement('style'); st.textContent = '#toast,#radio,#obLine,#ssxGuide,.ssxBark{display:none!important}'; document.head.appendChild(st); window.SSX.skins.open('wardrobe'); });
    await sleep(900);
    const row = await G(() => { const p = document.getElementById('skPanel'); const t = p?.textContent || ''; const b = p?.querySelector('button'); const r = b?.getBoundingClientRect(); return { open: p?.classList.contains('open'), merc: /Crimson Mercenary/.test(t), raccoon: /Raccoon/.test(t), h: Math.round(r?.height || 0) }; });
    ok('wardrobe', row.open && row.merc && row.raccoon && row.h >= 48, row);
    await page.screenshot({ path: out + `wear-${tag}.png` });
    await G(() => window.SSX.skins.close());

    await G(() => { const g = window.__app.game; g.progress.credits = 5000; g.save(); });
    ok('buyGuns', await G(() => window.__app.game.buy('rideguns').ok === true));
    ok('rocketsNeedGuns', await G(() => { const g = window.__app.game; g.progress.upgrades = g.progress.upgrades.filter(x => x !== 'rideguns'); g.save(); const no = g.shopItem('riderockets'); g.buy('rideguns'); const yes = g.buy('riderockets'); return no.ok === false && yes.ok === true && window.SSX.rideguns.rockets(); }));
    await G(() => { const s = window.__app.surface; if (s.info.driving) s.interact(); const i = s.info; s.debugMove(i.roverX + 1.2, i.roverZ, 0); });
    await sleep(400);
    if (!await G(() => window.__app.surface.info.driving)) await G(() => window.__app.surface.interact());
    ok('driving', await wait(() => window.__app.surface.info.driving, 5000));
    await sleep(300);
    const fire = await G(() => { const b = document.getElementById('fireBtn'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); const touch = document.body.classList.contains('touch'); return { h: Math.round(r.height), w: Math.round(r.width), show: cs.display !== 'none', kit: !!window.SSX.rideguns.weapon(), touch, cls: document.body.className }; });
    ok('fireBtn', !fire.touch || (fire.show && fire.h >= 48 && fire.w >= 48 && fire.kit), fire);
    ok('shot', await G(() => window.__app.game.fire() === true));
    if (await G(() => window.__app.surface.info.driving)) await G(() => window.__app.surface.interact());
    await sleep(400);
    ok('suits', await G(() => {
      const skins = window.__skins, stall = skins.stall();
      if (!stall || skins.mannequins.length < 2) return false;
      skins.applySkin(skins.mannequins[0], 'merc');
      skins.applySkin(skins.mannequins[1], 'banana');
      window.SSX.skins.equip('raccoon');
      window.SSX.skins.close();
      const sy = stall.rotation.y, dist = 3.1;
      const fx = -Math.sin(sy), fz = -Math.cos(sy), rx = Math.cos(sy), rz = -Math.sin(sy);
      const x = stall.position.x + fx * dist + rx * 1.5, z = stall.position.z + fz * dist + rz * 1.5;
      const face = Math.atan2(-(stall.position.x - x), -(stall.position.z - z));
      const s = window.__app.surface; s.setView('third'); s.zoom(0.5); s.debugMove(x, z, face, 0.08);
      return true;
    }));
    await sleep(1200);
    await page.screenshot({ path: out + `suits-${tag}.png` });
    ok('console', errors.length === 0, errors);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 400); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
