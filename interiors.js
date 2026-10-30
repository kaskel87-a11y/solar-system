// v7.3 enterable buildings: walk-in interiors (cantina, gun shop, depot, The Velvet Airlock club).
// Each interior is a small closed room built lazily the first time you walk in, parked out of sight above
// the colony and only visible while you are inside. The colony's one point light moves in with you, so the
// light count never changes (no shader recompiles). Hotspots drive the action button; colliders are boxes.
// All game fiction. The club is a dance club: costumed performers (bikinis, club wear) on a stage, a bar, a
// bouncer and a VIP back room used as a contact hub. No nudity, no sexual content, no interactions with
// the performers. v7.4/v7.5.4 adds adults-only (18+ gate) paid dances: costumes stay on, hands off, the upstairs
// fades to black, and Danny's private show (privateshow.js) is a non-explicit teasing routine in a booth.
import * as THREE from 'three';
import { dress, DANNY_NAME } from './clubdancers.js';
import { addBooth } from './privateshow.js'; // v7.5.4 Danny's upstairs VIP booth (private show)
import { addDancerSpots } from './clubprivate.js'; // v7.6 private dances from the other stage dancers (same booth)

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const B = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const G = {};
function geos() {
  if (G.ok) return G; G.ok = true;
  G.box = new THREE.BoxGeometry(1, 1, 1); G.sph = new THREE.SphereGeometry(1, 12, 9); G.cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  G.cone = new THREE.ConeGeometry(1, 1, 14, 1, true); G.plane = new THREE.PlaneGeometry(1, 1);
  for (const k in G) if (G[k]?.isBufferGeometry) G[k].userData.shared = true;
  return G;
}
const mats = new Map();
function mat(c, o) { const k = c + JSON.stringify(o || {}); if (!mats.has(k)) { const m = (o && o.basic) ? (({ basic, ...rest }) => B(c, rest))(o) : M(c, o); m.userData.shared = true; mats.set(k, m); } return mats.get(k); }
const mk = (g, m, x, y, z, sx = 1, sy = sx, sz = sx) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };

// neon-style text panel; the font shrinks to fit long names
export function textTex(text, color, { w = 512, h = 128, bg = 'rgba(8,8,12,0.85)', border = true, font = 'bold 74px system-ui, sans-serif' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const col = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  if (border) { x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); }
  let size = parseInt(/(\d+)px/.exec(font)[1], 10); x.font = font;
  while (x.measureText(text).width > w - 40 && size > 14) { size -= 2; x.font = font.replace(/\d+px/, size + 'px'); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = col; x.shadowBlur = 24; x.fillStyle = col; x.fillText(text, w / 2, h / 2 + 4); x.shadowBlur = 8; x.fillStyle = '#fff'; x.globalAlpha = 0.55; x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- stylised people (helmets off indoors). Faces -z. Everyone is fully clothed. ----------
export function buildHuman({ skin = 0xc68a64, top = 0x3a4250, bottom = 0x23252b, shoes = 0x121214, hair = 0x241a12, hairStyle = 'short', accent = null, glow = null, shades = false, size = 1, bulk = 1 } = {}) {
  geos();
  const g = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
  const mt = mat(top, glow ? { emissive: glow, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.4 } : undefined), mb = mat(bottom), ms = mat(skin), msh = mat(shoes), mh = mat(hair);
  const legs = [];
  for (const s of [-1, 1]) {
    const L = new THREE.Group(); L.position.set(s * 0.11 * bulk, 0, 0); hips.add(L);
    L.add(mk(G.box, mb, 0, -0.44, 0, 0.17 * bulk, 0.88, 0.19 * bulk), mk(G.box, msh, 0, -0.87, -0.05, 0.18 * bulk, 0.12, 0.3));
    legs.push(L);
  }
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(mk(G.box, mb, 0, 0.06, 0, 0.36 * bulk, 0.18, 0.22 * bulk), mk(G.box, mt, 0, 0.37, 0, 0.44 * bulk, 0.52, 0.25 * bulk));
  if (accent) torso.add(mk(G.box, mat(accent, { emissive: accent, emissiveIntensity: 0.6 }), 0, 0.15, 0, 0.45 * bulk, 0.05, 0.26 * bulk), mk(G.box, mat(accent, { emissive: accent, emissiveIntensity: 0.6 }), 0, 0.6, 0, 0.46 * bulk, 0.06, 0.27 * bulk));
  torso.add(mk(G.cyl, ms, 0, 0.67, 0, 0.06, 0.1, 0.06));
  const head = new THREE.Group(); head.position.y = 0.82; torso.add(head);
  head.add(mk(G.sph, ms, 0, 0, 0, 0.13, 0.155, 0.14));
  if (hairStyle !== 'bald') head.add(mk(G.sph, mh, 0, 0.045, 0.012, 0.14, 0.12, 0.15));
  if (hairStyle === 'long') head.add(mk(G.box, mh, 0, -0.1, 0.09, 0.27, 0.32, 0.07));
  if (hairStyle === 'bun') head.add(mk(G.sph, mh, 0, 0.12, 0.11, 0.07));
  if (hairStyle === 'mohawk') head.add(mk(G.box, mh, 0, 0.16, 0.02, 0.04, 0.1, 0.24));
  if (hairStyle === 'cap') head.add(mk(G.box, mh, 0, 0.1, -0.08, 0.2, 0.03, 0.14));
  head.add(mk(G.box, mat(shades ? 0x0a0a0c : 0x1a1210, shades ? { roughness: 0.2, metalness: 0.6 } : undefined), 0, 0.02, -0.125, shades ? 0.22 : 0.16, shades ? 0.05 : 0.02, 0.03));
  const arms = [];
  for (const s of [-1, 1]) {
    const A = new THREE.Group(); A.position.set(s * 0.28 * bulk, 0.58, 0); torso.add(A);
    A.add(mk(G.box, mt, 0, -0.28, 0, 0.115 * bulk, 0.56, 0.125 * bulk), mk(G.sph, ms, 0, -0.6, 0, 0.06));
    arms.push(A);
  }
  g.scale.setScalar(size);
  return { group: g, hips, torso, head, arms, legs, base: 0.92 };
}
function resetPose(h) { h.hips.position.y = h.base; h.hips.rotation.set(0, 0, 0); h.torso.rotation.set(0, 0, 0); h.head.rotation.set(0, 0, 0); for (const a of h.arms) a.rotation.set(0, 0, 0); for (const l of h.legs) l.rotation.set(0, 0, 0); }
export function sitPose(h) { resetPose(h); h.hips.position.y = 0.5; for (const l of h.legs) l.rotation.x = 1.45; h.arms[0].rotation.x = 0.5; h.arms[1].rotation.x = 0.5; }
// stylised stage routine: four moves rotating every 8 beats (groove, arms-up wave, spin, point-and-step)
export function dance(h, t, style = 0, bpm = 118, yaw0 = 0) {
  resetPose(h);
  const beat = t * bpm / 60, b = beat * Math.PI, move = (Math.floor(beat / 8) + style) % 4, L = h.arms[0], R = h.arms[1];
  h.hips.position.y = h.base - Math.abs(Math.sin(b)) * 0.06;
  let spin = 0;
  if (move === 0) { h.hips.rotation.y = Math.sin(b) * 0.3; h.torso.rotation.z = Math.sin(b) * 0.12; L.rotation.x = 0.7 + Math.sin(b) * 0.5; R.rotation.x = 0.7 - Math.sin(b) * 0.5; L.rotation.z = -0.25; R.rotation.z = 0.25; h.legs[0].rotation.x = Math.max(0, Math.sin(b)) * 0.35; h.legs[1].rotation.x = Math.max(0, -Math.sin(b)) * 0.35; h.head.rotation.y = Math.sin(b) * 0.2; }
  else if (move === 1) { const w = Math.sin(b * 2) * 0.25; L.rotation.z = -(2.5 + w); R.rotation.z = 2.5 - w; h.torso.rotation.z = Math.sin(b) * 0.18; h.hips.rotation.y = Math.sin(b) * 0.2; h.legs[0].rotation.z = 0.12; h.legs[1].rotation.z = -0.12; }
  else if (move === 2) { spin = ((beat % 8) / 8) * Math.PI * 2; L.rotation.z = -1.35; R.rotation.z = 1.35; L.rotation.x = 0.2; R.rotation.x = 0.2; h.legs[(Math.floor(beat) % 2)].rotation.x = 0.4; }
  else { const up = Math.floor(beat) % 2; R.rotation.x = up ? 2.7 : 0.6; R.rotation.z = up ? 0.3 : 0.5; L.rotation.x = up ? 0.4 : 2.7; L.rotation.z = up ? -0.5 : -0.3; h.torso.rotation.y = up ? -0.3 : 0.3; h.legs[up].rotation.x = 0.5; h.head.rotation.x = -0.15; }
  h.group.rotation.y = yaw0 + spin;
}
// v7.4 pole routine (club dancers): orbit the pole holding it with one hand, lean-backs, a climb-and-spin and a slow
// slide down. Athletic, costumes stay on, nothing suggestive: spins, holds and poses only.
export function poleDance(h, t, k = 0, px = 0, pz = 0, y0 = 0) {
  resetPose(h);
  const beat = t * 118 / 60 + k * 5, phase = Math.floor(beat / 8) % 4, f = (beat % 8) / 8, L = h.arms[0], R = h.arms[1];
  let ang = beat * 0.55 + k * 2, rad = 0.42, lift = 0;
  R.rotation.z = 2.6; R.rotation.x = 0.2; // grip arm up on the pole
  if (phase === 0) { L.rotation.z = -1.3 + Math.sin(beat * Math.PI) * 0.3; h.legs[0].rotation.x = Math.sin(beat * Math.PI) * 0.35; h.torso.rotation.z = -0.15; }
  else if (phase === 1) { h.torso.rotation.z = -0.5 * Math.sin(f * Math.PI); L.rotation.z = -2.2; h.legs[1].rotation.z = 0.35 * Math.sin(f * Math.PI); ang += f * 0.8; }
  else if (phase === 2) { lift = Math.sin(f * Math.PI) * 0.9; ang += f * Math.PI * 3; L.rotation.z = -2.5; for (const l of h.legs) l.rotation.x = 0.6 * Math.sin(f * Math.PI); h.legs[1].rotation.x = -0.4 * Math.sin(f * Math.PI); }
  else { h.hips.position.y = h.base - 0.25 * Math.sin(f * Math.PI); L.rotation.z = -0.9; L.rotation.x = 0.6; h.legs[0].rotation.x = 0.5 * Math.sin(f * Math.PI); }
  h.group.position.set(px + Math.sin(ang) * rad, y0 + lift, pz + Math.cos(ang) * rad);
  h.group.rotation.y = ang + Math.PI / 2; // side-on to the pole, grip hand towards it
}
function idle(h, t, k = 0) { resetPose(h); const s = Math.sin(t * 1.6 + k); h.hips.position.y = h.base - Math.abs(s) * 0.02; h.torso.rotation.z = s * 0.03; h.head.rotation.y = Math.sin(t * 0.4 + k * 2) * 0.4; h.arms[0].rotation.x = 0.1; h.arms[1].rotation.x = 0.1; }
function bob(h, t, k = 0, bpm = 118) { resetPose(h); const b = t * bpm / 60 * Math.PI + k; h.hips.position.y = h.base - Math.abs(Math.sin(b)) * 0.05; h.torso.rotation.z = Math.sin(b) * 0.07; h.head.rotation.x = Math.abs(Math.sin(b)) * 0.15; h.arms[1].rotation.x = 1.2 + Math.sin(b) * 0.15; h.arms[0].rotation.x = 0.3; }
function drink(h, t, k = 0) { idle(h, t, k); const c = (t * 0.25 + k) % 1; if (c < 0.18) h.arms[1].rotation.x = 2.1 * Math.sin(c / 0.18 * Math.PI); else h.arms[1].rotation.x = 0.9; h.arms[1].rotation.z = 0.2; }
function wipe(h, t) { resetPose(h); h.arms[1].rotation.x = 1.3; h.arms[1].rotation.z = Math.sin(t * 3) * 0.35; h.torso.rotation.x = 0.12; h.head.rotation.y = Math.sin(t * 0.3) * 0.5; }
function guard(h, t) { resetPose(h); h.arms[0].rotation.x = 0.6; h.arms[1].rotation.x = 0.6; h.arms[0].rotation.z = 0.5; h.arms[1].rotation.z = -0.5; h.head.rotation.y = Math.sin(t * 0.35) * 0.6; }

// ---------- room kit ----------
function roomKit(def) {
  geos();
  const g = new THREE.Group(), cols = [], spots = [], ticks = [], disposables = [];
  const { w, d, h } = def;
  const wallM = mat(def.wall ?? 0x2a2630), floorM = mat(def.floor ?? 0x18161a, { roughness: 0.9 }), ceilM = mat(def.ceil ?? 0x121014, { roughness: 1 }), trimM = mat(def.trim ?? 0xff3a7a, { basic: true });
  const box = (x, y, z, sx, sy, sz, m) => { const o = mk(G.box, m, x, y, z, sx, sy, sz); g.add(o); return o; };
  // floor, ceiling, walls (south wall has the door gap)
  box(0, -0.05, 0, w, 0.1, d, floorM); box(0, h + 0.05, 0, w, 0.1, d, ceilM);
  box(0, h / 2, -d / 2 - 0.15, w + 0.6, h, 0.3, wallM); box(-w / 2 - 0.15, h / 2, 0, 0.3, h, d, wallM); box(w / 2 + 0.15, h / 2, 0, 0.3, h, d, wallM);
  const gap = 1.7, side = (w - gap) / 2;
  box(-(gap / 2 + side / 2), h / 2, d / 2 + 0.15, side, h, 0.3, wallM); box(gap / 2 + side / 2, h / 2, d / 2 + 0.15, side, h, 0.3, wallM); box(0, (h + 2.6) / 2, d / 2 + 0.15, gap, h - 2.6, 0.3, wallM);
  // the door you came in by (closed airlock panel, glowing frame) + neon trim at floor and ceiling level
  box(0, 1.3, d / 2 + 0.2, gap, 2.6, 0.1, mat(0x30343c, { metalness: 0.5, roughness: 0.4 }));
  box(-gap / 2, 1.3, d / 2 + 0.05, 0.08, 2.6, 0.08, trimM); box(gap / 2, 1.3, d / 2 + 0.05, 0.08, 2.6, 0.08, trimM); box(0, 2.62, d / 2 + 0.05, gap + 0.08, 0.08, 0.08, trimM);
  box(0, 0.06, -d / 2 + 0.02, w, 0.05, 0.04, trimM); box(-w / 2 + 0.02, 0.06, 0, 0.04, 0.05, d, trimM); box(w / 2 - 0.02, 0.06, 0, 0.04, 0.05, d, trimM);
  box(0, h - 0.08, -d / 2 + 0.02, w, 0.05, 0.04, trimM);
  const api = {
    g, cols, spots, ticks, w, d, h, box, wares: [],
    col(x, z, hw, hd, tag) { const c = { x, z, hw, hd, tag, on: true, h: tag === 'wall' ? 99 : tag === 'tall' ? 3.2 : 1.15 }; cols.push(c); return c; }, // h: camera occlusion height (v7.4)
    spot(s) { spots.push({ r: 1.7, ...s }); return s; },
    sign(text, color, x, y, z, yaw = 0, sw = 4, opts) { const t = textTex(text, color, opts); disposables.push(t); const m = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: t, transparent: true })); disposables.push(m.material); m.position.set(x, y, z); m.rotation.y = yaw; m.scale.set(sw, sw / 4, 1); g.add(m); return m; },
    person(opts, x, z, yaw, anim, k = 0) { const p = buildHuman(opts); p.group.position.set(x, 0, z); p.group.rotation.y = yaw; g.add(p.group); ticks.push((t, dt) => anim(p, t, k, yaw, dt)); return p; },
    mat, mk, G, disposables
  };
  api.spot({ id: 'leave', x: 0, z: d / 2 - 0.9, r: 1.6, label: '🚪 Leave', act: 'leave' });
  return api;
}

// bottles on a shelf: one instanced draw call
function bottles(api, x0, x1, y, z, rows = 2, yaw = 0) {
  const n = Math.max(4, Math.round((x1 - x0) / 0.32)) * rows, geo = new THREE.CylinderGeometry(0.06, 0.07, 0.34, 6);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n); api.disposables.push(geo, im.material);
  const cols = [0x6aff9a, 0xffb040, 0xff4a6a, 0x7ac8ff, 0xd8a0ff, 0xfff0a0], m4 = new THREE.Matrix4(), c = new THREE.Color(), per = n / rows;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / per), k = i % per, lx = x0 + (k + 0.5) * (x1 - x0) / per;
    m4.makeTranslation(yaw ? z : lx, y + r * 0.55, yaw ? lx : z); im.setMatrixAt(i, m4); im.setColorAt(i, c.setHex(cols[(i * 7 + r) % cols.length]).multiplyScalar(0.85));
  }
  api.g.add(im);
  return im;
}

// ---------- v7.3 wares: physical items on wall racks and in glass cases, each with a price tag ----------
const FACE = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
function wareModel(it) {
  geos(); const g = new THREE.Group(), id = it.id, k = it.kind;
  const dark = mat(0x1e2024, { metalness: 0.6, roughness: 0.4 }), steel = mat(0x8a9098, { metalness: 0.8, roughness: 0.3 }), wood = mat(0x5a3a22);
  const add = (geo, m, x, y, z, sx, sy, sz, rz = 0) => { const o = mk(geo, m, x, y, z, sx, sy, sz); o.rotation.z = rz; g.add(o); return o; };
  if (k === 'weapon') { // long guns lie across the rack (x = barrel axis)
    const L = { shotgun: 1.0, smg: 0.62, railrifle: 1.3, launcher: 0.9 }[id] || 0.9;
    add(G.box, dark, 0, 0, 0, L, 0.1, 0.08); add(G.box, id === 'shotgun' ? wood : dark, -L / 2 - 0.12, -0.05, 0, 0.3, 0.16, 0.07);
    add(G.box, dark, -0.05, -0.12, 0, 0.08, 0.2, 0.06);
    if (id === 'smg') add(G.box, dark, 0.08, -0.16, 0, 0.06, 0.24, 0.05);
    if (id === 'railrifle') { add(G.box, mat(0x9fd8ff, { basic: true }), 0.15, 0.07, 0, L * 0.7, 0.03, 0.09); add(G.cyl, dark, -0.1, 0.12, 0, 0.04, 0.3, 0.04, Math.PI / 2); }
    if (id === 'launcher') add(G.cyl, steel, 0.15, 0, 0, 0.09, 0.6, 0.09, Math.PI / 2);
    if (id === 'shotgun') add(G.box, wood, 0.2, -0.07, 0, 0.3, 0.07, 0.09);
  } else if (k === 'melee') {
    add(G.box, mat(0x222222), -0.35, 0, 0, 0.26, 0.06, 0.06);
    add(G.box, id === 'cleaver' ? mat(0xff7a30, { emissive: 0xff4a10, emissiveIntensity: 0.6, metalness: 0.6 }) : mat(0x9ff4ff, { emissive: 0x2a8a9a, emissiveIntensity: 0.4, metalness: 0.8 }), 0.12, id === 'cleaver' ? 0.03 : 0, 0, 0.7, id === 'cleaver' ? 0.16 : 0.07, 0.02);
  } else if (k === 'ammo') {
    const c = { shells: 0xffb347, rounds: 0xffe066, slugs: 0x9fd8ff, grenades: 0xff7a20 }[it.ammo || id] || 0xffb347;
    add(G.box, mat(0x3d4a2a), 0, 0, 0, 0.36, 0.2, 0.22); add(G.box, mat(c, { basic: true }), 0, 0.02, 0.113, 0.36, 0.05, 0.005);
    if (id === 'grenades') for (const x of [-0.1, 0.1]) add(G.sph, mat(0x4a5a2a), x, 0.15, 0, 0.07);
  } else if (k === 'medkit') { add(G.box, mat(0xf2f2f2), 0, 0, 0, 0.36, 0.22, 0.18); add(G.box, mat(0xd02020, { basic: true }), 0, 0, 0.092, 0.2, 0.06, 0.005); add(G.box, mat(0xd02020, { basic: true }), 0, 0, 0.092, 0.06, 0.16, 0.005); }
  else if (k === 'maxhp') { for (let i = 0; i < (it.tier || +(id.slice(-1)) || 1); i++) add(G.cyl, mat(0x30ff90, { emissive: 0x10a050, emissiveIntensity: 0.8 }), -0.12 + i * 0.12, 0, 0, 0.035, 0.26, 0.035); add(G.box, dark, 0, -0.15, 0, 0.36, 0.04, 0.12); }
  else if (k === 'maxammo') { add(G.box, mat(0x5a3a1a), 0, 0, 0, 0.34, 0.2, 0.1); for (let i = 0; i < 2 + (it.tier || +(id.slice(-1)) || 1); i++) add(G.box, mat(0xc0a040, { metalness: 0.6 }), -0.13 + i * 0.065, 0.14, 0, 0.04, 0.1, 0.04); }
  else if (k === 'upgrade') { if (id === 'heatsink') { add(G.box, steel, 0, 0, 0, 0.34, 0.18, 0.14); for (let i = 0; i < 5; i++) add(G.box, steel, -0.14 + i * 0.07, 0.13, 0, 0.02, 0.1, 0.14); } else add(G.box, mat(id === 'roverarmor' ? 0x6a6e40 : 0x50555c, { metalness: 0.7 }), 0, 0, 0, 0.5, 0.36, 0.06); }
  else if (k === 'roverup') { for (const y of id === 'turret3' ? [-0.06, 0.06] : [0]) for (const zz of [-0.06, 0.06]) add(G.cyl, dark, 0.1, y, zz, 0.035, 0.7, 0.035, Math.PI / 2); add(G.box, mat(0xff5cf0, { basic: true }), -0.3, 0, 0, 0.14, 0.18, 0.2); }
  else if (k === 'roverwpn') {
    if (id === 'rail') { add(G.box, dark, 0, 0, 0, 1.0, 0.1, 0.1); add(G.box, mat(0x9fd8ff, { basic: true }), 0, 0.07, 0, 0.9, 0.03, 0.12); }
    else if (id === 'rockets') { add(G.box, mat(0x6a6e76, { metalness: 0.5 }), 0, 0, 0, 0.5, 0.3, 0.3); for (const y of [-0.07, 0.07]) for (const zz of [-0.07, 0.07]) add(G.cyl, mat(0x111111), 0.26, y, zz, 0.05, 0.02, 0.05, Math.PI / 2); }
    else if (id === 'torch') { add(G.cyl, steel, 0, 0, 0, 0.08, 0.6, 0.08, Math.PI / 2); add(G.cyl, mat(0xffb347, { basic: true }), 0.32, 0, 0, 0.1, 0.06, 0.1, Math.PI / 2); }
    else { add(G.cyl, mat(0x8fe0ff, { emissive: 0x3a8aaa, emissiveIntensity: 0.7 }), 0, 0, 0, 0.26, 0.08, 0.26); }
  }
  else if (k === 'paint') { add(G.cyl, mat(it.color ?? 0x888888, { metalness: 0.3, roughness: 0.4 }), 0, 0, 0, 0.13, 0.3, 0.13); add(G.cyl, steel, 0, 0.16, 0, 0.13, 0.02, 0.13); }
  else if (k === 'kit') { add(G.box, mat(it.color ?? 0x8a0f14, { metalness: 0.4, roughness: 0.3 }), 0, 0, 0, 0.6, 0.12, 0.3); add(G.box, mat(0x111111), -0.05, 0.1, 0, 0.25, 0.08, 0.26); }
  else if (k === 'bandana') { const t = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 3), mat(it.color ?? 0xd23b3b, { roughness: 0.9 })); t.rotation.z = Math.PI; t.scale.z = 0.15; g.add(t); }
  else add(G.box, mat(0x888888), 0, 0, 0, 0.3, 0.2, 0.2);
  return g;
}
function tagDraw(ctx2, it) {
  const c = ctx2.canvas, w = c.width, h = c.height; ctx2.clearRect(0, 0, w, h);
  ctx2.fillStyle = 'rgba(10,10,14,0.92)'; ctx2.fillRect(0, 0, w, h);
  const st = !it ? '' : it.equipped ? 'EQUIPPED' : it.owned ? 'OWNED' : !it.ok ? (it.why || 'LOCKED').toUpperCase() : `${it.price} cr`;
  const col = !it ? '#888' : it.owned ? '#7dffb0' : !it.ok ? '#ff9a6a' : it.afford ? '#ffe680' : '#ff5a5a';
  ctx2.strokeStyle = col; ctx2.lineWidth = 4; ctx2.strokeRect(3, 3, w - 6, h - 6);
  ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
  let fs = 30; const name = (it?.name || '').replace(/ ×\d+$/, m => m); ctx2.font = `bold ${fs}px system-ui, sans-serif`; while (ctx2.measureText(name).width > w - 16 && fs > 14) { fs -= 2; ctx2.font = `bold ${fs}px system-ui, sans-serif`; }
  ctx2.fillStyle = '#fff'; ctx2.fillText(name, w / 2, h * 0.32);
  let f2 = 36; ctx2.font = `bold ${f2}px system-ui, sans-serif`; while (ctx2.measureText(st).width > w - 16 && f2 > 14) { f2 -= 2; ctx2.font = `bold ${f2}px system-ui, sans-serif`; }
  ctx2.fillStyle = col; ctx2.fillText(st, w / 2, h * 0.72);
}
function addWare(api, o, id, x, y, z, face = 's', opts = {}) {
  const it = o.shop?.item(id); if (!it) return null;
  const [fx, fz] = FACE[face], yaw = Math.atan2(fx, fz);
  const m = wareModel(it); m.position.set(x, y, z); m.rotation.y = yaw + (opts.turn || 0); if (opts.scale) m.scale.setScalar(opts.scale); api.g.add(m);
  m.traverse(c => { c.userData.ware = id; });
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 112; const c2 = cv.getContext('2d'); tagDraw(c2, it);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; api.disposables.push(tex);
  const tag = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: tex })); api.disposables.push(tag.material);
  const ty = opts.tagY ?? (y - 0.3);
  tag.position.set(x + fx * (opts.tagOut ?? 0.12), ty, z + fz * (opts.tagOut ?? 0.12)); tag.rotation.y = yaw; if (opts.tagTilt) tag.rotation.x = -opts.tagTilt; const ts = opts.tagScale || 0.8; tag.scale.set(ts, ts * 0.4375, 1); tag.userData.ware = id; api.g.add(tag);
  const spot = api.spot({ id: 'ware:' + id, x: x + fx * (opts.reach ?? 0.95), z: z + fz * (opts.reach ?? 0.95), r: opts.r ?? 0.75, label: '🛒 ' + it.name, act: 'buy', ware: id });
  const w = { id, m, tag, c2, tex, key: '', spot, x, y, z };
  api.wares.push(w);
  return w;
}
function wareTick(api, o) {
  for (const w of api.wares) { const it = o.shop?.item(w.id); const key = it ? `${it.owned}|${it.equipped}|${it.ok}|${it.afford}|${it.why}` : 'x'; if (key !== w.key) { w.key = key; tagDraw(w.c2, it); w.tex.needsUpdate = true; } }
}
// a glass display case (counter height), items sit inside on a lit shelf
function glassCase(api, x, z, len, depth = 0.8, along = 'x') {
  const { box, mat } = api, sx = along === 'x' ? len : depth, sz = along === 'x' ? depth : len;
  box(x, 0.45, z, sx, 0.9, sz, mat(0x2a2c30, { metalness: 0.5, roughness: 0.4 }));
  box(x, 0.92, z, sx * 0.94, 0.03, sz * 0.9, mat(0xfff4d0, { basic: true }));
  box(x, 1.12, z, sx, 0.4, sz, mat(0xbfe8ff, { transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }));
  api.col(x, z, sx / 2 + 0.05, sz / 2 + 0.05);
}
function wallRack(api, x, y, z, len, face = 's') { const [fx, fz] = FACE[face], alongX = fz !== 0; api.box(x - fx * 0.03, y, z - fz * 0.03, alongX ? len : 0.05, 1.6, alongX ? 0.05 : len, api.mat(0x9a8a68, { roughness: 0.9 })); api.box(x + fx * 0.02, y + 0.85, z + fz * 0.02, alongX ? len : 0.06, 0.05, alongX ? 0.06 : len, api.mat(0xfff0c0, { basic: true })); }

// ---------- the interiors ----------
// def: { name, w, d, h, light: {color, int}, music, build(api, opts) } ; spots { id, x, z, r, label, act, who?, cond?() }
export const INTERIORS = {
  cantina: {
    name: 'Cantina', w: 16, d: 12, h: 5, wall: 0x3a2a22, floor: 0x1e1612, ceil: 0x161210, trim: 0xff6a2a, light: { color: 0xffa060, int: 55 }, music: 'cantina',
    build(api, o) {
      const { box, mat, d, w } = api, wood = mat(0x5a3820, { roughness: 0.6 }), top = mat(0x8a5a32, { roughness: 0.35 }), metal = mat(0x6a6e76, { metalness: 0.6, roughness: 0.4 });
      // bar along the north wall, back shelf with bottles, bartender
      box(0, 0.55, -3.4, 9, 1.1, 0.9, wood); box(0, 1.13, -3.4, 9.3, 0.08, 1.1, top); api.col(0, -3.4, 4.65, 0.6);
      box(0, 1.6, -d / 2 + 0.25, 10, 0.06, 0.4, wood); box(0, 2.15, -d / 2 + 0.25, 10, 0.06, 0.4, wood);
      bottles(api, -4.8, 4.8, 1.8, -d / 2 + 0.25, 2);
      api.sign((o.title || 'CANTINA').toUpperCase(), 0xff5a2a, 0, 3.4, -d / 2 + 0.06, 0, 4.4);
      api.sign('NO CREDIT. NO FIGHTS. NO EXCEPTIONS.', 0xffd040, w / 2 - 0.06, 3.0, -1.5, -Math.PI / 2, 4.6, { h: 96 });
      for (let k = 0; k < 6; k++) { box(-3.75 + k * 1.5, 0.4, -2.45, 0.38, 0.8, 0.38, metal); box(-3.75 + k * 1.5, 0.82, -2.45, 0.5, 0.06, 0.5, mat(0x8a2a2a)); }
      api.person({ top: 0x6a2a20, bottom: 0x2a2a2a, hair: 0x9a9aa0, hairStyle: 'bun', skin: 0x8a5a3a, accent: 0xffa040 }, 2.8, -4.6, Math.PI, (p, t) => wipe(p, t));
      // tables with seated regulars
      const tables = [[-5, 0.8], [4.8, 0.6], [-4.6, 4], [4.6, 3.8]];
      tables.forEach(([x, z], i) => {
        box(x, 0.75, z, 1.3, 0.06, 1.3, top); box(x, 0.38, z, 0.12, 0.76, 0.12, metal);
        for (const s of [-1, 1]) box(x + s * 1.0, 0.25, z, 0.45, 0.5, 0.45, wood);
        api.col(x, z, 0.75, 0.75);
        if (i < 3) { const p = api.person({ top: [0x3a4a5a, 0x5a4a2a, 0x2a4a3a][i], bottom: 0x222222, hair: [0x2a1a10, 0x9a7a4a, 0x111111][i], hairStyle: ['short', 'long', 'cap'][i], skin: [0xc68a64, 0xe0b090, 0x6a4028][i] }, x - 1.0, z, -Math.PI / 2, (p, t, k) => { sitPose(p); const c = (t * 0.2 + k) % 1; p.arms[1].rotation.x = c < 0.15 ? 1.9 : 0.9; p.head.rotation.y = Math.sin(t * 0.5 + k) * 0.4; }, i * 0.37); void p; }
      });
      // jukebox
      box(w / 2 - 0.6, 0.9, 3.2, 0.9, 1.8, 0.7, mat(0x3a1a3a)); const jb = box(w / 2 - 0.95, 1.1, 3.2, 0.05, 1.0, 0.5, mat(0xff40c0, { basic: true })); api.col(w / 2 - 0.6, 3.2, 0.5, 0.4);
      api.ticks.push(t => { jb.material.color.setHSL((t * 0.08) % 1, 1, 0.55); });
      api.spot({ id: 'bar', x: -1.6, z: -2.3, r: 1.7, label: '🍸 Bar: drinks & rumors', act: 'shop', venue: 'bar', who: o.barkeep || 'Bartender' });
      if (o.talk) api.spot({ id: 'talk', x: 2.8, z: -2.3, r: 1.5, label: '💬 ' + o.talk, act: 'talk', who: o.talk });
    }
  },
  guns: {
    name: 'Gun shop', w: 12, d: 9, h: 4.5, wall: 0x2a2e30, floor: 0x1a1c1e, ceil: 0x101214, trim: 0xffd040, light: { color: 0xfff0d0, int: 85 }, store: 'guns',
    build(api, o) {
      const { box, mat, d, w } = api, steel = mat(0x50555c, { metalness: 0.7, roughness: 0.35 }), dark = mat(0x1a1b1e, { metalness: 0.5, roughness: 0.5 });
      // the long guns hang on the back-wall rack, one price tag each; a decorative top row that isn't for sale
      wallRack(api, 0, 2.2, -d / 2 + 0.06, 10, 's');
      for (let k = 0; k < 6; k++) { const gx = -4 + k * 1.6, gy = 2.85, z = -d / 2 + 0.14; box(gx, gy, z, 1.2, 0.1, 0.06, dark); box(gx - 0.5, gy - 0.1, z, 0.3, 0.22, 0.06, mat(k % 2 ? 0x5a3a22 : 0x2a2a2a)); }
      ['shotgun', 'smg', 'railrifle', 'launcher'].forEach((id, k) => addWare(api, o, id, -3.3 + k * 2.2, 1.75, -d / 2 + 0.16, 's', { tagY: 1.3, reach: 1.0, r: 1.0 }));
      api.sign((o.title || 'GUNS').toUpperCase(), 0xffd040, 0, 3.75, -d / 2 + 0.12, 0, 3.0, { h: 110 });
      // glass cases: ammo on the left, blades on the right
      glassCase(api, -2.4, 0.4, 3.6); glassCase(api, 1.6, 0.4, 2.0);
      ['shells', 'rounds', 'slugs', 'grenades'].forEach((id, k) => addWare(api, o, id, -3.75 + k * 0.9, 1.06, 0.4, 's', { tagY: 0.72, tagOut: 0.42, reach: 0.95, r: 0.6, scale: 0.9, tagScale: 0.8 }));
      ['blade', 'cleaver'].forEach((id, k) => addWare(api, o, id, 1.1 + k * 1.0, 1.06, 0.4, 's', { tagY: 0.72, tagOut: 0.42, reach: 0.95, r: 0.6, scale: 0.8 }));
      // Ozzie behind the side counter (full list as a fallback)
      box(4.5, 0.5, -0.2, 0.8, 1.0, 3.2, steel); box(4.5, 1.02, -0.2, 0.9, 0.05, 3.3, mat(0x2a2c30)); api.col(4.5, -0.2, 0.45, 1.65);
      api.person({ top: 0x4a4a3a, bottom: 0x2a2a22, hair: 0x6a6a6a, hairStyle: 'mohawk', skin: 0xb07a54, shades: true, accent: 0xffd040, bulk: 1.15 }, 5.35, -0.4, Math.PI / 2, (p, t) => { idle(p, t); p.arms[0].rotation.x = 0.9; p.arms[1].rotation.x = 0.9; p.arms[0].rotation.z = 0.6; p.arms[1].rotation.z = -0.6; });
      for (let k = 0; k < 3; k++) box(-w / 2 + 0.7, 0.3 + k * 0.6, 2.6 + (k % 2) * 0.2, 0.9, 0.55, 0.7, mat(0x3d4a2a)); api.col(-w / 2 + 0.7, 2.7, 0.55, 0.5);
      const tt = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 192; const x = c.getContext('2d'); x.fillStyle = '#e8e0c8'; x.fillRect(0, 0, 128, 192); x.fillStyle = '#222'; x.beginPath(); x.arc(64, 44, 26, 0, 7); x.fill(); x.fillRect(24, 74, 80, 118); x.strokeStyle = '#e8e0c8'; x.lineWidth = 3; for (const r of [14, 30, 46]) { x.beginPath(); x.arc(64, 120, r, 0, 7); x.stroke(); } x.fillStyle = '#c22'; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(50 + (i * 37) % 30, 100 + (i * 53) % 50, 3, 0, 7); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      api.disposables.push(tt); const tg = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: tt })); api.disposables.push(tg.material); tg.position.set(w / 2 - 0.05, 2.0, -3.0); tg.rotation.y = -Math.PI / 2; tg.scale.set(0.9, 1.35, 1); api.g.add(tg);
      api.spot({ id: 'counter', x: 3.4, z: -1.0, r: 1.0, label: '🧾 ' + (o.dealer || 'Dealer') + ': full list', act: 'shop', venue: 'guns', who: o.dealer || 'Dealer' });
      if (o.talk) api.spot({ id: 'talk', x: 3.4, z: 0.7, r: 0.9, label: '💬 ' + o.talk, act: 'talk', who: o.talk });
    }
  },
  supply: {
    name: 'Supply', w: 12, d: 9, h: 4.2, wall: 0x2c3230, floor: 0x1c201e, ceil: 0x121614, trim: 0x3cff8a, light: { color: 0xe8fff0, int: 85 }, store: 'supply',
    build(api, o) {
      const { box, mat, d, w } = api;
      wallRack(api, 0, 2.0, -d / 2 + 0.06, 10, 's');
      ['medkit', 'armor', 'heatsink', 'shells'].forEach((id, k) => addWare(api, o, id, -3.3 + k * 2.2, 1.7, -d / 2 + 0.16, 's', { tagY: 1.25, reach: 1.0, r: 1.0 }));
      api.sign((o.title || 'SUPPLY').toUpperCase(), 0x3cff8a, 0, 3.4, -d / 2 + 0.12, 0, 3.0, { h: 110 });
      glassCase(api, -2.4, 0.4, 2.8); glassCase(api, 1.8, 0.4, 2.8);
      ['vital1', 'vital2', 'vital3'].forEach((id, k) => addWare(api, o, id, -3.3 + k * 0.9, 1.06, 0.4, 's', { tagY: 0.72, tagOut: 0.42, reach: 0.95, r: 0.6 }));
      ['rig1', 'rig2', 'rig3'].forEach((id, k) => addWare(api, o, id, 0.9 + k * 0.9, 1.06, 0.4, 's', { tagY: 0.72, tagOut: 0.42, reach: 0.95, r: 0.6 }));
      api.sign('BIOMODS', 0x30ff90, -2.4, 1.75, 0.4, 0, 1.2, { h: 96 }); api.sign('RIGS', 0xffd040, 1.8, 1.75, 0.4, 0, 1.0, { h: 96 });
      // Frankie's gear on the east wall
      wallRack(api, w / 2 - 0.06, 1.9, -1.0, 3.4, 'w');
      const fr = (o.shop?.list('supply') || []).filter(i => i.kind === 'bandana').slice(0, 3);
      fr.forEach((it, k) => addWare(api, o, it.id, w / 2 - 0.16, 1.7, -2.2 + k * 1.2, 'w', { tagY: 1.25, reach: 1.0, r: 0.6 }));
      api.sign('FOR THE DOG', 0xffb347, w / 2 - 0.1, 2.85, -1.0, -Math.PI / 2, 1.8, { h: 96 });
      // clerk counter (full list)
      box(-w / 2 + 1.0, 0.5, 2.4, 0.8, 1.0, 2.4, mat(0x3a4a40, { metalness: 0.4 })); api.col(-w / 2 + 1.0, 2.4, 0.45, 1.25);
      api.person({ top: 0x2e5a44, bottom: 0x22302a, hair: 0x8a5a2a, hairStyle: 'bun', skin: 0xd8a07a, accent: 0x3cff8a }, -w / 2 + 0.45, 2.4, -Math.PI / 2, (p, t) => idle(p, t, 0.7));
      api.spot({ id: 'counter', x: -w / 2 + 2.1, z: 2.4, r: 1.1, label: '🧾 Clerk: full list', act: 'shop', venue: 'supply', who: 'Clerk' });
    }
  },
  depot: {
    name: 'Depot', w: 20, d: 14, h: 7, wall: 0x34363a, floor: 0x222326, ceil: 0x18191b, trim: 0xffb020, light: { color: 0xffe2b0, int: 110 }, store: 'depot',
    build(api, o) {
      const { box, mat, d, w } = api, rack = mat(0x2a5a8a, { metalness: 0.5, roughness: 0.5 }), crate = mat(0x6a5a3a), crate2 = mat(0x3c4a3a), ylw = mat(0xe0b020);
      for (const rx of [-3.4, 3.4]) {
        for (const z of [-1.4, 3.8]) box(rx, 2.5, z, 0.12, 5, 0.12, rack);
        for (const y of [0.15, 1.8, 3.4]) box(rx, y, 1.2, 1.2, 0.08, 5.4, rack);
        for (let k = 0; k < 9; k++) { const y = [0.6, 2.25, 3.85][k % 3], z = -0.8 + Math.floor(k / 3) * 1.9 + (k % 2) * 0.2; box(rx, y, z, 1.0, 0.8, 1.0 + (k % 2) * 0.3, k % 2 ? crate : crate2); }
        api.col(rx, 1.2, 0.7, 2.9, 'tall');
      }
      // rover parts wall (north) and the paint wall (east): everything has a tag
      wallRack(api, 0, 2.1, -d / 2 + 0.06, 13.5, 's');
      ['turret2', 'turret3', 'rail', 'rockets', 'torch', 'emp', 'roverarmor'].forEach((id, k) => addWare(api, o, id, -5.4 + k * 1.8, 1.8, -d / 2 + 0.2, 's', { tagY: 1.3, reach: 1.0, r: 0.9 }));
      api.sign('ROVER PARTS', 0xff5cf0, 0, 3.6, -d / 2 + 0.1, 0, 3.4, { h: 100 });
      wallRack(api, w / 2 - 0.06, 1.9, -1.6, 5.6, 'w');
      const cos = (o.shop?.list('depot') || []).filter(i => i.kind === 'paint' || i.kind === 'kit').slice(0, 4);
      cos.forEach((it, k) => addWare(api, o, it.id, w / 2 - 0.2, 1.6, -3.6 + k * 1.4, 'w', { tagY: 1.15, reach: 1.0, r: 0.7 }));
      api.sign('PAINT & BODY', 0xffd040, w / 2 - 0.1, 3.1, -1.6, -Math.PI / 2, 2.6, { h: 100 });
      // forklift
      box(7, 0.7, 2.5, 1.4, 1.0, 2.2, ylw); box(7, 1.7, 2.9, 1.2, 1.0, 1.0, mat(0x222222)); box(7, 1.2, 1.1, 1.2, 0.08, 0.9, mat(0x444444)); box(6.5, 1.5, 1.4, 0.08, 2.2, 0.08, mat(0x444444)); box(7.5, 1.5, 1.4, 0.08, 2.2, 0.08, mat(0x444444)); api.col(7, 2.3, 0.85, 1.4);
      // parts counter on the west wall (full list)
      box(-w / 2 + 1.0, 0.55, 3, 0.6, 1.1, 3.2, mat(0x4a4e56, { metalness: 0.6 })); api.col(-w / 2 + 1.0, 3, 0.4, 1.7);
      for (let k = 0; k < 9; k++) box(-w / 2 + 1.0, 2.2, 1.5 + k * 0.38, 0.04, 2.2, 0.04, mat(0x8a8e96, { metalness: 0.8 }));
      box(-w / 2 + 1.0, 3.32, 3, 0.1, 0.06, 3.2, mat(0x8a8e96, { metalness: 0.8 }));
      api.sign('PARTS COUNTER', 0x3cff8a, -w / 2 + 0.08, 4.0, 3, Math.PI / 2, 3.2, { h: 96 });
      api.sign((o.title || 'DEPOT').toUpperCase(), 0xffd040, 0, 5.6, -d / 2 + 0.06, 0, 5);
      api.person({ top: 0x3a5a3a, bottom: 0x2a3a2a, hair: 0x3a2a1a, hairStyle: 'cap', skin: 0x9a6a4a, accent: 0x3cff8a }, -w / 2 + 0.4, 3, -Math.PI / 2, (p, t) => idle(p, t, 1.3));
      // a forgotten stash behind the far crates (one-time find)
      for (let k = 0; k < 3; k++) box(w / 2 - 1.2 - k * 0.2, 0.45 + k * 0.85, -d / 2 + 1.6, 1.2, 0.85, 1.2, k % 2 ? crate : crate2); api.col(w / 2 - 1.3, -d / 2 + 1.6, 0.75, 0.75);
      const cs = box(w / 2 - 2.6, 0.22, -d / 2 + 1.9, 0.7, 0.4, 0.45, mat(0x2a2a30, { metalness: 0.6 })); const gl = box(w / 2 - 2.6, 0.43, -d / 2 + 1.9, 0.6, 0.03, 0.35, mat(0x3cff8a, { basic: true }));
      api.ticks.push(t => { const on = !(o.taken?.('depot-stash')); cs.visible = gl.visible = on; gl.material.color.setHSL(0.38, 1, 0.35 + Math.sin(t * 4) * 0.15); });
      api.spot({ id: 'counter', x: -w / 2 + 2.2, z: 3, r: 1.4, label: '🧾 Parts counter: full list', act: 'shop', venue: 'depot', who: o.qm || 'Dez' });
      api.spot({ id: 'stash', x: w / 2 - 2.6, z: -d / 2 + 2.9, r: 1.0, label: '📦 Search the crates', act: 'stash', stash: 'depot-stash', perm: 'maxammo', cond: () => !o.taken?.('depot-stash') });
    }
  },
  security: {
    name: 'Security office', w: 12, d: 9, h: 4.2, wall: 0x262c36, floor: 0x1a1e24, ceil: 0x101318, trim: 0x4a8aff, light: { color: 0xd8e4ff, int: 75 },
    build(api, o) {
      const { box, mat, d, w } = api, steel = mat(0x4a5260, { metalness: 0.6, roughness: 0.4 }), bars = mat(0x9aa2ae, { metalness: 0.9, roughness: 0.3 });
      api.sign((o.title || 'COLONY SECURITY').toUpperCase(), 0x4a8aff, 0, 3.4, -d / 2 + 0.1, 0, 3.6, { h: 96 });
      // the deputy's desk (Rusk sits behind it with his feet nearly up)
      box(0.8, 0.45, -1.8, 3.0, 0.9, 1.0, steel); box(0.8, 0.92, -1.8, 3.1, 0.04, 1.1, mat(0x2a2e36)); api.col(0.8, -1.8, 1.55, 0.55);
      box(1.6, 1.05, -1.9, 0.5, 0.25, 0.05, mat(0x8fe0ff, { basic: true })); box(0.2, 0.98, -1.7, 0.3, 0.08, 0.2, mat(0xc8a060));
      const rusk = api.person({ top: 0x3a4a6a, bottom: 0x23252b, hair: 0x5a4a3a, hairStyle: 'short', skin: 0xc68a64, accent: 0xffd040, shades: true, bulk: 1.2 }, 0.8, -2.8, 0, (p, t) => { sitPose(p); p.head.rotation.y = Math.sin(t * 0.3) * 0.4; p.arms[1].rotation.x = 1.1 + Math.sin(t * 0.8) * 0.1; });
      box(0.8, 0.25, -2.8, 0.6, 0.5, 0.6, mat(0x222222));
      // holding cell on the west side
      for (let k = 0; k < 8; k++) box(-2.6, 1.6, -d / 2 + 0.4 + k * 0.42, 0.05, 3.2, 0.05, bars); box(-2.6, 3.2, -d / 2 + 1.9, 0.08, 0.08, 3.4, bars); api.col(-2.6, -d / 2 + 1.9, 0.1, 1.9);
      box(-w / 2 + 0.8, 0.3, -d / 2 + 1.2, 1.2, 0.5, 2.0, mat(0x30343a));
      api.person({ top: 0x5a4a3a, bottom: 0x3a3028, hair: 0x241a12, hairStyle: 'long', skin: 0x9a6a4a }, -w / 2 + 0.9, -d / 2 + 1.8, Math.PI / 2, (p, t) => { sitPose(p); p.head.rotation.x = 0.4; });
      // wanted board + a second deputy by the door
      api.sign('WANTED', 0xff4a4a, w / 2 - 0.08, 2.6, -1.4, -Math.PI / 2, 2.2, { h: 96 });
      for (let k = 0; k < 4; k++) box(w / 2 - 0.06, 1.7, -2.6 + k * 0.8, 0.03, 0.8, 0.6, mat(0xe8e0c8));
      api.person({ top: 0x3a4a6a, bottom: 0x23252b, hairStyle: 'cap', skin: 0x7a5236, accent: 0x4a8aff }, w / 2 - 1.4, 2.6, -Math.PI / 2 - 0.4, (p, t) => guard(p, t));
      // v7.5: who sits at the desk comes from the district (Rusk at Ares Junction, Vale downtown, Porter at the Helios gate)
      const who = o.talk || o.desk || 'Rusk', short = who.replace(/^(Deputy|Detective|Captain|Mr\.|Ms\.)\s+/, '');
      if (o.bribe !== false && who === 'Rusk') api.spot({ id: 'bribe', x: 0.2, z: -1.2, r: 1.25, label: '💰 Pay off Deputy Rusk', act: 'bribe', who: 'Rusk' });
      api.spot({ id: 'talk', x: 1.8, z: -0.7, r: 0.9, label: '💬 ' + short, act: 'talk', who });
    }
  },
  club: {
    name: 'The Velvet Airlock', w: 22, d: 16, h: 6.5, wall: 0x241430, floor: 0x120c16, ceil: 0x0c0810, trim: 0xff3cc8, light: { color: 0xff50d0, int: 60, pulse: true }, music: 'club', cover: 20,
    build(api, o) {
      const { box, mat, d, w } = api, velvet = mat(0x5a0a2a, { roughness: 0.9 }), chrome = mat(0xc0c4cc, { metalness: 0.9, roughness: 0.2 }), black = mat(0x0c0a10, { roughness: 0.5 });
      // stage (north), light pillars at its corners, an LED wall behind it
      box(0, 0.35, -6.2, 10, 0.7, 3.4, black); box(0, 0.72, -4.48, 10, 0.06, 0.08, mat(0xff3cc8, { basic: true })); api.col(0, -6.2, 5.0, 1.7, 'stage');
      for (const s of [-1, 1]) for (const z of [-7.6, -4.7]) box(s * 4.8, 3.2, z, 0.16, 5, 0.16, mat(0x7af0ff, { basic: true }));
      const led = box(0, 3.6, -d / 2 + 0.1, 10, 4.6, 0.06, mat(0x6020a0, { basic: true }));
      api.sign('THE VELVET AIRLOCK', 0xff3cc8, 0, 5.75, -d / 2 + 0.16, 0, 7.5, { w: 1024, h: 160, font: 'bold 96px system-ui, sans-serif' });
      // v7.4: three pole dancers (v7.5.x: realistic models in bikinis and boots, clubdancers.js), rotating pole routines
      const looks = [
        { top: 0xc8a0ff, bottom: 0xc8a0ff, shoes: 0xe8e8f0, hair: 0xf0e0a0, hairStyle: 'long', skin: 0xe8b894, accent: 0x7af0ff, glow: 0x8040ff },
        { top: 0xff4a8a, bottom: 0x1a1a24, shoes: 0x1a1a24, hair: 0x101010, hairStyle: 'bun', skin: 0x8a5a3a, accent: 0xffd040, glow: 0xff2060 },
        { top: 0x40e0d0, bottom: 0x40e0d0, shoes: 0xd0d0d8, hair: 0xff5a2a, hairStyle: 'long', skin: 0xc68a64, accent: 0xff3cc8, glow: 0x20a0a0 }
      ];
      const stageY = 0.7;
      const poleM = chrome, poles = [[-2.8, -6.0], [0, -6.6], [2.8, -6.0]];
      poles.forEach(([x, z]) => { box(x, (stageY + api.h) / 2, z, 0.07, api.h - stageY, 0.07, poleM); box(x, stageY + 0.03, z, 0.6, 0.05, 0.6, mat(0xff3cc8, { basic: true })); });
      const dancers = poles.map(([x, z], i) => api.person(looks[i], x, z, 0, (p, t, k) => poleDance(p, t, k, x, z, stageY), i));
      ['rhea', 'danny', 'kiara'].forEach((n, i) => dress(api, dancers[i], { dancer: n, outfit: n === 'danny' ? 'stage' : 'bikini', k: i })); // v7.5.x realistic dancers (lazy GLBs, blocky fallback)
      api.sign('LIVE ON STAGE', 0x7af0ff, -w / 2 + 0.06, 3.6, -1.2, Math.PI / 2, 3.6, { h: 96 });
      // make it rain: credit chits flutter down over the stage (one instanced pool, parked off-stage when idle)
      const chitM = new THREE.MeshBasicMaterial({ color: 0x7dff9a, side: THREE.DoubleSide }); api.disposables.push(chitM);
      const NCH = 48, chits = new THREE.InstancedMesh(G.box, chitM, NCH), cs = []; const q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(0.22, 0.01, 0.11), pv = new THREE.Vector3();
      for (let i = 0; i < NCH; i++) cs.push({ x: 0, y: -9, z: 0, vy: 0, r: 0, live: false });
      chits.frustumCulled = false; api.g.add(chits); let rainT = 0;
      api.rain = (n = 24) => { let c = 0; for (const ch of cs) { if (c >= n) break; if (ch.live) continue; ch.live = true; ch.x = (Math.random() - 0.5) * 8; ch.z = -6.2 + (Math.random() - 0.5) * 2.6; ch.y = 2.4 + Math.random() * 1.6; ch.vy = -0.6 - Math.random() * 0.6; ch.r = Math.random() * 6; c++; } rainT = 4; dancers.forEach(d => d.cheer = 1.5); return c; };
      api.ticks.push((t, dt = 0.016) => {
        for (let i = 0; i < NCH; i++) { const ch = cs[i]; if (ch.live) { ch.y += ch.vy * dt; ch.r += dt * 4; ch.x += Math.sin(ch.r) * dt * 0.3; if (ch.y < stageY + 0.03) { ch.y = stageY + 0.03; if (rainT <= 0) ch.live = false; } } e3.set(ch.live ? Math.sin(ch.r) * 0.6 : 0, ch.r, 0); m4.compose(pv.set(ch.x, ch.live ? ch.y : -9, ch.z), q.setFromEuler(e3), sc); chits.setMatrixAt(i, m4); }
        chits.instanceMatrix.needsUpdate = true; rainT -= dt;
      });
      api.spot({ id: 'tip', x: 0, z: -3.9, r: 1.5, label: '💸 Tip · 20 cr', act: 'tip' });
      // dance floor: one instanced grid, colours chase to the beat
      const tiles = new THREE.InstancedMesh(G.box, new THREE.MeshBasicMaterial({ color: 0xffffff }), 24); api.disposables.push(tiles.material);
      const m4 = new THREE.Matrix4(), cc = new THREE.Color();
      for (let i = 0; i < 24; i++) { const tx = -5 + (i % 6) * 2, tz = -3 + Math.floor(i / 6) * 1.6; m4.compose(new THREE.Vector3(tx, 0.01, tz), new THREE.Quaternion(), new THREE.Vector3(1.9, 0.02, 1.5)); tiles.setMatrixAt(i, m4); tiles.setColorAt(i, cc.setHex(0x222222)); }
      api.g.add(tiles);
      // mirror ball and sweeping beams
      const ball = api.mk(G.sph, chrome, 0, d ? 5.6 : 5.6, -1, 0.45); api.g.add(ball);
      const beamM = new THREE.MeshBasicMaterial({ color: 0xff60e0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); api.disposables.push(beamM);
      const beams = [0x7af0ff, 0xff60e0, 0xffd040, 0x9a60ff].map((c, i) => { const m = beamM.clone(); m.color.setHex(c); api.disposables.push(m); const b = new THREE.Mesh(G.cone, m); b.geometry = G.cone; const piv = new THREE.Group(); piv.position.set(-6 + i * 4, 6.3, -2); b.position.y = -2.6; b.scale.set(1.1, 5.2, 1.1); piv.add(b); api.g.add(piv); return piv; });
      // bar on the west wall
      box(-w / 2 + 1.6, 0.55, 1.5, 0.9, 1.1, 8, black); box(-w / 2 + 1.6, 1.13, 1.5, 1.1, 0.08, 8.2, mat(0x9a2a6a, { roughness: 0.3 })); box(-w / 2 + 2.08, 0.12, 1.5, 0.04, 0.05, 8, mat(0xff3cc8, { basic: true })); api.col(-w / 2 + 1.6, 1.5, 0.6, 4.1);
      bottles(api, -2.2, 5.2, 1.7, -w / 2 + 0.25, 2, 1);
      api.person({ top: 0x101010, bottom: 0x101010, hair: 0xd0d0d0, hairStyle: 'short', skin: 0xc68a64, accent: 0xff3cc8 }, -w / 2 + 0.75, 1.0, -Math.PI / 2, (p, t) => wipe(p, t));
      // booths on the east side
      for (const z of [3.2, 6.0]) { box(w / 2 - 0.6, 0.45, z, 0.9, 0.9, 2.2, velvet); box(w / 2 - 0.25, 1.0, z, 0.3, 1.2, 2.2, velvet); box(w / 2 - 1.7, 0.6, z, 0.9, 0.06, 1.2, chrome); api.col(w / 2 - 1.0, z, 1.0, 1.15); }
      // patrons
      const pl = [[-3, 0.8, 0], [2.2, 1.2, 1], [-0.6, -1.4, 2], [4.2, -0.8, 3], [-w / 2 + 2.6, 3.4, 4], [w / 2 - 0.9, 3.2, 5]];
      const pc = [0x3a4a8a, 0x8a3a3a, 0x2a6a4a, 0x6a5a2a, 0x4a2a6a, 0x2a2a2a], ph = [0x2a1a10, 0xd0b070, 0x101010, 0x6a3a1a, 0xc04040, 0x101010];
      pl.forEach(([x, z, i]) => { const seat = i === 5; const yaw = i === 4 ? Math.PI / 2 : seat ? Math.PI / 2 : Math.PI + (i - 2) * 0.2; api.person({ top: pc[i], bottom: 0x1a1a22, hair: ph[i], hairStyle: ['short', 'long', 'cap', 'mohawk', 'bun', 'short'][i], skin: [0xc68a64, 0xe8c0a0, 0x6a4028, 0xb07a54, 0xe0b090, 0x8a5a3a][i] }, x, z, yaw, seat ? (p) => sitPose(p) : i === 4 ? (p, t, k) => drink(p, t, k) : (p, t, k) => bob(p, t, k), i * 0.9); });
      // VIP back room (north-east): partition walls, a velvet rope, the bouncer, the owner on a couch
      const vipW = mat(0x1a0c22), X0 = 6, X1 = w / 2, Z0 = -d / 2, Z1 = -1.2, ropeX = 8.3;
      box(X0, api.h / 2, (Z0 + Z1) / 2, 0.2, api.h, Z1 - Z0, vipW); api.col(X0, (Z0 + Z1) / 2, 0.15, (Z1 - Z0) / 2, 'wall');
      box((X0 + ropeX - 0.8) / 2, api.h / 2, Z1, ropeX - 0.8 - X0, api.h, 0.2, vipW); api.col((X0 + ropeX - 0.8) / 2, Z1, (ropeX - 0.8 - X0) / 2, 0.15, 'wall');
      box((ropeX + 0.8 + X1) / 2, api.h / 2, Z1, X1 - ropeX - 0.8, api.h, 0.2, vipW); api.col((ropeX + 0.8 + X1) / 2, Z1, (X1 - ropeX - 0.8) / 2, 0.15, 'wall');
      box(ropeX, (api.h + 2.6) / 2, Z1, 1.6, api.h - 2.6, 0.2, vipW);
      const rope = new THREE.Group(); rope.add(api.mk(G.cyl, chrome, ropeX - 0.75, 0.5, Z1, 0.05, 1.0, 0.05), api.mk(G.cyl, chrome, ropeX + 0.75, 0.5, Z1, 0.05, 1.0, 0.05), api.mk(G.box, velvet, ropeX, 0.85, Z1, 1.5, 0.07, 0.07)); api.g.add(rope);
      const ropeCol = api.col(ropeX, Z1, 0.8, 0.2, 'rope');
      api.sign('VIP', 0xffd040, ropeX, 3.1, Z1 + 0.12, 0, 1.6, { w: 256, h: 64, font: 'bold 50px system-ui, sans-serif' });
      api.sign('HANDS OFF THE TALENT', 0x7af0ff, -w / 2 + 0.06, 3.6, -4.5, Math.PI / 2, 4.2, { h: 96 });
      api.person({ top: 0x18181c, bottom: 0x18181c, hair: 0x0a0a0a, hairStyle: 'bald', skin: 0x5a3a24, shades: true, bulk: 1.3, size: 1.08 }, ropeX + 1.3, Z1 + 0.7, Math.PI * 0.85, (p, t) => guard(p, t));
      // inside the VIP room
      box(X1 - 0.6, 0.45, -4.6, 0.9, 0.9, 3.4, velvet); box(X1 - 0.25, 1.05, -4.6, 0.3, 1.3, 3.4, velvet); api.col(X1 - 0.6, -4.6, 0.5, 1.75);
      box(X1 - 2.0, 0.42, -4.6, 1.0, 0.06, 1.6, chrome); box(X1 - 2.0, 0.2, -4.6, 0.1, 0.4, 0.1, chrome); api.col(X1 - 2.0, -4.6, 0.55, 0.85);
      box(X1 - 2.0, 0.5, -4.3, 0.08, 0.12, 0.08, mat(0xffd040, { basic: true }));
      api.person({ top: 0x2a0a18, bottom: 0x2a0a18, shoes: 0x0a0a0a, hair: 0xe8e8f0, hairStyle: 'bun', skin: 0xd8a888, accent: 0xffd040 }, X1 - 0.75, -4.6, Math.PI / 2, (p, t) => { sitPose(p); p.arms[1].rotation.x = 1.1 + Math.sin(t * 0.7) * 0.15; p.head.rotation.y = Math.sin(t * 0.3) * 0.3; });
      api.person({ top: 0x22222a, bottom: 0x22222a, hair: 0x3a2a1a, hairStyle: 'short', skin: 0xb07a54, shades: true, bulk: 1.2 }, X1 - 0.5, Z0 + 0.5, Math.PI * 0.75, (p, t) => guard(p, t));
      // v7.4 private dance: a little round stage with its own pole and a club chair facing it. Paid dances are one song, costumed, hands off.
      const PX = X0 + 1.6, PZ = -6.6;
      box(PX, 0.12, PZ, 1.5, 0.24, 1.5, black); box(PX, 0.26, PZ, 1.3, 0.04, 1.3, mat(0xffd040, { basic: true })); box(PX, (0.24 + api.h) / 2, PZ, 0.06, api.h - 0.24, 0.06, chrome); api.col(PX, PZ, 0.8, 0.8);
      box(PX, 0.25, PZ + 2.1, 0.8, 0.5, 0.8, velvet); box(PX, 0.75, PZ + 2.45, 0.8, 0.6, 0.15, velvet);
      let privT = 0; const prvLook = { top: 0x1a1a2a, bottom: 0x1a1a2a, shoes: 0xc0c4cc, hair: 0x2a0a3a, hairStyle: 'long', skin: 0xc8946c, accent: 0xff3cc8, glow: 0xa040ff };
      const prv = api.person(prvLook, PX, PZ, 0, (p, t, k, y, dt = 0.016) => { if (privT > 0) { privT -= dt; poleDance(p, t, 3, PX, PZ, 0.24); } else { idle(p, t, 2); p.group.position.set(PX + 0.45, 0.24, PZ + 0.3); p.group.rotation.y = 0.3; p.arms[0].rotation.z = 2.4; } });
      dress(api, prv, { dancer: 'danny', outfit: 'crop', k: 3, cardigan: () => privT <= 0 }); // cardigan on between songs
      api.sign(DANNY_NAME.toUpperCase(), 0xff7eb8, X0 + 0.12, 3.0, PZ, Math.PI / 2, 2.2, { w: 512, h: 96, font: 'bold 60px system-ui, sans-serif' });
      api.privateDance = (sec = 9) => { privT = sec; return sec; };
      api.spot({ id: 'private', x: PX, z: PZ + 1.5, r: 0.9, label: '💃 Dance · 50 cr', act: 'private', who: DANNY_NAME });
      // v7.5.4 private show: talk to Danny for her upstairs booth (privateshow.js; adults only, costumed, hands off)
      const booth = addBooth(api, { x: PX, z: PZ, sit: sitPose });
      try { addDancerSpots?.(api, { booth, dancers: [{ id: 'rhea', x: poles[0][0], z: -4.0 }, { id: 'kiara', x: poles[2][0], z: -4.0 }] }); } catch (e) { console.warn('clubprivate spots', e); } // v7.6 (clubprivate.js)
      api.spot({ id: 'show', x: PX - 1.05, z: PZ + 1.3, r: 0.6, label: `💋 ${DANNY_NAME.split(' ')[0]} · Private show 150`, act: 'show', who: DANNY_NAME });
      // v7.4 upstairs: a door in the back wall and its host. Adults only; the game fades to black and never shows or describes anything.
      const UX = X1 - 1.6;
      box(UX, 1.3, Z0 + 0.08, 1.4, 2.6, 0.08, mat(0x3a0a20, { roughness: 0.6 })); box(UX, 2.66, Z0 + 0.1, 1.5, 0.08, 0.08, mat(0xffd040, { basic: true }));
      api.sign('UPSTAIRS · PRIVATE', 0xffd040, UX, 3.2, Z0 + 0.14, 0, 2.4, { w: 512, h: 72, font: 'bold 40px system-ui, sans-serif' });
      api.person({ top: 0x0e0e14, bottom: 0x0e0e14, shoes: 0x0a0a0a, hair: 0xb02030, hairStyle: 'bun', skin: 0xe0b090, accent: 0xffd040, size: 1.02 }, UX - 0.9, Z0 + 0.9, Math.PI * 0.85, (p, t) => { idle(p, t, 4); p.arms[1].rotation.x = 0.35; });
      api.spot({ id: 'upstairs', x: UX - 0.6, z: Z0 + 1.9, r: 0.9, label: '🚪 Upstairs · 150', act: 'companion', who: 'Sable' });
      const lb = box(X0 + 0.5, 0.25, Z1 - 0.9, 0.4, 0.4, 0.6, mat(0x3a2a10, { metalness: 0.6 })), lg = box(X0 + 0.5, 0.46, Z1 - 0.9, 0.3, 0.03, 0.5, mat(0xffd040, { basic: true }));
      api.ticks.push(t => { const on = !(o.taken?.('club-lockbox')); lb.visible = lg.visible = on; });
      api.spot({ id: 'vip', x: ropeX, z: Z1 + 1.0, r: 1.5, label: '🍾 VIP room', act: 'vip', who: 'Tiny', cond: () => ropeCol.on });
      api.spot({ id: 'owner', x: X1 - 2.3, z: -3.4, r: 1.3, label: '💬 ' + (o.owner || 'Ines'), act: 'talk', who: o.owner || 'Ines' });
      if ((o.owner || 'Ines') === 'Ines') api.spot({ id: 'jobs', x: X1 - 3.6, z: -1.6, r: 1.0, label: '📋 Ines\u2019s job board', act: 'jobs', who: 'Ines', cond: () => !!(o.vipNow ? o.vipNow() : o.vip) }); // v7.5 VIP hub
      api.spot({ id: 'stash', x: X0 + 1.0, z: Z1 - 1.0, r: 0.8, label: '📦 Lockbox', act: 'stash', stash: 'club-lockbox', perm: 'maxhp', cond: () => !o.taken?.('club-lockbox') });
      api.spot({ id: 'bar', x: -w / 2 + 2.9, z: 1.5, r: 2.0, label: '🍸 Bar: drinks & rumors', act: 'shop', venue: 'bar', who: 'Bartender' });
      api.openRope = () => { ropeCol.on = false; rope.visible = false; };
      if (o.vip) api.openRope();
      // light show
      api.ticks.push((t) => {
        const beat = t * 118 / 60, bi = Math.floor(beat);
        for (let i = 0; i < 24; i++) { const k = (i + bi + ((i % 6) + Math.floor(i / 6)) * (bi % 2)) % 6; tiles.setColorAt(i, cc.setHSL((k / 6 + t * 0.02) % 1, 1, (i + bi) % 3 === 0 ? 0.55 : 0.22)); }
        tiles.instanceColor.needsUpdate = true;
        led.material.color.setHSL((0.78 + Math.sin(t * 0.3) * 0.1) % 1, 0.9, 0.18 + 0.08 * Math.max(0, Math.sin(beat * Math.PI)));
        ball.rotation.y = t * 0.8;
        beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.7 + i * 1.7) * 0.6; b.rotation.x = Math.cos(t * 0.5 + i) * 0.4; });
      });
    }
  }
};
// v7.5 Mars city interiors
INTERIORS.bank = {
  name: 'Bank', w: 18, d: 14, h: 6, wall: 0x2c2a26, floor: 0x3a3630, ceil: 0x1c1a18, trim: 0xffd040, light: { color: 0xfff0d0, int: 95 },
  build(api, o) {
    const { box, mat, d, w } = api, marble = mat(0xd8d0c0, { roughness: 0.35 }), brass = mat(0xc8a040, { metalness: 0.8, roughness: 0.3 }), steel = mat(0x5a6270, { metalness: 0.85, roughness: 0.3 }), glassM = mat(0x9fd8ff, { transparent: true, opacity: 0.25 });
    api.sign((o.title || 'FIRST JUNCTION TRUST').toUpperCase().slice(0, 28), 0xffd040, 0, 4.6, -d / 2 + 0.1, 0, 6, { h: 96 });
    // marble columns + teller counter with glass partitions
    for (const x of [-6, 6]) for (const z of [0.5, 3.5]) { box(x, 3, z, 0.7, 6, 0.7, marble); api.col(x, z, 0.4, 0.4, 'tall'); }
    box(-1, 0.6, -2.2, 10, 1.2, 0.9, marble); box(-1, 1.22, -2.2, 10.2, 0.05, 1.0, brass); api.col(-1, -2.2, 5.1, 0.5);
    for (let k = 0; k < 4; k++) { box(-5 + k * 2.6, 2, -2.2, 0.04, 1.5, 0.9, glassM); }
    box(-1, 2.8, -2.2, 10.2, 0.08, 0.9, brass);
    const teller = o.teller || o.talk || 'Mr. Kline';
    api.person({ top: 0x2a2a34, bottom: 0x1e1e24, hair: 0x8a8a8a, hairStyle: 'short', skin: 0xd8b090, accent: 0xffd040, shades: false }, -2.4, -3.2, 0, (p, t) => idle(p, t, 0.4));
    api.person({ top: 0x3a3440, bottom: 0x1e1e24, hair: 0x3a2412, hairStyle: 'long', skin: 0x9a6a4a }, 1.6, -3.2, 0, (p, t) => idle(p, t, 1.9));
    api.person({ top: 0x2a3a5a, bottom: 0x1e2228, hairStyle: 'cap', skin: 0x7a5236, accent: 0x4a8aff, bulk: 1.2 }, w / 2 - 1.4, 3.6, -Math.PI / 2 - 0.3, (p, t) => guard(p, t)); // lobby guard
    // waiting benches
    for (const z of [2, 4]) { box(-w / 2 + 1.6, 0.4, z, 2.4, 0.15, 0.6, mat(0x5a3a24)); api.col(-w / 2 + 1.6, z, 1.2, 0.3); }
    // the vault: round door in the north-east corner behind the counter
    const vx = w / 2 - 2.6, vz = -d / 2 + 0.35;
    box(vx, 2.2, vz, 3.6, 4.4, 0.5, steel);
    const door = api.mk(api.G.cyl, steel, vx, 2.0, vz + 0.4, 1.5, 0.35, 1.5); door.rotation.x = Math.PI / 2; api.g.add(door);
    for (let k = 0; k < 6; k++) { const sp = api.mk(api.G.box, brass, vx + Math.cos(k * 1.047) * 1.0, 2.0 + Math.sin(k * 1.047) * 1.0, vz + 0.62, 0.12, 0.12, 0.2); api.g.add(sp); }
    const wheel = api.mk(api.G.cyl, brass, vx, 2.0, vz + 0.62, 0.45, 0.12, 0.45); wheel.rotation.x = Math.PI / 2; api.g.add(wheel);
    api.ticks.push((t) => { const open = !!o.cracked?.('bank-vault'); door.rotation.y = open ? -1.3 : 0; door.position.x = vx + (open ? -1.2 : 0); wheel.visible = !open; wheel.rotation.y = t * (o.heist?.() ? 2 : 0); });
    api.col(vx, vz + 0.3, 1.9, 0.5, 'wall');
    api.sign('VAULT', 0xff4a4a, vx, 4.7, vz + 0.3, 0, 1.8, { h: 90 });
    api.spot({ id: 'teller', x: -2.4, z: -1.2, r: 1.1, label: '💬 ' + teller, act: 'talk', who: teller });
    api.spot({ id: 'vault', x: vx, z: vz + 1.4, r: 1.1, label: '🔐 Crack the vault', act: 'crack', crack: 'bank-vault', difficulty: 3, cond: () => !!o.heist?.() && !o.cracked?.('bank-vault') });
  }
};
INTERIORS.mansion = {
  name: 'Mansion', w: 20, d: 15, h: 5.5, wall: 0xe8e2d6, floor: 0x5a4a3a, ceil: 0xf0ece4, trim: 0x30e0d0, light: { color: 0xfff4e0, int: 85 },
  build(api, o) {
    const { box, mat, d, w } = api, sofa = mat(0xb8b0a0, { roughness: 0.9 }), wood = mat(0x4a3424), gold = mat(0xd0b060, { metalness: 0.8, roughness: 0.3 }), art = mat(0x2a6a8a, { basic: true }), safeM = mat(0x2a2e34, { metalness: 0.8, roughness: 0.3 });
    api.sign((o.title || 'PRIVATE RESIDENCE').toUpperCase().slice(0, 26), 0x30e0d0, 0, 4.2, -d / 2 + 0.1, 0, 5, { h: 96 });
    // living room: sofas, low table, a rug, art on the walls, a window to the Mars sky (emissive panel)
    box(-3, 0.02, 0.5, 7, 0.03, 4.5, mat(0x7a2a2a, { roughness: 1 }));
    box(-3, 0.45, -1.4, 4.4, 0.9, 1.0, sofa); api.col(-3, -1.4, 2.2, 0.5); box(-3, 0.45, 2.6, 4.4, 0.9, 1.0, sofa); api.col(-3, 2.6, 2.2, 0.5);
    box(-3, 0.3, 0.6, 2.2, 0.08, 1.2, wood); box(-3, 0.15, 0.6, 0.2, 0.3, 0.2, wood); api.col(-3, 0.6, 1.1, 0.6);
    box(0, 2.8, -d / 2 + 0.06, 8, 2.6, 0.05, mat(0xd07040, { basic: true }));
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) box(x, 2.4, -1, 0.05, 1.4, 2, art);
    // bar cart + a statue
    box(w / 2 - 1.5, 0.5, 3.5, 1.2, 1.0, 0.6, gold); api.col(w / 2 - 1.5, 3.5, 0.6, 0.3);
    box(5, 0.5, -4, 0.8, 1.0, 0.8, mat(0xe8e8e8)); box(5, 1.6, -4, 0.5, 1.2, 0.5, gold); api.col(5, -4, 0.45, 0.45, 'tall');
    // the study: a wall safe behind a painting in the north-west corner
    const sx = -w / 2 + 1.6, sz = -d / 2 + 0.25;
    const painting = box(sx, 1.9, sz + 0.05, 1.4, 1.1, 0.06, art);
    const safe = box(sx, 1.9, sz, 0.9, 0.9, 0.3, safeM); const dial = api.mk(api.G.cyl, gold, sx, 1.9, sz + 0.18, 0.18, 0.06, 0.18); dial.rotation.x = Math.PI / 2; api.g.add(dial);
    api.ticks.push((t) => { const open = !!o.cracked?.(o.safeId || 'mansion-safe'); painting.position.x = sx + (o.heist?.() || open ? 1.4 : 0); dial.rotation.y = open ? 1.6 : t * 0.3; safe.visible = true; });
    const owner = o.owner || o.talk;
    if (owner && !o.away) api.person({ top: 0xe8e2d6, bottom: 0x3a3a44, hair: 0xd8c8a0, hairStyle: 'long', skin: 0xd8b090, accent: 0x30e0d0 }, 2, 2, Math.PI, (p, t) => idle(p, t, 2.1));
    api.person({ top: 0xe8ecef, bottom: 0xd8dce0, hairStyle: 'cap', skin: 0x7a5236, accent: 0x30e0d0, bulk: 1.2 }, w / 2 - 2, -3, -Math.PI / 2, (p, t) => guard(p, t)); // house security
    if (owner && !o.away) api.spot({ id: 'owner', x: 2, z: 3.2, r: 1.1, label: '💬 ' + owner, act: 'talk', who: owner });
    api.spot({ id: 'safe', x: sx + 0.6, z: sz + 1.3, r: 1.0, label: '🔐 Crack the safe', act: 'crack', crack: o.safeId || 'mansion-safe', difficulty: o.difficulty || 2, cond: () => !o.cracked?.(o.safeId || 'mansion-safe') });
  }
};
export function registerInterior(kind, def) { if (!kind || !def?.build) throw new Error('registerInterior(kind, { name, w, d, h, build(api, opts) })'); INTERIORS[kind] = { w: 12, d: 10, h: 4.5, light: { color: 0xffe0c0, int: 50 }, ...def }; return kind; }

// build a room for a door. Returns { kind, def, group, cols, spots, tick(dt), collide(lx,lz,r), nearSpot(lx,lz), dispose() }
export function buildRoom(kind, opts = {}) {
  const def = INTERIORS[kind]; if (!def) return null;
  const api = roomKit(def); def.build(api, opts);
  let t = 0, wt = 0;
  const targets = []; for (const w of api.wares) { w.m.traverse(c => { if (c.isMesh) targets.push(c); }); targets.push(w.tag); }
  return {
    kind, def, group: api.g, cols: api.cols, spots: api.spots, w: def.w, d: def.d, h: def.h, openRope: () => api.openRope?.(), rain: n => api.rain?.(n), privateDance: s => api.privateDance?.(s),
    wares: api.wares, targets, refresh() { wareTick(api, opts); },
    tick(dt) { t += dt; for (const f of api.ticks) f(t, dt); if ((wt += dt) > 0.4) { wt = 0; wareTick(api, opts); } },
    camBlocked(x, y, z) { for (const c of api.cols) if (c.on && y < c.h && Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd) return true; return false; }, // room-local, y above the floor
    collide(x, z, r) {
      let hit = false;
      const ex = def.w / 2 - r, ez = def.d / 2 - r;
      if (x < -ex) { x = -ex; hit = true; } if (x > ex) { x = ex; hit = true; } if (z < -ez) { z = -ez; hit = true; } if (z > ez) { z = ez; hit = true; }
      for (const c of api.cols) {
        if (!c.on) continue; const dx = x - c.x, dz = z - c.z, hx = c.hw + r, hz = c.hd + r;
        if (Math.abs(dx) < hx && Math.abs(dz) < hz) { hit = true; if (hx - Math.abs(dx) < hz - Math.abs(dz)) x = c.x + Math.sign(dx || 1) * hx; else z = c.z + Math.sign(dz || 1) * hz; }
      }
      return hit ? { x, z } : null;
    },
    nearSpot(x, z) { let best = null, bd = 1e9; for (const s of api.spots) { if (s.cond && !s.cond()) continue; const dd = Math.hypot(s.x - x, s.z - z), w = dd + (s.act === 'leave' ? 0.9 : 0); if (dd < s.r && w < bd) { bd = w; best = s; } /* v7.5.1 (m8): the door spot loses ties to anything else in range */ } return best; },
    dispose() { api.disposables.forEach(o => o.dispose?.()); api.g.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); }
  };
}
