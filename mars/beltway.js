// v7.5.1 Ares Beltway highway crime (Marsmania): four activities on the existing Beltway, all riding the core highway
// systems in world.js instead of adding new ones: the live lane traffic (haulers become convoy / armored-transport
// targets), the four checkpoints (ColSec scans, the Helios gate, the Saltblood toll) and Pumpkin's street-race engine
// (race.js, through window.__race) for the night races. Self-contained add-on loaded by one <script type="module"> in
// index.html. Talks to the game only through window.__app (surface, game, world, toast, state) and window.SSX.
// Integrations are feature-detected: SSX.contraband (fence cargo into your stash), SSX.minimap.addMarks, SSX.city.hostiles,
// SSX.time.isNight (if a day/night cycle ever ships), window.__race (falls back to a built-in gate sprint).
// Fiction only: invented colony, invented crews and cargo, no real brands.
import * as THREE from 'three';

/**
 * window.SSX.beltway — public API (positions: world metres unless noted)
 *  start(type, opts?)  -> { ok, msg }  type: 'hijack' | 'armored' | 'shakedown' | 'race'
 *                         opts.checkpoint (shakedown: cp id), opts.force (race: ignore the night rule)
 *  stop(why?)          -> { ok }      abandon the current activity (no payout, heat stays)
 *  active()            -> null | { type, phase, target?, hp?, hpMax?, cargo?, gross?, checkpoint?, timeLeft?, race? }
 *  on(event, fn) | on(fn) -> unsubscribe. Events: 'start' 'target' 'hit' 'disabled' 'cargo' 'fenced' 'loot' 'payout'
 *                         'shakedown' 'race' 'fail' 'stop' 'change'. fn gets { type, activity, ... }.
 *  activities           -> [{ id, name, key, blurb }]
 *  crew() / setCrew(id, on) -> armored-transport crew [{ id, name, role, cut, perk, on }]
 *  isNight() / nightIn() -> Beltway sol clock (races run at night); waitForDark()
 *  open() / close()     -> the Beltway panel (☰ "🛣️ Beltway", key . (period; O is the control-mode toggle), phone dock 🛣️). Key I = context action (#beltAct).
 *  stats()              -> { hijacks, armored, shakedowns, races, earned }
 *  debug                -> toRoad(s?), target(), disable(), toTarget(), toFence(), toCheckpoint(id?), finishCrack(),
 *                          clearHeat(), setNight(bool), finishRace(won?), state(), reset()
 * Also emits window event 'ssx:beltway' and SSX.emit('beltway:<event>') on the core bus.
 * Persistence: localStorage 'ssx.beltway.v1' (crew picks, booth cooldowns, stats, sol-clock offset).
 */

const KEY = 'ssx.beltway.v1';
const FENCE_AJ = [-292, -18];   // Kettle's chop lot, west edge of Red Tape Flats (AJ-relative), right off the rn-east ramp
const SOL_MS = 20 * 60e3, DUSK = 0.6; // one Beltway sol = 20 real minutes, night for the last 40%
const ACTS = [
  { id: 'hijack', name: 'Convoy hijack', icon: '🚚', blurb: 'Pick a cargo hauler out of Beltway traffic, ram or shoot it dead, grab the crates and fence them at Kettle\u2019s lot.' },
  { id: 'armored', name: 'Armored transport', icon: '🛡️', blurb: 'A ColSec bullion run is in the hauler lane. Stop it, crack the doors, then lose 4 stars. Your crew takes their cut.' },
  { id: 'shakedown', name: 'Toll shakedown', icon: '💢', blurb: 'Lean on a checkpoint booth for its till. Every faction answers differently.' },
  { id: 'race', name: 'Night street race', icon: '🏁', blurb: 'After dark only. Ares Junction to the East cut, through the ColSec speed trap, against Vesper Kade.' }
];
const CREW = [
  { id: 'dex', name: 'Dex \u201cClutch\u201d Varga', role: 'Wheelman', cut: 15, perk: 'boxes the transport in: it runs 30% slower' },
  { id: 'ivo', name: 'Ivo Mardle', role: 'Muscle', cut: 20, perk: 'heavy rounds: your hits do 60% more' },
  { id: 'wren', name: 'Wren Okafor-Sato', role: 'Splicer', cut: 10, perk: 'cracks the doors in 2 s and scrambles the alert (3\u2605 not 4\u2605)' }
];
const CARGO = [
  { item: 'hot_plates', name: 'hot plates', qty: 4, cr: 240 }, { item: 'salvage', name: 'salvage', qty: 5, cr: 200 },
  { item: 'cold_cell', name: 'cold cells', qty: 3, cr: 260 }, { item: 'red_dust_whiskey', name: 'red-dust whiskey', qty: 4, cr: 220 }
];
const ARMOR_GROSS = 1200, HAULER_HP = 100, ARMOR_HP = 220, RAM_DMG = 34, CRACK_T = 5, ESCAPE_T = 240, CHASE_LOST = 205;
const RACE_DEF = {
  id: 'beltway-night-run', world: 'Mars', name: 'Beltway Night Run', loop: false, laps: 1, par: 46, anchor: 'colony', purse: 260,
  rival: { name: 'Vesper Kade', kind: 'buggy' }, illegal: true,
  blurb: 'Unsanctioned sprint down the Beltway: Ares Junction south to the East cut, straight through the ColSec speed trap.',
  gates: [[0, -70], [0, -140], [0, -220], [0, -300], [0, -380], [30, -428], [90, -360], [140, -280], [180, -205]], props: []
};

// ---------- state ----------
let S = load();
function fresh() { return { v: 1, crew: { dex: true, ivo: true, wren: true }, cool: {}, stats: { hijacks: 0, armored: 0, shakedowns: 0, races: 0, earned: 0 }, solOff: 0 }; }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && s.stats) return { ...fresh(), ...s, crew: { ...fresh().crew, ...s.crew } }; } catch (e) { /* bad json */ } return fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };

// ---------- plumbing ----------
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const toast = (m, ms = 3200) => app()?.toast?.(m, ms);
const radio = (text, contact) => { try { if (window.SSX?.city?.radio) return window.SSX.city.radio(text, contact); } catch (e) { /* fall through */ } toast(`📻 ${contact}: ${text}`, 4200); };
const subs = new Map();
function emit(type, extra = {}) {
  const ev = { type, activity: run?.type || extra.activity || null, ...extra };
  for (const k of [type, '*']) for (const f of subs.get(k) || []) { try { f(ev); } catch (e) { console.warn('beltway listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:beltway', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('beltway:' + type, ev); } catch (e) { /* bus optional */ }
  if (type !== 'change') emit('change', { what: type });
}
function on(a, b) { const [k, f] = typeof a === 'function' ? ['*', a] : [String(a), b]; if (typeof f !== 'function') return () => {}; if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(f); return () => subs.get(k)?.delete(f); }
function here() { const s = surf(), i = s?.info; if (!i || i.name !== 'Mars' || !i.colony) return null; return { x: i.x, z: i.z, info: i, cx: i.colony.x, cz: i.colony.z }; }
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const dirTo = (fx, fz, tx, tz) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(tx - fx, -(tz - fz)) * 180 / Math.PI) + 360) % 360 / 45) % 8];
const pick = a => a[Math.floor(Math.random() * a.length)];
const wanted = () => world()?.wanted || 0;
const setWanted = (n, why) => { try { world()?.setWanted?.(Math.max(0, Math.min(5, n)), why); } catch (e) { /* optional */ } };
const pay = (cr, xp = 0) => { const g = game(); if (!g || !cr) return 0; if (g.reward) g.reward(xp, cr); else if (g.bonus) g.bonus(cr); S.stats.earned += cr; save(); return cr; };
const credits = () => game()?.progress?.credits ?? null;
const hostiles = (types, x, z, faction) => { try { if (window.SSX?.city?.hostiles) return window.SSX.city.hostiles(types, x, z, { faction, src: 'beltway', aggro: true }); return game()?.hostiles?.(types, x, z, { faction, src: 'beltway' }) || 0; } catch (e) { console.warn('beltway hostiles', e); return 0; } };
const crewOn = () => CREW.filter(c => S.crew[c.id]);
const hasPerk = id => run?.type === 'armored' && run.crew.includes(id);
function isNight() { try { const f = window.SSX?.time?.isNight; if (typeof f === 'function') return !!f(); } catch (e) { /* fall back */ } return solT() >= DUSK; }
function solT() { return (((Date.now() + S.solOff) % SOL_MS) + SOL_MS) % SOL_MS / SOL_MS; }
function nightIn() { return isNight() ? 0 : Math.round((DUSK - solT()) * SOL_MS / 1000); }
function waitForDark() { if (isNight()) return { ok: true, msg: 'It\u2019s already dark.' }; const T = window.SSX?.time; if (typeof T?.isNight === 'function' && typeof T.set === 'function') { T.set(T.NIGHT_START ?? 21); emit('change', { what: 'night' }); return { ok: true, msg: '🌙 You kill the engine and wait for dark.' }; } /* v7.5.4: shared Mars clock */ S.solOff += (DUSK - solT()) * SOL_MS + 2000; save(); emit('change', { what: 'night' }); return { ok: true, msg: '🌙 You kill the engine and wait for dark. The Beltway lights come on.' }; }

// ---------- ground height (raycast the terrain chunks; fallback: the player's feet) ----------
const ray = new THREE.Raycaster(), V0 = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
let terrain = [], terrT = 0;
function terrainMeshes(scene) {
  const now = performance.now(); if (now - terrT < 1500 && terrain.length) return terrain; terrT = now;
  const count = new Map(); for (const c of scene.children) { const m = c.isGroup && c.children[0]; if (m?.isMesh && m.material) count.set(m.material, (count.get(m.material) || 0) + 1); }
  let mat = null, n = 3; for (const [k, v] of count) if (v > n) { n = v; mat = k; }
  terrain = mat ? scene.children.filter(c => c.isGroup && c.children[0]?.material === mat).map(c => c.children[0]) : [];
  return terrain;
}
function groundY(wx, wz, fallback) {
  const s = surf(); if (window.SSX?.height) { try { const y = window.SSX.height(wx, wz); if (Number.isFinite(y)) return y; } catch (e) { /* fall through */ } }
  if (!s?.scene) return fallback; const list = terrainMeshes(s.scene); if (!list.length) return fallback;
  V0.set(wx, 4000, wz); ray.set(V0, DOWN); ray.far = 8000; const hit = ray.intersectObjects(list, false)[0]; return hit ? hit.point.y : fallback;
}

// ---------- world presence: one marker beacon (follows the target hauler, or sits on the booth / fence / gate) ----------
const hex = c => '#' + c.toString(16).padStart(6, '0');
function labelTex(text, col) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64; const x = c.getContext('2d');
  let fs = 28; x.font = `bold ${fs}px system-ui, sans-serif`; while (fs > 14 && x.measureText(text).width > 290) { fs -= 2; x.font = `bold ${fs}px system-ui, sans-serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; const w = Math.min(314, x.measureText(text).width + 26);
  x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(160 - w / 2, 8, w, 48); x.fillStyle = col; x.fillText(text, 160, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let mark = null;
function setMark(text, col, r = 5) {
  const s = surf(); if (!s?.scene) return;
  if (mark && (mark.parent !== s.scene)) clearMark();
  if (!mark) {
    const g = new THREE.Group(); g.name = 'mars-beltway-mark';
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 15; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; g.add(ring);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, hex(col)), transparent: true, depthWrite: false })); sp.position.y = 5.2; sp.scale.set(5, 1, 1); g.add(sp);
    g.userData = { beam, ring, sp, text, col, r }; s.scene.add(g); mark = g; return;
  }
  const u = mark.userData;
  if (u.text !== text) { u.sp.material.map?.dispose(); u.sp.material.map = labelTex(text, hex(col)); u.sp.material.needsUpdate = true; u.text = text; }
  if (u.col !== col) { u.col = col; u.beam.material.color.setHex(col); u.ring.material.color.setHex(col); }
}
function placeMark(x, z, y) { if (!mark) return; mark.position.set(x, y ?? groundY(x, z, here()?.info.y - 1.7 || 0), z); mark.userData.ring.material.opacity = 0.35 + 0.25 * Math.sin(performance.now() / 180); }
function clearMark() { if (!mark) return; mark.parent?.remove(mark); mark.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); mark = null; }
let mmT = 0;
function minimap(x, z, color) { const m = window.SSX?.minimap; if (!m?.addMarks) return; const n = performance.now(); if (n - mmT < 900 && x != null) return; mmT = n; try { if (x == null) m.clear?.('beltway'); else m.addMarks('beltway', [{ x, z, color, r: 5, clamp: true }]); } catch (e) { /* optional */ } }

// ---------- traffic + checkpoints: read the core highway (world.js registerHighway) ----------
function hw() { try { return world()?.highway?.() || null; } catch (e) { return null; } }
function roadInfo(x, z) { const H = hw(); if (!H?.project) return null; try { return H.project(x, z); } catch (e) { return null; } }
function liveHaulers() { // live traffic objects (they sit in world.vehicles; debug.traffic gives us where to look)
  const w = world(); const list = w?.debug?.traffic?.() || []; const out = [];
  for (const t of list) { if (t.kind !== 'hauler' || t.cop) continue; const v = w.nearVehicle?.(t.x, t.z, 1.5); if (v && v.traffic && v.kind === 'hauler' && !v.__belt) out.push(v); }
  return out;
}
const alive = v => !!(v && v.group?.parent); // despawnCar() removes it from the scene
function checkpoints() { return (hw()?.checkpoints || []).map(c => ({ ...c })); }
function nearestCheckpoint(x, z) { let best = null, bd = 1e9; for (const c of checkpoints()) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } } return best; }
function fenceAt(h) { return { x: h.cx + FENCE_AJ[0], z: h.cz + FENCE_AJ[1] }; }

// ---------- activities ----------
let run = null; // { type, phase, t, ... }
const ACT = id => ACTS.find(a => a.id === id);
function start(type, opts = {}) {
  const h = here(), st = app()?.state;
  if (!ACT(type)) return { ok: false, msg: `No Beltway job called "${type}".` };
  if (!h || !st?.onSurface) return { ok: false, msg: 'Land on Mars first. The Beltway rings Ares Junction.' };
  if (h.info.inside) return { ok: false, msg: 'Get outside first.' };
  if (run) return { ok: false, msg: `Already on a ${ACT(run.type).name.toLowerCase()}. Quit it first.` };
  if (type === 'race') return startRace(h, opts);
  run = { type, phase: '', t: 0, started: Date.now(), target: null, hp: 0, hpMax: 0, crew: [], cargo: null };
  if (type === 'hijack') { run.phase = 'scout'; run.t = 120; run.cargo = pick(CARGO); radio(`Haulers carry ${run.cargo.name} down the Beltway all day. Pick one, kill its drive, and bring me the crates. Kettle\u2019s lot, Red Tape Flats.`, 'Kettle'); }
  else if (type === 'armored') { run.phase = 'scout'; run.t = 150; run.crew = crewOn().map(c => c.id); radio(`Bullion run\u2019s rolling. ${run.crew.length ? `Crew\u2019s in: ${crewOn().map(c => c.name.split(' ')[0]).join(', ')}.` : 'You\u2019re solo. Brave.'} Stop the armored hauler, crack it, then lose the heat.`, 'Wren'); }
  else if (type === 'shakedown') {
    const cps = checkpoints(); if (!cps.length) { run = null; return { ok: false, msg: 'No checkpoints on this road.' }; }
    const c = (opts.checkpoint && cps.find(k => k.id === opts.checkpoint)) || nearestCheckpoint(h.x, h.z);
    const cd = (S.cool[c.id] || 0) - Date.now(); if (cd > 0 && !opts.force) { run = null; return { ok: false, msg: `${c.name} still remembers your face. Try again in ${fmtT(cd / 1000)}.` }; }
    run.phase = 'go'; run.cp = c; run.t = 0;
  }
  emit('start', { activity: type }); renderHud(); refreshAct(true);
  return { ok: true, msg: `${ACT(type).icon} ${ACT(type).name}: ${type === 'shakedown' ? `head to ${run.cp.name}.` : 'find the hauler on the Beltway.'}` };
}
function stop(why = 'quit') {
  if (!run) return { ok: false };
  const r = run; run = null;
  if (r.target && alive(r.target) && r.target.traffic) { const t = r.target.traffic; if (t.wreck > 1e5) t.wreck = 3; if (r.vmax0) t.vmax = r.vmax0; }
  if (r.target) delete r.target.__belt;
  if (r.type === 'race' && r.engine === 'race.js' && window.__race?.state) { try { window.__race.quit(); } catch (e) { /* gone */ } }
  clearMark(); minimap(null); emit('stop', { activity: r.type, why });
  renderHud(); refreshAct(true); return { ok: true };
}
function fail(msg, why = 'fail') { toast(`✖ ${msg}`, 3400); emit('fail', { why, msg }); stop('fail'); }
function finish(msg) { toast(msg, 4200); stop('done'); }

// -- hijack / armored --
function pickTarget(h) {
  let best = null, bd = 190; for (const v of liveHaulers()) { const d = Math.hypot(v.x - h.x, v.z - h.z); if (d < bd) { bd = d; best = v; } } return best;
}
function lockTarget(v) {
  run.target = v; v.__belt = run.type; run.phase = 'chase'; run.hpMax = run.hp = run.type === 'armored' ? ARMOR_HP : HAULER_HP; run.t = run.type === 'armored' ? 150 : 120; run.lastWreck = v.traffic?.wreck || 0;
  if (run.type === 'armored') { run.vmax0 = v.traffic.vmax; v.traffic.vmax *= hasPerk('dex') ? 0.7 : 1.15; }
  emit('target', { kind: v.kind, x: v.x, z: v.z });
  toast(run.type === 'armored' ? '🛡️ Armored transport spotted in the hauler lane. Stop it.' : `🚚 Hauler marked: ${run.cargo.qty}× ${run.cargo.name}. Ram it or shoot it.`, 3000);
}
function hitTarget(dmg, how) {
  if (!run || run.phase !== 'chase' || !run.target) return;
  const d = Math.max(1, dmg * (hasPerk('ivo') ? 1.6 : 1)); run.hp = Math.max(0, run.hp - d); emit('hit', { how, dmg: d, hp: run.hp });
  if (run.type === 'armored' && !run.alerted) { run.alerted = true; setWanted(Math.max(wanted(), 2), 'attacked an armored transport'); }
  if (run.hp <= 0) disable();
}
function disable() {
  const v = run.target, t = v?.traffic; if (!v) return;
  if (t) { t.wreck = 1e6; t.v = 0; } v.speed = 0; run.phase = run.type === 'armored' ? 'crack' : 'grab'; run.t = 90; run.crackT = 0;
  emit('disabled', { x: v.x, z: v.z });
  if (run.type === 'armored') { const lvl = hasPerk('wren') ? 3 : 4; setWanted(Math.max(wanted(), lvl), 'armored transport robbery'); hostiles(['guard', 'guard'], v.x + 5, v.z + 5, 'ColSec'); toast(`🛡️ Transport down! ${lvl}★. Crack the doors (I) before ColSec boxes you in.`, 3200); }
  else { toast('🚚 Hauler\u2019s dead in the lane. Get out and grab the crates (8).', 3000); if (world()?.hostileAt?.(v.x, v.z)) world().crime?.(1, 'hijacked a hauler'); }
}
function grabCargo() {
  if (!run || run.phase !== 'grab') return { ok: false };
  run.phase = 'deliver'; run.t = 240; if (run.target?.traffic) run.target.traffic.wreck = 6; if (run.target) delete run.target.__belt; run.target = null;
  setWanted(Math.max(wanted(), 1), 'cargo theft'); S.stats.hijacks++; save();
  emit('cargo', { item: run.cargo.item, qty: run.cargo.qty });
  radio(`Got the ${run.cargo.name}? Kettle\u2019s lot, west edge of the Flats. Don\u2019t bring the blue lights.`, 'Kettle');
  return { ok: true, msg: `📦 ${run.cargo.qty}× ${run.cargo.name} loaded. Fence them at Kettle\u2019s lot.` };
}
function fenceOptions() {
  if (!run || run.phase !== 'fence') return [];
  const c = run.cargo, C = window.SSX?.contraband, out = [{ id: 'cash', label: `💵 Sell it all to Kettle: ${c.cr} cr` }];
  try { if (C && typeof C.add === 'function' && C.items?.().some(i => i.id === c.item)) { const cap = C.capacity?.(); const room = cap ? Math.max(0, cap.max - cap.used) : c.qty; const q = Math.min(c.qty, room); if (q > 0) out.push({ id: 'stash', label: `🎒 Keep ${q}× ${c.name} for the street (+${Math.round(c.cr * 0.25 * (q / c.qty))} cr finder\u2019s fee)`, qty: q }); } } catch (e) { /* contraband optional */ }
  return out;
}
function fence(choice = 'cash') {
  if (!run || run.phase !== 'fence') return { ok: false, msg: 'Nothing to fence.' };
  const c = run.cargo, opt = fenceOptions().find(o => o.id === choice) || fenceOptions()[0]; let msg;
  if (opt.id === 'stash') {
    let got = 0; try { const r = window.SSX.contraband.add(c.item, opt.qty, 1); got = r?.ok === false ? 0 : (r?.qty ?? opt.qty); } catch (e) { got = 0; }
    if (!got) return fence('cash');
    const fee = pay(Math.round(c.cr * 0.25 * (got / c.qty)), 20); msg = `🎒 ${got}× ${c.name} into your stash, ${fee} cr from Kettle for the rig.`;
  } else { const cr = pay(c.cr, 40); msg = `💵 Kettle counts out ${cr} cr for the ${c.name}.`; }
  emit('fenced', { choice: opt.id, item: c.item, qty: c.qty }); emit('payout', { credits: S.stats.earned, how: 'fence' }); close(); finish(msg); return { ok: true, msg };
}
function crack() {
  if (!run || run.phase !== 'crack') return { ok: false };
  run.cracking = true; return { ok: true, msg: 'Cracking the doors… stay close.' };
}
function loot() {
  run.phase = 'escape'; run.t = ESCAPE_T; run.gross = ARMOR_GROSS; if (run.target?.traffic) run.target.traffic.wreck = 8; if (run.target) delete run.target.__belt; run.target = null; clearMark(); minimap(null);
  if (wanted() < 3) setWanted(hasPerk('wren') ? 3 : 4, 'armored transport robbery');
  emit('loot', { gross: run.gross }); toast(`💰 ${run.gross} cr in bullion chits. Lose the heat to get paid.`, 3200);
}
function split() { const crew = CREW.filter(c => run?.crew?.includes(c.id)); const cuts = crew.map(c => ({ id: c.id, name: c.name, role: c.role, cut: c.cut, cr: Math.round(ARMOR_GROSS * c.cut / 100) })); const mine = ARMOR_GROSS - cuts.reduce((n, c) => n + c.cr, 0); return { gross: ARMOR_GROSS, crew: cuts, mine }; }
function payoutArmored() {
  const sp = split(); pay(sp.mine, 120); S.stats.armored++; save();
  emit('payout', { how: 'armored', ...sp });
  finish(`🛡️ Clean getaway. ${sp.gross} cr split: ${sp.crew.map(c => `${c.name.split(' ')[0]} ${c.cut}%`).join(', ') || 'no crew'} · you keep ${sp.mine} cr.`);
}

// -- shakedown --
function shake() {
  if (!run || run.type !== 'shakedown' || run.phase !== 'lean') return { ok: false };
  run.leanN = (run.leanN || 0) + 1; if (run.leanN < 3) { toast(['💢 You slam the booth glass. "Hey!"', '💢 You lean in. "Till. Now."'][run.leanN - 1], 1800); return { ok: true, msg: 'Again.' }; }
  const c = run.cp, f = c.faction || '', fx = c.x + 6, fz = c.z + 4; let till, msg;
  if (/saltblood/i.test(f)) { till = 140 + Math.round(Math.random() * 60); hostiles(['thug', 'thug', 'goon'], fx, fz, 'Saltblood'); msg = `💢 ${till} cr out of the Saltblood till. Marrow\u2019s boys come running.`; game()?.setFlag?.('saltblood_ok', false); }
  else if (/helios/i.test(f)) { till = 220 + Math.round(Math.random() * 80); hostiles(['guard', 'guard', 'sdrone'], fx, fz, 'Helios Private'); setWanted(Math.max(wanted(), 2), 'robbed the Helios gate'); msg = `💢 ${till} cr of Helios \u201cvisitor fees\u201d. Private security is not amused.`; }
  else { till = 100 + Math.round(Math.random() * 60); setWanted(Math.max(wanted() + 2, 2), 'shook down a ColSec checkpoint'); msg = `💢 ${till} cr in fines nobody logged. ColSec wants it back.`; }
  pay(till, 30); S.cool[c.id] = Date.now() + 8 * 60e3; S.stats.shakedowns++; save();
  emit('shakedown', { checkpoint: c.id, faction: f, credits: till }); emit('payout', { how: 'shakedown', credits: till }); finish(msg); return { ok: true, msg };
}

// -- night race (Pumpkin's race.js when present, else a minimal gate sprint) --
function startRace(h, opts) {
  if (!isNight() && !opts.force) return { ok: false, msg: `🏁 Street races start after dark. Night falls in ${fmtT(nightIn())}, or wait it out in the panel.` };
  const R = window.__race;
  if (R?.start) {
    const r = R.start(RACE_DEF, {}); if (!r?.ok) return { ok: false, msg: `🏁 Can\u2019t start: ${r?.why || 'race engine busy'}.` };
    run = { type: 'race', phase: 'race', engine: 'race.js', started: Date.now(), t: 0 };
    radio('Lights off at the Junction. First to the East cut. ColSec\u2019s speed trap is on the ridge, so don\u2019t stop.', 'Vesper Kade');
    emit('start', { activity: 'race', engine: 'race.js' }); renderHud(); refreshAct(true);
    return { ok: true, msg: '🏁 Beltway Night Run: get to the grid.' };
  }
  // fallback: rings at the same gates, beat par
  const gates = RACE_DEF.gates.map(g => ({ x: h.cx + g[0], z: h.cz + g[1] }));
  run = { type: 'race', phase: 'race', engine: 'builtin', gates, next: 0, t: RACE_DEF.par * 1.6, started: Date.now() };
  emit('start', { activity: 'race', engine: 'builtin' }); renderHud(); refreshAct(true);
  return { ok: true, msg: `🏁 Beltway Night Run: ${gates.length} gates, beat ${RACE_DEF.par * 1.6 | 0} s.` };
}
function raceDone(won, res) {
  S.stats.races += won ? 1 : 0; save();
  if (won) { if (wanted() < 1) setWanted(1, 'illegal street race'); }
  emit('race', { won, result: res || null });
  if (run?.engine === 'builtin' && won) pay(RACE_DEF.purse, 60);
  finish(won ? `🏁 You took the Night Run${res?.time ? ` in ${(res.time / 1000).toFixed(1)} s` : ''}. Somebody called it in: 1★.` : '🏁 Vesper takes the Night Run. Buy-in gone.');
}

// ---------- world patch: make the marked hauler shootable (chains, never replaces; same pattern as jobs.js) ----------
const patched = new WeakSet();
function targetBox() { const v = run?.phase === 'chase' ? run.target : null; if (!v || !alive(v)) return null; return { x: v.x, y: (v.y || 0) + 1.4, z: v.z, r: (v.spec?.r || 2.2) * 0.9 }; }
function patchWorld(w) {
  if (!w || patched.has(w)) return; patched.add(w);
  const oHit = w.hitWorld, oT = w.targets, oBlast = w.blast;
  const segD = (p0, p1, c) => { const sx = p1.x - p0.x, sy = p1.y - p0.y, sz = p1.z - p0.z, L2 = sx * sx + sy * sy + sz * sz; const t = L2 ? Math.max(0, Math.min(1, ((c.x - p0.x) * sx + (c.y - p0.y) * sy + (c.z - p0.z) * sz) / L2)) : 0; return Math.hypot(p0.x + sx * t - c.x, p0.y + sy * t - c.y, p0.z + sz * t - c.z); };
  if (oHit) w.hitWorld = (p0, p1, b) => { const c = targetBox(); if (c && segD(p0, p1, c) < c.r) { hitTarget(b?.dmg || 1, 'shot'); return true; } return oHit(p0, p1, b); };
  if (oT) w.targets = () => { const out = oT(); const c = targetBox(); if (c) out.push({ x: c.x, y: c.y, z: c.z, kind: 'hauler' }); return out; };
  if (oBlast) w.blast = (c0, R, dmg, emp) => { const c = targetBox(); let n = 0; if (c && Math.hypot(c.x - c0.x, c.z - c0.z) < R + c.r) { hitTarget(emp ? 30 : dmg, 'blast'); n = 1; } return n + oBlast(c0, R, dmg, emp); };
}

// ---------- tick ----------
let lastT = performance.now(), lastFrame = 0;
function loop() { requestAnimationFrame(loop); const now = performance.now(); if (now - lastFrame < 100) return; const dt = Math.min(0.5, (now - lastT) / 1000); lastT = now; lastFrame = now; try { beltwayTick(dt); } catch (e) { console.warn('beltway tick', e); } }
export function beltwayTick(dt) {
  const st = app()?.state, h = here(), s = surf();
  if (!h || !st?.onSurface || st.transitioning) { if (run && !st?.transitioning) fail('You left Mars.', 'left'); clearMark(); renderHud(); refreshAct(); return; }
  patchWorld(s.world);
  if (mark && mark.parent !== s.scene) clearMark();
  if (run) step(dt, h);
  renderHud(); refreshAct();
}
function step(dt, h) {
  const r = run, i = h.info, g = game();
  if (g?.isDown?.() && r.type !== 'race') return fail(r.phase === 'escape' ? 'You went down with the bullion. ColSec keeps it.' : 'You went down.', 'down');
  if (r.type === 'hijack' || r.type === 'armored') {
    const col = r.type === 'armored' ? 0x4da3ff : 0xffd400;
    if (r.phase === 'scout') {
      r.t -= dt; const v = pickTarget(h); if (v) lockTarget(v); else if (r.t <= 0) return fail(r.type === 'armored' ? 'The bullion run went through without you.' : 'No haulers came through. Kettle\u2019s bored.', 'timer');
      return;
    }
    if (r.phase === 'chase' || r.phase === 'grab' || r.phase === 'crack') {
      const v = r.target;
      if (!alive(v)) return fail(r.phase === 'chase' ? 'You lost the hauler in traffic.' : 'The wreck got towed.', 'lost');
      if (r.phase === 'chase') {
        if (!v.traffic) { // you carjacked it: the whole rig is yours
          r.hp = 0; emit('disabled', { x: v.x, z: v.z, carjack: true });
          if (r.type === 'armored') { setWanted(Math.max(wanted(), hasPerk('wren') ? 3 : 4), 'stole an armored transport'); loot(); toast('🛡️ You took the whole transport. Lose the heat.', 3000); return; }
          r.phase = 'grab'; const m = grabCargo().msg; toast(`🚚 You jacked the whole rig. ${m}`, 3000); return;
        } else {
          const w = v.traffic.wreck; if (w > 0 && !(r.lastWreck > 0) && w < 1e5) hitTarget(RAM_DMG, 'ram'); r.lastWreck = w;
          r.t -= dt; const d = Math.hypot(v.x - h.x, v.z - h.z); if (d > CHASE_LOST || r.t <= 0) return fail(d > CHASE_LOST ? 'The hauler got away.' : 'Too slow. The convoy reached the depot.', 'lost');
        }
      }
      setMark(r.phase === 'chase' ? `${r.type === 'armored' ? '🛡️ ARMORED' : '🚚 CARGO'} · ${Math.ceil(r.hp)}/${r.hpMax}` : r.phase === 'crack' ? '🔓 CRACK THE DOORS' : '📦 GRAB THE CRATES', col, 4.5);
      placeMark(v.x, v.z, (v.y || 0) - (v.spec?.hover || 0)); minimap(v.x, v.z, hex(col));
      if (r.phase === 'crack') {
        const d = Math.hypot(v.x - h.x, v.z - h.z);
        if (r.cracking) { if (d > 6 || i.driving) { r.cracking = false; r.crackT = 0; toast('Cracking interrupted. Get back to the doors.', 1800); } else { r.crackT += dt; if (r.crackT >= (hasPerk('wren') ? 2 : CRACK_T)) loot(); } }
        r.t -= dt; if (r.t <= 0 && run) return fail('ColSec reinforced the transport. Too late.', 'timer');
      }
      if (r.phase === 'grab') { r.t -= dt; if (r.t <= 0) return fail('Somebody else grabbed the crates.', 'timer'); }
      return;
    }
    if (r.phase === 'deliver') {
      const f = fenceAt(h); setMark('🔧 KETTLE\u2019S LOT', 0xffd400, 7); placeMark(f.x, f.z); minimap(f.x, f.z, '#ffd400');
      r.t -= dt; if (r.t <= 0) return fail('Kettle stopped waiting. The cargo is hot junk now.', 'timer');
      if (Math.hypot(f.x - h.x, f.z - h.z) < 9 && (!i.driving || Math.abs(i.speed || 0) < 5)) { r.phase = 'fence'; emit('change', { what: 'fence' }); open(); }
      return;
    }
    if (r.phase === 'fence') { const f = fenceAt(h); placeMark(f.x, f.z); return; }
    if (r.phase === 'escape') { r.t -= dt; if (wanted() <= 0) return payoutArmored(); if (r.t <= 0) return fail('ColSec ran you down. The bullion is evidence now.', 'timer'); return; }
  }
  if (r.type === 'shakedown') {
    const c = r.cp; setMark(`💢 ${String(c.name || c.id).toUpperCase()}`, 0xff5a3c, 9); placeMark(c.x, c.z); minimap(c.x, c.z, '#ff5a3c');
    const d = Math.hypot(c.x - h.x, c.z - h.z); r.dist = d;
    if (r.phase === 'go' && d < 12 && !i.driving) { r.phase = 'lean'; r.leanN = 0; }
    else if (r.phase === 'lean' && (d > 16 || i.driving)) r.phase = 'go';
    return;
  }
  if (r.type === 'race') {
    if (r.engine === 'race.js') {
      const R = window.__race, st = R?.state; r.race = st ? { phase: st.phase, next: st.next, passed: st.passed, time: st.time } : null;
      if (!st) { const res = R?.result; if (res && res.id === RACE_DEF.id) return raceDone(!!res.won, res); return fail('Race called off.', 'quit'); }
      return;
    }
    const gt = r.gates[r.next]; setMark(`🏁 GATE ${r.next + 1}/${r.gates.length}`, 0x39ff88, 7); placeMark(gt.x, gt.z); minimap(gt.x, gt.z, '#39ff88');
    r.t -= dt; if (Math.hypot(gt.x - h.x, gt.z - h.z) < 8) { r.next++; if (r.next >= r.gates.length) return raceDone(true, { time: Date.now() - r.started }); }
    if (r.t <= 0) return raceDone(false);
  }
}

// ---------- UI (high contrast: black buttons, white text, 44px+ targets, window.__onTap) ----------
const css = `
#beltHud{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(166px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:6px 6px 6px 12px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:700 13px/1.25 system-ui,sans-serif;pointer-events:auto}
@media (max-width:640px){#beltHud{top:calc(244px + env(safe-area-inset-top));left:8px;right:76px;transform:none;max-width:none} #beltHud .tx{flex:1}}
body.surface #beltHud.show{display:flex} #beltHud .tx{min-width:0} #beltHud .l1,#beltHud .l2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #beltHud .l1{font-weight:800} #beltHud .warn{color:#ffd400}
#beltHud button,#beltAct{min-height:44px;min-width:56px;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation;flex:none}
#beltAct{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));top:54%;display:none;min-height:52px;min-width:130px;max-width:70vw} body.surface #beltAct.show{display:block} body.indoors #beltAct{display:none!important}
#beltPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)} #beltPanel.show{display:flex}
#beltPanel .wrap{width:min(460px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:14px;border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-sizing:border-box}
#beltBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch} #beltPanel .msg,#beltPanel .foot{flex:none}
#beltPanel h2{margin:0 0 2px;font-size:18px} #beltPanel .sub{margin:0 0 8px;font-size:13px;opacity:.9}
#beltPanel .it{padding:9px 0;border-top:1px solid rgba(255,255,255,.3)} #beltPanel .it b{font-size:15px} #beltPanel .it small{display:block;font-size:12px;opacity:.9;margin-top:2px}
#beltPanel button{width:100%;min-height:46px;margin-top:6px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation} #beltPanel button:disabled{opacity:.55}
#beltPanel button.sel{background:#fff;color:#000}
#beltPanel .msg{min-height:1.2em;margin:8px 0;font-weight:700} #beltPanel .foot{display:flex;gap:8px}
`;
let hud, hudTx, hudBtn, actBtn, panel, body, msgEl, lastMsg = '', lastTouchAct = 0, hudKey = '';
function tap(el, fn) {
  const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouchAct < 700) return; if (e?.type === 'pointerup') lastTouchAct = n; fn(e); };
  (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g);
}
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
// Phone hotkey button (🛣️ Belt, order 4) on the shared #ssxDock (v7.5.3: owned by mars/turf.js, right edge above Jump/Run, styles in
// #ssxDockCss). We never create a dock: if #ssxDock isn't on the page yet we wait for it (turf may load after us) and
// attach once it appears; with no dock at all this adds nothing. Bound with window.__onTap.
function dockButton(id, label, aria, order, fn) {
  const attach = () => {
    const d = document.getElementById('ssxDock'); if (!d) return false;
    if (document.getElementById(id)) return true;
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria); b.style.order = String(order); d.appendChild(b); tap(b, fn); return true;
  };
  if (attach()) return;
  try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no observer: no dock button */ }
}
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  hud = document.createElement('div'); hud.id = 'beltHud'; hud.innerHTML = '<div class="tx"><div class="l1"></div><div class="l2"></div></div><button id="beltQuit" type="button" aria-label="Quit Beltway job">Quit</button>'; document.body.appendChild(hud);
  hudTx = [hud.querySelector('.l1'), hud.querySelector('.l2')]; hudBtn = hud.querySelector('#beltQuit');
  tap(hudBtn, () => { stop('quit'); toast('Beltway job dropped.', 1800); }); tap(hud.querySelector('.tx'), () => open());
  actBtn = document.createElement('button'); actBtn.id = 'beltAct'; actBtn.type = 'button'; document.body.appendChild(actBtn); tap(actBtn, () => doAction());
  panel = document.createElement('div'); panel.id = 'beltPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Ares Beltway"><div id="beltBody"></div><div class="msg" id="beltMsg"></div><div class="foot"><button id="beltClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); body = panel.querySelector('#beltBody'); msgEl = panel.querySelector('#beltMsg');
  tap(panel.querySelector('#beltClose'), close);
  dockButton('dockBelt', '🛣️\nBelt', 'Beltway (.)', 4, () => panel.classList.contains('show') ? close() : open());
  addEventListener('keydown', e => {
    if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || !app()?.state?.onSurface) return;
    if (e.code === 'Period') { panel.classList.contains('show') ? close() : open(); }
    else if (e.code === 'Digit8' && actBtn.classList.contains('show')) { e.preventDefault(); doAction(); }
  });
}
function actionFor() {
  const r = run; if (!r) return null; const h = here(); if (!h || h.info.inside) return null;
  if (r.phase === 'grab' && r.target && Math.hypot(r.target.x - h.x, r.target.z - h.z) < 6 && !h.info.driving) return { id: 'grab', label: '📦 Grab the crates' };
  if (r.phase === 'crack' && r.target && Math.hypot(r.target.x - h.x, r.target.z - h.z) < 6 && !h.info.driving) return r.cracking ? { id: 'none', label: `🔓 Cracking… ${Math.round(r.crackT / (hasPerk('wren') ? 2 : CRACK_T) * 100)}%` } : { id: 'crack', label: '🔓 Crack the doors' };
  if (r.phase === 'lean') return { id: 'shake', label: r.leanN ? `💢 Lean harder (${r.leanN}/3)` : '💢 Shake down the booth' };
  if (r.phase === 'fence') return { id: 'fence', label: '🔧 Fence the cargo' };
  return null;
}
function doAction() {
  const a = actionFor(); if (!a) return; let res = null;
  if (a.id === 'grab') res = grabCargo(); else if (a.id === 'crack') res = crack(); else if (a.id === 'shake') res = shake(); else if (a.id === 'fence') open();
  if (res?.msg && a.id !== 'shake') toast(res.msg, 2400); refreshAct(true);
}
let actKey = '';
function refreshAct(force) { if (!actBtn) return; const a = actionFor(), k = a ? a.id + a.label : ''; if (!force && k === actKey) return; actKey = k; actBtn.textContent = a ? a.label + (isTouch() ? '' : ' (8)') : ''; actBtn.classList.toggle('show', !!a); }
function hudLines() {
  const r = run, h = here(); if (!r || !h) return null; const A = ACT(r.type);
  const far = (x, z) => `${Math.round(Math.hypot(x - h.x, z - h.z))} m ${dirTo(h.x, h.z, x, z)}`;
  if (r.type === 'race') { const q = r.race; return [`${A.icon} NIGHT RUN${r.engine === 'builtin' ? ` · gate ${r.next + 1}/${r.gates.length}` : ''}`, r.engine === 'builtin' ? `⏱ ${fmtT(r.t)} · beat Vesper Kade's par` : q ? (q.phase === 'grid' ? 'On the grid. Lights out soon.' : `Gate ${Math.min(q.passed + 1, RACE_DEF.gates.length)}/${RACE_DEF.gates.length} · ${(q.time || 0).toFixed(1)} s · ColSec trap at gate 3`) : 'Starting…', r.engine === 'builtin' && r.t < 15]; }
  if (r.type === 'shakedown') return [`${A.icon} SHAKEDOWN · ${String(r.cp.name || r.cp.id).toUpperCase()}`, r.phase === 'lean' ? `At the booth: lean on them ${r.leanN || 0}/3` : `Get there on foot · ${far(r.cp.x, r.cp.z)}`, false];
  const ttl = r.type === 'armored' ? 'ARMORED TRANSPORT' : 'CONVOY HIJACK';
  if (r.phase === 'scout') { const ri = roadInfo(h.x, h.z); return [`${A.icon} ${ttl}`, ri && ri.d > 60 ? `Get on the Beltway (${Math.round(ri.d)} m) · haulers run the lanes` : `Watching the lanes for a ${r.type === 'armored' ? 'bullion hauler' : 'cargo hauler'} · ${fmtT(r.t)}`, r.t < 20]; }
  if (r.phase === 'chase') { const v = r.target; return [`${A.icon} ${ttl} · ${Math.ceil(r.hp)}/${r.hpMax} HP`, `${v ? far(v.x, v.z) : '?'} · ram or shoot it · ⏱ ${fmtT(r.t)}`, r.t < 20]; }
  if (r.phase === 'grab') return [`${A.icon} HAULER DOWN`, `On foot to the rig: grab ${r.cargo.qty}× ${r.cargo.name} · ${fmtT(r.t)}`, false];
  if (r.phase === 'crack') return [`${A.icon} TRANSPORT DOWN · ${wanted()}★`, r.cracking ? `Cracking ${Math.round(r.crackT / (hasPerk('wren') ? 2 : CRACK_T) * 100)}% · stay close` : `On foot to the doors and crack them · ${fmtT(r.t)}`, true];
  if (r.phase === 'deliver') { const f = fenceAt(h); return [`📦 ${r.cargo.qty}× ${r.cargo.name.toUpperCase()}`, `Kettle's lot · ${far(f.x, f.z)} · ${fmtT(r.t)}`, r.t < 30]; }
  if (r.phase === 'fence') return ['🔧 KETTLE\u2019S LOT', 'Fence the cargo', false];
  if (r.phase === 'escape') { const sp = split(); return [`💰 ${sp.gross} cr · you keep ${sp.mine}`, `Lose the heat: ${wanted()}★ · ⏱ ${fmtT(r.t)}`, true]; }
  return [`${A.icon} ${A.name}`, '', false];
}
function renderHud() {
  if (!hud) return; const L = hudLines();
  if (!L) { if (hud.classList.contains('show')) { hud.classList.remove('show'); hudKey = ''; } if (panel?.classList.contains('show')) renderPanelThrottled(); return; }
  const k = L.join('|'); if (k !== hudKey) { hudKey = k; hudTx[0].textContent = L[0]; hudTx[1].textContent = L[1]; hudTx[0].classList.toggle('warn', !!L[2]); }
  hud.classList.add('show'); if (panel?.classList.contains('show')) renderPanelThrottled();
}
let panelT = 0; function renderPanelThrottled() { const n = performance.now(); if (n - panelT > 1000) { panelT = n; render(); } }
function open() { ui(); lastMsg = ''; panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render(); }
function close() { panel?.classList.remove('show'); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function render() {
  if (!panel || !panel.classList.contains('show')) return;
  const h = here(); let html;
  if (run?.phase === 'fence') {
    html = `<h2>🔧 Kettle\u2019s lot</h2><p class="sub">Kettle kicks a crate. \u201c${run.cargo.qty}× ${esc(run.cargo.name)}. Cash, or you want to move it yourself?\u201d</p>`;
    for (const o of fenceOptions()) html += `<button type="button" data-fence="${o.id}">${esc(o.label)}</button>`;
  } else {
    html = `<h2>🛣️ Ares Beltway</h2><p class="sub">${isNight() ? '🌙 Night. The racers are out.' : `☀️ Day. Night falls in ${fmtT(nightIn())}.`} · ${wanted()}★ · earned ${S.stats.earned} cr</p>`;
    if (run) html += `<div class="it"><b>${ACT(run.type).icon} On a ${esc(ACT(run.type).name.toLowerCase())}</b><small>${esc(hudLines()?.[1] || '')}</small><button type="button" data-quit="1">Quit this job</button></div>`;
    for (const a of ACTS) {
      let extra = '', dis = !!run;
      if (a.id === 'shakedown') { const c = h ? nearestCheckpoint(h.x, h.z) : null; const cd = c ? (S.cool[c.id] || 0) - Date.now() : 0; extra = c ? `<small>Nearest: ${esc(c.name)} (${esc(c.faction)}) · ${Math.round(Math.hypot(c.x - h.x, c.z - h.z))} m${cd > 0 ? ` · cooling off ${fmtT(cd / 1000)}` : ''}</small>` : ''; }
      if (a.id === 'race' && !isNight()) { extra = `<small>After dark only. Night in ${fmtT(nightIn())}.</small>`; }
      if (a.id === 'armored') { const sp = CREW.filter(c => S.crew[c.id]); extra = `<small>Crew: ${sp.length ? sp.map(c => `${esc(c.name)} ${c.cut}%`).join(', ') : 'none (you keep 100%)'} · gross ${ARMOR_GROSS} cr</small>`; }
      html += `<div class="it"><b>${a.icon} ${esc(a.name)}</b><small>${esc(a.blurb)}</small>${extra}<button type="button" data-start="${a.id}" ${dis ? 'disabled' : ''}>Start ${esc(a.name.toLowerCase())}</button>${a.id === 'race' && !isNight() ? `<button type="button" data-dark="1" ${dis ? 'disabled' : ''}>🌙 Wait for dark</button>` : ''}</div>`;
    }
    html += `<div class="it"><b>🛡️ Armored-transport crew</b><small>Tap to bring someone along. Cuts come out of the ${ARMOR_GROSS} cr gross.</small>`;
    for (const c of CREW) html += `<button type="button" data-crew="${c.id}" class="${S.crew[c.id] ? 'sel' : ''}" aria-pressed="${!!S.crew[c.id]}" ${run?.type === 'armored' ? 'disabled' : ''}>${S.crew[c.id] ? '✓ ' : ''}${esc(c.name)} · ${esc(c.role)} · ${c.cut}%<br><span style="font-weight:600;font-size:12px">${esc(c.perk)}</span></button>`;
    html += `</div><p class="sub" style="margin-top:8px">Keys: O Beltway panel, I action (grab, crack, shake down, fence). Phones: 🛣️ Belt in the dock and the action button on the left.</p>`;
  }
  body.innerHTML = html; msgEl.textContent = lastMsg;
  body.querySelectorAll('button[data-start]').forEach(bt => tap(bt, () => { const r = start(bt.dataset.start); lastMsg = r.msg; if (r.ok) { close(); toast(r.msg, 2600); return; } render(); }));
  body.querySelectorAll('button[data-crew]').forEach(bt => tap(bt, () => { setCrew(bt.dataset.crew, !S.crew[bt.dataset.crew]); render(); }));
  body.querySelectorAll('button[data-fence]').forEach(bt => tap(bt, () => fence(bt.dataset.fence)));
  body.querySelectorAll('button[data-quit]').forEach(bt => tap(bt, () => { stop('quit'); render(); }));
  body.querySelectorAll('button[data-dark]').forEach(bt => tap(bt, () => { lastMsg = waitForDark().msg; render(); }));
}
function setCrew(id, v) { if (!CREW.some(c => c.id === id)) return false; S.crew[id] = !!v; save(); emit('change', { what: 'crew' }); return true; }

// ---------- boot ----------
const API = {
  activities: ACTS.map(a => ({ id: a.id, name: a.name, key: a.id === 'race' ? 'night only' : null, blurb: a.blurb })),
  start: (type, opts) => start(type, opts), stop: why => stop(why || 'quit'),
  active: () => run ? { type: run.type, phase: run.phase, target: run.target ? { kind: run.target.kind, x: run.target.x, z: run.target.z } : null, hp: run.hp, hpMax: run.hpMax, cargo: run.cargo ? { ...run.cargo } : null,
    crew: run.crew?.slice(), gross: run.gross || null, checkpoint: run.cp ? { id: run.cp.id, name: run.cp.name, faction: run.cp.faction } : null, timeLeft: run.t ? Math.round(run.t) : null, engine: run.engine || null, race: run.race || null } : null,
  on, open, close, fence, split: () => split(),
  crew: () => CREW.map(c => ({ ...c, on: !!S.crew[c.id] })), setCrew,
  isNight, nightIn, waitForDark, raceDef: () => JSON.parse(JSON.stringify(RACE_DEF)),
  stats: () => ({ ...S.stats }),
  debug: {
    toRoad(s = 140) { const H = hw(), h = here(); if (!H || !h) return false; const p = H.at(s); surf().debugMove(p.x, p.z, 0); return { x: p.x, z: p.z }; },
    target: () => { const v = run?.target; return v ? { kind: v.kind, x: v.x, z: v.z, traffic: !!v.traffic, wreck: v.traffic?.wreck ?? null } : null; },
    haulers: () => liveHaulers().map(v => ({ x: v.x, z: v.z })),
    disable() { if (run?.phase !== 'chase') return false; run.hp = 0; disable(); return true; },
    hit: (n = 10) => { hitTarget(n, 'debug'); return run?.hp; },
    toTarget() { const v = run?.target; if (!v) return false; surf().debugMove(v.x + 3.2, v.z + 3.2, 0); return true; },
    toFence() { const h = here(); if (!h) return false; const f = fenceAt(h); surf().debugMove(f.x + 2, f.z + 2, 0); return true; },
    toCheckpoint(id) { const c = checkpoints().find(k => k.id === (id || run?.cp?.id)) || checkpoints()[0]; if (!c) return false; surf().debugMove(c.x + 4, c.z + 4, 0); return true; },
    finishCrack() { if (run?.phase !== 'crack') return false; loot(); return true; },
    clearHeat() { setWanted(0, 'debug'); return wanted(); },
    setNight(v = true) { const T = window.SSX?.time; if (!v && isNight() && typeof T?.isNight === 'function' && typeof T.set === 'function') { T.set(12); return isNight(); } if (v && !isNight()) waitForDark(); else if (!v && isNight()) { S.solOff += (1 - solT()) * SOL_MS + 1000; save(); } return isNight(); },
    finishRace(won = true) { if (run?.type !== 'race') return false; raceDone(won, { time: Date.now() - run.started }); return true; },
    state: () => JSON.parse(JSON.stringify({ S, run: run && { ...run, target: run.target ? { x: run.target.x, z: run.target.z } : null } })),
    reset() { if (run) stop('quit'); S = fresh(); save(); emit('change', { what: 'reset' }); }
  }
};
(function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 200); return; }
  window.SSX.beltway = API; ui();
  try { window.SSX.registerMenuItem({ id: 'rmBeltway', label: '🛣️ Beltway', onTap: () => open() }); } catch (e) { console.warn('beltway menu', e); }
  requestAnimationFrame(loop);
})();
