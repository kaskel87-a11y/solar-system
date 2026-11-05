// v7.5.42 crew: at 12k stars Dex hangs out in Ares Junction, walk up -> 👥 Dex -> intro -> Hire -> Corner hustle; a job done
// (clock pushed 11 min) -> Collect washes 150 +15% into the Red Dust Wash till, +8 stars. Black 44px buttons. Saves ssx.crew.v1.
// BASE=http://localhost:8765/ BR=chromium DEV="iPhone 14" SHOT=/tmp/crew.png node tests/test-crew.js
const pw = require(process.env.PW || 'playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...dev } = desk ? { viewport: { width: 1366, height: 768 } } : pw.devices[DEV];
  const ctx = await browser.newContext(dev); const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const tap = sel => G(async sel => { const b = document.querySelector(sel); if (!b) return false; const r = b.getBoundingClientRect(), o = { pointerId: 61, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 60)); b.dispatchEvent(new PointerEvent('pointerup', o)); return true; }, sel);
  const SAVE = { v: 1, xp: 12000, credits: 20000, badges: ['first'], quests: {}, equip: { paint: 'steel' }, unlocks: [], inv: { medkits: 1 }, flags: [] };
  await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
  await G(s => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"done":true,"skipped":true}'); localStorage.setItem('ssx.progress.v1', JSON.stringify(s)); }, SAVE);
  await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
  ok('api', await wait(() => !!window.SSX?.crew && !!document.getElementById('rmCrew'), 20000));
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(800);
  await G(() => { window.__app.surface.game.setAliens?.(false); (window.SSX_TICKS ||= []).push((dt, tc) => { window.__tc = tc; }); document.getElementById('radioLater')?.click(); }); await frames(3);
  ok('spot', await wait(() => !!window.SSX.crew.spot(), 20000));
  await G(() => { const s = window.SSX.crew.spot(); window.__app.surface.debugPlace(s.x + 2.5, s.z + 1, 0); }); await frames(20);
  R.npc = await G(() => { const r = window.__tc.scene.getObjectByName('crew'); return r ? { vis: r.visible, meshes: r.children.filter(c => c.visible).reduce((n, g) => n + g.children.length, 0) } : null; });
  ok('npcVisible', R.npc, R.npc?.vis && R.npc.meshes === 4);
  ok('talkBtn', await wait(() => { const b = document.getElementById('crewBtn'); return b && b.style.display !== 'none' && /Dex/.test(b.textContent); }, 10000));
  await tap('#crewBtn'); ok('panel', await wait(() => window.SSX.crew.isOpen && /Ten grand/.test(document.getElementById('crewPanel').textContent), 5000));
  await tap('#crewPanel button[data-a="hire"]'); await frames(3);
  ok('hired', await G(() => window.SSX.crew.state().crew[0]?.id === 'dex'));
  await G(() => window.SSX.empire.debug.grant('fr-wash'));
  await tap('#crewPanel button[data-a="job"][data-job="hustle"]'); await frames(3);
  ok('assigned', await G(() => window.SSX.crew.state().crew[0].job === 'hustle'));
  R.btnStyle = await G(() => { const s = getComputedStyle(document.querySelector('#crewPanel button')), r = document.querySelector('#crewPanel button').getBoundingClientRect(); return { bg: s.backgroundColor, fg: s.color, h: Math.round(r.height) }; });
  ok('blackButtons', R.btnStyle, R.btnStyle.bg === 'rgb(0, 0, 0)' && R.btnStyle.fg === 'rgb(255, 255, 255)' && R.btnStyle.h >= 44);
  // 9 minutes later (also covers "while you were away": the clock is wall time)
  const xp0 = await G(() => window.__app.surface.game.progress.xp);
  await G(() => { window.SSX.crew.debug.rng(() => 0.9); window.SSX.crew.debug.clock(() => Date.now() + 11 * 60000); window.SSX.crew.pump(); });
  await sleep(1200); ok('banked', await G(() => window.SSX.crew.state().crew[0].bank.length === 1));
  await page.screenshot({ path: process.env.SHOT || out + `crew-panel-${tag}.png` });
  await tap('#crewPanel button[data-a="collect"]'); await frames(3);
  R.after = await G(x0 => ({ xp: window.__app.surface.game.progress.xp - x0, till: window.SSX.empire.prop('fr-wash').pending, crew: window.SSX.empire.prop('fr-wash').crew }), xp0);
  ok('washed', R.after, R.after.crew === 173 && R.after.xp === 8);
  R.saved = await G(() => JSON.parse(localStorage.getItem('ssx.crew.v1')).crew.length === 1); ok('saved', R.saved);
  ok('noErrors', errors.length ? errors : true, !errors.length);
  console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + bad.join(',') : 'PASS'); await browser.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
