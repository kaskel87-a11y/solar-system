// v7.5 add-on: Red Line Motors (rover dealership), your lock-up garages and night car meets on Mars.
// - Dealership: buy new rides with credits (garagecore.js MODELS + any registerVehicle kind with a `price`).
// - Garage: store up to MAX_RIDES rides; paint, body kits, wheels, underglow and engine/handling/brakes/boost upgrades
//   that change the driving spec. The ride you pick becomes "your rover" (same thrusters, turret, Frankie, radio).
// - Car meets (carmeet.js): a timed night event with NPC cars, show-off rep and drag races run on race.js.
// - Save: lives in the game's own progress save (ssx.progress.v1 → progress.garage), migrated by garagecore.migrateGarage.
// Wiring (the only shared-code hooks): index.html imports DEALER_API and merges it into window.SSX; surface.js runs
// window.SSX_TICKS once per surface frame with the same ctx race.js gets. Everything else is set up lazily from here.
import * as THREE from 'three';
import { registerVehicle, buildVehicle, VEHICLES } from './world.js?v=7.4';
import { buildRover } from './models.js?v=7.4';
import { addMenuItem } from './racehooks.js?v=7.4';
import * as GC from './garagecore.js?v=7.4';
import { buildRide, decorate, shapeOf } from './rides.js?v=7.4';
import { createMeet } from './carmeet.js?v=7.4';

// ---------- registration: our models are ordinary vehicle kinds with a price (so they also show up for other mods) ----------
for (const [kind, m] of Object.entries(GC.MODELS)) registerVehicle(kind, { ...m }, () => buildRide(kind));
const EXPLICIT = {}; // SSX.registerDealerVehicle listings
const CFG = { ...GC.DEALER_CONFIG, strip: { ...GC.DEALER_CONFIG.strip } };
const app = () => window.__app;
const toast = (m, ms = 2600) => app()?.toast?.(m, ms);
const isMobile = typeof window !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 600);

export function registerDealerVehicle(kind, opts = {}, builder) {
  if (!kind) throw new Error('registerDealerVehicle(kind, { price, tier?, rep?, blurb?, spec? }, builder?)');
  if (!VEHICLES[kind]) { if (!opts.spec) throw new Error(`registerDealerVehicle: register "${kind}" with SSX.registerVehicle first, or pass opts.spec`); registerVehicle(kind, opts.spec, builder); }
  const { spec, ...listing } = opts; EXPLICIT[kind] = listing; return kind;
}
export function configureDealer(c = {}) { Object.assign(CFG, c, c.strip ? { strip: { ...CFG.strip, ...c.strip } } : {}); planet = null; return { ...CFG }; }
export const dealerStock = () => GC.dealerStock(VEHICLES, EXPLICIT);
// free grants for other modules (mission rewards, a mechanic's favour): no credits, no rep needed.
// rideId: a garage ride id, or 'current' / undefined for the active ride. Returns { ok, msg, ... } and saves.
const rideFor = id => (id == null || id === 'current') ? activeRide() : rideById(id);
export function grantUpgrade(rideId = 'current', slot, levels = 1) {
  if (!GC.UPGRADES[slot]) return grantShopUpgrade(slot);
  const r = rideFor(rideId); if (!r) return { ok: false, msg: 'No such ride.' };
  const from = r.up[slot] | 0, to = Math.min(GC.MAX_LVL, from + Math.max(1, levels | 0)); if (to === from) return { ok: false, maxed: true, msg: `${GC.UPGRADES[slot].name} is already maxed.` };
  r.up[slot] = to; save(); return { ok: true, ride: r.id, slot, level: to, msg: `${GC.UPGRADES[slot].icon} ${GC.UPGRADES[slot].name} Lv ${to} fitted on the ${rideName(r)}. On the house.` };
}
// existing game.js SHOP rover gear (roverarmor, turret2, turret3, rail, rockets, torch, emp): player-wide, not per ride. Applied through the shop's own
// game.buy() so every side effect matches a purchase (P.upgrades, turret look, equip); the price is credited first, so it nets 0.
const shopGrantable = i => i && (i.kind === 'roverup' || i.kind === 'roverwpn' || /^rover/.test(i.id) && i.kind === 'upgrade'); // rover gear only
const gameRef = () => C?.game || app()?.surface?.game;
export function shopGrantIds() { const g = gameRef(); return g?.shopList ? g.shopList(null, true).items.filter(shopGrantable).map(i => i.id) : []; }
function grantShopUpgrade(id) {
  const g = gameRef(), it = g?.shopItem?.(id);
  if (!shopGrantable(it)) return { ok: false, msg: `Unknown upgrade "${id}". Use ${Object.keys(GC.UPGRADES).join(', ')} or a shop id (${shopGrantIds().join(', ')}).` };
  if (it.owned) return { ok: false, owned: true, maxed: true, msg: `Already got ${it.name}.` };
  if (!it.ok) return { ok: false, msg: `${it.name}: ${it.why || 'not available'}.` };
  const P = g.progress; P.credits += it.price; const r = g.buy(id);
  if (!r?.ok) { P.credits = Math.max(0, P.credits - it.price); save(); return { ok: false, msg: r?.msg || 'No dice.' }; }
  return { ok: true, shop: true, id, msg: `🔧 ${it.name} fitted. On the house.` };
}
export function grantPart(rideId = 'current', slot, value, fit = true) {
  const r = rideFor(rideId), tbl = GC.COSMETIC_SLOTS[slot]; if (!r) return { ok: false, msg: 'No such ride.' };
  if (!tbl?.[value]) return { ok: false, msg: `Unknown part ${slot}:${value}.` };
  if (r.kind === 'rover' && (slot === 'paint' || slot === 'kit')) return { ok: false, msg: 'Stock rover paint and bodies are at Meridian Depot.' };
  if (!r.owned[slot].includes(value)) r.owned[slot].push(value); if (fit) r[slot] = value; save();
  return { ok: true, ride: r.id, slot, value, msg: `${tbl[value].name} ${fit ? 'fitted on' : 'stashed for'} the ${rideName(r)}. On the house.` };
}
// a free ride into the garage (barter, mission reward). vehicleId: any SSX.registerVehicle id, dealer-listed or hidden, or 'rover'.
// opts: { noPlates: true } marks it unregistered (stored as ride.noPlates for street/wanted modules to read), active (default true),
// up: { engine: 2, ... } pre-fitted levels, paint/kit/wheels/glow pre-fitted parts.
export function grantVehicle(vehicleId, opts = {}) {
  const G = garage(); if (vehicleId !== 'rover' && !VEHICLES[vehicleId]) return { ok: false, msg: `Unknown vehicle "${vehicleId}". Register it with SSX.registerVehicle first.` };
  if (G.rides.length >= GC.MAX_RIDES) return { ok: false, full: true, msg: '🔧 Garage full. Sell something first.' };
  const r = GC.newRide('r' + G.nextId++, vehicleId); r.spent = 0; r.gift = true; if (opts.noPlates) r.noPlates = true;
  for (const [k, l] of Object.entries(opts.up || {})) if (GC.UPGRADES[k]) r.up[k] = Math.max(0, Math.min(GC.MAX_LVL, l | 0));
  for (const k of Object.keys(GC.COSMETIC_SLOTS)) { const v = opts[k]; if (v && GC.COSMETIC_SLOTS[k][v] && !(vehicleId === 'rover' && (k === 'paint' || k === 'kit'))) { r[k] = v; if (!r.owned[k].includes(v)) r.owned[k].push(v); } }
  G.rides.push(r); if (opts.active !== false) G.active = r.id; save(); if (opts.active !== false) parkActiveAt('garage');
  return { ok: true, ride: r.id, msg: `🔑 ${rideName(r)} is in your lock-up${r.noPlates ? ', no plates, no questions' : ''}.` };
}
// one call for either: grant('current', 'engine') / grant('current', 'glow:cyan') / grant(id, { slot: 'paint', value: 'gold' })
export function grant(rideId, what, n) {
  if (typeof what === 'object' && what) return what.value != null ? grantPart(rideId, what.slot, what.value, what.fit !== false) : grantUpgrade(rideId, what.slot, what.levels || n);
  if (typeof what === 'string' && what.includes(':')) { const [sl, v] = what.split(':'); return grantPart(rideId, sl, v); }
  return grantUpgrade(rideId, what, n);
}
export const GARAGE_API = { grantVehicle, grantUpgrade, grantPart, grant, get rides() { return garage().rides.map(r => ({ ...r })); }, get active() { return garage().active; }, get rep() { return garage().rep; },
  upgrades: Object.keys(GC.UPGRADES), get shopUpgrades() { return shopGrantIds(); }, parts: Object.fromEntries(Object.entries(GC.COSMETIC_SLOTS).map(([k, t]) => [k, Object.keys(t)])) };
export const DEALER_API = { registerDealerVehicle, dealerStock, configureDealer, garage: GARAGE_API };

// ---------- save ----------
const migrated = new WeakSet();
function garage() {
  const P = app()?.game?.progress; if (!P) return GC.freshGarage();
  if (!P.garage || !migrated.has(P.garage)) { P.garage = GC.migrateGarage(P.garage); migrated.add(P.garage); }
  return P.garage;
}
const save = () => app()?.game?.save?.();
const credits = () => app()?.game?.progress?.credits ?? 0;
const spend = n => { const P = app()?.game?.progress; if (!P || P.credits < n) return false; P.credits -= n; return true; };
export const rideById = id => garage().rides.find(r => r.id === id) || null;
const activeRide = () => rideById(garage().active) || garage().rides[0];
const listingOf = kind => kind === 'rover' ? { kind: 'rover', name: 'Rover (stock)', icon: '🚙', tier: 1, price: 600, rep: 0 } : dealerStock().find(s => s.kind === kind) || { kind, name: VEHICLES[kind]?.name || kind, icon: '🚗', tier: GC.inferTier(VEHICLES[kind]?.price || 0), price: VEHICLES[kind]?.price || 0, rep: 0 };
export const tierOf = ride => listingOf(ride.kind).tier;
export function specOf(ride) { const base = VEHICLES[ride.kind] || VEHICLES.rover; return { ...GC.applyUpgrades(base, ride.up, ride.kind === 'rover' ? 'stock' : ride.kit), name: ride.kind === 'rover' ? base.name : (VEHICLES[ride.kind]?.name || ride.kind) }; }
const rideName = r => (r.kind === 'rover' ? (r.gift ? 'Rover' : 'Your rover') : (VEHICLES[r.kind]?.name || r.kind)) + (r.noPlates ? ' (no plates)' : '');

// ---------- world state ----------
let C = null, planet = null, root = null, lot = null, last = 0, nav = null, ui = null, sheet = null, meet = null;
const H = (x, z) => C ? C.height(x, z) : 0;
const W = p => { const c = C?.world?.colony; return { x: (CFG.anchor === 'colony' ? c?.x || 0 : 0) + p[0], z: (CFG.anchor === 'colony' ? c?.z || 0 : 0) + p[1] }; };
export const spots = () => ({ dealer: W(CFG.dealer), garage: W(CFG.garage), meet: W(CFG.meet), stripFrom: W(CFG.strip.from), stripTo: W(CFG.strip.to) });
const here = () => !!C && planet === CFG.world && !!C.world?.colony;
const meOf = () => C.car ? { x: C.car.x, z: C.car.z } : { x: C.player.x, z: C.player.z };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const A = {};
function assets() {
  if (A.ok) return A; A.ok = true; const sh = o => { o.userData.shared = true; return o; };
  A.box = sh(new THREE.BoxGeometry(1, 1, 1)); A.cyl = sh(new THREE.CylinderGeometry(1, 1, 1, 20));
  A.half = sh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, false, Math.PI / 2, Math.PI)); A.half.rotateX(Math.PI / 2); // arch over z
  A.disc = sh(new THREE.CircleGeometry(1, 24)); A.disc.rotateX(-Math.PI / 2);
  A.mConc = sh(new THREE.MeshStandardMaterial({ color: 0x45464c, roughness: 0.9 })); A.mSteel = sh(new THREE.MeshStandardMaterial({ color: 0x7a7f88, roughness: 0.4, metalness: 0.6 }));
  A.mDark = sh(new THREE.MeshStandardMaterial({ color: 0x1b1c21, roughness: 0.7 })); A.mShut = sh(new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.6, metalness: 0.5 }));
  A.mNeonR = sh(new THREE.MeshBasicMaterial({ color: 0xff2a4a })); A.mNeonC = sh(new THREE.MeshBasicMaterial({ color: 0x38e1ff }));
  A.mPool = sh(new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  A.mFlood = sh(new THREE.MeshBasicMaterial({ color: 0xfff1cc }));
  return A;
}
export function signMesh(text, color, w = 8, h = 1.6) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const x = c.getContext('2d'), col = '#' + color.toString(16).padStart(6, '0');
  x.fillStyle = 'rgba(8,8,12,0.9)'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(5, 5, c.width - 10, c.height - 10);
  let fs = Math.round(c.height * 0.6); x.font = `900 ${fs}px system-ui, sans-serif`; while (x.measureText(text).width > c.width - 40 && fs > 14) { fs -= 2; x.font = `900 ${fs}px system-ui, sans-serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 20; x.fillStyle = col; x.fillText(text, c.width / 2, c.height / 2 + 2); x.shadowBlur = 0; x.globalAlpha = 0.6; x.fillStyle = '#fff'; x.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
}
const put = (g, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(g, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); return o; };

function setupPlanet() {
  if (root) { root.parent?.remove(root); disposeRoot(root); }
  root = new THREE.Group(); root.name = 'dealerRoot'; C.scene.add(root); planet = C.name; lot = null; nav = null;
  meet?.reset(); closeSheet();
  if (!here()) return;
  buildLot();
}
function disposeRoot(r) { r.traverse(o => { if (o.isMesh) { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); const m = o.material; if (m && !m.userData?.shared) { m.map?.userData?.shared || m.map?.dispose(); m.dispose(); } } }); }
function buildLot() {
  const a = assets(), S = spots(); lot = { podiums: [], stockKey: '' };
  // --- dealer: concrete apron, neon sign on a gantry, a row of lit podiums ---
  const d = new THREE.Group(); d.position.set(S.dealer.x, H(S.dealer.x, S.dealer.z), S.dealer.z); d.rotation.y = CFG.yaw; root.add(d); lot.dealer = d;
  d.add(put(a.box, a.mConc, 34, 0.3, 16, 0, -0.05, 0));
  for (const s of [-1, 1]) d.add(put(a.box, a.mSteel, 0.4, 7, 0.4, s * 7.5, 3.5, -7.5));
  d.add(put(a.box, a.mDark, 15.4, 0.6, 0.5, 0, 7, -7.5));
  const sign = signMesh(CFG.name, 0xff2a4a, 14, 2.4); sign.position.set(0, 8.6, -7.5); d.add(sign);
  const sub = signMesh('NEW RIDES · TRADE-INS · NO QUESTIONS', 0x38e1ff, 12, 0.9); sub.position.set(0, 6.2, -7.45); d.add(sub);
  d.add(put(a.box, a.mNeonR, 33.8, 0.08, 0.08, 0, 0.14, 7.95));
  for (const s of [-1, 1]) { d.add(put(a.box, a.mSteel, 0.25, 6, 0.25, s * 16, 3, 7)); d.add(put(a.box, a.mFlood, 0.9, 0.3, 0.5, s * 16, 6, 6.6)); d.add(put(a.disc, a.mPool, 5, 1, 5, s * 11, 0.13, 3)); }
  lot.podG = new THREE.Group(); d.add(lot.podG); rebuildPodiums();
  // --- garage: quonset lock-up with a roller door and a work bay in front ---
  const g = new THREE.Group(); g.position.set(S.garage.x, H(S.garage.x, S.garage.z), S.garage.z); g.rotation.y = CFG.yaw; root.add(g); lot.garage = g;
  g.add(put(a.half, a.mShut, 3.4, 4.2, 9, 0, 0, -5)); // quonset arch, 9 m deep
  g.add(put(a.box, a.mDark, 6, 3.6, 0.2, 0, 1.8, -0.55)); // roller door
  for (let i = 0; i < 6; i++) g.add(put(a.box, a.mSteel, 6, 0.05, 0.05, 0, 0.4 + i * 0.55, -0.42));
  g.add(put(a.box, a.mConc, 10, 0.3, 9, 0, -0.05, 4));
  const gs = signMesh('LOCK-UPS · CUSTOM', 0x38e1ff, 7, 1.2); gs.position.set(0, 4.6, -0.4); g.add(gs);
  g.add(put(a.disc, a.mPool, 4.5, 1, 4.5, 0, 0.13, 4.2));
  lot.bay = new THREE.Group(); lot.bay.position.set(0, 0.1, 4.2); g.add(lot.bay);
  // --- car meet lot + drag strip markers ---
  meet = meet || createMeet({ THREE, GC, ctx: () => C, root: () => root, spots, assets, signMesh, put, H, toast, garage, save, activeRide, specOf, tierOf, rideName, buildVehicle, decorate, isMobile, credits, spend, app, openSheet, closeSheet, sheetOpen: () => !!sheet, esc, statBars, cfg: () => CFG });
  meet.buildLot();
}
function rebuildPodiums() {
  if (!lot) return; const stock = dealerStock().slice(0, isMobile ? 5 : 7), key = stock.map(s => s.kind).join(',');
  if (key === lot.stockKey) return; lot.stockKey = key;
  for (const p of lot.podiums) { lot.podG.remove(p.g); disposeRoot(p.g); } lot.podiums = [];
  const a = assets(), n = stock.length, gap = Math.min(6.4, 30 / Math.max(1, n));
  stock.forEach((s, i) => {
    const pg = new THREE.Group(); pg.position.set((i - (n - 1) / 2) * gap, 0, 0.5); lot.podG.add(pg);
    pg.add(put(a.cyl, a.mDark, 2.9, 0.35, 2.9, 0, 0.17, 0)); pg.add(put(a.cyl, a.mNeonC, 2.95, 0.05, 2.95, 0, 0.35, 0));
    let v = null; try { v = buildVehicle(s.kind); } catch (e) { v = null; }
    if (v) { const sc = Math.min(1, (gap - 0.4) / 6.2); v.group.scale.setScalar(Math.max(0.55, sc)); v.group.position.y = 0.38; v.group.rotation.y = 0.6; decorate(v, GC.newRide('show', s.kind), { wheelScale: false }); pg.add(v.group); }
    const tag = signMesh(`${s.name} · ${s.price} cr`, s.rep > 0 ? 0xffd25a : 0x3cff8a, 5, 0.6); tag.position.set(0, 0.4, 2.2); tag.rotation.x = -0.9; tag.scale.setScalar(Math.min(1, gap / 5.6)); pg.add(tag);
    lot.podiums.push({ g: pg, v, kind: s.kind });
  });
}

// ---------- your ride: becomes the rover object surface.js already drives ----------
function syncRover(dt) {
  const rv = C.rover; if (!rv) return;
  const ride = activeRide(), key = JSON.stringify([ride.id, ride.kind, ride.paint, ride.kit, ride.wheels, ride.glow, ride.up]);
  if (rv.__dlrKey !== key || rv.__dlrKind !== ride.kind) applyRide(rv, ride, key);
  const L = rv.__dlr;
  if (L?.skin) {
    // keep the stock hull hidden (game.applyCosmetics / the Roadster kit can re-show it) and spin our wheels
    if ((rv.stockParts?.[0]?.visible) || rv.kitG?.visible) hideStock(rv, true);
    for (const w of L.skin.wheels || []) { w.spin.rotation.x -= rv.speed * dt / (L.wr || 0.5); if (w.front) w.pivot.rotation.y = -rv.steer * 0.45; }
    for (const t of L.turrets) t.position.y = L.turretY;
  }
  // brakes upgrade: the surface brakes at 26 m/s²; add the extra on top when it's clearly braking
  if (C.car === rv && rv.spec?.brake > 1 && !rv.air) {
    // same input surface.js reads (keys + stick); braking = throttle opposing the motion
    const A = app(), k = A?.keys || {}, thr = Math.max(-1, Math.min(1, (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - (A?.joy?.y || 0)));
    if (thr * rv.speed < -0.1 && Math.abs(rv.speed) > 0.5) { const s0 = rv.speed, e = GC.brakeExtra(rv.spec) * dt * Math.abs(thr);
      rv.speed = s0 > 0 ? Math.max(0, s0 - e) : Math.min(0, s0 + e); brakeAssist += Math.abs(s0 - rv.speed); }
  }
  if (L) L.ps = rv.speed;
}
let brakeAssist = 0; // m/s of extra braking applied (tests)
function hideStock(rv, hide) {
  for (const o of rv.stockParts || []) o.visible = !hide && !rv.kit; if (rv.kitG) rv.kitG.visible = !hide && !!rv.kit;
  for (const w of rv.wheels || []) w.pivot.visible = !hide;
}
function applyRide(rv, ride, key) {
  const L = rv.__dlr || (rv.__dlr = { turrets: [] });
  const was = rv.spec;
  if (L.skin && L.kind !== ride.kind) { L.skin.group.parent?.remove(L.skin.group); disposeRoot(L.skin.group); L.skin = null; }
  if (ride.kind === 'rover' || !VEHICLES[ride.kind]) {
    hideStock(rv, false); rv.setKit?.(rv.kit);
    decorate({ group: rv.group, body: rv.body, wheels: rv.wheels }, ride, { paint: false, dims: { w: 3.0, len: 6.2, y: 1.8, roof: 2.8, tail: 3.05, nose: -3.2 } });
  } else {
    if (!L.skin) { let v = null; try { v = buildVehicle(ride.kind); } catch (e) { v = null; } if (v) { rv.body.add(v.group); L.skin = v; } }
    if (L.skin) { hideStock(rv, true); decorate(L.skin, ride); const S = shapeOf(ride.kind); L.wr = S?.wr || 0.5; L.turretY = S?.turret ?? 2.34; }
    // the roof turret: everything game.js hung on rover.body that isn't ours or the stock hull
    L.turrets = rv.body.children.filter(o => o !== L.skin?.group && o !== rv.seat && o !== rv.kitG && !(rv.stockParts || []).includes(o) && !(rv.jets || []).some(j => j.pod === o) && o.isGroup);
    if (rv.__dlrGlow) { rv.__dlrGlow.visible = false; }
    const rg = rv.group.userData.deco?.glow; if (rg) rg.visible = false; // rover's own glow quad off; the skin has its own
  }
  rv.spec = specOf(ride); L.kind = ride.kind; rv.__dlrKey = key; rv.__dlrKind = ride.kind;
  if (!!was?.hover !== !!rv.spec.hover) { rv.lift = 0; rv.prevG = null; rv.vy = 0; rv.air = false; }
}

// ---------- context button + ☰ entry ----------
const CSS = `
#dlrCtxBtn{display:none}
#dlrSheet{position:fixed;left:0;right:0;bottom:0;z-index:15;max-height:58vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:rgba(6,8,18,.95);border-top:1px solid rgba(255,255,255,.18);border-radius:18px 18px 0 0;color:#fff;padding:12px calc(12px + var(--sar,0px)) calc(14px + var(--sab,0px)) calc(12px + var(--sal,0px));box-sizing:border-box;font-size:.84rem;touch-action:pan-y}
@media (orientation:landscape){#dlrSheet{left:auto;top:0;width:min(400px,46vw);max-height:none;border-radius:18px 0 0 18px;border-top:none;border-left:1px solid rgba(255,255,255,.18);padding-top:calc(12px + var(--sat,0px))}}
#dlrSheet h3{margin:0 0 2px;font-size:1.02rem;letter-spacing:.02em}#dlrSheet .sub{opacity:.72;font-size:.76rem;margin-bottom:8px}
#dlrSheet .chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px;-webkit-overflow-scrolling:touch}
#dlrSheet button{min-height:44px;border-radius:12px;font-weight:800;color:#fff;background:#000;border:1px solid rgba(255,255,255,.55);padding:0 12px;font-size:.8rem;touch-action:manipulation;flex:none}
#dlrSheet button.on{border-color:#38e1ff;box-shadow:inset 0 0 0 2px #38e1ff}#dlrSheet button.go{background:#000;border-color:#ff5a7a;box-shadow:inset 0 0 0 2px #ff2a4a;flex:1}
#dlrSheet button:disabled{opacity:.45}#dlrSheet .row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}#dlrSheet .close{position:sticky;top:0;float:right;z-index:2}
#dlrSheet .opt{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:6px 0}#dlrSheet .opt button{text-align:left;padding:4px 10px;line-height:1.15}#dlrSheet .opt small{display:block;font-weight:600;opacity:.75}
#dlrSheet .bars{display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;align-items:center;font-size:.74rem;margin:6px 0}#dlrSheet .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;position:relative}
#dlrSheet .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#38e1ff,#ff2a7a)}#dlrSheet .bar b{position:absolute;top:0;bottom:0;background:#ffd25a;opacity:.85}
#dlrSheet .blurb{opacity:.8;font-size:.78rem;margin:4px 0}#dlrSheet .warn{color:#ffb020}#dlrSheet .tabs{display:flex;gap:4px;overflow-x:auto;margin:6px 0}#dlrSheet .tabs button{min-height:40px;padding:0 10px}
body.dlr-open #surfBtns, body.dlr-open #stackR{visibility:hidden}
body.ssx-drag #raceAgain{display:none}
`;
function ensureUI() {
  if (ui && document.getElementById('dlrCtxBtn')) return ui;
  const st = document.createElement('style'); st.id = 'dlrCss'; st.textContent = CSS; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'dlrCtxBtn'; btn.className = 'glass'; document.getElementById('surfBtns')?.prepend(btn);
  pointerTap(btn, () => ui.act?.());
  const menu = addMenuItem(app(), { id: 'rmRides', label: '🚗 Rides & meets', onTap: () => openHub() });
  document.addEventListener('click', e => { if (performance.now() < ghostUntil && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); ghostUntil = 0; } }, true);
  window.addEventListener('keydown', e => { if (!sheet) return; e.stopImmediatePropagation(); if (e.code === 'Escape') closeSheet(); }, true);
  ui = { btn, menu, act: null, label: '', t: 0 };
  return ui;
}
let ghostUntil = 0;
function pointerTap(el, fn) {
  let id = null, t = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; id = e.pointerId; });
  el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' || e.pointerId !== id) return; e.preventDefault(); id = null; t = performance.now(); ghostUntil = t + 550; fn(e); });
  el.addEventListener('pointercancel', () => { id = null; });
  el.addEventListener('click', e => { if (performance.now() - t < 700) return; fn(e); });
}
function setCtx(label, act) {
  if (!ui) return; ui.act = act;
  if (!label) { if (ui.btn.style.display !== 'none') ui.btn.style.display = 'none'; return; }
  if (ui.btn.textContent !== label) ui.btn.textContent = label; if (ui.btn.style.display !== 'block') ui.btn.style.display = 'block';
}
function updateCtx() {
  if (sheet || !here() || C.game.isDown() || window.__race?.state || app()?.surface?.info?.inside) return setCtx(null);
  const me = meOf(), S = spots();
  const m = meet?.ctxAction(me); if (m) return setCtx(m.label, m.act);
  if (dist(me, S.dealer) < 17) return setCtx('🚗 Dealer', () => openDealer());
  if (dist(me, S.garage) < 11) return setCtx('🔧 Garage', () => openGarage());
  setCtx(null);
}

// ---------- sheets (bottom sheet in portrait, side panel in landscape) ----------
let sheetCam = null;
function openSheet(kind, render, cam) {
  ensureUI(); closeSheet(true);
  const el = document.createElement('div'); el.id = 'dlrSheet'; el.dataset.kind = kind; document.body.appendChild(el);
  sheet = { kind, el, render }; sheetCam = cam || null; document.body.classList.add('dlr-open');
  if (document.pointerLockElement) document.exitPointerLock();
  // one delegated, pointer-based handler: touch acts on pointerup (a thumb on the stick can't block it), mouse on click
  let down = null, t = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; const b = e.target.closest('button'); down = b ? { b, id: e.pointerId, x: e.clientX, y: e.clientY } : null; });
  el.addEventListener('pointerup', e => { if (!down || e.pointerId !== down.id) return; const b = e.target.closest('button'); const ok = b === down.b && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12; down = null; if (!ok || b.disabled) return; e.preventDefault(); t = performance.now(); ghostUntil = t + 550; onSheetTap(b); });
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('click', e => { if (performance.now() - t < 700) return; const b = e.target.closest('button'); if (b && !b.disabled) onSheetTap(b); });
  rerender(); return el;
}
function rerender() { if (!sheet) return; const top = sheet.el.scrollTop; sheet.el.innerHTML = sheet.render(); sheet.el.scrollTop = top; }
export function closeSheet(quiet) { if (!sheet) return; sheet.el.remove(); sheet = null; sheetCam = null; document.body.classList.remove('dlr-open'); if (!quiet) meet?.onSheetClosed?.(); clearBay(); }
const handlers = {};
function onSheetTap(b) {
  const d = b.dataset; if (d.close) return closeSheet();
  for (const k of Object.keys(d)) {
    if (meet && sheet?.kind === 'challenge') { const r = meet.onTap(k, d[k]); if (r === 'close') return closeSheet(); if (r) return rerender(); }
    if (handlers[k]) { handlers[k](d[k], b); return; }
  }
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function statBars(spec, after) {
  const rows = [['Top speed', s => s.boost, 55, s => Math.round(s.boost * 3.6) + ' km/h'], ['Accel', s => s.bacc, 30, s => s.bacc.toFixed(0)], ['Handling', s => s.turn, 2.4, s => s.turn.toFixed(2)], ['Brakes', s => s.brake || 1, 2.1, s => '×' + (s.brake || 1).toFixed(2)]];
  return `<div class="bars">${rows.map(([n, f, mx, lbl]) => { const a = Math.min(100, f(spec) / mx * 100), b = after ? Math.min(100, f(after) / mx * 100) : a;
    return `<span>${n}</span><span class="bar"><i style="width:${a}%"></i>${b > a ? `<b style="left:${a}%;width:${b - a}%"></b>` : ''}</span><span>${lbl(after || spec)}</span>`; }).join('')}
    <span>¼ mile</span><span></span><span>${GC.dragTime(after || spec).toFixed(1)} s · PI ${GC.perfIndex(after || spec)}</span></div>`;
}
const head = (title, sub) => `<button class="close" data-close="1">✕</button><h3>${title}</h3><div class="sub">${sub}</div>`;
const wallet = () => `💰 ${credits()} cr · ⭐ ${Math.round(garage().rep)} rep (${GC.repTitle(garage().rep)})`;

// ----- dealer -----
let dSel = null;
function openDealer() {
  if (!here()) return toast('🚗 Red Line Motors is on Mars, by Ares Junction.');
  rebuildPodiums(); const st = dealerStock(); if (!dSel || !st.some(s => s.kind === dSel)) dSel = st[0]?.kind;
  openSheet('dealer', renderDealer, () => { const p = lot.podiums.find(p => p.kind === dSel) || lot.podiums[0]; return p ? p.g : null; });
}
function renderDealer() {
  const st = dealerStock(), s = st.find(x => x.kind === dSel) || st[0], G = garage(); if (!s) return head('🚗 ' + esc(CFG.name), 'Nothing on the lot today.');
  const spec = specOf(GC.newRide('x', s.kind)), price = GC.sellPrice(s, G.rep), full = G.rides.length >= GC.MAX_RIDES, owned = G.rides.filter(r => r.kind === s.kind).length;
  const why = G.rep < s.rep ? `Needs ${s.rep} rep. Make a name at the car meets first.` : full ? `Garage full (${GC.MAX_RIDES}). Sell a ride first.` : credits() < price ? `You’re ${price - credits()} cr short.` : '';
  return head(`🚗 ${esc(CFG.name)}`, wallet()) +
    `<div class="chips">${st.map(x => `<button data-dsel="${esc(x.kind)}" class="${x.kind === s.kind ? 'on' : ''}">${x.icon} ${esc(x.name)}${G.rep < x.rep ? ' 🔒' : ''}</button>`).join('')}</div>
    <b>${s.icon} ${esc(s.name)}</b> · Class ${'★'.repeat(s.tier)} · ${price < s.price ? `<s>${s.price}</s> ` : ''}<b>${price} cr</b>${owned ? ` · you own ${owned}` : ''}${s.modded ? ' · <i>custom build</i>' : ''}
    <div class="blurb">${esc(s.blurb)}</div>${statBars(spec)}
    ${why ? `<div class="warn">${esc(why)}</div>` : ''}
    <div class="row"><button class="go" data-buy="${esc(s.kind)}" ${why ? 'disabled' : ''}>💳 Buy · ${price} cr</button><button data-togarage="1">🔧 Garage</button></div>`;
}
handlers.dsel = k => { dSel = k; rerender(); };
handlers.buy = k => { const r = buy(k); toast(r.msg, 3200); if (r.ok) closeSheet(); else rerender(); };
handlers.togarage = () => { closeSheet(true); const m = meOf(), S = spots(); if (dist(m, S.garage) < 40) openGarage(); else navTo('garage'); };
export function buy(kind) {
  const s = dealerStock().find(x => x.kind === kind), G = garage(); if (!s) return { ok: false, msg: 'Not on the lot.' };
  const price = GC.sellPrice(s, G.rep);
  if (G.rep < s.rep) return { ok: false, msg: `🔒 ${s.name}: the dealer wants ${s.rep} rep before he’ll even let you sit in it.` };
  if (G.rides.length >= GC.MAX_RIDES) return { ok: false, msg: '🔧 Garage full. Sell something first.' };
  if (!spend(price)) return { ok: false, msg: `💸 ${s.name} is ${price} cr. You’re short, pal.` };
  const r = GC.newRide('r' + G.nextId++, kind); r.spent = 0; G.rides.push(r); G.active = r.id; save();
  parkActiveAt('dealer');
  return { ok: true, id: r.id, msg: `🔑 ${s.name} is yours. Parked out front, keys in it. Customise it at the lock-ups next door.` };
}
// put your (newly selected) ride at a spot, facing out
function parkActiveAt(where) {
  const rv = C?.rover; if (!rv || !here()) return; if (C.car && C.car !== rv) return;
  const S = spots(), p = where === 'garage' ? S.garage : S.dealer, z = p.z + (where === 'garage' ? 9 : 11), x = p.x + (where === 'garage' ? 0 : -4);
  rv.x = x; rv.z = z; rv.y = H(x, z); rv.prevG = null; rv.vy = 0; rv.speed = 0; rv.yaw = Math.PI; rv.air = false;
  if (!C.car) { C.player.x = x + 3; C.player.z = z + 1; }
}

// ----- garage -----
let gSel = null, gTab = 'perf', bay = null;
function openGarage() {
  if (!here()) return toast('🔧 Your lock-ups are on Mars, next to Red Line Motors.');
  const G = garage(); if (!gSel || !rideById(gSel)) gSel = G.active;
  openSheet('garage', renderGarage, () => lot.bay); showBay();
}
function clearBay() { if (bay) { bay.group.parent?.remove(bay.group); disposeRoot(bay.group); bay = null; } }
function showBay() {
  const r = rideById(gSel); if (!r || !lot) return;
  if (bay && bay.kind !== r.kind) clearBay();
  if (!bay) { let v = null; try { v = r.kind === 'rover' ? buildRover() : buildVehicle(r.kind); } catch (e) { v = null; } if (!v) return; bay = { ...v, kind: r.kind }; v.group.rotation.y = 0.7; lot.bay.add(v.group); }
  decorate(bay, r, r.kind === 'rover' ? { paint: false, dims: { w: 3.0, len: 6.2, y: 1.8, roof: 2.8, tail: 3.05, nose: -3.2 } } : {});
}
const TABS = [['perf', '⚙️ Performance'], ['paint', '🎨 Paint'], ['kit', '🧱 Body'], ['wheels', '🛞 Wheels'], ['glow', '💡 Underglow']];
function renderGarage() {
  const G = garage(), r = rideById(gSel) || activeRide(), tier = tierOf(r), spec = specOf(r), stock = r.kind === 'rover';
  const tabs = TABS.filter(([k]) => !(stock && (k === 'paint' || k === 'kit')));
  if (!tabs.some(([k]) => k === gTab)) gTab = 'perf';
  let body = '';
  if (gTab === 'perf') {
    body = `<div class="opt">${Object.entries(GC.UPGRADES).map(([k, u]) => { const lv = r.up[k] | 0, next = lv + 1, p = GC.upgradePrice(k, next, tier);
            return `<button data-up="${k}" class="${gPrev === k ? 'on' : ''}" ${!p || credits() < p ? 'disabled' : ''}>${u.icon} ${u.name} ${'▮'.repeat(lv)}${'▯'.repeat(GC.MAX_LVL - lv)}<small>${!p ? 'MAXED' : gPrev === k ? `Tap again: buy Lv ${next} · ${p} cr` : `Lv ${next} · ${p} cr`}</small></button>`; }).join('')}</div>`;
    const pv = gPrev && GC.upgradePrice(gPrev, (r.up[gPrev] | 0) + 1, tier) ? specOf({ ...r, up: { ...r.up, [gPrev]: (r.up[gPrev] | 0) + 1 } }) : null;
    body += statBars(spec, pv) + `<div class="sub">${gPrev ? esc(GC.UPGRADES[gPrev].desc) : 'Upgrades change the real driving numbers. Yellow = the next level.'}</div>`;
  } else {
    const tbl = GC.COSMETIC_SLOTS[gTab];
    body = `<div class="opt">${Object.entries(tbl).map(([id, c]) => { const own = r.owned[gTab]?.includes(id), on = r[gTab] === id, p = GC.cosmeticPrice(gTab, id, tier), sw = c.color != null ? `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#${c.color.toString(16).padStart(6, '0')};margin-right:4px"></span>` : '';
      return `<button data-cos="${gTab}:${id}" class="${on ? 'on' : ''}" ${!own && credits() < p ? 'disabled' : ''}>${sw}${esc(c.name)}<small>${on ? '✓ fitted' : own ? 'owned · fit' : p + ' cr'}${c.rep ? ` · +${c.rep} rep` : ''}</small></button>`; }).join('')}</div>`;
    if (stock) body += '';
  }
  const act = G.active === r.id;
  return head('🔧 Lock-ups', wallet()) +
    `<div class="chips">${G.rides.map(x => `<button data-gsel="${esc(x.id)}" class="${x.id === r.id ? 'on' : ''}">${G.active === x.id ? '🔑 ' : ''}${esc(rideName(x))}</button>`).join('')}</div>
    <b>${esc(rideName(r))}</b> · Class ${'★'.repeat(tier)} · show rep ${GC.repScore(r, tier)}${stock ? '<div class="sub">Stock rover paint and the Roadster body live at Meridian Depot.</div>' : ''}
    <div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${gTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}
    <div class="row"><button class="go" data-drive="${esc(r.id)}" ${act ? 'disabled' : ''}>${act ? '🔑 Your ride' : '🚗 Drive this'}</button>${r.id !== 'stock' ? `<button data-sell="${esc(r.id)}">💸 Sell · ${GC.tradeIn(r, listingOf(r.kind))} cr</button>` : ''}</div>`;
}
let gPrev = null;
handlers.gsel = id => { gSel = id; gPrev = null; showBay(); rerender(); };
handlers.tab = t => { gTab = t; rerender(); };
handlers.up = (k, b) => { if (gPrev !== k) { gPrev = k; rerender(); return; } const r = upgrade(gSel, k); toast(r.msg, 2400); gPrev = null; rerender(); };
handlers.cos = v => { const [slot, id] = v.split(':'); const r = customise(gSel, slot, id); if (!r.ok) toast(r.msg, 2400); showBay(); rerender(); };
handlers.drive = id => { const r = setActive(id); toast(r.msg, 2600); if (r.ok) closeSheet(); };
handlers.sell = (id, b) => { if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Sure? Tap again'; return; } const r = sell(id); toast(r.msg, 2800); gSel = garage().active; clearBay(); showBay(); rerender(); };
export function upgrade(id, slot) {
  const r = rideById(id); if (!r || !GC.UPGRADES[slot]) return { ok: false, msg: 'No such part.' };
  const lv = (r.up[slot] | 0) + 1, p = GC.upgradePrice(slot, lv, tierOf(r)); if (!p) return { ok: false, msg: `${GC.UPGRADES[slot].name} is maxed.` };
  if (!spend(p)) return { ok: false, msg: `💸 ${p} cr for that. Come back richer.` };
  r.up[slot] = lv; r.spent += p; save(); return { ok: true, msg: `${GC.UPGRADES[slot].icon} ${GC.UPGRADES[slot].name} Lv ${lv} fitted on the ${rideName(r)}.` };
}
export function customise(id, slot, val) {
  const r = rideById(id), tbl = GC.COSMETIC_SLOTS[slot]; if (!r || !tbl?.[val]) return { ok: false, msg: 'Not in the catalogue.' };
  if (r.kind === 'rover' && (slot === 'paint' || slot === 'kit')) return { ok: false, msg: 'Stock rover paint and bodies are at Meridian Depot.' };
  if (!r.owned[slot].includes(val)) { const p = GC.cosmeticPrice(slot, val, tierOf(r)); if (!spend(p)) return { ok: false, msg: `💸 ${p} cr. Nope.` }; r.owned[slot].push(val); r.spent += p; }
  r[slot] = val; save(); return { ok: true, msg: `${tbl[val].name} fitted.` };
}
export function setActive(id) {
  const r = rideById(id); if (!r) return { ok: false, msg: 'Not in your garage.' };
  if (C?.car && C.car !== C.rover) return { ok: false, msg: 'Ditch the ride you’re in first.' };
  if (window.__race?.state) return { ok: false, msg: 'Not mid-race.' };
  garage().active = id; save(); parkActiveAt('garage'); return { ok: true, msg: `🔑 ${rideName(r)} rolled out of the lock-up. It’s your ride now.` };
}
export function sell(id) {
  const G = garage(), r = rideById(id); if (!r || id === 'stock') return { ok: false, msg: 'You can’t sell the colony’s rover.' };
  const v = GC.tradeIn(r, listingOf(r.kind)); G.rides = G.rides.filter(x => x.id !== id); if (G.active === id) G.active = 'stock';
  const P = app()?.game?.progress; if (P) P.credits += v; save(); return { ok: true, msg: `💸 Dealer gives you ${v} cr for the ${rideName(r)} and doesn’t ask where the dents came from.` };
}

// ----- hub (☰ entry): anywhere -----
function openHub() {
  if (!C || !app()?.state?.onSurface) return toast('🚗 Land first. Red Line Motors is on Mars, by Ares Junction.');
  openSheet('hub', renderHub);
}
function renderHub() {
  const G = garage(), r = activeRide(), h = GC.colonyHour(Date.now(), G.clock), on = GC.isMeetHour(h), mins = GC.minsToMeet(Date.now(), G.clock);
  if (!here()) return head('🚗 Rides & meets', wallet()) + `<div class="blurb">Red Line Motors, your lock-ups and the night car meets are on <b>Mars</b>, at Ares Junction. Your ride: <b>${esc(rideName(r))}</b>.</div>`;
  const me = meOf(), S = spots(), dd = n => Math.round(dist(me, S[n]));
  return head('🚗 Rides & meets', wallet()) +
    `<div>Your ride: <b>${esc(rideName(r))}</b> · ${G.rides.length}/${GC.MAX_RIDES} in the garage · drags ${G.wins}/${G.races} won</div>${statBars(r.kind === 'rover' ? specOf(r) : specOf(r))}
    <div>🕘 Colony time <b>${GC.fmtHour(h)}</b> · ${on ? '<b style="color:#3cff8a">Car meet is ON</b> (till 03:00)' : `next meet at 21:00 (${Math.ceil(mins)} min)`}</div>
    <div class="row"><button data-nav="dealer">📍 Dealer · ${dd('dealer')} m</button><button data-nav="garage">📍 Garage · ${dd('garage')} m</button><button data-nav="meet">📍 Meet · ${dd('meet')} m</button></div>
    <div class="row">${dd('dealer') < 40 ? '<button data-open="dealer">🚗 Open dealer</button>' : ''}${dd('garage') < 40 ? '<button data-open="garage">🔧 Open garage</button>' : ''}${on ? '' : '<button data-wait="1">⏩ Kill time till dark</button>'}</div>`;
}
handlers.nav = n => { closeSheet(true); navTo(n); };
handlers.open = n => n === 'dealer' ? openDealer() : openGarage();
handlers.wait = () => { skipToMeet(); toast('⏩ You kill a few hours at the cantina. The neon’s on and the engines are warming up.', 3200); rerender(); };
export function skipToMeet() { const G = garage(), now = Date.now(), m = GC.minsToMeet(now, G.clock); if (m > 0) G.clock += m + 0.05; save(); }
function navTo(n) { if (!here()) return; const p = spots()[n]; nav = { x: p.x, z: p.z, n }; toast(`📍 ${n === 'dealer' ? CFG.name : n === 'garage' ? 'Your lock-ups' : 'The car meet lot'}: ${Math.round(dist(meOf(), p))} m. Follow the marker on the radar.`, 3000); }
const patched = new WeakSet();
function patchGame(game) {
  if (!game || patched.has(game)) return; patched.add(game);
  const orig = game.mapGate; game.mapGate = () => { const o = orig ? orig.call(game) : null; if (o) return o; return nav ? { x: nav.x, z: nav.z } : null; };
}

// ---------- the tick (window.SSX_TICKS, called by surface.js once per surface frame) ----------
export function dealerTick(dt, ctx) {
  C = ctx; last = performance.now();
  if (!root || !root.parent || planet !== ctx.name || (here() && !lot)) setupPlanet();
  ensureUI(); patchGame(ctx.game);
  syncRover(dt);
  if (!here()) { setCtx(null); return; }
  if (nav && dist(meOf(), nav) < 14) nav = null;
  // turntables + showroom camera
  const me = meOf(), S = spots();
  if (lot && dist(me, S.dealer) < 90) for (const p of lot.podiums) if (p.v) p.v.group.rotation.y += dt * 0.35;
  if (bay) bay.group.rotation.y += dt * 0.25;
  meet?.tick(dt, me);
  clearRocks(dt);
  if (sheet && sheetCam) { const t = sheetCam(); if (t) showroomCam(t, dt); }
  const nowMs = performance.now(); if (nowMs - ui.t > 200) { ui.t = nowMs; updateCtx(); } // real-time throttle (slow phones still update promptly)
}
// the terrain scatters instanced boulders everywhere; tuck the ones sitting on our lots / the strip out of sight (visual only)
const rockDone = new WeakSet(), rm = new THREE.Matrix4(), rp = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0); let rockT = 0;
function clearRocks(dt) {
  if ((rockT -= dt) > 0) return; rockT = 0.5; const S = spots(), cx = S.stripFrom.x, z0 = Math.min(S.stripFrom.z, S.stripTo.z) - 20, z1 = Math.max(S.stripFrom.z, S.stripTo.z) + 10;
  const zones = [[S.dealer, 22], [S.garage, 14], [S.meet, 27]];
  for (const g of C.scene.children) if (g.isGroup && g !== root) for (const o of g.children) {
    if (!o.isInstancedMesh || rockDone.has(o) || o.geometry?.type !== 'IcosahedronGeometry') continue; rockDone.add(o); let hit = false;
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, rm); rp.setFromMatrixPosition(rm); rp.applyMatrix4(o.matrixWorld);
      if (zones.some(([p, r]) => Math.hypot(rp.x - p.x, rp.z - p.z) < r) || (Math.abs(rp.x - cx) < 11 && rp.z > z0 && rp.z < z1)) { o.setMatrixAt(i, zero); hit = true; } }
    if (hit) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere(); }
  }
}
const tv = new THREE.Vector3(); let camA = 0;
function showroomCam(obj, dt) {
  // slow sweep across the front of the car (+z side of the lot, away from the signs / lock-up walls)
  obj.getWorldPosition(tv); camA += dt * 0.35; const cam = C.camera, land = innerWidth > innerHeight, R = land ? 10 : 11.5, a = CFG.yaw + 0.75 * Math.sin(camA);
  const y = Math.max(tv.y + 4.2, H(tv.x + Math.sin(a) * R, tv.z + Math.cos(a) * R) + 2);
  cam.position.set(tv.x + Math.sin(a) * R, y, tv.z + Math.cos(a) * R);
  // frame the car in the part of the screen the sheet leaves free (top in portrait, left in landscape)
  cam.lookAt(tv.x, tv.y + (land ? 1 : -2.2), tv.z);
  if (land) cam.rotateY(-0.22);
}
(window.SSX_TICKS ||= []).push(dealerTick);
// leaving the surface: hide our HUD
setInterval(() => { if (!last || performance.now() - last < 700 || app()?.state?.onSurface) return; if (ui) setCtx(null); closeSheet(true); }, 500);

// ---------- test/debug hooks ----------
window.__dealer = {
  get garage() { return garage(); }, get stock() { return dealerStock(); }, get spots() { return here() ? spots() : null; }, get sheet() { return sheet?.kind || null; },
  get brakeAssist() { return brakeAssist; }, get ctx() { return ui ? { label: ui.btn.textContent, shown: ui.btn.style.display === 'block' } : null; },
  get ride() { const rv = C?.rover; return rv ? { kind: rv.__dlrKind, spec: { ...rv.spec }, skin: !!rv.__dlr?.skin, stockHidden: rv.stockParts?.[0]?.visible === false } : null; },
  buy, upgrade, customise, setActive, sell, openDealer, openGarage, openHub, closeSheet, skipToMeet, navTo, specOf, rideById, cfg: () => ({ ...CFG }),
  tp(n, dz = 0) { const p = spots()[n]; app().surface.debugMove(p.x, p.z + dz, 0); }, get meet() { return meet?.debug || null; }
};
