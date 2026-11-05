// PIT 66.6 / DUST 98.3 / MY MUSIC smoke test: stations register after the existing ones, tune from ☰ 🔊 (also with a
// thumb held on the joystick), song rotation + DJ ID caption off the screen centre, MY MUSIC picks local files (file
// chooser), plays them through the music bus, Next song / auto-advance, pauses with 📻 Next / on foot, station is saved.
// BASE=http://127.0.0.1:8833/ BR=webkit VP=393x852 OUT=shots/radio-extra/ node tests/test-radio-extra.js   (VP=desktop → 1440x900 mouse)
const pw = require(process.env.PWMOD || 'playwright');
const base = process.env.BASE || 'http://127.0.0.1:8833/', BR = process.env.BR || 'chromium', VP = process.env.VP || '393x852';
const out = (process.env.SHOTS_DIR || process.env.OUT || '/tmp/radio-extra-shots') .replace(/\/?$/, '/'), desk = VP === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function wav(freq, secs = 1.6, rate = 8000) { // tiny test songs, generated here
  const n = Math.floor(secs * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / rate) * 6000), 44 + i * 2); return b;
}
const SONGS = [['Track_One.wav', 330, 2.5], ['track two.wav', 440, 2.5], ['Third Song.wav', 550, 2.5]].map(([name, f, d]) => ({ name, mimeType: 'audio/wav', buffer: wav(f, d) }));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'] } : {});
  const [vw, vh] = desk ? [1440, 900] : VP.split('x').map(Number);
  const ctxOpts = desk ? { viewport: { width: vw, height: vh } } : { ...pw.devices['iPhone 14 Pro'], viewport: { width: vw, height: vh }, screen: { width: vw, height: vh } };
  if (BR === 'chromium' && !desk) delete ctxOpts.defaultBrowserType;
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/GL_|WebGL|GPU|favicon|Failed to load resource/i.test(m.text())) errors.push('CE ' + m.text().slice(0, 200)); });
  const tag = `${BR}-${desk ? 'desktop-1440x900' : VP}`;
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); if (process.env.TRACE) console.error(tag, k, cond ? 'ok' : 'FAIL', JSON.stringify(R[k])); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }, sel);
  const tap = async sel => { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(120); const c = await center(sel); if (!c) return null; if (desk) await page.mouse.click(c.x, c.y); else await page.touchscreen.tap(c.x, c.y); return c; };
  const MA = () => G(() => window.__app.marsAudio.state), RX = () => G(() => window.SSX.radioExtra.state);
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
  };
  const enterRover = async () => {
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await wait(() => /Drive/.test(document.getElementById('driveBtn').textContent), 8000);
    await G(() => window.__app.surface.interact()); return wait(() => window.__app.surface.info.driving, 6000);
  };
  const openPanel = async () => { await G(() => window.__app.toggleMenu(true)); await tap('#rmSound'); return wait(() => document.getElementById('sndPanel').classList.contains('show'), 3000); };
  // a thumb resting on the joystick (pointer 77) while another finger (pointer 78) taps
  const heldTap = sels => G(async sels => {
    const s = ms => new Promise(q => setTimeout(q, ms)), j = document.getElementById('joy'), r = j.getBoundingClientRect(), jx = r.x + r.width / 2, jy = r.y + r.height / 2;
    const P = (el, t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 77, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    P(j, 'pointerdown', 77, jx, jy); await s(50); P(j, 'pointermove', 77, jx, jy - r.height * 0.2); await s(80);
    const o = [];
    for (const sel of sels) { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center' }); await s(80); const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2, top = document.elementFromPoint(x, y); P(top, 'pointerdown', 78, x, y); await s(60); P(top, 'pointerup', 78, x, y); await s(200); o.push({ sel, log: window.SSX.radioExtra.state.log.join(','), top: top?.id || top?.dataset?.id || top?.tagName, tuned: window.__app.marsAudio.state.tuned, rx: window.SSX.radioExtra.state.pos, cur: window.SSX.radioExtra.state.current }); }
    P(j, 'pointerup', 77, jx, jy); return o;
  }, sels);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('loaded', await wait(() => !!window.SSX?.radioExtra, 20000));
    const ids = await G(() => window.__app.marsAudio.stations().map(s => s.id));
    ok('stations', ids.join(), ids[3] === 'off' && ids.slice(-3).join() === 'pit,dust,mine' && ['rust', 'olympus', 'helios', 'beltway'].every(i => ids.includes(i)));
    ok('procedural', await G(() => window.__app.marsAudio.stations().filter(s => ['pit', 'dust'].includes(s.id)).every(s => s.procedural)));
    if (desk) await page.mouse.click(vw * 0.5, vh * 0.45); else await page.touchscreen.tap(vw * 0.5, vh * 0.45);
    ok('audioRunning', await wait(() => window.__app.marsAudio.state.ctxState === 'running', 5000));
    await land();
    // night mix: silent without a clock, plays seedy one-shots in the Flats when SSX.time.isNight() says so
    await G(() => { const s = window.__app.surface, c = s.world.colony; s.debugPlace(c.x - 280, c.z - 40, 0); }); await sleep(2500);
    const realT = await G(() => { const T = window.SSX.time; if (T && typeof T.set === 'function') { window.__realT = T; T.set(12); return true; } return false; }); if (realT) await sleep(2500); // v7.5.4: the shared Mars clock ships: daytime = no night mix
    ok('noNightWithoutClock', (await RX()).night === null);
    await G(() => { window.SSX.time = { isNight: () => true }; });
    ok('nightMix', await wait(() => !!window.SSX.radioExtra.state.night, 20000)); R.nightMix = (await RX()).night;
    await G(() => { if (window.__realT) window.SSX.time = window.__realT; else delete window.SSX.time; });
    ok('roverIn', await enterRover());
    ok('panelOpen', await openPanel());
    const box = await G(() => { const b = document.getElementById('mineBox'), cs = getComputedStyle(b), bt = getComputedStyle(document.getElementById('minePick')); return { bg: cs.backgroundColor, fg: cs.color, btBg: bt.backgroundColor, btFg: bt.color, h: document.getElementById('minePick').getBoundingClientRect().height }; });
    ok('mineBoxBW', JSON.stringify(box), box.bg === 'rgb(0, 0, 0)' && box.fg === 'rgb(255, 255, 255)' && box.btBg === 'rgb(255, 255, 255)' && box.btFg === 'rgb(0, 0, 0)' && box.h >= 44);
    const sb = await center('#sndStations button[data-id="pit"]'); ok('stationTap44', sb && Math.round(sb.h), sb && sb.h >= 44);
    await tap('#sndStations button[data-id="pit"]');
    ok('tunePit', await wait(() => window.__app.marsAudio.state.station === 'pit', 4000));
    ok('pitSong', await wait(() => !!window.SSX.radioExtra.state.pit, 4000)); R.pitSong = (await RX()).pit;
    ok('djIdCaption', await wait(() => document.getElementById('ssxTicker').classList.contains('on') && /PIT 66\.6/.test(document.getElementById('ssxTicker').textContent), 4000));
    R.ticker = await G(() => document.getElementById('ssxTicker').textContent);
    const tk = await G(() => { const r = document.getElementById('ssxTicker').getBoundingClientRect(); return { y: r.y, h: r.height }; });
    ok('tickerOffCentre', JSON.stringify(tk), tk.y + tk.h < vh * 0.3);
    ok('savedPit', await G(() => window.__app.game.progress.settings.radioId === 'pit'));
    // song rotation: skip the cursor to the end of the current song and check the next one starts
    const rot = await G(async () => { const st = (await import('./audio7.js')).STATIONS.find(s => s.id === 'pit'), p = st.__p, a = st.nowPlaying; p.si = st.tracks[p.ti].sections.length - 1; p.n = 1e6; await new Promise(r => setTimeout(r, 900)); return [a, st.nowPlaying, st.bpm]; });
    ok('pitRotates', rot.join('|'), rot[0] !== rot[1] && !!rot[1]);
    await tap('#sndStations button[data-id="dust"]');
    ok('tuneDust', await wait(() => window.__app.marsAudio.state.station === 'dust' && !!window.SSX.radioExtra.state.dust, 4000)); R.dustSong = (await RX()).dust;
    ok('voicesCapped', (await MA()).voices, (await MA()).voices <= 9);
    await G(() => document.getElementById('sndStations').scrollIntoView({ block: 'start' })); await sleep(250);
    await page.screenshot({ path: `${out}radio-extra-${tag}-stations.png` });
    // MY MUSIC: real tap on Pick files opens the system file chooser
    const fcP = page.waitForEvent('filechooser', { timeout: 6000 }).catch(() => null);
    await tap('#minePick'); const fc = await fcP; ok('fileChooser', !!fc);
    if (fc) { ok('chooserMultiple', fc.isMultiple()); await fc.setFiles(SONGS); }
    ok('filesLoaded', await wait(() => window.SSX.radioExtra.state.files === 3, 4000));
    ok('tunedMine', await wait(() => window.__app.marsAudio.state.tuned === 'mine', 3000));
    let playing = await wait(() => window.SSX.radioExtra.state.playing && window.SSX.radioExtra.state.time > 0.15, 5000);
    if (!playing) { R.neededNextTap = (await RX()).blocked; await tap('#mineNext'); playing = await wait(() => window.SSX.radioExtra.state.playing && window.SSX.radioExtra.state.time > 0.15, 5000); }
    ok('minePlays', JSON.stringify(await RX()), playing);
    ok('routedThroughMusicBus', (await RX()).routed === true);
    ok('noProceduralWhileMine', (await MA()).station === null);
    ok('blobOnly', await G(() => [...document.querySelectorAll('audio')].length === 0)); // element is detached, src is blob:
    ok('savedMine', await G(() => window.__app.game.progress.settings.radioId === 'mine'));
    await sleep(300); await page.screenshot({ path: `${out}radio-extra-${tag}-mymusic.png` });
    // auto-advance at the end of a song
    const p0 = (await RX()).pos; ok('autoAdvance', await wait(p => window.SSX.radioExtra.state.pos !== p, 6000, p0));
    if (!desk) await wait(() => window.SSX.radioExtra.state.time < 0.6, 3000); // tap early in a song so it can't end mid-check
    if (!desk) {
      const hp = (await RX()).pos, h = await heldTap(['#mineNext', '#sndStations button[data-id="pit"]', '#sndStations button[data-id="mine"]', '#mineNext']);
      R.heldJoyTaps = h.map(o => `${o.top}:${o.tuned}/${o.rx}`).join(' '); R.heldLog = h.map(o => o.log).join(' | ');
      ok('heldJoyTaps', R.heldJoyTaps + ' from ' + hp, h[0].tuned === 'mine' && h[0].rx !== hp && h[1].tuned === 'pit' && h[2].tuned === 'mine' && h[3].rx !== h[2].rx);
    } else {
      const c0 = (await RX()).pos; await tap('#mineNext'); ok('nextSong', await wait(c => window.SSX.radioExtra.state.pos !== c, 2000, c0));
    }
    ok('playingAgain', await wait(() => window.SSX.radioExtra.state.playing, 4000));
    // mixer still applies: music slider is a gain on the bus the element feeds
    await G(() => window.__app.marsAudio.mix.set({ music: 0.5 })); ok('mixMusic', await G(() => window.__app.marsAudio.mix.get().music === 0.5));
    await tap('#sndClose');
    // 📻 Next leaves MY MUSIC → the file pauses
    await tap('#radioBtn'); await sleep(500); R.afterNext = (await MA()).tuned;
    ok('pausedOnNextStation', await wait(() => !window.SSX.radioExtra.state.playing, 2000));
    // back to MY MUSIC from the panel, then get out of the car → pauses
    await openPanel(); await tap('#sndStations button[data-id="mine"]'); await tap('#sndClose');
    ok('resumes', await wait(() => window.SSX.radioExtra.state.playing, 4000));
    await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 6000);
    ok('pausedOnFoot', await wait(() => !window.SSX.radioExtra.state.playing, 2000));
    // reload: station remembered, files are not
    await G(() => window.__app.game.save?.()); await sleep(300);
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading') && !!window.SSX?.radioExtra, 120000);
    ok('reloadKeepsStationOnly', await G(() => `${window.__app.game.progress.settings.radioId}/${window.SSX.radioExtra.state.files}`), await G(() => window.__app.game.progress.settings.radioId === 'mine' && window.SSX.radioExtra.state.files === 0));
    if (desk) await page.mouse.click(vw * 0.5, vh * 0.45); else await page.touchscreen.tap(vw * 0.5, vh * 0.45);
    await land(); ok('roverIn2', await enterRover());
    ok('mineRestored', await wait(() => window.__app.marsAudio.state.tuned === 'mine', 5000));
    ok('noFilesHint', await wait(() => /Pick files/.test(document.getElementById('ssxTicker').textContent) && document.getElementById('ssxTicker').classList.contains('on'), 5000));
    await openPanel();
    const fc2P = page.waitForEvent('filechooser', { timeout: 6000 }).catch(() => null);
    await tap('#sndStations button[data-id="mine"]'); ok('stationTapOpensPicker', !!(await fc2P));
    await tap('#sndClose');
  } catch (e) { errors.push('TEST ' + e.message); }
  ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 0, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + tag + ' ' + bad.join(',') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
