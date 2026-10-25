// Dimension 1: The Automat. A cafeteria where the vending machines are the customers and you are the snack.
// Objective: grab 3 exact-change tokens. Hazard: machines that charge across the floor.
export const AUTOMAT = {
  id: 'automat', name: 'The Automat', w: 16, d: 22, h: 6,
  wall: 0x231a33, floor: 0x0e2a2a, ceil: 0x120c1a, trim: 0xff2fa8, light: { color: 0xffd0f0, int: 80 },
  intro: '🌀 The Automat. Every machine in here is staring at you. Grab 3 exact-change tokens.',
  done: '🪙 Exact change. The machines scream in unison. Get back through the portal.',
  cols: [[-7.4, 0, 0.6, 10], [7.4, 0, 0.6, 10]],
  picks: [{ x: -5.2, z: 1.5 }, { x: 5.2, z: -3.5 }, { x: 0, z: -9 }],
  hazards: [
    { axis: 'x', at: 4, c: 0, amp: 5.4, speed: 1.2, r: 1.2, dmg: 9, line: '"INSERT COIN, MEAT."' },
    { axis: 'x', at: -1, c: 0, amp: 5.4, speed: 1.6, phase: 2, r: 1.2, dmg: 9, line: '"NO REFUNDS."' },
    { axis: 'x', at: -6, c: 0, amp: 5.4, speed: 2.0, phase: 4, r: 1.2, dmg: 9, line: '"OUT OF ORDER? OUT OF ORDER?!"' }
  ],
  build(api, K) {
    const { THREE } = K;
    // 16 wall machines + their glowing faces + 32 eyes: 3 instanced draw calls
    const bodies = [], faces = [], eyes = [];
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
      const z = -9.6 + i * 2.6, x = s * 7.4, c = [0xff2fa8, 0xffa020, 0x40c0ff, 0xd0d0e0][(i + (s > 0 ? 1 : 0)) % 4];
      bodies.push([x, 1.2, z, 1.1, 2.4, 1.0, 0, 0x2c2838]); faces.push([x - s * 0.56, 1.5, z, 0.02, 1.5, 0.8, 0, c]);
      for (const e of [-0.2, 0.2]) eyes.push([x - s * 0.6, 2.05, z + e, 0.07, 0.07, 0.07, 0, 0xffffff]);
    }
    K.inst(K.geo.box, K.std(0xffffff), bodies); K.inst(K.geo.box, K.glow(0xffffff), faces); K.inst(K.geo.sph, K.glow(0xffffff), eyes);
    for (const c of this.cols) api.col(c[0], c[1], c[2], c[3]);
    api.sign('THE AUTOMAT', 0xff2fa8, 0, 4.6, -10.9, 0, 6);
    api.sign('NO REFUNDS · NO SOULS', 0xffa020, 0, 3.4, -10.9, 0, 4.4);
    const picks = this.picks.map(p => { const o = new THREE.Mesh(K.geo.coin, K.glow(0xffd040)); o.scale.setScalar(0.42); o.position.set(p.x, 1.1, p.z); o.rotation.x = Math.PI / 2; api.g.add(o); return o; });
    const hz = this.hazards.map(() => {
      const g = new THREE.Group(); g.add(new THREE.Mesh(K.geo.box, K.std(0x3a2840))); g.children[0].scale.set(1.2, 2.3, 1.0); g.children[0].position.y = 1.15;
      const f = new THREE.Mesh(K.geo.box, K.glow(0xff2fa8)); f.scale.set(1.0, 0.25, 1.04); f.position.y = 2.0; g.add(f); api.g.add(g); return g;
    });
    return { picks, hazards: hz, tick(t) { for (const o of picks) o.rotation.z = t * 3; for (let i = 0; i < hz.length; i++) hz[i].rotation.z = Math.sin(t * 9 + i) * 0.06; } };
  }
};
