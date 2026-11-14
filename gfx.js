// ☰ → 🎨 Graphics. Low / Medium / High, saved in localStorage 'ssx.gfx.v1'.
// Medium is the default on phones and desktops. It keeps today's pixel-ratio cap and adds only cheap wins
// (ACES filmic, sRGB, fog nudged toward the sky, a hemisphere fill where a scene has none).
// Low is lighter: pixel ratio capped at 1, no shadows, shorter fog, flatter textures.
// High is opt-in: a sun shadow on nearby meshes, a higher pixel-ratio cap, and a small environment light.
// A phone is never moved to High on its own. ?gfx=low|medium|high overrides one session.
// Rules live in gfxcore.js.
import * as THREE from 'three';
import * as G from './gfxcore.js';

const S = { tier: G.DEFAULT, phone: false, cap: 2, start: 2, hemi: false, ibl: false, env: null, casters: 0, aniso: 0 };
const warned = new Set();
const warnOnce = (k, e) => { if (warned.has(k)) return; warned.add(k); console.warn('[gfx] ' + k, e); };
const app = () => window.__app;
const phone = () => (matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window) && Math.min(screen.width || innerWidth, screen.height || innerHeight) <= 500;

function loadTier() {
  let k = null;
  try { k = new URLSearchParams(location.search).get('gfx'); } catch { /* */ }
  if (!k) try { k = localStorage.getItem(G.SAVE_KEY); } catch { /* */ }
  return G.norm(k || G.DEFAULT);
}
function saveTier() { try { localStorage.setItem(G.SAVE_KEY, S.tier); } catch { /* */ } }

function budget() {
  S.phone = phone();
  const R = app()?.renderer;
  const dpr = window.devicePixelRatio || R?.getPixelRatio?.() || 1;
  const c = G.caps(S.tier, dpr, S.phone);
  S.cap = c.cap; S.start = c.start;
  return c;
}

function applyDpr(c) {
  const pg = window.SSX?.perfGov;
  if (typeof pg?.setDprCap === 'function') pg.setDprCap(c.cap, c.start);
  else {
    const R = app()?.renderer;
    if (R?.setPixelRatio) {
      R.setPixelRatio(c.start);
      try { R.setSize(innerWidth, innerHeight); } catch { /* */ }
    }
  }
}

function applyGrade(c) {
  const R = app()?.renderer; if (!R) return;
  try {
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = R.toneMappingExposure || 1.1;
    if ('outputColorSpace' in R) R.outputColorSpace = THREE.SRGBColorSpace;
  } catch (e) { warnOnce('grade', e); }
}

// ---------- hemisphere fill (only where the scene has none; Mars already has one) ----------
function spaceScene() {
  const cam = app()?.camera; let o = cam;
  while (o?.parent) o = o.parent;
  return o?.isScene ? o : null;
}
function ensureHemi(scene, on) {
  if (!scene?.children) return false;
  let mine = null, any = false;
  for (const o of scene.children) if (o.isHemisphereLight) { any = true; if (o.userData?.gfxHemi) mine = o; }
  if (on && !any) {
    const h = new THREE.HemisphereLight(0x9eb6d6, 0x2a2018, 0.32);
    h.name = 'gfxFill'; h.userData.gfxHemi = true; scene.add(h); return true;
  }
  if (!on && mine) { scene.remove(mine); return false; }
  return !!(mine || (on && any));
}

// ---------- fog: shorter on Low, and a nudge toward the sky color on Medium / High ----------
function hookFog(scene) {
  if (!scene || scene.__gfxFog) return; scene.__gfxFog = true;
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...args) {
    if (typeof prev === 'function') prev.apply(this, args);
    const f = scene.fog; if (!f?.isFog) return;
    const scale = G.caps(S.tier, 1, S.phone).fog;
    const n = window.__frames || 0;
    if (f.__gfxFrame === n) return;
    f.__gfxFrame = n;
    if (scale < 0.999 && f.far < 400) {
      S.fogIn = f.far;
      f.far *= scale;
      f.near = Math.min(f.near, f.far * 0.5);
      S.fogOut = f.far;
    } else S.fogOut = S.fogIn = f.far;
  };
}
let fogFilter = false;
function hookTime() {
  const T = window.SSX?.time; if (fogFilter || typeof T?.addLookFilter !== 'function') return;
  T.addLookFilter(L => {
    if (!L) return L;
    const fog = G.matchFog(L.fog, L.horizon, S.tier, 1, S.phone);
    return fog === L.fog ? L : { ...L, fog };
  });
  fogFilter = true;
}

// ---------- anisotropy: Low flattens, High raises, Medium puts the original back ----------
const aniso0 = new WeakMap();
let anisoDirty = false;
function touchTex(t, cap, maxA) {
  if (!t?.isTexture) return;
  if (!aniso0.has(t)) aniso0.set(t, t.anisotropy || 1);
  const orig = aniso0.get(t);
  const next = cap == null ? orig : Math.min(maxA, cap);
  if (t.anisotropy !== next) { t.anisotropy = next; S.aniso++; }
}
function walkAniso(root, cap) {
  if (!root?.traverse) return;
  const maxA = app()?.renderer?.capabilities?.getMaxAnisotropy?.() || 8;
  root.traverse(o => {
    const mats = o.material ? [].concat(o.material) : [];
    for (const m of mats) for (const k in m) touchTex(m[k], cap, maxA);
  });
}

// ---------- High: one sun shadow that follows the player, nearby meshes only ----------
const casters = new Set();
const _dir = new THREE.Vector3(), _at = new THREE.Vector3(), _wp = new THREE.Vector3();
const sunDir = new WeakMap();
let scanAt = 0, envRT = null, shadowOn = false, anisoAt = 0;

function clearCasters() {
  for (const o of casters) { o.castShadow = false; o.receiveShadow = false; }
  casters.clear(); S.casters = 0;
}
function sunOf(scene) {
  if (!scene) return null;
  for (const o of scene.children) if (o.isDirectionalLight) return o;
  return null;
}
function setupShadow(dl, c) {
  dl.castShadow = true;
  const sh = dl.shadow, size = c.shadowSize, range = c.shadowRange;
  if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); if (sh.map) { sh.map.dispose(); sh.map = null; } }
  const cam = sh.camera;
  cam.near = 0.5; cam.far = range * 4;
  cam.left = cam.bottom = -range; cam.right = cam.top = range;
  cam.updateProjectionMatrix();
  sh.bias = -0.00035; sh.normalBias = 0.04;
}
function followSun(dl, ctx, range) {
  // time.js and buildSky park the sun at dir * 100. Once we move it onto the player, keep that direction.
  const look = window.SSX?.time?.look?.();
  if (look?.dir) _dir.set(look.dir.x, look.dir.y, look.dir.z);
  else if (Math.abs(dl.position.length() - 100) < 12) _dir.copy(dl.position);
  else if (sunDir.has(dl)) _dir.copy(sunDir.get(dl));
  else _dir.set(0.45, 0.8, -0.35);
  if (_dir.lengthSq() < 1e-6) _dir.set(0.45, 0.8, -0.35);
  _dir.normalize();
  sunDir.set(dl, _dir.clone());
  const p = ctx.player || ctx.camera?.position;
  _at.set(p?.x || 0, (p?.y || 0) + 1.2, p?.z || 0);
  dl.position.copy(_at).addScaledVector(_dir, range * 1.7);
  dl.target.position.copy(_at);
  dl.target.updateMatrixWorld();
}
function resetSun(dl) {
  if (!dl) return;
  dl.castShadow = false;
  dl.target.position.set(0, 0, 0);
}
function scan(scene, ctx, range) {
  const now = performance.now(); if (now - scanAt < 400) return; scanAt = now;
  const p = ctx.player; if (!p) return;
  const hits = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
    const mats = [].concat(o.material || []);
    if (!mats.length || mats.some(m => !m || m.fog === false || (m.transparent && m.opacity < 0.85))) return;
    let bs = o.geometry.boundingSphere;
    if (!bs) { try { o.geometry.computeBoundingSphere(); bs = o.geometry.boundingSphere; } catch { return; } }
    if (!bs || !(bs.radius < 40)) return;
    o.getWorldPosition(_wp);
    const dist = Math.hypot(_wp.x - p.x, _wp.z - p.z) - bs.radius;
    if (dist > range + 4) return;
    hits.push({ o, dist, cast: bs.radius < 10 && dist < range });
  });
  hits.sort((a, b) => a.dist - b.dist);
  const next = new Set();
  // Ground chunks sit closest (the player is inside their bounds). Keep a few of those to receive,
  // and the nearest small meshes to cast, or the shadow map stays empty.
  const keep = [...hits.filter(h => h.cast).slice(0, 32), ...hits.filter(h => !h.cast).slice(0, 8)];
  for (const h of keep) {
    h.o.castShadow = h.cast; h.o.receiveShadow = true; h.o.userData.gfxSh = 1;
    next.add(h.o);
  }
  for (const o of casters) if (!next.has(o)) { o.castShadow = false; o.receiveShadow = false; }
  casters.clear(); for (const o of next) casters.add(o);
  S.casters = [...casters].filter(o => o.castShadow).length;
}
function shadows(scene, ctx, c, on) {
  const R = app()?.renderer, dl = sunOf(scene);
  if (!on || !R || !dl || ctx?.world?.inside) {
    if (shadowOn || dl?.castShadow) {
      if (R?.shadowMap) R.shadowMap.enabled = false;
      resetSun(dl); clearCasters();
    }
    shadowOn = false; return;
  }
  try {
    shadowOn = true;
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    setupShadow(dl, c);
    followSun(dl, ctx, c.shadowRange);
    scan(scene, ctx, c.shadowRange);
  } catch (e) { warnOnce('shadow', e); }
}

// ---------- High: one cheap gradient environment, shared, built once ----------
function envTexture(R) {
  if (S.env) return S.env;
  const cnv = document.createElement('canvas'); cnv.width = 64; cnv.height = 32;
  const g = cnv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 32);
  grd.addColorStop(0, '#8aafd0'); grd.addColorStop(0.46, '#d7b48a'); grd.addColorStop(0.54, '#6a5344'); grd.addColorStop(1, '#241c16');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 32);
  const tex = new THREE.CanvasTexture(cnv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  try {
    const pm = new THREE.PMREMGenerator(R);
    envRT = pm.fromEquirectangular(tex);
    S.env = envRT?.texture || envRT;
    tex.dispose(); pm.dispose();
  } catch (e) { warnOnce('ibl', e); S.env = tex; }
  return S.env;
}
function applyEnv(scene, on) {
  if (!scene) return;
  if (on) {
    const R = app()?.renderer; if (!R) return;
    const tex = envTexture(R); if (!tex) return;
    if (!scene.userData.gfxEnv) { scene.userData.gfxEnvI = scene.environmentIntensity; scene.userData.gfxEnvPrev = scene.environment || null; }
    scene.environment = tex; scene.environmentIntensity = 0.55; scene.userData.gfxEnv = true; S.ibl = true;
  } else if (scene.userData?.gfxEnv) {
    scene.environment = scene.userData.gfxEnvPrev || null;
    if (scene.userData.gfxEnvI != null) scene.environmentIntensity = scene.userData.gfxEnvI;
    scene.userData.gfxEnv = false; S.ibl = false;
  }
}

function applyAniso(c) {
  const roots = [app()?.surface?.scene, spaceScene()].filter(Boolean);
  if (c.aniso == null && !anisoDirty) return;
  for (const r of roots) walkAniso(r, c.aniso);
  anisoDirty = c.aniso != null;
}

function applyAll() {
  const c = budget();
  applyGrade(c); applyDpr(c);
  const space = spaceScene();
  const surf = app()?.surface?.scene;
  ensureHemi(space, c.hemi);
  if (surf) ensureHemi(surf, c.hemi && ![...surf.children].some(o => o.isHemisphereLight && !o.userData?.gfxHemi));
  const has = scene => { if (!scene) return false; for (const o of scene.children) if (o.isHemisphereLight && (o.userData?.gfxHemi || c.hemi)) return true; return false; };
  S.hemi = has(space) || has(surf);
  applyEnv(space, c.ibl); applyEnv(surf, c.ibl);
  applyAniso(c);
  if (surf) hookFog(surf);
  hookTime();
  return c;
}

function tick(dt, ctx) {
  const c = budget();
  const scene = ctx?.scene; if (!scene) return;
  hookFog(scene);
  try { shadows(scene, ctx, c, c.shadow); } catch (e) { warnOnce('tick', e); }
  if (performance.now() - anisoAt > 2000) { anisoAt = performance.now(); try { applyAniso(c); } catch (e) { warnOnce('aniso', e); } }
  if (c.ibl && !scene.userData?.gfxEnv) applyEnv(scene, true);
  if (!c.ibl && scene.userData?.gfxEnv) applyEnv(scene, false);
}

// ---------- ☰ menu ----------
let btn = null, panel = null;
const menuLabel = () => `🎨 Graphics: ${G.label(S.tier)}`;
function paint() {
  if (btn) btn.textContent = menuLabel();
  if (!panel) return;
  for (const b of panel.querySelectorAll('button[data-k]')) {
    const on = b.dataset.k === S.tier;
    b.textContent = (on ? '✓ ' : '') + G.LABELS[b.dataset.k];
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.style.background = '#111';
    b.style.color = '#fff';
    b.style.borderColor = on ? '#4ade80' : 'rgba(255,255,255,0.55)';
    b.style.boxShadow = on ? 'inset 0 0 0 1px #4ade80' : 'none';
  }
}
function set(k) {
  S.tier = G.norm(k); saveTier(); paint(); scanAt = 0;
  // Resize and shadow setup wait a frame so a tap that picks a tier does not rebuild the canvas inside the event.
  const n = ++setGen;
  requestAnimationFrame(() => { if (n !== setGen) return; try { applyAll(); } catch (e) { warnOnce('apply', e); } });
  return S.tier;
}
let setGen = 0;
function tapOf(el, fn) {
  let pid = null, last = 0, x = 0, y = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; pid = e.pointerId; x = e.clientX; y = e.clientY; });
  el.addEventListener('pointerup', e => {
    if (e.pointerType === 'mouse' || e.pointerId !== pid) return;
    pid = null; if (Math.hypot(e.clientX - x, e.clientY - y) > 14) return;
    last = performance.now(); e.preventDefault(); e.stopPropagation(); fn();
  });
  el.addEventListener('pointercancel', () => { pid = null; });
  el.addEventListener('click', e => { e.stopPropagation(); if (performance.now() - last < 700) return; fn(); });
}
function close() { if (panel) panel.style.display = 'none'; }
function open() {
  if (!panel) {
    panel = document.createElement('div'); panel.id = 'gfxPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Graphics');
    panel.style.cssText = 'position:fixed;z-index:60;top:calc(58px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));display:none;flex-direction:column;gap:6px;width:min(220px,calc(100vw - 16px));padding:8px;border-radius:12px;background:rgba(8,10,20,0.96);border:1px solid rgba(255,255,255,0.35);color:#fff;font:700 14px system-ui,sans-serif;touch-action:manipulation';
    const h = document.createElement('div'); h.textContent = '🎨 Graphics'; h.style.cssText = 'padding:2px 4px 0';
    const p = document.createElement('div'); p.textContent = 'Saved on this device. Medium is the usual look.'; p.style.cssText = 'font-weight:400;font-size:12px;opacity:0.8;padding:0 4px 2px';
    for (const k of G.ORDER) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.id = 'gfx-' + k;
      b.style.cssText = 'min-height:44px;border-radius:10px;font:700 15px system-ui,sans-serif;text-align:left;padding:8px 12px;background:#111;color:#fff;border:1px solid rgba(255,255,255,0.55)';
      tapOf(b, () => set(k)); panel.appendChild(b);
    }
    const done = document.createElement('button'); done.type = 'button'; done.id = 'gfxDone'; done.textContent = 'Done';
    done.style.cssText = 'min-height:44px;border-radius:10px;font:700 15px system-ui,sans-serif;text-align:center;padding:8px 12px;background:#111;color:#fff;border:1px solid rgba(255,255,255,0.55)';
    tapOf(done, close);
    panel.insertBefore(h, panel.firstChild); panel.insertBefore(p, h.nextSibling); panel.appendChild(done);
    panel.addEventListener('pointerdown', e => e.stopPropagation());
    document.body.appendChild(panel);
  }
  paint(); panel.style.display = 'flex';
}

const API = {
  version: 1,
  get: () => S.tier,
  set, open, close,
  budget: () => budget(),
  state: () => {
    const R = app()?.renderer, surf = app()?.surface, fog = surf?.scene?.fog;
    return {
      tier: S.tier, phone: S.phone, cap: S.cap, start: S.start,
      dpr: R?.getPixelRatio?.() ?? null,
      dprCap: window.SSX?.perfGov?.state?.().dprMax ?? S.cap,
      shadow: !!R?.shadowMap?.enabled, casters: S.casters,
      tone: R?.toneMapping === THREE.ACESFilmicToneMapping ? 'aces' : R?.toneMapping,
      output: R?.outputColorSpace || null,
      fogFar: fog?.far ?? null, fogIn: S.fogIn ?? null, fogOut: S.fogOut ?? null,
      hemi: S.hemi, ibl: S.ibl,
      panel: panel?.style.display === 'flex',
      saved: (() => { try { return localStorage.getItem(G.SAVE_KEY); } catch { return null; } })()
    };
  },
  rules: () => ({
    key: G.SAVE_KEY, order: G.ORDER.slice(), def: G.DEFAULT,
    low: G.caps('low', 3, true), med: G.caps('medium', 3, true), high: G.caps('high', 3, true),
    medDesk: G.caps('medium', 3, false), highDesk: G.caps('high', 3, false)
  })
};
window.__gfx = { S, G, API };

function boot() {
  const X = window.SSX, a = app();
  if (!X || !a || typeof X.registerMenuItem !== 'function') { setTimeout(boot, 200); return; }
  if (X.gfx) return;
  S.tier = loadTier();
  X.gfx = API;
  try { btn = X.registerMenuItem({ id: 'gfxMenuBtn', label: menuLabel(), onTap: () => open() }); } catch (e) { warnOnce('menu', e); }
  try { applyAll(); } catch (e) { warnOnce('apply', e); }
  try { X.registerSurfaceTick(tick); } catch (e) { warnOnce('tickreg', e); }
  paint();
}
boot();
