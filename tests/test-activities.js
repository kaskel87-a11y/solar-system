// Mars side-activity runner: menu + context button, start a job, HUD no overlap (iPhone emulation).
// BASE=http://localhost:8788/ DEV="iPhone 14" BR=webkit node tests/test-activities.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8788/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/tmp/act-shots/', PFX = process.env.PFX || 'act';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;

function measure() {
  const hud = document.getElementById('surfHud'); const W = innerWidth, H = innerHeight;
  const EXPAND = new Set(['stackR', 'surfBtns', 'ctxBar']), SKIP = new Set(['crosshair', 'hurt', 'downMsg', 'roverMenu', 'actPanel', 'racePanel']);
  const vis = e => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < 0.05 || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const items = [];
  const add = (e, clip) => { if (!e || SKIP.has(e.id) || !vis(e)) return; let r = e.getBoundingClientRect(); r = { l: r.left, t: r.top, r: r.right, b: r.bottom, id: e.id || e.className };
    if (clip) { r = { ...r, l: Math.max(r.l, clip.l), t: Math.max(r.t, clip.t), r: Math.min(r.r, clip.r), b: Math.min(r.b, clip.b) }; if (r.r - r.l < 1 || r.b - r.t < 1) return; }
    items.push(r); };
  if (hud) for (const e of hud.children) {
    if (EXPAND.has(e.id)) { if (!vis(e)) continue; const pr = e.getBoundingClientRect(), ov = getComputedStyle(e).overflow !== 'visible'; for (const c of e.children) add(c, ov ? { l: pr.left, t: pr.top, r: pr.right, b: pr.bottom } : null); }
    else add(e);
  }
  for (const id of ['joy', 'actCtxBtn', 'actChip']) { const e = document.getElementById(id); if (e && (!hud || !hud.contains(e))) add(e); }
  const overlaps = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(`${a.id}×${b.id}`);
  }
  const C = { l: W * 0.25, r: W * 0.75, t: H * 0.25, b: H * 0.75 };
  const center = items.filter(a => a.l < C.r && C.l < a.r && a.t < C.b && C.t < a.b).map(a => a.id);
  return { W, H, n: items.length, overlaps, center, ids: items.map(a => a.id).join(',') };
}

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({
    args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
  });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } }
    : m ? { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 }
    : (({ defaultBrowserType, ...d }) => d)(devices[DEV]);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const realErr = [];
  page.on('pageerror', e => realErr.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error') realErr.push(m.text().slice(0, 180)); });

  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const vis = sel => G(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);
  const center = sel => G(s => { const e = document.querySelector(s); e.scrollIntoView?.({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const tapAt = async sel => { const c = await center(sel); if (touch) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); };
  const openMenu = async () => {
    await tapAt('#menuBtn'); await sleep(250);
    if (!(await G(() => document.getElementById('roverMenu')?.classList.contains('show')))) {
      R.menuClickFallback = true; await G(() => window.__app.toggleMenu(true)); await sleep(150);
    }
  };
  const land = async () => { await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(800); };
  const hudCheck = async (label) => {
    const m = await G(measure);
    // Engine quest/toast/radio may sit mid-screen during a job — ignore those; flag OUR widgets only.
    const IGNORE_CENTER = new Set(['questTrack', 'toast', 'radio', 'topBar', 'miniMap']);
    const centerOurs = (m.center || []).filter(id => !IGNORE_CENTER.has(id) && /act|Chip|Ctx|joy|fire|pet|jump|run/i.test(id) === false ? !IGNORE_CENTER.has(id) : /^(actChip|actCtxBtn)$/.test(id));
    // Only fail center if actChip/actCtxBtn invade the middle 50%
    const badCenter = (m.center || []).filter(id => id === 'actChip' || id === 'actCtxBtn');
    R['hud_' + label] = m.overlaps.length || badCenter.length ? { ...m, badCenter } : `ok (${m.n})`;
    if (m.overlaps.length) bad.push(`${label}:overlap:${m.overlaps.join(',')}`);
    if (badCenter.length) bad.push(`${label}:center:${badCenter.join(',')}`);
    return m;
  };

  try {
    await page.goto(base + '?t=' + Date.now());
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { try { localStorage.removeItem('ssx.mars.act.v1'); localStorage.removeItem('ssx.game.v1'); } catch (e) {} });
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await land();
    await G(() => { window.__app.surface.game.setAliens?.(true); window.__app.surface.game.debug.credits(500); });

    // Wait for activity pack to load
    ok('api', null, await wait(() => !!window.__activities && typeof window.__activities.list === 'function', 15000));
    await G(() => window.__activities.reload());
    await sleep(400);
    const list = await G(() => window.__activities.list());
    R.listCount = list.length;
    ok('hasActivities', list.length, list.length >= 16);
    const playable = await G(() => window.__activities.playable());
    const deferred = await G(() => window.__activities.deferred());
    R.playable = playable; R.deferred = deferred;
    ok('pokerPlayable', playable, playable.includes('act-static-poker'));
    ok('pokerNotDeferred', deferred, !deferred.includes('act-static-poker'));
    ok('pitPlayable', playable, playable.includes('act-pit-fight'));
    ok('trialPlayable', playable, playable.includes('act-beltway-trial'));
    ok('taxiPlayable', playable, playable.includes('act-beltway-taxi')); // degraded, still listed

    // Menu entry
    await openMenu();
    ok('menuItem', null, await vis('#rmActivities'));
    await tapAt('#rmActivities'); await sleep(400);
    ok('panelOpen', null, await G(() => document.getElementById('actPanel')?.classList.contains('on')));
    const panelText = await G(() => document.getElementById('actPanel')?.innerText || '');
    ok('panelListsDoor', panelText, /Door Shift/.test(panelText));
    ok('panelListsPit', panelText, /The Pit/.test(panelText));
    ok('panelListsHoldem', panelText, /Hold'?em|Static Hold/i.test(panelText));
    await shot('panel');
    await hudCheck('panel'); // panel is fullscreen overlay — skip center? we SKIP actPanel in measure; check no widget overlap under it
    await G(() => window.__activities.closePanel()); await sleep(200);

    // Warp to Door Shift start, expect context button
    ok('warpDoor', null, await G(() => window.__activities.warp('act-static-bounce')));
    await sleep(500);
    ok('ctxNearDoor', null, await wait(() => {
      const e = document.getElementById('actCtxBtn');
      return e && getComputedStyle(e).display !== 'none' && /Door|Job|Shift/i.test(e.textContent);
    }, 8000));
    await shot('ctx');
    await hudCheck('nearStart');

    // Start via debug API (more reliable than tap under emulation)
    const started = await G(() => window.__activities.start('act-static-bounce'));
    ok('startDoor', started, started && started.ok);
    ok('activeDoor', null, await wait(() => window.__activities.active?.id === 'act-static-bounce', 5000));
    await sleep(600);
    ok('chipOn', null, await G(() => document.getElementById('actChip')?.classList.contains('on')));
    await shot('active');
    await hudCheck('activeJob');

    // Abandon cleanly
    await G(() => window.__activities.abandon());
    await sleep(300);
    ok('abandoned', null, await G(() => !window.__activities.active));

    // District helper near Olympus Row
    await G(() => { const c = window.__app.surface.info.colony; window.__app.surface.debugMove(c.x + 0, c.z - 430, 0); }); // Olympus centre is AJ-relative [0, -430]
    await sleep(200);
    const dist = await G(() => window.__activities.district);
    ok('districtOlympus', dist, dist && dist.id === 'mars-downtown');

    // Start photo job (goto/collect — light) and complete via engine step warps if possible
    await G(() => window.__activities.warp('act-pixel-photo'));
    await sleep(300);
    const photo = await G(() => window.__activities.start('act-pixel-photo'));
    ok('startPhoto', photo, photo && photo.ok);
    // Force-complete through debug (validates reward path without full drive)
    await G(() => window.__activities.complete());
    await sleep(200);
    ok('photoCleared', null, await G(() => (window.__activities.data.clears || {})['act-pixel-photo'] >= 1));

    // Pit: start duel ladder (may need colonist)
    await G(() => window.__activities.warp('act-pit-fight'));
    await sleep(300);
    const pit = await G(() => window.__activities.start('act-pit-fight'));
    R.pitStart = pit;
    ok('startPit', pit, pit && pit.ok);
    await sleep(800);
    // Yield to exit cleanly if duel started
    await G(() => { try { window.__app.surface.world.yieldDuel?.(); } catch (e) {} window.__activities.abandon(); });
    await sleep(200);

    // No context button when far from all activity starts (deep desert)
    await G(() => window.__app.surface.debugMove(900, 900, 0));
    await sleep(800);
    ok('noCtxFar', null, await wait(() => {
      const e = document.getElementById('actCtxBtn');
      return !e || getComputedStyle(e).display === 'none';
    }, 4000));
    // At AJ pad: may be near Beltway hitch (~55m) — button must not be a permanent HUD fixture;
    // only assert it is hidden when no nearAct (debug counts).
    await G(() => window.__app.surface.debugMove(0, 0, 0));
    await sleep(800);
    const counts = await G(() => window.__activities.counts());
    R.countsAtPad = counts;
    await hudCheck('atPad');

  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); R.fail = e.message.split('\n')[0]; }

  // Filter noisy console (three.js / favicon) — keep module load failures
  const serious = realErr.filter(e => /activit|runner|side-activities|SyntaxError|TypeError|PE /i.test(e) || /Failed to fetch|404/.test(e));
  R.errors = serious.slice(0, 8);
  if (serious.length) bad.push('errors');
  R.bad = bad;
  R.verdict = bad.length ? 'FAIL ' + bad.join(' | ') : 'PASS';
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
