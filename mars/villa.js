// Halvorsen Villa runtime: builds the house (solid walls, sliding doors, four rooms, a vault), walks two guards and
// keeps the walls solid. Layout + maths in villacore.js. Ticked from mars/heisttip.js once the heist is unlocked.
// Solid walls, in order of preference:
//   1. window.SSX.colliders (PR #44): boxes in group 'villa' (they also carry h / y0 / top for roofs.js)
//   2. world.addSolid (PR #63): { x, z, box:[hx,hz], h, y0, top } solids, so a car flying over lands on the roof
//   3. fallback: wrap world.collide / world.collidePlayer (same contract) and push movers out of the villa's boxes
import * as THREE from 'three';
import { FLOOR_H, CAP, HALF, DOOR_W, WALL_T, DOORS, SPOTS, GUARDS, GUARD, wallBoxes, doorBox, roofTop, resolve, lineClear, insideHouse, roomAt, doorOpen, guardPos, guardSees, yawTo } from './villacore.js';
import { VILLA, VILLA_AT } from './heisttipcore.js';

const BUILD_R = 260, DROP_R = 320, GUARD_R = 150;
let V = null, blind = false, freeze = false, // freeze: tests pin guards for a photo
    wrappedWorld = null;

const heistApi = () => globalThis.SSX?.heist || null;
function stageNow() { const a = heistApi()?.active; return a && a.id === VILLA.id ? a.stage : null; }

// ---------- solids ----------
function addBox(b) {
  const CL = globalThis.SSX?.colliders;
  if (V.mode === 'colliders') { CL.add({ ...b, group: 'villa' }); return; }
  if (V.mode === 'solids') { b.ref = V.world.addSolid({ x: b.x, z: b.z, box: [b.hx, b.hz], h: b.h, y0: b.y0, top: b.top, villa: b.id }); return; }
}
function removeBox(b) {
  if (V.mode === 'colliders') { try { globalThis.SSX?.colliders?.remove?.(b.id); } catch (e) {} return; }
  if (V.mode === 'solids' && b.ref) { try { V.world.removeSolid?.(b.ref); } catch (e) {} b.ref = null; }
}
const solidNow = () => V ? V.walls.concat(V.doors.filter(d => d.shut).map(d => d.box)) : [];
function wrap(world) {
  if (wrappedWorld === world || !world?.collide) return; wrappedWorld = world;
  const oc = world.collide, op = world.collidePlayer;
  const mine = (c, x, z, r, yb) => { if (!V || V.mode !== 'wrap' || V.world !== world || world.inside) return c; const X = c ? c.x : x, Z = c ? c.z : z; return resolve(solidNow(), X, Z, r, yb) || c; };
  world.collide = function (x, z, r, skip) { return mine(oc.apply(this, arguments), x, z, r, skip && Number.isFinite(skip.y) ? skip.y : undefined); };
  if (op) world.collidePlayer = function (x, z, r) { return mine(op.apply(this, arguments), x, z, r); };
}

// ---------- meshes ----------
const M = {};
function mats() {
  if (M.wall) return M;
  M.wall = new THREE.MeshStandardMaterial({ color: 0xe2d8c6, roughness: 0.85, transparent: true, opacity: 1 });
  M.trim = new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.7 });
  M.roof = new THREE.MeshStandardMaterial({ color: 0x7a3f2c, roughness: 0.8 });
  M.floor = new THREE.MeshStandardMaterial({ color: 0x5e4c3c, roughness: 0.9 });
  M.door = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6 });
  M.metal = new THREE.MeshStandardMaterial({ color: 0x6c7480, metalness: 0.7, roughness: 0.35 });
  M.safe = new THREE.MeshStandardMaterial({ color: 0x2c313b, metalness: 0.6, roughness: 0.4 });
  M.cloth = new THREE.MeshStandardMaterial({ color: 0x7c2f3a, roughness: 0.95 });
  M.wood = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 });
  M.power = new THREE.MeshStandardMaterial({ color: 0x8a6a20, roughness: 0.6 });
  M.uni = new THREE.MeshStandardMaterial({ color: 0x1d2a3a, roughness: 0.8 });
  M.skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.8 });
  M.beam = new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.1, depthWrite: false });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x223a52, metalness: 0.4, roughness: 0.2, emissive: 0x0d1a26 });
  for (const m of Object.values(M)) m.userData.shared = true;
  return M;
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
function block(g, x, y, z, sx, sy, sz, m) { const o = new THREE.Mesh(BOX, m); o.scale.set(sx, sy, sz); o.position.set(x, y + sy / 2, z); g.add(o); return o; }
function guardFigure() {
  const g = new THREE.Group(), m = mats();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.85, 10), m.uni); body.position.y = 1.08; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), m.skin); head.position.y = 1.66; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.09, 12), m.uni); cap.position.y = 1.8; g.add(cap);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), m.trim); leg.position.set(0.12 * s, 0.35, 0); g.add(leg); }
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3, 14, 1, true), m.beam); beam.rotation.x = -Math.PI / 2; beam.position.set(0.2, 1.25, -1.7); g.add(beam); // flashlight, local -z = facing
  g.name = 'villaGuard'; return g;
}
function build(ctx) {
  const W = ctx.world, c = W.colonyAt?.(VILLA_AT); if (!c) return false;
  const o = [c.x, c.z], m = mats(), H = ctx.height;
  const y0 = H(o[0], o[1]), corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => H(o[0] + a * HALF.x, o[1] + b * HALF.z)), yb = Math.min(y0, ...corners) - 0.4;
  const CL = globalThis.SSX?.colliders;
  V = { o, y0, world: W, mode: CL?.add ? 'colliders' : W.addSolid ? 'solids' : 'wrap', walls: wallBoxes(o, y0), doors: [], guards: [], g: new THREE.Group(), seen: {}, cool: 0, t: 0, inside: false };
  const g = V.g; g.name = 'halvorsenVilla'; g.position.set(o[0], 0, o[1]); ctx.scene.add(g);
  const wh = y0 + FLOOR_H - yb;
  for (const b of V.walls) { block(g, b.x - o[0], yb, b.z - o[1], b.hx * 2, wh, b.hz * 2, m.wall); addBox(b); }
  V.floor = block(g, 0, y0 - 0.2, 0, HALF.x * 2, 0.23, HALF.z * 2, m.floor);
  V.roof = block(g, 0, y0 + FLOOR_H, 0, HALF.x * 2 + 0.8, CAP, HALF.z * 2 + 0.8, m.roof);
  block(g, 0, y0 + FLOOR_H - 0.25, HALF.z + 0.25, HALF.x * 2 + 0.8, 0.25, 0.2, m.trim); // eave trim on the street side
  // doors: panels that slide into the wall when open
  for (const d of DOORS) {
    const box = doorBox(d, o, y0), mesh = block(g, d.x, y0, d.z, d.axis === 'x' ? DOOR_W : WALL_T * 0.8, FLOOR_H - 0.4, d.axis === 'x' ? WALL_T * 0.8 : DOOR_W, d.kind === 'vault' ? m.metal : m.door);
    const D = { def: d, box, mesh, open: 0, shut: true }; V.doors.push(D); addBox(box);
  }
  block(g, -1.1, y0 + FLOOR_H - 0.4, 6, 0.3, 0.3, 0.5, m.trim); // porch lamp
  for (const x of [-6.5, -2.6, 2.8, 6.5]) block(g, x, y0 + 1.1, HALF.z + 0.17, 1.6, 1.3, 0.06, m.glass);   // street-side windows
  for (const z of [-3, 3]) for (const sx of [-1, 1]) block(g, sx * (HALF.x + 0.17), y0 + 1.1, z, 0.06, 1.3, 1.6, m.glass);
  for (const x of [-1.05, 1.05]) block(g, x, y0, HALF.z + 0.12, 0.25, FLOOR_H - 0.2, 0.25, m.trim);        // door frame
  // furniture (looks only)
  block(g, -6.5, y0, 4.5, 2.2, 0.55, 1.6, m.cloth); block(g, -6.5, y0, 5.5, 2.2, 0.9, 0.3, m.wood);      // bed + headboard (bedroom)
  block(g, 3, y0, 4.8, 3, 0.7, 0.9, m.cloth);                                                             // couch (hall)
  block(g, -6, y0, -4.6, 2.4, 0.8, 1.1, m.wood); block(g, -6, y0, -3.6, 0.6, 1, 0.6, m.trim);              // desk + chair (office)
  V.safe = block(g, SPOTS.safe[0], y0, SPOTS.safe[1] - 1.3, 1.1, 1.3, 0.8, m.safe);                         // vault safe
  block(g, SPOTS.power[0], y0, SPOTS.power[1] + 1.1, 0.7, 1.3, 0.3, m.power);                              // power box on the back wall
  V.boxes = () => solidNow();
  if (V.mode === 'wrap') wrap(W);
  return true;
}
function teardown(ctx) {
  if (!V) return;
  for (const b of V.walls) removeBox(b); for (const d of V.doors) if (d.shut) removeBox(d.box);
  if (V.mode === 'colliders') { try { globalThis.SSX?.colliders?.removeGroup?.('villa'); } catch (e) {} }
  for (const gd of V.guards) { gd.g.parent?.remove(gd.g); gd.g.traverse(o => { if (o.isMesh && o.geometry !== BOX) o.geometry.dispose(); }); }
  if (V.guards.length) { const S = slots(); if (S?.release) S.release('villaGuards'); else { try { (ctx?.world || V.world)?.npcReserve?.('villaGuards', 0); } catch (e) {} } }
  V.g.parent?.remove(V.g); V = null;
}

// ---------- guards ----------
// guards: both always come out during the villa job (critical slots via SSX.npcSlots); otherwise the normal budget
const slots = () => globalThis.SSX?.npcSlots;
function reserveGuards(ctx, n, critical) {
  const S = slots();
  if (S?.reserve) S.reserve('villaGuards', n, critical ? { critical: true, keep: true, active: () => !!V && stageNow() != null } : {});
  else { try { ctx.world.npcReserve?.('villaGuards', n); } catch (e) {} }
}
function syncGuards(ctx) {
  const critical = stageNow() != null, B = ctx.world.npcBudget?.();
  const want = slots()?.reserve ? slots().grant?.('villaGuards', GUARDS.length, critical) ?? GUARDS.length
    : (B && Number.isFinite(B.free) ? Math.max(0, Math.min(GUARDS.length, B.free + (B.reserved?.villaGuards || 0))) : GUARDS.length);
  const have = V.guards.length;
  if (V.critical && !critical) V.calmAt = V.t; // job over: guards go back on the normal budget a few seconds later (zone toast)
  V.critical = critical;
  if (want < have && V.t - (V.calmAt ?? -1e9) < 5) return;
  if (want === have && (V.resvCrit ?? null) === critical) return;
  V.resvCrit = critical;
  if (want > have) for (let i = have; i < want; i++) { const def = GUARDS[i], g = guardFigure(); V.g.add(g); V.guards.push({ def, g, t: i * 7.3, p: null }); }
  else while (V.guards.length > want) { const gd = V.guards.pop(); gd.g.parent?.remove(gd.g); }
  reserveGuards(ctx, V.guards.length, critical);
}
function dropGuards(ctx) {
  for (const gd of V.guards) gd.g.parent?.remove(gd.g); V.guards = []; V.critical = false; V.resvCrit = null;
  const S = slots(); if (S?.release) S.release('villaGuards'); else { try { ctx.world.npcReserve?.('villaGuards', 0); } catch (e) {} }
}
function tickGuards(dt, ctx, lp, stage) {
  const hot = stage && ['case', 'breakin', 'crack', 'escape'].includes(stage) && !ctx.car;
  for (const G of V.guards) {
    if (!freeze) G.t += dt; const p = guardPos(G.def, G.t); G.p = p;
    G.g.position.set(p.x, ctx.height(V.o[0] + p.x, V.o[1] + p.z), p.z); G.g.rotation.y = yawTo(p.fx, p.fz);
    const sees = hot && !blind && guardSees(p, lp.x, lp.z, solidNow(), V.o);
    V.seen[G.def.id] = sees ? (V.seen[G.def.id] || 0) + dt : Math.max(0, (V.seen[G.def.id] || 0) - dt);
    if (V.seen[G.def.id] >= GUARD.spotS && V.cool <= 0) {
      V.cool = 8; V.spotted = (V.spotted || 0) + 1; V.seen[G.def.id] = 0;
      try { heistApi()?.alarm?.(2, `spotted by the ${G.def.name}`); } catch (e) {}
      try { window.__app?.toast?.(`◆ The ${G.def.name} saw you ➤ grab it and run`, 2800); } catch (e) {}
    }
  }
}

// ---------- per frame ----------
export function villaTick(dt, ctx) {
  if (!ctx?.world || !ctx.scene) return;
  if (ctx.name !== 'Mars') { if (V) teardown(ctx); return; }
  if (V && (V.world !== ctx.world || V.g.parent !== ctx.scene)) teardown(ctx); // landed again: new world / scene
  const c = ctx.world.colonyAt?.(VILLA_AT); if (!c) return;
  const P = ctx.car || ctx.player, d = Math.hypot(P.x - c.x, P.z - c.z);
  if (!V) { if (d > BUILD_R) return; if (!build(ctx)) return; }
  else if (d > DROP_R) { teardown(ctx); return; }
  if (globalThis.SSX && globalThis.SSX.camLos !== camLos) globalThis.SSX.camLos = camLos; // index.html rebuilds SSX: re-attach
  V.t += dt; V.cool -= dt;
  const lp = { x: P.x - V.o[0], z: P.z - V.o[1] }, stage = stageNow();
  for (const D of V.doors) {
    const want = doorOpen(D.def, stage, Math.hypot(lp.x - D.def.x, lp.z - D.def.z)) ? 1 : 0;
    D.open += Math.sign(want - D.open) * Math.min(Math.abs(want - D.open), dt * 2.2);
    const s = D.open > 0.5; if (s === !D.shut) { /* unchanged */ } else if (s) { D.shut = false; removeBox(D.box); } else { D.shut = true; addBox(D.box); }
    const off = D.open * (DOOR_W - 0.1); if (D.def.axis === 'x') D.mesh.position.x = D.def.x + off; else D.mesh.position.z = D.def.z + off;
  }
  if (d < GUARD_R) { V.syncT = (V.syncT || 0) - dt; if (V.syncT <= 0 || (stageNow() != null) !== !!V.critical) { V.syncT = 0.5; syncGuards(ctx); } }
  else if (V.guards.length && d > GUARD_R + 20) dropGuards(ctx);
  tickGuards(dt, ctx, lp, stage);
  // cutaway: inside, drop the roof and ghost the walls so the chase camera can see you
  const inside = !ctx.car && insideHouse(lp.x, lp.z);
  if (inside !== V.inside) { V.inside = inside; V.roof.visible = !inside; M.wall.opacity = inside ? 0.32 : 1; M.wall.depthWrite = !inside; }
}
// walls (and shut doors) block a camera's sight line
export function camLos(ax, az, bx, bz) { return !V || lineClear(solidNow(), ax, az, bx, bz); }

export function villaPub() {
  if (!V) return null;
  return { mode: V.mode, x: V.o[0], z: V.o[1], y0: V.y0, top: roofTop(V.y0), walls: V.walls.length, doors: Object.fromEntries(V.doors.map(D => [D.def.id, { open: +D.open.toFixed(2), shut: D.shut }])),
    guards: V.guards.map(G => ({ id: G.def.id, x: V.o[0] + (G.p?.x ?? 0), z: V.o[1] + (G.p?.z ?? 0), room: G.p ? roomAt(G.p.x, G.p.z) : null })), inside: V.inside, spotted: V.spotted || 0, blind };
}
if (typeof window !== 'undefined') window.__villa = {
  get state() { return villaPub(); }, boxes: () => solidNow().map(b => ({ id: b.id, x: b.x, z: b.z, hx: b.hx, hz: b.hz, top: b.top })),
  blind: b => { blind = !!b; return blind; }, freeze: b => { freeze = !!b; return freeze; }, local: (x, z) => V ? { x: x - V.o[0], z: z - V.o[1], room: roomAt(x - V.o[0], z - V.o[1]) } : null,
  guardAt: (id, t) => { const G = V?.guards.find(q => q.def.id === id); if (G && Number.isFinite(t)) G.t = t; return G ? G.t : null; },
};
