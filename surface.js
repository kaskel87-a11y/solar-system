// Surface exploration: streaming procedural terrain + first-person walking.
import * as THREE from 'three';

// ---------- Seeded 2D simplex noise ----------
function makeNoise(seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (x, y) {
    const s2 = (x + y) * F2, i = Math.floor(x + s2), j = Math.floor(y + s2);
    const t = (i + j) * G2, x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = grad[perm[ii + perm[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
    return 70 * n; // ~[-1,1]
  };
}
function hash2(x, y, seed) { let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- Body configs ----------
const C = c => new THREE.Color(c);
const BODIES = {
  Moon: {
    g: 0.165, seed: 11, amp: 5, freq: 1 / 140, ridged: 0, craters: { cell: 34, p: 0.75, rmin: 3, rmax: 16 },
    low: C(0x5f5f60), high: C(0xb4b4b0), slope: C(0x4a4a4a), crater: C(0x707070), rock: C(0x8d8d8a), rocksPerChunk: 22,
    sky: 'space', fog: { type: 'linear', color: 0x000000, near: 70, far: 150 }, sunSize: 26, sunElev: 0.45, light: 2.6, ambient: 0.45, hemi: [0x8a90a8, 0x3a3a3a],
    earthInSky: true,
    poi: { kind: 'lander', name: 'Apollo Lunar Module', fact: 'The Apollo landers\u2019 descent stages are still on the Moon: six of them, from 1969 to 1972. Astronauts used them as launch pads to fly home.' },
    flagFact: 'Apollo astronauts planted six US flags on the Moon. Decades of harsh sunlight have probably bleached them white.',
    facts: ['A meteorite! The Moon has no air to burn up space rocks, so even tiny ones hit the ground at full speed.', 'Moon dust (regolith) is sharp like broken glass, because no wind or water has ever smoothed it.', 'Footprints here can last millions of years, since there is no wind to blow them away.', 'A day on the Moon lasts about 29.5 Earth days, so the Sun hangs in this black sky for two weeks at a time.']
  },
  Mercury: {
    g: 0.38, seed: 23, amp: 7, freq: 1 / 160, ridged: 0.3, craters: { cell: 40, p: 0.7, rmin: 4, rmax: 20 },
    low: C(0x4f4842), high: C(0x9a9088), slope: C(0x3d3833), crater: C(0x5e5650), rock: C(0x6d655f), rocksPerChunk: 20,
    sky: 'space', fog: { type: 'linear', color: 0x000000, near: 70, far: 150 }, sunSize: 70, sunElev: 0.5, light: 3.4, ambient: 0.4, hemi: [0x907860, 0x3a3028],
    poi: { kind: 'probe', name: 'MESSENGER probe', fact: 'NASA\u2019s MESSENGER orbited Mercury from 2011 to 2015, then was crashed into the surface on purpose when it ran out of fuel.' },
    flagFact: 'No one has ever landed on Mercury. Your flag would be the first!',
    facts: ['From Mercury the Sun looks about 3 times bigger than it does from Earth.', 'Days here reach 430 \u00b0C, and nights fall to \u2212180 \u00b0C.', 'Despite the heat, there is water ice hiding in permanently shadowed craters at Mercury\u2019s poles.', 'Mercury is shrinking as its iron core cools, which wrinkles the surface into long cliffs.']
  },
  Venus: {
    g: 0.90, seed: 37, amp: 6, freq: 1 / 120, ridged: 0.6, craters: null,
    low: C(0x5a3a1c), high: C(0x9c6a35), slope: C(0x4a2e18), crater: C(0x5a3a1c), rock: C(0x6b4524), rocksPerChunk: 26,
    sky: 'gradient', top: 0x8a4a14, horizon: 0xd88a3a, fog: { type: 'exp2', color: 0xc47d36, density: 0.028 }, sunSize: 0, sunElev: 0.6, light: 1.1, ambient: 0.7, hemi: [0xe0a060, 0x402010], lightColor: 0xffb070,
    poi: { kind: 'venera', name: 'Venera 13 lander', fact: 'The Soviet Venera 13 lander survived 127 minutes on Venus in 1982 and sent back the first color photos of its surface.' },
    flagFact: 'At 465 \u00b0C and 90 times Earth\u2019s air pressure, a flag here would char in minutes.',
    facts: ['The air here is so thick it is like being 900 m under the ocean on Earth.', 'Venus spins backwards, so the Sun would rise in the west, if you could see it through the clouds.', 'The clouds above are made of sulfuric acid.', 'A day on Venus (243 Earth days) is longer than its year (225 days).']
  },
  Earth: {
    g: 1.0, seed: 51, amp: 9, freq: 1 / 110, ridged: 0.2, craters: null, water: -1.5, padH: 2.5,
    low: C(0x3f7a2f), high: C(0x6e9c42), slope: C(0x6b6358), crater: C(0x3f7a2f), rock: C(0x7a7470), sand: C(0xcdb983), snow: C(0xf2f4f8), rocksPerChunk: 6, trees: 22,
    sky: 'gradient', top: 0x2f6fcf, horizon: 0xc4dff5, fog: { type: 'linear', color: 0xc4dff5, near: 50, far: 150 }, sunSize: 26, sunElev: 0.75, light: 2.6, ambient: 0.5, hemi: [0x9fc8ff, 0x3a5a2a],
    poi: { kind: 'sign', name: 'Welcome home', fact: 'Earth is the only place we know of with liquid water on the surface, breathable air, and life.' },
    flagFact: 'Home sweet home. Earth is the densest planet in the solar system.',
    facts: ['About 71% of Earth\u2019s surface is covered in water.', 'Trees like these produce much of the oxygen you are breathing right now.', 'Earth\u2019s spin is slowing: a day was only about 22 hours long 600 million years ago.', 'Earth\u2019s magnetic field shields life from the solar wind, and it makes the auroras.']
  },
  Mars: {
    g: 0.38, seed: 67, amp: 8, freq: 1 / 150, ridged: 0.4, craters: { cell: 60, p: 0.35, rmin: 5, rmax: 18 },
    low: C(0x8a3c1c), high: C(0xc0703c), slope: C(0x6b2e16), crater: C(0x7a3418), rock: C(0x5a2a18), rocksPerChunk: 40,
    sky: 'gradient', top: 0xb07a4a, horizon: 0xe2b483, fog: { type: 'linear', color: 0xd9a676, near: 45, far: 140 }, sunSize: 16, sunElev: 0.5, light: 2.2, ambient: 0.55, hemi: [0xe0b080, 0x502818], lightColor: 0xfff0dd,
    poi: { kind: 'rover', name: 'Perseverance rover', fact: 'NASA\u2019s Perseverance has explored Jezero Crater since 2021, drilling rock samples that may one day be flown back to Earth.' },
    flagFact: 'No human has stood on Mars yet. You would be the first!',
    facts: ['Mars looks red because its dust is full of iron oxide: rust.', 'Olympus Mons on Mars is about 22 km tall, nearly three times the height of Everest.', 'Sunsets on Mars are blue, the opposite of Earth\u2019s.', 'Dust storms on Mars can grow to cover the whole planet for weeks.']
  }
};
export const LANDABLE = Object.keys(BODIES);

export function createSurface({ renderer, textures, isMobile }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 700);
  camera.rotation.order = 'YXZ';

  const CHUNK = 48, SEG = isMobile ? 20 : 24, RADIUS = isMobile ? 2 : 3;
  const EYE = 1.7;
  let cfg = null, name = null, noise = null, noise2 = null;
  const chunks = new Map();
  const poiObjects = [];
  let state = null;

  // Shared resources
  const grain = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = 200 + Math.random() * 55; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const rockGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.75 + Math.random() * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6); trunkGeo.translate(0, 1.2, 0);
  const leafGeo = new THREE.ConeGeometry(1.6, 4.2, 7); leafGeo.translate(0, 4.2, 0);
  const meteorGeo = new THREE.DodecahedronGeometry(0.8, 0);
  let terrainMat, rockMat, trunkMat, leafMat, meteorMat;

  // ---------- Height ----------
  function baseHeight(x, z) {
    const f = cfg.freq;
    let h = 0, a = 1, fr = 1, norm = 0;
    for (let o = 0; o < 5; o++) {
      let n = noise(x * f * fr, z * f * fr);
      if (cfg.ridged && o < 2) n = THREE.MathUtils.lerp(n, 1 - 2 * Math.abs(n), cfg.ridged);
      h += n * a; norm += a; a *= 0.5; fr *= 2.03;
    }
    h = (h / norm) * cfg.amp * 2;
    h += noise2(x / 600, z / 600) * cfg.amp * 1.5; // broad hills
    if (cfg.craters) h += craterH(x, z, cfg.craters);
    return h;
  }
  function craterH(x, z, cr) {
    const cx = Math.floor(x / cr.cell), cz = Math.floor(z / cr.cell); let h = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const gx = cx + i, gz = cz + j;
      if (hash2(gx, gz, cfg.seed) > cr.p) continue;
      const px = (gx + hash2(gx, gz, cfg.seed + 1)) * cr.cell, pz = (gz + hash2(gx, gz, cfg.seed + 2)) * cr.cell;
      const R = cr.rmin + Math.pow(hash2(gx, gz, cfg.seed + 3), 2) * (cr.rmax - cr.rmin);
      const d = Math.hypot(x - px, z - pz) / R;
      if (d > 2) continue;
      const rim = 0.12 * R;
      h += d < 1 ? rim + (d * d - 1) * 0.38 * R : rim * Math.exp(-Math.pow((d - 1) / 0.3, 2));
    }
    return h;
  }
  function height(x, z) {
    const r = Math.hypot(x, z);
    const s = smooth(12, 45, r);
    const pad = cfg.padH ?? 0;
    const b = baseHeight(x, z);
    return THREE.MathUtils.lerp(pad + b * 0.15, b, s);
  }

  // ---------- Chunks ----------
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler(), tmpC = new THREE.Color();
  function buildChunk(ix, iz) {
    const N = SEG + 1, step = CHUNK / SEG, ox = ix * CHUNK, oz = iz * CHUNK;
    const H = new Float32Array((N + 2) * (N + 2));
    for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) H[(j + 1) * (N + 2) + (i + 1)] = height(ox + i * step, oz + j * step);
    const hAt = (i, j) => H[(j + 1) * (N + 2) + (i + 1)];
    const pos = new Float32Array(N * N * 3), nor = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
    const nrm = new THREE.Vector3();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = ox + i * step, z = oz + j * step, h = hAt(i, j);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      nrm.set(hAt(i - 1, j) - hAt(i + 1, j), 2 * step, hAt(i, j - 1) - hAt(i, j + 1)).normalize();
      nor[k * 3] = nrm.x; nor[k * 3 + 1] = nrm.y; nor[k * 3 + 2] = nrm.z;
      uv[k * 2] = i / SEG; uv[k * 2 + 1] = j / SEG;
      // color
      const n = noise(x / 9, z / 9) * 0.5 + noise(x / 31, z / 31) * 0.5;
      const t = THREE.MathUtils.clamp(0.5 + h / (cfg.amp * 3.2) + n * 0.25, 0, 1);
      tmpC.copy(cfg.low).lerp(cfg.high, t);
      if (cfg.water !== undefined) {
        if (h < cfg.water + 0.7) tmpC.copy(cfg.sand);
        else if (h > cfg.amp * 2.1) tmpC.copy(cfg.snow);
      }
      const steep = smooth(0.92, 0.75, nrm.y);
      tmpC.lerp(cfg.slope, steep * 0.85);
      col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
    }
    const idx = [];
    for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) { const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, terrainMat));

    // Rocks (instanced, shared geometry)
    const nR = cfg.rocksPerChunk;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, nR);
    let placed = 0;
    for (let r = 0; r < nR; r++) {
      const hx = hash2(ix * 131 + r, iz * 71 - r, cfg.seed + 5), hz = hash2(ix * 17 - r, iz * 191 + r, cfg.seed + 6), hs = hash2(ix + r * 7, iz - r * 3, cfg.seed + 7);
      const x = ox + hx * CHUNK, z = oz + hz * CHUNK; const y = height(x, z);
      if (cfg.water !== undefined && y < cfg.water + 0.3) continue;
      if (Math.hypot(x, z) < 14) continue;
      const sc = 0.2 + Math.pow(hs, 3) * (name === 'Mars' ? 2.2 : 1.8);
      tmpS.set(sc * (0.8 + hx * 0.6), sc * (0.6 + hz * 0.6), sc * (0.8 + hs * 0.5));
      tmpE.set(hx * 3, hz * 6.28, hs * 2); tmpQ.setFromEuler(tmpE); tmpP.set(x, y + sc * 0.2, z);
      rocks.setMatrixAt(placed, tmpM.compose(tmpP, tmpQ, tmpS));
      rocks.setColorAt(placed, tmpC.copy(cfg.rock).multiplyScalar(0.75 + hs * 0.5));
      placed++;
    }
    rocks.count = placed; rocks.instanceMatrix.needsUpdate = true; if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.computeBoundingSphere();
    group.add(rocks);

    // Trees (Earth)
    if (cfg.trees) {
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, cfg.trees), leaves = new THREE.InstancedMesh(leafGeo, leafMat, cfg.trees);
      let tp = 0;
      for (let r = 0; r < cfg.trees; r++) {
        const hx = hash2(ix * 37 + r, iz * 53 + r * 3, 99), hz = hash2(ix * 61 - r, iz * 29 + r, 98), hs = hash2(ix + r, iz + r * 5, 97);
        const x = ox + hx * CHUNK, z = oz + hz * CHUNK, y = height(x, z);
        if (y < cfg.water + 1.2 || y > cfg.amp * 1.9 || Math.hypot(x, z) < 16) continue;
        if (noise(x / 70, z / 70) < -0.15) continue; // clearings
        const sc = 0.8 + hs * 0.9;
        tmpQ.setFromEuler(tmpE.set(0, hs * 6.28, 0)); tmpS.set(sc, sc, sc); tmpP.set(x, y - 0.1, z);
        tmpM.compose(tmpP, tmpQ, tmpS); trunks.setMatrixAt(tp, tmpM); leaves.setMatrixAt(tp, tmpM);
        leaves.setColorAt(tp, tmpC.setHSL(0.27 + hs * 0.06, 0.45, 0.22 + hx * 0.1));
        tp++;
      }
      trunks.count = leaves.count = tp; trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      trunks.computeBoundingSphere(); leaves.computeBoundingSphere();
      group.add(trunks, leaves);
    }

    // Occasional meteorite / curiosity to find
    const chunkPois = [];
    if (hash2(ix, iz, cfg.seed + 9) < 0.18 && Math.hypot(ix, iz) > 0) {
      const x = ox + (0.25 + hash2(ix, iz, 3) * 0.5) * CHUNK, z = oz + (0.25 + hash2(ix, iz, 4) * 0.5) * CHUNK, y = height(x, z);
      if (!(cfg.water !== undefined && y < cfg.water + 0.5)) {
        const m = new THREE.Mesh(meteorGeo, meteorMat); m.position.set(x, y + 0.4, z); m.rotation.set(1, 2, 3);
        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshBasicMaterial({ color: 0x7fd4ff }));
        beacon.position.y = 1.6; m.add(beacon);
        const fi = Math.floor(hash2(ix, iz, 5) * cfg.facts.length);
        m.userData = { poi: true, name: 'Curious rock', fact: cfg.facts[fi], beacon };
        group.add(m); poiObjects.push(m); chunkPois.push(m);
      }
    }
    scene.add(group);
    return { group, pois: chunkPois, geo };
  }
  function disposeChunk(c) {
    scene.remove(c.group);
    c.geo.dispose();
    c.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    c.pois.forEach(p => { const i = poiObjects.indexOf(p); if (i >= 0) poiObjects.splice(i, 1); p.userData.beacon?.geometry.dispose(); p.userData.beacon?.material.dispose(); });
  }
  function updateChunks(px, pz, force) {
    const cx = Math.floor(px / CHUNK), cz = Math.floor(pz / CHUNK);
    const want = new Set();
    for (let j = -RADIUS; j <= RADIUS; j++) for (let i = -RADIUS; i <= RADIUS; i++) want.add(`${cx + i},${cz + j}`);
    for (const [k, c] of chunks) if (!want.has(k)) { disposeChunk(c); chunks.delete(k); }
    // build nearest missing first; limit per frame to avoid hitches
    const missing = [...want].filter(k => !chunks.has(k)).map(k => k.split(',').map(Number))
      .sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
    let budget = force ? Infinity : 1;
    for (const [i, j] of missing) { if (budget-- <= 0) break; chunks.set(`${i},${j}`, buildChunk(i, j)); }
  }

  // ---------- Sky ----------
  let skyGroup = null, waterMesh = null, sunDir = new THREE.Vector3();
  function makeGlow(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, inner); r.addColorStop(0.18, inner); r.addColorStop(0.32, outer); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function buildSky() {
    skyGroup = new THREE.Group(); scene.add(skyGroup);
    sunDir.set(0.6, cfg.sunElev, -0.8).normalize();
    if (cfg.sky === 'space') {
      scene.background = new THREE.Color(0x000000);
      const n = isMobile ? 1500 : 3000, p = new Float32Array(n * 3), v = new THREE.Vector3();
      for (let i = 0; i < n; i++) { v.randomDirection(); if (v.y < -0.1) v.y = -v.y; v.multiplyScalar(500); p.set([v.x, v.y, v.z], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      skyGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false })));
    } else {
      const geo = new THREE.SphereGeometry(550, 32, 16);
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(cfg.top) }, horizon: { value: new THREE.Color(cfg.horizon) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float t = pow(clamp(vP.y,0.0,1.0),0.55); gl_FragColor = vec4(mix(horizon, top, t), 1.0);\n#include <colorspace_fragment>\n}'
      });
      skyGroup.add(new THREE.Mesh(geo, mat));
      scene.background = new THREE.Color(cfg.horizon);
    }
    if (cfg.sunSize) {
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow('rgba(255,255,245,1)', 'rgba(255,200,120,0.35)'), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
      sun.position.copy(sunDir).multiplyScalar(480); sun.scale.setScalar(cfg.sunSize * 2.4); skyGroup.add(sun);
    }
    if (cfg.earthInSky) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 32), new THREE.MeshStandardMaterial({ map: textures.earth, fog: false, roughness: 1 }));
      e.position.set(-200, 170, -380); e.userData.spin = true; skyGroup.add(e);
    }
    const f = cfg.fog;
    scene.fog = f.type === 'exp2' ? new THREE.FogExp2(f.color, f.density) : new THREE.Fog(f.color, f.near, Math.min(f.far, (RADIUS + 0.5) * CHUNK));
    const dl = new THREE.DirectionalLight(cfg.lightColor ?? 0xffffff, cfg.light); dl.position.copy(sunDir).multiplyScalar(100); scene.add(dl); scene.add(dl.target);
    scene.add(new THREE.HemisphereLight(cfg.hemi[0], cfg.hemi[1], cfg.ambient * 2));
    if (cfg.water !== undefined) {
      waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK * (RADIUS * 2 + 2), CHUNK * (RADIUS * 2 + 2)), new THREE.MeshStandardMaterial({ color: 0x2a6aa8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }));
      waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.y = cfg.water; scene.add(waterMesh);
    }
  }

  // ---------- Points of interest near the landing site ----------
  // no env map on the surface, so keep metalness low or metals render black
  const metal = (c, m = 0.5, r = 0.5) => new THREE.MeshStandardMaterial({ color: c, metalness: Math.min(m, 0.25), roughness: Math.max(r, 0.45) });
  function place(obj, x, z, info, yOff = 0) {
    obj.position.set(x, height(x, z) + yOff, z); obj.userData = { poi: true, ...info }; scene.add(obj); poiObjects.push(obj); return obj;
  }
  function buildRocket() {
    const g = new THREE.Group(), body = metal(0xdddddd, 0.6, 0.3), acc = metal(0xff3333, 0.4, 0.4);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 4.2, 16), body); b.position.y = 2.1 + 1.2; g.add(b);
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.8, 16), acc); n.position.y = 5.1 + 1.2; g.add(n);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const f = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 1.3), acc); f.position.set(Math.cos(a) * 0.95, 0.9 + 0.3, Math.sin(a) * 0.95); f.rotation.y = -a; g.add(f); }
    g.scale.setScalar(1.6); return g;
  }
  function buildFlag() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), metal(0xcccccc, 0.8, 0.3)); pole.position.y = 1.5; g.add(pole);
    const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d');
    for (let i = 0; i < 7; i++) { x.fillStyle = i % 2 ? '#fff' : '#c8102e'; x.fillRect(0, i * 64 / 7, 96, 64 / 7 + 1); }
    x.fillStyle = '#0a3161'; x.fillRect(0, 0, 40, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.position.set(0.77, 2.45, 0); g.add(cloth);
    return g;
  }
  function buildLander() {
    const g = new THREE.Group(), gold = metal(0xd4a23a, 0.85, 0.35), grey = metal(0xb8b8b8, 0.4, 0.6), dark = metal(0x333333, 0.3, 0.7);
    const desc = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1.6, 8), gold); desc.position.y = 1.8; g.add(desc);
    const asc = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.2), grey); asc.position.y = 3.5; g.add(asc);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.1), dark); win.position.set(0, 3.7, 1.12); g.add(win);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), grey); leg.position.set(Math.cos(a) * 2.4, 1, Math.sin(a) * 2.4); leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(leg); const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.1, 10), grey); pad.position.set(Math.cos(a) * 2.9, 0.05, Math.sin(a) * 2.9); g.add(pad); }
    return g;
  }
  function buildRover() {
    const g = new THREE.Group(), white = metal(0xe8e8e8, 0.3, 0.6), dark = metal(0x2a2a2a, 0.2, 0.8), gold = metal(0xc89a40, 0.8, 0.4);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 3), white); body.position.y = 1.2; g.add(body);
    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8), dark); rtg.rotation.x = 1.1; rtg.position.set(0, 1.5, -1.7); g.add(rtg);
    for (let s = -1; s <= 1; s += 2) for (let k = -1; k <= 1; k++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12), dark); w.rotation.z = Math.PI / 2; w.position.set(s * 1.2, 0.4, k * 1.15); g.add(w); }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), white); mast.position.set(0.6, 2.3, 1.2); g.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.3), white); head.position.set(0.6, 3.2, 1.25); g.add(head);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), gold); eye.position.set(0.6, 3.2, 1.42); g.add(eye);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.4), white); arm.position.set(-0.6, 1.1, 2.1); g.add(arm);
    return g;
  }
  function buildVenera() {
    const g = new THREE.Group(), m = metal(0x9a9a9a, 0.7, 0.4), d = metal(0x555555, 0.5, 0.6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.25, 8, 20), d); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.4, 12), m); body.position.y = 1.0; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), m); top.position.y = 2.1; g.add(top);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 16), d); disc.position.y = 2.9; g.add(disc);
    return g;
  }
  function buildProbe() {
    const g = new THREE.Group(), gold = metal(0xc8a050, 0.8, 0.4), panel = metal(0x1a2a5a, 0.6, 0.3);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.2), gold); b.position.y = 0.5; b.rotation.set(0.3, 0.4, 0.2); g.add(b);
    const p = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1), panel); p.position.set(1.8, 0.3, 0.2); p.rotation.z = -0.25; g.add(p);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, 1.1), metal(0xdddddd, 0.5, 0.5)); dish.position.set(-0.6, 1.2, 0); dish.rotation.z = 0.9; g.add(dish);
    return g;
  }
  function buildSign() {
    const g = new THREE.Group(), wood = metal(0x7a5230, 0, 0.9);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), wood); post.position.y = 1.1; g.add(post);
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = '#a7743f'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#2b1a0c'; x.font = 'bold 40px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('WELCOME HOME', 128, 62);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 0.08), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: t }), new THREE.MeshStandardMaterial({ map: t })]);
    board.position.y = 1.9; g.add(board); return g;
  }
  const builders = { lander: buildLander, rover: buildRover, venera: buildVenera, probe: buildProbe, sign: buildSign };

  // ---------- Player ----------
  const player = { x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: -0.05, grounded: false, walked: 0, bob: 0 };

  function enter(bodyName) {
    cfg = BODIES[bodyName]; name = bodyName;
    noise = makeNoise(cfg.seed); noise2 = makeNoise(cfg.seed * 7 + 3);
    terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 0.95, metalness: 0 });
    rockMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1 });
    leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    meteorMat = new THREE.MeshStandardMaterial({ color: 0x2b2522, metalness: 0.7, roughness: 0.4, flatShading: true, emissive: 0x112233 });
    buildSky();
    // landing site
    place(buildRocket(), 11, -6, { name: 'Your rocket', fact: 'Your ride home. Tap Take off (or press T) to return to orbit.' });
    const flag = place(buildFlag(), -5, -9, { name: 'Flag', fact: cfg.flagFact }); flag.rotation.y = 0.4;
    const special = place(builders[cfg.poi.kind](), 4, -24, { name: cfg.poi.name, fact: cfg.poi.fact }); special.rotation.y = -0.6;
    player.x = 0; player.z = 4; player.yaw = 0; player.pitch = -0.08; player.vy = 0; player.walked = 0;
    player.y = height(0, 4) + EYE;
    updateChunks(player.x, player.z, true);
    state = { intro: 1.8, outro: 0 };
    apply();
  }
  function exit() {
    for (const c of chunks.values()) disposeChunk(c);
    chunks.clear();
    scene.traverse(o => { if (o.isMesh || o.isPoints || o.isSprite) { if (o.geometry && ![rockGeo, trunkGeo, leafGeo, meteorGeo].includes(o.geometry)) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map && m.map !== grain && m.map !== textures.earth) m.map.dispose(); m.dispose(); }); } });
    [terrainMat, rockMat, trunkMat, leafMat, meteorMat].forEach(m => m?.dispose());
    scene.clear(); poiObjects.length = 0; waterMesh = null; skyGroup = null; scene.fog = null;
    cfg = null; state = null;
  }

  function look(dx, dy, k) {
    player.yaw -= dx * k; player.pitch -= dy * k;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  function update(dt, input) {
    if (!cfg) return;
    const g = cfg.g * 9.81;
    if (state.intro > 0) state.intro = Math.max(0, state.intro - dt);
    let mvx = 0, mvz = 0;
    if (state.intro <= 0 && state.outro <= 0) {
      const k = input.keys;
      mvz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - input.joy.y;
      mvx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + input.joy.x;
    }
    const len = Math.hypot(mvx, mvz);
    if (len > 1) { mvx /= len; mvz /= len; }
    const running = input.run;
    // low gravity: slower, bouncier walk
    const speed = (running ? 9 : 4.2) * (cfg.g < 0.3 ? 0.8 : 1);
    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const dx = (fwd.x * mvz + right.x * mvx) * speed * dt, dz = (fwd.z * mvz + right.z * mvx) * speed * dt;
    if (dx || dz) {
      let nx = player.x + dx, nz = player.z + dz;
      const gh = height(nx, nz);
      if (cfg.water !== undefined && gh < cfg.water - 0.4) { nx = player.x; nz = player.z; } // shoreline
      else player.walked += Math.hypot(dx, dz);
      player.x = nx; player.z = nz;
    }
    const ground = height(player.x, player.z) + EYE;
    if (state.outro > 0) {
      state.outro -= dt; player.vy += 25 * dt; player.y += player.vy * dt;
    } else {
      if (player.grounded && input.jump) { player.vy = 4.2; player.grounded = false; }
      player.vy -= g * dt; player.y += player.vy * dt;
      if (player.y <= ground) { player.y = ground; player.vy = 0; player.grounded = true; }
      else if (player.grounded && player.y - ground < 0.35 && player.vy <= 0) { player.y = ground; } // stick to slopes
      else player.grounded = false;
    }
    if (player.grounded && len > 0.05) player.bob += dt * (running ? 13 : 8) * (cfg.g < 0.3 ? 0.6 : 1); else player.bob *= 0.9;
    apply();
    updateChunks(player.x, player.z, false);
    if (skyGroup) { skyGroup.position.copy(camera.position); skyGroup.children.forEach(c => { if (c.userData.spin) c.rotation.y += dt * 0.05; }); }
    if (waterMesh) { waterMesh.position.x = Math.round(player.x / 8) * 8; waterMesh.position.z = Math.round(player.z / 8) * 8; }
    poiObjects.forEach(p => { if (p.userData.beacon) { p.userData.beacon.rotation.y += dt * 2; p.userData.beacon.position.y = 1.6 + Math.sin(performance.now() / 400) * 0.15; } });
  }
  function apply() {
    const introY = state && state.intro > 0 ? Math.pow(state.intro / 1.8, 2) * 40 : 0;
    camera.position.set(player.x, player.y + introY + (player.grounded ? Math.sin(player.bob) * 0.06 : 0), player.z);
    camera.rotation.set(player.pitch - (state && state.intro > 0 ? state.intro * 0.35 : 0), player.yaw, 0);
  }

  const ray = new THREE.Raycaster(); ray.far = 70;
  function tap(nx, ny) {
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const hits = ray.intersectObjects(poiObjects, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.poi) o = o.parent; if (o) return { name: o.userData.name, fact: o.userData.fact }; }
    return null;
  }
  function nearestPoi() {
    let best = null, bd = 1e9;
    for (const p of poiObjects) { const d = Math.hypot(p.position.x - player.x, p.position.z - player.z); if (d < bd && d > 4) { bd = d; best = p; } }
    if (!best || bd > 200) return null;
    const ang = Math.atan2(-(best.position.x - player.x), -(best.position.z - player.z)) - player.yaw;
    const a = Math.atan2(Math.sin(ang), Math.cos(ang));
    const dir = Math.abs(a) < 0.4 ? 'ahead' : Math.abs(a) > 2.5 ? 'behind' : a > 0 ? 'to your left' : 'to your right';
    return { name: best.userData.name, dist: Math.round(bd), dir };
  }
  function resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function takeOff() { if (state) { state.outro = 1.0; player.vy = 2; } }

  return {
    scene, camera, enter, exit, update, look, tap, resize, takeOff, nearestPoi,
    get info() { return cfg ? { name, g: cfg.g, walked: player.walked, x: player.x, z: player.z, y: player.y, grounded: player.grounded, chunks: chunks.size, intro: state.intro } : null; }
  };
}
