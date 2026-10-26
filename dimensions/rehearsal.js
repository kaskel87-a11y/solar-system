// Dimension 9: The Rehearsal. An empty theatre where a waxen copy of Silas has been practising being Silas for 30 years.
// Mannequins fill the seats, all wearing your face. Objective: 3 pages of the script. Hazards: a stagehand on the boards
// and the Understudy, who follows you (faster than the Dial Tone).
export const REHEARSAL = {
  id: 'rehearsal', name: 'The Rehearsal', w: 20, d: 20, h: 8, host: 'The Understudy',
  wall: 0x1a0a0e, floor: 0x2a1a12, ceil: 0x0a0406, trim: 0xd02040, light: { color: 0xffd0a0, int: 85 },
  intro: '🌀 The Rehearsal. The audience has your face. Something on stage has Silas\u2019s. Grab the 3 script pages.',
  done: '📜 Three pages: SILAS, ACT ONE. The real Silas is tied up in the prompt box. You cut him loose. Back through the portal.',
  cols: [[0, -7.4, 8, 1.6], [-5.5, 1.5, 3, 0.4], [5.5, 1.5, 3, 0.4], [-5.5, 4.5, 3, 0.4], [5.5, 4.5, 3, 0.4]],
  picks: [{ x: -8, z: -4.6 }, { x: 8, z: -4.6 }, { x: 0, z: 3 }],
  hazards: [
    { axis: 'x', at: -3.6, c: 0, amp: 8, speed: 1.1, r: 1.0, dmg: 8, line: '"Places, everyone. PLACES."' },
    { kind: 'stalker', x: 0, z: -4.4, speed: 1.6, r: 0.9, dmg: 9, line: '"Colleague. Colleague. Give me the face."' }
  ],
  build(api, K) {
    const { THREE } = K;
    api.box(0, 0.6, -7.4, 16, 1.2, 3.2, api.mat(0x3a2418)); // the stage
    api.box(-8.6, 3.5, -8.2, 1.6, 7, 0.4, api.mat(0x8a0a1a, { roughness: 1 })); api.box(8.6, 3.5, -8.2, 1.6, 7, 0.4, api.mat(0x8a0a1a, { roughness: 1 }));
    for (const c of this.cols) api.col(c[0], c[1], c[2], c[3]);
    // two rows of seats with mannequins: 1 draw for seats, 1 for bodies, 1 for heads
    const seats = [], bodies = [], heads = [];
    for (const z of [1.5, 4.5]) for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = s * (3.4 + i * 1.4); seats.push([x, 0.45, z + 0.3, 1.0, 0.9, 0.7, 0, 0x5a0a14]); bodies.push([x, 1.2, z, 0.5, 0.8, 0.3, 0, 0xd8c8b8]); heads.push([x, 1.85, z, 0.22, 0.26, 0.22, 0, 0xe8d8c8]); }
    K.inst(K.geo.box, K.std(0xffffff, { roughness: 1 }), seats); K.inst(K.geo.box, K.std(0xffffff, { roughness: 0.5 }), bodies); K.inst(K.geo.sph, K.std(0xffffff, { roughness: 0.4 }), heads);
    api.sign('TONIGHT: SILAS (A NEW ONE)', 0xd02040, 0, 6.0, -9.9, 0, 6);
    api.sign('UNDERSTUDY WILL PERFORM', 0xffd0a0, 0, 4.8, -9.9, 0, 4.4);
    const picks = this.picks.map(p => { const o = new THREE.Mesh(K.geo.box, K.glow(0xfff4e0)); o.scale.set(0.45, 0.02, 0.6); o.position.set(p.x, 1.0, p.z); api.g.add(o); return o; });
    const hand = api.person({ skin: 0xc8b8a8, top: 0x101010, bottom: 0x101010, hair: 0x101010, hairStyle: 'cap' }, 0, 0, 0, (p, t) => { for (let k = 0; k < 2; k++) p.legs[k].rotation.x = Math.sin(t * 5 + k * 3) * 0.35; }).group;
    // the Understudy: Silas, but waxen and too smooth: no beard, no goggles, coveralls slightly too clean
    const u = api.person({ skin: 0xf0e4d4, top: 0xd8d0c0, bottom: 0x5a6a3a, shoes: 0x2a1a10, hair: 0xd8d8d8, hairStyle: 'bald', size: 1.08, bulk: 0.92 }, 0, 0, 0, (p, t) => { p.arms[0].rotation.x = -1.4; p.arms[1].rotation.x = -1.4; p.head.rotation.z = Math.sin(t * 2) * 0.1; for (let k = 0; k < 2; k++) p.legs[k].rotation.x = Math.sin(t * 6 + k * 3) * 0.4; });
    const spot = new THREE.Mesh(K.geo.disc, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.25, depthWrite: false })); api.disposables.push(spot.material); spot.rotation.x = -Math.PI / 2; spot.scale.setScalar(1.3); spot.position.y = 0.03; u.group.add(spot);
    return { picks, hazards: [hand, u.group] };
  }
};
