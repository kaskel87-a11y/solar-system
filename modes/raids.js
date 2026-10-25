// Generic raid engine (SSX.raids).
// Any add-on can start a defend-wave raid: Rags to Riches properties, Ben's base building, future modes.
//   SSX.raids.start({ id, pos, radius, attackers: 'gang'|'colsec', waves, onWin, onLose, integrity?, wanted?, label? })
//   SSX.raids.on('raid:start' | 'raid:wave' | 'raid:end' | 'raid:kill', fn) -> unsubscribe()
// pos: { x, z } in world coordinates, or [x, z] relative to Ares Junction (the frame every Mars data pack uses).
// waves: a number of waves (attacker count is picked per wave) or an array like [{ count: 3 }, { count: 5 }].
// If something else already installed SSX.raids, this module installs nothing (no-op guard) and its own engine stays idle.
import * as THREE from 'three';

const CAP_PHONE = 12, CAP_DESKTOP = 20;             // attackers + ColSec on screen at once
const KIND = {
  gang: { hp: 3, speed: 3.4, dmg: 5, range: 15, cd: [1.4, 2.3], body: 0x15151a, band: 0xd0242a, label: 'Rustline crew' },
  colsec: { hp: 4, speed: 2.9, dmg: 6, range: 18, cd: [1.6, 2.6], body: 0x23324f, band: 0x5ad1ff, label: 'ColSec squad' }
};

let C = null, root = null, shared = null, mobile = false, own = null, raid = null, time = 0, uid = 0;
const listeners = new Map();
const patched = new WeakSet();
const rnd = (a, b) => a + Math.random() * (b - a);

function emit(ev, data) {
  for (const fn of [...(listeners.get(ev) || [])]) { try { fn(data); } catch (e) { console.warn('[raids] listener', ev, e); } }
  try { window.SSX?.emit?.(ev, data); } catch {} // v7.5 event bus: SSX.on('raid:end', ...) works too
}
function on(ev, fn) {
  if (typeof fn !== 'function') return () => {};
  if (!listeners.has(ev)) listeners.set(ev, new Set());
  listeners.get(ev).add(fn);
  return () => off(ev, fn);
}
function off(ev, fn) { listeners.get(ev)?.delete(fn); }

const ajToWorld = aj => { const col = C?.world?.colony; return col ? { x: col.x + aj[0], z: col.z + aj[1] } : null; };
function resolvePos(pos) {
  if (Array.isArray(pos)) return ajToWorld(pos);
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z)) return { x: pos.x, z: pos.z };
  if (pos && Array.isArray(pos.aj)) return ajToWorld(pos.aj);
  return null;
}
function npcCap() { return mobile ? CAP_PHONE : CAP_DESKTOP; }
function securityCount() { try { return C?.world?.securityList?.().length || 0; } catch { return 0; } }
// ColSec spawns on its own schedule, so leave room for what the current wanted level will bring
// (mirrors world.js caps; phone: 2 drones, 1 buggy, 2 officers (+1 backup), 1 heavy, 1 gunship)
function expectedSecurity(w) {
  if (!(w > 0)) return { all: 0, foot: 0 };
  const c = mobile ? { d: 2, b: 1, o: 2, h: 1 } : { d: 3, b: 2, o: 4, h: 2 };
  const d = Math.min(c.d, Math.ceil(w / 2) + (w >= 4 ? 1 : 0)), b = w >= 2 ? Math.min(c.b, w - 1) : 0;
  const o = w >= 2 ? Math.min(c.o, w) : 0, h = w >= 4 ? Math.min(c.h, w - 3) : 0, g = w >= 5 ? 1 : 0;
  return { all: d + b + o + h + g, foot: o + h };
}
function securityReserve() { return Math.max(securityCount(), expectedSecurity(C?.world?.wanted || 0).all); }
// how many raiders may be alive right now. With the v7.5 NPC budget, walkers + ColSec on foot + human enemies + every
// add-on reservation must fit the phone cap of 12 (ambient walkers never drop below 4).
function allowedAttackers() {
  let n = npcCap() - securityReserve();
  const W = C?.world;
  if (typeof W?.npcBudget === 'function') {
    try {
      const b = W.npcBudget(), res = b.reserved || {}, others = Object.entries(res).reduce((a, [k, v]) => a + (k === 'raids' ? 0 : v), 0);
      let footNow = 0; try { footNow = (W.securityList?.() || []).filter(s => s.kind === 'officer' || s.kind === 'heavy').length; } catch {}
      const foot = Math.max(footNow, expectedSecurity(W.wanted || 0).foot), hum = C.game?.humanCount?.() || 0;
      const room = (b.cap || npcCap()) - (mobile ? 4 : 0) - foot - hum - others;
      n = Math.min(n, room);
    } catch {}
  }
  return Math.max(0, n);
}
function reserve(n) { try { if (typeof C?.world?.npcReserve === 'function' && reserved !== n) { reserved = n; C.world.npcReserve('raids', n); } } catch {} }
let reserved = 0;
function aliveAttackers() { return raid ? raid.npcs.filter(n => n.alive) : []; }
const playerXZ = () => C.car ? { x: C.car.x, z: C.car.z } : { x: C.player.x, z: C.player.z };
const bark = (cat, who) => { try { window.SSX?.bark?.({ name: who || 'Raider', kind: 'raider' }, cat); } catch {} };

function pub(r) {
  if (!r) return null;
  return { id: r.id, attackers: r.kind, wave: r.wave, waves: r.plan.length, alive: aliveAttackers().length, queued: r.queue,
    kills: r.kills, integrity: Math.max(0, Math.round(r.integrity)), maxIntegrity: r.maxIntegrity, pos: { ...r.pos }, radius: r.radius, label: r.label };
}

function start(opts = {}) {
  if (!C || !C.world || !C.game) return { ok: false, why: 'Raids need a planet surface.' };
  if (raid) return { ok: false, why: `Raid ${raid.id} already running.`, id: raid.id };
  const pos = resolvePos(opts.pos);
  if (!pos) return { ok: false, why: 'Raid needs pos {x,z} or an [x,z] Ares Junction offset.' };
  const kind = KIND[opts.attackers] ? opts.attackers : 'gang';
  let plan = Array.isArray(opts.waves) ? opts.waves.map(w => ({ count: Math.max(1, Math.round(w?.count ?? w ?? 3)) })) : null;
  if (!plan) { const n = Math.max(1, Math.min(6, Math.round(opts.waves || 2))); plan = Array.from({ length: n }, (_, i) => ({ count: 3 + i * 2 })); }
  const integrity = Math.max(10, opts.integrity || 100);
  raid = { id: opts.id || `raid-${++uid}`, kind, pos, radius: Math.max(8, opts.radius || 25), plan, wave: 0, queue: 0, npcs: [], kills: 0,
    integrity, maxIntegrity: integrity, outside: 0, t: 0, nextSpawn: 0, interlude: 1.2, onWin: opts.onWin, onLose: opts.onLose,
    wanted: opts.wanted, planet: C.name, label: opts.label || KIND[kind].label, ended: false };
  ensureRoot();
  if (kind === 'colsec' && raid.wanted !== false) { const w = C.world.wanted || 0; C.world.setWanted?.(Math.max(w, raid.wanted || 2), 'ColSec raid'); }
  emit('raid:start', { id: raid.id, attackers: kind, waves: plan.length, pos: { ...pos }, radius: raid.radius, integrity });
  bark('raid_start', KIND[kind].label);
  return { ok: true, id: raid.id };
}

function stop(id, why = 'cancelled') {
  if (!raid || (id && id !== raid.id)) return false;
  finish('lose', why); return true;
}

function finish(result, why) {
  if (!raid || raid.ended) return;
  const r = raid; r.ended = true;
  for (const n of r.npcs) removeNpc(n);
  raid = null; reserve(0);
  const info = { id: r.id, result, why, kills: r.kills, waves: r.plan.length, wave: r.wave, integrity: Math.max(0, Math.round(r.integrity)) };
  emit('raid:end', info);
  bark(result === 'win' ? 'raid_win' : 'raid_lose', KIND[r.kind].label);
  try { (result === 'win' ? r.onWin : r.onLose)?.(info); } catch (e) { console.warn('[raids] callback', e); }
}

// ---------- attackers ----------
function ensureRoot() {
  if (!C) return;
  if (!root) {
    root = new THREE.Group(); root.name = 'raids';
    const body = new THREE.CapsuleGeometry(0.42, 1.0, 3, 8), head = new THREE.SphereGeometry(0.3, 10, 8), band = new THREE.BoxGeometry(0.9, 0.12, 0.9);
    const mats = {};
    for (const [k, v] of Object.entries(KIND)) mats[k] = { body: new THREE.MeshStandardMaterial({ color: v.body, roughness: 0.8 }), band: new THREE.MeshStandardMaterial({ color: v.band, emissive: v.band, emissiveIntensity: 0.6 }) };
    const ring = new THREE.RingGeometry(0.96, 1, 64); ring.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    shared = { body, head, band, mats, ring, ringMat, tracer: new THREE.LineBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.9 }) };
    for (const g of [body, head, band, ring]) g.userData.shared = true;
    root.userData.shared = true;
    const zone = new THREE.Mesh(ring, ringMat); zone.name = 'raidZone'; zone.visible = false; root.add(zone); shared.zone = zone;
  }
  if (!root.parent || root.userData.scene !== C.scene) { C.scene.add(root); root.userData.scene = C.scene; }
}

function spawnNpc() {
  const r = raid, k = KIND[r.kind], ang = Math.random() * Math.PI * 2, d = r.radius * rnd(1.5, 1.9);
  const x = r.pos.x + Math.cos(ang) * d, z = r.pos.z + Math.sin(ang) * d;
  const g = new THREE.Group();
  const b = new THREE.Mesh(shared.body, shared.mats[r.kind].body); b.position.y = 0.92; g.add(b);
  const h = new THREE.Mesh(shared.head, shared.mats[r.kind].body); h.position.y = 1.75; g.add(h);
  const band = new THREE.Mesh(shared.band, shared.mats[r.kind].band); band.position.y = r.kind === 'colsec' ? 1.78 : 1.25; band.scale.set(r.kind === 'colsec' ? 0.7 : 1, 1, r.kind === 'colsec' ? 0.7 : 1); g.add(band);
  g.position.set(x, C.height(x, z), z); root.add(g);
  const n = { id: ++uid, x, z, y: g.position.y + 1, hp: k.hp, alive: true, mesh: g, cd: rnd(1.5, 3), dead: 0, kind: r.kind, wave: r.wave };
  r.npcs.push(n);
  return n;
}
function removeNpc(n) { n.alive = false; if (n.mesh?.parent) n.mesh.parent.remove(n.mesh); if (n.tracer?.parent) { n.tracer.parent.remove(n.tracer); n.tracer.geometry.dispose(); } }
function hitNpc(n, dmg, how, from) {
  if (!n.alive || !raid) return;
  n.hp -= Math.max(0.5, dmg || 1);
  if (from) { const dx = n.x - from.x, dz = n.z - from.z, L = Math.hypot(dx, dz) || 1; n.x += dx / L * 0.6; n.z += dz / L * 0.6; }
  if (n.hp <= 0) {
    n.alive = false; n.dead = 2.2; raid.kills++;
    n.mesh.rotation.z = Math.PI / 2; n.mesh.position.y -= 0.5;
    emit('raid:kill', { id: raid.id, kills: raid.kills, how });
  }
}
function handle(n) {
  return { get x() { return n.x; }, get z() { return n.z; }, get alive() { return n.alive; }, get hp() { return n.hp; }, kind: n.kind,
    hurt: (dmg, how = 'turret') => hitNpc(n, dmg, how, null) };
}

// make attackers shootable, meleeable and blastable without touching world.js (same pattern as street danger)
function patchWorld(world) {
  if (!world || patched.has(world)) return; patched.add(world);
  const all = () => aliveAttackers().map(n => ({ x: n.x, y: n.y, z: n.z, r: 0.9, n }));
  const oHit = world.hitWorld, oTargets = world.targets, oMT = world.meleeTarget, oMW = world.meleeWorld, oBlast = world.blast;
  const segD = (p0, p1, c) => { const sx = p1.x - p0.x, sy = p1.y - p0.y, sz = p1.z - p0.z, L2 = sx * sx + sy * sy + sz * sz;
    const t = L2 ? Math.max(0, Math.min(1, ((c.x - p0.x) * sx + (c.y - p0.y) * sy + (c.z - p0.z) * sz) / L2)) : 0;
    return Math.hypot(p0.x + sx * t - c.x, p0.y + sy * t - c.y, p0.z + sz * t - c.z); };
  if (oHit) world.hitWorld = (p0, p1, b) => {
    let best = null, bd = 1e9;
    for (const h of all()) { if (segD(p0, p1, h) < h.r) { const k = Math.hypot(h.x - p0.x, h.z - p0.z); if (k < bd) { bd = k; best = h; } } }
    if (best) { hitNpc(best.n, b?.dmg ?? 1, 'shot', p0); return true; }
    return oHit(p0, p1, b);
  };
  if (oTargets) world.targets = () => [...oTargets(), ...all().map(h => ({ x: h.x, y: h.y, z: h.z, kind: 'raider' }))];
  if (oMT) world.meleeTarget = (x, z, yaw, range) => {
    const w = oMT(x, z, yaw, range); let best = null, bd = w ? Math.hypot(w.x - x, w.z - z) : range;
    for (const h of all()) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = { x: h.x, z: h.z, kind: 'raider' }; } }
    return best || w;
  };
  if (oMW) world.meleeWorld = (x, z, fx, fz, range, dmg, knock) => {
    for (const h of all()) { const dx = h.x - x, dz = h.z - z, d = Math.hypot(dx, dz);
      if (d < range + 0.5 && dx * fx + dz * fz > -0.3) { hitNpc(h.n, (dmg || 1) * 1.5, 'melee', { x, z }); return true; } }
    return oMW(x, z, fx, fz, range, dmg, knock);
  };
  if (oBlast) world.blast = (c, R, dmg, emp) => {
    let n = 0; for (const h of all()) { const d = Math.hypot(h.x - c.x, h.z - c.z); if (d < R) { n++; hitNpc(h.n, emp ? 0.5 : (dmg || 3) * (1 - d / R), emp ? 'emp' : 'blast', c); } }
    return n + oBlast(c, R, dmg, emp);
  };
}

function tracer(n, tx, tz) {
  if (n.tracer) { n.tracer.parent?.remove(n.tracer); n.tracer.geometry.dispose(); }
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(n.x, n.y + 0.3, n.z), new THREE.Vector3(tx, C.height(tx, tz) + 1.2, tz)]);
  n.tracer = new THREE.Line(g, shared.tracer); n.tracerT = 0.08; root.add(n.tracer);
}

function tickRaid(dt) {
  const r = raid; r.t += dt;
  const P = playerXZ(), k = KIND[r.kind];
  shared.zone.visible = true; shared.zone.scale.set(r.radius, 1, r.radius);
  shared.zone.position.set(r.pos.x, C.height(r.pos.x, r.pos.z) + 0.15, r.pos.z);
  // lose conditions
  if (C.game.isDown?.()) return finish('lose', 'down');
  const pd = Math.hypot(P.x - r.pos.x, P.z - r.pos.z);
  r.outside = pd > r.radius * 3 ? r.outside + dt : 0;
  if (r.outside > 12) return finish('lose', 'fled');
  if (r.integrity <= 0) return finish('lose', 'overrun');
  // waves
  if (r.queue === 0 && aliveAttackers().length === 0) {
    if (r.wave >= r.plan.length) return finish('win', 'cleared');
    r.interlude -= dt;
    if (r.interlude <= 0) {
      r.wave++; r.queue = r.plan[r.wave - 1].count; r.interlude = 3;
      if (r.kind === 'gang' && r.wave === 2 && r.wanted !== false) { const w = C.world.wanted || 0; if (w < 1) C.world.setWanted?.(1, 'gunfight'); }
      emit('raid:wave', { id: r.id, wave: r.wave, waves: r.plan.length, count: r.queue });
      if (r.wave > 1) bark('raid_wave', k.label);
    }
  }
  r.nextSpawn -= dt;
  const allow = allowedAttackers(), alive = aliveAttackers().length;
  reserve(Math.min(allow, alive + r.queue));
  if (r.queue > 0 && r.nextSpawn <= 0 && alive < Math.min(allow, reserved || allow)) { spawnNpc(); r.queue--; r.nextSpawn = 0.45; }
  // nothing can spawn (city is full) and nobody's left: the crew scatters
  r.stall = r.queue > 0 && alive === 0 && allow <= 0 ? (r.stall || 0) + dt : 0;
  if (r.stall > 25) return finish('win', 'scattered');
  // attackers
  for (const n of r.npcs) {
    if (n.tracer && (n.tracerT -= dt) <= 0) { n.tracer.parent?.remove(n.tracer); n.tracer.geometry.dispose(); n.tracer = null; }
    if (!n.alive) { if (n.dead > 0 && (n.dead -= dt) <= 0) removeNpc(n); continue; }
    const dP = Math.hypot(P.x - n.x, P.z - n.z), dC = Math.hypot(r.pos.x - n.x, r.pos.z - n.z);
    const chase = dP < 20 && pd < r.radius * 2;
    const tx = chase ? P.x : r.pos.x, tz = chase ? P.z : r.pos.z, td = chase ? dP : dC, stopAt = chase ? 8 : 2.2;
    if (td > stopAt) { const s = k.speed * dt / td; n.x += (tx - n.x) * s; n.z += (tz - n.z) * s; }
    else if (!chase) r.integrity -= (r.kind === 'colsec' ? 3.2 : 4) * dt;
    n.mesh.position.set(n.x, C.height(n.x, n.z), n.z); n.y = n.mesh.position.y + 1;
    n.mesh.rotation.y = Math.atan2(tx - n.x, tz - n.z);
    n.cd -= dt;
    if (n.cd <= 0 && dP < k.range) {
      n.cd = rnd(...k.cd); tracer(n, P.x, P.z);
      if (Math.random() < (mobile ? 0.38 : 0.45)) C.game.hurtPlayer?.(k.dmg, { x: n.x, z: n.z, raid: r.id });
    }
  }
  r.npcs = r.npcs.filter(n => n.alive || n.dead > 0);
}

export function raidsTick(dt, ctx) {
  C = ctx; mobile = !!ctx.isMobile; time += dt;
  if (!own) own = { start, on, off, stop, active: () => pub(raid), attackers: () => aliveAttackers().map(handle), cap: npcCap, fromAJ: ajToWorld, version: 1, engine: 'modes/raids.js' };
  if (typeof window !== 'undefined') {
    if (window.SSX && !window.SSX.raids) window.SSX.raids = own; // no-op guard: never replace another engine
    window.__raids = { get state() { return pub(raid); }, get npcs() { return aliveAttackers().length; }, get security() { return securityCount(); }, get cap() { return npcCap(); }, get allowed() { return allowedAttackers(); }, get reserved() { return reserved; },
      killAll: () => { for (const n of aliveAttackers()) hitNpc(n, 99, 'debug', null); }, flushQueue: () => { if (raid) raid.queue = 0; }, get installed() { return window.SSX?.raids === own; } };
  }
  if (!ctx.world) return;
  patchWorld(ctx.world);
  if (raid && raid.planet !== ctx.name) finish('lose', 'left');
  if (raid) { ensureRoot(); tickRaid(dt); }
  else if (shared?.zone) shared.zone.visible = false;
}
export function raidsEngine() { return own; }
