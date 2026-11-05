// v7.5 add-on: Red Line Motors (rover dealership), your lock-up garages and night car meets on Mars.
// - Dealership: buy new rides with credits (garagecore.js MODELS + any registerVehicle kind with a `price`).
// - Showroom: selecting a car isolates it on the lot with Pit-style spot beams / floor pool / camera focus.
// - Partner buy-in: cash and/or stars → lot income, bigger garage, buy discount, early stock wave, better fence cut.
// - Showroom Dome: a cr + ⭐ upgrade puts the whole Red Line lot under its own glass dome (progress.garage.dome).
// - Fence: drive a stolen world car onto the lot and sell it for cr + ⭐ (heat cuts payout; 4+ ★ can bust).
// - Garage: store up to MAX_RIDES rides; paint, body kits, wheels, underglow and engine/handling/brakes/boost upgrades
//   that change the driving spec. The ride you pick becomes "your rover" (same thrusters, turret, Frankie, radio).
// - Car meets (carmeet.js): a timed night event with NPC cars, show-off rep and drag races run on race.js.
// - Save: lives in the game's own progress save (ssx.progress.v1 → progress.garage), migrated by garagecore.migrateGarage.
// Wiring (the only shared-code hooks): index.html imports DEALER_API and merges it into window.SSX; surface.js runs
// window.SSX_TICKS once per surface frame with the same ctx race.js gets. Everything else is set up lazily from here.
import * as THREE from 'three';
import { registerVehicle, buildVehicle, VEHICLES } from './world.js';
import { buildRover } from './models.js';
import { addMenuItem } from './racehooks.js';
import * as GC from './garagecore.js';
import { buildRide, decorate, shapeOf } from './rides.js';
import { createMeet } from './carmeet.js';
import { createMyRides } from './myrides.js';
import * as TC from './mars/shoptierscore.js';
import { grantStars } from './starmixcore.js';
import { STROBE, strobeColor, strobeOn } from './mars/pitshowcore.js'; // same light-show palette as the Pit

// ---------- registration: our models are ordinary vehicle kinds with a price (so they also show up for other mods) ----------
for (const [kind, m] of Object.entries(GC.MODELS)) registerVehicle(kind, { ...m }, () => buildRide(kind));
// v7.5.45 restock waves: WAR RIGS stay off the lot until you've owned every other Red Line model (save: ssx.shoptiers.v1)
const WAVE_KINDS = new Set(TC.DEALER_WAVES.flatMap(w => w.kinds || []));
const LOT_KINDS = Object.keys(GC.MODELS).filter(k => !WAVE_KINDS.has(k));
function applyWave() { const hid = new Set(TC.dealerHidden(TC.shared().dealer.wave)); for (const k of WAVE_KINDS) if (VEHICLES[k]) VEHICLES[k].hidden = hid.has(k); }
applyWave();
function noteBought(kinds, loud) {
  const D = TC.shared().dealer; let ch = false;
  for (const k of kinds) if (GC.MODELS[k] && !D.bought.includes(k)) { D.bought.push(k); ch = true; }
  const n = TC.dealerNext(D.wave, LOT_KINDS, D.bought);
  if (n !== D.wave) { D.wave = n; ch = true; applyWave(); if (loud !== false) toast(`🆕 New stock in! ${CFG.name} \u00b7 ${TC.DEALER_WAVES[n - 1].label} just rolled onto the lot.`, 5200); }
  if (ch) TC.save(TC.shared());
  return n;
}
const waveLine = () => { const D = TC.shared().dealer, W = TC.DEALER_WAVES; if (D.wave >= W.length) return `🆕 ${W[W.length - 1].label} on the lot \u00b7 fully stocked`;
  const have = LOT_KINDS.filter(k => D.bought.includes(k)).length; return `🔒 Next stock: ${W[D.wave].label}. Own every model on the lot once (${have}/${LOT_KINDS.length}).`; };
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
  if (G.rides.length >= GC.maxRidesOf(G)) return { ok: false, full: true, msg: '🔧 Garage full. Sell something first.' };
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
// SSX.garage.respray({ reason, price }): pay for a respray + new plate on the active ride, and lose the wanted heat if a wanted API is there
function respray({ reason = '', price } = {}) {
  const P = app()?.game?.progress; if (!P) return { ok: false, reason: 'no-game' };
  const r = GC.respray(garage(), 'current', { price, reason, credits: +P.credits || 0 });
  if (!r.ok) {
    if (r.reason === 'funds') toast(`🎨 A respray is ${r.price} cr. You’re ${r.need} cr short.`, 3000);
    return { ok: false, reason: r.reason, ...(r.reason === 'funds' ? { need: r.need, price: r.price } : {}) };
  }
  P.credits -= r.price;
  const w = C?.world || app()?.surface?.world; let heat = null;
  if (typeof w?.setWanted === 'function') { const from = +w.wanted || 0; if (from > 0) w.setWanted(0, 'resprayed: ' + (reason || 'new plate')); heat = { from, to: +w.wanted || 0 }; }
  save(); toast(`🎨 Fresh paint, new plate ${r.plate}.${heat?.from ? ' ColSec loses your description.' : ''}`, 3000);
  try { window.dispatchEvent(new CustomEvent('ssx:respray', { detail: { plate: r.plate, old: r.old, ride: r.ride, price: r.price, reason, heat } })); } catch (e) { }
  return { ok: true, plate: r.plate, price: r.price, ride: r.ride, heat };
}
export const GARAGE_API = { open: rideId => openGarageAnywhere(rideId), respray, get selected() { return sheet?.kind === 'garage' ? gSel : null; }, grantVehicle, grantUpgrade, grantPart, grant, get rides() { return garage().rides.map(r => ({ ...r })); }, get active() { return garage().active; }, get rep() { return garage().rep; },
  get partner() { return { ...partnerOf() }; }, buyPartner, collectPartner, fenceRide, get dome() { return { ...domeOf() }; }, buyDome, get maxRides() { return GC.maxRidesOf(garage()); },
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
const give = n => { const P = app()?.game?.progress; if (!P || !(n > 0)) return 0; P.credits = (P.credits | 0) + (n | 0); return n | 0; };
const starsApi = () => window.SSX?.stars;
const starsBal = () => { try { return starsApi()?.balance?.() | 0; } catch (e) { return 0; } };
const spendStars = (n, why) => { if (!(n > 0)) return true; try { return !!starsApi()?.spend?.(n, why)?.ok; } catch (e) { return false; } };
const partnerOf = () => garage().partner || (garage().partner = GC.freshPartner());
const marsHour = () => { const T = window.SSX?.time; try { if (T) { const h = typeof T.hour === 'function' ? T.hour() : typeof T.now === 'function' ? T.now() : null; if (Number.isFinite(h)) return ((h % 24) + 24) % 24; } } catch (e) { /* */ } return GC.colonyHour(Date.now(), garage().clock); };
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
  // v7.5.45 the lot grew west: 50 x 22 m apron, two rows of podiums (LOT box below), more floods, a WAR RIGS gantry
  lot.apron = put(a.box, a.mConc, LOT.w, 1.2, LOT.d, LOT.cx, -0.5, LOT.cz); d.add(lot.apron);
  for (let i = 0; i < 9; i++) d.add(put(a.box, a.mNeonC, 0.12, 0.03, 4, LOT.cx - LOT.w / 2 + 3 + i * (LOT.w - 6) / 8, 0.12, LOT.rowB + 4.4)); // bay lines
  d.add(put(a.box, a.mNeonR, 0.08, 0.08, LOT.d - 0.2, LOT.cx - LOT.w / 2 + 0.05, 0.14, LOT.cz));
  for (const s of [-1, 1]) d.add(put(a.box, a.mSteel, 0.4, 7, 0.4, s * 7.5, 3.5, -7.5));
  d.add(put(a.box, a.mDark, 15.4, 0.6, 0.5, 0, 7, -7.5));
  const sign = signMesh(CFG.name, 0xff2a4a, 14, 2.4); sign.position.set(0, 8.6, -7.5); d.add(sign);
  const sub = signMesh('NEW RIDES · TRADE-INS · NO QUESTIONS', 0x38e1ff, 12, 0.9); sub.position.set(0, 6.2, -7.45); d.add(sub);
  d.add(put(a.box, a.mNeonR, LOT.w - 0.2, 0.08, 0.08, LOT.cx, 0.14, LOT.cz + LOT.d / 2 - 0.05));
  for (const fx of [-36, -12, 12]) for (const fz of [-6, LOT.cz + LOT.d / 2 - 0.6]) { d.add(put(a.box, a.mSteel, 0.25, 6, 0.25, fx, 3, fz)); d.add(put(a.box, a.mFlood, 0.9, 0.3, 0.5, fx, 6, fz - 0.4)); }
  for (const px of [-28, -12, 4]) for (const pz of [LOT.rowA + 2.5, LOT.rowB + 2.5]) d.add(put(a.disc, a.mPool, 5.5, 1, 5.5, px, 0.13, pz));
  // WAR RIGS gantry at the west end: sealed until the wave rolls in
  for (const s of [-1, 1]) d.add(put(a.box, a.mSteel, 0.4, 5.5, 0.4, -28 + s * 6, 2.75, -7.5));
  d.add(put(a.box, a.mDark, 12.4, 0.5, 0.5, -28, 5.5, -7.5));
  lot.waveSigns = [signMesh('MORE RIGS INBOUND', 0x888888, 11, 1.4), signMesh('🆕 WAR RIGS \u00b7 NEW STOCK', 0xffb020, 11, 1.4)];
  for (const sg of lot.waveSigns) { sg.position.set(-28, 6.7, -7.5); d.add(sg); }
  lot.podG = new THREE.Group(); d.add(lot.podG); rebuildPodiums();
  applyDome(); // Showroom Dome upgrade (no-op on a roadside lot)
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
// the lot in dealer-local metres (yaw-rotated with the group): centre, size, the two podium rows
const LOT = { cx: -12, cz: 2, w: 50, d: 22, rowA: -1, rowB: 7.5, span: 46 }; // kept on the colony's flattened ground (it drops off south of z +13, rises east of x +6)
function lotLocal(p) {
  const S = spots(), dx = p.x - S.dealer.x, dz = p.z - S.dealer.z, c = Math.cos(CFG.yaw), s = Math.sin(CFG.yaw);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}
// the concrete apron. Half-depth is only 13 m; the glass dome is 20 m, so a stop under the glass can miss this box.
const onApron = (p, pad = 2) => { const { lx, lz } = lotLocal(p); return Math.abs(lx - LOT.cx) < LOT.w / 2 + pad && Math.abs(lz - LOT.cz) < LOT.d / 2 + pad; };
// v7.5.66: once the dome is up, the lot is the glass floor (ellipse), not the smaller apron inside it.
const onDomeFloor = (p, pad = 0) => {
  if (!domeOn()) return false;
  const { lx, lz } = lotLocal(p), a = (lx - LOT.cx) / (GC.DOME.rx + pad), b = (lz - LOT.cz) / (GC.DOME.rz + pad);
  return a * a + b * b <= 1;
};
const onLot = (p, pad = 2) => onApron(p, pad) || onDomeFloor(p, Math.max(0, pad - 2));
let fenceHot = false;
function rebuildPodiums() {
  if (!lot) return; const stock = dealerStock().slice(0, isMobile ? 8 : 12), key = stock.map(s => s.kind).join(',');
  if (lot.waveSigns) { const full = TC.shared().dealer.wave >= TC.DEALER_WAVES.length; lot.waveSigns[0].visible = !full; lot.waveSigns[1].visible = full; }
  if (key === lot.stockKey) return; lot.stockKey = key;
  // detach showroom FX first so disposeRoot doesn't kill the shared beam/pool materials
  if (showFX?.G?.parent) showFX.G.parent.remove(showFX.G);
  for (const p of lot.podiums) { lot.podG.remove(p.g); disposeRoot(p.g); } lot.podiums = [];
  const a = assets(), per = Math.max(1, Math.ceil(stock.length / 2)), gap = Math.min(7.2, LOT.span / per);
  stock.forEach((s, i) => {
    const row = i < per ? 0 : 1, k = row ? i - per : i, n = row ? stock.length - per : per;
    const pg = new THREE.Group(); pg.position.set(LOT.cx + (k - (n - 1) / 2) * gap, 0, row ? LOT.rowB : LOT.rowA); lot.podG.add(pg);
    pg.add(put(a.cyl, a.mDark, 2.9, 0.35, 2.9, 0, 0.17, 0)); pg.add(put(a.cyl, a.mNeonC, 2.95, 0.05, 2.95, 0, 0.35, 0));
    let v = null; try { v = buildVehicle(s.kind); } catch (e) { v = null; }
    if (v) { const sc = Math.min(1, (gap - 0.4) / 6.2); v.group.scale.setScalar(Math.max(0.55, sc)); v.group.position.y = 0.38; v.group.rotation.y = 0.6; decorate(v, GC.newRide('show', s.kind), { wheelScale: false }); pg.add(v.group); }
    const tag = signMesh(`${WAVE_KINDS.has(s.kind) ? '🆕 ' : ''}${s.name} · ${s.price} cr`, WAVE_KINDS.has(s.kind) ? 0xffb020 : s.rep > 0 ? 0xffd25a : 0x3cff8a, 5, 0.6); tag.position.set(0, 0.4, 2.2); tag.rotation.x = -0.9; tag.scale.setScalar(Math.min(1, gap / 5.6)); pg.add(tag);
    lot.podiums.push({ g: pg, v, kind: s.kind });
  });
  applyDealerFocus();
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
#dlrSheet .chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px;-webkit-overflow-scrolling:touch}#dlrSheet .dchips button{padding:6px 9px;font-size:.78rem}
#dlrSheet button{min-height:44px;border-radius:12px;font-weight:800;color:#fff;background:#000;border:1px solid rgba(255,255,255,.55);padding:0 12px;font-size:.8rem;touch-action:manipulation;flex:none}
#dlrSheet button.on{border-color:#38e1ff;box-shadow:inset 0 0 0 2px #38e1ff}#dlrSheet button.go{background:#000;border-color:#ff5a7a;box-shadow:inset 0 0 0 2px #ff2a4a;flex:1}
#dlrSheet button:disabled{opacity:.45}#dlrSheet .row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}#dlrSheet .close{position:sticky;top:0;float:right;z-index:2}
#dlrSheet .opt{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:6px 0}#dlrSheet .opt button{text-align:left;padding:4px 10px;line-height:1.15}#dlrSheet .opt small{display:block;font-weight:600;opacity:.75}
#dlrSheet .bars{display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;align-items:center;font-size:.74rem;margin:6px 0}#dlrSheet .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;position:relative}
#dlrSheet .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#38e1ff,#ff2a7a)}#dlrSheet .bar b{position:absolute;top:0;bottom:0;background:#ffd25a;opacity:.85}
#dlrSheet .blurb{opacity:.8;font-size:.78rem;margin:4px 0}#dlrSheet .warn{color:#ffb020}#dlrSheet .tabs{display:flex;gap:4px;overflow-x:auto;margin:6px 0}#dlrSheet .tabs button{min-height:40px;padding:0 10px}
body.dlr-open #surfBtns, body.dlr-open #stackR{visibility:hidden}
/* phone preview: leave more of the screen for the showroom car */
#dlrSheet[data-kind=dealer]{max-height:46vh}
@media (orientation:landscape){#dlrSheet[data-kind=dealer]{max-height:none}}
body.ssx-drag #raceAgain{display:none}
`;
function ensureUI() {
  if (ui && document.getElementById('dlrCtxBtn')) return ui;
  // v7.5.60 (fence #1): the button can be unmounted (no #surfBtns yet at boot / HUD rebuilt). Re-mount the SAME button
  // instead of rebuilding ui: rebuilding wiped ui.act/ui.fence for a tick, so E fell through to doInteract and exited.
  if (ui) { mountBtn(ui.btn); return ui; }
  const st = document.createElement('style'); st.id = 'dlrCss'; st.textContent = CSS + 'body:not(.touch) #dlrCtxBtn.fenceE::after{content:none!important}'; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'dlrCtxBtn'; btn.className = 'glass'; mountBtn(btn);
  pointerTap(btn, () => ui.act?.());
  const menu = addMenuItem(app(), { id: 'rmRides', label: '🚗 Rides & meets', onTap: () => openHub() });
  document.addEventListener('click', e => { if (performance.now() < ghostUntil && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); ghostUntil = 0; } }, true);
  window.addEventListener('keydown', e => { if (!sheet) return; e.stopImmediatePropagation(); if (e.code === 'Escape') closeSheet(); }, true);
  // v7.5.56 (m1): E fences a stolen ride on the lot on desktop too (the button can be hidden there); same capture pattern as myrides' E
  // v7.5.65: decide from the stolen + on-lot latch, not from the button being visible this frame (it blips off on the dome edge)
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyE' || e.repeat || sheet || window.__dealerNoCapture || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
    if (!wantFence()) return; e.preventDefault(); e.stopImmediatePropagation(); window.__dealer.lastKey = 'capture';
    if (!ui?.fence || !ui.act) setCtx('💸 Fence ride', doFence); ui.act?.();
  }, true);
  ui = { btn, menu, act: null, label: '', t: 0 };
  return ui;
}
let ghostUntil = 0;
function pointerTap(el, fn) {
  let id = null, t = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; id = e.pointerId; });
  el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' || e.pointerId !== id) return; e.preventDefault(); id = null; t = performance.now(); ghostUntil = t + 2500; fn(e); });
  el.addEventListener('pointercancel', () => { id = null; });
  el.addEventListener('click', e => { if (performance.now() - t < 5000) return; fn(e); }); // a slow phone can deliver the compat click late
}
function mountBtn(btn) { if (btn.isConnected && btn.parentElement?.id === 'surfBtns') return; const col = document.getElementById('surfBtns'); if (col) col.prepend(btn); }
function setCtx(label, act) {
  if (!ui) return; ui.act = act;
  ui.fence = !!label && label.startsWith('💸');
  if (!label) { if (ui.btn.style.display !== 'none') ui.btn.style.display = 'none'; return; }
  mountBtn(ui.btn); // v7.5.60: shown and on screen in the same tick
  const shown = ui.fence && !document.body.classList.contains('touch') ? label.replace(/\s*\((Enter|E)\)$/, '') + ' (E)' : label; // v7.5.60 (#2): desktop: the key that fences is E
  ui.btn.classList.toggle('fenceE', shown !== label);
  if (ui.btn.textContent !== shown) ui.btn.textContent = shown; if (ui.btn.style.display !== 'block') ui.btn.style.display = 'block';
}
function stolenCar() { const car = C?.car, rv = C?.rover; return car && rv && car !== rv ? car : null; }
function fenceBlocked() { return !!(sheet || !here() || !C || C.game.isDown() || window.__race?.state || app()?.surface?.info?.inside); }
// Arms on the apron, or on the glass floor once the dome is built. Stays armed a few metres past that edge
// so a hover-bike brake slide doesn't drop it. Never having entered that footprint leaves it disarmed.
function wantFence() {
  if (fenceBlocked()) return false;
  if (!stolenCar()) { fenceHot = false; return false; }
  const me = meOf();
  if (onLot(me)) { fenceHot = true; return true; }
  if (fenceHot && onLot(me, 8)) return true;
  fenceHot = false; return false;
}
function doFence() { const r = fenceRide(); toast(r.msg, 3200); }
function updateCtx() {
  if (fenceBlocked()) return setCtx(null);
  const me = meOf(), S = spots();
  // fence a stolen world ride on the lot (priority over open-dealer while you're still in it)
  if (wantFence()) return setCtx('💸 Fence ride', doFence);
  const mr = MR.ctxAction(); if (mr) return setCtx(mr.label, mr.act);
  const m = meet?.ctxAction(me); if (m) return setCtx(m.label, m.act);
  if (dist(me, S.garage) < 11) return setCtx('🔧 Garage', () => openGarage());
  if (onLot(me)) return setCtx(domeOn() ? '🚗 Dealer · Dome' : '🚗 Dealer', () => openDealer());
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
  el.addEventListener('pointerup', e => { if (!down || e.pointerId !== down.id) return; const b = e.target.closest('button'); const ok = b === down.b && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12; down = null; if (!ok || b.disabled) return; e.preventDefault(); t = performance.now(); ghostUntil = t + 2500; onSheetTap(b); });
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('click', e => { if (performance.now() - t < 700) return; const b = e.target.closest('button'); if (b && !b.disabled) onSheetTap(b); });
  rerender(); return el;
}
function rerender() { if (!sheet) return; const top = sheet.el.scrollTop, cl = sheet.el.querySelector('.dchips')?.scrollLeft || 0; sheet.el.innerHTML = sheet.render(); sheet.el.scrollTop = top; const ch = sheet.el.querySelector('.dchips'); if (ch) ch.scrollLeft = cl; }
export function closeSheet(quiet) { if (!sheet) return; sheet.el.remove(); sheet = null; sheetCam = null; document.body.classList.remove('dlr-open', 'dlr-dealer'); if (!quiet) meet?.onSheetClosed?.(); clearBay(); applyDealerFocus(); }
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
const wallet = () => { const G = garage(), p = partnerOf(), pend = p.on ? Math.floor(p.pending) : 0;
  return `💰 ${credits()} cr · ⭐ ${starsBal()} · rep ${Math.round(G.rep)} (${GC.repTitle(G.rep)})${p.on ? ` · 🤝 partner${pend ? ` · 💵 ${pend}` : ''}` : ''}`; };

// ----- dealer -----
let dSel = null;
function openDealer() {
  if (!here()) return toast('🚗 Red Line Motors is on Mars, by Ares Junction.');
  noteBought(garage().rides.map(r => r.kind)); rebuildPodiums(); const st = dealerStock(); if (!dSel || !st.some(s => s.kind === dSel)) dSel = st[0]?.kind;
  camA = 0;
  openSheet('dealer', renderDealer, () => { const p = lot.podiums.find(p => p.kind === dSel) || lot.podiums[0]; return p ? p.g : null; });
  applyDealerFocus();
}
function renderDealer() {
  const st = dealerStock(), s = st.find(x => x.kind === dSel) || st[0], G = garage(), P = partnerOf(); if (!s) return head('🚗 ' + esc(CFG.name), 'Nothing on the lot today.');
  const maxR = GC.maxRidesOf(G), price = GC.partnerSellPrice(s, G.rep, P.on), full = G.rides.length >= maxR, owned = G.rides.filter(r => r.kind === s.kind).length;
  const spec = specOf(GC.newRide('x', s.kind));
  const why = G.rep < s.rep ? `Needs ${s.rep} rep. Make a name at the car meets first.` : full ? `Garage full (${maxR}). Sell a ride first.` : credits() < price ? `You’re ${price - credits()} cr short.` : '';
  // partner sits below the car chips so the showroom preview (and Pit-style lights) stay visible on a phone
  const partnerBlock = P.on
    ? `<div class="blurb">🤝 <b>Partner</b> · lot cut ~${Math.round(GC.PARTNER.rate)} cr/h · garage ${maxR} · ${GC.PARTNER.buyDiscount * 100 | 0}% off buys · better fence${Math.floor(P.pending) > 0 ? ` · <b>💵 ${Math.floor(P.pending)} waiting</b>` : ''}</div>
      <div class="row">${Math.floor(P.pending) > 0 ? `<button class="go" data-pcollect="1">💵 Collect · ${Math.floor(P.pending)} cr</button>` : ''}</div>`
    : `<div class="blurb">🤝 Buy in as a partner: bigger garage (+${GC.PARTNER.maxRidesBonus}), ${GC.PARTNER.buyDiscount * 100 | 0}% off stock, early WAR RIGS, lot income (~${Math.round(GC.PARTNER.rate)} cr/h), and a better cut when you fence stolen rides.</div>
      <div class="row">${GC.partnerOffers().map(o => {
        const crOk = !o.cr || credits() >= o.cr, stOk = !o.stars || starsBal() >= o.stars, ok = crOk && stOk;
        return `<button data-partner="${o.id}" ${ok ? '' : 'disabled'}>🤝 ${esc(o.label)}</button>`;
      }).join('')}</div>`;
  return head(`🚗 ${esc(CFG.name)}${domeOn() ? ' · Dome' : ''}`, wallet()) +
    `<div class="chips dchips">${st.map(x => `<button data-dsel="${esc(x.kind)}" class="${x.kind === s.kind ? 'on' : ''}">${x.icon} ${esc(x.name)}${G.rep < x.rep ? ' 🔒' : ''}</button>`).join('')}</div>
    <b>${s.icon} ${esc(s.name)}</b> · Class ${'★'.repeat(s.tier)} · ${price < s.price ? `<s>${s.price}</s> ` : ''}<b>${price} cr</b>${P.on && price < s.price ? ' · partner' : ''}${owned ? ` · you own ${owned}` : ''}${s.modded ? ' · <i>custom build</i>' : ''}
    ${why ? `<div class="warn">${esc(why)}</div>` : ''}
    <div class="row"><button class="go" data-buy="${esc(s.kind)}" ${why ? 'disabled' : ''}>💳 Buy · ${price} cr</button><button data-togarage="1">🔧 Garage</button></div>
    <div class="blurb">${esc(s.blurb)}</div>${statBars(spec)}
    ${partnerBlock}
    ${domeBlock()}
    <div class="blurb">${esc(waveLine())}</div>
    <div class="sub">💸 Steal a world car and drive it onto this lot to fence it for cash. Heat cuts the payout.</div>`;
}
handlers.dsel = k => { dSel = k; camA = 0; applyDealerFocus(); rerender(); };
handlers.buy = k => { const r = buy(k); toast(r.msg, 3200); if (r.ok) closeSheet(); else rerender(); };
handlers.partner = id => { const r = buyPartner(id); toast(r.msg, 3600); rerender(); };
handlers.dome = (id, b) => { if (!b.dataset.armed) { for (const x of sheet.el.querySelectorAll('[data-dome]')) delete x.dataset.armed; b.dataset.armed = '1'; b.textContent = `Sure? Tap again · ${b.dataset.lbl}`; return; } const r = buyDome(id); toast(r.msg, 4200); rerender(); };
handlers.pcollect = () => { const r = collectPartner(); toast(r.msg, 2800); rerender(); };
handlers.togarage = () => { closeSheet(true); const m = meOf(), S = spots(); if (dist(m, S.garage) < 40) openGarage(); else navTo('garage'); };
export function buy(kind) {
  const s = dealerStock().find(x => x.kind === kind), G = garage(), P = partnerOf(); if (!s) return { ok: false, msg: 'Not on the lot.' };
  const price = GC.partnerSellPrice(s, G.rep, P.on), maxR = GC.maxRidesOf(G);
  if (G.rep < s.rep) return { ok: false, msg: `🔒 ${s.name}: the dealer wants ${s.rep} rep before he’ll even let you sit in it.` };
  if (G.rides.length >= maxR) return { ok: false, msg: '🔧 Garage full. Sell something first.' };
  if (!spend(price)) return { ok: false, msg: `💸 ${s.name} is ${price} cr. You’re short, pal.` };
  const r = GC.newRide('r' + G.nextId++, kind); r.spent = 0; MR.parkOutgoing(); G.rides.push(r); G.active = r.id; save(); // live fix: the old ride stays parked where it is
  parkActiveAt('dealer'); noteBought([kind]); rebuildPodiums();
  return { ok: true, id: r.id, msg: `🔑 ${s.name} is yours. Parked out front, keys in it. Customise it at the lock-ups next door.` };
}
export function buyPartner(offerId = 'cash') {
  const G = garage(), P = partnerOf(); if (P.on) return { ok: false, msg: '🤝 You’re already a partner at Red Line.' };
  const offer = GC.partnerOffers().find(o => o.id === offerId) || GC.partnerOffers()[0];
  if (offer.cr && credits() < offer.cr) return { ok: false, msg: `💸 Need ${offer.cr} cr to buy in.` };
  if (offer.stars && starsBal() < offer.stars) return { ok: false, msg: `⭐ Need ${offer.stars} stars to buy in.` };
  if (offer.cr && !spend(offer.cr)) return { ok: false, msg: 'Payment failed.' };
  if (offer.stars && !spendStars(offer.stars, 'Red Line partner')) { if (offer.cr) give(offer.cr); return { ok: false, msg: '⭐ Stars payment failed.' }; }
  P.on = true; P.pending = 0; P.lastHour = marsHour(); save();
  // partner perk: unlock the next stock wave early (WAR RIGS) without owning every model
  const D = TC.shared().dealer; if (D.wave < TC.DEALER_WAVES.length) { D.wave = Math.min(TC.DEALER_WAVES.length, D.wave + 1); TC.save(TC.shared()); applyWave(); rebuildPodiums(); }
  return { ok: true, msg: `🤝 You’re a partner at ${CFG.name}. Bigger garage, partner prices, lot cut, and better fence money. Drive stolen rides onto the lot to fence them.` };
}
// ----- Showroom Dome upgrade: the lot moves off the roadside into its own glass dome -----
const domeOf = () => garage().dome || (garage().dome = GC.freshDome());
export const domeOn = () => !!(app()?.game?.progress && domeOf().on);
function domeBlock() {
  if (domeOn()) return `<div class="blurb">🏟️ <b>Showroom Dome</b> · your lot is under glass${partnerOf().on ? ` · +${GC.DOME.lotCutBonus * 100 | 0}% lot cut` : ''}</div>`;
  return `<div class="blurb">🏟️ <b>Move into the Dome</b>: get Red Line off the roadside. A glass showroom dome over the whole lot, floor, lights and all.${partnerOf().on ? ` +${GC.DOME.lotCutBonus * 100 | 0}% partner lot cut.` : ` Partners also get +${GC.DOME.lotCutBonus * 100 | 0}% lot cut.`}</div>
    <div class="row">${GC.domeOffers().map(o => { const ok = credits() >= o.cr && starsBal() >= o.stars;
      return `<button data-dome="${o.id}" data-lbl="${esc(o.label)}" ${ok ? '' : 'disabled'}>🏟️ ${esc(o.label)}</button>`; }).join('')}</div>`;
}
export function buyDome(offerId = 'cr') {
  const G = garage(), chk = GC.domeCheck(G, offerId, { cr: credits(), stars: starsBal() });
  if (!chk.ok) {
    if (chk.why === 'owned') return { ok: false, msg: '🏟️ Red Line is already under the dome.' };
    if (chk.why === 'offer') return { ok: false, msg: 'No such deal.' };
    return { ok: false, msg: `🏟️ The dome is ${chk.offer.label}. Short ${[chk.shortCr ? chk.shortCr + ' cr' : '', chk.shortStars ? chk.shortStars + ' ⭐' : ''].filter(Boolean).join(' + ')}.` };
  }
  const o = chk.offer;
  if (!spend(o.cr)) return { ok: false, msg: 'Payment failed.' };
  if (!spendStars(o.stars, 'Red Line showroom dome')) { give(o.cr); return { ok: false, msg: '⭐ Stars payment failed. Credits refunded.' }; }
  const D = domeOf(); D.on = true; D.at = Date.now(); save();
  applyDome(); rockDone = new WeakSet(); rockT = 0; // re-tuck boulders under the bigger footprint
  try { window.dispatchEvent(new CustomEvent('ssx:dealerdome', { detail: { offer: o.id, cr: o.cr, stars: o.stars } })); } catch (e) { }
  return { ok: true, msg: `🏟️ ${CFG.name} moved into the Showroom Dome. Same lot, same deals — now under glass.` };
}
// the dome itself: a NEW half-ellipsoid of glass over the Red Line lot (dealer-local, centred on the lot). Built lazily, shown only when owned.
function buildDome() {
  const a = assets(), { rx, ry, rz } = GC.DOME, g = new THREE.Group(); g.name = 'dealer-dome'; g.position.set(LOT.cx, 0, LOT.cz);
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x1d4a66, emissiveIntensity: 0.6, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass); shell.scale.set(rx, ry, rz); shell.name = 'dealer-dome-glass'; shell.renderOrder = 2; g.add(shell);
  // polished floor slab (its sides skirt the ground where it drops off south of the lot)
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48), new THREE.MeshStandardMaterial({ color: 0x17181f, roughness: 0.22, metalness: 0.55 }));
  floor.scale.set(rx, 4.2, rz); floor.position.y = 0.11 - 2.1; floor.name = 'dealer-dome-floor'; g.add(floor);
  // ribs: meridian arches + latitude rings, sized in ellipsoid space so the steel stays round
  const ell = (th, ph) => new THREE.Vector3(rx * Math.cos(ph) * Math.cos(th), ry * Math.sin(ph), rz * Math.cos(ph) * Math.sin(th));
  const steel = a.mSteel, tube = (pts, r, closed, m) => { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), closed ? 64 : 28, r, 5, closed), m); g.add(t); return t; };
  for (let k = 0; k < 4; k++) { const th = k * Math.PI / 4, pts = []; for (let i = 0; i <= 24; i++) { const ph = i / 24 * Math.PI; pts.push(ph <= Math.PI / 2 ? ell(th, ph) : ell(th + Math.PI, Math.PI - ph)); } tube(pts, 0.22, false, steel); }
  const lat = (ph, r, m, name) => { const pts = []; for (let i = 0; i < 48; i++) pts.push(ell(i / 48 * Math.PI * 2, ph)); const t = tube(pts, r, true, m); if (name) t.name = name; return t; };
  lat(0.02, 0.35, steel); lat(0.05, 0.12, a.mNeonR, 'dealer-dome-neon'); lat(0.55, 0.16, steel); lat(1.05, 0.14, a.mNeonC, 'dealer-dome-halo');
  // front portal (+z, where you drive in) with its own sign
  const pz = rz - 1.2;
  for (const s of [-1, 1]) g.add(put(a.box, steel, 0.6, 6.4, 0.6, s * 6, 3.2, pz));
  g.add(put(a.box, a.mDark, 12.6, 0.8, 0.8, 0, 6.4, pz));
  g.add(put(a.box, a.mNeonR, 12.6, 0.1, 0.1, 0, 5.95, pz + 0.42));
  const sg = signMesh('SHOWROOM DOME', 0x38e1ff, 11, 1.5); sg.position.set(0, 7.7, pz + 0.1); g.add(sg);
  // hanging showroom spots (unlit additive pools on the floor, no real lights)
  for (const [x, z] of [[-22, -6], [-22, 8], [0, -6], [0, 8], [20, 0]]) g.add(put(a.disc, a.mPool, 6.5, 1, 6.5, x, 0.125, z));
  // scenery only: the floor slab and the glass must not answer raycasts (ground probes, camera picks)
  g.traverse(o => { if (o.raycast) o.raycast = () => {}; });
  return g;
}
function applyDome() {
  if (!lot?.dealer) return; const on = domeOn();
  if (on && !lot.dome) { lot.dome = buildDome(); lot.dealer.add(lot.dome); }
  if (lot.dome) lot.dome.visible = on;
  if (lot.apron) lot.apron.visible = !on; // the dome brings its own polished floor
  syncRockClear();
}
// boulders inside the dome are tucked visually (clearRocks). Drop their collision too, or the glass hides a wall.
let rockClearKey = '';
function syncRockClear() {
  const on = domeOn() && here();
  if (!on) { if (globalThis.SSX_ROCK_CLEAR) { globalThis.SSX_ROCK_CLEAR = null; rockClearKey = ''; } return; }
  const S = spots(), x = S.dealer.x + LOT.cx, z = S.dealer.z + LOT.cz, R = GC.DOME.rx + 1, key = x.toFixed(1) + ',' + z.toFixed(1);
  if (rockClearKey === key && globalThis.SSX_ROCK_CLEAR) return; rockClearKey = key;
  const R2 = R * R;
  globalThis.SSX_ROCK_CLEAR = (px, pz) => { const dx = px - x, dz = pz - z; return dx * dx + dz * dz < R2; };
}
export function collectPartner() {
  const P = partnerOf(); if (!P.on) return { ok: false, msg: 'Not a partner.' };
  const n = GC.partnerCollect(P); if (!n) return { ok: false, msg: 'Till is empty.' };
  give(n); const stars = grantStars(app()?.game || app()?.surface?.game, Math.floor(n / 10)); save();
  return { ok: true, amount: n, stars, msg: `💵 +${n} cr${stars ? ` · +${stars} ⭐` : ''} from your cut of the lot.` };
}
export function fenceRide() {
  const car = stolenCar(); if (!car) return { ok: false, msg: 'Bring a stolen ride onto the lot.' };
  if (!wantFence()) return { ok: false, msg: 'Fence it on the Red Line lot.' };
  const wanted = C?.world?.wanted | 0, P = partnerOf();
  const listing = dealerStock().find(x => x.kind === car.kind) || GC.MODELS[car.kind] || null;
  const price = listing?.price ?? car.spec?.price ?? null;
  const offer = GC.fenceOffer(car.kind, { price, wanted, partner: P.on });
  // scrap the stolen ride (never the stock rover)
  let gone = false; try { gone = !!(app()?.surface?.chopVehicle?.()); } catch (e) { gone = false; }
  if (!gone) { try { gone = !!(C?.world?.despawnVehicle?.(car)); } catch (e) { gone = false; } }
  if (!gone) return { ok: false, msg: 'The lot boys couldn’t take it. Try again.' };
  if (offer.bust) {
    try { C.world?.crime?.(Math.max(1, offer.heatAdd || 1), 'fenced a hot ride in front of ColSec'); } catch (e) { /* */ }
    save(); return { ok: false, bust: true, msg: '🚨 ColSec was watching the lot. No payout — stars went up.' };
  }
  give(offer.cr); const stars = grantStars(app()?.game || app()?.surface?.game, offer.stars);
  const G = garage(); G.fenced = (G.fenced | 0) + 1; if (P.on) P.fenced = (P.fenced | 0) + 1; save();
  return { ok: true, amount: offer.cr, stars, kind: car.kind, msg: `💸 Fenced the ${car.spec?.name || car.kind} for ${offer.cr} cr${stars ? ` · +${stars} ⭐` : ''}${wanted ? ' (hot — payout cut)' : ''}${P.on ? ' · partner cut' : ''}.` };
}
// put your (newly selected) ride at a spot, facing out
function parkActiveAt(where) {
  const rv = C?.rover; if (!rv || !here()) return; if (C.car && C.car !== rv) return;
  const S = spots(), p = where === 'garage' ? S.garage : S.dealer, z = p.z + (where === 'garage' ? 9 : 12), x = p.x + (where === 'garage' ? 0 : -12);
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
// SSX.garage.open(rideId?): the garage sheet from anywhere (Ben's base garage Customize button). No lock-up range check, no navTo.
// The showroom camera and 3D bay only join in when you're actually at the lock-ups; elsewhere it's just the sheet.
function openGarageAnywhere(rideId) {
  const G = garage(), id = rideId === 'current' ? G.active : rideId;
  if (id != null && rideById(id)) gSel = id; else if (!gSel || !rideById(gSel)) gSel = G.active;
  gPrev = null; const atLot = here() && !!lot && dist(meOf(), spots().garage) < 40;
  openSheet('garage', renderGarage, atLot ? () => lot.bay : null); if (atLot) showBay();
  return !!sheet && sheet.kind === 'garage';
}
function clearBay() { if (bay) { bay.group.parent?.remove(bay.group); disposeRoot(bay.group); bay = null; } }
function showBay() {
  const r = rideById(gSel); if (!r || !lot) return;
  if (bay && bay.kind !== r.kind) clearBay();
  if (!bay) { let v = null; try { v = r.kind === 'rover' ? buildRover() : buildVehicle(r.kind); } catch (e) { v = null; } if (!v) return; bay = { ...v, kind: r.kind }; v.group.rotation.y = 0.7; lot.bay.add(v.group); }
  decorate(bay, r, r.kind === 'rover' ? { paint: false, dims: { w: 3.0, len: 6.2, y: 1.8, roof: 2.8, tail: 3.05, nose: -3.2 } } : {});
}
const TABS = [['perf', '⚙️ Performance'], ['paint', '🎨 Paint'], ['kit', '🧱 Body'], ['wheels', '🛞 Wheels'], ['glow', '💡 Underglow'], ['rides', '🅿️ My rides']];
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
  } else if (gTab === 'rides') body = MR.listHTML(); // live fix: every ride you own, where it is, Deliver / Show on map
  else {
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
  if (garage().active !== id) MR.parkOutgoing(); delete r.park; garage().active = id; save(); parkActiveAt('garage'); MR.sync(); return { ok: true, msg: `🔑 ${rideName(r)} rolled out of the lock-up. It’s your ride now.` };
}
export function sell(id) {
  const G = garage(), r = rideById(id); if (!r || id === 'stock') return { ok: false, msg: 'You can’t sell the colony’s rover.' };
  const v = GC.tradeIn(r, listingOf(r.kind)); G.rides = G.rides.filter(x => x.id !== id); if (G.active === id) { G.active = 'stock'; delete rideById('stock')?.park; } // the rover object becomes the stock rover right where it is
  const P = app()?.game?.progress; if (P) P.credits += v; save(); return { ok: true, msg: `💸 Dealer gives you ${v} cr for the ${rideName(r)} and doesn’t ask where the dents came from.` };
}

// ----- hub (☰ entry): anywhere -----
function openHub() {
  if (!C || !app()?.state?.onSurface) return toast('🚗 Land first. Red Line Motors is on Mars, by Ares Junction.');
  openSheet('hub', renderHub);
}
function renderHub() {
  const G = garage(), r = activeRide(), h = GC.colonyHour(Date.now(), G.clock), mins = GC.minsToMeet(Date.now(), G.clock), shared = typeof window.SSX?.time?.isNight === 'function';
  const on = meet?.debug ? meet.debug.on : GC.isMeetHour(h); // follows SSX.time.isNight() when Steve's day/night cycle is in
  const mine = `<div class="row"><button data-myrides="1">🅿️ My rides · ${G.rides.length}</button></div>`;
  if (!here()) return head('🚗 Rides & meets', wallet()) + `<div class="blurb">Red Line Motors, your lock-ups and the night car meets are on <b>Mars</b>, at Ares Junction. Your ride: <b>${esc(rideName(r))}</b>.</div>` + mine;
  const me = meOf(), S = spots(), dd = n => Math.round(dist(me, S[n]));
  return head('🚗 Rides & meets', wallet()) +
    `<div>Your ride: <b>${esc(rideName(r))}</b> · ${G.rides.length}/${GC.maxRidesOf(G)} in the garage · drags ${G.wins}/${G.races} won</div>${statBars(r.kind === 'rover' ? specOf(r) : specOf(r))}
    <div>${shared ? (on ? '🌙 <b style="color:#3cff8a">Car meet is ON</b> (till dawn)' : '☀️ Car meets start at nightfall') : `🕘 Colony time <b>${GC.fmtHour(h)}</b> · ${on ? '<b style="color:#3cff8a">Car meet is ON</b> (till 03:00)' : `next meet at 21:00 (${Math.ceil(mins)} min)`}`}</div>
    <div class="row"><button data-nav="dealer">📍 Dealer · ${dd('dealer')} m</button><button data-nav="garage">📍 Garage · ${dd('garage')} m</button><button data-nav="meet">📍 Meet · ${dd('meet')} m</button></div>
    <div class="row">${dd('dealer') < 40 ? '<button data-open="dealer">🚗 Open dealer</button>' : ''}${dd('garage') < 40 ? '<button data-open="garage">🔧 Open garage</button>' : ''}${on || shared ? '' : '<button data-wait="1">⏩ Kill time till dark</button>'}</div>` + mine;
}
handlers.nav = n => { closeSheet(true); navTo(n); };
// live fix: My rides (myrides.js). The list is also the garage's 🅿️ tab; from the hub it opens on its own.
handlers.myrides = () => openSheet('rides', () => head('🅿️ My rides', wallet()) + MR.listHTML());
handlers.deliver = id => { const r = MR.deliver(id); toast(r.msg, 3000); rerender(); };
handlers.showmap = id => { const r = MR.showOnMap(id); toast(r.msg, 3000); if (r.ok) closeSheet(); };
handlers.open = n => n === 'dealer' ? openDealer() : openGarage();
handlers.wait = () => { skipToMeet(); toast('⏩ You kill a few hours at the cantina. The neon’s on and the engines are warming up.', 3200); rerender(); };
export function skipToMeet() { const T = window.SSX?.time; if (typeof T?.isNight === 'function' && typeof T.set === 'function') { if (!T.isNight()) T.set(T.NIGHT_START ?? 21); return; } // v7.5.4: meets run on the shared Mars clock when SSX.time is loaded
  const G = garage(), now = Date.now(), m = GC.minsToMeet(now, G.clock); if (m > 0) G.clock += m + 0.05; save(); }
function navTo(n) { if (!here()) return; const p = spots()[n]; nav = { x: p.x, z: p.z, n }; toast(`📍 ${n === 'dealer' ? CFG.name : n === 'garage' ? 'Your lock-ups' : 'The car meet lot'}: ${Math.round(dist(meOf(), p))} m. Follow the marker on the radar.`, 3000); }
const patched = new WeakSet();
function patchGame(game) {
  if (!game || patched.has(game)) return; patched.add(game);
  const orig = game.mapGate; game.mapGate = () => { const o = orig ? orig.call(game) : null; if (o) return o; return nav ? { x: nav.x, z: nav.z } : null; };
}

// ---------- My rides (myrides.js): owned rides stay parked in the world, Deliver / Show on map ----------
const MR = createMyRides({ ctx: () => C, garage, save, activeRide, rideById, rideName, toast, spend, credits, app, cfg: () => CFG, spots, here, esc,
  setNav: p => { nav = p; }, syncNow: () => { if (C?.rover) syncRover(0); }, disposeRoot, sheetOpen: () => !!sheet });
Object.assign(GARAGE_API, { deliver: id => MR.deliver(id), locate: id => MR.locate(id), showOnMap: id => MR.showOnMap(id) });
// ---------- the tick (window.SSX_TICKS, called by surface.js once per surface frame) ----------
function tickPartnerIncome() {
  const P = partnerOf(); if (!P.on) return;
  const h = marsHour();
  if (P.lastHour == null) { P.lastHour = h; return; }
  let hrs = h - P.lastHour;
  if (hrs < -12) hrs += 24; // crossed midnight
  if (hrs < 0) { P.lastHour = h; return; } // clock noise / rewind: don't pay
  if (hrs > 8) hrs = 8; // cap one jump (sleep / time skip)
  if (hrs > 1e-4) { GC.partnerAccrue(P, P.lastHour, hrs, domeOn() ? 1 + GC.DOME.lotCutBonus : 1); P.lastHour = h; }
}
export function dealerTick(dt, ctx) {
  C = ctx; last = performance.now();
  if (!root || !root.parent || planet !== ctx.name || (here() && !lot)) setupPlanet();
  ensureUI(); patchGame(ctx.game); syncRockClear();
  syncRover(dt); MR.tick(dt); tickPartnerIncome();
  if (!here()) { const mr = sheet ? null : MR.ctxAction(); setCtx(mr?.label || null, mr?.act); return; }
  if (nav && dist(meOf(), nav) < 14) nav = null;
  // turntables + showroom camera (selected podium spins a bit faster under the lights)
  const me = meOf(), S = spots(), focusing = sheet?.kind === 'dealer' && !!dSel;
  if (lot && dist(me, S.dealer) < 90) for (const p of lot.podiums) if (p.v && p.g.visible) p.v.group.rotation.y += dt * (focusing && p.kind === dSel ? 0.55 : 0.35);
  if (bay) bay.group.rotation.y += dt * 0.25;
  meet?.tick(dt, me);
  clearRocks(dt);
  if (sheet && sheetCam) { const t = sheetCam(); if (t) showroomCam(t, dt); }
  tickShowFX(dt);
  const nowMs = performance.now();
  // fence arms from position, so the button has to follow on the same frame it changes (a 200 ms poll was leaving Exit (E) up under the glass)
  if ((!!ui.fence !== !!wantFence()) || nowMs - ui.t > 200) { ui.t = nowMs; updateCtx(); }
}
// the terrain scatters instanced boulders everywhere; tuck the ones sitting on our lots / the strip out of sight (visual only)
let rockDone = new WeakSet(); const rm = new THREE.Matrix4(), rp = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0); let rockT = 0;
function clearRocks(dt) {
  if ((rockT -= dt) > 0) return; rockT = 0.5; const S = spots(), cx = S.stripFrom.x, z0 = Math.min(S.stripFrom.z, S.stripTo.z) - 20, z1 = Math.max(S.stripFrom.z, S.stripTo.z) + 10;
  const zones = [[{ x: S.dealer.x + LOT.cx, z: S.dealer.z + LOT.cz }, domeOn() ? GC.DOME.rx + 1 : 29], [S.garage, 14], [S.meet, 27]];
  for (const g of C.scene.children) if (g.isGroup && g !== root) for (const o of g.children) {
    if (!o.isInstancedMesh || rockDone.has(o) || o.geometry?.type !== 'IcosahedronGeometry') continue; rockDone.add(o); let hit = false;
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, rm); rp.setFromMatrixPosition(rm); rp.applyMatrix4(o.matrixWorld);
      if (zones.some(([p, r]) => Math.hypot(rp.x - p.x, rp.z - p.z) < r) || (Math.abs(rp.x - cx) < 11 && rp.z > z0 && rp.z < z1)) { o.setMatrixAt(i, zero); hit = true; } }
    if (hit) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere(); }
  }
}
const tv = new THREE.Vector3(); let camA = 0;
// ---------- dealer showroom (Collin: isolate + Pit-style light show) ----------
// Unlit cones + floor pool — same technique as mars/pitshow.js (no real THREE.Lights; they recompile materials).
let showFX = null;
const _sv = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _sq = new THREE.Quaternion(), _sm = new THREE.Matrix4(), _ss = new THREE.Vector3(), _sc = new THREE.Color(), _sd = new THREE.Vector3(0, -1, 0);
function showPoolTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function ensureShowFX() {
  if (showFX) return showFX;
  const add = o => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, ...o });
  const G = new THREE.Group(); G.name = 'dealer-showroom'; G.visible = false;
  const mats = {
    beam: new THREE.MeshBasicMaterial(add({ color: 0xffffff, opacity: 0.22, side: THREE.DoubleSide })),
    pool: new THREE.MeshBasicMaterial(add({ map: showPoolTex(), color: 0x22d3ee, opacity: 0.75 })),
    ring: new THREE.MeshBasicMaterial(add({ color: 0x38e1ff, opacity: 0.85, side: THREE.DoubleSide })),
    pillar: new THREE.MeshBasicMaterial(add({ color: 0xffe2a8, opacity: 0.32, side: THREE.DoubleSide })),
  };
  const N = isMobile ? 4 : 5;
  const bg = new THREE.CylinderGeometry(0.08, 1.05, 1, 12, 1, true); bg.translate(0, -0.5, 0);
  const org = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 + 0.35; org.push([Math.cos(a) * 5.4, 7.4, Math.sin(a) * 5.4]); }
  const beams = new THREE.InstancedMesh(bg, mats.beam, N); beams.userData.org = org; beams.frustumCulled = false; beams.name = 'dealer-show-beams';
  for (let i = 0; i < N; i++) { beams.setColorAt(i, _sc.setHex(STROBE[i % STROBE.length])); beams.setMatrixAt(i, _sm.identity()); }
  G.add(beams);
  const poolG = new THREE.PlaneGeometry(9.5, 9.5); poolG.rotateX(-Math.PI / 2); poolG.translate(0, 0.14, 0);
  const pool = new THREE.Mesh(poolG, mats.pool); pool.renderOrder = 3; pool.name = 'dealer-show-pool'; G.add(pool);
  const ringG = new THREE.RingGeometry(2.55, 3.1, 40); ringG.rotateX(-Math.PI / 2); ringG.translate(0, 0.17, 0);
  const ring = new THREE.Mesh(ringG, mats.ring); ring.name = 'dealer-show-ring'; G.add(ring);
  const pilG = new THREE.CylinderGeometry(0.32, 0.55, 6.2, 14, 1, true); pilG.translate(0, 3.1, 0);
  const pillar = new THREE.Mesh(pilG, mats.pillar); pillar.name = 'dealer-show-pillar'; G.add(pillar);
  showFX = { G, mats, beams, pool, ring, pillar, N };
  return showFX;
}
function applyDealerFocus() {
  if (!lot) return;
  const on = sheet?.kind === 'dealer' && !!dSel;
  for (const p of lot.podiums) p.g.visible = !on || p.kind === dSel;
  const fx = ensureShowFX();
  fx.G.parent?.remove(fx.G);
  if (!on) { fx.G.visible = false; document.body.classList.remove('dlr-dealer'); return; }
  document.body.classList.add('dlr-dealer');
  const p = lot.podiums.find(x => x.kind === dSel);
  if (!p) { fx.G.visible = false; return; }
  p.g.add(fx.G); fx.G.position.set(0, 0, 0); fx.G.visible = true;
}
function tickShowFX(dt) {
  if (!showFX?.G.visible) return;
  const t = performance.now() / 1000, { beams, mats, N, ring } = showFX, org = beams.userData.org, bpm = 96;
  for (let i = 0; i < N; i++) {
    const [ox, oy, oz] = org[i];
    // sweep across the car (tighter than the Pit mat sweep — one podium)
    const tx = Math.sin(t * (0.55 + i * 0.11) + i * 1.4) * 1.15, tz = Math.cos(t * (0.7 + i * 0.09) + i * 1.9) * 1.15;
    _sv.set(tx - ox, 0.35 - oy, tz - oz); const L = Math.max(0.5, _sv.length()); _sv.normalize();
    _sq.setFromUnitVectors(_sd, _sv);
    const lit = strobeOn(t, i, bpm);
    _sm.compose(_sv2.set(ox, oy, oz), _sq, _ss.set(lit ? 1.15 : 0.0001, L, lit ? 1.15 : 0.0001));
    beams.setMatrixAt(i, _sm);
    beams.setColorAt(i, _sc.setHex(strobeColor(t, i, bpm)));
  }
  beams.instanceMatrix.needsUpdate = true; if (beams.instanceColor) beams.instanceColor.needsUpdate = true;
  mats.pool.color.setHex(strobeColor(t, 2, bpm)); mats.pool.opacity = strobeOn(t, 1, bpm) ? 0.78 : 0.3;
  mats.ring.color.setHex(strobeColor(t, 0, bpm)); mats.ring.opacity = 0.5 + Math.sin(t * 4.2) * 0.25;
  mats.pillar.opacity = 0.2 + (strobeOn(t, 3, bpm) ? 0.22 : 0.05);
  ring.rotation.z += dt * 0.45;
}
function showroomCam(obj, dt) {
  // dealer focus: tighter orbit so the selected car fills the free window above / beside the sheet
  obj.getWorldPosition(tv); camA += dt * 0.35; const cam = C.camera, land = innerWidth > innerHeight, dealer = sheet?.kind === 'dealer';
  const R = dealer ? (land ? 8 : 9.5) : (land ? 10 : 11.5), a = CFG.yaw + (dealer ? 0.4 : 0.75) * Math.sin(camA);
  const yOff = dealer ? 3.4 : 4.2;
  const y = Math.max(tv.y + yOff, H(tv.x + Math.sin(a) * R, tv.z + Math.cos(a) * R) + 2);
  cam.position.set(tv.x + Math.sin(a) * R, y, tv.z + Math.cos(a) * R);
  // frame the car in the part of the screen the sheet leaves free (top in portrait, left in landscape)
  const lookY = dealer ? (land ? 1.1 : -1.4) : (land ? 1 : -2.2);
  cam.lookAt(tv.x, tv.y + lookY, tv.z);
  if (land) cam.rotateY(dealer ? -0.12 : -0.22);
}
(window.SSX_TICKS ||= []).push(dealerTick);
// leaving the surface: hide our HUD
setInterval(() => { if (!last || performance.now() - last < 700 || app()?.state?.onSurface) return; if (ui) setCtx(null); closeSheet(true); }, 500);

// ---------- test/debug hooks ----------
window.__dealer = {
  get garage() { return garage(); }, get stock() { return dealerStock(); }, get spots() { return here() ? spots() : null; }, get sheet() { return sheet?.kind || null; },
  get brakeAssist() { return brakeAssist; }, get lotCenter() { if (!here()) return null; const S = spots(), c = Math.cos(CFG.yaw), s = Math.sin(CFG.yaw); return { x: S.dealer.x + LOT.cx * c + LOT.cz * s, z: S.dealer.z - LOT.cx * s + LOT.cz * c, on: p => onLot(p) }; },
  get ctxWhy() { return C ? { sheet: sheet?.kind || null, here: here(), down: !!C.game.isDown(), race: window.__race?.state || null, inside: !!app()?.surface?.info?.inside, stolen: !!stolenCar(), onLot: onLot(meOf()), apron: onApron(meOf()), armed: fenceHot, age: Math.round(performance.now() - last) } : null; },
  // v7.5.59 (M1): index.html's KeyE asks here first; true = the Fence ride action ran, so doInteract() must not
  keyE() { // v7.5.65: stolen + on-lot latch (held past the apron edge). Not the button's display — that blips off under the dome.
    if (!wantFence()) return false; if (!ui?.fence || !ui.act) setCtx('💸 Fence ride', doFence); if (!ui?.act) return false; ui.act(); return true; },
  get fenceOn() { return wantFence(); },
  get ctx() { return ui ? { label: ui.btn.textContent, shown: ui.btn.style.display === 'block' } : null; },
  get ride() { const rv = C?.rover; return rv ? { kind: rv.__dlrKind, spec: { ...rv.spec }, skin: !!rv.__dlr?.skin, stockHidden: rv.stockParts?.[0]?.visible === false } : null; },
  buy, buyPartner, buyDome, collectPartner, fenceRide, upgrade, customise, setActive, sell, openDealer, openGarage, openHub, closeSheet, skipToMeet, navTo, specOf, rideById, cfg: () => ({ ...CFG }),
  get partner() { return { ...partnerOf() }; },
  get dome() { return { ...domeOf(), built: !!lot?.dome, visible: !!lot?.dome?.visible, apron: lot?.apron ? lot.apron.visible : null }; }, applyDome,
  get myrides() { return MR; }, get wave() { return { ...TC.shared().dealer, lot: LOT_KINDS, line: waveLine() }; }, get showroom() { return { on: !!showFX?.G.visible, kind: dSel || null, sheet: sheet?.kind || null }; }, noteBought, rebuildPodiums, applyDealerFocus,
  heightAt: (x, z) => H(x, z), tp(n, dz = 0) { const p = spots()[n]; app().surface.debugMove(p.x, p.z + dz, 0); }, get meet() { return meet?.debug || null; }
};
