// Grime pass (Snuffles): makes the Mars city read lived-in, broke and dangerous. Runtime-only, fully procedural, swappable.
//   * baked decals from the built city: rust streaks, water stains, soot, cracks, graffiti, tags, stencils, torn posters,
//     oil, puddles with a wet sheen, dried blood, broken glass, litter, a dirt blanket on each district disc
//   * broken neon (made-up brands, half-dead letters that buzz), sagging power lines, trash, burn barrels with fire/smoke,
//     steam vents, a burnt-out hauler, corrugated shanties in Red Tape Flats, a graffiti'd Beltway underpass
//   * a film look (grade, grain, vignette, slight fringing) behind a toggle; phones get a 1-pass "lite" overlay
//   * crude barks + PIRATE 66.9 through Pumpkin's audio API (SSX.bark / registerBarks / registerStation), always guarded
//   * street hassle (mars/grime-street.js): panhandlers, hustlers, a yeller, a shover, a pickpocket, a mugger with a shiv
// Everything hangs off ONE config object (GRIME_CONFIG) and the SSX.grime API, so the v8 realistic renderer can swap it.
// Per-district work streams in/out by distance; one static draw per material per district (decals and props are baked).
import * as THREE from 'three';
import * as T from './grime-tex.js';
import { BARK_PACKS, STREET_BARKS, PIRATE_STATION } from './grime-lines.js';
import { districtsOf } from '../world.js';
import { createStreet } from './grime-street.js';

const PHONE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || innerWidth < 800;
const LEVELS = { off: 0, light: 0.5, med: 1, max: 1.35 };
const LS = 'ssx.grime.v1';

// ---------------------------------------------------------------- the one config object ----------------------------------
export const GRIME_CONFIG = {
  enabled: true,
  level: PHONE ? 'med' : 'max',                     // off | light | med | max (or any number 0..1.5 via setLevel)
  post: PHONE ? 'lite' : 'full',        // full (render target + grade shader) | lite (one multiply overlay) | off
  street: true,
  atlas: PHONE ? 512 : 1024,
  msaa: PHONE ? 0 : 4,                  // samples on the film-look render target (desktop full mode)
  rtHalf: true,                         // HalfFloat film-look target (false = 8-bit)
  streamIn: 190, streamOut: 280,        // metres from a district centre
  fxScale: PHONE ? 0.5 : 1,             // particle counts
  districts: {
    'mars-rough': { grime: 1, graffiti: 1, trash: 1, camps: 1, neon: 1, wires: 1, shanties: true, car: true, barrels: 5, vents: 2, street: 1,
      fog: { color: 0x7a5a44, near: 16, far: 105 },
      grade: { sat: 0.58, con: 1.16, lift: [0.035, 0.05, 0.05], hi: [1.0, 0.86, 0.7], vig: 0.58, grain: 0.085, crush: 0.025 } },
    'mars-downtown': { grime: 0.6, graffiti: 0.55, trash: 0.5, camps: 0.3, neon: 0.9, wires: 0.6, barrels: 1, vents: 4, street: 0.4,
      fog: { color: 0x9a7a62, near: 26, far: 125 },
      grade: { sat: 0.7, con: 1.12, lift: [0.02, 0.035, 0.06], hi: [1.0, 0.92, 0.82], vig: 0.46, grain: 0.06, crush: 0.015 } },
    'mars-gated': { grime: 0.2, graffiti: 0.06, trash: 0.08, camps: 0, neon: 0.35, wires: 0, edgesOnly: true, barrels: 0, vents: 0, street: 0.06,
      fog: null, grade: { sat: 0.9, con: 1.06, lift: [0.01, 0.012, 0.015], hi: [1.02, 0.97, 0.9], vig: 0.32, grain: 0.035, crush: 0 } },
    aj: { grime: 0.45, graffiti: 0.3, trash: 0.35, camps: 0.15, neon: 0.5, wires: 0.4, barrels: 1, vents: 1, street: 0.15,
      fog: { color: 0xb08868, near: 34, far: 135 }, grade: { sat: 0.8, con: 1.08, lift: [0.02, 0.025, 0.03], hi: [1.0, 0.94, 0.86], vig: 0.4, grain: 0.05, crush: 0.01 } },
    'mars-highway': { grime: 0.8, graffiti: 0.9, trash: 0.8, camps: 0.9, neon: 0, wires: 0, barrels: 2, vents: 0, street: 0.7, underpasses: 2,
      fog: { color: 0x8c6a50, near: 22, far: 120 }, grade: { sat: 0.66, con: 1.12, lift: [0.03, 0.04, 0.045], hi: [1.0, 0.88, 0.74], vig: 0.5, grain: 0.07, crush: 0.02 } }
  },
  baseGrade: { sat: 0.84, con: 1.07, lift: [0.02, 0.022, 0.025], hi: [1.0, 0.94, 0.86], vig: 0.36, grain: 0.045, crush: 0.01 },
  // corrugated shacks added to Red Tape Flats as real (collidable) blocks: [x, z, w, d, h] hub-local
  shanties: [[-10, 44, 7, 4, 3.2], [50, 18, 4, 9, 3.6], [-20, -40, 10, 4, 3.4], [-30, 38, 8, 4, 3], [12, -42, 6, 5, 4]],
  // broken neon, made-up brands; dead = letters that never light, flicker = letters that buzz
  neon: {
    'mars-rough': [['LIQUOR', 0xff3050, [1], [4]], ['PAWN & GUNS', 0x40e0ff, [], [0, 1]], ['MOTEL', 0xff60c0, [3], [0]], ['BAIL BONDS 24H', 0xffd040, [5, 6], [11]],
      ['O2 REFILLS', 0x60ff90, [1], [7, 8]], ['CHECKS CASHED', 0xff8030, [2, 8], []]],
    'mars-downtown': [['HOTEL ARES', 0xff4060, [1, 7], [9]], ['KARAOKE', 0x40d0ff, [], [2, 3]], ['ORGANS BOUGHT', 0x70ff70, [4], [0]], ['PHARMACY', 0x50ff80, [5], [7]],
      ['ROOMS BY HOUR', 0xffb040, [], [9, 10, 11]]],
    'mars-gated': [['VACANCY', 0xffe0a0, [0, 1], []]],
    aj: [['NOODLES', 0xff5040, [3], [6]], ['CHEAP AIR', 0x40e0ff, [], [0]]]
  }
};

// ---------------------------------------------------------------- small helpers ------------------------------------------
const V = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), M4 = new THREE.Matrix4();
const cellUV = (cell, flip = false) => { const u0 = (cell % 4) / 4, v0 = 1 - ((cell / 4 | 0) + 1) / 4; return flip ? [u0 + 0.25, v0, -0.25, 0.25] : [u0, v0, 0.25, 0.25]; };
const pick = (r, a) => a[(r() * a.length) | 0];
const lerp = (a, b, t) => a + (b - a) * t;
const nonIdx = new WeakMap();
// bake many transformed copies of small geometries into one mesh per material (one draw call); uvr remaps uvs into an atlas cell
class Baker {
  constructor() { this.m = new Map(); }
  add(geo, mat, mtx, col = null, uvr = null) { let L = this.m.get(mat); if (!L) this.m.set(mat, L = []); L.push({ geo, mtx: mtx.clone(), col, uvr }); }
  put(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, col = null, uvr = null, order = 'XYZ') {
    E.set(rx, ry, rz, order); Q.setFromEuler(E); M4.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); this.add(geo, mat, M4, col, uvr);
  }
  build(parent) {
    const out = [], nm = new THREE.Matrix3(), p = new THREE.Vector3(), q = new THREE.Vector3();
    for (const [mat, L] of this.m) {
      let n = 0; const srcs = L.map(e => { let g = nonIdx.get(e.geo); if (!g) { g = e.geo.index ? e.geo.toNonIndexed() : e.geo; nonIdx.set(e.geo, g); } n += g.attributes.position.count; return g; });
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3); let o = 0;
      L.forEach((e, k) => { const g = srcs[k], gp = g.attributes.position, gn = g.attributes.normal, gu = g.attributes.uv, c = e.col || [1, 1, 1], r = e.uvr; nm.getNormalMatrix(e.mtx);
        for (let i = 0; i < gp.count; i++, o++) {
          p.fromBufferAttribute(gp, i).applyMatrix4(e.mtx); P[o * 3] = p.x; P[o * 3 + 1] = p.y; P[o * 3 + 2] = p.z;
          if (gn) { q.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize(); N[o * 3] = q.x; N[o * 3 + 1] = q.y; N[o * 3 + 2] = q.z; }
          const u = gu ? gu.getX(i) : 0, v = gu ? gu.getY(i) : 0; U[o * 2] = r ? r[0] + u * r[2] : u; U[o * 2 + 1] = r ? r[1] + v * r[3] : v;
          C[o * 3] = c[0]; C[o * 3 + 1] = c[1]; C[o * 3 + 2] = c[2];
        } });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.computeBoundingSphere();
      const me = new THREE.Mesh(geo, mat); me.renderOrder = mat.userData.order || 0; me.matrixAutoUpdate = false; me.userData.grime = true; parent.add(me); out.push(me);
    }
    this.m.clear(); return out;
  }
}

// ---------------------------------------------------------------- module state -------------------------------------------
let app = null, cfg = GRIME_CONFIG, R = null, street = null, built = new Map(), scene = null, lastScan = 0, panel = null, post = null, fireLight = null;
const overrides = {};      // per-district overrides from SSX.grime.district(id, {...})
const stats = { districts: 0, draws: 0, decals: 0, props: 0, particles: 0, buildMs: 0 };
const mult = () => (cfg.enabled ? (typeof cfg.level === 'number' ? cfg.level : LEVELS[cfg.level] ?? 1) : 0);
const dcfg = id => ({ ...(cfg.districts[id] || cfg.districts.aj), ...(overrides[id] || {}) });
const surf = () => app?.surface;
const onMars = () => !!(app?.state?.onSurface && surf()?.info?.name === 'Mars');

// shared materials / textures, created once (flagged shared so surface.exit() leaves them alone)
function res() {
  if (R) return R; const t0 = performance.now();
  const sh = m => { m.userData.shared = true; return m; }, A = cfg.atlas;
  const wall = T.wallAtlas(A, 7), graf = T.graffitiAtlas(A, 11), ground = T.groundAtlas(A, 23);
  for (const t of [wall, graf, ground]) t.userData.shared = true;
  let env = null; try { env = T.envTex(app.renderer); env.userData.shared = true; } catch (e) { /* no PMREM: puddles just stay dark */ }
  const decal = (map, order, o = {}) => { const m = sh(new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, vertexColors: true, roughness: 0.92, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 - order, ...o })); m.userData.order = -10 + order; return m; };
  const solid = (o) => sh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...o }));
  const fab = (seed, col) => { const t = T.fabricTex(128, seed, col); t.userData.shared = true; t.repeat.set(2, 2); return t; };
  const corr = T.corrugatedTex(256, 31); corr.userData.shared = true; corr.repeat.set(3, 1);
  const rust = T.rustMetalTex(128, 51); rust.userData.shared = true; const soot = T.sootTex(128, 61); soot.userData.shared = true;
  const conc = T.concreteTex(256, 91); conc.userData.shared = true; const cart = T.cartTex(128); cart.userData.shared = true;
  const blanket = T.dirtBlanketTex(PHONE ? 256 : 512, 81); blanket.userData.shared = true; const glow = T.glowTex(128); glow.userData.shared = true;
  const puff = T.puffTex(64); puff.userData.shared = true;
  R = {
    env, glow, puff,
    wall: decal(wall, 2), graf: decal(graf, 3, { roughness: 0.7 }), ground: decal(ground, 1),
    wet: decal(ground, 1, { roughness: 0.06, metalness: 0.35, envMap: env, envMapIntensity: 1.3 }),
    blanket: (() => { const m = decal(blanket, 0); m.vertexColors = false; m.userData.order = -11; return m; })(),
    corr: sh(new THREE.MeshStandardMaterial({ map: corr, roughness: 0.75, metalness: 0.35 })),
    tarp: solid({ map: fab(41, [120, 118, 110]), side: THREE.DoubleSide, roughness: 0.85 }),
    cloth: solid({ map: fab(43, [105, 98, 88]) }),
    plastic: solid({ roughness: 0.28, metalness: 0.05, envMap: env, envMapIntensity: 0.6 }),
    card: solid({ map: fab(47, [150, 118, 80]), roughness: 0.95 }),
    rubber: solid({ roughness: 0.8, color: 0x1a1816 }),
    metal: solid({ map: rust, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }),
    char: solid({ map: soot, roughness: 0.95, metalness: 0.2 }),
    conc: solid({ map: conc, roughness: 0.95 }),
    cart: solid({ map: cart, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }),
    coal: sh(new THREE.MeshBasicMaterial({ color: 0xff6a20, toneMapped: false })),
    wire: sh(new THREE.LineBasicMaterial({ color: 0x141210 })),
    geo: { plane: new THREE.PlaneGeometry(1, 1), box: new THREE.BoxGeometry(1, 1, 1), bag: bagGeo(), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), barrel: new THREE.CylinderGeometry(0.3, 0.28, 0.9, 14, 1, true),
      tire: new THREE.TorusGeometry(0.33, 0.13, 6, 14), tent: new THREE.ConeGeometry(1, 1, 4, 1, true), sph: new THREE.SphereGeometry(0.5, 10, 8), cap: new THREE.CapsuleGeometry(0.22, 0.6, 3, 8),
      disc: new THREE.CircleGeometry(0.5, 16) }
  };
  for (const g of Object.values(R.geo)) g.userData.shared = true;
  stats.resMs = Math.round(performance.now() - t0); return R;
}
function bagGeo() { // lumpy garbage bag
  const g = new THREE.IcosahedronGeometry(0.42, 1), p = g.attributes.position, r = T.rng(5);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 0.85 + r() * 0.3; p.setXYZ(i, p.getX(i) * k, y < 0 ? y * 0.55 : y * (0.9 + r() * 0.3) + (y > 0.3 ? 0.08 : 0), p.getZ(i) * k); }
  g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------- reading the built city ---------------------------------
function siteGroups() { const out = []; for (const o of scene.children) if (o.isGroup && o.userData.v8?.site && !o.userData.grime) out.push(o); return out; }
function readSite(g) {
  const blocks = [], domes = [];
  for (const o of g.children) { const k = o.userData.v8?.part;
    if (k === 'block') blocks.push({ m: o, X: o.position.x, Z: o.position.z, w: o.scale.x, h: o.scale.y, d: o.scale.z, y0: o.position.y - o.scale.y / 2, door: true });
    else if (k === 'dome') domes.push({ X: o.position.x, Z: o.position.z, r: o.scale.x, y0: o.position.y }); }
  // the airlock boxes in front of each dome get grime like a block
  for (const d of domes) blocks.push({ X: d.X, Z: d.Z + d.r + 0.6, w: 3, h: 2.8, d: 2.2, y0: d.y0, door: true, lock: true });
  return { blocks, domes };
}
function faces(b) { // 4 vertical faces: centre, outward normal, tangent, length
  return [[0, 1, b.w], [0, -1, b.w], [1, 0, b.d], [-1, 0, b.d]].map(([nx, nz, L], k) => ({ k, nx, nz, L, h: b.h, y0: b.y0, front: k === 0,
    cx: b.X + nx * b.w / 2, cz: b.Z + nz * b.d / 2, tx: Math.cos(Math.atan2(nx, nz)), tz: -Math.sin(Math.atan2(nx, nz)), yaw: Math.atan2(nx, nz) }));
}
function freeOf(blocks, domes, x, z, pad = 0.4) {
  for (const b of blocks) if (Math.abs(x - b.X) < b.w / 2 + pad && Math.abs(z - b.Z) < b.d / 2 + pad) return false;
  for (const d of domes) if (Math.hypot(x - d.X, z - d.Z) < d.r + 0.8 + pad) return false;
  return true;
}
const ray = new THREE.Raycaster();
function groundY(x, z, fallback) { // only used off the flat district discs (the Beltway shoulders)
  ray.set(V.set(x, 400, z), new THREE.Vector3(0, -1, 0)); ray.far = 800; ray.camera = surf().camera;
  const cand = scene.children.filter(o => (o.isMesh && !o.userData.grime && !o.userData.v8) || (o.isGroup && o.userData.v8?.site === 'highway'));
  const hits = ray.intersectObjects(cand, true).filter(h => h.object.isMesh && !h.object.isSprite && !h.object.userData.grime && h.face && h.face.normal.y > 0.3 && h.object.userData.v8?.part !== 'ramp');
  return hits.length ? hits[0].point.y : fallback;
}

// ---------------------------------------------------------------- per-district build -------------------------------------
function buildDistrict(id, siteGroup, info) {
  const t0 = performance.now(), D = dcfg(id), k = mult(), g = D.grime * k, gr = D.graffiti * k, tr = D.trash * k;
  const r = T.rng(1 + [...id].reduce((a, c) => a + c.charCodeAt(0), 0)), bk = new Baker(), root = new THREE.Group(); root.userData.grime = true; root.name = 'grime:' + id;
  const rec = { id, root, siteGroup, signs: [], fx: null, barrels: [], vents: [], cols: [], stat: { decals: 0, props: 0 }, tm: {} }; colsDirty = true; let tl = t0; const mark = k => { const n = performance.now(); rec.tm[k] = Math.round(n - tl); tl = n; };
  if (k <= 0) { scene.add(root); return rec; }
  const { blocks, domes } = id === 'mars-highway' ? { blocks: [], domes: [] } : readSite(siteGroup);
  const y0 = blocks[0]?.y0 ?? domes[0]?.y0 ?? surf().info?.y ?? 0, cx = info.x, cz = info.z, rr = Math.min(info.r || 58, 60);
  const wallDecal = (f, cell, mat, u, v, sx, sy, col, layer, flip) => { // u along the face, v = height of the decal centre
    if (Math.abs(u) + sx / 2 > f.L / 2) sx = Math.max(0.3, (f.L / 2 - Math.abs(u)) * 2); if (sx < 0.3) return;
    if (v + sy / 2 > f.h) { sy = (f.h - v) * 2; if (sy < 0.2) return; }
    const off = 0.025 + layer * 0.012;
    bk.put(R.geo.plane, mat, f.cx + f.tx * u + f.nx * off, f.y0 + v, f.cz + f.tz * u + f.nz * off, 0, f.yaw, 0, sx, sy, 1, col, cellUV(cell, flip)); rec.stat.decals++; };
  const groundDecal = (cell, mat, x, z, s, col, lift = 0) => { bk.put(R.geo.plane, mat, x, y0 + 0.045 + lift + (rec.stat.decals % 50) * 0.0004, z, -Math.PI / 2, 0, r() * 6.283, s, s, 1, col, cellUV(cell, r() < 0.5)); rec.stat.decals++; };
  const shade = (a, b) => { const v = lerp(a, b, r()); return [v, v * (0.96 + r() * 0.04), v * (0.9 + r() * 0.08)]; };
  const W = T.WALL_CELLS, G = T.GRAF_CELLS, GC = T.GROUND_CELLS;

  // dirt blanket over the whole disc
  if (id !== 'mars-highway') { bk.put(R.geo.disc, R.blanket, cx, y0 + 0.03, cz, -Math.PI / 2, 0, r() * 6.28, rr * 2.1, rr * 2.1, 1); }

  // ---- walls: soot at the base, rust and water running from the roof line, blotches, cracks, then paint on top
  for (const b of blocks) for (const f of faces(b)) {
    const L = f.L, doorZone = u => f.front && b.door && Math.abs(u) < 1.4;
    if (D.edgesOnly) { // Helios Heights: only the edges decay (roof line, corners, the foot of the wall)
      if (r() < g * 2.5) wallDecal(f, pick(r, W.water), R.wall, (r() < 0.5 ? -1 : 1) * (L / 2 - 0.6), f.h - 0.9, 1.1, 1.8, shade(0.8, 1), 0);
      if (r() < g * 2) wallDecal(f, pick(r, W.leak), R.wall, (r() - 0.5) * L * 0.8, f.h - 0.5, 1.4, 1, shade(0.8, 1), 1);
      wallDecal(f, pick(r, W.soot), R.wall, 0, 0.35, L, 0.7, shade(0.6, 0.8), 0); continue;
    }
    for (let u = -L / 2 + 2; u < L / 2; u += 3.6) if (r() < 0.35 + g * 0.6) wallDecal(f, pick(r, W.soot), R.wall, u + (r() - 0.5), 0.2 + g * 0.6, 3.6 + r() * 1.4, 0.8 + g * 1.6 + r() * 0.6, shade(0.85, 1), 0, r() < 0.5);
    for (let i = 0, n = Math.round(L / 3.2 * g * (0.6 + r() * 0.8)); i < n; i++) { const sy = f.h * (0.45 + r() * 0.5), u = (r() - 0.5) * (L - 1); wallDecal(f, pick(r, W.rust), R.wall, u, f.h - sy / 2 - 0.05, 0.9 + r() * 1.6, sy, shade(0.85, 1.05), 1, r() < 0.5); }
    for (let i = 0, n = Math.round(L / 6 * g * (0.5 + r())); i < n; i++) { const sy = f.h * (0.4 + r() * 0.5); wallDecal(f, pick(r, W.water), R.wall, (r() - 0.5) * (L - 1), f.h - sy / 2 - 0.05, 1.4 + r() * 2, sy, shade(0.8, 1), 1); }
    for (let i = 0, n = Math.round(L / 5 * g * r() * 1.6); i < n; i++) wallDecal(f, pick(r, W.blotch), R.wall, (r() - 0.5) * (L - 1.5), 0.8 + r() * (f.h - 1.4), 1.4 + r() * 2.2, 1.2 + r() * 1.6, shade(0.75, 1), 0, r() < 0.5);
    for (let i = 0, n = Math.round(L / 8 * g * (0.5 + r())); i < n; i++) wallDecal(f, pick(r, W.crack), R.wall, (r() - 0.5) * (L - 1.5), 0.6 + r() * (f.h - 1), 1 + r() * 1.6, 1 + r() * 1.6, shade(0.8, 1), 2, r() < 0.5);
    if (g > 0.7 && r() < 0.35) wallDecal(f, W.burn[0], R.wall, (r() - 0.5) * (L - 3), 1.6, 2.6 + r(), 3.2, shade(0.9, 1), 1);
    if (r() < g * 0.6) wallDecal(f, pick(r, W.drip), R.wall, (r() - 0.5) * (L - 1), f.h - 0.8, 0.9, 1.6, shade(0.85, 1), 2);
    if (gr <= 0.02) continue;
    // paint: tags at reach height, a throw-up or two on the big walls, stencils, then posters pasted over the lot
    for (let i = 0, n = Math.round(L / 3.4 * gr * (0.6 + r() * 0.8)); i < n; i++) { const u = (r() - 0.5) * (L - 1.4); if (doorZone(u)) continue; const s = 1.1 + r() * 1.5;
      wallDecal(f, pick(r, G.tag), R.graf, u, 0.6 + s * 0.25 + r() * 1.5, s, s * 0.5, shade(0.7, 1), 3, false); }
    if (L > 6 && r() < gr * 0.8) { const u = (r() - 0.5) * (L - 5); if (!doorZone(u)) wallDecal(f, pick(r, G.throwup), R.graf, u, 1.35 + r() * 0.3, 3.4 + r() * 1.2, 1.9 + r() * 0.4, shade(0.8, 1), 3); }
    if (r() < gr * 0.55) { const u = (r() - 0.5) * (L - 1.5); if (!doorZone(u)) wallDecal(f, pick(r, G.stencil), R.graf, u, 1.5 + r() * 0.6, 1.1, 1.1, shade(0.75, 1), 4); }
    const nP = Math.round((id === 'mars-downtown' ? 1.6 : 0.9) * gr * (L / 8) * r() * 1.8);
    if (nP) { let u = (r() - 0.5) * (L - nP * 0.9 - 1); for (let i = 0; i < nP; i++, u += 0.78 + r() * 0.2) if (!doorZone(u)) wallDecal(f, pick(r, G.poster), R.graf, u, 1.55 + (r() - 0.5) * 0.25, 0.8, 1.05, shade(0.65, 0.95), 5 + i % 2); }
  }

  mark('walls');
  // ---- ground: oil, puddles, blood, cracks, litter, glass, skid marks, drains; denser along walls (that's where crap collects)
  const spots = [];
  for (const b of blocks) for (const f of faces(b)) for (let u = -f.L / 2 + 1; u < f.L / 2; u += 2.6) { if (r() > 0.25 + tr * 0.5) continue; const off = 0.6 + r() * 1.8, x = f.cx + f.tx * u + f.nx * off, z = f.cz + f.tz * u + f.nz * off; if (f.front && b.door && Math.abs(u) < 1.6) continue; if (freeOf(blocks, domes, x, z, 0.2)) spots.push({ x, z, f }); }
  const nOpen = Math.round(80 * g * (PHONE ? 0.7 : 1));
  for (let i = 0; i < nOpen; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * rr * 0.92, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!freeOf(blocks, domes, x, z)) continue;
    const t = r(), cell = t < 0.16 ? pick(r, GC.oil) : t < 0.36 ? pick(r, GC.puddle) : t < 0.55 ? pick(r, [GC.stain[0], GC.stain[1]]) : t < 0.7 ? pick(r, GC.crack) : t < 0.8 ? pick(r, GC.litter) : t < 0.86 ? pick(r, GC.glass) : t < 0.95 ? GC.skid[0] : (g > 0.7 && r() < 0.5 ? GC.stain[2] : GC.drain[0]);
    const wet = GC.oil.includes(cell) || GC.puddle.includes(cell);
    groundDecal(cell, wet ? R.wet : R.ground, x, z, cell === GC.skid[0] ? 3 + r() * 3 : wet ? 1.4 + r() * 2.6 : 1 + r() * 1.8, wet ? [1, 1, 1] : shade(0.75, 1), wet ? 0.004 : 0); }
  for (const s of spots) { const t = r(), cell = t < 0.4 ? pick(r, GC.litter) : t < 0.55 ? pick(r, GC.glass) : t < 0.75 ? pick(r, GC.puddle) : t < 0.9 ? pick(r, GC.stain) : pick(r, GC.oil);
    groundDecal(cell, GC.puddle.includes(cell) || GC.oil.includes(cell) ? R.wet : R.ground, s.x, s.z, 1 + r() * 1.4, shade(0.8, 1)); }

  mark('ground');
  // ---- trash clusters along the walls: bags, boxes, cans, tyres; a stained mattress or sofa here and there
  const bagCols = [[0.06, 0.06, 0.06], [0.08, 0.1, 0.07], [0.12, 0.13, 0.15], [0.16, 0.14, 0.1]];
  const trash = (x, z, yaw, n = 1) => {
    const nbag = 1 + (r() * 3 * n | 0); if (nbag >= 2) solid(rec, { type: 'cyl', x, z, r: 0.8 }); // a real junk pile blocks; a lone bag doesn't
    for (let i = 0, nb = nbag; i < nb; i++) { const s = 0.75 + r() * 0.55; bk.put(R.geo.bag, R.plastic, x + (r() - 0.5) * 1.4, y0 + 0.2 * s, z + (r() - 0.5) * 1.4, (r() - 0.5) * 0.4, r() * 6.28, (r() - 0.5) * 0.4, s, s, s, pick(r, bagCols)); rec.stat.props++; }
    for (let i = 0, nb = r() * 2.4 * n | 0; i < nb; i++) { const s = 0.4 + r() * 0.5, sq = r() < 0.4 ? 0.35 : 1; bk.put(R.geo.box, R.card, x + (r() - 0.5) * 1.6, y0 + s * sq / 2, z + (r() - 0.5) * 1.6, 0, yaw + r() * 1.2, 0, s * 1.3, s * sq, s, shade(0.6, 1)); rec.stat.props++; }
    for (let i = 0, nb = r() * 5 * n | 0; i < nb; i++) bk.put(R.geo.cyl, R.metal, x + (r() - 0.5) * 2.4, y0 + 0.04, z + (r() - 0.5) * 2.4, Math.PI / 2, r() * 6.28, 0, 0.07, 0.12, 0.07, pick(r, [[0.9, 0.2, 0.2], [0.5, 0.6, 0.7], [0.8, 0.7, 0.3], [0.4, 0.4, 0.4]]), null, 'YXZ');
    if (r() < 0.25 * n) bk.put(R.geo.tire, R.rubber, x + (r() - 0.5) * 1.5, y0 + 0.13, z + (r() - 0.5) * 1.5, Math.PI / 2 + (r() - 0.5) * 0.3, 0, r() * 3, 1);
  };
  for (const s of spots) if (r() < 0.45 * tr + 0.05) trash(s.x, s.z, s.f.yaw, 0.6 + tr * 0.6);
  if (tr > 0.6) for (let i = 0; i < 2; i++) { const s = spots[(r() * spots.length) | 0]; if (!s) break; // mattress against a wall, a sofa left to rot
    if (i === 0) bk.put(R.geo.box, R.cloth, s.x, y0 + 0.11, s.z, 0, s.f.yaw + 0.2, 0.05, 1.9, 0.2, 0.95, [0.75, 0.66, 0.52]); // flat: walk over it
    else { const c = [0.35, 0.18, 0.14]; solid(rec, { type: 'box', x: s.x, z: s.z, hx: 1, hz: 0.45, yaw: s.f.yaw }); bk.put(R.geo.box, R.cloth, s.x, y0 + 0.25, s.z, 0, s.f.yaw, 0, 2, 0.4, 0.85, c); bk.put(R.geo.box, R.cloth, s.x - s.f.nx * 0.35, y0 + 0.65, s.z - s.f.nz * 0.35, -0.2, s.f.yaw, 0, 2, 0.5, 0.2, c); } rec.stat.props += 2; }

  // ---- shanties: swap the plain hull for rusted corrugated sheet, hang tarps off them
  if (D.shanties) for (const b of blocks) { if (!b.m || !cfg.shanties.some(s => Math.abs(cx + s[0] - b.X) < 0.05 && Math.abs(cz + s[1] - b.Z) < 0.05)) continue;
    b.m.userData.grimeOrig ??= b.m.material; b.m.material = R.corr; rec.shanty = rec.shanty || []; rec.shanty.push(b.m); solid(rec, { type: 'box', x: b.X, z: b.Z, hx: b.w / 2, hz: b.d / 2 });
    const f = faces(b)[r() < 0.5 ? 2 : 3]; bk.put(R.geo.plane, R.tarp, f.cx + f.nx * 1.1, y0 + b.h * 0.45, f.cz + f.nz * 1.1, -0.6, f.yaw, 0, b.d * 0.8, 2.6, 1, pick(r, [[0.3, 0.45, 0.7], [0.5, 0.48, 0.3], [0.6, 0.3, 0.18]]), null, 'YXZ'); }

  // ---- burn barrels + steam vents (particles), a burnt-out hauler
  const barrelAt = (x, z) => { bk.put(R.geo.barrel, R.metal, x, y0 + 0.45, z, 0, r() * 6, 0, 1, 1, 1, shade(0.6, 0.9)); bk.put(R.geo.disc, R.coal, x, y0 + 0.78, z, -Math.PI / 2, 0, 0, 0.5); rec.barrels.push({ x, y: y0 + 0.85, z }); solid(rec, { type: 'cyl', x, z, r: 0.35 }); };
  const nb = Math.round((D.barrels || 0) * Math.min(1, k));
  for (let i = 0; i < nb; i++) { const s = spots[(r() * spots.length) | 0]; if (s) barrelAt(s.x + s.f.nx * 0.8, s.z + s.f.nz * 0.8); }
  for (let i = 0; i < (D.vents || 0); i++) { const a = r() * 6.28, d = 8 + r() * rr * 0.6, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!freeOf(blocks, domes, x, z, 1)) continue; groundDecal(GC.drain[0], R.ground, x, z, 1.3, [0.9, 0.9, 0.9], 0.002); rec.vents.push({ x, y: y0 + 0.05, z }); }
  if (D.car) carHulk(bk, r, blocks, domes, cx, cz, y0, rec);

  mark('props');
  // ---- encampments (tents, tarps, carts, sleepers, people round the fire) live in the street module
  if (street && D.camps > 0) street.camps({ id, solid: c => solid(rec, c), bk, R, r, rng: r, blocks, domes, faces, freeOf, spots, y0, cx, cz, rr, level: D.camps * k, barrelAt, trash, rec });

  mark('camps');
  // ---- overhead power lines sagging between roofs
  if (D.wires > 0 && blocks.length > 1) wires(root, blocks, D.wires * k, r);

  // ---- broken neon
  const list = (cfg.neon[id] || []).slice(0, Math.max(0, Math.round((cfg.neon[id] || []).length * Math.min(1, D.neon * k + 0.2))));
  const cands = blocks.filter(b => !b.lock && b.h >= 3).flatMap(b => faces(b).filter(f => !f.front && f.L >= 4)).sort(() => r() - 0.5);
  list.forEach((n, i) => { const f = cands[i]; if (f) neon(root, rec, f, n, r); });

  mark('neon');
  if (id === 'mars-highway') beltway(bk, r, rec, D, k, trash, barrelAt);
  mark('beltway'); const meshes = bk.build(root); scene.add(root); mark('bake');
  rec.fx = makeFx(root, rec, r); rec.meshes = meshes; mark('fx');
  rec.ms = performance.now() - t0; return rec;
}

function carHulk(bk, r, blocks, domes, cx, cz, y0, rec) { // a torched hauler on its belly, glass gone, black with soot
  for (let tries = 0; tries < 30; tries++) { const a = r() * 6.28, d = 30 + r() * 18, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!freeOf(blocks, domes, x, z, 3.5)) continue;
    const yaw = r() * 6.28, put = (lx, ly, lz, sx, sy, sz, rx = 0, mat = R.char, col = [0.5, 0.45, 0.42]) => { const c = Math.cos(yaw), s = Math.sin(yaw); bk.put(R.geo.box, mat, x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c, rx, yaw, 0.05, sx, sy, sz, col, null, 'YXZ'); };
    put(0, 0.95, -1.6, 2.4, 1.5, 1.8); put(0, 0.75, 1.1, 2.6, 1.1, 3.8); put(0, 1.55, -1.6, 2.2, 0.1, 1.6, 0.15, R.char, [0.25, 0.22, 0.2]); put(0.2, 1.4, 1.6, 1.8, 0.08, 2.2, -0.1, R.metal, [0.7, 0.55, 0.45]);
    for (const [sx, sz] of [[-1.25, -1.7], [1.25, -1.7], [-1.25, 1.9], [1.25, 1.9]]) if (r() < 0.6) { const c = Math.cos(yaw), s = Math.sin(yaw); bk.put(R.geo.tire, R.rubber, x + sx * c + sz * s, y0 + 0.25, z - sx * s + sz * c, 0, yaw + Math.PI / 2, 0, 1.2, 1.2, 1.2, [0.5, 0.5, 0.5]); }
    bk.put(R.geo.plane, R.ground, x, y0 + 0.025, z, -Math.PI / 2, 0, yaw, 6.5, 6.5, 1, [0.9, 0.9, 0.9], cellUV(T.GROUND_CELLS.stain[0]));
    rec.barrels.push({ x, y: y0 + 1.7, z, smoulder: true }); solid(rec, { type: 'box', x, z, hx: 1.35, hz: 3, yaw }); rec.stat.props += 6; return; }
}

function wires(root, blocks, amt, r) { // catenary power lines between nearby roof corners
  const pts = [], corners = blocks.filter(b => !b.lock).map(b => ({ x: b.X + (r() - 0.5) * b.w * 0.8, z: b.Z + (r() - 0.5) * b.d * 0.8, y: b.y0 + b.h + 0.3 }));
  for (let i = 0; i < corners.length; i++) for (let j = i + 1; j < corners.length; j++) { const a = corners[i], b = corners[j], L = Math.hypot(a.x - b.x, a.z - b.z); if (L < 8 || L > 30 || r() > amt * 0.7) continue;
    for (let w = 0; w < 1 + (r() * 2 | 0); w++) { const off = w * 0.25, sag = L * (0.06 + r() * 0.05); let px = a.x, py = a.y + off, pz = a.z;
      for (let s = 1; s <= 10; s++) { const t = s / 10, x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t), y = lerp(a.y, b.y, t) + off - Math.sin(t * Math.PI) * sag; pts.push(px, py, pz, x, y, z); px = x; py = y; pz = z; } } }
  if (!pts.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const l = new THREE.LineSegments(g, R.wire); l.userData.grime = true; root.add(l);
}

function neon(root, rec, f, [text, color, dead, flicker], r) {
  const { lit, flick } = T.neonSign(text, color, { dead, flicker, w: PHONE ? 384 : 512, h: PHONE ? 96 : 128 }), w = Math.min(f.L * 0.7, Math.max(3, text.length * 0.42)), h = w / 4;
  const y = f.y0 + f.h - h / 2 - 0.5, at = (r() - 0.5) * Math.max(0, f.L - w - 1), x = f.cx + f.tx * at + f.nx * 0.12, z = f.cz + f.tz * at + f.nz * 0.12;
  const mk = (map, off, o = {}) => { const m = new THREE.Mesh(R.geo.plane, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, ...o })); m.position.set(x + f.nx * off, y, z + f.nz * off); m.rotation.y = f.yaw; m.scale.set(w, h, 1); m.userData.grime = true; root.add(m); return m; };
  const spill = mk(R.glow, -0.06, { color, blending: THREE.AdditiveBlending, opacity: 0.55 }); spill.scale.set(w * 1.8, h * 3.6, 1); spill.position.y -= h * 0.6;
  const a = mk(lit, 0), b = mk(flick, 0.01); a.renderOrder = b.renderOrder = 2;
  rec.signs.push({ a, b, spill, base: 0.55, t: r() * 5, next: 0, mode: r() < 0.25 ? 'brown' : 'buzz' });
}

function beltway(bk, r, rec, D, k, trash, barrelAt) { // seedy shoulders: an overpass with a camp under it, tagged jersey barriers
  const hw = app.surface.world.highway?.(); if (!hw || !hw.len) return; const rough = app.surface.world.districts().find(s => s.id === 'mars-rough'); if (!rough) return;
  const cands = []; for (let s = 0; s < hw.len; s += 6) { const p = hw.at(s), d = Math.hypot(p.x - rough.x, p.z - rough.z); if (d > 75 && d < 230) cands.push({ ...p, d }); }
  cands.sort((a, b) => a.d - b.d); const picked = []; for (const c of cands) { if (picked.length >= (D.underpasses || 2)) break; if (picked.every(p => Math.hypot(p.x - c.x, p.z - c.z) > 60)) picked.push(c); }
  const Wd = 5.5; rec.street = [];
  for (const p of picked) { const L = Math.hypot(p.fx, p.fz) || 1, fx = p.fx / L, fz = p.fz / L, rx = -fz, rz = fx, yaw = Math.atan2(fx, fz), yR = groundY(p.x, p.z, 0);
    const deck = 6.2; // overpass deck across the road on two fat pillars
    for (const sd of [-1, 1]) { const x = p.x + rx * sd * (Wd + 2.2), z = p.z + rz * sd * (Wd + 2.2), y = groundY(x, z, yR);
      bk.put(R.geo.box, R.conc, x, (y + yR + deck) / 2 - 0.5, z, 0, yaw, 0, 1.6, deck - (y - yR) + 1, 6, [0.8, 0.78, 0.74]); solid(rec, { type: 'box', x, z, hx: 0.8, hz: 3, yaw });
      const f = { cx: x - rx * sd * 0.8, cz: z - rz * sd * 0.8, nx: -rx * sd, nz: -rz * sd, tx: fx * (sd > 0 ? 1 : -1), tz: fz * (sd > 0 ? 1 : -1), L: 6, h: deck, y0: y, yaw: Math.atan2(-rx * sd, -rz * sd) };
      const put = (cell, mat, u, v, sx, sy, layer) => bk.put(R.geo.plane, mat, f.cx + f.tx * u + f.nx * (0.03 + layer * 0.012), y + v, f.cz + f.tz * u + f.nz * (0.03 + layer * 0.012), 0, f.yaw, 0, sx, sy, 1, [1, 1, 1], cellUV(cell, r() < 0.5));
      put(pick(r, T.WALL_CELLS.soot), R.wall, 0, 1.2, 6, 2.4, 0); put(pick(r, T.WALL_CELLS.water), R.wall, (r() - 0.5) * 2, deck - 2, 2.5, 4, 1); put(pick(r, T.WALL_CELLS.rust), R.wall, (r() - 0.5) * 3, deck - 1.8, 1.4, 3.6, 1);
      put(pick(r, T.GRAF_CELLS.throwup), R.graf, 0, 1.6, 4.2, 2.2, 2); put(pick(r, T.GRAF_CELLS.tag), R.graf, (r() - 0.5) * 3, 3.1, 2, 1, 3); put(pick(r, T.GRAF_CELLS.stencil), R.graf, -2, 0.9, 0.9, 0.9, 3);
      rec.stat.decals += 6;
      // the camp on the far side of the pillar, away from traffic
      const ox = x + rx * sd * 2.6, oz = z + rz * sd * 2.6; rec.street.push({ x: ox, z: oz, y, yaw: f.yaw });
      if (street) street.camps({ id: 'mars-highway', solid: c => solid(rec, c), bk, R, r, rng: r, blocks: [], domes: [], faces, freeOf, spots: [{ x: ox, z: oz, f: { nx: rx * sd, nz: rz * sd, yaw: f.yaw + Math.PI } }], y0: y, cx: ox, cz: oz, rr: 6, level: D.camps * k, barrelAt: (bx, bz) => { bk.put(R.geo.barrel, R.metal, bx, y + 0.45, bz, 0, 0, 0, 1); bk.put(R.geo.disc, R.coal, bx, y + 0.78, bz, -Math.PI / 2, 0, 0, 0.5); rec.barrels.push({ x: bx, y: y + 0.85, z: bz }); }, trash: (tx, tz, ty, n) => { for (let i = 0; i < 3 * n; i++) { const s = 0.8 + r() * 0.4; bk.put(R.geo.bag, R.plastic, tx + (r() - 0.5) * 2, y + 0.2 * s, tz + (r() - 0.5) * 2, 0, r() * 6, 0, s, s, s, [0.07, 0.07, 0.07]); } }, rec, highway: true });
      // jersey barriers along the shoulder, tagged
      for (let j = -1; j <= 1; j += 2) { const bx = p.x + rx * sd * (Wd + 0.4) + fx * j * 9, bz = p.z + rz * sd * (Wd + 0.4) + fz * j * 9, by = groundY(bx, bz, yR);
        bk.put(R.geo.box, R.conc, bx, by + 0.45, bz, 0, yaw, 0, 0.6, 0.9, 3.6, [0.75, 0.73, 0.7]); solid(rec, { type: 'box', x: bx, z: bz, hx: 0.3, hz: 1.8, yaw });
        bk.put(R.geo.plane, R.graf, bx - rx * sd * 0.31, by + 0.5, bz - rz * sd * 0.31, 0, Math.atan2(-rx * sd, -rz * sd), 0, 1.6, 0.7, 1, [0.9, 0.9, 0.9], cellUV(pick(r, T.GRAF_CELLS.tag))); }
    }
    bk.put(R.geo.box, R.conc, p.x, yR + deck + 0.4, p.z, 0, yaw, 0, Wd * 2 + 6, 0.8, 6, [0.72, 0.7, 0.66]); // deck
    for (const sd of [-1, 1]) bk.put(R.geo.box, R.conc, p.x, yR + deck + 1.1, p.z + 0, 0, yaw, 0, Wd * 2 + 6, 0.6, 0.25, [0.7, 0.68, 0.64]);
    for (let i = 0; i < 12 * k; i++) { const a = r() * 6.28, d = r() * 7, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, cell = pick(r, [...T.GROUND_CELLS.oil, ...T.GROUND_CELLS.stain, ...T.GROUND_CELLS.litter, T.GROUND_CELLS.skid[0]]);
      bk.put(R.geo.plane, T.GROUND_CELLS.oil.includes(cell) ? R.wet : R.ground, x, groundY(x, z, yR) + 0.09, z, -Math.PI / 2, 0, r() * 6, 1.5 + r() * 2, 1.5 + r() * 2, 1, [0.9, 0.9, 0.9], cellUV(cell)); rec.stat.decals++; }
  }
}

// ---------------------------------------------------------------- particles: fire, embers, smoke, steam ------------------
const FX_VS = `attribute float aSize; attribute vec4 aCol; uniform float uScale; varying vec4 vCol;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FX_FS = `uniform sampler2D map; varying vec4 vCol; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vCol.rgb, vCol.a * t.a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function makeFx(root, rec, r) {
  const src = [...rec.barrels.map(b => ({ ...b, kind: b.smoulder ? 'smoulder' : 'fire' })), ...rec.vents.map(v => ({ ...v, kind: 'steam' }))]; if (!src.length) return null;
  const sc = cfg.fxScale, per = { fire: 16 * sc, smoke: 22 * sc, steam: 18 * sc };
  const sys = (n, blending) => { const P = new Float32Array(n * 3), Sz = new Float32Array(n), C = new Float32Array(n * 4), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSize', new THREE.BufferAttribute(Sz, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aCol', new THREE.BufferAttribute(C, 4).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: R.puff }, uScale: { value: 400 } }, vertexShader: FX_VS, fragmentShader: FX_FS, transparent: true, depthWrite: false, blending });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.grime = true; pts.renderOrder = 3; root.add(pts); return { pts, P, Sz, C, g, m, n, parts: [] }; };
  let nAdd = 0, nNorm = 0; for (const s of src) { if (s.kind === 'fire') { nAdd += per.fire | 0; nNorm += per.smoke | 0; } else if (s.kind === 'smoulder') nNorm += per.smoke | 0; else nNorm += per.steam | 0; }
  const add = nAdd ? sys(nAdd, THREE.AdditiveBlending) : null, norm = sys(nNorm, THREE.NormalBlending);
  let ia = 0, inn = 0;
  for (const s of src) {
    if (s.kind === 'fire') for (let i = 0; i < (per.fire | 0); i++) add.parts.push({ s, i: ia++, life: 0.5 + r() * 0.5, t: r(), type: i % 4 === 0 ? 'ember' : 'flame' });
    for (let i = 0; i < (per[s.kind === 'steam' ? 'steam' : 'smoke'] | 0); i++) norm.parts.push({ s, i: inn++, life: s.kind === 'steam' ? 1.6 + r() : 3 + r() * 2, t: r(), type: s.kind === 'steam' ? 'steam' : 'smoke', ox: (r() - 0.5) * 0.4, oz: (r() - 0.5) * 0.4 });
  }
  stats.particles += nAdd + nNorm; return { add, norm, src };
}
function stepFx(fx, dt, t, scale) {
  if (!fx) return;
  for (const S of [fx.add, fx.norm]) { if (!S) continue; S.m.uniforms.uScale.value = scale;
    for (const p of S.parts) { p.t += dt / p.life; if (p.t > 1) { p.t -= 1; p.ox = (Math.random() - 0.5) * 0.4; p.oz = (Math.random() - 0.5) * 0.4; }
      const s = p.s, k = p.t, o3 = p.i * 3, o4 = p.i * 4; let x = s.x, y = s.y, z = s.z, size = 1, cr = 1, cg = 1, cb = 1, a = 1;
      const wob = Math.sin(t * 3 + p.i) * 0.08, drift = k * k;
      if (p.type === 'flame') { y += k * 0.9; x += wob * (1 - k) + (p.ox || 0) * 0.3; z += (p.oz || 0) * 0.3; size = 0.65 * (1 - k * 0.7) * (0.8 + Math.sin(t * 17 + p.i) * 0.2); cr = 1; cg = 0.55 - k * 0.35; cb = 0.15; a = (1 - k) * 0.85; }
      else if (p.type === 'ember') { y += k * 2.6; x += Math.sin(p.i * 7 + k * 6) * 0.4 * k; z += Math.cos(p.i * 5 + k * 5) * 0.4 * k; size = 0.08; cr = 1; cg = 0.6; cb = 0.2; a = 1 - k; }
      else if (p.type === 'smoke') { y += 0.4 + k * 4.5; x += (p.ox || 0) + drift * 1.6 + wob; z += (p.oz || 0) + drift * 0.8; size = 0.6 + k * 2.4; const c = s.kind === 'smoulder' ? 0.09 : 0.12 + k * 0.1; cr = c; cg = c * 0.95; cb = c * 0.9; a = Math.sin(k * Math.PI) * 0.45; }
      else { y += k * 2.2; x += (p.ox || 0) + drift * 0.8 + wob; z += (p.oz || 0); size = 0.5 + k * 1.6; cr = cg = cb = 0.75; a = Math.sin(k * Math.PI) * 0.28; }
      S.P[o3] = x; S.P[o3 + 1] = y; S.P[o3 + 2] = z; S.Sz[p.i] = size; S.C[o4] = cr; S.C[o4 + 1] = cg; S.C[o4 + 2] = cb; S.C[o4 + 3] = a; }
    S.g.attributes.position.needsUpdate = S.g.attributes.aSize.needsUpdate = S.g.attributes.aCol.needsUpdate = true; }
}

// ---------------------------------------------------------------- film look --------------------------------------------
const GRADE_FS = `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime, uSat, uCon, uVig, uGrain, uCrush, uCA; uniform vec3 uLift, uHi; varying vec2 vUv;
#include <common>
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){ vec2 d = vUv - .5; float r2 = dot(d, d);
  vec3 c = texture2D(tDiffuse, vUv).rgb; if (uCA > 0.) { c.r = texture2D(tDiffuse, vUv - d * uCA).r; c.b = texture2D(tDiffuse, vUv + d * uCA).b; }
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  c = clamp(c, 0., 1.); c = mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); // grade in display (sRGB) space so grain doesn't blow up in shadows
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(vec3(l), c, uSat); c = (c - .42) * uCon + .42; c = max(c - uCrush, 0.) / (1. - uCrush);
  c += uLift * (1. - l) * (1. - l); c *= mix(vec3(1.), uHi, smoothstep(.25, 1., l));
  c *= 1. - uVig * smoothstep(.12, .62, r2 * 1.6);
  float g = h12(vUv * uRes + fract(uTime * 7.3) * 517.) - .5; c += g * uGrain * (.55 + l * .5);
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`;
const LITE_FS = `uniform vec2 uRes; uniform float uTime, uVig, uGrain; uniform vec3 uTint; varying vec2 vUv;
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){ vec2 d = vUv - .5; float v = 1. - uVig * smoothstep(.12, .62, dot(d, d) * 1.6); float g = h12(floor(vUv * uRes / 2.) + fract(uTime * 7.3) * 517.) - .5;
  gl_FragColor = vec4(uTint * v * (1. + g * uGrain * 2.), 1.); }`;
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
function makePost() {
  const ren = app.renderer, orig = ren.render.bind(ren), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.PlaneGeometry(2, 2);
  const U = () => ({ tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uSat: { value: 1 }, uCon: { value: 1 }, uVig: { value: 0.3 }, uGrain: { value: 0.04 }, uCrush: { value: 0 }, uCA: { value: 0 }, uLift: { value: new THREE.Vector3() }, uHi: { value: new THREE.Vector3(1, 1, 1) }, uTint: { value: new THREE.Vector3(1, 1, 1) } });
  const gm = new THREE.ShaderMaterial({ uniforms: U(), vertexShader: VS, fragmentShader: GRADE_FS, depthTest: false, depthWrite: false, toneMapped: true });
  const lm = new THREE.ShaderMaterial({ uniforms: U(), vertexShader: VS, fragmentShader: LITE_FS, depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor });
  const gs = new THREE.Scene(), ls = new THREE.Scene(); const gq = new THREE.Mesh(quad, gm), lq = new THREE.Mesh(quad, lm); gq.frustumCulled = lq.frustumCulled = false; gs.add(gq); ls.add(lq);
  let rt = null, rtHalf = null; const size = new THREE.Vector2(), cur = { ...cfg.baseGrade, lift: [...cfg.baseGrade.lift], hi: [...cfg.baseGrade.hi], w: 0 };
  const P = { mode: 'off', cur, frames: 0, orig };
  ren.render = function (sc, camera) {
    if (P.mode === 'off' || !surf() || sc !== surf().scene || ren.getRenderTarget() !== null || !onMars()) return orig(sc, camera);
    P.frames++; ren.getDrawingBufferSize(size); const t = performance.now() / 1000;
    if (P.mode === 'full') {
      if (!rt || rt.width !== size.x || rt.height !== size.y || rt.samples !== cfg.msaa || rtHalf !== cfg.rtHalf) { rt?.dispose(); rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: cfg.rtHalf ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: cfg.msaa }); rtHalf = cfg.rtHalf; }
      ren.setRenderTarget(rt); orig(sc, camera); ren.setRenderTarget(null);
      const u = gm.uniforms; u.tDiffuse.value = rt.texture; u.uRes.value.copy(size); u.uTime.value = t; u.uSat.value = cur.sat; u.uCon.value = cur.con; u.uVig.value = cur.vig; u.uGrain.value = cur.grain; u.uCrush.value = cur.crush; u.uCA.value = PHONE ? 0 : 0.003;
      u.uLift.value.fromArray(cur.lift); u.uHi.value.fromArray(cur.hi); orig(gs, cam);
    } else { orig(sc, camera); const ac = ren.autoClear; ren.autoClear = false; const u = lm.uniforms; u.uRes.value.copy(size); u.uTime.value = t; u.uVig.value = cur.vig * 0.9; u.uGrain.value = cur.grain * 0.8;
      const l = 0.5 * (cur.hi[0] + cur.hi[1] + cur.hi[2]) / 3 + 0.5; u.uTint.value.set(cur.hi[0] * l * (0.9 + (1 - cur.sat) * 0.1), cur.hi[1] * l * 0.97, cur.hi[2] * l * 0.97); orig(ls, cam); ren.autoClear = ac; }
  };
  P.dispose = () => { ren.render = orig; rt?.dispose(); };
  return P;
}

// district weights -> grade + fog (smooth as you walk between districts)
let fogOrig = null;
function blendLook(dt) {
  const info = surf()?.info, sc = scene; if (!info || !sc) return;
  const ds = app.surface.world.districts(); const target = { ...cfg.baseGrade, lift: [...cfg.baseGrade.lift], hi: [...cfg.baseGrade.hi] }; let fog = null, wsum = 0;
  const mix = (G, w) => { for (const k of ['sat', 'con', 'vig', 'grain', 'crush']) target[k] = lerp(target[k], G[k], w); for (let i = 0; i < 3; i++) { target.lift[i] = lerp(target.lift[i], G.lift[i], w); target.hi[i] = lerp(target.hi[i], G.hi[i], w); } };
  const k = Math.min(1, mult());
  for (const d of ds) { const D = dcfg(d.id), dist = Math.hypot(info.x - d.x, info.z - d.z), w = Math.max(0, Math.min(1, 1 - (dist - (d.r || 58) - 20) / 60)) * k; if (w > 0) { mix(D.grade || cfg.baseGrade, w); if (D.fog && w > wsum) { fog = { ...D.fog, w }; wsum = w; } } }
  const hd = app.surface.world.districtAt?.(info.x, info.z); if (hd?.id === 'mars-highway') { const D = dcfg('mars-highway'); mix(D.grade, 0.8 * k); if (D.fog && 0.8 > wsum) fog = { ...D.fog, w: 0.8 * k }; }
  if (post) { const c = post.cur, a = Math.min(1, dt * 1.5); for (const kk of ['sat', 'con', 'vig', 'grain', 'crush']) c[kk] = lerp(c[kk], target[kk], a); for (let i = 0; i < 3; i++) { c.lift[i] = lerp(c.lift[i], target.lift[i], a); c.hi[i] = lerp(c.hi[i], target.hi[i], a); } }
  if (sc.fog && sc.fog.isFog) { if (!fogOrig || fogOrig.scene !== sc || fogOrig.fog !== sc.fog) fogOrig = { scene: sc, fog: sc.fog, color: sc.fog.color.clone(), near: sc.fog.near, far: sc.fog.far };
    const w = fog && cfg.enabled ? fog.w : 0, a = Math.min(1, dt * 1.2), tc = new THREE.Color(fog ? fog.color : fogOrig.color);
    const col = fogOrig.color.clone().lerp(tc, w); sc.fog.color.lerp(col, a); sc.fog.near = lerp(sc.fog.near, lerp(fogOrig.near, fog ? fog.near : fogOrig.near, w), a); sc.fog.far = lerp(sc.fog.far, lerp(fogOrig.far, fog ? fog.far : fogOrig.far, w), a);
    window.__director?.pullFog?.(sc.fog); // keep a dust storm's fog pull-in (director)
    if (sc.background?.isColor) sc.background.copy(sc.fog.color); }
}
function restoreFog() { if (fogOrig?.scene?.fog === fogOrig.fog) { fogOrig.fog.color.copy(fogOrig.color); fogOrig.fog.near = fogOrig.near; fogOrig.fog.far = fogOrig.far; } }

// ---------------------------------------------------------------- streaming + per-frame ----------------------------------
// ---------- colliders (PR #44's SSX.colliders; guarded, no-op without it) ----------
// Solid props only: shanties, tents, carts, burn barrels, junk piles, the sofa, the burnt hauler, Beltway pillars/barriers.
// Decals, litter, tarps, mattresses and sleepers stay walk-through. Everything is registered under group 'grime'
// and re-synced as a whole (removeGroup + re-add for every built district) whenever a district builds or is disposed.
let colsDirty = false;
function solid(rec, c) { if (rec?.cols && isFinite(c.x) && isFinite(c.z)) rec.cols.push({ ...c, group: 'grime' }); }
function colApi() { const C = window.SSX?.colliders; return C && typeof C.add === 'function' ? C : null; }
function syncCols() {
  const C = colApi(); if (!C) { stats.colliders = 0; return false; }
  try { C.removeGroup?.('grime'); let n = 0; const per = {}; for (const rec of built.values()) { per[rec.id] = rec.cols?.length || 0; for (const c of rec.cols || []) { C.add(c); n++; } }
    stats.colliders = n; stats.collidersPer = per; colsDirty = false; return true; } catch (e) { console.warn('grime: colliders', e); colsDirty = false; return false; } }
function colsTick() { if (colsDirty && colApi()) syncCols(); } // per frame; cheap. If #44 loads later, props register then
try { window.addEventListener('colliders:ready', () => { colsDirty = true; syncCols(); }); } catch (e) { /* */ }
function dispose(rec) {
  rec.root.parent?.remove(rec.root);
  rec.root.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.material.userData.shared) { o.material.map && !o.material.map.userData.shared && o.material.map !== R.glow && o.material.map.dispose(); o.material.dispose(); } });
  for (const m of rec.shanty || []) if (m.userData.grimeOrig) { m.material = m.userData.grimeOrig; }
  street?.dropCamps(rec.id);
  built.delete(rec.id); colsDirty = true; syncCols();
}
function rebuildAll() { for (const rec of [...built.values()]) dispose(rec); stats.particles = 0; }
function stream() {
  const info = surf()?.info; if (!info) return;
  const groups = siteGroups(), ds = app.surface.world.districts();
  for (const [id, rec] of built) if (rec.siteGroup && rec.siteGroup.parent !== scene) dispose(rec);
  if (!cfg.enabled || mult() <= 0) { rebuildAll(); return; }
  for (const d of ds) { const dist = Math.hypot(info.x - d.x, info.z - d.z), have = built.get(d.id);
    if (!have && dist < cfg.streamIn) { res(); const g = groups.find(o => o.userData.v8.site === d.id); if (!g) continue; const rec = buildDistrict(d.id, g, d); built.set(d.id, rec); stats.buildMs = Math.round(rec.ms); stats.tm = { ...(stats.tm || {}), [d.id]: rec.tm }; }
    else if (have && dist > cfg.streamOut) dispose(have); }
  const hwG = groups.find(o => o.userData.v8.site === 'highway'), hv = built.get('mars-highway'), rough = ds.find(d => d.id === 'mars-rough');
  if (hwG && rough) { const dist = Math.hypot(info.x - rough.x, info.z - rough.z); if (!hv && dist < 320) res(), built.set('mars-highway', buildDistrict('mars-highway', hwG, { x: rough.x, z: rough.z, r: 40 })); else if (hv && dist > 420) dispose(hv); }
  stats.districts = built.size; stats.decals = [...built.values()].reduce((a, r) => a + r.stat.decals, 0); stats.props = [...built.values()].reduce((a, r) => a + r.stat.props, 0);
}
function stepSigns(rec, dt) {
  for (const s of rec.signs) { s.t -= dt; if (s.t > 0) continue;
    if (s.mode === 'buzz') { const on = !s.b.visible; s.b.visible = on; s.t = on ? 0.05 + Math.random() * (Math.random() < 0.2 ? 2.5 : 0.25) : 0.03 + Math.random() * 0.15; }
    else { const dim = s.a.material.opacity > 0.6; s.a.material.opacity = dim ? 0.25 + Math.random() * 0.2 : 1; s.b.visible = !dim && Math.random() < 0.6; s.spill.material.opacity = dim ? 0.12 : s.base; s.t = dim ? 0.06 + Math.random() * 0.4 : 0.8 + Math.random() * 4; } }
}
let last = 0, acc = 0, was = false;
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now() / 1000, dt = Math.min(0.1, now - (last || now)); last = now;
  colsTick();
  const on = onMars(); if (!on) { if (was) { was = false; street?.pause(true); } return; }
  const s = surf(); if (scene !== s.scene) { scene = s.scene; built.clear(); fireLight = null; }
  if (!was) { was = true; street?.pause(false); }
  acc += dt; if (acc > 0.5) { acc = 0; try { stream(); } catch (e) { console.warn('grime stream', e); } }
  blendLook(dt);
  const cam = s.camera, scale = app.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad((cam?.fov || 60) / 2))); let near = null, nd = 1e9;
  const info = s.info;
  for (const rec of built.values()) { stepSigns(rec, dt); const close = Math.hypot(info.x - (rec.fx?.src[0]?.x ?? 1e9), info.z - (rec.fx?.src[0]?.z ?? 1e9)) < 160 || rec.id === 'mars-highway'; if (close) stepFx(rec.fx, dt, now, scale);
    for (const b of rec.barrels) { if (b.smoulder) continue; const d = Math.hypot(info.x - b.x, info.z - b.z); if (d < nd) { nd = d; near = b; } } }
  if (!PHONE && near && nd < 30) { if (!fireLight) { fireLight = new THREE.PointLight(0xff7a30, 0, 14, 1.6); fireLight.userData.grime = true; scene.add(fireLight); }
    fireLight.position.set(near.x, near.y + 0.6, near.z); fireLight.intensity = (14 + Math.sin(now * 23) * 3 + Math.sin(now * 7.1) * 4) * Math.max(0, 1 - nd / 30); }
  else if (fireLight) fireLight.intensity = 0;
  try { street?.update(dt, now); } catch (e) { console.warn('grime street', e); }
}

// ---------------------------------------------------------------- audio: barks + pirate radio (guarded) -----------------
let audioDone = false;
function registerAudio() {
  const X = window.SSX; if (audioDone || !X || typeof X.registerBarks !== 'function') return false;
  try { for (const [cat, lines] of Object.entries({ ...BARK_PACKS, ...STREET_BARKS })) X.registerBarks(cat, lines); } catch (e) { console.warn('grime barks', e); }
  try { if (typeof X.registerStation === 'function' && !(X.audio?.stations?.() || []).some(s => s.id === PIRATE_STATION.id)) X.registerStation(PIRATE_STATION); } catch (e) { console.warn('grime radio', e); }
  audioDone = true; return true;
}

// ---------------------------------------------------------------- settings panel (black, white, 44px+, __onTap) ---------
function save() { try { localStorage.setItem(LS, JSON.stringify({ level: cfg.level, post: cfg.post, street: cfg.street, density: street?.density })); } catch (e) { /* private mode */ } }
function load() { try { const s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s) { if (s.level != null) cfg.level = s.level; if (s.post) cfg.post = s.post; if (s.street != null) cfg.street = s.street; return s; } } catch (e) { /* */ } return null; }
function openPanel() {
  panel?.remove(); const p = panel = document.createElement('div'); p.id = 'grimePanel';
  p.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;background:#000;color:#fff;border:1px solid #fff;padding:16px;width:min(92vw,380px);font:15px system-ui,sans-serif;border-radius:8px;max-height:86vh;overflow:auto';
  const row = (label, opts, cur, fn) => { const r = document.createElement('div'); r.style.cssText = 'margin:10px 0'; r.innerHTML = `<div style="margin-bottom:6px;opacity:.85">${label}</div>`; const w = document.createElement('div'); w.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    for (const [id, txt] of opts) { const b = document.createElement('button'); b.textContent = txt; b.style.cssText = `min-height:44px;min-width:64px;flex:1;background:${id === cur ? '#fff' : '#000'};color:${id === cur ? '#000' : '#fff'};border:1px solid #fff;border-radius:6px;font:600 14px system-ui`;
      window.__onTap?.(b, () => { fn(id); openPanel(); }); w.appendChild(b); } r.appendChild(w); p.appendChild(r); };
  p.innerHTML = '<div style="font-weight:700;font-size:17px">🧱 Grime &amp; grain</div><div style="opacity:.7;font-size:13px;margin-top:4px">Red Tape Flats is the worst of it. Phones default to the cheap film pass.</div>';
  row('Grime', [['off', 'Off'], ['light', 'Light'], ['med', 'Med'], ['max', 'Max']], typeof cfg.level === 'number' ? 'med' : cfg.level, v => api.setLevel(v));
  row('Film grain / grade', [['off', 'Off'], ['lite', 'Lite'], ['full', 'Full']], cfg.post, v => api.setPost(v));
  row('Street hassle', [['off', 'Off'], ['on', 'On']], cfg.street ? 'on' : 'off', v => v === 'on' ? api.street.enable() : api.street.disable());
  row('Hassle density', [[0.5, 'Low'], [1, 'Normal'], [2, 'Skid Row']], street?.density ?? 1, v => api.street.setDensity(v));
  const c = document.createElement('button'); c.textContent = 'Close'; c.style.cssText = 'margin-top:8px;width:100%;min-height:48px;background:#000;color:#fff;border:1px solid #fff;border-radius:6px;font:600 15px system-ui'; window.__onTap?.(c, () => { p.remove(); panel = null; }); p.appendChild(c);
  document.body.appendChild(p);
}

// ---------------------------------------------------------------- public API --------------------------------------------
const api = {
  config: GRIME_CONFIG, version: 1,
  setLevel(v) { cfg.level = typeof v === 'number' ? Math.max(0, Math.min(1.5, v)) : (v in LEVELS ? v : 'med'); cfg.enabled = mult() > 0 || cfg.enabled; rebuildAll(); save(); return cfg.level; },
  get level() { return cfg.level; },
  enable() { cfg.enabled = true; if (post) post.mode = cfg.post; rebuildAll(); street?.enable(true); save(); return true; },
  disable() { cfg.enabled = false; rebuildAll(); if (post) post.mode = 'off'; restoreFog(); street?.disable(true); save(); return false; },
  get enabled() { return cfg.enabled; },
  setPost(m) { cfg.post = ['full', 'lite', 'off'].includes(m) ? m : 'off'; if (post) post.mode = cfg.enabled ? cfg.post : 'off'; save(); return cfg.post; },
  district(id, o) { if (o === null) delete overrides[id]; else if (o) overrides[id] = { ...(overrides[id] || {}), ...o }; const b = built.get(id); if (b) dispose(b); return dcfg(id); },
  rebuild: () => rebuildAll(),
  stats: () => ({ ...stats, built: [...built.keys()], post: post?.mode || 'off', postFrames: post?.frames || 0, level: cfg.level, enabled: cfg.enabled, phone: PHONE, audio: audioDone, street: street?.stats?.() || null }),
  openPanel,
  debug: { groundY: (x, z) => groundY(x, z, NaN), built: () => built },
  street: null
};

export function initGrime(a) {
  if (window.SSX?.grime) return window.SSX.grime;
  app = a; load();
  // shanties become real blocks of Red Tape Flats (collision, camera) the next time the city is built
  try { const def = districtsOf('Mars').find(d => d.id === 'mars-rough'); if (def && !def.__grime) { def.__grime = true; def.blocks = [...(def.blocks || []), ...cfg.shanties.map(s => [...s])]; } } catch (e) { console.warn('grime shanties', e); }
  try { street = createStreet({ app, cfg, PHONE, T, get R() { return res(); }, dcfg, mult, scene: () => scene, onMars, save }); } catch (e) { console.warn('grime street init', e); street = null; }
  const s = load(); if (street && s?.density) street.setDensity(s.density); if (street && !cfg.street) street.disable(true);
  api.street = street ? street.api : { setDensity() {}, enable() {}, disable() {} };
  post = makePost(); post.mode = cfg.enabled ? cfg.post : 'off';
  window.SSX = window.SSX || {}; window.SSX.grime = api;
  try { window.SSX.registerMenuItem?.({ id: 'grimeMenu', label: '🧱 Grime & grain', onTap: () => openPanel() }); } catch (e) { console.warn('grime menu', e); }
  if (!registerAudio()) { let n = 0; const iv = setInterval(() => { if (registerAudio() || ++n > 60) clearInterval(iv); }, 1000); } // mars-audio.js loads async
  requestAnimationFrame(tick);
  return api;
}
