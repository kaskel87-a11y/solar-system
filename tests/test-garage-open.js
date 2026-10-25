// SSX.garage.open(rideId?): the garage sheet from anywhere (space, or far across Mars), with that ride selected, no navTo.
// BASE=http://localhost:8797/ DEV=393x852 BR=webkit node tests/test-garage-open.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || '/tmp/dealer-shots/', PFX = process.env.PFX || 'garage-open';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 } : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView?.({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800); };

  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.progress.v1', JSON.stringify({ v: 1, xp: 120, credits: 9000, badges: ['first'], quests: {}, equip: {} })); });
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    ok('apiOpen', null, await G(() => typeof window.SSX.garage?.open === 'function'));
    // the sheet's own pointerup tap (touch) or click (desktop) on a sheet button
    const tapSheet = async sel => { const c = await center(sel); if (!c) return false; if (!touch) await page.mouse.click(c.x, c.y);
      else await G(([c, s]) => { const el = document.querySelector(s); const o = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: c.x, clientY: c.y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, [c, sel]);
      await sleep(250); return true; };
    const sheetKind = () => G(() => document.getElementById('dlrSheet')?.dataset.kind || null);
    // 1. in space, before landing anywhere: opens on the active ride
    ok('openInSpace', null, await G(() => window.SSX.garage.open() === true));
    ok('spaceSheet', await sheetKind(), (await sheetKind()) === 'garage');
    ok('spaceSelActive', null, await G(() => window.SSX.garage.selected === window.SSX.garage.active));
    await tapSheet('#dlrSheet [data-close]'); ok('closes', null, (await sheetKind()) === null);
    // 2. on Mars, far from the lock-ups, with a second ride: open(rideId) selects it, no navTo
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land();
    const rid = await G(() => window.SSX.garage.grantVehicle('ares_brute', { noPlates: true, active: false }).ride);
    await G(() => { const s = window.__dealer.spots.garage; window.__app.surface.debugMove(s.x + 300, s.z + 300, 0); });
    const far = await G(() => { const s = window.__dealer.spots.garage, i = window.__app.surface.info; return Math.round(Math.hypot(i.x - s.x, i.z - s.z)); });
    ok('farFromLockup', far, far > 100);
    ok('openRide', null, await G(r => window.SSX.garage.open(r) === true, rid));
    ok('rideSelected', await G(() => window.SSX.garage.selected), (await G(() => window.SSX.garage.selected)) === rid);
    ok('rideNamed', null, await G(() => /Brute/i.test(document.getElementById('dlrSheet').innerText)));
    ok('notActivated', null, await G(r => window.SSX.garage.active !== r, rid));
    const nav = await G(() => { const g = window.__app.surface.game.mapGate?.(), s = window.__dealer.spots.garage; return g && Math.hypot(g.x - s.x, g.z - s.z) < 3 ? 'garage' : null; }); ok('noNav', nav, !nav);
    await sleep(400); await shot('open-far');
    // a sheet button still works there (tab switch), and 'current' / unknown ids fall back to the active ride
    ok('tabWorks', null, (await tapSheet('#dlrSheet [data-tab="wheels"]')) && await G(() => document.querySelector('#dlrSheet [data-tab="wheels"]')?.classList.contains('on') && window.SSX.garage.selected));
    ok('openCurrent', null, await G(() => window.SSX.garage.open('current') && window.SSX.garage.selected === window.SSX.garage.active));
    ok('openUnknown', null, await G(() => window.SSX.garage.open('nope') && window.SSX.garage.selected === window.SSX.garage.active));
    await tapSheet('#dlrSheet [data-close]'); ok('closesMars', null, (await sheetKind()) === null);
  } catch (e) { bad.push('exception'); R.exception = String(e).slice(0, 300); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || null, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
