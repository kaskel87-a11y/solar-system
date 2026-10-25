// THE ONE PLACE that talks to core. Everything else in planets/ is data.
// v7.4: rebased onto the core modding API (world.registerColony / registerVehicle, game.registerMission, app.registerMenuItem).
// Import URLs must match the core's ?v= exactly (shared module instances).
import * as THREE from 'three';
import * as W from '../world.js?v=7.4';
import * as GM from '../game.js?v=7.4';
import * as AU from '../audio7.js?v=7.4';

// ---------- building / prop style keys -> v7.2 placeholder shape (v8: glTF per key) ----------
// 'dome' reuses the core glass-dome renderer; 'block' reuses the core storefront renderer (same as Mars's SUPPLY/CANTINA).
export const BUILDING_TYPES = {
  hub: 'dome', hab: 'dome', boiler: 'dome', 'grid-control': 'dome', 'tank-farm': 'dome', infirmary: 'dome', 'drill-rig': 'dome', forge: 'dome',
  supply: 'block', store: 'block', depot: 'block', chapel: 'block', canteen: 'block', icehouse: 'block', chandlery: 'block', bar: 'block',
  bunks: 'block', cellblock: 'block', office: 'block'
};
// v7.4: every storefront is a walk-in interior (core INTERIORS kinds), picked by building type
export const INTERIOR_OF = { supply: 'supply', store: 'supply', chandlery: 'supply', depot: 'depot', icehouse: 'depot', bar: 'cantina', canteen: 'cantina',
  chapel: 'cantina', bunks: 'cantina', cellblock: 'security', office: 'security', guns: 'guns', club: 'club' };
// props (vent-stack, solar-row, fuel-tower, drill-derrick, guard-tower) are layout data only in v7.2: not rendered, no new boxes.

// semantic colony -> v7.2 COLONIES entry (the semantic layout rides along as .layout for v8)
export function toCoreColony(c) {
  const domes = [], blocks = [];
  for (const b of c.buildings) {
    const shape = BUILDING_TYPES[b.type] || (b.size ? 'block' : 'dome');
    if (shape === 'dome') domes.push([b.at[0], b.at[1], b.r ?? (b.size ? Math.max(b.size[0], b.size[1]) / 2 : 7), b.sign, b.neon]);
    else { const [w, d, h] = b.size || [6, 4, 4]; blocks.push([b.at[0], b.at[1], w, d, h, b.sign, b.neon ?? 0x3cff8a, INTERIOR_OF[b.type] || 'supply', b.sign]); }
  }
  return { name: c.name, a: c.site.a, d: c.site.d, tint: c.palette.tint, domes, blocks, pad: [c.pad.at[0], c.pad.at[1], c.pad.r], crates: c.crates, lamps: c.lamps,
    shop: c.shop, contacts: c.contacts, vehicles: c.vehicles, guards: c.guards, colonists: c.colonists, layout: c };
}
export function registerColony(world, c) { if (!W.COLONIES[world]) return W.registerColony(world, toCoreColony(c)); }
export const colonyOf = world => W.COLONIES[world];

const haveQ = new Set(GM.QUESTS.map(q => q.id));
export function registerMission(q) {
  if (haveQ.has(q.id)) return; haveQ.add(q.id);
  return GM.registerMission(q);
}
export const missionsFor = world => GM.QUESTS.filter(q => q.world === world);
export function registerCosmetics(items) { for (const [kind, set] of Object.entries(items || {})) Object.assign(GM.COSMETICS[kind] ||= {}, set); }

// ---------- vehicles: stock body + livery + rounded accents ----------
const liveries = {}, glows = {};
const glow = c => glows[c] || (glows[c] = Object.assign(new THREE.MeshBasicMaterial({ color: c }), { userData: { shared: true } }));
const ACCENTS = {
  'beacon-amber': ({ R, mesh, body }) => body.add(mesh(R.sph, glow(0xffb020), 0, 2.7, 0.2, 0.22)),
  'beacon-cyan': ({ R, mesh, body }) => body.add(mesh(R.sph, glow(0x6ae0ff), 0, 2.2, 0.4, 0.18)),
  ram: ({ R, mesh, body }) => { const m = mesh(R.cyl, R.frame, 0, 0.9, -2.3, 0.22, 2.4, 0.22); m.rotation.z = Math.PI / 2; body.add(m); },
  drill: ({ R, mesh, body }) => { const m = mesh(R.cyl, R.frame, 0, 1.0, -2.4, 0.32, 1.2, 0.32); m.rotation.x = Math.PI / 2; body.add(m); },
  'skirt-green': ({ R, mesh, body }) => { const m = mesh(R.ring, glow(0x7aff5a), 0, 0.6, 0, 2.6, 2.6, 2); m.rotation.x = Math.PI / 2; body.add(m); },
  'skirt-orange': ({ R, mesh, body }) => { const m = mesh(R.ring, glow(0xff6a10), 0, 0.45, 0, 0.8, 1.6, 2); m.rotation.x = Math.PI / 2; body.add(m); }
};
function lookBuilder(kind, look) {
  return ({ R, mesh, build, sec }) => {
    const v = build(look.base, sec);
    if (!sec) {
      const base = R.paints[look.base], liv = liveries[kind] || (liveries[kind] = Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.5, ...look.livery }), { userData: { shared: true } }));
      v.body.traverse(o => { if (o.isMesh && o.material === base) o.material = liv; }); v.paint = liv;
      for (const a of look.accents || []) ACCENTS[a]?.({ R, mesh, body: v.body });
    }
    if (look.scale) v.group.scale.set(...look.scale);
    return v;
  };
}
export function registerVehicles(defs) {
  for (const [kind, { look, ...spec }] of Object.entries(defs)) {
    W.registerVehicle(kind, spec, lookBuilder(kind, look));
  }
}

// ---------- radio ----------
export const STATIONS = AU.STATIONS;

// ---------- ☰ menu ----------
// app.registerMenuItem({ id, label, onTap }) if v7.3 provides it; else inject a .btn into #roverMenu above Settings.
export function addMenuItem(app, { id, label, onTap }) {
  if (typeof app.registerMenuItem === 'function') return app.registerMenuItem({ id, label, onTap });
  const menu = document.getElementById('roverMenu'), before = document.getElementById('settingsBtn');
  const btn = document.createElement('button'); btn.id = id; btn.className = 'btn'; btn.textContent = label;
  if (menu) menu.insertBefore(btn, before && before.parentNode === menu ? before : null);
  tap(btn, () => { app.toggleMenu?.(false); onTap(); });
  return btn;
}
// pointer-based tap: fires on pointerup of the same pointer, so a thumb resting on the joystick doesn't block it
export function tap(el, fn) {
  let id = null;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; e.preventDefault(); id = e.pointerId; });
  el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' || e.pointerId !== id) return; e.preventDefault(); id = null; fn(e); });
  el.addEventListener('pointercancel', () => { id = null; });
  el.addEventListener('click', e => { if (e.pointerType && e.pointerType !== 'mouse') return; fn(e); });
}
