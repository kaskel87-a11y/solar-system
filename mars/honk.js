// v7.5.31 (Collin, Halloween): the Grin Reaper outfit's brass bulb horn. The outfit (mars/skinscore.js 'grinreaper', free) shows
// the horn in the right hand while it is the weapon in hand. The horn itself is an arsenal melee weapon (mars/arsenal.js 'horn',
// core 'ar_horn': weak bonk, little knockback, no blood), so Fire / 👊 / C swing it and Q / the weapon wheel swap it like the knife.
// This module: gives the horn the first time you wear the outfit (and puts it in your hand once), HONKS on every swing, makes
// colonists (world.scare) and street folk (SSX.street.scare) flinch and run, and adds a honk-only taunt: a black 📯 Honk button
// on the HUD (phone + desktop) and Shift+C. The honk is synthesized (WebAudio, no file), respects SSX.audio.mix / mute.
// window.SSX.honk = { honk(kind), taunt(), state(), on(fn) }   window.__honk = test helpers
import * as H from './honkcore.js';
import { noiseBuf } from '../synth.js';

const X = () => window.SSX || {}, app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game;
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const toast = (t, ms = 2600) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } };
const fin = Number.isFinite, subs = new Set();
const stats = { honks: 0, taunts: 0, swings: 0, scared: 0, lastScare: 0, sounds: 0, gave: 0 };
let st = H.fresh(); try { st = H.parse(localStorage.getItem(H.SAVE_KEY)); } catch (e) { /* */ }
const save = () => { try { localStorage.setItem(H.SAVE_KEY, JSON.stringify(st)); } catch (e) { /* */ } };
const emit = (type, d = {}) => { for (const f of subs) { try { f({ type, ...d }); } catch (e) { /* */ } } try { X().emit?.('honk:' + type, d); } catch (e) { /* */ } };

// ---------- sound: synthesized bulb horn ----------
let ac = null, out = null;
function mix() { try { const m = X().audio?.mix?.get?.(); if (m) return m.mute ? 0 : (fin(m.master) ? m.master : 1); } catch (e) { /* */ } try { if (localStorage.getItem('ssx.muted') === '1') return 0; } catch (e) { /* */ } return 1; }
function audio() {
  try {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); out = ac.createGain(); out.connect(ac.destination); }
    if (ac.state === 'suspended') ac.resume?.()?.catch?.(() => {});
    out.gain.value = 0.9 * mix(); return mix() > 0 ? ac : null;
  } catch (e) { return null; }
}
const free = (...n) => () => { for (const x of n) { try { x.disconnect(); } catch (e) { /* */ } } };
function voice(a, s, t0) {
  const t = t0 + s.t, end = t + s.dur, g = a.createGain(), sum = a.createGain(); sum.gain.value = 1;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(s.vol, t + s.att); g.gain.setValueAtTime(s.vol, end - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, end);
  const nodes = [g, sum];
  for (const det of [-s.detune, s.detune]) { // two reeds a hair apart = the rasp
    const o = a.createOscillator(); o.type = 'sawtooth'; o.detune.value = det; o.frequency.setValueAtTime(s.f0, t); o.frequency.exponentialRampToValueAtTime(s.f, t + 0.035); o.frequency.setValueAtTime(s.f, end - 0.08); o.frequency.exponentialRampToValueAtTime(s.f1, end);
    o.connect(sum); o.start(t); o.stop(end + 0.03); nodes.push(o); o.addEventListener('ended', free(o));
  }
  const sq = a.createOscillator(); sq.type = 'square'; sq.frequency.setValueAtTime(s.f0 / 2, t); sq.frequency.exponentialRampToValueAtTime(s.f / 2, t + 0.035); const sg = a.createGain(); sg.gain.value = 0.35; sq.connect(sg).connect(sum); sq.start(t); sq.stop(end + 0.03); nodes.push(sq, sg);
  s.form.forEach((fq, i) => { const b = a.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fq; b.Q.value = s.q[i]; const bg = a.createGain(); bg.gain.value = i ? 0.8 : 1.2; sum.connect(b).connect(bg).connect(g); nodes.push(b, bg); });
  const dry = a.createGain(); dry.gain.value = 0.12; sum.connect(dry).connect(g); nodes.push(dry);
  const n = a.createBufferSource(); n.buffer = noiseBuf(a); const nb = a.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 2600; nb.Q.value = 0.9; const ng = a.createGain();
  ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(s.air, t + 0.01); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); n.connect(nb).connect(ng).connect(out); n.start(t); n.stop(t + 0.12); nodes.push(n, nb, ng);
  g.connect(out); setTimeout(free(...nodes), (end - a.currentTime + 0.3) * 1000);
}
function honk(kind = 'swing') {
  stats.honks++; st.honks++; if (!(st.honks % 10)) save(); emit('honk', { kind });
  const a = audio(); if (!a) return false;
  try { const t0 = a.currentTime + 0.01; for (const s of H.honkSpec(kind, Math.random())) voice(a, s, t0); stats.sounds++; return true; } catch (e) { return false; }
}
addEventListener('pointerdown', () => { if (worn()) audio(); }, { passive: true, capture: true });

// ---------- state ----------
const worn = () => tryv(() => X().skins?.equipped) === H.SKIN;
const ARS = () => X().arsenal;
function here() { const p = tryv(() => ARS()?.pos?.()); if (p) return p; const i = surf()?.info; return i ? { x: i.x, z: i.z, driving: !!i.driving, inside: !!i.inside, name: i.name } : null; }
const inHand = () => tryv(() => game()?.progress?.equip?.weapon) === H.CORE;
function scare(r) {
  const p = here(); if (!p || !fin(p.x)) return 0; let n = 0;
  n += +tryv(() => surf()?.world?.scare?.(p.x, p.z, r, H.SCARE.t), 0) || 0;
  n += +tryv(() => X().street?.scare?.(p.x, p.z, r), 0) || 0;
  stats.scared += n; stats.lastScare = n; if (n) emit('scare', { n, r }); return n;
}
let tNow = 0, lastTaunt = -9;
function taunt() {
  const p = here(); if (!worn() || !p || p.driving || p.inside || p.name !== 'Mars') return false;
  if (!H.canTaunt(tNow, lastTaunt)) return false; lastTaunt = tNow;
  stats.taunts++; honk('taunt'); scare(H.SCARE.taunt); emit('taunt', {}); return true;
}
function wearCheck() {
  const A = ARS(); if (!A) return;
  const w = H.onWear(st, { worn: worn(), owned: !!tryv(() => A.owned('horn')) }); if (!w.equip) return;
  if (w.give) { const r = tryv(() => A.give(H.ARS_ID)); if (!r?.ok) return; stats.gave++; }
  const e = tryv(() => A.equip(H.ARS_ID)); if (!e?.ok) return;
  st.given = true; save();
  toast(`📯 Brass bulb horn in hand. ${touch() ? 'FIRE / 👊 bonks + honks · 📯 Honk taunts · long-press the 🔫 chip to swap' : 'C / click bonks + honks · Shift+C or 📯 Honk taunts · Q swaps'}`, 4200);
}
const touch = () => document.body.classList.contains('touch');
// arsenal: every horn swing honks and spooks the street
function hookArsenal() {
  const A = ARS(); if (!A?.on || hookArsenal.done) return !!hookArsenal.done; hookArsenal.done = true;
  A.on('shot', e => { if (e?.melee && e.id === H.ARS_ID) { stats.swings++; honk('swing'); scare(H.SCARE.swing); } });
  A.on('hit', e => { if (e?.kind === 'melee' && e.id === H.ARS_ID) emit('bonk', {}); });
  return true;
}

// ---------- UI: black 📯 Honk button in #surfBtns, Shift+C ----------
const CSS = `#honkBtn{font-size:14px!important;line-height:1.15!important;background:#000!important;color:#fff!important;border:2px solid #fff!important}#honkBtn:active{background:#fff!important;color:#000!important}`;
let btn = null, cssOn = false, meleeSwap = false;
function ui(mode) {
  if (!cssOn) { cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  const col = document.getElementById('surfBtns'); if (!col) return;
  if (!btn) { btn = document.createElement('button'); btn.id = 'honkBtn'; btn.className = 'glass'; btn.type = 'button'; btn.setAttribute('aria-label', 'Honk (Shift+C)'); btn.textContent = '📯 Honk'; btn.style.display = 'none'; col.prepend(btn);
    (window.__onTap || ((x, f) => x.addEventListener('click', f)))(btn, e => { e?.preventDefault?.(); taunt(); }); }
  const show = mode === 'taunt' ? '' : 'none'; if (btn.style.display !== show) btn.style.display = show;
  const mb = document.getElementById('meleeBtn'); // 👊 shows the horn while it is in hand
  if (mb) { const want = mode === 'taunt' && inHand(); if (want && mb.textContent === '👊') { mb.textContent = '📯'; meleeSwap = true; } else if (!want && meleeSwap && mb.textContent === '📯') { mb.textContent = '👊'; meleeSwap = false; } }
}
addEventListener('keydown', e => {
  if (e.code !== 'KeyC' || !e.shiftKey || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !worn()) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (!document.body.classList.contains('surface')) return;
  e.preventDefault(); e.stopImmediatePropagation(); taunt();
}, true);

// ---------- per frame ----------
let frameN = 0;
function tick(dt, tc) {
  try {
    if (fin(dt)) tNow += Math.min(dt, 0.1); hookArsenal();
    const w = worn(); if (w && !st.given && !(frameN++ % 20)) wearCheck();
    const down = !!tryv(() => game()?.isDown?.());
    ui(H.buttonMode({ worn: w, onFoot: !tc.car, mars: tc.name === 'Mars', inside: !!tc.world?.inside, down }));
  } catch (e) { console.warn('honk tick', e); }
}
function hook() { const r = X().registerSurfaceTick; if (typeof r !== 'function') return false; r(tick); return true; }
if (!hook()) { let n = 0; const iv = setInterval(() => { if (hook() || ++n > 120) clearInterval(iv); }, 250); }

const api = { honk, taunt, scare, state: () => ({ ...st, worn: worn(), inHand: inHand(), button: btn ? btn.style.display !== 'none' : false, ...stats }), on: f => { if (typeof f !== 'function') return () => {}; subs.add(f); return () => subs.delete(f); } };
window.SSX = window.SSX || {}; window.SSX.honk = api;
window.__honk = { api, H, stats, reset: () => { st = H.fresh(); save(); return true; }, audio: () => ac ? ac.state : null };
export default api;
