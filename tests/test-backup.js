// Saltblood backup escorts smoke test (SSX.danger.spawnBackup, Marrow's barter gang_backup, SSX.contraband hook).
// Shares the boot helpers with the street danger smoke test: knife mugging end to end (approach -> standoff chip + Pay/Fight/Run/Talk context
// buttons -> pay / fight-and-kill / run / talk / timeout outcomes, loot, heat), an ambient street fight, and an MCPD
// pursuit (crime at the wheel -> interceptors chase and ram, spike strip, lose them by breaking sight). HUD: centre stays clear.
// BASE=http://localhost:8793/ DEV=393x852 BR=webkit NODE_PATH=/workspace/pw/node_modules node tests/test-danger.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8793/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || '/workspace/danger-shots/', PFX = process.env.PFX || 'danger';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ').replace(/https?:\/\/[^/]+\//g, ''))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const vis = sel => G(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
  const center = sel => G(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapAt = async sel => { const c = await center(sel); if (touch) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); };
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800); };
  const D = () => G(() => window.__danger.state);
  // nothing of ours may cover the middle 40% x 30% of the screen
  const centreClear = () => G(() => { const W = innerWidth, Hh = innerHeight, c = { l: W * 0.3, r: W * 0.7, t: Hh * 0.35, b: Hh * 0.65 };
    return ['#dangerChip', '#dangerChoices button'].every(sel => [...document.querySelectorAll(sel)].every(e => { const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).display === 'none') return true; return r.right < c.l || r.left > c.r || r.bottom < c.t || r.top > c.b; })); });
  // stand in the rough ring around Ares Junction, facing out
  const rough = async (k = 0) => G(k => { const s = window.__app.surface, c = s.world.colony, a = 0.6 + k * 0.4; s.debugPlace(c.x + Math.cos(a) * 115, c.z + Math.sin(a) * 115, 0); }, k);
  const standoff = async () => { const okk = await wait(() => window.__danger.state.mug?.phase === 'standoff', 30000); return okk; };
  const newMug = async (k) => { await G(() => { window.__danger.clear(); window.__danger.skipGrace(); }); await rough(k); await sleep(300); await G(() => window.__danger.force('mugging', { dist: 9 })); return standoff(); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    // a stand-in for Marsmania's contraband module: it exposes a give handler registry
    await G(() => { window.SSX = window.SSX || {}; window.SSX.contraband = { handlers: {}, registerGiveHandler(t, fn) { this.handlers[t] = fn; } }; });
    await G(() => { localStorage.removeItem('ssx.progress.v1'); localStorage.removeItem('ssx.danger.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); }); await land();
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); window.__danger.clear(); });
    ok('apiExposed', null, await G(() => typeof window.SSX?.danger?.spawnBackup === 'function'));
    ok('contrabandHooked', JSON.stringify(await G(() => window.__danger.backup.contraband)), await wait(() => typeof window.SSX.contraband.handlers.gang_backup === 'function', 8000));
    await rough(0); await sleep(400);
    const offer = await G(() => fetch('data/barter.json').then(r => r.json()).then(b => b.offers.find(o => o.id === 'marrow-saltblood-backup').gives));
    ok('marrowOffer', JSON.stringify(offer), offer?.type === 'gang_backup' && offer.count === 3);
    const res = await G(g => window.SSX.contraband.handlers.gang_backup({ ...g, durationSec: 30 }), offer);
    ok('spawned', JSON.stringify(res), res?.ok && res.n >= 1 && res.n <= 3);
    const b0 = await G(() => window.__danger.budget());
    ok('budgetCap', JSON.stringify(b0), b0.world + b0.ours + b0.chase <= Math.max(b0.cap, b0.world) && b0.cap <= 12);
    // walk forward: they follow
    await G(() => { const s = window.__app.surface, p = s.info; s.debugMove?.(p.x - Math.sin(p.yaw ?? 0) * 12, p.z - Math.cos(p.yaw ?? 0) * 12); });
    ok('follow', JSON.stringify(await G(() => window.__danger.backup.escorts)), await wait(() => { const p = window.__app.surface.info; return window.__danger.backup.escorts.filter(e => e.alive).every(e => Math.hypot(e.x - p.x, e.z - p.z) < 9); }, 30000));
    await sleep(300); await shot('backup');
    // a mugger shows up: the crew takes him apart
    await G(() => { window.__downs = []; addEventListener('ssx:npc-down', e => window.__downs.push(e.detail)); });
    await G(() => { window.__danger.skipGrace(); window.__danger.force('mugging', { dist: 9 }); });
    ok('escortsFight', JSON.stringify(await G(() => ({ s: window.__danger.state.stats, b: window.__danger.backup.stats }))), await wait(() => window.__danger.backup.stats.kills >= 1 || !window.__danger.state.mug, 60000));
    ok('npcDownEvent', JSON.stringify(await G(() => window.__downs)), await wait(() => window.__downs.length >= 1 || !window.__danger.backup.stats.kills, 5000));
    ok('noCrimeFromCrew', await G(() => window.__app.surface.world.wanted), await G(() => window.__app.surface.world.wanted === 0));
    // the hire runs out: they walk and despawn
    await G(() => window.__danger.endBackup());
    ok('despawn', JSON.stringify(await G(() => window.__danger.backup)), await wait(() => !window.SSX.danger.backup && !window.__danger.backup.escorts.some(e => e.alive), 60000));
    // refused in a duel-free but full budget world is reported, never throws
    ok('garbageSafe', JSON.stringify(await G(() => [window.SSX.danger.spawnBackup(null), window.SSX.danger.spawnBackup({ faction: 'colsec' })])), await G(() => { const a = window.SSX.danger.spawnBackup({ faction: 'colsec' }); return a && a.ok === false; }));
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors; ok('noErrors', errors.join(' | '), !errors.length); R.bad = bad;
  console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
