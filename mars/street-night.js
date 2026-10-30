// Red Tape Flats street life: night (Snuffles). When SSX.time.isNight() (or SSX.street.setNight(true)) says it is night and
// you are outdoors in the Flats, the existing sky, fog, sun and hemisphere light are eased toward a dirty sodium-lit
// night, and the district's street lamps get a glow sprite plus a pool of light on the ground. Nothing is replaced:
// base values are captured on the way in and restored exactly on the way out (and on unload). No real lights on phones
// (desktop gets two cheap point lights on the nearest lamps). Fully guarded: a missing sky or light is simply skipped.
import * as THREE from 'three';
const NIGHT = { top: new THREE.Color(0x05060a), horizon: new THREE.Color(0x1c120e), fog: new THREE.Color(0x140e0c) };
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,236,200,1)'); g.addColorStop(0.25, 'rgba(255,190,110,0.55)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function createNight(K) {
  let root = null, k = 0, base = null, scene = null, lamps = [], glowMat = null, poolMat = null, pls = [], dbg = { applied: 0, restored: 0 };
  const C = () => new THREE.Color();
  function find(sc) { // the existing sky shader mesh + the sun / hemisphere lights surface.js adds to the scene root
    let sky = null, dl = null, hemi = null;
    for (const o of sc.children) { if (o.isDirectionalLight && !dl) dl = o; else if (o.isHemisphereLight && !hemi) hemi = o; else if (o.isGroup && !sky) o.traverse(m => { if (!sky && m.isMesh && m.material?.uniforms?.top && m.material.uniforms.horizon) sky = m.material; }); }
    return { sky, dl, hemi };
  }
  function capture(sc) {
    const f = find(sc); base = { ...f, scene: sc, bg: sc.background?.isColor ? sc.background.clone() : null, fog: sc.fog?.color ? sc.fog.color.clone() : null,
      top: f.sky ? f.sky.uniforms.top.value.clone() : null, hor: f.sky ? f.sky.uniforms.horizon.value.clone() : null, dlI: f.dl?.intensity, hemiI: f.hemi?.intensity, dlC: f.dl?.color.clone(),
      last: null };
  }
  // if something else changed a value since we last wrote it (planet switch, another mod), treat that as the new base
  const changed = (cur, mine) => mine != null && (typeof cur === 'number' ? Math.abs(cur - mine) > 1e-4 : cur && !cur.equals(mine));
  function apply(kk) {
    const b = base; if (!b) return; const L = b.last; const tmp = C();
    if (b.bg && b.scene.background?.isColor) { if (L && changed(b.scene.background, L.bg)) b.bg.copy(b.scene.background); b.scene.background.copy(b.bg).lerp(NIGHT.horizon, kk * 0.9); }
    if (b.fog && b.scene.fog?.color) { if (L && changed(b.scene.fog.color, L.fog)) b.fog.copy(b.scene.fog.color); b.scene.fog.color.copy(b.fog).lerp(NIGHT.fog, kk * 0.9); }
    if (b.sky) { const u = b.sky.uniforms; if (L && changed(u.top.value, L.top)) b.top.copy(u.top.value); if (L && changed(u.horizon.value, L.hor)) b.hor.copy(u.horizon.value); u.top.value.copy(b.top).lerp(NIGHT.top, kk * 0.92); u.horizon.value.copy(b.hor).lerp(NIGHT.horizon, kk * 0.85); }
    if (b.dl) { if (L && changed(b.dl.intensity, L.dlI)) b.dlI = b.dl.intensity; b.dl.intensity = b.dlI * (1 - 0.72 * kk); tmp.set(0x8a9ab8); b.dl.color.copy(b.dlC).lerp(tmp, kk * 0.6); }
    if (b.hemi) { if (L && changed(b.hemi.intensity, L.hemiI)) b.hemiI = b.hemi.intensity; b.hemi.intensity = b.hemiI * (1 - 0.6 * kk); }
    b.last = { bg: b.scene.background?.isColor ? b.scene.background.clone() : null, fog: b.scene.fog?.color?.clone() || null, top: b.sky?.uniforms.top.value.clone(), hor: b.sky?.uniforms.horizon.value.clone(), dlI: b.dl?.intensity, hemiI: b.hemi?.intensity };
    dbg.applied++;
  }
  function restore() { if (!base) return; apply(0); if (base.dl) base.dl.color.copy(base.dlC); base = null; dbg.restored++; }
  function buildLamps(g) {
    const D = K.D; if (!D) return; const n = D.lamps || 10, lr = D.lampR || 52, y0 = K.hgt(D.x, D.z); glowMat = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffc888, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    poolMat = new THREE.MeshBasicMaterial({ map: glowMat.map, color: 0xffa860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    lamps = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = D.x + Math.cos(a) * lr, z = D.z + Math.sin(a) * lr;
      const s = new THREE.Sprite(glowMat); s.position.set(x, y0 + 5.1, z); s.scale.set(3.2, 3.2, 1); g.add(s);
      const p = new THREE.Mesh(K.geo().plane, poolMat); p.rotation.x = -Math.PI / 2; p.position.set(x, K.hgt(x, z) + 0.06, z); p.scale.set(9, 9, 1); g.add(p); lamps.push({ x, z, y: y0 + 5.1, s, p, ph: Math.random() * 6, bad: i % 4 === 1 }); }
    if (!K.PHONE) for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffb070, 0, 22, 1.8); l.visible = false; g.add(l); pls.push(l); }
  }
  return {
    build(g) { root = g; k = 0; buildLamps(g); },
    dispose() { restore(); glowMat?.map?.dispose(); glowMat?.dispose(); poolMat?.dispose(); glowMat = poolMat = null; lamps = []; pls = []; root = null; k = 0; },
    tick(dt, t, P) {
      const sc = P.ctx?.scene; if (!sc) return; const want = K.night() && !P.inside ? 1 : 0;
      if (want === k && (k === 0 ? !base : true) && k === 0) return; // idle by day: zero cost
      if (!base || base.scene !== sc) { if (base) restore(); capture(sc); }
      k += Math.sign(want - k) * Math.min(Math.abs(want - k), dt * 0.5); apply(k);
      if (glowMat) { glowMat.opacity = 0.95 * k; poolMat.opacity = 0.32 * k; for (const L of lamps) { const f = L.bad ? (Math.sin(t * 23 + L.ph) > 0.2 ? 1 : 0.25) : 1; L.s.scale.setScalar(3.2 * (0.9 + 0.1 * Math.sin(t * 3 + L.ph)) * f); } }
      if (pls.length) { const near = lamps.map(L => ({ L, d: Math.hypot(P.x - L.x, P.z - L.z) })).sort((a, b) => a.d - b.d); pls.forEach((l, i) => { const n = near[i]; l.visible = k > 0.05 && !!n && n.d < 60; if (n) l.position.set(n.L.x, n.L.y - 0.4, n.L.z); l.intensity = 18 * k; }); }
      if (k === 0 && want === 0) restore();
    },
    acts: () => [],
    get k() { return k; },
    debug: () => { const f = base || (K.player?.ctx?.scene ? find(K.player.ctx.scene) : {}); return { k: +k.toFixed(3), active: !!base, lamps: lamps.length, points: pls.length, dl: f.dl?.intensity ?? null, hemi: f.hemi?.intensity ?? null, bg: K.player?.ctx?.scene?.background?.getHexString?.() ?? null, ...dbg }; }
  };
}
