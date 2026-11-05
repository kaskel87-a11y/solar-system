// Dimension 6: The Tooth Orchard. Pale trees in a red dusk, every branch heavy with human molars. Mother Ossery prunes.
// Objective: pick 4 molars. Hazards: two pruners pacing the rows with shears, and roots that snap up out of the soil.
export const ORCHARD = {
  id: 'orchard', name: 'The Tooth Orchard', w: 20, d: 22, h: 8, host: 'Mother Ossery',
  wall: 0x2a0a10, floor: 0x3a1a14, ceil: 0x1a0408, trim: 0xd8d0b0, light: { color: 0xff8a70, int: 95 },
  intro: '🌀 The Tooth Orchard. The trees are growing molars. Something is humming a lullaby. Pick 4 and keep moving.',
  done: '🦷 Four molars, still warm. They click in your pocket. Back through the portal.',
  cols: [[-6, -6, 0.6, 0.6], [6, -6, 0.6, 0.6], [-6, 2, 0.6, 0.6], [6, 2, 0.6, 0.6]],
  picks: [{ x: -7.5, z: -2 }, { x: 7.5, z: -2 }, { x: -3, z: -8.5 }, { x: 3.2, z: -8.5 }],
  hazards: [
    { axis: 'x', at: -4.2, c: 0, amp: 8, speed: 0.9, r: 1.1, dmg: 9, line: 'Shears. Snip. "Hush now."' },
    { axis: 'x', at: 0.2, c: 0, amp: 8, speed: 1.2, phase: 2.4, r: 1.1, dmg: 9, line: '"Naughty little picker."' },
    { kind: 'geyser', x: 0, z: -8.5, period: 3.2, on: 0.9, phase: 1.2, r: 1.4, dmg: 11, line: 'A root wraps your ankle and squeezes.' }
  ],
  build(api, K) {
    const { THREE } = K, h = this.h;
    // 8 pale trunks + 8 crowns + 48 molars hanging off them: 3 instanced draws
    const trunks = [], crowns = [], teeth = [];
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 2], [6, 2], [-8.4, 7], [8.4, 7], [-2.6, -10], [2.6, -10]]) {
      trunks.push([x, 1.6, z, 0.35, 3.2, 0.35, 0, 0xd8ccb0]); crowns.push([x, 4.0, z, 2.0, 1.4, 2.0, 0, 0x5a1a20]);
      for (let k = 0; k < 6; k++) { const a = k * 1.05 + x; teeth.push([x + Math.cos(a) * 1.5, 3.2 - (k % 2) * 0.3, z + Math.sin(a) * 1.5, 0.16, 0.22, 0.16, 0, 0xf4eedc]); }
    }
    K.inst(K.geo.cyl, K.std(0xffffff, { roughness: 0.9 }), trunks); K.inst(K.geo.sph, K.std(0xffffff, { roughness: 1 }), crowns); K.inst(K.geo.box, K.std(0xffffff, { roughness: 0.3 }), teeth);
    for (const c of this.cols) api.col(c[0], c[1], c[2], c[3], 'tall');
    api.sign('MOTHER OSSERY\u2019S ORCHARD', 0xd8d0b0, 0, 5.4, -10.9, 0, 6);
    api.sign('PICKERS WILL BE PRUNED', 0xff3a3a, 0, 4.1, -10.9, 0, 4.4);
    // Mother Ossery: tall, grey bun, long apron, at the back under the biggest tree, swaying to her own lullaby
    api.person({ skin: 0xb8a898, top: 0x3a2a2a, bottom: 0x2a1a1a, hair: 0x9a9a9a, hairStyle: 'bun', size: 1.15 }, 0, -10.2, 0, (p, t) => { p.torso.rotation.z = Math.sin(t * 0.8) * 0.12; p.head.rotation.z = Math.sin(t * 0.8 + 1) * 0.15; });
    const picks = this.picks.map(p => { const o = new THREE.Mesh(K.geo.box, K.glow(0xfff8e8)); o.scale.set(0.32, 0.42, 0.32); o.position.set(p.x, 1.1, p.z); api.g.add(o); return o; });
    const pruner = i => api.person({ skin: 0xc8b8a8, top: 0x4a3a30, bottom: 0x3a2a20, hair: 0x202020, hairStyle: 'cap', size: 1.1 }, 0, 0, 0, (p, t) => { p.arms[0].rotation.x = -1.3 + Math.sin(t * 6 + i) * 0.4; p.arms[1].rotation.x = -1.3 - Math.sin(t * 6 + i) * 0.4; for (let k = 0; k < 2; k++) p.legs[k].rotation.x = Math.sin(t * 4 + k * 3) * 0.35; }).group;
    const root = new THREE.Mesh(K.geo.cone, K.std(0x6a3a2a, { roughness: 1 })); root.scale.set(0.9, 2.4, 0.9); root.position.set(0, -2, -8.5); api.g.add(root);
    const hz = [pruner(0), pruner(1), root];
    return { picks, hazards: hz, tick(t) { picks.forEach((o, i) => { o.rotation.y = t * 1.5 + i; o.position.y = 1.1 + Math.sin(t * 2 + i) * 0.1; }); } };
  },
  // the root: buried while off, spikes up while on
  place(o, q) { o.position.y = q.on ? 1.2 : q.k > 0.85 ? -2 + (q.k - 0.85) / 0.15 * 1.4 : -2; }
};
