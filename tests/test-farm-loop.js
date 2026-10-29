// Mars farming first loop (SSX.farm.guide): a new player follows one plain-word caption + one waypoint through
// buy -> dome -> plant -> grow -> harvest -> sell, all by taps. Checks the caption text per step, that the waypoint moves from the
// homestead to the trading post, dismiss + turn back on, persistence across a reload mid-loop, the guide finishing after the
// first sale, one caption at a time, 44px+ and 0 console errors. Phone runs save a screenshot per step (farm-loop-<n>-<step>-<tag>.png).
// BASE=http://127.0.0.1:8896/ BR=chromium DEV="iPhone 14" OUT=./shots/farm/ node tests/test-farm-loop.js  (one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8896/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/farm/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width, t: r.top, b: r.bottom, l: r.left, r: r.right }; }, sel);
  // tapSel waits (like a person would) until a button held by the sheet's settle window is tappable again
  const tapSel = async sel => { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(150); await wait(s => { const b = document.querySelector(s); return !b || !b.dataset.hold; }, 1500, sel); const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
  const fr = async (n = 4, ms = 60000) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, ms, f0 + n); };
  const St = () => G(() => window.SSX.farm.status());
  const cr = () => G(() => window.__app.game.progress.credits);
  const shown = () => G(() => document.getElementById('farmPanel').classList.contains('show'));
  const go = async (id, dz) => { await G(([id, dz]) => { const p = window.SSX.farm.places().find(q => q.id === id); window.__app.surface.debugMove(p.x, p.z + dz, 0); }, [id, dz]); await fr(4); };
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
  };
  const GS = () => G(() => window.SSX.farm.guide.status());
  let shotN = 0; const shot = async name => { if (desk) return; await fr(3); await page.screenshot({ path: out + `farm-loop-${++shotN}-${name}-${tag}.png` }); R.shots = (R.shots || []).concat(`farm-loop-${shotN}-${name}-${tag}.png`); };
  const one = () => G(() => [...document.querySelectorAll('#farmGuide')].filter(e => e.classList.contains('on')).length);
  const face = async (id, back) => { await G(([id, back]) => { const p = window.SSX.farm.places().find(q => q.id === id); const x = p.x + back[0], z = p.z + back[1]; window.__app.surface.debugMove(x, z, Math.atan2(-(p.x - x), -(p.z - z))); }, [id, back]); await fr(5); };
  const step = async (want, re) => { await fr(3); const g = await GS(); ok('step:' + want, { step: g.step, caption: g.caption, shown: g.shown, wp: g.waypoint }, g.step === want && g.shown && re.test(g.caption) && (await one()) === 1); return g; };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.farm?.guide, 20000);
    await land();
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 5000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.reset();
      window.__gev = []; window.SSX.farm.on(e => { if (e.type === 'guide') window.__gev.push(e.step + ':' + e.why); }); });
    await fr(4);
    ok('quietUntilAsked', await GS(), !(await GS()).on && !(await GS()).shown);
    // ☰ → Farm starts the guide (same path as the menu item's onTap)
    await face('farm', [140, 160]);
    await G(() => window.SSX.farm.open()); await tapSel('#farmPanel button[data-a="close"]');
    let g = await step('buy', /^🏚️ Buy the Dustbowl Homestead.*\d+ m (north|south|east|west|north-east|north-west|south-east|south-west)\. Follow the yellow beacon\.$/);
    const fp = await G(() => window.SSX.farm.places().find(q => q.id === 'farm'));
    ok('waypointFarm', g.waypoint, g.waypoint && (g.waypoint.via === 'api' || (g.waypoint.beacon && Math.abs(g.waypoint.beacon.x - Math.round(fp.x)) <= 1 && Math.abs(g.waypoint.beacon.z - Math.round(fp.z)) <= 1)));
    ok('beaconVisible', await G(() => !!window.__app.surface.scene.getObjectByName('farm-beacon')?.visible || window.SSX.farm.guide.status().waypoint?.via === 'api'));
    const xb = await center('#farmGuideX'); ok('dismissSize', xb, xb && xb.h >= 44 && xb.w >= 44);
    await shot('start');
    // dismiss, then turn it back on from the sheet
    await tapSel('#farmGuideX'); g = await GS(); ok('dismiss', g, g.off && !g.shown && !g.waypoint);
    await G(() => window.SSX.farm.open()); await tapSel('#farmPanel button[data-a="guide"]'); await tapSel('#farmPanel button[data-a="close"]');
    g = await GS(); ok('reenable', g, !g.off && g.shown && g.step === 'buy');
    // walk up: caption says what to tap
    await face('farm', [0, 12]);
    await step('buy', /Buy the Dustbowl Homestead.*Tap 🌱 Farm\.$/);
    await shot('buy');
    await tapSel('#farmAct'); await tapSel('#farmPanel button[data-a="buy"]'); await tapSel('#farmPanel button[data-a="close"]');
    await step('dome', /^🫧 Build a dome/); await shot('dome');
    await tapSel('#farmAct'); await tapSel('#farmPanel button[data-a="dome"]'); await tapSel('#farmPanel button[data-a="close"]');
    await step('plant', /^🥔 Add a hydro rack, then plant potatoes/); await shot('plant');
    await tapSel('#farmAct'); await tapSel('#farmPanel button[data-a="rack"]'); await tapSel('#farmPanel button[data-a="plant"][data-i="0"]'); await tapSel('#farmPanel button[data-a="plantc"][data-c="potato"]'); await tapSel('#farmPanel button[data-a="close"]');
    await step('grow', /^🌱 Wait for your potatoes to grow \(0%\).*Keep the water and power topped up\.$/);
    await G(() => window.SSX.farm.skip(5)); await step('grow', /grow \(50%\)/); await shot('grow');
    await G(() => window.SSX.farm.skip(5));
    await step('harvest', /^🧺 Harvest your potatoes/); await shot('harvest');
    await tapSel('#farmAct'); await tapSel('#farmPanel button[data-a="harvestAll"]'); await tapSel('#farmPanel button[data-a="close"]');
    g = await step('sell', /^👽 Sell to the aliens at Xen-7 Trading Post.*Xen-7 Trading Post: \d+ m (north|south|east|west|north-east|north-west|south-east|south-west)\. Follow the yellow beacon\.$/);
    const pp = await G(() => window.SSX.farm.places().find(q => q.id === 'post'));
    ok('waypointPost', g.waypoint, g.waypoint && (g.waypoint.via === 'api' || (g.waypoint.beacon && Math.abs(g.waypoint.beacon.x - Math.round(pp.x)) <= 1 && Math.abs(g.waypoint.beacon.z - Math.round(pp.z)) <= 1)));
    await face('post', [45, 8]); await shot('sell-waypoint');
    // persistence: reload mid-loop, land again, same step
    await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.farm?.guide, 120000); await land();
    await G(() => { window.__gev = []; window.SSX.farm.on(e => { if (e.type === 'guide') window.__gev.push(e.step + ':' + e.why); }); });
    await face('post', [0, 4]);
    g = await step('sell', /Sell to the aliens.*Tap 👽 Trade\.$/); ok('persist', { step: g.step, on: g.on }, g.on && g.step === 'sell');
    await shot('at-post');
    await tapSel('#farmAct'); const m0 = await cr(); await tapSel('#farmPanel button[data-a="sell"][data-b="vell"][data-c="potato"]'); const m1 = await cr();
    await tapSel('#farmPanel button[data-a="close"]'); await fr(4);
    g = await GS(); ok('done', { g, paid: m1 - m0, ev: await G(() => window.__gev) }, g.done && !g.shown && !g.waypoint && g.step === null && m1 > m0 && await G(() => window.__gev.includes('done:sale')));
    ok('beaconGone', await G(() => !window.__app.surface.scene.getObjectByName('farm-beacon')?.visible));
    await shot('done');
    await go('farm', 9); await fr(6); // back in the owned lot: one context button, no base 🏗️ Build (build:false)
    R.oneBtn = await G(() => { const vis = el => { if (!el) return false; const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && r.height > 0; };
      return { ctx: ['farmAct', 'baseBtn', 'empBtn'].map(id => document.getElementById(id)).filter(vis).map(b => b.id), build: [...document.querySelectorAll('button')].filter(b => vis(b) && /🏗️/.test(b.textContent)).length }; });
    ok('oneContextButton', R.oneBtn, R.oneBtn.ctx.length === 1 && R.oneBtn.ctx[0] === 'farmAct' && R.oneBtn.build === 0);
    R.hooks = await G(() => window.SSX.farm.status().hooks); // which of Ben's hooks were live (api / queued / none)
    // stays done after another reload
    await page.reload(); await wait(() => window.__frames > 3 && !!window.SSX?.farm?.guide, 120000);
    g = await GS(); ok('staysDone', g, g.done && !g.shown);
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
