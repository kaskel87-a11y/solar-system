// Pure logic for the junkyard-lab pack (no three.js, no DOM): coordinates, portal trigger, dimension objective runs.
// Unit-tested by tests/test-scientists-unit.mjs. Everything that touches the engine lives in scihooks.js.

// ---- Ares Junction-relative coordinates (x east, z south; same frame as mission `at`) ----
// Clear of Steve's mars-city pack: AJ landmarks (cantina [31,-17], Ozzie's [16,-38], security [6,-28], Rook [36,-26],
// AJ Trust [-4,-40], Meridian tower [-4,-52]) and the Ares Beltway polyline ([0,-55]..[0,60]..[80,40]); see docs/SCIENTISTS.md.
export const LAB_AT = [46, -34];
// [x, z, w, d, h, sign, colour, interior kind, inside title]; the door is the middle of the +z face (z = -34 + 2.5 + 0.9)
export const LAB_BLOCK = [46, -34, 8, 5, 5, 'JUNKYARD LAB', 0xffa020, 'scilab', 'MUCKRIDGE APPLIED CATASTROPHICS'];
export const PORTAL_AT = [55, -22];
export const JUNK_AT = [[51, -28], [40, -45], [55, -13]];
export const RACCOON_PARK = [-36, -7, 0.35]; // out front of the Meridian Depot ([-44,-14]), clear of the pad ([-38,10] r9)
export const SCI_IDS = ['sci-01', 'sci-02', 'sci-03', 'sci-04', 'sci-05'];

// ---- portal: walk in to go through. Edge-triggered so you don't bounce straight back in after you come out ----
export function portalTrigger(state, d, rIn = 1.6, rArm = 3.2) {
  if (d > rArm) state.armed = true;
  if (state.armed && d < rIn) { state.armed = false; return true; }
  return false;
}

// ---- hazards inside a dimension. lane: slides along an axis; geyser: on for `on` s every `period` s ----
export function hazardPos(h, t) {
  if (h.kind === 'geyser') { const k = ((t + (h.phase || 0)) % h.period + h.period) % h.period; return { x: h.x, z: h.z, on: k < h.on, k: k / h.period }; }
  const s = Math.sin(t * h.speed + (h.phase || 0)) * h.amp;
  return h.axis === 'z' ? { x: h.at, z: (h.c || 0) + s, on: true } : { x: (h.c || 0) + s, z: h.at, on: true };
}

// ---- an objective run: walk into every pick (in order if def.order), dodge the hazards ----
export function makeRun(def, inert = false) {
  return { id: def.id, picks: def.picks.map((p, i) => ({ ...p, i, taken: false })), got: 0, need: def.picks.length, order: !!def.order, cd: 0, wcd: 0, t: 0, done: false, inert };
}
export function stepRun(run, def, lx, lz, dt) {
  const ev = []; run.t += dt; run.cd = Math.max(0, run.cd - dt); run.wcd = Math.max(0, run.wcd - dt);
  if (run.inert) return ev;
  if (!run.done) {
    for (const p of run.picks) {
      if (p.taken || Math.hypot(p.x - lx, p.z - lz) >= (p.r || 1.3)) continue;
      if (run.order && p.i !== run.got) { if (run.wcd <= 0) { run.wcd = 2; ev.push({ type: 'wrong', i: p.i, want: run.got }); } continue; }
      p.taken = true; run.got++; ev.push({ type: 'pick', i: p.i, got: run.got, need: run.need });
    }
    if (run.got >= run.need) { run.done = true; ev.push({ type: 'done' }); }
  }
  if (run.cd <= 0) for (const h of def.hazards || []) {
    const q = hazardPos(h, run.t); if (!q.on) continue;
    const d = Math.hypot(q.x - lx, q.z - lz);
    if (d < h.r) { run.cd = 1.2; const k = d || 1; ev.push({ type: 'hurt', dmg: h.dmg, push: [(lx - q.x) / k * 1.8, (lz - q.z) / k * 1.8], line: h.line || null }); break; }
  }
  return ev;
}
export const stepLabel = (base, run) => run && run.need > 1 && !run.done ? `${base} (${run.got}/${run.need})` : base;
// room-local bounds check used by the unit tests (and a guard at runtime)
export function inRoom(def, x, z, pad = 0.5) { return Math.abs(x) <= def.w / 2 - pad && Math.abs(z) <= def.d / 2 - pad; }
export function inCol(def, x, z, r = 0.4) { return (def.cols || []).some(([cx, cz, hw, hd]) => Math.abs(x - cx) < hw + r && Math.abs(z - cz) < hd + r); }
