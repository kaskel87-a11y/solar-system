// v7.5.5 Mars dust storms (Ben). window.SSX.storm. Every so often a storm rolls over the Mars surface: it builds,
// peaks and clears. While it blows:
//  - visibility drops (the fog closes in) and the sky, fog and sunlight turn red with grit; a pooled cloud of wind-blown
//    grit (one THREE.Points draw call, animated entirely in the vertex shader) is sized by the quality tier.
//  - traffic slows: core Beltway traffic through the public world API, SSX.beltway through setSpeedScale/setSpeed/setDensity
//    when it has one.
//  - crimes gain less heat (dust cover): SSX.heatFilter, consulted by world.setWanted for every rise (core crimes,
//    world.crime, add-ons and SSX.pursuit all land there). Half the stars at peak; the remainder carries over.
// It layers on top of whatever else owns the look (core zoom fog, Steve's v8 look, SSX.time, Director): fog distances and,
// without SSX.time, colours are set just before each surface render and put back right after it, so nobody else's values
// are ever overwritten. With SSX.time the colours go through SSX.time.addLookFilter instead.
// Clock: SSX.time (its scale, frozen = frozen) if loaded, else real time; only on the Mars surface.
// Debug: ?storm=1 (a storm starts on landing), ?storm=peak (straight to peak), ?storm=0 (no periodic storms), ?stormq=low|med|high.
import * as THREE from 'three';
import * as K from './stormcore.js';

const SSX = () => window.SSX, APP = () => window.__app;
const warned = new Set(); const warnOnce = (k, e) => { if (!warned.has(k)) { warned.add(k); console.warn('storm ' + k, e); } };
const qs = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
const Q = qs.get('storm');
const listeners = {};
function emit(evt, d = {}) {
  for (const f of [...(listeners[evt] || []), ...(listeners['*'] || [])]) { try { evt !== '*' && f.length < 2 ? f(d) : f(evt, d); } catch (e) { warnOnce('listener', e); } }
  try { SSX()?.emit?.('storm:' + evt, d); } catch (e) { /* bus not up */ }
}

const S = {
  cycle: K.createCycle({ periodic: Q !== '0' }), I: 0, eff: 0, onMars: false, indoor: false, tier: 'med', tierOverride: K.normTier(qs.get('stormq')), mobile: false,
  scene: null, pts: null, mat: null, n: 0, ref: { dl: null, hemi: null, sky: null, sun: null, kids: -1, t: 0 }, saved: null, applied: null,
  timeFilterOff: null, prevHeat: null, carry: 0, trafT: 0, touched: new Set(), bwK: 1, bwMode: null, cap: null, capFade: 0, capHide: 0, capText: '',
  frameMs: 0, renderMs: 0, rendersThisFrame: 0, stats: { storms: 0, shed: 0, damped: 0, renders: 0 }, wind: { a: Math.random() * 6.28, v: 8 }, off: new THREE.Vector3(),
  gritOn: true, lastPhase: 'clear', booted: false, armed: Q === '1' || Q === 'peak'
};
const tierNow = () => K.pickTier({ override: S.tierOverride, app: appTier(), stored: storedTier(), mobile: S.mobile });
function appTier() { const X = SSX(); try { const L = X?.look; if (typeof L?.tier === 'function') { const t = L.tier(); if (t && t !== 'classic') return t; } const q = X?.quality; const v = typeof q?.tier === 'function' ? q.tier() : q?.tier ?? q?.level; return typeof v === 'string' ? v : null; } catch (e) { return null; } }
function storedTier() { try { return localStorage.getItem('ssx-quality') || localStorage.getItem('ssx-gfx-tier'); } catch (e) { return null; } }
function clockScale() { const T = SSX()?.time; if (!T) return 1; try { if (T.frozen) return 0; const s = +T.scale; return Number.isFinite(s) ? Math.min(20, Math.max(0, s)) : 1; } catch (e) { return 1; } } // a 240x Director fast-forward shouldn't strobe storms
const directorStorm = () => { try { const st = SSX()?.director?.state?.(); return !!st && st.storm && st.storm !== 'off'; } catch (e) { return false; } };

// ---------- grit: one Points cloud that wraps around the camera; positions are computed in the vertex shader ----------
const VS = `attribute float rnd; uniform vec3 uCam; uniform vec3 uBox; uniform vec3 uOff; uniform float uTime; uniform float uSize; uniform float uPx; uniform float uOpacity;
varying float vA;
void main() {
  vec3 p = position * uBox + uOff * (0.65 + 0.7 * rnd) + vec3(0.0, sin(uTime * (0.8 + rnd) + rnd * 40.0) * 0.8, 0.0);
  vec3 l = mod(p - uCam, uBox) - uBox * 0.5; vec3 w = uCam + l;
  vec4 mv = viewMatrix * vec4(w, 1.0); float z = max(0.35, -mv.z);
  vA = uOpacity * smoothstep(1.2, 4.0, z) * (1.0 - smoothstep(uBox.x * 0.3, uBox.x * 0.5, length(l.xz)));
  gl_PointSize = vA < 0.01 ? 0.0 : clamp(uSize * (0.55 + rnd) * uPx / z, 1.0, 22.0); // near / faded grains cost no fill
  gl_Position = projectionMatrix * mv;
}`;
const FS = `uniform vec3 uColor; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c) * 4.0; if (d > 1.0) discard; gl_FragColor = vec4(uColor, vA * (1.0 - d));
#include <colorspace_fragment>
}`;
function buildGrit() {
  const n = K.particles(S.tier, S.mobile);
  if (S.pts && S.n === n) return S.pts;
  if (S.pts) { S.pts.parent?.remove(S.pts); S.pts.geometry.dispose(); }
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random(); rnd[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  if (!S.mat) S.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(50, 18, 50) }, uOff: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSize: { value: 0.7 }, uPx: { value: 600 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xc98a5a) } } });
  const p = new THREE.Points(g, S.mat); p.frustumCulled = false; p.renderOrder = 5; p.name = 'ssx-storm-grit'; p.userData.keep = false; p.visible = false;
  S.pts = p; S.n = n; return p;
}
const gritNight = new THREE.Color(0x6a3c28), gritDay = new THREE.Color(0xf2c896);
function updateGrit(dt, tc) {
  const on = S.eff > 0.01 && S.gritOn;
  if (!on) { if (S.pts) S.pts.visible = false; return; }
  const p = buildGrit(); if (p.parent !== tc.scene) tc.scene.add(p);
  const U = S.mat.uniforms, cam = tc.camera, T = K.TIERS[S.tier];
  S.wind.a += dt * 0.05 * Math.sin(S.cycle.t * 0.1); S.wind.v = 6 + 10 * S.eff;
  S.off.x += Math.cos(S.wind.a) * S.wind.v * dt; S.off.z += Math.sin(S.wind.a) * S.wind.v * dt; S.off.y -= 0.6 * dt;
  U.uOff.value.copy(S.off); U.uTime.value += dt; U.uCam.value.copy(cam.position);
  U.uBox.value.set(S.mobile ? 44 : 60, S.mobile ? 16 : 22, S.mobile ? 44 : 60); U.uSize.value = T.size;
  const r = APP()?.renderer, pr = (() => { try { return r?.getPixelRatio?.() || 1; } catch (e) { return 1; } })();
  U.uPx.value = innerHeight * pr * 0.5 * cam.projectionMatrix.elements[5];
  U.uOpacity.value = Math.min(0.85, S.eff * 0.9);
  let night = 0; try { night = SSX()?.time?.nightness?.() || 0; } catch (e) { /* */ }
  U.uColor.value.copy(gritDay).lerp(gritNight, night * 0.8);
  p.visible = true;
}

// ---------- the look: layered per render, restored after it ----------
function scanRefs(scene) {
  const R = S.ref; if (R.kids === scene.children.length && (R.t -= 1) > 0) return R;
  R.kids = scene.children.length; R.t = 120; R.dl = null; R.hemi = null; R.sky = null; R.sun = null;
  for (const o of scene.children) {
    if (o.isDirectionalLight && !R.dl) R.dl = o; else if (o.isHemisphereLight && !R.hemi) R.hemi = o;
    else if (o.isGroup && !R.sky) for (const c of o.children) { if (c.isMesh && c.material?.uniforms?.top && c.material.uniforms.horizon) R.sky = c; else if (c.isSprite && c.material?.blending === THREE.AdditiveBlending && !R.sun) R.sun = c; }
  }
  if (!R.sky) R.sun = null; // only the sky group's sun
  return R;
}
const cDust = { fog: new THREE.Color(), top: new THREE.Color(), hor: new THREE.Color(), light: new THREE.Color() };
const sv = { fogC: new THREE.Color(), bg: new THREE.Color(), top: new THREE.Color(), hor: new THREE.Color(), dlC: new THREE.Color(), hemiC: new THREE.Color() };
function before(scene) {
  if (S.saved) after(scene); // a render threw between before/after: put things back before layering again
  if (S.eff <= 0.001 || !S.onMars || scene !== S.scene) return;
  const t0 = performance.now(), e = S.eff, f = scene.fog, s = { fog: f || null };
  if (f && !f.isFogExp2) { s.near = f.near; s.far = f.far; const F = K.fogFor(f.near, f.far, e, S.tier); f.near = F.near; f.far = F.far; }
  else if (f?.isFogExp2) { s.density = f.density; f.density = Math.max(f.density, 0.07 * e); }
  if (!S.timeFilterOff) { // no SSX.time: tint ourselves (with SSX.time its look filter does it)
    const R = S.ref, D = K.dustColors(e, 0), m = D.mix;
    cDust.fog.setHex(D.fog); cDust.top.setHex(D.top); cDust.hor.setHex(D.horizon); cDust.light.setHex(D.light);
    if (f?.color) { sv.fogC.copy(f.color); s.fogC = true; f.color.lerp(cDust.fog, m); }
    if (scene.background?.isColor) { sv.bg.copy(scene.background); s.bg = true; scene.background.lerp(cDust.fog, m); }
    if (R.sky) { const U = R.sky.material.uniforms; sv.top.copy(U.top.value); sv.hor.copy(U.horizon.value); s.sky = R.sky; U.top.value.lerp(cDust.top, m); U.horizon.value.lerp(cDust.hor, m); }
    if (R.dl) { s.dl = R.dl; s.dlI = R.dl.intensity; sv.dlC.copy(R.dl.color); R.dl.intensity *= 1 - 0.45 * e; R.dl.color.lerp(cDust.light, m * 0.7); }
    if (R.hemi) { s.hemi = R.hemi; s.hemiI = R.hemi.intensity; sv.hemiC.copy(R.hemi.color); R.hemi.intensity *= 1 - 0.2 * e; R.hemi.color.lerp(cDust.fog, m * 0.5); }
    if (R.sun) { s.sun = R.sun; s.sunO = R.sun.material.opacity; R.sun.material.opacity *= Math.max(0, 1 - e * 1.6); }
  }
  S.applied = { near: f && !f.isFogExp2 ? +f.near.toFixed(1) : null, far: f && !f.isFogExp2 ? +f.far.toFixed(1) : null, baseFar: s.far ?? null, fog: f?.color ? '#' + f.color.getHexString() : null,
    sky: S.ref.sky ? '#' + S.ref.sky.material.uniforms.horizon.value.getHexString() : null, light: S.ref.dl ? +S.ref.dl.intensity.toFixed(2) : null, I: +e.toFixed(3), via: S.timeFilterOff ? 'SSX.time' : 'overlay' };
  S.saved = s; S.stats.renders++; S.renderMs += performance.now() - t0;
}
function after() {
  const s = S.saved; if (!s) return; S.saved = null; const f = s.fog;
  if (f) { if (s.near != null) { f.near = s.near; f.far = s.far; } if (s.density != null) f.density = s.density; if (s.fogC) f.color.copy(sv.fogC); }
  if (s.bg && S.scene?.background?.isColor) S.scene.background.copy(sv.bg);
  if (s.sky) { const U = s.sky.material.uniforms; U.top.value.copy(sv.top); U.horizon.value.copy(sv.hor); }
  if (s.dl) { s.dl.intensity = s.dlI; s.dl.color.copy(sv.dlC); }
  if (s.hemi) { s.hemi.intensity = s.hemiI; s.hemi.color.copy(sv.hemiC); }
  if (s.sun) s.sun.material.opacity = s.sunO;
}
function hookScene(scene) {
  if (!scene || scene.__ssxStorm) return; scene.__ssxStorm = true;
  const pb = scene.onBeforeRender, pa = scene.onAfterRender;
  scene.onBeforeRender = function (...a) { try { pb?.apply(this, a); } catch (e) { warnOnce('prev before', e); } try { before(this); } catch (e) { warnOnce('before', e); S.saved = null; } };
  scene.onAfterRender = function (...a) { try { after(this); } catch (e) { warnOnce('after', e); } try { pa?.apply(this, a); } catch (e) { warnOnce('prev after', e); } };
}
function timeFilter() {
  const T = SSX()?.time; if (S.timeFilterOff || typeof T?.addLookFilter !== 'function') return;
  try { S.timeFilterOff = T.addLookFilter(L => (S.onMars && !S.indoor && S.eff > 0.001 ? K.tintLook(L, S.eff) : L)); } catch (e) { warnOnce('time filter', e); }
}

// ---------- heat: dust cover ----------
function heatFilter(from, to, why) {
  let n = to; const prev = S.prevHeat;
  if (prev) { try { const r = prev(from, to, why); if (Number.isFinite(r)) n = r; } catch (e) { warnOnce('prev heat', e); } }
  if (!S.onMars || S.indoor || S.I <= 0.01 || !(n > from)) return n;
  const r = K.dampRise(from, n, K.heatScale(S.I), S.carry); S.carry = r.carry; S.stats.damped++;
  if (r.shed > 0) { S.stats.shed += r.shed; emit('shed', { from, to: n, now: r.to, shed: r.shed, why: why || '' }); if (r.to <= from) flashCap('🌪️ The dust hid you. Nobody got a good look.', 3500); }
  return r.to;
}
function syncHeat(on) {
  const X = SSX(); if (!X) return;
  if (on && X.heatFilter !== heatFilter) { S.prevHeat = typeof X.heatFilter === 'function' ? X.heatFilter : null; X.heatFilter = heatFilter; }
  else if (!on && X.heatFilter === heatFilter) { X.heatFilter = S.prevHeat; S.prevHeat = null; S.carry = 0; }
}

// ---------- traffic: slow, and give the speed back afterwards ----------
function syncTraffic(tc) {
  const k = K.trafficScale(S.onMars ? S.I : 0), w = tc?.world;
  if (k < 0.999 && w && typeof w.debug?.traffic === 'function' && typeof w.nearVehicle === 'function') {
    const seen = new Set();
    for (const c of w.debug.traffic()) {
      const v = w.nearVehicle(c.x, c.z, 0.05); const t = v?.traffic; if (!t || Math.abs(v.x - c.x) > 0.01 || Math.abs(v.z - c.z) > 0.01) continue;
      if (t.__stormV0 == null) { t.__stormV0 = t.vmax; S.touched.add(v); } t.vmax = t.__stormV0 * k; seen.add(v);
    }
    for (const v of S.touched) if (!seen.has(v)) { const t = v.traffic; if (t && t.__stormV0 != null) { t.vmax = t.__stormV0; delete t.__stormV0; } S.touched.delete(v); } // despawned / carjacked
  }
  if (k >= 0.999 && S.touched.size) restoreTraffic();
  const B = SSX()?.beltway; if (!B || Math.abs(k - S.bwK) < 0.01 && !(k >= 0.999 && S.bwK < 1)) return;
  try {
    if (typeof B.setSpeedScale === 'function') { B.setSpeedScale(k); S.bwMode = 'setSpeedScale'; }
    else if (typeof B.setSpeed === 'function') { B.setSpeed(k); S.bwMode = 'setSpeed'; }
    else if (typeof B.setDensity === 'function') { B.setDensity(k >= 0.999 ? null : k); S.bwMode = 'setDensity'; }
    else S.bwMode = 'none';
  } catch (e) { warnOnce('beltway', e); }
  S.bwK = k >= 0.999 ? 1 : k;
}
function restoreTraffic() { for (const v of S.touched) { const t = v.traffic; if (t && t.__stormV0 != null) { t.vmax = t.__stormV0; delete t.__stormV0; } } S.touched.clear(); }

// ---------- caption: one short single-line pill, bottom-left above the joystick (never the screen centre or the top-right
// stack), only on phase changes, gone after ~3 s (wall clock, so a slow frame rate or leaving Mars can't strand it on the HUD) ----------
const CAP_MS = 3000;
function capEl() {
  if (S.cap?.isConnected) return S.cap;
  const d = document.createElement('div'); d.id = 'stormCap'; d.className = 'glass'; d.setAttribute('aria-live', 'polite');
  d.style.cssText = 'display:none;position:fixed;left:calc(12px + env(safe-area-inset-left));bottom:calc(158px + env(safe-area-inset-bottom));z-index:9;max-width:min(60vw,300px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
    + 'padding:3px 9px;border-radius:9px;font-size:0.7rem;line-height:1.3;background:rgba(60,22,10,0.62);border:1px solid rgba(255,170,120,0.28);text-shadow:0 1px 2px rgba(0,0,0,0.8);pointer-events:none;transition:opacity .5s;';
  document.body.appendChild(d); S.cap = d; return d;
}
function hideCap() { clearTimeout(S.capFade); clearTimeout(S.capHide); if (S.cap) { S.cap.style.opacity = '0'; S.cap.style.display = 'none'; } S.capText = ''; }
function flashCap(text, ms = CAP_MS) {
  if (!text || ms <= 0) { hideCap(); return; }
  try { const d = capEl(); hideCap(); d.textContent = text; d.style.display = 'block'; d.style.opacity = '1'; S.capText = text;
    S.capFade = setTimeout(() => { if (S.cap) S.cap.style.opacity = '0'; }, ms - 500); S.capHide = setTimeout(hideCap, ms); } catch (e) { warnOnce('cap', e); }
}

// ---------- per-frame ----------
function tick(dt, tc) {
  const t0 = performance.now();
  const onMars = tc.name === 'Mars'; S.onMars = onMars; S.indoor = !!tc.world?.inside; S.mobile = !!tc.isMobile;
  if (tc.scene !== S.scene) { S.scene = tc.scene; S.ref.kids = -1; hookScene(tc.scene); }
  if (S.tierT === undefined || (S.tierT -= dt) <= 0) { S.tierT = 2; const t = tierNow(); if (t !== S.tier) { S.tier = t; emit('tier', { tier: t }); } }
  if (onMars && S.armed) { S.armed = false; S.cycle.start(Q === 'peak' ? { instant: true, peak: 1e6, manual: true } : { build: 6, manual: true }); }
  if (onMars && S.cycle.phase === 'clear' && directorStorm()) S.cycle.t = Math.min(S.cycle.t, S.cycle.len - 1); // Director's own storm is on: no second one
  const r = S.cycle.step(onMars ? dt * clockScale() : 0);
  if (r.phase !== S.lastPhase) phaseChanged(S.lastPhase, r.phase);
  S.I = onMars ? r.I : 0; S.eff = S.indoor ? 0 : S.I;
  if (onMars) { scanRefs(tc.scene); timeFilter(); }
  updateGrit(dt, tc);
  syncHeat(S.cycle.phase !== 'clear' && onMars);
  if ((S.trafT -= dt) <= 0) { S.trafT = 0.5; try { syncTraffic(tc); } catch (e) { warnOnce('traffic', e); } }
  const ms = performance.now() - t0 + S.renderMs; S.renderMs = 0;
  S.frameMs += (ms - S.frameMs) * 0.1;
}
function phaseChanged(from, to) {
  S.lastPhase = to; const d = { from, to, phase: to, I: +S.cycle.I.toFixed(3), manual: S.cycle.manual };
  if (to === 'building' && from === 'clear') { S.stats.storms++; emit('start', d); }
  if (to === 'peak') emit('peak', d); if (to === 'clearing') emit('clearing', d); if (to === 'clear') { emit('end', d); S.carry = 0; }
  emit('phase', d); flashCap(K.caption(to, S.cycle.I, K.heatScale(1)), to === 'clear' ? 0 : CAP_MS);
}

// ---------- public API: window.SSX.storm (also __app.storm) ----------
export const storm = {
  active: () => S.cycle.phase !== 'clear', intensity: () => +S.I.toFixed(3), phase: () => S.cycle.phase,
  start(o = {}) { return S.cycle.start({ manual: true, ...o }); }, // phase events fire on the next surface frame
  stop(o = {}) { const ok = S.cycle.stop(o); if (ok && o.instant) { S.I = 0; S.eff = 0; if (S.pts) S.pts.visible = false; if (S.lastPhase !== 'clear') phaseChanged(S.lastPhase, 'clear'); syncHeat(false); restoreTraffic(); } return ok; },
  on(evt, fn) { if (typeof fn !== 'function') throw new Error('SSX.storm.on(event, fn)'); (listeners[evt] ||= []).push(fn); return () => storm.off(evt, fn); },
  off(evt, fn) { const L = listeners[evt]; if (L) { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); } },
  state: () => ({ phase: S.cycle.phase, I: +S.I.toFixed(3), t: +S.cycle.t.toFixed(1), len: +S.cycle.len.toFixed(1), manual: S.cycle.manual, periodic: S.cycle.periodic, onMars: S.onMars, indoor: S.indoor, tier: S.tier, count: S.cycle.count }),
  next: () => (S.cycle.phase === 'clear' && S.cycle.periodic ? Math.max(0, Math.round(S.cycle.len - S.cycle.t)) : null),
  setPeriodic(on) { S.cycle.periodic = !!on; return S.cycle.periodic; }, get periodic() { return S.cycle.periodic; },
  tier: () => S.tier, setTier(t) { S.tierOverride = t == null ? null : K.normTier(t); S.tierT = 0; return S.tierOverride || tierNow(); },
  heatScale: () => (S.onMars && !S.indoor ? K.heatScale(S.I) : 1), trafficScale: () => K.trafficScale(S.onMars ? S.I : 0),
  visibility: () => (S.eff > 0.001 ? S.applied?.far ?? null : null), caption: () => S.capText, frameMs: () => +S.frameMs.toFixed(3), stats: () => ({ ...S.stats }),
  debug: {
    applied: () => (S.eff > 0.001 ? { ...S.applied } : null), saved: () => !!S.saved, refs: () => ({ dl: !!S.ref.dl, hemi: !!S.ref.hemi, sky: !!S.ref.sky, sun: !!S.ref.sun }),
    grit: () => ({ n: S.n, visible: !!S.pts?.visible, inScene: !!S.pts?.parent, opacity: +(S.mat?.uniforms.uOpacity.value || 0).toFixed(2) }),
    traffic: () => ({ touched: S.touched.size, k: K.trafficScale(S.onMars ? S.I : 0), beltway: S.bwMode, slowed: [...S.touched].filter(v => v.traffic?.__stormV0 != null).map(v => +(v.traffic.vmax / v.traffic.__stormV0).toFixed(3)) }),
    heatFilter: () => SSX()?.heatFilter === heatFilter, carry: () => +S.carry.toFixed(3), timeFilter: () => !!S.timeFilterOff,
    setGrit(on) { S.gritOn = !!on; return S.gritOn; },
    skip: sec => { S.cycle.t += sec; return storm.state(); }, cycle: () => S.cycle
  }
};

(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 250); return; }
  if (window.SSX.storm) return; window.SSX.storm = storm; window.__app.storm = storm;
  window.SSX.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { warnOnce('tick', e); } });
  try { window.SSX.emit?.('storm:ready', storm.state()); } catch (e) { /* */ }
})();
