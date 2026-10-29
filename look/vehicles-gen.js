// v8 realistic vehicles: procedural geometry + materials (no downloaded assets). Loaded lazily by look/vehicles.js.
// Every body is lofted from the same side profile the blocky v7 builder uses (rides.js SHAPES, models.js rover, world.js
// kinds), so the new skin sits exactly where the old boxes were: rounded-trapezoid sections (bevelled edges, tumblehome),
// wheel arches cut from the sill line, a glass greenhouse with roof skin and pillars, bumpers, grille, mirrors, lamps.
// Draws per vehicle: paint (clearcoat), trim (vertex-coloured plastic / rubber / chrome), glass, lamps, 1 per wheel,
// and at night one additive beam mesh (fake cone + ground pool). Geometry is cached per kind + size and shared.
// Paint shader (onBeforeCompile): Mars-dust grime from the sills up, streaks, roof dust, side decals (mud spray,
// scratches, bullet holes) from a canvas atlas, door seams, vertex dents + crumpled normals, burnt / charred + embers.
import * as THREE from 'three';

const V3 = THREE.Vector3;
// ---------------------------------------------------------------- geometry helpers ----------------------------------------------------------------
// merge non-indexed parts (position, normal, optional rgba colour) into one geometry
export function merge(parts, withColor) {
  let n = 0; const ps = [];
  for (const p of parts) { if (!p) continue; const g = p.g.index ? p.g.toNonIndexed() : p.g; if (p.m) g.applyMatrix4(p.m); ps.push([g, p.c]); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = withColor ? new Float32Array(n * 4) : null; let o = 0;
  for (const [g, c] of ps) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (col) { const cc = c || [1, 1, 1, 0]; for (let i = 0; i < g.attributes.position.count; i++) col.set(cc, (o + i) * 4); }
    o += g.attributes.position.count; g.dispose();
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 4)); out.computeBoundingSphere(); out.computeBoundingBox(); out.userData.shared = true; return out;
}
const M4 = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz));
// rounded box: subdivided box with every vertex pushed onto a radius-r shell around the inner box
export function rbox(w, h, d, r = 0.04, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2), p = g.attributes.position, v = new V3(), c = new V3();
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3); const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz)); v.sub(c); if (v.lengthSq() > 1e-12) v.setLength(r); p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z); }
  g.computeVertexNormals(); return g;
}
// a tube/box between two points (pillars, roll cage, rails)
function bar(a, b, t, round = true) {
  const d = new V3().subVectors(b, a), L = d.length(), g = round ? new THREE.CylinderGeometry(t, t, L, 8, 1) : rbox(t * 2, L, t * 2, t * 0.5, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  return { g, m: new THREE.Matrix4().compose(new V3().addVectors(a, b).multiplyScalar(0.5), q, new V3(1, 1, 1)) };
}
// piecewise-linear y(z) over a chain of [z, y] points (sorted by z), clamped at the ends
function chain(pts) { const P = pts.slice().sort((a, b) => a[0] - b[0]); return z => { if (z <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (z <= P[i][0]) { const [z0, y0] = P[i - 1], [z1, y1] = P[i]; return y0 + (y1 - y0) * (z - z0) / Math.max(1e-6, z1 - z0); } return P[P.length - 1][1]; }; }
// loft: sections are rounded trapezoids { z, hb (half width at the bottom), ht (top), y0, y1, rc }. Caps at both ends.
// Triangles are oriented outward one by one (side: away from the section centre, caps: -Z / +Z), then smooth normals.
export function loft(secs, kc = 4) {
  const pos = [], idx = [], ring = 4 * (kc + 1);
  for (const s of secs) {
    const rc = Math.max(0.005, Math.min(s.rc, (s.y1 - s.y0) * 0.48, Math.min(s.hb, s.ht) * 0.95));
    const C = [[s.hb - rc, s.y0 + rc, -Math.PI / 2], [s.ht - rc, s.y1 - rc, 0], [-(s.ht - rc), s.y1 - rc, Math.PI / 2], [-(s.hb - rc), s.y0 + rc, Math.PI]];
    for (const [cx, cy, a0] of C) for (let k = 0; k <= kc; k++) { const a = a0 + (k / kc) * Math.PI / 2; pos.push(cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, s.z); }
  }
  const nS = secs.length;
  for (let i = 0; i < nS - 1; i++) for (let j = 0; j < ring; j++) { const a = i * ring + j, b = i * ring + (j + 1) % ring, c = a + ring, d = b + ring; idx.push(a, b, c, b, d, c); }
  const capA = pos.length / 3; pos.push(0, (secs[0].y0 + secs[0].y1) / 2, secs[0].z);
  const capB = capA + 1; const L = secs[nS - 1]; pos.push(0, (L.y0 + L.y1) / 2, L.z);
  for (let j = 0; j < ring; j++) { idx.push(capA, (j + 1) % ring, j); const o = (nS - 1) * ring; idx.push(capB, o + j, o + (j + 1) % ring); }
  // orient each triangle outward
  const P = (i) => new V3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), nT = new V3(), e1 = new V3(), e2 = new V3();
  const nTri = idx.length / 3, sideTris = (nS - 1) * ring * 2;
  for (let t = 0; t < nTri; t++) {
    const A = P(idx[t * 3]), B = P(idx[t * 3 + 1]), Cc = P(idx[t * 3 + 2]);
    nT.crossVectors(e1.subVectors(B, A), e2.subVectors(Cc, A));
    let out;
    if (t < sideTris) { const si = Math.floor(t / (ring * 2)), s = secs[si], cen = new V3(0, (s.y0 + s.y1) / 2, (A.z + B.z + Cc.z) / 3); out = new V3().addVectors(A, B).add(Cc).multiplyScalar(1 / 3).sub(cen); out.z = 0; }
    else out = new V3(0, 0, (t - sideTris) % 2 === 0 ? (secs[0].z < L.z ? -1 : 1) : (secs[0].z < L.z ? 1 : -1));
    if (nT.dot(out) < 0) { const tmp = idx[t * 3 + 1]; idx[t * 3 + 1] = idx[t * 3 + 2]; idx[t * 3 + 2] = tmp; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const smoothArr = (a, n = 2) => { for (let k = 0; k < n; k++) { const b = a.slice(); for (let i = 1; i < a.length - 1; i++) a[i] = (b[i - 1] + b[i] * 2 + b[i + 1]) / 4; } return a; };

// ---------------------------------------------------------------- the car body ----------------------------------------------------------------
// P: { hull: [[z, y]...] (blocky side profile: nose bottom, top chain..., tail bottom), cab: [[z,y] x4] | null, W, wheels: [{x,z,r,y}],
//      tumble, rc, bev, sill (sill height override), plan (plan-view taper at the ends 0..1) }
function bodyFrame(P) {
  const hull = P.hull, zN = Math.min(hull[0][0], hull[1][0]), zT = Math.max(hull[hull.length - 1][0], hull[hull.length - 2][0]);
  const top = chain(hull.slice(1, -1)), yb = P.sill ?? Math.min(hull[0][1], hull[hull.length - 1][1]);
  const n = P.n || 34, zs = [], yt = [];
  for (let i = 0; i < n; i++) { const t = (1 - Math.cos(Math.PI * i / (n - 1))) / 2; zs.push(zN + (zT - zN) * t); yt.push(top(zN + (zT - zN) * t)); }
  smoothArr(yt, 3);
  const W2 = P.W / 2, bev = P.bev ?? 0.1, bevL = bev * 1.4, plan = P.plan ?? 0.2;
  const hwAt = z => { const t = (z - zN) / (zT - zN), e = Math.abs(2 * t - 1); return W2 * (1 - plan * Math.pow(e, 5)); };
  const ybAt = z => { let y = yb; for (const w of P.wheels || []) { const R = w.r + 0.07, dz = z - w.z; if (Math.abs(dz) < R) { const a = w.y + Math.sqrt(R * R - dz * dz) * 0.92; if (a > y) y = a; } } return y; };
  return { zN, zT, zs, yt, yb, hwAt, ybAt, bev, bevL, top: (z) => { let i = 0; while (i < zs.length - 1 && zs[i + 1] < z) i++; const t = (z - zs[i]) / Math.max(1e-6, zs[i + 1] - zs[i]); return yt[i] + (yt[Math.min(i + 1, zs.length - 1)] - yt[i]) * THREE.MathUtils.clamp(t, 0, 1); } };
}
function bodyLoft(F, P) {
  const secs = [];
  for (let i = 0; i < F.zs.length; i++) {
    const z = F.zs[i], d = Math.min(z - F.zN, F.zT - z), u = Math.min(1, d / F.bevL), inset = F.bev * (1 - Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))));
    const hw = F.hwAt(z), y0 = F.ybAt(z) + inset * 0.6, y1 = F.yt[i] - inset;
    if (y1 - y0 < 0.06) continue;
    secs.push({ z, hb: hw - inset, ht: hw * (P.tumble ?? 0.92) - inset, y0, y1, rc: P.rc ?? 0.16 });
  }
  return loft(secs, 4);
}
// greenhouse: glass loft over the cab polygon + roof skin + pillars (paint) + belt trim
function greenhouse(F, P, out) {
  const cab = P.cab; if (!cab) return null;
  const [b0, t0, t1, b1] = cab, z0 = b0[0], z3 = b1[0], top = chain([b0, t0, t1, b1]), n = 16, secs = [];
  const hwB = z => F.hwAt(z) * (P.tumble ?? 0.92) * 0.97 - 0.04, hwT = z => hwB(z) * (P.glassTop ?? 0.8);
  for (let i = 0; i < n; i++) { const t = (1 - Math.cos(Math.PI * i / (n - 1))) / 2, z = z0 + (z3 - z0) * t, y0 = F.top(z) - 0.04, y1 = Math.max(y0 + 0.05, top(z));
    secs.push({ z, hb: hwB(z), ht: hwT(z), y0, y1, rc: 0.09 }); }
  const glass = loft(secs, 3);
  const roofY = Math.max(t0[1], t1[1]);
  if (t1[0] - t0[0] > 0.25) { // roof skin: paint over the glass top, slightly proud
    const rs = []; for (let i = 0; i < 8; i++) { const t = i / 7, z = t0[0] - 0.06 + (t1[0] - t0[0] + 0.12) * t, y1 = top(z) + 0.03; rs.push({ z, hb: hwT(z) + 0.035, ht: hwT(z) * 0.94, y0: y1 - 0.075, y1, rc: 0.05 }); }
    out.paint.push({ g: loft(rs, 3) });
  }
  const th = 0.055;
  for (const s of [-1, 1]) {
    const yb0 = F.top(z0) - 0.02, yb1 = F.top(z3) - 0.02;
    out.paint.push(bar(new V3(s * hwB(z0 + 0.05), yb0, z0 + 0.05), new V3(s * hwT(t0[0]), top(t0[0]) - 0.02, t0[0]), th, false));                 // A pillar
    out.paint.push(bar(new V3(s * hwB(z3 - 0.05), yb1, z3 - 0.05), new V3(s * hwT(t1[0]), top(t1[0]) - 0.02, t1[0]), th * 1.6, false));            // C pillar
    if (t1[0] - t0[0] > 0.6 && !P.noB) { const zb = (t0[0] + t1[0]) / 2 - 0.1; out.paint.push(bar(new V3(s * hwB(zb), F.top(zb) - 0.02, zb), new V3(s * hwT(zb), top(zb) - 0.02, zb), th, false)); }
    // belt chrome / black strip along the glass bottom
    const zm = (z0 + z3) / 2, len = (z3 - z0) * 0.92; out.trim.push({ g: rbox(0.03, 0.035, len, 0.012, 1), m: M4(s * (hwB(zm) + 0.012), F.top(zm) + 0.0, zm), c: P.chromeBelt ? C.chrome : C.black });
    // mirror on the door just behind the A pillar base
    out.paint.push({ g: rbox(0.08, 0.12, 0.2, 0.04, 2), m: M4(s * (F.hwAt(z0) + 0.1), F.top(z0 + 0.25) + 0.05, z0 + 0.25) });
    out.trim.push({ g: rbox(0.12, 0.03, 0.05, 0.01, 1), m: M4(s * (F.hwAt(z0) + 0.03), F.top(z0 + 0.25) + 0.0, z0 + 0.27), c: C.black });
  }
  return { glass, z0, z3, roofY, top, hwB, hwT };
}
// ---------------------------------------------------------------- vertex colour palette (rgb + metal flag in a) ----------------------------------------------------------------
const hx = (h, a = 0) => { const c = new THREE.Color(h).convertSRGBToLinear(); return [c.r, c.g, c.b, a]; };
export const C = { black: hx(0x111214), rubber: hx(0x0b0b0c), plastic: hx(0x26282c), grey: hx(0x55595f), chrome: hx(0xd8dde4, 1), alu: hx(0xa8adb4, 1), gun: hx(0x3a3d42, 1),
  plate: hx(0xd9d6cc), ore: hx(0x6a3420), ore2: hx(0x8a4a2a), seat: hx(0x2b2522), head: hx(0xfff4dc, 1), tail: hx(0xff1810, 0.5), amber: hx(0xff8a10, 0), cyan: hx(0x40e0ff, 1), orange: hx(0xff6a20, 0.5), liner: hx(0x070708) };

// common front / rear furniture for a lofted body
function furniture(F, P, out, gh) {
  const zN = F.zN, zT = F.zT, hood = F.top(zN + 0.25), deck = F.top(zT - 0.2), hwN = F.hwAt(zN + 0.1), hwT = F.hwAt(zT - 0.1), yb = F.yb;
  const bumpY = yb + (P.bumpY ?? 0.13);
  // bumpers wrap the nose and tail
  out.trim.push({ g: rbox(hwN * 2 + 0.06, 0.2, 0.26, 0.08, 2), m: M4(0, bumpY, zN + 0.1), c: P.bumpChrome ? C.chrome : C.plastic });
  out.trim.push({ g: rbox(hwT * 2 + 0.06, 0.2, 0.26, 0.08, 2), m: M4(0, bumpY, zT - 0.1), c: P.bumpChrome ? C.chrome : C.plastic });
  // grille between the headlights + chrome surround, blank plates (no text)
  const gy = Math.min(hood - 0.14, bumpY + 0.26);
  out.trim.push({ g: rbox(hwN * 0.9, Math.max(0.1, (hood - bumpY) * 0.42), 0.06, 0.02, 1), m: M4(0, gy, zN + 0.02), c: C.black });
  for (let k = -2; k <= 2; k++) out.trim.push({ g: rbox(hwN * 0.86, 0.015, 0.03, 0.006, 1), m: M4(0, gy + k * 0.035, zN + 0.0), c: C.gun });
  out.trim.push({ g: rbox(0.42, 0.11, 0.03, 0.01, 1), m: M4(0, bumpY + 0.02, zN - 0.04), c: C.plate });
  out.trim.push({ g: rbox(0.42, 0.11, 0.03, 0.01, 1), m: M4(0, Math.min(deck - 0.2, bumpY + 0.22), zT + 0.03), c: C.plate });
  // lamps: headlights (white, a=1), tail (red), indicators (amber)
  const hy = Math.max(bumpY + 0.2, hood - 0.13), ty = Math.max(bumpY + 0.22, deck - 0.14);
  for (const s of [-1, 1]) {
    out.lamps.push({ g: rbox(0.34, 0.12, 0.08, 0.04, 2), m: M4(s * hwN * 0.7, hy, zN + 0.07), c: C.head });
    out.trim.push({ g: rbox(0.38, 0.15, 0.06, 0.04, 2), m: M4(s * hwN * 0.7, hy, zN + 0.1), c: C.chrome });
    out.lamps.push({ g: rbox(0.1, 0.06, 0.06, 0.02, 1), m: M4(s * hwN * 0.94, hy - 0.02, zN + 0.12), c: C.amber });
    out.lamps.push({ g: rbox(0.36, 0.11, 0.07, 0.035, 2), m: M4(s * hwT * 0.74, ty, zT - 0.05), c: C.tail });
    out.trim.push({ g: new THREE.CylinderGeometry(0.045, 0.05, 0.22, 10, 1, true), m: M4(s * hwT * 0.55, yb + 0.06, zT + 0.02, 1, 1, 1, Math.PI / 2), c: C.chrome }); // exhausts
  }
  // side skirt + door handles + door seams (seams are drawn by the paint shader)
  for (const s of [-1, 1]) {
    const zc = (zN + zT) / 2, L = (zT - zN) * 0.55; out.trim.push({ g: rbox(0.06, 0.09, L, 0.03, 1), m: M4(s * (F.hwAt(zc) - 0.01), yb + 0.08, zc), c: C.plastic });
    if (gh) for (const z of P.handles || [gh.z0 + (gh.z3 - gh.z0) * 0.42]) out.trim.push({ g: rbox(0.03, 0.035, 0.16, 0.012, 1), m: M4(s * (F.hwAt(z) + 0.0), F.top(z) - 0.16, z), c: C.chrome });
  }
  // arch liners: dark half rings around each wheel on both sides
  for (const w of P.wheels || []) for (const s of [-1, 1]) {
    const t = new THREE.TorusGeometry(w.r + 0.05, 0.045, 5, 14, Math.PI); t.rotateY(Math.PI / 2);
    out.trim.push({ g: t, m: M4(s * (F.hwAt(w.z) - 0.02), w.y, w.z), c: C.liner });
  }
  // underbody (hides the hollow look from low cameras)
  out.trim.push({ g: new THREE.BoxGeometry(F.hwAt(0) * 1.9, 0.05, (zT - zN) * 0.92), m: M4(0, yb + 0.03, (zN + zT) / 2), c: C.black });
  return { head: { x: hwN * 0.7, y: hy, z: zN }, tail: { x: hwT * 0.74, y: ty, z: zT } };
}

// ---------------------------------------------------------------- archetypes ----------------------------------------------------------------
// each returns { paint, trim, glass, lamps, meta } geometries; P comes from the blocky vehicle (see look/vehicles.js fit())
export const ARCH = {
  car(P) {
    const out = { paint: [], trim: [], glass: [], lamps: [] }, F = bodyFrame(P);
    out.paint.push({ g: bodyLoft(F, P) });
    const gh = greenhouse(F, P, out); if (gh) out.glass.push({ g: gh.glass });
    const lamp = furniture(F, P, out, gh);
    if (P.spoiler) { const z = F.zT - 0.3, y = F.top(z); out.paint.push({ g: rbox(P.W - 0.25, 0.05, 0.34, 0.02, 1), m: M4(0, y + 0.2, z) }); for (const s of [-1, 1]) out.trim.push({ g: rbox(0.05, 0.2, 0.1, 0.02, 1), m: M4(s * (P.W / 2 - 0.45), y + 0.09, z), c: C.black }); }
    if (P.bed) { // pickup bed: hollow look via a dark floor + rails + an ore load
      const z0 = (P.cab ? P.cab[3][0] : 0) + 0.15, z1 = F.zT - 0.15, y = F.top((z0 + z1) / 2);
      out.trim.push({ g: rbox(P.W - 0.36, 0.06, z1 - z0, 0.02, 1), m: M4(0, y + 0.01, (z0 + z1) / 2), c: C.black });
      for (const s of [-1, 1]) out.trim.push({ g: rbox(0.06, 0.06, z1 - z0, 0.02, 1), m: M4(s * (P.W / 2 - 0.14), y + 0.05, (z0 + z1) / 2), c: C.alu });
    }
    if (P.ore) { const z0 = P.ore[0], z1 = P.ore[1], y = F.top((z0 + z1) / 2); const g = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), yy = p.getY(i), z = p.getZ(i); const k = 1 + 0.18 * Math.sin(x * 9.1 + z * 5.3) * Math.cos(z * 7.7 - x * 3.1); p.setXYZ(i, x * k, yy * k, z * k); } g.computeVertexNormals();
      out.trim.push({ g, m: M4(0, y - 0.05, (z0 + z1) / 2, P.W / 2 - 0.2, 0.55, (z1 - z0) / 2), c: C.ore });
      for (const s of [-1, 1]) out.paint.push({ g: rbox(0.08, 0.5, z1 - z0 + 0.1, 0.03, 1), m: M4(s * (P.W / 2 - 0.08), y + 0.2, (z0 + z1) / 2) }); // bed walls
      out.paint.push({ g: rbox(P.W - 0.1, 0.55, 0.08, 0.03, 1), m: M4(0, y + 0.22, z1 + 0.03) }); }
    if (P.bullbar) { const z = F.zN - 0.12, y = F.yb + 0.35; out.trim.push(bar(new V3(-P.W / 2 + 0.15, y, z), new V3(P.W / 2 - 0.15, y, z), 0.05)); out.trim.push(bar(new V3(-P.W / 2 + 0.25, y + 0.45, z + 0.05), new V3(P.W / 2 - 0.25, y + 0.45, z + 0.05), 0.04));
      for (const s of [-1, 1]) out.trim.push(bar(new V3(s * (P.W / 2 - 0.3), F.yb + 0.1, z + 0.02), new V3(s * (P.W / 2 - 0.3), y + 0.5, z + 0.06), 0.04)); out.trim.forEach(t => { t.c ||= C.gun; }); }
    if (P.rack && gh) { const y = gh.roofY + 0.12, z0 = P.cab[1][0], z1 = P.cab[2][0]; for (const s of [-1, 1]) out.trim.push({ ...bar(new V3(s * 0.55, y, z0 + 0.1), new V3(s * 0.55, y, z1 - 0.1), 0.025), c: C.gun });
      for (let i = 0; i < 4; i++) out.lamps.push({ g: rbox(0.2, 0.12, 0.08, 0.03, 1), m: M4(-0.45 + i * 0.3, y + 0.06, z0 + 0.05), c: C.head }); }
    if (P.rover) { // pressurised rover: rear canopy hatch, mast + dish, roof light bar, airlock ring, side tanks
      const z = 1.6; out.trim.push({ ...bar(new V3(0.8, gh ? gh.roofY - 0.1 : 2.3, z), new V3(0.8, 3.0, z), 0.03), c: C.alu });
      const d = new THREE.SphereGeometry(0.3, 14, 6, 0, Math.PI * 2, 0, 1.0); out.trim.push({ g: d, m: M4(0.8, 3.0, z, 1, 1, 1, -0.6), c: C.alu });
      out.lamps.push({ g: rbox(1.9, 0.1, 0.12, 0.04, 2), m: M4(0, 2.82, -0.7), c: C.head });
      for (const s of [-1, 1]) out.trim.push({ g: new THREE.CylinderGeometry(0.2, 0.2, 1.6, 12), m: M4(s * (P.W / 2 + 0.05), 1.3, 1.6, 1, 1, 1, Math.PI / 2), c: C.alu });
      const ring = new THREE.TorusGeometry(0.55, 0.06, 6, 20); out.trim.push({ g: ring, m: M4(0, 1.45, F.zT + 0.02), c: C.gun });
    }
    if (P.pads) for (const [x, z] of P.pads) { out.trim.push({ g: new THREE.CylinderGeometry(0.46, 0.52, 0.16, 16), m: M4(x, 0.3, z), c: C.gun }); out.lamps.push({ g: new THREE.CylinderGeometry(0.38, 0.38, 0.03, 16), m: M4(x, 0.21, z), c: C.cyan }); }
    return { out, meta: { ...lamp, frame: F, smoke: [0, F.top(F.zN + 0.5) + 0.1, F.zN + 0.6], fire: [0, F.top(0) + 0.2, (F.zN + F.zT) * 0.5 - 0.3] } };
  },
  // open dune buggy: low tub, tube cage, seats, exposed engine, light pod
  buggy(P) {
    const out = { paint: [], trim: [], glass: [], lamps: [] };
    const F = bodyFrame({ ...P, hull: [[-1.5, 0.62], [-1.56, 0.95], [-1.0, 1.08], [-0.4, 1.12], [0.75, 1.1], [1.45, 1.2], [1.5, 0.62]], rc: 0.14, plan: 0.3, tumble: 0.85 });
    out.paint.push({ g: bodyLoft(F, { ...P, rc: 0.14, tumble: 0.85 }) });
    const cage = [[-0.62, 1.1, -0.55], [0.62, 1.1, -0.55], [-0.6, 2.28, 0.05], [0.6, 2.28, 0.05], [-0.62, 1.15, 0.85], [0.62, 1.15, 0.85], [-0.56, 2.3, 0.5], [0.56, 2.3, 0.5]].map(a => new V3(...a));
    const T = (a, b) => out.trim.push({ ...bar(cage[a], cage[b], 0.04), c: C.gun });
    T(0, 2); T(1, 3); T(2, 3); T(6, 7); T(2, 6); T(3, 7); T(4, 6); T(5, 7); T(0, 1); T(4, 5);
    for (const s of [-1, 1]) { out.trim.push({ g: rbox(0.5, 0.12, 0.5, 0.05, 2), m: M4(s * 0.33, 1.12, 0.35), c: C.seat }); out.trim.push({ g: rbox(0.48, 0.62, 0.12, 0.05, 2), m: M4(s * 0.33, 1.45, 0.62, 1, 1, 1, -0.18), c: C.seat }); }
    out.trim.push({ g: rbox(0.9, 0.42, 0.6, 0.06, 2), m: M4(0, 1.25, 1.12), c: C.grey }); // engine
    for (const s of [-1, 1]) out.trim.push({ ...bar(new V3(s * 0.2, 1.3, 1.3), new V3(s * 0.32, 1.55, 1.62), 0.05), c: C.chrome });
    out.trim.push({ g: rbox(1.5, 0.16, 0.16, 0.06, 2), m: M4(0, 0.75, -1.58), c: C.gun }); // nudge bar
    out.trim.push({ g: new THREE.TorusGeometry(0.36, 0.13, 8, 18), m: M4(0, 1.45, 1.55, 1, 1, 1, 0, 0, 0), c: C.rubber }); // spare
    out.trim.push({ g: new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), m: M4(0, 1.15, 0.0, 1, 1, 1, -0.5), c: C.black }); // steering wheel
    for (let i = 0; i < 4; i++) out.lamps.push({ g: new THREE.CylinderGeometry(0.09, 0.1, 0.1, 12), m: M4(-0.45 + i * 0.3, 2.36, 0.0, 1, 1, 1, Math.PI / 2), c: C.head });
    for (const s of [-1, 1]) { out.lamps.push({ g: rbox(0.22, 0.1, 0.06, 0.03, 1), m: M4(s * 0.55, 0.98, -1.53), c: C.head }); out.lamps.push({ g: rbox(0.16, 0.08, 0.05, 0.02, 1), m: M4(s * 0.62, 1.05, 1.5), c: C.tail }); }
    for (const w of P.wheels || []) for (const s of [-1, 1]) { const t = new THREE.TorusGeometry(w.r + 0.06, 0.05, 5, 12, Math.PI); t.rotateY(Math.PI / 2); out.trim.push({ g: t, m: M4(s * (F.hwAt(w.z) + 0.02), w.y, w.z), c: C.liner }); }
    return { out, meta: { head: { x: 0.55, y: 0.98, z: -1.55 }, tail: { x: 0.62, y: 1.05, z: 1.5 }, frame: F, smoke: [0, 1.5, 1.1], fire: [0, 1.4, 0.6] } };
  },
  // hover bike: fairing, seat, bars, thruster rings
  bike(P) {
    const out = { paint: [], trim: [], glass: [], lamps: [] };
    const F = bodyFrame({ W: 0.62, hull: [[-1.15, 0.55], [-1.2, 0.82], [-0.75, 1.12], [-0.2, 1.0], [0.55, 1.02], [1.05, 0.98], [1.15, 0.62]], rc: 0.2, plan: 0.45, tumble: 0.7, bev: 0.08 });
    out.paint.push({ g: bodyLoft(F, { rc: 0.2, tumble: 0.7 }) });
    out.glass.push({ g: rbox(0.46, 0.3, 0.06, 0.05, 2), m: M4(0, 1.22, -0.75, 1, 1, 1, -0.6) });
    out.trim.push({ g: rbox(0.36, 0.12, 0.7, 0.05, 2), m: M4(0, 1.06, 0.55), c: C.seat });
    out.trim.push({ ...bar(new V3(-0.38, 1.2, -0.45), new V3(0.38, 1.2, -0.45), 0.025), c: C.gun });
    for (const z of [-0.8, 0.8]) { out.trim.push({ g: new THREE.TorusGeometry(0.34, 0.07, 8, 20), m: M4(0, 0.45, z, 1, 1, 1, Math.PI / 2), c: C.gun }); out.lamps.push({ g: new THREE.CylinderGeometry(0.28, 0.28, 0.03, 18), m: M4(0, 0.4, z), c: C.cyan }); }
    out.lamps.push({ g: rbox(0.2, 0.09, 0.06, 0.03, 1), m: M4(0, 0.95, -1.17), c: C.head }); out.lamps.push({ g: rbox(0.3, 0.07, 0.05, 0.02, 1), m: M4(0, 0.92, 1.14), c: C.tail });
    out.trim.push({ g: new THREE.CylinderGeometry(0.09, 0.11, 0.3, 12, 1, true), m: M4(0, 0.78, 1.18, 1, 1, 1, Math.PI / 2), c: C.chrome });
    return { out, meta: { head: { x: 0, y: 0.95, z: -1.17 }, tail: { x: 0.1, y: 0.92, z: 1.14 }, frame: F, smoke: [0, 1.0, 0.9], fire: [0, 0.9, 0.2], single: true } };
  },
  // shuttle skimmer: lifting-body fuselage, canopy, swept wings, engine pods
  skimmer(P) {
    const out = { paint: [], trim: [], glass: [], lamps: [] };
    const F = bodyFrame({ W: 2.9, hull: [[-3.35, 1.05], [-3.45, 1.55], [-2.4, 2.1], [-0.5, 2.45], [1.6, 2.45], [3.3, 2.0], [3.4, 1.05]], rc: 0.55, plan: 0.6, tumble: 0.8, bev: 0.25, n: 40 });
    out.paint.push({ g: bodyLoft(F, { rc: 0.55, tumble: 0.8 }) });
    const gh = greenhouse(F, { cab: [[-2.45, 2.02], [-1.5, 2.72], [-0.3, 2.78], [0.5, 2.4]], tumble: 0.8, glassTop: 0.62, noB: true }, out); out.glass.push({ g: gh.glass });
    const wing = new THREE.Shape([new THREE.Vector2(0, -0.9), new THREE.Vector2(3.0, 0.2), new THREE.Vector2(3.0, 0.75), new THREE.Vector2(0, 1.2)].map(v => v));
    for (const s of [-1, 1]) { const g = new THREE.ExtrudeGeometry(wing, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 2 }); g.rotateX(Math.PI / 2); g.translate(0, 0.05, 0);
      out.paint.push({ g, m: M4(s * 1.2, 1.4, 0.4, s, 1, 1) });
      const pod = new THREE.LatheGeometry([[0.01, -1], [0.3, -0.85], [0.42, -0.3], [0.42, 0.7], [0.35, 0.95], [0.3, 1.0]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
      out.trim.push({ g: pod, m: M4(s * 2.6, 1.2, 0.6, 1, 1, 1, Math.PI / 2), c: C.alu });
      out.lamps.push({ g: new THREE.CircleGeometry(0.29, 16), m: M4(s * 2.6, 1.2, 1.61), c: C.orange });
      out.lamps.push({ g: rbox(0.12, 0.08, 0.3, 0.03, 1), m: M4(s * 4.15, 1.45, 0.45), c: s < 0 ? hx(0xff2020, 0.5) : hx(0x20ff40, 0.5) }); }
    const noz = new THREE.LatheGeometry([[0.62, -0.3], [0.5, 0.0], [0.62, 0.35]].map(([r, y]) => new THREE.Vector2(r, y)), 16); out.trim.push({ g: noz, m: M4(0, 1.6, 3.35, 1, 1, 1, Math.PI / 2), c: C.gun });
    out.lamps.push({ g: new THREE.CircleGeometry(0.5, 18), m: M4(0, 1.6, 3.45), c: C.orange });
    for (const s of [-1, 1]) out.lamps.push({ g: rbox(0.36, 0.1, 0.08, 0.04, 2), m: M4(s * 0.7, 1.55, -3.38), c: C.head });
    return { out, meta: { head: { x: 0.7, y: 1.55, z: -3.4 }, tail: { x: 0.7, y: 1.6, z: 3.4 }, frame: F, smoke: [0, 2.3, 1.6], fire: [0, 2.2, 0.8] } };
  }
};

// ---------------------------------------------------------------- wheel (radius 1, width 1, rim faces +X) ----------------------------------------------------------------
let WHEEL = null;
export function wheelGeo() {
  if (WHEEL) return WHEEL;
  const parts = [];
  const prof = [[0.64, -0.45], [0.8, -0.5], [0.93, -0.47], [0.99, -0.38], [1.0, -0.2], [1.0, 0.2], [0.99, 0.38], [0.93, 0.47], [0.8, 0.5], [0.64, 0.45]].map(([r, x]) => new THREE.Vector2(r, x));
  const tire = new THREE.LatheGeometry(prof, 28); tire.rotateZ(-Math.PI / 2); parts.push({ g: tire, c: C.rubber });
  const rim = new THREE.CylinderGeometry(0.64, 0.64, 0.82, 24, 1, true); rim.rotateZ(Math.PI / 2); parts.push({ g: rim, c: C.gun });
  const face = new THREE.CircleGeometry(0.62, 24); face.rotateY(Math.PI / 2); parts.push({ g: face, m: M4(0.3, 0, 0), c: C.black });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; parts.push({ g: rbox(0.08, 0.5, 0.11, 0.03, 1), m: M4(0.36, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 1, 1, 1, a, 0, 0), c: C.alu }); }
  const lip = new THREE.TorusGeometry(0.62, 0.035, 6, 28); lip.rotateY(Math.PI / 2); parts.push({ g: lip, m: M4(0.4, 0, 0), c: C.alu });
  const hub = new THREE.CylinderGeometry(0.14, 0.16, 0.12, 12); hub.rotateZ(Math.PI / 2); parts.push({ g: hub, m: M4(0.38, 0, 0), c: C.chrome });
  const disc = new THREE.CylinderGeometry(0.5, 0.5, 0.04, 20); disc.rotateZ(Math.PI / 2); parts.push({ g: disc, m: M4(0.05, 0, 0), c: C.grey });
  WHEEL = merge(parts, true); return WHEEL;
}

// beams (fake headlight cones + ground pool) for one vehicle: attribute aF = brightness, aK = 0 cone / 1 pool
export function beamGeo(head, groundY) {
  const parts = [], L = 10, push = (g, m, k) => { g = g.index ? g.toNonIndexed() : g; if (m) g.applyMatrix4(m); const n = g.attributes.position.count, F = new Float32Array(n), K = new Float32Array(n); const p = g.attributes.position;
    for (let i = 0; i < n; i++) { if (k === 0) { F[i] = THREE.MathUtils.clamp(1 - (head.z - p.getZ(i)) / L, 0, 1); } else F[i] = 1; K[i] = k; }
    g.setAttribute('aF', new THREE.BufferAttribute(F, 1)); g.setAttribute('aK', new THREE.BufferAttribute(K, 1)); g.deleteAttribute('normal'); parts.push(g); };
  const xs = head.x > 0.2 ? [-head.x, head.x] : [0];
  for (const x of xs) { const c = new THREE.ConeGeometry(1.6, L, 14, 1, true); c.translate(0, -L / 2, 0); c.rotateX(Math.PI / 2 - 0.09); push(c, M4(x, head.y, head.z - 0.05), 0); }
  const q = new THREE.PlaneGeometry(1, 1); q.rotateX(-Math.PI / 2); push(q, M4(0, groundY + 0.06, head.z - 6.5, 5.5, 1, 9), 1);
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), F = new Float32Array(n), K = new Float32Array(n); let o = 0;
  for (const g of parts) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); uv.set(g.attributes.uv.array, o * 2); F.set(g.attributes.aF.array, o); K.set(g.attributes.aK.array, o); o += c; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('aF', new THREE.BufferAttribute(F, 1)); out.setAttribute('aK', new THREE.BufferAttribute(K, 1)); out.computeBoundingSphere(); return out;
}

// ---------------------------------------------------------------- materials ----------------------------------------------------------------
const NOISE = `
float vh31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vh31(i), vh31(i + vec3(1,0,0)), f.x), mix(vh31(i + vec3(0,1,0)), vh31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(vh31(i + vec3(0,0,1)), vh31(i + vec3(1,0,1)), f.x), mix(vh31(i + vec3(0,1,1)), vh31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float vfbm(vec3 p){ return vn3(p) * 0.55 + vn3(p * 2.1 + 3.7) * 0.3 + vn3(p * 4.3 + 7.1) * 0.15; }`;
let decalTex = null;
// decal atlas (512 x 256, 4 x 2 cells): mud spray, mud spray 2, scratches, bullet holes, crack star, stripe, roundel (no text), soot
export function decalAtlas() {
  if (decalTex) return decalTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); let s = 7;
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cell = (i, f) => { x.save(); x.translate((i % 4) * 128, Math.floor(i / 4) * 128); x.beginPath(); x.rect(0, 0, 128, 128); x.clip(); f(); x.restore(); };
  const mud = () => { for (let k = 0; k < 220; k++) { const px = R() * 128, py = 128 - Math.pow(R(), 1.8) * 120, r = 1 + R() * 6 * (py / 128); x.fillStyle = `rgba(255,255,255,${0.35 + R() * 0.6})`; x.beginPath(); x.ellipse(px, py, r * (1 + R()), r, R() * 3, 0, 7); x.fill(); } };
  cell(0, mud); cell(1, mud);
  cell(2, () => { x.strokeStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < 26; k++) { x.lineWidth = 0.6 + R() * 1.6; x.beginPath(); const y0 = R() * 128; x.moveTo(R() * 30, y0); x.bezierCurveTo(40, y0 + R() * 20 - 10, 80, y0 + R() * 20 - 10, 100 + R() * 28, y0 + R() * 30 - 15); x.stroke(); } });
  cell(3, () => { for (let k = 0; k < 7; k++) { const px = 15 + R() * 98, py = 15 + R() * 98, g = x.createRadialGradient(px, py, 0, px, py, 9); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - 10, py - 10, 20, 20); } });
  cell(4, () => { x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 1.2; for (let k = 0; k < 14; k++) { x.beginPath(); x.moveTo(64, 64); let px = 64, py = 64; const a = R() * 7; for (let j = 0; j < 5; j++) { px += Math.cos(a + R() - 0.5) * 12; py += Math.sin(a + R() - 0.5) * 12; x.lineTo(px, py); } x.stroke(); } });
  cell(5, () => { x.fillStyle = 'rgba(255,255,255,1)'; x.fillRect(0, 40, 128, 16); x.fillRect(0, 62, 128, 6); });
  cell(6, () => { x.fillStyle = 'rgba(255,255,255,1)'; x.beginPath(); x.arc(64, 64, 44, 0, 7); x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(64, 64, 34, 0, 7); x.fill(); x.fillRect(58, 36, 12, 56); });
  cell(7, () => { for (let k = 0; k < 160; k++) { const px = R() * 128, py = R() * 128 * 0.7, r = 3 + R() * 14, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } });
  decalTex = new THREE.CanvasTexture(c); decalTex.colorSpace = THREE.NoColorSpace; decalTex.generateMipmaps = true; decalTex.userData.shared = true; return decalTex;
}
// paint: MeshPhysicalMaterial with clearcoat (med+) or MeshStandard (low). U.* uniforms are per material (cached per look).
// d: { color, metal, rough, dirt 0..1, dent 0..1, burn 0..1, seed, frame: { zN, zT, yb, top, seams[] }, decal (0 none, 1 stripe, 2 roundel), clear }
export function paintMaterial(d, phys) {
  const o = { color: d.color, metalness: d.metal, roughness: d.rough, envMapIntensity: 1.0 };
  const m = phys ? new THREE.MeshPhysicalMaterial({ ...o, clearcoat: d.clear ?? 1, clearcoatRoughness: 0.06 }) : new THREE.MeshStandardMaterial(o);
  const U = { uDirt: { value: d.dirt }, uDent: { value: d.dent }, uBurn: { value: d.burn }, uEmber: { value: 0 }, uSeed: { value: d.seed || 0 }, uDecal: { value: decalAtlas() },
    uBox: { value: new THREE.Vector4(d.frame.zN, d.frame.zT, d.frame.yb, d.frame.yt) }, uSeams: { value: new THREE.Vector4(...(d.frame.seams || [99, 99, 99, 99]).concat([99, 99, 99, 99]).slice(0, 4)) },
    uBelt: { value: d.frame.belt ?? 9 }, uDecalK: { value: d.decal || 0 }, uDecalC: { value: new THREE.Color(d.decalColor ?? 0xf2f2ee) } };
  m.userData.U = U; m.userData.weathered = true; m.userData.ssxVeh = true;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uDent; uniform float uSeed;\nvarying vec3 vOP; varying vec3 vON;${NOISE}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vOP = position; vON = normal;
if (uDent > 0.0) { float dn = smoothstep(0.42, 0.85, vn3(position * 2.3 + uSeed)); transformed -= normal * dn * uDent * 0.09; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uDirt; uniform float uDent; uniform float uBurn; uniform float uEmber; uniform float uSeed; uniform sampler2D uDecal; uniform vec4 uBox; uniform vec4 uSeams; uniform float uBelt; uniform float uDecalK; uniform vec3 uDecalC;
varying vec3 vOP; varying vec3 vON; float vDirtK; float vScr;${NOISE}
float atl(vec2 uv, float cell){ if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0; vec2 o = vec2(mod(cell, 4.0), floor(cell / 4.0)) * vec2(0.25, 0.5); return texture2D(uDecal, o + uv * vec2(0.25, 0.5)).a * texture2D(uDecal, o + uv * vec2(0.25, 0.5)).r; }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
if (uDent > 0.05) { vec3 fdx = dFdx(vViewPosition), fdy = dFdy(vViewPosition); vec3 fn = normalize(cross(fdx, fdy)); float dn = smoothstep(0.42, 0.85, vn3(vOP * 2.3 + uSeed)); normal = normalize(mix(normal, fn, clamp(dn * uDent * 1.4, 0.0, 0.85))); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ float L = max(0.01, uBox.y - uBox.x), H = max(0.01, uBox.w - uBox.z), h = clamp((vOP.y - uBox.z) / H, 0.0, 1.0), side = smoothstep(0.55, 0.8, abs(vON.x));
  vec2 suv = vec2((vOP.z - uBox.x) / L, h);
  float n = vfbm(vOP * vec3(3.0, 5.0, 3.0) + uSeed);
  float dirt = (1.0 - smoothstep(0.05, 0.62, h + n * 0.25 - 0.12)) * (0.55 + 0.45 * n);
  float streak = smoothstep(0.62, 0.9, vn3(vec3(vOP.x * 9.0, vOP.y * 0.7, vOP.z * 9.0) + uSeed)) * (1.0 - h) * side;
  float dust = smoothstep(0.6, 0.95, vON.y) * smoothstep(0.35, 0.75, n);
  float mud = 0.0; if (side > 0.0) { mud = max(atl(vec2(fract(suv.x * 2.0) , suv.y * 1.6), 0.0), atl(vec2(fract(suv.x * 2.0 + 0.5), suv.y * 1.5), 1.0)) * side; }
  vDirtK = clamp((dirt * 0.9 + streak * 0.5 + dust * 0.45 + mud * 0.8) * uDirt, 0.0, 1.0);
  vec3 dustC = vec3(0.36, 0.17, 0.09) * (0.75 + 0.5 * n);
  // livery decal (stripe / roundel) on the sides, only on clean-ish cars
  if (uDecalK > 0.5 && side > 0.0) { float dk = uDecalK < 1.5 ? atl(vec2(fract(suv.x * 1.0), (h - 0.25) * 2.0), 5.0) : atl(vec2((suv.x - 0.42) * 3.2, (h - 0.12) * 1.4), 6.0); diffuseColor.rgb = mix(diffuseColor.rgb, uDecalC, dk * side); }
  // door seams: thin dark cuts below the belt line
  float seam = 0.0; for (int i = 0; i < 4; i++) seam = max(seam, 1.0 - smoothstep(0.004, 0.011, abs(vOP.z - uSeams[i]))); seam *= side * step(vOP.y, uBelt) * step(uBox.z + 0.12, vOP.y);
  diffuseColor.rgb *= 1.0 - seam * 0.7;
  // damage: scratches to primer, bullet holes, cracks
  vScr = 0.0;
  if (uDent > 0.05) { float sc = atl(vec2(fract(suv.x * 2.3 + uSeed * 0.1), h * 1.2), 2.0) * side * smoothstep(0.1, 0.5, uDent);
    float holes = atl(vec2(fract(suv.x * 3.0 + uSeed * 0.37), h * 1.6 - 0.2), 3.0) * side * smoothstep(0.35, 0.7, uDent);
    vScr = max(sc, holes); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.56, 0.58), sc * 0.8); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02), holes); }
  diffuseColor.rgb = mix(diffuseColor.rgb, dustC, vDirtK * 0.88);
  if (uBurn > 0.0) { float ch = smoothstep(0.2, 0.8, vfbm(vOP * 2.2 + 11.0)); vec3 burnt = mix(vec3(0.025, 0.022, 0.02), vec3(0.22, 0.1, 0.05), ch * 0.6); diffuseColor.rgb = mix(diffuseColor.rgb, burnt, uBurn); vDirtK = max(vDirtK, uBurn); } }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + vDirtK * 0.55 + vScr * 0.3, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, vDirtK * 0.8);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= (1.0 - vDirtK) * (1.0 - vScr);\n#endif')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uEmber > 0.0) { float e = smoothstep(0.68, 0.82, vfbm(vOP * 3.1 + 5.0)) * uEmber; totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * e * 2.5; }`);
  };
  m.customProgramCacheKey = () => 'ssxveh-paint' + (phys ? 'p' : 's');
  return m;
}
// trim + wheels: vertex colour rgb, alpha = metal flag (chrome / alu); tread grooves on the wheel material
export function trimMaterial(kind = 'trim', burnt = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
  m.userData.weathered = true; m.userData.ssxVeh = true; const U = { uBurnt: { value: burnt ? 1 : 0 } }; m.userData.U = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <color_pars_vertex>', 'varying vec4 vC4; varying vec3 vOP;')
      .replace('#include <color_vertex>', 'vC4 = color; vOP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_pars_fragment>', `varying vec4 vC4; varying vec3 vOP; uniform float uBurnt;${NOISE}`)
      .replace('#include <color_fragment>', `diffuseColor.rgb *= vC4.rgb;
${kind === 'wheel' ? 'float rr = length(vOP.yz); float ang = atan(vOP.z, vOP.y); float tread = step(0.955, rr) * step(abs(vOP.x), 0.42) * step(0.5, fract(ang * 9.5493 + step(0.0, vOP.x) * 0.5)) * step(abs(vOP.x), 0.4); diffuseColor.rgb *= 1.0 - tread * 0.55;' : ''}
if (uBurnt > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.028, 0.026), 0.85 * smoothstep(0.2, 0.6, vfbm(vOP * 3.0)) + 0.1);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.82, 0.22, vC4.a > 0.75 ? 1.0 : 0.0); if (uBurnt > 0.5) roughnessFactor = 1.0;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vC4.a > 0.75 && uBurnt < 0.5 ? 1.0 : 0.0;');
  };
  m.customProgramCacheKey = () => 'ssxveh-' + kind;
  return m;
}
// lamps: emissive by vertex colour; alpha picks the channel (1 head, 0.5 tail / nav, 0 indicator). uHead / uTail shared.
export const LAMP_U = { uHead: { value: 0.3 }, uTail: { value: 0.5 }, uBlink: { value: 0 } };
export function lampMaterial(dead = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0, emissive: 0xffffff });
  m.userData.weathered = true; m.userData.ssxVeh = true;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, LAMP_U);
    sh.vertexShader = sh.vertexShader.replace('#include <color_pars_vertex>', 'varying vec4 vC4;').replace('#include <color_vertex>', 'vC4 = color;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_pars_fragment>', 'varying vec4 vC4; uniform float uHead; uniform float uTail; uniform float uBlink;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vC4.rgb * 0.6;')
      .replace('#include <emissivemap_fragment>', dead ? 'totalEmissiveRadiance = vec3(0.0); diffuseColor.rgb *= 0.15;' : 'totalEmissiveRadiance = vC4.rgb * (vC4.a > 0.75 ? uHead : vC4.a > 0.25 ? uTail : uBlink);');
  };
  m.customProgramCacheKey = () => 'ssxveh-lamp' + (dead ? 'd' : '');
  return m;
}
export function glassMaterial(phys) {
  const m = new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.72, envMapIntensity: 1.6, depthWrite: true });
  m.userData.weathered = true; m.userData.ssxVeh = true; return m;
}
export const BEAM_U = { uK: { value: 0 } };
export function beamMaterial() {
  const m = new THREE.ShaderMaterial({ uniforms: BEAM_U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float aF; attribute float aK; varying float vF; varying float vK; varying vec2 vUv; void main(){ vF = aF; vK = aK; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; varying float vF; varying float vK; varying vec2 vUv; void main(){ float a; if (vK > 0.5) { vec2 p = vUv * 2.0 - 1.0; p.y = p.y * 1.0; a = (1.0 - smoothstep(0.0, 1.0, length(p))) * 0.5 * (1.0 - 0.55 * vUv.y); } else { a = pow(vF, 2.4) * 0.05; } gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a * uK, 1.0); }' });
  m.userData.ssxVeh = true; m.userData.weathered = true; return m;
}
