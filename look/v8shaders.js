// v8 realistic look: shader patches (onBeforeCompile) + the grade pass + the procedural sky env scene.
// Every patch is reversible (unpatch) so the ☰ Graphics "Classic" choice puts the v7 materials back exactly.
import * as THREE from 'three';

const NOISE = `
float v8h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float v8n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(v8h(i), v8h(i+vec3(1,0,0)), f.x), mix(v8h(i+vec3(0,1,0)), v8h(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(v8h(i+vec3(0,0,1)), v8h(i+vec3(1,0,1)), f.x), mix(v8h(i+vec3(0,1,1)), v8h(i+vec3(1,1,1)), f.x), f.y), f.z); }
float v8lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;
const VERT_DECL = 'varying vec3 vV8P; varying vec3 vV8N;';
const VERT_BODY = `
{ vec4 v8p = vec4(transformed, 1.0); vec3 v8n = objectNormal;
  #ifdef USE_INSTANCING
    v8p = instanceMatrix * v8p; v8n = mat3(instanceMatrix) * v8n;
  #endif
  vV8P = (modelMatrix * v8p).xyz; vV8N = normalize(mat3(modelMatrix) * v8n); }`;

function keep(mat) {
  if (!mat.userData.__v8orig) mat.userData.__v8orig = { obc: mat.onBeforeCompile, key: mat.customProgramCacheKey, hadOwnObc: Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile'), hadOwnKey: Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') };
  return mat.userData.__v8orig;
}
export function unpatch(mat) {
  const o = mat?.userData?.__v8orig; if (!o) return false;
  if (o.hadOwnObc) mat.onBeforeCompile = o.obc; else delete mat.onBeforeCompile;
  if (o.hadOwnKey) mat.customProgramCacheKey = o.key; else delete mat.customProgramCacheKey;
  delete mat.userData.__v8orig; delete mat.userData.__v8; mat.needsUpdate = true; return true;
}
const isPatched = (mat, key) => mat.userData.__v8?.key === key;

// ---------- terrain: world-space PBR detail over the game's vertex-colour palette ----------
// regolith on the flats, rock on steep ground (triplanar on high/ultra), two-scale anti-tiling, macro breakup.
// The game's per-planet colours stay (vertex colours); the scans add luminance detail, normals, roughness and AO.
export function patchTerrain(mat, T, tier) {
  const key = `terrain|d${tier.detail}|t${tier.triplanar ? 1 : 0}`; if (isPatched(mat, key)) return mat; if (mat.userData.__v8) unpatch(mat);
  const o = keep(mat);
  const U = { tRegD: { value: T.mars_regolith.diff }, tRegN: { value: T.mars_regolith.nor }, tRegA: { value: T.mars_regolith.arm },
    tRockD: { value: T.mars_rock.diff }, tRockN: { value: T.mars_rock.nor }, tRockA: { value: T.mars_rock.arm },
    uRegAvg: { value: T.mars_regolith.avg }, uRockAvg: { value: T.mars_rock.avg }, uDetail: { value: 1 } };
  mat.userData.__v8 = { key, U, kind: 'terrain' };
  mat.onBeforeCompile = (sh, r) => {
    o.obc?.call(mat, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_DECL).replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${VERT_DECL}
#define V8_DETAIL ${tier.detail}
#define V8_TRI ${tier.triplanar ? 1 : 0}
uniform sampler2D tRegD, tRegN, tRegA, tRockD, tRockN, tRockA; uniform vec3 uRegAvg, uRockAvg; uniform float uDetail;
${NOISE}
vec3 v8unpack(vec4 t){ return t.xyz * 2.0 - 1.0; }`)
      .replace('#include <map_fragment>', `
float v8cd = length(vV8P - cameraPosition), v8far = smoothstep(14.0, 80.0, v8cd);
vec3 v8N = normalize(vV8N);
float v8mac = v8n3(vV8P * 0.035) * 0.65 + v8n3(vV8P * 0.13) * 0.35;
vec2 v8uv = vV8P.xz / 3.2;
vec4 v8rD = texture2D(tRegD, v8uv), v8rA = texture2D(tRegA, v8uv); vec3 v8rN = v8unpack(texture2D(tRegN, v8uv));
#if V8_DETAIL > 1
  vec2 v8uv2 = vV8P.xz / 13.7 + 0.37; float v8k2 = 0.25 + v8far * 0.55;
  v8rD = mix(v8rD, texture2D(tRegD, v8uv2), v8k2); v8rA = mix(v8rA, texture2D(tRegA, v8uv2), v8k2);
#endif
float v8wR = clamp(smoothstep(0.93, 0.72, v8N.y) + (v8mac - 0.62) * 0.9, 0.0, 1.0);
vec4 v8kD, v8kA; vec3 v8kNw;
#if V8_TRI == 1
  vec3 v8bw = pow(abs(v8N), vec3(4.0)); v8bw /= (v8bw.x + v8bw.y + v8bw.z);
  vec2 v8ux = vV8P.zy / 5.0, v8uy = vV8P.xz / 5.0, v8uz = vV8P.xy / 5.0;
  v8kD = texture2D(tRockD, v8ux) * v8bw.x + texture2D(tRockD, v8uy) * v8bw.y + texture2D(tRockD, v8uz) * v8bw.z;
  v8kA = texture2D(tRockA, v8ux) * v8bw.x + texture2D(tRockA, v8uy) * v8bw.y + texture2D(tRockA, v8uz) * v8bw.z;
  vec3 v8tx = v8unpack(texture2D(tRockN, v8ux)), v8ty = v8unpack(texture2D(tRockN, v8uy)), v8tz = v8unpack(texture2D(tRockN, v8uz));
  v8kNw = normalize(v8N + vec3(0.0, v8tx.y, v8tx.x) * sign(v8N.x) * v8bw.x + vec3(v8ty.x, 0.0, -v8ty.y) * v8bw.y + vec3(v8tz.x, v8tz.y, 0.0) * sign(v8N.z) * v8bw.z);
#else
  vec2 v8uk = vV8P.xz / 5.0; v8kD = texture2D(tRockD, v8uk); v8kA = texture2D(tRockA, v8uk);
  vec3 v8tk = v8unpack(texture2D(tRockN, v8uk)); v8kNw = normalize(v8N + vec3(v8tk.x, 0.0, -v8tk.y));
#endif
vec3 v8reg = mix(vec3(v8lum(v8rD.rgb) / max(1e-3, v8lum(uRegAvg))), v8rD.rgb / max(uRegAvg, vec3(1e-3)), 0.3);
vec3 v8rock = mix(vec3(v8lum(v8kD.rgb) / max(1e-3, v8lum(uRockAvg))), v8kD.rgb / max(uRockAvg, vec3(1e-3)), 0.4) * 0.8;
vec3 v8k = mix(v8reg, v8rock, v8wR);
v8k = mix(v8k, vec3(1.0), v8far * 0.45) * mix(0.86, 1.12, v8mac);
vec4 v8A = mix(v8rA, v8kA, v8wR);
diffuseColor.rgb *= clamp(mix(vec3(1.0), v8k, uDetail), 0.25, 2.2) * mix(1.0, v8A.r, 0.55 * uDetail);
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, clamp(v8A.g * 1.05, 0.5, 1.0), uDetail);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ float v8nk = uDetail * (1.0 - v8far * 0.6);
  vec3 v8w = normalize(mix(normalize(v8N + vec3(v8rN.x, 0.0, -v8rN.y) * 1.0 * v8nk), mix(v8N, v8kNw, v8nk), v8wR));
  normal = normalize((viewMatrix * vec4(v8w, 0.0)).xyz); }`);
  };
  mat.customProgramCacheKey = () => (o.key ? o.key.call(mat) : '') + '|v8' + key;
  mat.needsUpdate = true; return mat;
}

// ---------- props + buildings: weathering (dust up, grime) and optional world-space PBR detail ----------
// opts: { dust: THREE.Color, amount, set: { diff, nor, arm, avg } | null, scale (m), tri }
export function patchSurface(mat, opts, tier) {
  const set = opts.set || null, tri = !!(set && tier.triplanar);
  const key = `surf|${set ? set.name : '-'}|t${tri ? 1 : 0}|w${opts.amount > 0 ? 1 : 0}`; if (isPatched(mat, key)) return mat; if (mat.userData.__v8) unpatch(mat);
  const o = keep(mat);
  const U = { uDust: { value: (opts.dust || new THREE.Color(0xa8583a)).clone() }, uDustAmt: { value: opts.amount ?? 0.5 }, uScale: { value: opts.scale || 2.5 },
    tSD: { value: set?.diff || null }, tSN: { value: set?.nor || null }, tSA: { value: set?.arm || null }, uSAvg: { value: set?.avg || new THREE.Vector3(0.5, 0.5, 0.5) }, uSK: { value: opts.detailK ?? 0.75 } };
  mat.userData.__v8 = { key, U, kind: 'surface' };
  mat.onBeforeCompile = (sh, r) => {
    o.obc?.call(mat, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_DECL).replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + VERT_BODY);
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>
${VERT_DECL}
#define V8_SET ${set ? 1 : 0}
#define V8_TRI ${tri ? 1 : 0}
uniform vec3 uDust; uniform float uDustAmt, uScale, uSK; uniform sampler2D tSD, tSN, tSA; uniform vec3 uSAvg;
${NOISE}`);
    f = f.replace('#include <color_fragment>', `#include <color_fragment>
vec3 v8N = normalize(vV8N); vec3 v8pert = vec3(0.0); vec4 v8A = vec4(1.0, 0.5, 0.0, 1.0);
#if V8_SET == 1
{ vec3 v8bw = abs(v8N); vec4 v8D;
  vec2 v8ux = vV8P.zy / uScale, v8uy = vV8P.xz / uScale, v8uz = vV8P.xy / uScale;
  #if V8_TRI == 1
    v8bw = pow(v8bw, vec3(4.0)); v8bw /= (v8bw.x + v8bw.y + v8bw.z);
    v8D = texture2D(tSD, v8ux) * v8bw.x + texture2D(tSD, v8uy) * v8bw.y + texture2D(tSD, v8uz) * v8bw.z;
    v8A = texture2D(tSA, v8ux) * v8bw.x + texture2D(tSA, v8uy) * v8bw.y + texture2D(tSA, v8uz) * v8bw.z;
    vec3 tx = texture2D(tSN, v8ux).xyz * 2.0 - 1.0, ty = texture2D(tSN, v8uy).xyz * 2.0 - 1.0, tz = texture2D(tSN, v8uz).xyz * 2.0 - 1.0;
    v8pert = vec3(0.0, tx.y, tx.x) * sign(v8N.x) * v8bw.x + vec3(ty.x, 0.0, ty.y) * v8bw.y + vec3(tz.x, tz.y, 0.0) * sign(v8N.z) * v8bw.z;
  #else
    vec2 v8u = v8bw.x >= max(v8bw.y, v8bw.z) ? v8ux : (v8bw.y >= v8bw.z ? v8uy : v8uz);
    v8D = texture2D(tSD, v8u); v8A = texture2D(tSA, v8u); vec3 t = texture2D(tSN, v8u).xyz * 2.0 - 1.0;
    v8pert = v8bw.x >= max(v8bw.y, v8bw.z) ? vec3(0.0, t.y, t.x) * sign(v8N.x) : (v8bw.y >= v8bw.z ? vec3(t.x, 0.0, t.y) : vec3(t.x, t.y, 0.0) * sign(v8N.z));
  #endif
  vec3 v8k = mix(vec3(v8lum(v8D.rgb) / max(1e-3, v8lum(uSAvg))), v8D.rgb / max(uSAvg, vec3(1e-3)), 0.25);
  diffuseColor.rgb *= clamp(mix(vec3(1.0), v8k, uSK), 0.3, 2.0) * mix(1.0, v8A.r, 0.6 * uSK); }
#endif
float v8wnz = v8n3(vV8P * 1.7) * 0.6 + v8n3(vV8P * 7.0) * 0.4;
float v8dust = smoothstep(0.25, 0.9, v8N.y) * smoothstep(0.35, 0.75, v8wnz + 0.15);
float v8wAmt = clamp(v8dust * uDustAmt + v8wnz * 0.12 * uDustAmt, 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, uDust * (0.75 + v8wnz * 0.4), v8wAmt);
diffuseColor.rgb *= mix(1.0, 0.84 + v8wnz * 0.24, uDustAmt);`);
    f = f.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
#if V8_SET == 1
  roughnessFactor = clamp(roughnessFactor * mix(1.0, 0.55 + v8A.g * 0.9, uSK), 0.04, 1.0);
#endif
roughnessFactor = mix(roughnessFactor, 0.95, v8wAmt);`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - v8wAmt * 0.8;');
    if (set) f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec3 v8v = normalize((viewMatrix * vec4(normalize(v8N + v8pert * 0.7 * uSK), 0.0)).xyz); normal = dot(normal, v8v) < 0.0 ? -v8v : v8v; }`);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => (o.key ? o.key.call(mat) : '') + '|v8' + key;
  mat.needsUpdate = true; return mat;
}

// ---------- grade (one shader, display space): contrast, lift/gain split tone, saturation, vignette, grain ----------
export const GradeShader = {
  name: 'V8GradeShader',
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.035 }, vignette: { value: 0.3 }, sat: { value: 1.1 }, contrast: { value: 1.08 },
    res: { value: new THREE.Vector2(1, 1) }, lift: { value: new THREE.Vector3(0.012, 0.016, 0.022) }, gain: { value: new THREE.Vector3(1.04, 1, 0.94) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, grain, vignette, sat, contrast; uniform vec2 res; uniform vec3 lift, gain; varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      col = (col - 0.5) * contrast + 0.5;
      col = col * gain + lift * (1.0 - col);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, sat);
      col *= 1.0 - vignette * smoothstep(0.08, 0.55, r2 * 1.6);
      float n = hash(vUv * res + fract(time) * 100.0) - 0.5; col += n * grain * (1.0 - l * 0.6);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

// ---------- env: a tiny sky-dome scene PMREM'd from the live sky colours, so IBL follows SSX.time and the storm ----------
export function makeEnvScene() {
  const U = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } };
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: U,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, horizon, ground, sunDir, sunCol; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, ground, pow(clamp(-h * 3.0, 0.0, 1.0), 0.5));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 600.0) * 40.0 + pow(s, 24.0) * 0.6 + pow(s, 4.0) * 0.12);
        gl_FragColor = vec4(c, 1.0); }` });
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), m));
  return { scene, U, dispose() { m.dispose(); scene.children[0].geometry.dispose(); } };
}
