// Single entry point for add-on game modes, called once per surface frame from surface.js (next to raceTick).
// raids tick first so the generic SSX.raids engine works for any caller, even when no mode is active.
import { raidsTick } from './raids.js?v=7.5.1';
import { ragsTick } from './rags.js?v=7.5.1';
export function modeTick(dt, ctx) {
  try { raidsTick(dt, ctx); } catch (e) { if (!modeTick.e1) { modeTick.e1 = 1; console.warn('[modes] raids', e); } }
  try { ragsTick(dt, ctx); } catch (e) { if (!modeTick.e2) { modeTick.e2 = 1; console.warn('[modes] rags', e); } }
}
