// Velvet Mack (mars/skinscore.js 'mack', 1,000 cr): sold at the Threadbare stall between Hazmat Cook and Neon Street Hustler,
// buys with a real tap, goes on the player rig (hat + feather, velvet suit + fur collar, chains, shades, cane in the right
// hand), and the cane (skin.prop) hides while a weapon is out: firing (2.5 s after the last shot) and the machete equipped,
// then comes back. Shots: front, side, machete drawn.
// BASE=http://127.0.0.1:8978/ BR=webkit DEV=393x852 QS='look=classic&models=1' SHOTS_DIR=... node tests/test-velvet-mack.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8978/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852', QS = process.env.QS ?? 'look=classic&models=1';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `velvet-mack-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message); }); page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const P = (t, sel, id) => G(([t, sel, id]) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return true; }, [t, sel, id]);
  const tap = async sel => { const a = await P('pointerdown', sel, 61); await sleep(40); await P('pointerup', sel, 61); await sleep(150); return a; };
  const cr = () => G(() => window.__app.surface.game.progress.credits);
  const S = () => G(() => window.SSX.skins.state()), prop = () => G(() => window.SSX.skins.prop());
  const atShop = async (d = 3) => { await G(d => { const p = window.SSX.skins.at(); window.__app.surface.debugPlace(p.x - Math.sin(p.yaw) * d, p.z - Math.cos(p.yaw) * d, p.yaw + Math.PI); }, d); await sleep(900); };
  const cam = async yaw => { await G(yaw => { const s = window.__app.surface; s.setView('third'); s.zoom(0.45); s.look(0, -10, 1); s.look(yaw, 1.45 + 0.22, 1); }, yaw); await sleep(1000); };
  try {
    await page.goto(base + '?' + QS + (QS ? '&' : '') + 't=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1000);
    if (await G(() => { const r = document.getElementById('radio'); return !!r && getComputedStyle(r).display !== 'none'; })) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { try { window.SSX.onboard?.skip?.(); } catch (e) { } try { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.SSX.time?.set?.(13); window.SSX.time?.freeze?.(true); window.SSX.hudx?.setWaypoint?.(null, true); } catch (e) { /* */ } });
    await wait(() => !!window.SSX?.skins && !!window.__skins?.stall?.() && !!window.__skins.player(), 20000);
    const cat = await G(() => window.SSX.skins.list().map(k => k.id + ':' + k.price));
    ok('catalogueOrder', cat, cat.join().includes('hazmat:800,mack:1000,hustler:1200') && cat.length === 12);
    await G(() => { window.__app.surface.game.progress.credits = 1200; });
    await atShop(3); ok('near', await G(() => window.SSX.skins.near()));
    await tap('#skBtn'); ok('shopOpens', await wait(() => document.getElementById('skPanel').classList.contains('open') && /Threadbare/.test(document.querySelector('#skPanel .t').textContent), 4000));
    await G(() => document.querySelector('#skPanel .row[data-id="mack"]')?.scrollIntoView({ block: 'center' })); await sleep(400);
    const rowTx = await G(() => document.querySelector('#skPanel .row[data-id="mack"]')?.textContent || '');
    ok('shopRow', rowTx, /Velvet Mack/.test(rowTx) && /Buy · 1,000 cr/.test(rowTx));
    ok('shopRowOrder', await G(() => [...document.querySelectorAll('#skPanel .row')].map(r => r.dataset.id).slice(4, 7).join()), (await G(() => [...document.querySelectorAll('#skPanel .row')].map(r => r.dataset.id).slice(4, 7).join())) === 'hazmat,mack,hustler');
    await shot('shop-row');
    await tap('#skPanel .row[data-id="mack"] button'); await sleep(400);
    const s1 = await S(); ok('bought', { s1, cr: await cr() }, s1.owned.includes('mack') && s1.eq === 'mack' && s1.applied === 'mack' && s1.parts >= 10 && (await cr()) === 200);
    await tap('#skPanel button[data-a="x"]');
    const p0 = await prop(); ok('caneShown', p0, p0.shown && p0.meshes >= 3 && !p0.out);
    ok('caneInHand', await G(() => { const a = window.__skins.player().applied, k = window.__skins.C.BY_ID.mack; return a.anchors.filter(an => an.children.some(o => k.prop.some(key => o.material === window.__skins.mats.get(window.__skins.C.matKey(window.__skins.C.matSpec(k, key)))))).map(an => an.name); }), true);
    await atShop(4.5); await cam(Math.PI); await shot('front');
    await cam(Math.PI / 2); await shot('side');
    // the machete drawn: cane hides; back to the blaster: cane back
    await G(() => { const g = window.__app.surface.game; if (!g.progress.unlocks.includes('melee:blade')) g.progress.unlocks.push('melee:blade'); g.switchWeapon('blade'); }); await sleep(600);
    const p3 = await prop(); ok('caneHidesMelee', { p3, w: await G(() => window.__app.surface.game.progress.equip.weapon) }, p3.out === 'melee' && !p3.shown);
    await cam(Math.PI * 0.75); await shot('weapon-drawn');
    await G(() => window.__app.surface.game.switchWeapon('rifle')); await sleep(600);
    const p4 = await prop(); ok('caneBackAfterMelee', { p4, w: await G(() => window.__app.surface.game.progress.equip.weapon) }, p4.shown && !p4.out);
    // firing (a shot counted, without real bolts in town, which brings the cops): cane hides, back ~2.5 s after the last shot
    await G(() => { const st = window.__app.surface.game.progress.stats; st.shots = (st.shots || 0) + 1; }); await sleep(300);
    const p1 = await prop(), shots = await G(() => window.__app.surface.game.progress.stats?.shots);
    ok('caneHidesFiring', { p1, shots }, p1.out === 'firing' && !p1.shown);
    await sleep(3000); const p2 = await prop(); ok('caneBackAfterFiring', p2, p2.shown && !p2.out);
    // another skin: no prop
    await G(() => window.SSX.skins.equip('rusty')); await sleep(300); const p5 = await prop(); ok('noPropOtherSkin', p5, p5.meshes === 0);
    await G(() => window.SSX.skins.equip('mack')); await sleep(300); ok('reEquipCane', await prop(), (await prop()).shown);
  } catch (e) { bad.push('EXC ' + e.message); console.log(e.stack); }
  ok('noErrors', errors.slice(0, 5), errors.length === 0);
  R.bad = bad; console.log(bad.length ? `FAIL ${tag}: ${bad.join(', ')}` : `ALL PASS ${tag}`);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
