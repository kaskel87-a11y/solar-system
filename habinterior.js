// v7.5.93: the player's habitat is a walk-in room on the same interior kit as the shops,
// the Velvet Airlock and the garages (interiors.js registerInterior). Built once, parked
// above the colony, hidden until you tap Enter at the door. One point light, shared
// box geometry, no new HUD. Spots call back into base.js (rest, locker, terminal).
import * as THREE from 'three';
import { registerInterior } from './interiors.js';

export const HAB_KIND = 'hab';
export const HAB_ROOM = { w: 6.2, d: 5.0, h: 3.05 };
// Room-local metres. The door (Leave) sits on the south wall; roomKit places it.
export const HAB_SPOTS = {
  bunk: { x: -1.2, z: -0.55 },
  locker: { x: 1.45, z: 0.45 },
  terminal: { x: 0.55, z: -1.2 },
  frankie: { x: 0.15, z: -0.45 },
  leave: { x: 0, z: HAB_ROOM.d / 2 - 0.9 }
};

registerInterior(HAB_KIND, {
  name: 'Habitat',
  w: HAB_ROOM.w, d: HAB_ROOM.d, h: HAB_ROOM.h,
  wall: 0x6a5846, floor: 0x2a241c, ceil: 0x1c1814, trim: 0xff9a30,
  light: { color: 0xffb060, int: 46 },
  build(api, o) {
    const { box, mat, d, w } = api;
    const steel = mat(0x4a4e55, { metalness: 0.55, roughness: 0.45 });
    const bunkM = mat(0x6a3030, { roughness: 0.92 });
    const cloth = mat(0x3a342c, { roughness: 1 });
    const wood = mat(0x5a4030, { roughness: 0.8 });
    const fur = mat(0xd2a679, { roughness: 0.95 });
    const dark = mat(0x3b2b22, { roughness: 0.9 });
    const screen = mat(0x14301c, { emissive: 0x39ff7a, emissiveIntensity: 0.85, roughness: 0.35 });

    api.sign('1. REST   2. LOCKER   3. LEAVE', 0xffc060, 0, 2.35, -d / 2 + 0.08, 0, 4.2, { h: 96, font: 'bold 42px system-ui, sans-serif' });

    // bunk along the west wall, blanket askew, a stained pillow
    box(-2.2, 0.28, -0.85, 1.15, 0.32, 1.85, steel);
    box(-2.2, 0.48, -0.85, 1.05, 0.1, 1.7, bunkM);
    box(-2.2, 0.56, -1.5, 0.7, 0.1, 0.38, mat(0xc8c2b4, { roughness: 1 }));
    box(-2.2, 0.54, -0.35, 0.85, 0.06, 0.7, cloth);
    api.col(-2.2, -0.85, 0.62, 0.98);
    // dried stain by the bunk. Fiction, not a wound you can interact with.
    box(-1.15, 0.02, -1.35, 0.42, 0.02, 0.28, mat(0x4a1818, { roughness: 1 }));

    // locker: the lot stash, same box you use outside if you built one
    box(2.55, 0.95, 0.35, 0.62, 1.8, 0.85, steel);
    box(2.55, 1.15, 0.72, 0.4, 0.7, 0.04, mat(0x1a1c20, { metalness: 0.4 }));
    box(2.55, 1.15, 0.75, 0.08, 0.08, 0.04, mat(0x3cff8a, { emissive: 0x3cff8a, emissiveIntensity: 0.8 }));
    api.col(2.55, 0.35, 0.38, 0.48);
    api.sign('LOCKER', 0xffd040, 2.55, 2.15, 0.78, 0, 1.15, { h: 96, font: 'bold 54px system-ui, sans-serif' });

    // workbench and a terminal that still boots
    box(0.7, 0.42, -1.95, 1.55, 0.8, 0.55, wood);
    box(0.7, 0.84, -1.95, 1.5, 0.06, 0.5, mat(0x2a2c30, { metalness: 0.4 }));
    const mon = box(0.85, 1.15, -2.05, 0.62, 0.38, 0.05, screen);
    api.g.add(api.mk(api.G.cyl, mat(0x222222), 0.15, 0.95, -1.72, 0.06, 0.1, 0.06));
    api.col(0.7, -1.95, 0.82, 0.32);
    api.ticks.push(t => { mon.material.emissiveIntensity = 0.65 + Math.sin(t * 2.2) * 0.2; });

    // Frankie's bed beside the bunk, in view from the door
    box(-0.85, 0.06, -0.15, 0.9, 0.1, 0.65, cloth);
    box(-0.85, 0.12, -0.15, 0.7, 0.06, 0.45, mat(0x6a4a32, { roughness: 1 }));
    api.g.add(api.mk(api.G.cyl, mat(0xc8a050, { metalness: 0.3 }), -0.4, 0.06, 0.15, 0.09, 0.045, 0.09));
    api.col(-0.85, -0.15, 0.36, 0.26);
    const dog = frenchie(api, fur, dark);
    dog.position.set(-0.85, 0.16, -0.15);
    dog.rotation.y = 1.1;
    const tail = dog.userData.tail;
    api.ticks.push(t => { if (tail) tail.position.y = 0.3 + Math.abs(Math.sin(t * 7)) * 0.04; dog.position.y = 0.16 + Math.sin(t * 1.3) * 0.006; });
    api.sign('FRANKIE', 0xffb060, -w / 2 + 0.08, 1.15, -0.15, Math.PI / 2, 1.3, { h: 96, font: 'bold 48px system-ui, sans-serif' });

    // a crate of fictional dust that never leaves the room
    box(2.35, 0.22, -1.15, 0.5, 0.4, 0.4, mat(0x3d4a2a, { roughness: 0.85 }));
    api.col(2.35, -1.15, 0.28, 0.24);
    api.sign('GLOW', 0x6aff9a, 2.35, 0.55, -0.92, 0, 0.7, { h: 80, font: 'bold 40px system-ui, sans-serif' });

    const lamp = api.mk(api.G.sph, mat(0xffe0a0, { emissive: 0xffb060, emissiveIntensity: 1.1, roughness: 0.4 }), 0, HAB_ROOM.h - 0.18, 0, 0.12, 0.08, 0.12);
    api.g.add(lamp);

    const bunk = api.spot({ id: 'bunk', x: HAB_SPOTS.bunk.x, z: HAB_SPOTS.bunk.z, r: 1.05, label: '🛌 Rest', act: 'hab', run: () => o.rest?.() });
    api.spot({ id: 'locker', x: HAB_SPOTS.locker.x, z: HAB_SPOTS.locker.z, r: 0.95, label: '🔐 Locker', act: 'hab', run: () => o.locker?.() });
    api.spot({ id: 'terminal', x: HAB_SPOTS.terminal.x, z: HAB_SPOTS.terminal.z, r: 0.8, label: '📟 Terminal', act: 'hab', run: () => o.terminal?.() });
    api.spot({ id: 'frankie', x: HAB_SPOTS.frankie.x, z: HAB_SPOTS.frankie.z, r: 0.45, label: '🐶 Frankie', act: 'hab', run: () => o.frankie?.() });
    api.ticks.push(() => {
      let ready = null; try { ready = o.restState?.(); } catch (e) { ready = null; }
      const next = ready && !ready.ok ? `🛌 Rest ${Math.ceil(ready.left / 1000)}s` : '🛌 Rest';
      if (bunk.label !== next) bunk.label = next;
    });
  }
});

// Squat frenchie from the shared room primitives. Feet at y=0, faces -z. No unique geometry.
function frenchie(api, fur, dark) {
  const g = new THREE.Group();
  const black = api.mat(0x111111);
  const add = (geo, m, x, y, z, sx, sy, sz) => { const o = api.mk(geo, m, x, y, z, sx, sy, sz); g.add(o); return o; };
  add(api.G.sph, fur, 0, 0.2, 0.02, 0.2, 0.15, 0.28);
  add(api.G.sph, fur, 0, 0.32, -0.2, 0.15, 0.13, 0.13);
  add(api.G.box, dark, 0, 0.26, -0.3, 0.12, 0.07, 0.06);
  add(api.G.sph, black, 0, 0.28, -0.33, 0.028, 0.028, 0.028);
  for (const s of [-1, 1]) {
    const ear = add(api.G.cone, fur, s * 0.09, 0.46, -0.16, 0.06, 0.12, 0.04);
    ear.rotation.z = -s * 0.45;
    add(api.G.cyl, fur, s * 0.09, 0.1, -0.08, 0.04, 0.14, 0.04);
    add(api.G.cyl, fur, s * 0.09, 0.1, 0.14, 0.04, 0.14, 0.04);
    add(api.G.sph, black, s * 0.06, 0.34, -0.28, 0.018, 0.018, 0.018);
  }
  add(api.G.cyl, api.mat(0xd23b3b), 0, 0.24, -0.1, 0.09, 0.035, 0.09);
  const tail = add(api.G.sph, fur, 0, 0.3, 0.26, 0.045, 0.045, 0.045);
  g.userData.tail = tail;
  api.g.add(g);
  return g;
}
