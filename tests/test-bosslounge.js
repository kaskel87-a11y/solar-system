// v7.5.95 boss lounge: chair only after you own the Velvet, hired crew pitch a job, arrow + plain step,
// floor fight pays with fists and no stars, bank job starts the Trust heist, troublemaker pays 80 cr.
// Also the crime-break quote and the toast ✕ vs #cbGulch × on a short phone.
// BASE=http://127.0.0.1:8765/ BR=webkit DEV="iPhone 14" OUT=/tmp/bl/ node tests/test-bosslounge.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const desk = DEV === 'desktop';
const out = (process.env.OUT || process.env.SHOTS_DIR || '/tmp/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const m = /^(\d+)x(\d+)$/.exec(DEV);
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const dev = desk ? { viewport: { width: 1280, height: 800 } }
    : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 2, hasTouch: true }
    : (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone 14']);
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => { window.__ssxNoKeepAlive = true; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !/audio device|Failed to load resource|WebGL/i.test(msg.text())) errors.push('C ' + msg.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 25000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width < 2) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(400); return b; };
  const at = async (x, z, yaw = 0) => { await G(([x, z, y]) => window.__app.surface.debugInside(x, z, y), [x, z, yaw]); await sleep(250); return G(() => { const s = window.__app.surface.world.nearSpot(); return s ? { id: s.id, label: s.label } : null; }); };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    await G(() => localStorage.clear());
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content), (await G(() => document.querySelector('meta[name="app-version"]').content)) === 'v7.5.95');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(600);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.());
    ok('api', await wait(() => !!window.SSX?.bosslounge?.sit && !!window.SSX?.velvetArc?.owned && !!window.SSX?.crew?.hire, 20000));
    await G(() => { const g = window.__app.game; g.progress.credits = 5000; g.progress.xp = 12000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.velvetArc.debug.reset(); window.SSX.crew.debug.reset(); window.SSX.bosslounge.debug.reset(); window.SSX.crimebreak?.debug?.reset?.(); });

    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(200);
    await G(() => window.__app.surface.enterBuilding());
    ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));
    const before = await at(20.2, -3.55, 0);
    ok('noChairBefore', before && before.id, !before || before.id !== 'velvet-boss');

    await G(() => window.SSX.velvetArc.debug.own('signed')); await sleep(400);
    ok('owned', await G(() => window.SSX.velvetArc.owned()));
    ok('logMentions', await G(() => /boss chair/.test(window.SSX.velvetArc.logHtml())));
    const seat = await at(20.2, -3.55, -1.2);
    ok('chairSpot', seat && seat.id, seat?.id === 'velvet-boss');
    ok('chairLabel', seat && seat.label, /Sit|boss chair|Chair/.test(seat?.label || ''));

    ok('hired', await G(() => window.SSX.crew.hire().ok && window.SSX.crew.state().crew[0].id === 'dex'));
    const offer = await G(() => window.SSX.bosslounge.debug.preview('bank'));
    ok('preview', offer && offer.job, offer?.job === 'bank' && offer.who === 'dex' && offer.name === 'Dex');
    await G(() => window.__app.surface.debugInside(18.9, -1.7, Math.atan2(-1.8, 1.6), 0.15));
    await sleep(1200);
    const sheet = await G(() => {
      const el = document.getElementById('blSheet'), q = el?.querySelector('q'), btn = el?.querySelector('button');
      const r = btn?.getBoundingClientRect();
      const cs = btn ? getComputedStyle(btn) : null;
      return { on: el?.classList.contains('on'), q: q?.textContent || '', html: q?.innerHTML || '', h: Math.round(r?.height || 0), bg: cs?.backgroundColor || '', fg: cs?.color || '', who: el?.querySelector('.who')?.textContent || '' };
    });
    ok('sheet', sheet.on, sheet.on && /Dex/.test(sheet.who));
    ok('quoteOnce', sheet.q, sheet.q.length > 15 && !/[“”]/.test(sheet.q) && !sheet.html.includes('“'));
    ok('btn48', sheet.h, sheet.h >= 48 && /0, 0, 0/.test(sheet.bg) && /255, 255, 255/.test(sheet.fg));
    await G(() => { const st = document.createElement('style'); st.textContent = '#toast,#radio,#obLine,#ssxGuide,.ssxBark{display:none!important}'; document.head.appendChild(st); });
    await sleep(400);
    await page.screenshot({ path: out + `boss-lounge-${tag}.png` });

    await sleep(400);
    await tapSel('#blSheet button[data-a="take"]');
    ok('took', await wait(() => window.SSX.bosslounge.state().job?.id === 'bank', 4000));
    ok('leaveStep', await G(() => /Leave the Velvet/.test(window.SSX.bosslounge.step())));
    ok('arrow', await wait(() => { const e = document.getElementById('ssxGuide'); return !!(e && e.classList.contains('on') && /Leave|door|Velvet/i.test(e.textContent)); }, 4000));
    const guideBox = await G(() => { const e = document.getElementById('ssxGuide'); const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; return { mid: cx > innerWidth * 0.25 && cx < innerWidth * 0.75 && cy > innerHeight * 0.25 && cy < innerHeight * 0.75, t: e.textContent }; });
    ok('arrowEdge', guideBox, guideBox && guideBox.mid === false);

    await G(() => window.__app.surface.leaveBuilding()); await sleep(500);
    ok('heistStarts', await wait(() => window.SSX.heist?.active?.id === 'boss-lounge-bank', 6000));
    ok('bankStep', await G(() => /Break in|Trust|vault|stars/.test(window.SSX.bosslounge.step() + (document.getElementById('heistChip')?.textContent || ''))));
    await G(() => { try { window.SSX.heist.abortHeist('test'); } catch (e) { /* */ } window.SSX.bosslounge.debug.reset(); window.__app.surface.world.setWanted(0); });
    await sleep(300);
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(200);
    await G(() => window.__app.surface.enterBuilding());
    ok('backIn', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000));

    const cr0 = await G(() => window.__app.game.progress.credits);
    ok('floorJob', await G(() => window.SSX.bosslounge.debug.offer('floor', 'rowdy')?.id === 'floor'));
    await at(-24, 4.0, 0); await sleep(300);
    ok('fistBtn', await wait(() => document.body.classList.contains('lounge-fists') && document.getElementById('meleeBtn')?.textContent === '👊', 4000));
    const fist = await G(() => { const b = document.getElementById('meleeBtn'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { h: Math.round(r.height), w: Math.round(r.width), show: cs.display !== 'none' }; });
    ok('fistSize', fist, fist.show && fist.h >= 48 && fist.w >= 48);
    for (let i = 0; i < 8 && await G(() => !!window.SSX.bosslounge.state().job); i++) { await G(() => window.__app.game.melee()); await sleep(1300); }
    ok('floorPay', await wait(c => !window.SSX.bosslounge.state().job && window.__app.game.progress.credits === c + 450, 6000, cr0));
    ok('floorNoStars', await G(() => (window.__app.surface.world.wanted | 0) === 0));

    const cr1 = await G(() => window.__app.game.progress.credits);
    ok('trouble', await G(() => window.SSX.bosslounge.debug.spawn('cole')));
    await at(-23.2, 2.2, 0); await sleep(250);
    for (let i = 0; i < 8 && await G(() => window.SSX.bosslounge.state().fighter); i++) { await G(() => window.__app.game.melee()); await sleep(1300); }
    ok('tossPay', await wait(c => window.__app.game.progress.credits === c + 80 && window.SSX.bosslounge.state().tossed === 1, 6000, cr1));

    // crime-break quote + toast ✕ must not cover the sheet ×
    await G(() => window.__app.surface.leaveBuilding()); await sleep(400);
    await G(() => { const z = window.SSX.copFree.zone(); window.__app.surface.debugMove(z.x + 2, z.z + 2, 0); window.__app.toast('Till is short tonight, boss.', 9000); window.SSX.crimebreak.open(true); });
    await sleep(500);
    await G(() => window.SSX.crimebreak.start()); await sleep(400);
    const quote = await G(() => { const q = document.querySelector('#cbGulch q'); return q ? { t: q.textContent, html: q.innerHTML } : null; });
    ok('cbQuote', quote && quote.t, !!quote && quote.t.length > 8 && !/[“”]/.test(quote.t) && !quote.html.includes('“'));
    const hit = await G(() => {
      const x = document.querySelector('#cbGulch .x'), toastX = document.querySelector('#toast .ssx-x');
      const r = x.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const cs = toastX ? getComputedStyle(toastX) : null;
      return { top: top && (top === x || x.contains(top)), pe: cs?.pointerEvents || '', z: cs?.zIndex || '', sheet: getComputedStyle(document.getElementById('cbGulch')).zIndex };
    });
    ok('toastUnderSheet', hit, hit.top === true && (hit.pe === 'none' || hit.z === '0') && +hit.sheet >= 70);

    ok('console', errors, errors.length === 0);
  } catch (e) { bad.push('throw'); R.throw = String(e && e.stack || e).slice(0, 500); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
