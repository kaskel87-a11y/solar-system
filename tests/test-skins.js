// Mars player skins (mars/skins.js): the Threadbare clothes stall in Ares Junction shows a walk-up button only when you're at
// the counter, the shop refuses when you're short and takes credits when you're not, a swipe / scroll over the list never buys,
// ☰ 👕 Wardrobe swaps owned outfits, everything survives a reload, and the parts really sit on the player rig.
// BASE=http://localhost:8941/ BR=webkit DEV=393x852 SHOTS_DIR=... NODE_PATH=/workspace/pw/node_modules node tests/test-skins.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8941/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || '393x852';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `skins-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const WEAR = (process.env.WEAR || 'punk,cowboy,kingpin,clown,hazmat,chrome').split(',');
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 };
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message); }); page.on('console', m => { if (m.type() === 'error' && !/audio device/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const toastTx = () => G(() => document.getElementById('toast')?.textContent || '');
  // pointer events with the same pointerId (a real tap) or with movement / a scroll in between (a swipe)
  const P = (t, sel, id, dx = 0, dy = 0) => G(([t, sel, id, dx, dy]) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return r.width > 0; }, [t, sel, id, dx, dy]);
  const tap = async sel => { const a = await P('pointerdown', sel, 61); await sleep(40); await P('pointerup', sel, 61); await sleep(120); return a; };
  const cr = () => G(() => window.__app.surface.game.progress.credits);
  const setCr = n => G(n => { window.__app.surface.game.progress.credits = n; }, n);
  const S = () => G(() => window.SSX.skins.state());
  const boot = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => { const r = document.getElementById('radio'); return !!r && getComputedStyle(r).display !== 'none'; })) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { try { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.SSX.time?.set?.(13); } catch (e) { /* */ } });
  };
  // stand d metres out in front of the counter, facing the stall (camera behind you)
  const atShop = async (d = 3) => { await G(d => { const p = window.SSX.skins.at(); window.__app.surface.debugPlace(p.x - Math.sin(p.yaw) * d, p.z - Math.cos(p.yaw) * d, p.yaw + Math.PI); }, d); await sleep(700); };
  const row = id => `#skPanel .row[data-id="${id}"] button`;
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await boot();
    ok('api', await G(() => { const k = window.SSX?.skins; return !!k && k === window.__skins.api && k.list().length >= 10 && k.list().length <= 12; }));
    const s0 = await S(); ok('freshState', s0, s0.owned.length === 1 && s0.owned[0] === 'rusty' && s0.eq === 'stock');
    ok('catalogue', await G(() => window.SSX.skins.list().map(k => `${k.name} ${k.price}`)));
    ok('playerRig', await G(() => !!window.__skins.player()));
    ok('stallBuilt', await G(() => { const g = window.__skins.stall(); return !!g && !!g.parent && window.__skins.mannequins.length === 2; }));
    // far away: no button, the shop won't open
    await G(() => { const p = window.SSX.skins.at(); window.__app.surface.debugPlace(p.x + 30, p.z + 30, 0); }); await sleep(800);
    ok('farNoButton', await G(() => !window.SSX.skins.near() && !(document.getElementById('skBtn') && getComputedStyle(document.getElementById('skBtn')).display !== 'none')));
    ok('farShopRefuses', await G(() => window.SSX.skins.open('shop') === false));
    // at the counter: the black walk-up button
    await atShop(3);
    ok('nearButton', await wait(() => window.SSX.skins.near() && getComputedStyle(document.getElementById('skBtn')).display !== 'none', 6000));
    ok('buttonBW', await G(() => { const c = getComputedStyle(document.getElementById('skBtn')); return c.backgroundColor + ' ' + c.color; }), /rgb\(0, 0, 0\) rgb\(255, 255, 255\)/.test(await G(() => { const c = getComputedStyle(document.getElementById('skBtn')); return c.backgroundColor + ' ' + c.color; })));
    await sleep(600); await shot('stall');
    await setCr(100);
    await tap('#skBtn'); ok('shopOpens', await wait(() => document.getElementById('skPanel').classList.contains('open') && /Threadbare/.test(document.querySelector('#skPanel .t').textContent), 4000));
    ok('rows', await G(() => document.querySelectorAll('#skPanel .row').length));
    await sleep(300); await shot('shop');
    // short on credits: refused, nothing spent
    await tap(row('punk')); await sleep(300);
    const t1 = await toastTx(); ok('brokeRefused', t1, /Ripped Punk is 300 cr/.test(t1) && (await cr()) === 100 && !(await S()).owned.includes('punk'));
    await setCr(3000); await G(() => window.__skins.render());
    // swipe across a buy button (finger moves 40 px), and a scroll of the list mid-press: neither buys
    await P('pointerdown', row('punk'), 71); await P('pointermove', row('punk'), 71, 0, -20); await P('pointermove', row('punk'), 71, 0, -40); await P('pointerup', row('punk'), 71, 0, -40); await sleep(200);
    await P('pointerdown', row('overalls'), 72); await G(() => { const l = document.querySelector('#skPanel .list'); l.scrollTop = 60; l.dispatchEvent(new Event('scroll')); }); await sleep(80); await P('pointerup', row('overalls'), 72); await sleep(200);
    await P('pointerdown', row('biker'), 73); await P('pointerup', row('biker'), 74); await sleep(200); // different pointerId: not a tap
    const sw = await G(() => ({ ...window.__skins.taps, owned: window.SSX.skins.owned }));
    ok('swipeNoBuy', sw, sw.buys === 0 && sw.swipes >= 2 && (await cr()) === 3000 && sw.owned.length === 1);
    await G(() => { document.querySelector('#skPanel .list').scrollTop = 0; }); await sleep(400);
    // real taps buy: credits deducted, auto-worn, parts on the rig
    await tap(row('punk')); await sleep(300);
    const b1 = await S(); ok('buyPunk', { b1, taps: await G(() => window.__skins.taps), cr: await cr(), toast: await toastTx() }, b1.owned.includes('punk') && b1.eq === 'punk' && b1.applied === 'punk' && b1.parts > 5 && (await cr()) === 2700);
    await G(() => document.querySelector(`#skPanel .row[data-id="hustler"]`)?.scrollIntoView({ block: 'center' })); await sleep(500);
    await tap(row('hustler')); await sleep(300);
    const b2 = await S(); ok('buyHustler', { eq: b2.eq, taps: await G(() => ({ ...window.__skins.taps, st: document.querySelector('#skPanel .list').scrollTop, b: document.querySelector('#skPanel .row[data-id="hustler"] button')?.outerHTML })), cr: await cr() }, b2.owned.includes('hustler') && b2.eq === 'hustler' && (await cr()) === 1500);
    await G(() => document.querySelector(`#skPanel .row[data-id="cowboy"]`)?.scrollIntoView({ block: 'center' })); await sleep(500);
    await tap(row('kingpin')); await sleep(300);
    ok('buyKingpinRefused', await cr(), (await cr()) === 1500 && !(await S()).owned.includes('kingpin'));
    ok('partsAttached', await G(() => { const p = window.__skins.player(); if (!p) return false; const a = []; p.group.traverse(o => { if (o.name?.startsWith?.('ssxSkin:')) a.push(o.name + '<' + (o.parent?.name || o.parent?.type)); }); return a; }), await G(() => { const p = window.__skins.player(); let n = 0, limb = 0; p.group.traverse(o => { if (o.name?.startsWith?.('ssxSkin:')) { n++; if (o.parent !== p.group) limb++; } }); return n >= 3 && limb >= 1; }));
    await tap('#skPanel button[data-a="x"]'); ok('closes', await G(() => !document.getElementById('skPanel').classList.contains('open')));
    // ☰ 👕 Wardrobe: owned outfits only (+ the stock suit), Wear swaps
    await G(() => { const p = window.SSX.skins.at(); window.__app.surface.debugPlace(p.x + 30, p.z + 30, 0); }); await sleep(500);
    await tap('#menuBtn'); await wait(() => document.getElementById('roverMenu').classList.contains('show'), 4000);
    await G(() => document.getElementById('rmWardrobe')?.scrollIntoView({ block: 'center' })); await sleep(250);
    ok('wardrobeItem', await G(() => document.getElementById('rmWardrobe')?.textContent || ''), /Wardrobe/.test(await G(() => document.getElementById('rmWardrobe')?.textContent || '')));
    await tap('#rmWardrobe');
    ok('wardrobeOpens', await wait(() => document.getElementById('skPanel').classList.contains('open') && /Wardrobe/.test(document.querySelector('#skPanel .t').textContent), 4000));
    ok('wardrobeRows', await G(() => [...document.querySelectorAll('#skPanel .row')].map(r => r.dataset.id)), (await G(() => [...document.querySelectorAll('#skPanel .row')].map(r => r.dataset.id).join())) === 'stock,rusty,punk,hustler');
    await sleep(200); await shot('wardrobe');
    await tap(row('rusty')); await sleep(300);
    const w1 = await S(); ok('wardrobeWear', w1, w1.eq === 'rusty' && w1.applied === 'rusty');
    await tap(row('stock')); await sleep(300);
    const w2 = await S(); ok('wardrobeStock', w2, w2.eq === 'stock' && w2.parts === 0 && await G(() => { const p = window.__skins.player(); let n = 0; p.group.traverse(o => { if (o.name?.startsWith?.('ssxSkin:')) n++; }); return n === 0; }));
    await tap(row('punk')); await sleep(300);
    await tap('#skPanel button[data-a="x"]');
    // reload: owned + worn persist, the skin is back on
    await page.reload(); await boot(); await wait(() => window.SSX?.skins?.state?.().applied === 'punk', 20000);
    const r1 = await S(); ok('persists', r1, r1.eq === 'punk' && r1.applied === 'punk' && r1.parts > 5 && ['rusty', 'punk', 'hustler'].every(i => r1.owned.includes(i)) && r1.owned.length === 3);
    // dress-up for the screenshots: close camera on the front of the character
    await G(() => { window.__skins.api.__anywhere = true; window.__app.surface.game.progress.credits = 99999; });
    for (const id of WEAR) {
      await G(id => { const k = window.SSX.skins; if (!k.owned.includes(id)) k.buy(id); else k.equip(id); k.close(); }, id);
      await atShop(4.5); // in the street in front of the stall, the camera turned round to face you
      await G(() => { const s = window.__app.surface; s.setView('third'); s.zoom(0.45); s.look(0, -10, 1); s.look(Math.PI, 1.45 + 0.22, 1); /* pitch clamps at 1.45: reset, then 0.22 down */ }); await sleep(900);
      const st = await S(); ok('worn:' + id, st.applied, st.applied === id && st.parts > 3);
      await shot('worn-' + id);
    }
    ok('stats', await G(() => window.__skins.stats));
  } catch (e) { bad.push('EXC ' + e.message); console.log(e.stack); }
  ok('noErrors', errors.slice(0, 5), errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? `FAIL ${tag}: ${bad.join(', ')}` : `ALL PASS ${tag}`);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
