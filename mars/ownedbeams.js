// v7.5.x owned-place beams (Ben): on Mars, every business you own (SSX.empire owned props, the farm once bought) and the
// Xen-7 Trading Post get a DARK GREEN column of light, so your places stand out from the city. Other beams keep their colours.
// - Live: the site list is re-read 4x a second, so buying a business lights its beam at once; on load it comes from the save.
// - The blue waypoint beam (hud/wpbeam.js) turns dark green while its target is one of these places (one guarded hook there:
//   SSX.ownedbeams.colorAt(x, z)); the farm guide's yellow beacon (mars/farm.js, untouched) is recoloured the same way.
// Cheap: shared geometry + material, one mesh per place (pooled), no per-frame allocations. Debug: window.SSX.ownedbeams.
import * as THREE from 'three';

import { GREEN, NEAR, H, R, greenSites, siteAt } from './ownedbeamscore.js';
export { GREEN, greenSites, siteAt };

let G = null, geo = null, mat = null, sites = [], readT = 0, key = '', warned = false, onMars = false, farmTint = null;
const pool = [];
function build() {
  G = new THREE.Group(); G.name = 'owned-beams';
  geo = new THREE.CylinderGeometry(R, R, H, 16, 1, true); geo.translate(0, H / 2, 0);
  mat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false });
}
function read() {
  const X = window.SSX || {}; let props = [], fo = false, pl = [];
  try { props = X.empire?.props?.() || []; } catch (e) { /* no empire */ }
  try { fo = !!X.farm?.status?.()?.owned; pl = X.farm?.places?.() || []; } catch (e) { /* no farm */ }
  sites = greenSites(props, fo, pl);
}
function place(tc) {
  const k = sites.map(s => s.id + '@' + Math.round(s.x) + ',' + Math.round(s.z)).join('|'); if (k === key) return; key = k;
  while (pool.length < sites.length) { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 55; pool.push(m); G.add(m); }
  pool.forEach((m, i) => { const s = sites[i]; m.visible = !!s; if (!s) return; let y = 0; try { const h = tc.height?.(s.x, s.z); if (Number.isFinite(h)) y = h; } catch (e) { /* flat */ } m.position.set(s.x, y, s.z); m.name = 'owned-beam:' + s.id; });
}
function tintFarm(tc) { // the farm guide's yellow beacon: dark green while it stands on a green place, its own colours back otherwise
  const b = tc.scene.getObjectByName('farm-beacon'); if (!b) return;
  const on = b.visible && !!siteAt(sites, b.position.x, b.position.z);
  b.traverse(o => { if (!o.material?.color) return; o.userData.ownCol ??= o.material.color.getHex(); o.material.color.setHex(on ? GREEN : o.userData.ownCol); });
  farmTint = on;
}
function tick(dt, tc) {
  if (!tc?.scene || !Number.isFinite(dt)) return;
  onMars = tc.name === 'Mars' && !tc.world?.inside;
  if (!G) build();
  if (!onMars) { G.visible = false; return; }
  if (G.parent !== tc.scene) { tc.scene.add(G); key = ''; }
  if ((readT -= dt) <= 0) { readT = 0.25; read(); place(tc); tintFarm(tc); }
  G.visible = true;
}
export const ownedbeams = {
  colorAt: (x, z) => (onMars && siteAt(sites, x, z) ? GREEN : null),
  sites: () => sites.map(s => ({ ...s })),
  state: () => ({ onMars, visible: !!G?.visible, beams: pool.filter(m => m.visible).map(m => ({ name: m.name, x: +m.position.x.toFixed(1), z: +m.position.z.toFixed(1) })),
    color: mat ? mat.color.getHex() : null, farmTint, inScene: !!G?.parent }),
  refresh: () => { readT = 0; }
};
(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 250); return; }
  if (window.__ownedBeamsOn) return; window.__ownedBeamsOn = true; window.SSX.ownedbeams = ownedbeams;
  (window.SSX_TICKS ||= []).push((dt, tc) => { try { if (window.SSX && window.SSX.ownedbeams !== ownedbeams) window.SSX.ownedbeams = ownedbeams; tick(dt, tc); } catch (e) { if (!warned) { warned = true; console.warn('ownedbeams', e); } } });
})();
