// v7.5.22 Magnet crane truck ("GTA in space": wrecker theft). Lou's yellow six-wheel wrecker is parked outside HOOK & CROOK
// TOWING in Red Tape Flats with a 🧲 1,800 CR sign: buy it (🧲 Buy crane / G on foot next to it) or just steal it (E: 2★,
// Lou screams). Either way it lands in ☰ My rides. Driving it, 🧲 Magnet (G) at a crawl drops the electromagnet onto the
// parked ride under the hook (ring highlight + "🧲 Grab <name>"), latches, lifts it and you drive off with it swinging on
// the cable. 🧲 again lowers it and lets go. Lifting a ride is grand theft: seen = +1★ (world.take / crime), the owner
// screams at you, and an unseen lift may get called in ~12 s later. Drop it on Lou's lot (the yard drop zone; waypoint
// set while you carry) and a panel offers Sell whole / Strip for parts (SSX.street.tow.fence, Lou's own prices + heat cut)
// or Keep it (SSX.garage.grantVehicle, no plates, into My rides). Reuses world.js vehicles + wanted, street-tow payouts,
// dealership garage. Pure numbers/rules: mars/cranecore.js (tests/test-crane-unit.mjs). Window API: SSX.crane.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerVehicle, districtsOf, VEHICLES } from '../world.js';
import * as CC from './cranecore.js';
import { YARD } from './street-tow.js';

const app = () => window.__app;
const SSX = () => window.SSX || {};
const toast = (t, ms = 2600) => { try { app()?.toast?.(t, ms); } catch (e) { /* no toast */ } };
let S = CC.loadState(null);
try { S = CC.loadState(localStorage.getItem(CC.SAVE_KEY)); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(CC.SAVE_KEY, JSON.stringify(S)); } catch (e) { /* */ } };
const builds = new Set();
const subs = new Set(), log = [];
const emit = ev => { log.push({ t: R.t, ...ev }); if (log.length > 40) log.shift(); for (const f of subs) { try { f(ev); } catch (e) { console.warn('crane on', e); } } };
const R = { t: 0, tc: null, world: null, st: 'idle', L: CC.STOW_L, Lt: CC.STOW_L, ax: 0, wx: 0, az: 0, wz: 0, pv: null, acc: { x: 0, z: 0 },
  held: null, target: null, prevCar: null, prevWanted: 0, calls: [], ring: null, ringScene: null, nearSale: null, hinted: false, firstRide: false, mode: '', warm: new WeakSet(), panel: null, linesIn: false };

// ---------- the truck: stock hauler + turret, lattice boom, cable, electromagnet (shared materials, ~14 extra meshes) ----------
let K = null;
function kit() {
  if (K) return K;
  const std = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.35, ...o }); m.userData.shared = true; return m; };
  const sale = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(2, 2, 252, 60);
    x.fillStyle = '#fff'; x.font = '800 30px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`\ud83e\uddf2 ${CC.PRICE} CR`, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const cable = new THREE.CylinderGeometry(0.05, 0.05, 1, 5); cable.translate(0, -0.5, 0); cable.userData.shared = true;
  K = { yel: std(0xf2b822, { metalness: 0.2, roughness: 0.55 }), rust: std(0x6b4a2e, { roughness: 0.85 }), steel: std(0x777c82, { metalness: 0.7, roughness: 0.4 }), black: std(0x1c1d20, { metalness: 0.25, roughness: 0.75 }),
    live: new THREE.MeshBasicMaterial({ color: 0x3a1a10 }), cable, sale: new THREE.SpriteMaterial({ map: sale, transparent: true, depthWrite: false }) };
  K.live.userData.shared = true;
  return K;
}
const PI = Math.PI;
function strut(add, mat, a, b, w, d) { // a box from point a to b (truck-local y/z plane), w wide (x), d deep
  const dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dy, dz), o = add(mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, w, L, d);
  o.rotation.x = Math.atan2(dz, dy); return o;
}
function builder({ R: Rg, mesh, build, sec }) {
  const v = build('hauler', sec), k = kit(), b = v.body;
  const parts = [], add = (m, x, y, z, sx, sy, sz, g = Rg.box) => { const o = mesh(g, m, x, y, z, sx, sy, sz); b.add(o); parts.push(o); return o; };
  if (!sec) b.traverse(o => { if (o.isMesh && o.material === Rg.paints.hauler) o.material = k.yel; });
  const tz = CC.TURRET_Z;
  add(k.black, 0, 2.15, tz, 0.85, 0.4, 0.85, Rg.cyl);              // slewing ring on the bed, right behind the cab
  add(k.yel, 0.85, 2.85, tz + 0.5, 0.7, 1.0, 1.0);                 // operator cab on the turret
  add(Rg.dark, 0.85, 3.0, tz + 1.02, 0.55, 0.45, 0.06);            // its back window
  add(k.rust, 0, 2.6, 2.45, 2.0, 1.0, 1.0);                        // counterweight over the tail (rusty, dented)
  const A = [0, 2.7, tz], T = [0, CC.TIP.y, CC.TIP.z];
  for (const s of [-1, 1]) strut(add, k.yel, [s * 0.28, A[1], A[2]], [s * 0.22, T[1], T[2]], 0.14, 0.32);   // boom rails
  for (const f of [0.25, 0.5, 0.75]) add(k.black, 0, A[1] + (T[1] - A[1]) * f, A[2] + (T[2] - A[2]) * f, 0.62, 0.08, 0.08); // lattice rungs
  strut(add, k.steel, [0, 2.4, tz - 1.2], [0, A[1] + (T[1] - A[1]) * 0.3, A[2] + (T[2] - A[2]) * 0.3], 0.2, 0.2);        // hydraulic ram off the cab roof
  const sheave = add(k.black, 0, T[1] + 0.05, T[2], 0.38, 0.5, 0.38, Rg.cyl); sheave.rotation.z = PI / 2;
  for (const s of [-1, 1]) { add(k.black, s * 1.45, 0.75, 2.7, 0.25, 1.3, 0.25); add(k.black, s * 1.45, 0.08, 2.7, 0.6, 0.12, 0.6); } // outriggers
  add(k.black, 0, 0.75, -2.62, 2.5, 0.35, 0.14);                   // push bar on the nose
  for (const s of [-1, 1]) add(k.yel, s * 0.9, 0.75, -2.7, 0.5, 0.36, 0.04);   // hazard plates on it
  merge(b, parts, k);
  // the hook: pivot (swings) -> cable (scaled to length) + magnet (moves down the cable)
  const pivot = new THREE.Group(); pivot.name = 'crPivot'; pivot.position.set(0, T[1], T[2]); b.add(pivot);
  const cab = new THREE.Mesh(k.cable, k.black); cab.name = 'crCable'; cab.scale.y = CC.STOW_L; pivot.add(cab);
  const mag = new THREE.Group(); mag.name = 'crMag'; mag.position.y = -CC.STOW_L; pivot.add(mag);
  mag.add(mesh(Rg.cyl, k.black, 0, -0.22, 0, 0.95, 0.36, 0.95), mesh(Rg.cyl, k.yel, 0, -0.02, 0, 0.6, 0.1, 0.6), mesh(Rg.cyl, k.live, 0, -0.41, 0, 0.75, 0.03, 0.75));
  const sale = new THREE.Sprite(k.sale); sale.name = 'crSale'; sale.position.set(0, 8.3, -2.5); sale.scale.set(3.2, 0.8, 1); sale.visible = !S.owned; v.group.add(sale);
  v.group.userData.crane = true; builds.add(v.group);
  return v;
}

// the ~18 static crane parts bake into one mesh per material (5 draws instead of 18); geometry built once, shared by every copy
function merge(b, parts, k) {
  const by = new Map(); for (const o of parts) { const m = o.material; if (!by.has(m)) by.set(m, []); by.get(m).push(o); }
  k.merged = k.merged || new Map();
  for (const [m, list] of by) {
    let g = k.merged.get(m);
    if (!g) { try { g = mergeGeometries(list.map(o => { o.updateMatrix(); const c = o.geometry.clone(); c.applyMatrix4(o.matrix); return c; }), false); } catch (e) { g = null; }
      if (!g) continue; g.userData.shared = true; k.merged.set(m, g); }
    for (const o of list) b.remove(o);
    const one = new THREE.Mesh(g, m); one.name = 'crBody'; b.add(one);
  }
}
// ---------- registration (runs at import) ----------
registerVehicle(CC.KIND, { ...CC.SPEC }, builder);
function ensureYard() {
  try {
    const D = (districtsOf('Mars') || []).find(d => d.id === CC.DISTRICT); if (!D) return false;
    D.vehicles = D.vehicles || [];
    if (!S.owned && !D.vehicles.some(v => v[0] === CC.KIND)) D.vehicles.push([CC.KIND, ...CC.PARK]);
    for (const r of CC.NPC_RIDES) if (VEHICLES[r[0]] && !D.vehicles.some(v => v[0] === r[0] && v[1] === r[1])) D.vehicles.push([...r]);
    return CC.NPC_RIDES.every(r => VEHICLES[r[0]]); // keep retrying until the dealer kinds exist
  } catch (e) { return false; }
}
if (!ensureYard()) { let n = 0; const iv = setInterval(() => { if (ensureYard() || ++n > 60) clearInterval(iv); }, 250); }
function lines() {
  const reg = SSX().registerBarks; if (R.linesIn || typeof reg !== 'function') return R.linesIn;
  try { for (const [c, l] of Object.entries(CC.LINES)) reg(c, l); R.linesIn = true; } catch (e) { /* */ }
  return R.linesIn;
}
function bark(at, cat, name) {
  lines(); let line = null;
  try { line = SSX().bark?.({ x: at.x, z: at.z, kind: 'colonist', name }, cat, { force: true }) || null; } catch (e) { line = null; }
  if (!line) { const p = CC.LINES[cat] || []; line = p[Math.floor(Math.random() * p.length)]; if (line) toast(line, 2800); }
  emit({ type: 'bark', cat, line }); return line;
}

// ---------- helpers ----------
const nameOf = v => VEHICLES[v?.kind]?.name || v?.spec?.name || v?.kind || 'ride';
const isCrane = (car, tc = R.tc) => !!car && (car.kind === CC.KIND || (car === tc?.rover && car.__dlrKind === CC.KIND));
const aboard = (tc = R.tc) => isCrane(tc?.car, tc);
const wanted = () => R.tc?.world?.wanted | 0;
function setWanted(n, why) { try { R.tc?.world?.setWanted?.(n, why); return true; } catch (e) { return false; } }
function district() { try { return (R.tc?.world?.districts?.() || []).find(d => d.id === CC.DISTRICT) || null; } catch (e) { return null; } }
function yardDrop() { // Lou's drop point in world metres (street-tow's own numbers, or the district origin + YARD.drop)
  try { const y = SSX().street?.tow?.yard?.(); if (y?.drop && isFinite(y.drop.x)) return { x: y.drop.x, z: y.drop.z }; } catch (e) { /* */ }
  const D = district(); if (!D) return null; const o = D.origin || D.at || D; if (!isFinite(o.x)) return null;
  return { x: o.x + YARD.drop[0], z: o.z + YARD.drop[1] };
}
function rigOf(car) {
  let r = car.__crRig; const ok = r && (() => { let p = r.pivot; while (p) { if (p === car.group) return true; p = p.parent; } return false; })();
  if (!ok) { const pivot = car.group.getObjectByName('crPivot'); if (!pivot) return null; r = car.__crRig = { pivot, cable: pivot.getObjectByName('crCable'), mag: pivot.getObjectByName('crMag') }; }
  return r;
}
const V3 = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), BOX = new THREE.Box3();
function hookPos(rig) { rig.mag.updateWorldMatrix(true, false); return rig.mag.getWorldPosition(V3); }
function targets(tc) { try { return tc.world?.parkedVehicles?.() || []; } catch (e) { return []; } } // raw world vehicles (debug.vehicles() hands back copies)

// ---------- ring highlight under the target (one shared mesh) ----------
function ring(tc, v) {
  if (!R.ring) { const g = new THREE.RingGeometry(1, 1.25, 28); g.rotateX(-PI / 2);
    R.ring = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })); R.ring.renderOrder = 3; R.ring.visible = false; }
  if (R.ringScene !== tc.scene) { tc.scene.add(R.ring); R.ringScene = tc.scene; try { SSX().stormGuard?.prewarm?.(R.ring, { hide: true, draw: true }); } catch (e) { /* */ } }
  if (!v) { R.ring.visible = false; return; }
  const r = (v.spec?.r || 2.4) * 0.95; R.ring.scale.set(r, 1, r); R.ring.position.set(v.x, (tc.height?.(v.x, v.z) ?? v.y ?? 0) + 0.12, v.z);
  R.ring.material.opacity = 0.55 + 0.35 * Math.sin(R.t * 8); R.ring.visible = true;
}

// ---------- own / buy / steal the crane ----------
function own(how) {
  S.owned = true; S.how = how; save();
  for (const g of builds) { const s = g.getObjectByName('crSale'); if (s) s.visible = false; }
  const G = SSX().garage; let r = null;
  try { r = G?.grantVehicle?.(CC.KIND, { active: false, noPlates: how === 'stole' }); } catch (e) { r = null; }
  if (r && !r.ok && r.full) toast('\ud83e\uddf2 Garage is full. The crane stays where you leave it.', 2600);
  emit({ type: how === 'stole' ? 'steal' : 'buy' }); return r;
}
function nearForSale(tc, r = 8) {
  if (!tc || tc.car || S.owned) return null; let best = null, bd = r;
  for (const g of builds) { if (!g.parent || g.parent !== tc.scene) continue; const d = Math.hypot(g.position.x - tc.player.x, g.position.z - tc.player.z); if (d < bd) { bd = d; best = g; } }
  return best;
}
function buy() {
  const tc = R.tc; if (S.owned) return { ok: false, msg: '\ud83e\uddf2 The crane is already yours. Check \u2630 My rides.' };
  if (!tc || tc.car || !nearForSale(tc)) return { ok: false, msg: `\ud83e\uddf2 Lou\u2019s crane is parked outside HOOK & CROOK in Red Tape Flats (${CC.PRICE} cr).` };
  if (!tc.game?.spend?.(CC.PRICE)) return { ok: false, msg: `\ud83e\uddf2 ${CC.PRICE.toLocaleString('en-US')} cr. You\u2019re short. Or\u2026 just take it.` };
  own('bought'); bark(louAt() || tc.player, 'crane_lou', 'Lou');
  return { ok: true, msg: `\ud83e\uddf2 Magnet crane bought for ${CC.PRICE.toLocaleString('en-US')} cr. Get in (E). It\u2019s in \u2630 My rides too.` };
}
function louAt() { const d = yardDrop(); return d ? { x: d.x - 4.3, z: d.z - 3.2 } : null; }
function onEnter(car, tc) {
  const cur = tc.world?.wanted | 0, owned = S.owned || car === tc.rover;
  const want = CC.wantedOnEnter(owned, R.prevWanted, cur);
  if (want !== cur) setWanted(want, owned ? 'owner' : 'stole Lou\u2019s magnet crane');
  if (owned) { if (!car.crOwned && car !== tc.rover) { car.crOwned = true; const st = tc.game?.progress?.stats; if (st?.stolen > 0) st.stolen--; } }
  else { own('stole'); const l = louAt(); if (l) bark(l, 'crane_lou', 'Lou'); toast(`\ud83e\uddf2 You stole Lou\u2019s magnet crane. Heat ${want}\u2605. It\u2019s in My rides now (no plates).`, 3600); }
  if (!R.firstRide) { R.firstRide = true; setTimeout(() => toast(`\ud83e\uddf2 Crawl up so the hook (out front) is over a parked ride, then ${matchMedia('(pointer:coarse)').matches ? 'tap \ud83e\uddf2 Magnet' : 'press G (or \ud83e\uddf2 Magnet)'}. Drop it on Lou\u2019s lot to sell or keep it.`, 4600), owned ? 200 : 3800); }
}

// ---------- magnet ----------
function press() {
  const tc = R.tc; if (!tc) return { ok: false };
  if (R.mode === 'buy') { const r = buy(); toast(r.msg, r.ok ? 3200 : 2800); return r; }
  if (!aboard(tc)) return { ok: false, msg: 'Get in the crane first.' };
  const sp = Math.abs(tc.car.speed || 0);
  if (R.st === 'held') { if (sp > CC.MAX_SPEED * 2) return say(`\ud83e\uddf2 Slow down to drop it.`); R.st = 'lower'; emit({ type: 'lower' }); return { ok: true }; }
  if (R.st !== 'idle') return { ok: false };
  if (sp > CC.MAX_SPEED) return say('\ud83e\uddf2 Too fast. Crawl over it (under 10 km/h) to drop the magnet.');
  R.st = 'drop'; R.dropT = R.target || null; R.Lt = R.dropT ? R.Lt : CC.STOW_L + 3.2; R.empty = !R.dropT; emit({ type: 'drop', kind: R.dropT?.kind || null });
  return { ok: true };
}
function say(msg) { toast(msg, 2200); return { ok: false, msg }; }
function roofOf(v) { try { v.group.updateWorldMatrix(true, true); BOX.setFromObject(v.group); return Math.max(0.8, Math.min(4, BOX.max.y - v.group.position.y)); } catch (e) { return 2; } }
function latch(tc, rig, v) {
  const w = tc.world, seen = !!w?.hostileAt?.(v.x, v.z), before = w?.wanted | 0;
  const h = roofOf(v), rel = (v.yaw || 0) - (tc.car.yaw || 0);
  try { w?.take?.(v); } catch (e) { v.parked = false; v.taken = true; }   // stolen stat + crime() when witnessed
  if (seen && (w?.wanted | 0) <= before) heat(w, before, `magnet-jacked a ${nameOf(v).toLowerCase()}`);
  v.parked = false; v.carried = true; v.speed = 0;
  rig.mag.add(v.group); v.group.position.set(0, -CC.MAG_H - h, 0); v.group.rotation.set(0, rel, 0);
  R.held = { v, h, rel, relT: CC.crosswise(rel), seen, world: w, at: R.t, name: nameOf(v) };
  R.st = 'lift'; R.Lt = CC.carryLen(h); S.lifts++; if (seen) S.seen++; save();
  // the owner: the nearest person within 45 m screams; nobody around = a call to ColSec later (maybe)
  let owner = null; try { let bd = 45; for (const p of w?.debug?.people?.() || []) { if (p.kind === 'guard' || p.dead) continue; const d = Math.hypot(p.x - v.x, p.z - v.z); if (d < bd) { bd = d; owner = p; } } } catch (e) { /* */ }
  if (owner) bark(owner, 'crane_owner', owner.name || 'Owner'); else bark({ x: v.x, z: v.z }, 'crane_owner', 'Owner');
  if (!seen) R.calls.push({ t: R.t + CC.OWNER_CALL_T, v, name: R.held.name });
  try { SSX().hudx?.setWaypoint?.((() => { const d = yardDrop(); return d ? { x: d.x, z: d.z, label: 'Hook & Crook: sell or keep' } : null; })(), true); } catch (e) { /* */ }
  toast(`\ud83e\uddf2 Got the ${R.held.name}${seen ? ' \u2014 and somebody saw. +1\u2605' : '. Nobody saw\u2026 yet'}. Haul it to HOOK & CROOK to sell or keep it.`, 3400);
  emit({ type: 'grab', kind: v.kind, seen });
}
// +1 star through the world's own crime() (its 2.5 s crime cooldown can swallow it right after another crime: then setWanted)
function heat(w, before, why) { try { w?.crime?.(1, why); if ((w?.wanted | 0) <= before) w?.setWanted?.(CC.heatOnGrab(true, before), why); } catch (e) { /* */ } }
function detach(tc, rig, quiet) { // let go: the ride lands where it hangs and becomes a parked world vehicle again
  const H = R.held; if (!H) return null; R.held = null; const v = H.v;
  try {
    v.group.updateWorldMatrix(true, false); v.group.getWorldPosition(V3); v.group.getWorldQuaternion(Q); E.setFromQuaternion(Q, 'YXZ');
    const sc = H.world === tc?.world ? tc.scene : null; v.group.parent?.remove(v.group);
    if (sc) { sc.add(v.group); v.x = V3.x; v.z = V3.z; v.yaw = E.y; v.y = tc.height?.(v.x, v.z) ?? V3.y; v.group.position.set(v.x, v.y, v.z); v.group.rotation.set(0, v.yaw, 0); }
  } catch (e) { console.warn('crane detach', e); }
  v.carried = false; v.parked = true; v.speed = 0;
  try { SSX().hudx?.setWaypoint?.(null, true); } catch (e) { /* */ }
  if (H.world !== tc?.world) return null;
  const d = yardDrop(), inYard = d && Math.hypot(v.x - d.x, v.z - d.z) < CC.SELL_R;
  S.dropped++; save(); emit({ type: 'release', kind: v.kind, inYard: !!inYard });
  if (inYard && !quiet) openPanel(v); else if (!quiet) toast(`\ud83e\uddf2 Dropped the ${H.name}.`, 1600);
  return v;
}
function stepMagnet(dt, tc, rig) {
  const car = tc.car, sp = car.speed || 0, yaw = car.yaw || 0;
  // swing: the load lags the truck's acceleration (truck frame), Mars gravity pulls it back
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), vx = fx * sp, vz = fz * sp;
  if (R.pv && dt > 0) { const ax = (vx - R.pv.x) / dt, az = (vz - R.pv.z) / dt, k = Math.min(1, dt * 12); R.acc.x += (ax - R.acc.x) * k; R.acc.z += (az - R.acc.z) * k; }
  R.pv = { x: vx, z: vz };
  const c = Math.cos(yaw), s = Math.sin(yaw), aRight = R.acc.x * c - R.acc.z * s, aBack = R.acc.x * s + R.acc.z * c;
  const Lw = R.L + (R.held ? CC.MAG_H + R.held.h * 0.5 : 0.3);
  [R.ax, R.wx] = CC.swingStep(R.ax, R.wx, aRight, Lw, dt); [R.az, R.wz] = CC.swingStep(R.az, R.wz, aBack, Lw, dt);
  rig.pivot.rotation.set(-R.az, 0, R.ax);
  // cable state machine
  if (R.st === 'drop') {
    const v = R.dropT;
    if (v && (!v.parked || v.carried)) { R.st = 'reel'; R.dropT = null; }
    else if (Math.abs(sp) > CC.MAX_SPEED * 1.6) { R.st = 'reel'; R.dropT = null; say('\ud83e\uddf2 Moved off it. Crawl over the ride and try again.'); }
    else {
      if (v) { const hp = hookPos(rig), roof = (v.group.position.y || 0) + roofOf(v); R.Lt = Math.max(0.3, R.L + (hp.y - CC.MAG_H - roof)); }
      R.L = Math.min(R.Lt, R.L + CC.DROP_V * dt);
      if (R.L >= R.Lt - 0.02) {
        if (v) { const hp = hookPos(rig); if (Math.hypot(hp.x - v.x, hp.z - v.z) - (v.spec?.r || 2.4) * 0.6 < CC.GRAB_R + 1) latch(tc, rig, v); else { R.st = 'reel'; say('\ud83e\uddf2 Missed. Line the hook up over it.'); } }
        else { R.st = 'reel'; if (R.empty) say('\ud83e\uddf2 Nothing under the magnet. Pull up so the hook is over a parked ride (white ring).'); }
        R.dropT = null;
      }
    }
  } else if (R.st === 'lift') {
    R.L = Math.max(R.Lt, R.L - CC.LIFT_V * dt); if (R.L <= R.Lt + 0.01) R.st = 'held';
  } else if (R.st === 'lower') {
    const hp = hookPos(rig), g = tc.height?.(hp.x, hp.z) ?? 0, belly = hp.y - CC.MAG_H - (R.held?.h || 2);
    R.L += Math.min(CC.DROP_V * 0.7 * dt, Math.max(0, belly - g)); if (belly - g < 0.06) { detach(tc, rig, false); R.st = 'reel'; }
  } else if (R.st === 'reel') {
    R.L = Math.max(CC.STOW_L, R.L - CC.LIFT_V * 1.5 * dt); if (R.L <= CC.STOW_L + 0.01) R.st = 'idle';
  }
  if (R.held) { const H = R.held, y = H.v.group.rotation.y; H.v.group.rotation.y = y + (H.relT - y) * Math.min(1, dt * 1.5);
    H.v.group.getWorldPosition(V3); H.v.x = V3.x; H.v.z = V3.z; }
  rig.cable.scale.y = R.L; rig.mag.position.y = -R.L;
  rig.mag.children[2]?.material?.color?.setHex(R.held || R.st === 'drop' ? 0xff5a1f : 0x3a1a10);
}

// ---------- sell / keep panel (black and white) ----------
const CSS = `#craneBtn{font-size:14px!important;line-height:1.15!important;background:#000!important;color:#fff!important;border:2px solid #fff!important}
#crPanel{position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:30;background:#000;color:#fff;border:2px solid #fff;border-radius:14px;padding:12px 14px;width:min(340px,92vw);font:600 14px system-ui,sans-serif;display:none}
#crPanel b{display:block;font-size:15px;margin-bottom:8px}#crPanel .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#crPanel button{background:#000;color:#fff;border:1.5px solid #fff;border-radius:10px;padding:10px 6px;font:700 13px system-ui,sans-serif;touch-action:manipulation}#crPanel button:active{background:#fff;color:#000}`;
function tap(el, fn) { (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, fn); }
function quote(kind) {
  try { const q = SSX().street?.tow?.quoteKind?.(kind); if (q && isFinite(q.whole)) return q; } catch (e) { /* */ }
  return { kind, whole: CC.fallbackQuote(kind, VEHICLES[kind]?.price, wanted()), strip: CC.fallbackQuote(kind, VEHICLES[kind]?.price, wanted(), true) };
}
function openPanel(v) {
  css(); let p = R.panel; if (!p) { p = R.panel = document.createElement('div'); p.id = 'crPanel'; document.body.appendChild(p); }
  const q = quote(v.kind), nm = nameOf(v);
  p.innerHTML = `<b>\ud83d\udd27 Lou: \u201cNice catch. ${nm}. What\u2019s it gonna be?\u201d</b><div class="row"><button data-a="sell">\ud83d\udcb0 Sell whole \u00b7 ${q.whole} cr</button><button data-a="strip">\ud83d\udd27 Strip \u00b7 ${q.strip} cr + part</button><button data-a="keep">\ud83d\udd11 Keep it (My rides)</button><button data-a="leave">\u2716 Leave it</button></div>`;
  for (const b of p.querySelectorAll('button')) tap(b, () => { const r = settle(v, b.dataset.a); if (r?.msg) toast(r.msg, 3600); });
  p.style.display = 'block'; R.panelV = v; emit({ type: 'panel', kind: v.kind });
}
function closePanel() { if (R.panel) R.panel.style.display = 'none'; R.panelV = null; }
function settle(v, how) {
  const tc = R.tc, w = tc?.world; v = v || R.panelV; if (!v) return { ok: false };
  if (how === 'leave') { closePanel(); return { ok: true, msg: '' }; }
  if (how === 'keep') {
    let r = null; try { r = SSX().garage?.grantVehicle?.(v.kind, { active: false, noPlates: true }); } catch (e) { r = { ok: false, msg: String(e) }; }
    if (!r?.ok) return { ok: false, msg: r?.full ? '\ud83d\udd11 Garage is full. Sell something first.' : (r?.msg || '\ud83d\udd11 Can\u2019t keep that one.') };
    w?.despawnVehicle?.(v); S.kept++; save(); closePanel(); emit({ type: 'keep', kind: v.kind });
    return { ok: true, msg: `\ud83d\udd11 The ${nameOf(v)} is yours now: \u2630 My rides (no plates). Lou drops it at your lock-up.` };
  }
  const strip = how === 'strip'; let r = null;
  try { r = SSX().street?.tow?.fence?.(v.kind, strip); } catch (e) { r = null; }
  if (!r) { const cash = strip ? quote(v.kind).strip : quote(v.kind).whole; tc?.game?.reward?.(strip ? 8 : 12, cash); r = { ok: true, cash, msg: `\ud83d\udd27 Hook & Crook: ${strip ? 'stripped' : 'bought'} the ${nameOf(v)} for ${cash} cr.` }; }
  if (!r.ok) return r;
  w?.despawnVehicle?.(v); if (strip) S.stripped++; else S.sold++; S.cr += r.cash | 0; save(); closePanel(); emit({ type: strip ? 'strip' : 'sell', kind: v.kind, cash: r.cash });
  return { ...r, msg: '' }; // street-tow already toasted its own receipt
}

// ---------- HUD button (🧲 in #surfBtns) + G ----------
let btn = null, cssOn = false;
function css() { if (cssOn) return; cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
function ui() {
  css(); const col = document.getElementById('surfBtns'); if (!col) return;
  if (!btn) { btn = document.createElement('button'); btn.id = 'craneBtn'; btn.className = 'glass'; btn.style.display = 'none'; col.prepend(btn); tap(btn, e => { e?.preventDefault?.(); press(); }); }
  const txt = R.mode ? CC.label(R.mode, { name: R.mode === 'grab' ? nameOf(R.target) : R.held?.name || '' }) : '';
  if (btn.textContent !== txt) btn.textContent = txt;
  const show = R.mode ? '' : 'none'; if (btn.style.display !== show) btn.style.display = show;
}
addEventListener('keydown', e => {
  if (e.code !== 'KeyG' || e.repeat || !R.mode || R.mode === 'busy') return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (document.getElementById('heistBtn')?.offsetParent) return; // heist's G wins
  e.preventDefault(); e.stopImmediatePropagation(); press();
}, true);

// ---------- per-frame ----------
function tick(dt, tc) {
  R.tc = tc; R.t += dt;
  if (tc.world !== R.world) { // new surface session: forget anything left hanging from the old world
    if (R.held) { R.held.v.group.parent?.remove(R.held.v.group); R.held = null; }
    R.world = tc.world; R.st = 'idle'; R.L = CC.STOW_L; R.calls = []; R.target = null; R.pv = null; closePanel();
  }
  if (R.held && tc.world?.nearVehicle && tc.world.nearVehicle(R.held.v.x, R.held.v.z, 60) !== R.held.v) { // world rebuilt under us (left Mars and came back)
    R.held.v.group.parent?.remove(R.held.v.group); R.held = null; R.st = 'idle'; R.L = CC.STOW_L; closePanel(); try { SSX().hudx?.setWaypoint?.(null, true); } catch (e) { /* */ } }
  if (tc.name !== 'Mars') { R.mode = ''; ui(); return; }
  for (const g of builds) if (g.parent === tc.scene && !R.warm.has(g)) { R.warm.add(g); try { SSX().stormGuard?.prewarm?.(g, { draw: true }); } catch (e) { /* */ } }
  const on = aboard(tc), car = on ? tc.car : null;
  if (car && car !== R.prevCar) onEnter(car, tc);
  if (!tc.car) R.prevWanted = tc.world?.wanted | 0;
  R.prevCar = tc.car || null;
  const rig = car ? rigOf(car) : null;
  if (R.held && (!rig || R.held.world !== tc.world)) { // got out / swapped rides mid-carry: it drops where it hangs
    const prev = R.held; detach(tc, null, true); toast(`\ud83e\uddf2 The ${prev.name} drops off the magnet.`, 1800); R.st = 'idle'; R.L = CC.STOW_L;
  }
  if (rig) stepMagnet(dt, tc, rig); else if (R.st !== 'idle') { R.st = 'idle'; R.L = CC.STOW_L; }
  // owner calls for unseen lifts
  for (let i = R.calls.length - 1; i >= 0; i--) { const c = R.calls[i]; if (R.t < c.t) continue; R.calls.splice(i, 1);
    const close = R.held?.v === c.v || Math.hypot(c.v.x - tc.player.x, c.v.z - tc.player.z) < 200;
    if (CC.ownerCalls(c.force ? 0 : Math.random(), close)) { const p = CC.LINES.crane_call; toast(p[Math.floor(Math.random() * p.length)], 3200); heat(tc.world, tc.world?.wanted | 0, `the ${c.name.toLowerCase()} owner called it in`); emit({ type: 'call', kind: c.v.kind }); } }
  // target + mode + ring
  let hp = null; R.target = null;
  if (rig && R.st === 'idle' && !R.held) { hp = hookPos(rig); R.target = CC.pickTarget(hp.x, hp.z, targets(tc), { skip: car }); }
  if (R.st === 'drop' && R.dropT) R.target = R.dropT;
  ring(tc, rig ? R.target : null);
  const d = R.held ? yardDrop() : null; let inYard = false;
  if (d && rig) { hp = hookPos(rig); inYard = Math.hypot(hp.x - d.x, hp.z - d.z) < CC.SELL_R; }
  R.nearSale = nearForSale(tc);
  if (R.nearSale && !R.hinted) { R.hinted = true; toast(`\ud83e\uddf2 Lou\u2019s magnet crane: ${CC.PRICE.toLocaleString('en-US')} cr. Tap \ud83e\uddf2 Buy crane (G), or just get in and steal it.`, 4200); }
  R.mode = tc.world?.inside ? '' : CC.mode({ driving: !!tc.car, aboard: on, held: !!R.held && R.st === 'held', busy: R.st !== 'idle' && R.st !== 'held', target: R.target, inYard, nearForSale: !!R.nearSale, owned: S.owned });
  if (R.panel && R.panelV && Math.hypot(R.panelV.x - tc.player.x, R.panelV.z - tc.player.z) > 30) closePanel();
  minimap(tc); ui();
}
let mmT = 0;
function minimap(tc) {
  const m = SSX().minimap; if (!m?.addMarks || R.t - mmT < 0.8) return; mmT = R.t;
  const marks = [];
  if (!S.owned) for (const g of builds) if (g.parent === tc.scene) marks.push({ x: g.position.x, z: g.position.z, color: '#d9a21b', r: 4 });
  const d = R.held ? yardDrop() : null; if (d) marks.push({ x: d.x, z: d.z, color: '#ffffff', r: 6, ring: true, clamp: true });
  try { if (marks.length) m.addMarks('crane', marks); else m.clear?.('crane'); } catch (e) { /* */ }
}
function hook() { const X = SSX(); if (typeof X.registerSurfaceTick !== 'function') return false; X.registerSurfaceTick(tick); lines(); return true; }
if (!hook()) { let n = 0; const iv = setInterval(() => { if (hook() || ++n > 120) clearInterval(iv); }, 250); }

// ---------- API ----------
const api = {
  get state() { return { ...S }; }, kind: CC.KIND, price: CC.PRICE,
  status: () => ({ mode: R.mode, st: R.st, L: +R.L.toFixed(2), held: R.held ? { kind: R.held.v.kind, name: R.held.name, seen: R.held.seen } : null, target: R.target ? { kind: R.target.kind, x: R.target.x, z: R.target.z } : null,
    swing: [+R.ax.toFixed(3), +R.az.toFixed(3)], aboard: aboard(), owned: S.owned, panel: !!R.panelV, drop: yardDrop(), calls: R.calls.length }),
  press, buy, settle: how => settle(null, how), yard: yardDrop, log: () => log.slice(),
  on: f => { subs.add(f); return () => subs.delete(f); },
  debug: { reset: () => { S = CC.S0(); save(); for (const g of builds) { const s = g.getObjectByName('crSale'); if (s) s.visible = true; } return true; },
    own: how => own(how || 'bought'), builds: () => [...builds].filter(g => g.parent).map(g => ({ x: g.position.x, z: g.position.z })), hook: () => { const c = R.tc?.car; const r = c && rigOf(c); if (!r) return null; const p = hookPos(r); return { x: p.x, y: p.y, z: p.z }; },
    callNow: force => { for (const c of R.calls) { c.t = R.t; c.force = !!force; } return R.calls.length; } }
};
window.SSX = window.SSX || {}; window.SSX.crane = api;
