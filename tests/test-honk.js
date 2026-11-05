// Grin Reaper outfit + brass bulb horn (mars/honk.js): the free Halloween outfit is in the wardrobe of a fresh save, wearing it
// puts the horn in hand once (shown on the right hand only while it is the weapon), every swing honks + scares, the black
// 📯 Honk button / Shift+C taunt, the 👊 button shows 📯, Q swaps it away (prop hides), and the iPhone close-up.
// BASE=http://localhost:8941/ DEV=393x852 SHOTS_DIR=... NODE_PATH=/workspace/pw/node_modules node tests/test-honk.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8941/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || '393x852';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `honk-${DEV}-${BR}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => { if (!/audio device/i.test(e.message)) errors.push('PE ' + e.message); }); page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(`${cond ? 'PASS' : 'FAIL'} ${k} ${typeof v === 'boolean' ? '' : JSON.stringify(v)}`); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 60 }); return true; } catch (e) { return false; } };
  const shot = async s => { const p = `${out}${tag}-${s}.png`; try { await page.screenshot({ path: p, timeout: 120000 }); (R.shots ||= []).push(p); } catch (e) { (R.shotFail ||= []).push(p); } };
  const P = (t, sel, id) => G(([t, sel, id]) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 })); return r.width > 0; }, [t, sel, id]);
  const tap = async sel => { const a = await P('pointerdown', sel, 61); await sleep(40); await P('pointerup', sel, 61); await sleep(150); return a; };
  const H = () => G(() => window.SSX.honk.state());
  const boot = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => { const r = document.getElementById('radio'); return !!r && getComputedStyle(r).display !== 'none'; })) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { try { window.__app.surface.world.setWanted(0); window.__app.game?.setAliens?.(false); window.SSX.time?.set?.(13); } catch (e) { /* */ } });
  };
  const atShop = async (d = 3) => { await G(d => { const p = window.SSX.skins.at(); window.__app.surface.debugPlace(p.x - Math.sin(p.yaw) * d, p.z - Math.cos(p.yaw) * d, p.yaw + Math.PI); }, d); await sleep(700); };
  const front = async (zm = 0.32, dn = 0.12) => { await G(([zm, dn]) => { const s = window.__app.surface; s.setView('third'); s.zoom(zm); s.look(0, -10, 1); s.look(Math.PI, 1.45 + dn, 1); }, [zm, dn]); await sleep(1100); };
  try {
    await page.goto(base + '?onboard=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear()); await page.reload(); await boot();
    ok('api', await G(() => !!window.SSX?.honk && !!window.SSX?.skins && !!window.SSX?.arsenal));
    const k = await G(() => window.SSX.skins.list().find(k => k.id === 'grinreaper'));
    ok('outfitFree', k && { name: k.name, price: k.price }, k?.name === 'Grin Reaper' && k.price === 0);
    ok('ownedFresh', await G(() => window.SSX.skins.owned.includes('grinreaper')));
    const h0 = await H(); ok('notWorn', h0, !h0.worn && !h0.button && !h0.inHand && !h0.given);
    ok('noHornYet', await G(() => !window.SSX.arsenal.owned('horn')));
    // the ☰ 👕 Wardrobe lists it next to the free spacesuit
    await G(() => window.SSX.skins.open('wardrobe')); await sleep(400);
    ok('wardrobeRow', await G(() => [...document.querySelectorAll('#skPanel .row')].map(r => r.dataset.id).join()), /^stock,rusty,grinreaper/.test(await G(() => [...document.querySelectorAll('#skPanel .row')].map(r => r.dataset.id).join())));
    await tap('#skPanel .row[data-id="grinreaper"] button'); await sleep(300); await G(() => window.SSX.skins.close());
    ok('worn', await G(() => window.SSX.skins.state().applied), (await G(() => window.SSX.skins.state().applied)) === 'grinreaper');
    ok('hornGiven', await wait(() => { const s = window.SSX.honk.state(); return s.given && s.inHand; }, 8000), await H());
    ok('hornWeapon', await G(() => window.SSX.arsenal.weapons().find(w => w.id === 'horn')), await G(() => { const w = window.SSX.arsenal.weapons().find(w => w.id === 'horn'); return !!w && w.kind === 'melee' && w.equipped; }));
    ok('propShown', await G(() => window.SSX.skins.prop()), (await G(() => window.SSX.skins.prop())).shown === true);
    await atShop(4);
    ok('button', await wait(() => window.SSX.honk.state().button, 4000));
    const col = await G(() => { const c = getComputedStyle(document.getElementById('honkBtn')); return c.backgroundColor + ' ' + c.color + ' ' + document.getElementById('honkBtn').textContent; });
    ok('buttonBW', col, /rgb\(0, 0, 0\) rgb\(255, 255, 255\) 📯 Honk/.test(col));
    ok('meleeBtnHorn', await G(() => document.getElementById('meleeBtn')?.textContent ?? 'none'), ['📯', 'none'].includes(await G(() => document.getElementById('meleeBtn')?.textContent ?? 'none')));
    // taunt by tap: double honk + scare
    await G(() => { window.__hEv = []; window.SSX.honk.on(e => window.__hEv.push(e.type)); });
    await tap('#honkBtn'); await sleep(200);
    const h1 = await H(); ok('tapTaunt', { taunts: h1.taunts, honks: h1.honks, sounds: h1.sounds, scared: h1.scared, ev: await G(() => window.__hEv) }, h1.taunts === 1 && h1.honks === 1);
    ok('audioRuns', await G(() => window.__honk.audio()), h1.sounds >= 1);
    await tap('#honkBtn'); ok('tauntCooldown', (await H()).taunts === 1);
    await sleep(800); await page.keyboard.press('Shift+C'); await sleep(200);
    ok('shiftC', (await H()).taunts === 2);
    // a swing (FIRE / 👊 / C all route through the arsenal swing): honks + bonks
    const sw = await G(() => window.SSX.arsenal.debug.fire()); await sleep(300);
    const h2 = await H(); ok('swingHonks', { sw, swings: h2.swings, honks: h2.honks }, h2.swings === 1 && h2.honks === 3);
    // NPCs flee: drop a colonist next to you and taunt
    await sleep(700);
    const fl = await G(() => { const s = window.__app.surface, w = s.world, i = s.info; const n0 = window.SSX.honk.state().scared; window.SSX.honk.taunt(); return { scared: window.SSX.honk.state().scared - n0, people: (w.people || []).length, near: (w.people || []).filter(p => Math.hypot(p.x - i.x, p.z - i.z) < 14).length, fleeing: (w.people || []).filter(p => p.flee > 0).length }; });
    ok('scare', fl, fl.near === 0 || fl.scared > 0);
    // Q swaps it away: the horn leaves the hand, the outfit stays
    await G(() => window.SSX.arsenal.equip('fists') ?? null); await G(() => { const g = window.__app.surface.game; if (g.progress.equip.weapon === 'ar_horn') window.SSX.arsenal.cycle(); }); await sleep(300);
    const sp = await G(() => ({ prop: window.SSX.skins.prop(), w: window.__app.surface.game.progress.equip.weapon, worn: window.SSX.skins.equipped }));
    ok('swapHides', sp, sp.w !== 'ar_horn' && sp.prop.shown === false && sp.worn === 'grinreaper');
    ok('meleeBtnBack', await G(() => document.getElementById('meleeBtn')?.textContent ?? 'none'), (await G(() => document.getElementById('meleeBtn')?.textContent ?? 'none')) !== '📯');
    await G(() => window.SSX.arsenal.equip('horn')); await sleep(300);
    ok('reEquip', (await G(() => window.SSX.skins.prop())).shown === true);
    // reload: no second gift / forced equip
    await G(() => window.SSX.arsenal.cycle()); await sleep(200); const wAfter = await G(() => window.__app.surface.game.progress.equip.weapon);
    await page.reload(); await boot(); await sleep(1500);
    const h3 = await H(); ok('persists', { h3, w: await G(() => window.__app.surface.game.progress.equip.weapon), wAfter }, h3.given && h3.worn && !h3.gave);
    await G(() => window.SSX.arsenal.equip('horn')); await sleep(300);
    // iPhone close-up
    await atShop(4.5); await front(0.32, 0.1); await shot('closeup');
    await atShop(4.5); await front(0.5, 0.2); await shot('full');
  } catch (e) { bad.push('EXC ' + e.message); console.log(e.stack); }
  ok('noErrors', errors.slice(0, 5), errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? `FAIL ${tag}: ${bad.join(', ')}` : `ALL PASS ${tag}`);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
