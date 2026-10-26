// Pure logic for the junkyard-lab pack, part 2 (sci-06..10): stalker hazards, collapsing dimensions, Raccoon Mobile
// steps and the rift-drive portal. No three.js, no DOM; unit-tested by tests/test-scientists2-unit.mjs.
import { stepRun, hazardPos } from './scicore.js';

export const SCI2_IDS = ['sci-06', 'sci-07', 'sci-08', 'sci-09', 'sci-10'];
export const RIFT_TUNE = { vmax: 3, boost: 4 }; // sci-10 reward: the Raccoon Mobile comes back rift-tuned

// ---- stalker: walks toward you at `speed` m/s from its start spot, stays inside the room, never stops ----
export function stalkerPos(run, i, h) {
  run.sp = run.sp || {};
  return run.sp[i] || (run.sp[i] = { x: h.x, z: h.z });
}
export function moveStalkers(run, def, lx, lz, dt) {
  (def.hazards || []).forEach((h, i) => {
    if (h.kind !== 'stalker') return;
    const p = stalkerPos(run, i, h), dx = lx - p.x, dz = lz - p.z, L = Math.hypot(dx, dz);
    if (L > 0.05) { const k = Math.min(L, h.speed * dt) / L; p.x += dx * k; p.z += dz * k; }
    const hw = def.w / 2 - 0.6, hd = def.d / 2 - 0.6; p.x = Math.max(-hw, Math.min(hw, p.x)); p.z = Math.max(-hd, Math.min(hd, p.z));
  });
}
// where hazard i is right now (lanes/geysers from scicore, stalkers from the run)
export function hazardAt(h, run, i) {
  if (h.kind === 'stalker') { const p = stalkerPos(run, i, h); return { x: p.x, z: p.z, on: true }; }
  return hazardPos(h, run.t);
}
// stepRun + stalkers + an optional collapse timer (def.limit seconds; then you're thrown out and the run resets)
export function stepRun2(run, def, lx, lz, dt) {
  if (run.inert) return stepRun(run, def, lx, lz, dt);
  moveStalkers(run, def, lx, lz, dt);
  const flat = (def.hazards || []).map((h, i) => h.kind === 'stalker' ? (p => ({ axis: 'x', at: p.z, c: p.x, amp: 0, speed: 0, r: h.r, dmg: h.dmg, line: h.line }))(stalkerPos(run, i, h)) : h);
  const ev = stepRun(run, { ...def, hazards: flat }, lx, lz, dt);
  if (def.limit && !run.done && !run.collapsed) {
    const left = def.limit - run.t;
    if (left <= 0) { run.collapsed = true; ev.push({ type: 'collapse' }); }
    else if (Math.ceil(left) !== run.lastLeft && (Math.ceil(left) % 10 === 0 || left <= 5)) { run.lastLeft = Math.ceil(left); ev.push({ type: 'clock', left: Math.ceil(left) }); }
  }
  return ev;
}
export const clockLabel = (base, run, def) => def?.limit && run && !run.done ? `${base} · ${Math.max(0, Math.ceil(def.limit - run.t))}s` : base;

// ---- 'rdrive' step: be at the target IN the Raccoon Mobile. Any other car (or on foot) doesn't count ----
export function raccoonArrived(step, carKind, d, reach = 2.5) {
  if (step?.type !== 'rdrive') return false;
  return carKind === 'raccoon_mobile' && d < (step.r ?? 6) + reach;
}
// what the hint should say when you're near the target in the wrong ride
export function rdriveHint(step, carKind, d) {
  if (step?.type !== 'rdrive' || d > (step.r ?? 6) + 8) return null;
  if (!carKind) return 'Silas wants it brought in the Raccoon Mobile.';
  if (carKind !== 'raccoon_mobile') return "Wrong ride. Silas only trusts the Raccoon Mobile with this.";
  return null;
}
// ---- rift drive: from sci-09 on, the Raccoon Mobile can drive straight into a portal step that allows it ----
export function riftDrive(step, carKind, d, done09) {
  if (step?.type !== 'portal' || carKind !== 'raccoon_mobile') return false;
  if (!(step.raccoon || done09)) return false;
  return d < 2.6;
}
