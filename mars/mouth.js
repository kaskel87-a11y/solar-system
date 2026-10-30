// Foul-mouthed Mars locals (Steve). About 1 in 4 colonists in Red Tape Flats and Olympus Row (downtown), picked
// deterministically per NPC, swear at you: a greeting when they spot you on foot (within ~8 m, on screen), an insult when
// you bump them, honk at them (the game had no player horn: a 📯 button while driving on Mars, an 'ssx:horn' event or
// SSX.mouth.honk()) or drive past too close. Existing NPCs only (world people; only live ones under the phone cap of 12
// talk), nothing is spawned. A speech bubble follows the speaker (kept below the top HUD, above the controls); the line
// is spoken with text-to-speech where the browser has it, otherwise Pumpkin's bark babble voice (synth.js babble, as
// mars-audio.js barks), and only while sound is on (Sound & radio not muted, master up, tab visible). The lines are also
// registered as bark categories (SSX.registerBarks 'mouth_greet' / 'mouth_insult') so SSX.bark can use them.
// Per-character cooldowns (25 s greetings, 20 s insults) + global cooldowns (6 s / 2.5 s). Rules: mars/mouthcore.js.
// ?mouth=0 switches the module off, ?mouthtts=0 (or localStorage 'ssx.mouth.tts' = '0') keeps the bubbles but no speech.
// Window API: SSX.mouth = { state(), foul(), honk(), say(i, type), tts(on?) }
import * as M from './mouthcore.js';
import { babble } from '../synth.js';

const TTS_KEY = 'ssx.mouth.tts';
const S = { on: true, foul: new Set(), zones: new Set(), lines: [], said: 0, spoken: 0, last: null, honkAt: -1e9, lastPos: null, acc: 0, scanT: 0, ttsOff: false, unlocked: false, bubbles: 0 };
const cd = M.createCooldowns(), recent = [];
const warned = new Set(); const warnOnce = (k, e) => { if (warned.has(k)) return; warned.add(k); console.warn('[mouth] ' + k, e); };
const now = () => performance.now() / 1000;
const app = () => window.__app;
const q = k => { try { return new URLSearchParams(location.search).get(k); } catch { return null; } };

// ---------- who swears ----------
const liveSig = ps => ps.reduce((a, p, i) => (p.on === false ? a : a + i + ','), '');
function rescan(world) {
  let ds = []; try { ds = world.districts?.() || []; } catch (e) { warnOnce('districts', e); }
  S.zones = new Set(ds.filter(M.isFoulDistrict).map(d => d.id));
  const ps = world.debug?.people?.() || [], byZone = new Map(), live = new Set(); S.keys = [];
  ps.forEach((p, i) => { if (p.kind !== 'colonist' || !S.zones.has(p.zone)) { S.keys[i] = null; return; } const list = byZone.get(p.zone) || []; const key = M.npcKey(p.zone, list.length, p.name); list.push(key); byZone.set(p.zone, list); S.keys[i] = key; if (p.on !== false) live.add(key); });
  S.foul = new Set(); for (const keys of byZone.values()) for (const k of M.pickFoulLive(keys, live)) S.foul.add(k); for (const k of (S.kept ||= new Set())) S.foul.add(k); for (const k of S.foul) S.kept.add(k); // once foul, stays foul this session (the cap wakes NPCs in and out)
  S.count = ps.length; S.sig = liveSig(ps);
}

// ---------- voice ----------
const synth = () => (typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined' ? speechSynthesis : null);
function soundOn() {
  let mix = null; try { mix = window.SSX?.audio?.mix?.get?.() || null; } catch { /* */ }
  return M.ttsAllowed({ mute: !!mix?.mute, master: mix ? +mix.master : 1, hidden: document.hidden, off: S.ttsOff, has: !!synth() });
}
function speak(line, key) {
  const sp = synth(); if (!sp || !soundOn()) return false;
  try {
    if (sp.speaking || sp.pending) return false;
    const u = new SpeechSynthesisUtterance(line.replace(/\bbitch$/i, 'bitch.')), v = M.voiceFor(key);
    u.pitch = v.pitch; u.rate = v.rate; let mix = null; try { mix = window.SSX?.audio?.mix?.get?.(); } catch { /* */ } u.volume = Math.max(0, Math.min(1, mix ? +mix.master : 0.9));
    const en = sp.getVoices?.().filter(x => /^en/i.test(x.lang)) || []; if (en.length) u.voice = en[M.hash(key) % en.length];
    sp.speak(u); S.spoken++; return true;
  } catch (e) { warnOnce('tts', e); return false; }
}
// iOS only lets speech start after a tap: prime it once on the first touch, while sound is on
function unlock() { try { if (hornCtx?.state === 'suspended') hornCtx.resume()?.catch?.(() => {}); } catch { /* */ } if (S.unlocked) return; const sp = synth(); if (!sp || !soundOn()) return; S.unlocked = true; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; sp.speak(u); } catch (e) { warnOnce('unlock', e); } }
// a short two-tone horn (only when sound is on); the horn itself is what we listen for
let hornCtx = null;
function hornSound() {
  let mix = null; try { mix = window.SSX?.audio?.mix?.get?.(); } catch { /* */ } if (mix?.mute || (mix && +mix.master <= 0.01)) return;
  try { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; hornCtx ||= new A(); const a = hornCtx, t = a.currentTime, g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * (mix ? +mix.master : 0.9), t + 0.02); g.gain.setValueAtTime(0.12 * (mix ? +mix.master : 0.9), t + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); g.connect(a.destination);
    for (const f of [392, 494]) { const o = a.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 0.42); } } catch (e) { warnOnce('horn', e); }
}
function honk() { const info = app()?.surface?.info; if (!info?.driving) return false; S.honkAt = now(); hornSound(); return true; }

// the game has no player horn: a small 📯 button, shown only while driving on Mars (left side, above the stick)
let hornBtn = null;
function hornUI(show) {
  if (!hornBtn) {
    if (!show) return;
    hornBtn = document.createElement('button'); hornBtn.id = 'ssxMouthHorn'; hornBtn.type = 'button'; hornBtn.textContent = '📯'; hornBtn.setAttribute('aria-label', 'Horn');
    hornBtn.style.cssText = 'position:fixed;left:calc(18px + env(safe-area-inset-left));bottom:calc(178px + env(safe-area-inset-bottom));width:48px;height:48px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(20,14,10,.62);color:#fff;font-size:22px;line-height:1;padding:0;z-index:30;touch-action:manipulation;-webkit-tap-highlight-color:transparent;display:none';
    const go = e => { e.preventDefault(); e.stopPropagation(); unlock(); honk(); hornBtn.animate?.([{ transform: 'scale(.88)' }, { transform: 'scale(1)' }], 160); };
    hornBtn.addEventListener('pointerdown', go); hornBtn.addEventListener('click', e => e.preventDefault());
    document.body.appendChild(hornBtn);
    const st = document.createElement('style'); st.textContent = 'body:has(#roverMenu.show) #ssxMouthHorn, body.cinematic #ssxMouthHorn { display: none !important; } @media (max-height: 440px) { #ssxMouthHorn { left: calc(140px + env(safe-area-inset-left)) !important; bottom: calc(24px + env(safe-area-inset-bottom)) !important; } }'; document.head.appendChild(st); // even if the tick pauses under the menu
  }
  const want = show && !document.body.classList.contains('cinematic') && !document.querySelector('#roverMenu.show') && !window.SSX?.hudx?.mapOpen?.() ? 'block' : 'none'; // v7.5.6: not over the open ☰ menu or the full map
  if (hornBtn.style.display !== want) hornBtn.style.display = want;
}

// ---------- the bubble ----------
let layer = null; const live = [];
function bubbleLayer() {
  if (layer) return layer;
  layer = document.createElement('div'); layer.id = 'ssxMouth';
  const css = document.createElement('style'); css.textContent = `
    #ssxMouth { position: fixed; inset: 0; pointer-events: none; z-index: 9; overflow: hidden; }
    .ssxMouthBubble { position: absolute; left: 0; top: 0; max-width: min(64vw, 270px); padding: 6px 10px; border-radius: 12px; box-sizing: border-box;
      font: 700 14px/1.25 system-ui, -apple-system, sans-serif; color: #fff; text-align: center; background: rgba(16,10,8,0.86);
      border: 2px solid rgba(255,140,70,0.9); box-shadow: 0 2px 10px rgba(0,0,0,.5); text-shadow: 0 1px 2px #000; transition: opacity .25s; will-change: transform; }
    .ssxMouthBubble::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -7px; border: 7px solid transparent; border-top-color: rgba(255,140,70,0.9); border-bottom: 0; }
    .ssxMouthBubble.insult { border-color: rgba(255,70,60,0.95); } .ssxMouthBubble.insult::after { border-top-color: rgba(255,70,60,0.95); }
    .ssxMouthBubble small { display: block; font: 600 10px/1.2 system-ui, sans-serif; color: rgba(255,210,180,.85); margin-bottom: 1px; }
    body.cinematic #ssxMouth, body.hidehud #ssxMouth { display: none; }`;
  document.head.appendChild(css); document.body.appendChild(layer); return layer;
}
function showBubble(i, p, line, insult) {
  const L = bubbleLayer();
  for (const b of live.filter(b => b.i === i)) b.end = 0; // one bubble per speaker
  const el = document.createElement('div'); el.className = 'ssxMouthBubble' + (insult ? ' insult' : '');
  if (p.name) { const n = document.createElement('small'); n.textContent = p.name; el.appendChild(n); }
  el.appendChild(document.createTextNode(line)); L.appendChild(el);
  live.push({ el, i, x: p.x, z: p.z, end: now() + 2.6 + Math.min(2.2, line.length * 0.04) }); place(); if (!following) { following = true; requestAnimationFrame(follow); }
  S.bubbles++;
}
let following = false;
function follow() { place(); if (live.length) requestAnimationFrame(follow); else following = false; }
function place() { // stick to the speaker; clamp into the band between the top HUD and the thumb controls
  const A = app(), cam = A?.surface?.camera, info = A?.surface?.info, t = now(), W = innerWidth, H = innerHeight;
  let ps = []; try { ps = A?.surface?.world?.debug?.people?.() || []; } catch { /* */ }
  for (let k = live.length - 1; k >= 0; k--) {
    const b = live[k];
    if (t > b.end || !cam || !info || !A.state?.onSurface || info.inside) { b.el.remove(); live.splice(k, 1); continue; }
    const q = ps[b.i]; if (q && Math.hypot(q.x - b.x, q.z - b.z) < 6) { b.x = q.x; b.z = q.z; }
    let v = null; try { v = new cam.position.constructor(b.x, (info.y || 0) + 2.2, b.z).project(cam); } catch { /* */ }
    const w = (b.w ||= b.el.offsetWidth || 160), h = (b.h ||= b.el.offsetHeight || 40);
    let x = v && v.z < 1 ? (v.x + 1) / 2 * W : W / 2, y = v && v.z < 1 ? (1 - v.y) / 2 * H : H * 0.42;
    x = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, x)); y = Math.max(H * 0.29 + h, Math.min(H * 0.64, y));
    for (let o = k + 1; o < live.length; o++) { const c = live[o]; if (c.y !== undefined && Math.abs(c.y - y) < h + 6 && Math.abs(c.x2 - x) < (w + (c.w || w)) / 2) y = c.y - (c.h || h) - 8; } y = Math.max(H * 0.29 + h, y);
    b.x2 = x; b.y = y; b.el.style.opacity = t > b.end - 0.3 ? '0' : '1'; b.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }
}
// no text-to-speech (or it's busy): Pumpkin's bark babble, through the same mute / master rules
function babbleFor(line, key, insult, d) {
  let mix = null; try { mix = window.SSX?.audio?.mix?.get?.(); } catch { /* */ } if (mix?.mute || (mix && +mix.master <= 0.01) || document.hidden) return false;
  try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; hornCtx ||= new AC(); const a = hornCtx; if (a.state !== 'running') { a.resume?.()?.catch?.(() => {}); return false; } // iOS: wakes on the first tap
    const g = a.createGain(); g.gain.value = (mix ? +mix.master : 0.9) * (mix ? +(mix.amb ?? 1) : 1); g.connect(a.destination);
    babble(a, g, a.currentTime, { pitch: 120 + M.hash(key) % 110, syll: 3 + (line.length / 14 | 0), rate: 9, vol: 0.06 * Math.max(0.2, 1 - d / 22), angry: insult, lp: 2400 }); return true; } catch (e) { warnOnce('babble', e); return false; }
}
function say(p, i, type, line) {
  const key = S.keys[i]; line ||= M.pickLine(type, recent); if (!line) return null;
  const insult = M.isInsult(type), info = app()?.surface?.info, d = info ? Math.hypot(p.x - info.x, p.z - info.z) : 0;
  const spoken = speak(line, key); if (!spoken) babbleFor(line, key, insult, d);
  showBubble(i, p, line, insult);
  cd.mark(now(), key, type); S.said++; S.last = { type, line, key, i, name: p.name, spoken, at: Math.round(performance.now()) }; S.lines.push(S.last); if (S.lines.length > 20) S.lines.shift();
  return line;
}

// ---------- the tick ----------
function inView(cam, x, y, z) { try { const v = new cam.position.constructor(x, y, z).project(cam); return v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95; } catch { return false; } }
function tick(dt, tc) {
  if (!S.on) return; S.acc += dt; if (S.acc < 0.1) return; S.acc = 0;
  const A = app(), info = A?.surface?.info, world = tc?.world || A?.surface?.world;
  if (!info || !A.state?.onSurface || info.name !== 'Mars' || info.inside || !world?.debug?.people) { S.lastPos = null; hornUI(false); return; }
  hornUI(!!info.driving);
  const t = now(); const ps0 = world.debug.people(); if ((S.scanT -= 0.1) <= 0 || S.count !== ps0.length || S.sig !== liveSig(ps0)) { S.scanT = 3; rescan(world); }
  const moved = S.lastPos ? Math.hypot(info.x - S.lastPos.x, info.z - S.lastPos.z) : 0; S.lastPos = { x: info.x, z: info.z };
  if (!S.foul.size) return;
  const ps = ps0, cam = tc?.camera || A.surface.camera, honkAgo = t - S.honkAt;
  let best = null;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i], key = S.keys[i]; if (!key || !S.foul.has(key) || p.on === false) continue;
    const d = Math.hypot(p.x - info.x, p.z - info.z); if (d > 16) continue;
    const type = M.trigger({ d, driving: !!info.driving, speed: info.speed || 0, moved, honkAgo, inView: !info.driving && d < M.CFG.greetDist && inView(cam, p.x, (info.y || 0) + 1.5, p.z) });
    if (!type || !cd.can(t, key, type)) continue;
    const score = (M.isInsult(type) ? 0 : 100) + d; if (!best || score < best.score) best = { p, i, type, score };
  }
  if (best) say(best.p, best.i, best.type);
}

// ---------- boot ----------
const API = {
  state: () => ({ on: S.on, foul: [...S.foul], zones: [...S.zones], said: S.said, spoken: S.spoken, bubbles: S.bubbles, last: S.last, lines: S.lines.slice(-8), tts: !S.ttsOff, soundOn: soundOn(), cooldowns: cd.size }),
  foul: () => (S.keys || []).map((k, i) => (k && S.foul.has(k) ? i : -1)).filter(i => i >= 0),
  honk, say: (i, type = 'greet', line) => { const p = app()?.surface?.world?.debug?.people?.()[i]; return p && S.keys?.[i] ? say(p, i, type, line) : null; },
  tts: on => { if (on !== undefined) { S.ttsOff = !on; try { localStorage.setItem(TTS_KEY, on ? '1' : '0'); } catch { /* */ } } return !S.ttsOff; },
  core: M
};
(function boot() {
  const X = window.SSX, A = app();
  if (!X || !A || typeof X.registerSurfaceTick !== 'function') { setTimeout(boot, 250); return; }
  if (X.mouth) return; X.mouth = API;
  if (q('mouth') === '0') { S.on = false; return; }
  try { S.ttsOff = q('mouthtts') === '0' || localStorage.getItem(TTS_KEY) === '0'; } catch { /* */ }
  const reg = () => { try { if (typeof X.registerBarks === 'function') { X.registerBarks('mouth_greet', M.GREET); for (const k of Object.keys(M.INSULT)) X.registerBarks('mouth_insult', M.INSULT[k]); return true; } } catch (e) { warnOnce('registerBarks', e); } return false; };
  if (!reg()) { let n = 0; const iv = setInterval(() => { if (reg() || ++n > 40) clearInterval(iv); }, 500); }
  try { X.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { warnOnce('tick', e); } }); } catch (e) { warnOnce('register', e); }
  addEventListener('pointerdown', unlock, { passive: true, capture: true }); addEventListener('touchend', unlock, { passive: true, capture: true });
  addEventListener('ssx:horn', () => honk());
  setInterval(() => { if (hornBtn && hornBtn.style.display !== 'none') { const A = app(), i = A?.surface?.info; if (!A?.state?.onSurface || !i?.driving || i.name !== 'Mars') hornUI(false); } }, 1000); // the surface tick stops off-planet
})();
