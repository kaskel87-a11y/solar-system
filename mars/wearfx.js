// v7.5.96: the worn skin's effect. Looks are mars/skins.js. Numbers are wearfxcore.js.
// surface.js reads move() each step. game.js reads melee() on a punch. jetpack.js reads jet().
import * as W from './wearfxcore.js';

const SSX = () => (typeof window !== 'undefined' ? window.SSX : null);
const worn = () => { try { return SSX()?.skins?.equipped || ''; } catch (e) { return ''; } };
let mouthAt = 0;

export function move() { return W.moveOf(worn()); }
export function melee() { return W.meleeOf(worn()); }
export function jet() { return W.jetOf(worn()); }
export function onPunch() {
  const id = worn(); if (id !== 'merc' && id !== 'dino') return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - mouthAt < 7000) return; mouthAt = now;
  const line = id === 'dino' ? 'The suit growls.' : W.MOUTH[(Math.random() * W.MOUTH.length) | 0];
  try { window.__app?.toast?.(`👕 ${line}`, 1600); } catch (e) { /* */ }
}
function onEquip(e) {
  const id = e?.id; const f = W.fxOf(id); if (!f) return;
  try { window.__app?.toast?.(`👕 ${f.line} ${W.HOW}`, 4200); } catch (err) { /* */ }
}
function boot() {
  const S = SSX(); if (!S) { setTimeout(boot, 300); return; }
  if (S.wear) return;
  S.wear = { move, melee, jet, onPunch, fx: W.fxOf, HOW: W.HOW, IDS: W.IDS.slice() };
  try { S.skins?.on?.(onEquip); } catch (e) { /* skins not up yet */ setTimeout(() => { try { S.skins?.on?.(onEquip); } catch (err) { /* */ } }, 800); }
}
if (typeof window !== 'undefined') boot();
