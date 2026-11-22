// v7.5.85: one edge pointer for every mission, job, heist and space run.
// Call SSX.guide.aim({ id, label, nx, ny }) with NDC (y up), or aimGround({ x, z, label })
// in surface metres, or aimMars(marsWorld, framePos, label, dist) for an orbital target.
// If nobody aims this frame, the pointer follows SSX.hudx.objective() on the ground.
// The pill stays out of the middle of the screen and off the joystick.
import * as THREE from 'three';
import { edgePointer, fmtRange, bearingNdc, chipLabel } from './guidecore.js';

const CSS = `#ssxGuide{position:fixed;z-index:20;display:none;align-items:center;gap:4px;width:max-content;max-width:min(78vw,280px);box-sizing:border-box;padding:4px 10px;border-radius:12px;background:#000;color:#fff;border:2px solid #38e1ff;font:800 13px/1.2 system-ui,sans-serif;pointer-events:none;transform:translate(-50%,-50%)}
#ssxGuide.on{display:flex}#ssxGuide i{display:block;width:22px;flex:none;font-style:normal;font-size:18px;line-height:22px;text-align:center;color:#38e1ff}#ssxGuide span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(62vw,240px)}#ssxGuide .hxFull{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}`;

let el = null, pin = null, pinAt = 0, last = null;
const _w = new THREE.Vector3(), _to = new THREE.Vector3(), _fwd = new THREE.Vector3();

function ensure() {
  if (el || typeof document === 'undefined') return el;
  const st = document.createElement('style'); st.id = 'ssxGuideCss'; st.textContent = CSS; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'ssxGuide'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i>▲</i><span></span>'; document.body.appendChild(el);
  return el;
}
function shove(node) {
  const margin = 8, W = innerWidth, H = innerHeight;
  const L = W * 0.25, Rg = W * 0.75, T = H * 0.25, B = H * 0.75, floor = H - 128;
  const place = (x, y) => { node.style.left = x + 'px'; node.style.top = y + 'px'; };
  let x = parseFloat(node.style.left), y = parseFloat(node.style.top);
  let r = node.getBoundingClientRect();
  if (r.left < margin) x += margin - r.left;
  if (r.right > W - margin) x -= r.right - (W - margin);
  if (r.top < 58) y += 58 - r.top;
  if (r.bottom > floor) y -= r.bottom - floor;
  place(x, y); r = node.getBoundingClientRect();
  if (r.right > L && r.left < Rg && r.bottom > T && r.top < B) {
    const ny = Math.max(58 + r.height / 2, T - 8 - r.height / 2);
    const nx = margin + r.width / 2;
    place(nx, ny); r = node.getBoundingClientRect();
  }
  // Keep the arrow off the mission card. Park it under the minimap, on the left.
  const stack = document.getElementById('stackR')?.getBoundingClientRect();
  const more = document.getElementById('hxMore')?.getBoundingClientRect();
  const block = Math.max(stack && stack.width > 8 ? stack.bottom : 0, more && more.width > 8 ? more.bottom : 0);
  const hitsStack = stack && stack.width > 8 && r.right > stack.left + 4 && r.left < stack.right - 4 && r.bottom > stack.top + 4 && r.top < stack.bottom - 4;
  const hitsMore = more && more.width > 8 && r.right > more.left + 4 && r.left < more.right - 4 && r.bottom > more.top + 4 && r.top < more.bottom - 4;
  if (hitsStack || hitsMore) {
    const y2 = Math.min(Math.max(block + 8 + r.height / 2, 72 + r.height / 2), floor - r.height / 2);
    place(margin + r.width / 2, y2);
  }
}
function show(spec) {
  const node = ensure(); if (!node || !spec) { node?.classList.remove('on'); last = null; return null; }
  const spot = edgePointer(spec.nx, spec.ny, innerWidth, innerHeight);
  const label = spec.label || '';
  node.classList.add('on');
  node.dataset.full = label;
  // v7.5.118: keep the objective's name. A long line used to become only "◆ 120 m".
  const short = chipLabel(label) || label;
  const sp = node.querySelector('span'); if (sp.textContent !== short) sp.textContent = short;
  let full = node.querySelector('.hxFull'); if (!full) { full = document.createElement('b'); full.className = 'hxFull'; node.appendChild(full); }
  if (full.textContent !== label) full.textContent = label;
  node.querySelector('i').style.transform = `rotate(${spot.ang}rad)`;
  node.style.left = spot.x + 'px'; node.style.top = spot.y + 'px';
  shove(node);
  const box = node.getBoundingClientRect();
  last = { id: spec.id || '', label, x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
  return last;
}
function hide() { el?.classList.remove('on'); last = null; }

const HINTS = new Set(['backroom']); // the street-good lesson. Ines is a live arrow. A taken job outranks both.
const JOBS = new Set(['lounge', 'silt', 'heist']);
const pins = new Map();
function lessonLabel(t) { return /street good|back booth/i.test(String(t || '')); }
function aim(spec) {
  if (!spec) return clear();
  const id = spec.id || 'pin';
  pins.set(id, { spec, at: performance.now() });
  pin = spec; pinAt = performance.now();
  if (offerUp()) return last;
  const next = pick();
  return next ? show(next) : (hide(), null);
}
function clear(id) {
  if (id) {
    if (!pins.has(id)) return last;
    pins.delete(id);
    if (pin?.id === id) { pin = null; pinAt = 0; }
  } else { pins.clear(); pin = null; pinAt = 0; }
  if (offerUp()) { hide(); return null; }
  const next = pick();
  return next ? show(next) : (hide(), null);
}
function groundSpec(spec) {
  const i = window.__app?.surface?.info; if (!spec || !i || !Number.isFinite(i.x)) return null;
  const dx = spec.x - i.x, dz = spec.z - i.z, dist = Math.hypot(dx, dz);
  if (dist < 12) return null;
  const b = bearingNdc(dx, dz, i.viewYaw || 0);
  const label = spec.label ? `${spec.label} ${fmtRange(dist)}` : fmtRange(dist);
  return { id: spec.id || 'ground', label, nx: b.nx, ny: b.ny, dist };
}
function aimGround(spec) {
  const g = groundSpec(spec);
  if (!g) return clear(spec?.id);
  return aim(g);
}
function aimMars(mp, pos, label, dist, id) {
  const cam = window.__app?.camera;
  if (!cam || !mp || !pos) return aim({ id: id || 'space', label: label || 'Take off', nx: 0, ny: 0.94 });
  _w.set(mp[0] + pos[0], mp[1] + pos[1], mp[2] + pos[2]);
  _fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
  _to.copy(_w).sub(cam.position);
  const behind = _to.dot(_fwd) <= 0;
  _w.project(cam);
  let nx = _w.x, ny = _w.y;
  if (behind) { nx = -nx; ny = -ny; }
  return aim({ id: id || 'space', label, nx, ny, dist });
}
function objectiveNow() {
  try { return window.__app?.state?.onSurface && window.SSX?.hudx?.objective?.() || null; } catch (e) { return null; }
}
function realObjective(ob) {
  if (!ob) return null;
  // The back-booth lesson used to plant itself as the map waypoint. That is not the player's objective.
  if (ob.kind === 'waypoint' && lessonLabel(ob.label)) return null;
  return ob;
}
function groundFallback() {
  const app = window.__app, on = app?.state?.onSurface;
  if (!on) return null;
  const ob = realObjective(objectiveNow());
  if (!ob) return null;
  return groundSpec({ id: 'objective', x: ob.x, z: ob.z, label: ob.label || 'Objective' });
}
function missionPointer() {
  // Quest, job, turf, race, or a waypoint the player (or a job) set. Indoors too: the staff room and the Pit still count.
  const ob = realObjective(objectiveNow());
  if (!ob) return null;
  return groundSpec({ id: 'objective', x: ob.x, z: ob.z, label: ob.label || 'Objective' });
}
function freshPin(hint) {
  let best = null;
  const now = performance.now();
  for (const [id, p] of pins) {
    if (HINTS.has(id) !== hint) continue;
    if (now - p.at > (hint ? 900 : 900)) continue;
    if (!best || p.at > best.at) best = p;
  }
  return best?.spec || null;
}
function freshJob() {
  let best = null;
  const now = performance.now();
  for (const [id, p] of pins) {
    if (!JOBS.has(id) || now - p.at > 900) continue;
    if (!best || p.at > best.at) best = p;
  }
  return best?.spec || null;
}
function pick() {
  const job = freshJob();
  if (job) return job;
  const live = freshPin(false);
  const indoors = document.body.classList.contains('indoors');
  // Indoors, the room's own arrow (staff room, Pit seat) is in room space. A world waypoint would point the wrong way.
  if (indoors && live) return live;
  const mission = missionPointer();
  if (mission && !indoors) return mission;
  if (live) return live;
  const hint = freshPin(true);
  if (indoors && hint) return hint;
  if (realObjective(objectiveNow())) return null;
  return hint;
}
function offerUp() {
  const r = document.getElementById('radio'), b = document.getElementById('radioBtns');
  return !!r && r.classList.contains('mission') && r.style.display !== 'none' && !!b && getComputedStyle(b).display !== 'none';
}
function tick() {
  // An offer card is the call. A side hint stays off it. Once you accept, the objective arrow comes back.
  if (offerUp()) { hide(); requestAnimationFrame(tick); return; }
  const next = pick();
  if (next) show(next);
  else { const g = groundFallback(); if (g) show(g); else hide(); }
  requestAnimationFrame(tick);
}

const api = {
  aim, clear, aimGround, aimMars, fmtRange, chipLabel,
  get state() { return last; }
};
if (typeof window !== 'undefined') {
  window.SSX = window.SSX || {};
  window.SSX.guide = api;
  if (document.body) ensure(); else addEventListener('DOMContentLoaded', ensure, { once: true });
  requestAnimationFrame(tick);
}
export default api;
