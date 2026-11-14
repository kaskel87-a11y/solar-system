// v7.5.21 The Pit landmark (Collin: "And we have an underground fighting pit?"). Turns act-pit-fight's open ground in the
// Flats into a focal point: a square rope-and-chain ring on a stained mat, a gantry (THE PIT sign frame on the west, a
// floodlight mast on the east) with a lamp rig hanging over the ring that lights it at night, a two-row crowd of cheering
// low-poly spectators outside the ropes, and a 🥊 icon on the minimap.
// Window API: SSX.pitRing = { centre(), arm(activityId), debug: { built, counts(), layout(), uncompiled(), night() } }.
// - Layout (pure, tested by tests/test-pit-unit.mjs): mars/pitringcore.js. Nothing stands inside the fight radius; ropes are
//   not solid (step through), posts / sign legs / mast / spectators are small colliders (world.addSolid).
// - The pit fight (activities/runner.js armDuel) calls arm(): the player is put on the ring edge facing the centre and
//   world.challenge({ at }) lines the opponent up through the centre, so the fight happens inside the ropes.
// Perf: built once on the first Mars frame near the Flats; one mesh per material (merged geometry), the crowd is two
// InstancedMesh (arms down / arms up) built from interiors.js buildHuman, ~11 draw calls in all, hidden past 240 m.
// No real lights (a light-count change recompiles every material): night = unlit beams + a ground pool + bright heads.
// Shaders prewarmed with SSX.stormGuard.prewarm. Crowd animation updates 10x a second, only within 80 m. Phones get fewer
// spectators.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHuman } from '../interiors.js';
import * as K from './pitringcore.js';
import { packSpot, rushers as rushList } from './pitshowcore.js'; // v7.5.29 the show: the crowd packs the ropes, late arrivals run in

const app = () => window.__app, surf = () => app()?.surface, world = () => surf()?.world;
const isPhone = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const night = () => { try { const T = window.SSX?.time; if (typeof T?.isNight === 'function') return !!T.isNight(); } catch (e) { /* optional */ } return false; };

let G = null, built = false, colonyKey = '', C0 = { x: 0, z: 0 }, y0 = 0, lastW = null, solidT = 0, animT = 0, t = 0, nightNow = null;
let crowd = [], inst = [], removers = [], mats = null, nightObjs = [], heads = null, markKey = '';
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), E = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0);

function colony() { const i = surf()?.info; return i?.colony || null; }
function onMars() { const a = app(); return !!(a?.state?.onSurface && surf()?.info?.name === 'Mars' && !a.state.transitioning); }

// ---------- textures ----------
function matTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#3b3430'; x.fillRect(0, 0, 256, 256);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${20 + rnd() * 40 | 0},${16 + rnd() * 26 | 0},${14 + rnd() * 20 | 0},${0.08 + rnd() * 0.18})`; x.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 10, 2 + rnd() * 10); }
  for (let i = 0; i < 26; i++) { // stains: old blood, oil, rust
    const cx = 30 + rnd() * 196, cy = 30 + rnd() * 196, r = 6 + rnd() * 22, k = rnd();
    const col = k < 0.45 ? '96,18,14' : k < 0.75 ? '18,14,12' : '120,62,26';
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${col},${0.35 + rnd() * 0.3})`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = 'rgba(200,170,90,0.55)'; x.lineWidth = 5; x.strokeRect(8, 8, 240, 240); // worn tape border
  x.strokeStyle = 'rgba(150,30,24,0.6)'; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 30, 0, Math.PI * 2); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function signTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 284; const x = c.getContext('2d');
  x.fillStyle = '#17110e'; x.fillRect(0, 0, 1024, 284);
  x.strokeStyle = '#f97316'; x.lineWidth = 14; x.strokeRect(14, 14, 996, 256);
  for (let i = 0; i < 26; i++) { const bx = 40 + i * 37.5; for (const by of [34, 250]) { x.fillStyle = '#fde68a'; x.beginPath(); x.arc(bx, by, 7, 0, Math.PI * 2); x.fill(); } }
  x.font = '900 178px Impact, "Arial Black", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = '#ff3d00'; x.shadowBlur = 30; x.fillStyle = '#ff5a1f'; x.fillText(K.SIGN.text, 512, 150);
  x.shadowBlur = 0; x.lineWidth = 6; x.strokeStyle = '#2a0a04'; x.strokeText(K.SIGN.text, 512, 150);
  x.globalAlpha = 0.25; x.fillStyle = '#000'; let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 160; i++) x.fillRect(rnd() * 1024, rnd() * 284, 2 + rnd() * 14, 1 + rnd() * 4); // grime
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function poolTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,214,150,0.85)'); g.addColorStop(0.55, 'rgba(255,170,90,0.35)'); g.addColorStop(1, 'rgba(255,150,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- geometry helpers (everything ends up in one merged geometry per material) ----------
const box = (out, w, h, d, x, y, z, ry = 0, rz = 0, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); out.push(g); };
const cyl = (out, r0, r1, h, x, y, z, seg = 6) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y + h / 2, z); out.push(g); };
// a straight piece between two points (a rope / cable / chain segment)
function strut(out, a, b, w, h = w) { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); const g = new THREE.BoxGeometry(w, h, L);
  M4.lookAt(V.set(0, 0, 0), V.set(dx, dy, dz).normalize().negate(), UP); g.applyMatrix4(M4); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); out.push(g); }
const merge = list => { const g = mergeGeometries(list.map(q => q.index ? q.toNonIndexed() : q).map(q => { for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') q.deleteAttribute(k); if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); return q; }), false); list.forEach(q => q.dispose()); return g; };
const lift = (x, z) => { const h = surf()?.height || lastTc?.height; try { return (h ? h(C0.x + x, C0.z + z) : y0) - y0; } catch (e) { return 0; } };
let lastTc = null;

// the crowd swaps buildHuman's round parts for low-poly ones (same shape and size, ~1/5 the triangles)
const LOW = { SphereGeometry: new THREE.SphereGeometry(1, 7, 5), CylinderGeometry: new THREE.CylinderGeometry(1, 1, 1, 6) };
// one merged rig of an NPC body (vertex colours per part) for the instanced crowd
function crowdGeo(outfit, armsUp) {
  const h = buildHuman(outfit);
  if (armsUp) h.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * 2.6; a.rotation.x = -0.25; });
  h.group.updateMatrixWorld(true); const parts = [];
  h.group.traverse(o => { if (!o.isMesh) return; const src = LOW[o.geometry.type] || o.geometry, g = (src.index ? src.toNonIndexed() : src.clone()); g.applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g); });
  return mergeGeometries(parts, false);
}

function build(tc) {
  const col = colony(); if (!col) return;
  built = true; colonyKey = col.x + ',' + col.z; C0 = K.centreWorld(col); lastTc = tc;
  y0 = (tc.height ? tc.height(C0.x, C0.z) : 0);
  G = new THREE.Group(); G.name = 'pit-ring'; G.position.set(C0.x, y0, C0.z);
  const Mstd = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0.15, ...o });
  mats = {
    mat: Mstd(0xffffff, { map: matTex(), roughness: 1, metalness: 0 }),
    rust: Mstd(0x4a3426, { roughness: 0.85, metalness: 0.45 }),
    rope: Mstd(0x7a2e22, { roughness: 1, metalness: 0 }),
    chain: Mstd(0x8a8a86, { roughness: 0.45, metalness: 0.8 }),
    pad: Mstd(0x8f1d14, { roughness: 0.7 }),
    head: new THREE.MeshBasicMaterial({ color: 0x8c8474 }),
    sign: new THREE.MeshBasicMaterial({ map: signTex(), fog: false }),
    beam: new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    pool: new THREE.MeshBasicMaterial({ map: poolTex(), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    crowd: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }),
  };
  const L = { mat: [], rust: [], rope: [], chain: [], pad: [], head: [], sign: [], beam: [] };
  // stained mat: thin slab, top 3.5 cm above the dirt (under the duel ring decal at +6 cm)
  box(L.mat, K.MAT * 2, 0.06, K.MAT * 2, 0, lift(0, 0) + 0.005, 0);
  // v7.5.98 bleachers: three banks outside the ropes. The crowd stands on them. Not colliders.
  for (const s of K.STANDS) {
    const y = lift(s.x, s.z);
    box(L.rust, s.w, s.h, s.d, s.x, y + s.h / 2, s.z);
    box(L.pad, s.w - 0.4, 0.08, s.d - 0.3, s.x, y + s.h + 0.02, s.z);
    box(L.rust, 0.18, s.h + 0.9, 0.18, s.x - s.w / 2 + 0.2, y + (s.h + 0.9) / 2, s.z - s.d / 2 + 0.2);
    box(L.rust, 0.18, s.h + 0.9, 0.18, s.x + s.w / 2 - 0.2, y + (s.h + 0.9) / 2, s.z + s.d / 2 - 0.2);
  }
  // corner posts + turnbuckle pads, three strands per side: two ropes and a chain on top
  const P = K.posts();
  for (const [x, z] of P) { const y = lift(x, z); cyl(L.rust, 0.11, 0.14, K.POST_H, x, y, z, 8); box(L.pad, 0.34, 1.1, 0.34, x, y + 0.85, z, Math.PI / 4); box(L.rust, 0.4, 0.06, 0.4, x, y + K.POST_H, z); }
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4], ya = lift(a[0], a[1]), yb = lift(b[0], b[1]);
    K.ROPES.forEach((hgt, k) => {
      const N = k === K.ROPES.length - 1 ? 44 : 6; let prev = null;
      for (let s = 0; s <= N; s++) { const f = s / N, sag = K.SAG * 4 * f * (1 - f) * (k === K.ROPES.length - 1 ? 1.6 : 1);
        const p = [a[0] + (b[0] - a[0]) * f, ya + (yb - ya) * f + hgt - sag, a[1] + (b[1] - a[1]) * f];
        if (prev) { if (k === K.ROPES.length - 1) { const w = s % 2 ? [0.07, 0.025] : [0.025, 0.07]; strut(L.chain, prev, p, w[0], w[1]); } else strut(L.rope, prev, p, 0.07); }
        prev = p; }
    });
  }
  // THE PIT sign frame (west): two legs, a backing board, the face on both sides
  const S = K.SIGN, top = S.y + S.h + 1;
  for (const [x, z] of S.legs) { const y = lift(x, z); box(L.rust, 0.3, top - y, 0.3, x, y + (top - y) / 2, z); box(L.rust, 0.7, 0.12, 0.7, x, y + 0.06, z); }
  box(L.rust, 0.22, S.h + 0.5, S.w + 0.5, S.at[0], S.y + S.h / 2, S.at[1]);
  box(L.rust, 0.25, 0.25, 7.4 + 0.5, S.at[0], top - 0.2, S.at[1]); // top beam carrying the floods
  { const g = new THREE.PlaneGeometry(S.w, S.h); g.rotateY(S.yaw); g.translate(S.at[0] + 0.12, S.y + S.h / 2, S.at[1]); L.sign.push(g);
    const b = new THREE.PlaneGeometry(S.w, S.h); b.rotateY(-S.yaw); b.translate(S.at[0] - 0.12, S.y + S.h / 2, S.at[1]); L.sign.push(b); }
  // floodlight mast (east) + crossbar
  { const [x, z] = K.MAST.at, y = lift(x, z); cyl(L.rust, 0.14, 0.2, K.MAST.h - y, x, y, z, 8); box(L.rust, 0.3, 0.2, 2.2, x, K.MAST.h - 0.1, z); }
  // wire from the sign to the mast, with the lamp rig hanging over the ring
  const wy = top - 0.1, mid = [0, wy - 0.4, 0];
  strut(L.chain, [S.at[0], wy, 0], mid, 0.04); strut(L.chain, mid, [K.MAST.at[0], K.MAST.h - 0.1, 0], 0.04);
  strut(L.chain, mid, [0, K.RIG_Y + 0.15, 0], 0.05);
  for (const s of [-1, 1]) { box(L.rust, 5.2, 0.12, 0.12, 0, K.RIG_Y, s * 2.2); box(L.rust, 0.12, 0.12, 5.2, s * 2.2, K.RIG_Y, 0); }
  for (const [x, z] of K.RIG) strut(L.chain, [x, K.RIG_Y, z], [0, K.RIG_Y + 0.15, 0], 0.03);
  for (const [x, z] of K.RIG) { box(L.rust, 0.62, 0.32, 0.62, x, K.RIG_Y - 0.22, z); box(L.head, 0.5, 0.06, 0.5, x, K.RIG_Y - 0.4, z);
    const g = new THREE.CylinderGeometry(0.28, 2.3, K.RIG_Y - 0.45, 12, 1, true); g.translate(x, (K.RIG_Y - 0.45) / 2, z); L.beam.push(g); }
  for (const [x, z, y] of K.LAMP_HEADS) { const yaw = Math.atan2(-x, -z); box(L.rust, 0.55, 0.45, 0.35, x, y, z, yaw, 0, -0.5); box(L.head, 0.46, 0.36, 0.04, x - Math.sin(yaw) * 0.19, y - 0.08, z - Math.cos(yaw) * 0.19, yaw, 0, -0.5); }
  for (const k of Object.keys(L)) { if (!L[k].length) continue; const m = new THREE.Mesh(merge(L[k]), mats[k]); m.name = 'pit-' + k; m.matrixAutoUpdate = false; m.updateMatrix(); m.receiveShadow = k === 'mat'; G.add(m); if (k === 'beam') nightObjs.push(m); if (k === 'head') heads = m; }
  // night light pool on the mat
  { const g = new THREE.PlaneGeometry(K.MAT * 2.3, K.MAT * 2.3); g.rotateX(-Math.PI / 2); g.translate(0, lift(0, 0) + 0.075, 0); const m = new THREE.Mesh(g, mats.pool); m.name = 'pit-pool'; m.renderOrder = 2; G.add(m); nightObjs.push(m); }
  // crowd: candidate spots outside the ropes, minus anything the world says is blocked (the clinic, parked cars)
  const W = tc.world || world(), phone = isPhone();
  crowd = K.crowdCandidates(phone).filter(c => !W?.collide?.(C0.x + c.x, C0.z + c.z, 0.45));
  const outfits = [{ top: 0x9a6a44, bottom: 0x4a4650, hair: 0x2a2118, skin: 0xc68a64 }, { top: 0x5f7890, bottom: 0x5a4636, hair: 0x4a3020, hairStyle: 'cap', skin: 0x9a6a4c }];
  for (const c of crowd) { const q = packSpot(c); c.px = q.x; c.pz = q.z; c.cx = c.x; c.cz = c.z; }
  const rush = rushList(phone).map(r => ({ ...r, rush: true, px: r.x, pz: r.z, cx: r.sx, cz: r.sz, hx: r.sx, hz: r.sz }));
  inst = [0, 1].map(pose => { const list = crowd.filter(c => c.pose === pose).concat(rush.filter(c => c.pose === pose)); const m = new THREE.InstancedMesh(crowdGeo(outfits[pose], pose === 1), mats.crowd, Math.max(1, list.length));
    m.count = list.length; m.name = 'pit-crowd-' + pose; m.frustumCulled = false; m.userData.list = list;
    list.forEach((c, i) => { const k = 0.85 + c.seed * 0.3; m.setColorAt(i, new THREE.Color(k * (0.9 + 0.2 * ((c.seed * 7) % 1)), k, k * (0.85 + 0.3 * ((c.seed * 13) % 1)))); });
    if (m.instanceColor) m.instanceColor.needsUpdate = true; G.add(m); return m; });
  poseCrowd(0, false);
  tc.scene.add(G); lastW = null; nightNow = null; applyNight();
  window.SSX?.stormGuard?.prewarm?.(G, { hide: false, draw: true });
}

// v7.5.29 show state, driven by mars/pitshow.js through api.show(): pack (crowd at the ropes, late arrivals running in), mood
// ('' | 'cheer' | 'erupt' | 'boo' | 'gasp'), hype 0..1 (jump height), strobe (lamp-head colour or null)
const SH = { pack: false, mood: '', hype: 0, strobe: null, since: 0 };
function poseCrowd(t, fighting, dt = 0) {
  const show = SH.pack, mood = SH.mood, hype = SH.hype, RUN = 5.2;
  for (const m of inst) { const list = m.userData.list;
    list.forEach((c, i) => {
      if (c.cx === undefined) { c.cx = c.x; c.cz = c.z; }
      // walk / run toward the target spot (packed at the ropes in a show, home otherwise; late arrivals leave the way they came)
      const tx = show ? c.px : c.rush ? c.hx : c.x, tz = show ? c.pz : c.rush ? c.hz : c.z, gx = tx - c.cx, gz = tz - c.cz, gl = Math.hypot(gx, gz);
      const go = dt > 0 && gl > 0.05 && (!c.rush || !show || t - SH.since > c.delay);
      if (go) { const st = Math.min(gl, (show ? RUN : 2.2) * dt); c.cx += gx / gl * st; c.cz += gz / gl * st; }
      const moving = go && gl > 0.3, gone = c.rush && !show && gl < 0.3;
      if (gone) { M4.makeScale(0, 0, 0); m.setMatrixAt(i, M4); return; }
      const f = fighting || show, loud = mood === 'erupt' ? 1.8 : mood === 'boo' ? 0.5 : mood === 'gasp' ? 0.25 : 1;
      const a = moving ? 0.4 : K.cheer(t, c.seed, f) * (show ? (0.7 + hype * 0.8) * loud : 1);
      const y = lift(c.cx, c.cz) + (moving ? Math.abs(Math.sin(t * 11 + c.seed * 9)) * 0.12 : (f ? 0.22 : 0.05) * a);
      const face = moving ? Math.atan2(-gx, -gz) : show ? Math.atan2(c.cx, c.cz) : c.yaw;
      const sway = mood === 'boo' ? Math.sin(t * 7 + c.seed * 20) * 0.35 : Math.sin(t * 2 + c.seed * 30) * 0.18 * a; // boo: heads shaking, arms waved off
      E.set(mood === 'gasp' ? -0.12 : 0, face + sway, Math.sin(t * 3 + c.seed * 9) * 0.06 * a); Q.setFromEuler(E);
      const s = 0.94 + c.seed * 0.14; M4.compose(V.set(c.cx, y, c.cz), Q, S1.set(s, s, s)); m.setMatrixAt(i, M4); });
    m.instanceMatrix.needsUpdate = true; }
}

function applyNight() {
  const n = night(); if (n === nightNow) return; nightNow = n;
  for (const o of nightObjs) o.visible = n;
  mats.head.color.setHex(n ? 0xfff2c8 : 0x8c8474);
  for (const [k, c] of [['crowd', 0x3a2a1c], ['rope', 0x2a0c08], ['pad', 0x3a0a06], ['rust', 0x140c08], ['chain', 0x1a1814]]) mats[k].emissive.setHex(n ? c : 0x000000); // lamp spill (no real lights)
}

function addSolids(W) {
  for (const r of removers) { try { r?.(); } catch (e) { /* stale world */ } } removers = [];
  for (const s of K.solids()) removers.push(W.addSolid?.({ x: C0.x + s.x, z: C0.z + s.z, r: s.r, h: s.h, zone: 'pit' }));
  for (const c of crowd) removers.push(W.addSolid?.({ x: C0.x + c.x, z: C0.z + c.z, r: 0.35, h: 1.8, zone: 'pit' }));
}

function mark() {
  const key = C0.x + ',' + C0.z; if (markKey === key) return; markKey = key;
  window.SSX?.minimap?.addMarks?.('pit-ring', [{ x: C0.x, z: C0.z, color: K.MINIMAP.color, r: K.MINIMAP.r, ring: true, icon: K.MINIMAP.icon }]);
}
function unmark() { if (!markKey) return; markKey = ''; window.SSX?.minimap?.clear?.('pit-ring'); }

function tick(dt, tc) {
  lastTc = tc;
  if (tc.name !== 'Mars' || !onMars()) { if (G) G.visible = false; unmark(); return; }
  const col = colony(); if (!col) return;
  if (built && colonyKey !== col.x + ',' + col.z) { G?.parent?.remove(G); built = false; G = null; nightObjs = []; crowd = []; }
  if (!built) build(tc); if (!G) return;
  if (G.parent !== tc.scene) tc.scene.add(G);
  mark();
  const W = tc.world || world(), cam = tc.camera, d = cam ? Math.hypot(cam.position.x - C0.x, cam.position.z - C0.z) : 0;
  G.visible = d < K.DRAW_R && !W?.inside;
  solidT -= dt; if (W && (W !== lastW || solidT <= 0)) { solidT = 1; const p = K.posts()[0];
    if (W !== lastW || !W.collide?.(C0.x + p[0], C0.z + p[1], 0.05)) { lastW = W; if (W.addSolid) addSolids(W); } } // world.exit() resets its solids
  if (!G.visible) return;
  t += dt; animT -= dt;
  if (animT <= 0) { const step = SH.pack || SH.hype > 0 ? 0.05 : 0.1; animT = step; applyNight();
    if (SH.strobe != null) mats.head.color.setHex(SH.strobe); else if (SH.lastStrobe) { SH.lastStrobe = 0; nightNow = null; applyNight(); } if (SH.strobe != null) SH.lastStrobe = 1;
    if (d < 80) { const pl = tc.player; poseCrowd(t, !!W?.inDuel && !!pl && Math.hypot(pl.x - C0.x, pl.z - C0.z) < 14, step); } }
}

// the pit fight: stand on the ring edge, 1.6 m from the centre on your side, facing in; returns the centre for challenge({ at })
function arm(id) {
  if (id && id !== 'act-pit-fight') return null;
  if (!built || !onMars()) return null;
  const s = surf(), p = lastTc?.player; if (!s?.debugPlace || !p || s.info?.driving) return null;
  if (Math.hypot(p.x - C0.x, p.z - C0.z) > 12) return null; // only when you are at the Pit
  const q = K.startSpot(C0.x, C0.z, p.x, p.z); s.debugPlace(q.x, q.z, q.yaw);
  return { x: C0.x, z: C0.z };
}

function uncompiled() {
  const R = app()?.renderer; if (!R || !G) return -1; let n = 0;
  G.traverse(o => { if (!o.material) return; for (const m of [].concat(o.material)) if (!R.properties.get(m).currentProgram) n++; }); return n;
}
const counts = () => { if (!G) return null; let meshes = 0, tris = 0; G.traverse(o => { if (!o.isMesh) return; meshes++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += o.isInstancedMesh ? n * o.count : n; }); return { meshes, tris: Math.round(tris), crowd: crowd.length, solids: removers.length }; };

// v7.5.29 the show (mars/pitshow.js): api.show({ pack, mood, hype, strobe }); returns the crowd's packed count
function show(o = {}) { if (o.pack !== undefined && !!o.pack !== SH.pack) { SH.pack = !!o.pack; SH.since = t; }
  if (o.mood !== undefined) SH.mood = o.mood || ''; if (o.hype !== undefined) SH.hype = Math.max(0, Math.min(1, +o.hype || 0)); if (o.strobe !== undefined) SH.strobe = o.strobe;
  return { ...SH, crowd: crowd.length, rushers: inst.reduce((n, m) => n + m.userData.list.filter(c => c.rush).length, 0) }; }
const crowdNow = () => inst.flatMap(m => m.userData.list.map(c => ({ x: +(c.cx ?? c.x).toFixed(2), z: +(c.cz ?? c.z).toFixed(2), rush: !!c.rush })));
const api = { centre: () => (built ? { x: C0.x, z: C0.z } : null), arm, show, ground: () => y0, group: () => G,
  debug: { get built() { return built; }, counts, uncompiled, night: () => nightNow, crowdNow, layout: () => ({ centre: { ...C0 }, y0, crowd: crowd.map(c => ({ ...c })), solids: K.solids(), sign: K.SIGN, mast: K.MAST }), group: () => G } };
window.SSX = window.SSX || {}; window.SSX.pitRing = api;
(function wire() { const reg = window.SSX?.registerSurfaceTick; if (typeof reg === 'function') reg(tick); else setTimeout(wire, 300); })();
export default api;
