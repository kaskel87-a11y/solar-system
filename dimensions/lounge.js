// Dimension 5: The Last Bar. Open until the heat death of the universe. Every regular is a different Silas.
// Objective: grab 3 pages of "Unified Hangover Theory". Hazard: stumbling alternate Silases.
export const LOUNGE = {
  id: 'lounge', name: 'The Last Bar', w: 16, d: 16, h: 5,
  wall: 0x1a1020, floor: 0x2a1a12, ceil: 0x0a0810, trim: 0xffa020, light: { color: 0xffb070, int: 55 },
  intro: '🌀 The Last Bar. Every drunk in here is Silas. Grab the 3 pages of his notes before one of him notices.',
  done: '📜 Three pages. Somewhere a version of Silas starts crying. Back through the portal.',
  cols: [[0, -6.6, 5, 0.6], [-4, 1, 0.7, 0.7], [4, 1, 0.7, 0.7]],
  picks: [{ x: -4, z: 2.4 }, { x: 4.2, z: -0.5 }, { x: 0, z: -5.3 }],
  hazards: [
    { axis: 'x', at: -2.2, c: 0, amp: 5.5, speed: 0.8, r: 1.0, dmg: 6, line: '"Watch it. I\'m you, but worse."' },
    { axis: 'z', at: 0, c: 0, amp: 4.5, speed: 1.1, phase: 2, r: 1.0, dmg: 6, line: '"Get your own multiverse."' }
  ],
  build(api, K) {
    const { THREE } = K;
    api.box(0, 0.55, -6.6, 10, 1.1, 1.2, api.mat(0x4a2a1a)); api.box(0, 1.12, -6.6, 10.2, 0.06, 1.3, K.glow(0xffa020));
    for (const [x, z] of [[-4, 1], [4, 1]]) { api.box(x, 0.4, z, 1.4, 0.8, 1.4, api.mat(0x3a2418)); }
    for (const c of this.cols) api.col(c[0], c[1], c[2], c[3]);
    api.sign('THE LAST BAR', 0xffa020, 0, 3.8, -7.9, 0, 5);
    api.sign('OPEN UNTIL THE HEAT DEATH', 0xff2fa8, 0, 2.8, -7.9, 0, 4.4);
    // regulars at the bar: all of them Silas, all slightly wrong
    const silas = (top, size) => ({ skin: 0xd8b090, top, bottom: 0x3a3a2a, hair: 0xb8b8b8, hairStyle: 'bald', size });
    api.person(silas(0x101010, 1.05), -3, -5.6, Math.PI, (p, t) => { p.torso.rotation.x = 0.25 + Math.sin(t) * 0.05; });
    api.person(silas(0x8a1a2a, 0.95), 2.6, -5.6, Math.PI, (p, t) => { p.head.rotation.z = Math.sin(t * 0.7) * 0.2; });
    const picks = this.picks.map(p => { const o = new THREE.Mesh(K.geo.box, K.glow(0xfff4e0)); o.scale.set(0.45, 0.02, 0.6); o.position.set(p.x, 1.0, p.z); api.g.add(o); return o; });
    const hz = this.hazards.map((q, i) => api.person(silas([0x4a5a2a, 0x203a6a][i], 1), 0, 0, 0, (p, t) => { p.torso.rotation.z = Math.sin(t * 2 + i) * 0.2; for (let k = 0; k < 2; k++) p.legs[k].rotation.x = Math.sin(t * 5 + k * 3) * 0.35; }).group);
    return { picks, hazards: hz };
  }
};
