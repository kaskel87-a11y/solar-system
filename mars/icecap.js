// Planum Australe ice cap (Pumpkin): "Strike Season" (story/snow-bowling.md). Far south of Ares Junction on Mars a snow
// mountain rises out of the dust: a 400 m downhill run with four kickers, a chairlift, and at the bottom Frostbite Benny's
// illegal bowling lane on the ice. "Ten pins, one lane, and one fella who owes me. Pick your target."
//  🏂 Rent a board from Benny (50 cr), ride the lift, 90 s timed run: carve (stick / A D), tuck (up / W), brake (down / S),
//     Jump = ollie, hold Jump in the air = grab, steer in the air = spin. v7.5.67: the board is quicker and tops out faster.
//     To the rider's left of the race line is Planum X: slopestyle booters, rails, boxes, and a superpipe. Hold Jump to grab
//     (stick forward mute, back method, left stalefish, right melon), land on a rail or box to grind, string tricks for a
//     combo. The score chip shows Planum X points. Tricks pay 5★ each on a timed run, air time pays cr. Land straight
//     (or switch) or you wipe out. ⏏ Off board any time. The run ends at the lane.
//  👊 A Turf gang lieutenant hangs about Benny's hut. Grab him (cartoon KO, no gore), Benny zip-ties him upright as the head
//     pin with 9 ice pins round him. 🎳 Bowl a frozen boulder: swipe up the pad (sideways = aim, length = power, curve = spin),
//     or ← → aim, ↑ ↓ power, Shift+← → spin, Space / Enter roll. 3 frames. Pins 10 cr, head-pin hit +300, strike +500, three
//     first-ball strikes = "Perfect Cold" +2,000 cr +200★. A hit sends him into a cartoon ragdoll tumble; after the game
//     he limps off cursing and is back for more later (repeat target).
//  🛍️ v7.5.68 Slick's shop, off the arrival pad: snow threads, boards you keep, bowling balls,
//     cartoon liquor and crater dust. Owning a board skips the rental. Insult Slick and you are banned
//     for 90 s, or you pay the fine. Benny still rents a board if you have not bought one.
// Hooks: one <script> line in index.html (+ import map), one sw.js precache line, one guarded SSX_GROUND hook in surface.js
// (snow height + no boulders on the snow), fast-travel stop in mars/fasttravel.js. Everything else is feature-detected.
// Pure logic: ./icecapcore.js.
// window.SSX.icecap = { place(), state(), rent(), lift(), boardOn(), boardOff(), grab(), bowl(), roll(t), quit(), bringRival(r), subscribe(fn) }
// window.__icecap = test helpers (go(where), core, last log)
import * as THREE from 'three';
import * as C from './icecapcore.js';
import { buildHuman } from '../interiors.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game;
const KEY = 'ssx.icecap.v1', EYE = 1.7;
const log = [], subs = new Set();
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const toast = (t, ms = 2600) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } log.push(t); if (log.length > 60) log.shift(); };
const emit = (type, d = {}) => { for (const f of subs) { try { f({ type, ...d }); } catch (e) { /* */ } } try { window.SSX?.emit?.('icecap:' + type, d); } catch (e) { /* */ } };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const fmt = n => Math.round(n).toLocaleString('en-US');
const pick = a => a[Math.floor(Math.random() * a.length)];
const now = () => Date.now() / 1000;

// ---------- the ground hook (surface.js height() + rock placement read it; Mars only) ----------
const GROUND = { height: (x, z, h, nm) => nm === 'Mars' ? C.groundY(x, z, h) : h, clear: (x, z, nm) => nm === 'Mars' && C.rockFree(x, z) };
globalThis.SSX_GROUND = GROUND;

// ---------- save ----------
let save = { runs: 0, bestRun: 0, bestPts: 0, games: 0, best: 0, perfect: 0, rivals: {} };
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && typeof j === 'object') save = { ...save, ...j, rivals: { ...(j.rivals || {}) } }; } catch (e) { /* fresh */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* */ } };

// ---------- money ----------
const credits = () => +(tryv(() => game()?.progress?.credits, 0) || 0);
function spend(n) { const g = game(); if (!g) return false; if (credits() < n) return false; if (g.spend) return !!g.spend(n); g.progress.credits -= n; tryv(() => g.save()); return true; }
function give(cr, stars = 0) { const g = game(); if (!g?.progress) return; if (cr > 0) g.progress.credits += Math.round(cr); if (stars > 0) g.progress.xp = (g.progress.xp || 0) + Math.round(stars); tryv(() => g.save()); emit('pay', { cr, stars }); }

// ---------- state ----------
const S = { mode: 'foot', rented: false, run: null, board: null, rival: null, rivalState: 'none', bowl: null, near: null, lastTc: null, fade: 0, simT: 0, combo: { mult: 1, left: 0 }, freePts: 0, call: null, parkTold: false };
// rivalState: none | hut (waiting at the hut) | ko (knocked out, stars) | tied (head pin) | down (knocked over) | limp (walking off)
let G = null, parts = null;

function onMars(tc) { const st = app()?.state; return !!st?.onSurface && !st.transitioning && tc?.name === 'Mars'; }
function place() { return { x: C.SPOTS.arrive.x, z: C.SPOTS.arrive.z, name: 'Planum Australe · Frostbite Benny\u2019s lane', sub: 'Ice cap: Planum X, Slick\u2019s shop, snow bowling' }; }

// ---------- 3D ----------
const shared = new Set();
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function sign(text, sub, w = 6, h = 1.6) {
  const tex = canvasTex(1024, Math.round(1024 * h / w), (x, W, H) => { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.strokeStyle = '#fff'; x.lineWidth = 14; x.strokeRect(10, 10, W - 20, H - 20);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 ${Math.round(H * (sub ? 0.36 : 0.5))}px system-ui,sans-serif`; x.fillText(text, W / 2, H * (sub ? 0.38 : 0.52));
    if (sub) { x.font = `700 ${Math.round(H * 0.2)}px system-ui,sans-serif`; x.fillText(sub, W / 2, H * 0.74); } });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); return m;
}
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
function box(g, w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; }

function buildSnow(height) {
  const xs = [], zs = [];
  const span = (arr, a, b, step) => { for (let v = a; v <= b + 1e-4; v += step) arr.push(Math.round(v * 1000) / 1000); };
  const uniq = arr => { arr.sort((a, b) => a - b); const o = []; for (const v of arr) if (!o.length || v - o[o.length - 1] > 0.05) o.push(v); return o; };
  span(xs, C.BOUNDS.x0, C.CX - 24, 4); span(xs, C.CX - 24, C.CX + 18, 1.5);
  span(xs, C.CX + 18, C.PIPE.x + C.PIPE.flat + C.PIPE.R + 5, 1.2); span(xs, C.PIPE.x + C.PIPE.flat + C.PIPE.R + 5, C.BOUNDS.x1, 4);
  span(zs, C.BOUNDS.z0, C.Z_TOP - 40, 4); span(zs, C.Z_TOP - 40, 1060, 2.5); span(zs, 1060, C.BOUNDS.z1, 4);
  for (const k of C.KICKS) zs.push(k - 0.06, k + 0.06, Math.round((k - C.KICK_LEN * 0.5) * 1000) / 1000);
  for (const k of C.PARK_KICKS) zs.push(k.z - 0.06, k.z + 0.06, Math.round((k.z - k.len * 0.5) * 1000) / 1000);
  const X = uniq(xs), Z = uniq(zs), nx = X.length, nz = Z.length, pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X[i], z = Z[j], m = C.mask(x, z), n = Math.sin(x * 0.37 + z * 0.11) * Math.sin(z * 0.23 - x * 0.07);
    const cover = C.smooth(0.18, 0.42, m + n * 0.08), y = height(x, z) + (cover > 0 ? -0.9 + 1.06 * cover : -2);
    const k = (j * nx + i) * 3; pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
    const groom = C.groom(x, z), piste = C.onPiste(x, z) ? 1 : 0, cord = piste && Math.abs(x - C.CX) < 18 ? 0.03 * Math.sin(x * 3.1) : 0;
    if (groom === 'wall') { col[k] = 0.62; col[k + 1] = 0.78; col[k + 2] = 0.96; }
    else if (groom === 'pipe') { col[k] = 0.9; col[k + 1] = 0.96; col[k + 2] = 1; }
    else if (groom === 'park') { col[k] = 0.96; col[k + 1] = 0.97; col[k + 2] = 1; }
    else { col[k] = 0.9 - 0.06 * piste + cord; col[k + 1] = 0.94 - 0.03 * piste + cord; col[k + 2] = 1.0; }
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, emissive: 0x6d7f96, emissiveIntensity: 0.18, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  mesh.name = 'icecapSnow'; return mesh;
}
// repeated posts as one draw call (coping markers, rail legs). pts are [x, y, z].
function posts(g, mat, pts, w, h, d) {
  if (!pts.length) return null;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), mat, pts.length);
  const o = new THREE.Object3D();
  pts.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, 0, 0); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
  mesh.instanceMatrix.needsUpdate = true; g.add(mesh); return mesh;
}
// v7.5.67 Planum X: signs, a slopestyle gate, rails, boxes, pipe coping. Terrain (pipe + booters) is in the snow mesh.
function buildPark(g, H, black, white, red) {
  const banner = (x, z, text, sub, w = 7.2, h = 1.7) => { const y = H(x, z); const s = sign(text, sub, w, h); s.position.set(x, y + 3.3, z); s.rotation.y = Math.PI; g.add(s); for (const side of [-1, 1]) box(g, 0.18, 3.5, 0.18, black, x + side * (w * 0.48), y + 1.6, z); return s; };
  banner(C.CX + 16, C.Z_TOP + 8, '\u2190 PLANUM X', 'slopestyle \u00b7 superpipe', 8.2, 1.8);
  banner(C.CX + 30, 652, 'SLOPESTYLE', 'jumps \u00b7 rails \u00b7 boxes', 8, 1.6);
  banner(C.PIPE.x, C.PIPE.z0 + 4, 'SUPERPIPE', 'carve the wall \u00b7 fly the lip', 8.4, 1.6);
  const steel = M(0x161616, { metalness: 0.72, roughness: 0.32 });
  const legs = [], coping = [];
  for (const f of C.FEATURES) {
    const zc = (f.z0 + f.z1) / 2, len = f.z1 - f.z0, y0 = H(f.x, f.z0), y1 = H(f.x, f.z1), yc = (y0 + y1) / 2 + f.h;
    const pitch = Math.atan2(y0 - y1, len);
    if (f.kind === 'rail') {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, len), steel); beam.position.set(f.x, yc, zc); beam.rotation.x = pitch; g.add(beam);
      for (let z = f.z0 + 2; z < f.z1 - 1; z += 4) legs.push([f.x, H(f.x, z) + f.h * 0.45, z]);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(f.half * 2, f.h, len), black); body.position.set(f.x, H(f.x, zc) + f.h * 0.5, zc); body.rotation.x = pitch; g.add(body);
      const top = new THREE.Mesh(new THREE.BoxGeometry(f.half * 2 + 0.06, 0.06, len + 0.04), white); top.position.set(f.x, H(f.x, zc) + f.h + 0.02, zc); top.rotation.x = pitch; g.add(top);
    }
  }
  posts(g, steel, legs, 0.08, 0.7, 0.08);
  const half = C.PIPE.flat + C.PIPE.R;
  for (let z = C.PIPE.z0 + 10; z < C.PIPE.z1 - 4; z += 14) for (const s of [-1, 1]) {
    const x = C.PIPE.x + s * half, y = H(x, z); coping.push([x, y + 0.45, z]);
  }
  posts(g, red, coping, 0.12, 0.9, 0.12);
  for (let i = 0; i < 7; i++) {
    const t = i / 6, x = C.CX + 12 + t * 20, z = C.Z_TOP + 22 + t * 70, y = H(x, z);
    box(g, 0.08, 1.5, 0.08, black, x, y + 0.75, z);
    const fl = box(g, 0.02, 0.42, 0.62, i % 2 ? red : white, x, y + 1.25, z + 0.3); fl.userData.flag = 1;
  }
}
function pinGeo() { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, y = t * 1.5, r = 0.11 + 0.17 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.9) * (t < 0.62 ? 1 : 0.55) + (t > 0.62 ? 0.06 * Math.sin((t - 0.62) / 0.38 * Math.PI) : 0); pts.push(new THREE.Vector2(Math.max(0.02, t > 0.97 ? 0.03 : r), y)); } return new THREE.LatheGeometry(pts, 14); }
function bubble(text) {
  const tex = canvasTex(512, 160, (x, W, H) => { x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 8; x.beginPath(); x.roundRect(6, 6, W - 12, H - 40, 26); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(W / 2 - 18, H - 36); x.lineTo(W / 2, H - 6); x.lineTo(W / 2 + 18, H - 36); x.fill(); x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = 52; x.font = `900 ${fs}px system-ui,sans-serif`; while (x.measureText(text).width > W - 40 && fs > 22) { fs -= 2; x.font = `900 ${fs}px system-ui,sans-serif`; } x.fillText(text, W / 2, (H - 34) / 2 + 4); });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(2.6, 0.81, 1); sp.renderOrder = 10; return sp;
}
function starsRing() { const g = new THREE.Group(); const tex = canvasTex(64, 64, (x) => { x.fillStyle = '#ffe14a'; x.font = '900 56px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('\u2605', 32, 34); });
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.setScalar(0.32); s.userData.a = i * Math.PI / 2; g.add(s); } g.visible = false; return g; }
function dressHuman(h, outfit) { h.group.traverse(o => { if (o.geometry) o.geometry.userData.shared = true; if (o.material) o.material.userData.shared = true; }); return h; }

function build(tc) {
  const g = new THREE.Group(); g.name = 'icecap'; const H = (x, z) => tc.height(x, z), P = {};
  g.add(buildSnow(H));
  const white = M(0xf4f6f8), black = M(0x111111), ice = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88, emissive: 0x16344a, emissiveIntensity: 0.35 }), wood = M(0x9a7550, { emissive: 0x2a1c10, emissiveIntensity: 0.6 }), red = M(0xd03030);
  // lane: blue ice with dark gutters, foul line
  const L0 = C.FOUL, len = C.PIN0 + 6;
  box(g, C.LANE_HALF * 2, 0.06, len, ice, C.CX, 0.2, L0 + len / 2);
  for (const s of [-1, 1]) { box(g, C.GUTTER - C.LANE_HALF, 0.04, len, black, C.CX + s * (C.LANE_HALF + C.GUTTER) / 2, 0.16, L0 + len / 2); box(g, 0.25, 0.5, len, white, C.CX + s * (C.GUTTER + 0.12), 0.35, L0 + len / 2); }
  box(g, C.LANE_HALF * 2, 0.07, 0.12, black, C.CX, 0.21, L0);
  for (let i = -2; i <= 2; i++) box(g, 0.16, 0.07, 0.6, black, C.CX + i * 0.8, 0.215, L0 + 8);
  box(g, C.GUTTER * 2 + 1, 2.2, 0.4, wood, C.CX, 1.1, L0 + len + 0.5); // backstop
  const bs = sign('STRIKE SEASON', 'Frostbite Benny\u2019s lane \u00b7 no refunds', 6.4, 1.4); bs.position.set(C.CX, 3.0, L0 + len + 0.25); bs.rotation.y = Math.PI; g.add(bs);
  // Benny's hut
  const hut = new THREE.Group(); hut.position.set(C.SPOTS.hut.x + 3, H(C.SPOTS.hut.x + 3, C.SPOTS.hut.z), C.SPOTS.hut.z);
  box(hut, 5, 3, 4, wood, 0, 1.5, 0); const roof = box(hut, 5.6, 0.4, 4.6, white, 0, 3.2, 0); roof.rotation.z = 0.08; box(hut, 1.2, 2.1, 0.1, black, -2.51, 1.05, 0).rotation.y = Math.PI / 2;
  const hs = sign('FROSTBITE BENNY\u2019S', 'boards \u00b7 bowling \u00b7 questions: no', 4.6, 1.1); hs.position.set(-2.56, 3.95, 0); hs.rotation.y = -Math.PI / 2; hut.add(hs); g.add(hut);
  // "PLANUM AUSTRALE" arrival sign
  const ps = sign('PLANUM AUSTRALE', 'Mars south polar ice cap', 7, 1.7); ps.position.set(C.SPOTS.arrive.x - 6, H(C.SPOTS.arrive.x - 6, C.SPOTS.arrive.z - 4) + 3.2, C.SPOTS.arrive.z - 4); ps.rotation.y = 0; g.add(ps);
  for (const s of [-1, 1]) box(g, 0.2, 3.4, 0.2, black, ps.position.x + s * 3.3, ps.position.y - 1.6, ps.position.z);
  // start + finish gates, piste flags, kicker flags
  const gate = (z, text) => { const y = H(C.CX, z); for (const s of [-1, 1]) box(g, 0.3, 4.4, 0.3, black, C.CX + s * 9, y + 2.2, z); const b = sign(text, null, 18, 1.3); b.position.set(C.CX, y + 4.6, z); g.add(b); };
  gate(C.Z_TOP, 'START \u00b7 90 SECONDS'); gate(C.Z_BOT, 'FINISH');
  for (let z = C.Z_TOP + 15; z < C.Z_BOT; z += 25) for (const s of [-1, 1]) { const x = C.CX + s * 19, y = H(x, z); box(g, 0.08, 1.6, 0.08, black, x, y + 0.8, z); const f = box(g, 0.02, 0.5, 0.7, s < 0 ? black : red, x, y + 1.35, z + 0.35); f.userData.flag = 1; }
  for (const k of C.KICKS) for (const s of [-1, 1]) { const x = C.CX + s * (C.KICK_HALF + 0.6), y = H(x, k); box(g, 0.12, 1.2, 0.12, red, x, y + 0.6, k); }
  for (const k of C.PARK_KICKS) for (const s of [-1, 1]) { const x = k.x + s * (k.half + 0.4), y = H(x, k.z); box(g, 0.1, 1.3, 0.1, red, x, y + 0.55, k.z); }
  buildPark(g, H, black, white, red);
  // chairlift: pylons, cable, a few chairs
  const lx = C.SPOTS.lift.x, cable = [];
  for (let z = 940; z >= C.Z_TOP - 10; z -= 50) { const y = H(lx, z); box(g, 0.5, 9, 0.5, black, lx, y + 4.5, z); box(g, 3, 0.3, 0.3, black, lx, y + 9, z); cable.push(new THREE.Vector3(lx - 1.3, y + 8.8, z), new THREE.Vector3(lx + 1.3, y + 8.8, z)); }
  const pts = [[], []]; cable.forEach((v, i) => pts[i % 2].push(v));
  for (const p of pts) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), new THREE.LineBasicMaterial({ color: 0x222222 })));
  for (let i = 0; i < pts[0].length - 1; i += 1) for (const q of [pts[0], pts[1]]) { const a = q[i], b = q[i + 1], c = a.clone().lerp(b, 0.5); box(g, 0.9, 0.12, 0.6, white, c.x, c.y - 1.4, c.z); box(g, 0.05, 1.3, 0.05, black, c.x, c.y - 0.7, c.z); }
  // pins (9 ice pins; the head pin is the rival or an ice pin when there's no rival) + the frozen boulder
  const pg = pinGeo(); P.pins = [];
  const pinM = new THREE.MeshStandardMaterial({ color: 0xd8f1ff, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.92, emissive: 0x335577, emissiveIntensity: 0.3 });
  for (let i = 0; i < 10; i++) { const p = new THREE.Group(); const m = new THREE.Mesh(pg, pinM); p.add(m); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 14), red); st.position.y = 1.05; p.add(st); g.add(p); P.pins.push(p); }
  const ballGeo = new THREE.IcosahedronGeometry(C.BALL_R, 1); { const a = ballGeo.attributes.position; for (let i = 0; i < a.count; i++) { const k = 1 + 0.07 * Math.sin(i * 12.9898) ; a.setXYZ(i, a.getX(i) * k, a.getY(i) * k, a.getZ(i) * k); } ballGeo.computeVertexNormals(); }
  P.ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: 0xa9c9de, roughness: 0.35, metalness: 0.15, flatShading: true, emissive: 0x1a3a55, emissiveIntensity: 0.3 })); g.add(P.ball);
  // aim dots
  P.aim = new THREE.Group(); const dotM = new THREE.MeshBasicMaterial({ color: 0x000000 }); for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), dotM); d.rotation.x = -Math.PI / 2; P.aim.add(d); } g.add(P.aim);
  // Benny: big parka, beanie, shades
  P.benny = dressHuman(buildHuman({ top: 0xf2f2f2, bottom: 0x1a1a1a, skin: 0xd9a07a, hair: 0x101010, hairStyle: 'cap', shades: true, bulk: 1.25, size: 1.05 }));
  P.benny.group.position.set(C.SPOTS.benny.x, H(C.SPOTS.benny.x, C.SPOTS.benny.z), C.SPOTS.benny.z); P.benny.group.rotation.y = Math.PI / 2; g.add(P.benny.group);
  // the rival (rebuilt per lieutenant), zip ties, cartoon stars, speech bubble
  P.stars = starsRing(); g.add(P.stars);
  // the board (shared by the rider)
  P.board = new THREE.Group(); const deckMat = M(0x0b0b0b, { roughness: 0.4 }), stripeMat = M(0xf4f6f8); P.deckMat = deckMat; P.stripeMat = stripeMat;
  const bb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 1.55), deckMat); bb.position.y = 0.03; P.board.add(bb);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.055, 0.25), stripeMat); stripe.position.y = 0.032; P.board.add(stripe); for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12, 1, false, 0, Math.PI), deckMat); tip.position.set(0, 0.03, s * 0.77); tip.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; P.board.add(tip); }
  P.board.visible = false; tc.scene.add(P.board); P.boardInScene = tc.scene;
  P.rackBoard = P.board.clone(); P.rackBoard.traverse(o => { if (o.isMesh && o.material) o.material = o.material.clone(); }); P.rackBoard.visible = true; P.rackBoard.position.set(C.SPOTS.benny.x + 1.2, H(C.SPOTS.benny.x + 1.2, C.SPOTS.benny.z) + 0.75, C.SPOTS.benny.z - 1); P.rackBoard.rotation.set(0.25, 0, 0); g.add(P.rackBoard);
  tc.scene.add(g); G = g; parts = P; layPins(true); rivalModel();
  return g;
}
function rivalModel() {
  if (!parts || !G) return; const L = S.rival; if (parts.rival?.lid === L?.id) return;
  if (parts.rival) { G.remove(parts.rival.group); parts.rival = null; }
  if (!L) return;
  const h = dressHuman(buildHuman({ top: L.col || 0x444444, bottom: 0x222226, skin: L.skin || 0xb27a56, hair: 0x1b120c, hairStyle: L.hair || 'short', accent: 0x111111, bulk: 1.05 }));
  const ties = new THREE.Group(), tm = M(0x0a0a0a); for (const y of [0.55, 0.95, 1.25]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 6, 16), tm); t.rotation.x = Math.PI / 2; t.position.y = y; ties.add(t); } ties.visible = false; h.group.add(ties);
  h.ties = ties; h.lid = L.id; h.bub = null; G.add(h.group); parts.rival = h;
}
function say(text, ms = 2200) { const h = parts?.rival; if (!h) return; if (h.bub) { h.group.remove(h.bub); h.bub.material.map.dispose(); h.bub.material.dispose(); } h.bub = bubble(text); h.bub.position.y = 2.45; h.group.add(h.bub); h.bubT = ms / 1000; }

// ---------- pins on the deck ----------
const laneX = u => C.CX - u, laneZ = w => C.FOUL + w; // facing down the lane (+z), +u is to your right (-x)
function layPins(all, standing) {
  if (!parts) return; const R = C.rack();
  R.forEach((p, i) => { const o = parts.pins[i], up = all || (standing ? standing[i] : true); const head = i === 0 && S.rival && ['tied', 'down'].includes(S.rivalState);
    o.visible = up && !head; o.position.set(laneX(p.u), 0.23, laneZ(p.w)); o.rotation.set(0, 0, 0); o.userData.fall = null; });
  if (parts.rival && S.rivalState === 'tied') tieRival();
  parts.ball.position.set(C.CX, 0.23 + C.BALL_R, C.FOUL - 0.3);
}
function tieRival() { const h = parts?.rival; if (!h) return; const R = C.rack()[0]; h.group.position.set(laneX(R.u), 0.23, laneZ(R.w)); h.group.rotation.set(0, 0, 0); h.group.rotation.y = 0; // facing the bowler (faces -z)
  resetPose(h); h.arms[0].rotation.z = 0.12; h.arms[1].rotation.z = -0.12; h.ties.visible = true; h.rag = null; }
function resetPose(h) { h.hips.position.y = h.base; h.hips.rotation.set(0, 0, 0); h.torso.rotation.set(0, 0, 0); h.head.rotation.set(0, 0, 0); for (const a of h.arms) a.rotation.set(0, 0, 0); for (const l of h.legs) l.rotation.set(0, 0, 0); }

// ---------- rival ----------
function hostageFromGame() { // another bot's hostage / captive / crew API, if there is one
  for (const f of [() => window.SSX?.hostage?.current?.(), () => window.SSX?.captive?.current?.(), () => window.SSX?.crew?.hostage?.(), () => window.SSX?.turf?.captive?.()]) { const r = tryv(f); if (r && (r.name || r.id)) return r; }
  return null;
}
function lieutenant(L) { const g = tryv(() => (window.SSX?.turf?.gangs || {})[L.gang]); return { ...L, gangName: g?.name || L.gangName, col: g?.col ?? L.col }; }
function refreshRival() {
  if (S.rivalState !== 'none' && S.rivalState !== 'limp') return;
  if (S.rivalState === 'limp') return;
  const L = C.nextRival(save.rivals, now()); if (!L) { S.rival = null; return; }
  S.rival = lieutenant(L); S.rivalState = 'hut'; rivalModel();
  const h = parts?.rival; if (h) { const p = C.SPOTS.rival, H = S.lastTc?.height; h.group.position.set(p.x, H ? H(p.x, p.z) : 0, p.z); h.group.rotation.set(0, -Math.PI / 2, 0); resetPose(h); h.ties.visible = false; }
}
function bringRival(r) { // other bots: tow a captive here and hand him over
  if (!r) return false; S.rival = { id: String(r.id || r.name || 'captive').toLowerCase().replace(/\W+/g, ''), name: r.name || 'Captive', gang: r.gang || '', gangName: r.gangName || r.gang || 'rival crew', col: r.col ?? 0x555555 };
  S.rivalState = 'tied'; rivalModel(); layPins(true); say(pick(C.LINES.rival)); toast(`❄️ Benny: \u201c${C.LINES.bennyTie}\u201d ${S.rival.name} is the head pin.`, 3200); emit('tied', { rival: S.rival.name }); return true;
}
function grab() {
  if (S.rivalState !== 'hut' || !S.rival) return res(false, 'Nobody to grab right now.');
  S.rivalState = 'ko'; S.koT = 0; const r = S.rival; toast(`👊 You flatten ${r.name} (${r.gangName}). Lights out, birdies tweeting.`, 2600); emit('grab', { rival: r.name });
  return res(true, 'grabbed');
}
function finishKo() { S.rivalState = 'tied'; layPins(true); fadeBlink(); const r = S.rival; toast(`❄️ Benny zip-ties ${r.name} upright as the head pin. \u201c${C.LINES.bennyTie}\u201d`, 3400); setTimeout(() => say(C.LINES.rival[0]), 700); setTimeout(() => say(C.LINES.rival[1]), 2900); emit('tied', { rival: r.name }); }
function limpOff() { const r = S.rival; if (!r) return; S.rivalState = 'limp'; S.limpT = 0; const h = parts?.rival; if (h) { h.ties.visible = false; h.rag = null; } say(pick(C.LINES.limp), 2600);
  const rv = save.rivals[r.id] = save.rivals[r.id] || { games: 0, hits: 0 }; rv.games++; rv.back = now() + C.RIVAL_BACK_S; persist(); toast(`🦵 ${r.name} limps off across the ice, cursing. He\u2019ll be back (${rv.games} ${rv.games === 1 ? 'game' : 'games'} so far).`, 3400); }

// ---------- money / board ----------
function res(ok, msg) { return { ok, msg }; }
function hasOwnBoard() { return !!tryv(() => window.SSX?.swag?.hasBoard?.(), false); }
function canRide() { return S.rented || hasOwnBoard(); }
function rent() { if (S.rented || hasOwnBoard()) return res(false, hasOwnBoard() ? 'You own a board. No rental.' : 'You already have a board.'); if (!spend(C.RENT)) return res(false, `💸 The board is ${C.RENT} cr. You have ${fmt(credits())}.`); S.rented = true; toast(`🏂 Board rented (−${C.RENT} cr). Benny: \u201c${C.LINES.bennyRent.split('. ').slice(1).join('. ')}\u201d`, 3600); emit('rent'); return res(true, 'rented'); }
function lift() {
  if (!canRide()) return res(false, 'Rent a board from Benny, or buy one at Slick\u2019s shop.'); const tc = S.lastTc; if (!tc?.player) return res(false, 'Not on Mars.');
  fadeBlink(); const p = tc.player, s = C.SPOTS.start; p.x = s.x; p.z = s.z; p.y = tc.height(s.x, s.z) + EYE; p.vy = 0; p.yaw = Math.PI; p.faceYaw = Math.PI;
  tryv(() => surf()?.debugMove?.(s.x, s.z, Math.PI));
  boardOn(true); S.run = { t: 0, count: 2.2, stars: 0, cr: 0, tricks: 0, air: 0, pts: 0, done: false }; S.combo = { mult: 1, left: 0 }; S.parkTold = false; save.runs++; persist(); toast('🚡 Top of the run. Straight down races. Left is Planum X: pipe, jumps, rails. 3 · 2 · 1 …', 3200); emit('lift'); return res(true, 'lift');
}
function boardOn(timed = false) {
  const tc = S.lastTc; if (!tc?.player) return res(false, 'Not on Mars.'); if (!canRide()) return res(false, 'Rent a board from Benny, or buy one at Slick\u2019s shop.'); if (tc.car) return res(false, 'Get out of the ride first.');
  const p = tc.player; S.board = C.freshBoard(p.x, p.z, Number.isFinite(p.yaw) ? p.yaw : Math.PI); S.board.y = tc.height(p.x, p.z); if (!timed) { S.run = null; S.freePts = 0; } S.combo = { mult: 1, left: 0 }; S.mode = 'board'; S.camPos = null;
  if (!timed) toast(`🏂 Free ride. ${isTouch() ? 'Stick' : 'A / D'} carve, hold forward to haul. Jump ollies. In the air hold Jump: forward mute, back method, left stalefish, right melon. Land a rail to grind. Stars pay on a timed run (🚡 lift).`, 4600); emit('board', { on: true }); return res(true, 'on');
}
function boardOff(why) {
  if (S.mode !== 'board') return res(false, 'Not on a board.'); const tc = S.lastTc, b = S.board; S.mode = 'foot';
  if (tc?.player && b) { const p = tc.player; p.x = b.x; p.z = b.z; p.y = tc.height(b.x, b.z) + EYE; p.vy = 0; p.grounded = true; p.yaw = b.head; p.faceYaw = b.head; }
  if (S.run && !S.run.done) { S.run.done = true; toast(why || '⏏ Off the board. Run cancelled.', 2400); }
  S.board = null; if (parts?.board) parts.board.visible = false; restorePose(); emit('board', { on: false }); return res(true, 'off');
}
function restorePose() { const a = S.lastTc?.astro; if (a?.group) { a.group.rotation.z = 0; a.group.rotation.x = 0; } }

// ---------- bowling ----------
function bowl() {
  if (S.bowl) return res(false, 'Already bowling.'); const tc = S.lastTc; if (!tc?.player) return res(false, 'Not on Mars.');
  if (S.mode === 'board') boardOff();
  const rival = S.rival && S.rivalState === 'tied';
  S.bowl = { rolls: [], heads: 0, paid: 0, standing: Array(10).fill(true), t: { aim: 0, power: 0.7, spin: 0 }, anim: null, rival, frameLog: [] };
  layPins(true); const p = tc.player; p.x = C.SPOTS.foul.x; p.z = C.SPOTS.foul.z - 0.6; p.yaw = Math.PI; p.faceYaw = Math.PI;
  toast(rival ? `🎳 Benny: \u201c${C.LINES.benny}\u201d Head pin: ${S.rival.name}.` : `🎳 Benny: \u201c${C.LINES.bennyNoRival}\u201d (Ice head pin, no head-pin bonus.)`, 3600);
  if (rival) say(C.LINES.rival[1]); bowlUi(true); paintBowl(); emit('bowl', { rival }); return res(true, 'bowl');
}
function roll(t) {
  const B = S.bowl; if (!B || B.anim) return res(false, B ? 'Wait for the pins.' : 'Not bowling.');
  if (t) B.t = { aim: C.clamp(+t.aim || 0, -0.1, 0.1), power: C.clamp(t.power ?? B.t.power, 0.15, 1), spin: C.clamp(+t.spin || 0, -1, 1) };
  const pos = C.position(B.rolls); if (pos.done) return res(false, 'Game over.');
  const ballFx = tryv(() => window.SSX?.swag?.ball?.(), null) || {};
  const drift = (window.__icecapNoWobble ? 0 : C.wobble(B.t.power, Math.random())) * (1 - Math.min(0.75, +ballFx.steady || 0)); B.lastDrift = drift; // v7.5.59: ice drift, eased by a bought ball
  const r = C.simulate({ ...B.t, aim: B.t.aim + drift }, B.standing, { hook: +ballFx.hook || 0, pop: +ballFx.pop || 0 }); B.anim = { r, t: 0, end: r.frames[r.frames.length - 1].t + 1.0, pos, standing: B.standing.slice(), headUp: B.standing[0] };
  if (parts) { parts.aim.visible = false; }
  emit('roll', { ...B.t }); paintBowl(); return res(true, 'rolled');
}
function resolveRoll() {
  const B = S.bowl, A = B.anim; B.anim = null; const r = A.r, pos = A.pos, count = r.count;
  B.rolls.push(count); const strike = count === 10 && pos.fresh && A.standing.every(Boolean);
  const headHit = A.headUp && r.knocked.includes(0) && B.rival; if (headHit) { B.heads++; const rv = save.rivals[S.rival.id] = save.rivals[S.rival.id] || { games: 0, hits: 0 }; rv.hits++; persist(); }
  const cr = C.ballPay(count, headHit, strike, B.rival); B.paid += cr; give(cr);
  const bits = [strike ? '💥 STRIKE!' : count === 0 ? (r.gutter ? '🫠 Gutter ball.' : '🫠 Missed everything.') : `${count} pin${count === 1 ? '' : 's'}.`];
  if (headHit) bits.push(`${S.rival.name} goes flying (+${C.PAY.head} cr).`); if (cr) bits.push(`+${fmt(cr)} cr`);
  toast(`🎳 ${bits.join(' ')}`, 2800); B.last = { count, strike, headHit, gutter: r.gutter }; emit('rolled', { count, strike, headHit, gutter: r.gutter, cr });
  // who's still standing for the next ball
  const next = C.position(B.rolls);
  if (next.done) { endGame(); return; }
  if (next.fresh) { B.standing = Array(10).fill(true); setTimeout(() => { if (!S.bowl) return; if (S.rival && B.rival) { S.rivalState = 'tied'; } layPins(true); if (B.rival) { toast(`❄️ Benny: \u201c${C.LINES.bennyRetie}\u201d`, 2200); say(pick(C.LINES.rival)); } paintBowl(); }, 900); }
  else { B.standing = A.standing.map((u, i) => u && !r.knocked.includes(i)); if (r.knocked.includes(0) && B.rival) S.rivalState = 'down'; setTimeout(() => { if (!S.bowl) return; sweep(B.standing); paintBowl(); }, 900); }
  paintBowl();
}
function sweep(standing) { // knocked pins cleared off the deck; a knocked-down rival sits dazed by the gutter
  layPins(false, standing); const h = parts?.rival; if (h && S.rivalState === 'down') { h.rag = null; h.group.position.set(C.CX + C.GUTTER + 1.2, 0.2, laneZ(C.PIN0 - 1)); h.group.rotation.set(0, -Math.PI / 2, 0); resetPose(h); h.hips.position.y = 0.5; for (const l of h.legs) l.rotation.x = 1.45; h.ties.visible = true; parts.stars.visible = true; S.dazed = 2.5; }
}
function endGame() {
  const B = S.bowl, pay = C.payout(B.rolls, B.heads, B.rival), sc = C.score(B.rolls); save.games++; save.best = Math.max(save.best, sc.total); if (pay.perfect) save.perfect++; persist();
  let pp = null; if (pay.perfect) { pp = C.perfectPay(save.perfectAt, Date.now()); if (pp.full) { save.perfectAt = Date.now(); persist(); }
    give(pp.cr, pp.stars); B.paid += pp.cr; pay.cr += pp.cr - C.PAY.perfectCr; pay.stars = pp.stars;
    toast(pp.full ? `🧊 PERFECT COLD! Three strikes. +${fmt(pp.cr)} cr +${pp.stars}★` : `🧊 PERFECT COLD again! Benny: \u201cI already paid you the big one, hotshot. Come back later.\u201d +${pp.stars}★`, 4200); }
  B.over = { total: sc.total, cr: pay.cr, stars: pay.stars, bonusFull: pp ? pp.full : null, perfect: pay.perfect, strikes: pay.strikes, heads: pay.heads };
  emit('gameover', B.over); paintBowl(); if (B.rival) setTimeout(() => limpOff(), 1600);
}
function quit() { if (!S.bowl) return res(false, 'Not bowling.'); const B = S.bowl; if (B.anim) return res(false, 'Wait for the pins.'); const started = B.rolls.length > 0, over = !!B.over; S.bowl = null; bowlUi(false); restorePose();
  if (B.rival && started && !over) limpOff(); layPins(true); if (!over) toast(started ? `🎳 You walk off the lane. Paid so far: ${fmt(B.paid)} cr.` : '🎳 Maybe later.', 2400); emit('quit'); return res(true, 'quit'); }

// ---------- per-frame ----------
const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
let prevJump = false, markT = 0;
function tick(dt, tc) {
  S.simT += dt; attach(); hookMenu();
  if (!onMars(tc) || !tc.scene) { if (S.mode === 'board') { S.mode = 'foot'; S.board = null; } if (S.bowl) { S.bowl = null; bowlUi(false); } syncUi(null); return; }
  S.lastTc = tc; const p = tc.player;
  const near = C.nearZone(p.x, p.z, 450);
  if (!near && !S.bowl && S.mode !== 'board') { if (G) G.visible = false; if (S.rented && !C.nearZone(p.x, p.z, 50)) { S.rented = false; toast('🏂 You left the ice cap. Benny gets his board back.', 2400); } syncUi(null); return; }
  if (!G || G.parent !== tc.scene) { G = null; build(tc); }
  G.visible = true;
  if ((markT -= dt) <= 0) { markT = 3; tryv(() => window.SSX?.minimap?.addMarks?.('icecap', [{ x: C.CX, z: 760, color: '#eaf6ff', r: 7, ring: true }, { x: C.CX, z: C.FOUL + 12, color: '#ffffff', r: 3.2, ring: true }])); }
  refreshRival();
  animNpcs(dt, tc);
  if (S.mode === 'board' && S.board) rideTick(dt, tc);
  else if (S.bowl) bowlTick(dt, tc);
  if (parts?.board && S.mode !== 'board') parts.board.visible = false;
  if (S.view && tc.camera) { tc.camera.position.set(S.view.p[0], S.view.p[1], S.view.p[2]); tc.camera.lookAt(S.view.l[0], S.view.l[1], S.view.l[2]); } // __icecap.view() (tests / screenshots only)
  syncGear(); syncUi(tc);
}
function input(tc) {
  const a = app() || {}, k = a.keys || {}, j = a.joy || { x: 0, y: 0 }, tb = a.touchBtns || {};
  const steer = C.clamp((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + (j.x || 0), -1, 1);
  const tuck = C.clamp((k.KeyW || k.ArrowUp ? 1 : 0) + Math.max(0, -(j.y || 0)), 0, 1), brake = C.clamp((k.KeyS || k.ArrowDown ? 1 : 0) + Math.max(0, (j.y || 0) - 0.25) * 1.3, 0, 1);
  const hold = !!(k.Space || tb.jump), jump = hold && !prevJump; prevJump = hold; return { steer, tuck, brake, hold, jump };
}
function rideTick(dt, tc) {
  const b = S.board, p = tc.player, run = S.run, inp = input(tc);
  if (run && run.count > 0) { run.count -= dt; inp.steer = 0; inp.jump = false; inp.tuck = 0; inp.brake = 1; if (run.count <= 0) { toast('🏁 GO! Tuck to haul. Left lane is the park.', 1400); b.v = Math.max(b.v, C.BOARD.PUSH0); } }
  if (run && run.done && b.z > C.Z_BOT) { inp.brake = 1; inp.chute = true; }
  const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps, ground = (x, z) => tc.height(x, z);
  let tricked = false;
  const ride = tryv(() => window.SSX?.swag?.ride?.(), null);
  for (let i = 0; i < steps; i++) {
    const ev = C.boardStep(b, { ...inp, jump: inp.jump && i === 0, ride }, h, ground); if (ev) { landed(ev); tricked = true; }
    // Shop walls. boardStep only samples height, so a rider would pass through the lobby.
    // Same five rectangles as the walking solids, applied before the player position write below.
    if (b.y < ground(b.x, b.z) + 9) {
      const sl = tryv(() => window.SSX?.swag?.slide?.(b.x, b.z, 0.45), null);
      if (sl) { b.x = sl.x; b.z = sl.z; if (!b.air) b.y = ground(b.x, b.z); if (b.v > 5) b.v = 5; }
    }
  }
  if (!tricked) S.combo = C.nextCombo(S.combo, dt, false);
  if (!S.parkTold && C.parkOpen(b.x, b.z) > 0.72 && b.x > C.CX + 20) { S.parkTold = true; toast('PLANUM X. Jumps and rails on this lane, superpipe further left. Hold Jump + stick to grab. Land the rail to grind.', 4200); }
  if (run && !run.done && run.count <= 0) { run.t += dt; if (b.z >= C.Z_BOT) finishRun(); else if (run.t >= C.RUN_SECS) { run.done = true; toast('⏱ Time! 90 seconds up. Run over (keep riding for fun).', 3000); emit('runend', { ok: false }); } }
  if (b.air) { if (run && !run.done) run.air += dt; }
  if (S.call) { S.call.t -= dt; if (S.call.t <= 0) S.call = null; }
  if (run?.done && b.z > C.Z_BOT && b.v < 0.6 && !b.air) { boardOff(' '); toast('🎳 The run ends at Benny\u2019s lane. Step up and bowl.', 2600); return; }
  if (!C.nearZone(b.x, b.z, 30)) { boardOff('⏏ Off the snow. Board off.'); return; }
  // player + camera follow the board
  const ox = p.x, oz = p.z; p.x = b.x; p.z = b.z; p.y = b.y + EYE; p.vy = 0; p.grounded = !b.air; p.yaw = b.head; p.faceYaw = b.head + Math.PI / 2 + b.spin; p.moving = 0;
  const a = tc.astro;
  if (a?.group) { a.group.visible = true; a.group.position.set(b.x, b.y + 0.08, b.z); a.group.rotation.order = 'YXZ'; a.group.rotation.y = b.head + Math.PI / 2 + b.spin; a.group.rotation.x = b.wip > 0 ? -1.2 * Math.min(1, b.wip) : 0; a.group.rotation.z = b.air ? 0 : -b.lean * 0.22;
    const P = a.parts || {}; /* sideways stance, knees bent */ const grinding = !!b.grind, crouch = b.air ? (inp.hold ? 1.1 : 0.6) : grinding ? 0.85 : 0.35 + 0.25 * inp.tuck;
    if (P.legL) { P.legL.rotation.set(0.35 * crouch, 0, 0.3); P.legR.rotation.set(0.35 * crouch, 0, -0.3); }
    if (P.armL) { const out = grinding ? 1.35 : 1.1; P.armL.rotation.set(b.air && inp.hold ? 1.6 : grinding ? 0.2 : -0.3, 0, -out); P.armR.rotation.set(b.air && inp.hold ? 1.6 : grinding ? 0.2 : -0.3, 0, out); } }
  const bd = parts.board; if (bd.parent !== tc.scene) tc.scene.add(bd); bd.visible = true; bd.position.set(b.x, b.y + 0.02, b.z); bd.rotation.order = 'YXZ'; bd.rotation.y = b.head + b.spin;
  const gA = tc.height(b.x - Math.sin(b.head) * 0.7, b.z - Math.cos(b.head) * 0.7), gB = tc.height(b.x + Math.sin(b.head) * 0.7, b.z + Math.cos(b.head) * 0.7); bd.rotation.x = b.air ? -0.15 : Math.atan2(gA - gB, 1.4);
  // chase camera behind the heading
  const cam = tc.camera, back = 8 + Math.min(7, b.v * 0.16), want = v3.set(b.x + Math.sin(b.head) * back, b.y + 3.4, b.z + Math.cos(b.head) * back);
  const gy = tc.height(want.x, want.z) + 1.2; if (want.y < gy) want.y = gy;
  if (!S.camPos) S.camPos = want.clone(); else S.camPos.lerp(want, 1 - Math.exp(-dt * 6));
  cam.position.copy(S.camPos); cam.lookAt(v3b.set(b.x - Math.sin(b.head) * 6, b.y + 1.0, b.z - Math.cos(b.head) * 6));
  void ox; void oz;
}
function landed(ev) {
  const run = S.run, paid = run && !run.done && run.count <= 0;
  if (ev.wipe) { S.combo = { mult: 1, left: 0 }; S.call = null; toast(ev.grind ? '💥 Slipped the rail.' : '💥 Wipeout! Land it straight.', 1500); emit('wipe'); return; }
  if (!ev.tricks.length && ev.airT < 0.5) return;
  S.combo = C.nextCombo(S.combo, 0, true);
  const base = C.trickPoints(ev.tricks, ev.airT), pts = base * S.combo.mult;
  if (run && run.count <= 0) { run.pts = (run.pts || 0) + pts; }
  else if (!run) S.freePts = (S.freePts || 0) + pts;
  S.call = { text: `${S.combo.mult > 1 ? 'x' + S.combo.mult + '  ' : ''}${(ev.tricks.join(' + ') || 'BIG AIR').toUpperCase()}   ${pts}`, t: 1.45 };
  const parts_ = [ev.tricks.join(' + ') || 'Big air', `${ev.airT.toFixed(1)} s`, `${pts} pts${S.combo.mult > 1 ? ' x' + S.combo.mult : ''}`];
  if (paid) { run.stars += ev.stars; run.cr += ev.cr; run.tricks += ev.tricks.length; give(ev.cr, ev.stars); if (ev.stars) parts_.push(`+${ev.stars}★`); if (ev.cr) parts_.push(`+${ev.cr} cr`); }
  toast(`🏂 ${parts_.join(' · ')}${ev.sw ? ' (switch)' : ''}`, 1800); emit('trick', { ...ev, paid: !!paid, pts, mult: S.combo.mult });
}
function finishRun() { const run = S.run; run.done = true; const best = !save.bestRun || run.t < save.bestRun; if (best) save.bestRun = run.t;
  const pts = run.pts || 0, bestPts = pts > (save.bestPts || 0); if (bestPts) save.bestPts = pts; persist();
  toast(`🏁 Finish ${C.fmtTime(run.t)}${best ? ' (best!)' : ''} · Planum X ${fmt(pts)} pts${bestPts && pts ? ' (best!)' : ''} · ${run.tricks} trick${run.tricks === 1 ? '' : 's'} +${run.stars}★ · air +${run.cr} cr`, 4600); emit('runend', { ok: true, t: run.t, stars: run.stars, cr: run.cr, pts }); }

function animNpcs(dt, tc) {
  if (!parts) return; const t = S.simT, bn = parts.benny; resetPose(bn); bn.head.rotation.y = Math.sin(t * 0.5) * 0.5; bn.arms[1].rotation.x = 0.4 + Math.sin(t * 1.3) * 0.1; bn.torso.rotation.z = Math.sin(t * 1.1) * 0.03;
  if (S.bowl && S.bowl.anim) bn.arms[0].rotation.x = 2.6;
  G.traverse(o => { if (o.userData.flag) o.rotation.y = Math.sin(t * 3 + o.position.z) * 0.3; });
  const h = parts.rival; if (!h) return;
  if (h.bub) { h.bubT -= dt; if (h.bubT <= 0) { h.group.remove(h.bub); h.bub = null; } }
  parts.stars.visible = false;
  if (S.rivalState === 'hut') { resetPose(h); h.group.visible = true; const s = Math.sin(t * 1.6); h.head.rotation.y = Math.sin(t * 0.4) * 0.5; h.arms[1].rotation.x = 0.9 + 0.2 * s; h.ties.visible = false; }
  else if (S.rivalState === 'ko') { S.koT += dt; const k = Math.min(1, S.koT / 0.5); h.group.rotation.order = 'YXZ'; h.group.rotation.x = -k * 1.45; h.group.rotation.y = -Math.PI / 2 + S.koT * 2 * (1 - k); starsAt(h, t, 0.6); if (S.koT > 1.6) finishKo(); }
  else if (S.rivalState === 'tied') { if (!h.rag) { h.group.rotation.x = 0; h.head.rotation.y = Math.sin(t * 3) * 0.35; h.torso.rotation.z = Math.sin(t * 5) * 0.05; } }
  else if (S.rivalState === 'down') { if (S.dazed > 0) { S.dazed -= dt; starsAt(h, t, 1.5); } }
  else if (S.rivalState === 'limp') { S.limpT += dt; h.group.rotation.set(0, -Math.PI / 2 + 0.6, 0); resetPose(h); const sw = Math.sin(t * 5); h.legs[0].rotation.x = sw * 0.5; h.legs[1].rotation.x = -sw * 0.2; h.torso.rotation.z = 0.15 + 0.1 * sw; h.arms[0].rotation.z = -0.4 + 0.3 * sw;
    const d = 1.1 * dt; h.group.position.x += Math.sin(h.group.rotation.y) * -d; h.group.position.z += Math.cos(h.group.rotation.y) * -d; h.group.position.y = tc.height(h.group.position.x, h.group.position.z) + Math.abs(sw) * 0.05;
    if (S.limpT > 9) { h.group.visible = false; S.rivalState = 'none'; S.rival = null; G.remove(h.group); parts.rival = null; } }
  if (h.rag) ragTick(h, dt);
}
function starsAt(h, t, y) { const s = parts.stars; s.visible = true; s.position.copy(h.group.position); s.position.y += y + 0.9; s.children.forEach(c => { const a = c.userData.a + t * 4; c.position.set(Math.cos(a) * 0.45, Math.sin(t * 6 + c.userData.a) * 0.06, Math.sin(a) * 0.45); }); }
// cartoon ragdoll: he slides where the sim says, bounces, spins head over heels, limbs flail, lands flat with stars
function ragTick(h, dt) {
  const R = h.rag; R.t += dt; R.vy -= 9 * dt; R.y += R.vy * dt; if (R.y < 0) { R.y = 0; R.vy = Math.abs(R.vy) * 0.45; if (R.vy < 0.6) R.vy = 0; R.spinX *= 0.6; R.spinZ *= 0.6; }
  R.ax += R.spinX * dt; R.az += R.spinZ * dt; const settle = R.t > 1.6 ? Math.min(1, (R.t - 1.6) / 0.5) : 0;
  h.group.rotation.order = 'YXZ'; h.group.rotation.x = R.ax * (1 - settle) + (-Math.PI / 2) * settle; h.group.rotation.z = R.az * (1 - settle);
  h.hips.position.y = h.base + R.y; const f = Math.sin(R.t * 18) * (1 - settle); h.arms[0].rotation.z = -1.6 + f; h.arms[1].rotation.z = 1.6 - f; h.legs[0].rotation.x = 0.8 * f; h.legs[1].rotation.x = -0.8 * f; h.head.rotation.x = 0.5 * f;
  if (settle >= 1) starsAt(h, S.simT, 0.2);
}

let bowlCam = null, zoomCam = null; const BOWL_ZOOM = 1.7;
function bowlTick(dt, tc) {
  const B = S.bowl, p = tc.player, cam = tc.camera; p.x = C.SPOTS.foul.x; p.z = C.SPOTS.foul.z - 0.6; p.y = tc.height(p.x, p.z) + EYE; p.vy = 0; p.yaw = Math.PI; p.faceYaw = Math.PI;
  const a = tc.astro; if (a?.group) { a.group.position.set(p.x, p.y - EYE, p.z); a.group.rotation.y = Math.PI; }
  keysBowl();
  let want, look;
  if (B.anim) {
    const A = B.anim; A.t += dt; const fr = A.r.frames; let i = 0; while (i < fr.length - 1 && fr[i + 1].t < A.t) i++; const f0 = fr[i], f1 = fr[Math.min(fr.length - 1, i + 1)], k = f1.t > f0.t ? C.clamp((A.t - f0.t) / (f1.t - f0.t), 0, 1) : 1;
    const bu = f0.b[0] + (f1.b[0] - f0.b[0]) * k, bw = f0.b[1] + (f1.b[1] - f0.b[1]) * k; parts.ball.position.set(laneX(bu), 0.23 + C.BALL_R, laneZ(bw)); parts.ball.rotation.x += dt * 8; parts.ball.visible = bw < C.PIN0 + 7;
    f0.p.forEach((q, j) => { if (!A.standing[j]) return; const q1 = f1.p[j], u = q[0] + (q1[0] - q[0]) * k, w = q[1] + (q1[1] - q[1]) * k;
      if (j === 0 && B.rival && parts.rival) { const h = parts.rival; h.group.position.x = laneX(u); h.group.position.z = laneZ(w);
        if (q1[2] && !h.rag) { const v = A.r.headV || [0, 6], sp = Math.hypot(v[0], v[1]); h.rag = { t: 0, y: 0, vy: 2.4 + sp * 0.2, ax: 0, az: 0, spinX: -(4 + sp * 0.8), spinZ: v[0] * -1.2 }; h.ties.visible = true; say(pick(C.LINES.hit), 2000); emit('headhit', { rival: S.rival?.name }); }
        return; }
      const o = parts.pins[j]; o.position.x = laneX(u); o.position.z = laneZ(w);
      if (q1[2]) { const fl = A.r.fall[j] || [0, 1]; if (!o.userData.fall) o.userData.fall = { t: 0 }; const F = o.userData.fall; F.t = Math.min(1, F.t + dt * 3); o.rotation.order = 'YXZ'; o.rotation.y = Math.atan2(-fl[0], fl[1]); o.rotation.x = F.t * Math.PI / 2; } });
    const cz = C.clamp(bw - 7, -5, C.PIN0 - 9), atPins = bw > C.PIN0 - 4;
    if (atPins) { want = v3.set(C.CX + 3.4, 3.4, laneZ(C.PIN0 - 9.5)); look = v3b.set(C.CX + 0.4, 0.2, laneZ(C.PIN0 - 1)); /* v7.5.61: overlay is transparent, centre the pin deck */ } // side angle on the pin deck: watch the head pin go
    else { want = v3.set(C.CX - bu * 0.4, 3.4, laneZ(cz)); look = v3b.set(C.CX - bu * 0.3, 0.7, laneZ(Math.min(bw + 6, C.PIN0 + 1))); }
    if (A.t >= A.end) resolveRoll();
  } else {
    want = v3.set(C.CX, 2.9, C.FOUL - 4.2); look = v3b.set(C.CX, 0.6, laneZ(C.PIN0 - 2));
    if (!B.over) aimDots(); else parts.aim.visible = false;
  }
  if (!bowlCam) bowlCam = want.clone(); else bowlCam.lerp(want, 1 - Math.exp(-dt * 5));
  cam.position.copy(bowlCam); cam.lookAt(look);
  if (cam.zoom !== BOWL_ZOOM) { cam.zoom = BOWL_ZOOM; cam.updateProjectionMatrix(); zoomCam = cam; } // v7.5.59 (p3): pins + rival read clearly on a phone
}
let aimKey = '', aimPath = [];
function aimDots() {
  const B = S.bowl, t = B.t, key = `${t.aim}|${t.power}|${t.spin}`; parts.aim.visible = true;
  if (key !== aimKey) { aimKey = key; const r = C.simulate(t, Array(10).fill(false), { every: 12 }); aimPath = r.frames.filter(f => f.b[1] < C.PIN0 - 1.5).map(f => f.b); }
  const n = parts.aim.children.length; parts.aim.children.forEach((d, i) => { const q = aimPath[Math.min(aimPath.length - 1, Math.floor((i + 1) / n * aimPath.length * (0.35 + 0.65 * t.power)))]; if (!q) { d.visible = false; return; } d.visible = true; d.position.set(laneX(q[0]), 0.27, laneZ(q[1])); });
}

// ---------- keys while bowling (←/→ aim, Shift+←/→ spin, ↑/↓ power, Space roll; Enter = the Roll button, Esc = ✕) ----------
// laptop keys while bowling: queued from keydown (a quick tap between two frames still counts at low fps)
const keyQ = []; const BOWL_KEYS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Space: 1 };
addEventListener('keydown', e => { if (!S.bowl || e.repeat || !BOWL_KEYS[e.code]) return; if (e.target?.closest?.('input, textarea')) return; keyQ.push({ c: e.code, sh: e.shiftKey }); e.preventDefault(); });
function keysBowl() { const B = S.bowl; if (!B || B.anim || B.over) { keyQ.length = 0; return; }
  let ch = false, go = false;
  while (keyQ.length) { const { c, sh } = keyQ.shift(), K = c.slice(5);
    if (K === 'Left' || K === 'Right') { B.t = C.nudge(B.t, sh ? 'spin' : 'aim', K === 'Left' ? -1 : 1); ch = true; }
    else if (K === 'Up' || K === 'Down') { B.t = C.nudge(B.t, 'power', K === 'Up' ? 1 : -1); ch = true; }
    else if (c === 'Space') { go = true; break; } }
  if (ch) paintBowl(); if (go) { keyQ.length = 0; roll(); } }

// ---------- UI ----------
const css = `
#icecapAct{position:fixed;z-index:15;left:calc(14px + env(safe-area-inset-left));bottom:calc(250px + env(safe-area-inset-bottom));display:none;min-height:52px;min-width:120px;max-width:calc(100vw - 150px);padding:6px 16px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:900 17px/1.15 system-ui,sans-serif;touch-action:manipulation;box-shadow:0 2px 10px #000;text-align:left}
#icecapAct.on{display:block}#icecapAct small{display:block;font-weight:700;font-size:12px;opacity:.85}
#icecapRun{position:fixed;z-index:14;top:calc(70px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;max-width:calc(100vw - 20px);padding:6px 14px;border-radius:12px;border:3px solid #fff;background:#000;color:#fff;font:900 16px/1.2 ui-monospace,Menlo,monospace;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#icecapCall{position:fixed;z-index:14;top:30%;left:50%;transform:translateX(-50%);display:none;max-width:calc(100vw - 24px);padding:8px 14px;border-radius:12px;border:3px solid #fff;background:#000;color:#fff;font:900 18px/1.15 system-ui,sans-serif;pointer-events:none;text-align:center}
#icecapRun.on{display:block}#icecapCall.on{display:block}
#icecapBowl{position:fixed;z-index:40;inset:0;display:none;flex-direction:column;background:transparent;color:#fff;pointer-events:none;padding:calc(6px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));font:700 13px/1.25 system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;box-sizing:border-box}
#icecapBowl.on{display:flex}
#icecapBowl .top{pointer-events:auto;background:rgba(0,0,0,.92);border-radius:12px;padding:4px}
#icecapBowl .card{display:flex;gap:4px;align-items:stretch}#icecapBowl .fr{flex:1;border:2px solid #fff;border-radius:8px;text-align:center;padding:1px 0;min-width:0;background:#000;font-size:11px}
#icecapBowl .fr b{display:inline;font:900 14px/1.2 ui-monospace,Menlo,monospace;letter-spacing:1px;margin-left:4px}#icecapBowl .fr span{font-size:10px;opacity:.8;margin-left:3px}#icecapBowl .fr.cur{background:#fff;color:#000}
#icecapBowl .msg{min-height:16px;font-weight:800;margin:3px 2px 0;text-shadow:0 1px 3px #000}
#icecapPad{position:relative;flex:1;min-height:60px;pointer-events:auto;background:transparent;border:0;display:flex;align-items:flex-end;justify-content:center;text-align:center;touch-action:none;overflow:hidden}
#icecapPad svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#icecapPadTxt{background:rgba(0,0,0,.6);border-radius:10px;padding:3px 10px;margin-bottom:4px;font:800 12px/1.25 system-ui,sans-serif;pointer-events:none}#icecapPadTxt small{font-size:10px;opacity:.85}
#icecapBowl .bot{pointer-events:auto}
#icecapBowl .row{display:flex;gap:5px;margin-top:4px}#icecapBowl .row button{flex:1;min-height:44px;min-width:40px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:900 14px/1 system-ui,sans-serif;touch-action:manipulation;padding:0 3px}
#icecapBowl .row button.go{background:#000;color:#fff;border-color:#fff;box-shadow:inset 0 0 0 2px #fff}#icecapBowl .meter{font:800 11px/1.2 ui-monospace,Menlo,monospace;background:rgba(0,0,0,.6);border-radius:8px;padding:2px 8px;display:inline-block}
body.icecapBowling :is(#joy,#fireBtn,#fireHint,#jumpBtn,#petBtn,#miniMap,#radio,#radioBtn,#surfBtns,#surfHelp,#hxMore,#hxMoreP,#icecapAct,#obLine){display:none!important}
#icecapFade{position:fixed;inset:0;z-index:60;background:#000;opacity:0;pointer-events:none;transition:opacity .25s}
`;
let actBtn, runEl, callEl, bowlEl, padEl, fadeEl, actKey = '';
function realTap(el, fn) { // same pointerId, < 10 px moved; mouse / keyboard click still works
  let down = null, maxMove = 0, lastUp = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; down = { id: e.pointerId, x: e.clientX, y: e.clientY }; maxMove = 0; });
  el.addEventListener('pointermove', e => { if (down && e.pointerId === down.id) maxMove = Math.max(maxMove, Math.hypot(e.clientX - down.x, e.clientY - down.y)); });
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') return; const d = down; down = null; if (!C.isRealTap(d, { id: e.pointerId, x: e.clientX, y: e.clientY }, maxMove)) return; e.preventDefault(); lastUp = performance.now(); fn(e); });
  el.addEventListener('click', e => { if (performance.now() - lastUp < 700) return; fn(e); });
}
function ui() {
  if (actBtn) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  actBtn = document.createElement('button'); actBtn.id = 'icecapAct'; actBtn.type = 'button'; document.body.appendChild(actBtn); realTap(actBtn, () => act(actBtn.dataset.mode));
  runEl = document.createElement('div'); runEl.id = 'icecapRun'; runEl.setAttribute('role', 'status'); document.body.appendChild(runEl);
  callEl = document.createElement('div'); callEl.id = 'icecapCall'; callEl.setAttribute('role', 'status'); document.body.appendChild(callEl);
  fadeEl = document.createElement('div'); fadeEl.id = 'icecapFade'; document.body.appendChild(fadeEl);
  bowlEl = document.createElement('div'); bowlEl.id = 'icecapBowl'; bowlEl.setAttribute('role', 'dialog'); bowlEl.setAttribute('aria-label', 'Snow bowling');
  bowlEl.innerHTML = `<div class="top"><div class="card" id="icecapCard"></div><div class="msg" id="icecapMsg" aria-live="polite"></div></div>
<div id="icecapPad"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline id="icecapTrail" fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" points=""/></svg><div id="icecapPadTxt">Swipe up to roll<br><small>sideways = aim · length = power · curve = spin</small></div></div>
<div class="bot"><div class="meter" id="icecapMeter"></div>
<div class="row"><button type="button" id="icecapAimL" aria-label="Aim left">◀</button><button type="button" id="icecapAimR" aria-label="Aim right">▶</button><button type="button" id="icecapSpin" aria-label="Spin">⟳ Spin</button><button type="button" id="icecapPow" aria-label="Power">⚡ Pow</button><button type="button" class="go" id="icecapRoll">🎳 Roll</button><button type="button" id="icecapQuit" aria-label="Quit bowling">✕</button></div></div>`;
  document.body.appendChild(bowlEl); padEl = bowlEl.querySelector('#icecapPad');
  const nud = (w, d) => () => { if (!S.bowl || S.bowl.anim) return; S.bowl.t = C.nudge(S.bowl.t, w, d); paintBowl(); };
  realTap(bowlEl.querySelector('#icecapAimL'), nud('aim', -1)); realTap(bowlEl.querySelector('#icecapAimR'), nud('aim', 1));
  realTap(bowlEl.querySelector('#icecapSpin'), () => { if (!S.bowl || S.bowl.anim) return; const s = S.bowl.t.spin; S.bowl.t = { ...S.bowl.t, spin: s >= 0.99 ? -1 : +(s + 0.5).toFixed(2) }; paintBowl(); });
  realTap(bowlEl.querySelector('#icecapPow'), () => { if (!S.bowl || S.bowl.anim) return; const p = S.bowl.t.power; S.bowl.t = { ...S.bowl.t, power: p >= 0.99 ? 0.4 : Math.min(1, +(p + 0.15).toFixed(2)) }; paintBowl(); });
  realTap(bowlEl.querySelector('#icecapRoll'), () => { if (S.bowl?.over) { quit(); return; } const r = roll(); if (!r.ok) msg(r.msg); });
  realTap(bowlEl.querySelector('#icecapQuit'), () => { const r = quit(); if (!r.ok) msg(r.msg); });
  // swipe pad (its own pointer: same pointerId from down to up)
  let sw = null; const trail = bowlEl.querySelector('#icecapTrail');
  const ptOf = e => { const r = padEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now(), w: r.width, h: r.height }; };
  const draw = () => { if (!sw) { trail.setAttribute('points', ''); return; } trail.setAttribute('points', sw.pts.map(q => `${(q.x / q.w * 100).toFixed(1)},${(q.y / q.h * 100).toFixed(1)}`).join(' ')); };
  padEl.addEventListener('pointerdown', e => { if (!S.bowl || S.bowl.anim || S.bowl.over) return; e.preventDefault(); sw = { id: e.pointerId, pts: [ptOf(e)] }; try { padEl.setPointerCapture(e.pointerId); } catch (_) { /* */ } draw(); });
  padEl.addEventListener('pointermove', e => { if (!sw || e.pointerId !== sw.id) return; sw.pts.push(ptOf(e)); draw(); const t = C.swipeThrow(sw.pts, sw.pts[0].h); if (t.ok && S.bowl) { S.bowl.t = { aim: t.aim, power: t.power, spin: t.spin }; paintBowl(true); } });
  const end = e => { if (!sw || e.pointerId !== sw.id) return; sw.pts.push(ptOf(e)); const pts = sw.pts; sw = null; setTimeout(draw, 350); if (e.type === 'pointercancel') return; const t = C.swipeThrow(pts, pts[0].h); if (!t.ok) { msg(t.why); return; } const r = roll(t); if (!r.ok) msg(r.msg); };
  padEl.addEventListener('pointerup', end); padEl.addEventListener('pointercancel', end);
}
function msg(t) { const m = bowlEl?.querySelector('#icecapMsg'); if (m) m.textContent = t; }
function fadeBlink() { if (!fadeEl) return; fadeEl.style.opacity = '1'; setTimeout(() => { fadeEl.style.opacity = '0'; }, 380); }
function bowlUi(on) { ui(); bowlEl.classList.toggle('on', !!on); document.body.classList.toggle('icecapBowling', !!on); bowlCam = null; aimKey = ''; if (!on && zoomCam) { zoomCam.zoom = 1; zoomCam.updateProjectionMatrix(); zoomCam = null; } if (!on && parts) parts.aim.visible = false; }
function paintBowl(live) {
  const B = S.bowl; if (!B || !bowlEl) return; const sc = C.score(B.rolls), pos = C.position(B.rolls);
  bowlEl.querySelector('#icecapCard').innerHTML = sc.frames.map((f, i) => `<div class="fr${!pos.done && i === pos.frame ? ' cur' : ''}"><span>F${i + 1}</span><b>${f.marks.join(' ') || '&nbsp;'}</b><span>${f.score ?? '&nbsp;'}</span></div>`).join('') + `<div class="fr"><span>Total</span><b>${sc.total}</b><span>${fmt(B.paid)} cr</span></div>`;
  const t = B.t, aimTxt = Math.abs(t.aim) < 0.005 ? 'centre' : `${(Math.abs(t.aim) * 100).toFixed(0)} ${t.aim > 0 ? 'right' : 'left'}`, spinTxt = t.spin === 0 ? 'none' : `${t.spin > 0 ? '⟳' : '⟲'} ${Math.round(Math.abs(t.spin) * 100)}%`;
  bowlEl.querySelector('#icecapMeter').textContent = `aim ${aimTxt} · power ${Math.round(t.power * 100)}% · spin ${spinTxt}`;
  const rollB = bowlEl.querySelector('#icecapRoll');
  if (B.over) { rollB.textContent = '✓ Done'; msg(`${B.over.perfect ? '🧊 PERFECT COLD! ' : ''}Final ${B.over.total} · ${B.over.strikes} strike${B.over.strikes === 1 ? '' : 's'} · paid ${fmt(B.over.cr)} cr${B.over.stars ? ` + ${B.over.stars}★` : ''}`); return; }
  rollB.textContent = '🎳 Roll';
  if (!live) msg(B.anim ? 'Rolling…' : `Frame ${pos.frame + 1} of 3 · ball ${pos.ball + 1}${B.rival && S.rivalState === 'tied' ? ` · head pin: ${S.rival.name}` : ''}`);
}
function choice(title, opts) { const ch = window.SSX?.city?.choice; if (typeof ch === 'function') return ch(title, opts).catch(() => null); return Promise.resolve(confirm(title) ? opts[0].id : null); }
// the one context button: what you can do right here
function ctx(tc) {
  if (!tc || S.bowl) return null; const p = tc.player; if (tc.car || tryv(() => tc.world?.inside)) return null;
  if (S.mode === 'board') return { mode: 'off', label: '⏏ Off board' };
  if (!C.nearZone(p.x, p.z, 0)) return null;
  const d = q => Math.hypot(p.x - q.x, p.z - q.z), rv = parts?.rival;
  if (S.rivalState === 'hut' && rv && Math.hypot(p.x - rv.group.position.x, p.z - rv.group.position.z) < 3.2) return { mode: 'grab', label: `👊 Grab ${S.rival.name}`, sub: `${S.rival.gangName} lieutenant` };
  if (d(C.SPOTS.foul) < 4) return { mode: 'bowl', label: '🎳 Bowl', sub: S.rivalState === 'tied' ? `head pin: ${S.rival.name}` : 'no head pin yet' };
  const sw = tryv(() => window.SSX?.swag?.prompt?.(), null);
  if (sw && d(sw.at) < (sw.near || 4.2)) return { mode: 'swag', label: sw.label, sub: sw.sub };
  if (d(C.SPOTS.benny) < 4.5) return canRide() ? { mode: 'lift', label: '🚡 Lift to the top', sub: hasOwnBoard() && !S.rented ? 'your board · 90 s' : 'timed run · 90 s' } : { mode: 'rent', label: `🏂 Rent board · ${C.RENT} cr`, sub: 'Frostbite Benny' };
  if (canRide() && C.onSnow(p.x, p.z) && p.grounded !== false) return { mode: 'on', label: '🏂 Board on', sub: hasOwnBoard() && !S.rented ? 'your board' : 'free ride' };
  return null;
}
function act(mode) {
  let r = null;
  if (mode === 'off') r = boardOff(); else if (mode === 'grab') r = grab(); else if (mode === 'bowl') r = bowl(); else if (mode === 'lift') r = lift(); else if (mode === 'on') r = boardOn(false);
  else if (mode === 'swag') { tryv(() => window.SSX?.swag?.open?.()); return; }
  else if (mode === 'rent') { choice(`Frostbite Benny: \u201c${C.LINES.bennyRent}\u201d You have ${fmt(credits())} cr.`, [{ id: 'rent', label: `🏂 Rent · ${C.RENT} cr` }, { id: 'no', label: 'Not now' }]).then(id => { if (id === 'rent') { const q = rent(); if (!q.ok) toast(q.msg, 2600); } }); return; }
  if (r && !r.ok) toast(r.msg, 2400);
}
let gearKey = '';
function syncGear() {
  if (!parts) return;
  const look = tryv(() => window.SSX?.swag?.boardLook?.(), null);
  const ball = tryv(() => window.SSX?.swag?.ballLook?.(), null);
  const key = `${look?.deck || 0}|${look?.stripe || 0}|${ball?.color || 0}`;
  if (key === gearKey) return; gearKey = key;
  if (parts.deckMat) parts.deckMat.color.setHex(look?.deck ?? 0x0b0b0b);
  if (parts.stripeMat) parts.stripeMat.color.setHex(look?.stripe ?? 0xf4f6f8);
  if (parts.ball?.material?.color) parts.ball.material.color.setHex(ball?.color ?? 0xa9c9de);
}
function syncUi(tc) {
  if (!actBtn) return; const c = ctx(tc), k = c ? `${c.mode}|${c.label}|${c.sub || ''}` : '';
  if (k !== actKey) { actKey = k; actBtn.classList.toggle('on', !!c); if (c) { actBtn.dataset.mode = c.mode; actBtn.innerHTML = `${c.label}${c.sub ? `<small>${c.sub}</small>` : ''}`; } }
  const onBoard = S.mode === 'board', run = onBoard ? S.run : null, pts = run ? (run.pts || 0) : S.freePts || 0;
  const mult = onBoard && S.combo.left > 0 && S.combo.mult > 1 ? ` x${S.combo.mult}` : '';
  const kph = onBoard && S.board ? ` · ${Math.round((S.board.v || 0) * 3.6)} km/h` : '';
  if (onBoard) { runEl.classList.add('on'); runEl.textContent = run && run.count > 0 ? `🏂 ${Math.ceil(run.count)}…` : run ? `⏱ ${C.fmtTime(run.done ? run.t : Math.min(run.t, C.RUN_SECS))}${kph} · ${fmt(pts)} pts${mult}` : `${Math.round((S.board?.v || 0) * 3.6)} km/h · ${fmt(pts)} pts${mult}`; }
  else runEl.classList.remove('on');
  if (callEl) { const show = onBoard && S.call && S.call.t > 0; callEl.classList.toggle('on', !!show); if (show) callEl.textContent = S.call.text; }
}

// ---------- ☰ menu: where is it / go there ----------
let menuHooked = false;
function hookMenu() {
  if (menuHooked) return; const reg = window.SSX?.registerMenuItem; if (typeof reg !== 'function') return;
  try { reg({ id: 'rmIcecap', label: '❄️ Planum Australe', onTap: menuTap }); menuHooked = true; } catch (e) { /* */ }
}
function menuTap() {
  const ft = window.SSX?.fastTravel, p = place(), bits = [`Mars south polar ice cap, ~${Math.round(Math.hypot(p.x, p.z) / 10) * 10} m south of the pad. Slick's shop is by the landing. Frostbite Benny rents boards (${C.RENT} cr) if you don't own one, and runs an illegal bowling lane on the ice. Left of the race line is Planum X: superpipe, jumps, rails.`];
  if (save.bestRun) bits.push(`Best run ${C.fmtTime(save.bestRun)}.`); if (save.bestPts) bits.push(`Best Planum X ${fmt(save.bestPts)} pts.`); if (save.games) bits.push(`Best game ${save.best}.`);
  const opts = []; if (ft?.travel) opts.push({ id: 'ft', label: `🚀 Fast travel · ${ft.fee ?? 25} cr` }); opts.push({ id: 'wp', label: '📍 Set waypoint' }, { id: 'no', label: 'Close' });
  choice(`❄️ ${bits.join(' ')}`, opts).then(id => { if (id === 'ft') tryv(() => ft.travel('icecap')); else if (id === 'wp') { const ok = tryv(() => window.SSX?.hudx?.setWaypoint?.({ x: p.x, z: p.z, label: 'Planum Australe' })); toast(ok === null ? '📍 Head south from the colony.' : '📍 Waypoint set: Planum Australe.', 2400); } });
}

// ---------- API ----------
function state() { return { mode: S.mode, rented: S.rented, rival: S.rival ? { ...S.rival } : null, rivalState: S.rivalState, run: S.run ? { ...S.run } : null, combo: { mult: S.combo.mult, left: S.combo.left }, freePts: S.freePts || 0, board: S.board ? { x: S.board.x, z: S.board.z, y: S.board.y, v: S.board.v, air: S.board.air, head: S.board.head, spin: S.board.spin, wip: S.board.wip, grind: S.board.grind || null } : null,
  bowl: S.bowl ? { rolls: S.bowl.rolls.slice(), heads: S.bowl.heads, paid: S.bowl.paid, t: { ...S.bowl.t }, rolling: !!S.bowl.anim, over: S.bowl.over || null, rival: S.bowl.rival, last: S.bowl.last || null, standing: S.bowl.standing.slice() } : null,
  ctx: ctx(S.lastTc), save: JSON.parse(JSON.stringify(save)) }; }
const api = { place, state, rent, lift, boardOn: () => boardOn(false), boardOff: () => boardOff(), grab, bowl, roll, quit, bringRival, zone: { cx: C.CX, top: C.Z_TOP, bottom: C.Z_BOT, foul: C.FOUL }, inZone: (x, z) => C.onSnow(x, z),
  subscribe(fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); } };
function attach() { const w = window; if (!w.SSX) return; if (w.SSX.icecap !== api) w.SSX.icecap = api; if (globalThis.SSX_GROUND !== GROUND) globalThis.SSX_GROUND = GROUND; }
window.__icecap = { core: C, log: () => log.slice(), S, act, ctx: () => ctx(S.lastTc), parts: () => parts,
  go(where = 'arrive') { const s = surf(), q = C.SPOTS[where] || C.SPOTS.arrive; return !!tryv(() => s.debugMove(q.x, q.z, Math.PI)); },
  rivalHere() { const h = parts?.rival; if (!h || !S.lastTc) return false; const p = h.group.position; return !!tryv(() => surf().debugMove(p.x + 1.5, p.z, Math.PI / 2)); },
  view(v) { S.view = v ? { p: v.p, l: v.l } : null; return !!S.view; },
  finishKoNow() { if (S.rivalState === 'ko') finishKo(); return S.rivalState; }, resetRivals() { save.rivals = {}; persist(); S.rival = null; S.rivalState = 'none'; } };
function boot() { const X = window.SSX, a = app(); if (!X?.registerSurfaceTick || !a?.surface) return false; attach(); X.registerSurfaceTick(tick); ui(); hookMenu(); return true; }
if (window.SSX && !window.SSX.icecap) window.SSX.icecap = api;
if (!boot()) { const iv = setInterval(() => { if (boot()) clearInterval(iv); }, 250); }
