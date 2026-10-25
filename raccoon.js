// The Raccoon Mobile: a scrappy trash-panda rover. Stock buggy body in a grey/black ringed livery plus 9 rounded
// accents (mask, eye-shine headlights, ears, ringed tail antenna, trash-can bumper) on shared geometries.
// No imports: THREE is handed in by scihooks.js, so node can load RACCOON_SPEC in unit tests.
export const RACCOON_ID = 'raccoon_mobile';
export const RACCOON_PRICE = 900;
// quick-turning, decent off-road, not the fastest thing on the beltway (buggy: vmax 22, turn 1.75)
export const RACCOON_SPEC = {
  name: 'Raccoon Mobile', icon: '🦝', price: RACCOON_PRICE, vmax: 21, boost: 33, acc: 13.5, bacc: 19, turn: 2.2,
  wy: 0.48, wr: 0.48, r: 2.1, airTurn: 1.3, offroad: 0.9,
  blurb: 'Scrappy, quick on its feet, smells faintly of bins. Turns on a dime, climbs junk piles, steals your heart.',
  dealer: { venue: 'depot', world: 'Mars', colony: 'Ares Junction' }
};
export const RACCOON_SHOP = {
  id: RACCOON_ID, name: '🦝 Raccoon Mobile', kind: 'upgrade', venue: 'depot', price: RACCOON_PRICE,
  desc: 'Your own trash-panda rover. Quick turning, good off-road. Parked out front; the keys are yours (no heat for driving it).'
};

let K = null; // shared materials/geometries, made once
function kit(THREE) {
  if (K) return K;
  const std = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o }); m.userData.shared = true; return m; };
  const stripes = (bands, w, h, horiz) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    for (let i = 0; i < bands.length; i++) { x.fillStyle = bands[i]; if (horiz) x.fillRect(0, i * h / bands.length, w, h / bands.length + 1); else x.fillRect(i * w / bands.length, 0, w / bands.length + 1, h); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  // livery: grey with two black rings around the body; tail: 6 alternating rings
  const liv = stripes(['#8d9098', '#8d9098', '#17171a', '#8d9098', '#8d9098', '#17171a', '#8d9098', '#8d9098'], 64, 8, false);
  const tail = stripes(['#1a1a1c', '#9a9ca2', '#1a1a1c', '#9a9ca2', '#1a1a1c', '#9a9ca2', '#1a1a1c', '#9a9ca2'], 4, 64, true);
  const cone = new THREE.ConeGeometry(1, 1, 10); cone.userData.shared = true;
  K = {
    livery: std(0xffffff, { map: liv, metalness: 0.3 }), mask: std(0x111114, { roughness: 0.35 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffd890 }), fur: std(0x6e7078, { roughness: 0.95 }),
    tail: std(0xffffff, { map: tail, roughness: 0.9 }), tip: std(0x18181a, { roughness: 1 }),
    can: std(0xa8adb3, { metalness: 0.85, roughness: 0.35 }), cone
  };
  K.eye.userData.shared = true;
  return K;
}

// registerVehicle builder: ({R, mesh, build, sec}) -> {group, body, wheels, seat, paint}
export function raccoonBuilder(THREE) {
  return ({ R, mesh, build, sec }) => {
    const v = build('buggy', sec), k = kit(THREE), b = v.body, PI = Math.PI;
    const add = (g, m, ...a) => { const o = mesh(g, m, ...a); b.add(o); return o; };
    if (!sec) b.traverse(o => { if (o.isMesh && o.material === R.paints.buggy) o.material = k.livery; });
    add(R.sph, k.mask, 0, 1.12, -1.05, 0.86, 0.15, 0.55);                       // the bandit mask across the hood
    for (const s of [-1, 1]) {
      add(R.sph, k.eye, s * 0.5, 1.0, -1.5, 0.15, 0.12, 0.08);                // eye-shine headlights
      const ear = add(k.cone, k.fur, s * 0.62, 2.5, -0.15, 0.2, 0.36, 0.14); ear.rotation.z = -s * 0.25;
    }
    const tl = add(R.cyl, k.tail, 0.62, 2.05, 1.5, 0.13, 1.7, 0.13); tl.rotation.x = 0.35; // ringed tail antenna
    add(R.sph, k.tip, 0.62, 2.88, 1.8, 0.2, 0.24, 0.2);                         // fluffy tip
    const can = add(R.cyl, k.can, 0, 0.72, -1.95, 0.42, 1.7, 0.42); can.rotation.z = PI / 2; // trash-can bumper
    const lid = add(R.ring, k.can, 0.86, 0.72, -1.95, 0.45, 0.45, 0.45); lid.rotation.y = PI / 2;
    return v;
  };
}
