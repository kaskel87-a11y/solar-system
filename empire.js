// v7.5.5 Empire layer (Ben): buy safehouses and front businesses across the Mars districts, collect passive income that runs
// on the Mars clock, and keep rival crews off them.
//  - Safehouses (3): 🛏️ Rest = save point (game.save + full heal, sleep to morning at night via SSX.time.set), a 💰 stash the
//    cops can't fine, and a garage spot (SSX.garage.open('current') when Pumpkin's garage is loaded, else park your rover there).
//    After a bust or med-evac you can wake up at the last safehouse you rested in.
//  - Fronts (4): Red Dust Wash & Fold (laundromat, AJ), The Thin Air (bar, Olympus Row), Rustbucket Parts (chop shop, Red Tape
//    Flats: strip stolen rides for cash) and Greenhouse Nine (dispensary, Helios Heights). Each earns per game hour with its own
//    day/night curve on SSX.time (Steve's mars/time.js) or, without it, dangercore.marsHour() (real time). The till fills to a cap;
//    collect at the counter.
//  - Rival crews (SSX.turf block owners and the district's crew; odds from SSX.rep and turf grudges) either shake a front down
//    (pay, or refuse and they come) or raid it. Get there in time and defend it: waves through SSX.raids.start, else a hold-the-
//    line fallback with SSX.city.hostiles. Lose and the front shuts for 6 game hours (or a safehouse loses part of its stash).
//    Owned Mars base lots (Ben's SSX.base, PR #24) can be hit too: that goes through SSX.base.raid so its turrets join in.
// Talks to core through public hooks only (SSX.registerSurfaceTick, registerMenuItem, SSX.city, SSX.minimap, game.spend/
// reward/save/restore, surface.fastTravel/debugPlace/chopVehicle); every outside call is guarded. No NPCs of its own beyond a
// fallback raid's (≤ 3, inside world.npcBudget()). Persists to localStorage 'ssx.empire.v1'. See README "Empire".
import * as THREE from 'three';
import * as EC from './empirecore.js';
import { marsHour } from './dangercore.js';

const W = () => (typeof window !== 'undefined' ? window : null), SSX = () => W()?.SSX, APP = () => W()?.__app;
const surf = () => APP()?.surface, game = () => surf()?.game, wld = () => surf()?.world;
// one pop-up or caption at a time: while the Empire sheet is open the message is a line in the sheet, not a toast over it
const toast = (t, ms = 2800) => { if (S?.ui?.panel?.classList.contains('on')) { S.note = t; return; } try { APP()?.toast?.(t, ms); } catch (e) { /* hud not up */ } };
const isTouch = () => typeof document !== 'undefined' && document.body.classList.contains('touch');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const listeners = {};
function emit(evt, d = {}) {
  for (const f of [...(listeners[evt] || [])]) { try { f(d); } catch (e) { console.warn('empire listener', e); } }
  if (evt !== 'hour') for (const f of [...(listeners['*'] || [])]) { try { f(evt, d); } catch (e) { console.warn('empire listener', e); } } // '*' stays as before: no hourly noise
  try { SSX()?.emit?.('empire:' + evt, d); } catch (e) { /* bus not up */ }
  try { W()?.dispatchEvent(new CustomEvent('empire:' + evt, { detail: d })); } catch (e) { /* no window */ }
}

// ---------- core shim (the one place this file touches game state) ----------
const H = {
  credits: () => game()?.progress?.credits | 0,
  spend: n => !(n > 0) || (typeof game()?.spend === 'function' ? !!game().spend(n) : false),
  give: n => { if (!(n > 0)) return; const g = game(); if (typeof g?.reward === 'function') g.reward(0, n); else g?.bonus?.(n); },
  medkits: () => game()?.progress?.inv?.medkits | 0,
  addMedkits: n => { const P = game()?.progress; if (!P?.inv) return false; P.inv.medkits = Math.max(0, (P.inv.medkits | 0) + n); game()?.save?.(); return true; },
  colony: () => { try { return SSX()?.city?.colony?.() || null; } catch (e) { return null; } },
  rep: g => { try { const R = SSX()?.rep; const v = typeof R?.get === 'function' ? R.get(g) : null; return v != null && Number.isFinite(+v) ? +v : null; } catch (e) { return null; } },
  repAdd: (g, n, why) => { try { SSX()?.rep?.add?.(g, n, why); } catch (e) { /* no rep module */ } },
  turfAt: aj => { try { const T = SSX()?.turf; const o = T?.ownerAt?.({ x: aj[0], z: aj[1] }); if (!o) return null; const b = T.blocks?.()?.find?.(q => q.id === o.block); return { block: o.block, owner: o.owner, lostBy: b?.lostBy || null }; } catch (e) { return null; } },
  grudge: g => { try { return (SSX()?.turf?.blocks?.() || []).filter(b => b.owner === 'player' && b.lostBy === g).length; } catch (e) { return 0; } },
  raids: () => { const R = SSX()?.raids; return typeof R?.start === 'function' ? R : null; },
  base: () => { const B = SSX()?.base; return B && typeof B.owned === 'function' ? B : null; },
  garageOpen: () => { const G = SSX()?.garage; return typeof G?.open === 'function' ? G : null; },
  hostiles: (types, x, z, o) => { try { const c = SSX()?.city; return (c?.hostiles ? c.hostiles(types, x, z, o) : game()?.hostiles?.(types, x, z, o)) || 0; } catch (e) { return 0; } },
  budget: () => { try { return wld()?.npcBudget?.() || null; } catch (e) { return null; } },
  marks: (id, m) => { try { SSX()?.minimap?.addMarks?.(id, m); } catch (e) { /* no radar */ } },
  radio: (text, who) => { try { if (SSX()?.city?.radio) return SSX().city.radio(text, who); } catch (e) { /* fall through */ } toast(`📻 ${who}: ${text}`, 4200); }
};
// the Mars clock: Steve's SSX.time when it's loaded, else the street-danger clock (real time, 2 min per game hour)
function clock() {
  const T = SSX()?.time; let h = null, night = null, src = 'real';
  try { if (T) { h = typeof T.hour === 'function' ? T.hour() : typeof T.now === 'function' ? T.now() : null; if (typeof T.isNight === 'function') night = !!T.isNight(); if (Number.isFinite(h)) src = 'SSX.time'; else h = null; } } catch (e) { h = null; }
  if (h == null) { try { h = marsHour(); src = 'real'; } catch (e) { h = (Date.now() / 120000) % 24; } }
  h = ((h % 24) + 24) % 24; if (night == null) night = EC.timeBand(h) === 'night';
  return { hour: h, band: EC.timeBand(h), night, source: src, text: EC.fmtClock(h) };
}

// ---------- state ----------
let D = load();
function load() { let raw = null; try { raw = localStorage.getItem(EC.SAVE_KEY); } catch (e) { /* private mode */ } const s = EC.migrate(raw); return s; }
const S = { ready: false, on: true, built: false, root: null, P: {}, ui: null, act: null, note: null, frameMs: 0, saveT: 0, dirty: false, markT: 0, rollAcc: 0, defense: null,
  wake: null, wasDown: false, mobile: false, colKey: '', panelId: null, force: {}, beaconT: 0, offline: null };
function save() { D.lastAt = Date.now(); try { localStorage.setItem(EC.SAVE_KEY, JSON.stringify(D)); } catch (e) { /* private mode */ } S.dirty = false; }
const dirty = () => { S.dirty = true; };
function log(t) { D.log.push({ t, at: Date.now() }); if (D.log.length > 20) D.log.splice(0, D.log.length - 20); }

// ---------- world placement ----------
const DIMS = { safehouse: [7, 7, 7.2], laundromat: [8.5, 6, 4.4], bar: [8, 6.5, 4.8], chop: [10, 7, 5.2], dispensary: [7.5, 6, 4.2] };
function place(p) { // world centre, facing, door and garage points for a property (AJ-relative + the colony)
  const c = H.colony(); if (!c) return null; const x = c.x + p.aj[0], z = c.z + p.aj[1], yaw = p.yaw, [w, d] = DIMS[p.kind];
  const f = [Math.sin(yaw), Math.cos(yaw)], r = [Math.cos(yaw), -Math.sin(yaw)], at = (lx, lz) => ({ x: x + r[0] * lx + f[0] * lz, z: z + r[1] * lx + f[1] * lz });
  return { x, z, yaw, w, d, door: at(0, d / 2 + 1.6), garage: p.garage ? at(p.garage[0], p.garage[1]) : null, chopBay: p.kind === 'chop' ? at(0, d / 2 + 4) : null, at };
}

// ---------- 3D: one small storefront per property (merged-ish boxes, shared materials, a canvas sign), culled by distance ----------
const MAT = {};
function mats() {
  if (MAT.ok) return MAT; MAT.ok = true; const m = (c, o = {}) => Object.assign(new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.1, ...o }), { userData: { shared: true } });
  MAT.wall = { safehouse: m(0x8a6f5c), laundromat: m(0xc9d3dc), bar: m(0x3a2f45), chop: m(0x6a5a48), dispensary: m(0xdfe8dc) };
  MAT.trim = m(0x2a2c31); MAT.glass = m(0x7fb8d8, { roughness: 0.15, metalness: 0.3, emissive: 0x0b2030 }); MAT.door = m(0x1c1d22);
  MAT.awn = { safehouse: m(0x5a3a2a), laundromat: m(0x2f7fd0), bar: m(0xb0207a, { emissive: 0x300018 }), chop: m(0xd08a20), dispensary: m(0x2fa05a) };
  MAT.pad = m(0x30343a, { roughness: 0.95 }); MAT.stripe = m(0xffc42a, { emissive: 0x221800 });
  MAT.lampOn = new THREE.MeshBasicMaterial({ color: 0x3cff8a }); MAT.lampOff = new THREE.MeshBasicMaterial({ color: 0x888888 }); MAT.lampRed = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  MAT.beacon = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.35, depthWrite: false });
  return MAT;
}
function signTex(lines, bg, fg) {
  if (typeof document === 'undefined') return null; const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 50px system-ui, sans-serif'; g.fillText(lines[0], 256, lines[1] ? 46 : 64, 480); if (lines[1]) { g.font = 'bold 30px system-ui, sans-serif'; g.fillText(lines[1], 256, 96, 480); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildProp(p, pl, tc) {
  mats(); const g = new THREE.Group(), [w, d, h] = DIMS[p.kind], K = EC.KINDS[p.kind]; g.position.set(pl.x, 0, pl.z); g.rotation.y = pl.yaw;
  const y0 = Math.min(...[[0, 0], [w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]].map(([a, b]) => { const q = pl.at(a, b); return tc.height(q.x, q.z); }));
  g.position.y = y0 - 0.15; const box = (bw, bh, bd, x, y, z, mat) => { const o = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat); o.position.set(x, y, z); g.add(o); return o; };
  box(w, h + 0.3, d, 0, (h + 0.3) / 2, 0, MAT.wall[p.kind]); box(w + 0.3, 0.3, d + 0.3, 0, h + 0.3, 0, MAT.trim);
  box(1.5, 2.3, 0.12, 0, 1.3, d / 2 + 0.03, MAT.door);
  if (p.kind !== 'safehouse') { box(w * 0.32, 1.6, 0.1, -w * 0.3, 1.6, d / 2 + 0.03, MAT.glass); box(w * 0.32, 1.6, 0.1, w * 0.3, 1.6, d / 2 + 0.03, MAT.glass); box(w * 0.95, 0.18, 1.4, 0, 3.0, d / 2 + 0.7, MAT.awn[p.kind]); }
  else { for (const yy of [2.2, 5.0]) for (const xx of [-2, 2]) box(1.3, 1.1, 0.1, xx, yy, d / 2 + 0.03, MAT.glass); box(2.2, 0.15, 1.0, 0, 2.7, d / 2 + 0.5, MAT.awn.safehouse); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.9 / 4), new THREE.MeshBasicMaterial({ map: signTex([p.name.toUpperCase(), K.label.toUpperCase()], '#101218', '#f4f1e8'), transparent: false }));
  sign.position.set(0, p.kind === 'safehouse' ? 6.5 : h - 0.4, d / 2 + 0.06); g.add(sign);
  // for-sale board on a post by the door
  const sale = new THREE.Group(); const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), MAT.trim); post.position.y = 0.9; sale.add(post);
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({ map: signTex(['FOR SALE', `${p.price} CR`], '#c81e1e', '#ffffff'), side: THREE.DoubleSide })); bd.position.y = 1.75; sale.add(bd);
  sale.position.set(w / 2 + 0.8, 0, d / 2 + 1.2); g.add(sale);
  const lamp = box(0.35, 0.35, 0.35, -0.95, 2.55, d / 2 + 0.2, MAT.lampOff);
  // threat beacon: a translucent red column, only while a crew is on the place
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 12, 1, true), MAT.beacon); beacon.position.y = 30; beacon.visible = false; g.add(beacon);
  let pad = null; if (pl.garage) { pad = new THREE.Group(); const q = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 6.2), MAT.pad); q.rotation.x = -Math.PI / 2; pad.add(q);
    for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 6.2), MAT.stripe); st.rotation.x = -Math.PI / 2; st.position.set(s * 2.05, 0.01, 0); pad.add(st); }
    pad.position.set(pl.garage.x, tc.height(pl.garage.x, pl.garage.z) + 0.04, pl.garage.z); pad.rotation.y = pl.yaw; pad.visible = false; }
  g.traverse(o => { if (o.isMesh) { o.castShadow = o !== beacon; o.receiveShadow = true; o.userData.empire = p.id; } });
  return { g, sale, lamp, beacon, pad };
}
function buildAll(tc) {
  const c = H.colony(); if (!c) return false; const key = `${tc.name}|${Math.round(c.x)}|${Math.round(c.z)}`; if (S.built && S.colKey === key) return true;
  if (S.root) { S.root.parent?.remove(S.root); } S.root = new THREE.Group(); S.root.name = 'empire'; tc.scene.add(S.root); S.P = {};
  for (const p of EC.PROPS) { const pl = place(p); if (!pl) continue; const m = buildProp(p, pl, tc); S.root.add(m.g); if (m.pad) S.root.add(m.pad); S.P[p.id] = { p, pl, m }; }
  S.built = true; S.colKey = key; refreshLooks(); return true;
}
function refreshLooks() {
  for (const { p, m } of Object.values(S.P)) { const o = D.owned[p.id]; m.sale.visible = !o; m.lamp.material = !o ? MAT.lampOff : o.closedH > 0 || D.threat?.prop === p.id ? MAT.lampRed : MAT.lampOn; m.beacon.visible = D.threat?.prop === p.id && D.threat.phase !== 'demand'; if (m.pad) m.pad.visible = !!o; }
}
function pushOut(tc) { // the storefronts are solid: keep the player and cars out of them
  for (const { pl } of Object.values(S.P)) for (const b of [tc.car, tc.car ? null : tc.player]) {
    if (!b) continue; const dx = b.x - pl.x, dz = b.z - pl.z; if (dx * dx + dz * dz > 100) continue; const r = tc.car ? 1.8 : 0.5;
    const lx = dx * Math.cos(pl.yaw) - dz * Math.sin(pl.yaw), lz = dx * Math.sin(pl.yaw) + dz * Math.cos(pl.yaw), hw = pl.w / 2 + r, hd = pl.d / 2 + r;
    if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue; let nx = lx, nz = lz; if (hw - Math.abs(lx) < hd - Math.abs(lz)) nx = Math.sign(lx || 1) * hw; else nz = Math.sign(lz || 1) * hd;
    b.x = pl.x + nx * Math.cos(pl.yaw) + nz * Math.sin(pl.yaw); b.z = pl.z - nx * Math.sin(pl.yaw) + nz * Math.cos(pl.yaw); if (tc.car && b === tc.car) b.speed *= 0.3;
  }
}

// ---------- threats ----------
function ctxFor(p) { const turf = H.turfAt(p.aj), g = EC.gangFor(p, turf); return { rep: H.rep(g), turf, grudge: H.grudge(g), night: clock().night, mobile: S.mobile }; }
function startThreat(t) {
  const p = EC.propById(t.prop), G = EC.GANGS[t.gang]; D.threat = t; D.lastThreatH = D.clockH; D.stats[t.kind === 'extort' ? 'extortions' : 'raids']++; dirty(); refreshLooks();
  if (t.kind === 'extort') { H.radio(`Nice ${EC.KINDS[p.kind].label.toLowerCase()} you got there. ${t.demand} cr a week keeps the windows in.` + ` Open the ☰ menu, tap Empire, then tap Pay or Tell them no.`, G.name); log(`${G.name} want ${t.demand} cr from ${p.name}`); }
  else { H.radio(`${G.name} are smashing up ${p.name}. Get there before they clear it out.`, 'Your manager'); log(`${G.name} hit ${p.name}`); }
  emit(t.kind === 'extort' ? 'extort' : 'raid', { prop: p.id, gang: t.gang, demand: t.demand || 0, limit: t.limit });
}
function toAlert(why) { const t = D.threat; if (!t) return; const p = EC.propById(t.prop); t.kind = 'raid'; t.phase = 'alert'; t.t = 0; t.limit = S.mobile ? EC.RULES.arriveSPhone : EC.RULES.arriveS; dirty(); refreshLooks();
  H.radio(why === 'refused' ? `Wrong answer. We're coming for ${p.name}.` : `No answer? We'll take it out of ${p.name}.`, EC.GANGS[t.gang].name); emit('refuse', { prop: p.id, gang: t.gang, why }); emit('raid', { prop: p.id, gang: t.gang, limit: t.limit }); }
function pay() {
  const t = D.threat; if (!t || t.phase !== 'demand') return { ok: false, why: 'Nobody is asking.' }; const p = EC.propById(t.prop);
  if (!H.spend(t.demand)) return { ok: false, why: `Need ${t.demand} cr.` };
  const o = D.owned[t.prop]; if (o) o.protect = { gang: t.gang, h: EC.RULES.protectHours }; D.stats.paid += t.demand; H.repAdd(t.gang, 3, 'paid protection'); log(`Paid ${EC.GANGS[t.gang].name} ${t.demand} cr for ${p.name}`);
  const d = { prop: p.id, gang: t.gang, paid: t.demand }; D.threat = null; dirty(); refreshLooks(); toast(`🤝 Paid ${d.paid} cr. ${EC.GANGS[d.gang].name} leave ${p.name} alone for ${EC.RULES.protectHours} game hours.`, 3200); emit('pay', d); renderPanel(); return { ok: true, ...d };
}
function refuse() { const t = D.threat; if (!t || t.phase !== 'demand') return { ok: false }; toAlert('refused'); renderPanel(); return { ok: true }; }
function defend() {
  const t = D.threat; if (!t || t.phase !== 'alert') return { ok: false, why: 'Nothing to defend.' }; const p = EC.propById(t.prop), E = S.P[p.id]; if (!E) return { ok: false, why: 'Not on Mars.' };
  const o = D.owned[p.id], plan = EC.wavePlan(p, { rep: H.rep(t.gang), mobile: S.mobile, security: !!o?.security }), id = 'empire-' + p.id; t.phase = 'defend'; t.t = 0; t.waves = plan.length; dirty();
  const R = S.force.noRaids ? null : H.raids(); let r = null;
  if (R) { try { r = R.start({ id, pos: { x: E.pl.x, z: E.pl.z }, radius: 26, attackers: 'gang', waves: plan, label: `${EC.GANGS[t.gang].name} · ${p.name}`, integrity: 100, onWin: i => { if (S.defense?.id === i?.id) endDefense('win', i); }, onLose: i => { if (S.defense?.id === i?.id) endDefense('lose', i); } }); } catch (e) { r = null; } }
  if (r?.ok) { S.defense = { engine: 'raids', id: r.id || id, prop: p.id }; }
  else { // fallback: hold the line for 40 s inside the radius while the crew comes at you
    const types = EC.GANGS[t.gang].types, free = H.budget()?.free ?? 3, n = Math.max(0, Math.min(3, free, types.length)); const made = n ? H.hostiles(types.slice(0, n), E.pl.x, E.pl.z, { r: 12, src: 'empire', faction: t.gang }) : 0;
    S.defense = { engine: 'hold', id, prop: p.id, hold: 0, need: 40, out: 0, spawned: made, why: r && !r.ok ? r.why : 'no SSX.raids' };
  }
  toast(`🛡️ ${EC.GANGS[t.gang].name} at ${p.name}: ${plan.length} wave${plan.length > 1 ? 's' : ''}. Stay near the door until they run.`, 3000);
  emit('defend:start', { prop: p.id, gang: t.gang, waves: plan.length, engine: S.defense.engine }); refreshLooks(); return { ok: true, engine: S.defense.engine, waves: plan.length };
}
function endDefense(result, info = {}) {
  const t = D.threat; if (!t) return; const p = EC.propById(t.prop), o = D.owned[t.prop], df = S.defense; S.defense = null; D.threat = null;
  if (result === 'win') { const cr = EC.defendReward(p, t.waves || 2); H.give(cr); D.stats.defended++; if (o) { o.defended++; o.protect = { gang: t.gang, h: 6 }; } H.repAdd(t.gang, -4, `defended ${p.name}`); log(`Held ${p.name} against ${EC.GANGS[t.gang].name}`);
    toast(`🛡️ ${p.name} held. ${EC.GANGS[t.gang].name} ran. +${cr} cr`, 3200); emit('defend:win', { prop: p.id, gang: t.gang, reward: cr, kills: info.kills | 0, engine: df?.engine }); }
  else { const L = EC.applyLoss(D, p.id); log(`Lost ${p.name} to ${EC.GANGS[t.gang].name}`); toast(L.stash ? `💥 ${EC.GANGS[t.gang].name} tossed ${p.name}. The stash is ${L.lost} cr lighter.` : `💥 ${EC.GANGS[t.gang].name} wrecked ${p.name}${L.lost ? ` and took ${L.lost} cr from the till` : ''}. Shut for ${EC.RULES.closedHours} game hours, or pay to fix it.`, 3600);
    emit('defend:lose', { prop: p.id, gang: t.gang, lost: L.lost, why: info.why || result, engine: df?.engine }); emit('lost', { prop: p.id, gang: t.gang, ...L }); }
  dirty(); save(); refreshLooks(); renderPanel();
}
function threatTick(dt, tc, px, pz) {
  const t = D.threat; if (!t) return; t.t += dt; const E = S.P[t.prop];
  if (t.phase === 'demand') { if (t.t > t.limit) toAlert('ignored'); return; }
  if (t.phase === 'alert') { if (E && Math.hypot(px - E.pl.x, pz - E.pl.z) < EC.RULES.defendR * 0.6 && !tc.world.inside) { defend(); return; } if (t.t > t.limit) endDefense('lose', { why: 'too late' }); return; }
  if (t.phase === 'defend' && S.defense?.engine === 'hold' && E) { const df = S.defense, d = Math.hypot(px - E.pl.x, pz - E.pl.z);
    if (game()?.isDown?.()) { endDefense('lose', { why: 'down' }); return; }
    if (d < 30) { df.hold += dt; df.out = 0; } else if ((df.out += dt) > 15) { endDefense('lose', { why: 'left' }); return; }
    if (df.hold >= df.need) endDefense('win', { kills: 0 }); }
  if (t.phase === 'defend' && !S.defense) { t.phase = 'alert'; t.t = 0; } // reload mid-fight: back to the alert, the crew is still there
}
function rollBaseRaid() { // an owned base lot can draw a crew too; SSX.base runs it (turrets, its own raid adapter)
  const B = H.base(); if (!B || typeof B.raid !== 'function' || D.threat) return; let lots = []; try { lots = B.owned() || []; } catch (e) { return; } if (!lots.length) return;
  const lot = lots[Math.floor(Math.random() * lots.length)], id = typeof lot === 'string' ? lot : lot?.id; if (!id) return; const g = id.startsWith('flats') ? 'saltblood' : id.startsWith('helios') ? 'saltblood' : 'dustjaws';
  if (Math.random() < 0.01 * EC.repMul(H.rep(g))) { try { B.raid(id, { attackers: 'gang', waves: 2, why: `${EC.GANGS[g].name} heard about your lot` }); D.lastThreatH = D.clockH; emit('baseRaid', { lot: id, gang: g }); } catch (e) { /* base busy */ } }
}

// ---------- property actions ----------
const near = (id, r = 14) => { const E = S.P[id], pl = surf()?.info; return !!E && !!pl && Math.hypot(pl.x - E.pl.door.x, pl.z - E.pl.door.z) < r; };
function buy(id, o = {}) {
  const p = EC.propById(id); if (!p) return { ok: false, why: 'No such property.' }; if (!o.force && !near(id)) return { ok: false, why: `Go to ${p.name} to buy it.` };
  const c = EC.canBuy(D, id, H.credits()); if (!c.ok) return c; if (!H.spend(p.price)) return { ok: false, why: 'Payment failed.' };
  EC.buy(D, id); log(`Bought ${p.name} for ${p.price} cr`); save(); refreshLooks(); updateMarks(true);
  toast(`🔑 ${p.name} is yours.${EC.isFront(p) ? ` Income starts now, about ${Math.round(EC.avgRate(p.kind))} cr per game hour.` : ' Rest here to save, stash cash, park your ride.'}`, 3400);
  emit('buy', { prop: id, kind: p.kind, price: p.price }); renderPanel(); return { ok: true, prop: id, price: p.price };
}
function collect(id, o = {}) {
  const p = EC.propById(id), ow = D.owned[id]; if (!p || !ow) return { ok: false, why: 'Not yours.' }; if (!EC.isFront(p)) return { ok: false, why: 'Safehouses don\u2019t earn.' };
  if (!o.force && !near(id)) return { ok: false, why: `Collect at ${p.name}.` }; const n = EC.collect(D, id); if (!n) return { ok: false, why: 'Till is empty.' };
  H.give(n); save(); toast(`💵 +${n} cr from ${p.name}`, 2400); emit('collect', { prop: id, amount: n }); renderPanel(); return { ok: true, amount: n };
}
function upgrade(id) { const p = EC.propById(id), o = D.owned[id]; if (!o) return { ok: false, why: 'Not yours.' }; if (o.security) return { ok: false, why: 'Already done.' }; const c = EC.securityCost(p); if (!H.spend(c)) return { ok: false, why: `Need ${c} cr.` }; o.security = true; save(); emit('security', { prop: id, cost: c }); toast(`🔒 ${p.name}: shutters, cameras and a guy on the door. Crews think twice.`, 2800); renderPanel(); return { ok: true, cost: c }; }
function repair(id) { const p = EC.propById(id), o = D.owned[id]; if (!o || !(o.closedH > 0)) return { ok: false, why: 'Nothing to fix.' }; const c = EC.repairCost(p); if (!H.spend(c)) return { ok: false, why: `Need ${c} cr.` }; o.closedH = 0; save(); refreshLooks(); emit('repair', { prop: id, cost: c }); toast(`🔨 ${p.name} is open again.`, 2200); renderPanel(); return { ok: true, cost: c }; }
function rest(id) {
  const p = EC.propById(id), o = D.owned[id]; if (!p || p.kind !== 'safehouse' || !o) return { ok: false, why: 'Rest at a safehouse you own.' };
  const g = game(); try { g?.restore?.(); g?.save?.(); } catch (e) { /* */ } D.home = id; let slept = false; const ck = clock();
  if (ck.night && typeof SSX()?.time?.set === 'function') { try { SSX().time.set(7); slept = true; } catch (e) { /* */ } }
  save(); toast(slept ? `🛏️ Slept till morning at ${p.name}. Game saved.` : `🛏️ Rested at ${p.name}. Patched up, game saved.`, 2800); emit('rest', { prop: id, slept }); emit('save', { prop: id }); return { ok: true, slept };
}
function stashMove(id, { credits = 0, medkits = 0 } = {}) { // + deposit, - withdraw
  const o = D.owned[id], p = EC.propById(id); if (!o || p?.kind !== 'safehouse') return { ok: false, why: 'No stash here.' };
  credits |= 0; medkits |= 0; if (credits > 0 && !H.spend(credits)) return { ok: false, why: 'Not enough credits.' };
  if (credits < 0) { const n = Math.min(-credits, o.stash.credits); o.stash.credits -= n; H.give(n); credits = -n; } else o.stash.credits += credits;
  if (medkits > 0) { const n = Math.min(medkits, H.medkits()); if (n) { H.addMedkits(-n); o.stash.medkits += n; } medkits = n; }
  else if (medkits < 0) { const n = Math.min(-medkits, o.stash.medkits); o.stash.medkits -= n; H.addMedkits(n); medkits = -n; }
  save(); emit('stash', { prop: id, credits, medkits, stash: { ...o.stash } }); renderPanel(); return { ok: true, stash: { ...o.stash } };
}
function garage(id, tc = S.tc, parkOnly = false) {
  const E = S.P[id], o = D.owned[id]; if (!E?.pl.garage || !o) return { ok: false, why: 'No garage spot.' };
  const G = parkOnly ? null : H.garageOpen(); if (G) { try { const r = G.open('current'); emit('garage', { prop: id, mode: 'open' }); return { ok: r !== false, mode: 'open' }; } catch (e) { /* fall back to parking */ } }
  const rv = tc?.rover; if (!rv) return { ok: false, why: 'No rover.' }; if (tc.car && tc.car !== rv) return { ok: false, why: 'Only your rover parks here.' };
  const g = E.pl.garage; rv.x = g.x; rv.z = g.z; rv.yaw = E.pl.yaw + Math.PI; rv.y = tc.height(g.x, g.z) + 0.6; rv.vy = 0; rv.speed = 0; rv.prevG = null; if ('fuel' in rv) rv.fuel = 100;
  toast('🚙 Rover parked in your spot. Fuel topped up.', 2200); emit('garage', { prop: id, mode: 'park' }); return { ok: true, mode: 'park' };
}
function chopRide(tc = S.tc) {
  const o = D.owned['fr-chop']; if (!o) return { ok: false, why: 'You don\u2019t own a chop shop.' }; if (!tc?.car || tc.car === tc.rover) return { ok: false, why: 'Bring a stolen ride.' };
  let ok = false; try { ok = !!(surf()?.chopVehicle?.() || SSX()?.despawnVehicle?.()); } catch (e) { ok = false; } if (!ok) return { ok: false, why: 'The bay is jammed.' };
  const [a, b] = EC.RULES.chopBonus, cr = Math.round((a + Math.random() * (b - a)) / 10) * 10; H.give(cr); D.stats.chopped++; save(); toast(`🔧 Stripped for parts: +${cr} cr`, 2600); emit('chop', { prop: 'fr-chop', amount: cr }); return { ok: true, amount: cr };
}
function wakeAtHome() {
  const id = D.home, E = S.P[id], sf = surf(); if (!E || !sf) return { ok: false }; const p = E.p, zone = sf.world?.zone;
  try { if (zone !== p.district && typeof sf.fastTravel === 'function') sf.fastTravel(p.district); sf.debugPlace?.(E.pl.door.x, E.pl.door.z, E.pl.yaw); } catch (e) { return { ok: false }; }
  S.wake = null; toast(`🏠 Back at ${p.name}.`, 2000); emit('wake', { prop: id }); return { ok: true };
}

// ---------- HUD (team UI rule): no permanent buttons. One context button in #surfBtns, shown only while standing at a property;
// everything else lives in the ☰ → Empire sheet (393-wide friendly). Threats are told once in plain words, not with a standing chip. ----------
const CSS = `#empBtn { display: none; height: 48px !important; font-size: 0.72rem !important; touch-action: none !important; background: rgba(28,110,70,0.78) !important; border-color: rgba(120,255,170,0.55) !important; }
#empBtn.warn { background: rgba(170,40,30,0.8) !important; border-color: rgba(255,140,90,.7) !important; }
body:not(.touch) #empBtn { font-size: 0.8rem !important; }
#empPanel { position: fixed; inset: 0; z-index: 56; display: none; align-items: flex-end; justify-content: center; background: rgba(4,6,12,.5); }
#empPanel.on { display: flex; } #empPanel .wrap { width: min(96vw, 460px); max-height: 76vh; overflow: auto; -webkit-overflow-scrolling: touch; margin-bottom: calc(8px + env(safe-area-inset-bottom)); background: rgba(12,15,26,.96); border: 1px solid rgba(255,255,255,.16); border-radius: 16px; padding: 12px 12px 10px; color: #e8ecf4; font: 13px system-ui, sans-serif; box-sizing: border-box; }
#empPanel h2 { margin: 2px 0 6px; font-size: 16px; } #empPanel .sum { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; } #empPanel .sum b { padding: 3px 8px; border-radius: 8px; background: rgba(255,255,255,.07); font-weight: 600; font-size: 12px; }
#empPanel .row { display: flex; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid rgba(255,255,255,.08); flex-wrap: wrap; } #empPanel .row > div { flex: 1 1 160px; min-width: 0; }
#empPanel small { opacity: .75; } #empPanel .warn { background: rgba(120,30,20,.55); border-radius: 10px; padding: 8px; border: 1px solid rgba(255,120,80,.5); margin-bottom: 6px; }
#empPanel .btns { display: flex; gap: 6px; flex-wrap: wrap; } #empPanel button { min-height: 44px; min-width: 64px; padding: 0 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); background: rgba(40,48,70,.95); color: #fff; font-weight: 700; font-size: 13px; touch-action: manipulation; }
#empPanel button.go { background: rgba(28,120,72,.95); } #empPanel button.bad { background: rgba(140,36,30,.95); } #empPanel button[disabled] { opacity: .45; }
#empPanel .bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.1); overflow: hidden; margin-top: 4px; } #empPanel .bar i { display: block; height: 100%; background: #3cff8a; } #empPanel .note { padding: 6px 8px; border-radius: 8px; background: rgba(60,255,138,.1); margin-bottom: 6px; }`;
// pointerdown -> pointerup on the same pointerId (never onclick); a moved finger (scroll) doesn't fire
function tapEl(el, fn, sel = null) {
  let pid = null, btn = null, x = 0, y = 0;
  el.addEventListener('pointerdown', e => { const b = sel ? e.target.closest?.(sel) : el; if (!b || (sel && !el.contains(b))) return; if (!sel) { e.preventDefault(); e.stopPropagation(); } pid = e.pointerId; btn = b; x = e.clientX; y = e.clientY; });
  el.addEventListener('pointerup', e => { if (e.pointerId !== pid) return; const b = btn; pid = null; btn = null; if (!b || b.disabled || Math.hypot(e.clientX - x, e.clientY - y) > 16) return; e.preventDefault(); e.stopPropagation(); fn(b, e); });
  el.addEventListener('pointercancel', e => { if (e.pointerId === pid) { pid = null; btn = null; } });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function ensureUi() {
  if (S.ui || typeof document === 'undefined') return S.ui; const sb = document.getElementById('surfBtns'); if (!sb) return null;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const mk = id => { const b = document.createElement('button'); b.id = id; b.className = 'glass'; sb.insertBefore(b, sb.firstChild); return b; };
  const b1 = mk('empBtn'); tapEl(b1, () => doAct());
  const panel = document.createElement('div'); panel.id = 'empPanel'; panel.innerHTML = '<div class="wrap"></div>'; document.body.appendChild(panel);
  tapEl(panel, (b, e) => { if (b === panel) { if (e.target === panel) closePanel(); return; } panelAct(b.dataset); }, 'button, #empPanel');
  addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (e.code === 'Escape' && panel.classList.contains('on')) { closePanel(); return; }
    if (e.code !== 'Backslash' || e.repeat) return; e.preventDefault(); if (panel.classList.contains('on')) closePanel(); else if (S.act) doAct(); else openPanel(); });
  S.ui = { b1, panel, wrap: panel.firstChild }; return S.ui;
}
function setAct(a) {
  const U = ensureUi(); S.act = a; if (!U) return; const l = a ? a.label + (!isTouch() ? ' (\\)' : '') : null;
  U.b1.style.display = l ? 'block' : 'none'; if (l && U.b1.textContent !== l) U.b1.textContent = l; U.b1.classList.toggle('warn', a?.key === 'defend');
}
function doAct() {
  const a = S.act; if (!a) return; const id = a.prop;
  if (a.key === 'buy' || a.key === 'manage' || a.key === 'stash') return openPanel(id);
  if (a.key === 'collect') return collect(id); if (a.key === 'repair') return openPanel(id); if (a.key === 'rest') return rest(id);
  if (a.key === 'garage') return garage(id); if (a.key === 'roverHome') return garage(id, S.tc, true);
  if (a.key === 'chopRide') return chopRide(); if (a.key === 'defend') return defend(); if (a.key === 'wake') return wakeAtHome();
}
function openPanel(id = null) { const U = ensureUi(); if (!U) return; S.panelId = id; S.note = null; renderPanel(true); U.panel.classList.add('on'); try { document.getElementById('roverMenu')?.classList.remove('show'); if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } emit('open', { prop: id }); }
function closePanel() { S.ui?.panel.classList.remove('on'); S.panelId = null; S.note = null; emit('close', {}); }
const panelOpen = () => !!S.ui?.panel.classList.contains('on');
function compass(dx, dz) { const a = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360; return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(a / 45) % 8]; }
function distTo(id) { const E = S.P[id], pl = surf()?.info; if (!E || !pl) return null; return { d: Math.round(Math.hypot(E.pl.door.x - pl.x, E.pl.door.z - pl.z)), dir: compass(E.pl.door.x - pl.x, E.pl.door.z - pl.z) }; }
const way = (id, verb) => { const p = EC.propById(id), dd = distTo(id); return `Go to the ${p.name}${dd ? ` (${dd.d} m ${dd.dir})` : ''}${verb ? ` and tap ${verb}` : ''}.`; };
function threatBox() {
  const t = D.threat; if (!t) return ''; const p = EC.propById(t.prop), G = EC.GANGS[t.gang], left = Math.max(0, Math.ceil(t.limit - t.t));
  if (t.phase === 'demand') return `<div class="warn">💸 <b>${esc(G.name)}</b> want <b>${t.demand} cr</b> to leave <b>${esc(p.name)}</b> alone. ${left} s to answer: tap Pay or Tell them no.<div class="btns" style="margin-top:6px"><button class="go" data-a="pay" ${H.credits() < t.demand ? 'disabled' : ''}>Pay ${t.demand}</button><button class="bad" data-a="refuse">Tell them no</button></div></div>`;
  if (t.phase === 'alert') { return `<div class="warn">⚠️ <b>${esc(G.name)}</b> are hitting <b>${esc(p.name)}</b>. ${esc(way(p.id, 'Defend'))} You have ${left} s.<div class="btns" style="margin-top:6px"><button data-a="mark" data-id="${p.id}">📍 Mark it</button></div></div>`; }
  return `<div class="warn">🛡️ Defending <b>${esc(p.name)}</b> against ${esc(G.name)}.</div>`;
}
function renderPanel(force) {
  const U = S.ui; if (!U || (!force && !panelOpen())) return; const ck = clock(), cr = H.credits(), id = S.panelId;
  const note = S.note ? `<div class="note">${esc(S.note)}</div>` : '';
  if (id && EC.propById(id)) { U.wrap.innerHTML = note + propHtml(EC.propById(id), cr, ck); return; }
  const owned = Object.keys(D.owned).length, pend = Math.floor(Object.values(D.owned).reduce((s, o) => s + o.pending, 0)), B = H.base(); let lots = 0; try { lots = B ? (B.owned() || []).length : 0; } catch (e) { lots = 0; }
  const rows = EC.PROPS.map(p => { const o = D.owned[p.id], K = EC.KINDS[p.kind], dd = distTo(p.id), st = !o ? `${p.price} cr` : o.closedH > 0 ? `🔨 shut ${Math.ceil(o.closedH)} h` : EC.isFront(p) ? `💵 ${Math.floor(o.pending)} / ${EC.capOf(p.kind)}` : `💰 ${o.stash.credits} cr${D.home === p.id ? ' · 🛏️ home' : ''}`;
    return `<div class="row"><div>${K.icon} <b>${esc(p.name)}</b>${o ? ' ✅' : ''}<br><small>${esc(p.dname)} · ${K.label}${dd ? ` · ${dd.d} m ${dd.dir}` : ''} · ${st}</small></div><div class="btns"><button data-a="mark" data-id="${p.id}">📍</button><button data-a="view" data-id="${p.id}">${o ? 'Manage' : 'Look'}</button></div></div>`; }).join('');
  U.wrap.innerHTML = `${note}<h2>🏢 Empire</h2><div class="sum"><b>🕒 ${ck.text}${ck.night ? ' 🌙' : ''}</b><b>${owned}/${EC.PROPS.length} owned</b><b>+${EC.perHour(D, ck.hour)} cr/h now</b><b>💵 ${pend} waiting</b>${lots ? `<b>🏠 ${lots} base lot${lots > 1 ? 's' : ''}</b>` : ''}</div>${threatBox()}${S.wake && D.home && D.owned[D.home] ? `<div class="row"><div><small>Back on your feet. You can go straight home.</small></div><div class="btns"><button class="go" data-a="wake">🏠 Back to ${esc(EC.propById(D.home).name)}</button></div></div>` : ''}
<small>Buy at the door. Fronts earn every game hour, faster at their busy time, and the till only holds so much: collect at the counter. Crews you've crossed come for them.</small>${rows}
<div class="row"><div><small>You have ${cr} cr · earned ${Math.round(D.earned)} cr so far</small></div><div class="btns">${B && typeof B.overview === 'function' ? '<button data-a="base">🏠 Base lots</button>' : ''}<button data-a="close">Close</button></div></div>`;
}
function propHtml(p, cr, ck) {
  const o = D.owned[p.id], K = EC.KINDS[p.kind], at = near(p.id), dd = distTo(p.id), c = ctxFor(p), g = EC.gangFor(p, c.turf), risk = o ? EC.threatChance(p, o, c) : EC.threatChance(p, EC.ownedState(), c);
  const riskTxt = risk <= 0 ? 'none right now' : risk < 0.03 ? 'low' : risk < 0.07 ? 'medium' : 'high'; let body = '', btns = '';
  if (EC.isFront(p)) { const now = Math.round(EC.rateAt(p.kind, ck.hour)), cap = EC.capOf(p.kind), pend = o ? Math.floor(o.pending) : 0;
    body = `<div class="row"><div>Earns <b>${now} cr/h</b> right now (${ck.band}), about ${Math.round(EC.avgRate(p.kind))} cr/h over a day. Till holds ${cap}.${o ? `<div class="bar"><i style="width:${Math.round(100 * pend / cap)}%"></i></div><small>${pend} cr waiting${o.closedH > 0 ? ` · shut for ${Math.ceil(o.closedH)} game h` : ''}</small>` : ''}</div></div>`;
    if (o) { btns += `<button class="go" data-a="collect" data-id="${p.id}" ${!at || pend < 1 || o.closedH > 0 ? 'disabled' : ''}>💵 Collect ${pend}</button>`; if (o.closedH > 0) btns += `<button data-a="repair" data-id="${p.id}" ${cr < EC.repairCost(p) ? 'disabled' : ''}>🔨 Fix ${EC.repairCost(p)}</button>`; } }
  else if (o) { body = `<div class="row"><div>💰 Stash: <b>${o.stash.credits} cr</b> · ${o.stash.medkits} 🩹 <small>(a bust or med-evac can't touch it)</small><br><small>${D.home === p.id ? '🛏️ You wake up here after a bust or med-evac.' : 'Rest here to make it home.'}</small></div></div>`;
    btns += `<button class="go" data-a="rest" data-id="${p.id}" ${at ? '' : 'disabled'}>🛏️ Rest & save</button><button data-a="dep" data-n="100" data-id="${p.id}" ${at && cr >= 100 ? '' : 'disabled'}>+100</button><button data-a="dep" data-n="${cr}" data-id="${p.id}" ${at && cr > 0 ? '' : 'disabled'}>+All</button><button data-a="dep" data-n="-100" data-id="${p.id}" ${at && o.stash.credits > 0 ? '' : 'disabled'}>−100</button><button data-a="dep" data-n="${-o.stash.credits}" data-id="${p.id}" ${at && o.stash.credits > 0 ? '' : 'disabled'}>−All</button><button data-a="med" data-n="1" data-id="${p.id}" ${at && H.medkits() > 0 ? '' : 'disabled'}>🩹+1</button><button data-a="med" data-n="-1" data-id="${p.id}" ${at && o.stash.medkits > 0 ? '' : 'disabled'}>🩹−1</button>`; }
  if (!o) btns = `<button class="go" data-a="buy" data-id="${p.id}" ${at && cr >= p.price ? '' : 'disabled'}>🔑 Buy ${p.price} cr</button>` + btns;
  else if (!o.security) btns += `<button data-a="sec" data-id="${p.id}" ${cr < EC.securityCost(p) ? 'disabled' : ''}>🔒 Security ${EC.securityCost(p)}</button>`;
  if (o && p.garage && H.garageOpen() && !S.tc?.car && at) btns += `<button data-a="roverHome" data-id="${p.id}">🚙 Park rover</button>`;
  const note = !o ? (at ? (cr >= p.price ? '' : `<small>You have ${cr} cr.</small>`) : `<small>${esc(way(p.id, 'Buy'))}</small>`) : (!at && (EC.isFront(p) || p.kind === 'safehouse') ? `<small>${esc(way(p.id, EC.isFront(p) ? 'Collect' : 'Rest'))}</small>` : '');
  return `<h2>${K.icon} ${esc(p.name)}</h2><small>${esc(p.dname)} · ${K.label}${o ? ' · ✅ yours' : ` · ${p.price} cr`}${o?.security ? ' · 🔒' : ''}</small>${threatBox()}
<div class="row"><div>${esc(p.blurb)}<br><small>Turf: ${esc(EC.GANGS[g].name)}${c.rep != null ? ` (rep ${c.rep})` : ''} · raid risk ${riskTxt}${o?.protect ? ` · protected ${Math.ceil(o.protect.h)} h` : ''}${p.garage ? ' · 🚗 garage spot' : ''}</small></div></div>${body}
${note}<div class="row btns">${btns}<button data-a="back">◀ All</button><button data-a="close">Close</button></div>`;
}
function panelAct(ds) {
  const a = ds.a, id = ds.id; let r = null;
  if (a === 'close') return closePanel(); if (a === 'back') { S.panelId = null; return renderPanel(); } if (a === 'view') { S.panelId = id; return renderPanel(); }
  if (a === 'mark') { const E = S.P[id]; if (E) { S.target = id; updateMarks(true); S.note = `📍 ${way(id)} It's the yellow ring on the radar.`; renderPanel(); } return; }
  if (a === 'wake') { closePanel(); wakeAtHome(); return; } if (a === 'roverHome') { r = garage(id, S.tc, true); if (r && !r.ok && r.why) toast('❌ ' + r.why, 2200); renderPanel(); return; }
  if (a === 'base') { closePanel(); try { H.base()?.overview?.(); } catch (e) { /* */ } return; }
  if (a === 'pay') r = pay(); else if (a === 'refuse') r = refuse(); else if (a === 'buy') r = buy(id); else if (a === 'collect') r = collect(id); else if (a === 'sec') r = upgrade(id); else if (a === 'repair') r = repair(id);
  else if (a === 'rest') r = rest(id); else if (a === 'dep') r = stashMove(id, { credits: +ds.n }); else if (a === 'med') r = stashMove(id, { medkits: +ds.n });
  if (r && !r.ok && r.why) toast('❌ ' + r.why, 2200); renderPanel();
}
// every whole game hour, fronts or not (income is separate and unchanged): SSX.empire.on('hour', ({ hour, prev, at, catchUp, source, night, band, fronts }) => …)
const hourTicker = EC.makeHourTicker(clock, d => emit('hour', { ...d, fronts: Object.keys(D?.owned || {}).filter(id => EC.isFront(EC.propById(id) || {})).length }));
function updateMarks(force) {
  const mk = []; for (const { p, pl } of Object.values(S.P)) { const o = D.owned[p.id], hot = D.threat?.prop === p.id; if (!o && S.target !== p.id) continue;
    mk.push({ x: pl.x, z: pl.z, color: hot ? '#ff3030' : o ? '#3cff8a' : '#ffd040', r: hot || S.target === p.id ? 3.4 : 2.4 }); }
  const key = JSON.stringify(mk); if (!force && key === S.markKey) return; S.markKey = key; H.marks('empire', mk);
}

// ---------- per frame ----------
function nearest(px, pz) { let best = null, bd = 1e9; for (const E of Object.values(S.P)) { const d = Math.hypot(px - E.pl.door.x, pz - E.pl.door.z); const gd = E.pl.garage ? Math.hypot(px - E.pl.garage.x, pz - E.pl.garage.z) : 1e9; const m = Math.min(d, gd, E.pl.chopBay ? Math.hypot(px - E.pl.chopBay.x, pz - E.pl.chopBay.z) : 1e9); if (m < bd) { bd = m; best = { E, d, gd, cd: E.pl.chopBay ? Math.hypot(px - E.pl.chopBay.x, pz - E.pl.chopBay.z) : 1e9 }; } } return best; }
function empireTick(dt, tc) {
  const t0 = performance.now(); S.tc = tc; S.mobile = !!tc.isMobile; hourTicker.pump(); // any world, before the Mars-only early return
  if (!S.on || !/mars/i.test(tc.name || '')) { if (S.root) S.root.visible = false; if (S.act) setAct(null); return; }
  if (!buildAll(tc)) return; S.root.visible = true;
  // clock -> income
  const ck = clock(); if (D.lastHour == null) D.lastHour = ck.hour; const hrs = EC.hoursBetween(D.lastHour, ck.hour); D.lastHour = ck.hour;
  if (hrs > 0) { const got = EC.accrue(D, (ck.hour - hrs + 24) % 24, hrs); if (got > 0) { dirty(); S.incomeAcc = (S.incomeAcc || 0) + got; } S.rollAcc += hrs;
    while (S.rollAcc >= 1) { S.rollAcc -= 1; if (!S.force.noThreats) { const th = EC.rollThreat(D, ctxFor); if (th) startThreat(th); else rollBaseRaid(); } if (S.incomeAcc >= 1) { emit('income', { amount: Math.round(S.incomeAcc), perHour: EC.perHour(D, ck.hour), hour: ck.hour }); S.incomeAcc = 0; } } }
  const px = tc.car ? tc.car.x : tc.player.x, pz = tc.car ? tc.car.z : tc.player.z;
  threatTick(dt, tc, px, pz); pushOut(tc);
  // cull + beacon pulse
  for (const E of Object.values(S.P)) { const far = Math.hypot(px - E.pl.x, pz - E.pl.z) > 380; E.m.g.visible = !far; if (E.m.pad) E.m.pad.visible = !far && !!D.owned[E.p.id]; }
  if (D.threat && S.P[D.threat.prop]) { S.beaconT += dt; MAT.beacon.opacity = 0.22 + 0.18 * Math.sin(S.beaconT * 5); }
  // wake-at-home after a bust / med-evac
  const down = !!game()?.isDown?.(); if (S.wasDown && !down && D.home && D.owned[D.home]) { S.wake = { t: 60 }; toast(`🏠 Back on your feet. To go home to the ${EC.propById(D.home).name}, open the ☰ menu, tap Empire, then tap Back.`, 4200); } S.wasDown = down; if (S.wake && (S.wake.t -= dt) <= 0) S.wake = null;
  // context
  const busy = tc.world?.inside || panelOpen() || !!document.getElementById('hsSafe') || !!SSX()?.base?.building || down;
  let a = null; const n = nearest(px, pz), speed = Math.abs(tc.car?.speed || 0);
  if (n && n.E && Math.min(n.d, n.gd, n.cd) < EC.RULES.defendR) { const p = n.E.p, o = D.owned[p.id];
    const c = EC.contextFor({ prop: p, d: p.kind === 'chop' && tc.car ? Math.min(n.d, n.cd) : n.d, garageD: n.gd, owned: o, threat: D.threat, driving: !!tc.car, stolen: !!tc.car && tc.car !== tc.rover, speed, busy, credits: H.credits(), garageOpen: !!H.garageOpen() });
    if (c) a = { ...c, prop: p.id }; }
  setAct(a);
  if ((S.markT -= dt) <= 0) { S.markT = 1; updateMarks(); if (panelOpen()) renderPanel(); }
  if (S.dirty && (S.saveT -= dt) <= 0) { S.saveT = 5; save(); }
  S.frameMs += (performance.now() - t0 - S.frameMs) * 0.1;
}

// ---------- public API: window.SSX.empire ----------
function propView(p) { const o = D.owned[p.id], E = S.P[p.id]; return { id: p.id, kind: p.kind, name: p.name, district: p.district, districtName: p.dname, price: p.price, aj: [...p.aj], owned: !!o,
  pending: o ? Math.floor(o.pending) : 0, cap: EC.capOf(p.kind), perHour: Math.round(EC.rateAt(p.kind, clock().hour)), closedH: o ? +o.closedH.toFixed(2) : 0, security: !!o?.security, protect: o?.protect ? { ...o.protect } : null,
  stash: o && p.kind === 'safehouse' ? { ...o.stash } : null, door: E ? { x: +E.pl.door.x.toFixed(1), z: +E.pl.door.z.toFixed(1) } : null, garage: E?.pl.garage ? { x: +E.pl.garage.x.toFixed(1), z: +E.pl.garage.z.toFixed(1) } : null, pos: E ? { x: E.pl.x, z: E.pl.z } : null }; }
export const empire = {
  get ready() { return S.ready && S.built; }, version: 1, key: EC.SAVE_KEY,
  props: () => EC.PROPS.map(propView), prop: id => { const p = EC.propById(id); return p ? propView(p) : null; }, owned: () => Object.keys(D.owned),
  buy, collect, upgrade, repair, rest, deposit: (id, o = {}) => stashMove(id, { credits: Math.abs(o.credits | 0), medkits: Math.abs(o.medkits | 0) }), withdraw: (id, o = {}) => stashMove(id, { credits: -Math.abs(o.credits | 0), medkits: -Math.abs(o.medkits | 0) }),
  garage: (id, o = {}) => garage(id, S.tc, !!o.park), chopRide: () => chopRide(), wake: () => wakeAtHome(), home: () => D.home,
  pending: () => Math.floor(Object.values(D.owned).reduce((s, o) => s + o.pending, 0)), perHour: () => EC.perHour(D, clock().hour), clock,
  threat: () => D.threat ? { ...D.threat, left: Math.max(0, Math.round(D.threat.limit - D.threat.t)), engine: S.defense?.engine || null } : null, pay, refuse, defend,
  open: id => openPanel(id || null), close: closePanel, get isOpen() { return panelOpen(); }, action: () => S.act?.key || null, action2: () => null /* one context button only; second actions live in the sheet */,
  stats: () => ({ ...D.stats, earned: Math.round(D.earned) }), log: () => D.log.slice(), frameMs: () => +S.frameMs.toFixed(3), setEnabled(on) { S.on = !!on; return S.on; }, get enabled() { return S.on; },
  save, reload() { D = load(); S.built = false; refreshLooks(); return true; },
  on(evt, fn) { if (typeof fn !== 'function') throw new Error('SSX.empire.on(event, fn)'); (listeners[evt] ||= []).push(fn); return () => empire.off(evt, fn); },
  hour: () => ({ last: hourTicker.last, fired: hourTicker.fired }),
  off(evt, fn) { const L = listeners[evt]; if (L) { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); } },
  debug: {
    goto(id, where = 'door') { const E = S.P[id], sf = surf(); if (!E || !sf) return false; const q = where === 'garage' ? E.pl.garage : where === 'chop' ? E.pl.chopBay : where === 'near' ? E.pl.at(0, E.pl.d / 2 + 14) : where === 'yard' ? E.pl.at(-5, E.pl.d / 2 + 19) : E.pl.door; if (!q) return false; sf.debugMove(q.x, q.z, E.pl.yaw); return { x: q.x, z: q.z }; },
    tick(hours, h) { const ck = clock(); const got = EC.accrue(D, h ?? ck.hour, hours); dirty(); return Math.round(got); },
    threat(id, kind = 'raid', gang) { const p = EC.propById(id); if (!p || !D.owned[id]) return null; if (D.threat) { if (S.defense?.engine === 'raids') try { H.raids()?.stop?.(S.defense.id); } catch (e) { /* */ } S.defense = null; D.threat = null; }
      const c = ctxFor(p), g = gang || EC.gangFor(p, c.turf); startThreat({ prop: id, gang: g, kind, demand: kind === 'extort' ? EC.demand(p, D.owned[id]) : 0, t: 0, phase: kind === 'extort' ? 'demand' : 'alert', limit: kind === 'extort' ? EC.RULES.replyS : (S.mobile ? EC.RULES.arriveSPhone : EC.RULES.arriveS) }); return empire.threat(); },
    expire() { if (D.threat) D.threat.t = D.threat.limit + 1; return true; },
    win() { const df = S.defense; if (!D.threat) return false; if (df?.engine === 'raids') { S.defense = { ...df, id: '__done' }; try { H.raids()?.stop?.(df.id, 'debug'); } catch (e) { /* */ } S.defense = df; } endDefense('win', { kills: 0 }); return true; },
    hourPump: () => hourTicker.pump(),
    force(o = {}) { Object.assign(S.force, o); return { ...S.force }; }, grant(id) { if (!EC.propById(id) || D.owned[id]) return false; EC.buy(D, id); D.owned[id].graceH = 0; save(); refreshLooks(); return true; },
    setPending(id, n) { const o = D.owned[id]; if (!o) return false; o.pending = n; return true; }, reset() { D = EC.fresh(); save(); refreshLooks(); updateMarks(true); return true; },
    state: () => JSON.parse(JSON.stringify(D)), defense: () => S.defense ? { ...S.defense } : null, roll: (rng) => { const th = EC.rollThreat(D, ctxFor, rng); if (th) startThreat(th); return th; },
    meshes: () => Object.fromEntries(Object.entries(S.P).map(([k, E]) => [k, { visible: E.m.g.visible, sale: E.m.sale.visible, beacon: E.m.beacon.visible }])), offline: () => S.offline
  }
};

// boot: wait for the app, then install the API, the ☰ entry and the surface tick (a no-op off Mars)
(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 250); return; }
  if (window.SSX.empire) return; window.SSX.empire = empire; window.__app.empire = empire;
  // listeners queued before this loaded: (SSX._pendingEmpire ||= []).push(['hour', fn]) or window.SSX_pending.empire (survives the
  // core replacing window.SSX at boot). Drained once here; after boot just call SSX.empire.on.
  for (const q of [window.SSX._pendingEmpire, window.SSX_pending?.empire]) while (Array.isArray(q) && q.length) { const [evt, fn] = q.shift() || []; try { if (typeof evt === 'string' && typeof fn === 'function') empire.on(evt, fn); } catch (e) { /* never throws */ } }
  hourTicker.pump(); setInterval(() => { try { hourTicker.pump(); } catch (e) { /* */ } }, 1000); // off Mars and in space too
  S.offline = EC.offline(D); if (S.offline.total > 0) { save(); setTimeout(() => toast(`🏢 While you were away your fronts took in ${S.offline.total} cr. Go to each one and tap Collect at the door.`, 3600), 4000); }
  try { window.SSX.registerMenuItem({ id: 'rmEmpire', label: '🏢 Empire', onTap: () => openPanel() }); } catch (e) { console.warn('empire menu', e); }
  window.SSX.registerSurfaceTick((dt, tc) => { try { empireTick(dt, tc); } catch (e) { console.warn('empire tick', e); } });
  addEventListener('pagehide', () => { try { save(); } catch (e) { /* */ } });
  S.ready = true; emit('ready', { owned: Object.keys(D.owned).length });
})();
