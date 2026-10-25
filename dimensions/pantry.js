// Dimension 4: The Giant's Pantry. You're two centimetres tall on a kitchen table the size of a canyon.
// Objective: retrieve Silas's flask (it's the size of a fuel tank from here). Hazard: rolling peas.
export const PANTRY = {
  id: 'pantry', name: "The Giant's Pantry", w: 22, d: 24, h: 10,
  wall: 0x8a5a3a, floor: 0xc8b08a, ceil: 0x3a2a1a, trim: 0xffa020, light: { color: 0xffd8a0, int: 100 },
  intro: "🌀 The Giant's Pantry. You're tiny. The crumbs are boulders. Silas's flask is over by the salt.",
  done: '🍶 Got the flask. It shrank with you. It still smells like paint thinner. Back through the portal.',
  cols: [[-6, -4, 1.6, 1.6], [7, 2, 1.2, 4.5]],
  picks: [{ x: 0, z: -10, r: 2.0 }],
  hazards: [
    { axis: 'x', at: 3, c: 0, amp: 9, speed: 1.0, r: 1.5, dmg: 12, line: 'A pea the size of a car. Ow.' },
    { axis: 'x', at: -2, c: 0, amp: 9, speed: 1.4, phase: 1.5, r: 1.5, dmg: 12, line: 'Pea. PEA!' },
    { axis: 'x', at: -6.5, c: 0, amp: 9, speed: 1.8, phase: 3, r: 1.5, dmg: 12, line: 'Flattened by a legume.' }
  ],
  build(api, K) {
    const { THREE } = K;
    const salt = new THREE.Mesh(K.geo.cyl, K.std(0xf0f0f0)); salt.scale.set(1.6, 7, 1.6); salt.position.set(-6, 3.5, -4); api.g.add(salt);
    api.box(7, 0.35, 2, 2.2, 0.7, 9, api.mat(0xb8b8c0, { metalness: 0.8, roughness: 0.25 })); // a fork, lying down
    const crumbs = []; for (const [x, z, s] of [[-9, 8, 0.9], [-3, 6, 0.6], [4, 9, 1.1], [9, -8, 0.8], [-9, -9, 1.0], [3, -6, 0.5], [-1, 8, 0.4], [9, 9, 0.7]]) crumbs.push([x, s * 0.5, z, s, s * 0.8, s, x, 0xd8a050]);
    K.inst(K.geo.dodeca, K.std(0xffffff, { flatShading: true }), crumbs);
    for (const c of this.cols) api.col(c[0], c[1], c[2], c[3]);
    api.sign('SALT', 0x3a2a1a, -6, 6, -2.35, 0, 3, { bg: 'rgba(250,250,250,0.95)', border: false });
    const f = new THREE.Group(); const b = new THREE.Mesh(K.geo.cyl, K.std(0x9aa4ac, { metalness: 0.8, roughness: 0.3 })); b.scale.set(1.2, 2.2, 0.6); b.position.y = 1.1;
    const cap = new THREE.Mesh(K.geo.cyl, K.std(0x2a2a2a)); cap.scale.set(0.35, 0.4, 0.35); cap.position.y = 2.4; f.add(b, cap); f.position.set(0, 0, -10); api.g.add(f);
    const hz = this.hazards.map(() => { const o = new THREE.Mesh(K.geo.sph, K.std(0x6aa83a)); o.scale.setScalar(1.3); o.position.y = 1.3; api.g.add(o); return o; });
    return { picks: [f], hazards: hz, roll: true };
  }
};
