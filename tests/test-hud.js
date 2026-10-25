// Run from a folder with playwright installed: BASE=http://localhost:8765/ node test-hud.js
// HUD layout check: on iPhone SE / 14 / 14 Pro Max, portrait + landscape, WebKit + Chromium (touch):
// no two visible HUD widgets overlap, and the middle 50% of the screen (x and y 25-75%) is clear in normal play.
// TAG=before against old builds only screenshots + reports (no asserts).
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/';
const TAG = process.env.TAG || 'after';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
const strip = d => { const { defaultBrowserType, ...o } = d; return o; };
const DEV = { se: 'iPhone SE (3rd gen)', i14: 'iPhone 14', promax: 'iPhone 14 Pro Max' };
const browsers = (process.env.BROWSERS || 'webkit,chromium').split(','), devs = (process.env.DEVS || 'se,i14,promax').split(','), oris = (process.env.ORIS || 'portrait,landscape').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
function measure() {
  const hud = document.getElementById('surfHud'); const W = innerWidth, H = innerHeight;
  const EXPAND = new Set(['stackR', 'surfBtns', 'ctxBar']), SKIP = new Set(['crosshair', 'hurt', 'downMsg', 'roverMenu']);
  const vis = e => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < 0.05 || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const items = [];
  const add = (e, clip) => { if (!e || SKIP.has(e.id) || !vis(e)) return; let r = e.getBoundingClientRect(); r = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    if (clip) { r = { l: Math.max(r.l, clip.l), t: Math.max(r.t, clip.t), r: Math.min(r.r, clip.r), b: Math.min(r.b, clip.b) }; if (r.r - r.l < 1 || r.b - r.t < 1) return; }
    items.push({ id: e.id || e.className, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)])) }); };
  for (const e of hud.children) {
    if (EXPAND.has(e.id)) { if (!vis(e)) continue; const pr = e.getBoundingClientRect(), ov = getComputedStyle(e).overflow !== 'visible'; for (const c of e.children) add(c, ov ? { l: pr.left, t: pr.top, r: pr.right, b: pr.bottom } : null); }
    else add(e);
  }
  for (const id of ['joy', 'discPop', 'fact-panel']) if (!hud.contains(document.getElementById(id))) add(document.getElementById(id));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j]; if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(`${a.id}×${b.id}`); }
  const C = { l: W * 0.25, r: W * 0.75, t: H * 0.25, b: H * 0.75 };
  const center = items.filter(a => a.l < C.r && C.l < a.r && a.t < C.b && C.t < a.b).map(a => a.id);
  return { W, H, n: items.length, ids: items.map(a => a.id).join(','), overlaps, center };
}
(async () => {
  for (const bn of browsers) for (const dk of devs) for (const ori of oris) {
    const d = strip(devices[DEV[dk] + (ori === 'landscape' ? ' landscape' : '')]); const vp = d.viewport;
    const name = `${dk}-${ori}-${bn}`;
    const browser = await (bn === 'webkit' ? webkit : chromium).launch({ args: bn === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
    const page = await (await browser.newContext(d)).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    const G = (f, a) => page.evaluate(f, a); const R = { name }; const bad = [];
    const check = async (label, centerToo = true) => { const m = await G(measure); R[label] = m.overlaps.length || (centerToo && m.center.length) ? m : `ok (${m.n} widgets)`;
      if (TAG !== 'before') { if (m.overlaps.length) bad.push(`${label}: overlap ${m.overlaps}`); if (centerToo && m.center.length) bad.push(`${label}: center ${m.center}`); } return m; };
    const shot = s => page.screenshot({ path: `${out}iphone-hud-${TAG}-${name}-${s}.png` });
    try {
      await page.goto(base); await page.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading'), null, { timeout: 120000 });
      await G(() => { try { localStorage.removeItem('ssx.game.v1'); } catch (e) {} window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
      await page.waitForFunction(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, null, { timeout: 60000 });
      await sleep(1500);
      // 1) landing: mission-control radio + whatever cards pop
      await G(() => window.__app.game.debug.clear()); await sleep(400);
      await check('landing'); await shot('landing');
      // 2) busy: quest running, discovery card, toast, aliens close (FIRE), dog + rover close (Pet + Drive)
      await G(() => { const a = window.__app, s = a.surface, i = s.info; a.game.accept('mars-signal'); s.debugPlace(i.roverX + 3, i.roverZ + 2, 0.5); });
      await sleep(600);
      await G(() => { const a = window.__app; a.game.debug.spawn('drone', 22, 0.6, false); a.game.debug.calm(true);
        a.noteCard?.('✨ DISCOVERED', 'Olympus Mons', 'The tallest volcano in the solar system, about 22 km high and as wide as Arizona.', 'Mars · 1/12'); a.toast('🐶 Frankie growls: something is moving out there.', 6000); });
      await sleep(900);
      R.dbg = await G(() => [...document.getElementById('stackR').children].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return `${e.id}.${e.className}:${Math.round(r.top)}-${Math.round(r.bottom)}`; }).join(' ')); const busy = await check('busy'); R.busyShows = busy.ids; await shot('busy');
      // expanded card (user tapped it) is still not allowed to collide with anything
      await G(() => document.getElementById('discPop').classList.add('open')); await sleep(300); await check('cardOpen', false);
      await G(() => window.__app.game.debug.clear());
      // 3) driving
      if (TAG !== 'before') { await G(() => { const s = window.__app.surface; if (!s.info.driving) s.interact(); }); await sleep(800); await check('driving'); await shot('driving'); await G(() => window.__app.surface.interact()); await sleep(400); }
      // 3a) v7.1 melee in reach: the fist/blade button joins FIRE
      if (TAG !== 'before') {
        await G(() => { window.__app.game.setAliens(true); window.__app.game.debug.spawn('crawler', 2.2, 0, true); window.__app.game.debug.calm(true); });
        await page.waitForFunction(() => getComputedStyle(document.getElementById('meleeBtn')).display !== 'none', null, { timeout: 8000 }).catch(() => {});
        R.meleeShown = await page.isVisible('#meleeBtn'); await check('melee'); await shot('melee'); await G(() => window.__app.game.debug.clear());
      }
      // 3b) v7 GTA state: stolen buggy at the colony, 3 wanted stars, radio station toast, security around
      if (TAG !== 'before') {
        await G(() => { const s = window.__app.surface, v = s.world.debug.vehicles().find(v => v.parked && v.kind === 'buggy'); s.debugMove(v.x + 3, v.z + 1, 0); });
        await page.waitForFunction(() => window.__app.surface.info.nearVehicle, null, { timeout: 15000 }); await sleep(400);
        await check('nearVehicle'); await shot('take');
        await G(() => { window.__app.surface.interact(); window.__app.surface.world.setWanted(3, 'Grand theft buggy.'); }); await sleep(1500);
        await G(() => document.getElementById('radioBtn').click()); await sleep(700);
        const m = await check('gta'); R.gtaShows = m.ids; await shot('gta');
        await G(() => { const s = window.__app.surface; s.world.setWanted(0); s.interact(); }); await sleep(400);
      }
      // 4) menu open (overlay) + cinematic
      if (TAG !== 'before') {
        await page.tap('#menuBtn'); await sleep(300); R.menu = await page.isVisible('#roverMenu'); await shot('menu');
        await page.tap('#hideHudBtn'); await sleep(300); const c = await check('cinematic'); R.cinematicWidgets = c.ids; await shot('cinematic');
        await page.tap('#hudShow'); await sleep(300); R.restored = await page.isVisible('#topBar');
        await page.tap('#miniMap'); await sleep(300); R.mapOpensMenu = await page.isVisible('#rmWarp'); await page.tap('#rmClose');
        R.map = await G(() => window.__app.mapInfo());
      }
    } catch (e) { R.fail = e.message.split('\n')[0]; bad.push('exception'); }
    R.errors = errors; if (errors.length && TAG !== 'before') bad.push('console errors');
    R.verdict = bad.length ? 'FAIL ' + bad.join(' | ') : 'PASS'; if (bad.length) fails++;
    console.log(JSON.stringify(R)); await browser.close();
  }
  console.log(TAG === 'before' ? 'done' : fails ? `HUD FAIL in ${fails} configs` : 'HUD ALL PASS');
})();
