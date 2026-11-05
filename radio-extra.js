// Mars radio, part 2: PIT 66.6 (metalcore / deathcore / hardcore), DUST 98.3 (red-dirt outlaw country) and MY MUSIC
// (play audio files from your own phone or computer). Registered through SSX.audio.registerStation (mars-audio.js), so
// they sit after the existing stations and the save keeps them by id (settings.radioId).
// MY MUSIC never uploads anything: picked files are played locally from blob: URLs through the Music bus (so the Music,
// Master and Mute controls apply), and they're forgotten when the page closes. Only the station choice is saved.
// Core touch points: ONE dynamic import in index.html (initRadioExtra(window.__app, { au7, ctx })) plus the generated
// import-map entries (python3 tools/importmap.py), and one precache line in sw.js.
import { STATIONS } from './audio7.js';
import { rememberStation } from './radio.js';
import { babble } from './synth.js';
import { PIT_STATION } from './pit.js';
import { DUST_STATION } from './dust.js';
import { createNightMix } from './night.js';

export const MINE_STATION = { id: 'mine', name: 'MY MUSIC', tag: 'Your own files', dj: [] };
export const EXTRA_STATIONS = [PIT_STATION, DUST_STATION, MINE_STATION];
export const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|caf|aiff?)$/i;
export const isAudioFile = f => !!f && (/^audio\//.test(f.type || '') || AUDIO_EXT.test(f.name || ''));
// Shuffle order for picked files; a refill never starts with the song that just played
export function shuffleOrder(n, last = -1, r = Math.random) {
  const o = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  if (n > 1 && o[0] === last) [o[0], o[n - 1]] = [o[n - 1], o[0]];
  return o;
}
export const prettyName = n => String(n || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').slice(0, 48);

function silentWav() { // 50 ms of silence, used to unlock the <audio> element inside the Pick tap (iOS)
  const n = 400, b = new Uint8Array(44 + n * 2), v = new DataView(b.buffer), w = (o, s) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  let s = ''; b.forEach(c => (s += String.fromCharCode(c))); return 'data:audio/wav;base64,' + btoa(s);
}

export function initRadioExtra(app, { au7, ctx } = {}) {
  if (!app || app.radioExtra) return app?.radioExtra;
  let tries = 0;
  const go = () => { if (app.marsAudio) return setup(app, au7, ctx); if (++tries < 150) setTimeout(go, 200); };
  go();
}

function setup(app, au7, ctx) {
  const ma = app.marsAudio, idx = {};
  for (const st of EXTRA_STATIONS) idx[st.id] = ma.registerStation(st);
  const S = id => STATIONS[idx[id]];
  const settings = () => { try { return app.game?.progress?.settings || null; } catch (e) { return null; } };
  const save = () => { try { app.game?.save?.(); } catch (e) { /* */ } };
  const tap = (el, fn) => { (window.__onTap || ((e, f) => e.addEventListener('click', f)))(el, fn); ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation())); };
  const driving = () => !!(app.state?.onSurface && app.surface?.info?.driving);
  const tunedId = () => STATIONS[au7?.stationIndex]?.id || null;

  // ---------- small caption (reuses the radio ticker, top-left, off the screen centre) ----------
  let tickTimer = 0;
  function caption(head, text, ms = 5000) {
    const tk = document.getElementById('ssxTicker'); if (!tk) return;
    tk.innerHTML = ''; const b = document.createElement('b'); b.textContent = '📻 ' + head; tk.append(b, ' ' + text); tk.classList.add('on');
    const txt = tk.textContent; clearTimeout(tickTimer); tickTimer = setTimeout(() => { if (tk.textContent === txt) tk.classList.remove('on'); }, ms);
  }
  // ---------- between-song DJ station IDs for PIT / DUST (spoken bit only between tracks, music is instrumental) ----------
  const ids = { pit: ['PIT 66.6. Heavy shit only.', 'You\u2019re in the PIT. 66.6.', 'PIT 66.6. Stay low, hit hard.'], dust: ['DUST 98.3, red dirt radio.', 'You\u2019re riding with DUST 98.3.', 'DUST 98.3. Out here on the frontier.'] };
  const nowPlaying = {};
  for (const id of ['pit', 'dust']) {
    S(id).onTrack = (tr, st) => {
      nowPlaying[id] = tr.title; const line = ids[id][Math.floor(Math.random() * ids[id].length)];
      // deferred: the first song starts inside radio.play(), just before mars-audio clears the ticker for a new station
      setTimeout(() => { if (tunedId() !== id || !driving()) return;
      caption(st.name, `${line} Next up: \u201C${tr.title}\u201D`, 5500);
      const a = ctx?.(); if (a && a.state === 'running') { try { babble(a, a.__ssxMusic || a.destination, a.currentTime + 0.05, { pitch: id === 'pit' ? 96 : 125, syll: 7, rate: 6, vol: 0.05, angry: id === 'pit', lp: 2600 }); } catch (e) { /* */ } }
      }, 250);
    };
  }

  // ---------- MY MUSIC ----------
  const el = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', ''); el.crossOrigin = 'anonymous';
  let files = [], order = [], pos = 0, routed = false, srcIsFile = false, blocked = false, hinted = false, errors = 0, dead = false, curName = '';
  const SILENT = silentWav();
  function route() {
    if (routed) return; const a = ctx?.(); if (!a) return;
    try { const src = a.createMediaElementSource(el), g = a.createGain(); g.gain.value = 0.9; src.connect(g).connect(a.__ssxMusic || a.destination); routed = true; } catch (e) { routed = 'no'; }
  }
  function load(i) {
    if (!files.length) return; pos = i; const f = files[order[pos]]; srcIsFile = true; curName = f.name; el.src = f.url;
  }
  function play() {
    if (!files.length) return; route(); if (!srcIsFile) load(pos);
    const p = el.play(); if (p?.then) p.then(() => { blocked = false; errors = 0; }).catch(e => { if (e?.name === 'NotAllowedError') { blocked = true; caption('MY MUSIC', 'Tap \u23ED Next song in \u2630 \u2192 \uD83D\uDD0A to start.', 4000); } });
  }
  const log = [];
  function next(user, why = user ? 'user' : 'auto') {
    if (!files.length) return; log.push(why); if (log.length > 12) log.shift();
    if (pos + 1 >= order.length) { order = shuffleOrder(files.length, order[pos]); pos = -1; }
    load(pos + 1); if (user) blocked = false;
    if (wantMine()) { play(); caption('MY MUSIC', '\u266B ' + prettyName(curName), 3500); }
    render();
  }
  el.addEventListener('ended', () => { if (srcIsFile) next(false, 'ended'); });
  el.addEventListener('error', () => { if (!srcIsFile || !files.length) return; if (++errors < files.length) next(false, 'error'); else { caption('MY MUSIC', 'Couldn\u2019t play those files on this device.', 4000); dead = true; srcIsFile = false; el.removeAttribute('src'); } });
  const wantMine = () => driving() && !!au7?.playing && !au7?.venue && tunedId() === 'mine';
  const input = document.createElement('input'); input.type = 'file'; input.id = 'mineFile'; input.accept = 'audio/*'; input.multiple = true;
  input.setAttribute('aria-label', 'Pick music files'); input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
  document.body.appendChild(input);
  function pickFiles() {
    try { if (!srcIsFile) { el.src = SILENT; route(); el.play()?.catch?.(() => {}); } } catch (e) { /* unlock is best-effort */ }
    input.click();
  }
  input.addEventListener('change', () => {
    const list = Array.from(input.files || []).filter(isAudioFile); input.value = '';
    if (!list.length) { caption('MY MUSIC', 'No audio files picked.', 3000); render(); return; }
    files.forEach(f => URL.revokeObjectURL(f.url));
    files = list.map(f => ({ name: f.name, url: URL.createObjectURL(f) })); order = shuffleOrder(files.length); errors = 0; dead = false; blocked = false; srcIsFile = false; load(0);
    const s = settings();
    if (driving()) { if (tunedId() !== 'mine') au7.setStation(idx.mine, true); if (s && rememberStation(s, STATIONS, idx.mine)) save(); play(); caption('MY MUSIC', '\u266B ' + prettyName(curName), 3500); }
    else { if (s && rememberStation(s, STATIONS, idx.mine)) save(); app.toast?.(`\uD83C\uDFB5 ${files.length} song${files.length > 1 ? 's' : ''} ready. MY MUSIC plays on your next drive.`, 2600); }
    render();
  });

  // ---------- panel section (☰ → 🔊 Sound & radio) ----------
  const css = document.createElement('style');
  css.textContent = `
    #sndPanel #mineBox { margin-top: 8px; padding: 8px; border-radius: 10px; background: #000; border: 2px solid #fff; color: #fff; }
    #sndPanel #mineBox .t { font-weight: 800; font-size: 13px; } #sndPanel #mineBox .s { font-size: 11px; margin: 2px 0 6px; color: #fff; }
    #sndPanel #mineBox .r { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    #sndPanel #mineBox button { background: #fff; color: #000; border: 2px solid #fff; font-weight: 800; }
    #sndPanel #mineBox button:disabled { background: #000; color: #fff; opacity: .55; }
    #sndPanel #mineNow { font-size: 11.5px; margin-top: 6px; min-height: 1.3em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #sndStations button[data-id="pit"], #sndStations button[data-id="dust"], #sndStations button[data-id="mine"] { background: #000; border: 2px solid #fff; color: #fff; }
    #sndStations button[data-id="pit"].cur, #sndStations button[data-id="dust"].cur, #sndStations button[data-id="mine"].cur { background: #fff; color: #000; border-color: #fff; }`;
  document.head.appendChild(css);
  const panel = document.getElementById('sndPanel'), box = document.createElement('div'); box.id = 'mineBox';
  box.innerHTML = `<div class="t">\uD83C\uDFB5 MY MUSIC</div><div class="s">Plays songs from this device. Nothing is uploaded; files are forgotten when you close the game.</div>
    <div class="r"><button id="minePick">\uD83D\uDCC1 Pick files</button><button id="mineNext">\u23ED Next song</button></div><div id="mineNow" aria-live="polite"></div>`;
  panel?.appendChild(box);
  if (panel) {
    tap(box.querySelector('#minePick'), pickFiles);
    tap(box.querySelector('#mineNext'), () => { if (!files.length) return pickFiles(); next(true); });
    // tapping the MY MUSIC station with no files yet opens the picker in the same tap (delegated: the list is rebuilt)
    const stWrap = panel.querySelector('#sndStations'); let lastT = 0;
    const onStation = e => { const b = e.target.closest?.('button[data-id="mine"]'); if (!b || files.length) return; if (e.type === 'click' && performance.now() - lastT < 700) return; if (e.type === 'pointerup') { if (e.pointerType === 'mouse') return; lastT = performance.now(); } pickFiles(); };
    stWrap?.addEventListener('pointerup', onStation, true); stWrap?.addEventListener('click', onStation, true);
  }
  function render() {
    if (!panel?.classList.contains('show')) return;
    const n = box.querySelector('#mineNow'), nx = box.querySelector('#mineNext');
    n.textContent = files.length ? `${wantMine() && !el.paused ? '\u25B6' : '\u23F8'} ${prettyName(curName)} \u00B7 ${files.length} song${files.length > 1 ? 's' : ''}` : 'No files picked yet.';
    nx.disabled = !files.length;
  }
  setInterval(render, 700);

  // ---------- main loop: MY MUSIC follows the car radio (on/off, station, venue) and the mixer ----------
  setInterval(() => {
    const want = wantMine();
    if (want && files.length) { if (el.paused && !blocked && !dead) play(); }
    else if (!el.paused) el.pause();
    if (want && !files.length && !hinted) { hinted = true; caption('MY MUSIC', 'No songs yet: \u2630 \u2192 \uD83D\uDD0A Sound & radio \u2192 Pick files.', 4500); }
    if (!want) hinted = false;
    if (routed !== true) { const m = ma.mix.get(); el.volume = m.mute ? 0 : Math.max(0, Math.min(1, m.master * m.music)); }
  }, 150);

  // seedier district soundscapes at night, only when a day/night clock (SSX.time.isNight) exists
  const night = createNightMix(app, ctx); let lastNight = null;
  setInterval(() => { try { const e = night.tick(1); if (e) lastNight = e; } catch (e) { /* */ } }, 1000);

  const api = {
    stationIds: EXTRA_STATIONS.map(s => s.id), index: id => idx[id], pick: pickFiles, next: () => next(true),
    get state() { return { night: lastNight, log: log.slice(), files: files.length, playing: !el.paused && srcIsFile, current: srcIsFile ? curName : null, routed, blocked, time: el.currentTime, pos, order: order.slice(), nowPlaying: { ...nowPlaying }, pit: S('pit').nowPlaying || null, dust: S('dust').nowPlaying || null }; }
  };
  app.radioExtra = api; if (window.SSX) window.SSX.radioExtra = api;
  return api;
}
