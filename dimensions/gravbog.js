// Dimension 2: The Upside-Down Bog. You walk on a lilac sky; the swamp hangs from the ceiling and drips upward.
// Objective: pick 3 bog orchids. Hazard: mud geysers that slam down from the "ground" above.
export const GRAVBOG = {
  id: 'gravbog', name: 'The Upside-Down Bog', w: 18, d: 20, h: 8,
  wall: 0x2a2440, floor: 0xb8a8d8, ceil: 0x6a5a3a, trim: 0xffa020, light: { color: 0xd8c8ff, int: 120 },
  intro: '🌀 The Upside-Down Bog. Down is up, the sky is the floor. Pick 3 bog orchids and mind the mud.',
  done: '🌸 Three orchids. They smell like a hangover. Back through the portal.',
  cols: [[-6.5, 5.5, 0.9, 0.9]],
  picks: [{ x: -6, z: -2 }, { x: 6, z: -6 }, { x: -2, z: -8 }],
  hazards: [
    { kind: 'geyser', x: -3.5, z: -4.5, period: 3, on: 1.0, r: 1.5, dmg: 10, line: 'SPLORT. Mud, from above.' },
    { kind: 'geyser', x: 3.5, z: -2, period: 3, on: 1.0, phase: 1.0, r: 1.5, dmg: 10, line: 'The bog rejects you.' },
    { kind: 'geyser', x: 1, z: -7.5, period: 2.4, on: 0.9, phase: 1.8, r: 1.5, dmg: 10, line: 'Mud in places mud should never be.' }
  ],
  build(api, K) {
    const { THREE } = K, h = this.h;
    // upside-down trees hanging from the ceiling: trunks + canopies, 2 instanced draws
    const trunks = [], tops = [];
    for (const [x, z] of [[-7, -8], [-6.5, 4], [7, 3], [6.8, -8.5], [-3, 7], [3, 7.5], [0, -9], [-7.5, -1]]) {
      trunks.push([x, h - 1.2, z, 0.25, 2.4, 0.25, 0, 0x3a2a1a]); tops.push([x, h - 3.4, z, 1.5, 2.6, 1.5, Math.PI, 0x5a4a8a]);
    }
    K.inst(K.geo.cyl, K.std(0xffffff), trunks); K.inst(K.geo.cone, K.std(0xffffff, { side: THREE.DoubleSide }), tops);
    // the sun under your feet + the stone in the middle
    const sun = new THREE.Mesh(K.geo.cyl, K.glow(0xfff0b0)); sun.scale.set(1.2, 0.04, 1.2); sun.position.set(0, 0.03, 4); api.g.add(sun);
    api.box(-6.5, 0.6, 5.5, 1.8, 1.2, 1.8, api.mat(0x4a3a5a)); for (const c of this.cols) api.col(c[0], c[1], c[2], c[3]);
    api.sign('THIS WAY UP ↓', 0xffa020, 0, 5.2, -9.9, 0, 4.5);
    // drips that fall up: one Points draw
    const N = 60, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = Math.random() * h; pos[i * 3 + 2] = (Math.random() - 0.5) * 18; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); api.disposables.push(pg);
    const pm = new THREE.PointsMaterial({ color: 0x8a7a50, size: 0.12 }); api.disposables.push(pm); const drips = new THREE.Points(pg, pm); api.g.add(drips);
    const picks = this.picks.map(p => { const g = new THREE.Group(); const c = new THREE.Mesh(K.geo.cone, K.glow(0xff7ad0)); c.scale.set(0.35, 0.5, 0.35); c.rotation.x = Math.PI; c.position.y = 1.1; const s = new THREE.Mesh(K.geo.sph, K.glow(0xffe080)); s.scale.setScalar(0.12); s.position.y = 0.8; g.add(c, s); g.position.set(p.x, 0, p.z); api.g.add(g); return g; });
    const hz = this.hazards.map(q => { const o = new THREE.Mesh(K.geo.cyl, K.std(0x3a2c18)); o.scale.set(1.2, h, 1.2); o.position.set(q.x, h * 1.5, q.z); api.g.add(o); return o; });
    return {
      picks, hazards: hz,
      tick(t) { const a = pg.attributes.position; for (let i = 0; i < N; i++) { let y = a.array[i * 3 + 1] + 0.03; if (y > h) y = 0; a.array[i * 3 + 1] = y; } a.needsUpdate = true; for (const g of picks) g.rotation.y = t; }
    };
  },
  // geysers: hang above, slam to the floor while on
  place(o, q, h) { o.position.y = q.on ? h / 2 : q.k > 0.8 ? h * 1.5 - (q.k - 0.8) / 0.2 * h * 0.5 : h * 1.5; }
};
