// Mars street circuits test (marstracks.js on race.js + trackbuilder.js + carmeet.js): the five presets are listed, drawn and
// clear of every solid in the real city; the 🏁 Race button starts one; the Ares Beltway Run is raced to the flag (payout);
// the builder snaps gates / ramps / boost pads onto roads on Mars (barriers stay put) and the 🧲 chip turns it off; and a car
// meet launches a preset circuit race with a wager (escrow, laps, payout, rep), with saved Mars tracks offered too.
// On touch devices the game-screen taps are made while a SECOND finger holds #joy (Chromium: CDP multi-touch; WebKit:
// pointer events with a held joystick pointer). The builder is a full-screen overlay over #joy, so its taps are single-finger.
// BASE=http://localhost:8796/ DEV=393x852 BR=webkit OUT=./shots/ node tests/test-marstracks.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8777/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || process.env.SHOTS_DIR || '/tmp/marstracks-shots/', PFX = process.env.PFX || 'tracks';
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
  const credits = () => G(() => window.__app.surface.game.progress.credits);
  // ---- taps: touch = with a thumb held on the joystick the whole time ----
  let cdp = null; const T = async (type, pts) => (cdp = cdp || await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  // the thumb goes down on the stick BEFORE the first tap and stays down (pointer-captured by #joy) while the sheets open over it
  let held = 0, stick = null, tid = 2;
  const holdStick = async () => {
    if (stick || !touch) return;
    const j = await center('#joy'); const free = await G(j => !!document.elementFromPoint(j.x, j.y)?.closest('#joy'), j); if (!free) return;
    if (BR === 'chromium') { cdp = cdp || await ctx.newCDPSession(page); await T('touchStart', [{ x: j.x, y: j.y, id: 1 }]); await sleep(50); await T('touchMove', [{ x: j.x, y: j.y - 30, id: 1 }]); await sleep(50); }
    else await G(j => { const el = document.getElementById('joy'); const o = { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: j.x, clientY: j.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: j.y - 30 })); }, j);
    stick = { x: j.x, y: j.y - 30 };
  };
  const releaseStick = async () => {
    if (!stick) return; const j = stick; stick = null;
    if (BR === 'chromium') { await T('touchEnd', [{ x: j.x, y: j.y, id: 1 }]); await sleep(60); }
    else await G(j => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: j.x, clientY: j.y })), j);
    await sleep(100);
  };
  const tap = async sel => {
    if (!touch) { const c = await center(sel); if (!c) throw new Error('no ' + sel); await page.mouse.click(c.x, c.y); await sleep(250); return; }
    await holdStick(); const c = await center(sel); if (!c) throw new Error('no ' + sel);
    const id = tid++, j = stick;
    if (BR === 'chromium') { const pts = j ? [{ x: j.x, y: j.y, id: 1 }] : []; await T('touchStart', [...pts, { x: c.x, y: c.y, id }]); await sleep(60); await T('touchEnd', [{ x: c.x, y: c.y, id }]); }
    else await G(([c, id]) => { const el = document.elementFromPoint(c.x, c.y); const o = { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: false, clientX: c.x, clientY: c.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); /* no click: iOS drops it while the stick is held */ }, [c, id]);
    await sleep(250); held++; if (j && Math.abs(await G(() => window.__app.joy.y)) > 0.1) R.stickHeld = (R.stickHeld || 0) + 1;
  };
  const ctxShown = (re, id = 'dlrCtxBtn') => wait(([re, id]) => { const b = document.getElementById(id); return b && b.style.display === 'block' && new RegExp(re).test(b.textContent); }, 15000, [re, id]);
  const sheetIs = k => wait(k => document.getElementById('dlrSheet')?.dataset.kind === k, 5000, k);
  const toMars = async () => { await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await land(); await G(() => window.__app.surface.game.setAliens?.(false)); };
  const drive = async () => { await G(() => { const s = window.__app.surface; if (!s.info.driving) { s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 2.5, i.roverZ + 1.5); s.interact(); } }); return wait(() => window.__app.surface.info.driving, 5000); };
  const frames = (n = 3) => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  // drive through gate g (world {x,z,yaw}): 5 m before, then 5 m after, a few frames each
  const thruGate = async g => { const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); for (const k of [-5, 5]) { await G(a => window.__race.place(a[0], a[1], a[2]), [g.x + fx * k, g.z + fz * k, g.yaw]); await frames(3); await sleep(40); } };
  const runRace = async (id, ms = 60000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const st = await G(() => window.__race.state); if (!st) return true; if (st.phase !== 'run') { await sleep(150); continue; }
      const g = await G(() => { const s = window.__race.state, t = window.__race.tracks().find(t => t.id === s.id) || null; return t ? t.gates[s.next] : null; });
      if (g) await thruGate(g); else { const gg = await G(id => window.__mtGates(id), id); await thruGate(gg); }
    }
    return false;
  };
  const tbTap = async (x, z) => { // tap the ground in the builder at world (x, z)
    const s = await G(([x, z]) => window.__race.builder.screenOf(x, z), [x, z]); if (!s?.ok) throw new Error('builder point off screen');
    if (!touch) { await page.mouse.click(s.x, s.y); await sleep(300); return s; }
    const id = tid++;
    if (BR === 'chromium') { await T('touchStart', [{ x: s.x, y: s.y, id }]); await sleep(60); await T('touchEnd', [{ x: s.x, y: s.y, id }]); }
    else await G(([s, id]) => { const el = document.elementFromPoint(s.x, s.y); const o = { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: s.x, clientY: s.y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, [s, id]);
    await sleep(300); return s;
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.progress.v1', JSON.stringify({ v: 1, xp: 200, credits: 9000, badges: ['first'], quests: {}, equip: {} })); });
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await toMars();
    // the meet copy of a track is raced by id 'meet-c-<id>', so expose gates of any resolved def for runRace
    await G(() => { window.__mtGates = () => null; });
    // ---------- 1. presets listed, drawn ----------
    ok('streetsBuilt', null, await wait(() => window.__marstracks?.built, 10000));
    const pre = await G(() => window.__marstracks.presets()), ids = pre.map(p => p.id);
    R.presets = pre.map(p => `${p.name} ${p.gates}g ${p.loop ? p.laps + 'L' : 'sprint'} par ${p.par}`).join(' | ');
    ok('fivePresets', ids.length, ids.length === 5);
    const listed = await G(() => window.__race.tracks().map(t => t.id)); ok('inRaceList', null, ids.every(i => listed.includes(i)) && listed.includes('mars-rustbelt'));
    const cnt = await G(() => window.__race.counts()); ok('idleArches', cnt.idle, cnt.idle >= listed.length);
    ok('streetMeshes', await G(() => window.__marstracks.streetMeshes()), (await G(() => window.__marstracks.streetMeshes())) === (await G(() => window.__marstracks.streets().length)) * 4);
    ok('gatesChecked', null, await wait(() => window.__marstracks.checked, 10000));
    ok('noPresetFixesNeeded', JSON.stringify(await G(() => window.__marstracks.gateFixes)), (await G(() => window.__marstracks.gateFixes.length)) === 0);
    for (const id of ids) { const r = await G(id => window.__marstracks.gateReport(id), id); ok('reach:' + id, r && (r.bad.length || r.legs.length) ? JSON.stringify(r) : (r ? r.gates + ' gates ok' : 'n/a'), !!r && !r.bad.length && !r.legs.length); }
    // gate sanity on the real colliders: a checkpoint tapped inside The Static (Olympus Row) never lands inside it
    { const sx = await G(() => { const t = window.__race.tracks().find(t => t.id === 'mars-st-junction'); return { x: t.gates[0].x + 63.9 + 10, z: t.gates[0].z + 6.7 - 402 }; }); // colony + The Static
      ok('staticIsBuilding', await G(p => window.__marstracks.check(p.x, p.z), sx), (await G(p => window.__marstracks.check(p.x, p.z), sx)) === 'building');
      const on = await G(p => { const r = globalThis.SSX_TRACK_SNAP('Mars', p, 'gate'); return r ? { ...r, why: window.__marstracks.check(r.x, r.z) } : r; }, sx);
      ok('staticTapSnapped', JSON.stringify(on), !!on && on.why === null);
      const off = await G(p => { window.SSX.marsTracks.setSnap(false); const r = globalThis.SSX_TRACK_SNAP('Mars', p, 'gate'); window.SSX.marsTracks.setSnap(true); return r === false ? 'refused' : r ? { ...r, why: window.__marstracks.check(r.x, r.z) } : r; }, sx);
      ok('staticTapSnapOff', JSON.stringify(off), off === 'refused' || (!!off && off.why === null)); }
    ok('ssxApi', null, await G(() => typeof window.SSX.marsTracks?.presets === 'function' && typeof globalThis.SSX_TRACK_SNAP === 'function'));
    // ---------- 2. nothing solid on any racing line or painted street (real city colliders) ----------
    for (const id of [...ids, 'streets']) { const h = await G(id => window.__marstracks.solidHits(id), id); ok('clear:' + id, h ? (h.length ? JSON.stringify(h.slice(0, 4)) : 0) : 'n/a', !!h && h.length === 0); }
    // ---------- 3. the 🏁 Race button at a preset start line, tapped with the stick held ----------
    ok('drives', null, await drive());
    const jr = await G(() => window.__race.tracks().find(t => t.id === 'mars-st-junction'));
    await G(g => { const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); window.__app.surface.debugMove(g.x - fx * 8, g.z - fz * 8, g.yaw); }, jr.gates[0]); // race.place only moves the car mid-race
    { const shown = await ctxShown('Race', 'raceCtxBtn'); if (!shown) R.raceDiag = await G(g => { const i = window.__app.surface.info; return JSON.stringify({ g, i: { x: i.x, z: i.z, rx: i.roverX, rz: i.roverZ, driving: i.driving }, c: window.__race.counts(), st: window.__race.state?.phase || null, dlr: document.getElementById('dlrCtxBtn')?.style.display }); }, jr.gates[0]); ok('raceBtn', null, shown); }
    await tap('#raceCtxBtn'); ok('presetStarts', null, await wait(() => window.__race.state?.id === 'mars-st-junction' && window.__race.state.phase === 'grid', 6000));
    await sleep(900); await shot('junction-grid');
    await releaseStick(); await G(() => window.__race.quit()); await wait(() => !window.__race.state, 4000);
    // ---------- 4. Ares Beltway Run to the flag ----------
    const c0 = await credits();
    ok('beltwayStarts', null, (await G(() => window.__race.start('mars-st-beltway'))).ok);
    await G(() => window.__race.skipCountdown()); await wait(() => window.__race.state?.phase === 'run', 6000);
    await runRace('mars-st-beltway', 240000); // desktop swiftshader runs at a few fps
    const br = await G(() => window.__race.result); R.beltway = JSON.stringify({ won: br?.won, cr: br?.credits, buyIn: br?.buyIn, t: br?.time });
    ok('beltwayWon', null, br?.id === 'mars-st-beltway' && br.done && br.won);
    ok('beltwayPayout', br?.credits, br?.credits === 400 + 40 + 100);
    ok('beltwayCredits', (await credits()) - c0, (await credits()) - c0 === 540 - 20 || (await credits()) - c0 === 540 - 20 - 20); // buy-in (+ a possible ColSec/none toll)
    await G(() => document.querySelector('#raceResClose')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    // ---------- 5. builder road snap ----------
    const col = await G(() => { const t = window.__race.tracks().find(t => t.id === 'mars-st-junction'); return { x: t.gates[0].x + 63.9, z: t.gates[0].z + 6.7 }; }); // colony = gate 0 - its colony offset
    await G(c => { window.__race.place(c.x + 1, c.z - 325, 0); window.__race.setCarSpeed(0); }, col); await frames(5); // the builder opens over your ride
    await G(() => window.__race.openBuilder()); ok('builderOpen', null, await wait(() => window.__race.builder?.open, 5000)); await sleep(1200);
    R.focus = JSON.stringify(await G(() => window.__race.builder.focus));
    ok('snapChip', null, await wait(() => window.__marstracks.chip?.shown && window.__marstracks.chip.on, 4000));
    const n0 = await G(() => window.__race.builder.draft.gates.length);
    await tbTap(col.x + 12, col.z - 316);
    const g1 = await G(() => { const d = window.__race.builder.draft; return d.gates[d.gates.length - 1]; });
    R.snapGate = JSON.stringify(g1 && { x: +(g1.x - col.x).toFixed(1), z: +(g1.z - col.z).toFixed(1) });
    ok('gateSnapped', null, (await G(() => window.__race.builder.draft.gates.length)) === n0 + 1 && Math.abs(g1.x - col.x) < 0.8 && (await G(() => window.__marstracks.lastSnap?.road)) === 'beltway');
    await tbTap(col.x - 14, col.z - 332); // second gate, other side of the road
    const g2 = await G(() => { const d = window.__race.builder.draft; return d.gates[d.gates.length - 1]; }); ok('gate2Snapped', null, Math.abs(g2.x - col.x) < 0.8);
    await G(() => window.__race.builder.setTool('barrier')); const p0 = await G(() => window.__race.builder.draft.props.length);
    await tbTap(col.x + 10, col.z - 325); const pb = await G(() => { const d = window.__race.builder.draft; return d.props[d.props.length - 1]; });
    ok('barrierNotSnapped', null, (await G(() => window.__race.builder.draft.props.length)) === p0 + 1 && Math.abs(pb.x - col.x - 10) < 2.5);
    await G(() => window.__race.builder.setTool('boost')); await tbTap(col.x + 9, col.z - 344); const pp = await G(() => { const d = window.__race.builder.draft; return d.props[d.props.length - 1]; });
    ok('boostSnapped', null, Math.abs(pp.x - col.x) < 0.8 && pp.t === 'boost');
    await sleep(500); await shot('builder-snap');
    // 🧲 off: a gate lands where you tap
    const chipTap = async () => { const c = await center('#tbSnap'); if (!touch) await page.mouse.click(c.x, c.y); else if (BR === 'chromium') { const id = tid++; await T('touchStart', [{ x: c.x, y: c.y, id }]); await sleep(60); await T('touchEnd', [{ x: c.x, y: c.y, id }]); } else await G(([c, id]) => { const el = document.elementFromPoint(c.x, c.y); const o = { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: c.x, clientY: c.y }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); }, [c, tid++]); await sleep(300); };
    const ng = await G(() => window.__race.builder.draft.gates.length + window.__race.builder.draft.props.length);
    await G(() => window.__race.builder.setTool('gate')); await chipTap();
    ok('chipOff', null, await G(() => !window.__marstracks.snapOn && /off/.test(window.__marstracks.chip.text)));
    ok('chipNoPlace', null, (await G(() => window.__race.builder.draft.gates.length + window.__race.builder.draft.props.length)) === ng);
    await tbTap(col.x + 13, col.z - 305); const g3 = await G(() => { const d = window.__race.builder.draft; return d.gates[d.gates.length - 1]; });
    ok('snapOffFree', null, Math.abs(g3.x - col.x - 12) < 2.5);
    await chipTap(); ok('chipOn', null, await G(() => window.__marstracks.snapOn));
    await G(() => window.__race.builder.close(true)); await wait(() => !window.__race.builder.open, 3000);
    // ---------- 6. car meet: circuit race with a wager ----------
    // a saved Mars track shows up in the meet's track list too
    await G(() => { const k = 'ssx.race.v1', d = JSON.parse(localStorage.getItem(k) || '{"v":1,"best":{},"wins":{},"runs":{},"tracks":[]}'), c = window.__race.tracks().find(t => t.id === 'mars-rustbelt').gates;
      d.tracks = [{ id: 't-pumpkin', name: 'My Mars loop', world: 'Mars', custom: true, anchor: 'abs', loop: true, laps: 2, par: 30, rival: { name: 'Pit Viper', kind: 'buggy' }, gates: c.slice(0, 5).map(g => ({ x: g.x, z: g.z })), props: [] }];
      localStorage.setItem(k, JSON.stringify(d)); window.__race.reload(); });
    // Steve's day/night cycle (stubbed here until it merges): meets follow SSX.time.isNight() and skip their own darkening
    await G(() => { window.__night = false; window.SSX.time = { isNight: () => window.__night }; window.__dealer.skipToMeet(); });
    ok('dayNoMeet', null, await G(() => window.__dealer.meet.sharedNight && !window.__dealer.meet.on));
    await G(() => { window.__night = true; }); ok('meetOn', null, await G(() => window.__dealer.meet.on));
    await drive(); await G(() => window.__dealer.tp('meet', 0));
    ok('meetSpawns', null, await wait(() => window.__dealer.meet.spawned?.cars > 0, 8000));
    await sleep(800); ok('noLocalDarkening', null, await G(() => !window.__dealer.meet.dimmed));
    await G(() => window.__dealer.meet.arriveAll()); await sleep(600);
    const sp = await G(() => window.__dealer.meet.spawned); ok('npcCap', sp.cars + sp.people, touch ? sp.cars + sp.people <= 12 : sp.cars + sp.people <= 16);
    const mt = await G(() => window.__dealer.meet.tracks()); R.meetTracks = mt.map(t => t.id).join(',');
    ok('meetTrackList', null, ids.every(i => mt.some(t => t.id === i)) && mt.some(t => t.id === 't-pumpkin' && t.src === 'saved') && !mt.some(t => /^q-|^meet-/.test(t.id)));
    const npc = await G(() => window.__dealer.meet.cars()[0]);
    await releaseStick();
    await G(n => { window.__app.joy.x = window.__app.joy.y = 0; window.__app.surface.debugMove(n.x, n.z + (n.z > window.__dealer.spots.meet.z ? -5.5 : 5.5), 0); window.__race.setCarSpeed?.(0); }, npc);
    ok('meetRaceCtx', null, await ctxShown('Race'));
    await tap('#dlrCtxBtn'); ok('challengeSheet', null, await sheetIs('challenge'));
    ok('trackChips', null, await G(() => ['drag', 'mars-st-junction', 'mars-st-beltway', 't-pumpkin'].every(i => document.querySelector(`[data-mtrack="${i}"]`))));
    await tap('[data-mtrack="mars-st-junction"]'); ok('circuitPicked', null, await wait(() => document.querySelector('[data-mtrack="mars-st-junction"]')?.classList.contains('on') && /Junction Ring: 3 laps/.test(document.getElementById('dlrSheet').innerText), 3000));
    await tap('[data-wager="100"]'); ok('wagerPicked', null, await G(() => document.querySelector('[data-wager="100"]').classList.contains('on') && document.querySelector('[data-mtrack="mars-st-junction"]').classList.contains('on')));
    const purse = await G(() => window.__dealer.meet.circuitDef(0, 'mars-st-junction', 100)?.purse); R.purse = purse;
    await sleep(400); await shot('meet-circuit-sheet');
    const cd0 = await credits(); await tap('[data-drag="1"]');
    ok('circuitStarts', null, await wait(() => window.__race.state?.id === 'meet-c-mars-st-junction' && window.__race.state.phase === 'grid', 6000));
    ok('wagerEscrowed', null, cd0 - (await credits()) === 100);
    { const d = await G(() => window.__dealer.meet.drag), names = await G(() => window.__dealer.meet.cars().map(c => c.name)); ok('rivalIsMeetCar', `${d?.name} (near ${npc.name})`, !!d?.circuit && names.includes(d.name)); }
    await releaseStick();
    await G(() => window.__race.skipCountdown()); ok('circuitGo', null, await wait(() => window.__race.state?.phase === 'run', 6000));
    await G(() => { window.__mtGates = () => null; });
    // the meet def is not in __race.tracks(): read its gates from the live state via the meet's def
    await G(() => { const d = window.__dealer.meet.circuitDef(0, 'mars-st-junction', 100); window.__mtDefGates = d.gates; window.__mtGates = () => { const s = window.__race.state, n = d.gates.length, g = d.gates[s.next], a = d.gates[(s.next - 1 + n) % n], b = d.gates[(s.next + 1) % n]; return { x: g.x, z: g.z, yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)) }; }; });
    await sleep(300); await shot('meet-circuit-race');
    const cpre = await credits(); R.circuitRan = await runRace('meet-c-mars-st-junction', 360000); R.circuitEnd = await G(() => JSON.stringify({ st: window.__race.state && { id: window.__race.state.id, ph: window.__race.state.phase, next: window.__race.state.next, lap: window.__race.state.lap }, drag: window.__dealer.meet.drag, last: window.__dealer.meet.last, res: !!window.__race.result }));
    const res = await G(() => window.__race.result); R.circuitResult = JSON.stringify({ won: res?.won, cr: res?.credits, laps: res?.laps?.length, t: res?.time });
    ok('circuitWon', null, res?.id === 'meet-c-mars-st-junction' && res.done && res.won && res.laps.length === 3);
    ok('circuitPayout', res?.credits, res?.credits === purse + 40 + 100);
    ok('creditsPaid', (await credits()) - cpre, (await credits()) - cpre === res.credits - 20 || (await credits()) - cpre === res.credits);
    ok('circuitSettled', null, await wait(() => window.__dealer.meet.last?.circuit && window.__dealer.meet.last.won && window.__dealer.meet.last.rep >= 8 + 4 && window.__dealer.garage.wins === 1, 5000));
    ok('rematchHidden', null, await G(() => { const b = document.getElementById('raceAgain'); return !b || getComputedStyle(b).display === 'none'; }));
    ok('meetCarBack', null, await G(() => !window.__dealer.meet.drag));
    // drags still work from the same sheet (the old path)
    ok('dragStillDefault', null, await G(() => { const d = window.__dealer.meet.circuitDef(0, 'nope', 0); return d === null; }));
    // ---------- 7. leaving ----------
    await G(() => window.__app.takeOff?.()); await wait(() => !window.__app.state.onSurface, 15000); await sleep(1200);
    ok('cleanOnTakeoff', null, await G(() => !document.getElementById('dlrSheet') && document.getElementById('raceCtxBtn')?.style.display !== 'block'));
    R.held = held; if (touch) ok('tapsWithStickHeld', `${R.stickHeld}/${held}`, (R.stickHeld || 0) >= held * 0.8);
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  ok('noErrors', errors.slice(0, 5).join(' | ') || null, errors.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
