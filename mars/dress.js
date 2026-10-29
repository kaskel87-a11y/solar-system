// v7.5.4 Mars district dressing from Jeff's CC0 art kit (assets/mars-city/, credits in assets/mars-city/LICENSES.md).
// Additive only: the procedural districts stay as they are (swappable geometry), this adds street props on top.
// Phone rule: shared + the current district only (others are disposed), every repeat is an InstancedMesh, and the
// dressing keeps itself under DRESS_TRIS so the whole scene stays inside the 350k-triangle phone budget.
// Sign text and graffiti are drawn in-game on canvases (made-up names only). Loaders are imported lazily, so a failed
// fetch only loses the dressing. SSX.dress: { state(), districts(), budget }.
import * as THREE from 'three';
import { districtsOf } from '../world.js';

const KIT = 'assets/mars-city/';
const PHONE = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
const TIER = PHONE ? 'phone' : 'desktop';
export const DRESS_TRIS = PHONE ? 110000 : 600000;
const DUST = new THREE.Color(0xb0643c);
const BRANDS = [['RED DUST COLA', '#ff5a3c'], ['OLYMPUS LOANS', '#ffd040'], ['TAKE THE BELTWAY', '#3cd2ff'], ['HELIOS SPA', '#b48cff'], ['NOODLE ORBIT', '#ff8ad8'], ['ARES RUST-B-GONE', '#7dff6a']];
const TAGS = [['SALTBLOOD', '#ff3b3b'], ['DUSTMOUTH', '#ffd23b'], ['FLATS 4 LIFE', '#56e0ff'], ['NO COLSEC', '#ffffff'], ['RED TAPE', '#ff7a1a']];

let man = null, loader = null, loading = null, booted = false, failed = '';
const proto = {};        // id -> Promise<{ parts: [{ geo, mat }], box: Box3, tris }>
const built = {};        // district id -> { group, removers, tris, draws, counts }
let scene = null, worldRef = null, active = null, lastCheck = 0;

async function boot(renderer) {
  if (booted) return loading; booted = true;
  loading = (async () => {
    const [{ GLTFLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
      import('../vendor/three/addons/loaders/GLTFLoader.js'), import('../vendor/three/addons/loaders/KTX2Loader.js'), import('../vendor/three/addons/libs/meshopt_decoder.module.js')]);
    const ktx2 = new KTX2Loader().setTranscoderPath('vendor/three/addons/libs/basis/');
    if (renderer) ktx2.detectSupport(renderer);
    loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
    const m = await (await fetch(KIT + 'manifest.json?v=' + (window.__app?.version || ''))).json();
    man = Object.fromEntries(m.assets.map(a => [a.id, a]));
  })().catch(e => { failed = String(e?.message || e); console.warn('dress: kit unavailable', failed); });
  return loading;
}

// one GLB -> merged parts (geometry baked to the scene root, one entry per material), weathered for Mars dust
function load(id) {
  return proto[id] ||= (async () => {
    const a = man[id]; if (!a) throw new Error('dress: no asset ' + id);
    const { scene: s } = await loader.loadAsync(KIT + a.files[TIER]); s.updateMatrixWorld(true);
    const byMat = new Map(); let tris = 0; const box = new THREE.Box3().setFromObject(s);
    s.traverse(o => {
      if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'tangent'].includes(k)) g.deleteAttribute(k);
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      const mats = Array.isArray(o.material) ? o.material : [o.material], mat = mats[0];
      if (!byMat.has(mat)) { weather(mat, a.weather || 0); byMat.set(mat, []); } byMat.get(mat).push(g);
    });
    const { mergeGeometries } = await import('../vendor/three/addons/utils/BufferGeometryUtils.js');
    const parts = [];
    const compat = gs => { // v7.5.4: mergeGeometries needs the same attributes (and all-or-none indexed): fill a missing uv (0) / color (white), drop other odd ones
      const fill = { uv: [2, 0], color: [3, 1] }, all = new Set(gs.flatMap(g => Object.keys(g.attributes)));
      const out = gs.map(g => { const h = g.index && !gs.every(q => q.index) ? g.toNonIndexed() : g.clone();
        for (const k of all) if (!h.attributes[k] && fill[k]) { const [n, v] = fill[k]; h.setAttribute(k, new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * n).fill(v), n)); }
        return h; });
      const keys = [...all].filter(k => out.every(g => g.attributes[k] && g.attributes[k].itemSize === out[0].attributes[k].itemSize));
      for (const h of out) for (const k of Object.keys(h.attributes)) if (!keys.includes(k)) h.deleteAttribute(k);
      for (const k of keys) { const A = out.map(h => h.attributes[k]); if (A.some(a => a.array.constructor !== A[0].array.constructor || a.normalized !== A[0].normalized)) // quantized + float: make all float
        for (const h of out) { const a = h.attributes[k], f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent ? a.getComponent(i, c) : [a.getX, a.getY, a.getZ, a.getW][c].call(a, i); h.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } }
      return out; };
    for (const [mat, gs0] of byMat) { const gs = gs0.length > 1 ? (compat(gs0) || gs0) : gs0; const mg = gs.length > 1 ? mergeGeometries(gs, false) : gs[0]; if (mg) parts.push({ mat, geo: mg }); else for (const g of gs) parts.push({ mat, geo: g }); }
    return { parts, box, tris, id };
  })();
}
function weather(m, w) {
  if (!m) return; if (m.userData?.emissiveIntensity != null) m.emissiveIntensity = m.userData.emissiveIntensity;
  if (m.color && w > 0) m.color.lerp(DUST, Math.min(0.4, w * 0.35));
  if (m.roughness != null) m.roughness = Math.min(1, m.roughness + w * 0.15);
}

// ---------- layout: hub-local placements from the district data (blocks, domes, fast-travel plaza) ----------
function plan(D) {
  const L = [], put = (id, x, z, yaw = 0, o = {}) => L.push({ id, x, z, yaw, ...o }), fast = D.fastTravel || [0, 20];
  const blocks = D.blocks || [], domes = D.domes || [];
  if (D.kind === 'downtown') {
    for (const [x, z, w, d] of blocks) {
      put('street_lamp_02', x - w / 2 - 0.8, z + d / 2 + 1.6, 0); put('street_lamp_02', x + w / 2 + 0.8, z + d / 2 + 1.6, 0);
      if (w >= 8) { put('park_bench_g3', x - w / 3, z + d / 2 + 2.8, Math.PI); put('park_bench_g3', x + w / 3, z + d / 2 + 2.8, Math.PI); }
      put('planter_box_01', x - w / 2 - 1.3, z - d / 2 - 1.3, 0); put('planter_box_01', x + w / 2 + 1.3, z - d / 2 - 1.3, 0);
    }
    put('mars_food_stall', fast[0] + 7, fast[1] + 3, -Math.PI / 2, { r: 2 }); put('cafe_table_set', fast[0] + 4, fast[1] + 6, 0.4, { r: 1.2 }); put('cafe_table_set', fast[0] + 9.5, fast[1] + 6.5, -0.3, { r: 1.2 });
    put('mars_billboard_curved', 34, 26, -2.2, { sign: 0, r: 1.5 }); put('mars_billboard_curved', -38, -40, 0.75, { sign: 1, r: 1.5 });
  } else if (D.kind === 'rough') {
    for (const [x, z, w, d, , , , kind] of blocks) {
      put('burn_barrel', x - w / 2 - 1.6, z + d / 2 + 2.4, 0.3); put('burn_barrel', x + w / 2 + 1.8, z + d / 2 + 1.2, 1.1);
      put('mars_tire_wall', x, z - d / 2 - 2.2, 0, { r: 1.6 });
      if (kind === 'depot') { put('mars_stripped_buggy', x - w / 2 - 4, z - 1, 0.5, { r: 2 }); put('mars_stripped_buggy', x + w / 2 + 4, z + 1.5, -2.4, { r: 2 }); }
    }
    put('mars_water_tower', fast[0] - 16, fast[1] + 10, 0, { r: 3 }); put('mars_food_stall', fast[0] + 6, fast[1] - 4, Math.PI / 2, { r: 2 });
    put('burn_barrel', fast[0] + 3, fast[1] + 3, 0); put('mars_billboard_curved', 30, -36, -0.7, { sign: 5, r: 1.5 });
  } else if (D.kind === 'gated') {
    for (const [x, z, r] of domes) for (let k = 0; k < 6; k++) {
      const a = Math.PI / 2 + Math.PI / 4 + k * (Math.PI * 1.5 / 5); // skip the front (+z) arc where the airlock door is
      put(k % 2 ? 'planter_box_03' : 'potted_plant_04', x + Math.cos(a) * (r + 1.6), z + Math.sin(a) * (r + 1.6), -a);
    }
    put('lounge_chair', fast[0] - 5, fast[1] + 4, 0.2); put('lounge_chair', fast[0] - 3, fast[1] + 4.4, -0.1); put('park_bench_g3', fast[0] + 5, fast[1] + 5, Math.PI);
    put('street_lamp_02', fast[0] - 7, fast[1], 0); put('street_lamp_02', fast[0] + 7, fast[1], 0);
    put('mars_billboard_curved', -30, 30, 2.4, { sign: 3, r: 1.5 });
  }
  return L;
}

// ---------- build one district ----------
async function build(site, D) {
  const rec = { group: new THREE.Group(), removers: [], tris: 0, draws: 0, counts: {}, ready: false };
  rec.group.name = 'mars-dress:' + site.id; rec.group.userData.v8 = { site: site.id, part: 'dress' };
  built[site.id] = rec; scene.add(rec.group);
  const W = worldRef, doors = W.doorList?.() || [], lots = W.lots?.() || [];
  const clear = (x, z, r) => !W.collide?.(x, z, r) && !doors.some(d => Math.hypot(d.x - x, d.z - z) < r + 2.6) && !lots.some(l => Math.hypot(l.x - x, l.z - z) < (l.r || 8) + r + 1);
  const nudge = p => { if (clear(p.x, p.z, p.r || 0.7)) return p; if (p.sign == null) return null; // v7.5.4: a blocked sign/billboard slides to the nearest clear spot (newer buildings took some slots)
    for (const d of [4, 7, 10, 14]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (clear(x, z, p.r || 0.7)) return { ...p, x, z }; } return null; };
  const want = plan(D).map(p => nudge({ ...p, x: site.x + p.x, z: site.z + p.z })).filter(Boolean);
  const ids = [...new Set(want.map(p => p.id))], P = {};
  await Promise.all(ids.map(async id => { try { P[id] = await load(id); } catch (e) { console.warn('dress:', id, e?.message || e); } }));
  if (built[site.id] !== rec) return rec; // streamed out while loading
  for (const id of ids) {
    const pr = P[id]; if (!pr) continue; let list = want.filter(p => p.id === id);
    const room = Math.floor((DRESS_TRIS - totalTris()) / Math.max(1, pr.tris)); if (room <= 0) continue; list = list.slice(0, room);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    for (const part of pr.parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, list.length); im.name = 'dress:' + id; im.castShadow = false; im.receiveShadow = false;
      list.forEach((p, i) => { q.setFromAxisAngle(up, p.yaw || 0); m4.compose(new THREE.Vector3(p.x, W.groundAt(p.x, p.z), p.z), q, one); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); rec.group.add(im); rec.draws++;
    }
    const sx = pr.box.max.x - pr.box.min.x, sz = pr.box.max.z - pr.box.min.z, h = pr.box.max.y - pr.box.min.y;
    for (const p of list) {
      const r = p.r || Math.max(0.3, Math.min(2.5, Math.max(sx, sz) / 2));
      const rm = W.addSolid?.({ x: p.x, z: p.z, r, h, zone: site.id }); if (rm) rec.removers.push(rm);
      if (p.sign != null) rec.group.add(signFor(p, pr.box, BRANDS[p.sign % BRANDS.length]));
    }
    rec.tris += pr.tris * list.length; rec.counts[id] = list.length;
  }
  if (D.kind === 'rough') graffiti(rec, site, D);
  rec.ready = true; return rec;
}
const totalTris = () => Object.values(built).reduce((s, r) => s + r.tris, 0);

function canvasTex(text, col, w, h, bg, tag) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  let fs = Math.round(h * (tag ? 0.55 : 0.5)); const font = s => `${tag ? 'italic 900' : '800'} ${s}px system-ui, sans-serif`; x.font = font(fs);
  while (x.measureText(text).width > w * 0.9 && fs > 10) x.font = font(fs -= 2);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = tag ? 4 : 18; x.fillStyle = col;
  if (tag) { x.translate(w / 2, h / 2); x.rotate(-0.06); x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(text, 0, 0); x.fillText(text, 0, 0); }
  else x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function signFor(p, box, [text, col]) {
  const W = (box.max.x - box.min.x) * 0.86, H = Math.min(W / 3.2, (box.max.y - box.min.y) * 0.42);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: canvasTex(text, col, 512, 160, 'rgba(10,8,14,0.92)'), side: THREE.DoubleSide, toneMapped: false }));
  const y = worldRef.groundAt(p.x, p.z) + box.max.y - H / 2 - (box.max.y - box.min.y) * 0.08, f = box.max.z + 0.06;
  m.position.set(p.x + Math.sin(p.yaw) * f, y, p.z + Math.cos(p.yaw) * f); m.rotation.y = p.yaw; m.name = 'dress:sign'; m.userData.text = text; return m;
}
// gang tags on the side walls of the Red Tape Flats blocks (decal quads, polygon offset so they never z-fight)
function graffiti(rec, site, D) {
  let k = 0;
  for (const [x, z, w, d] of D.blocks || []) for (const s of [-1, 1]) {
    const [text, col] = TAGS[k++ % TAGS.length], X = site.x + x + s * (w / 2 + 0.03), Z = site.z + z + (k % 2 ? -0.6 : 0.8);
    const mat = new THREE.MeshBasicMaterial({ map: canvasTex(text, col, 512, 192, null, true), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(d * 0.8, 4.2), 1.5), mat); q.position.set(X, worldRef.groundAt(X, Z) + 1.6, Z); q.rotation.y = s * Math.PI / 2; q.name = 'dress:tag'; q.userData.text = text; rec.group.add(q);
  }
}
function drop(id) {
  const r = built[id]; if (!r) return; delete built[id];
  for (const f of r.removers) f(); r.group.parent?.remove(r.group);
  r.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.name === 'dress:sign' || o.name === 'dress:tag') { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
}
function dropAll() { for (const id of Object.keys(built)) drop(id); active = null; }

// ---------- per-frame hook ----------
function tick(dt, ctx) {
  const W = ctx.world, colony = ctx.name === 'Mars' && W?.colony;
  if (!colony) { if (scene) { dropAll(); scene = null; } return; }
  if (scene !== ctx.scene || worldRef !== W) { dropAll(); scene = ctx.scene; worldRef = W; }
  const now = performance.now(); if (now - lastCheck < 500) return; lastCheck = now;
  if (!booted) boot(window.__app?.renderer); if (!man) return;
  const defs = Object.fromEntries(districtsOf('Mars').map(D => [D.id, D])), sites = W.districts().filter(s => defs[s.id]);
  // phone: only the nearest district within reach; desktop: every district once
  const at = ctx.car || ctx.player || {}, px = at.position?.x ?? at.x ?? 0, pz = at.position?.z ?? at.z ?? 0;
  const near = sites.map(s => ({ s, d: Math.hypot(s.x - px, s.z - pz) - s.r })).sort((a, b) => a.d - b.d)[0];
  const want = PHONE ? (near && near.d < 140 ? [near.s] : []) : sites;
  for (const id of Object.keys(built)) if (!want.some(s => s.id === id)) drop(id);
  for (const s of want) if (!built[s.id]) build(s, defs[s.id]).catch(e => console.warn('dress build', e));
  active = want.map(s => s.id);
}
(globalThis.SSX_TICKS ||= []).push(tick);

const api = {
  budget: DRESS_TRIS, tier: TIER,
  state: () => ({ tier: TIER, failed, loaded: !!man, active, tris: totalTris(), draws: Object.values(built).reduce((s, r) => s + r.draws, 0),
    districts: Object.fromEntries(Object.entries(built).map(([id, r]) => [id, { ready: r.ready, tris: r.tris, draws: r.draws, counts: r.counts, signs: r.group.children.filter(o => o.name === 'dress:sign').map(o => o.userData.text), tags: r.group.children.filter(o => o.name === 'dress:tag').map(o => o.userData.text) }])) })
};
const hook = () => { if (window.SSX) { window.SSX.dress = api; return true; } return false; };
if (!hook()) { const t = setInterval(() => hook() && clearInterval(t), 300); }
export default api;
