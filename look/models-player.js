// v8 models: the player body API (window.SSX.models.player()), for add-ons that dress the player (Pumpkin's skins, PR #90).
// One handle for both bodies: the rigged v8 person (bone-following sockets) and the blocky v7 rig (limb-following sockets),
// so attachments survive the low-detail fallback, the classic tier and surface changes; they are re-parented on every swap.
//   const P = SSX.models.player();            // { root, body, inst, slots, sizes, attach, socket, setTint, resetTint, hideHelmet, hideHair }
//   const off = P.attach('handR', mesh);      // mesh follows the right hand; off() removes it
// Sockets are in game orientation (-Z forward, +Y up, +X = the player's right), unit scale (1 = 1 m in the player group),
// at the slot's centre in the rest pose. Anything attached gets userData.ssxKeep = true (the blocky/LOD fallback never hides it).
// Body swaps emit SSX.emit('models:player', handle). Region tints and hiding run in the body shader (no extra draws).
import * as THREE from 'three';

export const SLOTS = ['head', 'face', 'neck', 'torso', 'back', 'armL', 'armR', 'forearmL', 'forearmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'];
export const REG = { torso: 1, arms: 2, legs: 3, boots: 4, gloves: 5, helmet: 6, hair: 7 };
export const HIDE_MASK = 1 << 30; // layer nobody renders: hides one object without hiding its children (visible would)
const NREG = 8;

// ---------------------------------------------------------------- body prep (once per loaded file) ----------------------------------------------------------------
// _reg (per vertex): 0 none/skin, 1 torso, 2 arms, 3 legs, 4 boots, 5 gloves, 6 helmet (glass + collar), 7 hair (+ beard).
// From the dominant joint, the atlas cell (_cell: skin = the big cell, white = the procedural parts) and the primitive bucket.
const _p = new THREE.Vector3();
export function prepBody(file) {
  const scene = file.g.scene; scene.updateMatrixWorld(true);
  const J = {}; scene.traverse(o => { if (o.isBone) J[o.name] = { p: new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), m: o.matrixWorld.clone() }; });
  const white = (() => { const g = file.parts.glass?.geometry, c = g?.attributes._cell; return c ? key(c, g.index ? g.index.getX(0) : 0) : null; })();
  const st = { glass: box(), head: box(), spine2: box(), pack: box(), arm: [], fore: [], thigh: [], shin: [], hand: box(), foot: box() };
  for (const [kind, mesh] of Object.entries(file.parts)) {
    const g = mesh.geometry, A = g.attributes, n = A.position.count, si = A.skinIndex, sw = A.skinWeight, cell = A._cell, bones = mesh.skeleton.bones;
    if (!si || !sw || !cell) continue;
    const used = new Uint8Array(n); if (g.index) for (let i = 0; i < g.index.count; i++) used[g.index.getX(i)] = 1; else used.fill(1);
    const jn = new Array(n), wm = new Float32Array(n), ck = new Array(n), ys = new Float32Array(n), cells = new Map(), P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      if (!used[i]) continue;
      let b = 0, w = sw.getComponent(i, 0); for (let q = 1; q < 4; q++) { const x = sw.getComponent(i, q); if (x > w) { w = x; b = q; } }
      jn[i] = bones[si.getComponent(i, b)]?.name || ''; wm[i] = w; ck[i] = key(cell, i);
      mesh.applyBoneTransform(i, _p.fromBufferAttribute(A.position, i)).applyMatrix4(mesh.matrixWorld); P[i * 3] = _p.x; P[i * 3 + 1] = _p.y; P[i * 3 + 2] = _p.z; ys[i] = _p.y;
      let c = cells.get(ck[i]); if (!c) cells.set(ck[i], c = { w: cell.getW(i), lo: 9, hi: -9, n: 0, feet: 0 });
      c.n++; c.lo = Math.min(c.lo, _p.y); c.hi = Math.max(c.hi, _p.y); if (/Foot|Toe/.test(jn[i])) c.feet++;
    }
    const reg = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (!used[i]) continue;
      const j = jn[i], c = cells.get(ck[i]), isW = ck[i] === white; let r = 0;
      if (kind === 'glass') r = REG.helmet;
      else if (isW) r = j === 'Neck' && wm[i] > 0.99 ? REG.helmet : 0;
      else if (c.w > 0.4) r = /Hand/.test(j) ? REG.gloves : 0; // skin: bare hands take the glove tint
      else if (c.w < 0.2) r = /^(Head|Neck)$/.test(j) && c.hi - c.lo > 0.06 ? REG.hair : 0; // hair, beard; eyes / brows / lashes are tiny
      else if (c.feet > c.n * 0.4 || /Foot|Toe/.test(j)) r = REG.boots;
      else if (/Hand/.test(j)) r = REG.gloves;
      else if (/UpLeg|Leg$|Hips/.test(j)) r = REG.legs;
      else if (/Shoulder|Arm/.test(j)) r = REG.arms;
      else if (/Spine|Neck/.test(j)) r = REG.torso;
      reg[i] = r;
      // measurements (scene frame, metres, the body faces +Z)
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (kind === 'glass') grow(st.glass, x, y, z);
      else if (kind === 'opaque' || kind === 'mask') {
        if (j === 'Head' && c.w > 0.4) grow(st.head, x, y, z); // skin on the head: the real head size
        else if (isW && j === 'Spine2') grow(st.pack, x, y, z);
        else if (!isW && j === 'Spine2' && c.w <= 0.4) grow(st.spine2, x, y, z);
        else if (j === 'LeftArm') st.arm.push(seg(J.LeftArm, J.LeftForeArm, x, y, z));
        else if (j === 'LeftForeArm') st.fore.push(seg(J.LeftForeArm, J.LeftHand, x, y, z));
        else if (j === 'LeftUpLeg') st.thigh.push(seg(J.LeftUpLeg, J.LeftLeg, x, y, z));
        else if (j === 'LeftLeg') st.shin.push(seg(J.LeftLeg, J.LeftFoot, x, y, z));
        else if (j === 'LeftHand') grow(st.hand, x, y, z);
        else if (j === 'LeftFoot' || j === 'LeftToeBase') grow(st.foot, x, y, z);
      }
    }
    g.setAttribute('_reg', new THREE.BufferAttribute(reg, 1));
  }
  // the glass bubble is rigid on Head: its rest-pose box is the helmet (centre, radius)
  const hb = st.glass; const helmet = hb.n ? { c: hb.lo.clone().add(hb.hi).multiplyScalar(0.5), r: (hb.hi.x - hb.lo.x) / 2 } : null;
  file.rest = { J, st, helmet };
  return file.rest;
}
const key = (a, i) => ((a.getX(i) * 4096) | 0) + ',' + ((a.getY(i) * 4096) | 0);
const box = () => ({ lo: new THREE.Vector3(9, 9, 9), hi: new THREE.Vector3(-9, -9, -9), n: 0 });
const grow = (b, x, y, z) => { b.lo.min(_p.set(x, y, z)); b.hi.max(_p); b.n++; };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function seg(A, B, x, y, z) { if (!A || !B) return 0; _a.copy(B.p).sub(A.p); const t = THREE.MathUtils.clamp(_b.set(x, y, z).sub(A.p).dot(_a) / _a.lengthSq(), 0, 1); return _c.copy(A.p).addScaledVector(_a, t).distanceTo(_b.set(x, y, z)); }
const median = (a) => { if (!a.length) return 0; const s = Float32Array.from(a).sort(); return s[s.length >> 1]; };

// shader bits for charMaterial (models.js): per-region tint (rgb, k) and hide (k < 0)
export function regionUniforms() { return { uReg: { value: Array.from({ length: NREG }, () => new THREE.Vector4(1, 1, 1, 0)) } }; }
export const REG_VS = ['attribute float _reg;\nflat varying float vReg;', 'vReg = _reg;'];
export const REG_FS = ['flat varying float vReg;\nuniform vec4 uReg[' + NREG + '];', 'vec4 rT = uReg[int(clamp(vReg + 0.5, 0.0, ' + (NREG - 1) + '.0))];\nif (rT.a < -0.5) discard;',
  'if (rT.a > 0.0) { float lR = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, rT.rgb * clamp(0.32 + lR * 1.5, 0.32, 1.1), rT.a); }'];

// ---------------------------------------------------------------- sockets ----------------------------------------------------------------
// v8 body: rest-pose slot centres (scene frame of the GLB) -> group frame through the instance root (rotation.y = PI, scale k)
function v8Slots(rest) {
  const J = rest.J, P = n => J[n]?.p || new THREE.Vector3(), mid = (a, b, t = 0.5) => P(a).clone().lerp(P(b), t);
  const head = rest.helmet ? rest.helmet.c.clone() : mid('Head', 'HeadTop_End'), hr = headR(rest);
  const st = rest.st, front = st.spine2.n ? st.spine2.hi.z : P('Spine2').z + 0.12, backZ = st.pack.n ? st.pack.lo.z : st.spine2.n ? st.spine2.lo.z : P('Spine2').z - 0.14;
  const hand = (s) => P(s + 'Hand').clone().addScaledVector(P(s + 'Hand').clone().sub(P(s + 'ForeArm')).normalize(), 0.08);
  const chest = mid('Spine2', 'Neck', 0.4);
  return {
    head: ['Head', head], face: ['Head', head.clone().add(new THREE.Vector3(0, -0.01, hr * 0.92))], neck: ['Neck', mid('Neck', 'Head')],
    torso: ['Spine2', new THREE.Vector3(chest.x, chest.y, (front + (st.spine2.n ? st.spine2.lo.z : chest.z)) / 2)], back: ['Spine2', new THREE.Vector3(chest.x, chest.y - 0.04, backZ)],
    armL: ['LeftArm', mid('LeftArm', 'LeftForeArm')], armR: ['RightArm', mid('RightArm', 'RightForeArm')],
    forearmL: ['LeftForeArm', mid('LeftForeArm', 'LeftHand')], forearmR: ['RightForeArm', mid('RightForeArm', 'RightHand')],
    handL: ['LeftHand', hand('Left')], handR: ['RightHand', hand('Right')],
    legL: ['LeftUpLeg', mid('LeftUpLeg', 'LeftLeg')], legR: ['RightUpLeg', mid('RightUpLeg', 'RightLeg')],
    shinL: ['LeftLeg', mid('LeftLeg', 'LeftFoot')], shinR: ['RightLeg', mid('RightLeg', 'RightFoot')],
    footL: ['LeftFoot', footC(rest, 'Left')], footR: ['RightFoot', footC(rest, 'Right')],
  };
}
const headR = (rest) => { const h = rest.st.head; return h.n ? Math.max(h.hi.x - h.lo.x, h.hi.z - h.lo.z) / 2 : rest.helmet ? (rest.helmet.r - 0.02) / 1.22 : 0.11; };
function footC(rest, s) { const a = rest.J[s + 'Foot']?.p, b = rest.J[s + 'ToeBase']?.p; if (!a || !b) return a?.clone() || new THREE.Vector3(); const c = a.clone().lerp(b, 0.5); c.y = Math.max(0.05, (a.y + b.y) / 2 - 0.03); return c; }
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _o = new THREE.Vector3(), _y = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
function socketsV8(inst, rest, k) {
  if (inst.sockets && inst.sockK === k) return inst.sockets;
  for (const s of Object.values(inst.sockets || {})) s.removeFromParent();
  const root = _r.compose(_o.set(0, 0, 0), _y, _s.setScalar(k)), out = {}, slots = v8Slots(rest);
  for (const name of SLOTS) {
    const [bn, p] = slots[name], bone = inst.bones[bn], J = rest.J[bn]; if (!bone || !J) continue;
    const pg = p.clone().applyMatrix4(root); // slot centre, group frame
    const boneG = new THREE.Matrix4().multiplyMatrices(root, J.m); // bone at rest, group frame
    const s = new THREE.Group(); s.name = 'ssxSocket:' + name; s.userData.ssxKeep = true; s.userData.ssxSocket = name; s.matrixAutoUpdate = false;
    s.matrix.copy(boneG.invert()).multiply(_m.makeTranslation(pg.x, pg.y, pg.z)); s.matrixWorldNeedsUpdate = true;
    bone.add(s); out[name] = s;
  }
  inst.sockets = out; inst.sockK = k; return out;
}
function sizesV8(rest, k) {
  const J = rest.J, d = (a, b) => (J[a] && J[b] ? J[a].p.distanceTo(J[b].p) : 0), st = rest.st, r = v => +(v * k).toFixed(3);
  const ra = median(st.arm), rf = median(st.fore), rt = median(st.thigh), rs = median(st.shin), hb = st.hand, fb = st.foot, tb = st.spine2;
  return {
    body: 'v8', scale: k, height: r(J.HeadTop_End?.p.y ?? 1.75), headRadius: r(headR(rest)), helmetRadius: r(rest.helmet?.r ?? 0.2), neckRadius: r(0.06),
    shoulderWidth: r(d('LeftArm', 'RightArm') + 2 * ra), shoulderSpan: r(d('LeftArm', 'RightArm')), hipWidth: r(d('LeftUpLeg', 'RightUpLeg') + 2 * rt), hipSpan: r(d('LeftUpLeg', 'RightUpLeg')),
    torso: { w: r(tb.n ? tb.hi.x - tb.lo.x : 0.34), h: r(d('Spine2', 'Neck') + 0.12), d: r(tb.n ? tb.hi.z - tb.lo.z : 0.24) }, packDepth: r(st.pack.n ? st.pack.hi.z - st.pack.lo.z : 0),
    upperArm: r(d('LeftArm', 'LeftForeArm')), forearm: r(d('LeftForeArm', 'LeftHand')), armLength: r(d('LeftArm', 'LeftForeArm') + d('LeftForeArm', 'LeftHand')),
    armRadius: r(ra), forearmRadius: r(rf), handLength: r(hb.n ? Math.max(hb.hi.x - hb.lo.x, hb.hi.y - hb.lo.y) : 0.18), handRadius: r(rf * 0.9),
    thigh: r(d('LeftUpLeg', 'LeftLeg')), shin: r(d('LeftLeg', 'LeftFoot')), legLength: r(d('LeftUpLeg', 'LeftLeg') + d('LeftLeg', 'LeftFoot')), legRadius: r(rt), shinRadius: r(rs),
    footLength: r(fb.n ? fb.hi.z - fb.lo.z : 0.25), footWidth: r(fb.n ? fb.hi.x - fb.lo.x : 0.1),
  };
}
// blocky v7 rig (models.js buildAstronaut): head/torso sockets on the group, limb sockets on the swinging limb meshes
const PG = (o, t) => (o?.isMesh && o.geometry?.type === t ? o.geometry.parameters : null);
export function readRig(g) {
  const r = { torso: null, pack: null, chest: null, helmet: null, visor: null, arms: {}, legs: {}, boots: [] };
  for (const o of g.children) {
    let p;
    if ((p = PG(o, 'BoxGeometry'))) { if (p.width === 0.56) r.torso = o; else if (p.width === 0.48) r.pack = o; else if (p.width === 0.26) r.chest = o; }
    else if ((p = PG(o, 'SphereGeometry'))) { if (Math.abs(p.radius - 0.23) < 1e-3) r.helmet = o; else if (Math.abs(p.radius - 0.18) < 1e-3) r.visor = o; }
    else if ((p = PG(o, 'CylinderGeometry'))) { const s = o.position.x < 0 ? 'L' : 'R'; if (Math.abs(p.radiusTop - 0.12) < 1e-3) { r.legs[s] = o; for (const c of o.children) if (PG(c, 'BoxGeometry')?.width === 0.2) r.boots.push(c); } else if (Math.abs(p.radiusTop - 0.085) < 1e-3) r.arms[s] = o; }
  }
  return r;
}
const BLOCKY = { head: [null, 0, 1.72, 0], face: [null, 0, 1.72, -0.23], neck: [null, 0, 1.53, 0], torso: [null, 0, 1.24, 0], back: [null, 0, 1.28, 0.43],
  arm: [0, -0.2, 0], forearm: [0, -0.5, 0], hand: [0, -0.7, 0], leg: [0, -0.24, 0], shin: [0, -0.6, 0], foot: [0, -0.86, -0.04] };
function socketsBlocky(g) {
  if (g.userData.ssxSockets) return g.userData.ssxSockets;
  const rig = readRig(g), out = {};
  for (const name of SLOTS) {
    const m = /^(arm|forearm|hand|leg|shin|foot)([LR])$/.exec(name);
    const par = m ? (/arm|hand/.test(m[1]) ? rig.arms[m[2]] : rig.legs[m[2]]) : g; if (!par) continue;
    const p = m ? BLOCKY[m[1]] : BLOCKY[name].slice(1);
    const s = new THREE.Group(); s.name = 'ssxSocket:' + name; s.userData.ssxKeep = true; s.userData.ssxSocket = name; s.position.set(p[0], p[1], p[2]); par.add(s); out[name] = s;
  }
  g.userData.ssxSockets = out; g.userData.ssxRigParts = rig; return out;
}
const SIZES_BLOCKY = { body: 'blocky', scale: 1, height: 1.95, headRadius: 0.23, helmetRadius: 0.23, neckRadius: 0.1, shoulderWidth: 0.91, shoulderSpan: 0.74, hipWidth: 0.5, hipSpan: 0.26,
  torso: { w: 0.56, h: 0.66, d: 0.36 }, packDepth: 0.26, upperArm: 0.35, forearm: 0.35, armLength: 0.7, armRadius: 0.085, forearmRadius: 0.08, handLength: 0.1, handRadius: 0.077,
  thigh: 0.44, shin: 0.44, legLength: 0.88, legRadius: 0.12, shinRadius: 0.11, footLength: 0.32, footWidth: 0.2 };

// ---------------------------------------------------------------- the handle ----------------------------------------------------------------
export function makePlayerApi(S, isAstro) {
  const att = new Map(); // obj -> slot
  let tint = null, helm = false, hair = false;
  const H = {
    root: null, body: null, inst: null, model: null, slots: SLOTS.slice(), sizes: { ...SIZES_BLOCKY, body: null }, sockets: {},
    socket: (slot) => H.sockets[slot] || null,
    attach(slot, obj) {
      if (!SLOTS.includes(slot)) throw new Error('SSX.models.player().attach: unknown slot ' + slot + ' (' + SLOTS.join(', ') + ')');
      if (!obj?.isObject3D) throw new Error('SSX.models.player().attach(slot, Object3D)');
      obj.traverse(o => { o.userData.ssxKeep = true; }); obj.userData.ssxSlot = slot; att.set(obj, slot); place(obj, slot);
      return () => { if (att.get(obj) !== slot) return false; att.delete(obj); obj.removeFromParent(); return true; };
    },
    detachAll() { for (const o of att.keys()) o.removeFromParent(); att.clear(); },
    attached: () => [...att].map(([o, s]) => ({ slot: s, obj: o })),
    setTint(t = {}) { tint = { ...(tint || {}), ...t }; for (const k of Object.keys(tint)) if (tint[k] == null) delete tint[k]; applyLook(); return H; },
    resetTint() { tint = null; applyLook(); return H; },
    hideHelmet(on = true) { helm = !!on; applyLook(); return H; },
    hideHair(on = true) { hair = !!on; applyLook(); return H; },
    state: () => ({ body: H.body, attached: att.size, tint: tint ? Object.keys(tint) : [], helmetHidden: helm, hairHidden: hair, root: !!H.root }),
  };
  function place(obj, slot) { const s = H.sockets[slot]; if (s) { if (obj.parent !== s) s.add(obj); } else obj.removeFromParent(); }
  // ---- looks: v8 = shader uniforms on the player's materials; blocky = per-mesh material clones / layer hides
  const col = new THREE.Color();
  function spec(v) { if (v == null) return null; if (typeof v === 'object' && !v.isColor && 'color' in v) return { c: col.set(v.color).clone(), k: v.k ?? v.strength ?? 0.85 }; return { c: col.set(v).clone(), k: 0.85 }; }
  function applyLook() {
    const inst = H.inst;
    if (inst) {
      const mats = new Set(); for (const o of [...inst.meshes.lod0, ...inst.meshes.lod1]) if (o.material?.userData?.U?.uReg) mats.add(o.material.userData.U.uReg.value);
      for (const R of mats) {
        for (const v of R) v.set(1, 1, 1, 0);
        for (const [name, k] of Object.entries(REG)) { const sp = tint && spec(tint[name]); if (sp) R[k].set(sp.c.r, sp.c.g, sp.c.b, sp.k); }
        if (helm) R[REG.helmet].w = -1; if (hair) R[REG.hair].w = -1;
      }
      for (const o of inst.meshes.lod0) if (o.material?.transparent) hideL(o, helm); // the glass bubble: no draw, no shadow
    }
    const g = H.root, rig = g && g.userData.ssxRigParts; if (!rig) return;
    const reg = { torso: [rig.torso], arms: [rig.arms.L, rig.arms.R], legs: [rig.legs.L, rig.legs.R], boots: rig.boots, gloves: [] };
    for (const [name, list] of Object.entries(reg)) for (const o of list) { if (!o) continue; const sp = !inst && tint && spec(tint[name]); recolor(o, sp); }
    for (const o of [rig.helmet, rig.visor]) if (o) { if (helm && !inst) { if (o.userData.__ssxHelm === undefined) { o.userData.__ssxHelm = o.visible; o.visible = false; } } else if (o.userData.__ssxHelm !== undefined) { o.visible = o.userData.__ssxHelm; delete o.userData.__ssxHelm; } }
  }
  function hideL(o, on) { if (on) { if (o.userData.__ssxHelmL === undefined) { o.userData.__ssxHelmL = o.layers.mask; o.layers.mask = HIDE_MASK; } } else if (o.userData.__ssxHelmL !== undefined) { if (o.layers.mask === HIDE_MASK) o.layers.mask = o.userData.__ssxHelmL; delete o.userData.__ssxHelmL; } }
  function recolor(o, sp) {
    const u = o.userData;
    if (!sp) { if (u.__ssxTintMat && o.material === u.__ssxTintMat) o.material = u.__ssxTintOrig; delete u.__ssxTintMat; delete u.__ssxTintOrig; return; }
    if (!u.__ssxTintMat || o.material !== u.__ssxTintMat) { u.__ssxTintOrig = o.material; u.__ssxTintMat = o.material.clone(); u.__ssxTintMat.userData = { ...o.material.userData, ssxTint: true }; o.material = u.__ssxTintMat; }
    u.__ssxTintMat.color?.copy(u.__ssxTintOrig.color || col.setRGB(1, 1, 1)).lerp(sp.c, sp.k);
  }
  // ---- swap tracking: called at the end of every surface tick (models on or off)
  let lastG = null, lastI = null;
  function find(ctx) { for (const o of ctx?.scene?.children || []) if (o.isGroup && !o.userData.ssxMannequin && isAstro(o)) return o; return null; }
  H.sync = (ctx) => {
    const sc = ctx?.scene; let g;
    if (S.player?.group?.parent) g = S.player.group;
    else if (lastG && lastG.parent && lastG.parent === sc) g = lastG;
    else if (lastG) g = find(ctx); // the rig left the scene (surface change): look again now
    else g = S.frame % 15 === 0 ? find(ctx) : null; // no player yet: scan every 15 frames
    const e = S.player && S.player.group === g ? S.player : null, inst = e?.inst || null;
    if (g === lastG && inst === lastI) return false;
    if (lastI && lastI !== inst) clearLook(lastI);
    lastG = g; lastI = inst; H.root = g; H.inst = inst; H.model = inst?.root || null;
    if (!g) { H.body = null; H.sockets = {}; for (const o of att.keys()) o.removeFromParent(); return true; }
    if (inst) { const rest = S.files.get(inst.id)?.ready?.rest; const k = e.info.scale; H.sockets = rest ? socketsV8(inst, rest, k) : {}; H.sizes = rest ? sizesV8(rest, k) : { ...SIZES_BLOCKY }; H.body = 'v8'; socketsBlocky(g); }
    else { H.sockets = socketsBlocky(g); H.sizes = { ...SIZES_BLOCKY }; H.body = 'blocky'; }
    for (const [o, s] of att) place(o, s);
    applyLook();
    try { const X = bus(); X?.emit?.('models:player', H); } catch (err) { console.warn('v8 models: models:player listener', err); }
    return true;
  };
  function clearLook(inst) { for (const o of [...inst.meshes.lod0, ...inst.meshes.lod1]) { const R = o.material?.userData?.U?.uReg?.value; if (R) for (const v of R) v.set(1, 1, 1, 0); if (o.material?.transparent) hideL(o, false); } }
  return H;
}
// SSX event bus: index.html's SSX.on / SSX.emit when present; otherwise a tiny one that never replaces an existing method
function bus() {
  const X = window.SSX; if (!X) return null;
  if (typeof X.emit !== 'function' || typeof X.on !== 'function') {
    const t = X.__ssxBus || (X.__ssxBus = new EventTarget());
    if (typeof X.on !== 'function') X.on = (type, fn) => { const h = ev => fn(ev.detail); t.addEventListener(type, h); return () => t.removeEventListener(type, h); };
    if (typeof X.emit !== 'function') X.emit = (type, detail = {}) => t.dispatchEvent(new CustomEvent(type, { detail }));
  }
  return X;
}
export { bus as ssxBus };
