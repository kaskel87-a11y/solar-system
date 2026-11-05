// Dimension 7: The Hum. A chapel-sized switchboard where every call nobody answered ends up, ringing forever.
// Objective: pick up lines 1, 2, 3 in order (line 3 is Tam, from a timeline where she stayed home). Hazards: two
// linemen walking the aisles and the Dial Tone, a slow shape that follows you wherever you stand.
export const HUM = {
  id: 'hum', name: 'The Hum', w: 18, d: 20, h: 7, order: true, host: 'The Lineman',
  wall: 0x10141a, floor: 0x1a1e24, ceil: 0x08090c, trim: 0x40d0c0, light: { color: 0x80e0d8, int: 70 },
  intro: '🌀 The Hum. A thousand phones ringing. Pick up 1, 2, 3 in order. Do not answer anything else.',
  done: '📼 Line 3: Tam\u2019s voice, laughing at something. You hang up before you learn what. Back through the portal.',
  cols: [[-8.4, 0, 0.5, 9], [8.4, 0, 0.5, 9], [0, -1.5, 1.4, 0.5]],
  picks: [{ x: -6.8, z: 4, label: '1' }, { x: 6.8, z: -2.5, label: '2' }, { x: 0, z: -7.5, label: '3' }],
  hazards: [
    { axis: 'z', at: -3.6, c: -1, amp: 7, speed: 0.8, r: 1.0, dmg: 8, line: '"Please hold."' },
    { axis: 'z', at: 3.6, c: -1, amp: 7, speed: 1.1, phase: 1.7, r: 1.0, dmg: 8, line: '"This call may be recorded. Forever."' },
    { kind: 'stalker', x: 0, z: -8.5, speed: 1.2, r: 0.9, dmg: 6, line: 'The Dial Tone is inside your teeth.' }
  ],
  build(api, K) {
    const { THREE } = K;
    // two walls of switchboard jacks (one instanced draw) with blinking lamps (one more)
    const panels = [], lamps = [];
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const z = -8 + i * 2.6; panels.push([s * 8.4, 2.4, z, 0.5, 4.2, 2.3, 0, 0x2a2e34]); for (let k = 0; k < 4; k++) lamps.push([s * 8.1, 1.2 + k * 0.9, z - 0.6 + (k % 2) * 1.2, 0.06, 0.12, 0.12, 0, k % 2 ? 0xff4040 : 0x40d0c0]); }
    K.inst(K.geo.box, K.std(0xffffff, { metalness: 0.4 }), panels); const lampIM = K.inst(K.geo.box, K.glow(0xffffff), lamps);
    api.box(0, 0.6, -1.5, 2.8, 1.2, 1.0, api.mat(0x3a3028)); for (const c of this.cols) api.col(c[0], c[1], c[2], c[3], 'tall');
    api.sign('ALL OF OUR OPERATORS ARE DEAD', 0x40d0c0, 0, 5.0, -9.9, 0, 6);
    api.sign('YOUR CALL MATTERS', 0xff4040, 0, 3.8, -9.9, 0, 4);
    // the Lineman: no face, headset, at the main desk
    const lm = api.person({ skin: 0xd8d8d8, top: 0x2a3a4a, bottom: 0x1a2028, hair: 0x101010, hairStyle: 'bald', size: 1.05 }, 0, -2.3, Math.PI, (p, t) => { p.head.rotation.x = Math.sin(t * 0.4) * 0.15; p.arms[0].rotation.x = -0.8 + Math.sin(t * 7) * 0.1; });
    const set = new THREE.Mesh(K.geo.torus, api.mat(0x101010)); set.scale.setScalar(0.16); set.rotation.y = Math.PI / 2; lm.head.add(set);
    const picks = this.picks.map(p => { const g = new THREE.Group(); const ph = new THREE.Mesh(K.geo.box, K.std(0x101010)); ph.scale.set(0.5, 0.25, 0.3); ph.position.y = 1.0; const lamp = new THREE.Mesh(K.geo.sph, K.glow(0x40d0c0)); lamp.scale.setScalar(0.12); lamp.position.y = 1.25; g.add(ph, lamp); g.position.set(p.x, 0, p.z); api.g.add(g); api.sign(p.label, 0x40d0c0, p.x, 1.9, p.z, 0, 1.0); return g; });
    const op = i => api.person({ skin: 0xd8d8d8, top: 0x2a3a4a, bottom: 0x1a2028, hair: 0x101010, hairStyle: 'bald' }, 0, 0, 0, (p, t) => { p.arms[0].rotation.x = -1.0; for (let k = 0; k < 2; k++) p.legs[k].rotation.x = Math.sin(t * 4 + k * 3 + i) * 0.3; }).group;
    // the Dial Tone: a tall black column with a teal ring, it hums
    const tone = new THREE.Group(); const col = new THREE.Mesh(K.geo.cyl, K.std(0x050505, { roughness: 0.2 })); col.scale.set(0.5, 2.8, 0.5); col.position.y = 1.4; const ring = new THREE.Mesh(K.geo.torus, K.glow(0x40d0c0)); ring.scale.setScalar(0.7); ring.rotation.x = Math.PI / 2; ring.position.y = 1.4; tone.add(col, ring); api.g.add(tone);
    return { picks, hazards: [op(0), op(1), tone], tick(t) { ring.position.y = 0.4 + (t * 1.5 % 2.4); lampIM.visible = Math.sin(t * 9) > -0.6; } };
  }
};
