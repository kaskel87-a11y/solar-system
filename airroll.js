// Barrel rolls for anything airborne (Ben). Public API: SSX.airRoll (also __app.airRoll), for any vehicle you drive
// (rover, stolen cars, hover bikes, the Raccoon Mobile...) and the Starship in flight. Mods such as a zero-g toggle
// should call this instead of building their own roll.
//
//   SSX.airRoll.roll('left' | 'right')  -> true if the roll was accepted (it starts on the next frame; also accepts -1 / +1)
//   SSX.airRoll.canRoll()               -> true when a roll can start now (driving + airborne + not rolling, or flying the Starship)
//   SSX.airRoll.isRolling()             -> true while a vehicle or the Starship is mid-roll
//   SSX.airRoll.on(evt, fn)             -> unsubscribe function. evt: 'start' { dir, target }, 'end' { target },
//                                          'land' { rolls } (clean landing after rolling), 'crash' {} (landed on the roof), '*' (all, fn(evt, data))
//   target is 'vehicle' or 'ship'; dir is 'left' or 'right'.
//
// The roll physics live where v7.4 put them: surface.js stunt() (0.75 s, 360°, a clean landing pays 25·n² cr, landing
// on the roof costs 22 hp and most of your speed) and index.html requestRoll() for the Starship (0.9 s, cosmetic, camera
// stays level). This file adds the API, a phone context button that shows ONLY while you're airborne in a vehicle or
// flying the Starship, and a desktop key: Z (rolls toward the A/D or arrow you're holding, else right). The v7.4 inputs
// still work too: Q / E in the air, double-tap A / D, double-flick the stick, swipe across Thrust.
// Phone button input is pointerdown -> pointerup with the same pointerId (never onclick), so a held joystick finger never
// blocks it. Hook: one `import './airroll.js'` line in index.html. Pure helpers are unit-tested (tests/test-airroll-unit.mjs).

// should the phone button show? s = { touch, onSurface, flying, transitioning, driving, air, inside, cinematic }
export function rollVisible(s) {
  if (!s || !s.touch || s.transitioning || s.cinematic) return false;
  if (s.onSurface) return !!(s.driving && s.air && !s.inside);
  return !!s.flying;
}
// phone roll direction: a swipe across the button wins, then the stick, else right (-1 left, +1 right)
export function rollDir(swipeDx, joyX) {
  if (Math.abs(swipeDx || 0) > 18) return Math.sign(swipeDx);
  if (Math.abs(joyX || 0) > 0.25) return Math.sign(joyX);
  return 1;
}
// 'left' | 'right' | -1 | +1 -> -1 | +1 (0 = invalid)
export function normDir(d) {
  if (d === 'left' || d === -1 || d === 'l') return -1;
  if (d === 'right' || d === 1 || d === 'r' || d === undefined) return 1;
  return 0;
}
// can a roll start? r = { onSurface, flying, transitioning, landing, driving, air, inside, rolling, shipRolling }
export function rollReady(r) {
  if (!r || r.transitioning) return false;
  if (r.onSurface) return !!(r.driving && r.air && !r.inside && !r.rolling);
  return !!(r.flying && !r.landing && !r.shipRolling);
}
// events between two snapshots { rolling, shipRolling, shipRolls, clean, crash, rolls, dir }
export function rollEvents(a, b) {
  const ev = [];
  if (!a || !b) return ev;
  if (!a.rolling && b.rolling) ev.push(['start', { dir: b.dir < 0 ? 'left' : 'right', target: 'vehicle' }]);
  if (!a.shipRolling && b.shipRolling) ev.push(['start', { dir: b.dir < 0 ? 'left' : 'right', target: 'ship' }]);
  if (a.rolling && !b.rolling) ev.push(['end', { target: 'vehicle' }]);
  if (a.shipRolling && !b.shipRolling) ev.push(['end', { target: 'ship' }]);
  if (b.crash > a.crash) ev.push(['crash', {}]);
  if (b.clean > a.clean) ev.push(['land', { rolls: Math.max(1, b.rolls - a.rolls) }]);
  return ev;
}

const POLL_MS = 50, GRACE_MS = 220;
const subs = new Map();
let snap = null, lastDir = 1, pending = null; // pending: a vehicle roll asked for but not yet picked up by the sim (slow frames)
const app = () => (typeof window !== 'undefined' ? window.__app : null);
function readState() {
  const a = app(); if (!a) return null;
  const st = a.state, i = st.onSurface ? st.info : null, sr = a.shipRoll;
  return { onSurface: !!st.onSurface, flying: !!st.flying, transitioning: !!st.transitioning, landing: false,
    driving: !!i?.driving, air: !!i?.air, inside: !!i?.inside, rolling: !!i?.rolling, shipRolling: !!sr,
    shipRolls: a.shipRolls || 0, clean: i?.stunts?.clean || 0, crash: i?.stunts?.crash || 0, rolls: i?.stunts?.rolls || 0, dir: sr ? sr.dir : lastDir };
}
function emit(evt, data) {
  for (const k of [evt, '*']) for (const fn of subs.get(k) || []) { try { k === '*' ? fn(evt, data) : fn(data); } catch (e) { console.error('airRoll listener', e); } }
}
function poll() {
  const s = readState(); if (!s) return;
  if (snap) {
    // stunt clean / crash counters only count on the surface; reset across a landing so a new world doesn't fire stale events
    if (snap.onSurface !== s.onSurface) snap = { ...s, rolling: false, shipRolling: false };
    for (const [e, d] of rollEvents(snap, s)) emit(e, d);
  }
  snap = s;
  // index.html drops a roll request that waits > 700 ms for a frame; on a slow phone keep re-asking until the sim takes it
  if (pending) {
    const a = app();
    if (s.rolling || !s.onSurface || !rollReady(s) || performance.now() > pending.until) pending = null;
    else a?.requestRoll?.(pending.dir);
  }
}

export const airRoll = {
  version: 1,
  roll(dir) {
    const d = normDir(dir), a = app(); if (!d || !a?.requestRoll) return false;
    if (!airRoll.canRoll()) return false;
    lastDir = d; const space = !a.state.onSurface; a.requestRoll(d);
    if (space && !a.shipRoll) return false; // the landing animation owns the ship
    if (!space) pending = { dir: d, until: performance.now() + 2500 };
    poll(); return true;
  },
  canRoll() { return rollReady(readState()); },
  isRolling() { const s = readState(); return !!(s && (s.rolling || s.shipRolling)); },
  on(evt, fn) {
    if (typeof fn !== 'function') throw new Error("SSX.airRoll.on(evt, fn): evt 'start' | 'end' | 'land' | 'crash' | '*'");
    if (!subs.has(evt)) subs.set(evt, new Set()); subs.get(evt).add(fn);
    return () => subs.get(evt)?.delete(fn);
  },
  off(evt, fn) { subs.get(evt)?.delete(fn); }
};

// index.html assigns window.SSX = {...} after module imports run, so (re)attach until it sticks
function attach() {
  const w = window; if (!w.SSX) w.SSX = {};
  if (w.SSX.airRoll !== airRoll) w.SSX.airRoll = airRoll;
  if (w.__app && w.__app.airRoll !== airRoll) w.__app.airRoll = airRoll;
}

function install() {
  if (document.getElementById('airRollBtn')) return;
  const css = document.createElement('style');
  css.textContent = '#airRollBtn{position:fixed;right:calc(168px + var(--sar,0px));bottom:calc(26px + var(--sab,0px));width:58px;height:58px;border-radius:50%;z-index:8;display:none;'
    + 'font-size:0.74rem;font-weight:800;color:#fff;line-height:1.05;padding:0;border:2px solid rgba(186,230,253,0.6);background:radial-gradient(circle at 40% 35%,rgba(56,189,248,0.62),rgba(12,74,110,0.62));'
    + 'touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}'
    + '#airRollBtn.on{background:radial-gradient(circle at 40% 35%,rgba(125,211,252,0.85),rgba(14,116,144,0.8))}'
    + 'body.touch.airroll #airRollBtn{display:block}'
    + '@media (max-height:700px){#airRollBtn{width:52px;height:52px;bottom:calc(18px + var(--sab,0px))}}';
  document.head.appendChild(css);
  const b = document.createElement('button');
  b.id = 'airRollBtn'; b.type = 'button'; b.setAttribute('aria-label', 'Barrel roll'); b.innerHTML = '🌀<br>Roll';
  document.body.appendChild(b);
  let pid = null, sx = 0, seen = 0;
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); if (pid !== null) return;
    pid = e.pointerId; sx = e.clientX; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {}
  });
  const end = (e, fire) => {
    if (e.pointerId !== pid) return; e.stopPropagation(); pid = null; b.classList.remove('on');
    if (!fire) return;
    if (airRoll.roll(rollDir(e.clientX - sx, app()?.joy?.x || 0) < 0 ? 'left' : 'right')) window.__airRollTaps = (window.__airRollTaps || 0) + 1;
  };
  b.addEventListener('pointerup', e => end(e, true));
  b.addEventListener('pointercancel', e => end(e, false));
  b.addEventListener('contextmenu', e => e.preventDefault());
  // desktop: Z rolls toward the A/D (or arrow) you're holding, else right
  const held = {};
  addEventListener('keyup', e => { held[e.code] = false; });
  addEventListener('keydown', e => {
    held[e.code] = true;
    if (e.code !== 'KeyZ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    const left = held.KeyA || held.ArrowLeft, right = held.KeyD || held.ArrowRight;
    airRoll.roll(left && !right ? 'left' : 'right');
  });
  setInterval(() => {
    attach(); poll();
    const s = snap, body = document.body; if (!s || !body) return;
    const v = { ...s, touch: body.classList.contains('touch'), cinematic: body.classList.contains('cinematic'), air: s.air || s.rolling };
    const now = performance.now(), want = rollVisible(v);
    if (want) seen = now;
    body.classList.toggle('airroll', want || pid !== null || (!!seen && now - seen < GRACE_MS && s.onSurface && s.driving));
  }, POLL_MS);
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  attach();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
}
