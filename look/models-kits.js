// v8 building kits (loaded by look/models.js): dresses the existing Mars district blocks and domes, never replaces their
// collision. Each district is built once, the first time you come within D_KIT metres, as one Group inside the district's
// own group (so the world's site visibility culls it for free).
//   Olympus Row (mars-downtown): procedural merged facade kit on every block (plinth, pilasters, shopfront glass, sills,
//     lintels, string course, cornice, door awning, AC units) + instanced CC0 planters and curved billboards.
//   Red Tape Flats (mars-rough): tenement kit - rust panel walls, stacked set-back storeys, small windows; instanced CC0
//     boarded windows, roller shutters, fire escapes and burn barrels.
//   Helios Heights (mars-gated): CC0 villas (mediterranean / modern / glass) inside the mansion domes (the placeholder
//     interior boxes are hidden while the villa is up) + a white stucco facade with neon trim on the gate house.
// Facades: 3 merged draws per district (walls, dark glass, lit glass). Props: one InstancedMesh per GLB primitive.
import * as THREE from 'three';

const KITS = { 'mars-downtown': 'downtown', 'mars-rough': 'rough', 'mars-gated': 'gated' };
const PROPS = { downtown: ['planter_box_01', 'mars_billboard_curved'], rough: ['boarded_window', 'rollershutter_window', 'fire_escape', 'burn_barrel'], gated: ['mansion_villa', 'mansion_modern', 'mansion_glass'] };
const files = new Map();
function prop(S, id) { let f = files.get(id); if (!f) { f = S.gltf(`kit/${id}.glb`); files.set(id, f); f.catch(() => {}); } return f; }

// ---------------------------------------------------------------- merged box builder ----------------------------------------------------------------
class Boxes {
  constructor() { this.P = []; this.N = []; this.C = []; this.I = []; }
  add(M, col) { // unit box transformed by M (Matrix4), flat colour
    const P = this.P, N = this.N, C = this.C, I = this.I, base = P.length / 3, v = _v, n = _n, nm = _nm.getNormalMatrix(M), c = _c.setHex(col);
    for (const [ax, s] of FACES) {
      const b = P.length / 3;
      for (const [u, w] of QUAD) { const p = [0, 0, 0]; p[ax] = s * 0.5; p[(ax + 1) % 3] = u * 0.5 * s; p[(ax + 2) % 3] = w * 0.5; v.set(p[0], p[1], p[2]).applyMatrix4(M); P.push(v.x, v.y, v.z); const q = [0, 0, 0]; q[ax] = s; n.set(q[0], q[1], q[2]).applyMatrix3(nm).normalize(); N.push(n.x, n.y, n.z); C.push(c.r, c.g, c.b); }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return base;
  }
  geo() { if (!this.I.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.setIndex(this.I); g.computeBoundingSphere(); return g; }
}
const FACES = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]], QUAD = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3(), _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const mtx = (x, y, z, sx, sy, sz, ry = 0, rx = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, 0)), _s.set(sx, sy, sz));
let rnd = 1; const rand = () => ((rnd = (rnd * 16807) % 2147483647) - 1) / 2147483646;
const shade = (hex, k) => _c.setHex(hex).multiplyScalar(k).getHex();

// a building face: centre (cx, cz), outward yaw a, face width L; local (u along the face, y up, o outward from the wall plane)
function faceOf(b, k) { // k: 0 front (+Z), 1 right (+X), 2 back (-Z), 3 left (-X)
  const a = [0, Math.PI / 2, Math.PI, -Math.PI / 2][k], L = k % 2 ? b.d : b.w, D = k % 2 ? b.w : b.d;
  return { k, a, L, D, put: (u, y, o, sx, sy, sz, tilt = 0) => { const ca = Math.cos(a), sa = Math.sin(a), lz = D / 2 + o; return mtx(b.x + ca * u + sa * lz, b.y0 + y, b.z - sa * u + ca * lz, sx, sy, sz, a, tilt); } };
}
// world transform for a GLB prop placed on a face (prop front faces +Z, origin at its base centre)
const CX = { rollershutter_window: 1.5, fire_escape: 0.93 }; // props whose origin is not at their horizontal centre
const onFace = (f, u, y, o, s = 1, id) => f.put(u - (CX[id] || 0) * s, y, o, s, s, s);

// ---------------------------------------------------------------- facades ----------------------------------------------------------------
const STYLE = {
  downtown: { wall: [0xa39a8c, 0x9a9184, 0xaba294], trim: 0xcfc6b6, dark: 0x40505e, gf: 3.4, fh: 3.1, bay: 2.6, lit: 0.4 },
  gated: { wall: [0xe8e2d8, 0xf0ebe2, 0xdcd4c8], trim: 0xffffff, dark: 0x4a5a66, gf: 3.2, fh: 3, bay: 2.8, lit: 0.5, neon: 0x30e0d0 },
  rough: { wall: [0x6a3a28, 0x7a4a30, 0x5a4436, 0x80583c, 0x4e3a30], trim: 0x3a3430, dark: 0x1c1a18, gf: 2.8, fh: 2.6, bay: 2.2, lit: 0.25 },
};
function facade(st, b, B, place, kind) {
  const isDoor = b.door, frontGap = 1.15;
  const extra = kind === 'rough' && b.w >= 7 ? 2 : 0; // tenement: stacked storeys, set back from the sign
  for (let k = 0; k < 4; k++) {
    const f = faceOf(b, k), L = f.L, H = b.h;
    const nb = Math.max(1, Math.round(L / st.bay)), bw = L / nb, wallC = st.wall[k % st.wall.length];
    const door = isDoor && k === 0, clear = (u, y) => door && Math.abs(u) < frontGap && y < 2.9;
    // plinth + string course + cornice
    if (door) { const s = (L / 2 - frontGap); for (const sg of [-1, 1]) B.wall.add(f.put(sg * (frontGap + s / 2), 0.22, 0.08, s, 0.44, 0.16), st.trim); }
    else B.wall.add(f.put(0, 0.22, 0.08, L + 0.16, 0.44, 0.16), st.trim);
    if (kind !== 'rough') { B.wall.add(f.put(0, Math.min(st.gf, H - 0.8), 0.1, L + 0.2, 0.22, 0.2), st.trim); B.wall.add(f.put(0, H - 0.38, 0.17, L + 0.34, 0.42, 0.34), st.trim); }
    else { for (let y = 1.3; y < H - 0.3; y += 1.3) B.wall.add(f.put(0, y, 0.03, L + 0.04, 0.06, 0.06), shade(wallC, 0.7)); B.wall.add(f.put(0, H - 0.12, 0.08, L + 0.12, 0.24, 0.16), st.trim); }
    // pilasters (downtown / gated) or rust panels (rough)
    if (kind !== 'rough') for (let i = 0; i < nb; i++) { const u = -L / 2 + (i + 0.5) * bw; // stone / stucco infill over the v7 hull
      if (door && Math.abs(u) < frontGap + bw / 2) { const lo = Math.max(-bw / 2, -frontGap - u), hi = Math.min(bw / 2, frontGap - u); for (const [a0, a1] of [[-bw / 2, lo], [hi, bw / 2]]) if (a1 - a0 > 0.05) B.wall.add(f.put(u + (a0 + a1) / 2, H / 2, 0.02, a1 - a0, H - 0.1, 0.04), wallC); B.wall.add(f.put(u + (lo + hi) / 2, (2.9 + H) / 2, 0.02, hi - lo, H - 2.9 - 0.05, 0.04), wallC); }
      else B.wall.add(f.put(u, H / 2, 0.02, bw, H - 0.1, 0.04), wallC); }
    if (kind !== 'rough') for (let i = 0; i <= nb; i++) { const u = -L / 2 + i * bw; if (door && Math.abs(u) < frontGap + 0.2) { if (H - st.gf > 0.8) B.wall.add(f.put(u, (st.gf + H) / 2, 0.09, 0.34, H - st.gf, 0.18), st.trim); continue; } B.wall.add(f.put(u, H / 2, 0.09, i === 0 || i === nb ? 0.42 : 0.3, H - 0.1, 0.18), i % 2 ? st.trim : shade(st.trim, 0.92)); }
    else for (let i = 0; i < nb; i++) { const u = -L / 2 + (i + 0.5) * bw; for (let y = 0; y < H; y += 1.3) { if (clear(u, y + 0.6)) continue; B.wall.add(f.put(u, y + 0.65, 0.02, bw - 0.04, 1.24, 0.04), shade(st.wall[(i + Math.round(y)) % st.wall.length], 0.85 + rand() * 0.25)); } }
    // ground floor
    for (let i = 0; i < nb; i++) {
      const u = -L / 2 + (i + 0.5) * bw;
      if (door && Math.abs(u) < frontGap + bw / 2 - 0.15) { // door bay: side lights only when there is room
        const room = bw / 2 - frontGap - 0.35; if (room > 0.5 && kind !== 'rough') for (const sg of [-1, 1]) { const c = u + sg * (frontGap + room / 2 + 0.1); if (Math.abs(c) > frontGap) B.glass.add(f.put(c, 1.6, 0.05, room, 2.1, 0.04), st.dark); }
        continue;
      }
      if (kind === 'rough') { if (k === 0 && bw > 1.8 && rand() < 0.75) place.push(['rollershutter_window', f, u, 0.1, 0.02, Math.min(0.75, (bw - 0.3) / 5.1)]); else if (rand() < 0.5) place.push(['boarded_window', f, u, 0.5, 0.04, 0.9]); else win(B, st, f, u, 1.7, 0.9, 1.1, kind); continue; }
      if (k === 0) { B.glass.add(f.put(u, 1.65, 0.06, bw - 0.55, 2.3, 0.04), rand() < st.lit ? 0xffb868 : st.dark, rand() < st.lit); B.wall.add(f.put(u, 2.92, 0.1, bw - 0.4, 0.14, 0.12), st.dark); B.wall.add(f.put(u, 0.5, 0.1, bw - 0.4, 0.12, 0.12), st.dark); }
      else win(B, st, f, u, 1.9, Math.min(1.3, bw * 0.5), 1.3, kind);
    }
    // upper floors
    const nUp = Math.max(0, Math.floor((H - st.gf - 0.6) / st.fh));
    for (let j = 0; j < nUp; j++) for (let i = 0; i < nb; i++) {
      const u = -L / 2 + (i + 0.5) * bw, y = st.gf + j * st.fh + st.fh * 0.5;
      if (kind === 'rough' && rand() < 0.3) { place.push(['boarded_window', f, u, y - 0.85, 0.04, 0.85]); continue; }
      win(B, st, f, u, y, Math.min(1.5, bw * 0.55), Math.min(1.8, st.fh * 0.58), kind);
      if (k % 2 && rand() < 0.18) B.wall.add(f.put(u + 0.2, y - st.fh * 0.42, 0.28, 0.72, 0.5, 0.45), 0x9a9c9e); // AC unit
    }
    if (door && k === 0 && kind !== 'rough') { B.wall.add(f.put(0, 3.05, 0.6, 2.7, 0.08, 1.2, 0, -0.18), b.color != null ? shade(b.color, 0.55) : st.dark); for (const sg of [-1, 1]) B.wall.add(f.put(sg * 1.25, 3.25, 0.62, 0.04, 0.04, 1.2, 0, -0.5), st.dark); }
    if (st.neon) B.lit.add(f.put(0, H - 0.62, 0.35, L + 0.2, 0.05, 0.04), st.neon);
    if (kind === 'rough' && k % 2 && b.d >= 5 && H >= 4) place.push(['fire_escape', f, -0.9, H + extra * st.fh - 6.4, 0.05, 0.62]);
  }
  if (extra) { // stacked tenement storeys, set back from the front sign
    const sb = 1.6, w = b.w - 0.6, d = b.d - sb - 0.3, yb = b.h, hh = extra * st.fh, cz = b.z - sb / 2;
    const s = { x: b.x, z: cz, w, d, h: hh, y0: b.y0 + yb };
    B.wall.add(mtx(s.x, s.y0 + hh / 2, s.z, w, hh, d), st.wall[1]);
    for (let k = 0; k < 4; k++) { const f = faceOf(s, k), nb = Math.max(1, Math.round(f.L / st.bay)), bw = f.L / nb;
      for (let i = 0; i < nb; i++) for (let y = 0; y < hh; y += 1.3) B.wall.add(f.put(-f.L / 2 + (i + 0.5) * bw, y + 0.65, 0.02, bw - 0.04, 1.24, 0.04), shade(st.wall[(i + k + Math.round(y)) % st.wall.length], 0.8 + rand() * 0.3));
      for (let j = 0; j < extra; j++) for (let i = 0; i < nb; i++) { const u = -f.L / 2 + (i + 0.5) * bw, y = j * st.fh + st.fh * 0.5; if (rand() < 0.3) place.push(['boarded_window', f, u, y - 0.8, 0.04, 0.8]); else win(B, st, f, u, y, 0.9, 1.15, 'rough'); }
      B.wall.add(f.put(0, hh - 0.1, 0.08, f.L + 0.12, 0.2, 0.16), st.trim); }
    B.wall.add(mtx(s.x + w * 0.2, s.y0 + hh + 0.5, s.z, 1.4, 1, 1.2), 0x6a6c6e); // rooftop plant box
  }
}
function win(B, st, f, u, y, ww, wh, kind) {
  const lit = rand() < st.lit;
  B.glass.add(f.put(u, y, 0.045, ww, wh, 0.04), lit ? (kind === 'rough' ? 0xff8a40 : 0xffb868) : st.dark, lit);
  B.wall.add(f.put(u, y - wh / 2 - 0.06, 0.12, ww + 0.3, 0.1, 0.22), st.trim);
  if (kind !== 'rough') B.wall.add(f.put(u, y + wh / 2 + 0.09, 0.08, ww + 0.2, 0.16, 0.14), st.trim);
  else B.wall.add(f.put(u, y, 0.06, ww + 0.16, wh + 0.16, 0.04), 0x2c2826);
}

// ---------------------------------------------------------------- materials ----------------------------------------------------------------
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const w = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 });
  const g = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.45, envMapIntensity: 1.5 });
  const l = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.6 });
  l.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;'); };
  l.customProgramCacheKey = () => 'ssxkit-lit';
  for (const m of [w, g, l]) { m.userData.weathered = true; m.userData.ssxKit = true; }
  return (MATS = { wall: w, glass: g, lit: l });
}

// ---------------------------------------------------------------- per-district build ----------------------------------------------------------------
function survey(site) {
  const blocks = [], domes = [];
  for (const o of site.children) {
    const p = o.userData?.v8?.part;
    if (p === 'block') blocks.push({ mesh: o, x: o.position.x, z: o.position.z, w: o.scale.x, h: o.scale.y, d: o.scale.z, y0: o.position.y - o.scale.y / 2 });
    else if (p === 'dome') domes.push({ mesh: o, x: o.position.x, z: o.position.z, y0: o.position.y, r: o.scale.x });
  }
  // what stands at each block's front face: the walk-in door trims (thin boxes at z + d/2 + 0.1) and its sign colour
  for (const b of blocks) for (const o of site.children) if (o.isMesh && o !== b.mesh && Math.abs(o.position.z - (b.z + b.d / 2 + 0.1)) < 0.02 && Math.abs(o.position.x - b.x) < 1 && o.scale.z < 0.1) { b.door = true; b.color = o.material?.color?.getHex?.(); }
  for (const d of domes) d.inner = site.children.filter(o => o.isMesh && o !== d.mesh && Math.hypot(o.position.x - d.x, o.position.z - d.z) < d.r * 0.6 && o.position.y < d.y0 + 3 && ((Math.abs(o.scale.x - 2.4) < 1e-3 && Math.abs(o.scale.y - 2.4) < 1e-3) || (Math.abs(o.scale.y - 0.1) < 1e-3 && Math.abs(o.scale.x - d.r * 0.55) < 1e-3)));
  return { blocks, domes };
}
function instanced(gltf, list) { // one InstancedMesh per primitive of the prop, list = Matrix4[]
  const out = []; gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh || !list.length) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
    for (let i = 0; i < list.length; i++) im.setMatrixAt(i, _m.multiplyMatrices(list[i], o.matrixWorld));
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.frustumCulled = true;
    const m = o.material; if (m) { m.userData.weathered = true; m.userData.ssxKit = true; }
    im.userData.ssxKit = true; out.push(im);
  });
  return out;
}
// citydata gated domes in order: HELIOS, VOSS HOUSE, SABLE ANNEX, QUINN VILLA, KLINE RETREAT, CLUBHOUSE
const VILLAS = ['mansion_modern', 'mansion_villa', 'mansion_glass', 'mansion_villa', 'mansion_modern', 'mansion_glass'];
function fitVilla(bb, r) { // biggest scale that keeps the villa under the dome shell (dome = r wide, 0.8 r tall)
  const hd = Math.hypot(Math.max(-bb.min.x, bb.max.x), Math.max(-bb.min.z, bb.max.z)), H = bb.max.y;
  for (let s = 1.2; s > 0.2; s -= 0.02) { const rho = hd * s; if (rho > r * 0.86) continue; const hc = 0.8 * r * Math.sqrt(1 - (rho / r) ** 2); if (hc >= 0.72 * H * s && H * s <= 0.9 * 0.8 * r) return s; }
  return 0.3;
}

async function build(S, site, kind) {
  rnd = kind.length * 7919 + 17; const st = STYLE[kind], sv = survey(site), M = mats();
  const B = { wall: new Boxes(), glass: new Boxes(), lit: new Boxes() };
  const litAdd = B.glass.add.bind(B.glass); B.glass.add = (Mx, col, lit) => (lit ? B.lit.add(Mx, col) : litAdd(Mx, col));
  const place = []; // [prop, face, u, y, o, scale]
  const free = []; // free-standing props: [prop, Matrix4]
  for (const b of sv.blocks) facade(kind === 'gated' ? STYLE.gated : st, b, B, place, kind);
  if (kind === 'downtown') {
    for (const b of sv.blocks) { const f = faceOf(b, 0); for (const u of [-b.w / 2 + 0.8, b.w / 2 - 0.8]) if (Math.abs(u) > 1.9) free.push(['planter_box_01', f.put(u, 0, 0.75, 1.3, 1.3, 1.3)]); }
    const c = sv.domes[0]; if (c) for (const [dx, dz] of [[-48, -6], [44, 24]]) { const a = Math.atan2(-dx, -dz); free.push(['mars_billboard_curved', mtx(c.x + dx, c.y0 - 0.1, c.z + dz, 1, 1, 1, a)]); }
  }
  if (kind === 'rough') for (const b of sv.blocks) for (const [sx, sz] of [[1, 1], [-1, 1]]) if (rand() < 0.7) free.push(['burn_barrel', mtx(b.x + sx * (b.w / 2 + 0.7), b.y0, b.z + sz * (b.d / 2 + 0.9), 1.1, 1.1, 1.1, rand() * 6)]);
  const hidden = [];
  if (kind === 'gated') sv.domes.forEach((d, i) => free.push([VILLAS[i % VILLAS.length], null, d]));
  const g = new THREE.Group(); g.name = 'ssx-kit-' + kind; g.userData.ssxKit = true;
  for (const k of ['wall', 'glass', 'lit']) { const geo = B[k].geo(); if (geo) { const m = new THREE.Mesh(geo, M[k]); m.userData.ssxKit = true; m.receiveShadow = true; m.castShadow = k === 'wall'; g.add(m); } }
  // props: group placements per GLB, then one InstancedMesh per primitive
  const want = new Map();
  for (const [id, f, u, y, o, s] of place) { if (!want.has(id)) want.set(id, []); want.get(id).push(onFace(f, u, y, o, s, id)); }
  const villas = [];
  for (const [id, Mx, d] of free) { if (d) { villas.push([id, d]); continue; } if (!want.has(id)) want.set(id, []); want.get(id).push(Mx); }
  const ids = [...new Set([...want.keys(), ...villas.map(v => v[0])])];
  const loaded = Object.fromEntries(await Promise.all(ids.map(id => prop(S, id).then(x => [id, x], e => { S.stats.kitFails = (S.stats.kitFails || 0) + 1; console.warn('v8 models: kit ' + id, e); return [id, null]; }))));
  for (const [id, list] of want) if (loaded[id]) for (const im of instanced(loaded[id], list)) g.add(im);
  const vl = new Map();
  for (const [id, d] of villas) { const gl = loaded[id]; if (!gl) continue; const bb = new THREE.Box3().setFromObject(gl.scene), s = fitVilla(bb, d.r); if (!vl.has(id)) vl.set(id, []); vl.get(id).push(mtx(d.x, d.y0 + 0.9, d.z, s, s, s, 0)); for (const o of d.inner) { if (o.userData.__ssxKitVis === undefined) { o.userData.__ssxKitVis = o.visible; o.visible = false; hidden.push(o); } } }
  for (const [id, list] of vl) for (const im of instanced(loaded[id], list)) g.add(im);
  let draws = 0; g.traverse(o => { if (o.isMesh) draws++; });
  site.add(g);
  return { site, kind, group: g, hidden, draws, blocks: sv.blocks.length, domes: sv.domes.length, villas: villas.length, props: place.length + free.length - villas.length };
}
// ---------------------------------------------------------------- API used by models.js ----------------------------------------------------------------
export function updateKits(S, ctx, near) {
  const P = ctx.player; if (!P) return;
  for (const site of ctx.scene.children) {
    const id = site.userData?.v8?.site, kind = KITS[id]; if (!kind || S.kits.has(id)) continue;
    if (!site.userData.__kitC) { const d = site.children.find(o => o.userData?.v8?.part === 'dome'); if (!d) continue; site.userData.__kitC = { x: d.position.x, z: d.position.z }; }
    const c = site.userData.__kitC; if (Math.hypot(P.x - c.x, P.z - c.z) > near) continue;
    const k = { id, kind, site, ready: false }; S.kits.set(id, k);
    build(S, site, kind).then(r => { if (S.kits.get(id) !== k || !site.parent) { removeKit({ ...r, ready: true }); return; } Object.assign(k, r, { ready: true }); S.stats.kits++; S.stats.kitMeshes += r.draws; }, e => { k.failed = String(e); console.warn('v8 models: kit build ' + id, e); });
  }
  for (const [id, k] of S.kits) if (!k.site.parent) { removeKit(k); S.kits.delete(id); }
}
export function removeKit(k) {
  if (!k || !k.group) { if (k) k.dead = true; return; }
  k.group.removeFromParent(); k.group.traverse(o => { if (o.isMesh && !o.isInstancedMesh) o.geometry.dispose(); });
  for (const o of k.hidden || []) { o.visible = o.userData.__ssxKitVis; delete o.userData.__ssxKitVis; }
  k.hidden = []; k.group = null;
}
export function kitState(S) { const o = {}; for (const [id, k] of S.kits) o[id] = { kind: k.kind, ready: k.ready, draws: k.draws, blocks: k.blocks, domes: k.domes, villas: k.villas, props: k.props, failed: k.failed }; return o; }
export const KIT_PROPS = PROPS;
