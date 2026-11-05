// v7.5.36 iOS sound: one shared AudioContext for the whole game, 'running' after the first tap, and every module
// (main sfx, Mars ambience mixer, Pit show, Grin Reaper horn, jetpack, flame, harvest, race, stray `new AudioContext()`)
// lands on that same context. Default: WebKit iPhone 14 Pro emulation.
// BASE=http://127.0.0.1:8812/ BR=webkit node tests/test-audio-unlock.js
const pw = require(process.env.PWMOD || 'playwright');
const base = process.env.BASE || 'http://127.0.0.1:8812/', BR = process.env.BR || 'webkit';
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--autoplay-policy=user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  const opts = { ...pw.devices['iPhone 14 Pro'] }; if (BR !== 'webkit') delete opts.defaultBrowserType;
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // count native constructions underneath the game's guard
  await page.addInitScript(() => {
    const N = window.AudioContext || window.webkitAudioContext; window.__nativeCount = 0;
    const W = function AudioContext(o) { window.__nativeCount++; return new N(o); }; W.prototype = N.prototype;
    window.AudioContext = W; if (window.webkitAudioContext) window.webkitAudioContext = W;
    window.__ssxNoKeepAlive = 1; // headless Linux WebKit's GStreamer can't play the silent <audio> keep-alive (real iOS uses audioSession or it)
    const r0 = N.prototype.resume; window.__resumes = [];
    N.prototype.resume = function () { window.__resumes.push({ gesture: navigator.userActivation ? navigator.userActivation.isActive : null, state: this.state }); return r0.call(this); };
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ssxAudio && window.__app, null, { timeout: 60000 });
  const R = {}, bad = []; const ok = (k, v, c) => { R[k] = v; if (!c) bad.push(k); };
  const before = await page.evaluate(() => window.__ssxAudio.state);
  ok('noCtxBeforeGesture', before.ctx, before.ctx === 'none' || before.contexts <= 1);
  const vp = page.viewportSize(); await page.touchscreen.tap(vp.width / 2, vp.height / 2);
  await page.waitForFunction(() => window.__ssxAudio.state.ctx === 'running', null, { timeout: 10000 }).catch(() => {});
  const after = await page.evaluate(() => window.__ssxAudio.state);
  // Chromium: must be 'running'. Linux WebKit has no audio device ("Failed to start the audio device"), so there the
  // context can't reach 'running'; require instead that resume() ran inside the trusted tap and the state moved off 'suspended'.
  const res = await page.evaluate(() => window.__resumes);
  const inGesture = res.some(r => r.gesture === true || r.gesture === null);
  const noDevice = BR === 'webkit' && after.ctx === 'interrupted';
  ok('runningAfterTap', { state: after.ctx, resumeInGesture: inGesture, noDevice }, after.ctx === 'running' || (noDevice && inGesture));
  // every audio path resolves to the same object; stray constructors fold into it
  const same = await page.evaluate(async () => {
    const S = window.__ssxAudio.ctx(), r = {};
    r.stray = new AudioContext() === S; r.webkit = window.webkitAudioContext ? new window.webkitAudioContext() === S : true;
    r.pit = window.__pitAudio?.ctx?.() === S;
    try { const h = window.SSX?.honk; h?.honk?.(); h?.play?.(); } catch (e) { /* */ }
    for (const m of ['./mars/honk.js', './mars/harvest.js', './mars/jetpack.js', './mars/flame.js', './race.js']) { try { await import(m); } catch (e) { r['imp:' + m] = e.message; } }
    r.session = navigator.audioSession ? navigator.audioSession.type : 'n/a';
    return r;
  });
  ok('strayIsShared', same.stray, same.stray && same.webkit);
  ok('pitShowIsShared', same.pit, same.pit !== false);
  ok('audioSession', same.session, same.session === 'playback' || same.session === 'n/a');
  const n = await page.evaluate(() => ({ native: window.__nativeCount, game: window.__ssxAudio.state.contexts }));
  ok('singleContext', n, n.native === 1 && n.game === 1);
  ok('noErrors', errors.slice(0, 5), errors.length === 0);
  console.log(JSON.stringify({ BR, ...R, bad }));
  await browser.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
