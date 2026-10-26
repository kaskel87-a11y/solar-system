// Heist guards (v7.5.4): patrol def.guards waypoints, react to alarms / camera spots, then investigate -> call backup ->
// lock down. Logic is guardcore.js (pure); this file is meshes, movement, hit boxes, line of sight and the world hooks.
// No police AI of our own: backup = +1 star and the heist:alarm:response event (index.html's private security answers it).
// Phones: guards take NPC slots via world.npcReserve('heist-guards', n) so the scene stays <= world.npcBudget().cap (12).
import * as THREE from 'three';
import { normGuard, guardSlots, guardSees, createAlert, raiseAlert, stepAlert, stepGuard, hitGuard, fireDecision, lockdownPosts, lockedDown } from './guardcore.js';
import { losClear, pushOut, losCache, boxHit } from './heistlos.js';
import { toWorld, isIndoors, patchHittables, npcBudget, ambientOn, npcReserve } from './heisthooks.js';

const G = {}, M = {}, TEX = {};
function shared() {
  if (G.body) return;
  G.body = new THREE.BoxGeometry(0.56, 0.7, 0.32); G.leg = new THREE.BoxGeometry(0.2, 0.8, 0.22); G.head = new THREE.SphereGeometry(0.17, 10, 8);
  G.cap = new THREE.CylinderGeometry(0.19, 0.2, 0.09, 10); G.brim = new THREE.BoxGeometry(0.26, 0.03, 0.16); G.arm = new THREE.BoxGeometry(0.14, 0.62, 0.16);
  G.torch = new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6); G.cone = new THREE.ConeGeometry(1.6, 7, 14, 1, true); G.cone.translate(0, -3.5, 0); G.cone.rotateX(-Math.PI / 2);
  M.suit = new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.75 }); M.vest = new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.6 });
  M.skin = new THREE.MeshStandardMaterial({ color: 0xc89a78, roughness: 0.8 }); M.capM = new THREE.MeshStandardMaterial({ color: 0x14192a, roughness: 0.6 });
  M.torch = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xfff2b0, emissiveIntensity: 1.2 });
  M.cone = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
  M.coneHot = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  M.tracer = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
  for (const m of Object.values(M)) m.userData.shared = true;
}
function iconTex(ch, color) {
  if (TEX[ch]) return TEX[ch]; if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(8,10,20,.75)'; x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.fill(); x.lineWidth = 4; x.strokeStyle = color; x.stroke();
  x.fillStyle = color; x.font = 'bold 40px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 32, 35);
  const t = new THREE.CanvasTexture(c); t.userData = { shared: true }; return (TEX[ch] = t);
}
function buildGuard() {
  shared(); const g = new THREE.Group(), add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(G.leg, M.suit, -0.13, 0.4, 0); add(G.leg, M.suit, 0.13, 0.4, 0); add(G.body, M.vest, 0, 1.15, 0);
  add(G.arm, M.suit, -0.36, 1.12, 0); const arm = add(G.arm, M.suit, 0.36, 1.18, -0.16); arm.rotation.x = -1.1;
  add(G.head, M.skin, 0, 1.68, 0); add(G.cap, M.capM, 0, 1.8, 0); add(G.brim, M.capM, 0, 1.78, -0.15);
  const torch = add(G.torch, M.torch, 0.36, 1.32, -0.42); torch.rotation.x = Math.PI / 2;
  const cone = new THREE.Mesh(G.cone, M.cone); cone.position.set(0.36, 1.3, -0.5); cone.rotation.x = 0.12; cone.renderOrder = 2; g.add(cone);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex('?', '#ffb020'), depthTest: false, transparent: true })); icon.scale.set(0.6, 0.6, 0.6); icon.position.y = 2.35; icon.visible = false; icon.renderOrder = 5; g.add(icon);
  const tr = new THREE.BufferGeometry(); tr.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3)); const tracer = new THREE.Line(tr, M.tracer); tracer.visible = false; tracer.frustumCulled = false;
  return { g, cone, icon, tracer, tracerT: 0 };
}

export function createGuards({ emit, alarm, onBackup, onLockdown, onSealed } = {}) {
  let list = [], A = null, def = null, root = null, scene = null, opts = { fire: true }, resolved = false, time = 0, reserved = 0, boxes = [], worldRef = null;
  const cache = losCache(0.12);
  const live = () => list.filter(g => g.state !== 'down');
  function reserve(world, n) { reserved = n; npcReserve(world, 'heist-guards', n || 0); }
  function dropAll() {
    for (const g of list) { if (g.vis) { g.vis.g.parent?.remove(g.vis.g); g.vis.tracer.parent?.remove(g.vis.tracer); g.vis.icon.material.dispose(); g.vis.tracer.geometry.dispose(); } }
    if (root) root.parent?.remove(root); root = null; list = [];
  }
  function blocked(world) { return (x, y, z) => boxHit(boxes, x, y, z) || !!world?.camBlocked?.(x, y, z); }
  function resolve(ctx) {
    const W = ctx.world, out = [];
    for (const [i, gd] of (def.guards || []).entries()) {
      const p0 = toWorld(W, Array.isArray(gd) ? { x: gd[0], z: gd[1] } : gd, def.rel); if (!p0) return false;
      const route = (gd.route || []).map(p => toWorld(W, Array.isArray(p) ? { x: p[0], z: p[1] } : p, def.rel));
      out.push(normGuard({ ...gd, x: p0.x, z: p0.z, route }, i, def.guard || {}));
    }
    const b = npcBudget(W), mobile = b ? b.cap <= 12 : true;
    const n = guardSlots(out.length, b, { mobile, ambientOn: ambientOn(W) }); list = out.slice(0, n);
    reserve(W, list.length); resolved = true; worldRef = W;
    patchHittables(W, () => list.filter(g => g.state !== 'down' && g.vis).map(g => g.hittable));
    if (!scene || scene !== ctx.scene) { scene = ctx.scene; }
    root = new THREE.Group(); root.name = 'heistGuards'; scene.add(root);
    for (const g of list) {
      g.vis = buildGuard(); root.add(g.vis.g); root.add(g.vis.tracer);
      g.hittable = { kind: 'guard', r: 0.75, get alive() { return g.state !== 'down'; }, hostile: true, x: g.x, y: 0, z: g.z, hit: (dmg, kind, from) => onHit(g, dmg, kind, from) };
    }
    emit?.('guards', { id: def.id, n: list.length, want: out.length, cap: b?.cap ?? null });
    return true;
  }
  function onHit(g, dmg, kind, from) {
    const r = hitGuard(g, dmg, kind, from);
    emit?.('guard:hit', { id: g.id, heistId: def?.id, kind, hp: Math.max(0, +g.hp.toFixed(2)), down: r.down, silent: r.silent });
    if (r.down) { emit?.('guard:down', { id: g.id, heistId: def?.id, silent: r.silent }); reserve(worldRef, live().length); }
    if (!r.silent && A && A.phase === 'calm') alarm?.((def?.alarm?.wanted) || 2, `${def?.title || 'heist'}: shots at a guard`, from);
    else if (!r.silent && from && A) raiseAlert(A, from);
    return true;
  }
  return {
    start(d) { this.stop(); def = d; A = createAlert(d.lockdown || {}); resolved = false; time = 0; },
    stop() { if (worldRef) npcReserve(worldRef, 'heist-guards', 0); reserved = 0; dropAll(); def = null; A = null; resolved = false; worldRef = null; },
    setBoxes(b) { boxes = b || []; },
    setOptions(o) { Object.assign(opts, o || {}); return { ...opts }; },
    // an alarm / camera spot / guard sighting at pos (usually the player)
    alert(pos, why) { if (!A) return null; const ph = raiseAlert(A, pos); if (ph) emit?.('guards:alert', { id: def.id, phase: A.phase, x: pos?.x, z: pos?.z, why }); return ph; },
    get phase() { return A ? A.phase : null; }, get lockLeft() { return A ? A.lockLeft : 0; }, get lockdown() { return !!A && lockedDown(A); },
    get breakinMul() { return A && lockedDown(A) ? A.cfg.breakinMul : 1; }, get escapeMul() { return A && lockedDown(A) ? A.cfg.escapeMul : 1; },
    get reserved() { return reserved; },
    list: () => list.map(g => ({ id: g.id, x: +g.x.toFixed(2), z: +g.z.toFixed(2), yaw: +g.yaw.toFixed(2), state: g.state, hp: +Math.max(0, g.hp).toFixed(2), meter: +g.meter.toFixed(2), aware: g.aware, post: g.post })),
    tick(dt, ctx, run) {
      if (!def || !run) return; time += dt;
      if (!resolved) { if (!run.w) return; if (!resolve(ctx)) return; }
      const W = ctx.world, P = ctx.player, hidden = isIndoors(W), blk = blocked(W), car = ctx.car;
      const py = (car ? car.y ?? ctx.height(P.x, P.z) : ctx.height(P.x, P.z)) + 1.2;
      const see = g => {
        if (hidden || opts.passive) return 0; // passive: legacy heist e2e (guards walk but never notice you)
        const k = guardSees(g, P.x, P.z, A.phase !== 'calm' || g.aware); if (k <= 0) return 0;
        return cache(g.id, time, () => losClear({ x: g.x, y: ctx.height(g.x, g.z) + 1.6, z: g.z }, { x: P.x, y: py, z: P.z }, blk, { skipA: 0.5 })) ? k : 0;
      };
      const ev = stepAlert(A, dt, list);
      if (ev) emit?.('guards:' + ev, { id: def.id, phase: A.phase, last: A.last, lockLeft: A.lockLeft });
      if (ev === 'backup') onBackup?.(A.last);
      if (ev === 'lockdown') { const posts = lockdownPosts(run.w.site, run.w.door, live().length); live().forEach((g, i) => { g.post = posts[i]; }); onLockdown?.(A); }
      if (ev === 'sealed') onSealed?.(A);
      for (const g of list) {
        const v = g.vis, y0 = ctx.height(g.x, g.z);
        if (g.state === 'down') { // fall over, then fade out
          v.g.rotation.x = Math.max(-Math.PI / 2, v.g.rotation.x - dt * 4); v.icon.visible = false; v.cone.visible = false; v.g.position.set(g.x, y0 + 0.15, g.z);
          if (g.downT > 20 && v.g.visible) v.g.visible = false; continue;
        }
        const r = stepGuard(g, dt, { px: P.x, pz: P.z, see, A });
        if (r.evt === 'spotted') { emit?.('guard:spotted', { id: g.id, heistId: def.id, x: P.x, z: P.z }); if (A.phase === 'calm') alarm?.(def.alarm?.wanted || 2, `${def.title}: a guard spotted you`, { x: P.x, z: P.z }); else raiseAlert(A, { x: P.x, z: P.z }); }
        if (r.goal && r.speed > 0) {
          const dx = r.goal.x - g.x, dz = r.goal.z - g.z, d = Math.hypot(dx, dz) || 1, s = Math.min(d, r.speed * dt);
          let nx = g.x + dx / d * s, nz = g.z + dz / d * s;
          const c = W.collide?.(nx, nz, 0.4); if (c) { nx = c.x; nz = c.z; } const c2 = pushOut(boxes, nx, nz, 0.4); if (c2) { nx = c2.x; nz = c2.z; }
          g.x = nx; g.z = nz; const fy = Math.atan2(-dx, -dz); g.yaw += Math.atan2(Math.sin(fy - g.yaw), Math.cos(fy - g.yaw)) * Math.min(1, dt * 7);
        }
        if (r.face) { const fy = Math.atan2(-(r.face.x - g.x), -(r.face.z - g.z)); g.yaw += Math.atan2(Math.sin(fy - g.yaw), Math.cos(fy - g.yaw)) * Math.min(1, dt * 8); }
        if (g.state === 'post' && !r.goal && run.w) { const fy = Math.atan2(-(g.x - run.w.site.x), -(g.z - run.w.site.z)); g.yaw += Math.atan2(Math.sin(fy - g.yaw), Math.cos(fy - g.yaw)) * Math.min(1, dt * 3); } // face out
        // shooting: hitscan with a short tracer; misses are common at range. Off in peaceful tests via setOptions({ fire:false })
        const dP = Math.hypot(P.x - g.x, P.z - g.z), f = opts.fire && !hidden && !ctx.game?.isDown?.() ? fireDecision(g, dP) : null;
        if (f) {
          const pos = v.tracer.geometry.attributes.position, mx = f.hit ? 0 : (Math.random() - 0.5) * 2.4;
          pos.setXYZ(0, g.x - Math.sin(g.yaw) * 0.5, y0 + 1.35, g.z - Math.cos(g.yaw) * 0.5); pos.setXYZ(1, P.x + mx, py, P.z + mx * 0.6); pos.needsUpdate = true; v.tracer.visible = true; v.tracerT = 0.08;
          if (f.hit) ctx.game?.hurtPlayer?.(f.dmg, { x: g.x, z: g.z });
          emit?.('guard:fire', { id: g.id, heistId: def.id, hit: f.hit, d: +dP.toFixed(1) });
        }
        if (v.tracerT > 0) { v.tracerT -= dt; if (v.tracerT <= 0) v.tracer.visible = false; }
        // visuals
        v.g.position.set(g.x, y0, g.z); v.g.rotation.y = g.yaw;
        const hot = g.state === 'engage', susp = !hot && (g.state === 'investigate' || g.state === 'search' || g.meter > 0.15), post = g.state === 'post';
        v.icon.visible = hot || susp || post; if (v.icon.visible) { const t = hot ? iconTex('!', '#ff3c3c') : post ? iconTex('🔒', '#ff8a3c') : iconTex('?', '#ffb020'); if (v.icon.material.map !== t) { v.icon.material.map = t; v.icon.material.needsUpdate = true; } }
        v.cone.material = hot || post ? M.coneHot : M.cone;
        Object.assign(g.hittable, { x: g.x, y: y0 + 1.1, z: g.z });
      }
    },
    debug: { alert: () => A, raw: () => list }
  };
}
