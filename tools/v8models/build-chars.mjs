// v8 models: phone/med character build. ss-assets/models/desktop/char_*.glb (CC0 MakeHuman bodies + CMU mocap, see ASSETS.md)
//   -> models/v8/chars/<id>.glb (one skinned vertex buffer, LOD0 = opaque + alpha-tested + glass primitives, LOD1 = one far primitive)
//   -> models/v8/chars/anims.glb (the shared clips: every body uses the same 26-joint skeleton, so one clip set drives them all)
// Like Jeff's dancers.mjs: per-part materials become per-vertex attributes so a body is 2-3 draw calls instead of ~20:
//   COLOR_0 = base colour factor (linear), _CELL = atlas rect (x, y, w, h; the shader wraps the tiled garment UVs inside it),
//   _RM = (roughness, metalness, tintable). Teeth / tongue / skin-detail overlays are dropped. A pressure helmet (glass bubble +
//   collar) and an O2 pack are added, rigid-skinned to Head / Spine2, so the bodies read as Mars surface crew like the blocky rigs.
// Run: ln -s /workspace/ss-assets/tools/node_modules tools/v8models/node_modules && node tools/v8models/build-chars.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dequantize, quantize, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../models/v8/chars'), SRC = '/workspace/ss-assets/models/desktop/';
fs.mkdirSync(OUT, { recursive: true });
const CHARS = { player: 'char_player_survivor', soldier: 'char_npc_soldier', hacker: 'char_npc_hacker', worker: 'char_npc_worker' };
const DROP = /^(Teeth|Tongue|Skin details)$/, DROP_BY = { soldier: /^(Helmet|Chin strap)$/ }; // the soldier's own helmet would poke through the bubble
const BODY = /^(Skin|Eyes|Eyebrows|Eyelashes|Hair|Hair spikes|Beard|Shoes|Goggle|Buckle|Silver|PaletteMaterial)/; // never tinted
const ATLAS = 1024, UNIT = 64, GRID = ATLAS / UNIT, PAD = 3;
const LOD0 = 0.62, LOD1 = 0.14; // index ratios
const KEEP_CLIPS = /^(Idle|Walk|Run|Pistol aim|Pistol fire|Punch|Hit reaction|Death|Drive car|Jump)/;
const s2l = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// ---- tiny geometry helpers (metres, mesh space) ----
function sphere(r, ws, hs, cx, cy, cz, sy = 1) { const P = [], N = [], I = []; for (let j = 0; j <= hs; j++) for (let i = 0; i <= ws; i++) { const u = i / ws * Math.PI * 2, v = j / hs * Math.PI, x = -Math.cos(u) * Math.sin(v), y = Math.cos(v), z = Math.sin(u) * Math.sin(v); P.push(cx + x * r, cy + y * r * sy, cz + z * r); N.push(x, y, z); }
  for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) { const a = j * (ws + 1) + i, b = a + ws + 1; if (j) I.push(a, b, a + 1); if (j < hs - 1) I.push(b, b + 1, a + 1); } return { P, N, I }; }
function torus(R, r, S, T, cx, cy, cz) { const P = [], N = [], I = []; for (let j = 0; j <= T; j++) for (let i = 0; i <= S; i++) { const u = i / S * Math.PI * 2, w = j / T * Math.PI * 2, nx = Math.cos(w) * Math.cos(u), nz = Math.cos(w) * Math.sin(u), ny = Math.sin(w);
  P.push(cx + (R + r * Math.cos(w)) * Math.cos(u), cy + r * ny, cz + (R + r * Math.cos(w)) * Math.sin(u)); N.push(nx, ny, nz); }
  for (let j = 0; j < T; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + S + 1; I.push(a, a + 1, b, b, a + 1, b + 1); } return { P, N, I }; }
function box(sx, sy, sz, cx, cy, cz, bev = 0.03) { // bevelled-ish box: 6 faces, normals per face
  const P = [], N = [], I = []; const F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const n of F) { const a = n.findIndex(v => v), u = [1, 2, 0][a], v = [2, 0, 1][a], b = P.length / 3; const h = [sx / 2, sy / 2, sz / 2];
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[a] = n[a] * h[a]; p[u] = su * (h[u] - bev); p[v] = sv * (h[v] - bev); P.push(cx + p[0], cy + p[1], cz + p[2]); N.push(...n); }
    if (n[a] > 0) I.push(b, b + 1, b + 2, b, b + 2, b + 3); else I.push(b, b + 2, b + 1, b, b + 3, b + 2); }
  return { P, N, I }; }
function cyl(r, h, S, cx, cy, cz, axis = 'y') { const P = [], N = [], I = []; for (let j = 0; j <= 1; j++) for (let i = 0; i <= S; i++) { const u = i / S * Math.PI * 2, c = Math.cos(u) * r, s = Math.sin(u) * r, y = (j - 0.5) * h;
  if (axis === 'y') { P.push(cx + c, cy + y, cz + s); N.push(Math.cos(u), 0, Math.sin(u)); } else { P.push(cx + c, cy + s, cz + y); N.push(Math.cos(u), Math.sin(u), 0); } }
  for (let i = 0; i < S; i++) { const a = i, b = i + S + 1; I.push(a, b, a + 1, b, b + 1, a + 1); } return { P, N, I }; }

// ---- atlas packer on a 64 px grid ----
function packer() { const occ = new Uint8Array(GRID * GRID); return (cells) => { const at = (x, y, n) => { for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (occ[(y + j) * GRID + x + i]) return false; return true; };
  for (let y = 0; y + cells <= GRID; y += cells) for (let x = 0; x + cells <= GRID; x += cells) if (at(x, y, cells)) { for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) occ[(y + j) * GRID + x + i] = 1; return [x * UNIT, y * UNIT]; }
  return null; }; }

async function buildChar(id, file) {
  const doc = await io.read(SRC + file + '.glb'); await doc.transform(dequantize());
  const root = doc.getRoot(), mesh = root.listMeshes()[0], node = root.listNodes().find(n => n.getMesh() === mesh), skin = node.getSkin();
  const joints = skin.listJoints(), jn = joints.map(j => j.getName()), ibm = skin.getInverseBindMatrices();
  const jointPos = (name) => { const k = jn.indexOf(name); const m = ibm.getElement(k, []); // invert the affine IBM (rotation-only bones): p = -R^T t
    const R = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]], t = [m[12], m[13], m[14]]; return [0, 1, 2].map(c => -(R[0][c] * t[0] + R[1][c] * t[1] + R[2][c] * t[2])); };
  const prims = mesh.listPrimitives().filter(p => p.getMode() === 4 && !DROP.test(p.getMaterial()?.getName() || '') && !(DROP_BY[id]?.test(p.getMaterial()?.getName() || '')));
  // atlas cells: one per distinct texture (Skin gets 512, garments 256, small parts 128, palettes 64)
  const pack = packer(), cellOf = new Map(), comps = [];
  const sizeFor = (mat, tex) => { const n = mat.getName(), s = tex ? tex.getSize()[0] : 0; if (n === 'Skin') return 512; if (!tex || s <= 128) return 64; if (/^(Eyes|Eyebrows|Eyelashes|Hair|Beard)/.test(n)) return 128; return 256; };
  const white = await sharp({ create: { width: UNIT, height: UNIT, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const want = [{ key: 'white', size: 64, img: white, tiled: false }]; for (const p of prims) { const m = p.getMaterial(), t = m.getBaseColorTexture(); const key = t || 'white'; if (!want.find(w => w.key === key)) want.push({ key, size: t ? sizeFor(m, t) : 64, img: t ? t.getImage() : white, tiled: !!t }); }
  want.sort((a, b) => b.size - a.size);
  for (const w of want) { let s = w.size, at = null; while (!(at = pack(s / UNIT)) && s > 64) s /= 2; if (!at) throw new Error(id + ': atlas full');
    const inner = s - PAD * 2; let img = sharp(w.img).ensureAlpha().resize(inner, inner, { fit: 'fill' });
    img = img.extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: w.tiled ? 'repeat' : 'copy' });
    comps.push({ input: await img.png().toBuffer(), left: at[0], top: at[1] });
    cellOf.set(w.key, [(at[0] + PAD) / ATLAS, (at[1] + PAD) / ATLAS, inner / ATLAS, inner / ATLAS]); }
  const atlas = await sharp({ create: { width: ATLAS, height: ATLAS, channels: 4, background: '#808080ff' } }).composite(comps).webp({ quality: 84, alphaQuality: 90, smartSubsample: true }).toBuffer();
  // merged vertex arrays
  const V = { P: [], N: [], UV: [], J: [], W: [], C: [], CELL: [], RM: [] }, B = { opaque: [], mask: [], glass: [] };
  for (const p of prims) {
    const m = p.getMaterial(), t = m.getBaseColorTexture(), cell = cellOf.get(t || 'white'), base = V.P.length / 3, n = m.getName();
    const A = s => p.getAttribute(s), pos = A('POSITION'), nrm = A('NORMAL'), uv = A('TEXCOORD_0'), J = A('JOINTS_0'), W = A('WEIGHTS_0'), cnt = pos.getCount(), e = [];
    const bc = m.getBaseColorFactor(), col = [s2l(bc[0]), s2l(bc[1]), s2l(bc[2])].map(v => Math.min(1, v)); // factors are linear in glTF already; MakeHuman exports sRGB-ish swatches as factors, keep as-is
    const colL = [bc[0], bc[1], bc[2]];
    for (let i = 0; i < cnt; i++) { V.P.push(...pos.getElement(i, [])); V.N.push(...nrm.getElement(i, [])); V.UV.push(...(uv && t ? uv.getElement(i, []) : [0.5, 0.5])); V.J.push(...J.getElement(i, [])); V.W.push(...W.getElement(i, []));
      V.C.push(...colL, 1); V.CELL.push(...cell); V.RM.push(m.getRoughnessFactor(), m.getMetallicFactor(), BODY.test(n) || id === 'player' ? 0 : 1, 1); }
    void col;
    const ix = Array.from(p.getIndices().getArray(), i => i + base), bucket = m.getAlphaMode() === 'BLEND' ? 'glass' : m.getAlphaMode() === 'MASK' ? 'mask' : 'opaque';
    B[bucket].push(...ix);
  }
  // pressure helmet + O2 pack, rigid-skinned. Measure the head from the vertices weighted mostly to Head.
  const hk = jn.indexOf('Head'), sk = jn.indexOf('Spine2'), nk = jn.indexOf('Neck');
  let hb = [9, 9, 9, -9, -9, -9], back = 9, chestY = [];
  for (let i = 0; i < V.P.length / 3; i++) { const w = V.W.slice(i * 4, i * 4 + 4), j = V.J.slice(i * 4, i * 4 + 4), p = V.P.slice(i * 3, i * 3 + 3);
    const wh = j.reduce((a, jj, q) => a + (jj === hk ? w[q] : 0), 0), ws = j.reduce((a, jj, q) => a + (jj === sk ? w[q] : 0), 0);
    if (wh > 0.6) for (let c = 0; c < 3; c++) { hb[c] = Math.min(hb[c], p[c]); hb[c + 3] = Math.max(hb[c + 3], p[c]); }
    if (ws > 0.5) { back = Math.min(back, p[2]); chestY.push(p[1]); } }
  const hc = [(hb[0] + hb[3]) / 2, (hb[1] + hb[4]) / 2 + 0.01, (hb[2] + hb[5]) / 2], hr = Math.max(hb[3] - hb[0], hb[4] - hb[1], hb[5] - hb[2]) / 2 * 1.22 + 0.02;
  const neck = jointPos('Neck'), sp2 = jointPos('Spine2');
  const addPart = (g, joint, bucket, col, rough, metal, tint = 0) => { const base = V.P.length / 3, cell = cellOf.get('white');
    for (let i = 0; i < g.P.length / 3; i++) { V.P.push(g.P[i * 3], g.P[i * 3 + 1], g.P[i * 3 + 2]); V.N.push(g.N[i * 3], g.N[i * 3 + 1], g.N[i * 3 + 2]); V.UV.push(0.5, 0.5); V.J.push(joint, 0, 0, 0); V.W.push(1, 0, 0, 0); V.C.push(...col); V.CELL.push(...cell); V.RM.push(rough, metal, tint, 1); }
    B[bucket].push(...g.I.map(i => i + base)); return base; };
  addPart(sphere(hr, 20, 14, hc[0], hc[1], hc[2], 1.05), hk, 'glass', [0.82, 0.9, 1, 0.2], 0.04, 0.1);
  const collarY = neck[1] - 0.02; addPart(torus(hr * 0.78, 0.035, 20, 6, hc[0], collarY, hc[2] - 0.005), nk, 'opaque', [0.55, 0.56, 0.58, 1], 0.35, 0.8);
  const packZ = back - 0.1, packY = sp2[1] - 0.06;
  addPart(box(0.34, 0.44, 0.16, sp2[0], packY, packZ, 0.02), sk, 'opaque', [0.72, 0.72, 0.7, 1], 0.55, 0.2, 1);
  addPart(cyl(0.055, 0.4, 10, sp2[0] - 0.09, packY + 0.02, packZ - 0.09), sk, 'opaque', [0.45, 0.47, 0.5, 1], 0.3, 0.9);
  addPart(cyl(0.055, 0.4, 10, sp2[0] + 0.09, packY + 0.02, packZ - 0.09), sk, 'opaque', [0.45, 0.47, 0.5, 1], 0.3, 0.9);
  addPart(torus(0.03, 0.012, 8, 4, sp2[0], packY + 0.26, packZ), sk, 'opaque', [1, 0.42, 0.1, 1], 0.4, 0.2); // status ring
  // simplify per bucket (border-locked so garment seams stay closed at LOD0) and one far LOD with everything opaque-ish
  const P32 = new Float32Array(V.P); let nv = V.P.length / 3;
  const simp = (ix, ratio, err, lock) => { if (!ix.length) return new Uint32Array(0); const src = new Uint32Array(ix); const tgt = Math.min(src.length, Math.max(3, Math.floor(src.length * ratio / 3) * 3)); let out; try { [out] = MeshoptSimplifier.simplify(src, P32, 3, tgt, err, lock ? ["LockBorder"] : []); } catch (e) { console.log("simp fail", src.length, tgt, err, P32.length, Math.max(...src)); throw e; } return out; };
  if (process.env.DBG) console.log(id, Object.fromEntries(Object.entries(B).map(([k, v]) => [k, v.length])));
  const sloppy = (ix, ratio, err) => { const src = new Uint32Array(ix); const tgt = Math.min(src.length, Math.max(3, Math.floor(src.length * ratio / 3) * 3)); const [out] = MeshoptSimplifier.simplifySloppy(src, P32, 3, null, tgt, err); return out; };
  const L0 = { opaque: simp(B.opaque, LOD0, 0.004, true), mask: simp(B.mask, 0.5, 0.01, false), glass: new Uint32Array(B.glass) };
  if (L0.mask.length > B.mask.length * 0.7) L0.mask = sloppy(B.mask, 0.45, 0.01); // hair cards / beard strands don't collapse with the normal simplifier
  let L1 = simp(B.opaque, LOD1, 0.05, false); if (L1.length > B.opaque.length * LOD1 * 1.6) L1 = sloppy(B.opaque, LOD1, 0.06);
  // compact: drop vertices no LOD uses (simplification leaves them in the shared buffer)
  const used = new Int32Array(nv).fill(-1); let nn = 0; for (const ix of [L0.opaque, L0.mask, L0.glass, L1]) for (const i of ix) if (used[i] < 0) used[i] = nn++;
  const remap = ix => Uint32Array.from(ix, i => used[i]);
  for (const k of ['opaque', 'mask', 'glass']) L0[k] = remap(L0[k]); L1 = remap(L1);
  for (const [k, w] of [['P', 3], ['N', 3], ['UV', 2], ['J', 4], ['W', 4], ['C', 4], ['CELL', 4], ['RM', 4]]) { const src = V[k], dst = new Array(nn * w); for (let i = 0; i < nv; i++) if (used[i] >= 0) for (let c = 0; c < w; c++) dst[used[i] * w + c] = src[i * w + c]; V[k] = dst; }
  const nvAll = nv; nv = nn;
  // write: new doc reusing the source skeleton nodes
  const buf = root.listBuffers()[0];
  const acc = (arr, type, Ctor = Float32Array, norm = false) => doc.createAccessor().setArray(new Ctor(arr)).setType(type).setBuffer(buf).setNormalized(norm);
  const q8 = a => a.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255)), q16 = a => a.map(v => Math.round(Math.max(0, Math.min(1, v)) * 65535));
  const aP = acc(V.P, 'VEC3'), aN = acc(V.N, 'VEC3'), aUV = acc(V.UV, 'VEC2'), aJ = acc(V.J, 'VEC4', Uint8Array), aW = acc(V.W, 'VEC4'), aC = acc(q8(V.C), 'VEC4', Uint8Array, true), aCell = acc(q16(V.CELL), 'VEC4', Uint16Array, true), aRM = acc(q8(V.RM), 'VEC4', Uint8Array, true);
  const tex = doc.createTexture('atlas').setImage(atlas).setMimeType('image/webp');
  const mat = (name, mode) => doc.createMaterial(name).setBaseColorTexture(tex).setAlphaMode(mode).setDoubleSided(mode !== 'OPAQUE');
  const mO = mat('opaque', 'OPAQUE'), mM = mat('mask', 'MASK').setAlphaCutoff(0.5), mG = mat('glass', 'BLEND'), mF = mat('far', 'MASK').setAlphaCutoff(0.5);
  const prim = (ix, m) => { const p = doc.createPrimitive().setMaterial(m).setIndices(doc.createAccessor().setArray(nv > 65535 ? ix : new Uint16Array(ix)).setType('SCALAR').setBuffer(buf));
    for (const [k, a] of [['POSITION', aP], ['NORMAL', aN], ['TEXCOORD_0', aUV], ['JOINTS_0', aJ], ['WEIGHTS_0', aW], ['COLOR_0', aC], ['_CELL', aCell], ['_RM', aRM]]) p.setAttribute(k, a); return p; };
  const m0 = doc.createMesh('lod0'); for (const [k, m] of [['opaque', mO], ['mask', mM], ['glass', mG]]) if (L0[k].length) m0.addPrimitive(prim(L0[k], m));
  const m1 = doc.createMesh('lod1').addPrimitive(prim(L1, mF));
  node.setMesh(m0).setName('lod0'); const n1 = doc.createNode('lod1').setMesh(m1).setSkin(skin); (node.getParentNode() || root.listScenes()[0]).addChild(n1);
  mesh.dispose();
  const anims = root.listAnimations(); const clipNames = anims.map(a => a.getName());
  for (const a of anims) a.dispose(); // clips ship once, in anims.glb
  await doc.transform(prune({ keepAttributes: true, keepLeaves: true }), quantize({ pattern: /^(POSITION|NORMAL|WEIGHTS_0)$/, quantizePosition: 14, quantizeNormal: 10, quantizeWeight: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  doc.getRoot().getAsset().extras = { ssx: { id, src: file, license: 'CC0-1.0 (MakeHuman assets via Ara 3D Gen, MIT tooling); CMU mocap clips (free for any use)', helmet: { c: hc, r: hr } } };
  fs.writeFileSync(path.join(OUT, id + '.glb'), await io.writeBinary(doc));
  const st = fs.statSync(path.join(OUT, id + '.glb')).size;
  console.log(id, 'verts', nvAll, '->', nv, 'lod0', Object.entries(L0).map(([k, v]) => k + ':' + v.length / 3).join(' '), 'lod1', L1.length / 3, 'atlas', atlas.length, 'glb', st, 'clips', clipNames.join('|'));
}
for (const [id, f] of Object.entries(CHARS)) await buildChar(id, f);

// shared clips: strip the mesh off the player file, keep the 26 joints and the clips the game uses
{
  const doc = await io.read(SRC + CHARS.player + '.glb'); await doc.transform(dequantize());
  const root = doc.getRoot();
  for (const a of root.listAnimations()) { if (!KEEP_CLIPS.test(a.getName())) { a.dispose(); continue; }
    for (const c of a.listChannels()) { const p = c.getTargetPath(), n = c.getTargetNode()?.getName(); if (p === 'scale' || (p === 'translation' && n !== 'Hips')) { c.getSampler()?.dispose(); c.dispose(); } } }
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose(); for (const s of root.listSkins()) s.dispose(); for (const t of root.listTextures()) t.dispose(); for (const m of root.listMaterials()) m.dispose();
  await doc.transform(resample({ tolerance: 2e-4 }), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  fs.writeFileSync(path.join(OUT, 'anims.glb'), await io.writeBinary(doc));
  console.log('anims', root.listAnimations().map(a => a.getName()).join('|'), fs.statSync(path.join(OUT, 'anims.glb')).size);
}
