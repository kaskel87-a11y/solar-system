// Velvet expansion (Collin: "Remove the smaller dome and expand the velvet airlock"). The small unnamed dome at (-22, -16)
// next to the club is gone from world.js and the club grew into the space: the building is 36 x 20 m outside (was 24 x 14,
// same front face and door) and the room gains a 14 m east wing (room-local x 11..25, z -8..24; interiors.js club w 58):
//   north-west  the counting room: the cashier cage
//   north-east  Ines's office: desk, the office safe, the books. The STAFF ONLY door is open so you can
//               always walk in and talk to Ines. The till and the safe stay shut until you own the club.
//   south       the Dome Room: the old dome's glass, salvaged as a canopy over a high-roller Hold'em table (act 'poker',
//               the same Velvet Hold'em modal as the card room) where Grisby keeps the house books; sofas, a champagne bar.
// The old east wall (x 11, z -8..8: the VIP room and the booths) stays as a partition, so nothing in the old room moves.
// Every hook into the arc is feature-detected (window.SSX.velvetArc); without it the wing is scenery + a poker table.
// Hotspots use `run(spot)` (index.html doSpot calls it) and getter labels, so the context button text follows the state.
import * as THREE from 'three';
import { patrol } from './clubfloor.js';

export const WING = {
  x0: 11, x1: 25, z0: -8, z1: 24,
  table: { x: 18, z: 13 },               // high-roller Hold'em under the dome
  ledger: { x: 22.2, z: 9.0, r: 1.15 },  // Grisby's slate on its stand, behind his chair
  office: { x0: 18, x1: 25, z0: -8, z1: 1, door: 21.25 },
  ines: { x: 21.5, z: -1.55 }, // standing just inside the staff door, facing it
  desk: { x: 21.5, z: -3.6, r: 1.3 },
  safe: { x: 24.0, z: -6.6, r: 1.1 },
  handover: { x: 15.0, z: 19.5, r: 2.0 }, // the lounge floor, in front of everybody
  // Mina, the Dome Room's cocktail waitress: her loop passes Grisby's slate (the "waitress path" in mission 2)
  route: [[13.5, 8.4, 0], [21.2, 7.4, 2.5], [23.8, 8.6, 0], [23.8, 16.5, 0], [22, 19, 3], [14, 18.6, 0], [12.4, 15, 0]]
};
// pure: is Mina screening the slate from Grisby at time t (seconds)? (within 2.1 m of the slate)
export const minaAt = t => patrol(WING.route, t);
export const screened = t => { const p = minaAt(t); return Math.hypot(p.x - WING.ledger.x, p.z - WING.ledger.z) < 2.1; };
const arc = () => { try { return window.SSX?.velvetArc || null; } catch (e) { return null; } };
const call = (fn, ...a) => { try { const A = arc(); return A && typeof A[fn] === 'function' ? A[fn](...a) : null; } catch (e) { console.warn('velvetwing', fn, e); return null; } };

// interiors.js calls this while building the club. poses: { sit(h), idle(h, t, k), guard(h, t), o (room opts) }
export function addVelvetWing(api, poses = {}) {
  const { box, mat, G } = api, H = api.h, W = WING;
  const wallM = mat(0x241430), dark = mat(0x0c0a10, { roughness: 0.5 }), velvet = mat(0x0f3a24, { roughness: 0.9 }), chrome = mat(0xc0c4cc, { metalness: 0.9, roughness: 0.2 });
  const green = mat(0x2aff7a, { basic: true }), gold = mat(0xffd040, { basic: true }), pink = mat(0xff3cc8, { basic: true });
  // the old east wall becomes a partition (VIP room + booths keep their backdrop); open south of z 8 into the lounge
  box(11.15, H / 2, 0, 0.3, H, 16, wallM); api.col(11.15, 0, 0.2, 8, 'wall');
  box(11.32, 0.06, 0, 0.04, 0.05, 16, pink);
  api.sign('THE DOME ROOM \u2192', 0x2aff7a, 7, 2.5, 8.32, 0, 3.6, { h: 96 }); // under the STAGE · BAR · VIP sign, faces the lobby
  // ---- Ines's office (north-east): walls with a doorway, a desk, the safe ----
  const O = W.office, gapW = 1.6;
  box(O.x0, H / 2, (O.z0 + O.z1) / 2, 0.24, H, O.z1 - O.z0, wallM); api.col(O.x0, (O.z0 + O.z1) / 2, 0.16, (O.z1 - O.z0) / 2, 'wall');
  const lw = O.door - gapW / 2 - O.x0, rw = O.x1 - (O.door + gapW / 2);
  box(O.x0 + lw / 2, H / 2, O.z1, lw, H, 0.24, wallM); api.col(O.x0 + lw / 2, O.z1, lw / 2, 0.16, 'wall');
  box(O.x1 - rw / 2, H / 2, O.z1, rw, H, 0.24, wallM); api.col(O.x1 - rw / 2, O.z1, rw / 2, 0.16, 'wall');
  box(O.door, (H + 2.6) / 2, O.z1, gapW, H - 2.6, 0.24, wallM);
  box(O.door - gapW / 2, 1.3, O.z1 + 0.14, 0.06, 2.6, 0.06, green); box(O.door + gapW / 2, 1.3, O.z1 + 0.14, 0.06, 2.6, 0.06, green);
  const officeSign = api.sign('STAFF ONLY', 0xff5a5a, O.door, 3.15, O.z1 + 0.15, 0, 2.6, { w: 512, h: 96, font: 'bold 56px system-ui, sans-serif' });
  const ownSign = api.sign('THE OFFICE', 0x2aff7a, O.door, 3.15, O.z1 + 0.15, 0, 2.6, { w: 512, h: 96, font: 'bold 56px system-ui, sans-serif' }); ownSign.visible = false;
  api.sign('INES IS INSIDE', 0xffd040, O.door, 2.72, O.z1 + 0.16, 0, 1.7, { w: 512, h: 96, font: 'bold 44px system-ui, sans-serif' });
  const doorCol = api.col(O.door, O.z1, gapW / 2 + 0.05, 0.2, 'rope');
  doorCol.on = false; // always open: Ines is in this room from the start
  const chain = box(O.door, 0.9, O.z1 + 0.18, gapW, 0.06, 0.06, mat(0xff5a5a, { basic: true })); chain.visible = false;
  // desk + chair + green banker's lamp
  const D = W.desk; box(D.x, 0.42, D.z - 1.4, 2.4, 0.84, 1.0, dark); box(D.x, 0.86, D.z - 1.4, 2.5, 0.05, 1.1, mat(0x3a1a0a, { roughness: 0.4 })); api.col(D.x, D.z - 1.4, 1.25, 0.55);
  box(D.x - 0.7, 1.05, D.z - 1.55, 0.08, 0.35, 0.08, chrome); box(D.x - 0.7, 1.24, D.z - 1.55, 0.4, 0.1, 0.18, green);
  box(D.x + 0.4, 0.9, D.z - 1.3, 0.5, 0.03, 0.36, mat(0xf7f3ea)); // the books
  box(D.x, 0.3, D.z - 2.4, 0.6, 0.6, 0.6, velvet); box(D.x, 0.85, D.z - 2.75, 0.6, 0.9, 0.12, velvet); api.col(D.x, D.z - 2.5, 0.35, 0.4);
  const nameplate = api.sign('INES \u00b7 MANAGER', 0xffd040, D.x, 1.05, D.z - 0.86, 0, 1.0, { w: 512, h: 96, font: 'bold 56px system-ui, sans-serif' }); nameplate.visible = false;
  // Ines herself: silver bun, dark dress, gold glow, standing where the open door shows her
  const IN = W.ines;
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.75, depthWrite: false }); api.disposables.push(glowM);
  const inesRing = api.mk(G.cyl, glowM, IN.x, 0.035, IN.z, 0.85, 0.04, 0.85); api.g.add(inesRing);
  const halo = api.mk(G.sph, glowM, IN.x, 2.15, IN.z, 0.22, 0.22, 0.22); api.g.add(halo);
  api.sign('INES', 0xffd040, IN.x, 2.55, IN.z + 0.2, 0, 1.15, { w: 256, h: 96, font: 'bold 64px system-ui, sans-serif' });
  api.person({ top: 0x2a0a18, bottom: 0x2a0a18, shoes: 0x0a0a0a, hair: 0xe8e8f0, hairStyle: 'bun', skin: 0xd8a888, accent: 0xffd040 }, IN.x, IN.z, Math.PI, (p, t) => poses.idle?.(p, t, 2));
  api.ticks.push(t => { glowM.opacity = 0.4 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3)); });
  api.spot({ id: 'ines', x: IN.x, z: IN.z + 0.9, r: 1.55, label: '\u{1F4AC} Talk to Ines', act: 'talk', who: 'Ines' });
  // the safe: a squat steel box with a gold dial (stores contraband for the owner, no carry cap)
  const S = W.safe; box(S.x, 0.6, S.z - 0.6, 1.0, 1.2, 0.8, mat(0x3a3e46, { metalness: 0.8, roughness: 0.35 })); api.col(S.x, S.z - 0.6, 0.55, 0.45);
  const dial = api.mk(G.cyl, mat(0xffd040, { metalness: 0.8, roughness: 0.3 }), S.x, 0.75, S.z - 0.18, 0.16, 0.04, 0.16); dial.rotation.x = Math.PI / 2; api.g.add(dial);
  // a framed deed on the east wall + a shelf of old books
  box(O.x1 - 0.06, 2.4, -3.2, 0.04, 1.0, 1.4, gold); const deed = api.sign('DEED', 0x111111, O.x1 - 0.1, 2.4, -3.2, -Math.PI / 2, 1.2, { w: 256, h: 64, font: 'bold 44px serif' }); deed.visible = false;
  for (let k = 0; k < 3; k++) box(O.x1 - 0.3, 0.6 + k * 0.7, -0.6, 0.4, 0.04, 1.6, dark);
  // ---- counting room (north-west of the wing): the cashier cage, open to the lounge ----
  box(14.5, 0.55, -6.0, 4.6, 1.1, 0.8, dark); box(14.5, 1.12, -6.0, 4.7, 0.06, 0.9, mat(0x3a1a0a)); api.col(14.5, -6.0, 2.35, 0.45);
  for (const x of [12.6, 14.5, 16.4]) box(x, 2.0, -6.0, 0.04, 1.8, 0.04, chrome); // cage bars
  api.sign('CASHIER \u00b7 CHIPS & MARKERS', 0xffd040, 14.5, 3.3, -7.84, 0, 4.2, { h: 96 });
  api.person({ top: 0x2a2a30, bottom: 0x1a1a20, hair: 0x6a5a4a, hairStyle: 'short', skin: 0xd8a888, accent: 0xffd040 }, 14.5, -7.1, 0, (p, t) => poses.idle?.(p, t, 3));
  // ---- the Dome Room: the old dome's glass over a high-roller table ----
  const T = W.table, R = 4.6;
  box(T.x, 0.011, T.z, 9.6, 0.02, 9.6, mat(0x0a2a1a, { roughness: 1 })); // rug
  const ring = api.mk(G.cyl, green, T.x, 0.026, T.z, R + 0.1, 0.012, R + 0.1); api.g.add(ring);
  const ringIn = api.mk(G.cyl, mat(0x0a2a1a, { roughness: 1 }), T.x, 0.03, T.z, R - 0.05, 0.012, R - 0.05); api.g.add(ringIn);
  const domeGeo = new THREE.SphereGeometry(R, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeM = new THREE.MeshBasicMaterial({ color: 0x9fffd0, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
  const domeW = new THREE.MeshBasicMaterial({ color: 0x2aff7a, wireframe: true, transparent: true, opacity: 0.22 }); api.disposables.push(domeGeo, domeM, domeW);
  const dome = new THREE.Mesh(domeGeo, domeM), domeLines = new THREE.Mesh(domeGeo, domeW); dome.position.set(T.x, H - R - 0.1, T.z); domeLines.position.copy(dome.position); api.g.add(dome, domeLines);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const px = T.x + Math.cos(a) * R, pz = T.z + Math.sin(a) * R; box(px, (H - R - 0.1) / 2, pz, 0.1, H - R - 0.1, 0.1, chrome); api.col(px, pz, 0.08, 0.08); }
  api.sign('THE DOME ROOM \u00b7 HIGH ROLLERS', 0x2aff7a, 19.5, 4.6, W.z1 - 0.1, Math.PI, 5.0, { h: 96 }); // south wall, faces into the lounge
  const oval = (m, y, rx, h, rz) => { const o = api.mk(G.cyl, m, T.x, y, T.z, rx, h, rz); api.g.add(o); return o; };
  oval(mat(0x2a140a, { roughness: 0.5 }), 0.35, 0.45, 0.7, 0.45); oval(mat(0x2a140a, { roughness: 0.5 }), 0.74, 2.0, 0.1, 1.45); oval(mat(0x0e3a5a, { roughness: 0.95 }), 0.8, 1.8, 0.04, 1.28);
  for (const [dx, dz, c] of [[-0.8, 0.5, 0xd0201a], [0.7, 0.55, 0x2050d0], [1.1, -0.3, 0x111111], [-1.1, -0.35, 0xffd040]]) box(T.x + dx, 0.86, T.z + dz, 0.16, 0.08, 0.16, mat(c));
  api.col(T.x, T.z, 2.05, 1.5);
  const seat = a => ({ x: T.x + Math.sin(a) * 2.75, z: T.z + Math.cos(a) * 2.05, yaw: a + Math.PI });
  const seatM = mat(0x0f3a24, { roughness: 0.9 });
  const looks = [{ top: 0x6a5a2a, bottom: 0x1a1a22, hair: 0xd0d0d0, hairStyle: 'short', skin: 0xc68a64 }, { top: 0x101014, bottom: 0x101014, hair: 0x2a0a3a, hairStyle: 'long', skin: 0x8a5a3a, accent: 0x2aff7a }];
  [-1.4, 1.4].forEach((a, i) => { const p = seat(a); box(p.x, 0.24, p.z, 0.55, 0.48, 0.55, seatM); api.col(p.x, p.z, 0.32, 0.32);
    api.person(looks[i], p.x, p.z, p.yaw, (h, t) => { poses.sit?.(h); h.arms[0].rotation.x = 1.0 + Math.sin(t * 0.8 + i) * 0.08; h.arms[1].rotation.x = 1.0; h.head.rotation.y = Math.sin(t * 0.3 + i) * 0.3; }, i); });
  // Grisby: the house accountant, seated at the north-east curve; every few seconds he turns to check his slate
  const gs = seat(2.3); box(gs.x, 0.24, gs.z, 0.55, 0.48, 0.55, seatM); api.col(gs.x, gs.z, 0.32, 0.32);
  api.person({ top: 0x5a5a62, bottom: 0x2a2a30, hair: 0x8a7a6a, hairStyle: 'bald', skin: 0xe0b8a0, accent: 0xffd040, size: 0.97 }, gs.x, gs.z, gs.yaw, (h, t) => {
    poses.sit?.(h); h.arms[0].rotation.x = 1.0; h.arms[1].rotation.x = 1.0;
    h.head.rotation.y = call('grisbyLooking') ? -1.1 : Math.sin(t * 0.4) * 0.25; // looking = turned toward his slate
  }, 7);
  api.sign('GRISBY \u00b7 HOUSE BOOKS', 0xffd040, gs.x + 0.4, 2.6, gs.z - 0.4, gs.yaw, 1.8, { w: 512, h: 96, font: 'bold 52px system-ui, sans-serif' });
  const L = W.ledger; box(L.x, 0.5, L.z, 0.5, 1.0, 0.5, dark); const slate = box(L.x, 1.04, L.z, 0.42, 0.04, 0.3, mat(0x7af0ff, { basic: true }));
  api.col(L.x, L.z, 0.3, 0.3);
  // sofas, a champagne bar against the south wall, two lounge regulars
  for (const [x, z, sx, sz] of [[12.4, 20.5, 1.0, 3.0], [23.9, 20.0, 1.0, 3.0], [23.9, 5.4, 1.0, 3.0]]) { box(x, 0.45, z, sx, 0.9, sz, velvet); api.col(x, z, sx / 2 + 0.05, sz / 2 + 0.05); }
  box(19.5, 0.55, 23.2, 4.0, 1.1, 0.8, dark); box(19.5, 1.12, 23.2, 4.1, 0.06, 0.9, mat(0x0f3a24, { roughness: 0.3 })); api.col(19.5, 23.2, 2.05, 0.45);
  for (let k = 0; k < 7; k++) box(17.9 + k * 0.5, 1.32, 23.35, 0.08, 0.34, 0.08, mat([0x6aff9a, 0xffd040, 0xf7f3ea][k % 3], { basic: true }));
  api.sign('CHAMPAGNE', 0xffd040, 19.5, 2.6, W.z1 - 0.12, Math.PI, 2.6, { h: 96 });
  api.person({ top: 0x2a0a18, bottom: 0x1a1a22, hair: 0xd0b070, hairStyle: 'bun', skin: 0xe8c0a0 }, 12.6, 19.8, Math.PI / 2, (h, t) => { poses.sit?.(h); h.arms[1].rotation.x = 1.1 + Math.sin(t * 0.6) * 0.2; });
  api.person({ top: 0x3a4a8a, bottom: 0x1a1a22, hair: 0x101010, hairStyle: 'short', skin: 0x6a4028 }, 23.7, 5.8, -Math.PI / 2, (h) => poses.sit?.(h));
  // Mina: same stock interior person + tray as the floor waitresses (clubfloor.js); drinks go through the same 'waitress' act
  if (typeof poses.human === 'function') { try {
    const h = poses.human({ top: 0x0a3a24, bottom: 0x0c0c0e, hair: 0x6a2a1a, hairStyle: 'bun', skin: 0xe0b090 }); api.g.add(h.group);
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), mat(0xd8d8e0, { metalness: 0.7, roughness: 0.3 })); api.disposables.push(tray.geometry); tray.position.set(0.3, 0.47, -0.5); (h.torso || h.group).add(tray);
    api.spot({ id: 'waitress-dome', x: W.route[0][0], z: W.route[0][1], r: 1.7, label: '\u{1F378} Cocktail waitress \u00b7 Mina \u00b7 drinks 15+ cr', act: 'waitress', who: 'Mina' }); const sp = api.spots[api.spots.length - 1];
    api.ticks.push(t => { const s = minaAt(t), ph = t * 6.5, sw = s.moving ? Math.sin(ph) * 0.45 : 0; h.group.position.set(s.x, 0, s.z); h.group.rotation.y = s.yaw; sp.x = s.x; sp.z = s.z;
      if (h.legs) { h.legs[0].rotation.x = sw; h.legs[1].rotation.x = -sw; } if (h.arms) { h.arms[0].rotation.x = -sw * 0.6; h.arms[1].rotation.x = 1.4; } });
    try { window.__velvetWing = { mina: () => { const p = h.group.position; return { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }; } }; } catch (e) { /* */ }
  } catch (e) { console.warn('velvetwing waitress', e); } }
  // Marcus Thorne, only during the handover (mission 5): grey suit, silver hair, flanked by the table
  const thorne = api.person({ top: 0x6a6e78, bottom: 0x2a2c32, hair: 0xc8c8cc, hairStyle: 'short', skin: 0xe4bca0, accent: 0x2aff7a, size: 1.02 }, W.handover.x + 1.2, W.handover.z - 1.6, Math.PI * 0.8, (h, t) => poses.idle?.(h, t, 5));
  const thorneGrp = thorne?.group || thorne; if (thorneGrp) thorneGrp.visible = false;
  // ---- hotspots (labels are live: api.spot copies its argument, so the getter goes on the stored spot) ----
  const liveSpot = (def, label) => { api.spot(def); const sp = api.spots[api.spots.length - 1]; Object.defineProperty(sp, 'label', { get: label, enumerable: true, configurable: true }); return sp; };
  const hs = seat(0);
  api.spot({ id: 'poker-hr', x: hs.x, z: hs.z + 0.6, r: 1.4, label: '\u{1F0CF} High-roller Hold\u2019em \u00b7 Grisby\u2019s table', act: 'poker', who: 'Grisby' });
  liveSpot({ id: 'velvet-ledger', x: L.x + 0.1, z: L.z - 0.8, r: L.r, act: 'velvet', run: () => call('ledgerSpot'), cond: () => !!call('ledgerOn') }, () => call('ledgerLabel') || '\u{1F4D2} Grisby\u2019s ledger slate');
  liveSpot({ id: 'velvet-handover', x: W.handover.x, z: W.handover.z, r: W.handover.r, act: 'velvet', run: () => call('handoverSpot'), cond: () => !!call('handoverOn') }, () => call('handoverLabel') || '\u{1F4D2} Hand Thorne the ledger');
  liveSpot({ id: 'velvet-desk', x: D.x, z: D.z, r: D.r, act: 'velvet', run: () => call('deskSpot'), cond: () => !!call('owned') }, () => call('deskLabel') || '\u{1F4BC} The office books');
  liveSpot({ id: 'velvet-safe', x: S.x - 0.5, z: S.z + 0.9, r: S.r, act: 'velvet', run: () => call('safeSpot'), cond: () => !!call('owned') }, () => call('safeLabel') || '\u{1F512} Office safe');
  // ---- state: the office opens when the club is yours, the slate goes dark once it's swiped ----
  let last = null;
  api.ticks.push(() => {
    const own = !!call('owned'), gone = !!call('ledgerGone'), th = !!call('thorneHere'), k = own + ':' + gone + ':' + th;
    if (thorneGrp) thorneGrp.visible = th;
    if (k === last) return; last = k;
    officeSign.visible = !own; ownSign.visible = own; nameplate.visible = own; deed.visible = own;
    slate.visible = !gone;
  });
  return { wing: W };
}
