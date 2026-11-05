// v8 vehicles: smoke + fire particles for damaged / burning vehicles. Two THREE.Points (2 draws total, any number of
// emitters), CPU-updated ring buffers, soft procedural sprites. Loaded lazily by look/vehicles.js (never on classic).
import * as THREE from 'three';

const VS = `attribute float aSize; attribute float aAlpha; attribute vec3 aCol; attribute float aSeed; uniform float uScale;
varying float vA; varying vec3 vC; varying float vS;
void main(){ vA = aAlpha; vC = aCol; vS = aSeed; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * uScale / max(0.5, -mv.z), 1.0, 256.0); }`;
const FS_SMOKE = `varying float vA; varying vec3 vC; varying float vS;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + vS * 17.0) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float n = n2(gl_PointCoord * 4.0 + vS * 9.0) * 0.6 + n2(gl_PointCoord * 9.0 - vS * 5.0) * 0.4;
  float a = (1.0 - smoothstep(0.35, 1.0, r + (n - 0.5) * 0.5)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * (0.8 + 0.4 * n), a); }`;
const FS_FIRE = `varying float vA; varying vec3 vC; varying float vS;
void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; p.y *= 0.8; float r = length(p); if (r > 1.0) discard; float a = pow(1.0 - r, 1.6) * vA; gl_FragColor = vec4(vC * a, 1.0); }`;

function system(N, fs, additive) {
  const g = new THREE.BufferGeometry();
  const A = { position: new Float32Array(N * 3), aSize: new Float32Array(N), aAlpha: new Float32Array(N), aCol: new Float32Array(N * 3), aSeed: new Float32Array(N) };
  for (let i = 0; i < N; i++) { A.aSeed[i] = Math.random(); A.position[i * 3 + 1] = -1e4; }
  g.setAttribute('position', new THREE.BufferAttribute(A.position, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSize', new THREE.BufferAttribute(A.aSize, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(A.aAlpha, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aCol', new THREE.BufferAttribute(A.aCol, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSeed', new THREE.BufferAttribute(A.aSeed, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const U = { uScale: { value: 400 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: fs, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.userData.ssxVeh = true; m.userData.weathered = true;
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 5; pts.userData.noV8 = true; pts.name = additive ? 'ssxVehFire' : 'ssxVehSmoke';
  const P = { pts, U, A, g, N, head: 0, live: 0, p: new Float32Array(N * 3), v: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), s0: new Float32Array(N), s1: new Float32Array(N), a0: new Float32Array(N), c: new Float32Array(N * 3) };
  return P;
}
export function createFX() {
  const smoke = system(240, FS_SMOKE, false), fire = system(160, FS_FIRE, true);
  const root = new THREE.Group(); root.name = 'ssxVehFX'; root.userData.noV8 = true; root.add(smoke.pts, fire.pts);
  const wind = new THREE.Vector3(0.6, 0, 0.25);
  function spawn(P, x, y, z, o) {
    const i = P.head; P.head = (P.head + 1) % P.N;
    P.p[i * 3] = x + (Math.random() - 0.5) * (o.spread || 0.4); P.p[i * 3 + 1] = y; P.p[i * 3 + 2] = z + (Math.random() - 0.5) * (o.spread || 0.4);
    P.v[i * 3] = (Math.random() - 0.5) * (o.jit || 0.5) + wind.x * (o.wind ?? 1); P.v[i * 3 + 1] = o.up * (0.7 + Math.random() * 0.6); P.v[i * 3 + 2] = (Math.random() - 0.5) * (o.jit || 0.5) + wind.z * (o.wind ?? 1);
    P.life[i] = 0; P.max[i] = o.life * (0.75 + Math.random() * 0.5); P.s0[i] = o.s0; P.s1[i] = o.s1; P.a0[i] = o.a;
    P.c[i * 3] = o.c[0]; P.c[i * 3 + 1] = o.c[1]; P.c[i * 3 + 2] = o.c[2];
  }
  const acc = new Map();
  // rate-based emission per emitter key: kind 'smoke' (k 0..1 = light grey .. black), 'fire', 'burst'
  function emit(key, kind, pos, k, dt) {
    if (kind === 'burst') { for (let i = 0; i < 46; i++) spawn(fire, pos.x, pos.y, pos.z, { up: 5, jit: 9, life: 0.7, s0: 1.8, s1: 3.2, a: 1, c: [1, 0.55, 0.18], spread: 1.2, wind: 0 }); for (let i = 0; i < 24; i++) spawn(smoke, pos.x, pos.y + 0.5, pos.z, { up: 3, jit: 5, life: 3.5, s0: 2, s1: 6, a: 0.75, c: [0.08, 0.075, 0.07], spread: 1.5 }); return; }
    const rate = kind === 'fire' ? 34 : 4 + k * 14; let a = (acc.get(key + kind) || 0) + rate * dt;
    while (a >= 1) { a -= 1;
      if (kind === 'fire') spawn(fire, pos.x, pos.y, pos.z, { up: 2.6, jit: 0.7, life: 0.75, s0: 1.2, s1: 0.4, a: 0.9, c: [1, 0.45 + Math.random() * 0.25, 0.12], spread: 1.1, wind: 0.4 });
      else { const g = 0.62 - k * 0.55; spawn(smoke, pos.x, pos.y, pos.z, { up: 1.4 + k, jit: 0.5, life: 3 + k * 2.5, s0: 0.5 + k * 0.6, s1: 2.4 + k * 3.2, a: 0.32 + k * 0.4, c: [g, g * 0.96, g * 0.92], spread: 0.35 }); }
    }
    acc.set(key + kind, a);
  }
  function step(P, dt, fireMode) {
    const A = P.A; let live = 0;
    for (let i = 0; i < P.N; i++) {
      if (P.life[i] >= P.max[i] || P.max[i] === 0) { if (A.aAlpha[i] !== 0) { A.aAlpha[i] = 0; A.position[i * 3 + 1] = -1e4; } continue; }
      live++; P.life[i] += dt; const t = Math.min(1, P.life[i] / P.max[i]);
      P.v[i * 3 + 1] += (fireMode ? 1.5 : 0.25) * dt; const drag = Math.exp(-(fireMode ? 1.2 : 0.6) * dt); P.v[i * 3] *= drag; P.v[i * 3 + 2] *= drag;
      P.p[i * 3] += P.v[i * 3] * dt; P.p[i * 3 + 1] += P.v[i * 3 + 1] * dt; P.p[i * 3 + 2] += P.v[i * 3 + 2] * dt;
      A.position[i * 3] = P.p[i * 3]; A.position[i * 3 + 1] = P.p[i * 3 + 1]; A.position[i * 3 + 2] = P.p[i * 3 + 2];
      A.aSize[i] = P.s0[i] + (P.s1[i] - P.s0[i]) * (fireMode ? t : Math.sqrt(t));
      A.aAlpha[i] = P.a0[i] * (fireMode ? (1 - t) : Math.min(1, t * 6) * (1 - t) * (1 - t));
      const f = fireMode ? 1 - t * 0.6 : 1; A.aCol[i * 3] = P.c[i * 3] * f; A.aCol[i * 3 + 1] = P.c[i * 3 + 1] * f * (fireMode ? 1 - t * 0.5 : 1); A.aCol[i * 3 + 2] = P.c[i * 3 + 2] * f;
    }
    P.live = live;
    for (const k of ['position', 'aSize', 'aAlpha', 'aCol']) P.g.attributes[k].needsUpdate = true;
  }
  return {
    root, emit,
    update(dt, cam, viewH) { const s = (viewH || 800) / (2 * Math.tan(THREE.MathUtils.degToRad((cam.fov || 60) / 2))); smoke.U.uScale.value = s; fire.U.uScale.value = s; step(smoke, dt, false); step(fire, dt, true); },
    live: () => smoke.live + fire.live,
    dispose() { root.parent?.remove(root); for (const P of [smoke, fire]) { P.g.dispose(); P.pts.material.dispose(); } }
  };
}
