// v7.5.37 One shared WebAudio context for the whole game (iOS/WebKit sound fix).
// iOS Safari / Chrome iOS (WebKit) only lets a context start inside a real user gesture (touchend / pointerup / click /
// keydown, NOT pointerdown/touchstart), caps how many contexts a page may hold, and mutes WebAudio with the ring/silent
// switch unless the page's audio session is 'playback'. Every module now asks getAudioCtx() for the same context, and
// any stray `new AudioContext()` is folded into it too (constructor guard), so one tap wakes all game sound.
const NativeAC = typeof window !== 'undefined' ? (window.__ssxNativeAC || window.AudioContext || window.webkitAudioContext) : null;
let ctx = null, created = 0, unlocked = false, kicked = false, silentEl = null;
const stats = { gestures: 0, resumes: 0, session: null, htmlKeepAlive: false };
const isIOS = () => { try { return /iP(hone|ad|od)/.test(navigator.platform) || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1) || /iPhone|iPad|iPod/.test(navigator.userAgent); } catch (e) { return false; } };

// iOS 17+: 'playback' = play through the ring/silent switch like a game or video app does
function session() {
  try { const s = navigator.audioSession; if (s) { if (s.type !== 'playback') s.type = 'playback'; stats.session = s.type; return true; } } catch (e) { /* */ }
  return false;
}
// older iOS / WebViews without navigator.audioSession: a playing (silent) <audio> element flips the session to playback
function silentWav() {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  let s = ''; for (const x of b) s += String.fromCharCode(x); return 'data:audio/wav;base64,' + btoa(s);
}
function keepAlive() {
  if (session() || !isIOS() || window.__ssxNoKeepAlive) return; // tests: headless Linux WebKit's media stack can't play it
  try {
    if (!silentEl) { silentEl = document.createElement('audio'); silentEl.setAttribute('playsinline', ''); silentEl.setAttribute('x-webkit-airplay', 'deny'); silentEl.loop = true; silentEl.preload = 'auto'; silentEl.src = silentWav(); }
    if (silentEl.paused && !document.hidden) silentEl.play()?.then?.(() => { stats.htmlKeepAlive = true; })?.catch?.(() => {});
  } catch (e) { /* */ }
}

export function getAudioCtx() {
  if (ctx) return ctx;
  if (!NativeAC) return null;
  session();
  try { ctx = new NativeAC(); created++; } catch (e) { ctx = null; return null; }
  ctx.__ssxRealDest = ctx.destination; // before mars-audio shadows .destination with its master gain
  try { ctx.addEventListener('statechange', () => { if (ctx.state === 'running') unlocked = true; }); } catch (e) { /* */ }
  return ctx;
}
// the real speakers, for modules that already apply the game mix themselves (avoids master applied twice)
export const realDest = a => (a && a.__ssxRealDest) || a?.destination;

export function resumeAudio() {
  const a = getAudioCtx(); if (!a) return null;
  if (a.state !== 'running' && a.state !== 'closed') { stats.resumes++; try { a.resume()?.catch?.(() => {}); } catch (e) { /* */ } }
  return a;
}
// call inside a user gesture: session -> resume -> 1-sample silent buffer (the classic iOS unlock)
export function unlockAudio() {
  stats.gestures++; session(); keepAlive();
  const a = resumeAudio(); if (!a) return null;
  if (!kicked || a.state !== 'running') {
    try { const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(realDest(a)); s.start(0); kicked = true; } catch (e) { /* */ }
  }
  return a;
}

if (typeof window !== 'undefined' && NativeAC && !window.__ssxAudio) {
  window.__ssxNativeAC = NativeAC;
  // constructor guard: `new AudioContext()` anywhere in the game returns the shared context (WebKit caps contexts per page)
  const Shared = function AudioContext() { return getAudioCtx(); };
  Shared.prototype = NativeAC.prototype;
  try { window.AudioContext = Shared; } catch (e) { /* */ }
  try { if (window.webkitAudioContext) window.webkitAudioContext = Shared; } catch (e) { /* */ }
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown', 'pointerdown']) window.addEventListener(ev, unlockAudio, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { try { silentEl?.pause(); } catch (e) { /* */ } return; }
    resumeAudio(); // allowed when the page already had a gesture; otherwise the next tap does it
  });
  window.addEventListener('pageshow', () => resumeAudio());
  window.__ssxAudio = {
    ctx: getAudioCtx, unlock: unlockAudio, resume: resumeAudio,
    get state() { return { ctx: ctx ? ctx.state : 'none', contexts: created, unlocked: unlocked || ctx?.state === 'running', ...stats }; },
  };
}
