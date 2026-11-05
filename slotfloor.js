// v7.5.36 the Velvet gaming floor (slotfloor.js): the slot machines moved from the old south-west corner to the lobby's west
// wall by Blackjack: a bank of 8 cabinets + the giant 'Olympus Mega' progressive machine (4.6 m, live pot marquee).
// Static parts are baked into one mesh per material (bulbs into 3 flicker phases) so 9 machines stay ~30 draw calls.
// Rules, odds and the pot live in slots.js (pure, unit-tested); interiors.js calls addSlotBank(api) while building the club.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BANK, MEGA, megaPot, addPot, fmtPot } from './slots.js';

function bakeInto(root, api) {
  root.updateMatrixWorld(true); const byMat = new Map();
  root.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); (byMat.get(o.material) || byMat.set(o.material, []).get(o.material)).push(g.index ? g.toNonIndexed() : g); });
  const out = [];
  for (const [m, gs] of byMat) { const mg = gs.length > 1 ? mergeGeometries(gs, false) : gs[0]; gs.forEach(g => g !== mg && g.dispose()); if (!mg) continue; const mesh = new THREE.Mesh(mg, m); api.g.add(mesh); api.disposables?.push(mg); out.push(mesh); }
  return out;
}

export function addSlotBank(api, o = {}) {
  const { mat, G } = api, C = { ...BANK, ...o };
  const tmp = new THREE.Group(), phase = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  // a box in machine-local coords (front = +z) for a machine centred at world (C.x + ox, zc), turned to face +x
  const at = zc => (x, y, z, sx, sy, sz, m, grp = tmp) => { const b = new THREE.Mesh(G.box, m); b.position.set(C.x + z, y, zc - x); b.scale.set(sz, sy, sx); grp.add(b); return b; };
  const body = mat(0x1c1820, { roughness: 0.6, metalness: 0.5 }), chrome = mat(0xc8ccd4, { metalness: 0.9, roughness: 0.3 }), glass = mat(0x0a0a10, { roughness: 0.2, metalness: 0.3 });
  const marq = [mat(0xff3cc8, { basic: true }), mat(0xffd040, { basic: true }), mat(0x7af0ff, { basic: true })], lit = mat(0xfff0c0, { basic: true }), payl = mat(0xff2a2a, { basic: true });
  const btn = [0xff3030, 0x30ff60, 0xffd040].map(c => mat(c, { basic: true })), red = mat(0xd0201a, { roughness: 0.4 });
  const spots = [];
  for (let i = 0; i < C.n; i++) {
    const zc = C.z0 + i * C.gap, B = at(zc), D = 0.7, fz = D / 2, mq = marq[i % 3];
    B(0, 0.45, 0, 0.86, 0.9, D, body); B(0, 1.35, -0.05, 0.84, 0.9, D - 0.1, body); B(0, 1.98, -0.02, 0.9, 0.38, D - 0.04, body);
    B(0, 1.98, fz + 0.005, 0.78, 0.26, 0.02, mq); B(0, 1.35, fz - 0.04, 0.7, 0.5, 0.02, glass);
    for (let k = 0; k < 3; k++) B((k - 1) * 0.22, 1.35, fz - 0.03, 0.18, 0.36, 0.01, lit);
    B(0, 1.35, fz - 0.025, 0.7, 0.03, 0.01, payl); B(0, 0.86, fz + 0.08, 0.84, 0.06, 0.24, chrome);
    for (let k = 0; k < 3; k++) B(-0.22 + k * 0.22, 0.9, fz + 0.1, 0.12, 0.03, 0.08, btn[k]);
    B(0, 0.32, fz + 0.04, 0.5, 0.12, 0.1, chrome); B(0.46, 1.4, 0, 0.04, 0.7, 0.05, chrome);
    { const k = new THREE.Mesh(G.sph, red); k.position.set(C.x, 1.78, zc - 0.46); k.scale.setScalar(0.07); tmp.add(k); }
    for (let k = 0; k < 5; k++) B(-0.36 + k * 0.18, 2.2, fz + 0.01, 0.05, 0.05, 0.05, marq[(k + i) % 2], phase[(k + i) % 3]);
    api.col(C.x, zc, D / 2 + 0.05, C.gap / 2);
    if (i % 2) spots.push(api.spot({ id: 'slots', x: C.x + 1.15, z: zc - C.gap / 2, r: 1.05, label: '🎰 Play', act: 'slots' }));
  }
  api.sign('SLOTS', 0xffd040, C.x + 0.3, 3.1, C.z0 + (C.n - 1) * C.gap / 2, Math.PI / 2, 2.2, { w: 256, h: 64, font: 'bold 50px system-ui, sans-serif' });
  api.sign('LOOSEST SLOTS ON MARS · 10–200 CR', 0xff3cc8, C.x + 0.3, 2.62, C.z0 + (C.n - 1) * C.gap / 2, Math.PI / 2, 4.4, { w: 768, h: 96, font: 'bold 52px system-ui, sans-serif' });
  // ---- the Olympus Mega: 2.2 m wide, 4.6 m tall (2.5x a person), its own lit marquee with the live pot ----
  const zc = C.megaZ, M = at(zc), gold = mat(0xd4a020, { metalness: 0.85, roughness: 0.3 }), deep = mat(0x2a0830, { roughness: 0.5, metalness: 0.4 });
  M(0, 0.6, 0.05, 2.1, 1.2, 1.3, deep); M(0, 1.15, 0.72, 2.0, 0.08, 0.36, gold); // base + button deck
  M(0, 2.25, -0.05, 2.0, 2.1, 1.1, deep); M(0, 2.2, 0.51, 1.8, 1.1, 0.02, glass);
  for (let k = 0; k < 3; k++) M((k - 1) * 0.56, 2.2, 0.53, 0.48, 0.9, 0.01, lit);
  M(0, 2.2, 0.535, 1.8, 0.05, 0.01, payl);
  for (const sx of [-1.07, 1.07]) M(sx, 2.3, 0.05, 0.14, 4.6, 1.3, gold); // gold pillars
  M(0, 4.05, -0.1, 2.2, 1.3, 0.9, deep); M(0, 4.7, -0.1, 2.3, 0.12, 1.0, gold);
  for (let k = 0; k < 3; k++) M(-0.5 + k * 0.5, 1.2, 0.86, 0.3, 0.05, 0.14, btn[k]);
  M(1.25, 2.0, 0.1, 0.07, 1.6, 0.08, chrome); { const k = new THREE.Mesh(G.sph, red); k.position.set(C.x + 0.1, 2.9, zc - 1.25); k.scale.setScalar(0.16); tmp.add(k); }
  for (let k = 0; k < 14; k++) { M(-1.0 + k * (2.0 / 13), 4.82, 0.42, 0.09, 0.09, 0.09, marq[k % 3], phase[k % 3]); M(-1.0 + k * (2.0 / 13), 3.32, 0.42, 0.09, 0.09, 0.09, marq[(k + 1) % 3], phase[(k + 1) % 3]); }
  for (let k = 0; k < 8; k++) for (const sx of [-1.07, 1.07]) M(sx, 0.4 + k * 0.55, 0.68, 0.08, 0.08, 0.04, marq[(k + (sx > 0)) % 3], phase[k % 3]);
  api.col(C.x + 0.05, zc, 0.7, 1.2, 'tall');
  // the live marquee: a canvas texture, redrawn when the pot ticks over
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const cx2 = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  let shown = -1, flashT = 0;
  const draw = (v, fl) => { cx2.fillStyle = fl ? '#ffd040' : '#120414'; cx2.fillRect(0, 0, 512, 256); cx2.strokeStyle = fl ? '#ff3cc8' : '#ffd040'; cx2.lineWidth = 10; cx2.strokeRect(6, 6, 500, 244); cx2.textAlign = 'center';
    cx2.fillStyle = fl ? '#000' : '#ff3cc8'; cx2.font = 'bold 50px system-ui, sans-serif'; cx2.fillText('🌋 MEGA JACKPOT', 256, 74); cx2.fillStyle = fl ? '#000' : '#ffd040'; cx2.font = 'bold 92px system-ui, sans-serif'; cx2.fillText(fmtPot(v), 256, 176); cx2.font = 'bold 34px system-ui, sans-serif'; cx2.fillStyle = fl ? '#000' : '#fff'; cx2.fillText('CR · 100 CR A PULL', 256, 226); tex.needsUpdate = true; };
  const pm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), pg = new THREE.PlaneGeometry(2.0, 1.0), panel = new THREE.Mesh(pg, pm);
  panel.position.set(C.x + 0.37, 4.05, zc); panel.rotation.y = Math.PI / 2; api.g.add(panel); api.disposables?.push(pg, pm, tex);
  api.sign('OLYMPUS MEGA', 0xffd040, C.x + 0.3, 5.3, zc, Math.PI / 2, 2.6, { w: 512, h: 96, font: 'bold 60px system-ui, sans-serif' });
  spots.push(api.spot({ id: 'megaslot', x: C.x + 1.75, z: zc, r: 1.15, label: '🎰 Mega Jackpot · 100–1000 cr', act: 'slots', big: true }));
  const baked = bakeInto(tmp, api), lights = phase.map(g => bakeInto(g, api));
  let amb = 0, lastT = 0;
  api.ticks.push(t => {
    const fl = performance.now() < (window.__megaFlash || 0), k = Math.floor(t * (fl ? 14 : 4));
    lights.forEach((ms, i) => { const on = fl ? (k + i) % 2 === 0 : ((i + k) % 3) !== 0; ms.forEach(m => { m.visible = on; }); });
    if (lastT && t - lastT < 1) { amb += t - lastT; if (amb >= MEGA.ambientEvery) { amb = 0; addPot(1); } } lastT = t; // the rest of the floor keeps pulling
    const v = Math.floor(megaPot()), f2 = fl && k % 2 === 0; if (v !== shown || fl !== !!flashT) { shown = v; flashT = fl ? 1 : 0; draw(v, f2); } else if (fl) draw(v, f2);
  });
  draw(megaPot(), false); shown = Math.floor(megaPot());
  window.__slotFloor = { baked: baked.length, lights: lights.reduce((a, l) => a + l.length, 0), machines: C.n + 1, spots: spots.length };
  return spots;
}
