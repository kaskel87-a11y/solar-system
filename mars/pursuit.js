/*
 * mars/pursuit.js: GTA-style wanted pursuit for Mars ColSec (v7.5.x, Marsmania)
 *
 * world.js stays the single source of heat: world.wanted (0-5), world.crime(), world.setWanted(), its security dispatch
 * (drones, buggies, officers, heavies, gunship), its bust timer (game.bust) and its evade timer. This file layers on top:
 *  - line of sight: any ColSec unit (core securityList + ours) that can see you holds the heat; break LOS and a SEARCH
 *    starts around your last-seen point (a ring on the minimap, a countdown). When it runs out, the stars go.
 *  - dispatch by tier: 1-2★ pursuit rovers that ram, PIT and box you in; 3★ spotlight cones under the core drones (the
 *    beam spots you even round corners); 4★ roadblocks at the Beltway checkpoints and the lane ahead; 5★ armoured SWAT
 *    rovers that ram harder and shoot (their rounds can kill you: wasted).
 *  - losing it: hideouts (Flats, Beltway underpasses, Vat House lab and turf HQ when those modules are present), spray
 *    shops (new plate, stars drop; SSX.garage.respray used when Pumpkin's garage has one), and SSX.bribes (#23) success.
 *  - busted / wasted go through the core game.bust() / hurtPlayer path, so the core fee and contraband's own stash
 *    seizure apply once. Nothing extra is charged here.
 *  - never inside the Rust Pit: no ramming, firing or boxing in the pit zone, in a duel, or inside a building.
 *  - zero-G safe: a car far above the ground (Pumpkin's mars/gravity.js, SSX.gravity) is never rammed or boxed; units
 *    circle under it, every position is NaN-checked and stuck units are re-dispatched.
 *
 * window.SSX.pursuit
 *  heat()       -> world.wanted (0-5)           tier()     -> { stars, rovers, spotlights, roadblocks, swat }
 *  units()      -> [{ id, kind:'rover'|'swat'|'drone'|'buggy'|..., x, y, z, own, seen }]
 *  searching()  -> null | { x, z, r, left, total }   seen() -> bool
 *  hideouts()   -> [{ id, name, kind, x, z, r }]  sprays() -> [{ id, name, x, z, r, price }]   plate() -> 'MRS-1234'
 *  lose(how)    -> { ok, msg }  how: 'hideout' | 'repaint' | 'bribe' (bribe: points you at SSX.bribes, no second UI)
 *  on(event, fn) / on(fn) -> unsubscribe. Events: tier, dispatch, spotted, search, lost, ram, pit, boxed, roadblock,
 *                 busted, wasted, repaint, hideout. Also window 'ssx:pursuit' and SSX.emit('pursuit:<type>').
 *  debug        -> { setHeat, los(true|false|null), expire, sync, goto(id), box, volley(n, dmg), float(h, sec), state,
 *                    pit(), units(), reset }
 */
import * as THREE from 'three';
import { buildVehicle } from '../world.js';

const KEY = 'ssx.pursuit.v1';
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const toast = (m, ms = 3000) => { try { app()?.toast?.(m, ms); } catch (e) { /* no HUD */ } };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const fin = v => Number.isFinite(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PIT_AJ = [-292, -68], PIT_R = 12;           // the Rust Pit (mars/fightclub.js) in Ares Junction coords
const SEARCH_BASE = 8, SEARCH_PER = 5;            // search seconds = 8 + 5 per star
const HIDE_HOLD = 3, FLOAT_H = 4;                 // seconds to lie low; metres above ground = "floating"
const SIGHT = { drone: 45, gunship: 60, officer: 55, heavy: 55, guard: 50, buggy: 75, rover: 80, swat: 80 };

// ---------- state ----------
let S = load(), units = [], blocks = [], cones = [], subs = [], root = null, scn = null, A = null, uid = 0;
let seenNow = false, lastSeenT = -1e9, lastSeen = null, search = null, lastTier = 0, spawnCd = 0, losT = 0, forceLOS = null;
let isDown = false, boxT = 0, hideT = 0, hideAt = null, floatHold = null, lastStars = 0, onMars = false, tNow = 0, stats = { rams: 0, pits: 0, shots: 0, busts: 0, wasted: 0, lost: {} };
let sites = { hide: [], spray: [] }, sitesKey = '', mapKey = '', tracer = null, tracerT = 0, lastDown = null;
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) { /* fresh */ } return { v: 1, plate: newPlate(), resprays: 0 }; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
function newPlate() { return 'MRS-' + String(1000 + Math.floor(Math.random() * 9000)); }
function emit(type, d = {}) {
  const ev = { type, stars: heat(), ...d };
  for (const f of [...subs]) { try { if (!f.t || f.t === type) f.fn(ev); } catch (e) { console.warn('pursuit sub', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:pursuit', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('pursuit:' + type, ev); } catch (e) { /* no bus */ }
}
function on(a, b) { const s = typeof a === 'function' ? { fn: a } : { t: a, fn: b }; if (typeof s.fn !== 'function') return () => {}; subs.push(s); return () => { subs = subs.filter(x => x !== s); }; }
const heat = () => { const w = world(); return onMars && w ? (w.wanted | 0) : 0; };
const mobile = () => !!(isTouch() || window.innerWidth < 700);
function tierOf(n) { const m = mobile(); return { stars: n, rovers: n <= 0 ? 0 : n === 1 ? 1 : m ? 1 : 2, spotlights: n >= 3, roadblocks: n >= 4 ? 2 : 0, swat: n >= 5 ? (m ? 1 : 2) : 0 }; }
function colony() { const c = surf()?.info?.colony; return c && fin(c.x) ? c : null; }
function aj2w(p) { const c = colony(); return c ? { x: c.x + p[0], z: c.z + p[1] } : null; }
function pitAt() { let a = null; try { const at = window.SSX?.fight?.status?.().at; if (Array.isArray(at)) a = aj2w(at); } catch (e) { /* no fight club */ } return a || aj2w(PIT_AJ); }
function inPit(x, z) {
  const w = world(); if (w?.inDuel) return true;
  try { if (window.SSX?.fight?.debug?.inCage) return true; } catch (e) { /* guarded */ }
  const p = pitAt(); return !!p && fin(x) && Math.hypot(x - p.x, z - p.z) < PIT_R;
}
function gravityFloat() { try { const G = window.SSX?.gravity; if (!G) return false; const f = G.floating ?? G.isFloating ?? G.zeroG; return typeof f === 'function' ? !!f() : !!f; } catch (e) { return false; } }

// ---------- player view ----------
let T = null; // last surface tick context
function me() {
  const i = surf()?.info; if (!i || !fin(i.x) || !fin(i.z)) return null;
  const car = T?.car || null, gy = groundAt(i.x, i.z);
  const cy = car && fin(car.y) ? car.y : null;
  const floating = !!(car && cy != null && fin(gy) && cy - gy > FLOAT_H) || (!!car && gravityFloat());
  return { x: i.x, z: i.z, y: cy ?? i.y, driving: !!i.driving, car, speed: car && fin(car.speed) ? car.speed : 0, yaw: car && fin(car.yaw) ? car.yaw : 0, inside: !!i.inside, floating, gy };
}
function groundAt(x, z) { try { const h = world()?.groundAt?.(x, z); return fin(h) ? h : 0; } catch (e) { return 0; } }
function los(x1, z1, x2, z2, y) { try { return world()?.lineOfSight?.(x1, z1, x2, z2, y) !== false; } catch (e) { return true; } }

// ---------- assets (shared, built once) ----------
function assets() {
  if (A) return A; const sh = o => { o.userData.shared = true; return o; };
  A = {
    armor: sh(new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7, metalness: 0.5 })),
    stripe: sh(new THREE.MeshStandardMaterial({ color: 0xf5f5f5, emissive: 0x333333, roughness: 0.6 })),
    red: sh(new THREE.MeshStandardMaterial({ color: 0xd11a1a, emissive: 0x700000, emissiveIntensity: 0.6 })),
    beam: sh(new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })),
    spot: sh(new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.35, depthWrite: false })),
    hide: sh(new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 1 })),
    spray: sh(new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x3b0f8a, emissiveIntensity: 0.6 })),
    tracerM: sh(new THREE.MeshBasicMaterial({ color: 0xffe08a })),
    box: sh(new THREE.BoxGeometry(1, 1, 1)),
    disc: sh(new THREE.CircleGeometry(1, 20)),
    cone: sh((() => { const g = new THREE.ConeGeometry(1, 1, 16, 1, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, 0.5); return g; })()),
  };
  A.disc.rotateX(-Math.PI / 2);
  return A;
}
const mesh = (g, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };
function ensureRoot() {
  const sc = T?.scene; if (!sc) return null;
  if (root && scn === sc) return root;
  root = new THREE.Group(); root.name = 'ssx-pursuit'; sc.add(root); scn = sc; units = []; blocks = []; cones = []; sitesKey = ''; tracer = null; return root;
}

// ---------- own units ----------
function spawnUnit(kind, at = null) {
  const P = me(), r = ensureRoot(); if (!P || !r) return null; assets();
  let x, z;
  if (at) { x = at.x; z = at.z; }
  else { const back = P.driving ? P.yaw : Math.random() * 6.28, a = back + (Math.random() - 0.5) * 1.4, d = 85 + Math.random() * 15; x = P.x + Math.sin(a) * d; z = P.z + Math.cos(a) * d; }
  try { const f = world()?.freeSpot?.(x, z, 2); if (f && fin(f.x) && fin(f.z)) { x = f.x; z = f.z; } } catch (e) { /* keep */ }
  if (!fin(x) || !fin(z)) return null;
  const v = buildVehicle('buggy', true), g = v.group;
  if (kind === 'swat') { g.add(mesh(A.box, A.armor, 0, 1.15, 0, 1.95, 0.75, 3.3), mesh(A.box, A.stripe, 0, 1.56, 0, 1.97, 0.08, 3.32), mesh(A.box, A.armor, 0, 0.75, -1.75, 2.0, 0.5, 0.25)); g.scale.setScalar(1.2); }
  else g.add(mesh(A.box, A.stripe, 0, 1.12, 0, 1.75, 0.06, 3.05));
  const light = mesh(A.box, A.red, 0, kind === 'swat' ? 1.7 : 2.45, 0.2, 0.7, 0.12, 0.2); g.add(light);
  const u = { id: ++uid, kind, group: g, wheels: v.wheels || [], light, x, z, y: groundAt(x, z), yaw: Math.atan2(-(P.x - x), -(P.z - z)), speed: 0, cd: 1.5, hitCd: 0, fireCd: 2, mode: 'chase', stuck: 0, lastX: x, lastZ: z, chk: 0, side: Math.random() < 0.5 ? -1 : 1, seen: false };
  g.position.set(u.x, u.y, u.z); g.rotation.set(0, u.yaw, 0); r.add(g); units.push(u);
  emit('dispatch', { kind, id: u.id });
  return u;
}
function dropUnit(u) { try { root?.remove(u.group); } catch (e) { /* gone */ } units = units.filter(q => q !== u); }
function clearUnits() { for (const u of [...units]) dropUnit(u); }

// ---------- roadblocks (4★) ----------
function hwy() { try { return world()?.highway?.() || null; } catch (e) { return null; } }
function roadDir(x, z) { const H = hwy(); try { if (H?.project && H?.at) { const pr = H.project(x, z), p = H.at(pr.s); if (fin(p.fx) && fin(p.fz)) return { fx: p.fx, fz: p.fz }; } } catch (e) { /* fall through */ } return { fx: 0, fz: 1 }; }
function buildBlock(id, x, z, fx, fz) {
  const r = ensureRoot(); if (!r || !fin(x) || !fin(z)) return null; assets();
  const g = new THREE.Group(), y = groundAt(x, z), yaw = Math.atan2(fx, fz);
  for (const s of [-1, 1]) { const v = buildVehicle('buggy', true); v.group.position.set(s * 2.6, 0, 0); v.group.rotation.y = Math.PI / 2 * s; g.add(v.group); }
  for (const s of [-3, -1, 1, 3]) g.add(mesh(A.box, (s + 3) % 4 ? A.stripe : A.red, s * 1.5 + 0.0, 0.55, 3.2, 1.3, 0.5, 0.25));
  g.position.set(x, y, z); g.rotation.y = yaw; r.add(g);
  const b = { id, x, z, fx, fz, group: g, w: 8, t: 0 }; blocks.push(b); emit('roadblock', { id, x, z }); return b;
}
function syncBlocks(want, P) {
  if (!want) { for (const b of blocks) root?.remove(b.group); if (blocks.length) emit('roadblock', { cleared: true }); blocks = []; return; }
  if (blocks.length >= want) return;
  const H = hwy(), cand = [];
  for (const c of H?.checkpoints || []) if (fin(c.x) && fin(c.z)) cand.push({ id: 'cp:' + c.id, x: c.x, z: c.z, d: Math.hypot(c.x - P.x, c.z - P.z) });
  try { const a = world()?.roadAhead?.(110, 80); if (a && fin(a.x)) cand.push({ id: 'lane', x: a.x, z: a.z, d: 0, fx: a.fx, fz: a.fz }); } catch (e) { /* no road */ }
  cand.sort((a, b) => a.d - b.d);
  for (const c of cand) { if (blocks.length >= want) break; if (blocks.some(b => b.id === c.id || Math.hypot(b.x - c.x, b.z - c.z) < 20)) continue; const d = c.fx != null ? { fx: c.fx, fz: c.fz } : roadDir(c.x, c.z); buildBlock(c.id, c.x, c.z, d.fx, d.fz); }
}

// ---------- spotlights (3★+): cones under the core drones ----------
function syncCones(on, drones, P, dt) {
  const n = on ? drones.length : 0; assets();
  while (cones.length > n) { const c = cones.pop(); root?.remove(c.beam); root?.remove(c.pool); }
  while (cones.length < n && ensureRoot()) { const beam = new THREE.Mesh(A.cone, A.beam), pool = new THREE.Mesh(A.disc, A.spot); beam.renderOrder = 3; pool.renderOrder = 3; root.add(beam, pool); cones.push({ beam, pool, x: P.x, z: P.z, ph: Math.random() * 6 }); }
  let spotted = false;
  cones.forEach((c, i) => {
    const d = drones[i]; if (!d || !fin(d.x) || !fin(d.y)) { c.beam.visible = c.pool.visible = false; return; }
    c.ph += dt; const goal = search && !seenNow ? { x: search.x + Math.sin(c.ph * 0.9 + i) * search.r * 0.6, z: search.z + Math.cos(c.ph * 0.7 + i) * search.r * 0.6 } : { x: P.x + Math.sin(c.ph * 2) * 2.5, z: P.z + Math.cos(c.ph * 1.6) * 2.5 };
    const k = Math.min(1, dt * 1.4); c.x += (goal.x - c.x) * k; c.z += (goal.z - c.z) * k;
    const dx = c.x - d.x, dz = c.z - d.z; if (Math.hypot(dx, dz) > 30) { const L = Math.hypot(dx, dz); c.x = d.x + dx / L * 30; c.z = d.z + dz / L * 30; }
    const gy = groundAt(c.x, c.z), dist = Math.hypot(c.x - d.x, gy - d.y, c.z - d.z); if (!fin(dist) || dist < 0.5) return;
    const rad = 4 + dist * 0.08;
    c.beam.visible = c.pool.visible = true; c.beam.position.set(d.x, d.y - 0.3, d.z); c.beam.scale.set(rad, rad, dist); c.beam.lookAt(c.x, gy, c.z);
    c.pool.position.set(c.x, gy + 0.08, c.z); c.pool.scale.setScalar(rad);
    if (!P.inside && Math.hypot(P.x - c.x, P.z - c.z) < rad + 0.8) spotted = true;
  });
  return spotted;
}

// ---------- hideouts and spray shops ----------
function buildSites() {
  const w = world(), c = colony(); if (!w || !c) return;
  const ds = (() => { try { return w.districts?.() || []; } catch (e) { return []; } })();
  const lab = (() => { try { const s = window.SSX?.lab?.status?.(); return s?.owned && Array.isArray(s.at) ? s.at : null; } catch (e) { return null; } })();
  const hq = (() => { try { const b = (window.SSX?.turf?.blocks?.() || []).find(q => q.owner === 'player' && /court|hq/i.test(q.id + q.name)); return b?.centre || null; } catch (e) { return null; } })();
  const key = [c.x, c.z, ds.length, lab, hq, !!hwy()].join('|'); if (key === sitesKey) return; sitesKey = key;
  const free = (x, z, r = 2.5) => { try { const f = w.freeSpot?.(x, z, r); return f && fin(f.x) ? f : { x, z }; } catch (e) { return { x, z }; } };
  const hide = [], spray = [], FB = { 'red-tape-flats': [-280, -40], 'olympus-row': [0, -430] }, dz = id => ds.find(d => d.id === id) || aj2w(FB[id]), // world districts when registered, else the AJ-relative centres contraband.js uses
    flats = dz('red-tape-flats'), row = dz('olympus-row');
  if (flats) { hide.push({ id: 'flats-culvert', name: 'Storm culvert', kind: 'flats', ...free(flats.x - 38, flats.z + 30), r: 6 }, { id: 'flats-silo', name: 'Gutted silo', kind: 'flats', ...free(flats.x + 36, flats.z - 40), r: 6 });
    spray.push({ id: 'flats-spray', name: 'Dust Devil Respray', ...free(flats.x + 22, flats.z + 26, 3), r: 7 }); }
  if (row) spray.push({ id: 'row-spray', name: 'Red Static Paint & Panel', ...free(row.x - 30, row.z + 24, 3), r: 7 });
  const H = hwy();
  if (H?.at && H.len) for (const [i, f] of [[1, 0.28], [2, 0.68]]) { try { const p = H.at(H.len * f); if (fin(p.x)) hide.push({ id: 'underpass-' + i, name: `Beltway underpass ${i}`, kind: 'underpass', ...free(p.x + p.fz * 9, p.z - p.fx * 9), r: 7 }); } catch (e) { /* no road */ } }
  if (lab) { const p = aj2w(lab); if (p) hide.push({ id: 'lab', name: 'Vat House', kind: 'lab', ...p, r: 6 }); }
  if (hq) { const p = Array.isArray(hq) ? aj2w(hq) : hq; if (p && fin(p.x)) hide.push({ id: 'turf-hq', name: 'Marrow\u2019s Court HQ', kind: 'turf', x: p.x, z: p.z, r: 8 }); }
  sites = { hide, spray };
  if (root) { for (const o of [...root.children]) if (o.userData.site) root.remove(o); assets();
    for (const h of hide) { const g = new THREE.Group(); g.userData.site = true; g.add(mesh(A.box, A.hide, 0, 1.4, 0, 4.5, 2.8, 0.4), mesh(A.box, A.stripe, 0, 2.9, 0, 4.7, 0.18, 0.5)); g.position.set(h.x, groundAt(h.x, h.z), h.z - h.r); root.add(g); }
    for (const s of spray) { const g = new THREE.Group(); g.userData.site = true; g.add(mesh(A.box, A.spray, 0, 2.2, 0, 5, 0.5, 0.5), mesh(A.box, A.stripe, -2.3, 1.1, 0, 0.3, 2.2, 0.3), mesh(A.box, A.stripe, 2.3, 1.1, 0, 0.3, 2.2, 0.3)); g.position.set(s.x, groundAt(s.x, s.z), s.z); root.add(g); } }
}
const sprayPrice = () => 60 + 40 * heat();
function nearSite(list, P) { for (const s of list) if (Math.hypot(P.x - s.x, P.z - s.z) < s.r) return s; return null; }

// ---------- sight ----------
function coreUnits() { try { return (world()?.securityList?.() || []).filter(s => fin(s.x) && fin(s.z)); } catch (e) { return []; } }
function sightCheck(P, drones) {
  if (P.inside) return false;
  const all = [...coreUnits().map(s => ({ ...s, own: false })), ...units];
  for (const u of all) {
    const d = Math.hypot(P.x - u.x, P.z - u.z), r = SIGHT[u.kind] || 60; if (d > r) { if (u.own !== false) u.seen = false; continue; }
    const air = u.kind === 'drone' || u.kind === 'gunship';
    const ok = air ? (d < 18 || los(u.x, u.z, P.x, P.z, 3.2)) : los(u.x, u.z, P.x, P.z, 1.6);
    if (u.own !== false) u.seen = ok; if (ok) return true;
  }
  void drones; return false;
}

// ---------- the tick (SSX.registerSurfaceTick: runs inside surface.update) ----------
function tick(dt, tc) {
  T = tc; onMars = tc?.name === 'Mars'; if (!fin(dt) || dt <= 0) return; dt = Math.min(dt, 0.1); tNow += dt;
  const w = world(), g = game(); if (!onMars || !w || !g) { if (units.length || blocks.length) { clearUnits(); syncBlocks(0); } return; }
  ensureRoot(); buildSites();
  const P = me(); if (!P) return;
  const stars = heat(), TI = tierOf(stars), down = isDown;
  if (stars !== lastStars) onStars(stars, lastStars, P); lastStars = stars;
  if (floatHold && T.car) { floatHold.t -= dt; if (floatHold.t <= 0) floatHold = null; else { const gy = groundAt(T.car.x, T.car.z); T.car.y = gy + floatHold.h; T.car.vy = 0; T.car.air = true; } }
  if (stars <= 0 || down) { if (units.length) clearUnits(); if (blocks.length) syncBlocks(0); syncCones(false, [], P, dt); boxT = 0; hideT = 0; search = null; seenNow = false; marks(null); renderHud(P); return; }
  // dispatch
  spawnCd -= dt; const own = k => units.filter(u => u.kind === k).length;
  if (spawnCd <= 0) { if (own('rover') < TI.rovers) { spawnUnit('rover'); spawnCd = 2.5; } else if (own('swat') < TI.swat) { spawnUnit('swat'); spawnCd = 3.5; } }
  for (const u of [...units]) if ((u.kind === 'rover' && own('rover') > TI.rovers) || (u.kind === 'swat' && own('swat') > TI.swat)) { dropUnit(u); }
  syncBlocks(TI.roadblocks, P);
  const drones = coreUnits().filter(s => s.kind === 'drone' || s.kind === 'gunship');
  // sight: LOS every 0.25 s, spotlight every frame
  const spot = syncCones(TI.spotlights, drones, P, dt);
  losT -= dt; if (losT <= 0) { losT = 0.25; seenNow = forceLOS != null ? forceLOS : (sightCheck(P, drones) || spot); }
  else if (forceLOS == null && spot) seenNow = true;
  if (forceLOS === false) seenNow = false;
  if (seenNow) { if (search) emit('spotted', { x: P.x, z: P.z }); search = null; lastSeen = { x: P.x, z: P.z }; lastSeenT = tNow; }
  else if (!search) { const L = lastSeen || { x: P.x, z: P.z }, total = SEARCH_BASE + SEARCH_PER * stars; search = { x: L.x, z: L.z, r: 25 + 10 * stars, left: total, total }; emit('search', { x: search.x, z: search.z, left: total }); }
  if (search) { search.left -= dt; if (search.left <= 0) { lose('search', true); return; } }
  // units
  const pit = inPit(P.x, P.z), safe = pit || P.inside || P.floating;
  let near = 0;
  for (const u of [...units]) { stepUnit(u, dt, P, stars, safe, pit); if (units.includes(u) && Math.hypot(u.x - P.x, u.z - P.z) < 7.5) near++; }
  // roadblock contact
  if (P.driving && !safe) for (const b of blocks) { const dx = P.x - b.x, dz = P.z - b.z, along = dx * b.fx + dz * b.fz, across = dx * b.fz - dz * b.fx; if (Math.abs(along) < 4.2 && Math.abs(across) < b.w && Math.abs(P.speed) > 6 && P.car) { P.car.speed *= 0.25; b.t = tNow; try { g.hurtPlayer(6 + stars, { x: b.x, z: b.z }); } catch (e) { /* */ } emit('ram', { by: 'roadblock', id: b.id }); stats.rams++; } }
  // boxed in: stopped with two of ours on you (or one on foot); core's own bust timer still runs for its units
  const stopped = P.driving ? Math.abs(P.speed) < 1.5 : true;
  if (!safe && stopped && near >= (P.driving ? 2 : 1)) { boxT += dt; if (boxT > (P.driving ? 3 : 2.5)) { boxT = 0; emit('boxed', { units: near }); try { g.bust?.(); } catch (e) { console.warn('pursuit bust', e); } } }
  else boxT = Math.max(0, boxT - dt);
  // hideouts: out of sight, parked or still inside one
  const h = nearSite(sites.hide, P);
  if (h && !seenNow && (P.driving ? Math.abs(P.speed) < 2 : true)) { hideAt = h; hideT += dt; if (hideT >= HIDE_HOLD) { lose('hideout', true); return; } } else { hideT = 0; hideAt = h; }
  if (tracerT > 0) { tracerT -= dt; if (tracerT <= 0 && tracer) tracer.visible = false; }
  marks(P); renderHud(P);
}
function onStars(n, prev, P) {
  const TI = tierOf(n);
  if (n > prev && prev === 0) { lastSeen = { x: P.x, z: P.z }; lastSeenT = tNow; search = null; seenNow = true; }
  if (n !== lastTier) { lastTier = n; emit('tier', { tier: TI, from: prev, to: n }); }
  if (n === 0) { search = null; }
}
function stepUnit(u, dt, P, stars, safe, pit) {
  u.hitCd -= dt; u.fireCd -= dt; u.chk += dt;
  const dx = P.x - u.x, dz = P.z - u.z, d = Math.hypot(dx, dz) || 0.01, pv = P.speed;
  const fwdX = -Math.sin(P.yaw), fwdZ = -Math.cos(P.yaw), rightX = Math.cos(P.yaw), rightZ = -Math.sin(P.yaw);
  let gx = P.x, gz = P.z, vmax = (u.kind === 'swat' ? 27 : 29) + stars * 1.5;
  const others = units.filter(q => q !== u && Math.hypot(q.x - P.x, q.z - P.z) < 14).length;
  // modes: box (you're slow and there's backup), pit (closing from behind at speed), chase (lead the target)
  const behind = (u.x - P.x) * fwdX + (u.z - P.z) * fwdZ < -1;
  if (pit) { const p = pitAt(); const ex = u.x - p.x, ez = u.z - p.z, el = Math.hypot(ex, ez) || 1; gx = p.x + ex / el * (PIT_R + 6); gz = p.z + ez / el * (PIT_R + 6); vmax = 10; u.mode = 'hold'; }
  else if (P.floating) { const a = tNow * 0.6 + u.id; gx = P.x + Math.sin(a) * 12; gz = P.z + Math.cos(a) * 12; vmax = 14; u.mode = 'circle'; }
  else if (P.driving && Math.abs(pv) < 5 && (others >= 1 || !P.driving)) { const slot = u.id % 3; const ox = slot === 0 ? fwdX * 4.5 : (slot === 1 ? 1 : -1) * rightX * 3.6, oz = slot === 0 ? fwdZ * 4.5 : (slot === 1 ? 1 : -1) * rightZ * 3.6; gx = P.x + ox; gz = P.z + oz; vmax = Math.min(vmax, Math.hypot(gx - u.x, gz - u.z) * 2 + 1); u.mode = 'box'; }
  else if (P.driving && behind && d < 14 && Math.abs(pv) > 8) { gx = P.x + rightX * 1.6 * u.side - fwdX * 1.2; gz = P.z + rightZ * 1.6 * u.side - fwdZ * 1.2; vmax = Math.abs(pv) + 6; u.mode = 'pit'; }
  else { const lead = P.driving ? Math.min(1.2, d / 30) : 0; gx = P.x + fwdX * pv * lead; gz = P.z + fwdZ * pv * lead; if (!P.driving && d < 6) vmax = 3; u.mode = 'chase'; }
  const want = Math.atan2(-(gx - u.x), -(gz - u.z)); u.yaw += Math.atan2(Math.sin(want - u.yaw), Math.cos(want - u.yaw)) * Math.min(1, dt * 3);
  u.speed += (vmax - u.speed) * Math.min(1, dt * 1.6);
  let nx = u.x - Math.sin(u.yaw) * u.speed * dt, nz = u.z - Math.cos(u.yaw) * u.speed * dt;
  try { const c = world()?.collide?.(nx, nz, 1.8); if (c && fin(c.x) && fin(c.z)) { nx = c.x; nz = c.z; u.speed *= 0.6; } } catch (e) { /* no collide */ }
  if (!fin(nx) || !fin(nz)) { nx = u.x; nz = u.z; u.speed = 0; }
  u.x = nx; u.z = nz; const gy = groundAt(u.x, u.z); u.y = fin(gy) ? gy : u.y; if (!fin(u.yaw)) u.yaw = 0; if (!fin(u.speed)) u.speed = 0;
  // stuck or left behind: re-dispatch
  if (u.chk > 6) { const moved = Math.hypot(u.x - u.lastX, u.z - u.lastZ); u.stuck = moved < 2 && d > 12 ? u.stuck + 1 : 0; u.lastX = u.x; u.lastZ = u.z; u.chk = 0; }
  if (u.stuck >= 2 || d > 260) { dropUnit(u); spawnCd = Math.min(spawnCd, 1); return; }
  u.group.position.set(u.x, u.y, u.z); u.group.rotation.set(0, u.yaw, 0);
  for (const wh of u.wheels) if (wh?.spin) wh.spin.rotation.x -= u.speed * dt / 0.48;
  u.light.visible = Math.sin(tNow * 14 + u.id) > 0;
  if (safe) return;
  const g = game(), dy = Math.abs((P.y ?? 0) - u.y - (P.driving ? 0 : 1.6));
  // contact: ram / PIT (cars) or run you down (on foot)
  if (d < (u.kind === 'swat' ? 3.8 : 3.4) && u.hitCd <= 0 && dy < 3 && u.speed > 5) {
    u.hitCd = 1.6;
    if (P.driving && P.car) {
      if (u.mode === 'pit') { P.car.yaw += 0.85 * u.side; P.car.speed *= 0.55; stats.pits++; emit('pit', { id: u.id, kind: u.kind }); }
      else { P.car.speed *= u.kind === 'swat' ? 0.45 : 0.65; stats.rams++; emit('ram', { id: u.id, kind: u.kind }); }
      try { g.hurtPlayer((u.kind === 'swat' ? 8 : 4) + stars, { x: u.x, z: u.z }); } catch (e) { /* */ }
    } else { try { g.hurtPlayer(7 + stars, { x: u.x, z: u.z }); } catch (e) { /* */ } stats.rams++; emit('ram', { id: u.id, kind: u.kind, foot: true }); }
    u.speed *= 0.35;
  }
  // SWAT fire: hitscan with a tracer, only with sight; these rounds can kill (wasted)
  if (u.kind === 'swat' && u.fireCd <= 0 && d < 40 && (u.seen || d < 12)) { u.fireCd = 1.5; fire(u, P, 5 + stars); }
}
function fire(u, P, dmg) {
  if (isDown || game()?.info?.down) return false;
  if (inPit(P.x, P.z) || inPit(u.x, u.z) || P.inside) return false;
  const g = game(); stats.shots++; assets();
  if (ensureRoot()) { if (!tracer) { tracer = new THREE.Mesh(A.box, A.tracerM); root.add(tracer); }
    const ax = u.x, ay = u.y + 1.9, az = u.z, bx = P.x, by = (P.y ?? 0) + (P.driving ? 1.2 : 0), bz = P.z, L = Math.hypot(bx - ax, by - ay, bz - az);
    if (fin(L) && L > 0.5) { tracer.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); tracer.scale.set(0.06, 0.06, L); tracer.lookAt(bx, by, bz); tracer.visible = true; tracerT = 0.09; } }
  if (Math.random() < 0.75) try { g.hurtPlayer(dmg, { x: u.x, z: u.z }); } catch (e) { /* */ }
  emit('shot', { id: u.id }); return true;
}

// ---------- losing the heat ----------
function lose(how, auto = false) {
  const w = world(), P = me(), n = heat();
  if (!w || !P) return { ok: false, msg: 'Not on Mars.' };
  if (how === 'bribe') { const B = window.SSX?.bribes; return { ok: false, msg: B ? 'Pay off ColSec through the bribe options (a stop, a spot bribe, or Rusk\u2019s desk). A paid bribe ends the pursuit here.' : 'No dirty cops on this build.' }; }
  if (n <= 0) return { ok: false, msg: 'Nobody\u2019s after you.' };
  if (how === 'search') { finishLose('search', 0, auto ? '🔎 They lost you. Heat\u2019s off.' : null); return { ok: true, msg: 'Search over.' }; }
  if (how === 'hideout') {
    const h = nearSite(sites.hide, P); if (!h) return { ok: false, msg: 'No hideout here.' };
    if (seenNow) return { ok: false, msg: 'They can see you. Break line of sight first.' };
    finishLose('hideout', 0, `🏚 ${h.name}: you lie low until the sirens fade.`, { hideout: h.id }); return { ok: true, msg: h.name };
  }
  if (how === 'repaint') return repaint();
  return { ok: false, msg: 'lose(how): hideout | repaint | bribe' };
}
function finishLose(how, to, msg, extra = {}) {
  const w = world(); stats.lost[how] = (stats.lost[how] || 0) + 1;
  try { w.setWanted(to, how === 'search' ? 'ColSec lost you' : how === 'hideout' ? 'lay low in a hideout' : how === 'repaint' ? 'new paint, new plate' : 'bribe'); } catch (e) { console.warn('pursuit setWanted', e); }
  if (to <= 0) { clearUnits(); syncBlocks(0); search = null; } else { const P = me(); search = P ? { x: P.x, z: P.z, r: 25 + 10 * to, left: (SEARCH_BASE + SEARCH_PER * to) / 2, total: SEARCH_BASE + SEARCH_PER * to } : null; forceLOS = forceLOS === true ? null : forceLOS; }
  hideT = 0; boxT = 0;
  emit(how === 'hideout' ? 'hideout' : how === 'repaint' ? 'repaint' : 'lost', { how, to, ...extra });
  if (how !== 'search' && how !== 'bribe') emit('lost', { how, to, ...extra });
  else if (how === 'bribe') { /* already emitted */ }
  if (msg) toast(msg, 3200);
}
function repaint() {
  const P = me(), g = game(), n = heat(); if (!P) return { ok: false, msg: 'Not on Mars.' };
  const s = nearSite(sites.spray, P); if (!s) return { ok: false, msg: 'Find a spray shop.' };
  if (!P.driving) return { ok: false, msg: 'Bring a car in.' };
  if (seenNow) return { ok: false, msg: 'Not with ColSec watching. Lose them first.' };
  const price = n > 0 ? sprayPrice() : 40, P2 = g?.progress; if (!P2 || (P2.credits | 0) < price) return { ok: false, msg: `${price} cr for a respray. You\u2019re short.` };
  P2.credits -= price; try { g.save?.(); } catch (e) { /* */ }
  let garage = false; try { const G = window.SSX?.garage; if (typeof G?.respray === 'function') { G.respray({ reason: 'pursuit', price: 0 }); garage = true; } } catch (e) { console.warn('garage respray', e); }
  const old = S.plate; S.plate = newPlate(); S.resprays++; save();
  const to = n <= 3 ? 0 : n - 2;
  if (n > 0) finishLose('repaint', to, null, { plate: S.plate, old, price, garage }); else emit('repaint', { plate: S.plate, old, price, garage, to: 0 });
  const msg = `🎨 ${s.name}: fresh paint, plate ${S.plate}. ${n > 0 ? (to ? `Still ${to}★, but they\u2019re looking for the old car.` : 'ColSec is looking for a different car now.') : ''}`.trim();
  toast(msg, 3400); return { ok: true, msg, price, plate: S.plate, to };
}

// ---------- busted / wasted (core path; contraband seizes its own stash) ----------
function hookOutcomes() {
  const bus = window.SSX; if (!bus?.on) return;
  bus.on('game:down', () => { isDown = true; }); bus.on('game:respawn', () => { isDown = false; });
  bus.on('game:down', d => { if (!onMars) return; const why = d?.why; const stars = lastStars; lastDown = { why, stars, t: Date.now() };
    if (why === 'busted') { stats.busts++; emit('busted', { stars }); } else if (why === 'killed') { stats.wasted++; emit('wasted', { stars }); }
    clearUnits(); syncBlocks(0); search = null; boxT = 0; });
  bus.on('game:respawn', d => { if (!lastDown) return; emit('outcome', { why: lastDown.why === 'busted' ? 'busted' : 'wasted', fee: d?.fee | 0, stars: lastDown.stars }); lastDown = null; });
  // #23 bribes: a paid bribe already moved world.wanted; we drop the pursuit to match (no second bribe UI)
  addEventListener('ssx:bribe', e => { const t = e.detail?.type; if (t !== 'paid' && t !== 'record') return; const n = heat();
    if (n <= 0) { clearUnits(); syncBlocks(0); search = null; emit('lost', { how: 'bribe', to: 0 }); stats.lost.bribe = (stats.lost.bribe || 0) + 1; }
    else { for (const u of units.filter(q => q.kind === 'swat')) dropUnit(u); const P = me(); if (P) search = { x: P.x, z: P.z, r: 25 + 10 * n, left: (SEARCH_BASE + SEARCH_PER * n) / 2, total: SEARCH_BASE + SEARCH_PER * n }; emit('lost', { how: 'bribe', to: n, partial: true }); } });
}

// ---------- minimap ----------
function marks(P) {
  const M = window.SSX?.minimap; if (!M) return;
  const n = heat(), key = !P || !n ? '' : `${search ? Math.round(search.x) + ',' + Math.round(search.z) + ',' + search.r : 'seen'}|${sites.hide.length}|${sites.spray.length}`;
  if (key === mapKey) return; mapKey = key;
  if (!key) { M.clear('pursuit:search'); M.clear('pursuit:hide'); return; }
  if (search) { const pts = [{ x: search.x, z: search.z, color: '#ffd400', r: 3.2, ring: true }]; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; pts.push({ x: search.x + Math.sin(a) * search.r, z: search.z + Math.cos(a) * search.r, color: '#ffd400', r: 1.6 }); } M.addMarks('pursuit:search', pts); }
  else M.clear('pursuit:search');
  M.addMarks('pursuit:hide', [...sites.hide.map(h => ({ x: h.x, z: h.z, color: '#ffffff', r: 3, ring: true, clamp: false })), ...sites.spray.map(s => ({ x: s.x, z: s.z, color: '#a855f7', r: 3, ring: true }))]);
}

// ---------- HUD (black/white, 44px+, window.__onTap) ----------
const css = `
#puHud{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;padding:4px 12px;min-height:30px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 14px/1.2 system-ui,sans-serif;pointer-events:none;white-space:nowrap}
body.surface #puHud.show{display:flex} body.duel #puHud{display:none!important} #puHud .st{letter-spacing:1px;color:#fff} #puHud .st i{font-style:normal;opacity:.3} #puHud .sr{color:#ffd400}
@media (max-width:640px){#puHud{top:calc(98px + env(safe-area-inset-top));left:calc(50% + 34px);font-size:13px;min-height:28px;padding:3px 10px}}
#puAct{position:fixed;z-index:13;right:calc(10px + env(safe-area-inset-right));top:46%;display:none;min-height:52px;min-width:150px;max-width:70vw;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
body.surface #puAct.show{display:block} body.indoors #puAct{display:none!important}
`;
let hud = null, act = null, hudKey = '', actKey = '', lastTouch = 0;
function tapEl(el, fn) { const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouch < 700) return; if (e?.type === 'pointerup') lastTouch = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function ui() {
  if (hud) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  hud = document.createElement('div'); hud.id = 'puHud'; hud.setAttribute('aria-live', 'polite'); document.body.appendChild(hud);
  act = document.createElement('button'); act.id = 'puAct'; act.type = 'button'; document.body.appendChild(act);
  tapEl(act, () => { const r = repaint(); if (!r.ok) toast(r.msg, 2400); });
}
function renderHud(P) {
  if (!hud) return; const n = heat();
  let k = '';
  if (n > 0) { const stars = '★'.repeat(n) + '<i>' + '★'.repeat(5 - n) + '</i>', s = search ? `<span class="sr">🔎 SEARCH ${Math.ceil(search.left)}s</span>` : hideT > 0 && hideAt ? `<span>🏚 LYING LOW ${Math.ceil(HIDE_HOLD - hideT)}s</span>` : '<span>👁 SEEN</span>'; k = `<span class="st">${stars}</span>${s}`; }
  if (k !== hudKey) { hudKey = k; hud.innerHTML = k; hud.classList.toggle('show', !!k); }
  const s = P && P.driving ? nearSite(sites.spray, P) : null, a = s ? `🎨 Respray ${n > 0 ? sprayPrice() : 40} cr` : '';
  if (a !== actKey) { actKey = a; act.textContent = a; act.classList.toggle('show', !!a); }
}

// ---------- API ----------
function unitsPub() {
  const P = me(); const out = units.map(u => ({ id: u.id, kind: u.kind, x: u.x, y: u.y, z: u.z, own: true, mode: u.mode, seen: !!u.seen, d: P ? Math.hypot(u.x - P.x, u.z - P.z) : null }));
  for (const s of coreUnits()) out.push({ kind: s.kind, x: s.x, y: s.y, z: s.z, own: false });
  return out;
}
const API = {
  heat, tier: () => tierOf(heat()), units: unitsPub, seen: () => !!seenNow && heat() > 0,
  searching: () => (search && heat() > 0 ? { x: search.x, z: search.z, r: search.r, left: Math.max(0, search.left), total: search.total } : null),
  hideouts: () => sites.hide.map(h => ({ ...h })), sprays: () => sites.spray.map(s => ({ ...s, price: heat() > 0 ? sprayPrice() : 40 })), plate: () => S.plate,
  roadblocks: () => blocks.map(b => ({ id: b.id, x: b.x, z: b.z })), lose: how => lose(how), on, inPit: () => { const P = me(); return !!P && inPit(P.x, P.z); },
  stats: () => JSON.parse(JSON.stringify(stats)),
  debug: {
    setHeat(n) { try { world()?.setWanted?.(clamp(n | 0, 0, 5), 'debug'); } catch (e) { return false; } return heat(); },
    los(v) { forceLOS = v === true ? true : v === false ? false : null; losT = 0; return forceLOS; },
    expire() { if (!search) return false; search.left = 0.001; return true; },
    sync() { const P = me(); if (!P) return false; const TI = tierOf(heat()); while (units.filter(u => u.kind === 'rover').length < TI.rovers && spawnUnit('rover')); while (units.filter(u => u.kind === 'swat').length < TI.swat && spawnUnit('swat')); syncBlocks(TI.roadblocks, P); return unitsPub().filter(u => u.own).length; },
    goto(id) { const s = surf(); let p = null; if (id === 'pit') p = pitAt(); else p = [...sites.hide, ...sites.spray].find(q => q.id === id) || null; if (!p || !s) return false; s.debugMove(p.x, p.z, 0); return { x: p.x, z: p.z }; },
    box() { const P = me(); if (!P) return 0; let n = 0; for (const [ox, oz] of [[4, 0], [-4, 0], [0, -4.5]]) { const k = units.filter(u => u.kind === 'rover').length; const u = spawnUnit(k < 2 ? 'rover' : 'swat', { x: P.x + ox, z: P.z + oz }); if (u) { u.speed = 0; n++; } } spawnCd = 30; return n; },
    volley(n = 3, dmg = 40) { const P = me(); if (!P) return 0; const u = units.find(q => q.kind === 'swat') || spawnUnit('swat', { x: P.x + 10, z: P.z }); if (!u) return 0; let k = 0; for (let i = 0; i < n; i++) { const r = Math.random; Math.random = () => 0; try { if (fire(u, P, dmg)) k++; } finally { Math.random = r; } } return k; },
    float(h = 30, sec = 8) { if (!T?.car) return false; floatHold = { h, t: sec }; return true; },
    pit: () => pitAt(), units: unitsPub, sites: () => ({ ...sites }),
    state: () => ({ stars: heat(), seen: seenNow, search: API.searching(), forceLOS, boxT, hideT, units: units.length, blocks: blocks.length, cones: cones.filter(c => c.beam.visible).length, float: !!floatHold, me: (() => { const P = me(); return P ? { x: P.x, z: P.z, y: P.y, gy: P.gy, floating: P.floating, driving: P.driving, speed: P.speed } : null; })(), nan: units.some(u => !fin(u.x) || !fin(u.z) || !fin(u.y) || !fin(u.yaw) || !fin(u.speed)), stats }),
    reset() { clearUnits(); syncBlocks(0); search = null; forceLOS = null; floatHold = null; boxT = 0; hideT = 0; S = { v: 1, plate: newPlate(), resprays: 0 }; save(); stats = { rams: 0, pits: 0, shots: 0, busts: 0, wasted: 0, lost: {} }; return true; }
  }
};
(function boot() {
  if (!window.SSX || !window.__app || !window.SSX.registerSurfaceTick) { setTimeout(boot, 200); return; }
  if (window.SSX.pursuit) return; window.SSX.pursuit = API; ui(); hookOutcomes();
  window.SSX.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { console.warn('pursuit tick', e); } });
  // off the surface (space, loading) nothing ticks: drop the HUD
  setInterval(() => { if (!app()?.state?.onSurface && hud?.classList.contains('show')) { hudKey = ''; hud.classList.remove('show'); act?.classList.remove('show'); actKey = ''; } }, 1000);
})();
