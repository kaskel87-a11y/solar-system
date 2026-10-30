// v7.5.8 waypoint light beam: a tall blue column of light (~150 m) over the active waypoint (the ➤ bar / minimap ◆ target,
// SSX.hudx.objective(): quest step, running job such as Scrap Run, turf fight, race ring or a map waypoint) plus a pulsing
// blue ground ring and a small distance tag. Visible through dust storms and at night: additive, depthWrite off, fog off,
// drawn after the storm grit. Fades out within ~15 m of the target; follows the waypoint; hidden when there is none or off
// the surface. The yellow farm/base beacons (mars/farm.js) are untouched.
// Cheap on phones: one beam mesh + one ring (+ one sprite tag whose canvas redraws only when the shown distance changes),
// shared geometry/materials built once, no per-frame allocations (the target is re-read 4x a second).
// Wiring: one guarded dynamic import in index.html; runs from window.SSX_TICKS (surface.js). Debug: window.SSX.wpbeam.
import * as THREE from 'three';

const H = 150, R = 2.4, COL = new THREE.Color(0x3aa0ff), NEAR_IN = 5, NEAR_OUT = 15;
let G = null, beam = null, ring = null, tag = null, tagCtx = null, tagTex = null, tagTxt = '';
let tx = 0, tz = 0, has = false, label = '', kind = '', readT = 0, t = 0, dist = Infinity, fade = 0, warned = false, enabled = true;
// night needs nothing extra: additive blue on a dark scene is the brightest thing there, and fog is off

const BEAM_VS = `varying float vY; varying float vEdge;
void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vec3 n = normalize(normalMatrix * normal);
  vEdge = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
const BEAM_FS = `uniform vec3 uCol; uniform float uOp; uniform float uPulse; varying float vY; varying float vEdge;
void main(){ float core = pow(vEdge, 1.6);                         // soft edges: brightest through the middle of the column
  float grad = (1.0 - smoothstep(0.0, 1.0, vY)) * 0.85 + 0.15;    // strong at the ground, thinning toward the top
  grad *= smoothstep(0.0, 0.02, vY);                               // no hard seam at the foot
  float a = core * grad * uOp * (0.8 + 0.2 * uPulse);
  gl_FragColor = vec4(uCol * (1.0 + 0.6 * core) * a, a); }`;

function build() {
  G = new THREE.Group(); G.name = 'wp-beam';
  const bg = new THREE.CylinderGeometry(R, R, H, 20, 1, true); bg.translate(0, H / 2, 0);
  const bm = new THREE.ShaderMaterial({ uniforms: { uCol: { value: COL.clone() }, uOp: { value: 1 }, uPulse: { value: 0 } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  beam = new THREE.Mesh(bg, bm); beam.name = 'wp-beam-col'; beam.renderOrder = 60; beam.frustumCulled = false;
  const rg = new THREE.RingGeometry(2.3, 3.1, 48); rg.rotateX(-Math.PI / 2);
  const rm = new THREE.MeshBasicMaterial({ color: COL, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  ring = new THREE.Mesh(rg, rm); ring.name = 'wp-beam-ring'; ring.renderOrder = 61; ring.position.y = 0.12;
  const c = document.createElement('canvas'); c.width = 128; c.height = 48; tagCtx = c.getContext('2d');
  tagTex = new THREE.CanvasTexture(c); tagTex.minFilter = THREE.LinearFilter;
  tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthWrite: false, depthTest: false, fog: false, sizeAttenuation: false }));
  tag.name = 'wp-beam-tag'; tag.scale.set(0.085, 0.032, 1); tag.renderOrder = 62; tag.position.y = 9;
  G.add(beam, ring, tag); G.visible = false;
}
function drawTag(s) {
  if (s === tagTxt) return; tagTxt = s; const x = tagCtx; x.clearRect(0, 0, 128, 48);
  x.fillStyle = 'rgba(4,14,30,0.78)'; x.strokeStyle = 'rgba(90,180,255,0.95)'; x.lineWidth = 3;
  x.beginPath(); x.roundRect ? x.roundRect(3, 3, 122, 42, 14) : x.rect(3, 3, 122, 42); x.fill(); x.stroke();
  x.fillStyle = '#fff'; x.font = 'bold 26px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, 64, 25); tagTex.needsUpdate = true;
}
const fmt = d => (d >= 1000 ? (d / 1000).toFixed(d >= 10000 ? 0 : 1) + ' km' : (d >= 100 ? Math.round(d / 10) * 10 : Math.round(d)) + ' m');

function readTarget() {
  const A = window.__app, X = window.SSX?.hudx; let ob = null;
  try { ob = A?.state?.onSurface && X?.objective ? X.objective() : null; } catch (e) { ob = null; }
  if (ob && isFinite(ob.x) && isFinite(ob.z)) { has = true; tx = ob.x; tz = ob.z; label = ob.label || ''; kind = ob.kind || ''; } else has = false;
}
function tick(dt, tc) {
  if (!tc?.scene || !isFinite(dt)) return;
  if (!G) build();
  if (G.parent !== tc.scene) { tc.scene.add(G); readT = 0; }
  if ((readT -= dt) <= 0) { readT = 0.25; readTarget(); }
  const p = tc.player; if (!has || !p || !isFinite(p.x) || !enabled) { G.visible = false; return; }
  t += dt; let gy = 0; try { const h = tc.height?.(tx, tz); if (isFinite(h)) gy = h; } catch (e) { /* flat */ }
  G.position.set(tx, gy, tz); G.visible = true;
  dist = Math.hypot(tx - p.x, tz - p.z);
  fade = Math.min(1, Math.max(0, (dist - NEAR_IN) / (NEAR_OUT - NEAR_IN)));
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  let I = 0; try { I = window.SSX?.storm?.intensity?.() || 0; } catch (e) { /* no storm */ }
  const u = beam.material.uniforms; u.uPulse.value = pulse; u.uOp.value = fade * (1.1 + 0.9 * I); // a storm turns the scene red-bright: push the blue harder
  beam.visible = fade > 0.01;
  const w = Math.max(1, Math.min(6, dist / 80)); beam.scale.set(w, 1, w); // stays a few pixels wide from across the city
  const rs = 1 + 0.18 * pulse; ring.scale.set(rs, 1, rs); ring.material.opacity = 0.55 + 0.4 * (1 - pulse) + 0.3 * I;
  tag.visible = fade > 0.01; if (tag.visible) { drawTag(fmt(dist)); tag.position.y = 6 + Math.min(40, dist * 0.06); }
}

export const wpbeam = {
  state: () => ({ visible: !!G?.visible, beam: !!beam?.visible, inScene: !!G?.parent, x: G ? +G.position.x.toFixed(1) : null, z: G ? +G.position.z.toFixed(1) : null,
    y: G ? +G.position.y.toFixed(2) : null, dist: isFinite(dist) ? +dist.toFixed(1) : null, fade: +fade.toFixed(3), op: beam ? +beam.material.uniforms.uOp.value.toFixed(3) : 0,
    ring: ring ? +ring.material.opacity.toFixed(3) : 0, tag: tagTxt, tagOn: !!tag?.visible, label, kind, height: H,
    mat: beam ? { additive: beam.material.blending === THREE.AdditiveBlending, depthWrite: beam.material.depthWrite, fog: beam.material.fog } : null,
    meshes: G ? G.children.length : 0 }),
  object: () => G, setEnabled(on) { enabled = !!on; return enabled; }, get enabled() { return enabled; }
};
(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 250); return; } // window.SSX is (re)built by core: wait for it
  if (window.__wpbeamOn) return; window.__wpbeamOn = true; window.SSX.wpbeam = wpbeam; // re-attached each frame below: index.html may replace window.SSX after boot
  (window.SSX_TICKS ||= []).push((dt, tc) => { try { if (window.SSX && window.SSX.wpbeam !== wpbeam) window.SSX.wpbeam = wpbeam; tick(dt, tc); } catch (e) { if (!warned) { warned = true; console.warn('wpbeam', e); } } });
})();
