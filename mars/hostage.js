// Hostage (Pumpkin): snatch a rival gang lieutenant in Red Tape Flats and haul him to Frostbite Benny's lane on the
// Planum Australe ice cap, where he becomes the head pin (SSX.icecap.bringRival). Cartoon violence only: punches put
// stars round his head, a bumper sends him tumbling, nothing red ever splashes.
//
// Loop: a lieutenant hangs about his citydata gang spot (hostagecore ROSTER) -> walk up and he runs -> punch / shoot
// him down (birdies) or stay on his heels until he's cornered (hands up) -> 🪢 Grab (real tap) -> he's zip-tied and
// follows you on foot, rides across the trunk of whatever you drive, or dangles under your jetpack -> fast travel takes
// him along -> within 30 m of Benny: 🎳 Hand him over -> bringRival() + a finder's fee.
//
// No shared-file hooks beyond index.html (one script line) / sw.js (precache) / savecode.js (ssx.hostage.v1). Everything
// else is feature-detected at runtime: SSX.registerSurfaceTick, SSX.icecap, SSX.fastTravel, SSX.jetpack, SSX.hudx,
// SSX.minimap, SSX.city.choice, SSX.registerMenuItem, surface.world.{hitWorld,meleeWorld,meleeTarget,crime}.
// window.SSX.hostage = { state(), current(), roster(), grab(), deliver(), release(), subscribe(fn) }
// window.__hostage = test helpers
import * as THREE from 'three';
import * as C from './hostagecore.js';
import { buildHuman } from '../interiors.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game;
const KEY = 'ssx.hostage.v1', EYE = 1.7;
const log = [], subs = new Set();
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const toast = (t, ms = 2600) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } log.push(t); if (log.length > 60) log.shift(); };
const emit = (type, d = {}) => { for (const f of subs) { try { f({ type, ...d }); } catch (e) { /* */ } } try { window.SSX?.emit?.('hostage:' + type, d); } catch (e) { /* */ } };
const pick = a => a[Math.floor(Math.random() * a.length)];
const now = () => Date.now() / 1000;
const fmt = n => Math.round(n).toLocaleString('en-US');

// ---------- save ----------
let save = { held: null, back: {}, hauls: 0, freed: 0 };
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && typeof j === 'object') save = { ...save, ...j, back: { ...(j.back || {}) } }; } catch (e) { /* fresh */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* */ } };
function give(cr, stars) { const g = game(); if (!g?.progress) return; g.progress.credits += cr; g.progress.xp = (g.progress.xp || 0) + stars; tryv(() => g.save()); }

// ---------- state ----------
const S = { L: null, n: null, lastTc: null, prev: null, mode: 'foot', barkT: 4, view: null, simT: 0 };
let G = null, man = null, rope = null;
const byId = id => C.ROSTER.find(l => l.id === id) || null;
function onMars(tc) { const st = app()?.state; return !!st?.onSurface && !st.transitioning && tc?.name === 'Mars'; }
function flats(tc) { const c = tryv(() => tc.world.colony); const d = c?.districts?.find?.(x => x.id === C.FLATS_ID); return { d, c }; }
function homeOf(L, tc) { const { d, c } = flats(tc); return C.flatsWorld(L.spot, d, c); }
function benny() { const p = tryv(() => window.SSX?.icecap?.place?.()); return p && Number.isFinite(p.x) ? p : null; }
const hutId = () => tryv(() => { const s = window.SSX?.icecap?.state?.(); return s?.rivalState === 'hut' ? s.rival?.id : null; });

// ---------- 3D ----------
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function bubble(text, inv = false) {
  const tex = canvasTex(512, 150, (x, W, H) => { x.fillStyle = inv ? '#000' : '#fff'; x.strokeStyle = inv ? '#fff' : '#000'; x.lineWidth = 8; x.beginPath(); x.roundRect(6, 6, W - 12, H - 36, 24); x.fill(); x.stroke();
    if (!inv) { x.beginPath(); x.moveTo(W / 2 - 16, H - 32); x.lineTo(W / 2, H - 6); x.lineTo(W / 2 + 16, H - 32); x.fill(); }
    x.fillStyle = inv ? '#fff' : '#000'; x.textAlign = 'center'; x.textBaseline = 'middle'; let fs = 50; x.font = `900 ${fs}px system-ui,sans-serif`;
    while (x.measureText(text).width > W - 40 && fs > 20) { fs -= 2; x.font = `900 ${fs}px system-ui,sans-serif`; } x.fillText(text, W / 2, (H - 30) / 2 + 4); });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(2.5, 0.73, 1); sp.renderOrder = 11; return sp;
}
function stars() { const g = new THREE.Group(); const tex = canvasTex(64, 64, x => { x.fillStyle = '#ffe14a'; x.font = '900 56px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('\u2605', 32, 34); });
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.setScalar(0.3); s.userData.a = i * Math.PI / 2; g.add(s); } g.visible = false; return g; }
function build(tc) {
  G = new THREE.Group(); G.name = 'hostage'; tc.scene.add(G);
  const lm = new THREE.LineBasicMaterial({ color: 0xffffff }), lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
  rope = new THREE.Line(lg, lm); rope.visible = false; rope.frustumCulled = false; G.add(rope);
}
function model(L) {
  if (man?.lid === L?.id) return; if (man) { G.remove(man.group); man = null; } if (!L || !G) return;
  const h = buildHuman({ top: L.col || 0x555555, bottom: 0x1d1d22, skin: 0xb98260, hair: 0x18110b, hairStyle: L.id === 'deacon' ? 'bald' : L.id === 'jawbone' ? 'mohawk' : 'short', accent: 0x111111, shades: L.id === 'rusty', bulk: 1.08 });
  const ties = new THREE.Group(), tm = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 }); for (const y of [0.42, 0.62]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 6, 14), tm); t.rotation.x = Math.PI / 2; t.position.set(0, y, 0.2); ties.add(t); }
  ties.visible = false; h.group.add(ties); h.ties = ties; h.stars = stars(); h.stars.position.y = 1.95; h.group.add(h.stars);
  h.tag = bubble(`${L.name.toUpperCase()} \u00b7 ${L.gangName}`, true); h.tag.position.y = 2.75; h.tag.scale.set(2.3, 0.67, 1); h.group.add(h.tag);
  h.lid = L.id; h.bub = null; h.bubT = 0; h.ph = 0; G.add(h.group); man = h;
}
function say(text, ms = 2200) { if (!man) return; if (man.bub) { man.group.remove(man.bub); man.bub.material.map.dispose(); man.bub.material.dispose(); } man.bub = bubble(text); man.bub.position.y = 2.2; man.group.add(man.bub); man.bubT = ms / 1000; if (man.tag) man.tag.visible = false; }
function reset(h) { h.hips.position.y = h.base; h.hips.rotation.set(0, 0, 0); h.torso.rotation.set(0, 0, 0); h.head.rotation.set(0, 0, 0); for (const a of h.arms) a.rotation.set(0, 0, 0); for (const l of h.legs) l.rotation.set(0, 0, 0); h.group.rotation.set(0, 0, 0); }
function pose(h, n, f, dt) {
  reset(h); h.ph += dt * 10; const s = Math.sin(h.ph), st = n.state; h.ties.visible = st === 'held'; h.stars.visible = st === 'down';
  if (h.stars.visible) for (const c of h.stars.children) { const a = c.userData.a + S.simT * 3; c.position.set(Math.cos(a) * 0.42, Math.sin(S.simT * 6 + c.userData.a) * 0.06, Math.sin(a) * 0.42); }
  if (st === 'flee') { for (let i = 0; i < 2; i++) { h.legs[i].rotation.x = (i ? 1 : -1) * s * 0.9; h.arms[i].rotation.x = (i ? -1 : 1) * s * 1.0; } h.torso.rotation.x = 0.25; }
  else if (st === 'hands') { for (const a of h.arms) a.rotation.x = Math.PI * 0.96; h.arms[0].rotation.z = -0.15; h.arms[1].rotation.z = 0.15; h.head.rotation.x = Math.sin(S.simT * 3) * 0.1; }
  else if (st === 'down') { h.hips.position.y = 0.45; for (const l of h.legs) l.rotation.x = 1.45; h.torso.rotation.x = -0.25; h.head.rotation.z = Math.sin(S.simT * 2.4) * 0.35; h.arms[0].rotation.z = -0.5; h.arms[1].rotation.z = 0.5; }
  else if (st === 'held') {
    const p = f?.pose || 'stand';
    if (p === 'dangle') { for (const a of h.arms) a.rotation.x = Math.PI; for (let i = 0; i < 2; i++) h.legs[i].rotation.x = Math.sin(S.simT * 9 + i * 3) * 0.6; }
    else { for (const a of h.arms) { a.rotation.x = -0.45; } h.arms[0].rotation.z = 0.25; h.arms[1].rotation.z = -0.25; if (p === 'hop') { const hop = Math.abs(Math.sin(h.ph * 0.7)); h.hips.position.y = h.base + hop * 0.22; for (const l of h.legs) l.rotation.x = -hop * 0.3; } }
  } else { h.head.rotation.y = Math.sin(S.simT * 0.6) * 0.5; h.arms[1].rotation.x = 1.6 + Math.sin(S.simT * 0.8) * 0.1; h.arms[1].rotation.z = 0.3; } // idle: chatting on a phone-brick
  if (h.bubT > 0) { h.bubT -= dt; if (h.bubT <= 0 && h.bub) { h.group.remove(h.bub); h.bub.material.map.dispose(); h.bub.material.dispose(); h.bub = null; } }
  if (h.tag) h.tag.visible = !h.bub && st !== 'held';
}

// ---------- hits (world wrappers: bullets, fists, the melee snap) ----------
const patched = new WeakSet();
function hittable() { const n = S.n; return n && ['idle', 'flee', 'hands'].includes(n.state) && man?.group.visible ? n : null; }
function hurt(dmg, kind) {
  const n = S.n, r = C.hit(n, dmg); if (!r) return false;
  if (r === 'down') { say(pick(C.LINES.down), 2600); toast(`💫 ${S.L.name} sits down hard, birdies tweeting. 🪢 Grab him!`, 2600); emit('down', { id: n.id, kind }); }
  else { say(pick(C.LINES.hit), 1200); emit('hit', { id: n.id, kind, hp: n.hp }); }
  return true;
}
function patchWorld(w) {
  if (!w || patched.has(w)) return; patched.add(w);
  const oHit = w.hitWorld, oMT = w.meleeTarget, oMW = w.meleeWorld;
  if (typeof oHit === 'function') w.hitWorld = function (p0, p1, b) {
    const n = hittable(); if (n && p0 && p1) { const H = S.lastTc?.height, c = { x: n.x, y: (H ? H(n.x, n.z) : 0) + 1.1, z: n.z };
      const sx = p1.x - p0.x, sy = p1.y - p0.y, sz = p1.z - p0.z, L2 = sx * sx + sy * sy + sz * sz, t = L2 ? Math.max(0, Math.min(1, ((c.x - p0.x) * sx + (c.y - p0.y) * sy + (c.z - p0.z) * sz) / L2)) : 0;
      if (Math.hypot(p0.x + sx * t - c.x, p0.y + sy * t - c.y, p0.z + sz * t - c.z) < 0.8) { hurt(Math.min(2, (b?.dmg || 1) * 0.5), 'shot'); return true; } }
    return oHit.apply(this, arguments);
  };
  if (typeof oMT === 'function') w.meleeTarget = function (x, z, yaw, range) { const r = oMT.apply(this, arguments), n = hittable(); if (n && C.dist(n.x, n.z, x, z) < (range || 3) && (!r || C.dist(n.x, n.z, x, z) < C.dist(r.x, r.z, x, z))) return { x: n.x, z: n.z, kind: 'lieutenant' }; return r; };
  if (typeof oMW === 'function') w.meleeWorld = function (x, z, fx, fz, range, dmg) { const n = hittable(); if (n) { const dx = n.x - x, dz = n.z - z; if (Math.hypot(dx, dz) < range + 0.6 && dx * fx + dz * fz > -0.3) { hurt(dmg || 1, 'melee'); return true; } } return oMW.apply(this, arguments); };
}

// ---------- actions ----------
const res = (ok, msg) => ({ ok, msg });
function punch() { // the context-button punch (same as the game's fist, for when the attack button is a gun)
  const n = hittable(), p = S.lastTc?.player; if (!n || !p) return res(false, 'Nobody to punch.'); if (C.dist(n.x, n.z, p.x, p.z) > C.PUNCH_R + 0.4) return res(false, 'Get closer.');
  p.faceYaw = Math.atan2(-(n.x - p.x), -(n.z - p.z)); const big = (n.hits % 3) === 2; hurt(big ? 2 : 1, 'punch'); toast(big ? '👊 POW!' : '👊 Bop!', 700); return res(true, 'punch');
}
function grab() {
  const n = S.n, p = S.lastTc?.player; if (!n || !p) return res(false, 'Nobody to grab.');
  if (!C.grabbable(n, C.dist(n.x, n.z, p.x, p.z))) return res(false, n.state === 'flee' || n.state === 'idle' ? `${S.L.name} won\u2019t hold still. Knock him down or corner him.` : 'Get closer.');
  C.grab(n); save.held = n.id; persist(); say(pick(C.LINES.held), 2400);
  tryv(() => S.lastTc.world.crime?.(2, 'kidnapping a gang lieutenant'));
  const b = benny(); if (b) tryv(() => window.SSX?.hudx?.setWaypoint?.({ x: b.x, z: b.z, label: 'Frostbite Benny' }));
  toast(`🪢 Zip-tied ${S.L.name} (${S.L.gangName}). Haul him to Frostbite Benny on the ❄️ ice cap. Walk, drive or fast travel: he comes along.`, 3600);
  emit('grab', { id: n.id, name: S.L.name }); return res(true, 'grabbed');
}
function deliver() {
  const n = S.n, p = S.lastTc?.player, ic = window.SSX?.icecap; if (!n || n.state !== 'held') return res(false, 'You\u2019re not hauling anybody.');
  if (typeof ic?.bringRival !== 'function') return res(false, 'Benny\u2019s lane is shut. (No ice cap on this build.)');
  if (!p || !C.canDeliver(p, benny())) return res(false, 'Get him to Frostbite Benny\u2019s lane first.');
  const ok = tryv(() => ic.bringRival(C.captiveOf(S.L)), false); if (!ok) return res(false, 'Benny isn\u2019t taking him right now.');
  const L = S.L; save.held = null; save.hauls++; save.back = C.afterHaul(save.back, L.id, now(), 'delivered'); persist(); give(C.PAY.cr, C.PAY.stars);
  toast(`🎳 ${C.LINES.benny} +${C.PAY.cr} cr +${C.PAY.stars}★`, 4200); tryv(() => window.SSX?.hudx?.setWaypoint?.(null, true));
  S.n = null; S.L = null; if (man) { G.remove(man.group); man = null; } rope && (rope.visible = false);
  emit('deliver', { id: L.id, name: L.name, cr: C.PAY.cr }); return res(true, 'delivered');
}
function release() {
  const n = S.n; if (!n || n.state !== 'held') return res(false, 'You\u2019re not hauling anybody.');
  const L = S.L; save.held = null; save.freed++; save.back = C.afterHaul(save.back, L.id, now(), 'released'); persist();
  n.state = 'gone'; say('I\u2019ll remember this!', 1800); toast(`✋ You cut ${L.name} loose. ${C.LINES.free}`, 3000); tryv(() => window.SSX?.hudx?.setWaypoint?.(null, true));
  setTimeout(() => { if (S.n === n) { S.n = null; S.L = null; if (man) { G.remove(man.group); man = null; } } }, 1800);
  emit('release', { id: L.id }); return res(true, 'released');
}

// ---------- per-frame ----------
let markT = 0;
// roof height / half length of the ride, measured once per vehicle with its body unrotated (a buggy is low, the rover is tall)
const dims = new WeakMap();
function carDims(car) {
  let d = dims.get(car); if (d) return d; const g = car.group; d = { top: 1.05, back: 1.3 };
  if (g?.isObject3D) { const ry = g.rotation.y, p = g.position.clone(); g.rotation.y = 0; g.position.set(0, 0, 0); g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g); g.rotation.y = ry; g.position.copy(p); g.updateMatrixWorld(true);
    if (Number.isFinite(b.max.y)) d = { top: C.clamp(b.max.y, 0.6, 4), back: C.clamp(Math.max(b.max.z, -b.min.z) * 0.55, 0.8, 3.5) }; }
  dims.set(car, d); return d;
}
function hauler(tc) { const p = tc.player; if (tc.car) return 'car'; if (tryv(() => window.SSX?.jetpack?.flying) && (p.y - EYE - tc.height(p.x, p.z)) > 1.2) return 'jet'; return 'foot'; }
function tick(dt, tc) {
  S.simT += dt; attach(); hookMenu(); ui();
  if (!onMars(tc) || !tc.scene || !tc.player) { if (G) G.visible = false; S.prev = null; syncUi(null); return; }
  S.lastTc = tc; patchWorld(tc.world); const p = tc.player;
  if (!G || G.parent !== tc.scene) { G = null; man = null; build(tc); }
  G.visible = true;
  // who's out: the captive if you have one, else the next lieutenant on the street
  if (!S.n) {
    const held = save.held && byId(save.held);
    if (held) { S.L = held; S.n = C.fresh(held, { x: p.x + 1.6, z: p.z + 1.6 }); S.n.state = 'held'; }
    else { const L = C.pickActive(save.back, now(), hutId()); if (L) { S.L = L; S.n = C.fresh(L, homeOf(L, tc)); } }
  }
  const n = S.n, inside = !!tryv(() => tc.world.inside);
  if (!n) { S.prev = { x: p.x, z: p.z }; syncUi(tc); return; }
  model(S.L); const d = C.dist(n.x, n.z, p.x, p.z);
  if (n.state === 'held') {
    if (C.teleported(S.prev, p) || d > 60) { n.x = p.x + 1.6; n.z = p.z + 1.6; if (S.prev) toast(tc.car ? `🚗 ${S.L.name} rode along in the trunk.` : `🪢 ${S.L.name} came along, grumbling.`, 1800); }
    const mode = inside ? 'wait' : hauler(tc);
    if (mode !== S.mode) { if (mode === 'car') say(pick(C.LINES.car)); else if (mode === 'jet') say(pick(C.LINES.jet)); S.mode = mode; }
    if (mode !== 'wait') {
      const alt = tc.car ? tryv(() => surf().info.carAlt, 0) || 0 : 0, car = tc.car ? { x: tc.car.x, z: tc.car.z, yaw: tc.car.yaw, alt, ...carDims(tc.car) } : null;
      const f = C.follow(n, { x: p.x, z: p.z, y: p.y, alt: p.y - EYE - tc.height(p.x, p.z) }, mode, dt, car); n.x = f.x; n.z = f.z; n.yaw = f.yaw; n.f = f;
    }
    if ((S.barkT -= dt) <= 0) { S.barkT = 9 + Math.random() * 6; const b = benny(); say(b && C.dist(p.x, p.z, b.x, b.z) < 250 ? pick(C.LINES.cold) : pick(C.LINES.held)); }
  } else if (n.state !== 'gone') {
    const ev = C.step(n, p, dt, (x, z) => !!tryv(() => tc.world.solidAt?.(x, tc.height(x, z) + 1, z)));
    if (ev === 'notice') { say(pick(C.LINES.notice), 1800); toast(`🏃 ${S.L.name} (${S.L.gangName} lieutenant) bolts! Run him down, punch him, or corner him.`, 2800); emit('notice', { id: n.id }); }
    else if (ev === 'hands') { say(pick(C.LINES.hands), 2600); toast(`🙌 Cornered! ${S.L.name} throws his hands up. 🪢 Grab him!`, 2600); emit('hands', { id: n.id }); }
    else if (ev === 'up') { say('Okay, round two!', 1400); emit('up', { id: n.id }); }
    else if (ev === 'bolt') { say('Psych!', 1200); }
    if (tc.car && C.carHit(n, tryv(() => tc.car.speed, 0) || 0, C.dist(n.x, n.z, tc.car.x, tc.car.z))) { say('WHOA-OA-OA!', 2000); toast(`🚗 Bonk! ${S.L.name} cartwheels into the dust and sits there, dazed. Hop out and 🪢 grab him.`, 3000); emit('down', { id: n.id, kind: 'car' }); }
  }
  // place the model
  const near = d < 260 || n.state === 'held';
  if (man) { man.group.visible = near && !(inside && n.state === 'held' && C.dist(n.x, n.z, p.x, p.z) > 30);
    if (man.group.visible) {
      const f = n.state === 'held' ? n.f : null, gy = tc.height(n.x, n.z);
      man.group.position.set(n.x, f?.pose === 'dangle' ? f.abs : gy + (f?.lift || 0), n.z); pose(man, n, f, dt); man.group.rotation.y = n.yaw;
      if (f?.pose === 'trunk') { man.group.rotation.order = 'YXZ'; man.group.rotation.z = Math.PI / 2; const yw = n.yaw; man.group.position.x += Math.cos(yw) * 0.95; man.group.position.z -= Math.sin(yw) * 0.95; man.group.position.y += 0.25; } // lying across, centred on the roof
      if (n.state === 'gone') { man.group.position.y = gy; }
    } }
  if (rope) { const on = n.state === 'held' && n.f?.pose === 'dangle'; rope.visible = on; if (on) { const a = rope.geometry.attributes.position; a.setXYZ(0, p.x, p.y - EYE + 0.4, p.z); a.setXYZ(1, n.x, n.f.abs + 1.9, n.z); a.needsUpdate = true; } }
  if ((markT -= dt) <= 0) { markT = 1; if (n.state !== 'held' && n.state !== 'gone') tryv(() => window.SSX?.minimap?.addMarks?.('hostage', [{ x: n.x, z: n.z, color: '#ffffff', r: 4, ring: true }])); else tryv(() => window.SSX?.minimap?.addMarks?.('hostage', [])); }
  if (S.view && tc.camera) { tc.camera.position.set(...S.view.p); tc.camera.lookAt(...S.view.l); }
  S.prev = { x: p.x, z: p.z }; syncUi(tc);
}

// ---------- UI (black + white) ----------
const css = `
#hostageAct{position:fixed;z-index:15;left:calc(14px + env(safe-area-inset-left));bottom:calc(312px + env(safe-area-inset-bottom));display:none;min-height:52px;min-width:120px;max-width:calc(100vw - 150px);padding:6px 16px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:900 17px/1.15 system-ui,sans-serif;touch-action:manipulation;box-shadow:0 2px 10px #000;text-align:left}
#hostageAct.on{display:block}#hostageAct small{display:block;font-weight:700;font-size:12px;opacity:.85}
#hostageChip{position:fixed;z-index:14;top:calc(150px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;max-width:calc(100vw - 24px);box-sizing:border-box;padding:6px 12px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 13px/1.25 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;touch-action:manipulation}
#hostageChip.on{display:block}
`;
let actBtn, chip, actKey = '', chipTxt = '';
function realTap(el, fn) {
  let down = null, maxMove = 0, lastUp = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; down = { id: e.pointerId, x: e.clientX, y: e.clientY }; maxMove = 0; });
  el.addEventListener('pointermove', e => { if (down && e.pointerId === down.id) maxMove = Math.max(maxMove, Math.hypot(e.clientX - down.x, e.clientY - down.y)); });
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') return; const d = down; down = null; if (!C.isRealTap(d, { id: e.pointerId, x: e.clientX, y: e.clientY }, maxMove)) return; e.preventDefault(); lastUp = performance.now(); fn(e); });
  el.addEventListener('click', e => { if (performance.now() - lastUp < 700) return; fn(e); });
}
function ui() {
  if (actBtn || !document.body) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  actBtn = document.createElement('button'); actBtn.id = 'hostageAct'; actBtn.type = 'button'; document.body.appendChild(actBtn); realTap(actBtn, () => act(actBtn.dataset.mode));
  chip = document.createElement('button'); chip.id = 'hostageChip'; chip.type = 'button'; chip.setAttribute('aria-live', 'polite'); document.body.appendChild(chip); realTap(chip, chipTap);
}
function choice(title, opts) { const ch = window.SSX?.city?.choice; if (typeof ch === 'function') return ch(title, opts).catch(() => null); return Promise.resolve(opts[0] && confirm(title) ? opts[0].id : null); }
function ctx(tc) {
  const n = S.n; if (!tc?.player || !n || tryv(() => tc.world.inside)) return null; const p = tc.player, d = C.dist(n.x, n.z, p.x, p.z);
  if (n.state === 'held') { if (!tc.car && C.canDeliver(p, benny())) return { mode: 'deliver', label: `🎳 Hand ${S.L.name} to Benny`, sub: `finder\u2019s fee ${C.PAY.cr} cr + ${C.PAY.stars}★` }; return null; }
  if (tc.car) return null;
  if (C.grabbable(n, d)) return { mode: 'grab', label: `🪢 Grab ${S.L.name}`, sub: n.state === 'down' ? 'he\u2019s seeing stars' : 'hands up, cornered' };
  if ((n.state === 'flee' || n.state === 'idle') && d < C.PUNCH_R + 0.4) return { mode: 'punch', label: '👊 Rough him up', sub: `${S.L.name} \u00b7 ${S.L.gangName}` };
  return null;
}
function act(mode) { const r = mode === 'grab' ? grab() : mode === 'deliver' ? deliver() : mode === 'punch' ? punch() : null; if (r && !r.ok) toast(r.msg, 2400); }
function chipText(tc) {
  const n = S.n; if (!tc?.player || !n || n.state === 'gone') return ''; const p = tc.player;
  if (n.state === 'held') { const b = benny(); if (!b) return `🪢 ${S.L.name} in tow`; const d = C.dist(p.x, p.z, b.x, b.z); return d < C.DELIVER_R ? `🪢 ${S.L.name} \u00b7 Benny\u2019s right here` : `🪢 ${S.L.name} in tow \u00b7 ❄️ Benny ${C.fmtDist(d)} ${C.dirName(p.x, p.z, b.x, b.z)}`; }
  const d = C.dist(n.x, n.z, p.x, p.z); if (d > 120) return '';
  const what = n.state === 'down' ? 'down' : n.state === 'hands' ? 'hands up' : n.state === 'flee' ? 'running' : 'hanging about';
  return `🎯 ${S.L.name} (${S.L.gangName} lt.) \u00b7 ${what} \u00b7 ${C.fmtDist(d)} ${C.dirName(p.x, p.z, n.x, n.z)}`;
}
function syncUi(tc) {
  if (!actBtn) return; const c = ctx(tc), k = c ? `${c.mode}|${c.label}|${c.sub || ''}` : '';
  if (k !== actKey) { actKey = k; actBtn.classList.toggle('on', !!c); if (c) { actBtn.dataset.mode = c.mode; actBtn.innerHTML = `${c.label}${c.sub ? `<small>${c.sub}</small>` : ''}`; } }
  if (c && (S.simT - (S.dodgeT || -9) > 0.3 || k !== S.dodgeK)) { S.dodgeT = S.simT; S.dodgeK = k; dodge(); }
  const t = tc ? chipText(tc) : ''; if (t !== chipTxt) { chipTxt = t; chip.textContent = t; chip.classList.toggle('on', !!t); }
}
// other bots' context buttons live in the same thumb column (fight club, ice cap, farm...): stack above whichever is showing
function dodge() {
  if (!actBtn) return; actBtn.style.transform = ''; let up = 0;
  const others = [...document.querySelectorAll('button[id$="Act"], [id$="Act"].btn')].filter(e => e !== actBtn && e.offsetWidth > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden');
  for (let i = 0; i < 4; i++) { const a = actBtn.getBoundingClientRect(); const o = others.map(e => e.getBoundingClientRect()).find(r => r.left < a.right - 1 && r.right > a.left + 1 && r.top < a.bottom - 1 && r.bottom > a.top + 1); if (!o) break;
    up += a.bottom - o.top + 8; if (a.top - (a.bottom - o.top + 8) < 120) break; actBtn.style.transform = `translateY(${-up}px)`; }
}
function chipTap() {
  const n = S.n; if (!n) return; const ft = window.SSX?.fastTravel, b = benny();
  if (n.state === 'held') {
    const opts = []; if (ft?.travel && b) opts.push({ id: 'ft', label: `🚀 Fast travel to the ice cap · ${ft.fee ?? 25} cr` }); if (b) opts.push({ id: 'wp', label: '📍 Waypoint: Frostbite Benny' }); opts.push({ id: 'free', label: '✋ Let him go' });
    choice(`🪢 ${S.L.name} (${S.L.gangName}) is zip-tied and coming with you. Benny pays ${C.PAY.cr} cr + ${C.PAY.stars}★ for him on the ice cap.${ft?.travel ? ' Fast travel takes him along.' : ''}`, opts).then(id => {
      if (id === 'ft') tryv(() => ft.travel('icecap')); else if (id === 'wp') tryv(() => window.SSX?.hudx?.setWaypoint?.({ x: b.x, z: b.z, label: 'Frostbite Benny' })); else if (id === 'free') release(); });
    return;
  }
  tryv(() => window.SSX?.hudx?.setWaypoint?.({ x: n.x, z: n.z, label: S.L.name })); toast(`📍 Waypoint: ${S.L.name}.`, 1600);
}

// ---------- ☰ menu ----------
let menuHooked = false;
function hookMenu() { if (menuHooked) return; const reg = window.SSX?.registerMenuItem; if (typeof reg !== 'function') return; try { reg({ id: 'rmHostage', label: '🪢 Lieutenants', onTap: menuTap }); menuHooked = true; } catch (e) { /* */ } }
function menuTap() {
  const n = S.n, ft = window.SSX?.fastTravel, t = now();
  const lines = C.ROSTER.map(L => { const b = save.back[L.id] || 0; return `${L.name} (${L.gangName}): ${save.held === L.id ? 'in your custody' : b > t ? `lying low ${Math.ceil((b - t) / 60)} min` : S.L?.id === L.id ? 'out in Red Tape Flats' : L.id === hutId() ? 'at Benny\u2019s hut' : 'around'}`; });
  const opts = []; if (n && n.state !== 'held' && ft?.travel) opts.push({ id: 'ft', label: `🚀 Fast travel to Red Tape Flats · ${ft.fee ?? 25} cr` }); if (n && n.state !== 'held') opts.push({ id: 'wp', label: '📍 Waypoint on him' });
  choice(`🪢 Rival lieutenants. Snatch one in Red Tape Flats (punch him down or corner him), haul him to Frostbite Benny on the ice cap: ${C.PAY.cr} cr + ${C.PAY.stars}★. Hauled so far: ${save.hauls}.\n${lines.join('\n')}`, opts).then(id => {
    if (id === 'ft') tryv(() => ft.travel('rough')); else if (id === 'wp' && S.n) tryv(() => window.SSX?.hudx?.setWaypoint?.({ x: S.n.x, z: S.n.z, label: S.L.name })); });
}

// ---------- API ----------
function current() { return S.n && S.n.state === 'held' ? C.captiveOf(S.L) : null; } // icecap.js's hostageFromGame() reads this
function state() { const n = S.n; return { lieutenant: S.L ? { ...S.L } : null, npc: n ? { state: n.state, x: n.x, z: n.z, hp: n.hp, corner: n.corner, hits: n.hits, pose: n.f?.pose || null } : null, mode: S.mode, ctx: ctx(S.lastTc), chip: chipTxt, save: JSON.parse(JSON.stringify(save)) }; }
const api = { state, current, roster: () => C.ROSTER.map(l => ({ ...l })), grab, deliver, release, punch, subscribe(fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); } };
function attach() { const w = window; if (w.SSX && w.SSX.hostage !== api) w.SSX.hostage = api; }
let ftHooked = false;
function hookFt() { const ft = window.SSX?.fastTravel; if (ftHooked || typeof ft?.on !== 'function') return; ftHooked = true; ft.on(type => { if (type === 'travel' && S.n?.state === 'held') emit('travel', { id: S.n.id }); }); }
window.__hostage = { core: C, S, log: () => log.slice(), act, ctx: () => ctx(S.lastTc), man: () => man,
  go(dx = 0, dz = 6) { const n = S.n; if (!n) return false; return !!tryv(() => surf().debugMove(n.x + dx, n.z + dz, Math.atan2(dx, dz))); },
  next(dx = 1.6, dz = 0) { return this.go(dx, dz); },
  koNow() { const n = S.n; if (!n) return null; n.state = 'down'; n.t = C.DOWN_S; n.hp = 0; return n.state; },
  view(v) { S.view = v ? { p: v.p, l: v.l } : null; return !!S.view; },
  reset() { save = { held: null, back: {}, hauls: 0, freed: 0 }; persist(); S.n = null; S.L = null; if (man && G) { G.remove(man.group); man = null; } } };
function boot() { const X = window.SSX, a = app(); if (!X?.registerSurfaceTick || !a?.surface) return false; attach(); X.registerSurfaceTick(tick); ui(); hookMenu(); return true; }
if (window.SSX && !window.SSX.hostage) window.SSX.hostage = api;
setInterval(() => { attach(); hookFt(); }, 1000);
if (!boot()) { const iv = setInterval(() => { if (boot()) clearInterval(iv); }, 250); }
