// Mars day/night cycle (mars/time.js, window.SSX.time): API, phase events, the look at noon vs night (light, sky, stars,
// neon halos + spill), indoors untouched, danger-director hour sync, thinner security at night, phone NPC cap, HUD overlap,
// fps night vs day, and the clock surviving a reload. One browser at a time.
// SHOTS_DIR=$PWD/.shots/time BASE=http://127.0.0.1:8799/ BR=webkit DEV="iPhone 14" node tests/test-time.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8799/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'time')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;

function measureHud() {
  const hud = document.getElementById('surfHud'); const W = innerWidth, H = innerHeight;
  const SKIP = new Set(['crosshair', 'hurt', 'downMsg', 'roverMenu', 'actPanel', 'racePanel', 'pokerPanel', 'r2rPanel', 'dirPanel']);
  const EXPAND = new Set(['stackR', 'surfBtns', 'ctxBar']);
  const vis = e => { if (!e) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05 || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const items = [];
  const add = e => { if (!e || SKIP.has(e.id) || !vis(e)) return; if (items.some(i => i.el === e)) return; const r = e.getBoundingClientRect(); items.push({ el: e, id: e.id || e.className, l: r.left, t: r.top, r: r.right, b: r.bottom }); };
  if (hud) for (const e of hud.children) { if (EXPAND.has(e.id)) { if (!vis(e)) continue; for (const c of e.children) add(c); } else add(e); }
  for (const id of ['joy', 'dirTag']) add(document.getElementById(id));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(`${a.id}×${b.id}`);
  }
  // meleeBtn×joy on the 375-wide iPhone SE is a core HUD layout overlap that exists without this add-on (checked with
  // mars/time.js blocked); report it, don't fail on it
  const KNOWN = new Set(['meleeBtn×joy', 'joy×meleeBtn']); const known = overlaps.filter(o => KNOWN.has(o));
  return { W, H, known, overlaps: overlaps.filter(o => !KNOWN.has(o)), off: items.filter(i => i.l < -1 || i.t < -1 || i.r > W + 1 || i.b > H + 1).map(i => i.id), n: items.length };
}

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const dev = DEV === 'desktop' ? { viewport: { width: 1280, height: 800 } } : (({ defaultBrowserType, ...d }) => d)(devices[DEV] || devices['iPhone 14']);
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const realErr = [];
  page.on('pageerror', e => realErr.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /\[time\]|\[director\]/.test(m.text()))) realErr.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { try { await page.screenshot({ path: `${out}time-${tag}-${s}.png`, timeout: 8000 }); } catch (e) {} };
  const frames = n => G(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const fps = async (ms = 3000) => G(ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000) * 10) / 10); }; requestAnimationFrame(f); }), ms);
  const TL = () => G(() => { const t = window.__time; return { S: t.S, applied: t.applied, light: t.light, sky: t.sky, stars: t.stars, neon: t.neon, base: t.base, dh: t.dangerHour(), stats: t.stats, filters: t.filters() }; });
  const land = async () => {
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 60000); await sleep(1200);
  };

  try {
    await page.goto(base + '?t=' + Date.now());
    await wait(() => window.__frames > 3, 120000);
    await G(() => { try { localStorage.removeItem('ssx.time.v1'); localStorage.removeItem('ssx.director.v1'); } catch (e) {} });
    await land();
    ok('installed', null, await wait(() => !!window.SSX?.time && typeof window.SSX.time.isNight === 'function' && !!window.__time, 15000));
    const api = await G(() => { const T = window.SSX.time; return ['now', 'isNight', 'phase', 'on', 'set', 'setScale', 'freeze', 'crimeMultiplier', 'copsMultiplier', 'addLookFilter'].filter(k => typeof T[k] !== 'function'); });
    ok('api', api, api.length === 0);
    // fresh profile: the clock starts from dangercore.marsHour() so both agree; hour() is now()
    const bt = await G(() => { const b = window.__time.boot; return { ...b, wall: (b.at / 120000) % 24, hour: window.SSX.time.hour(), now: window.SSX.time.now() }; }); R.boot = bt;
    const hd = Math.abs(bt.h - bt.wall), dh = Math.min(hd, 24 - hd);
    ok('bootFromDanger', null, bt.from === 'danger' && dh < 0.02 && Math.abs(bt.hour - bt.now) < 0.01 && bt.hour >= 0 && bt.hour < 24);
    ok('menuButton', null, await G(() => /Mars \d\d:\d\d/.test(document.getElementById('timeMenuBtn')?.textContent || '')));

    // events
    await G(() => { const T = window.SSX.time, L = window.__tl = { change: [], night: 0, day: 0, win: [], bus: [] };
      T.on('change', d => L.change.push(d.phase)); T.on('night', () => L.night++); T.on('day', () => L.day++);
      window.addEventListener('time:phase', e => L.win.push(e.detail.phase)); window.SSX.on?.('time:phase', d => L.bus.push(d.phase)); });

    // stand on the strip, facing the club / cantina fronts
    R.spot = await G(() => { const s = window.__app.surface, ds = s.world.doorList(), d = ds.find(x => x.kind === 'club') || ds.find(x => x.kind === 'cantina') || ds[0]; if (!d) return null; s.debugPlace(d.x, d.z + 9, 0); return d; });
    await frames(10); await sleep(800);
    // noon baseline
    await G(() => { window.SSX.time.set('noon'); window.SSX.time.freeze(true); }); await frames(10); await sleep(500);
    const day = await TL(); R.day = { light: day.light, sky: day.sky, stars: day.stars, neon: day.neon };
    ok('dayLook', null, day.applied && !(day.stars?.visible) && day.neon.halos === 0 && !day.neon.spillOn && Math.abs(day.light.i - day.base.light) < 0.05 * day.base.light && !(await G(() => window.SSX.time.isNight())) && (await G(() => window.SSX.time.phase())) === 'day');
    const hudD = await G(measureHud); R.knownCoreOverlap = hudD.known; if (hudD.overlaps.length || hudD.off.length) bad.push('hudDay:' + hudD.overlaps.concat(hudD.off).join(','));
    await shot('noon'); R.fpsDay = await fps();
    const budgetDay = await G(() => window.__app.surface.world.npcBudget?.());

    // night
    await G(() => window.SSX.time.set('night')); await frames(10); await sleep(2800); // neon scan runs every 2.5 s
    const night = await TL(); R.night = { light: night.light, sky: night.sky, stars: night.stars, neon: night.neon, dh: night.dh };
    const lum = c => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    ok('nightApi', null, await G(() => window.SSX.time.isNight() && window.SSX.time.phase() === 'night' && Math.abs(window.SSX.time.now() - 23) < 0.05));
    ok('nightLook', null, night.light.i < day.light.i * 0.25 && night.light.hemi < day.light.hemi * 0.5 && lum(night.sky.top) < lum(day.sky.top) * 0.25 && night.stars?.visible && night.stars.opacity > 0.9 && night.stars.n <= (touch ? 420 : 1200));
    ok('neon', night.neon, night.neon.level > 0.95 && night.neon.signs > 0 && night.neon.halos > 0 && night.neon.halos === night.neon.near && night.neon.spillOn && (day.neon.sample == null || night.neon.sample >= day.neon.sample));
    const ev = await G(() => window.__tl); R.events = ev;
    ok('events', null, ev.night >= 1 && ev.change.includes('night') && ev.win.includes('night') && (ev.bus.length === 0 || ev.bus.includes('night')));
    ok('dangerHourSync', night.dh, Math.abs(night.dh - 23) < 0.1);
    const mult = await G(() => ({ crime: window.SSX.time.crimeMultiplier(), cops: window.SSX.time.copsMultiplier(), crimeNoon: window.SSX.time.crimeMultiplier(12) }));
    ok('multipliers', mult, mult.crime >= 1.8 && mult.cops <= 0.55 && mult.crimeNoon === 1);
    const sec = await G(() => { const f = window.SSX.city?.securityResponse; if (!f) return { none: true }; const t0 = window.__time.stats.thinned; try { f(window.__app.surface.info.x + 40, window.__app.surface.info.z + 40, 3, { reason: 'test' }); } catch (e) { return { err: e.message }; } const t1 = window.__time.stats.thinned; try { window.__app.surface.world.setWanted(0, 'test'); } catch (e) {} return { wrapped: !!f.__time, t0, t1 }; });
    ok('fewerCops', sec, sec.none || (sec.wrapped && sec.t1 === sec.t0 + 1));
    await sleep(600);
    const budget = await G(() => window.__app.surface.world.npcBudget?.()); R.budget = { day: budgetDay, night: budget };
    ok('npcCap', null, !budget || (budget.used <= budget.cap && (!touch || budget.cap <= 12)));
    const hudN = await G(measureHud); if (hudN.overlaps.length || hudN.off.length) bad.push('hudNight:' + hudN.overlaps.concat(hudN.off).join(','));
    await shot('night'); R.fpsNight = await fps();
    ok('fpsNightVsDay', { day: R.fpsDay, night: R.fpsNight }, R.fpsNight >= R.fpsDay * 0.75 || R.fpsNight >= 50);

    // indoors: the room is left alone, the outdoor look comes back on the way out
    const door = await G(() => { const w = window.__app.surface.world, d = w.doorFor('cantina') || w.doorFor('guns'); return d ? { kind: d.kind } : null; });
    if (door) {
      await G(k => window.__app.surface.enterBuilding(window.__app.surface.world.doorFor(k)), door.kind);
      const inn = await wait(() => !!window.__app.surface.world.inside, 6000); await frames(6); await sleep(300);
      const ins = await TL(); R.inside = { applied: ins.applied, light: ins.light, stars: ins.stars, neon: ins.neon.level };
      ok('indoorsUntouched', null, inn && !ins.applied && Math.abs(ins.light.i - ins.base.light) < 1e-6 && !(ins.stars?.visible));
      await shot('indoors');
      await G(() => window.__app.surface.leaveBuilding()); await wait(() => !window.__app.surface.world.inside, 6000); await frames(6); await sleep(300);
      const outN = await TL(); ok('outdoorsAgain', null, outN.applied && outN.light.i < day.light.i * 0.25 && outN.stars?.visible);
    } else R.inside = 'no door';

    // dusk sits between, dawn fires 'day'
    await G(() => window.SSX.time.set('dusk')); await frames(6);
    const dusk = await TL(); ok('duskBetween', dusk.light.i, dusk.light.i < day.light.i && dusk.light.i > night.light.i);
    await G(() => window.SSX.time.set('dawn')); await frames(4);
    ok('dayEvent', null, await G(() => window.__tl.day >= 1 && window.__tl.change.includes('dawn') && !window.SSX.time.isNight()));

    // the clock runs: 60x = one game hour per real second
    await G(() => { window.SSX.time.set(10); window.SSX.time.setScale(60); window.SSX.time.freeze(false); });
    const c0 = await G(() => [window.SSX.time.now(), performance.now()]); await sleep(2000); const c1 = await G(() => [window.SSX.time.now(), performance.now()]);
    R.clockRate = Math.round((c1[0] - c0[0]) / ((c1[1] - c0[1]) / 1000) * 100) / 100; ok('clockRuns', R.clockRate, Math.abs(R.clockRate - 1) < 0.15);
    await G(() => window.SSX.time.setScale(1));

    // Director (if loaded) drives the same clock and only adds a storm look filter
    const dir = await G(() => window.SSX.director ? { hasTime: !!window.SSX.director.state.time, filters: window.__time.filters() } : null); R.director = dir;
    ok('directorShared', dir, !dir || (dir.hasTime && dir.filters >= 1));

    // saved: set 21:30 frozen, reload, still 21:30
    await G(() => { window.SSX.time.set(21.5); window.SSX.time.freeze(true); }); await sleep(300);
    const saved = await G(() => JSON.parse(localStorage.getItem('ssx.time.v1') || 'null')); R.saved = saved;
    await page.goto(base + '?t=' + Date.now()); await land();
    await wait(() => !!window.SSX?.time, 15000);
    const after = await G(() => ({ h: window.SSX.time.now(), frozen: window.SSX.time.frozen, night: window.SSX.time.isNight() })); R.afterReload = after;
    ok('persisted', null, saved && Math.abs(saved.h - 21.5) < 0.05 && Math.abs(after.h - 21.5) < 0.05 && after.frozen && after.night);
    await G(() => { localStorage.removeItem('ssx.time.v1'); });
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 280)); R.fail = e.message.split('\n')[0]; }

  const serious = realErr.filter(e => /\[time\]|director|SyntaxError|TypeError|ReferenceError|PE /i.test(e));
  R.errors = serious.slice(0, 6); if (serious.length) bad.push('errors');
  R.bad = bad; R.verdict = bad.length ? 'FAIL ' + bad.join(' | ') : 'PASS';
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})();
