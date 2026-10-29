// Mars faction reputation (mars/rep.js, SSX.rep): API + aliases, Saltblood seed (flagsToRep), event listeners (npc-down,
// ssx:job, ssx:turf, ssx:beltway, contraband sell/barter), tier toasts, price multiplier, barter gates, hostile squad,
// backup via SSX.danger.spawnBackup, revenge raid fallback, persistence, panel taps/contrast/44px, no console errors.
// BASE=http://127.0.0.1:8880/ BR=webkit DEV="iPhone 14" OUT=./shots/ node tests/test-rep.js   (DEV=desktop for 1366x768; one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8880/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(400); };
  const shown = () => G(() => document.getElementById('repPanel')?.classList.contains('show'));
  const moveAJ = (x, z) => G(([x, z]) => { const s = window.__app.surface, c = s.info.colony; s.debugMove(c.x + x, c.z + z, 0); }, [x, z]);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.rep, 10000);
    ok('api', await G(() => ['get', 'tier', 'add', 'all', 'on', 'priceMultiplier', 'backup', 'open', 'close'].every(k => typeof window.SSX.rep[k] === 'function') && !!window.SSX.rep.debug));
    ok('menuItem', await G(() => !!document.getElementById('rmRep')));
    ok('unknownIsZero', await G(() => window.SSX.rep.get('meridian') === 0 && window.SSX.rep.get('nope') === 0));
    // seed: 2 Saltblood flags -> round(2 x 100/3) = 67 (dangercore flagsToRep scale)
    R.seed = await G(() => { const P = window.__app.game.progress; P.flags.push('vesna-test', 'saltblood:test'); window.SSX.rep.debug.reset(); window.SSX.rep.debug.seed(); const v = window.SSX.rep.get('saltblood'); P.flags.splice(P.flags.indexOf('vesna-test'), 2); window.SSX.rep.debug.reset(); window.SSX.rep.debug.seed(); return [v, window.SSX.rep.get('saltblood')]; });
    ok('seedFlags', R.seed, R.seed[0] === 67 && R.seed[1] === 0);
    R.aliases = await G(() => { const r = window.SSX.rep; r.add('vacuum-saints', 5, 't'); r.add('dustjaw', -5, 't'); const a = [r.get('saints'), r.get('Vacuum Saints'), r.get('dustjaws'), r.get('dustjaw-boys')].join(); r.debug.reset(); return a; });
    ok('aliases', R.aliases, R.aliases === '5,5,-5,-5');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.game.debug.calm?.(true); window.SSX.rep.debug.reset(); window.__app.surface.world.setWanted(0); window.__toasts = []; const t0 = window.__app.toast; window.__app.toast = (m, ms) => { window.__toasts.push(String(m)); return t0(m, ms); }; window.__tiers = []; window.SSX.rep.on('tier', e => window.__tiers.push(e.id + ':' + e.to)); });
    // events from other modules (dispatched the way they dispatch them)
    await moveAJ(-280, -40); await sleep(500);
    R.events = await G(() => { const r = window.SSX.rep, i = window.__app.surface.info, fire = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }));
      fire('ssx:npc-down', { x: i.x + 3, z: i.z, name: 'Saint', faction: 'saints' });
      fire('ssx:npc-down', { x: i.x + 2, z: i.z, name: 'Junkie' });
      fire('ssx:npc-down', { x: i.x + 2, z: i.z, name: 'Saltblood escort', faction: 'saltblood' });
      fire('ssx:npc-down', { x: i.x + 500, z: i.z, name: 'Saltblood', faction: 'saltblood' });
      fire('ssx:job', { type: 'complete', job: 'vigilante', note: 'Saltblood Kel (arson in the Flats) taken down.' });
      fire('ssx:job', { type: 'complete', job: 'paramedic', note: 'Junkie made it to Flats Free Clinic.' });
      fire('ssx:turf', { type: 'captured', block: 'hab-stacks', gang: 'dustjaws' });
      fire('ssx:beltway', { type: 'shakedown', checkpoint: 'cs', faction: 'ColSec' });
      return { saints: r.get('saints'), junkies: r.get('junkies'), saltblood: r.get('saltblood'), colsec: r.get('colsec'), dustjaws: r.get('dustjaws') }; });
    ok('events', R.events, R.events.saints === -2 && R.events.junkies === 2 && R.events.saltblood === -8 + 2 && R.events.colsec === -2 && R.events.dustjaws === -12);
    // contraband sell on Saltblood corner (Flats): Neutral -> they don't like it
    R.sell = await G(() => { const C = window.SSX.contraband, r = window.SSX.rep, b = r.get('saltblood'); C.add('glowdust', 2); const s = C.sell('glowdust', 1, 'red-tape-flats'); return [s.ok, b, r.get('saltblood')]; });
    ok('sellOnTurf', R.sell, R.sell[0] && R.sell[2] < R.sell[1]);
    // tier change + toast
    R.tier = await G(() => { window.SSX.rep.debug.set('saltblood', -70); return [window.SSX.rep.tier('saltblood').name, window.__tiers.slice(-1)[0], window.__toasts.slice(-1)[0]]; });
    ok('tierToast', R.tier, R.tier[0] === 'Marked' && R.tier[1] === 'saltblood:marked' && /Marked/.test(R.tier[2] || ''));
    R.price = await G(() => { const r = window.SSX.rep; return [r.priceMultiplier('saltblood'), r.priceMultiplier('red-tape-flats', { x: -280, z: -40 }), r.priceMultiplier('olympus-row', { x: 0, z: -430 })].join(); });
    ok('price', R.price, R.price === '0.7,0.7,1');
    // Marked on their turf -> hostile squad (game.hostiles)
    R.hostile = await G(() => { const g = window.__app.game, a = g.humanCount(); const n = window.SSX.rep.debug.hostile('saltblood'); return [n, a, g.humanCount()]; });
    ok('hostileSquad', R.hostile, R.hostile[0] > 0 && R.hostile[2] > R.hostile[1]);
    ok('raidFallback', await G(() => window.SSX.rep.debug.raid('saltblood').ok === false));
    // barter gates: contraband reads SSX.rep.get(faction)
    R.gate = await G(() => { const C = window.SSX.contraband, r = window.SSX.rep, w = () => C.offer('ozzie-iron-t2-viper')?.why || ''; r.debug.set('ozzie', 0); const a = w(); r.debug.set('ozzie', 20); const b = w(); return [a, b]; });
    ok('barterGate', R.gate, /15 rep with ozzie/i.test(R.gate[0]) && !/rep with ozzie/i.test(R.gate[1]));
    // backup at Trusted: Saltblood via SSX.danger.spawnBackup; a crew danger.js can't spawn fails soft
    R.backup = await G(() => { const r = window.SSX.rep; r.debug.set('saltblood', 45); r.debug.set('dustjaws', 45); const b = r.backup('dustjaws'), a = r.backup('saltblood'), c = r.backup('saints'); return [a.ok, window.SSX.danger?.backup?.faction || null, b.ok, b.msg, c.ok, c.msg]; });
    ok('backup', R.backup, ((R.backup[0] && R.backup[1] === 'saltblood') || (R.backup[2] && R.backup[1] === 'dustjaws')) && R.backup[4] === false); // v7.5.4: Dustjaw backup ships (first call wins the one crew on the way) // dustjaws: ok on PR #19's BACKUP, soft-fail on main
    // panel: open via key/menu (no #ssxDock on main -> no dock button), contrast, 44px
    R.docks = await G(() => document.querySelectorAll('#ssxDock').length); ok('noSecondDock', R.docks <= 1);
    if (!R.docks) ok('noDockNoButton', await G(() => !document.getElementById('dockRep')));
    if (desk) await page.keyboard.press('Backquote'); else if (R.docks) await tapSel('#dockRep'); else { await tapSel('#menuBtn'); await sleep(400); await tapSel('#rmRep'); }
    ok('panelOpen', await wait(() => document.getElementById('repPanel').classList.contains('show'), 4000));
    const tg = await G(() => [...document.querySelectorAll('#repPanel button')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return [r.height, s.backgroundColor, s.color]; }));
    ok('targets44', Math.min(...tg.map(t => t[0])), tg.every(t => t[0] >= 44)); ok('contrast', tg.every(t => t[1] === 'rgb(0, 0, 0)' && t[2] === 'rgb(255, 255, 255)'));
    ok('bars', await G(() => document.querySelectorAll('#repPanel .bar').length >= 5));
    ok('fits', await G(() => { const r = document.querySelector('#repPanel .wrap').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0; }));
    await page.screenshot({ path: `${out}rep-${tag}.png` }); R.shot = `${out}rep-${tag}.png`;
    await tapSel('#repClose'); ok('panelClosed', !(await shown()));
    // persistence
    await G(() => window.SSX.rep.debug.set('saints', -33));
    await page.reload(); await wait(() => !!window.SSX?.rep, 60000);
    R.saltFlags = await G(() => (window.__app.game.progress.flags || []).filter(f => /^vesna-|saltblood/.test(f)));
    ok('persist', await G(() => window.SSX.rep.get('saints')), (await G(() => window.SSX.rep.get('saints'))) === -33);
  } catch (e) { R.exception = String(e); bad.push('exception'); }
  R.errors = errors.filter(e => !/favicon|ERR_FILE|404/.test(e)).slice(0, 8); if (R.errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
