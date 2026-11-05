// Red Tape Flats street life: blood on the ground (Snuffles). Two InstancedMeshes (spatter, pools), capped ring buffers,
// per-instance fade through one extra instanced attribute (aFade) patched into a standard material. Dark, matte-edged,
// realistic colour (no cartoon red). Splats fade out over ~60 s; pools spread for a few seconds after a death.
const LIFE = 60, HOLD = 18; // fully visible for HOLD s, then fades to 0 at LIFE s

function splatTex(THREE, pool) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  let s = pool ? 91 : 17; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const blob = (cx, cy, r, a) => { const g = x.createRadialGradient(cx, cy, r * 0.1, cx, cy, r); g.addColorStop(0, `rgba(58,4,4,${a})`); g.addColorStop(0.7, `rgba(72,6,6,${a * 0.92})`); g.addColorStop(1, 'rgba(40,2,2,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  if (pool) { for (let i = 0; i < 9; i++) blob(64 + (rnd() - 0.5) * 34, 64 + (rnd() - 0.5) * 30, 22 + rnd() * 22, 0.95); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(20,0,0,0.35)'; x.fillRect(0, 0, 128, 128); }
  else { blob(64, 64, 20, 0.95); for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, d = 12 + rnd() * 46, r = 1 + rnd() * (d < 30 ? 6 : 3); blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0.9); }
    for (let i = 0; i < 6; i++) { const a = rnd() * 6.283; x.strokeStyle = 'rgba(60,4,4,0.8)'; x.lineWidth = 1 + rnd() * 2; x.beginPath(); x.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14); x.lineTo(64 + Math.cos(a) * (30 + rnd() * 26), 64 + Math.sin(a) * (30 + rnd() * 26)); x.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function createBlood(K) {
  const { THREE } = K; let root = null, sets = [], dbg = { added: 0 };
  function mk(pool, cap) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); geo.setAttribute('aFade', fade);
    const mat = new THREE.MeshStandardMaterial({ map: splatTex(THREE, pool), transparent: true, depthWrite: false, roughness: pool ? 0.25 : 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    mat.onBeforeCompile = sh => {
      sh.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
      sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <alphatest_fragment>', 'diffuseColor.a *= vFade;\n#include <alphatest_fragment>');
    };
    mat.customProgramCacheKey = () => 'streetBlood';
    const im = new THREE.InstancedMesh(geo, mat, cap); im.frustumCulled = false; im.renderOrder = 3; im.name = pool ? 'streetBloodPools' : 'streetBloodSplats';
    const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < cap; i++) im.setMatrixAt(i, zero);
    root.add(im); return { im, fade, cap, next: 0, items: new Array(cap).fill(null), pool };
  }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function place(S, i, it, grow) { const k = it.grow ? Math.min(1, 0.25 + grow * 0.75) : 1; Q.setFromAxisAngle(UP, it.rot); V.set(it.x, it.y, it.z); SC.set(it.s * k, 1, it.s * k * it.sq); M4.compose(V, Q, SC); S.im.setMatrixAt(i, M4); }
  function add(x, z, size = 0.7, pool = false) {
    if (!root) return -1; const S = sets[pool ? 1 : 0]; const i = S.next; S.next = (S.next + 1) % S.cap;
    const it = { x, z, y: K.hgt(x, z) + 0.035 + (i % 7) * 0.002, s: size, rot: Math.random() * 6.283, sq: 0.7 + Math.random() * 0.5, t: 0, grow: pool };
    S.items[i] = it; place(S, i, it, 0); S.fade.array[i] = 1; S.fade.needsUpdate = true; S.im.instanceMatrix.needsUpdate = true; dbg.added++; return i;
  }
  return {
    build(g) { root = g; sets = [mk(false, K.PHONE ? 18 : 40), mk(true, K.PHONE ? 8 : 16)]; },
    dispose() { root = null; sets = []; },
    tick(dt) {
      for (const S of sets) { let m = false, f = false;
        for (let i = 0; i < S.cap; i++) { const it = S.items[i]; if (!it) continue; it.t += dt;
          if (it.grow && it.t < 5) { place(S, i, it, it.t / 5); m = true; }
          const a = it.t < HOLD ? 1 : Math.max(0, 1 - (it.t - HOLD) / (LIFE - HOLD)); if (S.fade.array[i] !== a) { S.fade.array[i] = a; f = true; }
          if (it.t >= LIFE) { S.items[i] = null; S.im.setMatrixAt(i, ZERO); m = true; } }
        if (m) S.im.instanceMatrix.needsUpdate = true; if (f) S.fade.needsUpdate = true; }
    },
    acts: () => [],
    splat: (x, z, s) => add(x, z, s ?? 0.5 + Math.random() * 0.5, false),
    pool: (x, z, s) => add(x, z, s ?? 1.1 + Math.random() * 0.6, true),
    age(sec) { for (const S of sets) for (const it of S.items) if (it) it.t += sec; }, // tests: fast-forward the fade
    list: () => sets.flatMap(S => S.items.map((it, i) => it && { pool: S.pool, i, t: +it.t.toFixed(1), a: +S.fade.array[i].toFixed(2) }).filter(Boolean)),
    debug: () => ({ ...dbg, live: sets.reduce((n, S) => n + S.items.filter(Boolean).length, 0), caps: sets.map(S => S.cap) })
  };
}
