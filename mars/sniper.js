// v7.5.19 Sniper mode + "take out a target" contracts (Collin: "Can we add a sniper mode to take out a target?").
// Window API: SSX.sniper = { start(id), stop(), active(), scope(on?), scoped(), list(), stats(), on(fn), debug }.
// - Rifle: the Scoped rail rifle (Ozzie's Iron / Meridian Arms, 420 cr, slugs). The first contract loans you one + 6 slugs.
// - Scope: Z, right-click or 🎯 Scope (phone) with the rail rifle out on foot. Narrow fov (4x / 8x), vignette + mil-dot
//   reticle, slow sway; hold Shift / 🫁 Steady to hold your breath (4 s, then the shakes). Mouse / drag aims (slower when
//   zoomed). Click, F or 🔥 Fire shoots; bolt cycle 1.6 s. One shot kills a person; headshots pay more. Loud: at least 1
//   star per shot. Wheel, = / - or the 🔍 button change zoom. Esc, Z or ✕ leave the scope.
// - Contracts: ☰ → 🎯 Contracts. Fixer Deacon Graves offers three hits (one after another). Each has a scaffold sniper
//   tower (🪜 Climb up at its foot) and a mark under a red marker pacing a route. Kill them, then lose the wanted stars
//   to get paid. A miss spooks the mark: they run and get away after 22 s unless you finish it.
// Wiring: one <script type="module"> in index.html. Per frame via SSX.registerSurfaceTick (runs after the surface camera,
// so the scope can own the camera), SSX.fireHooks (claims the trigger while scoped) and chained world.hitWorld/targets
// (the mark can be hit by any weapon). Rules + data: mars/snipercore.js (tests/test-sniper-unit.mjs).
// Perf: everything is built once on the first Mars frame, shaders prewarmed with SSX.stormGuard.prewarm, materials shared,
// no per-frame allocations (HUD text only changes 4x a second).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHuman } from '../interiors.js';
import * as K from './snipercore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, P = () => game()?.progress || null, world = () => surf()?.world;
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || !!document.activeElement?.isContentEditable;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- save ----------
let S = K.fresh();
try { S = K.migrate(JSON.parse(localStorage.getItem(K.KEY))); } catch (e) { /* fresh */ }
const save = () => { try { localStorage.setItem(K.KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const subs = new Set();
function emit(type, d = {}) { const ev = { type, contract: run?.c.id || d.contract || null, ...d }; for (const f of subs) { try { f(ev); } catch (e) { console.warn('sniper on', e); } } }

// ---------- state ----------
let run = null;                 // { c, stage: 'hunt'|'heat', spooked, escT, heatT, down, head, dist, t }
let scoped = false, magI = 0, baseFov = 55, savedPitch = -0.05, savedOrder = 'XYZ', fovNow = 55, kick = 0, zoomAcc = 1, zoomAt = 0;
let perched = false, perchX = 0, perchZ = 0, perchY = 0, cool = 0, frame = 0, hookFrame = -9, passing = false;
let steadyKey = false, steadyTouch = false, lastTc = null, built = false, G = null, tower = null, ring = null, marker = null, beam = null;
const marks = new Map(); // contract id -> buildHuman rig
const B = K.newBreath(), SW = { yaw: 0, pitch: 0 }, HIT = { part: null, t: 0 }, WP = { x: 0, z: 0, yaw: 0, moving: 0 }, FL = { x: 0, z: 0, yaw: 0 };
let walker = K.newWalker(), walkPh = 0, deadT = 0;
const vO = new THREE.Vector3(), vD = new THREE.Vector3(), vT = new THREE.Vector3();
const ROUTE = [[0, 0], [0, 0], [0, 0]]; // world-space route of the active contract (reused)
const markPos = { x: 0, y: 0, z: 0, ok: false };

function colony() { const i = surf()?.info; return i?.colony ? i.colony : null; }
function onMars() { const a = app(); return !!(a?.state?.onSurface && surf()?.info?.name === 'Mars' && !a.state.transitioning); }
function onFoot() { const i = surf()?.info; return !!(i && !i.driving && !world()?.inside && !(i.intro > 0)); }
const hasRifle = () => !!P()?.unlocks?.includes('weapon:railrifle');
const rifleOut = () => P()?.equip?.weapon === 'railrifle' && hasRifle();
const slugs = () => P()?.inv?.slugs | 0;
const canScope = () => onMars() && onFoot() && rifleOut() && !(game()?.H?.down > 0);

// ---------- build (once) ----------
const rust = new THREE.MeshStandardMaterial({ color: 0x6b3b22, roughness: 0.75, metalness: 0.55, flatShading: true });
const plank = new THREE.MeshStandardMaterial({ color: 0x3b2f26, roughness: 0.95, metalness: 0.05, flatShading: true });
const redBasic = new THREE.MeshBasicMaterial({ color: 0xff2030, fog: false });
const redBeam = new THREE.MeshBasicMaterial({ color: 0xff1a2a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, fog: false, side: THREE.DoubleSide });
function buildTower() {
  const H = K.PERCH_H, parts = [], pl = [], bx = (w, h, d, x, y, z, ry = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
  for (const sx of [-1.7, 1.7]) for (const sz of [-1.7, 1.7]) parts.push(bx(0.22, H + 1.2, 0.22, sx, (H + 1.2) / 2, sz));
  for (let y = 2.5; y < H; y += 3) { // braces + rings
    for (const s of [-1.7, 1.7]) { parts.push(bx(3.4, 0.12, 0.12, 0, y, s)); parts.push(bx(0.12, 0.12, 3.4, s, y, 0)); }
    const L = Math.hypot(3.4, 3), a = Math.atan2(3, 3.4); parts.push(bx(L, 0.1, 0.1, 0, y + 1.5, -1.7, 0, a)); parts.push(bx(L, 0.1, 0.1, 0, y + 1.5, 1.7, 0, -a));
  }
  for (const s of [-1.9, 1.9]) { parts.push(bx(4, 0.08, 0.08, 0, H + 1.05, s)); parts.push(bx(0.08, 0.08, 4, s, H + 1.05, 0)); } // railing
  for (const sx of [-0.35, 0.35]) parts.push(bx(0.07, H + 0.6, 0.07, sx, (H + 0.6) / 2, 2.05)); // ladder on the +z side
  for (let y = 0.4; y < H + 0.4; y += 0.45) parts.push(bx(0.7, 0.05, 0.05, 0, y, 2.05));
  pl.push(bx(4.2, 0.22, 4.2, 0, H, 0)); pl.push(bx(4.2, 0.9, 0.06, 0, H + 0.55, -2.08)); pl.push(bx(0.06, 0.9, 4.2, -2.08, H + 0.55, 0)); pl.push(bx(0.06, 0.9, 4.2, 2.08, H + 0.55, 0)); // sandbag-ish screens
  pl.push(bx(1.2, 0.5, 0.6, 0.6, H + 0.36, -1.5)); // a crate to rest the rifle on
  const g = new THREE.Group(); g.name = 'sniper-tower';
  const a = new THREE.Mesh(mergeGeometries(parts), rust), b = new THREE.Mesh(mergeGeometries(pl), plank); a.castShadow = b.castShadow = false; g.add(a, b);
  parts.forEach(p => p.dispose()); pl.forEach(p => p.dispose());
  ring = new THREE.Mesh(new THREE.RingGeometry(K.PERCH_R - 0.35, K.PERCH_R, 40, 1), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.08, 2.05 + 1.2); g.add(ring);
  return g;
}
function buildMarker() {
  const m = new THREE.Group(); m.name = 'sniper-marker';
  const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), redBasic); dia.scale.set(1, 1.5, 1); dia.position.y = 2.55; m.add(dia);
  const bg = new THREE.CylinderGeometry(0.18, 0.18, 40, 8, 1, true); bg.translate(0, 20 + 2.9, 0); beam = new THREE.Mesh(bg, redBeam); m.add(beam);
  m.userData.dia = dia; return m;
}
function build(tc) {
  if (built) return; built = true;
  G = new THREE.Group(); G.name = 'sniper';
  tower = buildTower(); tower.visible = false; G.add(tower);
  marker = buildMarker();
  for (const c of K.CONTRACTS) { const h = buildHuman(c.outfit); h.group.name = 'sniper-mark-' + c.id; h.group.visible = false; G.add(h.group); marks.set(c.id, h); }
  marks.get(K.CONTRACTS[0].id).group.add(marker); // re-parented to the active mark
  tc.scene.add(G);
  try { window.SSX?.stormGuard?.prewarm?.(G, { hide: true, draw: true }); } catch (e) { console.warn('sniper prewarm', e); }
}

// ---------- contracts ----------
function setWorldRoute(c) { const o = colony(); if (!o) return false; for (let i = 0; i < 3; i++) { ROUTE[i][0] = o.x + c.route[i][0]; ROUTE[i][1] = o.z + c.route[i][1]; } return true; }
function towerWorld(c, out) { const o = colony(); if (!o) return null; out.x = o.x + c.perch[0]; out.z = o.z + c.perch[1]; return out; }
const TW = { x: 0, z: 0 };
function waypoint(p, label) { try { window.SSX?.hudx?.setWaypoint?.(p ? { x: p.x, z: p.z, label } : null, true); } catch (e) { /* no hud */ } }
function start(id) {
  const c = K.byId(id); if (!c) return { ok: false, msg: 'No such contract.' };
  if (!onMars()) return { ok: false, msg: 'Land on Mars first.' };
  if (!K.unlocked(S, id)) return { ok: false, msg: 'Finish the earlier contract first.' };
  if (run) return { ok: false, msg: 'You already have a contract running.' };
  try { if (window.SSX?.jobs?.active?.()) return { ok: false, msg: 'Finish or stop your current job first.' }; } catch (e) { /* */ }
  if (!setWorldRoute(c)) return { ok: false, msg: 'Land on Mars first.' };
  if (lastTc && !built) build(lastTc);
  const p = P(); let loan = '';
  if (p) {
    if (!hasRifle()) { p.unlocks.push('weapon:railrifle'); loan = ' A scoped rail rifle is waiting at the tower (on the house).'; }
    if ((p.inv.slugs | 0) < 6) { p.inv.slugs = 6; loan += loan ? '' : ' Topped you up to 6 slugs.'; }
    try { game().save?.(); } catch (e) { /* */ }
  }
  run = { c, stage: 'hunt', spooked: false, escT: 0, heatT: 0, down: false, head: false, dist: 0, t: 0, shots: 0 };
  walker = K.newWalker(); deadT = 0;
  const h = marks.get(c.id); if (h) { h.group.rotation.set(0, 0, 0); h.group.add(marker); marker.visible = true; }
  towerWorld(c, TW); placeTower();
  waypoint(TW, 'Sniper tower');
  close(); renderHud(true);
  toast(`📞 ${K.FIXER}: ${c.mark} ${c.crime}. ${c.brief}${loan}`, 7000);
  emit('start'); return { ok: true, msg: `Contract on ${c.mark}.` };
}
function placeTower() {
  if (!tower || !run || !lastTc) return; const gy = lastTc.height(TW.x, TW.z);
  tower.position.set(TW.x, gy, TW.z); tower.visible = true; tower.updateMatrixWorld(true);
  try { window.SSX?.colliders?.add?.({ type: 'box', x: TW.x, z: TW.z, hx: 2.0, hz: 2.0, id: 'sniperTower', group: 'sniper', solid: true }); } catch (e) { /* */ }
}
function end(why) {
  if (!run) return; const c = run.c, h = marks.get(c.id);
  if (perched) climbDown(); if (scoped) setScope(false);
  if (h) h.group.visible = false; if (tower) tower.visible = false;
  try { window.SSX?.colliders?.remove?.('sniperTower'); } catch (e) { /* */ }
  waypoint(null); run = null; renderHud(true); emit('end', { why, contract: c.id });
}
function fail(msg) { if (!run) return; const c = run.c; toast(`❌ Contract failed: ${msg}`, 4200); emit('fail', { why: msg, contract: c.id }); end('fail'); }
function pay() {
  const c = run.c, done = S.done[c.id] | 0, cr = K.payFor(c, { head: run.head, dist: run.dist, done });
  try { game()?.reward?.(c.xp, cr); } catch (e) { try { P().credits += cr; } catch (x) { /* */ } }
  S.done[c.id] = done + 1; S.earned += cr; S.best = Math.max(S.best, Math.round(run.dist)); save();
  const next = K.CONTRACTS.find(x => x.n === c.n + 1);
  toast(`💰 ${K.FIXER}: clean work. +${cr} cr${run.head ? ' (headshot bonus)' : ''}${run.dist >= K.FAR_BONUS_R ? ' (long shot)' : ''}.${next && done === 0 ? ` New contract: ${next.mark}.` : ''}`, 5200);
  emit('paid', { cr, head: run.head, dist: Math.round(run.dist) }); end('paid');
}
function killMark(head, dist, how) {
  if (!run || run.down) return; const c = run.c, h = marks.get(c.id);
  run.down = true; run.head = !!head; run.dist = dist; run.stage = 'heat'; run.heatT = 0; deadT = 0; marker.visible = false;
  S.hits++; if (head) S.heads++; save();
  try { const w = world(); if (w) w.setWanted(Math.max(w.wanted | 0, 2), 'contract killing'); } catch (e) { /* */ }
  try { game()?.gore?.(markPos.x, markPos.y + (head ? 1.7 : 1.2), markPos.z, { n: head ? 2 : 1.2, spray: true }); } catch (e) { /* */ }
  if (dist < K.CLOSE_R) toast(`🩸 ${c.mark} is down, but up close: they saw your face. Half pay. Lose the stars.`, 4200);
  else toast(`🎯 ${head ? 'Headshot! ' : ''}${c.mark} is down (${Math.round(dist)} m). Now lose the wanted stars.`, 4200);
  waypoint(null); emit('kill', { head: !!head, dist: Math.round(dist), how }); renderHud(true);
  if (h) h.group.userData.fall = 0;
}
function spook() { if (!run || run.down || run.spooked) return; run.spooked = true; run.escT = K.ESCAPE_T; toast(`⚠️ ${run.c.mark} heard the shot and is running! ${K.ESCAPE_T} s before they're gone.`, 3200); emit('spooked'); }

// ---------- perch ----------
let eyeH = 1.7;
function nearRing(tc) { if (!run || !tower?.visible) return false; const p = tc.player, rx = TW.x, rz = TW.z + 2.05 + 1.2; return Math.hypot(p.x - rx, p.z - rz) < K.PERCH_R + 0.6 && Math.abs(p.y - eyeH - tc.height(rx, rz)) < 2; }
function climbUp() {
  const tc = lastTc; if (!tc || !run || perched) return; const p = tc.player; eyeH = 1.7;
  perchX = TW.x + 0.2; perchZ = TW.z + 0.2; perchY = tc.height(TW.x, TW.z) + K.PERCH_H + 0.11 + eyeH; perched = true;
  p.x = perchX; p.z = perchZ; p.y = perchY; p.vy = 0; p.grounded = true;
  // face the route's middle
  const mx = ROUTE[1][0], mz = ROUTE[1][1]; p.yaw = Math.atan2(-(mx - p.x), -(mz - p.z)); p.faceYaw = p.yaw;
  if (hasRifle() && !rifleOut()) { try { game().switchWeapon('railrifle'); } catch (e) { /* */ } }
  waypoint(null); toast(isTouch() ? '🪜 On the tower. Tap 🎯 Scope to aim.' : '🪜 On the tower. Z or right-click to scope in.', 3000); emit('perch'); refreshBtns(true);
}
function climbDown() {
  const tc = lastTc; perched = false; if (!tc) return; const p = tc.player, rx = TW.x, rz = TW.z + 2.05 + 1.6;
  p.x = rx; p.z = rz; p.y = tc.height(rx, rz) + eyeH; p.vy = 0; p.grounded = true; refreshBtns(true);
}

// ---------- scope ----------
function setScope(on) {
  const tc = lastTc, cam = tc?.camera || app()?.camera; if (!cam) return false;
  if (on) {
    if (scoped) return true; if (!canScope()) { if (onMars() && onFoot()) toast(hasRifle() ? 'Equip the rail rifle to scope in.' : 'You need the Scoped rail rifle (Ozzie\u2019s Iron or Meridian Arms, 420 cr), or take a ☰ 🎯 Contract.', 3000); return false; }
    scoped = true; baseFov = cam.fov; fovNow = baseFov; savedOrder = cam.rotation.order; savedPitch = tc.player.pitch;
    tc.player.pitch = Math.max(-0.5, Math.min(0.5, tc.player.pitch)); magI = 0; kick = 0; zoomAcc = 1;
    document.body.classList.add('sniping'); ui(); scopeEl.classList.add('show'); updateScopeText(true);
    if (!isTouch() && !document.pointerLockElement) { try { const r = app()?.renderer?.domElement?.requestPointerLock?.(); r?.catch?.(() => {}); } catch (e) { /* drag works */ } }
    emit('scope', { on: true });
  } else {
    if (!scoped) return true; scoped = false;
    cam.fov = baseFov; cam.updateProjectionMatrix(); cam.rotation.order = savedOrder;
    if (tc) tc.player.pitch = savedPitch;
    document.body.classList.remove('sniping'); scopeEl?.classList.remove('show'); steadyTouch = false;
    emit('scope', { on: false });
  }
  refreshBtns(true); return true;
}
function zoomStep(d) { if (!scoped) return; const n = Math.max(0, Math.min(K.ZOOMS.length - 1, magI + d)); if (n !== magI) { magI = n; updateScopeText(true); } }
function trigger() {
  if (!scoped) return false;
  if (cool > 0) return true;
  if (slugs() <= 0) { cool = 0.6; toast('Out of slugs. Buy more at a gun counter (45 cr for 6).', 2200); return true; }
  const tc = lastTc, cam = tc.camera;
  poseCam(cam, tc.player);
  cam.getWorldPosition(vO); cam.getWorldDirection(vD);
  passing = true; let fired = false; try { fired = game().fire({ x: 0, y: 0 }) !== false; } catch (e) { console.warn('sniper fire', e); } passing = false;
  if (!fired) return true;
  cool = K.BOLT; kick = 0.035; S.shots++; if (run) run.shots++; save();
  try { const w = world(); if (w && (w.wanted | 0) < 1) w.setWanted(1, 'sniper fire'); } catch (e) { /* */ }
  // hitscan vs the mark: head sphere, body capsule, blocked by buildings / terrain
  if (run && !run.down && markPos.ok) {
    K.hitPerson(vO, vD, markPos.x, markPos.y, markPos.z, HIT);
    if (HIT.part && clearShot(vO, vD, HIT.t, tc)) { killMark(HIT.part === 'head', Math.hypot(markPos.x - tc.player.x, markPos.z - tc.player.z), 'scope'); }
    else if (Math.hypot(markPos.x - vO.x, markPos.z - vO.z) < 260) spook();
  }
  updateScopeText(true); return true;
}
function clearShot(o, d, t, tc) {
  const w = tc.world, n = Math.ceil(t / 1.5);
  for (let i = 1; i < n; i++) { const s = t * i / n, x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s; if (y < tc.height(x, z) + 0.05) return false; if (w?.camBlocked?.(x, y, z)) return false; }
  return true;
}
function fireHook() {
  if (passing || !scoped) return false;
  const fresh = hookFrame < frame - 1; hookFrame = frame; // bolt action: one shot per press (fire is polled every frame while held)
  if (fresh) trigger();
  return true;
}

// ---------- world patch: the mark is hittable by any weapon ----------
const patched = new WeakSet();
function patchWorld(w) {
  if (!w || patched.has(w)) return; patched.add(w);
  const oHit = w.hitWorld, oT = w.targets;
  if (oHit) w.hitWorld = (p0, p1, b) => {
    if (run && !run.down && markPos.ok) {
      vT.set(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z); const L = vT.length();
      if (L > 1e-4) { vT.multiplyScalar(1 / L); K.hitPerson(p0, vT, markPos.x, markPos.y, markPos.z, HIT); if (HIT.part && HIT.t <= L + 0.3) { const pl = lastTc?.player; killMark(HIT.part === 'head', pl ? Math.hypot(markPos.x - pl.x, markPos.z - pl.z) : 0, 'shot'); return true; } }
    }
    return oHit(p0, p1, b);
  };
  if (oT) w.targets = () => { const out = oT(); if (run && !run.down && markPos.ok) out.push({ x: markPos.x, y: markPos.y + 1.2, z: markPos.z, kind: 'contract' }); return out; };
}

// ---------- surface wrappers: scoped look is slower, movement frozen while scoped / perched, zoom = scope levels ----------
const wrapped = new WeakSet();
const PIN = { keys: {}, joy: { x: 0, y: 0 }, roll: 0, jump: false, run: false, fire: false, kbOnly: false, fireAim: null };
function wrapSurface(s) {
  if (!s || wrapped.has(s)) return; wrapped.add(s);
  const oLook = s.look, oUpdate = s.update, oZoom = s.zoom;
  s.look = (dx, dy, k) => oLook(dx, dy, scoped ? k * K.lookScale(fovNow, baseFov) * (isTouch() ? 0.75 : 1) : k);
  s.zoom = f => { if (!scoped) return oZoom(f); zoomAcc *= f; const n = performance.now(); if (n - zoomAt > 220 && (zoomAcc < 0.8 || zoomAcc > 1.25)) { zoomStep(zoomAcc < 1 ? 1 : -1); zoomAt = n; zoomAcc = 1; } if (n - zoomAt > 600) zoomAcc = 1; };
  s.update = (dt, input) => {
    const p = lastTc?.player;
    if (perched && p && !s.info?.driving) { p.x = perchX; p.z = perchZ; p.y = perchY; p.vy = 0; p.grounded = true; }
    if ((scoped || perched) && input) { PIN.fire = input.fire; PIN.kbOnly = input.kbOnly; PIN.fireAim = input.fireAim; PIN.roll = 0; const r = oUpdate(dt, PIN); afterUpdate(); return r; }
    const r = oUpdate(dt, input); afterUpdate(); return r;
  };
}
function afterUpdate() { const p = lastTc?.player; if (perched && p && !surf()?.info?.driving) { p.x = perchX; p.z = perchZ; p.y = perchY; p.vy = 0; p.grounded = true; } }

// ---------- per-frame ----------
function tick(dt, tc) {
  frame++; lastTc = tc;
  if (tc.name !== 'Mars') { if (scoped) setScope(false); return; }
  if (!built) build(tc); else if (G.parent !== tc.scene) tc.scene.add(G);
  patchWorld(tc.world); wrapSurface(surf());
  if (cool > 0) cool -= dt;
  if (perched && (tc.car || world()?.inside)) perched = false;
  if (scoped && !canScope()) setScope(false);
  if (run) tickRun(dt, tc);
  if (scoped) tickScope(dt, tc);
  else if (B.breath < K.BREATH_MAX) K.breathStep(B, dt, false);
  hudT -= dt; if (hudT <= 0) { hudT = 0.25; refreshBtns(); renderHud(); if (scoped) updateScopeText(); }
}
let hudT = 0;
function tickRun(dt, tc) {
  const c = run.c, h = marks.get(c.id); run.t += dt;
  if (game()?.H?.down > 0) { fail('you went down.'); return; }
  if (!h) return;
  if (!run.down) {
    if (run.spooked) { run.escT -= dt; K.walkStep(walker, ROUTE, 4.6, dt, 0, WP); if (run.escT <= 0) { fail(`${c.mark} got away.`); return; } }
    else K.walkStep(walker, ROUTE, c.walk, dt, 3.5, WP);
    const gy = tc.height(WP.x, WP.z); markPos.x = WP.x; markPos.y = gy; markPos.z = WP.z; markPos.ok = true;
    h.group.visible = true; h.group.position.set(WP.x, gy, WP.z); h.group.rotation.y = WP.yaw;
    walkPh += dt * (run.spooked ? 11 : 6.5) * WP.moving; const sw = Math.sin(walkPh) * (run.spooked ? 0.8 : 0.45) * WP.moving;
    h.legs[0].rotation.x = sw; h.legs[1].rotation.x = -sw; h.arms[0].rotation.x = -sw * 0.8; h.arms[1].rotation.x = sw * 0.8;
    const d = marker.userData.dia; d.rotation.y += dt * 2.5; d.position.y = 2.55 + Math.sin(run.t * 3) * 0.12;
  } else {
    markPos.ok = false; deadT += dt;
    if (h.group.userData.fall < 1) { const f = h.group.userData.fall = Math.min(1, h.group.userData.fall + dt * 2.6); h.group.rotation.x = -f * Math.PI / 2; h.group.position.y = markPos.y + 0.18 * f; }
    if (deadT > 40) h.group.visible = false;
    run.heatT += dt; const w = world();
    if (run.heatT > 1 && (w?.wanted | 0) === 0) { pay(); return; }
  }
  if (perched === false && tower?.visible && !scoped && !run.down) { /* climb offer handled by refreshBtns */ }
}
// scope eye: 0.9 m ahead of the head along the (swayed) aim; also called right before a shot so a fresh aim counts
function poseCam(cam, p) {
  const yaw = p.yaw + SW.yaw, pitch = Math.max(-1.5, Math.min(1.5, p.pitch + SW.pitch + kick)), cp = Math.cos(pitch);
  const fx = -Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = -Math.cos(yaw) * cp;
  cam.position.set(p.x + fx * 0.9, p.y - 0.06 + fy * 0.9, p.z + fz * 0.9);
  cam.rotation.order = 'YXZ'; cam.rotation.set(pitch, yaw, 0);
  cam.updateMatrixWorld();
}
function tickScope(dt, tc) {
  const cam = tc.camera, p = tc.player, mag = K.ZOOMS[magI];
  K.breathStep(B, dt, steadyKey || steadyTouch); K.sway(B, dt, mag, SW);
  kick *= Math.exp(-dt * 7);
  // keyboard aim (arrows / WASD) while scoped: movement is frozen anyway
  const k = app()?.keys; if (k) { const r = 0.9 * K.lookScale(fovNow, baseFov) * dt, ax = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0), ay = (k.ArrowUp || k.KeyW ? 1 : 0) - (k.ArrowDown || k.KeyS ? 1 : 0); if (ax || ay) { p.yaw -= ax * r; p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch + ay * r)); } }
  p.faceYaw = p.yaw;
  poseCam(cam, p);
  const want = K.scopeFov(baseFov, mag); fovNow += (want - fovNow) * (1 - Math.exp(-dt * 14)); if (Math.abs(fovNow - want) < 0.02) fovNow = want;
  if (cam.fov !== fovNow) { cam.fov = fovNow; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  // optics cut through the dust: push the fog back while scoped (surface/grime rewrite it every frame, so no restore needed)
  const f = tc.scene?.fog, zf = mag >= 8 ? 3.2 : 2.4;
  if (f) { if (f.isFogExp2) f.density /= zf; else { f.near *= zf; f.far *= zf; } }
}

// ---------- UI ----------
const CSS = `
body.sniping > :not(canvas):not(#snScope):not(#snHud):not(#toast):not(#cfLayer):not(script):not(style):not(link){visibility:hidden!important}
#snScope{position:fixed;inset:0;z-index:30;display:none;pointer-events:none;font:700 13px/1.2 system-ui,sans-serif;color:#fff}
#snScope.show{display:block}
#snScope .vig{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) calc(min(44vw,44vh) - 2px),#000 min(44vw,44vh))}
#snScope .lens{position:absolute;left:50%;top:50%;width:min(88vw,88vh);height:min(88vw,88vh);transform:translate(-50%,-50%);border-radius:50%;box-shadow:inset 0 0 40px 12px rgba(0,0,0,.85),inset 0 0 0 3px #111}
#snScope svg{position:absolute;left:50%;top:50%;width:min(88vw,88vh);height:min(88vw,88vh);transform:translate(-50%,-50%)}
#snScope .info{position:absolute;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:12px;align-items:center;padding:6px 10px;background:#000;border:2px solid #fff;border-radius:10px;white-space:nowrap}
#snScope .info .br{width:70px;height:8px;border:1px solid #fff;border-radius:4px;overflow:hidden}#snScope .info .br i{display:block;height:100%;background:#fff;transform-origin:left;transition:none}
#snScope .info .br.shk i{background:#ff4040}
#snScope .hint{position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);padding:5px 10px;background:#000;border:2px solid #fff;border-radius:10px;white-space:nowrap;font-weight:600}
body.touch #snScope .hint{display:none}
#snScope button{position:absolute;pointer-events:auto;display:none;background:#000;color:#fff;border:2px solid #fff;border-radius:14px;font:800 15px system-ui,sans-serif;touch-action:none;-webkit-user-select:none;user-select:none}
body.touch #snScope button{display:block}
#snScope button.on{background:#fff;color:#000}
#snFire{right:calc(16px + env(safe-area-inset-right));bottom:calc(70px + env(safe-area-inset-bottom));width:92px;height:92px;border-radius:50%!important;font-size:17px!important}
#snSteady{left:calc(14px + env(safe-area-inset-left));bottom:calc(70px + env(safe-area-inset-bottom));width:92px;height:64px}
#snZoom{right:calc(16px + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));width:72px;height:52px}
#snExit{left:calc(14px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));width:56px;height:52px}
#snHud{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(60px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:6px 6px 6px 12px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:700 13px/1.25 system-ui,sans-serif}
@media (max-width:640px){#snHud{top:calc(158px + env(safe-area-inset-top));width:calc(100vw - 16px)} #snHud .tx{flex:1}}
body.surface #snHud.show{display:flex} body.sniping #snHud{top:calc(10px + env(safe-area-inset-top))!important;opacity:.9} body.touch.sniping #snHud{display:none!important}
#snHud .tx{min-width:0}#snHud .l1{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#snHud .l2{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#snHud .warn{color:#ffd400}
#snHud button{min-height:44px;min-width:64px;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation;flex:none}
#snPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}#snPanel.show{display:flex}
#snPanel .wrap{width:min(460px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:14px;border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-sizing:border-box}
#snBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
#snPanel h2{margin:0 0 2px;font-size:18px}#snPanel .sub{margin:0 0 8px;font-size:13px;opacity:.85}
#snPanel .it{padding:10px 0;border-top:1px solid rgba(255,255,255,.3)}#snPanel .it b{font-size:15px}#snPanel .it small{display:block;font-size:12px;opacity:.85;margin-top:2px}
#snPanel button{width:100%;min-height:46px;margin-top:6px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
#snPanel button:disabled{opacity:.45}#snPanel .foot{display:flex;gap:8px;flex:none}
`;
const RETICLE = `<svg viewBox="-100 -100 200 200" aria-hidden="true"><g stroke="#000" stroke-width="0.7" fill="none">
<line x1="-100" y1="0" x2="-6" y2="0" stroke-width="1.6"/><line x1="6" y1="0" x2="100" y2="0" stroke-width="1.6"/><line x1="0" y1="6" x2="0" y2="100" stroke-width="1.6"/><line x1="0" y1="-100" x2="0" y2="-6" stroke-width="1.6"/>
<line x1="-100" y1="0" x2="-55" y2="0" stroke-width="4"/><line x1="55" y1="0" x2="100" y2="0" stroke-width="4"/><line x1="0" y1="55" x2="0" y2="100" stroke-width="4"/><line x1="0" y1="-100" x2="0" y2="-55" stroke-width="4"/>
${[-40, -30, -20, -10, 10, 20, 30, 40].map(v => `<circle cx="${v}" cy="0" r="1.1" fill="#000"/><circle cx="0" cy="${v}" r="1.1" fill="#000"/>`).join('')}
</g><circle cx="0" cy="0" r="0.9" fill="#ff2030"/></svg>`;
let scopeEl = null, infoEls = null, hud = null, hudTx = null, panel = null, pBody = null, pMsg = null, snipeBtn = null, climbBtn = null, lastTouchAct = 0;
function tap(el, fn) { const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouchAct < 700) return; if (e?.type === 'pointerup') lastTouchAct = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function ui() {
  if (scopeEl) return;
  const st = document.createElement('style'); st.id = 'snCss'; st.textContent = CSS; document.head.appendChild(st);
  scopeEl = document.createElement('div'); scopeEl.id = 'snScope'; scopeEl.setAttribute('data-kbskip', '');
  scopeEl.innerHTML = `<div class="vig"></div><div class="lens"></div>${RETICLE}
<div class="hint">Mouse aim · Click / F fire · Hold Shift steady · Wheel or = / - zoom · Esc or Z exit</div>
<div class="info"><span class="mg">4x</span><span class="rg">— m</span><span class="am">● 0</span><span class="bt">READY</span><span class="br"><i></i></span></div>
<button id="snExit" type="button" aria-label="Leave scope">✕</button><button id="snZoom" type="button" aria-label="Zoom">🔍 8x</button>
<button id="snSteady" type="button" aria-label="Hold to steady">🫁 Steady</button><button id="snFire" type="button" aria-label="Fire">🔥 Fire</button>`;
  document.body.appendChild(scopeEl);
  infoEls = { mg: scopeEl.querySelector('.mg'), rg: scopeEl.querySelector('.rg'), am: scopeEl.querySelector('.am'), bt: scopeEl.querySelector('.bt'), br: scopeEl.querySelector('.br'), bi: scopeEl.querySelector('.br i'), zb: scopeEl.querySelector('#snZoom') };
  tap(scopeEl.querySelector('#snExit'), () => setScope(false));
  tap(infoEls.zb, () => zoomStep(magI === 0 ? 1 : -1));
  const fireB = scopeEl.querySelector('#snFire'), stB = scopeEl.querySelector('#snSteady');
  fireB.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fireB.classList.add('on'); trigger(); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) fireB.addEventListener(t, () => fireB.classList.remove('on'));
  stB.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); steadyTouch = true; stB.classList.add('on'); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) stB.addEventListener(t, () => { steadyTouch = false; stB.classList.remove('on'); });
  for (const b of [fireB, stB]) b.addEventListener('contextmenu', e => e.preventDefault());
  hud = document.createElement('div'); hud.id = 'snHud'; hud.innerHTML = '<div class="tx"><div class="l1"></div><div class="l2"></div></div><button id="snQuit" type="button" aria-label="Quit contract">Quit</button>'; document.body.appendChild(hud);
  hudTx = [hud.querySelector('.l1'), hud.querySelector('.l2')]; tap(hud.querySelector('#snQuit'), () => { if (run) { toast('Contract dropped.', 2000); end('quit'); } });
  tap(hud.querySelector('.tx'), () => open());
  panel = document.createElement('div'); panel.id = 'snPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Contracts"><div id="snBody"></div><div class="sub" id="snMsg"></div><div class="foot"><button id="snClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); pBody = panel.querySelector('#snBody'); pMsg = panel.querySelector('#snMsg');
  tap(panel.querySelector('#snClose'), close);
  attachBtns();
}
function attachBtns() {
  const col = document.getElementById('surfBtns'); if (!col) { setTimeout(attachBtns, 500); return; }
  if (!snipeBtn) { snipeBtn = document.createElement('button'); snipeBtn.id = 'snipeBtn'; snipeBtn.type = 'button'; snipeBtn.textContent = '🎯 Scope'; snipeBtn.setAttribute('aria-label', 'Sniper scope'); snipeBtn.style.display = 'none'; col.prepend(snipeBtn); tap(snipeBtn, () => setScope(!scoped)); }
  if (!climbBtn) { climbBtn = document.createElement('button'); climbBtn.id = 'snClimbBtn'; climbBtn.type = 'button'; climbBtn.style.display = 'none'; col.prepend(climbBtn); tap(climbBtn, () => perched ? climbDown() : climbUp()); }
}
let btnKey = '';
function refreshBtns(force) {
  if (!snipeBtn || !lastTc) return;
  const showS = onMars() && onFoot() && hasRifle() && (rifleOut() || perched) && !scoped;
  const showC = onMars() && onFoot() && !scoped && (perched || nearRing(lastTc));
  const k = (showS ? 1 : 0) + '|' + (showC ? (perched ? 'd' : 'u') : '');
  if (!force && k === btnKey) return; btnKey = k;
  snipeBtn.style.display = showS ? '' : 'none';
  climbBtn.style.display = showC ? '' : 'none'; climbBtn.textContent = perched ? '🪜 Climb down' : '🪜 Climb up';
}
let hudKey = '';
function renderHud(force) {
  if (!hud) { if (!run) return; ui(); }
  if (!run) { if (hud.classList.contains('show')) hud.classList.remove('show'); hudKey = ''; return; }
  const c = run.c, pl = lastTc?.player; let l2;
  if (run.down) l2 = K.stageText(c, 'heat') + ` · ${(world()?.wanted | 0)}★`;
  else if (run.spooked) l2 = `${c.mark} is running! ${Math.max(0, Math.ceil(run.escT))} s`;
  else if (perched) l2 = K.stageText(c, 'hunt') + (markPos.ok && pl ? ` · ${Math.round(Math.hypot(markPos.x - pl.x, markPos.z - pl.z))} m` : '');
  else l2 = K.stageText(c, 'go', pl ? Math.round(Math.hypot(TW.x - pl.x, TW.z - pl.z)) : null);
  const l1 = `🎯 CONTRACT · ${c.mark.toUpperCase()} · 💰 ${K.payFor(c, { dist: 60, done: S.done[c.id] | 0 })} cr`, key = l1 + '|' + l2 + run.spooked;
  if (!force && key === hudKey) return; hudKey = key; hudTx[0].textContent = l1; hudTx[1].textContent = l2; hudTx[1].classList.toggle('warn', !!run.spooked); hud.classList.add('show');
}
let scopeKey = '';
function updateScopeText(force) {
  if (!infoEls || !lastTc) return; const tc = lastTc, cam = tc.camera;
  // range: distance along the centre ray to the mark (if in the crosshair) else terrain, coarse
  let rg = '—'; if (markPos.ok) { cam.getWorldDirection(vD); K.hitPerson(cam.position, vD, markPos.x, markPos.y, markPos.z, HIT); if (HIT.part) rg = Math.round(HIT.t) + ' m ' + (HIT.part === 'head' ? '◎' : '●'); }
  if (rg === '—') { cam.getWorldDirection(vD); const o = cam.position; for (let s = 4; s < 400; s += 4) { const x = o.x + vD.x * s, y = o.y + vD.y * s, z = o.z + vD.z * s; if (y < tc.height(x, z) || tc.world?.camBlocked?.(x, y, z)) { rg = s + ' m'; break; } } }
  const mg = K.ZOOMS[magI] + 'x', am = '● ' + slugs(), bt = cool > 0 ? 'BOLT…' : 'READY', br = Math.round(B.breath / K.BREATH_MAX * 20) / 20;
  const key = rg + mg + am + bt + br + B.shaky; if (!force && key === scopeKey) return; scopeKey = key;
  infoEls.rg.textContent = rg; infoEls.mg.textContent = mg; infoEls.am.textContent = am; infoEls.bt.textContent = bt; infoEls.bi.style.transform = `scaleX(${br})`; infoEls.br.classList.toggle('shk', B.shaky);
  infoEls.zb.textContent = magI === 0 ? '🔍 8x' : '🔍 4x';
}
function open() {
  ui(); pMsg.textContent = ''; render(); panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock();
}
function close() { panel?.classList.remove('show'); }
function render() {
  let h = `<h2>🎯 Contracts · ${esc(K.FIXER)}</h2><p class="sub">“Bad people, good money. You do it from the tower, quiet, then you vanish.” Needs the Scoped rail rifle (first job: on the house). ${S.hits} hits · ${S.heads} headshots · ${S.earned} cr earned.</p>`;
  for (const c of K.CONTRACTS) {
    const done = S.done[c.id] | 0, open = K.unlocked(S, c.id), act = run?.c.id === c.id;
    h += `<div class="it"><b>${c.n}. ${esc(c.mark)} · ${esc(c.place)}</b><small>${esc(c.mark)} ${esc(c.crime)}.</small><small>💰 ${K.payFor(c, { dist: 60, done })} cr${done ? ` · done ${done}x (repeat pays less)` : ''} · headshot +25%, 100 m+ +15%</small>`;
    h += act ? `<button type="button" disabled>Running</button>` : open ? `<button type="button" data-c="${c.id}">${done ? 'Take it again' : 'Take the contract'}</button>` : `<button type="button" disabled>🔒 Finish contract ${c.n - 1} first</button>`;
    h += '</div>';
  }
  pBody.innerHTML = h;
  // v7.5.23 (M1): each Take button fires on its own finger's pointerup (tap / __onTap); a plain click never comes for a second finger while a thumb holds the joystick
  for (const b of pBody.querySelectorAll('button[data-c]')) tap(b, () => { if (b.disabled || !panel.classList.contains('show')) return; const r = start(b.dataset.c); if (!r.ok) pMsg.textContent = r.msg; });
}

// ---------- input ----------
function onKey(e) {
  if (typing() || !onMars()) return;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { steadyKey = true; return; }
  if (scoped) {
    if (e.code === 'Escape' || (e.code === 'KeyZ' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey)) { e.preventDefault(); e.stopImmediatePropagation(); setScope(false); return; }
    if (e.code === 'KeyF' && !e.repeat) { hookFrame = frame; trigger(); return; } // instant on press (the polled fire would wait a frame); the hook then sees it as held
    if (e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); e.stopImmediatePropagation(); zoomStep(1); return; }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); e.stopImmediatePropagation(); zoomStep(-1); return; }
    return;
  }
  if (e.code === 'KeyZ' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && onFoot()) {
    if (!hasRifle()) return; // Z stays free for others when you can't snipe
    e.preventDefault(); e.stopImmediatePropagation();
    if (!rifleOut()) { try { game().switchWeapon('railrifle'); } catch (x) { /* */ } }
    setScope(true);
  }
}
function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app || !window.SSX.registerMenuItem) { setTimeout(boot, 200); return; }
  window.SSX.registerSurfaceTick(tick);
  (window.SSX.fireHooks ||= []).push(fireHook);
  try { window.SSX.registerMenuItem({ id: 'rmSniper', label: '🎯 Contracts', onTap: () => open() }); } catch (e) { console.warn('sniper menu', e); }
  ui();
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', e => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') steadyKey = false; }, true);
  window.addEventListener('blur', () => { steadyKey = false; });
  const cv = app().renderer?.domElement;
  if (cv) {
    cv.addEventListener('contextmenu', e => { if (scoped || (onMars() && rifleOut())) e.preventDefault(); });
    window.addEventListener('mousedown', e => { if (e.button === 0 && scoped && e.target === cv) { hookFrame = frame; trigger(); return; } if (e.button !== 2 || e.target !== cv || !onMars() || !onFoot()) return; if (!scoped && !rifleOut()) return; e.preventDefault(); e.stopImmediatePropagation(); setScope(!scoped); }, true);
  }
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && scoped && !isTouch()) setScope(false); });
  window.addEventListener('ssx:consequences', e => { if (e.detail?.type === 'down' && run) fail('you got taken down.'); });
  const api = {
    start, stop: () => { if (run) end('quit'); return true; }, active: () => run ? { id: run.c.id, mark: run.c.mark, stage: run.stage, down: run.down, spooked: run.spooked, perched } : null,
    scope: on => setScope(on === undefined ? !scoped : !!on), scoped: () => scoped, list: () => K.list(S), stats: () => ({ ...S, done: { ...S.done } }), on: f => { subs.add(f); return () => subs.delete(f); },
    zoom: zoomStep, trigger, open, close,
    debug: {
      // materials in the sniper group without a compiled program (0 = prewarm worked)
      uncompiled: () => { const r = app()?.renderer; let n = 0; if (!r || !G) return -1; const seen = new Set(); G.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (seen.has(m)) continue; seen.add(m); if (!r.properties.get(m)?.currentProgram) n++; } }); return n; },
      reset() { if (run) end('quit'); S = K.fresh(); save(); },
      tower: () => ({ x: TW.x, z: TW.z, ringX: TW.x, ringZ: TW.z + 3.25 }),
      mark: () => markPos.ok ? { x: markPos.x, y: markPos.y, z: markPos.z } : null,
      climb: () => { climbUp(); return perched; }, perched: () => perched,
      aimAtMark(part = 'head') { const p = lastTc?.player; if (!p || !markPos.ok) return false; const ty = markPos.y + (part === 'head' ? 1.72 : 1.1), dx = markPos.x - p.x, dz = markPos.z - p.z, dy = ty - (p.y - 0.06); p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); return true; },
      steady: on => { steadyTouch = !!on; }, breath: () => ({ ...B }), cool: () => cool, fov: () => lastTc?.camera?.fov, setCool: v => { cool = v; },
      state: () => ({ run: !!run, scoped, perched, magI, fov: fovNow, base: baseFov }),
    },
  };
  window.SSX.sniper = api;
}
boot();
