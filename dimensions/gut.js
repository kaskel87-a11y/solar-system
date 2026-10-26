// Dimension 10 (finale): The Gut. The space between every dimension Silas ever opened. It is wet, it is red, it is
// closing. Objective: nail 4 anchors before it shuts (60 s, then it spits you out and you start again). Hazards: two
// clenching lumps of gut wall rolling down the tube and the Hungry Quiet, which follows you.
export const GUT = {
  id: 'gut', name: 'The Gut', w: 18, d: 22, h: 7, limit: 60, host: 'The Hungry Quiet',
  wall: 0x4a0a14, floor: 0x5a1420, ceil: 0x2a040a, trim: 0xff2fa8, light: { color: 0xff6a7a, int: 90 },
  intro: '🌀 The Gut. Everything Silas ever opened leads here, and it\u2019s closing. Nail 4 anchors in 60 seconds.',
  done: '⚓ Four anchors. The Gut swallows, once, and goes quiet. Get out before it changes its mind.',
  cols: [[-5, -3, 0.7, 0.7], [5, -3, 0.7, 0.7]],
  picks: [{ x: -7, z: -8 }, { x: 7, z: -8 }, { x: -7, z: 2 }, { x: 7, z: 2 }],
  hazards: [
    { axis: 'z', at: -2.2, c: -2, amp: 7.5, speed: 0.9, r: 1.1, dmg: 10, line: 'The wall contracts. It squeezes.' },
    { axis: 'z', at: 2.2, c: -2, amp: 7.5, speed: 0.9, phase: Math.PI, r: 1.1, dmg: 10, line: 'Peristalsis. You are food.' },
    { kind: 'stalker', x: 0, z: -9, speed: 1.5, r: 1.0, dmg: 9, line: '(The Quiet takes a bite of you.)' }
  ],
  build(api, K) {
    const { THREE } = K, h = this.h;
    // ribbed walls: 12 rings (1 draw), dangling villi (1 draw)
    const ribs = [], villi = [];
    for (let i = 0; i < 12; i++) ribs.push([0, h / 2, -10 + i * 1.8, 8.2, 3.4, 0.6, 0, i % 2 ? 0x6a1424 : 0x7a1a2c]);
    for (let i = 0; i < 40; i++) villi.push([(i * 3.7 % 16) - 8, h - 0.6 - (i % 3) * 0.3, (i * 5.3 % 20) - 10, 0.12, 1.2 + (i % 4) * 0.3, 0.12, 0, 0x9a2a3a]);
    const ribIM = K.inst(K.geo.torus, K.std(0xffffff, { roughness: 0.4 }), ribs); K.inst(K.geo.cyl, K.std(0xffffff, { roughness: 0.3 }), villi);
    for (const [x, z] of [[-5, -3], [5, -3]]) { const s = new THREE.Mesh(K.geo.cone, api.mat(0x3a0408)); s.scale.set(1.2, 3, 1.2); s.position.set(x, 1.5, z); api.g.add(s); }
    for (const c of this.cols) api.col(c[0], c[1], c[2], c[3], 'tall');
    api.sign('THE GUT', 0xff2fa8, 0, 5.2, -10.9, 0, 4);
    api.sign('NO WAY OUT BUT BACK', 0xffa020, 0, 4.0, -10.9, 0, 4.4);
    const picks = this.picks.map(p => { const g = new THREE.Group(); const spike = new THREE.Mesh(K.geo.cone, K.glow(0xffa020)); spike.scale.set(0.3, 1.2, 0.3); spike.rotation.x = Math.PI; spike.position.y = 0.9; const ring = new THREE.Mesh(K.geo.torus, K.glow(0xff2fa8)); ring.scale.setScalar(0.5); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; g.add(spike, ring); g.position.set(p.x, 0, p.z); api.g.add(g); return g; });
    const band = () => { const o = new THREE.Mesh(K.geo.sph, K.std(0x9a1a2e, { roughness: 0.25 })); o.scale.set(1.1, 1.3, 1.1); o.position.y = 1.0; api.g.add(o); return o; }; // a clenching lump of gut wall
    // the Hungry Quiet: a black mouth-shaped hole that hovers and opens
    const q = new THREE.Group(); const hole = new THREE.Mesh(K.geo.sph, new THREE.MeshBasicMaterial({ color: 0x000000 })); api.disposables.push(hole.material); hole.scale.set(1.0, 1.4, 0.4); hole.position.y = 1.6; const lip = new THREE.Mesh(K.geo.torus, K.glow(0xff2fa8)); lip.scale.set(1.0, 1.4, 1); lip.position.y = 1.6; q.add(hole, lip); api.g.add(q);
    const b1 = band(), b2 = band();
    return { picks, hazards: [b1, b2, q], tick(t) { b1.scale.y = 1.3 + Math.sin(t * 4) * 0.25; b2.scale.y = 1.3 + Math.cos(t * 4) * 0.25; ribIM.scale.set(1 + Math.sin(t * 2) * 0.04, 1, 1); hole.scale.y = 1.2 + Math.sin(t * 1.3) * 0.4; lip.scale.y = hole.scale.y; for (const g of picks) g.rotation.y = t * 2; } };
  }
};
