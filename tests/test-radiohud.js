// Radio banner (#ssxTicker) declutter: one slim black/white line at the bottom, just above the joystick; never over
// #miniMap, the objective card (#questTrack / #stackR) or the thumb controls; ~3 s on a station change; phones default
// to OFF (☰ 🔊 toggle turns it on), desktop defaults to station changes only, "all" adds news/ads/DJ lines.
// BASE=http://127.0.0.1:8873/ BR=webkit VP=393x852 node tests/test-radiohud.js     (VP=desktop → 1440x900 mouse)
// BEFORE=1 only takes the screenshot (for comparing against an older build).
const pw = require(process.env.PWMOD || 'playwright');
const base = process.env.BASE || 'http://127.0.0.1:8873/', BR = process.env.BR || 'chromium', VP = process.env.VP || '393x852';
const out = process.env.OUT || '/tmp/radiohud-shots/', desk = VP === 'desktop', BEFORE = process.env.BEFORE === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const [vw, vh] = desk ? [1440, 900] : VP.split('x').map(Number);
  const ctxOpts = desk ? { viewport: { width: vw, height: vh } } : { ...pw.devices['iPhone 14 Pro'], viewport: { width: vw, height: vh }, screen: { width: vw, height: vh } };
  if (BR === 'chromium' && !desk) delete ctxOpts.defaultBrowserType;
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/GL_|WebGL|GPU|favicon|Failed to load resource/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); });
  const tag = `${BR}-${desk ? 'desktop-1440x900' : VP}`;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); if (process.env.TRACE) console.error(tag, k, cond ? 'ok' : 'FAIL', JSON.stringify(R[k])); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }, sel);
  const tap = async sel => { const c = await center(sel); if (!c) return null; if (desk) await page.mouse.click(c.x, c.y); else await page.touchscreen.tap(c.x, c.y); return c; };
  const S = () => G(() => window.__app.marsAudio.state);
  const tickerOn = () => G(() => { const e = document.getElementById('ssxTicker'); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; });
  const openPanel = async () => { await G(() => window.__app.toggleMenu(true)); await G(() => document.getElementById('rmSound').scrollIntoView({ block: 'center' })); await sleep(150); await tap('#rmSound'); return wait(() => document.getElementById('sndPanel').classList.contains('show'), 3000); };
  const closePanel = async () => { await tap('#sndClose'); await wait(() => !document.getElementById('sndPanel').classList.contains('show'), 2000); };
  const tune = async id => { await openPanel(); await tap(`#sndStations button[data-id="${id}"]`); await wait(i => window.__app.marsAudio.state.station === i, 4000, id); await closePanel(); };
  // every visible element the banner must never cover
  const overlaps = () => G(() => {
    const t = document.getElementById('ssxTicker').getBoundingClientRect(), o = {};
    const sels = ['#miniMap', '#questTrack', '#stackR', '#topBar', '#joy', '#surfBtns', '#fireBtn', '#meleeBtn', '#radioBtn', '#driveBtn', '#lockChip', '#surfHelp'];
    for (const s of sels) for (const e of document.querySelectorAll(s)) {
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (t.x < r.right && t.right > r.x && t.y < r.bottom && t.bottom > r.y) o[s] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }
    // the right-hand thumb buttons (#surfBtns children) are measured one by one, as the grid box can be wider than its buttons
    for (const e of document.querySelectorAll('#surfBtns > *, #flyBtns > *')) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const r = e.getBoundingClientRect(); if (r.width && t.x < r.right && t.right > r.x && t.y < r.bottom && t.bottom > r.y) o['#' + (e.id || e.className)] = 1; }
    return { rect: [Math.round(t.x), Math.round(t.y), Math.round(t.width), Math.round(t.height)], over: o };
  });
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('loaded', await wait(() => !!window.__app?.marsAudio, 15000));
    if (desk) await page.mouse.click(vw * 0.5, vh * 0.45); else await page.touchscreen.tap(vw * 0.5, vh * 0.45);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    // an active job so the objective card is on screen
    await G(() => { const g = window.__app.surface.game, q = g.questList().find(q => !q.done && !q.active) || g.questList()[0]; if (q) g.accept(q.id); });
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await wait(() => /Drive/.test(document.getElementById('driveBtn').textContent), 8000);
    await G(() => window.__app.surface.interact()); ok('roverIn', await wait(() => window.__app.surface.info.driving, 6000));
    await wait(() => window.__app.marsAudio.state.radioOn, 4000); await sleep(1500);
    if (BEFORE) {
      await tune('olympus'); await wait(() => document.getElementById('ssxTicker').classList.contains('on'), 8000);
      R.before = await overlaps(); await page.screenshot({ path: `${out}radiohud-before-${tag}.png` });
    } else {
      const M = await G(() => window.__app.marsAudio.banner.mode);
      ok('defaultMode', M, desk ? M === 'stations' : M === 'off');
      const toggleLabel = async () => { await openPanel(); const l = await G(() => document.getElementById('sndBanner')?.textContent || null); const h = (await center('#sndBanner'))?.h || 0; return { l, h }; };
      if (!desk) {
        // phones: nothing at all by default, not even a station change or a talk segment
        await tune('rust'); await sleep(600); ok('phoneOffStation', !(await tickerOn()));
        await tune('olympus'); let seen = false; for (let i = 0; i < 25; i++) { if (await tickerOn()) seen = true; await sleep(300); } ok('phoneOffTalk', !seen);
        const t = await toggleLabel(); ok('toggleButton', t.l, !!t.l && t.h >= 44);
        await tap('#sndBanner'); ok('modeStations', await G(() => window.__app.marsAudio.banner.mode), await G(() => window.__app.marsAudio.banner.mode === 'stations'));
        await closePanel();
      }
      // station change: shows ~3 s, then hides
      await page.keyboard.press('n'); ok('stationShows', await wait(() => getComputedStyle(document.getElementById('ssxTicker')).display !== 'none', 1500));
      R.stationText = await G(() => document.getElementById('ssxTicker').textContent);
      const ov = await overlaps(); R.stationRect = ov.rect; ok('noOverlap', JSON.stringify(ov.over), Object.keys(ov.over).length === 0);
      const look = await G(() => { const e = document.getElementById('ssxTicker'), cs = getComputedStyle(e), b = e.querySelector('b'); return { bg: cs.backgroundColor, fg: cs.color, b: b ? getComputedStyle(b).color : cs.color, ws: cs.whiteSpace, h: e.getBoundingClientRect().height, fs: parseFloat(cs.fontSize) }; });
      ok('oneLine', JSON.stringify(look), look.ws === 'nowrap' && look.h <= 26 && look.fs <= 13);
      const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
      const [br, bgG, bb, ba = 1] = rgb(look.bg), [fr, fg, fb] = rgb(look.fg), [kr, kg, kb] = rgb(look.b);
      ok('blackWhite', look.bg + ' / ' + look.fg, br < 20 && bgG < 20 && bb < 20 && ba >= 0.85 && fr > 240 && fg > 240 && fb > 240 && kr > 240 && kg > 240 && kb > 240);
      const r = ov.rect, joy = await G(() => { const e = document.getElementById('joy'); const cs = getComputedStyle(e); return cs.display === 'none' ? null : e.getBoundingClientRect().toJSON(); });
      ok('bottomPlacement', JSON.stringify({ r, joyTop: joy && Math.round(joy.top) }), r[1] > vh * 0.6 && (!joy || (r[1] + r[3] <= joy.top && joy.top - (r[1] + r[3]) <= 24)));
      await sleep(2000); ok('stillOnAt2s', await tickerOn());
      if (!desk || BR === 'webkit') await page.screenshot({ path: `${out}radiohud-after-${tag}.png` });
      ok('hiddenBy4s', await wait(() => getComputedStyle(document.getElementById('ssxTicker')).display === 'none', 2500));
      // "stations" mode: a talk station's news/ads stay hidden
      await tune('olympus'); await wait(() => getComputedStyle(document.getElementById('ssxTicker')).display === 'none', 4000);
      let seen = false; for (let i = 0; i < 25; i++) { if (await tickerOn()) seen = true; await sleep(300); } ok('stationsModeNoTalk', !seen);
      // "all" mode: news/ads also show, still one line at the bottom, still ~3 s
      await openPanel(); while ((await G(() => window.__app.marsAudio.banner.mode)) !== 'all') await tap('#sndBanner'); await closePanel();
      ok('talkShows', await wait(() => /News:|Ad:|Mo:|Dana:|Caller:|OLYMPUS/.test(document.getElementById('ssxTicker').textContent) && getComputedStyle(document.getElementById('ssxTicker')).display !== 'none', 15000));
      R.talkText = await G(() => document.getElementById('ssxTicker').textContent);
      const ov2 = await overlaps(); ok('talkNoOverlap', JSON.stringify(ov2.over), Object.keys(ov2.over).length === 0 && ov2.rect[3] <= 26);
      ok('talkHides', await wait(() => getComputedStyle(document.getElementById('ssxTicker')).display === 'none', 4500));
      // off: nothing, and the setting persists
      await openPanel(); while ((await G(() => window.__app.marsAudio.banner.mode)) !== 'off') await tap('#sndBanner'); await closePanel();
      await page.keyboard.press('n'); await sleep(700); ok('offNoStation', !(await tickerOn()));
      ok('saved', await G(() => window.__app.game.progress.settings.radioBanner), await G(() => window.__app.game.progress.settings.radioBanner === 'off'));
      // API for other radio code (song changes): respects the mode
      await G(() => window.__app.marsAudio.banner.set('stations')); await G(() => window.SSX.audio.banner.show('Now playing: test track', 'song'));
      ok('songApi', await wait(() => /test track/.test(document.getElementById('ssxTicker').textContent) && getComputedStyle(document.getElementById('ssxTicker')).display !== 'none', 1500));
      // on foot: hidden
      await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 6000); await sleep(300);
      ok('hiddenOnFoot', !(await tickerOn()));
    }
  } catch (e) { errors.push('TEST ' + e.message); }
  ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 0, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R)); console.log(bad.length ? 'FAIL ' + tag + ' ' + bad.join(',') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
