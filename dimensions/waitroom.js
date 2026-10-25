// Dimension 3: The Waiting Room at the End of Time. Infinite queue, one clerk, zero urgency.
// Objective: take tickets 1, 2, 3 in order, then grab the permit off the desk. Hazard: queue marshals.
export const WAITROOM = {
  id: 'waitroom', name: 'The Waiting Room', w: 20, d: 18, h: 5, order: true,
  wall: 0xd8d4c0, floor: 0x6a6a5a, ceil: 0xe8e8e0, trim: 0x40a0ff, light: { color: 0xe8f4ff, int: 90 },
  intro: '🌀 The Waiting Room. NOW SERVING: ∞. Step on tickets 1, 2, 3 in order, then grab the permit off the desk.',
  done: '📄 Permit 77-B, stamped "PROBABLY FINE". Back through the portal before they call your number.',
  cols: [[0, -7.6, 3, 0.6], [-6, 2, 2.6, 0.45], [6, 2, 2.6, 0.45], [-6, -2.5, 2.6, 0.45], [6, -2.5, 2.6, 0.45]],
  picks: [{ x: -8, z: 5.5, label: '1' }, { x: 8, z: -0.2, label: '2' }, { x: -8, z: -5, label: '3' }, { x: 0, z: -6.4, r: 1.4, label: 'permit' }],
  hazards: [
    { axis: 'x', at: -0.2, c: 0, amp: 8, speed: 0.9, r: 1.0, dmg: 7, line: '"BACK OF THE LINE."' },
    { axis: 'x', at: 4.2, c: 0, amp: 7.5, speed: 1.3, phase: 3, r: 1.0, dmg: 7, line: '"Have you filled in the form for the form?"' }
  ],
  build(api, K) {
    const { THREE } = K;
    const chairs = []; for (const z of [2, -2.5]) for (const s of [-1, 1]) for (let i = 0; i < 6; i++) chairs.push([s * (3.8 + i * 0.85), 0.45, z, 0.7, 0.9, 0.8, 0, 0x404858]);
    K.inst(K.geo.box, K.std(0xffffff), chairs);
    api.box(0, 0.55, -7.6, 6, 1.1, 1.2, api.mat(0x8a7a60)); for (const c of this.cols) api.col(c[0], c[1], c[2], c[3]);
    api.sign('NOW SERVING: ∞', 0x40a0ff, 0, 3.8, -8.9, 0, 5);
    api.sign('PLEASE WAIT. FOREVER.', 0x406080, 0, 2.6, -8.9, 0, 4, { bg: 'rgba(240,240,230,0.95)' });
    const clerk = api.person({ skin: 0x9aa0a8, top: 0x707880, bottom: 0x505860, hair: 0x707070, hairStyle: 'bald', size: 1.05 }, 0, -8.4, Math.PI, (p, t) => { p.head.rotation.y = Math.sin(t * 0.2) * 0.1; });
    void clerk;
    const picks = this.picks.map(p => {
      if (p.label === 'permit') { const o = new THREE.Mesh(K.geo.box, K.glow(0xfff8e0)); o.scale.set(0.5, 0.04, 0.7); o.position.set(p.x, 1.2, p.z); api.g.add(o); return o; }
      const o = api.sign(p.label, 0x40a0ff, p.x, 0.04, p.z, 0, 1.6); o.rotation.x = -Math.PI / 2; return o;
    });
    const hz = this.hazards.map(() => api.person({ skin: 0x9aa0a8, top: 0x2a3040, bottom: 0x2a3040, hair: 0x202020, hairStyle: 'cap', shades: true }, 0, 0, 0, (p, t) => { p.arms[0].rotation.x = Math.sin(t * 4) * 0.4; p.arms[1].rotation.x = -Math.sin(t * 4) * 0.4; for (let k = 0; k < 2; k++) p.legs[k].rotation.x = Math.sin(t * 6 + k * 3) * 0.4; }).group);
    return { picks, hazards: hz };
  }
};
