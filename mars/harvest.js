// Hands-on harvest at the Dustbowl Homestead (window.SSX.harvest). Rules + numbers: mars/harvestcore.js (unit-tested).
// - Sickle (free): at a ripe rack on foot, FIRE (or the 🌾 Cut button) swings it. Each swing cuts one of the rack's 3
//   patches: chaff and dust fly, the crop on the rack gets shorter, and the cut crop goes on your back as a rope-tied bale.
// - Silo: a corrugated grain silo east of the dome. Walk there with the bale and FIRE / tap 🏚️ Drop bale: it banks into
//   the farm's silo (SSX.farm.bank). Quick cuts in a row earn extra crops (caption explains).
// - Harvester (4,000 cr, charged once): a rust-red combine on the hauler chassis, granted to your garage (SSX.garage) and
//   parked at the farm's west fence; get in with the garage's own 🔑 Drive button. Driving over ripe racks cuts them into
//   its hopper; stopping at the silo empties it. Pauses while SSX.gravity says you're floating.
// - Hire a hand: the farm sheet's harvest buttons now hire one (6 cr a rack, 15 s), the old one-tap way, just slower.
// Wiring: one <script type="module"> in index.html; game.js runs SSX.fireHooks before an on-foot shot; farm.js exposes
// cut / bank / rackSpots / siloRoom / redraw and asks SSX.harvest.cropLeft how much of a rack is still standing.
// Save: own key ssx.harvest.v1 (the farm save and its .bak mirror stay farm.js's alone).
import * as THREE from 'three';
import { registerVehicle } from '../world.js';
import * as H from './harvestcore.js';
import { makeActGuard, CROPS, dirWord } from './farmcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game;
const FARM = () => window.SSX?.farm;
const fin = Number.isFinite;
const isPhone = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 600);
const nowS = () => performance.now() / 1000;
let S = H.fresh();
try { S = H.migrate(localStorage.getItem(H.SAVE_KEY)); } catch (e) { /* private mode */ }
let saveErr = null;
function save() { try { localStorage.setItem(H.SAVE_KEY, JSON.stringify(S)); saveErr = null; } catch (e) { saveErr = String(e?.name || e); } }
const subs = new Set();
function emit(type, ev = {}) { const e = { type, ...ev }; for (const f of subs) { try { f(e); } catch (x) { console.warn('harvest on', x); } } try { window.dispatchEvent(new CustomEvent('ssx:harvest', { detail: e })); } catch (x) { /* */ } return e; }
function toast(m, ms = 2800) { if (!m) return; if (panel?.classList.contains('show')) { pMsg.textContent = m; return; } try { app()?.toast?.(m, ms); } catch (e) { /* */ } }
const credits = () => game()?.progress?.credits | 0;
function spend(n) { const g = game(); if (!g?.progress || credits() < n) return false; g.progress.credits -= n; try { g.save(); } catch (e) { /* */ } return true; }
function refund(n) { const g = game(); if (!g?.progress || !(n > 0)) return; g.progress.credits += n; try { g.save(); } catch (e) { /* */ } }
const AG = makeActGuard(() => performance.now(), 600);
const cropName = c => CROPS[c]?.name || c, cropIcon = c => CROPS[c]?.icon || '🌾';
const bagWords = b => Object.entries(b).map(([c, n]) => `${n} ${cropName(c)}`).join(', ') || 'nothing';

// ---------- the harvester: a grungy combine on the ore-hauler chassis ----------
const MAT = {}; // shared (the garage disposes skins; three re-uploads a disposed material on its next use)
function mats() {
  if (MAT.rust) return MAT;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0.25, ...o });
  Object.assign(MAT, { rust: std(0x7a3a1c), grime: std(0x3b2c22), steel: std(0x5d5a55, { metalness: 0.6, roughness: 0.6 }), blade: std(0x8d8a82, { metalness: 0.8, roughness: 0.35 }),
    straw: std(0xb8975a, { metalness: 0 }), rope: std(0x4a3626, { metalness: 0 }), wood: std(0x5a4330, { metalness: 0 }), dust: std(0x8a5236, { metalness: 0 }), amber: new THREE.MeshBasicMaterial({ color: 0xffa133 }),
    silo: std(0x6f6a62, { metalness: 0.55, roughness: 0.7 }), siloRust: std(0x6b3a22, { metalness: 0.3 }), black: new THREE.MeshBasicMaterial({ color: 0x000000 }) });
  return MAT;
}
const GEO = {};
function geos() {
  if (GEO.box) return GEO;
  GEO.box = new THREE.BoxGeometry(1, 1, 1); GEO.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); GEO.cylX = GEO.cyl.clone().rotateZ(Math.PI / 2);
  GEO.reelBar = new THREE.BoxGeometry(4.0, 0.08, 0.08); GEO.chunk = new THREE.BoxGeometry(0.1, 0.05, 0.1);
  return GEO;
}
function part(g, m, x, y, z, sx, sy, sz, parent) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; }
function harvesterBuilder({ build, sec }) {
  const v = build('hauler', sec), b = v.body, M = mats(), G = geos();
  for (const o of b.children) if (o.isMesh && o.scale.x > 2.3 && o.scale.z > 1.7) o.material = M.rust;
  // header: cutter bar, side shields, a reel of bats on a spinning axle
  part(G.box, M.steel, 0, 0.55, -3.55, 4.4, 0.18, 0.9, b); part(G.box, M.grime, 0, 0.9, -3.15, 4.4, 0.7, 0.12, b);
  for (const s of [-1, 1]) { part(G.box, M.rust, s * 2.2, 0.95, -3.55, 0.1, 0.9, 1.1, b); part(G.box, M.steel, s * 1.4, 1.5, -2.7, 0.12, 0.12, 1.4, b); }
  for (let k = 0; k < 9; k++) part(G.box, M.blade, -2 + k * 0.5, 0.5, -4.05, 0.08, 0.05, 0.25, b); // guard fingers
  const reel = new THREE.Group(); reel.name = 'hvReel'; reel.position.set(0, 1.45, -3.6); b.add(reel);
  part(G.cylX, M.steel, 0, 0, 0, 4.1, 0.14, 0.14, reel);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, bar = new THREE.Mesh(G.reelBar, M.grime); bar.position.set(0, Math.sin(a) * 0.5, Math.cos(a) * 0.5); reel.add(bar); }
  // grain hopper on the bed: open-top steel bin with the crop heap inside, and an unloading auger pipe
  const hop = new THREE.Group(); hop.position.set(0, 2.05, 1.2); b.add(hop);
  part(G.box, M.rust, 0, 0, 1.55, 2.5, 1.3, 0.1, hop); part(G.box, M.rust, 0, 0, -1.55, 2.5, 1.3, 0.1, hop);
  for (const s of [-1, 1]) part(G.box, M.rust, s * 1.25, 0, 0, 0.1, 1.3, 3.2, hop);
  const fill = part(G.box, M.straw, 0, -0.6, 0, 2.3, 0.05, 3.0, hop); fill.name = 'hvFill'; fill.visible = false;
  const aug = part(G.cyl, M.steel, -1.6, 2.6, 0.2, 0.28, 3.2, 0.28, b); aug.rotation.z = 0.9; aug.rotation.y = 0.3;
  part(G.box, M.amber, 0.9, 2.65, -1.6, 0.2, 0.12, 0.2, b); // beacon
  part(G.box, M.grime, 0, 0.75, 3.05, 2.6, 0.5, 0.3, b); // muddy rear bumper
  v.group.userData.harvester = true;
  return v;
}
const SPEC = { name: 'Dust-cutter harvester', vmax: 11, boost: 15, acc: 5, bacc: 7, turn: 1.05, wy: 0.75, wr: 0.75, r: 3.0, tough: true };
try { registerVehicle(H.ROVER_KIND, { ...SPEC }, harvesterBuilder); } catch (e) { console.warn('harvester register', e); }

// ---------- scene: silo, the sickle + bale rig, pooled chaff ----------
let scene = null, silo = null, rig = null, sickle = null, bale = null, swingT = 1, P = null;
function buildSilo() {
  const M = mats(), G = geos(), g = new THREE.Group(); g.name = 'harvest-silo';
  part(G.cyl, M.grime, 0, 0.15, 0, 3.2, 0.3, 3.2, g); // concrete pad
  const body = part(new THREE.CylinderGeometry(1.35, 1.35, 4.6, 18, 1, true), M.silo, 0, 2.6, 0, 1, 1, 1, g); body.material.side = THREE.DoubleSide;
  for (let k = 0; k < 5; k++) part(G.cyl, M.siloRust, 0, 0.6 + k * 1.0, 0, 2.78, 0.07, 2.78, g); // corrugation bands
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.1, 18), M.siloRust); roof.position.y = 5.45; g.add(roof);
  for (let k = 0; k < 9; k++) part(G.box, M.steel, -1.42, 0.6 + k * 0.5, 0.3, 0.06, 0.05, 0.45, g); // ladder rungs
  for (const z of [0.08, 0.52]) part(G.box, M.steel, -1.42, 2.6, z, 0.06, 4.6, 0.05, g);
  part(G.box, M.steel, 1.2, 1.4, -0.9, 0.9, 0.9, 0.9, g).rotation.y = 0.6; // intake hopper box
  const chute = part(G.cyl, M.steel, 0.9, 3.4, -0.6, 0.22, 3.6, 0.22, g); chute.rotation.z = -0.5;
  part(G.box, M.straw, 0.6, 0.35, 1.5, 0.9, 0.45, 0.55, g).rotation.y = 0.3; // spilled bale
  // drop zone ring (lit while you carry a bale or drive a loaded harvester)
  const ring = new THREE.Mesh(new THREE.RingGeometry(H.SILO_R - 0.35, H.SILO_R, 40), new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.32; ring.name = 'harvest-silo-ring'; ring.visible = false; g.add(ring); g.userData.ring = ring;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeRect(3, 3, 250, 58);
  x.fillStyle = '#fff'; x.font = '900 34px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SILO', 128, 34);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide })); sg.position.set(0, 3.2, 1.37); g.add(sg);
  return g;
}
function buildRig() {
  const M = mats(), G = geos(), g = new THREE.Group(); g.name = 'harvest-rig';
  // sickle: worn wooden grip, crescent blade (the hand sits at the astronaut's right side)
  sickle = new THREE.Group(); sickle.name = 'harvest-sickle'; sickle.position.set(0.5, 0.98, -0.2); sickle.scale.setScalar(1.35); g.add(sickle);
  part(G.cyl, M.wood, 0, 0, 0, 0.06, 0.42, 0.06, sickle).rotation.x = Math.PI / 2;
  const blade = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 4, 18, Math.PI * 1.15), M.blade); blade.position.set(0, 0, -0.42); blade.rotation.set(Math.PI / 2, 0, -0.3); blade.scale.set(1, 1, 3.2); sickle.add(blade);
  // bale: straw block tied with two ropes, on the back
  bale = new THREE.Group(); bale.name = 'harvest-bale'; bale.position.set(0, 1.25, 0.42); g.add(bale);
  part(G.box, M.straw, 0, 0, 0, 0.72, 0.5, 0.42, bale);
  for (const x of [-0.2, 0.2]) part(G.box, M.rope, x, 0, 0, 0.05, 0.53, 0.45, bale);
  part(G.box, M.rope, 0, 0.18, -0.24, 0.6, 0.04, 0.04, bale); // shoulder strap
  for (let k = 0; k < 6; k++) part(G.box, M.straw, -0.3 + k * 0.12, 0.27, (k % 2 ? 0.08 : -0.08), 0.03, 0.12, 0.03, bale).rotation.z = (k - 2.5) * 0.25; // stalks poking out
  bale.visible = false; g.visible = false;
  return g;
}
// pooled chaff / dust chunks: one InstancedMesh, fixed typed arrays, no per-frame allocation
const PCAP = isPhone ? 40 : 64;
function buildParticles() {
  const M = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), m = new THREE.InstancedMesh(geos().chunk, M, PCAP); m.name = 'harvest-chaff'; m.frustumCulled = false;
  const st = { m, px: new Float32Array(PCAP), py: new Float32Array(PCAP), pz: new Float32Array(PCAP), vx: new Float32Array(PCAP), vy: new Float32Array(PCAP), vz: new Float32Array(PCAP), life: new Float32Array(PCAP), spin: new Float32Array(PCAP), next: 0, alive: 0, d: new THREE.Object3D(), col: new THREE.Color() };
  st.d.scale.set(0, 0, 0); st.d.updateMatrix(); for (let k = 0; k < PCAP; k++) { m.setMatrixAt(k, st.d.matrix); m.setColorAt(k, st.col.setHex(0xb59a5a)); }
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return st;
}
const CHAFF = [0xb59a5a, 0x8a5236, 0x6d5a3a];
function burst(x, y, z, n, leaf, spread = 1) {
  if (!P) return; n = Math.min(n, PCAP);
  for (let k = 0; k < n; k++) {
    const i = P.next; P.next = (P.next + 1) % PCAP; if (P.life[i] <= 0) P.alive++;
    P.px[i] = x + (Math.random() - 0.5) * spread; P.py[i] = y + Math.random() * 0.4; P.pz[i] = z + (Math.random() - 0.5) * spread;
    P.vx[i] = (Math.random() - 0.5) * 3.2; P.vy[i] = 1.2 + Math.random() * 2.6; P.vz[i] = (Math.random() - 0.5) * 3.2; P.life[i] = 0.7 + Math.random() * 0.6; P.spin[i] = Math.random() * 6;
    P.m.setColorAt(i, P.col.setHex(k % 3 === 0 && leaf != null ? leaf : CHAFF[k % 3]));
  }
  if (P.m.instanceColor) P.m.instanceColor.needsUpdate = true;
}
function partTick(dt) {
  if (!P || P.alive <= 0) return; const d = P.d; let alive = 0;
  for (let i = 0; i < PCAP; i++) {
    if (P.life[i] <= 0) continue; P.life[i] -= dt;
    if (P.life[i] <= 0) { d.position.set(0, -999, 0); d.scale.set(0, 0, 0); d.updateMatrix(); P.m.setMatrixAt(i, d.matrix); continue; }
    alive++; P.vy[i] -= 3.7 * dt; P.vx[i] *= 1 - 1.6 * dt; P.vz[i] *= 1 - 1.6 * dt; // Mars gravity + thin-air drag
    P.px[i] += P.vx[i] * dt; P.py[i] += P.vy[i] * dt; P.pz[i] += P.vz[i] * dt;
    const s = Math.min(1, P.life[i] * 2); d.position.set(P.px[i], P.py[i], P.pz[i]); d.rotation.set(P.spin[i] * P.life[i], P.spin[i], 0); d.scale.set(s, s, s); d.updateMatrix(); P.m.setMatrixAt(i, d.matrix);
  }
  P.alive = alive; P.m.instanceMatrix.needsUpdate = true;
}

// ---------- sound: WebAudio noise swish / thud (one shared noise buffer) ----------
let AC = null, NOISE = null;
function audio() {
  if (AC) return AC.state === 'suspended' ? (AC.resume().catch(() => {}), AC) : AC;
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); NOISE = AC.createBuffer(1, AC.sampleRate * 0.5 | 0, AC.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; }
  return AC;
}
const sfxLog = [];
function sfx(kind) {
  sfxLog.push(kind); if (sfxLog.length > 60) sfxLog.shift();
  const a = audio(); if (!a || !NOISE) return;
  try {
    const t = a.currentTime, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); src.buffer = NOISE;
    const P_ = { swish: [2600, 700, 0.22, 0.09], cut: [900, 300, 0.18, 0.12], thud: [220, 90, 0.25, 0.22], combine: [500, 160, 0.3, 0.1] }[kind] || [800, 300, 0.2, 0.08];
    f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(P_[0], t); f.frequency.exponentialRampToValueAtTime(P_[1], t + P_[2]);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(P_[3], t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + P_[2]);
    src.connect(f).connect(g).connect(a.destination); src.start(t); src.stop(t + P_[2] + 0.05);
  } catch (e) { /* audio is optional */ }
}

// ---------- world state (refreshed 4x a second) ----------
let tcLast = null, spots = [], centre = null, siloW = null, owned = false, atFarm = false, near = null, nearSilo = false, driving = false, onHarv = false, pit = false, floaty = false;
let lastSwing = -9, lastWhy = '', lastWhyT = -9, cutT = 0, uiT = 0, statusT = 0, emptyT = 0;
function playerPos() { const p = tcLast?.player; return p && fin(p.x) ? p : null; }
function header() { const c = tcLast?.car; if (!c) return null; return { x: c.x - Math.sin(c.yaw) * 3.4, z: c.z - Math.cos(c.yaw) * 3.4 }; }
function isHarvester() { const tc = tcLast; return !!(tc?.car && tc.car === tc.rover && tc.rover.__dlrKind === H.ROVER_KIND); }
function gravityFloat() { try { const G = window.SSX?.gravity; if (typeof G?.floating === 'function' ? G.floating() : G?.floating === true) return true; if (G?.isFloating?.()) return true; } catch (e) { /* */ } try { return !!FARM()?.debug?.floating?.(); } catch (e) { return false; } }
function hasRide() { try { const rs = window.SSX?.garage?.rides; if (Array.isArray(rs)) return rs.some(r => r.kind === H.ROVER_KIND); } catch (e) { /* */ } return S.rover.owned; }
function refreshWorld() {
  const F = FARM(); spots = []; centre = null; siloW = null; owned = false; atFarm = false;
  if (!F || surf()?.info?.name !== 'Mars' || !app()?.state?.onSurface) return;
  const pl = F.places?.().find(p => p.id === 'farm'); if (!pl || !fin(pl.x)) return; centre = { x: pl.x, z: pl.z };
  try { spots = F.rackSpots?.() || []; } catch (e) { spots = []; }
  siloW = H.toWorld(centre, H.SILO_AT);
  if ((statusT -= 0.25) <= 0) { statusT = 1; try { owned = !!F.status().owned; } catch (e) { owned = false; } refreshWorld.owned = owned; } else owned = !!refreshWorld.owned;
  const me = playerPos(), c = tcLast?.car, p = c || me;
  // the homestead lot, or (farm expansions) close to any rack on the extra lots north / north-east of it
  atFarm = !!p && owned && (Math.hypot(p.x - centre.x, p.z - centre.z) < 24 || spots.some(r => Math.hypot(p.x - r.x, p.z - r.z) < 9));
  try { pit = !!F.debug?.inPit?.(); } catch (e) { pit = false; }
  if (H.prune(S, spots)) save();
}
function ground(x, z) { try { const h = tcLast?.height?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } try { return FARM()?.debug?.ground?.(x, z) ?? 0; } catch (e) { return 0; } }

// ---------- actions ----------
function why(m) { const t = nowS(); if (m !== lastWhy || t - lastWhyT > 2.5) { lastWhy = m; lastWhyT = t; toast(m, 2200); } return { ok: false, msg: m }; }
function blocked() {
  if (!FARM()) return 'The farm isn\u2019t loaded.'; if (!centre) return 'Harvesting is at the Dustbowl Homestead on Mars.';
  if (pit) return 'Not in the Rust Pit.'; if (!owned) return 'Buy the homestead first.'; return null;
}
const rackOf = (r) => ({ i: r.i, planted: r.planted, crop: r.crop, ripe: r.ripe, n: r.n });
function cutAt(r, dest) {
  const F = FARM(), p = H.peek(S, r, dest); if (!p.ok) return p;
  if (p.last) { const fr = F.cut(r.i, { planted: r.planted, via: dest === 'hopper' ? 'harvester' : 'sickle' }); if (!fr?.ok) return { ok: false, why: fr?.dup ? '' : (fr?.msg || 'Can\u2019t cut that.'), dup: !!fr?.dup }; }
  const res = H.cutPatch(S, r, dest, nowS()); save();
  if (!res.last) { try { F.redraw(); } catch (e) { /* */ } }
  try { refreshWorld(); } catch (e) { /* */ }
  return res;
}
function swing(o = {}) {
  refreshWorld(); const b = blocked(); if (b) return why(b);
  if (driving) return why('Get out to use the sickle.');
  const t = nowS(); if (t - lastSwing < H.SWING_CD) return { ok: false, dup: true, msg: '' };
  const me = playerPos(); if (!me) return { ok: false, msg: '' };
  const r = H.nearestRipe(spots, me, o.reach || H.REACH); lastSwing = t; swingT = 0; sfx('swish');
  if (!r) { H.breakCombo(S); return why('Nothing ripe in reach. Walk up to a ripe rack.'); }
  const res = cutAt(rackOf(r), 'carry');
  if (!res.ok) return res.why ? why(res.why) : { ok: false, dup: !!res.dup, msg: '' };
  sfx('cut'); burst(r.x, ground(r.x, r.z) + 1.2, r.z, isPhone ? 10 : 14, leafHex(res.crop), 1.2);
  const msg = `${cropIcon(res.crop)} Cut ${res.got} ${cropName(res.crop)}${res.bonus ? ' +1 for quick cuts' : ''}. Bale ${H.count(S.carry)}/${H.CARRY_CAP}.${res.last ? ' Rack cleared.' : ''}`;
  emit('swing', { rack: r.i, crop: res.crop, got: res.got, bonus: res.bonus, combo: res.combo, last: res.last, carry: H.count(S.carry) });
  capKey = ''; return { ok: true, msg, ...res };
}
const LEAF = { potato: 0x5f7f3f, algae: 0x2f7f51, glowberry: 0x5a4fbf, lichen: 0xc9d6e2 };
const leafHex = c => LEAF[c] ?? 0x6a7f3f;
let bankBusy = false;
function bankBag(which) {
  if (bankBusy) return { ok: false, dup: true, msg: '' };
  refreshWorld(); const b = blocked(); if (b) return why(b);
  const bag = which === 'hopper' ? S.hopper : S.carry; if (!H.count(bag)) return why(which === 'hopper' ? 'The hopper is empty.' : 'You aren\u2019t carrying anything.');
  const p = which === 'hopper' ? (tcLast?.car || null) : playerPos(); if (!p || !siloW || Math.hypot(p.x - siloW.x, p.z - siloW.z) > H.SILO_R + (which === 'hopper' ? 2.5 : 0.6)) return why(`Take it to the silo: ${siloWords()}.`);
  bankBusy = true;
  try {
    const F = FARM(), room = F.siloRoom?.() ?? 0, t = H.takeFrom(S, which, room);
    if (!t.n) return why('The silo is full. Sell some crops at the Xen-7 Trading Post first.');
    const r = F.bank(t.items, { via: which === 'hopper' ? 'harvester' : 'sickle' });
    if (!r?.ok) return why(r?.msg || 'The silo didn\u2019t take it.');
    const n = H.settle(S, which, r.got); save(); sfx('thud');
    burst(siloW.x, ground(siloW.x, siloW.z) + 1.2, siloW.z, isPhone ? 8 : 12, null, 1.6);
    const left = H.count(bag), msg = `🏚️ ${n} ${n === 1 ? 'crop' : 'crops'} in the silo (${bagWords(r.got)}).${left ? ` The silo is full: ${left} still ${which === 'hopper' ? 'in the hopper' : 'on your back'}.` : ''}${r.stash ? ` ${r.stash} ghost lichen dried into Glow-dust.` : ''}`;
    toast(msg, 3200); emit(which === 'hopper' ? 'empty' : 'bank', { n, got: r.got, left }); capKey = '';
    return { ok: true, msg, n, got: r.got, left };
  } finally { bankBusy = false; }
}
const drop = () => bankBag('carry');
const emptyHopper = () => bankBag('hopper');
function siloWords() { const p = tcLast?.car || playerPos(); if (!p || !siloW) return 'east of the greenhouse dome'; const d = Math.hypot(siloW.x - p.x, siloW.z - p.z); return `${Math.max(1, Math.round(d))} m ${dirWord(siloW.x - p.x, siloW.z - p.z)}, east of the dome`; }
// the harvester: one charge, then it's yours in the garage, parked at the farm's west fence
function buyHarvester() {
  return AG.run('buy-harvester', () => {
    refreshWorld(); const b = blocked(); if (b) return why(b);
    if (!atFarm) return why('Buy it at the Dustbowl Homestead.');
    const v = H.canBuyRover(S, credits(), hasRide()); if (!v.ok) return why(v.why);
    const Gr = window.SSX?.garage; if (typeof Gr?.grantVehicle !== 'function') return why('The garage isn\u2019t open yet. Try again in a moment.');
    if (!spend(v.cost)) return why(`The harvester is ${H.ROVER_PRICE} cr.`);
    let r = null; try { r = Gr.grantVehicle(H.ROVER_KIND, { active: false }); } catch (e) { r = { ok: false, msg: String(e?.message || e) }; }
    if (!r?.ok) { refund(v.cost); return why(r?.full ? '🔧 Your garage is full. Sell a ride first; you weren\u2019t charged.' : (r?.msg || 'The harvester deal fell through. You weren\u2019t charged.')); }
    H.ownRover(S, r.ride); save(); parkAtFarm(r.ride);
    const msg = `🚜 Harvester bought: ${H.ROVER_PRICE} cr. It\u2019s parked at the west fence. Walk up and tap 🔑 Drive, then roll over ripe racks.`;
    toast(msg, 4200); emit('buy', { cost: H.ROVER_PRICE, ride: r.ride }); capKey = ''; return { ok: true, msg, cost: H.ROVER_PRICE, ride: r.ride };
  });
}
function parkAtFarm(id) {
  if (!centre) return false; const P_ = game()?.progress, rides = P_?.garage?.rides; const r = Array.isArray(rides) ? rides.find(x => x.id === id) : null; if (!r) return false;
  const p = H.toWorld(centre, H.ROVER_PARK); r.park = { planet: 'Mars', x: p.x, z: p.z, y: null, yaw: H.ROVER_PARK[2], at: Date.now() };
  try { game().save(); } catch (e) { /* */ } return true;
}
function harvesterSpot() { if (!centre) return null; try { const rs = game()?.progress?.garage?.rides || [], r = rs.find(x => x.kind === H.ROVER_KIND && x.park); if (r?.park?.planet === 'Mars') return { x: r.park.x, z: r.park.z }; } catch (e) { /* */ } return null; }
// hire a hand (the farm sheet's harvest buttons): the old one-tap harvest, slower and with a small fee
function hire(i = 'all') {
  return AG.run('hire:' + i, () => {
    refreshWorld(); const F = FARM(); if (!F) return { ok: false, msg: 'The farm isn\u2019t loaded.' };
    if (!centre) return { ok: false, msg: 'Hire hands at the Dustbowl Homestead on Mars.' }; if (!owned) return { ok: false, msg: 'Buy the homestead first.' };
    const list = spots.filter(r => r.ripe && (i === 'all' || r.i === (i | 0)));
    if (!list.length) return { ok: false, msg: 'Nothing is ripe yet.' };
    let hired = 0, cost = 0, dup = 0, short = '';
    for (const r of list) { const v = H.canHire(S, r, credits()); if (!v.ok) { if (v.dup) dup++; else short = v.why; continue; } if (!spend(v.cost)) { short = `A hand costs ${H.HIRE.fee} cr.`; break; } H.addJob(S, v.job); hired++; cost += v.cost; }
    save();
    if (!hired) return { ok: false, dup: dup > 0 && !short, msg: short || (dup ? (list.length > 1 ? 'Hands are already on those racks.' : `A hand is already on rack ${list[0].i + 1}.`) : 'No hands free.') };
    emit('hire', { racks: hired, cost }); capKey = '';
    const msg = `👷 ${hired === 1 ? 'A hand is' : hired + ' hands are'} on it: ${cost} cr. Crops in the silo in about ${H.HIRE.secs} s. Free and faster: cut it yourself with the sickle.`;
    toast(msg, 3400); return { ok: true, msg, racks: hired, cost };
  });
}
function jobsTick() {
  if (!S.jobs.length || !spots.length) return; const due = H.dueJobs(S, Date.now()); if (!due.length) return;
  const F = FARM(); let n = 0, refunded = 0; const got = {};
  for (const j of due) {
    const r = spots.find(x => x.i === j.i && x.planted === j.planted && x.ripe);
    if (!r) { refund(j.fee); refunded += j.fee; continue; }
    const left = H.remaining(S, r), c = F.cut(r.i, { hand: true, planted: r.planted, via: 'hand' });
    if (!c?.ok) { refund(j.fee); refunded += j.fee; continue; }
    delete S.cuts[H.rackKey(r)];
    if (left > 0) { const b = F.bank({ [r.crop]: left }, { hand: true, via: 'hand' }); if (b?.ok) { for (const [k, q] of Object.entries(b.got)) { got[k] = (got[k] | 0) + q; n += q; } } }
  }
  save(); try { refreshWorld(); } catch (e) { /* */ }
  emit('hired', { n, got, refunded });
  toast(n ? `👷 Your hired hand banked ${bagWords(got)} in the silo.` : refunded ? `👷 The rack was already cut. ${refunded} cr back.` : '👷 Your hand found the silo full; the crop rotted.', 3200);
}

// ---------- FIRE hook (game.js runs SSX.fireHooks before an on-foot shot) ----------
// claimsFire(): FIRE belongs to the sickle / silo right now (on foot and on the ground at your own farm, by a ripe rack or at the
// silo with a bale). Everywhere else it's false, so guns and the flamethrower behave exactly as before. mars/flame.js asks this
// first, so an equipped flamer hands FIRE to the sickle at a ripe rack instead of spraying (it never burns your own racks anyway).
function claimsFire() {
  if (!tcLast || driving || !atFarm || pit || tcLast.car || tcLast.world?.inside || tcLast.player?.grounded === false) return null;
  if (H.count(S.carry) && nearSilo) return 'drop';
  const me = playerPos(); return me && H.nearestRipe(spots, me, H.REACH) ? 'cut' : null;
}
function fireHook() {
  const c = claimsFire(); if (!c) return false; // nothing to cut: the gun fires as usual
  if (c === 'drop') drop(); else swing(); return true;
}

// ---------- UI: one context button, one caption, a small sheet ----------
const css = `
#hvAct{position:fixed;z-index:15;left:calc(14px + env(safe-area-inset-left));bottom:calc(312px + env(safe-area-inset-bottom));display:none;min-height:52px;min-width:120px;padding:6px 16px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:900 17px/1.1 system-ui,sans-serif;touch-action:manipulation;box-shadow:0 2px 10px #000}
#hvAct.on{display:block}
#hvCap{position:fixed;z-index:14;top:calc(122px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;width:max-content;max-width:min(460px,calc(100vw - 24px));padding:7px 14px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:800 16px/1.25 system-ui,sans-serif;box-shadow:0 2px 10px #000;pointer-events:none}
#hvCap.on{display:block}#hvCap small{display:block;font-weight:700;font-size:13px}
#hvPanel{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
#hvPanel.show{display:flex}#hvPanel .wrap{width:min(480px,calc(100vw - 20px));max-height:calc(100vh - 40px);overflow:auto;background:#000;color:#fff;border:3px solid #fff;border-radius:16px;padding:14px 14px 10px;font:600 15px/1.35 system-ui,sans-serif}
#hvPanel h2{margin:0 0 4px;font:900 21px/1.2 system-ui,sans-serif}#hvPanel p{margin:6px 0}#hvPanel .sub{color:#ddd;font-size:13px}
#hvPanel button{display:block;width:100%;min-height:48px;margin:8px 0 0;padding:8px 12px;border-radius:12px;border:2px solid #fff;background:#111;color:#fff;font:800 15px/1.2 system-ui,sans-serif;text-align:left;touch-action:manipulation}
#hvPanel button.pri{background:#000;color:#fff;border-width:3px}body.hvCapOn #farmGuide{display:none!important}#hvPanel button:disabled{opacity:1;color:#c8c8c8;border-style:dashed;border-color:#8a8a8a}#hvPanel button small{display:block;font-weight:600;font-size:12px;opacity:.85}
#hvPanel .msg{min-height:18px;margin-top:8px;color:#ffd400;font-weight:800}
`;
let actBtn = null, capEl = null, panel = null, pBody = null, pMsg = null, actKey = '', capKey = '';
function tap(el, fn) { let last = 0; const g = e => { const n = performance.now(); if (e?.type === 'click' && n - last < 700) return; if (e?.type === 'pointerup') last = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ui() {
  if (actBtn) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  actBtn = document.createElement('button'); actBtn.id = 'hvAct'; actBtn.type = 'button'; document.body.appendChild(actBtn);
  tap(actBtn, () => { const m = actBtn.dataset.mode; if (m === 'cut') swing(); else if (m === 'drop') drop(); else if (m === 'empty') emptyHopper(); refreshUi(true); });
  capEl = document.createElement('div'); capEl.id = 'hvCap'; capEl.setAttribute('role', 'status'); document.body.appendChild(capEl);
  panel = document.createElement('div'); panel.id = 'hvPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Harvest"><div id="hvBody"></div><div class="msg" id="hvMsg" aria-live="polite"></div></div>'; document.body.appendChild(panel);
  pBody = panel.querySelector('#hvBody'); pMsg = panel.querySelector('#hvMsg');
  panel.addEventListener('pointerup', e => { if (e.target === panel) close(); });
  try { window.SSX.registerMenuItem({ id: 'rmHarvest', label: '🌾 Harvest', onTap: () => open() }); } catch (e) { console.warn('harvest menu', e); }
}
function btn(a, label, sub, o = {}) { return `<button type="button" data-a="${a}" class="${o.pri ? 'pri' : ''}" ${o.dis ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
let pGen = 0;
function render() {
  if (!pBody) return; refreshWorld(); const cr = credits(), b = blocked(), have = hasRide();
  let h = `<h2>🌾 Harvest</h2><p class="sub">💰 ${cr} cr${centre ? '' : ' · harvesting is at the Dustbowl Homestead on Mars'}</p>`;
  h += `<p><b>🔪 Sickle</b> (free): at a ripe rack, tap FIRE or 🌾 Cut. ${H.PATCHES} swings clear a rack. The crop goes on your back (up to ${H.CARRY_CAP}).</p>`;
  h += `<p><b>🎒 Bale:</b> ${esc(bagWords(S.carry))} (${H.count(S.carry)}/${H.CARRY_CAP}). Drop it at the silo, ${esc(siloWords())}.</p>`;
  h += `<p class="sub">⚡ ${esc(H.comboText(0))}</p>`;
  h += `<p><b>🚜 Harvester</b>: drive it over ripe racks to cut them into its hopper (${H.count(S.hopper)}/${H.HOPPER_CAP}); stop at the silo to empty it.</p>`;
  if (have) h += `<p class="sub">You own it. It\u2019s in your garage list; if it\u2019s parked here, walk up and tap 🔑 Drive.</p>`;
  else h += btn('buy', `🚜 Buy the harvester · ${H.ROVER_PRICE} cr`, 'Parked at the farm\u2019s west fence. Charged once.', { pri: true, dis: !!b || !atFarm || cr < H.ROVER_PRICE });
  h += `<p class="sub">👷 ${esc(hireText())}</p>`;
  if (S.jobs.length) h += `<p>👷 Hands at work: ${S.jobs.map(j => `rack ${j.i + 1} (${Math.max(0, Math.ceil((j.due - Date.now()) / 1000))} s)`).join(', ')}</p>`;
  if (spots.some(r => r.ripe)) h += btn('hire', `👷 Hire a hand for everything ripe · ${H.HIRE.fee} cr a rack`, `Done in about ${H.HIRE.secs} s.`, { dis: !!b });
  h += btn('close', 'Close', '');
  const gen = ++pGen; pBody.innerHTML = h;
  pBody.querySelectorAll('button[data-a]').forEach(el => tap(el, () => { if (el.disabled || gen !== pGen || !el.isConnected) return; act(el.dataset.a); }));
}
function act(a) {
  if (a === 'close') return close(); let r = null;
  if (a === 'buy') r = buyHarvester(); else if (a === 'hire') r = hire('all');
  if (panel.classList.contains('show')) { const m = pMsg.textContent; render(); pMsg.textContent = r?.dup ? m : (r?.msg || ''); }
}
function open() { if (!panel) return; pMsg.textContent = ''; render(); panel.classList.add('show'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } emit('open', {}); }
function close() { panel?.classList.remove('show'); }
const hireText = () => `Hire a hand: ${H.HIRE.fee} cr a rack, crops in the silo in about ${H.HIRE.secs} s. Faster and free: cut it yourself with the sickle (FIRE at a ripe rack).`;
function otherSheet() { return !!(document.querySelector('#farmPanel.show') || document.querySelector('#hvPanel.show') || document.getElementById('dlrSheet')); } // one caption at a time: ours hides the farm guide bar while it's up (body.hvCapOn)
function refreshUi(force) {
  if (!actBtn) return; let mode = '', label = '', cap = '';
  const show = !!centre && atFarm && !pit && !floaty, carry = H.count(S.carry), hop = H.count(S.hopper);
  if (show && !driving) {
    if (carry && nearSilo) { mode = 'drop'; label = '🏚️ Drop bale'; cap = `🎒 Bale: ${carry}/${H.CARRY_CAP}. Tap 🏚️ Drop bale or FIRE to put it in the silo.`; }
    else if (near && H.peek(S, rackOf(near)).full) cap = `🎒 Bale full (${carry}/${H.CARRY_CAP}).<small>Drop it at the silo: ${esc(siloWords())}.</small>`;
    else if (near) { mode = 'cut'; label = '🌾 Cut'; cap = `🌾 Tap FIRE or 🌾 Cut to swing the sickle.<small>${esc(H.comboText(S.combo.n && nowS() - S.combo.t <= H.COMBO_S ? S.combo.n : 0))}</small>`; if (carry) cap = cap.replace('<small>', `<small>Bale ${carry}/${H.CARRY_CAP}. `); }
    else if (carry) cap = `🎒 Bale: ${carry}/${H.CARRY_CAP} (${esc(bagWords(S.carry))}).<small>Walk to the silo: ${esc(siloWords())}.</small>`;
  } else if (show && onHarv) {
    if (hop && nearSilo) { mode = 'empty'; label = '🏚️ Empty hopper'; }
    cap = `🚜 Hopper ${hop}/${H.HOPPER_CAP}${hop ? ` (${esc(bagWords(S.hopper))})` : ''}.<small>${hop >= H.HOPPER_CAP ? 'Full. Drive to the silo: ' + esc(siloWords()) + '.' : nearSilo && hop ? 'Stop here to empty it, or tap 🏚️ Empty hopper.' : 'Drive over ripe racks to cut them. Stop at the silo to empty it.'}</small>`;
  } else if (centre && onHarv && floaty) cap = '🚜 Land first. The harvester only cuts on the ground.';
  if (otherSheet()) cap = '';
  const k = mode + label; if (force || k !== actKey) { actKey = k; actBtn.textContent = label; actBtn.dataset.mode = mode; actBtn.setAttribute('aria-label', mode === 'cut' ? 'Swing the sickle' : mode === 'drop' ? 'Drop the bale at the silo' : 'Empty the hopper at the silo'); actBtn.classList.toggle('on', !!mode && !otherSheet()); }
  else actBtn.classList.toggle('on', !!mode && !otherSheet());
  if (force || cap !== capKey) { capKey = cap; capEl.innerHTML = cap; capEl.classList.toggle('on', !!cap); document.body.classList.toggle('hvCapOn', !!cap); }
}

// ---------- per frame ----------
let fps = { n: 0, t: 0, last: 0, min: 999 };
function tick(dt, tc) {
  tcLast = tc; if (!fin(dt)) return; dt = Math.min(dt, 0.1);
  { const n = performance.now(); if (!fps.t) fps.t = n; fps.n++; if (n - fps.t >= 1000) { fps.last = Math.round(fps.n * 1000 / (n - fps.t)); fps.min = Math.min(fps.min, fps.last); fps.n = 0; fps.t = n; } } // real-time frame rate (dt is capped)
  if ((uiT -= dt) <= 0) { uiT = 0.25; refreshWorld(); jobsTick(); }
  const onMars = !!centre;
  if (!onMars) { if (silo) silo.visible = false; if (rig) rig.visible = false; if (actBtn && (actKey || capKey)) refreshUi(); return; }
  if (scene !== tc.scene) { scene = tc.scene; silo = buildSilo(); rig = buildRig(); P = buildParticles(); scene.add(silo, rig, P.m); }
  // silo stands on the homestead once it's yours
  silo.visible = owned; if (owned && siloW) silo.position.set(siloW.x, ground(siloW.x, siloW.z) - 0.1, siloW.z);
  driving = !!tc.car; onHarv = isHarvester(); floaty = onHarv && gravityFloat();
  const me = tc.player, carry = H.count(S.carry);
  near = !driving && atFarm && me ? H.nearestRipe(spots, me, H.REACH) : null;
  const pos = driving ? tc.car : me; nearSilo = !!(owned && siloW && pos && Math.hypot(pos.x - siloW.x, pos.z - siloW.z) < H.SILO_R + (driving ? 2.5 : 0.6));
  silo.userData.ring.visible = owned && (carry > 0 || (onHarv && H.count(S.hopper) > 0));
  // rig: sickle in hand at the farm, bale on the back while carrying
  const showRig = !driving && atFarm && me && (surf()?.info?.camDist ?? 3) > 0.8;
  rig.visible = !!showRig;
  if (showRig) {
    rig.position.set(me.x, me.y - 1.7, me.z); rig.rotation.y = me.faceYaw ?? me.yaw ?? 0;
    bale.visible = carry > 0; if (carry) { const f = 0.75 + 0.45 * Math.min(1, carry / H.CARRY_CAP); bale.scale.set(f, f, f); }
    if (swingT < 1) { swingT = Math.min(1, swingT + dt / 0.32); const a = Math.sin(swingT * Math.PI); sickle.rotation.set(-0.3 - a * 0.9, 0.6 - swingT * 1.9, a * 0.5); } else sickle.rotation.set(-0.3, 0.6, 0);
  }
  // harvester: header spins, auto-cut over ripe racks, hopper heap, empties at the silo
  if (onHarv) harvesterTick(dt, tc);
  partTick(dt);
  if (uiT === 0.25) refreshUi();
}
let reelRef = null, fillRef = null, reelOf = null;
function harvesterTick(dt, tc) {
  const rv = tc.rover;
  if (reelOf !== rv || !reelRef?.parent || !fillRef?.parent) { reelRef = null; fillRef = null; reelOf = rv; rv.group.traverse(o => { if (o.name === 'hvReel') reelRef = o; else if (o.name === 'hvFill') fillRef = o; }); }
  const sp = Math.abs(tc.car.speed || 0); if (reelRef) reelRef.rotation.x -= dt * (2 + sp * 0.8);
  const hop = H.count(S.hopper); if (fillRef) { fillRef.visible = hop > 0; if (hop) { const f = hop / H.HOPPER_CAP; fillRef.scale.y = 0.05 + 1.15 * f; fillRef.position.y = -0.65 + fillRef.scale.y / 2; } }
  if (floaty || !atFarm || pit) return;
  if ((cutT -= dt) <= 0) {
    const hd = header(), r = hd ? H.nearestRipe(spots, hd, H.ROVER_REACH) : null;
    if (r) {
      cutT = H.ROVER_CUT_S; const res = cutAt(rackOf(r), 'hopper');
      if (res.ok) { sfx('combine'); burst(r.x, ground(r.x, r.z) + 1.0, r.z, isPhone ? 8 : 12, leafHex(res.crop), 2.2); emit('roverCut', { rack: r.i, crop: res.crop, got: res.got, last: res.last, hopper: H.count(S.hopper) }); capKey = ''; }
      else if (res.full) why(res.why);
    } else cutT = 0.15;
  }
  if (hop && nearSilo && sp < 3 && (emptyT -= dt) <= 0) { emptyT = 1.2; emptyHopper(); }
}

// ---------- API ----------
function status() {
  return { carry: { ...S.carry }, carryN: H.count(S.carry), hopper: { ...S.hopper }, hopperN: H.count(S.hopper), combo: { n: S.combo.n, best: S.combo.best }, cuts: JSON.parse(JSON.stringify(S.cuts)), jobs: S.jobs.map(j => ({ ...j })),
    rover: { ...S.rover, inGarage: hasRide(), driving: onHarv, spot: harvesterSpot() }, stats: { ...S.stats }, silo: siloW ? { x: siloW.x, z: siloW.z } : null, near: near ? near.i : null, nearSilo, atFarm, owned, floating: floaty, pit,
    fps: { last: fps.last, min: fps.min === 999 ? null : fps.min }, particles: { cap: PCAP, alive: P?.alive | 0 }, ui: { act: actBtn?.classList.contains('on') ? actBtn.textContent : '', caption: capEl?.classList.contains('on') ? capEl.textContent : '' }, saveErr, sfx: sfxLog.slice(-8) };
}
const api = {
  status, swing, drop, emptyHopper, buyHarvester, hire, hireText, open, close, on: f => { if (typeof f !== 'function') return () => {}; subs.add(f); return () => subs.delete(f); },
  cropLeft: (k, r) => (r && r.crop ? H.cropLeft(S, { i: k, planted: r.planted }) : 1), fireHook, claimsFire: () => !!claimsFire(),
  PRICES: { harvester: H.ROVER_PRICE, hire: H.HIRE.fee }, rules: { PATCHES: H.PATCHES, CARRY_CAP: H.CARRY_CAP, HOPPER_CAP: H.HOPPER_CAP, COMBO_S: H.COMBO_S, COMBO_EVERY: H.COMBO_EVERY, HIRE_SECS: H.HIRE.secs },
  debug: {
    reset() { AG.reset(); S = H.fresh(); save(); lastSwing = -9; capKey = ''; return status(); },
    rush() { for (const j of S.jobs) j.due = 0; refreshWorld(); jobsTick(); return status(); },
    reload() { try { S = H.migrate(localStorage.getItem(H.SAVE_KEY)); } catch (e) { /* */ } return status(); },
    spots: () => spots.map(r => ({ ...r })), harvesterSpot, header: () => header(), state: () => JSON.parse(JSON.stringify(S)), burst: n => { if (P) burst(centre?.x || 0, 2, centre?.z || 0, n); return P?.alive | 0; }
  }
};
(function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app || !window.SSX.registerMenuItem) { setTimeout(boot, 200); return; }
  if (window.SSX.harvest) return; window.SSX.harvest = api; ui();
  (window.SSX.fireHooks ||= []).push(fireHook);
  try { window.SSX.registerSurfaceTick(tick); } catch (e) { console.warn('harvest tick', e); }
})();
