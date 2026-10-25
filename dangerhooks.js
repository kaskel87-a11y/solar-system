// THE ONE PLACE danger.js / pursuit.js touch core (same shim pattern as racehooks.js and planets/hooks.js).
// Import URLs must match the core's ?v= exactly so we share module instances.
//
// The per-frame hook comes from surface.js: dangerTick(dt, ctx) (one import + one call, next to raceTick).
// Everything else is wrapped here at runtime, once per world object:
//   world.hitWorld / targets / meleeTarget / meleeWorld / blast  -> our muggers, fighters and street-chase cars are hittable
// If core grows registerHittable(fn) / registerSurfaceTick(fn), only this file changes.
export { buildVehicle, VEHICLES } from './world.js';

// ☰ menu: v7.3 has window.SSX.registerMenuItem; fall back to injecting a .btn above Settings
export function addMenuItem({ id, label, onTap }) {
  if (typeof window.SSX?.registerMenuItem === 'function') { const bid = window.SSX.registerMenuItem({ id, label, onClick: () => onTap() }); return document.getElementById(bid); }
  const menu = document.getElementById('roverMenu'), before = document.getElementById('settingsBtn');
  const b = document.createElement('button'); b.id = id; b.className = 'btn'; b.textContent = label;
  menu?.insertBefore(b, before && before.parentNode === menu ? before : null);
  b.onclick = () => { menu?.classList.remove('show'); onTap(); }; return b;
}

// pointer-based tap: fires on pointerdown (a thumb resting on the joystick never blocks it; iOS WebKit drops synthetic
// clicks during multi-touch) and swallows the ghost click that follows a touch. Keyboard activation still works.
let ghostUntil = 0;
if (typeof document !== 'undefined') document.addEventListener('click', e => { if (e.detail !== 0 && performance.now() < ghostUntil) { e.preventDefault(); e.stopPropagation(); ghostUntil = 0; } }, true);
export function tapButton(el, fn) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (e.pointerType !== 'mouse') ghostUntil = performance.now() + 650; fn(e); });
  el.addEventListener('click', e => { if (e.detail === 0) fn(e); });
  el.addEventListener('contextmenu', e => e.preventDefault());
}

// world wrapper: providers return lists of hittables { x, y, z, r, hit(dmg, kind, from) -> true, alive, hostile, kind }
const patched = new WeakSet();
export function patchWorld(world, providers) {
  if (!world || patched.has(world)) return; patched.add(world);
  const all = () => { const out = []; for (const p of providers) out.push(...p()); return out.filter(h => h.alive); };
  const oHit = world.hitWorld, oTargets = world.targets, oMT = world.meleeTarget, oMW = world.meleeWorld, oBlast = world.blast;
  const segD = (p0, p1, c) => { const sx = p1.x - p0.x, sy = p1.y - p0.y, sz = p1.z - p0.z, L2 = sx * sx + sy * sy + sz * sz;
    const t = L2 ? Math.max(0, Math.min(1, ((c.x - p0.x) * sx + (c.y - p0.y) * sy + (c.z - p0.z) * sz) / L2)) : 0;
    return Math.hypot(p0.x + sx * t - c.x, p0.y + sy * t - c.y, p0.z + sz * t - c.z); };
  world.hitWorld = (p0, p1, b) => {
    let best = null, bd = 1e9;
    for (const h of all()) { const d = segD(p0, p1, h); if (d < h.r) { const k = Math.hypot(h.x - p0.x, h.z - p0.z); if (k < bd) { bd = k; best = h; } } }
    if (best) { best.hit(b.dmg, 'shot', p0); return true; }
    return oHit(p0, p1, b);
  };
  world.targets = () => [...oTargets(), ...all().filter(h => h.hostile).map(h => ({ x: h.x, y: h.y, z: h.z, kind: h.kind }))];
  world.meleeTarget = (x, z, yaw, range) => {
    const w = oMT(x, z, yaw, range); let best = null, bd = w ? Math.hypot(w.x - x, w.z - z) : range;
    for (const h of all()) { if (h.car) continue; const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = { x: h.x, z: h.z, kind: h.kind }; } }
    return best || w;
  };
  world.meleeWorld = (x, z, fx, fz, range, dmg, knock) => {
    for (const h of all()) { if (h.car) continue; const dx = h.x - x, dz = h.z - z, d = Math.hypot(dx, dz);
      if (d < range + 0.5 && dx * fx + dz * fz > -0.3) { h.hit(dmg, 'melee', { x, z }, knock); return true; } }
    return oMW(x, z, fx, fz, range, dmg, knock);
  };
  world.blast = (c, R, dmg, emp) => {
    let n = 0; for (const h of all()) { const d = Math.hypot(h.x - c.x, h.z - c.z); if (d < R) { n++; h.hit(emp ? 0.5 : dmg * (1 - d / R), emp ? 'emp' : 'blast', c); } }
    return n + oBlast(c, R, dmg, emp);
  };
}
