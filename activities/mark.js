// Vale's bounty: a real, moving mark for "Find the mark" (act-vale-scanner).
// prepTemplate (deadends.js) turns the template's `at_aj_random_in` step into a goto with `mark: MARK.id`;
// markTick (from activityTick) walks one named NPC between open-ground spots, hides the quest marker until you're
// within REVEAL_M or Vale's tip line lands, and moves the goto target onto the NPC so reaching them completes it.
import * as THREE from 'three';

import { MARK, REVEAL_M, TIP_S, REACH_M, markPos, revealed } from './markdata.js';
export { MARK, markPos, revealed };

let S = null, origWaypoint = null;
function figure() {
  const g = new THREE.Group(), coat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.9 }), skin = new THREE.MeshStandardMaterial({ color: 0xc98d6a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.8, 10), coat); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin); head.position.y = 1.62; g.add(head);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), dark); leg.position.set(0.12 * s, 0.35, 0); g.add(leg); }
  g.name = 'valeMark'; return g;
}
function drop(ctx) {
  if (!S) return;
  if (S.g) { S.g.parent?.remove(S.g); S.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  try { if (S.reserved) ctx?.world?.npcReserve?.('valeMark', 0); } catch {}
  S = null;
}
// returns the public state (tests read it via window.__activities.mark)
export function markTick(dt, ctx) {
  const g = ctx?.game, q = g?.debug?.quest?.(), s = q && g.debug.step?.();
  if (!s || s.mark !== MARK.id || ctx.name !== 'Mars') {
    if (S && q && S.qid === q.id && q.step === S.step + 1 && !S.handed) { S.handed = true; const t = q.target; if (t) { t.x = S.wx; t.z = S.wz; } } // the muscle shows up where she was
    if (S && (!q || q.id !== S.qid || q.step > S.step + 1)) drop(ctx);
    return null;
  }
  const W = ctx.world;
  if (!S || S.qid !== q.id || S.step !== q.step) {
    drop(ctx);
    S = { qid: q.id, step: q.step, t: Math.random() * 30, search: 0, tipped: false, found: false, g: null, reserved: false };
    if (!origWaypoint && typeof g.waypoint === 'function') { // the marker stays off until she's revealed
      origWaypoint = g.waypoint; const ow = origWaypoint;
      g.waypoint = () => { const st = g.debug?.step?.(); return st?.mark && S && !S.show ? null : ow(); };
    }
  }
  S.t += dt; S.search += dt;
  const p = markPos(S.t), w = W?.colonyAt?.([p.x, p.z]); if (!w) return null;
  S.wx = w.x; S.wz = w.z;
  // NPC budget: one slot while she's around; if the phone is full she waits (logic keeps running, no body)
  if (!S.g) {
    const b = W.npcBudget?.(); if (!b || b.free >= 1 || b.reserved?.valeMark) {
      try { W.npcReserve?.('valeMark', 1); S.reserved = true; } catch {}
      S.g = figure(); ctx.scene.add(S.g);
    }
  }
  if (S.g) { S.g.position.set(w.x, ctx.height(w.x, w.z), w.z); if (p.yaw != null) S.g.rotation.y = p.yaw; S.g.children[0].position.y = 1.05 + (p.moving ? Math.abs(Math.sin(S.t * 6)) * 0.04 : 0); }
  const P = ctx.car || ctx.player, d = Math.hypot(P.x - w.x, P.z - w.z);
  if (!S.tipped && S.search >= TIP_S) { S.tipped = true; try { const R = window.SSX?.city?.radio || window.__app?.radio; R?.(MARK.tip.replace(/^[A-Z][\w .]{0,20}:\s*/, ''), 'Detective Vale'); } catch {} }
  const was = S.show; S.show = revealed(d, S.search, S.tipped);
  if (S.show && !was && !S.tipped) { try { window.__app?.toast?.(`◆ That's ${MARK.name}. Orange coat ➤ close in.`, 2500); } catch {} }
  const t = q.target; if (t) { t.x = w.x; t.z = w.z; t.r = S.show ? REACH_M : -1e9; } // hidden: can't complete on a ghost marker
  if (S.show && d < REACH_M + 1.2) S.found = true;
  return pub();
}
export function pub() { return S && { name: MARK.name, x: S.wx, z: S.wz, show: !!S.show, tipped: S.tipped, search: +S.search.toFixed(1), body: !!S.g, found: S.found }; }
export function debugTip() { if (S) S.search = TIP_S; }
