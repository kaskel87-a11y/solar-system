// Mars day/night cycle (window.SSX.time). One clock for the whole game: ~24 real minutes per game day, saved to
// localStorage (ssx.time.v1). Visuals (sun, ambient, sky, stars, neon) apply on the Mars surface only, never indoors.
// Night is dark and seedy: deep violet sky, cold low light, stars, neon signs and club fronts glow harder (colour boost +
// additive halo cards, no bloom pass, phone-safe). Gameplay: Chief of Staff's street-danger director reads its "Mars
// hour" from this clock (dangercore.setClock), so muggings, fights and gang chases climb at night; private security
// answers alarms with a thinner night-shift wave. SSX.time.crimeMultiplier() / copsMultiplier() are there for add-ons.
// One hook: a <script type="module"> line in index.html. See mars/TIME.md. Rules live in ./timecore.js.
import * as THREE from 'three';
import * as T from './timecore.js';
import * as DC from '../dangercore.js';

const app = () => window.__app, surf = () => app()?.surface;
const toast = (t, ms = 2600) => { try { app()?.toast?.(t, ms); } catch {} };
const warned = new Set(), warnOnce = (k, e) => { if (!warned.has(k)) { warned.add(k); console.warn('[time]', k, e); } };

// ---------- clock ----------
let boot = null; // where the clock started this session: 'save' | 'danger' | 'default'
let S = load(), last = performance.now(), lastPhase = T.phaseOf(S.h), lastNight = T.isNightAt(S.h), saveSlot = -1, stepping = false;
const listeners = { change: new Set(), night: new Set(), day: new Set() };
const stats = { phaseEvents: 0, thinned: 0, dangerSync: true, dangerYielded: false };
// first load (nothing saved): start from the street-danger director's Mars hour so both clocks agree from frame one
function load() {
  let raw = null; try { raw = JSON.parse(localStorage.getItem(T.SAVE_KEY) || 'null'); } catch {}
  if (raw && typeof raw === 'object') { boot = { from: 'save', h: T.sanitize(raw).h, at: Date.now() }; return T.sanitize(raw); }
  let h = T.DEFAULTS.h, from = 'default'; try { const m = DC.marsHour(); if (Number.isFinite(m)) { h = m; from = 'danger'; } } catch {}
  boot = { from, h, at: Date.now() }; return T.sanitize({ h });
}
function save() { try { localStorage.setItem(T.SAVE_KEY, JSON.stringify({ ...S, savedAt: Date.now() })); } catch {} }
function pump() {
  const now = performance.now(), dt = Math.min(5, (now - last) / 1000); last = now; // a background tab doesn't fast-forward the night
  if (dt > 0) { S.h = T.advance(S.h, dt, S.scale, S.frozen); check('tick'); }
}
function check(why) {
  if (stepping) return; stepping = true;
  try {
    const p = T.phaseOf(S.h), n = p === 'night';
    if (p !== lastPhase) {
      const d = { phase: p, prev: lastPhase, hour: S.h, night: n, why };
      lastPhase = p; stats.phaseEvents++;
      fire('change', d);
      if (n !== lastNight) { lastNight = n; fire(n ? 'night' : 'day', d); }
      try { window.SSX?.emit?.('time:phase', d); } catch (e) { warnOnce('emit', e); }
      try { window.dispatchEvent(new CustomEvent('time:phase', { detail: d })); } catch {}
      phaseToast(d); save();
    }
    const slot = Math.floor(S.h * 10); if (slot !== saveSlot) { saveSlot = slot; save(); }
  } finally { stepping = false; }
}
function fire(type, d) { for (const fn of [...listeners[type]]) { try { fn(d); } catch (e) { warnOnce('listener:' + type, e); } } }
function on(type, fn) { if (typeof type === 'function') { fn = type; type = 'change'; } const L = listeners[type]; if (!L || typeof fn !== 'function') throw new Error("SSX.time.on('change'|'night'|'day', fn)"); L.add(fn); return () => L.delete(fn); }
function set(h) {
  pump();
  if (typeof h === 'string') { if (h in T.PRESETS) h = T.PRESETS[h]; else if (T.WINDOWS[h]) h = T.WINDOWS[h][0]; else h = parseFloat(h); }
  if (!Number.isFinite(+h)) return false;
  S.h = T.wrap(+h); stats.dangerYielded = false; saveSlot = -1; check('set'); syncDanger(); return S.h;
}
function setScale(x) { pump(); if (!Number.isFinite(+x)) return false; S.scale = T.clamp(+x, 0, T.MAX_SCALE); save(); return S.scale; }
function freeze(b = true) { pump(); S.frozen = !!b; save(); return S.frozen; }

// ---------- street danger: CoS's director reads the hour from dangercore.marsHour(); we drive it ----------
// If someone else pins that clock (tests, __danger.setClock) we step back until SSX.time.set() is called again.
let pushed = null;
function syncDanger() {
  if (typeof DC.readHour === 'function') return; // v7.5.4 (#19): dangercore reads SSX.time.hour() itself, so no setClock push (that pinned the test clock every second)
  if (!stats.dangerSync || stats.dangerYielded || typeof DC.setClock !== 'function') return;
  try {
    if (pushed != null && Math.abs(DC.marsHour() - pushed) > 1e-6) { stats.dangerYielded = true; return; }
    DC.setClock(S.h); pushed = DC.marsHour();
  } catch (e) { warnOnce('danger', e); }
}
// ---------- fewer cops at night: private security sends a thinner wave (SSX.city.securityResponse) ----------
let inSec = false;
function wrapSecurity() {
  const city = window.SSX?.city; if (!city || typeof city.securityResponse !== 'function' || city.securityResponse.__time) return;
  const o = city.securityResponse;
  // re-entrancy guard: other add-ons (Director) wrap this too, so we may end up in the chain twice; thin a wave only once
  const f = (x, z, level = 2, opts) => { if (inSec) return o(x, z, level, opts); inSec = true;
    try { const k = T.copsMultiplier(S.h); if (k < 0.75 && level > 1) { level = Math.max(1, Math.round(level * k + 0.25)); stats.thinned++; } return o(x, z, level, opts); } finally { inSec = false; } };
  f.__time = true; f.__orig = o; for (const k in o) f[k] = o[k]; city.securityResponse = f;
}

// ---------- look (Mars surface, outdoors) ----------
let base = null, applied = false, stars = null, sunSprite = null, mobile = false, C = null;
const filters = new Set();
function capture(scene, dl) {
  let hemi = null, sky = null;
  for (const o of scene.children) if (o.isHemisphereLight && !hemi) hemi = o;
  scene.traverse(o => { if (!sky && o.isMesh && o.material?.uniforms?.top && o.material.uniforms.horizon) sky = o; });
  const skyGroup = sky?.parent || null; sunSprite = skyGroup?.children.find(c => c.isSprite && c.material?.blending === THREE.AdditiveBlending) || null;
  base = { scene, dl, hemi, sky, skyGroup, top: sky ? sky.material.uniforms.top.value.getHex() : 0xb07a4a, horizon: sky ? sky.material.uniforms.horizon.value.getHex() : 0xe2b483,
    light: dl.intensity, lightColor: dl.color.getHex(), dlPos: dl.position.clone(), hemiI: hemi?.intensity ?? 1, hemiC: hemi ? hemi.color.getHex() : null,
    bg: scene.background?.isColor ? scene.background.getHex() : null, fog: scene.fog?.color?.getHex?.() ?? null, sunPos: sunSprite ? sunSprite.position.clone() : null };
  stars = null; applied = false; neon.signs = []; neon.seen = new WeakSet(); neon.scanT = 0; neon.spill = null; neon.lamp = null;
}
function restore() {
  if (!base) return; const b = base, sc = b.scene;
  if (b.sky) { b.sky.material.uniforms.top.value.setHex(b.top); b.sky.material.uniforms.horizon.value.setHex(b.horizon); }
  b.dl.intensity = b.light; b.dl.color.setHex(b.lightColor); b.dl.position.copy(b.dlPos);
  if (b.hemi) { b.hemi.intensity = b.hemiI; if (b.hemiC != null) b.hemi.color.setHex(b.hemiC); }
  if (b.bg != null && sc.background?.isColor) sc.background.setHex(b.bg);
  if (b.fog != null && sc.fog?.color) sc.fog.color.setHex(b.fog);
  if (sunSprite && b.sunPos) { sunSprite.position.copy(b.sunPos); sunSprite.visible = true; }
  if (stars) stars.visible = false;
  setNeon(0, true);
  applied = false;
}
function makeStars() {
  const n = mobile ? 420 : 1200, p = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.randomDirection(); v.y = Math.abs(v.y) * 0.9 + 0.1; v.normalize().multiplyScalar(500); p.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff4ff, size: mobile ? 1.6 : 1.4, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0 }));
  m.renderOrder = -1; m.name = 'timeStars'; m.frustumCulled = false; return m;
}
const HEMI_NIGHT = 0x5a3c8c; // violet sodium-and-neon spill in the shadows
function apply(dt, ctx) {
  let L = T.look(S.h, { top: base.top, horizon: base.horizon, fog: base.fog ?? base.horizon, light: base.light, lightColor: base.lightColor, hemi: base.hemiI });
  for (const f of filters) { try { const r = f(L, ctx); if (r && typeof r === 'object') L = r; } catch (e) { warnOnce('filter', e); } }
  const b = base, sc = ctx.scene;
  if (b.sky) { b.sky.material.uniforms.top.value.setHex(L.top); b.sky.material.uniforms.horizon.value.setHex(L.horizon); }
  if (sc.background?.isColor) sc.background.setHex(L.horizon);
  if (sc.fog?.color) sc.fog.color.setHex(L.fog);
  b.dl.intensity = L.light; b.dl.color.setHex(L.lightColor); b.dl.position.set(L.dir.x * 100, L.dir.y * 100, L.dir.z * 100);
  if (b.hemi) { b.hemi.intensity = L.hemi; if (b.hemiC != null) b.hemi.color.setHex(T.mixHex(b.hemiC, HEMI_NIGHT, L.night * 0.7)); }
  if (sunSprite) { sunSprite.position.set(Math.cos(L.sunAngle) * 480, Math.max(-60, Math.sin(L.sunAngle) * 480), -0.55 * 480); sunSprite.visible = L.sunVisible !== false; }
  if (b.skyGroup) { if (L.stars > 0.01 && !stars) { stars = makeStars(); b.skyGroup.add(stars); } if (stars) { stars.visible = L.stars > 0.01; stars.material.opacity = L.stars; } }
  neonTick(dt, ctx, L.neon ?? L.night);
  applied = true; lastLook = L;
}
let lastLook = null;

// ---------- neon: signs get a colour boost + an additive halo card; club fronts throw a pink spill on the ground ----------
const neon = { signs: [], seen: new WeakSet(), scanT: 0, mats: new Map(), spill: null, lamp: null, level: 0 };
let haloTex = null, haloGeo = null, spillGeo = null;
function haloTexture() {
  if (haloTex) return haloTex;
  // a soft elliptical falloff on a 2:1 card
  const c2 = document.createElement('canvas'); c2.width = 128; c2.height = 64; const g2 = c2.getContext('2d'); g2.scale(1, 0.5);
  const r2 = g2.createRadialGradient(64, 64, 2, 64, 64, 64); r2.addColorStop(0, 'rgba(255,255,255,0.95)'); r2.addColorStop(0.4, 'rgba(255,255,255,0.4)'); r2.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = r2; g2.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c2); haloTex.colorSpace = THREE.SRGBColorSpace; haloTex.userData.shared = true; return haloTex;
}
function haloMat(hex, spill) {
  const k = hex + (spill ? ':s' : ''); let m = neon.mats.get(k); if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: hex, map: haloTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  m.userData.shared = true; neon.mats.set(k, m); return m;
}
function signColour(mat) {
  try { const img = mat.map?.image; if (img?.getContext) { const d = img.getContext('2d').getImageData(6, 64, 1, 1).data; if (d[0] + d[1] + d[2] > 60) return (d[0] << 16) | (d[1] << 8) | d[2]; } } catch {}
  return 0xff3cc8;
}
// neon signs (world.js addSign + Beltway billboards): unlit planes with a 512x128 neon canvas
const isSign = o => o.isMesh && o.material?.isMeshBasicMaterial && o.material.map?.image?.width === 512 && o.material.map.image.height === 128 && o.geometry?.type === 'PlaneGeometry' && !o.userData.timeHalo;
function scanSigns(scene) {
  if (!haloGeo) { haloGeo = new THREE.PlaneGeometry(1, 1); haloGeo.userData.shared = true; }
  scene.traverse(o => {
    if (neon.seen.has(o) || !isSign(o)) return; neon.seen.add(o);
    const p = o.geometry.parameters || { width: 6, height: 1.5 }, hex = signColour(o.material);
    const h = new THREE.Mesh(haloGeo, haloMat(hex)); h.userData.timeHalo = true; h.userData.shared = true; h.name = 'timeHalo';
    h.scale.set(p.width * 1.4, p.height * 2.4, 1); h.position.z = -0.03; h.renderOrder = 2; h.raycast = () => {}; o.add(h);
    neon.signs.push({ m: o, halo: h, c0: o.material.color.clone(), p: o.getWorldPosition(new THREE.Vector3()), near: true }); h.visible = neon.level > 0.02; o.material.color.multiplyScalar(1 + 0.55 * neon.level);
  });
  neon.signs = neon.signs.filter(s => s.m.parent);
}
function scanClubs(ctx) {
  if (neon.spill) return; const doors = ctx.world?.doorList?.() || []; if (!doors.length) return;
  if (!spillGeo) { spillGeo = new THREE.CircleGeometry(1, 24); spillGeo.rotateX(-Math.PI / 2); spillGeo.userData.shared = true; }
  const g = new THREE.Group(); g.name = 'timeNeonSpill';
  const COL = { club: 0xff2fb8, cantina: 0xff9a30, guns: 0xffd040 };
  for (const d of doors) { const c = COL[d.kind]; if (!c) continue; const y = (ctx.height?.(d.x, d.z) ?? 0) + 0.07, big = d.kind === 'club';
    const m = new THREE.Mesh(spillGeo, haloMat(c, true)); m.position.set(d.x, y, d.z + (big ? 1.2 : 0.6)); m.scale.set(big ? 7 : 4, 1, big ? 5 : 3); m.renderOrder = 1; m.raycast = () => {}; m.userData.shared = true; g.add(m);
    if (big) { const w = new THREE.Mesh(haloGeo, haloMat(c)); w.position.set(d.x, y + 1.6, d.z - 0.7); w.scale.set(5.5, 4.2, 1); w.raycast = () => {}; w.userData.shared = true; g.add(w); } }
  g.visible = neon.level > 0.02; ctx.scene.add(g); neon.spill = g;
}
function setNeon(n, force) {
  if (!force && Math.abs(n - neon.level) < 0.004) return; neon.level = n;
  for (const [k, m] of neon.mats) m.opacity = n * (k.endsWith(':s') ? 0.55 : 0.8);
  for (const s of neon.signs) { if (!s.m.material?.color) continue; s.m.material.color.copy(s.c0).multiplyScalar(1 + 0.55 * n); s.halo.visible = n > 0.02 && s.near; }
  if (neon.spill) neon.spill.visible = n > 0.02;
}
function neonTick(dt, ctx, n) {
  neon.scanT -= dt; if (neon.scanT <= 0) { neon.scanT = 2.5; try { scanSigns(ctx.scene); scanClubs(ctx); } catch (e) { warnOnce('neon', e); } }
  // halos only near the camera (fog eats the rest anyway): fewer additive quads = less overdraw on phones
  neon.cullT = (neon.cullT || 0) - dt; if (neon.cullT <= 0 && ctx.camera) { neon.cullT = 0.5; const c = ctx.camera.position, r2 = (mobile ? 70 : 110) ** 2;
    for (const s of neon.signs) { const near = (s.p.x - c.x) ** 2 + (s.p.z - c.z) ** 2 < r2; if (near !== s.near) { s.near = near; s.halo.visible = near && neon.level > 0.02; } } neon.halosNear = neon.signs.filter(s => s.near).length; }
  setNeon(n);
  // the one colony light (world.js resets it every frame) burns a little hotter over the strip at night
  try { let pl = neon.lamp; if (!pl || pl.parent !== ctx.scene) { pl = neon.lamp = ctx.scene.children.find(o => o.isPointLight) || null; neon.lampSet = null; }
    if (pl) { const raw = neon.lampSet != null && Math.abs(pl.intensity - neon.lampSet) < 1e-6 ? neon.lampRaw : pl.intensity; neon.lampRaw = raw; pl.intensity = raw * (1 + 0.6 * n); neon.lampSet = pl.intensity; } } catch (e) { warnOnce('lamp', e); }
}

// ---------- frame ----------
function tick(dt, ctx) {
  C = ctx; mobile = !!ctx.isMobile; pump(); syncDanger(); wrapSecurity();
  const scene = ctx.scene; if (!scene) return;
  if (!base || base.scene !== scene || base.dl.parent !== scene) { const dl = scene.children.find(o => o.isDirectionalLight); if (!dl) return; capture(scene, dl); }
  const onMars = ctx.name === 'Mars', indoor = !!ctx.world?.inside;
  if (!onMars || indoor) { if (applied) restore(); return; }
  try { apply(dt, ctx); } catch (e) { warnOnce('look', e); }
  if (menuBtn) { const k = Math.floor(S.h * 4); if (k !== menuSlot) { menuSlot = k; menuBtn.textContent = menuLabel(); } }
}

// ---------- ☰ clock: read the time, wait for dark / sunrise ----------
let menuBtn = null, menuSlot = -1;
const ICON = { dawn: '🌅', day: '☀️', dusk: '🌆', night: '🌙' };
const menuLabel = () => `${ICON[T.phaseOf(S.h)]} Mars ${T.hhmm(S.h)}`;
async function openClock() {
  pump(); const p = T.phaseOf(S.h), w = surf()?.world?.wanted || 0;
  const txt = `${ICON[p]} ${T.hhmm(S.h)}, ${p}. ${p === 'night' ? 'ColSec is on the skeleton shift and the dust crews own the streets.' : `Dark in ${Math.round(T.secondsToNight(S.h, S.scale) / 60)} real min.`}${S.frozen ? ' (Clock frozen.)' : ''}`;
  const opts = []; if (p !== 'night') opts.push({ id: 'night', label: '🌙 Kill time until dark (21:00)' }); if (p !== 'day') opts.push({ id: 'day', label: '🌅 Sleep it off until morning (08:00)' });
  let pick = null; try { pick = await window.SSX.city.choice(txt, opts); } catch (e) { warnOnce('choice', e); return; }
  if (!pick) return;
  if (w > 0) { toast('🚨 Nobody naps with ColSec on their ass. Lose the heat first.', 2600); return; }
  set(pick === 'night' ? T.NIGHT_START : 8); toast(pick === 'night' ? '🌙 You kill a few hours. The neon\u2019s on.' : '🌅 You wake up with a dry mouth and the sun in your eyes.', 2600);
}
const lastToast = { t: 0 };
function phaseToast(d) {
  const s = surf(); if (!s?.info || s.info.name !== 'Mars' || s.info.inside || d.why === 'set') return;
  if (performance.now() - lastToast.t < 20000) return; lastToast.t = performance.now();
  const m = { night: '🌙 Night falls on the colony. ColSec runs a skeleton shift, and the junkies come out.', dawn: '🌅 Sunrise over Jezero. Day shift clocks in.', dusk: '🌆 Blue Mars dusk. The neon flickers on.' }[d.phase];
  if (m) toast(m, 3000);
}

// ---------- public API ----------
const API = {
  version: 1,
  now: () => { pump(); return S.h; },
  hour: () => { pump(); return S.h; }, // alias of now(): float game hour in [0, 24)
  isNight: () => { pump(); return T.isNightAt(S.h); },
  phase: () => { pump(); return T.phaseOf(S.h); },
  nightness: () => { pump(); return T.nightness(S.h); },
  on, set, setScale, freeze,
  get scale() { return S.scale; }, get frozen() { return S.frozen; },
  state: () => { pump(); return { hour: S.h, phase: T.phaseOf(S.h), night: T.isNightAt(S.h), scale: S.scale, frozen: S.frozen, dayMinutes: T.DAY_MIN / (S.scale || 1e-9), crime: T.crimeMultiplier(S.h), cops: T.copsMultiplier(S.h) }; },
  crimeMultiplier: h => T.crimeMultiplier(h ?? API.now()),
  copsMultiplier: h => T.copsMultiplier(h ?? API.now()),
  secondsToNight: () => { pump(); return T.secondsToNight(S.h, S.frozen ? 0 : S.scale); },
  format: h => T.hhmm(h ?? API.now()),
  look: () => lastLook ? { ...lastLook } : null,
  addLookFilter(fn) { if (typeof fn !== 'function') throw new Error('addLookFilter(fn(look, ctx) -> look)'); filters.add(fn); return () => filters.delete(fn); },
  syncDanger(onOff) { stats.dangerSync = !!onOff; if (onOff) { stats.dangerYielded = false; pushed = null; syncDanger(); } else { pushed = null; } return stats.dangerSync; },
  PHASES: T.PHASES, NIGHT_START: T.NIGHT_START, NIGHT_END: T.NIGHT_END, WINDOWS: T.WINDOWS, PRESETS: T.PRESETS, DAY_MIN: T.DAY_MIN
};
window.__time = {
  get S() { return { ...S }; }, get stats() { return { ...stats }; }, get applied() { return applied; }, get base() { return base && { top: base.top, horizon: base.horizon, light: base.light, hemi: base.hemiI }; },
  get light() { return base ? { i: base.dl.intensity, c: base.dl.color.getHex(), hemi: base.hemi?.intensity ?? null } : null; },
  get sky() { return base?.sky ? { top: base.sky.material.uniforms.top.value.getHex(), horizon: base.sky.material.uniforms.horizon.value.getHex() } : null; },
  get stars() { return stars ? { visible: stars.visible, opacity: stars.material.opacity, n: stars.geometry.attributes.position.count } : null; },
  get neon() { return { level: neon.level, signs: neon.signs.length, halos: neon.signs.filter(s => s.halo.visible).length, near: neon.signs.filter(s => s.near).length, spill: neon.spill ? neon.spill.children.length : 0, spillOn: !!neon.spill?.visible, lamp: neon.lamp?.intensity ?? null, sample: neon.signs[0] ? neon.signs[0].m.material.color.r : null }; },
  get boot() { return { ...boot }; }, dangerHour: () => DC.marsHour(), filters: () => filters.size, openClock
};

(function boot() {
  const X = window.SSX;
  if (!X || !window.__app || typeof X.registerSurfaceTick !== 'function') { setTimeout(boot, 200); return; }
  if (X.time) { console.warn('[time] SSX.time already present; not installing a second copy'); return; }
  X.time = API;
  try { menuBtn = X.registerMenuItem({ id: 'timeMenuBtn', label: menuLabel(), onTap: () => openClock() }); } catch (e) { warnOnce('menu', e); }
  X.registerSurfaceTick(tick);
  setInterval(() => { pump(); syncDanger(); }, 1000); // keeps the clock and phase events going in space / menus too
  addEventListener('pagehide', () => { pump(); save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pump(); save(); } else last = performance.now(); });
  wrapSecurity(); syncDanger();
  try { X.emit?.('time:ready', API.state()); } catch {}
})();
