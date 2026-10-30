/* 🔥 Flamethrower (Steve). A buyable short-range weapon: hold FIRE to spray an 8 m cone of flame from its own fuel tank.
 * Sold at Ozzie's Iron (venue 'guns') and every other counter that already sells weapons, through a guarded wrap of
 * game.shopList / shopItem / buy for 'fl:' ids (the marsshops.js pattern). No core file is edited.
 * Flames set colony folk, security, parked/traffic vehicles and session-only crop patches alight: damage over time via
 * world.blast (which also does the panic/flee, KO and the wanted crime), screams from synth.js (no TTS), charred bodies,
 * and burning vehicles blow up with the game's own explosion burst (game.gore mech) plus world.blast splash.
 * Wanted heat: firing near the colony calls world.shotFired() (crime "discharging a weapon"), every 3 s while held.
 * The player's farm plot is never burned: SSX.farm has no crop-destroy API and the farm save is not touched (see FLAME.md).
 * Firing is never blocked while airborne (Pumpkin's jetpack, when it lands, is looked up guarded: SSX.jetpack).
 * Perf: one pooled THREE.Points (hard cap 240, phone 140), preallocated buffers/vectors, no per-frame allocation;
 * the hit roster is read at 5 Hz only while FIRE is held; burning slots are capped (8). The phone NPC cap is the world's own.
 * UI: a 🔥 toggle + fuel bar above FIRE (on foot, only once owned), pointer events via window.__onTap; hidden in
 * hide-HUD (cinematic/hidehud), indoors, while driving, and under open sheets.
 * State: localStorage 'ssx.flame.v1' { owned, fuel, eq }. API: window.SSX.flame.
 */
import * as THREE from 'three';
import * as C from './flamecore.js';
import { babble, tone, burst, noiseBuf, createVoicePool } from '../synth.js';

const app = () => window.__app, surf = () => app()?.surface;
const fin = Number.isFinite;
const warned = new Set(); const warnOnce = (k, e) => { if (warned.has(k)) return; warned.add(k); console.warn('[flame] ' + k, e); };
const now = () => performance.now() / 1000;

// ---------- state ----------
let S = (() => { try { return C.migrate(JSON.parse(localStorage.getItem(C.SAVE_KEY))); } catch (e) { return C.fresh(); } })();
const save = () => { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const subs = new Set(); const emit = (type, d = {}) => { for (const f of subs) { try { f(type, d); } catch (e) { /* */ } } try { window.SSX?.emit?.('flame:' + type, d); } catch (e) { /* */ } };
const R = { g: null, surf: null, upd: null, fire: null, heldAt: -9, tapUntil: -9, firing: false, eqWeapon: null, hitT: 0, reportT: 0, dryToast: -9, pitToast: -9,
  stats: { shots: 0, hits: 0, ignited: 0, carBooms: 0, crops: 0, reports: 0, peak: 0, fuelUsed: 0 }, lastHit: null, tc: null };
const owned = () => { if (S.owned) return true; try { return !!app()?.game?.progress?.unlocks?.includes('fl:flamer'); } catch (e) { return false; } };
const isPhone = () => { try { return !!(window.matchMedia?.('(pointer: coarse)').matches || /iPhone|Android/.test(navigator.userAgent)); } catch (e) { return false; } };
const toast = (m, ms = 2600) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };

// ---------- shop (guarded wrap, marsshops pattern) ----------
function patchGame(g) {
  if (!g || g.__flameShop) return;
  const oList = g.shopList, oItem = g.shopItem, oBuy = g.buy;
  if (typeof oList !== 'function' || typeof oBuy !== 'function') return;
  g.shopList = function (venue, all) {
    const r = oList.call(g, venue, all);
    try { if (r && Array.isArray(r.items) && (all || C.sellsHere(venue, r.items))) { const cr = g.progress?.credits | 0; r.items.push(C.shopRow('fl:flamer', st(), cr), C.shopRow('fl:fuel', st(), cr)); } } catch (e) { warnOnce('shopList', e); }
    return r;
  };
  if (typeof oItem === 'function') g.shopItem = function (id) { if (typeof id === 'string' && id.startsWith('fl:')) return C.shopRow(id, st(), g.progress?.credits | 0); return oItem.call(g, id); };
  g.buy = function (id) { if (typeof id === 'string' && id.startsWith('fl:')) { try { return doBuy(g, id); } catch (e) { warnOnce('buy', e); return { ok: false, msg: 'Counter jammed. Try again.' }; } } return oBuy.call(g, id); };
  g.__flameShop = true;
}
const st = () => ({ owned: owned(), fuel: S.fuel, eq: S.eq && owned() });
function doBuy(g, id) {
  const P = g.progress, r = C.buy(id, st(), P?.credits | 0);
  if (!r.ok) return { ok: false, msg: r.msg };
  if (r.cost) { P.credits -= r.cost; if (id === 'fl:flamer' && Array.isArray(P.unlocks) && !P.unlocks.includes('fl:flamer')) P.unlocks.push('fl:flamer'); try { g.save?.(); } catch (e) { /* */ } }
  S.owned = r.st.owned; S.fuel = r.st.fuel; S.bought = r.st.bought | 0; setEquip(r.st.eq); save();
  emit(id === 'fl:fuel' ? 'fuel' : r.cost ? 'buy' : 'equip', { fuel: S.fuel, eq: S.eq }); hud(true);
  return { ok: true, msg: r.msg };
}
function setEquip(on) {
  on = !!on && owned(); S.eq = on; save();
  R.eqWeapon = app()?.game?.progress?.equip?.weapon ?? null; // picking any other gun (chip, wheel, shop) puts the flamer away
  if (!on) stopFire();
  hud(true); emit('equip', { eq: on });
}

// ---------- fire input: an outermost wrap of game.update / game.fire (re-applied if another add-on wraps later) ----------
let busyU = false, busyF = false;
function makeUpdate(inner, g) {
  const f = function (dt, input) {
    if (busyU) return inner.call(g, dt, input);
    busyU = true; let took = false;
    try { if (input && input.fire && wants()) { took = true; input.fire = false; } } catch (e) { took = false; }
    try { return inner.call(g, dt, input); } finally { busyU = false; R.held = took; R.heldAt = now(); if (took) input.fire = true; }
  };
  f.__flame = true; return f;
}
function makeFire(inner, g) {
  const f = function (aim) { if (busyF) return inner.call(g, aim); busyF = true; try { if (wants()) { R.tapUntil = now() + 0.35; return true; } return inner.call(g, aim); } finally { busyF = false; } };
  f.__flame = true; return f;
}
function ensureWraps(g) {
  if (!g) return; patchGame(g);
  if (typeof g.update === 'function' && g.update !== R.upd) { R.upd = makeUpdate(g.update, g); g.update = R.upd; }
  if (typeof g.fire === 'function' && g.fire !== R.fire) { R.fire = makeFire(g.fire, g); g.fire = R.fire; }
  if (typeof g.switchWeapon === 'function' && !g.switchWeapon.__flame) { const o = g.switchWeapon, f = function (...a) { if (S.eq) setEquip(false); return o.apply(g, a); }; f.__flame = true; g.switchWeapon = f; } // any gun pick puts the flamer away
}
const indoors = () => document.body.classList.contains('indoors') || !!R.tc?.world?.inside;
function onFoot() { const tc = R.tc; return !!tc && !tc.car && !indoors() && document.body.classList.contains('surface'); }
function inPit() { try { return !!window.SSX?.arsenal?.inPit?.(); } catch (e) { return false; } }
// equipped, owned and on foot: FIRE belongs to the flamer (even with an empty tank or in the pit, so the gun doesn't fire instead)
function sickleTurn() { try { return !!window.SSX?.harvest?.claimsFire?.(); } catch (e) { return false; } }
// at your own farm by a ripe rack (or the silo with a bale) FIRE swings the sickle instead (mars/harvest.js claimsFire)
function wants() { return S.eq && owned() && onFoot() && !sickleTurn(); }
function airborne() {
  try { const J = window.SSX?.jetpack; if (J) { const a = typeof J.active === 'function' ? J.active() : (J.flying ?? J.on ?? J.state?.flying); if (a) return true; } } catch (e) { /* guarded: jetpack not merged yet */ }
  const p = R.tc?.player; return !!p && p.grounded === false;
}

// ---------- particles: one pooled THREE.Points ----------
const N = isPhone() ? C.MAX_PARTS_PHONE : C.MAX_PARTS;
const pPos = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pLife = new Float32Array(N), pMax = new Float32Array(N), pKind = new Float32Array(N), pA = new Float32Array(N), pK = new Float32Array(N);
let pHead = 0, points = null, pGeo = null, pMat = null, live = 0;
function makePoints() {
  pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aLife', new THREE.BufferAttribute(pA, 1).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aKind', new THREE.BufferAttribute(pK, 1).setUsage(THREE.DynamicDrawUsage));
  pMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 800 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aLife; attribute float aKind; uniform float uScale; varying float vL; varying float vK;\n' +
      'void main(){ vL = aLife; vK = aKind; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;\n' +
      ' float s = aLife > 0.0 ? (aKind > 0.5 ? 0.5 + (1.0 - aLife) * 0.8 : 0.14 + (1.0 - aLife) * 1.9) : 0.0; gl_PointSize = min(220.0, s * uScale / max(0.5, -mv.z)); }',
    fragmentShader: 'varying float vL; varying float vK;\n' +
      'void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d) * 4.0; if (r > 1.0 || vL <= 0.0) discard;\n' +
      ' vec3 hot = vec3(1.0, 0.95, 0.7), mid = vec3(1.0, 0.5, 0.08), cool = vec3(0.5, 0.06, 0.02);\n' +
      ' vec3 c = vL > 0.6 ? mix(mid, hot, (vL - 0.6) / 0.4) : mix(cool, mid, vL / 0.6);\n' +
      ' float a = (1.0 - r) * (0.25 + 0.75 * vL) * 0.85; gl_FragColor = vec4(c * a * 1.3, a); }'
  });
  points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 5; points.name = 'flame-points';
}
function spawn(x, y, z, vx, vy, vz, life, kind) {
  const i = pHead; pHead = (pHead + 1) % N; const j = i * 3;
  pPos[j] = x; pPos[j + 1] = y; pPos[j + 2] = z; pVel[j] = vx; pVel[j + 1] = vy; pVel[j + 2] = vz; pLife[i] = life; pMax[i] = life; pKind[i] = kind;
}
function stepParticles(dt) {
  let n = 0; const drag = Math.exp(-1.0 * dt);
  for (let i = 0; i < N; i++) {
    if (pLife[i] <= 0) { if (pA[i] !== 0) pA[i] = 0; continue; }
    pLife[i] -= dt; const j = i * 3;
    if (pLife[i] <= 0) { pA[i] = 0; continue; }
    n++; pVel[j] *= drag; pVel[j + 2] *= drag; pVel[j + 1] = pVel[j + 1] * drag + 3.2 * dt; // flame rises
    pPos[j] += pVel[j] * dt; pPos[j + 1] += pVel[j + 1] * dt; pPos[j + 2] += pVel[j + 2] * dt;
    pA[i] = pLife[i] / pMax[i]; pK[i] = pKind[i];
  }
  live = n; if (n > R.stats.peak) R.stats.peak = n;
  if (pGeo) { pGeo.attributes.position.needsUpdate = true; pGeo.attributes.aLife.needsUpdate = true; pGeo.attributes.aKind.needsUpdate = true; }
}

// ---------- audio (synth.js, TTS-free; respects the game mix and mute) ----------
let ac = null, out = null, roar = null, roarG = null; const voices = createVoicePool(3);
function mix() { try { const m = window.SSX?.audio?.mix?.get?.(); if (m) return m.mute ? 0 : (fin(m.master) ? m.master : 1); } catch (e) { /* */ } try { if (localStorage.getItem('ssx.muted') === '1') return 0; } catch (e) { /* */ } return 1; }
function audio() {
  try {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); out = ac.createGain(); out.connect(ac.destination); }
    if (ac.state === 'suspended') { const p = ac.resume?.(); p?.catch?.(() => {}); }
    if (ac.state !== 'running') return null; out.gain.value = 0.9 * mix(); return mix() > 0 ? ac : null;
  } catch (e) { warnOnce('audio', e); return null; }
}
window.addEventListener('pointerdown', () => { if (owned()) audio(); }, { passive: true, capture: true });
function roarOn(on) {
  try {
    if (on) { const a = audio(); if (!a || roar) return; const s = a.createBufferSource(); s.buffer = noiseBuf(a); s.loop = true; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.7;
      roarG = a.createGain(); roarG.gain.setValueAtTime(0.0001, a.currentTime); roarG.gain.exponentialRampToValueAtTime(0.32, a.currentTime + 0.08); s.connect(f).connect(roarG).connect(out); s.start(); roar = s;
      tone(a, out, 'triangle', 140, a.currentTime, 0.18, 0.08, 60); }
    else if (roar && ac) { const t = ac.currentTime; roarG.gain.cancelScheduledValues(t); roarG.gain.setValueAtTime(Math.max(0.0002, roarG.gain.value), t); roarG.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); roar.stop(t + 0.2); roar = null; roarG = null;
      if (audio()) burst(ac, out, t, 0.25, 0.08, 500, 0.8, 'lowpass', 120); }
  } catch (e) { warnOnce('roar', e); roar = null; }
}
function scream(d) {
  const a = audio(); if (!a || !voices.try(1.0)) return;
  try { const v = Math.max(0.15, 1 - d / 40), t = a.currentTime, hi = 330 + Math.random() * 160;
    babble(a, out, t, { pitch: hi, syll: 3, rate: 4.5, vol: 0.07 * v, angry: true, lp: 3800 });
    tone(a, out, 'sawtooth', hi * 2.1, t + 0.05, 0.85, 0.035 * v, hi * 1.1, 0.03); } catch (e) { warnOnce('scream', e); }
}
function boomSfx(d) {
  const a = audio(); if (!a) return;
  try { const v = Math.max(0.2, 1 - d / 120), t = a.currentTime; burst(a, out, t, 1.5, 0.7 * v, 1200, 0.7, 'lowpass', 60); tone(a, out, 'sine', 90, t, 1.0, 0.4 * v, 28); } catch (e) { warnOnce('boom', e); }
}

// ---------- burning things (fixed slots) ----------
const slots = []; for (let i = 0; i < C.MAX_BURN; i++) slots.push({ on: false, type: '', ref: null, g: null, t: 0, dot: 0, fuse: 0, sprayed: false, char: 0, mats: [], scream: 0 });
const bc = { x: 0, z: 0 }; // reused blast centre
function slotFor(ref) { for (const s of slots) if (s.on && s.ref === ref) return s; return null; }
function freeSlot() { for (const s of slots) if (!s.on) return s; let o = slots[0]; for (const s of slots) if (s.t < o.t) o = s; return o; }
function charMats(g) { // clone each mesh's material once so only this body/vehicle chars (allocation at ignition only)
  const mats = [];
  g.traverse(o => { if (!o.isMesh || !o.material || Array.isArray(o.material)) return; if (!o.userData.flameMat) { o.material = o.material.clone(); o.userData.flameMat = true; o.userData.flameBase = o.material.color ? o.material.color.clone() : null; } if (o.material.color && o.userData.flameBase) mats.push(o); });
  return mats;
}
const BLACK = new THREE.Color(0x0b0806), EMBER = new THREE.Color(0xff4a10);
function applyChar(s, flicker) {
  for (const o of s.mats) { const m = o.material, b = o.userData.flameBase; m.color.copy(b).lerp(BLACK, Math.min(0.92, s.char)); if (m.emissive) { m.emissive.copy(EMBER).multiplyScalar(flicker); } }
}
function findGroup(scene, x, z) { // the person's group sits at (p.x, ground, p.z)
  let best = null, bd = 0.08;
  for (const o of scene.children) { if (!o.isGroup && o.type !== 'Group') continue; const d = Math.abs(o.position.x - x) + Math.abs(o.position.z - z); if (d < bd) { bd = d; best = o; } }
  return best;
}
function ignitePerson(p, tc) {
  const g = findGroup(tc.scene, p.x, p.z); const ref = g || p.name || (p.x + ',' + p.z);
  let s = slotFor(ref); const fresh = !s;
  if (!s) { s = freeSlot(); s.on = true; s.type = 'p'; s.ref = ref; s.g = g; s.char = 0; s.dot = 0; s.scream = 0; s.mats = g ? charMats(g) : []; s.px = p.x; s.pz = p.z; s.kind = p.kind; R.stats.ignited++; emit('ignite', { kind: p.kind, name: p.name }); }
  s.t = C.BURN_T; if (fresh) { scream(dist(p.x, p.z)); s.scream = 1.4 + Math.random(); }
  R.lastHit = { type: 'person', kind: p.kind, name: p.name || null, x: p.x, z: p.z };
}
function igniteCar(v) {
  let s = slotFor(v);
  if (!s) { s = freeSlot(); s.on = true; s.type = 'v'; s.ref = v; s.g = v.group; s.t = 99; s.fuse = C.CAR_FUSE; s.char = 0; s.mats = v.group ? charMats(v.group) : []; R.stats.ignited++; emit('ignite', { kind: 'vehicle', vehicle: v.kind }); }
  s.sprayed = true; R.lastHit = { type: 'vehicle', kind: v.kind, x: v.x, z: v.z };
}
const dist = (x, z) => { const p = R.tc?.player; return p ? Math.hypot(x - p.x, z - p.z) : 99; };
function burnTick(dt, tc) {
  const w = tc.world, g = tc.game;
  for (const s of slots) {
    if (!s.on) continue;
    const x = s.g ? s.g.position.x : s.px, z = s.g ? s.g.position.z : s.pz, y = s.g ? s.g.position.y : (tc.height?.(x, z) || 0);
    if (s.type === 'p') {
      s.t -= dt; s.dot -= dt; s.char = Math.min(1, s.char + dt / 2.6);
      if (s.dot <= 0) { s.dot = C.BURN_EVERY; bc.x = x + (tc.player.x - x) * 0.05; bc.z = z + (tc.player.z - z) * 0.05; try { w?.blast?.(bc, 0.8, C.BURN_DMG); } catch (e) { warnOnce('blast', e); } }
      s.scream -= dt; if (s.scream <= 0 && s.t > 1) { s.scream = 1.6 + Math.random() * 1.2; scream(dist(x, z)); }
      for (let q = (isPhone() ? 36 : 56) * dt + Math.random(); q >= 1; q--) spawn(x + (Math.random() - 0.5) * 0.6, y + 0.2 + Math.random() * 1.6, z + (Math.random() - 0.5) * 0.5, 0, 1.5 + Math.random(), 0, 0.45 + Math.random() * 0.2, 1);
      applyChar(s, s.t > 0 ? (0.1 + Math.random() * 0.22) * (1 - s.char * 0.5) : 0);
      if (s.t <= 0) { try { g?.gore?.(x, y + 0.4, z, { n: 0.5 }); } catch (e) { /* */ } applyChar(s, 0); s.on = false; s.ref = null; s.g = null; s.mats = []; emit('charred', { kind: s.kind }); }
    } else {
      const v = s.ref, r = C.carTick(s.fuse, dt, s.sprayed); s.fuse = r.fuse; s.sprayed = false; s.char = Math.min(0.85, s.char + dt / 8);
      if (v.traffic) { v.traffic.v = Math.max(0, v.traffic.v - dt * 6); }
      for (let q = (isPhone() ? 40 : 64) * dt + Math.random(); q >= 1; q--) spawn(x + (Math.random() - 0.5) * 2, y + 0.6 + Math.random() * 0.9, z + (Math.random() - 0.5) * 2, 0, 1.8 + Math.random() * 1.5, 0, 0.55 + Math.random() * 0.25, 1);
      applyChar(s, (0.12 + Math.random() * 0.25) * (1 - s.char * 0.6));
      if (r.boom) carBoom(s, v, x, y, z, tc);
    }
  }
}
function carBoom(s, v, x, y, z, tc) {
  const g = tc.game, w = tc.world;
  try { g?.gore?.(x, y + 1, z, { mech: true }); } catch (e) { warnOnce('gore', e); } // the game's own explosion burst + debris
  bc.x = x; bc.z = z; try { w?.blast?.(bc, C.BOOM_R, C.BOOM_DMG); } catch (e) { warnOnce('blast', e); }
  const d = dist(x, z); if (d < C.BOOM_R * 0.8) { try { g?.hurtPlayer?.(Math.round(30 * (1 - d / C.BOOM_R)) + 6, { x, z }); } catch (e) { /* */ } }
  for (let i = 0; i < (isPhone() ? 40 : 70); i++) { const a = Math.random() * 6.283, sp = 4 + Math.random() * 7; spawn(x, y + 1, z, Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp, 0.6 + Math.random() * 0.5, 1); }
  boomSfx(d); s.char = 1; applyChar(s, 0); v.burnt = true; if (v.traffic) { v.traffic.wreck = 1e9; v.traffic.v = 0; }
  s.on = false; s.ref = null; s.g = null; s.mats = []; R.stats.carBooms++; emit('boom', { vehicle: v.kind, x, z });
}

// ---------- session-only crop patches (never saved; the player's farm plot is skipped) ----------
let crops = null; // { mesh, patches: [{ x, z, y, burn, gone, regrow }] }
const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), cs = new THREE.Vector3(), cp = new THREE.Vector3(), cc = new THREE.Color();
const CROP_GREEN = new THREE.Color(0x9aa84a), CROP_ASH = new THREE.Color(0x15110d), CROP_FIRE = new THREE.Color(0xff6a1a);
function farmPlaces() { try { return window.SSX?.farm?.places?.() || null; } catch (e) { return null; } }
function buildCrops(tc) {
  const w = tc.world, col = w?.colony; if (!col || !fin(col.x) || !tc.height) return null;
  const places = farmPlaces(), picked = [];
  for (const [ox, oz] of C.CROP_SPOTS) {
    if (picked.length >= C.CROP_PATCHES) break; const x = col.x + ox, z = col.z + oz;
    if (C.onFarm(x, z, places)) continue;
    let clear = true; for (const [a, b] of [[0, 0], [2.5, 2.5], [-2.5, 2.5], [2.5, -2.5], [-2.5, -2.5]]) { try { if (w.solidAt?.(x + a, z + b)) { clear = false; break; } } catch (e) { /* */ } }
    if (clear) picked.push({ x, z, y: tc.height(x, z), burn: 0, gone: false, regrow: 0 });
  }
  if (!picked.length) return null;
  const geo = new THREE.ConeGeometry(0.09, 1, 4); geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, picked.length * C.CROP_N); mesh.name = 'flame-crops';
  let k = 0; for (const p of picked) for (let i = 0; i < C.CROP_N; i++) { const gx = (i % 6) - 2.5, gz = Math.floor(i / 6) - 1.5; p['s' + i] = [p.x + gx * 0.7 + (Math.random() - 0.5) * 0.2, p.z + gz * 0.7 + (Math.random() - 0.5) * 0.2, 0.8 + Math.random() * 0.4]; k++; }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  crops = { mesh, patches: picked }; layoutCrops(tc); tc.scene.add(mesh); return crops;
}
function layoutCrops(tc) {
  let k = 0; const m = crops.mesh;
  for (const p of crops.patches) for (let i = 0; i < C.CROP_N; i++) {
    const s = p['s' + i], h = p.gone ? 0.12 : s[2] * (1 - p.burn * 0.6), y = tc.height(s[0], s[1]);
    cp.set(s[0], y, s[1]); cs.set(1, Math.max(0.05, h), 1); m.setMatrixAt(k, cm.compose(cp, cq, cs));
    cc.copy(CROP_GREEN).lerp(p.burn > 0 && !p.gone ? CROP_FIRE : CROP_ASH, p.gone ? 1 : Math.min(1, p.burn * 1.4)); m.setColorAt(k, cc); k++;
  }
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
}
function cropTick(dt, tc) {
  if (!crops) return; let dirty = false;
  for (const p of crops.patches) {
    if (p.gone) { p.regrow -= dt; if (p.regrow <= 0) { p.gone = false; p.burn = 0; dirty = true; } continue; }
    if (p.burn > 0) { p.burn += dt / 3; dirty = true; if (Math.random() < dt * 30) spawn(p.x + (Math.random() - 0.5) * 4, p.y + 0.3 + Math.random() * 0.8, p.z + (Math.random() - 0.5) * 3, 0, 1.5 + Math.random(), 0, 0.5, 1);
      if (p.burn >= 1) { p.gone = true; p.regrow = C.CROP_REGROW; R.stats.crops++; emit('crop', { x: p.x, z: p.z }); } }
  }
  if (dirty) layoutCrops(tc);
}

// ---------- the cone ----------
const nz = new THREE.Vector3(), fwd = new THREE.Vector3(), dir = { x: 0, y: 0, z: 1 };
function nozzle(tc) {
  tc.camera.getWorldDirection(fwd); C.aim(fwd.x, fwd.y, fwd.z, airborne(), dir);
  const p = tc.player; nz.set(p.x + dir.x * 0.7 - dir.z * 0.32, p.y - 0.7 + dir.y * 0.7, p.z + dir.z * 0.7 + dir.x * 0.32); return nz; // right hand, hip height
}
function emitFlame(dt, o) {
  const rate = isPhone() ? 75 : 120; R.acc = (R.acc || 0) + rate * dt; const ix = dir.x, iy = dir.y, iz = dir.z;
  while (R.acc >= 1) { R.acc -= 1; const sp = 15 + Math.random() * 3;
    spawn(o.x, o.y, o.z, ix * sp + (Math.random() - 0.5) * 4.4, iy * sp + (Math.random() - 0.5) * 2.6, iz * sp + (Math.random() - 0.5) * 4.4, 0.55 + Math.random() * 0.2, 0); }
}
function coneTick(tc, o) {
  const w = tc.world, ht = tc.height; if (!w || !ht) return;
  let n = 0;
  try { // colony folk (live ones only; the world keeps its own phone cap of 12)
    const ps = w.debug?.people?.() || [];
    for (const p of ps) { if (p.on === false || p.kind === 'contact') continue; if (C.coneHit(o.x, o.y, o.z, dir.x, dir.y, dir.z, p.x, ht(p.x, p.z) + 1.0, p.z) < 0) continue;
      bc.x = p.x + (tc.player.x - p.x) * 0.06; bc.z = p.z + (tc.player.z - p.z) * 0.06; w.blast?.(bc, 0.9, C.HIT_DMG); ignitePerson(p, tc); n++; }
  } catch (e) { warnOnce('people', e); }
  try { const ss = w.debug?.security?.() || []; for (const s of ss) { if (C.coneHit(o.x, o.y, o.z, dir.x, dir.y, dir.z, s.x, ht(s.x, s.z) + 1.0, s.z, C.RANGE, C.HALF_ANGLE, C.BASE_R, 0.6) < 0) continue; bc.x = s.x; bc.z = s.z; w.blast?.(bc, 1.0, C.HIT_DMG * 1.5); n++; } } catch (e) { warnOnce('security', e); }
  try { // vehicles: the real object is the nearest one to the player (the flame only reaches 8 m)
    const v = w.nearestVehicle?.(); if (v && !C.fireproof(v, tc.rover, tc.car) && !v.burnt && C.coneHit(o.x, o.y, o.z, dir.x, dir.y, dir.z, v.x, (v.y || ht(v.x, v.z)) + 0.8, v.z, C.RANGE, C.HALF_ANGLE, C.BASE_R, 1.4) >= 0) { igniteCar(v); n++; }
  } catch (e) { warnOnce('vehicles', e); }
  if (crops) for (const p of crops.patches) { if (p.gone || C.coneHit(o.x, o.y, o.z, dir.x, dir.y, dir.z, p.x, p.y + 0.5, p.z, C.RANGE, C.HALF_ANGLE, C.BASE_R, 2.2) < 0) continue; if (p.burn <= 0) p.burn = 0.01; R.lastHit = { type: 'crop', x: p.x, z: p.z }; n++; }
  R.stats.hits += n;
}
function report(tc) { try { tc.world?.shotFired?.(); R.stats.reports++; } catch (e) { warnOnce('wanted', e); } }
function stopFire() { if (R.firing) { R.firing = false; roarOn(false); emit('stop', { fuel: S.fuel }); } }

// ---------- HUD: 🔥 toggle + fuel bar, above FIRE ----------
let ui = null;
function buildUi() {
  if (ui || !document.body) return ui;
  const css = document.createElement('style'); css.id = 'flameCss';
  css.textContent = '#flameHud{position:fixed;z-index:8;right:calc(82px + var(--sar,0px));bottom:calc(108px + var(--sab,0px));width:78px;display:none;flex-direction:column;align-items:center;gap:4px;pointer-events:none}' +
    '#flameHud.show{display:flex} #flameBtn{pointer-events:auto;width:46px;height:46px;border-radius:50%;border:2px solid rgba(255,255,255,.6);background:rgba(10,8,6,.72);color:#fff;font-size:22px;line-height:1;padding:0;touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
    '#flameBtn.on{border-color:#ffb020;background:radial-gradient(circle at 40% 35%,#ff9a2e,#8a1c05);box-shadow:0 0 10px rgba(255,120,20,.7)}' +
    '#flameFuel{display:none;width:74px;height:12px;border-radius:6px;background:rgba(0,0,0,.75);border:1px solid rgba(255,255,255,.7);overflow:hidden;position:relative}' +
    '#flameHud.eq #flameFuel{display:block} #flameFuelI{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(90deg,#ff3d00,#ffb300);transform-origin:left center}' +
    '#flameFuel.low #flameFuelI{background:#ff1744} #flameFuelT{position:absolute;inset:0;font:800 9px/12px system-ui,sans-serif;color:#fff;text-align:center;text-shadow:0 0 2px #000}' +
    'body.cinematic #flameHud,body.hidehud #flameHud,body.indoors #flameHud,body.driving #flameHud,body:not(.surface) #flameHud,body:not(.touch) #flameBtn,body:has(#roverMenu.show) #flameHud,body:has(#shopPanel.show) #flameHud,body.hxMapOpen #flameHud{display:none!important}' +
    'body:not(.touch) #flameHud{right:calc(24px + var(--sar,0px));bottom:calc(24px + var(--sab,0px))}' +
    '@media (max-height:440px){#flameHud{right:calc(138px + var(--sar,0px));bottom:calc(90px + var(--sab,0px))}}' +
    'body.flamer #fireBtn{background:radial-gradient(circle at 40% 35%,#ff9a2e,#8a1c05)!important}';
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'flameHud';
  box.innerHTML = '<button id="flameBtn" type="button" aria-label="Flamethrower">🔥</button><div id="flameFuel" role="meter" aria-label="Flamer fuel"><div id="flameFuelI"></div><div id="flameFuelT">FUEL</div></div>';
  document.body.appendChild(box);
  const btn = box.querySelector('#flameBtn'), fn = () => { setEquip(!S.eq); toast(S.eq ? '🔥 Flamethrower in hand. Hold FIRE.' : 'Flamethrower stowed.', 1800); };
  if (typeof window.__onTap === 'function') window.__onTap(btn, fn); else btn.addEventListener('pointerup', e => { e.preventDefault(); fn(); });
  ui = { box, btn, fuel: box.querySelector('#flameFuel'), inner: box.querySelector('#flameFuelI'), txt: box.querySelector('#flameFuelT'), k: -1 };
  return ui;
}
let hudT = 0;
function hud(force) {
  if (!buildUi()) return;
  const show = owned() && !!R.tc, eq = S.eq && owned(), pct = C.fuelPct(S.fuel);
  const k = (show ? 1000 : 0) + (eq ? 500 : 0) + pct + (R.firing ? 200 : 0);
  if (!force && k === ui.k) return; ui.k = k;
  ui.box.classList.toggle('show', !!show); ui.box.classList.toggle('eq', eq); ui.btn.classList.toggle('on', eq);
  ui.inner.style.transform = `scaleX(${pct / 100})`; ui.txt.textContent = pct > 0 ? `FUEL ${pct}%` : 'EMPTY'; ui.fuel.classList.toggle('low', pct < 20);
  ui.fuel.setAttribute('aria-valuenow', String(pct)); document.body.classList.toggle('flamer', eq && !!show);
}

// ---------- per-frame ----------
function tick(dt, tc) {
  R.tc = tc; const g = tc.game; if (!g) return;
  ensureWraps(g);
  if (!points) makePoints();
  if (points.parent !== tc.scene) tc.scene.add(points);
  if (crops && crops.mesh.parent !== tc.scene) crops = null;
  if (!crops && tc.world?.colony && !R.cropTried) { R.cropTried = true; try { buildCrops(tc); } catch (e) { warnOnce('crops', e); } }
  // another gun picked (chip / wheel / shop) -> the flamer goes away
  if (S.eq && R.eqWeapon !== null && g.progress?.equip?.weapon !== R.eqWeapon) setEquip(false);
  const t = now(), held = (R.held && t - R.heldAt < 0.6) || t < R.tapUntil, can = wants() && held;
  let firing = false;
  if (can) {
    if (inPit()) { if (t - R.pitToast > 3) { R.pitToast = t; toast('🥊 Rust Pit rules: fists only.'); } }
    else if (S.fuel <= 0) { if (t - R.dryToast > 3) { R.dryToast = t; toast('⛽ Flamer tank empty. Buy fuel at a gun counter.'); try { const a = audio(); if (a) tone(a, out, 'square', 220, a.currentTime, 0.08, 0.05); } catch (e) { /* */ } } }
    else firing = true;
  }
  if (firing) {
    if (!R.firing) { R.firing = true; R.stats.shots++; R.hitT = 0; roarOn(true); if (t - R.reportT > 1) { R.reportT = t; report(tc); } emit('fire', { fuel: S.fuel }); }
    const f0 = S.fuel; S.fuel = C.burnFuel(S.fuel, dt, true); R.stats.fuelUsed += f0 - S.fuel;
    const o = nozzle(tc); emitFlame(dt, o);
    R.hitT -= dt; if (R.hitT <= 0) { R.hitT = C.HIT_EVERY; coneTick(tc, o); }
    if (t - R.reportT > C.REPORT_EVERY) { R.reportT = t; report(tc); }
    if (S.fuel <= 0) { save(); toast('⛽ Flamer tank empty.'); }
  } else if (R.firing) { stopFire(); save(); }
  burnTick(dt, tc); cropTick(dt, tc); stepParticles(dt);
  hudT -= dt; if (hudT <= 0 || firing) { hudT = 0.25; hud(false); }
  if (!R.scaleT || t - R.scaleT > 1) { R.scaleT = t; try { let cv = null; for (const c of document.getElementsByTagName('canvas')) if (!cv || c.width * c.height > cv.width * cv.height) cv = c; const fov = (tc.camera.fov || 60) * Math.PI / 180; pMat.uniforms.uScale.value = (cv?.height || window.innerHeight) / (2 * Math.tan(fov / 2)); } catch (e) { /* */ } }
}

// ---------- boot ----------
function boot() {
  const s = surf(); if (!s || typeof window.SSX?.registerSurfaceTick !== 'function') return false;
  if (R.surf === s) return true; R.surf = s;
  window.SSX.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { warnOnce('tick', e); } });
  try { if (s.game) ensureWraps(s.game); } catch (e) { /* */ }
  return true;
}
const API = {
  core: C, state: () => ({ owned: owned(), eq: S.eq && owned(), fuel: Math.round(S.fuel * 10) / 10, pct: C.fuelPct(S.fuel), firing: R.firing, live, cap: N,
    burning: slots.filter(s => s.on).map(s => ({ type: s.type, kind: s.type === 'v' ? s.ref?.kind : s.kind, fuse: s.type === 'v' ? Math.round(s.fuse * 10) / 10 : undefined, char: Math.round(s.char * 100) / 100 })),
    crops: crops ? crops.patches.map(p => ({ x: Math.round(p.x), z: Math.round(p.z), burn: Math.round(p.burn * 100) / 100, gone: p.gone })) : [], lastHit: R.lastHit, airborne: airborne(), stats: { ...R.stats } }),
  equip: on => { setEquip(on === undefined ? !S.eq : on); return S.eq; },
  on: fn => { subs.add(fn); return () => subs.delete(fn); },
  debug: {
    give: (fuel = C.TANK) => { S.owned = true; S.fuel = Math.max(0, Math.min(C.TANK, fuel)); save(); setEquip(true); return API.state(); },
    setFuel: f => { S.fuel = Math.max(0, Math.min(C.TANK, f)); save(); hud(true); return S.fuel; },
    reset: () => { S = C.fresh(); save(); stopFire(); hud(true); },
    hold: (s = 1) => { R.tapUntil = now() + s; }, // the same path as a tap on FIRE
    crops: () => crops, slots: () => slots.filter(s => s.on).length, parts: () => live
  }
};
window.SSX = window.SSX || {}; if (!window.SSX.flame) { window.SSX.flame = API; if (!boot()) { const iv = setInterval(() => { if (boot()) clearInterval(iv); }, 500); } else { const iv = setInterval(() => { boot(); }, 2000); setTimeout(() => clearInterval(iv), 60000); } }
