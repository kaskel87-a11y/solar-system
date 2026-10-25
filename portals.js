// Portal + dimension visuals. THREE is passed in (no imports) so this stays a leaf module.
// The portal is magenta/amber with a dark centre: deliberately nothing like any other show's portal.
let GEO = null;
export function geos(THREE) {
  if (GEO) return GEO;
  GEO = {
    box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 12, 9), cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 12), torus: new THREE.TorusGeometry(1, 0.08, 8, 32), coin: new THREE.CylinderGeometry(1, 1, 0.18, 16),
    dodeca: new THREE.DodecahedronGeometry(1, 0), disc: new THREE.CircleGeometry(1, 32)
  };
  for (const k in GEO) GEO[k].userData.shared = true;
  return GEO;
}
// per-room helper kit handed to dimension build(api, K)
export function roomKit(THREE, api) {
  const geo = geos(THREE), glows = new Map();
  const glow = c => { if (!glows.has(c)) { const m = new THREE.MeshBasicMaterial({ color: c }); api.disposables.push(m); glows.set(c, m); } return glows.get(c); };
  const std = (c, o) => api.mat(c, o);
  // list rows: [x, y, z, sx, sy, sz, rotY, colour] -> one InstancedMesh draw call
  const inst = (g, m, list) => {
    const im = new THREE.InstancedMesh(g, m, list.length), o = new THREE.Object3D(), c = new THREE.Color();
    list.forEach((r, i) => { o.position.set(r[0], r[1], r[2]); o.scale.set(r[3], r[4], r[5]); o.rotation.set(0, 0, 0); if (r[6] === Math.PI) o.rotation.x = Math.PI; else o.rotation.y = r[6] || 0; o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.setHex(r[7] ?? 0xffffff)); });
    api.g.add(im); return im;
  };
  return { THREE, geo, glow, std, inst };
}
// swirling disc texture: dark violet centre, magenta spiral arms, amber rim
function swirlTex(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, '#0a0410'); g.addColorStop(0.55, '#3a0a3a'); g.addColorStop(0.85, '#ff2fa8'); g.addColorStop(1, '#ffa020');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,160,32,0.7)'; x.lineWidth = 3;
  for (let a = 0; a < 3; a++) { x.beginPath(); for (let t = 0; t < 1; t += 0.02) { const r = 8 + t * 54, th = a * 2.09 + t * 5; x.lineTo(64 + Math.cos(th) * r, 64 + Math.sin(th) * r); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// outdoor portal: ring + swirl disc (both faces) + soft glow. 3 draws.
export function buildPortal(THREE) {
  const G = geos(THREE), g = new THREE.Group();
  const ring = new THREE.Mesh(G.torus, new THREE.MeshBasicMaterial({ color: 0xff2fa8 })); ring.scale.set(1.6, 2.1, 2);
  const disc = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ map: swirlTex(THREE), side: THREE.DoubleSide, transparent: true, opacity: 0.95 })); disc.scale.set(1.55, 2.05, 1);
  const halo = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); halo.scale.set(2.4, 2.9, 1); halo.position.z = -0.05;
  g.add(halo, disc, ring); g.position.y = 2.2; g.userData.sciPortal = true;
  const root = new THREE.Group(); root.add(g);
  root.userData.spin = t => { disc.rotation.z = -t * 1.6; const s = 1 + Math.sin(t * 3) * 0.04; g.scale.set(s, s, 1); halo.material.opacity = 0.14 + Math.sin(t * 5) * 0.05; };
  return root;
}
// the way home inside a dimension: a glowing ring around the door you came in by
export function homeRing(THREE, api) {
  const G = geos(THREE), r = new THREE.Mesh(G.torus, new THREE.MeshBasicMaterial({ color: 0xff2fa8 })); api.disposables.push(r.material);
  r.scale.set(1.3, 1.7, 1); r.position.set(0, 1.4, api.d / 2 - 0.05); api.g.add(r);
  api.sign('⟲ HOME (MARS)', 0xffa020, 0, 3.4, api.d / 2 - 0.08, Math.PI, 2.8);
  return r;
}
