// First Day on Mars tour + ☰ → 📖 How to play (onboard.js / SSX.onboard). Plays the whole tour the way a player would on
// this device (taps on phones, keys on desktop; targets reached with surface.debugMove), with a joystick finger held down
// while tapping the prompt's ✕ on phones. Checks: one prompt line, top-right (never the centre), arrow + distance on the
// target, own marker / minimap dot, rewards, ssx.onboard.v1, the skip confirm, the codex sheet (scrollable, fits the
// width), returning players skipped automatically, ?onboard=1 / ?onboard=0, and no page errors.
// BASE=http://127.0.0.1:8893/ DEV=393x852 BR=webkit OUT=/workspace/pw-ben-onboard/shots/ node tests/test-onboard.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8893/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', PFX = process.env.PFX || 'onboard';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const m = /^(\d+)x(\d+)$/.exec(DEV), { defaultBrowserType: _d, ...iph } = devices['iPhone 14'];
  const dev = DEV === 'desktop' ? { viewport: { width: 1440, height: 900 } } : { ...iph, viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] }, deviceScaleFactor: 3 };
  const touch = DEV !== 'desktop';
  const ctx = await browser.newContext(dev); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error' || /^onboard/.test(m.text())) errors.push(m.text().slice(0, 240)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 15000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png`, timeout: 120000 }).then(() => (R.shots = (R.shots || []).concat(`${out}${PFX}-${tag}-${s}.png`))).catch(e => errors.push('shot ' + s));
  // a touch tap on whatever is at the element's centre (pointerdown -> pointerup, same pointerId); desktop: a real mouse click
  const tapEl = async (sel, pid = 42) => {
    if (!touch) { await page.click(sel, { timeout: 20000 }); return true; }
    return G(([sel, pid]) => { const el = document.querySelector(sel); if (!el) return 'missing'; const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const hit = document.elementFromPoint(x, y); if (!hit || !(hit === el || el.contains(hit))) return 'covered by ' + (hit?.id || hit?.className || hit?.tagName);
      const o = { pointerId: pid, pointerType: 'touch', isPrimary: pid === 41, bubbles: true, cancelable: true, clientX: x, clientY: y };
      hit.dispatchEvent(new PointerEvent('pointerdown', o)); hit.dispatchEvent(new PointerEvent('pointerup', o)); return true; }, [sel, pid]);
  };
  const joy = (type, dy = -40) => G(([type, dy]) => { const j = document.getElementById('joy'), r = j.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2 + (type === 'pointerdown' ? 0 : dy);
    j.dispatchEvent(new PointerEvent(type, { pointerId: 41, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y })); }, [type, dy]);
  const ob = () => G(() => { const S = window.SSX.onboard, st = S.state, l = document.getElementById('obLine'), r = l?.getBoundingClientRect();
    return { status: st.status, m: st.m, s: st.s, text: l && !l.hidden ? l.textContent : '', shown: !!l && !l.hidden && r.width > 0, rect: r && [r.x, r.y, r.width, r.height].map(Math.round), parent: l?.parentNode?.id || l?.parentNode?.tagName, way: S.waypoint, cur: S.current() }; });
  const at = async (m, s, ms = 30000) => wait(([m, s]) => { const st = window.SSX.onboard.state; return st.m === m && st.s === s || (m >= 6 && st.status === 'done'); }, ms, [m, s]);
  const info = () => G(() => { const i = window.__app.surface.info; return { x: i.x, z: i.z, driving: !!i.driving, inside: !!i.inside, cr: window.__app.surface.game.credits ?? window.__app.surface.game.state?.credits }; });
  const credits = () => G(() => { const g = window.__app.surface.game; return g.credits ?? g.info?.credits ?? JSON.parse(localStorage.getItem('ssx.progress.v1') || '{}').credits ?? 0; });
  const goTo = (dx = 0, dz = 3) => G(([dx, dz]) => { const t = window.SSX.onboard.current().target; window.__app.surface.debugMove(t.x + dx, t.z + dz, 0); return t; }, [dx, dz]);
  const key = async k => { await page.keyboard.press(k); };
  const closePanels = () => G(() => { window.SSX.jobs?.close?.(); window.SSX.contraband?.close?.(); window.SSX.turf?.close?.(); });
  const loadPage = async q => { await page.goto(base + '?' + q + '&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading') && !!window.SSX?.onboard, 180000); };
  const land = async () => {
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000); await sleep(800);
    await G(() => { const s = window.__app.surface; s.game.setAliens?.(false); s.game.restore?.(); });
    if (await G(() => { const r = document.getElementById('radio'); return r && getComputedStyle(r).display !== 'none'; })) await G(() => document.getElementById('radioLater')?.click());
  };
  // the line: one short caption, top-right, out of the middle of the screen
  const placement = async k => { const o = await ob(); const W = dev.viewport.width, H = dev.viewport.height, [x, y, w, h] = o.rect || [0, 0, 0, 0];
    const centre = !(x + w < W * 0.3 || x > W * 0.7 || y + h < H * 0.3 || y > H * 0.7); R[k + 'Rect'] = o.rect;
    ok(k + 'Placed', `${o.parent} ${o.rect}`, o.shown && !centre && (o.parent === 'stackR' ? y < H * 0.35 : y > H * 0.6) && h <= 82 && x >= 0 && x + w <= W + 1);
    ok(k + 'One', null, await G(() => document.querySelectorAll('#obLine').length === 1));
    ok(k + 'NoClip', null, await G(() => { const t = document.querySelector('#obLine .ob-t'); return !!t && t.scrollHeight <= t.clientHeight + 2; })); return o; };
  try {
    // ---- 1. new player: tour on, saved, space prompt
    await loadPage('');
    let o = await ob(); ok('newActive', o.status, o.status === 'active');
    ok('saved', null, await G(() => JSON.parse(localStorage.getItem('ssx.onboard.v1') || '{}').status === 'active'));
    ok('menuItem', null, await G(() => /How to play/.test(document.getElementById('rmHowTo')?.textContent || '')));
    await wait(() => !document.getElementById('obLine')?.hidden, 8000); o = await placement('space');
    ok('spaceText', o.text, /Mars/.test(o.text) && /Land here/.test(o.text) && !(await G(() => { const t = document.querySelector('#obLine .ob-t'); return t.scrollHeight > t.clientHeight + 2; })));
    await shot('space');
    // ---- 2. land: mission 1 walk
    await land();
    ok('m1', null, await wait(() => { const l = document.getElementById('obLine'); return l && !l.hidden && /blue marker/.test(l.textContent); }, 20000));
    o = await placement('m1'); R.m1Text = o.text;
    ok('m1Controls', o.text, touch ? /left stick/.test(o.text) && /Run/.test(o.text) : /W A S D/.test(o.text) && /Shift/.test(o.text));
    ok('ownMarker', o.way?.via, o.way?.via === 'own' && await G(() => !!window.__app.surface.scene.getObjectByName('onboard-marker')?.visible && window.SSX.minimap.list().includes('onboard')));
    ok('distShown', o.text, /\d+ m/.test(o.text));
    // skip confirm with a joystick finger held (phones), then keep going
    if (touch) await joy('pointerdown');
    const t1 = await tapEl('#obLine .ob-x'); ok('tapX', t1, t1 === true);
    ok('confirm', null, await wait(() => /Skip the tour\?/.test(document.getElementById('obLine')?.textContent || ''), 4000));
    await shot('skip');
    const t2 = await tapEl('#obLine [data-ob="keep"]'); ok('tapKeep', t2, t2 === true);
    if (touch) await joy('pointerup');
    ok('kept', null, await wait(() => window.SSX.onboard.state.status === 'active' && /blue marker/.test(document.getElementById('obLine')?.textContent || ''), 4000));
    // arrow: stand 30 m "south" of the marker facing -z (yaw 0) -> straight ahead
    await G(() => { const t = window.SSX.onboard.current().target; window.__app.surface.debugMove(t.x, t.z + 30, 0); }); await sleep(900);
    o = await ob(); ok('arrowAhead', o.text.match(/[⬆↗➡↘⬇↙⬅↖]\s*\d+ m/)?.[0], /⬆\s*(2[6-9]|3[0-4]) m/.test(o.text));
    await G(() => { const t = window.SSX.onboard.current().target; window.__app.surface.debugMove(t.x + 30, t.z, 0); }); await sleep(900);
    o = await ob(); ok('arrowLeft', o.text.match(/[⬆↗➡↘⬇↙⬅↖]/)?.[0], /⬅/.test(o.text));
    const cr0 = await credits(); R.cr0 = cr0; await G(() => { window.__obPaid = 0; window.SSX.on('onboard:step', d => { window.__obPaid += d?.paid || 0; }); });
    await goTo(0, 1.5); ok('walkDone', null, await at(0, 1));
    o = await ob(); ok('jumpText', o.text, touch ? /tap Jump/.test(o.text) : /press Space/.test(o.text));
    if (touch) { await G(() => { const el = document.getElementById('jumpBtn'), r = el.getBoundingClientRect(), p = { pointerId: 43, pointerType: 'touch', bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 20 }; el.dispatchEvent(new PointerEvent('pointerdown', p)); setTimeout(() => el.dispatchEvent(new PointerEvent('pointerup', p)), 350); }); }
    else { await page.keyboard.down('Space'); await sleep(350); await page.keyboard.up('Space'); }
    ok('m1Done', null, await at(1, 0, 20000));
    ok('flash', null, await wait(() => /Find your feet · \+25 cr/.test(document.getElementById('obLine')?.textContent || ''), 3000));
    // ---- mission 2: rover + taxi stand
    await wait(() => /rover/.test(document.getElementById('obLine')?.textContent || ''), 6000);
    o = await ob(); ok('roverText', o.text, touch ? /🚙 Drive/.test(o.text) : /press E/.test(o.text));
    await G(() => { const i = window.__app.surface.info; window.__app.surface.debugMove(i.roverX + 2, i.roverZ + 1, 0); }); await sleep(900);
    if (touch) { await wait(() => /Drive/.test(document.getElementById('driveBtn')?.textContent || ''), 5000); R.tapDrive = await tapEl('#driveBtn'); } else await key('KeyE');
    ok('driving', null, await wait(() => window.__app.surface.info.driving, 8000)); ok('m2s1', null, await at(1, 1));
    // the target shot: 32 m short of the taxi stand, facing it
    await G(() => { const t = window.SSX.onboard.current().target; window.__app.surface.debugMove(t.x, t.z + 32, 0); }); await sleep(2500);
    o = await placement('taxi'); ok('taxiText', o.text, /Taxi stand/.test(o.text) && (touch ? /⚡ Boost/.test(o.text) : /Shift/.test(o.text)) && /⬆/.test(o.text));
    await shot('target');
    await goTo(0, 4); ok('m2Done', null, await at(2, 0));
    // ---- mission 3: the phone dock / J
    await sleep(2800); o = await ob(); ok('jobsText', o.text, touch ? /💼 Jobs/.test(o.text) : /Press J/.test(o.text));
    if (touch) R.tapJobs = await tapEl(o.text.includes('☰') ? '#menuBtn' : '#dockJobs'); else await key('KeyJ');
    if (touch && o.text.includes('☰')) { await sleep(400); await tapEl('#rmJobs'); }
    ok('jobsOpen', null, await wait(() => document.getElementById('jobPanel')?.classList.contains('show'), 5000));
    ok('hiddenUnderPanel', null, await wait(() => document.getElementById('obLine').hidden, 3000));
    ok('m3s2', null, await at(2, 1, 5000)); await closePanels(); ok('m3Done', null, await at(3, 0));
    // ---- mission 4: Blue (out of the car first)
    if (await G(() => window.__app.surface.info.driving)) { if (touch) await tapEl('#driveBtn'); else await key('KeyE'); await wait(() => !window.__app.surface.info.driving, 5000); }
    await sleep(2800); await goTo(0, 2); ok('m4s1', null, await at(3, 1));
    await sleep(600);
    if (touch) { await wait(() => /Blue/.test(document.getElementById('cbBtn')?.textContent || ''), 6000); R.tapBlue = await tapEl('#cbBtn'); } else await key('KeyB');
    ok('blueOpen', null, await wait(() => document.getElementById('cbPanel')?.classList.contains('show'), 6000));
    ok('m4s3', null, await at(3, 2, 5000)); await closePanels(); ok('m4Done', null, await at(4, 0));
    // ---- mission 5: turf map, K / 🚩, the Pit
    await sleep(2800); await goTo(1, 1); ok('m5s1', null, await at(4, 1));
    o = await ob(); ok('turfText', o.text, touch ? /🚩 Turf/.test(o.text) : /Press K/.test(o.text));
    if (touch) { const fold = o.text.includes('☰'); R.tapTurf = await tapEl(fold ? '#menuBtn' : '#dockTurf'); if (fold) { await sleep(400); await tapEl('#rmTurf'); } } else await key('KeyK');
    ok('turfOpen', null, await wait(() => document.getElementById('turfPanel')?.classList.contains('show'), 6000));
    ok('m5s2', null, await at(4, 2, 5000)); await closePanels(); ok('m5s3', null, await at(4, 3));
    o = await ob(); R.pitTarget = o.cur?.target; ok('pitText', o.text, /The Pit/.test(o.text) && !/Drop into/.test(o.text));
    await goTo(0, 2); await sleep(1500);
    ok('pitButton', await G(() => document.getElementById('actCtxBtn')?.textContent), await G(() => { const b = document.getElementById('actCtxBtn'); return !!b && b.getBoundingClientRect().width > 0 && /The Pit/.test(b.textContent); }) || await G(() => !!window.SSX.fight));
    ok('m5Done', null, await at(5, 0, 20000));
    // ---- mission 6: the club
    await sleep(2800); await goTo(0, 1.2); ok('m6s1', null, await at(5, 1));
    await sleep(700);
    if (touch) { await wait(() => /Enter/.test(document.getElementById('driveBtn')?.textContent || ''), 5000); R.doorBtn = await G(() => document.getElementById('driveBtn')?.textContent); R.tapDoor = await tapEl('#driveBtn'); } else await key('KeyE');
    ok('inside', null, await wait(() => !!window.__app.surface.info.inside, 10000));
    ok('done', null, await wait(() => window.SSX.onboard.state.status === 'done', 10000));
    R.cr1 = await credits(); R.paid = await G(() => window.__obPaid); ok('rewards', `${R.paid} paid, wallet +${R.cr1 - cr0} (club cover comes off)`, R.paid === 315 && R.cr1 - cr0 >= 315 - 40);
    ok('doneLine', null, await wait(() => /Tour done/.test(document.getElementById('obLine')?.textContent || ''), 3000));
    ok('savedDone', null, await G(() => JSON.parse(localStorage.getItem('ssx.onboard.v1')).status === 'done'));
    await sleep(7500); ok('lineGone', null, await G(() => document.getElementById('obLine').hidden));
    // ---- codex from ☰
    if (touch) { await tapEl('#menuBtn'); await sleep(400); R.tapCodex = await tapEl('#rmHowTo'); } else { await page.click('#menuBtn'); await sleep(300); await page.click('#rmHowTo'); }
    ok('codexOpen', null, await wait(() => document.getElementById('obCodex')?.classList.contains('show'), 5000));
    const C = await G(() => { const b = document.getElementById('obCodexBody'), w = document.querySelector('#obCodex .ob-w').getBoundingClientRect();
      return { secs: [...b.querySelectorAll('h3')].map(h => h.textContent), items: b.querySelectorAll('p').length, scroll: b.scrollHeight > b.clientHeight, w: Math.round(w.width), l: Math.round(w.x), font: parseFloat(getComputedStyle(b.querySelector('p span')).fontSize),
        pit: b.querySelector('[data-id="pit"]')?.textContent, tour: document.getElementById('obTour')?.textContent, addons: b.querySelectorAll('.ob-tag').length }; });
    R.codex = C; ok('codexContent', C.items, C.items >= 18 && C.secs.length >= 2 && /Pit/.test(C.pit || ''));
    ok('codexFits', `${C.l}+${C.w}`, C.l >= 0 && C.l + C.w <= dev.viewport.width && C.font >= 13);
    ok('codexScroll', null, C.scroll || !touch);
    await shot('codex');
    await G(() => { const b = document.getElementById('obCodexBody'); b.scrollTop = b.scrollHeight; }); await sleep(300);
    ok('codexScrolled', null, await G(t => { const b = document.getElementById('obCodexBody'); return !t || b.scrollTop > 0; }, touch));
    await tapEl('#obCodexClose'); ok('codexClosed', null, await wait(() => !document.getElementById('obCodex').classList.contains('show'), 3000));
    ok('errors', errors.length, errors.length === 0);
    // ---- 3. skip for real, then a returning player, then ?onboard=1 / ?onboard=0
    await loadPage('onboard=1'); ok('forced', null, await G(() => window.SSX.onboard.state.status === 'active'));
    await wait(() => !document.getElementById('obLine')?.hidden, 8000);
    if (touch) await joy('pointerdown');
    await tapEl('#obLine .ob-x'); await wait(() => !!document.querySelector('#obLine [data-ob="skip"]'), 3000); await tapEl('#obLine [data-ob="skip"]');
    if (touch) await joy('pointerup');
    ok('skipped', null, await wait(() => window.SSX.onboard.state.status === 'skipped' && JSON.parse(localStorage.getItem('ssx.onboard.v1')).status === 'skipped', 4000));
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.progress.v1', JSON.stringify({ xp: 120, credits: 340 })); });
    await loadPage(''); o = await ob(); ok('returningSkipped', o.status, o.status === 'skipped' && await G(() => JSON.parse(localStorage.getItem('ssx.onboard.v1')).auto === true));
    await sleep(1500); ok('noLineForReturning', null, await G(() => { const l = document.getElementById('obLine'); return !l || l.hidden; }));
    await G(() => localStorage.clear()); await loadPage('onboard=0'); o = await ob(); ok('offParam', o.status, o.status !== 'active' && await G(() => localStorage.getItem('ssx.onboard.v1') === null));
    ok('errorsEnd', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('threw: ' + String(e.message || e).slice(0, 300)); }
  R.bad = bad; R.errors = errors.slice(0, 8); console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
