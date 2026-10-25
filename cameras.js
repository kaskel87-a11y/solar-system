// Security cameras: a mast, a head that sweeps, and a flat view wedge on the ground (teal -> amber -> red as the
// detection meter fills). Logic is heistcore.stepCamera; this file is visuals + the per-frame loop. Cheap: shared
// geometry/materials, one wedge mesh per camera, nothing at all for cameras on other worlds.
import * as THREE from 'three';
import { normCamera, stepCamera } from './heistcore.js?v=7.4';
import { toWorld } from './heisthooks.js?v=7.4';

const G = {}, M = {};
function shared() {
  if (G.mast) return;
  G.mast = new THREE.CylinderGeometry(0.07, 0.09, 1, 6); G.head = new THREE.BoxGeometry(0.34, 0.24, 0.5); G.lens = new THREE.SphereGeometry(0.07, 8, 6);
  M.mast = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.6 }); M.head = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4 });
  for (const m of Object.values(M)) m.userData.shared = true;
}
const COL = { idle: new THREE.Color(0x1ec8b4), warn: new THREE.Color(0xffb020), hot: new THREE.Color(0xff2a2a), off: new THREE.Color(0x444a55) };

export function createCameras() {
  const cams = new Map(); let root = null, scene = null, time = 0;
  function build(c, ctx) {
    shared(); const g = new THREE.Group(), y0 = ctx.height(c.wx, c.wz);
    const mast = new THREE.Mesh(G.mast, M.mast); mast.scale.y = c.y; mast.position.set(0, c.y / 2, 0); g.add(mast);
    const head = new THREE.Group(); head.position.y = c.y; g.add(head);
    head.add(new THREE.Mesh(G.head, M.head)); const lens = new THREE.Mesh(G.lens, new THREE.MeshBasicMaterial({ color: 0xff3030 })); lens.position.z = -0.27; head.add(lens);
    const wedge = new THREE.Mesh(new THREE.CircleGeometry(c.range, 18, Math.PI / 2 - c.fov / 2, c.fov), new THREE.MeshBasicMaterial({ color: COL.idle, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    wedge.rotation.x = -Math.PI / 2; wedge.position.y = 0.06 - c.y; wedge.renderOrder = 2;
    const wg = new THREE.Group(); wg.position.y = c.y; wg.add(wedge); g.add(wg);
    g.position.set(c.wx, y0, c.wz); root.add(g);
    c.vis = { g, head, wg, wedge, lens };
  }
  function ensureRoot(ctx) { if (root && scene === ctx.scene) return; drop(); scene = ctx.scene; root = new THREE.Group(); root.name = 'heistCameras'; scene.add(root); }
  function drop() { if (root) { root.traverse(o => { if (o.isMesh && !o.material.userData?.shared) { o.material.dispose?.(); if (o.geometry !== G.mast && o.geometry !== G.head && o.geometry !== G.lens) o.geometry.dispose?.(); } }); root.parent?.remove(root); } root = null; for (const c of cams.values()) c.vis = null; }
  return {
    add(def) { if (!def?.id) throw new Error('addCamera({ id, x, z, yaw, fov, range, sweep, level, world?, rel? })'); this.remove(def.id); const c = normCamera(def); c.world = def.world || 'Mars'; c.rel = def.rel || null; c.disableS = def.disableS ?? 60; c.raw = { x: c.x, z: c.z }; cams.set(c.id, c); return c.id; },
    remove(id) { const c = cams.get(id); if (!c) return false; if (c.vis) { c.vis.g.parent?.remove(c.vis.g); c.vis.wedge.geometry.dispose(); c.vis.wedge.material.dispose(); c.vis.lens.material.dispose(); } cams.delete(id); return true; },
    removeWhere(fn) { for (const c of [...cams.values()]) if (fn(c)) this.remove(c.id); },
    get(id) { return cams.get(id) || null; },
    list: () => [...cams.values()],
    disable(id, s) { const c = cams.get(id); if (!c) return false; c.disabledFor = s ?? c.disableS; c.meter = 0; return true; },
    // per frame. target: { x, z, hidden, speed }. onAlert(cam) fires once per detection.
    update(dt, ctx, target, onAlert) {
      time += dt; let maxMeter = 0, seeing = 0, near = null, nearD = 1e9;
      for (const c of cams.values()) {
        if (c.world !== ctx.name) { if (c.vis) { c.vis.g.parent?.remove(c.vis.g); c.vis = null; } continue; }
        if (c.wx == null) { const p = toWorld(ctx.world, c.raw, c.rel); if (!p) continue; c.wx = p.x; c.wz = p.z; }
        c.x = c.wx; c.z = c.wz;
        if (!c.vis) { ensureRoot(ctx); build(c, ctx); }
        const r = stepCamera(c, dt, target, time);
        if (r === 'alert') onAlert?.(c);
        if (r === 'seeing') seeing++;
        maxMeter = Math.max(maxMeter, c.meter);
        const v = c.vis; v.head.rotation.y = c.yaw; v.wg.rotation.y = c.yaw;
        const off = c.disabledFor > 0, col = off ? COL.off : c.meter > 0.66 ? COL.hot : c.meter > 0.05 ? COL.warn : COL.idle;
        v.wedge.material.color.copy(col); v.wedge.material.opacity = off ? 0.05 : 0.14 + c.meter * 0.25; v.lens.material.color.set(off ? 0x222222 : (time * 2 % 1 < 0.5 ? 0xff3030 : 0x661010));
        const d = Math.hypot(target.x - c.x, target.z - c.z); if (!off && d < nearD) { nearD = d; near = c; }
      }
      return { maxMeter, seeing, near, nearD };
    },
    clearVisuals: drop,
    reset() { for (const c of cams.values()) { c.wx = null; c.vis = null; } drop(); } // world left / re-entered: re-resolve colony coords
  };
}
