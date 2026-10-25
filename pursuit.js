// v7.4 street chases. NOT police: wanted stars, ColSec drones/buggies and the 4-5★ heavies all live in world.js (v7.4
// security combat). This file is the other people who want you dead on the road:
//  - gang: Saltblood cars (black, red tape) that box you in, ram, and shoot from the window
//  - junkie: one glow-dust driver in a stolen buggy who just rams, badly
//  - setpiece: highway.json "Red Tape Run" - grab Marrow's crate at Red Tape Flats, run the Beltway checkpoints to the
//    Helios Heights gate with goon, goon and an armed sbuggy on you (2★ from world.crime on top). Limit, crate hp,
//    boxed-in = caught.
//  - getaway: a heist ended and you're fleeing. Ben's heist module (separate PR) dispatches a `heist:escape` event on
//    window or document; we listen defensively and send the vault's private muscle after you (2 cars, never police).
//    If the event never fires, nothing here runs.
// Lose a street chase by breaking line of sight (terrain, buildings) or out-running them; they search, then give up.
import * as THREE from 'three';
import * as DC from './dangercore.js';
import { MARS_CITY, chaseRoute } from './streetdata.js';
import { buildVehicle } from './dangerhooks.js';

let S = null;
const app = () => window.__app;
const toast = (m, ms) => app()?.toast?.(m, ms);
const mobile = () => typeof document !== 'undefined' && document.body.classList.contains('touch');
const A = {};
function assets() {
  if (A.ok) return A; A.ok = true; const sh = o => { o.userData.shared = true; return o; };
  A.gang = sh(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.55, metalness: 0.35 }));
  A.tape = sh(new THREE.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0x500000, emissiveIntensity: 0.5, roughness: 0.6 }));
  A.junk = sh(new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.95 }));
  A.dust = sh(new THREE.MeshStandardMaterial({ color: 0x0a1a30, emissive: 0x39b8ff, emissiveIntensity: 1.6 }));
  A.box = sh(new THREE.BoxGeometry(1, 1, 1)); A.gun = sh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6)); A.gun.rotateX(Math.PI / 2);
  A.tracer = sh(new THREE.BoxGeometry(0.05, 0.05, 1)); A.mTracer = sh(new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  A.mWreck = sh(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }));
  A.beam = sh(new THREE.CylinderGeometry(1.4, 1.4, 60, 12, 1, true)); A.beam.translate(0, 30, 0);
  A.mBeam = sh(new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  A.crate = sh(new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 }));
  return A;
}
function fresh(ctx) {
  const root = new THREE.Group(); root.name = 'streetchase'; ctx?.scene?.add(root);
  return { root, units: [], fx: [], heat: { mode: 'idle' }, active: false, kind: null, tier: null, lastSeen: null, barkT: 0, log: [], rams: 0, shots: 0, sp: null, beam: null, ctx, spawnCd: 0 };
}
export function pursuitReset(ctx, newSession = false) {
  if (S) { S.root.parent?.remove(S.root); setChip(null); }
  S = newSession && ctx ? fresh(ctx) : null;
}
const H = (x, z) => S.ctx.height(x, z);
const carVel = car => ({ x: -Math.sin(car.yaw) * car.speed, z: -Math.cos(car.yaw) * car.speed });
const aj = p => { const c = S.ctx.world.colony; return { x: (c?.x || 0) + p[0], z: (c?.z || 0) + p[1] }; };
let budgetFn = () => 99; export function setNpcBudget(fn) { budgetFn = fn; }

// ---- HUD: one chip in the right stack, only during a set-piece ----
function setChip(html) {
  let c = document.getElementById('chaseChip');
  if (html == null) { if (c) c.classList.remove('on'); return; }
  if (!c) { c = document.createElement('div'); c.id = 'chaseChip'; document.getElementById('stackR')?.prepend(c);
    const st = document.createElement('style'); st.textContent = '#chaseChip{display:none;padding:6px 10px;border-radius:12px;background:rgba(40,6,8,.78);border:1px solid rgba(255,80,80,.5);color:#fff;font-size:.76rem;line-height:1.25;max-width:min(240px,60vw)}#chaseChip.on{display:block}#chaseChip b{color:#ff9a9a}'; document.head.appendChild(st); }
  if (c.innerHTML !== html) c.innerHTML = html; c.classList.add('on');
}

function paintCar(v, kind) {
  const a = assets(), body = v.group.userData.body || v.body, mat = kind === 'junkie' ? a.junk : a.gang;
  v.group.traverse(o => { if (o.isMesh && o.material === v.paint) o.material = mat; });
  if (kind !== 'junkie') { for (const s of [-1, 1]) { const t = new THREE.Mesh(a.box, a.tape); t.scale.set(0.06, 0.12, 2.6); t.position.set(s * 0.87, 0.95, 0); v.body.add(t); } }
  else { const t = new THREE.Mesh(a.box, a.dust); t.scale.set(1.2, 0.08, 0.1); t.position.set(0, 2.36, -0.3); v.body.add(t); }
}
function spawnUnit(kind, role = kind) {
  const ctx = S.ctx, car = ctx.car, P = ctx.player, yaw = car ? car.yaw : (P.yaw || 0);
  const a = yaw + (Math.random() - 0.5) * 1.0, r = 55 + Math.random() * 30;
  const x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r;     // behind you (forward is -sin, -cos)
  const v = buildVehicle('buggy', false); paintCar(v, kind);
  if (role === 'sbuggy') { const g = new THREE.Mesh(assets().gun, assets().gang); g.position.set(0, 2.55, -0.2); v.body.add(g); }
  const u = { ...v, kind, role, x, z, y: H(x, z), yaw: Math.atan2(-(P.x - x), -(P.z - z)), speed: 14, hp: role === 'sbuggy' ? 14 : 9, alive: true, ramCd: 0, shootCd: 2.5, seen: false, id: S.units.length, wreck: 0 };
  v.group.position.set(x, u.y, z); S.root.add(v.group); S.units.push(u);
  u.hittable = { get x() { return u.x; }, get y() { return u.y + 1; }, get z() { return u.z; }, r: 2.0, car: true, kind: kind === 'junkie' ? 'junkie car' : 'saltblood car', get alive() { return u.alive; }, hostile: true, hit: d => hitUnit(u, d) };
  return u;
}
function hitUnit(u, d) {
  if (!u.alive) return true; u.hp -= d;
  if (u.hp <= 0) { u.alive = false; u.wreck = 10; u.group.traverse(o => { if (o.isMesh) o.material = assets().mWreck; }); S.kills = (S.kills || 0) + 1; S.log.push('wreck');
    toast(u.kind === 'junkie' ? '💥 The junkie\u2019s buggy folds into the dirt.' : S.kind === 'getaway' ? '💥 One less car on your tail.' : '💥 Saltblood car wrecked. They\u2019ll remember that.', 2000); if (S.kind !== 'getaway') S.onGangKill?.(u.kind); }
  return true;
}
function bark(key) { if (S.barkT > 0) return; S.barkT = 6; const l = DC.pick(DC.BARKS[key]); if (l) toast(`🗯 ${l}`, 2200); S.lastBark = l; }
function tracer(from, to) {
  const a = assets(), m = new THREE.Mesh(a.tracer, a.mTracer), d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  m.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2); m.scale.z = d; m.lookAt(to.x, to.y, to.z); S.root.add(m); S.fx.push({ m, life: 0.08 });
}
function sees(u, tgt) {
  const d = Math.hypot(u.x - tgt.x, u.z - tgt.z); if (d > S.tier.sight) return false;
  return DC.lineOfSight({ x: u.x, y: u.y + 1.6, z: u.z }, tgt, H, (x, y, z) => S.ctx.world.solidAt?.(x, y, z), Math.max(12, Math.ceil(d / 3)));
}

// ---------- heist:escape (from the heist module, if it is installed) ----------
// Guarded: listens on window and document (dedupes an event that bubbles to both), ignores bad detail, and only queues a
// request. pursuitTick starts the getaway when it's safe (street danger on, outside, not in a duel, NPC budget has room)
// and drops it after 30 s if it never can.
let pendingEscape = null;
function onHeistEscape(e) {
  try {
    if (!e || e.__ssxGetaway) return; try { e.__ssxGetaway = true; } catch (_) {}
    const d = (e.detail && typeof e.detail === 'object') ? e.detail : {};
    const n = Math.max(1, Math.min(3, Number.isFinite(+d.pursuers) && +d.pursuers > 0 ? Math.round(+d.pursuers) : 2));
    pendingEscape = { at: performance.now(), n, title: typeof d.title === 'string' ? d.title.slice(0, 60) : null };
  } catch (_) { /* never let a foreign event break the game loop */ }
}
try { if (typeof window !== 'undefined') window.addEventListener('heist:escape', onHeistEscape); if (typeof document !== 'undefined') document.addEventListener('heist:escape', onHeistEscape); } catch (_) {}
function heistTick(ctx, enabled) {
  if (!pendingEscape) return;
  if (performance.now() - pendingEscape.at > 30000) { S.log.push('heist:expired'); pendingEscape = null; return; }
  if (!enabled || ctx.inside || ctx.world?.inDuel) return;
  if (S.active) { if (S.kind === 'setpiece' || S.kind === 'getaway') { pendingEscape = null; return; } stop('heist'); return; }
  const p = pendingEscape; if (pursuitStart('getaway', { n: p.n, title: p.title })) pendingEscape = null;
}

// start a street chase. kind: gang | junkie | getaway | setpiece. Returns false if the NPC budget can't fit it.
export function pursuitStart(kind = 'gang', opts = {}) {
  if (!S) return false; if (S.active) return false;
  const T = DC.chaseTier(kind, mobile(), opts.n || 0); if (!T) return false;
  const room = budgetFn(); if (room < 1) { S.log.push('noBudget'); return false; }
  S.tier = { ...T, cars: Math.min(T.cars, room) }; S.kind = kind; S.active = true; S.heat = { mode: 'chase', unseen: 0 }; S.log.push('start:' + kind); S.barkT = 0; S.kills = 0;
  if (kind === 'setpiece') {
    const r = chaseRoute(opts.id || 'beltway-chase-saltblood'); S.roles = r.def.pursuers?.slice() || ['goon', 'goon', 'sbuggy'];
    S.sp = DC.setPieceNew(r.def, r.pts.map(p => [aj(p).x, aj(p).z]), opts.r || 16); S.sp.i = 1;
    const a = assets(); S.beam = new THREE.Mesh(a.beam, a.mBeam); S.root.add(S.beam);
    if (S.ctx.car) { const c = new THREE.Mesh(a.box, a.crate); c.scale.set(0.9, 0.6, 0.7); c.position.set(0, 1.45, 1.0); S.ctx.car.body?.add(c); S.crateMesh = c; }
    if (r.def.wanted && opts.heat !== false) S.ctx.world.crime?.(r.def.wanted, `${r.def.title}: Marrow\u2019s crate`); // stars go through world.js
    toast(`🏁 ${r.def.title}: ${r.def.blurb}`, 3200); bark('runStart'); S.barkT = 0;
  } else if (kind === 'getaway') { toast(`🚨 Getaway${opts.title ? ': ' + opts.title : ''}! The vault\u2019s private muscle is on your tail. Lose them.`, 2800); bark('getaway');
  } else { toast(kind === 'junkie' ? '🚗 Some glow-dust idiot in a stolen buggy is trying to ram you.' : '🚗 Saltblood car on your tail. Lose them.', 2400); bark('gangChase'); }
  for (let i = 0; i < S.tier.cars; i++) spawnUnit(kind === 'junkie' ? 'junkie' : 'gang', S.roles?.[i] || 'goon');
  return true;
}
function stop(why) {
  S.active = false; S.heat.mode = why; S.log.push('stop:' + why);
  for (const u of S.units) u.leaving = true;
  if (S.beam) { S.root.remove(S.beam); S.beam = null; }
  if (S.crateMesh) { S.crateMesh.parent?.remove(S.crateMesh); S.crateMesh = null; }
  setChip(null);
}
function finishSetPiece() {
  const sp = S.sp, g = S.ctx.game;
  if (sp.status === 'won') { g.progress.credits += 350; g.progress.xp += 60; g.save?.(); toast(`🏁 ${sp.title}: made the Helios gate. +350 cr. ${DC.pick(DC.BARKS.runWin)}`, 3200); }
  else toast(`❌ ${sp.title} failed: ${{ caught: 'they boxed you in', crate_destroyed: 'the crate is splinters', timer: 'out of time' }[sp.status] || sp.status}.`, 3000);
  S.lastSetPiece = sp.status; stop('setpiece:' + sp.status); S.sp = null;
}

export function pursuitTick(dt, ctx, enabled = true) {
  if (!S || S.root.parent !== ctx.scene) S = fresh(ctx);
  S.ctx = ctx; S.barkT -= dt;
  heistTick(ctx, enabled);
  const car = ctx.car, P = ctx.player;
  if (S.active && (!enabled && S.kind !== 'setpiece' || ctx.inside)) stop('off');
  const tgt = car ? { x: car.x, y: car.y + 1, z: car.z } : { x: P.x, y: P.y - 0.4, z: P.z }, tv = car ? carVel(car) : { x: 0, z: 0 };
  let crateDmg = 0;
  if (S.active) {
    const T = S.tier;
    S.spawnCd -= dt;
    if (S.kind === 'setpiece' && S.heat.mode === 'chase' && S.units.filter(u => u.alive && !u.leaving).length < T.cars && S.spawnCd <= 0 && budgetFn() > 0) { spawnUnit('gang', 'goon'); S.spawnCd = 6; }
    let seen = false; for (const u of S.units) { u.seen = u.alive && !u.leaving && sees(u, tgt); if (u.seen) seen = true; }
    if (seen) S.lastSeen = { x: tgt.x, z: tgt.z };
    const was = S.heat.mode; DC.heatStep(S.heat, seen, dt, T);
    if (was === 'chase' && S.heat.mode === 'search') { bark('gangLost'); toast('👀 They lost sight of you. Keep moving.', 1800); }
    if (was === 'search' && S.heat.mode === 'chase') toast('🚨 They spotted you!', 1300);
    if (S.heat.mode === 'lost') { if (S.kind === 'setpiece') { S.heat.mode = 'search'; S.heat.search = 0; } else { toast('😮‍💨 You lost them.', 2200); stop('lost'); } }
    if (!S.units.some(u => u.alive) && S.kind !== 'setpiece' && S.active) { toast('🩸 Nobody left chasing you.', 1800); stop('wrecked'); }
  }
  for (const u of [...S.units]) {
    if (!u.alive) { if ((u.wreck -= dt) <= 0) { S.root.remove(u.group); S.units = S.units.filter(o => o !== u); } continue; }
    const T = S.tier || DC.chaseTier('gang'), d = Math.hypot(tgt.x - u.x, tgt.z - u.z);
    let gx, gz, vmax = T.vmax;
    if (u.leaving) { const a = Math.atan2(u.x - tgt.x, u.z - tgt.z); gx = u.x + Math.sin(a) * 20; gz = u.z + Math.cos(a) * 20; vmax = 18; if (d > 140) { S.root.remove(u.group); S.units = S.units.filter(o => o !== u); continue; } }
    else if (S.heat.mode === 'search' && S.lastSeen) { const k = u.id * 2.1 + performance.now() / 4000; gx = S.lastSeen.x + Math.cos(k) * 18; gz = S.lastSeen.z + Math.sin(k) * 18; vmax = 15; }
    else if (!car) { const a = Math.atan2(u.x - tgt.x, u.z - tgt.z); gx = tgt.x + Math.sin(a) * 6; gz = tgt.z + Math.cos(a) * 6; vmax = d > 9 ? 16 : 0; }  // you bailed: they pull up
    else if (d < 22) { const wob = u.kind === 'junkie' ? Math.sin(performance.now() / 300 + u.id) * 4 : 0; gx = tgt.x + tv.x * 0.25 + wob; gz = tgt.z + tv.z * 0.25; vmax = Math.max(T.vmax, Math.abs(car.speed) * 1.15 + 4); }
    else { const ip = DC.interceptPoint(tgt, tv, u, Math.max(10, u.speed)); gx = ip.x; gz = ip.z; vmax = Math.max(T.vmax, Math.abs(car.speed) * T.boost + 3); }
    DC.steerTo(u, gx, gz, dt, { vmax, acc: 15, turn: 2.3 });
    const c = ctx.world.collide?.(u.x, u.z, 2.0); if (c) { u.x = c.x; u.z = c.z; u.speed *= 0.6; }
    for (const o of S.units) if (o !== u && o.alive) { const dx = u.x - o.x, dz = u.z - o.z, k = Math.hypot(dx, dz); if (k < 4 && k > 0.01) { u.x += dx / k * (4 - k) * 0.5; u.z += dz / k * (4 - k) * 0.5; } }
    u.ramCd -= dt;
    if (car && d < 3.6 && u.ramCd <= 0 && !u.leaving && S.active) {
      const r = DC.ramImpulse(u, car, tv); u.ramCd = 1.1;
      car.x += r.nx * (0.6 + r.shove); car.z += r.nz * (0.6 + r.shove); car.speed *= r.hard ? 0.55 : 0.8; car.yaw += (Math.random() - 0.5) * (r.hard ? 0.5 : 0.2);
      const dmg = (r.hard ? 1 : 0.45) * T.ramDmg; ctx.game.hurtPlayer(dmg, { x: u.x, z: u.z }); crateDmg += dmg * 1.5;
      u.speed *= 0.5; S.rams++; S.log.push('ram'); if (r.hard) toast('💥 RAMMED!', 900);
    }
    u.shootCd -= dt;
    if (S.active && T.shoot && u.seen && d < 35 && d > 5 && u.shootCd <= 0 && (u.role === 'sbuggy' || Math.random() < 0.5)) {
      u.shootCd = (u.role === 'sbuggy' ? 1.1 : 2.2) + Math.random(); tracer({ x: u.x, y: u.y + 1.8, z: u.z }, tgt); S.shots++;
      if (Math.random() < 0.45) { ctx.game.hurtPlayer(u.role === 'sbuggy' ? 6 : 4, { x: u.x, z: u.z }); crateDmg += 5; }
      if (S.barkT <= 0) bark('gangShoot');
    }
    u.y = H(u.x, u.z); u.group.position.set(u.x, u.y, u.z); u.group.rotation.y = u.yaw;
    for (const w of u.wheels || []) if (w.spin) w.spin.rotation.x -= u.speed * dt / 0.5;
  }
  // set-piece progress: checkpoints, timer, crate, boxed-in
  if (S.sp && S.active) {
    const close = car ? S.units.filter(u => u.alive && !u.leaving && Math.hypot(u.x - car.x, u.z - car.z) < 6).length : 1;
    const sp = DC.setPieceStep(S.sp, dt, { x: tgt.x, z: tgt.z, speed: car ? car.speed : 0, close, crateDmg });
    if (sp.hit) { S.log.push('cp' + (sp.i - 1)); toast(`✅ Checkpoint ${sp.i - 1}/${sp.route.length - 1}`, 900); }
    if (sp.status !== 'running') finishSetPiece();
    else {
      const [nx, nz] = sp.route[sp.i]; S.beam.position.set(nx, H(nx, nz), nz);
      setChip(`<b>🏁 ${sp.title}</b> ${sp.i - 1}/${sp.route.length - 1} · ${Math.max(0, sp.limit - sp.t).toFixed(0)}s · crate ${sp.crate.toFixed(0)}%${sp.pinned > 1 ? ' · <b>BOXED IN</b>' : ''}`);
    }
  }
  for (const f of [...S.fx]) if ((f.life -= dt) <= 0) { S.root.remove(f.m); S.fx = S.fx.filter(o => o !== f); }
}
// where the Red Tape Run starts (world coords), for the context button
export function setPieceStart() { if (!S?.ctx?.world?.colony) return null; const r = chaseRoute('beltway-chase-saltblood'); return { ...aj(r.pts[0]), title: r.def.title }; }
export function pursuitOnGangKill(fn) { if (S) S.onGangKill = fn; }
export function pursuitNpcCount() { return S ? S.units.filter(u => u.alive && !u.leaving).length : 0; }
export function pursuitHittables() { return S ? S.units.map(u => u.hittable) : []; }
export const pursuitDebug = {
  get pendingEscape() { return pendingEscape ? { ...pendingEscape } : null; },
  get state() { return S ? { active: S.active, kind: S.kind, mode: S.heat.mode, units: S.units.filter(u => u.alive).length, rams: S.rams, shots: S.shots, kills: S.kills || 0, log: S.log.slice(-14), unseen: S.heat.unseen || 0,
    sp: S.sp ? { i: S.sp.i, of: S.sp.route.length - 1, t: +S.sp.t.toFixed(1), crate: +S.sp.crate.toFixed(0), status: S.sp.status, pinned: +S.sp.pinned.toFixed(1), next: S.sp.route[S.sp.i] } : null, lastSetPiece: S.lastSetPiece || null } : null; },
  units: () => S ? S.units.map(u => ({ x: u.x, z: u.z, speed: u.speed, alive: u.alive, seen: u.seen, leaving: !!u.leaving, role: u.role, kind: u.kind })) : [],
  start: (kind, opts) => pursuitStart(kind, opts),
  placeUnit(dx, dz) { if (!S?.active) return false; const u = S.units.find(u => u.alive && !u.leaving) || spawnUnit(S.kind === 'junkie' ? 'junkie' : 'gang'); const P = S.ctx.player; u.x = P.x + dx; u.z = P.z + dz; u.yaw = Math.atan2(-(P.x - u.x), -(P.z - u.z)); return true; },
  hitAll(d = 99) { if (S) for (const u of S.units) if (u.alive) hitUnit(u, d); },
  blind(on) { if (S?.tier) S.tier = { ...S.tier, sight: on ? 0.1 : DC.chaseTier(S.kind).sight }; },
  fastLose() { if (S?.tier) S.tier = { ...S.tier, loseTime: 1, search: 1.5 }; },
  limit(s) { if (S?.sp) S.sp.limit = s; },
  get city() { return MARS_CITY; }
};
