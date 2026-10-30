// Director mode (Mars sandbox): ☰ → 🎬 Director. Dust storms, time of day, no cops, NPC density, invincibility,
// unlimited ammo and a vehicle picker. Saved to localStorage (ssx.director.v1). While any cheat is on, a small DIRECTOR
// tag shows in the HUD stack and mission rewards are withheld (quest payouts are clawed back, game.reward pays nothing).
// One hook: a <script type="module"> line in index.html. Everything else is feature-detected (SSX.registerSurfaceTick,
// SSX.registerMenuItem, SSX.danger, SSX.garage, SSX.city.securityResponse). Rules live in ./directorcore.js.
// Time of day: when the Mars day/night cycle is loaded (mars/time.js, window.SSX.time) it is the single source of truth.
// The time controls here just call SSX.time.set / setScale / freeze, and the dust storm tints its look through
// SSX.time.addLookFilter. Without SSX.time, Director falls back to its own time-of-day overlay (S.tod).
import * as THREE from 'three';
import { VEHICLES } from '../world.js';
import * as D from './directorcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game, world = () => surf()?.world;
const TT = () => { const t = window.SSX?.time; return t && typeof t.set === 'function' && typeof t.now === 'function' ? t : null; };
const isTouch = () => matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
let S = load(); const session = { vehicle: false, clawed: 0, blocked: 0 };
let C = null, clock = 0, mobile = false, warned = new Set();
const warnOnce = (k, e) => { if (!warned.has(k)) { warned.add(k); console.warn('[director]', k, e); } };

function load() { try { return D.sanitize(JSON.parse(localStorage.getItem(D.SAVE_KEY) || 'null')); } catch { return D.sanitize(null); } }
function save() { try { localStorage.setItem(D.SAVE_KEY, JSON.stringify(S)); } catch {} changed(); }
function changed() { updateTag(); render(); try { window.SSX?.emit?.('director:change', { ...S, cheats: cheats(), rewardsBlocked: blocked() }); } catch {} try { window.SSX?.danger?.setCops?.(!S.noCops); } catch {} }
const cheats = () => D.activeCheats(S, session), blocked = () => D.rewardsBlocked(S, session);
const toast = (t, ms = 2400) => { try { app()?.toast?.(t, ms); } catch {} };

// ---------- look: time of day + dust storm (Mars only, outdoors) ----------
let fogPull = null; const fogHooked = new WeakSet();
function hookFog(scene) { if (fogHooked.has(scene)) return; fogHooked.add(scene); const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) { if (typeof prev === 'function') prev.apply(this, a); pullFog(scene.fog); }; }
function pullFog(f) { const P = fogPull; if (P && f && !f.isFogExp2) { f.near = Math.min(f.near, f.near + (P.near - f.near) * P.f); f.far = Math.min(f.far, f.far + (P.far - f.far) * P.f); } }
let base = null, baseFogObj = null, applied = false, stormFade = 0, stars = null, dust = null, sunSprite = null;
const tmpC = new THREE.Color();
function capture(scene) {
  let dl = null, hemi = null, sky = null;
  for (const o of scene.children) { if (o.isDirectionalLight && !dl) dl = o; else if (o.isHemisphereLight && !hemi) hemi = o; }
  scene.traverse(o => { if (!sky && o.isMesh && o.material?.uniforms?.top && o.material.uniforms.horizon) sky = o; });
  const skyGroup = sky?.parent || null; sunSprite = skyGroup?.children.find(c => c.isSprite && c.material?.blending === THREE.AdditiveBlending) || null;
  base = { dl, hemi, sky, skyGroup, top: sky ? sky.material.uniforms.top.value.getHex() : 0x8a4a14, horizon: sky ? sky.material.uniforms.horizon.value.getHex() : 0xe0a050,
    light: dl?.intensity ?? 1.7, lightColor: dl ? dl.color.getHex() : 0xffb070, dlPos: dl ? dl.position.clone() : null, hemiI: hemi?.intensity ?? 0.9,
    bg: scene.background?.isColor ? scene.background.getHex() : null, fogColor: scene.fog?.color?.getHex?.() ?? null, sunPos: sunSprite ? sunSprite.position.clone() : null };
  baseFogObj = scene.fog; stars = null; dust = null; applied = false;
}
function restore(scene) {
  if (!base) return;
  if (base.sky) { base.sky.material.uniforms.top.value.setHex(base.top); base.sky.material.uniforms.horizon.value.setHex(base.horizon); }
  if (base.dl) { base.dl.intensity = base.light; base.dl.color.setHex(base.lightColor); if (base.dlPos) base.dl.position.copy(base.dlPos); }
  if (base.hemi) base.hemi.intensity = base.hemiI;
  if (base.bg != null && scene.background?.isColor) scene.background.setHex(base.bg);
  if (base.fogColor != null && scene.fog?.color) scene.fog.color.setHex(base.fogColor);
  if (sunSprite && base.sunPos) { sunSprite.position.copy(base.sunPos); sunSprite.visible = true; }
  if (stars) stars.visible = false; if (dust) dust.visible = false;
  applied = false;
}
function makeStars() {
  const n = mobile ? 400 : 1200, p = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.randomDirection(); v.y = Math.abs(v.y) * 0.9 + 0.1; v.normalize().multiplyScalar(500); p.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0 }));
  m.renderOrder = -1; m.name = 'directorStars'; return m;
}
// v7.5.5 storm perf: one Points cloud built ONCE per visit (sized for 'heavy'); grains move in the vertex shader (no per-frame
// CPU loop or buffer upload), sizes are clamped on screen (phones 10 px) and the drawn count follows the level and
// SSX.stormGuard's density (setDrawRange: no rebuild, no new shader when the level changes). Prewarmed on landing.
const DUST_VS = `attribute float rnd; uniform vec3 uCam; uniform vec3 uBox; uniform vec3 uOff; uniform float uTime; uniform float uSize; uniform float uPx; uniform float uMaxPx; uniform float uOpacity;
varying float vA;
void main() {
  vec3 p = position * uBox + uOff * (0.7 + 0.56 * rnd) + vec3(0.0, -uTime * (0.4 + 0.6 * rnd), 0.0);
  vec3 l = mod(p - uCam, uBox) - uBox * 0.5; l.y += uBox.y * 0.1; vec3 w = uCam + l;
  vec4 mv = viewMatrix * vec4(w, 1.0); float z = max(0.3, -mv.z);
  vA = uOpacity * smoothstep(0.8, 2.5, z) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, length(l.xz)));
  gl_PointSize = vA < 0.01 ? 0.0 : clamp(uSize * uPx / z, 1.0, uMaxPx);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FS = `uniform vec3 uColor; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c) * 4.0; if (d > 1.0) discard; gl_FragColor = vec4(uColor, vA * (1.0 - d) * (1.0 - d));
#include <colorspace_fragment>
}`;
const BOX = 44, BOX_H = 16;
const guard = () => window.SSX?.stormGuard || null;
function makeDust(scene) {
  if (dust) { if (dust.parent !== scene) scene.add(dust); return dust; }
  const n = D.stormParams('heavy', mobile).count, pos = new Float32Array(n * 3), rnd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random(); rnd[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const m = new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, fog: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(BOX, BOX_H, BOX) }, uOff: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSize: { value: 0.4 },
      uPx: { value: 600 }, uMaxPx: { value: D.dustMaxPx(mobile) }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xd7a070) } } });
  dust = new THREE.Points(g, m); dust.frustumCulled = false; dust.renderOrder = 5; dust.name = 'directorDust'; dust.visible = false; dust.userData.n = n; dust.userData.level = 'heavy';
  scene.add(dust); try { guard()?.prewarm?.(dust); } catch (e) { warnOnce('prewarm', e); }
  return dust;
}
const dustOff = new THREE.Vector3();
function updateDust(dt, cam, p, fade) {
  if (!dust) return; dust.visible = fade > 0.02 && p.count > 0; if (!dust.visible) return;
  const U = dust.material.uniforms, w = D.windAt(clock, S.storm), k = guard()?.density?.() ?? 1;
  dust.geometry.setDrawRange(0, Math.min(dust.userData.n, D.dustDraw(p.count, k)));
  dustOff.x += w.x * dt; dustOff.z += w.z * dt; U.uOff.value.copy(dustOff); U.uTime.value += dt; U.uCam.value.copy(cam.position);
  const r = app()?.renderer; let pr = 1; try { pr = r?.getPixelRatio?.() || 1; } catch { /* */ }
  U.uPx.value = innerHeight * pr * 0.5 * cam.projectionMatrix.elements[5]; U.uSize.value = p.size; U.uOpacity.value = p.opacity * fade;
}
// with SSX.time: the clock and lighting are its job; we only tint its look for storms, pull the fog in and run the dust
let filterOff = null;
function stormFilter(L) {
  if (stormFade <= 0 || C?.name !== 'Mars' || C?.world?.inside) return L;
  const sp = D.stormParams(S.storm === 'off' ? (dust?.userData.last || 'light') : S.storm, mobile), mix = sp.mix * stormFade;
  const dustCol = D.mixHex(D.STORM_COLOR, 0x2a1a14, 1 - (L.day ?? 1));
  return { ...L, top: D.mixHex(L.top, dustCol, mix), horizon: D.mixHex(L.horizon, dustCol, Math.min(1, mix * 1.15)), fog: D.mixHex(L.fog ?? L.horizon, dustCol, Math.min(1, mix * 1.15)),
    light: L.light * (1 - 0.5 * mix), hemi: L.hemi * (1 - 0.25 * mix), sunVisible: L.sunVisible !== false && mix < 0.6, stars: (L.stars || 0) * (1 - mix), storm: mix };
}
function lookShared(dt, ctx, T) {
  const scene = ctx.scene; if (!scene) return;
  if (!filterOff) { try { filterOff = T.addLookFilter(stormFilter); } catch (e) { warnOnce('filter', e); } }
  if (applied && base) restore(scene); // hand back anything the fallback overlay changed before SSX.time showed up
  if (scene.fog !== baseFogObj || !base) capture(scene);
  const onMars = ctx.name === 'Mars', indoor = !!ctx.world?.inside, p = D.stormParams(onMars ? S.storm : 'off', mobile);
  if (onMars && !indoor && !dust) makeDust(scene); // built + prewarmed on landing, hidden: a storm starting later costs no frame
  stormFade = D.clamp(stormFade + (p.count ? dt / 2.5 : -dt / 1.5), 0, 1);
  if (stormFade <= 0) { fogPull = null; if (dust) dust.visible = false; return; }
  const sp = D.stormParams(S.storm === 'off' ? (dust?.userData.last || 'light') : S.storm, mobile), mix = sp.mix * stormFade;
  if (scene.fog && !scene.fog.isFogExp2 && !indoor && mix > 0) { scene.fog.near = Math.min(scene.fog.near, scene.fog.near + (sp.near - scene.fog.near) * stormFade); scene.fog.far = Math.min(scene.fog.far, scene.fog.far + (sp.far - scene.fog.far) * stormFade); }
  else if (scene.fog?.isFogExp2 && !indoor && mix > 0) scene.fog.density = Math.max(scene.fog.density, 0.05 * mix);
  fogPull = !indoor && mix > 0 ? { near: sp.near, far: sp.far, f: stormFade } : null; hookFog(scene); // re-applied right before render (time.js / street looks write fog after add-on ticks)
  if (S.storm !== 'off') { makeDust(scene); dust.userData.last = S.storm; }
  if (dust) { if (indoor) dust.visible = false; else updateDust(dt, ctx.camera, sp, stormFade); }
}
function look(dt, ctx) {
  const T = TT(); if (T) return lookShared(dt, ctx, T);
  const scene = ctx.scene; if (!scene) return;
  if (scene.fog !== baseFogObj || !base) capture(scene);
  const onMars = ctx.name === 'Mars', indoor = !!ctx.world?.inside;
  if (onMars && !indoor && !dust) makeDust(scene);
  const wantTod = onMars && S.tod != null, p = D.stormParams(onMars ? S.storm : 'off', mobile);
  stormFade = D.clamp(stormFade + (p.count ? dt / 2.5 : -dt / 1.5), 0, 1);
  if (!wantTod && stormFade <= 0) { fogPull = null; if (applied) restore(scene); return; }
  applied = true;
  const L = wantTod ? D.todLook(S.tod, { top: base.top, horizon: base.horizon, light: base.light, lightColor: base.lightColor, hemi: base.hemiI })
    : { top: base.top, horizon: base.horizon, fog: base.fogColor ?? base.horizon, light: base.light, lightColor: base.lightColor, hemi: base.hemiI, dir: null, sunVisible: true, stars: 0, day: 1 };
  const sp = D.stormParams(S.storm === 'off' ? (dust?.userData.last || 'light') : S.storm, mobile), mix = sp.mix * stormFade;
  const dustCol = D.mixHex(D.STORM_COLOR, 0x2a1a14, 1 - (L.day ?? 1)); // storms go dark brown at night
  const top = D.mixHex(L.top, dustCol, mix), hor = D.mixHex(L.horizon, dustCol, Math.min(1, mix * 1.15)), fogC = D.mixHex(L.fog ?? L.horizon, dustCol, Math.min(1, mix * 1.15));
  if (base.sky) { base.sky.material.uniforms.top.value.setHex(top); base.sky.material.uniforms.horizon.value.setHex(hor); }
  if (scene.background?.isColor) scene.background.setHex(hor);
  if (scene.fog?.color && !indoor) scene.fog.color.setHex(fogC);
  if (base.dl) { base.dl.intensity = L.light * (1 - 0.5 * mix); base.dl.color.setHex(L.lightColor); if (L.dir) base.dl.position.set(L.dir.x * 100, L.dir.y * 100, L.dir.z * 100); else if (base.dlPos) base.dl.position.copy(base.dlPos); }
  if (base.hemi) base.hemi.intensity = L.hemi * (1 - 0.25 * mix);
  if (sunSprite) { if (L.dir && wantTod) { const a = ((S.tod - 6) / 12) * Math.PI; sunSprite.position.set(Math.cos(a) * 480, Math.sin(a) * 480, -0.55 * 480); } else if (base.sunPos) sunSprite.position.copy(base.sunPos); sunSprite.visible = (L.sunVisible !== false) && mix < 0.6; }
  if (base.skyGroup && wantTod) { if (!stars) { stars = makeStars(); base.skyGroup.add(stars); } stars.visible = L.stars > 0.01; stars.material.opacity = L.stars * (1 - mix); } else if (stars) stars.visible = false;
  // fog: surface.js rewrites near/far every frame before add-on ticks, so we only ever pull them in
  if (scene.fog && !scene.fog.isFogExp2 && !indoor && mix > 0) { scene.fog.near = Math.min(scene.fog.near, scene.fog.near + (sp.near - scene.fog.near) * stormFade); scene.fog.far = Math.min(scene.fog.far, scene.fog.far + (sp.far - scene.fog.far) * stormFade); }
  else if (scene.fog?.isFogExp2 && !indoor && mix > 0) scene.fog.density = Math.max(scene.fog.density, 0.05 * mix);
  fogPull = !indoor && mix > 0 ? { near: sp.near, far: sp.far, f: stormFade } : null; hookFog(scene); // re-applied right before render (time.js / street looks write fog after add-on ticks)
  if (S.storm !== 'off') { makeDust(scene); dust.userData.last = S.storm; }
  if (dust) { if (indoor) dust.visible = false; else updateDust(dt, ctx.camera, sp, stormFade); }
}

// ---------- cheats ----------
let secT = 0, ammoKeep = null, densityRes = -1, wrapped = false;
function cheatTick(dt, ctx) {
  const g = ctx.game, w = ctx.world; if (!g || !w) return;
  if (S.noCops) {
    try { if ((w.wanted || 0) > 0) w.setWanted(0, 'director'); } catch (e) { warnOnce('setWanted', e); }
    secT -= dt; if (secT <= 0) { secT = 0.5; try { if ((w.securityList?.() || []).length) w.onRespawn?.(); } catch (e) { warnOnce('recall', e); } }
  }
  if (S.invincible) { try { const H = g.debug?.H?.(); if (H) { H.inv = Math.max(H.inv, 0.5); H.hp = Math.max(H.hp, H.max); H.shield = Math.max(H.shield, H.smax); } } catch (e) { warnOnce('inv', e); } }
  if (S.ammo) {
    try { const P = g.progress; if (P?.inv) { if (!ammoKeep) ammoKeep = { shells: Math.max(24, P.inv.shells || 0), rounds: Math.max(60, P.inv.rounds || 0), slugs: Math.max(6, P.inv.slugs || 0), grenades: Math.max(4, P.inv.grenades || 0) };
      for (const k in ammoKeep) if ((P.inv[k] || 0) < ammoKeep[k]) P.inv[k] = ammoKeep[k]; } g.debug?.cool?.(); } catch (e) { warnOnce('ammo', e); }
  } else ammoKeep = null;
  const cap = w.npcBudget?.().cap ?? (mobile ? D.PHONE_CAP : 40), want = D.densityReserve(S.density, cap, mobile);
  if (want !== densityRes) { try { w.npcReserve?.('director', want); densityRes = want; } catch (e) { warnOnce('density', e); } }
  if (!wrapped) wrapGame(g);
}
// rewards: core quests pay through game.gain (internal), so a done quest is clawed back from its own event; add-ons that pay
// through game.reward(xp, cr) get nothing while a cheat is on.
function wrapGame(g) {
  wrapped = true;
  const orig = g.reward;
  if (typeof orig === 'function' && !orig.__director) { const f = function (xp = 0, cr = 0) { if (blocked() && (xp > 0 || cr > 0)) { session.blocked++; toast('🎬 Director cheats on: no payout.'); return; } return orig.call(this, xp, cr); }; f.__director = true; g.reward = f; }
  const city = window.SSX?.city;
  if (city && typeof city.securityResponse === 'function' && !city.securityResponse.__director) { const o = city.securityResponse; const f = (...a) => S.noCops ? null : o(...a); f.__director = true; city.securityResponse = f; }
}
function onQuest(ev) {
  if (!ev || ev.kind !== 'done' || !blocked()) return;
  const g = game(), P = g?.progress; if (!P) return;
  const cr = ev.credits || 0, xp = ev.xp || 0; if (!cr && !xp) return;
  P.credits = Math.max(0, P.credits - cr); P.xp = Math.max(0, P.xp - xp); session.clawed += cr; try { g.save?.(); } catch {}
  setTimeout(() => toast(`🎬 Director cheats on: "${ev.title || 'mission'}" paid nothing (−${cr} cr).`, 3200), 400);
}

// ---------- vehicles ----------
function vehicleList() { return Object.entries(VEHICLES).map(([id, v]) => ({ id, name: v.name || id })); }
function spawnVehicle(id) {
  const G = window.SSX?.garage, s = surf();
  if (!s?.info) return { ok: false, why: 'Land first.' };
  if (s.info.name !== 'Mars') return { ok: false, why: 'Mars only.' };
  let r = null;
  if (typeof G?.grantVehicle === 'function') { try { r = G.grantVehicle(id, { source: 'director', spawn: true, near: true }); } catch (e) { r = { ok: false, why: e.message }; } if (r === true) r = { ok: true }; if (r && r.ok === undefined) r.ok = true; }
  else if (id === 'rover') r = s.summonRover?.() || { ok: false };
  else return { ok: false, why: 'Needs the garage add-on (SSX.garage).' };
  if (r?.ok) { session.vehicle = true; changed(); }
  return r || { ok: false };
}
const canSpawn = id => typeof window.SSX?.garage?.grantVehicle === 'function' || id === 'rover';

// ---------- UI ----------
let panel = null, tag = null;
function css() {
  if (document.getElementById('dirCss')) return;
  const st = document.createElement('style'); st.id = 'dirCss';
  st.textContent = `
  #dirPanel { position: fixed; z-index: 14; inset: calc(8px + var(--sat, 0px)) calc(8px + var(--sar, 0px)) calc(8px + var(--sab, 0px)) calc(8px + var(--sal, 0px)); max-width: 520px; margin: 0 auto; display: none; flex-direction: column;
    background: #05060a; color: #fff; border: 2px solid #ffd23f; border-radius: 14px; font: 15px/1.3 system-ui, sans-serif; overflow: hidden; touch-action: manipulation; }
  #dirPanel.on { display: flex; }
  #dirPanel .hd { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #ffd23f; color: #000; font-weight: 800; letter-spacing: .04em; }
  #dirPanel .hd span { flex: 1; } #dirPanel .bd { overflow-y: auto; padding: 8px 12px 14px; -webkit-overflow-scrolling: touch; }
  #dirPanel h3 { margin: 14px 0 6px; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #ffd23f; }
  #dirPanel .row { display: flex; flex-wrap: wrap; gap: 6px; }
  #dirPanel button { min-height: 48px; min-width: 48px; padding: 0 14px; border-radius: 10px; border: 2px solid #fff; background: #111; color: #fff; font: 700 15px system-ui, sans-serif; flex: 1 1 0; touch-action: manipulation; }
  #dirPanel button.on { background: #ffd23f; color: #000; border-color: #ffd23f; }
  #dirPanel button:disabled { opacity: .4; }
  #dirPanel .hd button { flex: 0 0 auto; background: #000; color: #ffd23f; border-color: #000; }
  #dirPanel input[type=range] { width: 100%; height: 44px; accent-color: #ffd23f; }
  #dirPanel .note { color: #cfd3dc; font-size: 13px; margin: 6px 0 0; } #dirPanel .warn { color: #ff8a8a; font-weight: 700; }
  #dirPanel .val { font-variant-numeric: tabular-nums; color: #ffd23f; font-weight: 800; }
  #dirTag { display: none; padding: 3px 8px; border-radius: 6px; background: #ffd23f; color: #000; font: 800 11px/1.2 system-ui, sans-serif; letter-spacing: .12em; pointer-events: none !important; }
  #dirTag.on { display: block; }`;
  document.head.appendChild(st);
}
function tap(el, fn) { // pointer events with a click fallback (keyboard / desktop), no ghost double-fire
  let pid = null, last = 0;
  el.addEventListener('pointerdown', e => { pid = e.pointerId; });
  el.addEventListener('pointerup', e => { if (e.pointerId !== pid) return; pid = null; last = performance.now(); e.preventDefault(); fn(e); });
  el.addEventListener('pointercancel', () => { pid = null; });
  el.addEventListener('click', e => { if (performance.now() - last < 600) return; fn(e); });
}
const hh = h => { const m = Math.round(h * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
function ui() {
  css();
  panel = document.createElement('div'); panel.id = 'dirPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Director mode');
  panel.innerHTML = `<div class="hd"><span>🎬 DIRECTOR MODE</span><button data-a="close" aria-label="Close">✕ Close</button></div><div class="bd"></div>`;
  ['pointerdown', 'pointerup', 'touchstart', 'wheel'].forEach(t => panel.addEventListener(t, e => e.stopPropagation(), { passive: true }));
  document.body.appendChild(panel);
  panel.addEventListener('pointerup', () => {}, true);
  tap(panel.querySelector('[data-a=close]'), close);
  tag = document.createElement('div'); tag.id = 'dirTag'; tag.textContent = '🎬 DIRECTOR'; tag.setAttribute('aria-label', 'Director cheats active');
  placeTag(); updateTag();
}
function placeTag() { const st = document.getElementById('stackR'); if (st && tag.parentNode !== st) st.prepend(tag); else if (!st && !tag.parentNode) document.body.appendChild(tag); }
function updateTag() { if (!tag) return; placeTag(); tag.classList.toggle('on', cheats().length > 0 && !!surf()?.info); }
function seg(label, opts, cur, fn, id) {
  const r = document.createElement('div'); r.className = 'row'; if (id) r.dataset.k = id;
  for (const [v, t] of opts) { const b = document.createElement('button'); b.textContent = t; b.dataset.v = String(v); if (String(v) === String(cur)) b.classList.add('on'); b.setAttribute('aria-pressed', String(String(v) === String(cur))); tap(b, () => fn(v)); r.appendChild(b); }
  return r;
}
function toggle(k, label) { return seg(label, [[false, 'Off'], [true, 'On']], S[k], v => { S[k] = v; save(); }, k); }
function render() {
  if (!panel || !panel.classList.contains('on')) return;
  const bd = panel.querySelector('.bd'), onMars = surf()?.info?.name === 'Mars', y = bd.scrollTop; bd.innerHTML = '';
  const h = t => { const e = document.createElement('h3'); e.textContent = t; bd.appendChild(e); }, note = (t, cls = 'note') => { const e = document.createElement('p'); e.className = cls; e.innerHTML = t; bd.appendChild(e); };
  if (!onMars) note('Weather and time of day only change Mars. Your settings are saved for when you land.', 'note');
  const ch = cheats(); note(ch.length ? `<span class="warn">Cheats on (${ch.join(', ')}): mission rewards are off.</span>` : 'No cheats on. Missions pay as normal.');
  h('Dust storm'); bd.appendChild(seg('storm', [['off', 'Off'], ['light', 'Light'], ['heavy', 'Heavy']], S.storm, v => { S.storm = v; save(); }, 'storm'));
  h('Time of day'); const T = TT();
  if (T) {
    const now = T.now(), cur = Object.entries(D.PRESETS).find(([, v]) => Math.abs(v - now) < 0.05)?.[0] || (!T.frozen && T.scale === 1 ? 'game' : '');
    bd.appendChild(seg('tod', [['game', '▶ Live'], ['dawn', 'Dawn'], ['noon', 'Noon'], ['dusk', 'Dusk'], ['night', 'Night']], cur, v => { if (v === 'game') { T.freeze(false); T.setScale(1); } else T.set(D.PRESETS[v]); clock = 0; changed(); }, 'tod'));
    const sl = document.createElement('div'); sl.innerHTML = `<p class="note">Mars clock <span class="val" id="dirClock">${hh(now)}</span> · ${T.phase()}</p><input id="dirTime" type="range" min="0" max="24" step="0.25" value="${now}" aria-label="Time of day">`; bd.appendChild(sl);
    const rg = sl.querySelector('input'); rg.addEventListener('input', () => { T.set(+rg.value % 24); document.getElementById('dirClock').textContent = hh(T.now()); }); rg.addEventListener('change', () => changed());
    bd.appendChild(seg('freeze', [[false, '▶ Running'], [true, '⏸ Frozen']], T.frozen, v => { T.freeze(v === true || v === 'true'); changed(); }, 'freeze'));
    bd.appendChild(seg('scale', D.TIME_SCALES.map(v => [v, `${v}×`]), T.scale, v => { T.setScale(+v); changed(); }, 'timeScale'));
    note('Same clock as the rest of the game (SSX.time): night brings more street crime and a thinner ColSec shift.');
  } else {
    bd.appendChild(seg('tod', [['game', 'Game'], ['dawn', 'Dawn'], ['noon', 'Noon'], ['dusk', 'Dusk'], ['night', 'Night']], S.tod == null ? 'game' : (Object.entries(D.PRESETS).find(([, v]) => Math.abs(v - S.tod) < 0.05)?.[0] || ''), v => { S.tod = v === 'game' ? null : D.PRESETS[v]; clock = 0; save(); }, 'tod'));
    const sl = document.createElement('div'); sl.innerHTML = `<p class="note">Clock <span class="val" id="dirClock">${S.tod == null ? 'game lighting' : hh(S.tod)}</span></p><input id="dirTime" type="range" min="0" max="24" step="0.25" value="${S.tod ?? 12}" aria-label="Time of day">`; bd.appendChild(sl);
    const rg = sl.querySelector('input'); rg.addEventListener('input', () => { S.tod = +rg.value % 24; document.getElementById('dirClock').textContent = hh(S.tod); }); rg.addEventListener('change', () => save());
    bd.appendChild(seg('freeze', [[false, '▶ Running'], [true, '⏸ Frozen']], S.freeze, v => { S.freeze = v; save(); }, 'freeze'));
    bd.appendChild(seg('scale', D.TIME_SCALES.map(v => [v, `${v}×`]), S.timeScale, v => { S.timeScale = +v; save(); }, 'timeScale'));
  }
  note('Clock speed: 1× = one hour per real minute.');
  h('Cops'); bd.appendChild(seg('noCops', [[false, 'Normal'], [true, '🚫 No cops']], S.noCops, v => { S.noCops = v; if (v) { try { world()?.setWanted?.(0, 'director'); world()?.onRespawn?.(); } catch {} } save(); }, 'noCops'));
  h('Crowds'); bd.appendChild(seg('density', [['normal', 'Normal'], ['sparse', 'Sparse'], ['empty', 'Empty']], S.density, v => { S.density = v; save(); }, 'density'));
  note(`People on screen never go over ${mobile ? 12 : 40} on this device.`);
  h('Player'); bd.appendChild(seg('invincible', [[false, 'Mortal'], [true, '🛡 Invincible']], S.invincible, v => { S.invincible = v; if (!v) { try { const H = game()?.debug?.H?.(); if (H) H.inv = 0; } catch {} } save(); }, 'invincible'));
  bd.appendChild(seg('ammo', [[false, 'Normal ammo'], [true, '♾ Unlimited ammo']], S.ammo, v => { S.ammo = v; save(); }, 'ammo'));
  h('Spawn vehicle'); const vr = document.createElement('div'); vr.className = 'row'; vr.dataset.k = 'vehicle';
  for (const v of vehicleList()) { const b = document.createElement('button'); b.textContent = v.name; b.dataset.v = v.id; b.disabled = !onMars || !canSpawn(v.id); tap(b, () => { if (b.disabled) return; const r = spawnVehicle(v.id); toast(r.ok ? `🎬 ${v.name} delivered. Rewards stay off until you reload.` : `🎬 ${r.why || 'Can\u2019t spawn that here.'}`, 2600); }); vr.appendChild(b); }
  bd.appendChild(vr);
  if (typeof window.SSX?.garage?.grantVehicle !== 'function') note('Only the rover is available until the garage add-on is installed.');
  h('Reset'); bd.appendChild(seg('reset', [['all', 'Reset everything']], '', () => { const keep = S; S = D.sanitize(null); const T2 = TT(); if (T2) { T2.freeze(false); T2.setScale(1); } if (keep.invincible) { try { const H = game()?.debug?.H?.(); if (H) H.inv = 0; } catch {} } save(); }, 'reset'));
  bd.scrollTop = y;
}
function open() { if (!panel) ui(); panel.classList.add('on'); render(); try { app()?.toggleMenu?.(false); } catch {} }
function close() { panel?.classList.remove('on'); }

// ---------- frame ----------
function tick(dt, ctx) {
  C = ctx; mobile = !!ctx.isMobile;
  const T = TT();
  if (T) { const e = document.getElementById('dirClock'); if (e) { const v = hh(T.now()); if (e.textContent !== v) e.textContent = v; } }
  else if (S.tod != null && ctx.name === 'Mars') { const t0 = S.tod; S.tod = D.advanceClock(S.tod, dt, S); if (Math.floor(t0 * 4) !== Math.floor(S.tod * 4)) { const e = document.getElementById('dirClock'); if (e) e.textContent = hh(S.tod); if (Math.floor(t0) !== Math.floor(S.tod)) try { localStorage.setItem(D.SAVE_KEY, JSON.stringify(S)); } catch {} } }
  clock += dt;
  try { look(dt, ctx); } catch (e) { warnOnce('look', e); }
  try { cheatTick(dt, ctx); } catch (e) { warnOnce('cheats', e); }
  if (tag && (tag.classList.contains('on') !== (cheats().length > 0))) updateTag();
}

const API = { version: 1, get state() { const T = TT(); return T ? { ...S, time: T.state() } : { ...S }; }, set(k, v) { if (!(k in D.DEFAULTS)) return false; S = D.sanitize({ ...S, [k]: v }); save(); return true; },
  cheats, rewardsBlocked: blocked, open, close, spawnVehicle, vehicles: vehicleList, on: (fn) => window.SSX?.on?.('director:change', fn) };
window.__director = { pullFog, get S() { return S; }, get session() { return session; }, get base() { return base && { top: base.top, horizon: base.horizon, light: base.light }; }, get stormFade() { return stormFade; }, get clock() { return clock; },
  get dust() { return dust ? { n: dust.geometry.attributes.position.count, visible: dust.visible, opacity: dust.material.opacity } : null; }, get stars() { return stars ? { visible: stars.visible, opacity: stars.material.opacity } : null; },
  get light() { return base?.dl ? { i: base.dl.intensity, c: base.dl.color.getHex() } : null; }, get fog() { const f = C?.scene?.fog; return f ? { near: f.near, far: f.far, c: f.color.getHex() } : null; }, get sky() { return base?.sky ? { top: base.sky.material.uniforms.top.value.getHex(), horizon: base.sky.material.uniforms.horizon.value.getHex() } : null; },
  set: API.set, open, close, render };

(function boot() {
  const X = window.SSX;
  if (!X || !window.__app || typeof X.registerSurfaceTick !== 'function') { setTimeout(boot, 200); return; }
  if (X.director) { console.warn('[director] SSX.director already present; not installing a second copy'); return; }
  X.director = API;
  ui();
  try { X.registerMenuItem({ id: 'dirMenuBtn', label: '🎬 Director', onTap: () => open() }); } catch (e) { warnOnce('menu', e); }
  X.registerSurfaceTick(tick);
  try { X.on?.('game:quest', onQuest); } catch (e) { warnOnce('quest', e); }
  changed();
})();
