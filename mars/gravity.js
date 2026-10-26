// v7.5.x Gravity modes for Mars surface vehicles (Pumpkin): MARS (0.38 g, unchanged) / LOW-G (floaty) / ZERO-G (fly the car).
// Self-contained add-on loaded by ONE <script type="module"> line in index.html. It talks to the game only through
// window.__app (keys, joy, touchBtns, toast, state) and window.SSX (registerSurfaceTick, jobs, airRoll); the math lives in
// mars/gravitycore.js. The spaceship is never touched: we only act on the vehicle you're driving on the Mars surface.
//
// Toggle: Z (keyboard) or the black/white 🌍 button on the phone #ssxDock. Cycles MARS -> LOW-G -> ZERO-G.
// With Ben's airroll.js (PR #41, desktop Z = barrel roll) loaded, Z only toggles gravity when no roll is possible (on the ground).
// Safety: leaving the vehicle, going indoors, leaving Mars, a race / drag race / story race gate, or a job start drops back to
// MARS. Races force MARS while they run (the toggle refuses). Coming out of ZERO-G high up, the car falls no faster than
// 10 m/s until it touches down, so switching back never kills you.
//
// ZERO-G keys:  W/S thrust fwd/back · A/D yaw · ↑/↓ pitch (nose down/up) · ←/→ strafe · Space/C up/down · Q/E roll · Shift boost
// ZERO-G touch: stick = pitch + yaw · ⚡ Boost = forward thrust · Thrust (rover) = up · small ▲ ▼ ⟲ ⟳ pad = up, down, roll
// Roll: Ben's SSX.airRoll (feature-detected: roll('left'|'right') when canRoll(), no auto-level while isRolling()); if it
// isn't loaded, Q/E (⟲ ⟳) spin the plain roll axis. Auto-level kicks in when pitch and roll are released.
//
// window.SSX.gravity = { mode, modes, set(mode, why?), cycle(), on(fn) }    window.__gravity = test/debug helpers
import { MODES, nextMode, lowGLift, lowGLand, LOW_HOP, LOW_HOVER_LIFT, SOFT_FALL_VY, zgFrom, zgStep, routeRoll, airRolling, barrelAngle, floatingOf, qMul, qAxis, headingOf, bankOf, pitchOf, tiltOf, fwdOf, ZG } from './gravitycore.js';

const app = () => window.__app;
const ICON = { 'MARS': '🌍', 'LOW-G': '🪶', 'ZERO-G': '🛸' };
let mode = 'MARS', floating = false, zs = null, zCar = null, soft = null, lastCar = null, fuelKeep = null, jumpWas = false, rollWas = 0, rollRoute = '', eligible = false;
const subs = new Set(), log = [];
const pad = { up: false, down: false, rl: false, rr: false };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const toast = (t, ms) => { try { app()?.toast?.(t, ms); } catch (e) { /* no toast */ } };

function raceOn(tc) {
  try {
    if (window.__race?.state) return 'race';
    if (window.SSX?.drag?.active?.() || window.__drag?.state || window.SSX?.race?.active?.()) return 'drag race';
    if (tc?.game?.mapGate?.()) return 'race';
  } catch (e) { /* optional APIs */ }
  return null;
}
function why(tc) { // null = gravity modes allowed right now
  const st = app()?.state; if (!st?.onSurface) return 'Land on Mars first';
  if (!tc?.car) return 'Get in a vehicle first';
  if (tc.name !== 'Mars') return 'Gravity modes are Mars only';
  if (tc.world?.inside) return 'Not indoors';
  const r = raceOn(tc); if (r) return `Locked to MARS during a ${r}`;
  return null;
}
let lastTc = null;
function hint(m) {
  if (m === 'MARS') return 'Normal Mars gravity, 0.38 g.';
  if (m === 'LOW-G') return isTouch() ? 'Floaty jumps and long airtime.' : 'Floaty jumps, long airtime. Space hops.';
  return isTouch() ? 'Stick pitches and turns, ⚡ thrusts, ▲▼ up/down, ⟲⟳ roll. Let go to level out.'
    : 'W/S thrust · A/D yaw · ↑↓ pitch · ←→ strafe · Space/C up/down · Q/E roll · Shift boost. Let go to level out.';
}
function setMode(m, reason, quiet) {
  if (!MODES.includes(m) || m === mode) { render(); return mode; }
  const prev = mode; mode = m; if (m === 'MARS') floating = false;
  const car = lastTc?.car;
  if (prev === 'ZERO-G' && car && zs) leaveZeroG(car, lastTc);
  if (m === 'ZERO-G') { zs = null; zCar = null; }
  log.push({ t: performance.now(), from: prev, to: m, reason: reason || 'toggle' }); if (log.length > 40) log.shift();
  if (!quiet) toast(`${ICON[m]} ${m}${reason && reason !== 'toggle' ? ` (${reason})` : ''}: ${reason && reason !== 'toggle' ? 'back to normal gravity.' : hint(m)}`, m === 'ZERO-G' ? 4200 : 2400);
  for (const f of subs) { try { f({ mode: m, from: prev, reason: reason || 'toggle' }); } catch (e) { console.warn('gravity on', e); } }
  render(); return mode;
}
function cycle() {
  const w = why(lastTc); if (w) { toast(`${ICON[mode]} ${w}.`, 2000); render(); return mode; }
  return setMode(nextMode(mode), 'toggle');
}
// ZERO-G -> wheels: hand the motion back to surface.js and catch the fall
function leaveZeroG(car, tc) {
  const f = fwdOf(zs.q), h = headingOf(zs.q);
  car.yaw = h; car.pitch = 0; car.roll = 0; car.barrel = null; car.rolls = 0;
  car.speed = Math.max(-7, f[0] * zs.v[0] + f[2] * zs.v[2]); car.vy = zs.v[1]; car.prevG = null;
  car.x = zs.p[0]; car.y = zs.p[1]; car.z = zs.p[2];
  if (car.spec?.hover) { const gh = tc?.height ? tc.height(car.x, car.z) : car.y; car.lift = Math.max(0, Math.min(18, car.y - gh - (car.spec.hover || 0))); }
  car.air = true; soft = car; zs = null; zCar = null;
}

// ---------- per-frame tick (SSX.registerSurfaceTick: runs right after the vehicle physics step) ----------
let simT = 0;
function tick(dt, tc) {
  simT += dt; lastTc = tc; const car = tc.car, a = app();
  if (car !== lastCar) { soft = null; if (lastCar && zCar === lastCar) { zs = null; zCar = null; } lastCar = car; fuelKeep = null; }
  const w = why(tc); eligible = !w;
  if (mode !== 'MARS' && w) setMode('MARS', !car ? 'left the vehicle' : w.startsWith('Locked') ? w.replace('Locked to MARS during a ', '') : w.toLowerCase());
  hookJobs();
  if (soft && soft === car && mode !== 'ZERO-G') { if (car.air) car.vy = Math.max(car.vy, SOFT_FALL_VY); else soft = null; }
  syncUi();
  if (window.SSX && window.SSX.gravity !== api) window.SSX.gravity = api; // index.html may (re)assign window.SSX
  if (!car || mode === 'MARS') { jumpWas = false; floating = false; return; }
  const keys = a?.keys || {}, tb = a?.touchBtns || {}, joy = a?.joy || { x: 0, y: 0 };
  if (mode === 'LOW-G') {
    const jump = !!(keys.Space || tb.jump);
    if (car.spec?.hover) { if ((car.lift || 0) > 0 && !car.thrusting) car.lift = Math.min(18, car.lift + LOW_HOVER_LIFT * dt); }
    else {
      const gh = tc.height(car.x, car.z), alt = car.y - gh;
      if (alt > 0.02) { car.vy += lowGLift(0.38 * 9.81, dt, true); car.vy = lowGLand(car.vy); }
      const thrusty = car === tc.rover || car.kind === 'hoverbike';
      if (jump && !jumpWas && !thrusty && alt < 0.3) { car.vy = LOW_HOP; car.y += 0.3; car.air = true; car.prevG = null; }
    }
    jumpWas = jump; floating = floatingOf(mode, car, car.y - tc.height(car.x, car.z)); return;
  }
  // ---- ZERO-G ----
  if (!zs || zCar !== car) { zs = zgFrom(car); zCar = car; }
  if (fuelKeep !== null && car.fuel !== undefined) car.fuel = fuelKeep; // thrusters are free out here
  const k = c => keys[c] ? 1 : 0, touch = isTouch();
  const inp = {
    fwd: k('KeyW') - k('KeyS') + (touch && tb.run ? 1 : 0),
    yaw: k('KeyD') - k('KeyA') + (joy.id != null ? joy.x : 0),
    pitch: k('ArrowDown') - k('ArrowUp') + (joy.id != null ? joy.y : 0),
    strafe: k('ArrowRight') - k('ArrowLeft'),
    up: k('Space') + (tb.jump ? 1 : 0) + (pad.up ? 1 : 0) - k('KeyC') - (pad.down ? 1 : 0),
    roll: 0, boost: !!(keys.ShiftLeft || keys.ShiftRight || (!touch && tb.run))
  };
  for (const n of ['fwd', 'yaw', 'pitch', 'strafe', 'up']) inp[n] = Math.max(-1, Math.min(1, inp[n]));
  const rollIn = Math.max(-1, Math.min(1, k('KeyE') - k('KeyQ') + (pad.rr ? 1 : 0) - (pad.rl ? 1 : 0)));
  // roll: Ben's SSX.airRoll first (it drives car.barrel, the v7.4 stunt roll, which we draw on top of our pose); plain roll
  // axis only if roll() said no or airRoll isn't loaded. Without airRoll, index.html's Q/E air-roll would start that stunt
  // barrel too, so we cancel it here (one roll, not two).
  const ar = window.SSX?.airRoll, hasAr = !!(ar && typeof ar.roll === 'function');
  if (rollIn && rollIn !== rollWas) rollRoute = routeRoll(ar, rollIn, hasAr && (!!car.barrel || airRolling(ar)));
  if (rollIn && rollRoute === 'axis') inp.roll = rollIn;
  if (!hasAr || rollRoute === 'axis') { car.barrel = null; car.rolls = 0; }
  rollWas = rollIn;
  inp.hold = airRolling(ar) || !!car.barrel;
  zgStep(zs, inp, dt, tc.height);
  // collisions with buildings / domes near the ground (same collider the wheels use); only block moving INTO one
  const col = (x, z) => tc.world?.collide?.(x, z, (car.spec?.r || 2) * 0.75, car);
  if (zs.alt < 8 && col(zs.p[0], zs.p[2]) && !col(ox, oz)) { zs.p[0] = ox; zs.p[2] = oz; zs.v[0] *= -0.3; zs.v[2] *= -0.3; }
  // write the pose back over what surface.js just did (it ran first this frame)
  car.x = zs.p[0]; car.y = zs.p[1]; car.z = zs.p[2]; car.yaw = headingOf(zs.q); car.pitch = pitchOf(zs.q); car.roll = bankOf(zs.q);
  car.vy = 0; car.speed = 0; car.prevG = null; car.air = zs.alt > 0.9; car.wasAir = car.air; car.susp = 0;
  if (car.spec?.hover) car.lift = Math.max(0, zs.alt - (car.spec.hover || 0));
  const bq = car.barrel ? qMul(zs.q, qAxis(0, 0, 1, barrelAngle(car.barrel))) : zs.q;
  car.group.position.set(car.x, car.y, car.z); car.group.quaternion.set(bq[0], bq[1], bq[2], bq[3]);
  if (car.fuel !== undefined) fuelKeep = car.fuel;
  floating = floatingOf(mode, car, zs.alt);
  if (tc.player) { tc.player.x = car.x; tc.player.z = car.z; tc.player.y = car.y + 1.7; tc.player.grounded = !car.air; }
}
let jobsHooked = false;
function hookJobs() {
  if (jobsHooked || !window.SSX?.jobs?.on) return; jobsHooked = true;
  try { window.SSX.jobs.on('start', () => { if (mode !== 'MARS') setMode('MARS', 'job started'); }); } catch (e) { /* optional */ }
}

// ---------- UI: dock button (phones), ZERO-G pad (phones), tiny mode chip (desktop) ----------
const CSS = `
#ssxDock #dockGrav{display:none} body.gravok #ssxDock #dockGrav{display:block}
body.grav-low #dockGrav, body.grav-zero #dockGrav{background:#fff !important;color:#000 !important;border-color:#000 !important}
#gravPad{position:fixed;z-index:8;left:calc(18px + var(--sal,0px));bottom:calc(172px + var(--sab,0px));display:none;grid-template-columns:44px 44px;gap:6px;touch-action:none}
body.touch.grav-zero.gravok #gravPad{display:grid}
#gravPad button{width:44px;height:40px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 17px/1 system-ui,sans-serif;padding:0;touch-action:none;-webkit-user-select:none;user-select:none}
#gravPad button.on{background:#fff;color:#000;border-color:#000}
#gravChip{position:fixed;z-index:8;left:calc(12px + var(--sal,0px));bottom:calc(12px + var(--sab,0px));display:none;padding:4px 8px;border-radius:8px;background:#000;color:#fff;border:2px solid #fff;font:800 11px/1.2 system-ui,sans-serif;pointer-events:none}
body:not(.touch).gravok.grav-low #gravChip, body:not(.touch).gravok.grav-zero #gravChip{display:block}
@media (max-height:700px){#gravPad{bottom:calc(140px + var(--sab,0px))}}`;
let dockBtn = null, padEl = null, chip = null, uiKey = '';
function tap(el, fn) { (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, fn); }
// Phone button on the shared #ssxDock (owned by mars/turf.js, styles in #ssxDockCss, avoids #surfBtns). Like jobs.js we never
// create a dock: attach when it appears; with no dock there is no phone button (Z still works on keyboards).
function dockButton() {
  const attach = () => {
    const d = document.getElementById('ssxDock'); if (!d) return false;
    let b = document.getElementById('dockGrav'); if (b) { dockBtn = b; return true; }
    b = document.createElement('button'); b.id = 'dockGrav'; b.type = 'button'; b.style.order = '5'; d.appendChild(b); tap(b, () => cycle()); dockBtn = b; uiKey = ''; return true;
  };
  if (attach()) return dockBtn;
  try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no observer: no dock button */ }
  return null;
}
function holdBtn(id, label, aria, key) { // hold buttons: own pointer, released on up/cancel/lost capture (like the game's Thrust/Boost)
  const b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria);
  let pid = null;
  b.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; pad[key] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) { /* */ } });
  const off = e => { if (e && pid !== null && e.pointerId !== pid) return; pid = null; pad[key] = false; b.classList.remove('on'); };
  b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off); b.addEventListener('contextmenu', e => e.preventDefault());
  return b;
}
function ui() {
  if (padEl || !document.body) return;
  const st = document.createElement('style'); st.id = 'gravCss'; st.textContent = CSS; document.head.appendChild(st);
  dockButton();
  padEl = document.createElement('div'); padEl.id = 'gravPad'; padEl.setAttribute('aria-label', 'Zero-G controls');
  padEl.append(holdBtn('gravUp', '▲', 'Rise', 'up'), holdBtn('gravRollL', '⟲', 'Roll left', 'rl'), holdBtn('gravDown', '▼', 'Sink', 'down'), holdBtn('gravRollR', '⟳', 'Roll right', 'rr'));
  document.body.appendChild(padEl);
  chip = document.createElement('div'); chip.id = 'gravChip'; document.body.appendChild(chip);
  addEventListener('keydown', e => {
    if (e.code !== 'KeyZ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (!app()?.state?.onSurface || window.__race?.builder?.open) return;
    const ar = window.SSX?.airRoll; if (ar && (ar.canRoll?.() || ar.isRolling?.())) return; // airborne: Z is SSX.airRoll's barrel roll (PR #41)
    e.preventDefault(); cycle();
  });
  addEventListener('blur', () => { for (const k in pad) pad[k] = false; });
  render();
}
function syncUi() { const k = `${eligible}|${mode}`; if (k !== uiKey) render(); }
function render() {
  uiKey = `${eligible}|${mode}`; const B = document.body; if (!B) return;
  B.classList.toggle('gravok', eligible); B.classList.toggle('grav-low', mode === 'LOW-G'); B.classList.toggle('grav-zero', mode === 'ZERO-G');
  if (dockBtn) { dockBtn.textContent = `${ICON[mode]}\n${mode}`; dockBtn.setAttribute('aria-label', `Gravity: ${mode} (Z)`); dockBtn.setAttribute('aria-pressed', String(mode !== 'MARS')); }
  if (chip) chip.textContent = `${ICON[mode]} ${mode} · Z`;
  if (mode !== 'ZERO-G') for (const k in pad) pad[k] = false;
}

// ---------- boot ----------
// public: SSX.gravity.mode (read-only), .floating (read-only: your vehicle is airborne/floating in LOW-G or ZERO-G; false in
// MARS, on the ground, on foot or off Mars - Marsmania pursuit reads this), set(mode), cycle(), on(fn) -> unsubscribe
const api = Object.freeze({
  get mode() { return mode; }, modes: Object.freeze(MODES.slice()),
  get floating() { return floating && mode !== 'MARS' && !!lastCar && !!app()?.state?.onSurface; },
  set: (m, reason) => { if (m !== 'MARS') { const w = why(lastTc); if (w) return { ok: false, mode, why: w }; } setMode(m, reason || 'toggle'); return { ok: true, mode }; },
  cycle, on(fn) { subs.add(fn); return () => subs.delete(fn); }
});
window.__gravity = {
  get mode() { return mode; }, set: api.set, cycle, log, pad,
  get eligible() { return eligible; }, get simT() { return simT; }, why: () => why(lastTc),
  state: () => zs ? { p: zs.p.slice(), v: zs.v.slice(), alt: zs.alt, tilt: tiltOf(zs.q), bank: bankOf(zs.q), pitch: pitchOf(zs.q), heading: headingOf(zs.q), rolled: zs.rolled, speed: Math.hypot(...zs.v), route: rollRoute } : null,
  car: () => { const c = lastTc?.car; return c ? { x: c.x, y: c.y, z: c.z, vy: c.vy, air: !!c.air, kind: c.kind, alt: c.y - lastTc.height(c.x, c.z), lift: c.lift || 0 } : null; },
  ZG
};
function boot() {
  const S = window.SSX, a = app();
  if (!S?.registerSurfaceTick || !a?.surface) return false;
  S.gravity = api; S.registerSurfaceTick(tick); ui(); return true;
}
if (window.SSX && !window.SSX.gravity) window.SSX.gravity = api;
if (!boot()) { const iv = setInterval(() => { if (boot()) clearInterval(iv); }, 250); }
