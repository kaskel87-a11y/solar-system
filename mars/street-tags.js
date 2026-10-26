// Red Tape Flats street life, part 1: graffiti (Snuffles). Marked walls on our own freestanding props (a shipping container,
// jersey barriers, a dumpster, the tow-yard back wall, a billboard pylon), so nothing lands on Jeff's #10 storefronts,
// the #21 grime decals or the #32 doors. Pieces are persistent instanced decals: one InstancedMesh per atlas cell, the same
// canvas-atlas approach as the #21 grime pass, written fresh here. Spray takes a can and ~2.6 s; ColSec may see you.
import { tagAtlas, CELLS, NCELL, rust, concrete, sign } from './street-tex.js';

const GANGS = { saltblood: 'Saltblood', dustjaws: 'Dustjaw Boys', saints: 'Vacuum Saints' };
// district-local [x, z]; n = outward face normal [nx, nz]; w/h decal size; home = the crew that tags it when it isn't yours
export const SPOTS = [
  { id: 'yardwall', name: 'the Hook & Crook back wall', at: [46, 19.2], n: [0, -1], w: 4.2, h: 2.0, y: 1.5, prop: 'yardwall', home: 'saltblood' },
  { id: 'container', name: 'the rust container by the pad', at: [-52.75, 14], n: [1, 0], w: 4.4, h: 1.9, y: 1.35, prop: 'container', home: 'saltblood', seed: 'saltblood' },
  { id: 'jersey-s', name: 'the jersey wall south of Doc Grim\u2019s', at: [12, -34.27], n: [0, -1], w: 4.6, h: 1.25, y: 0.85, prop: 'jersey', home: 'dustjaws', seed: 'dustjaws' },
  { id: 'dumpster', name: 'the dumpster on the east row', at: [34.88, -2], n: [-1, 0], w: 1.8, h: 0.95, y: 0.85, prop: 'dumpster', home: 'dustjaws' },
  { id: 'jersey-sw', name: 'the jersey wall by the pawn lot', at: [-30, -48.27], n: [0, -1], w: 4.6, h: 1.25, y: 0.85, prop: 'jersey', home: 'saints' },
  { id: 'billboard', name: 'the billboard pylon up north', at: [-4, 51.6], n: [0, -1], w: 3.8, h: 1.8, y: 1.45, prop: 'pylon', home: 'saints', seed: 'saints' }
];
// spray cans lying around (respawn after 6 min); district-local
const CANS = [{ id: 'c1', at: [-50, 10] }, { id: 'c2', at: [14, -36.5] }, { id: 'c3', at: [37.6, -3.4] }, { id: 'c4', at: [-2, 49.5] }];
const CAN_RESPAWN = 6 * 60e3, SPRAY_T = 2.6;
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export function createTags(K) {
  const { THREE } = K;
  let root = null, decals = [], decalMat = null, cans = [], spray = null, mist = null, nextRival = 150 + Math.random() * 120, dbg = { built: 0, sprays: 0 };
  const own = id => K.ST.tags[id] || null;
  function seed() { if (K.ST.seeded) return; for (const s of SPOTS) if (s.seed && !K.ST.tags[s.id]) K.ST.tags[s.id] = { by: s.seed, cell: s.seed, t: 0 }; K.ST.seeded = true; K.save(); }
  const cellOf = s => { const o = own(s.id); if (!o) return CELLS.mark; if (o.by === 'you') return CELLS['you' + (hash(s.id) % 3)]; return CELLS[o.by] ?? CELLS.mark; };
  // world frame for a spot: centre on the face, tangent (u) along the face
  function frame(s) { const p = K.L(s.at[0], s.at[1]); const [nx, nz] = s.n; return { x: p.x + nx * 0.03, z: p.z + nz * 0.03, y: p.y, nx, nz, yaw: Math.atan2(nx, nz) }; }

  function buildProps(g) {
    const m = { rust: K.mat('st_rust', { map: rust(4, [96, 58, 40]), roughness: 0.85, metalness: 0.35 }), green: K.mat('st_green', { map: rust(9, [52, 70, 56]), roughness: 0.8, metalness: 0.3 }),
      conc: K.mat('st_conc', { map: concrete(3) }), dark: K.mat('st_dark', { color: 0x1a1816, roughness: 0.7 }), corr: K.mat('st_corr', { map: rust(12, [120, 112, 100]), roughness: 0.7, metalness: 0.5 }) };
    for (const s of SPOTS) {
      const p = K.L(s.at[0], s.at[1]), [nx, nz] = s.n, ry = Math.atan2(nx, nz);
      const back = (d) => ({ x: p.x - nx * d, z: p.z - nz * d }); // prop centre sits behind the face
      if (s.prop === 'container') { const c = back(1.2), tx = Math.cos(ry), tz = -Math.sin(ry); K.box(g, m.rust, c.x, p.y + 1.3, c.z, 6, 2.6, 2.4, ry); for (let i = -2; i <= 2; i++) K.box(g, m.dark, c.x + tx * i * 1.2 + nx * 1.22, p.y + 1.3, c.z + tz * i * 1.2 + nz * 1.22, 0.08, 2.5, 0.06, ry); K.box(g, m.dark, c.x, p.y + 2.62, c.z, 6.05, 0.06, 2.45, ry); }
      if (s.prop === 'jersey') { const c = back(0.27); K.box(g, m.conc, c.x, p.y + 0.42, c.z, 6, 0.84, 0.62, ry); K.box(g, m.conc, c.x, p.y + 1.15, c.z, 6, 0.62, 0.34, ry); }
      if (s.prop === 'dumpster') { const c = back(0.62); K.box(g, m.green, c.x, p.y + 0.75, c.z, 2.3, 1.3, 1.25, ry); K.box(g, m.dark, c.x, p.y + 1.43, c.z, 2.4, 0.08, 1.35, ry); for (const k of [-0.8, 0.8]) K.box(g, m.dark, c.x + (nz ? k : 0), p.y + 0.1, c.z + (nx ? k : 0), 0.18, 0.2, 0.18); }
      if (s.prop === 'yardwall') { const c = back(0.13); K.box(g, m.corr, c.x, p.y + 1.6, c.z, 12, 3.2, 0.25, ry); for (let i = -6; i <= 6; i += 3) K.box(g, m.dark, c.x + i, p.y + 1.6, c.z - nz * 0.05, 0.12, 3.3, 0.35, ry); }
      if (s.prop === 'pylon') {
        const c = back(0.35); K.box(g, m.conc, c.x, p.y + 1.5, c.z, 4.6, 3, 0.7, ry); for (const k of [-1.6, 1.6]) K.box(g, m.dark, c.x + k, p.y + 4.6, c.z, 0.22, 3.4, 0.22, ry);
        const ad = new THREE.Mesh(K.geo().plane, K.mat('st_ad', { map: sign('MERIDIAN AIR \u00b7 BREATHE EASY\u2122', '#e8e0c8', '#2a3a48', 768, 192), emissive: 0x334455, emissiveIntensity: 0.4 }));
        ad.position.set(c.x + nx * 0.14, p.y + 6.3, c.z + nz * 0.14); ad.rotation.y = ry; ad.scale.set(6.4, 1.8, 1); g.add(ad);
        K.box(g, m.dark, c.x, p.y + 6.3, c.z, 6.6, 2.0, 0.2, ry);
      }
    }
  }
  function buildDecals(g) {
    decalMat = new THREE.MeshStandardMaterial({ map: tagAtlas(K.ST.tag), transparent: true, depthWrite: false, alphaTest: 0.03, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.8, emissive: 0xffffff, emissiveMap: tagAtlas(K.ST.tag), emissiveIntensity: 0.16 });
    decals = [];
    for (let c = 0; c < NCELL; c++) {
      const geo = new THREE.PlaneGeometry(1, 1), uv = geo.attributes.uv, col = c % 4, row = Math.floor(c / 4);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 4, (1 - (row + 1) / 2) + uv.getY(i) / 2);
      const im = new THREE.InstancedMesh(geo, decalMat, SPOTS.length); im.frustumCulled = false; im.renderOrder = 2; im.name = 'streetTags' + c; g.add(im); decals.push(im);
    }
    refresh();
  }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function refresh() {
    if (!decals.length) return; const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    SPOTS.forEach((s, i) => {
      const f = frame(s), cell = spray?.s === s ? CELLS['you' + (hash(s.id) % 3)] : cellOf(s), k = spray?.s === s ? Math.max(0.08, spray.t / SPRAY_T) : 1;
      Q.setFromAxisAngle(UP, f.yaw); V.set(f.x, f.y + s.y, f.z); SC.set(s.w * k, s.h * k, 1); M4.compose(V, Q, SC);
      for (let c = 0; c < NCELL; c++) decals[c].setMatrixAt(i, c === cell ? M4 : zero);
      if (spray?.s === s && own(s.id)) { /* the old piece stays visible under the fresh one */ const oc = cellOf(s); if (oc !== cell) { SC.set(s.w, s.h, 1); M4.compose(V.set(f.x - f.nx * 0.005, f.y + s.y, f.z - f.nz * 0.005), Q, SC); decals[oc].setMatrixAt(i, M4); } }
    });
    for (const d of decals) d.instanceMatrix.needsUpdate = true;
  }
  function buildCans(g) {
    cans = [];
    const body = K.mat('st_can', { color: 0xd8d8d0, metalness: 0.7, roughness: 0.35 }), cap = K.mat('st_cap', { color: 0xff2a6a, emissive: 0xff2a6a, emissiveIntensity: 0.9 });
    for (const c of CANS) {
      const p = K.L(c.at[0], c.at[1]), o = new THREE.Group(); o.position.set(p.x, p.y + 0.35, p.z);
      const b = new THREE.Mesh(K.geo().cyl, body); b.scale.set(0.13, 0.32, 0.13); o.add(b); const t = new THREE.Mesh(K.geo().cyl, cap); t.scale.set(0.09, 0.08, 0.09); t.position.y = 0.2; o.add(t);
      o.rotation.z = 0.25; g.add(o); cans.push({ ...c, o, p });
    }
  }
  function buildMist(g) {
    const n = 40, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    mist = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff4a7a, size: 0.08, transparent: true, opacity: 0.7, depthWrite: false })); mist.visible = false; mist.frustumCulled = false; mist.userData.v = new Float32Array(n * 3); g.add(mist);
  }
  function commit(s) {
    const prev = own(s.id)?.by || null; K.ST.cans = Math.max(0, K.ST.cans - 1);
    K.ST.tags[s.id] = { by: 'you', cell: 'you' + (hash(s.id) % 3), t: Date.now() }; K.ST.stats.tagged++;
    let gain = 10; if (prev && prev !== 'you') { gain = 15; K.ST.stats.covered++; K.rep(prev, -3, 'you tagged over their piece'); } else if (prev === 'you') gain = 1;
    K.cred(gain, 'tag'); K.save(); refresh();
    K.toast(`\ud83c\udfa8 Piece up on ${s.name}. +${gain} street cred (${K.ST.cred}, ${K.credTitle(K.ST.cred)}).${prev && prev !== 'you' ? ` ${GANGS[prev] || prev} won\u2019t like that.` : ''}`, 3400);
    K.emit('tag', { id: s.id, over: prev, cred: K.ST.cred });
    seenRoll(s);
  }
  function seenRoll(s) {
    const P = K.player; if (!P) return false; let p = K.night() ? 0.06 : 0.16, who = null;
    try { for (const g of K.world()?.securityList?.() || []) { const d = Math.hypot(g.x - P.x, g.z - P.z); if (d < 45 && (K.X().city?.lineOfSight?.(g.x, g.z, P.x, P.z) ?? true)) { p += 0.45; who = g; break; } } } catch (e) { /* */ }
    try { const ppl = K.world()?.mapData?.()?.people || []; const g = ppl.find(q => q.kind === 'guard' && Math.hypot(q.x - P.x, q.z - P.z) < 30); if (g) { p += 0.3; who ||= g; } } catch (e) { /* */ }
    p = K.ST.forceSeen != null ? K.ST.forceSeen : Math.min(0.9, p); // forceSeen is a test override, unclamped
    if (Math.random() >= p) return false;
    K.ST.stats.spotted++; K.save(); K.crime(1, 'vandalism: tagging in Red Tape Flats');
    K.say(who || P, 'ColSec', 'spotted', { toastToo: true }); K.emit('spotted', { id: s.id }); return true;
  }
  function rival(id) {
    const mine = SPOTS.filter(s => own(s.id)?.by === 'you'), s = id ? SPOTS.find(x => x.id === id) : mine[(Math.random() * mine.length) | 0];
    if (!s) return null;
    let gang = s.home; try { const o = K.X().turf?.ownerAt?.(K.AJ(s.at[0], s.at[1]))?.owner; if (GANGS[o]) gang = o; } catch (e) { /* SSX.turf (#15) optional */ }
    const was = own(s.id)?.by; K.ST.tags[s.id] = { by: gang, cell: gang, t: Date.now() }; if (was === 'you') K.ST.stats.lost++; K.save(); refresh();
    if (was === 'you') K.toast(`\ud83c\udfa8 ${GANGS[gang]} went over your piece on ${s.name}. Disrespectful.`, 3600);
    K.emit('covered', { id: s.id, by: gang, was }); return { id: s.id, by: gang };
  }
  return {
    build(g) { root = g; seed(); buildProps(g); buildDecals(g); buildCans(g); buildMist(g); dbg.built++;
      if (K.ST.seen && Date.now() - K.ST.seen > 15 * 60e3 && SPOTS.some(s => own(s.id)?.by === 'you') && Math.random() < 0.6) rival(); },
    dispose() { spray = null; decals = []; cans = []; mist = null; decalMat?.map && (decalMat.map = null); decalMat = null; root = null; },
    retexture() { if (!decalMat) return; decalMat.map = decalMat.emissiveMap = tagAtlas(K.ST.tag); decalMat.needsUpdate = true; },
    refresh,
    tick(dt, t, P) {
      const now = Date.now();
      for (const c of cans) { const ok = !(K.ST.canAt[c.id] > now); c.o.visible = ok; if (ok) { c.o.rotation.y += dt * 1.2; c.o.position.y = c.p.y + 0.35 + Math.sin(t * 2 + c.p.x) * 0.05; } }
      if ((nextRival -= dt) <= 0) { nextRival = 140 + Math.random() * 160; if (SPOTS.some(s => own(s.id)?.by === 'you')) rival(); }
      if (spray) {
        const s = spray.s, f = frame(s); spray.t += dt;
        if (P.driving || P.inside || Math.hypot(P.x - spray.x0, P.z - spray.z0) > 1.8) { spray = null; mist.visible = false; refresh(); K.toast('\ud83c\udfa8 Tag abandoned.', 1600); return; }
        const pos = mist.geometry.attributes.position, v = mist.userData.v, n = pos.count;
        for (let i = 0; i < n; i++) { if (Math.random() < 0.2) { pos.setXYZ(i, P.x + f.nx * 0 + (f.x - P.x) * 0.2, P.y + 1.35, P.z + (f.z - P.z) * 0.2); v[i * 3] = (f.x - P.x) * 1.6 + (Math.random() - 0.5) * 0.8; v[i * 3 + 1] = (Math.random() - 0.4) * 0.6; v[i * 3 + 2] = (f.z - P.z) * 1.6 + (Math.random() - 0.5) * 0.8; }
          else pos.setXYZ(i, pos.getX(i) + v[i * 3] * dt, pos.getY(i) + v[i * 3 + 1] * dt, pos.getZ(i) + v[i * 3 + 2] * dt); }
        pos.needsUpdate = true; mist.visible = true;
        if (((spray.t * 10) | 0) !== spray.k) { spray.k = (spray.t * 10) | 0; refresh(); }
        if (spray.t >= SPRAY_T) { spray = null; mist.visible = false; dbg.sprays++; commit(s); }
      }
    },
    acts(P) {
      if (P.driving) return []; const out = [], now = Date.now();
      for (const c of cans) if (!(K.ST.canAt[c.id] > now)) { const d = Math.hypot(P.x - c.p.x, P.z - c.p.z); if (d < 1.9) out.push({ d, label: '\ud83c\udfa8 Grab spray can', fn: () => { K.ST.canAt[c.id] = Date.now() + CAN_RESPAWN; K.ST.cans = Math.min(20, K.ST.cans + 1); K.save(); K.toast(`\ud83c\udfa8 Spray can. You\u2019ve got ${K.ST.cans}.`, 1800); K.emit('can', { id: c.id, cans: K.ST.cans }); } }); }
      if (spray) return [{ d: 0, label: `\ud83c\udfa8 Spraying\u2026 ${Math.round(spray.t / SPRAY_T * 100)}%`, fn: () => {} }];
      for (const s of SPOTS) {
        const f = frame(s), dx = P.x - f.x, dz = P.z - f.z, d = Math.hypot(dx, dz), front = dx * f.nx + dz * f.nz;
        if (d > Math.max(2.6, s.w / 2 + 1) || front < 0.2) continue;
        const o = own(s.id), mine = o?.by === 'you', label = mine ? '\ud83c\udfa8 Touch up your piece' : o ? `\ud83c\udfa8 Tag over ${GANGS[o.by] || 'their'} piece` : '\ud83c\udfa8 Tag this wall';
        out.push({ d: d + 0.5, label: K.ST.cans ? label : '\ud83c\udfa8 Need a spray can', fn: () => {
          if (!K.ST.cans) { K.toast('\ud83c\udfa8 No cans. Grab one lying around or buy a 3-pack at Hook & Crook (25 cr).', 3000); return; }
          spray = { s, t: 0, x0: P.x, z0: P.z, k: -1 }; K.emit('spray', { id: s.id }); } });
      }
      return out;
    },
    marks() { const M = []; for (const s of SPOTS) { const p = K.L(s.at[0], s.at[1]), o = own(s.id); M.push({ x: p.x, z: p.z, r: 1.8, color: o?.by === 'you' ? '#7a7a7a' : '#ffffff' }); } return M; },
    colliders() { // the freestanding props the tags are painted on (same boxes buildProps draws)
      const SZ = { container: [6, 2.4, 1.2], jersey: [6, 0.62, 0.27], dumpster: [2.3, 1.25, 0.62], yardwall: [12, 0.3, 0.13], pylon: [4.6, 0.7, 0.35] };
      return SPOTS.map(s => { const p = K.L(s.at[0], s.at[1]), [nx, nz] = s.n, [w, dpt, b] = SZ[s.prop]; return { type: 'box', x: p.x - nx * b, z: p.z - nz * b, hx: w / 2, hz: dpt / 2, yaw: Math.atan2(nx, nz), tag: 'tag:' + s.id }; });
    },
    list: () => SPOTS.map(s => { const o = own(s.id), p = K.D ? K.L(s.at[0], s.at[1]) : null; return { id: s.id, name: s.name, by: o?.by || null, t: o?.t || 0, local: [...s.at], x: p?.x, z: p?.z, mine: o?.by === 'you' }; }),
    tagAt(id) { const s = SPOTS.find(x => x.id === id); if (!s) return { ok: false, msg: 'No such spot.' }; if (!K.ST.cans) return { ok: false, msg: 'No cans.' }; if (spray) return { ok: false, msg: 'Already spraying.' }; commit(s); return { ok: true, by: 'you' }; },
    rival,
    debug: () => ({ ...dbg, spraying: spray ? spray.s.id : null, decals: decals.length, cans: cans.filter(c => c.o.visible).length })
  };
}
