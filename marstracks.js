// Mars street circuits (Pumpkin add-on) on top of race.js + trackbuilder.js (Chief of Staff's v7.4 race system).
//  1. Five presets (marstrackcore.js) go into race.js's own preset list: idle start arches, the 🏁 Race button, the Races panel,
//     ghosts, best laps and the builder's 📂 Tracks list (load / copy / edit) all come from race.js unchanged.
//  2. The ring streets the circuits run on are painted onto Mars (one merged ribbon per street, under this module's group).
//  3. Road snapping for the builder on Mars: trackbuilder.js place() asks globalThis.SSX_TRACK_SNAP (its one-line hook) and
//     we move gates, ramps and boost pads onto the nearest road centreline within 36 m. Dragging stays free (manual override);
//     a 🧲 Roads chip in the builder turns snapping off and on.
//  4. Car meets (carmeet.js) use meetTracks() / meetCircuitDef() to race a meet car round any preset or saved Mars track.
// Wiring: imported by carmeet.js; runs from window.SSX_TICKS (surface.js). No other shared-file hooks.
import * as THREE from 'three';
import * as RC from './racecore.js';
import * as MT from './marstrackcore.js';

const LS_SNAP = 'ssx.marstracks.snap';
const S = { ctx: null, planet: null, group: null, net: null, snap: true, snaps: 0, refused: 0, lastSnap: null, chip: null, toasted: false, checked: false, gateFixes: [] };
try { S.snap = localStorage.getItem(LS_SNAP) !== '0'; } catch (e) { /* ignore */ }

// ---------- 1. presets ----------
for (const p of MT.MARS_PRESETS) if (!RC.PRESETS.some(q => q.id === p.id)) RC.PRESETS.push(p);
window.__race?.reload?.(); // race.js may already have drawn its idle arches

// ---------- 2. painted streets ----------
let mats = null;
function materials() {
  return mats ??= {
    road: new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    line: new THREE.MeshBasicMaterial({ color: 0xd8c9a0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    kerb: new THREE.MeshBasicMaterial({ color: 0x9a4a32, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  };
}
// ribbon along a world-space polyline: half-width w, lateral offset off, y lift; dash = [on, off] metres (null = solid)
function ribbon(pts, H, w, off, lift, dash = null) {
  const P = [], I = []; let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-6, nx = -dz / L, nz = dx / L;
    const s0 = s; s += L; if (dash && (s0 % (dash[0] + dash[1])) > dash[0]) continue;
    const q = (x, z, k) => { const X = x + nx * (off + k * w), Z = z + nz * (off + k * w); return [X, H(X, Z) + lift, Z]; };
    const b = P.length / 3; P.push(...q(ax, az, -1), ...q(ax, az, 1), ...q(bx, bz, -1), ...q(bx, bz, 1)); I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
}
function buildStreets(ctx) {
  const c = ctx.world.colony, H = ctx.height, M = materials(), g = new THREE.Group(); g.name = 'marsStreets'; g.userData.v8 = { site: 'marstracks' };
  const hw = MT.ROAD_W / 2;
  for (const st of MT.STREETS) {
    const pts = MT.sampleStreet(st.pts, st.loop, 3).map(([x, z]) => [x + c.x, z + c.z]);
    const road = new THREE.Mesh(ribbon(pts, H, hw, 0, 0.07), M.road); road.receiveShadow = true; road.userData.street = st.id; g.add(road);
    g.add(new THREE.Mesh(ribbon(pts, H, 0.12, 0, 0.09, [3, 4]), M.line));
    for (const sd of [-1, 1]) g.add(new THREE.Mesh(ribbon(pts, H, 0.18, sd * (hw - 0.2), 0.09), M.kerb));
  }
  ctx.scene.add(g); return g;
}
function teardown() { if (S.group) { S.group.parent?.remove(S.group); S.group.traverse(o => o.geometry?.dispose?.()); } S.group = null; S.net = null; }

// ---------- 3. builder road snap ----------
function network() {
  const w = S.ctx?.world; if (!w?.colony) return null;
  if (!S.net) {
    const hw = w.highway?.() || null, sites = [{ x: w.colony.x, z: w.colony.z, core: MT.CORES.aj }];
    for (const d of w.districts?.() || []) if (Math.hypot(d.x - w.colony.x, d.z - w.colony.z) > 30) sites.push({ x: d.x, z: d.z, core: MT.CORES.district });
    S.net = MT.roadNetwork(w.colony, hw, sites);
  }
  return S.net;
}
// can a car sit here? null, or why not: inside a building / dome / interior footprint (world.solidAt at wheel height, and
// camBlocked, which counts a dome's whole volume rather than just its shell), or too steep
function worldCheck() {
  const w = S.ctx?.world, H = S.ctx?.height; if (!w?.solidAt || !H) return null;
  return (x, z) => { const y = H(x, z); if (w.solidAt(x, y + 0.6, z) || w.solidAt(x, y + 1.6, z) || w.camBlocked?.(x, y + 1, z)) return 'building'; // camBlocked: whole dome volumes + building boxes
    const sl = Math.max(Math.abs(H(x + 2, z) - H(x - 2, z)), Math.abs(H(x, z + 2) - H(x, z - 2))) / 4; return sl > MT.MAX_SLOPE ? 'steep' : null; };
}
// trackbuilder.js place() hook: (planet, {x,z}, tool) -> {x,z} (snapped onto a road, or moved out of a building),
// null to keep the tap point, or false to refuse the tap (a gate inside a building with no clear ground nearby)
globalThis.SSX_TRACK_SNAP = (planet, p, tool) => {
  if (planet !== MT.WORLD || !p) return null;
  const snap = S.snap && !!MT.SNAP_TOOLS[tool], gate = tool === 'gate'; if (!snap && !gate) return null;
  const net = network() || [], r = MT.snapTap(snap ? net : [], p.x, p.z, gate ? worldCheck() : null, snap);
  if (!r) return null;
  if (r.reject) { S.refused++; S.lastSnap = { from: { x: p.x, z: p.z }, refused: r.reject, tool }; toast(r.reject === 'steep' ? '⛰️ Too steep for a checkpoint. Try flatter ground.' : '🧱 A checkpoint can’t go inside a building. Tap the street.', 2600); return false; }
  S.snaps++; S.lastSnap = { from: { x: p.x, z: p.z }, x: r.x, z: r.z, d: r.d, road: r.road, moved: !!r.moved, tool };
  if (r.moved && !r.road) toast('🧱 Moved the checkpoint out of the building.', 2200);
  else if (!S.toasted) { S.toasted = true; toast('🧲 Snapped to the road. Drag a gate to move it off-road, or tap 🧲 to turn snapping off.', 3200); }
  return { x: r.x, z: r.z };
};
// presets: once the real city is up, any gate inside a building or off the drivable surface is moved onto clear road (or dropped)
function checkPresets() {
  const w = S.ctx.world, chk = worldCheck(); if (!chk || !w.colony) return; S.checked = true;
  const net = network() || [], legChk = (x, z) => { const y = S.ctx.height(x, z); return w.solidAt(x, y + 0.6, z) ? 'building' : null; }; let changed = false; S.gateFixes = [];
  for (const p of MT.MARS_PRESETS) {
    const t = RC.resolveTrack(p, w.colony), r = MT.sanitizeGates(t.gates, chk, net, { loop: t.loop, legCheck: legChk });
    if (r.moved.length || r.dropped.length || r.blocked?.length) S.gateFixes.push({ id: p.id, moved: r.moved, dropped: r.dropped, blocked: r.blocked });
    if ((r.moved.length || r.dropped.length) && r.gates.length >= RC.MIN_GATES) { p.gates = r.gates.map(g => [+(g.x - w.colony.x).toFixed(1), +(g.z - w.colony.z).toFixed(1)]); changed = true; }
  }
  if (S.gateFixes.length) console.warn('[marstracks] checkpoint fixes', S.gateFixes);
  if (changed) window.__race?.reload?.();
}
const app = () => window.__app;
function toast(msg, ms) { try { app()?.toast?.(msg, ms); } catch (e) { /* ignore */ } }
const CSS = `#tbSnap { position: absolute; top: calc(64px + var(--sat, 0px)); right: calc(8px + var(--sar, 0px)); min-height: 40px; padding: 0 12px; border-radius: 10px; font-weight: 800; font-size: 0.74rem;
  color: #fff; background: rgba(14,20,40,0.82); border: 1px solid rgba(255,255,255,0.22); touch-action: none; z-index: 2; }
#tbSnap.on { background: rgba(56,225,255,0.45); border-color: #38e1ff; }`;
function setSnap(on) { S.snap = !!on; try { localStorage.setItem(LS_SNAP, S.snap ? '1' : '0'); } catch (e) { /* ignore */ } paintChip(); }
function paintChip() { if (S.chip) { S.chip.classList.toggle('on', S.snap); S.chip.textContent = S.snap ? '🧲 Roads: on' : '🧲 Roads: off'; } }
function ensureChip(onMars) {
  const ov = document.getElementById('tbOverlay'); if (!ov) return;
  if (!S.chip || S.chip.parentNode !== ov) {
    if (!document.getElementById('tbSnapCss')) { const st = document.createElement('style'); st.id = 'tbSnapCss'; st.textContent = CSS; document.head.appendChild(st); }
    const b = document.createElement('button'); b.id = 'tbSnap'; b.type = 'button';
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); }); // keep the builder from treating it as a ground tap
    if (window.__onTap) window.__onTap(b, () => setSnap(!S.snap)); else b.addEventListener('click', () => setSnap(!S.snap));
    ov.appendChild(b); S.chip = b; paintChip();
  }
  S.chip.style.display = onMars ? '' : 'none';
}

// ---------- 4. car-meet tracks ----------
// presets first (this add-on's, then race.js's own Mars presets), then your saved Mars tracks; quest sprints and meet copies excluded
export function meetTracks(world = MT.WORLD) {
  const saved = (window.__race?.data?.tracks || []).filter(t => t.world === world);
  const pre = RC.PRESETS.filter(p => p.world === world).sort((a, b) => (b.marsStreet ? 1 : 0) - (a.marsStreet ? 1 : 0));
  return [...pre.map(d => ({ d, src: 'preset' })), ...saved.map(d => ({ d, src: 'saved' }))].filter(({ d }) => d.gates?.length >= 2).map(({ d, src }) => {
    const t = RC.resolveTrack(d, S.ctx?.world?.colony || { x: 0, z: 0 });
    return { id: d.id, name: d.name, src, loop: t.loop, laps: t.laps, gates: t.gates.length, length: Math.round(t.length * (t.loop ? t.laps : 1)), t };
  });
}
export function meetCircuitDef(trackId, car, wager = 0) {
  const m = meetTracks().find(x => x.id === trackId); if (!m) return null;
  return MT.meetCircuitDef({ ...m.t, id: m.id, name: m.name }, car, wager);
}

// ---------- tick ----------
function tick(dt, ctx) {
  S.ctx = ctx;
  if (ctx.name !== S.planet) { teardown(); S.planet = ctx.name; }
  const onMars = ctx.name === MT.WORLD && !!ctx.world?.colony && !ctx.world.inside;
  if (onMars && !S.group) S.group = buildStreets(ctx);
  if (onMars && !S.checked) checkPresets();
  if (S.group) S.group.visible = onMars;
  if (window.__race?.builder?.open) ensureChip(onMars);
  if (window.SSX && !window.SSX.marsTracks) window.SSX.marsTracks = API;
}
(window.SSX_TICKS ||= []).push(tick);

export const API = {
  presets: () => MT.MARS_PRESETS.map(p => ({ id: p.id, name: p.name, district: p.district, laps: p.laps, loop: p.loop !== false, gates: p.gates.length, par: p.par, purse: p.purse })),
  streets: () => MT.STREETS.map(s => ({ id: s.id, name: s.name, loop: s.loop })),
  snap: (x, z) => { const n = network(); return n ? MT.snapPoint(n, x, z) : null; },
  get snapOn() { return S.snap; }, setSnap, meetTracks: () => meetTracks().map(({ t, ...m }) => m)
};
window.__marstracks = Object.defineProperties({}, { ...Object.getOwnPropertyDescriptors(API), ...Object.getOwnPropertyDescriptors({ get snaps() { return S.snaps; }, get refused() { return S.refused; }, get gateFixes() { return S.gateFixes; }, get checked() { return S.checked; },
  check: (x, z) => { const c = worldCheck(); return c ? MT.gateIssue(x, z, c) : 'n/a'; },
  // per preset, on the real city: gates inside a building / off the drivable surface, and legs a car can't drive (solidAt)
  gateReport(id) { const w = S.ctx?.world, c = worldCheck(); if (!c) return null; const p = MT.MARS_PRESETS.find(q => q.id === id), t = RC.resolveTrack(p, w.colony);
    const lc = (x, z) => w.solidAt(x, S.ctx.height(x, z) + 0.6, z) ? 'building' : null, bad = [], legs = [];
    t.gates.forEach((g, i) => { const why = MT.gateIssue(g.x, g.z, c); if (why) bad.push([i, why]); });
    for (let i = t.loop ? 0 : 1; i < t.gates.length; i++) { const b = MT.legBlock(t.gates, i, lc, t.loop); if (b) legs.push([i, b.why, Math.round(b.x), Math.round(b.z)]); }
    return { gates: t.gates.length, bad, legs }; }, get lastSnap() { return S.lastSnap; }, get built() { return !!S.group; }, get netSize() { return S.net?.length || 0; },
  // test helper: solid hits along a preset's racing line (car-width offsets) or along the painted street centrelines
  solidHits(id) {
    const w = S.ctx?.world, H = S.ctx?.height; if (!w?.solidAt || !H) return null; const hits = [];
    const lines = id === 'streets' ? MT.STREETS.map(st => MT.sampleStreet(st.pts, st.loop, 2).map(([x, z]) => ({ x: x + w.colony.x, z: z + w.colony.z }))) :
      [RC.buildPath(RC.resolveTrack(MT.MARS_PRESETS.find(p => p.id === id), w.colony)).pts];
    for (const pts of lines) for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
      for (const k of [-1.2, 0, 1.2]) { const x = b.x + nx * k, z = b.z + nz * k; if (w.solidAt(x, H(x, z) + 0.6, z)) hits.push([Math.round(x), Math.round(z)]); } }
    return hits;
  },
  get chip() { return S.chip ? { text: S.chip.textContent, on: S.chip.classList.contains('on'), shown: S.chip.style.display !== 'none' } : null; }, streetMeshes: () => S.group ? S.group.children.length : 0 }) }); // descriptors, so getters like snapOn stay live
