// v7.5.71 glowing red sky beam over Red Static Gulch (the outlaw grow op), once you own it.
// Same column as the dark green owned-place beams (mars/ownedbeams.js): one cylinder, fog off, depthWrite off,
// not frustum-culled (so the phone perf cull leaves it up across the dunes). A second, wider pass is additive so
// the #ff3b30 minimap red actually glows, including at night and through dust. Width eases out with distance the
// way the blue waypoint beam does, so it stays a few pixels wide on a phone. Two meshes, shared geometry, no shader,
// no per-frame allocations. Hidden off Mars and indoors. Debug: window.SSX.gulchbeam.
import * as THREE from 'three';

import { RED, NEAR, H, R, siteOf, colorAt as beamColor } from './gulchbeamcore.js';
export { RED, siteOf, beamColor as colorAt };

let G = null, core = null, glow = null, geo = null, site = null, readT = 0, t = 0, warned = false, onMars = false;
function build() {
  G = new THREE.Group(); G.name = 'gulch-beam'; G.visible = false;
  geo = new THREE.CylinderGeometry(R, R, H, 12, 1, true); geo.translate(0, H / 2, 0);
  const base = { color: RED, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false };
  core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...base, opacity: 0.82 }));
  glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...base, opacity: 0.38, blending: THREE.AdditiveBlending }));
  core.name = 'gulch-beam:farm2'; glow.name = 'gulch-beam:glow';
  core.frustumCulled = false; glow.frustumCulled = false;
  core.renderOrder = 56; glow.renderOrder = 57;
  glow.scale.set(2.15, 1, 2.15); // wider soft edge; parent scale widens both together
  G.add(core, glow);
}
function read() {
  const X = window.SSX || {}; let st = null;
  try { st = X.farm2?.status?.(); } catch (e) { st = null; }
  site = siteOf(st, st?.site);
}
function place(tc) {
  if (!site) { G.visible = false; return; }
  let y = 0; try { const h = tc.height?.(site.x, site.z); if (Number.isFinite(h)) y = h; } catch (e) { /* flat */ }
  G.position.set(site.x, y, site.z); G.visible = true;
}
function tick(dt, tc) {
  if (!tc?.scene || !Number.isFinite(dt)) return;
  onMars = tc.name === 'Mars' && !tc.world?.inside;
  if (!G) build();
  if (!onMars) { G.visible = false; return; }
  if (G.parent !== tc.scene) { tc.scene.add(G); readT = 0; }
  if ((readT -= dt) <= 0) { readT = 0.25; read(); place(tc); }
  if (!G.visible || !site) return;
  t += dt;
  const p = tc.player;
  if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) {
    const w = Math.max(1, Math.min(4, Math.hypot(site.x - p.x, site.z - p.z) / 100));
    G.scale.set(w, 1, w);
  }
  glow.material.opacity = 0.3 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.7));
}
export const gulchbeam = {
  RED, H, R,
  colorAt: (x, z) => (onMars && site ? beamColor(site, x, z, NEAR) : null),
  site: () => (site ? { ...site } : null),
  state: () => ({
    onMars, visible: !!G?.visible, inScene: !!G?.parent, owned: !!site,
    x: site ? +site.x.toFixed(1) : null, z: site ? +site.z.toFixed(1) : null,
    color: core ? core.material.color.getHex() : null,
    additive: glow ? glow.material.blending === THREE.AdditiveBlending : false,
    fog: core ? core.material.fog : null, depthWrite: core ? core.material.depthWrite : null,
    opacity: core ? +core.material.opacity.toFixed(2) : 0, glow: glow ? +glow.material.opacity.toFixed(2) : 0,
    meshes: G ? G.children.length : 0
  }),
  refresh: () => { readT = 0; }
};
(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 250); return; }
  if (window.__gulchBeamOn) return; window.__gulchBeamOn = true; window.SSX.gulchbeam = gulchbeam;
  (window.SSX_TICKS ||= []).push((dt, tc) => { try { if (window.SSX && window.SSX.gulchbeam !== gulchbeam) window.SSX.gulchbeam = gulchbeam; tick(dt, tc); } catch (e) { if (!warned) { warned = true; console.warn('gulchbeam', e); } } });
})();
