// Mars city ambience (pumpkin/mars-ambience): glue for radio.js (extra car-radio stations), ambience.js (district
// soundscapes) and barks.js (pedestrian speech captions), plus a master / music / ambience mixer with mute.
// Core touch points: ONE dynamic import in index.html (initMarsAudio(window.__app, { au7, audio, ctx })) and ONE
// `a.__ssxMusic || a.destination` in audio7.js so the stock stations follow the music slider.
import { STATIONS } from './audio7.js';
import { districtsOf } from './world.js';
import { MARS_STATIONS, STOCK_DJ, appendStations, resolveStation, rememberStation, addDjLines, createRadio } from './radio.js';
import { AMBIENCE_CONFIG, zonesFrom, mixWeights, createAmbience, PROFILES } from './ambience.js';
import { BARKS, chooseCategory, pickLine, createLimiter, lifeFor, placeCaption } from './barks.js';
import { createVoicePool, babble } from './synth.js';

export const MIX_DEFAULT = { master: 0.9, music: 0.8, amb: 0.8, mute: false };
export function normMix(m) {
  const c = v => (isFinite(+v) ? Math.max(0, Math.min(1, +v)) : null), o = { ...MIX_DEFAULT };
  if (m && typeof m === 'object') { for (const k of ['master', 'music', 'amb']) { const v = c(m[k]); if (v !== null) o[k] = v; } o.mute = !!m.mute; }
  return o;
}
const SHOTS = new Set(['zap', 'plasma', 'shotgun', 'rail', 'rocket', 'emp', 'boom']);
const MIX_KEY = 'ssx.mix.v1';

function tapArray(arr, fn) { // observe pushes to an existing log array without changing who owns it
  if (!Array.isArray(arr) || arr.__ssxTap) return; const orig = arr.push;
  Object.defineProperty(arr, '__ssxTap', { value: true }); Object.defineProperty(arr, 'push', { configurable: true, writable: true, value: function (...xs) { const r = orig.apply(this, xs); for (const x of xs) { try { fn(x); } catch (e) { /* */ } } return r; } });
}

export function initMarsAudio(app, { au7, audio, ctx } = {}) {
  if (!app || app.marsAudio) return app?.marsAudio;
  const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || innerWidth < 800;
  const voices = createVoicePool(phone ? 5 : 9);
  const settings = () => { try { return app.game?.progress?.settings || null; } catch (e) { return null; } };
  const save = () => { try { app.game?.save?.(); } catch (e) { /* */ } };
  let mix = normMix(settings()?.mix || (() => { try { return JSON.parse(localStorage.getItem(MIX_KEY)); } catch (e) { return null; } })());

  // ---------- mixer: master -> real destination; music + ambience -> master. The context's destination is shadowed by
  // the master gain, so every existing game sound (audio7 fx, index.html tones) follows Master and Mute too.
  let M = null;
  function wire() {
    const a = ctx?.(); if (!a || M) return M;
    const real = a.destination, master = a.createGain(), music = a.createGain(), amb = a.createGain();
    master.connect(real); music.connect(master); amb.connect(master);
    let shadow = false; try { Object.defineProperty(a, 'destination', { value: master, configurable: true }); shadow = a.destination === master; } catch (e) { /* */ }
    a.__ssxMusic = music; M = { a, real, master, music, amb, shadow }; applyMix(); return M;
  }
  const gctx = () => { const a = ctx?.(); if (a && !M) wire(); return a; };
  function applyMix() {
    if (!M) return; const t = M.a.currentTime;
    M.master.gain.setTargetAtTime(mix.mute ? 0 : mix.master, t, 0.05); M.music.gain.setTargetAtTime(mix.music, t, 0.05); M.amb.gain.setTargetAtTime(mix.amb, t, 0.05);
  }
  function setMix(m) {
    mix = normMix({ ...mix, ...m }); applyMix();
    const s = settings(); if (s) { s.mix = { ...mix }; save(); } try { localStorage.setItem(MIX_KEY, JSON.stringify(mix)); } catch (e) { /* */ }
    renderPanel(); return { ...mix };
  }
  // iOS: unlock inside the first gesture (index.html's own listener also resumes; this one adds a silent buffer + wiring)
  let unlocked = false;
  const unlock = () => {
    const a = audio?.() || ctx?.(); if (!a) return; wire();
    if (!unlocked) { try { const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } catch (e) { /* */ } }
    unlocked = a.state === 'running' || unlocked;
  };
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true, capture: true }));

  // ---------- radio ----------
  const mine = appendStations(STATIONS, MARS_STATIONS);
  for (const [id, lines] of Object.entries(STOCK_DJ)) addDjLines(STATIONS.find(s => s.id === id), lines);
  const ticker = document.createElement('div'); ticker.id = 'ssxTicker'; ticker.setAttribute('aria-live', 'polite'); document.body.appendChild(ticker);
  let tickT = 0;
  const radio = createRadio(gctx, () => (wire(), M.music), { voices, onCaption: (line, st) => { ticker.innerHTML = `<b>📻 ${st.name}</b> ${esc(line)}`; ticker.classList.add('on'); tickT = Math.min(6.5, 2.5 + line.length * 0.06); captions.push(line); } });
  const captions = []; // talk + bark log for tests
  // keep the save's index in step with its station id (mods may register stations in a different order)
  const syncSaved = () => { const s = settings(); if (s && s.radioId) { const i = resolveStation(STATIONS, s); if (s.radio !== i) s.radio = i; } };
  syncSaved();
  let lastIdx = -1, lastSettings = null;

  // ---------- ambience ----------
  const amb = createAmbience(gctx, () => (wire(), M.amb), { voices, maxBeds: phone ? 2 : 3 });
  let zones = zonesFrom([]), zonesT = 0, mixState = { w: Object.fromEntries(PROFILES.map(p => [p, 0])), district: null, top: null }, ajPos = null;
  const zero = Object.fromEntries(PROFILES.map(p => [p, 0]));

  // ---------- barks ----------
  const layer = document.createElement('div'); layer.id = 'ssxBarks'; document.body.appendChild(layer);
  const limiter = createLimiter(), recent = [], since = {}, live = []; let lastPos = null, rideFlash = null;
  const now = () => performance.now() / 1000;
  const mark = k => { since[k] = now(); };
  tapArray(app.gameLog, t => { if (t === 'take') mark('stolen'); else if (t === 'melee') mark('hit'); else if (t === 'wantedLost') mark('lost'); else if (t === 'boom') mark('gun'); });
  tapArray(app.sfx?.(), n => { if (SHOTS.has(n)) mark('gun'); });
  const people = () => { try { return app.surface?.world?.debug?.people?.() || []; } catch (e) { return []; } };
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  function showBark(p, line, cat, { key, blip = true, dist = 0 } = {}) {
    const el = document.createElement('div'); el.className = 'ssxBark' + (/^(gun|hit|stolen|speeding|security\d)$/.test(cat) ? ' hot' : ''); el.textContent = line;
    layer.appendChild(el); const life = lifeFor(line);
    const b = { el, p: { kind: p.kind, name: p.name, x: p.x, z: p.z, i: p.i }, end: now() + life, cat, line, key };
    live.push(b); captions.push(line); if (captions.length > 60) captions.splice(0, 30);
    limiter.mark(now(), key, cat, life);
    const a = M && gctx();
    if (blip && a && dist < 18 && voices.try(0.6)) { try { babble(a, M.amb, a.currentTime, { pitch: p.kind === 'guard' ? 105 : 120 + hash(key) % 110, syll: 3 + (line.length / 14 | 0), rate: 9, vol: 0.05 * (1 - dist / 22), angry: /hot/.test(el.className), lp: 2400 }); } catch (e) { /* */ } }
    follow(); return line;
  }
  function follow() { // stick captions to their speakers; drop expired ones
    const t = now(), cam = app.surface?.camera, info = app.surface?.info, ps = live.length ? people() : [], W = innerWidth, H = innerHeight, placed = [];
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i];
      if (t > b.end || !cam || !info || !app.state?.onSurface) { b.el.remove(); live.splice(i, 1); continue; }
      let q = ps[b.p.i]; if (!q || q.kind !== b.p.kind || Math.hypot(q.x - b.p.x, q.z - b.p.z) > 4) q = ps.filter(o => o.kind === b.p.kind && (!b.p.name || o.name === b.p.name)).sort((u, v) => Math.hypot(u.x - b.p.x, u.z - b.p.z) - Math.hypot(v.x - b.p.x, v.z - b.p.z))[0];
      if (q) { b.p.x = q.x; b.p.z = q.z; }
      const v = new cam.position.constructor(b.p.x, (info.y || 0) + 2.1, b.p.z).project(cam), pos = placeCaption(v.x, v.y, v.z, W, H, placed);
      if (!pos) { b.el.style.opacity = '0'; continue; }
      const hw = (b.w ||= b.el.offsetWidth) / 2 + 8; pos.x = Math.max(hw, Math.min(W - hw, pos.x)); // keep the whole caption on screen
      placed.push(pos); b.el.style.opacity = t > b.end - 0.4 ? '0' : '1'; b.el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%)`;
    }
    if (live.length) requestAnimationFrame(follow);
  }
  function barkTick() {
    const info = app.surface?.info; if (!info || !app.state?.onSurface || info.name !== AMBIENCE_CONFIG.world || info.inside) return;
    const t = now(), sinceAgo = Object.fromEntries(Object.entries(since).map(([k, v]) => [k, t - v]));
    const ps = people().map((p, i) => ({ ...p, i, d: Math.hypot(p.x - info.x, p.z - info.z) })).filter(p => p.d < 32 && (p.kind === 'colonist' || p.kind === 'guard')).sort((a, b) => a.d - b.d);
    const moved = lastPos ? Math.hypot(info.x - lastPos.x, info.z - lastPos.z) : 0; lastPos = { x: info.x, z: info.z };
    if (!info.driving && ps[0] && ps[0].kind === 'colonist' && ps[0].d < 1.4 && moved > 0.12) { mark('bump'); sinceAgo.bump = 0; }
    let flash = 0; try { flash = info.driving ? +(rideFlash?.(info) ?? (info.boosting ? 0.5 : 0)) || 0 : 0; } catch (e) { /* */ }
    const district = mixState.district?.profile; const dmap = { downtown: 'downtown', flats: 'flats', heights: 'heights' };
    for (const p of ps.slice(0, 4)) {
      const cat = chooseCategory({ since: sinceAgo, wanted: info.wanted | 0, evading: !!info.evading, driving: !!info.driving, speed: info.speed || 0, boosting: !!info.boosting, flash, dog: !!info.dog && (info.dog.dist ?? 99) < 8, district: dmap[district] || null, kind: p.kind, dist: p.d });
      if (!cat) continue; const key = `${p.kind}:${p.name || p.i}`;
      if (!limiter.can(t, key, cat)) continue;
      const line = pickLine(cat, recent); if (line) { showBark(p, line, cat, { key, dist: p.d }); break; }
    }
  }

  // ---------- main loop (10 Hz logic; captions follow per frame only while visible) ----------
  let lastT = performance.now();
  const loop = () => {
    const nowMs = performance.now(), dt = Math.min(0.5, (nowMs - lastT) / 1000); lastT = nowMs;
    try { step(dt); } catch (e) { if (!loop.warned) { loop.warned = true; console.warn('mars-audio', e); } }
  };
  let barkAcc = 0;
  function step(dt) {
    const a = ctx?.(); if (a && !M) wire();
    const st = app.state, info = st?.onSurface ? app.surface?.info : null, s = settings();
    if (s && s !== lastSettings) { lastSettings = s; syncSaved(); if (s.mix) { mix = normMix(s.mix); applyMix(); } }
    // radio: our stations play while audio7's radio is on, in a vehicle, outside venues
    const idx = au7?.stationIndex ?? -1, S = STATIONS[idx];
    if (info?.driving && idx !== lastIdx && idx >= 0) { if (lastIdx >= 0 && s && rememberStation(s, STATIONS, idx)) save(); lastIdx = idx; }
    if (!info?.driving) lastIdx = -1;
    const want = info?.driving && au7?.playing && !au7?.venue && S && typeof S.step === 'function' ? S : null;
    if (want !== radio.station) { radio.play(want); if (!want || !want.talk) ticker.classList.remove('on'); }
    radio.tick(dt);
    if (tickT > 0) { tickT -= dt; if (tickT <= 0 || !want) ticker.classList.remove('on'); }
    // ambience
    zonesT -= dt; if (zonesT <= 0) { zonesT = 2; try { zones = zonesFrom(districtsOf(AMBIENCE_CONFIG.world)); } catch (e) { zones = zonesFrom([]); } }
    const col = info && info.name === AMBIENCE_CONFIG.world ? app.surface?.world?.colony : null;
    if (col && a) { ajPos = { x: info.x - col.x, z: info.z - col.z }; mixState = mixWeights(ajPos.x, ajPos.z, zones); amb.update(dt, mixState.w, { driving: !!info.driving, speed: info.speed || 0, indoors: !!info.inside }); }
    else { ajPos = null; mixState = { w: zero, district: null, top: null }; if (a) amb.update(dt, zero); }
    barkAcc += dt; if (barkAcc > 0.16) { barkAcc = 0; barkTick(); }
  }
  setInterval(loop, 100);

  // ---------- UI: ☰ → 🔊 Sound & radio ----------
  const css = document.createElement('style');
  css.textContent = `
    #ssxBarks { position: fixed; inset: 0; pointer-events: none; z-index: 6; overflow: hidden; }
    .ssxBark { position: absolute; left: 0; top: 0; max-width: min(46vw, 220px); padding: 3px 7px; border-radius: 9px; font: 600 11px/1.25 system-ui, -apple-system, sans-serif; color: #fff;
      background: rgba(8,10,20,0.72); border: 1px solid rgba(255,255,255,0.22); text-shadow: 0 1px 2px #000; transition: opacity .3s; will-change: transform; white-space: normal; }
    .ssxBark::after { content: ''; position: absolute; left: 50%; bottom: -5px; margin-left: -4px; border: 4px solid transparent; border-top-color: rgba(8,10,20,0.72); border-bottom: 0; }
    .ssxBark.hot { border-color: rgba(255,90,70,0.7); }
    #ssxTicker { position: fixed; z-index: 7; left: calc(8px + var(--sal, 0px)); top: calc(58px + var(--sat, 0px)); max-width: min(62vw, 360px); display: none; padding: 4px 8px; border-radius: 9px;
      font: 600 11px/1.3 system-ui, -apple-system, sans-serif; color: #fff; background: rgba(60,20,90,0.72); border: 1px solid rgba(200,140,255,0.4); pointer-events: none; }
    #ssxTicker b { color: #e0b0ff; margin-right: 4px; } #ssxTicker.on { display: block; } body:not(.driving) #ssxTicker { display: none; } body.hidehud #ssxTicker { display: none; }
    #sndPanel { position: fixed; z-index: 13; top: calc(60px + var(--sat, 0px)); right: calc(8px + var(--sar, 0px)); width: min(330px, calc(100vw - 16px)); max-height: calc(100vh - 150px - var(--sat, 0px) - var(--sab, 0px));
      overflow-y: auto; box-sizing: border-box; display: none; padding: 8px; border-radius: 12px; background: rgba(10,14,30,0.94); border: 1px solid rgba(120,160,255,0.35); color: #fff; font: 13px system-ui, -apple-system, sans-serif; touch-action: manipulation; }
    #sndPanel.show { display: block; } #sndPanel .hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; } #sndPanel .hd b { font-size: 14px; }
    #sndPanel button { min-height: 44px; border-radius: 10px; font-weight: 700; font-size: 12.5px; background: rgba(40,56,96,0.95); color: #fff; border: 1px solid rgba(120,160,255,0.35); padding: 4px 8px; }
    #sndPanel .row { display: flex; align-items: center; gap: 8px; min-height: 40px; } #sndPanel .row span { flex: 0 0 74px; font-weight: 600; } #sndPanel .row output { flex: 0 0 30px; text-align: right; font-variant-numeric: tabular-nums; opacity: .8; }
    #sndPanel input[type=range] { flex: 1 1 auto; height: 32px; accent-color: #b070ff; touch-action: pan-x; }
    #sndPanel .sts { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 4px; } #sndPanel .sts button { text-align: left; line-height: 1.15; }
    #sndPanel .sts button small { display: block; font-weight: 500; opacity: .75; font-size: 10.5px; } #sndPanel .sts button.cur { background: rgba(120,40,160,0.95); border-color: #e0b0ff; }
    #sndPanel .note { font-size: 11px; opacity: .75; margin: 6px 0 2px; } #sndMute.on { background: rgba(160,30,40,0.95); }`;
  document.head.appendChild(css);
  const panel = document.createElement('div'); panel.id = 'sndPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Sound and radio');
  panel.innerHTML = `<div class="hd"><b>🔊 Sound &amp; radio</b><button id="sndClose" aria-label="Close">✖</button></div>
    <button id="sndMute" style="width:100%"></button>
    ${[['master', 'Master'], ['music', 'Music'], ['amb', 'Ambience']].map(([k, l]) => `<label class="row"><span>${l}</span><input type="range" id="snd_${k}" min="0" max="100" step="5" aria-label="${l} volume"><output id="snd_${k}_v"></output></label>`).join('')}
    <div class="note" id="sndNote"></div><div class="sts" id="sndStations"></div>`;
  document.body.appendChild(panel);
  // Every button here: pointerdown -> pointerup with the SAME pointerId (a thumb resting on the joystick can't eat the tap),
  // plus a mouse click fallback that ignores the click a touch generates. Never plain onclick.
  const onTap = (el, fn) => {
    let pid = null, last = 0;
    el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; pid = e.pointerId; e.preventDefault(); e.stopPropagation(); });
    el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' || e.pointerId !== pid) return; pid = null; e.preventDefault(); e.stopPropagation(); last = performance.now(); fn(e); });
    el.addEventListener('pointercancel', e => { if (e.pointerId === pid) pid = null; });
    el.addEventListener('click', e => { if (performance.now() - last < 700) return; fn(e); });
  };
  onTap(panel.querySelector('#sndClose'), () => panel.classList.remove('show'));
  onTap(panel.querySelector('#sndMute'), () => setMix({ mute: !mix.mute }));
  for (const k of ['master', 'music', 'amb']) {
    const r = panel.querySelector('#snd_' + k); r.addEventListener('input', () => setMix({ [k]: r.value / 100 }));
    r.addEventListener('keydown', e => e.stopPropagation()); // arrow keys adjust the slider, not the rover
    ['pointerdown', 'pointermove', 'pointerup'].forEach(ev => r.addEventListener(ev, e => e.stopPropagation()));
  }
  const stWrap = panel.querySelector('#sndStations');
  function tune(i) {
    const s = settings(), S = STATIONS[i]; if (!S) return;
    if (app.surface?.info?.driving) { au7.setStation(i, true); app.toast?.(S.id === 'off' ? '📻 Radio off' : `📻 ${S.name} · ${S.tag}`, 2200); }
    else app.toast?.(`📻 ${S.name}${S.id === 'off' ? '' : ' is set for your next drive'}.`, 2200);
    if (s && rememberStation(s, STATIONS, i)) save(); lastIdx = i; renderPanel();
  }
  let builtFor = 0;
  function renderPanel() {
    if (!panel.classList.contains('show')) return;
    const m = panel.querySelector('#sndMute'); m.textContent = mix.mute ? '🔇 Muted · tap to unmute' : '🔊 Sound on · tap to mute'; m.classList.toggle('on', mix.mute); m.setAttribute('aria-pressed', String(mix.mute));
    for (const k of ['master', 'music', 'amb']) { const r = panel.querySelector('#snd_' + k); if (document.activeElement !== r) r.value = Math.round(mix[k] * 100); panel.querySelector(`#snd_${k}_v`).textContent = Math.round(mix[k] * 100); }
    const driving = !!app.surface?.info?.driving, s = settings(), cur = driving ? au7.stationIndex : resolveStation(STATIONS, s || {});
    panel.querySelector('#sndNote').textContent = driving ? '📻 Stations' : '📻 Radio plays in vehicles. Pick one for your next drive:';
    if (builtFor !== STATIONS.length) {
      builtFor = STATIONS.length; stWrap.innerHTML = '';
      STATIONS.forEach((S, i) => { const b = document.createElement('button'); b.dataset.i = i; b.dataset.id = S.id; b.innerHTML = `${esc(S.name)}<small>${esc(S.tag || 'Silence')}</small>`; onTap(b, () => tune(i)); stWrap.appendChild(b); });
    }
    stWrap.querySelectorAll('button').forEach(b => b.classList.toggle('cur', +b.dataset.i === cur));
  }
  function openPanel() { panel.classList.add('show'); renderPanel(); }
  try { app.registerMenuItem?.({ id: 'rmSound', label: '🔊 Sound & radio', onTap: openPanel }); } catch (e) { /* */ }
  setInterval(() => { if (panel.classList.contains('show')) renderPanel(); }, 700);

  // ---------- public API ----------
  const api = {
    registerStation(def) { const [i] = appendStations(STATIONS, [def]); builtFor = 0; renderPanel(); return i; },
    addDjLines(id, lines) { addDjLines(STATIONS.find(s => s.id === id), lines); },
    stations: () => STATIONS.map((s, i) => ({ i, id: s.id, name: s.name, tag: s.tag, procedural: typeof s.step === 'function' })),
    // npc: index into world people | name | { x, z, kind? } | null (nearest). what: a BARKS category or literal text.
    // v7.5.3: callers also pass (npc, category, fallbackLine). An unknown category with no line is a key, not text: return
    // null so the caller's own toast/caption runs instead of a caption that reads "activity_complete".
    bark(npc, what = 'street', opts = {}) {
      const line3 = typeof opts === 'string' ? opts : null, { force = false, blip = true } = typeof opts === 'object' && opts ? opts : {};
      if (!BARKS[what]) { if (line3) what = line3; else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(String(what))) return null; }
      const info = app.surface?.info; if (!info || !app.state?.onSurface) return null;
      const ps = people().map((p, i) => ({ ...p, i }));
      let p = typeof npc === 'number' ? ps[npc] : typeof npc === 'string' ? ps.find(q => q.name === npc) : npc && isFinite(npc.x) ? { kind: npc.kind || 'colonist', name: npc.name, x: npc.x, z: npc.z, i: -1 } : null;
      if (!p) p = ps.sort((a, b) => Math.hypot(a.x - info.x, a.z - info.z) - Math.hypot(b.x - info.x, b.z - info.z))[0];
      if (!p) return null; const key = `${p.kind}:${p.name || p.i}`, t = now();
      const line = BARKS[what] ? pickLine(what, recent) : String(what).slice(0, 90);
      if (!force && !limiter.can(t, key, BARKS[what] ? what : 'street')) return null;
      return showBark(p, line, BARKS[what] ? what : 'custom', { key, blip, dist: Math.hypot(p.x - info.x, p.z - info.z) });
    },
    registerBarks(cat, lines) { if (!cat || !Array.isArray(lines)) throw new Error('registerBarks(category, [lines])'); (BARKS[cat] ||= []).push(...lines.map(l => String(l).slice(0, 90))); return BARKS[cat].length; },
    setRideFlash(fn) { rideFlash = typeof fn === 'function' ? fn : null; }, // garage/dealership: () => 0..1 "how flashy is this ride"
    registerSoundscape(id, def) { AMBIENCE_CONFIG.zones = AMBIENCE_CONFIG.zones.filter(z => z.id !== id).concat([{ id, name: def.name || id, centre: def.centre, r: def.r || 80, profile: PROFILES.includes(def.profile) ? def.profile : 'junction' }]); zonesT = 0; return id; },
    mix: { get: () => ({ ...mix }), set: setMix },
    open: openPanel, close: () => panel.classList.remove('show'),
    get state() { return { wired: !!M, shadow: !!M?.shadow, ctxState: M?.a.state || ctx?.()?.state || 'none', station: radio.station?.id || null, tuned: STATIONS[au7?.stationIndex]?.id || null, radioOn: !!au7?.playing, talking: radio.speaking, beds: amb.beds, weights: { ...mixState.w }, district: mixState.district?.id || null, aj: ajPos, barks: live.map(b => b.line), voices: voices.active(), zones: zones.map(z => ({ id: z.id, centre: z.centre, r: z.r, registered: !!z.registered })) }; },
    captions, stationIds: mine.map(i => STATIONS[i].id)
  };
  app.marsAudio = api;
  if (window.SSX) Object.assign(window.SSX, { registerStation: api.registerStation, bark: api.bark, registerBarks: api.registerBarks, registerSoundscape: api.registerSoundscape, audio: api });
  return api;
}
function esc(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
