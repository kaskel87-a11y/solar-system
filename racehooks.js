// THE ONE PLACE race.js / trackbuilder.js talk to core, same pattern as steve/multi-planet's planets/hooks.js.
// Grok Bot's generic hooks (registerMission / registerColony / menu items) are expected on main later; each wrapper
// uses the real core hook when it exists and otherwise falls back to the v7.2 DOM/registries, so after that lands
// only this file needs to change. Import URLs must match the core's ?v= exactly (shared module instances).
//
// The per-frame hook can't come from here: race.js needs the surface's private scene/camera/player/car, so surface.js
// calls raceTick(dt, ctx) directly (one import + one call). If core grows a registerSurfaceTick(fn) it can move here.
export { buildVehicle, VEHICLES } from './world.js?v=7.5.1';
export { QUESTS } from './game.js?v=7.5.1';

// ☰ menu: app.registerMenuItem({ id, label, onTap }) if core provides it; else inject a .btn into #roverMenu above Settings.
export function addMenuItem(app, { id, label, onTap }) {
  if (typeof app?.registerMenuItem === 'function') { const r = app.registerMenuItem({ id, label, onTap }); return r || document.getElementById(id); }
  const menu = document.getElementById('roverMenu'), before = document.getElementById('settingsBtn');
  const btn = document.createElement('button'); btn.id = id; btn.className = 'btn'; btn.textContent = label;
  if (menu) menu.insertBefore(btn, before && before.parentNode === menu ? before : null);
  tap(btn, () => { if (app?.toggleMenu) app.toggleMenu(false); else menu?.classList.remove('show'); onTap(); });
  return btn;
}
// pointer-based tap: fires on pointerup of the same pointer, so a thumb resting on the joystick doesn't block it
// (iOS WebKit drops the synthetic click while another finger is down). Mouse/keyboard still use click.
export function tap(el, fn) {
  let id = null, last = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; e.preventDefault(); id = e.pointerId; });
  el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' || e.pointerId !== id) return; e.preventDefault(); id = null; last = performance.now(); fn(e); });
  el.addEventListener('pointercancel', () => { id = null; });
  // the follow-up click of a touch (a plain MouseEvent on older WebKit) must not fire it twice
  el.addEventListener('click', e => { if ((e.pointerType && e.pointerType !== 'mouse') || performance.now() - last < 700) return; fn(e); });
}
