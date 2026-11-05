// Bar contact runtime (data + rules: mars/barcontactcore.js). Ticked from mars/heisttip.js.
// One named NPC by the Cantina door. Context button (in #surfBtns, hidden unless you're next to Juno) gives the
// Halvorsen tip through the radio and marks the tip as given, so Sable's text never doubles up.
import * as THREE from 'three';
import { tap } from '../racehooks.js';
import { CONTACT, LABEL, offer, lineFor } from './barcontactcore.js';

let B = null, btn = null, shown = false, give = null, lastLine = null, dist = Infinity;
const slots = () => globalThis.SSX?.npcSlots;
function figure() {
  const g = new THREE.Group(), m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const jacket = m(0x2f6b5a), dark = m(0x1c1a22), skin = m(0x8d5a3c), hat = m(0xc9a227);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.82, 10), jacket); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin); head.position.y = 1.64; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), hat); cap.position.y = 1.8; g.add(cap);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), dark); leg.position.set(0.12 * s, 0.35, 0); g.add(leg); }
  g.name = 'barContact'; return g;
}
function drop() {
  if (!B) return;
  B.g?.parent?.remove(B.g); B.g?.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  if (B.held) { const S = slots(); if (S?.release) S.release('barContact'); else { try { B.world?.npcReserve?.('barContact', 0); } catch (e) {} } }
  B = null;
}
function ensureBtn() {
  if (btn || typeof document === 'undefined') return btn;
  btn = document.createElement('button'); btn.id = 'barContactBtn'; btn.className = 'glass'; btn.type = 'button'; btn.textContent = LABEL;
  btn.style.cssText = 'display:none;height:44px;font-size:0.72rem;touch-action:manipulation;background:rgba(30,110,90,0.7);border-color:rgba(120,255,210,0.55)';
  const sb = document.getElementById('surfBtns'); if (sb) sb.insertBefore(btn, sb.firstChild); else document.body.appendChild(btn);
  tap(btn, () => talk());
  addEventListener('keydown', e => { if (e.code === 'KeyG' && !e.repeat && shown && !document.getElementById('heistBtn')?.offsetParent) { e.preventDefault(); talk(); } });
  return btn;
}
function talk() {
  if (!shown || !give) return null;
  const r = give(); if (!r?.ok) return null;
  lastLine = lineFor({ tipped: r.already });
  try { const R = window.SSX?.city?.radio || window.__app?.radio; R?.(lastLine, CONTACT.name); } catch (e) {}
  return { ...r, line: lastLine };
}
// tipApi: { state() -> { unlocked, tipped } | null, give() -> { ok, already } } from heisttip.js
export function barContactTick(dt, ctx, tipApi) {
  give = tipApi?.give || null;
  const W = ctx?.name === 'Mars' ? ctx.world : null;
  if (!W || !ctx.scene) { dist = Infinity; drop(); setShown(false); return; }
  if (B && (B.world !== W || B.g?.parent !== ctx.scene)) drop();
  const c = W.colonyAt?.(CONTACT.at); if (!c) return;
  const P = ctx.car || ctx.player, d = Math.hypot(P.x - c.x, P.z - c.z), st = tipApi?.state?.(); dist = d;
  if (d > CONTACT.bodyR + 10) { drop(); setShown(false); return; }
  if (!B && d <= CONTACT.bodyR) B = { world: W, g: null, held: false, x: c.x, z: c.z };
  if (B) {
    const critical = !!st?.unlocked; // after the unlock Juno has a job for you, so they always show
    if (!B.g) {
      const S = slots(), n = S?.grant ? S.grant('barContact', 1, critical) : (() => { const b = W.npcBudget?.(); return !b || b.free >= 1 ? 1 : 0; })();
      if (n) {
        if (S?.reserve) S.reserve('barContact', 1, critical ? { critical: true, active: () => !!B } : {}); else { try { W.npcReserve?.('barContact', 1); } catch (e) {} }
        B.held = true; B.critical = critical; B.g = figure(); ctx.scene.add(B.g);
      }
    } else if (critical && !B.critical) { slots()?.reserve?.('barContact', 1, { critical: true, active: () => !!B }); B.critical = true; }
    if (B.g) { B.g.position.set(c.x, ctx.height(c.x, c.z), c.z); B.g.rotation.y = Math.atan2(-(P.x - c.x), -(P.z - c.z)); }
  }
  const heist = !!globalThis.SSX?.heist?.active?.id;
  setShown(offer(st, d, { driving: !!ctx.car, indoors: !!ctx.world?.inside || document.body.classList.contains('indoors'), heist }));
}
function setShown(v) { if (v === shown && (!v || btn)) return; shown = v; const b = v ? ensureBtn() : btn; if (b) b.style.display = v ? 'block' : 'none'; }
// Sable's text holds off while you're right at Juno's door: Juno tells you in person
export const barContactNear = () => dist < CONTACT.holdR;
export function barContactPub() { return { name: CONTACT.name, near: shown, body: !!B?.g, x: B?.x ?? null, z: B?.z ?? null, line: lastLine }; }
if (typeof window !== 'undefined') window.__barContact = { get state() { return barContactPub(); }, talk: () => talk() };
