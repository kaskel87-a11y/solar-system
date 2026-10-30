// Mars jetpack (Pumpkin). Buy it in ☰ → 🔥 Jetpack (2,000 cr). On foot on Mars, hold Jump (Space) to thrust up; the stick
// (WASD) steers you in the air. A small black-and-white fuel bar sits inside the Jump button (phones) or a chip bottom-left
// (desktop); it refills once you're back on the ground. Exhaust flames on your back, a hiss while you burn.
// Gravity modes (Pumpkin's mars/gravity.js, SSX.gravity, feature-detected): with the jetpack on, the 🌍 toggle works on
// foot too. MARS = plain 0.38 g, LOW-G = 40% of it (long floaty burns), ZERO-G = you float; let go and you drift down, ▼ dives.
// Cops: at 3★ or more, ColSec shoots at you while you fly (SSX.pursuit.seen() when Marsmania's pursuit is loaded, otherwise
// any 3★ heat). Every hit hurts; 3 hits (2 at 5★) shoot the pack out: thrusters dead for 8 s and you drop.
// Self-contained: one <script type="module"> line in index.html (+ import map), one sw.js precache line. Talks to the game
// only through window.__app (keys, joy, touchBtns, toast, surface) and window.SSX (registerSurfaceTick, registerMenuItem,
// city.choice, gravity, pursuit). Pure logic: ./jetpackcore.js.
//
// window.SSX.jetpack = { owned, on, ready, fuel, flying, lit, down, price, buy(), setOn(bool), subscribe(fn) }  window.__jetpack = test helpers
import * as THREE from 'three';
import * as C from './jetpackcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game;
const KEY = 'ssx.jetpack.v1', EYE = 1.7;
const log = [], subs = new Set();
const toast = (t, ms = 2600) => { try { app()?.toast?.(t, ms); } catch (e) { /* no toast */ } log.push(t); if (log.length > 40) log.shift(); };
const emit = (type, d = {}) => { for (const f of subs) { try { f({ type, ...d }); } catch (e) { console.warn('jetpack on', e); } } try { window.SSX?.emit?.('jetpack:' + type, d); } catch (e) { /* */ } };
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const fmt = n => n.toLocaleString('en-US');

// ---------- ownership (own key + a progress flag so the save backup carries it) ----------
let save = { owned: false, on: true };
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && typeof j === 'object') save = { owned: !!j.owned, on: j.on !== false }; } catch (e) { /* fresh */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } };
const owned = () => save.owned || !!tryv(() => game()?.flag?.('jetpack'));
const ready = () => owned() && save.on;

function buy() {
  if (owned()) return { ok: false, msg: 'You already own the jetpack.' };
  const g = game(); if (!g?.spend) return { ok: false, msg: 'The shop is closed. Try again on a world.' };
  const cr = +(g.progress?.credits || 0);
  if (!g.spend(C.PRICE)) return { ok: false, msg: `💸 The jetpack is ${fmt(C.PRICE)} cr. You have ${fmt(cr)}.` };
  save.owned = true; save.on = true; persist(); try { g.setFlag?.('jetpack'); } catch (e) { /* */ }
  s.fuel = C.FUEL_MAX; emit('buy'); render();
  return { ok: true, msg: `🔥 Jetpack bought. On Mars, hold ${isTouch() ? 'Jump' : 'Space'} to fly. Fuel refills on the ground.` };
}
function setOn(v) { if (!owned()) return false; save.on = !!v; persist(); emit('toggle', { on: save.on }); render(); return save.on; }

// ---------- ☰ menu entry: buy, then on/off ----------
function menuLabel() { return owned() ? `🔥 Jetpack: ${save.on ? 'ON' : 'OFF'}` : `🔥 Jetpack · ${fmt(C.PRICE)} cr`; }
function menuTap() {
  if (owned()) { const on = setOn(!save.on); toast(on ? `🔥 Jetpack on. Hold ${isTouch() ? 'Jump' : 'Space'} to fly.` : '🔥 Jetpack off. Jump is just a jump.', 2400); return; }
  const cr = +(tryv(() => game()?.progress?.credits, 0) || 0);
  const pitch = `Strap-on cold-gas jetpack. Hold ${isTouch() ? 'Jump' : 'Space'} to fly, steer with the ${isTouch() ? 'stick' : 'WASD keys'}, fuel refills when you land. ColSec shoots at it at 3★. You have ${fmt(cr)} cr.`;
  const done = id => { if (id !== 'buy') return; const r = buy(); toast(r.msg, 3400); };
  const ch = window.SSX?.city?.choice;
  if (typeof ch === 'function') { ch(pitch, [{ id: 'buy', label: `Buy · ${fmt(C.PRICE)} cr` }, { id: 'no', label: 'Not now' }]).then(done).catch(() => {}); patchSheet(); }
  else if (confirm(pitch + '\n\nBuy for ' + fmt(C.PRICE) + ' cr?')) done('buy');
}
// city.choice titles the sheet "🤝 Your call"; give it the item and price as the title instead (guarded)
function patchSheet() { const t = document.getElementById('sheetTitle'), x = document.getElementById('sheetText'); if (t && /Your call/.test(t.textContent) && x && /cold-gas jetpack/.test(x.textContent)) t.textContent = '🔥 Jetpack · ' + fmt(C.PRICE) + ' cr'; }
let menuBtn = null;
function hookMenu() {
  if (menuBtn?.isConnected) return true;
  const reg = window.SSX?.registerMenuItem; if (typeof reg !== 'function') return false;
  try { menuBtn = reg({ id: 'rmJetpack', label: menuLabel(), onTap: () => menuTap() }); } catch (e) { console.warn('jetpack menu', e); return false; }
  return true;
}

// ---------- state + per-frame tick (SSX.registerSurfaceTick: after the on-foot step) ----------
const s = C.fresh();
let simT = 0, eligible = false, lastTc = null, infoT = 0, camDist = 9, planetG = 0.38, alt = 0, mode = 'MARS', thrustT = 0, maxAlt = 0;
const stats = { burns: 0, hits: 0, downs: 0, airT: 0 };
function why(tc) { // null = jetpack can fly right now
  const st = app()?.state; if (!st?.onSurface || st.transitioning) return 'not on a world';
  if (!ready()) return owned() ? 'off' : 'not owned';
  if (tc?.name !== 'Mars') return 'Mars only';
  if (tc.car) return 'driving';
  if (tc.world?.inside) return 'indoors';
  if (tryv(() => tc.game?.isDown?.())) return 'down';
  return null;
}
function groundY(tc, x, z) { const h = tryv(() => tc.world?.groundAt?.(x, z)); return Number.isFinite(h) ? h : tc.height ? tc.height(x, z) : 0; }
function tick(dt, tc) {
  simT += dt; lastTc = tc;
  if (window.SSX && window.SSX.jetpack !== api) window.SSX.jetpack = api; // index.html may (re)assign window.SSX
  hookMenu();
  const a = app(), p = tc.player, w = why(tc); eligible = !w;
  if ((infoT -= dt) <= 0) { infoT = 0.25; const i = tryv(() => surf()?.info); if (i) { camDist = +i.camDist || 0; planetG = +i.g || 0.38; } }
  mode = C.normMode(tryv(() => window.SSX?.gravity?.mode, 'MARS'));
  if (!eligible || !p) { // refill while parked / driving / indoors, nothing lit
    if (s.fuel < C.FUEL_MAX && (!p || p.grounded || tc.car)) s.fuel = Math.min(C.FUEL_MAX, s.fuel + C.REFILL * dt);
    s.lit = false; s.flying = false; if (s.down > 0) s.down = Math.max(0, s.down - dt);
    visuals(tc, false, false); sound(0); syncUi(); return;
  }
  const keys = a?.keys || {}, tb = a?.touchBtns || {}, joy = a?.joy || { x: 0, y: 0 };
  const intro = tryv(() => surf()?.info?.intro, 0) > 0;
  const jump = !intro && !!(keys.Space || tb.jump);
  const dive = !!(window.__gravity?.pad?.down);
  const feet = p.y - EYE, gy = groundY(tc, p.x, p.z); alt = Math.max(0, feet - gy);
  const airborne = !p.grounded;
  const wasLit = s.lit;
  p.vy = C.step(s, { jump, dive, airborne, alt, vy: p.vy, g: planetG * 9.81, mode, dt });
  if (s.lit) { p.grounded = false; thrustT += dt; if (!wasLit) { stats.burns++; emit('burn'); } }
  if (s.flying) { stats.airT += dt; maxAlt = Math.max(maxAlt, alt); }
  // air steer: the stick / WASD push you along on top of the walk speed while flying (camera-relative, like surface.js walk)
  if (s.flying && airborne) {
    const kb = !!tryv(() => { const k = window.SSX?.controls?.kbOnly; return typeof k === 'function' ? k() : k; }, false); // keyboard only: arrows turn the camera
    const mx = (keys.KeyD || (!kb && keys.ArrowRight) ? 1 : 0) - (keys.KeyA || (!kb && keys.ArrowLeft) ? 1 : 0) + (joy.x || 0);
    const mz = (keys.KeyW || (!kb && keys.ArrowUp) ? 1 : 0) - (keys.KeyS || (!kb && keys.ArrowDown) ? 1 : 0) - (joy.y || 0);
    const [dx, dz] = C.airSteer(mx, mz, p.yaw, dt, true);
    if (dx || dz) { let nx = p.x + dx, nz = p.z + dz; const c = tryv(() => tc.world?.collidePlayer?.(nx, nz, 0.45)); if (c) { nx = c.x; nz = c.z; } p.x = nx; p.z = nz; }
  }
  // ColSec fire at 3★+
  const stars = +(tryv(() => tc.world?.wanted, 0) || 0);
  const seenFn = tryv(() => window.SSX?.pursuit?.seen);
  const seen = typeof seenFn === 'function' ? !!tryv(() => seenFn(), true) : true;
  const shot = C.shootStep(s, { stars, flying: s.flying && airborne, alt, seen, dt });
  if (shot) {
    stats.hits++; const u = nearestCop(p); try { tc.game?.hurtPlayer?.(C.hitDamage(stars), u || { x: p.x + Math.sin(p.yaw) * 12, z: p.z + Math.cos(p.yaw) * 12 }); } catch (e) { /* */ }
    if (shot === 'down') { stats.downs++; p.vy = Math.min(p.vy, -1); /* thrust cut: you drop */ toast(`💥 ColSec shot your jetpack out! Thrusters dead for ${C.DOWN_SECS} s.`, 3200); sputter(); emit('down', { stars }); }
    else { toast(`💥 ColSec is shooting at your jetpack! Land or lose the heat.`, 1800); emit('hit', { stars, hits: s.hits }); }
  }
  visuals(tc, true, s.lit);
  sound(s.lit ? 1 : s.flying && airborne ? 0.25 : 0);
  syncUi();
}

function nearestCop(p) { // Marsmania's pursuit units (feature-detected) give the hit a direction for the damage arrow
  let best = null, bd = 1e9; for (const u of tryv(() => window.SSX?.pursuit?.units?.(), []) || []) { if (!Number.isFinite(u?.x) || !Number.isFinite(u?.z)) continue; const d = Math.hypot(u.x - p.x, u.z - p.z); if (d < bd) { bd = d; best = { x: u.x, z: u.z }; } }
  return best;
}
// ---------- visuals: a pack on your back, two nozzles, flicker flames ----------
let pack = null, flames = [];
function shared(o) { o.traverse(m => { if (m.geometry) m.geometry.userData.shared = true; if (m.material) m.material.userData.shared = true; }); return o; } // surface exit() keeps shared assets
function buildPack() {
  const g = new THREE.Group(); g.name = 'jetpack';
  const body = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.5, metalness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.6 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.16), dark); box.position.set(0, 1.18, 0.26); g.add(box);
  for (const sx of [-0.13, 0.13]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.56, 12), body); tank.position.set(sx, 1.2, 0.36); g.add(tank);
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.1, 10), dark); noz.position.set(sx, 0.87, 0.36); g.add(noz);
    const fl = new THREE.Group(); fl.position.set(sx, 0.82, 0.36);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    outer.rotation.x = Math.PI; outer.position.y = -0.45; fl.add(outer);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.5, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    core.rotation.x = Math.PI; core.position.y = -0.25; fl.add(core);
    fl.visible = false; g.add(fl); flames.push(fl);
  }
  return shared(g);
}
function visuals(tc, on, lit) {
  if (!tc?.scene) return;
  if (!pack) pack = buildPack();
  if (pack.parent !== tc.scene) { if (!on) return; tc.scene.add(pack); }
  const p = tc.player, show = on && camDist > 0.8; pack.visible = !!show;
  if (!show) return;
  pack.position.set(p.x, p.y - EYE, p.z); pack.rotation.y = Number.isFinite(p.faceYaw) ? p.faceYaw : p.yaw;
  for (const f of flames) { f.visible = !!lit; if (lit) { const k = 0.8 + Math.random() * 0.45; f.scale.set(1, k * (mode === 'ZERO-G' ? 0.7 : 1), 1); } }
}

// ---------- sound: filtered noise hiss, own AudioContext, respects SSX.audio.mix (mute / master) ----------
let actx = null, ag = null, af = null;
function mix() { return tryv(() => window.SSX?.audio?.mix?.get?.()); }
function audioUp() {
  if (actx) { if (actx.state !== 'running') actx.resume?.()?.catch?.(() => {}); return; }
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return; actx = new A();
    const n = actx.sampleRate, buf = actx.createBuffer(1, n, n), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    af = actx.createBiquadFilter(); af.type = 'bandpass'; af.frequency.value = 700; af.Q.value = 0.7;
    ag = actx.createGain(); ag.gain.value = 0; src.connect(af); af.connect(ag); ag.connect(actx.destination); src.start();
  } catch (e) { actx = null; }
}
let vol = 0;
function sound(level) {
  if (level > 0 && ready()) audioUp();
  if (!ag || !actx) return;
  const m = mix(), master = m ? (m.mute ? 0 : +m.master) : 0.9, tgt = document.hidden ? 0 : level * 0.16 * (Number.isFinite(master) ? master : 0.9);
  if (Math.abs(tgt - vol) < 0.002) return; vol = tgt;
  try { const t = actx.currentTime; ag.gain.setTargetAtTime(tgt, t, 0.06); af.frequency.setTargetAtTime(level >= 1 ? 900 + Math.random() * 200 : 420, t, 0.08); } catch (e) { /* */ }
}
function sputter() { if (!ag || !actx) return; try { const t = actx.currentTime; for (let i = 0; i < 5; i++) { ag.gain.setValueAtTime(0.18, t + i * 0.09); ag.gain.setValueAtTime(0.0, t + i * 0.09 + 0.045); } vol = 0; } catch (e) { /* */ } }

// ---------- UI: fuel bar inside #jumpBtn (phones, survives 👁 hide-HUD which keeps Jump), chip bottom-left (desktop) ----------
const CSS = `
#jpFuel{display:none;position:absolute;left:9px;right:9px;top:5px;height:5px;border-radius:3px;background:#000;border:1px solid #fff;box-sizing:border-box;overflow:hidden;pointer-events:none}
#jpFuel b{display:block;height:100%;width:100%;background:#fff}
body.touch.jp-ready:not(.driving) #jpFuel{display:block}
body.jp-ready.jp-low #jpFuel b{animation:jpBlink .5s steps(2) infinite} body.jp-ready.jp-shot #jpFuel{border-style:dashed}
@keyframes jpBlink{50%{background:#000}}
body.touch.jp-ready.jp-lit:not(.driving) #jumpBtn{background:#fff!important;color:#000!important}
#jpChip{position:fixed;z-index:8;left:calc(12px + var(--sal,0px));bottom:calc(40px + var(--sab,0px));display:none;align-items:center;gap:6px;padding:3px 7px;border-radius:7px;background:#000;color:#fff;border:1px solid #fff;font:800 10px/1.2 system-ui,sans-serif;pointer-events:none}
#jpChip i{display:block;width:54px;height:5px;border:1px solid #fff;border-radius:3px;overflow:hidden} #jpChip i b{display:block;height:100%;background:#fff}
body:not(.touch).surface.jp-ready:not(.driving) #jpChip{display:flex}
body.jp-ready.grav-zero:not(.driving) #gravRollL, body.jp-ready.grav-zero:not(.driving) #gravRollR{visibility:hidden}`;
let fuelEl = null, chipEl = null, uiKey = '';
function ui() {
  if (!document.body || document.getElementById('jpCss')) return;
  const st = document.createElement('style'); st.id = 'jpCss'; st.textContent = CSS; document.head.appendChild(st);
  chipEl = document.createElement('div'); chipEl.id = 'jpChip'; chipEl.innerHTML = '<span>🔥 JET</span><i><b></b></i>'; document.body.appendChild(chipEl);
  attachFuel();
  addEventListener('pointerdown', () => { if (ready()) audioUp(); }, { passive: true, capture: true }); // iOS: audio wakes on a tap
  addEventListener('keydown', () => { if (ready()) audioUp(); }, { capture: true });
}
function attachFuel() {
  if (fuelEl?.isConnected) return; const jb = document.getElementById('jumpBtn'); if (!jb) return;
  fuelEl = document.getElementById('jpFuel') || Object.assign(document.createElement('i'), { id: 'jpFuel', innerHTML: '<b></b>' });
  fuelEl.setAttribute('aria-hidden', 'true'); jb.appendChild(fuelEl);
}
function syncUi() {
  const pct = C.fuelPct(s), k = `${eligible}|${pct}|${s.lit}|${s.down > 0}|${owned()}|${save.on}`;
  if (k === uiKey) return; uiKey = k; render();
}
function render() {
  const B = document.body; if (!B) return; attachFuel();
  const pct = C.fuelPct(s);
  B.classList.toggle('jp-ready', eligible); B.classList.toggle('jp-lit', eligible && s.lit); B.classList.toggle('jp-low', eligible && pct < 25); B.classList.toggle('jp-shot', s.down > 0);
  if (fuelEl) fuelEl.firstChild.style.width = pct + '%';
  if (chipEl) { chipEl.querySelector('b').style.width = pct + '%'; chipEl.firstChild.textContent = s.down > 0 ? '💥 JET' : '🔥 JET'; }
  const jl = document.querySelector('#jumpBtn .lbl'); // Jump says Jet while you can fly (index.html relabels it 🚀 Thrust in a rover; we leave that alone)
  if (jl) { if (eligible && jl.textContent === 'Jump') jl.textContent = '🔥 Jet'; else if (!eligible && jl.textContent === '🔥 Jet') jl.textContent = 'Jump'; }
  if (menuBtn) menuBtn.textContent = menuLabel();
  const jb = document.getElementById('jumpBtn'); if (jb) { if (eligible) jb.setAttribute('aria-label', `Jetpack: hold to fly. Fuel ${pct}%`); else if (jb.getAttribute('aria-label')?.startsWith('Jetpack')) jb.removeAttribute('aria-label'); }
}

// ---------- boot ----------
const api = Object.freeze({
  get owned() { return owned(); }, get on() { return save.on; }, get ready() { return ready(); }, get eligible() { return eligible; },
  get fuel() { return C.fuelPct(s); }, get flying() { return eligible && s.flying; }, get lit() { return eligible && s.lit; }, get down() { return s.down; },
  price: C.PRICE, buy, setOn, subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
});
window.__jetpack = {
  api, log, stats, C, get s() { return s; }, get simT() { return simT; }, get alt() { return alt; }, get maxAlt() { return maxAlt; }, resetMax() { maxAlt = 0; }, get mode() { return mode; },
  why: () => why(lastTc), give() { save.owned = true; save.on = true; persist(); render(); }, reset() { save = { owned: false, on: true }; persist(); Object.assign(s, C.fresh()); render(); },
  setFuel(n) { s.fuel = Math.max(0, Math.min(C.FUEL_MAX, n)); render(); }, menuTap
};
function boot() {
  const S = window.SSX, a = app();
  if (!S?.registerSurfaceTick || !a?.surface) return false;
  S.jetpack = api; S.registerSurfaceTick(tick); ui(); hookMenu(); render(); return true;
}
if (window.SSX && !window.SSX.jetpack) window.SSX.jetpack = api;
if (!boot()) { const iv = setInterval(() => { if (boot()) clearInterval(iv); }, 250); }
