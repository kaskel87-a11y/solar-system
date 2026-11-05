// Dimension 8: Lien & Sons Organ Pawn. A pawnshop that only takes body parts, memories and years. All on shelves, in jars.
// Objective: ticket, jar, receipt, in that order. Hazards: two repo men on the floor and Mr. Lien, who follows you.
export const PAWN = {
  id: 'pawn', name: 'Lien & Sons Organ Pawn', w: 18, d: 18, h: 6, order: true, host: 'Mr. Lien',
  wall: 0x2a2418, floor: 0x3a2c1c, ceil: 0x14100a, trim: 0xc8a040, light: { color: 0xffd890, int: 75 },
  intro: '🌀 Lien & Sons. Every jar has a name on it. Ticket, then the jar marked MUCKRIDGE, then the receipt. Don\u2019t haggle.',
  done: '🫙 Ticket, jar, receipt. Mr. Lien\u2019s smile goes all the way round his head. Back through the portal.',
  cols: [[-8.2, 0, 0.6, 8], [8.2, 0, 0.6, 8], [0, -6.8, 4, 0.6]],
  picks: [{ x: -4.5, z: -5.4, label: 'ticket' }, { x: 6.6, z: 1.5, label: 'jar' }, { x: 3.5, z: -5.4, label: 'receipt' }],
  hazards: [
    { axis: 'x', at: -1.5, c: 0, amp: 6.5, speed: 1.0, r: 1.0, dmg: 9, line: '"Payment\u2019s due, friend."' },
    { axis: 'x', at: 3.2, c: 0, amp: 6, speed: 1.3, phase: 2, r: 1.0, dmg: 9, line: '"We take kidneys. We take two."' },
    { kind: 'stalker', x: 0, z: -5.6, speed: 1.4, r: 0.9, dmg: 7, line: '"Interest, friend. Interest."' }
  ],
  build(api, K) {
    const { THREE } = K;
    // two shelving walls of specimen jars: 1 draw for shelves, 1 for jars (amber glass), 1 for the floating things inside
    const shelves = [], jars = [], bits = [];
    for (const s of [-1, 1]) for (let r = 0; r < 3; r++) { shelves.push([s * 8.2, 0.9 + r * 1.3, 0, 0.9, 0.06, 15, 0, 0x4a3820]); for (let i = 0; i < 10; i++) { const z = -7 + i * 1.5; jars.push([s * 8.0, 1.25 + r * 1.3, z, 0.28, 0.6, 0.28, 0, 0xd8a040]); bits.push([s * 8.0, 1.2 + r * 1.3, z, 0.14, 0.18, 0.14, 0, [0x8a2a2a, 0x6a3a2a, 0xc8a0a0, 0x3a2a4a][(i + r) % 4]]); } }
    K.inst(K.geo.box, K.std(0xffffff), shelves); K.inst(K.geo.cyl, K.std(0xffffff, { transparent: true, opacity: 0.45, roughness: 0.1 }), jars); K.inst(K.geo.sph, K.std(0xffffff, { roughness: 0.6 }), bits);
    api.box(0, 0.55, -6.8, 8, 1.1, 1.2, api.mat(0x5a4028)); api.box(0, 1.12, -6.8, 8.2, 0.06, 1.3, K.glow(0xc8a040));
    for (const c of this.cols) api.col(c[0], c[1], c[2], c[3], c[0] === 0 ? undefined : 'tall');
    api.sign('LIEN & SONS · ORGAN PAWN', 0xc8a040, 0, 4.3, -8.9, 0, 6);
    api.sign('WE BUY YEARS · NO QUESTIONS', 0xff3a3a, 0, 3.1, -8.9, 0, 4.6);
    const picks = this.picks.map(p => {
      if (p.label === 'jar') { const g = new THREE.Group(); const j = new THREE.Mesh(K.geo.cyl, K.std(0xd8a040, { transparent: true, opacity: 0.5 })); j.scale.set(0.35, 0.7, 0.35); j.position.y = 1.0; const l = new THREE.Mesh(K.geo.sph, K.std(0x6a2a1a)); l.scale.set(0.24, 0.16, 0.18); l.position.y = 1.0; g.add(j, l); g.position.set(p.x, 0, p.z); api.g.add(g); return g; }
      const o = new THREE.Mesh(K.geo.box, K.glow(p.label === 'ticket' ? 0xffe080 : 0xfff8e0)); o.scale.set(0.4, 0.03, 0.6); o.position.set(p.x, 1.2, p.z); api.g.add(o); return o;
    });
    const repo = i => api.person({ skin: 0xb89880, top: 0x1a1a1a, bottom: 0x1a1a1a, hair: 0x101010, hairStyle: 'cap', shades: true, size: 1.12, bulk: 1.2 }, 0, 0, 0, (p, t) => { p.arms[1].rotation.x = -0.6; for (let k = 0; k < 2; k++) p.legs[k].rotation.x = Math.sin(t * 5 + k * 3 + i) * 0.35; }).group;
    // Mr. Lien: thin, gold waistcoat, a smile that is too wide
    const lien = api.person({ skin: 0xd8c8b0, top: 0xc8a040, bottom: 0x2a2018, hair: 0x2a2a2a, hairStyle: 'short', size: 1.1, bulk: 0.8 }, 0, 0, 0, (p, t) => { p.head.rotation.z = Math.sin(t * 1.3) * 0.25; for (let k = 0; k < 2; k++) p.legs[k].rotation.x = Math.sin(t * 3 + k * 3) * 0.25; });
    const grin = new THREE.Mesh(K.geo.box, K.glow(0xffffff)); grin.scale.set(0.24, 0.03, 0.02); grin.position.set(0, -0.06, -0.13); lien.head.add(grin);
    return { picks, hazards: [repo(0), repo(1), lien.group] };
  }
};
