// v7.5.3 control mode (Collin): 'kbm' = Keyboard + Mouse (default), 'kb' = Keyboard only.
// Keyboard only: mouse look / mouse aim / canvas clicks are ignored and the pointer is never captured; the camera follows
// behind you (or your ride), arrow keys turn it, F fires with auto-aim at the nearest target in front. Menus stay
// clickable and keyboard-navigable. Hotkey O toggles (M is the menu, Q/E are weapon/interact). Pure: no three import.
export const CONTROL_KEY = 'ssx.controlMode';
export const MODES = { kbm: 'Keyboard + Mouse', kb: 'Keyboard only' };
export const TOGGLE_CODE = 'KeyO';
export const FIRE_CODE = 'KeyF';
export const KB_AIM_CONE = 0.6; // rad either side of where you face: "nearest target in front"
const subs = new Set();
let store = null; try { store = globalThis.localStorage || null; } catch (e) { store = null; }
let mode = (() => { try { const v = store?.getItem(CONTROL_KEY); return v in MODES ? v : 'kbm'; } catch (e) { return 'kbm'; } })();
export const getMode = () => mode;
export const kbOnly = () => mode === 'kb';
export const modeName = (m = mode) => MODES[m] || MODES.kbm;
export function setMode(m) {
  if (!(m in MODES)) return false;
  if (m === mode) return true;
  mode = m; try { store?.setItem(CONTROL_KEY, m); } catch (e) { /* private mode: session only */ }
  for (const f of subs) { try { f(m); } catch (e) { console.warn('control mode hook', e); } }
  return true;
}
export const toggleMode = () => { setMode(mode === 'kb' ? 'kbm' : 'kb'); return mode; };
export function onMode(fn) { subs.add(fn); return () => subs.delete(fn); }
export const toastText = (m = mode) => m === 'kb' ? '⌨️ Keyboard only: arrows turn the camera, F fires (auto-aim). O switches back.' : '🖱️ Keyboard + Mouse: click to look and aim. O for keyboard only.';
// should a keydown toggle the mode? (not while typing in a field, not with modifiers, not on auto-repeat)
export const isToggleKey = e => !!e && e.code === TOGGLE_CODE && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') && !e.target?.isContentEditable;
if (typeof window !== 'undefined') { window.SSX = window.SSX || {}; window.SSX.controls = { getMode, setMode, toggleMode, kbOnly, onMode, MODES }; }
