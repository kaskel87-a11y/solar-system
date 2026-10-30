// myrides.js: every ride you own stays in the world (live fix: buying a ride made the old one vanish).
// The game has ONE drivable rover object; dealership.js re-skins it as your active ride. Before this, switching rides
// just re-skinned it, so the old ride only lived on as a row in the garage save. Now:
// - the ride you step out of (buy / switch) is saved with where you left it: progress.garage.rides[i].park
//   = { planet, x, z, y, yaw } (ridepark.js), and shows up there as a parked vehicle with a collision footprint
// - walk up to it: "🔑 Drive <name>" (context button, or E) swaps it with the active ride: the one you were using
//   stays parked where it is, the rover object jumps to the parked one, takes its skin, and you get in
// - "My rides" list (garage tab + ☰ → 🚗 Rides & meets): Deliver to me (75 cr, free near your lock-ups or ship)
//   and Show on map (yellow nav ring); small white blips on the minimap for parked rides
// - old saves: rides with no park record go to numbered lock-up bays next to the garage the first time you're on Mars
// Created by dealership.js (createMyRides(deps)); no shared-file hooks of its own.
import * as THREE from 'three';
import { buildVehicle, VEHICLES } from './world.js';
import { buildRover } from './models.js';
import { decorate } from './rides.js';
import * as RP from './ridepark.js';

const ROVER_DIMS = { w: 3.0, len: 6.2, y: 1.8, roof: 2.8, tail: 3.05, nose: -3.2 };
const REACH = 6.2;  // m (centre to centre): walk this close to a parked ride to get the Drive button; < surface's 6.5 m rover reach
const CSS = `#dlrSheet .mr{border-top:1px solid rgba(255,255,255,.2);padding:6px 0 2px}#dlrSheet .mr .st{opacity:.75;font-size:.76rem}#dlrSheet .mr .row{margin:4px 0}`;

export function createMyRides(d) {
  const { ctx, garage, save, activeRide, rideById, rideName, toast, spend, credits, app, cfg, spots, here, esc, setNav, syncNow, disposeRoot } = d;
  let group = null, scene = null, planetName = null, reps = new Map(), syncT = 0, keyBound = false, lastMarks = '';
  const C = () => ctx();
  const H = (x, z) => C()?.height ? C().height(x, z) : 0;
  const world = () => C()?.world;
  const me = () => { const c = C(); return c.car ? { x: c.car.x, z: c.car.z, yaw: c.car.yaw } : { x: c.player.x, z: c.player.z, yaw: c.player.yaw || 0 }; };
  const isStockish = r => r.kind === 'rover' || !VEHICLES[r.kind];
  const specR = r => (VEHICLES[r.kind] || VEHICLES.rover).r || 2.4;
  const yFor = p => { const g = H(p.x, p.z); return p.y != null && p.y >= g - 0.5 && p.y < g + 60 ? Math.max(g, p.y) : g; };
  const homeInfo = () => {
    const c = C(), m = me(), onHome = c.name === cfg().world && !!c.world?.colony, S = onHome ? spots() : null, ship = app()?.surface?.mapData?.()?.ship;
    return { nearGarage: !!S && Math.hypot(m.x - S.garage.x, m.z - S.garage.z) < RP.HOME_R, nearShip: !!ship && Math.hypot(m.x - ship.x, m.z - ship.z) < RP.SHIP_R };
  };
  function feeFor(ride) {
    const c = C(), p = RP.cleanPark(ride.park), planet = p ? p.planet : cfg().world;
    return RP.deliverFee({ samePlanet: planet === c.name, ...homeInfo() });
  }

  // ---------- park bookkeeping ----------
  // the active ride is about to stop being active: remember where the rover object is
  function parkOutgoing() {
    const c = C(), a = activeRide(); if (!c?.rover || !a) return null;
    a.park = RP.parkOf(c.rover, c.name); return a.park;
  }
  // rides with no park record (old saves; rides bought before this fix): lock-up bays, once we know where the garage is
  function assignBays() {
    if (!here()) return false; const G = garage(), ids = RP.unparked(G); if (!ids.length) return false;
    const S = spots(), yaw = cfg().yaw || 0;
    for (const id of ids) { const r = rideById(id), b = RP.freeBay(G.rides, S.garage, yaw, id); const s = clearSpot(b.x, b.z, specR(r) * 0.8, id);
      r.park = { planet: C().name, x: s.x, z: s.z, y: H(s.x, s.z), yaw: b.yaw, at: Date.now(), bay: b.bay }; }
    save(); return true;
  }
  // a spot near (x,z) that doesn't overlap a building, the rover, the player or another parked ride
  function clearSpot(x, z, r, skipId = null) {
    const c = C(), w = world(), others = [...reps.values()].filter(o => o.id !== skipId);
    const free = (px, pz) => !(w?.collide?.(px, pz, r)) && !(c.rover && Math.hypot(px - c.rover.x, pz - c.rover.z) < r + (c.rover.spec?.r || 2.4) * 0.8 + 0.6)
      && Math.hypot(px - c.player.x, pz - c.player.z) > r + 1.2 && !others.some(o => Math.hypot(px - o.x, pz - o.z) < r + o.r + 0.6);
    if (free(x, z)) return { x, z };
    for (let k = 0; k < 36; k++) { const a = k * Math.PI / 6, R = r * 2 + 1.5 + Math.floor(k / 12) * 4, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R; if (free(px, pz)) return { x: px, z: pz }; }
    return { x: x + r * 3, z };
  }

  // ---------- parked replicas ----------
  function ensureGroup() {
    const c = C(); if (group && scene === c.scene && planetName === c.name && group.parent) return;
    clearAll(); scene = c.scene; planetName = c.name; group = new THREE.Group(); group.name = 'myRidesRoot'; scene.add(group);
  }
  function clearAll() {
    for (const o of reps.values()) world()?.removeSolid?.(o.solid);
    reps.clear(); if (group) { group.parent?.remove(group); disposeRoot(group); } group = null;
    window.SSX?.minimap?.clear?.('myrides'); lastMarks = '';
  }
  function buildRep(ride) {
    let v = null; try { v = isStockish(ride) ? buildRover() : buildVehicle(ride.kind); } catch (e) { v = null; } if (!v) return null;
    try { decorate(v, ride, isStockish(ride) ? { paint: false, dims: ROVER_DIMS } : {}); } catch (e) { }
    v.group.userData.myRide = ride.id; group.add(v.group); return v;
  }
  const looksKey = r => JSON.stringify([r.kind, r.paint, r.kit, r.wheels, r.glow]);
  function sync(depth = 0) {
    const c = C(); ensureGroup(); assignBays();
    const G = garage(), want = new Map();
    for (const r of G.rides) { if (r.id === G.active) continue; const p = RP.cleanPark(r.park); if (p && p.planet === c.name) want.set(r.id, { r, p }); }
    for (const [id, o] of reps) if (!want.has(id) || o.key !== looksKey(want.get(id).r)) { world()?.removeSolid?.(o.solid); group.remove(o.v.group); disposeRoot(o.v.group); reps.delete(id); }
    for (const [id, { r, p }] of want) {
      let o = reps.get(id);
      if (!o) { const v = buildRep(r); if (!v) continue; o = { id, v, key: looksKey(r), r: specR(r) * 0.8 }; reps.set(id, o); }
      // never leave a parked ride overlapping the rover or you (a footprint you start inside of would pin you)
      const rv = c.rover, y = yFor(p);
      if ((rv && Math.hypot(p.x - rv.x, p.z - rv.z) < o.r + (rv.spec?.r || 2.4) * 0.8 + 0.3 && Math.abs(y - (rv.y ?? y)) < 2.5)
        || (!c.car && Math.hypot(p.x - c.player.x, p.z - c.player.z) < o.r * 0.7)) {
        if (depth < 3) { world()?.removeSolid?.(o.solid); o.solid = null; const s = clearSpot(p.x, p.z, o.r, id); r.park = { ...p, x: s.x, z: s.z, y: H(s.x, s.z) }; save(); return sync(depth + 1); }
      }
      o.x = p.x; o.z = p.z; o.y = y; o.v.group.position.set(p.x, y, p.z); o.v.group.rotation.set(0, p.yaw, 0);
      // collision footprint (roofs.js: flat top, so you can also land on it); world.solids resets per colony visit
      if (!o.solid || o.solid.x !== p.x || o.solid.z !== p.z || o.solid.y0 !== y) { world()?.removeSolid?.(o.solid); o.solid = { x: p.x, z: p.z, r: o.r, h: 1.9, y0: y, top: y + 1.9, flat: true, myRide: id }; }
      world()?.addSolid?.(o.solid);
    }
    const marks = [...reps.values()].map(o => ({ x: o.x, z: o.z, color: '#ffffff', r: 2.2, ring: true })), mk = JSON.stringify(marks);
    if (mk !== lastMarks) { lastMarks = mk; if (marks.length) window.SSX?.minimap?.addMarks?.('myrides', marks); else window.SSX?.minimap?.clear?.('myrides'); }
  }
  function nearest() {
    const c = C(); if (!c || c.car) return null; let best = null;
    for (const o of reps.values()) { const dd = Math.hypot(o.x - c.player.x, o.z - c.player.z); if (dd < REACH && (!best || dd < best.dd)) best = { o, dd }; }
    if (!best) return null;
    if (c.rover && Math.hypot(c.rover.x - c.player.x, c.rover.z - c.player.z) < best.dd) return null; // your rover's closer: normal Enter
    return best.o;
  }
  function busy() { const c = C(); return !c || c.game?.isDown?.() || !!window.__race?.state || !!app()?.surface?.info?.inside || !app()?.state?.onSurface; }

  // ---------- actions ----------
  function swap(id) {
    const c = C(), G = garage(), r = rideById(id); if (!c?.rover || !r || id === G.active) return { ok: false, msg: 'Not here.' };
    if (c.car) return { ok: false, msg: 'Get out of the one you’re in first.' };
    if (window.__race?.state) return { ok: false, msg: 'Not mid-race.' };
    const p = RP.cleanPark(r.park); if (!p || p.planet !== c.name) return { ok: false, msg: 'It isn’t parked here.' };
    const out = activeRide(), outName = rideName(out);
    parkOutgoing(); G.active = id; delete r.park;
    const rv = c.rover, y = yFor(p);
    rv.x = p.x; rv.z = p.z; rv.y = y; rv.yaw = p.yaw; rv.vy = 0; rv.speed = 0; rv.steer = 0; rv.prevG = null; rv.air = false; rv.pitch = 0; rv.roll = 0; rv.lift = 0;
    rv.group.position.set(rv.x, rv.y, rv.z); rv.group.rotation.set(0, rv.yaw, 0);
    save(); syncNow(); sync();
    const how = app()?.surface?.interact?.();
    return { ok: true, entered: how === 'drive', msg: `🔑 ${rideName(r)}. The ${outName.replace(/^Your /, '')} stays parked where you left it.` };
  }
  function deliver(id) {
    const c = C(), G = garage(), r = rideById(id); if (!c || !r) return { ok: false, msg: 'Not in your garage.' };
    if (busy()) return { ok: false, msg: 'Not right now.' };
    const fee = feeFor(r), name = rideName(r);
    if (id === G.active) {
      if (c.car === c.rover) return { ok: false, msg: 'You’re already in it.' };
      if (c.car) return { ok: false, msg: 'Get out of the one you’re in first.' };
      if (fee && credits() < fee) return { ok: false, msg: `🚚 Delivery is ${fee} cr. You’re short.` };
      const s = app()?.surface?.summonRover?.(); if (!s?.ok) return { ok: false, msg: `🚚 Can’t deliver: ${s?.why || 'not now'}.` };
      if (fee) spend(fee); save(); return { ok: true, fee, msg: `🚚 ${name} delivered${fee ? ` · −${fee} cr` : ' · free'}.` };
    }
    if (fee && !spend(fee)) return { ok: false, msg: `🚚 Delivery is ${fee} cr. You’re short.` };
    const m = me(), side = m.yaw + Math.PI / 2, x0 = m.x - Math.sin(side) * 4.6, z0 = m.z - Math.cos(side) * 4.6; // inside REACH so the Drive button shows right away
    ensureGroup(); const old = reps.get(id); if (old?.solid) { world()?.removeSolid?.(old.solid); old.solid = null; }
    const s = clearSpot(x0, z0, specR(r) * 0.8, id);
    r.park = { planet: c.name, x: s.x, z: s.z, y: H(s.x, s.z), yaw: m.yaw, at: Date.now() };
    save(); sync();
    return { ok: true, fee, x: s.x, z: s.z, msg: `🚚 ${name} delivered, parked right beside you${fee ? ` · −${fee} cr` : ' · free (home)'}.` };
  }
  function locate(id) {
    const c = C(), G = garage(), r = rideById(id); if (!c || !r) return null;
    if (id === G.active) return c.rover ? { x: c.rover.x, z: c.rover.z, planet: c.name } : null;
    const p = RP.cleanPark(r.park); if (p) return { x: p.x, z: p.z, planet: p.planet };
    if (here()) { const S = spots(); return { x: S.garage.x, z: S.garage.z, planet: c.name }; }
    return { planet: cfg().world };
  }
  function showOnMap(id) {
    const c = C(), r = rideById(id), at = locate(id); if (!r || !at) return { ok: false, msg: 'Not in your garage.' };
    if (at.planet !== c.name || at.x == null) return { ok: false, msg: `📍 Your ${rideName(r).replace(/^Your /, '')} is on ${at.planet}. Deliver it here, or fly over.` };
    setNav({ x: at.x, z: at.z, n: 'ride' }); const m = me();
    return { ok: true, msg: `📍 ${rideName(r)}: ${Math.round(Math.hypot(at.x - m.x, at.z - m.z))} m. Follow the yellow ring on the radar.` };
  }

  // ---------- UI ----------
  function listHTML() {
    const c = C(), G = garage(), m = c ? me() : null; ensureCss();
    const rows = G.rides.map(r => {
      const act = r.id === G.active, st = RP.rideStatus(r, { active: act, driving: act && !!c?.car && c.car === c.rover, planet: c?.name || '', me: m });
      const fee = c ? feeFor(r) : 0, here0 = st.k === 'driving' || (st.k === 'parked' && st.d < 12) || (st.k === 'active' && c?.rover && Math.hypot(c.rover.x - m.x, c.rover.z - m.z) < 12);
      return `<div class="mr" data-ride="${esc(r.id)}"><b>${act ? '🔑 ' : ''}${esc(rideName(r))}</b> <span class="st">${esc(st.text)}</span>
        <div class="row"><button data-deliver="${esc(r.id)}" ${here0 ? 'disabled' : ''}>🚚 Deliver to me · ${fee ? fee + ' cr' : 'free'}</button><button data-showmap="${esc(r.id)}" ${st.k === 'driving' || st.k === 'away' ? 'disabled' : ''}>📍 Show on map</button></div></div>`;
    }).join('');
    const lost = Array.isArray(G.lost) && G.lost.length ? `<div class="sub">⚠️ ${G.lost.length} damaged garage entr${G.lost.length > 1 ? 'ies' : 'y'} kept safe in your save.</div>` : '';
    return `<div class="sub">Every ride you own stays where you parked it. Walk up to one to drive it. Delivery is free near your lock-ups or your ship.</div>${rows}${lost}`;
  }
  function ensureCss() { if (document.getElementById('myRidesCss')) return; const st = document.createElement('style'); st.id = 'myRidesCss'; st.textContent = CSS; document.head.appendChild(st); }
  function ctxAction() {
    if (busy() || d.sheetOpen()) return null; const o = nearest(); if (!o) return null;
    const r = rideById(o.id); if (!r) return null;
    return { label: `🔑 Drive ${rideName(r).replace(/^Your /, '')}`, act: () => { const res = swap(o.id); toast(res.msg, 2800); } };
  }
  function bindKey() {
    if (keyBound) return; keyBound = true;
    // E = Enter/exit vehicle. When a parked ride of yours is the closest thing, it's the one you get into.
    window.addEventListener('keydown', e => {
      if (e.code !== 'KeyE' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      const a = ctxAction(); if (!a) return; e.preventDefault(); e.stopImmediatePropagation(); a.act();
    }, true);
  }
  function tick(dt) {
    const c = C(); if (!c?.scene || !c.player) return;
    bindKey();
    if ((syncT -= dt) > 0 && group?.parent && scene === c.scene && planetName === c.name) return; syncT = 0.5; sync();
  }
  return {
    tick, sync, swap, deliver, showOnMap, locate, parkOutgoing, listHTML, ctxAction, feeFor, clearAll,
    get parked() { return [...reps.values()].map(o => ({ id: o.id, x: o.x, z: o.z, y: o.y, r: o.r, hasSolid: !!o.solid })); }
  };
}
