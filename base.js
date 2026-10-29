// Mars base building (v7.5): buy a lot on Mars, place walls, gates, a garage, a stash and turrets on a 2 m grid, and it
// all saves to localStorage (ssx.base.v1) and comes back on reload. Pure rules live in basecore.js; core access goes through
// basehooks.js. Registers its per-frame tick with SSX.registerSurfaceTick (README add-on API) and
// publishes window.SSX.base once the app exists. No permanent HUD: ☰ 🏠 Mars base, plus one context button in #surfBtns
// near your lot (Buy / Build / Stash / Rover home; Place / Remove in build mode) and a top toolbar only while building.
//
//   SSX.base.plots() / owned() / state(id) / buy(id) / place(id, type, i, j, r) / remove(id, pieceId)
//   SSX.base.deposit(id, { credits, medkits }) / withdraw(id, { credits, medkits }) / build(on, id)
//   SSX.base.raid(id, opts) / endRaid(id, result) / damage(id, pieceId, n) / addTargets(fn)
//   SSX.base.on(evt, fn) / off(evt, fn); every event is also a window CustomEvent `base:<evt>` (base:raid, base:place, …)
//   SSX.base.registerPlot(def) / registerPiece(def): add-on lots and buildable pieces (see "Add-on lots and pieces" below).
//   Calls made before this module is up can be queued: (SSX._pendingPlots ||= []).push(def), (SSX._pendingPieces ||= []).push(def).
// Raids: if Steve's SSX.raids exists, raid() starts one through SSX.raids.start and window raid:start / raid:wave /
// raid:end events whose pos falls inside a lot arm that lot's turrets. Otherwise raid() emits base:raid on its own.
import * as THREE from 'three';
import * as BC from './basecore.js';
import * as H from './basehooks.js';

const LS = (() => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; } })();
const WORLD = 'Mars', GHOST_AHEAD = 5, NEAR = 3;
let S = BC.load(LS);
const listeners = {};
function emit(name, detail = {}) {
  for (const fn of listeners[name] || []) { try { fn(detail); } catch (e) { console.error('base listener', name, e); } }
  try { window.dispatchEvent(new CustomEvent('base:' + name, { detail })); } catch (e) { /* node */ }
  api.log.push(name + (detail.plotId ? ':' + detail.plotId : '') + (detail.type ? ':' + detail.type : '')); if (api.log.length > 80) api.log.shift();
}
const persist = () => BC.save(LS, S);

// ---------- runtime ----------
let C = null;                 // latest surface ctx
let root = null, sceneRef = null, centres = {}, inst = null, ghost = null, markers = null, grid = null, tracers = null;
let build = null;             // { plotId, type, r, tool: 'place'|'remove' }
let ui = null, actNow = null, inPlotId = null, menuBtn = null, clock = 0;
const turretSt = new Map();   // `${plotId}:${pieceId}` -> { yaw, cd, flash }
const raids = new Map();      // plotId -> { until, id, src }
const targetSources = new Set();
const sh = o => { o.userData.shared = true; return o; };

// ---------- assets (shared geometry + materials; userData.shared so surface.exit() leaves them alone) ----------
const A = {};
function assets() {
  if (A.ok) return A; A.ok = true;
  const box = (w, h, d, x = 0, y = 0, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return sh(g); };
  const cyl = (r, h, x = 0, y = 0, z = 0, seg = 10) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y, z); return sh(g); };
  const std = (color, o = {}) => sh(new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...o }));
  A.concrete = std(0x9a8f84); A.steel = std(0x6d737c, { metalness: 0.5, roughness: 0.45 }); A.dark = std(0x2b2f36, { metalness: 0.4, roughness: 0.5 });
  A.amber = std(0x1a1206, { emissive: 0xffa020, emissiveIntensity: 1.4 }); A.green = std(0x061a0c, { emissive: 0x3cff8a, emissiveIntensity: 1.6 });
  A.red = std(0x1a0606, { emissive: 0xff3030, emissiveIntensity: 1.6 }); A.hazard = std(0xd8a020, { metalness: 0.3, roughness: 0.6 });
  // parts per piece type: [geometry, material, role]. Every part extends ~1.4 m below its origin so it sits on lumpy ground.
  A.parts = {
    wall: [[box(2, 4, 0.4, 0, 0.6, 0), A.concrete], [box(2.04, 0.12, 0.44, 0, 2.5, 0), A.steel]],
    gate: [[box(0.24, 4.6, 0.4, -0.9, 0.9, 0), A.steel], [box(0.24, 4.6, 0.4, 0.9, 0.9, 0), A.steel], [box(1.56, 1.9, 0.08, 0, 1.15, 0), A.hazard], [box(1.8, 0.1, 0.1, 0, 3.0, 0), A.amber]],
    garage: [[box(4, 0.2, 6, 0, 0.0, 0), A.dark], [box(4, 4.4, 0.3, 0, 0.8, -2.85), A.concrete], [box(0.3, 4.4, 6, -1.85, 0.8, 0), A.concrete], [box(0.3, 4.4, 6, 1.85, 0.8, 0), A.concrete],
      [box(4.4, 0.25, 6.3, 0, 3.1, 0), A.steel], [box(3.4, 0.12, 0.08, 0, 2.85, 3.0), A.amber]],
    stash: [[box(1.3, 2.0, 1.0, 0, 0.0, 0), A.dark], [box(1.32, 0.08, 1.02, 0, 0.75, 0), A.steel], [box(0.3, 0.14, 0.04, 0, 0.55, 0.51), A.green]],
    turret: [[cyl(0.42, 2.6, 0, 0.0, 0), A.steel], [cyl(0.55, 0.2, 0, 1.3, 0, 12), A.dark],
      [box(0.8, 0.5, 0.9, 0, 1.65, 0), A.dark, 'head'], [cyl(0.09, 1.3, 0, 1.68, 0.95, 8).rotateX(Math.PI / 2), A.steel, 'head'], [box(0.5, 0.06, 0.04, 0, 1.75, -0.46), A.red, 'head']]
  };
  // the barrel cylinder was translated before rotating: rebuild it pointing +z from the head
  { const g = new THREE.CylinderGeometry(0.09, 0.09, 1.3, 8); g.rotateX(Math.PI / 2); g.translate(0, 1.68, 1.05); A.parts.turret[3][0] = sh(g); }
  A.ghostOk = sh(new THREE.MeshBasicMaterial({ color: 0x3cff8a, transparent: true, opacity: 0.42, depthWrite: false }));
  A.ghostBad = sh(new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.45, depthWrite: false }));
  A.post = cyl(0.12, 2.4, 0, 1.2, 0, 6); A.beam = cyl(0.35, 40, 0, 20, 0, 8);
  A.beamSale = sh(new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  A.beamOwn = sh(new THREE.MeshBasicMaterial({ color: 0x3cff8a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  A.line = sh(new THREE.LineBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.8 }));
  A.lineOwn = sh(new THREE.LineBasicMaterial({ color: 0x3cff8a, transparent: true, opacity: 0.8 }));
  A.grid = sh(new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35 }));
  A.tracer = sh(new THREE.LineBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.95 }));
  A.flash = sh(new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  A.flashG = sh(new THREE.SphereGeometry(0.28, 8, 6));
  return A;
}
// parts for a piece type: built-ins from A.parts, add-on pieces from def.parts ([[geometry, material, role?]] or a
// function (THREE, kit) returning that), else one box of the footprint (def.h tall, def.color). Cached; marked shared.
function partsFor(type) {
  assets(); if (A.parts[type]) return A.parts[type]; const T = BC.PIECES[type]; if (!T) return [];
  let parts = null; const kit = { box: (w, h, d, x = 0, y = 0, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }, std: (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...o }), A };
  try { parts = typeof T.parts === 'function' ? T.parts(THREE, kit) : T.parts; } catch (e) { console.warn('base piece parts', type, e); }
  parts = Array.isArray(parts) ? parts.filter(q => Array.isArray(q) && q[0]?.isBufferGeometry && q[1]?.isMaterial) : [];
  if (!parts.length) { const [w, d] = T.fp; parts = [[kit.box(w * BC.CELL * 0.96, T.h + 1.4, d * BC.CELL * 0.96, 0, (T.h - 1.4) / 2, 0), kit.std(T.color)]]; }
  for (const q of parts) { sh(q[0]); sh(q[1]); }
  return (A.parts[type] = parts);
}
function labelTex(text, color = '#ffd040') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,10,20,0.72)'; g.beginPath(); g.roundRect?.(4, 4, 504, 88, 22); if (!g.roundRect) g.rect(4, 4, 504, 88); g.fill();
  g.font = 'bold 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- coordinates ----------
const plotState = id => S.plots[id];
const toLocal = (id, x, z) => { const c = centres[id]; return c ? { x: x - c.x, z: z - c.z } : null; };
const toWorldXZ = (id, lx, lz) => { const c = centres[id]; return { x: c.x + lx, z: c.z + lz }; };
function baseY(id, p) { // lowest ground under the footprint, so nothing floats
  const [w, d] = BC.footprint(p.type, p.r), c = BC.pieceCentre(p), hw = w * BC.CELL / 2, hd = d * BC.CELL / 2; let y = Infinity;
  for (const [dx, dz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, 0]]) { const q = toWorldXZ(id, c.x + dx, c.z + dz); y = Math.min(y, C.height(q.x, q.z)); }
  return y;
}
function plotUnder(x, z, margin = 0) { for (const p of BC.PLOTS) { const l = toLocal(p.id, x, z); if (l && BC.inPlot(l.x, l.z, margin)) return p.id; } return null; }

// ---------- rendering ----------
function ensureRoot(ctx) {
  if (root && sceneRef === ctx.scene && root.parent === ctx.scene) return false;
  assets(); sceneRef = ctx.scene; layout(ctx);
  if (!Object.keys(centres).length) return false; // colony not laid out yet
  if (!root) { root = new THREE.Group(); root.name = 'marsBase'; }
  ctx.scene.add(root); rebuildAll(); return true;
}
function layout(ctx) { centres = {}; for (const p of BC.PLOTS) { const w = H.colonyAt(ctx?.world, p.aj); if (w) centres[p.id] = w; } } // aj = colony-relative [x, z]
function clearGroup(g) { if (!g) return; g.parent?.remove(g); g.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.material?.map && !o.material.userData?.shared) { o.material.map.dispose(); o.material.dispose(); } if (o.geometry && !o.isSprite && !o.geometry.userData?.shared) o.geometry.dispose(); }); }
function rebuildAll() { rebuildMarkers(); rebuildPieces(); if (build) rebuildGrid(); }
function rebuildPieces() {
  clearGroup(inst); inst = new THREE.Group(); inst.name = 'basePieces'; root.add(inst); inst.userData.heads = [];
  const byType = {}; for (const p of BC.PLOTS) if (centres[p.id] && plotState(p.id).owned) for (const q of plotState(p.id).pieces) (byType[q.type] ||= []).push([p.id, q]);
  const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (const [type, list] of Object.entries(byType)) {
    partsFor(type).forEach(([geo, mat, role], k) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length); im.frustumCulled = false; im.castShadow = false;
      list.forEach(([pid, q], n) => {
        const c = BC.pieceCentre(q), w = toWorldXZ(pid, c.x, c.z), y = baseY(pid, q);
        let yaw = BC.yawOf(q.r);
        if (role === 'head') { const st = turretSt.get(pid + ':' + q.id); if (st) yaw = st.yaw; }
        qt.setFromAxisAngle(up, yaw); m.compose(new THREE.Vector3(w.x, y, w.z), qt, one); im.setMatrixAt(n, m);
        if (role === 'head' && k === 2) inst.userData.heads.push({ key: pid + ':' + q.id, pid, q, n, x: w.x, y, z: w.z });
      });
      im.instanceMatrix.needsUpdate = true; if (role === 'head') (inst.userData.headMeshes ||= []).push(im);
      im.userData.type = type; inst.add(im);
    });
  }
  api.debug.instances = inst.children.reduce((a, o) => a + o.count, 0);
}
function setHeadYaw(h, yaw) {
  const m = new THREE.Matrix4(), qt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  m.compose(new THREE.Vector3(h.x, h.y, h.z), qt, new THREE.Vector3(1, 1, 1));
  for (const im of inst.userData.headMeshes || []) { im.setMatrixAt(h.n, m); im.instanceMatrix.needsUpdate = true; }
}
function rebuildMarkers() {
  clearGroup(markers); markers = new THREE.Group(); markers.name = 'basePlots'; root.add(markers);
  for (const p of BC.PLOTS) {
    const c = centres[p.id]; if (!c) continue; const own = plotState(p.id).owned, g = new THREE.Group(); g.userData.plot = p.id; markers.add(g);
    const pts = [], E = BC.HALF;
    for (const [ax, az, bx, bz] of [[-E, -E, E, -E], [E, -E, E, E], [E, E, -E, E], [-E, E, -E, -E]]) for (let k = 0; k < 8; k++) { const t = k / 8, x = c.x + ax + (bx - ax) * t, z = c.z + az + (bz - az) * t; pts.push(new THREE.Vector3(x, C.height(x, z) + 0.15, z)); }
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), own ? A.lineOwn : A.line));
    for (const [dx, dz] of [[-E, -E], [E, -E], [E, E], [-E, E]]) { const o = new THREE.Mesh(A.post, own ? A.green : A.amber); o.position.set(c.x + dx, C.height(c.x + dx, c.z + dz), c.z + dz); g.add(o); }
    const beam = new THREE.Mesh(A.beam, own ? A.beamOwn : A.beamSale); beam.position.set(c.x, C.height(c.x, c.z), c.z); g.add(beam);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(own ? `🏠 ${p.name}` : `🏷️ FOR SALE · ${p.price} cr`, own ? '#7dffb0' : '#ffd040'), transparent: true, depthWrite: false }));
    const ex = c.x - E - 0.5, ez = c.z + E + 0.5; sp.position.set(ex, C.height(ex, ez) + 3.4, ez); sp.scale.set(5.2, 1, 1); g.add(sp);
  }
}
function rebuildGrid() {
  clearGroup(grid); grid = null; if (!build || !centres[build.plotId]) return;
  const c = centres[build.plotId], pts = [], E = BC.HALF, y = (x, z) => C.height(x, z) + 0.1;
  for (let k = 0; k <= BC.SIZE; k++) { const o = -E + k * BC.CELL;
    for (let s = 0; s < BC.SIZE; s++) { const a = -E + s * BC.CELL, b = a + BC.CELL;
      pts.push(new THREE.Vector3(c.x + o, y(c.x + o, c.z + a), c.z + a), new THREE.Vector3(c.x + o, y(c.x + o, c.z + b), c.z + b));
      pts.push(new THREE.Vector3(c.x + a, y(c.x + a, c.z + o), c.z + o), new THREE.Vector3(c.x + b, y(c.x + b, c.z + o), c.z + o)); } }
  grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), A.grid); grid.name = 'baseGrid'; root.add(grid);
}
function ghostFor(type, tint) {
  if (ghost && ghost.userData.type === type) { ghost.traverse(o => { if (o.isMesh) o.material = tint; }); return ghost; }
  clearGroup(ghost); ghost = new THREE.Group(); ghost.userData.type = type; ghost.name = 'baseGhost';
  if (type === 'remove') { const m = new THREE.Mesh(sh(new THREE.BoxGeometry(1, 1, 1)), tint); ghost.add(m); }
  else for (const [geo] of partsFor(type)) ghost.add(new THREE.Mesh(geo, tint));
  root.add(ghost); return ghost;
}
function ensureTracers() {
  if (tracers) { if (tracers.parent !== root) root.add(tracers); return tracers; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 6), 3)); geo.setDrawRange(0, 0);
  tracers = new THREE.LineSegments(geo, A.tracer); tracers.frustumCulled = false; tracers.userData.list = []; root.add(tracers);
  tracers.userData.flashes = []; for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(A.flashG, A.flash); f.visible = false; tracers.add(f); tracers.userData.flashes.push(f); }
  return tracers;
}

// ---------- UI ----------
const CSS = `#baseBtn { display: none; height: 44px !important; font-size: 0.72rem !important; touch-action: manipulation !important; background: rgba(20,110,60,0.72) !important; border-color: rgba(60,255,138,0.6) !important; }
body:not(.touch) #baseBtn { font-size: 0.8rem !important; }
#baseBar { position: fixed; z-index: 14; top: calc(60px + env(safe-area-inset-top, 0px)); left: calc(108px + env(safe-area-inset-left, 0px)); right: calc(8px + env(safe-area-inset-right, 0px)); display: none; flex-direction: column; align-items: flex-end; gap: 4px; pointer-events: none; }
body.basebuild #baseBar { display: flex; } body.basebuild #stackR { display: none; }
#baseBar .tools { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; max-width: 100%; max-height: 98px; overflow-y: auto; overscroll-behavior: contain; pointer-events: auto; } /* wraps (right of the minimap) so rotate/remove/Done never go off-screen */
@media (max-width: 560px) { #baseBar button { width: 44px; padding: 0; font-size: 19px; } #baseBar button .nm { display: none; } } /* phones: icon-only, 2 rows; the hint names the piece */
body:not(.touch) #baseBar { left: calc(140px + env(safe-area-inset-left, 0px)); } /* desktop minimap is larger */
@media (max-height: 440px) { #baseBar { top: calc(50px + env(safe-area-inset-top, 0px)); left: calc(96px + env(safe-area-inset-left, 0px)); } }
#baseBar button { flex: 0 0 auto; min-width: 44px; height: 44px; padding: 0 8px; border-radius: 11px; border: 1px solid rgba(255,255,255,.3); background: rgba(10,14,30,.82); color: #fff; font: 700 12px system-ui, sans-serif; touch-action: manipulation; }
#baseBar button.on { background: rgba(30,140,80,.92); border-color: #3cff8a; } #baseBar button.x { background: rgba(120,30,30,.9); }
#baseBar .hint { align-self: flex-end; max-width: 100%; padding: 3px 9px; border-radius: 8px; background: rgba(8,10,20,.7); color: #e8ecf4; font: 12px system-ui, sans-serif; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#baseBar .hint.bad { color: #ff9a9a; }
#basePanel { position: fixed; inset: 0; z-index: 55; display: none; align-items: flex-end; justify-content: center; background: rgba(4,6,12,.55); }
#basePanel.on { display: flex; } #basePanel .wrap { width: min(94vw, 460px); max-height: 78vh; overflow: auto; margin-bottom: calc(10px + env(safe-area-inset-bottom)); background: rgba(12,15,26,.95); border: 1px solid rgba(255,255,255,.16); border-radius: 16px; padding: 12px 14px; color: #e8ecf4; font: 13px system-ui, sans-serif; }
#basePanel h2 { margin: 2px 0 8px; font-size: 16px; } #basePanel .row { display: flex; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid rgba(255,255,255,.08); flex-wrap: wrap; }
#basePanel .row > div { flex: 1 1 150px; } #basePanel small { opacity: .75; } #basePanel button { min-height: 44px; min-width: 64px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); background: rgba(40,48,70,.95); color: #fff; font-weight: 700; }
#basePanel button[disabled] { opacity: .45; }`;
function ensureUi() {
  if (ui || typeof document === 'undefined') return ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'baseBtn'; btn.className = 'glass';
  const sb = document.getElementById('surfBtns'); if (sb) sb.insertBefore(btn, sb.firstChild); else document.body.appendChild(btn);
  H.tap(btn, () => doAction());
  const bar = document.createElement('div'); bar.id = 'baseBar';
  bar.innerHTML = `<div class="tools"></div><div class="hint" id="baseHint"></div>`;
  document.body.appendChild(bar);
  const panel = document.createElement('div'); panel.id = 'basePanel'; panel.innerHTML = '<div class="wrap"></div>'; document.body.appendChild(panel);
  { let bp = null; panel.addEventListener('pointerdown', e => { bp = e.target === panel ? e.pointerId : null; });
    panel.addEventListener('pointerup', e => { if (e.target === panel && e.pointerId === bp) panel.classList.remove('on'); bp = null; }); panel.addEventListener('pointercancel', () => { bp = null; }); }
  addEventListener('keydown', e => {
    if (e.repeat || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    if (e.code === 'KeyK' && actNow) { e.preventDefault(); doAction(); return; }
    if (!build) return;
    const ids = toolIds(), n = /^Digit([1-9])$/.exec(e.code)?.[1], k = n ? (+n <= ids.length ? ids[n - 1] : +n === ids.length + 1 ? 'remove' : null) : null; // 1..N pieces, N+1 remove
    if (k) { build.tool = k === 'remove' ? 'remove' : 'place'; if (k !== 'remove') build.type = k; refreshBar(); e.preventDefault(); }
    else if (e.code === 'KeyO') { build.r = (build.r + 1) & 3; e.preventDefault(); } else if (e.code === 'Escape') setBuild(false);
  });
  ui = { btn, bar, panel, hint: bar.querySelector('#baseHint'), tools: bar.querySelector('.tools'), toolsKey: '' }; renderTools(); return ui;
}
const toolIds = () => BC.piecesFor(build?.plotId || null);
// the build toolbar, rebuilt when pieces register or you start building on a lot with a different piece list (it wraps;
// past 2 rows on a phone it scrolls, so add-on pieces never push Rotate / Done off-screen and nothing is added to the HUD)
function renderTools() {
  if (!ui) return; const ids = toolIds(), key = ids.map(t => t + ':' + BC.PIECES[t].icon + BC.PIECES[t].name).join('|'); if (key === ui.toolsKey) return; ui.toolsKey = key;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  ui.tools.innerHTML = `${ids.map(id => `<button data-t="${esc(id)}" id="baseT-${esc(id)}" aria-label="${esc(BC.PIECES[id].name)}">${esc(BC.PIECES[id].icon)}<span class="nm"> ${esc(BC.PIECES[id].name)}</span></button>`).join('')}<button data-t="remove" id="baseT-remove" aria-label="Remove">🗑️</button><button data-a="rot" id="baseRot" aria-label="Rotate">⟳</button><button data-a="done" id="baseDone" class="x" aria-label="Done">✕<span class="nm"> Done</span></button>`;
  for (const b of ui.tools.querySelectorAll('button')) H.tap(b, () => { if (!build) return; if (b.dataset.t) { build.tool = b.dataset.t === 'remove' ? 'remove' : 'place'; if (b.dataset.t !== 'remove') build.type = b.dataset.t; } else if (b.dataset.a === 'rot') build.r = (build.r + 1) & 3; else if (b.dataset.a === 'done') setBuild(false); refreshBar(); });
  refreshBar();
}
let busy = false;
// re-aim at tap time: on a slow frame the last tick's target can be stale
async function doAction() { const a = build && C && root?.parent ? updateBuild() : actNow; if (!a?.fn || busy) return; busy = true; try { await a.fn(); } finally { busy = false; } }
function refreshBar() { if (!ui || !build) return; for (const b of ui.bar.querySelectorAll('button[data-t]')) b.classList.toggle('on', build.tool === 'remove' ? b.dataset.t === 'remove' : b.dataset.t === build.type && build.tool === 'place'); }
function setAction(a) {
  actNow = a; if (!ui) return; const touch = document.body.classList.contains('touch');
  ui.btn.style.display = a ? 'block' : 'none'; if (a) { const t = a.label + (touch ? '' : ' (K)'); if (ui.btn.textContent !== t) ui.btn.textContent = t; }
}
function closePanel() { ui?.panel.classList.remove('on'); }
function panel(html, bind) { ensureUi(); const w = ui.panel.firstChild; w.innerHTML = html; for (const b of w.querySelectorAll('button')) H.tap(b, () => { if (!b.disabled) bind(b.dataset); }); ui.panel.classList.add('on'); }
const compass = (dx, dz) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360 / 45) % 8]; // -z is north (Olympus Row is "due south" in the pack but sits at -z; we follow world.js axes: z south)
function overview() {
  const P = C?.player, cr = H.credits(C?.game);
  const rows = BC.PLOTS.map(p => {
    const s = plotState(p.id), c = centres[p.id], d = c && P ? Math.hypot(c.x - P.x, c.z - P.z) : null, near = d != null && d < BC.HALF + NEAR + 2, sum = BC.summary(s);
    const info = s.owned ? `${s.pieces.length} pieces${sum.turret ? ` · ${sum.turret} 🔫` : ''}${sum.garage ? ' · 🚗' : ''} · stash ${s.stash.credits} cr` : p.owner ? p.blurb || 'Sold at its own sign.' : `${p.price} cr · ${p.blurb}`;
    const where = d == null ? 'Mars' : near ? 'here' : `${Math.round(d)} m ${compass(c.x - P.x, c.z - P.z)}`;
    const btn = s.owned ? (near && BC.canBuildUi(p.id) ? `<button data-act="build" data-id="${p.id}">🏗️ Build</button>` : '') : p.owner ? '' : `<button data-act="buy" data-id="${p.id}" ${near && cr >= p.price ? '' : 'disabled'}>${near ? (cr >= p.price ? 'Buy' : 'Short') : 'Go there'}</button>`;
    return `<div class="row"><div><b>${s.owned ? '🏠' : '🏷️'} ${p.name}</b> <small>· ${p.district} · ${where}</small><br><small>${info}</small></div>${btn}</div>`;
  }).join('');
  panel(`<h2>🏠 Mars base</h2><small>Buy a lot, then stand on it and tap 🏗️ Build. Walls, gates, a garage for your rover, a stash the cops can't fine and turrets that shoot back when you're wanted. You have ${cr} cr.</small>${rows}<div class="row"><div></div><button data-act="close">Close</button></div>`,
    ds => { if (ds.act === 'close') return closePanel(); if (ds.act === 'buy') { const r = api.buy(ds.id); H.toast(r.msg, 2600); overview(); } if (ds.act === 'build') { closePanel(); setBuild(true, ds.id); } });
}
function stashUi(id) {
  const s = plotState(id), g = C?.game, cr = H.credits(g), mk = H.medkits(g);
  panel(`<h2>💰 Stash · ${BC.plotById(id).name}</h2><small>Busted or med-evac'd, the fine comes out of your pocket, not this box.</small>
    <div class="row"><div><b>${s.stash.credits} cr</b> inside<br><small>You carry ${cr} cr</small></div><button data-k="credits" data-op="in" data-n="100" ${cr >= 100 ? '' : 'disabled'}>+100</button><button data-k="credits" data-op="in" data-n="all" ${cr ? '' : 'disabled'}>+All</button><button data-k="credits" data-op="out" data-n="100" ${s.stash.credits >= 100 ? '' : 'disabled'}>−100</button><button data-k="credits" data-op="out" data-n="all" ${s.stash.credits ? '' : 'disabled'}>−All</button></div>
    <div class="row"><div><b>${s.stash.medkits} 🩹</b> inside<br><small>You carry ${mk}</small></div><button data-k="medkits" data-op="in" data-n="1" ${mk ? '' : 'disabled'}>+1</button><button data-k="medkits" data-op="out" data-n="1" ${s.stash.medkits ? '' : 'disabled'}>−1</button></div>
    <div class="row"><div></div><button data-act="close" id="baseStashClose">Close</button></div>`,
    ds => { if (ds.act === 'close') return closePanel(); const have = ds.op === 'in' ? (ds.k === 'credits' ? cr : mk) : s.stash[ds.k], n = ds.n === 'all' ? have : Math.min(+ds.n, have);
      const r = (ds.op === 'in' ? api.deposit : api.withdraw)(id, { [ds.k]: n }); if (!r.ok) H.toast(r.msg, 2000); stashUi(id); });
}

// ---------- build mode ----------
function setBuild(on, plotId, force) {
  ensureUi();
  if (on) { const id = plotId || inPlotId; syncOwners(); if (!id || !plotState(id)?.owned) { H.toast('🏗️ Stand on a lot you own to build.', 2400); return false; }
    if (!force && !BC.canBuildUi(id)) return false; // build:false lot: only its add-on's own button
    const ids = BC.piecesFor(id); build = { plotId: id, type: ids.includes(build?.type) ? build.type : (ids[0] || 'wall'), r: build?.r || 0, tool: 'place' }; renderTools(); document.body.classList.add('basebuild'); closePanel(); if (C) rebuildGrid(); refreshBar(); emit('build:on', { plotId: id }); }
  else if (build) { const id = build.plotId; build = null; document.body.classList.remove('basebuild'); clearGroup(ghost); ghost = null; clearGroup(grid); grid = null; emit('build:off', { plotId: id }); }
  return true;
}
function cursorLocal() { // ghost cursor: GHOST_AHEAD metres in front of the camera's view, on the ground
  const P = C.player, f = new THREE.Vector3(); C.camera.getWorldDirection(f); f.y = 0; if (f.lengthSq() < 1e-6) f.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); f.normalize();
  return toLocal(build.plotId, P.x + f.x * GHOST_AHEAD, P.z + f.z * GHOST_AHEAD);
}
function updateBuild() {
  const l = cursorLocal(), s = plotState(build.plotId); let label, ok, why = '', fn;
  if (build.tool === 'remove') {
    const c = BC.cellAt(l.x, l.z), p = BC.pieceAt(s, c.i, c.j); ok = !!p;
    if (p) { const [w, d] = BC.footprint(p.type, p.r), pc = BC.pieceCentre(p), wp = toWorldXZ(build.plotId, pc.x, pc.z), g = ghostFor('remove', A.ghostBad);
      g.visible = true; g.children[0].scale.set(w * BC.CELL + 0.1, 3.4, d * BC.CELL + 0.1); g.position.set(wp.x, baseY(build.plotId, p) + 1.6, wp.z); g.rotation.y = 0; }
    else if (ghost) ghost.visible = false;
    label = p ? `🗑️ Remove +${BC.refundOf(p)}` : null; why = p ? `${BC.PIECES[p.type].name}: refunds ${BC.refundOf(p)} cr` : 'Aim at a piece to remove it';
    fn = p ? async () => { const r = api.remove(build.plotId, p.id); H.toast(r.msg, 1600); } : null;
  } else {
    const T = BC.PIECES[build.type], sn = BC.snap(build.type, build.r, l.x, l.z), v = BC.canPlace(s, build.type, sn.i, sn.j, build.r, { credits: H.credits(C.game), plotId: build.plotId });
    const blocked = v.ok && occupiedByYou(build.plotId, { type: build.type, i: sn.i, j: sn.j, r: build.r });
    ok = v.ok && !blocked; why = blocked ? 'You\u2019re standing there' : v.why; if (why) why = `${T.icon} ${T.name}: ${why}`;
    const q = { type: build.type, i: sn.i, j: sn.j, r: build.r }, pc = BC.pieceCentre(q), wp = toWorldXZ(build.plotId, pc.x, pc.z), g = ghostFor(build.type, ok ? A.ghostOk : A.ghostBad);
    g.visible = true; g.position.set(wp.x, ok || v.why !== 'Off your lot' ? baseY(build.plotId, q) : C.height(wp.x, wp.z), wp.z); g.rotation.y = BC.yawOf(build.r);
    label = `✓ ${T.icon} ${T.cost}`; fn = ok ? async () => { const r = api.place(build.plotId, build.type, sn.i, sn.j, build.r); if (!r.ok) H.toast(r.why, 1800); } : async () => H.toast('🚫 ' + why, 1600);
    if (!why) why = `${T.icon} ${T.name} · ${T.cost} cr · ${T.blurb}`;
  }
  api.debug.ghost = { tool: build.tool, type: build.type, r: build.r, ok, why, visible: !!ghost?.visible, tint: ghost?.children[0]?.material === A.ghostOk ? 'ok' : 'bad' };
  if (ui) { const t = `${H.credits(C.game)} cr · ${s.pieces.length}/${BC.PIECE_CAP} · ${why}`; if (ui.hint.textContent !== t) ui.hint.textContent = t; ui.hint.classList.toggle('bad', !ok); }
  return label ? { label, fn } : null;
}
function occupiedByYou(id, q) { const l = toLocal(id, C.player.x, C.player.z); return BC.cellsOf(q).some(([a, b]) => { const c = BC.cellAt(l.x, l.z); return a === c.i && b === c.j; }); }

// ---------- per-frame ----------
export function baseTick(dt, ctx) {
  C = ctx; clock += dt;
  if (!api.ready) init(); drainPending(); syncOwners();
  if (ctx.name !== WORLD) { if (root?.parent) root.parent.remove(root); if (build) setBuild(false); setAction(null); if (menuBtn) menuBtn.style.display = 'none'; inPlotId = null; return; }
  if (menuBtn) menuBtn.style.display = '';
  ensureRoot(ctx); if (!root?.parent) return; ensureUi();
  const P = ctx.player, car = ctx.car, indoor = H.indoors(ctx.world);
  const was = inPlotId; inPlotId = indoor ? null : plotUnder(P.x, P.z, 0.5);
  if (was !== inPlotId) { if (was) emit('leave', { plotId: was }); if (inPlotId) emit('enter', { plotId: inPlotId, owned: plotState(inPlotId).owned }); }
  // solid pieces push you (and your ride) out; gates are yours, so they let you through
  const pid = plotUnder(P.x, P.z, 3);
  if (pid && plotState(pid).owned && !indoor) {
    const tgt = car || P, rad = car ? Math.min(2, car.spec?.r || 1.6) : 0.45, l = toLocal(pid, tgt.x, tgt.z), o = BC.pushOut(plotState(pid), l.x, l.z, rad);
    if (o) { const w = toWorldXZ(pid, o.x, o.z); tgt.x = w.x; tgt.z = w.z; if (car) car.speed *= 0.6; }
  }
  // garage: a rover parked in the bay gets topped up
  for (const p of BC.PLOTS) { const g = plotState(p.id).owned && plotState(p.id).pieces.find(q => q.type === 'garage'); if (!g || !ctx.rover || !centres[p.id]) continue;
    const l = toLocal(p.id, ctx.rover.x, ctx.rover.z), c = BC.pieceCentre(g), [w, d] = BC.footprint('garage', g.r);
    if (Math.abs(l.x - c.x) < w && Math.abs(l.z - c.z) < d && 'fuel' in ctx.rover && ctx.rover.fuel < 100) ctx.rover.fuel = Math.min(100, ctx.rover.fuel + dt * 25); }
  subscribeRaids(); updateTurrets(dt, ctx);
  if (build && (build.plotId !== plotUnder(P.x, P.z, 12) || car || indoor)) { H.toast('🏗️ Left your lot. Build mode off.', 1800); setBuild(false); }
  let act = null;
  if (build) act = updateBuild();
  else if (!indoor && !car && !ctx.game?.isDown?.()) {
    const near = plotUnder(P.x, P.z, NEAR);
    if (near && !plotState(near).owned && BC.plotById(near).owner) act = null; // add-on lot sold by its own add-on
    else if (near && !plotState(near).owned) { const p = BC.plotById(near); act = { label: `🏷️ Buy lot ${p.price}`, fn: async () => { const r = api.buy(near); H.toast(r.msg, 2600); } }; }
    else if (near) {
      const s = plotState(near), l = toLocal(near, P.x, P.z), close = t => s.pieces.find(q => q.type === t && (() => { const c = BC.pieceCentre(q); return Math.hypot(c.x - l.x, c.z - l.z) < (t === 'garage' ? 4 : 2.2); })());
      const st = close('stash'), gr = close('garage');
      if (st) act = { label: '💰 Stash', fn: async () => stashUi(near) };
      else if (gr) { // the garage stores / respawns your ride; paint & parts live in Pumpkin's SSX.garage (feature-detected at call time)
        const parked = ctx.rover && roverInBay(near, gr, ctx.rover), cz = customizer();
        if (cz && (parked || !ctx.rover)) act = { label: '🔧 Customize', fn: async () => { const f = customizer(); if (!f) return H.toast('🔧 No tuner in this build.', 1800); f(); emit('garage:customize', { plotId: near }); } };
        else if (ctx.rover) act = { label: '🚙 Rover home', fn: async () => roverHome(near, gr) };
      }
      else if (inPlotId === near && BC.canBuildUi(near)) act = { label: '🏗️ Build', fn: async () => setBuild(true, near) };
    }
  }
  setAction(act);
}
// PR #7's SSX.garage has only grant*() today; a future open()/openGarage() lights the Customize action up
function customizer() { const G = typeof window !== 'undefined' && window.SSX?.garage; const f = G && (G.open || G.openGarage || G.customize); return typeof f === 'function' ? () => f.call(G) : null; }
function roverInBay(id, g, rv) { const l = toLocal(id, rv.x, rv.z), c = BC.pieceCentre(g), [w, d] = BC.footprint('garage', g.r); return Math.abs(l.x - c.x) < w && Math.abs(l.z - c.z) < d; }
function roverHome(id, g) {
  const c = BC.pieceCentre(g), w = toWorldXZ(id, c.x, c.z), [bx, bz] = BC.rotXZ(0, 1, g.r); // nose to the open front
  H.parkVehicle(C.rover, w.x, w.z, Math.atan2(-bx, -bz) + Math.PI, C.height(w.x, w.z) + 0.6); emit('garage', { plotId: id, x: w.x, z: w.z }); H.toast('🚙 Rover\u2019s in the garage. Fuel topped up.', 2200);
}
const tv0 = new THREE.Vector3(), tv1 = new THREE.Vector3();
function updateTurrets(dt, ctx) {
  const heads = inst?.userData.heads || []; if (!heads.length) return; const tr = ensureTracers(), segs = tr.userData.list;
  for (let k = segs.length - 1; k >= 0; k--) { segs[k].t -= dt; if (segs[k].t <= 0) segs.splice(k, 1); }
  const wanted = H.heat(ctx.world).wanted, P = ctx.player;
  let sec = null;
  for (const h of heads) {
    const st = turretSt.get(h.key) || (turretSt.set(h.key, { yaw: BC.yawOf(h.q.r), cd: 0.5 }), turretSt.get(h.key)); st.cd -= dt;
    if (Math.hypot(h.x - P.x, h.z - P.z) > 140) continue;
    const raid = raids.get(h.pid), armed = wanted > 0 || (raid && raid.until > clock);
    if (raid && raid.until <= clock && !raid.ended) { raid.ended = true; emit('raid:end', { plotId: h.pid, id: raid.id, result: 'timeout' }); }
    let cands = [];
    if (armed) {
      sec ||= H.security(ctx.world).map(s => ({ x: s.x, y: s.y + (s.kind === 'drone' ? 0 : 1), z: s.z, kind: s.kind, sec: true }));
      cands = sec.slice();
      for (const fn of targetSources) { try { for (const t of fn({ plotId: h.pid, x: h.x, z: h.z, range: BC.TURRET.range }) || []) cands.push(t); } catch (e) { /* bad source */ } }
      const rl = window.SSX?.raids; if (rl && typeof rl.attackers === 'function') { try { for (const t of rl.attackers() || []) if (t && t.alive !== false) cands.push(t); } catch (e) { /* not ready */ } }
    }
    const tgt = BC.pickTarget(h.x, h.z, cands, BC.TURRET.range);
    if (!tgt) { st.yaw += dt * 0.4; setHeadYaw(h, st.yaw); continue; }  // idle sweep
    const want = Math.atan2(tgt.x - h.x, tgt.z - h.z); let dy = Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw));
    st.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 5); setHeadYaw(h, st.yaw);
    if (st.cd > 0 || Math.abs(dy) > 0.25) continue;
    st.cd = BC.TURRET.rate;
    tv0.set(h.x + Math.sin(st.yaw) * 1.6, h.y + 1.68, h.z + Math.cos(st.yaw) * 1.6); tv1.set(tgt.x, (tgt.y ?? ctx.height(tgt.x, tgt.z) + 1), tgt.z);
    let hit = false;
    if (tgt.sec) { tv1.addScaledVector(tv1.clone().sub(tv0).normalize(), 1.5); hit = H.shoot(ctx.world, tv0, tv1, BC.TURRET.dmg); }
    else if (typeof tgt.hurt === 'function') { try { tgt.hurt(BC.TURRET.dmg, 'turret'); hit = true; } catch (e) { /* ignore */ } } // SSX.raids attacker handle
    else if (typeof tgt.hit === 'function') { try { tgt.hit(BC.TURRET.dmg, { plotId: h.pid }); hit = true; } catch (e) { /* ignore */ } }
    segs.push({ a: tv0.clone(), b: tv1.clone(), t: 0.09, h });
    api.debug.shots++; emit('turret:fire', { plotId: h.pid, pieceId: h.q.id, target: tgt.kind || 'raider', hit });
    if (hit) emit('turret:hit', { plotId: h.pid, pieceId: h.q.id, target: tgt.kind || 'raider' });
  }
  const pos = tr.geometry.attributes.position, n = Math.min(8, segs.length);
  for (let k = 0; k < n; k++) { const s = segs[k]; pos.setXYZ(k * 2, s.a.x, s.a.y, s.a.z); pos.setXYZ(k * 2 + 1, s.b.x, s.b.y, s.b.z); }
  pos.needsUpdate = true; tr.geometry.setDrawRange(0, n * 2);
  tr.userData.flashes.forEach((f, k) => { const s = segs[k]; f.visible = !!s; if (s) f.position.copy(s.a); });
}

// ---------- public API ----------
function plotInfo(p) { const s = plotState(p.id), c = centres[p.id]; return { id: p.id, name: p.name, district: p.district, aj: [...p.aj], price: p.price, owned: s.owned, addon: !!p.addon, pieces: s.pieces.length, world: c ? { x: c.x, z: c.z } : null, half: BC.HALF }; }
const api = {
  ready: false, log: [], PIECES: BC.PIECES, CELL: BC.CELL, SIZE: BC.SIZE,
  plots: () => BC.PLOTS.map(plotInfo),
  owned: () => BC.PLOTS.filter(p => plotState(p.id).owned).map(p => p.id),
  state: id => plotState(id) ? JSON.parse(JSON.stringify(plotState(id))) : null,
  get building() { return build ? { ...build } : null; },
  get action() { return actNow?.label || null; },
  get inPlot() { return inPlotId; },
  buy(id) {
    const p = BC.plotById(id); if (!p) return { ok: false, msg: 'No such lot' }; const s = plotState(id);
    if (s.owned) return { ok: false, msg: 'You already own it' };
    if (p.owner) return { ok: false, msg: `🏷️ ${p.name} is sold at its own sign, not here.` };
    if (!H.spend(C?.game, p.price)) return { ok: false, msg: `🏷️ ${p.name} is ${p.price} cr. You're short ${p.price - H.credits(C?.game)}.` };
    s.owned = true; s.boughtAt = Date.now(); persist(); if (root?.parent) rebuildMarkers(); emit('buy', { plotId: id, price: p.price });
    return { ok: true, msg: `🏠 ${p.name} is yours. Stand on it and tap 🏗️ Build.` };
  },
  place(id, type, i, j, r = 0) {
    if (BC.plotById(id)?.owner) syncOwners(); // add-on lot: same-frame ownership, no 'Buy the lot first' before the next tick
    const s = plotState(id); if (!s) return { ok: false, why: 'No such lot' };
    const v = BC.canPlace(s, type, i, j, r, { credits: H.credits(C?.game), plotId: id }); if (!v.ok) return v;
    if (!H.spend(C?.game, v.cost)) return { ok: false, why: 'Short on credits' };
    const p = BC.addPiece(s, type, i, j, r); persist(); if (root?.parent) rebuildPieces(); emit('place', { plotId: id, type, piece: { ...p } });
    try { BC.PIECES[type].onPlace?.({ plotId: id, piece: { ...p } }); } catch (e) { console.warn('base onPlace', type, e); }
    return { ok: true, why: '', piece: { ...p } };
  },
  remove(id, pieceId) {
    const s = plotState(id), p = s && s.pieces.find(q => q.id === pieceId); if (!p) return { ok: false, msg: 'Nothing there' };
    if (p.type === 'stash' && (s.stash.credits || s.stash.medkits)) return { ok: false, msg: '💰 Empty the stash first.' };
    const refund = BC.refundOf(p); BC.removePiece(s, pieceId); turretSt.delete(id + ':' + pieceId); H.give(C?.game, refund); persist(); if (root?.parent) rebuildPieces();
    emit('remove', { plotId: id, type: p.type, pieceId, refund }); return { ok: true, refund, msg: `🗑️ ${BC.PIECES[p.type].name} scrapped. +${refund} cr` };
  },
  deposit(id, { credits = 0, medkits = 0 } = {}) {
    const s = plotState(id); if (!s?.pieces.some(q => q.type === 'stash')) return { ok: false, msg: 'Build a stash first' };
    credits = Math.max(0, credits | 0); medkits = Math.max(0, medkits | 0);
    if (medkits > H.medkits(C?.game)) return { ok: false, msg: 'Not enough medkits' };
    if (credits && !H.spend(C?.game, credits)) return { ok: false, msg: 'Not enough credits' };
    if (medkits) H.addMedkits(C?.game, -medkits); /* C is null until the first surface frame */ s.stash.credits += credits; s.stash.medkits += medkits; persist();
    emit('stash', { plotId: id, op: 'deposit', credits, medkits, stash: { ...s.stash } }); return { ok: true, stash: { ...s.stash } };
  },
  withdraw(id, { credits = 0, medkits = 0 } = {}) {
    const s = plotState(id); if (!s?.pieces.some(q => q.type === 'stash')) return { ok: false, msg: 'Build a stash first' };
    credits = Math.max(0, Math.min(credits | 0, s.stash.credits)); medkits = Math.max(0, Math.min(medkits | 0, s.stash.medkits));
    s.stash.credits -= credits; s.stash.medkits -= medkits; persist(); if (credits) H.give(C?.game, credits); if (medkits) H.addMedkits(C?.game, medkits);
    emit('stash', { plotId: id, op: 'withdraw', credits, medkits, stash: { ...s.stash } }); return { ok: true, stash: { ...s.stash } };
  },
  build: (on = true, id, o = {}) => on ? setBuild(true, id, !!o.force) : setBuild(false), // o.force opens build mode on a build:false lot
  refresh: () => { syncOwners(); return api.owned(); }, syncOwners: () => api.refresh(), // re-read every add-on lot's owned() now
  stashUi: id => stashUi(id || inPlotId), overview: () => overview(),
  // ---- raids (for Steve's SSX.raids or anyone else) ----
  raid(id, opts = {}) {
    const p = BC.plotById(id), s = plotState(id); if (!p || !s?.owned) return { ok: false, msg: 'Not your lot' };
    const c = centres[id] || null, s0 = opts.s ?? 90, rid = opts.id || `base-${id}-${Date.now().toString(36)}`;
    raids.set(id, { until: clock + s0, id: rid, src: 'base' });
    const detail = { plotId: id, id: rid, world: WORLD, pos: c ? { x: c.x, z: c.z } : null, aj: [...p.aj], radius: BC.HALF * 1.6, pieces: s.pieces.map(q => ({ ...q })), turrets: s.pieces.filter(q => q.type === 'turret').length, why: opts.why || 'raid', s: s0 };
    const R = window.SSX?.raids; let via = 'base';
    // Steve's engine (modes/raids.js, PR #13): start({id, pos, radius, attackers: 'gang'|'colsec', waves, label}) -> {ok, id} | {ok:false, why}
    if (R && typeof R.start === 'function' && c) { subscribeRaids(); try { const r = R.start({ id: rid, pos: { x: c.x, z: c.z }, radius: detail.radius, attackers: opts.attackers === 'colsec' ? 'colsec' : 'gang', waves: opts.waves ?? 2, label: p.name });
        if (r && r.ok !== false) { via = 'SSX.raids'; raids.get(id).until = clock + 3600; raids.get(id).engine = true; } else detail.engineWhy = r?.why || 'refused'; } catch (e) { console.warn('SSX.raids.start failed', e); } }
    emit('raid', { ...detail, via }); return { ok: true, id: rid, via };
  },
  endRaid(id, result = 'ended', fromEngine = false) { const r = raids.get(id); if (!r || r.ended) return false; r.ended = true; r.until = 0;
    if (r.engine && !fromEngine) { try { window.SSX?.raids?.stop?.(r.id, 'base:' + result); } catch (e) { /* engine gone */ } } // its raid:end is ignored: already ended
    emit('raid:end', { plotId: id, id: r.id, result }); return true; },
  damage(id, pieceId, n = 10) {
    const s = plotState(id), p = s?.pieces.find(q => q.id === pieceId); if (!p) return null;
    p.hp = Math.max(0, p.hp - n);
    if (p.hp <= 0) { BC.removePiece(s, pieceId); turretSt.delete(id + ':' + pieceId); if (p.type === 'stash') { const lost = { ...s.stash }; s.stash = { credits: 0, medkits: 0 }; emit('stash:looted', { plotId: id, lost }); } persist(); if (root?.parent) rebuildPieces(); emit('destroyed', { plotId: id, type: p.type, pieceId }); return { destroyed: true }; }
    persist(); emit('damaged', { plotId: id, type: p.type, pieceId, hp: p.hp }); return { destroyed: false, hp: p.hp };
  },
  registerPlot: def => registerPlot(def), registerPiece: def => registerPiece(def), pieceIds: plotId => BC.piecesFor(plotId || null),
  addTargets(fn) { targetSources.add(fn); return () => targetSources.delete(fn); },
  on(evt, fn) { (listeners[evt] ||= []).push(fn); return () => api.off(evt, fn); },
  off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); },
  reload() { S = BC.load(LS); if (root?.parent) rebuildAll(); emit('load', { owned: api.owned() }); },
  debug: { instances: 0, shots: 0, ghost: null, centres: () => ({ ...centres }), cursor: () => build && C ? cursorLocal() : null, raids: () => [...raids.entries()].map(([k, v]) => ({ plotId: k, ...v, armed: v.until > clock })) }
};
export const base = api;

// ---------- Add-on lots and pieces ----------
// SSX.base.registerPlot({ id, name, at: [x, z], district?, price?, blurb?, owned?: () => bool, pieces?: [typeIds], build?: false })
//   build: false hides the base's 🏗️ Build button (and the overview Build) at that lot; place()/remove() still work, and
//   SSX.base.build(true, id, { force: true }) can still open build mode. Ownership is synced synchronously by registerPlot,
//   by place() on an add-on lot, and by SSX.base.refresh() (alias syncOwners()), not only on the next frame.
//   at (alias aj) is relative to the colony centre (Ares Junction), the same frame as the built-in lots, world.colonyAt and
//   the other Mars add-ons (farm, runner, empire). Lots are SIZE x SIZE cells of CELL m (20 x 20 m) centred on at. With
//   owned(), ownership follows your add-on (no Buy button here); without it the lot is bought here for price.
//   pieces limits what can be built there (default: every piece). Walls, gates and turrets work like any lot: turrets fire
//   when you're wanted or a raid (SSX.raids or base.raid) lands inside it.
// SSX.base.registerPiece({ id, name, icon, cost, hp?, fp: [w, d] cells, max?, h?, color?, colliders?, solid?, blurb?,
//   plots?: [plotIds], parts?: [[geometry, material]] | (THREE, kit) => parts, onPlace?: ({ plotId, piece }) => {} })
//   It shows in the build toolbar (wraps / scrolls, no new HUD button) on the lots it's allowed on.
// Both return { ok, id, replaced } or { ok: false, why }. A duplicate id replaces the old def (built-in ids are refused);
// they never throw. Saved data for a lot or piece type that isn't registered yet is kept and comes back when it registers.
function refreshAfterRegister() {
  S = BC.migrate(JSON.parse(JSON.stringify(S))); syncOwners(true); persist();
  if (root?.parent && C) { layout(C); rebuildAll(); } if (ui) renderTools();
}
export function registerPlot(def) {
  let r; try { r = BC.addPlot(def); } catch (e) { r = { ok: false, why: String(e?.message || e) }; }
  if (!r.ok) { console.warn('SSX.base.registerPlot:', r.why); return { ok: false, why: r.why }; }
  refreshAfterRegister(); emit('plot:register', { plotId: r.id, replaced: r.replaced }); return { ok: true, id: r.id, replaced: r.replaced };
}
export function registerPiece(def) {
  let r; try { r = BC.addPieceType(def); } catch (e) { r = { ok: false, why: String(e?.message || e) }; }
  if (!r.ok) { console.warn('SSX.base.registerPiece:', r.why); return { ok: false, why: r.why }; }
  if (A.parts?.[r.id] && r.replaced) delete A.parts[r.id]; // new look on replace
  if (ghost?.userData.type === r.id) { clearGroup(ghost); ghost = null; }
  refreshAfterRegister(); emit('piece:register', { type: r.id, replaced: r.replaced }); return { ok: true, id: r.id, replaced: r.replaced };
}
// queued calls from add-ons that loaded first: SSX._pendingPlots / SSX._pendingPieces (or window.SSX_pending.{plots,pieces},
// which survives the core replacing window.SSX at boot). Drained at init and on every surface frame (cheap when empty).
function drainPending() {
  if (typeof window === 'undefined') return;
  const qs = [[window.SSX?._pendingPieces, registerPiece], [window.SSX_pending?.pieces, registerPiece], [window.SSX?._pendingPlots, registerPlot], [window.SSX_pending?.plots, registerPlot]];
  for (const [q, fn] of qs) while (Array.isArray(q) && q.length) { try { fn(q.shift()); } catch (e) { /* never throws */ } }
}
function syncOwners(quiet) {
  let changed = false;
  for (const p of BC.PLOTS) { if (!p.owner) continue; let o = false; try { o = !!p.owner(); } catch (e) { continue; } const s = plotState(p.id); if (!s || s.owned === o) continue;
    s.owned = o; if (o && !s.boughtAt) s.boughtAt = Date.now(); changed = true; if (!quiet) emit(o ? 'buy' : 'lost', { plotId: p.id, price: 0, via: 'addon' }); }
  if (changed) { if (!quiet) persist(); if (root?.parent) rebuildAll(); }
}

// raid:* from Steve's SSX.raids (modes/raids.js): its events come through SSX.raids.on() (and the SSX.emit bus), not window.
// A raid whose pos is inside one of your lots arms that lot's turrets; raid:wave / raid:end carry only the id, so match on it.
// Window 'raid:*' CustomEvents are also accepted for any other engine. Handlers are idempotent, so double delivery is harmless.
function onRaidEvent(kind, d) {
  d = d || {}; const pos = d.pos || d.center || null;
  let id = pos ? plotUnder(pos.x, pos.z, (d.radius || 0) + 2) : null;
  if (!id && d.id) for (const [k, r] of raids) if (r.id === d.id && !r.ended) id = k;
  if (!id || !plotState(id).owned) return;
  const r = raids.get(id);
  if (kind === 'end') { if (r && !r.ended && (!d.id || r.id === d.id || r.src === 'raids')) api.endRaid(id, d.result || 'ended', true); return; }
  if (r && r.id === d.id && !r.ended) { r.until = Math.max(r.until, clock + 120);
    if (kind === 'wave' && r.wave !== d.wave) { r.wave = d.wave; emit('raid:wave', { plotId: id, id: d.id, wave: d.wave, waves: d.waves }); } return; }
  if (kind === 'wave' && !pos) return;
  raids.set(id, { until: clock + 600, id: d.id || 'raid', src: 'raids', engine: true, wave: d.wave }); emit(kind === 'wave' ? 'raid:wave' : 'raid', { plotId: id, id: d.id, via: 'SSX.raids', pos, attackers: d.attackers });
}
let raidsSub = null;
function subscribeRaids() { // the engine installs itself on its first tick, so this runs lazily from baseTick/raid()
  const R = typeof window !== 'undefined' && window.SSX?.raids; if (!R || raidsSub === R || typeof R.on !== 'function') return; raidsSub = R;
  for (const k of ['start', 'wave', 'end']) { try { R.on('raid:' + k, d => onRaidEvent(k, d)); } catch (e) { /* old engine */ } }
}

function init() {
  if (api.ready || typeof window === 'undefined') return; const app = window.__app; if (!app || typeof window.SSX?.registerSurfaceTick !== 'function') return; // wait for the core add-on API
  api.ready = true; window.SSX.base = api; app.base = api; drainPending();
  try { window.SSX.registerSurfaceTick?.(baseTick); } catch (e) { console.warn('base tick', e); } // core runs it every surface frame (returns an unregister fn)
  for (const k of ['start', 'wave', 'end']) addEventListener('raid:' + k, e => onRaidEvent(k, e?.detail)); subscribeRaids();
  try { menuBtn = H.addMenuItem(app, { id: 'baseMenu', label: '🏠 Mars base', onTap: () => overview() }); if (menuBtn && C?.name !== WORLD) menuBtn.style.display = 'none'; } catch (e) { console.warn('base menu', e); }
  emit('load', { owned: api.owned() });
}
if (typeof window !== 'undefined') {
  let n = 0; const poll = () => { init(); if (!api.ready && n++ < 600) setTimeout(poll, 100); }; setTimeout(poll, 0);
}
