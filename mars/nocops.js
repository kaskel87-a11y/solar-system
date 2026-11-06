// No ordinary ColSec at Red Static Gulch (v7.5.73). Rules: mars/nocopscore.js. Publishes the shared bounds check
//   window.SSX.copFree(x, z)            -> true inside the gulch on Mars (ordinary police never trigger or enter there)
//   window.SSX.copFree.out(x, z, pad)   -> {x, z} just outside the edge, or null when already outside
//   window.SSX.copFree.zone()           -> { x, z, r, name } in world metres, or null off Mars
//   window.SSX.copFree.note(path)       -> callers count what they held back (tests read .stats())
// Callers guard it (typeof === 'function'), so without this file nothing changes. Never touches wanted, saves or the Pit.
import * as K from './nocopscore.js';

const app = () => window.__app, surf = () => app()?.surface;
const fin = Number.isFinite;
const stats = {};
function zone() {
  const s = surf(), i = s?.info; if (!i || i.name !== 'Mars') return null;
  const c = i.colony || s.world?.colony; return K.zoneW(c);
}
function copFree(x, z) { try { return K.inside(zone(), +x, +z); } catch (e) { return false; } }
copFree.out = (x, z, pad = K.PAD) => { try { return K.pushOut(zone(), +x, +z, pad); } catch (e) { return null; } };
copFree.zone = () => { const z = zone(); return z ? { ...z, name: K.ZONE.name } : null; };
copFree.note = k => { const key = String(k || 'other').slice(0, 24); stats[key] = (stats[key] || 0) + 1; return stats[key]; };
copFree.stats = () => ({ ...stats });
copFree.reset = () => { for (const k of Object.keys(stats)) delete stats[k]; return true; };
copFree.scriptedOk = K.scriptedOk;
copFree.here = () => { const i = surf()?.info; return !!i && fin(i.x) && fin(i.z) && copFree(i.x, i.z); };
copFree.ZONE = K.ZONE;
const attach = () => { if (!window.SSX) window.SSX = {}; if (window.SSX.copFree !== copFree) window.SSX.copFree = copFree; };
attach(); setInterval(attach, 2000);
