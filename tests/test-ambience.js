// Mars city ambience smoke test: AudioContext unlocks on the first tap, the mixer wires in, district soundscapes
// crossfade by position, pedestrian bark captions appear (off the screen centre), radio stations switch from the
// ☰ 🔊 panel and the 📻 Next button, the talk station shows captions, the station + mix survive a reload, no errors.
// BASE=http://127.0.0.1:8812/ BR=webkit VP=393x852 node tests/test-ambience.js     (VP=desktop → 1440x900 mouse)
const pw = require(process.env.PWMOD || 'playwright');
const base = process.env.BASE || 'http://127.0.0.1:8812/', BR = process.env.BR || 'chromium', VP = process.env.VP || '393x852';
const out = process.env.OUT || '/tmp/ambience-shots/', desk = VP === 'desktop', SHOTS = process.env.SHOTS === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button')?.id || null }; }, sel);
  const tap = async sel => { const c = await center(sel); if (!c) return null; if (desk) await page.mouse.click(c.x, c.y); else await page.touchscreen.tap(c.x, c.y); return c; };
  const S = () => G(() => window.__app.marsAudio.state);
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
  };
  const aj = (x, z) => G(([x, z]) => { const s = window.__app.surface, c = s.world.colony; s.debugPlace(c.x + x, c.z + z, 0); }, [x, z]);
  const enterRover = async () => {
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); });
    await wait(() => /Drive/.test(document.getElementById('driveBtn').textContent), 8000);
    await G(() => window.__app.surface.interact()); return wait(() => window.__app.surface.info.driving, 6000);
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    ok('loaded', await wait(() => !!window.__app?.marsAudio, 15000));
    ok('api', await G(() => ['registerStation', 'bark', 'registerBarks', 'registerSoundscape', 'audio'].every(k => !!window.SSX[k])));
    ok('stations', await G(() => window.__app.marsAudio.stations().map(s => s.id).join()), await G(() => { const ids = window.__app.marsAudio.stations().map(s => s.id); return ids[3] === 'off' && ['rust', 'olympus', 'helios', 'beltway'].every(i => ids.includes(i)); }));
    ok('menuItem', await G(() => !!document.getElementById('rmSound')?.closest('#roverMenu')));
    R.ctxBeforeTap = (await S()).ctxState;
    // first tap on the scene unlocks Web Audio
    if (desk) await page.mouse.click(vw * 0.5, vh * 0.45); else await page.touchscreen.tap(vw * 0.5, vh * 0.45);
    ok('audioRunningAfterTap', await wait(() => window.__app.marsAudio.state.ctxState === 'running', 5000)); R.audioRunningAfterTap = (await S()).ctxState;
    ok('mixerWired', await G(() => window.__app.marsAudio.state.wired && window.__app.marsAudio.state.shadow));
    await land(); ok('landed', await G(() => window.__app.surface.info?.name === 'Mars'));
    // ---- district soundscapes
    await aj(0, 10); await sleep(1500); let st = await S();
    ok('ajJunction', st.weights.junction, st.weights.junction > 0.9 && st.beds.includes('junction'));
    await aj(0, -430); ok('downtown', await wait(() => window.__app.marsAudio.state.district === 'olympus-row' && window.__app.marsAudio.state.beds.includes('downtown'), 6000)); st = await S(); R.downtownW = st.weights.downtown;
    await aj(-280 + 85 * 0.9, -40); await sleep(1200); st = await S(); ok('flatsCrossfade', +st.weights.flats.toFixed(2), st.weights.flats > 0 && st.weights.flats < 1);
    await aj(120, -315); await sleep(1500); st = await S(); ok('highway', +st.weights.highway.toFixed(2), st.weights.highway > 0.9 && st.beds.includes('highway'));
    await aj(320, 80); await sleep(1200); st = await S(); ok('heights', st.district, st.district === 'helios-heights');
    ok('bedsCapped', st.beds.length, st.beds.length <= 3);
    // registered district overrides the config centre
    await G(() => window.SSX.registerDistrict('Mars', 'olympus-row', { name: 'Olympus Row', centre: [40, -470], radius: 100 }));
    await sleep(2300); ok('registeredDistrict', await G(() => window.__app.marsAudio.state.zones.find(z => z.id === 'olympus-row').registered));
    // ---- barks near colonists (back at AJ)
    await aj(0, 10); await sleep(600);
    const nearest = await G(() => { const s = window.__app.surface, i = s.info; return s.world.debug.people().filter(p => p.kind === 'colonist').map(p => ({ ...p, d: Math.hypot(p.x - i.x, p.z - i.z) })).sort((a, b) => a.d - b.d)[0]; });
    if (nearest) await G(p => window.__app.surface.debugPlace(p.x + 3, p.z + 1.5, Math.atan2(3, 1.5)), nearest);
    ok('autoBark', await wait(() => document.querySelectorAll('.ssxBark').length > 0, 25000)); R.autoBark = (await S()).barks[0] || null;
    await wait(() => document.querySelectorAll('.ssxBark').length === 0, 9000);
    R.forced = await G(() => window.SSX.bark(null, 'flats', { force: true })); ok('forcedBark', !!R.forced);
    await sleep(300);
    const cap = await G(() => { const e = document.querySelector('.ssxBark'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, op: getComputedStyle(e).opacity, pe: getComputedStyle(document.getElementById('ssxBarks')).pointerEvents }; });
    ok('captionVisible', cap && JSON.stringify(cap), cap && cap.w > 20 && cap.op !== '0');
    ok('captionOffCentre', cap && !(cap.x < vw / 2 && cap.x + cap.w > vw / 2 && cap.y < vh / 2 && cap.y + cap.h > vh / 2 + 4));
    ok('captionNoInput', cap?.pe === 'none');
    await page.screenshot({ path: `${out}ambience-${tag}-bark.png` });
    R.rateLimited = await G(() => window.SSX.bark(null, 'street')) === null; ok('rateLimited', R.rateLimited);
    // v7.5.3: caller keys show real lines, unknown snake_case keys are skipped, never the raw key as a caption
    R.keyBark = await G(() => window.SSX.bark(null, 'activity_complete', { force: true })); ok('keyBarkReal', R.keyBark, !!R.keyBark && R.keyBark !== 'activity_complete');
    R.keyBarkLine = await G(() => window.SSX.bark(null, 'warn', { force: true, line: "It doesn't take cars!" })); ok('keyBarkCallerLine', R.keyBarkLine, R.keyBarkLine === "It doesn't take cars!");
    R.unknownKey = await G(() => window.SSX.bark(null, 'zz_not_a_bark', { force: true })); ok('unknownKeySkipped', R.unknownKey, R.unknownKey === null);
    ok('noRawKeyCaption', await G(() => [...document.querySelectorAll('.ssxBark')].map(e => e.textContent).join(' | ')), await G(() => [...document.querySelectorAll('.ssxBark')].every(e => !/^[a-z0-9_]+$/.test(e.textContent.trim()))));
    // ---- radio while driving
    ok('roverIn', await enterRover());
    ok('radioOn', await wait(() => window.__app.marsAudio.state.radioOn, 4000));
    if (!desk) { await G(() => window.__app.toggleMenu(true)); } else { await G(() => window.__app.toggleMenu(true)); }
    await G(() => document.getElementById('rmSound').scrollIntoView({ block: 'center' })); await sleep(150);
    await tap('#rmSound'); ok('panelOpen', await wait(() => document.getElementById('sndPanel').classList.contains('show'), 3000));
    const sb = await center('#sndStations button[data-id="rust"]'); ok('stationTap44', sb && Math.round(sb.h), sb && sb.h >= 44);
    await tap('#sndStations button[data-id="rust"]');
    ok('tuneRust', await wait(() => window.__app.marsAudio.state.station === 'rust' && window.__app.marsAudio.state.tuned === 'rust', 4000));
    await tap('#sndStations button[data-id="olympus"]');
    ok('tuneTalk', await wait(() => window.__app.marsAudio.state.station === 'olympus', 4000));
    ok('talkCaption', await wait(() => document.getElementById('ssxTicker').classList.contains('on'), 6000)); R.talk = await G(() => document.getElementById('ssxTicker').textContent);
    ok('savedRadioId', await G(() => window.__app.game.progress.settings.radioId), await G(() => window.__app.game.progress.settings.radioId === 'olympus'));
    const tk = await G(() => { const r = document.getElementById('ssxTicker').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    ok('tickerOffCentre', JSON.stringify(tk), tk.y + tk.h < vh * 0.3);
    await page.screenshot({ path: `${out}ambience-${tag}-radio.png` });
    await tap('#sndClose'); await wait(() => !document.getElementById('sndPanel').classList.contains('show'), 2000);
    await page.screenshot({ path: `${out}ambience-${tag}-radio-ticker.png` });
    // 📻 Next cycles from our station to the next one
    const before = (await S()).tuned; await tap('#radioBtn'); await sleep(400); const after = (await S()).tuned;
    ok('nextButton', `${before}->${after}`, before !== after);
    await G(() => window.__app.marsAudio.mix.set({ music: 0.6 }));
    await G(() => window.__app.toggleMenu(true)); await G(() => document.getElementById('rmSound').scrollIntoView({ block: 'center' })); await sleep(150); await tap('#rmSound');
    await wait(() => document.getElementById('sndPanel').classList.contains('show'), 3000);
    await tap('#sndStations button[data-id="helios"]'); await wait(() => window.__app.marsAudio.state.station === 'helios', 3000);
    await tap('#sndMute'); ok('muted', await G(() => window.__app.marsAudio.mix.get().mute && window.__app.game.progress.settings.mix?.mute === true));
    await tap('#sndMute'); ok('unmuted', await G(() => !window.__app.marsAudio.mix.get().mute));
    if (!desk) { // a thumb resting on the joystick (pointer 77) while another finger (pointer 78) taps our buttons
      const held = await G(async () => {
        const s = ms => new Promise(q => setTimeout(q, ms)), j = document.getElementById('joy'), r = j.getBoundingClientRect(), jx = r.x + r.width / 2, jy = r.y + r.height / 2;
        const P = (el, t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 77, clientX: x, clientY: y, bubbles: true, cancelable: true }));
        const tapB = async el => { const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2, top = document.elementFromPoint(x, y); P(top, 'pointerdown', 78, x, y); await s(60); P(top, 'pointerup', 78, x, y); await s(250); };
        P(j, 'pointerdown', 77, jx, jy); await s(50); P(j, 'pointermove', 77, jx, jy - r.height * 0.2); await s(80);
        const o = {};
        await tapB(document.querySelector('#sndStations button[data-id="beltway"]')); o.station = window.__app.marsAudio.state.tuned;
        await tapB(document.getElementById('sndMute')); o.mute = window.__app.marsAudio.mix.get().mute;
        await tapB(document.getElementById('sndMute')); o.unmute = !window.__app.marsAudio.mix.get().mute;
        const rg = document.getElementById('snd_amb'); rg.value = 40; rg.dispatchEvent(new Event('input', { bubbles: true })); o.amb = window.__app.marsAudio.mix.get().amb;
        await tapB(document.querySelector('#sndStations button[data-id="helios"]')); o.back = window.__app.marsAudio.state.tuned;
        P(j, 'pointerup', 77, jx, jy); return o;
      });
      ok('heldJoyTaps', JSON.stringify(held), held.station === 'beltway' && held.mute && held.unmute && held.amb === 0.4 && held.back === 'helios');
    }
    await tap('#sndClose');
    ok('voicesCapped', (await S()).voices, (await S()).voices <= 9);
    await G(() => window.__app.surface.interact()); await wait(() => !window.__app.surface.info.driving, 6000);
    ok('radioOffOnFoot', await wait(() => !window.__app.marsAudio.state.station, 3000));
    // ---- persistence across a reload: last station + mix come back
    await G(() => window.__app.game.save?.()); await sleep(300);
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading') && !!window.__app?.marsAudio, 120000);
    ok('reloadSaved', await G(() => { const s = window.__app.game.progress.settings; return `${s.radioId}/${s.radio}/${s.mix?.music}`; }), await G(() => { const s = window.__app.game.progress.settings; return s.radioId === 'helios' && s.mix?.music === 0.6; }));
    if (desk) await page.mouse.click(vw * 0.5, vh * 0.45); else await page.touchscreen.tap(vw * 0.5, vh * 0.45);
    await land(); ok('roverIn2', await enterRover());
    ok('stationRestored', await wait(() => window.__app.marsAudio.state.tuned === 'helios' && window.__app.marsAudio.state.station === 'helios', 5000));
    await sleep(500);
  } catch (e) { errors.push('TEST ' + e.message); }
  ok('noErrors', errors.length ? errors.slice(0, 5).join(' | ') : 0, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + tag + ' ' + bad.join(',') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
