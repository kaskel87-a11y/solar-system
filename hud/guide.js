// v7.5.85: one edge pointer for every mission, job, heist and space run.
// Call SSX.guide.aim({ id, label, nx, ny }) with NDC (y up), or aimGround({ x, z, label })
// in surface metres, or aimMars(marsWorld, framePos, label, dist) for an orbital target.
// If nobody aims this frame, the pointer follows SSX.hudx.objective() on the ground.
// The pill stays out of the middle of the screen and off the joystick.
import * as THREE from 'three';
import { edgePointer, fmtRange, bearingNdc } from './guidecore.js';

const CSS = `#ssxGuide{position:fixed;z-index:20;display:none;align-items:center;gap:4px;min-height:44px;max-width:42vw;box-sizing:border-box;padding:4px 10px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 13px/1.15 system-ui,sans-serif;pointer-events:none;transform:translate(-50%,-50%);white-space:nowrap}
#ssxGuide.on{display:flex}#ssxGuide i{display:block;width:22px;font-style:normal;font-size:18px;line-height:22px;text-align:center}`;

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
  if (!(r.right > L && r.left < Rg && r.bottom > T && r.top < B)) return;
  const ny = Math.max(58 + r.height / 2, T - 8 - r.height / 2);
  const nx = margin + r.width / 2;
  place(nx, ny);
}
function show(spec) {
  const node = ensure(); if (!node || !spec) { node?.classList.remove('on'); last = null; return null; }
  const spot = edgePointer(spec.nx, spec.ny, innerWidth, innerHeight);
  const label = spec.label || '';
  node.classList.add('on');
  const sp = node.querySelector('span'); if (sp.textContent !== label) sp.textContent = label;
  node.querySelector('i').style.transform = `rotate(${spot.ang}rad)`;
  node.style.left = spot.x + 'px'; node.style.top = spot.y + 'px';
  shove(node);
  const box = node.getBoundingClientRect();
  last = { id: spec.id || '', label, x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
  return last;
}
function hide() { el?.classList.remove('on'); last = null; }

function aim(spec) {
  if (!spec) return clear();
  pin = spec; pinAt = performance.now();
  return show(spec);
}
function clear(id) {
  if (id && pin && pin.id !== id) return last;
  pin = null; pinAt = 0; hide(); return null;
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
function groundFallback() {
  const app = window.__app, on = app?.state?.onSurface;
  if (!on || document.body.classList.contains('indoors')) return null;
  let ob = null;
  try { ob = window.SSX?.hudx?.objective?.(); } catch (e) { ob = null; }
  if (!ob) return null;
  return groundSpec({ id: 'objective', x: ob.x, z: ob.z, label: '' });
}
function tick() {
  if (pin && performance.now() - pinAt < 400) show(pin);
  else { const g = groundFallback(); if (g) show(g); else hide(); }
  requestAnimationFrame(tick);
}

const api = {
  aim, clear, aimGround, aimMars, fmtRange,
  get state() { return last; }
};
if (typeof window !== 'undefined') {
  window.SSX = window.SSX || {};
  window.SSX.guide = api;
  if (document.body) ensure(); else addEventListener('DOMContentLoaded', ensure, { once: true });
  requestAnimationFrame(tick);
}
export default api;
