// v7.3 street racing: checkpoint-gate race tracks on planet surfaces (start/finish arch, 3-2-1 countdown, lap timer,
// best laps + best-lap ghost in localStorage, an AI rival on a spline, credits purse with a buy-in) and the hooks for the
// track builder (trackbuilder.js). Pure track maths lives in racecore.js.
//
// Wiring: surface.js calls raceTick(dt, ctx) once at the end of every surface update (the only hook). Everything else
// (DOM, ☰ menu entries, the context button, minimap gate) is set up lazily from here. All geometry and materials are
// flagged userData.shared so surface.exit()'s dispose pass leaves them alone; we re-add our root after scene.clear().
import * as THREE from 'three';
import { buildVehicle, VEHICLES } from './world.js?v=7.2';
import { QUESTS } from './game.js?v=7.2';
import * as RC from './racecore.js';
import { createBuilder } from './trackbuilder.js';

const LS = (() => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; } })();
let C = null;                       // latest surface context from the hook
let lastTick = 0, planet = null, root = null, idleG = null, raceG = null;
let data = RC.loadRace(LS);
let R = null;                       // active race
let builder = null, ui = null, lastResult = null;
const app = () => window.__app;
const toast = (m, ms) => app()?.toast?.(m, ms);

// ---------- shared assets ----------
const A = {};
function assets() {
  if (A.ok) return A; A.ok = true;
  const sh = o => { o.userData.shared = true; return o; };
  // Props are deliberately self-contained here (shared geometry + a few PBR materials, no textures
  // from disk, no real lights) so a later visual pass can swap them for authored models.
  A.column = sh(new THREE.BoxGeometry(0.5, 6.6, 0.5)); A.column.translate(0, 3.3, 0);       // steel gantry leg
  A.brace = sh(new THREE.BoxGeometry(0.12, 2.4, 0.12)); A.brace.rotateZ(0.6); A.brace.translate(0, 1.6, 0);
  A.neonV = sh(new THREE.BoxGeometry(0.1, 5.6, 0.1)); A.neonV.translate(0, 3.2, 0);         // neon tube up the leg's inner face
  A.truss = sh(new THREE.BoxGeometry(1, 0.7, 0.7));                                          // top beam, scaled to the gate width
  A.neonH = sh(new THREE.BoxGeometry(1, 0.12, 0.12));
  A.lamp = sh(new THREE.BoxGeometry(0.9, 0.35, 0.5)); A.lampFace = sh(new THREE.PlaneGeometry(0.75, 0.22)); A.lampFace.rotateX(Math.PI / 2 + 0.5);
  A.pool = sh(new THREE.CircleGeometry(3.2, 16)); A.pool.rotateX(-Math.PI / 2);              // fake floodlight pool on the dirt
  A.bar = A.truss;
  A.mSteel = sh(new THREE.MeshStandardMaterial({ color: 0x8a8e95, roughness: 0.45, metalness: 0.35 }));
  A.mConcrete = sh(new THREE.MeshStandardMaterial({ color: 0x8c8780, roughness: 0.95, metalness: 0 }));
  A.mFlood = sh(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff1cc, emissiveIntensity: 2.2, roughness: 0.3 }));
  A.mPool = sh(new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
  A.banner = sh(new THREE.PlaneGeometry(1, 1));
  A.beam = sh(new THREE.CylinderGeometry(0.9, 0.9, 70, 10, 1, true)); A.beam.translate(0, 35, 0);
  A.foot = sh(new THREE.BoxGeometry(1.4, 0.7, 1.4)); A.foot.translate(0, 0.2, 0); // concrete footing
  A.mNext = sh(new THREE.MeshBasicMaterial({ color: 0xffb020, fog: false }));
  A.mNext2 = sh(new THREE.MeshBasicMaterial({ color: 0xff2a7a }));
  A.mIdle = sh(new THREE.MeshStandardMaterial({ color: 0x220a18, roughness: 0.4, metalness: 0.1, emissive: 0xff2a7a, emissiveIntensity: 0.35 })); // unlit neon
  A.mSel = sh(new THREE.MeshBasicMaterial({ color: 0x38e1ff, fog: false }));
  A.mDark = sh(new THREE.MeshStandardMaterial({ color: 0x202228, roughness: 0.8 }));
  A.mBeam = sh(new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  A.mGhost = sh(new THREE.MeshBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  A.mLine = sh(new THREE.LineBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.85, fog: false }));
  A.checker = sh(canvasMat(512, 128, x => {
    for (let i = 0; i < 32; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#eee'; x.fillRect(i * 16, j * 16, 16, 16); }
    x.fillStyle = 'rgba(10,10,14,0.82)'; x.fillRect(64, 26, 384, 76); x.font = '900 54px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#ff3a8a'; x.shadowBlur = 18; x.fillStyle = '#ff5aa0'; x.fillText('START \u00b7 FINISH', 256, 66);
  }));
  A.chev = sh(canvasMat(128, 256, x => {
    x.fillStyle = 'rgba(0,40,60,0.6)'; x.fillRect(0, 0, 128, 256); x.strokeStyle = '#4ff0ff'; x.lineWidth = 14; x.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const y = 200 - k * 70; x.beginPath(); x.moveTo(20, y + 30); x.lineTo(64, y - 10); x.lineTo(108, y + 30); x.stroke(); }
  }, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  A.stripe = sh(canvasMat(256, 64, x => { for (let i = -2; i < 12; i++) { x.fillStyle = i % 2 ? '#d8d8d0' : '#d03020'; x.beginPath(); x.moveTo(i * 28, 64); x.lineTo(i * 28 + 28, 64); x.lineTo(i * 28 + 60, 0); x.lineTo(i * 28 + 32, 0); x.fill(); } }, { lit: true }));
  A.rampM = sh(canvasMat(128, 128, x => { // worn diamond-plate steel
    x.fillStyle = '#7c8088'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#a3a8b0';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.save(); x.translate(i * 16 + 8 + (j % 2) * 4, j * 16 + 8); x.rotate(j % 2 ? 0.8 : -0.8); x.fillRect(-5, -1.5, 10, 3); x.restore(); }
    x.fillStyle = 'rgba(70,40,20,0.25)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * 128, Math.random() * 128, 6, 3);
  }, { lit: true, roughness: 0.5, metalness: 0.3, flatShading: true }));
  A.rampM.map.wrapS = A.rampM.map.wrapT = THREE.RepeatWrapping;
  A.rail = sh(new THREE.BoxGeometry(0.18, 0.5, 8.2));
  A.grate = sh(new THREE.PlaneGeometry(4.6, 7.6)); A.grate.rotateX(-Math.PI / 2);
  A.mGrate = sh(new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6, metalness: 0.3 }));
  A.ramp = sh(wedge(6, 8, 1.9));
  A.barrierG = sh(jersey(6, 1.1));
  A.band = sh(new THREE.BoxGeometry(6.02, 0.22, 0.42)); A.band.translate(0, 0.78, 0);
  A.mConcreteB = sh(canvasMat(256, 64, x => { // weathered concrete, cast-seam lines and grime
    x.fillStyle = '#8f8a82'; x.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 900; i++) { const v = 110 + Math.random() * 60 | 0; x.fillStyle = `rgba(${v},${v - 4},${v - 10},0.35)`; x.fillRect(Math.random() * 256, Math.random() * 64, 2, 2); }
    x.fillStyle = 'rgba(40,30,20,0.35)'; x.fillRect(0, 50, 256, 14); x.fillStyle = 'rgba(0,0,0,0.25)'; for (const k of [0, 85, 170]) x.fillRect(k, 0, 2, 64);
  }, { lit: true, roughness: 0.95 }));
  A.pad = sh(new THREE.PlaneGeometry(4, 7)); A.pad.rotateX(-Math.PI / 2);
  A.nums = {};
  return A;
}
function canvasMat(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
  const { lit, ...rest } = o;
  if (lit) { const { roughness = 0.6, metalness = 0, flatShading = false } = rest; return new THREE.MeshStandardMaterial({ map: t, roughness, metalness, flatShading }); }
  return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, ...rest });
}
function jersey(len, h) { // New Jersey barrier cross-section extruded along x
  const sh = new THREE.Shape(), b = 0.42, m = 0.2, t = 0.12;
  sh.moveTo(-b, 0); sh.lineTo(b, 0); sh.lineTo(b - 0.05, 0.25); sh.lineTo(m, 0.45); sh.lineTo(t, h); sh.lineTo(-t, h); sh.lineTo(-m, 0.45); sh.lineTo(-b + 0.05, 0.25); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(-len / 2, 0, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / len * 2, uv.getY(i)); // keep the texture from smearing
  return g;
}
function wedge(w, l, h) { // ramp rising toward local -z
  const g = new THREE.BufferGeometry(), x = w / 2, z = l / 2;
  const v = [[-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z], [-x, h, -z], [x, h, -z]];
  const f = [[0, 1, 5], [0, 5, 4], [3, 4, 5], [3, 5, 2], [0, 4, 3], [1, 2, 5], [0, 3, 2], [0, 2, 1]];
  const pos = []; for (const t of f) for (const i of t) pos.push(...v[i]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 2 + pos[i + 1] / 2, pos[i + 2] / 2); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
function labelSprite(text, color = '#ffd25a', w = 16) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112; const x = c.getContext('2d');
  x.font = '900 52px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const tw = Math.min(500, x.measureText(text).width + 40); x.fillStyle = 'rgba(8,8,14,0.78)'; x.fillRect(256 - tw / 2, 12, tw, 88);
  x.strokeStyle = color; x.lineWidth = 4; x.strokeRect(256 - tw / 2, 12, tw, 88); x.shadowColor = color; x.shadowBlur = 14; x.fillStyle = color; x.fillText(text, 256, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
  const m = new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false }); m.userData.shared = true;
  const s = new THREE.Sprite(m); s.scale.set(w, w * 112 / 512, 1); return s;
}
function numSprite(n) {
  const a = assets(); if (!a.nums[n]) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = n === 1 ? '#ff5aa0' : '#ffd25a'; x.beginPath(); x.arc(32, 32, 29, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#111'; x.font = '900 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 32, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
    a.nums[n] = new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, fog: false }); a.nums[n].userData.shared = true;
  }
  const s = new THREE.Sprite(a.nums[n]); s.renderOrder = 5; return s;
}
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

// ---------- world objects ----------
const H = (x, z) => C ? C.height(x, z) : 0;
export function buildGate(g, start = false, w = RC.GATE_W) {
  const a = assets(), grp = new THREE.Group(), hc = H(g.x, g.z), lx = Math.cos(g.yaw), lz = -Math.sin(g.yaw);
  grp.position.set(g.x, hc, g.z); grp.rotation.y = g.yaw;
  const parts = [];
  // steel gantry on concrete footings; only the neon tubes ("parts") change colour for next/idle/selected
  const legs = [];
  for (const s of [-1, 1]) {
    const dy = H(g.x + lx * s * w / 2, g.z + lz * s * w / 2) - hc, x = s * w / 2;
    const leg = mesh(a.column, a.mSteel, x, dy - 0.2, 0), br = mesh(a.brace, a.mSteel, x - s * 0.55, dy, 0); br.scale.x = s;
    const n = mesh(a.neonV, a.mIdle, x - s * 0.3, dy - 0.2, 0);
    grp.add(leg, br, n, mesh(a.foot, a.mConcrete, x, dy - 0.25, 0)); parts.push(n); legs.push(leg);
  }
  const top = Math.max(legs[0].position.y, legs[1].position.y) + 6.6;
  const bar = mesh(a.truss, a.mSteel, 0, top, 0); bar.scale.x = w + 0.8; grp.add(bar);
  const nh = mesh(a.neonH, a.mIdle, 0, top - 0.42, 0.2); nh.scale.x = w - 0.4; grp.add(nh); parts.push(nh);
  for (const s of [-1, 1]) { // floodlights hanging off the truss, with a cheap additive pool on the ground
    const lp = mesh(a.lamp, a.mSteel, s * w * 0.28, top - 0.5, 0.45); lp.rotation.x = -0.5; grp.add(lp, mesh(a.lampFace, a.mFlood, s * w * 0.28, top - 0.7, 0.62));
    if (start) { const pl = mesh(a.pool, a.mPool, s * w * 0.28, 0.08, 3.2); pl.renderOrder = 1; grp.add(pl); }
  }
  if (start) { const b = mesh(a.banner, a.checker, 0, top - 1.5, 0.36); b.scale.set(w * 0.8, w * 0.2, 1); grp.add(b); }
  const beam = mesh(a.beam, a.mBeam, 0, 0, 0); beam.visible = false; beam.frustumCulled = false; grp.add(beam);
  grp.userData = { parts, beam, top };
  return grp;
}
export function setGateLook(grp, mat, beam = false) { for (const p of grp.userData.parts) p.material = mat; grp.userData.beam.visible = beam; }
export function buildProp(p) {
  const a = assets(); let o;
  if (p.t === 'ramp') o = mesh(a.ramp, a.rampM);
  else if (p.t === 'barrier') o = mesh(a.barrierG, a.mConcreteB);
  else { o = mesh(a.pad, a.chev); o.position.y = 0.12; o.renderOrder = 2; }
  const g = new THREE.Group(); g.add(o);
  if (p.t === 'ramp') for (const s of [-1, 1]) { const r = mesh(a.rail, a.mSteel, s * 3.05, 1.0, 0); r.rotation.x = Math.atan2(1.9, 8); g.add(r); }
  else if (p.t === 'barrier') g.add(mesh(a.band, a.stripe));
  else { const gr = mesh(a.grate, a.mGrate, 0, 0.06, 0); g.add(gr); } g.position.set(p.x, H(p.x, p.z) + (p.t === 'ramp' ? -0.15 : 0), p.z); g.rotation.y = p.yaw || 0;
  return g;
}
export function pathLine(t, sel = -1) { // ground line through the gates (builder preview)
  const a = assets(), pts = [], g = t.gates; if (g.length < 2) return null;
  const segs = t.loop && g.length > 2 ? g.length : g.length - 1;
  for (let i = 0; i < segs; i++) { const p = g[i], q = g[(i + 1) % g.length], L = Math.hypot(q.x - p.x, q.z - p.z), k = Math.max(1, Math.ceil(L / 4));
    for (let j = 0; j <= k; j++) { const x = p.x + (q.x - p.x) * j / k, z = p.z + (q.z - p.z) * j / k; pts.push(new THREE.Vector3(x, H(x, z) + 0.6, z)); } }
  const geo = new THREE.BufferGeometry().setFromPoints(pts); const l = new THREE.Line(geo, a.mLine); l.frustumCulled = false; l.renderOrder = 3; return l;
}
export function buildTrackGroup(t, { numbers = false } = {}) {
  const grp = new THREE.Group(); grp.userData.gates = []; grp.userData.props = [];
  t.gates.forEach((g, i) => { const o = buildGate(g, i === 0 && t.loop || (i === t.gates.length - 1 && !t.loop)); grp.add(o); grp.userData.gates.push(o);
    if (numbers) { const n = numSprite(i + 1); n.position.set(0, o.userData.top + 2.6, 0); n.scale.set(4.2, 4.2, 1); o.add(n); } });
  for (const p of t.props) { const o = buildProp(p); grp.add(o); grp.userData.props.push(o); }
  return grp;
}
function disposeGroup(g) { if (!g) return; g.parent?.remove(g); g.traverse(o => { if ((o.isLine || o.isMesh) && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }

// ---------- tracks ----------
let questTracks = null;
function allDefs() { questTracks ??= RC.questSprints(QUESTS); return [...RC.PRESETS, ...questTracks, ...data.tracks]; }
function defsHere() { return allDefs().filter(d => d.world === planet); }
function resolve(def) { return RC.resolveTrack(def, C?.world?.colony); }

function setupPlanet() {
  disposeGroup(root); root = new THREE.Group(); root.name = 'raceRoot'; C.scene.add(root);
  idleG = new THREE.Group(); root.add(idleG); raceG = null; planet = C.name;
  rebuildIdle();
}
function rebuildIdle() {
  if (!idleG) return; for (const c of [...idleG.children]) disposeGroup(c);
  for (const d of defsHere()) {
    const t = resolve(d), g0 = t.gates[0], o = buildGate(g0, true); setGateLook(o, A.mIdle);
    const lab = labelSprite('\ud83c\udfc1 ' + d.name.toUpperCase(), d.custom ? '#7dd3fc' : '#ffd25a', d.pit ? 18 : 13); lab.position.set(0, o.userData.top + 3.2, 0); o.add(lab);
    o.userData.def = d; idleG.add(o);
  }
}

// ---------- vehicles for the rival and the ghost ----------
function buildRivalCar(kind) {
  const k = VEHICLES[kind] ? kind : 'buggy', v = buildVehicle(k === 'rover' ? 'buggy' : k);
  return { ...v, kind: k, spec: VEHICLES[k] };
}
function buildGhostCar(kind) {
  const v = buildRivalCar(kind === 'rover' ? 'buggy' : kind); v.group.traverse(o => { if (o.isMesh) o.material = A.mGhost; }); return v;
}
function poseCar(v, x, z, yaw, dt = 0, speed = 0) {
  const h = H(x, z), fx = -Math.sin(yaw), fz = -Math.cos(yaw), hover = v.spec?.hover || 0;
  const pitch = Math.atan2(H(x + fx * 2, z + fz * 2) - H(x - fx * 2, z - fz * 2), 4);
  v.group.position.set(x, h + (hover ? hover : 0), z); v.group.rotation.set(pitch, yaw, 0, 'YXZ');
  for (const w of v.wheels || []) w.spin.rotation.x -= speed * dt / 0.48;
}

// ---------- race ----------
function myCar() { return C?.car || null; }
export function startRace(idOrDef, opts = {}) {
  if (!C || !planet) return { ok: false, why: 'land first' };
  if (R) return { ok: false, why: 'already racing' };
  if (builder?.open) builder.close(true);
  const def = typeof idOrDef === 'string' ? allDefs().find(d => d.id === idOrDef) : idOrDef;
  if (!def) return { ok: false, why: 'no such track' };
  if (def.world !== planet) return { ok: false, why: `that track is on ${def.world}` };
  const t = resolve(def); if (t.gates.length < 2) return { ok: false, why: 'track needs at least 2 gates' };
  if (C.game.isDown()) return { ok: false, why: 'busy' };
  // need a ride: hop in your rover if you're on foot
  const S = app()?.surface;
  if (!myCar()) {
    const r = S?.summonRover?.(); const i = S?.info;
    if (i && r?.ok !== false) { C.player.x = i.roverX + 2.5; C.player.z = i.roverZ + 1.5; }
    S?.interact?.();
    if (!S?.info?.driving) return { ok: false, why: 'get in a ride first' };
  }
  const grid = RC.startGrid(t, 7, -2.5);
  raceG = buildTrackGroup(t); root.add(raceG); idleG.visible = false;
  const rivalDef = def.rival || { name: 'Rival', kind: 'buggy' }, path = RC.buildPath(t);
  const rv = opts.noRival ? null : buildRivalCar(rivalDef.kind); if (rv) { root.add(rv.group); }
  const ghostFlat = loadGhost(def.id), gh = ghostFlat ? buildGhostCar(rivalDef.kind) : null; if (gh) { gh.group.visible = false; root.add(gh.group); }
  const rg = RC.startGrid(t, 7, 2.8), startDist = t.loop ? -7 : 0;
  R = { def, t, path, phase: 'grid', count: 3.4, time: 0, lapStart: 0, lap: 0, next: t.loop ? 1 : 0, passed: 0, laps: [], best: data.best[def.id] ?? null,
    grid, rival: rv ? { v: rv, name: rivalDef.name, dist: startDist, grid: rg, d0: startDist, finish: null, pace: t.loop ? path.total / (def.par || 40) : path.total / (def.par || 40), lastProg: 0 } : null,
    ghost: gh ? { v: gh, flat: ghostFlat } : null, rec: [], recT: 0, prev: { x: grid.x, z: grid.z }, onFoot: 0, stall: 0, broke: false, paid: false, beeped: 4, cool: new Map() };
  lastResult = null; showResult(null);
  sfx('rev'); updateMenuLabels(); return { ok: true, id: def.id };
}
export function quitRace(why = 'Race abandoned.') {
  if (!R) return false;
  const r = R; R = null; cleanupRace(r); if (why) toast(`\ud83c\udff3 ${why}`, 2600); updateMenuLabels(); return true;
}
function cleanupRace(r) {
  disposeGroup(raceG); raceG = null; if (idleG) idleG.visible = true;
  if (r?.rival) r.rival.v.group.parent?.remove(r.rival.v.group); if (r?.ghost) r.ghost.v.group.parent?.remove(r.ghost.v.group);
  setChip(null); setCount('');
}
function holdCar(car, g) {
  car.x = g.x; car.z = g.z; car.yaw = g.yaw; car.y = H(g.x, g.z) + (car.spec?.hover ? car.spec.hover : 0); car.speed = 0; car.vy = 0; car.prevG = null; car.air = false; car.steer = 0;
  if ('lift' in car) car.lift = 0;
}
function updateRace(dt) {
  const r = R, t = r.t, car = myCar();
  // ----- grid + countdown -----
  if (r.phase === 'grid') {
    if (car) holdCar(car, r.grid);
    if (r.rival) poseCar(r.rival.v, r.rival.grid.x, r.rival.grid.z, r.rival.grid.yaw);
    updateGateLooks(); r.count -= dt; const n = Math.ceil(r.count);
    if (n !== r.beeped && n <= 3 && n >= 1) { r.beeped = n; sfx('beep'); }
    setCount(r.count > 3 ? '' : n >= 1 ? String(n) : '');
    if (r.count <= 0) {
      r.phase = 'run'; r.time = 0; r.lapStart = 0; setCount('GO!', true); sfx('go');
      const P = C.game.progress; r.practice = !!r.def.custom && (t.length < RC.MIN_PAID_LEN || t.gates.length < RC.MIN_GATES);
      if (r.practice) r.buyIn = 0; else if (P.credits >= RC.BUY_IN) { P.credits -= RC.BUY_IN; C.game.save(); r.buyIn = RC.BUY_IN; } else { r.broke = true; r.buyIn = 0; }
      r.prev = { x: car ? car.x : r.grid.x, z: car ? car.z : r.grid.z };
    }
    updateChip(); return;
  }
  if (r.phase !== 'run') return;
  r.time += dt; const ms = r.time * 1000;
  if (r.time > 0.9) setCount('');
  // ----- bail-outs -----
  if (C.game.isDown()) return finish(false, 'Wrecked. Your rival sends flowers. Cheap ones.');
  if (!car) { r.onFoot += dt; if (r.onFoot > 10) return finish(false, 'You bailed on the race. The crowd noticed.'); }
  else r.onFoot = 0;
  const pos = car ? { x: car.x, z: car.z } : { x: C.player.x, z: C.player.z };
  // ----- gates -----
  const g = t.gates[r.next];
  if (car && RC.crossedGate(g, r.prev, pos)) {
    r.stall = 0; sfx('gate');
    if (t.loop) {
      if (r.next === 0) { // lap done
        const lapMs = ms - r.lapStart; r.laps.push(lapMs); onLap(lapMs); r.lapStart = ms; r.rec = []; r.recT = 0; r.lap++; r.passed = 0; r.next = 1;
        if (r.lap >= t.laps) return finish(true);
      } else { r.passed++; r.next = (r.next + 1) % t.gates.length; }
    } else {
      r.passed++; r.next++;
      if (r.next >= t.gates.length) { const lapMs = ms; r.laps.push(lapMs); onLap(lapMs); return finish(true); }
    }
  } else r.stall += dt;
  if (r.stall > 90) return finish(false, 'Ninety seconds without a gate. That\u2019s not racing, that\u2019s sightseeing.');
  r.prev = pos;
  // ----- ghost recording + playback -----
  const lapMs = ms - r.lapStart;
  r.recT -= dt; if (r.recT <= 0 && car) { r.recT = 0.1; r.rec.push([lapMs, car.x, car.z, car.yaw]); }
  if (r.ghost) { const p = RC.ghostAt(r.ghost.flat, lapMs); r.ghost.v.group.visible = !!p && !p.done; if (p) poseCar(r.ghost.v, p.x, p.z, p.yaw, dt, 0); }
  // ----- rival -----
  const me = RC.playerProgress(t, r.lap, r.next, r.passed, pos); r.myProg = me;
  if (r.rival && !r.rival.finish) {
    const rv = r.rival, prog = RC.rivalProgress(t, r.path, Math.max(0, rv.dist)); rv.lastProg = prog;
    const gap = prog - me, rubber = gap > 1.5 ? 0.9 : gap < -1.5 ? 1.08 : 1, ramp = Math.min(1, r.time / 2.2);
    const v = rv.pace * rubber * ramp * (1 + 0.07 * Math.sin(rv.dist / 37));
    rv.dist += v * dt;
    const total = t.loop ? r.path.total * t.laps : r.path.total;
    if (rv.dist >= total) { rv.finish = ms; toast(`\ud83c\udfc1 ${rv.name} crossed the line in ${RC.fmtTime(ms)}.`, 2600); }
    const p = rivalPose(r, rv); poseCar(rv.v, p.x, p.z, p.yaw, dt, v);
  }
  updateGateLooks(); updateChip();
}
// rival position: behind gate 0 it rolls up from its grid slot, then follows the spline; its grid side offset fades out
function rivalPose(r, rv) {
  const t = r.t, g0 = t.gates[0];
  let p;
  if (rv.dist < 0) { const fx = -Math.sin(g0.yaw), fz = -Math.cos(g0.yaw); p = { x: g0.x + fx * rv.dist, z: g0.z + fz * rv.dist, yaw: g0.yaw }; }
  else p = RC.pathAt(r.path, rv.dist);
  const k = Math.max(0, 1 - (rv.dist - rv.d0) / 14), lx = Math.cos(p.yaw), lz = -Math.sin(p.yaw);
  return { x: p.x + lx * 2.8 * k, z: p.z + lz * 2.8 * k, yaw: p.yaw };
}
function onLap(lapMs) {
  const r = R, id = r.def.id;
  if (r.best == null || lapMs < r.best) {
    r.newBest = true; r.best = lapMs; data.best[id] = Math.round(lapMs); RC.saveRace(LS, data);
    if (r.rec.length > 5) { r.rec.push([lapMs, myCar()?.x ?? r.prev.x, myCar()?.z ?? r.prev.z, myCar()?.yaw ?? 0]); try { LS.setItem(RC.GHOST_PREFIX + id, JSON.stringify(RC.packGhost(r.rec))); } catch (e) { /* full */ } }
    if (r.t.loop && r.lap + 1 < r.t.laps) toast(`\u23f1 New best lap ${RC.fmtTime(lapMs)}!`, 2200);
  }
}
function loadGhost(id) { try { const f = JSON.parse(LS.getItem(RC.GHOST_PREFIX + id)); return Array.isArray(f) && f.length >= 8 ? f : null; } catch (e) { return null; } }
function finish(done, why) {
  const r = R; if (!r) return; R = null;
  const ms = r.time * 1000, won = done && (!r.rival || !r.rival.finish), id = r.def.id;
  const firstWin = won && !data.wins[id];
  data.runs[id] = (data.runs[id] || 0) + 1; if (won) data.wins[id] = (data.wins[id] || 0) + 1; RC.saveRace(LS, data);
  const pay = done ? RC.payout(r.t, { won, newBest: !!r.newBest, firstWin, custom: !!r.def.custom, broke: r.broke }) : { credits: 0, xp: 0, note: '' };
  const P = C.game.progress; P.credits += pay.credits; P.xp += pay.xp; C.game.save();
  const rivalName = r.rival?.name || 'Rival';
  const line = !done ? why : r.practice ? `${rivalName}: "Practice laps don\u2019t pay. Build something longer and we\u2019ll talk money."` : won ? pick([`${rivalName}: "Lucky. Do it again and I\u2019ll call it skill."`, `${rivalName}: "Fine. Take the purse. I\u2019ll take your paint next time."`, `${rivalName}: "Cheater. I respect it."`])
    : pick([`${rivalName}: "Nice try. Buy-in\u2019s mine."`, `${rivalName}: "You drive like you\u2019re on rent."`, `${rivalName}: "Come back when your ride stops rattling."`]);
  lastResult = { id, name: r.def.name, done, won, time: Math.round(ms), laps: r.laps.map(Math.round), best: data.best[id] ?? null, newBest: !!r.newBest, credits: pay.credits, xp: pay.xp, buyIn: r.buyIn || 0, note: pay.note, line, rivalTime: r.rival?.finish ? Math.round(r.rival.finish) : null, firstWin };
  cleanupRace(r); sfx(won ? 'win' : 'lose'); showResult(lastResult); updateMenuLabels();
  return lastResult;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function updateGateLooks() {
  if (!raceG || !R) return; const gs = raceG.userData.gates, n = gs.length, nx = R.next, nx2 = R.t.loop ? (nx + 1) % n : nx + 1;
  if (R.lookKey === nx) { const b = gs[nx]?.userData.beam; if (b) b.material.opacity = 0.16 + 0.1 * Math.sin(R.time * 6); return; }
  R.lookKey = nx; gs.forEach((o, i) => setGateLook(o, i === nx ? A.mNext : i === nx2 ? A.mNext2 : A.mIdle, i === nx));
}

// ---------- props: ramps launch, boost pads kick, barriers block (cars and people) ----------
function propPhysics(props, dt) {
  const car = myCar(), now = performance.now();
  for (const p of props) {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), lx = Math.cos(p.yaw), lz = -Math.sin(p.yaw);
    const ent = car || C.player, r = car ? (car.spec?.r || 2.4) * 0.75 : 0.45;
    const dx = ent.x - p.x, dz = ent.z - p.z; if (dx * dx + dz * dz > 144) continue;
    const along = dx * fx + dz * fz, lat = dx * lx + dz * lz, key = p, cd = (R?.cool || propCool).get(key) || 0;
    if (p.t === 'barrier') {
      if (Math.abs(lat) < 3 + r && Math.abs(along) < 0.4 + r) {
        const push = (Math.sign(along) || 1) * (0.4 + r) - along; ent.x += fx * push; ent.z += fz * push;
        if (car && Math.abs(car.speed) > 3) { if (now > cd) { sfx('crash'); (R?.cool || propCool).set(key, now + 400); } car.speed *= -0.3; }
      }
    } else if (car && now > cd) {
      if (p.t === 'ramp' && Math.abs(lat) < 3.2 && Math.abs(along) < 4 && (!car.air || car.y - H(car.x, car.z) < 0.9) && (car.vy || 0) < 2 && Math.abs(car.speed) > 3) {
        if (car.spec?.hover) car.lift = Math.min(18, (car.lift || 0) + 3 + Math.abs(car.speed) * 0.25);
        else { car.vy = Math.max(car.vy || 0, 3 + Math.abs(car.speed) * 0.42); car.y += 0.4; car.air = true; }
        (R?.cool || propCool).set(key, now + 900); sfx('jump');
      } else if (p.t === 'boost' && Math.abs(lat) < 2.3 && Math.abs(along) < 3.6) {
        const b = (car.spec?.boost || 30) * 1.2; if (car.speed < b) car.speed = b; (R?.cool || propCool).set(key, now + 700); sfx('boost');
      }
    }
  }
}
const propCool = new Map();

// ---------- HUD ----------
const CSS = `
#raceChip { display: none; padding: 4px 9px; border-radius: 9px; font-size: 0.7rem; line-height: 1.35; background: rgba(8,10,20,0.7); border: 1px solid rgba(255,90,160,0.55); text-shadow: 0 1px 2px #000; color: #fff; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
#raceChip.on { display: block; } #raceChip b { color: #ff7ab0; } #raceChip .t { font-size: 0.95rem; font-weight: 900; color: #fff; } #raceChip .p1 { color: #4ade80; font-weight: 900; } #raceChip .p2 { color: #fca5a5; font-weight: 900; } #raceChip .warn { color: #fbbf24; }
#raceCount { position: fixed; left: 0; right: 0; top: 31%; text-align: center; font: 900 4.2rem system-ui, sans-serif; color: #ffd25a; text-shadow: 0 0 18px #ff3a8a, 0 2px 6px #000; pointer-events: none; z-index: 9; display: none; }
#raceCount.on { display: block; } #raceCount.go { color: #4ade80; }
#raceResult { display: none; padding: 7px 9px; border-radius: 11px; font-size: 0.7rem; line-height: 1.3; background: rgba(8,10,20,0.88); border: 1px solid rgba(255,210,90,0.6); color: #fff; max-width: 250px; text-align: left; }
#raceResult.on { display: block; } #raceResult h4 { margin: 0 0 3px; font-size: 0.9rem; color: #ffd25a; } #raceResult .row { display: flex; gap: 6px; margin-top: 6px; }
#raceResult button { flex: 1; min-height: 34px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; color: #fff; background: rgba(40,56,96,0.95); border: 1px solid rgba(120,160,255,0.35); touch-action: none; }
#raceCtxBtn { background: linear-gradient(135deg, rgba(255,42,122,0.75), rgba(255,154,60,0.75)) !important; border-color: rgba(255,210,90,0.6) !important; }
#racePanel { position: fixed; inset: 0; z-index: 14; display: none; background: rgba(8,4,12,0.95); overflow-y: auto; -webkit-overflow-scrolling: touch; color: #fff;
  padding: calc(16px + var(--sat, 0px)) calc(16px + var(--sar, 0px)) calc(24px + var(--sab, 0px)) calc(16px + var(--sal, 0px)); box-sizing: border-box; }
#racePanel.on { display: block; } #racePanel .wrap { max-width: 640px; margin: 0 auto; } #racePanel h2 { margin: 6px 0 2px; } #racePanel .sub { opacity: 0.7; font-size: 0.8rem; margin-bottom: 10px; }
#racePanel .item { padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.06); margin-bottom: 8px; font-size: 0.84rem; border: 1px solid rgba(255,255,255,0.08); }
#racePanel .item.custom { border-color: rgba(125,211,252,0.35); } #racePanel .item small { opacity: 0.72; display: block; margin-top: 2px; }
#racePanel .item .row { display: flex; gap: 6px; margin-top: 8px; } #racePanel button { min-height: 40px; border-radius: 10px; font-weight: 800; color: #fff; background: rgba(40,56,96,0.95); border: 1px solid rgba(120,160,255,0.35); padding: 0 12px; font-size: 0.82rem; }
#racePanel button.go { background: linear-gradient(135deg, rgba(255,42,122,0.95), rgba(255,154,60,0.95)); border: none; flex: 1; }
#racePanel .close { float: right; } #racePanel .foot { display: flex; gap: 8px; margin-top: 12px; } #racePanel .foot button { flex: 1; }
`;
function ensureUI() {
  if (ui && document.getElementById('raceChip')) return ui;
  const st = document.createElement('style'); st.id = 'raceCss'; st.textContent = CSS + (builder?.css || ''); document.head.appendChild(st);
  const stack = document.getElementById('stackR'), btns = document.getElementById('surfBtns'), menu = document.getElementById('roverMenu');
  const chip = document.createElement('div'); chip.id = 'raceChip'; stack?.prepend(chip);
  const res = document.createElement('div'); res.id = 'raceResult'; chip.after(res);
  const count = document.createElement('div'); count.id = 'raceCount'; document.getElementById('surfHud')?.appendChild(count);
  const ctx = document.createElement('button'); ctx.id = 'raceCtxBtn'; ctx.className = 'glass'; ctx.style.display = 'none'; ctx.textContent = '\ud83c\udfc1 Race';
  btns?.prepend(ctx); tapButton(ctx, () => { const d = ui.near; if (d) { const r = startRace(d.id); if (!r.ok) toast(`\ud83d\udeab ${r.why}`, 2500); else toast(`\ud83c\udfc1 ${d.name}: buy-in ${RC.BUY_IN} cr. Beat ${d.rival?.name || 'the rival'}.`, 2600); } });
  const mRace = document.createElement('button'); mRace.id = 'rmRaces'; mRace.className = 'btn'; mRace.textContent = '\ud83c\udfc1 Street races';
  const mBuild = document.createElement('button'); mBuild.id = 'rmBuilder'; mBuild.className = 'btn'; mBuild.textContent = '\ud83d\udee0 Track builder';
  const before = document.getElementById('settingsBtn'); if (menu) { menu.insertBefore(mRace, before); menu.insertBefore(mBuild, before); }
  mRace.addEventListener('click', () => { menu.classList.remove('show'); if (R) quitRace('You walked away from the race. Buy-in stays on the table.'); else openPanel(); });
  mBuild.addEventListener('click', () => { menu.classList.remove('show'); openBuilder(); });
  const panel = document.createElement('div'); panel.id = 'racePanel'; document.body.appendChild(panel);
  panel.addEventListener('click', onPanelClick);
  // keys stay ours while a race panel or the builder is open (Escape closes)
  window.addEventListener('keydown', e => {
    if (panel.classList.contains('on')) { e.stopImmediatePropagation(); if (e.code === 'Escape') closePanel(); }
    else if (builder?.open) { e.stopImmediatePropagation(); if (e.target?.tagName === 'INPUT') return; if (e.code === 'Escape') builder.close(); else builder.key(e); }
  }, true);
  ui = { chip, res, count, ctx, mRace, mBuild, panel, near: null, chipT: 0, ctxT: 0 };
  return ui;
}
// pointer-based taps (work with a thumb already on the joystick; iOS drops click on multi-touch)
// A touch fires on pointerdown, so the browser's follow-up click can land on whatever slid into the
// button's spot (the game's own Exit/Drive button once this one hides). Swallow that ghost click.
let ghostUntil = 0;
if (typeof document !== 'undefined') document.addEventListener('click', e => { if (e.detail !== 0 && performance.now() < ghostUntil) { e.preventDefault(); e.stopPropagation(); ghostUntil = 0; } }, true);
export function tapButton(el, fn) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); unlockAudio(); if (e.pointerType !== 'mouse') ghostUntil = performance.now() + 650; fn(e); });
  el.addEventListener('click', e => { if (e.detail === 0) fn(e); }); // keyboard activation
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function setChip(html) { if (!ui) return; if (html == null) { ui.chip.classList.remove('on'); ui.chip.innerHTML = ''; return; } ui.chip.innerHTML = html; ui.chip.classList.add('on'); }
function setCount(s, go = false) { if (!ui) return; if (ui.count.textContent !== s) ui.count.textContent = s; ui.count.classList.toggle('on', !!s); ui.count.classList.toggle('go', go || s === 'GO!'); }
function updateChip() {
  const r = R; if (!r || !ui) return; ui.chipT -= 1; if (ui.chipT > 0) return; ui.chipT = 5;
  const t = r.t, n = t.gates.length, lapMs = (r.time * 1000) - r.lapStart;
  const lapTxt = t.loop ? `Lap ${Math.min(r.lap + 1, t.laps)}/${t.laps}` : 'Sprint';
  const gateTxt = `Gate ${t.loop ? (r.next === 0 ? n : r.next) : r.next + 1}/${n}`;
  let pos = '';
  if (r.rival && r.phase === 'run') { const ahead = r.rival.finish || r.rival.lastProg > (r.myProg ?? 0); pos = ahead ? '<span class="p2">P2</span>' : '<span class="p1">P1</span>'; }
  const warn = !myCar() && r.phase === 'run' ? ' <span class="warn">\u26a0 get back in!</span>' : '';
  setChip(`<b>\ud83c\udfc1 ${esc(r.def.name)}</b> ${pos}${warn}<br><span class="t">${r.phase === 'grid' ? '0:00.00' : RC.fmtTime(lapMs)}</span> \u00b7 ${lapTxt} \u00b7 ${gateTxt}<br>Best ${RC.fmtTime(r.best ?? NaN)}${r.ghost ? ' \u00b7 \ud83d\udc7b ghost' : ''}`);
}
function showResult(res) {
  if (!ui) return; ui.resLeft = 0;
  if (!res) { ui.res.classList.remove('on'); return; }
  const head = !res.done ? '\ud83c\udff3 DNF' : res.won ? '\ud83c\udfc6 YOU WIN' : '\ud83e\udd48 SECOND';
  const money = res.done ? `${res.buyIn ? `Buy-in \u2212${res.buyIn} \u00b7 ` : ''}Purse +${res.credits} cr \u00b7 +${res.xp} XP${res.firstWin ? ' \u00b7 first win bonus' : ''}${res.note ? `<br><small>${esc(res.note)}</small>` : ''}` : (res.buyIn ? `Buy-in \u2212${res.buyIn} cr lost` : '');
  ui.res.innerHTML = `<h4>${head} \u00b7 ${esc(res.name)}</h4>${res.done ? `Time ${RC.fmtTime(res.time)} \u00b7 best lap ${RC.fmtTime(res.best ?? NaN)}${res.newBest ? ' \u2b50 NEW' : ''}<br>` : ''}${res.rivalTime ? `Rival ${RC.fmtTime(res.rivalTime)}<br>` : ''}${money}<br><i>${esc(res.line || '')}</i>
    <div class="row"><button id="raceAgain">\ud83d\udd01 Rematch</button><button id="raceResClose">\u2716</button></div>`;
  ui.res.classList.add('on');
  tapButton(ui.res.querySelector('#raceAgain'), () => { showResult(null); const r = startRace(res.id); if (!r.ok) toast(`\ud83d\udeab ${r.why}`, 2500); });
  tapButton(ui.res.querySelector('#raceResClose'), () => showResult(null));
  ui.resLeft = 12; // seconds of game time, so a slow frame rate never hides it before you can tap Rematch
}
function updateMenuLabels() { if (!ui) return; ui.mRace.textContent = R ? '\ud83c\udff3 Quit race' : '\ud83c\udfc1 Street races'; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- race list panel ----------
function openPanel() {
  if (!ensureUI() || !planet) return; const P = C?.game?.progress, defs = defsHere();
  const items = defs.map(d => { const t = resolve(d), best = data.best[d.id], wins = data.wins[d.id] || 0;
    const kind = t.loop ? `${t.laps}-lap loop` : 'sprint', far = C ? Math.round(Math.hypot(t.gates[0].x - C.player.x, t.gates[0].z - C.player.z)) : 0;
    const purse = d.custom ? (t.length < RC.MIN_PAID_LEN ? 'practice (too short for a purse)' : `purse up to ${RC.payout(t, { won: true, custom: true }).credits} cr`) : `purse ${d.purse || 120} cr${wins ? '' : ' + 100 first win'}`;
    return `<div class="item${d.custom ? ' custom' : ''}"><b>${d.custom ? '\ud83d\udee0' : d.fromQuest ? '\ud83d\udcfb' : '\ud83c\udfc1'} ${esc(d.name)}</b> \u00b7 ${kind} \u00b7 ${t.gates.length} gates \u00b7 ${Math.round(t.length)} m
      <small>${esc(d.blurb || 'Your own track.')}</small><small>Rival: ${esc(d.rival?.name || 'Pit Viper')} \u00b7 ${purse} \u00b7 buy-in ${RC.BUY_IN} cr \u00b7 best lap ${RC.fmtTime(best ?? NaN)} \u00b7 wins ${wins} \u00b7 ${far} m away</small>
      <div class="row"><button class="go" data-race="${esc(d.id)}">\ud83c\udfc1 Race</button>${d.custom ? `<button data-edit="${esc(d.id)}">\u270f\ufe0f Edit</button><button data-del="${esc(d.id)}">\ud83d\uddd1</button>` : `<button data-copy="${esc(d.id)}">\ud83d\udee0 Remix</button>`}</div></div>`; }).join('');
  ui.panel.innerHTML = `<div class="wrap"><button class="close" data-close="1">\u2715 Close</button><h2>\ud83c\udfc1 Street Races \u00b7 ${esc(planet)}</h2>
    <div class="sub">Underground rover racing. Win the purse, keep your paint. Racing puts you on the grid at the start line. \ud83d\udcb0 ${P?.credits ?? 0} cr</div>
    ${items || '<div class="item">No tracks on this world yet. Build one!</div>'}
    <div class="foot"><button data-build="1">\ud83d\udee0 Track builder</button><button data-close="1">Close</button></div></div>`;
  ui.panel.classList.add('on');
}
function closePanel() { ui?.panel.classList.remove('on'); }
function onPanelClick(e) {
  const b = e.target.closest('button'); if (!b) return; unlockAudio();
  if (b.dataset.close) return closePanel();
  if (b.dataset.build) { closePanel(); return openBuilder(); }
  if (b.dataset.race) { closePanel(); const r = startRace(b.dataset.race); if (!r.ok) toast(`\ud83d\udeab ${r.why}`, 2600); return; }
  if (b.dataset.edit || b.dataset.copy) { closePanel(); const d = allDefs().find(x => x.id === (b.dataset.edit || b.dataset.copy)); return openBuilder(d, !!b.dataset.copy); }
  if (b.dataset.del) { if (b.dataset.armed) { deleteTrack(b.dataset.del); openPanel(); } else { b.dataset.armed = '1'; b.textContent = 'Delete?'; } }
}

// ---------- custom track storage (used by the builder) ----------
export function saveTrack(t) {
  const c = RC.cleanTrack(t); if (!RC.validTrack(c)) return null;
  const i = data.tracks.findIndex(x => x.id === c.id); if (i >= 0) data.tracks[i] = c; else data.tracks.push(c);
  if (!RC.saveRace(LS, data)) return null; rebuildIdle(); return c;
}
export function deleteTrack(id) {
  data.tracks = data.tracks.filter(t => t.id !== id); delete data.best[id]; delete data.wins[id]; delete data.runs[id];
  try { LS.removeItem(RC.GHOST_PREFIX + id); } catch (e) { /* ignore */ } RC.saveRace(LS, data); rebuildIdle();
}
function openBuilder(def = null, copy = false) {
  if (!C || !planet) return; if (R) quitRace('Race abandoned for the builder.'); closePanel();
  builder ??= createBuilder({ THREE, RC, ctx: () => C, planet: () => planet, root: () => root, resolve, buildTrackGroup, pathLine, setGateLook, assets, tapButton, toast,
    saveTrack, tracks: () => defsHere(), raceTrack: id => { const r = startRace(id); if (!r.ok) toast(`\ud83d\udeab ${r.why}`, 2600); return r; }, propPhysics, onClose: () => { if (idleG) idleG.visible = true; } });
  if (!document.getElementById('tbCss')) { const st = document.createElement('style'); st.id = 'tbCss'; st.textContent = builder.css; document.head.appendChild(st); }
  idleG.visible = false; builder.openWith(def, copy);
}

// ---------- tiny synth (WebAudio): countdown beeps, gate chimes, boost/jump ----------
let ac = null;
function unlockAudio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } }
function sfx(kind) {
  if (!ac || ac.state !== 'running') return;
  const tone = (f, d, type = 'square', v = 0.06, f2) => { const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02); };
  if (kind === 'beep') tone(440, 0.18); else if (kind === 'go') tone(880, 0.45); else if (kind === 'gate') tone(1180, 0.12, 'triangle', 0.07);
  else if (kind === 'boost') tone(220, 0.4, 'sawtooth', 0.05, 900); else if (kind === 'jump') tone(300, 0.3, 'triangle', 0.06, 600); else if (kind === 'crash') tone(90, 0.25, 'sawtooth', 0.08, 40);
  else if (kind === 'win') { tone(660, 0.2, 'triangle'); setTimeout(() => tone(990, 0.4, 'triangle'), 180); } else if (kind === 'lose') tone(300, 0.5, 'sawtooth', 0.05, 120); else if (kind === 'rev') tone(80, 0.6, 'sawtooth', 0.04, 160);
}

// ---------- the hook ----------
// ctx: { scene, camera, height(x,z), player, car (vehicle you're driving or null), rover, game, world, name }
export function raceTick(dt, ctx) {
  C = ctx; lastTick = performance.now();
  if (!root || !root.parent || planet !== ctx.name) { if (R) { const r = R; R = null; cleanupRace(r); } builder?.close(true); setupPlanet(); }
  ensureUI(); patchGame(ctx.game);
  if (ui.resLeft > 0 && (ui.resLeft -= Math.min(dt, 0.1)) <= 0) ui.res.classList.remove('on');
  if (builder?.open) { builder.tick(dt); ui.ctx.style.display = 'none'; return; }
  if (R) { updateRace(dt); if (R) propPhysics(R.t.props, dt); ui.ctx.style.display = 'none'; return; }
  // idle: show the Race context button near a start line
  ui.ctxT -= dt; if (ui.ctxT > 0) return; ui.ctxT = 0.2;
  let near = null, bd = 18; const px = ctx.car ? ctx.car.x : ctx.player.x, pz = ctx.car ? ctx.car.z : ctx.player.z;
  for (const o of idleG.children) { const d = Math.hypot(o.position.x - px, o.position.z - pz); if (d < bd) { bd = d; near = o.userData.def; } }
  ui.near = near; const show = !!near && !ctx.game.isDown();
  ui.ctx.style.display = show ? 'block' : 'none'; if (show) ui.ctx.textContent = `\ud83c\udfc1 Race`;
}
// minimap: our next gate shows where the quest gate would
const patched = new WeakSet();
function patchGame(game) {
  if (!game || patched.has(game)) return; patched.add(game);
  const orig = game.mapGate;
  game.mapGate = () => { if (R && R.phase !== 'done') { const g = R.t.gates[R.next]; return { x: g.x, z: g.z }; } return orig ? orig() : null; };
}
// leaving the surface (take off / reload) ends a race and hides our HUD
setInterval(() => {
  if (!lastTick || performance.now() - lastTick < 700 || app()?.state?.onSurface) return;
  if (R) { const r = R; R = null; cleanupRace(r); updateMenuLabels(); }
  if (builder?.open) builder.close(true);
  if (ui) { ui.ctx.style.display = 'none'; closePanel(); ui.resLeft = 0; ui.res.classList.remove('on'); }
}, 500);

// ---------- test/debug hooks ----------
window.__race = {
  get state() { return R ? { id: R.def.id, phase: R.phase, lap: R.lap, next: R.next, passed: R.passed, time: R.time, laps: R.laps.slice(), best: R.best, rival: R.rival ? { dist: R.rival.dist, prog: R.rival.lastProg, finish: R.rival.finish } : null, myProg: R.myProg, ghost: !!R.ghost, buyIn: R.buyIn || 0 } : null; },
  get result() { return lastResult; }, get data() { return data; }, get planet() { return planet; },
  tracks: () => defsHere().map(d => { const t = resolve(d); return { id: d.id, name: d.name, loop: t.loop, laps: t.laps, gates: t.gates.map(g => ({ x: g.x, z: g.z, yaw: g.yaw })), props: t.props, length: t.length, custom: !!d.custom }; }),
  start: (id, o) => startRace(id, o), quit: () => quitRace(null), openPanel, closePanel, openBuilder: (id, copy) => openBuilder(id ? allDefs().find(d => d.id === id) : null, copy),
  get builder() { return builder; }, reload() { data = RC.loadRace(LS); rebuildIdle(); },
  skipCountdown() { if (R && R.phase === 'grid') R.count = 0.001; },
  // put the car (or you) somewhere; applied immediately (we run after the surface physics step)
  place(x, z, yaw) { const c = myCar(); if (c) { c.x = x; c.z = z; if (yaw !== undefined) c.yaw = yaw; c.y = H(x, z); c.prevG = null; c.vy = 0; c.air = false; } else { C.player.x = x; C.player.z = z; } },
  car: () => { const c = myCar(); return c ? { x: c.x, z: c.z, y: c.y, yaw: c.yaw, speed: c.speed, air: !!c.air, vy: c.vy, lift: c.lift || 0, kind: c.kind } : null; },
  setCarSpeed(v) { const c = myCar(); if (c) c.speed = v; },
  rivalPace(k) { if (R?.rival) R.rival.pace *= k; },
  counts: () => ({ root: root?.children.length || 0, idle: idleG?.children.length || 0, race: raceG?.children.length || 0, ctx: ui?.ctx.style.display })
};
