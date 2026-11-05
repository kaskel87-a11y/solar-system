// v7.5.35 Velvet Airlock gaming floor life (Collin: "have some cocktail waitresses walking around the gaming area, it's
// pretty empty"). Three cocktail waitresses (adult women, black-and-burgundy casino uniform, fully clothed) carry trays
// on patrol loops between the Hold'em room, Blackjack and Roulette, pausing at the tables. Walk up to one and tap
// '🍸 Cocktail waitress' to order: the same drinks, prices and tipsy effects as Nova's bar (bar.js buy). Six idle
// gamblers / spectators sit and stand at the new tables. Cheap on iPhone: the spectators are posed once and merged into a
// handful of meshes (one per shared material); each waitress is the stock interior person + one merged tray mesh.
// No lights. Black/white buttons via panelTap.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { panelTap } from './racehooks.js';
import { DRINKS } from './bar.js';

export const faceYaw = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z)); // interior people face -z at yaw 0
// patrol loops in club room-local metres; p = pause seconds at that point (by a table)
export const ROUTES = [
  { name: 'Coco', pts: [[-16, 10, 0], [-26, 12.5, 3], [-28, 6, 0], [-29, 0, 3], [-27, -5, 0], [-17, -5, 3], [-15, 1, 0]] }, // card room + blackjack
  { name: 'Rhea', pts: [[-17, 5, 3], [-21, 18.8, 3], [-28, 19.5, 0], [-29, 9, 0]] }, // poker -> blackjack
  { name: 'Lux', pts: [[-7, 11, 0], [-1.5, 18.6, 3], [5.5, 18.2, 3], [5.5, 11.5, 0]] }, // roulette loop
];
export const SPEED = 1.1; // m/s
export const SPECTATORS = [ // [x, z, faceX, faceZ, sit]
  [-25.7, 16.8, -24, 16, 1], [-22.3, 16.8, -24, 16, 1], [-26.5, 17.9, -24, 16, 0],
  [0.6, 17.3, 1.5, 16, 0], [3.5, 17.25, 2.5, 16, 0], [4.4, 15.9, 2, 16, 0],
];
// position along a loop at time t (pure, testable): returns { x, z, yaw, moving, at }
export function patrol(pts, t, speed = SPEED) {
  const segs = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) }; });
  const total = segs.reduce((s, g) => s + (g.p[2] || 0) + g.len / speed, 0);
  let u = ((t % total) + total) % total;
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i], ps = g.p[2] || 0;
    if (u < ps) { const q = g.q; return { x: g.p[0], z: g.p[1], yaw: faceYaw(g.p[0], g.p[1], q[0], q[1]), moving: false, at: i }; }
    u -= ps; const dur = g.len / speed;
    if (u < dur) { const k = u / dur; return { x: g.p[0] + (g.q[0] - g.p[0]) * k, z: g.p[1] + (g.q[1] - g.p[1]) * k, yaw: faceYaw(g.p[0], g.p[1], g.q[0], g.q[1]), moving: true, at: i }; }
    u -= dur;
  }
  return { x: pts[0][0], z: pts[0][1], yaw: 0, moving: false, at: 0 };
}

const LOOKS = [{ top: 0x5a0a1e, bottom: 0x0c0c0e, hair: 0x2a1a10, hairStyle: 'bun', skin: 0xc68a64 },
  { top: 0x5a0a1e, bottom: 0x0c0c0e, hair: 0xd8b070, hairStyle: 'bun', skin: 0xf0c8a0 },
  { top: 0x5a0a1e, bottom: 0x0c0c0e, hair: 0x101010, hairStyle: 'bun', skin: 0x7a4a2a }];
const CROWD = [{ top: 0x2a3a5a, bottom: 0x1a1a22, hair: 0x3a2a1a, skin: 0xc68a64 }, { top: 0x6a5a2a, bottom: 0x22222a, hair: 0x101010, hairStyle: 'long', skin: 0x8a5a3a },
  { top: 0x1a1a1a, bottom: 0x1a1a22, hair: 0x9a9aa0, skin: 0xe0b090, shades: true }, { top: 0x3a5a4a, bottom: 0x22302a, hair: 0xb02030, hairStyle: 'long', skin: 0xf0c8a0 },
  { top: 0x4a2a5a, bottom: 0x1a1a22, hair: 0x2a1a10, hairStyle: 'cap', skin: 0x6a4028 }, { top: 0x7a7a80, bottom: 0x22222a, hair: 0x5a3a1a, skin: 0xd8a07a }];

// merge every mesh under `root` into one mesh per material (positions baked). Returns the meshes.
function bake(root, api) {
  root.updateMatrixWorld(true); const byMat = new Map();
  root.traverse(o => { if (!o.isMesh) return; const g = o.geometry.index ? o.geometry.clone() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); (byMat.get(o.material) || byMat.set(o.material, []).get(o.material)).push(g); });
  const out = [];
  for (const [m, gs] of byMat) { const mg = gs.length > 1 ? mergeGeometries(gs, false) : gs[0]; gs.forEach(g => g !== mg && g.dispose()); if (!mg) continue; const mesh = new THREE.Mesh(mg, m); api.g.add(mesh); api.disposables?.push(mg); out.push(mesh); }
  return out;
}

export function addClubFloor(api, poses = {}) {
  const human = poses.human; if (!human) return null;
  // spectators: posed, then baked into a few meshes
  const tmp = new THREE.Group();
  SPECTATORS.forEach(([x, z, fx, fz, sit], i) => {
    const h = human(CROWD[i % CROWD.length]); h.group.position.set(x, 0, z); h.group.rotation.y = faceYaw(x, z, fx, fz);
    if (sit) { poses.sit?.(h); h.arms[0].rotation.x = 1.0; h.arms[1].rotation.x = 0.9; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10), api.mat(0x5a0a2a)); st.position.set(x, 0.25, z); tmp.add(st); }
    else { h.arms[i % 2].rotation.x = 0.35; h.head.rotation.y = (i % 3 - 1) * 0.3; }
    tmp.add(h.group);
  });
  const baked = bake(tmp, api); tmp.traverse(o => { if (o.isMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters?.radialSegments === 10) o.geometry.dispose(); });
  // waitresses
  const silver = api.mat(0xd8d8e0, { metalness: 0.7, roughness: 0.3 });
  const trayGeo = (() => { const gs = [new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), new THREE.CylinderGeometry(0.035, 0.03, 0.12, 8).translate(-0.07, 0.07, 0.03), new THREE.CylinderGeometry(0.035, 0.03, 0.12, 8).translate(0.07, 0.07, -0.04)]; const g = mergeGeometries(gs.map(g => { g.deleteAttribute('uv'); return g; }), false); gs.forEach(x => x.dispose()); api.disposables?.push(g); return g; })();
  const waitresses = ROUTES.map((r, i) => {
    const h = human(LOOKS[i]); api.g.add(h.group);
    const tray = new THREE.Mesh(trayGeo, silver); tray.position.set(0.3, 0.47, -0.5); h.torso.add(tray);
    const spot = { id: 'waitress-' + i, x: r.pts[0][0], z: r.pts[0][1], r: 1.7, label: `\u{1F378} Cocktail waitress \u00b7 ${r.name} \u00b7 drinks 15+ cr`, act: 'waitress', who: r.name };
    api.spot(spot); const sp = api.spots[api.spots.length - 1];
    return { h, r, sp, off: i * 7.3 };
  });
  api.ticks.push(t => {
    for (const w of waitresses) {
      const s = patrol(w.r.pts, t + w.off), h = w.h;
      h.group.position.set(s.x, 0, s.z); h.group.rotation.y = s.yaw; w.sp.x = s.x; w.sp.z = s.z; w.state = s;
      const ph = t * 6.5 + w.off, sw = s.moving ? Math.sin(ph) * 0.45 : 0;
      h.legs[0].rotation.x = sw; h.legs[1].rotation.x = -sw; h.arms[0].rotation.x = -sw * 0.6; h.arms[1].rotation.x = 1.4; h.arms[1].rotation.z = 0;
      h.hips.position.y = h.base - (s.moving ? Math.abs(Math.sin(ph)) * 0.025 : 0); h.head.rotation.y = s.moving ? 0 : Math.sin(t * 0.7 + w.off) * 0.4;
    }
  });
  try { window.__clubFloor = { waitresses: () => waitresses.map(w => ({ name: w.r.name, x: +w.h.group.position.x.toFixed(2), z: +w.h.group.position.z.toFixed(2), moving: !!w.state?.moving })), baked: baked.length, spectators: SPECTATORS.length }; } catch (e) { /* */ }
  return { waitresses, baked };
}

// ---------- order panel ----------
const CSS = `
#waitressPanel { position: fixed; left: 50%; bottom: calc(16px + var(--sab,0px)); transform: translateX(-50%); width: min(94vw, 420px); z-index: 15; display: none;
  background: rgba(8,6,10,0.97); color: #fff; border: 1px solid #fff; border-radius: 16px; padding: 14px; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
#waitressPanel.on { display: block; } #waitressPanel h3 { margin: 0 0 4px; font-size: 1.05rem; } #waitressPanel p { margin: 0 0 10px; font-size: 0.85rem; opacity: 0.85; }
#waitressPanel button { display: block; width: 100%; margin: 6px 0 0; min-height: 46px; background: #000; color: #fff; border: 1px solid #fff; border-radius: 12px; font-size: 0.95rem; font-weight: 800; touch-action: manipulation; }
#waitressPanel button:disabled { opacity: 0.4; } #waitressPanel .msg { min-height: 1.3em; font-weight: 700; margin-top: 8px; text-align: center; }
`;
let el = null, who = '';
const app = () => window.__app;
const credits = () => app()?.surface?.game?.progress?.credits ?? app()?.game?.progress?.credits ?? 0;
function render(msg = '') {
  el.innerHTML = `<h3>\u{1F378} ${who}, cocktails</h3><p>\u201cDrinks, hon? Same pours as Nova\u2019s bar, brought to your table.\u201d</p>` +
    DRINKS.map(d => `<button data-d="${d.id}" ${credits() >= d.price ? '' : 'disabled'}>${d.icon} ${d.name} \u00b7 ${d.price} cr</button>`).join('') +
    `<button data-close="1">No thanks</button><div class="msg">${msg}</div>`;
}
export function openWaitress(name = 'Coco') {
  if (!el) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); el = document.createElement('div'); el.id = 'waitressPanel'; document.body.appendChild(el);
    panelTap(el, e => { const b = e.target?.closest?.('button'); if (!b || b.disabled) return; if (b.dataset.close) return closeWaitress(); if (b.dataset.d) order(b.dataset.d); }); }
  who = name; render(); el.classList.add('on'); return { ok: true };
}
export function order(id) {
  const d = DRINKS.find(x => x.id === id); if (!d) return null;
  const bar = window.SSX?.bar; let r;
  if (bar?.buy) r = bar.buy(id, true); // same charge + tipsy effects as the bar
  else { const g = app()?.surface?.game || app()?.game; r = g?.spend?.(d.price) ? { ok: true } : { ok: false }; }
  if (r?.ok) { closeWaitress(); app()?.toast?.(`${d.icon} ${who} hands you a ${d.name}. \u2212${d.price} cr`, 2400); }
  else if (el) render(`Short on cr for the ${d.name}.`);
  return r;
}
export function closeWaitress() { el?.classList.remove('on'); }
export const waitressOpen = () => !!el?.classList.contains('on');
