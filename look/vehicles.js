// v8 realistic vehicles (window.SSX.vehicles): procedural bevelled bodies with clearcoat paint, glass, chrome / rubber
// trim, treaded wheels, working lamps, Mars-dust grime + side decals, dents / smoke / burning wrecks. One hook, no core edits.
// Same pattern as look/models.js (#48): the new skin rides INSIDE the existing blocky vehicle group (body + the game's
// wheel pivots, so steering, suspension, spin, lean and hover all keep working), the blocky meshes stay hidden as the
// fallback and the far LOD, and classic never generates anything. No downloaded assets: geometry is lofted from the same
// side profiles the v7 builders use (rides.js SHAPES, models.js rover, world.js kinds) and cached per kind.
//   Which vehicles: every buildVehicle() kind (buggy, hauler, hover bike, shuttle skimmer, dealer rides, planet rides on
//   those bases, security / traffic / pursuit / race rivals) is tagged by wrapping world.VEHICLE_BUILDERS, plus your
//   six-wheel rover and the landed starship (PBR steel + nav lights). Race ghosts and the Raccoon Mobile stay blocky.
//   Cost: ~8 draws per car (paint, trim, glass, lamps, 4 wheels) + 1 beam at night; nearest N only (low 4 / med 8 /
//   high 14), blocky past 120 m, trim dropped past 45 m. Real lights only at night: a small SpotLight pool (low 1 / med 3
//   / high 5) given to your car then the nearest moving cars, plus one fire PointLight; everyone else gets an emissive
//   lens + additive cone + ground pool. Night = SSX.time.isNight() (#30) or SSX.look.nightness().
//   Damage: hard stops (crashes) dent panels (vertex dents + crumpled normals + scratches + bullet holes), heavy damage
//   smokes, wrecks (pursuit kills, junk) burn then smoulder. SSX.vehicles.damage / burn / repair drive it from code too.
// Override: ?vehicles=0|1 or localStorage 'ssx.vehicles' = 'off' | 'on'.
import * as THREE from 'three';
import { VEHICLE_BUILDERS, buildVehicle } from '../world.js';

const VERSION = 'v8-vehicles-1';
const qs = new URLSearchParams(location.search);
const LS = (() => { try { return localStorage.getItem('ssx.vehicles'); } catch { return null; } })();
const FORCE = qs.get('vehicles') === '0' || LS === 'off' ? 'off' : qs.get('vehicles') === '1' || LS === 'on' ? 'on' : null;
const CAPS = { low: 4, med: 8, high: 14, ultra: 18 }, LIGHTS = { low: 1, med: 3, high: 5, ultra: 6 };
const D_LOD1 = 45, D_FAR = 120, D_LIGHT = 70;
const S = { on: false, tier: 'classic', scene: null, ctx: null, gen: null, fx: null, loading: null, tracked: new Map(), mats: new Map(), geos: new Map(), lights: null, lightsIn: false,
  ship: null, t: 0, frame: 0, night: 0, isNight: false, warned: new Set(), stats: { attaches: 0, tagged: 0, impacts: 0, burns: 0, fails: 0, builds: 0 } };
const warnOnce = (k, e) => { if (S.warned.has(k)) return; S.warned.add(k); console.warn('v8 vehicles: ' + k, e); };

// ---------------------------------------------------------------- tagging (runs on every tier; only adds userData) ----------------------------------------------------------------
const BUILTIN = ['buggy', 'hauler', 'hoverbike', 'shuttle'];
function collect(v) { // blocky meshes to hide; the security light bar, garage body kits and underglow stay
  const ud = v.group.userData, keep = new Set(ud.bar || []), list = [];
  for (const k of [ud.deco?.kit, ud.deco?.glow]) k?.traverse?.(o => keep.add(o));
  const walk = (o) => { if (keep.has(o) || o.name === 'ssxVehAttach' || o.name === 'ssxVehSkin' || (o !== v.group && o.userData?.ssxVeh)) return; // attach groups and nested vehicles (dealer skins) stay
    if (o.isMesh) list.push(o); for (const c of o.children) walk(c); };
  walk(v.group); return list; }
function tagV(v, kind, sec) {
  if (!v || !v.group) return v;
  try { const ud = v.group.userData, prev = ud.ssxVeh, orig = prev?.orig || collect(v);
    ud.ssxVeh = { kind, base: prev ? (prev.base || prev.kind) : kind, sec: !!sec, body: v.body || v.group, wheels: v.wheels || [], paint: v.paint, orig, paintMeshes: prev?.paintMeshes || orig.filter(o => o.material === v.paint) };
    S.stats.tagged++; } catch (e) { warnOnce('tag', e); }
  return v;
}
function wrapBuilders() {
  for (const k of BUILTIN) if (!VEHICLE_BUILDERS[k]) {
    const w = (a) => { delete VEHICLE_BUILDERS[k]; try { return tagV(buildVehicle(k, a?.sec), k, a?.sec); } finally { VEHICLE_BUILDERS[k] = w; } };
    w.__ssxV = true; VEHICLE_BUILDERS[k] = w;
  }
  for (const k of Object.keys(VEHICLE_BUILDERS)) { const f = VEHICLE_BUILDERS[k]; if (typeof f !== 'function' || f.__ssxV) continue; const w = (a) => tagV(f(a), k, a?.sec); w.__ssxV = true; w.__orig = f; VEHICLE_BUILDERS[k] = w; }
}
try { wrapBuilders(); } catch (e) { warnOnce('wrap', e); }

// ---------------------------------------------------------------- fitting: blocky vehicle -> archetype params ----------------------------------------------------------------
const RIDE_EXTRA = { dust_runner: { rack: true, handles: null }, red_comet: { decal: 1 }, olympus_gt: { decal: 1, chromeBelt: true }, ares_brute: { bullbar: true, bumpChrome: true }, phobos_phantom: { pads: [[-0.85, -1.7], [0.85, -1.7], [-0.85, 1.6], [0.85, 1.6]], sill: 0.4 } };
const PROFILES = {
  rover: { arch: 'car', W: 2.6, rover: true, hull: [[-3.1, 0.95], [-3.2, 1.55], [-2.3, 1.8], [0.95, 1.82], [1.15, 2.32], [3.0, 1.96], [3.05, 0.95]], cab: [[-2.3, 1.8], [-0.6, 2.75], [0.95, 2.38], [1.05, 1.82]], rc: 0.2, tumble: 0.9 },
  hauler: { arch: 'car', W: 2.55, bumpChrome: true, ore: [-0.35, 2.8], hull: [[-2.55, 0.72], [-2.62, 1.55], [-2.45, 1.68], [-0.72, 1.7], [-0.6, 1.95], [3.0, 1.95], [3.06, 0.72]], cab: [[-2.45, 1.66], [-2.3, 2.38], [-0.85, 2.4], [-0.75, 1.68]], rc: 0.14, tumble: 0.94, plan: 0.1 },
  buggy: { arch: 'buggy', W: 1.75 }, hoverbike: { arch: 'bike' }, shuttle: { arch: 'skimmer' }
};
function wheelInfo(tag, body) {
  const out = [];
  for (const w of tag.wheels) {
    const m = w.spin?.children?.find(o => o.isMesh); if (!m) continue;
    m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox;
    const r = (bb.max.y - bb.min.y) / 2 * Math.abs(m.scale.y), wd = (bb.max.x - bb.min.x) * Math.abs(m.scale.x);
    out.push({ w, x: w.pivot.position.x, z: w.pivot.position.z, y: w.pivot.position.y - (body.position?.y || 0), r, wd });
  }
  return out;
}
function fit(tag, g) {
  const base = tag.base, ride = g.userData.ride?.shape, W = wheelInfo(tag, tag.body);
  let P;
  if (ride) P = { arch: 'car', W: ride.w, hull: ride.hull, cab: ride.cab, spoiler: !!ride.spoiler, bed: !!ride.bed, rc: 0.16, tumble: 0.9, ...(RIDE_EXTRA[base] || {}) };
  else if (PROFILES[base]) P = { ...PROFILES[base] };
  else return null;
  P.wheels = W.map(w => ({ x: w.x, z: w.z, y: w.y, r: w.r }));
  if (P.cab) { const [b0, , , b1] = P.cab; P.seams = [b0[0] + 0.08, b0[0] + (b1[0] - b0[0]) * 0.58]; P.belt = b0[1]; }
  return { P, W, key: base + '|' + W.map(w => w.r.toFixed(2) + w.z.toFixed(1)).join(',') };
}
function kit(fitd) {
  let k = S.geos.get(fitd.key); if (k) return k;
  const G = S.gen, r = G.ARCH[fitd.P.arch](fitd.P), o = r.out, F = r.meta.frame;
  const yt = Math.max(...F.yt);
  k = { paint: G.merge(o.paint, false), trim: o.trim.length ? G.merge(o.trim, true) : null, glass: o.glass.length ? G.merge(o.glass, false) : null, lamps: o.lamps.length ? G.merge(o.lamps, true) : null,
    beam: G.beamGeo(r.meta.head, 0), meta: r.meta, frame: { zN: F.zN, zT: F.zT, yb: F.yb, yt, seams: fitd.P.seams, belt: fitd.P.belt ?? yt }, decal: fitd.P.decal || 0 };
  S.geos.set(fitd.key, k); S.stats.builds++; return k;
}

// ---------------------------------------------------------------- materials (cached per look) ----------------------------------------------------------------
const phys = () => S.tier !== 'low';
function srcPaint(e) { const pm = e.tag.paintMeshes[0]; return pm ? pm.material : e.tag.paint; }
function paintMat(e) {
  const src = srcPaint(e), k = e.kit, col = src?.color ? src.color.getHex() : 0x8a8f96;
  const matte = (src?.roughness ?? 0.5) > 0.8, metal = (src?.metalness ?? 0) > 0.8 ? 0.85 : 0.08 + (src?.metalness ?? 0) * 0.2, rough = matte ? 0.75 : Math.min(src?.roughness ?? 0.4, 0.42) * (metal > 0.9 ? 0.4 : 1);
  const dent = e.burn !== 0 ? 1 : e.dmg >= 0.7 ? 1 : e.dmg >= 0.45 ? 0.66 : e.dmg >= 0.2 ? 0.33 : 0, dirt = Math.round(e.dirt * 3) / 3, burn = e.burn > 0 ? 2 : e.burn < 0 ? 1 : 0;
  const decal = e.tag.sec ? 2 : k.decal && (e.seed * 7 % 1) > 0.4 ? 1 : 0;
  const key = [col, metal.toFixed(2), rough.toFixed(2), matte, dirt, dent, burn, decal, k.frame.zN.toFixed(2), k.frame.zT.toFixed(2), k.frame.yb.toFixed(2), k.frame.yt.toFixed(2), (k.frame.seams || []).join('/'), phys()].join('|');
  let m = S.mats.get(key);
  if (!m) { m = S.gen.paintMaterial({ color: col, metal, rough, dirt, dent, burn: burn ? 1 : 0, seed: (e.seed * 97) % 13, frame: k.frame, decal, decalColor: e.tag.sec ? 0x1f4fd8 : 0xf4f1ea, clear: matte ? 0 : 1 }, phys()); m.userData.burning = burn === 2; S.mats.set(key, m); }
  return m;
}
// garage rim colour (rides.js decorate recolours the blocky hub material): tint our wheel the same way
function rimOf(e) { const h = e.g.userData.hubM || e.tag.wheels[0]?.spin?.children?.[1]?.material; return h?.color ? h.color.getHex() : -1; }
function wheelMat(e) {
  const burnt = e.burn !== 0, rim = burnt ? -1 : rimOf(e), key = burnt ? 'wheelB' : rim < 0 || rim === STOCK_RIM ? 'wheel' : 'wheel' + rim;
  return shared(key, () => { const m = S.gen.trimMaterial('wheel', burnt); if (key.length > 5) { m.color.setHex(rim).lerp(new THREE.Color(1, 1, 1), 0.25); } return m; });
}
const STOCK_RIM = 0x8c9097, HIDE_MASK = 1 << 30;
function shared(name, f) { let m = S.mats.get(name); if (!m) { m = f(); S.mats.set(name, m); } return m; }

// ---------------------------------------------------------------- attach / detach ----------------------------------------------------------------
function attach(e) {
  if (e.inst || e.failed) return;
  try {
    const fd = e.fit || (e.fit = fit(e.tag, e.g)); if (!fd) { e.failed = true; return; }
    const k = e.kit = kit(fd), G = S.gen, root = new THREE.Group(); root.name = 'ssxVehSkin'; root.userData.noV8 = true;
    const mk = (geo, mat, cast) => { if (!geo) return null; const m = new THREE.Mesh(geo, mat); m.castShadow = !!cast; m.receiveShadow = true; m.userData.noV8 = true; root.add(m); return m; };
    const burnt = e.burn !== 0;
    const inst = e.inst = { root, paint: mk(k.paint, paintMat(e), true), trim: mk(k.trim, shared(burnt ? 'trimB' : 'trim', () => G.trimMaterial('trim', burnt)), true),
      glass: mk(k.glass, shared('glass', () => G.glassMaterial())), lamps: mk(k.lamps, shared(burnt ? 'lampD' : 'lamp', () => G.lampMaterial(burnt))),
      beam: null, wheels: [], hidden: [] };
    if (inst.glass) inst.glass.renderOrder = 2;
    inst.beam = new THREE.Mesh(k.beam, shared('beam', () => G.beamMaterial())); inst.beam.visible = false; inst.beam.renderOrder = 4; inst.beam.userData.noV8 = true; inst.beam.frustumCulled = false; root.add(inst.beam);
    // the beam's pool sits on the ground under the nose: body-local y of the ground ~ 0 (pivots are at wheel radius)
    const wg = G.wheelGeo(), wm = wheelMat(e); inst.rim = rimOf(e);
    for (const w of e.fit.W) { const m = new THREE.Mesh(wg, wm); const s = w.x < 0 ? -1 : 1; m.scale.set(s * w.wd, w.r, w.r); m.castShadow = true; m.userData.noV8 = true; w.w.spin.add(m); inst.wheels.push(m); }
    // hide the blocky meshes from the camera (and shadows) with a spare layer instead of .visible, so the game,
    // dealership hideStock / decorate and game.js cosmetics keep full ownership of .visible and see the same values
    for (const o of e.tag.orig) { inst.hidden.push([o, o.layers.mask]); o.layers.mask = HIDE_MASK; }
    e.tag.body.add(root); e.matKey = inst.paint.material; S.stats.attaches++;
    inst.paint.name = 'ssxVehPaint'; applyBurnLook(e); emit('attach', e);
  } catch (err) { e.failed = true; S.stats.fails++; warnOnce('attach ' + e.tag.base, err); detach(e); emit('fallback', e); }
}
function detach(e) {
  const inst = e.inst; if (!inst) return; e.inst = null;
  inst.root.parent?.remove(inst.root); for (const m of inst.wheels) m.parent?.remove(m);
  for (const [o, m] of inst.hidden) if (o.layers.mask === HIDE_MASK) o.layers.mask = m;
  emit('detach', e);
}
function applyBurnLook(e) {
  const inst = e.inst; if (!inst) return; const burnt = e.burn !== 0, G = S.gen;
  inst.paint.material = paintMat(e);
  if (inst.trim) inst.trim.material = shared(burnt ? 'trimB' : 'trim', () => G.trimMaterial('trim', burnt));
  if (inst.lamps) inst.lamps.material = shared(burnt ? 'lampD' : 'lamp', () => G.lampMaterial(burnt));
  if (inst.glass) inst.glass.visible = !burnt;
  const wm = wheelMat(e); for (const m of inst.wheels) m.material = wm;
}

// ---------------------------------------------------------------- scan + damage ----------------------------------------------------------------
// a kind gets the realistic model only when it IS one of the modelled kinds: world.js builtins, the rover, and the dealer
// rides (rides.js SHAPES). Kinds built on top of a base (planet liveries, PR #53's raccoon_rover = buggy + junk panels,
// the Raccoon Mobile) keep their own mesh unless they opt in with SSX.vehicleLook.useBase(kind).
const SKIP = new Set(['raccoon_mobile', 'raccoon_rover']), USE_BASE = new Set();
function realistic(tag, g) {
  if (!tag || SKIP.has(tag.kind) || g?.userData?.rcn || g?.userData?.ssxVehSkip) return false;
  const modelled = !!PROFILES[tag.base] || !!g?.userData?.ride?.shape;
  return modelled && (tag.kind === tag.base || USE_BASE.has(tag.kind));
}
function track(g) {
  const tag = g.userData.ssxVeh; if (!tag || S.tracked.has(g)) return;
  if (g.userData.ride?.shape && tag.kind === tag.base) RIDE_KINDS.add(tag.kind);
  const o0 = tag.orig[0]?.material; if (o0 && o0.transparent && o0.opacity < 0.9 && tag.orig.every(o => o.material === o0)) return; // race ghost
  if (!realistic(tag, g)) return; // no model for this kind (raccoon rover, planet liveries, mods): the existing mesh stays
  const seed = Math.random();
  S.tracked.set(g, { g, tag, seed, dirt: tag.sec ? 0.2 + seed * 0.2 : 0.25 + seed * 0.6, dmg: 0, burn: 0, inst: null, kit: null, fit: null, failed: false, wp: new THREE.Vector3(), last: null, spd: 0, d: 1e9, player: false, wreckChk: 0, still: 0 });
}
// the stock rover steps aside when the dealership has put your bought ride's skin in its body (that skin gets its own
// realistic model by kind) or when game.js shows a cosmetic kit instead of the stock hull
function suppressed(e, ctx) {
  const g = e.g; if (g.userData.ssxVehSkip || SKIP.has(e.tag.kind)) return true;
  if (e.tag.paintMeshes[0] && !e.tag.paintMeshes[0].visible) return true; // someone else hid the stock body: their look wins
  const rv = ctx.rover?.group === g ? ctx.rover : null; if (!rv) return false;
  return !!rv.__dlr?.skin || !!(rv.kit && rv.kitG?.visible);
}
function scan(ctx) {
  const st = [[ctx.scene, 0]];
  while (st.length) { const [o, d] = st.pop(); for (const c of o.children) { if (c.userData?.ssxVeh) track(c); if (d < 5 && c.children.length && !c.isMesh) st.push([c, d + 1]); } }
  const rv = ctx.rover; if (rv?.group && !rv.group.userData.ssxVeh) {
    // the rover: hide only its stock parts (surface.js rover.stockParts), wheels and headlight pool, never the turret,
    // jets, game.js cosmetic kit (kitG) or the dealership's ride skin that also live on rover.body
    tagV({ group: rv.group, body: rv.body, wheels: rv.wheels, paint: rv.paint }, 'rover');
    const t = rv.group.userData.ssxVeh, orig = [];
    if (rv.stockParts?.length) { for (const p of rv.stockParts) p.traverse(o => { if (o.isMesh) orig.push(o); }); for (const w of rv.wheels || []) w.pivot.traverse(o => { if (o.isMesh) orig.push(o); }); for (const o of rv.group.children) if (o.isMesh) orig.push(o); t.orig = orig; t.paintMeshes = orig.filter(o => o.material === rv.paint); }
    track(rv.group); }
  for (const e of S.tracked.values()) {
    // wreck detection: every blocky mesh switched to one shared material (pursuit kills) -> burn; upside-down junk -> charred
    if (e.burn === 0) { const o = e.tag.orig, m0 = o[0]?.material; if (o.length > 3 && m0 && m0 !== e.tag.paint && o.every(x => x.material === m0)) startBurn(e, 16);
      const r = e.g.rotation; if (Math.abs(r.z) > 1.2 || Math.abs(r.x) > 1.2) { if ((e.still += 0.5) > 1.5 && e.spd < 0.5) { e.burn = -1; e.dmg = 1; e.inst && applyBurnLook(e); } } else e.still = 0; }
  }
}
function startBurn(e, secs) { if (e.burn > 0) return; const was = e.burn; e.burn = secs; e.dmg = 1; S.stats.burns++; if (e.inst) applyBurnLook(e); if (S.fx && was === 0) { const p = worldOf(e, e.kit?.meta.fire || [0, 1.5, 0]); S.fx.emit('b', 'burst', p, 1, 0); } }
function damage(e, amt) { if (!e || e.burn !== 0) return; const cap = e.player ? 0.85 : 1; const before = e.dmg; e.dmg = Math.min(cap, e.dmg + amt); S.stats.impacts++; if (e.inst && bucket(before) !== bucket(e.dmg)) applyBurnLook(e); }
const bucket = d => d >= 0.7 ? 3 : d >= 0.45 ? 2 : d >= 0.2 ? 1 : 0;
const _w = new THREE.Vector3();
function worldOf(e, p) { _w.set(p[0], p[1], p[2]); e.tag.body.updateWorldMatrix(true, false); return e.tag.body.localToWorld(_w).clone(); }

// ---------------------------------------------------------------- night lights ----------------------------------------------------------------
function nightInfo() {
  let n = 0, isN = false;
  try { const T = window.SSX?.time; if (T?.nightness) n = T.nightness(); else n = window.SSX?.look?.nightness?.() ?? 0; isN = T?.isNight ? !!T.isNight() : n > 0.5; } catch { /* old SSX.time */ }
  return [Math.max(0, Math.min(1, n || 0)), isN];
}
function ensureLights() {
  if (S.lights) return S.lights;
  const L = { spots: [], fire: null, root: new THREE.Group() }; L.root.name = 'ssxVehLights';
  for (let i = 0; i < (LIGHTS[S.tier] ?? 3); i++) { const s = new THREE.SpotLight(0xfff0d8, 0, 48, 0.55, 0.65, 1.4); s.castShadow = false; L.root.add(s, s.target); L.spots.push(s); }
  if (S.tier !== 'low') { L.fire = new THREE.PointLight(0xff7a30, 0, 22, 1.6); L.root.add(L.fire); }
  return (S.lights = L);
}
function lightsIn(on) { const L = S.lights; if (!L) { if (!on) return; ensureLights(); } if (on && !S.lightsIn) { S.scene.add(S.lights.root); S.lightsIn = true; } else if (!on && S.lightsIn) { S.lights.root.parent?.remove(S.lights.root); S.lightsIn = false; } }
function dropLights() { if (S.lights) { S.lights.root.parent?.remove(S.lights.root); S.lights = null; } S.lightsIn = false; }

// ---------------------------------------------------------------- the landed starship: PBR steel + nav lights ----------------------------------------------------------------
function shipUpgrade(ctx) {
  if (S.ship) { if (S.ship.g.parent) return; S.ship = null; }
  const g = ctx.scene.children.find(o => o.userData?.poi && /starship/i.test(o.userData.name || '')); if (!g) return;
  const swaps = [], cache = new Map();
  g.traverse(o => { if (!o.isMesh || o.material?.isMeshBasicMaterial || Array.isArray(o.material)) return; const m = o.material; let n = cache.get(m);
    if (!n) { n = new THREE.MeshPhysicalMaterial({ color: m.color, map: m.map, side: m.side, roughness: m.map ? 0.26 : Math.max(0.35, m.roughness), metalness: m.map ? 0.92 : Math.min(0.6, m.metalness + 0.3), clearcoat: m.map ? 0.35 : 0, clearcoatRoughness: 0.2, envMapIntensity: 1.25 }); n.userData.weathered = true; cache.set(m, n); }
    swaps.push([o, m]); o.material = n; });
  const nav = new THREE.Group(); nav.name = 'ssxShipNav';
  const mk = (c, x, y, z, r = 0.22) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.userData.noV8 = true; nav.add(m); return m; };
  const blink = [mk(0xff2020, 0, 4.6, 4.75), mk(0x20ff40, 0, 4.6, -4.75), mk(0xffffff, 0, 50.3, 0, 0.3)], steady = [mk(0xffd8a0, 4.7, 8, 0, 0.16), mk(0xffd8a0, -4.7, 8, 0, 0.16)];
  g.add(nav); S.ship = { g, swaps, nav, blink, steady };
}
function shipRestore() { const s = S.ship; if (!s) return; for (const [o, m] of s.swaps) o.material = m; s.nav.parent?.remove(s.nav); S.ship = null; }

// ---------------------------------------------------------------- per frame ----------------------------------------------------------------
const qn = new THREE.Vector3(), qt = new THREE.Vector3();
function visibleInScene(g) { for (let o = g; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; }
function update(dt, ctx) {
  const cam = ctx.camera, cap = (CAPS[S.tier] ?? 8), carG = ctx.car?.group || null, list = [];
  for (const [g, e] of S.tracked) {
    if (!g.parent) { detach(e); S.tracked.delete(g); continue; }
    g.getWorldPosition(e.wp);
    if (e.last) { const mv = Math.hypot(e.wp.x - e.last.x, e.wp.z - e.last.z), v = dt > 0 ? mv / dt : 0;
      if (mv < 25 && dt > 0) { const prev = e.spd; e.spd += (Math.min(v, 60) - e.spd) * Math.min(1, dt * 10);
        if (!e.player && prev > 7.5 && e.spd < prev * 0.45 && e.burn === 0) damage(e, Math.min(0.4, (prev - e.spd) * 0.03)); } }
    else e.last = new THREE.Vector3(); e.last.copy(e.wp);
    e.player = !!carG && (g === carG || g.parent?.parent === carG); // your rover, or the dealer skin inside its body
    e.off = suppressed(e, ctx);
    e.d = e.wp.distanceTo(cam.position);
    if (e.burn > 0) { e.burn -= dt; if (e.burn <= 0) { e.burn = -1; if (e.inst) applyBurnLook(e); } }
    if (e.off || !visibleInScene(g) || e.d > D_FAR + 10) { if (e.inst) detach(e); continue; }
    list.push(e);
  }
  // your car's own speed is exact: a sudden loss = a crash
  const pc = ctx.car || null, pe = pc?.group ? (list.find(e => e.player) || S.tracked.get(pc.group)) : null;
  if (pe) { const v = Math.abs(pc.speed || 0); if (pe.pv != null && pe.pv > 8 && pe.pv - v > 6) damage(pe, Math.min(0.35, (pe.pv - v - 4) * 0.035)); pe.pv = v; }
  list.sort((a, b) => (b.player - a.player) || a.d - b.d);
  let n = 0;
  for (const e of list) {
    const want = n < cap && (e.player || e.d < (e.inst ? D_FAR + 8 : D_FAR));
    if (want) { n++; if (!e.inst) attach(e); } else if (e.inst) detach(e);
    const inst = e.inst; if (!inst) continue;
    if (inst.paint.material !== paintMat(e)) inst.paint.material = paintMat(e);
    const rim = rimOf(e); if (rim !== inst.rim) { inst.rim = rim; const wm = wheelMat(e); for (const m of inst.wheels) m.material = wm; }
    if (inst.trim) inst.trim.visible = e.d < D_LOD1 || e.player;
    inst.beam.visible = S.night > 0.3 && e.burn === 0;
  }
  // IBL: on low / med #35 puts the env map on metallic materials only (scene.environment stays null); give our paint,
  // trim and glass the same probe so clearcoat and chrome have something to reflect. One recompile when it first appears.
  const env = ctx.scene.environment ? null : (window.__v8?.S?.envRT?.texture || null);
  if (env !== S.env) { S.env = env; for (const m of S.mats.values()) if (m.isMeshStandardMaterial) { m.envMap = env; m.needsUpdate = true; } }
  else if (env && S.mats.size !== S.envN) for (const m of S.mats.values()) if (m.isMeshStandardMaterial && m.envMap !== env) { m.envMap = env; m.needsUpdate = true; }
  S.envN = S.mats.size;
  // lamps + beams follow the night
  const G = S.gen; G.LAMP_U.uHead.value = 0.35 + S.night * 3.4; G.LAMP_U.uTail.value = 0.45 + S.night * 1.8; G.LAMP_U.uBlink.value = 0.25 + S.night * 0.8; G.BEAM_U.uK.value = THREE.MathUtils.smoothstep(S.night, 0.3, 0.8);
  // smoke / fire
  if (S.fx) {
    let fireE = null;
    for (const e of list) { if (!e.inst || e.d > 90) continue; const k = e.kit.meta;
      if (e.burn > 0) { S.fx.emit(e.seed, 'fire', worldOf(e, k.fire), 1, dt); S.fx.emit(e.seed, 'smoke', worldOf(e, [k.fire[0], k.fire[1] + 0.8, k.fire[2]]), 1, dt); if (!fireE || e.d < fireE.d) fireE = e; }
      else if (e.burn < 0) S.fx.emit(e.seed, 'smoke', worldOf(e, k.fire), 0.35, dt * 0.5);
      else if (e.dmg >= 0.45) S.fx.emit(e.seed, 'smoke', worldOf(e, k.smoke), Math.min(0.45, (e.dmg - 0.45) / 0.8), dt * 0.6); }
    for (const m of S.mats.values()) if (m.userData.burning) m.userData.U.uEmber.value = 0.6 + Math.sin(S.frame * 0.37) * 0.25 + Math.random() * 0.25;
    S.fx.update(dt, cam, window.__app?.renderer?.domElement?.height || innerHeight * devicePixelRatio);
    S.fireE = fireE;
  }
  // real lights at night: your car first, then the nearest moving cars
  if (S.isNight && S.night > 0.3) {
    lightsIn(true); const L = S.lights; let i = 0;
    for (const e of list) { if (i >= L.spots.length) break; if (!e.inst || e.burn !== 0 || e.d > D_LIGHT || (!e.player && e.spd < 1.5 && i > 0)) continue;
      const h = e.kit.meta.head, s = L.spots[i++]; s.position.copy(worldOf(e, [0, h.y, h.z - 0.15])); s.target.position.copy(worldOf(e, [0, -0.4, h.z - 16])); s.target.updateMatrixWorld(); s.intensity = e.player ? 90 : 60; }
    for (; i < L.spots.length; i++) L.spots[i].intensity = 0;
    if (L.fire) { const f = S.fireE; if (f) { L.fire.position.copy(worldOf(f, [f.kit.meta.fire[0], f.kit.meta.fire[1] + 0.6, f.kit.meta.fire[2]])); L.fire.intensity = 26 + Math.random() * 14; } else L.fire.intensity = 0; }
  } else lightsIn(false);
  // ship nav lights
  if (S.ship) { S.ship.blink[2].visible = (S.frame % 90) < 8; for (const b of S.ship.steady) b.visible = S.night > 0.2; }
  S.attachedNow = list.filter(e => e.inst).length;
}

// ---------------------------------------------------------------- lifecycle ----------------------------------------------------------------
function wanted() { const t = window.SSX?.look?.tier?.(); S.tier = typeof t === 'string' ? t : 'classic'; if (FORCE === 'off') return false; return FORCE === 'on' ? true : S.tier !== 'classic'; }
function load() {
  return S.loading ||= Promise.all([import('./vehicles-gen.js'), import('./vehicles-fx.js')]).then(([g, f]) => { S.gen = g; S.fxMod = f; }, e => { S.loading = null; S.stats.fails++; warnOnce('modules', e); throw e; });
}
function clearAll() {
  for (const e of S.tracked.values()) detach(e); S.tracked.clear();
  shipRestore(); dropLights(); S.fx?.dispose(); S.fx = null; S.scene = null;
}
function tick(dt, ctx) {
  S.frame++;
  try { wrapBuilders(); } catch (e) { warnOnce('wrap', e); } // cheap: re-wraps kinds registered / replaced since the last frame
  const on = wanted();
  if (!on) { if (S.on) { clearAll(); S.on = false; } return; }
  if (!S.gen) { load().catch(() => {}); return; }
  if (S.scene !== ctx.scene) { clearAll(); S.scene = ctx.scene; S.t = 0; }
  if (!S.fx) { S.fx = S.fxMod.createFX(); ctx.scene.add(S.fx.root); }
  if (S.lights && (S.lights.spots.length !== (LIGHTS[S.tier] ?? 3))) dropLights();
  S.on = true; S.ctx = ctx;
  [S.night, S.isNight] = nightInfo();
  if ((S.t -= dt) <= 0) { S.t = 0.5; try { scan(ctx); shipUpgrade(ctx); } catch (e) { warnOnce('scan', e); } }
  try { update(dt, ctx); } catch (e) { warnOnce('update', e); }
}
// target: 'player' | 'nearest' | a vehicle group | { group }
function entryOf(t) {
  if (!t || t === 'nearest') { let b = null; for (const e of S.tracked.values()) if (!e.player && (!b || e.d < b.d)) b = e; return b; }
  if (t === 'player') { for (const e of S.tracked.values()) if (e.player) return e; return null; }
  return S.tracked.get(t.group || t) || null;
}
const API = {
  version: VERSION,
  enabled: () => S.on,
  state: () => ({ version: VERSION, on: S.on, tier: S.tier, force: FORCE, tracked: S.tracked.size, attached: S.attachedNow || 0, cap: CAPS[S.tier] ?? 8, night: Math.round(S.night * 100) / 100, isNight: S.isNight,
    lights: S.lightsIn ? S.lights.spots.filter(s => s.intensity > 0).length : 0, lightPool: S.lights ? S.lights.spots.length + (S.lights.fire ? 1 : 0) : 0, fx: S.fx?.live() || 0, ship: !!S.ship, geos: S.geos.size, mats: S.mats.size, ...S.stats }),
  list: () => [...S.tracked.values()].sort((a, b) => a.d - b.d).map(e => ({ kind: e.tag.kind, base: e.tag.base, d: Math.round(e.d), on: !!e.inst, player: e.player, dmg: Math.round(e.dmg * 100) / 100, burn: e.burn > 0 ? 'burning' : e.burn < 0 ? 'charred' : null, x: Math.round(e.wp.x), z: Math.round(e.wp.z) })),
  damage: (t, amt = 0.35) => { const e = entryOf(t); if (!e) return false; damage(e, amt); return e.dmg; },
  burn: (t, secs = 20) => { const e = entryOf(t); if (!e) return false; startBurn(e, secs); return true; },
  repair: (t) => { const e = entryOf(t); if (!e) return false; e.dmg = 0; e.burn = 0; if (e.inst) applyBurnLook(e); return true; },
  preload: () => load()
};
// ---------------------------------------------------------------- SSX.vehicleLook: the hook for dealership / garage / mods ----------------------------------------------------------------
// Everything stays keyed by the vehicle group and its kind (VEHICLE_BUILDERS key, userData.ride.kind untouched).
//   has(kind)                 -> true if that kind gets a realistic model on med+ (false: raccoon_rover, liveries, mods)
//   info(target)              -> { kind, rideKind, base, realistic, on, root, paintMesh, paintSource, attach, wheels } | null
//   attachGroup(target)       -> THREE.Group 'ssxVehAttach' on the vehicle body: shown in BOTH looks (kits, decals, props)
//   paint(target, { color, metal, rough }) -> recolours the vehicle's source paint material (v.paint / ride.paint, the
//                                same one decorate() writes); the realistic paint mirrors it next frame. Returns true.
//   skip(kind, on = true)     -> force a kind to keep its existing mesh (or group.userData.ssxVehSkip = true for one car)
//   useBase(kind, on = true)  -> let a kind built on a modelled base (e.g. build('buggy') + livery) use the base's model
//   refresh(target)           -> drop and rebuild the model now (after swapping meshes on the blocky group)
//   onChange(fn)              -> fn({ type: 'attach' | 'detach' | 'fallback', group, kind }); returns an unsubscribe
// target: a vehicle group, a { group } vehicle / rover object, 'player' or 'nearest'.
const LISTEN = new Set(), RIDE_KINDS = new Set(Object.keys(RIDE_EXTRA));
function emit(type, e) { for (const f of LISTEN) { try { f({ type, group: e.g, kind: e.tag.kind }); } catch (err) { warnOnce('listener', err); } } }
function groupOf(t) { if (!t) return null; if (t === 'player' || t === 'nearest') return entryOf(t)?.g || null; return t.isObject3D ? t : t.group || null; }
function attachGroupOf(g) { const t = g?.userData?.ssxVeh, body = t?.body || g?.children?.[0] || g; if (!body) return null; let a = body.getObjectByName?.('ssxVehAttach'); if (!a || a.parent !== body) { a = new THREE.Group(); a.name = 'ssxVehAttach'; body.add(a); } return a; }
const LOOK = {
  version: VERSION,
  has: (kind) => !SKIP.has(kind) && (!!PROFILES[kind] || RIDE_KINDS.has(kind) || USE_BASE.has(kind)),
  info(t) { const g = groupOf(t), tag = g?.userData?.ssxVeh; if (!tag) return null; const e = S.tracked.get(g);
    return { kind: tag.kind, rideKind: g.userData.ride?.kind ?? null, base: tag.base, realistic: S.on && realistic(tag, g), on: !!e?.inst, fallback: !e?.inst ? (e?.off ? 'suppressed' : e?.failed ? 'failed' : !realistic(tag, g) ? 'no model' : !S.on ? 'look off' : 'far / over cap') : null,
      root: e?.inst?.root || null, paintMesh: e?.inst?.paint || null, paintSource: tag.paintMeshes[0]?.material || tag.paint || null, attach: attachGroupOf(g), wheels: tag.wheels }; },
  attachGroup: (t) => attachGroupOf(groupOf(t)),
  paint(t, o = {}) { const g = groupOf(t), tag = g?.userData?.ssxVeh; if (!tag) return false; const mats = new Set([tag.paint, ...tag.paintMeshes.map(m => m.material)].filter(m => m?.color));
    for (const m of mats) { if (o.color != null) m.color.set(o.color); if (o.metal != null) m.metalness = o.metal; if (o.rough != null) m.roughness = o.rough; } return mats.size > 0; },
  skip(kind, on = true) { on ? SKIP.add(kind) : SKIP.delete(kind); for (const e of S.tracked.values()) if (e.tag.kind === kind) { detach(e); S.tracked.delete(e.g); } return true; },
  useBase(kind, on = true) { on ? USE_BASE.add(kind) : USE_BASE.delete(kind); return true; },
  refresh(t) { const g = groupOf(t), e = g && S.tracked.get(g); if (!e) return false; detach(e); e.fit = null; e.failed = false; e.tag.orig = collect({ group: g }); e.tag.paintMeshes = e.tag.orig.filter(o => o.material === e.tag.paint); return true; },
  onChange(fn) { LISTEN.add(fn); return () => LISTEN.delete(fn); }
};
window.__v8veh = { S, API, LOOK };
(function boot() {
  const X = window.SSX; if (!X || typeof X.registerSurfaceTick !== 'function') { setTimeout(boot, 250); return; }
  X.registerSurfaceTick(tick); X.vehicles = API; X.vehicleLook = LOOK;
})();
